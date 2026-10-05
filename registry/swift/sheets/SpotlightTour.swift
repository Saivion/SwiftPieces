// swiftpieces:
// title: Spotlight Tour
// description: "A first-run feature tour for any screen: mark controls with .spotlightAnchor and .spotlightTour dims everything else through a cutout that springs from stop to stop as a red ring draws around it, sets a callout with step progress, Skip and a red Next below or above the target inside the safe area, lets taps through to the real control (which can also advance the tour), skips stops that aren't on screen, follows its target through scrolling, rotation and the keyboard, can show itself only once, and keeps VoiceOver, hardware keyboards and Reduce Motion in step."
// category: sheets
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// pro: onboarding-flow
// tags: [onboarding, coach-marks, tour, tips, spotlight, overlay, first-run, accessibility]

import SwiftUI

/// Walks people through the controls on a screen, one stop at a time: everything but the current stop
/// is dimmed, a red ring draws around it, and a callout explains it with Skip and Next.
///
/// Mark each control with `.spotlightAnchor("compose")`, then apply `.spotlightTour` once, high in the
/// hierarchy: on the `NavigationStack` or `TabView`, so the scrim covers the bars too, or on a sheet's
/// root. Anchors anywhere inside it are found, toolbar items included. Taps inside the cutout reach the
/// real control. Steps whose anchor is not on screen are skipped; while none is on screen, the tour waits.
///
/// - Parameters:
///   - isPresented: Shows the tour while `true`. Done, Skip and Escape set it back to `false`. Works with `@AppStorage` too, for example `@AppStorage("inbox.showTour") var showTour = true`, which then stays off once the tour has been seen.
///   - step: Optional binding to the current step's index in `steps`, to read it or drive it (move on when someone completes an action, resume a tour). The tour writes it as people move through and sets it back to 0 when the tour is finished or skipped. `nil` keeps it internal.
///   - steps: The stops in order. Each names the anchor it points at, its title and message, and optionally a symbol, the cutout's shape and its padding.
///   - showOnceKey: A `UserDefaults` key. When set, the tour presents itself (by setting `isPresented`) the first time the view appears, once the screen has settled, and records under this key when it is finished or skipped, so it never presents itself again. Setting `isPresented` yourself always presents it. Reset with `SpotlightTour.resetShowOnce(_:)`.
///   - advancesOnTargetTap: Tapping the highlighted control also moves the tour on, as well as running the control's own action. Defaults to `true`.
///   - messages: The built-in copy: Next, Done, Skip and the step count. Defaults are localizable through your String Catalog.
///   - style: Colors and metrics. Defaults to the SwiftPieces house palette, adapting to light and dark, with the red ring, current step and Next capsule.
///   - onFinish: Called when the tour ends with Done (`.completed`) or Skip (`.skipped`), for analytics or to save that it was seen. Not called when you set `isPresented` to `false` yourself.
public extension View {
    /// Marks this view as a stop a spotlight tour can point at.
    ///
    /// The tour reads the view's frame on screen, so the anchor can sit anywhere under the view that
    /// applies `.spotlightTour`, toolbar items included. Use one id per stop.
    ///
    /// - Parameter id: The name a `SpotlightTour.Step` uses to point at this view.
    func spotlightAnchor(_ id: String) -> some View {
        modifier(SpotlightAnchorModifier(id: id))
    }

    /// Presents a spotlight tour over this view while `isPresented` is `true`.
    func spotlightTour(
        isPresented: Binding<Bool>,
        step: Binding<Int>? = nil,
        steps: [SpotlightTour.Step],
        showOnceKey: String? = nil,
        advancesOnTargetTap: Bool = true,
        messages: SpotlightTour.Messages = .standard,
        style: SpotlightTour.Style = .standard,
        onFinish: ((SpotlightTour.Outcome) -> Void)? = nil
    ) -> some View {
        modifier(SpotlightTour(isPresented: isPresented, step: step, steps: steps, showOnceKey: showOnceKey, advancesOnTargetTap: advancesOnTargetTap, messages: messages, style: style, onFinish: onFinish))
    }

    /// Presents a spotlight tour the first time this view appears, and never again once it has been
    /// finished or skipped. Completion is stored in `UserDefaults.standard` under `showOnceKey`.
    func spotlightTour(
        _ steps: [SpotlightTour.Step],
        showOnceKey: String,
        advancesOnTargetTap: Bool = true,
        messages: SpotlightTour.Messages = .standard,
        style: SpotlightTour.Style = .standard,
        onFinish: ((SpotlightTour.Outcome) -> Void)? = nil
    ) -> some View {
        modifier(SpotlightTourOnce(steps: steps, key: showOnceKey, advancesOnTargetTap: advancesOnTargetTap, messages: messages, style: style, onFinish: onFinish))
    }
}

/// The spotlight tour modifier. Use `.spotlightTour(isPresented:steps:)`.
public struct SpotlightTour: ViewModifier {
    // MARK: Public types

    /// One stop of the tour.
    public struct Step: Hashable, Sendable {
        /// The `spotlightAnchor` id this step points at.
        public var anchor: String
        /// A short title, such as the control's name or what it does.
        public var title: String
        /// One or two sentences under the title.
        public var message: String
        /// An optional SF Symbol shown in a tile beside the text.
        public var systemImage: String?
        /// The cutout's shape around the target.
        public var shape: Cutout
        /// Room between the target's edge and the cutout's edge, in points.
        public var padding: CGFloat

        public init(_ anchor: String, title: String, message: String, systemImage: String? = nil, shape: Cutout = .automatic, padding: CGFloat = 8) {
            self.anchor = anchor
            self.title = title
            self.message = message
            self.systemImage = systemImage
            self.shape = shape
            self.padding = max(padding, 0)
        }
    }

