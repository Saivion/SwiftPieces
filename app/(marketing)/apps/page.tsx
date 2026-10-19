import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { NewBadge } from "@/components/ui/new-badge";
import { Button, Arrow } from "@/components/ui/button";
import { heroTitle } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/effects/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { AppGrid, type AppCard } from "@/components/apps/app-grid";
import { ScreenDirectory } from "@/components/apps/screen-directory";
import { RemixNotice } from "@/components/apps/remix-notice";
import { RemixShowcase } from "@/components/apps/remix-showcase";
import { APPS_PATH, appCategories, appPath, apps, cdn, categoryId, isProApp } from "@/lib/apps";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "App Library: iOS App Screens, Remixed in SwiftUI",
  description: `${apps.length} App Store apps and the interaction each one is known for, remixed as original SwiftUI designs you can try in the browser and make your own. Remix ${apps.filter((a) => !isProApp(a)).length} of them free, or all ${apps.length} with Pro.`,
  path: APPS_PATH,
});

/**
 * The library: a header with one App Store screenshot beside our remix of it (and the way into the
 * Pro apps), App Store apps as the App Store shows them, each with the screens we recreated and
 * marked Free or Pro, then every remixed screen browsed by kind and what these remixes are. Static:
 * built from reviewed data at build time.
 */
export default function AppsPage() {
  const cards: AppCard[] = apps.map((a) => ({
    slug: a.slug,
    href: appPath(a),
    name: a.name,
    developer: a.store.developer,
    category: a.store.category,
    categoryId: categoryId(a.store.category),
    icon: cdn(a.store.icon, 120),
    shots: a.store.screenshots.map((s) => cdn(s.url, 300)),
    aspect: `${a.store.screenshots[0].width} / ${a.store.screenshots[0].height}`,
    pattern: a.pattern.title,
    patternSummary: a.pattern.summary,
    pro: isProApp(a),
  }));
  const free = apps.filter((a) => !isProApp(a));
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              url: `${site.url}${APPS_PATH}`,
              name: "SwiftPieces App Library",
              isPartOf: { "@id": WEBSITE_ID },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: apps.length,
                itemListElement: apps.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: `${a.pattern.title}, a remix inspired by ${a.name}`, url: `${site.url}${appPath(a)}` })),
              },
            },
            breadcrumbJsonLd([["SwiftPieces", "/"], ["Apps", APPS_PATH]]),
          ],
        }}
      />
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32">
        <Container>
          <Reveal>
            <RemixShowcase
              intro={
                <>
                  {/* The App Library and its Playground are in beta, as the navbar's Apps entry says. */}
                  <NewBadge>Beta</NewBadge>
                  <h1 className={cn("mt-5", heroTitle)}>App Library</h1>
                  <p className="mt-[22px] max-w-[560px] text-[16.5px] leading-[27px] text-pretty text-muted sm:text-[18px] sm:leading-[30px]">
                    Apps from the App Store as inspiration, and the screens each one does well, remixed from scratch in SwiftUI in the SwiftPieces style. Try them in the browser, see what makes them work, then make them your own. Remix {free.length} of them free, or all {apps.length} with Pro.
                  </p>
                  <div className="mt-[34px] flex flex-wrap items-center gap-2.5">
                    <Button href="#apps">
                      Browse {apps.length} apps <Arrow />
                    </Button>
                    {/* The quiet second way in: words and an arrow that nudges, as on the landing. */}
                    <a href="#screens-title" className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
                      Browse by screen
                      <Arrow />
                    </a>
                  </div>
                </>
              }
            />
          </Reveal>
          <div id="apps" className="mt-24 scroll-mt-24 sm:mt-[136px]">
            <AppGrid cards={cards} categories={appCategories} />
          </div>
          <ScreenDirectory />
          <RemixNotice className="mt-24 sm:mt-[136px]" />
          <p className="mt-8 max-w-2xl text-[12.5px] leading-[20px] text-subtle">
            App names, icons and screenshots come from the App Store and belong to their developers, who aren&apos;t affiliated with or endorsing SwiftPieces. They&apos;re shown for reference only. Every remix is an original SwiftPieces design in our own colours, type and artwork, and what you build from it is yours to clear.{" "}
            <a href="/terms#third-party-apps" className="text-foreground underline underline-offset-2">Terms</a> ·{" "}
            <a href="/terms#removal" className="text-foreground underline underline-offset-2">Ask for an app to be removed</a>
          </p>
        </Container>
      </section>
    </>
  );
}
