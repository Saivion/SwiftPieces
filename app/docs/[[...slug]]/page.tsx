import type { Metadata } from "next";
import { NewBadge } from "@/components/ui/new-badge";
import { notFound, redirect } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx";
import { PieceHeader } from "@/components/docs/piece-header";
import { PieceInstall } from "@/components/docs/piece-install";
import { getRegistryItem, getRegistryIndex, piecePath } from "@/lib/registry";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { PieceRelated } from "@/components/docs/piece-related";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, ORG_ID, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { pieceDescription, piecePhrase, pieceTitle } from "@/lib/piece-seo";
import { categoryHubPath, getHub } from "@/lib/hubs";
import { categories } from "@/lib/categories";
import { site } from "@/lib/site";
import type { RegistryIndexEntry } from "@/lib/registry-schema";

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
  const isIndex = Boolean(page.data.index);

  return (
    <DocsPage toc={item || isIndex ? [] : page.data.toc} full={isIndex}>
      <JsonLd data={structuredData(page.url, page.data.title, page.data.description, page.slugs, item)} />
      <DocsTitle className={item?.isNew ? "flex items-center gap-3" : undefined}>
        {page.data.title}
        {item?.isNew ? <NewBadge className="h-5 rounded-[6px] px-2 text-[11px]" /> : null}
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      {item ? <PieceHeader item={item} /> : null}
      {isIndex ? <div className="not-prose mb-10"><ShowcaseGrid items={getRegistryIndex()} /></div> : null}
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        {item ? <PieceInstall item={item} /> : null}
        {item ? <PieceRelated item={item} /> : null}
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
  guides: ["Guides", "/docs/guides"],
};

/**
 * Structured data for a docs page. A piece is SoftwareSourceCode (what it is, in which language,
 * for which platform, under which license, where the source lives); a guide or reference page is a
 * TechArticle. Both carry the breadcrumb trail up through the category hub or docs section.
 */
function structuredData(path: string, title: string, description: string | undefined, slugs: string[], item: RegistryIndexEntry | null) {
  const url = new URL(path, site.url).href;
  const trail: [string, string][] = [["Swift Pieces", "/"]];
  if (item) {
    const hub = getHub(categories[item.category].slug);
    trail.push(["Components", "/components"], [hub?.name ?? categories[item.category].title, categoryHubPath(item.category)], [item.title, path]);
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
          publisher: { "@id": ORG_ID },
        },
        breadcrumbJsonLd(trail),
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
    ],
  };
}
