"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { pressScale, t, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Notice Stack: in-app notices piled the way notification stacks are. Rest is a pile of three: the newest notice on
 * a glass card, two narrower peeks under it melted into one liquid shape. A parcel notice drops in from above and the
 * pile settles under it; a tap spreads the pile into a list while Show less and the clear button bud out of the top
 * card; a finger drags the second card sideways and lets go, it flies off at the finger's speed and the rest close up;
 * the clear button dips and stretches into a red Clear all capsule; a second tap sends the cards off one after
 * another, the bottom one first, while the header melts into the top card, which goes last; a beat of empty; the pile
 * of three drops back in.
 * Sizes are authored in px (iOS points) against the 560 x 420 docs stage and converted to `cqw`.
 *
 * Motion follows NoticeStack.swift: the list opens on reveal and closes on dismiss, arrivals and removals settle on
 * reveal, a finger's drag tracks linearly, the release leaves on a no-bounce spring started at the finger's speed,
 * the clear button morphs, and the header buds on the split and home springs. Red appears only on Clear all.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

type CardId = "parcel" | "gate" | "rain" | "table";

type Step = {
  /** The notices in the stack, newest first. A card that isn't listed is gone: off the stage if it left, else hidden. */
  order: CardId[];
  /** Spread into the list. */
  open: boolean;
  /** Just inserted: drawn shrunk to nothing above its place for a frame, then dropped in. */
  arriving?: CardId[];
  /** Show less and the clear button are out of the top card. */
  header?: boolean;
  /** The clear button has stretched into Clear all. */
  armed?: boolean;
  /** A finger is down on the clear button. */
  press?: boolean;
  /** Sideways offsets, in points. */
  x?: Partial<Record<CardId, number>>;
  /** How the offsets get there: under a finger (linear over the step), a release that flies, or Clear all's cascade. */
  move?: "track" | "fly" | "cascade";
  ms: number;
};

/** Clear all: each card a beat after the one below it; the top one waits until the header has melted in. */
const STAGGER = 70, HEADER_HOME = 620;
/** Far enough that a card is past the stage's edge, as the Swift piece flies a card past the screen's. */
const OFF = 760;
const PILE: CardId[] = ["gate", "rain", "table"];
const ALL: CardId[] = ["parcel", "gate", "rain", "table"];
const LIST: CardId[] = ["parcel", "rain", "table"];

/** About 10.5 s: rest, an arrival, the list, a swipe, Clear all, a beat of empty, the pile again. */
const steps: readonly Step[] = [
  { order: PILE, open: false, ms: 1400 },
  { order: ALL, open: false, arriving: ["parcel"], ms: 50 },
  { order: ALL, open: false, ms: 1450 },
  { order: ALL, open: true, header: true, ms: 1500 },
  { order: ALL, open: true, header: true, x: { gate: 64 }, move: "track", ms: 150 },
  { order: ALL, open: true, header: true, x: { gate: 196 }, move: "track", ms: 300 },
  { order: ALL, open: true, header: true, x: { gate: OFF }, move: "fly", ms: 160 },
  { order: LIST, open: true, header: true, x: { gate: OFF }, ms: 1000 },
  { order: LIST, open: true, header: true, press: true, x: { gate: OFF }, ms: 140 },
  { order: LIST, open: true, header: true, armed: true, x: { gate: OFF }, ms: 1100 },
  { order: LIST, open: true, header: true, armed: true, press: true, x: { gate: OFF }, ms: 140 },
  // Clear all: the cards under the top one leave a beat apart while the header melts into the top card, which goes
  // last, once the header is home.
  { order: LIST, open: true, x: { gate: OFF, table: OFF, rain: OFF }, move: "cascade", ms: HEADER_HOME },
  { order: LIST, open: true, x: { gate: OFF, table: OFF, rain: OFF, parcel: OFF }, move: "cascade", ms: 450 },
  { order: [], open: false, x: { gate: OFF, table: OFF, rain: OFF, parcel: OFF }, ms: 650 },
  { order: PILE, open: false, arriving: PILE, ms: 50 },
  { order: PILE, open: false, ms: 1200 },
];

