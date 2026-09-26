import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` see Cloudflare bindings (D1, R2, KV) from wrangler.jsonc.
initOpenNextCloudflareForDev();

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

// Cloudflare Workers Builds sets WORKERS_CI_BRANCH. Only production builds (main) carry the Web
// Analytics token, so preview URLs for other branches never count toward the real numbers. Local
// builds (no WORKERS_CI_BRANCH) use whatever .env.production holds.
const branch = process.env.WORKERS_CI_BRANCH;
const beaconToken = branch && branch !== "main" ? "" : (process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "");

const config: NextConfig = {
  env: { SP_BEACON_TOKEN: beaconToken },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Baseline hardening for every response. No CSP here: the site has no auth or secrets in the
    // browser, and a CSP would have to allow Fumadocs' inline scripts and the analytics beacon.
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
