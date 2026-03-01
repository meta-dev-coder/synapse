"""
Router – Scenario 1: Toll Rate Simulation
POST /api/v1/simulate/toll
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import TollRequest, TollResult
from app.services.toll_service import simulate_toll

router = APIRouter(tags=["Toll Rate Simulation"])


@router.post("/toll", response_model=TollResult, summary="Run toll rate simulation")
async def toll_simulation(request: TollRequest) -> TollResult:
    """
    Simulate the impact of new toll rates on lane revenue, traffic volumes,
    evasion probability, and diversion likelihood.

    - **vehicle_rates**: New toll rates per vehicle class (car, truck, bus, van)
    - **peak_multiplier**: Revenue scaling for peak hours (1.0 = baseline)
    - **ev_exemption**: Exempt the EV fraction of car volume from revenue
    - **enforcement_intensity**: Enforcement strength from 0 (none) to 1 (max)
    """
    try:
        return simulate_toll(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
