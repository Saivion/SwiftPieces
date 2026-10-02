"use client";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { colorEntry } from "../../core/palette.js";
import type { Props, ScreenNode } from "../../core/schema.js";
import type { ResolvedTheme } from "../../core/looks.js";

export type Scheme = "dark" | "light";
export type Axis = "v" | "h";

/** What a renderer receives. `box` goes on the renderer's root element, always. */
export type RenderProps = {
  node: ScreenNode;
  p: Props;
  children: ReactNode;
  box: { "data-node-id": string; "data-component": string; className: string; style?: CSSProperties };
  /** Takes all the width its parent offers (SwiftUI's `.frame(maxWidth: .infinity)` behaviour). */
  fill: boolean;
  scheme: Scheme;
};
export type Renderer = (r: RenderProps) => ReactNode;

export const SchemeContext = createContext<Scheme>("dark");
/** The project's resolved look, or null for plain system styling. */
export const ThemeContext = createContext<ResolvedTheme | null>(null);
export const useTheme = () => useContext(ThemeContext);

/**
 * CSS custom properties a phone carries for its look, so renderers read the theme without props:
 * `--ios-accent` (and `--spb-accent` for pieces), the ink on it, the screen ground, the font, and
 * the corner, text, weight and spacing scales. Without a look nothing is set and the system defaults apply.
 */
export function themeVars(theme: ResolvedTheme | null, scheme: Scheme): CSSProperties {
  if (!theme) return {};
  const accent = theme.accent[scheme];
  const surface = theme.surface[scheme];
  const card = CARDS[theme.cards];
  return {
    ["--ios-accent" as string]: accent,
    ["--spb-accent" as string]: accent,
    ["--spb-accent-ink" as string]: theme.accentInk[scheme],
    ["--spb-theme-bg" as string]: theme.background[scheme],
    // The preset's own surface for the pieces' cards and panels.
    ["--h-surface" as string]: surface,
    ["--spb-corner" as string]: String(theme.cornerScale),
    // Pills (capsule buttons, tab pills, the dock) stay pills at standard corners and rounder; tight
    // makes them softly rounded rectangles and square makes them square, like every other corner.
    ["--spb-pill" as string]: theme.cornerScale >= 1 ? "999px" : `${Math.round(22 * theme.cornerScale)}px`,
    ["--spb-text" as string]: String(theme.textScale),
    ["--spb-weight" as string]: String(theme.weightBoost),
    ["--spb-space" as string]: String(theme.spaceScale),
    ["--spb-stretch" as string]: theme.fontStretch,
    ["--spb-tracking" as string]: theme.letterSpacing,
    ...(theme.body.id !== "default" ? { ["--spb-font" as string]: theme.body.css } : {}),
    ...(theme.heading.id !== theme.body.id ? { ["--spb-heading-font" as string]: theme.heading.css } : {}),
    // Cards: the fill, the edge (border and shadow) and, for glass, the blur behind.
    // Cards from a screenshot fill with its card colour, flat ones too (theme.solidCards).
    ["--spb-card" as string]: theme.solidCards && theme.cards === "flat" ? surface : card.fill(surface),
    ["--spb-card-edge" as string]: card.edge,
    ["--spb-card-blur" as string]: card.blur,
    // Only when Cards isn't flat (or the cards are a screenshot's): pieces that draw several cards
    // of their own read these, so the style reaches each of them and flat keeps each piece's own look.
    ...(theme.cards !== "flat" || theme.solidCards ? { ["--spb-card-on" as string]: theme.cards === "flat" ? surface : card.fill(surface), ["--spb-card-edge-on" as string]: card.edge } : {}),
    ...(theme.backdrop !== "none" ? { ["--spb-backdrop" as string]: backdropLayer(theme.backdrop, accent) } : {}),
    ...(theme.symbols !== "outline" ? { ["--spb-symbol-fill" as string]: "currentColor", ["--spb-symbol-fill-opacity" as string]: theme.symbols === "fill" ? ".42" : ".2" } : {}),
    ["--spb-spring" as string]: MOTION[theme.motion].spring,
    ["--spb-bounce" as string]: MOTION[theme.motion].bounce,
    // Icon size: symbols scale against their text, like `.imageScale` at the app root.
    ...(theme.iconScale !== "medium" ? { ["--spb-icon-scale" as string]: theme.iconScale === "small" ? "0.84" : "1.2" } : {}),
    // Hierarchy: titles and big figures (22 points and up) grow or shrink against body text.
    ...(theme.titleScale !== 1 ? { ["--spb-title" as string]: String(theme.titleScale) } : {}),
    // Numbers: tabular figures, like `.monospacedDigit()` at the app root.
    ...(theme.numbers === "tabular" ? { fontVariantNumeric: "tabular-nums" } : {}),
    // Entrance: each screen fades or rises in as it arrives (builder.css runs the animation).
    ...(theme.entrance !== "none" ? { ["--spb-entrance" as string]: theme.entrance === "rise" ? "spb-enter-rise .42s cubic-bezier(.2, .8, .2, 1) both" : "spb-enter-fade .36s ease-out both" } : {}),
  };
}

