import { categoryStyle, cap } from "../lib/constants";

// Small colored pill for LOW / MEDIUM / HIGH / CRITICAL categories.
export default function StatusBadge({ category, size = "md" }) {
  const style = categoryStyle(category);
  const sizing = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium tracking-wide ring-1 ring-inset ring-white/50 ${sizing} ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shadow-sm ${style.dot}`} />
      {cap(category || "--")}
    </span>
  );
}