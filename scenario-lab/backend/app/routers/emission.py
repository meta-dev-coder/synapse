"""
Router – Scenario 3: Emission Impact
POST /api/v1/simulate/emission
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import EmissionRequest, EmissionResult
from app.services.emission_service import simulate_emission

router = APIRouter(tags=["Emission Impact"])


@router.post(
    "/emission",
    response_model=EmissionResult,
    summary="Run emission impact simulation",
)
async def emission_simulation(request: EmissionRequest) -> EmissionResult:
    """
    Estimate CO2 and NOx emissions under a modified vehicle mix, speed profile,
    and idling time.

    - **vehicle_mix_pct**: Vehicle class share percentages (must sum to 100)
    - **speed_delta_kmh**: Speed change relative to lane baselines (km/h)
    - **idling_time_min**: Additional idling time per vehicle (minutes)
    """
    try:
        return await simulate_emission(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