    /// The shape of the cutout around a target.
    public enum Cutout: Hashable, Sendable {
        /// Chosen from the target's size: a circle for small, roughly square targets (icon buttons,
        /// avatars), a capsule for short wide ones (fields, pills, text buttons), and a rounded
        /// rectangle for anything larger.
        case automatic
        /// A rounded rectangle for a target with this corner radius. The step's padding is added to the
        /// radius, so the cutout's corners run parallel to the target's.
        case rectangle(cornerRadius: CGFloat)
        /// A capsule around the target.
        case capsule
        /// A circle around the target's centre, wide enough for its longer side.
        case circle
    }

    /// How a tour ended.
    public enum Outcome: Hashable, Sendable {
        /// Done on the last step, or Next past the last stop on screen.
        case completed
        /// Skip, the Escape key, or the VoiceOver escape gesture.
        case skipped
    }

    /// The tour's copy. Every default goes through `String(localized:)`, so it can be translated in
    /// your String Catalog, and any line can be replaced: `.init(done: "Got it")`.
    public struct Messages: Sendable {
        /// The primary button while more steps follow.
        public var next: String
        /// The primary button on the last step.
        public var done: String
        /// The quiet button that ends the tour early.
        public var skip: String
        /// The VoiceOver action that goes back a step.
        public var previous: String
        /// The visible step count, such as "2 of 4".
        public var progress: @Sendable (_ position: Int, _ count: Int) -> String
        /// What VoiceOver reads before each step, such as "Step 2 of 4".
        public var stepLabel: @Sendable (_ position: Int, _ count: Int) -> String

        /// Pass only the lines you want to change.
        public init(
            next: String = String(localized: "Next", comment: "Spotlight tour button that moves to the next step"),
            done: String = String(localized: "Done", comment: "Spotlight tour button on the last step"),
            skip: String = String(localized: "Skip", comment: "Spotlight tour button that ends the tour early"),
            previous: String = String(localized: "Previous step", comment: "Spotlight tour VoiceOver action that goes back a step"),
            progress: @escaping @Sendable (_ position: Int, _ count: Int) -> String = { position, count in
                String(localized: "\(position) of \(count)", comment: "Spotlight tour step count, such as 2 of 4")
            },
            stepLabel: @escaping @Sendable (_ position: Int, _ count: Int) -> String = { position, count in
                String(localized: "Step \(position) of \(count)", comment: "Spotlight tour step count read by VoiceOver")
            }
        ) {
            self.next = next
            self.done = done
            self.skip = skip
            self.previous = previous
            self.progress = progress
            self.stepLabel = stepLabel
        }

        public static var standard: Messages { Messages() }
    }

    /// Colors and metrics. `.standard` is the house palette: a dark scrim in both appearances, a house
    /// surface callout, and red for the ring, the current step and the Next capsule.
    public struct Style: Sendable {
        /// The dim over everything but the cutout.
        public var scrim: Color
        /// The ring around the cutout, the current step's capsule and the Next button.
        public var accent: Color
        /// Text on the Next button.
        public var accentInk: Color
        /// The callout card.
        public var surface: Color
        /// The title.
        public var label: Color
        /// The message, the step count and Skip.
        public var secondaryLabel: Color
        /// The other steps' capsules and the symbol tile.
        public var track: Color
        /// Callout corner radius.
        public var cornerRadius: CGFloat
        /// Width of the ring around the cutout.
        public var ringWidth: CGFloat
        /// Widest the callout gets. At accessibility text sizes it may use the full width.
        public var maxWidth: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(scrim: Color? = nil, accent: Color? = nil, accentInk: Color? = nil, surface: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, track: Color? = nil, cornerRadius: CGFloat = 26, ringWidth: CGFloat = 2, maxWidth: CGFloat = 360) {
            self.scrim = scrim ?? Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0, alpha: 0.58) : UIColor(white: 0.04, alpha: 0.46) })
            self.accent = accent ?? Color(red: 1, green: 0, blue: 0)
            self.accentInk = accentInk ?? adaptive(light: 0x141414, dark: 0x141414)
            self.surface = surface ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.track = track ?? adaptive(light: 0xDEDBD4, dark: 0x3A3A3A)
            self.cornerRadius = cornerRadius
            self.ringWidth = max(ringWidth, 0)
            self.maxWidth = max(maxWidth, 240)
        }

        public static let standard = Style()
    }

    /// Clears what `showOnceKey` stored, so the tour presents itself again the next time its view
    /// appears. Handy behind a "Show tips again" setting.
    public static func resetShowOnce(_ key: String) {
        UserDefaults.standard.removeObject(forKey: key)
    }

    // MARK: State

    @Binding private var isPresented: Bool
    private let externalStep: Binding<Int>?
    @State private var ownStep = 0
    @State private var registry = SpotlightRegistry()
    @State private var mounted = false
    /// The overlay is up, so the content underneath is hidden from VoiceOver.
    @State private var covering = false
    @State private var stepTick = 0
    @State private var finishTick = 0

    private let steps: [Step]
    private let showOnceKey: String?
    private let advancesOnTargetTap: Bool
    private let messages: Messages
    private let style: Style
    private let onFinish: ((Outcome) -> Void)?

    public init(isPresented: Binding<Bool>, step: Binding<Int>? = nil, steps: [Step], showOnceKey: String? = nil, advancesOnTargetTap: Bool = true, messages: Messages = .standard, style: Style = .standard, onFinish: ((Outcome) -> Void)? = nil) {
        self._isPresented = isPresented
        self.externalStep = step
        self.steps = steps
        self.showOnceKey = showOnceKey
        self.advancesOnTargetTap = advancesOnTargetTap
        self.messages = messages
        self.style = style
        self.onFinish = onFinish
    }

    private var index: Int { externalStep?.wrappedValue ?? ownStep }

    private func setIndex(_ value: Int) {
        if let externalStep { externalStep.wrappedValue = value } else { ownStep = value }
    }

    // MARK: Body

    public func body(content: Content) -> some View {
        content
            .environment(\.spotlightRegistry, registry)
            .accessibilityHidden(covering && isPresented && !steps.isEmpty)
            .overlay {
                if mounted, !steps.isEmpty {
                    // Respects the safe area (and the keyboard), so the callout stays inside it; the
                    // layer inside ignores it, so the scrim covers the whole screen.
                    GeometryReader { safe in
                        SpotlightLayer(
                            isPresented: isPresented && !steps.isEmpty,
                            index: index,
                            steps: steps,
                            registry: registry,
                            safeFrame: safe.frame(in: .global),
                            advancesOnTargetTap: advancesOnTargetTap,
                            messages: messages,
                            style: style,
                            move: move,
                            finish: finish,
                            covering: { covering = $0 },
                            closed: { if !isPresented { mounted = false } }
                        )
                    }
                }
            }
            .onChange(of: isPresented, initial: true) { _, presented in
                if presented { mounted = true }
            }
            .task(id: showOnceKey) { await presentOnce() }
            .sensoryFeedback(.selection, trigger: stepTick)
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.8), trigger: finishTick)
    }

    // MARK: Behaviour

    private func move(to value: Int) {
        guard value != index else { return }
        stepTick += 1
        setIndex(value)
    }

    private func finish(_ outcome: Outcome) {
        guard isPresented else { return }
        finishTick += 1
        isPresented = false
        setIndex(0)
        if let showOnceKey { UserDefaults.standard.set(true, forKey: showOnceKey) }
        onFinish?(outcome)
    }

    /// Presents the tour once its view has settled, unless it was finished or skipped before.
    private func presentOnce() async {
        guard let key = showOnceKey, !UserDefaults.standard.bool(forKey: key) else { return }
        try? await Task.sleep(for: .milliseconds(600))
        guard !Task.isCancelled, !UserDefaults.standard.bool(forKey: key), !isPresented else { return }
        isPresented = true
    }
}

