## What this changes

<!-- One or two sentences. If it closes an issue, say "Closes #123". -->

## Type

- [ ] New piece
- [ ] Fix to an existing piece
- [ ] Site, docs or previews
- [ ] CLI, registry build or tooling

## Checks

<!-- Run these locally. CI runs them too, and will fail the PR otherwise. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run registry:build` was rerun and the generated output is committed
- [ ] `npm run swift:typecheck` passes (if Swift or Metal changed)
- [ ] `npm run audit:public` passes

## For a new piece

- [ ] `// swiftpieces:` header is complete
- [ ] Every init parameter has a `///` doc comment
- [ ] Includes a representative `#Preview`
- [ ] Added to `previews/SwiftPiecesPreviews/PreviewCatalog.swift`
- [ ] Apple frameworks only, iOS 17 baseline, newer APIs gated with a fallback
- [ ] Reduce Motion and Reduce Transparency are respected

## Notes for the reviewer

<!-- Anything non-obvious: a tradeoff you made, something you are unsure about, a screen recording. -->
