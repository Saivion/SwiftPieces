"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { font, ground, signal } from "./palette";
import { curve, follow, pressScale, reduced, roles, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Spotlight Tour: plain placeholders (a search capsule, three rows, a round add button), then the tour
 * over them. The scrim irises calmly onto the add button, the glass callout follows out of it reading 1 of 3,
 * and the red ring draws once the cutout has landed; Skip and Next bud out of the panel on its far side
 * from the target. Next sinks; the cutout glides to the search capsule without overshoot and the callout
 * trails it like a cue card, landing a beat later with a little give while its words dip out and back, and
 * the pair flows round to the panel's other side. Next again, it morphs into a circle on the first row's
 * pin, Skip melts into Next and Next morphs into Done; Done, and everything leaves together, quicker than
 * it came. Motion uses the PieceMotion roles (piece-motion.ts) and the glass is piece-liquid.tsx, one
 * point to one stage px. Sizes are authored in px against the 560 x 420 docs stage and converted to `cqw`.
 */

/** Stage px (560 wide) to container units. */
const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

type Stop = "add" | "search" | "pin";
type Beat = {
  /** The stop the tour shows; `null` is the resting screen, "out" the tour closing. */
  stop: Stop | null | "out";
  /** The callout button pressed during this beat (it dips). */
  press?: "next" | "done";
  /** `false` while Skip and Next are still inside the panel: they bud out 320 ms after the callout arrives, as in Swift. */
  pair?: false;
  /** Where a finger rests during the beat, in stage px (560 x 420), for the launch video. */
  finger?: { x: number; y: number };
  ms: number;
};

/** The storyboard, about 8 seconds a loop. The launch video follows the same beats. */
const STORYBOARD: readonly Beat[] = [
  { stop: null, ms: 1200 }, // Rest: the placeholders, nothing dimmed.
  { stop: "add", pair: false, ms: 320 }, // Scrim in, the cutout irises onto the add button, the callout above it: 1 of 3.
  { stop: "add", ms: 1580 }, // Skip and Next bud out of the panel's top, away from the target, then the ring draws.
  { stop: "add", press: "next", finger: { x: 511, y: 152 }, ms: 240 }, // Next sinks.
  { stop: "search", ms: 1700 }, // The cutout glides up to the search capsule; the callout trails and flips below, the pair flowing under it: 2 of 3.
  { stop: "search", press: "next", finger: { x: 397, y: 252 }, ms: 240 }, // Next sinks.
  { stop: "pin", ms: 1700 }, // It morphs into a circle on the first row's pin: 3 of 3, Skip melts into Next, which morphs into Done.
  { stop: "pin", press: "done", finger: { x: 511, y: 309 }, ms: 240 }, // Done sinks.
  { stop: "out", ms: 760 }, // The ring fades, the cutout opens up and the scrim fades out, all on dismiss.
];
/** Under reduced motion the preview holds this beat: the first stop, fully drawn, the pair out. */
const HOLD = 2;

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
/** The glass panel, and the pair of capsules resting apart from it on its far side from the target. */
const PANEL_H = 112;
const PAIR_H = 34, NEXT_W = 66, SKIP_W = 58;
const CARD_H = PANEL_H + liquid.apart + PAIR_H;
/** Where the callout sits for each stop (inside 16 px margins, its panel 16 px from the ring) and where its nub points. */
const CARDS: Record<Stop, { x: number; y: number; below: boolean; nub: number }> = {
  add: { x: 244, y: 135, below: false, nub: 464 },
  search: { x: 130, y: 97, below: true, nub: 280 },
  pin: { x: 244, y: 154, below: true, nub: 461 },
};
/** A capsule's home from the panel: just inside the panel's nearest edge, shrunk, where the two are one shape. */
const PAIR_HOME = PAIR_H / 2 + liquid.apart + (PAIR_H * liquid.homeScale) / 2;
/** Skip's home inside Next on the last stop: just inside Next's leading end. */
const SKIP_HOME = SKIP_W / 2 + liquid.apart + (SKIP_W * liquid.homeScale) / 2;
const COPY: Record<Stop, { title: string; message: string; symbol?: boolean }> = {
  add: { title: "Start a note", message: "Tap here to write something new.", symbol: true },
  search: { title: "Find it fast", message: "Search every note by title, tag or person." },
  pin: { title: "Keep it on top", message: "Pin a note and it stays first in the list." },
};

const SCRIM = "rgba(8, 8, 8, 0.5)";
/** How far out the cutout starts when the tour irises in. */
const IRIS = 46;
/** Next sinks about 2.5 px per edge. */
const NEXT_PRESS = pressScale(NEXT_W, PAIR_H);

/** The tour walks the stops in order, so each stop is reached from the one before it; `null` for the first. */
const cameFrom = (s: Stop): Stop | null => STOPS[STOPS.indexOf(s) - 1] ?? null;

/** What the tour is doing this beat: resting, presenting its first stop, moving between stops, or leaving. */
type Phase = "rest" | "in" | "move" | "out";

/** How long a spring with no bounce and this response takes to bring a move of `travel` px within 2 px of its stop. */
function landing(travel: number, response: number, tolerance = 2) {
  if (travel <= tolerance) return 0;
  const left = tolerance / travel;
  let x = -Math.log(left);
  for (let i = 0; i < 4; i++) x = Math.log((1 + x) / left);
  return (x * response) / (2 * Math.PI);
}

/** The ring waits until the cutout is within 2 px of it, never before the old ring has cleared at 150ms. */
function ringDelay(to: Stop) {
  const from = cameFrom(to);
  // Presenting: the iris closes in on the reveal spring, whose slight bounce only lands it sooner.
  if (!from) return landing(IRIS, roles.reveal.duration) * 1000;
  const a = HOLES[from], b = HOLES[to];
  const travel = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h));
  return Math.max(landing(travel, roles.value.duration), 0.15) * 1000;
}

