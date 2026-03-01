"""
Scenario 4 – Evasion Risk Service.

Models toll evasion probability and revenue leakage under varying toll levels,
enforcement detection accuracy, and patrol frequency.
"""

from __future__ import annotations

import math
from typing import Any

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

# Evasion probability clamp bounds
P_EVADE_MIN = 0.005
P_EVADE_MAX = 0.40


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def simulate_evasion(request: EvasionRequest) -> EvasionResult:
    """
    Run the evasion risk simulation.

    For each lane:
    1. Compute the evasion pressure as the weighted-average elasticity response
       to the toll increase percentage across all vehicle classes with volume > 0.
    2. Compute a deterrence factor from detection accuracy.
    3. Apply a patrol modifier.
    4. Multiply baseline evasion rate by these factors and clamp.
    5. Derive revenue leakage (baseline and simulated) and risk_scalar.
    """
    toll_increase_pct = request.toll_increase_pct
    detection_acc = request.detection_accuracy
    patrol_freq = request.patrol_frequency

    per_lane_results: list[EvasionLaneResult] = []
    heatmap_values: dict[str, float] = {}

    total_leakage_base = 0.0
    total_leakage_sim = 0.0
    weighted_evasion_sim = 0.0
    total_volume = 0.0

    for lane_id, lane in BASELINE_LANES.items():
        baseline_evasion = lane["evasion_rate_pct"] / 100.0
        volumes = lane["vehicle_volumes"]
        rates = lane["toll_rates_usd"]
        lane_volume = float(lane["volume_veh_hr"])

        # ------------------------------------------------------------------
        # Step 1 – Evasion pressure: weighted average across vehicle classes
        # ------------------------------------------------------------------
        total_weighted_elasticity = 0.0
        total_weight = 0.0
        for cls in ("car", "truck", "bus", "van"):
            vol = volumes.get(cls, 0.0)
            if vol > 0:
                total_weighted_elasticity += EVASION_ELASTICITY[cls] * vol
                total_weight += vol

        avg_elasticity = (
            total_weighted_elasticity / total_weight if total_weight > 0 else 0.0
        )
        pressure = 1.0 + avg_elasticity * (toll_increase_pct / 100.0)

        # ------------------------------------------------------------------
        # Step 2 – Deterrence from detection accuracy
        # ------------------------------------------------------------------
        deterrence = 1.0 - detection_acc * 0.8

        # ------------------------------------------------------------------
        # Step 3 – Patrol modifier
        # ------------------------------------------------------------------
        patrol_mod = 1.0 - patrol_freq * 0.35

        # ------------------------------------------------------------------
        # Step 4 – Simulated evasion probability
        # ------------------------------------------------------------------
        p_evade = baseline_evasion * pressure * deterrence * patrol_mod
        p_evade = _clamp(p_evade, P_EVADE_MIN, P_EVADE_MAX)

        # ------------------------------------------------------------------
        # Step 5 – Revenue leakage
        # ------------------------------------------------------------------
        # Average toll rate for this lane (weighted by volume across classes)
        weighted_rate = 0.0
        rate_weight = 0.0
        for cls in ("car", "truck", "bus", "van"):
            vol = volumes.get(cls, 0.0)
            rate = rates.get(cls, 0.0)
            if vol > 0:
                weighted_rate += rate * vol
                rate_weight += vol
        avg_rate = weighted_rate / rate_weight if rate_weight > 0 else 0.0

        rev_leakage_base = lane_volume * baseline_evasion * avg_rate
        rev_leakage_sim = lane_volume * p_evade * avg_rate

        # risk_scalar normalized to P_EVADE_MAX
        risk_scalar = _clamp(p_evade / P_EVADE_MAX, 0.0, 1.0)

        heatmap_values[lane_id] = risk_scalar
        total_leakage_base += rev_leakage_base
        total_leakage_sim += rev_leakage_sim
        weighted_evasion_sim += p_evade * lane_volume
        total_volume += lane_volume

        per_lane_results.append(
            EvasionLaneResult(
                lane_id=lane_id,
                evasion_rate_baseline_pct=round(baseline_evasion * 100, 3),
                evasion_rate_simulated_pct=round(p_evade * 100, 3),
                revenue_leakage_baseline_usd_hr=round(rev_leakage_base, 2),
                revenue_leakage_simulated_usd_hr=round(rev_leakage_sim, 2),
                risk_scalar=round(risk_scalar, 4),
            )
        )

    # Corridor-level aggregates
    evasion_rate_projected = (
        weighted_evasion_sim / total_volume if total_volume > 0 else 0.0
    )
    leakage_reduction_pct = (
        (total_leakage_base - total_leakage_sim) / total_leakage_base * 100.0
        if total_leakage_base > 0
        else 0.0
    )

    return EvasionResult(
        evasion_rate_projected_pct=round(evasion_rate_projected * 100, 3),
        revenue_leakage_reduction_pct=round(leakage_reduction_pct, 2),
        total_leakage_baseline_usd_hr=round(total_leakage_base, 2),
        total_leakage_simulated_usd_hr=round(total_leakage_sim, 2),
        per_lane=per_lane_results,
        cesium_heatmap=LaneHeatmap(
            L1=round(heatmap_values.get("L1", 0.0), 4),
            L2=round(heatmap_values.get("L2", 0.0), 4),
            L3=round(heatmap_values.get("L3", 0.0), 4),
            L4=round(heatmap_values.get("L4", 0.0), 4),
        ),
    )
