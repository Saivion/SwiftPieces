# Navigation in SwiftUI

How to wire the navigation laws. Every snippet compiles against iOS 17 unless marked.

## The root phase: where one-way doors live

The app root switches on one phase. Moving between phases is a root swap, so the old screens leave the hierarchy and no back gesture can return to them.

```swift
enum AppPhase: Equatable { case launching, onboarding, signedOut, ready }

@Observable final class Session {
    var phase: AppPhase = .launching
    func resolve() async { /* read the keychain and stored flags, then set phase */ }
}

struct RootView: View {
    @State private var session = Session()

    var body: some View {
        Group {
            switch session.phase {
            case .launching: LaunchView()          // matches the launch screen, so the hand-off is invisible
            case .onboarding: OnboardingFlow()
            case .signedOut: SignInView()
            case .ready: MainTabs()
            }
        }
        .animation(.easeOut(duration: 0.25), value: session.phase)   // a cross-fade, not a slide
        .environment(session)
        .task { await session.resolve() }
    }
}
```

- Finishing onboarding, Skip included, sets `phase = .ready`. Never push Home onto the onboarding stack.
- Sign-out sets `phase = .signedOut` and clears per-user state.
- Cold start stays on `LaunchView` until `resolve()` finishes, so Login never flashes before Home.

## Stacks and paths

```swift
enum Route: Hashable { case trip(Trip.ID), stop(Stop.ID), settings }

@Observable final class Router {
    var path: [Route] = []
    func popToRoot() { path.removeAll() }
}

struct TripsTab: View {
    @Bindable var router: Router   // owned above the TabView, so the stack survives tab switches

    var body: some View {
        NavigationStack(path: $router.path) {
            TripsList()
                .navigationTitle("Trips")
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .trip(let id): TripDetail(id: id)
                    case .stop(let id): StopDetail(id: id)
                    case .settings: SettingsView()
                    }
                }
        }
        .environment(router)
    }
}
```

- `NavigationLink(value: Route.trip(trip.id))` in lists; `router.path.append(...)` from code.
- "Finish this flow and land on X" is `router.path = [.x]`, not a series of pops.
- Pass ids, not models, in routes, so the path stays `Hashable` and restorable and the destination reads fresh data.

## Presentations

| What it is | Use | Dismissal |
| --- | --- | --- |
| A task with steps | `.sheet(item:)` holding its own `NavigationStack` | Cancel (`.cancellationAction`) and Done (`.confirmationAction`) in its toolbar |
| A short interruption | `.sheet` with `.presentationDetents([.medium, .large])` and `.presentationDragIndicator(.visible)` | Swipe down |
| Immersive content | `.fullScreenCover` | An explicit Close, plus swipe-down via `DragToDismiss` where it fits |
| Floating over a visible screen | An overlay in the same tree: `ConfirmSheet`, `Toast`, `NoticeStack`, `SpotlightTour` | Tap outside, timeout or its own action |
| Destructive confirm | `.confirmationDialog` | System |
| Item actions | `.contextMenu` | System |

- Drive presentations from optional item state (`.sheet(item: $editing)`) rather than a `Bool` plus a separate value, so the sheet can never show stale data.
- If a deep link or notification can open it, the item lives on a model the link handler can reach, not in a private `@State`.
- A sheet's `NavigationStack` is its own; never push the presenter's routes inside it.

## Doors that keep the user's place

Sign-in demanded by one action, and a paywall opened from a feature, are sheets that finish the action where it was tapped.

```swift
struct SaveButton: View {
    @Environment(Session.self) private var session
    @State private var needsSignIn = false
    let save: () async -> Void

    var body: some View {
        Button("Save") {
            if session.isSignedIn { Task { await save() } } else { needsSignIn = true }
        }
        .sheet(isPresented: $needsSignIn) {
            SignInSheet { Task { await save() } }   // on success: dismiss, then complete the save
        }
    }
}
```

A paywall from a locked feature works the same way: on purchase, dismiss and the feature is unlocked underneath. Never reset to the home tab from either.

## Blocking back, the two allowed cases

```swift
.interactiveDismissDisabled(draft.hasChanges)     // unsaved work: swipe-down is blocked...
.toolbar {
    ToolbarItem(placement: .cancellationAction) {
        Button("Cancel") { draft.hasChanges ? (confirmDiscard = true) : dismiss() }   // ...and Cancel asks first
    }
}
.confirmationDialog("Discard this draft?", isPresented: $confirmDiscard) {
    Button("Discard", role: .destructive) { dismiss() }
}
```

For an irreversible request in flight, hide back (`.navigationBarBackButtonHidden(isSubmitting)`) and disable dismissal only while the request runs, with visible progress. Everything else leaves back alone.

## Tabs

```swift
struct MainTabs: View {
    @State private var selection: TabID = .trips
    @State private var tripsRouter = Router()

    var body: some View {
        TabView(selection: reselectable) {
            TripsTab(router: tripsRouter).tabItem { Label("Trips", systemImage: "suitcase") }.tag(TabID.trips)
            SavedTab().tabItem { Label("Saved", systemImage: "bookmark") }.tag(TabID.saved)
        }
    }

    /// Tapping the selected tab again pops it to root.
    private var reselectable: Binding<TabID> {
        Binding(get: { selection }, set: { new in
            if new == selection, new == .trips { tripsRouter.popToRoot() }
            selection = new
        })
    }
}
```

- One router per tab, owned above the `TabView`, so tabs keep their stacks when you switch.
- No custom transition between tabs.
- Composer, player and checkout present from the root (`.fullScreenCover` or a task sheet), above the tabs.
- With SwiftPieces Pro, `TabShellScreen` with `LensTab` and `ShellScrollView` handles bar hiding, reselect and scroll-to-top. Screens inside a tab that own a stack take `wrapsInNavigationStack: false`; pushed screens add `.tabShellBarClearance()`.

## Deep links

```swift
.onOpenURL { url in
    guard let route = Route(url: url) else { return }
    selection = route.tab
    router(for: route.tab).path = route.stack   // a real stack under the destination, so back makes sense
}
```

Handle links only once `phase == .ready`; queue one that arrives during launch or sign-in and apply it after.
