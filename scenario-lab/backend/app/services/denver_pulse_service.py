"""
Denver Pulse — unified multi-policy simulation engine.
All computation is deterministic and uses real Denver baseline constants.
"""
from __future__ import annotations

import random
import time
from datetime import date, datetime, timedelta

# ---------------------------------------------------------------------------
# Simple module-level TTL cache for dashboard data (no external deps)
# ---------------------------------------------------------------------------
_DASHBOARD_CACHE: dict = {}
_DASHBOARD_CACHE_TS: float = 0.0
_DASHBOARD_TTL: float = 60.0  # seconds

def invalidate_dashboard_cache() -> None:
    global _DASHBOARD_CACHE, _DASHBOARD_CACHE_TS
    _DASHBOARD_CACHE = {}
    _DASHBOARD_CACHE_TS = 0.0

# ---------------------------------------------------------------------------
# Denver baseline constants (from 2024 GHG inventory)
# ---------------------------------------------------------------------------
TOTAL_ONROAD_CO2E_MT = 1_999_929
TRANSIT_CO2E_MT = 36_104
FLEET_SIZE = 574_707
FLEET_BEV_PCT = 3.6
ANNUAL_VMT_MILES = 4_090_000_000
BUS_ANNUAL_MILES = 21_000_000
CO2_FACTOR_GAS_MT_PER_GAL = 0.00878
EV_GRID_EF_MT_PER_MWH = 0.388
AVG_FLEET_MPG = 25.4
FREE_FLOW_SPEED_KMH = 50.0
DAILY_GHG_BASE_TCO2E = round(TOTAL_ONROAD_CO2E_MT / 365)  # ~5_479 tCO₂e/day

DENVER_CORRIDORS: dict[str, float] = {
    "I-25": 0.90, "I-70": 0.85, "E_Colfax": 0.70,
    "S_Broadway": 0.65, "Colorado_Blvd": 0.75, "Speer_Blvd": 0.60,
}

# TOP_ZONES with deterministic per-zone profiles (NBHD_ID as key)
ZONE_PROFILES: dict[str, dict] = {
    "9":  {"name": "Capitol Hill",    "corridor": "E_Colfax",      "character": "nightlife"},
    "13": {"name": "Cherry Creek",    "corridor": "Colorado_Blvd", "character": "retail"},
    "14": {"name": "City Park",       "corridor": "Colorado_Blvd", "character": "park"},
    "20": {"name": "Congress Park",   "corridor": "E_Colfax",      "character": "residential"},
    "70": {"name": "Washington Park", "corridor": "S_Broadway",    "character": "residential"},
}

POLICY_PRESETS: dict[str, dict[str, float]] = {
    "ev":   {"ev_share_pct": +20.0, "emission_idx": -15.0},
    "bus":  {"pt_pct": +15.0, "car_pct": -10.0, "road_capacity_idx": -10.0, "speed_kmh": -5.0},
    "toll": {"traffic_vol_idx": -15.0, "pt_pct": +10.0, "car_pct": -10.0, "speed_kmh": +8.0},
    "bike": {"bike_pct": +10.0, "car_pct": -8.0, "traffic_vol_idx": -5.0},
    "diet": {"road_capacity_idx": -20.0, "traffic_vol_idx": -5.0, "pt_pct": +5.0, "bike_pct": +5.0},
}

SCOPE_GHG_SCALE: dict[str, float] = {"downtown": 0.22, "corridor": 0.45, "city": 1.0}
HORIZON_MULTIPLIER: dict[str, float] = {"3m": 0.25, "6m": 0.5, "1y": 1.0}

_DEFAULT_SLIDERS = {
    "traffic_vol_idx": 100.0, "road_capacity_idx": 100.0,
    "speed_kmh": 35.0, "emission_idx": 100.0, "ev_share_pct": 15.0,
    "car_pct": 45.0, "pt_pct": 30.0, "bike_pct": 15.0, "walk_pct": 10.0,
}


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def get_baseline_kpis() -> dict:
    return {
        "ghg_tco2e": float(DAILY_GHG_BASE_TCO2E),
        "congestion_pct": 37.6,
        "avg_speed_kmh": 35.0,
        "mode_share": {"car": 45.0, "pt": 30.0, "bike": 15.0, "walk": 10.0},
    }


