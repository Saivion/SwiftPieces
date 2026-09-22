import { getStarCount } from "@/lib/github";
import { GitHubStar } from "@/components/layout/github-star";

/** The GitHub pill with its live count, resolved on the server. See `getStarCount` for how it stays populated. */
export async function GitHubStarLive({ className }: { className?: string }) {
  return <GitHubStar stars={await getStarCount()} className={className} />;
}
