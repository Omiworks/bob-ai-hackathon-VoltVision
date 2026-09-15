"""
GridGuardian AI — Phase 4: Demo Simulation Examples
====================================================

Generates backend/data/simulation_examples.json from actual code execution.
Run: cd backend/app/services && python write_simulation_examples.py
"""

import json
import os
import sys

import pandas as pd

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
OUTPUT = os.path.join(DATA_DIR, "simulation_examples.json")

sys.path.insert(0, SERVICES_DIR)

from simulation import compare_failure_scenarios, suggest_demo_assets, simulate_asset_failure

# Demo heroes requested by the product story — included ONLY if they are
# genuinely present in the scored dataset ("if present"). No results are
# hardcoded anywhere; every number below comes from simulate_asset_failure().
PREFERRED_HEROES = ["TX-104", "TX-233"]


def main():
    print("Suggesting demo assets from data ...")
    demos = suggest_demo_assets()
    print("  picked:", demos)

    print("\nRunning individual simulations ...")
    for role, aid in demos.items():
        r = simulate_asset_failure(aid)
        print(f"  {aid} [{role}]: customers={r['estimated_customers_affected']}, "
              f"zones={len(r['affected_zones'])}, "
              f"crit_fac={r['critical_facilities_affected']}, "
              f"severity={r['severity_score']:.1f} [{r['severity']}]")

    scored_found = pd.read_csv(os.path.join(DATA_DIR, "assets_scored.csv"),
                               comment="#", encoding="utf-8")
    scored_ids = set(scored_found["asset_id"].astype(str).tolist())
    present_heroes = [a for a in PREFERRED_HEROES if a in scored_ids]

    # Resolve ids deterministically: auto-picked trio + any preferred heroes
    # that actually exist in assets.
    asset_pool = list(demos.values()) + present_heroes
    all_ids = []
    for aid in asset_pool:
        if aid not in all_ids:
            all_ids.append(aid)

    print("\nRunning scenario comparison ...")
    comparison = compare_failure_scenarios(all_ids)

    outputs = {
        "description": "Simulation examples — synthetic demonstration data only.",
        "disclaimer": ("Simplified graph-based failure-impact simulation over "
                       "synthetic demonstration data. Not a power-flow solver, "
                       "digital twin, or validated utility outage model."),
        "auto_selected": demos,
        "simulations": [],
        "comparison": comparison,
    }

    for aid in all_ids:
        outputs["simulations"].append(simulate_asset_failure(aid))
        print(f"  simulated {aid}")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(outputs, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {OUTPUT}")


if __name__ == "__main__":
    main()