def apply_policies(sliders: dict, policies: list[str]) -> dict:
    s = dict(sliders)
    for p in policies:
        for k, delta in POLICY_PRESETS.get(p, {}).items():
            s[k] = s.get(k, 0.0) + delta
    # Clamp ranges
    s["traffic_vol_idx"] = max(50.0, min(150.0, s["traffic_vol_idx"]))
    s["road_capacity_idx"] = max(50.0, min(150.0, s["road_capacity_idx"]))
    s["speed_kmh"] = max(10.0, min(80.0, s["speed_kmh"]))
    s["emission_idx"] = max(50.0, min(150.0, s["emission_idx"]))
    s["ev_share_pct"] = max(0.0, min(100.0, s["ev_share_pct"]))
    # Normalize mode shares to sum=100
    modes = ["car_pct", "pt_pct", "bike_pct", "walk_pct"]
    total = sum(max(0.0, s[m]) for m in modes)
    if total > 0 and abs(total - 100.0) > 0.01:
        for m in modes:
            s[m] = round(max(0.0, s[m]) * 100.0 / total, 2)
    else:
        for m in modes:
            s[m] = max(0.0, s[m])
    return s


def sliders_to_kpis(s: dict, scope: str, horizon: str) -> dict:
    congestion = round(68.0 * (s["traffic_vol_idx"] / s["road_capacity_idx"]), 1)
    congestion = max(0.0, min(100.0, congestion))
    speed = round(s["speed_kmh"] * (1.0 - 0.6 * congestion / 100.0), 1)
    fleet_factor = (s["emission_idx"] / 100.0) * (1.0 - (s["ev_share_pct"] / 100.0) * 0.72)
    ghg = round(
        DAILY_GHG_BASE_TCO2E
        * (s["traffic_vol_idx"] / 100.0)
        * fleet_factor
        * SCOPE_GHG_SCALE.get(scope, 1.0)
        * HORIZON_MULTIPLIER.get(horizon, 1.0),
        1,
    )
    return {
        "ghg_tco2e": ghg,
        "congestion_pct": congestion,
        "avg_speed_kmh": speed,
        "mode_share": {
            "car": round(s["car_pct"], 1),
            "pt": round(s["pt_pct"], 1),
            "bike": round(s["bike_pct"], 1),
            "walk": round(s["walk_pct"], 1),
        },
    }


def compute_cesium_edges(baseline_s: dict, scenario_s: dict) -> dict:
    def _intensities(s: dict) -> dict[str, float]:
        tf = s["traffic_vol_idx"] / 100.0
        ef = (s["emission_idx"] / 100.0) * (1 - s["ev_share_pct"] / 100.0 * 0.72)
        return {
            k: round(min(1.0, max(0.0, base * tf * ef)), 3)
            for k, base in DENVER_CORRIDORS.items()
        }
    return {"baseline": _intensities(baseline_s), "scenario": _intensities(scenario_s)}


def run_simulate(request_dict: dict) -> dict:
    policies = request_dict.get("policies", [])
    scope = request_dict.get("scope", "city")
    horizon = request_dict.get("horizon", "1y")

    raw_sliders_input = request_dict.get("sliders", {})
    if hasattr(raw_sliders_input, "model_dump"):
        raw_sliders_input = raw_sliders_input.model_dump()
    elif hasattr(raw_sliders_input, "__dict__") and not isinstance(raw_sliders_input, dict):
        raw_sliders_input = dict(raw_sliders_input)

    raw_sliders = {**_DEFAULT_SLIDERS, **raw_sliders_input}
    scenario_sliders = apply_policies(raw_sliders, policies)

    baseline_kpis = sliders_to_kpis(raw_sliders, scope, horizon)
    scenario_kpis = sliders_to_kpis(scenario_sliders, scope, horizon)

    deltas = {
        "ghg_tco2e_delta": round(scenario_kpis["ghg_tco2e"] - baseline_kpis["ghg_tco2e"], 1),
        "congestion_pct_delta": round(scenario_kpis["congestion_pct"] - baseline_kpis["congestion_pct"], 1),
        "avg_speed_kmh_delta": round(scenario_kpis["avg_speed_kmh"] - baseline_kpis["avg_speed_kmh"], 1),
        "mode_share_delta": {
            k: round(scenario_kpis["mode_share"][k] - baseline_kpis["mode_share"][k], 1)
            for k in ["car", "pt", "bike", "walk"]
        },
    }
    confidence = min(95.0, 60.0 + len(policies) * 8.0)
    cesium = compute_cesium_edges(raw_sliders, scenario_sliders)

    return {
        "baseline": baseline_kpis,
        "scenario": scenario_kpis,
        "deltas": deltas,
        "confidence_score": confidence,
        "cesium_edges": cesium,
    }


