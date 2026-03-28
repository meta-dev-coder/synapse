"""
Denver Traffic Demo API router.
Endpoints: baseline, scenario run, scenario CRUD, compare, GPS positions, data sources.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.data.denver_db import (
    delete_scenario,
    get_scenario,
    init_db,
    list_scenarios,
    save_scenario,
)
from app.models.schemas import (
    DenverBaselineResponse,
    DenverCompareRequest,
    DenverCompareResult,
    DenverScenarioRequest,
    DenverScenarioResult,
    GpsPositionsResponse,
    SavedScenario,
    SaveScenarioRequest,
)
from app.services import denver_service
from app.services.denver_gps_service import get_frames

router = APIRouter(tags=["Denver Traffic Demo"])

# Initialise DB on import (idempotent)
init_db()

# ---------------------------------------------------------------------------
# Data-source catalogue — built at import time (filesystem scan + static data)
# ---------------------------------------------------------------------------

DATASETS_DIR = Path(__file__).parent.parent.parent / "datasets"


def _scan_dataset_file(filename: str) -> dict:
    path = DATASETS_DIR / filename
    if not path.exists():
        return {"status": "missing", "size_mb": 0, "last_modified": "unknown"}
    stat = path.stat()
    return {
        "status": "active",
        "size_mb": round(stat.st_size / 1_048_576, 1),
        "last_modified": os.path.getmtime(path),
    }


DATA_SOURCES = [
    {
        "id": "bus_gps",
        "name": "RTD Bus GPS (30 days)",
        "description": "Real vehicle positions, speed, and bearing across Denver metro",
        "data_points": "29,100,000 pings",
        "update_frequency": "Near real-time",
        "coverage": "Last 30 days",
        **_scan_dataset_file("bus_positions_recovered.csv"),
    },
    {
        "id": "ghg_inventory",
        "name": "Denver GHG Inventory 2024",
        "description": "On-road fleet emissions, fuel mix, VMT by vehicle class",
        "data_points": "574,707 vehicles",
        "update_frequency": "Annual",
        "coverage": "Calendar year 2024",
        "status": "active",
        "size_mb": None,
    },
    {
        "id": "road_network",
        "name": "Denver Road Network",
        "description": "20,000 signalized and unsignalized intersections",
        "data_points": "20,000 intersections",
        "update_frequency": "Static",
        "coverage": "Denver metro",
        "status": "active",
        "size_mb": None,
    },
    {
        "id": "rtd_routes",
        "name": "RTD Bus Routes",
        "description": "159 routes with full geometry (MultiLineString GeoJSON)",
        "data_points": "159 routes",
        "update_frequency": "Monthly",
        "coverage": "RTD service area",
        "status": "active",
        "size_mb": None,
    },
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/baseline", response_model=DenverBaselineResponse, summary="Denver baseline KPIs")
async def get_baseline() -> DenverBaselineResponse:
    return DenverBaselineResponse(**denver_service.get_baseline())


@router.post("/scenario/run", response_model=DenverScenarioResult, summary="Run a Denver scenario")
async def run_scenario(body: DenverScenarioRequest) -> DenverScenarioResult:
    result = denver_service.run_scenario(
        ev_adoption_pct=body.ev_adoption_pct,
        mode_shift_pct=body.mode_shift_pct,
        bus_efficiency_pct=body.bus_efficiency_pct,
        bike_lanes=body.bike_lanes,
    )
    return DenverScenarioResult(**result)


@router.get("/scenarios", response_model=list[SavedScenario], summary="List saved scenarios")
async def list_saved_scenarios() -> list[SavedScenario]:
    rows = list_scenarios()
    return [_row_to_saved(r) for r in rows]


@router.post("/scenarios", response_model=SavedScenario, summary="Save a scenario")
async def save_new_scenario(body: SaveScenarioRequest) -> SavedScenario:
    scenario_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    save_scenario(
        id=scenario_id,
        name=body.name,
        inputs=body.inputs.model_dump(),
        results=body.results.model_dump(),
    )
    return SavedScenario(
        id=scenario_id,
        name=body.name,
        created_at=created_at,
        inputs=body.inputs,
        results=body.results,
    )


@router.delete("/scenarios/{scenario_id}", summary="Delete a scenario")
async def delete_saved_scenario(scenario_id: str) -> dict:
    delete_scenario(scenario_id)
    return {"ok": True}


@router.post("/compare", response_model=DenverCompareResult, summary="Compare two scenarios")
async def compare_scenarios(body: DenverCompareRequest) -> DenverCompareResult:
    a = get_scenario(body.scenario_a_id)
    b = get_scenario(body.scenario_b_id)
    if a is None:
        raise HTTPException(status_code=404, detail=f"Scenario {body.scenario_a_id} not found")
    if b is None:
        raise HTTPException(status_code=404, detail=f"Scenario {body.scenario_b_id} not found")
    comparison = denver_service.compare_scenarios(a["results"], b["results"])
    return DenverCompareResult(
        scenario_a=_row_to_saved(a),
        scenario_b=_row_to_saved(b),
        **comparison,
    )


@router.get("/gps/positions", response_model=GpsPositionsResponse, summary="Get GPS bus frames")
async def get_gps_positions() -> GpsPositionsResponse:
    frames = get_frames()
    return GpsPositionsResponse(frame_count=len(frames), frames=frames)


@router.get("/data-sources", summary="List data sources")
async def get_data_sources() -> list[dict]:
    return DATA_SOURCES


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _row_to_saved(row: dict) -> SavedScenario:
    from app.models.schemas import DenverScenarioRequest, DenverScenarioResult
    return SavedScenario(
        id=row["id"],
        name=row["name"],
        created_at=row["created_at"],
        inputs=DenverScenarioRequest(**row["inputs"]),
        results=DenverScenarioResult(**row["results"]),
    )
