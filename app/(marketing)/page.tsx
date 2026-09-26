import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { Features } from "@/components/sections/features";
import { GetStarted } from "@/components/sections/get-started";
import { SponsorStrip } from "@/components/sections/sponsors";
import { getSponsorsFrom } from "@/lib/sponsors";
import { LibraryIntro } from "@/components/sections/library-intro";
import { Questions } from "@/components/sections/questions";
import { JsonLd } from "@/components/seo/json-ld";
import { faqJsonLd, ORG_ID, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";
import { homeFaqs } from "@/lib/faqs";
import { proCatalog } from "@/lib/pro-catalog";
import { getRegistryIndex } from "@/lib/registry";

export const metadata = pageMetadata({ title: site.title, description: site.description, path: "/", absoluteTitle: true });

const count = getRegistryIndex().length;
const questions = homeFaqs(count, proCatalog);

/**
 * Who publishes the site, what the library is and the questions the page answers, for search
 * results and AI answers. Only facts the page shows: the name, the logo, the GitHub and X profiles
 * in the footer, the library's license and baseline, and the questions below. No ratings: the
 * site has none to report.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": WEBSITE_ID, name: site.name, alternateName: "SwiftPieces", url: site.url, description: site.description, publisher: { "@id": ORG_ID } },
    { "@type": "Organization", "@id": ORG_ID, name: site.name, alternateName: "SwiftPieces", url: site.url, logo: `${site.url}/logo.png`, sameAs: [site.github, site.twitter] },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${site.url}/#library`,
      name: `${site.name} free SwiftUI component library`,
      description: `${count} free SwiftUI components for iOS: one self-contained Swift file each, Apple frameworks only, installed by copy-paste, the swiftpieces CLI or an MCP server.`,
      url: `${site.url}/components`,
      codeRepository: site.github,
      programmingLanguage: { "@type": "ComputerLanguage", name: "Swift" },
      runtimePlatform: "iOS 17+",
      license: `${site.url}/license`,
      isAccessibleForFree: true,
      publisher: { "@id": ORG_ID },
    },
    faqJsonLd(questions),
  ],
};

/**
 * The hero shows the visit count, which only a render inside the Worker can produce: pages are
 * prerendered during the Cloudflare build, where Worker secrets do not exist.
 *
 * This was 60 seconds so that count appeared quickly. The cost was hidden and large: Next emits
 * the remaining window as `s-maxage`, so the homepage was advertising a cache lifetime counting
 * down from 60 and production was measured serving `s-maxage=2`. Nothing could hold it. Five
 * minutes gives the edge something worth caching while still picking the count up promptly, and
 * the count itself is streamed in a Suspense boundary so a slow call never holds the document.
 */
export const revalidate = 300;

/**
 * The landing page does two things: show the free pieces, then hand people to Pro. Below the hero
 * it is deliberately quiet: four feature rows on a 1:2 grid (pieces, CLI, agents, Pro) and one
 * closing card. Pricing lives only on pro.swiftpieces.com.
 */
export default async function HomePage() {
  // Gold sponsors only; the strip renders nothing until there is one.
  const gold = await getSponsorsFrom("gold");
  return (
    <>
      <JsonLd data={structuredData} />
      <Hero />
      <Ticker />
      <SponsorStrip sponsors={gold} />
      <Features />
      <LibraryIntro />
      <Questions items={questions} />
      <GetStarted />
    </>
  );
}
