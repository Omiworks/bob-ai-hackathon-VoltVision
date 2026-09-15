"""
GridGuardian AI — Synthetic Data Generator
============================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

This script generates a plausible-looking but entirely synthetic dataset for a
hackathon prototype. Nothing here is sourced from, or representative of, any
real electric utility's operational measurements, customers, or infrastructure.

WHY THIS ISN'T "JUST RANDOM"
-----------------------------
Every risk-relevant field is drawn from a distribution that is *nudged* by an
underlying, hidden "condition" latent variable per asset, so that fields
correlate with each other the way they plausibly would in the real world:

    older assets        -> tend to run hotter, vibrate more, have worse oil
    poor maintenance     -> compounds with age
    bad weather exposure -> raises risk uniformly across assets in that area
    high load             -> raises temperature and vibration together

`failure_within_horizon` (the ML training label) is then generated as a
weighted, noisy function of these same fields — so a model trained on this
data will learn *genuine, recoverable feature importances*, rather than
memorizing an arbitrary label. This is what makes the later "Why is this
asset high risk?" explanation feature honest rather than decorative.

IMPORTANT: `failure_risk`, `grid_impact`, and `priority_score` are NOT written
to assets.csv. Those are computed later by the actual ML model (Phase 2) and
the priority scoring service (Phase 3) — baking them in here would make the
whole pipeline fake.

Reproducibility: a fixed random seed (42) means re-running this script always
produces the identical dataset — important so ML metrics computed later are
stable and comparable across runs.
"""

import csv
import json
import random
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

SEED = 42
NUM_ASSETS = 800
OUTPUT_DIR = "."  # run from backend/data/

random.seed(SEED)

ASSET_TYPES = ["transformer", "feeder", "breaker", "capacitor_bank", "recloser"]
ASSET_TYPE_WEIGHTS = [0.35, 0.30, 0.15, 0.10, 0.10]  # transformers dominate, realistic mix

SUBSTATIONS = [
    "Anand Substation", "Baroda North Substation", "Baroda South Substation",
    "Godhra Substation", "Nadiad Substation", "Bharuch Substation",
    "Vadodara Central Substation", "Halol Substation", "Padra Substation",
    "Karjan Substation",
]

# Rough lat/long bounding box around Vadodara/Gujarat region, purely for a
# believable-looking map later. Not real substation coordinates.
LAT_RANGE = (21.9, 22.6)
LON_RANGE = (72.9, 73.5)

CRITICALITY_LEVELS = ["Low", "Medium", "High"]


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# ASSET GENERATION
# ---------------------------------------------------------------------------

# ID prefix matches asset type, so "TX-104" is guaranteed to actually be a
# transformer, "FDR-207" a feeder, etc. Each type gets its own counter
# starting at 100, assigned in the order that type is drawn — this is what
# lets the hero transformer IDs (TX-104 etc.) land naturally on real
# transformers without special-casing the ID string itself.
ID_PREFIX = {
    "transformer": "TX",
    "feeder": "FDR",
    "breaker": "BRK",
    "capacitor_bank": "CAP",
    "recloser": "RCL",
}


