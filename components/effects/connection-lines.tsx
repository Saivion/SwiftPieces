import { cn } from "@/lib/cn";

/**
 * Architectural connector between blocks: a hairline with dot endpoints and a
 * pulse travelling down. Purely CSS. Height is the space it occupies.
 */
export function Connector({ height = 96, className, label }: { height?: number; className?: string; label?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto flex w-px flex-col items-center", className)} style={{ height }}>
      <span className="absolute -top-1 size-2 rounded-full bg-line-strong" />
      <span className="h-full w-px bg-line" />
      <span className="absolute inset-0 overflow-hidden">
        <span className="pulse-down block h-1/2 w-px bg-gradient-to-b from-transparent via-accent to-transparent" />
      </span>
      <span className="absolute -bottom-1 size-2 rounded-full bg-accent" />
      {label ? <span className="t-meta absolute top-1/2 left-4 -translate-y-1/2 whitespace-nowrap text-subtle">{label}</span> : null}
    </div>
  );
}

/** Corner markers that make a block read like a measured frame. */
export function CornerMarks({ className }: { className?: string }) {
  const c = "absolute size-2 border-line-strong";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <span className={cn(c, "top-0 left-0 border-t border-l")} />
      <span className={cn(c, "top-0 right-0 border-t border-r")} />
      <span className={cn(c, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(c, "bottom-0 right-0 border-b border-r")} />
    </div>
  );
}
