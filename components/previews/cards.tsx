"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, shade } from "./palette";
import { follow, reduced, roles, springValue, type Role, type Spring } from "./piece-motion";
import { BudContent, glass, Liquid, LiquidGroup } from "./piece-liquid";

/* Cards: FlipCard, ParallaxCard, MotionCard, SwipeDeck. Each preview draws the component and nothing
   else (FREE-V2.1): no captions, no headers, no buttons beside it. The stage is 4:3, so 100cqw wide
   and 75cqw tall; 1 iOS point is 0.19cqw. Each piece scales its own points so it fills the stage.
   The cards are content; their captions, badges and hints are liquid glass (LIQUID_GLASS.md), drawn with
   piece-liquid. All text is semibold. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
/** Point helper scaled so the component fills the stage without redrawing it at new sizes. */
const units = (s: number) => (n: number) => p(n * s);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);
const smoothstep = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x); };

/** A PieceMotion spring going from 0 toward 1, `t` seconds after it starts, leaving at `v0` whole distances per
 *  second (0 is from rest). The loops are frame-driven, so they read the springs directly instead of transitions. */
function sprung(spring: Role | Spring, t: number, v0 = 0): number {
  if (t <= 0) return 0;
  const s = typeof spring === "string" ? roles[spring] : spring;
  if (!v0) return springValue(s, t);
  const w = (2 * Math.PI) / s.duration, z = 1 - Math.min(Math.max(s.bounce, 0), 0.99);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + (w - v0) * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w - v0) / wd) * Math.sin(wd * t));
}

/** Swift's `settle(velocity:from:to:)`: a release's speed as whole distances per second, capped near the spring's
 *  own frequency so a hard flick adds give, not a slingshot. */
function carry(spring: Spring, velocity: number, distance: number): number {
  if (Math.abs(distance) < 1e-6) return 0;
  const cap = ((2 * Math.PI) / spring.duration) * 1.5;
  return clamp(velocity / distance, -cap, cap);
}

/** A press held from `down` to `up`: in on the press spring, out on the release spring from wherever it got to. */
function held(t: number, down: number, up: number, inRole: Role | Spring = "press", outRole: Role | Spring = "release"): number {
  return t < up ? sprung(inRole, t - down) : sprung(inRole, up - down) * (1 - sprung(outRole, t - up));
}

