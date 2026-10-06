<!--
Thanks for the PR. Write it like a short bug report and its answer: what changes, why it happens,
and how the fix deals with it. CONTRIBUTING.md has an example.
-->

## What this changes

<!-- What someone using the piece will notice, in a sentence or two. If it closes an issue, add "Closes #123". -->

## Why it happens

<!-- The root cause, in plain words: the API, gesture or line responsible.
For a new piece or feature: the problem it solves, and why it belongs in the library. -->

## The fix

<!-- What you changed, and why this approach over the obvious alternative. Mention anything that
rides along, and the version bump (for example 2.0.0 to 2.0.1). -->

## How it was tested

<!-- Device or simulator, and iOS version. What you tried: the case that was broken, and the nearby
behavior that must keep working. Say what you couldn't test. Pull requests from forks don't get a
preview deployment, so a screen recording helps with anything visual. -->

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
- [ ] No [maintainer-only files](https://github.com/Saivion/SwiftPieces/blob/main/CONTRIBUTING.md#files-only-the-maintainer-changes) changed (dependencies, CI, build, deploy or Xcode project files), or the description says why

## For a new piece

- [ ] `// swiftpieces:` header is complete
- [ ] Every init parameter has a `///` doc comment
- [ ] Includes a representative `#Preview`
- [ ] Added to `previews/SwiftPiecesPreviews/PreviewCatalog.swift`
- [ ] Apple frameworks only, iOS 17 baseline, newer APIs gated with a fallback
- [ ] Reduce Motion and Reduce Transparency are respected

## Notes for the reviewer

<!-- Anything non-obvious: a tradeoff, something you're unsure of, another PR this one overlaps with. -->
