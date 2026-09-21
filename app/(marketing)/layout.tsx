import { Suspense, type ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageBackdrop } from "@/components/effects/page-backdrop";
import { GitHubStar } from "@/components/layout/github-star";
import { GitHubStarLive } from "@/components/layout/github-star-live";

/**
 * The star count is streamed, not awaited. This layout used to `await getStarCount()` before
 * rendering anything, which put a GitHub API call with a 2.5s timeout in front of the first byte
 * of every marketing page. The pill ships immediately in its resting "Star" state and swaps to
 * the number when the call lands, so the document is never held and the layout never shifts:
 * both states occupy the same box.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const desktop = "hidden sm:inline-flex";
  const mobile = "h-12 justify-center text-[15px]";
  return (
    <>
      <Navbar
        star={
          <Suspense fallback={<GitHubStar stars={null} className={desktop} />}>
            <GitHubStarLive className={desktop} />
          </Suspense>
        }
        starMobile={
          <Suspense fallback={<GitHubStar stars={null} className={mobile} />}>
            <GitHubStarLive className={mobile} />
          </Suspense>
        }
      />
      <main className="relative flex-1">
        <PageBackdrop />
        {children}
      </main>
      <Footer />
    </>
  );
}
