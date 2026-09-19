import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import RiskBar from "../components/RiskBar";
import { Loading, ErrorState, EmptyState, RowSkeleton } from "../components/States";
import { getAssetsPage } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, int, cap } from "../lib/format";
import { CATEGORIES, ASSET_TYPES, CRITICALITY_OPTIONS, assetTypeLabel, STATUS_BY_PRIORITY } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, INPUT, SELECT, MONO } from "../lib/ui";

const PAGE_SIZE = 20;
const SORTS = [
  { value: "priority", label: "Priority score" },
  { value: "risk", label: "Failure risk" },
  { value: "impact", label: "Grid impact" },
];

const VALID_CATEGORIES = new Set(CATEGORIES);

export default function AssetsPage() {
  // Deep-link support: /assets?risk=CRITICAL or /assets?priority=CRITICAL opens
  // the registry with that filter pre-applied (used by dashboard stat cells).
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRisk = VALID_CATEGORIES.has(searchParams.get("risk")) ? searchParams.get("risk") : "";
  const urlPriority = VALID_CATEGORIES.has(searchParams.get("priority")) ? searchParams.get("priority") : "";

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [riskCategory, setRiskCategory] = useState(urlRisk);
  const [priorityCategory, setPriorityCategory] = useState(urlPriority);
  const [criticality, setCriticality] = useState("");
  const [assetType, setAssetType] = useState("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(0);

  // React to external navigation to the same route with different params
  // (e.g. clicking the dashboard's critical-stat cell while already on /assets).
  useEffect(() => {
    setRiskCategory(urlRisk);
    setPriorityCategory(urlPriority);
    setPage(0);
  }, [urlRisk, urlPriority]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const state = useApi(
    () =>
      getAssetsPage({
        search,
        riskCategory,
        priorityCategory,
        criticality,
        assetType,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, riskCategory, priorityCategory, criticality, assetType, sort, page]
  );

  const total = state.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = state.data?.assets || [];

  return (
    <div>
      <PageHeader
        title="Asset Inventory"
        subtitle={state.data ? `${total.toLocaleString()} MONITORED ASSETS — failure risk, simulated consequence, maintenance priority` : "Loading inventory…"}
      />

      {/* FILTER BAR */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-label" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search asset, type, location…"
            className={`${INPUT} w-full pl-8`}
          />
        </div>

        <select value={assetType} onChange={(e) => { setAssetType(e.target.value); setPage(0); }} className={SELECT}>
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => <option key={t} value={t}>{assetTypeLabel(t)}</option>)}
        </select>

        <select value={riskCategory} onChange={(e) => { setRiskCategory(e.target.value); setPage(0); }} className={SELECT}>
          <option value="">All risk levels</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c} risk</option>)}
        </select>

        <select value={priorityCategory} onChange={(e) => { setPriorityCategory(e.target.value); setPage(0); }} className={SELECT}>
          <option value="">All priority levels</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c} priority</option>)}
        </select>

        <select value={criticality} onChange={(e) => { setCriticality(e.target.value); setPage(0); }} className={SELECT}>
          <option value="">All criticality</option>
          {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
        </select>

        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} className={SELECT}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>

        {Boolean(search || riskCategory || priorityCategory || criticality || assetType) && (
          <button
            onClick={() => {
              setQuery(""); setSearch(""); setRiskCategory(""); setPriorityCategory("");
              setCriticality(""); setAssetType(""); setPage(0);
              setSearchParams({}, { replace: true });
            }}
            className="text-xs font-medium text-app-label hover:text-app-text"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className={PANEL}>
        <div className={PANEL_HEAD}>
          <p className={SECTION_TITLE}>Asset registry</p>
          <span className="text-xs tabular text-app-muted">
            {total.toLocaleString()} asset{total === 1 ? "" : "s"}
            {search ? ` matching “${search}”` : ""}
            {" · page "}{page + 1} of {pages}
          </span>
        </div>
        <div className="overflow-x-auto">
          {state.loading ? (
            <RowSkeleton rows={12} cols={8} />
          ) : state.error ? (
            <div className="p-4"><ErrorState error={state.error} /></div>
          ) : rows.length === 0 ? (
            <div className="p-4"><EmptyState title="No assets match" sub="Try clearing some filters." /></div>
          ) : (
            <table className="w-full border-collapse bg-app-table text-left text-[13px]">
              <thead>
                <tr className="sticky top-12 z-10 border-b border-app-border bg-app-panel">
                  <th className={TH}>Asset ID</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Location</th>
                  <th className={`${TH} text-right`}>Age</th>
                  <th className={`${TH} text-right`}>Load</th>
                  <th className={`${TH} text-right`}>Temp</th>
                  <th className={`${TH} text-right`}>Vibration</th>
                  <th className={TH} title="Model-estimated probability of failure within the horizon">Failure risk</th>
                  <th className={TH} title="Independent consequence score from the distribution graph">Grid impact</th>
                  <th className={TH} title="Fused 0-100 operations priority score">Priority</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const status = STATUS_BY_PRIORITY[a.priority_category] || STATUS_BY_PRIORITY.LOW;
                  return (
                    <tr key={a.asset_id} className={TR}>
                      <td className={`${TD} ${MONO}`}>
                        <Link to={`/assets/${a.asset_id}`} className="font-medium text-app-text hover:underline">
                          {a.asset_id}
                        </Link>
                      </td>
                      <td className={TD}><span className="text-app-muted">{assetTypeLabel(a.asset_type)}</span></td>
                      <td className={`${TD} text-xs text-app-label`}>{cap(a.location)}</td>
                      <td className={`${TD} text-right tabular text-app-muted`}>{num(a.age, 0)}</td>
                      <td className={`${TD} text-right tabular text-app-muted`}>{num(a.load, 0)}%</td>
                      <td className={`${TD} text-right tabular text-app-muted`}>{num(a.temperature, 0)}°C</td>
                      <td className={`${TD} text-right tabular text-app-muted`}>{num(a.vibration, 1)}</td>
                      <td className={`${TD} w-40`}>
                        <RiskBar value={a.failure_risk} category={a.risk_category} thin />
                        <p className="mt-0.5 text-[11px] tabular">
                          <span className={a.risk_category === "LOW" || !a.risk_category ? "text-app-muted" : "font-medium text-app-text"}>{num(a.failure_risk, 1)}%</span>
                        </p>
                      </td>
                      <td className={`${TD} w-40`}>
                        <RiskBar value={a.grid_impact} category={a.priority_category} thin />
                        <p className="mt-0.5 text-[11px] tabular text-app-muted">{num(a.grid_impact)} / 100</p>
                      </td>
                      <td className={TD}>
                        <StatusBadge category={a.priority_category} size="sm" />
                        <p className="mt-0.5 text-[10px] tabular text-app-label">score {num(a.priority_score)}</p>
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

      {/* PAGER */}
      <div className="mt-3 flex items-center justify-between text-xs text-app-label">
        <span className="tabular">
          Showing {rows.length} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 0 || state.loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-app-border bg-app-raised p-1.5 text-app-muted hover:bg-app-hover disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 tabular">{page + 1} / {pages}</span>
          <button
            disabled={page + 1 >= pages || state.loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-app-border bg-app-raised p-1.5 text-app-muted hover:bg-app-hover disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}