// Custom SVG rendering of a Phase 4 simulation result as a technical network
// diagram: SUBSTATION -> failed ASSET -> affected ZONES -> affected FACILITIES
// -> Customers / stressed neighbor assets. Pure presentation of data already
// returned by the backend; the substation label comes from the asset record.
// Theme-aware: all colors resolve from CSS variables via useThemeColors so
// the diagram follows light/dark mode and the active accent.

import { useThemeColors, useThemeMode } from "../../hooks/useTheme";
import { STATUS_TINTS } from "../../lib/theme";

// Default fallbacks only used before first CSS resolution.
const FALLBACK = {
  panel: "#FBF7EF",
  raised: "#F1EADC",
  border: "#D9CEBC",
  line: "#B4A78F",
  faint: "#D5C9B6",
  accent: "#5B7E9E",
  accentText: "#44658A",
  accentDim: "#4A6A87",
  critical: "#B0524A",
  amber: "#B97F35",
  amberText: "#8F6220",
  body: "#3B342A",
  label: "#9A8E7B",
};

function useDiagramColors() {
  const mode = useThemeMode();
  const [
    panel, raised, border, faint, accent, accentDim, text, muted, label, critical, high,
  ] = useThemeColors(
    "--gg-panel", "--gg-raised", "--gg-border", "--gg-borderDim", "--gg-accent",
    "--gg-accentDim", "--gg-text", "--gg-muted", "--gg-label", "--gg-critical", "--gg-high"
  );
  const tints = STATUS_TINTS[mode] || STATUS_TINTS.light;
  const accentRGB = hexToRgbTriple(accent || FALLBACK.accent);
  const highRGB = hexToRgbTriple(high || FALLBACK.amber);
  return {
    mode,
    panel: panel || FALLBACK.panel,
    raised: raised || FALLBACK.raised,
    border: border || FALLBACK.border,
    line: label || FALLBACK.label,
    faint: faint || FALLBACK.faint,
    accent: accent || FALLBACK.accent,
    accentText: accentDim || FALLBACK.accentText,
    accentDim: accentDim || FALLBACK.accentDim,
    accentTint: `rgba(${accentRGB},0.10)`,
    critical: critical || FALLBACK.critical,
    criticalDim: critical || FALLBACK.critical,
    criticalLine: critical || FALLBACK.critical,
    amber: high || FALLBACK.amber,
    amberText: high || FALLBACK.amber,
    body: text || FALLBACK.body,
    label: muted || FALLBACK.label,
    zoneFill: raised || FALLBACK.raised,
    criticalTint: tints.critical,
    highTint: tints.high,
    highTintSoft: `rgba(${highRGB},0.08)`,
    highStroke: `rgba(${highRGB},0.55)`,
  };
}

