import type { Metadata } from "next";
import { NewBadge } from "@/components/ui/new-badge";
import { notFound, redirect } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx";
import { PieceInstall } from "@/components/docs/piece-install";
import { getBlock, getProBlock, getRegistryItem, getRegistryIndex, piecePath } from "@/lib/registry";
import { BlockGrid } from "@/components/blocks/block-grid";
import { blockCards } from "@/lib/block-cards";
import { blockCategories } from "@/lib/blocks";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { ProCardGrid } from "@/components/docs/pro-cards";
import { DocsAside, DocsAsideColumn } from "@/components/docs/docs-aside";
import { PieceRelated } from "@/components/docs/piece-related";
import { JsonLd } from "@/components/seo/json-ld";
import { choosingFaqs } from "@/lib/choosing";
import { breadcrumbJsonLd, faqJsonLd, ORG_ID, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { pieceDescription, piecePhrase, pieceTitle } from "@/lib/piece-seo";
import { pieceBreadcrumbTrail, SOFTWARE_ID } from "@/lib/structured-data";
import { site } from "@/lib/site";
import type { BlockIndexEntry, RegistryIndexEntry } from "@/lib/registry-schema";

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page(props: Props) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    const legacy = params.slug?.length === 2 ? getRegistryItem(params.slug[1]) : null;
    if (legacy) redirect(piecePath(legacy));
    notFound();
  }

  const MDX = page.data.body;
  const item = page.data.piece ? getRegistryItem(page.data.piece) : null;
  const block = page.data.block ? getBlock(page.data.block) : null;
  const proBlock = page.data.proBlock ? getProBlock(page.data.proBlock) : null;
  const isBlocksIndex = Boolean(page.data.blocks);
  const isIndex = Boolean(page.data.index);
  const proType = page.data.pro;
  // Grids and Pro blocks' pages (a few lines and a still) take the full width, without "On this page".
  const wide = isIndex || isBlocksIndex || Boolean(proType) || Boolean(proBlock);
  const hasToc = !wide && page.data.toc.length > 0;
  const fresh = item?.isNew || block?.isNew || proBlock?.isNew;
  // A block page ends with its neighbours: the same category first, then the rest.
  const related = block || proBlock ? blockCards().filter((c) => c.name !== (block ?? proBlock)!.name).sort((a, b) => Number(b.category === (block ?? proBlock)!.category) - Number(a.category === (block ?? proBlock)!.category)) : [];
  const aside = <DocsAside />;

  return (
    <DocsPage
      toc={hasToc ? page.data.toc : []}
      full={wide}
      // Pro sits at the foot of the right column on every docs page: under "On this page" where there
      // is one, on its own where there is not (the full-width grids). What's new is in the sidebar.
      tableOfContent={hasToc ? { footer: aside } : { enabled: true, component: <DocsAsideColumn>{aside}</DocsAsideColumn> }}
    >
      <JsonLd data={structuredData(page.url, page.data.title, page.data.description, page.slugs, item, block)} />
      <DocsTitle className={fresh ? "flex items-center gap-3" : undefined}>
        {page.data.title}
        {fresh ? <NewBadge /> : null}
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {/* The page body opens on Preview and Code, with the install line right under them (components/docs/showcase.tsx), then the facts. */}
      {isIndex ? <div className="not-prose mb-10"><ShowcaseGrid items={getRegistryIndex()} /></div> : null}
      {isBlocksIndex ? <div className="not-prose mb-10"><BlockGrid cards={blockCards()} narrow /></div> : null}
      {proType ? <ProCardGrid type={proType} /> : null}
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        {item ? <PieceInstall item={item} /> : null}
        {block ? <PieceInstall item={block} /> : null}
        {item ? <PieceRelated item={item} /> : null}
        {related.length ? (
          <section className="not-prose mt-16" aria-labelledby="related-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="related-heading" className="t-h3">More patterns</h2>
              <a href="/patterns" className="u-link text-[13px] font-semibold text-foreground">All patterns →</a>
            </div>
            <div className="mt-5"><BlockGrid cards={related} filters={false} limit={3} narrow /></div>
          </section>
        ) : null}
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const item = page.data.piece ? getRegistryItem(page.data.piece) : null;
  // Canonical, share tags and a snippet-length description for every docs and piece page. A piece
  // page is titled with what people search for ("Swipe Deck: SwiftUI Swipeable Card Stack").
  // A pattern is titled as the section it is ("Sign In: SwiftUI Sign In Pattern").
  if (page.data.block || page.data.proBlock) {
    const title = `${page.data.title}: SwiftUI ${page.data.title} Pattern${page.data.proBlock ? " (Pro)" : ""}`;
    return pageMetadata({ title, description: page.data.description ?? site.description, path: page.url, type: "article" });
  }
  if (item) {
    const { title, absolute } = pieceTitle(item);
    return pageMetadata({ title, absoluteTitle: absolute, description: pieceDescription(item), path: page.url, image: item.preview.poster, type: "article" });
  }
  return pageMetadata({
    title: page.data.title,
    description: page.data.description ?? site.description,
    path: page.url,
    type: page.data.index ? "website" : "article",
  });
}

