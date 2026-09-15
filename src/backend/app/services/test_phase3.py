"""
GridGuardian AI — Phase 3: Priority / Impact / Allocation Test Suite
====================================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

Runs with plain Python (stdlib fallback runner), pytest-compatible:

    python test_phase3.py
    pytest test_phase3.py
"""

import os
import sys

import pandas as pd

try:
    import pytest  # noqa: F401

    HAS_PYTEST = True
except ImportError:
    HAS_PYTEST = False

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")

sys.path.insert(0, SERVICES_DIR)

import impact as impact_mod
from impact import (
    compute_grid_impact,
    criticality_score,
    customer_score,
    facility_score,
    load_network,
    network_score,
)
from explanations import explain_asset, risk_explanation
from priority import (
    MAX_RAW_REFERENCE,
    PRIORITY_THRESHOLDS,
    allocate_crews,
    calculate_priority_score,
    classify_priority,
    compute_urgency,
    rank_assets,
)

ASSETS_SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")
ASSETS_PRIORITIZED_CSV = os.path.join(DATA_DIR, "assets_prioritized.csv")


def _scored_rows():
    df = pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
    return df.to_dict("records")


def _sample_rows(n=5):
    return _scored_rows()[:n]


_SIMPLE = {
    "asset_id": "TEST-1",
    "asset_type": "feeder",
    "criticality": "Medium",
    "temperature_trend": "stable",
    "previous_failures": 0,
    "maintenance_days_ago": 100,
    "downstream_customers": 1000,
    "critical_facilities": 1,
    "neighbor_count": 2,
}


# ---------------------------------------------------------------------------
# Priority score
# ---------------------------------------------------------------------------

def test_priority_score_bounded():
    for p in (0.0, 0.003, 0.5, 0.99, 1.0):
        for imp in (0.0, 25.0, 70.0, 100.0):
            s = calculate_priority_score(p, imp)
            assert 0.0 <= s <= 100.0


def test_priority_score_zero_impact_is_zero():
    assert calculate_priority_score(0.99, 0.0) == 0.0


def test_priority_score_zero_risk_is_zero():
    assert calculate_priority_score(0.0, 90.0) == 0.0


def test_higher_failure_risk_increases_priority():
    lo = calculate_priority_score(0.5, 60.0)
    hi = calculate_priority_score(0.9, 60.0)
    assert hi > lo


def test_higher_impact_increases_priority():
    lo = calculate_priority_score(0.7, 30.0)
    hi = calculate_priority_score(0.7, 90.0)
    assert hi > lo


def test_criticality_weights_work():
    base = calculate_priority_score(0.8, 70.0, urgency=1.0, criticality="Medium")
    high = calculate_priority_score(0.8, 70.0, urgency=1.0, criticality="High")
    low = calculate_priority_score(0.8, 70.0, urgency=1.0, criticality="Low")
    assert high > base > low


def test_urgency_increases_priority():
    u1 = calculate_priority_score(0.8, 70.0, urgency=1.0)
    u2 = calculate_priority_score(0.8, 70.0, urgency=1.5)
    assert u2 > u1


# ---------------------------------------------------------------------------
# Priority categories
# ---------------------------------------------------------------------------

def test_priority_categories_cover_all_levels():
    assert classify_priority(PRIORITY_THRESHOLDS["CRITICAL"]) == "CRITICAL"
    assert classify_priority((PRIORITY_THRESHOLDS["CRITICAL"] 
                              + PRIORITY_THRESHOLDS["HIGH"]) / 2) == "HIGH"
    assert classify_priority((PRIORITY_THRESHOLDS["HIGH"] 
                              + PRIORITY_THRESHOLDS["MEDIUM"]) / 2) == "MEDIUM"
    assert classify_priority(0.0) == "LOW"


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def _ranked_fixture():
    return [
        {"asset_id": "B", "priority_score": 50.0, "priority_category": "HIGH"},
        {"asset_id": "A", "priority_score": 80.0, "priority_category": "CRITICAL"},
        {"asset_id": "C", "priority_score": 50.0, "priority_category": "MEDIUM"},
    ]