/** Style → Buttons in the preview: a primary action's fill, ink, edge and blur, like the Swift. */
export function buttonLook(kind: ResolvedTheme["buttons"] | undefined): { fill: string; ink: string; edge: string; blur: string; lift: boolean } {
  const accent = "var(--spb-accent, #FF0000)";
  if (kind === "tinted") return { fill: `color-mix(in srgb, ${accent} 16%, transparent)`, ink: accent, edge: "", blur: "", lift: false };
  if (kind === "outline") return { fill: "transparent", ink: accent, edge: `inset 0 0 0 1.5px ${accent}`, blur: "", lift: false };
  if (kind === "glass") return { fill: `color-mix(in srgb, ${accent} 14%, rgb(255 255 255 / .18))`, ink: accent, edge: "inset 0 0 0 .5px rgb(255 255 255 / .3)", blur: "blur(18px) saturate(1.4)", lift: false };
  return { fill: accent, ink: "var(--spb-accent-ink, #141414)", edge: "", blur: "", lift: true };
}

/** Card treatments: flat is the soft system fill (as before); the rest sit on the preset's surface. */
const CARDS: Record<ResolvedTheme["cards"], { fill: (surface: string) => string; edge: string; blur: string }> = {
  flat: { fill: () => "var(--ios-fill)", edge: "none", blur: "none" },
  raised: { fill: (s) => s, edge: "0 1px 2px rgb(0 0 0 / .08), 0 12px 28px -14px rgb(0 0 0 / .38)", blur: "none" },
  outlined: { fill: (s) => s, edge: "inset 0 0 0 1px var(--ios-sep)", blur: "none" },
  glass: { fill: (s) => `color-mix(in srgb, ${s} 58%, transparent)`, edge: "inset 0 0 0 .5px rgb(255 255 255 / .22), 0 10px 26px -18px rgb(0 0 0 / .45)", blur: "blur(18px) saturate(1.4)" },
  bold: { fill: (s) => s, edge: "inset 0 0 0 2px var(--ios-label), 4px 4px 0 0 var(--ios-label)", blur: "none" },
};

/** Motion personalities: the curves the pieces' springs and bounces take. */
const MOTION: Record<ResolvedTheme["motion"], { spring: string; bounce: string }> = {
  smooth: { spring: "cubic-bezier(.32, .72, 0, 1)", bounce: "cubic-bezier(.34, 1.4, .64, 1)" },
  snappy: { spring: "cubic-bezier(.2, .9, .1, 1)", bounce: "cubic-bezier(.3, 1.2, .5, 1)" },
  bouncy: { spring: "cubic-bezier(.34, 1.36, .5, 1)", bounce: "cubic-bezier(.3, 1.8, .5, 1)" },
};

const PAPER = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>") 0 0 / 180px 180px`;

