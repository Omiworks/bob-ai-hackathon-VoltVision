# GridGuardian AI — Phase 4 Report

> **⚠️ Synthetic demonstration data — not real utility data.**
> **This is a simplified graph-based failure-impact simulation over synthetic
> demonstration data. It is not a power-flow solver, digital twin, or validated
> utility outage model.**
>
> Simulation estimates consequences; it does not claim to predict physical
> electrical behavior.

Phase 4 delivers GridGuardian's signature feature: **"WHAT IF THIS ASSET FAILS?"**
The product moves from *PREDICT* to *PREDICT → SIMULATE → ASSESS IMPACT →
PRIORITIZE*. Given a single asset, the service deterministically simulates the
consequences of its failure using the actual `network.json` topology, and returns a
clean, transparent, explainable result that is independent of Phase 2 failure
probability.

---

## Files created / changed

| File | Status | Purpose |
|---|---|---|
| `backend/app/services/simulation.py` | **created** | Core simulation service (`simulate_asset_failure`, `compare_failure_scenarios`, `suggest_demo_assets`) |
| `backend/app/services/test_simulation.py` | **created** | 22-test suite (stdlib fallback runner + pytest) |
| `backend/app/services/write_simulation_examples.py` | **created** | Data-driven demo generator (no hardcoded results) |
| `backend/data/simulation_examples.json` | **created** | Real generated demo scenarios (TX-104, TX-233, CAP-109, CAP-126) |
| `docs/PHASE4_REPORT.md` | **created** | This report |
| `README.md` | changed | Phase 3/4 status + repository structure |

No Phase 1, Phase 2, or Phase 3 logic files were modified. (Phase 3 suites
`test_phase3.py` = 28/28 and Phase 2 `test_predict.py` = 13/13 still pass.)

---

## Network structure discovered

`network.json` models a 34-node / 38-edge synthetic grid:

- **2 substations** — SUB-A, SUB-B
- **6 hero transformers** in the graph — TX-104, TX-118, TX-142, TX-171, TX-205,
  TX-233 (all other ~794 assets are out-of-graph, identified only in assets.csv)
- **8 zones** — ZONE-1 … ZONE-8 (zones carry no customer totals)
- **Facilities** — HOSP-1…4 (criticality `hospital` → critical), RES-1…6
  (residential → low), IND-1…4 (industrial → high)
- **Feeder nodes** — FDR-1…4 (network nodes, not asset IDs; asset-level feeder
  assets are FDR-100+)

**Edge relations:**
- `supplies` — SUB → TX / FDR (directed, upstream-power direction)
- `feeds` — TX → ZONE, ZONE → facility (directed, downstream)
- `connects` — transformer ring, stored as undirected (104-171, 118-142, 142-205,
  171-233, 205-118, 233-104)

Zone feeds: ZONE-1→HOSP-1,RES-1; ZONE-2→RES-2,IND-1; ZONE-3→HOSP-2,RES-3;
ZONE-4→IND-2; ZONE-5→RES-4,HOSP-3; ZONE-6→IND-3,RES-5; ZONE-7→HOSP-4;
ZONE-8→RES-6,IND-4.

---

## Architecture

```
simulation.py
├── load_simulation_context()      # networkx DiGraph + asset map + node map (cached)
├── _downstream()                  # BFS over directed "feeds" edges only
├── affected_customers_estimate()  # asset's downstream_customers footprint
├── _stress_neighbors()            # connects-neighbors + supplying substation
├── calculate_severity()           # transparent 0–100 consequence score
├── severity_classify()            # LOW / MEDIUM / HIGH / CRITICAL
├── simulate_asset_failure()       # main entry point → structured dict
├── build_explanation_result()     # rule-based narrative from real result
├── compare_failure_scenarios()    # multi-asset wrapper (comparable fields)
└── suggest_demo_assets()          # automatic demo-pick (no special-casing)
```

**Main API:** `simulate_asset_failure(asset_id, ...)` raises `ValueError` for
unknown IDs, carries `network_node_present`, then returns:

```
failed_asset, asset_type, network_node_present,
affected_zones, affected_facilities (id/name/type/criticality),
critical_facilities_affected, critical_facility_ids, facility_source,
affected_assets, stressed_assets (asset_id/node_type/stress_score/reason),
estimated_customers_affected,
severity, severity_score, severity_factors, cascade_depth,
assumptions, explanation (headline/key_drivers/consequence_summary/recommended_follow_up)
```

---

## Network traversal method

Uses **NetworkX** (`networkx` already in `requirements.txt`). When an asset fails:

