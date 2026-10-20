"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** How far down the page, in px, the row takes to settle from its fan into a straight line. */
const SETTLE_PX = 420;

/**
 * The hero's row of live pieces. It writes --p (0 at the top of the page, 1 once scrolled SETTLE_PX)
 * and each tile (.hero-tile, app/globals.css) reads it: at rest the row fans out in a shallow arc, and
 * scrolling draws the tiles up into one straight line. Reduce Motion keeps the fan still.
 */
export function HeroRow({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / SETTLE_PX));
      // Past the settle point the value stops changing, so the style is left alone while reading on.
      if (p === last) return;
      last = p;
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
