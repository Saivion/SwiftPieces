import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageBackdrop } from "@/components/effects/page-backdrop";
import { GitHubStarLive } from "@/components/layout/github-star-live";

/**
 * The star count is rendered into the page, not streamed. It used to sit in a Suspense boundary
 * whose fallback was the bare "Star" pill, so uncached renders showed "Star" until GitHub answered.
 * `getStarCount` reads Next's data cache (refreshed every 5 minutes) and falls back to the last
 * good count, so it always has a number and only ever waits on GitHub when that cache is cold.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const desktop = "hidden sm:inline-flex";
  const mobile = "h-12 justify-center text-[15px]";
  return (
    <>
      <Navbar star={<GitHubStarLive className={desktop} />} starMobile={<GitHubStarLive className={mobile} />} />
      <main className="relative flex-1">
        <PageBackdrop />
        {children}
      </main>
      <Footer />
    </>
  );
}
