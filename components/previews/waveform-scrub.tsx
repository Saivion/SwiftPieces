"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground, ink, signal } from "./palette";
import { curve, pressScale, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Waveform Scrub: a 42 second voice note, as the Swift piece draws it. A red play button joined to a glass capsule
 * of bars with the time at its end, and a speed chip joined to the far end. The storyboard: rest, paused, "0:42";
 * play dips and its glyph blurs to pause, the ink flows along the bars as the seconds count; a finger lands at 35%
 * (the playhead drops under it, the bars around it rise, a glass time bubble buds up out of the capsule) and drags to
 * 72%, the bubble riding it to "0:30"; release: the bubble melts home and playback carries on from there; the speed
 * chip dips and "1×" morphs to "1.5×", the ink flows faster; pause; back to rest.
 * Sizes are authored in px against the 560 x 420 docs stage and converted to `cqw`; the control is laid out at a
 * phone's width and scaled up as one picture.
 *
 * Motion follows the Swift piece: playback glides linearly between whole seconds, the playhead lands under a finger
 * at once and follows it linearly, the bars rise on `snap` and settle on `release`, the bubble leaves on the split
 * spring and comes home on the bounceless one, the time rolls on `value`, the chip's label morphs letter by letter,
 * and the presses sink by their size and spring back.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A finger or the clock moving over one scripted step: linear, so the playhead keeps pace with it. */
const linear = (prop: string, stepMs: number) => `${prop} ${Math.round(stepMs)}ms linear`;

// ---------------------------------------------------------------- Storyboard

const DURATION = 42;

type Step = {
  /** What happens, for people (and the launch video). */
  label: string;
  /** How long the step holds before the next one. */
  ms: number;
  /** Seconds into the note the playhead reaches by the end of the step. */
  time: number;
  /** The seconds the time label reads during the step. */
  clock: number;
  playing: boolean;
  rate: number;
  /** How the playhead gets to `time`: gliding with playback, dropped under a finger, following it, or (unset) landing on `value`. */
  move?: "flow" | "jump" | "track";
  /** The finger on the waveform, 0 to 1, while it is down. */
  finger?: number;
  press?: "play" | "rate";
  /** At the start and paused: the label reads the total. */
  rest?: boolean;
};

/** Playback from `from` to `to` seconds at `rate`, cut at whole seconds so the label ticks with the ink. */
function playback(from: number, to: number, rate: number, label: string, extra: Partial<Step> = {}): Step[] {
  const out: Step[] = [];
  let at = from;
  while (at < to - 1e-6) {
    const next = Math.min(Math.floor(at + 1e-6) + 1, to);
    out.push({ label: out.length ? label : label, ms: ((next - at) / rate) * 1000, time: next, clock: Math.floor(at + 1e-6), playing: true, rate, move: "flow", ...extra });
    at = next;
  }
  return out;
}

const STORY: readonly Step[] = (() => {
  const out: Step[] = [];
  out.push({ label: "Rest: paused at the start, the total on the label", ms: 1500, time: 0, clock: DURATION, playing: false, rate: 1, rest: true });
  out.push({ label: "Play dips under the finger", ms: 140, time: 0, clock: DURATION, playing: false, rate: 1, press: "play", rest: true });
  out.push(...playback(0, 2, 1, "Playing: the glyph blurs to pause and the ink flows along the bars"));
  const from = 0.35, to = 0.72;
  out.push({ label: "A finger lands at 35%: the playhead drops under it, the bars rise and the time buds out", ms: 320, time: from * DURATION, clock: from * DURATION, playing: true, rate: 1, move: "jump", finger: from });
  const legs = 13;
  for (let i = 1; i <= legs; i++) {
    const f = from + ((to - from) * i) / legs;
    out.push({ label: "The finger drags to 72%: the bubble rides it", ms: 70, time: f * DURATION, clock: f * DURATION, playing: true, rate: 1, move: "track", finger: f });
  }
  out.push({ label: "Held at 0:30", ms: 260, time: to * DURATION, clock: to * DURATION, playing: true, rate: 1, move: "track", finger: to });
  out.push(...playback(to * DURATION, 32, 1, "Release: one seek, the bubble melts home and playback carries on from there"));
  out.push({ label: "The speed chip dips", ms: 140, time: 32 + 0.14, clock: 32, playing: true, rate: 1, move: "flow", press: "rate" });
  out.push(...playback(32.14, 35, 1.5, "1× morphs to 1.5× and the ink flows faster"));
  out.push({ label: "Pause dips", ms: 140, time: 35 + 0.21, clock: 35, playing: true, rate: 1.5, move: "flow", press: "play" });
  out.push({ label: "Paused at 0:35", ms: 1200, time: 35.21, clock: 35, playing: false, rate: 1.5 });
  out.push({ label: "Back to rest: the playhead lands back at the start", ms: 1000, time: 0, clock: DURATION, playing: false, rate: 1, rest: true });
  return out;
})();

/** The last finger at or before each step: the bubble keeps its place and its time while it melts home. */
const LAST_FINGER = STORY.map((_, i) => {
  for (let k = i; k >= 0; k--) if (STORY[k].finger !== undefined) return STORY[k];
  return STORY.find((step) => step.finger !== undefined) as Step;
});

// ---------------------------------------------------------------- Geometry (WaveformScrub.swift at its defaults)

/** The control at a phone's width, scaled up onto the stage. */
const WIDTH = 360, SCALE = 1.36;
const H = 52, CHIP_H = 32, CHIP_W = 58, BUBBLE_H = 30, BUBBLE_W = 58;
const J = liquid.joined;
const CAPSULE_W = WIDTH - H - CHIP_W - J * 2;
const PAD_L = 18, PAD_R = 16, GAP = 10, TIME_W = 30, INSET = 10;
const WAVE_W = CAPSULE_W - PAD_L - PAD_R - GAP - TIME_W;
const WAVE_H = H - INSET * 2;
const BAR = 3, SPACING = 2;
const COUNT = Math.max(Math.floor((WAVE_W + SPACING) / (BAR + SPACING)), 1);
const USED = COUNT * BAR + (COUNT - 1) * SPACING;
const OFFSET = (WAVE_W - USED) / 2;
/** At rest the tallest bar leaves room to rise 30% inside the waveform's height. */
const TALLEST = WAVE_H / 1.3;
/** How far the bubble sits above the capsule's centre line: a joined gap over its top edge. */
const RISE = H / 2 + J + BUBBLE_H / 2;

/** A spoken note: five phrases with short pauses between them. The same envelope as the Swift example. */
const SAMPLES = [
  0.05, 0.32, 0.45, 0.27, 0.6, 0.8, 0.17, 0.42, 0.55, 0.22, 0.78, 0.99, 0.06, 0.04, 0.37, 0.49, 0.25,
  0.67, 0.83, 0.29, 0.5, 0.63, 0.22, 0.31, 0.37, 0.19, 0.59, 0.73, 0.05, 0.04, 0.26, 0.33, 0.27, 0.47,
  0.6, 0.26, 0.73, 0.88, 0.06, 0.06, 0.46, 0.54, 0.29, 0.67, 0.84, 0.2, 0.33, 0.41, 0.22, 0.72, 0.91,
  0.28, 0.49, 0.62, 0.05, 0.06, 0.38, 0.46, 0.23, 0.55, 0.68, 0.23, 0.27, 0.35, 0.05,
];

/** Bar `i` of `count`: the peak of its stretch of samples, or between two samples when there are fewer, as Swift resamples. */
function level(i: number, count: number, samples: number[]): number {
  const n = samples.length, top = Math.max(...samples, 0) || 1;
  if (n >= count) {
    const lo = Math.floor((i * n) / count), hi = Math.max(Math.floor(((i + 1) * n) / count), lo + 1);
    return Math.max(...samples.slice(lo, Math.min(hi, n))) / top;
  }
  const place = count > 1 ? (i * (n - 1)) / (count - 1) : 0, below = Math.floor(place), above = Math.min(below + 1, n - 1);
  return (samples[below] + (samples[above] - samples[below]) * (place - below)) / top;
}
const HEIGHTS = Array.from({ length: COUNT }, (_, i) => BAR + (TALLEST - BAR) * level(i, COUNT, SAMPLES));
const BAR_X = (i: number) => OFFSET + i * (BAR + SPACING);

/** How much bar `i` rises for a finger at `x` in the waveform: up to 30%, easing off over five bars either side. */
function rise(i: number, x: number | undefined): number {
  if (x === undefined) return 1;
  const reach = (BAR + SPACING) * 5, d = Math.abs(BAR_X(i) + BAR / 2 - x);
  return d < reach ? 1 + (0.3 * (1 + Math.cos((Math.PI * d) / reach))) / 2 : 1;
}

/** `0:42`, as `Duration.formatted(.time(pattern: .minuteSecond))` writes it. */
const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const speed = (rate: number) => `${Number(rate.toFixed(2)).toLocaleString("en-US")}×`;

// ---------------------------------------------------------------- Glyphs (the SF Symbols the piece draws)

function PlayGlyph({ name }: { name: "play" | "pause" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(20), height: u(20), display: "block" }} fill="currentColor">
      {name === "play"
        ? <path d="M7.6 4.9v14.2c0 .95 1.03 1.54 1.85 1.06l12.05-7.1c.8-.48.8-1.64 0-2.12L9.45 3.84C8.63 3.36 7.6 3.95 7.6 4.9Z" />
        : (<><rect x="5.6" y="4.2" width="4.6" height="15.6" rx="1.4" /><rect x="13.8" y="4.2" width="4.6" height="15.6" rx="1.4" /></>)}
    </svg>
  );
}

