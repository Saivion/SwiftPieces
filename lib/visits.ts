import { unstable_cache } from "next/cache";

/**
 * All-time visits to the site, read from Cloudflare Web Analytics.
 *
 * Why "visits" and not "unique visitors": Web Analytics deliberately never identifies anyone, which
 * is why it needs no cookie or consent banner. It counts a visit when someone arrives from another
 * site or a direct link. That is the honest number, so it is labelled as visits wherever it shows.
 *
 * Cost: the result is cached for an hour, so Cloudflare's API is called at most once an hour, never
 * once per page view. The cache lives in the R2 incremental cache configured in open-next.config.ts.
 *
 * Secrets: `CF_ANALYTICS_API_TOKEN` is a real credential. It is not `NEXT_PUBLIC_`, so Next never
 * puts it in a client bundle, and it lives only in Worker secrets and a gitignored local env. Only
 * the token and the account id are required; without them this returns null and nothing renders,
 * which is what every fork and every contributor's local build gets.
 *
 * Diagnosing: every failure path returns null, so "unconfigured", "token lacks the Analytics scope"
 * and "the site is simply quiet" all look identical on the page. Each one logs its reason instead,
 * and `observability` is on in wrangler.jsonc, so `npx wrangler tail swiftpieces` says which it is.
 * Logging costs nothing in practice: the result is cached for an hour, so these run at most hourly.
 */

/** One place for the tail output, so every line is greppable as `[visits]`. Never logs the token. */
function report(message: string) {
  console.warn(`[visits] ${message}`);
}

/**
 * How far back the count reaches. Cloudflare keeps six months of Web Analytics history (unsampled
 * for the first seven days, aggregated after that), so 180 days is everything it still holds and
 * the count is a true all-time total for a site younger than that.
 *
 * It stops being literally all-time once the site passes six months, around March 2027, at which
 * point it quietly becomes a rolling six months. The number would dip rather than climb, which is
 * the signal to either say "last 6 months" in the copy or start persisting a running total.
 */
const LOOKBACK_DAYS = 180;

/** Every plan serves 30 days, so this is what an over-long window falls back to. */
const FALLBACK_DAYS = 30;

/**
 * Every site on the account, not one site. There is one site, so this is that site's total, and it
 * drops the single value that was easiest to get wrong: Cloudflare shows several 32-hex ids per
 * site and only one of them is the tag this dataset keys on, so a plausible-looking wrong id
 * silently filtered the real traffic down to nothing.
 */
const QUERY = `query Visits($account: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
      }
    }
  }
}`;

type Response = {
  data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { sum?: { visits?: number } }[] }[] } };
  errors?: { message?: string }[];
};

/** The names of any required values that are not present. Empty means the call can go ahead. */
function missingEnv(): string[] {
  return Object.entries({
    CF_ANALYTICS_API_TOKEN: process.env.CF_ANALYTICS_API_TOKEN,
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

/**
 * One query, for one window. Returns the count, or a reason it could not produce one.
 *
 * The reason matters because the two failures need different handling: a window the account cannot
 * serve should be retried shorter, while a bad token should not be retried at all.
 */
type VisitsResult = { ok: true; visits: number } | { ok: false; retryShorter: boolean };

async function queryVisits(days: number): Promise<VisitsResult> {
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { account, since: since.toISOString(), until: until.toISOString() } }),
      // The count is fetched by /api/visits now, not while rendering the document, so a slow
      // response delays nothing on the page. 1.5s was tight enough to drop calls that would have
      // succeeded; this is a real ceiling rather than a race.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // 403 here almost always means the token is missing Account Analytics: Read.
      report(`${days}d: API returned ${res.status} ${res.statusText}`);
      return { ok: false, retryShorter: false };
    }
    const json = (await res.json()) as Response;
    if (json.errors?.length) {
      const messages = json.errors.map((e) => e.message ?? JSON.stringify(e)).join("; ");
      report(`${days}d: GraphQL errors: ${messages}`);
      // How far back a dataset can be queried is set per account and per plan, so a window this
      // account cannot serve comes back as an error rather than as an empty result.
      return { ok: false, retryShorter: true };
    }
    const visits = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0]?.sum?.visits;
    if (typeof visits !== "number") {
      report(`${days}d: no rows`);
      return { ok: false, retryShorter: true };
    }
    report(`${visits} visits over ${days}d`);
    return { ok: true, visits };
  } catch (error) {
    // Analytics is decoration: a failed call hides the line, it never breaks the page.
    report(`${days}d: request failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, retryShorter: false };
  }
}

/**
 * The count, preferring the longest window this account will serve.
 *
 * `LOOKBACK_DAYS` is a wish, not a guarantee: Cloudflare sets how far back each dataset can be
 * queried per account and per plan, and asking for more than the account allows returns an error or
 * nothing at all. That failure was silent, and a silent failure here means the line simply
 * disappears from the hero. So an over-long window falls back to 30 days, which every plan serves,
 * and says so in the log rather than rendering nothing.
 */
async function fetchVisits(): Promise<number | null> {
  const first = await queryVisits(LOOKBACK_DAYS);
  if (first.ok) return first.visits;
  if (!first.retryShorter) return null;

  const fallback = await queryVisits(FALLBACK_DAYS);
  if (!fallback.ok) return null;
  report(`fell back to ${FALLBACK_DAYS}d: this account will not serve ${LOOKBACK_DAYS}d`);
  return fallback.visits;
}

/**
 * How long a fetched count is reused. The hero polls /api/visits every 15s, so this is what stops
 * that traffic reaching Cloudflare: the API is called about three times a minute no matter how many
 * people are on the site. It was an hour, which is why the number never moved.
 */
const CACHE_SECONDS = 20;

const cachedVisits = unstable_cache(fetchVisits, ["cf-web-analytics-visits"], { revalidate: CACHE_SECONDS });

/**
 * Visits over the whole retained history, or null when unconfigured or unavailable.
 *
 * The "is it configured" check sits OUTSIDE the cache deliberately. Pages are prerendered during
 * the Cloudflare build, where Worker secrets do not exist, so this returns null there. Caching that
 * null would write it into the incremental cache and serve it for an hour at runtime, long after
 * the secrets are available: the count would be missing on every fresh deploy for no visible reason.
 * Unconfigured is cheap to re-answer, so it is never cached; only the real API call is.
 */
export async function getRecentVisits(): Promise<number | null> {
  const missing = missingEnv();
  if (missing.length) {
    // Expected on forks, on local builds, and during the Cloudflare build itself.
    report(`not configured, missing ${missing.join(", ")}`);
    return null;
  }
  return cachedVisits();
}
