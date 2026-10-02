import { cn } from "@/lib/cn";

/** The App Library's plan marks: "Pro" on an app (or screen) that opens with Pro, "Free" on the rest. */
export function PlanChip({ pro, className }: { pro: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-[18px] flex-none items-center rounded-[4px] border border-[var(--card-border)] px-1.5 text-[10px] leading-none font-semibold", pro ? "text-foreground" : "text-muted", className)}>
      {pro ? <span className="pro-shimmer">Pro</span> : "Free"}
    </span>
  );
}

/** A small padlock, for screens that open with Pro. */
export function LockGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("size-3", className)}>
      <rect width="16" height="11" x="4" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
