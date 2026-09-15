"""
GridGuardian AI — Phase 4: Failure-Impact Simulation Service
============================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***
*** This is a simplified graph-based failure-impact simulation over
    synthetic demonstration data. It is not a power-flow solver, digital
    twin, or validated utility outage model. ***
*** Simulation estimates consequences; it does not claim to predict
    physical electrical behavior. ***

Core entry point:

    simulate_asset_failure(asset_id)

Given one asset, traverses network.json downstream from its node and answers:
which zones/facilities are affected, which neighbors are stressed, how many
customers are estimated to be affected, the severity (0–100 + category), and
the documented assumptions.

Severity is CONSEQUENCE, not likelihood. It is deliberately decoupled from the
Phase 2 failure probability. No random values are used anywhere; every output is
a pure deterministic function of the inputs.
"""

import json
import math
import os

import networkx as nx
import pandas as pd

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(SERVICES_DIR, "..", ".."))
DATA_DIR = os.path.join(BACKEND_DIR, "data")

NETWORK_PATH = os.path.join(DATA_DIR, "network.json")
ASSETS_SCORED_CSV = os.path.join(DATA_DIR, "assets_scored.csv")

MAX_CUSTOMERS_REF = 8000  # fixed log-scale reference, same as impact service

FACILITY_CRITICALITY = {"hospital": "critical", "industrial": "high",
                        "residential": "low"}

SEVERITY_WEIGHTS = {
    "customers": 0.40,
    "facilities": 0.30,
    "zones": 0.15,
    "stressed": 0.10,
    "depth": 0.05,
}

SEVERITY_THRESHOLDS = {"CRITICAL": 75.0, "HIGH": 50.0, "MEDIUM": 25.0}

ASSUMPTIONS = [
    "Simplified directed network model built from network.json",
    "Downstream dependencies (zones and the facilities they feed) are treated as affected when their supplying asset fails",
    "Customer impact is estimated from the failed asset's synthetic downstream_customer footprint (zone-level totals are not present in network.json)",
    "Neighboring transformers and the supplying substation are treated as stressed if they may need to carry additional burden",
    "No electrical power-flow calculation is performed",
]

_context = {"graph": None, "assets": None, "nodes": None}


def _num(value, default=0.0):
    try:
        if value is None:
            return default
        v = float(value)
        if v != v:  # NaN
            return default
        return v
    except (TypeError, ValueError):
        return default


def load_simulation_context(network_path=None, scored_csv=None):
    """Build (networkx DiGraph, asset map, node map). Cached for speed."""
    if network_path is None:
        network_path = NETWORK_PATH
    if scored_csv is None:
        scored_csv = ASSETS_SCORED_CSV
    if _context["graph"] is not None:
        return _context["graph"], _context["assets"], _context["nodes"]

    with open(network_path, "r", encoding="utf-8") as f:
        network = json.load(f)

    assets = {}
    if os.path.exists(scored_csv):
        df = pd.read_csv(scored_csv, comment="#", encoding="utf-8")
        for rec in df.to_dict("records"):
            assets[str(rec.get("asset_id"))] = rec

    nodes = {n["id"]: n for n in network.get("nodes", [])}

    G = nx.DiGraph()
    for n in network.get("nodes", []):
        G.add_node(n["id"], type=n.get("type"), label=n.get("label", n["id"]))
    for e in network.get("edges", []):
        rel = e.get("relation")
        src, tgt = e["source"], e["target"]
        if rel == "connects":
            G.add_edge(src, tgt, relation="connects")
            G.add_edge(tgt, src, relation="connects")  # undirected link
        else:  # "supplies" and "feeds" are treated as directed (down the system)
            G.add_edge(src, tgt, relation=rel or "feeds")

    _context.update({"graph": G, "assets": assets, "nodes": nodes})
    return G, assets, nodes


def _downstream(asset_id, G):
    """Collect (node, distance) pairs reachable downstream via directed
    power-flow-style 'feeds' edges only.

    'connects' edges (transformer ring) are deliberately NOT traversed — losing
    one transformer does not black out a sibling transformer's own zone; it only
    stresses the sibling (handled separately). 'supplies' edges point from the
    source UPSTREAM, so they are never walked downstream by construction."""
    reached = []
    seen = {asset_id}
    queue = [(asset_id, 0)]
    while queue:
        node, dist = queue.pop(0)
        for child in G.successors(node):
            if child in seen:
                continue
            if G[node][child].get("relation") != "feeds":
                continue
            seen.add(child)
            reached.append((child, dist + 1))
            queue.append((child, dist + 1))
    return reached


