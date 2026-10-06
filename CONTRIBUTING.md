# Contributing to SwiftPieces

Thanks for helping. This repository is the **free, open-source** library. It accepts new components, fixes, docs and previews.

SwiftPieces Pro (blocks, screens, templates, Build Kit) is closed source and lives in a private repository. Please don't open PRs that add Pro-style content here; `npm run audit:public` will fail them, and so will CI.

## Before you start

- **Small fix?** Open a PR directly.
- **New piece, or a change to how pieces work?** Open an issue first. A piece that duplicates an existing one, or that is a primitive rather than a designed interaction, is the most common reason a PR is turned down, and an issue costs you nothing to find that out.
- **Not sure it belongs?** Ask in an issue. The bar is "a designed interaction you would otherwise spend a day building", not "a wrapper around a system control".

## Setup

You need Node 22.22 or newer (`.nvmrc` has the line CI uses) and, for Swift work, Xcode with an iOS simulator SDK installed.

```bash
git clone https://github.com/<you>/SwiftPieces.git   # your fork
cd SwiftPieces
npm install
npm run brand:build      # first run only
npm run registry:build
npm run dev
```

## What your commands can reach

Everything in this repo runs against your own copy. No script in `package.json` deploys, publishes or uploads anything, so all of these are safe to run as often as you like:

| Command | What it checks |
| --- | --- |
| `npm run registry:build` | regenerates the registry, docs pages and `llms.txt` from `registry/swift/` |
| `npm run typecheck` | TypeScript |
| `npm run swift:typecheck` | every piece against the iOS simulator SDK |
| `npm run audit:public` | nothing Pro-shaped, nothing secret |
| `npm run dev` | the site on localhost |
| `npm run preview` | builds the Worker and runs it locally |
| `npm run bundle:check` | the built Worker stays under 8 MB compressed (run `preview` first) |

They read and write files in your clone, and nothing else. None of them can change swiftpieces.com, the registry the CLI and MCP server read from, the npm packages or the Cloudflare setup.

The same goes for the tools underneath. Wrangler and OpenNext only act on a Cloudflare account you're signed in to, and only the maintainer can sign in to the one behind swiftpieces.com. Only the maintainer's npm account can publish `swiftpieces` or `@swiftpieces/brand`. A change reaches swiftpieces.com one way only: a pull request the maintainer reviews and merges into `main`, which Cloudflare then builds and deploys.

## Adding a piece

1. Create `registry/swift/<category>/<Name>.swift` with a `// swiftpieces:` YAML header (`title`, `description`, `category`, `minIOSVersion`, `tags`; optional `shaders`, `registryDependencies`, `requiredCapabilities`, `infoPlist`).
2. Document every init parameter in the `///` doc comment; it becomes the Parameters table on the site.
3. Include a representative `#Preview`; its body becomes the Usage snippet.
4. Add a scene to `previews/SwiftPiecesPreviews/PreviewCatalog.swift`.
5. Optionally add a web recreation in `components/previews/` and register it in `components/previews/index.tsx` and `registry.ts`.
6. Run the checks below.

```bash
npm run swift:typecheck && npm run registry:build && npm run typecheck
```

`registry:build` regenerates `registry/__registry__`, `content/docs`, `public/llms.txt` and `public/schema`. **Commit what it generates.** CI fails if the generated output does not match the source, so a PR that edits a `.swift` file without rerunning the build will be rejected, and so will a hand edit to the generated files.

## Rules

- Apple frameworks only. No third-party dependencies.
- iOS 17 baseline. Liquid Glass gated with `#available(iOS 26, *)` and a Material fallback.
- Every Apple API must exist in the SDK. CI type-checks every file against the iOS 26 simulator SDK.
- Respect Reduce Motion and Reduce Transparency, use semantic colors, support Dynamic Type.
- One piece per file. A piece is self-contained: no shared helper files, no cross-piece imports beyond declared `registryDependencies`.
- No secrets, no entitlement code, no database. `npm run audit:public` enforces this.

