import { DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { DocsAside, DocsAsideColumn } from "@/components/docs/docs-aside";
import { ChangelogGrid } from "@/components/changelog/changelog-grid";
import { LatestUpdate } from "@/components/changelog/whats-new";
import { JsonLd } from "@/components/seo/json-ld";
import { getSponsorsFrom } from "@/lib/sponsors";
import { changelog, changelogPath } from "@/lib/changelog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

const description = "What's new in the free SwiftPieces library: every piece, fix and API change, newest first.";

export const metadata = pageMetadata({ title: "Changelog", description, path: changelogPath() });

/**
 * The changelog inside the docs, where every docs page's What's new button leads: the latest update
 * large, then every earlier one as a card, newest first. Each card opens the update's own page
 * (changelog/[slug]). The data is lib/changelog.ts.
 */
export default async function ChangelogPage() {
  const [latest, ...earlier] = changelog;
  return (
    <DocsPage full tableOfContent={{ enabled: true, component: <DocsAsideColumn><DocsAside sponsors={await getSponsorsFrom("silver")} /></DocsAsideColumn> }}>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumbJsonLd([["SwiftPieces", "/"], ["Changelog", changelogPath()]])] }} />
      <DocsTitle>Changelog</DocsTitle>
      <DocsDescription>Every piece, fix and API change in the free library, newest first.</DocsDescription>
      <div className="not-prose mb-10 flex flex-col gap-14">
        {latest ? (
          <section>
            <Heading label="What's new" meta={latest.date} />
            <LatestUpdate entry={latest} />
          </section>
        ) : null}
        {earlier.length ? (
          <section>
            <Heading label="Earlier updates" meta={earlier.length} />
            <ChangelogGrid entries={earlier} seedFrom={2} />
          </section>
        ) : null}
      </div>
    </DocsPage>
  );
}

/** A section's name and a quiet note at the right, ruled off like the components index's groups. */
function Heading({ label, meta }: { label: string; meta: string | number }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
      <h2 className="text-[14px] font-medium text-foreground">{label}</h2>
      <span className="text-[11.5px] tabular-nums text-subtle">{meta}</span>
    </div>
  );
}
