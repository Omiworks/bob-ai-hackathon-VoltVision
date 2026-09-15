"""
GridGuardian AI — Phase 2: Prediction Module
=============================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** Model-estimated failure probability based on synthetic demonstration
    data; not a validated real-world failure probability. ***

Provides load_model(), predict_asset(), and predict_batch() for inference,
plus the risk-category mapping.
"""

import json
import os
import pickle

import numpy as np
import pandas as pd

ML_DIR = os.path.dirname(__file__)

_model_cache = {"pipeline": None, "meta": None, "thresholds": None}

# Fallback thresholds used only when thresholds.json is missing.
DEFAULT_THRESHOLDS = {"LOW": 0.25, "MEDIUM": 0.50, "HIGH": 0.75}


def load_model(model_path=None):
    if model_path is None:
        model_path = os.path.join(ML_DIR, "model.pkl")
    with open(model_path, "rb") as f:
        data = pickle.load(f)
    _model_cache["pipeline"] = data["pipeline"]
    _model_cache["meta"] = {
        "feature_columns": data["feature_columns"],
        "numeric_features": data["numeric_features"],
        "categorical_features": data["categorical_features"],
        "target": data["target"],
    }
    return _model_cache["pipeline"], _model_cache["meta"]


def load_thresholds(path=None):
    if path is None:
        path = os.path.join(ML_DIR, "risk_thresholds.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            thresholds = json.load(f)
    else:
        thresholds = DEFAULT_THRESHOLDS
    _model_cache["thresholds"] = thresholds
    return thresholds


def set_thresholds(thresholds):
    _model_cache["thresholds"] = thresholds
    return thresholds


def get_pipeline():
    if _model_cache["pipeline"] is None:
        load_model()
    return _model_cache["pipeline"]


def get_meta():
    if _model_cache["meta"] is None:
        load_model()
    return _model_cache["meta"]


def get_thresholds():
    if _model_cache["thresholds"] is None:
        load_thresholds()
    return _model_cache["thresholds"]


def assign_risk_category(probability, thresholds=None):
    if thresholds is None:
        thresholds = get_thresholds()
    if probability < thresholds["LOW"]:
        return "LOW"
    elif probability < thresholds["MEDIUM"]:
        return "MEDIUM"
    elif probability < thresholds["HIGH"]:
        return "HIGH"
    else:
        return "CRITICAL"


def predict_asset(asset_row: dict) -> dict:
    pipeline = get_pipeline()
    meta = get_meta()

    feature_df = pd.DataFrame([asset_row])[meta["feature_columns"]]

    proba = pipeline.predict_proba(feature_df)[0]
    failure_prob = float(proba[1])
    prediction = int(pipeline.predict(feature_df)[0])

    risk_category = assign_risk_category(failure_prob)

    return {
        "asset_id": asset_row.get("asset_id", "unknown"),
        "asset_type": asset_row.get("asset_type", "unknown"),
        "failure_probability": failure_prob,
        "failure_risk_percent": round(failure_prob * 100, 2),
        "risk_category": risk_category,
        "prediction": prediction,
    }


def predict_batch(df: pd.DataFrame) -> pd.DataFrame:
    pipeline = get_pipeline()
    meta = get_meta()

    X = df[meta["feature_columns"]]
    probas = pipeline.predict_proba(X)[:, 1]
    predictions = pipeline.predict(X)

    results = df[["asset_id", "asset_type"]].copy()
    results["failure_probability"] = probas
    results["failure_risk_percent"] = np.round(probas * 100, 2)
    results["prediction"] = predictions

    return results