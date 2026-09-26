import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { Questions } from "@/components/sections/questions";
import { CategoryDirectory } from "@/components/sections/category-directory";
import { CTA } from "@/components/sections/cta";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { getRegistryIndex, piecePath } from "@/lib/registry";
import { getHub, hubItems, hubPath, hubs, type Hub } from "@/lib/hubs";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ slug: string }> };

// Every hub is known at build time; anything else is a 404, not a render.
export const dynamicParams = false;

export function generateStaticParams() {
  return hubs.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const hub = getHub((await props.params).slug);
  if (!hub) return {};
  return pageMetadata({ title: hub.title, description: hub.description, path: hubPath(hub.slug) });
}

function structuredData(hub: Hub, url: string) {
  const items = hubItems(hub, getRegistryIndex());
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: hub.h1,
        description: hub.description,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: items.length,
          itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.title, url: new URL(piecePath(item), site.url).href })),
        },
      },
      breadcrumbJsonLd([["Swift Pieces", "/"], ["Components", "/components"], [hub.name, hubPath(hub.slug)]]),
      faqJsonLd(hub.faqs),
    ],
  };
}

/**
 * A hub: the landing page for one category ("SwiftUI cards") or one cross-category topic
 * ("SwiftUI animations"). Built from the Library page's own parts, top to bottom: the heading and
 * the grid of live previews, then what the pieces are for, the questions people search, and links
 * to the neighbouring hubs, so every hub is one hop from every other.
 */
export default async function HubPage(props: Props) {
  const hub = getHub((await props.params).slug);
  if (!hub) notFound();
  const all = getRegistryIndex();
  const items = hubItems(hub, all);
  const related = hub.related.map(getHub).filter((h): h is Hub => Boolean(h));
  const url = new URL(hubPath(hub.slug), site.url).href;
  const count = `${items.length} free ${items.length === 1 ? "piece" : "pieces"}`;

  return (
    <>
      <JsonLd data={structuredData(hub, url)} />
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
        <Container>
          <SectionHeader label={`${hub.name} · ${count}`} size="h1" title={hub.h1} description={hub.intro} action={{ label: "All components", href: "/components" }} />
          <div className="mt-14">
            <ShowcaseGrid items={items} filters={false} />
          </div>
        </Container>

        {/* What the pieces are for: the same 1:2 grid as the questions below it. */}
        <Container className="mt-24 sm:mt-32">
          <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <Reveal as="div">
              <h2 className={sectionTitle}>About these pieces</h2>
              <p className={cn("mt-4 max-w-xs", sectionBody)}>One self-contained Swift file each, Apple frameworks only, from iOS 17.</p>
            </Reveal>
            <Reveal as="div" className="flex flex-col gap-5">
              {hub.about.map((p) => (
                <p key={p.slice(0, 32)} className="max-w-[64ch] text-[15px] leading-[26px] text-pretty text-muted">{p}</p>
              ))}
              {hub.guides.length ? (
                <p className="text-[14px] leading-6 text-muted">
                  Learn the technique:{" "}
                  {hub.guides.map(([label, href], i) => (
                    <span key={href}>
                      {i ? ", " : ""}
                      <Link href={href} className="text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white">{label}</Link>
                    </span>
                  ))}
                  .
                </p>
              ) : null}
            </Reveal>
          </section>
        </Container>

        <Questions items={hub.faqs} body={<>How the pieces work, and how to build the same thing yourself. Every piece&apos;s page has its full notes.</>} />

        <Container className="mt-24 sm:mt-32">
          <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <Reveal as="div">
              <h2 className={sectionTitle}>Keep browsing</h2>
              <p className={cn("mt-4 max-w-xs", sectionBody)}>Nearby collections, then every category in the library.</p>
            </Reveal>
            <Reveal as="div" className="-mt-4">
              <CategoryDirectory hubs={[...related, ...hubs.filter((h) => h.slug !== hub.slug && !hub.related.includes(h.slug))]} items={all} />
            </Reveal>
          </section>
        </Container>
      </section>
      <CTA />
    </>
  );
}
