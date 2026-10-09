"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { font, ground, signal } from "./palette";
import { curve, follow, ms, reduced as prefersReduced, roles, springValue, t, tiers } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Activity Heatmap: twenty weeks of practice as rounded day cells in solid steps from a pale red mix up to
 * pure red, under the current streak on its glass chip. The empty tiles and today's ring are there at once and
 * the shades grow into them in a wave. A finger runs along today's row week by week: the day under it is
 * plucked up as a glass tile tinted with its shade, its glass callout buds out of it on a liquid neck, and both
 * glide from day to day; it stops on today, and today fills in (kicked up off its tile under the lift) as the
 * streak rolls from 11 to 12 days. Let go, the callout melts back into the day. The data is the Swift example's,
 * on Thursday, October 1, 2026. Sizes are authored in px against the 560 px docs stage and converted to `cqw`;
 * the liquid groups take one stage px as their point.
 */

type Step = { ms: number; finger: readonly [column: number, row: number] | null; todayDone: boolean; note: string };

/**
 * The storyboard (the launch video reuses it). Each step holds for `ms`, then the next one starts; it loops
 * after the last. `finger` is the day under the finger as [week column 0 to 19, weekday row 0 to 6 from
 * Sunday], `null` while lifted. `todayDone` is whether today has its 70 minutes yet. 6.9 s per loop.
 */
const steps: readonly Step[] = [
  { ms: 1600, finger: null, todayDone: false, note: "Rest. The weeks fill in with a wave, oldest first. Current streak 11 days; today is still open and ringed." },
  { ms: 180, finger: [14, 4], todayDone: false, note: "A finger lands on Thursday five weeks back: the day lifts and the callout shows its date and minutes." },
  { ms: 180, finger: [15, 4], todayDone: false, note: "It runs along the row, a week per step, and the callout follows." },
  { ms: 180, finger: [16, 4], todayDone: false, note: "" },
  { ms: 180, finger: [17, 4], todayDone: false, note: "" },
  { ms: 180, finger: [18, 4], todayDone: false, note: "" },
  { ms: 800, finger: [19, 4], todayDone: false, note: "It stops on today: Today, No activity." },
  { ms: 1900, finger: [19, 4], todayDone: true, note: "Today fills to the third shade with a pop; the streak rolls 11 to 12 and active 95 to 96 days; the callout reads 70 min." },
  { ms: 1700, finger: null, todayDone: true, note: "The finger lifts and the callout fades. Rest, then the loop starts over." },
];

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

// Geometry at the 560 px stage.
const WEEKS = 20;
const LEFT = 30;
const WIDTH = 500;
const LABELS = 38; // weekday label column and its gap
const GAP = 3.6;
const STRIDE = (WIDTH - LABELS + GAP) / WEEKS;
const CELL = STRIDE - GAP;
const RADIUS = 5;
const HEADER = 24;
const GRID_X = LEFT + LABELS;
const SUMMARY_H = 96;
/** The legend chip's height and its gap under the grid. */
const LEGEND_H = 24;
const LEGEND_GAP = 10;
const TOP = (420 - (SUMMARY_H + 22 + HEADER + 7 * STRIDE - GAP + LEGEND_GAP + LEGEND_H)) / 2;
const GRID_Y = TOP + SUMMARY_H + 22 + HEADER;
const TODAY_INDEX = 19 * 7 + 4; // Thursday in the last week

/** Light and dark shades, as Swift mixes them: the accent into the ground, never transparency. */
const MIX = { light: [20, 40, 60], dark: [45, 62, 80] } as const;
const shade = (level: number, tone: "light" | "dark") =>
  level <= 0 ? ground.field : level >= 4 ? signal.fill : `color-mix(in srgb, ${signal.fill} ${MIX[tone][level - 1]}%, ${ground.bg})`;

// ---------------------------------------------------------------- Motion

