"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, radius, signal } from "./palette";
import { cascade, curve, follow, ms, pop, pressScale, reduced, roles, rubberBand, settleTime, shake, springValue, t, type Role } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Feedback previews. Each one shows the component and nothing else (FREE-V2.1): no cards, no
 * headings, no fake screens. The component rests first, then loops its signature interaction.
 * Sizes are designed against the 560 px docs stage and scale with the size container (`u`).
 * Motion follows PieceMotion through piece-motion.ts: every settle is a named role. The chrome is liquid glass through
 * piece-liquid.tsx, as the Swift pieces draw it: each group's state lives above its `LiquidGroup`, and text is 600.
 */

const u = (n: number) => `${(n / 5.6).toFixed(3)}cqw`;
/** Swift's CubicKeyframe: an ease in and out between two keyframes. */
const SWAY = "cubic-bezier(0.33, 0, 0.67, 1)";

const KEYFRAMES = `
@keyframes fb-ring{from{transform:scale(.7);opacity:1}to{transform:scale(1.8);opacity:0}}
@keyframes fb-thin{from{stroke-width:2.5;r:14.75px}to{stroke-width:.5;r:15.75px}}
@keyframes fb-spin{to{transform:rotate(360deg)}}
@keyframes fb-pass{0%{transform:translateX(var(--from));animation-timing-function:${SWAY}}75%,100%{transform:translateX(var(--to))}}
@keyframes fb-pulse{from{transform:scale(1);opacity:1}to{transform:scale(1.45);opacity:0}}
@keyframes fb-in{from{opacity:0}}
@keyframes fb-out{to{opacity:0}}
`;

/** The house ground, with the component centred on it and nothing else. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{KEYFRAMES}</style>
      {children}
    </div>
  );
}

/** Walks through `durations`, returning the current step; loops forever and clears its timer. */
function useSteps(durations: number[]) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setI((v) => (v + 1) % durations.length), durations[i]);
    return () => clearTimeout(timer);
  }, [i, durations]);
  return i;
}

/** `reduced()` once mounted: false on the server and the first client render, so hydration always matches. */
function useReduced() {
  const [still, setStill] = useState(false);
  useEffect(() => setStill(reduced()), []);
  return still;
}

const display = (size: number): CSSProperties => ({ fontSize: u(size), fontWeight: font.displayWeight, letterSpacing: "-0.03em", lineHeight: 1.12 });

const shapes = new Map<string, string>();
/**
 * A role's spring as an easing with its progress passed through `map`, for the Swift shapes that read a spring's
 * level rather than its raw value: a stroke that never draws past its end, or a flood whose centre shuts early so
 * the spring's tail never leaves a speck. Browsers without `linear()` get the role's own curve.
 */
function shaped(role: Role, name: string, map: (v: number) => number): string {
  const key = `${role}:${name}`;
  const hit = shapes.get(key);
  if (hit) return hit;
  let easing = curve(role).easing;
  if (typeof CSS !== "undefined" && CSS.supports("transition-timing-function", "linear(0, 1)")) {
    const s = roles[role], total = settleTime(s), steps = 64;
    const points = Array.from({ length: steps + 1 }, (_, i) =>
      i === 0 ? "0" : i === steps ? "1" : `${map(springValue(s, (i / steps) * total)).toFixed(4)} ${((i / steps) * 100).toFixed(2)}%`);
    easing = `linear(${points.join(", ")})`;
  }
  shapes.set(key, easing);
  return easing;
}
const clamp1 = (v: number) => Math.min(v, 1);
/** A block filling inward whose centre is shut at `at` of the way, and the same block draining back out. */
const floodIn = (at: number) => (v: number) => Math.min(v / at, 1);
const floodOut = (at: number) => (v: number) => Math.max((v - (1 - at)) / at, 0);
/** A `transition` for one property on a shaped spring. */
const tShaped = (prop: string, role: Role, name: string, map: (v: number) => number, delayMs = 0) =>
  `${prop} ${ms(role)}ms ${shaped(role, name, map)}${delayMs ? ` ${delayMs}ms` : ""}`;

/** Splits a path of straight strokes into its subpaths, with where each starts and ends along the whole. */
function subpaths(d: string): { d: string; from: number; to: number }[] {
  const parts = d.match(/M[^M]*/g) ?? [];
  const lengths = parts.map((part) => {
    const pts = [...part.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (part.includes("Z")) pts.push(pts[0]);
    return pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  });
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return parts.map((part, i) => {
    const from = at / total;
    at += lengths[i];
    return { d: part, from, to: at / total };
  });
}

/**
 * An ink mark drawn along its strokes in order, as Swift strokes one trimmed path: CSS dashing restarts on every
 * subpath, so each stroke gets its share of one spring. It draws on `role` after `delay` and un-draws in reverse on
 * `undo` (instantly when null). Never past its end: the spring's overshoot is clamped.
 */
function Strokes({ d, on, color, width, role = "morph", delay = 0, undo = "dismiss" }: { d: string; on: boolean; color: string; width: number; role?: Role; delay?: number; undo?: Role | null }) {
  return (
    <>
      {subpaths(d).map((s, i) => {
        const seg = (p: number) => Math.min(Math.max((p - s.from) / (s.to - s.from), 0), 1), span = `${s.from.toFixed(3)}-${s.to.toFixed(3)}`;
        const transition = on ? tShaped("stroke-dashoffset", role, `draw${span}`, seg, delay) : undo ? tShaped("stroke-dashoffset", undo, `undraw${span}`, (v) => 1 - seg(1 - v)) : "none";
        // Dash 1, gap 2: hidden at 1.02, so no round cap is left at the start.
        return <path key={i} data-motion d={s.d} pathLength={1} stroke={color} strokeWidth={width} style={{ strokeDasharray: "1 2", strokeDashoffset: on ? 0 : 1.02, transition }} />;
      })}
    </>
  );
}

// MARK: - Reaction Toggle

const HEART = "M12 20.5s-7.6-4.6-9.4-9C1.2 7.8 3.4 4 7.2 4c2.1 0 3.7 1.1 4.8 2.7C13.1 5.1 14.7 4 16.8 4c3.8 0 6 3.8 4.6 7.5-1.8 4.4-9.4 9-9.4 9z";
const BOOKMARK = "M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.6l-6.5 3.9V5A1.5 1.5 0 0 1 7 3.5z";
const STAR = "M12 2.8l2.8 5.8 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z";
/** The beat between the lead (flood and symbol, on the tap) and what follows: two beats on, the glass takes the tint and
    the pill buds. A bare symbol's halo ripples one beat on. */
const BEAT = 70;

function Glyph24({ d, filled, color, size }: { d: string; filled: boolean; color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), display: "block" }} fill={filled ? color : "none"} stroke={color} strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Soft rubber (Swift `Squish`): flattens wide as the tap lands, springs up tall and narrow, wobbles to rest with a small tilt. */
function squash(el: HTMLElement | null): Animation[] {
  if (!el || reduced()) return [];
  const { easing, ms: settle } = curve("success"), scaleMs = 220 + settle, tiltMs = 140 + settle;
  return [
    el.animate([
      { scale: "1 1", easing: SWAY },
      { scale: "1.08 0.84", offset: 80 / scaleMs, easing: curve("press").easing },
      { scale: "0.94 1.12", offset: 220 / scaleMs, easing },
      { scale: "1 1" },
    ], { duration: scaleMs }),
    el.animate([{ rotate: "0deg", easing: SWAY }, { rotate: "-12deg", offset: 140 / tiltMs, easing }, { rotate: "0deg" }], { duration: tiltMs }),
  ];
}

