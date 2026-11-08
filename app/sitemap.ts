import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
// The docs pages' URLs come from the prebuilt index, never lib/source.ts: that module is the compiled
// MDX (about 20 MB), and importing it here would put a second copy in the Worker (scripts/build-registry.ts).
import docs from "@/registry/__registry__/docs.json";
import { hubs, hubPath } from "@/lib/hubs";
import { appPath, apps } from "@/lib/apps";
import { playgroundPath } from "@/lib/playground";
import { changelog, changelogPath } from "@/lib/changelog";
import { contentDate, mustContentDate } from "@/lib/content-date";

// Every indexable marketing page plus every docs page, including one page per piece, so search
// engines find all of them without crawling the sidebar. Only self-canonical, indexable URLs belong
// here: /pro canonicalizes to pro.swiftpieces.com, and /showcase, /privacy and /terms are
// noindex, so listing them would send search engines mixed signals. The category and topic hubs
// (/components/cards) are the pages meant to rank for broad queries, so they sit just under home.
const pages = ["", "/components", "/patterns", "/apps", "/styles", "/sponsors", "/about", "/license"];

/**
 * lastmod for every page that has no date of its own: the last day the site's copy changed. Bump it
 * by hand when page copy changes. Never `new Date()`: a lastmod that moves on every build is ignored.
 */
const CONTENT_UPDATED = mustContentDate("2026-11-08");

/** A changelog update keeps the day it shipped. */
function shipped(date?: string): Date {
  return (date ? contentDate(date) : null) ?? CONTENT_UPDATED;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, lastModified: CONTENT_UPDATED, priority: p === "" ? 1 : p === "/components" ? 0.9 : p === "/patterns" ? 0.85 : p === "/apps" || p === "/styles" ? 0.8 : 0.5 })),
    ...hubs.map((h) => ({ url: `${site.url}${hubPath(h.slug)}`, lastModified: CONTENT_UPDATED, priority: 0.8 })),
    // The app library: each app, and its recreation open in the Playground.
    ...apps.flatMap((a) => [
      { url: `${site.url}${appPath(a)}`, lastModified: CONTENT_UPDATED, priority: 0.7 },
      { url: `${site.url}${playgroundPath(a)}`, lastModified: CONTENT_UPDATED, priority: 0.75 },
    ]),
    // The changelog (inside the docs, but not an MDX page) and one page per update.
    { url: `${site.url}${changelogPath()}`, lastModified: shipped(changelog[0]?.date), priority: 0.5 },
    ...changelog.map((e) => ({ url: `${site.url}${changelogPath(e.slug)}`, lastModified: shipped(e.date), priority: 0.4 })),
    ...docs.map((page) => ({ url: `${site.url}${page.url}`, lastModified: CONTENT_UPDATED, priority: page.url.startsWith("/docs/guides") ? 0.8 : 0.6 })),
  ];
}
