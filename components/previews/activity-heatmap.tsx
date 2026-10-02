"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { font, ground, signal } from "./palette";

/*
 * Activity Heatmap: twenty weeks of practice as rounded day cells in solid steps from a pale red mix up to
 * pure red, under the current streak. The weeks fill in with a wave, a finger runs along today's row week by
 * week (the day under it lifts and the callout follows), stops on today, and today fills in with a pop as
 * the streak rolls from 11 to 12 days. The data is the Swift example's, on Thursday, October 1, 2026.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
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
const spring = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

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
const SUMMARY_H = 78;
const TOP = (420 - (SUMMARY_H + 22 + HEADER + 7 * STRIDE - GAP + 12 + 15)) / 2;
const GRID_Y = TOP + SUMMARY_H + 22 + HEADER;
const TODAY_INDEX = 19 * 7 + 4; // Thursday in the last week

/** Light and dark shades, as Swift mixes them: the accent into the ground, never transparency. */
const MIX = { light: [20, 40, 60], dark: [45, 62, 80] } as const;
const shade = (level: number, tone: "light" | "dark") =>
  level <= 0 ? ground.field : level >= 4 ? signal.fill : `color-mix(in srgb, ${signal.fill} ${MIX[tone][level - 1]}%, ${ground.bg})`;

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
        out.push({ column: c, text: dayOf(c * 7 + r).toLocaleString("en-US", { month: "short" }).toUpperCase() });
        break;
      }
    }
  }
  // The partial month in the first week only shows when the next label leaves it room, as in Swift.
  if ((out[0]?.column ?? 0) > 2) out.unshift({ column: 0, text: dayOf(0).toLocaleString("en-US", { month: "short" }).toUpperCase() });
  return out;
})();
const dateLabel = (i: number) =>
  i === TODAY_INDEX ? "TODAY" : dayOf(i).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

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
  return { step: list[state.i], loop: state.loop, reduced };
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

/** A number whose changed digits roll up into place, like SwiftUI's numeric text transition. */
function Roll({ value, style }: { value: number; style?: CSSProperties }) {
  const prev = useRef(value);
  const [from, setFrom] = useState(value);
  useEffect(() => {
    if (prev.current !== value) setFrom(prev.current);
    prev.current = value;
  }, [value]);
  const next = String(value);
  const old = String(from).padStart(next.length, " ");
  return (
    <span style={{ display: "inline-flex", fontVariantNumeric: "tabular-nums", ...style }}>
      {next.split("").map((digit, k) => {
        const changed = from !== value && old[k] !== digit;
        return (
          <span key={k} style={{ position: "relative", display: "inline-block", overflow: "hidden", padding: "0.06em 0", margin: "-0.06em 0" }}>
            {changed ? (
              <span key={`o${value}`} data-motion aria-hidden style={{ position: "absolute", left: 0, top: "0.06em", animation: `hm-roll-out .45s ${ease} both` }}>{old[k]}</span>
            ) : null}
            <span key={`n${value}`} data-motion style={{ display: "inline-block", animation: changed ? `hm-roll-in .45s ${ease} both` : undefined }}>{digit}</span>
          </span>
        );
      })}
    </span>
  );
}

function Figure({ label, value, children }: { label: string; value?: number; children: ReactNode }) {
  return (
    <>
      <span style={{ fontSize: u(13), fontWeight: 600, letterSpacing: u(1.6), color: ground.muted }}>{label}</span>
      <span style={{ justifySelf: "end", fontSize: u(20), fontWeight: 500, color: ground.text, fontVariantNumeric: "tabular-nums" }}>
        {value !== undefined ? <Roll value={value} /> : null}
        {children}
      </span>
    </>
  );
}

// ---------------------------------------------------------------- Preview