1. Find its network node (or handle out-of-graph assets).
2. **BFS downstream over directed `feeds` edges only** — zones reached and the
   facilities those zones feed become affected; cascade depth = longest hop count.
3. `connects` edges (the transformer ring) are **deliberately not traversed**:
   losing one transformer does not black out a sibling transformer's own zone —
   it only *stresses* the sibling (handled separately). `supplies` edges point
   upstream and are never walked downstream.
4. `affected_assets` lists downstream nodes that are also real asset IDs.

This is a **graph-impact simulation, not an electrical power-flow model** — that
distinction is documented in the output and this report.

---

## Customer impact methodology

`network.json` zones carry **no customer totals**, so a precise zone-level
deduplicated population is impossible. The estimate therefore uses the failed
asset's own synthetic `downstream_customers` field from `assets.csv` (the same
population the Phase 3 impact service uses).

- Single-population approach inherently **avoids double counting** the same
  customers referenced by multiple downstream nodes.
- Output is labeled *estimated* and the assumption is listed explicitly.
- Consequence estimate ≠ failure probability (they are strictly independent).

---

## Critical facility methodology

- **In-graph assets:** facility list comes from the actual graph traversal —
  named zones and facilities (hospital/residential/industrial) *actually*
  reachable downstream. Nothing is invented; criticality comes from
  `FACILITY_CRITICALITY = {hospital: critical, industrial: high, residential: low}`.
- **Out-of-graph assets** (no reachable named facilities): the asset's own
  `critical_facilities` count from `assets.csv` is reused (same source the Phase 3
  impact service uses) and clearly labeled via `facility_source: "asset_field"`;
  `facility_source: "graph"` for graph-derived facilities. No facility is
  fabricated — the field is the asset's own recorded metadata.

---

## Stress / cascade methodology

After the failed asset is removed, potentially strained neighbors are identified
deterministically:

- **Stress set** = direct transformer neighbors via `connects` + the supplying
  substation via `supplies`.
- Each stressed asset gets a **0–100 stress_score** computed from real asset
  fields, no randomness:

```
stress_score = 100 × (0.5 × distance_factor   # distance = 1 for direct neighbors
                    + 0.3 × load_percentage/100
                    + 0.2 × failure_probability)
```

`build_explanation_result()` derives its narrative (headline / key_drivers /
consequence_summary / recommended_follow_up) from the actual result dict — no LLM,
no hardcoded asset-specific narratives.

---

## Severity formula

Severity is **consequence**, never likelihood. It is fully decoupled from Phase 2
failure probability (test `test_failure_risk_independent_of_severity` guards this).

```
severity_score (0–100) =
    0.40 × customers_score
  + 0.30 × facilities_score
  + 0.15 × zones_score
  + 0.10 × stressed_score
  + 0.05 × depth_score
```

| Component | Formula | Range |
|---|---|---|
| customers_score | `100 × log10(1 + customers) / log10(8001)` | 0–100 |
| facilities_score | `min(100, 25 × critical_facilities_affected)` | 0–100 |
| zones_score | `min(100, (100/3) × affected_zones)` | 0–100 |
| stressed_score | `mean(stress_scores)` of stressed assets | 0–100 |
| depth_score | `min(100, (100/3) × cascade_depth)` | 0–100 |

Classification: **CRITICAL ≥ 75, HIGH ≥ 50, MEDIUM ≥ 25, otherwise LOW.**

> FAILURE RISK = "how likely to fail?"  **vs**  SIMULATION SEVERITY = "how bad if it fails?"

---

## Scenario comparison

`compare_failure_scenarios(asset_ids)` runs the single-asset simulation per ID and
returns comparable rows (customers, critical facilities, affected zones, stressed
assets, severity, severity score) plus a `worst` scenario, sorted by severity score
descending. This is a thin, deterministic wrapper that will power the future
frontend "What If?" page.

---

## Example scenarios (real outputs → `backend/data/simulation_examples.json`)

### TX-104 — hero transformer (high risk, in graph)
Risk 98.32% (CRITICAL) | **Severity HIGH 58.62** | facility_source: graph

- ZONE-1 affected; HOSP-1 (critical) + RES-1 downstream
- ~3,060 estimated customers affected; cascade depth 2
- Stressed: TX-171 (68.6), TX-233 (68.3), SUB-B (75.0)

### TX-233 — hero transformer (low risk, in graph) — auto-picked, worst case
Risk 0.52% (LOW) | **Severity HIGH 66.97** | facility_source: graph

- ZONE-7 + ZONE-8 affected; HOSP-4 (critical), IND-4, RES-6 downstream
- ~5,377 estimated customers affected; cascade depth 2
- Stressed: TX-171 (68.6), TX-104 (93.4), SUB-B (75.0)

