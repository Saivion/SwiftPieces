/** Bindings this Worker is given in wrangler.jsonc. Generated shape, kept by hand: Free has few. */
interface CloudflareEnv {
  /** Raw page views, one data point per view. Write-only from the Worker; read over the SQL API. */
  VIEWS_AE?: AnalyticsEngineDataset;
  /** The durable running total and the aggregation cursor. See lib/views.ts. */
  VIEWS?: KVNamespace;
  /** Playground product events (app/api/events). Allow-listed names and enum values only. */
  BUILDER_AE?: AnalyticsEngineDataset;
  /** Per-IP ceiling on /api/views writes. */
  VIEWS_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Per-IP ceiling on the rest of /api and /r (middleware.ts). */
  API_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Per-IP ceiling on /api/search, which runs as the user types. */
  SEARCH_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
