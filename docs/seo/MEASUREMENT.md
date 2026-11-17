# Search measurement plan (swiftpieces.com)

How to tell whether the November 2026 SEO work is paying off. Analytics already on every page: PostHog and Databuddy (lib/analytics.ts).

## Weekly, on Mondays

Use complete weeks only, and never the last 3 days: Search Console data settles over 2 to 3 days, and the 24-hour view is preliminary.

- Search Console Performance, last 28 days against the previous 28. Web and Image search types separately.
- Brand vs non-brand: a query regex filter on `swift ?pieces`. Non-brand impressions are the number that should climb.
- Top pages, and queries at positions 5 to 20 (the striking-distance list). Pick one or two of those for the next guide or page improvement.
- `npm run seo:check` against production. Blockers and orphans should stay at 0.

## Every 2 weeks

- Page indexing report: counts by reason, grouped by URL pattern (`/docs/components/*`, `/components/*`, `/docs/guides/*`, `/docs/changelog/*`, the rest). Track the share of each family that is indexed.
- The share of indexed pages with at least one impression in 28 days.
- Sitemaps report: each child sitemap (`/sitemaps/<type>.xml`) shows its own discovered and indexed counts.

## Monthly

- Referring domains: Bing Webmaster backlinks and the Search Console Links report.
- Branded search impressions, the brand demand proxy.
- AI mentions: ask ChatGPT, Claude, Perplexity and Gemini the same 5 prompts, 3 runs each, and log whether SwiftPieces is named or cited (`npm run aeo:track` covers part of this).
  1. best SwiftUI component library
  2. SwiftUI liquid glass button example
  3. SwiftUI swipeable card stack
  4. free SwiftUI components for iOS
  5. shadcn for SwiftUI

## Success at 90 days (mid February 2027)

- Non-brand impressions up week over week.
- At least 70% of indexable component pages indexed.
- At least 10 relevant new referring domains.

## Events worth watching in analytics

Landing page, referrer, organic vs other, and: copy install command, CLI copy, MCP copy, Playground interaction, Pro click-through.
