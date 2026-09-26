import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { CategoryDirectory } from "@/components/sections/category-directory";
import { RowLink, sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { getRegistryIndex } from "@/lib/registry";
import { categories } from "@/lib/categories";
import { hubs } from "@/lib/hubs";
import { cn } from "@/lib/cn";

/**
 * What the library is, in plain words, and a way into every part of it. The rows above show; this
 * one says: the definition search engines and answer engines quote, then one link per category and
 * topic hub. Same 1:2 grid and hairline rows as the questions below it.
 */
export function LibraryIntro() {
  const items = getRegistryIndex();
  return (
    <Container className="mt-8 sm:mt-16">
      <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20" aria-labelledby="library-intro">
        <Reveal as="div">
          <h2 id="library-intro" className={sectionTitle}>Free SwiftUI components for iOS</h2>
          <p className={cn("mt-4 max-w-sm", sectionBody)}>
            Swift Pieces is a free library of {items.length} SwiftUI components in {Object.keys(categories).length} categories. Each one is a single Swift file on Apple frameworks only, from iOS 17, that you copy, add with the CLI or install through your AI agent.
          </p>
          <RowLink href="/components" className="mt-8">Browse all {items.length}</RowLink>
        </Reveal>
        <Reveal as="div" className="-mt-4">
          <CategoryDirectory hubs={hubs} items={items} />
        </Reveal>
      </section>
    </Container>
  );
}
