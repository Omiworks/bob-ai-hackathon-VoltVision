# Solution Overview

## What We Built

**GridGuardian AI** is a decision-support copilot for electric-grid operators. It
combines four honest systems into one web application:

| Stage | System | Produces |
|---|---|---|
| **Predict** | ML (Gradient Boosting) | Failure probability, per asset |
| **Simulate** | Deterministic graph cascade | "What happens if this fails?" |
| **Prioritize** | Transparent scoring formula | "What should we do first?" |
| **Explain** | Generative AI (narration only) | Human-readable operations brief |

The LLM **never** invents a number — it only narrates numbers that the ML/simulation/
priority code already calculated and handed to it as structured JSON.

## How It Works

1. **Predict** — A Gradient Boosting model is trained on deterministic synthetic asset
   data (seed 42) and scores every asset with a failure probability between 0 and 1.
2. **Simulate** — The What-If engine runs a deterministic graph cascade over the
   `network.json` grid topology: if asset X fails, which zones, customers, critical
   facilities, and neighboring assets are affected?
3. **Prioritize** — A transparent, documented scoring formula combines failure risk,
   grid impact, asset criticality, and urgency into a ranked maintenance priority for
   every asset. Crew allocation uses a greedy allocation over the ranking.
4. **Explain** — The backend packages the structured results (risk, impact, priority,
   simulation) into JSON and sends it to a generative-AI brief endpoint that narrates
   the situation in plain language without recalculating anything.
5. **Respond** — The React operations console (Overview, Asset Analysis, Asset Detail,
   What-If, Maintenance Priority, Alerts, AI Brief, Model & Data) lets an operator
   review all of it and allocate crews.

## Architecture Diagram

> See [`architecture.md`](architecture.md) for the detailed description.

```
[Operator/Browser]
      │  HTTPS
      ▼
[React + Vite + Tailwind — operations console]
      │  /api/* (Vite dev proxy)
      ▼
[FastAPI backend (REST, thin adapters)]
      ├── /api/assets, /api/assets/{id}/{risk,impact,priority,simulation}
      ├── /api/simulation, /api/simulation/compare, /api/simulation/demo
      ├── /api/priority/ranking, /api/priority/allocate
      ├── /api/dashboard/summary, /api/alerts, /api/model/features
      └── /api/ai/brief ──▶ Generative AI (narration only; fails to 503 without key)
              │
      ML / scoring / impact / simulation / priority  ──▶  data/ (assets.csv, network.json, ...)
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Chain four independent, transparent systems (predict / simulate / prioritize / explain) | Failure risk is not the same as operational impact; each stage is honest about what it computes |
| LLM used for narration only, fed structured JSON | The AI cannot invent or recalculate numbers, so the brief stays truthful |
| Deterministic synthetic dataset (seed 42) | Reproducible training, scoring, prioritization, and simulation for verification and judging |
| Thin FastAPI routers over tested services | No business logic in route handlers; all logic is unit-tested (105 tests) |
| Precomputed-data registry loaded at startup | Fast first requests and validation of data at boot |

## IBM Technologies Used

- **IBM BoB AI Innovation Hackathon platform:** the submission is built and packaged
  according to the official BoBathon template (submission.yaml, validated GitHub
  Actions workflow, standardized docs/artifacts layout).
- **Generative AI layer:** the AI operations brief uses the Anthropic API via the
  `anthropic` Python SDK; the backend enforces a strict "narration only" contract so
  the model describes computed metrics without inventing values. Without an API key it
  degrades gracefully (HTTP 503) while every numeric page keeps working.