import Link from "next/link";
import { Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/cn";

/**
 * A header's ways onward as stacked tiles (Graphite): a title, one quiet line and an arrow, each tile
 * its own link that lifts to the raised surface on hover.
 */
export function LinkCells({ links, className }: { links: ReadonlyArray<{ title: string; body: string; href: string; badge?: "New" | "Beta" }>; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="group flex items-center gap-4 rounded-[20px] bg-surface px-5 py-4 no-underline transition-colors duration-200 hover:bg-surface-3 sm:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14.5px] font-medium text-foreground">
                {l.title}
                {l.badge ? <NewBadge>{l.badge}</NewBadge> : null}
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted">{l.body}</span>
            </span>
            <span className="grid size-9 flex-none place-items-center rounded-full border border-[var(--line-strong)] text-foreground"><Arrow /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
