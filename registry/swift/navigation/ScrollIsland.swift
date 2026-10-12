// swiftpieces:
// title: Scroll Island
// description: "A floating liquid glass island that names the section you are in. Drag it sideways to scrub sections: the capsule follows your finger, rubber-bands past the ends and lands where the flick was heading, with a tick at each section and the title morphing letter by letter. Tap it and a detail line opens inside the glass while an Open bubble buds out underneath on a liquid neck, then melts home when you tap again."
// category: navigation
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [island, scroll, section, glass, morph, scrub, dynamic island, haptics]

import SwiftUI

/// A floating glass island for the section a scroll view is in.
///
/// Bind `position` to a continuous section index (0 at the first stop). Dragging the island scrubs it; a flick
/// lands on the stop the gesture was heading for. `expanded` opens the detail and buds an Open bubble.
///
/// ```swift
/// ScrollIsland(stops: stops, position: $section, expanded: $open) { stop in
///     open(stop)
/// }
/// ```
///
/// - Parameters:
///   - stops: Sections in order. Each has a title, an SF Symbol and a short detail.
///   - position: Continuous index of the current section. 0 is the first stop. Values between stops are in flight.
///   - expanded: Whether the detail and the Open bubble are out.
///   - haptics: A selection tick as the island crosses a section, and a light tick when it opens or closes.
///   - onOpen: Called when the Open bubble is tapped, with the stop the island is resting on.
///   - style: Ink, muted detail and the Open bubble's tint. `.standard` is house ink on signal red.
public struct ScrollIsland: View {
    /// One section the island can rest on.
    public struct Stop: Identifiable, Hashable, Sendable {
        public var id: String
        public var title: String
        public var symbol: String
        public var detail: String

        public init(id: String, title: String, symbol: String, detail: String) {
            self.id = id
            self.title = title
            self.symbol = symbol
            self.detail = detail
        }
    }

    /// Visual tuning. `standard` is house ink with a signal Open bubble.
    public struct Style: Sendable {
        public var ink: Color
        public var muted: Color
        /// Glass tint of the Open bubble.
        public var accent: Color

        public init(
            ink: Color = ScrollIsland.adaptive(light: 0x141414, dark: 0xF4F3EF),
            muted: Color = ScrollIsland.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
            accent: Color = Color(red: 1, green: 0, blue: 0)
        ) {
            self.ink = ink
            self.muted = muted
            self.accent = accent
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @ScaledMetric(relativeTo: .subheadline) private var typeScale: CGFloat = 1

    @Binding private var position: CGFloat
    @Binding private var expanded: Bool
    @State private var origin: CGFloat?
    @State private var landed: Int = 0
    @State private var crossings = 0
    @State private var toggles = 0
    @State private var buds = PieceBuds()

    private let stops: [Stop]
    private let haptics: Bool
    private let onOpen: (Stop) -> Void
    private let style: Style
    /// Points of drag that move the island by one section.
    private let span: CGFloat = 148

    public init(
        stops: [Stop],
        position: Binding<CGFloat>,
        expanded: Binding<Bool>,
        haptics: Bool = true,
        onOpen: @escaping (Stop) -> Void = { _ in },
        style: Style = .standard
    ) {
        self.stops = stops
        self._position = position
        self._expanded = expanded
        self.haptics = haptics
        self.onOpen = onOpen
        self.style = style
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        PieceLiquidGroup {
            ZStack {
                capsule
                if buds.contains("open"), let stop = current {
                    openBubble(stop)
                }
            }
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: crossings)
        .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light, intensity: 0.7), trigger: toggles)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Section")
        .accessibilityValue(spoken)
        .accessibilityAdjustableAction { direction in
            let next = landed + (direction == .increment ? 1 : -1)
            guard stops.indices.contains(next) else { return }
            withAnimation(motion.snap) { position = CGFloat(next) }
        }
        .accessibilityAction(named: expanded ? "Collapse" : "Expand") { setExpanded(!expanded) }
        .onAppear {
            landed = clampedStep(position)
            if expanded { buds.place(["open"]) }
        }
        .onChange(of: position) { _, new in
            let step = clampedStep(new)
            guard step != landed else { return }
            landed = step
            if origin != nil, haptics { crossings += 1 }
        }
        .onChange(of: expanded) { _, open in
            Task { @MainActor in
                if open { await buds.bloom(["open"], reduceMotion: reduceMotion) }
                else { await buds.gather(["open"], reduceMotion: reduceMotion) }
            }
        }
    }

