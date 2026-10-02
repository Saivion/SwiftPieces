"use client";
// Camera Viewfinder: framing corners over a stand-in scene, a hint card and a shutter that flashes,
// or a meter whose reading steps as you drag across the view. Mirrors CameraViewfinder in the export.
import { useRef, useState, type CSSProperties } from "react";
import { cameraModes, meterLevels } from "../../../definitions/app-pieces/camera-viewfinder.js";
import { Glyph } from "../../icons.js";
import { artBackground } from "../native.js";
import { ArtworkSvg } from "./artwork.js";
import { artworkGround, isArtwork } from "../../../definitions/app-pieces/artwork.js";
import { n, s, useAxis, type Renderer, cr, fw, ts, ACCENT } from "../env.js";
import { SPRING, useDrag, useLive, useRuntime, useTap } from "../runtime.js";
import { EASE_OUT, pressBind } from "./entrance.js";

const blob = (w: number, x: number, y: number, fill: string, blur: number) => (
  <span style={{ position: "absolute", left: "50%", top: "50%", width: w, height: w, borderRadius: cr("50%"), background: fill, filter: `blur(${blur}px)`, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, pointerEvents: "none" }} />
);

export const CameraViewfinder: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const capture = useTap(p.link, "medium");
  const { levels, start } = meterLevels(p);
  const [level, setLevel] = useLive(start);
  const [flash, setFlash] = useState(0);
  const cm = cameraModes(p);
  const [mode, setMode] = useLive(cm.start);
  const [shutterDown, setShutterDown] = useState(false);
  const pickMode = (i: number, el: Element | null) => {
    const next = Math.max(0, Math.min(cm.modes.length - 1, i));
    if (next === mode) return;
    rt.haptic("selection", el);
    setMode(next);
  };
  const stripDrag = useDrag({ axis: "x", onEnd: ({ dx, el }) => { if (Math.abs(dx) > 20) pickMode(mode + (dx < 0 ? 1 : -1), el); } });
  const anchor = useRef(0);
  const ref = useRef<HTMLDivElement>(null);
  const meter = levels.length > 1;
  const drag = useDrag({
    axis: "x",
    onStart: () => (anchor.current = level),
    onMove: ({ dx }) => {
      const next = Math.min(levels.length - 1, Math.max(0, anchor.current + Math.round(dx / 70)));
      if (next !== level) {
        rt.haptic("selection", ref.current);
        setLevel(next);
      }
    },
  });
  const shoot = (el: Element) => {
    setFlash((f) => f + 1);
    capture({ currentTarget: el });
  };
  const bleed = n(p, "bleed");
  const hasModes = cm.modes.length > 0;
  const hintTitle = hasModes ? cm.hints[mode]?.title ?? "" : s(p, "hintTitle").trim();
  const hint = hasModes ? cm.hints[mode]?.text || s(p, "hint").trim() : s(p, "hint").trim();
  const hintTop = s(p, "hintAt") === "top";
  const hintCard = hintTitle || hint ? (
    <div key={hasModes ? mode : undefined} className="spa-enter" style={{ margin: "0 20px", padding: 16, borderRadius: cr(18), background: "rgba(0,0,0,.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: ts(15), fontWeight: fw(600) }}>{hintTitle}</span>
      <span style={{ fontSize: ts(12), opacity: 0.8 }}>{hint}</span>
    </div>
  ) : null;
  const strip = hasModes ? (
    <div onPointerDown={stripDrag} style={{ display: "flex", justifyContent: "center", gap: 24, touchAction: "pan-y" }}>
      {cm.modes.map((m, i) => (
        <span
          key={i}
          role="button"
          aria-selected={i === mode}
          onClick={(e) => pickMode(i, e.currentTarget)}
          style={{ minHeight: 44, display: "grid", placeItems: "center", fontSize: ts(15), fontWeight: fw(600), color: i === mode ? ACCENT : "rgba(255,255,255,.6)", cursor: "pointer", transition: `color .2s ${EASE_OUT}`, userSelect: "none" }}
        >
          {m}
        </span>
      ))}
    </div>
  ) : null;
  const corner = (pos: CSSProperties, rot: number) => (
    <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute", ...pos, transform: `rotate(${rot}deg)` }} aria-hidden>
      <path d="M1.5 24.5V1.5h23" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  return (
    <div
      {...r.box}
      ref={ref}
      onPointerDown={meter ? drag : undefined}
      style={{
        ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), margin: bleed ? `0 -${bleed}px` : undefined,
        flex: "1 1 auto", minHeight: n(p, "height"), position: "relative", overflow: "hidden", background: isArtwork(s(p, "art")) ? artworkGround(s(p, "art")) : artBackground(s(p, "art")), color: "#fff", touchAction: meter ? "pan-y" : undefined,
        display: "flex", flexDirection: "column",
      }}
    >
      {isArtwork(s(p, "art")) ? (
        <>
          <span aria-hidden style={{ position: "absolute", inset: 0, filter: "blur(0.8px)" }}><ArtworkSvg id={s(p, "art")} /></span>
          <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.38) 0%, rgba(0,0,0,0) 33%, rgba(0,0,0,0) 66%, rgba(0,0,0,.5) 100%)" }} />
          {levels.length > 0 ? <span aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(230px 230px at 50% 50%, rgba(0,0,0,.32), rgba(0,0,0,0))" }} /> : null}
        </>
      ) : (
        <>
          {blob(280, -90, -140, "rgba(0,0,0,.22)", 50)}
          {blob(200, 110, -40, "rgba(255,255,255,.25)", 45)}
          {blob(240, 60, 200, "rgba(0,0,0,.18)", 50)}
        </>
      )}
      <div className="spa-enter" style={{ position: "absolute", inset: `${hintTop ? 150 : 90}px 36px ${90 + (hasModes ? 60 : 0) + (!hintTop && (hintTitle || hint) ? 120 : 0)}px`, pointerEvents: "none" }}>
        {corner({ left: 0, top: 0 }, 0)}
        {corner({ right: 0, top: 0 }, 90)}
        {corner({ right: 0, bottom: 0 }, 180)}
        {corner({ left: 0, bottom: 0 }, 270)}
      </div>
      {levels.length > 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textShadow: isArtwork(s(p, "art")) ? "0 1px 3px rgba(0,0,0,.45), 0 2px 16px rgba(0,0,0,.45)" : "0 2px 12px rgba(0,0,0,.3)", pointerEvents: "none" }}>
          <span key={level} style={{ fontSize: ts(44), fontWeight: fw(500), animation: `spb-vf-in .35s ${SPRING}` }}>{levels[level]}</span>
          {s(p, "detail").trim() && <span style={{ fontSize: ts(13) }}>{s(p, "detail")}</span>}
          {p.scale === true && levels.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {levels.map((_, i) => <span key={i} style={{ width: i === level ? 24 : 8, height: 8, borderRadius: cr(4), background: i === level ? ACCENT : "rgba(255,255,255,.35)", transition: `width .35s ${SPRING}, background .2s` }} />)}
            </div>
          )}
        </div>
      )}
      {hintTop && hintCard ? <div style={{ position: "relative", marginTop: 24 }}>{hintCard}</div> : null}
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
        {!hintTop ? hintCard : null}
        {s(p, "control") === "button" ? strip : null}
        {s(p, "control") === "button" ? (
          <button type="button" onClick={(e) => shoot(e.currentTarget)} style={{ margin: "0 20px 24px", height: 50, borderRadius: cr(25), border: 0, background: "var(--ios-accent)", color: "var(--spb-accent-ink, #fff)", fontSize: ts(17), fontWeight: fw(600), cursor: "pointer", fontFamily: "inherit" }}>
            {s(p, "buttonTitle") || "Next"}
          </button>
        ) : (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 28px", background: isArtwork(s(p, "art")) ? "rgba(0,0,0,.78)" : "rgba(0,0,0,.45)" }}>
            {strip}
            <button type="button" {...pressBind(setShutterDown)} onClick={(e) => shoot(e.currentTarget)} aria-label="Take photo" style={{ width: 72, height: 72, borderRadius: cr(36), border: "4px solid #fff", background: "transparent", padding: 3, cursor: "pointer" }}>
              <span style={{ display: "block", width: "100%", height: "100%", borderRadius: cr("50%"), background: "rgba(255,255,255,.9)", transform: shutterDown ? "scale(.9)" : "none", transition: `transform ${shutterDown ? ".1s" : ".2s"} ${EASE_OUT}` }} />
            </button>
            <span style={{ position: "absolute", right: 28, bottom: 16 + 36, transform: "translateY(50%)" }}><Glyph name="photo" size={22} /></span>
          </div>
        )}
      </div>
      {flash > 0 && <span key={flash} style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none", animation: "spb-vf-flash .45s ease-in forwards" }} />}
      <style>{"@keyframes spb-vf-flash{0%{opacity:.85}100%{opacity:0}}@keyframes spb-vf-in{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}"}</style>
    </div>
  );
};
