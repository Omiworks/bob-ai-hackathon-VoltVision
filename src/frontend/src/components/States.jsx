// Loading skeletons / error / empty placeholders shared across pages.
import { PANEL_PADDED } from "../lib/ui";

export function Loading({ label = "Loading data…" }) {
  return (
    <div className={`${PANEL_PADDED} flex items-center justify-center gap-3 py-16`}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-app-border border-t-app-accent" />
      <p className="text-sm text-app-muted">{label}</p>
    </div>
  );
}

// Compact skeleton matching the dense row style used on data pages.
export function RowSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3 animate-pulse rounded bg-app-raised"
              style={{ width: `${c === 0 ? 90 : 60 + ((r * 13 + c * 7) % 70)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const message = error && error.message ? error.message : "Something went wrong.";
  const status = error && error.status ? error.status : null;
  return (
    <div className="mx-auto max-w-xl rounded border border-critical/40 bg-critical/10 p-6 text-center">
      <p className="text-sm font-semibold text-critical">
        {status ? `Error ${status}` : "Request failed"}
      </p>
      <p className="mt-1 text-sm text-app-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded border border-critical/50 bg-transparent px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, sub }) {
  return (
    <div className="rounded border border-dashed border-app-border p-10 text-center">
      <p className="text-sm font-medium text-app-muted">{title || "Nothing here yet"}</p>
      {sub && <p className="mt-1 text-xs text-app-label">{sub}</p>}
    </div>
  );
}