def generate_asset(type_counters, hero_ids):
    asset_type = random.choices(ASSET_TYPES, weights=ASSET_TYPE_WEIGHTS, k=1)[0]
    prefix = ID_PREFIX[asset_type]
    seq = type_counters[asset_type]
    type_counters[asset_type] += 1
    asset_id = f"{prefix}-{100 + seq}"
    substation = random.choice(SUBSTATIONS)

    # --- Hidden "condition" latent variable (0 = pristine, 1 = terrible) ---
    # This is what drives correlated degradation across fields. It is NOT
    # written to the CSV — it's an internal generation mechanism only.
    base_condition = random.betavariate(2, 5)  # skewed toward healthier assets, realistic

    # Hero assets get a deliberately elevated condition so they surface as
    # interesting high-risk, high-impact demo subjects later. Each hero gets
    # an explicit "degradation profile" rather than a uniform lift, so the
    # story the demo tells is intentional:
    #   TX-104  -> the deteriorating hero: an OLD, hot, vibrating transformer
    #              with poor oil. It fails the model's risk features so it
    #              lands HIGH/CRITICAL purely from the trained model — no
    #              prediction special-casing.
    #   TX-233  -> a healthier asset: deliberately LOWER failure risk than
    #              TX-104, but its huge downstream load / critical facilities
    #              give it very high GRID IMPACT (a separate axis from
    #              failure risk).
    #   others  -> modest lift (interesting but not scripted).
    hero_profiles = {
        "TX-104": {"condition_boost": 1.00},
        "TX-118": {"condition_boost": 0.45},
        "TX-142": {"condition_boost": 0.45},
        "TX-171": {"condition_boost": 0.45},
        "TX-205": {"condition_boost": 0.45},
        "TX-233": {"condition_boost": 0.15},
    }
    if asset_id in hero_ids:
        profile = hero_profiles[asset_id]
        base_condition = clamp(base_condition + profile["condition_boost"], 0, 1)

    # --- Age: older assets nudge condition worse. Hero TX-104 is pinned to an
    #     old age so its degradation reads clearly in the demo story. ---
    hero_age_override = {
        "TX-104": (36, 44),
    }.get(asset_id)
    if hero_age_override is not None:
        age_years = round(random.uniform(*hero_age_override), 1)
    else:
        age_years = round(random.uniform(1, 45), 1)
    age_factor = clamp(age_years / 45, 0, 1)
    condition = clamp(base_condition * 0.6 + age_factor * 0.4, 0, 1)

    # --- Temperature: baseline ~45-55C, worse condition runs hotter ---
    temperature = round(45 + condition * 35 + random.uniform(-4, 4), 1)  # ~41-88C
    temperature_trend = random.choices(
        ["rising", "stable", "falling"],
        weights=[0.25 + condition * 0.3, 0.55 - condition * 0.2, 0.20 - condition * 0.1],
        k=1,
    )[0]

    # --- Vibration (mm/s): worse condition + high load vibrates more ---
    load_percentage = round(clamp(random.gauss(60 + condition * 25, 12), 10, 130), 1)
    vibration = round(
        1.0 + condition * 4.5 + (load_percentage / 100) * 1.5 + random.uniform(-0.3, 0.3), 2
    )
    vibration = max(0.1, vibration)

    # --- Oil quality: 0-100, worse condition = lower score ---
    oil_quality = round(clamp(95 - condition * 60 + random.uniform(-8, 8), 5, 100), 1)

    # --- Maintenance history ---
    maintenance_days_ago = int(clamp(random.gauss(90 + condition * 250, 60), 1, 900))
    maintenance_count = max(0, int(random.gauss(6 - condition * 3, 2)))
    previous_failures = 0
    if condition > 0.55:
        previous_failures = int(random.choices([0, 1, 2, 3], weights=[30, 40, 20, 10])[0])
    else:
        previous_failures = int(random.choices([0, 1], weights=[85, 15])[0])

    # --- Weather exposure (shared regional flavor, still per-asset noise) ---
    weather_severity = round(clamp(random.gauss(35 + condition * 15, 20), 0, 100), 1)
    humidity = round(clamp(random.gauss(55, 15), 10, 100), 1)
    wind_speed = round(clamp(random.gauss(18, 10), 0, 90), 1)
    rainfall = round(max(0, random.gauss(40, 35)), 1)

    historical_incidents = previous_failures + int(random.random() < condition * 0.3)

    # --- Grid-impact-relevant fields (independent axis from failure risk) ---
    criticality = random.choices(CRITICALITY_LEVELS, weights=[0.45, 0.35, 0.20], k=1)[0]
    criticality_boost = {"Low": 0, "Medium": 1, "High": 2}[criticality]

    downstream_customers = int(
        max(20, random.gauss(400 + criticality_boost * 900, 350))
    )
    critical_facilities = int(
        clamp(random.gauss(criticality_boost * 1.1, 1.0), 0, 5)
    )
    neighbor_count = random.randint(1, 6)

    # Hero assets get amplified downstream impact so the What-If simulation
    # (Phase 3) has a genuinely dramatic story to tell. TX-233 is the demo's
    # "high grid impact, low failure risk" example, so it gets the largest
    # downstream footprint.
    if asset_id in hero_ids:
        hero_impact = {
            "TX-104": (2.2, 2.8, 2),
            "TX-233": (2.8, 3.4, 3),
        }.get(asset_id, (1.8, 2.6, 1))
        mult_lo, mult_hi, min_fac = hero_impact
        downstream_customers = int(downstream_customers * random.uniform(mult_lo, mult_hi))
        critical_facilities = max(critical_facilities, random.randint(min_fac, min_fac + 1))

    lat = round(random.uniform(*LAT_RANGE), 5)
    lon = round(random.uniform(*LON_RANGE), 5)

    # --- Training label: failure_within_horizon ---
    # Weighted, noisy function of the SAME fields above (not of `condition`
    # directly) so a model trained on visible columns can genuinely recover
    # real signal and produce honest feature importances.
    risk_signal = (
        0.22 * age_factor
        + 0.18 * clamp((temperature - 45) / 40, 0, 1)
        + 0.15 * clamp(vibration / 6, 0, 1)
        + 0.13 * clamp((100 - oil_quality) / 100, 0, 1)
        + 0.10 * clamp((load_percentage - 50) / 80, 0, 1)
        + 0.08 * clamp(maintenance_days_ago / 900, 0, 1)
        + 0.08 * clamp(previous_failures / 3, 0, 1)
        + 0.06 * clamp(weather_severity / 100, 0, 1)
    )
    # The raw linear combination above only spans a narrow probability band
    # (~0.12-0.67 for this dataset). Left alone, the Bernoulli label draw would
    # overlap so much that even a perfect model of the signal could only reach
    # ~0.65 ROC-AUC — the label would be nearly uncorrelated with the features,
    # which contradicts the docstring promise of "genuine, recoverable feature
    # importances". Stretch the band so healthy vs. degraded assets separate
    # cleanly while preserving the exact same ordering and weights.
    risk_signal = clamp((risk_signal - 0.42) * 3.0 + 0.5 + random.gauss(0, 0.03), 0.02, 0.98)
    failure_within_horizon = 1 if random.random() < risk_signal else 0

    return {
        "asset_id": asset_id,
        "asset_type": asset_type,
        "substation": substation,
        "location": substation.replace(" Substation", ""),
        "latitude": lat,
        "longitude": lon,
        "age_years": age_years,
        "temperature": temperature,
        "temperature_trend": temperature_trend,
        "vibration": vibration,
        "oil_quality": oil_quality,
        "load_percentage": load_percentage,
        "maintenance_days_ago": maintenance_days_ago,
        "maintenance_count": maintenance_count,
        "previous_failures": previous_failures,
        "weather_severity": weather_severity,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "rainfall": rainfall,
        "historical_incidents": historical_incidents,
        "criticality": criticality,
        "downstream_customers": downstream_customers,
        "critical_facilities": critical_facilities,
        "neighbor_count": neighbor_count,
        "failure_within_horizon": failure_within_horizon,
    }


