"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";
import { blocks, font, ground, ink, paper } from "./palette";
import { follow, ms, springValue, t as tr, tiers, type Spring } from "./piece-motion";

/*
 * Picture Headline: the component alone on the dark house ground, in the house semibold (600). Words rise from behind their own
 * baseline in reading order, and each picture opens from a dot into a sticker (a white rim, a soft
 * shadow, a small tilt that alternates along the line): the frame leads, the tilt lands a beat behind
 * it, and on the landing beat crop marks snap in at its corners and the scene eases into its drift, as
 * the Swift piece draws it (the same scene formulas, in SVG; the sun is the red mascot). Partway through
 * each loop the sea sticker is pressed and lifts, then drops back with a little give; press any sticker
 * to lift it yourself. Every 5.5 s the headline fades out and a fresh reveal rises a beat behind it.
 * Sized in container units from iOS points against the 4:3 stage, like the other text previews: 1 point
 * is 0.19cqw.
 */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;

/** The piece's own opening spring (Style.openDuration and openBounce): the dot widens into the frame on it. */
const OPENING: Spring = { duration: 0.7, bounce: 0.28 };
/** When a frame first reaches about its full width on OPENING (0.35 s), Swift's `landing`: the crop marks and the drift start here. */
const LANDING = (() => {
  let s = 0;
  while (s < 3 && springValue(OPENING, s) < 0.97) s += 1 / 120;
  return s;
})();
/** The tilt lands a beat behind the frame and a touch looser. */
const TILT_IN = follow(OPENING, 1);
/** The scene settles from its zoom just after the frame, with no overshoot so its edges never pull in from the rim. */
const ZOOM_IN = follow({ duration: OPENING.duration, bounce: 0 }, 2);
/**
 * The opening's give, as Swift's `Opening` draws it: the frame widens from a dot on OPENING and, past full
 * width, the sticker (picture and rim) swells with it. Its width over its rest width is
 * (1 + (width - 1) * v) / width, never below 1; the height stays put, so it is a horizontal scale.
 */
function swell(width: number): Keyframe[] {
  const steps = 36;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const v = i === steps ? 1 : springValue(OPENING, (i / steps) * (ms(OPENING) / 1000));
    return { transform: `scaleX(${Math.max(1, (1 + (width - 1) * v) / width).toFixed(4)})` };
  });
}
/** How long the crop marks hold before they clear, in ms. */
const MARKS_HOLD = 550;
/** A replay's new headline rises this many seconds behind the old one's fade. */
const REPLAY_BEAT = 0.15;

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

/**
 * Replays the reveal every `every` ms as a fresh run, like Swift's `.id(trigger)`: the run it replaces
 * stays (as `leaving`) for its fade, then unmounts.
 */
function useReplays(every: number) {
  const [runs, setRuns] = useState<{ current: number; leaving: number | null }>({ current: 0, leaving: null });
  useEffect(() => {
    let gone = 0;
    const id = setInterval(() => {
      setRuns((r) => ({ current: r.current + 1, leaving: r.current }));
      clearTimeout(gone);
      gone = window.setTimeout(() => setRuns((r) => ({ ...r, leaving: null })), ms("dismiss") + 100);
    }, every);
    return () => { clearInterval(id); clearTimeout(gone); };
  }, [every]);
  return runs;
}

