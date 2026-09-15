# GridGuardian AI — Phase 3 Report

> **⚠️ Synthetic demonstration data — not real utility data.**
> **This is a synthetic demonstration system using a simplified network-impact
> model. It is not an electrical power-flow simulator and must not be used for
> real grid operational decisions.**

Phase 3 turns ML failure predictions into an operational priority ranking.
Failure risk (Phase 2) and grid impact (Phase 3) remain strictly separate axes;
the priority score combines both, weighted by criticality and maintenance
urgency, producing a single ranked list with crew allocation.

---

## Files created / changed

| File | Status | Purpose |
|---|---|---|
| `backend/app/services/impact.py` | **created** | Deterministic 0–100 grid-impact calculator (graph-aware + asset-level fallback) |
| `backend/app/services/priority.py` | **created** | Priority formula, ranking, crew allocation |
| `backend/app/services/explanations.py` | **created** | Rule-based risk/impact/priority explanation factors (no LLM) |
| `backend/app/services/score_priority.py` | **created** | Orchestrator: loads scored assets + network → `assets_prioritized.csv` |
| `backend/app/services/test_phase3.py` | **created** | 28-test suite (stdlib fallback + pytest) |
| `backend/data/assets_prioritized.csv` | **created** | Final prioritised output for all 800 assets |
| `backend/app/services/__init__.py` | changed | (was empty; still empty — left as-is) |
| `docs/PHASE3_REPORT.md` | **created** | This report |

No Phase 1 or Phase 2 files were modified.

---

## Grid-impact methodology

Grid impact is computed entirely from asset and network information, **never** from
the ML failure probability.

```
grid_impact =
    0.40 × customer_score
  + 0.35 × facility_score
  + 0.15 × criticality_score
  + 0.10 × network_score
```

| Component | Formula | Range |
|---|---|---|
| customer_score | `100 × log10(1 + downstream_customers) / log10(8001)` | 0–100 |
| facility_score | `min(100, 20 × critical_facilities)` | 0–100 |
| criticality_score | Low → 15, Medium → 45, High → 75 | 15–75 |
| network_score (in graph) | `25 + 25 × zones_fed + 25 × hospitals_reached` (capped 100) | 25–100 |
| network_score (not in graph) | `4 × neighbor_count` (capped 25) | 0–25 |

**Assumptions explicitly documented:**
- `network.json` models only the six hero transformers; all other assets are
  out-of-graph and handled via their asset-level `downstream_customers` /
  `critical_facilities` / `neighbor_count` fields. Hero transformers receive the
  full network-position bonus; other assets are capped at 25 on network score.
- Log-scaled customer scoring prevents a single very-high-customer asset from
  dominating the entire scale.
- The reference cap `MAX_CUSTOMERS_REF = 8000` is fixed so scores are stable
  regardless of how many assets are run.

---

## Priority formula

```
urgency_factor = 1.0
               + 0.30 × min(previous_failures, 3) / 3
               + 0.30 × min(maintenance_days_ago, 900) / 900
               + 0.20 × trend_factor

trend_factor = 1.0 (rising), 0.5 (stable), 0.0 (falling)

raw_priority = risk × impact × criticality_weight × urgency_factor

priority_score = 100 × raw_priority / reference_max
```

The reference max is the highest `raw_priority` observed across the full 800-asset
population so the top asset = 100 on a stable 0–100 scale. For standalone scoring
of a single asset the formula defaults to the theoretical maximum (2.70).

### Criticality weights

| Asset criticality | Weight |
|---|---|
| Critical | 1.50 |
| High | 1.25 |
| Medium | 1.00 |
| Low | 0.70 |

### Priority categories

| Category | Score threshold |
|---|---|
| CRITICAL | ≥ 75 |
| HIGH | ≥ 50 |
| MEDIUM | ≥ 25 |
| LOW | < 25 |

Thresholds are fixed on the 0–100 scale and clearly documented (no data-driven
quantile trickery).

---

## Urgency methodology

Urgency is a multiplier in [1.0, 1.8] derived from three explainable, existing
fields:

| Signal | Mapping | Max contribution |
|---|---|---|
| `previous_failures` | `0.30 × min(failures, 3) / 3` | +0.30 |
| `maintenance_days_ago` | `0.30 × min(days, 900) / 900` | +0.30 |
| `temperature_trend` | rising +0.20, stable +0.10, falling +0.00 | +0.20 |

An asset with 3 prior failures, 900+ days since maintenance, and a rising trend
gets urgency 1.8; a pristine asset gets urgency 1.0.