ASSET_FIELDS = [
    "asset_id", "asset_type", "substation", "location", "latitude", "longitude",
    "age_years", "temperature", "temperature_trend", "vibration", "oil_quality",
    "load_percentage", "maintenance_days_ago", "maintenance_count",
    "previous_failures", "weather_severity", "humidity", "wind_speed", "rainfall",
    "historical_incidents", "criticality", "downstream_customers",
    "critical_facilities", "neighbor_count", "failure_within_horizon",
]


def generate_assets(num_assets, hero_ids):
    type_counters = {t: 0 for t in ASSET_TYPES}
    rows = [generate_asset(type_counters, hero_ids) for _ in range(num_assets)]

    generated_ids = set(r["asset_id"] for r in rows)
    missing_heroes = hero_ids - generated_ids
    if missing_heroes:
        # Extremely unlikely given ~35% transformer weight over 800 assets,
        # but fail loudly rather than silently shipping a broken topology
        # link if it ever happens (e.g. someone shrinks NUM_ASSETS a lot).
        raise RuntimeError(
            f"Hero transformer IDs {missing_heroes} were not generated — "
            f"increase NUM_ASSETS or lower the hero ID numbers."
        )
    return rows


# ---------------------------------------------------------------------------
# NETWORK / TOPOLOGY GENERATION
# ---------------------------------------------------------------------------
#
# A small, hand-composed graph (not derived from assets.csv) purposely kept
# to ~35-45 nodes so it stays visually understandable in the future
# What-If Simulation UI. Six "hero" transformers are wired with deliberately
# interesting downstream consequences: each feeds a zone that in turn feeds
# at least one critical facility, so failing them produces a dramatic and
# explainable cascade.

HERO_TRANSFORMER_IDS = ["TX-104", "TX-118", "TX-142", "TX-171", "TX-205", "TX-233"]


