import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { categories } from "./lib/categories";
import { blockCategories } from "./lib/blocks";
import { LIBRARY } from "./lib/apps/library";

// Lets `next dev` see Cloudflare bindings (D1, R2, KV) from wrangler.jsonc.
initOpenNextCloudflareForDev();

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/**
 * Content Security Policy. Pages here are static, so a per-request script nonce isn't possible and
 * inline scripts (Next's, Fumadocs') stay allowed; everything else is locked to the hosts the site
 * actually uses: scripts only from this origin, PostHog's and Databuddy's, no plugins, no <base>
 * hijacking, no framing, forms only to this site, and network calls only to Pro (the session and,
 * later, saves), PostHog and Databuddy. It matters because Free is same-site with Pro.
 *
 * Enforced (2026-10-20), after a pass over every pre-rendered page and every client chunk found
 * nothing loaded from outside these lists: App Store images, Google Fonts for the Playground's brand
 * fonts, the Pro site and its Clerk host, PostHog, and (2026-10-23) Databuddy. Anything new from
 * another host needs its directive here first, or the browser blocks it.
 */
const PRO_ORIGIN = new URL(process.env.NEXT_PUBLIC_PRO_EMBED_URL ?? process.env.NEXT_PUBLIC_PRO_URL ?? "https://pro.swiftpieces.com").origin;
const MEDIA_ORIGIN = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? "https://media.swiftpieces.com").origin;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const POSTHOG_ORIGIN = POSTHOG_HOST ? new URL(POSTHOG_HOST).origin : null;
// PostHog's hosts: events go to <region>.i.posthog.com, and its scripts and remote config come from
// <region>-assets.i.posthog.com. Scripts may come from that one asset host only (a wildcard would let
// any posthog.com subdomain run here); network calls may go to both. A reverse proxy serves both.
const POSTHOG_REGION = POSTHOG_ORIGIN ? new URL(POSTHOG_ORIGIN).hostname.match(/^([a-z]+)\.i\.posthog\.com$/)?.[1] : undefined;
const POSTHOG_SCRIPT_ORIGIN = POSTHOG_ORIGIN ? (POSTHOG_REGION ? `https://${POSTHOG_REGION}-assets.i.posthog.com` : POSTHOG_ORIGIN) : null;
const POSTHOG_CONNECT = POSTHOG_ORIGIN ? [...new Set([POSTHOG_ORIGIN, POSTHOG_SCRIPT_ORIGIN])].join(" ") : null;
// Databuddy (lib/analytics.ts): its script from the CDN, its events to the basket. Middleware's AI
// crawler reports leave from the Worker, which no CSP governs.
const DATABUDDY = Boolean(process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID);
const dev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${POSTHOG_SCRIPT_ORIGIN ? ` ${POSTHOG_SCRIPT_ORIGIN}` : ""}${DATABUDDY ? " https://cdn.databuddy.cc" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://is1-ssl.mzstatic.com ${MEDIA_ORIGIN}`,
  `media-src 'self' blob: ${MEDIA_ORIGIN}`,
  `connect-src 'self' ${PRO_ORIGIN}${POSTHOG_CONNECT ? ` ${POSTHOG_CONNECT}` : ""}${DATABUDDY ? " https://basket.databuddy.cc" : ""}${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
  ...(POSTHOG_ORIGIN ? ["worker-src 'self' blob:"] : []),
  // The Pro site's hidden token page (lib/pro-bridge.ts) is the only frame this site loads. While it
  // loads, Clerk may pass it through its own host (the Frontend API) to refresh the session.
  `frame-src ${PRO_ORIGIN} https://clerk.pro.swiftpieces.com${dev ? " http://localhost:3200 http://127.0.0.1:3200 https://*.clerk.accounts.dev" : ""}`,
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");
SECURITY_HEADERS.push({ key: "Content-Security-Policy", value: CSP });

/** Every category slug, for the redirects below. */
const CATEGORY_SLUGS = Object.values(categories).map((c) => c.slug).join("|");
const BLOCK_CATEGORY_SLUGS = Object.values(blockCategories).map((c) => c.slug).join("|");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Baseline hardening for every response, including the Content Security Policy above.
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  // Never ship browser source maps: DevTools shows only minified bundles, not our original
  // TypeScript. scripts/audit-public.sh fails the deploy if a .map file or sourceMappingURL slips in.
  productionBrowserSourceMaps: false,
  // OG images are generated at build time and served from R2 (spec §4),
  // so we never need the runtime image optimizer on the Worker.
  images: { unoptimized: true },
  async redirects() {
    return [
      // One permanent hop for anyone still arriving at /docs; site links point at the final URL.
      { source: "/docs", destination: "/docs/introduction", permanent: true },
      // The Pro overview moved from /pricing to /pro: Free shows no prices, pricing lives on Pro.
      { source: "/pricing", destination: "/pro", permanent: true },
      // The changelog moved inside the docs. The Sep 26 and Sep 29 updates became one entry.
      { source: "/changelog", destination: "/docs/changelog", permanent: true },
      { source: "/changelog/:slug(light-mode|everyday-utilities)", destination: "/docs/changelog/apps-and-playground", permanent: true },
      { source: "/changelog/:slug", destination: "/docs/changelog/:slug", permanent: true },
      // The free screens gallery became the app library.
      { source: "/screens", destination: "/apps", permanent: false },
      // The Playground is one page per app now (/playground/lungy). Its catalog pages, and the old
      // per-pattern pages, lead to the app's Playground when there is one, else to the app library.
      { source: "/playground", destination: "/apps", permanent: false },
      // Remix your own screenshot is retired for now (attic-screenshot-remix-2026-10-01).
      { source: "/playground/screenshot", destination: "/apps", permanent: false },
      ...LIBRARY.flatMap((a) => [
        { source: `/playground/${a.pattern}`, destination: `/playground/${a.slug}`, permanent: false },
        { source: `/apps/${a.slug}/:pattern`, destination: `/playground/${a.slug}`, permanent: false },
      ]),
      { source: "/playground/:kind/:slug", destination: "/apps", permanent: false },
      // Category filters used to be query strings on /components; each category has its own page now.
      { source: "/components", has: [{ type: "query", key: "category", value: "(?<category>[a-z]+)" }], destination: "/components/:category", permanent: true },
      // Code Block was retired on 2026-10-08; Source Stack took its place in the AI pieces.
      { source: "/docs/components/ai/code-block", destination: "/docs/components/ai/source-stack", permanent: true },
      // The docs sidebar's category folders have no page of their own; their URL leads to the hub.
      { source: `/docs/components/:category(${CATEGORY_SLUGS})`, destination: "/components/:category", permanent: true },
      // Block categories are sidebar folders too, with no page of their own: their URL leads to the blocks.
      { source: `/docs/blocks/:category(${BLOCK_CATEGORY_SLUGS})`, destination: "/blocks", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Public registry protocol path (spec §2): /r/GlassCard.json
      { source: "/r/:name.json", destination: "/api/registry/:name" },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
