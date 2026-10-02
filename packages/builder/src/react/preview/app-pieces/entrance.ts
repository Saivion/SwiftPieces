"use client";
// Shared motion for the planner, calendar and camera app pieces, matching
// the Swift they emit: entrances rise from 0.95 with a fade in 280 ms on a strong ease-out, staggered
// 40 ms and capped at 8 items; under Reduce Motion they only cross-fade. Presses answer in 120 ms.
import type { CSSProperties } from "react";
import { injectStyle } from "../primitives.js";

/** The ease-out every entrance and press uses (SwiftUI `.easeOut`). */
export const EASE_OUT = "cubic-bezier(.23, 1, .32, 1)";

injectStyle(
  "spa-enter-css",
  `@keyframes spa-enter{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
@keyframes spa-fade{from{opacity:0}to{opacity:1}}
.spa-enter{animation:spa-enter .28s ${EASE_OUT} backwards}
@media (prefers-reduced-motion: reduce){.spa-enter{animation:spa-fade .2s linear backwards!important}}`,
);

/** The delay of the i-th item in a staggered entrance: 40 ms apart, the ninth onwards together. */
export const stagger = (i: number) => `${Math.min(Math.max(i, 0), 7) * 40}ms`;

/** A card or button under a finger: scale 0.97, in 120 ms, back in 200 ms. */
export const pressStyle = (down: boolean): CSSProperties => ({
  transform: down ? "scale(.97)" : "none",
  transition: `transform ${down ? ".12s" : ".2s"} ${EASE_OUT}`,
});

/** Pointer handlers that track whether a finger is down, for `pressStyle`. */
export const pressBind = (set: (down: boolean) => void) => ({
  onPointerDown: () => set(true),
  onPointerUp: () => set(false),
  onPointerLeave: () => set(false),
  onPointerCancel: () => set(false),
});
