"use client";
import { useEffect, useState } from "react";
import { items, records, tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { contourFill, contourPath } from "../../../definitions/app-pieces/stat-grid.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { useTap } from "../runtime.js";

// The swapped figure rolls in (the Swift numericText transition), a short upward fade.
injectStyle("spa-stat-grid-css", `@keyframes spasg-roll{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}.spasg-roll{animation:spasg-roll .25s ease-out both}@media (prefers-reduced-motion: reduce){.spasg-roll{animation:spasg-fade .2s ease-out both}}@keyframes spasg-fade{from{opacity:0}to{opacity:1}}`);
import { LABEL, LABEL2, Runs, WideRoot, useHaptic } from "./data-kit.js";
import { useFirstAppearance } from "./first-appearance.js";

export const StatGrid: Renderer = (r) => {
  const rows = records(s(r.p, "items"));
  const tiled = s(r.p, "style") === "tiles";
  const cards = s(r.p, "style") === "cards";
  const squares = s(r.p, "style") === "squares";
  const contour = s(r.p, "style") === "contour" || squares;
  const tap = useTap(r.p.link, "selection");
  const tiles = items(s(r.p, "tiles")).map((t) => (contour ? contourFill(t) : accentize(tintHex(t))));
  const cols = Math.max(1, Math.min(3, n(r.p, "columns") || 2));
  const size = n(r.p, "valueSize") || 30;
  const noteColor = accentize(tintHex(s(r.p, "noteTint"), "azure"));
  const icon = s(r.p, "noteIcon");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [pressed, setPressed] = useState(-1);
  const [touched, setTouched] = useState(false);
  const haptic = useHaptic();
  const radius = n(r.p, "radius") || 22;
  // Cells ease in from 0.95 with a fade, 40 ms apart (capped at 8), like the Swift animation.
  const appeared = useFirstAppearance(r.node.id);
  const [appearedBefore] = useState(appeared);
  const [settled, setSettled] = useState(appearedBefore);
  const reduce = reducedMotion();
  useEffect(() => {
    const b = window.setTimeout(() => setSettled(true), 700);
    return () => {
      window.clearTimeout(b);
    };
  }, []);
  return (
    <WideRoot r={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: 12, rowGap: tiled ? 12 : 18 }}>
      {rows.map(([label = "", value = "", note = ""], i) => {
        const shows = flipped.has(i) && !!note;
        const color = tiles.length ? tiles[i % tiles.length] : "#888";
        const tappable = !!r.p.link || !!note;
        const delay = reduce ? 0 : Math.min(i, 7) * 0.04;
        if (contour) {
          // A contour card: pastel fill, topographic lines, a large light figure, label and a quiet note.
          const ink = "#141414";
          return (
            <div
              key={i}
              onPointerDown={() => r.p.link && setPressed(i)}
              onPointerUp={() => setPressed(-1)}
              onPointerLeave={() => setPressed(-1)}
              onClick={(e) => { if (r.p.link) tap(e); }}
              style={{
                position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: squares ? 6 : 18, minWidth: 0, padding: squares ? 16 : "22px 24px", borderRadius: cr(radius),
                ...(squares ? { flexDirection: "column", justifyContent: "center", aspectRatio: "1 / 1", textAlign: "center" } : {}),
                background: color, color: ink, cursor: r.p.link ? "pointer" : undefined, userSelect: "none",
                opacity: appeared ? 1 : 0,
                transform: !appeared && !reduce ? "scale(.95)" : pressed === i ? "scale(.97)" : undefined,
                transition: settled ? "transform .12s ease-out" : `transform .3s ease-out ${delay}s, opacity ${reduce ? 0.2 : 0.3}s ease-out ${delay}s`,
              }}
            >
              <svg aria-hidden viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                {[0, 1, 2, 3, 4, 5, 6].map((k) => <path key={k} d={contourPath(k)} fill="none" stroke={ink} strokeOpacity={0.14} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
              </svg>
              {squares ? (
                <>
                  <span style={{ position: "relative", fontSize: ts(22), lineHeight: "28px", fontWeight: fw(700) }}>{label}</span>
                  <span style={{ position: "relative", fontSize: ts(15), lineHeight: "20px", opacity: 0.62 }}>{note ? `${value} ${note}` : value}</span>
                </>
              ) : (
                <>
                  <span style={{ position: "relative", fontSize: ts(size), lineHeight: 1, fontWeight: fw(300), letterSpacing: -1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
                  <span style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(500) }}>{label}</span>
                    {note ? <span style={{ fontSize: ts(15), lineHeight: "20px", opacity: 0.62 }}>{note}</span> : null}
                  </span>
                </>
              )}
            </div>
          );
        }
        return (
          <div
            key={i}
            onPointerDown={() => tappable && setPressed(i)}
            onPointerUp={() => setPressed(-1)}
            onPointerLeave={() => setPressed(-1)}
            onClick={(e) => {
              if (!tappable) return;
              if (r.p.link) {
                tap(e);
                return;
              }
              haptic("selection", e.currentTarget);
              setTouched(true);
              setFlipped((f) => {
                const next = new Set(f);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              });
            }}
            style={{
              display: "flex", flexDirection: "column", gap: 4, minWidth: 0, cursor: tappable ? "pointer" : undefined, userSelect: "none",
              padding: tiled || cards ? 16 : 0, borderRadius: cr(radius),
              background: tiled ? `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 82%, black))` : cards ? "var(--spb-card-on, var(--ios-fill))" : undefined,
              boxShadow: cards && !tiled ? "var(--spb-card-edge-on, none)" : undefined,
              color: tiled ? "#fff" : LABEL,
              opacity: appeared ? 1 : 0,
              transform: !appeared && !reduce ? "scale(.95)" : pressed === i ? "scale(.97)" : undefined,
              transition: settled ? "transform .12s ease-out" : `transform .3s ease-out ${delay}s, opacity ${reduce ? 0.2 : 0.3}s ease-out ${delay}s`,
            }}
          >
            <span style={{ fontSize: ts(15), lineHeight: "20px", color: tiled ? "rgba(255,255,255,.85)" : LABEL2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            <span key={shows ? "n" : "v"} className={touched ? "spasg-roll" : undefined} style={{ display: "block" }}><Runs value={shows ? note : value} size={size} /></span>
            {note && cards ? <span key={shows ? "cv" : "cn"} className={touched ? "spasg-roll" : undefined} style={{ fontSize: ts(15), lineHeight: "20px", color: LABEL2 }}>{shows ? value : note}</span> : null}
            {note && !tiled && !cards ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ts(15), lineHeight: "20px", color: noteColor }}>
                <Glyph name={icon} size={15} />{note}
              </span>
            ) : null}
            {note && tiled ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ts(13), fontWeight: fw(600), color: "rgba(255,255,255,.8)" }}>
                <Glyph name="arrow.up" size={12} />{shows ? value : note}
              </span>
            ) : null}
          </div>
        );
      })}
    </WideRoot>
  );
};