// ---------------------------------------------------------------- Hooks

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

/** Walks the storyboard; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return { step: steps[i], index: i };
}

/** The digit roll `.numericText` plays: new digits rise in when the number grows and drop in when it shrinks. */
const rollKeyframes = "@keyframes ws-roll{from{transform:translateY(var(--roll,40%));opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}";

/** Text that rolls to a new value on `value`, never past it. With `roll` off it changes in place, as digits under a finger do. */
function Roll({ text, n, roll }: { text: string; n: number; roll: boolean }) {
  const last = useRef(n), mounted = useRef(false);
  const up = n >= last.current;
  useEffect(() => { last.current = n; mounted.current = true; }, [n]);
  return <RollFace key={text} roll={roll && mounted.current} up={up}>{text}</RollFace>;
}

function RollFace({ roll, up, children }: { roll: boolean; up: boolean; children: ReactNode }) {
  const [style] = useState(() => {
    const { easing, ms: d } = curve("value");
    return { display: "inline-block", "--roll": up ? "40%" : "-40%", animation: roll ? `ws-roll ${d}ms ${easing} both` : undefined } as CSSProperties;
  });
  return <span data-motion style={style}>{children}</span>;
}

// ---------------------------------------------------------------- Preview

export function WaveformScrubPreview() {
  const { step: s, index } = useSteps(STORY);
  const fraction = s.time / DURATION;
  const split = OFFSET + USED * fraction;
  const down = s.finger !== undefined;
  const focus = down ? OFFSET + USED * (s.finger as number) : undefined;
  // The playhead never animates under a finger or while it glides; a change while paused lands on `value`.
  const splitMotion = s.move === "jump" ? "none" : s.move === "flow" || s.move === "track" ? linear("clip-path", s.ms) : t("clip-path", "value");
  // The bars rise on the press, follow the finger, and settle back with a little give when it lifts.
  const liftMotion = s.move === "jump" ? t("transform", "snap") : s.move === "track" ? linear("transform", s.ms) : t("transform", "release");
  // The bubble rides the finger, kept over the capsule's straight run.
  const held = LAST_FINGER[index];
  const fingerX = PAD_L + OFFSET + USED * (held.finger as number);
  const bubbleX = Math.min(Math.max(fingerX, BUBBLE_W / 2 + 10), CAPSULE_W - BUBBLE_W / 2 - 10);
  const bubbleClock = clock(held.clock);
  const label = s.rest ? clock(DURATION) : clock(s.clock);
  const glyph = s.playing ? "pause" : "play";

  const bars = (color: string) =>
    HEIGHTS.map((h, i) => (
      <span
        key={i}
        data-motion
        className="absolute"
        style={{
          left: u(BAR_X(i)), top: u((WAVE_H - h) / 2), width: u(BAR), height: u(h), borderRadius: u(BAR / 2), background: color,
          transform: `scaleY(${rise(i, focus).toFixed(4)})`, transition: liftMotion,
        }}
      />
    ));

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`${rollKeyframes}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`}</style>
      <div style={{ width: u(WIDTH), transform: `scale(${SCALE})`, marginTop: u(BUBBLE_H / 2) }}>
        <LiquidGroup unit={u(1)} axis="both">
          <div className="flex items-center" style={{ height: u(H), gap: u(J) }}>
            {/* Play: red, the one signal on the control. It sinks under the finger, and its glyph blurs to pause. */}
            <span data-motion className="flex" style={{ transform: `scale(${s.press === "play" ? pressScale(H, H) : 1})`, transition: t("transform", s.press === "play" ? "press" : "release") }}>
              <Liquid tint={signal.fill} className="relative grid place-items-center" style={{ width: u(H), height: u(H), color: ink }}>
                {(["play", "pause"] as const).map((name) => (
                  <span
                    key={name}
                    data-motion
                    style={{
                      gridArea: "1 / 1", display: "flex", transform: name === "play" ? `translateX(${u(1.5)})` : undefined,
                      opacity: glyph === name ? 1 : 0, filter: `blur(${glyph === name ? 0 : 5}px)`, transition: t(["opacity", "filter"], "snap"),
                    }}
                  >
                    <PlayGlyph name={name} />
                  </span>
                ))}
              </Liquid>
            </span>

            {/* The capsule, and under it the time bubble that buds up out of it above the finger. */}
            <div className="relative" style={{ width: u(CAPSULE_W), height: u(H) }}>
              <span data-motion className="absolute left-0" style={{ top: u((H - BUBBLE_H) / 2), transform: `translateX(${u(bubbleX - BUBBLE_W / 2)})`, transition: s.move === "track" ? linear("transform", s.ms) : "none" }}>
                <Liquid bud={{ out: down, rest: [0, -RISE], home: [0, 0] }} className="flex items-center justify-center" style={{ width: u(BUBBLE_W), height: u(BUBBLE_H) }}>
                  <BudContent out={down}>
                    <span className="tabular-nums" style={{ fontSize: u(15), fontWeight: 600, lineHeight: 1, color: ground.text }}>{bubbleClock}</span>
                  </BudContent>
                </Liquid>
              </span>
              <Liquid className="relative flex h-full w-full items-center" style={{ paddingLeft: u(PAD_L), paddingRight: u(PAD_R), gap: u(GAP) }}>
                <span className="relative" style={{ width: u(WAVE_W), height: u(WAVE_H) }}>
                  <span className="absolute inset-0">{bars(ground.subtle)}</span>
                  {/* The same bars inked and cut at the playhead, so the split falls mid-bar. */}
                  <span data-motion className="absolute inset-0" style={{ clipPath: `inset(0 ${u(WAVE_W - split)} 0 0)`, transition: splitMotion }}>{bars(ground.text)}</span>
                </span>
                <span className="tabular-nums text-right" style={{ width: u(TIME_W), fontSize: u(13), fontWeight: 600, lineHeight: 1, color: ground.muted, whiteSpace: "nowrap" }}>
                  <Roll text={label} n={s.rest ? DURATION : s.clock} roll={!down} />
                </span>
              </Liquid>
            </div>

            {/* The speed chip, joined to the capsule's end. It keeps the widest speed's width; its label morphs. */}
            <span data-motion className="flex" style={{ transform: `scale(${s.press === "rate" ? pressScale(CHIP_W, CHIP_H) : 1})`, transition: t("transform", s.press === "rate" ? "press" : "release") }}>
              <Liquid className="flex items-center justify-center" style={{ width: u(CHIP_W), height: u(CHIP_H) }}>
                <MorphText text={speed(s.rate)} style={{ fontSize: u(15), fontWeight: 600, lineHeight: 1, color: ground.text, fontVariantNumeric: "tabular-nums" }} />
              </Liquid>
            </span>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}
