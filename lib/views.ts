import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRegistryIndex } from "@/lib/registry";

/**
 * Page views: the all-time total from Cloudflare Web Analytics, and per-piece reporting from
 * Workers Analytics Engine.
 *
 *   Web Analytics      the number the site shows. Its beacon (components/analytics.tsx) runs on every
 *                      page, counts real browsers and filters bots, and Cloudflare keeps six months of
 *                      it, which reaches back past launch. This is the same total as the dashboard.
 *   Analytics Engine   every view the hero reports, one data point with its path and piece, so
 *                      reporting can ask which screens and templates people look at (getTopPieces).
 *   KV                 the last total fetched, so polling never reaches Cloudflare's API: it is asked
 *                      at most once per `REFRESH_SECONDS` however many people are on the site.
 *
 * Until 2026-10-01 the total was our own Analytics Engine counter, folded into KV. It only counted
 * the home page, started from zero on 2026-09-20, and skipped views Analytics Engine had not made
 * queryable yet, so it read a small fraction of the real traffic.
 */

/** The last total fetched, and when, as JSON: `{ "views": 1234, "at": 1790000000000 }`. */
const TOTAL_KEY = "views:web-analytics";
/** How often the total is fetched, at most. Web Analytics itself lags a minute or two. */
const REFRESH_SECONDS = 120;
/** Held while a fetch is in flight, so concurrent reads do not all query. Expires on its own. */
const CLAIM_KEY = "views:claim";
/**
 * How far back the total reaches. Cloudflare keeps six months of Web Analytics, so for a site
 * younger than that (launched September 2026) this is everything. Past March 2027 it would become a
 * rolling six months; the total never goes down (see `getViews`), so it would hold still instead,
 * which is the signal to start persisting a running total.
 */
const LOOKBACK_DAYS = 180;
/** Every plan serves 30 days, so this is what an over-long window falls back to. */
const FALLBACK_DAYS = 30;

function env(): Partial<CloudflareEnv> {
  try {
    return getCloudflareContext().env;
  } catch {
    // Local `next dev`, forks, and the Cloudflare build itself have no bindings.
    return {};
  }
}

export type View = {
  /** The page that was viewed, e.g. "/" or "/docs/components". */
  path: string;
  /** "screen", "template", "component" — whatever kind of thing this page is about. */
  type?: string;
  /** The piece's registry id, when the page is about one. This is what reporting groups by. */
  id?: string;
};

/**
 * What a view may record. `type` is a closed set, `path` is length- and character-bounded, and `id`
 * must be a real registry piece, so per-piece reporting only ever contains real pieces and index
 * cardinality stays bounded. None of it reaches SQL: views are written as Analytics Engine blobs.
 */
const TYPES = new Set(["screen", "template", "component", "block", "docs", "page"]);
const PATH_OK = /^\/[A-Za-z0-9\-._~/]{0,120}$/;
/** `.` is legitimate in a slug; `..` never is. */
const TRAVERSAL = /\.\./;

let knownIds: Set<string> | null = null;

/**
 * Registry names and slugs, lowercased, built once per isolate.
 *
 * Deliberately the same static import the rest of the app uses. A lazy `require` here would throw
 * in this module's runtime and be swallowed, and the failure mode of that is silent and expensive:
 * every id rejected, and per-piece reporting quietly empty forever.
 */
function registryIds(): Set<string> {
  if (knownIds) return knownIds;
  const ids = new Set<string>();
  for (const entry of getRegistryIndex()) {
    if (entry.name) ids.add(entry.name.toLowerCase());
    if (entry.slug) ids.add(entry.slug.toLowerCase());
  }
  knownIds = ids;
  return ids;
}

/** Narrows a caller's claims to what we are willing to record. Never throws. */
export function sanitiseView(input: { path?: unknown; type?: unknown; id?: unknown }): View {
  const rawPath = typeof input.path === "string" ? input.path : "/";
  const path = PATH_OK.test(rawPath) && !TRAVERSAL.test(rawPath) ? rawPath : "/other";

  const rawType = typeof input.type === "string" ? input.type.toLowerCase() : "";
  const type = TYPES.has(rawType) ? rawType : undefined;

  const rawId = typeof input.id === "string" ? input.id.toLowerCase() : "";
  const id = rawId && registryIds().has(rawId) ? rawId : undefined;

  return { path, type, id };
}

/**
 * Counts one view. Returns immediately: `writeDataPoint` is fire-and-forget, so nothing about the
 * response waits on it, which is the point of using Analytics Engine for the write path.
 *
 * The index is the piece id where there is one, and the path otherwise. Analytics Engine samples
 * under load and guarantees an exact count per index, so indexing by the thing we report on keeps
 * per-piece numbers exact even when the overall firehose is sampled.
 */
export function recordView(view: View): void {
  const ae = env().VIEWS_AE;
  if (!ae) return;
  const index = (view.id ?? view.path).slice(0, 96); // Analytics Engine caps an index at 96 bytes.
  ae.writeDataPoint({
    blobs: [view.path, view.type ?? "", view.id ?? ""],
    doubles: [1],
    indexes: [index],
  });
}

// ─────────────────────────────────────────────────────────────── reading the total

type SqlRow = Record<string, string | number | null>;

/**
 * An integer in [min, max]. Never NaN, never Infinity, never a string.
 *
 * The only kind of value interpolated into the queries below.
 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** The characters the queries below contain. Anything else is refused before it is sent. */