// MARK: - Show once

private struct SpotlightTourOnce: ViewModifier {
    let steps: [SpotlightTour.Step]
    let key: String
    let advancesOnTargetTap: Bool
    let messages: SpotlightTour.Messages
    let style: SpotlightTour.Style
    let onFinish: ((SpotlightTour.Outcome) -> Void)?
    @State private var presented = false

    func body(content: Content) -> some View {
        content.modifier(SpotlightTour(isPresented: $presented, steps: steps, showOnceKey: key, advancesOnTargetTap: advancesOnTargetTap, messages: messages, style: style, onFinish: onFinish))
    }
}

// MARK: - Anchors

/// Where every anchor under one tour is on screen, which one is current, and taps on it. Shared down
/// the environment, so anchors inside toolbar items and other hosted content report too.
@MainActor
@Observable
private final class SpotlightRegistry {
    /// Anchor frames in the window's coordinates.
    var frames: [String: CGRect] = [:]
    /// The anchor the tour is pointing at, so only it listens for taps.
    var current: String?
    var tapCount = 0
    @ObservationIgnored var tappedAnchor: String?
    /// Keyboard commands. A shortcut can hold on to the action of an earlier render, so it only sends a
    /// command here and the tour acts on it with what is on screen now.
    var commandCount = 0
    @ObservationIgnored var command: SpotlightCommand = .next

    nonisolated init() {}

    func report(_ id: String, _ frame: CGRect) {
        if frames[id] != frame { frames[id] = frame }
    }

    func remove(_ id: String) {
        if frames[id] != nil { frames[id] = nil }
    }

    func tapped(_ id: String) {
        tappedAnchor = id
        tapCount += 1
    }

    func send(_ command: SpotlightCommand) {
        self.command = command
        commandCount += 1
    }
}

private enum SpotlightCommand {
    case next, back, skip
}

private struct SpotlightRegistryKey: EnvironmentKey {
    static let defaultValue: SpotlightRegistry? = nil
}

private extension EnvironmentValues {
    var spotlightRegistry: SpotlightRegistry? {
        get { self[SpotlightRegistryKey.self] }
        set { self[SpotlightRegistryKey.self] = newValue }
    }
}

private struct SpotlightAnchorModifier: ViewModifier {
    let id: String
    @Environment(\.spotlightRegistry) private var registry

    func body(content: Content) -> some View {
        let isCurrent = registry?.current == id
        content
            // Window coordinates: they cross hosting boundaries (toolbar items) that preferences may not.
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
                registry?.report(id, frame)
            }
            .onDisappear { registry?.remove(id) }
            // Runs alongside the control's own action, and only while this anchor is the current stop.
            .simultaneousGesture(TapGesture().onEnded { registry?.tapped(id) }, including: isCurrent ? .all : .subviews)
    }
}

// MARK: - Layer

/// The cutout in the layer's coordinates.
private struct SpotlightHole: Equatable {
    var rect: CGRect
    var radius: CGFloat

    func expanded(by amount: CGFloat) -> SpotlightHole {
        SpotlightHole(rect: rect.insetBy(dx: -amount, dy: -amount), radius: radius + amount)
    }
}

/// What the layer shows right now.
private struct SpotlightResolution: Equatable {
    /// The step on screen.
    var display: Int?
    var hole: SpotlightHole?
    /// 1-based position among the steps on screen, and how many there are.
    var position = 0
    var count = 0
    var next: Int?
    var previous: Int?
    var bounds: CGRect = .zero
    var safe: CGRect = .zero
}

/// Which steps have their anchor on screen, for the committed step. A change of any of these is
/// what can change the step shown.
private struct SpotlightAvailability: Equatable {
    var index: Int
    var available: [Int]
    var presented: Bool
}

