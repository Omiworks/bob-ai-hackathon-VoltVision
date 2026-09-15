"""
GridGuardian AI — Phase 3: Score All Assets
===========================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** This is a synthetic demonstration system using a simplified
    network-impact model. It is not an electrical power-flow simulator
    and must not be used for real grid operational decisions. ***

Pipeline: assets_scored.csv + network.json -> grid impact -> priority
-> priority category -> rule-based explanation -> assets_prioritized.csv

Column origins:
  ML-generated values        : failure_risk (%), risk_category
  Deterministic calc'd values: grid_impact, priority_score,
                               priority_category (Phase 3 services)
  Source/synthetic values    : criticality, maintenance_days_ago,
                               previous_failures, customers_affected_estimate,
                               critical_facilities_estimate, asset_type
"""

import os
import sys

import pandas as pd

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
ML_DIR = os.path.join(BACKEND_DIR, "app", "ml")

if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

from impact import compute_grid_impact, load_network
from explanations import explain_asset
from priority import (
    allocate_crews,
    calculate_priority_score,
    classify_priority,
    compute_urgency,
    rank_assets,
    raw_priority,
)

ASSETS_SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "assets_prioritized.csv")

OUTPUT_COLUMNS = [
    "asset_id",
    "asset_type",
    "criticality",
    "failure_risk",
    "risk_category",
    "grid_impact",
    "priority_score",
    "priority_category",
    "maintenance_days_ago",
    "previous_failures",
    "customers_affected_estimate",
    "critical_facilities_estimate",
    "neighbor_count",
    "risk_factors",
    "impact_factors",
    "priority_reason",
]

DISCLAIMER = (
    "# Synthetic demonstration data - not real utility data.\n"
    "# Model-estimated failure probability, deterministic grid impact, and "
    "priority ranking.\n"
    "# This is a simplified network-impact model, not an electrical power-flow "
    "simulator.\n"
)


def build_prioritized(rows, graph, verbose=True):
    """rows: list of assets_scored rows (dict). Returns list of output dicts
    sorted by priority descending."""
    # First pass: grid impact + raw priority for every asset, so the score scale
    # is calibrated against the full population (top asset of the population = 100).
    precomputed = []
    for row in rows:
        grid_impact, _ = compute_grid_impact(row, graph)
        urgency = compute_urgency(row)
        raw = raw_priority(
            row.get("failure_probability", 0.0), grid_impact, urgency,
            str(row.get("criticality", "Medium")),
        )
        precomputed.append((row, grid_impact, urgency, raw))

    reference_max = max((p[3] for p in precomputed), default=0.0)

    results = []
    for row, grid_impact, urgency, raw in precomputed:
        priority = calculate_priority_score(
            row.get("failure_probability", 0.0), grid_impact, urgency,
            str(row.get("criticality", "Medium")), reference_max=reference_max,
        )
        priority_category = classify_priority(priority)
        graph_position = graph["graph_position"].get(row.get("asset_id", ""))

        explanation = explain_asset(
            row,
            failure_risk_percent=_num(row, "failure_risk_percent"),
            grid_impact=grid_impact,
            priority_category=priority_category,
            graph_position=graph_position,
        )

        results.append({
            "asset_id": row.get("asset_id", ""),
            "asset_type": row.get("asset_type", ""),
            "criticality": row.get("criticality", ""),
            "failure_risk": _num(row, "failure_risk_percent"),
            "risk_category": row.get("risk_category", ""),
            "grid_impact": grid_impact,
            "priority_score": priority,
            "priority_category": priority_category,
            "maintenance_days_ago": int(_num(row, "maintenance_days_ago")),
            "previous_failures": int(_num(row, "previous_failures")),
            "customers_affected_estimate": int(_num(row, "downstream_customers")),
            "critical_facilities_estimate": int(_num(row, "critical_facilities")),
            "neighbor_count": int(_num(row, "neighbor_count")),
            "risk_factors": "; ".join(explanation["risk_factors"]) or "-",
            "impact_factors": "; ".join(explanation["impact_factors"]) or "-",
            "priority_reason": explanation["priority_reason"],
        })

    ranked = rank_assets(results)
    if verbose:
        print(_sanity_report(ranked, rows, graph))
    return ranked


def _num(row, key, default=0.0):
    try:
        value = row.get(key, default)
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _sanity_report(ranked, source_rows, graph):
    """Section-9 sanity: top 10 + TX-104/TX-233 story. Pure function so it can
    be tested and reused."""
    by_id = {r["asset_id"]: r for r in ranked}
    lines = []
    lines.append("GridGuardian AI - Phase 3: Prioritization")
    lines.append("=" * 60)
    lines.append("\nTop 10 highest-priority assets:")
    lines.append(f"{'asset_id':<10}{'type':<12}{'risk%':>7}{'rcat':<9}"
                 f"{'impact':>7}{'prio':>7}  pcategory")
    for r in ranked[:10]:
        lines.append(
            f"{r['asset_id']:<10}{r['asset_type']:<12}{r['failure_risk']:>7}"
            f"{r['risk_category']:<9}{r['grid_impact']:>7}{r['priority_score']:>7}"
            f"  {r['priority_category']}"
        )
    for aid in ("TX-104", "TX-233"):
        if aid in by_id:
            r = by_id[aid]
            lines.append(f"\n{aid}: failure risk {r['failure_risk']}% "
                         f"[{r['risk_category']}], grid impact {r['grid_impact']}, "
                         f"priority {r['priority_score']} [{r['priority_category']}]")
            lines.append(f"  reason: {r['priority_reason']}")
    return "\n".join(lines)


def main():
    print(f"Loading {ASSETS_SCORED_CSV} ...")
    df = pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
    print(f"Loading {os.path.join(DATA_DIR, 'network.json')} ...")
    graph = load_network()

    rows = df.to_dict("records")
    ranked = build_prioritized(rows, graph)
    out_df = pd.DataFrame(ranked, columns=OUTPUT_COLUMNS)
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        f.write(DISCLAIMER)
        out_df.to_csv(f, index=False)
    print(f"\nSaved {OUTPUT_CSV} ({len(out_df)} rows)")

    counts = out_df["priority_category"].value_counts()
    dist = {c: int(counts.get(c, 0)) for c in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]}
    print("Priority distribution:", dist)

    # Crew-allocation demo with configurable crew count (e.g., 5 crews).
    crews = int(os.getenv("GRIDGUARDIAN_CREWS", "5"))
    allocation = allocate_crews(ranked, available_crews=crews)
    print(f"\nCrew allocation ({crews} crews, greedy):")
    for a in allocation["assigned"]:
        print(f"  -> {a['asset_id']}: {a['priority_score']} "
              f"[{a['priority_category']}]")
    print(f"  unassigned CRITICAL/HIGH: "
          f"{[a['asset_id'] for a in allocation['unassigned_high_priority']]}")


if __name__ == "__main__":
    main()