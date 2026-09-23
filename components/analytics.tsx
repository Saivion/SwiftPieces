import { BeaconLoader } from "@/components/beacon-loader";

/**
 * Cloudflare Web Analytics: page views and visits, counted by Cloudflare's own beacon.
 *
 * Nothing here reaches our Worker, so a visit costs us no request, no D1 write and no cold start.
 * It sets no cookies and stores no visitor id, so it needs no consent banner. The trade is that it
 * is client-side, and this audience blocks scripts heavily, so treat the number as a floor rather
 * than a census.
 *
 * Renders nothing until `NEXT_PUBLIC_CF_BEACON_TOKEN` is set, so local and preview builds stay out
 * of the figures. The token is not a secret: it ships in the HTML of every page by design.
 */
export function Analytics() {
  // Set in next.config.ts from NEXT_PUBLIC_CF_BEACON_TOKEN, and blank on preview-branch builds.
  const token = process.env.SP_BEACON_TOKEN;
  if (!token) return null;
  return <BeaconLoader token={token} />;
}