/// The anchors' frames in the layer's coordinates, measured once per layout.
private struct SpotlightGeometry {
    var bounds: CGRect
    var safe: CGRect
    var frames: [Int: CGRect] = [:]
    var available: [Int] = []

    @MainActor
    init(_ proxy: GeometryProxy, safeFrame: CGRect, steps: [SpotlightTour.Step], frames global: [String: CGRect]) {
        let origin = proxy.frame(in: .global).origin
        bounds = CGRect(origin: .zero, size: proxy.size)
        safe = safeFrame.offsetBy(dx: -origin.x, dy: -origin.y).intersection(bounds)
        if safe.isNull || safe.width < 120 || safe.height < 120 { safe = bounds }
        for (i, step) in steps.enumerated() {
            guard let frame = global[step.anchor] else { continue }
            let local = frame.offsetBy(dx: -origin.x, dy: -origin.y)
            frames[i] = local
            if Self.isOnScreen(local, in: bounds) { available.append(i) }
        }
    }

    /// Mostly visible: at least half of it, or a good part of the screen for targets larger than it.
    static func isOnScreen(_ frame: CGRect, in bounds: CGRect) -> Bool {
        guard frame.width >= 1, frame.height >= 1 else { return false }
        let visible = frame.intersection(bounds)
        guard !visible.isNull, !visible.isEmpty else { return false }
        return visible.width * visible.height >= frame.width * frame.height * 0.5
            || (visible.width >= bounds.width * 0.5 && visible.height >= bounds.height * 0.3)
    }

    /// The step shown, its cutout and where it sits among the steps on screen. A shown step whose anchor
    /// is gone (removed from the screen) gives way at once to the next one there is.
    func resolution(showing shown: Int?, index: Int, steps: [SpotlightTour.Step]) -> SpotlightResolution {
        var result = SpotlightResolution(bounds: bounds, safe: safe)
        let display = shown.flatMap { frames[$0] != nil ? $0 : nil } ?? (shown == nil ? nil : available.first { $0 >= index })
        guard let display, let target = frames[display] else { return result }
        result.display = display
        result.hole = Self.hole(around: target, for: steps[display])
        result.position = available.filter { $0 < display }.count + 1
        result.count = available.count + (available.contains(display) ? 0 : 1)
        result.next = available.first { $0 > display }
        result.previous = available.last { $0 < display }
        return result
    }

    /// The cutout around a target: the step's shape (or one picked from the target's size) plus its padding.
    static func hole(around target: CGRect, for step: SpotlightTour.Step) -> SpotlightHole {
        let p = step.padding
        var shape = step.shape
        if shape == .automatic {
            let long = max(target.width, target.height), short = min(target.width, target.height)
            if long <= 64, long - short <= long * 0.25 {
                shape = .circle
            } else if target.height <= 52, target.width >= target.height * 1.6 {
                shape = .capsule
            } else {
                shape = .rectangle(cornerRadius: 18)
            }
        }
        switch shape {
        case .circle:
            let d = max(target.width, target.height) + p * 2
            return SpotlightHole(rect: CGRect(x: target.midX - d / 2, y: target.midY - d / 2, width: d, height: d), radius: d / 2)
        case .capsule:
            let rect = target.insetBy(dx: -p, dy: -p)
            return SpotlightHole(rect: rect, radius: min(rect.width, rect.height) / 2)
        case .rectangle(let corner):
            let rect = target.insetBy(dx: -p, dy: -p)
            return SpotlightHole(rect: rect, radius: min(max(corner, 0) + p, min(rect.width, rect.height) / 2))
        case .automatic:
            return SpotlightHole(rect: target.insetBy(dx: -p, dy: -p), radius: 18 + p)
        }
    }
}

private struct SpotlightLayer: View {
    let isPresented: Bool
    let index: Int
    let steps: [SpotlightTour.Step]
    let registry: SpotlightRegistry
    let safeFrame: CGRect
    let advancesOnTargetTap: Bool
    let messages: SpotlightTour.Messages
    let style: SpotlightTour.Style
    let move: (Int) -> Void
    let finish: (SpotlightTour.Outcome) -> Void
    let covering: (Bool) -> Void
    let closed: () -> Void

    @Environment(\.layoutDirection) private var direction
    /// The step on screen. It follows the committed step at once, but waits a moment before giving up on
    /// an anchor: toolbar items report a beat after the content, and a rotation briefly measures the old
    /// frames against the new bounds.
    @State private var shown: Int?
    @State private var latest = SpotlightAvailability(index: 0, available: [], presented: false)
    @State private var pending: Task<Void, Never>?

    var body: some View {
        GeometryReader { proxy in
            let geometry = SpotlightGeometry(proxy, safeFrame: safeFrame, steps: steps, frames: registry.frames)
            SpotlightStage(
                isPresented: isPresented,
                resolution: geometry.resolution(showing: shown, index: index, steps: steps),
                steps: steps,
                registry: registry,
                advancesOnTargetTap: advancesOnTargetTap,
                messages: messages,
                style: style,
                direction: direction,
                move: move,
                finish: finish,
                covering: covering,
                closed: closed
            )
            .onChange(of: SpotlightAvailability(index: index, available: geometry.available, presented: isPresented), initial: true) { old, new in
                update(from: old, to: new)
            }
        }
        .ignoresSafeArea()
        // Anchor frames are physical window coordinates, so the layer is laid out left to right;
        // the callout's content gets the caller's direction back.
        .environment(\.layoutDirection, .leftToRight)
        .onDisappear { pending?.cancel() }
    }

