// swiftpieces:
// title: Elastic Button
// description: A ButtonStyle that squashes toward the touch point, stretches along the drag with rubber-band resistance, deepens after a hold and springs back with as much give as the pull put in. Optional liquid glass surfaces (signal, block and clear raised glass) float on a soft lift that flattens under the finger, and the glass darkens as it is pressed.
// category: controls
// minIOSVersion: "17.0"
// version: "2.2.0"
// tags: [button, style, spring, drag, haptics, depth, glass]

import SwiftUI

/// Squash-and-stretch press for any `Button`. Apply with `.buttonStyle(.elastic)`, or `.buttonStyle(.elastic(.signal))` to also draw the surface.
///
/// - Parameters:
///   - squash: Scale while pressed, anchored toward the touch point. Holding 350ms eases 0.03 deeper.
///   - bounce: The release's extra give. A tap gets half of it and a press pulled to the edge all of it, so with the default 0.2 a tap lands on the house elastic spring and a full pull on the expressive one.
///   - haptics: Plays a solid impact on press, a soft one when the hold deepens, and a soft one when a drag cancels.
///   - style: The surface drawn behind the label. `.standard` draws nothing and only adds the motion; `.signal`, `.block(_:)` and `.raised` draw a liquid glass capsule (tinted signal, tinted with the block, or clear), a soft lift that flattens on press, and a darken under the finger.
public struct ElasticButton: ButtonStyle {
    /// Surface, ink and depth for the button. Colors adapt to light and dark.
    public struct Style: Sendable {
        /// The glass surface's tint. `.clear` draws clear glass; `nil` draws no surface, leaving the label as you drew it with only the motion.
        public var fill: Color?
        /// Label color on the glass.
        public var ink: Color
        /// Corner radius. `nil` draws a capsule.
        public var radius: CGFloat?
        /// Minimum height of the surface. 56 by default, never below the 44pt target.
        public var height: CGFloat
        /// Horizontal padding inside the surface.
        public var padding: CGFloat
        /// Floats the glass on a soft lift that flattens while pressed.
        public var depth: Bool

        public init(fill: Color? = nil, ink: Color = HouseColor.text, radius: CGFloat? = nil, height: CGFloat = 56, padding: CGFloat = 24, depth: Bool = true) {
            self.fill = fill
            self.ink = ink
            self.radius = radius
            self.height = Swift.max(height, 44)
            self.padding = padding
            self.depth = depth
        }

        /// Motion only: no surface, the label keeps its own look.
        public static let standard = Style(depth: false)
        /// The one primary action: signal-tinted glass with dark ink.
        public static let signal = Style(fill: HouseColor.signal, ink: HouseColor.ink)
        /// A quiet secondary action: clear glass with ink that follows the appearance.
        public static let raised = Style(fill: .clear, ink: HouseColor.text, depth: false)
        /// Glass tinted with a house block and dark ink, for categories and highlights.
        public static func block(_ block: Block) -> Style { Style(fill: block.color, ink: HouseColor.ink) }

        /// The house blocks. Each carries dark ink at 4.5:1 or better.
        public enum Block: Sendable, CaseIterable {
            case tangerine, sky, butter, sage, lilac, sand

            public var color: Color {
                switch self {
                case .tangerine: HouseColor.hex(0xFF0000)
                case .sky: HouseColor.hex(0x9CC2FF)
                case .butter: HouseColor.hex(0xFFD976)
                case .sage: HouseColor.hex(0xA9DCB7)
                case .lilac: HouseColor.hex(0xCDB8FF)
                case .sand: HouseColor.hex(0xE9D5B3)
                }
            }
        }

        /// The Free house palette, adapting to light and dark.
        public enum HouseColor {
            public static let ink = hex(0x141414)
            public static let signal = hex(0xFF0000)
            public static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)
            public static let muted = adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            public static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
            public static let surface = adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            public static let raised = adaptive(light: 0xEAE8E2, dark: 0x262626)

