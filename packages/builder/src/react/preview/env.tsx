"use client";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { colorEntry } from "../../core/palette.js";
import type { Props, ScreenNode } from "../../core/schema.js";

export type Scheme = "dark" | "light";
export type Axis = "v" | "h";

/** What a renderer receives. `box` goes on the renderer's root element, always. */
export type RenderProps = {
  node: ScreenNode;
  p: Props;
  children: ReactNode;
  box: { "data-node-id": string; className: string; style?: CSSProperties };
  /** Takes all the width its parent offers (SwiftUI's `.frame(maxWidth: .infinity)` behaviour). */
  fill: boolean;
  scheme: Scheme;
};
export type Renderer = (r: RenderProps) => ReactNode;

export const SchemeContext = createContext<Scheme>("dark");
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
export const font = (style: string, weight?: number): CSSProperties => {
  const f = fonts[style] ?? fonts.body;
  return { fontSize: f.size, lineHeight: `${f.line}px`, fontWeight: weight ?? f.weight };
};

export const houseVar = (k: "text" | "muted" | "surface" | "raised" | "field" | "empty" | "ground") => `var(--h-${k})`;

export function Frame({ axis, children }: { axis: Axis; children: ReactNode }) {
  return <AxisContext.Provider value={axis}>{children}</AxisContext.Provider>;
}
