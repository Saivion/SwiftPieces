// Every indexable URL, in the same order and with the same priorities as the sitemap.
// /pro canonicalizes to pro.swiftpieces.com. /showcase, /privacy and /terms are noindex.
// Only self-canonical, indexable URLs belong here.
import docs from "@/registry/__registry__/docs.json";
import { hubs, hubPath } from "@/lib/hubs";
import { appPath, apps } from "@/lib/apps";
import { playgroundPath } from "@/lib/playground";
import { changelog, changelogPath } from "@/lib/changelog";

export type SitemapEntry = { path: string; priority: number };

const pages: SitemapEntry[] = [
  { path: "/", priority: 1 },
  { path: "/components", priority: 0.9 },
  { path: "/patterns", priority: 0.85 },
  { path: "/apps", priority: 0.8 },
  { path: "/styles", priority: 0.8 },
  { path: "/sponsors", priority: 0.5 },
  { path: "/about", priority: 0.5 },
  { path: "/license", priority: 0.5 },
];

/** Paths are site-relative, home is "/". */
export function sitemapEntries(): SitemapEntry[] {
  return [
    ...pages,
    ...hubs.map((h) => ({ path: hubPath(h.slug), priority: 0.8 })),
    ...apps.flatMap((a) => [
      { path: appPath(a), priority: 0.7 },
      { path: playgroundPath(a), priority: 0.75 },
    ]),
    { path: changelogPath(), priority: 0.5 },
    ...changelog.map((e) => ({ path: changelogPath(e.slug), priority: 0.4 })),
    ...(docs as { url: string }[]).map((page) => ({
      path: page.url,
      priority: page.url.startsWith("/docs/guides") ? 0.8 : 0.6,
    })),
  ];
}
