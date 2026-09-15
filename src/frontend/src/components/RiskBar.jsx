import { categoryStyle } from "../lib/constants";
import { num } from "../lib/format";

// Horizontal value bar colored by severity category (low -> high).
export default function RiskBar({ value, category, showValue = true, thin = false }) {
  const v = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  const style = categoryStyle(category);
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-full min-w-[40px] overflow-hidden rounded-sm bg-app-raised ${thin ? "h-1" : "h-1.5"}`}
      >
        <div className={`h-full ${style.bar}`} style={{ width: `${v}%` }} />
      </div>
      {showValue && (
        <span className="w-10 text-right text-xs tabular text-app-text">
          {num(v, 0)}
        </span>
      )}
    </div>
  );
}