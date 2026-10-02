import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/seo/json-ld";
import { AppDetail } from "@/components/apps/app-detail";
import { APPS_PATH, appBySlug, appPath, apps, isProApp } from "@/lib/apps";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";


type Params = { app: string };

export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return apps.map((a) => ({ app: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const a = appBySlug((await params).app);
  if (!a) return {};
  const name = a.name;
  return pageMetadata({
    title: `${name} Screens, Remixed in SwiftUI: ${a.pattern.title}`,
    description: `${name}'s App Store screenshots for reference, and an original Swift Pieces remix in SwiftUI: ${a.pattern.summary}`,
    path: appPath(a),
  });
}

/** One app as the App Store shows it (the developer's), with the way into what we recreated (ours). */
export default async function AppPage({ params }: { params: Promise<Params> }) {
  const a = appBySlug((await params).app);
  if (!a) notFound();
  const name = a.name;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebPage", url: `${site.url}${appPath(a)}`, name: `${name} screens`, isPartOf: { "@id": WEBSITE_ID } },
            breadcrumbJsonLd([["Swift Pieces", "/"], ["Apps", APPS_PATH], [name, appPath(a)]]),
          ],
        }}
      />
      {/* Everything fits in the window: who made it, its screenshots sized to what's left of the
          viewport, and the way into our recreation beside the App Store link. */}
      <section className="relative pt-8 pb-10 md:pt-10">
        <Container>
          <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted">
            <Link href={APPS_PATH} className="u-link">Apps</Link>
            <span aria-hidden className="mx-2">/</span>
            <span className="text-foreground">{name}</span>
          </nav>

          <div className="mt-6">
            <AppDetail app={a} />
          </div>
          <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-subtle">
            Screenshots and name © {a.store.developer}, shown for reference only; {a.store.developer} isn&apos;t affiliated with or endorsing Swift Pieces. {a.pattern.title} is an original Swift Pieces remix inspired by these screens, in our own colours, type and copy. {isProApp(a) ? "Remix it with Pro" : "Remix it freely"}; what you publish is yours to make your own.{" "}
            <a href="/terms#recreations" className="underline underline-offset-2 hover:text-foreground">Terms</a> ·{" "}
            <a href="/terms#removal" className="underline underline-offset-2 hover:text-foreground">Ask for removal</a>
          </p>
        </Container>
      </section>
    </>
  );
}
