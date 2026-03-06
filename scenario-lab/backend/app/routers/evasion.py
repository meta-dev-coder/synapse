"""
Router – Scenario 4: Evasion Risk
POST /api/v1/simulate/evasion
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import EvasionRequest, EvasionResult
from app.services.evasion_service import simulate_evasion

router = APIRouter(tags=["Evasion Risk"])


@router.post(
    "/evasion",
    response_model=EvasionResult,
    summary="Run evasion risk simulation",
)
async def evasion_simulation(request: EvasionRequest) -> EvasionResult:
    """
    Model toll evasion probability and revenue leakage under varying toll levels,
    enforcement detection accuracy, and patrol frequency.

    - **toll_increase_pct**: Percentage increase in toll rates vs. baseline
    - **detection_accuracy**: Probability an evasion attempt is detected (0–1)
    - **patrol_frequency**: Normalized patrol presence (0 = none, 1 = maximum)
    """
    try:
        return await simulate_evasion(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
