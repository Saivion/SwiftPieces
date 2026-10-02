"use client";
// Streak Calendar in the preview: the ring winds up and the capsules ease in (0.95 + fade, rows
// 40 ms apart) on appear, capsules sit behind the day numbers the way the Swift ZStack draws them,
// and tapping a past day fades in its outline with a selection haptic and its summary underneath.
import { useState } from "react";
import { WEEKDAYS, streakMonth, streakRoles, type StreakCell } from "../../../definitions/app-pieces/streak-calendar.js";
import { b, fillStyle, n, s, useAxis, useScheme, type Renderer, cr, fw, ts, ACCENT, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useRuntime } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";


export const StreakCalendar: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const m = streakMonth(p);
  const [selected, setSelected] = useState<number | null>(null);
  const wound = useFirstAppearance(r.node.id);
  const reduce = reducedMotion();
  const ROLES = accentize(streakRoles(useScheme()));
  const record = Math.max(1, n(p, "record"));
  const day = selected ?? m.today;
  const kind = m.weeks.flat().find((c) => c.day === day)?.kind ?? "ahead";
  const title = `${WEEKDAYS[(m.first + day - 1) % 7]}, ${day}`;
  const note = day === m.today ? s(p, "todayNote") : kind === "kept" ? "Goal reached" : kind === "partial" ? "Part of your goal" : "Nothing logged";
  const R = 90;
  const C = 2 * Math.PI * R;
  const share = Math.min(m.streak / record, 1);

  const ease = reduce ? 0.2 : 0.3;
  const pick = (c: StreakCell, el: Element) => {
    if (!c.day || c.day > m.today) return;
    rt.haptic("selection", el);
    setSelected(c.day);
  };

  return (
    <div {...r.box} style={{ ...r.box.style, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, ...fillStyle(true, axis) }}>
      {b(p, "showsRing") ? (
        <div style={{ position: "relative", width: 196, height: 196, flex: "none", opacity: wound ? 1 : 0, transform: wound || reduce ? undefined : "scale(.95)", transition: `opacity ${ease}s ease-out, transform .3s ease-out` }}>
          <svg width="196" height="196" viewBox="0 0 196 196" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="98" cy="98" r={R} fill="none" stroke={ROLES.ring} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={wound || reduce ? C * (1 - share) : C} style={{ transition: "stroke-dashoffset .3s ease-out" }} />
          </svg>
          <div style={{ position: "absolute", left: 17, top: 17, width: 162, height: 162, borderRadius: cr("50%"), background: ROLES.disk, color: "var(--ios-label)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: ts(64), lineHeight: "66px", fontWeight: fw(700), fontVariantNumeric: "tabular-nums" }}>{m.streak}</div>
            <div style={{ fontSize: ts(12), lineHeight: "14px", fontWeight: fw(700), textAlign: "center", letterSpacing: 0.4 }}>
              DAYS IN
              <br />
              A ROW
            </div>
          </div>
        </div>
      ) : null}
      <span style={{ fontSize: ts(22), lineHeight: "28px", fontWeight: fw(700), color: "var(--ios-label)" }}>{s(p, "month")}</span>
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 4 }}>
        {m.weeks.map((row, ri) => (
          <div key={ri} style={{ position: "relative", height: 44 }}>
            {m.runs
              .filter((run) => run.row === ri)
              .map((run) => (
                <span key={run.from} style={{ position: "absolute", top: 0, height: 44, left: `${(run.from / 7) * 100}%`, width: `${((run.to - run.from + 1) / 7) * 100}%`, borderRadius: cr(22), background: run.color, transformOrigin: "left center", transform: wound || reduce ? undefined : "scale(.95)", opacity: wound ? 1 : 0, transition: `transform .3s ease-out ${reduce ? 0 : Math.min(ri, 7) * 0.04}s, opacity ${ease}s ease-out ${reduce ? 0 : Math.min(ri, 7) * 0.04}s` }} />
              ))}
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", height: 44 }}>
              {row.map((c, ci) => (
                <DayCell key={ci} cell={c} today={c.day === m.today} todayFill={ROLES.today} selected={c.day !== 0 && c.day === selected} onTap={(el) => pick(c, el)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, animation: selected == null ? undefined : "spb-sc-in .2s ease-out" }}>
        <div style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700), color: "var(--ios-label)" }}>{title}</div>
        <div style={{ fontSize: ts(15), lineHeight: "20px", fontWeight: fw(700), color: ROLES.ring }}>{note}</div>
      </div>
      <style>{"@keyframes spb-sc-in{from{opacity:0}}"}</style>
    </div>
  );
};

function DayCell({ cell, today, todayFill, selected, onTap }: { cell: StreakCell; today: boolean; todayFill: string; selected: boolean; onTap: (el: Element) => void }) {
  const dot = (color: string) => <span style={{ width: 12, height: 12, borderRadius: cr(6), background: color }} />;
  const content =
    cell.kind === "blank" ? null : cell.kind === "kept" ? (
      <span style={{ fontSize: ts(17), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", color: cell.dark && !today ? "#141414" : "#fff" }}>{cell.day}</span>
    ) : cell.kind === "partial" ? (
      dot(ACCENT)
    ) : cell.kind === "missed" ? (
      dot("rgba(142,142,147,.35)")
    ) : (
      <span style={{ fontSize: ts(15), fontWeight: fw(600), color: "var(--ios-label3)" }}>{cell.day}</span>
    );
  return (
    <button
      type="button"
      onClick={(e) => onTap(e.currentTarget)}
      aria-label={cell.day ? `Day ${cell.day}` : undefined}
      style={{ position: "relative", display: "grid", placeItems: "center", background: "none", border: 0, padding: 0, cursor: cell.day ? "pointer" : "default", minHeight: 44 }}
    >
      {today ? <span style={{ position: "absolute", inset: 0, margin: "auto", width: 44, height: 44, borderRadius: cr(22), background: todayFill }} /> : null}
      <span style={{ position: "absolute", inset: 0, margin: "auto", width: 40, height: 40, borderRadius: cr(20), border: "2px solid var(--ios-label)", opacity: selected ? 1 : 0, transition: "opacity .15s ease-out" }} />
      <span style={{ position: "relative", display: "grid", placeItems: "center" }}>{content}</span>
    </button>
  );
}
