import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORIES } from "../../lib/constants";
import { statusColor } from "../../lib/theme";
import { useThemeMode, useThemeColors } from "../../hooks/useTheme";
import { int } from "../../lib/format";

// Doughnut chart for a category distribution (risk or priority) with legend.
// Theme-aware: slice colors, divider stroke and tooltip follow light/dark.
export default function DistributionDoughnut({ title, distribution }) {
  const mode = useThemeMode();
  const [panel, border, text] = useThemeColors("--gg-panel", "--gg-border", "--gg-text");

  const data = CATEGORIES.map((c) => ({
    name: c,
    value: Number(distribution?.[c] || 0),
  })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="rounded-xl2 border border-app-border/70 bg-app-panel shadow-neu">
      <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-app-label etched">{title}</p>
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={70}
                paddingAngle={1.5}
                strokeWidth={2}
                stroke={panel}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={statusColor(entry.name, mode)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${int(value)} assets`, "count"]}
                contentStyle={{
                  background: panel,
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: text }}
                itemStyle={{ color: text }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {CATEGORIES.map((c) => {
            const n = Number(distribution?.[c] || 0);
            const share = Math.round((n / total) * 100);
            return (
              <div key={c} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-app-muted">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: statusColor(c, mode) }}
                  />
                  {c}
                </span>
                <span className="tabular text-app-text">
                  {int(n)} · {share}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