/** Runs the squash on the returned element each time `burst` counts up, and stops it on unmount. */
function useSquash(burst: number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!burst) return;
    const running = squash(ref.current);
    return () => running.forEach((a) => a.cancel());
  }, [burst]);
  return ref;
}

/** The pill's height in points: footnote text on a capsule. */
const PILL_H = 30;

/**
 * A liquid glass capsule. The tint floods out of the symbol to the rim, the glass takes it as its own two beats on, the
 * symbol blurs to its filled form and squashes, and the count rolls. With `pill`, a glass pill buds out of the top of
 * the capsule once the glass has the tint, rests joined to it by a neck, and melts back in 1.3s after the tap.
 */
function Reaction({ on, pressed, d, fill, count, pill, k }: { on: boolean; pressed: boolean; d: string; fill: string; count?: number; pill?: string; k: number }) {
  const [burst, setBurst] = useState(0);
  const [tinted, setTinted] = useState(false);
  // The pill exists only from its bloom until it has melted home, as `PieceBuds` keeps it.
  const [pillPresent, setPillPresent] = useState(false);
  const [pillOut, setPillOut] = useState(false);
  const [pillW, setPillW] = useState(78);
  const pillText = useRef<HTMLSpanElement>(null);
  const symbol = useSquash(burst);
  const gather = useRef(0);
  useEffect(() => {
    const home = () => { setPillOut(false); clearTimeout(gather.current); gather.current = window.setTimeout(() => setPillPresent(false), ms(liquid.home) + 20); };
    if (!on) { setTinted(false); home(); return; }
    setBurst((b) => b + 1);
    const timers = [window.setTimeout(() => setTinted(true), 2 * BEAT)];
    if (pill) {
      timers.push(
        window.setTimeout(() => { clearTimeout(gather.current); setPillPresent(true); }, 2 * BEAT),
        window.setTimeout(() => setPillOut(true), 2 * BEAT + 24),
        window.setTimeout(home, 1300),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [on, pill]);
  useEffect(() => () => clearTimeout(gather.current), []);
  // The pill's own width in points, so it can be born round and widen to its words as it leaves.
  useLayoutEffect(() => {
    const el = pillText.current;
    const box = el?.closest<HTMLElement>("[data-pill]");
    if (el && box?.offsetHeight) setPillW((el.offsetWidth / box.offsetHeight) * PILL_H);
  }, [pillPresent]);
  const H = 48 * k, box = 31 * k, lead = (H - box) / 2 + 2 * k, color = on ? ink : ground.text;
  // Sinks about 2.5 pt per edge (sized from the Swift capsule, in points) and springs back; centred, as it sits in feeds.
  const sink = pressScale(count === undefined ? 48 : 100, 48);
  // The flood's full radius is Swift's `hypot(width, height) * 1.05` of this capsule (about 100k wide with a count),
  // so it spreads across the capsule at Swift's pace rather than finishing early.
  const reach = 1.05 * Math.hypot(count === undefined ? 2 * lead + box : 100 * k, H);
  // The glyph swaps as the tint reaches it: the outline blurs out as the filled form sharpens in.
  const swapIn = `${t(["transform", "filter"], "morph", 120)}, ${t("opacity", "dismiss", 120)}`, swapOut = t(["transform", "opacity", "filter"], "dismiss");
  const glyph = (shown: boolean): CSSProperties => ({ transform: `scale(${shown ? 1 : 0.7})`, opacity: shown ? 1 : 0, filter: `blur(${shown ? 0 : u(4 * k)})` });
  // Home is the pill centred inside the capsule, shrunk, where the two are one shape.
  const home = (48 - PILL_H) / 2;
  return (
    <LiquidGroup unit={u(k)} axis="y">
      <div className="relative">
        {pill && pillPresent && (
          // Before the capsule, so the pill at home sits under it and melts into it, never over the symbol. It is born
          // round, inside the capsule, and widens to its words as it springs out.
          <span className="pointer-events-none absolute left-1/2 top-0 flex justify-center" style={{ width: 0 }}>
            <Liquid bud={{ out: pillOut, rest: [0, -(PILL_H + liquid.joined)], home: [0, home] }} className="flex">
              <span data-motion data-pill className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{ width: u((pillOut ? pillW : PILL_H) * k), height: u(PILL_H * k), fontSize: u(13 * k), fontWeight: 600, color: ground.text, transition: t("width", pillOut ? liquid.split : liquid.home) }}>
                <BudContent out={pillOut}>
                  <span ref={pillText} className="flex items-center" style={{ gap: u(5 * k), paddingInline: u(12 * k) }}>
                    <svg viewBox="0 0 24 24" style={{ width: u(11 * k), height: u(11 * k) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {pill}
                  </span>
                </BudContent>
              </span>
            </Liquid>
          </span>
        )}
        <div data-motion className="relative" style={{ transform: `scale(${pressed ? sink : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
          <Liquid tint={tinted ? fill : undefined} className="relative flex items-center overflow-hidden" style={{ height: u(H), paddingLeft: u(lead), paddingRight: u(count === undefined ? lead : H * 0.42), gap: u(7 * k) }}>
            {/* The lead: spreads from the symbol without overshoot. Like Swift's `Flood` it is gone with 6% of the drain
                left, so the spring's tail never leaves a speck inside the outline glyph. Once the glass has the tint it
                steps aside; turning off, it is back at full size and drains into the symbol over clear glass. */}
            <span data-motion className="absolute rounded-full" style={{ width: u(2 * reach), height: u(2 * reach), left: u(lead + box / 2 - reach), top: `calc(50% - ${u(reach)})`, background: fill, transform: `scale(${on ? 1 : 0})`, opacity: on && tinted ? 0 : 1, transition: on ? `${tShaped("transform", "morph", "out94", floodOut(0.94))}, ${t("opacity", "dismiss")}` : tShaped("transform", "dismiss", "in94", floodIn(0.94)) }} />
            <span ref={symbol} data-motion className="relative grid place-items-center" style={{ width: u(box), height: u(box) }}>
              <span data-motion className="absolute" style={{ ...glyph(!on), transition: on ? swapOut : swapIn }}><Glyph24 d={d} filled={false} color={color} size={24 * k} /></span>
              <span data-motion className="absolute" style={{ ...glyph(on), transition: on ? swapIn : swapOut }}><Glyph24 d={d} filled color={ink} size={24 * k} /></span>
            </span>
            {count !== undefined && (
              // Data: the count rolls with the toggle, never a beat behind, and never past its number.
              <span className="relative overflow-hidden tabular-nums" style={{ height: u(20 * k), lineHeight: u(20 * k), fontSize: u(17 * k), fontWeight: 600, fontFamily: font.rounded, color, transition: t("color", "value") }}>
                <span data-motion className="block" style={{ transform: `translateY(${on ? `-${u(20 * k)}` : 0})`, transition: t("transform", "value") }}>
                  <span className="block">{count}</span>
                  <span className="block">{count + 1}</span>
                </span>
              </span>
            )}
          </Liquid>
        </div>
      </div>
    </LiquidGroup>
  );
}

/** Bare variant: a butter star that sits under an ink outline, like a sticker. No glass to flood, so it keeps its halo. */
function Sticker({ on, pressed, k }: { on: boolean; pressed: boolean; k: number }) {
  const [burst, setBurst] = useState(0);
  const symbol = useSquash(burst);
  useEffect(() => { if (on) setBurst((b) => b + 1); }, [on]);
  return (
    <div data-motion className="relative grid place-items-center" style={{ width: u(48 * k), height: u(48 * k), transform: `scale(${pressed ? pressScale(48, 48) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
      {/* The ring grows 0.7 to 1.8 times the symbol and thins as it goes (Swift `Ripple`: line (2.5 - 2p) times scale). */}
      {burst > 0 && on && (
        <svg key={burst} data-motion viewBox="0 0 32 32" className="absolute" style={{ left: u(8 * k), top: u(8 * k), width: u(32 * k), height: u(32 * k), overflow: "visible", opacity: 0, animation: `fb-ring ${ms("reveal")}ms ${curve("reveal").easing} ${BEAT}ms forwards` }} aria-hidden>
          <circle data-motion cx={16} cy={16} r={15} fill="none" stroke={blocks.butter} style={{ strokeWidth: 2.5, animation: `fb-thin ${ms("reveal")}ms ${curve("reveal").easing} ${BEAT}ms both` }} />
        </svg>
      )}
      <span ref={symbol} data-motion className="relative grid place-items-center" style={{ width: u(31 * k), height: u(31 * k) }}>
        <span data-motion className="absolute" style={{ transform: `scale(${on ? 1 : 0})`, opacity: on ? 1 : 0, transition: t(["transform", "opacity"], on ? "morph" : "dismiss") }}><Glyph24 d={STAR} filled color={blocks.butter} size={24 * k} /></span>
        <span className="absolute"><Glyph24 d={STAR} filled={false} color={ground.text} size={24 * k} /></span>
      </span>
    </div>
  );
}

// Rest, like, save (pill), star, rest again, then everything off.
const REACT_STEPS = [1400, 130, 1100, 130, 1500, 130, 1700, 130, 900];
export function ReactionTogglePreview() {
  const i = useSteps(REACT_STEPS);
  const liked = i >= 2 && i < 8, saved = i >= 4 && i < 8, starred = i >= 6 && i < 8;
  const press = i === 1 ? "like" : i === 3 ? "save" : i === 5 ? "star" : i === 7 ? "all" : null;
  const k = 1.85;
  return (
    <Stage>
      <div className="flex items-center" style={{ gap: u(26) }}>
        <Reaction k={k} on={liked} pressed={press === "like" || press === "all"} d={HEART} fill={blocks.tangerine} count={128} />
        <Reaction k={k} on={saved} pressed={press === "save" || press === "all"} d={BOOKMARK} fill={blocks.sky} pill="Saved" />
        <Sticker k={k} on={starred} pressed={press === "star" || press === "all"} />
      </div>
    </Stage>
  );
}

// MARK: - Rating Scrub

/** The Swift `SoftStar`: five points with rounded tips and valleys, in a 24 box. */
const SOFT_STAR = (() => {
  const cx = 12, cy = 12.96, outer = 12.48, inner = 6.24;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  let d = "";
  pts.forEach((c, i) => {
    const prev = pts[(i + 9) % 10], next = pts[(i + 1) % 10], t = i % 2 ? 0.08 : 0.26;
    const a = lerp(c, prev, t), b = lerp(c, next, t);
    d += `${i ? "L" : "M"}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${c[0].toFixed(2)} ${c[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${d}Z`;
})();

const LEVELS = [blocks.tangerine, blocks.sand, blocks.butter, blocks.sage, blocks.sky];
const LABELS = ["Poor", "Fair", "Good", "Very good", "Great"];
/** The empty star: the track token, so it reads on both stage themes. */
const EMPTY = ground.trough;
const levelFor = (v: number) => (v > 0 ? LEVELS[Math.ceil(v) - 1] : LEVELS[4]);
/** How much of the lift each star gets by its distance from the finger, so the row gives like soft keys. */
const FALLOFF = [1, 0.27, 0.1];

/**
 * The row. Under the finger the star rises on the press spring and its neighbours follow by distance; let go and the
 * star the finger left drops first and each neighbour 30ms after it. The fill is the value: it lands with no delay
 * or overshoot. `band` draws the end star past its end of the row. Under reduced motion nothing rises: the held star
 * shifts a shade toward the stage's text instead (lighter on dark, darker on paper), as Swift's brightness does.
 */
function Stars({ value, size, active = null, band = 0, still = false }: { value: number; size: number; active?: number | null; band?: number; still?: boolean }) {
  const cell = size * 1.2, gap = size * 0.16, color = levelFor(value), last = useRef(0);
  const scrubbing = active !== null;
  if (scrubbing) last.current = active;
  const pace: Role = scrubbing ? "press" : "value";
  return (
    <div className="flex" style={{ gap: u(gap) }}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(Math.max(value - i, 0), 1), d = Math.abs(i - last.current);
        const rise = scrubbing && !still && d < FALLOFF.length ? FALLOFF[d] : 0;
        const shade = (c: string) => (scrubbing && still && i === active ? `color-mix(in srgb, ${c} 86%, ${ground.text})` : c);
        const lift = scrubbing ? t("transform", d === 0 ? "press" : follow("release", d)) : t("transform", follow("release", d), cascade(d));
        const pulled = (i === 4 && band > 0) || (i === 0 && band < 0);
        return (
          <span key={i} data-motion className="block" style={{ transform: `translateX(${pulled ? u(band) : "0px"})`, transition: t("transform", scrubbing ? "press" : "settle") }}>
            <span data-motion className="relative grid place-items-center" style={{ width: u(cell), height: u(cell), transform: rise ? `translateY(-${u(size * 0.28 * rise)}) scale(${1 + 0.3 * rise})` : "none", transition: lift }}>
              <svg viewBox="0 0 24 24" className="absolute" style={{ width: u(size), height: u(size) }} aria-hidden><path d={SOFT_STAR} style={{ fill: shade(EMPTY), transition: t("fill", pace) }} /></svg>
              <svg viewBox="0 0 24 24" className="absolute" style={{ width: u(size), height: u(size), clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)`, transition: t("clip-path", pace) }} aria-hidden><path d={SOFT_STAR} style={{ fill: shade(color), transition: t("fill", pace) }} /></svg>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** The whole-number digit, rolling like Swift's numeric text: up as it grows, down as it falls, never past the value. */
function Digit({ value, pace }: { value: number; pace: Role }) {
  return (
    <span className="inline-grid">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-motion style={{ gridArea: "1 / 1", opacity: n === value ? 1 : 0, filter: n === value ? "blur(0)" : "blur(0.06em)", transform: `translateY(${n === value ? 0 : n < value ? "-0.45em" : "0.45em"})`, transition: t(["opacity", "filter", "transform"], pace) }}>{n}</span>
      ))}
    </span>
  );
}

/**
 * Measures, in points of `unit`, how wide each of `texts` sets in `style`, so a glass shape can ease to its word's width
 * as the word morphs (CSS cannot transition to `auto`). Measured outside any `LiquidGroup`, once fonts are ready and
 * again whenever the stage resizes.
 */
function useWidths(texts: string[], style: CSSProperties, unit: string) {
  const box = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>(() => texts.map((text) => text.length * 9));
  const key = texts.join("|");
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    let live = true;
    const read = () => {
      const kids = [...el.children] as HTMLElement[], point = kids[0].offsetWidth / 100;
      if (live && point > 0) setWidths(kids.slice(1).map((k) => k.offsetWidth / point));
    };
    read();
    document.fonts?.ready.then(read);
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => { live = false; ro.disconnect(); };
  }, [key]);
  const sizer = (
    <div ref={box} aria-hidden className="pointer-events-none absolute left-0 top-0 flex" style={{ visibility: "hidden", whiteSpace: "pre" }}>
      <span style={{ width: `calc(${unit} * 100)`, flexShrink: 0 }} />
      {texts.map((text) => <span key={text} style={{ ...style, flexShrink: 0 }}>{text}</span>)}
    </div>
  );
  return [widths, sizer] as const;
}

/** [rating, finger down, hold ms, pull past the end]: rest, scrub up to five and pull past the end, settle back on four, tap two, tap four. */
const SCRUB: [number, boolean, number, number?][] = [[4, false, 1600], [1, true, 260], [2, true, 200], [3, true, 200], [4, true, 200], [5, true, 260], [5, true, 420, 30], [5, false, 1500], [4, true, 110], [4, false, 1600], [2, true, 110], [2, false, 1600], [4, true, 110], [4, false, 700]];
const SCRUB_MS = SCRUB.map((s) => s[2]);
/** The Swift Example's star size, in points; the stage draws it at `STAR_PX` px. */
const STAR_PT = 46, STAR_PX = 62;

/**
 * The rating as the Swift piece draws it. While a finger scrubs, a glass readout tinted with the score buds up out of
 * the touched star: born behind it as a small round bubble, it rises above the lifted star while it widens to its
 * words, rides from star to star on the press spring, and narrows and sinks back into the star the finger leaves. A tap
 * lets go before it would bloom (120ms), so it stays quiet. Under the stars, a glass numeral pill is joined to a chip
 * tinted with the score whose word morphs letter by letter.
 */
export function RatingScrubPreview() {
  const i = useSteps(SCRUB_MS);
  const still = useReduced();
  const [rating, down, , pull = 0] = SCRUB[i];
  const size = STAR_PX, cell = size * 1.2, gap = size * 0.16, width = 5 * cell + 4 * gap;
  const f = size / 38;
  // Liquid lengths are in the piece's points: one point is `size / STAR_PT` stage px.
  const k = size / STAR_PT, P = (pt: number) => u(pt * k);
  const pillH = Math.max(32, STAR_PT * 0.9), pad = pillH * 0.42;
  const wordFont: CSSProperties = { fontSize: P(Math.max(13, STAR_PT * 0.36)), fontWeight: 600 };
  const figureFont: CSSProperties = { fontSize: P(Math.max(13, STAR_PT * 0.4)), fontWeight: 600, fontFamily: font.rounded };
  const [words, sizer] = useWidths([...LABELS, "Tap or slide"], wordFont, u(k));
  const [figure, figureSizer] = useWidths(["4"], figureFont, u(k));
  const label = rating > 0 ? LABELS[Math.ceil(rating) - 1] : null;
  const level = levelFor(rating);
  // Past the end the star gives a few points with rubber-band resistance: about the gap between two stars (Swift 6 pt at 30).
  // The pull is scripted short enough that the finger stays on the stage; reduced motion keeps the star in place.
  const band = down && pull && !still ? rubberBand(pull, size * 0.2) : 0;
  const finger = pull ? width + pull : (Math.ceil(rating) - 1) * (cell + gap) + cell / 2;
  const pace: Role = down ? "press" : "value";
  // The readout blooms only once a finger has stayed down 120ms, and rides over the last star it touched.
  const [out, setOut] = useState(false);
  const [star, setStar] = useState(3);
  // Once it is out, it widens to each new word on the press spring, keeping pace with the finger.
  const [riding, setRiding] = useState(false);
  useEffect(() => {
    if (!down) { setOut(false); return; }
    setStar(Math.max(Math.ceil(rating) - 1, 0));
    const timer = window.setTimeout(() => setOut(true), 120);
    return () => clearTimeout(timer);
  }, [down, rating]);
  useEffect(() => {
    if (!out) { setRiding(false); return; }
    const timer = window.setTimeout(() => setRiding(true), ms(liquid.split) / 2);
    return () => clearTimeout(timer);
  }, [out]);
  const index = Math.max(Math.ceil(rating) - 1, 0);
  const readoutW = pad * 2 + figure[0] + 6 + (label ? words[LABELS.indexOf(label)] : 0);
  const chipW = pad * 2 + (label ? words[LABELS.indexOf(label)] : words[LABELS.length]);
  // Clear of the lifted star (Swift 0.9 x size; 0.48 under Reduce Motion, where nothing lifts), a neck's width above it.
  const rest = -((still ? 0.48 : 0.9) * STAR_PT + liquid.joined + pillH / 2);
  const above = -rest + pillH; // points above the row the readout's group must reach
  const rowH = cell / k; // the row's height in points
  return (
    <Stage>
      {sizer}
      {figureSizer}
      <div className="relative" style={{ width: u(width) }}>
        {/* Behind the stars, so the readout at home sits under the touched star and rises out from behind it. */}
        <LiquidGroup unit={u(k)} axis="y" style={{ position: "absolute", left: 0, right: 0, top: P(-above), height: P(above + rowH) }}>
          <span data-motion className="absolute left-0 flex items-center justify-center" style={{ top: P(above + rowH / 2), width: 0, height: 0, transform: `translateX(${u(star * (cell + gap) + cell / 2)})`, transition: t("transform", "press") }}>
            {/* Home is behind a star, with no glass to melt into, so it thins away on its way there and is gone by the
                time it lands, as Swift removes it; it shows again the moment it buds. */}
            <Liquid tint={out ? level : undefined} bud={{ out, rest: [0, rest], home: [0, 0] }} className="flex shrink-0" style={{ opacity: out ? 1 : 0, transition: out ? "opacity 0ms" : `opacity ${Math.round(ms(liquid.home) * 0.6)}ms ease-in` }}>
              <span data-motion className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{ width: P(out || still ? readoutW : pillH), height: P(pillH), color: ink, transition: t("width", out ? (riding ? "press" : liquid.split) : liquid.home) }}>
                <BudContent out={out}>
                  <span className="flex items-baseline" style={{ gap: P(6) }}>
                    <span className="tabular-nums" style={figureFont}>{rating}</span>
                    {label && <MorphText text={label} style={wordFont} />}
                  </span>
                </BudContent>
              </span>
            </Liquid>
          </span>
        </LiquidGroup>
        <div className="relative">
          <Stars value={rating} size={size} active={down ? index : null} band={band} still={still} />
        </div>
        <span data-motion aria-hidden className="pointer-events-none absolute rounded-full" style={{ width: u(40 * f), height: u(40 * f), top: u(cell / 2 - 20 * f + 26 * f), left: 0, background: "rgba(255,255,255,.28)", transform: `translateX(${u(finger - 20 * f)})`, opacity: down ? 1 : 0, transition: `${t("transform", "press")}, ${t("opacity", "dismiss")}` }} />
        {/* The caption: a glass numeral pill joined by a neck to a chip tinted with the score. */}
        <div className="flex justify-center" style={{ marginTop: u(size * 0.5) }}>
          <LiquidGroup unit={u(k)}>
            <span className="flex items-center" style={{ gap: P(liquid.joined) }}>
              <Liquid className="flex items-center tabular-nums" style={{ height: P(pillH), paddingInline: P(pad), fontFamily: font.rounded, fontSize: P(Math.max(16, STAR_PT * 0.5)), fontWeight: 600, lineHeight: 1 }}>
                <span className="flex items-baseline">
                  <Digit value={Math.floor(rating)} pace={pace} /><span style={{ color: ground.muted }}>.{rating % 1 ? 5 : 0}</span><span style={{ fontSize: P(Math.max(16, STAR_PT * 0.5) * 0.62), color: ground.muted }}> / 5</span>
                </span>
              </Liquid>
              <Liquid tint={label ? level : undefined}>
                <span data-motion className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{ width: P(chipW), height: P(pillH), color: label ? ink : ground.muted, transition: t("width", down ? "press" : "morph") }}>
                  <MorphText text={label ?? "Tap or slide"} style={wordFont} />
                </span>
              </Liquid>
            </span>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Status Morph

type Status = "idle" | "loading" | "success" | "failure";
/** An outcome arrives in parts one beat apart: the ring closes, the block floods, the mark draws. */
const STATUS_BEAT = 160;
/** The outcome lands as the block closes solid, while the mark finishes: the pop or the shake. */
const STATUS_LAND = 500;
const TURNS = 1.1, SPIN_UP = 0.15;
/** Degrees turned `s` seconds into a spin from rest, and its speed then: full speed within about half a second. */
const spun = (s: number) => 360 * TURNS * (s - SPIN_UP * (1 - Math.exp(-s / SPIN_UP)));
const spinSpeed = (s: number) => 360 * TURNS * (1 - Math.exp(-s / SPIN_UP));
type Coast = { from: number; to: number; v: number; at: number };
/** Swift's coast: calm's pace without its give, a wheel slowed by friction that never swings back. */
const FRICTION = { duration: roles.reveal.duration, bounce: 0 };
/** Where a coasting arc is `s` seconds after it let go: critically damped, leaving at the speed it was turning. */
function coasted(c: Coast, s: number) {
  const w = (2 * Math.PI) / FRICTION.duration, x0 = c.from - c.to;
  return c.to + (x0 + (c.v + w * x0) * s) * Math.exp(-w * s);
}

/**
 * Turns the arc while loading: each spin starts from rest wherever the stroke lies, and leaving loading it coasts to
 * a stop at the speed it was turning. Under reduced motion it holds still and breathes. Runs only while it moves.
 */
function useSpin(loading: boolean) {
  const arc = useRef<SVGGElement>(null);
  const run = useRef({ spinning: false, start: 0, rest: 0, coast: null as Coast | null, frame: 0 });
  useEffect(() => {
    const r = run.current, now = performance.now(), still = reduced();
    if (loading) {
      if (r.coast) { r.rest = coasted(r.coast, Math.max(now - r.coast.at, 0) / 1000); r.coast = null; }
      r.spinning = true;
      r.start = now;
    } else if (r.spinning) {
      r.spinning = false;
      const s = Math.max(now - r.start, 0) / 1000, from = r.rest + spun(s), v = spinSpeed(s);
      // Projected with a 0.99 deceleration, as Swift's `PieceMotion.project`. Under reduced motion it never turned,
      // so it rests where it was.
      if (!still) {
        r.rest = from + v * 0.099;
        r.coast = { from, to: r.rest, v, at: now };
      }
    }
    const tick = (time: number) => {
      const el = arc.current;
      if (!el) return;
      let angle = r.rest, alpha = 1, more = false;
      if (r.spinning) {
        const s = Math.max(time - r.start, 0) / 1000;
        if (still) alpha = 0.725 + 0.275 * Math.cos((2 * Math.PI * s) / 1.2);
        else angle = r.rest + spun(s);
        more = true;
      } else if (r.coast) {
        const s = Math.max(time - r.coast.at, 0) / 1000;
        if (s * 1000 >= ms(FRICTION)) r.coast = null;
        else { angle = coasted(r.coast, s); more = true; }
      }
      el.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      el.style.opacity = alpha.toFixed(3);
      r.frame = more ? requestAnimationFrame(tick) : 0;
    };
    cancelAnimationFrame(r.frame);
    r.frame = requestAnimationFrame(tick);
  }, [loading]);
  useEffect(() => {
    const r = run.current;
    return () => cancelAnimationFrame(r.frame);
  }, []);
  return arc;
}

/** Track, turning arc, the block that floods in from the closed ring, and the two ink marks. */
function Morph({ state, size, lw }: { state: Status; size: number; lw: number }) {
  const settled = state === "success" || state === "failure";
  const before = useRef<Status>(state), was = before.current;
  const wasSettled = was === "success" || was === "failure";
  const block = state === "failure" ? blocks.tangerine : blocks.sage;
  // A draining block keeps its own colour; only the arc turns back to ink.
  const filled = useRef<string>(blocks.sage);
  if (settled) filled.current = block;
  const arc = useSpin(state === "loading");
  const still = useReduced();
  const body = useRef<HTMLSpanElement>(null);
  const mask = `${useId().replace(/[^\w-]/g, "")}flood`;
  useEffect(() => { before.current = state; }, [state]);
  // The pop or the shake lands as the block closes solid.
  useEffect(() => {
    if (state !== "success" && state !== "failure") return;
    let landing: Animation | undefined;
    const timer = window.setTimeout(() => {
      if (!body.current || reduced()) return;
      landing = state === "success" ? body.current.animate(...pop()) : body.current.animate(...shake(u, Math.max(3, size * 0.06)));
    }, STATUS_LAND);
    return () => { clearTimeout(timer); landing?.cancel(); };
  }, [state, size]);

  const c = size / 2, r = (size - lw) / 2, mw = Math.max(lw, size * 0.07);
  const mark = (p: number, cross: boolean) => {
    const q = size - p, w = q - p;
    return cross ? `M${p} ${p}L${q} ${q}M${q} ${p}L${p} ${q}` : `M${p} ${p + w * 0.54}L${p + w * 0.36} ${p + w * 0.9}L${q} ${p + w * 0.12}`;
  };
  // The container: one stroke that closes, opens or retracts. Idle is an exit.
  const container: Role = state === "idle" ? "dismiss" : "morph";
  const trim = settled ? 1 : state === "loading" ? 0.72 : 0;
  // Retracting to idle, the arc goes once its spring has settled (Swift's trim crosses zero a little later, at about
  // 330ms); under reduced motion the retract is instant, so the arc goes with it rather than leaving its round cap.
  const hideAt = state === "idle" && !still ? ms("dismiss") : 0;
  // A beat behind the ring the block floods inward, its centre shut by 80%; draining, it goes with the ring.
  const flood = settled
    ? tShaped("transform", "morph", "in80", floodIn(0.8), wasSettled ? 0 : STATUS_BEAT)
    : tShaped("transform", container, "out80", floodOut(0.8));
  return (
    <span ref={body} data-motion className="block" style={{ width: u(size), height: u(size) }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "100%", overflow: "visible" }} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
            <rect width={size} height={size} fill="white" />
            <circle data-motion cx={c} cy={c} r={c + 1} fill="black" style={{ transformOrigin: "center", transform: `scale(${settled ? 0 : 1})`, transition: flood }} />
          </mask>
        </defs>
        <circle cx={c} cy={c} r={r} stroke={ground.trough} strokeWidth={lw} style={{ opacity: settled ? 0 : 1, transition: t("opacity", container) }} />
        <circle cx={c} cy={c} r={c} fill={filled.current} mask={`url(#${mask})`} style={{ transition: settled && wasSettled ? t("fill", "morph", STATUS_BEAT) : "none" }} />
        <g ref={arc} data-motion style={{ transformOrigin: "center" }}>
          <circle cx={c} cy={c} r={r} pathLength={1} strokeWidth={lw} transform={`rotate(-90 ${c} ${c})`} style={{ stroke: settled ? block : ground.text, strokeDasharray: `${trim} 2`, opacity: state === "idle" ? 0 : 1, transition: `${t(["stroke", "stroke-dasharray"], container)}, opacity 0s linear ${hideAt}ms` }} />
        </g>
        {/* Draining, the marks show only through what is left of the block; drawing in, they see all of it. */}
        {/* A beat after the flood the mark draws; the one that no longer applies un-draws first, quickly. */}
        <g mask={settled ? undefined : `url(#${mask})`}>
          <Strokes d={mark(size * 0.29, false)} on={state === "success"} color={ink} width={mw} delay={2 * STATUS_BEAT} />
          <Strokes d={mark(size * 0.33, true)} on={state === "failure"} color={ink} width={mw} delay={2 * STATUS_BEAT} />
        </g>
      </svg>
    </span>
  );
}

const CAPTIONS: Record<Status, string | null> = { idle: null, loading: "Saving", success: "Saved", failure: "Failed" };
const STATUS_SEQ: [Status, number][] = [["idle", 1100], ["loading", 1800], ["success", 2400], ["loading", 1500], ["failure", 2400]];
const STATUS_MS = STATUS_SEQ.map((s) => s[1]);
/** The Swift Example's ring, in points (one point is one stage px here), and its caption's size. */
const RING = 196, CAPTION = Math.max(12, RING * 0.2);

/**
 * The ring with its caption on a glass pill just under it, as the Swift piece draws it. A changed caption morphs letter
 * by letter while the pill eases to its new width; an outcome's word changes two beats after the state, with its mark.
 * With no glass to bud from, the pill rises in on the reveal and sinks away on the dismiss; its slot keeps its height.
 */
export function StatusMorphPreview() {
  const state = STATUS_SEQ[useSteps(STATUS_MS)][0];
  const [caption, setCaption] = useState<{ text: string | null; settled: boolean }>({ text: null, settled: false });
  const last = useRef("Saving");
  useEffect(() => {
    const settled = state === "success" || state === "failure";
    const show = () => setCaption({ text: CAPTIONS[state], settled });
    if (!settled || reduced()) { show(); return; }
    const timer = window.setTimeout(show, 2 * STATUS_BEAT);
    return () => clearTimeout(timer);
  }, [state]);
  if (caption.text) last.current = caption.text;
  const font: CSSProperties = { fontSize: u(CAPTION), fontWeight: 600, letterSpacing: "-0.01em" };
  const [widths, sizer] = useWidths(["Saving", "Saved", "Failed"], font, u(1));
  const shown = caption.text !== null;
  const word = last.current, padX = CAPTION * 0.75, height = CAPTION * 1.2 + CAPTION * 0.72;
  return (
    <Stage>
      {sizer}
      <div className="flex flex-col items-center" style={{ gap: u(Math.max(liquid.joined, RING * 0.1)) }}>
        <Morph state={state} size={RING} lw={10} />
        <span className="grid place-items-center" style={{ height: u(height) }}>
          {/* The whole group fades: the goo would snap a half-faded shape on or off. */}
          <span data-motion className="block" style={{ opacity: shown ? 1 : 0, transform: `translateY(${shown ? 0 : u(CAPTION * 0.5)})`, transition: t(["opacity", "transform"], shown ? "reveal" : "dismiss") }}>
            <LiquidGroup unit={u(1)}>
              <Liquid>
                <span data-motion className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{ width: u(padX * 2 + widths[["Saving", "Saved", "Failed"].indexOf(word)]), height: u(height), color: caption.settled ? ground.text : ground.muted, transition: `${t("width", "morph")}, ${t("color", "morph")}` }}>
                  <MorphText text={word} style={font} />
                </span>
              </Liquid>
            </LiquidGroup>
          </span>
        </span>
      </div>
    </Stage>
  );
}

// MARK: - Skeleton Loader

/** The bone: the track token, so it is a quiet step off the stage in both themes (Swift #2F2F2F / #E6E3DB). */
const BONE = ground.trough;
/** The light: the bone lifted a step in lightness, so it is lighter than the bone on dark and on paper alike. */
const LIGHT = `oklch(from ${ground.trough} calc(l + 0.055) c h)`;
/** One pass of the light and its rest, on every bone at once. */
const SWEEP_PERIOD = 1600;
/** The breath's ease in and out: close to Swift's cosine. */
const SINE = "cubic-bezier(0.37, 0, 0.63, 1)";
const AGENDA = [
  { time: "9:30", title: "Design review", sub: "Studio B · 45 min", block: blocks.butter },
  { time: "11:00", title: "Lunch with Priya", sub: "Ferro Kitchen · 1 h", block: blocks.sage },
  { time: "16:15", title: "Ship build 4.2", sub: "Release room · 30 min", block: blocks.sky },
];
/** The redacted row every bone sits in: Swift sweeps the whole row, so one band crosses it left to right. */
type Row = { w: number; h: number };

/**
 * A solid bone showing its slice of the row's one soft diagonal light: the band eases across the row edge to edge in
 * the first three quarters of the period, then rests, so the time tile lights before the title bars. `x` and `y` place
 * the bone in its row. The light goes out when failed. Under reduced motion it holds still and the bone breathes
 * toward it instead, every bone in unison, over two periods.
 */
function Bone({ w, h, r, x, y, row, failed }: { w: number; h: number; r: number; x: number; y: number; row: Row; failed: boolean }) {
  const band = Math.max(72, row.w * 0.45), reach = band * 0.53 + Math.max(row.h, 40) * 0.17, tall = Math.max(row.h * 3, 120);
  const breath = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = breath.current;
    if (failed || !el || !reduced()) return;
    const running = el.animate([{ opacity: 0, easing: SINE }, { opacity: 0.75, easing: SINE }, { opacity: 0 }], { duration: 2 * SWEEP_PERIOD, iterations: Infinity });
    // On the document clock, so every bone breathes in the same moment, as Swift's shared reference clock.
    running.startTime = 0;
    return () => running.cancel();
  }, [failed]);
  return (
    <span className="relative block shrink-0 overflow-hidden" style={{ width: u(w), height: u(h), borderRadius: u(r), background: BONE }}>
      {!failed && (
        <>
          <span aria-hidden className="absolute" style={{ left: u(-x), top: u(-y), width: u(row.w), height: u(row.h) }}>
            <span data-motion className="absolute inset-0" style={{ "--from": u(-reach), "--to": u(row.w + reach), transform: `translateX(${u(-reach)})`, animation: `fb-pass ${SWEEP_PERIOD}ms linear infinite` } as CSSProperties}>
              <span className="absolute" style={{ left: u(-band / 2), width: u(band), top: u((row.h - tall) / 2), height: u(tall), background: `linear-gradient(90deg, transparent, ${LIGHT}, transparent)`, transform: "rotate(18deg)" }} />
            </span>
          </span>
          <span ref={breath} aria-hidden className="absolute inset-0" style={{ background: LIGHT, opacity: 0 }} />
        </>
      )}
    </span>
  );
}

/**
 * One redacted row. Handing off, the placeholder lifts away first on a quick fade and 50ms later the content
 * surfaces behind it, 60ms later per index. Loading again covers every row at once.
 */
function Redacted({ index, loading, failed, bones, children }: { index: number; loading: boolean; failed: boolean; bones: ReactNode; children: ReactNode }) {
  const lag = 60 * index;
  return (
    <div className="relative">
      <div data-motion style={{ opacity: loading ? 0 : 1, filter: loading ? `blur(${u(8)})` : "blur(0)", transform: `translateY(${loading ? u(6) : 0})`, transition: loading ? t(["opacity", "filter", "transform"], "dismiss") : t(["opacity", "filter", "transform"], "reveal", 50 + lag) }}>{children}</div>
      <div data-motion aria-hidden className="absolute inset-0" style={{ opacity: loading ? 1 : 0, transition: t("opacity", "dismiss", loading ? 0 : lag) }}>
        {/* Failing, the bones dim firmly; a retry brightens them as the light returns. */}
        <div data-motion style={{ opacity: failed ? 0.5 : 1, transition: t("opacity", failed ? "error" : "reveal") }}>{bones}</div>
      </div>
    </div>
  );
}

const SKELETON_SEQ: [boolean, boolean, number][] = [[true, false, 2200], [false, false, 2800], [true, false, 1800], [true, true, 1900]];
const SKELETON_MS = SKELETON_SEQ.map((s) => s[2]);

export function SkeletonLoaderPreview() {
  const [loading, failed] = SKELETON_SEQ[useSteps(SKELETON_MS)];
  const S = 1.5;
  // The row is the full column; the bars sit right of the tile, centred on its height.
  const lane: Row = { w: 430, h: 52 * S }, barX = (64 + 14) * S, barY = (lane.h - (15 + 9 + 13) * S) / 2;
  return (
    <Stage>
      <div className="flex flex-col" style={{ gap: u(22 * S), width: u(lane.w) }}>
        {AGENDA.map((row, i) => (
          <Redacted key={row.title} index={i} loading={loading} failed={failed} bones={
            <div className="flex items-center" style={{ gap: u(14 * S) }}>
              <Bone w={64 * S} h={52 * S} r={radius.md * S} x={0} y={0} row={lane} failed={failed} />
              <div className="flex flex-col" style={{ gap: u(9 * S) }}>
                <Bone w={(128 + i * 16) * S} h={15 * S} r={5 * S} x={barX} y={barY} row={lane} failed={failed} />
                <Bone w={(150 + i * 12) * S} h={13 * S} r={5 * S} x={barX} y={barY + (15 + 9) * S} row={lane} failed={failed} />
              </div>
            </div>
          }>
            <div className="flex items-center" style={{ gap: u(14 * S) }}>
              <span className="grid shrink-0 place-items-center tabular-nums" style={{ width: u(64 * S), height: u(52 * S), borderRadius: u(radius.md * S), background: row.block, color: ink, fontFamily: font.rounded, fontSize: u(15 * S), fontWeight: 600 }}>{row.time}</span>
              <div>
                <p style={{ fontSize: u(16 * S), fontWeight: 600 }}>{row.title}</p>
                <p style={{ fontSize: u(14 * S), fontWeight: 600, color: ground.muted, marginTop: u(3 * S) }}>{row.sub}</p>
              </div>
            </div>
          </Redacted>
        ))}
      </div>
    </Stage>
  );
}

// MARK: - Outcome Screen

type Outcome = "success" | "failure" | "empty";
const OUTCOMES: { kind: Outcome; eyebrow?: string; title: string; message: string; primary: string; secondary?: string; details?: boolean; block: string }[] = [
  { kind: "success", eyebrow: "Synced 10:42", title: "Backup complete", message: "2,418 photos and 36 videos are safe in your library.", primary: "Done", block: blocks.sage },
  { kind: "failure", title: "Couldn't sync", message: "Check your connection and try again.", primary: "Try again", secondary: "Not now", details: true, block: blocks.butter },
  { kind: "empty", eyebrow: "Invoices", title: "No invoices yet", message: "Invoices you send to clients show up here.", primary: "New invoice", block: blocks.sky },
];

/** Glyph paths in a unit box, matching the Swift `Glyph` shape. */
function glyph(kind: Outcome, x: number, y: number, w: number) {
  const P = (a: number, b: number) => `${(x + a * w).toFixed(2)} ${(y + b * w).toFixed(2)}`;
  if (kind === "failure") return `M${P(0, 0)}L${P(1, 1)}M${P(1, 0)}L${P(0, 1)}`;
  if (kind === "success") return `M${P(0, 0.54)}L${P(0.36, 0.88)}L${P(1, 0.14)}`;
  return `M${P(0, 0.56)}L${P(0.3, 0.56)}L${P(0.38, 0.74)}L${P(0.62, 0.74)}L${P(0.7, 0.56)}L${P(1, 0.56)}L${P(1, 1)}L${P(0, 1)}ZM${P(0.18, 0.3)}L${P(0.82, 0.3)}M${P(0.3, 0.06)}L${P(0.7, 0.06)}`;
}

/** The success a failed sync's retry restamps to, in place, as the Swift Example's "Try again" lands. */
const SYNCED = OUTCOMES[0];

/** The eyebrow, title and message. `hold` keeps room for an eyebrow it lacks, so a crossfading title sits on the new one. */
function Copy({ o, hold }: { o: (typeof OUTCOMES)[number]; hold?: string }) {
  const eyebrow = o.eyebrow ?? hold;
  return (
    <>
      {eyebrow && <p style={{ fontSize: u(12), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted, textTransform: "uppercase", visibility: o.eyebrow ? "visible" : "hidden" }}>{eyebrow}</p>}
      <p style={{ ...display(34), letterSpacing: "-0.04em", marginTop: eyebrow ? u(8) : 0 }}>{o.title}</p>
      <p style={{ fontSize: u(17), fontWeight: 600, lineHeight: 1.35, color: ground.muted, marginTop: u(8) }}>{o.message}</p>
    </>
  );
}

/** The quiet secondary action and the details panel: glass, resting apart from the button so the two never share a neck. */
function Extras({ o }: { o: (typeof OUTCOMES)[number] }) {
  return (
    <>
      {o.secondary && <span className="grid place-items-center" style={{ height: u(42), fontSize: u(17), fontWeight: 600, color: ground.muted }}>{o.secondary}</span>}
      {o.details && (
        <Liquid radius={20} className="flex w-full items-center justify-between" style={{ height: u(44), marginTop: u(o.secondary ? 8 : liquid.apart), paddingInline: u(16), fontSize: u(15), fontWeight: 600, color: ground.text }}>
          Details
          <svg viewBox="0 0 24 24" style={{ width: u(15), height: u(15) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
        </Liquid>
      )}
    </>
  );
}

/** The button's height in points (one point is one stage px here), and how far home its progress bubble sits. */
const ACTION_H = 54;
const BUBBLE_HOME = -(ACTION_H / 2 + liquid.joined + (ACTION_H * liquid.homeScale) / 2);

/**
 * The one signal action on tinted glass, its label morphing letter by letter. While a retry runs it reads "Retrying" and
 * gives up its end to a glass progress bubble that buds out of it and rests joined by a neck; when the retry returns,
 * the bubble melts back in and the button takes its width back.
 */
function PrimaryRow({ label, pressed, retrying }: { label: string; pressed: boolean; retrying: boolean }) {
  return (
    <div className="relative flex w-full items-center" style={{ height: u(ACTION_H) }}>
      {/* Before the button, so at home the bubble sits under the button's end. */}
      <span className="absolute right-0 top-0">
        <Liquid bud={{ out: retrying, home: [BUBBLE_HOME, 0] }} className="grid place-items-center" style={{ width: u(ACTION_H), height: u(ACTION_H) }}>
          <BudContent out={retrying}>
            <span data-motion className="block rounded-full" style={{ width: u(22), height: u(22), border: `${u(3)} solid ${ground.subtle}`, borderTopColor: ground.text, animation: "fb-spin .8s linear infinite" }} />
          </BudContent>
        </Liquid>
      </span>
      <span data-motion className="relative block" style={{ flex: "1 1 auto", marginRight: retrying ? u(ACTION_H + liquid.joined) : 0, transition: t("margin-right", retrying ? liquid.split : liquid.home) }}>
        {/* Sinks a few points while pressed and springs back with a little give. */}
        <span data-motion className="block" style={{ transform: `scale(${pressed ? pressScale(320, ACTION_H) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
          <Liquid tint={signal.fill} className="grid w-full place-items-center" style={{ height: u(ACTION_H), color: signal.on, fontSize: u(18), fontWeight: 600 }}>
            <MorphText text={label} />
          </Liquid>
        </span>
      </span>
    </div>
  );
}

export function OutcomeScreenPreview() {
  const [n, setN] = useState(0);
  const [stage, setStage] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const stamp = useRef<SVGSVGElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const tops = useRef<number[]>([]);
  const glides = useRef<Animation[]>([]);
  const fresh = useRef<HTMLDivElement>(null), stale = useRef<HTMLDivElement>(null);
  const mask = `${useId().replace(/[^\w-]/g, "")}pool`;
  const o = OUTCOMES[n % OUTCOMES.length];
  const retries = o.kind === "failure";
  // Stage 5 on: the retry worked and the outcome restamps to success in place.
  const synced = retries && stage >= 5;
  const now = synced ? SYNCED : o;
  useEffect(() => {
    setStage(0); setPressed(false); setRetrying(false);
    const thuds: Animation[] = [];
    const thud = () => { if (stamp.current && !reduced()) thuds.push(stamp.current.animate(...pop(0.06))); };
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    // The stamp, in beats: the ring is drawn in ink, colour pools inward once it closes, the mark is pressed in, and
    // the outcome lands on one beat (the thud, the ripple and the copy), the actions a beat behind.
    const ts = [at(60, () => setStage(1)), at(480, () => setStage(2)), at(640, () => setStage(3)), at(880, () => { setStage(4); thud(); })];
    // "Try again": the spinner holds for the retry (1.2s in Swift), then the outcome restamps. The cross lifts as the
    // block recolours and the copy and actions swap, a beat later the check is pressed in, then it lands again.
    if (retries) ts.push(at(2400, () => setPressed(true)), at(2530, () => { setPressed(false); setRetrying(true); }), at(3730, () => { setRetrying(false); setStage(5); }), at(3890, () => setStage(6)), at(4130, () => { setStage(7); thud(); }));
    ts.push(at(retries ? 6000 : 3800, () => { setStage(0); setN((v) => v + 1); }));
    return () => { ts.forEach(clearTimeout); thuds.forEach((a) => a.cancel()); };
  }, [n, retries]);
  // The restamp reflows the copy and the actions; like Swift's morph on the outcome, every block glides to its new place,
  // and the crossfading title glides from where the old one sat down past the new eyebrow.
  useLayoutEffect(() => {
    const kids = column.current ? ([...column.current.children] as HTMLElement[]) : [];
    const at = kids.map((k) => k.offsetTop);
    if (stage === 5 && !reduced()) {
      const glide = (el: Element, dy: number) => el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: ms("morph"), easing: curve("morph").easing });
      const shift = (stale.current?.children[1] as HTMLElement | undefined)?.offsetTop ?? 0;
      glides.current = [
        ...kids.flatMap((k, i) => {
          const dy = (tops.current[i] ?? at[i]) - at[i];
          return Math.abs(dy) < 0.5 ? [] : [glide(k, dy)];
        }),
        ...(shift && !o.eyebrow ? [fresh.current, stale.current].flatMap((el) => (el ? [glide(el, -shift)] : [])) : []),
      ];
    }
    tops.current = at;
  }, [stage, n, o.eyebrow]);
  useEffect(() => () => glides.current.forEach((a) => a.cancel()), []);
  const S = 92, lw = 3.5, c = S / 2;
  const pooled = stage >= 2;
  const swap = `${ms("morph")}ms ${curve("morph").easing}`;
  return (
    <Stage>
      <div ref={column} className="flex w-full flex-col items-center text-center" style={{ paddingInline: u(76) }}>
        <div className="relative" style={{ width: u(S), height: u(S) }}>
          {stage >= 4 && <span key={stage >= 7 ? "again" : "first"} data-motion className="absolute inset-0 rounded-full" style={{ border: `${u(3)} solid ${now.block}`, opacity: 0, animation: `fb-pulse 700ms ${curve("reveal").easing} forwards` }} />}
          <svg ref={stamp} data-motion viewBox={`0 0 ${S} ${S}`} className="absolute inset-0" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <defs>
              <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={S} height={S}>
                <rect width={S} height={S} fill="white" />
                {/* The block pools inward from the ring, its centre shut by 90% so no speck is left under the mark. */}
                <circle data-motion cx={c} cy={c} r={c + 1} fill="black" style={{ transformOrigin: "center", transform: `scale(${pooled ? 0 : 1})`, transition: pooled ? tShaped("transform", "morph", "in90", floodIn(0.9)) : "none" }} />
              </mask>
            </defs>
            {/* A restamp keeps the block in place and recolours it. */}
            <circle cx={c} cy={c} r={c} mask={`url(#${mask})`} style={{ fill: now.block, transition: t("fill", "morph") }} />
            {/* Drawn in ink, it takes the block's colour as the colour pools, so the ring becomes the block. */}
            <circle data-motion cx={c} cy={c} r={c - lw / 2} pathLength={1} strokeWidth={lw} transform={`rotate(-90 ${c} ${c})`} style={{ stroke: pooled ? now.block : ground.text, strokeDasharray: "1 2", strokeDashoffset: stage >= 1 ? 0 : 1.02, transition: stage >= 1 ? `${tShaped("stroke-dashoffset", "reveal", "clamp", clamp1)}, ${t("stroke", "morph")}` : "none" }} />
            {/* The mark that no longer applies lifts first, quickly; the new one is pressed in a beat later. */}
            {(retries ? [o.kind, SYNCED.kind] : [o.kind]).map((kind) => {
              const pad = S * (kind === "failure" ? 0.34 : 0.3);
              return <Strokes key={`${n}-${kind}`} d={glyph(kind, pad, pad, S - pad * 2)} on={kind === now.kind && stage >= (synced ? 6 : 3)} color={ink} width={S * 0.075} />;
            })}
          </svg>
        </div>
        {/* The copy is read, so it rises on the calm reveal; a restamp crossfades it in place. */}
        <div data-motion className="relative" style={{ marginTop: u(20), opacity: stage >= 4 ? 1 : 0, transform: `translateY(${stage >= 4 ? 0 : u(12)})`, transition: stage >= 4 ? t(["opacity", "transform"], "reveal") : "none" }}>
          <div ref={fresh} key={now.kind} data-motion style={{ animation: `fb-in ${swap} both` }}><Copy o={now} /></div>
          {synced && <div ref={stale} aria-hidden className="absolute inset-x-0 top-0" style={{ animation: `fb-out ${swap} forwards` }}><Copy o={o} hold={now.eyebrow} /></div>}
        </div>
        {/* The actions follow a beat behind with a follower's give. Every glass shape among them is in one group. */}
        <div data-motion className="relative w-full" style={{ marginTop: u(24), opacity: stage >= 4 ? 1 : 0, transform: `translateY(${stage >= 4 ? 0 : u(10)})`, transition: stage >= 4 ? t(["opacity", "transform"], follow("release", 1), 120) : "none" }}>
          <LiquidGroup unit={u(1)} className="w-full">
            <div className="flex w-full flex-col items-center">
              <PrimaryRow label={retrying ? "Retrying" : now.primary} pressed={pressed} retrying={retrying} />
              <Extras o={now} />
            </div>
          </LiquidGroup>
          {/* The restamp's outgoing actions fade as a whole group: the goo would snap a half-faded shape on or off. */}
          {synced && (
            <div aria-hidden className="absolute inset-x-0" style={{ top: u(ACTION_H), animation: `fb-out ${swap} forwards` }}>
              <LiquidGroup unit={u(1)} className="w-full"><div className="flex w-full flex-col items-center"><Extras o={o} /></div></LiquidGroup>
            </div>
          )}
        </div>
      </div>
    </Stage>
  );
}
