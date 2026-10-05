import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { DocsAside, DocsAsideColumn } from "@/components/docs/docs-aside";
import { Sketch } from "@/components/changelog/sketch";
import { PointText, tintStyle, type ChangelogEntry } from "@/components/changelog/changelog-grid";
import { NewBadge } from "@/components/ui/new-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { getSponsorsFrom } from "@/lib/sponsors";
import { changelog, changelogEntry, changelogPath, changelogPlace } from "@/lib/changelog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return changelog.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props) {
  const entry = changelogEntry((await params).slug);
  if (!entry) notFound();
  return pageMetadata({ title: entry.title, description: entry.summary, path: changelogPath(entry.slug), type: "article" });
}

/** The page footer's card for a neighbouring update. */
const neighbour = (e: ChangelogEntry | null, description: string) => (e ? { name: e.title, description, url: changelogPath(e.slug) } : undefined);

/**
 * One update inside the docs: its drawing, the date, what shipped, and the newer and older updates in
 * the page footer, so the changelog reads straight through from any entry.
 */
export default async function ChangelogEntryPage({ params }: Props) {
  const entry = changelogEntry((await params).slug);
  if (!entry) notFound();
  const { seed, newer, older } = changelogPlace(entry.slug);
  return (
    <DocsPage
      tableOfContent={{ enabled: true, component: <DocsAsideColumn><DocsAside sponsors={await getSponsorsFrom("silver")} /></DocsAsideColumn> }}
      footer={{ items: { previous: neighbour(newer, "Newer update"), next: neighbour(older, "Older update") } }}
    >
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumbJsonLd([["SwiftPieces", "/"], ["Changelog", changelogPath()], [entry.title, changelogPath(entry.slug)]])] }} />
      <Link href={changelogPath()} className="group inline-flex w-fit items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground">
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4L3 8l4 4" /></svg>
        Changelog
      </Link>
      <DocsTitle>{entry.title}</DocsTitle>
      <DocsDescription className="mb-0">{entry.summary}</DocsDescription>
      <div className="not-prose">
        <p className="flex items-center gap-2 text-[12.5px] text-subtle">
          {newer ? null : <NewBadge>Latest</NewBadge>}
          {entry.date} · {entry.points.length} changes
        </p>
        <div className="changelog-tint mt-6 grid aspect-[21/9] place-items-center overflow-hidden rounded-[var(--radius)] border border-[var(--card-border)]" style={tintStyle(entry.tint)}>
          <Sketch kind={entry.visual} seed={seed} className="h-[48%] w-auto text-[#141414]" />
        </div>
      </div>
      <DocsBody className="mt-6">
        <h2>What shipped</h2>
        <ul>
          {entry.points.map((p) => (
            <li key={p}><PointText text={p} /></li>
          ))}
        </ul>
      </DocsBody>
    </DocsPage>
  );
}
