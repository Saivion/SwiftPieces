// swiftpieces:
// title: Step Trail
// description: "A row of glass stops with one capsule that carries the step you are on. Drag the capsule or flick the page: it follows your finger, stretches halfway between stops, rubber-bands past the ends and lands with the flick's speed while the title morphs. The stop it rests on grows from a dot into a labeled capsule, joined to its neighbours only while it is passing them."
// category: navigation
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [steps, pager, onboarding, glass, morph, drag, haptics]

import SwiftUI

/// A paged step with a glass capsule you can throw along a trail of stops.
///
/// `selection` is the id of the current step. Dragging the trail or the page sets a continuous position and
/// releases onto a stop. The page's title morphs; its detail fades with the landing.
///
/// - Parameters:
///   - steps: Stops in order. Each has a title, an SF Symbol and a sentence of detail.
///   - selection: Id of the selected step.
///   - haptics: A selection tick each time the capsule lands on or crosses a stop.
///   - style: Ink, muted detail and the capsule tint. `.standard` paints the capsule in signal red.
public struct StepTrail: View {
    /// One stop on the trail.
    public struct Step: Identifiable, Hashable, Sendable {
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

    public struct Style: Sendable {
        public var ink: Color
        public var muted: Color
        public var accent: Color

        public init(
            ink: Color = StepTrail.adaptive(light: 0x141414, dark: 0xF4F3EF),
            muted: Color = StepTrail.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
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
    @Binding private var selection: String
    @State private var index: CGFloat = 0
    @State private var dragging = false
    @State private var origin: CGFloat?
    @State private var crossings = 0
    @State private var landed = 0

    private let steps: [Step]
    private let haptics: Bool
    private let style: Style

    public init(steps: [Step], selection: Binding<String>, haptics: Bool = true, style: Style = .standard) {
        self.steps = steps
        self._selection = selection
        self.haptics = haptics
        self.style = style
        let start = CGFloat(steps.firstIndex(where: { $0.id == selection.wrappedValue }) ?? 0)
        self._index = State(initialValue: start)
        self._landed = State(initialValue: Int(start))
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(alignment: .leading, spacing: 22) {
            page
            trail
                .frame(height: 56)
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: crossings)
        .onChange(of: selection) { _, id in
            guard let next = steps.firstIndex(where: { $0.id == id }) else { return }
            guard !dragging else { return }
            withAnimation(motion.snap) { index = CGFloat(next) }
        }
        .onChange(of: index) { _, new in
            let step = clamped(new)
            guard step != landed else { return }
            landed = step
            if dragging, haptics { crossings += 1 }
            let id = steps[step].id
            if selection != id { selection = id }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Steps")
        .accessibilityValue(spoken)
        .accessibilityAdjustableAction { direction in
            let next = landed + (direction == .increment ? 1 : -1)
            guard steps.indices.contains(next) else { return }
            withAnimation(motion.snap) { index = CGFloat(next) }
        }
    }

    private var spoken: String {
        guard steps.indices.contains(landed) else { return "" }
        let step = steps[landed]
        return "\(step.title), \(landed + 1) of \(steps.count). \(step.detail)"
    }

    private func clamped(_ value: CGFloat) -> Int {
        guard !steps.isEmpty else { return 0 }
        return min(max(Int(value.rounded()), 0), steps.count - 1)
    }

    private var page: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let step = steps.isEmpty ? nil : steps[clamped(index)]
        return VStack(alignment: .leading, spacing: 8) {
            if let step {
                HStack(spacing: 8) {
                    Image(systemName: step.symbol)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(style.accent)
                    PieceMorphText(text: step.title, font: .title3.weight(.semibold))
                }
                Text(step.detail)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .id(step.id)
                    .transition(motion.transition(.opacity))
            }
        }
        .foregroundStyle(style.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 88, alignment: .topLeading)
        .contentShape(Rectangle())
        .gesture(throwPage)
        .animation(dragging ? nil : motion.morph, value: landed)
    }

    private var trail: some View {
        GeometryReader { proxy in
            let count = max(steps.count, 1)
            let slot = proxy.size.width / CGFloat(count)
            let between = abs(index - index.rounded())
            let width = min(slot * 0.86 + between * slot * 0.7, proxy.size.width - 8)
            let center = (index + 0.5) * slot
            let leading = layoutDirection == .rightToLeft ? proxy.size.width - center - width / 2 : center - width / 2
            PieceLiquidGroup {
            ZStack(alignment: .leading) {
                HStack(spacing: 0) {
                    ForEach(steps) { step in
                        Circle()
                            .fill(Color.clear)
                            .frame(width: 14, height: 14)
                            .pieceLiquid(Circle(), interactive: false)
                            .frame(width: slot, height: 44)
                            .accessibilityHidden(true)
                    }
                }
                Text(steps.isEmpty ? "" : steps[clamped(index)].title)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                    .padding(.horizontal, 10)
                    .frame(width: max(width, 44), height: 36)
                    .pieceLiquid(.capsule, tint: style.accent, interactive: true)
                    .pieceLiquidPress(dragging, depth: 2)
                    .offset(x: min(max(leading, 0), proxy.size.width - width))
                    .animation(dragging || reduceMotion ? nil : PieceMotion(reduceMotion: reduceMotion).follow(rank: 1), value: index)
            }
            }
            .contentShape(Rectangle())
            .gesture(scrub(slot: slot, count: count))
        }
    }

    private var throwPage: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard steps.count > 1 else { return }
                if origin == nil { origin = index }
                dragging = true
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let raw = (origin ?? index) - sign * value.translation.width / 180
                index = PieceMotion.rubberBand(raw, in: 0...CGFloat(steps.count - 1), limit: 0.35)
            }
            .onEnded { value in release(value, span: 180) }
    }

