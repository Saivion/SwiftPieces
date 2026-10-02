"use client";
// Mood Count (definitions/app-pieces/mood-count.ts): the half ring sweeps in from the left over 0.6 s
// (a fade under Reduce Motion); a face tap singles its mood out, dims the rest and reads its days in
// the middle, with a selection tick. Tapping it again shows them all.
import { useEffect, useState } from "react";
import { MOOD_COLORS, MOOD_STROKES_LIGHT, moodLabels } from "../../../definitions/app-pieces/mood-faces.js";
import { moodCounts, moodSpans } from "../../../definitions/app-pieces/mood-count.js";
import { n, s, type Renderer, cr, fw, ts } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { FaceGlyph, PRESS_TRANSITION, press } from "./wellbeing-shared.js";

/** A block of the half ring from `a` to `b` (0 is the left end) as an SVG path, sampled like the Swift. */
function arc(a: number, b: number, cx: number, cy: number, radius: number): string {
  if (b <= a) return "";
  const steps = Math.max(2, Math.round((b - a) * 60));
  const pts = Array.from({ length: steps + 1 }, (_, k) => {
    const t = a + ((b - a) * k) / steps;
    const angle = Math.PI * (1 - t);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy - radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M ${pts.join(" L ")}`;
}

export const MoodCount: Renderer = (r) => {
  const counts = moodCounts(r.p.counts);
  const spans = moodSpans(counts);
  const labels = moodLabels(r.p.labels);
  const unit = s(r.p, "unit") || "days";
  const size = n(r.p, "size") || 240;
  const total = counts.reduce((a, b) => a + b, 0);
  const [picked, setPicked] = useState<number | null>(null);
  const [progress, setProgress] = useState(() => (reducedMotion() ? 1 : 0));
  const haptic = useHaptic();
  useEffect(() => {
    if (reducedMotion()) return setProgress(1);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setProgress(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const h = size / 2 + 14;
  const radius = Math.min(size / 2, h) - 14;
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, userSelect: "none" }}>
      <div style={{ position: "relative", width: size, height: h }}>
        <svg width={size} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
          {spans.map((sp, i) => (
            <path key={i} d={arc(sp.start, Math.min(sp.end, progress), size / 2, h, radius)} fill="none" stroke={(r.scheme === "light" ? MOOD_STROKES_LIGHT : MOOD_COLORS)[i]} strokeWidth={28} opacity={picked === null || picked === i ? 1 : 0.25} style={{ transition: "opacity .25s ease-out" }} />
          ))}
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span key={picked ?? "all"} style={{ fontSize: ts(44), lineHeight: 1.05, fontWeight: fw(300), color: LABEL, fontVariantNumeric: "tabular-nums", animation: "spa-rise .3s cubic-bezier(.22,1,.36,1) both" }}>{picked === null ? total : counts[picked]}</span>
          <span style={{ fontSize: ts(15), color: LABEL2 }}>{picked === null ? unit : labels[picked]}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignSelf: "stretch" }}>
        {counts.map((c, i) => (
          <span key={i} style={{ flex: 1, display: "grid", placeItems: "center" }}>
            <button
              type="button"
              {...press}
              aria-label={`${labels[i]}: ${c}`}
              aria-pressed={picked === i}
              onClick={(e) => {
                haptic("selection", e.currentTarget);
                setPicked((v) => (v === i ? null : i));
              }}
              style={{ all: "unset", position: "relative", width: 44, height: 44, borderRadius: cr("50%"), background: MOOD_COLORS[i], display: "grid", placeItems: "center", cursor: "pointer", opacity: picked === null || picked === i ? 1 : 0.45, transform: `scale(${picked === i ? 1.1 : 1})`, transition: `transform .25s cubic-bezier(.22,1,.36,1), opacity .25s, ${PRESS_TRANSITION}` }}
            >
              <FaceGlyph level={i} size={44} color="#141414" />
              <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, boxSizing: "border-box", padding: "0 4px", borderRadius: cr(10), background: "var(--spb-theme-bg, var(--ios-bg))", boxShadow: `inset 0 0 0 2px ${MOOD_COLORS[i]}`, display: "grid", placeItems: "center", fontSize: ts(11), fontWeight: fw(700), color: LABEL, fontVariantNumeric: "tabular-nums" }}>{c}</span>
            </button>
          </span>
        ))}
      </div>
    </WideRoot>
  );
};
