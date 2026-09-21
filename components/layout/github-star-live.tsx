import { getStarCount } from "@/lib/github";
import { GitHubStar } from "@/components/layout/github-star";

/**
 * The GitHub pill with its live count, resolved on the server.
 *
 * Kept separate from `GitHubStar` so the marketing layout can stream it inside a Suspense
 * boundary. The layout used to `await getStarCount()` directly, which put a GitHub API call with
 * a 2.5s timeout in front of the first byte of every marketing page. The pill renders immediately
 * in its "Star" state and the number arrives when it arrives.
 */
export async function GitHubStarLive({ className }: { className?: string }) {
  return <GitHubStar stars={await getStarCount()} className={className} />;
}