/** The entrance wave, as Swift's: how far the newest week lags the oldest, and each row the one above it. */
const WAVE_SPREAD = 450;
const WAVE_ROW_STEP = 22;
/** The lifted day's rise, a clear pluck. */
const RAISE = 1.32;
/** The callout's size; it rests a neck's width from the lifted day. */
const CALLOUT = { w: 128, h: 50 } as const;
/** One stage px as the liquid groups' point. */
const UNIT = u(1);
/** A changed day's kick, in cell sizes per second, on the rebound spring (Swift's `popKick`). */
const POP_KICK = 7.6;

let growCache: { easing: string; ms: number } | null = null;
/**
 * A shade growing into its tile: the reveal spring held at full size once it first gets there, as Swift clamps
 * it, so no shade ever reads larger than its tile. Runs until that first arrival.
 */
function grow() {
  if (growCache) return growCache;
  const s = roles.reveal;
  let end = 0.05;
  while (end < 2 && springValue(s, end) < 1) end += 0.002;
  const linear = curve("value").easing.startsWith("linear(");
  const n = 40;
  const easing = linear
    ? `linear(${Array.from({ length: n + 1 }, (_, k) => (k === 0 ? "0" : k === n ? "1" : Math.min(springValue(s, (k / n) * end), 1).toFixed(4))).join(", ")})`
    : "cubic-bezier(0.22, 1, 0.36, 1)";
  growCache = { easing, ms: Math.round(end * 1000) };
  return growCache;
}

/**
 * A changed day kicked up off its tile and settling on the rebound spring, its neighbours still: it swells about
 * 25% within 80ms, dips about 2% under its size and settles, as Swift's `pop`. Sampled for Web Animations.
 */
function popFrames(): Keyframe[] {
  const s = roles.rebound;
  const w = (2 * Math.PI) / s.duration;
  const z = 1 - s.bounce;
  const wd = w * Math.sqrt(1 - z * z);
  const total = ms("rebound") / 1000;
  return Array.from({ length: 41 }, (_, k) => {
    const time = (k / 40) * total;
    const x = (POP_KICK * Math.exp(-z * w * time) * Math.sin(wd * time)) / wd;
    return { transform: `scale(${(1 + x).toFixed(4)})` };
  });
}

// ---------------------------------------------------------------- Data

/** Minutes per day, newest first, from the Swift example's generator (the same 64-bit sequence). */
function minutesBack(todayDone: boolean): number[] {
  let seed = 0x9e3779b97f4a7c15n;
  const mask = (1n << 64n) - 1n;
  const out: number[] = [];
  for (let back = 0; back < 140; back++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & mask;
    const r = Number(seed >> 33n) / 2 ** 31;
    const weekday = new Date(2026, 9, 1 - back).getDay();
    const weekend = weekday === 0 || weekday === 6;
    let active: boolean;
    if (back === 0) active = todayDone;
    else if ((back >= 1 && back <= 11) || (back >= 48 && back <= 78)) active = true;
    else if (back === 12 || (back >= 41 && back <= 47) || back === 79) active = false;
    else if (back <= 40) active = r > (weekend ? 0.45 : 0.18);
    else active = r > (weekend ? 0.7 : 0.45);
    out.push(active ? (back === 0 ? 70 : (back > 80 ? 15 : 25) + Math.round(r * 70)) : 0);
  }
  return out;
}

type Model = { values: number[]; levels: number[]; streak: number; longest: number; active: number };

/** Grid order (column major, seven per week from Sunday), quartile levels and streaks, as the Swift model. */
function model(todayDone: boolean): Model {
  const back = minutesBack(todayDone);
  const values = Array.from({ length: TODAY_INDEX + 1 }, (_, i) => back[TODAY_INDEX - i] ?? 0);
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (h - lo);
  };
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const top = sorted[sorted.length - 1];
  const levels = values.map((v) => (v <= 0 ? 0 : v >= top ? 4 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4));
  let streak = 0;
  for (let i = TODAY_INDEX - (values[TODAY_INDEX] > 0 ? 0 : 1); i >= 0 && values[i] > 0; i--) streak++;
  let longest = 0;
  let run = 0;
  for (const v of values) {
    run = v > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { values, levels, streak, longest, active: sorted.length };
}