# ---------------------------------------------------------------------------
# Dashboard data builder
# ---------------------------------------------------------------------------

def get_dashboard_data(daily_stats: list[dict]) -> dict:
    global _DASHBOARD_CACHE, _DASHBOARD_CACHE_TS
    cache_key = "default" if not daily_stats else f"custom_{len(daily_stats)}"
    if _DASHBOARD_CACHE.get(cache_key) and (time.time() - _DASHBOARD_CACHE_TS) < _DASHBOARD_TTL:
        return _DASHBOARD_CACHE[cache_key]

    if not daily_stats:
        daily_stats = _generate_synthetic_stats(37)

    stats = sorted(daily_stats, key=lambda r: r["date"])

    # Recompute ghg_tco2e from current constant (fixes stale pre-baked values in data file)
    for r in stats:
        ci = r.get("congestion_index", 0.376)
        r["ghg_tco2e"] = round(DAILY_GHG_BASE_TCO2E * (1 + (ci - 0.376) * 0.12), 1)

    # Shift dates so last record = yesterday
    today = date.today()
    yesterday = today - timedelta(days=1)
    last_date = date.fromisoformat(stats[-1]["date"])
    offset = (yesterday - last_date).days
    for rec in stats:
        d = date.fromisoformat(rec["date"]) + timedelta(days=offset)
        rec["_shifted_date"] = d

    current = stats[-1]
    prev_idx = max(0, len(stats) - 8)
    prev = stats[prev_idx]

    # KPIs
    kpis = {
        "ghg_tco2e": current["ghg_tco2e"],
        "congestion_pct": round(current["congestion_index"] * 100, 1),
        "avg_speed_kmh": round(current["avg_speed_kmh"], 1),
        "mode_share": {
            "car": current["car_pct"], "pt": current["pt_pct"],
            "bike": current["bike_pct"], "walk": current["walk_pct"],
        },
    }

    def _pct_change(cur: float, prev_val: float) -> float:
        if prev_val == 0:
            return 0.0
        return round((cur - prev_val) / prev_val * 100, 1)

    kpi_trends = {
        "ghg": _pct_change(current["ghg_tco2e"], prev["ghg_tco2e"]),
        "speed": _pct_change(current["avg_speed_kmh"], prev["avg_speed_kmh"]),
        "congestion": _pct_change(current["congestion_index"], prev["congestion_index"]),
        "pt": _pct_change(current["pt_pct"], prev["pt_pct"]),
    }

    # Trends
    def _build_trends(records: list[dict], label_fn) -> dict:
        return {
            "labels":     [label_fn(r) for r in records],
            "emissions":  [r["ghg_tco2e"] for r in records],
            "congestion": [round(r.get("congestion_index", 0.0) * 100, 1) for r in records],
            "speed":      [round(r.get("avg_speed_kmh", 40.0), 1) for r in records],
            "car_pct":    [r["car_pct"] for r in records],
            "pt_pct":     [r["pt_pct"] for r in records],
            "bike_pct":   [r["bike_pct"] for r in records],
            "walk_pct":   [r["walk_pct"] for r in records],
        }

    last7 = stats[-7:] if len(stats) >= 7 else stats
    trends_7d = _build_trends(last7, lambda r: r["_shifted_date"].strftime("%a"))

    last30 = stats[-30:] if len(stats) >= 30 else stats
    # Pad to 30 if needed
    while len(last30) < 30:
        last30 = [last30[0]] + last30
    trends_30d = _build_trends(last30, lambda r: r["_shifted_date"].strftime("%b %d"))

    # YTD: bucket by month
    months_map: dict[str, list[dict]] = {}
    for r in stats:
        key = r["_shifted_date"].strftime("%b")
        months_map.setdefault(key, []).append(r)

    ytd_labels = list(months_map.keys())
    ytd_recs_list = list(months_map.values())
    ytd_emissions   = [round(sum(r["ghg_tco2e"] for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_congestion  = [round(sum(r.get("congestion_index", 0.0) * 100 for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_speed       = [round(sum(r.get("avg_speed_kmh", 40.0) for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_car         = [round(sum(r["car_pct"] for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_pt          = [round(sum(r["pt_pct"] for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_bike        = [round(sum(r["bike_pct"] for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    ytd_walk        = [round(sum(r["walk_pct"] for r in recs) / len(recs), 1) for recs in ytd_recs_list]
    trends_ytd = {
        "labels": ytd_labels,
        "emissions": ytd_emissions,
        "congestion": ytd_congestion,
        "speed": ytd_speed,
        "car_pct": ytd_car, "pt_pct": ytd_pt,
        "bike_pct": ytd_bike, "walk_pct": ytd_walk,
    }

    # Alerts (city-wide)
    alerts = _generate_alerts(current, prev, stats)

    # Region alerts — one group per TOP_ZONE
    region_alerts = []
    for zone_id, zone_info in ZONE_PROFILES.items():
        corridor_val = DENVER_CORRIDORS.get(zone_info["corridor"], 0.70)
        zone_alerts = _generate_region_alerts(
            zone_id, zone_info["name"], zone_info["character"], corridor_val
        )
        levels = [a["level"] for a in zone_alerts]
        summary_level = next(
            (lv for lv in ("red", "orange", "yellow", "green", "blue") if lv in levels), "green"
        )
        region_alerts.append({
            "region_id": zone_id,
            "region_name": zone_info["name"],
            "summary_level": summary_level,
            "alerts": zone_alerts,
        })

    # Cesium edges — 4 metrics
    ci = current["congestion_index"]
    speed_norm = 1 - current["avg_speed_kmh"] / FREE_FLOW_SPEED_KMH
    cesium_edges = {
        "ghg": {k: round(min(1.0, v * ci / 0.68), 3) for k, v in DENVER_CORRIDORS.items()},
        "speed": {k: round(min(1.0, max(0.0, v * speed_norm)), 3) for k, v in DENVER_CORRIDORS.items()},
        "congestion": {k: round(min(1.0, v * ci), 3) for k, v in DENVER_CORRIDORS.items()},
        "mode": {k: round(v * current["car_pct"] / 100.0, 3) for k, v in DENVER_CORRIDORS.items()},
    }

    result = {
        "kpis": kpis,
        "kpi_trends": kpi_trends,
        "trends_7d": trends_7d,
        "trends_30d": trends_30d,
        "trends_ytd": trends_ytd,
        "alerts": alerts,
        "cesium_edges": cesium_edges,
        "region_alerts": region_alerts,
    }
    _DASHBOARD_CACHE[cache_key] = result
    _DASHBOARD_CACHE_TS = time.time()
    return result


def _generate_alerts(current: dict, prev: dict, stats: list[dict]) -> list[dict]:
    now_str = datetime.now().strftime("%b %d, %I:%M %p")
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%b %d, %I:%M %p")
    alerts: list[dict] = []

    ci = current["congestion_index"]
    if ci > 0.65:
        alerts.append({
            "level": "red",
            "title": f"Downtown congestion at {round(ci * 100)}%",
            "description": "Driven by peak-hour commercial traffic on I-25 and E Colfax corridors.",
            "timestamp": f"Today, {now_str.split(', ')[1] if ', ' in now_str else '09:14 AM'}",
        })

    if current["pt_pct"] < prev["pt_pct"]:
        drop = round(prev["pt_pct"] - current["pt_pct"], 1)
        alerts.append({
            "level": "orange",
            "title": f"Transit usage down {drop}% vs last week",
            "description": "Correlates with reported delays on RTD bus routes.",
            "timestamp": f"Today, 08:52 AM",
        })

    if current["avg_speed_kmh"] > prev["avg_speed_kmh"]:
        alerts.append({
            "level": "green",
            "title": "Average speed improving",
            "description": f"Network speed up to {round(current['avg_speed_kmh'], 1)} km/h from {round(prev['avg_speed_kmh'], 1)} km/h.",
            "timestamp": yesterday_str,
        })

    alerts.append({
        "level": "blue",
        "title": f"EV adoption at {FLEET_BEV_PCT}% fleet share",
        "description": "City-wide EV share from 2024 Denver GHG Inventory.",
        "timestamp": yesterday_str,
    })

    if ci > 0.55:
        alerts.append({
            "level": "yellow",
            "title": "Corridor B approaching capacity",
            "description": f"I-70 corridor at {round(ci * 100 * 0.85)}% capacity — monitor for intervention.",
            "timestamp": "2 days ago",
        })

    # Ensure we always have at least 5 alerts
    while len(alerts) < 5:
        alerts.append({
            "level": "green",
            "title": "Bike share utilization steady",
            "description": "Protected lanes in District 4 maintaining impact.",
            "timestamp": "2 days ago",
        })

    return alerts[:5]


def _generate_region_alerts(zone_id: str, zone_name: str, character: str, corridor_intensity: float) -> list[dict]:
    """Generate 3 deterministic alerts for a specific neighborhood zone."""
    rng = random.Random(int(zone_id))
    now_str = datetime.now().strftime("%b %d, %I:%M %p")

    # Per-zone congestion derived from corridor + seeded jitter
    congestion_raw = corridor_intensity * rng.uniform(0.88, 1.18)
    congestion_pct = round(min(100.0, congestion_raw * 100))

    # Congestion level thresholds
    if congestion_pct >= 75:
        cong_level, cong_sev = "red", "CRITICAL"
    elif congestion_pct >= 60:
        cong_level, cong_sev = "orange", "WARNING"
    elif congestion_pct >= 45:
        cong_level, cong_sev = "yellow", "CAUTION"
    else:
        cong_level, cong_sev = "green", "NORMAL"

    cong_trend = round(rng.uniform(-12.0, 18.0), 1)

    alert1 = {
        "level": cong_level,
        "title": f"{zone_name}: congestion at {congestion_pct}%",
        "description": f"Peak-hour vehicle load on {ZONE_PROFILES[zone_id]['corridor'].replace('_', ' ')} corridor.",
        "timestamp": f"Today, {now_str.split(', ')[1] if ', ' in now_str else '09:14 AM'}",
        "region_id": zone_id,
        "region_name": zone_name,
        "metric_type": "traffic",
        "severity_label": cong_sev,
        "trend_pct": cong_trend,
    }

    # Transit alert — seeded direction
    transit_delta = round(rng.uniform(-4.5, 4.5), 1)
    if transit_delta < 0:
        transit_level, transit_sev = "orange", "WARNING"
        transit_title = f"Transit ridership down {abs(transit_delta)}% this week"
        transit_desc = f"RTD service on routes near {zone_name} reporting delays."
    else:
        transit_level, transit_sev = "green", "NORMAL"
        transit_title = f"Transit ridership up {transit_delta}% this week"
        transit_desc = f"Increased RTD usage near {zone_name} reducing road load."

    alert2 = {
        "level": transit_level,
        "title": transit_title,
        "description": transit_desc,
        "timestamp": f"Today, 08:52 AM",
        "region_id": zone_id,
        "region_name": zone_name,
        "metric_type": "transit",
        "severity_label": transit_sev,
        "trend_pct": round(-transit_delta, 1),  # inverse: ridership up = congestion trend down
    }

    # Character-specific third alert
    character_alert_map = {
        "nightlife": {
            "level": "yellow", "metric_type": "construction", "severity_label": "CAUTION",
            "title": f"{zone_name}: late-night traffic spillover",
            "description": "Bar district activity elevating 11 PM–2 AM vehicle counts on 13th Ave.",
            "trend_pct": round(rng.uniform(2.0, 9.0), 1),
        },
        "retail": {
            "level": "orange", "metric_type": "emissions", "severity_label": "WARNING",
            "title": f"{zone_name}: delivery vehicle idling elevated",
            "description": "Commercial delivery clustering on 1st Ave increasing local emissions.",
            "trend_pct": round(rng.uniform(3.0, 11.0), 1),
        },
        "park": {
            "level": "green", "metric_type": "emissions", "severity_label": "NORMAL",
            "title": f"{zone_name}: cyclist count up {round(rng.uniform(8, 22))}% this week",
            "description": "Protected lane usage in the area reducing car trips.",
            "trend_pct": round(rng.uniform(-10.0, -2.0), 1),
        },
        "residential": {
            "level": "green", "metric_type": "traffic", "severity_label": "NORMAL",
            "title": f"{zone_name}: residential flow stable",
            "description": "Morning commute volumes within normal range for this corridor.",
            "trend_pct": round(rng.uniform(-5.0, 1.0), 1),
        },
    }
    char_data = character_alert_map.get(character, character_alert_map["residential"])
    alert3 = {
        **char_data,
        "timestamp": "Yesterday",
        "region_id": zone_id,
        "region_name": zone_name,
    }

    return [alert1, alert2, alert3]


# ---------------------------------------------------------------------------
# Simulation feed — 2 new alerts per region per tick
# ---------------------------------------------------------------------------

_FEED_TICK_TEMPLATES: dict[int, list[tuple]] = {
    1: [  # Traffic incident
        ("traffic",      "WARNING",  "orange", "{zone}: congestion spike detected",
         "Vehicle volume up {pct}% on {corridor} — above rolling 7-day average.", 8, 15),
        ("traffic",      "CAUTION",  "yellow", "{zone}: intersection delay elevated",
         "Signal wait times up {pct}% at major arterials near the district.", 3, 9),
    ],
    2: [  # Emissions / air quality
        ("emissions",    "WARNING",  "orange", "{zone}: emissions index elevated",
         "Idling vehicles and slow speeds pushing local CO\u2082e above threshold.", 5, 12),
        ("emissions",    "CAUTION",  "yellow", "{zone}: air quality advisory",
         "PM2.5 levels rising — recommend activating low-emission zone.", 4, 10),
    ],
    3: [  # Transit disruption
        ("transit",      "WARNING",  "orange", "{zone}: RTD route delay reported",
         "Bus headways 8\u201314 min behind schedule — modal shift back to car expected.", 6, 14),
        ("transit",      "INFO",     "blue",   "{zone}: transit load factor high",
         "Standing room on 3 routes; consider express service augmentation.", 0, 0),
    ],
    4: [  # Infrastructure / signal
        ("construction", "CAUTION",  "yellow", "{zone}: scheduled maintenance active",
         "Lane restrictions on {corridor} until end of shift — expect delays.", 5, 11),
        ("traffic",      "NORMAL",   "green",  "{zone}: signal retiming in effect",
         "Adaptive timing deployed — travel time reduction of ~12% observed.", -8, -4),
    ],
}


def generate_feed_alerts(tick: int) -> list[dict]:
    """Return 2 new alerts per region for the given simulation tick (1-indexed)."""
    tick_key = ((tick - 1) % 4) + 1
    templates = _FEED_TICK_TEMPLATES[tick_key]
    now_str = datetime.now().strftime("%I:%M %p")
    result = []

    for zone_id, zone_info in ZONE_PROFILES.items():
        rng = random.Random(int(zone_id) * 1000 + tick)
        corridor = zone_info["corridor"].replace("_", " ")
        zone_alerts = []
        for (metric_type, severity_label, level, title_tpl, desc_tpl, trend_lo, trend_hi) in templates:
            lo, hi = sorted([abs(trend_lo), abs(trend_hi)])
            pct = rng.randint(lo, hi) if hi != 0 else 0
            trend_pct: float | None = round(rng.uniform(trend_lo, trend_hi), 1) if (trend_lo != 0 or trend_hi != 0) else None
            zone_alerts.append({
                "level": level,
                "title": title_tpl.format(zone=zone_info["name"], pct=pct, corridor=corridor),
                "description": desc_tpl.format(zone=zone_info["name"], pct=pct, corridor=corridor),
                "timestamp": now_str,
                "region_id": zone_id,
                "region_name": zone_info["name"],
                "metric_type": metric_type,
                "severity_label": severity_label,
                "trend_pct": trend_pct,
            })
        levels = [a["level"] for a in zone_alerts]
        summary = next((lv for lv in ("red", "orange", "yellow", "blue", "green") if lv in levels), "green")
        result.append({
            "region_id": zone_id,
            "region_name": zone_info["name"],
            "summary_level": summary,
            "alerts": zone_alerts,
        })
    return result


def _generate_synthetic_stats(n: int) -> list[dict]:
    """Generate synthetic daily stats when GPS data is unavailable."""
    rng = random.Random(42)
    base_date = date.today() - timedelta(days=n)
    records = []
    speed = 31.2   # → ci ≈ 0.376, matching TomTom 2025 Denver baseline (37.6%)
    for i in range(n):
        speed += rng.uniform(-1.5, 1.5)
        speed = max(22.0, min(48.0, speed))
        ci = round(max(0.0, min(1.0, 1 - speed / 50.0)), 4)
        ghg = round(DAILY_GHG_BASE_TCO2E * (1 + (ci - 0.376) * 0.12), 1)
        pt = round(30.0 + rng.uniform(-3, 3), 2)
        car = round(100.0 - pt - 15.0 - 10.0, 2)
        car = max(20.0, min(65.0, car))
        pt = round(100.0 - car - 15.0 - 10.0, 2)
        records.append({
            "date": (base_date + timedelta(days=i)).isoformat(),
            "avg_speed_kmh": round(speed, 1),
            "congestion_index": ci,
            "bus_count": rng.randint(280, 350),
            "total_distance_km": round(rng.uniform(4000, 5500), 1),
            "ghg_tco2e": ghg,
            "pt_pct": pt,
            "car_pct": car,
            "bike_pct": 15.0,
            "walk_pct": 10.0,
        })
    return records
