"""
GridGuardian AI — Phase 5/6: Priority API
=========================================

Thin route over the precomputed Phase 3 ranking (assets_prioritized.csv,
served via app.services.registry) plus a Phase 6 thin wrapper over the tested
greedy crew allocation (app.services.priority.allocate_crews). Allocation
still happens in the service — this router only validates input and summarizes
output.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.schemas import AssetListResponse
from app.services import priority, registry

router = APIRouter(prefix="/api/priority", tags=["priority"])


class AllocateRequest(BaseModel):
    crews: int = Field(3, ge=0, le=50, description="Number of available crews")


@router.get("/ranking", response_model=AssetListResponse)
def priority_ranking(
    risk_category: str | None = Query(None, description="LOW/MEDIUM/HIGH/CRITICAL"),
    priority_category: str | None = Query(None, description="LOW/MEDIUM/HIGH/CRITICAL"),
    asset_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=800),
    offset: int = Query(0, ge=0),
):
    try:
        return registry.list_assets(
            risk_category=risk_category,
            priority_category=priority_category,
            asset_type=asset_type,
            limit=limit,
            offset=offset,
            sort="priority",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/allocate")
def allocate_crews(body: AllocateRequest):
    """Greedy crew allocation over the full ranked asset set.

    Returns the crews awarded to the highest-priority assets plus the
    remaining unassigned CRITICAL/HIGH assets so operators see the uncovered
    demand. Purely a wrapper over the tested service."""
    allocation = priority.allocate_crews(
        registry.combined_records(), available_crews=body.crews
    )

    def summarize(asset):
        return registry.asset_summary(asset)

    return {
        "crews_available": allocation["crews_available"],
        "assigned": [summarize(a) for a in allocation["assigned"]],
        "unassigned_high_priority": [
            summarize(a) for a in allocation["unassigned_high_priority"]
        ],
        "method": allocation["method"],
    }