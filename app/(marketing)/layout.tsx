import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { GitHubStarLive } from "@/components/layout/github-star-live";
import { freshCount } from "@/lib/registry";
import { BlocksAnnouncement } from "@/components/announce/blocks-announcement";
import { proBlocks } from "@/lib/blocks";
import { PromoBoot } from "@/components/announce/promo-boot";
import { promo } from "@/lib/promo";

/** The three blocks the announcement fans out, left to right, the middle one in front. */
const ANNOUNCED = ["sign-in", "stats-overview", "checkout"];

/**
 * The star pill paints the count from the page's build, so it never shows the bare "Star" while
 * GitHub answers, then moves to the live count from /api/stars (components/layout/github-star-live.tsx).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const desktop = "hidden sm:inline-flex";
  const mobile = "h-12 justify-center text-[14px]";
  return (
    <>
      {promo && <PromoBoot id={promo.id} endsAt={promo.endsAt} />}
      <Navbar promo={promo} fresh={freshCount()} star={<GitHubStarLive className={desktop} />} starMobile={<GitHubStarLive className={mobile} />} />
      <main className="relative flex-1">
        {children}
      </main>
      <Footer />
      <BlocksAnnouncement
        count={proBlocks.length}
        blocks={ANNOUNCED.flatMap((id) => proBlocks.filter((b) => b.id === id)).map((b) => ({ id: b.id, title: b.title, still: `/pro-blocks/${b.id}.webp` }))}
      />
    </>
  );
}
