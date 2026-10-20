import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A small pill: tinted accent, a quiet surface, or an outline. */
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "outline"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium",
        tone === "accent" && "bg-accent/12 text-accent",
        tone === "neutral" && "bg-surface text-muted",
        tone === "outline" && "text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The hero eyebrow: a pill on the tray colour with a live red dot (a soft halo around it). Children
 * after the first read as the quieter half, set off by a hairline (see LiveViews).
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[34px] items-center gap-2.5 rounded-full border border-line bg-surface pr-3.5 pl-3 text-[13px] font-medium text-foreground", className)}>
      <span className="relative flex size-[7px]">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" data-motion />
        <span className="relative inline-flex size-[7px] rounded-full bg-accent shadow-[0_0_0_3px_rgb(255_0_0/0.2)]" />
      </span>
      {children}
    </span>
  );
}
