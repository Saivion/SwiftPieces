import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { GitHubStarLive } from "@/components/layout/github-star-live";

/**
 * The playground's frame: the site's own navigation, then the builder filling the rest of the
 * window. No footer and no page backdrop, since the builder is an app surface, not a page.
 */
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar star={<GitHubStarLive className="hidden sm:inline-flex" />} starMobile={<GitHubStarLive className="h-12 justify-center text-[14px]" />} />
      <main className="relative flex-1">{children}</main>
    </>
  );
}
