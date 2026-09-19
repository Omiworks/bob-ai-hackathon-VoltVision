import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORIES } from "../../lib/constants";
import { statusColor } from "../../lib/theme";
import { useThemeMode, useThemeColors } from "../../hooks/useTheme";
import { int } from "../../lib/format";

// Solid pie chart (no inner hole) of a risk/priority category distribution.
// Clicking a slice calls onSlice(category) — the dashboard uses it to open
// the filtered asset list for that category. Theme-aware: slice colors and
// the slice divider follow light/dark mode; accent affects nothing here.
export default function RiskPieChart({ distribution, height = 190, onSlice }) {
  const mode = useThemeMode();
  const [panel, border, text] = useThemeColors("--gg-panel", "--gg-border", "--gg-text");

  const data = CATEGORIES.map((c) => ({
    name: c,
    value: Number(distribution?.[c] || 0),
  })).filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-app-muted">No distribution data.</p>
    );
  }

  const handleClick = (entry) => {
    const name = entry?.name || entry?.payload?.name;
    if (onSlice && name) onSlice(name);
  };

  return (
    <div style={{ height }} className="w-full max-w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={0}
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={2}
            stroke={panel}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={statusColor(entry.name, mode)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${int(value)} asset${Number(value) === 1 ? "" : "s"}`, name]}
            contentStyle={{
              background: panel,
              border: `1px solid ${border}`,
              borderRadius: 8,
              fontSize: 12,
              color: text,
            }}
            labelStyle={{ color: text }}
            itemStyle={{ color: text }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
