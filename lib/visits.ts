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
 * puts it in a client bundle, and it lives only in Worker secrets and a gitignored local env. With
 * any of the three values missing this returns null and nothing renders, which is what every fork
 * and every contributor's local build gets.
 */

/** The rolling window the count covers. Rolling, so it is labelled "last 30 days", never "this month". */
export const VISIT_WINDOW_DAYS = 30;

const QUERY = `query Visits($account: String!, $site: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
      }
    }
  }
}`;

type Response = {
  data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { sum?: { visits?: number } }[] }[] } };
  errors?: unknown[];
};

async function fetchVisits(): Promise<number | null> {
  const token = process.env.CF_ANALYTICS_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  const site = process.env.CF_WEB_ANALYTICS_SITE_TAG;
  if (!token || !account || !site) return null;

  const until = new Date();
  const since = new Date(until.getTime() - VISIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { account, site, since: since.toISOString(), until: until.toISOString() } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Response;
    if (json.errors?.length) return null;
    const visits = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0]?.sum?.visits;
    return typeof visits === "number" ? visits : null;
  } catch {
    // Analytics is decoration: a failed call hides the line, it never breaks the page.
    return null;
  }
}

/** Visits in the last `VISIT_WINDOW_DAYS` days, or null when unconfigured or unavailable. Cached for an hour. */
export const getRecentVisits = unstable_cache(fetchVisits, ["cf-web-analytics-visits"], { revalidate: 3600 });
