"use client";
// Countdown Card in the preview: a picture card with split-flap digit tiles. A tap on the card flips
// each tile over on its horizontal axis (the second a beat after the first) between days and weeks,
// with a soft haptic; a tap on the title follows the link. The card dips to 0.97 under the finger. On
// appear it settles in from 0.95 with a fade and the tiles flip down into place, 40 ms apart (a plain
// fade under reduced motion). Solid house fills are flat, with ink picked for contrast.
import { useState } from "react";
import { countdownFace } from "../../../definitions/app-pieces/countdown-card.js";
import { SOLID_ARTS, artInk } from "../../../definitions/app-pieces/media-row.js";
import { ARTS } from "../../../definitions/native.js";
import { fillStyle, n, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { injectStyle } from "../primitives.js";
import { useRuntime, useTap } from "../runtime.js";

injectStyle("spa-countdown-css", `@keyframes spcd-in{from{transform:rotateX(-60deg);opacity:0}to{transform:rotateX(0);opacity:1}}
@keyframes spcd-card{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spcd-fade{from{opacity:0}to{opacity:1}}
.spcd-card{animation:spcd-card .28s cubic-bezier(.23,1,.32,1) both}
@media (prefers-reduced-motion: reduce){.spcd-tile{animation-name:spcd-fade!important;transition:none!important}.spcd-card{animation-name:spcd-fade}}`);

export const CountdownCard: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const follow = useTap(p.link, "light");
  const [weeks, setWeeks] = useState(false);
  const [turns, setTurns] = useState(0);
  const [down, setDown] = useState(false);
  const id = ARTS[s(p, "art")] ? s(p, "art") : "dusk";
  const art = ARTS[id];
  const solid = SOLID_ARTS.has(id);
  const ink = artInk(id);
  const radius = n(p, "radius") || 20;
  const face = countdownFace(n(p, "days"), weeks);
  const eyebrow = s(p, "eyebrow");
  const flip = (el: Element) => {
    rt.haptic("soft", el);
    setWeeks((w) => !w);
    setTurns((t) => t + 1);
  };
  return (
    <div
      {...r.box}
      className={[r.box.className, "spcd-card"].filter(Boolean).join(" ")}
      onClick={(e) => flip(e.currentTarget)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        ...r.box.style,
        position: "relative",
        height: n(p, "height"),
        borderRadius: `calc(${radius}px * var(--spb-corner, 1))`,
        overflow: "hidden",
        cursor: "pointer",
        color: ink,
        background: solid ? art.stops[1] : `linear-gradient(135deg, ${art.stops[0]}, ${art.stops[1]} 55%, ${art.stops[2]})`,
        scale: down ? "0.97" : "1",
        transition: "scale .12s ease-out",
        ...fillStyle(true, axis),
      }}
    >
      {solid ? null : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 45%, rgba(0,0,0,.65))" }} />}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, perspective: 300 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {face.digits.split("").map((d, i) => (
            <span
              key={i}
              className="spcd-tile"
              style={{
                position: "relative",
                width: 34,
                height: 44,
                borderRadius: cr(8),
                background: "#1f1f1f",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontVariantNumeric: "tabular-nums",
                fontSize: ts(30),
                fontWeight: fw(700),
                transform: `rotateX(${turns * 360}deg)`,
                transition: `transform .3s cubic-bezier(.23,1,.32,1) ${i * 0.04}s`,
                animation: `spcd-in .28s cubic-bezier(.23,1,.32,1) ${0.08 + i * 0.04}s backwards`,
              }}
            >
              {d}
              <span style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(0,0,0,.5)" }} />
            </span>
          ))}
        </div>
        <span style={{ fontSize: ts(11), fontWeight: fw(600) }}>{face.unit}</span>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 2 }}>
        {eyebrow ? <span style={{ fontSize: ts(15), fontWeight: fw(500), opacity: 0.8 }}>{eyebrow}</span> : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            follow(e);
          }}
          style={{ background: "none", border: 0, padding: 0, color: "inherit", textAlign: "left", fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700), cursor: "pointer" }}
        >
          {s(p, "title")}
        </button>
        <span style={{ fontSize: ts(13), opacity: 0.8 }}>{s(p, "detail")}</span>
      </div>
    </div>
  );
};