    private func update(from old: SpotlightAvailability, to new: SpotlightAvailability) {
        latest = new
        pending?.cancel()
        guard new.presented else { return }
        if !old.presented || shown == nil {
            // Presenting: show the committed step as soon as its anchor is there. Toolbar items report a
            // beat after the content, so a missing one gets a moment before the tour starts further on.
            if new.available.contains(new.index) {
                shown = new.index
            } else {
                shown = nil
                settle(after: .milliseconds(350))
            }
        } else if old.index != new.index {
            // Moved on purpose (Next, Back, a target tap or your binding): go now.
            shown = new.available.first { $0 >= new.index }
        } else if let current = shown, !new.available.contains(current) {
            // The step shown left the screen: give it a moment, then move on to what is there.
            settle(after: .milliseconds(350))
        }
    }

    private func settle(after delay: Duration) {
        pending = Task { @MainActor in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            let now = latest
            if let current = shown, now.available.contains(current) { return }
            shown = now.available.first { $0 >= now.index }
        }
    }
}

// MARK: - Stage

private struct SpotlightStage: View {
    let isPresented: Bool
    let resolution: SpotlightResolution
    let steps: [SpotlightTour.Step]
    let registry: SpotlightRegistry
    let advancesOnTargetTap: Bool
    let messages: SpotlightTour.Messages
    let style: SpotlightTour.Style
    let direction: LayoutDirection
    let move: (Int) -> Void
    let finish: (SpotlightTour.Outcome) -> Void
    let covering: (Bool) -> Void
    let closed: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var shown = false
    @State private var session = 0
    /// The last resolution with a step on screen, drawn while the layer fades out.
    @State private var last: SpotlightResolution?
    /// Reduce Motion: the previous cutout, fading out while the new one fades in.
    @State private var fading: SpotlightHole?
    @State private var fadeKey = 0
    @State private var nudge = 0
    @State private var nudgeTick = 0
    @State private var dragX: CGFloat = 0
    @AccessibilityFocusState private var textFocus: Bool

    private var visible: Bool { isPresented && resolution.display != nil }
    private var shownResolution: SpotlightResolution? { resolution.display != nil ? resolution : last }
    private var morph: Animation { reduceMotion ? .easeInOut(duration: 0.22) : .spring(duration: 0.5, bounce: 0.16) }

    var body: some View {
        ZStack {
            if let current = shownResolution, let hole = current.hole, let display = current.display {
                let drawn = shown || reduceMotion ? hole : hole.expanded(by: 44)
                SpotlightScrim(hole: drawn, fading: fading, fadeKey: fadeKey, color: style.scrim, reduceMotion: reduceMotion)
                    .opacity(shown ? 1 : 0)
                    .onTapGesture { nudgeCallout() }
                    .accessibilityHidden(true)

                if shown {
                    SpotlightRing(hole: hole, color: style.accent, width: style.ringWidth, draws: !reduceMotion)
                        .id("\(session)-\(display)")
                        .transition(.opacity.animation(.easeOut(duration: 0.15)))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }

                callout(current, step: steps[display], hole: hole)
                    .id(reduceMotion ? display : -1)
                    .transition(.opacity)
            }
        }
        .animation(morph, value: resolution.display)
        .allowsHitTesting(visible && shown)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(visible ? .isModal : [])
        .accessibilityAction(.escape) { if visible { skip() } }
        .onChange(of: visible, initial: true) { _, isVisible in
            isVisible ? appear() : disappear()
            covering(isVisible)
        }
        .onChange(of: resolution, initial: true) { old, new in
            if new.display != nil { last = new }
            let anchor = new.display.map { steps[$0].anchor }
            if registry.current != anchor { registry.current = anchor }
            guard let display = new.display, let previous = old.display, display != previous, shown else { return }
            if reduceMotion, let hole = old.hole {
                fading = hole
                fadeKey += 1
            }
            announce(new, step: steps[display])
        }
        .onChange(of: registry.commandCount) {
            switch registry.command {
            case .next: next()
            case .back: back()
            case .skip: skip()
            }
        }
        .onChange(of: registry.tapCount) {
            guard advancesOnTargetTap, shown, let display = resolution.display, registry.tappedAnchor == steps[display].anchor else { return }
            // After the control's own action has run.
            Task { @MainActor in next() }
        }
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.45), trigger: nudgeTick)
    }

    // MARK: Callout

    private func callout(_ current: SpotlightResolution, step: SpotlightTour.Step, hole: SpotlightHole) -> some View {
        let ring = style.ringWidth
        let target = hole.rect.insetBy(dx: -ring, dy: -ring)
        let anchor = UnitPoint(x: current.bounds.width > 0 ? target.midX / current.bounds.width : 0.5, y: current.bounds.height > 0 ? target.midY / current.bounds.height : 0.5)
        let margins = current.safe.insetBy(dx: 16, dy: 10)
        return SpotlightCalloutLayout(target: target, safe: margins, maxWidth: typeSize.isAccessibilitySize ? .infinity : style.maxWidth, gap: 16, nub: CGSize(width: 20, height: 9), inset: style.cornerRadius * 0.8) {
            SpotlightCallout(
                step: step,
                key: current.display ?? 0,
                position: current.position,
                count: current.count,
                isLast: current.next == nil,
                canGoBack: current.previous != nil,
                messages: messages,
                style: style,
                textFocus: $textFocus,
                next: next,
                back: back,
                skip: skip,
                send: { [registry] in registry.send($0) }
            )
            .environment(\.layoutDirection, direction)
            .shadow(color: .black.opacity(0.18), radius: 22, y: 10)
            .gesture(swipe)
            SpotlightNub(pointsUp: true).fill(style.surface)
            SpotlightNub(pointsUp: false).fill(style.surface)
        }
        .offset(x: dragX)
        .keyframeAnimator(initialValue: CGFloat(1), trigger: nudge) { content, scale in
            content.scaleEffect(scale, anchor: anchor)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(1.035, duration: 0.12)
                SpringKeyframe(1, duration: 0.38, spring: .bouncy)
            }
        }
        .opacity(shown ? 1 : 0)
        .scaleEffect(shown || reduceMotion ? 1 : 0.94, anchor: anchor)
    }

    /// Swipe toward the end of the line to go on, back toward its start to go back.
    private var swipe: some Gesture {
        DragGesture(minimumDistance: 14)
            .onChanged { value in
                let t = value.translation.width
                let forward = direction == .rightToLeft ? t > 0 : t < 0
                let possible = forward || resolution.previous != nil
                dragX = possible ? t * 0.45 : t * 0.12
            }
            .onEnded { value in
                let t = value.predictedEndTranslation.width
                let forward = direction == .rightToLeft ? t > 0 : t < 0
                withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0.25)) { dragX = 0 }
                guard abs(value.translation.width) > 40 || abs(t) > 110 else { return }
                if forward { next() } else { back() }
            }
    }

    // MARK: Actions

    private func next() {
        guard visible else { return }
        if let target = resolution.next {
            move(target)
        } else {
            finish(.completed)
        }
    }

    private func back() {
        guard visible, let previous = resolution.previous else { return }
        move(previous)
    }

    private func skip() {
        guard visible else { return }
        finish(.skipped)
    }

    private func nudgeCallout() {
        nudgeTick += 1
        if !reduceMotion { nudge += 1 }
    }

    private func appear() {
        guard !shown else { return }
        session += 1
        fading = nil
        dragX = 0
        withAnimation(reduceMotion ? .easeOut(duration: 0.25) : .spring(duration: 0.55, bounce: 0.12)) { shown = true }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            guard visible else { return }
            textFocus = true
        }
    }

    private func disappear() {
        if registry.current != nil { registry.current = nil }
        guard shown else {
            if !isPresented { closed() }
            return
        }
        withAnimation(.easeOut(duration: 0.28)) {
            shown = false
        } completion: {
            if !isPresented { closed() }
        }
    }

    private func announce(_ current: SpotlightResolution, step: SpotlightTour.Step) {
        var parts: [String] = []
        if current.count > 1 { parts.append(messages.stepLabel(current.position, current.count)) }
        parts.append(step.title)
        parts.append(step.message)
        AccessibilityNotification.Announcement(parts.joined(separator: ". ")).post()
    }
}

