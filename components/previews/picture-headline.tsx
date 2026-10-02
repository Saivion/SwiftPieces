"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";
import { blocks, font, ground, ink } from "./palette";

/*
 * Picture Headline: the component alone on the dark house ground. Words rise from behind their own
 * baseline in reading order, and each picture opens from a dot into a sticker (a white rim, a soft
 * shadow, a small tilt that alternates along the line) landing on a spring with crop marks flashing at
 * its corners, then drifts, as the Swift piece draws it (the same scene formulas, in SVG; the sun is
 * the red mascot). Partway through each loop the sea sticker is pressed and lifts, then settles; press
 * any sticker to lift it yourself. The reveal replays every 5.5 s. Sized in container units from iOS
 * points against the 4:3 stage, like the other text previews: 1 point is 0.19cqw.
 */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.32, 0.64, 1)";
const rise = "cubic-bezier(0.22, 1, 0.36, 1)";

/** The scene colours the Swift piece's `Art` uses (house blocks plus the deeper tones it adds). */
const art = { ...blocks, red: "#ff3b30", deepSky: "#4f85f2", paleSage: "#dbf2e0", deepSage: "#5ca875", night: "#262f5e" } as const;

export type Scene = "sun" | "waves" | "moon" | "hills" | "bloom";
type Segment = string | { scene: Scene; width?: number };

const HEADLINE: Segment[] = ["Slow", { scene: "sun" }, "mornings, long", { scene: "waves" }, "walks and", { scene: "hills", width: 1.8 }, "early", { scene: "moon" }, "nights."];
const DURATION = 1.2;

function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

/** Replays an on-appear reveal every `ms`: `on` drops to false (instant reset) then rises to true (animated). */
function useReplay(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let up = 0;
    const play = () => { setOn(false); up = window.setTimeout(() => setOn(true), 80); };
    play();
    const t = setInterval(play, ms);
    return () => { clearInterval(t); clearTimeout(up); };
  }, [ms]);
  return on;
}

/** Seconds since mount, at up to 30 frames a second; frozen at 0 under reduced motion, and held while `active` is false. */
function useClock(reduced: boolean, active = true) {
  const [t, setT] = useState(0);
  // Where the clock stopped, so it picks up from there instead of jumping back to 0.
  const held = useRef(0);
  useEffect(() => {
    if (reduced || !active) return;
    let raf = 0, last = 0;
    const start = performance.now() - held.current * 1000;
    const tick = (now: number) => {
      if (now - last > 33) { last = now; held.current = (now - start) / 1000; setT(held.current); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, active]);
  return t;
}

/** A wave or hill edge across `w`, as the Swift scenes trace it. */
function edge(w: number, h: number, y: (x: number) => number) {
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += 2) d += ` L${x} ${y(x).toFixed(2)}`;
  return `${d} L${w} ${h} Z`;
}

/** One scene in a `w` x 100 frame at time `t` (seconds). */
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
          <rect width={w} height={h} fill={art.butter} />
          <circle cx={cx} cy={cy} r={r} fill={art.red} />
          {[-1, 1].map((side) => <ellipse key={side} cx={cx + side * r * 0.34} cy={cy - r * 0.12} rx={r * 0.13} ry={r * 0.2 * blink} fill={ink} />)}
          <path d={`M${cx + Math.cos(a0) * sr} ${sy + Math.sin(a0) * sr} A${sr} ${sr} 0 0 1 ${cx + Math.cos(a1) * sr} ${sy + Math.sin(a1) * sr}`} fill="none" stroke={ink} strokeWidth={r * 0.11} strokeLinecap="round" />
          <rect y={horizon} width={w} height={h - horizon} fill={art.sand} />
          {[0, 1, 2].map((k) => {
            const gw = w * (0.18 - k * 0.04);
            const x = ((w * (0.15 + k * 0.3) + t * 6) % (w + gw)) - gw;
            return <rect key={k} x={x} y={horizon + h * (0.07 + k * 0.05)} width={gw} height={h * 0.03} rx={h * 0.015} fill={art.red} opacity={0.35} />;
          })}
        </>
      );
    }
    case "waves": {
      const bands: [string, number, number, number][] = [[art.deepSky, 0.42, 0.9, 1], ["#fff", 0.62, -1.2, 0.85], [art.deepSky, 0.8, 1.5, 0.9]];
      return (
        <>
          <rect width={w} height={h} fill={art.sky} />
          {bands.map(([fill, level, speed, opacity], k) => (
            <path key={k} d={edge(w, h, (x) => h * level + Math.sin((x / (w * 0.55)) * Math.PI * 2 + t * speed) * h * 0.07)} fill={fill} opacity={opacity} />
          ))}
        </>
      );
    }
    case "moon": {
      const stars: [number, number, number][] = [[0.12, 0.3, 0], [0.28, 0.72, 1.3], [0.42, 0.2, 2.1], [0.8, 0.78, 0.7], [0.9, 0.3, 2.8], [0.2, 0.52, 3.6]];
      const r = h * 0.32, cx = w * 0.6, cy = h * 0.5 + Math.sin(t * 0.5) * h * 0.04;
      return (
        <>
          <rect width={w} height={h} fill={art.night} />
          {stars.map(([x, y, phase], k) => {
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
            return <circle key={k} cx={w * x} cy={h * y} r={h * 0.035 * (0.6 + 0.4 * pulse)} fill="#fff" opacity={0.5 + 0.5 * pulse} />;
          })}
          <circle cx={cx} cy={cy} r={r} fill={art.butter} />
          <circle cx={cx + r * 0.45} cy={cy - r * 0.25} r={r * 0.9} fill={art.night} />
        </>
      );
    }
    case "hills": {
      const layers: [string, number, number, number][] = [[art.sage, 0.55, 0.16, 5], [art.deepSage, 0.74, 0.12, 11]];
      return (
        <>
          <rect width={w} height={h} fill={art.paleSage} />
          <circle cx={w * 0.74} cy={h * 0.3} r={h * 0.16} fill={art.butter} />
          {layers.map(([fill, level, amp, speed], k) => (
            <path key={k} d={edge(w, h, (x) => h * level - (Math.sin(((x + t * speed) / (w * 0.9)) * Math.PI * 2) * 0.5 + 0.5) * h * amp)} fill={fill} />
          ))}
        </>
      );
    }
    case "bloom": {
      const petal = h * 0.3;
      return (
        <>
          <rect width={w} height={h} fill={art.lilac} />
          <g transform={`translate(${w / 2} ${h / 2}) rotate(${(t * 0.4 * 180) / Math.PI})`}>
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <ellipse key={k} cx={0} cy={-petal * 0.7} rx={petal * 0.32} ry={petal * 0.5} fill="#fff" opacity={0.92} transform={`rotate(${k * 60})`} />
            ))}
          </g>
          <circle cx={w / 2} cy={h / 2} r={h * 0.12} fill={art.butter} />
        </>
      );
    }
  }
}

