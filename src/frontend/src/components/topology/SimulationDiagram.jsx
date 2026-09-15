// Custom SVG rendering of a Phase 4 simulation result as a technical network
// diagram: SUBSTATION -> failed ASSET -> affected ZONES -> affected FACILITIES
// -> Customers / stressed neighbor assets. Pure presentation of data already
// returned by the backend; the substation label comes from the asset record.
// Dark-theme rendering with thin lines and restrained status colors.

const C = {
  panel: "#10151c",
  raised: "#151b23",
  border: "#242e3a",
  line: "#3a4654",
  faint: "#2a3542",
  accent: "#4f84c3",
  accentText: "#7aa7d6",
  accentDim: "#3a688f",
  critical: "#c8574f",
  criticalDim: "#e0756b",
  criticalLine: "#c8574f",
  amber: "#cf8f3f",
  amberText: "#e0a45c",
  body: "#c2cbd6",
  label: "#8a95a4",
  zoneFill: "#151b23",
};

function Box({ x, y, w, h, rx = 3, fill, stroke, text, sub, textFill = C.body, subFill = C.label }) {
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
  return <polygon points={`${x - 7},${y - 5} ${x - 7},${y + 5} ${x},${y}`} fill={C.line} />;
}

export default function SimulationDiagram({ sim, substation }) {
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
          fill="#0f1c2a"
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
          fill={severityHigh ? "rgba(200,87,79,0.12)" : "rgba(207,143,63,0.10)"}
          stroke={assetColor}
          text={sim.failed_asset}
          sub={`${sim.asset_type || "asset"} · FAILS`}
          textFill={assetText}
          subFill={severityHigh ? "rgba(224,117,107,0.85)" : "rgba(224,164,92,0.85)"}
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
              fill={critical ? "rgba(200,87,79,0.12)" : C.zoneFill}
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
          fill="#0f1c2a"
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
            fill="rgba(207,143,63,0.08)"
            stroke="rgba(207,143,63,0.55)"
            text={s.asset_id}
            sub={`stress ${Number(s.stress_score).toFixed(0)}`}
            textFill={C.amberText}
            subFill={C.amber}
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
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-app-accent bg-app-accentSoft" />
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
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-app-accent bg-app-accentSoft" />
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