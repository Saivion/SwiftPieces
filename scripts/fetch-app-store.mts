// Refreshes lib/apps/app-store.json from Apple's public lookup API for every app in
// lib/apps/library.ts. Run by hand, review the diff, commit. Facts only (name, developer, category,
// rating, price, screenshots, link): the developer's own description copy is never republished. Nothing is fetched at request time,
// and images are not copied: the JSON keeps Apple's CDN URLs and the pages load them from there.
//
//   npx tsx scripts/fetch-app-store.mts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY } from "../lib/apps/library.ts";

type Result = {
  trackId: number; trackName: string; sellerName: string; artistName: string; primaryGenreName: string;
  averageUserRating?: number; userRatingCount?: number; artworkUrl512: string; screenshotUrls: string[];
  trackViewUrl: string; formattedPrice?: string; releaseDate: string;
};

const ids = LIBRARY.map((a) => a.trackId).join(",");
const res = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=us&entity=software`);
if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
const { results } = (await res.json()) as { results: Result[] };
const byId = new Map(results.map((r) => [r.trackId, r]));

/**
 * A screenshot's real proportions, read from the PNG header of a small copy, so pages can reserve
 * exactly its shape: iPhone screenshots come in several aspect ratios, and a fixed one would crop.
 */
async function size(url: string): Promise<{ url: string; width: number; height: number }> {
  const res = await fetch(url.replace(/\/[^/]+$/, "/200x0w.png"));
  const head = new Uint8Array(await res.arrayBuffer()).slice(16, 24);
  const view = new DataView(head.buffer);
  return { url, width: view.getUint32(0), height: view.getUint32(4) };
}

const apps: Record<string, unknown> = {};
for (const a of LIBRARY) {
  const r = byId.get(a.trackId);
  if (!r) {
    console.warn(`missing from the App Store: ${a.slug} (${a.trackId})`);
    continue;
  }
  apps[a.slug] = {
    trackId: r.trackId,
    name: r.trackName,
    developer: r.sellerName || r.artistName,
    category: r.primaryGenreName,
    rating: r.averageUserRating ? Math.round(r.averageUserRating * 10) / 10 : null,
    ratingCount: r.userRatingCount ?? 0,
    price: r.formattedPrice ?? "Free",
    icon: r.artworkUrl512,
    screenshots: await Promise.all(r.screenshotUrls.slice(0, 8).map(size)),
    url: r.trackViewUrl.split("?")[0],
    released: r.releaseDate.slice(0, 10),
  };
}

const out = join(import.meta.dirname, "..", "lib", "apps", "app-store.json");
writeFileSync(out, `${JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), country: "us", apps }, null, 2)}\n`);
console.log(`wrote ${Object.keys(apps).length} of ${LIBRARY.length} apps to lib/apps/app-store.json`);
