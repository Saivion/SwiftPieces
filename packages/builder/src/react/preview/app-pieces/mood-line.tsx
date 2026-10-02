"use client";
// Mood Line (definitions/app-pieces/mood-line.ts): faces up the leading edge, a dot per logged day in
// its mood's colour, each stretch blending its two days' colours. It wipes in from the left (a fade
// under Reduce Motion); dragging reads the nearest logged day with a selection tick per new day.
import { useState } from "react";
import { MOOD_COLORS, MOOD_STROKES_LIGHT, moodLabels } from "../../../definitions/app-pieces/mood-faces.js";
import { MOOD_LINE_FOOTER, MOOD_LINE_GUTTER, MOOD_LINE_TOP, moodDays } from "../../../definitions/app-pieces/mood-line.js";
import { n, s, type Renderer, cr, fw, ts } from "../env.js";
import { useDrag } from "../runtime.js";
import { LABEL, LABEL2, SEP, WideRoot, useHaptic, useWidth } from "./data-kit.js";
import { FaceGlyph, enter } from "./wellbeing-shared.js";

export const MoodLine: Renderer = (r) => {
  const days = moodDays(r.p.values);
  const labels = moodLabels(r.p.labels);
  const month = s(r.p, "month").trim();
  const every = Math.max(1, Math.round(n(r.p, "every") || 5));
  const h = n(r.p, "height") || 200;
  const [ref, w] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const haptic = useHaptic();
  const plot = { x: MOOD_LINE_GUTTER, y: MOOD_LINE_TOP, w: Math.max(1, w - MOOD_LINE_GUTTER - 6), h: Math.max(1, h - MOOD_LINE_FOOTER - MOOD_LINE_TOP) };
  const step = days.length > 1 ? plot.w / (days.length - 1) : 0;
  const px = (day: number) => plot.x + day * step;
  const py = (level: number) => plot.y + (plot.h * (4 - level)) / 4;
  const pick = (x: number, el: Element) => {
    const day = Math.min(days.length - 1, Math.max(0, Math.round((x - plot.x) / (step || 1))));
    if (days[day] === null || day === sel) return;
    haptic("selection", el);
    setSel(day);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x, el }) => pick(x, el), onMove: ({ x, el }) => pick(x, el) });
  const id = `spml-${r.node.id}`;
  // The line and dots a shade deeper on a light ground, as the Swift's light/dark pairs are.
  const ink = r.scheme === "light" ? MOOD_STROKES_LIGHT : MOOD_COLORS;
  const picked = sel !== null ? days[sel] : null;
  return (
    <WideRoot r={r}>
      <div ref={ref} onPointerDown={drag} style={{ position: "relative", height: h, touchAction: "pan-y", cursor: "ew-resize", userSelect: "none" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          <defs>
            {days.map((a, d) => {
              const b = days[d + 1];
              if (a === null || b === undefined || b === null) return null;
              return (
                <linearGradient key={d} id={`${id}-${d}`} gradientUnits="userSpaceOnUse" x1={px(d)} y1={py(a)} x2={px(d + 1)} y2={py(b)}>
                  <stop offset="0" stopColor={ink[a]} />
                  <stop offset="1" stopColor={ink[b]} />
                </linearGradient>
              );
            })}
          </defs>
          {[0, 1, 2, 3, 4].map((level) => <line key={level} x1={plot.x} x2={plot.x + plot.w} y1={py(level)} y2={py(level)} stroke={SEP} />)}
          <g data-spw-anim="wipe" style={enter("wipe").style}>
            {days.map((a, d) => {
              const b = days[d + 1];
              if (a === null || b === undefined || b === null) return null;
              return <line key={d} x1={px(d)} y1={py(a)} x2={px(d + 1)} y2={py(b)} stroke={`url(#${id}-${d})`} strokeWidth={2.5} strokeLinecap="round" />;
            })}
            {days.map((a, d) => (a === null ? null : <circle key={d} cx={px(d)} cy={py(a)} r={sel === d ? 6 : 3.5} fill={ink[a]} style={{ transition: "r .15s ease-out" }} />))}
          </g>
          {sel !== null && picked !== null ? <line x1={px(sel)} x2={px(sel)} y1={plot.y} y2={plot.y + plot.h} stroke={LABEL2} strokeWidth={1} /> : null}
        </svg>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} style={{ position: "absolute", left: 0, top: py(level) - 11, width: 22, height: 22, borderRadius: cr("50%"), background: MOOD_COLORS[level], display: "grid", placeItems: "center" }}>
            <FaceGlyph level={level} size={22} color="#141414" />
          </span>
        ))}
        {days.map((_, d) =>
          d === 0 || (d + 1) % every === 0 ? (
            <span key={d} style={{ position: "absolute", left: px(d), top: h - MOOD_LINE_FOOTER / 2 - 6, transform: "translateX(-50%)", fontSize: ts(11), color: LABEL2, fontVariantNumeric: "tabular-nums" }}>{d + 1}</span>
          ) : null,
        )}
        {sel !== null && picked !== null ? (
          <span style={{ position: "absolute", left: Math.min(Math.max(px(sel), plot.x + 50), plot.x + plot.w - 50), top: Math.max(plot.y + 12, py(picked) - 24) - 12, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "5px 10px", borderRadius: cr(999), background: "var(--ios-fill)", backdropFilter: "blur(12px)", fontSize: ts(12), fontWeight: fw(600), color: LABEL, pointerEvents: "none" }}>
            {month ? `${month} ${sel + 1}` : sel + 1} · {labels[picked]}
          </span>
        ) : null}
      </div>
    </WideRoot>
  );
};
