"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";
import { cascade, curve, follow, ms, pop, pressScale, reduced, roles, t, type Role, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, glass, liquid } from "./piece-liquid";

// Data previews. Each shows the component itself on the house ground: the chart, the ring, the stat tile, the rolling number.
// Nothing that is not the component: no headings, no dashboard cards, no action buttons.
// Sizes are iOS points mapped to container width (P cqw per point), so the stage scales from the grid card to the docs header.
// The charts, the ring and the digits are content; their chips, flags, pills and pickers are liquid glass drawn with
// piece-liquid.tsx, on the same rest gaps and bud springs as the Swift pieces. Text is one weight, 600.

const P = 0.25;
/** iOS points to container units. */
const pt = (n: number) => `${+(n * P).toFixed(3)}cqw`;
/** One iOS point inside a liquid group. */
const U = pt(1);

/**
 * A bubble's place in the bud cycle when its width is not known ahead: laid out a neck's width past its parent's end
 * on `side`, out at rest, home just inside that end and shrunk. The home offset is in percent of the bubble's own width.
 */
function budBeside(out: boolean, side: 1 | -1 = 1): CSSProperties {
  const reach = (1 + liquid.homeScale) / 2;
  return {
    transform: out ? "none" : `translateX(calc(${side} * (${pt(-liquid.joined)} - ${(reach * 100).toFixed(1)}%))) scale(${liquid.homeScale})`,
    transition: t("transform", out ? liquid.split : liquid.home),
  };
}

/** Resting slices while one is selected: one solid step off the ground in either theme (#2e2e2e on charcoal, pale grey on paper). */
const REST = `color-mix(in srgb, ${ground.field} 60%, ${ground.control})`;

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

/**
 * Springs a vector toward `target`, as SwiftUI interpolates real numbers. The spring is read when the target changes,
 * and a new target mid-flight keeps the current velocity, so a retarget merges into the motion instead of restarting
 * it. `0`, or Reduce Motion, lands at once. It stops once every value is within `precision` of its target.
 */
function useSpring(target: number[], spring: Role | Spring | 0, precision = 1e-3) {
  const [cur, setCur] = useState(target);
  const state = useRef({ x: target, v: target.map(() => 0) });
  useEffect(() => {
    const s = state.current, to = target;
    if (!spring || reduced()) { s.x = to; s.v = to.map(() => 0); setCur(to); return; }
    const { duration, bounce } = typeof spring === "string" ? roles[spring] : spring;
    const w = (2 * Math.PI) / duration, z = 1 - Math.min(Math.max(bounce, 0), 0.99);
    const x = to.map((v, i) => s.x[i] ?? v), v = to.map((_, i) => s.v[i] ?? 0);
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = Math.max(now, last);
      // Small fixed steps of the same equation Swift's Spring solves, so stiff springs stay stable at any frame rate.
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let n = 0; n < steps; n++) for (let i = 0; i < x.length; i++) {
        v[i] += (-w * w * (x[i] - to[i]) - 2 * z * w * v[i]) * h;
        x[i] += v[i] * h;
      }
      const done = x.every((xi, i) => Math.abs(xi - to[i]) < precision && Math.abs(v[i]) / w < precision);
      s.x = done ? to : x.slice();
      s.v = done ? to.map(() => 0) : v.slice();
      setCur(s.x);
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

/**
 * A scripted finger dragging across a chart's points: it leaves and arrives the way a hand does (ease in-out) and reports
 * each new point it reaches, so whatever follows it sits on the finger every frame. Stops on unmount or the next move.
 */
function useFingerPath() {
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const stop = () => cancelAnimationFrame(raf.current);
  const move = (from: number, to: number, dur: number, reach: (i: number) => void) => {
    stop();
    const start = performance.now();
    let last = from;
    const tick = (now: number) => {
      const p = Math.min(Math.max((now - start) / dur, 0), 1), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const i = Math.round(from + (to - from) * e);
      if (i !== last) { last = i; reach(i); }
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  return { move, stop };
}

/** Runs Web Animations on mount and cancels them on unmount: one glyph's or label's way in or out. */
function useEntrance<T extends Element>(frames: Keyframe[] | null, options: KeyframeAnimationOptions, onFinish?: (el: T) => void) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!frames || !el) return;
    const a = el.animate(frames, options);
    if (onFinish) a.onfinish = () => onFinish(el);
    return () => a.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/** What a rolling or fading text shows now, what it showed before, and whether that change animates. */
type Face = { text: string; from: string; value: number; up: boolean; beat: unknown; gen: number; moves: boolean };

/**
 * The face a text should show. Only a change that arrives with a new `beat` animates, the way SwiftUI animates a
 * readout only inside a transaction: a scrub step changes the text with no beat and stays instant.
 */
function useFace(text: string, value: number, beat: unknown): Face {
  const [face, setFace] = useState<Face>({ text, from: text, value, up: true, beat, gen: 0, moves: false });
  if (face.text !== text) setFace({ text, from: face.text, value, up: value >= face.value, beat, gen: face.gen + 1, moves: beat !== face.beat && !reduced() });
  else if (face.beat !== beat) setFace({ ...face, beat });
  return face;
}

/** Where rolling text holds still when its length changes: its leading edge, or its middle. */
type Anchor = "start" | "center";

/** One glyph rolling in, or out with `out`: `travel` ems along y on the value spring (no overshoot), or only a fade at 0. */
function RollGlyph({ ch, travel, out = false, delay, color }: { ch: string; travel: number; out?: boolean; delay: number; color?: string }) {
  const { easing, ms: dur } = curve("value");
  const away = { transform: `translateY(${travel}em)`, opacity: 0, filter: "blur(0.05em)" }, home = { transform: "none", opacity: 1, filter: "blur(0)" };
  const ref = useEntrance<HTMLSpanElement>(out ? [home, away] : [away, home], { duration: dur, delay, easing, fill: "both" });
  return <span ref={ref} data-motion aria-hidden={out || undefined} className="inline-block" style={{ color }}>{ch}</span>;
}

/** One changed glyph in its slot: the old one leaves as the new one arrives from the side the value is heading. `fade` only fades it in. */
function Glyph({ ch, was, up, delay, color, fade = false }: { ch: string; was: string; up: boolean; delay: number; color?: string; fade?: boolean }) {
  const d = fade ? 0 : up ? 0.5 : -0.5;
  return (
    <span className="relative inline-block" style={{ color }}>
      {was ? <span className="absolute inset-0 text-center"><RollGlyph ch={was} travel={-d} out delay={delay} /></span> : null}
      <RollGlyph ch={ch} travel={d} delay={delay} />
    </span>
  );
}

/** A value of another length leaves whole from where it sat, glyph by glyph, so it is never redrawn in the new layout first. */
function Leaving({ text, cut, dim, travel, anchor }: { text: string; cut: number; dim?: string; travel: number; anchor: Anchor }) {
  return (
    <span aria-hidden className="absolute top-0 inline-flex" style={anchor === "center" ? { left: "50%", transform: "translateX(-50%)" } : { left: 0 }}>
      {text.split("").map((ch, k) => <RollGlyph key={k} ch={ch} travel={travel} out delay={k * 18} color={k >= cut ? dim : undefined} />)}
    </span>
  );
}

/**
 * Text whose changed characters roll to the new value, as SwiftUI's `.numericText` does: each changed one rolls on the
 * value spring (no overshoot, so it never shows a digit past its place), a beat apart from left to right. A value of the
 * same length rolls slot by slot; one of another length leaves whole from its `anchor` as the new one rolls in. With
 * `morph`, the width springs to each new length on that role, so whatever sits beside it glides instead of jumping.
 * With `dim`, everything from the decimal point on takes that colour.
 */
function Roll({ text, value, beat, dim, anchor = "start", morph }: { text: string; value: number; beat: unknown; dim?: string; anchor?: Anchor; morph?: Role }) {
  const face = useFace(text, value, beat);
  const row = useRef<HTMLSpanElement>(null);
  // Held in ems, so the measured width scales with the stage.
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = row.current;
    if (!morph || !el) return;
    const css = getComputedStyle(el);
    setWidth(parseFloat(css.width) / parseFloat(css.fontSize));
  }, [text, morph]);
  const cut = (s: string) => { const i = dim ? s.lastIndexOf(".") : -1; return i < 0 ? s.length : i; };
  const d = face.up ? 0.5 : -0.5, same = face.from.length === text.length, at = cut(text);
  return (
    <span className="inline-flex" style={{ justifyContent: anchor === "center" ? "center" : "flex-start", width: morph && width !== null ? `${width.toFixed(4)}em` : undefined, transition: morph && face.moves ? t("width", morph) : "none" }}>
      <span ref={row} className="relative inline-flex shrink-0" style={{ whiteSpace: "pre" }}>
        {face.moves && !same && face.from ? <Leaving key={face.gen} text={face.from} cut={cut(face.from)} dim={dim} travel={text ? -d : 0} anchor={anchor} /> : null}
        {text.split("").map((ch, k) => {
          const key = text.length - k, color = k >= at ? dim : undefined, was = same ? face.from[k] : "";
          return face.moves && was !== ch ? <Glyph key={`${key}:${face.gen}`} ch={ch} was={was} up={face.up} delay={k * 18} color={color} fade={!face.from} /> : <span key={key} style={{ color }}>{ch}</span>;
        })}
      </span>
    </span>
  );
}

/** A label that crossfades when its `beat` changes with it (SwiftUI's `.contentTransition(.opacity)`), on `role`. */
function Fade({ text, beat, role, align = "start" }: { text: string; beat: unknown; role: Role; align?: "start" | "center" }) {
  const face = useFace(text, 0, beat);
  return (
    <span className="inline-grid" style={{ justifyItems: align }}>
      {face.moves ? <FadeFace key={`o${face.gen}`} text={face.from} role={role} out /> : null}
      <FadeFace key={`n${face.gen}`} text={face.text} role={face.moves ? role : null} />
    </span>
  );
}

function FadeFace({ text, role, out = false }: { text: string; role: Role | null; out?: boolean }) {
  const { easing, ms: dur } = curve(role ?? "value");
  // The leaving label gives up its width once it has gone, so the next one is measured alone.
  const ref = useEntrance<HTMLSpanElement>(role ? [{ opacity: out ? 1 : 0 }, { opacity: out ? 0 : 1 }] : null, { duration: dur, easing, fill: "both" }, out ? (el) => { el.style.display = "none"; } : undefined);
  return <span ref={ref} data-motion aria-hidden={out || undefined} style={{ gridArea: "1 / 1", whiteSpace: "nowrap" }}>{text}</span>;
}

const usd = (v: number, frac = 2) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });

/** A light display-scale figure with its decimals dimmed. Given a `beat`, its digits roll when the beat changes with them. */
function Numeral({ text, size, value = 0, beat, color = ground.text, dim = ground.muted, anchor, morph }: { text: string; size: number; value?: number; beat?: unknown; color?: string; dim?: string; anchor?: Anchor; morph?: Role }) {
  const i = text.lastIndexOf(".");
  const whole = i < 0 ? text : text.slice(0, i), fraction = i < 0 ? "" : text.slice(i);
  return (
    <span style={{ fontSize: pt(size), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {beat === undefined ? <>{whole}<span style={{ color: dim }}>{fraction}</span></> : <Roll text={text} value={value} beat={beat} dim={dim} anchor={anchor} morph={morph} />}
    </span>
  );
}

function Arrow({ up, size = 10 }: { up: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: pt(size), height: pt(size), flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? "M7 17L17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9"} />
    </svg>
  );
}

/**
 * Up and down with ink: sage for up, red for down. `glassy` draws it as a tinted liquid glass chip (put it in a
 * `LiquidGroup`), where a `fill` of `null` leaves the glass clear; otherwise it is a tinted fill sitting on a surface.
 * A change of direction recolors it on `motion`, or at once with `null`. Figures leaving or arriving while it resizes
 * stay inside its sides; they still roll past its top and bottom.
 */
function DeltaChip({ up, children, fill, color = ink, motion = "snap", glassy = false }: { up: boolean; children: ReactNode; fill?: string | null; color?: string; motion?: Role | null; glassy?: boolean }) {
  const tint = fill === undefined ? (up ? blocks.sage : blocks.tangerine) : fill;
  const box: CSSProperties = { gap: pt(3), height: pt(22), paddingInline: pt(8), color, fontSize: pt(11), fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", clipPath: "inset(-1em 0)", transition: motion ? t(["background-color", "color"], motion) : "none" };
  if (glassy) return <Liquid tint={tint ?? undefined} className="inline-flex shrink-0 items-center" style={box}><Arrow up={up} />{children}</Liquid>;
  return <span className="inline-flex shrink-0 items-center rounded-full" style={{ ...box, background: tint ?? undefined }}><Arrow up={up} />{children}</span>;
}

function Stage({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>{children}</div>;
}

const meta: CSSProperties = { fontSize: pt(10), fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ground.muted };
const card = (extra?: CSSProperties): CSSProperties => ({ background: ground.surface, borderRadius: pt(30), ...extra });

type Pt = readonly [number, number];
/** A series on 0...1, so a chart's scale never jumps while it morphs between datasets. */
const normalize = (values: readonly number[]) => { const min = Math.min(...values), span = Math.max(...values) - min || 1; return values.map((v) => (v - min) / span); };
const place = (norm: number[], w: number, h: number, pad = 4): Pt[] => norm.map((v, i) => [pad + (i / (norm.length - 1)) * (w - pad * 2), pad + (1 - v) * (h - pad * 2)]);
const toPoints = (values: number[], w: number, h: number, pad = 4) => place(normalize(values), w, h, pad);
/** Catmull-Rom through the points as cubic beziers (SwiftUI `.catmullRom`). */
function smooth(p: Pt[]) {
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], e = p[Math.min(i + 2, p.length - 1)];
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}
const linear = (p: Pt[]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
/** SVG marks that scale or pop about their own center. */
const ownCenter: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

// MARK: Scrub Chart

const RANGES = [
  ["1D", [182.1, 182.6, 181.9, 183.4, 184.0, 183.2, 184.8, 185.3, 184.9, 186.1, 185.7, 186.4, 187.0], ["9 AM", "12 PM", "3 PM"]],
  ["1W", [176.3, 177.8, 179.1, 178.2, 180.4, 181.0, 179.7, 182.5, 183.9, 182.8, 184.6, 186.1, 185.4, 187.0], ["SEP 10", "SEP 13", "SEP 16"]],
  ["1M", [191.2, 189.4, 188.0, 186.7, 184.1, 185.9, 183.3, 181.8, 180.2, 182.6, 179.5, 178.1, 180.9, 182.4, 184.7, 187.0], ["AUG 18", "SEP 1", "SEP 16"]],
  ["1Y", [142.0, 150.3, 147.8, 158.2, 163.9, 160.1, 171.4, 176.0, 168.3, 179.9, 183.5, 187.0], ["SEP 25", "MAR 26", "SEP 26"]],
] as const;
const N = 32;
/** Every dataset is resampled to one count so a range switch morphs the line instead of redrawing it. */
const resample = (v: readonly number[]) => Array.from({ length: N }, (_, i) => { const x = (i / (N - 1)) * (v.length - 1), j = Math.floor(x), f = x - j; return v[j] + (v[Math.min(j + 1, v.length - 1)] - v[j]) * f; });
const stamp = (i: number) => { const days = ["WED", "THU", "FRI", "MON", "TUE"], d = days[Math.min(4, Math.floor((i / N) * 5))]; const h = 9 + Math.round((i % 6) * 1.2); return `${d} ${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`; };

/**
 * The chart's colour scheme and corner radius are CSS variables, so a host can restyle the whole piece
 * (the landing page's agent demo does). Each falls back to the house palette:
 * accent (scrub dot, picked range segment), line (the line, rules, flag date), surface (card, dot ring),
 * raised (held band), chip and down (the rising and falling delta glass), and `--scrub-radius` for the card. The glass
 * itself follows the site theme (`--pv-glass`).
 */
const SCRUB_ACCENT = `var(--scrub-accent, ${blocks.butter})`;
const SCRUB_LINE = `var(--scrub-line, ${ground.text})`;
const SCRUB_SURFACE = `var(--scrub-surface, ${ground.surface})`;
const SCRUB_RAISED = `var(--scrub-raised, ${ground.raised})`;
const SCRUB_CHIP = `var(--scrub-chip, ${blocks.sage})`;
const SCRUB_DOWN = `var(--scrub-down, ${blocks.tangerine})`;

/**
 * The finger on the chart: where it is, the point a hold last pinned, whether that pin holds now, and whether the last
 * change was the finger moving. Moves never animate; only touching down, pinning, letting go and range switches do.
 */
type ScrubFinger = { down: boolean; i: number; anchor: number; pinned: boolean; pins: number; moving: boolean };

/** The scrub flag's sizes in points, and the inner width of the card it rides in (320 less its padding). */
const FLAG = { w: 62, h: 20, bubble: 50, inner: 284 } as const;

/**
 * The glass flag riding the top of the rule, with the held range's change budding out of its side. It grows out of the
 * top of the rule as the finger lands and sinks back in on release; along the plot it tracks the finger with no easing.
 * While the change is out the flag keeps room for it, so the pair never leaves the card.
 */
function ScrubFlag({ x, label, shown, moving, change }: { x: number; label: string; shown: boolean; moving: boolean; change: { up: boolean; flat: boolean; pct: number } | null }) {
  const out = change !== null;
  // The change keeps what it last showed while it melts home.
  const last = useRef(change ?? { up: true, flat: true, pct: 0 });
  if (change) last.current = change;
  const c = last.current;
  const room = out ? liquid.joined + FLAG.bubble : 0;
  const cx = Math.min(Math.max(x, FLAG.w / 2), FLAG.inner - FLAG.w / 2 - room);
  return (
    <LiquidGroup unit={U} className="pointer-events-none" style={{ position: "absolute", left: 0, right: 0, top: pt(-6), height: pt(FLAG.h) }}>
      <span data-motion aria-hidden style={{
        position: "absolute", top: 0, left: pt(cx - FLAG.w / 2), width: pt(FLAG.w), height: pt(FLAG.h),
        transform: `scale(${shown ? 1 : 0.5})`, transformOrigin: "50% 100%", opacity: shown ? 1 : 0,
        transition: [t(["transform", "opacity"], shown ? "snap" : "dismiss"), moving ? "left 0ms" : t("left", out ? liquid.split : liquid.home)].join(", "),
      }}>
        {/* Its own glass shape beside the flag, so the two melt through a neck; first, so it slips under the date going home. */}
        <span style={{ position: "absolute", top: 0, left: "100%", marginLeft: pt(liquid.joined), ...budBeside(out) }}>
          <Liquid tint={out && !c.flat ? (c.up ? SCRUB_CHIP : SCRUB_DOWN) : undefined} className="flex items-center justify-center" style={{ width: pt(FLAG.bubble), height: pt(FLAG.h), gap: pt(2), fontSize: pt(9.5), fontWeight: 600, color: c.flat ? ground.muted : ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", transition: t("background-color", out ? "snap" : liquid.home) }}>
            <BudContent out={out}><Arrow up={c.up} size={8} /><span style={{ marginLeft: pt(2) }}>{c.pct.toFixed(1)}%</span></BudContent>
          </Liquid>
        </span>
        <Liquid className="relative flex items-center justify-center" style={{ width: pt(FLAG.w), height: pt(FLAG.h), fontSize: pt(8.5), fontWeight: 600, fontFamily: font.mono, color: SCRUB_LINE, whiteSpace: "nowrap" }}>{label}</Liquid>
      </span>
    </LiquidGroup>
  );
}

/**
 * Rest, then a scrub: touch-down brings the cursor in with the dot a beat ahead and the flag grows out of the rule, and
 * the rule, dot, flag and figure sit on the finger's point every frame. Lift. Then a hold pins an anchor (the dot pops),
 * the range's change buds out of the flag, the drag becomes a held range, release melts it back. Then two range switches
 * on the liquid segments: the picked one swells and takes the tint, the line bends with no overshoot, and the min and
 * max labels return once it lands.
 */
export function ScrubChartPreview() {
  const [range, setRange] = useState(1);
  const [f, setF] = useState<ScrubFinger>({ down: false, i: N - 1, anchor: 0, pinned: false, pins: 0, moving: false });
  const at = useRef(N - 1), path = useFingerPath();
  const down = (i: number) => { at.current = i; setF((s) => ({ ...s, down: true, i, pinned: false, moving: false })); };
  const drag = (to: number, dur: number) => path.move(at.current, to, dur, (i) => { at.current = i; setF((s) => ({ ...s, i, moving: true })); });
  const pin = () => setF((s) => (s.down ? { ...s, anchor: s.i, pinned: true, pins: s.pins + 1, moving: false } : s));
  const lift = () => { path.stop(); setF((s) => ({ ...s, down: false, moving: false })); };
  useTimeline(10000, [[0, () => setRange(1)], [1300, () => down(6)], [1450, () => drag(22, 1100)], [2900, lift], [3700, () => down(9)], [4000, pin], [4250, () => drag(26, 900)], [5350, () => drag(15, 700)], [6350, lift], [7200, () => setRange(2)], [8600, () => setRange(3)]]);

  // The min and max labels leave at once when the range changes and come back once the line has landed on it.
  const [landed, setLanded] = useState(range);
  useEffect(() => {
    if (landed === range) return;
    const id = setTimeout(() => setLanded(range), ms("value"));
    return () => clearTimeout(id);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  // A hold pins the anchor with a rigid tap: the dot under the finger pops on the same beat.
  const dot = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (!f.pins || !dot.current || reduced()) return;
    const a = dot.current.animate(...pop(0.25));
    return () => a.cancel();
  }, [f.pins]);

  const W = 280, H = 84;
  const data = resample(RANGES[range][1]), norm = normalize(data);
  // The line bends between datasets on the value spring: a chart value never overshoots.
  const shape = useSpring(norm, "value");
  const p = place(shape, W, H, 10), q = place(norm, W, H, 10);
  const phase = !f.down ? "idle" : f.pinned ? "range" : "scrub";
  // Touching down and pinning snap in; letting go clears firmly (Swift's phase animation).
  const motion: Role = phase === "idle" ? "dismiss" : "snap";
  // Figures roll when the phase or range changes and change at once while the finger moves.
  const beat = `${phase}:${range}`;
  // The readout block resizes on the change's own spring: the phase's (dismiss when letting go), or the snap of a range switch.
  const [cue, setCue] = useState<{ phase: string; range: number; role: Role }>({ phase, range, role: "snap" });
  if (cue.phase !== phase || cue.range !== range) setCue({ phase, range, role: cue.phase !== phase && phase === "idle" ? "dismiss" : "snap" });
  const head = cue.role;
  const active = f.down ? f.i : null;
  const lo = Math.min(f.anchor, f.i), hi = Math.max(f.anchor, f.i);
  const band = phase === "range" ? ([lo, hi] as const) : null;
  const top = norm.indexOf(1), bottom = norm.indexOf(0);
  const shown = band ? data[hi] - data[lo] : active !== null ? data[active] : data[N - 1];
  const chipFrom = band ? data[lo] : data[0], chipTo = band ? data[hi] : active !== null ? data[active] : data[N - 1];
  const change = chipTo - chipFrom, up = change >= 0, flat = Math.abs(change) < 0.005;
  const percent = Math.abs(change / chipFrom) * 100;
  const labels = !f.down && landed === range;
  return (
    <Stage>
      <div style={card({ width: pt(320), padding: `${pt(14)} ${pt(18)}`, background: SCRUB_SURFACE, borderRadius: `var(--scrub-radius, ${pt(30)})`, transition: t("border-radius", "morph") })}>
        <p style={meta}><Fade text={band ? `${stamp(lo)} – ${stamp(hi)}` : active !== null ? stamp(active) : `Latest · ${RANGES[range][0]}`} beat={beat} role={head} /></p>
        <div className="flex items-center" style={{ gap: pt(8), marginTop: pt(6) }}>
          {/* The figure's width springs with the phase, so the chip beside it glides instead of jumping. */}
          <Numeral text={(band ? (shown < 0 ? "−" : "+") : "") + usd(Math.abs(shown))} value={shown} beat={beat} size={32} morph={head} />
          <LiquidGroup unit={U} className="shrink-0">
            <DeltaChip glassy up={up} fill={flat ? null : up ? SCRUB_CHIP : SCRUB_DOWN} color={flat ? ground.muted : ink} motion={f.moving ? null : head}>
              {/* The amount stays mounted: a held range fades it while its slot closes, so the glass resizes with the snap's give. */}
              <span className="inline-flex">
                <Roll text={band ? "" : `${up ? "+" : "−"}${usd(Math.abs(change))}`} value={change} beat={beat} morph={head} />
                <span style={{ width: band ? 0 : pt(4), flexShrink: 0, transition: f.moving ? "none" : t("width", head) }} />
                <Roll text={`${percent.toFixed(1)}%`} value={percent} beat={beat} morph={head} />
              </span>
            </DeltaChip>
          </LiquidGroup>
        </div>
        <div className="relative" style={{ marginTop: pt(10) }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" aria-hidden>
          {/* The held band and its anchor rule follow the finger directly; only their arrival and exit animate. */}
          <rect data-motion x={p[lo][0]} width={p[hi][0] - p[lo][0]} y={0} height={H} rx={8} style={{ fill: SCRUB_RAISED, opacity: band ? 1 : 0, transition: t("opacity", motion) }} />
          <line x1={0} x2={W} y1={p[0][1]} y2={p[0][1]} strokeOpacity=".45" strokeDasharray="2 5" style={{ stroke: SCRUB_LINE }} />
          <path d={smooth(p)} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: SCRUB_LINE }} />
          <g data-motion style={{ opacity: labels ? 1 : 0, transition: labels ? t("opacity", "reveal") : landed !== range ? "none" : t("opacity", "snap") }} fill={ground.muted} fontSize={9} fontWeight={600} fontFamily={font.mono}>
            <text x={Math.min(q[top][0], W - 12)} textAnchor={q[top][0] > W - 60 ? "end" : "start"} y={Math.max(q[top][1] - 12, 8)}>{usd(data[top])}</text>
            <text x={Math.min(Math.max(q[bottom][0] - 20, 0), W - 48)} y={Math.min(q[bottom][1] + 16, H + 4)}>{usd(data[bottom])}</text>
          </g>
          <line x1={p[f.anchor][0]} x2={p[f.anchor][0]} y1={0} y2={H} strokeWidth={1.5} style={{ stroke: SCRUB_LINE, opacity: band ? 1 : 0, transition: t("opacity", motion) }} />
          <line data-motion x1={p[f.i][0]} x2={p[f.i][0]} y1={0} y2={H} strokeWidth={1.5} style={{ stroke: SCRUB_LINE, opacity: f.down ? 1 : 0, transition: t("opacity", motion) }} />
          {/* At rest the latest value wears the accent and rides the end of the line through a morph. */}
          <circle cx={p[N - 1][0]} cy={p[N - 1][1]} r={7} strokeWidth={3} style={{ fill: SCRUB_ACCENT, stroke: SCRUB_SURFACE, opacity: f.down ? 0 : 1, transition: t("opacity", motion) }} />
          {/* Under the finger the dot lands on the press spring, a beat ahead of the rule and the readout. */}
          <circle ref={dot} data-motion cx={p[f.i][0]} cy={p[f.i][1]} r={7} strokeWidth={3} style={{ ...ownCenter, fill: SCRUB_ACCENT, stroke: SCRUB_SURFACE, opacity: f.down ? 1 : 0, transition: t("opacity", f.down ? "press" : "dismiss") }} />
        </svg>
        <ScrubFlag x={(p[f.i][0] * FLAG.inner) / W} label={stamp(f.i)} shown={f.down} moving={f.moving} change={band ? { up, flat, pct: percent } : null} />
        </div>
        <div className="flex justify-between" style={{ ...meta, fontSize: pt(9), marginTop: pt(8) }}>{RANGES[range][2].map((l) => <span key={l}>{l}</span>)}</div>
        {/* Liquid segments joined by necks: the picked one swells and takes the accent, which flows to it through the necks. */}
        <LiquidGroup unit={U} style={{ marginTop: pt(10) }}>
          <div className="flex" style={{ gap: pt(liquid.joined) }}>
            {RANGES.map(([l], i) => (
              <Liquid key={l} tint={i === range ? SCRUB_ACCENT : undefined} className="flex items-center justify-center" style={{ flexGrow: i === range ? 1.28 : 1, flexBasis: 0, height: pt(32), fontSize: pt(12), fontWeight: 600, color: i === range ? ink : ground.muted, transition: t(["flex-grow", "background-color", "color"], "snap") }}>{l}</Liquid>
            ))}
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

// MARK: Ring Breakdown

const SLICES = [["Housing", 1450], ["Food", 620], ["Transport", 310], ["Leisure", 270], ["Other", 150]] as const;
const SLICE_COLORS = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac];
const TOTAL = SLICES.reduce((s, [, v]) => s + v, 0);
/** The ring's entrance: slower than `reveal` so a full turn reads as a sweep, and no bounce, so it never passes a full turn. */
const SWEEP: Spring = { duration: 0.7, bounce: 0 };
/** What steps back follows the selected wedge a beat later on a calmer spring (Swift's `follow(calm, rank: 1)`). */
const STEP_BACK = follow("reveal", 1);

/**
 * An annular sector in a 0...200 box, pulled in by `inset` points along each edge at both radii, so
 * the seam between slices is the same width from the hole to the rim (as the Swift piece draws it).
 */
function sector(a0: number, a1: number, r0: number, r1: number, inset = 0) {
  const pt2 = (a: number, r: number) => `${(100 + Math.cos(a) * r).toFixed(2)} ${(100 + Math.sin(a) * r).toFixed(2)}`;
  const o0 = a0 + inset / r1, o1 = Math.max(o0, a1 - inset / r1), i0 = a0 + inset / r0, i1 = Math.max(i0, a1 - inset / r0);
  const large = (x: number, y: number) => (y - x > Math.PI ? 1 : 0);
  return `M${pt2(o0, r1)} A${r1} ${r1} 0 ${large(o0, o1)} 1 ${pt2(o1, r1)} L${pt2(i1, r0)} A${r0} ${r0} 0 ${large(i0, i1)} 0 ${pt2(i0, r0)} Z`;
}

/** The center pill's height and the share chip's width, in points. */
const PILL = { h: 20, share: 34 } as const;

/**
 * Rests, then walks the selection: the slice pulls out with visible give and drops back firmly, the rest step back a
 * beat later, the center pill's name morphs letter by letter and the figure rolls, the share buds out of the pill
 * tinted with the slice's color and joined to it by a neck, and the picked legend chip takes the slice's tint on the
 * selection's snap. Clearing melts the share back into the pill.
 */
export function RingBreakdownPreview() {
  // Phase 0 hides the ring for one frame at the end of the loop, so each cycle sweeps it back in; the first frame is the resting ring.
  const [phase, setPhase] = useState(1);
  useTimeline(7600, [[0, () => setPhase(1)], [1800, () => setPhase(2)], [2900, () => setPhase(3)], [4000, () => setPhase(4)], [5100, () => setPhase(5)], [6300, () => setPhase(6)], [7500, () => setPhase(0)]]);
  const sel: number | null = [null, null, 0, 1, 2, 3, null][phase];
  // The share melts home showing the slice it showed.
  const last = useRef(0);
  if (sel !== null) last.current = sel;
  const share = Math.round((SLICES[last.current][1] / TOTAL) * 100);
  const out = sel !== null;
  const sweep = curve(SWEEP);
  // SEAM: the gap between slices in points; each edge also pulls in by the 6-point stroke's half-width.
  const R1 = 94, R0 = 60, SEAM = 4;
  let cum = -Math.PI / 2;
  return (
    <Stage>
      <div className="flex items-center" style={{ gap: pt(22), width: pt(360) }}>
        <div className="relative shrink-0" style={{ width: pt(168), height: pt(168) }}>
          <svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-hidden>
            <defs><mask id="rb-sweep"><circle data-motion cx="100" cy="100" r="50" fill="none" stroke="#fff" strokeWidth="100" pathLength={100} strokeDasharray="100 100" transform="rotate(-90 100 100)" style={{ strokeDashoffset: phase === 0 ? 100 : 0, transition: phase === 0 ? "none" : `stroke-dashoffset ${sweep.ms}ms ${sweep.easing}` }} />{/* Once a sweep has opened, the mask fills in whole, so its start and end never meet as a hairline at the top. */}<rect width="200" height="200" fill="#fff" style={{ opacity: phase === 0 ? 0 : 1, transition: phase === 0 ? "none" : `opacity 0s linear ${sweep.ms}ms` }} /></mask></defs>
            <g mask="url(#rb-sweep)">
              {SLICES.map(([label, v], i) => {
                const span = (v / TOTAL) * Math.PI * 2, a0 = cum, a1 = cum + span, mid = cum + span / 2;
                cum += span;
                // Reduce Motion drops the lift; the colour and the shadow stay.
                const hot = sel === i, stepped = sel !== null && !hot, lift = hot && !reduced() ? 7 : 0;
                const fill = stepped ? REST : SLICE_COLORS[i];
                // The lift and its shadow lead with visible give and drop back on the snap; only the colour steps back, a beat behind.
                return (
                  <path key={label} data-motion d={sector(a0, a1, R0 + 3, R1 - 3, SEAM / 2 + 3)} strokeWidth={6} strokeLinejoin="round"
                    style={{ fill, stroke: fill, transform: `translate(${(Math.cos(mid) * lift).toFixed(1)}px, ${(Math.sin(mid) * lift).toFixed(1)}px)`, filter: `drop-shadow(0 6px 10px rgba(0,0,0,${hot ? 0.4 : 0}))`, transition: `${t(["transform", "filter"], hot ? follow("release", 0) : "snap")}, ${t(["fill", "stroke"], stepped ? STEP_BACK : "snap")}` }} />
                );
              })}
            </g>
          </svg>
          {/* The readout: a glass pill names the selection and the figure rolls without overshoot below it. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: pt(6) }}>
            <LiquidGroup unit={U}>
              {/* While the share is out the pair slides over, so it stays centered in the hole. */}
              <span data-motion className="relative flex" style={{ transform: `translateX(${pt(out ? -(liquid.joined + PILL.share) / 2 : 0)})`, transition: t("transform", out ? liquid.split : liquid.home) }}>
                {/* Its own glass shape past the pill's end, joined by a neck; first, so it slips under the name going home. */}
                <span style={{ position: "absolute", top: 0, left: "100%", marginLeft: pt(liquid.joined), ...budBeside(out) }}>
                  <Liquid tint={out ? SLICE_COLORS[last.current] : undefined} className="flex items-center justify-center" style={{ width: pt(PILL.share), height: pt(PILL.h), fontSize: pt(9.5), fontWeight: 600, color: ink, fontVariantNumeric: "tabular-nums", transition: t("background-color", out ? "snap" : liquid.home) }}>
                    <BudContent out={out}><Roll text={`${share}%`} value={share} beat={sel} anchor="center" /></BudContent>
                  </Liquid>
                </span>
                <Liquid className="relative flex items-center" style={{ height: pt(PILL.h), paddingInline: pt(9), ...meta, fontSize: pt(8.5), letterSpacing: "0.12em" }}>
                  <MorphText text={sel === null ? "TOTAL" : SLICES[sel][0].toUpperCase()} />
                </Liquid>
              </span>
            </LiquidGroup>
            <Numeral text={usd(sel === null ? TOTAL : SLICES[sel][1], 0)} value={sel === null ? TOTAL : SLICES[sel][1]} beat={sel} size={24} anchor="center" />
          </div>
        </div>
        {/* The legend: glass chips resting apart. The picked chip takes its slice's tint; the others' text steps back while their glass stays whole. */}
        <LiquidGroup unit={U} axis="y" className="min-w-0 flex-1">
          <div className="flex flex-col" style={{ gap: pt(liquid.apart) }}>
            {SLICES.map(([label, v], i) => {
              const hot = sel === i, stepped = sel !== null && !hot;
              const motion = stepped ? STEP_BACK : "snap";
              return (
                <Liquid key={label} tint={hot ? SLICE_COLORS[i] : undefined} className="flex items-center" style={{ height: pt(26), paddingInline: pt(10), color: hot ? ink : ground.text, transition: t(["background-color", "color"], motion) }}>
                  <span data-motion className="flex min-w-0 flex-1 items-center" style={{ gap: pt(8), opacity: stepped ? 0.62 : 1, transition: t("opacity", motion) }}>
                    <span style={{ width: pt(10), height: pt(10), borderRadius: pt(3), background: hot ? ink : SLICE_COLORS[i], flexShrink: 0, transition: t("background-color", motion) }} />
                    <span className="flex-1 truncate" style={{ fontSize: pt(12), fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: pt(12), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{usd(v, 0)}</span>
                  </span>
                </Liquid>
              );
            })}
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

// MARK: Live Stat

const HISTORY = [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25];
/** The tile is a weighted card: it dips about 2.5 points per edge, and a hold that arms the scrub sinks it to 3.5. */
const TILE_PRESS = pressScale(330, 170), TILE_HOLD = pressScale(330, 170, 3.5) / TILE_PRESS;
/** Swift's `pressAnchor`: partway from the center toward the touch, so the press leans into the finger without tipping. */
const lean = (x: number, y: number) => `${(50 + (x - 0.5) * 60).toFixed(1)}% ${(50 + (y - 0.5) * 60).toFixed(1)}%`;

function Spark({ values, w, h, scrub, cursor, bead, beadRole, drawn, detail }: { values: number[]; w: number; h: number; scrub: number | null; cursor: number; bead: boolean; beadRole: Role; drawn: boolean; detail: boolean }) {
  const p = toPoints(values, w, h, 8), at = p[cursor], tip = p[values.length - 1];
  // While held, the bead catches the line under the finger with a pop on the soft tap's beat, lifted a little.
  const caught = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (scrub === null || !caught.current || reduced()) return;
    const { easing, ms: dur } = curve("success");
    const a = caught.current.animate([{ transform: "scale(0.46)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1 }], { duration: dur, easing });
    return () => a.cancel();
  }, [scrub === null]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // The line draws on with Swift's ease-out over a second; the bead waits for it to reach the tip.
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full overflow-visible" style={{ height: pt(h), clipPath: drawn ? "inset(-30% -5% -30% -5%)" : "inset(-30% 100% -30% -5%)", transition: drawn ? "clip-path 1000ms cubic-bezier(0, 0, 0.58, 1)" : "none" }} preserveAspectRatio="none" aria-hidden>
      {/* The dashed baseline at the first value rides the scale as the drawer opens and fades in a beat behind it. */}
      <line x1={0} x2={w} y1={p[0][1]} y2={p[0][1]} stroke={ground.muted} strokeOpacity={0.6} strokeDasharray="2 5" vectorEffect="non-scaling-stroke" style={{ opacity: detail ? 1 : 0, transition: t("opacity", detail ? follow("reveal", 2) : "dismiss") }} />
      {/* The scrub's start lands on the snap; a lift fades the rule and the scrub bead on the release that grows the resting one back. */}
      <line data-motion x1={at[0]} x2={at[0]} y1={0} y2={h} stroke={ground.text} strokeWidth={1.5} style={{ opacity: scrub === null ? 0 : 1, transition: t("opacity", scrub === null ? beadRole : "snap") }} />
      <path d={linear(p)} fill="none" stroke={ground.text} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: detail ? 3 : 2.5, transition: t("stroke-width", detail ? "reveal" : "dismiss") }} />
      <circle data-motion cx={tip[0]} cy={tip[1]} r={6} fill={blocks.butter} stroke={glass.solid} strokeWidth={3} style={{ ...ownCenter, opacity: bead ? 1 : 0, transform: `scale(${bead ? 1 : 0.4})`, transition: drawn ? t(["opacity", "transform"], beadRole) : "none" }} />
      <circle ref={caught} data-motion cx={at[0]} cy={at[1]} r={6} fill={blocks.butter} stroke={glass.solid} strokeWidth={3} style={{ ...ownCenter, transform: "scale(1.15)", filter: "drop-shadow(0 1.5px 1.5px rgba(0,0,0,.2))", opacity: scrub === null ? 0 : 1, transition: scrub === null ? t("opacity", beadRole) : "none" }} />
    </svg>
  );
}

/** What the scripted thumb is doing to the tile, and what the tile shows. `roll` is the figure's next roll in seconds. */
type TileState = { drawn: boolean; settled: boolean; pressed: boolean; sinking: boolean; at: string; scrub: number | null; cursor: number; roll: number; beadRole: Role; expanded: boolean };

/** The tile's width and padding, and the scrub flag's size, in points. */
const TILE = { w: 330, pad: 20, flagW: 56, flagH: 20 } as const;

/**
 * The scrub flag: the change from the scrubbed point to the latest one, on glass a neck's width above the panel's top
 * edge, right over the point. It buds out of the edge, rides along it with the finger, and melts back in on release.
 */
function StatFlag({ index }: { index: number | null }) {
  const out = index !== null;
  // It melts home showing the point it showed.
  const last = useRef(index ?? 9);
  if (index !== null) last.current = index;
  const i = last.current;
  const change = (HISTORY[HISTORY.length - 1] - HISTORY[i]) / HISTORY[i];
  const up = change >= 0, flat = Math.abs(change) < 0.0005;
  const x = TILE.pad + toPoints(HISTORY, TILE.w - TILE.pad * 2, 52, 8)[i][0];
  const left = Math.min(Math.max(x - TILE.flagW / 2, 0), TILE.w - TILE.flagW);
  // Home is shrunk just inside the panel's top edge, wholly within it, so at rest it is one with the panel.
  const bud = { out, rest: [0, -(TILE.flagH + liquid.joined)] as [number, number], home: [0, 1 - (TILE.flagH * (1 - liquid.homeScale)) / 2] as [number, number] };
  return (
    // Along the edge it tracks the finger directly; only the bud springs.
    <span aria-hidden style={{ position: "absolute", top: 0, left: pt(left), zIndex: 1 }}>
      <Liquid tint={out && !flat ? (up ? blocks.sage : blocks.tangerine) : undefined} bud={bud} className="flex items-center justify-center" style={{ width: pt(TILE.flagW), height: pt(TILE.flagH), gap: pt(2), fontSize: pt(9.5), fontWeight: 600, color: flat ? ground.muted : ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        <BudContent out={out}><Arrow up={up} size={8} /><span style={{ marginLeft: pt(2) }}>{`${(Math.abs(change) * 100).toFixed(1)}%`}</span></BudContent>
      </Liquid>
    </span>
  );
}

/**
 * The tile alone, a liquid glass panel: the value counts up as the line draws on and the bead lands once it has. Then a
 * hold that sinks the card, springs it back as the bead catches the line with a pop, and scrubs while a glass flag buds
 * out of the panel's top edge above the point; release rolls the value back, the flag melts in and the bead lands on the
 * tip. Then a tap opens the chart like a drawer, and a second tap closes it, a little quicker.
 */
export function LiveStatPreview() {
  const [s, setS] = useState<TileState>({ drawn: true, settled: true, pressed: false, sinking: false, at: lean(0.5, 0.5), scrub: null, cursor: 9, roll: 0, beadRole: "snap", expanded: false });
  const patch = (next: Partial<TileState>) => setS((o) => ({ ...o, ...next }));
  const path = useFingerPath();
  useTimeline(9600, [
    [0, () => patch({ drawn: true, roll: 1.2 })],
    [1000, () => patch({ settled: true, beadRole: "success" })],
    [2500, () => patch({ pressed: true, sinking: true, at: lean(0.36, 0.76) })],
    [2780, () => patch({ pressed: false, sinking: false, scrub: 3, cursor: 3, roll: 0.3, beadRole: "snap" })],
    [2950, () => path.move(3, 7, 950, (i) => patch({ scrub: i, cursor: i }))],
    // The lift puts energy in: the resting bead grows back on the tip with the release's give.
    [4200, () => { path.stop(); patch({ scrub: null, roll: 0.5, beadRole: "release" }); }],
    [5200, () => patch({ pressed: true, sinking: true, at: lean(0.62, 0.42) })],
    [5340, () => patch({ pressed: false, sinking: false, expanded: true })],
    [7400, () => patch({ pressed: true, sinking: true, at: lean(0.55, 0.3) })],
    [7540, () => patch({ pressed: false, sinking: false, expanded: false })],
    // One frame empty at the end of the loop, so each cycle opens with the entrance; the first frame is the resting tile.
    [9500, () => patch({ drawn: false, settled: false, roll: 0 })],
  ]);
  // Every roll of the figure is a spring with no bounce: a slow count-up, quick scrub steps, a measured roll back.
  const [value] = useSpring([!s.drawn ? 0 : (s.scrub === null ? HISTORY[9] : HISTORY[s.scrub]) * 1000], s.roll ? { duration: s.roll, bounce: 0 } : 0, 0.004);
  // The drawer opens on the calm reveal and closes on the quicker dismiss.
  const [h] = useSpring([s.expanded ? 128 : 52], s.expanded ? "reveal" : "dismiss");
  // Under Reduce Motion the press dims the tile toward the text colour instead of scaling or sinking it.
  const still = reduced();
  return (
    <Stage>
      {/* While a hold arms the scrub the card keeps sinking on the hold's own clock, then springs back up. */}
      <div style={{ transform: `scale(${s.sinking && !still ? TILE_HOLD : 1})`, transformOrigin: s.at, transition: s.sinking ? "transform 180ms linear 100ms" : t("transform", "release") }}>
        <div data-motion style={{ width: pt(TILE.w), filter: `brightness(${s.pressed && still ? 0.94 : 1})`, transform: `scale(${s.pressed && !still ? TILE_PRESS : 1})`, transformOrigin: s.at, transition: t(["transform", "filter"], s.pressed ? "press" : "release") }}>
        <LiquidGroup unit={U} axis="y">
          <StatFlag index={s.scrub} />
          <Liquid radius={20} style={{ padding: pt(TILE.pad) }}>
          <div className="flex items-center justify-between">
            <span style={meta}>Revenue</span>
            <span data-motion style={{ opacity: s.scrub === null ? 1 : 0.35, transition: t("opacity", s.scrub === null ? "dismiss" : "snap") }}><DeltaChip up>12.4%</DeltaChip></span>
          </div>
          <div style={{ marginTop: pt(8) }}><Numeral text={usd(value)} size={40} /></div>
          <div style={{ marginTop: pt(14) }}><Spark values={HISTORY} w={290} h={h} scrub={s.scrub} cursor={s.cursor} bead={s.settled && s.scrub === null} beadRole={s.beadRole} drawn={s.drawn} detail={s.expanded} /></div>
          <div data-motion className="flex overflow-hidden" style={{ gap: pt(14), maxHeight: s.expanded ? pt(22) : 0, opacity: s.expanded ? 1 : 0, marginTop: s.expanded ? pt(10) : 0, transition: t(["max-height", "margin-top", "opacity"], s.expanded ? "reveal" : "dismiss") }}>
            <span style={meta}>Low <span style={{ color: ground.text, fontFamily: font.mono }}>$31,200.00</span></span>
            <span style={meta}>High <span style={{ color: ground.text, fontFamily: font.mono }}>$48,250.00</span></span>
          </div>
          </Liquid>
        </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Odometer

/** One digit slot. `r` is the fractional roll (3.4 shows 3 leaving and 4 arriving); while between faces its edges soften. */
function Slot({ r, loading, color, reveal = 1 }: { r: number; loading: boolean; color: string; reveal?: number }) {
  const d = Math.floor(r) % 10, f = r - Math.floor(r);
  // The softening eases in over the first 8% of a turn and out over the last 8%, so the edges sharpen as a digit seats.
  const edge = 22 * Math.min(1, Math.min(f, 1 - f) / 0.08);
  const mask = !loading && edge > 0.05 ? `linear-gradient(to bottom, transparent, #000 ${edge.toFixed(1)}%, #000 ${(100 - edge).toFixed(1)}%, transparent)` : "none";
  // Narrowed slots keep their digit at the trailing edge, the way the drum folds away toward the number.
  const face = "absolute right-0 top-0 h-full text-center";
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: "1.1em", width: `${(0.62 * reveal).toFixed(3)}em`, opacity: reveal, color, WebkitMaskImage: mask, maskImage: mask }}>
      {loading ? <span className={face} style={{ width: "0.62em" }}>–</span> : (
        <>
          <span className={face} style={{ width: "0.62em", transform: `translateY(${(-f * 100).toFixed(1)}%)` }}>{d}</span>
          <span className={face} style={{ width: "0.62em", transform: `translateY(${((1 - f) * 100).toFixed(1)}%)` }}>{(d + 1) % 10}</span>
        </>
      )}
    </span>
  );
}

/** Every digit derives its roll from one number, carrying upward only while the digit below passes 9. Decimals are dimmed. */
function Tape({ value, loading }: { value: number; loading: boolean }) {
  const scaled = Math.max(0, value) * 100;
  const roll = (p: number): number => {
    if (p === 0) return scaled % 10;
    const lower = roll(p - 1);
    return (Math.floor(scaled / 10 ** p) % 10) + (lower >= 9 ? lower - 9 : 0);
  };
  // High slots that still read zero collapse and grow in as the carry reaches them; the separator between them narrows with them.
  const reveal: number[] = [];
  let hidden = true, carry = 0, comma = 1;
  for (let p = 6; p >= 2; p--) {
    const r = roll(p);
    if (hidden && p > 2 && r < 1) { carry = r; reveal[p] = loading ? 1 : r; } else { hidden = false; reveal[p] = 1; }
    if (p === 5) comma = hidden && !loading ? carry : 1;
  }
  const out: ReactNode[] = [<span key="$" style={{ color: loading ? ground.subtle : ground.text }}>$</span>];
  for (let p = 6; p >= 0; p--) {
    const dim = p < 2;
    if (p === 1) out.push(<span key="dot" style={{ color: ground.subtle }}>.</span>);
    if (p === 4) out.push(<span key="comma" className="inline-block overflow-hidden" style={{ color: loading ? ground.subtle : ground.text, opacity: comma, maxWidth: comma < 1 ? `${(comma * 0.3).toFixed(3)}em` : undefined }}>,</span>);
    out.push(<Slot key={p} r={roll(p)} loading={loading} reveal={reveal[p] ?? 1} color={loading ? ground.subtle : dim ? ground.subtle : ground.text} />);
  }
  return <span className="inline-flex items-center" style={{ lineHeight: "1.1em", fontVariantNumeric: "tabular-nums" }}>{out}</span>;
}

/** The drum's pacing: no bounce, so it never shows a digit the value never had. Every change here reaches Swift's 1.2 s cap. */
const DRUM: Spring = { duration: 1.2, bounce: 0 };

/** The delta block: what it shows, whether it is out, and whether a change to it moves (a swap while hidden does not). */
type DeltaPill = { delta: number | null; shown: boolean; moves: boolean };

/**
 * The number alone: rest, a deposit, rent, then dashes while loading and a roll up from zero. The roll leads; the delta
 * is tinted glass that buds out from behind the number's last digit with visible give, as the number makes room on the
 * snap, rests a neck's width beside it, and melts back behind the digits, fading as it gets there.
 */
export function OdometerPreview() {
  // 1 rest, 2 deposit, 3 rent, 0 loading dashes, then the next cycle rolls up from zero.
  const [phase, setPhase] = useState(1);
  useTimeline(9000, [[0, () => setPhase(1)], [1800, () => setPhase(2)], [4400, () => setPhase(3)], [7600, () => setPhase(0)]]);
  const target = [12480.55, 12480.55, 12997.55, 11547.55][phase];
  // A change mid-roll merges into the turning drum; behind the dashes the tape drops to zero at once.
  const [rolled] = useSpring([phase === 0 ? 0 : target], phase === 0 ? 0 : DRUM, 1e-4);
  const delta = phase === 2 ? 517 : phase === 3 ? -1450 : null;
  const [pill, setPill] = useState<DeltaPill>({ delta: null, shown: false, moves: false });
  useEffect(() => {
    if (delta === null) { setPill((c) => ({ ...c, shown: false, moves: true })); return; }
    // A change while the block is out updates it in place; otherwise it takes the new amount while hidden, then comes out.
    setPill((c) => (c.shown ? { delta, shown: true, moves: true } : { delta, shown: false, moves: false }));
    const out = setTimeout(() => setPill({ delta, shown: true, moves: true }), cascade(3));
    const away = setTimeout(() => setPill((c) => ({ ...c, shown: false, moves: true })), 1600);
    return () => { clearTimeout(out); clearTimeout(away); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // The row stays centered on the number while the chip is away, so making room is a transform, not a layout jump.
  // Measured in container units, so it holds at every stage size.
  const row = useRef<HTMLDivElement>(null), number = useRef<HTMLSpanElement>(null);
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const stage = row.current?.parentElement;
    if (row.current && number.current && stage?.offsetWidth) setRoom(((row.current.offsetWidth - number.current.offsetWidth) / 2) * (100 / stage.offsetWidth));
  }, [pill.delta]);
  // The number makes room on the snap while the chip buds out on the split spring; it closes up on the dismiss as the chip melts home.
  const motion: Role = pill.shown ? "snap" : "dismiss";
  return (
    <Stage>
      <div ref={row} data-motion className="flex items-center" style={{ gap: pt(liquid.joined), height: pt(58), transform: `translateX(${pill.shown ? 0 : room.toFixed(3)}cqw)`, transition: pill.moves ? t("transform", motion) : "none" }}>
        {/* Above the chip, so it slips behind the digits going home. */}
        <span ref={number} className="relative" style={{ zIndex: 1, fontSize: pt(46), fontWeight: font.numeralWeight, letterSpacing: "-0.02em" }}><Tape value={rolled} loading={phase === 0} /></span>
        <LiquidGroup unit={U}>
          {/* With no glass to melt into, it fades as it slips behind the digits, gone by the time it is home. */}
          <span data-motion className="block" style={{ ...budBeside(pill.shown), opacity: pill.shown ? 1 : 0, transition: pill.moves ? `${budBeside(pill.shown).transition}, ${pill.shown ? "opacity 150ms ease-out" : "opacity 220ms ease-in 120ms"}` : "none" }}>
            {pill.delta !== null ? (
              <DeltaChip glassy up={pill.delta > 0} fill={pill.shown ? undefined : null} motion={pill.moves ? "snap" : null}>
                <BudContent out={pill.shown}>
                  <Roll text={`${pill.delta > 0 ? "+" : "−"}${usd(Math.abs(pill.delta))}`} value={pill.delta} beat={pill.shown ? pill.delta : "away"} />
                </BudContent>
              </DeltaChip>
            ) : null}
          </span>
        </LiquidGroup>
      </div>
    </Stage>
  );
}
