# Contributing to Swift Pieces

Thanks for helping. This repository is the **free, open-source** library. It accepts new components, fixes, docs and previews.

Swift Pieces Pro (blocks, screens, templates, Build Kit) is closed source and lives in a private repository. Please don't open PRs that add Pro-style content here; `npm run audit:public` will fail them, and so will CI.

## Before you start

- **Small fix?** Open a PR directly.
- **New piece, or a change to how pieces work?** Open an issue first. A piece that duplicates an existing one, or that is a primitive rather than a designed interaction, is the most common reason a PR is turned down, and an issue costs you nothing to find that out.
- **Not sure it belongs?** Ask in an issue. The bar is "a designed interaction you would otherwise spend a day building", not "a wrapper around a system control".

## Setup

You need Node 22 (what CI uses) and, for Swift work, Xcode with an iOS simulator SDK installed.

```bash
git clone https://github.com/Saivion/SwiftPieces.git
cd SwiftPieces
npm install
npm run brand:build      # first run only
npm run registry:build
npm run dev
```

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

`registry:build` regenerates `registry/__registry__`, `content/docs`, `public/llms.txt` and `public/schema`. **Commit what it generates.** CI fails if the generated output does not match the source, so a PR that edits a `.swift` file without rerunning the build will be rejected.

## Rules

- Apple frameworks only. No third-party dependencies.
- iOS 17 baseline. Liquid Glass gated with `#available(iOS 26, *)` and a Material fallback.
- Every Apple API must exist in the SDK. CI type-checks every file against the iOS 26 simulator SDK.
- Respect Reduce Motion and Reduce Transparency, use semantic colors, support Dynamic Type.
- One piece per file. A piece is self-contained: no shared helper files, no cross-piece imports beyond declared `registryDependencies`.
- No secrets, no entitlement code, no database. `npm run audit:public` enforces this.

## Pull requests

Branch off `main` and open the PR against `main`.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`. The subject line says what changed, in the present tense.

Every PR runs CI, which must be green before review:

| Check | What it does |
| --- | --- |
| Secret scan | gitleaks over the diff |
| Registry freshness | `registry:build` output must match what you committed |
| TypeScript | `npm run typecheck` |
| Bundle gate | the Worker must stay under 8 MB compressed |
| Public-safety audit | nothing Pro-shaped, nothing secret |
| Swift type-check | every piece against the iOS simulator SDK, when Swift or Metal changed |

PRs that touch Swift also get a preview deployment with its own URL, so the piece can be seen running before merge.

Keep PRs focused. One piece, or one fix, per PR. A PR that adds a piece and refactors the build at the same time takes far longer to review.

## Reporting bugs

Use the issue templates. For a broken piece, the two things that matter most are the **iOS version** and whether it reproduces in the `previews/` harness, because most reports turn out to be version-gated behavior rather than a bug in the piece.

## Security

Don't open a public issue for a vulnerability. [SECURITY.md](SECURITY.md) explains how to report one privately.

## Code of Conduct

Taking part means following the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree your contribution is licensed under MIT + Commons Clause, the same as the library. In short: anyone can ship your piece in their app, and nobody can sell it on as a product of its own.
