"""
Scenario 4 – Evasion Risk Service.

Models toll evasion probability and revenue leakage under varying toll levels,
enforcement detection accuracy, and patrol frequency.
"""

from __future__ import annotations

import asyncio

from app.data.baseline_data import (
    BASELINE_LANES,
    BASELINE_TOTALS,
    EVASION_ELASTICITY,
)
from app.models.schemas import (
    EvasionLaneResult,
    EvasionRequest,
    EvasionResult,
    LaneHeatmap,
)

P_EVADE_MIN = 0.005
P_EVADE_MAX = 0.40


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _make_heatmap(heatmap_values: dict[str, float]) -> LaneHeatmap:
    def g(lid: str) -> float:
        return round(heatmap_values.get(lid, 0.0), 4)
    return LaneHeatmap(
        NB_L1=g("NB-L1"), NB_L2=g("NB-L2"), NB_L3=g("NB-L3"), NB_L4=g("NB-L4"),
        SB_L1=g("SB-L1"), SB_L2=g("SB-L2"), SB_L3=g("SB-L3"), SB_L4=g("SB-L4"),
    )


async def simulate_evasion(request: EvasionRequest) -> EvasionResult:
    """
    Run the evasion risk simulation across all 8 NB/SB lanes.
    """
    toll_increase_pct = request.toll_increase_pct
    detection_acc = request.detection_accuracy
    patrol_freq = request.patrol_frequency
    step_sleep = request.simulation_duration_sec / 6

    await asyncio.sleep(step_sleep)   # Step 1: Connecting to data source
    await asyncio.sleep(step_sleep)   # Step 2: Downloading sensor & transaction data
    await asyncio.sleep(step_sleep)   # Step 3: Preprocessing data

    per_lane_results: list[EvasionLaneResult] = []
    heatmap_values: dict[str, float] = {}
    total_leakage_base = 0.0
    total_leakage_sim = 0.0
    weighted_evasion_sim = 0.0
    total_volume = 0.0

    # ── NB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("NB"):
            result = _compute_evasion_lane(
                lane_id, lane, toll_increase_pct, detection_acc, patrol_freq, heatmap_values,
            )
            per_lane_results.append(result)
            total_leakage_base += result.revenue_leakage_baseline_usd_hr
            total_leakage_sim += result.revenue_leakage_simulated_usd_hr
            weighted_evasion_sim += (result.evasion_rate_simulated_pct / 100) * lane["volume_veh_hr"]
            total_volume += lane["volume_veh_hr"]

    await asyncio.sleep(step_sleep)   # Step 4: Running simulation on NB lanes

    # ── SB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("SB"):
            result = _compute_evasion_lane(
                lane_id, lane, toll_increase_pct, detection_acc, patrol_freq, heatmap_values,
            )
            per_lane_results.append(result)
            total_leakage_base += result.revenue_leakage_baseline_usd_hr
            total_leakage_sim += result.revenue_leakage_simulated_usd_hr
            weighted_evasion_sim += (result.evasion_rate_simulated_pct / 100) * lane["volume_veh_hr"]
            total_volume += lane["volume_veh_hr"]

    await asyncio.sleep(step_sleep)   # Step 5: Running simulation on SB lanes

    evasion_rate_projected = weighted_evasion_sim / total_volume if total_volume > 0 else 0.0
    leakage_reduction_pct = (
        (total_leakage_base - total_leakage_sim) / total_leakage_base * 100.0
        if total_leakage_base > 0 else 0.0
    )

    await asyncio.sleep(step_sleep)   # Step 6: Computing aggregates and KPIs

    return EvasionResult(
        evasion_rate_projected_pct=round(evasion_rate_projected * 100, 3),
        revenue_leakage_reduction_pct=round(leakage_reduction_pct, 2),
        total_leakage_baseline_usd_hr=round(total_leakage_base, 2),
        total_leakage_simulated_usd_hr=round(total_leakage_sim, 2),
        per_lane=per_lane_results,
        cesium_heatmap=_make_heatmap(heatmap_values),
    )


def _compute_evasion_lane(
    lane_id: str,
    lane: dict,
    toll_increase_pct: float,
    detection_acc: float,
    patrol_freq: float,
    heatmap_values: dict[str, float],
) -> EvasionLaneResult:
    baseline_evasion = lane["evasion_rate_pct"] / 100.0
    volumes = lane["vehicle_volumes"]
    rates = lane["toll_rates_usd"]
    lane_volume = float(lane["volume_veh_hr"])

    # Weighted average evasion elasticity
    total_weighted = sum(EVASION_ELASTICITY[cls] * vol for cls, vol in volumes.items() if vol > 0)
    total_weight = sum(vol for vol in volumes.values() if vol > 0)
    avg_elasticity = total_weighted / total_weight if total_weight > 0 else 0.0

    pressure = 1.0 + avg_elasticity * (toll_increase_pct / 100.0)
    deterrence = 1.0 - detection_acc * 0.8
    patrol_mod = 1.0 - patrol_freq * 0.35

    p_evade = _clamp(baseline_evasion * pressure * deterrence * patrol_mod, P_EVADE_MIN, P_EVADE_MAX)

    # Average weighted toll rate
    weighted_rate = sum(
        rates.get(cls, 0.0) * vol for cls, vol in volumes.items() if vol > 0
    )
    rate_weight = sum(vol for vol in volumes.values() if vol > 0)
    avg_rate = weighted_rate / rate_weight if rate_weight > 0 else 0.0

    rev_leakage_base = lane_volume * baseline_evasion * avg_rate
    rev_leakage_sim = lane_volume * p_evade * avg_rate
    risk_scalar = _clamp(p_evade / P_EVADE_MAX, 0.0, 1.0)
    heatmap_values[lane_id] = risk_scalar

    return EvasionLaneResult(
        lane_id=lane_id,
        evasion_rate_baseline_pct=round(baseline_evasion * 100, 3),
        evasion_rate_simulated_pct=round(p_evade * 100, 3),
        revenue_leakage_baseline_usd_hr=round(rev_leakage_base, 2),
        revenue_leakage_simulated_usd_hr=round(rev_leakage_sim, 2),
        risk_scalar=round(risk_scalar, 4),
    )