/** Seconds of drift since landing, eased in over the first 0.8 s so a scene leaves its rest pose gently; 0 until it lands. */
function driftTime(since: number | null, now: number) {
  if (since === null) return 0;
  const s = Math.max(0, now - since), ramp = 0.8;
  return s < ramp ? (s * s) / (2 * ramp) : s - ramp / 2;
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
      // The blink closes each 3.6 s cycle, so the rest pose at time 0 has its eyes open.
      const blink = t % 3.6 > 3.46 ? 0.2 : 1;
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
 * One picture as a sticker: a white-rimmed dot as tall as the frame widens into the full rounded frame on
 * the opening spring, swelling a little past full width before it settles, its tilt landing a beat behind
 * as follow-through and its scene settling from a slight zoom. On the landing beat the crop marks snap
 * in, contracting onto its corners, and the scene eases into its drift from the rest pose. Pressed (or
 * `lifted`), it peels up straight with no overshoot and a deeper shadow, at once even mid-opening; let
 * go, it drops back to its tilt with a little give. `on` only turns on: a replay mounts a fresh copy.
 */
function Picture({ scene, width, on, delay, t, reduced, tilt, lifted }: { scene: Scene; width: number; on: boolean; delay: number; t: number; reduced: boolean; tilt: number; lifted: boolean }) {
  const [pressed, setPressed] = useState(false);
  // Under reduced motion a held sticker shifts its brightness instead of lifting: darker on paper, lighter on the dark ground.
  const [onPaper, setOnPaper] = useState(false);
  // The landing beat, in clock seconds: the drift starts here from the rest pose; until then the scene holds still.
  const [landedAt, setLandedAt] = useState<number | null>(null);
  const [marks, setMarks] = useState(false);
  // Set by the first press: from then on the tilt answers presses, not the opening's delayed follow-through.
  const [peeled, setPeeled] = useState(false);
  const frame = useRef<HTMLSpanElement>(null);
  const clock = useRef(t);
  useEffect(() => { clock.current = t; }, [t]);
  useEffect(() => {
    if (!on) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setLandedAt(clock.current);
      if (reduced) return;
      setMarks(true);
      timers.push(window.setTimeout(() => setMarks(false), MARKS_HOLD));
    }, (delay + LANDING) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [on, delay, reduced]);
  // The swell runs beside the clip-path's opening, started in the same frame so the two stay in step.
  useLayoutEffect(() => {
    if (!on || reduced || !frame.current) return;
    const swelling = frame.current.animate(swell(width), { duration: ms(OPENING), delay: delay * 1000, easing: "linear" });
    return () => swelling.cancel();
  }, [on, delay, reduced, width]);
  // 0.82 of the line (line-height 1.2), as the Swift sizes it from the line height; in em.
  const h = 0.82 * 1.2;
  const half = `${(h * (width - 1)) / 2}em`;
  const radius = `${h * 0.26}em`;
  // The rim (Style.rim 0.07) is the frame's white ground showing round the art, which is clipped inset by
  // it on the same spring, so the ring keeps its width on every side from the dot to the full frame.
  const rim = h * 0.07;
  const inner = `${h * 0.26 - rim}em`;
  const open = on || reduced;
  const held = (pressed || lifted) && on;
  const lift = held && !reduced;
  const gap = `-${h * 0.14 + 0.12}em`;
  useEffect(() => { if (held) setPeeled(true); }, [held]);
  // Until it lands or is first pressed the tilt follows the frame in; after, a press peels it up at once
  // and a release drops it back, as Swift keys the lift on `pressed`.
  const lean = held || peeled || landedAt !== null ? tr(["transform", "filter"], held ? "press" : "release") : `${tr("transform", TILT_IN, (delay + 0.06) * 1000)}, ${tr("filter", "release")}`;
  return (
    <span
      aria-hidden
      data-motion
      onPointerDown={(e) => {
        if (!on) return;
        if (reduced) setOnPaper(getComputedStyle(e.currentTarget).getPropertyValue("--pv-bg").trim().toLowerCase() === paper.bg);
        setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-block", verticalAlign: "middle", position: "relative", top: "0.03em", width: `${h * width}em`, height: `${h}em`, margin: "0 0.06em", zIndex: lift ? 2 : 1,
        color: "currentColor", cursor: "pointer", touchAction: "manipulation",
        opacity: on ? 1 : 0,
        transform: `rotate(${open && !lift && !reduced ? tilt : 0}deg) scale(${lift ? 1.18 : 1})`,
        // Held, the shadow deepens even under reduced motion: it doesn't move.
        filter: `drop-shadow(0 ${held ? 0.16 : 0.06}em ${held ? 0.2 : 0.09}em rgba(0,0,0,${held ? 0.32 : 0.18})) brightness(${held && reduced ? (onPaper ? 0.92 : 1.1) : 1})`,
        transition: on ? `${lean}, ${tr("opacity", tiers.tight, delay * 1000)}` : "none",
      }}
    >
      <span
        ref={frame}
        style={{
          position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius, background: "#fff",
          clipPath: open ? `inset(0 0 0 0 round ${radius})` : `inset(0 ${half} 0 ${half} round ${h / 2}em)`,
          transition: on ? tr("clip-path", OPENING, delay * 1000) : "none",
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            clipPath: open ? `inset(${rim}em ${rim}em ${rim}em ${rim}em round ${inner})` : `inset(${rim}em ${(h * (width - 1)) / 2 + rim}em ${rim}em ${(h * (width - 1)) / 2 + rim}em round ${h / 2 - rim}em)`,
            transition: on ? tr("clip-path", OPENING, delay * 1000) : "none",
          }}
        >
          <svg viewBox={`0 0 ${100 * width} 100`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" style={{ transform: open && on ? "none" : reduced ? "none" : "scale(1.3)", transition: on ? tr("transform", ZOOM_IN, delay * 1000) : "none" }}>
            <SceneArt scene={scene} w={100 * width} t={driftTime(landedAt, t)} />
          </svg>
        </span>
      </span>
      {/* Crop marks, the site's artboard crosses: they snap in contracting onto the corners as it lands, hold, then clear. */}
      {reduced ? null : (
        <span style={{ position: "absolute", inset: 0, color: ground.text, opacity: marks ? 0.45 : 0, transform: marks ? "none" : "scale(1.08)", transition: tr(["transform", "opacity"], marks ? "snap" : "dismiss") }}>
          <Cross style={{ left: gap, top: gap }} />
          <Cross style={{ right: gap, top: gap }} />
          <Cross style={{ left: gap, bottom: gap }} />
          <Cross style={{ right: gap, bottom: gap }} />
        </span>
      )}
    </span>
  );
}

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
      <Picture scene={scene} width={width} on={on} delay={0.15} t={t} reduced={reduced} tilt={tilt} lifted={false} />
    </span>
  );
}

