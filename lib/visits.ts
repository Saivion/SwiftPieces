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

async function fetchVisits(): Promise<number | null> {
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;

  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { account, since: since.toISOString(), until: until.toISOString() } }),
      // This call had no upper bound, and it sat in the hero's render path: a slow response held
      // the whole document. It is decoration, so it gets a short leash and fails to nothing.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      // 403 here almost always means the token is missing Account Analytics: Read.
      report(`API returned ${res.status} ${res.statusText}`);
      return null;
    }
    const json = (await res.json()) as Response;
    if (json.errors?.length) {
      const messages = json.errors.map((e) => e.message ?? JSON.stringify(e)).join("; ");
      report(`GraphQL errors: ${messages}`);
      return null;
    }
    const visits = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0]?.sum?.visits;
    if (typeof visits !== "number") {
      // The query succeeded and matched nothing: no beacon data on the account at all.
      report("no rows: the account has no Web Analytics data in the retained history");
      return null;
    }
    report(`${visits} visits all time`);
    return visits;
  } catch (error) {
    // Analytics is decoration: a failed call hides the line, it never breaks the page.
    report(`request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const cachedVisits = unstable_cache(fetchVisits, ["cf-web-analytics-visits"], { revalidate: 3600 });

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
