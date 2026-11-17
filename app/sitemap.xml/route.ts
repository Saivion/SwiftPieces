import { sitemapGroups, sitemapIndexXml, XML_HEADERS } from "@/lib/sitemaps";

// The sitemap index: one child sitemap per page type (lib/sitemaps.ts). Built once, at build time.
export const dynamic = "force-static";

export function GET() {
  return new Response(sitemapIndexXml(sitemapGroups()), { headers: XML_HEADERS });
}