**Product story:** TX-233 is the *lowest*-risk asset in the fleet, yet its failure
has the *largest* consequence of any simulated demo asset — proving
**likelihood ≠ consequence**, exactly what Phase 4 must demonstrate.

### CAP-109 — auto `high_risk_high_impact` (out of graph)
Risk 97.12% | **Severity HIGH 65.18** | facility_source: asset_field

- ~2,705 customers, 4 critical facilities (from asset metadata)
- Highest `failure_risk × grid_impact` of all 800 assets — genuinely risky AND impactful

### CAP-126 — auto `high_risk_low_impact` (out of graph)
Risk 99.77% | **Severity LOW 22.62** | facility_source: asset_field

- ~160 customers, 0 critical facilities — maximum risk, minimal consequences

---

## Assumptions (as returned by the service)

1. Simplified directed network model built from network.json.
2. Downstream dependencies (zones and the facilities they feed) are treated as
   affected when their supplying asset fails.
3. Customer impact is estimated from the failed asset's synthetic
   `downstream_customer` footprint (zone-level totals are not present in
   network.json).
4. Neighboring transformers and the supplying substation are treated as stressed
   if they may need to carry additional burden.
5. No electrical power-flow calculation is performed.

---

## Limitations

- Network topology models only the six hero transformers; ~794 assets are
  out-of-graph and handled via their asset-level metadata.
- No power-flow physics, load transfer capability analysis, or protection-system
  behavior.
- Customer and facility counts are synthetic estimates from generator data, not
  real utility records.
- Seven nodes (SUB-A/B, FDR-1…4) exist in network.json but are not asset IDs, so
  they cannot be simulated as failed assets (correct behavior — verified by test).

---

## Bugs found & fixed during Phase 4

1. **Ring crossover in downstream traversal** — a first cut walked `connects`
   (transformer ring) edges, making TX-104's failure black out sibling zones.
   Fixed: blackout cascades only over `feeds`; `connects` contributes only to
   neighbor stress.
2. **Inconsistent out-of-graph facilities** — out-of-graph assets reported 0
   critical facilities while Phase 3 impact credited their asset fields, giving an
   incoherent CRITICAL-priority / MEDIUM-severity story. Fixed: severity uses the
   asset-recorded `critical_facilities` count, labeled `facility_source: asset_field`.
3. **Weak demo auto-pick rule** — `suggest_demo_assets` minimized failure risk
   inside the top-decile impact set, which picked TX-147 (impact 61.9) over
   TX-233 (impact 83.0). Refined to "highest grid impact among assets with failure
   risk < 10%", which deterministically surfaces TX-233 — a better encoding of the
   role without special-casing.
4. **Asset IDs leaked into logic** — docstring/comment references to TX-104 in
   `simulation.py` tripped the "no asset IDs in simulation logic" test; removed.
5. **Demo writer reset** — replaced an ad-hoc hardcoded hero list with a data-driven
   "preferred heroes only if present in scored data" resolution.

---

## Tests

| Suite | Count | Result |
|---|---|---|
| Phase 2 `ml/test_predict.py` | 13 | 13/13 pass |
| Phase 3 `services/test_phase3.py` | 28 | 28/28 pass |
| Phase 4 `services/test_simulation.py` | 22 | 22/22 pass |
| **Total** | **63** | **63/63 pass** |

Phase 4 tests cover: known valid asset simulates; invalid ID fails clearly; stable
schema; zones/facilities are real network entities; non-negative customers; severity
0–100 and valid category; deterministic traversal; repeated identical output; no
random values; no asset IDs hardcoded into logic; isolated asset doesn't crash;
independent multi-asset simulation; comparison consistency; failure-risk independent
of severity; demo picks are valid; `assets_scored.csv` / `assets_prioritized.csv`
unchanged.

---

## Reproducibility commands

```bash
# Phase 4 tests (stdlib runner or pytest)
cd backend/app/services
python test_simulation.py
python -m pytest test_simulation.py -q

# Regenerate the demo output (real data-driven JSON, no hardcoded numbers)
python write_simulation_examples.py

# Full regression
cd ../ml && python test_predict.py          # Phase 2
cd ../services && python test_phase3.py     # Phase 3
```

Every number in `simulation_examples.json` is generated by actual code execution
(seed 42, no random values, pure functions).

---

## Product story

> GridGuardian doesn't just tell you what might fail. It lets you ask what happens
> if it does.

This simulation is the feature that will later become the centerpiece of the
dashboard demo — moving operators from **PREDICT** to
**PREDICT → SIMULATE → ASSESS IMPACT → PRIORITIZE**.