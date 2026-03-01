"""
Scenario 2 – Corridor Disruption Service.

Models lane closures and capacity reductions using the Bureau of Public Roads
(BPR) travel-time function.  Redistributes traffic from closed lanes to open
lanes and calculates queue lengths and throughput loss.
"""

from __future__ import annotations

import math
from typing import Any

from app.data.baseline_data import BASELINE_LANES, BASELINE_TOTALS
from app.models.schemas import (
    CorridorLaneResult,
    CorridorRequest,
    CorridorResult,
    LaneHeatmap,
)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _bpr_travel_time(t_free: float, volume: float, capacity: float) -> float:
    """
    Bureau of Public Roads (BPR) travel-time function:
        t(v) = t_free * (1 + 0.15 * (v / c) ^ 4)

    Returns t_free when capacity is zero (closed lane handled separately).
    """
    if capacity <= 0:
        # Closed / zero-capacity lane: return a large sentinel travel time
        return t_free * 10.0
    ratio = volume / capacity
    return t_free * (1.0 + 0.15 * ratio ** 4)


def simulate_corridor(request: CorridorRequest) -> CorridorResult:
    """
    Run the corridor disruption simulation.

    Algorithm:
    1. Compute effective capacity for each lane after applying capacity_reduction_pct
       and weather_factor.
    2. Closed lanes get c_eff = 0; their volume is redistributed proportionally
       to open lanes based on each open lane's remaining capacity share.
    3. Apply BPR to compute simulated travel times.
    4. Compute queue if v > c_eff.
    5. Aggregate weighted-average travel-time delta and total throughput loss.
    """
    closed = set(request.closed_lanes)
    cap_reduction = request.capacity_reduction_pct
    weather = request.weather_factor

    # ------------------------------------------------------------------
    # Step 1 – Effective capacities
    # ------------------------------------------------------------------
    c_eff: dict[str, float] = {}
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id in closed:
            c_eff[lane_id] = 0.0
        else:
            c_eff[lane_id] = (
                lane["capacity_veh_hr"]
                * (1.0 - cap_reduction / 100.0)
                * weather
            )

    # ------------------------------------------------------------------
    # Step 2 – Volume redistribution
    # ------------------------------------------------------------------
    # Baseline volumes for open and closed lanes
    baseline_volumes: dict[str, float] = {
        lid: lane["volume_veh_hr"] for lid, lane in BASELINE_LANES.items()
    }

    # Total volume that needs to be absorbed by open lanes
    displaced_volume = sum(
        baseline_volumes[lid] for lid in closed
    )

    # Open lanes and their spare capacity pool
    open_lanes = [lid for lid in BASELINE_LANES if lid not in closed]
    total_open_capacity = sum(c_eff[lid] for lid in open_lanes)

    # Simulated volumes: start from baseline for open lanes, then add displaced
    sim_volumes: dict[str, float] = {}
    for lane_id in BASELINE_LANES:
        if lane_id in closed:
            sim_volumes[lane_id] = 0.0
        else:
            # Proportional absorption of displaced traffic
            if total_open_capacity > 0:
                share = c_eff[lane_id] / total_open_capacity
            else:
                share = 1.0 / max(len(open_lanes), 1)
            sim_volumes[lane_id] = baseline_volumes[lane_id] + displaced_volume * share

    # ------------------------------------------------------------------
    # Step 3-4 – Travel time and queue per lane
    # ------------------------------------------------------------------
    per_lane_results: list[CorridorLaneResult] = []
    heatmap_values: dict[str, float] = {}

    weighted_tt_delta_num = 0.0
    weighted_tt_delta_den = 0.0
    total_queue_m = 0.0
    total_sim_throughput = 0.0
    total_baseline_throughput = float(BASELINE_TOTALS["total_volume_veh_hr"])

    for lane_id, lane in BASELINE_LANES.items():
        t_free = lane["free_flow_travel_time_sec"]
        vol_sim = sim_volumes[lane_id]
        cap = c_eff[lane_id]
        is_closed = lane_id in closed

        if is_closed:
            # Closed lane: no travel, no queue (no vehicles use it)
            t_sim = 0.0
            tt_delta_pct = 0.0
            queue_veh = 0.0
            queue_m = 0.0
            congestion_scalar = 0.0
        else:
            t_sim = _bpr_travel_time(t_free, vol_sim, cap)
            tt_delta_pct = (t_sim - t_free) / t_free * 100.0

            # Queue forms when demand exceeds capacity
            queue_veh = max(0.0, vol_sim - cap)
            queue_m = queue_veh * 6.5  # 6.5 m average vehicle spacing

            congestion_scalar = _clamp(vol_sim / cap if cap > 0 else 1.0, 0.0, 1.0)

            # Weight travel-time delta by simulated volume
            weighted_tt_delta_num += tt_delta_pct * vol_sim
            weighted_tt_delta_den += vol_sim

        heatmap_values[lane_id] = congestion_scalar
        total_queue_m += queue_m
        total_sim_throughput += min(vol_sim, cap) if not is_closed else 0.0

        per_lane_results.append(
            CorridorLaneResult(
                lane_id=lane_id,
                is_closed=is_closed,
                volume_simulated_veh_hr=round(vol_sim, 1),
                capacity_effective_veh_hr=round(cap, 1),
                travel_time_sec=round(t_sim, 1),
                travel_time_delta_pct=round(tt_delta_pct, 2),
                queue_veh=round(queue_veh, 1),
                queue_m=round(queue_m, 1),
                congestion_scalar=round(congestion_scalar, 4),
            )
        )

    # Corridor-level aggregates
    avg_tt_delta_pct = (
        weighted_tt_delta_num / weighted_tt_delta_den
        if weighted_tt_delta_den > 0
        else 0.0
    )
    throughput_reduction_pct = max(
        0.0,
        (total_baseline_throughput - total_sim_throughput)
        / total_baseline_throughput
        * 100.0,
    )

    return CorridorResult(
        travel_time_delta_pct=round(avg_tt_delta_pct, 2),
        total_queue_length_m=round(total_queue_m, 1),
        throughput_reduction_pct=round(throughput_reduction_pct, 2),
        per_lane=per_lane_results,
        cesium_heatmap=LaneHeatmap(
            L1=round(heatmap_values.get("L1", 0.0), 4),
            L2=round(heatmap_values.get("L2", 0.0), 4),
            L3=round(heatmap_values.get("L3", 0.0), 4),
            L4=round(heatmap_values.get("L4", 0.0), 4),
        ),
    )
