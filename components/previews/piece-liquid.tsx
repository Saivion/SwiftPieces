"use client";
// The SwiftPieces liquid glass language for the web previews: the same merge distance, rest gaps, bud cycle and
// letter morph as registry/foundation/PieceLiquid.swift, so a preview melts and buds the way its piece does.
// The rules are in LIQUID_GLASS.md at the repo root.
//
// The web has no Liquid Glass, so a `LiquidGroup` draws its glass twice. The glass pass draws every `Liquid`
// shape as a plain fill (content hidden but still laid out) through an SVG goo filter: a blur, then an alpha
// threshold, so shapes closer than the merge distance melt into one through a smooth neck of clear glass, traced by a
// hairline edge, with a light rim and a soft lift. The content pass draws the same shapes clear on top, with their icons and labels crisp. Both passes are the
// same children with the same props, so they move in step: keep a group's state above it, never inside it.
import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { t as tr, type Spring } from "./piece-motion";

/** The language's values, mirroring PieceLiquid in Swift. Lengths are in iOS points. */
export const liquid = {
  /** Shapes closer than this share a neck. */
  merge: 20,
  /** Parts of one control rest joined: the neck holds, short and smooth, about two thirds of their height. */
  joined: 4,
  /** Separate actions rest apart: they only goo while budding or melting. */
  apart: 26,
  /** How far a bubble shrinks while it is home inside its parent. */
  homeScale: 0.72,
  /** A bubble leaving its parent. */
  split: { duration: 0.62, bounce: 0.22 } satisfies Spring,
  /** A bubble going home: no bounce, so it never pokes out through the far side of its parent. */
  home: { duration: 0.5, bounce: 0 } satisfies Spring,
} as const;

/** The glass material, following the site theme (app/globals.css, --pv-glass*). The body is translucent, so what is
 *  behind a group shows through it; `solid` is the same glass as one opaque colour, for mixing into a tint. */
export const glass = {
  /** The translucent body. */
  fill: "var(--pv-glass, rgba(38,38,41,.62))",
  /** The body as one opaque colour over the stage, for `color-mix` with a tint. */
  solid: "var(--pv-glass-solid, #2a2a2d)",
  /** The lens shade that gathers toward the inside of the edge. */
  shade: "var(--pv-glass-shade, rgba(0,0,0,.24))",
  /** The light the top of the lens catches. */
  light: "var(--pv-glass-light, #3d3d3d)",
  /** The soft shadow outside a group. */
  lift: "var(--pv-glass-lift, rgba(0,0,0,.45))",
  /** The hairline traced around a group's merged outline. */
  edge: "var(--pv-glass-edge, rgba(255,255,255,.12))",
  /** Kept for callers that drew their own rim. */
  rim: "var(--pv-glass-rim, rgba(255,255,255,.16))",
} as const;

/**
 * The glass material as two lookup tables over the blurred outline (0 far outside, 0.5 on the edge, 1 deep inside),
 * one per site theme: what colour and how much cover each band gets. Just inside the edge a fine outline, then a
 * soft shade that fades into the translucent body; light glass is milky white, dark glass smoky. One lookup in place
 * of separate fills, shades and outlines keeps a page of moving glass at full frame rate.
 */
const MATERIAL = {
  light: lookup([[0, 0, 0], [0.45, 0.45, 0.22], [0.5, 0.64, 0.6], [0.55, 0.9, 0.58], [0.6, 0.95, 0.56], [0.65, 0.975, 0.55], [0.7, 1, 0.55]]),
  dark: lookup([[0, 0, 0], [0.45, 0.6, 0.18], [0.5, 0.42, 0.5], [0.55, 0.2, 0.62], [0.6, 0.16, 0.62], [0.65, 0.15, 0.62]]),
} as const;

/** Steps of [from, grey, cover] as 21-entry feFunc tables. */
function lookup(steps: Array<[number, number, number]>) {
  const tone: number[] = [], cover: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const h = i / 20;
    const [, g, a] = steps.reduce((at, step) => (h >= step[0] - 1e-9 ? step : at), steps[0]);
    tone.push(g); cover.push(a);
  }
  return { tone: tone.join(" "), cover: cover.join(" ") };
}

type Pass = "glass" | "content";
const PassContext = createContext<Pass | null>(null);
/** The CSS length of one iOS point inside the current group, so shapes and offsets can be written in points. */
const UnitContext = createContext("1px");

/** A length in points as CSS, against `unit` (one point). */
const len = (points: number, unit: string) => `calc(${unit} * ${+points.toFixed(3)})`;

/**
 * A group of glass shapes that merge into one liquid surface, like `PieceLiquidGroup`. `unit` is the CSS length of
 * one iOS point in this preview (`"0.19cqw"` on the 4:3 stage); the goo is sized from it, so the neck is the same
 * width at every preview size. Lay the shapes out inside `children` exactly as the piece does.
 */
