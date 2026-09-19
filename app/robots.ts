import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Everything public is crawlable. The API is data for the CLI and agents, not pages.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${site.url}/sitemap.xml`, host: site.url };
}
