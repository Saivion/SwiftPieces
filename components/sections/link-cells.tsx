import Link from "next/link";
import { CornerTicks } from "@/components/sections/feature-row";
import { Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/cn";

/**
 * A header's ways onward as stacked framed cells, like the App Library header's Pro cell: a title,
 * one quiet line and an arrow, each cell its own link whose dashes take the accent on hover.
 */
export function LinkCells({ links, className }: { links: ReadonlyArray<{ title: string; body: string; href: string; badge?: "New" | "Beta" }>; className?: string }) {
  return (
    <ul className={cn("[--grid-line:var(--card-border)]", className)}>
      {links.map((l, i) => (
        <li key={l.href} className="frame-cell frame-hover">
          <CornerTicks corners={i === 0 ? ["tl", "tr", "bl", "br"] : ["bl", "br"]} />
          <Link href={l.href} className="group flex items-center gap-4 px-5 py-4 no-underline sm:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                {l.title}
                {l.badge ? <NewBadge>{l.badge}</NewBadge> : null}
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{l.body}</span>
            </span>
            <Arrow className="flex-none text-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
