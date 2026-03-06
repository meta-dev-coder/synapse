"""
Scenario 3 – Emission Impact Service.

Estimates CO2 and NOx emissions for the corridor under a modified vehicle mix
and speed profile, including idling contributions.
"""

from __future__ import annotations

import asyncio

from app.data.baseline_data import (
    BASELINE_LANES,
    BASELINE_TOTALS,
    CO2_FACTORS_G_PER_VEH_KM,
    CORRIDOR_LENGTH_KM,
    IDLE_CO2_G_PER_MIN,
    NOX_MG_PER_VEH_KM,
    SPEED_OPTIMAL_KMH,
)
from app.models.schemas import (
    EmissionLaneResult,
    EmissionRequest,
    EmissionResult,
    LaneHeatmap,
)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _speed_correction(speed_sim: float, optimal_speed: float) -> float:
    return 1.0 + 0.003 * (speed_sim - optimal_speed) ** 2 / 100.0


def _lane_baseline_emissions(lane: dict) -> tuple[float, float]:
    speed = lane["speed_kmh"]
    total_co2_g = 0.0
    total_nox_mg = 0.0
    for cls, vol in lane["vehicle_volumes"].items():
        corr = _speed_correction(speed, SPEED_OPTIMAL_KMH[cls])
        total_co2_g += vol * (CO2_FACTORS_G_PER_VEH_KM[cls] * corr * CORRIDOR_LENGTH_KM)
        total_nox_mg += vol * (NOX_MG_PER_VEH_KM[cls] * corr * CORRIDOR_LENGTH_KM)
    return total_co2_g / 1000.0, total_nox_mg / 1000.0


def _make_heatmap(heatmap_values: dict[str, float]) -> LaneHeatmap:
    def g(lid: str) -> float:
        return round(heatmap_values.get(lid, 0.0), 4)
    return LaneHeatmap(
        NB_L1=g("NB-L1"), NB_L2=g("NB-L2"), NB_L3=g("NB-L3"), NB_L4=g("NB-L4"),
        SB_L1=g("SB-L1"), SB_L2=g("SB-L2"), SB_L3=g("SB-L3"), SB_L4=g("SB-L4"),
    )


async def simulate_emission(request: EmissionRequest) -> EmissionResult:
    """
    Run the emission impact simulation across all 8 NB/SB lanes.
    """
    mix = request.vehicle_mix_pct
    speed_delta = request.speed_delta_kmh
    idle_min = request.idling_time_min
    step_sleep = request.simulation_duration_sec / 6

    mix_fractions = {cls: pct / 100.0 for cls, pct in mix.items()}

    await asyncio.sleep(step_sleep)   # Step 1: Connecting to data source
    await asyncio.sleep(step_sleep)   # Step 2: Downloading sensor & transaction data
    await asyncio.sleep(step_sleep)   # Step 3: Preprocessing data

    baseline_co2_per_lane: dict[str, float] = {}
    baseline_nox_per_lane: dict[str, float] = {}
    for lid, lane in BASELINE_LANES.items():
        co2, nox = _lane_baseline_emissions(lane)
        baseline_co2_per_lane[lid] = co2
        baseline_nox_per_lane[lid] = nox

    max_baseline_co2 = max(baseline_co2_per_lane.values()) if baseline_co2_per_lane else 1.0

    per_lane_results: list[EmissionLaneResult] = []
    heatmap_values: dict[str, float] = {}
    total_co2_sim = 0.0
    total_nox_sim = 0.0

    # ── NB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("NB"):
            result = _compute_emission_lane(
                lane_id, lane, mix_fractions, speed_delta, idle_min,
                baseline_co2_per_lane, baseline_nox_per_lane, max_baseline_co2,
                heatmap_values,
            )
            per_lane_results.append(result)
            total_co2_sim += result.co2_kg_hr
            total_nox_sim += result.nox_g_hr

    await asyncio.sleep(step_sleep)   # Step 4: Running simulation on NB lanes

    # ── SB lanes ──────────────────────────────────────────────────────────────
    for lane_id, lane in BASELINE_LANES.items():
        if lane_id.startswith("SB"):
            result = _compute_emission_lane(
                lane_id, lane, mix_fractions, speed_delta, idle_min,
                baseline_co2_per_lane, baseline_nox_per_lane, max_baseline_co2,
                heatmap_values,
            )
            per_lane_results.append(result)
            total_co2_sim += result.co2_kg_hr
            total_nox_sim += result.nox_g_hr

    await asyncio.sleep(step_sleep)   # Step 5: Running simulation on SB lanes

    total_co2_baseline_kg = float(BASELINE_TOTALS["total_CO2_kg_hr"])
    total_nox_baseline_g = float(BASELINE_TOTALS["total_NOx_g_hr"])

    co2_delta_pct = (
        (total_co2_sim - total_co2_baseline_kg) / total_co2_baseline_kg * 100.0
        if total_co2_baseline_kg > 0 else 0.0
    )
    nox_delta_pct = (
        (total_nox_sim - total_nox_baseline_g) / total_nox_baseline_g * 100.0
        if total_nox_baseline_g > 0 else 0.0
    )

    await asyncio.sleep(step_sleep)   # Step 6: Computing aggregates and KPIs

    return EmissionResult(
        co2_delta_pct=round(co2_delta_pct, 2),
        nox_delta_pct=round(nox_delta_pct, 2),
        total_co2_kg_hr=round(total_co2_sim, 3),
        total_nox_g_hr=round(total_nox_sim, 3),
        total_co2_baseline_kg_hr=total_co2_baseline_kg,
        total_nox_baseline_g_hr=total_nox_baseline_g,
        per_lane=per_lane_results,
        cesium_heatmap=_make_heatmap(heatmap_values),
    )


