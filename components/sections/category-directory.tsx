import Link from "next/link";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { hubBlurb, hubItems, hubPath, type Hub } from "@/lib/hubs";
import { cn } from "@/lib/cn";

/**
 * Plain links to the hub pages, drawn as the same hairline rows as the questions: a name, a count
 * and one line on what is inside. Crawlable anchors on purpose. The library's filter pills are
 * buttons, so without this search engines would have no path from a page to its category hubs.
 */
export function CategoryDirectory({ hubs, items, current, className }: { hubs: Hub[]; items: RegistryIndexEntry[]; current?: string; className?: string }) {
  return (
    <ul className={cn("grid gap-x-10 sm:grid-cols-2", className)}>
      {hubs.map((hub) => {
        const count = hubItems(hub, items).length;
        const active = hub.slug === current;
        return (
          <li key={hub.slug} className="border-b border-[var(--line)]">
            <Link href={hubPath(hub.slug)} aria-current={active ? "page" : undefined} className="group flex items-start justify-between gap-6 py-4">
              <span className="min-w-0">
                <span className={cn("block text-[15px] leading-6 transition-colors", active ? "text-accent" : "text-foreground")}>
                  <span className="u-link">{hub.name}</span>
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-pretty text-muted">{hubBlurb(hub)}</span>
              </span>
              <span className="mt-0.5 shrink-0 text-[11.5px] tabular-nums text-muted">{count}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
