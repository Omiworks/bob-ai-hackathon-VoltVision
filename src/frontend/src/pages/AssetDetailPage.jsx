import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Loading, ErrorState, EmptyState } from "../components/States";
import { getAsset, getAssetSimulation } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int, cap } from "../lib/format";
import { assetTypeLabel, RECOMMENDED_ACTION } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, MONO, ROW_KEY, MUTED, BTN_PRIMARY } from "../lib/ui";

const CONDITION_FIELDS = [
  { key: "age_years", label: "Age", value: (a) => `${num(a.age_years, 0)} yrs` },
  { key: "load_percentage", label: "Load", value: (a) => `${num(a.load_percentage, 0)}%` },
  { key: "temperature", label: "Temperature", value: (a) => `${num(a.temperature, 1)} °C` },
  { key: "vibration", label: "Vibration", value: (a) => `${num(a.vibration, 1)} mm/s` },
  { key: "oil_quality", label: "Oil quality", value: (a) => cap(a.oil_quality) },
  { key: "maintenance_days_ago", label: "Since maintenance", value: (a) => `${num(a.maintenance_days_ago, 0)} days` },
  { key: "previous_failures", label: "Previous failures", value: (a) => `${int(a.previous_failures)}` },
  { key: "weather_severity", label: "Weather severity", value: (a) => cap(a.weather_severity) },
  { key: "humidity", label: "Humidity", value: (a) => `${num(a.humidity, 0)}%` },
  { key: "temperature_trend", label: "Temperature trend", value: (a) => cap(a.temperature_trend) },
];

