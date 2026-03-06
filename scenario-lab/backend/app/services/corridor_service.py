"""
Scenario 2 – Corridor Disruption Service.

Models lane closures and capacity reductions using the Bureau of Public Roads
(BPR) travel-time function. Redistributes traffic from closed lanes to open
lanes and calculates queue lengths and throughput loss.
"""

from __future__ import annotations

import asyncio

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
    if capacity <= 0:
        return t_free * 10.0
    ratio = volume / capacity
    return t_free * (1.0 + 0.15 * ratio ** 4)


def _make_heatmap(heatmap_values: dict[str, float]) -> LaneHeatmap:
    def g(lid: str) -> float:
        return round(heatmap_values.get(lid, 0.0), 4)
    return LaneHeatmap(
        NB_L1=g("NB-L1"), NB_L2=g("NB-L2"), NB_L3=g("NB-L3"), NB_L4=g("NB-L4"),
        SB_L1=g("SB-L1"), SB_L2=g("SB-L2"), SB_L3=g("SB-L3"), SB_L4=g("SB-L4"),
    )


async def simulate_corridor(request: CorridorRequest) -> CorridorResult:
    """
    Run the corridor disruption simulation across all 8 NB/SB lanes.

    Algorithm:
    1. Compute effective capacity per lane (closed → 0, others reduced by params).
    2. Redistribute closed-lane volume to open lanes proportionally.
    3. Apply BPR to compute simulated travel times.
    4. Compute queues where v > c_eff.
    5. Aggregate travel-time delta and throughput loss.
    """
    closed = set(request.closed_lanes)
    cap_reduction = request.capacity_reduction_pct
    weather = request.weather_factor
    step_sleep = request.simulation_duration_sec / 6

    await asyncio.sleep(step_sleep)   # Step 1: Connecting to data source
    await asyncio.sleep(step_sleep)   # Step 2: Downloading sensor & transaction data
    await asyncio.sleep(step_sleep)   # Step 3: Preprocessing data

    # Effective capacities
    c_eff: dict[str, float] = {}
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id in closed:
            c_eff[lane_id] = 0.0
        else:
            c_eff[lane_id] = lane["capacity_veh_hr"] * (1.0 - cap_reduction / 100.0) * weather

    # Volume redistribution
    baseline_volumes: dict[str, float] = {
        lid: float(lane["volume_veh_hr"]) for lid, lane in BASELINE_LANES.items()
    }
    displaced_volume = sum(baseline_volumes[lid] for lid in closed)
    open_lanes = [lid for lid in BASELINE_LANES if lid not in closed]
    total_open_capacity = sum(c_eff[lid] for lid in open_lanes)

    sim_volumes: dict[str, float] = {}
    for lane_id in BASELINE_LANES:
        if lane_id in closed:
            sim_volumes[lane_id] = 0.0
        else:
            share = (
                c_eff[lane_id] / total_open_capacity
                if total_open_capacity > 0
                else 1.0 / max(len(open_lanes), 1)
            )
            sim_volumes[lane_id] = baseline_volumes[lane_id] + displaced_volume * share

    per_lane_results: list[CorridorLaneResult] = []
    heatmap_values: dict[str, float] = {}
    weighted_tt_delta_num = 0.0
    weighted_tt_delta_den = 0.0
    total_queue_m = 0.0
    total_sim_throughput = 0.0
    total_baseline_throughput = float(BASELINE_TOTALS["total_volume_veh_hr"])

    # ── NB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("NB"):
            result = _compute_corridor_lane(
                lane_id, lane, sim_volumes, c_eff, closed,
                heatmap_values,
            )
            per_lane_results.append(result)
            weighted_tt_delta_num += result.travel_time_delta_pct * sim_volumes[lane_id]
            weighted_tt_delta_den += sim_volumes[lane_id]
            total_queue_m += result.queue_m
            if not result.is_closed:
                total_sim_throughput += min(sim_volumes[lane_id], c_eff[lane_id])

    await asyncio.sleep(step_sleep)   # Step 4: Running simulation on NB lanes

    # ── SB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("SB"):
            result = _compute_corridor_lane(
                lane_id, lane, sim_volumes, c_eff, closed,
                heatmap_values,
            )
            per_lane_results.append(result)
            weighted_tt_delta_num += result.travel_time_delta_pct * sim_volumes[lane_id]
            weighted_tt_delta_den += sim_volumes[lane_id]
            total_queue_m += result.queue_m
            if not result.is_closed:
                total_sim_throughput += min(sim_volumes[lane_id], c_eff[lane_id])

    await asyncio.sleep(step_sleep)   # Step 5: Running simulation on SB lanes

    avg_tt_delta_pct = (
        weighted_tt_delta_num / weighted_tt_delta_den
        if weighted_tt_delta_den > 0 else 0.0
    )
    throughput_reduction_pct = max(
        0.0,
        (total_baseline_throughput - total_sim_throughput) / total_baseline_throughput * 100.0,
    )

    await asyncio.sleep(step_sleep)   # Step 6: Computing aggregates and KPIs

    return CorridorResult(
        travel_time_delta_pct=round(avg_tt_delta_pct, 2),
        total_queue_length_m=round(total_queue_m, 1),
        throughput_reduction_pct=round(throughput_reduction_pct, 2),
        per_lane=per_lane_results,
        cesium_heatmap=_make_heatmap(heatmap_values),
    )


def _compute_corridor_lane(
    lane_id: str,
    lane: dict,
    sim_volumes: dict[str, float],
    c_eff: dict[str, float],
    closed: set[str],
    heatmap_values: dict[str, float],
) -> CorridorLaneResult:
    t_free = lane["free_flow_travel_time_sec"]
    vol_sim = sim_volumes[lane_id]
    cap = c_eff[lane_id]
    is_closed = lane_id in closed

    if is_closed:
        t_sim = 0.0
        tt_delta_pct = 0.0
        queue_veh = 0.0
        queue_m = 0.0
        congestion_scalar = 0.0
    else:
        t_sim = _bpr_travel_time(t_free, vol_sim, cap)
        tt_delta_pct = (t_sim - t_free) / t_free * 100.0
        queue_veh = max(0.0, vol_sim - cap)
        queue_m = queue_veh * 6.5
        congestion_scalar = _clamp(vol_sim / cap if cap > 0 else 1.0, 0.0, 1.0)

    heatmap_values[lane_id] = congestion_scalar

    return CorridorLaneResult(
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
