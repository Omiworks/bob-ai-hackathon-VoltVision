"""
GridGuardian AI — Phase 5: Precomputed Data Registry (thin adapter)
===================================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** This is a simplified network-impact model, not an electrical power-flow
    simulator, and must not be used for real grid operational decisions. ***

Loads the precomputed Phase 2 (assets_scored.csv) and Phase 3
(assets_prioritized.csv) outputs plus alerts.csv and ml/metrics.json ONCE and
serves lookups / filters to the FastAPI routes. It deliberately contains NO
business logic — calculations stay in the existing Phase 2/3/4 services
(impact.py, priority.py, simulation.py), which this adapter reuses on demand.

The API is an adapter over already-tested services; the precomputed CSVs are
the source of truth for risk/impact/priority so nothing is recalculated on
every request unless a transparent component breakdown is requested.
"""

import json
import numbers
import os

import pandas as pd

from app.services.impact import compute_grid_impact, load_network
from app.services.priority import compute_urgency
from app.services.simulation import (
    compare_failure_scenarios,
    simulate_asset_failure,
)

BACKEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
)
DATA_DIR = os.path.join(BACKEND_DIR, "data")
ML_DIR = os.path.join(BACKEND_DIR, "app", "ml")

SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")
PRIORITIZED_CSV = os.path.join(DATA_DIR, "assets_prioritized.csv")
ALERTS_CSV = os.path.join(DATA_DIR, "alerts.csv")
METRICS_JSON = os.path.join(ML_DIR, "metrics.json")

RISK_CATEGORIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
PRIORITY_CATEGORIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
CRITICALITY_CATEGORIES = ["LOW", "MEDIUM", "HIGH"]
SORT_FIELDS = {"priority": "priority_score", "risk": "failure_risk_percent",
               "impact": "grid_impact"}
DEFAULT_LIMIT = 50
MAX_LIMIT = 800

# Extra Phase 3 fields layered onto each scored row when present.
PRIORITIZED_KEEP = [
    "grid_impact", "priority_score", "priority_category",
    "customers_affected_estimate", "critical_facilities_estimate",
    "neighbor_count", "maintenance_days_ago", "previous_failures",
    "risk_factors", "impact_factors", "priority_reason",
]

_cache = {}

graph = None  # lazy: load_network() on first impact_detail call


def _load():
    if _cache:
        return _cache
    scored = pd.read_csv(SCORED_CSV, comment="#", encoding="utf-8")
    prioritized = pd.read_csv(PRIORITIZED_CSV, comment="#", encoding="utf-8")
    scored["asset_id"] = scored["asset_id"].astype(str)
    prioritized["asset_id"] = prioritized["asset_id"].astype(str)
    _cache["scored"] = scored
    _cache["prioritized"] = prioritized
    return _cache


def _row_to_dict(row):
    return {k: (None if pd.isna(v) else v) for k, v in row.items()}


def _num(rec, key, default=0.0):
    try:
        v = rec.get(key, default)
        if v is None:
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _split_factors(value):
    if isinstance(value, list):
        return value
    text = str(value or "").strip()
    if not text or text == "-":
        return []
    return [part.strip() for part in text.split(";") if part.strip()]


def _jsonable(v):
    """Normalize numpy/pandas scalar types to JSON-native Python values."""
    if v is None or isinstance(v, bool):
        return v
    if isinstance(v, numbers.Integral):
        return int(v)
    if isinstance(v, numbers.Real):
        return round(float(v), 4)
    if isinstance(v, (str, list, dict)):
        return v
    return str(v)


def _clean(rec):
    return {k: _jsonable(v) for k, v in rec.items()}


def combined_records():
    """One dict per asset: scored (Phase 2) row enriched with Phase 3 fields.
    Built once and cached; callers must not mutate the returned records."""
    if "combined" in _cache:
        return _cache["combined"]
    scored = _load()["scored"]
    prioritized = _load()["prioritized"].set_index("asset_id")
    records = []
    for row in scored.to_dict("records"):
        rec = _row_to_dict(row)
        aid = rec["asset_id"]
        p = prioritized.loc[aid] if aid in prioritized.index else None
        if p is not None:
            pdict = _row_to_dict(p)
            rec.update({k: pdict[k] for k in PRIORITIZED_KEEP if k in pdict})
        rec["risk_factors"] = _split_factors(rec.get("risk_factors"))
        rec["impact_factors"] = _split_factors(rec.get("impact_factors"))
        records.append(_clean(rec))
    _cache["combined"] = records
    return records


