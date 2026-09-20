import { unstable_cache } from "next/cache";

/**
 * Recent visits to the site, read from Cloudflare Web Analytics.
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

/** The rolling window the count covers. Rolling, so it is labelled "last 30 days", never "this month". */
export const VISIT_WINDOW_DAYS = 30;

/**
 * Two shapes of the same question. Scoped to one site when `CF_WEB_ANALYTICS_SITE_TAG` is set,
 * otherwise every site on the account. The account holds one site, so the unscoped total is this
 * site's total, and leaving the tag unset removes the one value that is easy to get wrong: the
 * dashboard shows several 32-hex ids per site and only one of them is the tag this dataset keys on.
 */
const query = (scoped: boolean) => `query Visits($account: String!, ${scoped ? "$site: String!, " : ""}$since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ${scoped ? "siteTag: $site, " : ""}datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
      }
    }
  }
}`;

type Response = {
  data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { sum?: { visits?: number } }[] }[] } };
  errors?: { message?: string }[];
};

async function fetchVisits(): Promise<number | null> {
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  const site = process.env.CF_WEB_ANALYTICS_SITE_TAG;
  const missing = Object.entries({ CF_ANALYTICS_API_TOKEN: token, CF_ACCOUNT_ID: account })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    // Names only. Expected on forks and local builds, which is why this is the quietest line here.
    report(`not configured, missing ${missing.join(", ")}`);
    return null;
  }
  const scoped = Boolean(site);

  const until = new Date();
  const since = new Date(until.getTime() - VISIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query(scoped),
        variables: { account, ...(scoped ? { site } : {}), since: since.toISOString(), until: until.toISOString() },
      }),
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
      // The query succeeded and matched nothing. Scoped, that is almost always the wrong tag.
      report(scoped
        ? "no rows: CF_WEB_ANALYTICS_SITE_TAG matches no data. Unset it to count the whole account"
        : "no rows: the account has no Web Analytics data in this window");
      return null;
    }
    report(`${visits} visits in the last ${VISIT_WINDOW_DAYS} days (${scoped ? "site" : "account-wide"})`);
    return visits;
  } catch (error) {
    // Analytics is decoration: a failed call hides the line, it never breaks the page.
    report(`request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Visits in the last `VISIT_WINDOW_DAYS` days, or null when unconfigured or unavailable. Cached for an hour. */
export const getRecentVisits = unstable_cache(fetchVisits, ["cf-web-analytics-visits"], { revalidate: 3600 });
