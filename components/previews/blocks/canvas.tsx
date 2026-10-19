"use client";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * The canvas every block preview draws on. A block is a section of an iPhone screen, so it is drawn at phone width
 * (390 pt) on a 600 pt tall column, centred on the stage with the stage's own ground either side, the way the block
 * sits in an app. Sizes are points converted to `cqh` of the stage (PreviewFrame is a size container): 600 pt is the
 * stage's full height, so one point is one pixel on the docs page's 600 px square stage, and everything scales with
 * the grid card. Block previews follow the same rules as the pieces' previews: house palette (../palette), the
 * liquid glass twin (../piece-liquid), the motion roles (../piece-motion), semibold text, and the designed rest
 * state first, then the block's signature moment on a loop. Reduced motion holds the rest state.
 */

/** The block's width in points: an iPhone 16/17's. */
export const BLOCK_W = 390;
/** The canvas height in points. Design the block's preview to fit inside it. */
export const BLOCK_H = 600;

/** Points on the block canvas, as container units of the stage. */
export const bu = (pt: number) => `${((pt * 100) / BLOCK_H).toFixed(3)}cqh`;

/** The phone-width column the block is drawn in. `inset` is the block's side padding, 20 pt like an iOS screen's. */
export function BlockCanvas({ children, className, style, inset = 20 }: { children: ReactNode; className?: string; style?: CSSProperties; inset?: number }) {
  return (
    <div
      className={cn("absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col overflow-hidden", className)}
      style={{ width: bu(BLOCK_W), paddingInline: bu(inset), ...style }}
    >
      {children}
    </div>
  );
}
