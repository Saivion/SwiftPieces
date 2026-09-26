import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { source } from "@/lib/source";
import { hubs, hubPath } from "@/lib/hubs";

// Every indexable marketing page plus every docs page, including one page per piece, so search
// engines find all of them without crawling the sidebar. Only self-canonical, indexable URLs belong
// here: /pro and /blocks canonicalize to pro.swiftpieces.com, and /showcase, /privacy and /terms are
// noindex, so listing them would send search engines mixed signals. The category and topic hubs
// (/components/cards) are the pages meant to rank for broad queries, so they sit just under home.
const pages = ["", "/components", "/screens", "/playground", "/sponsors", "/about", "/changelog", "/license"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, lastModified: now, priority: p === "" ? 1 : p === "/components" ? 0.9 : p === "/screens" || p === "/playground" ? 0.8 : 0.5 })),
    ...hubs.map((h) => ({ url: `${site.url}${hubPath(h.slug)}`, lastModified: now, priority: 0.8 })),
    ...source.getPages().map((page) => ({ url: `${site.url}${page.url}`, lastModified: now, priority: page.slugs[0] === "guides" ? 0.8 : 0.6 })),
  ];
}
