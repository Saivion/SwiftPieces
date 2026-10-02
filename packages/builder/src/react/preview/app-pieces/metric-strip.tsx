"use client";
import { useEffect, useState } from "react";
import { records } from "../../../definitions/app-pieces/data-kit.js";
import { metricTone, sparkFor } from "../../../definitions/app-pieces/metric-strip.js";
import { Glyph } from "../../icons.js";
import { s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { useFirstAppearance } from "./first-appearance.js";

function Spark({ values, good, GREEN, RED }: { values: number[]; good: boolean; GREEN: string; RED: string }) {
  const w = 44;
  const h = 30;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h * (1 - v)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`-4 -4 ${w + 8} ${h + 8}`} style={{ overflow: "visible" }}>
      <rect x={-4} y={h * 0.1} width={w + 8} height={h * 0.55} rx={4} fill={GREEN} opacity={0.2} />
      {!good ? <rect x={-4} y={h * 0.7} width={w + 8} height={h * 0.34} rx={4} fill={RED} opacity={0.22} /> : null}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={LABEL2} strokeWidth={1.2} />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--spb-card, #fff)" stroke={good ? GREEN : RED} strokeWidth={2.4} />
    </svg>
  );
}

injectStyle("spa-metric-strip-css", `@keyframes spams-fade{from{opacity:0}to{opacity:1}}.spams-fade{animation:spams-fade .2s ease-out both}`);

export const MetricStrip: Renderer = (r) => {
  const rows = records(s(r.p, "items"), 6);
  const raised = s(r.p, "surface") !== "fill";
  const tone = accentize(metricTone(s(r.p, "tone")));
  const [sel, setSel] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const haptic = useHaptic();
  // Tiles ease in from 0.95 with a fade, 40 ms apart; presses dip to 0.97.
  const appeared = useFirstAppearance(r.node.id);
  const [appearedBefore] = useState(appeared);
  const [settled, setSettled] = useState(appearedBefore);
  const reduce = reducedMotion();
  useEffect(() => {
    const b = window.setTimeout(() => setSettled(true), 700);
    return () => {
      window.clearTimeout(b);
    };
  }, []);
  // secondarySystemGroupedBackground when raised, tertiarySystemFill when filled.
  const surface = raised ? (r.scheme === "dark" ? "#1C1C1E" : "#FFFFFF") : "var(--ios-fill)";
  const dotFill = raised ? surface : r.scheme === "dark" ? "#000000" : "#FFFFFF";
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 10, ["--spb-card" as string]: dotFill }}>
      <div style={{ display: "flex", gap: 8 }}>
        {rows.map(([name = "", symbol = "heart.fill", value = "", unit = "", status = "in"], i) => {
          const good = status.toLowerCase() !== "out";
          const scale = !appeared && !reduce ? 0.95 : pressed === i ? 0.97 : 1;
          return (
            <div
              key={i}
              onPointerDown={() => setPressed(i)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              onClick={(e) => {
                haptic("selection", e.currentTarget);
                setSel((c) => (c === i ? null : i));
              }}
              style={{
                flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "12px 6px", borderRadius: cr(16),
                background: surface, color: LABEL, cursor: "pointer", userSelect: "none",
                boxShadow: sel === i ? "inset 0 0 0 2px var(--ios-accent)" : undefined,
                opacity: appeared ? 1 : 0,
                transform: scale === 1 ? undefined : `scale(${scale})`,
                transition: settled ? "transform .12s ease-out, box-shadow .15s ease-out" : `transform .3s ease-out ${reduce ? 0 : Math.min(i, 7) * 0.04}s, opacity ${reduce ? 0.2 : 0.3}s ease-out ${reduce ? 0 : Math.min(i, 7) * 0.04}s`,
              }}
              title={name}
            >
              <Glyph name={symbol} size={17} style={{ marginBottom: 4 }} />
              <span style={{ fontSize: ts(20), fontWeight: fw(700), lineHeight: "24px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{value}</span>
              <span style={{ fontSize: ts(12), lineHeight: "15px", whiteSpace: "nowrap" }}>{unit}</span>
              <div style={{ width: "100%", padding: "8px 4px 0" }}><Spark values={sparkFor(name || String(i), good)} good={good} GREEN={tone.good} RED={tone.bad} /></div>
            </div>
          );
        })}
      </div>
      {sel != null && rows[sel] ? (
        <span key={sel} className="spams-fade" style={{ fontSize: ts(13), color: LABEL2 }}>
          {rows[sel][0]}: {(rows[sel][4] ?? "in").toLowerCase() !== "out" ? "within your usual range" : "outside your usual range"}
        </span>
      ) : null}
    </WideRoot>
  );
};
