"use client";
// Media Row (definitions/app-pieces/media-row.ts): a list item with its picture. Tap opens it, the
// trailing control toggles (play and pause, add and added), and with swipe on, dragging left past
// the threshold slides it away with a medium impact, as the SwiftUI DragGesture does. A tap gives a
// light impact and a highlight (rows highlight, they don't scale); the row settles in from 0.95 with
// a fade on appear (a plain fade under reduced motion) and its progress bar fills. With a trailing
// link the play/add control opens it instead of toggling.
import { useState } from "react";
import { Calendar, Check, ChevronRight, CircleCheck, CirclePause, CirclePlay, Clock, Ellipsis, Menu, Plus, Tag, Trash2 } from "lucide-react";
import { SOLID_ARTS, artInk } from "../../../definitions/app-pieces/media-row.js";
import { ARTS } from "../../../definitions/native.js";
import { Glyph } from "../../icons.js";
import { b, fillStyle, n, s, useAxis, type Renderer, cr, ff, fw, ts } from "../env.js";
import { injectStyle } from "../primitives.js";
import { SPRING, useDrag, useRuntime, useTap } from "../runtime.js";
import { ArtworkSvg } from "./artwork.js";
import { artworkGround, isArtwork } from "../../../definitions/app-pieces/artwork.js";

injectStyle("spa-media-row-css", `@keyframes spmr-in{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spmr-fade{from{opacity:0}to{opacity:1}}
@keyframes spmr-fill{from{width:0}}
.spmr-enter{animation:spmr-in .28s cubic-bezier(.23,1,.32,1) both}
@media (prefers-reduced-motion: reduce){.spmr-anim{animation:none!important}.spmr-enter{animation-name:spmr-fade}}`);

const SERIF = 'ui-serif, "New York", Georgia, serif';

export function artFill(id: string): string {
  const a = ARTS[id] ?? ARTS.ocean;
  if (SOLID_ARTS.has(id)) return a.stops[1];
  return [
    "radial-gradient(120% 85% at 12% 8%, rgba(255,255,255,.38), rgba(255,255,255,0) 55%)",
    "radial-gradient(90% 70% at 92% 100%, rgba(0,0,0,.22), rgba(0,0,0,0) 62%)",
    `linear-gradient(135deg, ${a.stops[0]} 0%, ${a.stops[1]} 50%, ${a.stops[2]} 100%)`,
  ].join(", ");
}

const META: Record<string, typeof Clock> = { clock: Clock, calendar: Calendar, tag: Tag, "checkmark.circle": CircleCheck };