def build_network():
    nodes = []
    edges = []

    def add_node(node_id, node_type, label, **extra):
        node = {"id": node_id, "type": node_type, "label": label}
        node.update(extra)
        nodes.append(node)

    def add_edge(source, target, relation):
        edges.append({"source": source, "target": target, "relation": relation})

    # --- Substations (2) feed the whole hero topology ---
    add_node("SUB-A", "substation", "Vadodara Central Substation")
    add_node("SUB-B", "substation", "Anand Substation")

    # --- 6 hero transformers, split across the two substations ---
    hero_meta = [
        ("TX-104", "SUB-B", "Anand Substation"),
        ("TX-118", "SUB-A", "Vadodara Central Substation"),
        ("TX-142", "SUB-A", "Vadodara Central Substation"),
        ("TX-171", "SUB-B", "Anand Substation"),
        ("TX-205", "SUB-A", "Vadodara Central Substation"),
        ("TX-233", "SUB-B", "Anand Substation"),
    ]
    for tx_id, sub_id, sub_label in hero_meta:
        add_node(tx_id, "transformer", tx_id, substation=sub_label)
        add_edge(sub_id, tx_id, "supplies")

    # --- Each hero transformer feeds 1-2 zones ---
    zone_plan = {
        "TX-104": ["ZONE-1"],
        "TX-118": ["ZONE-2"],
        "TX-142": ["ZONE-3", "ZONE-4"],
        "TX-171": ["ZONE-5"],
        "TX-205": ["ZONE-6"],
        "TX-233": ["ZONE-7", "ZONE-8"],
    }
    zone_labels = {
        "ZONE-1": "Zone 1 - Anand East", "ZONE-2": "Zone 2 - Fatehgunj",
        "ZONE-3": "Zone 3 - Alkapuri", "ZONE-4": "Zone 4 - Sayajigunj",
        "ZONE-5": "Zone 5 - Karelibaug", "ZONE-6": "Zone 6 - Manjalpur",
        "ZONE-7": "Zone 7 - Gotri", "ZONE-8": "Zone 8 - Vasna",
    }
    for tx_id, zones in zone_plan.items():
        for z in zones:
            add_node(z, "zone", zone_labels[z])
            add_edge(tx_id, z, "feeds")

    # --- Each zone feeds a mix of hospital / industrial / residential nodes ---
    facility_plan = {
        "ZONE-1": [("HOSP-1", "hospital", "Anand City Hospital"),
                   ("RES-1", "residential", "Anand East Residential Area")],
        "ZONE-2": [("RES-2", "residential", "Fatehgunj Residential Area"),
                   ("IND-1", "industrial", "Fatehgunj Industrial Park")],
        "ZONE-3": [("HOSP-2", "hospital", "Alkapuri Multispecialty Hospital"),
                   ("RES-3", "residential", "Alkapuri Residential Area")],
        "ZONE-4": [("IND-2", "industrial", "Sayajigunj Industrial Estate")],
        "ZONE-5": [("RES-4", "residential", "Karelibaug Residential Area"),
                   ("HOSP-3", "hospital", "Karelibaug Community Hospital")],
        "ZONE-6": [("IND-3", "industrial", "Manjalpur Industrial Zone"),
                   ("RES-5", "residential", "Manjalpur Residential Area")],
        "ZONE-7": [("HOSP-4", "hospital", "Gotri Referral Hospital")],
        "ZONE-8": [("RES-6", "residential", "Vasna Residential Area"),
                   ("IND-4", "industrial", "Vasna Industrial Park")],
    }
    for zone_id, facilities in facility_plan.items():
        for fac_id, fac_type, fac_label in facilities:
            add_node(fac_id, fac_type, fac_label)
            add_edge(zone_id, fac_id, "feeds")

    # --- Neighboring feeders/transformers wired as "connects" so cascade
    #     logic (Phase 3) can identify assets to mark as stressed on failure ---
    neighbor_pairs = [
        ("TX-104", "TX-171"), ("TX-118", "TX-142"), ("TX-142", "TX-205"),
        ("TX-171", "TX-233"), ("TX-205", "TX-118"), ("TX-233", "TX-104"),
    ]
    for a, b in neighbor_pairs:
        add_edge(a, b, "connects")

    # --- A handful of extra feeders/breakers for topology richness (not heroes) ---
    extra_feeders = [
        ("FDR-1", "SUB-A", "Feeder 1"), ("FDR-2", "SUB-A", "Feeder 2"),
        ("FDR-3", "SUB-B", "Feeder 3"), ("FDR-4", "SUB-B", "Feeder 4"),
    ]
    for fdr_id, sub_id, label in extra_feeders:
        add_node(fdr_id, "feeder", label)
        add_edge(sub_id, fdr_id, "supplies")

    return {
        "description": "Synthetic demonstration grid topology — not real utility data.",
        "hero_transformers": HERO_TRANSFORMER_IDS,
        "nodes": nodes,
        "edges": edges,
    }


