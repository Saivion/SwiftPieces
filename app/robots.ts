import type { MetadataRoute } from "next";
import { AI_CRAWLERS } from "@/lib/crawlers";
import { site } from "@/lib/site";

// Pages are crawlable. /api/ is the CLI and MCP protocol, not a page. /llms.txt stays allowed.
// Named AI crawlers get the same rules as `*`, written out so the allow is explicit.
const publicSite = { allow: "/", disallow: ["/api/"] };

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...AI_CRAWLERS], ...publicSite },
      { userAgent: "*", ...publicSite },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