function hexToRgbTriple(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "91,126,158";
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function Box({ x, y, w, h, rx = 3, fill, stroke, text, sub, textFill, subFill }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <text
        x={x + w / 2}
        y={y + h / 2 - (sub ? 2 : 1)}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={textFill}
      >
        {text}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" fontSize={9} fill={subFill}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ x, y }) {
  return <polygon points={`${x - 7},${y - 5} ${x - 7},${y + 5} ${x},${y}`} fill="var(--gg-label)" />;
}

export default function SimulationDiagram({ sim, substation }) {
  const C = useDiagramColors();
  if (!sim) return null;

  const severityHigh = ["HIGH", "CRITICAL"].includes(sim.severity);
  const W = 1000;
  const H = 392;
  const backboneY = H / 2 - 8;

  if (!sim.network_node_present) {
    return (
      <div className="rounded border border-app-border bg-app-panel p-4">
        <p className="text-sm font-medium text-app-text">
          Asset is not a node in the distribution graph
        </p>
        <p className="mt-1 text-xs text-app-muted">
          This asset is not connected in network.json, so the simulation has no
          reachable zones or facilities. Consequence estimates come from the
          asset&apos;s own record (facility_source = &quot;{sim.facility_source}&quot;).
          Estimated customer impact: ~{Number(sim.estimated_customers_affected).toLocaleString()}.
        </p>
      </div>
    );
  }

  const zones = (sim.affected_zones || []).slice(0, 5);
  const zonesMore = Math.max(0, (sim.affected_zones || []).length - 5);
  const facilities = (sim.affected_facilities || []).slice(0, 6);
  const facilitiesMore = Math.max(0, (sim.affected_facilities || []).length - 6);
  const stressed = (sim.stressed_assets || []).slice(0, 5);
  const stressedMore = Math.max(0, (sim.stressed_assets || []).length - 5);

  const colX = { subst: 82, asset: 300, zones: 520, facilities: 748, right: 930 };
  const boxW = { subst: 120, asset: 180, zones: 132, facilities: 154, right: 140 };
  const gap = { zones: 54, facilities: 50, stressed: 42 };
  const h = { subst: 34, asset: 56, zones: 30, facilities: 34, stressed: 24, chip: 32 };

  const assetY = backboneY - h.asset / 2;
  const substY = backboneY - h.subst / 2;
  const zoneYs = evenly(zones.length, gap.zones, backboneY);
  const facYs = evenly(facilities.length, gap.facilities, backboneY);
  const chipY = backboneY - 72 - h.chip / 2;
  const stressedTop = backboneY - 32;
  const strYs = stressed.map((_, i) => stressedTop + i * gap.stressed);

  const assetColor = severityHigh ? C.critical : C.amber;
  const assetText = severityHigh ? C.criticalDim : C.amberText;

  return (
    <div className="rounded border border-app-border bg-app-panel p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* backbone + arrows */}
        <line x1={colX.subst + boxW.subst / 2} y1={backboneY} x2={colX.right - boxW.right / 2} y2={backboneY} stroke={C.faint} strokeWidth={1.2} />
        <Arrow x={422} y={backboneY} />
        <Arrow x={628} y={backboneY} />
        <Arrow x={843} y={backboneY} />
        {/* stressed spine (hangs below customers chip) */}
        <line x1={colX.right} y1={chipY + h.chip / 2 + 2} x2={colX.right} y2={stressedTop - 4} stroke={C.faint} strokeWidth={1.2} />

        <Box
          x={colX.subst - boxW.subst / 2}
          y={substY}
          w={boxW.subst}
          h={h.subst}
          fill={C.accentTint}
          stroke={C.accent}
          text={substation || "SUBSTATION"}
          sub="SUBSTATION"
          textFill={C.accentText}
          subFill={C.accentDim}
        />

        <Box
          x={colX.asset - boxW.asset / 2}
          y={assetY}
          w={boxW.asset}
          h={h.asset}
          fill={severityHigh ? C.criticalTint : C.highTint}
          stroke={assetColor}
          text={sim.failed_asset}
          sub={`${sim.asset_type || "asset"} · FAILS`}
          textFill={assetText}
          subFill={assetText}
        />

        {zones.map((z, i) => (
          <Box
            key={z}
            x={colX.zones - boxW.zones / 2}
            y={zoneYs[i] - h.zones / 2}
            w={boxW.zones}
            h={h.zones}
            fill={C.zoneFill}
            stroke={C.line}
            text={z}
          />
        ))}
        {zonesMore > 0 && (
          <text x={colX.zones} y={backboneY + 72} textAnchor="middle" fontSize={10} fill={C.label}>
            +{zonesMore} more zone{zonesMore === 1 ? "" : "s"}
          </text>
        )}

        {facilities.map((f, i) => {
          const critical = f.criticality === "critical";
          return (
            <Box
              key={f.id}
              x={colX.facilities - boxW.facilities / 2}
              y={facYs[i] - h.facilities / 2}
              w={boxW.facilities}
              h={h.facilities}
              fill={critical ? C.criticalTint : C.zoneFill}
              stroke={critical ? C.criticalLine : C.line}
              text={`${f.name}${critical ? " ★" : ""}`}
              textFill={critical ? C.criticalDim : C.body}
            />
          );
        })}
        {facilitiesMore > 0 && (
          <text x={colX.facilities} y={backboneY + 74} textAnchor="middle" fontSize={10} fill={C.label}>
            +{facilitiesMore} more
          </text>
        )}

        <Box
          x={colX.right - boxW.right / 2}
          y={chipY}
          w={boxW.right}
          h={h.chip}
          fill={C.accentTint}
          stroke={C.accent}
          text={`~${Number(sim.estimated_customers_affected || 0).toLocaleString()} customers`}
          sub="CUSTOMER IMPACT"
          textFill={C.accentText}
          subFill={C.accentDim}
        />

        {stressed.map((s, i) => (
          <Box
            key={s.asset_id}
            x={colX.right - boxW.right / 2}
            y={strYs[i]}
            w={boxW.right}
            h={h.stressed}
            fill={C.highTintSoft}
            stroke={C.highStroke}
            text={s.asset_id}
            sub={`stress ${Number(s.stress_score).toFixed(0)}`}
            textFill={C.amberText}
            subFill={C.amberText}
          />
        ))}
        {stressedMore > 0 && (
          <text x={colX.right} y={strYs[strYs.length - 1] + h.stressed + 14} textAnchor="middle" fontSize={10} fill={C.label}>
            +{stressedMore} more stressed asset{stressedMore === 1 ? "" : "s"}
          </text>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-app-borderDim pt-2 text-[11px] text-app-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-app-accent bg-app-accent/15" />
          Substation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-critical/30 ring-1 ring-critical" />
          Failed asset
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-app-border bg-app-raised" />
          Affected zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-critical/30 ring-1 ring-critical" />
          Critical facility
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-app-accent bg-app-accent/15" />
          Customer impact
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-high/20 ring-1 ring-high" />
          Stressed asset
        </span>
      </div>
    </div>
  );
}

function evenly(count, gap, centerY) {
  const ys = [];
  for (let i = 0; i < count; i += 1) {
    ys.push(centerY + (i - (count - 1) / 2) * gap);
  }
  return ys;
}