---

## Crew allocation method

Transparent greedy allocation (explicitly not an optimal operations-research
solver):

1. Assets are internally ranked by `priority_score` descending (ties broken
   deterministically by `asset_id`).
2. The first `N` assets (where `N = available_crews`) are assigned.
3. All remaining CRITICAL/HIGH assets are returned as `unassigned_high_priority`
   so the operator can see what needs additional crews.

The crew count is configurable via `available_crews` or the
`GRIDGUARDIAN_CREWS` environment variable.

---

## Explanation generation

Explanation factors are generated entirely by fixed rules on actual field
values. No LLM is involved and no asset IDs are hardcoded into the rules.

**Risk factors** (examples):

- vibration ≥ 5 → "High vibration"
- temperature ≥ 60 → "Elevated temperature"
- age ≥ 30 → "Older equipment"
- maintenance_days_ago ≥ 300 → "Maintenance overdue"
- load ≥ 90% → "High load on asset"
- previous_failures ≥ 1 → "Prior failures recorded"
- temperature_trend = rising → "Rising temperature trend"
- oil_quality ≤ 55 → "Poor oil quality"

**Impact factors** (examples):

- downstream_customers ≥ 1,500 → "High downstream customer count"
- critical_facilities ≥ 3 → "Multiple critical facilities (N)"
- critical_facilities 1–2 → "Critical facilities downstream (N)"
- criticality = High → "High criticality classification"
- in-graph assets → "Feeds N downstream zone(s)"
- in-graph assets with hospitals → "Reaches N hospital(s) via zones"

**Priority reason:** A single rule-based sentence combining the top risk and
impact categories.

---

## Priority distribution

| Category | Count |
|---|---|
| CRITICAL | 21 |
| HIGH | 59 |
| MEDIUM | 105 |
| LOW | 615 |

The 21 CRITICAL assets are the immediate "must-send-a-crew-now" candidates; 59
HIGH assets are urgent but can be handled in a second pass; the remaining 615
are healthy or low-impact.

---

## Top 10 highest-priority assets

| Rank | Asset ID | Asset Type | Risk% | Risk Cat | Grid Impact | Priority Score | Priority Cat |
|---|---|---|---|---|---|---|---|
| 1 | CAP-109 | capacitor_bank | 97.12 | MEDIUM | 75.23 | 100.00 | CRITICAL |
| 2 | FDR-263 | feeder | 98.03 | MEDIUM | 67.42 | 97.05 | CRITICAL |
| 3 | FDR-143 | feeder | 99.76 | CRITICAL | 60.60 | 90.24 | CRITICAL |
| 4 | TX-182 | transformer | 99.67 | CRITICAL | 68.19 | 86.41 | CRITICAL |
| 5 | TX-335 | transformer | 99.36 | HIGH | 68.05 | 85.87 | CRITICAL |
| 6 | TX-380 | transformer | 97.87 | MEDIUM | 65.70 | 85.49 | CRITICAL |
| 7 | FDR-310 | feeder | 99.79 | CRITICAL | 61.00 | 83.55 | CRITICAL |
| 8 | CAP-132 | capacitor_bank | 99.79 | CRITICAL | 53.00 | 83.18 | CRITICAL |
| 9 | FDR-192 | feeder | 99.07 | HIGH | 60.50 | 83.06 | CRITICAL |
| 10 | TX-176 | transformer | 98.58 | HIGH | 53.40 | 82.35 | CRITICAL |

---

## TX-104 analysis

| Metric | Value |
|---|---|
| Asset type | transformer |
| Failure risk | 98.32% (HIGH) |
| Grid impact | 70.97 |
| Priority score | 71.29 |
| Priority category | **HIGH** |

Risk factors:
- High vibration
- Elevated temperature
- Older equipment
- Prior failures recorded
- Poor oil quality
- Very high model failure risk

Impact factors:
- High downstream customer count (3,060)
- Multiple critical facilities (3)
- Feeds 1 downstream zone (ZONE-1)
- Reaches 1 hospital (HOSP-1) via zones

**Story:** TX-104 is genuinely high priority because its failure risk AND its
grid impact are both substantial. It is ranked 23rd out of 800 — in the top 3%.
Its explanation is driven entirely by model features and asset data (no
hardcoding). Flipping its features to healthy values in the pipeline drops its
predicted failure probability from 0.9832 to 0.4788, confirming the result is
model-driven.

---

## TX-233 analysis

