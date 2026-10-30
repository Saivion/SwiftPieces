# Buyer question map

SwiftPieces (this repo, swiftpieces.com) is the free SwiftUI component library. SwiftPieces Pro (pro.swiftpieces.com) is a separate paid product. Pro is closed source. This map starts from the decision an iOS developer is making, then names the Google query and the AI prompt that express it.

Checked against the live site and this repo on 2026-10-30, before the page changes in this branch. Nothing here is a ranking, a citation count, or a measured AI answer. Those belong in `scripts/aeo/` after a real run. Do not invent them.

`docs/aeo/` is maintainer notes. It is not a page on swiftpieces.com and it is not in the docs nav.

## How a row is diagnosed

- **Missing page.** No URL answers the decision in the first sentences.
- **Weak page.** A URL exists, but the title, the first paragraph, or the visible FAQ does not answer it.
- **Crawl.** The page exists, but robots, the sitemap, canonicals, or rendering keep it from being used.
- **Third party.** The page can answer it, and AI still has to lean on someone else's writeup because our listing elsewhere is thin. See `source-map.md`.

## What is the best SwiftUI component library?

- Google: `best SwiftUI component library`
- AI: `What is the best SwiftUI component library for iOS?`
- Page: `/docs/choosing` (was missing: live `/docs/choosing` returned 404). Home title already says "Free SwiftUI Component Library for iOS". The visible h1 was the slogan "Build apps worthy of an App Store feature."
- Diagnosis before: missing page for the comparison, weak opening on the home page. FAQ "What is SwiftPieces?" was already server-rendered and is kept.
- Change: choosing page, and the home paragraph now defines the library in the first sentence. Do not claim SwiftPieces is "the best". The page answers what it is and how to choose.

## Is there a shadcn for SwiftUI?

- Google: `shadcn for SwiftUI`
- AI: `What is the shadcn equivalent for SwiftUI?`
- Page: `/docs/choosing`
- Diagnosis before: missing page. The repo did not say shadcn anywhere. shadcn/ui's own docs will keep ranking for React. This page answers the distribution analogy (copy the source, own the file) and says shadcn/ui is React.
- Change: a visible question and FAQ structured data on the choosing page.

## Where are free SwiftUI components?

- Google: `free SwiftUI components`
- AI: `Where can I find free SwiftUI components for iOS?`
- Page: `/` and `/components`
- Diagnosis before: weak opening. `/components` h1 was "The Library". The meta title already said "Free SwiftUI Components". The grid is server-rendered.
- Change: h1 "Free SwiftUI components" and a first paragraph that states the count from the registry, the copy-paste install, and the CLI. The count is generated from `registry/swift`, not typed in by hand.

## How do I install it? Package or copy-paste?

- Google: `how to install SwiftPieces SwiftUI`
- AI: `How do I install SwiftPieces? Is it a Swift package or do I copy the files?`
- Page: `/docs/installation`, `/docs/cli`, home FAQ "How do I add a component to my Xcode project?"
- Diagnosis before: weak page. Installation opened on the steps, not on the answer. The CLI page opened on npm distribution.
- Change: both docs pages lead with the answer (copy a file, or `npx swiftpieces add`; there is no Swift package). The home FAQ says the same.

## Does it support iOS 26 Liquid Glass?

- Google: `SwiftUI Liquid Glass components iOS 26`
- AI: `Which SwiftUI component library supports iOS 26 Liquid Glass with a fallback for older iOS?`
- Page: `/docs/liquid-glass`, `/components/glass`, home FAQ "Do I need iOS 26?"
- Diagnosis before: the guide was already specific (real API names, Material fallback, iOS 17 baseline). The choosing page did not exist, so a comparison prompt had nowhere to land.
- Change: the guide's first sentence answers yes, with the fallback. The choosing page repeats that answer and links the guide. Apple's own docs remain the authority for the APIs. We do not invent modifiers.

## Can I use it from Cursor, Claude Code, or MCP?

