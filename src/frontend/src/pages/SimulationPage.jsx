import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Play, Plus, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import ConsequenceTimeline from "../components/ConsequenceTimeline";
import SimulationDiagram from "../components/topology/SimulationDiagram";
import { Loading, ErrorState, EmptyState } from "../components/States";
import { listAssets, getAsset, simulateAsset, simulateCompare, getDemoPicks } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int, cap } from "../lib/format";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, MONO, INPUT, BTN_PRIMARY, BTN_SECONDARY, MUTED } from "../lib/ui";

const MAX_SELECT = 2;

export default function SimulationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialIds = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SELECT);

  const [selected, setSelected] = useState([...new Set(initialIds)]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [doneAt, setDoneAt] = useState(null);
  const [demo, setDemo] = useState([]);

  const briefA = useApi(() => (selected[0] ? getAsset(selected[0]) : Promise.resolve(null)), [selected[0]]);
  const briefB = useApi(() => (selected[1] ? getAsset(selected[1]) : Promise.resolve(null)), [selected[1]]);

  useEffect(() => {
    getDemoPicks().then((d) => setDemo(d.picks || [])).catch(() => setDemo([]));
  }, []);

  // Deep link ?ids=...: preselect and auto-run a scenario.
  useEffect(() => {
    if (initialIds.length === 1) runSpec(initialIds[0]);
    else if (initialIds.length >= 2) runCompareSpec(initialIds.slice(0, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      listAssets({ search: query.trim(), limit: 8 })
        .then((r) => setSuggestions(r.assets || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      setResult(null);
    } else if (selected.length < MAX_SELECT) {
      setSelected([...selected, id]);
      setResult(null);
    }
    setQuery("");
    setSuggestions([]);
    syncUrl(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, MAX_SELECT));
  };

  const syncUrl = (ids) => {
    if (ids.length) setSearchParams({ ids: ids.join(",") });
    else setSearchParams({});
  };

  const simulate = async (ids, mode) => {
    if (ids.length === 0) return;
    setRunning({ mode, ids });
    setError(null);
    setDoneAt(null);
    try {
      if (mode === "single") {
        const res = await simulateAsset(ids[0]);
        setResult({ mode: "single", data: res.simulation, asset_id: ids[0] });
      } else {
        const res = await simulateCompare(ids);
        setResult({ mode: "compare", data: res.result, asset_ids: res.asset_ids });
      }
      setDoneAt(new Date());
    } catch (e) {
      setError(e);
    } finally {
      setRunning(null);
    }
  };

  const runSpec = (id) => simulate([id], "single");
  const runCompareSpec = (ids) => simulate(ids.slice(0, 2), "compare");

  const firstBrief = briefA.data;
  const secondBrief = briefB.data;
  const bA = firstBrief && { risk: firstBrief.risk, impact: firstBrief.impact, priority: firstBrief.priority, asset: firstBrief.asset };
  const bB = secondBrief && { risk: secondBrief.risk, impact: secondBrief.impact, priority: secondBrief.priority, asset: secondBrief.asset };

  return (
    <div>
      <PageHeader
        title="What-If Failure Analysis"
        subtitle="Simulate the operational consequence of an asset failure."
      />

      {/* HORIZONTAL CONTROL AREA */}
      <div className={PANEL}>
        <div className={PANEL_HEAD}>
          <p className={SECTION_TITLE}>Failure scenario</p>
          <span className={MUTED}>select 1–2 assets</span>
        </div>
        <div className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-app-label">
              Asset
            </label>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Select asset — search ID or type…"
                className={`${INPUT} w-full`}
              />
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded border border-app-border bg-app-raised shadow-lg">
                  {suggestions.map((a) => (
                    <button
                      key={a.asset_id}
                      onClick={() => toggle(a.asset_id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-app-hover"
                    >
                      <span className={`font-medium text-app-text ${MONO}`}>{a.asset_id}</span>
                      <span className="text-app-label">{cap(a.asset_type)} · risk {num(a.failure_risk, 0)}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.length === 0 && <span className={MUTED}>No asset selected</span>}
              {selected.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded border border-app-border bg-app-raised px-2 py-0.5 text-xs font-medium text-app-text"
                >
                  <span className={MONO}>{id}</span>
                  <button onClick={() => toggle(id)} aria-label={`Remove ${id}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => simulate([selected[0]], "single")}
              disabled={selected.length === 0 || !!running}
              className={BTN_PRIMARY}
            >
              <Play className="h-3.5 w-3.5" /> Simulate failure
            </button>
            <button
              onClick={() => simulate(selected.slice(0, 2), "compare")}
              disabled={selected.length < 2 || !!running}
              className={BTN_SECONDARY}
            >
              Compare two assets
            </button>
          </div>
        </div>
      </div>

      {/* CURATED COMPARISONS */}
      {demo.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded border border-app-borderDim bg-app-panel/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-app-label">
            Curated picks
          </span>
          {demo.map((pick) => (
            <button
              key={pick.role}
              onClick={() => toggle(pick.asset_id)}
              className="inline-flex items-center gap-1 rounded border border-app-border bg-app-raised px-2 py-0.5 text-[11px] text-app-muted hover:border-app-accent hover:text-app-text"
            >
              <Plus className="h-3 w-3" />
              <span className={MONO}>{pick.asset_id}</span>
              <span className="text-app-label">· {pick.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* RESULTS */}
      <div className="mt-4">
        {doneAt && !running && !error && (
          <div className="mb-3 flex items-center justify-between rounded border border-low/40 bg-low/10 px-3 py-2">
            <span className="text-xs font-medium text-low">
              Simulation completed reliably from backend data.
            </span>
            <span className="mono text-[11px] text-low">{doneAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        )}
        {running ? (
          <Loading label={`Simulating ${running.ids.join(" + ")}…`} />
        ) : error ? (
          <ErrorState error={error} />
        ) : !result ? (
          <EmptyState
            title="No scenario run yet"
            sub="Select an asset and run a single failure simulation, or pick two assets to compare scenarios side by side."
          />
        ) : result.mode === "single" ? (
          <SingleResult
            sim={result.data}
            brief={bA}
            assetId={result.asset_id}
          />
        ) : (
          <CompareResult data={result.data} ids={result.asset_ids || []} briefA={bA} briefB={bB} runningA={briefA.loading} runningB={briefB.loading} />
        )}
      </div>
    </div>
  );
}

function CurrentState({ brief }) {
  return (
    <div className={PANEL}>
      <div className={PANEL_HEAD}>
        <p className={SECTION_TITLE}>Current asset state</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-app-border text-center">
        <Cell label="Failure risk" value={brief ? `${num(brief.risk?.failure_risk_percent, 1)}%` : "--"} sub={brief?.risk?.risk_category} cat={brief?.risk?.risk_category} />
        <Cell label="Grid impact" value={brief ? num(brief.impact?.grid_impact, 1) : "--"} sub="/ 100" />
        <Cell label="Priority" value={brief ? num(brief.priority?.priority_score, 1) : "--"} sub={brief?.priority?.priority_category} cat={brief?.priority?.priority_category} />
      </div>
    </div>
  );
}

function Cell({ label, value, sub, cat }) {
  return (
    <div className="bg-app-panel px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular text-app-text">{value}</p>
      {sub && (
        <div className="mt-0.5 flex items-center justify-center gap-1">
          <span className="text-[11px] text-app-label">{sub}</span>
          {cat && <StatusBadge category={cat} size="sm" />}
        </div>
      )}
    </div>
  );
}

function SingleResult({ sim, brief, assetId }) {
  if (!sim) return null;
  const substation = brief?.asset?.substation || brief?.asset?.location;
  return (
    <div className="space-y-4">
      <CurrentState brief={brief} />

      {/* SIMULATION RESULT */}
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
          Simulation result
        </p>
        <div className={PANEL}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-app-border sm:grid-cols-3 xl:grid-cols-5">
            <Cell label="Severity" value={int(sim.severity_score)} sub={cap(sim.severity)} cat={sim.severity} />
            <Cell label="Customers" value={`~${int(sim.estimated_customers_affected)}`} sub="affected" />
            <Cell label="Facilities" value={int(sim.critical_facilities_affected)} sub="reachable" />
            <Cell label="Zones" value={int((sim.affected_zones || []).length)} sub="affected" />
            <Cell label="Cascade depth" value={int(sim.cascade_depth)} sub="levels" />
          </div>
          <p className="border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
            Result ID {sim.simulation_id || "—"} · generated {sim.generated_at || "—"}
          </p>
        </div>
      </section>

      {/* NETWORK CONSEQUENCE */}
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
          Network consequence
        </p>
        <SimulationDiagram sim={sim} substation={substation} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CONSEQUENCE CHAIN */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
            Consequence chain
          </p>
          <div className={PANEL}>
            <div className="p-4">
              <ConsequenceTimeline sim={sim} />
            </div>
          </div>
        </section>

        {/* EXPLANATION */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
            What explains this outcome
          </p>
          <div className={PANEL}>
            <div className="p-4">
              <p className="text-sm text-app-text">{sim.explanation?.headline}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-app-muted">
                {(sim.explanation?.key_drivers || []).map((d) => <li key={d}>{d}</li>)}
              </ul>
              <p className="mt-3 border-t border-app-borderDim pt-2 text-xs text-app-muted">
                Recommended follow-up: {sim.explanation?.recommended_follow_up}
              </p>
              <Link to={`/assets/${assetId}`} className="mt-2 inline-block text-xs font-medium text-app-accent hover:underline">
                Open asset record →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CompareResult({ data, ids, briefA, briefB, runningA, runningB }) {
  const scenarios = (data && data.scenarios) || [];
  const byId = {};
  scenarios.forEach((s) => { byId[s.asset_id] = s; });
  const a = scenarios[0];
  const b = scenarios[1];
  const worst = data && data.worst;

  const rows = [
    ["Failure Risk (%)", briefA?.risk?.failure_risk_percent != null ? num(briefA.risk.failure_risk_percent, 1) : "--",
     briefB?.risk?.failure_risk_percent != null ? num(briefB.risk.failure_risk_percent, 1) : "--"],
    ["Grid Impact (/100)", briefA?.impact?.grid_impact != null ? num(briefA.impact.grid_impact, 1) : "--",
     briefB?.impact?.grid_impact != null ? num(briefB.impact.grid_impact, 1) : "--"],
    ["Priority (/100)", briefA?.priority?.priority_score != null ? num(briefA.priority.priority_score, 1) : "--",
     briefB?.priority?.priority_score != null ? num(briefB.priority.priority_score, 1) : "--"],
    ["Severity Score", a ? int(a.severity_score) : "--", b ? int(b.severity_score) : "--"],
    ["Customers Affected", a ? `~${int(a.estimated_customers_affected)}` : "--", b ? `~${int(b.estimated_customers_affected)}` : "--"],
    ["Critical Facilities", a ? int(a.critical_facilities_affected) : "--", b ? int(b.critical_facilities_affected) : "--"],
    ["Zones Affected", a ? int(a.affected_zones_count) : "--", b ? int(b.affected_zones_count) : "--"],
    ["Cascade Depth", a ? int(a.cascade_depth) : "--", b ? int(b.cascade_depth) : "--"],
  ];

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-app-label">
          Scenario comparison
        </p>
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className={SECTION_TITLE}>Two failures, side by side</p>
            {worst && (
              <span className="text-[11px] text-app-muted">
                Worst case: <span className={MONO}>{worst.asset_id}</span> ({cap(worst.severity)}, {int(worst.severity_score)}/100)
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-app-border">
                  <th className={TH}>Metric</th>
                  {ids.map((id) => (
                    <th key={id} className={TH}>
                      <div className="flex flex-col gap-1">
                        <Link to={`/assets/${id}`} className={`font-medium text-app-text hover:underline ${MONO}`}>{id}</Link>
                        <StatusBadge category={byId[id]?.severity} size="sm" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, va, vb]) => (
                  <tr key={label} className={TR}>
                    <td className={`${TD} text-app-label`}>{label}</td>
                    <td className={`${TD} text-right tabular font-medium text-app-text`}>{runningA ? "…" : va}</td>
                    <td className={`${TD} text-right tabular font-medium text-app-text`}>{runningB ? "…" : vb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
            Risk / impact / priority come from each asset&apos;s record; severity, customers,
            facilities, zones and cascade depth from the compare simulation. An asset can be
            high risk yet low consequence, or low risk yet high consequence.
          </p>
        </div>
      </section>
    </div>
  );
}