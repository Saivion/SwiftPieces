"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { font, ground, signal } from "./palette";

/*
 * Spotlight Tour: plain placeholders (a search capsule, three rows, a round add button), then the tour
 * over them. The scrim fades in as the cutout closes onto the add button and a red ring draws around it,
 * with the callout above reading 1 of 3. Next dips, the cutout springs up to the search capsule and the
 * callout flips below it; Next again, it morphs into a circle on the first row's pin; Done, and the
 * scrim fades away. Sizes are authored in px against the 560 x 420 docs stage and converted to `cqw`.
 */

/** Stage px (560 wide) to container units. */
const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

type Stop = "add" | "search" | "pin";
type Beat = {
  /** The stop the tour shows; `null` is the resting screen, "out" the tour closing. */
  stop: Stop | null | "out";
  /** The callout button pressed during this beat (it dips). */
  press?: "next" | "done";
  /** Where a finger rests during the beat, in stage px (560 x 420), for the launch video. */
  finger?: { x: number; y: number };
  ms: number;
};

/** The storyboard, about 8 seconds a loop. The launch video follows the same beats. */
const STORYBOARD: readonly Beat[] = [
  { stop: null, ms: 1200 }, // Rest: the placeholders, nothing dimmed.
  { stop: "add", ms: 1900 }, // Scrim in, the cutout closes onto the add button, the ring draws in, callout above: 1 of 3.
  { stop: "add", press: "next", finger: { x: 492, y: 278 }, ms: 240 }, // Next dips.
  { stop: "search", ms: 1700 }, // The cutout springs up to the search capsule; the callout travels and flips below: 2 of 3.
  { stop: "search", press: "next", finger: { x: 378, y: 210 }, ms: 240 }, // Next dips.
  { stop: "pin", ms: 1700 }, // It morphs into a circle on the first row's pin: 3 of 3, Done, no Skip.
  { stop: "pin", press: "done", finger: { x: 492, y: 267 }, ms: 240 }, // Done dips.
  { stop: "out", ms: 760 }, // The ring fades, the cutout opens up and the scrim fades out.
];
/** Under reduced motion the preview holds this beat: the first stop, fully drawn. */
const HOLD = 1;

const STOPS: Stop[] = ["add", "search", "pin"];
type Rect = { x: number; y: number; w: number; h: number; r: number };
const circle = (cx: number, cy: number, r: number): Rect => ({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, r });
const open = (h: Rect, by: number): Rect => ({ x: h.x - by, y: h.y - by, w: h.w + by * 2, h: h.h + by * 2, r: h.r + by });

/** The cutouts: the target plus 7 px of padding (a circle, a capsule, a circle). */
const HOLES: Record<Stop, Rect> = {
  add: circle(464, 356, 33),
  search: { x: 63, y: 23, w: 434, h: 58, r: 29 },
  pin: circle(461, 116, 22),
};
const CARD_W = 300;
const CARD_H = 142;
/** Where the callout sits for each stop (inside 16 px margins) and where its nub points. */
const CARDS: Record<Stop, { x: number; y: number; below: boolean; nub: number }> = {
  add: { x: 244, y: 165, below: false, nub: 464 },
  search: { x: 130, y: 97, below: true, nub: 280 },
  pin: { x: 244, y: 154, below: true, nub: 461 },
};
const COPY: Record<Stop, { title: string; message: string; symbol?: boolean }> = {
  add: { title: "Start a note", message: "Tap here to write something new.", symbol: true },
  search: { title: "Find it fast", message: "Search every note by title, tag or person." },
  pin: { title: "Keep it on top", message: "Pin a note and it stays first in the list." },
};

const SCRIM = "rgba(8, 8, 8, 0.5)";
const morph = "cubic-bezier(0.3, 1.15, 0.5, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

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

/** Walks the storyboard; each beat holds for `ms`, then loops. Holds `HOLD` under reduced motion. */
function useSteps(steps: readonly Beat[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) {
      setI(HOLD);
      return;
    }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return { beat: steps[reduced ? HOLD : i], reduced };
}