// MARK: - Scrim and ring

/// The dim with the cutout punched out of it. Taps on the dim are caught; taps in the cutout fall
/// through to the content underneath.
private struct SpotlightScrim: View {
    let hole: SpotlightHole
    let fading: SpotlightHole?
    let fadeKey: Int
    let color: Color
    let reduceMotion: Bool

    var body: some View {
        ZStack {
            Rectangle().fill(color)
            SpotlightHoleShape(rect: hole.rect, radius: hole.radius)
                .fill(.black)
                .modifier(SpotlightFade(from: reduceMotion && fading != nil ? 0 : 1, to: 1))
                .id(fadeKey)
                .blendMode(.destinationOut)
            if reduceMotion, let fading {
                SpotlightHoleShape(rect: fading.rect, radius: fading.radius)
                    .fill(.black)
                    .modifier(SpotlightFade(from: 1, to: 0))
                    .id(-fadeKey - 1)
                    .blendMode(.destinationOut)
            }
        }
        .compositingGroup()
        .contentShape(SpotlightScrimHitShape(hole: hole), eoFill: true)
    }
}

/// Fades its content from one opacity to another once, when it appears.
private struct SpotlightFade: ViewModifier {
    let from: Double
    let to: Double
    @State private var value: Double?

    func body(content: Content) -> some View {
        content
            .opacity(value ?? from)
            .onAppear {
                guard from != to else { return }
                withAnimation(.easeInOut(duration: 0.25)) { value = to }
            }
    }
}

/// The red ring just outside the cutout. It draws itself in from the top once the cutout has landed.
private struct SpotlightRing: View {
    let hole: SpotlightHole
    let color: Color
    let width: CGFloat
    let draws: Bool
    @State private var drawn: CGFloat = 0

    var body: some View {
        SpotlightHoleShape(rect: hole.rect.insetBy(dx: -width / 2, dy: -width / 2), radius: hole.radius + width / 2)
            .trim(from: 0, to: draws ? drawn : 1)
            .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
            .onAppear {
                guard draws else { return }
                withAnimation(.easeOut(duration: 0.45).delay(0.3)) { drawn = 1 }
            }
    }
}

/// A rounded rectangle with circular corners that starts at the top centre and runs clockwise, so a
/// trimmed ring draws in from the top. Circles and capsules are the same shape with a full radius,
/// which is what lets one cutout morph into another.
private struct SpotlightHoleShape: Shape {
    var rect: CGRect
    var radius: CGFloat

    var animatableData: AnimatablePair<CGRect.AnimatableData, CGFloat> {
        get { AnimatablePair(rect.animatableData, radius) }
        set {
            rect.animatableData = newValue.first
            radius = newValue.second
        }
    }

    func path(in _: CGRect) -> Path {
        spotlightPath(rect, radius)
    }
}

private struct SpotlightScrimHitShape: Shape {
    let hole: SpotlightHole

    func path(in rect: CGRect) -> Path {
        var path = Path(rect)
        path.addPath(spotlightPath(hole.rect, hole.radius))
        return path
    }
}

private func spotlightPath(_ rect: CGRect, _ radius: CGFloat) -> Path {
    var path = Path()
    guard rect.width > 0, rect.height > 0 else { return path }
    let r = max(0, min(radius, min(rect.width, rect.height) / 2))
    path.move(to: CGPoint(x: rect.midX, y: rect.minY))
    path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.maxY), radius: r)
    path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.maxY), radius: r)
    path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.minY), radius: r)
    path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.minY), tangent2End: CGPoint(x: rect.midX, y: rect.minY), radius: r)
    path.closeSubpath()
    return path
}

