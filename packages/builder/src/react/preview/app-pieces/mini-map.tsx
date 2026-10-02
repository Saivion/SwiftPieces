"use client";
import { useState } from "react";
import { MAP_STYLES } from "../../../definitions/app-pieces/mini-map.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts, ACCENT } from "../env.js";
import { BOUNCE, useDrag } from "../runtime.js";
import { reducedMotion } from "../primitives.js";
import { WideRoot, useHaptic, useWidth } from "./data-kit.js";
import { EASE_OUT } from "./entrance.js";

export const MiniMap: Renderer = (r) => {
  const style = s(r.p, "style") || "ink";
  // The ink map follows the appearance: the day map in light mode, like MiniMap(adaptive:).
  const st = style === "ink" && r.scheme === "light" ? MAP_STYLES.day : MAP_STYLES[style] ?? MAP_STYLES.ink;
  const h = n(r.p, "height") || 150;
  const place = s(r.p, "place").trim();
  const [ref, w] = useWidth();
  const [pan, setPan] = useState({ x: 0, y: 0, live: false });
  const [pulse, setPulse] = useState(0);
  const [down, setDown] = useState(false);
  const haptic = useHaptic();
  const drag = useDrag({
    onMove: ({ dx, dy }) => setPan({ x: dx * 0.6, y: dy * 0.6, live: true }),
    onEnd: () => setPan({ x: 0, y: 0, live: false }),
  });
  const move = { transform: `translate(${pan.x}px, ${pan.y}px)`, transition: pan.live ? "none" : reducedMotion() ? `transform .2s ${EASE_OUT}` : `transform .5s ${BOUNCE}` };
  return (
    <WideRoot r={r} className={`${r.box.className ?? ""} spa-enter`}>
      <div ref={ref} onPointerDown={drag} style={{ position: "relative", height: h, borderRadius: cr(24), overflow: "hidden", background: st.ground, cursor: "grab", touchAction: "none" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, ...move }}>
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <rect x={(i * w) / 5 - 20} y={h * 0.05} width={w / 6} height={h * 0.3} rx={6} fill={st.block} />
              <rect x={(i * w) / 5 - 2} y={h * 0.67} width={w / 6} height={h * 0.3} rx={6} fill={st.block} />
            </g>
          ))}
          <rect x={w * 0.62} y={h * 0.3} width={w * 0.2} height={h * 0.7} rx={8} fill={st.water} />
          <ellipse cx={w * 0.19} cy={h * 0.6} rx={w * 0.11} ry={h * 0.15} fill={st.park} />
          <path d={`M-20,${h * 0.95} Q${w * 0.45},${h * 0.35} ${w + 20},${h * 0.15}`} stroke={st.road} strokeWidth={16} fill="none" />
          <path d={`M${w * 0.55},-10 L${w * 0.5},${h + 10}`} stroke={st.road} strokeWidth={9} fill="none" />
        </svg>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
          <span key={pulse} style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: cr(22), background: "rgba(255,0,0,.3)", animation: pulse ? "spa-ping .8s ease-out both" : undefined }} />
          <span
            role="button"
            aria-label="Your location"
            onPointerDown={(e) => {
              e.stopPropagation();
              setDown(true);
            }}
            onPointerUp={() => setDown(false)}
            onPointerLeave={() => setDown(false)}
            onClick={(e) => {
              setPulse((k) => k + 1);
              haptic("light", e.currentTarget);
            }}
            style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <span style={{ width: 22, height: 22, borderRadius: cr(11), background: ACCENT, boxShadow: "inset 0 0 0 3px #fff, 0 1px 3px rgba(0,0,0,.25)", transform: down ? "scale(.9)" : "none", transition: `transform ${down ? ".1s" : ".2s"} ${EASE_OUT}` }} />
          </span>
          {place ? (
            <span style={{ position: "absolute", left: 16, top: 24, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: ts(15), fontWeight: fw(700), color: st.label, ...move }}>
              <span style={{ width: 20, height: 20, borderRadius: cr(10), background: st.label, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Glyph name="fork.knife" size={12} /></span>
              {place}
            </span>
          ) : null}
        </div>
      </div>
    </WideRoot>
  );
};
