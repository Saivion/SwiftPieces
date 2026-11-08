# Performance

The loop is always measure, change one thing, measure again. Guesses like scattering `.equatable()`, `.drawingGroup()` or `@MainActor` hops make things worse as often as better.

## Measure in the right build

- Profile a **Release** build (Product, Profile in Xcode, or `xcodebuild -configuration Release`) on the **oldest device you support**. Debug builds are several times slower in SwiftUI diffing; the simulator runs on a Mac GPU and hides hitches entirely.
- Instruments templates: **SwiftUI** (view body counts and update causes), **Animation Hitches** (hitch time ratio; aim under 5 ms/s, and any single hitch in the hero flow is a defect), **Time Profiler**, **Allocations** and **Leaks**.
- In Debug, `let _ = Self._printChanges()` at the top of a `body` logs what invalidated it. Remove it before shipping.

## Re-render storms

Symptoms: a drag or typing invalidates the whole screen.

- Split large `body`s into small views that each read only what they show; `@Observable` tracks reads per view.
- Don't pass a whole model to rows that need two fields; pass the fields or the item.
- Keep fast-changing state (drag offset, scroll position, a timer) in the smallest view that uses it.
- Avoid computing heavy derived data in `body`; cache it on the model and update it when inputs change.
- No `AnyView` in lists; use `@ViewBuilder` and concrete types so SwiftUI can diff.

## Lists

- `List` or `LazyVStack` for anything that can grow; `ForEach` over `Identifiable` data with stable ids.
- Never `id: \.self` on non-unique values, and never indices as ids for mutable collections.
- Paginate with `.onAppear` on a sentinel row near the end, or `.onScrollTargetVisibilityChange` (iOS 18).
- Images in rows: decode and downsample to the displayed size off the main actor, cache by URL, cancel on disappear (`.task(id: url)` does this).

## Launch

- Keep the `App` initializer and the first `body` light: no synchronous disk, network or large decoding.
- Show `LaunchView` (matching the launch screen) while the session resolves in `.task`, then swap root phase.
- Defer non-critical setup (analytics, prefetch) to after first frame with a lower-priority `Task`.
- Watch the **App Launch** instrument; time to first frame should not regress between builds.

## Memory

- Sheets and covers that hold large models are released on dismiss; check with the memory graph debugger that they are.
- Closures stored on `@Observable` models capture `[weak self]` when they outlive the view.
- Timers and `TimelineView`s stop when their view disappears; long-running `Task`s check `Task.isCancelled`.

## Shaders and Canvas

- Prefer `Canvas` over hundreds of views for particles or charts; prefer a Metal shader over `Canvas` for per-pixel effects.
- `.drawingGroup()` flattens a subtree into one Metal layer. It helps for many overlapping vector shapes and hurts when the content changes every frame or contains text people read. Measure first.
