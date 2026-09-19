# Swift Pieces

**Swift Pieces** — an open-source library of animated SwiftUI components. Copy-paste a file, or `npx swiftpieces add <name>`.

Looking for production-ready screens and complete app templates? → **[pro.swiftpieces.com](https://pro.swiftpieces.com)**

53 free pieces, licensed MIT + Commons Clause, across 14 categories, each a designed interaction rather than a primitive: text, backgrounds, glass, controls, inputs, cards, lists, navigation, sheets, feedback, motion, data, AI and media. Each is a single `.swift` file (plus a `.metal` file where a shader is involved) with a `#Preview`, an iOS 17 baseline, and `#available(iOS 26, *)` gates with Material fallbacks.

```bash
npx swiftpieces add AssistantOrb SwipeDeck
```

## What this repository is

The public half of Swift Pieces: the marketing site and docs at swiftpieces.com, the free registry (`/r/[name].json`), the free MCP server (`/api/mcp`), the `swiftpieces` CLI and the `@swiftpieces/brand` package. It ships with **no database, no billing, no entitlement logic and no authenticated routes**, so it can be read line by line and cached aggressively at the edge.

| Path | Purpose |
| --- | --- |
| `registry/swift/<category>/` | **Source of truth.** One `.swift` per piece with a `// swiftpieces:` header; `.metal` siblings for shaders. |
| `registry/__registry__/` | Generated registry JSON. |
| `content/docs/` | Fumadocs content. Per-piece pages are generated. |
| `app/` | Next.js 16 App Router: marketing, docs, `/api/registry/[name]`, `/api/mcp`, search. |
| `packages/cli/` | `swiftpieces` on npm: `init`, `add`, `list`, `login`, `whoami`. |
| `packages/brand/` | `@swiftpieces/brand` on npm: tokens, Tailwind theme, shared primitives. |
| `previews/` | Xcode preview harness and recorder. |
| `scripts/` | `build-registry.ts`, `typecheck-swift.sh`, `record-previews.ts`, `check-bundle-size.sh`, `audit-public.sh`. |

## Develop

```bash
npm install
npm run brand:build         # @swiftpieces/brand -> dist
npm run registry:build      # .swift -> registry JSON, docs pages, llms.txt, schema
npm run dev                 # next dev
npm run preview             # OpenNext build + wrangler dev (the real Worker runtime)
npm run swift:typecheck     # every piece against the iOS simulator SDK
npm run bundle:check        # Worker must stay under 8 MB compressed
npm run audit:public        # nothing Pro-shaped, nothing secret
```

There are no secrets to configure: everything below is optional, and the site builds and runs fully without it. Two env files are used, both gitignored: `.env.local` for `next dev` and `.env.production` for the deploy build.

**Analytics (swiftpieces.com only).** The official deploy counts page views with Cloudflare Web Analytics and shows recent visits under the hero. Forks and local builds leave these unset, so no beacon loads and the visit line never renders.

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_CF_BEACON_TOKEN` | `.env.production` | The Web Analytics beacon token. Public by design; inlined at build. |
| `CF_ACCOUNT_ID` | Worker secret | The Cloudflare account that owns the Web Analytics site. |
| `CF_WEB_ANALYTICS_SITE_TAG` | Worker secret | The site's tag (not the beacon token; they differ). |
| `CF_ANALYTICS_API_TOKEN` | Worker secret | An API token with **Account Analytics: Read**. A real credential: never commit it. |

Set the three secrets with `npx wrangler secret put <NAME>`. The visit count is cached for an hour (`lib/visits.ts`), so Cloudflare's API is called at most once an hour, not per page view.

## Deploy

swiftpieces.com deploys from GitHub with **Cloudflare Workers Builds**. Nothing is deployed from a laptop.

| Branch | What happens |
| --- | --- |
| `main` | Builds and deploys to production (swiftpieces.com). |
| any other branch / PR | Builds a preview version with its own URL. Production is untouched. |

GitHub Actions is here for **safety only**, because this repo is public and takes contributions. `ci.yml` checks every push and PR for leaked secrets, Pro-only code, a stale registry, type errors and bundle size. `swift.yml` type-checks every piece against the iOS SDK, and runs only when Swift, Metal or the preview app changes. Actions never deploys and holds no Cloudflare credentials; Cloudflare does the deploying.

**Workers Builds settings** (Cloudflare dashboard → Workers → `swiftpieces` → Settings → Build):

| Setting | Value |
| --- | --- |
| Git repository | this repo, production branch `main` |
| Build command | `npm run cf:build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Non-production branch deploy command | `npx opennextjs-cloudflare upload` |
| Builds for non-production branches | on |
| Build variables | `NODE_VERSION` = `22`, `NEXT_PUBLIC_CF_BEACON_TOKEN` = the Web Analytics token (optional) |

Build variables are read while building, not by the running Worker. The analytics token is only baked into `main` builds, so preview URLs never count toward the numbers.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Components welcome; Pro is closed.

## License

[MIT + Commons Clause License Condition v1.0](LICENSE).

- **You can** use, copy, modify and ship the pieces in any app, website or product, personal or commercial, including client work.
- **You can't** sell, sublicense or redistribute the pieces themselves, whether alone, in a bundle, or as a ported version.
