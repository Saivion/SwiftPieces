// The sitemap: an index (/sitemap.xml) and one child per page type (/sitemaps/<type>.xml), so Search
// Console reports indexing per type. Only indexable, self-canonical URLs belong here: /pro canonicalizes
// to pro.swiftpieces.com, and /showcase, /privacy and /terms are noindex.
//
// lastmod is each page's last real change (registry/__registry__/lastmod.json, from git, written by
// `npm run seo:lastmod`), or the day a changelog update shipped. A page with no known date has no
// lastmod: never the build time and never one constant for everything. No priority or changefreq,
// which Google ignores.
//
// The docs URLs come from the prebuilt index, never lib/source.ts: that module is the compiled MDX
// (about 20 MB), and importing it here would put a second copy in the Worker (scripts/build-registry.ts).
import docs from "@/registry/__registry__/docs.json";
import lastmod from "@/registry/__registry__/lastmod.json";
import { site } from "@/lib/site";
import { hubs, hubPath } from "@/lib/hubs";
import { appPath, apps } from "@/lib/apps";
import { playgroundPath } from "@/lib/playground";
import { changelog, changelogPath } from "@/lib/changelog";
import { contentDate } from "@/lib/content-date";
import { SEO_INDEX_APP_REMIXES, SEO_PATTERNS_ON_PRO } from "@/lib/seo-flags";
import { pieceImage } from "@/lib/piece-media";
import { getRegistryIndex, piecePath } from "@/lib/registry";

export type SitemapEntry = { path: string; lastmod?: string; images?: string[] };

const dated = lastmod as Record<string, string>;
const entry = (path: string, images?: string[]): SitemapEntry => ({ path, lastmod: dated[path], ...(images?.length ? { images } : {}) });

/** A changelog update keeps the day it shipped. */
const shipped = (date?: string) => (date ? contentDate(date)?.toISOString().slice(0, 10) : undefined);

const docsUrls = (docs as { url: string }[]).map((d) => d.url);
const isPatternDoc = (url: string) => url === "/docs/patterns" || url.startsWith("/docs/patterns/");
const isGuide = (url: string) => url.startsWith("/docs/guides") || url === "/docs/liquid-glass";
const isComponentDoc = (url: string) => url.startsWith("/docs/components");

/** Each component page lists its own preview still: the image that page is the home of. */
function componentImages(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of getRegistryIndex()) {
    const image = pieceImage(e);
    if (image) out.set(piecePath(e), [new URL(image.light, site.url).href]);
  }
  return out;
}

export function sitemapGroups(): Record<string, SitemapEntry[]> {
  const images = componentImages();
  const groups: Record<string, SitemapEntry[]> = {
    pages: ["/", "/apps", "/styles", "/sponsors", "/about", "/license", "/patterns"].map((p) => entry(p)),
    components: [
      entry("/components"),
      ...hubs.map((h) => entry(hubPath(h.slug))),
      ...docsUrls.filter(isComponentDoc).map((u) => entry(u, images.get(u))),
    ],
    guides: docsUrls.filter(isGuide).map((u) => entry(u)),
    docs: docsUrls.filter((u) => !isComponentDoc(u) && !isGuide(u) && !(SEO_PATTERNS_ON_PRO && isPatternDoc(u))).map((u) => entry(u)),
    changelog: [
      { path: changelogPath(), lastmod: shipped(changelog[0]?.date) },
      ...changelog.map((e) => ({ path: changelogPath(e.slug), lastmod: shipped(e.date) })),
    ],
  };
  // The app remixes are noindex unless the flag says otherwise (lib/seo-flags.ts), so they stay out.
  if (SEO_INDEX_APP_REMIXES) groups.apps = apps.flatMap((a) => [entry(appPath(a)), entry(playgroundPath(a))]);
  return groups;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function urlsetXml(entries: SitemapEntry[]): string {
  const hasImages = entries.some((e) => e.images?.length);
  const rows = entries.map((e) => {
    const parts = [`<loc>${escape(`${site.url}${e.path === "/" ? "" : e.path}`)}</loc>`];
    if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
    for (const img of e.images ?? []) parts.push(`<image:image><image:loc>${escape(img)}</image:loc></image:image>`);
    return `<url>${parts.join("")}</url>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` : ""}>`,
    ...rows,
    `</urlset>`,
  ].join("\n");
}

export function sitemapIndexXml(groups: Record<string, SitemapEntry[]>): string {
  const rows = Object.entries(groups).map(([name, entries]) => {
    const newest = entries.map((e) => e.lastmod).filter(Boolean).sort().at(-1);
    return `<sitemap><loc>${site.url}/sitemaps/${name}.xml</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</sitemap>`;
  });
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, ...rows, `</sitemapindex>`].join("\n");
}

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" };
