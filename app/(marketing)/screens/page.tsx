import type { Metadata } from "next";
import Link from "next/link";
import { createRegistry, freeDefinitions, freeTemplates, newId, type ScreenNode } from "@swiftpieces/builder";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { CTA } from "@/components/sections/cta";
import { sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { lockedTemplates, playgroundTemplateHref, proBuilderUrl } from "@/lib/playground";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";

export const metadata: Metadata = pageMetadata({
  title: "SwiftUI Screen Templates: Login, Sign Up, Settings and More",
  description: "Free SwiftUI screen templates built from SwiftPieces components: login, sign up, onboarding, profile, settings and empty states. Open one in the playground, change it, and export an Xcode project.",
  path: "/screens",
});

const registry = createRegistry(freeDefinitions);

/** The component names a template uses, in order of first appearance. */
function componentsOf(root: ScreenNode): string[] {
  const seen = new Set<string>();
  const walk = (n: ScreenNode) => {
    const def = registry.get(n.component);
    if (def && !def.hidden && !["vstack", "hstack", "spacer", "divider"].includes(def.id)) seen.add(def.name);
    n.children?.forEach(walk);
  };
  walk(root);
  return [...seen];
}

export default function ScreensPage() {
  const items = freeTemplates.map((t) => ({ t, components: componentsOf(t.create(() => newId()).screens[0].root) }));
  const url = `${site.url}/screens`;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              url,
              name: "SwiftUI screen templates",
              isPartOf: { "@id": WEBSITE_ID },
              mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.map(({ t }, i) => ({ "@type": "ListItem", position: i + 1, name: `${t.name} screen`, url: `${site.url}${playgroundTemplateHref(t.id)}` })) },
            },
            breadcrumbJsonLd([["Swift Pieces", "/"], ["Screens", "/screens"]]),
          ],
        }}
      />
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
        <Container>
          <SectionHeader
            label={`${items.length} free screens`}
            size="h1"
            title="Start with a screen"
            description="Whole iPhone screens composed from SwiftPieces components. Open one in the playground, change the words, colors and parts, then take the SwiftUI, or a working Xcode project, with you."
            action={{ label: "Open the playground", href: "/playground" }}
          />
          <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ t, components }) => (
              <li key={t.id}>
                <Link href={playgroundTemplateHref(t.id)} className="card group flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--card-border)] p-6 transition-colors hover:border-[var(--card-border-hover)]">
                  <span className="t-meta text-subtle">{t.group}</span>
                  <span className="text-[19px] font-semibold tracking-[-0.015em]">{t.name}</span>
                  <span className="text-[14px] leading-6 text-muted">{t.description}</span>
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {components.map((c) => <span key={c} className="rounded-[4px] bg-surface-3 px-2 py-0.5 text-[11.5px] text-muted">{c}</span>)}
                  </span>
                  <span className="pt-2 text-[13px] font-semibold text-foreground">Open in playground <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>

        <Container className="mt-24 sm:mt-32">
          <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <Reveal as="div">
              <h2 className={sectionTitle}>More in Pro</h2>
              <p className={cn("mt-4 max-w-xs", sectionBody)}>Home, dashboard, paywall and checkout screens, multi-screen apps, and AI that composes a screen from a sentence.</p>
            </Reveal>
            <Reveal as="div" className="grid gap-2 sm:grid-cols-2">
              {lockedTemplates.map((t) => (
                <a key={t.id} href={proBuilderUrl} className="flex flex-col gap-1 rounded-[var(--radius)] bg-surface p-4 transition-colors hover:bg-surface-3">
                  <span className="text-[14px] font-semibold">{t.name} <span className="ml-1 rounded-[3px] bg-accent px-1.5 py-px text-[10px] font-bold text-accent-foreground">Pro</span></span>
                  <span className="text-[13px] text-muted">{t.description}</span>
                </a>
              ))}
            </Reveal>
          </section>
        </Container>
      </section>
      <CTA />
    </>
  );
}
