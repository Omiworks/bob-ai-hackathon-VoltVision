"""
GridGuardian AI — Phase 5: API Request/Response Schemas
=========================================================

Lightweight Pydantic models for the FastAPI layer. The API deliberately keeps
schemas readable: structured nested schemas are only used where they add real
value (request bodies + simple list/health envelopes). Large simulation and
dashboard payloads are returned as plain dicts produced by the existing
services.
"""

from typing import List

from pydantic import BaseModel, Field, field_validator


class SimulationRequest(BaseModel):
    """POST /api/simulation — one asset to simulate."""

    asset_id: str = Field(..., min_length=1, examples=["TX-104"])

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value):
        value = str(value).strip()
        if not value:
            raise ValueError("asset_id cannot be empty")
        return value


class CompareRequest(BaseModel):
    """POST /api/simulation/compare — several assets to compare."""

    asset_ids: List[str] = Field(..., min_length=1,
                                 examples=[["TX-104", "TX-233"]])

    @field_validator("asset_ids")
    @classmethod
    def clean_asset_ids(cls, value):
        cleaned = []
        for v in value:
            v = str(v).strip()
            if v and v not in cleaned:
                cleaned.append(v)
        if not cleaned:
            raise ValueError("asset_ids must contain at least one valid asset_id")
        return cleaned


class AssetSummary(BaseModel):
    """One compact row in /api/assets and /api/priority/ranking."""

    asset_id: str
    asset_type: str | None = None
    criticality: str | None = None
    failure_risk: float | None = None
    risk_category: str | None = None
    grid_impact: float | None = None
    priority_score: float | None = None
    priority_category: str | None = None
    customers_affected_estimate: int | None = None
    location: str | None = None
    age: float | None = None
    load: float | None = None
    temperature: float | None = None
    vibration: float | None = None


class AssetListResponse(BaseModel):
    """Envelope returned by filtered asset list endpoints."""

    total: int
    returned: int
    limit: int
    offset: int
    sort: str
    assets: List[AssetSummary]


class HealthResponse(BaseModel):
    status: str
    synthetic: bool
    phase: str
    endpoints: List[str]