import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  // Workers Cache API in front of R2 cuts CPU per cache hit on a docs-heavy site (spec §4a).
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  // Runs time-based revalidation (`revalidate = 3600` on the homepage) through WORKER_SELF_REFERENCE.
  // Without a queue OpenNext uses a no-op, so ISR pages never refresh after the build: the visit
  // count and GitHub star count would stay at their build-time values until the next deploy.
  queue: memoryQueue,
  // Serve a cached page straight from the incremental cache, before Next's server is invoked.
  // Without this every HTML request ran a full Worker render: production measured no
  // `cf-cache-status` header on any HTML response and a TTFB swinging between 0.26s and 3.68s.
  // Must stay false if PPR is ever enabled; this app does not use it.
  enableCacheInterception: true,
});