const NOTICES: Record<CardId, { title: string; message: string; time: string; tint: string; glyph: GlyphName; h: number }> = {
  parcel: { title: "At your door", message: "The parcel from Rua Augusta was left with the concierge.", time: "now", tint: blocks.sage, glyph: "box", h: 86 },
  gate: { title: "Gate changed", message: "Boarding is now B12, ten minutes earlier.", time: "2m", tint: blocks.sky, glyph: "airplane", h: 68 },
  rain: { title: "Rain at four", message: "The river walk is still fine if you leave now.", time: "18m", tint: blocks.lilac, glyph: "rain", h: 68 },
  table: { title: "Table held", message: "Under the lanterns, for two, at 19:30.", time: "1h", tint: blocks.butter, glyph: "fork", h: 68 },
};

/** Card width, the step each peek takes back, the list's gap, the header row and its glass, as the Swift piece. */
const W = 420, PEEK = 10, GAP = 12, ROW = 44, GLASS = 30, ROW_GAP = GAP - (ROW - GLASS) / 2;
const LESS_W = 92, CLEAR_W = 84;

type Place = { top: number; h: number; scale: number; depth: number; index: number };

/**
 * NoticeStackLayout: collapsed, the newest card at its height and two peeks behind it, each narrower and `PEEK` lower,
 * cut to the front card's height and scaled about their centres; open, the header row, then every card `GAP` apart.
 */
function layout(order: CardId[], open: boolean) {
  const places = new Map<CardId, Place>();
  if (!order.length) return { places, total: 0 };
  if (open) {
    let y = ROW + ROW_GAP;
    order.forEach((id, index) => {
      places.set(id, { top: y, h: NOTICES[id].h, scale: 1, depth: 0, index });
      y += NOTICES[id].h + GAP;
    });
    return { places, total: y - GAP };
  }
  const front = NOTICES[order[0]].h;
  order.forEach((id, index) => {
    const depth = Math.min(index, 2), scale = (W - 2 * PEEK * depth) / W;
    const h = index === 0 ? front : Math.min(NOTICES[id].h, front);
    places.set(id, { top: front + PEEK * depth - (h * (1 + scale)) / 2, h, scale, depth, index });
  });
  return { places, total: front + PEEK * Math.min(order.length - 1, 2) };
}

/**
 * A release that leaves at the finger's speed: a critically damped spring started already moving, like Swift's
 * `settle(velocity:from:to:spring:)` with the no-bounce exit spring, as one `linear()` easing.
 */
function launch(s: Spring, velocity: number): { easing: string; ms: number } {
  const w = (2 * Math.PI) / s.duration, v = Math.min(Math.max(velocity, 0), w * 1.5);
  const at = (x: number) => 1 - Math.exp(-w * x) * (1 + (w - v) * x);
  let end = 0.05;
  for (let x = 0; x < 2; x += 0.004) if (Math.abs(at(x) - 1) > 0.001) end = x;
  const n = 60, points: string[] = [];
  for (let i = 0; i <= n; i++) points.push(i === 0 ? "0" : i === n ? "1" : `${at((i / n) * end).toFixed(4)} ${((i / n) * 100).toFixed(2)}%`);
  return { easing: `linear(${points.join(", ")})`, ms: Math.round(end * 1000) };
}
/** The finger leaves at about 440 pt/s with 564 pt still to go. */
const FLY = launch({ duration: 0.28, bounce: 0 }, 440 / (OFF - 196));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Walks the storyboard; each step holds for `ms`, then loops. Holds the resting pile under reduced motion. */
function useSteps<T extends { ms: number }>(list: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % list.length), list[i].ms);
    return () => clearTimeout(timer);
  }, [i, list, reduced]);
  return list[i];
}

/** The SF Symbols the Swift piece draws, as paths: filled shapes plus strokes, on a 24 point grid. */
const glyphs = {
  airplane: { fill: "M21.2 12c0-.9-.8-1.5-1.8-1.5h-4.6L10.2 3.6c-.2-.3-.5-.4-.8-.4H8.2l2.4 7.3H6L4.3 8.4c-.2-.2-.4-.3-.7-.3h-.9l1 3.9-1 3.9h.9c.3 0 .5-.1.7-.3L6 13.5h4.6l-2.4 7.3h1.2c.3 0 .6-.1.8-.4l4.6-6.9h4.6c1 0 1.8-.6 1.8-1.5Z" },
  rain: { fill: "M7.2 14.6h9.9a3.9 3.9 0 0 0 .4-7.8 5.4 5.4 0 0 0-10.4 1.4 3.2 3.2 0 0 0 .1 6.4Z", stroke: "M8.6 17.6l-1.1 2.4M12.4 17.6l-1.1 2.4M16.2 17.6l-1.1 2.4" },
  fork: { stroke: "M6.5 3.5v5.2M9.5 3.5v5.2M3.5 3.5v5.2a3 3 0 0 0 6 0M6.5 11.7v8.8", fill: "M17.8 3.2c-2.6.9-4.3 3.6-4.3 7v3.3c0 .6.4 1 1 1h2.1v6c0 .6.5 1 1.1 1s1.1-.4 1.1-1V4.2c0-.7-.5-1.2-1-1Z" },
  box: { fill: "M11.3 2.9 4.6 6.5 12 10.4l7.4-3.9-6.7-3.6a1.5 1.5 0 0 0-1.4 0ZM3.8 7.9v7.6c0 .6.3 1.1.8 1.3l6.7 3.6v-8.6L3.8 7.9Zm16.4 0-7.5 3.9v8.6l6.7-3.6c.5-.2.8-.7.8-1.3V7.9Z" },
  xmark: { stroke: "M7 7l10 10M17 7 7 17" },
} as const;
type GlyphName = keyof typeof glyphs;

