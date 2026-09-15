"""
GridGuardian AI — Phase 6: AI Operations Brief API
==================================================

POST /api/ai/brief — generate an operator-facing AI Operations Brief for one
or more assets. The LLM is passed only structured facts already produced by
the Phase 2/3/4 services (never raw CSV) and is instructed never to invent or
recalculate numbers.

If no ANTHROPIC_API_KEY is configured the endpoint returns HTTP 503 with a
human-readable detail so the UI can show the exact fallback message while the
rest of the application keeps working.
"""

from fastapi import APIRouter, HTTPException

from app.api.schemas import CompareRequest
from app.services import ai_brief, registry

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/brief")
def ai_operations_brief(body: CompareRequest):
    for asset_id in body.asset_ids:
        if registry.get_asset(asset_id) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown asset: {asset_id}",
            )

    try:
        result = ai_brief.generate_ai_brief(body.asset_ids)
    except ai_brief.AIBriefUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return result