const dayOf = (i: number) => new Date(2026, 9, 1 - (TODAY_INDEX - i));
const MONTHS = (() => {
  const out: Array<{ column: number; text: string }> = [];
  for (let c = 0; c < WEEKS; c++) {
    for (let r = 0; r < 7 && c * 7 + r <= TODAY_INDEX; r++) {
      if (dayOf(c * 7 + r).getDate() === 1) {
        out.push({ column: c, text: dayOf(c * 7 + r).toLocaleString("en-US", { month: "short" }) });
        break;
      }
    }
  }
  // The partial month in the first week only shows when the next label leaves it room, as in Swift.
  if ((out[0]?.column ?? 0) > 2) out.unshift({ column: 0, text: dayOf(0).toLocaleString("en-US", { month: "short" }) });
  return out;
})();
const dateLabel = (i: number) =>
  i === TODAY_INDEX ? "Today" : dayOf(i).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });

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

/**
 * Walks the storyboard; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion.
 * `prev` is the step before, so a fresh touch can land without travelling.
 */
function useSteps(list: readonly Step[]) {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ i: 0, loop: 0 });
  useEffect(() => {
    if (reduced) {
      setState((s) => (s.i === 0 ? s : { i: 0, loop: s.loop }));
      return;
    }
    const t = setTimeout(() => setState((s) => (s.i + 1 >= list.length ? { i: 0, loop: s.loop + 1 } : { i: s.i + 1, loop: s.loop })), list[state.i].ms);
    return () => clearTimeout(t);
  }, [state.i, list, reduced]);
  return { step: list[state.i], prev: list[(state.i + list.length - 1) % list.length], loop: state.loop, reduced };
}

/** Light or dark stage: the mixes differ, so read the ground the preview actually sits on, and follow theme changes. */
function useTone(ref: RefObject<HTMLElement | null>) {
  const [tone, setTone] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const read = () => {
      const el = ref.current;
      if (!el) return;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!m) return;
      const [r, g, b] = m.map(Number);
      setTone(0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "light" : "dark");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, [ref]);
  return tone;
}

// ---------------------------------------------------------------- Pieces

function Flame() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(14), height: u(14), flex: "none" }}>
      <path fill={signal.fill} d="M12.4 2.2c.4 3-1.2 4.6-2.9 6.4C7.6 10.6 6 12.6 6 15.4 6 19 8.7 22 12.2 22c3.6 0 6.2-2.8 6.2-6.6 0-2.5-1.1-4.4-2.4-5.9-.2 1.3-.8 2.4-1.9 3 .4-3.9-.4-7.6-1.7-10.3zM12.3 20.2c-1.6 0-2.8-1.2-2.8-2.9 0-1.5.9-2.4 1.8-3.4.6-.6 1.1-1.3 1.3-2.2 1.3 1.1 2.5 2.7 2.5 4.6 0 2.2-1.2 3.9-2.8 3.9z" />
    </svg>
  );
}

/**
 * A number whose changed digits roll up into place, like SwiftUI's numeric text transition. A figure people
 * read, so it rolls on the value spring and never overshoots.
 */
function Roll({ value, style }: { value: number; style?: CSSProperties }) {
  const prev = useRef(value);
  const [from, setFrom] = useState(value);
  useEffect(() => {
    if (prev.current !== value) setFrom(prev.current);
    prev.current = value;
  }, [value]);
  const next = String(value);
  const old = String(from).padStart(next.length, " ");
  const roll = curve("value");
  return (
    <span style={{ display: "inline-flex", fontVariantNumeric: "tabular-nums", ...style }}>
      {next.split("").map((digit, k) => {
        const changed = from !== value && old[k] !== digit;
        return (
          <span key={k} style={{ position: "relative", display: "inline-block", overflow: "hidden", padding: "0.06em 0", margin: "-0.06em 0" }}>
            {changed ? (
              <span key={`o${value}`} data-motion aria-hidden style={{ position: "absolute", left: 0, top: "0.06em", animation: `hm-roll-out ${roll.ms}ms ${roll.easing} both` }}>{old[k]}</span>
            ) : null}
            <span key={`n${value}`} data-motion style={{ display: "inline-block", animation: changed ? `hm-roll-in ${roll.ms}ms ${roll.easing} both` : undefined }}>{digit}</span>
          </span>
        );
      })}
    </span>
  );
}

