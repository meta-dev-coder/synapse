"""
Scenario 1 – Toll Rate Simulation Service.

Computes the impact of changing toll rates on revenue, traffic volume,
evasion probability, and lane diversion.
"""

from __future__ import annotations

import math
from typing import Any

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


def simulate_toll(request: TollRequest) -> TollResult:
    """
    Run the toll rate simulation scenario.

    For each lane the service:
    1. Applies demand elasticity to compute simulated volumes per vehicle class.
    2. Calculates simulated revenue, optionally discounting EV car share.
    3. Derives projected evasion rate factoring in average rate delta and
       enforcement intensity.
    4. Computes a logistic diversion probability based on average rate increase.
    5. Returns per-lane density scalars suitable for Cesium heatmap rendering.
    """
    new_rates = request.vehicle_rates
    peak_mult = request.peak_multiplier
    ev_exempt = request.ev_exemption
    enforcement = request.enforcement_intensity

    per_lane_results: list[TollLaneResult] = []
    total_revenue_sim = 0.0
    total_revenue_base = 0.0

    # Weighted accumulators for corridor-level evasion and diversion
    weighted_evasion = 0.0
    weighted_diversion = 0.0
    total_base_volume = 0.0

    # For heatmap
    heatmap_values: dict[str, float] = {}

    for lane_id, lane in BASELINE_LANES.items():
        baseline_rates: dict[str, float] = lane["toll_rates_usd"]
        baseline_volumes: dict[str, float] = lane["vehicle_volumes"]
        lane_capacity: float = lane["capacity_veh_hr"]
        baseline_evasion: float = lane["evasion_rate_pct"] / 100.0
        ev_fraction: float = lane["ev_fraction_pct"] / 100.0
        lane_baseline_revenue: float = lane["revenue_usd_hr"]

        # ------------------------------------------------------------------
        # Step 1 – Apply elasticity to compute simulated volumes per class
        # ------------------------------------------------------------------
        volume_simulated: dict[str, float] = {}
        rate_deltas: list[float] = []  # (new - old) / old for applicable classes

        for cls in ("car", "truck", "bus", "van"):
            base_vol = baseline_volumes.get(cls, 0.0)
            base_rate = baseline_rates.get(cls, 0.0)
            new_rate = new_rates.get(cls, base_rate)

            if base_rate > 0 and base_vol > 0:
                rate_change_pct = (new_rate - base_rate) / base_rate
                delta_volume_pct = VEHICLE_ELASTICITY[cls] * rate_change_pct
                volume_simulated[cls] = max(0.0, base_vol * (1.0 + delta_volume_pct))
                rate_deltas.append(rate_change_pct)
            else:
                # Zero baseline rate or zero volume: no elasticity effect
                volume_simulated[cls] = base_vol

        avg_rate_delta_pct = (
            sum(rate_deltas) / len(rate_deltas) if rate_deltas else 0.0
        )

        # ------------------------------------------------------------------
        # Step 2 – Compute simulated revenue
        # ------------------------------------------------------------------
        lane_revenue_sim = 0.0
        for cls in ("car", "truck", "bus", "van"):
            rate = new_rates.get(cls, baseline_rates.get(cls, 0.0))
            vol = volume_simulated[cls]

            # EV exemption: subtract ev_fraction of car volume from revenue
            if ev_exempt and cls == "car":
                vol = vol * (1.0 - ev_fraction)

            lane_revenue_sim += rate * vol

        lane_revenue_sim *= peak_mult

        # ------------------------------------------------------------------
        # Step 3 – Project evasion rate
        # ------------------------------------------------------------------
        evasion_rate = (
            baseline_evasion
            * (1.0 + 0.3 * avg_rate_delta_pct)
            * (1.0 - enforcement * 0.6)
        )
        evasion_rate = _clamp(evasion_rate, 0.001, 0.50)

        # ------------------------------------------------------------------
        # Step 4 – Diversion probability (logistic, threshold $2 avg increase)
        # ------------------------------------------------------------------
        # avg_rate_delta is the average absolute dollar change across classes
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

        # ------------------------------------------------------------------
        # Step 5 – Density scalar for heatmap
        # ------------------------------------------------------------------
        total_sim_volume = sum(volume_simulated.values())
        density_scalar = _clamp(total_sim_volume / lane_capacity, 0.0, 1.0)
        heatmap_values[lane_id] = density_scalar

        # Accumulate corridor totals (weighted by baseline volume)
        lane_base_vol = lane["volume_veh_hr"]
        weighted_evasion += evasion_rate * lane_base_vol
        weighted_diversion += diversion_prob * lane_base_vol
        total_base_volume += lane_base_vol
        total_revenue_sim += lane_revenue_sim
        total_revenue_base += lane_baseline_revenue

        per_lane_results.append(
            TollLaneResult(
                lane_id=lane_id,
                revenue_simulated_usd_hr=round(lane_revenue_sim, 2),
                revenue_baseline_usd_hr=round(lane_baseline_revenue, 2),
                volume_simulated_veh_hr=round(total_sim_volume, 1),
                volume_baseline_veh_hr=float(lane_base_vol),
                evasion_rate_pct=round(evasion_rate * 100, 3),
                diversion_probability=round(diversion_prob, 4),
                density_scalar=round(density_scalar, 4),
                vehicle_volumes_simulated={
                    cls: round(v, 1) for cls, v in volume_simulated.items()
                },
            )
        )

    # Corridor-level aggregates
    corridor_evasion = (
        weighted_evasion / total_base_volume if total_base_volume > 0 else 0.0
    )
    corridor_diversion = (
        weighted_diversion / total_base_volume if total_base_volume > 0 else 0.0
    )
    revenue_delta_pct = (
        (total_revenue_sim - total_revenue_base) / total_revenue_base * 100.0
        if total_revenue_base > 0
        else 0.0
    )

    return TollResult(
        revenue_delta_pct=round(revenue_delta_pct, 2),
        total_revenue_simulated_usd_hr=round(total_revenue_sim, 2),
        total_revenue_baseline_usd_hr=round(total_revenue_base, 2),
        evasion_rate_projected_pct=round(corridor_evasion * 100, 3),
        diversion_probability=round(corridor_diversion, 4),
        per_lane=per_lane_results,
        cesium_heatmap=LaneHeatmap(
            L1=round(heatmap_values.get("L1", 0.0), 4),
            L2=round(heatmap_values.get("L2", 0.0), 4),
            L3=round(heatmap_values.get("L3", 0.0), 4),
            L4=round(heatmap_values.get("L4", 0.0), 4),
        ),
    )
