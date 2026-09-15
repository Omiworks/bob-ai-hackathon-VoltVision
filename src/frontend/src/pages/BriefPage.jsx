import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, KeyRound, FileText } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Loading } from "../components/States";
import { generateAiBrief, listAssets, getDashboardSummary } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int, cap } from "../lib/format";
import { RECOMMENDED_ACTION } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, MONO, INPUT, BTN_PRIMARY, MUTED } from "../lib/ui";

const MAX_SELECT = 4;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function briefStamp() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function BriefPage() {
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [brief, setBrief] = useState(null);
  const [briefError, setBriefError] = useState(null);

  // Deterministic source data always available, even without the LLM.
  const summary = useApi(getDashboardSummary, []);
  const topPriority = useApi(() => listAssets({ limit: 3, sort: "priority" }), []);
  const topRisk = useApi(() => listAssets({ limit: 3, sort: "risk" }), []);
  const topImpact = useApi(() => listAssets({ limit: 3, sort: "impact" }), []);

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
    } else if (selected.length < MAX_SELECT) {
      setSelected([...selected, id]);
    }
    setQuery("");
    setSuggestions([]);
  };

  const run = async () => {
    if (selected.length === 0) return;
    setLoadingBrief(true);
    setBrief(null);
    setBriefError(null);
    try {
      const res = await generateAiBrief(selected);
      setBrief(res);
    } catch (e) {
      setBriefError(e);
    } finally {
      setLoadingBrief(false);
    }
  };

  const noKey = briefError && /AI brief unavailable/i.test(briefError.message);

  const immediate = topPriority.data?.assets || [];
  const highestRisk = topRisk.data?.assets || [];
  const highestImpact = topImpact.data?.assets || [];
  const d = summary.data;

  const messageReady = !loadingBrief && brief && !briefError;

  return (
    <div>
      <PageHeader
        title="AI Operations Brief"
        subtitle="An operator-focused briefing over the risk, impact, priority and simulation numbers the backend already computed. The AI narrates facts — it never recalculates them."
        right={
          selected.length > 0 ? (
            <button onClick={run} disabled={loadingBrief} className={BTN_PRIMARY}>
              <FileText className="h-4 w-4" /> Generate brief
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-app-border bg-app-raised px-2.5 py-1.5 text-xs text-app-muted">
              1–{MAX_SELECT} assets
            </span>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT — picker */}
        <div className="space-y-4 lg:col-span-1">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>Assets to brief ({selected.length}/{MAX_SELECT})</p>
            </div>
            <div className="p-3">
              <div className="flex flex-wrap gap-1.5 pb-3">
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
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assets…"
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
                        <span className="text-app-label">{cap(a.asset_type)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-app-label">
                Suggested: TX-104 (highest failure risk), TX-233 (biggest
                consequence), CAP-109 (vital asset at risk), CAP-126 (high risk —
                low impact).
              </p>
            </div>
          </div>

          <div className={PANEL}>
            <div className={PANEL_HEAD}>
              <p className={SECTION_TITLE}>How it stays honest</p>
            </div>
            <ul className="list-disc space-y-1 p-4 pl-8 text-[11px] leading-relaxed text-app-muted">
              <li>The AI receives structured facts only — never raw CSV.</li>
              <li>Its system prompt forbids inventing or recalculating numbers.</li>
              <li>Every figure below matches the backend pages exactly.</li>
              <li>Risk is labeled as predicted; consequence as simulated.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT — report */}
        <div className="space-y-4 lg:col-span-2">
          {/* DETERMINISTIC OPERATIONS REPORT */}
          <section>
            <div className={PANEL}>
              <div className="border-b border-app-border px-4 py-3">
                <p className="text-base font-semibold text-app-text">AI Operations Brief</p>
                <p className="mt-0.5 text-[11px] text-app-label">
                  <span className="mono text-sm font-semibold tracking-wide text-app-text">{briefStamp()}</span>
                  <span className="mx-2 text-app-border">|</span>
                  Generated from current grid assessment
                </p>
              </div>

              <div className="grid gap-x-8 gap-y-5 p-4 md:grid-cols-3">
                <ReportSection num="1" title="Immediate attention" accent="text-critical">
                  {immediate.map((a) => (
                    <ReportRow key={a.asset_id} a={a} showPrio />
                  ))}
                </ReportSection>
                <ReportSection num="2" title="Highest risk assets" accent="text-high">
                  {highestRisk.map((a) => (
                    <ReportRow key={a.asset_id} a={a} showRisk />
                  ))}
                </ReportSection>
                <ReportSection num="3" title="Highest consequence assets" accent="text-app-accent">
                  {highestImpact.map((a) => (
                    <ReportRow key={a.asset_id} a={a} showImpact />
                  ))}
                </ReportSection>
              </div>

              <div className="grid gap-x-8 gap-y-3 border-t border-app-border px-4 py-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label">4 · Recommended actions</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-app-muted">
                    {immediate.slice(0, 2).map((a) => (
                      <li key={a.asset_id}>
                        <span className={MONO}>{a.asset_id}</span>: {RECOMMENDED_ACTION[a.priority_category] || "Routine monitoring"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label">5 · Operational notes</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-app-muted">
                    <li>
                      Highest risk <span className={MONO}>{d?.highest_risk?.asset_id}</span> ({num(d?.highest_risk?.failure_risk, 1)}%) is not the highest priority —
                      consequence matters too.
                    </li>
                    <li>
                      <span className={MONO}>{d?.top_priority?.asset_id}</span> heads the priority queue (score {num(d?.top_priority?.priority_score)}).
                    </li>
                  </ul>
                </div>
              </div>

              <p className="border-t border-app-borderDim px-4 py-2 text-[10px] text-app-label">
                AI-generated narrative based on model-estimated and simulated results.
              </p>
            </div>
          </section>

          {loadingBrief && <Loading label="Composing the brief…" />}

          {noKey && (
            <div className="rounded border border-medium/40 bg-medium/10 p-4">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-medium" />
                <div>
                  <p className="text-sm font-semibold text-medium">
                    AI brief unavailable — configure the LLM API key.
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-app-muted">
                    Every numeric page (Overview, Assets, What-If, Maintenance
                    Priority, Alerts) works fully without a key — and the
                    operations report above always works. To enable the
                    AI-generated narrative:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-app-muted">
                    <li>Copy <code className="rounded bg-app-raised px-1.5 py-0.5 text-xs ring-1 ring-app-border">backend/.env.example</code> to <code className="rounded bg-app-raised px-1.5 py-0.5 text-xs ring-1 ring-app-border">backend/.env</code>.</li>
                    <li>Fill in <code className="rounded bg-app-raised px-1.5 py-0.5 text-xs ring-1 ring-app-border">ANTHROPIC_API_KEY</code>.</li>
                    <li>Restart the backend. No code changes needed.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {briefError && !noKey && (
            <div className="rounded border border-critical/40 bg-critical/10 p-4 text-sm text-critical">
              {briefError.message}
            </div>
          )}

          {messageReady && (
            <section>
              <div className={PANEL}>
                <div className="border-b border-app-border px-4 py-3">
                  <p className="text-base font-semibold text-app-text">
                    AI Operations Brief · {brief.asset_ids?.join(" + ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-app-label">
                    <span className="mono text-sm font-semibold tracking-wide text-app-text">{briefStamp()}</span>
                    <span className="mx-2 text-app-border">|</span>
                    Generated from current grid assessment
                  </p>
                </div>
                <div className="p-4">
                  <BriefMarkdown text={brief.brief} />
                </div>
                <p className="border-t border-app-borderDim px-4 py-2 text-[10px] text-app-label">
                  AI-generated narrative based on model-estimated and simulated results. Provider: {brief.provider}.
                </p>
              </div>
            </section>
          )}

          {messageReady && (
            <div className={PANEL}>
              <div className={PANEL_HEAD}>
                <p className={SECTION_TITLE}>Facts used by the brief (exactly as computed by the backend)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-app-table text-left text-xs">
                  <thead>
                    <tr className="border-b border-app-border">
                      <th className={TH}>Asset</th>
                      <th className={TH}>Type</th>
                      <th className={TH}>Risk</th>
                      <th className={TH}>Impact</th>
                      <th className={TH}>Priority</th>
                      <th className={TH}>Simulated severity</th>
                      <th className={`${TH} text-right`}>Customers</th>
                      <th className={`${TH} text-right`}>Crit. fac.</th>
                      <th className={`${TH} text-right`}>Zones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(brief.facts || []).map((f) => (
                      <tr key={f.asset_id} className={TR}>
                        <td className={`${TD} ${MONO}`}>
                          <Link to={`/assets/${f.asset_id}`} className="font-medium text-app-text hover:underline">
                            {f.asset_id}
                          </Link>
                        </td>
                        <td className={TD}><span className="text-app-muted">{cap(f.asset_type)}</span></td>
                        <td className={TD}>
                          <span className="tabular text-app-text">{num(f.failure_risk_percent, 1)}%</span>
                          <StatusBadge category={f.risk_category} size="sm" />
                        </td>
                        <td className={`${TD} tabular text-app-text`}>{num(f.grid_impact)}</td>
                        <td className={TD}><StatusBadge category={f.priority_category} size="sm" /></td>
                        <td className={TD}>
                          <StatusBadge category={f.simulation_severity} size="sm" />
                          <span className="ml-1 tabular text-app-text">{int(f.simulation_severity_score)}</span>
                        </td>
                        <td className={`${TD} text-right tabular text-app-text`}>{int(f.estimated_customers_affected)}</td>
                        <td className={`${TD} text-right tabular text-app-text`}>{int(f.critical_facilities_affected)}</td>
                        <td className={`${TD} text-right tabular text-app-text`}>{f.affected_zones?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-app-borderDim px-4 py-2 text-[10px] text-app-label">
                Risk = model-estimated failure probability. Consequence = simulated network impact.
                Both from backend services; the AI did not compute them.
              </p>
            </div>
          )}

          {!brief && !briefError && !loadingBrief && (
            <p className={MUTED}>
              Select one to four assets on the left and generate the brief. Until then, the
              deterministic operations report above reflects the current assessment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportSection({ num, title, accent, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 border-b border-app-borderDim pb-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-app-raised text-[10px] font-semibold tabular text-app-muted ring-1 ring-app-border">
          {num}
        </span>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent}`}>{title}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReportRow({ a, showPrio, showRisk, showImpact }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-app-borderDim pb-1.5 text-xs">
      <Link to={`/assets/${a.asset_id}`} className={`font-medium text-app-text hover:underline ${MONO}`}>
        {a.asset_id}
      </Link>
      <div className="flex items-center gap-2 text-app-muted">
        {showRisk && <span className="tabular">{num(a.failure_risk, 1)}% risk</span>}
        {showImpact && <span className="tabular">{num(a.grid_impact)} impact</span>}
        {showPrio && <span className="tabular">{num(a.priority_score)}</span>}
        <StatusBadge category={a.priority_category || a.risk_category} size="sm" />
      </div>
    </div>
  );
}

function BriefMarkdown({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current && current.type === "p") current = null;
      continue;
    }
    if (line.startsWith("## ")) {
      current = { type: "h2", text: line.slice(3) };
      blocks.push(current);
    } else if (line.startsWith("- ")) {
      if (!current || current.type !== "ul") {
        current = { type: "ul", items: [] };
        blocks.push(current);
      }
      current.items.push(line.slice(2));
    } else {
      if (!current || current.type !== "p") {
        current = { type: "p", text: "" };
        blocks.push(current);
      }
      current.text = current.text ? `${current.text} ${line}` : line;
    }
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-app-muted">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h2 key={i} className="border-b border-app-border pb-1 text-base font-semibold text-app-text">
              {b.text}
            </h2>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {b.items.map((it, j) => (
                <li key={`${i}-${j}`} className="text-app-muted">{it}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-app-muted">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}