/** The backdrop over the ground: a glow of the accent from the top, a wash down the screen, dots, or paper grain. */
export function backdropLayer(kind: ResolvedTheme["backdrop"], accent: string): string {
  if (kind === "glow") return `radial-gradient(130% 55% at 50% -8%, color-mix(in srgb, ${accent} 30%, transparent), transparent 72%)`;
  if (kind === "gradient") return `linear-gradient(180deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 65%)`;
  if (kind === "grid") return "radial-gradient(color-mix(in srgb, var(--ios-label) 16%, transparent) 1px, transparent 1.3px) 0 0 / 18px 18px";
  if (kind === "paper") return PAPER;
  // A soft mesh of the accent: three blooms at different strengths (MeshGradient in the Swift).
  if (kind === "mesh")
    return [
      `radial-gradient(70% 45% at 0% 0%, color-mix(in srgb, ${accent} 42%, transparent), transparent 70%)`,
      `radial-gradient(60% 40% at 100% 48%, color-mix(in srgb, ${accent} 26%, transparent), transparent 70%)`,
      `radial-gradient(70% 40% at 45% 100%, color-mix(in srgb, ${accent} 12%, transparent), transparent 70%)`,
    ].join(", ");
  return "none";
}

/** The appearance a screen shows in: its own setting, else the look's, else the preview toggle. */
export function schemeFor(screenAppearance: string, theme: ResolvedTheme | null, preview: Scheme): Scheme {
  if (screenAppearance === "dark" || screenAppearance === "light") return screenAppearance;
  if (theme && theme.appearance !== "system") return theme.appearance;
  return preview;
}
export const AxisContext = createContext<Axis>("v");
export const useScheme = () => useContext(SchemeContext);
export const useAxis = () => useContext(AxisContext);

export const s = (p: Props, k: string) => String(p[k] ?? "");
export const n = (p: Props, k: string) => Number(p[k] ?? 0);
export const b = (p: Props, k: string) => p[k] === true;

/** A palette color for the current appearance. primary/secondary/accent follow the environment. */
export function paint(id: string, scheme: Scheme): string {
  if (id === "primary") return "var(--ios-label)";
  if (id === "secondary") return "var(--ios-label2)";
  if (id === "accent") return "var(--ios-accent)";
  if (id === "onAccent") return "var(--spb-accent-ink, #fff)";
  return colorEntry(id)[scheme];
}

/** How a view that fills its parent sits in it: stretch across a column, share a row. */
export function fillStyle(fill: boolean, axis: Axis): CSSProperties {
  if (!fill) return {};
  return axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 };
}

export const alignItems = (a: string) => (a === "leading" || a === "top" ? "flex-start" : a === "trailing" || a === "bottom" ? "flex-end" : "center");

/** SF text styles at the default Dynamic Type size. */
export const fonts: Record<string, { size: number; weight: number; line: number }> = {
  largeTitle: { size: 34, weight: 400, line: 41 },
  title: { size: 28, weight: 400, line: 34 },
  title2: { size: 22, weight: 400, line: 28 },
  title3: { size: 20, weight: 400, line: 25 },
  headline: { size: 17, weight: 600, line: 22 },
  body: { size: 17, weight: 400, line: 22 },
  callout: { size: 16, weight: 400, line: 21 },
  subheadline: { size: 15, weight: 400, line: 20 },
  footnote: { size: 13, weight: 400, line: 18 },
  caption: { size: 12, weight: 400, line: 16 },
};
/** A text style, scaled by the look's text size (--spb-text) and weight (--spb-weight), like
 *  `.dynamicTypeSize` and `.fontWeight` at the root of the exported app. */
/** Text styles that are titles: they take Style's heading font (as Theme.font does in Swift). */
export const HEADING_STYLES = new Set(["largeTitle", "title", "title2", "title3"]);
export const font = (style: string, weight?: number): CSSProperties => {
  const f = fonts[style] ?? fonts.body;
  return {
    ...(HEADING_STYLES.has(style) ? { fontFamily: "var(--spb-heading-font, inherit)" } : {}),
    fontSize: `calc(${f.size}px * var(--spb-text, 1)${HEADING_STYLES.has(style) ? " * var(--spb-title, 1)" : ""})`,
    lineHeight: `calc(${f.line}px * var(--spb-text, 1)${HEADING_STYLES.has(style) ? " * var(--spb-title, 1)" : ""})`,
    fontWeight: `min(900, calc(${weight ?? f.weight} + var(--spb-weight, 0)))` as CSSProperties["fontWeight"],
  };
};

