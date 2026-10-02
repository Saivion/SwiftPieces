"use client";
import { useState } from "react";
import { fitTo } from "../../../definitions/app-pieces/band-trend.js";
import { numbers, smoothPath, tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, fw, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useDrag } from "../runtime.js";
import { LABEL, LABEL2, WideRoot, nearest, useHaptic, useWidth } from "./data-kit.js";
import { useFirstAppearance } from "./first-appearance.js";

export const BandTrend: Renderer = (r) => {
  const values = numbers(s(r.p, "values"));
  const count = Math.max(values.length, 2);
  const mid = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const lower = fitTo(numbers(s(r.p, "lower")), count, mid * 0.8);
  const upper = fitTo(numbers(s(r.p, "upper")), count, mid * 1.2);
  const labels = s(r.p, "labels").split(",").map((l) => l.trim());
  const color = accentize(tintHex(s(r.p, "tint"), "azure"));
  const h = n(r.p, "height") || 170;
  const dots = r.p.dots !== false;
  const lastLabel = labels.slice(0, count).reduce((k, l, i) => (l ? i : k), -1);
  const [ref, w] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const haptic = useHaptic();
  // Draws in from the left on appear, like the Swift mask sweeping open.
  const drawn = useFirstAppearance(r.node.id);
  const reduce = reducedMotion();

  const all = [...values, ...lower, ...upper];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  const y = (v: number) => 8 + (1 - (v - lo + pad) / (hi - lo + pad * 2)) * (h - 16);
  const x = (i: number) => 6 + (i / (count - 1)) * (w - 12);
  const edge = (vals: number[]) => vals.map((v, i) => [x(i), y(v)] as [number, number]);
  const band = (a: number[], b: number[]) => {
    const top = smoothPath(edge(b));
    const bottom = smoothPath(edge(a).reverse()).replace(/^M/, "L");
    return `${top} ${bottom} Z`;
  };
  const inner = (k: number) => lower.map((l, i) => l + (upper[i] - l) * k);

  const pick = (px: number, el: Element) => {
    const i = nearest(px, w, count, 6);
    if (i !== sel) haptic("selection", el);
    setSel(i);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x: px, el }) => pick(px, el), onMove: ({ x: px, el }) => pick(px, el), onEnd: () => setTimeout(() => setSel(null), 900) });

  const caption = sel == null || sel >= values.length
    ? "Drag to read a day"
    : `${Math.round(values[sel])} · ${values[sel] > upper[sel] ? "Above your range" : values[sel] < lower[sel] ? "Below your range" : "In your range"}`;

  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: ts(13), fontWeight: fw(600), color: LABEL2 }}>{caption}</span>
      <div ref={ref} onPointerDown={drag} style={{ position: "relative", height: h, touchAction: "pan-y", cursor: "ew-resize" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible", clipPath: drawn || reduce ? "inset(-10px -10px -10px -10px)" : "inset(-10px 100% -10px -10px)", opacity: drawn ? 1 : 0, transition: reduce ? "opacity .2s ease-out" : "clip-path .3s cubic-bezier(.2,.8,.2,1), opacity .3s ease-out" }}>
          <path d={band(lower, upper)} fill={color} opacity={0.85} />
          <path d={band(inner(0.25), inner(0.75))} fill={`color-mix(in srgb, ${color} 75%, white)`} />
          <path d={smoothPath(edge(values), 0.2)} fill="none" stroke={LABEL} strokeWidth={1.5} />
          {sel != null && sel < values.length ? <line x1={x(sel)} x2={x(sel)} y1={0} y2={h} stroke={LABEL} strokeOpacity={0.25} /> : null}
          {values.map((v, i) =>
            dots || sel === i ? (
              <circle key={i} cx={x(i)} cy={y(v)} r={sel === i ? 6 : 2.6} fill={sel === i ? "var(--spb-theme-bg, var(--ios-bg))" : LABEL} stroke={LABEL} strokeWidth={sel === i ? 2.5 : 0} style={{ transition: "r .15s ease-out" }} />
            ) : null,
          )}
        </svg>
      </div>
      <div style={{ position: "relative", height: 18 }}>
        {labels.slice(0, count).map((l, i) =>
          l ? (
            <span key={i} style={{ position: "absolute", left: x(i), transform: "translateX(-50%)", fontSize: ts(13), color: i === lastLabel ? LABEL : LABEL2, fontWeight: fw(i === lastLabel ? 600 : 400) }}>{l}</span>
          ) : null,
        )}
      </div>
    </WideRoot>
  );
};