    private var current: Stop? {
        guard !stops.isEmpty else { return nil }
        return stops[clampedStep(position)]
    }

    private var spoken: String {
        guard let stop = current else { return "Empty" }
        return expanded ? "\(stop.title), \(stop.detail)" : stop.title
    }

    private func clampedStep(_ value: CGFloat) -> Int {
        guard !stops.isEmpty else { return 0 }
        return min(max(Int(value.rounded()), 0), stops.count - 1)
    }

    private var capsule: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        HStack(spacing: 10) {
            if let stop = current {
                Image(systemName: stop.symbol)
                    .font(.body.weight(.semibold))
                    .frame(width: 22 * min(typeScale, 1.4))
                VStack(alignment: .leading, spacing: 2) {
                    PieceMorphText(text: stop.title, font: .subheadline.weight(.semibold))
                    if expanded {
                        Text(stop.detail)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(style.muted)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(motion.transition(.opacity))
                    }
                }
            }
        }
        .foregroundStyle(style.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, expanded ? 14 : 11)
        .frame(minWidth: 168, maxWidth: 280, alignment: .leading)
        .pieceLiquid(.capsule, interactive: true)
        .pieceLiquidPress(origin != nil, depth: 2)
        .animation(origin == nil ? motion.morph : nil, value: expanded)
        .gesture(scrub)
    }

    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard stops.count > 1 else { return }
                if origin == nil { origin = position }
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let raw = (origin ?? position) + sign * value.translation.width / span
                let last = CGFloat(stops.count - 1)
                position = PieceMotion.rubberBand(raw, in: 0...last, limit: 0.42)
            }
            .onEnded { value in
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let moved = hypot(value.translation.width, value.translation.height)
                let from = position
                origin = nil
                if moved < 10 {
                    withAnimation(motion.snap) { position = CGFloat(clampedStep(from)) }
                    setExpanded(!expanded)
                    return
                }
                guard stops.count > 1 else { return }
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let velocity = sign * value.velocity.width / span
                let projected = PieceMotion.project(from, velocity: velocity)
                let last = CGFloat(stops.count - 1)
                let target = min(max(PieceMotion.nearest(projected, in: Array(0...stops.count - 1).map { CGFloat($0) }), 0), last)
                withAnimation(motion.settle(velocity: velocity, from: from, to: target)) {
                    position = target
                }
            }
    }

    private func setExpanded(_ open: Bool) {
        guard open != expanded else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        withAnimation(motion.morph) { expanded = open }
        if haptics { toggles += 1 }
    }

    private func openBubble(_ stop: Stop) -> some View {
        let out = buds.isOut("open")
        return Button {
            onOpen(stop)
        } label: {
            Text("Open")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                .pieceBudContent(out: out)
                .padding(.horizontal, 16)
                .frame(minHeight: 36)
        }
        .buttonStyle(PieceLiquidPressStyle(depth: 2.2))
        .pieceLiquid(.capsule, tint: style.accent, interactive: true)
        .pieceBud(out: out, rest: CGSize(width: 0, height: 58), home: .zero)
        .animation(out ? PieceLiquid.split(reduceMotion: reduceMotion) : PieceLiquid.home(reduceMotion: reduceMotion), value: out)
        .accessibilityHidden(true)
    }

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

/// The island over a short trip, scrubbing itself and opening on tap. The blocks behind it are what the glass reads.
private struct ScrollIslandExample: View {
    @State private var position: CGFloat = 0
    @State private var expanded = false
    @State private var opened = ""

