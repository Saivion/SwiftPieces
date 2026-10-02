import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { categories } from "./lib/categories";
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
 * actually uses: scripts only from this origin and Cloudflare's analytics, no plugins, no <base>
 * hijacking, no framing, forms only to this site, and network calls only to Pro (the session and,
 * later, saves) and analytics. It matters because Free is same-site with Pro.
 *
 * Report-only while it is tested locally: violations show in the console and nothing is blocked.
 * Switch the header name to Content-Security-Policy once a full pass shows none.
 */
const PRO_ORIGIN = new URL(process.env.NEXT_PUBLIC_PRO_EMBED_URL ?? process.env.NEXT_PUBLIC_PRO_URL ?? "https://pro.swiftpieces.com").origin;
const MEDIA_ORIGIN = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? "https://media.swiftpieces.com").origin;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const POSTHOG_ORIGIN = POSTHOG_HOST ? new URL(POSTHOG_HOST).origin : null;
const POSTHOG_SCRIPT_ORIGIN = POSTHOG_ORIGIN
  ? `https://*.${new URL(POSTHOG_ORIGIN).hostname.split(".").slice(-2).join(".")}`
  : null;
const dev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com${POSTHOG_SCRIPT_ORIGIN ? ` ${POSTHOG_SCRIPT_ORIGIN}` : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://is1-ssl.mzstatic.com ${MEDIA_ORIGIN}`,
  `media-src 'self' blob: ${MEDIA_ORIGIN}`,
  `connect-src 'self' ${PRO_ORIGIN} https://cloudflareinsights.com${POSTHOG_ORIGIN ? ` ${POSTHOG_ORIGIN}` : ""}${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
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
SECURITY_HEADERS.push({ key: "Content-Security-Policy-Report-Only", value: CSP });

// Cloudflare Workers Builds sets WORKERS_CI_BRANCH. Only production builds (main) carry the Web
// Analytics token, so preview URLs for other branches never count toward the real numbers. Local
// builds (no WORKERS_CI_BRANCH) use whatever .env.production holds.
const branch = process.env.WORKERS_CI_BRANCH;
const beaconToken = branch && branch !== "main" ? "" : (process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "");

/** Every category slug, for the redirects below. */
const CATEGORY_SLUGS = Object.values(categories).map((c) => c.slug).join("|");

const config: NextConfig = {
  env: { SP_BEACON_TOKEN: beaconToken },
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
      // The docs sidebar's category folders have no page of their own; their URL leads to the hub.
      { source: `/docs/components/:category(${CATEGORY_SLUGS})`, destination: "/components/:category", permanent: true },
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
