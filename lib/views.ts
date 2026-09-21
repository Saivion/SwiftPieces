import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRegistryIndex } from "@/lib/registry";

/**
 * Page views: counted into Workers Analytics Engine, totalled in KV.
 *
 * Three pieces, each doing the thing it is actually good at:
 *
 *   Analytics Engine   every view, one data point. `writeDataPoint` does not await and does not
 *                      block the response, and there is no per-key write ceiling, so this scales
 *                      past anything a counter in KV could take.
 *   KV                 the durable running total, plus the timestamp we have counted up to.
 *   SQL API            reporting: which screens and templates people actually look at.
 *
 * KV is not used as the counter itself. A counter in KV is a read then a write, so simultaneous
 * views collapse into one, and KV allows a single write per second to a key. Analytics Engine has
 * neither problem.
 *
 * Why KV is still here: Analytics Engine keeps three months. An all-time number therefore cannot
 * come from a query alone, so the aggregation folds each new window into a total that outlives the
 * retention. Analytics Engine is the ledger; KV is the balance.
 */

/** The durable all-time total. Only `refreshTotal` writes it. */
const TOTAL_KEY = "views:total";
/** How far the total has already counted. Everything after this is new. */
const CURSOR_KEY = "views:cursor";
/** How often the total is recomputed, at most. Reads in between are served from KV. */
const REFRESH_SECONDS = 30;
/** Held while a refresh is in flight, so concurrent reads do not all query. Expires on its own. */
const CLAIM_KEY = "views:claim";

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
 * What a caller is allowed to say about a view.
 *
 * The endpoint that feeds this is public and unauthenticated, so everything below is treated as
 * hostile. Three things are being protected:
 *
 *   Cost         every accepted data point is billable past the plan's allowance.
 *   Accuracy     Analytics Engine samples per index, so an attacker inventing unlimited index
 *                values degrades the sampling for the real ones.
 *   Reporting    an unknown id in `getTopPieces` is a fabricated row in our own numbers.
 *
 * `id` is therefore not merely sanitised, it is checked against the registry: anything that is not
 * a real piece is dropped rather than recorded. `path` is bounded and character-restricted, and
 * `type` is a closed set. None of it ever reaches SQL — it is written as Analytics Engine blobs
 * through a structured API — but it does decide index cardinality, which is worth the same care.
 */
const TYPES = new Set(["screen", "template", "component", "block", "docs", "page"]);
const PATH_OK = /^\/[A-Za-z0-9\-._~/]{0,120}$/;
/** `.` is legitimate in a slug; `..` is never a real page and only ever pollutes reporting. */
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
 * This is the only thing allowed into a query. Because it cannot return anything but a bounded
 * integer, no caller can produce a quote, a comment marker or a statement separator, which is what
 * makes the queries below injection-proof by construction rather than by careful escaping.
 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Every character our queries can legitimately contain. A semicolon, a backslash, a comment marker
 * or a double quote is not in here.
 *
 * Nothing user-supplied is interpolated into a query today, so this can only fire if a future edit
 * introduces one. That is exactly when a guard is worth having: it turns a silent injection into a
 * refused query and a log line.
 */
const SAFE_QUERY = /^[A-Za-z0-9_ '(),*>=!.\n-]+$/;
/** A hyphen is legitimate (`NOW() - INTERVAL`), two in a row is a comment. Likewise block comments. */
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
 * Folds everything counted since the cursor into the running total.
 *
 * The cursor is written *before* the total, so a refresh that dies halfway loses a window rather
 * than counting one twice. Undercounting by a few views is invisible; a number that jumps is not.
 */
async function refreshTotal(kv: KVNamespace): Promise<number> {
  const [rawTotal, cursor] = await Promise.all([kv.get(TOTAL_KEY), kv.get(CURSOR_KEY)]);
  const total = num(rawTotal);
  const now = Date.now();
  const parsed = cursor ? Date.parse(cursor) : NaN;
  const since = Number.isFinite(parsed) ? parsed : now - 60_000;

  // The window is expressed as an interval back from now rather than as two timestamps: that is
  // the form Cloudflare documents, and it avoids depending on how this dialect parses a literal
  // date. A little slack on the upper end so a view landing mid-refresh is not skipped; counting
  // one twice is the tradeoff, and it is the cheaper of the two.
  // Bounded on both ends: never zero, and never a query that scans more than a day even if the
  // cursor is missing, corrupt or far in the past. A wider window would cost more and return the
  // same answer, because anything older is already inside the total.
  const seconds = clampInt(Math.ceil((now - since) / 1000) + 2, 1, 86_400, 60);

  // SUM(_sample_interval), not COUNT(): Analytics Engine samples under load, and the sample
  // interval is how many real views each returned row stands for.
  const rows = await sql(
    `SELECT SUM(_sample_interval) AS views FROM swiftpieces_views
     WHERE timestamp > NOW() - INTERVAL '${seconds}' SECOND`,
  );
  if (rows === null) return total; // Query failed: keep the number we have rather than losing it.

  const fresh = num(rows[0]?.views);
  const next = total + fresh;
  // Cursor first: a refresh that dies halfway loses a window rather than counting one twice.
  await kv.put(CURSOR_KEY, new Date(now).toISOString());
  if (fresh > 0) await kv.put(TOTAL_KEY, String(next));
  return next;
}

/**
 * The all-time total, recomputed at most every `REFRESH_SECONDS`. Null when unconfigured.
 *
 * The refresh is claimed before it runs. Without that, every request arriving in the instant the
 * window expires would start its own SQL query and its own read-add-write, which is both a bill and
 * a double count. The claim is a KV write, so it is not a real lock: two isolates can still race
 * inside the same moment. It narrows the window from "every concurrent request" to "the rare
 * simultaneous pair", which for a decorative counter is the right amount of engineering.
 */
export async function getViews(): Promise<number | null> {
  const kv = env().VIEWS;
  if (!kv) return null;
  try {
    const cursor = await kv.get(CURSOR_KEY);
    const parsed = cursor ? Date.parse(cursor) : NaN;
    const stale = !Number.isFinite(parsed) || Date.now() - parsed > REFRESH_SECONDS * 1000;
    if (!stale) return num(await kv.get(TOTAL_KEY));

    const claimed = await kv.get(CLAIM_KEY);
    if (claimed) return num(await kv.get(TOTAL_KEY)); // Someone else is already refreshing.
    await kv.put(CLAIM_KEY, "1", { expirationTtl: 60 });

    return await refreshTotal(kv);
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
