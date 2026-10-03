import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { site } from "@/lib/site";

/**
 * The site's all-time page views: "Explored N times" in the hero, and the reach line on /sponsors.
 *
 *   PostHog   counts the views (lib/analytics.ts). The total is read from its query API with a
 *             personal API key, so it is exact: nothing is sampled, every view counts once.
 *   KV        the running total and when it was read, so polling never reaches PostHog: it is asked
 *             at most once per `REFRESH_SECONDS`, however many people are on the site.
 *
 * The total is `base` plus the views PostHog has counted since `since`. PostHog keeps a year of events
 * on the free plan, so the window never gets near that: once it is a month old, its finished days are
 * added to `base` and `since` moves up to yesterday.
 *
 * Until 2026-10-02 the count came from Cloudflare Web Analytics, which recorded one view in ten and
 * served at most 93 days. Its last total is the starting `base`, so the number carries on from there.
 */

/** The running total, as JSON: `{ base, since, views, at }`, times in epoch milliseconds. */
const TOTAL_KEY = "views:posthog";
/** Cloudflare Web Analytics' last total, `{ views, at }`: where the count starts. Only ever read. */
const START_KEY = "views:web-analytics";
/** How often PostHog is asked, at most. */
const REFRESH_SECONDS = 120;
/** Held while a read is in flight, so concurrent requests do not all query. Expires on its own. */
const CLAIM_KEY = "views:claim";
/** How old the window gets before its finished days fold into `base`. */
const FOLD_DAYS = 30;
const DAY = 86_400_000;

type Total = { base: number; since: number; views: number; at: number };

function env(): Partial<CloudflareEnv> {
  try {
    return getCloudflareContext().env;
  } catch {
    // Local `next dev`, forks, and the Cloudflare build itself have no bindings.
    return {};
  }
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parse(raw: string | null): Record<string, unknown> | null {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The total so far. Before the first PostHog read lands, Cloudflare's last total, then nothing. */
async function load(kv: KVNamespace): Promise<Total> {
  const t = parse(await kv.get(TOTAL_KEY));
  if (t && finite(t.base) && finite(t.since) && finite(t.views) && finite(t.at)) return { base: t.base, since: t.since, views: t.views, at: t.at };
  const start = parse(await kv.get(START_KEY));
  if (start && finite(start.views) && finite(start.at)) return { base: start.views, since: start.at, views: start.views, at: 0 };
  // A fresh deploy: everything PostHog has.
  return { base: 0, since: 0, views: 0, at: 0 };
}

/** "2026-10-02 22:41:07": the form PostHog's SQL reads. Always passed with 'UTC', since a bare one is read in the project's timezone. */
const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/**
 * This site's page views from `from` (inclusive) to `to` (exclusive, or now), or null on any failure.
 *
 * Asked with `force_blocking`: PostHog answers API queries from its cache by default, and a cached
 * count is a stopped one. Only views on this site's own host count, so local and preview traffic in
 * the same project never does.
 */
async function countViews(from: number, to?: number): Promise<number | null> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID;
  // The ingestion host names the region: https://us.i.posthog.com is queried at https://us.posthog.com.
  const ingest = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !project || !ingest) {
    console.warn("[views] not configured: needs POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID and NEXT_PUBLIC_POSTHOG_HOST");
    return null;
  }
  const domain = new URL(site.url).hostname;
  // The only values that reach the query. Refused unless they are plainly what they claim to be.
  if (!/^\d+$/.test(project) || !/^[a-z0-9.-]+$/.test(domain)) return null;
  const query = [
    "SELECT count() FROM events WHERE event = '$pageview'",
    `AND properties.$host = '${domain}'`,
    `AND timestamp >= toDateTime('${sqlTime(from)}', 'UTC')`,
    ...(to === undefined ? [] : [`AND timestamp < toDateTime('${sqlTime(to)}', 'UTC')`]),
  ].join(" ");
  try {
    const res = await fetch(`${ingest.replace(".i.posthog.com", ".posthog.com")}/api/projects/${project}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query }, refresh: "force_blocking", name: "explored_count" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // 401 or 403: a wrong key, or one without Query: Read. 404: the project id is not this key's.
      console.warn(`[views] posthog ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const views = Number(((await res.json()) as { results?: unknown[][] }).results?.[0]?.[0]);
    return Number.isFinite(views) ? views : null;
  } catch (error) {
    console.warn(`[views] posthog failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The total brought up to date, first folding finished days into `base` once the window is a month old. */
async function refresh(total: Total): Promise<Total | null> {
  let { base, since } = total;
  const now = Date.now();
  // The start of yesterday, UTC: everything before it has arrived.
  const settled = Math.floor(now / DAY) * DAY - DAY;
  if (now - since > FOLD_DAYS * DAY && settled > since) {
    const folded = await countViews(since, settled);
    if (folded === null) return null;
    base += folded;
    since = settled;
  }
  const recent = await countViews(since);
  if (recent === null) return null;
  return { base, since, views: Math.max(base + recent, total.views), at: now };
}

/**
 * The all-time page views, read from PostHog at most every `REFRESH_SECONDS` and served from KV in
 * between. Null when unconfigured (forks, local `next dev`, the build itself) or before there is a
 * number to show.
 *
 * It never goes down, so a counter never reads as broken by ticking backwards.
 *
 * The read is claimed first, so requests arriving together when the window expires make one call
 * between them. The claim is a KV write, not a lock: two isolates can still race in the same moment,
 * which for a decorative counter is the right amount of engineering.
 */
export async function getViews(): Promise<number | null> {
  const kv = env().VIEWS;
  if (!kv) return null;
  // Zero hides the line rather than reading "Explored 0 times".
  const shown = (t: Total) => (t.views > 0 ? t.views : null);
  try {
    const total = await load(kv);
    if (Date.now() - total.at < REFRESH_SECONDS * 1000) return shown(total);
    if (await kv.get(CLAIM_KEY)) return shown(total); // Someone else is already reading.
    await kv.put(CLAIM_KEY, "1", { expirationTtl: 60 });

    const next = await refresh(total);
    if (!next) return shown(total); // Keep the number we have rather than losing it.
    await kv.put(TOTAL_KEY, JSON.stringify(next));
    return shown(next);
  } catch (error) {
    console.warn(`[views] read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
