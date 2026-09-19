import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "outline"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold tracking-wide",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "outline" && "text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small status pill with a live dot, used as the hero eyebrow. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-2 rounded-full bg-surface-2 pl-2.5 pr-3.5 text-[13px] font-medium text-foreground", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" data-motion />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      {children}
    </span>
  );
}
