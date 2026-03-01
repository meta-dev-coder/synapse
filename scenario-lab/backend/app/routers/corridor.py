"""
Router – Scenario 2: Corridor Disruption
POST /api/v1/simulate/corridor
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import CorridorRequest, CorridorResult
from app.services.corridor_service import simulate_corridor

router = APIRouter(tags=["Corridor Disruption"])


@router.post(
    "/corridor",
    response_model=CorridorResult,
    summary="Run corridor disruption simulation",
)
async def corridor_simulation(request: CorridorRequest) -> CorridorResult:
    """
    Simulate lane closures and capacity reductions using the BPR travel-time
    function.  Computes queue lengths, throughput loss, and travel-time deltas.

    - **closed_lanes**: List of lane IDs to close (e.g. ["L4"])
    - **capacity_reduction_pct**: Additional capacity reduction on open lanes (%)
    - **weather_factor**: Weather degradation (1.0 = clear, 0.5 = severe)
    """
    try:
        return simulate_corridor(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
