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
 * Fields are narrowed by `sanitiseView` before they are recorded, and writes have a per-IP budget
 * (VIEWS_LIMITER). A write over budget still returns the current total; it is just not counted.
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
