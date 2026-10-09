"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, groundHex, ink, signal } from "./palette";
import { follow, ms, pressScale, roles, rubberBand, settleTime, springValue, t, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Photo Cropper: the photo in its dark well under a square frame, then the interaction. Two fingers land on the
 * tram and pinch in past 1x (the photo resists and the frame flashes red), then out to 2x about the fingers; one
 * finger drags past the photo's edge, rubber-bands and springs back; the 4:5 chip morphs the frame; rotate turns
 * the photo a quarter left; Choose dips, spins and checks; then back to rest.
 * Sizes are authored in px against the 560 x 420 docs stage and converted to `cqw`.
 *
 * Motion follows the Swift piece. While fingers hold the photo it stays exactly under them: each gesture is
 * sampled from the piece's own maths (pinch about the fingers, rubber band past 1x and past the edge). Let go past
 * an edge and it lands on a still spring sized to the way back, never past its stop. The grid and the zoom level
 * arrive on the press beat and leave on dismiss half a second after the lift; the frame flashes red for 140 ms at
 * the zoom limit. Chips, rotate and Choose sink by their size and spring back on release.
 *
 * The controls are liquid glass, as in the Swift piece: the chips sit on one glass track, and the selected chip's red
 * puck is two tinted shapes, one on snap and one a beat behind, so between picks they stretch into one liquid puck and
 * gather as the second lands, while the frame and photo morph on value. Rotate and Reset rest joined; Cancel and the
 * red Choose capsule rest apart. The zoom level floats over the photo on dark glass. The quarter turn runs on value,
 * and the check blurs in on success.
 */

type AspectId = "circle" | "square" | "portrait" | "landscape" | "original";
type Framing = { aspect: AspectId; zoom: number; cx: number; cy: number; turns: number };
type Point = [x: number, y: number];
type Step = {
  /** What happens, for people (and the launch video). */
  label: string;
  /** How long the step holds before the next one. */
  ms: number;
  /** The framing shown: zoom relative to filling the frame, the photo point at its centre, quarter turns left. Rubber-banded where it overshoots. */
  framing: Framing;
  /** How the photo gets there: under the fingers, landing after a lift, the frame morphing, a quarter turn, or a jump while hidden. */
  move?: "drag" | "land" | "morph" | "turn" | "snap";
  /** A landing's spring, sized to the way back as the Swift piece sizes its coast. */
  land?: Spring;
  /** Fingers on the stage, in px of the 560 x 420 stage. */
  fingers?: Point[];
  grid?: boolean;
  /** The zoom level above the frame. */
  readout?: boolean;
  /** The frame's red flash at a zoom limit. */
  flash?: boolean;
  press?: "portrait" | "rotate" | "choose";
  choose?: "busy" | "done";
  /** Photo and frame faded out, for the jump back to rest. */
  fade?: boolean;
};

const REST: Framing = { aspect: "square", zoom: 1, cx: 0.5, cy: 0.5, turns: 0 };

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const PAPER = groundHex.text;
const WELL_INK = groundHex.bg;

// Geometry, as the Swift piece lays it out: a 127 px toolbar (the chip track's 59, a 10 gap and the 44 buttons, inside
// 6 and 8 of padding), the well inset 8, the frame inset 18 inside it.
const STAGE = { w: 560, h: 420 };
const TOOLBAR = 127;
/** The track's rim around the chips: the puck sits this far inside it, concentric. */
const CHIP_INSET = 4;
/** The well is dark in both appearances, so the glass over it is the dark glass, as in the Swift piece. */
const DARK_GLASS = { "--pv-glass": "rgba(38,38,41,0.62)", "--pv-glass-solid": "#2a2a2d", "--pv-glass-shade": "rgba(0,0,0,0.24)", "--pv-glass-edge": "rgba(255,255,255,0.12)", "--pv-glass-rim": "rgba(255,255,255,0.16)", "--pv-glass-lift": "rgba(0,0,0,0.45)" } as CSSProperties;
/** The puck's trailing shape follows a beat behind its lead, as Swift's `motion.follow(responsive, rank: 3)`. */
const PUCK_TRAIL = follow("snap", 3);
const WELL = { x: 8, y: 8, w: STAGE.w - 16, h: STAGE.h - TOOLBAR - 8 };
const PHOTO = { w: 1600, h: 1200 };
/** The photo element's laid-out size before its transform (px per photo unit). */
const BASE = 0.2;
const RATIO: Record<AspectId, number | null> = { circle: 1, square: 1, portrait: 0.8, landscape: 16 / 9, original: null };
const MAX_ZOOM = 5;

/** The frame in well coordinates, and the photo's transform, for a framing. */
function place(f: Framing) {
  const turned = f.turns % 2 ? { w: PHOTO.h, h: PHOTO.w } : PHOTO;
  const ratio = RATIO[f.aspect] ?? turned.w / turned.h;
  const room = { w: WELL.w - 36, h: WELL.h - 36 };
  let fw = room.w;
  let fh = fw / ratio;
  if (fh > room.h) {
    fh = room.h;
    fw = fh * ratio;
  }
  const frame = { x: (WELL.w - fw) / 2, y: (WELL.h - fh) / 2, w: fw, h: fh, r: f.aspect === "circle" ? fw / 2 : 0 };
  const scale = f.zoom * Math.max(fw / turned.w, fh / turned.h);
  const tx = -scale * (f.cx - 0.5) * PHOTO.w;
  const ty = -scale * (f.cy - 0.5) * PHOTO.h;
  // rotate, then translate and scale in the photo's own (unturned) axes: the framing's point stays at the frame centre through a turn.
  return { frame, scale, tx, ty, transform: `rotate(${-90 * f.turns}deg) translate(${u(tx)}, ${u(ty)}) scale(${(scale / BASE).toFixed(4)})` };
}

// The gestures, as the Swift piece runs them in the upright square frame: a live zoom and centre that the fingers
// set, shown through the rubber band, and the landing when they lift.

/** The frame's centre on the stage, where a pinch's offset is measured from. */
const MID: Point = [WELL.x + WELL.w / 2, WELL.y + WELL.h / 2];
const SQUARE = place(REST).frame;
/** Stage px per unit of the photo's width and height at `zoom`. */
const perUnit = (zoom: number): Point => {
  const { scale } = place({ ...REST, zoom });
  return [scale * PHOTO.w, scale * PHOTO.h];
};
/** Half the frame, in units of the photo, at `zoom`. */
const half = (zoom: number): Point => {
  const [w, h] = perUnit(zoom);
  return [SQUARE.w / 2 / w, SQUARE.h / 2 / h];
};
/** The zoom as shown: past 1 and the maximum it resists more and more. */
const bandZoom = (z: number) => (z > MAX_ZOOM ? MAX_ZOOM * (z / MAX_ZOOM) ** 0.3 : z < 1 ? Math.max(z, 0.01) ** 0.3 : z);
/** One axis of the centre as shown: exact inside its limits, past them a scroll view's resistance. */
function bandAxis(v: number, h: number) {
  const low = h >= 0.5 ? 0.5 : h, high = h >= 0.5 ? 0.5 : 1 - h, span = Math.max(h * 2, 0.0001);
  if (v < low) return low - rubberBand(low - v, span);
  if (v > high) return high + rubberBand(v - high, span);
  return v;
}
const clampAxis = (v: number, h: number) => (h >= 0.5 ? 0.5 : Math.min(Math.max(v, h), 1 - h));

type Live = { zoom: number; cx: number; cy: number; anchor: Point; past: boolean };
const grab = (f: Framing): Live => ({ zoom: f.zoom, cx: f.cx, cy: f.cy, anchor: MID, past: false });
function shownOf(g: Live): Framing {
  const zoom = bandZoom(g.zoom), [hx, hy] = half(zoom);
  return { ...REST, zoom, cx: bandAxis(g.cx, hx), cy: bandAxis(g.cy, hy) };
}
/** Where the photo lands when the fingers lift: zoom back inside its limits about the last pinch centre, then inside the edges. */
function landing(g: Live): Framing {
  const shown = shownOf(g);
  const zoom = Math.min(Math.max(shown.zoom, 1), MAX_ZOOM);
  const from = perUnit(shown.zoom), to = perUnit(zoom);
  const dx = g.anchor[0] - MID[0], dy = g.anchor[1] - MID[1];
  const [hx, hy] = half(zoom);
  return { ...REST, zoom, cx: clampAxis(shown.cx + dx / from[0] - dx / to[0], hx), cy: clampAxis(shown.cy + dy / from[1] - dy / to[1], hy) };
}
/** The landing's spring, as Swift sizes its coast: a little longer for a longer way back, and it never bounces. */
function coast(from: Framing, to: Framing): Spring {
  const [w, h] = perUnit(to.zoom);
  const travel = Math.hypot((from.cx - to.cx) * w, (from.cy - to.cy) * h);
  return { duration: Math.min(0.55, 0.32 + travel / 1600), bounce: 0 };
}

/** Finger samples about 16 a second. Each step moves linearly to the next sample, so the photo stays on the fingers. */
const LEG = 62;
const smooth = (x: number) => x * x * (3 - 2 * x);
const centroid = (f: Point[]): Point => [f.reduce((s, p) => s + p[0], 0) / f.length, f.reduce((s, p) => s + p[1], 0) / f.length];
const spread = (f: Point[]) => (f.length > 1 ? Math.hypot(f[1][0] - f[0][0], f[1][1] - f[0][1]) : 0);

/** Fingers moving from `from` to `to` over `total` ms, fed to the live gesture as UIKit's recognisers report them: the
 *  centroid's move pans, the spread's change pinches about the centroid. Crossing a zoom limit flashes the frame. */
function track(g: Live, from: Point[], to: Point[], total: number, step: Pick<Step, "label" | "grid" | "readout">): Step[] {
  const n = Math.max(2, Math.round(total / LEG)), legMs = Math.round(total / n);
  const out: Step[] = [];
  let prev = from, flashing = 0;
  for (let i = 1; i <= n; i++) {
    const k = smooth(i / n);
    const next = from.map((p, j): Point => [p[0] + (to[j][0] - p[0]) * k, p[1] + (to[j][1] - p[1]) * k]);
    const [ax, ay] = centroid(prev), [bx, by] = centroid(next);
    const unit = perUnit(bandZoom(g.zoom));
    g.cx -= (bx - ax) / unit[0];
    g.cy -= (by - ay) / unit[1];
    if (next.length > 1 && spread(prev) > 0) {
      const before = perUnit(bandZoom(g.zoom));
      g.zoom = Math.min(Math.max((g.zoom * spread(next)) / spread(prev), 0.2), MAX_ZOOM * 4);
      const after = perUnit(bandZoom(g.zoom));
      const dx = bx - MID[0], dy = by - MID[1];
      g.cx += dx / before[0] - dx / after[0];
      g.cy += dy / before[1] - dy / after[1];
      g.anchor = [bx, by];
      const past = g.zoom < 0.999 || g.zoom > MAX_ZOOM + 0.001;
      // Red for 140 ms from the crossing, as Swift holds it before letting it go.
      if (past && !g.past) flashing = Math.max(1, Math.round(140 / legMs));
      g.past = past;
    }
    out.push({ ...step, ms: legMs, move: "drag", framing: shownOf(g), fingers: next, flash: flashing-- > 0 });
    prev = next;
  }
  return out;
}

/** The storyboard, about 10.3 s. Framings come from the piece's own maths (pinch about the fingers, rubber band, clamping). */
const SCRIPT: readonly Step[] = (() => {
  const out: Step[] = [];
  const two: Point[] = [[250, 224], [302, 238]], pinched: Point[] = [[262, 227], [290, 235]], spread2x: Point[] = [[224, 217], [328, 245]];
  out.push({ label: "Rest: the square frame over the photo", ms: 1200, framing: REST });
  out.push({ label: "Two fingers land on the tram; the grid arrives with them", ms: 300, framing: REST, fingers: two, grid: true });
  const pinch = grab(REST);
  out.push(...track(pinch, two, pinched, 500, { label: "Pinch in past 1x: the photo resists and the frame flashes red", grid: true, readout: true }));
  out.push(...track(pinch, pinched, spread2x, 750, { label: "Pinch out to 2x about the fingers", grid: true, readout: true }));
  const zoomed = landing(pinch);
  out.push({ label: "The fingers lift", ms: 350, move: "land", land: coast(shownOf(pinch), zoomed), framing: zoomed, grid: true, readout: true });
  const one: Point[] = [[296, 236]];
  out.push({ label: "One finger lands on the tram", ms: 250, framing: zoomed, fingers: one, grid: true, readout: true });
  const pull = grab(zoomed);
  out.push(...track(pull, one, [[302, 106]], 700, { label: "Drag up past the photo's bottom edge: it follows less and less", grid: true, readout: true }));
  const settled = landing(pull);
  out.push({ label: "Release: it lands back on the edge, never past it", ms: 500, move: "land", land: coast(shownOf(pull), settled), framing: settled, grid: true, readout: true });
  out.push({ label: "Half a second after the lift, the grid and the zoom level fade", ms: 450, framing: settled });
  // The turned 4:5 limits still hold this centre, so the turn needs no clamping.
  const portrait: Framing = { ...settled, aspect: "portrait" }, turned: Framing = { ...portrait, turns: 1 };
  out.push({ label: "Tap the 4:5 chip", ms: 160, framing: settled, press: "portrait" });
  out.push({ label: "The chip's block slides over to 4:5 as the frame and photo morph, the tram stays in frame", ms: 1000, move: "morph", framing: portrait });
  out.push({ label: "Tap rotate", ms: 160, framing: portrait, press: "rotate" });
  out.push({ label: "A quarter turn left; the photo grows just enough mid-turn to keep the frame covered", ms: 1200, move: "turn", framing: turned });
  out.push({ label: "Tap Choose", ms: 160, framing: turned, press: "choose" });
  out.push({ label: "Choose spins while the crop renders", ms: 900, framing: turned, choose: "busy" });
  out.push({ label: "Done: a check lands with a little give", ms: 900, framing: turned, choose: "done" });
  out.push({ label: "The check makes way for the label", ms: 400, framing: turned });
  out.push({ label: "Fade out", ms: ms("dismiss"), framing: turned, fade: true });
  out.push({ label: "Back to rest", ms: 60, move: "snap", framing: REST, fade: true });
  return out;
})();

/** How much the photo grows during a quarter turn, sampled over the `value` spring the turn runs on: at each angle the
 *  scale that keeps the frame's corners on the photo (Swift works out the same every frame), plus up to 2% mid-turn. */
function boostFrames(from: Framing, to: Framing): string {
  const a = place(from), b = place(to), spring = roles.value, total = settleTime(spring), samples = 24;
  const { w, h } = b.frame;
  const corners: Point[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const frames: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = i === samples ? 1 : springValue(spring, (i / samples) * total);
    const angle = ((90 * (from.turns + (to.turns - from.turns) * p)) * Math.PI) / 180;
    const tx = a.tx + (b.tx - a.tx) * p, ty = a.ty + (b.ty - a.ty) * p, sc = a.scale + (b.scale - a.scale) * p;
    const hw = (PHOTO.w / 2) * sc, hh = (PHOTO.h / 2) * sc, c = Math.cos(angle), s = Math.sin(angle);
    let need = 1;
    for (const [x, y] of corners) {
      // The corner in the photo's own axes: the CSS turn undone.
      const wx = x * c - y * s, wy = x * s + y * c;
      need = Math.max(need, wx > 0 ? wx / (tx + hw) : wx / (tx - hw), wy > 0 ? wy / (ty + hh) : wy / (ty - hh));
    }
    const grow = i === 0 || i === samples ? 1 : need * (1 + 0.02 * Math.sin(Math.PI * p));
    frames.push(`${((i / samples) * 100).toFixed(2)}%{transform:scale(${grow.toFixed(4)})}`);
  }
  return frames.join("");
}
const TURN = SCRIPT.findIndex((s) => s.move === "turn");
const BOOST = boostFrames(SCRIPT[TURN - 1].framing, SCRIPT[TURN].framing);

// Press depth by size, as PiecePressStyle sinks each control: the chips and rotate reach the 0.92 floor, Choose a touch less.
const CHIP_PRESS = pressScale(62, 51);
const ROTATE_PRESS = pressScale(44, 44);
const CHOOSE_PRESS = pressScale(104, 44);
/** Sinks on the press spring, springs back through rest on release. */
const sink = (pressed: boolean, scale: number): CSSProperties => ({ transform: pressed ? `scale(${scale})` : "none", transition: t("transform", pressed ? "press" : "release") });

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

/** Walks the script; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps(steps: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) {
      setI(0);
      return;
    }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return { step: steps[i], prev: steps[(i + steps.length - 1) % steps.length], reduced };
}

/** Each chip's place in the row, as left and right insets in % of the row, for the block that slides under them. */
function useChipSlots() {
  const row = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Partial<Record<AspectId, [number, number]>> | null>(null);
  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const chips = [...el.querySelectorAll<HTMLElement>("[data-chip]")];
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const next: Partial<Record<AspectId, [number, number]>> = {};
      // offsetLeft/offsetWidth ignore a chip's press scale.
      for (const chip of chips) next[chip.dataset.chip as AspectId] = [(chip.offsetLeft / el.offsetWidth) * 100, ((el.offsetWidth - chip.offsetLeft - chip.offsetWidth) / el.offsetWidth) * 100];
      setSlots(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    chips.forEach((chip) => observer.observe(chip));
    return () => observer.disconnect();
  }, []);
  return { row, slots };
}

