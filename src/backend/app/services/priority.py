"""
GridGuardian AI — Phase 3: Priority Service
===========================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

Turns ML failure risk + deterministic grid impact into an operational
priority ranking and crew allocation.

Exact priority formula (documented, transparent):

    urgency_factor = 1.0
                   + 0.30 * min(previous_failures, 3) / 3     # failure history
                   + 0.30 * min(maintenance_days_ago, 900) / 900  # recency
                   + 0.20 * trend_factor                      # rising/stable/flat

    trend_factor = 1.0 (rising), 0.5 (stable), 0.0 (falling)

    criticality_weight (asset criticality field, not risk category):
        High: 1.25   Medium: 1.00   Low: 0.70   (Critical: 1.50 if present)

    raw_priority = normalized_failure_risk
                 * normalized_grid_impact
                 * criticality_weight
                 * urgency_factor

    priority_score = 100 * raw_priority / MAX_RAW_REFERENCE   # 0–100

MAX_RAW_REFERENCE = 1.0 (risk) * 1.0 (impact) * 1.5 (criticality)
                    * 1.8 (max urgency) = 2.70, so the score is a stable
                    0–100 scale independent of the number of assets ranked.

The product structure deliberately means: a very high FAILURE RISK with
zero grid impact scores ~0, and a huge grid impact with near-zero failure
risk scores ~0. Both are needed to make the top of the list.
"""

MAX_RAW_REFERENCE = 2.70  # theoretical max raw = 1.0 * 1.0 * 1.5 * 1.8

CRITICALITY_WEIGHTS = {"High": 1.25, "Medium": 1.00, "Low": 0.70, "Critical": 1.50}

# Bounded, fixed priority-score thresholds (clearly justified on the 0–100 scale):
#   75+ must-act-now, 50+ high, 25+ medium, otherwise low.
PRIORITY_THRESHOLDS = {"CRITICAL": 75.0, "HIGH": 50.0, "MEDIUM": 25.0}

TREND_FACTOR = {"rising": 1.0, "stable": 0.5, "falling": 0.0}


def _num(row, key, default=0.0):
    try:
        value = row.get(key, default)
        if value is None or (isinstance(value, float) and value != value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def compute_urgency(row):
    """Explainable urgency multiplier in [1.0, 1.8] from real maintenance data."""
    failures = min(max(_num(row, "previous_failures"), 0), 3) / 3.0
    maint = min(max(_num(row, "maintenance_days_ago"), 0), 900) / 900.0
    trend = TREND_FACTOR.get(str(row.get("temperature_trend", "stable")).lower(), 0.5)
    urgency = 1.0 + 0.30 * failures + 0.30 * maint + 0.20 * trend
    return round(urgency, 4)


def criticality_weight(row):
    criticality = str(row.get("criticality", "Medium")).strip().capitalize()
    # normalize "Medium" -> "Medium", "Low" -> "Low", "High" -> "High"
    if criticality == "Medium" or criticality == "medium":
        criticality = "Medium"
    return CRITICALITY_WEIGHTS.get(criticality, CRITICALITY_WEIGHTS["Medium"])


def raw_priority(failure_probability, grid_impact, urgency=None,
                 criticality="Medium"):
    """Un-normalized priority (used to calibrate the 0–100 reference max)."""
    risk = min(max(float(failure_probability), 0.0), 1.0)
    impact = min(max(float(grid_impact), 0.0), 100.0) / 100.0
    if urgency is None:
        urgency = 1.0
    weight = CRITICALITY_WEIGHTS.get(criticality.capitalize(),
                                     CRITICALITY_WEIGHTS["Medium"])
    return risk * impact * weight * float(urgency)


def calculate_priority_score(failure_probability, grid_impact, urgency=None,
                             criticality="Medium", reference_max=MAX_RAW_REFERENCE):
    """Priority score on a stable 0–100 scale.

    reference_max is the raw-priority value that maps to 100. The standalone
    default (MAX_RAW_REFERENCE = 2.70 = the theoretical maximum 1.0 x 1.0 x
    1.5 x 1.8) makes single-asset scores comparable across runs. When scoring a
    full population, the orchestrator passes the population's observed maximum
    raw priority so the top asset of that population = 100.
    """
    raw = raw_priority(failure_probability, grid_impact, urgency, criticality)
    ref = float(reference_max or MAX_RAW_REFERENCE)
    if ref <= 0:
        ref = MAX_RAW_REFERENCE
    score = 100.0 * raw / ref
    return round(min(100.0, max(0.0, score)), 4)


def classify_priority(priority_score):
    """Map a 0–100 priority score to CRITICAL / HIGH / MEDIUM / LOW."""
    score = float(priority_score)
    if score >= PRIORITY_THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    if score >= PRIORITY_THRESHOLDS["HIGH"]:
        return "HIGH"
    if score >= PRIORITY_THRESHOLDS["MEDIUM"]:
        return "MEDIUM"
    return "LOW"


def rank_assets(assets):
    """assets: list of dicts each already containing 'priority_score' (and any
    needed fields). Returns a new list sorted by priority_score descending,
    ties broken deterministically by asset_id. Missing required fields raise a
    clear error instead of producing a silent mis-rank."""
    if not assets:
        return []
    for a in assets:
        if "priority_score" not in a:
            raise KeyError(
                f"rank_assets requires 'priority_score' on every asset "
                f"(missing on {a.get('asset_id', '<unknown>')})"
            )
        if "asset_id" not in a:
            raise KeyError("rank_assets requires 'asset_id' on every asset")
    return sorted(
        assets, key=lambda a: (-float(a["priority_score"]), str(a["asset_id"]))
    )


def allocate_crews(ranked_assets, available_crews=3):
    """Greedy (not an optimal OR solver) crew allocation.

    ranked_assets: assets (with priority_score + priority_category). Sorted
    internally by priority so the greedy assignment is always correct.
    available_crews: configurable crew count; 0 is handled safely.

    Returns a dict with 'assigned', 'unassigned_high_priority', and
    'crews_available' for the operational decision-support story.
    """
    if available_crews is None:
        available_crews = 0
    available_crews = max(0, int(available_crews))

    ranked = rank_assets(ranked_assets) if ranked_assets else []
    for a in ranked:
        if "priority_category" not in a:
            raise KeyError(
                f"allocate_crews requires 'priority_category' on every asset "
                f"(missing on {a.get('asset_id', '<unknown>')})"
            )

    assigned = list(ranked[:available_crews])

    high_priority = [
        a for a in ranked if a.get("priority_category") in ("CRITICAL", "HIGH")
    ]
    unassigned = [a for a in high_priority if a not in assigned]

    return {
        "crews_available": available_crews,
        "assigned": assigned,
        "unassigned_high_priority": unassigned,
        "method": "transparent greedy allocation — crews go to the highest-priority "
                  "assets first; allocation is not an optimal OR solver.",
    }