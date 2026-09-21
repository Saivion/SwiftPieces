import { getRecentVisits } from "@/lib/visits";

/**
 * The live visit count for the hero.
 *
 * The count used to be rendered into the page, which meant it could only change when the page
 * itself was rebuilt: the homepage revalidates every 15 minutes, and the count behind it was cached
 * for an hour. It also meant a fresh deploy shipped HTML with no count at all, because the build
 * runs without Worker secrets, and nothing corrected that until the next revalidation.
 *
 * Reading it from here fixes both. The page stays static and cacheable, the number arrives just
 * after first paint, and it keeps up on its own. Throughput is not a concern: `lib/visits.ts` holds
 * a fetched count for 20 seconds, so Cloudflare's API sees roughly three calls a minute regardless
 * of how many people are polling.
 *
 * Never cached: the whole point is that this is the fresh answer.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const visits = await getRecentVisits();
  return Response.json({ visits }, { headers: { "Cache-Control": "no-store" } });
}