    private let stops: [ScrollIsland.Stop] = [
        .init(id: "arrive", title: "Arrive", symbol: "airplane", detail: "Kansai, 14:20 · pocket Wi-Fi"),
        .init(id: "fushimi", title: "Fushimi", symbol: "tram.fill", detail: "Day 2 · torii at dusk"),
        .init(id: "arashiyama", title: "Arashiyama", symbol: "leaf.fill", detail: "Day 3 · 2.4 km along the river"),
        .init(id: "nara", title: "Nara", symbol: "pawprint.fill", detail: "Day 4 · park before noon"),
    ]

    var body: some View {
        ZStack {
            ScrollIslandBackdrop()
            VStack(spacing: 18) {
                ScrollIsland(stops: stops, position: $position, expanded: $expanded, onOpen: { opened = $0.title })
                Text(opened.isEmpty ? "Drag the island, or tap it." : "Opened \(opened)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ScrollIsland.adaptive(light: 0x141414, dark: 0xF4F3EF))
            }
            .padding(.horizontal, 28)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.4))
                let next = (Int(position.rounded()) + 1) % stops.count
                withAnimation(PieceMotion(reduceMotion: false).snap) { position = CGFloat(next) }
            }
        }
    }
}

private struct ScrollIslandBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack {
                ScrollIsland.adaptive(light: 0xF3F2EE, dark: 0x121212)
                Circle().fill(Color(red: 1, green: 0.851, blue: 0.463)).frame(width: w * 0.72).position(x: w * 0.8, y: h * 0.28)
                RoundedRectangle(cornerRadius: 36, style: .continuous).fill(Color(red: 0.612, green: 0.761, blue: 1))
                    .frame(width: w * 0.7, height: h * 0.28).rotationEffect(.degrees(-8)).position(x: w * 0.22, y: h * 0.72)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    ScrollIslandExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    ScrollIslandExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand, pressMath)

/// The SwiftPieces motion language: five spring tiers, and a named role for every moment a piece moves,
/// each with its Reduce Motion substitute.
///
/// Build one from the environment, `PieceMotion(reduceMotion: reduceMotion)`, and pick the role that names
/// what just happened. Never animate the tracking of a finger: set gesture state directly in `onChanged`, so the
/// surface stays under the finger, and spring only the release.
private struct PieceMotion {
    var reduceMotion = false

    // Tiers. Overshoot and settle times are measured from rest with SwiftUI's Spring.
    /// No overshoot, 90% in about 90ms. A press arriving under the finger.
    static var tight: Spring { Spring(duration: 0.14, bounce: 0) }
    /// About 2.8% overshoot, 90% in about 140ms. Snapping to a detent, page or segment.
    static var responsive: Spring { Spring(duration: 0.32, bounce: 0.25) }
    /// About 8.4% overshoot. Visible give: a release, a return from past an edge, a drag settling home.
    static var elastic: Spring { Spring(duration: 0.42, bounce: 0.38) }
    /// About 15% overshoot. A resolved action landing. At most once per interaction.
    static var expressive: Spring { Spring(duration: 0.48, bounce: 0.48) }
    /// About 1.5% overshoot, unhurried. Opening large surfaces and ambient change.
    static var calm: Spring { Spring(duration: 0.5, bounce: 0.2) }

    /// Reduce Motion: settles become this short spring with no overshoot.
    private static var still: Animation { .spring(duration: 0.25, bounce: 0) }

