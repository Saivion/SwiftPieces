"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { blocks, font, ground, ink } from "./palette";
import { curve, follow, ms, reduced, rubberBand, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Range Slider: a price filter with a header readout and an age range with chips above the thumbs.
 * The component only, in liquid glass as the Swift piece draws it: two glass bubble thumbs over a quiet line, the
 * selected span as tinted glass joining them, and glass readout chips joined above the thumbs.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 *
 * Motion follows the Swift piece: a held thumb tracks the finger 1:1 and is never sprung, it lifts on the press
 * spring, lands on its step on snap when let go, and past either end gives with rubber-band resistance and
 * rebounds. Each edge of the span and each chip rides its own thumb; when the chips would touch, the upper one melts
 * into the lower. The header digits roll on the value spring when the range changes with no thumb held.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const W = 440; // track width
const THUMB = 28;
const TRACK = 8;
const TARGET = 44;
const CHIP_H = 26;
/**
 * The span rests this far inside each thumb's centre: the thumb's radius and a neck. Swift rests it a full joined gap
 * (6pt) away and Liquid Glass draws the neck across it; the web goo can't bridge that for a bar this thin, so the gap
 * is drawn tighter here to read as the same neck.
 */
const SPAN_INSET = THUMB / 2 + 2;
/** How far past an end a held thumb can be drawn: about its own width, within 24 to 32 px, as in Swift. */
const BAND = Math.min(Math.max(THUMB, 24), 32);

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

type Grab = "" | "pl" | "pu" | "al" | "au";
type Held = Exclude<Grab, "">;
/**
 * Thumb positions in value units. A held thumb's entry is where the finger is, so it can sit off its step or past
 * an end; `drop` names the thumb just let go and `land` how it lands. A `drag` step moves the held finger from
 * `from` to `to` over the step's `ms` on one continuous timeline.
 */
type State = {
  p: [number, number]; a: [number, number]; grab: Grab; drop: Grab; land: "snap" | "rebound"; ms: number;
  drag?: { from: number; to: number };
};

type Range = { min: number; max: number; step: number; gap: number };
const PRICE: Range = { min: 0, max: 1000, step: 10, gap: 0 };
const AGE: Range = { min: 18, max: 80, step: 1, gap: 5 };

/** Thumb center in px for a value, inset by the thumb radius like the Swift track. */
const xAt = (v: number, r: Range) => THUMB / 2 + ((v - r.min) / (r.max - r.min)) * (W - THUMB);
const within = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
/** Where a thumb's value may go: its own end of the track, or the other thumb less the minimum gap. */
const reach = (lower: boolean, other: number, r: Range): [number, number] => (lower ? [r.min, other - r.gap] : [other + r.gap, r.max]);
/** The value under the finger: on the step grid and inside the thumb's reach. */
const valueAt = (finger: number, lower: boolean, other: number, r: Range) => {
  const [lo, hi] = reach(lower, other, r);
  return within(r.min + Math.round((finger - r.min) / r.step) * r.step, lo, hi);
};
/** Where a held thumb is drawn: under the finger, stopped firm at the other thumb, rubber-banded past its end. */
const drawnAt = (finger: number, lower: boolean, other: number, r: Range) => {
  const end = lower ? r.min : r.max, out = lower ? -1 : 1;
  const past = (Math.max((finger - end) * out, 0) * (W - THUMB)) / (r.max - r.min);
  if (past > 0) return xAt(end, r) + out * rubberBand(past, BAND);
  const [lo, hi] = reach(lower, other, r);
  return xAt(within(finger, lo, hi), r);
};

const ease = (x: number) => x * x * (3 - 2 * x);

/** The finger along a drag step, `k` from 0 to 1: it speeds up and slows down. */
const fingerAt = (d: { from: number; to: number }, k: number) => d.from + (d.to - d.from) * ease(within(k, 0, 1));

/** The step with the held thumb's entry moved to the finger. */
function withFinger(s: State, f: number): State {
  if (!s.grab) return s;
  const pair = s.grab[0] === "p" ? s.p : s.a;
  const next: [number, number] = s.grab[1] === "l" ? [f, pair[1]] : [pair[0], f];
  return s.grab[0] === "p" ? { ...s, p: next } : { ...s, a: next };
}

/**
 * Plays a drag step on one timeline: every frame puts the held thumb under the finger, so the thumb, its block
 * edge, its chip and the readouts all read the same position, as Swift sets value and travel together in onChanged.
 */
function useFinger(s: State): State {
  const [now, setNow] = useState<{ s: State; f: number } | null>(null);
  useEffect(() => {
    const d = s.drag;
    if (!d) return;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const k = (time - start) / s.ms;
      // Committed inside the frame callback, so the drawn thumb never waits a frame on the scheduler.
      flushSync(() => setNow({ s, f: fingerAt(d, k) }));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [s]);
  if (!s.drag) return s;
  return withFinger(s, now?.s === s ? now.f : s.drag.from);
}

/** The loop as a finger plays it: hold a thumb, drag it with a speed-up and a slow-down, hold still, let go. */
const steps: readonly State[] = (() => {
  const out: State[] = [];
  let p: [number, number] = [120, 480], a: [number, number] = [24, 41];
  const push = (grab: Grab, ms: number, drop: Grab = "", land: State["land"] = "snap", drag?: State["drag"]) =>
    out.push({ p, a, grab, drop, land, ms: Math.round(ms), ...(drag ? { drag } : {}) });
  const pair = (k: Held) => (k[0] === "p" ? p : a);
  const put = (k: Held, v: number) => {
    const next: [number, number] = k[1] === "l" ? [v, pair(k)[1]] : [pair(k)[0], v];
    if (k[0] === "p") p = next; else a = next;
  };
  const gesture = (k: Held, to: number, dragMs: number, holdMs: number, restMs: number) => {
    const r = k[0] === "p" ? PRICE : AGE, lower = k[1] === "l";
    push(k, 200); // the thumb lifts before it moves
    push(k, dragMs, "", "snap", { from: pair(k)[lower ? 0 : 1], to });
    put(k, to);
    push(k, holdMs);
    const past = lower ? to < r.min : to > r.max;
    put(k, valueAt(to, lower, pair(k)[lower ? 1 : 0], r));
    push("", restMs, k, past ? "rebound" : "snap");
  };
  push("", 1500);
  gesture("pl", 264, 540, 220, 600);
  gesture("pu", 337, 540, 220, 700);
  gesture("al", 6, 480, 260, 560); // pulled past the start: it gives, then rebounds onto 18
  gesture("al", 38.5, 540, 300, 700); // stopped firm at the five-year gap while the chips merge
  gesture("au", 54.4, 450, 220, 1200);
  p = [120, 480]; a = [24, 41];
  push("", 900);
  return out;
})();

/** One thumb this step: its value, where it is drawn and how it gets there. */
function thumbOf(k: Held, s: State) {
  const r = k[0] === "p" ? PRICE : AGE, lower = k[1] === "l", pair = k[0] === "p" ? s.p : s.a;
  const at = pair[lower ? 0 : 1], other = pair[lower ? 1 : 0], held = s.grab === k;
  // Held, it is drawn under the finger every frame and never sprung or eased. Let go on the track it snaps onto
  // its step; let go past the end it rebounds. The reset settles, the age slider a beat behind the price.
  // (`prop 0s`, not `none`: these join transition lists.)
  const moveFor = (prop: string) => held ? `${prop} 0s`
    : s.drop === k ? t(prop, s.land)
    : t(prop, k[0] === "a" ? follow("settle", 1) : "settle");
  return {
    v: held ? valueAt(at, lower, other, r) : at,
    x: held ? drawnAt(at, lower, other, r) : xAt(at, r),
    held, move: moveFor("transform"), moveFor,
  };
}

/** Estimated chip width at 13 px semibold tabular digits. */
const chipWidth = (text: string) => 20 + text.length * 7.6;
const clamp = (x: number, w: number) => Math.min(Math.max(x, w / 2), W - w / 2);
const chipTint = t(["background-color", "color"], follow("press", 1));
/**
 * The span's two edges and the readouts' merge, registered so each animates on its own transition: an edge rides its
 * own thumb, and the merge keeps its spring while a thumb moves under the finger. Inherited, so the chips read it.
 */
const sliderProperties = "@property --rs-lo{syntax:'<length>';inherits:true;initial-value:0px}@property --rs-hi{syntax:'<length>';inherits:true;initial-value:0px}@property --rs-merge{syntax:'<number>';inherits:true;initial-value:0}";

/**
 * A header number that rolls, glyph by glyph, when it changes with no thumb held, as Swift's `.numericText()`
 * does on the value spring: the new digit drops in from above and the old one falls out below, blurred. While a
 * thumb is held it changes in place, as Swift's `.identity` does during a drag.
 */
function Roll({ text, roll }: { text: string; roll: boolean }) {
  const [shown, setShown] = useState({ text, prev: "", n: 0 });
  let now = shown;
  if (shown.text !== text) {
    now = { text, prev: roll && !reduced() ? shown.text : "", n: shown.n + 1 };
    setShown(now);
  }
  // Once the roll has landed, the leaving glyphs go, so only the current number stays in the DOM.
  useEffect(() => {
    if (!shown.prev) return;
    const id = setTimeout(() => setShown((v) => (v.n === shown.n ? { ...v, prev: "" } : v)), ms("value"));
    return () => clearTimeout(id);
  }, [shown.n, shown.prev]);
  const shift = text.length - now.prev.length;
  return [...text].map((ch, i) => {
    const old = now.prev[i - shift] ?? "";
    return now.prev && old !== ch ? <Glyph key={`${now.n}:${i}`} ch={ch} old={old} /> : <span key={i}>{ch}</span>;
  });
}

function Glyph({ ch, old }: { ch: string; old: string }) {
  const enter = useRef<HTMLSpanElement>(null), leave = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const { easing, ms: duration } = curve("value");
    const blur = `blur(${u(1.5)})`;
    const opts: KeyframeAnimationOptions = { duration, easing, fill: "both" };
    const runs = [
      enter.current?.animate([{ transform: "translateY(-0.55em) scale(0.7)", opacity: 0, filter: blur }, { transform: "none", opacity: 1, filter: "none" }], opts),
      leave.current?.animate([{ transform: "none", opacity: 1, filter: "none" }, { transform: "translateY(0.55em) scale(0.7)", opacity: 0, filter: blur }], opts),
    ];
    return () => runs.forEach((a) => a?.cancel());
  }, []);
  return (
    <span className="relative inline-block">
      <span ref={enter} className="inline-block">{ch}</span>
      <span ref={leave} className="absolute inset-0" style={{ opacity: 0 }}>{old}</span>
    </span>
  );
}

