import { categoryStyle, cap } from "../lib/constants";
import { int } from "../lib/format";

// Ordered consequence chain derived from a simulation result.
// Pure presentation of backend-returned numbers.
export default function ConsequenceTimeline({ sim }) {
  if (!sim) return null;
  const style = categoryStyle(sim.severity);
  const facilities = sim.affected_facilities || [];
  const criticalCount =
    sim.critical_facilities_affected ??
    facilities.filter((f) => f.criticality === "critical").length;

  const steps = [
    {
      label: "Asset failure",
      detail: `${sim.failed_asset} (${cap(sim.asset_type)})`,
      tone: style.dot,
      value: cap(sim.severity),
    },
    {
      label: "Downstream exposure",
      detail: disclaimZones(sim),
      tone: "bg-app-accent",
      value: (sim.affected_zones || []).length,
    },
    {
      label: "Customer impact",
      detail: `cascade depth ${sim.cascade_depth ?? 0}${sim.network_node_present ? "" : " — asset not in graph"}`,
      tone: "bg-app-accentDim",
      value: `~${int(sim.estimated_customers_affected)}`,
    },
    {
      label: "Critical facility exposure",
      detail: `${
        criticalCount
          ? `${criticalCount} critical facility(ies) reachable`
          : "no critical facilities reachable"
      }`,
      tone: criticalCount ? "bg-critical" : "bg-app-label",
      value: facilities.length,
    },
    {
      label: "Asset stress",
      detail: "overload risk after redirect",
      tone: "bg-medium",
      value: (sim.stressed_assets || []).length,
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center self-stretch">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-app-panel"
              style={{ backgroundColor: toneColor(s.tone), boxShadow: "0 1px 2px var(--gg-sh-outer)" }}
            />
            {i < steps.length - 1 && <span className="w-px flex-1 bg-app-border" />}
          </div>
          <div className="flex w-full items-center justify-between gap-2 pb-3">
            <div>
              <p className="text-sm font-medium text-app-text">{s.label}</p>
              <p className="text-[11px] text-app-muted">{s.detail}</p>
            </div>
            <p className="text-right text-sm font-medium tabular text-app-text">{s.value}</p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 border-t border-app-border pt-3">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: toneColor(style.dot) }} />
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-sm font-semibold text-app-text">Severity score</p>
          <p className={`text-sm font-bold tabular ${style.text}`}>
            {int(sim.severity_score)} / 100
          </p>
        </div>
      </div>
    </div>
  );
}

function toneColor(name) {
  // Map Tailwind class names back to the CSS variables so the timeline dots
  // follow light/dark mode and the active accent.
  if (name === "bg-app-accent") return "var(--gg-accent)";
  if (name === "bg-app-accentDim") return "var(--gg-accentDim)";
  if (name === "bg-app-label") return "var(--gg-label)";
  if (name === "bg-critical") return "var(--gg-critical)";
  if (name === "bg-high") return "var(--gg-high)";
  if (name === "bg-medium") return "var(--gg-medium)";
  if (name === "bg-low") return "var(--gg-low)";
  if (name?.startsWith("bg-")) return name.slice(3);
  return name;
}

function disclaimZones(sim) {
  const n = (sim.affected_zones || []).length;
  return `${n} zone${n === 1 ? "" : "s"}${sim.network_node_present ? "" : " — asset not connected in graph"}`;
}