/** Bindings this Worker is given in wrangler.jsonc. Generated shape, kept by hand: Free has few. */
interface CloudflareEnv {
  /** Raw page views, one data point per view. Write-only from the Worker; read over the SQL API. */
  VIEWS_AE?: AnalyticsEngineDataset;
  /** The durable running total and the aggregation cursor. See lib/views.ts. */
  VIEWS?: KVNamespace;
  /** Per-IP ceiling on /api/views writes. */
  VIEWS_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
