"use client";
import { useState } from "react";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { hourLabel, timelineEvents } from "../../../definitions/app-pieces/hour-timeline.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts, ACCENT, accentize } from "../env.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { EASE_OUT, stagger } from "./entrance.js";

export const HourTimeline: Renderer = (r) => {
  const start = Math.round(n(r.p, "start"));
  const end = Math.max(start + 1, Math.round(n(r.p, "end")));
  const hh = n(r.p, "hourHeight") || 64;
  const events = timelineEvents(s(r.p, "events"));
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const [pencilled, setPencilled] = useState<Set<number>>(new Set());
  const [down, setDown] = useState<number | null>(null);
  const haptic = useHaptic();
  const now = n(r.p, "now");
  const dark = r.scheme === "dark";
  const cell = dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)";
  const pressed = dark ? "rgba(255,255,255,.11)" : "rgba(0,0,0,.10)";
  return (
    <WideRoot r={r} style={{ display: "flex", gap: 12, paddingTop: 8, color: LABEL }}>
      <div style={{ width: 52, flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        {hours.map((h) => <span key={h} style={{ height: hh, fontSize: ts(13), fontWeight: fw(500), lineHeight: "18px", marginTop: -8, color: LABEL2, fontVariantNumeric: "tabular-nums" }}>{hourLabel(h)}</span>)}
      </div>
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {hours.map((h) => (
            <div
              key={h}
              role="button"
              onPointerDown={() => setDown(h)}
              onPointerUp={() => setDown(null)}
              onPointerLeave={() => setDown(null)}
              onClick={(e) => {
                haptic("light", e.currentTarget);
                setPencilled((set) => {
                  const next = new Set(set);
                  if (next.has(h)) next.delete(h);
                  else next.add(h);
                  return next;
                });
              }}
              style={{ height: hh - 4, borderRadius: cr(16), background: down === h ? pressed : cell, transition: `background ${down === h ? ".1s" : ".2s"} ${EASE_OUT}`, cursor: "pointer", display: "flex", alignItems: "flex-start", padding: 16, boxSizing: "border-box" }}
            >
              {pencilled.has(h) ? <span className="spa-enter" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ts(17), lineHeight: "22px", transformOrigin: "left top" }}><Glyph name="plus" size={16} />New event</span> : null}
            </div>
          ))}
        </div>
        {events.map((ev, i) => (
          <div
            key={i}
            className="spa-enter"
            style={{
              animationDelay: stagger(i), transformOrigin: "top center",
              position: "absolute", left: 0, right: 0, top: (ev.from - start) * hh, height: (ev.to - ev.from) * hh - 4,
              display: "flex", alignItems: "stretch", gap: 12, padding: 16, boxSizing: "border-box",
              borderRadius: cr(16), background: dark ? "#1C1C1F" : "#FFFFFF",
              boxShadow: `var(--spb-card-edge-on, ${dark ? "inset 0 0 0 1px rgba(255,255,255,.08), 0 4px 16px rgba(0,0,0,.35)" : "inset 0 0 0 1px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)"})`, pointerEvents: "none",
            }}
          >
            <span style={{ width: 8, borderRadius: cr(4), background: accentize(tintHex(ev.color, "blue")), flex: "none" }} />
            <span style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600) }}>{ev.title}</span>
          </div>
        ))}
        {now > start && now < end ? (
          <div style={{ position: "absolute", left: -5, right: 0, top: (now - start) * hh - 5, height: 10, display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <span style={{ width: 10, height: 10, borderRadius: cr(5), background: ACCENT, flex: "none" }} />
            <span style={{ flex: 1, height: 2, background: ACCENT }} />
          </div>
        ) : null}
      </div>
    </WideRoot>
  );
};
