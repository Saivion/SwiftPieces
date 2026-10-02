"use client";
// Activity Heatmap in the Playground: the same days, shades and streaks as the generated app (the sample
// generator is shared with the definition). Drag sideways across the grid, or press and move, to read any
// day: it lifts under a callout with a selection tick per day, and release keeps it (the generated screen
// binds `selection`). A click selects a day and a second click clears it. When the weeks outgrow the width
// the grid scrolls sideways, opens on today, and a short hold starts the reading instead.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { HEATMAP_THRESHOLDS, heatmapSample } from "../../../definitions/utility/activity-heatmap.js";
import { ACCENT, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { useLive, useRuntime } from "../runtime.js";

const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const GAP = 3;
const MIN_CELL = 13;
const MAX_CELL = 24;
const LABEL_W = 30;
const HEADER = 22;
const SLOP = 6;
/** Light and dark shades, as Swift mixes them: the accent into the ground, never transparency. */
const MIX = { light: [20, 40, 60], dark: [45, 62, 80] } as const;
const KEYFRAMES = [
  "@keyframes spah-in{from{transform:scale(0)}to{transform:scale(1)}}",
  "@keyframes spah-pop{0%{transform:scale(1)}40%{transform:scale(1.32)}100%{transform:scale(1)}}",
  ".spah-scroll::-webkit-scrollbar{display:none}",
  "@media (prefers-reduced-motion: reduce){[data-spah-motion]{animation:none!important;transition:none!important}}",
].join("");

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

type Model = {
  days: Date[];
  values: number[];
  levels: number[];
  last: number;
  today: number;
  steps: number[];
  streak: number;
  longest: number;
  active: number;
  months: Array<{ column: number; text: string }>;
  weekdays: Array<{ row: number; text: string }>;
};

/** The person's first weekday (0 Sunday ... 6 Saturday), when the browser knows it. */
function personFirstWeekday(): number {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } };
    const day = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
    return day ? day % 7 : 0;
  } catch {
    return 0;
  }
}

/** Days, values, levels and streaks the way ActivityHeatmap.swift derives them, for the shared sample data. */
function buildModel(weeks: number, firstWeekday: number, todayDone: boolean, sessions: boolean, empty: boolean, levelsRule: string): Model {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (todayDate.getDay() - firstWeekday + 7) % 7;
  const total = weeks * 7;
  const first = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - back - (weeks - 1) * 7);
  const days = Array.from({ length: total }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const today = (weeks - 1) * 7 + back;
  const sampleDays = Math.max(weeks, 20) * 7;
  const values = days.map((_, i) => {
    if (empty || i > today) return 0;
    const ago = today - i;
    return ago < sampleDays ? heatmapSample(ago, todayDone, sessions) : 0;
  });

  // Levels: quartiles of the non-zero days (the busiest takes the top shade), or thresholds spread over the shades.
  const thresholds = HEATMAP_THRESHOLDS[levelsRule] ?? null;
  const spread = (reached: number, count: number) => Math.min(Math.max(Math.ceil((reached * 4) / count), 1), 4);
  const sorted = values.slice(0, today + 1).filter((v) => v > 0).sort((a, c) => a - c);
  const q = (p: number) => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (h - lo);
  };
  const cuts = sorted.length ? [q(0.25), q(0.5), q(0.75)] : [];
  const top = sorted[sorted.length - 1] ?? 0;
  const levelOf = (v: number) => {
    if (v <= 0) return 0;
    if (thresholds) {
      const reached = thresholds.filter((t) => v >= t).length;
      return reached ? spread(reached, thresholds.length) : 0;
    }
    if (!cuts.length || v >= top) return 4;
    return v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
  };
  const levels = values.map((v, i) => (i > today ? -1 : levelOf(v)));
  const steps = thresholds ? [0, ...new Set(thresholds.map((_, k) => spread(k + 1, thresholds.length)))] : [0, 1, 2, 3, 4];

  const isActive = (v: number) => v > 0 && v >= (thresholds?.[0] ?? 0);
  let active = 0;
  let run = 0;
  let longest = 0;
  for (let i = 0; i <= today; i++) {
    if (isActive(values[i])) {
      active++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  // The current streak stays alive until midnight while today has nothing yet.
  let streak = 0;
  for (let i = today - (isActive(values[today]) ? 0 : 1); i >= 0 && isActive(values[i]); i--) streak++;

  const month = (d: Date) => d.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const months: Array<{ column: number; text: string }> = [];
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7 && c * 7 + r <= today; r++) {
      if (days[c * 7 + r].getDate() === 1) {
        months.push({ column: c, text: month(days[c * 7 + r]) });
        break;
      }
    }
  }
  if ((months[0]?.column ?? 0) > 2) months.unshift({ column: 0, text: month(days[0]) });
  // Monday, Wednesday and Friday, on whichever rows they fall.
  const weekdays = [0, 1, 2, 3, 4, 5, 6]
    .filter((r) => [1, 3, 5].includes(days[r].getDay()))
    .map((r) => ({ row: r, text: days[r].toLocaleString(undefined, { weekday: "short" }).toUpperCase() }));

  return { days, values, levels, last: today, today, steps, streak, longest: Math.max(longest, streak), active, months, weekdays };
}

