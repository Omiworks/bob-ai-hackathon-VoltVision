import StatusBadge from "./StatusBadge";
import { PANEL_PADDED, SECTION_TITLE, MUTED } from "../lib/ui";

// Assessment metric with restrained emphasis — the number is the focus but
// sized for an operations console, not a marketing page.
export default function MetricCard({
  label,
  value,
  unit,
  category,
  note,
  children,
}) {
  return (
    <div className={PANEL_PADDED}>
      <div className="flex items-start justify-between gap-2">
        <p className={SECTION_TITLE}>{label}</p>
        {category && <StatusBadge category={category} size="sm" />}
      </div>
      <p className="mt-1.5 text-3xl font-semibold tabular text-app-text">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-app-label">{unit}</span>}
      </p>
      {note && <p className={`mt-1 leading-relaxed ${MUTED}`}>{note}</p>}
      {children}
    </div>
  );
}