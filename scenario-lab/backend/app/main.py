"""
Scenario Lab – FastAPI application entry point.

Registers all simulation routers under /api/v1/simulate and exposes
the baseline data and health-check endpoints at /api/v1.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.data.baseline_data import BASELINE_LANES, BASELINE_TOTALS
from app.models.schemas import BaselineResponse, HealthResponse
from app.routers import comparison, corridor, denver, denver_pulse, denver_traffic_sim, emission, evasion, toll
from app.services.denver_traffic_sim_service import warm_city_cache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Startup lifespan — warm graph + path pool in background thread
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, warm_city_cache)
    logger.info("City cache warming started in background thread")
    yield


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Scenario Lab API",
    description=(
        "Toll corridor simulation system with five scenario types: "
        "toll rate adjustment, corridor disruption, emission impact, "
        "evasion risk, and multi-scenario comparison."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS – allow all origins (development / demo configuration)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Simulation routers
# ---------------------------------------------------------------------------

SIMULATE_PREFIX = "/api/v1/simulate"

app.include_router(toll.router, prefix=SIMULATE_PREFIX)
app.include_router(corridor.router, prefix=SIMULATE_PREFIX)
app.include_router(emission.router, prefix=SIMULATE_PREFIX)
app.include_router(evasion.router, prefix=SIMULATE_PREFIX)
app.include_router(comparison.router, prefix=SIMULATE_PREFIX)
app.include_router(denver.router, prefix="/api/v1/denver")
app.include_router(denver_pulse.router, prefix="/api/v1/denver-pulse")
app.include_router(denver_traffic_sim.router, prefix="/api/v1/denver/traffic-sim")

# ---------------------------------------------------------------------------
# Utility endpoints
# ---------------------------------------------------------------------------

API_PREFIX = "/api/v1"


@app.get(
    f"{API_PREFIX}/baseline",
    response_model=BaselineResponse,
    tags=["Utility"],
    summary="Return baseline lane data and corridor totals",
)
async def get_baseline() -> BaselineResponse:
    """
    Returns the in-memory baseline constants used by all simulation scenarios:
    - **lanes**: Per-lane volumes, capacities, rates, emission parameters
    - **totals**: Corridor-level aggregates (revenue, emissions, evasion, etc.)
    """
    return BaselineResponse(lanes=BASELINE_LANES, totals=BASELINE_TOTALS)


@app.get(
    f"{API_PREFIX}/health",
    response_model=HealthResponse,
    tags=["Utility"],
    summary="Health check",
)
async def health_check() -> HealthResponse:
    """Returns `{"status": "ok"}` when the service is running."""
    return HealthResponse(status="ok")
