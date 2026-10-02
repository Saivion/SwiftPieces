"use client";
// Artwork (definitions/app-pieces/artwork.ts) in the preview: the same path data as the Swift
// `Artwork` view, fitted the same way (contain on the bottom edge or centred, or cover).
import type { CSSProperties } from "react";
import { artwork } from "../../../definitions/app-pieces/artwork.js";

export function ArtworkSvg({ id, style, ink }: { id: string; style?: CSSProperties; ink?: string }) {
  const a = artwork(id);
  if (!a) return null;
  const aspect = a.fit === "cover" ? "xMidYMid slice" : a.anchor === "bottom" ? "xMidYMax meet" : "xMidYMid meet";
  return (
    <svg aria-hidden viewBox={`0 0 ${a.w} ${a.h}`} preserveAspectRatio={aspect} style={{ display: "block", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      {a.layers.map((l, i) => (
        <path key={i} d={l.d} fill={l.fill === "currentColor" ? ink ?? "currentColor" : l.fill} fillOpacity={l.opacity} fillRule={l.evenOdd ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}
