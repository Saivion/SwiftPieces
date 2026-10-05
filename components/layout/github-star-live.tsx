import { getStarCount } from "@/lib/github";
import { GitHubStarCount } from "@/components/layout/github-star-count";

/**
 * The GitHub pill with its live count. The page carries the count from its build so the pill is never
 * empty, and the browser then fetches the current one from /api/stars (refreshed every 5 minutes).
 * Reading it here with a cycle would make every page that shows the navbar re-render on that cycle.
 */
export async function GitHubStarLive({ className }: { className?: string }) {
  return <GitHubStarCount initial={await getStarCount(false)} className={className} />;
}