/** The cue card trails the light: the reveal spring two ranks looser, so it lands a beat after the cutout. */
const TRAIL = follow("reveal", 2);

/** Stop to stop the trail keeps its give, but overshoots by at most 6 px, so the nub never reaches the new ring. */
function stopTrail(to: Stop): Spring {
  const from = cameFrom(to);
  if (!from) return TRAIL;
  const travel = Math.max(Math.abs(CARDS[from].x - CARDS[to].x), Math.abs(CARDS[from].y - CARDS[to].y));
  const l = Math.log(travel / 6);
  const bounce = travel > 6 ? 1 - l / Math.sqrt(Math.PI * Math.PI + l * l) : 1;
  return { duration: TRAIL.duration, bounce: Math.min(TRAIL.bounce, bounce) };
}

/**
 * The stop whose words are on the card. A change of stop dips the old words out before the new ones come back,
 * so they never smear while the card travels; the quick fades are deliberate, as in Swift.
 */
function useDip(stop: Stop, live: boolean) {
  const [onCard, setOnCard] = useState(stop);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (stop === onCard) return;
    if (!live || reduced()) {
      setOnCard(stop);
      setVisible(true);
      return;
    }
    setVisible(false);
    const id = setTimeout(() => {
      setOnCard(stop);
      setVisible(true);
    }, 100);
    return () => clearTimeout(id);
  }, [stop, onCard, live]);
  return { onCard, visible };
}

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

/**
 * The pointer on the panel's facing edge: a glass shape in the panel's group, so the goo melts it into the panel as one
 * pointer. It grows out of the edge and shrinks back into it.
 */
function Nub({ up, x, y, shown, motion }: { up: boolean; x: number; y: number; shown: boolean; motion: string }) {
  return (
    <Liquid radius={0} style={{
      position: "absolute", left: 0, top: 0, width: u(20), height: u(9), clipPath: up ? "polygon(0% 100%, 42% 12%, 50% 0%, 58% 12%, 100% 100%)" : "polygon(0% 0%, 42% 88%, 50% 100%, 58% 88%, 100% 0%)",
      transformOrigin: up ? "50% 100%" : "50% 0%", transform: `translate(${u(x - 10)}, ${u(y)}) scale(${shown ? 1 : 0})`, transition: motion,
    }} />
  );
}

/**
 * True for 400 ms after the pair changes side. Its glass melts through the panel's on the trail and out the other side,
 * so its words leave at once and come back as it lands, never crossing the panel's, and Next drops its tint meanwhile.
 */
function useFlowing(side: boolean, live: boolean) {
  const [flowing, setFlowing] = useState(false);
  const last = useRef(side);
  useEffect(() => {
    if (last.current === side) return;
    last.current = side;
    if (!live || reduced()) return;
    setFlowing(true);
    const id = setTimeout(() => setFlowing(false), 400);
    return () => clearTimeout(id);
  }, [side, live]);
  return flowing;
}

