"use client";
import { useState } from "react";
import { agendaEvents } from "../../../definitions/app-pieces/agenda-day.js";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, cr, fw, ts, ACCENT, accentize } from "../env.js";
import { useChoice, useTap } from "../runtime.js";
import { WideRoot } from "./data-kit.js";
import { EASE_OUT, pressBind, stagger } from "./entrance.js";

/** The rail, the card surface (and its shaded twin) and the ink, per scheme, as AgendaDay paints them. */
const PAINT = {
  dark: { rail: "#070708", surface: "#141416", shaded: "#101012", ink: "#FFFFFF", line: "rgba(255,255,255,.06)" },
  light: { rail: "#F3F2EE", surface: "#FFFFFF", shaded: "#FAFAF8", ink: "#141414", line: "rgba(20,20,20,.06)" },
  classic: { rail: "#000000", surface: "#FBFBFB", shaded: "#F4F4F4", ink: "#000000", line: "rgba(0,0,0,.06)" },
};

export const AgendaDay: Renderer = (r) => {
  const events = agendaEvents(s(r.p, "events"));
  const date = n(r.p, "date");
  const [picked, pick] = useChoice("agenda-day", String(date), r.p.selected === true);
  const tap = useTap(r.p.link, "selection");
  const [down, setDown] = useState(false);
  const h = n(r.p, "height") || 120;
  const side = s(r.p, "sideLabel").trim();
  const classic = s(r.p, "surface") === "light";
  // One ground: the rail and the events are both clear, so the screen's own background (and the
  // Style's backdrop) runs unbroken under the whole week; days are split by a hairline, not a shade.
  const ground = s(r.p, "surface") === "ground";
  const c = classic ? PAINT.classic : PAINT[r.scheme];
  const empty = s(r.p, "empty").trim();
  return (
    <WideRoot
      r={r}
      {...pressBind(setDown)}
      onClick={(e) => {
        pick();
        tap(e);
      }}
      style={{ display: "flex", height: h, cursor: "pointer", userSelect: "none", overflow: "visible" }}
    >
      <div style={{ position: "relative", width: 76, flex: "none", background: ground ? "transparent" : c.rail, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute", width: 48, height: 72, borderRadius: cr(12), background: classic ? "#fff" : ACCENT,
            transform: picked ? "scale(1)" : "scale(.95)", opacity: picked ? 1 : 0, transition: `transform .3s ${EASE_OUT}, opacity .2s ${EASE_OUT}`,
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", color: picked ? (classic ? "#000" : "#fff") : classic ? "#fff" : c.ink, transition: "color .2s" }}>
          <span style={{ fontSize: ts(15), lineHeight: "20px", letterSpacing: 0.3 }}>{s(r.p, "weekday")}</span>
          <span style={{ fontSize: ts(22), lineHeight: "28px", fontWeight: fw(700), fontVariantNumeric: "tabular-nums" }}>{date}</span>
        </div>
        {side ? (
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)", transformOrigin: "center", whiteSpace: "nowrap", fontSize: ts(12), fontWeight: fw(700), letterSpacing: 4, color: accentize(tintHex(s(r.p, "sideTint"), "signal")) }}>{side}</span>
        ) : null}
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: "0 12px",
          background: ground ? (down ? "color-mix(in srgb, currentColor 6%, transparent)" : "transparent") : r.p.shaded === true ? c.shaded : c.surface,
          color: c.ink, boxShadow: `inset 0 -1px 0 ${ground ? (r.scheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(20,20,20,.08)") : c.line}`,
          filter: !ground && down ? (r.scheme === "dark" && !classic ? "brightness(1.35)" : "brightness(.97)") : "none", transition: `filter ${down ? ".1s" : ".2s"} ${EASE_OUT}, background ${down ? ".1s" : ".2s"} ${EASE_OUT}`,
        }}
      >
        {events.length === 0 && empty ? <span style={{ fontSize: ts(15), lineHeight: "20px", opacity: 0.45 }}>{empty}</span> : null}
        {events.map((ev, i) => (
          <div key={i} className="spa-enter" style={{ display: "flex", alignItems: "flex-start", gap: 12, transformOrigin: "left center", animationDelay: stagger(i) }}>
            <span style={{ width: 8, height: ev.time ? 28 : 12, marginTop: ev.time ? 2 : 5, borderRadius: cr(4), background: accentize(tintHex(ev.color, "blue")), flex: "none" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</span>
              {ev.time ? <span style={{ fontSize: ts(13), lineHeight: "18px", whiteSpace: "nowrap", opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{ev.time}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </WideRoot>
  );
};