/** A rounded rectangle path that starts at the top centre and runs clockwise, so the ring draws in from the top. */
function ringPath({ x, y, w, h, r }: Rect) {
  const R = Math.min(r, w / 2, h / 2);
  return `M ${x + w / 2} ${y} H ${x + w - R} A ${R} ${R} 0 0 1 ${x + w} ${y + R} V ${y + h - R} A ${R} ${R} 0 0 1 ${x + w - R} ${y + h} H ${x + R} A ${R} ${R} 0 0 1 ${x} ${y + h - R} V ${y + R} A ${R} ${R} 0 0 1 ${x + R} ${y} Z`;
}

function Glyph({ d, size, stroke = 2.2, style }: { d: string; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

const G = {
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.6-4.6",
  plus: "M12 5v14M5 12h14",
  pin: "M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z",
  compose: "M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z",
} as const;

const abs = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(h) });
const bar = (w: number, color: string): CSSProperties => ({ width: u(w), height: u(7), borderRadius: u(4), background: color });

/** The things the tour points at: neutral placeholders, no copy. */
function Placeholders() {
  return (
    <>
      <div style={{ ...abs(70, 30, 420, 44), borderRadius: u(22), background: ground.field, display: "flex", alignItems: "center", gap: u(10), paddingLeft: u(16), boxSizing: "border-box", color: ground.muted }}>
        <Glyph d={G.search} size={16} stroke={2.6} />
        <span style={bar(96, ground.control)} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...abs(70, 88 + i * 64, 420, 56), borderRadius: u(18), background: ground.surface, display: "flex", alignItems: "center", gap: u(12), padding: `0 ${u(14)} 0 ${u(12)}`, boxSizing: "border-box" }}>
          <span style={{ width: u(32), height: u(32), borderRadius: "50%", background: ground.field, flexShrink: 0 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: u(7), flex: 1 }}>
            <span style={bar(128, ground.control)} />
            <span style={bar(84, ground.field)} />
          </span>
          <span style={{ width: u(30), height: u(30), borderRadius: "50%", background: ground.field, color: ground.muted, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Glyph d={G.pin} size={14} stroke={2.2} />
          </span>
        </div>
      ))}
      <div style={{ ...abs(438, 330, 52, 52), borderRadius: "50%", background: ground.text, color: ground.bg, display: "grid", placeItems: "center" }}>
        <Glyph d={G.plus} size={22} stroke={2.8} />
      </div>
    </>
  );
}

function Nub({ up, x, shown }: { up: boolean; x: number; shown: boolean }) {
  return (
    <svg
      aria-hidden
      data-motion
      viewBox="0 0 20 9"
      style={{
        position: "absolute", left: u(x - 10), width: u(20), height: u(9), ...(up ? { top: u(-8) } : { bottom: u(-8) }),
        opacity: shown ? 1 : 0, transform: up ? "none" : "scaleY(-1)", transition: `opacity .2s, left .55s ${morph}`,
      }}
    >
      <path d="M0 9 L7.6 1.6 Q10 -0.4 12.4 1.6 L20 9 Z" fill={ground.surface} />
    </svg>
  );
}

