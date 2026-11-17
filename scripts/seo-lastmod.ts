/**
 * registry/__registry__/lastmod.json: each indexable page's last real change, for the sitemap's lastmod.
 *
 *   npm run seo:lastmod
 *
 * A page's date is the newest commit that touched the files its main content comes from: a component
 * page's Swift source, shaders and notes (registry/swift/<category>/<Name>.*), a docs page's MDX, a
 * hub's pieces plus lib/hubs.ts, a marketing page's own page.tsx and data. Never the build time, never
 * one constant for every page (Google ignores a lastmod that is not true).
 *
 * The file is committed. In a shallow clone (or without git) the dates would all be the clone's one
 * commit, so the script leaves the committed file as it is and says so.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hubs, hubItems, hubPath } from "../lib/hubs";
import { categories } from "../lib/categories";
import type { RegistryIndexEntry } from "../lib/registry-schema";
import { SEO_PATTERNS_ON_PRO } from "../lib/seo-flags";

const ROOT = process.cwd();
const OUT = join(ROOT, "registry/__registry__/lastmod.json");

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

if (git(["rev-parse", "--is-shallow-repository"]) !== "false") {
  console.log("seo:lastmod: no full git history here (shallow clone or no git); keeping the committed lastmod.json");
  process.exit(0);
}

/** The newest commit date (YYYY-MM-DD, UTC) across files, or null when none is tracked. */
function lastChange(files: string[]): string | null {
  const tracked = files.filter((f) => existsSync(join(ROOT, f)));
  if (!tracked.length) return null;
  const out = git(["log", "-1", "--format=%cI", "--", ...tracked]);
  return out ? new Date(out).toISOString().slice(0, 10) : null;
}

const index: RegistryIndexEntry[] = JSON.parse(readFileSync(join(ROOT, "registry/__registry__/index.json"), "utf8"));
const docs: { url: string }[] = JSON.parse(readFileSync(join(ROOT, "registry/__registry__/docs.json"), "utf8"));

/** A piece's own files: its Swift source, shaders and assets, and its notes. */
const pieceFiles = (e: RegistryIndexEntry) => {
  const files = [...e.files, ...(e.shaders ?? [])].map((f) => f.path);
  const notes = files[0]?.replace(/\.swift$/, ".mdx");
  return notes ? [...files, notes] : files;
};
const pieceByUrl = new Map(index.map((e) => [new URL(e.docs).pathname, e]));

const pages: Record<string, string[]> = {
  "/": ["app/(marketing)/page.tsx"],
  "/components": ["app/(marketing)/components/page.tsx", "lib/categories.ts", ...index.flatMap(pieceFiles)],
  "/patterns": ["app/(marketing)/patterns/page.tsx", "lib/blocks.ts"],
  "/apps": ["app/(marketing)/apps/page.tsx", "lib/apps/library.ts"],
  "/styles": ["app/(studio)/styles/page.tsx", "lib/styles.ts"],
  "/sponsors": ["app/(marketing)/sponsors/page.tsx", "lib/sponsors.ts"],
  "/about": ["app/(marketing)/about/page.tsx"],
  "/license": ["app/(marketing)/license/page.tsx", "LICENSE"],
};
for (const hub of hubs) {
  const items = hub.category ? index.filter((e) => e.category === hub.category) : hubItems(hub, index);
  pages[hubPath(hub.slug)] = ["lib/hubs.ts", ...items.flatMap(pieceFiles)];
}
for (const page of docs) {
  // Pattern pages 301 to Pro (lib/seo-flags.ts): no date to give.
  if (SEO_PATTERNS_ON_PRO && (page.url === "/docs/patterns" || page.url.startsWith("/docs/patterns/"))) continue;
  const piece = pieceByUrl.get(page.url);
  if (piece) {
    pages[page.url] = pieceFiles(piece);
    continue;
  }
  const rel = page.url.replace(/^\/docs\/?/, "");
  pages[page.url] = [`content/docs/${rel}.mdx`, `content/docs/${rel}/index.mdx`];
}

const result: Record<string, string> = {};
for (const [url, files] of Object.entries(pages)) {
  const date = lastChange(files);
  if (date) result[url] = date;
}
// Category ids must still be known here, so a renamed category fails loudly rather than dating nothing.
void categories;

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n");
const counts = Object.values(sorted).reduce<Record<string, number>>((m, d) => ((m[d] = (m[d] ?? 0) + 1), m), {});
const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
console.log(`seo:lastmod: ${Object.keys(sorted).length} pages dated, ${Object.keys(counts).length} distinct dates; most common ${top?.[0]} on ${top?.[1]}`);
