"""
Scenario 5 – Scenario Comparison Service.

Runs up to three scenarios (baseline, A, B) using their respective services
and produces a side-by-side comparison table with extracted key metrics and
a per-lane Cesium diff heatmap.
"""

from __future__ import annotations

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


_LANE_IDS = ("L1", "L2", "L3", "L4")


def _run_scenario(spec: ScenarioSpec) -> tuple[ComparisonMetrics, LaneHeatmap]:
    """
    Dispatch the scenario spec to the appropriate service and extract key metrics.

    Returns (metrics, heatmap) for the scenario.
    """
    stype = spec.type
    inputs = spec.inputs

    if stype == "toll":
        req = TollRequest(**inputs)
        result = simulate_toll(req)
        metrics = ComparisonMetrics(
            scenario_type="toll",
            revenue_usd_hr=result.total_revenue_simulated_usd_hr,
            evasion_rate_pct=result.evasion_rate_projected_pct,
        )
        heatmap = result.cesium_heatmap

    elif stype == "corridor":
        req = CorridorRequest(**inputs)
        result = simulate_corridor(req)
        metrics = ComparisonMetrics(
            scenario_type="corridor",
            travel_time_delta_pct=result.travel_time_delta_pct,
            throughput_reduction_pct=result.throughput_reduction_pct,
        )
        heatmap = result.cesium_heatmap

    elif stype == "emission":
        req = EmissionRequest(**inputs)
        result = simulate_emission(req)
        metrics = ComparisonMetrics(
            scenario_type="emission",
            co2_kg_hr=result.total_co2_kg_hr,
            nox_g_hr=result.total_nox_g_hr,
        )
        heatmap = result.cesium_heatmap

    elif stype == "evasion":
        req = EvasionRequest(**inputs)
        result = simulate_evasion(req)
        metrics = ComparisonMetrics(
            scenario_type="evasion",
            evasion_rate_pct=result.evasion_rate_projected_pct,
            revenue_usd_hr=None,  # not a primary output of evasion scenario
        )
        heatmap = result.cesium_heatmap

    else:
        # Unreachable due to ScenarioSpec validation, but kept for safety
        raise ValueError(f"Unsupported scenario type: '{stype}'")

    return metrics, heatmap


def _heatmap_to_dict(heatmap: LaneHeatmap) -> dict[str, float]:
    return {lid: getattr(heatmap, lid) for lid in _LANE_IDS}


def simulate_comparison(request: ComparisonRequest) -> ComparisonResult:
    """
    Run baseline, scenario_a, and scenario_b, then produce a comparison table.

    The Cesium diff heatmap highlights per-lane differences between scenario_a
    and scenario_b (absolute value of heatmap scalar difference, normalized).
    """
    base_metrics, base_heatmap = _run_scenario(request.baseline_scenario)
    a_metrics, a_heatmap = _run_scenario(request.scenario_a)
    b_metrics, b_heatmap = _run_scenario(request.scenario_b)

    # ------------------------------------------------------------------
    # Build diff heatmap: per-lane |A - B| clamped to [0, 1]
    # ------------------------------------------------------------------
    a_vals = _heatmap_to_dict(a_heatmap)
    b_vals = _heatmap_to_dict(b_heatmap)
    diff: dict[str, float] = {}
    for lid in _LANE_IDS:
        diff[lid] = round(min(1.0, abs(a_vals[lid] - b_vals[lid])), 4)

    return ComparisonResult(
        baseline=ComparisonColumn(
            label="Baseline",
            metrics=base_metrics,
            cesium_heatmap=base_heatmap,
        ),
        scenario_a=ComparisonColumn(
            label="Scenario A",
            metrics=a_metrics,
            cesium_heatmap=a_heatmap,
        ),
        scenario_b=ComparisonColumn(
            label="Scenario B",
            metrics=b_metrics,
            cesium_heatmap=b_heatmap,
        ),
        cesium_diff_heatmap=CesiumDiffHeatmap(
            L1=diff["L1"],
            L2=diff["L2"],
            L3=diff["L3"],
            L4=diff["L4"],
        ),
    )
