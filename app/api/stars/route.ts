import { getStarCount } from "@/lib/github";

/**
 * The navbar's live star count (components/layout/github-star-live.tsx).
 *
 * Served from here rather than rendered into pages: a page that reads a 5-minute count becomes a
 * 5-minute ISR page, and the navbar sits on every page, so every docs and marketing page was being
 * re-rendered every five minutes just to move this number. Now the pages stay static and only this
 * small route refreshes. GitHub is asked at most every 5 minutes (Next's data cache, lib/github.ts),
 * and the browser keeps the answer for the same window, so moving between pages doesn't ask again.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ stars: await getStarCount(300) }, { headers: { "Cache-Control": "public, max-age=300" } });
}
