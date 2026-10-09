"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, follow, ms, pop, pressScale, reduced, rubberBand, shake, t, tiers } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Inputs: Expanding Track, Scrub Stepper, Filter Rail, Secure Entry.
 * Each preview shows the component and nothing else: no card around it, no headings, no invented app UI.
 * The only text is what the component itself renders (its label, its readout, its chips).
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`, so the stage scales as one picture.
 * Motion uses piece-motion's roles, as the Swift pieces do: presses land firm, releases and landings spring,
 * and whatever a scripted finger drags tracks it linearly over the step, so it stays under the finger.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

/** A finger moving over one scripted step: linear, so the surface keeps pace with it instead of easing in. */
const tracking = (props: string | string[], ms: number) => (Array.isArray(props) ? props : [props]).map((p) => `${p} ${Math.round(ms)}ms linear`).join(", ");

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

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the first (resting) state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return steps[i];
}

const glyphs = {
  speaker: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  sun: "M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  check: "M5 12.5l4.5 4.5L19 7",
  xmark: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z",
  eyeSlash: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6ZM4.5 4l15 16",
  bang: "M12 6v7.5M12 17.6v.2",
} as const;

function Glyph({ name, size, stroke = 2.4, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={glyphs[name]} />
    </svg>
  );
}

/** The charcoal ground. Nothing sits on it but the component. */
function Stage({ children, width = 440, scale = 1 }: { children: ReactNode; width?: number; scale?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <div style={{ width: u(width), transform: scale === 1 ? undefined : `scale(${scale})` }}>{children}</div>
    </div>
  );
}

const meta: CSSProperties = { fontSize: u(11), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted, textTransform: "uppercase", lineHeight: 1 };

/** The digit roll `.numericText` plays: new digits rise in when the number grows and drop in when it shrinks. */
const rollKeyframes = "@keyframes in-roll{from{transform:translateY(var(--roll,40%));opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}";

/**
 * Text that rolls to a new value on `value`, never past it, so the digits never show a number that isn't true.
 * With `roll` off it changes in place, as digits under a finger do.
 */
function Roll({ text, n, roll, children }: { text: string; n: number; roll: boolean; children?: ReactNode }) {
  const last = useRef(n), mounted = useRef(false);
  const up = n >= last.current;
  useEffect(() => { last.current = n; mounted.current = true; }, [n]);
  return <RollFace key={text} roll={roll && mounted.current} up={up}>{children ?? text}</RollFace>;
}

/** One value's face. Whether it rolls is fixed when it mounts, so a later change of `roll` never replays it. */
function RollFace({ roll, up, children }: { roll: boolean; up: boolean; children: ReactNode }) {
  const [style] = useState(() => {
    const { easing, ms } = curve("value");
    return { display: "inline-block", "--roll": up ? "40%" : "-40%", animation: roll ? `in-roll ${ms}ms ${easing} both` : undefined } as CSSProperties;
  });
  return <span data-motion style={style}>{children}</span>;
}

/** A number whose decimals read quieter, as `ExpandingTrack` draws its title numeral. */
function Numeral({ value, size, n = 0, roll = false }: { value: string; size: number; n?: number; roll?: boolean }) {
  const cut = value.lastIndexOf(".");
  const whole = cut > 0 ? value.slice(0, cut) : value, frac = cut > 0 ? value.slice(cut) : "";
  return (
    <span className="tabular-nums" style={{ fontSize: u(size), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1 }}>
      <Roll text={value} n={n} roll={roll}>{whole}<span style={{ color: ground.muted }}>{frac}</span></Roll>
    </span>
  );
}

// MARK: Expanding Track

/**
 * `move` is how the value got here: "jump" for a touch-down (the fill edge lands under the finger at once), "track"
 * for a finger moving over the step. Without it the change is programmatic: the fill lands on `snap` and the numeral
 * rolls on `value`.
 * `over` is how far, in px, the finger pushes past the upper end.
 */
type TrackState = { vol: number; lo: number; active: "" | "vol" | "lo"; move?: "jump" | "track"; over?: number; ms: number };
/** A finger dragging from `a` to `b` over `ms`, cut into short linear steps so the readout keeps pace with the fill edge. */
const glide = (a: number, b: number, ms: number, at: (v: number) => Pick<TrackState, "vol" | "lo" | "active">): TrackState[] => {
  const n = Math.max(1, Math.round(ms / 70));
  return Array.from({ length: n }, (_, i) => ({ ...at(a + ((b - a) * (i + 1)) / n), move: "track", ms: ms / n }));
};
const trackSteps: readonly TrackState[] = [
  { vol: 0.62, lo: 0.2, active: "", ms: 1400 },
  { vol: 0.66, lo: 0.2, active: "vol", move: "jump", ms: 260 },
  ...glide(0.66, 1, 560, (vol) => ({ vol, lo: 0.2, active: "vol" })),
  { vol: 1, lo: 0.2, active: "vol", move: "track", over: 45, ms: 200 },
  { vol: 1, lo: 0.2, active: "vol", move: "track", over: 100, ms: 260 },
  { vol: 1, lo: 0.2, active: "vol", move: "track", over: 100, ms: 260 },
  { vol: 1, lo: 0.2, active: "", ms: 1000 },
  { vol: 1, lo: 0.2, active: "lo", move: "jump", ms: 260 },
  // Price steps by $5, so the lower edge moves a detent at a time.
  ...glide(0.2, 0.4, 560, (lo) => ({ vol: 1, lo, active: "lo" })),
  { vol: 1, lo: 0.4, active: "lo", move: "track", ms: 220 },
  { vol: 1, lo: 0.4, active: "", ms: 1100 },
  { vol: 0.62, lo: 0.2, active: "", ms: 900 },
];

/** The most the bar gives past an end: Swift's 24pt, scaled to this stage's track. */
const SQUISH = 34;
/** The readout bubble's height, and the resting bar it shrinks to fit inside on its way home. */
const READOUT_H = 30, REST_H = 8;

/**
 * The liquid track, as the Swift piece: a glass bar with the fill inside it, swelling under the finger. An untitled
 * track (`readout` set) buds its value up out of the bar on a glass bubble that rides the held edge a neck's width
 * above it, and melts back in on release.
 */
function Track({ lo = 0, hi, fill, active, move, moveMs, over = 0, width, handles, dots, symbol, readout }: { lo?: number; hi: number; fill: string; active: boolean; move?: "jump" | "track"; moveMs: number; over?: number; width: number; handles?: boolean; dots: number; symbol?: keyof typeof glyphs; readout?: string }) {
  const FULL = 30, h = active ? FULL : REST_H, r = Math.min(h / 2, 12);
  // Inflates under the finger with no overshoot and lets go with a little give.
  const band = active ? "press" : "release";
  // The value never animates under the finger; only a programmatic change lands on a spring.
  const moveT = (p: string) => (move === "jump" ? `${p} 0ms` : move === "track" ? tracking(p, moveMs) : t(p, "snap"));
  // Pushed past the end, the bar gives toward the far end with rubber-band resistance and bulges a little across.
  const squish = rubberBand(over, SQUISH);
  const length = Math.max(1 - squish / width, 0.5), bulge = 1 + Math.min(squish / width, 0.08);
  const span = `inset(0 ${(1 - hi) * 100}% 0 ${lo * 100}%)`;
  // The dots arrive a beat behind the swell, so they never show through a thin bar, and leave ahead of it.
  const dotRow = (color: string) => (
    <span data-motion className="absolute inset-0" style={{ opacity: active ? 1 : 0, transition: t("opacity", follow("press", 1)) }}>
      {Array.from({ length: dots - 1 }, (_, i) => (
        <span key={i} className="absolute rounded-full" style={{ left: `${((i + 1) / dots) * 100}%`, top: "50%", width: u(3), height: u(3), background: color, transform: "translate(-50%, -50%)" }} />
      ))}
    </span>
  );
  // The bubble rides the held edge where the squished bar draws it, kept over the bar; home is a sliver on that edge
  // at the bar's centre line, shrunk past the usual home scale so it fits inside a bar deflating as it melts in, and
  // kept inside the bar's ends.
  const out = active && readout !== undefined;
  const rw = readout === undefined ? 0 : Math.max(READOUT_H * 1.5, 24 + readout.length * 9.2);
  const edge = hi * width * length, right = width * length;
  const center = right > rw ? Math.min(Math.max(edge, rw / 2), right - rw / 2) : right / 2;
  const rise = (h * bulge) / 2 + liquid.joined + READOUT_H / 2;
  const fit = Math.min(1, (REST_H * 0.9) / (READOUT_H * liquid.homeScale));
  const homeHalf = (rw * liquid.homeScale * fit) / 2, homeCenter = Math.min(Math.max(edge, homeHalf), right - homeHalf);
  return (
    <div className="flex items-center" style={{ height: u(40), gap: u(12) }}>
      {symbol ? <span style={{ color: active ? ground.text : ground.muted, width: u(24), display: "flex", justifyContent: "center", transition: t("color", follow("press", 1)) }}><Glyph name={symbol} size={19} stroke={2} /></span> : null}
      <LiquidGroup unit={u(1)} axis="both" className="flex-1" style={{ height: u(40) }}>
        <div className="relative" style={{ height: u(40) }}>
          {readout !== undefined ? (
            // Under the bar, so at home it sits inside it. The wrapper tracks the edge as the fill does; the bubble's
            // own transform runs the bud on the split and home springs.
            <span data-motion className="absolute left-0 top-1/2" style={{ marginTop: u(-READOUT_H / 2), transform: `translateX(${u(center - rw / 2)})`, transition: moveT("transform") }}>
              <Liquid className="flex items-center justify-center" style={{
                width: u(rw), height: u(READOUT_H),
                transform: `translate(${u(out ? 0 : homeCenter - center)}, ${u(out ? -rise : 0)}) scale(${out ? 1 : liquid.homeScale * fit})`,
                transition: t("transform", out ? liquid.split : liquid.home),
              }}>
                <BudContent out={out}>
                  <span className="tabular-nums" style={{ fontFamily: font.rounded, fontSize: u(15), fontWeight: 600, lineHeight: 1, color: ground.text }}>{readout}</span>
                </BudContent>
              </Liquid>
            </span>
          ) : null}
          <div data-motion className="absolute inset-0 flex items-center" style={{
            transform: `scale(${length}, ${bulge})`, transformOrigin: "left center",
            // The give follows the finger; let go, it springs back on its own beat.
            transition: active ? tracking("transform", moveMs) : t("transform", "rebound"),
          }}>
            {/* The glass bar, laid out once at full thickness; the swell animates its clip, so nothing is laid out per frame. */}
            <Liquid radius={12} className="relative w-full overflow-hidden" style={{ height: u(FULL), clipPath: `inset(${u((FULL - h) / 2)} 0 round ${u(r)})`, transition: t("clip-path", band) }}>
              {dotRow(`color-mix(in srgb, ${ground.text} 22%, transparent)`)}
              <span data-motion className="absolute inset-0" style={{ background: fill, clipPath: span, transition: moveT("clip-path") }} />
              <span data-motion className="absolute inset-0" style={{ clipPath: span, transition: moveT("clip-path") }}>{dotRow("rgba(20,20,20,.35)")}</span>
              {handles ? (["lo", "hi"] as const).map((k) => {
                const sunk = active && k === "lo";
                const grow = (sunk ? 0.5 : 1) * (Math.max(h * 0.5, 4) / (FULL * 0.5));
                return (
                  <span key={k} data-motion className="absolute inset-0" style={{ transform: `translateX(${(k === "lo" ? lo : hi) * 100}%)`, transition: moveT("transform") }}>
                    {/* Grows and sinks on the band's own beat, while its position tracks the fill edge. */}
                    <span data-motion className="absolute top-1/2 rounded-full" style={{ left: u(k === "lo" ? 7 : -7), width: u(3), height: u(FULL * 0.5), background: ink, opacity: sunk ? 0.4 : 0.85, transform: `translate(-50%, -50%) scale(${sunk ? 0.5 : 1}, ${grow})`, transition: t(["transform", "opacity"], band) }} />
                  </span>
                );
              }) : null}
            </Liquid>
          </div>
        </div>
      </LiquidGroup>
    </div>
  );
}

function TrackHeader({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-end justify-between" style={{ gap: u(12) }}>
      <span className="whitespace-nowrap" style={{ ...meta, paddingBottom: u(4) }}>{label}</span>
      {children}
    </div>
  );
}

export function ExpandingTrackPreview() {
  const s = useSteps(trackSteps);
  // Rolls on `value` for a programmatic change, with no overshoot; under the finger it just updates, so it stays legible.
  const roll = !s.move;
  const lo = Math.round(s.lo * 200);
  return (
    <Stage width={448}>
      <style>{rollKeyframes}</style>
      <div className="flex flex-col" style={{ gap: u(26) }}>
        {/* Untitled, as the Swift example's first track: its value buds out of the bar while it is held. */}
        <Track hi={s.vol} fill={blocks.tangerine} active={s.active === "vol"} move={s.move} moveMs={s.ms} over={s.active === "vol" ? s.over : 0} width={412} dots={10} symbol="speaker" readout={String(Math.round(s.vol * 100))} />
        <div>
          <TrackHeader label="Warmth"><Numeral value="3400K" size={36} /></TrackHeader>
          <Track hi={0.18} fill={blocks.butter} active={false} moveMs={s.ms} width={412} dots={38} symbol="sun" />
        </div>
        <div>
          <TrackHeader label="Price per night">
            <span className="whitespace-nowrap tabular-nums" style={{ fontSize: u(32), fontWeight: font.numeralWeight, lineHeight: 1, letterSpacing: "-0.02em" }}>
              <Roll text={`$${lo}`} n={lo} roll={roll} /><span style={{ color: ground.muted }}> – </span>$160
            </span>
          </TrackHeader>
          <Track lo={s.lo} hi={0.8} fill={blocks.sage} active={s.active === "lo"} move={s.move} moveMs={s.ms} width={448} handles dots={40} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Scrub Stepper

type Key = "minus" | "plus";
/**
 * `press` holds a key down; `tap` is the key whose press just committed, which rolls the digits and bounces its glyph.
 * While scrubbing, `track` marks a step the finger moves into: `ruler` is the tape's travel and `past` how far the
 * finger pushes beyond the bound, both in px, followed linearly over the step.
 */
type StepperState = { guests: number; chairs: number; press?: Key; tap?: Key; pressChairs?: boolean; tapChairs?: boolean; scrub?: boolean; ruler?: number; past?: number; track?: boolean; ms: number };
const stepperSteps: readonly StepperState[] = [
  { guests: 4, chairs: 0, ms: 1400 },
  { guests: 4, chairs: 0, press: "plus", ms: 140 }, { guests: 5, chairs: 0, tap: "plus", ms: 700 },
  { guests: 5, chairs: 0, press: "plus", ms: 140 }, { guests: 6, chairs: 0, tap: "plus", ms: 900 },
  { guests: 6, chairs: 0, scrub: true, ms: 260 },
  { guests: 7, chairs: 0, scrub: true, ruler: 14, track: true, ms: 150 },
  { guests: 8, chairs: 0, scrub: true, ruler: 28, track: true, ms: 150 },
  { guests: 9, chairs: 0, scrub: true, ruler: 42, track: true, ms: 150 },
  { guests: 10, chairs: 0, scrub: true, ruler: 56, track: true, ms: 150 },
  { guests: 10, chairs: 0, scrub: true, ruler: 56, past: 7, track: true, ms: 150 },
  { guests: 10, chairs: 0, scrub: true, ruler: 56, past: 14, track: true, ms: 170 },
  { guests: 10, chairs: 0, scrub: true, ruler: 56, past: 14, ms: 260 },
  { guests: 10, chairs: 0, ms: 1000 },
  { guests: 10, chairs: 0, pressChairs: true, ms: 140 }, { guests: 10, chairs: 1, tapChairs: true, ms: 1300 },
  { guests: 4, chairs: 0, ms: 800 },
];

/**
 * The liquid stepper, as the Swift piece: signal minus and plus bubbles joined to a glass numeral pill by liquid necks.
 * At a bound that button melts into the pill (its tint draining as it goes) and buds back out the moment it can act;
 * its slot keeps its width, so the stepper never changes size.
 */
/** Ink on tinted glass: the house ink reads on signal, sage and butter alike. */
const inkOnTint = ink;

function Stepper({ value, min, max, block, press, tap, tapKey, scrub, ruler = 0, past = 0, track, stepMs }: { value: number; min: number; max: number; block?: string; press?: Key; tap?: Key; tapKey?: object; scrub?: boolean; ruler?: number; past?: number; track?: boolean; stepMs: number }) {
  const H = 50, gap = liquid.joined;
  const minusRef = useRef<HTMLSpanElement>(null), plusRef = useRef<HTMLSpanElement>(null);
  // A tap bounces its glyph once it commits; a scrub steps too fast for a bounce to read.
  useEffect(() => {
    const el = tap === "plus" ? plusRef.current : tap === "minus" ? minusRef.current : null;
    if (!el || reduced()) return;
    const a = el.animate(...pop(0.14));
    return () => a.cancel();
  }, [tap, tapKey]);
  // Past a bound the pill strains against the stop with rubber-band resistance, about 4pt at most.
  const pull = rubberBand(past, 8);
  const numeralInk = block ? inkOnTint : ground.text;
  const button = (name: Key, out: boolean) => {
    const down = press === name;
    // Home is just inside the pill's nearest end, shrunk, where the two are one shape.
    const home = H / 2 + gap + (H * liquid.homeScale) / 2;
    return (
      <span className="flex items-center justify-center" style={{ width: u(H), height: u(H) }}>
        <span data-motion className="flex" style={{ transform: `scale(${down ? 0.9 : 1})`, transition: t("transform", down ? "press" : "release") }}>
          <Liquid tint={out ? signal.fill : undefined} bud={{ out, home: [name === "minus" ? home : -home, 0] }} className="flex items-center justify-center" style={{ width: u(H), height: u(H), color: inkOnTint }}>
            <BudContent out={out}><span ref={name === "plus" ? plusRef : minusRef} data-motion style={{ display: "flex" }}><Glyph name={name} size={17} stroke={3} /></span></BudContent>
          </Liquid>
        </span>
      </span>
    );
  };
  return (
    <LiquidGroup unit={u(1)}>
      <span className="flex items-center" style={{ height: u(H), gap: u(gap) }}>
        {button("minus", value > min)}
        {/* Above the buttons, so a button melting home slips under the pill. Let go, it springs home from a stop. */}
        <span data-motion className="relative" style={{ zIndex: 1, transform: `translateX(${u(pull)})`, transition: track ? tracking("transform", stepMs) : t("transform", "rebound") }}>
          <Liquid tint={block} className="relative flex items-center justify-center overflow-hidden" style={{
            height: u(H), minWidth: u(72), paddingInline: u(18), color: numeralInk,
            // Grabbed, the tab lifts; let go, it lands with a little give.
            transform: `scale(${scrub ? 1.04 : 1})`, transition: t("transform", scrub ? "press" : "release"),
          }}>
            <span className="tabular-nums" style={{ fontFamily: font.rounded, fontSize: u(22), fontWeight: 600, lineHeight: 1 }}><Roll text={String(value)} n={value} roll={!scrub} /></span>
            {/* The ruler follows the lift a beat behind and runs with the finger; at a stop it holds still. */}
            <span data-motion className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: u(12), opacity: scrub ? 1 : 0, transition: t("opacity", follow("press", 1)), maskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)" }}>
              <span data-motion className="absolute bottom-0 flex items-end" style={{ left: u(-70), bottom: u(2), gap: u(5.5), transform: `translateX(${u(ruler)})`, transition: track ? tracking("transform", stepMs) : "none" }}>
                {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ width: u(1.5), height: u(i % 2 ? 4 : 7), borderRadius: u(1), background: "currentColor", opacity: 0.4 }} />)}
              </span>
            </span>
          </Liquid>
        </span>
        {button("plus", value < max)}
      </span>
    </LiquidGroup>
  );
}

export function ScrubStepperPreview() {
  const s = useSteps(stepperSteps);
  return (
    <Stage width={200} scale={2.6}>
      <style>{rollKeyframes}</style>
      <div className="flex flex-col items-center" style={{ gap: u(14) }}>
        <Stepper value={s.guests} min={1} max={10} press={s.press} tap={s.tap} tapKey={s} scrub={s.scrub} ruler={s.ruler} past={s.past} track={s.track} stepMs={s.ms} />
        <Stepper value={s.chairs} min={0} max={3} block={blocks.sage} press={s.pressChairs ? "plus" : undefined} tap={s.tapChairs ? "plus" : undefined} tapKey={s} stepMs={s.ms} />
      </div>
    </Stage>
  );
}

// MARK: Filter Rail

const SORTS = ["Recent", "Popular", "A to Z", "Longest", "Shortest"];
const GENRES = ["All", "Jazz", "Hip-Hop", "Classical", "Electronic", "Folk", "Ambient"];
const COUNTS: Record<string, number> = { All: 412, Jazz: 38, "Hip-Hop": 52, Classical: 21, Electronic: 64, Folk: 17, Ambient: 29 };
/** `press` holds a chip down for the tap that picks it on the next step. The loop's last move back to Recent is programmatic. */
const railSteps: readonly { sort: string; genres: string[]; press?: string; ms: number }[] = [
  { sort: "Recent", genres: [], ms: 1400 },
  { sort: "Recent", genres: [], press: "Popular", ms: 130 },
  { sort: "Popular", genres: [], ms: 900 },
  { sort: "Popular", genres: [], press: "Jazz", ms: 130 },
  { sort: "Popular", genres: ["Jazz"], ms: 900 },
  { sort: "Popular", genres: ["Jazz"], press: "Longest", ms: 130 },
  { sort: "Longest", genres: ["Jazz"], ms: 1000 },
  { sort: "Longest", genres: ["Jazz"], press: "Ambient", ms: 130 },
  { sort: "Longest", genres: ["Jazz", "Ambient"], ms: 900 },
  { sort: "Longest", genres: ["Jazz", "Ambient"], press: "Electronic", ms: 130 },
  { sort: "Longest", genres: ["Jazz", "Ambient", "Electronic"], ms: 1300 },
  { sort: "Longest", genres: ["Jazz", "Ambient", "Electronic"], press: "Clear", ms: 130 },
  { sort: "Longest", genres: [], ms: 1100 },
];

/** The puck's two edges, registered so each can spring on its own transition, and inherited so its ink row can follow them. */
const puckProperties = "@property --fr-lo{syntax:'<length>';inherits:true;initial-value:0px}@property --fr-hi{syntax:'<length>';inherits:true;initial-value:0px}";
/** Room above and below the chips for the glass's lift, which the rail's clip would otherwise cut flat. */
const RAIL_LIFT = 12;

/**
 * The liquid rail, as the Swift piece: glass chips resting apart, a red glass puck that stretches between single-select
 * picks and melts into each chip it crosses, red multi-select picks, and a Clear chip that buds out of the first pick.
 * Chip widths are estimated from text length (px at the 560 stage) and laid out like the Swift `HStack`; everything is
 * in `cqw`, so no measuring is needed.
 */
function Rail({ options, selected, from, multi, counts, pressed }: { options: string[]; selected: string[]; from?: string; multi?: boolean; counts?: Record<string, number>; pressed?: string }) {
  const RAIL_W = 372, INSET = 16, GAP = liquid.apart, H = 36, ROW = 44, CLEAR_W = 58;
  const TOP = RAIL_LIFT + (ROW - H) / 2;
  const on = (o: string) => selected.includes(o);
  const ordered = multi ? [...options.filter(on), ...options.filter((o) => !on(o))] : options;
  const clear = !!multi && selected.length > 0;
  const widthOf = (o: string) => Math.round(o.length * 7.6 + 32 + (multi && on(o) ? 18 : 0) + (counts ? String(counts[o]).length * 7 + 6 : 0));
  // The Clear chip's room opens ahead of the chips as the first pick lands and closes as the rail clears.
  let x = INSET + (clear ? CLEAR_W + GAP : 0);
  const pos = ordered.map((o) => { const w = widthOf(o), p = { o, x, w }; x += w + GAP; return p; });
  const place = new Map(pos.map((p) => [p.o, p]));
  const contentW = x - GAP + INSET;
  // The Clear chip keeps its last count while it melts home, and rolls only once it is showing.
  const kept = useRef(0), showing = useRef(false);
  const count = selected.length || kept.current;
  useEffect(() => { if (selected.length) kept.current = selected.length; showing.current = clear; });
  const sel = multi ? undefined : pos.find((p) => on(p.o));
  const scroll = sel ? Math.max(0, Math.min(sel.x + sel.w / 2 - RAIL_W / 2, contentW - RAIL_W)) : 0;
  const leftFade = scroll > 1, rightFade = contentW - scroll > RAIL_W + 1;
  const mask = `linear-gradient(90deg, ${leftFade ? "transparent" : "#000"}, #000 ${u(28)}, #000 calc(100% - ${u(28)}), ${rightFade ? "transparent" : "#000"})`;
  // The puck's edge facing the pick leads on `snap` and the far edge follows a beat later on a looser spring, so it
  // stretches toward the pick and gathers in on it.
  const prev = multi ? undefined : pos.find((p) => p.o === from);
  const rightward = !sel || !prev || sel.x >= prev.x;
  const trail = follow("snap", 2);
  // Home for the Clear chip: just inside the leading end of the chip at the front.
  const clearHome = (clear ? CLEAR_W + GAP : 0) + (CLEAR_W * liquid.homeScale) / 2 - CLEAR_W / 2;
  const label: CSSProperties = { fontSize: u(14), fontWeight: 600 };
  return (
    // Drawn a little taller than its row and pulled back by the same amount, so the glass's lift has room inside the clip.
    <div className="relative overflow-hidden" style={{ height: u(ROW + RAIL_LIFT * 2), marginBlock: u(-RAIL_LIFT), maskImage: mask, WebkitMaskImage: mask }}>
      {/* The scroll follows a beat behind the pick on a calmer spring, so it never stacks with the puck into one lurch. */}
      <div data-motion className="absolute inset-y-0 left-0" style={{ transform: `translateX(${u(-scroll)})`, transition: t("transform", follow(tiers.calm, 1)) }}>
        <LiquidGroup unit={u(1)} style={{ width: u(Math.max(contentW, RAIL_W)), height: u(ROW + RAIL_LIFT * 2) }}>
          {multi ? (
            // Under the chips, so at home it sits inside the first one. It buds out as the room opens, and melts back
            // into whichever chip slides to the front as the rail clears.
            <span className="absolute" style={{ left: u(INSET), top: u(TOP), width: u(CLEAR_W), height: u(H) }}>
              <span data-motion className="block h-full w-full" style={{ transform: `scale(${pressed === "Clear" ? pressScale(CLEAR_W, H) : 1})`, transition: t("transform", pressed === "Clear" ? "press" : "release") }}>
                <Liquid bud={{ out: clear, home: [clearHome, 0] }} className="flex h-full w-full items-center justify-center tabular-nums" style={{ ...label, color: ground.text }}>
                  <BudContent out={clear}>
                    <span className="flex items-center" style={{ gap: u(5) }}><Glyph name="xmark" size={12} stroke={3.2} /><Roll text={String(count)} n={count} roll={showing.current} /></span>
                  </BudContent>
                </Liquid>
              </span>
            </span>
          ) : null}
          {/* In the rail's own order, never `ordered`: a node React moves loses its transition and lands in one frame. */}
          {options.map((o, i) => {
            const p = place.get(o)!;
            const picked = !!multi && on(o);
            const down = pressed === o;
            return (
              // Multi-select: picks file to the front first and the rest make room a beat after. Earlier picks draw over
              // later ones, so a new pick slips under the chip it lands behind; the rest keep the rail's order. Positive
              // layers, so the content pass never sinks under the glass pass.
              <span key={o} data-motion className="absolute" style={{ left: 0, top: u(TOP), width: u(p.w), height: u(H), zIndex: multi ? (picked ? options.length - i : options.length + 1) : undefined, transform: `translateX(${u(p.x)})`, transition: [t("transform", follow("snap", picked ? 0 : 2)), t("width", "morph")].join(", ") }}>
                {/* The shared press sinks with no bounce and springs back through rest; a pick's tint comes on with it. */}
                <span data-motion className="block h-full w-full" style={{ transform: `scale(${down ? pressScale(p.w, H) : 1})`, transition: t("transform", down ? "press" : "release") }}>
                  <Liquid tint={picked ? signal.fill : undefined} className="flex h-full w-full items-center justify-center whitespace-nowrap" style={{ ...label, gap: u(6), color: picked ? ink : ground.text, transition: t(["background-color", "color"], "snap") }}>
                    {/* A glyph arriving inside the glass blurs in. */}
                    {picked ? <span data-motion style={{ display: "flex", animation: `fr-swap ${curve("snap").ms}ms ${curve("snap").easing} both` }}><Glyph name="check" size={12} stroke={3.4} /></span> : null}
                    {o}
                    {counts ? <span className="tabular-nums" style={{ fontSize: u(12), fontWeight: 600, color: picked ? "rgba(20,20,20,.62)" : ground.muted, transition: t("color", "snap") }}>{counts[o]}</span> : null}
                  </Liquid>
                </span>
              </span>
            );
          })}
          {sel ? (
            // Single-select: one red glass puck between its live edges, melting into each chip it crosses. Inside it
            // every label is drawn in its ink, cut to the same outline, so a label turns exactly under the puck's
            // edge as it passes instead of crossfading.
            <Liquid tint={signal.fill} className="absolute overflow-hidden" style={{
              top: u(TOP), height: u(H), left: "var(--fr-lo)", width: "calc(var(--fr-hi) - var(--fr-lo))",
              "--fr-lo": u(sel.x), "--fr-hi": u(sel.x + sel.w),
              transition: [t("--fr-hi", rightward ? "snap" : trail), t("--fr-lo", rightward ? trail : "snap")].join(", "),
            } as CSSProperties}>
              {/* The puck's own face over the chips' labels, as the glass hides what is under it. */}
              <span className="absolute inset-0" style={{ background: signal.fill }} />
              <span className="absolute top-0" style={{ left: "calc(var(--fr-lo) * -1)", width: u(contentW), height: u(H) }}>
                {pos.map((p) => (
                  <span key={p.o} className="absolute flex items-center justify-center whitespace-nowrap" style={{ ...label, left: u(p.x), top: 0, width: u(p.w), height: u(H), color: signal.on }}>{p.o}</span>
                ))}
              </span>
            </Liquid>
          ) : null}
        </LiquidGroup>
      </div>
    </div>
  );
}

