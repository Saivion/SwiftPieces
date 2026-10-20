import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Arrow } from "@/components/ui/button";
import { PieceStage } from "@/components/sections/library-stage";
import { SectionHead, band } from "@/components/sections/feature-row";
import { getRegistryIndex, getRegistryItem } from "@/lib/registry";
import { piecePath } from "@/lib/registry-paths";
import { categories, categoryTitle } from "@/lib/categories";
import { cn } from "@/lib/cn";

/**
 * What the library is, in plain words, then a bento of hand-picked pieces running live and the way
 * into the rest. Not every category: the ticker above lists them all, and /components browses them.
 */
export function LibraryIntro() {
  const items = getRegistryIndex();
  return (
    <Container className={band}>
      <section aria-labelledby="library-intro">
        <SectionHead
          id="library-intro"
          title="Free SwiftUI components for iOS"
          body="Each one is a single Swift file on Apple frameworks only. Copy it, add it with the CLI or let your AI agent install it."
          action={{ label: `Browse all ${items.length}`, href: "/components" }}
        />
        <Reveal>
          {/* Four columns of three rows from lg: Swipe Deck large, Depth Carousel wide, the count last.
              Two columns on tablets; phones get four tiles in one column. */}
          <div className="tray grid grid-cols-1 gap-2 md:auto-rows-[260px] md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[250px_250px_250px]">
            <Tile name="SwipeDeck" className="h-[340px] md:col-span-2 md:row-span-2 md:h-auto" />
            <Tile name="CommitButton" className="h-[260px] md:h-auto" />
            <Tile name="MotionCard" className="hidden md:flex" />
            <Tile name="RingBreakdown" className="hidden md:flex" />
            <Tile name="StreamingReply" className="hidden md:flex" />
            <Tile name="DepthCarousel" bleed className="h-[260px] md:col-span-2 md:h-auto" />
            <Tile name="ScrollIsland" className="hidden md:flex" />
            <Link href="/components" className="group flex min-h-[200px] flex-col justify-between gap-6 rounded-[22px] bg-surface-2 p-5 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
              <span>
                <span className="block text-[46px] leading-none tracking-[-0.04em] text-foreground">{items.length}</span>
                <span className="mt-2 block text-[14px] leading-[22px] text-muted">components in {Object.keys(categories).length} categories, every one live with its source.</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-foreground">Browse all <Arrow /></span>
            </Link>
          </div>
        </Reveal>
      </section>
    </Container>
  );
}

/** A piece as a bento tile: live on a panel, its name and category under it, the whole tile its link. */
function Tile({ name, bleed, className }: { name: string; bleed?: boolean; className?: string }) {
  const item = getRegistryItem(name);
  if (!item) return null;
  return (
    <Link href={piecePath(item)} className={cn("group flex min-h-0 flex-col rounded-[22px] bg-surface-2 p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.05)]", className)}>
      <PieceStage name={item.name} fill={item.category === "backgrounds"} bleed={bleed} className="min-h-0 flex-1" />
      <span className="flex h-10 shrink-0 items-center justify-between gap-3 px-2.5 pt-0.5">
        <span className="truncate text-[14px] font-medium text-foreground">{item.title}</span>
        <span className="shrink-0 text-[12.5px] text-subtle">{categoryTitle(item.category)}</span>
      </span>
    </Link>
  );
}
