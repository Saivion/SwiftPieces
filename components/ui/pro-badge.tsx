import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * The Pro badge, as SwiftPieces Pro's navbar draws it (SwiftPiecesPro/components/layout/pro-badge.tsx
 * and crown.tsx): a grey chip like the navbar's buttons, the crown in brand red and the word in plain ink.
 * Styles: `.pro-badge` in app/globals.css, kept identical to Pro's. `size="sm"` fits a
 * menu row beside a title, where the New and Beta badges sit.
 */
export function ProBadge({ label = "Pro", size = "md", className }: { label?: string; size?: "sm" | "md"; className?: string }) {
  // One gradient id per badge. A shared id resolves to the first copy in the document, and when that
  // copy sits in a hidden subtree (the desktop menu, on phones) the gradient doesn't paint and the
  // crown goes blank everywhere.
  const ink = `pro-badge-ink-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <span className={cn("pro-badge inline-flex shrink-0 items-center rounded-[4px] font-semibold tracking-[-0.01em]", size === "sm" ? "h-5 gap-1 px-1.5 text-[10.5px]" : "h-8 gap-1.5 px-2.5 text-[12.5px]", className)}>
      <svg aria-hidden viewBox="0 0 24 24" className={cn("ai ai-tilt overflow-visible", size === "sm" ? "size-2.5" : "size-3.5")} fill={`url(#${ink})`}>
        {/* The crown's ink (--pb-ink-a/b, brand red in .pro-badge), under this badge's own id. */}
        <defs>
          <linearGradient id={ink} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--pb-ink-a)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--pb-ink-m)" }} />
            <stop offset="1" style={{ stopColor: "var(--pb-ink-b)" }} />
          </linearGradient>
        </defs>
        <path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z" />
        <rect x="5" y="19" width="14" height="2" rx="1" />
      </svg>
      <span>{label}</span>
    </span>
  );
}