export const MediaRow: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const tap = useTap(p.link, "light");
  const openTrailing = useTap(p.trailingLink, "light");
  const trailingLinked = !!s(p, "trailingLink").trim();
  const [on, setOn] = useState(false);
  const [down, setDown] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const swipe = b(p, "swipe");
  const onDrag = useDrag({
    axis: "x",
    onStart: () => setDragging(true),
    onMove: (i) => setDx(Math.min(0, i.dx)),
    onEnd: (i) => {
      setDragging(false);
      if (i.dx < -140 || i.vx < -900) {
        rt.haptic("medium", i.el);
        setDx(-420);
        setTimeout(() => setGone(true), 260);
      } else setDx(0);
    },
  });
  const size = n(p, "thumbSize") || 64;
  const word = s(p, "word").trim();
  const longest = Math.max(1, ...word.split(/\s+/).map((w) => w.length));
  const wordSize = Math.min(size * 0.22, (size * 0.84) / (longest * 0.66));
  const eyebrow = s(p, "eyebrow").trim();
  const meta = s(p, "meta").trim();
  const detail = s(p, "detail").trim();
  const progress = n(p, "progress");
  const trailing = s(p, "trailing");
  const serif = s(p, "titleDesign") === "serif";
  const MetaIcon = META[s(p, "metaIcon")];
  const sym = s(p, "symbol");
  const ink = artInk(s(p, "art"));
  const trail = () => {
    const sz = 26;
    if (trailing === "play") return on ? <CirclePause size={sz} strokeWidth={1.7} /> : <CirclePlay size={sz} strokeWidth={1.7} />;
    if (trailing === "add") return on ? <Check size={22} strokeWidth={2.2} /> : <Plus size={22} strokeWidth={2.2} />;
    if (trailing === "drag") return <Menu size={20} strokeWidth={1.6} />;
    if (trailing === "chevron") return <ChevronRight size={18} strokeWidth={2.2} />;
    if (trailing === "more") return <Ellipsis size={22} />;
    return null;
  };
  const muted = trailing === "drag" || trailing === "chevron";
  if (gone) return <div {...box} style={{ ...box.style, height: 0, overflow: "hidden", ...fillStyle(fill, axis) }} />;
  return (
    <div {...box} className={[box.className, "spmr-enter"].filter(Boolean).join(" ")} style={{ ...box.style, position: "relative", overflow: "hidden", ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined }}>
      {swipe && dx < 0 ? (
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: -dx, background: "#FF3B30", color: "#fff", display: "grid", placeItems: "center" }}>
          <Trash2 size={20} />
        </div>
      ) : null}
      <div
        role="button"
        onPointerDown={(e) => {
          setDown(true);
          if (swipe) onDrag(e);
        }}
        onPointerUp={() => setDown(false)}
        onPointerLeave={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
        onClick={(e) => tap(e)}
        style={{
          position: "relative", display: "flex", alignItems: detail ? "flex-start" : "center", gap: 12, padding: "8px 0",
          background: dx < 0 && p.listed !== true ? "var(--spb-theme-bg, var(--ios-bg))" : undefined, transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : `transform .4s ${SPRING}`, cursor: "pointer", touchAction: "pan-y",
        }}
      >
        <span aria-hidden style={{ position: "absolute", inset: "2px -6px", borderRadius: cr(12), background: "var(--ios-label)", opacity: down && !dragging && dx === 0 ? 0.06 : 0, transition: "opacity .12s ease-out", pointerEvents: "none" }} />
        <div style={{ flex: "none", width: size, height: size, borderRadius: cr(s(p, "thumbShape") === "circle" ? "50%" : size * 0.12), background: isArtwork(s(p, "art")) ? artworkGround(s(p, "art")) : artFill(s(p, "art")), display: "grid", placeItems: "center", overflow: "hidden", position: "relative" }}>
          {isArtwork(s(p, "art")) ? (
            <span style={{ position: "absolute", inset: size * 0.08 }}><ArtworkSvg id={s(p, "art")} /></span>
          ) : word ? (
            <span style={{ color: ink, fontWeight: fw(800), fontSize: ts(wordSize), lineHeight: 1.02, textAlign: "center", padding: size * 0.08, letterSpacing: "-0.02em" }}>{word}</span>
          ) : sym && sym !== "none" ? (
            <span style={{ color: ink, display: "grid" }}><Glyph name={sym} size={Math.round(size * 0.36)} strokeWidth={2.2} /></span>
          ) : null}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {eyebrow ? <div style={{ fontSize: ts(11), lineHeight: "13px", fontWeight: fw(600), color: "var(--ios-label2)", textTransform: "uppercase", letterSpacing: ".02em" }}>{eyebrow}</div> : null}
          <div style={{ fontFamily: ff(serif ? SERIF : undefined), fontSize: ts(serif ? 18 : 15), lineHeight: serif ? "22px" : "20px", fontWeight: fw(500), color: "var(--ios-label)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s(p, "title")}</div>
          {meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ts(12), lineHeight: "16px", color: "var(--ios-label2)" }}>
              {MetaIcon ? <MetaIcon size={12} strokeWidth={2} /> : null}
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
            </div>
          ) : null}
          {progress > 0 ? (
            <div style={{ width: 48, height: 3, marginTop: 2, borderRadius: cr(2), background: "var(--ios-fill2)", overflow: "hidden" }}>
              <div className="spmr-anim" style={{ width: `${progress}%`, height: "100%", background: "var(--ios-accent)", animation: "spmr-fill .3s cubic-bezier(.23,1,.32,1) .1s backwards" }} />
            </div>
          ) : null}
          {detail ? <div style={{ fontSize: ts(15), lineHeight: "20px", color: "var(--ios-label2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{detail}</div> : null}
        </div>
        {trailing !== "none" ? (
          <div
            role="button"
            aria-label={trailing}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (trailingLinked) {
                openTrailing(e);
                return;
              }
              if (trailing === "play" || trailing === "add") {
                rt.haptic("selection", e.currentTarget);
                setOn((v) => !v);
              }
            }}
            style={{ position: "relative", flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", alignSelf: "center", color: muted ? "var(--ios-label3)" : "var(--ios-accent)", transform: on ? "scale(1.06)" : "none", transition: `transform .25s ${SPRING}` }}
          >
            {trail()}
          </div>
        ) : null}
      </div>
    </div>
  );
};
