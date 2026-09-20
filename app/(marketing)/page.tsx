import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { LibrarySection } from "@/components/sections/library";
import { How } from "@/components/sections/how";
import { GetStarted } from "@/components/sections/get-started";

/**
 * The hero shows the visit count, but this page is prerendered during the Cloudflare build, where
 * Worker secrets do not exist: that first render always has no count. Only a re-render inside the
 * Worker can produce one. At an hour, and with every deploy reseeding the cache, a page deployed
 * more than once an hour would never reach that re-render, so the count would never appear.
 *
 * A minute costs almost nothing. The Cloudflare API is still called at most hourly, because
 * lib/visits.ts caches the value itself; this only controls how soon the HTML picks it up.
 */
export const revalidate = 60;

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
