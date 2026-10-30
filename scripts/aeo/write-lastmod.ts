/**
 * Writes registry/__registry__/lastmod.json from git, one ISO timestamp per sitemap path.
 * Dirty or untracked sources use the current time. See scripts/aeo/README.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sitemapEntries } from "../../lib/sitemap-paths";

const ROOT = join(import.meta.dirname, "../..");

function gitDate(rel: string): string | undefined {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return undefined;
  const status = execFileSync("git", ["status", "--porcelain", "--", rel], { cwd: ROOT, encoding: "utf8" }).trim();
  if (status) return new Date().toISOString();
  const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", rel], { cwd: ROOT, encoding: "utf8" }).trim();
  return out || undefined;
}

function latest(rels: string[]): string {
  const dates = rels.map(gitDate).filter((d): d is string => Boolean(d));
  if (!dates.length) throw new Error(`No git date for ${rels.join(", ")}`);
  return dates.reduce((max, iso) => (Date.parse(iso) > Date.parse(max) ? iso : max));
}

/** Source files whose edits should move this URL's lastmod. */
export function sourcesFor(path: string): string[] {
  if (path === "/") return ["app/(marketing)/page.tsx", "components/sections/hero.tsx", "lib/faqs.ts", "lib/site.ts"];
  if (path === "/components") return ["app/(marketing)/components/page.tsx"];
  if (path.startsWith("/components/")) return ["lib/hubs.ts", "app/(marketing)/components/[slug]/page.tsx"];
  if (path === "/patterns") return ["app/(marketing)/patterns/page.tsx"];
  if (path === "/apps") return ["app/(marketing)/apps/page.tsx", "lib/apps/index.ts"];
  if (path.startsWith("/apps/")) return ["lib/apps/index.ts", "app/(marketing)/apps/[app]/page.tsx"];
  if (path.startsWith("/playground/")) return ["lib/playground-page.tsx", "app/(builder)/playground/[app]/page.tsx"];
  if (path === "/styles") return ["app/(marketing)/styles/page.tsx"];
  if (path === "/sponsors") return ["app/(marketing)/sponsors/page.tsx"];
  if (path === "/about") return ["app/(marketing)/about/page.tsx"];
  if (path === "/license") return ["app/(marketing)/license/page.tsx"];
  if (path.startsWith("/docs/changelog")) return ["lib/changelog.ts"];
  if (path.startsWith("/docs/")) {
    const rel = path.slice("/docs/".length);
    const direct = `content/docs/${rel}.mdx`;
    const index = `content/docs/${rel}/index.mdx`;
    if (existsSync(join(ROOT, direct))) return [direct];
    if (existsSync(join(ROOT, index))) return [index];
    throw new Error(`No mdx for ${path}`);
  }
  throw new Error(`No lastmod source for ${path}`);
}

const dates: Record<string, string> = {};
for (const entry of sitemapEntries()) {
  dates[entry.path] = latest(sourcesFor(entry.path));
}

const out = join(ROOT, "registry/__registry__/lastmod.json");
writeFileSync(out, `${JSON.stringify(dates, null, 2)}\n`);
console.log(`Wrote ${Object.keys(dates).length} dates to ${out}`);
