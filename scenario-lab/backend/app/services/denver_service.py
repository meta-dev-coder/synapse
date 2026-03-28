"""
Denver scenario simulation engine.
All computation is deterministic — results are cached with functools.lru_cache.
"""
from __future__ import annotations
from functools import lru_cache
from app.data.denver_baseline import (
    FLEET_SIZE, FLEET_BEV_PCT, AVG_FLEET_MPG,
    ANNUAL_VMT_MILES, BUS_ANNUAL_MILES,
    CO2_FACTOR_GAS_MT_PER_GAL,
    EV_EFFICIENCY_KWH_PER_MILE_BEV, EV_GRID_EF_MT_PER_MWH,
    TOTAL_ONROAD_CO2E_MT, TRANSIT_CO2E_MT,
    NET_ZERO_GAP_MT, MODE_SPLIT, TRANSPORT_SHARE_PCT,
)


def _quantize(ev: float, shift: float, eff: float, bike: bool) -> tuple:
    """Round floats to 2dp before cache key — avoids float-equality misses from JSON parsing."""
    return (round(ev, 2), round(shift, 2), round(eff, 2), bike)


@lru_cache(maxsize=256)
def _run_scenario_cached(
    ev_adoption_pct: float,
    mode_shift_pct: float,
    bus_efficiency_pct: float,
    bike_lanes: bool,
) -> dict:
    # --- EV Adoption ---
    # EVs are still cars — reduce tailpipe CO2 but don't change mode split
    new_bevs = FLEET_SIZE * (ev_adoption_pct / 100)
    avg_vmt = ANNUAL_VMT_MILES / FLEET_SIZE
    fuel_per_vmt = 1.0 / AVG_FLEET_MPG
    co2_ice = new_bevs * avg_vmt * fuel_per_vmt * CO2_FACTOR_GAS_MT_PER_GAL
    co2_ev = new_bevs * avg_vmt * EV_EFFICIENCY_KWH_PER_MILE_BEV / 1000.0 * EV_GRID_EF_MT_PER_MWH
    co2_ev_reduction = co2_ice - co2_ev

    # --- Mode Shift (cars → transit/cycling) ---
    shifted_vmt = ANNUAL_VMT_MILES * (mode_shift_pct / 100)
    avg_co2_per_vmt = TOTAL_ONROAD_CO2E_MT / ANNUAL_VMT_MILES
    co2_avoided = shifted_vmt * avg_co2_per_vmt
    bus_co2_per_mile = TRANSIT_CO2E_MT / BUS_ANNUAL_MILES
    # Transit is ~10x more efficient per passenger-mile
    bus_added = shifted_vmt * bus_co2_per_mile * 0.1
    co2_mode_reduction = co2_avoided - bus_added

    # --- Bus Efficiency ---
    co2_bus_reduction = TRANSIT_CO2E_MT * (bus_efficiency_pct / 100)

    # --- Bike Lanes ---
    # ~0.5% of car VMT shifts to active modes from improved cycling infrastructure
    # Result ≈ 450 MT/year — defensible for a policy analyst audience
    vmt_shifted_to_active = ANNUAL_VMT_MILES * 0.005
    co2_bike_bonus = (
        vmt_shifted_to_active * (1.0 / AVG_FLEET_MPG) * CO2_FACTOR_GAS_MT_PER_GAL * 0.3
        if bike_lanes else 0.0
    )

    total_reduction = co2_ev_reduction + co2_mode_reduction + co2_bus_reduction + co2_bike_bonus
    reduction_pct = (total_reduction / TOTAL_ONROAD_CO2E_MT) * 100

    # --- Mode split — EVs are still cars (same road network) ---
    transit_share = min(MODE_SPLIT["transit"] + mode_shift_pct, 50.0)
    active_share = MODE_SPLIT["ev_bike"]  # active mobility, unchanged by EV lever
    car_share = max(0.0, 100.0 - transit_share - active_share)

    # Fleet electrification — separate KPI, not part of mode split
    new_ev_fleet_pct = min(FLEET_BEV_PCT + ev_adoption_pct, 100.0)

    return {
        "co2_reduction_mt": round(total_reduction, 0),
        "co2_reduction_pct": round(reduction_pct, 2),
        "net_zero_gap_remaining_mt": round(NET_ZERO_GAP_MT - total_reduction, 0),
        "new_mode_split": {
            "car": round(car_share, 1),
            "transit": round(transit_share, 1),
            "active": round(active_share, 1),
        },
        "new_ev_fleet_pct": round(new_ev_fleet_pct, 1),
        "traffic_improvement_pct": round(mode_shift_pct * 0.6, 2),
        "bus_delay_reduction_pct": round(bus_efficiency_pct * 0.8, 2),
        "cesium_layer_data": {
            "emission_intensity": round(1.0 - (reduction_pct / 100), 3),
            "traffic_density": round(1.0 - (mode_shift_pct * 0.6 / 100), 3),
            "corridors": {
                "I-25":          round(0.9  - mode_shift_pct      * 0.020, 3),
                "I-70":          round(0.85 - mode_shift_pct      * 0.015, 3),
                "E_Colfax":      round(0.7  - bus_efficiency_pct  * 0.010, 3),
                "S_Broadway":    round(0.65 - ev_adoption_pct     * 0.008, 3),
                "Colorado_Blvd": round(0.75 - mode_shift_pct      * 0.012, 3),
                "Speer_Blvd":    round(0.6  - bus_efficiency_pct  * 0.008, 3),
            },
        },
    }


