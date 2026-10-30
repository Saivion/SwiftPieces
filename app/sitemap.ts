import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { sitemapEntries } from "@/lib/sitemap-paths";
import dates from "@/registry/__registry__/lastmod.json";

// lastmod comes from registry/__registry__/lastmod.json (scripts/aeo/write-lastmod.ts), one git
// date per path. A build-wide timestamp told Google every page changed on every deploy.
const dated = dates as Record<string, string>;

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map(({ path, priority }) => {
    const iso = dated[path];
    const lastModified = iso ? new Date(iso) : undefined;
    const valid = lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : undefined;
    return {
      url: path === "/" ? site.url : `${site.url}${path}`,
      priority,
      ...(valid ? { lastModified: valid } : {}),
    };
  });
}
