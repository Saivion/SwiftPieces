"use client";
import { useEffect, useRef, useState } from "react";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { LABEL2, WideRoot, useHaptic } from "./data-kit.js";

injectStyle("spa-goal-ring-css", `@keyframes spgr-in{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spgr-fade{from{opacity:0}to{opacity:1}}
.spgr-enter{animation:spgr-in .28s cubic-bezier(.23,1,.32,1) both}
@media (prefers-reduced-motion: reduce){.spgr-enter{animation-name:spgr-fade}}`);

// Goal Ring (definitions/app-pieces/goal-ring.ts): the card settles in from 0.95 with a fade and the
// ring sweeps to its value (0.6 s ease-out); a tap refills it with a light impact.
export const GoalRing: Renderer = (r) => {
  const done = Math.round(n(r.p, "done"));
  const total = Math.max(1, Math.round(n(r.p, "total")));
  const value = Math.min(1, done / total);
  const size = n(r.p, "size") || 220;
  const color = accentize(tintHex(s(r.p, "tint"), "signal"));
  const [shown, setShown] = useState(value);
  const [run, setRun] = useState(0);
  const haptic = useHaptic();
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, run]);

  const stroke = size * 0.12;
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  return (
    <WideRoot r={r} className={`${r.box.className ?? ""} spgr-enter`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: 20, borderRadius: cr(24), background: "var(--ios-fill)", boxSizing: "border-box" }}>
      <div ref={el} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
        {s(r.p, "dates") ? <span style={{ fontSize: ts(13), color: LABEL2 }}>{s(r.p, "dates")}</span> : null}
        {s(r.p, "title") ? <span style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700), color: "var(--ios-label)" }}>{s(r.p, "title")}</span> : null}
      </div>
      <div onClick={(e) => { haptic("light", e.currentTarget); setRun((k) => k + 1); }} style={{ position: "relative", width: size, height: size, margin: size * 0.06, cursor: "pointer" }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="var(--ios-fill)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circ * shown} ${circ}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span style={{ fontSize: ts(size * 0.2), fontWeight: fw(700), color, fontVariantNumeric: "tabular-nums" }}>{Math.round(shown * 100)}%</span>
          <span style={{ fontSize: ts(12), color: LABEL2 }}>{done}/{total} {s(r.p, "unit")}</span>
        </div>
      </div>
    </WideRoot>
  );
};
