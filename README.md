# 🚀 GridGuardian AI

> ⚠️ **Replace everything in `[ ]` brackets with your actual content before submission.**

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | VoltVision |
| **Track** | AI |
| **Team Lead** | Aum Vaja — 26dce115@charusat.edu.in |
| **Members** | Vrunda Kotadiya, Tarang Prajapati, Riza Bhatt |

---

## 🎯 Problem Statement

> In 2–3 sentences: What problem does your project solve? Who experiences this problem?

Electricity utilities manage thousands of critical assets such as transformers, feeders, breakers, and capacitors, making it difficult to identify which assets require attention before they fail. More importantly, a high probability of failure does not necessarily mean that an asset has the highest operational consequence, so maintenance decisions based only on failure prediction can be misleading.

Grid operators need a way to understand not only **what might fail**, but also **what could happen if it fails and what should be handled first**.

---

## 💡 Solution

> In 2–3 sentences: What did you build? How does it solve the problem above?

**GridGuardian AI** is a decision-support system for electricity utilities that combines machine learning, grid-impact analysis, failure simulation, maintenance prioritization, and generative AI explanations.

The system predicts asset failure risk from condition and maintenance data, independently estimates the potential grid impact, simulates what-if failure scenarios, calculates maintenance priority, and converts the structured results into an operational brief that helps users make informed decisions.

Our core idea is:

> **Don't just predict what might fail — help decide what to do about it.**

---

## ✨ Key Features

**Predictive Failure Risk:** Uses a Gradient Boosting machine-learning model to estimate the probability that a grid asset may fail within the prediction horizon.

- **Grid Impact Analysis:** Independently estimates the operational consequence of an asset failure using customers affected, critical facilities, network position, and asset criticality.

- **What-If Failure Simulation:** Simulates a hypothetical asset failure across the network to estimate affected zones, customers, critical facilities, network depth, and stressed assets.

- **Maintenance Priority Engine:** Combines failure risk, grid impact, criticality, and urgency to rank assets and identify which assets should receive attention first.

- **AI Operations Brief:** Uses generative AI to turn structured predictions, impact results, and simulation outcomes into concise operational explanations without allowing the AI to calculate or invent the underlying metrics.

- **Operations Dashboard:** Provides a centralized interface for monitoring asset health, risk, impact, priority, alerts, simulations, and model information.
---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python, JavaScript |
| **Frontend** | React, Vite, Tailwind CSS |
| **Backend** | FastAPI |
| **Machine Learning** | scikit-learn, Gradient Boosting |
| **Network Simulation** | NetworkX |
| **AI / Generative AI** | Generative AI operations-brief layer |
| **IBM Technologies** | IBM BoB AI Innovation Hackathon platform |
| **Data** | CSV, JSON, deterministic synthetic utility dataset |
| **Testing** | pytest |
| **Other** | GitHub Actions, REST API |


---

## 📁 Repository Structure

```text
├── backend/              # FastAPI backend, ML, simulation, and APIs
│   ├── app/
│   │   ├── api/          # REST API endpoints
│   │   ├── ml/           # Machine learning model and prediction
│   │   ├── models/       # Data models
│   │   ├── services/     # Impact, priority, AI, and business logic
│   │   └── simulation/   # Grid failure simulation
│   ├── data/             # Synthetic utility dataset and generated outputs
│   └── requirements.txt
├── frontend/             # React + Vite frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Application pages
│   │   └── services/     # Frontend API services
│   └── package.json
├── docs/                 # Project documentation
│   ├── PHASE2_REPORT.md
│   ├── PHASE3_REPORT.md
│   ├── PHASE4_REPORT.md
│   ├── PHASE5_REPORT.md
│   ├── FINAL_PROJECT_REPORT.md
│   ├── DEMO_SCRIPT.md
│   └── PITCH.md
├── screenshots/          # Application screenshots
├── presentation/         # Presentation and pitch materials
├── README.md
└── .gitignore

---

## ⚡ How to Run

> **Copy these exact steps from your [`docs/setup-guide.md`](docs/setup-guide.md)**

```bash
# 1. Clone the repo
git clone https://github.com/[your-repo].git
cd [your-repo]

# 2. Install dependencies
[your install command here]

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run the project
[your run command here]
```

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/slides.pdf](presentation/) |

---

## ⚠️ Known Limitations

> Be honest — judges appreciate transparency over overclaiming.

- [Limitation 1: e.g., "Authentication is mocked — not production-ready"]
- [Limitation 2: e.g., "Only tested on Chrome"]
- [Limitation 3: e.g., "Feature X is scaffolded but not fully implemented"]

---

## 🏅 What We're Most Proud Of

[Tell the judges what part of your submission is strongest and worth paying close attention to.]

---