/** Resting tilts in degrees, alternating along the headline like stickers placed by hand (Style.tilt 4). */
const TILTS = [-1, 0.75, -0.55, 1, -0.8, 0.6].map((k) => k * 4);

function Cross({ style }: { style: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" style={{ position: "absolute", width: "0.24em", height: "0.24em", overflow: "visible", ...style }}>
      <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * One picture as a sticker: a dot as tall as the frame opens into the full rounded frame with a white
 * rim, landing at its tilt on a spring with crop marks flashing at its corners; its scene settles from
 * a slight zoom. Pressed (or `lifted`), it straightens and lifts forward with a deeper shadow.
 */
function Picture({ scene, width, on, delay, t, reduced, tilt, lifted }: { scene: Scene; width: number; on: boolean; delay: number; t: number; reduced: boolean; tilt: number; lifted: boolean }) {
  const [pressed, setPressed] = useState(false);
  // Once it has landed, presses and releases answer at once instead of waiting out the reveal's delay.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!on) return setLanded(false);
    const id = setTimeout(() => setLanded(true), (delay + 0.75) * 1000);
    return () => clearTimeout(id);
  }, [on, delay]);
  // 0.82 of the line (line-height 1.2), as the Swift sizes it from the line height; in em.
  const h = 0.82 * 1.2;
  const half = `${(h * (width - 1)) / 2}em`;
  const radius = `${h * 0.26}em`;
  const open = on || reduced;
  const lift = (pressed || lifted) && !reduced;
  const gap = `-${h * 0.14 + 0.12}em`;
  return (
    <span
      aria-hidden
      data-motion
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-block", verticalAlign: "middle", position: "relative", top: "0.03em", width: `${h * width}em`, height: `${h}em`, margin: "0 0.06em", zIndex: lift ? 2 : 1,
        color: "currentColor", cursor: "pointer", touchAction: "manipulation",
        opacity: on ? 1 : 0,
        transform: `rotate(${open && !lift && !reduced ? tilt : 0}deg) scale(${lift ? 1.18 : 1})`,
        filter: `drop-shadow(0 ${lift ? 0.16 : 0.06}em ${lift ? 0.2 : 0.09}em rgba(0,0,0,${lift ? 0.32 : 0.18}))`,
        transition: on ? `transform ${landed ? ".38s" : ".7s"} ${spring} ${landed ? 0 : delay}s, opacity .25s ease-out ${delay}s, filter .38s ease-out` : "none",
      }}
    >
      <span
        style={{
          position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius,
          clipPath: open ? `inset(0 0 0 0 round ${radius})` : `inset(0 ${half} 0 ${half} round ${h / 2}em)`,
          transition: on ? `clip-path .7s ${spring} ${delay}s` : "none",
        }}
      >
        <svg viewBox={`0 0 ${100 * width} 100`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" style={{ transform: open && on ? "none" : reduced ? "none" : "scale(1.3)", transition: on ? `transform .9s ${rise} ${delay}s` : "none" }}>
          <SceneArt scene={scene} w={100 * width} t={t} />
        </svg>
        {/* The sticker rim, over the art. */}
        <span style={{ position: "absolute", inset: 0, borderRadius: radius, boxShadow: `inset 0 0 0 ${h * 0.07}em #fff` }} />
      </span>
      {/* Crop marks, the site's artboard crosses, flashing as it lands. */}
      {on && !reduced ? (
        <span style={{ position: "absolute", inset: 0, opacity: 0, animation: `ph-marks .95s ease-out ${delay + 0.18}s both`, color: ground.text }}>
          <Cross style={{ left: gap, top: gap }} />
          <Cross style={{ right: gap, top: gap }} />
          <Cross style={{ left: gap, bottom: gap }} />
          <Cross style={{ right: gap, bottom: gap }} />
        </span>
      ) : null}
    </span>
  );
}

