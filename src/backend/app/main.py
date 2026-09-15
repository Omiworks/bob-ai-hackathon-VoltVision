"""
GridGuardian AI — FastAPI entrypoint (Phase 5).

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** This is a simplified network-impact model, not an electrical power-flow
    simulator, and must not be used for real grid operational decisions. ***

The API is a thin adapter over the already-tested Phase 2/3/4 services
(ML prediction, impact, priority, explanation, simulation). No business logic
lives in these route handlers.

Run with:
    cd backend
    python -m uvicorn app.main:app --reload
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import ai, alerts, assets, dashboard, model, priority, simulation
from app.api.schemas import HealthResponse
from app.services import registry

logger = logging.getLogger("gridguardian.api")

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the precomputed registry once so first requests are fast and the
    data has already been validated at startup."""
    registry.combined_records()
    logger.info("GridGuardian API ready (%s assets loaded).",
                len(registry.combined_records()))
    yield


app = FastAPI(
    title="GridGuardian AI API",
    description="Decision-support API for electric-grid operators. "
                "Synthetic demonstration data only — not real utility data.",
    version="0.6.0-phase6",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers are thin adapters; logic lives in app/services/*.
app.include_router(assets.router)
app.include_router(simulation.router)
app.include_router(priority.router)
app.include_router(dashboard.router)
app.include_router(model.router)
app.include_router(alerts.router)
app.include_router(ai.router)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Invalid user input (unknown asset, bad filter/body) -> 400."""
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak stack traces to the client; 500 only for real surprises."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "GridGuardian AI",
        "status": "ok",
        "phase": "6 - judge-ready web application; AI Operations Brief wired",
        "note": "Synthetic demonstration data — not real utility data.",
        "docs": "/docs",
    }


@app.get("/api/health", response_model=HealthResponse, tags=["meta"])
def health():
    routes = sorted({r.path for r in app.routes if r.path.startswith("/api/")})
    return {
        "status": "healthy",
        "synthetic": True,
        "phase": "6",
        "endpoints": routes,
    }