const SAFE_QUERY = /^[A-Za-z0-9_ '(),*>=!.\n-]+$/;
/** A single hyphen is used (`NOW() - INTERVAL`); comment markers are not. */
const COMMENT = /--|\/\*/;

/** Runs one query against the Analytics Engine SQL API. Null on any failure; never throws. */
async function sql(query: string): Promise<SqlRow[] | null> {
  if (!SAFE_QUERY.test(query) || COMMENT.test(query)) {
    console.error("[views] refused a query containing unexpected characters");
    return null;
  }
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  if (!token || !account) return null;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: query,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[views] sql ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return ((await res.json()) as { data?: SqlRow[] }).data ?? [];
  } catch (error) {
    console.warn(`[views] sql failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Every site on the account, not one site: there is one site, and Cloudflare shows several 32-hex
 * ids per site of which only one is the tag this dataset keys on, so filtering by a plausible wrong
 * one silently counted nothing. `count` is page loads, which is what "Explored N times" means.
 */
const PAGEVIEWS = `query Views($account: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until }) {
        count
      }
    }
  }
}`;

type PageviewsResponse = {
  data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { count?: number }[] }[] } };
  errors?: { message?: string }[];
};

/**
 * Page views over one window, or why there are none. A window the account cannot serve is worth
 * retrying shorter (how far back a dataset reaches is set per plan); a bad token is not.
 */
async function queryPageviews(days: number): Promise<{ ok: true; views: number } | { ok: false; retryShorter: boolean }> {
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  if (!token || !account) return { ok: false, retryShorter: false };
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: PAGEVIEWS, variables: { account, since: since.toISOString(), until: until.toISOString() } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // 403 almost always means the token is missing Account Analytics: Read.
      console.warn(`[views] web analytics ${days}d: ${res.status} ${res.statusText}`);
      return { ok: false, retryShorter: false };
    }
    const json = (await res.json()) as PageviewsResponse;
    if (json.errors?.length) {
      console.warn(`[views] web analytics ${days}d: ${json.errors.map((e) => e.message ?? "error").join("; ").slice(0, 200)}`);
      return { ok: false, retryShorter: true };
    }
    const views = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0]?.count;
    if (typeof views !== "number" || !Number.isFinite(views)) return { ok: false, retryShorter: true };
    return { ok: true, views: Math.floor(views) };
  } catch (error) {
    console.warn(`[views] web analytics ${days}d failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, retryShorter: false };
  }
}

/** The longest window this account serves: six months, else 30 days. Null when neither answers. */
async function fetchPageviews(): Promise<number | null> {
  const first = await queryPageviews(LOOKBACK_DAYS);
  if (first.ok) return first.views;
  if (!first.retryShorter) return null;
  const fallback = await queryPageviews(FALLBACK_DAYS);
  return fallback.ok ? fallback.views : null;
}

function readTotal(raw: string | null): { views: number; at: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { views?: unknown; at?: unknown };
    return typeof v.views === "number" && typeof v.at === "number" ? { views: v.views, at: v.at } : null;
  } catch {
    return null;
  }
}

/**
 * The all-time page views, fetched at most every `REFRESH_SECONDS` and served from KV in between.
 * Null when unconfigured (forks, local `next dev`, the build itself) or before the first fetch lands.
 *
 * It never goes down. Web Analytics estimates older days from samples, so a fresh answer can come in
 * a few views under the last one, and a counter that ticks backwards reads as broken. A lower
 * answer keeps the higher number on screen; the real total soon passes it.
 *
 * The fetch is claimed first, so requests arriving together when the window expires make one call
 * between them. The claim is a KV write, not a lock: two isolates can still race in the same moment,
 * which for a decorative counter is the right amount of engineering.
 */
export async function getViews(): Promise<number | null> {
  const kv = env().VIEWS;
  if (!kv) return null;
  try {
    const last = readTotal(await kv.get(TOTAL_KEY));
    if (last && Date.now() - last.at < REFRESH_SECONDS * 1000) return last.views;
    if (await kv.get(CLAIM_KEY)) return last?.views ?? null; // Someone else is already fetching.
    await kv.put(CLAIM_KEY, "1", { expirationTtl: 60 });

    const fresh = await fetchPageviews();
    if (fresh === null) return last?.views ?? null; // Keep the number we have rather than losing it.
    const views = Math.max(fresh, last?.views ?? 0);
    await kv.put(TOTAL_KEY, JSON.stringify({ views, at: Date.now() }));
    return views;
  } catch (error) {
    console.warn(`[views] read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────── reporting

export type PieceViews = { id: string; views: number };

/**
 * The most-viewed pieces over a window, straight from Analytics Engine.
 *
 * This is the reason the write path carries the piece id: "how many times was each screen looked
 * at" is the question the library is actually interesting for, and it is one query rather than a
 * counter per piece. Grouped by index, so the counts are exact even under sampling.
 */
export async function getTopPieces(days = 30, limit = 50): Promise<PieceViews[] | null> {
  const rows = await sql(
    `SELECT index1 AS id, SUM(_sample_interval) AS views FROM swiftpieces_views
     WHERE timestamp > NOW() - INTERVAL '${clampInt(days, 1, 90, 30)}' DAY
       AND blob3 != ''
     GROUP BY id ORDER BY views DESC LIMIT ${clampInt(limit, 1, 200, 50)}`,
  );
  if (rows === null) return null;
  return rows.map((r) => ({ id: String(r.id ?? ""), views: num(r.views) })).filter((r) => r.id);
}
