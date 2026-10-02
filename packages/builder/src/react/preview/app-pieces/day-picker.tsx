"use client";
import { dayCells } from "../../../definitions/app-pieces/day-picker.js";
import { items, numbers, tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, cr, ff, fw, ts, accentize } from "../env.js";
import { useLive } from "../runtime.js";
import { reducedMotion } from "../primitives.js";
import { FILL, LABEL, LABEL2, LABEL3, WideRoot, useHaptic } from "./data-kit.js";
import { EASE_OUT } from "./entrance.js";

/** Cell geometry, shared by the cells and the sliding disc: the week strip is letter (16) + 4 + disc
 *  (36) + 4 + dot (4) with 4 above and below; a month row is disc + 4 + dot, 8 between rows. */
const DISC = 36;
const WEEK_DISC_TOP = 4 + 16 + 4;
const MONTH_ROW = DISC + 4 + 4 + 8;

export const DayPicker: Renderer = (r) => {
  const cells = dayCells(r.p);
  const month = s(r.p, "layout") === "month";
  const letters = items(s(r.p, "letters"));
  const L = letters.length === 7 ? letters : ["M", "T", "W", "T", "F", "S", "S"];
  const marked = new Set(numbers(s(r.p, "marked")).map(Math.round));
  const busy = new Set(numbers(s(r.p, "busy")).map(Math.round));
  const today = n(r.p, "today");
  const color = accentize(tintHex(s(r.p, "tint"), "signal"));
  const serif = s(r.p, "numerals") === "serif";
  const [selected, setSelected] = useLive(n(r.p, "selected"));
  const haptic = useHaptic();
  const serifFont = 'ui-serif, "New York", Georgia, serif';
  const selIndex = cells.findIndex((c) => !c.outside && c.day === selected);
  const slide = reducedMotion() ? "opacity .2s linear" : `left .3s ${EASE_OUT}, top .3s ${EASE_OUT}`;

  return (
    <WideRoot r={r} className={`${r.box.className ?? ""} spa-enter`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {month ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {L.map((l, i) => <span key={i} style={{ textAlign: "center", fontSize: ts(11), lineHeight: "13px", fontWeight: fw(600), color: LABEL2 }}>{l}</span>)}
        </div>
      ) : null}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: month ? 8 : 0 }}>
        {selIndex >= 0 ? (
          <div
            aria-hidden
            style={{
              position: "absolute", pointerEvents: "none", width: DISC, height: DISC, borderRadius: cr(DISC / 2), background: color,
              left: `calc(${(selIndex % 7) * (100 / 7)}% + (100% / 7 - ${DISC}px) / 2)`,
              top: month ? Math.floor(selIndex / 7) * MONTH_ROW : WEEK_DISC_TOP,
              transition: slide,
            }}
          />
        ) : null}
        {cells.map((c, i) => {
          const sel = i === selIndex;
          const inMonth = !c.outside;
          const isToday = inMonth && c.day === today;
          const isBusy = inMonth && busy.has(c.day);
          const plans = inMonth && (marked.has(c.day) || (!month && isBusy));
          return (
            <div
              key={i}
              role="button"
              aria-selected={sel}
              onClick={(e) => {
                if (!inMonth) return;
                if (c.day !== selected) haptic("selection", e.currentTarget);
                setSelected(c.day);
              }}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: month ? 0 : "4px 0", cursor: inMonth ? "pointer" : undefined, userSelect: "none", minHeight: 44 }}
            >
              {!month ? <span style={{ fontSize: ts(11), lineHeight: "16px", fontWeight: fw(sel ? 700 : 500), color: sel ? LABEL : LABEL2 }}>{L[i % 7]}</span> : null}
              <span
                style={{
                  position: "relative", width: DISC, height: DISC, borderRadius: cr(DISC / 2), flex: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: ff(serif ? serifFont : undefined), fontWeight: fw(serif ? 300 : sel || isToday ? 700 : 600),
                  fontSize: ts(serif ? (month ? 17 : 22) : month ? 16 : 17), lineHeight: 1, fontVariantNumeric: "tabular-nums",
                  background: month && isBusy && !sel ? FILL : undefined,
                  color: !inMonth ? LABEL3 : sel ? "#fff" : isToday ? color : LABEL,
                  transition: "color .2s",
                }}
              >
                {c.day}
              </span>
              <span style={{ width: 4, height: 4, borderRadius: cr(2), flex: "none", background: plans && !sel ? LABEL2 : "transparent" }} />
            </div>
          );
        })}
      </div>
    </WideRoot>
  );
};
