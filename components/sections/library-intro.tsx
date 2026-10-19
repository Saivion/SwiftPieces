import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { CategoryDirectory, dirBlurb, dirTile } from "@/components/sections/category-directory";
import { SectionHead, band } from "@/components/sections/feature-row";
import { getBlocks, getRegistryIndex } from "@/lib/registry";
import { categories } from "@/lib/categories";
import { hubs } from "@/lib/hubs";
import { cn } from "@/lib/cn";

/**
 * What the library is, in plain words, and a way into every part of it. The rows above show; this
 * one says: the definition search engines and answer engines quote, then one tile per category and
 * topic hub, the blocks, and the whole library.
 */
export function LibraryIntro() {
  const items = getRegistryIndex();
  const blocks = getBlocks().length;
  return (
    <Container className={band}>
      <section aria-labelledby="library-intro">
        <SectionHead
          id="library-intro"
          title="Free SwiftUI components for iOS"
          body={`SwiftPieces is a free library of ${items.length} SwiftUI components in ${Object.keys(categories).length} categories. Each one is a single Swift file on Apple frameworks only, from iOS 17, that you copy, add with the CLI or install through your AI agent.`}
          action={{ label: `Browse all ${items.length}`, href: "/components" }}
        />
        <Reveal>
          <CategoryDirectory
            hubs={hubs}
            items={items}
            className="lg:grid-cols-4"
            after={
              <>
                <li className="flex">
                  <Link href="/blocks" className={cn(dirTile, "w-full")}>
                    <span className="flex items-center justify-between gap-3 text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]">
                      <span className="flex items-center gap-2">Blocks <NewBadge /></span>
                      <span className="text-[13px] font-medium tabular-nums text-subtle">{blocks}</span>
                    </span>
                    <span className={dirBlurb}>Whole sections of a screen, built from the pieces.</span>
                  </Link>
                </li>
                <li className="flex">
                  <Link href="/components" className={cn(dirTile, "w-full border border-[var(--line-strong)] bg-transparent")}>
                    <span className="flex items-center justify-between gap-3 text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]">Browse all {items.length}<Arrow /></span>
                    <span className={dirBlurb}>Every piece with a live preview, its source and one install command.</span>
                  </Link>
                </li>
              </>
            }
          />
        </Reveal>
      </section>
    </Container>
  );
}