            static func hex(_ value: UInt32) -> Color {
                Color(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
            }

            static func adaptive(light: UInt32, dark: UInt32) -> Color {
                Color(uiColor: UIColor { @Sendable traits in
                    let v = traits.userInterfaceStyle == .dark ? dark : light
                    return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
                })
            }
        }
    }

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero
    @State private var anchor: UnitPoint = .center
    @State private var translation: CGSize = .zero
    @State private var energy: CGFloat = 0
    @State private var down = false
    @State private var deep = false
    @State private var cancelled = false
    @State private var pressTicks = 0
    @State private var deepTicks = 0
    @State private var cancelTicks = 0
    @State private var holdTask: Task<Void, Never>?

    private let squash: CGFloat
    private let bounce: Double
    private let haptics: Bool
    private let style: Style

    public init(squash: CGFloat = 0.96, bounce: Double = 0.2, haptics: Bool = true, style: Style = .standard) {
        self.squash = squash
        self.bounce = bounce
        self.haptics = haptics
        self.style = style
    }

    public func makeBody(configuration: Configuration) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let pressed = configuration.isPressed && !cancelled
        // Reduce Motion: no squash. A label without a surface dims instead; drawn surfaces already darken.
        let base: CGFloat = pressed && !reduceMotion ? (deep ? squash - 0.03 : squash) : 1
        let pull = reduceMotion || !pressed ? .zero : banded(translation)
        surface(configuration.label, pressed: pressed)
            .contentShape(.rect)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .opacity(isEnabled ? (reduceMotion && pressed && style.fill == nil ? 0.75 : 1) : (style.fill == nil ? 0.45 : 1))
            .scaleEffect(base, anchor: anchor)
            // Stretched along the pull and thinned across it, keeping its area, so it reads as pulled rather than moved.
            .pieceStretch(motion.stretch(pull: pull, limit: 0.1, reach: 12))
            .offset(x: pull.width * 0.5, y: pull.height * 0.5)
            .animation(pressed ? motion.press : release(motion), value: pressed)
            // The deepen is still part of the press, so it never bounces under the finger: unhurried, with no overshoot.
            .animation(motion.value, value: deep)
            .simultaneousGesture(tracker)
            .onChange(of: configuration.isPressed) { _, isPressed in
                down = isPressed
                holdTask?.cancel()
                if isPressed {
                    // A new press. A gesture the system cancelled (a scroll took over) never ran onEnded, so start clean.
                    // A finger coming back inside while still past the cancel distance stays cancelled, so it doesn't
                    // press again for a frame and cancel with a second haptic.
                    if hypot(translation.width, translation.height) <= 44 {
                        cancelled = false
                        energy = 0
                        translation = .zero
                    }
                    pressTicks += 1
                    holdTask = Task {
                        try? await Task.sleep(for: .milliseconds(350))
                        guard !Task.isCancelled, down, !cancelled else { return }
                        deep = true
                        deepTicks += 1
                    }
                } else {
                    deep = false
                }
            }
            .sensoryFeedback(.impact(flexibility: .solid, intensity: 0.7), trigger: pressTicks) { _, _ in haptics && isEnabled }
            .sensoryFeedback(.impact(flexibility: .soft), trigger: deepTicks) { _, _ in haptics && isEnabled }
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: cancelTicks) { _, _ in haptics && isEnabled }
    }

    /// Draws the optional liquid glass surface: tinted with the fill (clear for `.clear` and while disabled), ink, a
    /// darken that deepens with the hold, and a lift that flattens under the finger. The glass doesn't swell under the
    /// press on its own: the squash is this style's press.
    @ViewBuilder
    private func surface(_ label: Configuration.Label, pressed: Bool) -> some View {
        if let fill = style.fill {
            let shape = style.radius.map { AnyShape(RoundedRectangle(cornerRadius: $0, style: .continuous)) } ?? AnyShape(Capsule())
            let lift = style.depth && isEnabled
            let strength = colorScheme == .dark ? 0.42 : 0.12
            PieceLiquidGroup(lift: false) {
                label
                    .font(.body.weight(.semibold))
                    .fontWeight(.semibold)
                    .lineLimit(1)
                    .foregroundStyle(isEnabled ? style.ink : Style.HouseColor.muted)
                    .padding(.horizontal, style.padding)
                    .frame(minHeight: style.height)
                    // Press darkens the glass; the hold deepens it.
                    .background(Style.HouseColor.ink.opacity(pressed ? (deep ? 0.16 : 0.09) : 0), in: shape)
                    .pieceLiquid(shape, tint: isEnabled && fill != .clear ? fill : nil, interactive: false)
                    .contentShape(shape)
            }
            // The style's own lift in place of the group's, so it can press flat under the finger.
            .shadow(color: .black.opacity(lift ? strength * (pressed ? 0.3 : 1) : 0), radius: pressed ? 3 : 16, y: pressed ? 1 : 8)
        } else {
            label
        }
    }

    /// Runs alongside the button's own press so we know where the finger is and how far it has moved. The pull
    /// tracks the finger directly, never through an animation, so the stretch is under the finger at every frame.
    private var tracker: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                // Fixed at touch-down and kept through the release, so the button re-expands from where it was pressed.
                anchor = reduceMotion ? .center : PieceMotion.pressAnchor(touch: value.startLocation, in: size)
                translation = value.translation
                let pulled = banded(value.translation)
                energy = min(hypot(pulled.width, pulled.height) / 15, 1)
                if !cancelled, hypot(value.translation.width, value.translation.height) > 44 {
                    cancelled = true
                    cancelTicks += 1
                    holdTask?.cancel()
                    deep = false
                }
            }
            .onEnded { _ in
                withAnimation(release(PieceMotion(reduceMotion: reduceMotion))) { translation = .zero }
            }
    }

    /// The release. A cancelled press lets go without overshoot, so tearing off reads differently from a tap.
    /// Otherwise it springs past rest, with more of `bounce` the further the press was pulled: from 0.28, so the
    /// default 0.2 gives a tap the elastic tier's 0.38 and a full pull the expressive tier's 0.48. The style's name
    /// promises give, so with the default `bounce` a tap never lands firmer than the shared release every other piece
    /// uses. A smaller `bounce` asks for less give, down to 0.28 at zero.
    private func release(_ motion: PieceMotion) -> Animation {
        if reduceMotion { return motion.release }
        if cancelled { return motion.dismiss }
        return .spring(duration: PieceMotion.elastic.duration, bounce: min(0.28 + bounce * (0.5 + 0.5 * Double(energy)), 0.6))
    }

    /// The drag past rest, with rubber-band resistance: it gives about 15pt by the 44pt where the press cancels.
    private func banded(_ t: CGSize) -> CGSize {
        CGSize(width: PieceMotion.rubberBand(t.width, limit: 40), height: PieceMotion.rubberBand(t.height, limit: 40))
    }
}

