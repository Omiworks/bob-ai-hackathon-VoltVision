"""
GridGuardian AI — Phase 3: Grid Impact Service
===============================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** This is a synthetic demonstration system using a simplified
    network-impact model. It is not an electrical power-flow simulator
    and must not be used for real grid operational decisions. ***

Computes a deterministic grid-impact score (0–100) per asset from
asset/network information ONLY. It deliberately does NOT use the ML
failure probability — failure risk and grid impact are separate axes.

Methodology (transparent, fixed formulas):

    grid_impact =
        0.40 * customer_score
      + 0.35 * facility_score
      + 0.15 * criticality_score
      + 0.10 * network_score

    customer_score    = 100 * log10(1 + downstream_customers)
                        / log10(1 + 8000)              (0–100, saturating)
    facility_score    = min(100, 20 * critical_facilities)
    criticality_score = Low:15, Medium:45, High:75
    network_score     = 0–100 from network.json graph position:
                        - 25 base
                        + 25 per downstream zone fed by the asset
                        + 25 per hospital reachable through those zones
                        (capped at 100).
                        Assets not present in network.json (most of the
                        800) are handled safely: they get a small
                        connectivity component from their reported
                        neighbor_count, capped at 25. Only the six hero
                        transformers are actually modeled as graph nodes,
                        so they are the only assets that can reach a high
                        network_score.

Every asset is scored; assets with no meaningful network connection
fall back to their asset-level fields instead of crashing.
"""

import json
import math
import os

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
NETWORK_PATH = os.path.join(DATA_DIR, "network.json")

# Scale reference for customer normalization (fixed, so scores are stable
# regardless of how many assets are scored in a given run).
MAX_CUSTOMERS_REF = 8000

CRITICALITY_SCORE = {"Low": 15, "Medium": 45, "High": 75}

IMPACT_WEIGHTS = {
    "customer": 0.40,
    "facility": 0.35,
    "criticality": 0.15,
    "network": 0.10,
}

# Non-graph assets cap their connectivity component here so assets that are
# actually modeled in network.json can out-rank them on network position.
NON_GRAPH_NETWORK_CAP = 25


def _num(row, key, default=0.0):
    """Safely read a numeric field, tolerating None/NaN/missing keys."""
    try:
        value = row.get(key, default)
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def load_network(path=None):
    """Load network.json and index it for fast lookups."""
    if path is None:
        path = NETWORK_PATH
    with open(path, "r", encoding="utf-8") as f:
        network = json.load(f)

    nodes_by_id = {n["id"]: n for n in network.get("nodes", [])}
    feeds = []  # (source, target) for relation == "feeds"
    for edge in network.get("edges", []):
        if edge.get("relation") == "feeds":
            feeds.append((edge["source"], edge["target"]))

    # For each node, what does it feed directly?
    children = {}
    for src, dst in feeds:
        children.setdefault(src, []).append(dst)

    # Precompute graph reach: which zones/hospitals sit downstream of each asset.
    graph_position = {}
    for node_id in nodes_by_id:
        node_type = nodes_by_id[node_id].get("type")
        if node_type not in ("transformer", "feeder", "substation"):
            continue
        zone_ids = [d for d in children.get(node_id, [])
                    if nodes_by_id.get(d, {}).get("type") == "zone"]
        hospitals = set()
        for zone in zone_ids:
            for d in children.get(zone, []):
                if nodes_by_id.get(d, {}).get("type") == "hospital":
                    hospitals.add(d)
        graph_position[node_id] = {
            "in_graph": True,
            "zones": zone_ids,
            "hospitals": sorted(hospitals),
        }
    return {
        "nodes_by_id": nodes_by_id,
        "graph_position": graph_position,
        "network": network,
    }


def customer_score(row):
    """0–100, log-scaled so 8,000 customers ≈ 100."""
    customers = max(0, _num(row, "downstream_customers"))
    return round(
        100 * math.log10(1 + customers) / math.log10(1 + MAX_CUSTOMERS_REF),
        2,
    )


def facility_score(row):
    """0–100, 20 points per critical facility (5+ saturates)."""
    facilities = max(0, int(_num(row, "critical_facilities", default=0)))
    return round(min(100, 20 * facilities), 2)


def criticality_score(row):
    criticality = str(row.get("criticality", "Low")).strip().capitalize()
    return CRITICALITY_SCORE.get(criticality, CRITICALITY_SCORE["Low"])


def network_score(row, graph=None):
    """0–100 graph-position score.

    In-graph assets (the six hero transformers): base 25 + 25/zone + 25/hospital
    capped at 100. Out-of-graph assets: 4 points per reported neighbor, capped
    at NON_GRAPH_NETWORK_CAP (25)."""
    if graph is None:
        graph = load_network()
    asset_id = str(row.get("asset_id", ""))
    position = graph["graph_position"].get(asset_id)

    if position is not None and position["in_graph"]:
        score = 25 + 25 * len(position["zones"]) + 25 * len(position["hospitals"])
        return round(min(100, float(score)), 2)

    neighbors = max(0, int(_num(row, "neighbor_count", default=0)))
    return round(min(NON_GRAPH_NETWORK_CAP, 4.0 * neighbors), 2)


def compute_grid_impact(row, graph=None):
    """Deterministic 0–100 grid-impact score for a single asset row (dict)."""
    if graph is None:
        graph = load_network()
    parts = {
        "customer": customer_score(row),
        "facility": facility_score(row),
        "criticality": criticality_score(row),
        "network": network_score(row, graph),
    }
    impact = sum(IMPACT_WEIGHTS[k] * parts[k] for k in IMPACT_WEIGHTS)
    return round(min(100, max(0, impact)), 2), parts


def score_all_assets(rows, graph=None):
    """rows: iterable of dicts. Returns list of (row, impact, parts)."""
    if graph is None:
        graph = load_network()
    out = []
    for row in rows:
        impact, parts = compute_grid_impact(row, graph)
        out.append((row, impact, parts))
    return out