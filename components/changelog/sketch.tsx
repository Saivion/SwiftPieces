"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

/**
 * Hand-drawn line icons for the changelog cards, generated in code rather than shipped as images.
 * Each icon is a few primitives (lines, boxes, circles, arcs, dots) that are roughened with a seeded
 * wobble, so every stroke looks drawn by hand but renders the same on every load, and then inked in
 * stroke by stroke the first time the card scrolls into view.
 */

export type SketchKind = "slider" | "cards" | "grid" | "terminal" | "sun" | "crown" | "phones" | "windows" | "spark" | "sponsor";

type Prim =
  | { t: "line"; a: [number, number]; b: [number, number] }
  | { t: "box"; x: number; y: number; w: number; h: number; r?: number }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "arc"; cx: number; cy: number; r: number; from: number; to: number }
  | { t: "dot"; cx: number; cy: number };

const L = (x1: number, y1: number, x2: number, y2: number): Prim => ({ t: "line", a: [x1, y1], b: [x2, y2] });

/** Drawn on a 120 × 80 board, centred. */
const ICONS: Record<SketchKind, Prim[]> = {
  // A range slider: a track, the selected span, two thumbs.
  slider: [L(18, 44, 102, 44), L(44, 44, 78, 44), { t: "circle", cx: 44, cy: 44, r: 7 }, { t: "circle", cx: 78, cy: 44, r: 7 }, L(30, 26, 58, 26)],
  // A swipe deck: three cards fanned out.
  cards: [{ t: "box", x: 30, y: 20, w: 34, h: 46, r: 5 }, { t: "box", x: 43, y: 16, w: 34, h: 46, r: 5 }, { t: "box", x: 56, y: 20, w: 34, h: 46, r: 5 }, { t: "dot", cx: 54, cy: 72 }, { t: "dot", cx: 60, cy: 72 }, { t: "dot", cx: 66, cy: 72 }],
  // A wall of pieces.
  grid: [{ t: "box", x: 32, y: 14, w: 24, h: 24, r: 4 }, { t: "box", x: 64, y: 14, w: 24, h: 24, r: 4 }, { t: "box", x: 32, y: 44, w: 24, h: 24, r: 4 }, { t: "circle", cx: 76, cy: 56, r: 12 }],
  // The CLI.
  terminal: [{ t: "box", x: 22, y: 16, w: 76, h: 50, r: 6 }, L(34, 34, 44, 41), L(44, 41, 34, 48), L(50, 49, 66, 49)],
  // Light and dark: a sun whose other half is a crescent.
  sun: [{ t: "circle", cx: 60, cy: 40, r: 14 }, L(60, 12, 60, 19), L(60, 61, 60, 68), L(32, 40, 39, 40), L(81, 40, 88, 40), L(40, 20, 45, 25), L(75, 55, 80, 60), L(80, 20, 75, 25), L(45, 55, 40, 60)],
  // One product, for good.
  crown: [L(32, 56, 88, 56), L(32, 56, 28, 24), L(28, 24, 46, 38), L(46, 38, 60, 18), L(60, 18, 74, 38), L(74, 38, 92, 24), L(92, 24, 88, 56), L(34, 64, 86, 64)],
  // Screens: two phones.
  phones: [{ t: "box", x: 34, y: 12, w: 26, h: 54, r: 6 }, { t: "box", x: 64, y: 18, w: 26, h: 54, r: 6 }, L(43, 60, 51, 60), L(73, 66, 81, 66)],
  // Templates: stacked app windows.
  windows: [{ t: "box", x: 26, y: 18, w: 56, h: 40, r: 5 }, L(26, 28, 82, 28), { t: "box", x: 40, y: 30, w: 56, h: 40, r: 5 }, L(40, 40, 96, 40), { t: "dot", cx: 31, cy: 23 }, { t: "dot", cx: 36, cy: 23 }],
  // The Build Kit: an agent's spark over lines of a brief.
  spark: [L(60, 12, 60, 44), L(44, 28, 76, 28), L(49, 17, 71, 39), L(71, 17, 49, 39), L(30, 56, 90, 56), L(30, 66, 72, 66)],
  // Sponsors: a heart.
  sponsor: [{ t: "arc", cx: 49, cy: 32, r: 11, from: 150, to: 360 }, { t: "arc", cx: 71, cy: 32, r: 11, from: 180, to: 390 }, L(39, 38, 60, 62), L(81, 38, 60, 62)],
};

