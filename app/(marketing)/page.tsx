import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { Features } from "@/components/sections/features";
import { GetStarted } from "@/components/sections/get-started";
import { SponsorStrip } from "@/components/sections/sponsors";
import { getSponsorsFrom } from "@/lib/sponsors";
import { LibraryIntro } from "@/components/sections/library-intro";
import { WantMore } from "@/components/sections/want-more";
import { Questions } from "@/components/sections/questions";
import { band } from "@/components/sections/feature-row";
import { JsonLd } from "@/components/seo/json-ld";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { homeStructuredData } from "@/lib/structured-data";
import { libraryLead, site } from "@/lib/site";
import { homeFaqs } from "@/lib/faqs";
import { proCatalog } from "@/lib/pro-catalog";
import { getRegistryIndex } from "@/lib/registry";

export const metadata = pageMetadata({ title: site.title, description: site.description, path: "/", absoluteTitle: true });

const count = getRegistryIndex().length;
const questions = homeFaqs(count, proCatalog);

/** Who publishes the site, the free library (price 0, no rating), and the questions on the page. */
const structuredData = homeStructuredData(count, questions, libraryLead);

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
 * it is deliberately quiet: feature rows on a 1:2 grid (pieces, CLI, agents), the library directory,
 * a "Want more?" band of Pro screens and templates, the questions and one closing card. Pricing lives only on pro.swiftpieces.com.
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
      <WantMore />
      <Questions
        items={questions}
        spacing={band}
        body={<>The short answers are below. <Link href="/docs/choosing" className="text-foreground underline decoration-[var(--line-strong)] underline-offset-4">Choosing a SwiftUI library</Link> covers copy-paste, the commercial license, Liquid Glass, MCP, and Free vs Pro.</>}
      />
      <GetStarted />
    </>
  );
}