def test_rankings_deterministic_and_sorted():
    r1 = rank_assets(_ranked_fixture())
    r2 = rank_assets(_ranked_fixture())
    assert r1 == r2
    scores = [a["priority_score"] for a in r1]
    assert scores == sorted(scores, reverse=True)


def test_rank_ties_broken_by_asset_id():
    r = rank_assets(_ranked_fixture())
    ids = [a["asset_id"] for a in r]
    assert ids == ["A", "B", "C"]  # B before C because of asset_id tiebreak


def test_rank_missing_required_field_fails_clearly():
    bad = [{"asset_id": "X"}]
    try:
        rank_assets(bad)
    except KeyError as exc:
        assert "priority_score" in str(exc)
    else:
        raise AssertionError("Expected clear KeyError for missing priority_score")


# ---------------------------------------------------------------------------
# Grid impact
# ---------------------------------------------------------------------------

def test_grid_impact_bounded():
    graph = impact_mod.load_network()
    for row in _sample_rows():
        impact, parts = compute_grid_impact(row, graph)
        assert 0.0 <= impact <= 100.0


def test_grid_impact_does_not_use_failure_probability():
    graph = impact_mod.load_network()
    row = _sample_rows()[0].copy()
    baseline, _ = compute_grid_impact(row, graph)
    flipped = dict(row)
    flipped["failure_probability"] = 1.0 - row.get("failure_probability", 0.0)
    flipped["failure_risk_percent"] = 100.0 - row.get("failure_risk_percent", 0.0)
    after, _ = compute_grid_impact(flipped, graph)
    assert baseline == after  # impact ignores everything ML generated


def test_every_asset_gets_impact():
    graph = impact_mod.load_network()
    for row in _scored_rows():
        impact, _ = compute_grid_impact(row, graph)
        assert impact >= 0.0


def test_tx233_high_impact_tx104_substantial():
    rows = {r["asset_id"]: r for r in _scored_rows()}
    graph = impact_mod.load_network()
    impact_233, _ = compute_grid_impact(rows["TX-233"], graph)
    impact_104, _ = compute_grid_impact(rows["TX-104"], graph)
    assert impact_233 > impact_104          # TX-233: biggest downstream footprint
    assert impact_104 >= 50.0               # TX-104: meaningful impact
    assert impact_233 >= 60.0


def test_in_graph_assets_get_network_credit():
    graph = impact_mod.load_network()
    tx233 = next(r for r in _scored_rows() if r["asset_id"] == "TX-233")
    assert network_score(tx233, graph) >= 50


def test_out_of_graph_asset_does_not_crash():
    graph = impact_mod.load_network()
    row = dict(_SIMPLE, asset_id="NOT-IN-GRAPH-99", neighbor_count=3)
    impact, parts = compute_grid_impact(row, graph)
    assert 0.0 <= impact <= 100.0
    assert parts["network"] <= impact_mod.NON_GRAPH_NETWORK_CAP


# ---------------------------------------------------------------------------
# Crew allocation
# ---------------------------------------------------------------------------

def test_crews_respected():
    ranked = _ranked_fixture()
    out = allocate_crews(ranked, available_crews=2)
    assert len(out["assigned"]) == 2
    assert out["assigned"][0]["asset_id"] == "A"
    assert out["assigned"][1]["asset_id"] == "B"
    assert out["unassigned_high_priority"] == []


def test_zero_crews_does_not_crash():
    ranked = _ranked_fixture()
    out = allocate_crews(ranked, available_crews=0)
    assert out["assigned"] == []
    assert len(out["unassigned_high_priority"]) == 2  # A and B


def test_empty_input_does_not_crash():
    assert rank_assets([]) == []
    out = allocate_crews([], available_crews=3)
    assert out["assigned"] == []
    assert out["unassigned_high_priority"] == []


# ---------------------------------------------------------------------------
# Explanations
# ---------------------------------------------------------------------------

def test_explanation_from_rules_not_hardcoded():
    risky = dict(_SIMPLE, temperature=70.0, vibration=5.5, age_years=40.0,
                 previous_failures=2)
    factors = risk_explanation(risky, failure_risk_percent=95.0)
    assert "High vibration" in factors
    assert "Elevated temperature" in factors
    assert "Older equipment" in factors
    assert "Prior failures recorded" in factors
    assert "Very high model failure risk" in factors


