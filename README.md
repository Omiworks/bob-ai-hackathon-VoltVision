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

```bash
# 1. Clone the repository
git clone https://github.com/Omiworks/bob-ai-hackathon-VoltVision.git
cd bob-ai-hackathon-VoltVision

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt

# 3. Start the backend
python -m uvicorn app.main:app --reload

# Backend API: http://127.0.0.1:8000
# API documentation: http://127.0.0.1:8000/docs

# 4. Open a SECOND terminal and start the frontend
cd bob-ai-hackathon-VoltVision/frontend
npm install
npm run dev

# 5. Open the local URL shown by Vite in your browser

## 🖥️ Demo

| Artifact | Location |
|---|---|
| 🖼️ Screenshots | [See screenshots/](screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |
| 📚 Documentation | [See docs/](docs/) |
| 🔌 API Documentation | `http://127.0.0.1:8000/docs` when running locally |

---

## ⚠️ Known Limitations

> Be honest — judges appreciate transparency over overclaiming.

- The current prototype uses deterministic synthetic utility data rather than live utility data.
- The network failure simulation is a simplified graph-based model and is not a production electrical power-flow solver or digital twin.
- The machine-learning model has not yet been validated against real-world utility datasets.
- Production deployment would require secure integration with authorized utility data sources and additional operational validation.

---

## 🏅 What We're Most Proud Of

GridGuardian AI goes beyond simply predicting which grid asset might fail. It combines failure prediction with independent grid-impact analysis, what-if failure simulation, maintenance prioritization, and AI-generated operational explanations.

Our key insight is that **failure risk is not the same as operational impact**. GridGuardian helps operators understand both dimensions and turn them into a practical maintenance decision.

> **Don't just predict what might fail — help decide what to do about it.**

---
