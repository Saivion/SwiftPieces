"use client";
// Route Row (definitions/app-pieces/route-row.ts): a trip in a list, as a plain row or a card with
// the two ends either side of a track that fills to the plane. A card scales to 0.97 under the
// finger, a list row takes a highlight; it settles in once from 0.95 and follows its link on release.
import { useState } from "react";
import { CircleArrowDown, CircleArrowUp, Clock, Plane } from "lucide-react";
import { AVATAR_INK, ROUTE_STATES as ROUTE_STATES_HEX, avatarFill } from "../../../definitions/app-pieces/route-row.js";
import { fillStyle, s, useAxis, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { useTap } from "../runtime.js";

/** Its table with the house red as the app accent (Style), like every other piece. */
const ROUTE_STATES = accentize(ROUTE_STATES_HEX);

export const RouteRow: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const tap = useTap(p.link, "light");
  const still = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.22, 1, .36, 1)";
  const enter = (name: string, dur = ".28s", delay = "0s") => (still ? (name === "sp-rr-in" ? `sp-rr-fade .2s ease-out both` : undefined) : `${name} ${dur} ${EASE} ${delay} both`);
  const [down, setDown] = useState(false);
  const st = ROUTE_STATES[s(p, "state")] ?? ROUTE_STATES.ontime;
  const stateColor = st.color === "primary" ? "var(--ios-label)" : st.color === "secondary" ? "var(--ios-label2)" : st.color;
  const accent = "var(--spb-accent, var(--ios-accent))";
  const card = s(p, "style") !== "list";
  const radius = p.radius == null ? 20 : Number(p.radius);
  const progress = Number(p.progress ?? -1);
  const f = Math.min(1, Math.max(0, progress / 100));
  const lead = s(p, "leading");
  const cap = s(p, "leadCaption").trim().toUpperCase();
  const capEl = cap ? <span style={{ fontSize: ts(11), fontWeight: fw(500), color: "var(--ios-label2)", letterSpacing: ".02em" }}>{cap}</span> : null;
  const stop = (up: boolean, code: string, time: string) => {
    const Icon = up ? CircleArrowUp : CircleArrowDown;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ts(15), fontWeight: fw(500) }}>
        <Icon size={16} color="#fff" fill={accent} strokeWidth={2.2} style={{ transform: up ? "rotate(45deg)" : "rotate(-45deg)" }} />
        <span style={{ color: "var(--ios-label2)" }}>{code}</span>
        <span style={{ color: "var(--ios-label)", fontVariantNumeric: "tabular-nums" }}>{time}</span>
      </span>
    );
  };
  const track = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700) }}>{s(p, "from")}</span>
        <span style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: cr(2), background: "color-mix(in srgb, var(--ios-label) 12%, transparent)" }} />
          <span style={{ position: "absolute", left: 0, width: `${f * 100}%`, height: 3, borderRadius: cr(2), background: accent, transformOrigin: "left", animation: enter("sp-rr-fill", ".3s", ".08s") }} />
          {progress >= 0 ? (
            <span style={{ position: "absolute", left: `calc(${f * 100}% - 7px)`, display: "grid", color: "var(--ios-label)", animation: enter("sp-rr-plane", ".3s", ".08s") }}>
              <Plane size={13} fill="currentColor" strokeWidth={1} style={{ transform: "rotate(45deg)" }} />
            </span>
          ) : null}
        </span>
        <span style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700) }}>{s(p, "to")}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ts(15), lineHeight: "20px", color: "var(--ios-label2)", fontVariantNumeric: "tabular-nums" }}>
        <span>{s(p, "departs")}</span>
        <span>{s(p, "arrives")}</span>
      </div>
    </div>
  );
  return (
    <div
      {...box}
      role="button"
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={(e) => tap(e)}
      style={{
        ...box.style,
        animation: enter("sp-rr-in"),
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: card ? 16 : "12px 0",
        borderRadius: cr(card ? radius : 0),
        background: card ? "var(--ios-fill)" : down ? "color-mix(in srgb, var(--ios-label) 6%, transparent)" : undefined,
        boxShadow: !card && down ? "0 0 0 8px color-mix(in srgb, var(--ios-label) 6%, transparent)" : undefined,
        transform: card && down ? "scale(.97)" : undefined,
        transition: "transform .12s ease-out, background-color .12s ease-out, box-shadow .12s ease-out",
        cursor: "pointer",
        color: "var(--ios-label)",
        ...fillStyle(fill, axis),
        alignSelf: axis === "v" ? "stretch" : undefined,
      }}
    >
      <style>{"@keyframes sp-rr-in{from{opacity:0;transform:scale(.95)}}@keyframes sp-rr-fade{from{opacity:0}}@keyframes sp-rr-fill{from{transform:scaleX(0)}}@keyframes sp-rr-plane{from{left:-7px}}"}</style>
      {lead !== "none" ? (
        <div style={{ width: 52, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: lead === "countdown" ? 0 : 4, paddingTop: 2 }}>
          {lead === "air" ? (
            <span style={{ width: 36, height: 36, borderRadius: cr("50%"), background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, display: "grid", placeItems: "center" }}><Plane size={15} fill="currentColor" strokeWidth={1} /></span>
          ) : lead === "countdown" ? (
            <span style={{ fontSize: ts(28), lineHeight: "34px", fontWeight: fw(600), fontVariantNumeric: "tabular-nums" }}>{s(p, "leadValue")}</span>
          ) : (
            <span style={{ width: 44, height: 44, borderRadius: cr("50%"), background: accentize(avatarFill(s(p, "leadValue").trim())), color: AVATAR_INK, display: "grid", placeItems: "center", fontSize: ts(17), fontWeight: fw(600) }}>{s(p, "leadValue")}</span>
          )}
          {capEl}
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: card ? 8 : 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ts(13), lineHeight: "18px" }}>
          {s(p, "number").trim() ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-label2)" }}><Plane size={12} strokeWidth={2} />{s(p, "number")}</span>
          ) : null}
          <span style={{ flex: 1 }} />
          {s(p, "detail").trim() ? (
            <span style={{ color: "var(--ios-label2)", whiteSpace: "nowrap", fontWeight: fw(500), fontVariantNumeric: "tabular-nums" }}>
              {s(p, "detail")} <span style={{ color: stateColor, fontWeight: fw(600) }}>{s(p, "highlight")}</span>
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600) }}>{s(p, "title")}</div>
        {card ? track : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {stop(true, s(p, "from"), s(p, "departs"))}
            {stop(false, s(p, "to"), s(p, "arrives"))}
          </div>
        )}
        {s(p, "note").trim() ? <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ts(12), lineHeight: "16px", fontWeight: fw(500), color: "var(--ios-label2)" }}><Clock size={12} strokeWidth={2.2} />{s(p, "note")}</div> : null}
      </div>
    </div>
  );
};