    // Roles.
    /// Touch-down. Starts on the same frame and never bounces under the finger.
    var press: Animation { .spring(Self.tight) }
    /// The finger lifts off a pressed surface, which springs back through rest.
    var release: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A dragged thing comes to rest. With a gesture's velocity, use `settle(velocity:from:to:)` instead.
    var settle: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// Lands on a detent, page or segment.
    var snap: Animation { reduceMotion ? Self.still : .spring(Self.responsive) }
    /// A number, a chart value or anything else people read moves to its new value. Never overshoots, so it
    /// never shows a value that isn't true.
    var value: Animation { reduceMotion ? Self.still : .spring(duration: 0.35, bounce: 0) }
    /// Comes back from past a limit: a pull beyond the edge, a value pushed against its bound.
    var rebound: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A shape or container changes size, corner radius or form, with a little give at the end.
    var morph: Animation { reduceMotion ? Self.still : .spring(duration: 0.4, bounce: 0.2) }
    /// Something appears, opens or expands. Opening is a little slower than closing.
    var reveal: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.calm) }
    /// Something leaves, closes or collapses. Quick and firm, out of the way.
    var dismiss: Animation { reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.3, bounce: 0.08) }
    /// A resolved action lands: a check, a sent state, a reaction.
    var success: Animation { reduceMotion ? .easeOut(duration: 0.24) : .spring(Self.expressive) }
    /// A refused action. Firm, no wobble; `pieceShake` adds the movement.
    var error: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.responsive) }
    /// Slow ambient change. Loops themselves stop under Reduce Motion: check `allowsAmbient`.
    var ambient: Animation { reduceMotion ? .easeInOut(duration: 0.3) : .spring(Self.calm) }

    /// Loops, drifts, idle breathing and parallax run only when this is true.
    var allowsAmbient: Bool { !reduceMotion }

    /// A moving transition, or a plain fade under Reduce Motion.
    func transition(_ transition: AnyTransition) -> AnyTransition {
        reduceMotion ? .opacity : transition
    }

    /// For content replaced inside a container that stays put (a label, a glyph, a count): the old content
    /// blurs out as the new one sharpens in. A fade under Reduce Motion.
    @MainActor var swap: AnyTransition {
        reduceMotion ? .opacity : AnyTransition(.blurReplace)
    }
}

extension PieceMotion {
    /// Where a flick at `velocity` (pt/s) coasts to. 0.998 coasts like a scroll view; 0.99 suits detents.
    nonisolated static func project(_ position: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.99) -> CGFloat {
        position + velocity / 1000 * decelerationRate / (1 - decelerationRate)
    }

    /// The candidate closest to `value`.
    nonisolated static func nearest(_ value: CGFloat, in candidates: [CGFloat]) -> CGFloat {
        candidates.min { abs($0 - value) < abs($1 - value) } ?? value
    }

    /// A settle that leaves at the finger's speed (pt/s). One per axis, each on its own `.offset(x:)` / `.offset(y:)`:
    /// a spring takes one velocity. SwiftUI's own velocity carry-over is unreliable; this always carries it.
    func settle(velocity: CGFloat, from current: CGFloat, to target: CGFloat, spring: Spring = PieceMotion.elastic) -> Animation {
        let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : spring
        let distance = target - current
        guard abs(distance) >= 1 else { return .spring(spring) }
        // In whole distances per second, capped near the spring's frequency: a hard flick adds give, not a slingshot.
        // At exactly the frequency a critically damped spring cannot pass its target, so Reduce Motion stops there.
        let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
        let relative = min(max(Double(velocity / distance), -cap), cap)
        return .interpolatingSpring(spring, initialVelocity: relative)
    }
}

extension PieceMotion {
    /// A scroll view's edge resistance for a pull `overshoot` points past a limit; never reaches `limit`.
    /// About 24 to 40 for thumbs and toggles, 60 to 120 for cards and sheets. Band the total pull, not deltas.
    nonisolated static func rubberBand(_ overshoot: CGFloat, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard limit > 0, overshoot != 0 else { return 0 }
        let banded = (1 - 1 / (abs(overshoot) * coefficient / limit + 1)) * limit
        return overshoot < 0 ? -banded : banded
    }