public extension ButtonStyle where Self == ElasticButton {
    /// Default elastic press: 0.96 squash, an elastic release with 0.2 bounce, haptics on, no surface.
    static var elastic: ElasticButton { ElasticButton() }

    static func elastic(squash: CGFloat = 0.96, bounce: Double = 0.2, haptics: Bool = true, style: ElasticButton.Style = .standard) -> ElasticButton {
        ElasticButton(squash: squash, bounce: bounce, haptics: haptics, style: style)
    }

    /// Elastic press with a drawn surface, for example `.elastic(.signal)` or `.elastic(.block(.sky))`.
    static func elastic(_ style: ElasticButton.Style) -> ElasticButton {
        ElasticButton(style: style)
    }
}

// MARK: - Example

/// The style itself: a signal glass button, a block-tinted one and a disabled clear one. Nothing around them.
private struct ElasticButtonExample: View {
    private typealias House = ElasticButton.Style.HouseColor

    var body: some View {
        VStack(spacing: 12) {
            Button {} label: {
                Label("Reserve table", systemImage: "arrow.right")
                    .labelStyle(TrailingIcon())
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.elastic(.signal))
            HStack(spacing: 12) {
                Button {} label: { Label("Add guest", systemImage: "plus").frame(maxWidth: .infinity) }
                    .buttonStyle(.elastic(squash: 0.94, bounce: 0.3, style: .block(.lilac)))
                Button {} label: { Text("Waitlist").frame(maxWidth: .infinity) }
                    .buttonStyle(.elastic(.raised))
                    .disabled(true)
            }
        }
        .fontWeight(.semibold)
        .frame(maxWidth: 340)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(House.ground)
    }