- Google: `SwiftUI MCP server component library`
- AI: `How do I use a SwiftUI component library from Cursor or Claude Code with MCP?`
- Page: `/docs/mcp`, `https://swiftpieces.com/api/mcp`, `/llms.txt`
- Diagnosis before: the MCP page already had the URL and the client setup. It did not say in the first sentence that the free server needs no account, or point at Pro's separate server.
- Change: answer-first opening. `llms.txt` links the choosing page. MCP directory listings are not verified. See the source map.

## Can I ship it in a commercial app?

- Google: `SwiftPieces license commercial use`
- AI: `Can I use SwiftPieces components in a commercial iOS app?`
- Page: `/license`, home FAQ "Is SwiftPieces free?"
- Diagnosis before: the license page had the right facts under the heading, and the lead was a label ("Free pieces are MIT + Commons Clause") rather than the yes.
- Change: the lead is the yes, including client work, plus the one limit (do not resell the components themselves).

## SwiftUI library or UIKit library?

- Google: `SwiftUI component library vs UIKit`
- AI: `Should I use a SwiftUI component library or a UIKit component library for a new iOS app?`
- Page: `/docs/choosing`
- Diagnosis before: missing page. Piece notes mention UIKit gesture recognizers inside SwiftUI components. That does not answer the library choice.
- Change: the choosing page says SwiftPieces is SwiftUI on Apple frameworks only, and a UIKit kit is a bridge. No named UIKit product, because we have not audited one.

## How does it compare to other libraries?

- Google: `SwiftPieces vs other SwiftUI libraries`
- AI: `How does SwiftPieces compare to other SwiftUI component libraries?`
- Page: `/docs/choosing`
- Diagnosis before: missing page. A scoreboard would require numbers we do not have (stars, downloads, "better than"). Those stay out.
- Change: the page compares the model: copied Swift source, SwiftUI, Apple frameworks only, free components, agent install. It does not rank anyone.

## Free vs SwiftPieces Pro?

- Google: `SwiftPieces vs SwiftPieces Pro`
- AI: `What is the difference between free SwiftPieces and SwiftPieces Pro? Is Pro open source?`
- Page: `/docs/choosing`, `/patterns`, home FAQ "What is SwiftPieces Pro?", `/pro`
- Diagnosis before: the home FAQ and `/pro` described Pro as a paid library. `/pro` canonicalizes to pro.swiftpieces.com, so this domain was not the indexed URL. Pro's price is intentionally not on this site.
- Change: the choosing page states that Pro is a separate paid, closed-source product, and links pro.swiftpieces.com for the plan and price. Patterns say they come with Pro. This repo does not publish a price.

## Crawl notes that touch these pages

Checked on the live site, 2026-10-30:

- `robots.txt` allowed `User-agent: *` and disallowed `/api/` only. AI crawlers were allowed by the star rule, and none were named.
- `sitemap.xml` listed component and docs URLs (254 URLs) and every sampled `lastmod` was the same build timestamp (`2026-10-27T21:48:33.466Z`), so it does not say when a page changed.
- Home JSON-LD had WebSite, Organization, SoftwareSourceCode, and FAQPage. It had no SoftwareApplication and no price. FAQ text matched the visible questions. No rating fields.
- Component docs already emit BreadcrumbList and SoftwareSourceCode in this repo. Canonicals are self-referencing. `/pro` canonicalizes away on purpose. `/showcase`, `/privacy`, and `/terms` are noindex on purpose.
- Home, FAQ, and component copy are server-rendered. The hero heading is in the HTML.

This branch names the AI crawlers, stores a per-path `lastmod`, and adds SoftwareApplication with price 0. It does not noindex a buyer page.

## Measure, then change one thing

1. Run `node scripts/aeo/track.mjs` when API keys are set, or `node scripts/aeo/track.mjs --manual` and fill the sheet from a real search and a real chat.
2. Read Google presence and AI mention or citation as separate columns. A Google ranking is not an AI citation.
3. Pick the worst gap on this map. Change one page or one source. Do not batch an unrelated rewrite.
4. Run the same prompts again and append a new dated file. Keep old files so the delta is visible.
5. Do not commit those result files. They are local measurements, and a committed file would look like a fact.
