"""
GridGuardian AI — Phase 2: Model Training
==========================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** Model-estimated failure probability based on synthetic demonstration
    data; not a validated real-world failure probability. ***

Trains a Gradient Boosting classifier on the synthetic asset dataset to predict
`failure_within_horizon`. Outputs:
  - model.pkl        (trained model + preprocessing artifacts)
  - metrics.json     (evaluation metrics on held-out test set)
  - feature_importances.json (feature importance ranking)

Reproducible with SEED=42.
"""

import json
import os
import pickle
import sys

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 42
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
ML_DIR = os.path.dirname(__file__)

NUMERIC_FEATURES = [
    "age_years",
    "temperature",
    "vibration",
    "oil_quality",
    "load_percentage",
    "maintenance_days_ago",
    "maintenance_count",
    "previous_failures",
    "weather_severity",
    "humidity",
    "wind_speed",
    "rainfall",
    "historical_incidents",
    "latitude",
    "longitude",
    "downstream_customers",
    "critical_facilities",
    "neighbor_count",
]

CATEGORICAL_FEATURES = [
    "asset_type",
    "temperature_trend",
    "criticality",
]

FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES

TARGET = "failure_within_horizon"
ID_COLUMN = "asset_id"


def load_data():
    path = os.path.join(DATA_DIR, "assets.csv")
    df = pd.read_csv(path, comment="#", encoding="utf-8")
    return df


def build_preprocessor():
    numeric_transformer = Pipeline(steps=[("scaler", StandardScaler())])

    categorical_transformer = Pipeline(
        steps=[("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )
    return preprocessor


def build_model():
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        min_samples_split=2,
        min_samples_leaf=5,
        random_state=SEED,
    )
    return model


def train():
    print("GridGuardian AI — Phase 2: Model Training")
    print("=" * 50)

    df = load_data()
    print(f"Loaded {len(df)} assets from assets.csv")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )
    print(f"Train: {len(X_train)} rows, Test: {len(X_test)} rows")

    preprocessor = build_preprocessor()
    model = build_model()

    pipeline = Pipeline(
        steps=[("preprocessor", preprocessor), ("classifier", model)]
    )

    print("Training Gradient Boosting classifier...")
    pipeline.fit(X_train, y_train)
    print("Training complete.")

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_test, y_proba)

    print(f"\nTest Metrics:")
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1:        {f1:.4f}")
    print(f"  ROC-AUC:   {roc_auc:.4f}")

    metrics = {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "total_assets": len(df),
        "positive_rate": round(float(y.mean()), 4),
        "algorithm": "GradientBoostingClassifier",
        "target": TARGET,
        "features": FEATURE_COLUMNS,
        "seed": SEED,
    }

    metrics_path = os.path.join(ML_DIR, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nSaved metrics to {metrics_path}")

    model_path = os.path.join(ML_DIR, "model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(
            {
                "pipeline": pipeline,
                "feature_columns": FEATURE_COLUMNS,
                "numeric_features": NUMERIC_FEATURES,
                "categorical_features": CATEGORICAL_FEATURES,
                "target": TARGET,
            },
            f,
        )
    print(f"Saved model to {model_path}")

    ohe = pipeline.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"]
    cat_feature_names = list(ohe.get_feature_names_out(CATEGORICAL_FEATURES))
    all_feature_names = NUMERIC_FEATURES + cat_feature_names

    importances = pipeline.named_steps["classifier"].feature_importances_
    importance_pairs = sorted(
        zip(all_feature_names, importances), key=lambda x: x[1], reverse=True
    )
    feature_importances = {name: round(float(imp), 4) for name, imp in importance_pairs}

    fi_path = os.path.join(ML_DIR, "feature_importances.json")
    with open(fi_path, "w", encoding="utf-8") as f:
        json.dump(feature_importances, f, indent=2)
    print(f"Saved feature importances to {fi_path}")

    print("\nTop 10 features:")
    for name, imp in importance_pairs[:10]:
        print(f"  {name:30s} {imp:.4f}")

    return pipeline, metrics


if __name__ == "__main__":
    train()
