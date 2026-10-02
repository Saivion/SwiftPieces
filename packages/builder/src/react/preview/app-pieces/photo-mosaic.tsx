"use client";
// Photo Mosaic: a collage of a collection's photos with its name, count and badge; presses in and
// opens. Mirrors PhotoMosaic in the export: house solids are flat, photo stand-ins keep their scene.
import { useState } from "react";
import { SOLID_ARTS, mosaicArts, mosaicTile } from "../../../definitions/app-pieces/photo-mosaic.js";
import { Glyph } from "../../icons.js";
import { artBackground } from "../native.js";
import { n, s, useAxis, type Renderer, cr, fw, ts, ACCENT, ACCENT_INK } from "../env.js";
import { useTap } from "../runtime.js";
import { pressBind, pressStyle } from "./entrance.js";
import { ArtworkSvg } from "./artwork.js";
import { isArtwork } from "../../../definitions/app-pieces/artwork.js";

export const PhotoMosaic: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const open = useTap(p.link);
  const [down, setDown] = useState(false);
  const arts = mosaicArts(p);
  const sym = s(p, "symbol");
  const radius = p.radius === undefined ? 18 : n(p, "radius");
  const tile = (i: number) => {
    const t = mosaicTile(arts[i]);
    return (
      <span style={{ flex: 1, minHeight: 0, background: SOLID_ARTS.has(arts[i]) || isArtwork(arts[i]) ? t.stops[0] : artBackground(arts[i]), display: "grid", placeItems: "center", color: t.mark, position: "relative", overflow: "hidden" }}>
        {isArtwork(arts[i]) ? (
          <span style={{ position: "absolute", inset: "10px 6px 0" }}><ArtworkSvg id={arts[i]} /></span>
        ) : sym !== "none" ? (
          <span style={{ transform: `rotate(${i * 38 - 30}deg)`, display: "grid" }}><Glyph name={sym} size={34} /></span>
        ) : null}
      </span>
    );
  };
  const badge = s(p, "badge").trim();
  return (
    <div
      {...r.box}
      {...pressBind(setDown)}
      role="button"
      onClick={(e) => open(e)}
      style={{
        ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), display: "flex", flexDirection: "column", gap: 8, cursor: "pointer",
        ...pressStyle(down),
      }}
    >
      <div className="spa-enter" style={{ display: "flex", gap: 3, height: n(p, "height"), borderRadius: `calc(${radius}px * var(--spb-corner, 1))`, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex" }}>{tile(0)}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>{tile(1)}{tile(2)}</div>
        <div style={{ flex: 1, display: "flex" }}>{tile(3)}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600), color: "var(--ios-label)" }}>{s(p, "title")}</span>
          {s(p, "subtitle").trim() && <span style={{ fontSize: ts(15), lineHeight: "20px", color: "var(--ios-label2)" }}>{s(p, "subtitle")}</span>}
        </div>
        {badge && <span style={{ fontSize: ts(11), lineHeight: "13px", fontWeight: fw(600), color: ACCENT_INK, background: ACCENT, padding: "4px 8px", borderRadius: cr(999) }}>{badge}</span>}
      </div>
    </div>
  );
};
