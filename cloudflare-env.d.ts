/** Bindings this Worker is given in wrangler.jsonc. Generated shape, kept by hand: Free has few. */
interface CloudflareEnv {
  /** The view count's running total and when PostHog was last asked. See lib/views.ts. */
  VIEWS?: KVNamespace;
  /** Per-IP ceiling on /api and /r (middleware.ts). */
  API_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Per-IP ceiling on /api/search, which runs as the user types. */
  SEARCH_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
