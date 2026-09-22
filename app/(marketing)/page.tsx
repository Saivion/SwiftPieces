import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { LibrarySection } from "@/components/sections/library";
import { How } from "@/components/sections/how";
import { GetStarted } from "@/components/sections/get-started";

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
 * The landing page does two things: show the free pieces, then hand people to Pro. The hero and
 * the footer are shared with pro.swiftpieces.com; the inventory ticker and the three ways in are
 * the only things between them. Pricing lives only on pro.swiftpieces.com; the page closes on the
 * library itself instead of an offer card.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <LibrarySection />
      <How />
      <GetStarted />
    </>
  );
}
