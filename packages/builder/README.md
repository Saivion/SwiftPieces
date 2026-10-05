# @swiftpieces/builder

The engine behind the Playground on swiftpieces.com: one per app in the app library (/playground/lungy: the app's recreated screens beside its App Store screenshots). Three apps are free; the rest open for Pro accounts, whose screens come from the Pro API (see Patterns). Pro (pro.swiftpieces.com) uses the core to validate what the Playground saves and asks for.

**Explore → Interact → Inspect → Remix → Build.** Someone opens a screen, a flow, a UI element or an interaction, uses it on a running iPhone (taps, swipes, sheets, springs, haptics), takes any part apart, remixes it, and takes the SwiftUI.

One structured representation drives everything. No Swift runs in the browser:

```
            SwiftPieceDefinition (props, variants, states, anatomy, interactions)
                 │                                   │
        web renderer (runtime)               swift.emit (generator)
                 │                                   │
        the Playground's device               real SwiftUI (swiftc-checked)
```

```
@swiftpieces/builder            pure TS, server-safe
  core/schema.ts                SwiftPieceDefinition, PropertyDefinition, ScreenNode, Project, limits
  core/catalog.ts               CatalogEntry (screens, flows, elements, interactions), createCatalog, buildCatalogProject
  core/interactions.ts          the interaction vocabulary (tap, swipe, hold, sheet, spring, haptic…)
  core/inspect.ts               property groups, anatomy, node → SwiftUI snippet
  core/registry.ts              createRegistry(...groups): Free passes the shared definitions, Pro adds its own
  core/validate.ts              the one gate for URLs, saved remixes, shared links and AI output
  core/tree.ts                  immutable edits with structural sharing
  core/generate.ts              ScreenNode tree → SwiftUI (+ node line ranges); links → NavigationLink,
                                .sheet, @AppStorage root switch; TabView for tab apps
  core/share.ts                 a project as one URL-safe string (share links, Open in Xcode, Pro handoff)
  core/glossary.ts              SwiftUI concepts in plain words, with the web equivalent
  definitions/                  native primitives + native.ts, the free pieces (pieces*.ts)
  definitions/catalog/          the free catalog: entries.ts (metadata) + one module of builds per kind;
                                recreations/, the app library's recreations (the free ones' builds)
@swiftpieces/builder/catalog    freeCatalogSource and patternsCatalogSource (entries + lazy builds), and the kit builds are written in
@swiftpieces/builder/export     loaded on demand: zip writer, Xcode project, registry sources, Git repo
@swiftpieces/builder/react      the Playground UI and the interactive runtime (client only)
```

## The runtime

Renderers are small React components that behave like the SwiftUI they stand for. They get the node's props and reach the running app through hooks in `react/preview/runtime.tsx`:

- `useTap(link)` follows a link: push a screen, present it as a sheet (`sheet:<id>`), finish into a new root (`root:<id>`), or go back.
- `useLive(prop)` is `@State` seeded from a prop: it resets when the prop is remixed.
- `useDrag({ onStart, onMove, onEnd, axis })` gives drags in points with velocity.
- `useChoice(group, id)` shares one selection between sibling options.
- `useRuntime().haptic(kind, el)` shows a haptic where it happens and names its `.sensoryFeedback`.
- `useRuntime().overlay()` is the phone-wide layer for toasts, menus and sheets a component presents.

The device keeps a NavigationStack per tab, sheets with detents and drag-to-dismiss, edge swipe back, and an Inspect overlay that measures the selected node each frame, so selecting never re-renders a node. Renderer chunks load per `preview.chunk`, so a screen downloads only what it uses.

## Hosting one thing

A host that opens one thing instead of the catalog (an app's recreation) passes `sidebar` (its own left panel, rendered inside the Playground so it can use `usePlayground`, `usePlay` and `currentScreenId`) and `crumbs`. The Playground then never switches entries on its own. `initial.step` opens a flow at a step; `links.entryPath` names the page share links point at.

## Patterns

Each app in the sites' app library is paired with one pattern: an original screen or flow in `definitions/catalog/recreations/`. Our names, copy and colors; nothing here names or depicts a third-party app (the sites keep the App Store facts and label them as the developer's).

Every app's entry is here (`<slug>.ts`: what it is, its steps, what makes each screen work). Three apps are free (`FREE_RECREATIONS`) and built here (`<slug>.build.ts`); the rest are Pro (`availability: "pro"`) and their builds live only in the Pro repo (`lib/apps/builds`), written with the same kit (`@swiftpieces/builder/catalog`). On a plan without Pro a Pro entry opens locked: nothing of it loads, and the host draws the stage (`lockedStage`). When the plan changes to Pro, the entry opens as it was asked for. Free's playground adds a catalog source that fetches the Pro builds from the Pro API for Pro sessions. `test/patterns.test.ts` checks the free patterns build clean and that no Pro build is in this package, and `npx tsx scripts/typecheck-playground.ts patterns` compiles them; Pro's `tests/apps.test.ts` does the same for its builds.

## Using it

```tsx
import "@swiftpieces/builder/builder.css";
import { FREE_LIMITS, createCatalog, createRegistry, freeDefinitions } from "@swiftpieces/builder";
import { freeCatalogSource } from "@swiftpieces/builder/catalog";
import { Playground, beaconTracker } from "@swiftpieces/builder/react";

<Playground
  host={{
    product: "SwiftPieces",
    limits: FREE_LIMITS,
    registry: createRegistry(freeDefinitions),
    catalog: createCatalog(freeCatalogSource),
    basePath: "/playground",
    resolveSource,
    track: beaconTracker("/api/events"),
    storageKey: "sp:play",
    links: { pro: "…", component: (def) => def.docs ?? null, install: "/docs/installation" },
  }}
  initial={{ kind: "screens", slug: "paywall", project /* built on the server */ }}
/>
```

Pro passes `createRegistry(freeDefinitions, proDefinitions)`, `createCatalog(freeCatalogSource, proCatalogSource)`, `PRO_LIMITS`, and the optional `cloudSave` and `remixWithAI`. Renderers for host components register with `registerRenderers({ ids, load })`.

## Adding a component

1. A `SwiftPieceDefinition` in `definitions/`: meaningful properties only, `anatomy`, `interactions`, `variants`, `states`, and `swift.emit`, which must call the Swift API exactly as declared (labels, order, only non-default arguments).
2. A renderer with the same id in the definition's chunk, interactive (see the runtime above).
3. Feature it in a catalog entry, so it has somewhere to be tried.
4. Check it: `npm test` here, and from the repo root `npx tsx scripts/typecheck-playground.ts definitions <id>`, which compiles the generated SwiftUI with `swiftc` against the iOS SDK in every variant and state (`all` also compiles every catalog entry as a whole app).

## Scripts

- `npm run build` — `tsc` to `dist/` (the sites import the dist; rebuild after editing)
- `npm test` — node:test via tsx
