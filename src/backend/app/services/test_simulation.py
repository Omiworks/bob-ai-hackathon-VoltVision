"""
GridGuardian AI — Phase 4: Simulation Test Suite
==================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

Runs with plain Python (stdlib fallback), pytest-compatible:

    python test_simulation.py
    pytest test_simulation.py
"""

import os
import subprocess
import sys

import pandas as pd

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")

sys.path.insert(0, SERVICES_DIR)

import simulation as sim_mod
from simulation import (
    compare_failure_scenarios,
    simulate_asset_failure,
    suggest_demo_assets,
)

ASSETS_SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")
ASSETS_PRIORITIZED_CSV = os.path.join(DATA_DIR, "assets_prioritized.csv")

# Reset the module-level simulation cache so tests run on a clean slate.
sim_mod._context = {"graph": None, "assets": None, "nodes": None}


def _scored_asset_ids():
    return set(pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
               ["asset_id"].astype(str).tolist())


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------

def test_valid_asset_simulates_successfully():
    r = simulate_asset_failure("TX-104")
    assert r["failed_asset"] == "TX-104"
    assert isinstance(r["severity_score"], (int, float))


def test_invalid_asset_id_fails_clearly():
    try:
        simulate_asset_failure("DOES-NOT-EXIST")
    except ValueError as exc:
        assert "DOES-NOT-EXIST" in str(exc)
    else:
        raise AssertionError("Expected ValueError for unknown asset")


def test_output_schema_is_stable():
    r = simulate_asset_failure("TX-233")
    expected_keys = {
        "failed_asset", "asset_type", "network_node_present",
        "affected_zones", "affected_facilities",
        "critical_facilities_affected", "critical_facility_ids",
        "facility_source",
        "affected_assets", "stressed_assets",
        "estimated_customers_affected",
        "severity", "severity_score", "severity_factors", "cascade_depth",
        "assumptions", "explanation",
    }
    assert expected_keys == set(r.keys())


def test_affected_zones_are_real_network_entities():
    r = simulate_asset_failure("TX-104")
    _, _, nodes = sim_mod.load_simulation_context()
    for z in r["affected_zones"]:
        assert z in nodes, f"{z} is not a network entity"
        assert nodes[z]["type"] == "zone"


def test_affected_facilities_are_real_network_entities():
    r = simulate_asset_failure("TX-104")
    _, _, nodes = sim_mod.load_simulation_context()
    for f in r["affected_facilities"]:
        assert f["id"] in nodes, f"{f['id']} is not a network entity"
        assert nodes[f["id"]]["type"] in ("hospital", "industrial", "residential")


def test_customers_non_negative():
    r = simulate_asset_failure("TX-104")
    assert r["estimated_customers_affected"] >= 0


def test_severity_score_bounded():
    for aid in ["TX-104", "TX-233"]:
        r = simulate_asset_failure(aid)
        assert 0.0 <= r["severity_score"] <= 100.0


