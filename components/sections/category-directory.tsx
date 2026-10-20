import Link from "next/link";
import type { ReactNode } from "react";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { hubBlurb, hubItems, hubPath, type Hub } from "@/lib/hubs";
import { cn } from "@/lib/cn";

/** A directory tile's surface (Graphite): the tray colour, soft corners, lifting to the raised layer on hover. */
export const dirTile = "group flex min-h-[64px] flex-col justify-between gap-4 rounded-[18px] bg-surface px-4 py-4 transition-colors duration-200 hover:bg-surface-3 sm:min-h-[148px] sm:rounded-[22px] sm:px-5 sm:pt-5 sm:pb-[22px]";
/** A tile's one-line description: on phones the tiles go two-up with just the name and count. */
export const dirBlurb = "hidden text-[13.5px] leading-[21px] text-pretty text-muted sm:block";

/**
 * Plain links to the hub pages, as tiles: a name and its count on top, one line on what is inside
 * below. Crawlable anchors on purpose. The library's filter pills are buttons, so without this search
 * engines would have no path from a page to its category hubs. `after` adds tiles of the caller's own
 * (the landing's Blocks and Browse all) at the end of the grid.
 */
export function CategoryDirectory({ hubs, items, current, className, after }: { hubs: Hub[]; items: RegistryIndexEntry[]; current?: string; className?: string; after?: ReactNode }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3", className)}>
      {hubs.map((hub) => {
        const count = hubItems(hub, items).length;
        const active = hub.slug === current;
        return (
          <li key={hub.slug} className="flex">
            <Link href={hubPath(hub.slug)} aria-current={active ? "page" : undefined} className={cn(dirTile, "w-full", active && "bg-surface-3")}>
              <span className="flex items-center justify-between gap-3 text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]">
                <span className="text-foreground">{hub.name}</span>
                <span className="text-[13px] font-medium tabular-nums text-subtle">{count}</span>
              </span>
              <span className={dirBlurb}>{hubBlurb(hub)}</span>
            </Link>
          </li>
        );
      })}
      {after}
    </ul>
  );
}