function Glyph({ name, size, stroke = 2.2, style }: { name: GlyphName; size: number; stroke?: number; style?: CSSProperties }) {
  const g: { fill?: string; stroke?: string } = glyphs[name];
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      {g.fill ? <path d={g.fill} fill="currentColor" /> : null}
      {g.stroke ? <path d={g.stroke} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

/** A card's words: in a beat after it lands or the list opens, gone at once when it hides under the pile. */
const words = (shown: boolean): CSSProperties => ({
  opacity: shown ? 1 : 0,
  filter: `blur(${shown ? 0 : 6}px)`,
  transition: shown ? "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms" : "opacity 140ms ease-out, filter 140ms ease-out",
});

function Face({ id, shown }: { id: CardId; shown: boolean }) {
  const n = NOTICES[id];
  return (
    <div data-motion className="flex items-start" style={{ padding: u(14), gap: u(12), ...words(shown) }}>
      <span className="grid shrink-0 place-items-center" style={{ width: u(38), height: u(38), borderRadius: u(10), background: n.tint, color: ink }}>
        <Glyph name={n.glyph} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: u(2) }}>
        <span className="flex items-baseline" style={{ gap: u(8) }}>
          <span className="min-w-0 flex-1 truncate" style={{ fontSize: u(15), lineHeight: u(20), fontWeight: 600, color: ground.text }}>{n.title}</span>
          <span className="tabular-nums" style={{ fontSize: u(12), fontWeight: 600, color: ground.muted }}>{n.time}</span>
        </span>
        <span style={{ fontSize: u(13), lineHeight: u(18), fontWeight: 600, color: ground.muted, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.message}</span>
      </span>
    </div>
  );
}

export function NoticeStackPreview() {
  const s = useSteps(steps);
  const { places, total } = layout(s.order, s.open);
  // Where each card last sat in the stack, so one that leaves flies off from there.
  const last = useRef(new Map<CardId, Place>());
  useEffect(() => { places.forEach((p, id) => last.current.set(id, p)); });
  const layoutRole = s.open ? "reveal" : "dismiss";
  // Empty draws nothing: every card has flown off the stage. The group holds still meanwhile (a glass pass resizing
  // around cards parked off the stage paints a stray square in Chrome) and jumps to the pile as it drops back in.
  const held = useRef(total);
  const empty = !s.order.length;
  const height = empty ? held.current : total;
  useEffect(() => { if (!empty) held.current = total; });
  const top = (420 - height) / 2;
  const prevEmpty = !steps[(steps.indexOf(s) + steps.length - 1) % steps.length].order.length;
  const groupMove = empty || prevEmpty ? "none" : t(["top", "height"], layoutRole);
  const front = s.order[0];
  // Home for a header bubble: inside the top card's top edge. Closing, the card rises to meet it; during Clear all
  // the list holds still, so it sinks all the way in (the Swift piece's `headerHome`).
  const home = s.move === "cascade" ? ROW / 2 + ROW_GAP + (GLASS * liquid.homeScale) / 2 + 6 : GLASS * 0.4;
  const headerOut = !!s.header;
  // The header exists only around its own life, as PieceBuds adds and removes it: placed home inside the top card a
  // step before it buds, removed once it has melted back in and the top card has carried it off.
  const at = steps.indexOf(s);
  const near = (k: number) => !!steps[(at + k + steps.length) % steps.length].header;
  const headerHere = headerOut || near(-1) || near(-2) || near(1);
  // Melted all the way in: gone at once (hidden while it holds still, which Chrome draws cleanly; unmounting it under
  // the goo mid-flight leaves a stray square for a frame).
  const headerGone = !headerOut && !near(-1) && !near(1);
  const lit = !!s.armed && headerOut;
  const cascadeOrder = [...s.order].reverse();

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <LiquidGroup unit={u(1)} merge={8} axis="y" style={{ position: "absolute", left: u((560 - W) / 2), width: u(W), top: u(top), height: u(height), transition: groupMove }}>
        {/* The header first, so a bubble at home sits under the top card and melts into it. */}
        {headerHere ? <div className="absolute inset-x-0 top-0" style={{ height: u(ROW), opacity: headerGone ? 0 : 1 }}>
          <span className="absolute left-0" style={{ top: u((ROW - GLASS) / 2) }}>
            <Liquid bud={{ out: headerOut, home: [0, home] }} className="flex items-center justify-center whitespace-nowrap" style={{ width: u(LESS_W), height: u(GLASS), fontSize: u(13), fontWeight: 600, color: ground.text }}>
              <span data-motion style={words(headerOut)}>Show less</span>
            </Liquid>
          </span>
          <span data-motion className="absolute right-0" style={{ top: u((ROW - GLASS) / 2), transform: `scale(${s.press ? pressScale(lit ? CLEAR_W : GLASS, GLASS) : 1})`, transformOrigin: "right center", transition: t("transform", s.press ? "press" : "release") }}>
            <Liquid tint={lit ? signal.fill : undefined} bud={{ out: headerOut, home: [0, home] }} className="relative flex items-center justify-center whitespace-nowrap" style={{
              width: u(s.armed ? CLEAR_W : GLASS), height: u(GLASS), marginLeft: "auto", fontSize: u(13), fontWeight: 600, color: signal.on,
              transition: t("width", "morph"),
            }}>
              <span data-motion className="absolute inset-0 grid place-items-center" style={{ color: ground.text, opacity: s.armed || !headerOut ? 0 : 1, filter: `blur(${s.armed ? 4 : 0}px)`, transition: t(["opacity", "filter"], "snap") }}>
                <Glyph name="xmark" size={12} stroke={2.6} />
              </span>
              <span data-motion style={words(headerOut)}><MorphText text={s.armed ? "Clear all" : ""} /></span>
            </Liquid>
          </span>
        </div> : null}
        {/* Back to front, so the newest card draws last, over its peeks. */}
        {[...ALL].reverse().map((id) => {
          const place = places.get(id);
          const kept = place ?? last.current.get(id);
          const x = s.x?.[id] ?? 0;
          const gone = !place && x === 0;
          const arriving = !!s.arriving?.includes(id);
          const shown = !!place && !arriving && (s.open || id === front);
          // Under a finger the card tracks linearly; let go it leaves at the finger's speed; Clear all sends each a
          // beat after the one below it, the top card once the header has melted in.
          const rank = cascadeOrder.indexOf(id);
          const xMove = gone || arriving ? "none"
            : s.move === "track" && s.x?.[id] !== undefined ? `transform ${s.ms}ms linear`
            : s.move === "fly" && s.x?.[id] !== undefined ? `transform ${FLY.ms}ms ${FLY.easing}`
            : s.move === "cascade" && rank >= 0 ? t("transform", "dismiss", id === front ? 0 : rank * STAGGER)
            : t("transform", "settle");
          const box = kept ?? { top: 0, h: NOTICES[id].h, scale: 1, depth: 0, index: 0 };
          const lift = arriving ? (s.open ? -12 : -(38 + 28) * 0.8) : 0;
          return (
            <div key={id} data-motion className="absolute left-0" style={{
              top: u(box.top), height: u(box.h), width: u(W),
              transform: `translateX(${u(x)})`,
              opacity: gone ? 0 : 1,
              transition: gone || arriving ? "none" : [xMove, t(["top", "height"], layoutRole)].join(", "),
            }}>
              <Liquid radius={22} className="h-full w-full overflow-hidden" style={{
                transform: `translateY(${u(lift)}) scale(${gone || arriving ? 0.001 : box.scale})`,
                transition: gone || arriving ? "none" : t("transform", place && place.index === 0 && !s.open ? "reveal" : layoutRole),
              }}>
                <Face id={id} shown={shown} />
              </Liquid>
            </div>
          );
        })}
      </LiquidGroup>
    </div>
  );
}