type Gesture = { mode: "undecided" | "scrub" | "scroll" | "pass"; x0: number; y0: number; left0: number; timer?: ReturnType<typeof setTimeout> };

function Flame({ alive, size }: { alive: boolean; size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none" }}>
      <path
        fill={alive ? ACCENT : "none"}
        stroke={alive ? "none" : houseVar("muted")}
        strokeWidth={1.8}
        d="M12.4 2.2c.4 3-1.2 4.6-2.9 6.4C7.6 10.6 6 12.6 6 15.4 6 19 8.7 22 12.2 22c3.6 0 6.2-2.8 6.2-6.6 0-2.5-1.1-4.4-2.4-5.9-.2 1.3-.8 2.4-1.9 3 .4-3.9-.4-7.6-1.7-10.3z"
      />
    </svg>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const weeks = Math.min(Math.max(Math.round(n(p, "weeks") || 20), 4), 53);
  const sessions = s(p, "unit") === "sessions";
  const activity = s(p, "activity");
  const weekStart = s(p, "weekStart");
  const firstWeekday = weekStart === "monday" ? 1 : weekStart === "sunday" ? 0 : personFirstWeekday();
  const m = useMemo(
    () => buildModel(weeks, firstWeekday, activity !== "open", sessions, activity === "empty", s(p, "levels")),
    [weeks, firstWeekday, activity, sessions, p.levels],
  );
  const [selected, setSelected] = useLive<number | null>(b(p, "selectsToday") ? m.today : null);
  const [width, setWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => clearTimeout(gesture.current?.timer), []);

  // Cell size for the width, as the Swift metrics: grow up to the largest size, scroll below the smallest.
  const avail = Math.max(width - LABEL_W, 0);
  const fit = (avail - (weeks - 1) * GAP) / weeks;
  const scrolls = width > 0 && fit < MIN_CELL;
  const visible = scrolls ? Math.max(Math.floor((avail + GAP) / (MIN_CELL + GAP)), 1) : weeks;
  const cell = width <= 0 ? MIN_CELL : scrolls ? (avail + GAP) / visible - GAP : Math.min(fit, MAX_CELL);
  const stride = cell + GAP;
  const gridW = weeks * stride - GAP;
  const height = HEADER + 7 * stride - GAP;
  const radius = Math.min(4, cell / 2);
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    sc.scrollLeft = scrolls ? sc.scrollWidth : 0;
    setScrollLeft(sc.scrollLeft);
  }, [scrolls, weeks, width]);

  const mix = MIX[r.scheme];
  const fill = (level: number) => (level <= 0 ? houseVar("field") : level >= 4 ? ACCENT : `color-mix(in srgb, ${ACCENT} ${mix[level - 1]}%, ${houseVar("ground")})`);
  const x = (i: number) => Math.floor(i / 7) * stride;
  const y = (i: number) => HEADER + (i % 7) * stride;

  /** The day under a client point, clamped into the grid and to the last day. */
  const indexAt = (cx: number, cy: number) => {
    const sc = scroller.current;
    if (!sc) return null;
    const rect = sc.getBoundingClientRect();
    const k = rect.width / (sc.clientWidth || 1);
    const px = (cx - rect.left) / k + sc.scrollLeft;
    const py = (cy - rect.top) / k;
    const column = Math.min(Math.max(Math.floor((px + GAP / 2) / stride), 0), weeks - 1);
    const row = Math.min(Math.max(Math.floor((py - HEADER + GAP / 2) / stride), 0), 6);
    return Math.min(column * 7 + row, m.last);
  };

  const scrubTo = (i: number | null, el: Element | null) => {
    if (i === null || i < 0 || i === selected) return;
    setSelected(i);
    rt.haptic("selection", el);
  };

  const begin = (g: Gesture, el: Element | null) => {
    clearTimeout(g.timer);
    g.mode = "scrub";
    if (scrolls) rt.haptic("soft", el);
    scrubTo(indexAt(g.x0, g.y0), el);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gesture.current || m.last < 0) return;
    const el = e.currentTarget;
    const g: Gesture = { mode: "undecided", x0: e.clientX, y0: e.clientY, left0: scroller.current?.scrollLeft ?? 0 };
    gesture.current = g;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    // A short press reads the day under the finger: about an eighth of a second, or a quarter when the grid scrolls.
    g.timer = setTimeout(() => {
      if (gesture.current === g && g.mode === "undecided") begin(g, el);
    }, scrolls ? 250 : 120);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const k = rt.scale() || 1;
    const dx = (e.clientX - g.x0) / k;
    const dy = (e.clientY - g.y0) / k;
    if (g.mode === "undecided") {
      if (Math.hypot(dx, dy) < SLOP) return;
      clearTimeout(g.timer);
      // Sideways scrubs at once when the grid fits; sideways scrolls when it doesn't; vertical is the screen's.
      g.mode = Math.abs(dx) > Math.abs(dy) ? (scrolls ? "scroll" : "scrub") : "pass";
    }
    if (g.mode === "scrub") scrubTo(indexAt(e.clientX, e.clientY), e.currentTarget);
    if (g.mode === "scroll" && scroller.current) scroller.current.scrollLeft = g.left0 - dx;
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    clearTimeout(g.timer);
    // A release before any decision is a tap: select the day, or clear it when it was already selected.
    if (!cancelled && g.mode === "undecided") {
      const i = indexAt(e.clientX, e.clientY);
      if (i === null) return;
      setSelected(i === selected ? null : i);
      rt.haptic("selection", e.currentTarget);
    }
  };

  const showsSummary = b(p, "showsSummary");
  const hasActivity = m.active > 0 || m.streak > 0;
  const animate = !still && !reduced;
  const dayLabel = (i: number) =>
    i === m.today ? "TODAY" : m.days[i].toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  const valueLabel = (v: number) => (v <= 0 ? "No activity" : sessions ? `${v} ${v === 1 ? "session" : "sessions"}` : `${v} min`);
  const dayCount = (d: number) => `${d} ${d === 1 ? "day" : "days"}`;
  const meta: CSSProperties = { fontSize: ts(12), fontWeight: fw(600), letterSpacing: "0.1em", color: houseVar("muted"), textTransform: "uppercase", whiteSpace: "nowrap" };
  const caption: CSSProperties = { fontSize: ts(11), fontWeight: fw(600), letterSpacing: "0.06em", color: houseVar("muted"), whiteSpace: "nowrap" };
  const title = s(p, "title").trim() || "Activity";

  // The lifted day and its callout sit above the scroller, so the callout is never clipped; they follow the
  // scroll offset and hide while their day is scrolled out of view.
  const viewport = scrolls ? visible * stride - GAP : gridW;
  const offset = scrolls ? scrollLeft : 0;
  const sel = selected !== null && selected <= m.last && x(selected) + cell > offset && x(selected) < offset + viewport ? selected : null;
  const sx = sel === null ? 0 : LABEL_W + x(sel) - offset;
  const calloutW = 128;
  const lift = cell * 0.16 + 2;
  const calloutLeft = Math.min(Math.max(sx + cell / 2 - calloutW / 2, 0), Math.max(LABEL_W + viewport - calloutW, 0));

  return (
    <div
      {...r.box}
      ref={box}
      aria-label={`${title}, last ${weeks} weeks. ${hasActivity ? `Current streak ${dayCount(m.streak)}. Longest ${dayCount(m.longest)}.` : "No activity yet."}`}
      style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", flexDirection: "column", gap: 18, color: houseVar("text"), minWidth: 0 }}
    >
      <style>{KEYFRAMES}</style>
      {showsSummary ? (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ ...meta, display: "flex", alignItems: "center", gap: 5 }}>
              <Flame alive={m.streak > 0} size={13} />
              Current streak
            </span>
            {hasActivity ? (
              <span style={{ display: "flex", alignItems: "baseline", gap: 5, lineHeight: 1 }}>
                <span key={m.streak} data-spah-motion style={{ fontSize: ts(44), fontWeight: fw(300), letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", animation: animate ? `spah-in .4s ${SPRING} both` : undefined, display: "inline-block" }}>
                  {m.streak}
                </span>
                <span style={{ fontSize: ts(17), fontWeight: fw(600), color: houseVar("muted") }}>{m.streak === 1 ? "day" : "days"}</span>
              </span>
            ) : (
              <span style={{ fontSize: ts(20), fontWeight: fw(600), color: houseVar("muted"), paddingTop: 6 }}>No activity yet</span>
            )}
          </div>
          {hasActivity ? (
            <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 14, rowGap: 5, alignItems: "baseline", paddingBottom: 3 }}>
              <span style={meta}>Longest</span>
              <span style={{ justifySelf: "end", fontSize: ts(17), fontWeight: fw(500), fontVariantNumeric: "tabular-nums" }}>{dayCount(m.longest)}</span>
              <span style={meta}>Active</span>
              <span style={{ justifySelf: "end", fontSize: ts(17), fontWeight: fw(500), fontVariantNumeric: "tabular-nums" }}>{dayCount(m.active)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* The grid hugs its weeks (wide cells stop at their largest size), so the legend ends where the grid does. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, alignSelf: "flex-start", maxWidth: "100%" }}>
        <div style={{ display: "flex", width: width > 0 ? LABEL_W + viewport : "100%", maxWidth: "100%", position: "relative" }}>
          <div aria-hidden style={{ position: "relative", width: LABEL_W, flex: "none", height }}>
            {m.weekdays.map((d) => (
              <span key={d.row} style={{ ...caption, position: "absolute", left: 0, top: y(d.row) + cell / 2, transform: "translateY(-50%)" }}>{d.text}</span>
            ))}
          </div>
          <div
            ref={scroller}
            className="spah-scroll"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, false)}
            onPointerCancel={(e) => finish(e, true)}
            onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
            role="img"
            aria-label={sel !== null ? `${dayLabel(sel)}, ${valueLabel(m.values[sel])}` : `${title} heatmap`}
            style={{ position: "relative", flex: scrolls ? "none" : "1 1 0", width: scrolls ? visible * stride - GAP : undefined, minWidth: 0, height: height + 4, overflowX: scrolls ? "auto" : "visible", overflowY: "visible", scrollbarWidth: "none", touchAction: "pan-y", cursor: "default" }}
          >
            <div key={`${weeks}-${activity}`} style={{ position: "relative", width: gridW, height }}>
              {m.months.map((label) => (
                <span key={label.column} style={{ ...caption, position: "absolute", top: 2, left: Math.min(x(label.column * 7), Math.max(gridW - 28, 0)) }}>{label.text}</span>
              ))}
              {m.levels.map((level, i) => {
                if (level < 0) return null;
                const today = i === m.today;
                const delay = (Math.floor(i / 7) / Math.max(weeks - 1, 1)) * 0.45 + (i % 7) * 0.022;
                return (
                  <span
                    key={today ? `t${m.values[i]}` : i}
                    data-spah-motion
                    style={{
                      position: "absolute", left: x(i), top: y(i), width: cell, height: cell, borderRadius: cr(radius), background: fill(level),
                      boxShadow: today ? `0 0 0 2px ${houseVar("ground")}, 0 0 0 3.5px ${houseVar("text")}` : undefined,
                      animation: !animate ? undefined : today && m.values[i] > 0 ? `spah-pop .45s ${EASE} both` : `spah-in .34s ${SPRING} ${delay.toFixed(3)}s both`,
                    }}
                  />
                );
              })}
            </div>
          </div>
          {sel !== null ? (
            <>
              <span
                aria-hidden
                data-spah-motion
                style={{
                  position: "absolute", left: sx - 2, top: y(sel) - 2, width: cell + 4, height: cell + 4, boxSizing: "border-box",
                  borderRadius: cr(radius + 2), border: `2px solid ${houseVar("ground")}`, background: fill(m.levels[sel]),
                  boxShadow: "0 3px 7px rgba(0,0,0,.24)", transform: "scale(1.32)", zIndex: 2,
                  transition: `left .16s ${EASE}, top .16s ${EASE}, background-color .2s`,
                }}
              />
              <div
                data-spah-motion
                style={{
                  position: "absolute", left: calloutLeft, top: y(sel) - lift - 9 - 46, width: calloutW, height: 46, boxSizing: "border-box", zIndex: 3,
                  padding: "6px 10px", borderRadius: cr(12), background: houseVar("text"), color: houseVar("ground"),
                  boxShadow: "0 4px 12px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, pointerEvents: "none",
                  transition: `left .16s ${EASE}, top .16s ${EASE}`,
                }}
              >
                <span style={{ fontSize: ts(11), fontWeight: fw(600), letterSpacing: "0.06em", opacity: 0.7, whiteSpace: "nowrap" }}>{dayLabel(sel)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ts(15), fontWeight: fw(600), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ width: 10, height: 10, borderRadius: cr(3), background: fill(m.levels[sel]), flex: "none" }} />
                  {valueLabel(m.values[sel])}
                </span>
              </div>
              <svg aria-hidden viewBox="0 0 12 6" style={{ position: "absolute", left: Math.min(Math.max(sx + cell / 2, 14), LABEL_W + viewport - 14) - 6, top: y(sel) - lift - 9.5, width: 12, height: 6, zIndex: 3, transition: `left .16s ${EASE}, top .16s ${EASE}` }}>
                <path d="M0 0h12L6 6z" fill={houseVar("text")} />
              </svg>
            </>
          ) : null}
        </div>
        <span aria-hidden style={{ ...caption, display: "flex", alignItems: "center", gap: 6 }}>
          LESS
          <span style={{ display: "flex", gap: 3 }}>
            {m.steps.map((level) => (
              <span key={level} style={{ width: 10, height: 10, borderRadius: cr(2.5), background: fill(level) }} />
            ))}
          </span>
          MORE
        </span>
      </div>
    </div>
  );
};