/** Calls `frame` with elapsed seconds on every animation frame. Under Reduce Motion it draws one still frame at `rest`. */
function useRaf(frame: (t: number, still: boolean) => void, rest = 0) {
  useEffect(() => {
    if (reduced()) { frame(rest, true); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { frame(Math.max(0, now - start) / 1000, false); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

const meta = (u: (n: number) => string = p): CSSProperties => ({ fontSize: u(11), fontWeight: 600, letterSpacing: "0.09em", lineHeight: 1 });
const mono = (u: (n: number) => string = p): CSSProperties => ({ fontFamily: font.mono, fontSize: u(12), fontWeight: 600, lineHeight: 1 });
const display = (size: number, tracking: string = font.displayTracking, u: (n: number) => string = p): CSSProperties => ({ fontSize: u(size), fontWeight: font.displayWeight, letterSpacing: tracking, lineHeight: 1.02 });
const dim: CSSProperties = { opacity: 0.62 };
/** Light glass over a bright surface, as Liquid Glass reads there in either appearance: mostly white, tinged with what
 *  it sits on. The web glass is opaque (the goo needs it), so the tinge stands in for the refraction. */
const glassOver = (surface: string, white = 60) => `color-mix(in srgb, #fff ${white}%, ${surface})`;

function Glyph({ d, size, fill = false, u = p }: { d: string; size: number; fill?: boolean; u?: (n: number) => string }) {
  return <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size) }} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const G = {
  x: "M6 6l12 12M18 6L6 18",
  heart: "M12 20.5S3 15.4 3 9a4.5 4.5 0 0 1 9-1.6A4.5 4.5 0 0 1 21 9c0 6.4-9 11.5-9 11.5z",
  bookmark: "M6 3h12v18l-6-4.5L6 21z",
  arrow: "M7 17L17 7M9 7h8v8",
};

// MARK: Flip Card

const flipU = units(1.42);
/** The card's weight on its axle, from FlipCard.swift: a half turn swings about 8 degrees past its face and settles
 *  back. A release brings the finger's speed; a tap turns the whole way from rest, so it takes longer. */
const RELEASE_TURN: Spring = { duration: 0.55, bounce: 0.3 };
const TAP_TURN: Spring = { duration: 0.7, bounce: 0.3 };
const FLIP_W = 300, FLIP_BEAT = 3.4;
/** The drag beat's finger, in degrees: a slow scrub from rest to 40, then a flick that lets go at 80 turning 800 deg/s,
 *  about as fast as the landing would be by then on its own, so the card flows straight on instead of launching. */
const SCRUB = 1.2, PULL = 0.36, PULLED = 40, FLICKED = 80, LEAVE = 800;
const PULL_SPEED = (2 * PULLED) / PULL, FLICK = (2 * (FLICKED - PULLED)) / (PULL_SPEED + LEAVE), FLIP_LET_GO = SCRUB + PULL + FLICK;
/** Degrees turned under the finger `s` seconds into the scrub: steady acceleration, then a steeper flick ramp. */
const scrubbed = (s: number) =>
  s <= 0 ? 0 : s < PULL ? PULLED * (s / PULL) ** 2 : PULLED + PULL_SPEED * (s - PULL) + ((LEAVE - PULL_SPEED) / (2 * FLICK)) * (s - PULL) ** 2;

/** A face badge: a light chip drawn as part of the face, so it turns with it (glass can't follow a half turn in 3D).
 *  12pt in and 28pt tall, concentric with the 26pt corners, its text in line with the face's. */
function FaceChip({ u, children, style }: { u: (n: number) => string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="inline-flex items-center" style={{ height: u(28), paddingInline: u(10), borderRadius: 9999, background: "rgba(255,255,255,.42)", boxShadow: `inset 0 0 0 ${u(0.5)} rgba(255,255,255,.6)`, ...style }}>
      {children}
    </span>
  );
}

export function FlipCardPreview() {
  const u = flipU;
  const lift = useRef<HTMLDivElement>(null), front = useRef<HTMLDivElement>(null), back = useRef<HTMLDivElement>(null), hint = useRef<HTMLDivElement>(null);
  useRaf((t) => {
    // Two flips a loop, each from rest. First a drag: touch-down sinks the card toward the finger, the scrub turns it
    // directly under the finger while the shadow lifts, and the flick carries its speed into the landing. Then a tap:
    // a press that lets go with give and a slower turn from rest. The angle accumulates.
    const n = Math.floor(t / FLIP_BEAT), q = t - n * FLIP_BEAT, DOWN = 0.9;
    let angle = n * 180, press = 0, hold = 0, fx = 0.5, fy = 0.5;
    if (n % 2 === 0) {
      fx = 0.3; fy = 0.6;
      // The scrub takes over once the finger has moved 8pt: the press lets go and the hold picks the card up.
      const TAKE = SCRUB + PULL * Math.sqrt(((8 / FLIP_W) * 180) / PULLED);
      press = held(q, DOWN, TAKE);
      hold = q < FLIP_LET_GO ? sprung("press", q - TAKE) : sprung("press", FLIP_LET_GO - TAKE) * (1 - sprung(RELEASE_TURN, q - FLIP_LET_GO));
      if (q < FLIP_LET_GO) angle += scrubbed(q - SCRUB);
      else angle += FLICKED + (180 - FLICKED) * sprung(RELEASE_TURN, q - FLIP_LET_GO, carry(RELEASE_TURN, LEAVE, 180 - FLICKED));
    } else {
      fx = 0.64; fy = 0.42;
      const UP = 1.08;
      press = held(q, DOWN, UP);
      angle += 180 * sprung(TAP_TURN, q - UP);
    }
    const a = ((angle % 360) + 360) % 360, showsBack = a > 90 && a < 270;
    const edge = Math.sin((angle * Math.PI) / 180), turn = Math.abs(edge), up = Math.max(turn, hold * 0.35);
    // Touch-down tips the card toward the finger by up to 3 degrees at an edge.
    const tiltX = -(fy - 0.5) * 6 * press, tiltY = (fx - 0.5) * 6 * press;
    const lean = `perspective(${u(900)}) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${(1 + 0.06 * turn) * (1 - 0.03 * press)})`;
    if (lift.current) Object.assign(lift.current.style, {
      transform: lean,
      filter: `drop-shadow(0 ${u(1)} ${u(2)} ${shade(0.42 * (1 - up * 0.6))}) drop-shadow(${u(-edge * 18)} ${u(12 + up * 10)} ${u(16 + up * 18)} ${shade(0.42)})`,
    });
    const face = (el: HTMLDivElement | null, isBack: boolean) => el && Object.assign(el.style, {
      transform: `perspective(${u(900)}) rotateY(${isBack ? angle - 180 : angle}deg)`,
      opacity: showsBack === isBack ? "1" : "0",
      filter: `brightness(${1 - turn * 0.16})`,
    });
    face(front.current, false); face(back.current, true);
    // The flip hint stays flat on the axis, lifting and tipping with the card but never turning: its dot slides from
    // the front slot to the back slot with the turn and smears along the pill on the way. The glass takes the tinge
    // of whichever face is under it.
    const h = hint.current;
    if (h) {
      h.style.transform = lean;
      h.style.setProperty("--hint-glass", glassOver(showsBack ? blocks.sky : blocks.butter, 66));
      const side = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
      h.querySelectorAll<HTMLElement>("[data-hint-dot]").forEach((dot) => Object.assign(dot.style, {
        width: u(10 + 10 * turn), height: u(10 - 1.5 * turn),
        transform: `translate(-50%, -50%) translateX(${u(12 * (2 * side - 1))})`,
      }));
    }
  }, 0.5);
  const card: CSSProperties = { position: "absolute", inset: 0, borderRadius: u(26), padding: u(22), color: ink, display: "flex", flexDirection: "column", backfaceVisibility: "hidden" };
  return (
    <Stage>
      <div className="relative" style={{ width: u(300), height: u(200) }}>
        <div ref={lift} data-motion className="absolute inset-0">
          <div ref={front} data-motion style={{ ...card, background: blocks.butter }}>
            <div className="flex items-center justify-between" style={{ margin: `${u(-10)} ${u(-10)} 0` }}>
              <FaceChip u={u}><span style={meta(u)}>PORTUGUESE</span></FaceChip>
              <FaceChip u={u}><span style={mono(u)}>3 / 12</span></FaceChip>
            </div>
            <span style={{ ...display(46, "-0.04em", u), marginTop: "auto" }}>Saudade</span>
            <span style={{ fontSize: u(15), fontWeight: 600, marginTop: u(6), ...dim }}>noun · sow-DAH-jee</span>
          </div>
          <div ref={back} data-motion style={{ ...card, background: blocks.sky, opacity: 0 }}>
            <FaceChip u={u} style={{ alignSelf: "flex-start", margin: `${u(-10)} 0 0 ${u(-10)}` }}><span style={meta(u)}>MEANING</span></FaceChip>
            <span style={{ ...display(22, "-0.03em", u), marginTop: u(10), lineHeight: 1.12 }}>A deep longing for someone or something far away.</span>
            <span style={{ fontSize: u(15), fontWeight: 600, marginTop: "auto", ...dim }}>Often heard in fado songs</span>
          </div>
        </div>
        <div ref={hint} data-motion aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 flex justify-center" style={{ top: u(12) }}>
            <LiquidGroup unit={u(1)} lift={false}>
              <Liquid tint="var(--hint-glass)" className="relative" style={{ width: u(52), height: u(28) }}>
                {[-12, 12].map((x) => (
                  <span key={x} className="absolute rounded-full" style={{ left: "50%", top: "50%", width: u(6), height: u(6), background: ink, opacity: 0.22, transform: `translate(-50%, -50%) translateX(${u(x)})` }} />
                ))}
                <span data-hint-dot data-motion className="absolute rounded-full" style={{ left: "50%", top: "50%", width: u(10), height: u(10), background: blocks.tangerine, transform: `translate(-50%, -50%) translateX(${u(-12)})` }} />
              </Liquid>
            </LiquidGroup>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Parallax Card

const WALKS = [
  { name: "Alfama at dusk", word: "ALFAMA", facts: ["3.2 km", "1 h 10 min"], sky: blocks.sky, sun: blocks.tangerine },
  { name: "River to Belém", word: "BELÉM", facts: ["6.8 km", "2 h"], sky: blocks.sage, sun: blocks.butter },
  { name: "Graça viewpoints", word: "GRAÇA", facts: ["2.1 km", "45 min"], sky: blocks.lilac, sun: blocks.sky },
  { name: "Chiado bookshops", word: "CHIADO", facts: ["1.6 km", "40 min"], sky: blocks.tangerine, sun: blocks.sand },
];

const PARALLAX_SCALE = 1.28;
const parallaxU = units(PARALLAX_SCALE);
/** The Swift demo's scroll, `.smooth(duration: 1.4)`: no overshoot, so the list never scrolls past its content. */
const SCROLL: Spring = { duration: 1.4, bounce: 0 };

export function ParallaxCardPreview() {
  const u = parallaxU;
  const list = useRef<HTMLDivElement>(null);
  const H = 250, GAP = 14, TRAVEL = H * 0.25;
  useRaf((t) => {
    const el = list.current; if (!el?.parentElement) return;
    const unit = el.parentElement.clientWidth * 0.0019 * PARALLAX_SCALE; // px per iOS point
    const vh = el.parentElement.clientHeight / unit;
    const q = t % 7.2;
    // Scroll down to the third card, press it, scroll back up, rest. Each scroll leaves quickly and coasts in, as the
    // Swift demo's .smooth scroll does; the parallax layers are pure functions of it, so they never lag.
    const s = q < 4.4 ? sprung(SCROLL, q - 0.8) : 1 - sprung(SCROLL, q - 4.4);
    // The press lifts the card on the tight press spring and lets go with give; the arrow's bubble leans a rank behind
    // both ways, thinning the neck to the panel.
    const DOWN = 3.1, UP = 3.38;
    const press = held(q, DOWN, UP);
    const nudge = held(q, DOWN, UP, follow("press", 1), follow("release", 1));
    const scroll = s * (2 * (H + GAP) + H / 2 - vh / 2);
    el.style.transform = `translateY(${-scroll * unit}px)`;
    Array.from(el.querySelectorAll<HTMLElement>("[data-walk]")).forEach((card, i) => {
      const mid = i * (H + GAP) + H / 2 - scroll;
      const progress = clamp((mid - vh / 2) / ((vh + H) / 2), -1, 1);
      const [art, cap] = Array.from(card.children) as HTMLElement[];
      art.style.transform = `translateY(${-progress * TRAVEL * unit}px)`;
      cap.style.transform = `translateY(${(-progress * TRAVEL * unit) / 3}px)`;
      const l = i === 2 ? press : 0;
      card.style.transform = `scale(${1 + 0.02 * l})`;
      card.style.boxShadow = `0 ${(10 + 6 * l) * unit}px ${(16 + 10 * l) * unit * 2}px ${shade(0.36 + 0.2 * l)}`;
      const n = i === 2 ? nudge : 0;
      // Both copies of the bubble: the glass pass and the content pass move together.
      cap.querySelectorAll<HTMLElement>("[data-arrow]").forEach((arrow) => { arrow.style.transform = `translate(${2 * n * unit}px, ${-2 * n * unit}px)`; });
    });
  });
  return (
    <Stage style={{ justifyContent: "flex-start", alignItems: "stretch", overflow: "hidden", maskImage: "linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)" }}>
      <div ref={list} data-motion className="mx-auto flex flex-col" style={{ width: u(340), gap: u(GAP) }}>
        {WALKS.map((w, i) => (
          <div key={w.name} data-walk data-motion className="relative shrink-0 overflow-hidden" style={{ height: u(H), borderRadius: u(26) }}>
            <div data-motion aria-hidden className="absolute inset-x-0 overflow-hidden" style={{ top: u(-TRAVEL), height: u(H + TRAVEL * 2), background: w.sky }}>
              <span className="absolute rounded-full" style={{ width: u(190), height: u(190), left: u(186), top: u(36), background: w.sun }} />
              <span className="absolute whitespace-nowrap" style={{ left: u(-10), top: u(40), fontSize: u(128), fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1, color: ink }}>{w.word}</span>
            </div>
            <div data-motion className="absolute inset-x-0 bottom-0" style={{ padding: u(10) }}>
              {/* A glass panel, concentric with the card, and the arrow on a glass bubble resting joined to it, so a
                  liquid neck holds the two as one surface. Both are clear glass, untinted as in Swift, so the panel,
                  the neck and the bubble are one material and the picture shows through all three alike. */}
              <LiquidGroup unit={u(1)} style={{ color: ground.text }}>
                <div className="flex items-center" style={{ gap: u(6) }}>
                  <Liquid radius={16} className="min-w-0 flex-1" style={{ padding: u(16) }}>
                    <p style={{ ...meta(u), ...dim }}>WALK 0{i + 1}</p>
                    <p style={{ ...display(22, "-0.03em", u), marginTop: u(4) }}>{w.name}</p>
                    <p className="flex items-center" style={{ gap: u(6), marginTop: u(4), fontSize: u(15), fontWeight: 600, ...dim }}>{w.facts[0]}<span className="rounded-full" style={{ width: u(3), height: u(3), background: "currentColor" }} />{w.facts[1]}</p>
                  </Liquid>
                  <span data-arrow data-motion className="shrink-0">
                    <Liquid className="grid place-items-center" style={{ width: u(44), height: u(44) }}><Glyph d={G.arrow} size={16} u={u} /></Liquid>
                  </span>
                </div>
              </LiquidGroup>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

// MARK: Motion Card

const motionU = units(1.3);
const TICKET_W = 320, TICKET_H = 236;
/** The tear line, as a fraction of the ticket's height, and the notches cut through the card on it (Swift
 *  `notchRadius: 11, notchPosition: 0.64`). They are holes, so the stage shows through and the shadow follows them. */
const TEAR = 0.64, NOTCH = 11;
/** The Swift example's drift: a new pose every 1.2 s on `.smooth(duration: 1.6)`, retargeted before it settles, so it
 *  reads as a hand rather than a series of poses. */
const POSES: [number, number][] = [[-0.5, 0.3], [0.45, 0.4], [-0.3, -0.45], [0.4, -0.25]];
const POSE_STEP = 1.2, HAND = (2 * Math.PI) / 1.6;

/** A critically damped spring `dt` seconds on from position `x` and velocity `v`, heading for `to`. */
function drift(x: number, v: number, to: number, dt: number): [number, number] {
  const d = x - to, b = v + HAND * d, e = Math.exp(-HAND * dt);
  return [to + (d + b * dt) * e, (b - HAND * (d + b * dt)) * e];
}

export function MotionCardPreview() {
  const u = motionU;
  const card = useRef<HTMLDivElement>(null), sheen = useRef<HTMLDivElement>(null);
  // Where the current drift segment started: its index, and position and velocity on each axis.
  const seg = useRef({ k: 0, x: 0.4, y: -0.25, vx: 0, vy: 0 });
  useRaf((t, still) => {
    // The drift stands in for Core Motion. Each segment carries the last one's velocity, as a retargeted spring does.
    const target = (k: number) => (k === 0 ? [0.4, -0.25] : POSES[(k - 1) % POSES.length]);
    const s = seg.current;
    while (t >= (s.k + 1) * POSE_STEP) {
      const [tx0, ty0] = target(s.k);
      [s.x, s.vx] = drift(s.x, s.vx, tx0, POSE_STEP);
      [s.y, s.vy] = drift(s.y, s.vy, ty0, POSE_STEP);
      s.k += 1;
    }
    const [gx, gy] = target(s.k);
    const rawX = still ? 0 : drift(s.x, s.vx, gx, t - s.k * POSE_STEP)[0];
    const rawY = still ? 0 : drift(s.y, s.vy, gy, t - s.k * POSE_STEP)[0];
    // Once a loop a finger presses the lower right: the card sinks toward it on the press spring, settles halfway to
    // flat and tips down under the finger, then lets go with give from the same lean.
    const q = t % (POSE_STEP * POSES.length), press = held(q, 3, 3.4);
    const fx = 0.74, fy = 0.7, ax = (fx - 0.5) * 0.6, ay = (fy - 0.5) * 0.6;
    const k = 1 - 0.5 * press;
    const tx = rawX * k + ax * press, ty = rawY * k + ay * press, mag = Math.min(Math.hypot(tx, ty), 1);
    const ox = u(ax * TICKET_W), oy = u(ay * TICKET_H);
    if (card.current) Object.assign(card.current.style, {
      transform: `perspective(${u(700)}) rotateX(${-ty * 10}deg) rotateY(${tx * 10}deg) translate(${ox}, ${oy}) scale(${1 - 0.03 * press}) translate(${u(-ax * TICKET_W)}, ${u(-ay * TICKET_H)})`,
      // A drop shadow rather than a box shadow: it follows the card's alpha, so the notches cast it too.
      filter: `drop-shadow(0 ${u(1)} ${u(1)} ${shade(0.3)}) drop-shadow(${u(-tx * 14)} ${u(14 - 8 * press + ty * 8)} ${u(20 - 10 * press + mag * 10)} ${shade(0.48)})`,
    });
    if (sheen.current) sheen.current.style.background = `radial-gradient(circle at ${(0.5 - tx * 0.5) * 100}% ${(0.3 - ty * 0.5) * 100}%, rgba(255,255,255,${0.2 + mag * 0.22}), transparent 62%), radial-gradient(circle at ${(0.5 - tx * 0.5) * 100}% ${(0.3 - ty * 0.5) * 100}%, transparent 45%, rgba(0,0,0,${mag * 0.08}))`;
  });
  // Each half of the card carries one notch, so the two masks never overlap a hole.
  const notch = (side: "0" | "100%") => `radial-gradient(circle at ${side} ${TEAR * 100}%, transparent ${u(NOTCH)}, #000 ${u(NOTCH + 0.4)})`;
  const cut = `${notch("0")} left / 50.5% 100% no-repeat, ${notch("100%")} right / 50.5% 100% no-repeat`;
  return (
    <Stage>
      <div ref={card} data-motion className="relative" style={{ width: u(TICKET_W), height: u(TICKET_H) }}>
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: u(26), background: blocks.tangerine, color: ink, mask: cut, WebkitMask: cut }}>
          <div className="flex flex-col" style={{ height: `${TEAR * 100}%`, padding: `${u(22)} ${u(22)} ${u(16)}` }}>
            {/* The caption chips are light glass on the ticket's face: 12pt in and 28pt tall, concentric with the 26pt
                corners, their text in line with the title. They sit on the card, so they take no lift. */}
            <div style={{ margin: `${u(-10)} ${u(-10)} 0` }}>
              <LiquidGroup unit={u(1)} lift={false}>
                <div className="flex items-center justify-between">
                  {[<span key="a" style={meta(u)}>ADMIT ONE</span>, <span key="n" style={mono(u)}>No. 0418</span>].map((label) => (
                    <Liquid key={label.key} tint={glassOver(blocks.tangerine)} className="inline-flex items-center" style={{ height: u(28), paddingInline: u(10) }}>{label}</Liquid>
                  ))}
                </div>
              </LiquidGroup>
            </div>
            <span style={{ ...display(40, font.displayTracking, u), marginTop: "auto" }}>Late Show</span>
            <span style={{ fontSize: u(15), fontWeight: 600, marginTop: u(4), ...dim }}>Sat 14 Nov · Screen 3</span>
          </div>
          <span aria-hidden className="absolute" style={{ left: u(NOTCH + 8), right: u(NOTCH + 8), top: `calc(${TEAR * 100}% - ${u(0.75)})`, borderTop: `${u(1.5)} dashed ${ink}`, opacity: 0.3 }} />
          <div className="flex items-center" style={{ height: `${(1 - TEAR) * 100}%`, gap: u(24), paddingInline: u(22) }}>
            {[["ROW", "F"], ["SEAT", "12"], ["DOORS", "21:40"]].map(([k, v]) => (
              <div key={k} className="flex flex-col" style={{ gap: u(4) }}>
                <span style={{ ...meta(u), fontSize: u(10), ...dim }}>{k}</span>
                <span style={{ fontSize: u(30), fontWeight: font.numeralWeight, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </div>
            ))}
          </div>
          <div ref={sheen} data-motion aria-hidden className="pointer-events-none absolute inset-0" style={{ mixBlendMode: "soft-light" }} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Swipe Deck

const RECIPES = [
  { title: "Miso aubergine", detail: "Vegetarian · Serves 2", minutes: 25, fill: blocks.sky, bowl: blocks.tangerine },
  { title: "Lemon orzo", detail: "One pot · Serves 4", minutes: 20, fill: blocks.butter, bowl: blocks.sage },
  { title: "Green curry", detail: "Spicy · Serves 3", minutes: 35, fill: blocks.sage, bowl: blocks.butter },
  { title: "Harissa chickpeas", detail: "Vegan · Serves 2", minutes: 30, fill: blocks.lilac, bowl: blocks.tangerine },
];
const BADGES = { trailing: { title: "Keep", d: G.heart, fill: blocks.sage }, leading: { title: "Skip", d: G.x, fill: blocks.tangerine }, top: { title: "Save", d: G.bookmark, fill: blocks.butter } } as const;
type Dir = keyof typeof BADGES;
const W = 206, CH = 266, DECK_BEAT = 3, START = 0.6;
/** A throw's flight in SwipeDeck.swift: no overshoot, leaving at the finger's speed on each axis. */
const FLIGHT: Spring = { duration: 0.45, bounce: 0 };
const FLY = 1.6 * Math.max(W, CH);
/** A flick's speed as the finger lets go, in pt/s: faster than half the flight's frequency times its distance (about
 *  2970), so a critically damped flight is at its fastest the moment it leaves the finger and only slows from there. */
const FLICK_SPEED = 3200;
/** A beat's finger along its vector: a pull of `pull` seconds to `to` points (eased to a stop, or still speeding up),
 *  then a flick that ramps to FLICK_SPEED over `flick` seconds, or a `hold` before a slow let-go. */
type Beat = { dir: Dir; v: [number, number]; low: boolean; pull: number; to: number; ease: boolean; flick: number; hold: number };
/** One beat a card: a throw right, a short tug left that settles home, the throw left it was heading for, a throw up.
 *  The tug grabs the card low, so it swings from its top; the throws grab it high, so they swing from the base and
 *  stay inside the stage. The throws right and up drag past the threshold, stamp, then flick off. The tug buds its
 *  badge and melts it back as the card comes home. The throw left is a flick from a short drag, let go before the
 *  threshold, so its badge buds as the card flies and the stack finishes rising on its follow-through springs. */
const SCRIPT: Beat[] = [
  { dir: "trailing", v: [1, -0.1], low: false, pull: 0.7, to: W * 0.46, ease: true, flick: 0.07, hold: 0 },
  { dir: "leading", v: [-1, -0.04], low: true, pull: 0.6, to: W * 0.3, ease: true, flick: 0, hold: 0.15 },
  { dir: "leading", v: [-1, -0.1], low: false, pull: 0.28, to: 10, ease: false, flick: 0.018, hold: 0 },
  { dir: "top", v: [0.06, -1], low: false, pull: 0.7, to: CH * 0.34, ease: true, flick: 0.07, hold: 0 },
];
/** Distance along the beat's vector `s` seconds after the finger lands, and its speed: continuous through the flick. */
function finger(b: Beat, s: number): [number, number] {
  if (s <= 0) return [0, 0];
  const k = Math.min(s / b.pull, 1);
  if (s < b.pull || !b.flick) return b.ease ? [b.to * smoothstep(k), s < b.pull ? (6 * b.to * k * (1 - k)) / b.pull : 0] : [b.to * k * k, (2 * b.to * k) / b.pull];
  const v1 = b.ease ? 0 : (2 * b.to) / b.pull, r = Math.min(s - b.pull, b.flick), a = (FLICK_SPEED - v1) / b.flick;
  return [b.to + v1 * r + 0.5 * a * r * r, v1 + a * r];
}
const letGo = (b: Beat) => START + b.pull + b.flick + b.hold;
/** Lift (0 at rest, 1 at the commit threshold), heading and its progress for the top card at `tx`, `ty`. */
function gauge(tx: number, ty: number): { lift: number; heading: Dir | null; progress: number } {
  const hx = tx / (W * 0.4), hy = Math.max(-ty, 0) / (CH * 0.3), lift = clamp(Math.max(Math.abs(hx), hy));
  const heading: Dir | null = Math.max(Math.abs(hx), hy) <= 0.05 ? null : hy > Math.abs(hx) ? "top" : hx > 0 ? "trailing" : "leading";
  return { lift, heading, progress: heading === "top" ? clamp(hy) : clamp(Math.abs(hx)) };
}
const COMMITS = SCRIPT.filter((b) => b.flick).length;
const throwsBefore = (n: number) => Math.floor(n / SCRIPT.length) * COMMITS + SCRIPT.slice(0, n % SCRIPT.length).filter((b) => b.flick).length;
const deckU = units(1.2);
/** How far below the top card a stack card sits, by rank, for a given lift: each deeper card rises a little later. */
const sink = (i: number, lift: number) => (i === 0 ? 0 : Math.max(i - lift ** (1 + 0.6 * (i - 1)), 0));
/** Where a badge rests and waits, in points, as SwipeDeck.swift places them: Keep and Skip rest at the top centre and
 *  wait above the top edge, leaning toward the side the card heads for; Save rests at the bottom centre and waits below
 *  the bottom edge, rising the way the card goes. Each stays in view however far the card travels, and the card's
 *  clipped edge hides a badge at home. */
const BADGE_INSET = 20, BADGE_H = 44;
const badgeHome = (k: Dir): [number, number] =>
  k === "top" ? [0, BADGE_INSET + BADGE_H] : [(k === "trailing" ? 1 : -1) * Math.min(W * 0.16, 52), -(BADGE_INSET + BADGE_H)];
/** The badge out, with SwipeDeck.swift's hysteresis: it buds once the drag is a fifth of the way to the threshold and
 *  melts back once the card is nearly home or heads another way. */
function nextShown(shown: Dir | null, heading: Dir | null, progress: number): Dir | null {
  if (heading && heading === shown) return progress > 0.08 ? heading : null;
  return heading && progress >= 0.2 ? heading : null;
}

export function SwipeDeckPreview() {
  const u = deckU;
  // Which card is on top and which badge is out: the only state, kept above the liquid group, changed only when either
  // moves. Everything else is drawn straight from the frame.
  const [deck, setDeck] = useState<{ head: number; shown: Dir | null }>({ head: 0, shown: null });
  const el = useRef<HTMLDivElement>(null);
  const last = useRef({ head: 0, shown: null as Dir | null, beat: -1, lockAt: null as number | null, lockFrom: 1 });
  useRaf((t) => {
    const root = el.current; if (!root) return;
    const unit = root.clientWidth / W;
    // 3 s a beat: rest, then the finger drags the top card (the stack rises with it and the badge buds in). A throw
    // ends in a flick and leaves at the finger's speed; the stack finishes rising on follow-through springs, each a
    // beat after the one above, while the spare card fades up at the back. A tug short of the threshold returns home
    // on the elastic settle spring and swings a little past center, and its badge melts back out.
    const n = Math.floor(t / DECK_BEAT), q = t - n * DECK_BEAT, beat = SCRIPT[n % SCRIPT.length], { v } = beat;
    const commit = beat.flick > 0, LET_GO = letGo(beat), after = q - LET_GO;
    const [reach, speed] = finger(beat, LET_GO - START);
    const atRelease = gauge(v[0] * reach, v[1] * reach);
    // Directly under the finger until it lets go. A throw flies on at the finger's speed; a tug goes home at it.
    const home = commit ? 0 : sprung("settle", after, carry(roles.settle, speed, -reach));
    const d = after < 0 ? finger(beat, q - START)[0] : commit ? reach + FLY * sprung(FLIGHT, after, carry(FLIGHT, speed, FLY)) : reach * (1 - home);
    // Removed once it has flown; the stack already stands in its next pose, so nothing moves.
    const removed = commit && after >= 0.5;
    const base = throwsBefore(n), h = base + (removed ? 1 : 0);
    const tx = removed ? 0 : v[0] * d, ty = removed ? 0 : v[1] * d;
    const live = gauge(tx, ty);
    // A thrown card takes its badge with it; the card that rises starts with none out.
    const s = last.current;
    if (s.beat !== n) { s.beat = n; s.lockAt = null; }
    const shown = removed ? null : nextShown(s.shown, live.heading, live.progress);
    if (h !== s.head || shown !== s.shown) { s.head = h; s.shown = shown; setDeck({ head: h, shown }); }
    // Swells a little toward the threshold under the finger, then stamps past it with the success spring's give.
    const locked = shown !== null && shown === live.heading && live.progress >= 1;
    if (locked && s.lockAt === null) { s.lockAt = q; s.lockFrom = 0.92 + 0.08 * live.progress; }
    if (!locked) s.lockAt = null;
    const badgeScale = locked && s.lockAt !== null ? s.lockFrom + (1.08 - s.lockFrom) * sprung("success", q - s.lockAt) : 0.92 + 0.08 * live.progress;
    Array.from(root.children).forEach((node) => {
      // Placed by key, not DOM order, so a thrown card still mounted for a frame stays hidden.
      const card = node as HTMLElement, key = Number(card.dataset.k), i = key - h, rank = key - base;
      if (i < 0 || i > 3) { card.style.opacity = "0"; return; }
      // Under the finger the stack follows the drag. Once a throw lets go, the deck's target jumps to its next pose
      // and each card finishes the rise on its own follow spring; after a tug the stack goes back down with the card.
      let depth = sink(rank, live.lift), opacity = rank === 3 ? live.lift : 1;
      if (after >= 0 && rank > 0) {
        const from = sink(rank, atRelease.lift);
        if (commit) {
          const rise = sprung(follow("settle", rank), after);
          depth = rank === 4 ? 3 : rank - 1 + (from - (rank - 1)) * (1 - rise);
          opacity = rank === 4 ? 0 : rank === 3 ? Math.min(atRelease.lift + (1 - atRelease.lift) * rise, 1) : 1;
        } else {
          depth = from + (rank - from) * home;
          opacity = rank === 3 ? Math.max(atRelease.lift * (1 - home), 0) : 1;
        }
      }
      const rest = `translateY(${16 * depth * unit}px) scale(${1 - 0.05 * depth})`;
      if (i === 0) {
        // Swings around the edge opposite the finger: from the base, or from the top when grabbed low.
        const swing = (tx / W) * 14 * (beat.low ? -1 : 1), pivot = beat.low ? CH * unit : 0;
        card.style.transform = `translateY(${-pivot}px) rotate(${swing}deg) translateY(${pivot}px) translate(${tx * unit}px, ${ty * unit}px) ${rest}`;
        // Both passes of each badge: the glass and its content scale together.
        card.querySelectorAll<HTMLElement>("[data-badge-scale]").forEach((b) => { b.style.transform = `scale(${b.dataset.badgeScale === shown ? badgeScale : 0.92})`; });
      } else card.style.transform = rest;
      card.style.filter = `brightness(${1 - 0.05 * Math.min(depth, 2)})`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(4 - i);
    });
  });
  return (
    <Stage>
      <div ref={el} className="relative" style={{ width: u(W), height: u(CH), marginBottom: u(32) }}>
        {[0, 1, 2, 3].map((i) => {
          const r = RECIPES[(deck.head + i) % RECIPES.length];
          // Three cards show; a fourth waits invisibly at the back and fades up as the top card leaves.
          return (
            <div key={`${deck.head + i}`} data-k={deck.head + i} data-motion className="absolute inset-0 flex origin-bottom flex-col overflow-hidden" style={{ zIndex: 4 - i, opacity: i === 3 ? 0 : 1, borderRadius: u(30), background: r.fill, color: ink, padding: u(18), boxShadow: `0 ${u(1)} ${u(2)} ${shade(0.2)}, 0 ${u(12)} ${u(30)} ${shade(0.4)}` }}>
              {/* A plate of colour cropped by the corner: the card's one shape. */}
              <span aria-hidden className="absolute rounded-full" style={{ width: u(152), height: u(152), right: u(-44), top: u(-48), background: r.bowl }} />
              <span className="relative" style={meta(u)}>TONIGHT</span>
              <span className="relative flex items-baseline" style={{ marginTop: "auto", gap: u(5) }}>
                <span style={{ fontSize: u(92), fontWeight: font.numeralWeight, letterSpacing: "-0.06em", lineHeight: 0.8, fontVariantNumeric: "tabular-nums" }}>{r.minutes}</span>
                <span style={{ fontSize: u(12), fontWeight: 600 }}>min</span>
              </span>
              <span aria-hidden style={{ height: u(1), marginTop: u(12), background: ink, opacity: 0.18 }} />
              <span className="whitespace-nowrap" style={{ ...display(20, "-0.035em", u), marginTop: u(11) }}>{r.title}</span>
              <span style={{ fontSize: u(11.5), fontWeight: 600, marginTop: u(3), ...dim }}>{r.detail}</span>
              {i === 0 ? (
                // The outcome badges: tinted glass budding in through the card's edge and melting back out, Keep and
                // Skip at the top centre, Save at the bottom centre. The card's rounded edge clips them while home.
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <LiquidGroup unit={u(1)} axis="both" className="h-full w-full">
                    {(Object.keys(BADGES) as Dir[]).map((k) => {
                      const b = BADGES[k], out = deck.shown === k;
                      return (
                        <div key={k} className="absolute inset-x-0 flex justify-center" style={k === "top" ? { top: u(CH - BADGE_INSET - BADGE_H) } : { top: u(BADGE_INSET) }}>
                          <span data-badge-scale={k} data-motion style={{ transform: "scale(0.92)" }}>
                            <Liquid tint={out ? b.fill : undefined} bud={{ out, home: badgeHome(k) }} className="flex items-center" style={{ height: u(BADGE_H), paddingInline: u(16), color: ink }}>
                              <BudContent out={out}>
                                <span className="flex items-center whitespace-nowrap" style={{ gap: u(6), ...display(17, "-0.02em", u) }}><Glyph d={b.d} size={13} fill={k !== "leading"} u={u} />{b.title}</span>
                              </BudContent>
                            </Liquid>
                          </span>
                        </div>
                      );
                    })}
                  </LiquidGroup>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Stage>
  );
}
