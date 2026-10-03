import { getViews } from "@/lib/views";

/**
 * The hero's view counter: the site's all-time page views, from PostHog (lib/views.ts).
 *
 * Read-only. PostHog counts the views themselves (lib/analytics.ts), so loading the page or polling
 * this never moves the number.
 *
 * Nothing here is cached. The counter is the product, and a cached counter is a stopped clock. The
 * total behind it is kept in KV, so polling never reaches PostHog.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ views: await getViews() }, { headers: { "Cache-Control": "no-store" } });
}
