import type { Metadata } from "next";
import { PlaygroundLoader } from "@/components/playground/playground-loader";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "SwiftUI Playground: Build an iPhone Screen in Your Browser",
  description: "Pick a SwiftUI component or a starting screen, customize it visually, see the SwiftUI it writes, and download a working Xcode project. No account, no Xcode knowledge needed.",
  path: "/playground",
});

/**
 * The page itself is static: a heading and the loader. Everything interactive, including reading
 * ?component= and ?template=, happens in the client chunk, so this route prerenders and caches.
 */
export default function PlaygroundPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name: "SwiftPieces Playground",
              url: `${site.url}/playground`,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Any (web browser)",
              isAccessibleForFree: true,
              isPartOf: { "@id": WEBSITE_ID },
              description: "Compose iPhone screens from SwiftUI components, see the generated SwiftUI, and export an Xcode project.",
            },
            breadcrumbJsonLd([["Swift Pieces", "/"], ["Playground", "/playground"]]),
          ],
        }}
      />
      <h1 className="sr-only">SwiftUI Playground</h1>
      <PlaygroundLoader />
    </>
  );
}
