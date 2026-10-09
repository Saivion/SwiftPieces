"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, follow, ms, pop, reduced, roles, rubberBand, t, type Role, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, glass, liquid } from "./piece-liquid";

// Lists previews. Each one shows the component and nothing else (FREE-V2.1): no invented headers,
// counters or screen chrome, only the content the piece itself renders.
// Sizes are iOS points mapped to container width, so the stage scales from the grid card to the docs header.
// Motion follows PieceMotion (piece-motion.ts): roles for every spring, a finger's drag at its own pace, and
// releases that leave at the speed the finger had. Glass follows PieceLiquid (piece-liquid.tsx): every control
// surface is a `Liquid` shape in a `LiquidGroup`, and swipe bubbles bud out of the card's edge frame by frame, laid
// out from the card's place exactly as the Swift pieces lay them out. Text is 600 weight throughout.

/** iOS points to container units. `s` is cqw per point for the vignette. */
const pt = (n: number, s: number) => `${+(n * s).toFixed(3)}cqw`;

/** Runs each `[delayMs, fn]` step once per `loopMs` cycle; every timer is cleared on unmount. */
function useTimeline(loopMs: number, steps: [number, () => void][]) {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, loopMs);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Reduce Motion, read after mount so the first render matches the server's. */
function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => setStill(reduced()), []);
  return still;
}

const linearEasing = (fn: (p: number) => number, steps: number) =>
  `linear(${Array.from({ length: steps + 1 }, (_, i) => (i === 0 ? "0" : i === steps ? "1" : `${fn(i / steps).toFixed(4)} ${((i / steps) * 100).toFixed(2)}%`)).join(", ")})`;

/**
 * A spring released from 0 toward 1 while already moving at `v` (whole distances per second, capped near the spring's
 * frequency as PieceMotion caps it): Swift's `settle(velocity:)`. `at(seconds)` is its position and `end` the seconds
 * it takes to settle. Uncached, for values driven per frame, whose speeds differ every time.
 */
function springAt(spring: Role | Spring, v = 0) {
  const s = typeof spring === "string" ? roles[spring] : spring;
  const w = (2 * Math.PI) / s.duration, z = 1 - Math.min(Math.max(s.bounce, 0), 0.99);
  const v0 = Math.min(Math.max(v, -w * 1.5), w * 1.5);
  const wd = w * Math.sqrt(Math.max(1 - z * z, 0));
  const raw = (t: number) => (z >= 1
    ? 1 - Math.exp(-w * t) * (1 + (w - v0) * t)
    : 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) - ((v0 - z * w) / wd) * Math.sin(wd * t)));
  let end = 0.05;
  for (let t = 0; t < 3; t += 0.002) if (Math.abs(raw(t) - 1) > 0.001) end = t;
  return { s, v0, raw, end, at: (t: number) => (t >= end ? 1 : raw(t)) };
}

/** A release that closes a card: no bounce at all, so a card passing home never shows the other side's bubbles. */
const closing: Spring = { duration: 0.28, bounce: 0 };

/** Reduce Motion's stand-in for every settle: short, with no overshoot. */
const STILL: Spring = { duration: 0.25, bounce: 0 };

/**
 * A number moving along timed segments: a finger's drag, or a spring that leaves at the speed the number already had,
 * the way a retargeted SwiftUI spring keeps its velocity. Read it each frame with `at(now)`.
 */
function motionValue(initial: number) {
  let from = initial, to = initial, start = 0, dur = 0, ease: (t: number) => number = (t) => t;
  const at = (now: number) => {
    const e = now - start;
    if (e >= dur) return to;
    return e <= 0 ? from : from + (to - from) * ease(e / 1000);
  };
  const speed = (now: number) => (at(now) - at(now - 16)) / 0.016;
  return {
    at,
    target: () => to,
    set(v: number) { from = to = v; dur = 0; },
    /** A finger moving it to `target` over `duration` ms; `shape` bends its pace. */
    track(target: number, duration: number, now: number, shape: (p: number) => number = (p) => p) {
      from = at(now); to = target; start = now; dur = duration;
      ease = (t) => shape(Math.min((t * 1000) / duration, 1));
    },
    /**
     * Springs to `target` from wherever it is drawn, leaving at its current speed. `maxRel` caps that speed in whole
     * distances per second, as Swift's `landing` caps an opening at the spring's own speed over the travel.
     */
    spring(target: number, spring: Role | Spring, now: number, maxRel?: number) {
      const x = at(now), v = speed(now), d = target - x;
      from = x; to = target; start = now;
      if (Math.abs(d) < 1e-4) { dur = 0; return; }
      let rel = v / d;
      if (maxRel !== undefined) rel = Math.sign(rel) * Math.min(Math.abs(rel), maxRel);
      const l = springAt(spring, rel);
      ease = l.at; dur = Math.round(l.end * 1000);
    },
  };
}

/**
 * Numbers driven frame by frame (a finger's drag, a spring that keeps its speed), handed back as state so the
 * preview re-renders while any of them moves. Swift lays its swipe bubbles out from the card's place as drawn on
 * every frame; this is how the previews do the same.
 */
