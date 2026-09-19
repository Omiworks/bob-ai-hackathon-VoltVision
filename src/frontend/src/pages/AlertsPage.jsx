import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Loading, ErrorState, EmptyState } from "../components/States";
import { getAlerts } from "../services/api";
import { useApi } from "../hooks/useApi";
import { cap } from "../lib/format";
import { CATEGORIES, STATUS_BY_SEVERITY, categoryStyle } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, MONO } from "../lib/ui";

const FILTERS = [
  { value: "all", label: "All" },
  ...CATEGORIES.map((c) => ({ value: c.toLowerCase(), label: c })),
];

export default function AlertsPage() {
  const [severity, setSeverity] = useState("all");
  const state = useApi(() => getAlerts({ severity }), [severity]);
  const alerts = state.data?.alerts || [];

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Asset-level advisories derived from the same scored signals driving the risk rankings."
        right={
          <div className="flex items-center gap-0.5 rounded-lg border border-app-border/70 bg-app-input p-0.5 shadow-neu-inset">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSeverity(f.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  severity === f.value
                    ? "bg-app-panel text-app-accentDim shadow-neu-sm"
                    : "text-app-muted hover:text-app-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <div className={PANEL}>
        <div className={PANEL_HEAD}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-label">
            <BellRing className="h-4 w-4 text-app-muted" /> Alert log
          </p>
          <span className="text-xs tabular text-app-muted">
            {state.loading ? "…" : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {state.loading ? (
          <Loading label="Loading alerts…" />
        ) : state.error ? (
          <div className="p-4"><ErrorState error={state.error} /></div>
        ) : alerts.length === 0 ? (
          <div className="p-4"><EmptyState title="No alerts for this filter" sub="Try a different severity level." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-app-table text-left text-[13px]">
              <thead>
                <tr className="border-b border-app-border bg-app-raised">
                  <th className={TH}>Time</th>
                  <th className={TH}>Severity</th>
                  <th className={TH}>Asset</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const status = STATUS_BY_SEVERITY[String(alert.severity || "").toLowerCase()] || "Monitoring";
                  const isCritical = String(alert.severity || "").toUpperCase() === "CRITICAL";
                  return (
                    <tr key={alert.alert_id} className={`${TR} ${isCritical ? "border-l-2 border-l-critical" : ""}`}>
                      <td className={`${TD} mono text-[11px] text-app-label`}>{alert.timestamp}</td>
                      <td className={TD}>
                        <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium tracking-wide ${categoryStyle(alert.severity).badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${categoryStyle(alert.severity).dot}`} />
                          {cap(alert.severity)}
                        </span>
                      </td>
                      <td className={`${TD} ${MONO}`}>
                        <Link to={`/assets/${alert.asset_id}`} className="font-medium text-app-text hover:underline">
                          {alert.asset_id}
                        </Link>
                        <span className="ml-2 text-[11px] text-app-label">{alert.alert_id}</span>
                      </td>
                      <td className={`${TD} text-xs`}>
                        <p className={categoryStyle(alert.severity).text}>{alert.reason}</p>
                        <p className="text-app-muted">Recommended: {alert.recommended_action}</p>
                      </td>
                      <td className={TD}><span className="text-xs text-app-muted">{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}