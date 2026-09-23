import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { Features } from "@/components/sections/features";
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
 * The landing page does two things: show the free pieces, then hand people to Pro. Below the hero
 * it is deliberately quiet: four feature rows on a 1:2 grid (pieces, CLI, agents, Pro) and one
 * closing card. Pricing lives only on pro.swiftpieces.com.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <Features />
      <GetStarted />
    </>
  );
}
