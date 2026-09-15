# Setup Guide

> **This file is read by the automated evaluation pipeline. Be precise and complete.**

## Prerequisites

Before you begin, ensure you have the following installed:

- [ ] Python 3.10+
- [ ] Node.js 18+
- [ ] npm (bundled with Node.js)

Optional:

- [ ] An Anthropic API key (`ANTHROPIC_API_KEY`) for the AI Operations Brief feature
      (all numeric features work without it)

## Environment Variables

Two `.env.example` files ship with placeholder values. Copy them to `.env` and fill in
real values only if you need the AI brief:

```bash
# Backend (from the repo root)
cp src/backend/.env.example src/backend/.env

# Generic template example (optional)
cp src/.env.example src/.env
```

> The real `.env` files are git-ignored and must never be committed.

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for the AI Operations Brief | No (graceful 503 without it) |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | No (defaults to `http://localhost:5173`) |
| `APP_ENV` | Application environment label | No (defaults to `development`) |

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/Omiworks/bob-ai-hackathon-VoltVision.git
cd bob-ai-hackathon-VoltVision

# 2. Install backend dependencies
cd src/backend
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Linux/macOS
pip install -r requirements.txt

# 3. Install frontend dependencies
cd ../frontend
npm install
```

## Running the Application

```bash
# Terminal 1 — start the backend (from src/backend)
python -m uvicorn app.main:app --reload
#   Backend:   http://127.0.0.1:8000
#   Swagger UI: http://127.0.0.1:8000/docs

# Terminal 2 — start the frontend (from src/frontend)
npm run dev
#   Frontend:  http://localhost:5173  (Vite proxies /api/* to :8000)
```

## Running Tests

From `src/backend`:

```bash
# ML model tests (Phase 2) — 13 tests
cd app/ml && python -m pytest test_predict.py -q

# Services tests (Phase 3 + 4) — 50 tests
cd ../services && python -m pytest test_phase3.py test_simulation.py -q

# API tests (Phase 5) — 42 tests
cd ../api && python -m pytest test_api.py -q
```

Total: **105 tests**.

## Reproduce Data (Phase 1 & 2)

```bash
cd src/backend/data      && python generate_data.py     # ~800 synthetic assets (seed 42)
cd src/backend/app/ml    && python train.py             # train Gradient Boosting model
cd src/backend/app/ml    && python score.py             # produce assets_scored.csv
cd src/backend/app/services && python score_priority.py # produce assets_prioritized.csv
```

## Quick Demo

1. Start backend and frontend as described above.
2. Open `http://localhost:5173` — you land on the Command Overview dashboard.
3. Walk through: Assets → pick an asset → What-If Simulation → Maintenance Priority →
   AI Operations Brief (requires `ANTHROPIC_API_KEY`).

## Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` again from `src/backend` |
| Frontend can't reach API | Ensure the backend is running on `:8000`; the Vite proxy forwards `/api/*` |
| AI brief returns 503 | `ANTHROPIC_API_KEY` is not set — set it in `src/backend/.env` or skip the brief |
| `model.pkl` missing | Run `python app/ml/train.py` from `src/backend` to retrain (regenerable, git-ignored) |
| CORS error in browser | Set `CORS_ORIGINS` to include your frontend origin in `src/backend/.env` |