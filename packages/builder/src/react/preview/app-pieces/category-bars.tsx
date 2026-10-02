"use client";
import { useState } from "react";
import { barHex } from "../../../definitions/app-pieces/category-bars.js";
import { items, numbers } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, ts, accentize, fw } from "../env.js";
import { useDrag } from "../runtime.js";
import { LABEL, LABEL2, SEP, WideRoot, useHaptic, useWidth } from "./data-kit.js";

const AXIS_W = 44;
/** Room under the plot for the slanted labels: enough for the longest one, at most 78. */
const labelRoom = (labels: string[]) => Math.min(78, 24 + Math.max(0, ...labels.map((l) => l.length)) * 4.6);

export const CategoryBars: Renderer = (r) => {
  const values = numbers(s(r.p, "values"));
  const labels = items(s(r.p, "labels"));
  const colors = items(s(r.p, "colors")).map((c) => accentize(barHex(c)));
  const h = n(r.p, "height") || 300;
  const [ref, w] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const haptic = useHaptic();
  const max = Math.max(...values, 1);
  const top = Math.ceil((max * 1.15) / 2) * 2;
  const ticks = Array.from({ length: 7 }, (_, i) => Math.round((top / 6) * i));
  const plotH = h - labelRoom(labels);
  const plotW = w - AXIS_W;
  const slot = plotW / Math.max(values.length, 1);
  const y = (v: number) => plotH - (v / top) * plotH;
  const pick = (px: number, el: Element) => {
    const i = Math.floor((px - AXIS_W) / slot);
    if (i < 0 || i >= values.length) return;
    if (i !== sel) haptic("selection", el);
    setSel(i);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x, el }) => pick(x, el), onMove: ({ x, el }) => pick(x, el) });
  const axis = s(r.p, "axis").trim();
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div ref={ref} onPointerDown={drag} style={{ position: "relative", width: "100%", height: h, touchAction: "pan-y", cursor: "pointer" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={AXIS_W} x2={w} y1={y(t)} y2={y(t)} stroke={SEP} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={AXIS_W - 8} y={y(t) + 4} fontSize={ts(12)} textAnchor="end" fill={LABEL2}>{t}</text>
            </g>
          ))}
          {axis ? <text x={10} y={plotH / 2} fontSize={ts(12)} fill={LABEL2} textAnchor="middle" transform={`rotate(-90 10 ${plotH / 2})`}>{axis}</text> : null}
          {values.map((v, i) => {
            const bw = slot * 0.45;
            const x = AXIS_W + slot * i + (slot - bw) / 2;
            return (
              <g key={i} opacity={sel == null || sel === i ? 1 : 0.3} style={{ transition: "opacity .2s" }}>
                <rect className="spa-anim" x={x} y={y(v)} width={bw} height={plotH - y(v)} fill={colors[i % Math.max(colors.length, 1)] ?? "#4D8DFF"} style={{ transformOrigin: `0 ${plotH}px`, animation: `spa-grow .3s cubic-bezier(.23,1,.32,1) ${Math.min(i, 8) * 40}ms both` }} />
                {sel === i ? <text x={x + bw / 2} y={y(v) - 6} fontSize={ts(13)} fontWeight={fw(700)} textAnchor="middle" fill={LABEL}>{v}</text> : null}
                <text x={x + bw / 2 + 4} y={plotH + 14} fontSize={ts(12)} textAnchor="end" fill={LABEL2} transform={`rotate(-40 ${x + bw / 2 + 4} ${plotH + 14})`}>{labels[i] ?? ""}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {s(r.p, "caption").trim() ? <span style={{ fontSize: ts(13), color: LABEL2 }}>{s(r.p, "caption")}</span> : null}
    </WideRoot>
  );
};
