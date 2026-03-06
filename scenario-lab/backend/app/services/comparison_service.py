"""
Scenario 5 – Scenario Comparison Service.

Runs three scenarios (baseline, A, B) in parallel using asyncio.gather and
produces a side-by-side comparison table with per-lane breakdowns and a
Cesium diff heatmap.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from app.models.schemas import (
    ComparisonColumn,
    ComparisonMetrics,
    ComparisonRequest,
    ComparisonResult,
    CesiumDiffHeatmap,
    CorridorRequest,
    EmissionRequest,
    EvasionRequest,
    LaneHeatmap,
    ScenarioSpec,
    TollRequest,
)
from app.services.corridor_service import simulate_corridor
from app.services.emission_service import simulate_emission
from app.services.evasion_service import simulate_evasion
from app.services.toll_service import simulate_toll


_LANE_IDS = (
    "NB-L1", "NB-L2", "NB-L3", "NB-L4",
    "SB-L1", "SB-L2", "SB-L3", "SB-L4",
)


def _heatmap_to_dict(heatmap: LaneHeatmap) -> dict[str, float]:
    return {
        "NB-L1": heatmap.NB_L1, "NB-L2": heatmap.NB_L2,
        "NB-L3": heatmap.NB_L3, "NB-L4": heatmap.NB_L4,
        "SB-L1": heatmap.SB_L1, "SB-L2": heatmap.SB_L2,
        "SB-L3": heatmap.SB_L3, "SB-L4": heatmap.SB_L4,
    }


async def _run_scenario(
    spec: ScenarioSpec,
    sim_duration: int,
) -> tuple[ComparisonMetrics, LaneHeatmap, list[dict[str, Any]]]:
    """
    Dispatch spec to the appropriate service and extract key metrics and
    per-lane rows for the comparison table.
    """
    stype = spec.type
    inputs = {**spec.inputs, "simulation_duration_sec": sim_duration}

    if stype == "toll":
        req = TollRequest(**inputs)
        result = await simulate_toll(req)
        metrics = ComparisonMetrics(
            scenario_type="toll",
            revenue_usd_hr=result.total_revenue_simulated_usd_hr,
            evasion_rate_pct=result.evasion_rate_projected_pct,
        )
        per_lane = [r.model_dump() for r in result.per_lane]
        heatmap = result.cesium_heatmap

    elif stype == "corridor":
        req = CorridorRequest(**inputs)
        result = await simulate_corridor(req)
        metrics = ComparisonMetrics(
            scenario_type="corridor",
            travel_time_delta_pct=result.travel_time_delta_pct,
            throughput_reduction_pct=result.throughput_reduction_pct,
        )
        per_lane = [r.model_dump() for r in result.per_lane]
        heatmap = result.cesium_heatmap

    elif stype == "emission":
        req = EmissionRequest(**inputs)
        result = await simulate_emission(req)
        metrics = ComparisonMetrics(
            scenario_type="emission",
            co2_kg_hr=result.total_co2_kg_hr,
            nox_g_hr=result.total_nox_g_hr,
        )
        per_lane = [r.model_dump() for r in result.per_lane]
        heatmap = result.cesium_heatmap

    elif stype == "evasion":
        req = EvasionRequest(**inputs)
        result = await simulate_evasion(req)
        metrics = ComparisonMetrics(
            scenario_type="evasion",
            evasion_rate_pct=result.evasion_rate_projected_pct,
        )
        per_lane = [r.model_dump() for r in result.per_lane]
        heatmap = result.cesium_heatmap

    else:
        raise ValueError(f"Unsupported scenario type: '{stype}'")

    return metrics, heatmap, per_lane


async def simulate_comparison(request: ComparisonRequest) -> ComparisonResult:
    """
    Run baseline, scenario_a, and scenario_b concurrently via asyncio.gather,
    then produce a comparison table with per-lane breakdowns and a diff heatmap.
    """
    sim_dur = request.simulation_duration_sec

    (base_metrics, base_heatmap, base_per_lane), \
    (a_metrics, a_heatmap, a_per_lane), \
    (b_metrics, b_heatmap, b_per_lane) = await asyncio.gather(
        _run_scenario(request.baseline_scenario, sim_dur),
        _run_scenario(request.scenario_a, sim_dur),
        _run_scenario(request.scenario_b, sim_dur),
    )

    # Diff heatmap: per-lane |A - B| clamped to [0, 1]
    a_vals = _heatmap_to_dict(a_heatmap)
    b_vals = _heatmap_to_dict(b_heatmap)
    diff: dict[str, float] = {
        lid: round(min(1.0, abs(a_vals[lid] - b_vals[lid])), 4)
        for lid in _LANE_IDS
    }

    return ComparisonResult(
        baseline=ComparisonColumn(
            label="Baseline",
            metrics=base_metrics,
            cesium_heatmap=base_heatmap,
            per_lane=base_per_lane,
        ),
        scenario_a=ComparisonColumn(
            label="Scenario A",
            metrics=a_metrics,
            cesium_heatmap=a_heatmap,
            per_lane=a_per_lane,
        ),
        scenario_b=ComparisonColumn(
            label="Scenario B",
            metrics=b_metrics,
            cesium_heatmap=b_heatmap,
            per_lane=b_per_lane,
        ),
        cesium_diff_heatmap=CesiumDiffHeatmap(
            NB_L1=diff["NB-L1"], NB_L2=diff["NB-L2"],
            NB_L3=diff["NB-L3"], NB_L4=diff["NB-L4"],
            SB_L1=diff["SB-L1"], SB_L2=diff["SB-L2"],
            SB_L3=diff["SB-L3"], SB_L4=diff["SB-L4"],
        ),
    )
