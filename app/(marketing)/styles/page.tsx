import "@swiftpieces/builder/builder.css";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/seo/json-ld";
import { StyleStudioLoader } from "@/components/styles/style-studio-loader";
import { StudioShell } from "@/components/styles/studio-shell";
import { StyleTravel } from "@/components/styles/style-travel";
import { STYLES_PATH, styleApps, styleScreens, styleTiles } from "@/lib/styles";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

const description = "Make one style for every screen you build: color, light and dark, type, shape, buttons, spacing and motion, on live SwiftUI components. Open it in the Playground with one code, or take it to Xcode as Theme.swift.";

export const metadata: Metadata = pageMetadata({
  title: "Styles: Make One SwiftUI Theme for Every Screen",
  description,
  path: STYLES_PATH,
});

/**
 * Styles: the Playground's Style tab as a page of its own, the studio first and in full view. A
 * style made here (colour, light and dark, type, shape, buttons, spacing, motion) is the same style
 * the Playground wears, carried by the same code, drawn by the same renderers. Below it, only where
 * a style goes. Static: the tiles and the free apps' screens are built
 * at build time; the studio itself runs in the browser.
 */
export default async function StylesPage() {
  const tiles = styleTiles();
  const screens = await styleScreens();
  const apps = styleApps();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebPage", url: `${site.url}${STYLES_PATH}`, name: "SwiftPieces Styles", description, isPartOf: { "@id": WEBSITE_ID } },
            breadcrumbJsonLd([["SwiftPieces", "/"], ["Styles", STYLES_PATH]]),
          ],
        }}
      />
      <section id="studio" className="pt-3 pb-3">
        <Container>
          <StyleStudioLoader tiles={tiles} screens={screens} apps={apps}>
            <StudioShell />
          </StyleStudioLoader>
        </Container>
      </section>
      <StyleTravel apps={apps} className="mt-20 mb-24 sm:mt-28 sm:mb-32" />
    </>
  );
}