    private struct TrailingIcon: LabelStyle {
        func makeBody(configuration: Configuration) -> some View {
            HStack(spacing: 8) { configuration.title; configuration.icon }
        }
    }
}

#Preview("Light") { ElasticButtonExample().preferredColorScheme(.light) }
#Preview("Dark") { ElasticButtonExample().preferredColorScheme(.dark) }

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, rubberBand, pressMath, stretch)

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

extension PieceMotion {
    /// Stretch along the direction of travel, low-passed from `current`. Clear it on release and when the finger
    /// rests (a resting finger sends no events).
    func stretch(velocity: CGSize, current: CGSize = .zero, limit: CGFloat = 0.1, referenceSpeed: CGFloat = 2000) -> CGSize {
        guard !reduceMotion else { return .zero }
        let speed = hypot(velocity.width, velocity.height)
        let amount = limit * CGFloat(tanh(Double(speed / referenceSpeed)))
        let axis: CGSize
        if speed > 40 {
            axis = CGSize(width: velocity.width / speed, height: velocity.height / speed)
        } else {
            let length = hypot(current.width, current.height)
            guard length > 0.0001 else { return .zero }
            axis = CGSize(width: current.width / length, height: current.height / length)
        }
        let target = CGSize(width: axis.width * amount, height: axis.height * amount)
        return CGSize(width: current.width + (target.width - current.width) * 0.35, height: current.height + (target.height - current.height) * 0.35)
    }

    /// A stretch for something held `pull` points from where it wants to be, like a band pulled past its edge:
    /// along the pull, easing toward `limit`. Stationary fingers keep it, which is right for a tether.
    func stretch(pull: CGSize, limit: CGFloat = 0.06, reach: CGFloat = 160) -> CGSize {
        guard !reduceMotion else { return .zero }
        let distance = hypot(pull.width, pull.height)
        guard distance > 0.5 else { return .zero }
        let amount = limit * (1 - 1 / (distance / reach + 1))
        return CGSize(width: pull.width / distance * amount, height: pull.height / distance * amount)
    }
}

/// Stretches along any direction and thins across it, keeping the area, so it reads as soft rather than resized.
/// Animate the vector to zero: its direction holds, so the shape never spins. At most 0.03 to 0.05 on text.
private struct PieceStretch: GeometryEffect {
    var vector: CGSize
    var anchor: UnitPoint = .center

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(vector.width, vector.height) }
        set { vector = CGSize(width: newValue.first, height: newValue.second) }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let amount = min(hypot(vector.width, vector.height), 0.2)
        guard amount > 0.0005 else { return ProjectionTransform() }
        let cosine = vector.width / amount, sine = vector.height / amount
        let along = 1 + amount, across = 1 / along, k = along - across
        // Scale by `along` on the stretch axis and `across` perpendicular to it.
        let stretch = CGAffineTransform(a: across + k * cosine * cosine, b: k * cosine * sine, c: k * cosine * sine, d: across + k * sine * sine, tx: 0, ty: 0)
        let x = size.width * anchor.x, y = size.height * anchor.y
        return ProjectionTransform(CGAffineTransform(translationX: -x, y: -y).concatenating(stretch).concatenating(CGAffineTransform(translationX: x, y: y)))
    }
}

private extension View {
    /// Applies a stretch vector. For a tethered pull, anchor it at the pinned edge.
    func pieceStretch(_ vector: CGSize, anchor: UnitPoint = .center) -> some View {
        modifier(PieceStretch(vector: vector, anchor: anchor))
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid)

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

// swiftpieces-liquid: end