def _node_attribute(assets, asset_id, key, default):
    rec = assets.get(asset_id)
    if rec is None:
        return default
    return rec.get(key, default)


def affected_customers_estimate(asset_id, assets, downstream):
    """Estimated affected customers.

    Uses the failed asset's own downstream_customer footprint from assets.csv —
    the best available population estimate, because network.json zones do not
    carry customer totals. This single-population approach also avoids
    double-counting the same customers across multiple downstream nodes.
    """
    cust = int(_num(_node_attribute(assets, asset_id, "downstream_customers", 0)))
    if cust <= 0:
        # If the asset has no listed footprint but feeds zones (synthetic edge
        # case), fall back to the sum of unique zone-hosting transformer
        # footprints is not derivable here; stay conservative and report 0+1
        # margin: use 0 with a note in assumptions.
        return 0
    return cust


def _stress_neighbors(asset_id, G, assets):
    """Return list of stressed-asset dicts (deterministic).

    Stress set = direct transformer neighbors via 'connects' plus the supplying
    substation via 'supplies'. Each gets a 0-100 stress score computed from
    graph distance (1.0), current load (0.3) and pre-existing failure risk
    (0.2), using real asset fields. No random values."""
    stressed = []
    seen = set()

    def handle(neighbor_id):
        if neighbor_id in seen:
            return
        seen.add(neighbor_id)
        node_type = _graph_node_type(neighbor_id)
        distance = 1
        load = _num(_node_attribute(assets, neighbor_id, "load_percentage", 50)) / 100.0
        risk = _num(_node_attribute(assets, neighbor_id, "failure_probability", 0.5))
        distance_w = 1.0 / distance
        score = round(min(100, max(0, 100.0 * (0.5 * distance_w
                                               + 0.3 * load
                                               + 0.2 * risk))), 1)
        stressed.append({
            "asset_id": neighbor_id,
            "node_type": node_type,
            "stress_score": score,
            "reason": (f"Direct neighbor that may carry additional burden "
                       f"if {asset_id} fails"),
        })

    for _, nbr in G.out_edges(asset_id):
        if G[asset_id][nbr].get("relation") == "connects":
            handle(nbr)
    for pred, _ in G.in_edges(asset_id):
        if G[pred][asset_id].get("relation") == "supplies":
            handle(pred)
        elif pred in _context["nodes"] and _graph_node_type(pred) == "transformer":
            # If the asset itself draws from another transformer, stress that
            # transformer's supplying substation too (only in the demo ring).
            nbr_pred = pred
            for p2 in G.predecessors(nbr_pred):
                if G[p2][nbr_pred].get("relation") == "supplies":
                    handle(p2)

    return stressed


def _graph_node_type(node_id):
    n = _context["nodes"].get(node_id)
    return n.get("type") if n else None


def _graph_node_label(node_id):
    n = _context["nodes"].get(node_id)
    return n.get("label", node_id) if n else node_id


def _is_asset(asset_id, assets):
    return str(asset_id) in assets


def severity_classify(severity_score):
    if severity_score >= SEVERITY_THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    if severity_score >= SEVERITY_THRESHOLDS["HIGH"]:
        return "HIGH"
    if severity_score >= SEVERITY_THRESHOLDS["MEDIUM"]:
        return "MEDIUM"
    return "LOW"


def calculate_severity(customers, critical_facilities, n_zones, stressed_scores,
                       cascade_depth):
    """Transparent 0-100 severity = consequences, not likelihood."""
    customers_score = round(100 * math.log10(1 + customers)
                            / math.log10(1 + MAX_CUSTOMERS_REF), 2) if customers else 0.0
    facilities_score = round(min(100, 25.0 * critical_facilities), 2)
    zones_score = round(min(100, 100.0 / 3 * n_zones), 2)
    stressed_score = (round(sum(stressed_scores) / len(stressed_scores), 2)
                      if stressed_scores else 0.0)
    depth_score = round(min(100, 100.0 / 3 * cascade_depth), 2)

    score = round(
        SEVERITY_WEIGHTS["customers"] * customers_score
        + SEVERITY_WEIGHTS["facilities"] * facilities_score
        + SEVERITY_WEIGHTS["zones"] * zones_score
        + SEVERITY_WEIGHTS["stressed"] * stressed_score
        + SEVERITY_WEIGHTS["depth"] * depth_score,
        2,
    )
    return min(100.0, max(0.0, score)), {
        "customers_score": customers_score,
        "facilities_score": facilities_score,
        "zones_score": zones_score,
        "stressed_score": stressed_score,
        "depth_score": depth_score,
    }


