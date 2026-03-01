"""
Scenario 3 – Emission Impact Service.

Estimates CO2 and NOx emissions for the corridor under a modified vehicle mix
and speed profile, including idling contributions.
"""

from __future__ import annotations

import math
from typing import Any

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
    """
    Quadratic speed-correction factor: emissions increase when speed deviates
    from the optimal.

        correction = 1 + 0.003 * (speed_sim - optimal)^2 / 100
    """
    return 1.0 + 0.003 * (speed_sim - optimal_speed) ** 2 / 100.0


def _lane_baseline_emissions(lane: dict) -> tuple[float, float]:
    """Return (CO2_kg_hr, NOx_g_hr) for a lane using its baseline data."""
    speed = lane["speed_kmh"]
    total_co2_g = 0.0
    total_nox_mg = 0.0

    for cls, vol in lane["vehicle_volumes"].items():
        corr = _speed_correction(speed, SPEED_OPTIMAL_KMH[cls])
        co2_g_per_veh_km = CO2_FACTORS_G_PER_VEH_KM[cls] * corr
        # Baseline has zero idling time
        total_co2_g += vol * (co2_g_per_veh_km * CORRIDOR_LENGTH_KM)
        total_nox_mg += vol * (NOX_MG_PER_VEH_KM[cls] * corr * CORRIDOR_LENGTH_KM)

    return total_co2_g / 1000.0, total_nox_mg / 1000.0  # kg/hr and g/hr


def simulate_emission(request: EmissionRequest) -> EmissionResult:
    """
    Run the emission impact simulation.

    Steps per lane:
    1. Redistribute baseline total volume using the requested vehicle_mix_pct.
    2. Compute simulated speed = baseline_speed + speed_delta_kmh.
    3. Apply quadratic speed correction to CO2 and NOx emission factors.
    4. Add idling contribution (IDLE_CO2_G_PER_MIN * idling_time_min per vehicle).
    5. Derive an emission_scalar (normalized to max baseline lane CO2) for heatmap.
    """
    mix = request.vehicle_mix_pct
    speed_delta = request.speed_delta_kmh
    idle_min = request.idling_time_min

    # Convert mix percentages to fractions
    mix_fractions = {cls: pct / 100.0 for cls, pct in mix.items()}

    # Compute per-lane baseline for comparison
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

    for lane_id, lane in BASELINE_LANES.items():
        lane_total_volume = float(lane["volume_veh_hr"])
        speed_sim = lane["speed_kmh"] + speed_delta
        speed_sim = max(1.0, speed_sim)  # physical lower bound

        # ------------------------------------------------------------------
        # Redistribute volumes according to requested mix
        # ------------------------------------------------------------------
        redistributed: dict[str, float] = {}
        for cls in ("car", "truck", "bus", "van"):
            redistributed[cls] = lane_total_volume * mix_fractions.get(cls, 0.0)

        # ------------------------------------------------------------------
        # Compute simulated emissions
        # ------------------------------------------------------------------
        lane_co2_g = 0.0
        lane_nox_mg = 0.0

        for cls in ("car", "truck", "bus", "van"):
            vol = redistributed[cls]
            corr = _speed_correction(speed_sim, SPEED_OPTIMAL_KMH[cls])
            co2_g_per_veh_km = CO2_FACTORS_G_PER_VEH_KM[cls] * corr
            nox_mg_per_veh_km = NOX_MG_PER_VEH_KM[cls] * corr

            lane_co2_g += vol * (
                co2_g_per_veh_km * CORRIDOR_LENGTH_KM
                + IDLE_CO2_G_PER_MIN[cls] * idle_min
            )
            lane_nox_mg += vol * (
                nox_mg_per_veh_km * CORRIDOR_LENGTH_KM
            )

        lane_co2_kg = lane_co2_g / 1000.0
        lane_nox_g = lane_nox_mg / 1000.0

        emission_scalar = _clamp(
            lane_co2_kg / max_baseline_co2 if max_baseline_co2 > 0 else 0.0,
            0.0,
            1.0,
        )

        heatmap_values[lane_id] = emission_scalar
        total_co2_sim += lane_co2_kg
        total_nox_sim += lane_nox_g

        per_lane_results.append(
            EmissionLaneResult(
                lane_id=lane_id,
                co2_kg_hr=round(lane_co2_kg, 3),
                nox_g_hr=round(lane_nox_g, 3),
                co2_baseline_kg_hr=round(baseline_co2_per_lane[lane_id], 3),
                nox_baseline_kg_hr=round(baseline_nox_per_lane[lane_id], 3),
                speed_kmh=round(speed_sim, 1),
                emission_scalar=round(emission_scalar, 4),
                vehicle_volumes_redistributed={
                    cls: round(v, 1) for cls, v in redistributed.items()
                },
            )
        )

    # Corridor baseline totals from spec constants
    total_co2_baseline_kg = float(BASELINE_TOTALS["total_CO2_kg_hr"])
    total_nox_baseline_g = float(BASELINE_TOTALS["total_NOx_g_hr"])

    co2_delta_pct = (
        (total_co2_sim - total_co2_baseline_kg) / total_co2_baseline_kg * 100.0
        if total_co2_baseline_kg > 0
        else 0.0
    )
    nox_delta_pct = (
        (total_nox_sim - total_nox_baseline_g) / total_nox_baseline_g * 100.0
        if total_nox_baseline_g > 0
        else 0.0
    )

    return EmissionResult(
        co2_delta_pct=round(co2_delta_pct, 2),
        nox_delta_pct=round(nox_delta_pct, 2),
        total_co2_kg_hr=round(total_co2_sim, 3),
        total_nox_g_hr=round(total_nox_sim, 3),
        total_co2_baseline_kg_hr=total_co2_baseline_kg,
        total_nox_baseline_g_hr=total_nox_baseline_g,
        per_lane=per_lane_results,
        cesium_heatmap=LaneHeatmap(
            L1=round(heatmap_values.get("L1", 0.0), 4),
            L2=round(heatmap_values.get("L2", 0.0), 4),
            L3=round(heatmap_values.get("L3", 0.0), 4),
            L4=round(heatmap_values.get("L4", 0.0), 4),
        ),
    )
