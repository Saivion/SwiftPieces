"use client";
// Small helpers the app-piece renderers share: the root element every renderer must draw, and a
// haptic bound to the element it happened on.
import { useCallback, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { fillStyle, useAxis, type RenderProps } from "../env.js";
import { injectStyle } from "../primitives.js";
import { useRuntime, type HapticKind } from "../runtime.js";

// Motion the wellbeing pieces share, matching their Swift (WellbeingEntrance, WellbeingPressStyle in
// definitions/app-pieces/wellbeing-shared.ts): entrances rise from 0.95 with a fade in under 300 ms on a
// strong ease-out, staggered 40 ms and capped at 8 steps; charts wipe in from the leading edge; presses
// dip to 0.97 in 120 ms. Reduced motion turns every entrance into a plain cross-fade.
export const EASE_OUT = "cubic-bezier(.22, 1, .36, 1)";
injectStyle(
  "spw-wellbeing-css",
  `@keyframes spw-in{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes spw-wipe{from{clip-path:inset(0 100% 0 0);opacity:.4}to{clip-path:inset(0 0 0 0);opacity:1}}
@keyframes spw-fade{from{opacity:0}to{opacity:1}}
[data-spw-press]{transition:scale .12s ${EASE_OUT}}
[data-spw-press]:active{scale:.97}
@media (prefers-reduced-motion: reduce){[data-spw-anim]{animation:spw-fade .2s ease-out both!important}[data-spw-press]:active{scale:1}}`,
);

/** A stagger delay: 40 ms a step, capped at 8 steps. */
export const stagger = (index: number) => Math.min(Math.max(0, Math.round(index)), 7) * 40;

/** A staggered entrance: spread on the element that should rise (pop is the same motion) or wipe in. */
export function enter(kind: "pop" | "rise" | "wipe", delayMs = 0): { "data-spw-anim": string; style: CSSProperties } {
  const name = kind === "wipe" ? "spw-wipe" : "spw-in";
  return { "data-spw-anim": kind, style: { animation: `${name} ${kind === "wipe" ? 0.3 : 0.28}s ${EASE_OUT} ${Math.round(delayMs)}ms both` } };
}

/** Press feedback: spread on a button so it dips to 0.97 while held (a CSS `scale`, so it composes with transforms). */
export const press = { "data-spw-press": "" } as const;
/** The transition a pressable element with its own transitions must keep so the dip still animates. */
export const PRESS_TRANSITION = `scale .12s ${EASE_OUT}`;

export function Root({ r, style, children, ...rest }: { r: RenderProps; style?: CSSProperties; children?: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">) {
  const axis = useAxis();
  return <div {...r.box} {...rest} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

export function useHaptic() {
  const { haptic } = useRuntime();
  return useCallback((kind: HapticKind, el?: Element | null) => haptic(kind, el ?? null), [haptic]);
}

/** A drawn face for a mood level 0 (awful) to 4 (great), the same curve the Swift Canvas draws. */
export function FaceGlyph({ level, size, color }: { level: number; size: number; color: string }) {
  const w = size;
  const eye = w * 0.055;
  const bend = (level - 2) * w * 0.075;
  const y = w * 0.62 - bend * 0.35;
  const d = `M ${w * 0.36} ${y} Q ${w * 0.5} ${y + bend * 1.6} ${w * 0.64} ${y}`;
  return (
    <svg width={w} height={w} viewBox={`0 0 ${w} ${w}`} style={{ display: "block" }} aria-hidden>
      <circle cx={w * 0.37} cy={w * 0.4} r={eye} fill={color} />
      <circle cx={w * 0.63} cy={w * 0.4} r={eye} fill={color} />
      {level === 4 ? <path d={`${d} Z`} fill={color} /> : <path d={d} fill="none" stroke={color} strokeWidth={w * 0.045} strokeLinecap="round" />}
    </svg>
  );
}
