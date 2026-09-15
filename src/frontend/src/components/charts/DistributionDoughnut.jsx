import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORIES, CATEGORY_STYLES } from "../../lib/constants";
import { int } from "../../lib/format";
import { PANEL, SECTION_TITLE } from "../../lib/ui";

// Doughnut chart for a category distribution (risk or priority) with legend.
export default function DistributionDoughnut({ title, distribution }) {
  const data = CATEGORIES.map((c) => ({
    name: c,
    value: Number(distribution?.[c] || 0),
  })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
        <p className={SECTION_TITLE}>{title}</p>
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
                strokeWidth={1}
                stroke="#10151c"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_STYLES[entry.name].hex} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} assets`, "count"]}
                contentStyle={{
                  background: "#151b23",
                  border: "1px solid #242e3a",
                  borderRadius: 4,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#8a95a4" }}
                itemStyle={{ color: "#d4dbe3" }}
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
                  <span className={`h-2 w-2 rounded-sm ${CATEGORY_STYLES[c].bar}`} />
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