# ---------------------------------------------------------------------------
# ALERTS GENERATION
# ---------------------------------------------------------------------------

ALERT_TEMPLATES = [
    ("Critical temperature trend", "Sustained temperature rise beyond safe operating band", "High"),
    ("Unexpected vibration increase", "Vibration reading trending upward over recent cycles", "Medium"),
    ("High load", "Load percentage exceeding recommended sustained threshold", "High"),
    ("Weather risk", "Severe weather forecast increasing failure likelihood in area", "Medium"),
    ("Maintenance overdue", "Scheduled maintenance window has been exceeded", "Low"),
    ("Failure risk increased", "Recent sensor readings indicate elevated failure risk", "Critical"),
    ("Potential network overload", "Neighboring asset failure risk may cascade to this unit", "High"),
]

RECOMMENDED_ACTIONS = {
    "Critical temperature trend": "Schedule thermal inspection within 48 hours",
    "Unexpected vibration increase": "Dispatch technician for vibration analysis",
    "High load": "Evaluate load redistribution to neighboring assets",
    "Weather risk": "Pre-position crew and materials ahead of forecast weather",
    "Maintenance overdue": "Schedule routine maintenance visit",
    "Failure risk increased": "Prioritize for immediate inspection",
    "Potential network overload": "Monitor closely and prepare contingency crew",
}


def generate_alerts(asset_rows, num_alerts=60):
    # Bias alert generation toward higher-risk-looking assets so the alerts
    # feed feels connected to the dataset rather than arbitrary.
    weighted_assets = sorted(
        asset_rows,
        key=lambda a: (
            a["age_years"] + a["vibration"] * 5 + (100 - a["oil_quality"])
            + a["previous_failures"] * 10
        ),
        reverse=True,
    )
    pool = weighted_assets[: max(80, num_alerts * 2)]

    alerts = []
    now = datetime(2026, 9, 14, 9, 0, 0)
    for i in range(num_alerts):
        asset = random.choice(pool)
        title, reason, severity = random.choice(ALERT_TEMPLATES)
        timestamp = now - timedelta(hours=random.randint(0, 96), minutes=random.randint(0, 59))
        alerts.append({
            "alert_id": f"ALERT-{1000 + i}",
            "asset_id": asset["asset_id"],
            "substation": asset["substation"],
            "severity": severity,
            "title": title,
            "reason": reason,
            "recommended_action": RECOMMENDED_ACTIONS[title],
            "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        })

    alerts.sort(key=lambda a: a["timestamp"], reverse=True)
    return alerts


ALERT_FIELDS = [
    "alert_id", "asset_id", "substation", "severity", "title", "reason",
    "recommended_action", "timestamp",
]


# ---------------------------------------------------------------------------
# WRITE OUTPUT FILES
# ---------------------------------------------------------------------------

def write_csv(path, fieldnames, rows, disclaimer_field="asset_id"):
    with open(path, "w", newline="", encoding="utf-8") as f:
        f.write("# Synthetic demonstration data — not real utility data.\n")
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_network(path, network):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(network, f, indent=2)


def main():
    print(f"GridGuardian AI — generating synthetic dataset (seed={SEED})...")

    assets = generate_assets(NUM_ASSETS, hero_ids=set(HERO_TRANSFORMER_IDS))
    write_csv(f"{OUTPUT_DIR}/assets.csv", ASSET_FIELDS, assets)
    print(f"  wrote assets.csv  ({len(assets)} rows)")

    alerts = generate_alerts(assets, num_alerts=60)
    write_csv(f"{OUTPUT_DIR}/alerts.csv", ALERT_FIELDS, alerts)
    print(f"  wrote alerts.csv  ({len(alerts)} rows)")

    network = build_network()
    write_network(f"{OUTPUT_DIR}/network.json", network)
    print(f"  wrote network.json ({len(network['nodes'])} nodes, {len(network['edges'])} edges)")

    failure_rate = sum(a["failure_within_horizon"] for a in assets) / len(assets)
    print(f"\nSummary:")
    print(f"  total assets: {len(assets)}")
    print(f"  positive label rate (failure_within_horizon=1): {failure_rate:.1%}")
    print(f"  hero transformers: {', '.join(HERO_TRANSFORMER_IDS)}")
    print("\nDone. Remember: this is synthetic demonstration data only.")


if __name__ == "__main__":
    main()
