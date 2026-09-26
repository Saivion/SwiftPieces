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
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

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
  // Canonical, share tags and a snippet-length description for every docs and piece page.
  return pageMetadata({
    title: page.data.title,
    description: page.data.description ?? site.description,
    path: page.url,
    image: item?.preview.poster,
  });
}
