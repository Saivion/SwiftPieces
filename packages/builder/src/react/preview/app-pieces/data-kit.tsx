"use client";
// Shared bits for the data-driven app piece renderers: a root that takes the offered width (the
// SwiftUI `.frame(maxWidth: .infinity)` these pieces all use), a haptic shorthand, and unit runs.
import { useCallback, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { valueRuns } from "../../../definitions/app-pieces/data-kit.js";
import { useAxis, type RenderProps, fw, ts } from "../env.js";
import { injectStyle } from "../primitives.js";
import { BOUNCE, SPRING, useRuntime, type HapticKind } from "../runtime.js";

injectStyle(
  "spa-data-css",
  `@keyframes spa-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes spa-rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
@keyframes spa-grow{from{transform:scaleY(0)}to{transform:none}}
@keyframes spa-ping{from{transform:scale(1);opacity:1}to{transform:scale(1.8);opacity:0}}
@keyframes spa-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.spa-pop{animation:spa-pop .38s ${BOUNCE} both}
.spa-rise{animation:spa-rise .35s ${SPRING} both}
@media (prefers-reduced-motion: reduce){.spa-pop,.spa-rise,.spa-anim{animation:none!important}}`,
);

export function WideRoot({ r, style, children, hug, ...rest }: { r: RenderProps; style?: CSSProperties; children?: ReactNode; hug?: boolean } & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">) {
  const axis = useAxis();
  const wide: CSSProperties = hug ? {} : axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 };
  return (
    <div {...r.box} {...rest} style={{ ...r.box.style, position: "relative", ...wide, ...style }}>
      {children}
    </div>
  );
}

export function useHaptic() {
  const { haptic } = useRuntime();
  return useCallback((kind: HapticKind, el?: Element | null) => haptic(kind, el ?? null), [haptic]);
}

/** "8h 19m" with the numbers at `size` and the units at about half. */
export function Runs({ value, size, weight = 700, unitScale = 0.55 }: { value: string; size: number; weight?: number; unitScale?: number }) {
  return (
    <span style={{ fontSize: ts(size), fontWeight: fw(weight), lineHeight: 1.05, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {valueRuns(value).map((run, i) => (
        <span key={i} style={run.unit ? { fontSize: ts(size * unitScale), marginLeft: 1, marginRight: 3 } : undefined}>{run.text}</span>
      ))}
    </span>
  );
}

/** An element's width in points, kept current as it resizes (the preview's GeometryReader). */
export function useWidth(fallback = 340): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(fallback);
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    obs.current?.disconnect();
    if (!el) return;
    const measure = () => {
      if (el.offsetWidth > 0) setW(el.offsetWidth);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      obs.current = new ResizeObserver(measure);
      obs.current.observe(el);
    }
  }, []);
  return [ref, w];
}

/** Index of the nearest of `count` evenly spaced points to x across width w. */
export const nearest = (x: number, w: number, count: number, inset = 0) =>
  Math.max(0, Math.min(count - 1, Math.round(((x - inset) / Math.max(1, w - inset * 2)) * (count - 1))));

export const LABEL ="var(--ios-label)";
export const LABEL2 = "var(--ios-label2)";
export const LABEL3 = "var(--ios-label3)";
export const FILL = "var(--ios-fill)";
export const SEP = "var(--ios-sep)";
