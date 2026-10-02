"use client";
import { useState } from "react";
import { STAGE_NAMES, stageColors, STAGES, clock, parseStages } from "../../../definitions/app-pieces/stage-timeline.js";
import { n, s, type Renderer, cr, fw, ts } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useDrag } from "../runtime.js";
import { LABEL2, WideRoot, useHaptic, useWidth } from "./data-kit.js";
import { useFirstAppearance } from "./first-appearance.js";

export const StageTimeline: Renderer = (r) => {
  const segs = parseStages(s(r.p, "segments"));
  const start = s(r.p, "start") || "23:10";
  const STAGE_COLORS = stageColors(s(r.p, "palette"));
  const h = n(r.p, "height") || 200;
  const total = Math.max(1, segs.reduce((a, x) => a + x.minutes, 0));
  const [ref, w] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const haptic = useHaptic();
  // The night plays in from the left on appear, like the Swift mask sweeping open.
  const played = useFirstAppearance(r.node.id);
  const reduce = reducedMotion();
  const row = h / 4;
  const offsets = segs.map((_, i) => segs.slice(0, i).reduce((a, x) => a + x.minutes, 0));

  const pick = (px: number, el: Element) => {
    const m = (px / w) * total;
    let i = offsets.findIndex((o, k) => m >= o && m < o + segs[k].minutes);
    if (i < 0) i = m < 0 ? 0 : segs.length - 1;
    if (i !== sel) haptic("selection", el);
    setSel(i);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x, el }) => pick(x, el), onMove: ({ x, el }) => pick(x, el), onEnd: () => setTimeout(() => setSel(null), 900) });
  const readout = sel == null ? "Drag across the night" : `${STAGE_NAMES[segs[sel].stage]} · ${clock(start, offsets[sel])}–${clock(start, offsets[sel] + segs[sel].minutes)}`;

  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: ts(13), fontWeight: fw(600), color: LABEL2 }}>{readout}</span>
      <div ref={ref} onPointerDown={drag} style={{ touchAction: "pan-y", cursor: "ew-resize" }}>
        <svg width={w} height={h} style={{ display: "block", overflow: "visible", clipPath: played || reduce ? "inset(-10px -10px -10px -10px)" : "inset(-10px 100% -10px -10px)", opacity: played ? 1 : 0, transition: reduce ? "opacity .2s ease-out" : "clip-path .3s cubic-bezier(.2,.8,.2,1), opacity .3s ease-out" }}>
          {Array.from({ length: Math.floor(total / 60) + 1 }, (_, k) => (
            <line key={k} x1={(w * k * 60) / total} x2={(w * k * 60) / total} y1={0} y2={h} stroke={LABEL2} strokeOpacity={0.4} strokeDasharray="2 4" />
          ))}
          {segs.map((seg, i) => {
            const lvl = STAGES.indexOf(seg.stage as (typeof STAGES)[number]);
            const x0 = (w * offsets[i]) / total;
            const width = Math.max(2, (w * seg.minutes) / total);
            const thin = lvl === 0;
            const prev = i > 0 ? STAGES.indexOf(segs[i - 1].stage as (typeof STAGES)[number]) : lvl;
            const a = Math.min(lvl, prev);
            const b = Math.max(lvl, prev);
            const color = STAGE_COLORS[seg.stage];
            return (
              <g key={i} opacity={sel == null || sel === i ? 1 : 0.35} style={{ transition: "opacity .15s ease-out" }}>
                {b > a ? <line x1={x0} x2={x0} y1={row * a + row * 0.5} y2={row * b + row * 0.5} stroke={LABEL2} strokeOpacity={0.5} strokeWidth={1} /> : null}
                {thin ? (
                  <rect x={x0} y={row * 0.05} width={Math.max(2.5, width)} height={row * 1.6} rx={1.2} fill={`url(#spa-awake-${r.node.id})`} />
                ) : (
                  <rect x={x0} y={row * lvl + row * 0.19} width={width} height={row * 0.62} rx={5} fill={color} />
                )}
              </g>
            );
          })}
          <defs>
            <linearGradient id={`spa-awake-${r.node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={STAGE_COLORS.awake} />
              <stop offset="1" stopColor={STAGE_COLORS.awake} stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {r.p.legend !== false ? (
        <div style={{ display: "flex", gap: 12, fontSize: ts(12) }}>
          {STAGES.map((st) => (
            <span key={st} style={{ display: "flex", alignItems: "center", gap: 4, color: LABEL2 }}>
              <i style={{ width: 8, height: 8, borderRadius: cr(4), background: STAGE_COLORS[st] }} />
              {STAGE_NAMES[st]}
            </span>
          ))}
        </div>
      ) : null}
    </WideRoot>
  );
};
