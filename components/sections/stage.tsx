"use client";
import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The landing's feature visuals stand on this: a Graphite panel (the inner surface of a tray; the
 * tray itself comes from FeatureRow / FeatureCard). `children` are clipped by the panel (a phone
 * rising out of its bottom edge); `overlay` sits above them, also inside the panel, for floating cards.
 *
 * The pointer tilts the scene a little: the stage writes --px and --py (-1 to 1) and `Parallax` layers
 * read them at their own depth. Touch, and Reduce Motion, keep everything still.
 */
export function Stage({ children, overlay, className }: { children?: ReactNode; overlay?: ReactNode; className?: string }) {
  return (
    <Tilt className={cn("panel", className)}>
      <div className="absolute inset-0 overflow-hidden">{children}</div>
      {overlay}
    </Tilt>
  );
}

/**
 * Tracks the pointer over its area and writes --px and --py (-1 to 1) for the `Parallax` layers inside
 * it. A stage is one; a visual with a card outside its stage (the agent row's chat) wraps both in one.
 */
export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    root.current?.style.setProperty("--px", "0");
    root.current?.style.setProperty("--py", "0");
  };

  return (
    <div ref={root} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {children}
    </div>
  );
}

/** A layer that moves with the pointer: `depth` in px at the stage's edge (negative moves against it). */
export function Parallax({ depth, children, className, style }: { depth: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn("transition-transform duration-500 ease-out motion-reduce:transition-none", className)}
      style={{ ...style, translate: `calc(var(--px, 0) * ${depth}px) calc(var(--py, 0) * ${depth}px)` }}
    >
      {children}
    </div>
  );
}
