import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { LinkCells } from "@/components/sections/link-cells";
import { CTA } from "@/components/sections/cta";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { Cell, Divided, Index } from "@/components/ui/panel";
import { sectionTitle, sectionBody, stickyColumn } from "@/components/sections/feature-row";
import { BlockGrid } from "@/components/blocks/block-grid";
import { blockCards } from "@/lib/block-cards";
import { getBlocks, getProBlocks } from "@/lib/registry";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";

const free = getBlocks().length;
const paid = getProBlocks().length;

export const metadata: Metadata = pageMetadata({
  title: "SwiftUI Blocks: Whole Sections of an iOS Screen",
  description: `SwiftUI blocks for iOS: sign in, account settings, a stats overview, checkout and more, built from SwiftPieces components and wired. ${free} free, ${paid} in Pro.`,
  path: "/blocks",
});

/** How the library stacks up, smallest to largest. */
const ladder = [
  { title: "Components", body: "One designed interaction each: a field, a button, a chart, a sheet.", href: "/components", cta: "Browse components" },
  { title: "Blocks", body: "Components laid out, wired together and given their states: a whole section you drop into a screen.", href: "#blocks", cta: "You are here" },
  { title: "Screens and apps", body: "Finished screens, the flows through them and complete app templates, in SwiftPieces Pro.", href: pro.library, cta: "Explore Pro" },
];

export default function BlocksPage() {
  const cards = blockCards();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        url: `${site.url}/blocks`,
        name: "SwiftUI blocks",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: cards.length,
          itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: new URL(c.href, site.url).href })),
        },
      },
      breadcrumbJsonLd([["SwiftPieces", "/"], ["Blocks", "/blocks"]]),
    ],
  };
  return (
    <>
      <JsonLd data={structuredData} />
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end lg:gap-16">
            <Reveal>
              <SectionLabel className="mb-8">{`${free + paid} blocks · ${free} free`}</SectionLabel>
              <h1 className="p-title text-balance">Blocks</h1>
              <p className="p-body mt-5 max-w-xl text-pretty">
                Whole sections of an iOS screen, built from SwiftPieces components. The fields, buttons and charts are already laid out, wired together and given their states: drop a block into a screen and connect it to your app.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <LinkCells
                links={[
                  { title: "Browse in the docs", body: "The pieces inside, parameters, source and install for every block.", href: "/docs/blocks", badge: "New" },
                  { title: "Blocks in SwiftPieces Pro", body: "Themed by Pro's design system, in every Pro style.", href: `${pro.library}/blocks` },
                ]}
              />
            </Reveal>
          </div>
          <div id="blocks" className="mt-12 scroll-mt-28">
            <BlockGrid cards={cards} />
          </div>
        </Container>

        <Container className="mt-24 sm:mt-32">
          <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <Reveal as="div" className={stickyColumn}>
              <h2 className={sectionTitle}>Built from the pieces you already know</h2>
              <p className={cn("mt-4 max-w-xs", sectionBody)}>
                A block is plain SwiftUI in your project, like a piece. One command adds it with the components it is built from, and it is yours to change.
              </p>
              <p className="mt-6 text-[13px] text-muted">
                <code className="font-mono text-foreground">npx swiftpieces add SignInBlock</code>
              </p>
            </Reveal>
            <Reveal as="div">
              <Divided cols="sm:grid-cols-3">
                {ladder.map((step, i) => (
                  <Cell key={step.title}>
                    <Index n={i + 1} />
                    <p className="p-item mt-4">{step.title}</p>
                    <p className="p-body mt-2 text-[13px]">{step.body}</p>
                    {step.href.startsWith("#") ? (
                      <span className="mt-6 text-[12.5px] text-subtle">{step.cta}</span>
                    ) : (
                      <Link href={step.href} className="u-link mt-6 text-[12.5px] font-semibold text-foreground">{step.cta} →</Link>
                    )}
                  </Cell>
                ))}
              </Divided>
            </Reveal>
          </section>
        </Container>
      </section>
      <CTA />
    </>
  );
}