// MARK: - Callout

/// Places the callout below the target when it fits, else above, else on the roomier side, always
/// inside the margins; and the nub on the edge facing the target, under its centre.
private struct SpotlightCalloutLayout: Layout {
    var target: CGRect
    var safe: CGRect
    var maxWidth: CGFloat
    var gap: CGFloat
    var nub: CGSize
    var inset: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 3, safe.width > 0 else { return }
        let width = min(maxWidth, safe.width)
        let height = subviews[0].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
        let below = target.maxY + gap + height <= safe.maxY
        let above = target.minY - gap - height >= safe.minY
        let placesBelow = below || (!above && safe.maxY - target.maxY >= target.minY - safe.minY)
        var y = placesBelow ? target.maxY + gap : target.minY - gap - height
        y = min(max(y, safe.minY), max(safe.maxY - height, safe.minY))
        let x = min(max(target.midX - width / 2, safe.minX), max(safe.maxX - width, safe.minX))
        let card = CGRect(x: x, y: y, width: width, height: height)
        subviews[0].place(at: CGPoint(x: bounds.minX + card.minX, y: bounds.minY + card.minY), proposal: ProposedViewSize(card.size))

        // The nub hides when the callout had to overlap the target.
        let clear = !card.insetBy(dx: 0, dy: 2).intersects(target)
        let low = card.minX + inset + nub.width / 2, high = card.maxX - inset - nub.width / 2
        let nubX = low <= high ? min(max(target.midX, low), high) : card.midX
        subviews[1].place(at: CGPoint(x: bounds.minX + nubX, y: bounds.minY + card.minY + 1), anchor: .bottom, proposal: ProposedViewSize(placesBelow && clear ? nub : .zero))
        subviews[2].place(at: CGPoint(x: bounds.minX + nubX, y: bounds.minY + card.maxY - 1), anchor: .top, proposal: ProposedViewSize(!placesBelow && clear ? nub : .zero))
    }
}

/// A small pointer with a softened tip.
private struct SpotlightNub: Shape {
    let pointsUp: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard rect.width > 0, rect.height > 0 else { return path }
        let tip = pointsUp ? rect.minY : rect.maxY
        let base = pointsUp ? rect.maxY : rect.minY
        let soft = min(rect.width * 0.14, 3)
        let lift: CGFloat = pointsUp ? 1 : -1
        path.move(to: CGPoint(x: rect.minX, y: base))
        path.addLine(to: CGPoint(x: rect.midX - soft, y: tip + lift * soft * 0.8))
        path.addQuadCurve(to: CGPoint(x: rect.midX + soft, y: tip + lift * soft * 0.8), control: CGPoint(x: rect.midX, y: tip - lift * 0.4))
        path.addLine(to: CGPoint(x: rect.maxX, y: base))
        path.closeSubpath()
        return path
    }
}

private struct SpotlightCallout: View {
    let step: SpotlightTour.Step
    /// Identifies the step, so a change of step swaps the text.
    let key: Int
    let position: Int
    let count: Int
    let isLast: Bool
    let canGoBack: Bool
    let messages: SpotlightTour.Messages
    let style: SpotlightTour.Style
    var textFocus: AccessibilityFocusState<Bool>.Binding
    let next: () -> Void
    let back: () -> Void
    let skip: () -> Void
    /// Keyboard shortcuts go through the tour's registry (see `SpotlightRegistry.send`).
    let send: (SpotlightCommand) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var direction
    @ScaledMetric(relativeTo: .title3) private var tileSide: CGFloat = 40
    @ScaledMetric(relativeTo: .caption) private var dot: CGFloat = 6
    /// The text that was on the card while it dips out after a change of step. The new text comes back
    /// once it is hidden, so words never smear across each other while the card travels.
    @State private var outgoing: SpotlightHeader?
    @State private var textOpacity = 1.0

    private var content: SpotlightHeader { SpotlightHeader(key: key, step: step, position: position, count: count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header(outgoing ?? content)
                .opacity(textOpacity)
            controls
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(style.surface, in: RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        .accessibilityElement(children: .contain)
        .onChange(of: content) { old, new in
            guard old.key != new.key, !reduceMotion else { return }
            outgoing = old
            withAnimation(.easeIn(duration: 0.1)) {
                textOpacity = 0
            } completion: {
                withAnimation(.spring(duration: 0.4, bounce: 0.1)) { outgoing = nil }
                withAnimation(.easeOut(duration: 0.22)) { textOpacity = 1 }
            }
        }
    }

    private func header(_ content: SpotlightHeader) -> some View {
        let step = content.step
        return HStack(alignment: .top, spacing: 12) {
            // Decoration: at accessibility sizes the text gets the whole width instead.
            if let symbol = step.systemImage, !typeSize.isAccessibilitySize {
                Image(systemName: symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(style.label)
                    .frame(width: tileSide, height: tileSide)
                    .background(style.track, in: .rect(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 4) {
                if content.count > 1 {
                    Text(messages.progress(content.position, content.count))
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(0.6)
                        .monospacedDigit()
                        .foregroundStyle(style.secondaryLabel)
                }
                Text(step.title)
                    .font(.title3.weight(.bold))
                    .tracking(-0.3)
                    .foregroundStyle(style.label)
                Text(step.message)
                    .font(.subheadline)
                    .foregroundStyle(style.secondaryLabel)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // VoiceOver reads the live step, not the text still fading.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: accessibilityText))
        .accessibilityAddTraits(.isStaticText)
        .accessibilityFocused(textFocus)
        .modifier(SpotlightPreviousAction(title: canGoBack ? messages.previous : nil, perform: back))
    }

    private var accessibilityText: String {
        let parts = (count > 1 ? [messages.stepLabel(position, count)] : []) + [step.title, step.message]
        return parts.joined(separator: ". ")
    }

    @ViewBuilder
    private var controls: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    if count > 1 { progress.padding(.bottom, 6) }
                    primary(fullWidth: true)
                    if !isLast { secondary(fullWidth: true) }
                }
            } else {
                HStack(spacing: 2) {
                    if count > 1 { progress }
                    Spacer(minLength: 8)
                    if !isLast { secondary(fullWidth: false) }
                    primary(fullWidth: false)
                }
            }
        }
        .background { keys }
    }

    /// A hardware keyboard works the tour without taking focus from anything: Return is Next or Done,
    /// Escape skips, and the arrow keys move along the steps in reading order.
    private var keys: some View {
        ZStack {
            SpotlightKey(.return) { send(.next) }
            SpotlightKey(.escape) { send(.skip) }
            SpotlightKey(.rightArrow) { send(direction == .rightToLeft ? .back : .next) }
            SpotlightKey(.leftArrow) { send(direction == .rightToLeft ? .next : .back) }
        }
    }

    private var progress: some View {
        HStack(spacing: 5) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == position - 1 ? style.accent : style.track)
                    .frame(width: i == position - 1 ? dot * 3 : dot, height: dot)
            }
        }
        .accessibilityHidden(true)
    }

