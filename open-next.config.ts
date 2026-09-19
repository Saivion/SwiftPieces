import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

export default defineCloudflareConfig({
  // Workers Cache API in front of R2 cuts CPU per cache hit on a docs-heavy site (spec §4a).
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
});