type Place = { x: number; held: boolean; move: string; moveFor: (prop: string) => string };

/**
 * The span and the thumbs, inside the slider's `LiquidGroup`: tinted glass resting a neck's width from each thumb, so
 * it joins them through necks, and two glass bubbles that swell while held.
 */
function Track({ lower, upper, fill }: { lower: Place; upper: Place; fill: string }) {
  const thumb = ({ x, held, move }: Place) => (
    <span data-motion className="absolute left-0" style={{ top: u((TARGET - THUMB) / 2), width: u(THUMB), height: u(THUMB), transform: `translateX(${u(x - THUMB / 2)})`, zIndex: held ? 2 : 1, transition: move }}>
      {/* Held, it lifts: a pinched bead swelling on the press spring, dropping back with a little give. */}
      <Liquid className="absolute inset-0" style={{ transform: `scale(${held ? 1.18 : 1})`, transition: t("transform", held ? "press" : "release") }} />
    </span>
  );
  return (
    <div className="relative" style={{ width: u(W), height: u(TARGET) }}>
      {/* Resting a neck's width from each thumb, so it joins them through necks and the thumbs stay clear glass. */}
      <Liquid tint={fill} className="absolute" style={{
        top: u((TARGET - TRACK) / 2), height: u(TRACK), left: `calc(var(--rs-lo) + ${u(SPAN_INSET)})`, width: `max(0px, calc(var(--rs-hi) - var(--rs-lo) - ${u(SPAN_INSET * 2)}))`,
        "--rs-lo": u(lower.x), "--rs-hi": u(upper.x),
        transition: [lower.moveFor("--rs-lo"), upper.moveFor("--rs-hi")].join(", "),
      } as CSSProperties} />
      {thumb(lower)}
      {thumb(upper)}
    </div>
  );
}