def test_explanation_text_no_asset_id():
    expl = explain_asset(dict(_SIMPLE, asset_id="ANY-ID"),
                         failure_risk_percent=95.0, grid_impact=80.0,
                         priority_category="CRITICAL")
    assert "ANY-ID" not in expl["priority_reason"]  # reason is rule-based
    assert expl["asset_id"] == "ANY-ID"


# ---------------------------------------------------------------------------
# No hardcoded asset IDs in scoring logic
# ---------------------------------------------------------------------------

def test_no_asset_ids_hardcoded_in_scoring_logic():
    for fname in ("impact.py", "priority.py", "explanations.py"):
        src = open(os.path.join(SERVICES_DIR, fname), encoding="utf-8").read()
        assert "TX-104" not in src, f"{fname} hardcodes TX-104"
        assert "TX-233" not in src, f"{fname} hardcodes TX-233"


# ---------------------------------------------------------------------------
# Full-population output
# ---------------------------------------------------------------------------

def test_all_assets_get_priority_output():
    assert os.path.exists(ASSETS_PRIORITIZED_CSV)
    df = pd.read_csv(ASSETS_PRIORITIZED_CSV, comment="#", encoding="utf-8")
    assert len(df) == 800
    assert "priority_score" in df.columns
    assert "priority_category" in df.columns
    assert "grid_impact" in df.columns


def test_tx104_and_tx233_sensible():
    df = pd.read_csv(ASSETS_PRIORITIZED_CSV, comment="#", encoding="utf-8")
    tx104 = df[df.asset_id == "TX-104"].iloc[0]
    tx233 = df[df.asset_id == "TX-233"].iloc[0]
    assert tx104.failure_risk >= 90            # very high model failure risk
    assert tx104.grid_impact >= 50             # meaningful grid impact
    assert tx104.priority_category in ("HIGH", "CRITICAL")
    assert tx233.failure_risk <= 10            # very low failure risk
    assert tx233.grid_impact >= 60             # very high impact
    assert tx233.priority_category == "LOW"    # impact alone does not top it
    assert tx233.priority_score < tx104.priority_score


def test_repeated_execution_identical():
    df = pd.read_csv(ASSETS_PRIORITIZED_CSV, comment="#", encoding="utf-8")
    with open(ASSETS_PRIORITIZED_CSV, "rb") as f:
        first = f.read()
    import subprocess
    subprocess.run([sys.executable, "score_priority.py"], cwd=SERVICES_DIR,
                   check=True, capture_output=True, timeout=240)
    with open(ASSETS_PRIORITIZED_CSV, "rb") as f:
        second = f.read()
    assert first == second


def test_source_csv_not_modified():
    assert os.path.exists(ASSETS_SCORED_CSV)
    df = pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
    assert "grid_impact" not in df.columns
    assert "priority_score" not in df.columns


def test_priority_distribution_reasonable():
    df = pd.read_csv(ASSETS_PRIORITIZED_CSV, comment="#", encoding="utf-8")
    cats = df["priority_category"].value_counts().to_dict()
    assert cats.get("LOW", 0) > 400          # majority healthy
    assert cats.get("CRITICAL", 0) >= 5
    assert cats.get("HIGH", 0) >= 10


# ---------------------------------------------------------------------------
# Fallback runner
# ---------------------------------------------------------------------------

def _all_tests():
    return sorted(
        name for name, obj in globals().items()
        if name.startswith("test_") and callable(obj)
    )


def run_all():
    passed, failed = [], []
    for name in _all_tests():
        try:
            globals()[name]()
        except Exception as exc:  # noqa: BLE001
            failed.append((name, exc))
            print(f"  FAIL  {name}: {type(exc).__name__}: {exc}")
        else:
            passed.append(name)
            print(f"  PASS  {name}")
    print(f"\nResults: {len(passed)} passed, {len(failed)} failed "
          f"(of {len(passed) + len(failed)} tests)")
    for name, exc in failed:
        print(f"  - {name}: {exc}")
    return 1 if failed else 0


if __name__ == "__main__":
    print("GridGuardian AI — Phase 3 Test Suite")
    print("=" * 55)
    sys.exit(run_all())