import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { LinkCells } from "@/components/sections/link-cells";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { CTA } from "@/components/sections/cta";
import { CategoryDirectory } from "@/components/sections/category-directory";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { SectionHead } from "@/components/sections/feature-row";
import { pageLede, pageTitle } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import { getRegistryIndex, piecePath } from "@/lib/registry";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { hubs } from "@/lib/hubs";
import { pro, site } from "@/lib/site";
import { apps } from "@/lib/apps";

// The in-page filter pills are views of this one page, so they share its canonical URL; each
// category also has its own page (/components/cards), linked from the directory below the grid.
// No count in the title or description: it goes stale with every release, and what a searcher
// wants to know is what the pieces are and how they install.
export const metadata: Metadata = pageMetadata({
  title: "Free SwiftUI Components with Live Previews",
  description: "SwiftPieces' free SwiftUI components for iOS, with live previews: buttons, inputs, sheets, charts, AI chat and Liquid Glass. One Swift file each, by CLI or MCP.",
  path: "/components",
});

export default function ComponentsPage() {
  const items = getRegistryIndex();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        url: `${site.url}/components`,
        name: "Free SwiftUI components",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: items.length,
          itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.title, url: new URL(piecePath(item), site.url).href })),
        },
      },
      breadcrumbJsonLd([["SwiftPieces", "/"], ["Components", "/components"]]),
    ],
  };
  return (
    <>
      <JsonLd data={structuredData} />
      <section className="relative pt-16 pb-12 md:pt-24 sm:pb-[68px]">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end lg:gap-16">
            <Reveal>
              <SectionLabel className="mb-5">{`${items.length} free pieces`}</SectionLabel>
              <h1 className={pageTitle}>The Library</h1>
              <p className={cn("mt-5 max-w-[560px]", pageLede)}>Free, single-file SwiftUI components for iOS with live previews. Filter by category, open a piece for its parameters, source and install commands.</p>
            </Reveal>
            <Reveal delay={0.1}>
              <LinkCells
                links={[
                  { title: "Explore Pro and Games", body: "Screens, flows, templates, and ship-ready games.", href: pro.home, tone: "ember", seed: "components-explore-pro" },
                  { title: "Browse in the docs", body: "Parameters, source and install for every piece.", href: "/docs/components" },
                  { title: "Try out the new Playground", body: `New to SwiftUI? See them at work in ${apps.length} apps.`, href: "/apps", badge: "Beta" },
                ]}
              />
            </Reveal>
          </div>
          <div className="mt-12">
            <ShowcaseGrid items={items} />
          </div>
        </Container>

        {/* Every category and topic as its own page: crawlable links the filter pills cannot be. The
            landing's directory shape: the head row, then the tiles across the container. */}
        <Container className="mt-24 sm:mt-[136px]">
          <section>
            <SectionHead title="Browse by collection" body="Each category on its own page, with what the pieces are for and how to build the same thing yourself." />
            <Reveal>
              <CategoryDirectory hubs={hubs} items={items} className="lg:grid-cols-4" />
            </Reveal>
          </section>
        </Container>
      </section>
      <CTA />
    </>
  );
}
