import { useState } from "react";
import { Link } from "react-router-dom";
import { HardHat } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Loading, ErrorState } from "../components/States";
import { priorityRanking, allocateCrews } from "../services/api";
import { useApi } from "../hooks/useApi";
import { num, cap } from "../lib/format";
import { RECOMMENDED_ACTION } from "../lib/constants";
import { PANEL, PANEL_HEAD, SECTION_TITLE, TH, TD, TR, MONO, INPUT, BTN_PRIMARY, MUTED } from "../lib/ui";

export default function PriorityPage() {
  const ranking = useApi(() => priorityRanking(50), []);
  const [crews, setCrews] = useState(3);
  const [alloc, setAlloc] = useState(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocError, setAllocError] = useState(null);

  const runAllocation = async () => {
    setAllocLoading(true);
    setAllocError(null);
    try {
      const res = await allocateCrews(crewSafe(crews));
      setAlloc(res);
    } catch (e) {
      setAllocError(e);
    } finally {
      setAllocLoading(false);
    }
  };

  const assets = ranking.data?.assets || [];
  const assigned = alloc?.assigned || [];

  return (
    <div>
      <PageHeader
        title="Maintenance Priority"
        subtitle="Ranked assets requiring operational attention"
      />

      {/* RANKED WORK QUEUE */}
      <section>
        <div className={PANEL}>
          <div className={PANEL_HEAD}>
            <p className={SECTION_TITLE}>Ranked work queue</p>
            <span className="text-xs tabular text-app-muted">
              Top 50 by priority score
            </span>
          </div>
          {ranking.loading ? (
            <Loading label="Loading ranking…" />
          ) : ranking.error ? (
            <div className="p-4"><ErrorState error={ranking.error} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-app-table text-left text-[13px]">
                <thead>
                  <tr className="border-b border-app-border bg-app-raised">
                    <th className={TH}>Rank</th>
                    <th className={TH}>Asset</th>
                    <th className={`${TH} text-right`}>Failure risk</th>
                    <th className={`${TH} text-right`}>Grid impact</th>
                    <th className={TH}>Criticality</th>
                    <th className={`${TH} text-right`}>Priority score</th>
                    <th className={TH}>Priority level</th>
                    <th className={TH}>Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={a.asset_id} className={TR}>
                      <td className={`${TD} tabular text-app-label`}>{i + 1}</td>
                      <td className={`${TD} ${MONO}`}>
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${a.priority_category === "CRITICAL" ? "bg-critical" : "bg-app-label"}`} />
                        <Link to={`/assets/${a.asset_id}`} className="font-medium text-app-text hover:underline">
                          {a.asset_id}
                        </Link>
                      </td>
                      <td className={`${TD} text-right tabular text-app-text`}>{num(a.failure_risk, 1)}%</td>
                      <td className={`${TD} text-right tabular text-app-text`}>{num(a.grid_impact)}</td>
                      <td className={`${TD} text-xs text-app-muted`}>{cap(a.criticality)}</td>
                      <td className={`${TD} text-right tabular font-semibold text-app-text`}>{num(a.priority_score)}</td>
                      <td className={TD}><StatusBadge category={a.priority_category} size="sm" /></td>
                      <td className={`${TD} text-xs text-app-muted`}>
                        {RECOMMENDED_ACTION[a.priority_category] || "Routine monitoring"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-app-borderDim px-4 py-2 text-[11px] text-app-label">
            Priority fuses predicted failure risk with simulated consequence — scarce crews visit
            the assets whose failure hurts most.
          </p>
        </div>
      </section>

      {/* CREW ALLOCATION */}
      <section className="mt-6">
        <div className={PANEL}>
          <div className={`${PANEL_HEAD} flex-wrap`}>
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-label">
                <HardHat className="h-4 w-4 text-app-muted" />
                Crew allocation — {crewSafe(crews)} crew{crewSafe(crews) === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-[11px] text-app-muted">
                Greedy assignment over the ranked list. Crews are assigned to the highest-priority
                assets first. Decision-support aid, not an optimal OR solver.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-app-label" htmlFor="crew-count">
                Crews
              </label>
              <input
                id="crew-count"
                type="number"
                min={0}
                max={50}
                value={crews}
                onChange={(e) => setCrews(e.target.value === "" ? 0 : Number(e.target.value))}
                className={`${INPUT} w-20`}
                aria-label="Crew count"
              />
              <button onClick={runAllocation} disabled={allocLoading} className={BTN_PRIMARY}>
                Allocate crews
              </button>
            </div>
          </div>

          {allocError && (
            <div className="mx-4 my-3 rounded border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              {allocError.message}
            </div>
          )}

          {alloc ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 text-xs text-app-muted">
                <span>
                  Assigned: <span className="tabular font-medium text-app-text">{assigned.length}</span> assets
                </span>
                <span>
                  Still uncovered (critical/high):{" "}
                  <span className="tabular font-medium text-app-text">{alloc.unassigned_high_priority.length}</span>
                </span>
                <span className={MUTED}>{alloc.method}</span>
              </div>
              {assigned.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-app-muted">
                  No assets to assign at this crew count.
                </p>
              ) : (
                <div className="grid gap-3 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
                  {assigned.map((a, i) => (
                    <div key={a.asset_id} className="border border-app-border bg-app-raised/60">
                      <p className="flex items-center gap-2 border-b border-app-border bg-app-raised px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-app-label">
                        Crew {i + 1}
                        <StatusBadge category={a.priority_category} size="sm" />
                      </p>
                      <div className="flex items-center justify-between px-3 py-2">
                        <Link to={`/assets/${a.asset_id}`} className={`font-medium text-app-text hover:underline ${MONO}`}>
                          {a.asset_id}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-app-label">
                          <span className="">risk {num(a.failure_risk, 0)}%</span>
                          <span className="tabular font-medium text-app-text">score {num(a.priority_score)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="px-4 py-4 text-xs text-app-muted">
              Choose a crew count and click “Allocate crews” to see the assignment plan.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function crewSafe(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(50, Math.round(v)));
}