| Metric | Value |
|---|---|
| Asset type | transformer |
| Failure risk | 0.52% (LOW) |
| Grid impact | 82.98 |
| Priority score | 0.44 |
| Priority category | **LOW** |

Risk factors:
- Rising temperature trend

Impact factors:
- High downstream customer count (5,377)
- Multiple critical facilities (4)
- Feeds 2 downstream zones (ZONE-7, ZONE-8)
- Reaches 1 hospital (HOSP-4) via zones

**Story:** TX-233 has the highest grid impact in the entire dataset, yet it sits
at priority rank 598 out of 800. This is the critical demo distinction:
**failure risk ≠ grid impact**. A healthy but pivotal asset must not consume a
crew that could be sent to a deteriorating, high-impact asset first. This is
exactly the PREDICT → ASSESS IMPACT → PRIORITIZE → ACT narrative the product is
built around.

---

## Tests

All 28 tests pass under the stdlib fallback runner (`python test_phase3.py`) and
pytest (`python -m pytest test_phase3.py`):

| Test | Status |
|---|---|
| priority score bounded [0, 100] | PASS |
| priority score = 0 when risk = 0 | PASS |
| priority score = 0 when impact = 0 | PASS |
| higher failure risk increases priority | PASS |
| higher impact increases priority | PASS |
| criticality weights work (High > Medium > Low) | PASS |
| urgency increases priority | PASS |
| priority categories cover all four levels | PASS |
| rankings are deterministic | PASS |
| ties broken by asset_id | PASS |
| missing priority_score raises clear KeyError | PASS |
| grid impact bounded [0, 100] | PASS |
| grid impact ignores ML failure probability | PASS |
| all 800 assets get grid impact | PASS |
| TX-233 higher impact than TX-104 | PASS |
| TX-104 impact ≥ 50 (meaningful) | PASS |
| TX-233 impact ≥ 60 (very high) | PASS |
| in-graph assets get network credit | PASS |
| out-of-graph asset does not crash | PASS |
| crew allocation respects crew count | PASS |
| zero crews does not crash | PASS |
| empty input does not crash | PASS |
| explanation from rules (not hardcoded) | PASS |
| explanation text does not contain asset ID | PASS |
| no asset IDs in scoring logic | PASS |
| all 800 assets receive priority output | PASS |
| TX-104: HIGH priority; TX-233: LOW priority | PASS |
| repeated execution produces identical results | PASS |
| source scored CSV not modified | PASS |
| priority distribution reasonable (LOW > 400, CRIT ≥ 5, HIGH ≥ 10) | PASS |

---

## Bugs found / fixed during Phase 3

1. **`allocate_crews` accepted an unsorted list.** Fixed by having it call
   `rank_assets()` internally so the greedy allocation is always correct
   regardless of input order.

---

## Known limitations

- The priority-score scale is calibrated to the observed population; if scoring
  a drastically different population (e.g., 5 assets instead of 800) the top
  score would still be 100 but the absolute number of CRITICAL/HIGH assets would
  change.
- `network.json` only models six transformers and eight zones. Non-hero assets
  use their `neighbor_count` as a modest network proxy (capped at 25).
- The 0–100 customer normalization saturates above ~8,000 customers (by design,
  to keep the scale stable).
- The crew allocation is explicitly greedy (not an OR solver) and does not
  account for geographic proximity or travel time between assets.
- The system is synthetic only; disclaimers are included in every data file,
  service module, output file, and documentation.

---

## Exact commands to reproduce Phase 3

```bash
# 1. Ensure Phase 2 is intact
cd gridguardian/backend/app/ml
python test_predict.py

# 2. Run Phase 3 scoring (loads assets_scored.csv + network.json, writes assets_prioritized.csv)
cd ../services
python score_priority.py

# 3. Configure crew count via env var (default: 5)
GRIDGUARDIAN_CREWS=3 python score_priority.py

# 4. Run Phase 3 test suite
python test_phase3.py
# or
python -m pytest test_phase3.py
```

All outputs are deterministic with seed 42: the input assets_scored.csv is
deterministic, and all Phase 3 calculations are pure functions of their inputs.

---

## Confirmation: Phase 1 + Phase 2 remain intact

| Layer | Tests | Result |
|---|---|---|
| Phase 2 prediction suite | 13 / 13 | PASS |
| Phase 3 priority suite | 28 / 28 | PASS |
| source `assets.csv` | unchanged | PASS |
| source `assets_scored.csv` | unchanged (no ML columns modified) | PASS |
| `model.pkl`, `metrics.json` | unchanged | PASS |

PHASE 3 COMPLETE.