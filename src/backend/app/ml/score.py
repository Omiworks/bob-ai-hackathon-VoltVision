"""
GridGuardian AI — Phase 2: Asset Scoring
========================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** Model-estimated failure probability based on synthetic demonstration
    data; not a validated real-world failure probability. ***

Loads the trained model and scores all assets, producing assets_scored.csv.
Risk categories are assigned by population percentile so the demo keeps a
stable, explainable mix: LOW = bottom 60%, MEDIUM = 60-80%, HIGH = 80-92%,
CRITICAL = top 8% of model-estimated failure probability.
"""

import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from predict import load_model, predict_batch, set_thresholds

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
ML_DIR = os.path.dirname(__file__)

# Percentile cut points (share of population per category).
CATEGORY_PERCENTILES = [("LOW", 0.60), ("MEDIUM", 0.20), ("HIGH", 0.12), ("CRITICAL", 0.08)]


def compute_category_thresholds(probabilities):
    """Return dict of probability thresholds that bucket the population into
    LOW (60%), MEDIUM (20%), HIGH (12%), CRITICAL (8%) by rank."""
    probs = pd.Series(probabilities).sort_values().values
    n = len(probs)
    low = probs[int(n * 0.60) - 1]
    medium = probs[int(n * 0.80) - 1]
    high = probs[int(n * 0.92) - 1]
    return {"LOW": float(low), "MEDIUM": float(medium), "HIGH": float(high)}


def assign_categories(probs, thresholds):
    cats = []
    for p in probs:
        if p < thresholds["LOW"]:
            cats.append("LOW")
        elif p < thresholds["MEDIUM"]:
            cats.append("MEDIUM")
        elif p < thresholds["HIGH"]:
            cats.append("HIGH")
        else:
            cats.append("CRITICAL")
    return cats


def score_all():
    print("GridGuardian AI — Phase 2: Asset Scoring")
    print("=" * 50)

    load_model()

    df = pd.read_csv(os.path.join(DATA_DIR, "assets.csv"), comment="#", encoding="utf-8")
    print(f"Loaded {len(df)} assets")

    results = predict_batch(df)
    probas = results["failure_probability"].values

    thresholds = compute_category_thresholds(probas)
    results["risk_category"] = assign_categories(probas, thresholds)

    output_df = df.copy()
    output_df["failure_probability"] = results["failure_probability"]
    output_df["failure_risk_percent"] = results["failure_risk_percent"]
    output_df["risk_category"] = results["risk_category"]

    output_path = os.path.join(DATA_DIR, "assets_scored.csv")
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        f.write("# Model-estimated failure probability based on synthetic demonstration data; not a validated real-world failure probability.\n")
        output_df.to_csv(f, index=False)
    print(f"Saved scored assets to {output_path}")

    thresholds_path = os.path.join(ML_DIR, "risk_thresholds.json")
    with open(thresholds_path, "w", encoding="utf-8") as f:
        json.dump(thresholds, f, indent=2)
    print(f"Saved risk-category thresholds to {thresholds_path}")
    set_thresholds(thresholds)

    dist = output_df["risk_category"].value_counts()
    print(f"\nRisk distribution:")
    for cat in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count = dist.get(cat, 0)
        print(f"  {cat:10s}: {count}")

    return output_df


if __name__ == "__main__":
    score_all()