function Callout({ stop, press, phase, pairOut }: { stop: Stop; press?: Beat["press"]; phase: Phase; pairOut: boolean }) {
  const card = CARDS[stop];
  const hole = HOLES[stop];
  const index = STOPS.indexOf(stop);
  const last = index === STOPS.length - 1;
  const shown = phase === "in" || phase === "move";
  // The words lag the stop by one dip; the dots, Next or Done and Skip follow the stop at once, as in Swift.
  const text = useDip(stop, shown);
  const copy = COPY[text.onCard];
  const trail = phase === "move" ? stopTrail(stop) : TRAIL;
  // Resting, the card jumps to the first stop unseen; presenting and stop to stop it trails; it leaves on dismiss.
  const motion = phase === "rest" ? "none" : t(["transform", "opacity"], phase === "out" ? "dismiss" : trail);
  const nubMotion = phase === "move" ? t("transform", trail) : "none";
  // The panel faces the target; the pair sits on its far side and flows round it when the callout flips.
  const pairOnTop = !card.below;
  const panelTop = pairOnTop ? PAIR_H + liquid.apart : 0;
  const pairTop = pairOnTop ? 0 : PANEL_H + liquid.apart;
  const flow = phase === "move" ? t("top", trail) : "none";
  const flowing = useFlowing(pairOnTop, phase === "move");
  // Home from the panel is toward it; Skip's home on the last stop is inside Next, and back in the panel once the
  // tour has closed, ready to bud again.
  const fromPanel: [number, number] = [0, pairOnTop ? PAIR_HOME : -PAIR_HOME];
  const skipOut = pairOut && !last;
  const skipHome: [number, number] = last && phase !== "rest" ? [SKIP_HOME, 0] : fromPanel;
  return (
    <div
      data-motion
      style={{
        ...abs(0, 0, CARD_W, CARD_H),
        // It comes out of the target and goes back into it: the scale is anchored on the target's centre.
        opacity: shown ? 1 : 0, transform: `translate(${u(card.x)}, ${u(card.y)}) scale(${shown ? 1 : 0.94})`,
        transformOrigin: `${u(hole.x + hole.w / 2 - card.x)} ${u(hole.y + hole.h / 2 - card.y)}`, transition: motion,
      }}
    >
      <LiquidGroup unit={u(1)} axis="both" style={{ width: "100%", height: "100%" }}>
        <Nub up x={card.nub - card.x} y={panelTop - 8} shown={card.below} motion={nubMotion} />
        <Nub up={false} x={card.nub - card.x} y={panelTop + PANEL_H - 1} shown={!card.below} motion={nubMotion} />
        {/* The pair: separate actions resting apart, on wrappers that carry the flow so each capsule keeps its own bud. */}
        <span data-motion style={{ position: "absolute", left: u(CARD_W - NEXT_W - liquid.apart - SKIP_W), top: u(pairTop), width: u(SKIP_W), height: u(PAIR_H), transition: flow }}>
          <Liquid bud={{ out: skipOut, home: skipHome }} className="flex h-full w-full items-center justify-center" style={{ fontSize: u(13.5), fontWeight: 600, color: ground.muted }}>
            <BudContent out={skipOut && !flowing}>Skip</BudContent>
          </Liquid>
        </span>
        <span data-motion style={{ position: "absolute", left: u(CARD_W - NEXT_W), top: u(pairTop), width: u(NEXT_W), height: u(PAIR_H), zIndex: 1, transition: flow }}>
          <span data-motion className="flex h-full w-full" style={{ transform: press ? `scale(${NEXT_PRESS})` : "none", transition: t("transform", press ? "press" : "release") }}>
            <Liquid tint={pairOut && !flowing ? signal.fill : undefined} bud={{ out: pairOut, home: fromPanel }} className="flex h-full w-full items-center justify-center" style={{ fontSize: u(13.5), fontWeight: 600, color: signal.on }}>
              <BudContent out={pairOut && !flowing}><MorphText text={last ? "Done" : "Next"} /></BudContent>
            </Liquid>
          </span>
        </span>
        {/* Above the pair, so a capsule at home sits under the panel. */}
        <span data-motion style={{ position: "absolute", left: 0, top: u(panelTop), width: u(CARD_W), height: u(PANEL_H), zIndex: 2, transition: flow }}>
          <Liquid radius={24} className="flex h-full w-full flex-col" style={{ boxSizing: "border-box", padding: `${u(14)} ${u(16)}` }}>
            <div
              data-motion
              style={{ display: "flex", gap: u(11), flex: 1, opacity: text.visible ? 1 : 0, transition: text.visible ? "opacity 220ms ease-out" : "opacity 100ms ease-in" }}
            >
              {copy.symbol ? (
                <span style={{ width: u(34), height: u(34), borderRadius: u(10), background: ground.control, color: ground.text, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Glyph d={G.compose} size={16} stroke={2.2} />
                </span>
              ) : null}
              <span style={{ display: "flex", flexDirection: "column", gap: u(3), minWidth: 0 }}>
                <span style={{ fontSize: u(10.5), fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{STOPS.indexOf(text.onCard) + 1} of {STOPS.length}</span>
                <span style={{ fontSize: u(19), fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: ground.text }}>{copy.title}</span>
                <span style={{ fontSize: u(13.5), fontWeight: 600, lineHeight: 1.35, color: ground.muted }}>{copy.message}</span>
              </span>
            </div>
            {/* The dots ride the card's trail, as in Swift, so the new one fills and grows as the card lands, not before. */}
            <span style={{ display: "flex", gap: u(5) }}>
              {STOPS.map((s, i) => (
                <span
                  key={s}
                  data-motion
                  style={{ height: u(6), width: u(i === index ? 18 : 6), borderRadius: u(3), background: i === index ? signal.fill : ground.control, transition: t(["width", "background-color"], trail) }}
                />
              ))}
            </span>
          </Liquid>
        </span>
      </LiquidGroup>
    </div>
  );
}

export function SpotlightTourPreview() {
  const { beat } = useSteps(STORYBOARD);
  const touring = beat.stop !== null && beat.stop !== "out";
  const stop: Stop = beat.stop === null ? "add" : beat.stop === "out" ? "pin" : beat.stop;
  const from = cameFrom(stop);
  const phase: Phase = beat.stop === null ? "rest" : beat.stop === "out" ? "out" : from ? "move" : "in";
  // Resting and closing, the cutout is opened wide around the stop, so presenting closes it in like an iris.
  const hole = touring ? HOLES[stop] : open(HOLES[stop], IRIS);
  // The cutout leads. It irises in calmly, glides stop to stop without overshoot so its corners never wobble and it
  // never uncovers the controls beside its target, and leaves on dismiss. Resting, it jumps back unseen.
  const holeMotion = phase === "rest" ? "none" : t(["left", "top", "width", "height", "border-radius", "opacity"], phase === "in" ? "reveal" : phase === "out" ? "dismiss" : "value");
  const ring = curve("reveal");
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack }}>
      <style>{"@keyframes st-draw{from{stroke-dashoffset:1.5}to{stroke-dashoffset:.5}}@keyframes st-fade{from{opacity:1}to{opacity:0}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}"}</style>
      <Placeholders />
      {/* The scrim: a spread shadow around the cutout, so the cutout morphs with plain CSS transitions. */}
      <div
        data-motion
        aria-hidden
        style={{ ...abs(hole.x, hole.y, hole.w, hole.h), borderRadius: u(hole.r), boxShadow: `0 0 0 ${u(1400)} ${SCRIM}`, opacity: touring ? 1 : 0, transition: holeMotion }}
      />
      {/* A quick, deliberate fade for the ring: on exit it clears just ahead of the scrim. */}
      <svg aria-hidden viewBox="0 0 560 420" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", opacity: touring ? 1 : 0, transition: "opacity 150ms ease-out" }}>
        {/* The ring a step change leaves behind is all but gone by the time the cutout is halfway to its next stop. */}
        {phase === "move" && from ? (
          <path key={`leave-${from}`} data-motion d={ringPath(open(HOLES[from], 1))} pathLength={1} fill="none" stroke={signal.fill} strokeWidth={2} strokeDasharray="1.5 1.5" strokeDashoffset={0.5} style={{ animation: "st-fade 150ms ease-out both" }} />
        ) : null}
        {/* Draws in from the top on the reveal spring once the cutout has landed. A dash longer than the path keeps the
            spring's slight overshoot from opening a gap at the start; with no animation it is simply drawn. */}
        {beat.stop !== null ? (
          <path
            key={stop}
            data-motion
            d={ringPath(open(HOLES[stop], 1))}
            pathLength={1}
            fill="none"
            stroke={signal.fill}
            strokeWidth={2}
            strokeDasharray="1.5 1.5"
            strokeDashoffset={0.5}
            style={{ animation: `st-draw ${ring.ms}ms ${ring.easing} ${Math.round(ringDelay(stop))}ms both` }}
          />
        ) : null}
      </svg>
      {/* The pair stays out as the tour closes, so the callout leaves in one piece. */}
      <Callout stop={stop} press={beat.press} phase={phase} pairOut={beat.stop !== null && beat.pair !== false} />
    </div>
  );
}
