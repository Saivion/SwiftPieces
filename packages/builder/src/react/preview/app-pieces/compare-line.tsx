"use client";
import { useState } from "react";
import { compact } from "../../../definitions/app-pieces/compare-line.js";
import { numbers, smoothPath, tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { useDrag } from "../runtime.js";
import { LABEL, LABEL2, SEP, WideRoot, nearest, useHaptic, useWidth } from "./data-kit.js";
import { enter } from "./wellbeing-shared.js";

const AXIS = 40; // room on the right for guide labels

export const CompareLine: Renderer = (r) => {
  const current = numbers(s(r.p, "current"));
  const reference = numbers(s(r.p, "reference"));
  const bars = numbers(s(r.p, "bars"));
  const barRef = numbers(s(r.p, "barReference"));
  const marks = numbers(s(r.p, "marks"));
  const labels = s(r.p, "labels").split(",").map((l) => l.trim());
  const names = s(r.p, "names").split(",").map((x) => x.trim());
  const color = accentize(tintHex(s(r.p, "tint"), "ember"));
  const refColor = accentize(tintHex(s(r.p, "referenceTint"), "gray"));
  const smooth = s(r.p, "curve") !== "linear";
  const h = n(r.p, "height") || 180;
  const average = n(r.p, "average");
  const count = Math.max(current.length, reference.length, bars.length, 2);
  const [ref, w] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const haptic = useHaptic();
  const plotW = w - AXIS;

  const fromZero = r.p.fromZero !== false;
  const all = [...current, ...reference, ...marks, ...(fromZero ? [0] : [])];
  const top = Math.max(...all);
  const bottom = Math.min(...all);
  const pad = fromZero ? 0 : (top - bottom) * 0.12 || 1;
  const hi = fromZero ? top * 1.08 || 1 : top + pad;
  const lo = bottom - pad;
  const x = (i: number) => (bars.length ? ((i + 0.5) / count) * plotW : (i / (count - 1)) * plotW);
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (h - 12);
  const line = (vals: number[]) => {
    const pts = vals.map((v, i) => [x(i), y(v)] as [number, number]);
    return smooth ? smoothPath(pts, 0.35) : `M${pts.map((p) => p.join(",")).join(" L")}`;
  };

  const pick = (px: number, el: Element) => {
    const i = bars.length ? Math.max(0, Math.min(count - 1, Math.floor((px / plotW) * count))) : nearest(px, plotW, count);
    if (i !== sel) haptic("selection", el);
    setSel(i);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x: px, el }) => pick(px, el), onMove: ({ x: px, el }) => pick(px, el), onEnd: () => setTimeout(() => setSel(null), 1200) });

  const readout = sel == null
    ? "Drag across the chart"
    : [current[sel] != null ? `${names[0] || "Now"} ${compact(current[sel])}` : "", reference[sel] != null ? `${names[1] || "Before"} ${compact(reference[sel])}` : ""].filter(Boolean).join("  ·  ");

  const bh = h * 0.8;
  const bhi = Math.max(...bars, ...barRef, average, 1) * 1.1;
  const by = (v: number) => bh - (v / bhi) * bh;
  const lastLabel = labels.reduce((k, l, i) => (l ? i : k), -1);
  const axisLabels = (
    <div style={{ position: "relative", height: 18, marginRight: AXIS }}>
      {labels.slice(0, count).map((l, i) =>
        l ? <span key={i} style={{ position: "absolute", left: x(i), transform: `translateX(max(-50%, ${-x(i)}px))`, fontSize: ts(13), whiteSpace: "nowrap", color: /today/i.test(l) ? LABEL : LABEL2, fontWeight: fw(/today/i.test(l) || i === lastLabel && /today/i.test(l) ? 600 : 400) }}>{l}</span> : null,
      )}
    </div>
  );

  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: ts(13), fontWeight: fw(600), color: LABEL2 }}>{readout}</span>
      <div ref={ref} onPointerDown={drag} data-spw-anim="wipe" style={{ ...enter("wipe").style, position: "relative", touchAction: "pan-y", cursor: "ew-resize", display: "flex", flexDirection: "column", gap: 14 }}>
        <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
          {marks.map((m) => (
            <g key={m}>
              <line x1={0} x2={plotW} y1={y(m)} y2={y(m)} stroke={LABEL2} strokeOpacity={0.35} strokeDasharray="3 4" />
              <text x={plotW + 8} y={y(m) + 4} fontSize={ts(13)} fill={LABEL2}>{compact(m)}</text>
            </g>
          ))}
          <line x1={0} x2={plotW} y1={h - 0.5} y2={h - 0.5} stroke={SEP} />
          {reference.length ? <path d={line(reference)} fill="none" stroke={refColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
          <path d={line(current)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {sel != null ? <line x1={x(sel)} x2={x(sel)} y1={0} y2={h} stroke={LABEL2} strokeWidth={1.2} /> : null}
          {sel != null && current[sel] != null ? <circle cx={x(sel)} cy={y(current[sel])} r={6} fill="var(--spb-theme-bg, var(--ios-bg))" stroke={color} strokeWidth={3} /> : null}
          {sel != null && reference[sel] != null ? <circle cx={x(sel)} cy={y(reference[sel])} r={4} fill={refColor} /> : null}
        </svg>
        {!bars.length && labels.some(Boolean) ? axisLabels : null}
        {bars.length ? (
          <>
            <svg width={w} height={bh} style={{ overflow: "visible", display: "block" }}>
              {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={0} x2={plotW} y1={bh * (1 - k)} y2={bh * (1 - k)} stroke={LABEL2} strokeOpacity={0.25} strokeDasharray="3 4" />)}
              <line x1={0} x2={plotW} y1={bh - 0.5} y2={bh - 0.5} stroke={SEP} />
              {bars.map((v, i) => (
                <g key={i}>
                  {barRef[i] ? <rect x={x(i) + 1} y={by(barRef[i])} width={4} height={bh - by(barRef[i])} rx={1.5} fill={refColor} opacity={0.55} /> : null}
                  <rect x={x(i) - 5} y={by(v)} width={4} height={bh - by(v)} rx={1.5} fill={color} opacity={sel == null || sel === i ? 1 : 0.35} />
                </g>
              ))}
              {average > 0 ? (
                <g>
                  <line x1={0} x2={plotW + 4} y1={by(average)} y2={by(average)} stroke={color} strokeWidth={1.5} />
                  <text x={plotW + 8} y={by(average) + 4} fontSize={ts(13)} fontWeight={fw(600)} fill={color}>{s(r.p, "averageLabel")}</text>
                </g>
              ) : null}
              {sel != null ? <line x1={x(sel)} x2={x(sel)} y1={0} y2={bh} stroke={LABEL2} strokeWidth={1.2} /> : null}
            </svg>
            {axisLabels}
          </>
        ) : null}
      </div>
      {r.p.legend === true ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: ts(12), color: LABEL }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 14, height: 3, borderRadius: cr(2), background: color }} />{names[0]}</span>
          {reference.length ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 14, height: 3, borderRadius: cr(2), background: refColor }} />{names[1]}</span> : null}
        </div>
      ) : null}
    </WideRoot>
  );
};
