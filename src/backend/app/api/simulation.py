"""
GridGuardian AI — Phase 5: Simulation API
==========================================

Thin wrapper around the Phase 4 simulation service
(app.services.simulation.simulate_asset_failure / compare_failure_scenarios).
No simulation logic is duplicated here — the API only validates input and maps
errors to HTTP status codes.
"""

from fastapi import APIRouter, HTTPException

from app.api.schemas import CompareRequest, SimulationRequest
from app.services import registry
from app.services.simulation import (
    compare_failure_scenarios,
    simulate_asset_failure,
    suggest_demo_assets,
)

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


def _not_found(exc):
    return HTTPException(status_code=404, detail=str(exc))


@router.get("/demo")
def demo_scenarios():
    """The three automatically-picked demo scenarios plus labels, so the UI can
    offer one-click curated comparisons. Pure wrapper over the tested
    suggest_demo_assets service — nothing hardcoded here."""
    picks = suggest_demo_assets()
    return {
        "picks": [
            {
                "role": "high_risk_high_impact",
                "label": "High risk × high impact",
                "asset_id": picks["high_risk_high_impact"],
            },
            {
                "role": "low_risk_high_impact",
                "label": "Low risk × high impact",
                "asset_id": picks["low_risk_high_impact"],
            },
            {
                "role": "high_risk_low_impact",
                "label": "High risk × low impact",
                "asset_id": picks["high_risk_low_impact"],
            },
        ]
    }


@router.post("")
def run_simulation(body: SimulationRequest):
    try:
        result = simulate_asset_failure(body.asset_id)
    except ValueError as exc:
        raise _not_found(exc)
    return {"asset_id": body.asset_id, "simulation": result}


@router.post("/compare")
def compare_simulations(body: CompareRequest):
    for aid in body.asset_ids:
        if registry.get_asset(aid) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Asset '{aid}' not found",
            )
    result = compare_failure_scenarios(body.asset_ids)
    return {"asset_ids": body.asset_ids, "result": result}