"""
GridGuardian AI — Phase 3: Rule-Based Explanation Generator
===========================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

Generates structured, human-readable explanation factors for any asset
purely from its actual field values and fixed public rules — NO LLM, and
NO per-asset hardcoding. The same functions explain any asset in a
reproducible way.
"""

# Fixed, documented rule thresholds (same for every asset).
RISK_RULES = [
    ("threshold", "vibration", 5.0, "High vibration"),
    ("threshold", "temperature", 60.0, "Elevated temperature"),
    ("threshold", "age_years", 30.0, "Older equipment"),
    ("threshold", "maintenance_days_ago", 300.0, "Maintenance overdue"),
    ("threshold", "load_percentage", 90.0, "High load on asset"),
    ("threshold", "previous_failures", 1.0, "Prior failures recorded"),
    ("trend", "temperature_trend", "rising", "Rising temperature trend"),
    ("lowoil", "oil_quality", 55.0, "Poor oil quality"),
]

IMPACT_RULES = [
    ("threshold", "downstream_customers", 1500.0, "High downstream customer count"),
    ("facilities", "critical_facilities", 1.0, None),  # handled specially below
    ("zone", None, None, None),  # handled via graph position below
    ("criticality", None, None, "High criticality classification"),
]


def _num(row, key, default=0.0):
    try:
        value = row.get(key, default)
        if value is None or (isinstance(value, float) and value != value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def risk_explanation(row, failure_risk_percent=None):
    """List of risk-factor strings derived from actual feature values."""
    factors = []
    for kind, field, threshold, label in RISK_RULES:
        if kind == "threshold":
            if _num(row, field) >= threshold:
                factors.append(label)
        elif kind == "trend":
            if str(row.get(field, "")).lower() == threshold:
                factors.append(label)
        elif kind == "lowoil":
            if _num(row, field) <= threshold:
                factors.append(label)

    if failure_risk_percent is not None:
        if failure_risk_percent >= 90:
            factors.append("Very high model failure risk")
        elif failure_risk_percent >= 60:
            factors.append("Elevated model failure risk")
    return factors


def impact_explanation(row, graph_position=None):
    """List of impact-factor strings derived from grid/asset data."""
    factors = []
    if _num(row, "downstream_customers") >= 1500:
        factors.append("High downstream customer count")
    facilities = int(_num(row, "critical_facilities", default=0))
    if facilities >= 3:
        factors.append(f"Multiple critical facilities ({facilities})")
    elif facilities >= 1:
        factors.append(f"Critical facilities downstream ({facilities})")
    if str(row.get("criticality", "Low")).lower() == "high":
        factors.append("High criticality classification")
    if graph_position and graph_position.get("in_graph"):
        zones = graph_position.get("zones", [])
        hospitals = graph_position.get("hospitals", [])
        if zones:
            factors.append(f"Feeds {len(zones)} downstream zone(s)")
        if hospitals:
            factors.append(f"Reaches {len(hospitals)} hospital(s) via zones")
    return factors


def priority_reason(failure_risk_percent, grid_impact, priority_category):
    """One concise, rule-based human sentence for the priority."""
    risk_hi = failure_risk_percent >= 60
    impact_hi = grid_impact >= 60
    if risk_hi and impact_hi:
        reason = "High failure risk combined with high grid impact"
    elif risk_hi:
        reason = "High failure risk despite moderate grid impact"
    elif impact_hi:
        reason = "High grid impact but low failure risk"
    else:
        reason = "Low failure risk and limited grid impact"
    return f"{reason} -> {priority_category} priority"


def explain_asset(row, failure_risk_percent=None, grid_impact=None,
                  priority_category=None, graph_position=None):
    """Build the structured explanation dict for one asset."""
    return {
        "asset_id": row.get("asset_id", "unknown"),
        "risk_factors": risk_explanation(row, failure_risk_percent),
        "impact_factors": impact_explanation(row, graph_position),
        "priority_reason": priority_reason(
            failure_risk_percent if failure_risk_percent is not None else 0,
            grid_impact if grid_impact is not None else 0,
            priority_category if priority_category is not None else "LOW",
        ),
    }