import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { Features } from "@/components/sections/features";
import { GetStarted } from "@/components/sections/get-started";
import { SponsorStrip } from "@/components/sections/sponsors";
import { getSponsorsFrom } from "@/lib/sponsors";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({ title: site.title, description: site.description, path: "/", absoluteTitle: true });

/**
 * Who publishes the site and what it is called, for search results and AI answers. Only facts the
 * page shows: the name in the header, the logo, and the GitHub and X profiles linked in the footer.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${site.url}/#website`, name: site.name, alternateName: "SwiftPieces", url: site.url, publisher: { "@id": `${site.url}/#organization` } },
    { "@type": "Organization", "@id": `${site.url}/#organization`, name: site.name, url: site.url, logo: `${site.url}/logo.png`, sameAs: [site.github, site.twitter] },
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
      <GetStarted />
    </>
  );
}