export function FilterRailPreview() {
  const step = useSteps(railSteps);
  const at = railSteps.indexOf(step);
  const from = railSteps[(at + railSteps.length - 1) % railSteps.length].sort;
  return (
    <Stage width={372} scale={1.28}>
      <style>{`${puckProperties}${rollKeyframes}@keyframes fr-swap{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}`}</style>
      <div className="flex flex-col" style={{ gap: u(16) }}>
        <Rail options={SORTS} selected={[step.sort]} from={from} pressed={step.press} />
        <Rail options={GENRES} selected={step.genres} multi counts={COUNTS} pressed={step.press} />
      </div>
    </Stage>
  );
}

// MARK: Secure Entry

const TARGET = "Juniper42!";
/** `collapsed` is the beat after the last rule lands; `pressEye` holds the reveal bubble down for the toggle on the next step. */
type SecureState = { typed: number; focus: "new" | "none"; error: boolean; collapsed?: boolean; reveal?: boolean; pressEye?: boolean; ms: number };
const secureSteps: readonly SecureState[] = [
  { typed: 5, focus: "new", error: false, ms: 1300 },
  ...Array.from({ length: 4 }, (_, i) => ({ typed: 6 + i, focus: "new" as const, error: false, ms: 230 })),
  // The last rule lands: the field turns sage with its check, and the chips stay a beat, then melt back into it.
  { typed: 10, focus: "new", error: false, ms: 400 },
  { typed: 10, focus: "new", error: false, collapsed: true, ms: 1000 },
  // A peek: the reveal bubble sinks under the finger and the text swaps in at once.
  { typed: 10, focus: "new", error: false, collapsed: true, pressEye: true, ms: 130 },
  { typed: 10, focus: "new", error: false, collapsed: true, reveal: true, ms: 1000 },
  { typed: 10, focus: "new", error: false, collapsed: true, reveal: true, pressEye: true, ms: 130 },
  { typed: 10, focus: "new", error: false, collapsed: true, ms: 400 },
  { typed: 10, focus: "none", error: true, ms: 2000 },
  { typed: 10, focus: "none", error: false, ms: 900 },
];
/** Weak and fair warn in butter; good and strong read sage, as the Swift piece's house strength tints. */
const LEVELS = [["Weak", blocks.butter], ["Fair", blocks.butter], ["Good", blocks.sage], ["Strong", blocks.sage]] as const;
const SE_W = 452, FIELD_H = 48, RULE_H = 30, METER_H = 22, ERROR_H = 26;
/** Everything below the field lines up with it; the reveal bubble alone sits beyond it. */
const COLUMN = SE_W - FIELD_H - liquid.joined;
/** A bubble swapping in or out inside its glass blurs, as `motion.swap` does. */
const swapKeyframes = "@keyframes se-swap{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}@keyframes se-pop{0%{transform:scale(1)}12%{transform:scale(.984)}33%{transform:scale(1.04)}100%{transform:scale(1)}}";

