"use client";
// Moment List (definitions/app-pieces/moment-list.ts): moments in cards, or as dots on a rail.
// Tapping one sets a reminder: a bell springs in beside its symbol, in the accent, with a success
// haptic; tap again to clear it (a light tap). Rows highlight under the finger; groups settle in
// once from 0.95 with a fade, 40 ms apart.
import { useState } from "react";
import { BellRing, Haze, MoonStar, Sun, SunMedium, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { MOMENT_KINDS, MOMENT_WARM, momentGroups } from "../../../definitions/app-pieces/moment-list.js";
import { fillStyle, s, useAxis, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { BOUNCE, useRuntime } from "../runtime.js";

const ICONS: Record<string, LucideIcon> = { dawn: Haze, blue: SunMedium, sunrise: Sunrise, golden: Sun, noon: Sun, sunset: Sunset, dusk: MoonStar };

export const MomentList: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const [on, setOn] = useState<Set<string>>(new Set());
  const [pressed, setPressed] = useState<string | null>(null);
  const warm = accentize((MOMENT_WARM[s(p, "warm")] ?? MOMENT_WARM.ember).hex);
  const rail = s(p, "layout") !== "cards";
  // Style → Lists (moment-list.ts listStyle): the theme's cards, a card per moment, or plain rows.
  const list = rail ? null : p.listed === "cards" || p.listed === "grouped" || p.listed === "plain" ? p.listed : null;
  const plain = list === "plain";
  const groups = list === "cards" ? momentGroups(p.items).flat().map((m) => [m]) : momentGroups(p.items);
  const cardStyle = list && !plain ? { background: "var(--spb-card, var(--ios-fill))", boxShadow: "var(--spb-card-edge, none)", backdropFilter: "var(--spb-card-blur, none)", WebkitBackdropFilter: "var(--spb-card-blur, none)" } : null;
  const line = "color-mix(in srgb, var(--ios-label) 15%, transparent)";
  const accent = "var(--spb-accent, var(--ios-accent))";
  const still = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", gap: list === "cards" ? 8 : 16, ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined }}>
      <style>{"@keyframes sp-ml-in{from{opacity:0;transform:scale(.95)}}@keyframes sp-ml-fade{from{opacity:0}}"}</style>
      {groups.map((g, gi) => (
        <div key={gi} style={{ animation: still ? "sp-ml-fade .2s ease-out both" : `sp-ml-in .28s cubic-bezier(.22, 1, .36, 1) ${Math.min(gi, 7) * 40}ms both`, borderRadius: cr(rail || plain ? 0 : 16), background: rail || plain ? "transparent" : "var(--ios-fill)", overflow: rail ? "visible" : "hidden", ...cardStyle }}>
          {g.map((m, i) => {
            const key = `${gi}-${i}`;
            const lit = on.has(key);
            const Icon = ICONS[m.kind] ?? Sun;
            const kind = accentize(MOMENT_KINDS[m.kind]);
            return (
              <div key={i}>
                {i > 0 && !rail ? <div style={{ height: 0.5, marginLeft: plain ? 0 : 16, background: "var(--ios-sep)" }} /> : null}
                <div
                  role="button"
                  aria-pressed={lit}
                  onPointerDown={() => setPressed(key)}
                  onPointerUp={() => setPressed(null)}
                  onPointerLeave={() => setPressed(null)}
                  onPointerCancel={() => setPressed(null)}
                  onClick={(e) => {
                    rt.haptic(lit ? "light" : "success", e.currentTarget);
                    setOn((prev) => {
                      const next = new Set(prev);
                      if (lit) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  style={{ display: "flex", alignItems: "stretch", gap: rail ? 12 : 8, padding: rail ? 0 : "0 16px", margin: rail ? "0 -8px" : 0, paddingLeft: rail ? 8 : plain ? 0 : 16, paddingRight: rail ? 8 : plain ? 0 : 16, borderRadius: cr(rail ? 12 : 0), cursor: "pointer", background: pressed === key ? "color-mix(in srgb, var(--ios-label) 6%, transparent)" : "transparent", transition: "background-color .12s ease-out" }}
                >
                  {rail ? (
                    <span style={{ width: 20, flex: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ flex: 1, width: 2, background: i === 0 ? "transparent" : line }} />
                      <span style={{ width: 12, height: 12, borderRadius: cr(6), background: kind?.dot ?? "#8E8E93", boxShadow: "inset 0 0 0 .5px color-mix(in srgb, var(--ios-label) 12%, transparent)", flex: "none" }} />
                      <span style={{ flex: 1, width: 2, background: i === g.length - 1 ? "transparent" : line }} />
                    </span>
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, padding: "12px 0" }}>
                    <span style={{ fontSize: ts(15), lineHeight: "20px", color: "var(--ios-label2)" }}>{m.label}</span>
                    <span style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(600), color: "var(--ios-label)", fontVariantNumeric: "tabular-nums" }}>{m.value}</span>
                  </div>
                  <span style={{ display: "grid", alignSelf: "center", color: accent, transform: lit || still ? "scale(1)" : "scale(.5)", opacity: lit ? 1 : 0, transition: still ? "opacity .2s" : `transform .3s ${BOUNCE}, opacity .2s` }}>
                    <BellRing size={18} fill="currentColor" />
                  </span>
                  <span style={{ width: 32, alignSelf: "center", display: "grid", placeItems: "center", color: kind?.warm ? warm : "var(--ios-label2)" }}>
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