/** The photo the Swift example draws: sky, sun, clouds, layered hills, cypresses and a red tram under its wire. */
function Scene() {
  return (
    <svg aria-hidden viewBox="0 0 1600 1200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
      <rect width="1600" height="1200" fill={blocks.sky} />
      <circle cx="1215" cy="285" r="105" fill={blocks.butter} />
      <g fill={PAPER}>
        <rect x="262" y="300" width="268" height="56" rx="28" />
        <circle cx="352" cy="300" r="50" />
        <circle cx="436" cy="286" r="62" />
        <rect x="930" y="212" width="176" height="38" rx="19" />
        <circle cx="990" cy="212" r="32" />
        <circle cx="1046" cy="204" r="40" />
      </g>
      <path d="M0 690 C180 560 380 560 560 650 C720 730 860 560 1060 590 C1260 620 1380 540 1600 600 L1600 1200 L0 1200 Z" fill={blocks.lilac} />
      <path d="M0 840 C260 720 520 760 760 820 C1000 880 1260 760 1600 790 L1600 1200 L0 1200 Z" fill={blocks.sage} />
      <g fill={ink}>
        <ellipse cx="196" cy="770" rx="16" ry="48" />
        <ellipse cx="236" cy="784" rx="12" ry="36" />
        <ellipse cx="1372" cy="752" rx="15" ry="46" />
        <ellipse cx="1408" cy="766" rx="11" ry="32" />
      </g>
      <path d="M0 980 C400 900 1000 930 1600 960 L1600 1200 L0 1200 Z" fill={blocks.sand} />
      <rect y="1048" width="1600" height="7" fill={ink} />
      <rect y="1070" width="1600" height="7" fill={ink} />
      <path d="M0 790 C540 812 1060 812 1600 786" fill="none" stroke={ink} strokeWidth="5" />
      <path d="M748 838 L790 806 L832 838" fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <rect x="560" y="858" width="440" height="170" rx="34" fill={signal.fill} />
      <rect x="588" y="838" width="384" height="30" rx="15" fill={PAPER} />
      <g fill={ink}>
        {[592, 680, 768, 856].map((x) => <rect key={x} x={x} y="888" width="70" height="58" rx="12" />)}
        <rect x="944" y="888" width="40" height="58" rx="12" />
        <circle cx="640" cy="1030" r="24" />
        <circle cx="920" cy="1030" r="24" />
      </g>
      <rect x="560" y="964" width="440" height="12" fill={PAPER} />
      <circle cx="986" cy="996" r="9" fill={blocks.butter} />
    </svg>
  );
}