def simulate_asset_failure(asset_id, network_path=None, scored_csv=None):
    """Simulate what happens if `asset_id` fails.

    Returns a clean structured dict. Raises ValueError for an unknown asset.
    Assets not present in network.json are handled safely (empty graph results,
    low severity from their own footprint)."""
    G, assets, nodes = load_simulation_context(network_path, scored_csv)
    asset_id = str(asset_id)

    if not _is_asset(asset_id, assets):
        raise ValueError(
            f"Unknown asset '{asset_id}'. Provide a valid asset_id from "
            "assets.csv / assets_scored.csv."
        )

    node_type = _graph_node_type(asset_id)
    in_graph = node_type is not None

    if in_graph:
        downstream = _downstream(asset_id, G)
        affected_zones = sorted(
            n for n, _ in downstream if _graph_node_type(n) == "zone"
        )
        affected_facilities = [
            {
                "id": fid,
                "name": _graph_node_label(fid),
                "type": _graph_node_type(fid),
                "criticality": FACILITY_CRITICALITY.get(_graph_node_type(fid), "low"),
            }
            for fid, _ in downstream
            if _graph_node_type(fid) in FACILITY_CRITICALITY
        ]
        affected_facilities = sorted(affected_facilities, key=lambda f: f["id"])

        critical_facilities = [
            f for f in affected_facilities if f["criticality"] == "critical"
        ]
        affected_nodes = [n for n, _ in downstream]
        cascade_depth = max((d for _, d in downstream), default=0)

        customers = affected_customers_estimate(asset_id, assets, downstream)
        stressed = _stress_neighbors(asset_id, G, assets)
        stressed_ids = [s["asset_id"] for s in stressed]
        facility_source = "graph"
    else:
        downstream = []
        affected_zones = []
        affected_facilities = []
        critical_facilities = []
        affected_nodes = []
        cascade_depth = 0
        customers = affected_customers_estimate(asset_id, assets, downstream)
        stressed = []
        stressed_ids = []
        # Out-of-graph assets have no reachable named facilities. The asset's
        # own critical_facilities field (the same synthetic metadata the impact
        # service relies on) is used as the consequence count, clearly labeled
        # as originating from the asset record — never fabricated here.
        facility_source = "asset_field"

    critical_count = len(critical_facilities)
    if facility_source == "asset_field":
        critical_count = int(_num(
            _node_attribute(assets, asset_id, "critical_facilities", 0)))

    severity_score, severity_parts = calculate_severity(
        customers,
        critical_count,
        len(affected_zones),
        [s["stress_score"] for s in stressed],
        cascade_depth,
    )
    severity = severity_classify(severity_score)

    result = {
        "failed_asset": asset_id,
        "asset_type": _node_attribute(assets, asset_id, "asset_type", node_type),
        "network_node_present": in_graph,
        "affected_zones": affected_zones,
        "affected_facilities": affected_facilities,
        "critical_facilities_affected": critical_count,
        "critical_facility_ids": [f["id"] for f in critical_facilities],
        "facility_source": facility_source,
        "affected_assets": [a for a in affected_nodes if _is_asset(a, assets)],
        "stressed_assets": stressed,
        "estimated_customers_affected": customers,
        "severity": severity,
        "severity_score": severity_score,
        "severity_factors": severity_parts,
        "cascade_depth": cascade_depth,
        "assumptions": list(ASSUMPTIONS),
    }
    result["explanation"] = build_explanation_result(result)
    return result


