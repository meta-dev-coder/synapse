"""
Pydantic schemas for the Denver Pulse policy simulation feature.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# -- Sliders --
class DenverPulseSliders(BaseModel):
    traffic_vol_idx: float = 100.0
    road_capacity_idx: float = 100.0
    speed_kmh: float = 38.0
    emission_idx: float = 100.0
    ev_share_pct: float = 15.0
    car_pct: float = 45.0
    pt_pct: float = 30.0
    bike_pct: float = 15.0
    walk_pct: float = 10.0


# -- KPI snapshot --
class DenverPulseKPIs(BaseModel):
    ghg_tco2e: float
    congestion_pct: float
    avg_speed_kmh: float
    mode_share: dict[str, float]


class DenverPulseDeltas(BaseModel):
    ghg_tco2e_delta: float
    congestion_pct_delta: float
    avg_speed_kmh_delta: float
    mode_share_delta: dict[str, float]


class DenverPulseCesiumEdges(BaseModel):
    baseline: dict[str, float]
    scenario: dict[str, float]


# -- Simulate --
class DenverPulseSimulateRequest(BaseModel):
    policies: list[str]
    scope: str = "city"
    horizon: str = "1y"
    sliders: DenverPulseSliders


class DenverPulseSimulateResponse(BaseModel):
    baseline: DenverPulseKPIs
    scenario: DenverPulseKPIs
    deltas: DenverPulseDeltas
    confidence_score: float
    cesium_edges: DenverPulseCesiumEdges


# -- Dashboard --
class DenverPulseAlert(BaseModel):
    level: str
    title: str
    description: str
    timestamp: str


class DenverPulseTrends(BaseModel):
    labels: list[str]
    emissions: list[float]
    car_pct: list[float]
    pt_pct: list[float]
    bike_pct: list[float]
    walk_pct: list[float]


class DenverPulseDashboardResponse(BaseModel):
    kpis: DenverPulseKPIs
    kpi_trends: dict[str, float]
    trends_7d: DenverPulseTrends
    trends_30d: DenverPulseTrends
    trends_ytd: DenverPulseTrends
    alerts: list[DenverPulseAlert]
    cesium_edges: dict[str, dict[str, float]]


# -- Saved Scenario --
class DenverPulseSaveRequest(BaseModel):
    name: str
    scope: str
    horizon: str
    policies: list[str]
    sliders: DenverPulseSliders
    simulate_result: DenverPulseSimulateResponse


class DenverPulseSavedScenario(BaseModel):
    id: str
    short_id: str
    name: str
    created_at: str
    saved_by: str
    scope: str
    horizon: str
    policies: list[str]
    sliders: DenverPulseSliders
    simulate_result: DenverPulseSimulateResponse
    confidence_score: float


# -- Compare --
class DenverPulseCompareRequest(BaseModel):
    scenario_ids: list[str]


class DenverPulseCompareResponse(BaseModel):
    scenarios: list[DenverPulseSavedScenario]
    kpi_rows: list[dict]
    param_rows: list[dict]
    policy_rows: list[dict]
    confidence_cards: list[dict]


# -- Compare Export --
class DenverPulseCompareExportRequest(BaseModel):
    scenario_ids: list[str]
    format: str


# ---------------------------------------------------------------------------
# Denver Traffic Simulation
# ---------------------------------------------------------------------------


class NeighborhoodInfo(BaseModel):
    id: str
    name: str
    typology: Optional[str] = None
    area_km2: float


class TrafficSimVehicle(BaseModel):
    id: str
    mode: str  # car, truck, van, bus, bike
    path: list[list[float]]  # [[lon, lat], [lon, lat], ...]
    speed: float  # progress per frame


class TrafficSimInitRequest(BaseModel):
    neighborhood_id: str


class TrafficSimInitResponse(BaseModel):
    boundary: list[list[float]]  # [[lon, lat], ...] polygon exterior ring
    vehicles: list[TrafficSimVehicle]
    stats: dict


class TrafficSimRepathRequest(BaseModel):
    neighborhood_id: str
    count: int


class TrafficSimRepathResponse(BaseModel):
    vehicles: list[TrafficSimVehicle]
