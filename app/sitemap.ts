import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
// The docs pages' URLs come from the prebuilt index, never lib/source.ts: that module is the compiled
// MDX (about 20 MB), and importing it here would put a second copy in the Worker (scripts/build-registry.ts).
import docs from "@/registry/__registry__/docs.json";
import { hubs, hubPath } from "@/lib/hubs";
import { appPath, apps } from "@/lib/apps";
import { playgroundPath } from "@/lib/playground";
import { changelog, changelogPath } from "@/lib/changelog";

// Every indexable marketing page plus every docs page, including one page per piece, so search
// engines find all of them without crawling the sidebar. Only self-canonical, indexable URLs belong
// here: /pro and /blocks canonicalize to pro.swiftpieces.com, and /showcase, /privacy and /terms are
// noindex, so listing them would send search engines mixed signals. The category and topic hubs
// (/components/cards) are the pages meant to rank for broad queries, so they sit just under home.
const pages = ["", "/components", "/apps", "/sponsors", "/about", "/license"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, lastModified: now, priority: p === "" ? 1 : p === "/components" ? 0.9 : p === "/apps" ? 0.8 : 0.5 })),
    ...hubs.map((h) => ({ url: `${site.url}${hubPath(h.slug)}`, lastModified: now, priority: 0.8 })),
    // The app library: each app, and its recreation open in the Playground.
    ...apps.flatMap((a) => [
      { url: `${site.url}${appPath(a)}`, lastModified: now, priority: 0.7 },
      { url: `${site.url}${playgroundPath(a)}`, lastModified: now, priority: 0.75 },
    ]),
    // The changelog (inside the docs, but not an MDX page) and one page per update.
    { url: `${site.url}${changelogPath()}`, lastModified: now, priority: 0.5 },
    ...changelog.map((e) => ({ url: `${site.url}${changelogPath(e.slug)}`, lastModified: now, priority: 0.4 })),
    ...docs.map((page) => ({ url: `${site.url}${page.url}`, lastModified: now, priority: page.url.startsWith("/docs/guides") ? 0.8 : 0.6 })),
  ];
}
