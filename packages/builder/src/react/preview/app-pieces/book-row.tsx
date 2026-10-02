"use client";
import { useState } from "react";
import { SHELVES } from "../../../definitions/app-pieces/book-row.js";
import { items } from "../../../definitions/app-pieces/data-kit.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts } from "../env.js";
import { injectStyle } from "../primitives.js";
import { BOUNCE, useLive } from "../runtime.js";
import { BookCover } from "./book-cover.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";

injectStyle("spa-book-row-css", `@keyframes spbr-in{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spbr-fade{from{opacity:0}to{opacity:1}}
.spbr-enter{animation:spbr-in .28s cubic-bezier(.23,1,.32,1) both}
@media (prefers-reduced-motion: reduce){.spbr-enter{animation-name:spbr-fade}}`);

// Book Row (definitions/app-pieces/book-row.ts): settles in from 0.95 with a fade; genre words read
// in primary ink and moods in secondary, the shelf pill (the accent) opens a menu in place with a
// selection tick, and in a feed the heart likes with a light impact.
export const BookRow: Renderer = (r) => {
  const feed = s(r.p, "style") === "feed";
  const [shelf, setShelf] = useLive(s(r.p, "shelf") || "to read");
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const haptic = useHaptic();
  const rating = n(r.p, "rating");
  const likes = Math.round(n(r.p, "likes")) + (liked ? 1 : 0);
  const who = s(r.p, "who");
  const outlined = s(r.p, "frame") !== "none";
  const [likeDown, setLikeDown] = useState(false);
  const genres = items(s(r.p, "genres"));
  const moods = items(s(r.p, "moods"));
  return (
    <WideRoot
      r={r}
      className={`${r.box.className} spbr-enter`}
      style={{
        display: "flex", flexDirection: "column", gap: 12, color: LABEL, zIndex: open ? 20 : undefined,
        ...(feed && outlined ? { padding: 16, borderRadius: cr(16), boxShadow: "inset 0 0 0 1px var(--ios-sep)" } : {}),
      }}
    >
      {feed ? (
        <>
          <span style={{ alignSelf: "flex-end", fontSize: ts(12), color: LABEL2 }}>{s(r.p, "when")}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 34, height: 34, borderRadius: cr(17), flex: "none", background: "var(--ios-fill2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ts(15), fontWeight: fw(700) }}>{who.slice(0, 1).toUpperCase()}</span>
            <span style={{ fontSize: ts(15), lineHeight: "20px" }}><b>{who}</b> {s(r.p, "did")}</span>
          </div>
        </>
      ) : null}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <BookCover title={s(r.p, "title")} author={s(r.p, "author")} width={n(r.p, "coverWidth") || 88} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: ts(17), lineHeight: "21px", fontWeight: fw(700) }}>{s(r.p, "title")}</span>
          <span style={{ fontSize: ts(15), lineHeight: "18px" }}>{s(r.p, "author")}</span>
          {s(r.p, "meta") ? <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ts(13), color: LABEL2 }}><Glyph name="book" size={13} />{s(r.p, "meta")}</span> : null}
          <span style={{ fontSize: ts(15), lineHeight: "20px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {genres.map((g, i) => <span key={`g${i}`} style={{ color: LABEL, fontWeight: fw(500) }}>{i > 0 ? " · " : ""}{g}</span>)}
            {moods.map((m, i) => <span key={`m${i}`} style={{ color: LABEL2 }}>{i > 0 || genres.length ? " · " : ""}{m}</span>)}
          </span>
          {rating > 0 ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ts(13), fontWeight: fw(600), color: LABEL2 }}>{rating.toFixed(1)} <span style={{ color: LABEL2, display: "grid" }}><Glyph name="star.fill" size={14} style={{ fill: "currentColor" }} /></span></span> : null}
          {feed ? (
            <span
              role="button"
              onPointerDown={() => setLikeDown(true)}
              onPointerUp={() => setLikeDown(false)}
              onPointerLeave={() => setLikeDown(false)}
              onClick={(e) => {
                setLiked((v) => !v);
                haptic("light", e.currentTarget);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start", cursor: "pointer", color: liked ? "var(--ios-accent)" : LABEL, fontSize: ts(17), fontWeight: fw(600), userSelect: "none", scale: likeDown ? "0.97" : "1", transition: "scale .12s ease-out" }}
            >
              <span key={String(liked)} className="spa-pop" style={{ display: "flex" }}><Glyph name={liked ? "heart.fill" : "heart"} size={22} /></span>
              {likes > 0 ? <span key={likes} className="spa-rise" style={{ fontVariantNumeric: "tabular-nums" }}>× {likes}</span> : ""}
            </span>
          ) : (
            <div style={{ position: "relative", marginTop: 4 }}>
              <div role="button" onClick={(e) => { haptic("light", e.currentTarget); setOpen((v) => !v); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: cr(18), background: "color-mix(in srgb, var(--ios-accent) 14%, transparent)", color: "var(--ios-accent)", fontSize: ts(15), fontWeight: fw(600), cursor: "pointer", userSelect: "none" }}>
                {shelf}
                <Glyph name="chevron.down" size={13} strokeWidth={2.8} style={{ transform: open ? "rotate(180deg)" : undefined, transition: `transform .3s ${BOUNCE}` }} />
              </div>
              {open ? (
                <div className="spbr-enter" style={{ position: "absolute", left: 0, top: 40, zIndex: 5, background: "var(--ios-accent)", color: "var(--spb-accent-ink, #fff)", transformOrigin: "top left", display: "flex", flexDirection: "column", padding: "6px 0", minWidth: 170, borderRadius: cr(12), boxShadow: "0 8px 20px rgba(0,0,0,.2)" }}>
                  {SHELVES.map((x) => (
                    <span
                      key={x}
                      onClick={(e) => {
                        setShelf(x);
                        setOpen(false);
                        haptic("selection", e.currentTarget);
                      }}
                      style={{ padding: "9px 14px", textAlign: "center", fontSize: ts(15), fontWeight: fw(x === shelf ? 700 : 600), cursor: "pointer" }}
                    >
                      {x}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </WideRoot>
  );
};
