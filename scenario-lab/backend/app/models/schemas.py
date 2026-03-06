"""
All Pydantic v2 request and response schemas for the Scenario Lab API.
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field, model_validator
from pydantic import ConfigDict

_ALL_LANE_IDS = frozenset({
    "NB-L1", "NB-L2", "NB-L3", "NB-L4",
    "SB-L1", "SB-L2", "SB-L3", "SB-L4",
})


# ---------------------------------------------------------------------------
# Shared / utility models
# ---------------------------------------------------------------------------

class LaneHeatmap(BaseModel):
    """Cesium heatmap scalar per lane (0.0 – 1.0) for all 8 NB/SB lanes."""
    model_config = ConfigDict(extra="allow")

    NB_L1: float = Field(..., ge=0.0, le=1.0)
    NB_L2: float = Field(..., ge=0.0, le=1.0)
    NB_L3: float = Field(..., ge=0.0, le=1.0)
    NB_L4: float = Field(..., ge=0.0, le=1.0)
    SB_L1: float = Field(..., ge=0.0, le=1.0)
    SB_L2: float = Field(..., ge=0.0, le=1.0)
    SB_L3: float = Field(..., ge=0.0, le=1.0)
    SB_L4: float = Field(..., ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Scenario 1 – Toll Rate Simulation
# ---------------------------------------------------------------------------

class TollRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_rates: dict[str, float] = Field(
        ...,
        description="New toll rates in USD by vehicle class: car, truck, bus, van",
        examples=[{"car": 3.50, "truck": 8.00, "bus": 6.50, "van": 4.50}],
    )
    peak_multiplier: float = Field(
        default=1.0,
        ge=0.5,
        le=3.0,
        description="Peak-hour revenue multiplier (1.0 = off-peak)",
    )
    ev_exemption: bool = Field(
        default=False,
        description="If True, EVs (fraction of cars) pay no toll",
    )
    enforcement_intensity: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Enforcement strength (0 = none, 1 = maximum)",
    )
    simulation_duration_sec: int = Field(
        default=30,
        ge=10,
        le=60,
        description="Total simulated wall-clock duration in seconds (10–60)",
    )

    @model_validator(mode="after")
    def validate_vehicle_rates(self) -> "TollRequest":
        valid_classes = {"car", "truck", "bus", "van"}
        for cls in self.vehicle_rates:
            if cls not in valid_classes:
                raise ValueError(f"Unknown vehicle class '{cls}'. Must be one of {valid_classes}")
            if self.vehicle_rates[cls] < 0:
                raise ValueError(f"Toll rate for '{cls}' must be non-negative")
        return self


class TollLaneResult(BaseModel):
    lane_id: str
    revenue_simulated_usd_hr: float
    revenue_baseline_usd_hr: float
    volume_simulated_veh_hr: float
    volume_baseline_veh_hr: float
    evasion_rate_pct: float
    diversion_probability: float
    density_scalar: float = Field(..., ge=0.0, le=1.0)
    vehicle_volumes_simulated: dict[str, float]


class TollResult(BaseModel):
    scenario: str = "toll_rate_simulation"
    revenue_delta_pct: float
    total_revenue_simulated_usd_hr: float
    total_revenue_baseline_usd_hr: float
    evasion_rate_projected_pct: float
    diversion_probability: float
    per_lane: list[TollLaneResult]
    cesium_heatmap: LaneHeatmap


# ---------------------------------------------------------------------------
# Scenario 2 – Corridor Disruption
# ---------------------------------------------------------------------------

class CorridorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    closed_lanes: list[str] = Field(
        default_factory=list,
        description="Lane IDs to close (e.g. ['NB-L4', 'SB-L4'])",
    )
    capacity_reduction_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Additional capacity reduction across open lanes (%)",
    )
    weather_factor: float = Field(
        default=1.0,
        ge=0.1,
        le=1.5,
        description="Weather degradation factor (1.0 = clear, <1.0 = adverse)",
    )
    simulation_duration_sec: int = Field(
        default=30,
        ge=10,
        le=60,
        description="Total simulated wall-clock duration in seconds (10–60)",
    )

    @model_validator(mode="after")
    def validate_closed_lanes(self) -> "CorridorRequest":
        for lane in self.closed_lanes:
            if lane not in _ALL_LANE_IDS:
                raise ValueError(f"Unknown lane '{lane}'. Must be one of {sorted(_ALL_LANE_IDS)}")
        if len(self.closed_lanes) == 8:
            raise ValueError("Cannot close all eight lanes simultaneously")
        return self


class CorridorLaneResult(BaseModel):
    lane_id: str
    is_closed: bool
    volume_simulated_veh_hr: float
    capacity_effective_veh_hr: float
    travel_time_sec: float
    travel_time_delta_pct: float
    queue_veh: float
    queue_m: float
    congestion_scalar: float = Field(..., ge=0.0, le=1.0)


class CorridorResult(BaseModel):
    scenario: str = "corridor_disruption"
    travel_time_delta_pct: float
    total_queue_length_m: float
    throughput_reduction_pct: float
    per_lane: list[CorridorLaneResult]
    cesium_heatmap: LaneHeatmap


# ---------------------------------------------------------------------------
# Scenario 3 – Emission Impact
# ---------------------------------------------------------------------------

class EmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_mix_pct: dict[str, float] = Field(
        ...,
        description="Vehicle class share as percentages (must sum to 100)",
        examples=[{"car": 55.0, "truck": 20.0, "bus": 10.0, "van": 15.0}],
    )
    speed_delta_kmh: float = Field(
        default=0.0,
        ge=-50.0,
        le=50.0,
        description="Speed change relative to baseline (km/h)",
    )
    idling_time_min: float = Field(
        default=0.0,
        ge=0.0,
        le=60.0,
        description="Additional idling time per vehicle (minutes)",
    )
    simulation_duration_sec: int = Field(
        default=30,
        ge=10,
        le=60,
        description="Total simulated wall-clock duration in seconds (10–60)",
    )

    @model_validator(mode="after")
    def validate_vehicle_mix(self) -> "EmissionRequest":
        valid_classes = {"car", "truck", "bus", "van"}
        for cls in self.vehicle_mix_pct:
            if cls not in valid_classes:
                raise ValueError(f"Unknown vehicle class '{cls}'. Must be one of {valid_classes}")
        total = sum(self.vehicle_mix_pct.values())
        if abs(total - 100.0) > 0.5:
            raise ValueError(f"vehicle_mix_pct must sum to 100 (got {total:.2f})")
        return self


class EmissionLaneResult(BaseModel):
    lane_id: str
    co2_kg_hr: float
    nox_g_hr: float
    co2_baseline_kg_hr: float
    nox_baseline_kg_hr: float
    speed_kmh: float
    emission_scalar: float = Field(..., ge=0.0, le=1.0)
    vehicle_volumes_redistributed: dict[str, float]


class EmissionResult(BaseModel):
    scenario: str = "emission_impact"
    co2_delta_pct: float
    nox_delta_pct: float
    total_co2_kg_hr: float
    total_nox_g_hr: float
    total_co2_baseline_kg_hr: float
    total_nox_baseline_g_hr: float
    per_lane: list[EmissionLaneResult]
    cesium_heatmap: LaneHeatmap


# ---------------------------------------------------------------------------
# Scenario 4 – Evasion Risk
# ---------------------------------------------------------------------------

class EvasionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    toll_increase_pct: float = Field(
        default=0.0,
        ge=-50.0,
        le=200.0,
        description="Percentage increase in toll rates relative to baseline",
    )
    detection_accuracy: float = Field(
        default=0.72,
        ge=0.0,
        le=1.0,
        description="Probability that an evasion attempt is detected (0–1)",
    )
    patrol_frequency: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Normalized patrol frequency (0 = no patrol, 1 = maximum)",
    )
    simulation_duration_sec: int = Field(
        default=30,
        ge=10,
        le=60,
        description="Total simulated wall-clock duration in seconds (10–60)",
    )


class EvasionLaneResult(BaseModel):
    lane_id: str
    evasion_rate_baseline_pct: float
    evasion_rate_simulated_pct: float
    revenue_leakage_baseline_usd_hr: float
    revenue_leakage_simulated_usd_hr: float
    risk_scalar: float = Field(..., ge=0.0, le=1.0)


class EvasionResult(BaseModel):
    scenario: str = "evasion_risk"
    evasion_rate_projected_pct: float
    revenue_leakage_reduction_pct: float
    total_leakage_baseline_usd_hr: float
    total_leakage_simulated_usd_hr: float
    per_lane: list[EvasionLaneResult]
    cesium_heatmap: LaneHeatmap


# ---------------------------------------------------------------------------
# Scenario 5 – Comparison
# ---------------------------------------------------------------------------

SCENARIO_TYPE_LITERALS = ("toll", "corridor", "emission", "evasion")


class ScenarioSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(
        ...,
        description="Scenario type: 'toll', 'corridor', 'emission', or 'evasion'",
    )
    inputs: dict[str, Any] = Field(
        ...,
        description="Inputs matching the chosen scenario's request schema",
    )

    @model_validator(mode="after")
    def validate_type(self) -> "ScenarioSpec":
        if self.type not in SCENARIO_TYPE_LITERALS:
            raise ValueError(
                f"Scenario type must be one of {SCENARIO_TYPE_LITERALS}, got '{self.type}'"
            )
        return self


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    baseline_scenario: ScenarioSpec = Field(
        ...,
        description="Baseline scenario to compare against",
    )
    scenario_a: ScenarioSpec = Field(
        ...,
        description="First alternative scenario",
    )
    scenario_b: ScenarioSpec = Field(
        ...,
        description="Second alternative scenario",
    )
    simulation_duration_sec: int = Field(
        default=30,
        ge=10,
        le=60,
        description="Total simulated wall-clock duration per sub-scenario (10–60)",
    )


class ComparisonMetrics(BaseModel):
    """Key metrics extracted from a single scenario run."""
    scenario_type: str
    revenue_usd_hr: Optional[float] = None
    co2_kg_hr: Optional[float] = None
    nox_g_hr: Optional[float] = None
    travel_time_delta_pct: Optional[float] = None
    evasion_rate_pct: Optional[float] = None
    throughput_reduction_pct: Optional[float] = None


class ComparisonColumn(BaseModel):
    label: str
    metrics: ComparisonMetrics
    cesium_heatmap: LaneHeatmap
    per_lane: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Per-lane breakdown rows for this scenario column",
    )


class CesiumDiffHeatmap(BaseModel):
    """Per-lane heatmap showing the difference between scenario_a and scenario_b."""
    NB_L1: float
    NB_L2: float
    NB_L3: float
    NB_L4: float
    SB_L1: float
    SB_L2: float
    SB_L3: float
    SB_L4: float


class ComparisonResult(BaseModel):
    scenario: str = "comparison"
    baseline: ComparisonColumn
    scenario_a: ComparisonColumn
    scenario_b: ComparisonColumn
    cesium_diff_heatmap: CesiumDiffHeatmap


# ---------------------------------------------------------------------------
# Baseline / Health
# ---------------------------------------------------------------------------

class BaselineResponse(BaseModel):
    lanes: dict[str, Any]
    totals: dict[str, Any]


class HealthResponse(BaseModel):
    status: str = "ok"