function Callout({ stop, press, shown }: { stop: Stop; press?: Beat["press"]; shown: boolean }) {
  const card = CARDS[stop];
  const copy = COPY[stop];
  const index = STOPS.indexOf(stop);
  const last = index === STOPS.length - 1;
  return (
    <div
      data-motion
      style={{
        ...abs(card.x, card.y, CARD_W, CARD_H), boxSizing: "border-box", borderRadius: u(24), background: ground.surface,
        boxShadow: "0 1.6cqw 4cqw rgba(0,0,0,0.18)", padding: `${u(14)} ${u(16)} ${u(11)}`, display: "flex", flexDirection: "column",
        opacity: shown ? 1 : 0, transform: shown ? "none" : "scale(.95)", transformOrigin: `${(((card.nub - card.x) / CARD_W) * 100).toFixed(1)}% ${card.below ? "0%" : "100%"}`,
        transition: `left .55s ${morph}, top .55s ${morph}, opacity .3s, transform .45s ${ease}`,
      }}
    >
      <Nub up x={card.nub - card.x} shown={card.below} />
      <Nub up={false} x={card.nub - card.x} shown={!card.below} />
      <div key={stop} data-motion style={{ display: "flex", gap: u(11), flex: 1, animation: "st-text .24s ease-out .12s both" }}>
        {copy.symbol ? (
          <span style={{ width: u(34), height: u(34), borderRadius: u(10), background: ground.control, color: ground.text, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Glyph d={G.compose} size={16} stroke={2.2} />
          </span>
        ) : null}
        <span style={{ display: "flex", flexDirection: "column", gap: u(3), minWidth: 0 }}>
          <span style={{ fontSize: u(10.5), fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{index + 1} of {STOPS.length}</span>
          <span style={{ fontSize: u(19), fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: ground.text }}>{copy.title}</span>
          <span style={{ fontSize: u(13.5), lineHeight: 1.35, color: ground.muted }}>{copy.message}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: u(4) }}>
        <span style={{ display: "flex", gap: u(5), flex: 1 }}>
          {STOPS.map((s, i) => (
            <span key={s} data-motion style={{ height: u(6), width: u(i === index ? 18 : 6), borderRadius: u(3), background: i === index ? signal.fill : ground.control, transition: `width .4s ${ease}, background-color .3s` }} />
          ))}
        </span>
        <span style={{ fontSize: u(13.5), fontWeight: 600, color: ground.muted, padding: `0 ${u(10)}`, opacity: last ? 0 : 1, transition: "opacity .2s" }}>Skip</span>
        <span
          data-motion
          style={{
            height: u(34), padding: `0 ${u(18)}`, borderRadius: u(17), background: signal.fill, color: signal.on, display: "grid", placeItems: "center",
            fontSize: u(13.5), fontWeight: 700, transform: press ? "scale(.94)" : "none", transition: `transform .25s ${ease}`,
          }}
        >
          {last ? "Done" : "Next"}
        </span>
      </div>
    </div>
  );
}

export function SpotlightTourPreview() {
  const { beat } = useSteps(STORYBOARD);
  const touring = beat.stop !== null && beat.stop !== "out";
  const stop: Stop = beat.stop === null ? "add" : beat.stop === "out" ? "pin" : beat.stop;
  // Resting and closing, the cutout is opened wide around the stop, so presenting closes it in like an iris.
  const hole = touring ? HOLES[stop] : open(HOLES[stop], 46);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack }}>
      <style>{"@keyframes st-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes st-text{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}"}</style>
      <Placeholders />
      {/* The scrim: a spread shadow around the cutout, so the cutout morphs with plain CSS transitions. */}
      <div
        data-motion
        aria-hidden
        style={{
          ...abs(hole.x, hole.y, hole.w, hole.h), borderRadius: u(hole.r), boxShadow: `0 0 0 ${u(1400)} ${SCRIM}`, opacity: touring ? 1 : 0,
          transition: `left .55s ${morph}, top .55s ${morph}, width .55s ${morph}, height .55s ${morph}, border-radius .55s ${morph}, opacity ${touring ? ".35s" : ".45s"} ease`,
        }}
      />
      <svg aria-hidden viewBox="0 0 560 420" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", opacity: touring ? 1 : 0, transition: "opacity .15s" }}>
        {touring ? (
          <path
            key={stop}
            data-motion
            d={ringPath(open(HOLES[stop], 1))}
            pathLength={1}
            fill="none"
            stroke={signal.fill}
            strokeWidth={2}
            strokeDasharray="1 1"
            strokeDashoffset={0}
            style={{ animation: "st-draw .45s ease-out .34s both" }}
          />
        ) : null}
      </svg>
      <Callout stop={stop} press={beat.press} shown={touring} />
    </div>
  );
}
