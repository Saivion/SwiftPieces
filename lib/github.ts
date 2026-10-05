import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { site } from "@/lib/site";

/** Last good count, in KV so it survives deploys and isolates. Only written when the count changes. */
const STARS_KEY = "github:stars";
/** Last good count this isolate has seen, so a repeat failure never even needs KV. */
let lastKnown: number | null = null;

function kv(): KVNamespace | undefined {
  try {
    return getCloudflareContext().env.VIEWS;
  } catch {
    // Local `next dev` and the Cloudflare build have no bindings.
    return undefined;
  }
}

/** One call to GitHub. Only 200s enter Next's data cache, so a failure is retried on the next render. */
async function fetchStars(revalidate: number | false): Promise<number | null> {
  const repo = site.github.replace("https://github.com/", "");
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "swiftpieces.com" },
      next: { revalidate },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

/**
 * Star count for the public repo, refreshed from GitHub every 5 minutes (the homepage revalidate).
 *
 * A number is always shown once one has ever been fetched. GitHub's unauthenticated API is shared
 * across Cloudflare egress IPs, so it does rate-limit or time out now and then. Returning null on
 * those renders used to bake the bare "Star" pill into the cached page for the whole window. Now a
 * failed refresh falls back to the last good count, and only a success moves the number.
 *
 * `revalidate` sets how long the answer is cached. A page that reads it with a number becomes an ISR
 * page on that cycle, so the shared navbar reads it with `false` (fixed at build) and the live count
 * comes from /api/stars instead (components/layout/github-star-live.tsx).
 */
export async function getStarCount(revalidate: number | false = 300): Promise<number | null> {
  const fresh = await fetchStars(revalidate);
  const store = kv();
  if (fresh !== null) {
    if (fresh !== lastKnown) {
      // A new isolate starts with nothing in memory, so it checks what KV holds before writing.
      // Otherwise every cold start rewrites the same number, and isolates starting together collide
      // on KV's one-write-per-second-per-key limit.
      const stored = lastKnown ?? (await readStored(store));
      lastKnown = fresh;
      if (fresh !== stored) await store?.put(STARS_KEY, String(fresh)).catch(() => {});
    }
    return fresh;
  }
  if (lastKnown === null) lastKnown = await readStored(store);
  return lastKnown;
}

async function readStored(store: KVNamespace | undefined): Promise<number | null> {
  const stored = Number(await store?.get(STARS_KEY).catch(() => null));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

export { formatCount } from "@/lib/format-count";