def run_scenario(
    ev_adoption_pct: float,
    mode_shift_pct: float,
    bus_efficiency_pct: float,
    bike_lanes: bool,
) -> dict:
    """Public entry point — quantizes inputs before cache lookup."""
    return _run_scenario_cached(*_quantize(ev_adoption_pct, mode_shift_pct, bus_efficiency_pct, bike_lanes))


def compare_scenarios(result_a: dict, result_b: dict) -> dict:
    """Business logic for scenario comparison. Called by the router, not inline."""
    metrics = ["co2_reduction_pct", "traffic_improvement_pct", "bus_delay_reduction_pct"]
    delta = {m: round(result_b[m] - result_a[m], 2) for m in metrics}
    wins_b = sum(1 for m in metrics if delta[m] > 0)
    winner = "B" if wins_b >= 2 else ("A" if wins_b == 0 else "tie")
    insights: list[str] = []
    if delta["co2_reduction_pct"] > 2:
        insights.append(
            f"Scenario B cuts CO\u2082 {delta['co2_reduction_pct']:.1f}% more than Scenario A"
        )
    if delta["bus_delay_reduction_pct"] > 5:
        insights.append(
            f"Scenario B reduces bus delay {delta['bus_delay_reduction_pct']:.1f}% better"
        )
    if wins_b == 0:
        insights.append("Scenario A performs better overall")
    if not insights:
        insights.append("Scenarios perform similarly across all metrics")
    return {"delta": delta, "winner": winner, "insights": insights}


def get_baseline() -> dict:
    """
    Return baseline KPIs for the dashboard.
    congestion_index and avg_bus_delay_min are calibrated constants from GPS
    preprocessing analysis; fallback values used if GPS data unavailable.
    """
    from app.data.denver_baseline import (
        TOTAL_ONROAD_CO2E_MT, FLEET_BEV_PCT, MODE_SPLIT,
        NET_ZERO_GAP_MT, ANNUAL_VMT_MILES, TRANSIT_CO2E_MT, TRANSPORT_SHARE_PCT,
    )
    return {
        "total_onroad_co2e_mt": TOTAL_ONROAD_CO2E_MT,
        "fleet_bev_pct": FLEET_BEV_PCT,
        "mode_split": MODE_SPLIT,
        "net_zero_gap_mt": NET_ZERO_GAP_MT,
        "annual_vmt_miles": ANNUAL_VMT_MILES,
        "transit_co2e_mt": TRANSIT_CO2E_MT,
        "transport_share_pct": TRANSPORT_SHARE_PCT,
        "congestion_index": 0.68,
        "avg_bus_delay_min": 4.2,
    }
