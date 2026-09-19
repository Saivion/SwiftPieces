import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { source } from "@/lib/source";

// Every marketing page plus every docs page, including one page per piece, so search engines find
// all of them without crawling the sidebar.
const pages = ["", "/components", "/showcase", "/pro", "/blocks", "/about", "/changelog", "/license", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}`, lastModified: now, priority: p === "" ? 1 : 0.7 })),
    ...source.getPages().map((page) => ({ url: `${site.url}${page.url}`, lastModified: now, priority: 0.6 })),
  ];
}
