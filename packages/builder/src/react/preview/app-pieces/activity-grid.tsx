"use client";
// Activity Grid: a calendar or heatmap of days, shaded by level; tap a day to change it with a
// tick (the shade eases over in 0.15 s). Cells ease in week by week (0.95 + fade, 40 ms apart). Mirrors ActivityGrid in
// the export.
import { useEffect, useState, type CSSProperties } from "react";
import { GRID_TINTS as GRID_TINTS_HEX, WEEKDAY_LETTERS, gridLevels, nextLevel } from "../../../definitions/app-pieces/activity-grid.js";
import { Glyph } from "../../icons.js";
import { n, s, useAxis, type Renderer, cr, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useLive, useRuntime } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";

/** Its table with the house red as the app accent (Style), like every other piece. */
const GRID_TINTS = accentize(GRID_TINTS_HEX);

export const ActivityGrid: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const seed = gridLevels(p);
  const [key, setKey] = useLive(seed.join(","));
  const levels = key.split(",").map(Number);
  const weeks = Math.max(1, Math.round(n(p, "weeks")));
  const tint = GRID_TINTS[s(p, "tint")] ?? GRID_TINTS.signal;
  const today = n(p, "today");
  const heat = s(p, "layout") === "heatmap";
  const fill = (l: number) => (l === 1 ? `color-mix(in srgb, ${tint} 25%, transparent)` : l === 2 ? `color-mix(in srgb, ${tint} 55%, transparent)` : l === 3 ? tint : "rgba(120,120,128,.1)");
  const appeared = useFirstAppearance(r.node.id);
  const [appearedBefore] = useState(appeared);
  const [settled, setSettled] = useState(appearedBefore);
  const still = reducedMotion();
  useEffect(() => {
    const b = window.setTimeout(() => setSettled(true), 700);
    return () => {
      window.clearTimeout(b);
    };
  }, []);
  const tap = (i: number, el: Element) => {
    rt.haptic("selection", el);
    setKey(levels.map((l, j) => (j === i ? nextLevel(l) : l)).join(","));
  };
  const cell = (i: number, style: CSSProperties) => (
    <button
      key={i}
      type="button"
      onClick={(e) => tap(i, e.currentTarget)}
      style={{ ...style, border: 0, padding: 0, cursor: "pointer", background: fill(levels[i] ?? 0), display: "grid", placeItems: "center", color: "var(--ios-label2)", position: "relative",
        opacity: appeared ? 1 : 0, transform: !appeared && !still ? "scale(.95)" : undefined,
        transition: settled ? "background .15s ease-out" : `background .15s ease-out, transform .3s ease-out ${still ? 0 : Math.min(Math.floor(i / 7), 7) * 0.04}s, opacity ${still ? 0.2 : 0.3}s ease-out ${still ? 0 : Math.min(Math.floor(i / 7), 7) * 0.04}s` }}
    >
      {levels[i] < 0 ? <Glyph name="sun.max" size={11} /> : i === today ? <span style={{ width: 5, height: 5, borderRadius: cr(3), background: (levels[i] ?? 0) >= 2 ? "#fff" : "var(--ios-label)" }} /> : null}
    </button>
  );
  return (
    <div {...r.box} style={{ ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }) }}>
      {heat ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, 1fr)`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap: 3 }}>
          {levels.map((_, i) => cell(i, { aspectRatio: "1", borderRadius: cr(2) }))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {WEEKDAY_LETTERS.map((d, i) => (
            <span key={`h${i}`} style={{ fontSize: ts(12), color: "var(--ios-label2)", textAlign: "center", paddingBottom: 4 }}>{d}</span>
          ))}
          {levels.map((_, i) => cell(i, { height: 30 }))}
        </div>
      )}
    </div>
  );
};