export function LiquidGroup({ unit, merge = liquid.merge, axis = "x", lift = true, appearance, className, style, children }: {
  unit: string;
  merge?: number;
  /** Pins the glass to one appearance whatever the site theme, for chrome over a dark photo or scrim. */
  appearance?: "light" | "dark";
  /** The direction the shapes line up in. The goo reaches far along it and barely across it. */
  axis?: "x" | "y" | "both";
  lift?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const id = `sp-goo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const probe = useRef<HTMLSpanElement>(null);
  // One point in pixels, measured once the preview has a size. 2px is a fair first guess for the server render.
  const [px, setPx] = useState(2);
  useEffect(() => {
    const el = probe.current;
    if (!el) return;
    // Layout pixels, not screen pixels: a filter works in the element's own space, before any scale on the stage.
    const read = () => setPx(Math.max(el.offsetWidth / 100, 0.25));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // A Gaussian goo that reached the full merge distance in every direction would also swell every edge, so it
  // reaches far along the row and barely across it (shapes keep their height). At the joined gap that gives a short,
  // smooth neck about two thirds of the shapes' height, the way Liquid Glass joins two shapes; it thins as they part
  // and snaps short of the merge distance. The crisp shapes are drawn on top, so nothing ever shrinks.
  const along = merge * 0.55 * px, across = merge * 0.15 * px;
  const deviation = axis === "x" ? `${along} ${across}` : axis === "y" ? `${across} ${along}` : `${merge * 0.35 * px}`;
  const r = (n: number) => +n.toFixed(3);
  return (
    <UnitContext.Provider value={unit}>
      <div className={`relative ${className ?? ""}`} style={style}>
        <span ref={probe} aria-hidden className="pointer-events-none absolute left-0 top-0 h-0" style={{ width: len(100, unit), visibility: "hidden" }} />
        <svg aria-hidden width="0" height="0" className="absolute">
          {(["light", "dark"] as const).map((theme) => (
            <filter key={theme} id={`${id}-${theme}`} x="-30%" y="-60%" width="160%" height="220%" colorInterpolationFilters="sRGB">
              {/* The outline only: every shape is drawn opaque in this pass, so the goo reads alpha and colour never blurs. */}
              <feGaussianBlur in="SourceAlpha" stdDeviation={deviation} result="blur" />
              {/* Threshold at exactly half: a straight edge stays where it was. */}
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 30 -14.5" result="goo" />
              <feComposite in="SourceAlpha" in2="goo" operator="over" result="mask" />
              {/* The outline softened a little, copied into every channel, then looked up: outline, shade and body. */}
              <feGaussianBlur in="mask" stdDeviation={r(2.5 * px)} result="soft" />
              <feColorMatrix in="soft" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 1 0" result="depth" />
              <feComponentTransfer in="depth">
                <feFuncR type="table" tableValues={MATERIAL[theme].tone} />
                <feFuncG type="table" tableValues={MATERIAL[theme].tone} />
                <feFuncB type="table" tableValues={MATERIAL[theme].tone} />
                <feFuncA type="table" tableValues={MATERIAL[theme].cover} />
              </feComponentTransfer>
            </filter>
          ))}
        </svg>
        <PassContext.Provider value="glass">
          {/* Hidden as a whole, so text and fills that are not glass never pass through the goo; each `Liquid` turns
              its own fill back on, nested ones included. */}
          <div aria-hidden className="pv-glass-pass pointer-events-none absolute inset-0" style={{
            visibility: "hidden",
            ["--pv-goo-light" as string]: `url(#${id}-light)`,
            ["--pv-goo-dark" as string]: `url(#${id}-dark)`,
            // The lift: a soft shadow under the group, which reads faintly through the glass as depth.
            ["--pv-goo-lift" as string]: lift ? `drop-shadow(0 ${len(5, unit)} ${len(12, unit)} ${glass.lift})` : "drop-shadow(0 0 0 transparent)",
            // A pinned appearance wins over the theme's choice (app/globals.css, .pv-glass-pass).
            ...(appearance ? { filter: `url(#${id}-${appearance}) var(--pv-goo-lift)` } : null),
          }}>
            {children}
          </div>
        </PassContext.Provider>
        <PassContext.Provider value="content">
          {/* At least the group's own height, like the glass pass: shapes placed absolutely against the group's edges
              land in the same place in both passes, so a tint painted here sits exactly on its glass. */}
          <div className="relative" style={{ minHeight: "100%" }}>{children}</div>
        </PassContext.Provider>
      </div>
    </UnitContext.Provider>
  );
}

/** Where a bubble sits: `out` at `rest`, otherwise home inside its parent, shrunk. Offsets are in points. */
export type Bud = { out: boolean; rest?: [number, number]; home: [number, number] };

/**
 * One liquid glass shape, like `.pieceLiquid(_:tint:)`. `radius` is its corner radius in points (`"capsule"` for a
 * capsule or circle). Inside a `LiquidGroup` it draws once in each pass; on its own it draws a single glass shape
 * with a rim and lift. `bud` runs the bud cycle on the shape itself. `tint` is an opaque colour with a meaning, painted
 * crisp inside the glass; `"transparent"` is no glass at all, for content that must ride with the group's shapes.
 */
