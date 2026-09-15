"""
GridGuardian AI — Phase 5: Alerts API
======================================

Read-only route over the actual alerts.csv records (Phase 1 generator output).
Alerts are never invented here — only real stored records are returned.
"""

from fastapi import APIRouter, Query

from app.services import registry

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    limit: int = Query(50, ge=1, le=100),
    severity: str | None = Query(None),
    substation: str | None = Query(None),
    asset_id: str | None = Query(None),
):
    return {
        "total_available": len(registry.list_alerts(limit=100)),
        "alerts": registry.list_alerts(
            limit=limit, severity=severity, substation=substation, asset_id=asset_id
        ),
    }