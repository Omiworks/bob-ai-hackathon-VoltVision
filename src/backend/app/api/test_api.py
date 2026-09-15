"""
GridGuardian AI — Phase 5: API Test Suite
===========================================

Tests the FastAPI adapter in-process with the TestClient (httpx). Covers:
health, dashboard summary, asset list + filters, asset detail, risk/impact/
priority/explanation endpoints, valid/invalid simulation, simulation compare,
priority ranking, crew allocation, alerts, AI operations brief (graceful
failure + mocked success), response structure, and CORS.

Runnable two ways (same suite):
    python test_api.py
    python -m pytest test_api.py -q
"""

from types import FunctionType as _FnType
import os
import sys

# --- path bootstrap for the stdlib runner --------------------------------
BACKEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import registry  # noqa: E402

client = TestClient(app)

VALID_ASSET = "TX-104"
VALID_ASSET_2 = "TX-233"

PASSED = []
FAILED = []


def run(test_fn):
    name = test_fn.__name__
    try:
        test_fn()
    except Exception as exc:  # noqa: BLE001
        FAILED.append((name, exc))
        print(f"  FAIL  {name}: {exc}")
    else:
        PASSED.append(name)
        print(f"  PASS  {name}")


# --- endpoint tests ------------------------------------------------------

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["synthetic"] is True
    assert "/api/health" in body["endpoints"]


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_summary_structure():
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["assets"]["total"] == 800
    for view in ("risk", "priority"):
        assert set(body[view]) == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        assert sum(body[view].values()) == 800
    assert body["critical_high_priority"]["count"] > 0
    for key in ("highest_risk", "highest_impact", "top_priority"):
        assert body[key]["asset_id"]
    assert body["model"]["synthetic"] is True
    assert body["model"]["algorithm"].startswith("GradientBoosting")
    assert body["model"]["roc_auc"] > 0.8
    assert body["synthetic_data"]["synthetic"] is True
    assert len(body["alerts"]) > 0
    assert body["customers"]["total_estimated_footprint"] > 0


def test_asset_list_default():
    r = client.get("/api/assets")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 800
    assert body["returned"] == 50
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["sort"] == "priority"
    scores = [a["priority_score"] for a in body["assets"]]
    assert scores == sorted(scores, reverse=True)
    first = body["assets"][0]
    for key in ("asset_id", "asset_type", "failure_risk", "risk_category",
                "grid_impact", "priority_score", "priority_category",
                "criticality", "customers_affected_estimate"):
        assert key in first


def test_asset_list_limit_offset():
    r = client.get("/api/assets", params={"limit": 3, "offset": 5})
    body = r.json()
    assert body["returned"] == 3
    assert body["offset"] == 5
    assert len(body["assets"]) == 3


def test_asset_list_risk_filter():
    r = client.get("/api/assets", params={"risk_category": "CRITICAL", "limit": 500})
    body = r.json()
    assert 0 < body["total"] < 800
    assert all(a["risk_category"] == "CRITICAL" for a in body["assets"])


def test_asset_list_priority_filter():
    r = client.get("/api/assets", params={"priority_category": "CRITICAL", "limit": 100})
    body = r.json()
    assert body["total"] > 0
    assert all(a["priority_category"] == "CRITICAL" for a in body["assets"])


def test_asset_list_criticality_filter():
    r = client.get("/api/assets", params={"criticality": "HIGH", "limit": 200})
    body = r.json()
    assert body["total"] > 0
    assert all(str(a["criticality"]).strip().capitalize() == "High" for a in body["assets"])
    bad = client.get("/api/assets", params={"criticality": "NUCLEAR"})
    assert bad.status_code == 400


def test_asset_list_summary_includes_condition_fields():
    r = client.get("/api/assets", params={"limit": 5})
    first = r.json()["assets"][0]
    for field in ("age", "load", "temperature", "vibration"):
        assert field in first


def test_model_features_endpoint():
    r = client.get("/api/model/features")
    body = r.json()
    assert r.status_code == 200
    assert len(body["features"]) == 21
    assert body["importances"] and isinstance(body["importances"], dict)


def test_asset_list_asset_type_filter():
    r = client.get("/api/assets", params={"asset_type": "transformer", "limit": 200})
    body = r.json()
    assert body["total"] > 0
    assert all(a["asset_type"] == "transformer" for a in body["assets"])


def test_asset_list_search():
    r = client.get("/api/assets", params={"search": "TX-104", "limit": 10})
    body = r.json()
    assert any(a["asset_id"] == "TX-104" for a in body["assets"])


def test_asset_list_sort_options():
    for sort_key, field in (("risk", "failure_risk"), ("impact", "grid_impact")):
        r = client.get("/api/assets", params={"sort": sort_key, "limit": 50})
        body = r.json()
        pairs = [(a[field], a["asset_id"]) for a in body["assets"]]
        assert pairs == sorted(pairs, key=lambda t: (-t[0], t[1]))