/** A chip's small picture of its frame: outlined, or solid ink on the red puck when selected. */
function AspectGlyph({ aspect, selected, turns, cut }: { aspect: AspectId; selected: boolean; turns: number; cut: boolean }) {
  // The photo's own shape follows its turns, as in the Swift piece.
  const ratio = RATIO[aspect] ?? (turns % 2 ? 3 / 4 : 4 / 3);
  const side = 18;
  const long = side * (ratio === 1 ? 0.86 : 1);
  const w = ratio >= 1 ? long : long * ratio;
  const h = ratio >= 1 ? long / ratio : long;
  const color = selected ? signal.on : ground.muted;
  return (
    <span className="grid place-items-center" style={{ width: u(side), height: u(side) }}>
      <span
        style={{
          width: u(w), height: u(h), boxSizing: "border-box", borderRadius: aspect === "circle" ? "50%" : u(2.5),
          border: `${u(1.6)} solid ${color}`, background: selected ? color : "transparent", transition: cut ? "none" : t(["background-color", "border-color"], "snap"),
        }}
      />
    </span>
  );
}

function Spinner() {
  return (
    <span data-motion className="block" style={{ width: u(18), height: u(18), animation: "pc-spin .9s steps(8) infinite" }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: "100%", height: "100%" }}>
        {Array.from({ length: 8 }, (_, k) => (
          <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke={signal.on} strokeWidth={2.6} strokeLinecap="round" opacity={0.25 + (k / 7) * 0.75} transform={`rotate(${k * 45} 12 12)`} />
        ))}
      </svg>
    </span>
  );
}

