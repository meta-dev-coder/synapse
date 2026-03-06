"""
Scenario 1 – Toll Rate Simulation Service.

Computes the impact of changing toll rates on revenue, traffic volume,
evasion probability, and lane diversion.
"""

from __future__ import annotations

import asyncio
import math

from app.data.baseline_data import (
    BASELINE_LANES,
    BASELINE_TOTALS,
    VEHICLE_ELASTICITY,
)
from app.models.schemas import (
    LaneHeatmap,
    TollLaneResult,
    TollRequest,
    TollResult,
)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _make_heatmap(heatmap_values: dict[str, float]) -> LaneHeatmap:
    def g(lid: str) -> float:
        return round(heatmap_values.get(lid, 0.0), 4)
    return LaneHeatmap(
        NB_L1=g("NB-L1"), NB_L2=g("NB-L2"), NB_L3=g("NB-L3"), NB_L4=g("NB-L4"),
        SB_L1=g("SB-L1"), SB_L2=g("SB-L2"), SB_L3=g("SB-L3"), SB_L4=g("SB-L4"),
    )


def _compute_lane(
    lane_id: str,
    lane: dict,
    new_rates: dict[str, float],
    peak_mult: float,
    ev_exempt: bool,
    enforcement: float,
    heatmap_values: dict[str, float],
) -> TollLaneResult:
    """Compute toll simulation for one lane and update heatmap dict."""
    baseline_rates: dict[str, float] = lane["toll_rates_usd"]
    baseline_volumes: dict[str, float] = lane["vehicle_volumes"]
    lane_capacity: float = lane["capacity_veh_hr"]
    baseline_evasion: float = lane["evasion_rate_pct"] / 100.0
    ev_fraction: float = lane["ev_fraction_pct"] / 100.0
    lane_baseline_revenue: float = lane["revenue_usd_hr"]

    volume_simulated: dict[str, float] = {}
    rate_deltas: list[float] = []

    for cls in ("car", "truck", "bus", "van"):
        base_vol = baseline_volumes.get(cls, 0.0)
        base_rate = baseline_rates.get(cls, 0.0)
        new_rate = new_rates.get(cls, base_rate)
        if base_rate > 0 and base_vol > 0:
            rate_change_pct = (new_rate - base_rate) / base_rate
            volume_simulated[cls] = max(0.0, base_vol * (1.0 + VEHICLE_ELASTICITY[cls] * rate_change_pct))
            rate_deltas.append(rate_change_pct)
        else:
            volume_simulated[cls] = base_vol

    avg_rate_delta_pct = sum(rate_deltas) / len(rate_deltas) if rate_deltas else 0.0

    lane_revenue_sim = 0.0
    for cls in ("car", "truck", "bus", "van"):
        rate = new_rates.get(cls, baseline_rates.get(cls, 0.0))
        vol = volume_simulated[cls]
        if ev_exempt and cls == "car":
            vol = vol * (1.0 - ev_fraction)
        lane_revenue_sim += rate * vol
    lane_revenue_sim *= peak_mult

    evasion_rate = _clamp(
        baseline_evasion * (1.0 + 0.3 * avg_rate_delta_pct) * (1.0 - enforcement * 0.6),
        0.001, 0.50,
    )

    avg_rate_delta_usd = 0.0
    count = 0
    for cls in ("car", "truck", "bus", "van"):
        base_rate = baseline_rates.get(cls, 0.0)
        new_rate = new_rates.get(cls, base_rate)
        if base_rate > 0:
            avg_rate_delta_usd += new_rate - base_rate
            count += 1
    if count > 0:
        avg_rate_delta_usd /= count
    diversion_prob = 1.0 / (1.0 + math.exp(-0.85 * (avg_rate_delta_usd - 2.0)))

    total_sim_volume = sum(volume_simulated.values())
    density_scalar = _clamp(total_sim_volume / lane_capacity, 0.0, 1.0)
    heatmap_values[lane_id] = density_scalar

    return TollLaneResult(
        lane_id=lane_id,
        revenue_simulated_usd_hr=round(lane_revenue_sim, 2),
        revenue_baseline_usd_hr=round(lane_baseline_revenue, 2),
        volume_simulated_veh_hr=round(total_sim_volume, 1),
        volume_baseline_veh_hr=float(lane["volume_veh_hr"]),
        evasion_rate_pct=round(evasion_rate * 100, 3),
        diversion_probability=round(diversion_prob, 4),
        density_scalar=round(density_scalar, 4),
        vehicle_volumes_simulated={cls: round(v, 1) for cls, v in volume_simulated.items()},
    )


