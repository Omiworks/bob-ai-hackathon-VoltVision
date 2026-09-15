import { Database, Cpu } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Loading, ErrorState } from "../components/States";
import { getDashboardSummary, getModelFeatures } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int } from "../lib/format";
import { PANEL, PANEL_HEAD, SECTION_TITLE, MONO, TD, TR, TH } from "../lib/ui";

const PREDICTION_PIPELINE = [
  "Input Data",
  "Preprocessing",
  "Gradient Boosting",
  "Failure Probability",
  "Risk Classification",
];

const DECISION_PIPELINE = [
  { step: "Failure Prediction", note: "predicted probability of failure within the horizon" },
  { step: "Grid Impact Assessment", note: "independent consequence score from the distribution graph" },
  { step: "What-If Simulation", note: "graph-based cascade of zones, facilities, stressed assets" },
  { step: "Priority Ranking", note: "risk × impact × urgency fused into one 0–100 score" },
  { step: "Operational Recommendation", note: "category-driven action per asset" },
  { step: "AI Explanation", note: "opts into narrated briefs; never recomputes numbers" },
];

const INTEGRATIONS = [
  "SCADA telemetry in & status",
  "IoT sensor feeds",
  "Asset management systems",
  "Maintenance records",
  "Weather feeds",
  "Outage management systems",
];

export default function ModelPage() {
  const summary = useApi(getDashboardSummary, []);
  const features = useApi(getModelFeatures, []);

  if (summary.loading || features.loading) return <Loading label="Loading model information…" />;
  if (summary.error) return <ErrorState error={summary.error} />;

  const m = summary.data?.model;
  const featureList = features.data?.features || [];
  const importances = features.data?.importances || {};
  const topFeatures = Object.entries(importances).slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Model & Data"
        subtitle="How GridGuardian computes every number you have seen — technical detail, not claims about real infrastructure."
      />

      {/* MODEL SUMMARY */}
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">Model configuration</p>
        <div className="rounded border border-app-border bg-app-panel">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-app-border md:grid-cols-4">
            <Stat label="Model" value={m?.algorithm || "--"} sub="failure-probability classifier" />
            <Stat label="Training data" value={`${int(m?.train_size)}`} sub="synthetic scored records" />
            <Stat label="Test data" value={`${int(m?.test_size)}`} sub="held-out evaluation" />
            <Stat label="Features" value={`${featureList.length || 21}`} sub="input columns" />
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded bg-app-border border-t border-app-border">
            <Stat label="ROC-AUC" value={num(m?.roc_auc)} />
            <Stat label="Accuracy" value={num(m?.accuracy)} />
            <Stat label="F1" value={num(m?.f1)} />
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* MODEL INPUTS */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
            Model inputs — the {featureList.length || 21} training features
          </p>
          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>As recorded in metrics.json</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 sm:grid-cols-3">
              {featureList.map((f) => (
                <span key={f} className={`truncate text-xs text-app-muted ${MONO}`}>{f}</span>
              ))}
            </div>
            {topFeatures.length > 0 && (
              <table className="w-full border-collapse border-t border-app-border text-left text-xs">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className={TH}>Top importance</th>
                    <th className={`${TH} text-right`}>Gini importance</th>
                  </tr>
                </thead>
                <tbody>
                  {topFeatures.map(([name, value]) => (
                    <tr key={name} className={TR}>
                      <td className={`${TD} ${MONO} text-app-muted`}>{name}</td>
                      <td className={`${TD} text-right tabular text-app-text`}>{num(value, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* PIPELINE */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">Pipeline</p>
          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>Prediction pipeline</p>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-stretch gap-1">
                {PREDICTION_PIPELINE.map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="flex-1 rounded border border-app-border bg-app-raised px-2.5 py-1.5 text-xs font-medium text-app-text">
                      {step}
                    </span>
                    {i < PREDICTION_PIPELINE.length - 1 && (
                      <span className="w-8 text-center text-app-label">↓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-app-border px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-app-label">
                GridGuardian decision pipeline
              </p>
              <ol className="space-y-1.5">
                {DECISION_PIPELINE.map((p, i) => (
                  <li key={p.step} className="flex items-baseline gap-2 text-xs">
                    <span className="tabular font-semibold text-app-label">{i + 1}.</span>
                    <span className="font-medium text-app-text">{p.step}</span>
                    <span className="text-app-muted">— {p.note}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-2 border-t border-app-border px-4 py-2.5 text-xs text-app-muted">
              <Cpu className="h-3.5 w-3.5 text-app-label" />
              Deterministic end-to-end (seed {m?.seed ?? 42}) — same data in, same answer out.
            </div>
          </div>
        </section>
      </div>

      {/* DATA SOURCE */}
      <section className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">Data source</p>
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-label">
              <Database className="h-4 w-4 text-app-muted" /> SYNTHETIC DEMONSTRATION DATA
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm leading-relaxed text-app-muted">
              This prototype runs on deterministic synthetic data: generated grid
              assets, sensor and maintenance records, environmental conditions and
              a network. Nothing on these screens describes a real grid.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-app-muted">
              A production deployment could connect the same interface to live
              sources — but none of these are currently connected or implied as such:
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {INTEGRATIONS.map((s) => (
                <span key={s} className="rounded border border-app-border bg-app-raised px-2 py-1 text-[11px] text-app-muted">
                  {s} — not connected
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-app-label">
              Files: data/assets.csv (raw) → assets_scored.csv (Phase 2) → assets_prioritized.csv
              (Phase 3), plus network.json, alerts.csv and ml/model.pkl + metrics.json. Regenerated deterministically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-app-panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular text-app-text">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-app-muted">{sub}</p>}
    </div>
  );
}