/** Small deterministic PRNG, so a card's strokes wobble the same way on every render. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** A hand-drawn segment: a gentle curve through a jittered midpoint, slightly overshooting its ends. */
function roughLine(a: [number, number], b: [number, number], r: () => number): string {
  const j = (n: number) => n + (r() - 0.5) * 1.6;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const over = Math.min(1.4, len * 0.04);
  const ux = dx / len;
  const uy = dy / len;
  const start: [number, number] = [j(a[0] - ux * over * r()), j(a[1] - uy * over * r())];
  const end: [number, number] = [j(b[0] + ux * over * r()), j(b[1] + uy * over * r())];
  const bow = (r() - 0.5) * Math.min(3.2, len * 0.06);
  const mx = (start[0] + end[0]) / 2 - uy * bow;
  const my = (start[1] + end[1]) / 2 + ux * bow;
  return `M${start[0].toFixed(1)} ${start[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
}

/** A hand-drawn circle or arc: points around the radius with a small wander, not quite closing. */
function roughArc(cx: number, cy: number, radius: number, from: number, to: number, r: () => number): string {
  const steps = Math.max(10, Math.round((to - from) / 18));
  const pts: string[] = [];
  const drift = (r() - 0.5) * 0.12;
  for (let i = 0; i <= steps; i++) {
    const t = (from + ((to - from) * i) / steps) * (Math.PI / 180);
    const rad = radius * (1 + drift * (i / steps)) + (r() - 0.5) * 0.9;
    pts.push(`${(cx + Math.cos(t) * rad).toFixed(1)} ${(cy + Math.sin(t) * rad).toFixed(1)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(" L")}`;
}

function toPaths(prims: Prim[], seed: number): { d: string; dot?: boolean }[] {
  const r = rng(seed);
  return prims.flatMap((p) => {
    if (p.t === "line") return [{ d: roughLine(p.a, p.b, r) }];
    if (p.t === "dot") return [{ d: roughArc(p.cx, p.cy, 1.3, 0, 360, r), dot: true }];
    if (p.t === "circle") return [{ d: roughArc(p.cx, p.cy, p.r, -90 + r() * 30, 285 + r() * 20, r) }];
    if (p.t === "arc") return [{ d: roughArc(p.cx, p.cy, p.r, p.from, p.to, r) }];
    // A box: four strokes, corners slightly rounded by the curve of each side.
    const { x, y, w, h } = p;
    return [roughLine([x, y], [x + w, y], r), roughLine([x + w, y], [x + w, y + h], r), roughLine([x + w, y + h], [x, y + h], r), roughLine([x, y + h], [x, y], r)].map((d) => ({ d }));
  });
}

/** The smallest square around a drawing's strokes, with room for the wobble and the stroke itself. */
function frame(prims: Prim[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of prims) {
    if (p.t === "line") xs.push(p.a[0], p.b[0]), ys.push(p.a[1], p.b[1]);
    else if (p.t === "box") xs.push(p.x, p.x + p.w), ys.push(p.y, p.y + p.h);
    else {
      const r = p.t === "dot" ? 1.3 : p.r;
      xs.push(p.cx - r, p.cx + r), ys.push(p.cy - r, p.cy + r);
    }
  }
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const side = Math.max(x1 - x0, y1 - y0) + 8;
  return { x: (x0 + x1 - side) / 2, y: (y0 + y1 - side) / 2, side };
}

/**
 * `icon` is the drawing at button size (the docs' What's new button): cropped square to its own
 * strokes, drawn about 1.6px thick at 24px, and shown already drawn. It redraws stroke by stroke when
 * its link is pointed at (.ai-redraw in app/globals.css) instead of inking in as it scrolls into view.
 */
export function Sketch({ kind, seed = 1, className, icon = false }: { kind: SketchKind; seed?: number; className?: string; icon?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [inked, setInked] = useState(false);
  const paths = useMemo(() => toPaths(ICONS[kind], seed * 7919 + kind.length), [kind, seed]);

  // Ink in the first time the icon is seen; reduced motion shows it drawn.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setInked(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInked(true), io.disconnect()), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (icon) {
    const f = frame(ICONS[kind]);
    return (
      <svg aria-hidden viewBox={`${f.x} ${f.y} ${f.side} ${f.side}`} className={`ai overflow-visible ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={f.side / 15} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) => (
          <path key={i} d={p.d} pathLength={1} fill={p.dot ? "currentColor" : "none"} className="ai-redraw" style={{ "--i": i } as CSSProperties} />
        ))}
      </svg>
    );
  }

  return (
    <svg ref={ref} aria-hidden viewBox="0 0 120 80" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          pathLength={1}
          fill={p.dot ? "currentColor" : "none"}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: inked ? 0 : 1,
            opacity: inked ? 1 : 0.001,
            transition: `stroke-dashoffset .5s cubic-bezier(.4,0,.2,1) ${i * 0.07}s, opacity .01s linear ${i * 0.07}s`,
          }}
        />
      ))}
    </svg>
  );
}