    private func scrub(slot: CGFloat, count: Int) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard count > 1 else { return }
                if origin == nil { origin = index }
                dragging = true
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let raw = (origin ?? index) + sign * value.translation.width / max(slot, 1)
                index = PieceMotion.rubberBand(raw, in: 0...CGFloat(count - 1), limit: 0.35)
            }
            .onEnded { value in release(value, span: max(slot, 1)) }
    }

    private func release(_ value: DragGesture.Value, span: CGFloat) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let from = index
        dragging = false
        origin = nil
        guard steps.count > 1 else { return }
        let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
        let velocity = sign * value.velocity.width / span
        let projected = PieceMotion.project(from, velocity: velocity)
        let stops = (0..<steps.count).map { CGFloat($0) }
        let target = min(max(PieceMotion.nearest(projected, in: stops), 0), CGFloat(steps.count - 1))
        withAnimation(motion.settle(velocity: velocity, from: from, to: target)) {
            index = target
        }
        if haptics, Int(target.rounded()) != clamped(from) { crossings += 1 }
    }

    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct StepTrailExample: View {
    @State private var selection = "pack"

    private let steps: [StepTrail.Step] = [
        .init(id: "pack", title: "Pack", symbol: "suitcase.fill", detail: "Two days, one bag, the red jacket on top."),
        .init(id: "train", title: "Train", symbol: "tram.fill", detail: "Platform 4, the slow one that hugs the coast."),
        .init(id: "walk", title: "Walk", symbol: "figure.walk", detail: "Down through the pines before the light goes."),
        .init(id: "stay", title: "Stay", symbol: "moon.fill", detail: "A room over the water and the windows open."),
    ]

    var body: some View {
        StepTrail(steps: steps, selection: $selection)
            .padding(28)
            .frame(maxWidth: 380)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { StepTrailBackdrop() }
    }
}

private struct StepTrailBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack {
                StepTrail.adaptive(light: 0xF3F2EE, dark: 0x121212)
                Capsule().fill(Color(red: 0.663, green: 0.863, blue: 0.718)).frame(width: w * 0.8, height: 80).position(x: w * 0.4, y: h * 0.3)
                Circle().fill(Color(red: 1, green: 0.851, blue: 0.463)).frame(width: w * 0.4).position(x: w * 0.78, y: h * 0.72)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    StepTrailExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    StepTrailExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum, rubberBand, pressMath)

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
    /// Follow-through: rank 0 leads, each later rank arrives a beat later on a slightly looser spring. Safe to reverse.
    func follow(_ spring: Spring = PieceMotion.elastic, rank: Int) -> Animation {
        guard !reduceMotion else { return .spring(duration: 0.25, bounce: 0) }
        let k = Double(min(max(rank, 0), 6))
        return .spring(duration: spring.duration + 0.04 * k, bounce: min(spring.bounce + 0.02 * k, 0.55))
    }

    /// One-shot entrances only: item `index` waits 30ms per place, capped at the seventh. Exits go together.
    func cascade(_ animation: Animation, index: Int, step: Double = 0.03) -> Animation {
        guard !reduceMotion, index > 0 else { return animation }
        return animation.delay(step * Double(min(index, 7)))
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
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, morphText)

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
