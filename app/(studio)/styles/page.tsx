import "@swiftpieces/builder/builder.css";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { StyleStudioLoader } from "@/components/styles/style-studio-loader";
import { StudioShell } from "@/components/styles/studio-shell";
import { STYLES_PATH, styleApps, styleScreens } from "@/lib/styles";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

const description = "Make one style for every screen you build: color, light and dark, type, shape, buttons, spacing and motion, on live SwiftUI components. Open it in the Playground with one code, or take it to Xcode as Theme.swift.";

export const metadata: Metadata = pageMetadata({
  title: "Styles: Make One SwiftUI Theme for Every Screen",
  description,
  path: STYLES_PATH,
});

/**
 * Styles: the Playground's Style tab as a page of its own, the studio filling the whole window. A
 * style made here (colour, light and dark, type, shape, buttons, spacing, motion) is the same style
 * the Playground wears, carried by the same code, drawn by the same renderers. Static: the free
 * apps' screens are built at build time; the studio itself runs in the browser.
 */
export default async function StylesPage() {
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
      <StyleStudioLoader screens={screens} apps={apps}>
        <StudioShell apps={apps} />
      </StyleStudioLoader>
    </>
  );
}