/** Docs section names for breadcrumbs, by first path segment. */
const SECTIONS: Record<string, [string, string]> = {
  components: ["Components", "/components"],
  patterns: ["Patterns", "/patterns"],
  guides: ["Guides", "/docs/guides"],
};

/**
 * Structured data for a docs page. A piece is SoftwareSourceCode (what it is, in which language,
 * for which platform, under which license, where the source lives); a guide or reference page is a
 * TechArticle. Both carry the breadcrumb trail up through the category hub or docs section.
 */
function structuredData(path: string, title: string, description: string | undefined, slugs: string[], item: RegistryIndexEntry | null, block: BlockIndexEntry | null = null) {
  const url = new URL(path, site.url).href;
  const trail: [string, string][] = [["SwiftPieces", "/"]];
  if (block) {
    trail.push(["Patterns", "/patterns"], [blockCategories[block.category].title, "/patterns"], [block.title, path]);
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareSourceCode",
          "@id": `${url}#code`,
          name: `${block.title}: SwiftUI ${block.title} Pattern`,
          alternateName: block.name,
          description: block.description,
          url,
          programmingLanguage: { "@type": "ComputerLanguage", name: "Swift" },
          runtimePlatform: `iOS ${block.minIOSVersion}+`,
          version: block.version,
          keywords: ["SwiftUI", "block", ...block.tags].join(", "),
          codeRepository: `${site.github}/blob/main/${block.files[0].path}`,
          license: `${site.url}/license`,
          isAccessibleForFree: true,
          isPartOf: { "@id": WEBSITE_ID },
          publisher: { "@id": ORG_ID },
        },
        breadcrumbJsonLd(trail),
      ],
    };
  }
  if (item) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareSourceCode",
          "@id": `${url}#code`,
          name: `${item.title}: SwiftUI ${piecePhrase(item)}`,
          alternateName: item.name,
          description: item.description,
          url,
          ...(item.preview.poster ? { image: item.preview.poster } : {}),
          programmingLanguage: { "@type": "ComputerLanguage", name: "Swift" },
          runtimePlatform: `iOS ${item.minIOSVersion}+`,
          version: item.version,
          keywords: ["SwiftUI", ...item.tags].join(", "),
          codeRepository: `${site.github}/blob/main/${item.files[0].path}`,
          license: `${site.url}/license`,
          isAccessibleForFree: true,
          isPartOf: { "@id": WEBSITE_ID },
          targetProduct: { "@id": SOFTWARE_ID },
          publisher: { "@id": ORG_ID },
        },
        breadcrumbJsonLd(pieceBreadcrumbTrail(item, path)),
      ],
    };
  }
  const section = SECTIONS[slugs[0] ?? ""];
  if (section && slugs.length > 1) trail.push(section);
  trail.push([title, path]);
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "TechArticle", "@id": `${url}#article`, headline: title, ...(description ? { description } : {}), url, inLanguage: "en", isPartOf: { "@id": WEBSITE_ID }, author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID } },
      breadcrumbJsonLd(trail),
      ...(slugs.join("/") === "choosing" ? [faqJsonLd(choosingFaqs)] : []),
    ],
  };
}
