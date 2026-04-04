"""
Denver Traffic Simulation router.

Endpoints: list neighborhoods, init simulation, repath vehicles.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.denver_pulse_schemas import (
    NeighborhoodInfo,
    TrafficSimInitRequest,
    TrafficSimInitResponse,
    TrafficSimRepathRequest,
    TrafficSimRepathResponse,
)
from app.services.denver_traffic_sim_service import (
    get_neighborhoods,
    init_simulation,
    repath_vehicles,
)

router = APIRouter(tags=["Denver Traffic Simulation"])


@router.get(
    "/neighborhoods",
    response_model=list[NeighborhoodInfo],
    summary="List Denver neighborhoods",
)
async def list_neighborhoods() -> list[NeighborhoodInfo]:
    rows = get_neighborhoods()
    return [NeighborhoodInfo(**r) for r in rows]


@router.post(
    "/init",
    response_model=TrafficSimInitResponse,
    summary="Initialise traffic simulation for a neighborhood",
)
async def sim_init(body: TrafficSimInitRequest) -> TrafficSimInitResponse:
    import asyncio
    try:
        result = await asyncio.to_thread(init_simulation, body.neighborhood_id, body.density)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return TrafficSimInitResponse(**result)


@router.post(
    "/repath",
    response_model=TrafficSimRepathResponse,
    summary="Generate new vehicle paths",
)
async def sim_repath(body: TrafficSimRepathRequest) -> TrafficSimRepathResponse:
    import asyncio
    try:
        vehicles = await asyncio.to_thread(repath_vehicles, body.neighborhood_id, body.count)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return TrafficSimRepathResponse(vehicles=vehicles)