export default function AssetDetailPage() {
  const { id } = useParams();
  const detail = useApi(() => getAsset(id), [id]);
  const sim = useApi(() => getAssetSimulation(id), [id]);

  if (detail.loading) return <Loading label="Loading asset record…" />;
  if (detail.error)
    return (
      <div>
        <Link to="/assets" className="mb-3 inline-flex items-center gap-1 text-xs text-app-muted hover:text-app-text">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to assets
        </Link>
        <ErrorState error={detail.error} />
      </div>
    );

  const { asset, risk, impact, priority, explanation } = detail.data;
  const simulation = sim.data;
  const conditionRows = CONDITION_FIELDS.filter((f) => asset?.[f.key] != null);

  return (
    <div>
      <Link to="/assets" className="mb-3 inline-flex items-center gap-1 text-xs text-app-muted hover:text-app-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to assets
      </Link>

      {/* EQUIPMENT RECORD HEADER */}
      <section className="rounded border border-app-border bg-app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <p className={`text-2xl font-semibold text-app-text ${MONO}`}>
              {asset?.asset_id || id}
            </p>
            <div>
              <p className="text-sm text-app-text">{assetTypeLabel(asset?.asset_type)}</p>
              <p className="text-[11px] text-app-label">
                <span className="uppercase">{cap(asset?.asset_type)}</span>
                <span className="mx-1.5 text-app-border">/</span>
                <span className="uppercase">{cap(asset?.substation || "—")}</span>
                <span className="mx-1.5 text-app-border">/</span>
                <span className="uppercase">{cap(asset?.location || "—")}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-[10px] font-semibold uppercase tracking-widest text-app-label md:inline">
              Status
            </p>
            <StatusBadge category={risk?.risk_category} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
          <span>Location: <span className="text-app-muted">{cap(asset?.location)}</span></span>
          <span>Substation: <span className="text-app-muted">{cap(asset?.substation)}</span></span>
          <span>Classification: <span className="text-app-muted">{cap(asset?.criticality)}</span></span>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* LEFT 2/3 — condition + factors */}
        <div className="space-y-4 lg:col-span-2">
          {/* ASSET CONDITION */}
          <section>
            <div className={PANEL}>
              <div className={PANEL_HEAD}>
                <p className={SECTION_TITLE}>Condition</p>
                <span className={MUTED}>live telemetry & inspection record</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                {conditionRows.map((f) => (
                  <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-app-borderDim py-2 text-sm">
                    <span className={ROW_KEY}>{f.label}</span>
                    <span className="tabular text-app-text">{f.value(asset)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* RISK FACTORS */}
          <section>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
              Risk factors
            </p>
            <div className={PANEL}>
              <div className={PANEL_HEAD}>
                <p className={SECTION_TITLE}>{explanation?.title || "Why this asset scored as it did"}</p>
              </div>
              <div className="grid gap-x-8 gap-y-2 p-4 sm:grid-cols-2">
                {(explanation?.risk_factors || []).map((f) => (
                  <p key={f} className="flex items-start gap-2 text-[13px] leading-relaxed text-app-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-high" />
                    {f}
                  </p>
                ))}
                {(explanation?.impact_factors || []).map((f) => (
                  <p key={f} className="flex items-start gap-2 text-[13px] leading-relaxed text-app-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent" />
                    {f}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* IMPACT COMPONENTS */}
          {impact?.components && (
            <section>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
                Grid impact components
              </p>
              <div className={PANEL}>
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {Object.entries(impact.components).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate text-app-label">{cap(key)}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-app-raised">
                        <div className="h-full bg-app-accentDim" style={{ width: `${Number(value) || 0}%` }} />
                      </div>
                      <span className="w-7 text-right tabular text-app-muted">{num(value, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT — risk assessment + consequence */}
        <div className="space-y-4">
          {/* RISK ASSESSMENT */}
          <section>
            <div className={PANEL}>
              <div className={PANEL_HEAD}>
                <p className={SECTION_TITLE}>Risk assessment</p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-app-border">
                <AssessCell
                  label="Failure risk"
                  value={risk?.failure_risk_percent != null ? num(risk.failure_risk_percent, 2) : "--"}
                  unit="%"
                  cat={risk?.risk_category}
                />
                <AssessCell
                  label="Grid impact"
                  value={impact?.grid_impact != null ? num(impact.grid_impact, 2) : "--"}
                  unit="/100"
                />
                <AssessCell
                  label="Priority"
                  value={priority?.priority_score != null ? num(priority.priority_score, 2) : "--"}
                  unit="/100"
                  cat={priority?.priority_category}
                />
                <AssessCell
                  label="Criticality"
                  value={cap(asset?.criticality) || "--"}
                />
              </div>
              {priority?.priority_reason && (
                <p className="border-t border-app-borderDim px-4 py-2 text-[11px] text-app-muted">
                  Assessment note: {priority.priority_reason}
                </p>
              )}
            </div>
          </section>

          {/* GRID CONSEQUENCE */}
          <section>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
              Grid consequence
            </p>
            <div className={PANEL}>
              {sim.loading ? (
                <div className="p-4"><Loading label="Running failure simulation…" /></div>
              ) : sim.error ? (
                <div className="p-4">
                  <p className="text-xs text-app-muted">Simulation unavailable for this asset.</p>
                </div>
              ) : !simulation ? (
                <div className="p-4"><EmptyState title="No simulation yet" sub="Run a what-if to estimate the consequence." /></div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-app-text">Simulated severity</p>
                    <StatusBadge category={simulation.severity} size="sm" />
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular text-app-text">
                    {int(simulation.severity_score)}<span className="ml-1 text-sm font-medium text-app-label">/ 100</span>
                  </p>

                  <dl className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-app-borderDim pb-1.5">
                      <dt className="text-app-label">Customers</dt>
                      <dd className="tabular font-medium text-app-text">~{int(simulation.estimated_customers_affected)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-app-borderDim pb-1.5">
                      <dt className="text-app-label">Facilities</dt>
                      <dd className="tabular font-medium text-app-text">{int(simulation.critical_facilities_affected)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-app-borderDim pb-1.5">
                      <dt className="text-app-label">Zones</dt>
                      <dd className="tabular font-medium text-app-text">{int((simulation.affected_zones || []).length)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-b border-app-borderDim pb-1.5">
                      <dt className="text-app-label">Stressed assets</dt>
                      <dd className="tabular font-medium text-app-text">{int((simulation.stressed_assets || []).length)}</dd>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <dt className="text-app-label">Cascade depth</dt>
                      <dd className="tabular font-medium text-app-text">{int(simulation.cascade_depth)}</dd>
                    </div>
                  </dl>

                  {(simulation.affected_zones || []).length > 0 && (
                    <div className="mt-3 border-t border-app-border pt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-app-label">Zones</p>
                      <p className={MONO + " text-[11px] text-app-muted"}>
                        {(simulation.affected_zones || []).slice(0, 6).join(" · ")}
                        {(simulation.affected_zones || []).length > 6 ? " · …" : ""}
                      </p>
                    </div>
                  )}

                  {(simulation.stressed_assets || []).length > 0 && (
                    <div className="mt-3 border-t border-app-border pt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-app-label">Stressed neighbors</p>
                      <p className="mono text-[11px] text-app-muted">
                        {(simulation.stressed_assets || []).slice(0, 4).map((s) => s.asset_id).join(" · ")}
                        {(simulation.stressed_assets || []).length > 4 ? " · …" : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className={MUTED + " mt-2"}>
              Consequence is estimated by the graph-based cascade simulation: zones,
              facilities, stressed neighbors and customers reachable after the asset fails.
            </p>
          </section>

          {/* RUN FAILURE SIMULATION */}
          <Link
            to={`/simulate?ids=${id}`}
            className={`${BTN_PRIMARY} w-full`}
          >
            <FlaskConical className="h-4 w-4" /> Run Failure Simulation
          </Link>

          {/* OPERATIONAL RECOMMENDATION */}
          <section>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
              Operational recommendation
            </p>
            <div className={PANEL}>
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="text-sm font-medium text-app-text">
                  {RECOMMENDED_ACTION[priority?.priority_category] || "Routine monitoring"}
                </p>
                <StatusBadge category={priority?.priority_category} size="sm" />
              </div>
              {priority?.priority_reason && (
                <p className="border-t border-app-borderDim px-4 py-2 text-xs text-app-muted">
                  {priority.priority_reason}
                </p>
              )}
              {simulation?.explanation?.recommended_follow_up && (
                <p className="border-t border-app-borderDim px-4 py-2 text-xs text-app-muted">
                  Follow-up: {simulation.explanation.recommended_follow_up}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AssessCell({ label, value, unit, cat }) {
  return (
    <div className="bg-app-panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-app-text">
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-medium text-app-label">{unit}</span>}
      </p>
      {cat && (
        <div className="mt-1">
          <StatusBadge category={cat} size="sm" />
        </div>
      )}
    </div>
  );
}