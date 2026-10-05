import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageBackdrop } from "@/components/effects/page-backdrop";
import { GitHubStarLive } from "@/components/layout/github-star-live";
import { freshCount } from "@/lib/registry";

/**
 * The star pill paints the count from the page's build, so it never shows the bare "Star" while
 * GitHub answers, then moves to the live count from /api/stars (components/layout/github-star-live.tsx).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const desktop = "hidden sm:inline-flex";
  const mobile = "h-12 justify-center text-[14px]";
  return (
    <>
      <Navbar fresh={freshCount()} star={<GitHubStarLive className={desktop} />} starMobile={<GitHubStarLive className={mobile} />} />
      <main className="relative flex-1">
        <PageBackdrop />
        {children}
      </main>
      <Footer />
    </>
  );
}
