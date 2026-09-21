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
  // Off: interception answers segment prefetch requests (`next-router-segment-prefetch`) with the
  // whole cached page, and the client then re-requests the segment in a loop. ISR pages are still
  // served from the incremental cache, through Next's router. The audit script checks this.
  enableCacheInterception: false,
});