    private func primary(fullWidth: Bool) -> some View {
        Button(action: next) {
            Text(isLast ? messages.done : messages.next)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(style.accentInk)
                .padding(.horizontal, 20)
                .frame(minHeight: 38)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(style.accent, in: .capsule)
                .frame(minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(SpotlightPress(reduceMotion: reduceMotion))
    }

    private func secondary(fullWidth: Bool) -> some View {
        Button(action: skip) {
            Text(messages.skip)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.secondaryLabel)
                .padding(.horizontal, 12)
                .frame(minWidth: 44, minHeight: 44)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .contentShape(.rect)
        }
        .buttonStyle(SpotlightPress(reduceMotion: reduceMotion))
    }
}

/// An invisible button that only carries a keyboard shortcut.
private struct SpotlightKey: View {
    let key: KeyEquivalent
    let action: () -> Void

    init(_ key: KeyEquivalent, action: @escaping () -> Void) {
        self.key = key
        self.action = action
    }

    var body: some View {
        Button("", action: action)
            .keyboardShortcut(key, modifiers: [])
            .opacity(0)
            .frame(width: 0, height: 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// What the callout's text shows: the step and where it sits.
private struct SpotlightHeader: Equatable {
    var key: Int
    var step: SpotlightTour.Step
    var position: Int
    var count: Int
}

/// A named VoiceOver action that goes back a step, only when there is one.
private struct SpotlightPreviousAction: ViewModifier {
    let title: String?
    let perform: () -> Void

    func body(content: Content) -> some View {
        if let title {
            content.accessibilityAction(named: Text(title), perform)
        } else {
            content
        }
    }
}

private struct SpotlightPress: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
            .opacity(configuration.isPressed && reduceMotion ? 0.7 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.3), value: configuration.isPressed)
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// Plain placeholders to point at (a search capsule, three rows, a round add button) and a three-step
/// tour over them that starts again a moment after it ends.
private struct SpotlightTourExample: View {
    @State private var touring = false

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(adaptive(light: 0x5C5A56, dark: 0xA6A49F))
                Capsule()
                    .fill(adaptive(light: 0xD9D6CF, dark: 0x3A3A3A))
                    .frame(width: 96, height: 8)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .frame(height: 46)
            .background(adaptive(light: 0xE9E7E1, dark: 0x262626), in: .capsule)
            .spotlightAnchor("search")

            ForEach(0..<3, id: \.self) { row in
                SpotlightTourExampleRow(isFirst: row == 0)
            }

            Spacer(minLength: 0)

            Image(systemName: "plus")
                .font(.title3.weight(.bold))
                .foregroundStyle(adaptive(light: 0xF4F3EF, dark: 0x141414))
                .frame(width: 56, height: 56)
                .background(adaptive(light: 0x141414, dark: 0xF4F3EF), in: .circle)
                .spotlightAnchor("add")
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
        .spotlightTour(isPresented: $touring, steps: [
            .init("add", title: "Start a note", message: "Tap here to write something new.", systemImage: "square.and.pencil"),
            .init("search", title: "Find it fast", message: "Search every note by title, tag or person."),
            .init("pin", title: "Keep it on top", message: "Pin a note and it stays first in the list."),
        ]) { _ in
            Task {
                try? await Task.sleep(for: .seconds(1.6))
                touring = true
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(0.8))
            touring = true
        }
    }
}

private struct SpotlightTourExampleRow: View {
    let isFirst: Bool

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(adaptive(light: 0xE9E7E1, dark: 0x2A2A2A))
                .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 7) {
                Capsule().fill(adaptive(light: 0xD9D6CF, dark: 0x3A3A3A)).frame(width: 128, height: 8)
                Capsule().fill(adaptive(light: 0xE9E7E1, dark: 0x2E2E2E)).frame(width: 84, height: 8)
            }
            Spacer(minLength: 0)
            Image(systemName: "pin")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(adaptive(light: 0x5C5A56, dark: 0xA6A49F))
                .frame(width: 36, height: 36)
                .background(adaptive(light: 0xE9E7E1, dark: 0x2A2A2A), in: .circle)
                .spotlightAnchor(isFirst ? "pin" : "pin.other")
        }
        .padding(12)
        .background(adaptive(light: 0xFFFFFF, dark: 0x1C1C1C), in: .rect(cornerRadius: 18, style: .continuous))
    }
}

#Preview("Light") {
    SpotlightTourExample()
}

#Preview("Dark") {
    SpotlightTourExample()
        .preferredColorScheme(.dark)
}
