import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { LinkCells } from "@/components/sections/link-cells";
import { CTA } from "@/components/sections/cta";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { Cell, Divided, Index } from "@/components/ui/panel";
import { RowLink, sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { Statement, statementGap, statementSection } from "@/components/ui/statement";
import { BlockGrid } from "@/components/blocks/block-grid";
import { blockCards } from "@/lib/block-cards";
import { getBlocks, getProBlocks } from "@/lib/registry";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";
import { SEO_PATTERNS_ON_PRO } from "@/lib/seo-flags";

const free = getBlocks().length;
const paid = getProBlocks().length;

export const metadata: Metadata = pageMetadata({
  title: "SwiftUI Patterns: Whole Sections of an iOS Screen",
  description: `SwiftUI patterns for iOS: AI chat and composers, nav and tab bars, lists, settings, forms, sheets, sign-in and checkout, laid out, wired and ready to drop into any app.${free ? ` ${free} free, ${paid} in Pro.` : ` ${paid} patterns in SwiftPieces Pro.`}`,
  path: "/patterns",
});

/** How the library stacks up, smallest to largest. */
const ladder = [
  { title: "Components", body: "One designed interaction each: a field, a button, a chart, a sheet.", href: "/components", cta: "Browse components" },
  { title: "Patterns", body: "A whole section of a screen, laid out, wired and given its states, that you drop into any app. In SwiftPieces Pro.", href: "#patterns", cta: "You are here" },
  { title: "Screens and apps", body: "Finished screens, the flows through them and complete app templates, in SwiftPieces Pro.", href: pro.library, cta: "Explore Pro" },
];

export default function PatternsPage() {
  const cards = blockCards();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        url: `${site.url}/patterns`,
        name: "SwiftUI patterns",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: cards.length,
          itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: new URL(c.href, site.url).href })),
        },
      },
      breadcrumbJsonLd([["SwiftPieces", "/"], ["Patterns", "/patterns"]]),
    ],
  };
  return (
    <>
      <JsonLd data={structuredData} />
      <section className={cn("relative pb-12 sm:pb-[68px]", statementSection)}>
        <Container>
          <Reveal>
            <Statement quiet="Laid out, wired and given their states: drop one in and connect it with a closure.">{`${free + paid} patterns, whole sections of an iOS screen.`}</Statement>
          </Reveal>
          <div id="patterns" className={cn("scroll-mt-28", statementGap)}>
            <BlockGrid cards={cards} />
          </div>
        </Container>

        {/* Where patterns sit in the library: the head row with the install command where a section's
            link would be, then the three sizes as tiles. */}
        <Container className="mt-24 sm:mt-[136px]">
          <section>
            <Reveal className="mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
              <div className="max-w-[640px]">
                <h2 className={sectionTitle}>One file, dropped into any app</h2>
                <p className={cn("mt-4 max-w-[540px]", sectionBody)}>
                  A pattern is one plain SwiftUI file in your project. One command adds it with Pro&apos;s design system, it re-skins with your theme, and it is yours to change.
                </p>
              </div>
              <code className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-surface px-4 font-mono text-[12.5px] text-foreground">
                <span aria-hidden className="text-subtle">$</span>npx swiftpieces add SignInBlock
              </code>
            </Reveal>
            <Reveal>
              <Divided cols="md:grid-cols-3">
                {ladder.map((step, i) => {
                  const here = step.href.startsWith("#");
                  return (
                    <Cell key={step.title} raised={here} className="min-h-[230px]">
                      <Index n={i + 1} />
                      <p className="mt-10 text-[19px] font-medium tracking-[-0.02em] sm:mt-14">{step.title}</p>
                      <p className="mt-2.5 text-[14.5px] leading-[23px] text-pretty text-muted">{step.body}</p>
                      <div className="mt-auto pt-6">
                        {here ? <span className="text-[14.5px] font-medium text-subtle">{step.cta}</span> : <RowLink href={step.href}>{step.cta}</RowLink>}
                      </div>
                    </Cell>
                  );
                })}
              </Divided>
            </Reveal>
          </section>
        </Container>
      </section>
      <CTA />
    </>
  );
}