async def simulate_toll(request: TollRequest) -> TollResult:
    """
    Run the toll rate simulation scenario across all 8 NB/SB lanes.

    Simulation steps (each step followed by an asyncio.sleep for demo pacing):
    1-3. Data ingestion and preprocessing
    4.   NB lanes computation
    5.   SB lanes computation
    6.   Aggregate KPI computation
    """
    new_rates = request.vehicle_rates
    peak_mult = request.peak_multiplier
    ev_exempt = request.ev_exemption
    enforcement = request.enforcement_intensity
    step_sleep = request.simulation_duration_sec / 6

    await asyncio.sleep(step_sleep)   # Step 1: Connecting to data source
    await asyncio.sleep(step_sleep)   # Step 2: Downloading sensor & transaction data
    await asyncio.sleep(step_sleep)   # Step 3: Preprocessing data

    per_lane_results: list[TollLaneResult] = []
    heatmap_values: dict[str, float] = {}

    # ── NB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("NB"):
            per_lane_results.append(
                _compute_lane(lane_id, lane, new_rates, peak_mult, ev_exempt, enforcement, heatmap_values)
            )

    await asyncio.sleep(step_sleep)   # Step 4: Running simulation on NB lanes

    # ── SB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("SB"):
            per_lane_results.append(
                _compute_lane(lane_id, lane, new_rates, peak_mult, ev_exempt, enforcement, heatmap_values)
            )

    await asyncio.sleep(step_sleep)   # Step 5: Running simulation on SB lanes

    # ── Aggregates ────────────────────────────────────────────────────────────
    total_revenue_sim = sum(r.revenue_simulated_usd_hr for r in per_lane_results)
    total_revenue_base = sum(r.revenue_baseline_usd_hr for r in per_lane_results)

    total_base_volume = sum(BASELINE_LANES[lid]["volume_veh_hr"] for lid in BASELINE_LANES)
    weighted_evasion = sum(
        (r.evasion_rate_pct / 100) * BASELINE_LANES[r.lane_id]["volume_veh_hr"]
        for r in per_lane_results
    )
    weighted_diversion = sum(
        r.diversion_probability * BASELINE_LANES[r.lane_id]["volume_veh_hr"]
        for r in per_lane_results
    )

    corridor_evasion = weighted_evasion / total_base_volume if total_base_volume > 0 else 0.0
    corridor_diversion = weighted_diversion / total_base_volume if total_base_volume > 0 else 0.0
    revenue_delta_pct = (
        (total_revenue_sim - total_revenue_base) / total_revenue_base * 100.0
        if total_revenue_base > 0 else 0.0
    )

    await asyncio.sleep(step_sleep)   # Step 6: Computing aggregates and KPIs

    return TollResult(
        revenue_delta_pct=round(revenue_delta_pct, 2),
        total_revenue_simulated_usd_hr=round(total_revenue_sim, 2),
        total_revenue_baseline_usd_hr=round(total_revenue_base, 2),
        evasion_rate_projected_pct=round(corridor_evasion * 100, 3),
        diversion_probability=round(corridor_diversion, 4),
        per_lane=per_lane_results,
        cesium_heatmap=_make_heatmap(heatmap_values),
    )
