import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Entrance animations, in CSS and on the server.
 *
 * These were Motion client components. That put `style="opacity:0"` into the server HTML, so
 * nothing they wrapped could be painted until the bundle had downloaded, parsed and hydrated:
 * the hero paragraph measured `opacity: 0` four seconds after load in production, and it was the
 * page's LCP element. The animation now runs from CSS classes defined in app/globals.css, so the
 * markup is server-rendered, the content is painted at first paint, and no JavaScript is involved.
 *
 * Two modes, picked with `priority`:
 *
 * - `priority` (above the fold): a time-based rise that plays at first paint. Transform only,
 *   never opacity, because an element at opacity 0 is not an LCP candidate.
 * - default (below the fold): a scroll-driven fade and rise using `animation-timeline: view()`.
 *   No observer, no main-thread work, and content already on screen is painted immediately.
 *
 * `delay` and `y` keep their original meaning and units, so call sites did not change.
 */

type Tag = "div" | "section" | "li" | "article";

type Props = {
  children: ReactNode;
  className?: string;
  /** Seconds. Only applies to `priority`; scroll-driven reveals are staged by scroll position. */
  delay?: number;
  /** Pixels risen from. */
  y?: number;
  /** Render above the fold: animate at first paint instead of on scroll. */
  priority?: boolean;
  as?: Tag;
  /** Accepted for call-site compatibility. Scroll-driven reveals always play once per entry. */
  once?: boolean;
};

function vars(delay: number, y: number): CSSProperties {
  const style: Record<string, string> = { "--sp-y": `${y}px` };
  if (delay) style["--sp-delay"] = `${delay}s`;
  return style as CSSProperties;
}

export function Reveal({ children, className, delay = 0, y = 18, priority = false, as: Tag = "div" }: Props) {
  return (
    <Tag className={cn(priority ? "sp-enter" : "sp-reveal", className)} style={vars(delay, y)}>
      {children}
    </Tag>
  );
}

/**
 * Staggers direct children. The stagger is a scroll offset rather than a delay: each child enters
 * as it reaches its own point in the viewport, which is what the Motion version approximated.
 */
export function RevealGroup({ children, className, stagger = 0.07 }: { children: ReactNode; className?: string; stagger?: number }) {
  // Motion's stagger was in seconds. Scroll-driven ranges are percentages of the viewport, so the
  // value is mapped onto a comparable spread: a wider range for a longer stagger.
  const range = Math.min(60, Math.round(18 + stagger * 220));
  return (
    <div className={cn("sp-reveal-group", className)} style={{ "--sp-range": `${range}%`, "--sp-y": "16px" } as CSSProperties}>
      {children}
    </div>
  );
}

/** A child of RevealGroup. The group drives the animation, so this only carries layout. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