    /// `value` inside `range` passes through unchanged; past either end it moves with rubber-band resistance.
    nonisolated static func rubberBand(_ value: CGFloat, in range: ClosedRange<CGFloat>, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        if value < range.lowerBound { return range.lowerBound + rubberBand(value - range.lowerBound, limit: limit, coefficient: coefficient) }
        if value > range.upperBound { return range.upperBound + rubberBand(value - range.upperBound, limit: limit, coefficient: coefficient) }
        return value
    }
}

extension PieceMotion {
    /// About `depth` points per edge, not a fixed percentage: an icon sinks to 0.92, a pill 0.95, a card 0.985.
    nonisolated static func pressScale(for size: CGSize, depth: CGFloat = 2.5) -> CGFloat {
        let side = (max(size.width, 1) * max(size.height, 1)).squareRoot()
        return min(max(1 - depth * 2 / side, 0.92), 0.985)
    }

    /// An anchor partway from the center toward the touch, so the press leans into the finger without tipping.
    nonisolated static func pressAnchor(touch: CGPoint?, in size: CGSize, lean: CGFloat = 0.6) -> UnitPoint {
        guard let touch, size.width > 0, size.height > 0 else { return .center }
        let x = min(max(touch.x / size.width, 0), 1)
        let y = min(max(touch.y / size.height, 0), 1)
        return UnitPoint(x: 0.5 + (x - 0.5) * lean, y: 0.5 + (y - 0.5) * lean)
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud, morphText)

/// The liquid glass language: one merge distance, two rest gaps, and the springs a bubble leaves and comes home on.
///
/// Glass shapes inside one `PieceLiquidGroup` melt into each other through a neck when they come within `merge`
/// points. Parts of one control rest `joined`, inside that distance, so the neck holds; separate actions rest
/// `apart`, outside it, so they only goo while one buds out of, or melts back into, another.
private enum PieceLiquid {
    /// Glass shapes closer than this share a neck.
    static let merge: CGFloat = 20
    /// The gap between parts of one control (a stepper's buttons, a progress pill and its stop): the neck holds,
    /// short and smooth, about two thirds of the shapes' height at its waist. Joined parts read best at one height.
    static let joined: CGFloat = 4
    /// The gap between separate actions (menu items, confirm and cancel, chips): they rest as their own bubbles.
    static let apart: CGFloat = 26
    /// How far a bubble shrinks while it is home inside its parent.
    static let homeScale: CGFloat = 0.72

    /// A bubble leaving its parent: slow enough that the neck's stretch and snap read.
    static func split(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.62, bounce: 0.22)
    }

    /// A bubble going home. No bounce: a bounce would carry it out through the far side of its parent.
    static func home(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.5, bounce: 0)
    }
}

/// A group of glass shapes that merge into one liquid surface. On iOS 26 it is a `GlassEffectContainer`; before
/// that, and under Reduce Transparency, the shapes draw on their own and simply don't merge. `lift` adds the soft
/// shadow liquid glass floats on in light mode.
private struct PieceLiquidGroup<Content: View>: View {
    var spacing: CGFloat = PieceLiquid.merge
    var lift = true
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        container
            .shadow(color: .black.opacity(lift && colorScheme == .light ? 0.07 : 0), radius: 18, y: 8)
    }

    @ViewBuilder private var container: some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// One liquid glass shape: Liquid Glass on iOS 26, carrying `tint` as a solid colour and swelling under a press when
