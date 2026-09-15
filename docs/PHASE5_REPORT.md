# GridGuardian AI — Phase 5 Report

> **⚠️ Synthetic demonstration data — not real utility data.**
> **This is a simplified network-impact model, not an electrical power-flow
> simulator, and must not be used for real grid operational decisions.**

Phase 5 turns the already-tested Phase 2/3/4 services into a FastAPI backend —
a thin, reliable adapter for the future React dashboard. No business logic was
added to route handlers, no simulation/ML/priority formula was re-implemented,
and no Phase 1–4 logic was changed.

---

## Files created / changed

| File | Status | Purpose |
|---|---|---|
| `backend/app/main.py` | **rewritten** | FastAPI app, lifespan warm-up, CORS, error handling, routers, health/root |
| `backend/app/api/assets.py` | **created** | Asset list, detail, risk/impact/priority/explanation/simulation routes |
| `backend/app/api/simulation.py` | **created** | POST `/api/simulation` and `/api/simulation/compare` |
| `backend/app/api/priority.py` | **created** | GET `/api/priority/ranking` (precomputed Phase 3 ranking) |
| `backend/app/api/dashboard.py` | **created** | GET `/api/dashboard/summary` (one composite payload) |
| `backend/app/api/alerts.py` | **created** | GET `/api/alerts` (real alerts.csv records) |
| `backend/app/api/schemas.py` | **created** | Lightweight Pydantic request/response models |
| `backend/app/api/test_api.py` | **created** | 32-test API suite (stdlib runner + pytest) |
| `backend/app/services/registry.py` | **created** | Thin precomputed-data adapter (read-only, cached) |
| `docs/PHASE5_REPORT.md` | **created** | This report |
| `README.md` | changed | Phase 5 status, API docs, startup/verify commands |

No Phase 1–4 data files, service modules, or formulas were modified.
`backend/requirements.txt` already contained `fastapi`, `uvicorn`, and
`pydantic` — no new runtime dependencies were added.

---

## Architecture

```
Existing tested intelligence (unchanged)
├── app/ml/predict.py          Phase 2 model + risk categories
├── app/services/impact.py     Phase 3 grid impact (0–100)
├── app/services/priority.py   Phase 3 priority formula + ranking
├── app/services/explanations.py  Phase 3 rule-based explanations
└── app/services/simulation.py Phase 4 what-if graph cascade
            │
            ▼
app/services/registry.py       thin cached adapter (precomputed CSVs + service calls)
            │
            ▼
app/api/*.py                   routers (input validation + HTTP mapping only)
            │
            ▼
app/main.py                    FastAPI app (CORS, error handlers, lifespan)
            │
            ▼
Future React dashboard  (localhost:5173, CORS-enabled — NOT built yet)
```

Design rules applied:
- **No business logic in routes** — handlers validate input and call either
  `registry` (precomputed reads) or the existing services directly.
- **No re-implementation** — asset list/ranking serve `assets_prioritized.csv`
  unchanged; impact/priority detail reuse `impact.compute_grid_impact` and
  `priority.compute_urgency`; simulation calls `simulation.simulate_asset_failure`
  / `compare_failure_scenarios`.
- **Deterministic & fast** — the registry loads the CSVs once and caches;
  sorting uses stable `(value desc, asset_id)` tie-breaking.

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service banner |
| GET | `/api/health` | Health + endpoint list |
| GET | `/api/assets` | Asset list (`risk_category`, `priority_category`, `asset_type`, `search`, `limit`, `offset`, `sort=priority\|risk\|impact`) |
| GET | `/api/assets/{asset_id}` | Combined `asset` + `risk` + `impact` + `priority` + `explanation` |
| GET | `/api/assets/{asset_id}/risk` | ML failure probability, risk % and category (Phase 2) |
| GET | `/api/assets/{asset_id}/impact` | Grid impact + component breakdown (Phase 3) |
| GET | `/api/assets/{asset_id}/priority` | Priority score/category + urgency + reason (Phase 3) |
| GET | `/api/assets/{asset_id}/explanation` | Rule-based risk/impact factors + priority reason |
| GET | `/api/assets/{asset_id}/simulation` | Phase 4 what-if result |
| GET | `/api/priority/ranking` | Ranked assets (`limit`, `offset`, `risk_category`, `priority_category`, `asset_type`) |
| GET | `/api/dashboard/summary` | One composite dashboard payload |
| GET | `/api/alerts` | Real alerts (`limit`, `severity`, `substation`, `asset_id`) |
| POST | `/api/simulation` | `{"asset_id": "TX-104"}` → `{asset_id, simulation}` |
| POST | `/api/simulation/compare` | `{"asset_ids": ["TX-104","TX-233"]}` → comparable scenarios + worst |

HTTP semantics: **200** ok · **400** invalid filter/sort/body · **404** unknown
asset · **422** malformed body (FastAPI validation) · **500** only for genuine
server errors (never exposes a stack trace).

---

## Dashboard summary structure

`GET /api/dashboard/summary` returns real computed data:

```json
{
  "assets": {"total": 800},
  "risk":   {"CRITICAL": 65, "HIGH": 96, "MEDIUM": 160, "LOW": 479},
  "priority": {"CRITICAL": 21, "HIGH": 59, "MEDIUM": 105, "LOW": 615},
  "critical_high_priority": {"count": 80, "critical": 21, "high": 59},
  "highest_risk": {...summary...},
  "highest_impact": {...summary...},
  "top_priority": {...summary...},
  "customers": {
    "total_estimated_footprint": ...,
    "in_critical_high_risk": ...,
    "in_critical_high_priority": ...
  },
  "alerts": [ ...real records... ],
  "model": {"algorithm": "GradientBoostingClassifier", "roc_auc": 0.8672,
            "accuracy": 0.825, "f1": 0.7544, "synthetic": true, ...},
  "synthetic_data": {"synthetic": true, "status": "..."}
}
```