def get_asset(asset_id):
    """Full combined dict for one asset (None if not present)."""
    asset_id = str(asset_id)
    records = combined_records()
    for rec in records:
        if rec["asset_id"] == asset_id:
            return rec
    return None


def _failure_risk(rec):
    return _num(rec, "failure_risk", _num(rec, "failure_risk_percent"))


def asset_summary(rec):
    """Compact row shape requested by the API (list + ranking endpoints)."""
    return {
        "asset_id": rec.get("asset_id"),
        "asset_type": rec.get("asset_type"),
        "criticality": rec.get("criticality"),
        "failure_risk": _failure_risk(rec),
        "risk_category": rec.get("risk_category"),
        "grid_impact": _num(rec, "grid_impact"),
        "priority_score": _num(rec, "priority_score"),
        "priority_category": rec.get("priority_category"),
        "customers_affected_estimate": int(_num(
            rec, "customers_affected_estimate", default=_num(rec, "downstream_customers"))),
        "location": rec.get("location"),
        "age": _num(rec, "age_years"),
        "load": _num(rec, "load_percentage"),
        "temperature": _num(rec, "temperature"),
        "vibration": _num(rec, "vibration"),
    }


def _apply_filters(records, risk_category=None, priority_category=None,
                   asset_type=None, search=None, criticality=None):
    if risk_category:
        rc = str(risk_category).upper()
        if rc not in RISK_CATEGORIES:
            raise ValueError(f"Invalid risk_category '{risk_category}'")
        records = [r for r in records if r.get("risk_category") == rc]
    if priority_category:
        pc = str(priority_category).upper()
        if pc not in PRIORITY_CATEGORIES:
            raise ValueError(f"Invalid priority_category '{priority_category}'")
        records = [r for r in records if r.get("priority_category") == pc]
    if criticality:
        cr = str(criticality).strip().upper()
        if cr not in CRITICALITY_CATEGORIES:
            raise ValueError(f"Invalid criticality '{criticality}'")
        records = [r for r in records
                   if str(r.get("criticality", "")).strip().upper() == cr]
    if asset_type:
        at = str(asset_type).strip().lower()
        records = [r for r in records
                   if str(r.get("asset_type", "")).strip().lower() == at]
    if search:
        needle = str(search).strip().lower()
        records = [r for r in records
                   if needle in str(r.get("asset_id", "")).lower()
                   or needle in str(r.get("location", "")).lower()
                   or needle in str(r.get("asset_type", "")).lower()]
    return records


def list_assets(risk_category=None, priority_category=None, asset_type=None,
                limit=DEFAULT_LIMIT, offset=0, search=None, sort="priority",
                criticality=None):
    """Filtered/sorted lightweight asset summaries (precomputed data only)."""
    key = SORT_FIELDS.get(str(sort or "priority").lower())
    if key is None:
        raise ValueError(f"Invalid sort '{sort}'; expected one of "
                         f"{', '.join(sorted(SORT_FIELDS))}")

    records = list(combined_records())
    records = _apply_filters(records, risk_category, priority_category,
                             asset_type, search, criticality)
    records.sort(key=lambda r: (-_num(r, key), str(r.get("asset_id", ""))))

    offset = max(0, int(offset or 0))
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    page = records[offset:offset + limit]
    return {
        "total": len(records),
        "returned": len(page),
        "limit": limit,
        "offset": offset,
        "sort": sort or "priority",
        "assets": [asset_summary(r) for r in page],
    }


def risk_detail(asset_id):
    rec = get_asset(asset_id)
    if rec is None:
        return None
    return {
        "asset_id": asset_id,
        "failure_probability": _num(rec, "failure_probability"),
        "failure_risk_percent": _num(rec, "failure_risk_percent"),
        "risk_category": rec.get("risk_category"),
    }


def impact_detail(asset_id):
    """Grid-impact score + component breakdown, computed live by the Phase 3
    impact service (reuses the exact tested formula)."""
    rec = get_asset(asset_id)
    if rec is None:
        return None
    global graph
    if graph is None:
        graph = load_network()
    row = rec
    grid_impact, parts = compute_grid_impact(row, graph)
    return {
        "asset_id": asset_id,
        "grid_impact": grid_impact,
        "components": parts,
        "customers": int(_num(rec, "downstream_customers")),
        "critical_facilities": int(_num(rec, "critical_facilities")),
    }


def priority_detail(asset_id):
    rec = get_asset(asset_id)
    if rec is None:
        return None
    urgency = compute_urgency(rec)
    return {
        "asset_id": asset_id,
        "priority_score": _num(rec, "priority_score"),
        "priority_category": rec.get("priority_category"),
        "grid_impact": _num(rec, "grid_impact"),
        "failure_risk_percent": _num(rec, "failure_risk_percent"),
        "urgency": urgency,
        "priority_reason": rec.get("priority_reason"),
    }