def build_explanation_result(result):
    """Rule-based explanation derived from the actual simulation result."""
    aid = result["failed_asset"]
    customers = result["estimated_customers_affected"]
    zones = result["affected_zones"]
    facilities = result["affected_facilities"]
    crit = [f for f in facilities if f["criticality"] == "critical"]
    crit_n = max(len(crit), result["critical_facilities_affected"])
    stressed = result["stressed_assets"]
    severity = result["severity"]

    drivers = []
    drivers.append(f"{customers:,} estimated customers affected")
    if zones:
        drivers.append(f"{len(zones)} downstream zone(s) affected")
    if crit_n:
        drivers.append(f"{crit_n} critical facility(ies) affected")
    elif facilities:
        drivers.append(f"{len(facilities)} downstream facility(ies) affected")
    if stressed:
        drivers.append(f"{len(stressed)} neighboring asset(s) stressed")

    headline = (
        f"Failure of {aid} would affect ~{customers:,} customers"
        + (f" across {len(zones)} zone(s)" if zones else "")
        + (f", including {crit_n} critical facility(ies)" if crit_n else ", with no critical facilities")
        + "."
    )

    if severity == "CRITICAL":
        summary = "Widespread, high-consequence failure: large population and critical facilities downstream."
        follow = "Dispatch crews immediately; consider load transfer to connected transformers and notify emergency facilities."
    elif severity == "HIGH":
        summary = "Significant consequence: substantial population or critical facilities affected."
        follow = "Dispatch a crew promptly; monitor stressed neighboring assets for overload signs."
    elif severity == "MEDIUM":
        summary = "Moderate consequence: contained population impact with limited infrastructure exposure."
        follow = "Schedule a crew; monitor the asset's health trend."
    else:
        summary = "Limited consequence: small population and no critical infrastructure reachable."
        follow = "No urgent action needed; continue routine maintenance cadence."

    return {
        "headline": headline,
        "key_drivers": drivers,
        "consequence_summary": summary,
        "recommended_follow_up": follow,
    }


def compare_failure_scenarios(asset_ids, network_path=None, scored_csv=None):
    """Run simulate_asset_failure for each id and return a comparable summary
    plus the worst case. Pure wrapper around the single-asset simulation."""
    scenarios = [simulate_asset_failure(a, network_path, scored_csv) for a in asset_ids]
    comparable = [
        {
            "asset_id": s["failed_asset"],
            "estimated_customers_affected": s["estimated_customers_affected"],
            "critical_facilities_affected": s["critical_facilities_affected"],
            "affected_zones_count": len(s["affected_zones"]),
            "stressed_assets_count": len(s["stressed_assets"]),
            "cascade_depth": s["cascade_depth"],
            "severity_score": s["severity_score"],
            "severity": s["severity"],
        }
        for s in scenarios
    ]
    comparable.sort(key=lambda c: -c["severity_score"])
    return {"scenarios": comparable, "worst": comparable[0]}


def suggest_demo_assets(scored_csv=None):
    """Automatically pick the three demo scenarios — no hardcoded asset IDs.

    1. high_risk_high_impact : asset with the largest failure_risk x grid_impact
    2. low_risk_high_impact  : asset with the highest grid impact among assets
                               with failure risk below 10% (a big, but healthy,
                               footprint)
    3. high_risk_low_impact  : asset with the highest failure risk among the
                               quarter of assets with the LOWEST grid impact

    Hero assets appear here only if the data genuinely satisfies these
    roles. No simulation logic special-cases any asset."""
    try:
        from app.services.impact import compute_grid_impact, load_network
    except ImportError:  # allow running as a script from the services dir
        from impact import compute_grid_impact, load_network

    if scored_csv is None:
        scored_csv = ASSETS_SCORED_CSV
    df = pd.read_csv(scored_csv, comment="#", encoding="utf-8")
    graph = load_network()
    rows = df.to_dict("records")

    scored_rows = []
    for r in rows:
        impact, _ = compute_grid_impact(r, graph)
        risk = _num(r.get("failure_risk_percent"), 0.0)
        scored_rows.append({
            "asset_id": r["asset_id"],
            "failure_risk_percent": risk,
            "grid_impact": impact,
            "risk_times_impact": risk * impact,
        })

    by_rti = max(scored_rows, key=lambda x: x["risk_times_impact"])

    low_risk = [x for x in scored_rows if x["failure_risk_percent"] < 10.0]
    low_risk_high = max(low_risk, key=lambda x: x["grid_impact"])

    impact_threshold_low = sorted((x["grid_impact"] for x in scored_rows))[
        len(scored_rows) // 4
    ]
    low_impact = [x for x in scored_rows if x["grid_impact"] <= impact_threshold_low]
    high_risk_low = max(low_impact, key=lambda x: x["failure_risk_percent"])

    return {
        "high_risk_high_impact": by_rti["asset_id"],
        "low_risk_high_impact": low_risk_high["asset_id"],
        "high_risk_low_impact": high_risk_low["asset_id"],
    }