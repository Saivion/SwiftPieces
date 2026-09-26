import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sanitizeEvents } from "@swiftpieces/builder";

/**
 * Playground product analytics: which steps people reach, and where beginners stop.
 *
 * One Analytics Engine data point per event: the event name as the index, the allow-listed
 * properties as blobs. No IP, no user agent, no identifiers, no project content are stored; the
 * shared sanitizer drops anything else. The per-IP budget in middleware.ts applies (API_LIMITER),
 * and the client batches, so a busy session costs a request every few seconds at most.
 *
 * Always answers 204: analytics must never surface an error in the builder.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  try {
    const text = await req.text();
    if (text.length <= 16 * 1024) {
      const events = sanitizeEvents(JSON.parse(text));
      const ae = getCloudflareContext().env.BUILDER_AE;
      for (const e of events) {
        const props = Object.entries(e.props).map(([k, v]) => `${k}=${v}`);
        ae?.writeDataPoint({ indexes: [e.name], blobs: [e.name, "free", ...props.slice(0, 8)], doubles: [1] });
      }
    }
  } catch {
    // Malformed bodies and missing bindings (local dev) are ignored.
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
