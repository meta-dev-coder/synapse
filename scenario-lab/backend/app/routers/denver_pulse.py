"""
Denver Pulse API router.
Endpoints: dashboard, simulate, scenario CRUD, compare, export.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from app.data.denver_pulse_db import (
    delete_scenario,
    get_scenario,
    init_db,
    list_scenarios,
    next_short_id,
    save_scenario,
)
from app.models.denver_pulse_schemas import (
    DenverPulseCompareExportRequest,
    DenverPulseCompareRequest,
    DenverPulseCompareResponse,
    DenverPulseDashboardResponse,
    DenverPulseSavedScenario,
    DenverPulseSaveRequest,
    DenverPulseSimulateRequest,
    DenverPulseSimulateResponse,
    DenverPulseSliders,
)
from app.services.denver_pulse_service import get_dashboard_data, run_simulate, generate_feed_alerts
from app.services.denver_traffic_sim_service import init_city_simulation, repath_city_vehicles

router = APIRouter(tags=["Denver Pulse"])

# Initialise DB on import (idempotent)
init_db()

# Load daily stats at module level (fail gracefully)
_STATS_PATH = Path(__file__).parent.parent / "data" / "denver_pulse_daily_stats.json"
try:
    with open(_STATS_PATH) as f:
        _DAILY_STATS = json.load(f)
except FileNotFoundError:
    _DAILY_STATS = []


# ---------------------------------------------------------------------------
# Slider labels for compare param rows
# ---------------------------------------------------------------------------

_SLIDER_LABELS: dict[str, str] = {
    "traffic_vol_idx": "Traffic Volume Index",
    "road_capacity_idx": "Road Capacity Index",
    "speed_kmh": "Speed (km/h)",
    "emission_idx": "Emission Index",
    "ev_share_pct": "EV Share %",
    "car_pct": "Car %",
    "pt_pct": "Public Transit %",
    "bike_pct": "Bike %",
    "walk_pct": "Walk %",
}

_POLICY_LABELS: dict[str, str] = {
    "ev": "EV Adoption Incentive",
    "bus": "Bus Network Expansion",
    "toll": "Congestion Pricing / Tolls",
    "bike": "Protected Bike Lanes",
    "diet": "Road Diet Program",
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/dashboard", response_model=DenverPulseDashboardResponse, summary="Dashboard KPIs and trends")
async def get_dashboard() -> DenverPulseDashboardResponse:
    result = get_dashboard_data(_DAILY_STATS)
    return DenverPulseDashboardResponse(**result)


@router.get("/region-alerts/feed", summary="Simulation feed: 2 new alerts per region per tick")
async def get_region_alert_feed(tick: int = Query(1, ge=1)):
    return generate_feed_alerts(tick)


@router.post("/simulate", response_model=DenverPulseSimulateResponse, summary="Run a policy simulation")
async def simulate(body: DenverPulseSimulateRequest) -> DenverPulseSimulateResponse:
    result = run_simulate(body.model_dump())
    return DenverPulseSimulateResponse(**result)


@router.get("/scenarios", response_model=list[DenverPulseSavedScenario], summary="List saved scenarios")
async def list_saved_scenarios() -> list[DenverPulseSavedScenario]:
    rows = list_scenarios()
    return [
        DenverPulseSavedScenario(
            id=r["id"],
            short_id=r["short_id"],
            name=r["name"],
            created_at=r["created_at"],
            saved_by="Denver Pulse Analyst",
            scope=r["scope"],
            horizon=r["horizon"],
            policies=r["policies"],
            sliders=DenverPulseSliders(**r["sliders"]),
            simulate_result=DenverPulseSimulateResponse(**r["simulate_result"]),
            confidence_score=r["confidence_score"],
        )
        for r in rows
    ]


@router.post("/scenarios", response_model=DenverPulseSavedScenario, summary="Save a scenario")
async def save_new_scenario(body: DenverPulseSaveRequest) -> DenverPulseSavedScenario:
    scenario_id = str(uuid.uuid4())
    short_id = next_short_id()
    created_at = datetime.now(timezone.utc).isoformat()
    confidence_score = body.simulate_result.confidence_score

    save_scenario(
        id=scenario_id,
        short_id=short_id,
        name=body.name,
        created_at=created_at,
        scope=body.scope,
        horizon=body.horizon,
        policies=body.policies,
        sliders=body.sliders.model_dump(),
        simulate_result=body.simulate_result.model_dump(),
        confidence_score=confidence_score,
    )

    return DenverPulseSavedScenario(
        id=scenario_id,
        short_id=short_id,
        name=body.name,
        created_at=created_at,
        saved_by="Denver Pulse Analyst",
        scope=body.scope,
        horizon=body.horizon,
        policies=body.policies,
        sliders=body.sliders,
        simulate_result=body.simulate_result,
        confidence_score=confidence_score,
    )


@router.delete("/scenarios/{scenario_id}", summary="Delete a scenario")
async def delete_saved_scenario(scenario_id: str) -> dict:
    delete_scenario(scenario_id)
    return {"ok": True}


@router.post("/scenarios/compare", response_model=DenverPulseCompareResponse, summary="Compare scenarios")
async def compare_scenarios(body: DenverPulseCompareRequest) -> DenverPulseCompareResponse:
    if len(body.scenario_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 scenario IDs are required")

    scenarios: list[DenverPulseSavedScenario] = []
    for sid in body.scenario_ids:
        row = get_scenario(sid)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Scenario {sid} not found")
        scenarios.append(
            DenverPulseSavedScenario(
                id=row["id"],
                short_id=row["short_id"],
                name=row["name"],
                created_at=row["created_at"],
                saved_by="Denver Pulse Analyst",
                scope=row["scope"],
                horizon=row["horizon"],
                policies=row["policies"],
                sliders=DenverPulseSliders(**row["sliders"]),
                simulate_result=DenverPulseSimulateResponse(**row["simulate_result"]),
                confidence_score=row["confidence_score"],
            )
        )

    # KPI rows
    kpi_rows = []
    for label, key, unit in [
        ("GHG Change %", "ghg_tco2e_delta", "%"),
        ("Congestion Change %", "congestion_pct_delta", "%"),
        ("Speed Change km/h", "avg_speed_kmh_delta", "km/h"),
        ("Transit Share Change %", "mode_share_delta", "%"),
    ]:
        values = {}
        for sc in scenarios:
            d = sc.simulate_result.deltas
            if key == "mode_share_delta":
                values[sc.short_id] = d.mode_share_delta.get("pt", 0.0)
            else:
                values[sc.short_id] = getattr(d, key)
        kpi_rows.append({"label": label, "unit": unit, "values": values})

    # Param rows (9 slider keys)
    param_rows = []
    for slider_key, slider_label in _SLIDER_LABELS.items():
        values = {}
        for sc in scenarios:
            values[sc.short_id] = getattr(sc.sliders, slider_key)
        param_rows.append({"label": slider_label, "key": slider_key, "values": values})

    # Policy rows (5 policies)
    policy_rows = []
    for policy_key, policy_label in _POLICY_LABELS.items():
        values = {}
        for sc in scenarios:
            values[sc.short_id] = policy_key in sc.policies
        policy_rows.append({"label": policy_label, "key": policy_key, "values": values})

    # Confidence cards
    confidence_cards = []
    for sc in scenarios:
        confidence_cards.append({
            "short_id": sc.short_id,
            "name": sc.name,
            "score": sc.confidence_score,
            "horizon": sc.horizon,
            "policy_count": len(sc.policies),
        })

    return DenverPulseCompareResponse(
        scenarios=scenarios,
        kpi_rows=kpi_rows,
        param_rows=param_rows,
        policy_rows=policy_rows,
        confidence_cards=confidence_cards,
    )


@router.get("/scenarios/{scenario_id}/export", summary="Export a scenario as CSV or PDF")
async def export_scenario(scenario_id: str, format: str = Query("csv")) -> Response:
    row = get_scenario(scenario_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")

    from app.reports.denver_pulse_report import generate_scenario_csv, generate_scenario_pdf

    if format == "pdf":
        content = generate_scenario_pdf(row)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="scenario_{row["short_id"]}.pdf"'},
        )
    else:
        content = generate_scenario_csv(row)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="scenario_{row["short_id"]}.csv"'},
        )


@router.post("/scenarios/compare/export", summary="Export comparison as CSV or PDF")
async def export_comparison(body: DenverPulseCompareExportRequest) -> Response:
    if len(body.scenario_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 scenario IDs are required")

    rows = []
    for sid in body.scenario_ids:
        row = get_scenario(sid)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Scenario {sid} not found")
        rows.append(row)

    from app.reports.denver_pulse_report import generate_compare_csv, generate_compare_pdf

    if body.format == "pdf":
        content = generate_compare_pdf(rows)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="comparison.pdf"'},
        )
    else:
        content = generate_compare_csv(rows)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="comparison.csv"'},
        )


# ---------------------------------------------------------------------------
# Frontend log sink — writes browser logs to .logs/frontend.log
# ---------------------------------------------------------------------------

_FRONTEND_LOG = Path(__file__).parent.parent.parent / ".logs" / "frontend.log"


@router.post("/log", include_in_schema=False)
async def frontend_log(request: Request) -> dict:
    _FRONTEND_LOG.parent.mkdir(parents=True, exist_ok=True)
    try:
        raw = await request.body()
        data = json.loads(raw)
        lines = data.get("lines", [])
    except Exception:
        lines = [raw.decode("utf-8", errors="replace") if isinstance(raw, (bytes, bytearray)) else str(raw)]
    with open(_FRONTEND_LOG, "a") as f:
        for line in lines:
            f.write(str(line) + "\n")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Traffic dots (city-wide synthetic vehicles for dashboard)
# ---------------------------------------------------------------------------


@router.get("/traffic-dots", summary="City-wide synthetic vehicle paths for dashboard")
async def get_traffic_dots() -> dict:
    import asyncio
    return await asyncio.to_thread(init_city_simulation)


@router.post("/traffic-dots/repath", summary="Replenish exhausted city vehicles")
async def repath_traffic_dots(body: dict) -> dict:
    import asyncio
    count = body.get("count", 10)
    vehicles = await asyncio.to_thread(repath_city_vehicles, count)
    return {"vehicles": vehicles}