export function Liquid({ radius = "capsule", tint, bud, className, style, children }: {
  radius?: number | "capsule";
  tint?: string;
  bud?: Bud;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const pass = useContext(PassContext);
  const unit = useContext(UnitContext);
  const corner = radius === "capsule" ? "9999px" : len(radius, unit);
  const placed = bud ? budStyle(bud, unit) : undefined;
  // A bud owns the transform; anything else the caller transitions (a tint easing, a width) runs beside it.
  const transition = [style?.transition, placed?.transition].filter(Boolean).join(", ") || undefined;
  const base: CSSProperties = { borderRadius: corner, ...style, ...placed, transition };
  // `tint="transparent"` lays out content that rides with the glass in both passes without being glass itself.
  const clear = tint === "transparent";
  // A tint is painted inside the glass, crisp to the shape's edge, with the lens's top light and lower shade over it.
  const lens = `inset 0 ${len(1, unit)} ${len(1.5, unit)} rgba(255,255,255,.35), inset 0 ${len(-3, unit)} ${len(7, unit)} rgba(0,0,0,.10)`;
  const tinted: CSSProperties = tint && !clear
    ? { background: tint, boxShadow: [style?.boxShadow, lens].filter(Boolean).join(", ") }
    : { background: "transparent" };
  if (pass === "glass" && clear) {
    return (
      <div className={className} style={{ ...base, background: "transparent", boxShadow: "none", color: "transparent", visibility: "hidden" }}>
        {children}
      </div>
    );
  }
  if (pass === "glass") {
    // The outline alone, opaque so the filter reads it as alpha; the filter makes the glass. The content keeps its
    // space so the outline matches the content pass exactly.
    return (
      <div className={className} style={{ ...base, background: "#000", boxShadow: "none", color: "transparent", visibility: "visible" }}>
        <span style={{ visibility: "hidden", display: "contents" }}>{children}</span>
      </div>
    );
  }
  if (pass === "content") return <div className={className} style={{ ...base, ...tinted }}>{children}</div>;
  // On its own: the same material in CSS, a translucent body with the lens shade, top light, hairline and lift.
  return (
    <div className={className} style={{
      ...base,
      background: tint ?? glass.fill,
      boxShadow: [
        `0 0 0 ${len(0.6, unit)} ${glass.edge}`,
        `inset 0 ${len(1, unit)} ${len(1.5, unit)} rgba(255,255,255,${tint ? 0.35 : 0.6})`,
        `inset 0 ${len(-3, unit)} ${len(8, unit)} ${glass.shade}`,
        `0 ${len(5, unit)} ${len(14, unit)} ${glass.lift}`,
      ].join(", "),
    }}>
      {children}
    </div>
  );
}

/** The transform and transition of a bubble in the bud cycle: out on the split spring, home on the bounceless one. */
export function budStyle({ out, rest = [0, 0], home }: Bud, unit: string): CSSProperties {
  const [x, y] = out ? rest : home;
  return {
    transform: `translate(${len(x, unit)}, ${len(y, unit)}) scale(${out ? 1 : liquid.homeScale})`,
    transition: tr("transform", out ? liquid.split : liquid.home),
  };
}

/** A bubble's own content: gone the moment it heads home, arriving just after it leaves. */
export function BudContent({ out, children, className }: { out: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={className} style={{
      display: "contents",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: out ? 1 : 0, filter: `blur(${out ? 0 : 6}px)`,
        transition: out ? "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms" : "opacity 140ms ease-out, filter 140ms ease-out",
      }}>
        {children}
      </span>
    </span>
  );
}

/**
 * A label that changes letter by letter, like `PieceMorphText`: letters both strings share hold still, the old ones
 * that change blur out where they stood while the new ones blur in a few milliseconds apart (app/globals.css,
 * `pv-lq-in` and `pv-lq-out`), so there is never a blank beat. Screen readers get the whole string.
 */
export function MorphText({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const [shown, setShown] = useState(text);
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (text === shown) return;
    setLeaving(shown);
    setShown(text);
    const t = window.setTimeout(() => setLeaving(null), 280);
    return () => window.clearTimeout(t);
  }, [text, shown]);
  const now = Array.from(shown), before = leaving ? Array.from(leaving) : [];
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex", whiteSpace: "pre", ...style }} aria-label={shown}>
      {now.map((ch, i) => (
        // A letter both strings share keeps its element, so its arrival never plays again.
        <span key={`${i}${ch}`} aria-hidden className="pv-lq-in" style={{ animationDelay: `${i * 22}ms` }}>{ch}</span>
      ))}
      {leaving ? (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 inline-flex" style={{ whiteSpace: "pre" }}>
          {before.map((ch, i) => (
            <span key={`${leaving}-${i}`} className={now[i] === ch ? undefined : "pv-lq-out"} style={{ display: "inline-block", visibility: now[i] === ch ? "hidden" : undefined }}>{ch}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
