"""
GridGuardian AI — Phase 5: Assets API
======================================

Thin read-only routes over the precomputed Phase 2/3 outputs and the existing
impact/priority/explanation/simulation services. No business logic lives here;
every payload is produced by app.services.registry and the Phase 3/4 services.
"""

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import AssetListResponse
from app.services import registry
from app.services.simulation import simulate_asset_failure

router = APIRouter(prefix="/api/assets", tags=["assets"])

SUMMARY_MODEL = AssetListResponse


@router.get("", response_model=AssetListResponse)
def list_assets(
    risk_category: str | None = Query(None, description="LOW/MEDIUM/HIGH/CRITICAL"),
    priority_category: str | None = Query(None, description="LOW/MEDIUM/HIGH/CRITICAL"),
    criticality: str | None = Query(None, description="LOW/MEDIUM/HIGH"),
    asset_type: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=800),
    offset: int = Query(0, ge=0),
    sort: str | None = Query("priority"),
):
    try:
        return registry.list_assets(
            risk_category=risk_category,
            priority_category=priority_category,
            criticality=criticality,
            asset_type=asset_type,
            search=search,
            limit=limit,
            offset=offset,
            sort=sort,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _require_asset(asset_id: str):
    rec = registry.get_asset(asset_id)
    if rec is None:
        raise HTTPException(
            status_code=404,
            detail=f"Asset '{asset_id}' not found",
        )
    return rec


@router.get("/{asset_id}")
def asset_detail(asset_id: str):
    rec = _require_asset(asset_id)
    asset_view = {k: v for k, v in rec.items() if k != "failure_within_horizon"}
    return {
        "asset": asset_view,
        "risk": registry.risk_detail(asset_id),
        "impact": registry.impact_detail(asset_id),
        "priority": registry.priority_detail(asset_id),
        "explanation": registry.explanation_detail(asset_id),
    }


@router.get("/{asset_id}/risk")
def asset_risk(asset_id: str):
    _require_asset(asset_id)
    return registry.risk_detail(asset_id)


@router.get("/{asset_id}/impact")
def asset_impact(asset_id: str):
    _require_asset(asset_id)
    return registry.impact_detail(asset_id)


@router.get("/{asset_id}/priority")
def asset_priority(asset_id: str):
    _require_asset(asset_id)
    return registry.priority_detail(asset_id)


@router.get("/{asset_id}/explanation")
def asset_explanation(asset_id: str):
    _require_asset(asset_id)
    return registry.explanation_detail(asset_id)


@router.get("/{asset_id}/simulation")
def asset_simulation(asset_id: str):
    _require_asset(asset_id)
    try:
        return simulate_asset_failure(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))