/** Words are read: they rise at the calm reveal's pace without its give, so a word never bobs past its baseline. */
const RISE: Spring = { duration: tiers.calm.duration, bounce: 0 };

/** One word, sliding up from behind its own baseline: calm pace, no give. */
function Word({ text, on, delay, reduced }: { text: string; on: boolean; delay: number; reduced: boolean }) {
  const hidden: CSSProperties = reduced ? { opacity: 0 } : { transform: "translateY(105%)" };
  const shown: CSSProperties = { opacity: 1, transform: "none", transition: tr(["transform", "opacity"], RISE, delay * 1000) };
  return (
    <span className="inline-block overflow-hidden align-bottom" style={{ paddingInline: "0.06em", marginInline: "-0.06em" }}>
      <span data-motion className="inline-block" style={on ? shown : { ...hidden, transition: "none" }}>{text}</span>
    </span>
  );
}

/** Reading order, one slot per word and picture. */
type Item = { kind: "word"; text: string } | { kind: "picture"; scene: Scene; width: number };
const ITEMS = HEADLINE.flatMap<Item>((s) =>
  typeof s === "string" ? s.split(/\s+/).map((text) => ({ kind: "word", text })) : [{ kind: "picture", scene: s.scene, width: s.width ?? 2.4 }],
);
const LABEL = HEADLINE.filter((s): s is string => typeof s === "string").join(" ");
/** How long after mount a run starts its reveal, so its hidden pose has painted first. */
const FLIP = 40;

/**
 * One run of the reveal. A replay mounts a fresh run whose words rise `beat` seconds behind the old
 * run's fade, so the old words are nearly gone before the new ones surface; the leaving run fades out
 * on the dismiss spring and stops taking presses.
 */
function Headline({ beat, leaving, t, reduced }: { beat: number; leaving: boolean; t: number; reduced: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), FLIP);
    return () => clearTimeout(id);
  }, []);
  // The interaction, shown: once the reveal has landed, the sea sticker is pressed for a moment.
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    if (!on || reduced) return setLifted(false);
    const up = setTimeout(() => setLifted(true), 2600);
    const down = setTimeout(() => setLifted(false), 3500);
    return () => { clearTimeout(up); clearTimeout(down); };
  }, [on, reduced]);
  // The stagger is sized to land in about DURATION.
  const stagger = ITEMS.length > 1 && !reduced ? Math.max(0, DURATION - 0.6) / (ITEMS.length - 1) : 0;
  const lead = Math.max(0, beat - FLIP / 1000);
  const ordinal = (i: number) => ITEMS.slice(0, i).filter((x) => x.kind === "picture").length;
  return (
    <p
      aria-label={leaving ? undefined : LABEL}
      aria-hidden={leaving || undefined}
      className="m-0 text-center"
      style={{ gridArea: "1 / 1", width: p(360), fontSize: p(40), fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, opacity: leaving ? 0 : 1, transition: tr("opacity", "dismiss"), pointerEvents: leaving ? "none" : undefined }}
    >
      {ITEMS.map((item, i) => (
        <span key={i}>
          {item.kind === "word" ? (
            <Word text={item.text} on={on} delay={lead + i * stagger} reduced={reduced} />
          ) : (
            <Picture scene={item.scene} width={item.width} on={on} delay={lead + i * stagger} t={t} reduced={reduced} tilt={TILTS[ordinal(i) % TILTS.length]} lifted={lifted && !leaving && item.scene === "waves"} />
          )}
          {i < ITEMS.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

export function PictureHeadlinePreview() {
  const reduced = useReduced();
  const t = useClock(reduced);
  const { current, leaving } = useReplays(5500);
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      {/* One cell, so a replay's leaving and new headlines share a place instead of stacking. */}
      <div className="grid">
        {[leaving, current].map((run) => (run === null ? null : <Headline key={run} beat={run > 0 ? REPLAY_BEAT : 0} leaving={run !== current} t={t} reduced={reduced} />))}
      </div>
    </div>
  );
}
