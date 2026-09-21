import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getViews, recordView, sanitiseView } from "@/lib/views";

/**
 * The hero's view counter.
 *
 *   POST  counts this page load, then returns the current total
 *   GET   reads the total without counting
 *
 * The split matters: a page counts once when it loads and then polls with GET, so watching the
 * number never inflates it.
 *
 * This endpoint is public and unauthenticated, which is unavoidable for a counter that runs in the
 * browser, so the write path is treated as hostile:
 *
 *   - every field is narrowed by `sanitiseView` before it is recorded, and an `id` that is not a
 *     real registry piece is dropped rather than written;
 *   - writes are capped per IP by VIEWS_LIMITER;
 *   - nothing from the request ever reaches a SQL query. Views are written as Analytics Engine
 *     blobs through a structured API, and the only values interpolated into SQL are integers
 *     clamped to a fixed range (lib/views.ts).
 *
 * A refused write still returns the current total, because a rate-limited visitor should see the
 * number rather than an error; they are simply not counted.
 *
 * Nothing here is cached. The counter is the product, and a cached counter is a stopped clock.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** True when this IP has spent its allowance. Fails open: a missing binding never blocks. */
async function overLimit(req: Request): Promise<boolean> {
  try {
    const limiter = getCloudflareContext().env.VIEWS_LIMITER;
    if (!limiter) return false;
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await limiter.limit({ key: ip });
    return !success;
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ views: await getViews() }, { headers });
}

export async function POST(req: Request): Promise<Response> {
  if (!(await overLimit(req))) {
    const params = new URL(req.url).searchParams;
    recordView(sanitiseView({ path: params.get("path"), type: params.get("type"), id: params.get("id") }));
  }
  return Response.json({ views: await getViews() }, { headers });
}
