"use client";
import { cr, ff, fw, ts, accentize } from "../env.js";
// The preview of the shared typographic book cover (definitions/app-pieces/book-cover.ts). It swings
// open into place on appear, after `delay` (skipped under reduced motion), as the SwiftUI does.
import { coverStyle, coverTitleSize } from "../../../definitions/app-pieces/book-cover.js";
import { injectStyle } from "../primitives.js";

injectStyle("spa-book-cover-css", `@keyframes spbc-in{from{transform:perspective(600px) rotateY(-12deg) scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spbc-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.spbc-cover{animation-name:spbc-fade!important}}`);

export function BookCover({ title, author, width, delay = 0 }: { title: string; author: string; width: number; delay?: number }) {
  const c = accentize(coverStyle(title));
  return (
    <div
      className="spbc-cover"
      style={{
        transformOrigin: "left center", animation: `spbc-in .28s cubic-bezier(.23,1,.32,1) ${delay}s backwards`,
        width, height: width * 1.5, flex: "none", boxSizing: "border-box", padding: width * 0.09, borderRadius: cr(3),
        background: c.ground, color: c.ink, display: "flex", flexDirection: "column", gap: width * 0.04,
        boxShadow: "2px 3px 8px rgba(0,0,0,.2)", overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: ts(coverTitleSize(title, width)), lineHeight: 1.02, fontWeight: fw(c.serif ? 400 : 900), textTransform: "uppercase", overflowWrap: "normal",
          fontFamily: ff(c.serif ? 'ui-serif, "New York", Georgia, serif' : undefined), display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {title}
      </span>
      <span style={{ width: width * 0.35, height: Math.max(2, width * 0.03), background: c.accent }} />
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: ts(width * 0.075), fontWeight: fw(600), letterSpacing: 1, textTransform: "uppercase", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{author}</span>
    </div>
  );
}
