import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { statusColor } from "../../lib/theme";
import { useThemeMode, useThemeColors } from "../../hooks/useTheme";

const QUADRANTS = [
  { pos: "top-4 left-10", label: "Low risk · high impact" },
  { pos: "top-4 right-3 text-right", label: "High risk · high impact" },
  { pos: "bottom-28 left-10", label: "Low risk · low impact" },
  { pos: "bottom-28 right-3 text-right", label: "High risk · low impact" },
];

// One point per asset: x = predicted failure risk, y = grid impact.
// Color = priority category. Reference lines at the 50 thresholds highlight
// the insight that failure likelihood and grid consequence are independent
// dimensions (e.g. high risk / moderate impact vs low risk / high impact).
// Theme-aware: grid, ticks, quadrant lines and tooltip follow light/dark.
export default function RiskImpactScatter({ assets, withQuadrants }) {
  const navigate = useNavigate();
  const mode = useThemeMode();
  const [grid, border, label, accent, panel] = useThemeColors(
    "--gg-borderDim",
    "--gg-border",
    "--gg-label",
    "--gg-accent",
    "--gg-panel"
  );

  const data = (assets || []).map((a) => ({
    ...a,
    x: Number(a.failure_risk) || 0,
    y: Number(a.grid_impact) || 0,
    fill: statusColor(a.priority_category, mode),
  }));

  return (
    <div className="relative h-[340px] w-full">
      {withQuadrants &&
        QUADRANTS.map((q) => (
          <span
            key={q.label}
            className={`pointer-events-none absolute z-10 ${q.pos} text-[9px] font-semibold uppercase tracking-[0.14em] text-app-label`}
          >
            {q.label}
          </span>
        ))}
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Failure risk"
            domain={[0, 100]}
            tick={{ fill: label, fontSize: 11 }}
            stroke={border}
            label={{
              value: "Failure risk (% model-estimated) →",
              position: "insideBottomRight",
              offset: -4,
              fill: label,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Grid impact"
            domain={[0, 100]}
            tick={{ fill: label, fontSize: 11 }}
            stroke={border}
            label={{
              value: "Grid impact of failure",
              angle: -90,
              position: "insideLeft",
              fill: label,
              fontSize: 11,
            }}
          />
          <ReferenceLine x={50} stroke={border} strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke={border} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: accent }}
            content={({ payload }) => {
              const p = payload && payload[0] && payload[0].payload;
              if (!p) return <span />;
              return (
                <div
                  className="rounded-lg px-3 py-2 text-xs shadow-neu"
                  style={{ background: panel, border: `1px solid ${border}` }}
                >
                  <p className="font-semibold text-app-text">{p.asset_id}</p>
                  <p className="mt-0.5 text-app-muted">
                    Risk {Number(p.failure_risk).toFixed(1)}% · Impact{" "}
                    {Number(p.grid_impact).toFixed(1)} · {p.priority_category}
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            onClick={(dot) => dot && dot.asset_id && navigate(`/assets/${dot.asset_id}`)}
            className="cursor-pointer"
          >
            {data.map((point) => (
              <Cell key={point.asset_id} fill={point.fill} fillOpacity={0.85} stroke={panel} strokeWidth={1} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
