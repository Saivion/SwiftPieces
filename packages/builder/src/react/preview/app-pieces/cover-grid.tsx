"use client";
// Cover Grid (definitions/app-pieces/cover-grid.ts): typographic covers in a grid. Each cover dips
// to 0.97 under the finger, and a tap follows the link with a light impact. Covers settle in from 0.95
// with a fade, 40 ms apart and capped at eight, when the grid appears (a plain fade under reduced motion).
import { useState, type CSSProperties } from "react";
import { coverStyle, coverTitles, type CoverStyle } from "../../../definitions/app-pieces/cover-grid.js";
import { b, fillStyle, n, s, useAxis, type Renderer, cr, ff, fw, ts, accentize } from "../env.js";
import { injectStyle } from "../primitives.js";
import { useRuntime, useTap } from "../runtime.js";

injectStyle("spa-cover-css", `@keyframes spcg-in{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes spcg-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.spcg-cover{animation-name:spcg-fade!important}}`);

const FONTS: Record<CoverStyle["type"], CSSProperties> = {
  heavy: { fontWeight: fw(900), letterSpacing: "-0.03em" },
  serif: { fontFamily: ff('ui-serif, "New York", Georgia, serif'), fontWeight: fw(600), letterSpacing: "-0.01em" },
  rounded: { fontFamily: ff('ui-rounded, "SF Pro Rounded", system-ui, sans-serif'), fontWeight: fw(700) },
  condensed: { fontWeight: fw(800), letterSpacing: "-0.04em", fontStretch: "condensed", textTransform: "uppercase" },
};

function Motif({ c }: { c: CoverStyle }) {
  const abs: CSSProperties = { position: "absolute", pointerEvents: "none" };
  if (c.motif === "ring") return <span style={{ ...abs, inset: "12%", borderRadius: cr("50%"), border: `solid ${c.accent}`, borderWidth: "calc(var(--cw) * 0.07)" }} />;
  if (c.motif === "sun") return <span style={{ ...abs, left: "5%", width: "90%", aspectRatio: "1", top: "60%", borderRadius: cr("50%"), background: c.accent }} />;
  if (c.motif === "stripes")
    return <span style={{ ...abs, inset: "10% 0 30% 0", backgroundImage: `repeating-linear-gradient(180deg, ${c.accent}59 0 3.5%, transparent 3.5% 8.5%)` }} />;
  if (c.motif === "dots") return <span style={{ ...abs, inset: 0, backgroundImage: `radial-gradient(${c.accent}99 1.6px, transparent 1.8px)`, backgroundSize: "11.1% 11.1%" }} />;
  if (c.motif === "block") return <span style={{ ...abs, left: 0, right: 0, bottom: 0, height: "36%", background: c.accent, opacity: 0.9 }} />;
  return null;
}

export function Cover({ title, c, radius, onTap, delay = -1 }: { title: string; c: CoverStyle; radius: number; onTap?: (e: { currentTarget: Element }) => void; delay?: number }) {
  const [down, setDown] = useState(false);
  const center = c.place === "center";
  const longest = Math.max(1, ...title.split(/\s+/).map((w) => w.length));
  const size = Math.min(center ? 22 : 17, 84 / (longest * 0.58));
  return (
    <div
      role="button"
      aria-label={title}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={onTap}
      className={delay >= 0 ? "spcg-cover" : undefined}
      style={{
        animation: delay >= 0 ? `spcg-in .28s cubic-bezier(.23,1,.32,1) ${delay}s backwards` : undefined,
        position: "relative", aspectRatio: "1", borderRadius: cr(radius), overflow: "hidden", background: c.bg, cursor: "pointer", containerType: "inline-size",
        transform: `scale(${down ? 0.97 : 1})`, transition: "transform .12s ease-out",
      }}
    >
      <div style={{ position: "absolute", inset: 0, ["--cw" as string]: "100cqw" }}>
        <Motif c={c} />
      </div>
      <div
        style={{
          position: "absolute", inset: 0, padding: "9cqw", display: "flex", flexDirection: "column",
          justifyContent: c.place === "top" ? "flex-start" : c.place === "bottom" ? "flex-end" : "center",
          alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left", color: c.ink,
          fontSize: ts(`${size}cqw`), lineHeight: 0.98, ...FONTS[c.type],
        }}
      >
        <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</span>
      </div>
    </div>
  );
}

export const CoverGrid: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const follow = useTap(p.link, null);
  const titles = coverTitles(p.titles);
  const start = Math.round(n(p, "start"));
  const cols = Math.max(1, Math.min(4, Math.round(n(p, "columns")) || 3));
  const gap = n(p, "spacing");
  const radius = n(p, "radius");
  const width = n(p, "width");
  const styles = titles.map((_, i) => accentize(coverStyle(s(p, "palette"), start + i)));
  return (
    <div {...box} style={{ ...box.style, position: "relative", width: width > 0 ? width : undefined, alignSelf: width > 0 ? "center" : axis === "v" ? "stretch" : undefined, ...(width > 0 ? {} : fillStyle(fill, axis)) }}>
      {b(p, "glow") ? (
        <div aria-hidden style={{ position: "absolute", inset: "-45%", zIndex: 0, pointerEvents: "none", background: `linear-gradient(135deg, ${styles.slice(0, 4).map((c) => c.bg).join(", ")})`, filter: "blur(60px)", opacity: 0.55 }} />
      ) : null}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap, borderRadius: cr(gap === 0 ? radius : 0), overflow: gap === 0 ? "hidden" : undefined }}>
        {titles.map((t, i) => (
          <Cover
            key={i}
            title={t}
            c={styles[i]}
            radius={gap === 0 ? 0 : radius}
            delay={Math.min(i, 8) * 0.04}
            onTap={(e) => {
              rt.haptic("light", e.currentTarget);
              follow(null);
            }}
          />
        ))}
      </div>
    </div>
  );
};
