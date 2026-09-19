import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Loading, ErrorState, EmptyState } from "../components/States";
import RiskImpactScatter from "../components/charts/RiskImpactScatter";
import RiskPieChart from "../components/charts/RiskPieChart";
import { getDashboardSummary, listAssets, getAlerts } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int, cap } from "../lib/format";
import { RECOMMENDED_ACTION, STATUS_BY_PRIORITY, STATUS_BY_SEVERITY, categoryStyle, CATEGORIES } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, MONO, MUTED } from "../lib/ui";

export default function DashboardPage() {
  const navigate = useNavigate();
  const summary = useApi(getDashboardSummary, []);
  const queue = useApi(() => listAssets({ limit: 8, sort: "priority" }), []);
  const matrix = useApi(() => listAssets({ limit: 200, sort: "risk" }), []);
  const alerts = useApi(() => getAlerts(), []);

  if (summary.loading || queue.loading || matrix.loading) return <Loading />;
  if (summary.error) return <ErrorState error={summary.error} />;

  const d = summary.data;
  const queueRows = queue.data?.assets || [];
  const alertList = (alerts.data?.alerts || []).slice(0, 6);

  const riskCriticalHigh = (d.risk?.CRITICAL || 0) + (d.risk?.HIGH || 0);
  const criticalCount = int(d.priority?.CRITICAL);

  // Critical watchlist derived from the matrix data already fetched —
  // top 5 critical-priority assets by priority score.
  const criticalWatchlist = (matrix.data?.assets || [])
    .filter((a) => a.priority_category === "CRITICAL")
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 5);

  // Any category tap (pie slice, bar row, health row) opens the pre-filtered list.
  const openCategory = (category, kind = "risk") =>
    navigate(`/assets?${kind}=${encodeURIComponent(category)}`);

  return (
    <div>
      <PageHeader
        title="Grid Operations"
        subtitle="Operational overview and asset risk"
      />

      {/* GRID STATUS STRIP */}
      <section>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-app-label">
          Grid status
        </p>
        <div className="rounded border border-app-border bg-app-panel">
          <div className="grid grid-cols-2 md:grid-cols-5">
            <StripCell label="Total assets" value={int(d.assets?.total)} sub="monitored" />
            <StripCell
              label="High + critical"
              value={int(d.critical_high_priority?.count)}
              sub={`${criticalCount} critical · ${int(d.critical_high_priority?.high)} high`}
              tone={d.critical_high_priority?.count > 0 ? "text-high" : ""}
              onClick={() => openCategory("CRITICAL", "priority")}
              clickable={d.critical_high_priority?.count > 0}
            />
            <StripCell label="Requiring action" value={int(riskCriticalHigh)} sub="critical + high risk" tone={riskCriticalHigh > 0 ? "text-critical" : ""} />
            <StripCell label="Customer exposure" value={int(d.customers?.in_critical_high_priority)} sub={`of ${int(d.customers?.total_estimated_footprint)} footprint`} />
            <StripCell label="Alerts" value={int((alerts.data?.alerts || []).length)} sub="open advisories" />
          </div>
        </div>
      </section>

      {/* ANALYTICAL ROW — RISK PROFILE + PIE (5) | SYSTEM HEALTH (3) | CRITICAL WATCHLIST (4) */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>Asset risk profile</p>
              <span className={MUTED}>click a slice to filter</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <RiskPieChart distribution={d.risk} onSlice={(c) => openCategory(c, "risk")} />
                <div className="min-w-0 flex-1">
                  <RiskProfileBars distribution={d.risk} onRow={(c) => openCategory(c, "risk")} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>System health</p>
            </div>
            <div className="divide-y divide-app-borderDim text-xs">
              <HealthRow label="Assets monitored" value={int(d.assets?.total)} />
              <HealthRow label="Assets requiring attention" value={int(riskCriticalHigh)} tone={riskCriticalHigh > 0 ? "text-critical" : ""} />
              <HealthRow
                label="Critical assets"
                value={criticalCount}
                tone={criticalCount > 0 ? "text-critical" : ""}
                onClick={criticalCount > 0 ? () => openCategory("CRITICAL", "priority") : undefined}
              />
              <HealthRow
                label="High priority assets"
                value={int(d.priority?.HIGH)}
                tone={d.priority?.HIGH > 0 ? "text-high" : ""}
                onClick={d.priority?.HIGH > 0 ? () => openCategory("HIGH", "priority") : undefined}
              />
              <HealthRow label="Active alerts" value={int((alerts.data?.alerts || []).length)} />
            </div>
            <p className="flex items-center gap-1.5 border-t border-app-borderDim px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-app-label">
              <span className={`h-1.5 w-1.5 rounded-full ${alertList.length ? "bg-low" : "bg-app-label"}`} />
              Status · assessment current
            </p>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className={`${PANEL} flex h-full flex-col`}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>Critical watchlist</p>
              <Link to="/assets?priority=CRITICAL" className={MUTED}>
                All critical →
              </Link>
            </div>
            {criticalWatchlist.length === 0 ? (
              <p className="flex flex-1 items-center justify-center p-4 text-xs text-app-muted">
                No critical-priority assets right now.
              </p>
            ) : (
              <table className="w-full border-collapse bg-app-table text-left text-[12px]">
                <thead>
                  <tr className="border-b border-app-border bg-app-raised">
                    <th className={TH}>Asset</th>
                    <th className={`${TH} text-right`}>Risk</th>
                    <th className={`${TH} text-right`}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalWatchlist.map((a) => (
                    <tr key={a.asset_id} className={TR}>
                      <td className={`${TD} ${MONO}`}>
                        <Link to={`/assets/${a.asset_id}`} className="font-medium text-app-text hover:underline">
                          {a.asset_id}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-app-label">{RECOMMENDED_ACTION.CRITICAL}</p>
                      </td>
                      <td className={`${TD} text-right tabular font-medium text-critical`}>
                        {num(a.failure_risk, 1)}%
                      </td>
                      <td className={`${TD} text-right tabular font-semibold text-app-text`}>
                        {num(a.priority_score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-auto border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
              Top {criticalWatchlist.length || 0} of {criticalCount} critical-priority assets by score.
            </p>
          </div>
        </div>
      </div>

      {/* RISK / CONSEQUENCE MATRIX */}
      <section className="mt-6">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className={SECTION_TITLE}>Risk / consequence matrix</p>
            <span className={MUTED}>one point per asset · click to open the record</span>
          </div>
          <div className="relative px-4 pb-2 pt-3">
            <RiskImpactScatter assets={matrix.data?.assets || []} withQuadrants />
          </div>
          <p className="border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
            Failure probability and grid consequence are assessed independently. Quadrant
            thresholds at 50.
          </p>
        </div>
      </section>

      {/* MAINTENANCE WORK QUEUE */}
      <section className="mt-6">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className={SECTION_TITLE}>Maintenance work queue</p>
            <Link to="/priority" className={MUTED}>
              Full ranked list →
            </Link>
          </div>
          <div className="overflow-x-auto">
            {queue.loading ? (
              <Loading label="Loading…" />
            ) : (
              <table className="w-full border-collapse bg-app-table text-left text-[12px]">
                <thead>
                  <tr className="border-b border-app-border bg-app-raised">
                    <th className={TH}>Priority</th>
                    <th className={TH}>Asset</th>
                    <th className={TH}>Type</th>
                    <th className={`${TH} text-right`}>Risk</th>
                    <th className={`${TH} text-right`}>Impact</th>
                    <th className={TH}>Criticality</th>
                    <th className={TH}>Action</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {queueRows.map((a) => {
                    const status = STATUS_BY_PRIORITY[a.priority_category] || STATUS_BY_PRIORITY.LOW;
                    return (
                      <tr key={a.asset_id} className={TR}>
                        <td className={TD}>
                          <StatusBadge category={a.priority_category} size="sm" />
                          <span className="ml-2 text-[10px] tabular text-app-label">score {num(a.priority_score)}</span>
                        </td>
                        <td className={`${TD} ${MONO}`}>
                          <Link to={`/assets/${a.asset_id}`} className="font-medium text-app-text hover:underline">
                            {a.asset_id}
                          </Link>
                        </td>
                        <td className={TD}><span className="text-app-muted">{cap(a.asset_type)}</span></td>
                        <td className={`${TD} text-right tabular font-medium ${categoryStyle(a.risk_category).text}`}>
                          {num(a.failure_risk, 1)}%
                        </td>
                        <td className={`${TD} text-right tabular text-app-text`}>{num(a.grid_impact)}</td>
                        <td className={TD}><span className="text-xs text-app-muted">{cap(a.criticality)}</span></td>
                        <td className={`${TD} text-xs text-app-muted`}>
                          {RECOMMENDED_ACTION[a.priority_category] || "Routine monitoring"}
                        </td>
                        <td className={TD}><span className="text-xs text-app-muted">{status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* RECENT EVENTS */}
      <section className="mt-6">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className={SECTION_TITLE}>Recent events</p>
            <Link to="/alerts" className={MUTED}>All alerts →</Link>
          </div>
          {alerts.loading ? (
            <Loading label="Loading alerts…" />
          ) : alerts.error ? (
            <div className="p-4"><ErrorState error={alerts.error} /></div>
          ) : alertList.length === 0 ? (
            <div className="p-4"><EmptyState title="No alerts" /></div>
          ) : (
            <table className="w-full border-collapse bg-app-table text-left text-[12px]">
              <thead>
                <tr className="border-b border-app-border bg-app-raised">
                  <th className={TH}>Time</th>
                  <th className={TH}>Asset</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Severity</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {alertList.map((alert) => (
                  <tr key={alert.alert_id} className={TR}>
                    <td className={`${TD} mono text-[11px] text-app-label`}>{alert.timestamp}</td>
                    <td className={`${TD} ${MONO}`}>
                      <Link to={`/assets/${alert.asset_id}`} className="font-medium text-app-text hover:underline">
                        {alert.asset_id}
                      </Link>
                      <span className="ml-2 text-[10px] text-app-label">{alert.alert_id}</span>
                    </td>
                    <td className={`${TD} min-w-0 truncate text-app-muted`} title={alert.reason}>
                      {alert.reason}
                    </td>
                    <td className={TD}>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] ${categoryStyle(alert.severity).text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${categoryStyle(alert.severity).dot}`} />
                        {cap(alert.severity)}
                      </span>
                    </td>
                    <td className={`${TD} text-app-label`}>
                      {STATUS_BY_SEVERITY[String(alert.severity || "").toLowerCase()] || "Monitoring"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

// Horizontal risk distribution — stacked bar + per-category rows.
// Row click opens the pre-filtered asset list for that category.
function RiskProfileBars({ distribution, onRow }) {
  const total = CATEGORIES.reduce((s, c) => s + Number(distribution?.[c] || 0), 0) || 1;
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const counts = order.map((c) => ({ c, n: Number(distribution?.[c] || 0) }));
  const max = Math.max(...counts.map((x) => x.n), 1);

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-sm bg-app-raised">
        {counts.map(({ c, n }) =>
          n > 0 ? (
            <div
              key={c}
              className={categoryStyle(c).bar}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${c}: ${n}`}
            />
          ) : null
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {counts.map(({ c, n }) => (
          <div
            key={c}
            className={`flex items-center gap-3 rounded px-1 py-0.5 text-xs transition-colors ${
              onRow && n > 0 ? "cursor-pointer hover:bg-app-hover" : ""
            }`}
            onClick={onRow && n > 0 ? () => onRow(c) : undefined}
            role={onRow && n > 0 ? "button" : undefined}
            title={onRow && n > 0 ? `Show all ${c.toLowerCase()} risk assets` : undefined}
          >
            <span className={`w-16 ${categoryStyle(c).text}`}>{c}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-app-raised">
              <div className={`h-full ${categoryStyle(c).bar}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="w-20 text-right tabular text-app-muted">
              {int(n)} · {Math.round((n / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StripCell({ label, value, sub, tone, onClick, clickable }) {
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      type={clickable ? "button" : undefined}
      className={`px-4 py-2.5 text-left ${clickable ? "cursor-pointer transition-colors hover:bg-app-hover" : ""}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-app-label">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular text-app-text ${tone || ""}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-app-muted">{sub}</p>}
    </Tag>
  );
}

function HealthRow({ label, value, tone, onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      className={`flex items-center justify-between px-4 py-2 ${
        clickable ? "cursor-pointer transition-colors hover:bg-app-hover" : ""
      }`}
    >
      <span className="text-app-label">{label}</span>
      <span className={`tabular font-semibold text-app-text ${tone || ""}`}>{value}</span>
    </div>
  );
}