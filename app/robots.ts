import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * AI answer crawlers are named so the allow is explicit: they may read every public page, the docs,
 * llms.txt and the registry JSON. Only /api/ is closed to everyone; it is data for the CLI and agents,
 * not pages. Googlebot stays on the `*` group.
 */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "CCBot",
  "Meta-ExternalAgent",
  "Bytespider",
];

export const MACHINE_ROUTES = ["/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: MACHINE_ROUTES },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: MACHINE_ROUTES },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