/** The crop marks' flash as a sticker lands. */
const MARKS = "@keyframes ph-marks{0%{opacity:0}25%{opacity:.5}60%{opacity:.5}100%{opacity:0}}";

/**
 * One sticker on its own, as the landing shows the mascot: the living scene in its rimmed, tilted
 * frame, opening from a dot with its crop marks the first time it comes into view and drifting only
 * while it is on screen. It is drawn against a `size` px font, so it matches a headline set at that
 * size (the frame is 0.98 of it tall). Press it to lift it, as in the headline.
 */
export function PictureSticker({ scene, size, width = 2.4, tilt = 0 }: { scene: Scene; size: number; width?: number; tilt?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "20% 0px 20% 0px" });
  const reduced = useReduced();
  const t = useClock(reduced, inView);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!inView || on) return;
    const id = setTimeout(() => setOn(true), 80);
    return () => clearTimeout(id);
  }, [inView, on]);
  return (
    <span ref={ref} className="inline-block" style={{ fontSize: size, lineHeight: 1.2, color: ground.text }}>
      <style>{MARKS}</style>
      <Picture scene={scene} width={width} on={on} delay={0.15} t={t} reduced={reduced} tilt={tilt} lifted={false} />
    </span>
  );
}

/** One word, sliding up from behind its own baseline. */
function Word({ text, on, delay, reduced }: { text: string; on: boolean; delay: number; reduced: boolean }) {
  const hidden: CSSProperties = reduced ? { opacity: 0 } : { transform: "translateY(105%)" };
  const shown: CSSProperties = { opacity: 1, transform: "none", transition: `opacity .35s ease-out ${delay}s, transform .62s ${rise} ${delay}s` };
  return (
    <span className="inline-block overflow-hidden align-bottom" style={{ paddingInline: "0.06em", marginInline: "-0.06em" }}>
      <span data-motion className="inline-block" style={on ? shown : { ...hidden, transition: "none" }}>{text}</span>
    </span>
  );
}

export function PictureHeadlinePreview() {
  const reduced = useReduced();
  const on = useReplay(5500);
  const t = useClock(reduced);
  // The interaction, shown: once the reveal has landed, the sea sticker is pressed for a moment.
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    if (!on || reduced) return setLifted(false);
    const up = setTimeout(() => setLifted(true), 2600);
    const down = setTimeout(() => setLifted(false), 3500);
    return () => { clearTimeout(up); clearTimeout(down); };
  }, [on, reduced]);
  // Reading order, one slot per word and picture, with the stagger sized to land in about DURATION.
  const items: ({ kind: "word"; text: string } | { kind: "picture"; scene: Scene; width: number })[] = [];
  for (const s of HEADLINE) {
    if (typeof s === "string") for (const w of s.split(/\s+/)) items.push({ kind: "word", text: w });
    else items.push({ kind: "picture", scene: s.scene, width: s.width ?? 2.4 });
  }
  const stagger = items.length > 1 && !reduced ? Math.max(0, DURATION - 0.6) / (items.length - 1) : 0;
  const label = HEADLINE.filter((s): s is string => typeof s === "string").join(" ");
  const ordinal = (i: number) => items.slice(0, i).filter((x) => x.kind === "picture").length;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      <style>{MARKS}</style>
      <p aria-label={label} className="m-0 text-center" style={{ width: p(360), fontSize: p(40), fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
        {items.map((item, i) => (
          <span key={i}>
            {item.kind === "word" ? (
              <Word text={item.text} on={on} delay={i * stagger} reduced={reduced} />
            ) : (
              <Picture scene={item.scene} width={item.width} on={on} delay={i * stagger} t={t} reduced={reduced} tilt={TILTS[ordinal(i) % TILTS.length]} lifted={lifted && item.scene === "waves"} />
            )}
            {i < items.length - 1 ? " " : null}
          </span>
        ))}
      </p>
    </div>
  );
}