## Files only the maintainer changes

Some files build, deploy or configure SwiftPieces rather than make up the library. Pull requests from forks shouldn't change them:

- **Dependencies:** any `package.json`, `package-lock.json` or `.npmrc`
- **Repo setup:** `.github/`, `.gitignore`, `.gitattributes`, `.nvmrc`, `LICENSE`
- **Build and deploy:** `scripts/`, `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`, `postcss.config.mjs`, any `tsconfig*.json`, `cloudflare-env.d.ts`
- **Runtime config:** `middleware.ts`, `instrumentation-client.ts`, `public/_headers`
- **Xcode project files:** anything inside a `.xcodeproj` or `.xcworkspace`, plus `.xcscheme`, `.xcconfig` and `.entitlements` files and `Package.swift`

These decide what runs during an install, a build and a deploy, on CI and on the maintainer's machine. So the **Protected files** check fails a pull request from a fork that touches one. That's a flag for the maintainer, not a rejection: if your change genuinely needs one of these files, say why in the description, or better, open an issue first.

## Pull requests

Fork the repo, branch off `main` and open the PR against `main`. Leave **Allow edits by maintainers** on, so a rebase or a one-line fix can be pushed to your branch instead of going back and forth.

Write the description like a short bug report and its answer. The template asks for four things:

- **What this changes.** What someone using the piece will notice, in a sentence or two.
- **Why it happens.** The root cause, in plain words. For a new piece or feature, the problem it solves.
- **The fix.** What you changed, and why this approach. Mention anything that rides along, and the version bump.
- **How it was tested.** Device or simulator and iOS version, what you tried, and what you couldn't try.

A fix to TaskRow, for example, might read:

> **What this changes.** With `onMove` set, tapping a TaskRow's check circle did nothing. Now it completes the task.
>
> **Why it happens.** Hold-to-reorder was a `highPriorityGesture`, so it beat the circle's Button and the tap never arrived.
>
> **The fix.** Hold-to-reorder runs as a `simultaneousGesture`, so the tap gets through. Version 2.0.0 to 2.0.1.
>
> **How it was tested.** iPhone 17 Pro simulator, iOS 26.2: the circle completes the task, hold and drag still reorders, and swiping still shows Snooze and Delete. Not tried on iOS 17.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`. The subject line says what changed, in the present tense.

CI on a pull request from a fork waits for the maintainer to approve the run, so a new PR can show "waiting for approval" for a while. That's expected. Once it runs, it must be green before review:

| Check | What it does |
| --- | --- |
| Secret scan | gitleaks over the diff |
| Registry freshness | `registry:build` output must match what you committed |
| TypeScript | `npm run typecheck` |
| Bundle gate | the Worker must stay under 8 MB compressed |
| Public-safety audit | nothing Pro-shaped, nothing secret |
| Swift type-check | every piece against the iOS simulator SDK, when Swift or Metal changed |
| Protected files | fails if a PR from a fork changes a [maintainer-only file](#files-only-the-maintainer-changes) |

Pull requests from forks don't get a preview deployment, because Cloudflare only builds branches in this repository. That's why the test notes matter, and why a screen recording helps with anything visual.

Keep PRs focused. One piece, or one fix, per PR. A PR that adds a piece and refactors the build at the same time takes far longer to review.

## Reporting bugs

Use the issue templates. For a broken piece, the two things that matter most are the **iOS version** and whether it reproduces in the `previews/` harness, because most reports turn out to be version-gated behavior rather than a bug in the piece.

## Security

Don't open a public issue for a vulnerability. [SECURITY.md](SECURITY.md) explains how to report one privately.

## Code of Conduct

Taking part means following the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree your contribution is licensed under MIT + Commons Clause, the same as the library. In short: anyone can ship your piece in their app, and nobody can sell it on as a product of its own.
