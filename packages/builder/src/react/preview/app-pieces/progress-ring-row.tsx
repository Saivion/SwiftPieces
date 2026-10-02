"use client";
// Progress Ring Row: the ring fills as the action pill adds steps (a tick each), a timer counts up
// once a second, and reaching the goal turns the symbol to a tick with a success tap. Mirrors
// ProgressRingRow in the export.
import { useEffect, useRef, useState } from "react";
import { RING_SWATCHES, actionLabel } from "../../../definitions/app-pieces/progress-ring-row.js";
import { Glyph } from "../../icons.js";
import { n, paint, s, useAxis, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { SPRING, useLive, useRuntime, useTap } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export const ProgressRingRow: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const open = useTap(p.link);
  const goal = Math.max(0.001, n(p, "goal"));
  const step = n(p, "step") || 1;
  const [value, setValue] = useLive(n(p, "value"));
  const [running, setRunning] = useState(false);
  // The ring sweeps up to today's value on appear, like the Swift trim spring.
  const swept = useFirstAppearance(r.node.id);
  const [down, setDown] = useState<"row" | "pill" | null>(null);
  const still = reducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const done = value >= goal;
  const tint = accentize(RING_SWATCHES[s(p, "swatch")]) ?? paint(s(p, "tint") || "blue", r.scheme);
  // Text and symbols deepen in light appearance so pale swatches stay readable (Swift: mix with black 35%).
  const ink = r.scheme === "light" ? `color-mix(in srgb, ${tint} 65%, black)` : tint;
  const opens = !!p.link;
  const kind = s(p, "action");
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current) rt.haptic("success", ref.current);
    was.current = done;
  }, [done, rt]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setValue((v) => {
        const next = Math.min(goal, v + step);
        if (next >= goal) setRunning(false);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, goal, step, rt, setValue]);
  const act = (el: Element) => {
    if (kind === "timer") {
      rt.haptic("light", el);
      setRunning((x) => !x);
    } else if (kind === "check") setValue(done ? 0 : goal);
    else {
      if (!done) rt.haptic("increase", el);
      setValue(done ? 0 : Math.min(goal, value + step));
    }
  };
  const label = actionLabel(kind, s(p, "actionTitle").trim(), step, running, done);
  const C = 2 * Math.PI * 20;
  return (
    <div
      {...r.box}
      ref={ref}
      onClick={(e) => opens && open(e)}
      onPointerDown={() => opens && setDown((d) => d ?? "row")}
      onPointerUp={() => setDown(null)}
      onPointerLeave={() => setDown(null)}
      style={{ ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), display: "flex", alignItems: "center", gap: 12, padding: "2px 0", borderRadius: cr(12), cursor: opens ? "pointer" : undefined, color: "var(--ios-label)", background: down === "row" ? "color-mix(in srgb, var(--ios-label) 6%, transparent)" : "transparent", transition: "background-color .12s ease-out" }}
    >
      <span style={{ position: "relative", width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", color: ink }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="22" cy="22" r="20" fill="none" stroke={tint} strokeOpacity={0.15} strokeWidth="3.5" />
          <circle cx="22" cy="22" r="20" fill="none" stroke={tint} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (swept || still ? Math.min(1, value / goal) : 0))} style={{ transition: `stroke-dashoffset .3s ${swept ? SPRING : "ease-out"}` }} />
        </svg>
        <span key={String(done)} style={{ display: "grid", animation: swept ? "spb-prr-pop .2s ease-out" : undefined }}><Glyph name={done ? "checkmark" : s(p, "symbol")} size={18} strokeWidth={2.3} /></span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: ts(17), fontWeight: fw(500) }}>{s(p, "title")}</span>
        <span style={{ fontSize: ts(15), color: "var(--ios-label2)", fontVariantNumeric: "tabular-nums" }}>{fmt(value)}/{fmt(goal)} {s(p, "unit")}</span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          act(e.currentTarget);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDown("pill");
        }}
        onPointerUp={() => setDown(null)}
        onPointerLeave={() => setDown(null)}
        style={{ border: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", margin: "6px 0", borderRadius: cr(999), background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: ink, fontSize: ts(15), fontWeight: fw(500), fontFamily: "inherit", transform: down === "pill" ? "scale(.97)" : undefined, transition: "transform .12s ease-out" }}
      >
        <Glyph name={label.icon} size={15} strokeWidth={2.2} />
        {label.text}
      </button>
      <style>{"@keyframes spb-prr-pop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}"}</style>
    </div>
  );
};
