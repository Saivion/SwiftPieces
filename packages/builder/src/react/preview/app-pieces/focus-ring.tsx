"use client";
import { useEffect, useState } from "react";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts, ACCENT, accentize, ACCENT_INK } from "../env.js";
import { useLive } from "../runtime.js";
import { reducedMotion } from "../primitives.js";
import { LABEL, WideRoot, useHaptic } from "./data-kit.js";
import { EASE_OUT, pressBind, pressStyle } from "./entrance.js";

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export const FocusRing: Renderer = (r) => {
  const total = n(r.p, "total") || 900;
  const extra = n(r.p, "extra") || 300;
  const size = n(r.p, "size") || 260;
  const color = accentize(tintHex(s(r.p, "tint"), "signal"));
  const disc = accentize(tintHex(s(r.p, "disc"), "ember"));
  const [remaining, setRemaining] = useLive(n(r.p, "remaining"));
  const [running, setRunning] = useLive(r.p.running !== false);
  const [press, setPress] = useState(false);
  const [plusDown, setPlusDown] = useState(false);
  const haptic = useHaptic();
  // The arc sweeps in from empty on first show (skipped when motion is reduced).
  const [shown, setShown] = useState(reducedMotion);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [running, setRemaining]);

  const stroke = size * 0.12;
  const radius = size / 2 - size * 0.06 - stroke / 2;
  const circ = 2 * Math.PI * radius;
  const frac = Math.min(1, remaining / total);
  const end = (frac * 360 - 90) * (Math.PI / 180);

  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className="spa-enter" style={{ position: "relative", width: size, height: size }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: cr("50%"), background: `color-mix(in srgb, ${color} 10%, transparent)` }} />
        <div style={{ position: "absolute", inset: size * 0.14, borderRadius: cr("50%"), background: `color-mix(in srgb, ${disc} 16%, var(--ios-bg))`, display: "flex", alignItems: "center", justifyContent: "center", color: disc }}>
          <Glyph name={s(r.p, "symbol") || "bag"} size={size * 0.2} strokeWidth={1.6} />
        </div>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", overflow: "visible" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${shown ? circ * frac : 0} ${circ}`} style={{ transition: shown && frac > 0 ? `stroke-dasharray .5s ${EASE_OUT}` : "stroke-dasharray .6s ease-in-out" }} />
        </svg>
        {frac > 0.02 ? (
          <span style={{ position: "absolute", left: size / 2 + radius * Math.cos(end) - 5, top: size / 2 + radius * Math.sin(end) - 5, width: 10, height: 10, borderRadius: cr(5), background: "#fff", transition: "left .6s, top .6s" }} />
        ) : null}
      </div>
      <span style={{ fontWeight: fw(600), fontSize: ts(52), lineHeight: 1, color: LABEL, fontVariantNumeric: "tabular-nums" }}>{mmss(remaining)}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span
          onClick={(e) => {
            setRemaining((t) => Math.min(total, t + extra));
            haptic("increase", e.currentTarget);
          }}
          {...pressBind(setPlusDown)}
          role="button"
          style={{ minWidth: 44, height: 44, display: "grid", placeItems: "center", fontSize: ts(20), color: LABEL, cursor: "pointer", userSelect: "none", ...pressStyle(plusDown), opacity: plusDown ? 0.85 : 1 }}
        >
          +{Math.round(extra / 60)}
        </span>
        <span
          {...pressBind(setPress)}
          role="button"
          onClick={(e) => {
            setRunning((v) => !v);
            haptic("medium", e.currentTarget);
          }}
          style={{ width: 88, height: 48, borderRadius: cr(24), background: ACCENT, color: ACCENT_INK, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...pressStyle(press) }}
        >
          <span key={running ? "p" : "r"} className="spa-enter" style={{ display: "grid" }}><Glyph name={running ? "pause.fill" : "play.fill"} size={20} /></span>
        </span>
      </div>
    </WideRoot>
  );
};
