"""
GridGuardian AI — Phase 5: Dashboard Summary API
================================================

One composite payload for the frontend dashboard, assembled from real
precomputed data via app.services.registry. No values are hardcoded here.
"""

from fastapi import APIRouter, Query

from app.services import registry

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(alerts_limit: int = Query(10, ge=0, le=60)):
    return registry.dashboard_summary(alerts_limit=alerts_limit)