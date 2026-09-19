import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { CTA } from "@/components/sections/cta";
import { getRegistryIndex } from "@/lib/registry";

export const metadata: Metadata = { title: "Components", description: "Every free Swift Pieces component: buttons, inputs, cards, lists, navigation, overlays, loading, feedback, motion, charts, AI, text, backgrounds, effects and Liquid Glass." };

export default function ComponentsPage() {
  const items = getRegistryIndex();
  return (
    <>
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
        <Container>
          <SectionHeader
            label={`${items.length} free pieces`}
            title="The library."
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
