"""
GridGuardian AI — Model & Data API
===================================

Read-only route exposing the trained model's input features and their recorded
importance (from the persisted metrics.json / feature_importances.json). Used
by the MODEL & DATA page. No model logic lives here.
"""

from fastapi import APIRouter

from app.services import registry

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("/features")
def model_features():
    return registry.model_features()