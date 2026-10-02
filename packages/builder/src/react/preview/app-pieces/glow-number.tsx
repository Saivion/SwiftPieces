"use client";
import { useEffect, useState } from "react";
import { orbFor } from "../../../definitions/app-pieces/glow-number.js";
import { Glyph } from "../../icons.js";
import { n, s, useScheme, type Renderer, cr, ff, fw, ts, ACCENT } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { WideRoot, useHaptic } from "./data-kit.js";
import { useFirstAppearance } from "./first-appearance.js";

// Glow Number (definitions/app-pieces/glow-number.ts): the orb eases in from 0.95 with a fade, the
// figure counts up (0.8 s) as it appears and again on tap, with one light tap haptic.
export const GlowNumber: Renderer = (r) => {
  const value = Math.round(n(r.p, "value"));
  const scheme = useScheme();
  const base = orbFor(s(r.p, "palette"), scheme);
  // The signal halo is the app's accent (Style), deepening to the ground; other orbs keep their own.
  const signal = !["azure", "blush", "sunrise", "lagoon", "meadow", "dusk"].includes(s(r.p, "palette"));
  const ground = scheme === "light" ? "#fff" : "#000";
  const orb = signal ? { ...base, stops: [`color-mix(in srgb, ${ACCENT} ${scheme === "light" ? 5 : 9}%, ${ground})`, `color-mix(in srgb, ${ACCENT} ${scheme === "light" ? 30 : 48}%, ${ground})`, ACCENT] } : base;
  const d = n(r.p, "diameter") || 300;
  const trend = s(r.p, "trend");
  const caption = s(r.p, "caption").trim();
  const [shown, setShown] = useState(value);
  const appeared = useFirstAppearance(r.node.id);
  const [run, setRun] = useState(0);
  const haptic = useHaptic();

  // Counts up on first appearance and on each tap; a remount after that (coming back) holds the figure.
  const [countsOnMount] = useState(!appeared);
  useEffect(() => {
    if (reducedMotion() || (run === 0 && !countsOnMount)) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 800;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(value * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, countsOnMount]);

  const [c0, c1, c2] = orb.stops;
  const reduce = reducedMotion();
  return (
    <WideRoot r={r} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: d + 10 }}>
      <div
        onClick={(e) => {
          haptic("light", e.currentTarget);
          setRun((k) => k + 1);
        }}
        style={{
          position: "relative", width: d, height: d, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", userSelect: "none",
          opacity: appeared ? 1 : 0, transform: appeared || reduce ? "none" : "scale(.95)", transition: "opacity .3s ease-out, transform .3s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: cr("50%"), filter: "blur(18px)", background: `radial-gradient(circle, ${c0} 0%, ${c1} 55%, ${c2} 100%)` }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: orb.ink }}>
          <Glyph name={s(r.p, "symbol") || "figure.walk"} size={34} strokeWidth={2.2} />
          <span style={{ fontSize: ts(Math.round(d * 0.21)), fontWeight: fw(800), lineHeight: 1, letterSpacing: -0.5, fontFamily: ff(s(r.p, "figure") === "rounded" ? 'ui-rounded, "SF Pro Rounded", system-ui' : undefined), fontVariantNumeric: "tabular-nums" }}>
            {shown.toLocaleString("en-US")}
          </span>
          {caption ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ts(20), opacity: 0.8, whiteSpace: "nowrap" }}>
              <span style={{ width: 20, height: 20, borderRadius: cr(10), background: orb.ink, color: c0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Glyph name={trend === "down" ? "arrow.down" : trend === "flat" ? "minus" : "arrow.up"} size={13} strokeWidth={3} />
              </span>
              {caption}
            </span>
          ) : null}
        </div>
      </div>
    </WideRoot>
  );
};
