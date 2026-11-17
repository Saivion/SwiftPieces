# SEO foundations, November 2026

Branch `feat/seo-foundations-2026-11`, into `develop`. Follows the Nov 16 audit brief (core plan plus Appendix A). Nothing here is deployed until `develop` ships to `main`.

## Before and after

Before: `npm run seo:check` against production on Nov 17 (`report-2026-11-17-baseline.*`). After: the same check against a local `next build && next start` of this branch (`report-2026-11-17-after-local.*`). Local TTFB is not comparable with the edge.

| | Before (production) | After (this branch, local) |
|---|---:|---:|
| Sitemap URLs | 273, one file | 158, an index of 5 typed files |
| Blockers | 0 | 0 |
| Orphans | 0 | 0 |
| Max click depth | 3 | 2 |
| URLs sharing the most common lastmod | 255 (93%), a hand-set constant | 78 (49%), see note |
| URLs with `priority` | 273 | 0 |
| Image sitemap entries | 0 | 98 |
| Component pages using the site-wide og:image | 98 | 0 |
| Component pages with their own image in the HTML | 0 | 98 |
| App Store (mzstatic.com) images on sitemap pages | 2,003 | 515 (on `/apps` and `/styles`, see owner decisions) |
| Thin pages in the sitemap | 34 (`/apps/*`) | 0 |
| Duplicate titles or descriptions | 0 | 0 |

lastmod note: 78 component pages share Nov 10 because the vibrant palette change (#137) really did touch every one of those Swift files that day. Every other date comes from the page's own files.

The 115 URLs that left the sitemap: 46 `/docs/patterns` pages (now 301 to Pro), 34 `/apps/<app>` and 34 `/playground/<app>` pages (now noindex), and `/docs/patterns` itself.

## What changed

Phase 0. `npm run seo:check` (scripts/seo-check.mjs): fetches robots and every sitemap, checks each URL as Googlebot and as Chrome, crawls from home through plain links for depth and orphans, counts unique words per template, writes `docs/seo/report-<date>.json` and `.md`, and exits 1 on a blocker.

A2, patterns. Every `/docs/patterns/<group>/<slug>` and `/docs/patterns` 301s to its twin at `pro.swiftpieces.com/library/patterns`, from `docs/seo/pattern-slugs.json`, the same file as in the Pro repo (Pro #205). All 46 Pro targets returned 200 on Nov 17. Pattern cards, the docs sidebar and llms.txt link straight to Pro. `/patterns` stays here as the overview. Switch: `SEO_PATTERNS_ON_PRO` (on). Release `develop` to `main` only after the Pro side's checks ship.

A6, sitemap. `/sitemap.xml` is an index of `/sitemaps/{pages,components,guides,docs,changelog}.xml`. lastmod per page comes from `registry/__registry__/lastmod.json`, written by `npm run seo:lastmod` from the last commit that touched each page's own files (a component's Swift source and notes, a docs page's MDX, a hub's pieces). In a shallow clone the script keeps the committed file, so commit it after content changes. `priority` and `changefreq` are gone. Component URLs carry their preview still as an image entry.

A1, app remixes. `/apps/<app>` and `/playground/<app>` pages send `noindex, follow` and are out of the sitemap. They still work for visitors and shares. Switch: `SEO_INDEX_APP_REMIXES` (off).

A3, component pages. `npm run previews:capture` (scripts/capture-previews.ts) screenshots each live preview in light and dark into `public/previews/<category>/<slug>/` (1200x900 WebP, a 480x360 thumbnail, a 1200x630 share card) and lists them in `lib/piece-media.json`. On the page the still is the server-rendered placeholder under the live preview (eager, `fetchpriority="high"`, sized, alt text), with a caption under the preview. It is the page's og:image (share card), its `primaryImageOfPage`, the SoftwareSourceCode `image`, and its image sitemap entry. Related pieces are ranked by category, shared tags and technique instead of list order. `/components` ends with a plain "SwiftUI components list" of all 98 pieces with a thumbnail and one line each. The share card is a static file made at capture time instead of `next/og`, so the Worker bundle does not grow.

A4, boilerplate. The Pro bar opens only `/` and `/pro`; other pages start with their own content. The Games menu's 20 game stills are no longer in the initial HTML; they load the first time someone hovers, focuses or opens the navigation.

A7, author. Guides and component pages show "By Saivion · Updated <date>" (the lastmod date), with a Person node in JSON-LD. About gains a "Who builds it" section: GitHub, shipped work (Free, Pro, Games, Tiny Personas), the Not only Swift feature, and how to get in touch.

A8, IndexNow. A key file in `public/` (`<key>.txt`) and `npm run indexnow -- --since <ref>`, which submits pages whose lastmod changed.

Measurement plan: `docs/seo/MEASUREMENT.md`.

## Checks run

- `npx tsc --noEmit`: clean. `next build`: passes; the sitemap index and its 5 children prerender.
- Local spot checks: `/docs/patterns/auth/magic-link` 301 to Pro; `/apps/flighty` has `noindex, follow`; `/docs/components/cards/flip-card` has `<img src="/previews/cards/flip-card/flip-card-light.webp" ... fetchPriority="high">` and the matching og:image.
- No en or em dash in copy added on this branch.
- Not run here: Lighthouse (blocked in this sandbox), the Rich Results Test, and http/www redirect checks (the sandbox and the Mac's VM both get 403 from their proxy on plain http). See owner tasks.

## Needs owner decision

1. Decided (Saivion, Nov 17): the `/apps` hub keeps its 510 App Store screenshots and stays indexable, as do the 5 on `/styles`.
2. Third-party app names in `/apps/<app>` and `/playground/<app>` URLs: keep (pages are noindex anyway) or rename with 301s.
3. Rebuilding playgrounds as "<Category> app UI in SwiftUI" pages with 150+ unique words each, to make them indexable again. Each needs written copy; none was generated.
4. "When to use it" (3 to 5 sentences) for each of the 98 components: needs writing per piece. "Works with" is already covered by the facts panel (iOS version, Liquid Glass, Metal).
5. Motion loops (2 to 6 s MP4) with VideoObject for components with motion: not made yet. The simulator recording pipeline (`npm run previews:record`) is the better source.
6. Not only Swift issue 105: the link to the issue, and any shipped App Store apps to list on About.

## Owner tasks (outside the code)

- Verify http to https and www to apex each 301 in one hop: `curl -sI http://swiftpieces.com/` and `curl -sIL https://www.swiftpieces.com/`. If not, turn on Always Use HTTPS or add a redirect rule in Cloudflare.
- Search Console: submit `https://swiftpieces.com/sitemap.xml` again after release (it is now an index), and watch each child sitemap's indexed count. Inspect 5 component URLs with "Test live URL".
- Bing Webmaster Tools: import from Search Console.
- Add `npm run indexnow -- --since HEAD~1` after the deploy step in Workers Builds.
- Run Lighthouse mobile on `/docs/components/cards/flip-card` after release (baseline from the audit: LCP 7.0 s).
- Re-run `npm run previews:capture` when a component's preview changes, and `npm run seo:lastmod` before committing content changes.