function Icon({ children, size, width = 2 }: { children: ReactNode; size: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), display: "block" }}>
      {children}
    </svg>
  );
}

const TILES: Array<[AspectId, string]> = [["circle", "Circle"], ["square", "Square"], ["portrait", "4:5"], ["landscape", "16:9"], ["original", "Original"]];
/** Where an unseen finger waits, so it can fade in where it lands. */
const PARKED: Point = [276, 231];

export function PhotoCropperPreview() {
  const { step: s, prev, reduced } = useSteps(SCRIPT);
  const { row, slots } = useChipSlots();
  const { frame, transform } = place(s.framing);
  const move = reduced ? "snap" : s.move;
  // The jump back to rest while the well is hidden: nothing animates, so the toolbar is simply at rest when the photo
  // fades back in, never sliding the puck with no press.
  const cut = move === "snap";
  // Under the fingers the photo moves linearly to each sample; a landing runs its own still spring; everything else
  // that moves the photo (aspect, turn) lands on `value`, which never overshoots: the framing is the crop you get.
  const photoMotion = cut ? "none" : move === "drag" ? `transform ${s.ms}ms linear` : t("transform", move === "land" && s.land ? s.land : "value");
  const frameMotion = cut ? "none" : t(["left", "top", "width", "height"], "value");
  const clip = `inset(${u(frame.y)} ${u(WELL.w - frame.x - frame.w)} ${u(WELL.h - frame.y - frame.h)} ${u(frame.x)} round ${u(frame.r)})`;
  const changed = s.framing !== REST;
  const shown = s.fade ? 0 : 1;
  const edge = s.flash ? signal.fill : PAPER;
  const zoomText = `${Number(s.framing.zoom.toFixed(1)).toLocaleString("en-US")}×`;
  const slot = slots?.[s.framing.aspect];

  // The photo element sits centred on the frame; its transform does the rest. The boost wrapper grows it mid-turn so
  // the frame's corners never leave the photo (the Swift piece computes the same per frame).
  const layer = (dimmed: boolean) => (
    <div data-motion style={{ position: "absolute", inset: 0, transformOrigin: `${u(WELL.w / 2)} ${u(WELL.h / 2)}`, animation: move === "turn" ? `pc-boost ${ms("value")}ms linear` : undefined }}>
      <div
        data-motion
        style={{
          position: "absolute", left: u(WELL.w / 2 - (PHOTO.w * BASE) / 2), top: u(WELL.h / 2 - (PHOTO.h * BASE) / 2),
          width: u(PHOTO.w * BASE), height: u(PHOTO.h * BASE), transform, transition: photoMotion,
        }}
      >
        <Scene />
        {dimmed ? <div style={{ position: "absolute", inset: 0, background: WELL_INK, opacity: 0.62 }} /> : null}
      </div>
    </div>
  );

  // The edge and marks turn red at once at a limit and let the red go on dismiss.
  const mark = (corner: 0 | 1 | 2 | 3): CSSProperties => {
    const right = corner === 1 || corner === 2;
    const bottom = corner === 2 || corner === 3;
    const w = u(3);
    return {
      position: "absolute", width: u(20), height: u(20), boxSizing: "border-box", borderColor: edge, borderStyle: "solid",
      left: right ? undefined : u(-3), right: right ? u(-3) : undefined, top: bottom ? undefined : u(-3), bottom: bottom ? u(-3) : undefined,
      borderTopWidth: bottom ? 0 : w, borderBottomWidth: bottom ? w : 0, borderLeftWidth: right ? 0 : w, borderRightWidth: right ? w : 0,
      transition: s.flash ? "none" : t("border-color", "dismiss"),
    };
  };

  const fingersShown = s.fingers ?? [];
  const lastFingers = s.fingers ?? prev.fingers ?? [];
  const dotsJump = !prev.fingers || (prev.fingers.length !== fingersShown.length && fingersShown.length > 0);
  const busy = s.choose === "busy", done = s.choose === "done";

  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes pc-spin{to{transform:rotate(360deg)}}@keyframes pc-boost{${BOOST}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`}</style>

      {/* The well: dark in both appearances, like the Swift piece's canvas. */}
      <div style={{ position: "absolute", left: u(WELL.x), top: u(WELL.y), width: u(WELL.w), height: u(WELL.h), borderRadius: u(26), overflow: "hidden", background: WELL_INK }}>
        <div data-motion style={{ position: "absolute", inset: 0, opacity: shown, transition: t("opacity", s.fade ? "dismiss" : "reveal") }}>
          {layer(true)}
          <div data-motion style={{ position: "absolute", inset: 0, clipPath: clip, transition: cut ? "none" : t("clip-path", "value") }}>
            {layer(false)}
          </div>
          <div data-motion style={{ position: "absolute", left: u(frame.x), top: u(frame.y), width: u(frame.w), height: u(frame.h), transition: frameMotion }}>
            {/* Thirds grid, clipped to the frame: in with the finger on the press beat, out on dismiss. */}
            <div data-motion style={{ position: "absolute", inset: 0, borderRadius: u(frame.r), overflow: "hidden", opacity: s.grid ? 1 : 0, transition: t("opacity", s.grid ? "press" : "dismiss") }}>
              {[1, 2].map((k) => (
                <span key={`v${k}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(k * 100) / 3}%`, width: u(0.75), background: PAPER, opacity: 0.6 }} />
              ))}
              {[1, 2].map((k) => (
                <span key={`h${k}`} style={{ position: "absolute", left: 0, right: 0, top: `${(k * 100) / 3}%`, height: u(0.75), background: PAPER, opacity: 0.6 }} />
              ))}
            </div>
            <div data-motion style={{ position: "absolute", inset: 0, borderRadius: u(frame.r), boxShadow: `0 0 0 ${u(1)} ${edge}`, transition: `${t("border-radius", "value")}, ${s.flash ? "box-shadow 0s" : t("box-shadow", "dismiss")}` }} />
            <div data-motion style={{ position: "absolute", inset: 0, opacity: frame.r > 0 ? 0 : 1, transition: t("opacity", "value") }}>
              {([0, 1, 2, 3] as const).map((c) => <span key={c} data-motion style={mark(c)} />)}
            </div>
          </div>
          {/* The zoom level on dark glass, inside the frame's top edge (no room above it on this stage). With no glass to
              bud from, it settles down into place as the fingers land and lifts away after them. */}
          <div
            data-motion
            style={{
              ...DARK_GLASS, position: "absolute", left: u(WELL.w / 2), top: u(frame.y + 21), transform: `translate(-50%, -50%) translateY(${u(s.readout ? 0 : -4)})`,
              opacity: s.readout ? 1 : 0, transition: `${t(["opacity", "transform"], s.readout ? "press" : "dismiss")}, ${t("top", "value")}`,
            }}
          >
            <LiquidGroup unit={u(1)} lift={false} appearance="dark">
              <Liquid style={{ padding: `${u(5)} ${u(10)}`, color: PAPER, fontSize: u(13), fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {zoomText}
              </Liquid>
            </LiquidGroup>
          </div>
        </div>
      </div>

      {/* Fingers: the outer span rides the samples, the inner one lands on the press beat and lifts on dismiss. */}
      {[0, 1].map((k) => {
        const at = fingersShown[k] ?? lastFingers[k] ?? PARKED;
        const on = Boolean(fingersShown[k]);
        return (
          <span
            key={k}
            data-motion
            style={{
              position: "absolute", left: 0, top: 0, width: u(34), height: u(34), transform: `translate(${u(at[0] - 17)}, ${u(at[1] - 17)})`,
              transition: dotsJump || !on ? "none" : `transform ${s.ms}ms linear`,
            }}
          >
            <span
              data-motion
              style={{
                display: "block", width: "100%", height: "100%", borderRadius: "50%",
                background: "rgba(244,243,239,.42)", boxShadow: `0 0 0 ${u(2)} rgba(244,243,239,.9), 0 ${u(3)} ${u(10)} rgba(0,0,0,.28)`,
                opacity: on ? 1 : 0, transform: on || reduced ? "none" : "scale(.7)", transition: t(["opacity", "transform"], on ? "press" : "dismiss"),
              }}
            />
          </span>
        );
      })}

      {/* Toolbar: the chips on their glass track, then Cancel, rotate and Reset, and Choose. Two groups of glass, so the
          track and the buttons under it never neck. */}
      <div className="absolute flex flex-col items-stretch" style={{ left: 0, right: 0, bottom: 0, height: u(TOOLBAR), paddingTop: u(6), boxSizing: "border-box", gap: u(10) }}>
        <div className="flex justify-center">
          <LiquidGroup unit={u(1)}>
            <div style={{ position: "relative", padding: u(CHIP_INSET) }}>
              {/* The track. */}
              <Liquid style={{ position: "absolute", inset: 0 }} />
              <div ref={row} className="relative flex">
                {/* The puck: two red shapes on the selected chip, the second a beat behind the first, so they stretch
                    into one between picks. Behind the chips, so it passes under their pictures and names. */}
                {slot ? [0, 1].map((k) => (
                  <Liquid
                    key={k}
                    tint={signal.fill}
                    style={{
                      position: "absolute", top: 0, bottom: 0, left: `${slot[0].toFixed(3)}%`, right: `${slot[1].toFixed(3)}%`,
                      transition: cut ? "none" : t(["left", "right"], k === 0 ? "snap" : PUCK_TRAIL),
                    }}
                  />
                )) : null}
                {TILES.map(([id, title]) => {
                  const selected = s.framing.aspect === id;
                  return (
                    <span
                      key={id}
                      data-chip={id}
                      data-motion
                      className="relative flex flex-col items-center"
                      style={{
                        minWidth: u(58), padding: `${u(7)} ${u(10)}`, boxSizing: "border-box", gap: u(4),
                        color: selected ? signal.on : ground.muted,
                        transform: s.press === id ? `scale(${CHIP_PRESS})` : "none",
                        transition: `${t("transform", s.press === id ? "press" : "release")}, ${cut ? "color 0s" : t("color", "snap")}`,
                      }}
                    >
                      <AspectGlyph aspect={id} selected={selected} turns={s.framing.turns} cut={cut} />
                      <span style={{ fontSize: u(12), fontWeight: 600, lineHeight: 1.25 }}>{title}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </LiquidGroup>
        </div>
        <LiquidGroup unit={u(1)}>
          <div className="flex items-center" style={{ paddingInline: u(12), height: u(44) }}>
            <Liquid className="grid place-items-center" style={{ height: u(44), paddingInline: u(14), fontSize: u(17), fontWeight: 600 }}>Cancel</Liquid>
            <span className="flex-1" style={{ minWidth: u(liquid.merge) }} />
            {/* Rotate and Reset rest joined, one pair of tools for the crop. */}
            <div className="flex items-center" style={{ gap: u(liquid.joined) }}>
              <Liquid className="grid place-items-center" style={{ width: u(44), height: u(44), color: ground.text, ...sink(s.press === "rotate", ROTATE_PRESS) }}>
                <Icon size={20} width={2.2}>
                  <rect x="4.5" y="10" width="10" height="10" rx="2" />
                  <path d="M10 5.5h3.5a5 5 0 0 1 5 5v1.5" />
                  <path d="M12 3l-2.5 2.5L12 8" />
                </Icon>
              </Liquid>
              <Liquid className="grid place-items-center" style={{ height: u(44), paddingInline: u(14) }}>
                <span data-motion style={{ fontSize: u(17), fontWeight: 600, color: changed ? ground.text : ground.muted, opacity: changed ? 1 : 0.55, transition: cut ? "none" : t(["color", "opacity"], "snap") }}>Reset</span>
              </Liquid>
            </div>
            <span className="flex-1" style={{ minWidth: u(liquid.merge) }} />
            <Liquid
              tint={signal.fill}
              className="grid place-items-center"
              style={{ height: u(44), padding: `0 ${u(18)}`, color: signal.on, fontSize: u(17), fontWeight: 600, ...sink(s.press === "choose", CHOOSE_PRESS) }}
            >
              {/* The label blurs out as the spinner arrives at once with the render; the check blurs in on success, and a
                  beat later the label blurs back in on dismiss. The capsule holds its width throughout. */}
              <span data-motion style={{ gridArea: "1 / 1", opacity: s.choose ? 0 : 1, filter: `blur(${u(s.choose ? 4 : 0)})`, transition: s.choose ? "none" : t(["opacity", "filter"], "dismiss") }}>Choose</span>
              <span data-motion style={{ gridArea: "1 / 1", opacity: busy ? 1 : 0, transition: busy ? "none" : t("opacity", "success") }}>{s.choose ? <Spinner /> : null}</span>
              <span
                data-motion
                style={{
                  gridArea: "1 / 1", display: "block", opacity: done ? 1 : 0, filter: `blur(${u(done ? 0 : 4)})`, transform: done ? "none" : "scale(.8)",
                  transition: t(["opacity", "filter", "transform"], done ? "success" : "dismiss"),
                }}
              >
                <Icon size={18} width={2.6}>
                  <path d="M5.5 12.5l4.2 4.2 8.8-9.4" />
                </Icon>
              </span>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}
