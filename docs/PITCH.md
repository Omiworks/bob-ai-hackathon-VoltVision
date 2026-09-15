# GridGuardian AI — Pitch

**Predict. Simulate. Prioritize. Respond.**
*IBM BoB AI Innovation Hackathon 2026 · final build*

Use each slide as a markdown section — present it 5 minutes with the live app, or paste into a deck tool.

---

## Slide 1 — The operational question

Operators already know *what might fail*. The question that keeps them up at night:

> **Given 3 crews and 800 assets, who do we send — today?**

## Slide 2 — The dangerous default

Risk-only thinking is wrong:

| | TX-104 | TX-233 |
|---|---|---|
| Failure risk | **98%** | **0.5%** |
| ...but if it fails | 3,060 customers | **5,377 customers + hospital** |

**HIGH FAILURE RISK ≠ HIGH CONSEQUENCE.** Risk says "watch TX-104". Consequence says
"protect TX-233". The insight needs both numbers to be right.

## Slide 3 — The product

AI copilot that chains four honest systems:

1. **Predict** — gradient boosting failure probability (0–100 risk, per asset)
2. **Simulate** — deterministic cascade: *if this fails, what breaks next?*
3. **Prioritize** — transparent risk × impact × urgency score + crew allocation
4. **Explain** — LLM narrates a brief from backend numbers only — never recalculates

## Slide 4 — The four numbers that matter

For every asset, one screen, four numbers:

- **Failure risk** — how likely (model estimate)
- **Grid impact** — how big the blast radius
- **Priority** — where the crew goes
- **Severity** — what a failure actually simulates to

Trustability: each number is labeled, deterministic (seed 42), and testable.

## Slide 5 — What-If simulation

Pick an asset → see the cascade: zones, critical facilities, stressed neighbors,
customers, severity score 0–100. Deep-link it:

`/simulate?ids=TX-104,TX-233,CAP-109,CAP-126`

Compare four scenarios in one table — including the worst case you did not expect.

## Slide 6 — Crew allocation

3 crews in, assignments out — plus what stays **uncovered**:

- Assigned: CAP-109, FDR-263, FDR-143
- Uncovered: 77 critical/high-priority assets

The operator sees the gap, not just the answer.

## Slide 7 — Responsible AI

- LLM is a **narration layer**: structured facts in, brief out; system prompt forbids
  inventing numbers; "facts used" table shown next to every brief.
- Prediction ≠ certainty. Simulation ≠ power-flow physics. Labeled on every screen.
- Without an API key the app keeps working and says what to do.

## Slide 8 — Engineering

- **102/102 tests** (13 ML + 28 impact/priority + 22 simulation + 39 API)
- FastAPI with a strict, test-enforced error contract; logic lives only in tested services
- React + Vite + Tailwind + Recharts; production build green
- Fully synthetic, seeded, reproducible end-to-end

## Slide 9 — Ask / next step

A validated pilot on real feeder data with an engineering-grade power-flow layer —
keeping the same operator-facing product surface.

---

*Synthetic demonstration data — not real utility data. Hackathon prototype.*