/// `interactive`; a frosted Material with a light rim and a soft shadow before that; a solid fill under Reduce
/// Transparency.
///
/// The tint is painted inside clear glass rather than tinting the glass. Tinted glass in a group bleeds its colour
/// through every neck as a smear, so a red button would glow into the white pill it is joined to; painted inside,
/// the colour stays crisp to the shape's edge, the necks between shapes are clear glass, and a tint change animates
/// like any colour (tinted glass snaps).
private struct PieceLiquidSurface<S: Shape>: ViewModifier {
    var shape: S
    var tint: Color?
    var interactive: Bool
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.pieceLiquidScale) private var scale

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            // Scaled as two parts, content and outline, about the same centre. A scaleEffect on a glass view inside a
            // GlassEffectContainer shrinks the glass but leaves what it carries full size, pinned to its corner.
            content
                .background { shape.fill(tint ?? .clear) }
                .scaleEffect(scale)
                .glassEffect(glass, in: shape.scale(scale))
        } else {
            fallback(content).scaleEffect(scale)
        }
        #else
        fallback(content).scaleEffect(scale)
        #endif
    }

    #if compiler(>=6.2)
    @available(iOS 26, *)
    private var glass: Glass {
        interactive ? Glass.regular.interactive() : .regular
    }
    #endif

    private func fallback(_ content: Content) -> some View {
        let dark = colorScheme == .dark
        return content
            .background {
                if reduceTransparency {
                    shape.fill(tint ?? (dark ? Color(white: 0.17) : Color(white: 0.97)))
                } else {
                    ZStack {
                        shape.fill(.regularMaterial)
                        if let tint { shape.fill(tint.opacity(0.88)) }
                    }
                }
            }
            .overlay { shape.stroke(Color.white.opacity(dark ? 0.14 : 0.7), lineWidth: 0.5) }
            .shadow(color: .black.opacity(dark ? 0.32 : 0.08), radius: 10, y: 5)
    }
}

private struct PieceLiquidScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

private extension EnvironmentValues {
    /// How much the liquid shapes below are scaled, about their own centres. Nested scales multiply.
    var pieceLiquidScale: CGFloat {
        get { self[PieceLiquidScaleKey.self] }
        set { self[PieceLiquidScaleKey.self] = newValue }
    }
}

private extension View {
    /// Draws this view on a liquid glass `shape`. Put it inside a `PieceLiquidGroup` so it can merge with its neighbours.
    func pieceLiquid<S: Shape>(_ shape: S, tint: Color? = nil, interactive: Bool = true) -> some View {
        modifier(PieceLiquidSurface(shape: shape, tint: tint, interactive: interactive))
    }

    /// Scales the liquid glass shapes in this view, content and outline together, about their own centres. Use it
    /// instead of `scaleEffect` on a glass view (a press, a lift, a swell): inside a group a plain `scaleEffect` shrinks
    /// the glass but leaves its content full size and off centre. Animates like any other value.
    func pieceLiquidScale(_ scale: CGFloat) -> some View {
        transformEnvironment(\.pieceLiquidScale) { $0 *= scale }
    }
}

/// The press for a glass control: the same size-aware sink and lean as `piecePress`, applied through
/// `pieceLiquidScale` so the glass and what it carries sink together (a plain scaleEffect on glass leaves the content
/// behind). Put the glass inside what it presses: the label of a button, the view this modifies. Under Reduce Motion
/// it shades instead of moving.
private struct PieceLiquidPress: ViewModifier {
    let pressed: Bool
    var touch: CGPoint?
    var depth: CGFloat = 2.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero
    @State private var anchor: UnitPoint = .center

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let scale = pressed && !reduceMotion ? PieceMotion.pressScale(for: size, depth: depth) : 1
        // A scale about `anchor` is a scale about the centre plus this shift toward the anchor.
        let lean = CGSize(width: (anchor.x - 0.5) * size.width * (1 - scale), height: (anchor.y - 0.5) * size.height * (1 - scale))
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .pieceLiquidScale(scale)
            .offset(lean)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

/// `PiecePressStyle` for glass buttons: the label (with its `.pieceLiquid` inside) sinks as one.
private struct PieceLiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed, depth: depth)
    }
}

