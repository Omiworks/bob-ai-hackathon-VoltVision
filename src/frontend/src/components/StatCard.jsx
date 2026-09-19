// Compact operational metric block — intentionally small, tabular values,
// used in the header "GRID STATUS" strip. Not a decorative card.
export default function StatCard({ label, value, sub, accent, tip }) {
  return (
    <div
      className="rounded-xl2 border border-app-border/70 bg-app-panel px-4 py-3 shadow-neu"
      title={tip}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-app-label etched">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular text-app-text ${accent || ""}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-app-muted">{sub}</p>}
    </div>
  );
}