/** The quiet line the thumbs ride. It is not glass, so it sits under the slider's group rather than in it. */
function Line({ top }: { top: number }) {
  return <span className="absolute left-0 rounded-full" style={{ top: u(top + (TARGET - TRACK) / 2), width: u(W), height: u(TRACK), background: ground.trough }} />;
}

export function RangeSliderPreview() {
  const s = useFinger(useSteps(steps));
  const pl = thumbOf("pl", s), pu = thumbOf("pu", s), al = thumbOf("al", s), au = thumbOf("au", s);
  const money = (v: number) => `$${v}`;

  // Age chips: one over each thumb, joined to it; when they would touch (6 px gap) the upper one melts into the lower,
  // which widens to read the range around the midpoint, as the Swift piece does. (The script never rests at the
  // threshold, so it needs none of the Swift piece's 12 px hysteresis.)
  const lw = chipWidth(String(al.v)), uw = chipWidth(String(au.v)), mw = chipWidth(`${al.v} – ${au.v}`);
  const lc = clamp(al.x, lw), uc = clamp(au.x, uw), mc = clamp((al.x + au.x) / 2, mw);
  const merged = lc + lw / 2 + 6 > uc - uw / 2;
  const ageHeld = al.held || au.held;
  // The chips rest a liquid neck's width above their thumbs.
  const chipGap = liquid.joined - (TARGET - THUMB) / 2;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{sliderProperties}</style>
      <div className="flex flex-col" style={{ width: u(W), gap: u(40) }}>
        <div className="flex flex-col" style={{ gap: u(10) }}>
          <div className="flex items-baseline tabular-nums" style={{ gap: u(8), fontSize: u(20), fontWeight: 600, lineHeight: 1.2 }}>
            <span><Roll text={money(pl.v)} roll={!s.grab} /></span>
            <span style={{ color: ground.muted }}>–</span>
            <span><Roll text={money(pu.v)} roll={!s.grab} /></span>
          </div>
          <div className="relative">
            <Line top={0} />
            <LiquidGroup unit={u(1)} axis="both">
              <Track lower={pl} upper={pu} fill={blocks.tangerine} />
            </LiquidGroup>
          </div>
        </div>
        <div className="relative">
          <Line top={CHIP_H + chipGap} />
          <LiquidGroup unit={u(1)} axis="both">
            <div className="relative" style={{ height: u(CHIP_H), marginBottom: u(chipGap), "--rs-merge": merged ? 1 : 0, transition: t("--rs-merge", merged ? liquid.home : liquid.split) } as CSSProperties}>
              {/* Under the lower chip, so at home it sits inside it. It rides its thumb, and the merge carries it into
                  the lower chip, shrinking first, its number blurring away. */}
              <span data-motion className="absolute left-0 top-0" style={{ transform: `translateX(${u(uc)})`, transition: au.move }}>
                <span className="absolute left-0 top-0" style={{ transform: `translateX(calc(${u(mc - uc)} * var(--rs-merge))) scale(calc(1 - ${1 - liquid.homeScale} * var(--rs-merge)))` }}>
                  <Liquid tint={au.held && !merged ? blocks.sage : undefined} className="absolute top-0 flex items-center justify-center tabular-nums whitespace-nowrap" style={{ left: 0, width: u(uw), height: u(CHIP_H), transform: "translateX(-50%)", fontSize: u(13), fontWeight: 600, color: au.held && !merged ? ink : ground.text, transition: chipTint }}>
                    <BudContent out={!merged}>{au.v}</BudContent>
                  </Liquid>
                </span>
              </span>
              {/* The lower chip rides its thumb and, merged, the midpoint, widening to read the whole range. */}
              <span data-motion className="absolute left-0 top-0" style={{ transform: `translateX(${u(lc)})`, transition: al.move }}>
                <span className="absolute left-0 top-0" style={{ transform: `translateX(calc(${u(mc - lc)} * var(--rs-merge)))` }}>
                  <Liquid tint={(merged ? ageHeld : al.held) ? blocks.sage : undefined} className="absolute top-0 flex items-center justify-center tabular-nums whitespace-nowrap" style={{
                    left: 0, width: u(merged ? mw : lw), height: u(CHIP_H), transform: "translateX(-50%)", fontSize: u(13), fontWeight: 600,
                    color: (merged ? ageHeld : al.held) ? ink : ground.text,
                    transition: [t("width", merged ? liquid.home : liquid.split), chipTint].join(", "),
                  }}>
                    {al.v}{merged ? <MorphText text={` – ${au.v}`} /> : null}
                  </Liquid>
                </span>
              </span>
            </div>
            <Track lower={al} upper={au} fill={blocks.sage} />
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}
