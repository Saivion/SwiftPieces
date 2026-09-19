import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ProSection } from "@/components/sections/pro";
import { CTA } from "@/components/sections/cta";
import { Button, Arrow } from "@/components/ui/button";
import { pro } from "@/lib/site";
import { proCountsLabel } from "@/lib/pro-catalog";

export const metadata: Metadata = {
  title: "Screens & App Templates",
  description: `Swift Pieces Pro has ${proCountsLabel}: production-ready SwiftUI screens and complete Xcode projects.`,
  alternates: { canonical: pro.library },
};

// Category edge state (Rev 3 §3.4 #3): these categories do not exist in Free. Send people to Pro, not a 404.
export default function BlocksPage() {
  return (
    <>
      <section className="relative pt-16 md:pt-24">
        <Container>
          <SectionHeader label="These live in Pro" title="The pieces to build the whole app." description={`The free library is a curated taste of Swift Pieces. The complete library, ${proCountsLabel}, is Swift Pieces Pro on pro.swiftpieces.com.`} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={pro.library} className="group">Browse the Pro library <Arrow /></Button>
            <Button href="/components" variant="ghost">Free components</Button>
          </div>
        </Container>
      </section>
      <ProSection heading={false} />
      <CTA />
    </>
  );
}
