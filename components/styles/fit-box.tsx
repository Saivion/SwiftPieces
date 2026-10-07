"use client";
// Sizing for the studio's canvas, so every tile fills its cell of the grid at any window size:
// FitBox draws its content at an iPhone's width and scales it into the box (never up), and
// PhoneFit sizes a phone to the height it's given.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PHONE_W } from "@swiftpieces/builder/react";

/** The narrowest layout, in points (a small iPhone's width): narrower, components wrap and cramp. */
const MIN_WIDTH = 320;

/**
 * The content is laid out `width` points wide (an iPhone's 390 unless asked) and scaled to the box's
 * width, so every tile shows its components at a phone's proportions, all at the same scale. A narrow box keeps the
 * scale from dropping under `minScale` by laying out narrower instead (never under 320 points); a
 * wide one lays out at its own width at 1:1. With `fill`, the content is at least as tall as the box
 * (in its own points), so a column with spacers, or a piece that grows, takes the whole tile.
 * Whatever is still too tall is scaled down to fit, laid out wider so it keeps the box's width. A transform, so scaling never changes the
 * layout it measures: no feedback.
 */
export function FitBox({ children, width: target = PHONE_W, minScale = 0.66, fill = false }: { children: ReactNode; width?: number; minScale?: number; fill?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ k: 1, width: 0, height: 0 });
  useLayoutEffect(() => {
    const b = box.current;
    const el = inner.current;
    if (!b || !el) return;
    const measure = () => {
      const w = b.clientWidth;
      const h = b.clientHeight;
      if (w <= 0 || h <= 0) return;
      let width = Math.round(Math.max(w, Math.min(target, Math.max(MIN_WIDTH, w / minScale))));
      let height = fill ? Math.floor(h / Math.min(1, w / width)) : 0;
      // Laid out at the new size and scaled right here, before the browser paints (ResizeObserver
      // runs between layout and paint), so new content never shows a frame at the old scale. React
      // then renders the same values.
      el.style.width = `${width}px`;
      el.style.minHeight = height ? `${height}px` : "";
      let k = Math.min(1, w / width, h / Math.max(1, el.offsetHeight));
      // Too tall to fit at that width: lay it out wider at the smaller scale it needs, so it still
      // spans the box (a card keeps the tile's width instead of narrowing as it shrinks).
      if (k < Math.min(1, w / width) - 0.01) {
        width = Math.round(w / k);
        height = fill ? Math.floor(h / k) : 0;
        el.style.width = `${width}px`;
        el.style.minHeight = height ? `${height}px` : "";
        k = Math.min(1, w / width, h / Math.max(1, el.offsetHeight));
      }
      el.style.transform = `translate(-50%, -50%) scale(${k})`;
      setFit((f) => (Math.abs(f.k - k) > 0.004 || f.width !== width || f.height !== height ? { k, width, height } : f));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [target, minScale, fill]);
  return (
    <div ref={box} className="relative size-full overflow-hidden">
      <div
        ref={inner}
        className="absolute top-1/2 left-1/2 flex origin-center flex-col"
        style={{ width: fit.width || "100%", minHeight: fit.height || undefined, transform: `translate(-50%, -50%) scale(${fit.k})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** A phone as tall as its box allows (and no wider than it), for a screen in an iPhone frame. */
export function PhoneFit({ ratio, children }: { ratio: number; children: (width: number) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(Math.min(b.clientWidth, b.clientHeight * ratio))));
    ro.observe(b);
    return () => ro.disconnect();
  }, [ratio]);
  return (
    <div ref={box} className="flex size-full min-h-0 min-w-0 items-center justify-center">
      {width > 0 ? children(width) : null}
    </div>
  );
}
