"""
GridGuardian AI — Phase 2: Prediction Test Suite
================================================

Validates the Phase 2 model and prediction pipeline.

Runs with plain Python (no third-party test runner needed):

    python test_predict.py

It is also pytest-compatible:

    pytest test_predict.py

Every test function ends in `test_*` and uses standard `assert` statements so
both runners behave identically.
"""

import json
import math
import os
import subprocess
import sys

import numpy as np
import pandas as pd

try:
    import pytest  # noqa: F401

    HAS_PYTEST = True
except ImportError:
    HAS_PYTEST = False

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = TEST_DIR
DATA_DIR = os.path.abspath(os.path.join(ML_DIR, "..", "..", "data"))

sys.path.insert(0, ML_DIR)

import predict as predict_mod
from predict import (
    assign_risk_category,
    load_model,
    load_thresholds,
    predict_asset,
    predict_batch,
)

ASSETS_CSV = os.path.join(DATA_DIR, "assets.csv")
ASSETS_SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")
MODEL_PKL = os.path.join(ML_DIR, "model.pkl")
METRICS_JSON = os.path.join(ML_DIR, "metrics.json")


def _load_assets():
    return pd.read_csv(ASSETS_CSV, comment="#", encoding="utf-8")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_model_loads():
    pipeline, meta = load_model(MODEL_PKL)
    assert pipeline is not None
    assert meta is not None
    assert len(meta["feature_columns"]) > 0
    assert meta["target"] == "failure_within_horizon"


def test_model_loads_in_fresh_process():
    code = (
        "import sys; sys.path.insert(0, r'%s'); "
        "from predict import load_model, get_meta; "
        "p, m = load_model(); "
        "assert p is not None and len(m['feature_columns']) == %d; "
        "print('FRESH_PROCESS_OK')"
    ) % (ML_DIR, len(load_model()[1]["feature_columns"]))
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr
    assert "FRESH_PROCESS_OK" in result.stdout


def test_single_asset_prediction():
    df = _load_assets()
    row = df.iloc[0].to_dict()
    out = predict_asset(row)
    assert out["asset_id"] == row["asset_id"]
    assert isinstance(out["failure_probability"], float)
    assert 0.0 <= out["failure_probability"] <= 1.0
    assert out["risk_category"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_batch_prediction():
    df = _load_assets()
    out = predict_batch(df)
    assert len(out) == len(df)
    assert set(out.columns) == {
        "asset_id", "asset_type", "failure_probability",
        "failure_risk_percent", "prediction",
    }


def test_every_asset_gets_prediction():
    df = _load_assets()
    out = predict_batch(df)
    missing = df["asset_id"].tolist() != out["asset_id"].tolist()
    assert not missing
    assert out["failure_probability"].notna().all()


def test_probabilities_in_range():
    df = _load_assets()
    out = predict_batch(df)
    p = out["failure_probability"]
    assert (p >= 0.0).all() and (p <= 1.0).all()


def test_no_nan_or_inf():
    df = _load_assets()
    out = predict_batch(df)
    assert np.isfinite(out["failure_probability"]).all()
    assert np.isfinite(out["failure_risk_percent"]).all()


def test_missing_required_feature_fails_clearly():
    df = _load_assets()
    row = df.iloc[0].to_dict()
    missing_key = predict_mod.get_meta()["feature_columns"][0]
    bad_row = {k: v for k, v in row.items() if k != missing_key}
    try:
        predict_asset(bad_row)
    except KeyError as exc:
        assert missing_key in str(exc)
    else:
        raise AssertionError(
            f"Expected a clear KeyError when '{missing_key}' is missing"
        )


def test_invalid_input_fails_clearly():
    df = _load_assets()
    row = df.iloc[0].to_dict()
    bad_row = dict(row)
    bad_row["temperature"] = "not-a-number"
    try:
        predict_asset(bad_row)
    except (TypeError, ValueError, KeyError):
        pass
    else:
        raise AssertionError("Expected an error for non-numeric input")


def test_risk_category_mapping():
    thresholds = load_thresholds()
    low = assign_risk_category(thresholds["LOW"] - 0.001, thresholds)
    medium = assign_risk_category((thresholds["LOW"] + thresholds["MEDIUM"]) / 2.0, thresholds)
    high = assign_risk_category((thresholds["MEDIUM"] + thresholds["HIGH"]) / 2.0, thresholds)
    critical = assign_risk_category(thresholds["HIGH"] + 0.001, thresholds)
    assert low == "LOW"
    assert medium == "MEDIUM"
    assert high == "HIGH"
    assert critical == "CRITICAL"


def test_feature_count_and_order_consistent():
    meta = load_model()[1]
    expected_features = meta["feature_columns"]
    expected_count = len(expected_features)

    metrics = json.load(open(METRICS_JSON, encoding="utf-8"))
    assert metrics["features"] == expected_features

    model = load_model()[0]
    pre = model.named_steps["preprocessor"]
    num_features = pre.transformers_[0][2]
    cat_features = pre.transformers_[1][2]
    assert num_features == meta["numeric_features"]
    assert cat_features == meta["categorical_features"]
    assert len(num_features) + len(cat_features) == expected_count

    df = _load_assets()
    assert set(expected_features).issubset(set(df.columns))
    assert "failure_within_horizon" not in expected_features
    assert "asset_id" not in expected_features


def test_no_target_leakage():
    meta = load_model()[1]
    assert "failure_within_horizon" not in meta["feature_columns"]

    df = _load_assets()
    row = df.iloc[0].to_dict()
    baseline = predict_asset(row)["failure_probability"]

    flipped = dict(row)
    flipped["failure_within_horizon"] = 1 - int(row["failure_within_horizon"])
    flipped_result = predict_asset(flipped)["failure_probability"]
    assert flipped_result == baseline


def test_scored_file_is_model_output():
    assert os.path.exists(ASSETS_SCORED_CSV)
    with open(ASSETS_SCORED_CSV, encoding="utf-8") as f:
        first_line = f.readline()
    assert "Model-estimated failure probability" in first_line

    scored = pd.read_csv(ASSETS_SCORED_CSV, comment="#", encoding="utf-8")
    src = _load_assets()
    assert len(scored) == len(src)
    assert "failure_probability" in scored.columns
    assert "risk_category" in scored.columns
    assert scored["failure_probability"].between(0, 1).all()


# ---------------------------------------------------------------------------
# Fallback runner (works without pytest)
# ---------------------------------------------------------------------------

def _all_tests():
    return sorted(
        name for name, obj in globals().items()
        if name.startswith("test_") and callable(obj)
    )


def run_all():
    test_names = sorted(_all_tests())
    passed = []
    failed = []
    for name in test_names:
        try:
            globals()[name]()
        except Exception as exc:  # noqa: BLE001
            failed.append((name, exc))
            print(f"  FAIL  {name}: {type(exc).__name__}: {exc}")
        else:
            passed.append(name)
            print(f"  PASS  {name}")

    print(f"\nResults: {len(passed)} passed, {len(failed)} failed "
          f"(of {len(test_names)} tests)")
    for name, exc in failed:
        print(f"  - {name}: {exc}")
    return 1 if failed else 0


if __name__ == "__main__":
    print("GridGuardian AI — Prediction Test Suite")
    print("=" * 50)
    sys.exit(run_all())