export function ActivityHeatmapPreview() {
  const { step, loop, reduced } = useSteps(steps);
  const root = useRef<HTMLDivElement>(null);
  const tone = useTone(root);
  const before = useMemo(() => model(false), []);
  const after = useMemo(() => model(true), []);
  const m = step.todayDone ? after : before;
  const finger = step.finger;
  const selected = finger ? Math.min(finger[0] * 7 + finger[1], TODAY_INDEX) : null;
  const [lastSelected, setLastSelected] = useState(TODAY_INDEX);
  useEffect(() => {
    if (selected !== null) setLastSelected(selected);
  }, [selected]);
  const shown = selected ?? lastSelected;
  const cellX = (i: number) => GRID_X + Math.floor(i / 7) * STRIDE;
  const cellY = (i: number) => GRID_Y + (i % 7) * STRIDE;
  const calloutW = 128;
  const calloutLeft = Math.min(Math.max(cellX(shown) + CELL / 2 - calloutW / 2, LEFT), LEFT + WIDTH - calloutW);
  const lift = CELL * 0.16 + 2;
  const caption: CSSProperties = { fontSize: u(12.5), fontWeight: 600, letterSpacing: u(0.8), color: ground.muted, whiteSpace: "nowrap" };

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{[
        `@keyframes hm-in{from{transform:scale(0)}to{transform:scale(1)}}`,
        `@keyframes hm-pop{0%{transform:scale(1)}40%{transform:scale(1.32)}100%{transform:scale(1)}}`,
        `@keyframes hm-roll-in{from{transform:translateY(55%);opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}`,
        `@keyframes hm-roll-out{from{transform:none;opacity:1}to{transform:translateY(-55%);opacity:0;filter:blur(2px)}}`,
        `@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`,
      ].join("")}</style>

      {/* Summary: the streak on the left, longest and active days on the right. */}
      <div style={{ position: "absolute", left: u(LEFT), width: u(WIDTH), top: u(TOP), height: u(SUMMARY_H), display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: u(2) }}>
          <span style={{ display: "flex", alignItems: "center", gap: u(6), fontSize: u(14), fontWeight: 600, letterSpacing: u(1.7), color: ground.muted }}>
            <Flame />
            CURRENT STREAK
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: u(5), lineHeight: 1 }}>
            {/* Keyed by loop: the reset to 11 at the start of a loop is not a change to roll. */}
            <Roll key={loop} value={m.streak} style={{ fontSize: u(58), fontWeight: font.numeralWeight, letterSpacing: u(-1.2) }} />
            <span style={{ fontSize: u(21), fontWeight: 600, color: ground.muted }}>days</span>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: u(18), rowGap: u(6), alignItems: "baseline", paddingBottom: u(4) }}>
          <Figure key={`l${loop}`} label="LONGEST" value={m.longest}>{" days"}</Figure>
          <Figure key={`a${loop}`} label="ACTIVE" value={m.active}>{" days"}</Figure>
        </div>
      </div>

      {/* Month labels above the first week of each month; the last one keeps inside the grid. */}
      {MONTHS.map((label) => (
        <span key={label.column} style={{ ...caption, position: "absolute", top: u(GRID_Y - HEADER + 1), left: u(Math.min(cellX(label.column * 7), LEFT + WIDTH - 30)) }}>
          {label.text}
        </span>
      ))}
      {/* Weekday labels on every other row. */}
      {(["MON", "WED", "FRI"] as const).map((text, k) => (
        <span key={text} style={{ ...caption, position: "absolute", left: u(LEFT), top: u(cellY(1 + k * 2) + CELL / 2), transform: "translateY(-50%)" }}>{text}</span>
      ))}

      {/* The cells. A new key each loop replays the wave. */}
      <div key={loop}>
        {m.levels.map((level, i) => {
          const column = Math.floor(i / 7);
          const delay = (column / (WEEKS - 1)) * 0.45 + (i % 7) * 0.022;
          const today = i === TODAY_INDEX;
          return (
            <span
              key={i}
              data-motion
              style={{
                position: "absolute", left: u(cellX(i)), top: u(cellY(i)), width: u(CELL), height: u(CELL), borderRadius: u(RADIUS),
                background: shade(level, tone), transition: "background-color .25s",
                animation: reduced ? undefined : today && step.todayDone ? `hm-pop .45s ${ease} both` : `hm-in .34s ${spring} ${delay.toFixed(3)}s both`,
                boxShadow: today ? `0 0 0 ${u(2)} ${ground.bg}, 0 0 0 ${u(3.6)} ${ground.text}` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* The legend under the grid's trailing edge. */}
      <span style={{ ...caption, position: "absolute", right: u(560 - LEFT - WIDTH), top: u(GRID_Y + 7 * STRIDE - GAP + 12), display: "flex", alignItems: "center", gap: u(7) }}>
        LESS
        <span style={{ display: "flex", gap: u(3.5) }}>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} style={{ width: u(12), height: u(12), borderRadius: u(3), background: shade(level, tone) }} />
          ))}
        </span>
        MORE
      </span>

      {/* The finger, then the lifted day above it, and the callout with its nub. */}
      <span
        aria-hidden
        data-motion
        style={{
          position: "absolute", left: u(cellX(shown) + CELL / 2 - 19), top: u(cellY(shown) + CELL / 2 - 17), width: u(38), height: u(38), borderRadius: "50%",
          boxSizing: "border-box", border: `${u(1.5)} solid ${ground.muted}`, background: "color-mix(in srgb, currentColor 7%, transparent)",
          opacity: finger ? 0.7 : 0, transition: `left .16s ${ease}, top .16s ${ease}, opacity .2s ${ease}`,
        }}
      />
      <span
        aria-hidden
        data-motion
        style={{
          position: "absolute", left: u(cellX(shown) - 2), top: u(cellY(shown) - 2), width: u(CELL + 4), height: u(CELL + 4), boxSizing: "border-box",
          borderRadius: u(RADIUS + 2), border: `${u(2)} solid ${ground.bg}`, background: shade(m.levels[shown], tone),
          boxShadow: `0 ${u(3)} ${u(8)} rgba(0,0,0,.26)`,
          opacity: selected !== null ? 1 : 0, transform: `scale(${selected !== null ? 1.32 : 1})`,
          transition: `left .16s ${ease}, top .16s ${ease}, transform .32s ${spring}, opacity .18s, background-color .25s`,
        }}
      />
      <div
        data-motion
        style={{
          position: "absolute", left: u(calloutLeft), top: u(cellY(shown) - lift - 9 - 50), width: u(calloutW), height: u(50), boxSizing: "border-box",
          padding: `${u(7)} ${u(11)}`, borderRadius: u(12), background: ground.text, color: ground.bg, boxShadow: `0 ${u(4)} ${u(12)} rgba(0,0,0,.18)`,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: u(2),
          opacity: selected !== null ? 1 : 0, transition: `left .16s ${ease}, top .16s ${ease}, opacity .18s`,
        }}
      >
        <span style={{ fontSize: u(11.5), fontWeight: 600, letterSpacing: u(0.7), opacity: 0.7, whiteSpace: "nowrap" }}>{dateLabel(shown)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: u(7), fontSize: u(17), fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ width: u(11), height: u(11), borderRadius: u(3), background: shade(m.levels[shown], tone), flex: "none" }} />
          {m.values[shown] > 0 ? `${m.values[shown]} min` : "No activity"}
        </span>
      </div>
      <svg
        aria-hidden
        data-motion
        viewBox="0 0 12 6"
        style={{
          position: "absolute", left: u(Math.min(Math.max(cellX(shown) + CELL / 2, LEFT + 14), LEFT + WIDTH - 14) - 6), top: u(cellY(shown) - lift - 9.5),
          width: u(12), height: u(6), opacity: selected !== null ? 1 : 0, transition: `left .16s ${ease}, top .16s ${ease}, opacity .18s`,
        }}
      >
        <path d="M0 0h12L6 6z" fill={ground.text} />
      </svg>
    </div>
  );
}