private extension View {
    /// Sinks this view's glass while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func pieceLiquidPress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PieceLiquidPress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// The bud: how a bubble leaves and rejoins its parent, driven explicitly so every bubble shows the whole cycle.
///
/// A bubble is born at `home`, inside its parent, where the two glass shapes are one. It springs out to `rest`, and
/// while it is inside the merge distance a neck holds it to the parent, thinning as it goes, until it snaps free.
/// Going home it springs back on a spring with no bounce, the neck reaches out and re-forms, and only once it has
/// melted all the way in is it removed. Both offsets are relative to where the bubble is laid out. Under Reduce
/// Motion it stays at `rest`: its content fades and its glass closes in place.
private struct PieceBud: ViewModifier {
    var out: Bool
    var rest: CGSize
    var home: CGSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            // No travel. Inside a group glass ignores opacity, so the glass closes to nothing in place on the short
            // Reduce Motion ease while its content fades; the opacity covers a bubble outside a group.
            content
                .pieceLiquidScale(out ? 1 : 0.001)
                .opacity(out ? 1 : 0)
                .offset(rest)
        } else {
            // The glass shrinks through `pieceLiquidScale`, never a plain scaleEffect (see there), then moves.
            content
                .pieceLiquidScale(out ? 1 : PieceLiquid.homeScale)
                .offset(out ? rest : home)
        }
    }
}

/// A bubble's own content, on its own clock: gone the moment the bubble heads home, so it never rides over the
/// parent's content, and arriving just after the bubble leaves.
private struct PieceBudContent: ViewModifier {
    var out: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: out ? 0 : 6)
            .opacity(out ? 1 : 0)
            .animation(out ? .easeOut(duration: 0.3).delay(0.1) : .easeOut(duration: 0.14), value: out)
    }
}

private extension View {
    /// Places a bubble at `rest` while `out`, and at `home` (inside its parent, shrunk) while not.
    func pieceBud(out: Bool, rest: CGSize = .zero, home: CGSize) -> some View {
        modifier(PieceBud(out: out, rest: rest, home: home))
    }

    /// Hides a bubble's icon or label while it is home. Put it on the content, inside the glass.
    func pieceBudContent(out: Bool) -> some View {
        modifier(PieceBudContent(out: out))
    }
}

/// Which bubbles exist and which are out. A bubble is added home with no animation, sent out on the next frame,
/// and called home before it is removed, so it always melts in rather than fading. Keep one in `@State`.
@MainActor @Observable
private final class PieceBuds {
    private(set) var present: [String] = []
    private(set) var out: Set<String> = []
    /// The latest call for each bubble. A bloom or gather that has been overtaken (a bubble sent home while it was
    /// still waiting to go out, or called out again while melting) leaves that bubble alone.
    @ObservationIgnored private var turn: [String: Int] = [:]

    func contains(_ id: String) -> Bool { present.contains(id) }
    func isOut(_ id: String) -> Bool { out.contains(id) }

    private func claim(_ ids: [String]) -> [String: Int] {
        var mine: [String: Int] = [:]
        for id in ids {
            let next = (turn[id] ?? 0) + 1
            turn[id] = next
            mine[id] = next
        }
        return mine
    }

    /// Puts bubbles straight out at rest with no motion: a view's first frame, or a state restored.
    func place(_ ids: [String]) {
        _ = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
            out.formUnion(ids)
        }
    }

    /// Adds bubbles home, then sends each out, `stagger` seconds apart, after an optional `delay`.
    func bloom(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.05, delay: Double = 0) async {
        let mine = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
        }
        try? await Task.sleep(for: .milliseconds(24 + Int(max(delay, 0) * 1000)))
        let split = PieceLiquid.split(reduceMotion: reduceMotion)
        for (i, id) in ids.enumerated() where turn[id] == mine[id] {
            withAnimation(split.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.insert(id) }
        }
    }

    /// Calls bubbles home, last first, then removes them once they have melted in.
    func gather(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.04) async {
        let mine = claim(ids)
        let home = PieceLiquid.home(reduceMotion: reduceMotion)
        for (i, id) in ids.reversed().enumerated() {
            withAnimation(home.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.remove(id) }
        }
        try? await Task.sleep(for: .milliseconds(Int((0.52 + Double(ids.count) * stagger) * 1000)))
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { present.removeAll { ids.contains($0) && !out.contains($0) && turn[$0] == mine[$0] } }
    }
}

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