function useDriven(initial: number[]) {
  const values = useRef(initial.map((v) => motionValue(v)));
  const [now, setNow] = useState(initial);
  useEffect(() => {
    let raf = 0, painted = "";
    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const next = values.current.map((m) => m.at(time));
      const key = next.map((n) => n.toFixed(3)).join(",");
      if (key !== painted) { painted = key; setNow(next); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const drive = useRef({
    set: (i: number, v: number) => values.current[i].set(v),
    track: (i: number, target: number, duration: number, shape?: (p: number) => number) => values.current[i].track(target, duration, performance.now(), shape),
    spring: (i: number, target: number, spring: Role | Spring, maxRel?: number) => values.current[i].spring(target, reduced() ? STILL : spring, performance.now(), maxRel),
    target: (i: number) => values.current[i].target(),
  }).current;
  return [now, drive] as const;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** A tint `amount` of the way in from clear glass, kept opaque so the goo stays crisp. */
const tintAt = (tint: string, amount: number) =>
  amount >= 0.999 ? tint : amount <= 0.001 ? undefined : `color-mix(in srgb, ${tint} ${(amount * 100).toFixed(1)}%, transparent)`;

/** The opening speed cap: an open leaves toward its detent no faster than the settle spring's own speed over the travel. */
const OPEN_CAP = (2 * Math.PI) / roles.settle.duration;

function Glyph({ d, size, stroke = 2.2, style }: { d: string; size: string; stroke?: number; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3";
const MOON = "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z";
const ENVELOPE = "M3 9l9-6 9 6v10H3V9zM3 9l9 6 9-6";
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const CHEVRON = "M6 9l6 6 6-6";
const UTURN = "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11";

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>
      <style>{"@keyframes lp-rise{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}@keyframes lp-fall{from{opacity:0;transform:translateY(-40%)}to{opacity:1;transform:none}}"}</style>
      {children}
    </div>
  );
}

// MARK: Swipe Action Row

const MESSAGES = [
  { initials: "MA", name: "Mara Lindqvist", subject: "Final cut of the launch film", time: "9:41", block: blocks.sand },
  { initials: "JO", name: "Jonas Okafor", subject: "Studio booking for Thursday", time: "8:12", block: blocks.sage },
  { initials: "PR", name: "Priya Raman", subject: "Notes from the pricing review", time: "Mon", block: blocks.lilac },
];

/**
 * Row width and height, one bubble's width and its gap (joined, so the open row is one liquid surface), the
 * full-swipe line (60% of the row, never less than two bubbles) and how far past each edge the row's clip fades, in
 * points.
 */
const ROW = 430, ROW_H = 74, BUBBLE_W = 78, GAP = liquid.joined, LINE = Math.max(ROW * 0.6, BUBBLE_W * 2), FADE = 20;

/** Where the card sits for a finger at `x`: 1:1 up to the full-swipe line, then against rubber-band resistance. */
const swipePlace = (x: number) => (Math.abs(x) <= LINE ? x : Math.sign(x) * (LINE + Math.abs(rubberBand(Math.abs(x) - LINE, 80))));

/** The finger pulling from the line to `to`: the card slows as the band takes hold. */
const bandPull = (to: number) => (p: number) => (swipePlace(-LINE + (to + LINE) * p) + LINE) / (swipePlace(to) + LINE);

type Placement = { width: number; center: number; progress: number; color: number };

/**
 * Where the bubble `rank` places from the edge sits for a side opened `revealed` points, as the Swift piece places it:
 * open, in its slot from the row's outer edge; opening, budding out of the card's edge, born just inside it and shrunk,
 * the edge bubble leading; opened past the slots, stretched to fill the gap. `center` is measured from the row's outer
 * edge, `color` is how much of its tint shows.
 */
function swipePlacement(rank: number, count: number, revealed: number, still: boolean): Placement {
  const open = (BUBBLE_W + GAP) * count;
  if (revealed >= open) {
    const width = (revealed - GAP * count) / count;
    return { width, center: width / 2 + rank * (width + GAP), progress: 1, color: 1 };
  }
  const width = BUBBLE_W, rest = width / 2 + rank * (width + GAP);
  const lead = 0.12 * Math.min(rank, 4);
  const progress = Math.max(0, (revealed / open - lead) / (1 - lead));
  if (still) return { width, center: rest, progress, color: clamp01((progress - 0.3) / 0.4) };
  const home = revealed + (width * liquid.homeScale) / 2;
  const center = home + (rest - home) * progress;
  return { width, center, progress, color: clamp01(((revealed - center) / width - 0.05) / 0.3) };
}

type SwipeAction = { d: string; label: string; tint: string };
/** The first action sits at the row's edge, as `.swipeActions` places it. */
const TRAILING: SwipeAction[] = [{ d: TRASH, label: "Delete", tint: signal.fill }, { d: MOON, label: "Snooze", tint: blocks.butter }];
const LEADING: SwipeAction[] = [{ d: ENVELOPE, label: "Read", tint: blocks.sky }];

/**
 * One side's bubbles for a card drawn at `x`. Each is laid out from the card's place on this very frame, so it buds and
 * melts exactly with the card. Its color fills in as it clears the card and drains as it heads home; its glyph and
 * label arrive once it is clear and leave the moment the card heads home. While the edge bubble takes the bar (`take`
 * from 0 to 1), the others melt into it.
 */
function SwipeBubbles({ actions, edge, x, homing, swallowed, take, swells, still, s, icon }: {
  actions: SwipeAction[]; edge: "leading" | "trailing"; x: number; homing: boolean; swallowed: boolean; take: number; swells: boolean; still: boolean; s: number;
  icon: (el: HTMLSpanElement | null) => void;
}) {
  const revealed = edge === "leading" ? Math.max(x, 0) : Math.max(-x, 0);
  if (revealed <= 0) return null;
  const inward = edge === "leading" ? 1 : -1, count = actions.length;
  // Furthest in first, so the edge bubble draws over the ones it swallows.
  return <>{actions.map((_, i) => count - 1 - i).map((rank) => {
    const a = actions[rank], isEdge = rank === 0;
    let place = swipePlacement(rank, count, revealed, still);
    if (isEdge && count > 1) {
      // Taking the bar, the edge bubble lays out as if it were alone, so it spans the whole gap.
      const alone = swipePlacement(0, 1, revealed, still);
      place = { width: lerp(place.width, alone.width, take), center: lerp(place.center, alone.center, take), progress: lerp(place.progress, alone.progress, take), color: lerp(place.color, alone.color, take) };
    }
    const melted = !isEdge && swallowed;
    const out = place.color >= 0.75 && !melted && !homing;
    const scale = still ? 1 : liquid.homeScale + (1 - liquid.homeScale) * place.progress;
    return (
      <div key={a.label} data-motion className="absolute inset-y-0" style={{ [edge === "leading" ? "left" : "right"]: 0, width: pt(place.width, s), transform: `translateX(${pt(inward * (place.center - place.width / 2), s)}) scale(${scale.toFixed(4)})`, opacity: still ? Math.min(1, place.progress * 2) : 1 }}>
        <Liquid radius={26} tint={melted ? undefined : tintAt(a.tint, place.color)} bud={isEdge ? undefined : { out: !melted, home: [(-inward * rank * (BUBBLE_W + GAP)) / 2, 0] }} className="flex h-full w-full items-center justify-center" style={{ color: ink }}>
          <BudContent out={out}>
            <span className="flex flex-col items-center" style={{ gap: pt(6, s) }}>
              <span ref={isEdge ? icon : undefined} className="grid">
                <Glyph d={a.d} size={pt(20, s)} stroke={2.4} style={{ transform: `scale(${isEdge && swells && !still ? 1.12 : 1})`, transition: t("transform", "snap") }} />
              </span>
              <span style={{ fontSize: pt(12, s), fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>{a.label}</span>
            </span>
          </BudContent>
        </Liquid>
      </div>
    );
  })}</>;
}

type SwipeRow = { armed: boolean; swallowed: boolean };

export function SwipeActionRowPreview() {
  const s = 0.19;
  const still = useStill();
  // Per row: the card's place (0 to 2), and how far its edge bubble has taken the bar (3 to 5).
  const [v, drive] = useDriven([0, 0, 0, 0, 0, 0]);
  const [rows, setRows] = useState<SwipeRow[]>(() => MESSAGES.map(() => ({ armed: false, swallowed: false })));
  const [arm, setArm] = useState({ row: -1, n: 0 });
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const setRow = (i: number, patch: Partial<SwipeRow>) => setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));
  // Jonas: a flick settles into the open bubbles on the elastic spring at its speed, the bubbles budding out of the
  // card's edge with it; a tap snaps it home and they melt back in. Priya: a slow peek buds the Read bubble out, and let
  // go past halfway it opens with the same give. Mara: a full swipe follows the finger to the line, Snooze melts into
  // Delete as it swells across the bar with a bounce, the card gives against the band, then carries on out of the row.
  // Still there a beat later, the card comes home and the bar melts into its edge.
  useTimeline(9000, [
    [600, () => drive.track(1, -30, 50)],
    [650, () => drive.spring(1, -2 * (BUBBLE_W + GAP), "settle", OPEN_CAP)],
    [2200, () => drive.spring(1, 0, "snap")],
    [2900, () => drive.track(2, 44, 300)],
    [3200, () => drive.spring(2, BUBBLE_W + GAP, "settle", OPEN_CAP)],
    [4400, () => drive.spring(2, 0, "snap")],
    [5100, () => drive.track(0, -150, 330)],
    [5430, () => drive.track(0, -LINE, 190)],
    [5620, () => { drive.track(0, swipePlace(-340), 240, bandPull(-340)); drive.spring(3, 1, "snap"); setRow(0, { armed: true, swallowed: true }); setArm((a) => ({ row: 0, n: a.n + 1 })); }],
    [6200, () => drive.spring(0, -(ROW + FADE + 24), closing)],
    [6200 + ms(closing) + 350, () => { drive.spring(0, 0, "snap"); setRow(0, { armed: false }); }],
    // Home, the bar's followers are back in their slots for the next swipe.
    [6200 + ms(closing) + 350 + ms("snap") + 100, () => { drive.set(3, 0); setRow(0, { swallowed: false }); }],
  ]);
  // The edge glyph bounces once as the full swipe arms, never as it lets go.
  useEffect(() => {
    const el = icons.current[arm.row];
    if (!arm.n || !el || reduced()) return;
    const a = el.animate(...pop(0.1));
    return () => a.cancel();
  }, [arm]);
  // The row clips sideways and fades out past each edge, so the glass's lift is never cut by a hard line.
  const fade = `linear-gradient(90deg, transparent, #000 ${pt(FADE, s)}, #000 calc(100% - ${pt(FADE, s)}), transparent)`;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pt(ROW, s) }}>
        <div className="flex flex-col" style={{ gap: pt(8, s) }}>
          {MESSAGES.map((m, i) => {
            const x = v[i], take = v[3 + i], row = rows[i];
            const target = drive.target(i);
            return (
              <div key={m.name} style={{ marginInline: pt(-FADE, s), paddingInline: pt(FADE, s), paddingBlock: pt(24, s), marginBlock: pt(-24, s), maskImage: fade, WebkitMaskImage: fade }}>
                <LiquidGroup unit={pt(1, s)}>
                  <div className="relative" style={{ height: pt(ROW_H, s) }}>
                    <SwipeBubbles actions={TRAILING} edge="trailing" x={x} homing={target >= 0} swallowed={row.swallowed} take={take} swells={row.swallowed} still={still} s={s} icon={(el) => { icons.current[i] = el; }} />
                    <SwipeBubbles actions={LEADING} edge="leading" x={x} homing={target <= 0} swallowed={false} take={0} swells={row.armed} still={still} s={s} icon={(el) => { if (x > 0) icons.current[i] = el; }} />
                    {/* The card: liquid glass under the row's content, sliding with the finger. */}
                    <div data-motion className="relative h-full" style={{ transform: `translateX(${pt(x, s)})` }}>
                      <Liquid radius={26} className="flex h-full items-center" style={{ paddingInline: pt(16, s), gap: pt(14, s) }}>
                        <span className="grid shrink-0 place-items-center rounded-full" style={{ width: pt(46, s), height: pt(46, s), background: m.block, color: ink, fontFamily: font.rounded, fontWeight: 600, fontSize: pt(15, s) }}>{m.initials}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block" style={{ fontSize: pt(17, s), fontWeight: 600, lineHeight: 1.25 }}>{m.name}</span>
                          <span className="block truncate" style={{ fontSize: pt(15, s), fontWeight: 600, color: ground.muted, lineHeight: 1.3 }}>{m.subject}</span>
                        </span>
                        <span style={{ fontSize: pt(13, s), fontWeight: 600, color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{m.time}</span>
                      </Liquid>
                    </div>
                  </div>
                </LiquidGroup>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

// MARK: Depth Carousel

const TRIPS = [
  { city: "Lisbon", country: "PORTUGAL", dates: "Oct 12 – 16", nights: 4, block: blocks.tangerine },
  { city: "Kyoto", country: "JAPAN", dates: "Nov 3 – 10", nights: 7, block: blocks.sky },
  { city: "Oaxaca", country: "MEXICO", dates: "Dec 1 – 6", nights: 5, block: blocks.butter },
  { city: "Bergen", country: "NORWAY", dates: "Jan 18 – 21", nights: 3, block: blocks.lilac },
];

/** A finger's slide along the track: it speeds up and slows down on its own, not on a spring. */
const slide = (p: number) => p * p * (3 - 2 * p);

/** The page total and the resting dots: Swift's soft grey in each theme (#4A4946 dark, #C9C7C1 light), mixed from the
 *  stage's own tokens so it follows the site theme. */
const soft = `color-mix(in srgb, ${ground.text} 22%, ${ground.bg})`;

export function DepthCarouselPreview() {
  const s = 0.21;
  const W = 220, H = 250, GAP_PAGE = 16, PAGE = W + GAP_PAGE;
  const stride = 20, pill = 20, dot = 6, last = TRIPS.length - 1, track = last * stride + pill;
  /** The counter and the track: 44pt glass capsules, the dots inset so the end dots sit concentric with the ends. */
  const BAR = 44, INSET = (BAR - pill) / 2;
  /** The pill is drawn on a bar this much wider than the track at each end, so widening at an end dot shows. */
  const M = 6;
  const still = useStill();
  const [page, setPage] = useState(0);
  const [roll, setRoll] = useState(1);
  const [active, setActive] = useState(false);
  const [lean, setLean] = useState<number | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const discs = useRef<(HTMLSpanElement | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  // The pill lives in the track's content, which the liquid group draws in both its passes; only the visible one counts.
  const bar = useRef<HTMLSpanElement>(null);

  // Everything below the finger is a pure function of the page position, as in Swift: the row, each page's depth and
  // parallax, and the pill. Written per frame, so the pill never lags the pages and never jumps when one settles.
  const rowAt = (p: number) => `translateX(calc(${pt(-W / 2, s)} - ${pt(p * PAGE, s)}))`;
  const pageAt = (k: number, p: number, flat: boolean) => {
    const phase = Math.max(-1, Math.min(1, k - p)), depth = flat ? 0 : Math.abs(phase), lean = flat ? 0 : phase;
    return {
      z: String(Math.round((1 - depth) * 10)),
      card: `scale(${(1 - 0.1 * depth).toFixed(4)})`,
      opacity: (1 - 0.3 * Math.abs(phase)).toFixed(4),
      // Neighbors sit lower in the stack: a lighter shadow that leans back toward the centered page.
      shadow: `${pt(-lean * 10, s)} ${pt(16 - 8 * depth, s)} ${pt(22, s)} rgba(0,0,0,${(0.45 * (1 - 0.6 * depth)).toFixed(3)})`,
      disc: `translateX(${pt(lean * 40, s)})`,
      label: `translateX(${pt(lean * 10, s)})`,
    };
  };
  const clipAt = (lo: number, hi: number) => `inset(0 ${(((track + M - hi) / (track + 2 * M)) * 100).toFixed(3)}% 0 ${(((lo + M) / (track + 2 * M)) * 100).toFixed(3)}% round 999px)`;

  useEffect(() => {
    const flat = reduced();
    const glide: Role | Spring = flat ? { duration: 0.25, bounce: 0 } : "snap";
    const progress = motionValue(0), widen = motionValue(0), gapLo = motionValue(0), gapHi = motionValue(0), finger = motionValue(0);
    let touching = false, current = 0;

    /** The pill's edges for a position in pages. Between dots the edge ahead leads and the other follows, so it
     *  stretches by up to half the dot spacing and gathers in as it lands; past an end it flattens against the end dot. */
    const edges = (position: number, perPage: number): [number, number] => {
      const held = Math.min(Math.max(position, 0), last);
      if (flat) return [held * stride, held * stride + pill];
      const base = Math.floor(held), f = held - base;
      let lo = (base + f * f) * stride, hi = (base + f * (2 - f)) * stride + pill;
      const squash = Math.abs(rubberBand((position - held) * perPage, pill * 0.4));
      if (position < held) hi -= squash; else lo += squash;
      return [lo, hi];
    };
    const anchor = (now: number) => (touching ? edges(finger.at(now), stride) : edges(progress.at(now), PAGE));
    const drawn = (now: number): [number, number] => { const [lo, hi] = anchor(now); return [lo + gapLo.at(now), hi + gapHi.at(now)]; };
    /** Hands the pill between page and finger from exactly where it is drawn; the gap between them glides away on `role`. */
    const handOff = (touch: boolean, role: Role, now: number) => {
      const [lo, hi] = drawn(now);
      touching = touch;
      const [alo, ahi] = anchor(now);
      gapLo.set(lo - alo); gapHi.set(hi - ahi);
      gapLo.spring(0, role, now); gapHi.spring(0, role, now);
    };
    /** Pages land on the snap spring that every tap, scrub and swipe release uses. */
    const move = (index: number, now: number) => {
      if (index === current) return;
      setRoll(index > current ? 1 : -1);
      current = index;
      setPage(index);
      progress.spring(index, glide, now);
    };
    /** The dots dim and the pill widens on one press spring as a touch arrives, and settle back on the snap. */
    const activate = (on: boolean, now: number) => { widen.spring(on && !flat ? 1 : 0, on ? "press" : "snap", now); setActive(on); };

    let raf = 0, painted = "";
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (touching) {
        const index = Math.round(Math.min(Math.max(finger.at(now), 0), last));
        if (index !== current) move(index, now);
      }
      const p = progress.at(now), [lo, hi] = drawn(now), grow = widen.at(now) * 2;
      const key = `${p.toFixed(5)}:${lo.toFixed(3)}:${hi.toFixed(3)}:${grow.toFixed(3)}`;
      if (key === painted) return;
      painted = key;
      if (row.current) row.current.style.transform = rowAt(p);
      TRIPS.forEach((_, k) => {
        const v = pageAt(k, p, flat), slot = slots.current[k], card = cards.current[k], disc = discs.current[k], label = labels.current[k];
        if (slot) slot.style.zIndex = v.z;
        if (card) { card.style.transform = v.card; card.style.opacity = v.opacity; card.style.boxShadow = v.shadow; }
        if (disc) disc.style.transform = v.disc;
        if (label) label.style.transform = v.label;
      });
      if (bar.current) bar.current.style.clipPath = clipAt(lo - grow, hi + grow);
    };
    raf = requestAnimationFrame(frame);

    // A swipe: the pages ride the finger a little way, then the fling lands on the next page at its speed, and the
    // indicator stays active until the pages come to rest. A held neighbor leans forward, a third of the way to center,
    // and the tap carries it the rest. A scrub back along the track: the pill glides onto the finger, follows it 1:1
    // and flattens against the first dot when pulled past it, while the pages follow on the snap; let go, it eases home.
    const script: [number, (now: number) => void][] = [
      [900, (now) => { activate(true, now); progress.track(0.22, 200, now); }],
      [1100, (now) => move(1, now)],
      [1100 + ms("snap"), (now) => activate(false, now)],
      [2500, () => setLean(2)],
      [2850, (now) => { setLean(null); move(2, now); }],
      [4200, (now) => { activate(true, now); progress.track(2.22, 200, now); }],
      [4400, (now) => move(3, now)],
      [4400 + ms("snap"), (now) => activate(false, now)],
      [5800, (now) => { finger.set(2.7); handOff(true, "press", now); activate(true, now); }],
      [5900, (now) => finger.track(-0.4, 800, now, slide)],
      [6900, (now) => { handOff(false, "snap", now); activate(false, now); }],
    ];
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = script.map(([at, fn]) => setTimeout(() => fn(performance.now()), at)); };
    run();
    const loop = setInterval(run, 8400);
    return () => { cancelAnimationFrame(raf); clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stage>
      <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <div className="relative" style={{ height: pt(H, s) }}>
          <div ref={row} data-motion className="absolute top-0 left-1/2 flex h-full" style={{ gap: pt(GAP_PAGE, s), transform: rowAt(0) }}>
            {TRIPS.map((trip, k) => {
              const v = pageAt(k, 0, false), leans = lean === k && !still;
              return (
                // Held, a neighbor starts forward on the press spring; the tap's snap carries it the rest of the way.
                <div key={trip.city} ref={(el) => { slots.current[k] = el; }} data-motion className="relative h-full shrink-0" style={{ width: pt(W, s), zIndex: v.z, transform: `scale(${leans ? 1 + 0.1 / 3 : 1})`, transition: t("transform", leans ? "press" : "snap") }}>
                  <div ref={(el) => { cards.current[k] = el; }} data-motion className="relative h-full overflow-hidden" style={{ borderRadius: pt(30, s), background: trip.block, color: ink, transform: v.card, opacity: v.opacity, boxShadow: v.shadow }}>
                    <span ref={(el) => { discs.current[k] = el; }} data-motion className="absolute rounded-full" style={{ width: pt(150, s), height: pt(150, s), left: pt(118, s), top: pt(46, s), background: ink, transform: v.disc }} />
                    <div ref={(el) => { labels.current[k] = el; }} data-motion className="absolute inset-0 flex flex-col" style={{ padding: pt(18, s), transform: v.label }}>
                      <div className="flex justify-between" style={{ fontSize: pt(11, s), fontWeight: 600, letterSpacing: "0.1em" }}><span>{trip.country}</span><span>{trip.nights} NIGHTS</span></div>
                      <span className="mt-auto" style={{ fontSize: pt(36, s), fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}>{trip.city}</span>
                      <span style={{ fontSize: pt(14, s), fontWeight: 600, opacity: 0.7, marginTop: pt(4, s) }}>{trip.dates}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* The counter and the track: two glass capsules joined by a liquid neck, one control under the pages. */}
        <div className="flex justify-center" style={{ marginTop: pt(14, s) }}>
          <LiquidGroup unit={pt(1, s)}>
            <div className="flex items-center" style={{ gap: pt(liquid.joined, s) }}>
              <Liquid className="flex items-center" style={{ height: pt(BAR, s), paddingInline: pt(16, s) }}>
                <span style={{ fontFamily: font.rounded, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {/* A short roll with no overshoot: the number is information. */}
                  <span key={page} data-motion style={{ fontSize: pt(22, s), fontWeight: 600, display: "inline-block", animation: `${roll > 0 ? "lp-rise" : "lp-fall"} ${ms("value")}ms ${curve("value").easing}` }}>{String(page + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: pt(15, s), fontWeight: 600, color: soft, marginLeft: pt(3, s) }}>/ 04</span>
                </span>
              </Liquid>
              <Liquid className="flex items-center" style={{ height: pt(BAR, s), paddingInline: pt(INSET, s) }}>
                {/* Fixed dots under the pill, which rides inside the track's own glass and is drawn in absolute page
                    coordinates. */}
                <span className="relative flex items-center" style={{ gap: pt(stride - dot, s), paddingInline: pt((pill - dot) / 2, s) }}>
                  {TRIPS.map((trip) => <span key={trip.city} data-motion className="rounded-full" style={{ width: pt(dot, s), height: pt(dot, s), background: soft, opacity: active ? 0.6 : 1, transition: t("opacity", active ? "press" : "snap") }} />)}
                  <span ref={bar} data-motion className="absolute rounded-full" style={{ left: pt(-M, s), width: pt(track + 2 * M, s), height: pt(dot, s), background: ground.text, clipPath: clipAt(0, pill) }} />
                </span>
              </Liquid>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Task Row

type TaskState = "open" | "completed" | "snoozed";
type Lift = "rest" | "pressing" | "lifted" | "dropping";

/** The complete detent, the room each left-swipe action takes on the rail, and the round swipe bubbles, in points. */
const DETENT = 104, TILE = 76, TASK_BUBBLE = 56;

/** Where the card sits for a finger at `x` on a right swipe: 1:1 to the detent, then against rubber-band resistance. */
const taskPlace = (x: number) => (x <= DETENT ? x : DETENT + rubberBand(x - DETENT, 60));

/** A swipe bubble's tint for how far it has budded out from under the card, as `TaskRow.drain` sets it. */
const drain = (tint: string, progress: number) => tintAt(tint, clamp01((progress - 0.35) / 0.3));

/**
 * The swipe actions behind one card drawn at `x`, as the Swift piece lays them out: a sage complete bubble behind a
 * right swipe, Snooze and Delete behind a left one, each born just inside the card's edge and drawn out by the reveal,
 * hidden under the solid card until it clears it. Snooze and Delete rest apart.
 */
function TaskBubbles({ x, homing, armed, reopens, s, still }: { x: number; homing: boolean; armed: boolean; reopens: boolean; s: number; still: boolean }) {
  const right = Math.max(x, 0), left = Math.max(-x, 0);
  const scaleAt = (p: number) => (still ? 1 : liquid.homeScale + (1 - liquid.homeScale) * p);
  const bubble = (key: string, side: "left" | "right", width: number, center: number, progress: number, tint: string, out: boolean, content: ReactNode) => (
    <div key={key} data-motion className="absolute top-0" style={{ [side]: 0, width: pt(width, s), height: pt(TASK_BUBBLE, s), transform: `translateX(${pt((side === "left" ? 1 : -1) * (center - width / 2), s)}) scale(${scaleAt(progress).toFixed(4)})`, opacity: still ? Math.min(1, progress * 2) : 1 }}>
      <Liquid tint={drain(tint, progress)} className="flex h-full w-full items-center justify-center" style={{ color: ink }}>
        <BudContent out={out}>{content}</BudContent>
      </Liquid>
    </div>
  );
  const nodes: ReactNode[] = [];
  if (right > 0) {
    const progress = Math.min(1, right / DETENT), rest = Math.max(right, DETENT) / 2;
    const home = right + (TASK_BUBBLE * liquid.homeScale) / 2;
    const center = still ? rest : lerp(home, rest, progress);
    // Stamps on with give as the swipe arms, and lets go firmly.
    nodes.push(bubble("complete", "left", TASK_BUBBLE, center, progress, blocks.sage, right - center >= TASK_BUBBLE * 0.3 && !homing,
      <span data-motion className="grid" style={{ transform: `scale(${armed && !still ? 1.2 : 1})`, transition: t("transform", armed ? "success" : "snap") }}><Glyph d={reopens ? UTURN : CHECK} size={pt(20, s)} stroke={2.6} /></span>));
  }
  if (left > 0) {
    const actions = [{ label: "Snooze", d: MOON, tint: blocks.lilac }, { label: "Delete", d: TRASH, tint: signal.fill }];
    const n = actions.length, room = TILE * n, apart = liquid.apart;
    const margin = (room - TASK_BUBBLE * n - apart * (n - 1)) / 2;
    actions.forEach((a, index) => {
      const outer = index === n - 1;
      const width = TASK_BUBBLE + (outer ? Math.max(left - room, 0) : 0);
      // Laid out from the card's side, so past the detent the card side holds and the outer one stretches.
      const fromCard = margin + index * (TASK_BUBBLE + apart) + width / 2;
      const rest = Math.max(left, room) - fromCard;
      let center = rest, progress = 1;
      if (left < room) {
        const lead = 0.12 * (n - 1 - index);
        progress = Math.max(0, (left / room - lead) / (1 - lead));
        if (!still) { const home = left + (TASK_BUBBLE * liquid.homeScale) / 2; center = lerp(home, rest, progress); }
      }
      nodes.push(bubble(a.label, "right", width, center, progress, a.tint, left - center >= TASK_BUBBLE * 0.3 && !homing,
        <span className="flex flex-col items-center" style={{ gap: pt(2, s) }}><Glyph d={a.d} size={pt(17, s)} stroke={2.4} /><span style={{ fontSize: pt(11, s), fontWeight: 600, lineHeight: 1 }}>{a.label}</span></span>));
    });
  }
  return <>{nodes}</>;
}

/**
 * One task card. The card stays a solid surface; its chrome is glass. Completing flashes the card into the sage block
 * at once while the check bubble is stamped in ink and pops, the check draws and the strike grows; then the row folds
 * down compact on the morph, the ink fading to show the sage glass, its due label and priority chip folding away
 * together. Reopening clears the check and strike quickly and opens the row back up.
 */
function Task({ title, due, priority, state, flash, s, still, x = 0, homing = true, armed = false, reopens = false, lift = "rest" }: { title: string; due?: string; priority?: ["HIGH" | "MED" | "LOW", string]; state: TaskState; flash: boolean; s: number; still: boolean; x?: number; homing?: boolean; armed?: boolean; reopens?: boolean; lift?: Lift }) {
  const done = state === "completed", compact = done && !flash, open = state === "open";
  // Compacting folds on the morph's slight give; reopening opens back up a little slower, on the reveal.
  const sized: Role = compact ? "morph" : "reveal";
  const lifted = lift === "lifted" && !still;
  // Held, the card presses in slowly and never bounces; picked up, it springs off the table; set down, it settles.
  const scale = lifted ? 1.03 : lift === "pressing" && !still ? 0.98 : 1;
  const lifting: Role | Spring = lift === "lifted" ? "release" : lift === "pressing" ? { duration: 0.5, bounce: 0 } : "settle";
  const check = compact ? 24 : 28;
  return (
    <div className="relative grid" style={{ zIndex: lift === "rest" ? 0 : 1 }}>
      {/* The swipe bubbles, their own liquid group under the card, centered on the row. */}
      <div className="self-center" style={{ gridArea: "1 / 1" }}>
        <LiquidGroup unit={pt(1, s)}>
          <div className="relative" style={{ height: pt(TASK_BUBBLE, s) }}>
            {/* What the complete bubble offers is set while the finger is on it, as in Swift, so its glyph never flips
                as the completed card springs home over it. */}
            <TaskBubbles x={x} homing={homing} armed={armed} reopens={reopens} s={s} still={still} />
          </div>
        </LiquidGroup>
      </div>
      <div data-motion style={{ gridArea: "1 / 1", transform: `translateX(${pt(x, s)})` }}>
        <div data-motion className="relative flex items-center overflow-hidden" style={{ background: flash ? blocks.sage : ground.surface, borderRadius: pt(22, s), paddingLeft: pt(12, s), paddingRight: pt(16, s), paddingBlock: pt(compact ? 8 : 14, s), gap: pt(14, s), transform: `scale(${scale})`, boxShadow: lift === "lifted" ? `0 ${pt(12, s)} ${pt(22, s)} rgba(0,0,0,.35)` : `0 ${pt(3, s)} ${pt(8, s)} rgba(0,0,0,0)`, transition: [flash ? "background-color 0ms" : t("background-color", "morph"), t("padding", sized), t("transform", lifting), t("box-shadow", follow("release", 1))].join(", ") }}>
          <span className="grid shrink-0 place-items-center" style={{ width: pt(44, s), height: pt(44, s) }}>
            {/* The check: a glass bubble. Clear with a faint ring while open, sage once done, lilac snoozed. */}
            <LiquidGroup unit={pt(1, s)}>
              <Liquid tint={state === "snoozed" ? blocks.lilac : done ? blocks.sage : undefined} className="relative grid place-items-center" style={{ width: pt(check, s), height: pt(check, s), transition: [t(["width", "height"], sized), t("background-color", open ? "dismiss" : "success")].join(", ") }}>
                <span data-motion className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 ${pt(1.5, s)} rgba(166,164,159,${open ? 0.55 : 0})`, transition: t("box-shadow", open ? "dismiss" : "success") }} />
                {/* The stamp: solid ink over the glass for the beat the card flashes, fading as the row settles. */}
                <span data-motion className="absolute inset-0 rounded-full" style={{ background: ink, opacity: flash ? 1 : 0, transition: flash ? "opacity 0ms" : t("opacity", "morph") }} />
                {state === "snoozed" ? (
                  <span className="relative" style={{ color: ink }}><Glyph d={MOON} size={pt(13, s)} stroke={2.6} /></span>
                ) : (
                  // Draws at a pen's steady pace; clearing, it fades so its round cap never lingers as a dot.
                  <svg viewBox="0 0 24 24" className="relative" style={{ width: "80%", height: "80%", stroke: flash ? blocks.sage : ink, transition: flash ? "stroke 0ms" : t("stroke", "morph") }} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.5 12.5l3.8 3.8L17.5 8.5" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: done ? 0 : 1, opacity: open ? 0 : 1, transition: done ? "stroke-dashoffset 300ms ease-out" : t(["stroke-dashoffset", "opacity"], "dismiss") }} /></svg>
                )}
              </Liquid>
            </LiquidGroup>
          </span>
          <div className="min-w-0 flex-1">
            <p className="relative w-fit" style={{ fontSize: pt(compact ? 15 : 17, s), fontWeight: 600, lineHeight: 1.25, color: flash ? ink : open ? ground.text : ground.muted, transition: `${t("font-size", sized)}, ${flash ? "color 0ms" : t("color", "morph")}` }}>
              {title}
              {/* The strike draws over the title at a steady pace and never runs past it; reopening clears it quickly. */}
              <span data-motion className="absolute left-0 top-1/2 w-full origin-left rounded-full" style={{ height: pt(2, s), background: flash ? ink : ground.muted, transform: `scaleX(${done ? 1 : 0})`, transition: done ? "transform 350ms ease-in-out 150ms" : t("transform", "dismiss") }} />
            </p>
            {(due || state === "snoozed") && (
              <div data-motion className="grid" style={{ gridTemplateRows: compact ? "0fr" : "1fr", opacity: compact ? 0 : 1, transition: t(["grid-template-rows", "opacity"], sized) }}>
                <div className="min-h-0 overflow-hidden" style={{ paddingBlock: pt(3, s), marginBlock: pt(-3, s) }}>
                  {state === "snoozed" ? (
                    <span className="inline-block" style={{ marginTop: pt(5, s) }}>
                      <LiquidGroup unit={pt(1, s)}>
                        <Liquid tint={blocks.lilac} className="inline-flex items-center" style={{ gap: pt(4, s), paddingInline: pt(9, s), paddingBlock: pt(4, s), color: ink, fontSize: pt(12, s), fontWeight: 600 }}><Glyph d={MOON} size={pt(11, s)} stroke={2.6} />Snoozed</Liquid>
                      </LiquidGroup>
                    </span>
                  ) : (
                    <span className="flex items-center" style={{ marginTop: pt(5, s), gap: pt(4, s), fontSize: pt(13, s), fontWeight: 600, color: flash ? "rgba(20,20,20,.7)" : ground.muted }}><Glyph d={CLOCK} size={pt(11, s)} />{due}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          {priority && (
            // A tinted glass chip. Stays through the completion flash and folds away with the due label as the row compacts.
            <span data-motion className="shrink-0" style={{ opacity: state === "snoozed" || compact ? 0 : 1, transform: `scale(${state === "snoozed" || compact ? 0.6 : 1})`, transition: t(["transform", "opacity"], sized) }}>
              <LiquidGroup unit={pt(1, s)}>
                <Liquid tint={priority[1]} style={{ color: ink, fontSize: pt(11, s), fontWeight: 600, letterSpacing: "0.07em", paddingInline: pt(9, s), paddingBlock: pt(4, s), lineHeight: 1.3 }}>{priority[0]}</Liquid>
              </LiquidGroup>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskRowPreview() {
  const s = 0.165;
  const still = useStill();
  const [first, setFirst] = useState<TaskState>("open");
  const [second, setSecond] = useState<TaskState>("open");
  const [flash, setFlash] = useState<number | null>(null);
  // The second card's place (0) and the fourth's (1), driven frame by frame so the bubbles bud exactly with them.
  const [v, drive] = useDriven([0, 0]);
  const [armed, setArmed] = useState(false);
  const [lift, setLift] = useState<Lift>("rest");
  // Complete the first task from its check. Swipe the second right: the card rides the finger to the detent, the
  // complete bubble buds out from under it, its glyph stamps on as it arms and the card gives against the band; let
  // go, it comes home on the snap with a small give while the completion plays. Lift the snoozed task off the table
  // and set it down. Reopen both, then swipe the last row left: Snooze and Delete bud out and part to rest apart.
  // Under Reduce Motion a completion skips the flash and lands compact in one beat, as in Swift.
  useTimeline(9000, [
    [1000, () => { setFirst("completed"); setFlash(reduced() ? null : 0); }], [1700, () => setFlash(null)],
    [2600, () => drive.track(0, 60, 200)],
    [2800, () => drive.track(0, DETENT, 130)],
    [2930, () => { drive.track(0, taskPlace(150), 260, (p) => (taskPlace(DETENT + 46 * p) - DETENT) / (taskPlace(150) - DETENT)); setArmed(true); }],
    [3450, () => { drive.spring(0, 0, "snap"); setArmed(false); setSecond("completed"); setFlash(reduced() ? null : 1); }],
    [4150, () => setFlash(null)],
    [5100, () => setLift("pressing")], [5350, () => setLift("lifted")],
    [6100, () => setLift("dropping")], [6100 + ms(follow("release", 1)), () => setLift("rest")],
    [6900, () => { setFirst("open"); setSecond("open"); }],
    [7200, () => drive.track(1, -50, 120)],
    [7320, () => drive.spring(1, -TILE * 2, "settle", OPEN_CAP)],
    [8500, () => drive.spring(1, 0, "snap")],
  ]);
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pt(470, s) }}>
        <div className="flex flex-col" style={{ gap: pt(8, s) }}>
          <Task title="Review the launch checklist" due="Today, 5 PM" priority={["HIGH", signal.fill]} state={first} flash={flash === 0} s={s} still={still} />
          <Task title="Send Mara the final mockups" due="Today, 6 PM" priority={["MED", blocks.butter]} state={second} flash={flash === 1} s={s} still={still} x={v[0]} homing={drive.target(0) <= 0} armed={armed} />
          <Task title="Book the studio for Thursday" due="Tomorrow" state="snoozed" flash={false} s={s} still={still} lift={lift} />
          <Task title="Renew the domain" priority={["LOW", blocks.sky]} state="completed" flash={false} s={s} still={still} x={v[1]} homing={drive.target(1) >= 0} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Status Timeline

const STEPS: [string, string, string][] = [
  ["Order placed", "Confirmation sent to sam.rivera@example.com.", "9:41 AM"],
  ["Packed", "Three items packed at the Riverside warehouse.", "11:20 AM"],
  ["Out for delivery", "Noor has your parcel. You are stop 6 of 14.", "1:05 PM"],
  ["Delivered", "Left with the front desk. Signed by D. Alvarez.", "4:12 PM"],
];

type StepStatus = "complete" | "current" | "pending";
const statusesAt = (stage: number): StepStatus[] => STEPS.map((_, k) => (k < stage ? "complete" : k === stage ? "current" : "pending"));

/** The relay's beats, in ms from the step that completes, as in Swift: the check draws a beat after the number leaves,
 *  the stamp lands, the ink leaves down the line and runs on a clock, the next stop lights as the ink reaches it, and
 *  its panel buds out a beat after that. */
const BEAT = 100, STAMP = 220, INK_LEAVES = 200, INK_RUNS = 400, LEG = INK_LEAVES + INK_RUNS * 0.85;

/** The node column, the node, how far the node sits below the row's top, the panel's corner, and the gap from the
 *  column to the text: the panel rests a neck's width from its node. */
const COLUMN = 44, NODE = 30, NODE_TOP = 9, PANEL_R = 20, TEXT_GAP = liquid.joined - (COLUMN - NODE) / 2;

/**
 * The live step's breathing ring. Under Reduce Motion it holds still as a halo at 1.3x and breathes in opacity only,
 * as in Swift, so the step still reads as in progress. The site's reduced-motion CSS doesn't reach Web Animations.
 */
function Halo({ breath, still, s }: { breath: number; still: boolean; s: number }) {
  const ring = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!still || !ring.current) return;
    const a = ring.current.animate([{ opacity: 0.5 }, { opacity: 0.2 }], { duration: 1600, easing: "ease-in-out", direction: "alternate", iterations: Infinity });
    return () => a.cancel();
  }, [still]);
  return <span ref={ring} data-motion className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 ${pt(2, s)} ${signal.fill}`, transform: `scale(${still ? 1.3 : 1 + 0.5 * breath})`, opacity: still ? 0.5 : 0.9 - 0.9 * breath, transition: still ? "none" : "transform 1.6s ease-in-out, opacity 1.6s ease-in-out" }} />;
}

export function StatusTimelinePreview() {
  const s = 0.19;
  const still = useStill();
  const [shown, setShown] = useState<StepStatus[]>(() => statusesAt(2));
  const [open, setOpen] = useState<number | null>(2);
  const [breath, setBreath] = useState(0);
  // A node's glass and its mark both pop as its stamp lands; each is drawn in both of its group's passes.
  const nodes = useRef<Set<HTMLElement>[]>(STEPS.map(() => new Set()));
  useEffect(() => {
    let stage = 2, timers: ReturnType<typeof setTimeout>[] = [], pops: Animation[] = [];
    const later = (at: number, fn: () => void) => { timers.push(setTimeout(fn, at)); };
    const advance = () => {
      timers.forEach(clearTimeout);
      timers = [];
      const k = stage, next = stage >= STEPS.length ? 1 : stage + 1;
      stage = next;
      // A reset completes nothing, so it lands in one beat, as every change does under Reduce Motion.
      if (next !== k + 1 || reduced()) { setShown(statusesAt(next)); setOpen(next < STEPS.length ? next : null); return; }
      // The finished step stamps and its open panel melts back into its node.
      setShown((v) => v.map((x, i) => (i === k ? "complete" : x)));
      setOpen((o) => (o === k ? null : o));
      later(STAMP, () => {
        pops = pops.filter((a) => a.playState !== "finished");
        nodes.current[k].forEach((el) => { if (el.isConnected) pops.push(el.animate(...pop())); });
      });
      // The next stop lights as the ink reaches it, and its panel buds out a beat later.
      if (next < STEPS.length) {
        later(LEG, () => setShown(statusesAt(next)));
        later(LEG + BEAT, () => setOpen(next));
      }
    };
    const loop = setInterval(advance, 2200);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); pops.forEach((a) => a.cancel()); };
  }, []);
  // The ring breathes in scale on a clock; the still halo breathes on its own.
  useEffect(() => {
    if (still) return;
    const b = setInterval(() => setBreath((v) => 1 - v), 1600);
    return () => clearInterval(b);
  }, [still]);
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2" style={{ width: pt(390, s) }}>
        <div className="min-w-0 flex-1">
          {STEPS.map(([title, detail, time], k) => {
            const status = shown[k];
            const complete = status === "complete", current = status === "current", pending = status === "pending", last = k === STEPS.length - 1;
            const expanded = open === k;
            // The stop the ink lights takes its tint on the reveal; a stamp or a reset morphs in place.
            const role: Role = current ? "reveal" : "morph";
            // The detail opens on the reveal and closes with the stamp's morph.
            const fold: Role = expanded ? "reveal" : "morph";
            // Text reads in ink on the live step's open panel.
            const onTint = current && expanded;
            const bottom = last ? 0 : 4;
            // Out, the panel fills the text column and rests a neck's width from its node; home, it is a small round
            // blob inside the node, drawn under it.
            const side = NODE * 0.6, cx = COLUMN / 2, cy = NODE_TOP + NODE / 2;
            const panel: CSSProperties = expanded
              ? { left: pt(COLUMN + TEXT_GAP, s), top: 0, right: 0, bottom: pt(bottom, s), transition: t(["left", "top", "right", "bottom", "background-color"], liquid.split) }
              : { left: pt(cx - side / 2, s), top: pt(cy - side / 2, s), right: `calc(100% - ${pt(cx + side / 2, s)})`, bottom: `calc(100% - ${pt(cy + side / 2, s)})`, transition: t(["left", "top", "right", "bottom", "background-color"], liquid.home) };
            return (
              <div key={title} className="relative flex" style={{ gap: pt(TEXT_GAP, s) }}>
                {/* The row's glass, a liquid group of its own under the text: the node bubble and the panel that buds
                    out of it. */}
                <LiquidGroup unit={pt(1, s)} axis="both" style={{ position: "absolute", inset: 0 }}>
                  <Liquid radius={PANEL_R} tint={onTint ? signal.fill : undefined} style={{ position: "absolute", ...panel }} />
                  <div ref={(el) => { if (el) nodes.current[k].add(el); }} data-motion className="absolute" style={{ left: pt((COLUMN - NODE) / 2, s), top: pt(NODE_TOP, s), width: pt(NODE, s), height: pt(NODE, s) }}>
                    <Liquid tint={pending ? undefined : current ? signal.fill : blocks.sage} className="relative grid h-full w-full place-items-center" style={{ color: pending ? ground.muted : ink, fontFamily: font.rounded, fontSize: pt(14, s), fontWeight: 600, transition: `${t("background-color", role)}, ${t("color", role)}` }}>
                      {/* A slow breathing ring marks the live step. */}
                      {current && <Halo breath={breath} still={still} s={s} />}
                      <span data-motion className="absolute" style={{ opacity: complete ? 0 : 1, filter: complete ? `blur(${pt(3, s)})` : "blur(0)", transition: t(["opacity", "filter"], role) }}>{k + 1}</span>
                      {/* The check draws a beat after the number leaves; clearing, it fades so its round cap never lingers. */}
                      <svg viewBox="0 0 24 24" className="absolute" style={{ width: pt(17, s), height: pt(17, s) }} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={CHECK} pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: complete ? 0 : 1, opacity: complete ? 1 : 0, transition: complete ? t("stroke-dashoffset", "morph", BEAT) : t(["stroke-dashoffset", "opacity"], "dismiss") }} /></svg>
                    </Liquid>
                  </div>
                </LiquidGroup>
                <div className="relative flex shrink-0 flex-col items-center" style={{ width: pt(COLUMN, s) }}>
                  <span className="shrink-0" style={{ marginTop: pt(NODE_TOP, s), width: pt(NODE, s), height: pt(NODE, s) }} />
                  {/* The ink runs down the line on a clock, so it reaches the next stop exactly as that stop lights. */}
                  {!last && <span className="relative flex-1 rounded-full" style={{ width: pt(3, s), marginTop: pt(3, s), marginBottom: pt(-9, s), background: "rgba(166,164,159,.25)" }}><span data-motion className="absolute inset-0 origin-top rounded-full" style={{ background: ground.text, transform: `scaleY(${complete ? 1 : 0})`, opacity: complete ? 1 : 0, transition: complete ? `transform ${INK_RUNS}ms ease-in-out ${INK_LEAVES}ms` : t(["transform", "opacity"], "dismiss") }} /></span>}
                </div>
                <div data-motion className="relative min-w-0 flex-1 overflow-hidden" style={{ marginBottom: pt(bottom, s), paddingInline: pt(14, s), paddingBlock: pt(12, s), borderRadius: pt(PANEL_R, s), color: onTint ? ink : pending ? ground.muted : ground.text, transition: t("color", fold) }}>
                  <div className="relative flex items-baseline" style={{ gap: pt(8, s) }}>
                    <span className="flex-1" style={{ fontSize: pt(16, s), fontWeight: 600 }}>{title}</span>
                    {(k < 3 || complete) && <span style={{ fontSize: pt(12, s), fontWeight: 600, fontVariantNumeric: "tabular-nums", color: onTint ? "rgba(20,20,20,.7)" : ground.muted, transition: t("color", fold) }}>{time}</span>}
                    <Glyph d={CHEVRON} size={pt(11, s)} stroke={2.8} style={{ alignSelf: "center", color: onTint ? ink : ground.muted, transform: `rotate(${expanded ? 180 : 0}deg)`, transition: `${t("transform", fold)}, ${t("color", fold)}` }} />
                  </div>
                  {/* The row grows around the detail while the panel buds out under it and the text blurs in. */}
                  <div data-motion className="relative grid" style={{ gridTemplateRows: expanded ? "1fr" : "0fr", transition: t("grid-template-rows", fold) }}>
                    <p className="min-h-0 overflow-hidden" style={{ fontSize: pt(13, s), fontWeight: 600, lineHeight: 1.35, color: onTint ? "rgba(20,20,20,.78)" : ground.muted }}>
                      <span className="block" style={{ paddingTop: pt(6, s) }}><BudContent out={expanded}>{detail}</BudContent></span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}