def test_asset_list_invalid_filter_is_400():
    r = client.get("/api/assets", params={"risk_category": "BANANA"})
    assert r.status_code == 400


def test_asset_list_invalid_sort_is_400():
    r = client.get("/api/assets", params={"sort": "banana"})
    assert r.status_code == 400


def test_asset_detail_combined():
    r = client.get(f"/api/assets/{VALID_ASSET}")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"asset", "risk", "impact", "priority", "explanation"}
    assert body["asset"]["asset_id"] == VALID_ASSET
    assert body["risk"]["asset_id"] == VALID_ASSET
    assert body["impact"]["grid_impact"] == body["priority"]["grid_impact"]
    assert body["priority"]["priority_reason"]
    assert "failure_within_horizon" not in body["asset"]
    assert isinstance(body["explanation"]["risk_factors"], list)


def test_asset_detail_unknown_is_404():
    r = client.get("/api/assets/DOES-NOT-EXIST")
    assert r.status_code == 404
    detail = r.json()["detail"]
    assert "not found" in detail.lower()
    assert "Traceback" not in detail


def test_asset_risk_endpoint():
    r = client.get(f"/api/assets/{VALID_ASSET}/risk")
    assert r.status_code == 200
    body = r.json()
    assert body["failure_probability"] == 0.9832
    assert body["failure_risk_percent"] == 98.32
    assert body["risk_category"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")


def test_asset_impact_endpoint():
    r = client.get(f"/api/assets/{VALID_ASSET}/impact")
    assert r.status_code == 200
    body = r.json()
    assert body["grid_impact"] > 0
    assert set(body["components"]) == {"customer", "facility", "criticality", "network"}


def test_asset_priority_endpoint():
    r = client.get(f"/api/assets/{VALID_ASSET}/priority")
    assert r.status_code == 200
    body = r.json()
    assert body["asset_id"] == VALID_ASSET
    assert 0 <= body["priority_score"] <= 100
    assert body["urgency"] >= 1.0


def test_asset_explanation_endpoint():
    r = client.get(f"/api/assets/{VALID_ASSET}/explanation")
    assert r.status_code == 200
    body = r.json()
    assert body["priority_reason"]
    assert isinstance(body["risk_factors"], list)


def test_asset_simulation_get():
    r = client.get(f"/api/assets/{VALID_ASSET}/simulation")
    assert r.status_code == 200
    body = r.json()
    assert body["failed_asset"] == VALID_ASSET
    assert body["severity"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert 0 <= body["severity_score"] <= 100
    assert "assumptions" in body
    assert "explanation" in body


def test_asset_simulation_unknown_is_404():
    r = client.get("/api/assets/DOES-NOT-EXIST/simulation")
    assert r.status_code == 404


def test_simulation_post_valid():
    r = client.post("/api/simulation", json={"asset_id": VALID_ASSET})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_id"] == VALID_ASSET
    assert body["simulation"]["failed_asset"] == VALID_ASSET


def test_simulation_post_unknown_is_404():
    r = client.post("/api/simulation", json={"asset_id": "NOPE-999"})
    assert r.status_code == 404


def test_simulation_post_missing_field_is_422():
    r = client.post("/api/simulation", json={})
    assert r.status_code == 422


def test_simulation_compare():
    r = client.post("/api/simulation/compare",
                    json={"asset_ids": [VALID_ASSET, VALID_ASSET_2]})
    assert r.status_code == 200
    body = r.json()
    assert set(body["asset_ids"]) == {VALID_ASSET, VALID_ASSET_2}
    result = body["result"]
    assert len(result["scenarios"]) == 2
    scores = [s["severity_score"] for s in result["scenarios"]]
    assert scores == sorted(scores, reverse=True)
    assert result["worst"]["asset_id"] == max(s["asset_id"] for s in result["scenarios"])


def test_simulation_compare_unknown_is_404():
    r = client.post("/api/simulation/compare",
                    json={"asset_ids": [VALID_ASSET, "GHOST"]})
    assert r.status_code == 404


def test_simulation_compare_empty_is_422():
    r = client.post("/api/simulation/compare", json={"asset_ids": []})
    assert r.status_code == 422


def test_simulation_demo_scenarios():
    r = client.get("/api/simulation/demo")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["picks"]) == 3
    roles = {p["role"] for p in body["picks"]}
    assert roles == {"high_risk_high_impact", "low_risk_high_impact",
                     "high_risk_low_impact"}
    for p in body["picks"]:
        assert registry.get_asset(p["asset_id"]) is not None


def test_priority_ranking():
    r = client.get("/api/priority/ranking", params={"limit": 20})
    assert r.status_code == 200
    body = r.json()
    assert body["sort"] == "priority"
    assert body["returned"] == 20
    scores = [a["priority_score"] for a in body["assets"]]
    assert scores == sorted(scores, reverse=True)
    assert body["assets"][0]["priority_category"] == "CRITICAL"


def test_priority_ranking_filters():
    r = client.get("/api/priority/ranking",
                   params={"priority_category": "HIGH", "limit": 100})
    body = r.json()
    assert body["total"] == 59
    assert all(a["priority_category"] == "HIGH" for a in body["assets"])


def test_alerts():
    r = client.get("/api/alerts")
    assert r.status_code == 200
    body = r.json()
    assert body["total_available"] == 60
    assert len(body["alerts"]) == 50
    first = body["alerts"][0]
    for key in ("alert_id", "asset_id", "severity", "title", "timestamp"):
        assert key in first


def test_alerts_filters():
    r = client.get("/api/alerts", params={"severity": "critical"})
    body = r.json()
    assert body["alerts"]
    assert all(a["severity"].lower() == "critical" for a in body["alerts"])


def test_cors_headers():
    r = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_not_found_has_no_traceback():
    r = client.get("/api/assets/NOPE-123")
    assert r.status_code == 404
    assert "Traceback" not in r.text


# --- Phase 6: priority allocation -----------------------------------------

def test_priority_allocate_crews_respected():
    r = client.post("/api/priority/allocate", json={"crews": 3})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["crews_available"] == 3
    assert len(body["assigned"]) == 3
    scores = [a["priority_score"] for a in body["assigned"]]
    assert all(isinstance(s, (int, float)) for s in scores)
    assert all(a["priority_category"] in ("CRITICAL", "HIGH")
               for a in body["assigned"])
    assert scores == sorted(scores, reverse=True)
    assert "unassigned_high_priority" in body


def test_priority_allocate_zero_crews():
    r = client.post("/api/priority/allocate", json={"crews": 0})
    assert r.status_code == 200
    body = r.json()
    assert body["crews_available"] == 0
    assert body["assigned"] == []
    assert body["unassigned_high_priority"]  # demand exists, none served


def test_priority_allocate_invalid_crews_rejected():
    r = client.post("/api/priority/allocate", json={"crews": -1})
    assert r.status_code == 422


# --- Phase 6: AI operations brief -----------------------------------------

def test_ai_brief_unknown_asset_is_404():
    r = client.post("/api/ai/brief", json={"asset_ids": ["NOPE-123"]})
    assert r.status_code == 404
    assert "Unknown asset" in r.json()["detail"]


def test_ai_brief_without_key_fails_gracefully():
    import app.services.ai_brief as ai_brief_mod

    saved = os.environ.get("ANTHROPIC_API_KEY")
    os.environ.pop("ANTHROPIC_API_KEY", None)
    try:
        r = client.post("/api/ai/brief", json={"asset_ids": [VALID_ASSET]})
    finally:
        if saved:
            os.environ["ANTHROPIC_API_KEY"] = saved
    assert r.status_code == 503, r.text
    assert "AI brief unavailable" in r.json()["detail"]


def test_ai_brief_with_configured_key_returns_brief():
    import app.services.ai_brief as ai_brief_mod

    saved_key = os.environ.get("ANTHROPIC_API_KEY")
    saved_has_key = ai_brief_mod.has_key
    saved_llm = ai_brief_mod._call_llm
    try:
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        ai_brief_mod.has_key = lambda: True
        ai_brief_mod._call_llm = lambda system, user: (
            "## Situation\nSynthetic test scenario.\n"
            "## Recommended actions\n- Immediate action: dispatch crew."
        )
        r = client.post("/api/ai/brief", json={"asset_ids": [VALID_ASSET]})
    finally:
        ai_brief_mod.has_key = saved_has_key
        ai_brief_mod._call_llm = saved_llm
        if saved_key:
            os.environ["ANTHROPIC_API_KEY"] = saved_key
        else:
            os.environ.pop("ANTHROPIC_API_KEY", None)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["generated"] is True
    assert "## Recommended actions" in body["brief"]
    assert body["facts"][0]["asset_id"] == VALID_ASSET
    assert body["facts"][0]["failure_risk_percent"] is not None


# --- runner --------------------------------------------------------------

def main():
    title = "GridGuardian AI — Phase 5 API Test Suite"
    print(title)
    print("=" * len(title))
    for value in globals().values():
        if isinstance(value, _FnType) and value.__name__.startswith("test_"):
            run(value)
    print()
    print(f"Results: {len(PASSED)} passed, {len(FAILED)} failed "
          f"(of {len(PASSED) + len(FAILED)} tests)")
    if FAILED:
        sys.exit(1)


if __name__ == "__main__":
    main()