/** The app's accent (Style's Accent), with the house signal red when no look sets one. */
export const ACCENT = "var(--spb-accent, #FF0000)";
/** Text and icons on the accent: the ink Style picks to read on it (dark on light accents, white on dark). */
export const ACCENT_INK = "var(--spb-accent-ink, #141414)";

/** The ink for text on a fill: the accent's own ink when the fill is the accent, else `other`. */
export const inkOn = (fill: string | undefined, other: string) => (fill === ACCENT ? ACCENT_INK : other);

/**
 * The house signal red (#FF0000) wherever a component reads it from its own tables (tints, covers,
 * pins, bubbles) becomes the app's accent, so a Style accent reaches those too. Strings, arrays and
 * plain objects of colours are all handled; anything else is returned as is.
 */
export function accentize<T>(v: T): T {
  if (typeof v === "string") return (/^#ff0000$/i.test(v) ? ACCENT : v) as T;
  if (Array.isArray(v)) return v.map(accentize) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    const o = v as Record<string, unknown>;
    const out = Object.fromEntries(Object.entries(o).map(([k, x]) => [k, accentize(x)]));
    // A surface in the house red (a cover, a badge, a bubble) whose ink was drawn for red takes the
    // ink that reads on the accent instead.
    const onRed = ["bg", "ground", "fill", "background", "color"].some((k) => typeof o[k] === "string" && /^#ff0000$/i.test(o[k] as string));
    if (onRed && typeof o.ink === "string") out.ink = ACCENT_INK;
    return out as T;
  }
  return v;
}

// Style everywhere: every renderer's own sizes go through these, so the Style panel's text size,
// weight, corners and font reach every component on every screen, not only the text styles above.

type Len = number | string | undefined;
const PX = /^-?\d+(\.\d+)?px$/;

/** A text size (a number is points), scaled by Style's Text size. */
export const ts = (v: Len): Len => {
  // Display sizes (22 points and up) also take Style's Hierarchy, as Theme.font(size:) does.
  const title = (x: number) => (x >= 22 ? " * var(--spb-title, 1)" : "");
  if (typeof v === "number") return `calc(${v}px * var(--spb-text, 1)${title(v)})`;
  if (typeof v === "string" && PX.test(v)) return `calc(${v} * var(--spb-text, 1)${title(parseFloat(v))})`;
  return v;
};

/** A font weight, shifted by Style's Weight (kept within 100–900). */
export const fw = (v: number | string | undefined): CSSProperties["fontWeight"] => {
  const w = v === "bold" ? 700 : v === "normal" ? 400 : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof w === "number" ? (`min(900, max(100, calc(${w} + var(--spb-weight, 0))))` as CSSProperties["fontWeight"]) : (w as CSSProperties["fontWeight"]);
};

/** A corner radius, scaled by Style's Corners. Circles ("50%") stay circles; pills follow like any corner. */
export const cr = (v: Len): Len => {
  const n = typeof v === "number" ? v : typeof v === "string" && PX.test(v) ? parseFloat(v) : null;
  if (n === null) return v;
  if (!n) return 0;
  // A pill's radius (999, "fully round") follows the pill corner; anything else scales.
  return n >= 100 ? `var(--spb-pill, ${n}px)` : `calc(${n}px * var(--spb-corner, 1))`;
};

/** A component's own typeface, unless Style sets one for the whole app. */
export const ff = (v: string | undefined): string | undefined => (v && v !== "inherit" ? `var(--spb-font, ${v})` : v);

export const houseVar =(k: "text" | "muted" | "surface" | "raised" | "field" | "empty" | "ground") => `var(--h-${k})`;

export function Frame({ axis, children }: { axis: Axis; children: ReactNode }) {
  return <AxisContext.Provider value={axis}>{children}</AxisContext.Provider>;
}
