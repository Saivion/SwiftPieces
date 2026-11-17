import { sitemapGroups, urlsetXml, XML_HEADERS } from "@/lib/sitemaps";

// One child sitemap per page type: /sitemaps/components.xml and the rest (lib/sitemaps.ts).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(sitemapGroups()).map((name) => ({ file: `${name}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entries = sitemapGroups()[file.replace(/\.xml$/, "")];
  if (!file.endsWith(".xml") || !entries) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(entries), { headers: XML_HEADERS });
}