/**
 * The bud transform of a bubble whose home is straight up inside the field, `rise` above its place. Once it has melted
 * in it is gone, as the Swift piece removes a bubble only once it is home.
 */
const budUp = (out: boolean, rise: number, delay = 0): CSSProperties => ({
  transform: `translateY(${u(out ? 0 : -rise)}) scale(${out ? 1 : liquid.homeScale})`,
  visibility: out ? "visible" : "hidden",
  transition: `${t("transform", out ? liquid.split : liquid.home, delay)}, visibility 0s linear ${out ? 0 : ms(liquid.home) + delay}ms`,
});
/** How far a bubble rises to its home: from its centre, `depth` below the field's bottom edge, to just inside it. */
const homeRise = (depth: number, height: number) => depth + (height * liquid.homeScale) / 2;

/** Room below the field for a part. It opens as its bubbles bud and closes as they melt home, on the same springs. */
function Room({ open, height, children }: { open: boolean; height: number; children: ReactNode }) {
  return <div data-motion className="relative" style={{ height: u(open ? height : 0), transition: t("height", open ? liquid.split : liquid.home) }}>{children}</div>;
}

/** The glass field and the round reveal bubble joined to it. The field's tint carries its state. */
function FieldRow({ text, focused, tint, check, revealed, pressed }: { text: string; focused?: boolean; tint?: string; check?: boolean; revealed?: boolean; pressed?: boolean }) {
  const inked = tint ? ink : ground.text;
  return (
    // Over the rooms below it, so a bubble at home sits under the field and melts into it.
    <div className="relative flex items-center" style={{ gap: u(liquid.joined), height: u(FIELD_H), zIndex: 1 }}>
      <Liquid radius={16} tint={tint} className="relative flex h-full flex-1 items-center" style={{ paddingInline: u(16), transition: t("background-color", check ? "success" : "dismiss") }}>
        <span className="flex flex-1 items-center" style={{ gap: u(4), color: inked }}>
          {revealed
            ? <span style={{ fontSize: u(16), fontWeight: 600, lineHeight: 1 }}>{text}</span>
            : Array.from({ length: text.length }, (_, i) => <span key={i} className="rounded-full" style={{ width: u(7), height: u(7), background: "currentColor" }} />)}
          {focused ? <span data-motion style={{ width: u(2), height: u(20), marginLeft: u(2), background: "currentColor", animation: "in-caret 1s steps(1) infinite" }} /> : null}
        </span>
        {/* The outcome blurs into the sage glass on the success beat, and out as it drains. */}
        <span data-motion className="flex" style={{ color: ink, opacity: check ? 1 : 0, filter: `blur(${check ? 0 : 4}px)`, transition: t(["opacity", "filter"], check ? "success" : "dismiss") }}><Glyph name="check" size={16} stroke={3} /></span>
        {/* The focus ring, a few points in from the edge so the reveal bubble's neck never cuts it. */}
        <span data-motion className="pointer-events-none absolute" style={{ inset: u(3), borderRadius: u(13), boxShadow: `inset 0 0 0 ${u(2)} ${inked}`, opacity: focused ? 1 : 0, transition: t("opacity", "snap") }} />
      </Liquid>
      <span data-motion className="flex" style={{ transform: `scale(${pressed ? pressScale(FIELD_H, FIELD_H) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
        <Liquid className="flex items-center justify-center" style={{ width: u(FIELD_H), height: u(FIELD_H), color: ground.text }}>
          <span key={revealed ? "slash" : "eye"} data-motion className="flex" style={{ animation: `se-swap ${curve("snap").ms}ms ${curve("snap").easing} both` }}><Glyph name={revealed ? "eyeSlash" : "eye"} size={17} stroke={2} /></span>
        </Liquid>
      </span>
    </div>
  );
}

/**
 * One rule: neutral glass while unmet, sage once met, with its check drawn after the tint lands. It buds out of the
 * field with the set, `index` places after the first, and melts back into it last-first. `pops` is off for the rule
 * that completes the set: the field's check is that outcome, so it lands alone.
 */
function Rule({ label, met, pops, out, index, above }: { label: string; met: boolean; pops: boolean; out: boolean; index: number; above: number }) {
  const row = Math.floor(index / 2), col = index % 2, cw = (COLUMN - liquid.apart) / 2;
  const top = liquid.apart + row * (RULE_H + liquid.apart);
  const rise = homeRise(above + top + RULE_H / 2, RULE_H);
  const delay = out ? index * 50 : (3 - index) * 40;
  return (
    // The pop wraps the bubble, as `.piecePop` wraps the glass, so the click and the swell add up.
    <span data-motion className="absolute" style={{ left: u(col * (cw + liquid.apart)), top: u(top), width: u(cw), height: u(RULE_H), animation: met && pops ? "se-pop 640ms ease-out" : undefined }}>
      <Liquid tint={out && met ? blocks.sage : undefined} className="flex h-full w-full items-center" style={{
        ...budUp(out, rise, delay), paddingInline: u(12), color: met ? ink : ground.muted, fontSize: u(12.5), fontWeight: 600,
        transition: [budUp(out, rise, delay).transition, t(["background-color", "color"], met ? "snap" : "dismiss")].join(", "),
      }}>
        <BudContent out={out}>
          <span className="flex items-center" style={{ gap: u(6) }}>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ width: u(14), height: u(14), flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.4" style={{ opacity: met ? 0 : 0.6, transition: t("opacity", met ? "snap" : "dismiss") }} />
              <path data-motion d="M5 12.5l4.5 4.5L19 7" stroke={ink} strokeWidth="3.4" pathLength={1} strokeDasharray={1} strokeDashoffset={met ? 0 : 1} style={{ transition: met ? t("stroke-dashoffset", "snap", 80) : t("stroke-dashoffset", "dismiss") }} />
            </svg>
            {label}
          </span>
        </BudContent>
      </Liquid>
    </span>
  );
}

export function SecureEntryPreview() {
  const s = useSteps(secureSteps);
  const shakeRef = useRef<HTMLDivElement>(null);
  const pw = TARGET.slice(0, s.typed);
  const reqs: [string, boolean][] = [["8+ characters", pw.length >= 8], ["A number", /\d/.test(pw)], ["A symbol", /[^\p{L}\p{N}\s]/u.test(pw)], ["Mixed case", /[a-z]/.test(pw) && /[A-Z]/.test(pw)]];
  const passed = reqs.filter(([, m]) => m).length, score = Math.max(passed, 1), complete = passed === 4;
  const [level, levelColor] = LEVELS[score - 1];
  // A completed set stays a beat so its last tile lands; leaving the field melts it at once.
  const showSet = !complete || (s.focus === "new" && !s.collapsed);
  const meterOpen = pw.length > 0;
  // A new error shakes the confirm field once, on the beat of its haptic.
  useEffect(() => {
    if (!s.error || reduced() || !shakeRef.current) return;
    const a = shakeRef.current.animate(...shake(u, 10));
    return () => a.cancel();
  }, [s.error]);
  return (
    <Stage width={SE_W}>
      <style>{`@keyframes in-caret{0%,49%{opacity:1}50%,100%{opacity:0}}${swapKeyframes}`}</style>
      <div className="flex flex-col">
        <p style={meta}>New password</p>
        <LiquidGroup unit={u(1)} axis="both" style={{ marginTop: u(8) }}>
          <FieldRow text={pw} focused={s.focus === "new"} tint={complete ? blocks.sage : undefined} check={complete} revealed={s.reveal} pressed={s.pressEye} />
          <div style={{ width: u(COLUMN) }}>
            <Room open={meterOpen} height={liquid.apart + METER_H}>
              {/* The gauge is a reading, not glass: transparent in the glass pass, so nothing melts into it. */}
              <Liquid tint="transparent" radius={0} className="absolute left-0 flex items-center" style={{ top: u(liquid.apart), width: u(COLUMN - 64 - 10), height: u(METER_H), opacity: meterOpen ? 1 : 0, transition: t("opacity", meterOpen ? "reveal" : "dismiss") }}>
                {/* A gauge, not a toy: the fill changes length on `value`, without overshoot, so the reading never wobbles. */}
                <span className="relative w-full overflow-hidden rounded-full" style={{ height: u(8), background: `color-mix(in srgb, ${ground.muted} 22%, transparent)` }}>
                  <span data-motion className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score * 25}%`, background: levelColor, transition: t(["width", "background-color"], "value") }} />
                </span>
              </Liquid>
              <Liquid tint={meterOpen ? levelColor : undefined} className="absolute right-0 flex items-center justify-center" style={{
                ...budUp(meterOpen, homeRise(liquid.apart + METER_H / 2, METER_H)), top: u(liquid.apart), width: u(64), height: u(METER_H),
                color: ink, fontSize: u(10), fontWeight: 600, letterSpacing: "0.08em",
                transition: [budUp(meterOpen, 0).transition, t("background-color", "value")].join(", "),
              }}>
                {/* The level's label morphs letter by letter as the score changes. */}
                <BudContent out={meterOpen}><MorphText text={level.toUpperCase()} /></BudContent>
              </Liquid>
            </Room>
            <Room open={showSet} height={liquid.apart + RULE_H * 2 + liquid.apart}>
              {reqs.map(([label, m], i) => <Rule key={label} label={label} met={m} pops={!complete} out={showSet} index={i} above={meterOpen ? liquid.apart + METER_H : 0} />)}
            </Room>
          </div>
        </LiquidGroup>
        <p style={{ ...meta, marginTop: u(26) }}>Confirm password</p>
        <div ref={shakeRef} style={{ marginTop: u(8) }}>
          <LiquidGroup unit={u(1)} axis="both">
            <FieldRow text={TARGET} tint={s.error ? blocks.butter : undefined} />
            <div style={{ width: u(COLUMN) }}>
              <Room open={s.error} height={liquid.joined + ERROR_H}>
                {/* The ring of tint and the shake lead; the chip buds out of the field's bottom edge and stays joined to it. */}
                <Liquid tint={s.error ? blocks.butter : undefined} className="absolute left-0 inline-flex items-center whitespace-nowrap" style={{
                  ...budUp(s.error, homeRise(liquid.joined + ERROR_H / 2, ERROR_H)), top: u(liquid.joined), height: u(ERROR_H), paddingInline: u(12),
                  color: ink, fontSize: u(12.5), fontWeight: 600,
                  transition: [budUp(s.error, 0).transition, t("background-color", s.error ? "error" : "dismiss")].join(", "),
                }}>
                  <BudContent out={s.error}><span className="flex items-center" style={{ gap: u(5) }}><Glyph name="bang" size={12} stroke={3.2} />Passwords do not match</span></BudContent>
                </Liquid>
              </Room>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}
