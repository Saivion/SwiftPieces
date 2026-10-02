"use client";
// Mood Calendar: a month of check-in marks or a year of mood pixels; tap a day and it springs up.
import type { CSSProperties } from "react";
import { MONTH_DAYS, MONTH_LETTERS, calendarColors, dayMarks, moodLevel } from "../../../definitions/app-pieces/mood-calendar.js";
import { FEELING_MARKS } from "../../../definitions/app-pieces/artwork.js";
import { ArtworkSvg } from "./artwork.js";
import { font, n, s, type Renderer, cr, ts, accentize } from "../env.js";
import { useLive } from "../runtime.js";
import { EASE_OUT, PRESS_TRANSITION, Root, enter, press, stagger, useHaptic } from "./wellbeing-shared.js";

const SHAPES: CSSProperties[] = [
  { borderRadius: cr("50%") },
  { borderRadius: cr(4) },
  { borderRadius: cr(999) },
  { borderRadius: cr("10px 0 10px 0") },
];

export const MoodCalendar: Renderer = (r) => {
  const year = s(r.p, "layout") === "year";
  const colors = accentize(calendarColors(s(r.p, "palette")));
  const drawn = s(r.p, "palette") !== "moods";
  const seed = n(r.p, "seed") || 1;
  const [selected, setSelected] = useLive<number | null>(null);
  const haptic = useHaptic();
  const pick = (i: number, el: Element) => {
    setSelected(i);
    haptic("selection", el);
  };
  const spring = `transform .3s ${EASE_OUT}`;

  if (year) {
    const dot = n(r.p, "dot") || 13;
    const upTo = n(r.p, "upTo");
    return (
      <Root r={r} style={{ alignSelf: "stretch", display: "flex", userSelect: "none" }}>
        <div style={{ width: 22, display: "flex", flexDirection: "column", alignItems: "flex-end", paddingRight: 4 }}>
          <span style={{ ...font("caption"), visibility: "hidden" }}>0</span>
          {Array.from({ length: 31 }, (_, d) => (
            <span key={d} style={{ ...font("caption"), fontSize: ts(11), lineHeight: `${dot + 4}px`, height: dot + 4, color: "var(--ios-label2)" }}>{d + 1}</span>
          ))}
        </div>
        {MONTH_LETTERS.map((letter, m) => (
          <div key={m} data-spw-anim="rise" style={{ ...enter("rise", stagger(m)).style, flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ ...font("caption"), color: "var(--ios-label2)" }}>{letter}</span>
            {Array.from({ length: 31 }, (_, k) => {
              const d = k + 1;
              const i = m * 31 + d;
              const real = d <= MONTH_DAYS[m];
              const future = upTo > 0 && MONTH_DAYS.slice(0, m).reduce((a, x) => a + x, 0) + d > upTo;
              return (
                <span key={d} style={{ height: dot + 4, display: "grid", placeItems: "center" }}>
                  <span
                    onClick={real && !future ? (e) => pick(i, e.currentTarget) : undefined}
                    style={{ width: dot, height: dot, borderRadius: cr("50%"), background: !real ? "transparent" : future ? "color-mix(in srgb, var(--ios-label) 10%, transparent)" : colors[moodLevel(i, seed) % colors.length], transform: `scale(${selected === i ? 1.6 : 1})`, transition: spring, cursor: real && !future ? "pointer" : undefined, boxShadow: selected === i ? "0 0 0 2px var(--ios-bg, #fff)" : undefined }}
                  />
                </span>
              );
            })}
          </div>
        ))}
      </Root>
    );
  }

  const first = n(r.p, "firstWeekday");
  const days = n(r.p, "days") || 30;
  const today = n(r.p, "today");
  const weeks = Math.ceil((first + days) / 7);
  const pills = s(r.p, "marks") !== "shapes";
  const cell = pills ? 56 : 84;
  const line = r.scheme === "dark" ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)";
  const cols = Array.from({ length: 7 }, (_, i) => i);
  return (
    <Root r={r} style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 14, userSelect: "none", position: "relative" }}>
      {pills ? null : (
        <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
          {cols.map((c) => <span key={c} style={{ flex: 1, borderLeft: c ? `1px solid ${line}` : undefined }} />)}
        </div>
      )}
      <div style={{ display: "flex" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} style={{ ...font("subheadline"), flex: 1, textAlign: "center", color: "var(--ios-label)" }}>{d}</span>)}
      </div>
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} style={{ display: "flex", alignItems: "flex-end" }}>
          {cols.map((wd) => {
            const day = w * 7 + wd - first + 1;
            if (day < 1 || day > days) return <span key={wd} style={{ flex: 1, minHeight: cell }} />;
            const marks = dayMarks(day, seed, colors.length);
            return (
              <button
                key={wd}
                type="button"
                {...press}
                onClick={(e) => pick(day, e.currentTarget)}
                style={{ all: "unset", flex: 1, minHeight: cell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, cursor: "pointer", transform: `scale(${selected === day ? 1.15 : 1})`, transition: `${spring}, ${PRESS_TRANSITION}` }}
              >
                {marks.length ? (
                  <span data-spw-anim="pop" style={{ ...enter("pop", stagger(w)).style, display: "flex", flexDirection: "column", gap: pills ? 3 : 2, alignItems: "center" }}>
                    {marks.map((m, k) =>
                      pills ? (
                        <span key={k} style={{ width: 24, height: 7, borderRadius: cr(4), background: colors[m.color] }} />
                      ) : drawn ? (
                        <span key={k} style={{ width: 22, height: 22, display: "block" }}><ArtworkSvg id={FEELING_MARKS[m.color % FEELING_MARKS.length]} ink={colors[m.color]} /></span>
                      ) : (
                        <span key={k} style={{ width: 22, height: 18, background: colors[m.color], ...SHAPES[m.shape] }} />
                      ),
                    )}
                  </span>
                ) : (
                  <span data-spw-anim="pop" style={{ ...enter("pop", stagger(w)).style, width: pills ? 7 : 22, height: pills ? 7 : 22, borderRadius: cr("50%"), background: r.scheme === "dark" ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} />
                )}
                <span style={{ ...font("body", day === today ? 700 : 400), color: "var(--ios-label)" }}>{day}</span>
              </button>
            );
          })}
        </div>
      ))}
    </Root>
  );
};
