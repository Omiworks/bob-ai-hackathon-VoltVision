# GridGuardian AI — Demo Script

**IBM BoB AI Innovation Hackathon 2026 · Final Build (Phase 6)**

Goal of the demo: show the operator's question being answered end-to-end —
**"given limited crews, what do we do about it, right now?"** — with the
risk ≠ consequence story as the through-line. ~5 minutes with internet
(no LLM key required; the brief page handles the no-key state gracefully).

---

## Before the demo (5 min setup)

```bash
# Terminal 1 — backend
cd gridguardian/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload     # http://127.0.0.1:8000/docs

# Terminal 2 — frontend
cd gridguardian/frontend
npm install
npm run dev                                 # http://localhost:5173
```

- (Optional, for the live AI brief) `backend/.env` → set `ANTHROPIC_API_KEY`, restart.
- Pre-open the browser at `http://localhost:5173` and the screenshots in
  `docs/screenshots/` as a fallback in case of network issues.

---

## Act 1 — The problem (30s)

Open **Command Overview**. Point at the two callouts at the top:

> "Both of these assets matter. TX-104 has a **98%** predicted failure risk. TX-233
> has basically **zero** risk. Yet if either one fails, TX-233 hurts more — more
> customers, a hospital district. Risk alone would send the crew to the wrong asset."

## Act 2 — Evidence: risk vs consequence (1 min)

- Slide down the dashboard to **Risk vs consequence** scatter. "Every dot is an asset.
  TX-104 sits high (risky) but left of center (limited blast radius). TX-233 sits low
  (healthy) but far right — the worst-case worst."
- Note the priority distribution doughnut: only 21 assets are CRITICAL priority.

## Act 3 — What-If simulation (1.5 min)

Open **What-If Simulation**. Use the curated picks (one click each) or type:
`TX-104`, then click **Simulate failure**.

- Show the **consequence timeline** (zones → facilities → stressed neighbors →
  customers) and the **cascade diagram**.
- Add `TX-233` and hit **Compare scenarios** (or deep-link
  `/simulate?ids=TX-104,TX-233,CAP-109,CAP-126`):
  "Four assets, same grid. The worst consequence belongs to the *healthy*
  transformer — that's why priority ranks by impact, not just probability."

## Act 4 — Decide: crews & priority (1 min)

Open **Maintenance Priority**.

- "Priority = risk × impact × urgency. Cream of the list: CAP-109."
- Set crews to `3` and click **Allocate crews** → assigned list + uncovered breakdown.
  "Three crews live here, and the allocator shows the 77 critical/high assets they
  can't cover — so the operator sees the gap, not just the answer."

## Act 5 — The brief (with key) or the honest fallback (with/without key) (45s)

Open **AI Operations Brief**.

- *With key:* select TX-104 + TX-233 → **Generate brief**. The AI narrates the numbers;
  the **facts table** below proves every figure matches the numeric pages.
- *Without key:* the page shows **"AI brief unavailable — configure the LLM API key."**
  plus 3-step instructions — make the point that the product degrades gracefully and
  stays honest.

## Act 6 — Close (15s)

- **Asset Detail** on TX-104 shows the four-number cards (risk / impact / priority /
  severity) in one screen — "one number each, so an operator trusts them."
- Footer line everywhere: *Synthetic demonstration data — not real utility data.*

---

### Suggested talking points

- "The ML predicts; the simulation changes the decision; the priority makes it
  dispatchable; the LLM only narrates."
- "Nothing is hardcoded — the demo assets are *selected by rules from the live data*."
- "Deterministic, seeded, 102 tests — same input in, same answer out."
- "Highest-risk ≠ highest-consequence is a design principle, not a bug."

### URL shortcuts

- Dashboard: `http://localhost:5173/`
- Asset analysis: `http://localhost:5173/assets/TX-104`
- What-If single: `http://localhost:5173/simulate?ids=TX-104`
- What-If compare: `http://localhost:5173/simulate?ids=TX-104,TX-233,CAP-109,CAP-126`
- Priority: `http://localhost:5173/priority`
- API docs: `http://localhost:8000/docs`