Every number is computed from the precomputed CSVs and metrics.json — nothing is
hardcoded.

---

## Example responses (live)

### GET `/api/assets/TX-104` (combined)

```json
{
  "asset": {
    "asset_id": "TX-104", "asset_type": "transformer", "criticality": "Medium",
    "substation": "SUB-B", "location": "Halol", "load_percentage": 98.4,
    "downstream_customers": 3060, "critical_facilities": 3, ...
  },
  "risk":   {"asset_id": "TX-104", "failure_probability": 0.9832,
             "failure_risk_percent": 98.32, "risk_category": "HIGH"},
  "impact": {"asset_id": "TX-104", "grid_impact": 70.97,
             "components": {"customer": 89.31, "facility": 60.0,
                            "criticality": 45.0, "network": 75.0}, ...},
  "priority": {"asset_id": "TX-104", "priority_score": 71.29,
               "priority_category": "HIGH", "urgency": 1.35,
               "priority_reason": "High failure risk combined with high grid impact -> HIGH priority"},
  "explanation": {"risk_factors": ["High vibration", "Very high model failure risk", ...],
                  "impact_factors": ["High downstream customer count", ...],
                  "priority_reason": "..."}
}
```

### GET `/api/assets/TX-104/simulation`

```json
{
  "failed_asset": "TX-104",
  "network_node_present": true,
  "affected_zones": ["ZONE-1"],
  "affected_facilities": [{"id": "HOSP-1", "name": "Anand City Hospital", ...}],
  "critical_facilities_affected": 1,
  "stressed_assets": [{"asset_id": "TX-171", "stress_score": 68.6}, ...],
  "estimated_customers_affected": 3060,
  "severity": "HIGH",
  "severity_score": 58.62,
  "cascade_depth": 2,
  "assumptions": [...],
  "explanation": {...}
}
```

---

## Tests by phase

| Suite | File | Result |
|---|---|---|
| Phase 2 | `app/ml/test_predict.py` | 13/13 pass |
| Phase 3 | `app/services/test_phase3.py` | 28/28 pass |
| Phase 4 | `app/services/test_simulation.py` | 22/22 pass |
| Phase 5 | `app/api/test_api.py` | 32/32 pass |
| **Total** | | **95/95 pass** |

Phase 5 coverage: health, dashboard structure, asset list defaults/filters
(risk/priority/asset_type/search/limit/offset/sort), invalid filter/sort → 400,
combined detail view, risk/impact/priority/explanation endpoints, GET+POST
simulation, unknown asset → 404, missing body → 422, simulation compare +
worst-case, priority ranking + distribution filter, alerts + severity filter,
CORS header on localhost origin, no traceback leakage on 404.

---

## Bugs found & fixed during Phase 5

1. **Sort-by-risk returned garbage** — `SORT_FIELDS["risk"]` pointed at
   `failure_risk`, a column that only exists in `assets_prioritized.csv`; the
   joined records carry `failure_risk_percent`. Every asset sorted as 0. Fixed
   the mapping to the real column.
2. **Invalid `sort` returned 422 not 400** — a FastAPI `pattern` regex on the
   query param intercepted the value before the app's ValueError→400 handler.
   Removed the pattern so invalid sort values flow through as 400 invalid
   request (consistent with the error contract).
3. **Tie-order test bug** — asset sorting uses a stable `(-value, asset_id)`
   key (ties exist, e.g. several 99.85% risk assets); a naive reverse-sort test
   comparison was flaky. Fixed the test to assert the exact documented tie-break.
4. **`on_event("startup")` deprecation** — modernized to a `lifespan` handler
   (warnings eliminated; suite runs warning-clean).
5. **Alerts count field** — `/api/alerts` briefly returned a list for
   `total_available`; corrected to a real count.
6. **Registry merge noise** — an early draft merged CSVs with `suffixes` and
   referenced non-existent `_reported` keys; rewritten to a clean indexed
   lookup without pandas merge.

---

## How to start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Then open Swagger UI at **http://127.0.0.1:8000/docs** (auto-generated, works).

### Verify

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/dashboard/summary
curl http://127.0.0.1:8000/api/assets?limit=5
curl http://127.0.0.1:8000/api/assets/TX-104
curl http://127.0.0.1:8000/api/assets/TX-104/simulation
curl -X POST http://127.0.0.1:8000/api/simulation -H "Content-Type: application/json" -d '{"asset_id":"TX-233"}'
curl -X POST http://127.0.0.1:8000/api/simulation/compare -H "Content-Type: application/json" -d '{"asset_ids":["TX-104","TX-233"]}'
```

### Run all tests

```bash
cd backend/app/api && python test_api.py            # Phase 5
cd backend/app/services && python -m pytest test_phase3.py test_simulation.py
cd backend/app/ml && python test_predict.py         # Phase 2
```

---

## Frontend CORS

CORS allows the local Vite dev server by default:

- `http://localhost:5173`
- `http://127.0.0.1:5173` (both added)

Override with the `CORS_ORIGINS` environment variable (comma-separated):

```bash
CORS_ORIGINS="http://localhost:5173" python -m uvicorn app.main:app --reload
```

---

## Synthetic-data limitation (as documented everywhere)

- This API serves **synthetic demonstration data** and a **simplified network
  model**.
- It is **not** a power-flow solver, digital twin, or validated utility outage
  model.
- The LLM is not part of this API; every number is produced by the tested ML /
  impact / priority / simulation code.