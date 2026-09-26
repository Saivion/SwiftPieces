# @swiftpieces/builder

The core of the SwiftPieces playground (swiftpieces.com/playground) and builder (pro.swiftpieces.com/builder): component → customize → compose → export.

One structured representation drives everything. A screen is a tree of `ScreenNode`s; each node names a `SwiftPieceDefinition`, and that one definition supplies the library entry, the property editor, the web preview renderer key and the SwiftUI emitter. What you see is generated from the same tree as what you download.

```
@swiftpieces/builder          pure TS, server-safe
  core/schema.ts              SwiftPieceDefinition, PropertyDefinition, ScreenNode, Project, limits
  core/registry.ts            createRegistry(...groups): Free passes the shared definitions, Pro adds its own
  core/validate.ts            the one gate for drafts, URLs, saved projects, templates and AI output
  core/tree.ts                immutable edits with structural sharing
  core/generate.ts            ScreenNode tree → formatted SwiftUI (+ node → line ranges for the code view)
  core/glossary.ts            Web → SwiftUI phrasebook for "What's this?"
  core/intent.ts              local describe-a-screen matcher (the no-AI fallback)
  core/events.ts              analytics allow-list shared by both /api/events endpoints
  definitions/                native primitives, the free pieces, free templates
@swiftpieces/builder/export   loaded on demand: zip writer, Xcode 16 project, registry source resolver
@swiftpieces/builder/react    the builder UI (client only; import builder.css on the route)
```

## Using it

```tsx
import "@swiftpieces/builder/builder.css";
import { FREE_LIMITS, createRegistry, createTemplateRegistry, freeDefinitions, freeTemplates } from "@swiftpieces/builder";
import { Builder, beaconTracker } from "@swiftpieces/builder/react";

<Builder
  host={{
    product: "SwiftPieces",
    limits: FREE_LIMITS,
    registry: createRegistry(freeDefinitions),
    templates: createTemplateRegistry(freeTemplates),
    resolveSource: (piece) => /* fetch the piece's files */,
    track: beaconTracker("/api/events"),
    storageKey: "sp:playground",
    links: { pro: "…", docs: (p) => p, install: "/docs/installation" },
  }}
/>
```

A host adds components with `createRegistry(freeDefinitions, myDefinitions)` and their web renderers with `registerRenderers({ ids, load: () => import("./renderers") })`.

## Adding a component

1. Write a `SwiftPieceDefinition`: properties (only the ones that make sense), and `swift.emit`, which must call the Swift API exactly as declared (labels, order, only non-default arguments).
2. Add a renderer with the same id that reads the same props.
3. `npm test` checks defaults, emits well-formed Swift for every definition, and (in this repo) that free pieces exist in the registry.

## Scripts

- `npm run build` — `tsc` to `dist/`
- `npm test` — node:test via tsx (no extra dependencies)
- `npm run e2e` — browser checks against running sites; see `e2e/builder.e2e.mjs`