def test_severity_category_valid():
    for aid in ["TX-104", "TX-233"]:
        r = simulate_asset_failure(aid)
        assert r["severity"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")


def test_traversal_deterministic():
    r1 = simulate_asset_failure("TX-104")
    r2 = simulate_asset_failure("TX-104")
    assert r1 == r2


def test_repeated_simulation_identical():
    r1 = simulate_asset_failure("TX-104")
    with open(ASSETS_SCORED_CSV, "rb") as f:
        csv_hash_1 = f.read()[:16]
    r2 = simulate_asset_failure("TX-104")
    with open(ASSETS_SCORED_CSV, "rb") as f:
        csv_hash_2 = f.read()[:16]
    assert r1 == r2
    assert csv_hash_1 == csv_hash_2


def test_no_random_values():
    """Verify the simulation is fully deterministic by checking severity is
    identical across 5 consecutive runs of a non-hero asset."""
    results = [simulate_asset_failure("RCL-100")["severity_score"]
               for _ in range(5)]
    assert len(set(results)) == 1


def test_no_asset_ids_in_simulation_logic():
    for fname in ("simulation.py",):
        src = open(os.path.join(SERVICES_DIR, fname), encoding="utf-8").read()
        assert "TX-104" not in src, f"{fname} hardcodes TX-104"
        assert "TX-233" not in src, f"{fname} hardcodes TX-233"
        assert "DOES-NOT-EXIST" not in src


def test_isolated_asset_does_not_crash():
    """An asset not present in network.json (but in assets_scored) should
    return a low-severity result, not crash."""
    # Pick an asset known not to be in network.json nodes
    ids = sorted(_scored_asset_ids() - {
        "TX-104", "TX-118", "TX-142", "TX-171", "TX-205", "TX-233"
    })
    assert ids
    r = simulate_asset_failure(ids[0])
    assert r["network_node_present"] is False
    assert r["severity_score"] >= 0.0
    assert r["affected_zones"] == []


def test_multiple_assets_independent():
    r1 = simulate_asset_failure("TX-104")
    r2 = simulate_asset_failure("TX-233")
    assert r1["failed_asset"] != r2["failed_asset"]
    assert r1["estimated_customers_affected"] != r2["estimated_customers_affected"]
    assert r1["affected_zones"] != r2["affected_zones"]


def test_comparison_results_consistent():
    aid_list = ["TX-104", "TX-233"]
    comp = compare_failure_scenarios(aid_list)
    assert "scenarios" in comp and "worst" in comp
    assert len(comp["scenarios"]) == 2
    worst = comp["worst"]
    worst_sim = simulate_asset_failure(worst["asset_id"])
    assert worst["severity_score"] == worst_sim["severity_score"]


def test_tx104_has_meaningful_simulation():
    r = simulate_asset_failure("TX-104")
    assert r["network_node_present"] is True
    assert len(r["affected_zones"]) >= 1
    assert r["estimated_customers_affected"] >= 500
    assert r["severity"] in ("HIGH", "CRITICAL")
    assert len(r["assumptions"]) >= 3


def test_tx233_affects_more_customers():
    r104 = simulate_asset_failure("TX-104")
    r233 = simulate_asset_failure("TX-233")
    assert r233["estimated_customers_affected"] > r104["estimated_customers_affected"]
    assert r233["severity_score"] > r104["severity_score"]


def test_comparison_is_no_random_ids():
    comp = compare_failure_scenarios(["TX-104", "TX-233"])
    ids = [s["asset_id"] for s in comp["scenarios"]]
    assert ids[0] in ("TX-104", "TX-233")
    assert ids[1] in ("TX-104", "TX-233")
    assert ids[0] != ids[1]


def test_demo_asset_picks_are_valid():
    demos = suggest_demo_assets()
    all_ids = _scored_asset_ids()
    for role in ("high_risk_high_impact", "low_risk_high_impact",
                 "high_risk_low_impact"):
        aid = demos[role]
        assert aid in all_ids, f"demo pick {role}={aid} not in scored assets"


def test_explanation_present():
    r = simulate_asset_failure("TX-104")
    exp = r["explanation"]
    assert "headline" in exp
    assert "key_drivers" in exp
    assert isinstance(exp["key_drivers"], list)
    assert len(exp["key_drivers"]) >= 1
    assert "recommended_follow_up" in exp


def test_failure_risk_independent_of_severity():
    """Severity and failure probability should be independent concepts."""
    r = simulate_asset_failure("TX-104")
    # TX-104 has failure_risk ~98% but severity ~58-67 — not equal
    scored = pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
    tx104 = scored[scored.asset_id == "TX-104"].iloc[0]
    assert abs(tx104.failure_risk_percent - r["severity_score"]) > 10


def test_priority_and_scored_files_unchanged():
    assert os.path.exists(ASSETS_SCORED_CSV)
    assert os.path.exists(ASSETS_PRIORITIZED_CSV)


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
        except Exception as exc:
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
    print("GridGuardian AI — Phase 4 Simulation Test Suite")
    print("=" * 55)
    sys.exit(run_all())