def explanation_detail(asset_id):
    rec = get_asset(asset_id)
    if rec is None:
        return None
    return {
        "asset_id": asset_id,
        "risk_factors": rec.get("risk_factors") or [],
        "impact_factors": rec.get("impact_factors") or [],
        "priority_reason": rec.get("priority_reason"),
    }


def distributions():
    records = list(combined_records())
    risk = {c: 0 for c in RISK_CATEGORIES}
    priority = {c: 0 for c in PRIORITY_CATEGORIES}
    for r in records:
        rc = r.get("risk_category")
        if rc in risk:
            risk[rc] += 1
        pc = r.get("priority_category")
        if pc in priority:
            priority[pc] += 1
    return risk, priority


def extremes():
    records = list(combined_records())
    highest_risk = max(records, key=lambda r: (_failure_risk(r), r["asset_id"]))
    highest_impact = max(records, key=lambda r: (_num(r, "grid_impact"), r["asset_id"]))
    top_priority = max(records, key=lambda r: (_num(r, "priority_score"), r["asset_id"]))
    return {
        "highest_risk": asset_summary(highest_risk),
        "highest_impact": asset_summary(highest_impact),
        "top_priority": asset_summary(top_priority),
    }


def model_metrics():
    if "metrics" in _cache:
        return _cache["metrics"]
    with open(METRICS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    summary = {
        "algorithm": data.get("algorithm"),
        "roc_auc": data.get("roc_auc"),
        "accuracy": data.get("accuracy"),
        "f1": data.get("f1"),
        "train_size": data.get("train_size"),
        "test_size": data.get("test_size"),
        "target": data.get("target"),
        "seed": data.get("seed"),
        "synthetic": True,
    }
    _cache["metrics"] = summary
    return summary


def model_features():
    """Read-only model inputs: the 21 training features + their importances."""
    if "model_features" in _cache:
        return _cache["model_features"]
    with open(METRICS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    features = list(data.get("features") or [])
    importances_path = os.path.join(ML_DIR, "feature_importances.json")
    importances = {}
    if os.path.exists(importances_path):
        with open(importances_path, "r", encoding="utf-8") as f:
            importances = json.load(f)
    _cache["model_features"] = {"features": features, "importances": importances}
    return _cache["model_features"]


def list_alerts(limit=DEFAULT_LIMIT, severity=None, substation=None, asset_id=None):
    if not os.path.exists(ALERTS_CSV):
        return []
    alerts = pd.read_csv(ALERTS_CSV, comment="#", encoding="utf-8")
    records = [_row_to_dict(r) for r in alerts.to_dict("records")]
    if severity:
        records = [r for r in records
                   if str(r.get("severity", "")).lower() == str(severity).lower()]
    if substation:
        records = [r for r in records
                   if str(r.get("substation", "")).lower() == str(substation).lower()]
    if asset_id:
        records = [r for r in records
                   if str(r.get("asset_id", "")) == str(asset_id)]
    records.sort(key=lambda r: str(r.get("timestamp", "")), reverse=True)
    return records[:max(1, min(int(limit or DEFAULT_LIMIT), 100))]


def dashboard_summary(alerts_limit=10):
    risk, priority = distributions()
    ext = extremes()
    records = list(combined_records())

    customers = {
        "total_estimated_footprint": int(sum(
            _num(r, "customers_affected_estimate", default=_num(r, "downstream_customers"))
            for r in records)),
        "in_critical_high_risk": int(sum(
            _num(r, "customers_affected_estimate", default=_num(r, "downstream_customers"))
            for r in records if r.get("risk_category") in ("CRITICAL", "HIGH"))),
        "in_critical_high_priority": int(sum(
            _num(r, "customers_affected_estimate", default=_num(r, "downstream_customers"))
            for r in records if r.get("priority_category") in ("CRITICAL", "HIGH"))),
    }

    return {
        "assets": {"total": len(records)},
        "risk": risk,
        "priority": priority,
        "critical_high_priority": {
            "count": priority["CRITICAL"] + priority["HIGH"],
            "critical": priority["CRITICAL"],
            "high": priority["HIGH"],
        },
        "highest_risk": ext["highest_risk"],
        "highest_impact": ext["highest_impact"],
        "top_priority": ext["top_priority"],
        "customers": customers,
        "alerts": list_alerts(limit=alerts_limit),
        "model": model_metrics(),
        "synthetic_data": {
            "synthetic": True,
            "status": "Synthetic demonstration data — not real utility data.",
        },
    }