def _compute_emission_lane(
    lane_id: str,
    lane: dict,
    mix_fractions: dict[str, float],
    speed_delta: float,
    idle_min: float,
    baseline_co2: dict[str, float],
    baseline_nox: dict[str, float],
    max_baseline_co2: float,
    heatmap_values: dict[str, float],
) -> EmissionLaneResult:
    lane_total_volume = float(lane["volume_veh_hr"])
    speed_sim = max(1.0, lane["speed_kmh"] + speed_delta)

    redistributed: dict[str, float] = {
        cls: lane_total_volume * mix_fractions.get(cls, 0.0)
        for cls in ("car", "truck", "bus", "van")
    }

    lane_co2_g = 0.0
    lane_nox_mg = 0.0
    for cls in ("car", "truck", "bus", "van"):
        vol = redistributed[cls]
        corr = _speed_correction(speed_sim, SPEED_OPTIMAL_KMH[cls])
        lane_co2_g += vol * (
            CO2_FACTORS_G_PER_VEH_KM[cls] * corr * CORRIDOR_LENGTH_KM
            + IDLE_CO2_G_PER_MIN[cls] * idle_min
        )
        lane_nox_mg += vol * (NOX_MG_PER_VEH_KM[cls] * corr * CORRIDOR_LENGTH_KM)

    lane_co2_kg = lane_co2_g / 1000.0
    lane_nox_g = lane_nox_mg / 1000.0
    emission_scalar = _clamp(
        lane_co2_kg / max_baseline_co2 if max_baseline_co2 > 0 else 0.0,
        0.0, 1.0,
    )
    heatmap_values[lane_id] = emission_scalar

    return EmissionLaneResult(
        lane_id=lane_id,
        co2_kg_hr=round(lane_co2_kg, 3),
        nox_g_hr=round(lane_nox_g, 3),
        co2_baseline_kg_hr=round(baseline_co2[lane_id], 3),
        nox_baseline_kg_hr=round(baseline_nox[lane_id], 3),
        speed_kmh=round(speed_sim, 1),
        emission_scalar=round(emission_scalar, 4),
        vehicle_volumes_redistributed={cls: round(v, 1) for cls, v in redistributed.items()},
    )
