"use client";
// Picture Headline in the Playground: the headline in the screen's font, words rising from behind their
// own baseline in reading order and each bracketed scene opening from a dot into a sticker (a white rim,
// a soft shadow, a small alternating tilt) that lands with crop marks at its corners, then drifts. Press
// a sticker to lift it; tap anywhere else on the headline to replay. A still (thumbnail) shows it
// settled. Mirrors PictureHeadline.swift: the same stagger, picture sizing (0.82 of the line, `width`
// frames wide), tilts and scene formulas, in SVG.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { house } from "../../../core/palette.js";
import { DEFAULT_TEXT, DEFAULT_WIDTH, segments, type Scene } from "../../../definitions/utility/picture-headline.js";
import { b, fillStyle, fw, n, s, ts, useAxis, type Renderer } from "../env.js";
import { useRuntime } from "../runtime.js";

const B = house.blocks;
const INK = house.ink;
const ART = { butter: B.butter, sand: B.sand, sky: B.sky, sage: B.sage, lilac: B.lilac, red: "#FF3B30", deepSky: "#4F85F2", paleSage: "#DBF2E0", deepSage: "#5CA875", night: "#262F5E" };
/** Resting tilts as multiples of the `tilt` property, alternating like stickers placed by hand. */
const TILTS = [-1, 0.75, -0.55, 1, -0.8, 0.6];
const SPRING = "cubic-bezier(0.34, 1.32, 0.64, 1)";
const RISE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = 1.2;
/** 0.82 of the line (line-height 1.2), as the Swift sizes it from the line height; in em. */
const PICTURE = 0.82 * 1.2;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Seconds since mount at up to 30 frames a second, for the drift; 0 when held still. */
function useClock(running: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (now - last > 33) { last = now; setT((now - start) / 1000); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

function edge(w: number, h: number, y: (x: number) => number) {
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += 2) d += ` L${x} ${y(x).toFixed(2)}`;
  return `${d} L${w} ${h} Z`;
}

/** One scene in a `w` x 100 frame at time `t`, as PictureHeadline.swift's `SceneArt` draws it. */
function SceneArt({ scene, w, t }: { scene: Scene; w: number; t: number }): ReactNode {
  const h = 100;
  switch (scene) {
    case "sun": {
      // The red mascot as the sun: it bobs, blinks now and then, and smiles over the sand.
      const r = h * 0.3, horizon = h * 0.76, cx = w * 0.6, cy = h * 0.5 + Math.sin(t * 0.7) * h * 0.05;
      const blink = t % 3.6 < 0.14 ? 0.2 : 1;
      const a0 = (25 * Math.PI) / 180, a1 = (155 * Math.PI) / 180, sr = r * 0.36, sy = cy + r * 0.02;
      return (
        <>
          <rect width={w} height={h} fill={ART.butter} />
          <circle cx={cx} cy={cy} r={r} fill={ART.red} />
          {[-1, 1].map((side) => <ellipse key={side} cx={cx + side * r * 0.34} cy={cy - r * 0.12} rx={r * 0.13} ry={r * 0.2 * blink} fill={INK} />)}
          <path d={`M${cx + Math.cos(a0) * sr} ${sy + Math.sin(a0) * sr} A${sr} ${sr} 0 0 1 ${cx + Math.cos(a1) * sr} ${sy + Math.sin(a1) * sr}`} fill="none" stroke={INK} strokeWidth={r * 0.11} strokeLinecap="round" />
          <rect y={horizon} width={w} height={h - horizon} fill={ART.sand} />
          {[0, 1, 2].map((k) => {
            const gw = w * (0.18 - k * 0.04);
            return <rect key={k} x={((w * (0.15 + k * 0.3) + t * 6) % (w + gw)) - gw} y={horizon + h * (0.07 + k * 0.05)} width={gw} height={h * 0.03} rx={h * 0.015} fill={ART.red} opacity={0.35} />;
          })}
        </>
      );
    }
    case "waves":
      return (
        <>
          <rect width={w} height={h} fill={ART.sky} />
          {([[ART.deepSky, 0.42, 0.9, 1], ["#FFFFFF", 0.62, -1.2, 0.85], [ART.deepSky, 0.8, 1.5, 0.9]] as const).map(([fill, level, speed, opacity], k) => (
            <path key={k} d={edge(w, h, (x) => h * level + Math.sin((x / (w * 0.55)) * Math.PI * 2 + t * speed) * h * 0.07)} fill={fill} opacity={opacity} />
          ))}
        </>
      );
    case "moon": {
      const r = h * 0.32, cx = w * 0.6, cy = h * 0.5 + Math.sin(t * 0.5) * h * 0.04;
      return (
        <>
          <rect width={w} height={h} fill={ART.night} />
          {([[0.12, 0.3, 0], [0.28, 0.72, 1.3], [0.42, 0.2, 2.1], [0.8, 0.78, 0.7], [0.9, 0.3, 2.8], [0.2, 0.52, 3.6]] as const).map(([x, y, phase], k) => {
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
            return <circle key={k} cx={w * x} cy={h * y} r={h * 0.035 * (0.6 + 0.4 * pulse)} fill="#FFFFFF" opacity={0.5 + 0.5 * pulse} />;
          })}
          <circle cx={cx} cy={cy} r={r} fill={ART.butter} />
          <circle cx={cx + r * 0.45} cy={cy - r * 0.25} r={r * 0.9} fill={ART.night} />
        </>
      );
    }
    case "hills":
      return (
        <>
          <rect width={w} height={h} fill={ART.paleSage} />
          <circle cx={w * 0.74} cy={h * 0.3} r={h * 0.16} fill={ART.butter} />
          {([[ART.sage, 0.55, 0.16, 5], [ART.deepSage, 0.74, 0.12, 11]] as const).map(([fill, level, amp, speed], k) => (
            <path key={k} d={edge(w, h, (x) => h * level - (Math.sin(((x + t * speed) / (w * 0.9)) * Math.PI * 2) * 0.5 + 0.5) * h * amp)} fill={fill} />
          ))}
        </>
      );
    case "bloom": {
      const petal = h * 0.3;
      return (
        <>
          <rect width={w} height={h} fill={ART.lilac} />
          <g transform={`translate(${w / 2} ${h / 2}) rotate(${(t * 0.4 * 180) / Math.PI})`}>
            {[0, 1, 2, 3, 4, 5].map((k) => <ellipse key={k} cx={0} cy={-petal * 0.7} rx={petal * 0.32} ry={petal * 0.5} fill="#FFFFFF" opacity={0.92} transform={`rotate(${k * 60})`} />)}
          </g>
          <circle cx={w / 2} cy={h / 2} r={h * 0.12} fill={ART.butter} />
        </>
      );
    }
  }
}

function Cross({ style }: { style: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" style={{ position: "absolute", width: "0.24em", height: "0.24em", overflow: "visible", ...style }}>
      <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * One picture as a sticker: a dot as tall as the frame opens into the rounded frame with a white rim,
 * landing at its tilt on a spring with crop marks flashing at its corners; its scene settles from a
 * slight zoom. Pressed, it straightens and lifts forward. A press doesn't replay the headline.
 */
function Sticker({ scene, width, on, delay, t, animate, reduced, tilt }: { scene: Scene; width: number; on: boolean; delay: number; t: number; animate: boolean; reduced: boolean; tilt: number }) {
  const [pressed, setPressed] = useState(false);
  // Once landed, a press or release answers at once instead of waiting out the reveal's delay.
  const [landed, setLanded] = useState(!animate);
  useEffect(() => {
    if (!animate) return setLanded(true);
    if (!on) return setLanded(false);
    const id = setTimeout(() => setLanded(true), (delay + 0.75) * 1000);
    return () => clearTimeout(id);
  }, [on, delay, animate]);
  const half = `${(PICTURE * (width - 1)) / 2}em`;
  const radius = `${PICTURE * 0.26}em`;
  const open = on || reduced;
  const lift = pressed && !reduced;
  const gap = `-${PICTURE * 0.14 + 0.12}em`;
  return (
    <span
      aria-hidden
      onPointerDown={(e) => { e.stopPropagation(); setPressed(true); }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-block", verticalAlign: "middle", position: "relative", top: "0.03em", width: `${PICTURE * width}em`, height: `${PICTURE}em`, margin: "0 0.06em", zIndex: lift ? 2 : 1, touchAction: "manipulation",
        opacity: on ? 1 : 0,
        transform: `rotate(${open && !lift && !reduced ? tilt : 0}deg) scale(${lift ? 1.18 : 1})`,
        filter: `drop-shadow(0 ${lift ? 0.16 : 0.06}em ${lift ? 0.2 : 0.09}em rgba(0,0,0,${lift ? 0.32 : 0.18}))`,
        transition: on && animate ? `transform ${landed ? ".38s" : ".7s"} ${SPRING} ${landed ? 0 : delay}s, opacity .25s ease-out ${delay}s, filter .38s ease-out` : on ? `opacity .35s ease-out, transform .38s ${SPRING}` : "none",
      }}
    >
      <span
        style={{
          position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius,
          clipPath: open ? `inset(0 0 0 0 round ${radius})` : `inset(0 ${half} 0 ${half} round ${PICTURE / 2}em)`,
          transition: on && animate ? `clip-path .7s ${SPRING} ${delay}s` : "none",
        }}
      >
        <svg viewBox={`0 0 ${100 * width} 100`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: on || !animate ? "none" : "scale(1.3)", transition: on && animate ? `transform .9s ${RISE} ${delay}s` : "none" }}>
          <SceneArt scene={scene} w={100 * width} t={t} />
        </svg>
        <span style={{ position: "absolute", inset: 0, borderRadius: radius, boxShadow: `inset 0 0 0 ${PICTURE * 0.07}em #FFFFFF` }} />
      </span>
      {on && animate ? (
        <span style={{ position: "absolute", inset: 0, opacity: 0, animation: `spph-marks .95s ease-out ${delay + 0.18}s both` }}>
          <Cross style={{ left: gap, top: gap }} />
          <Cross style={{ right: gap, top: gap }} />
          <Cross style={{ left: gap, bottom: gap }} />
          <Cross style={{ right: gap, bottom: gap }} />
        </span>
      ) : null}
    </span>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = Boolean(rt.still);
  const [run, setRun] = useState(0);
  const [on, setOn] = useState(still);
  const drift = b(p, "drift") && !reduced && !still;
  const t = useClock(drift);
  const width = n(p, "width") || DEFAULT_WIDTH;

  // Each replay starts hidden and reveals on the next frame, so the transitions run from the start.
  useEffect(() => {
    if (still) return setOn(true);
    setOn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, [run, still, p.text, width]);

  const items: ({ kind: "word"; text: string } | { kind: "scene"; scene: Scene })[] = [];
  for (const seg of segments(s(p, "text") || DEFAULT_TEXT)) {
    if (seg.kind === "scene") items.push(seg);
    else for (const word of seg.text.split(" ")) items.push({ kind: "word", text: word });
  }
  const animate = !still && !reduced;
  const stagger = items.length > 1 && animate ? Math.max(0, DURATION - 0.6) / (items.length - 1) : 0;
  const label = segments(s(p, "text") || DEFAULT_TEXT).flatMap((seg) => (seg.kind === "text" ? [seg.text] : [])).join(" ");

  const word = (text: string, delay: number, key: number) => {
    const hidden: CSSProperties = reduced ? { opacity: 0 } : { transform: "translateY(105%)" };
    const shown: CSSProperties = { opacity: 1, transform: "none", transition: animate ? `opacity .35s ease-out ${delay}s, transform .62s ${RISE} ${delay}s` : "opacity .35s ease-out" };
    return (
      <span key={key} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingInline: "0.06em", marginInline: "-0.06em" }}>
        <span style={{ display: "inline-block", ...(on ? shown : { ...hidden, transition: "none" }) }}>{text}</span>
      </span>
    );
  };

  const tiltMax = p.tilt === undefined ? 4 : n(p, "tilt");
  const ordinal = (i: number) => items.slice(0, i).filter((x) => x.kind === "scene").length;

  const center = s(p, "alignment") === "center";
  return (
    <div
      {...r.box}
      role="button"
      aria-label={label}
      onClick={() => setRun((k) => k + 1)}
      style={{
        ...r.box.style, ...fillStyle(r.fill, axis), cursor: "pointer", color: "var(--ios-label)",
        fontSize: ts(n(p, "size") || 40), fontWeight: fw(700), lineHeight: 1.2, letterSpacing: "-0.03em", textAlign: center ? "center" : "left", maxWidth: "100%",
      }}
    >
      <style>{"@keyframes spph-marks{0%{opacity:0}25%{opacity:.5}60%{opacity:.5}100%{opacity:0}}"}</style>
      {items.map((item, i) => (
        <span key={i}>
          {item.kind === "word" ? word(item.text, i * stagger, i) : <Sticker key={i} scene={item.scene} width={width} on={on} delay={i * stagger} t={t} animate={animate} reduced={reduced} tilt={tiltMax * TILTS[ordinal(i) % TILTS.length]} />}
          {i < items.length - 1 ? " " : null}
        </span>
      ))}
    </div>
  );
};
