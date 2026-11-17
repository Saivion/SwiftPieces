// Search switches in one place (docs/seo/CHANGELOG-2026-11.md). Each one is read at build time, so a
// change needs a rebuild. Set the environment variable to "true" or "false" to override the default.
//
// Plain module with no imports from the app, so next.config.ts can read it too.

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

/**
 * The /apps/<app> pages (named after other companies' apps) and their /playground/<app> remixes. Off by
 * default: the pages stay up for visitors and shares, but carry `noindex, follow`, leave the sitemap, and
 * show no App Store screenshots. Turn on only for pages rebuilt around what SwiftPieces made.
 */
export const SEO_INDEX_APP_REMIXES = envFlag("SEO_INDEX_APP_REMIXES", false);

/**
 * Pattern pages belong to Pro. On by default: every /docs/patterns page 301s to its twin on
 * pro.swiftpieces.com/library/patterns (docs/seo/pattern-slugs.json), links point there directly, and
 * the pages leave this sitemap. /patterns stays here as the overview.
 */
export const SEO_PATTERNS_ON_PRO = envFlag("SEO_PATTERNS_ON_PRO", true);
