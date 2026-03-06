"""
Router – Scenario 5: Scenario Comparison
POST /api/v1/simulate/comparison
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ComparisonRequest, ComparisonResult
from app.services.comparison_service import simulate_comparison

router = APIRouter(tags=["Scenario Comparison"])


@router.post(
    "/comparison",
    response_model=ComparisonResult,
    summary="Compare two scenarios against a baseline",
)
async def comparison_simulation(request: ComparisonRequest) -> ComparisonResult:
    """
    Run three scenario variants side-by-side and return a comparison table with
    key metrics and a Cesium diff heatmap.

    Each scenario spec contains:
    - **type**: One of "toll", "corridor", "emission", "evasion"
    - **inputs**: Parameters matching the chosen scenario's request schema

    **Example** – compare a toll increase (A) vs. a lane closure (B) against
    a baseline toll scenario:
    ```json
    {
      "baseline_scenario": {"type": "toll", "inputs": {"vehicle_rates": {"car": 3.0, "truck": 7.5, "bus": 6.0, "van": 4.0}}},
      "scenario_a":        {"type": "toll", "inputs": {"vehicle_rates": {"car": 4.0, "truck": 9.0, "bus": 7.0, "van": 5.0}}},
      "scenario_b":        {"type": "corridor", "inputs": {"closed_lanes": ["L4"], "weather_factor": 0.8}}
    }
    ```
    """
    try:
        return await simulate_comparison(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