/** A day's shade whose value just changed: it fills its tile at once and is kicked up off it on mount. */
function PoppedShade({ background }: { background: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    const pop = el.animate(popFrames(), { duration: ms("rebound"), easing: "linear" });
    return () => pop.cancel();
  }, []);
  return <span ref={ref} data-motion style={{ position: "absolute", inset: 0, borderRadius: u(RADIUS), background }} />;
}

/** A figure beside the streak: its value over a quiet label, as Swift's `figure`. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: u(4) }}>
      <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1, fontSize: u(20), fontWeight: 600, color: ground.text, fontVariantNumeric: "tabular-nums" }}>
        <Roll value={value} />
        &nbsp;days
      </span>
      <span style={{ fontSize: u(13), fontWeight: 600, color: ground.muted, lineHeight: 1 }}>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Preview

export function ActivityHeatmapPreview() {
  const { step, prev, loop, reduced } = useSteps(steps);
  const root = useRef<HTMLDivElement>(null);
  const tone = useTone(root);
  const before = useMemo(() => model(false), []);
  const after = useMemo(() => model(true), []);
  // The loop starts from `before`; a day whose value differs from it has changed and pops instead of waving in.
  const start = steps[0].todayDone ? after : before;
  const m = step.todayDone ? after : before;
  const dayAt = (f: Step["finger"]) => (f ? Math.min(f[0] * 7 + f[1], TODAY_INDEX) : null);
  const selected = dayAt(step.finger);
  const touching = selected !== null;
  const wasTouching = prev.finger !== null;
  // At rest the lift stays on its last day, so it settles back where it was.
  const shown = selected ?? dayAt(prev.finger) ?? TODAY_INDEX;
  const cellX = (i: number) => GRID_X + Math.floor(i / 7) * STRIDE;
  const cellY = (i: number) => GRID_Y + (i % 7) * STRIDE;
  const caption: CSSProperties = { fontSize: u(13), fontWeight: 600, color: ground.muted, whiteSpace: "nowrap" };
  const waveIn = grow();

  // The callout rests a neck's width above the lifted day, kept inside the grid's width. Home is the middle of the
  // day, shrunk small enough to fit inside it, since the day is smaller than the callout.
  const lift = (CELL * (RAISE - 1)) / 2;
  const calloutLeft = Math.min(Math.max(cellX(shown) + CELL / 2 - CALLOUT.w / 2, LEFT), LEFT + WIDTH - CALLOUT.w);
  const calloutTop = cellY(shown) - lift - liquid.joined - CALLOUT.h;
  const home = [cellX(shown) + CELL / 2 - (calloutLeft + CALLOUT.w / 2), cellY(shown) + CELL / 2 - (calloutTop + CALLOUT.h / 2)];
  const shrink = (CELL * RAISE * 0.7) / CALLOUT.w;

  // The lift and its callout glide from day to day on the press spring, which never bounces or trails the finger;
  // a fresh touch lands on its day without travelling.
  const glide = touching && wasTouching;
  const move = glide ? t("transform", "press") : "transform 0ms";
  const place = glide ? t(["left", "top"], "press") : "left 0ms, top 0ms";
  // Only a step to another day blends the shade. A fresh touch lands in its own shade, and a day whose value
  // changes under the finger simply takes the new one, as Swift's lifted cell does.
  const tint = glide && selected !== dayAt(prev.finger) ? t("background-color", "press") : "none";
  // The selection's lead: the day springs up out of the still grid with visible give (Swift's follow(elastic, 0))
  // while the callout buds out of it on the split spring. Let go, the callout melts home on the bounceless spring,
  // the day settles back onto the grid and the pair leaves once the callout is in.
  const lands = touching && !wasTouching;
  const pluck = touching ? (lands ? t("transform", follow(tiers.elastic, 0)) : "none") : t("transform", "dismiss");
  // The callout buds a beat behind the pluck, so the day leads.
  const budMove = touching ? t("transform", liquid.split, lands ? 60 : 0) : t("transform", liquid.home);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{[
        `@keyframes hm-grow{from{transform:scale(0)}to{transform:scale(1)}}`,
        `@keyframes hm-roll-in{from{transform:translateY(55%);opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}`,
        `@keyframes hm-roll-out{from{transform:none;opacity:1}to{transform:translateY(-55%);opacity:0;filter:blur(2px)}}`,
        `@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`,
      ].join("")}</style>

      {/* Summary: the streak under its glass chip on the left, longest and active days on the right. */}
      <div style={{ position: "absolute", left: u(LEFT), width: u(WIDTH), top: u(TOP), height: u(SUMMARY_H), display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: u(8) }}>
          <LiquidGroup unit={UNIT}>
            <Liquid className="flex items-center" style={{ gap: u(6), height: u(30), paddingInline: u(12), fontSize: u(14), fontWeight: 600, color: ground.muted, whiteSpace: "nowrap" }}>
              <Flame />
              Current streak
            </Liquid>
          </LiquidGroup>
          <span style={{ display: "flex", alignItems: "baseline", gap: u(5), lineHeight: 1 }}>
            {/* Keyed by loop: the reset to 11 at the start of a loop is not a change to roll. */}
            <Roll key={loop} value={m.streak} style={{ fontSize: u(58), fontWeight: font.numeralWeight, letterSpacing: u(-1.2) }} />
            <span style={{ fontSize: u(21), fontWeight: 600, color: ground.muted }}>days</span>
          </span>
        </div>
        {/* Longest and active days: two figures side by side, a hairline between them, on the streak's baseline. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: u(16), paddingBottom: u(4) }}>
          <Figure key={`l${loop}`} label="Longest" value={m.longest} />
          <span aria-hidden style={{ width: u(1), height: u(37), background: `color-mix(in srgb, ${ground.muted} 25%, transparent)`, alignSelf: "center" }} />
          <Figure key={`a${loop}`} label="Active" value={m.active} />
        </div>
      </div>

      {/* Month labels above the first week of each month; the last one keeps inside the grid. */}
      {MONTHS.map((label) => (
        <span key={label.column} style={{ ...caption, position: "absolute", top: u(GRID_Y - HEADER + 1), left: u(Math.min(cellX(label.column * 7), LEFT + WIDTH - 30)) }}>
          {label.text}
        </span>
      ))}
      {/* Weekday labels on every other row. */}
      {(["Mon", "Wed", "Fri"] as const).map((text, k) => (
        <span key={text} style={{ ...caption, position: "absolute", left: u(LEFT), top: u(cellY(1 + k * 2) + CELL / 2), transform: "translateY(-50%)" }}>{text}</span>
      ))}

      {/* The cells. The empty tiles hold still and are there at once; each shade grows from the middle of its tile
          in a wave, oldest week first and each row a beat after the one above. A new key each loop replays it. */}
      <div key={loop}>
        {m.levels.map((level, i) => {
          const delay = (Math.floor(i / 7) / (WEEKS - 1)) * WAVE_SPREAD + (i % 7) * WAVE_ROW_STEP;
          const changed = m.values[i] !== start.values[i];
          return (
            <span
              key={i}
              style={{ position: "absolute", left: u(cellX(i)), top: u(cellY(i)), width: u(CELL), height: u(CELL), borderRadius: u(RADIUS), background: ground.field }}
            >
              {level <= 0 ? null : changed ? (
                <PoppedShade key="pop" background={shade(level, tone)} />
              ) : (
                <span
                  key="wave"
                  data-motion
                  style={{
                    position: "absolute", inset: 0, borderRadius: u(RADIUS), background: shade(level, tone),
                    animation: reduced ? undefined : `hm-grow ${waveIn.ms}ms ${waveIn.easing} ${Math.round(delay)}ms both`,
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
      {/* Today's ring belongs to the tile, so it is there from the first frame, drawn over the shade. */}
      <span
        aria-hidden
        style={{
          position: "absolute", left: u(cellX(TODAY_INDEX)), top: u(cellY(TODAY_INDEX)), width: u(CELL), height: u(CELL), borderRadius: u(RADIUS),
          boxShadow: `0 0 0 ${u(1.25)} ${ground.bg}, 0 0 0 ${u(2.75)} ${ground.text}`, pointerEvents: "none",
        }}
      />

      {/* The legend on a glass chip under the grid's trailing edge. */}
      <LiquidGroup unit={UNIT} style={{ position: "absolute", right: u(560 - LEFT - WIDTH), top: u(GRID_Y + 7 * STRIDE - GAP + LEGEND_GAP) }}>
        <Liquid className="flex items-center" style={{ ...caption, gap: u(7), height: u(LEGEND_H), paddingInline: u(11) }}>
          Less
          <span style={{ display: "flex", gap: u(3.5) }}>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} style={{ width: u(12), height: u(12), borderRadius: u(3), background: shade(level, tone) }} />
            ))}
          </span>
          More
        </Liquid>
      </LiquidGroup>

      {/* The finger. */}
      <span
        aria-hidden
        data-motion
        style={{
          position: "absolute", left: 0, top: 0, width: u(38), height: u(38), borderRadius: "50%",
          boxSizing: "border-box", border: `${u(1.5)} solid ${ground.muted}`, background: "color-mix(in srgb, currentColor 7%, transparent)",
          transform: `translate(${u(cellX(shown) + CELL / 2 - 19)}, ${u(cellY(shown) + CELL / 2 - 17)})`,
          opacity: touching ? 0.7 : 0, transition: `${move}, ${t("opacity", touching ? "press" : "dismiss")}`,
        }}
      />

      {/* The lifted day and its callout, liquid glass in one group. They come up on the snap and leave once the
          callout has melted back in. */}
      <LiquidGroup
        unit={UNIT}
        axis="both"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: touching ? 1 : 0, transition: touching ? t("opacity", "snap") : "opacity 300ms ease-in 420ms" }}
      >
        {/* The callout first, so it slips under the day going home. Its text swaps at once, so a fast scrub never ghosts. */}
        <span data-motion aria-hidden style={{ position: "absolute", left: u(calloutLeft), top: u(calloutTop), width: u(CALLOUT.w), height: u(CALLOUT.h), transition: place }}>
          <span data-motion style={{ display: "block", width: "100%", height: "100%", transform: touching ? "none" : `translate(${u(home[0])}, ${u(home[1])}) scale(${(liquid.homeScale * shrink).toFixed(3)})`, transition: budMove }}>
            <Liquid radius={14} className="flex flex-col justify-center" style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: `${u(7)} ${u(11)}`, gap: u(2), color: ground.text }}>
              <BudContent out={touching}>
                <span className="flex flex-col" style={{ gap: u(2) }}>
                  <span style={{ fontSize: u(12.5), fontWeight: 600, opacity: 0.6, whiteSpace: "nowrap" }}>{dateLabel(shown)}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: u(7), fontSize: u(17), fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    <span data-motion style={{ width: u(11), height: u(11), borderRadius: u(3), background: shade(m.levels[shown], tone), flex: "none", transition: tint }} />
                    {m.values[shown] > 0 ? `${m.values[shown]} min` : "No activity"}
                  </span>
                </span>
              </BudContent>
            </Liquid>
          </span>
        </span>
        {/* The day, as glass tinted with its shade, plucked up out of the still grid. */}
        <span data-motion aria-hidden style={{ position: "absolute", left: 0, top: 0, width: u(CELL), height: u(CELL), transform: `translate(${u(cellX(shown))}, ${u(cellY(shown))})`, transition: move }}>
          <span data-motion style={{ display: "block", width: "100%", height: "100%", transform: `scale(${touching ? RAISE : 1})`, transition: pluck }}>
            <Liquid radius={RADIUS} tint={shade(m.levels[shown], tone)} style={{ width: "100%", height: "100%", transition: tint }} />
          </span>
        </span>
      </LiquidGroup>
    </div>
  );
}
