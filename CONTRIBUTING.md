# Contributing to Swift Pieces

Thanks for helping. This repository is the **free, open-source** library. It accepts new components, fixes, docs and previews. Swift Pieces Pro (blocks, screens, templates, Agent Kit) is closed source and lives in a private repository; please don't open PRs that add Pro-style content here.

## Adding a piece

1. Create `registry/swift/<category>/<Name>.swift` with a `// swiftpieces:` YAML header (`title`, `description`, `category`, `minIOSVersion`, `tags`; optional `shaders`, `registryDependencies`, `requiredCapabilities`, `infoPlist`).
2. Document every init parameter in the `///` doc comment; it becomes the Parameters table.
3. Include a representative `#Preview`; its body becomes the Usage snippet.
4. Add a scene to `previews/SwiftPiecesPreviews/PreviewCatalog.swift`.
5. Optionally add a web recreation in `components/previews/` and register it in `components/previews/index.tsx` and `registry.ts`.
6. Run `npm run swift:typecheck && npm run registry:build && npm run typecheck`.

## Rules

- Apple frameworks only. No third-party dependencies.
- iOS 17 baseline. Liquid Glass gated with `#available(iOS 26, *)` and a Material fallback.
- Every Apple API must exist in the SDK. CI type-checks every file against the iOS 26 simulator SDK.
- Respect Reduce Motion and Reduce Transparency, use semantic colors, support Dynamic Type.
- No secrets, no entitlement code, no database. `npm run audit:public` enforces this.

## License

By contributing you agree your contribution is licensed under MIT + Commons Clause, the same as the library.
