import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { CTA } from "@/components/sections/cta";
import { getRegistryIndex } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

// Category filters (?category=glass) are views of this one page, so they share its canonical URL.
export const metadata: Metadata = pageMetadata({
  title: "Free SwiftUI Components",
  description: "Every free Swift Pieces component with a live preview: controls, inputs, cards, lists, navigation, sheets, feedback, motion, data, AI and Liquid Glass.",
  path: "/components",
});

export default function ComponentsPage() {
  const items = getRegistryIndex();
  return (
    <>
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
        <Container>
          <SectionHeader
            label={`${items.length} free pieces`}
            size="h1"
            title="The Library"
            description="Single-file SwiftUI components with live previews. Filter by category, open a piece for its parameters, source and install commands."
            action={{ label: "Browse in the docs", href: "/docs/components" }}
          />
          <div className="mt-14">
            <ShowcaseGrid items={items} />
          </div>
        </Container>
      </section>
      <CTA />
    </>
  );
}
