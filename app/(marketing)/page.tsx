import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { LibrarySection } from "@/components/sections/library";
import { How } from "@/components/sections/how";
import { GetStarted } from "@/components/sections/get-started";

/** The hero shows the visit count, cached for an hour, so the page regenerates on the same beat. */
export const revalidate = 3600;

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
