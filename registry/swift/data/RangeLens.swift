// swiftpieces:
// title: Range Lens
// description: "A chart you read by dragging a glass lens across it. Grab the lens to move the window, or grab either edge to resize it; the lens follows your finger, flattens against the ends and lands with the flick. While you drag, a readout buds off the lens on a liquid neck and morphs its numbers, with a tick each time an edge crosses a sample, then melts home when you let go."
// category: data
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [chart, brush, range, lens, glass, scrub, haptics]

import SwiftUI

/// A series with a glass window you drag to choose the range you are reading.
///
/// `lower` and `upper` are fractions of the series, from 0 to 1, `lower` before `upper`. The lens is a glass
/// rounded rectangle melted over the bars it covers. A readout above it names the average inside the window.
///
/// - Parameters:
///   - samples: Values from 0 to 1, left to right. Fewer than two draws an empty track.
///   - lower: Leading edge of the window, from 0 to 1.
///   - upper: Trailing edge of the window, from 0 to 1.
///   - haptics: A selection tick when either edge crosses a sample.
///   - style: Bar ink, the dim ink outside the lens, and the lens tint. `.standard` is house ink with a clear lens.
public struct RangeLens: View {
    public struct Style: Sendable {
        public var ink: Color
        public var muted: Color
        public var accent: Color

        public init(
            ink: Color = Style.adaptive(light: 0x141414, dark: 0xF4F3EF),
            muted: Color = Style.adaptive(light: 0xC4C1BA, dark: 0x4A4946),
            accent: Color = Color(red: 1, green: 0, blue: 0)
        ) {
            self.ink = ink
            self.muted = muted
            self.accent = accent
        }

        public static let standard = Style()

        /// A color that follows the appearance, from two 0xRRGGBB values.
        public static func adaptive(light: UInt32, dark: UInt32) -> Color {
            Color(UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @Binding private var lower: Double
    @Binding private var upper: Double
    @State private var mode: DragMode?
    @State private var originLower: Double = 0
    @State private var originUpper: Double = 1
    @State private var ticks = 0
    @State private var lastBucket = -1
    @State private var buds = PieceBuds()

    private let samples: [Double]
    private let haptics: Bool
    private let style: Style
    private let minSpan = 0.08

    private enum DragMode { case move, leading, trailing }

    public init(
        samples: [Double],
        lower: Binding<Double>,
        upper: Binding<Double>,
        haptics: Bool = true,
        style: Style = .standard
    ) {
        self.samples = samples
        self._lower = lower
        self._upper = upper
        self.haptics = haptics
        self.style = style
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(caption)
                .font(.caption.weight(.semibold))
                .foregroundStyle(style.ink)
                .accessibilityHidden(true)
            chart
                .frame(height: 148)
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: ticks)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Range")
        .accessibilityValue(caption)
        .accessibilityAdjustableAction { direction in
            let step = direction == .increment ? 0.04 : -0.04
            shift(by: step)
        }
    }

    private var caption: String {
        let average = windowAverage
        let percent = Int((average * 100).rounded())
        return "\(percent) average · \(Int((lower * 100).rounded())) to \(Int((upper * 100).rounded()))"
    }

    private var windowAverage: Double {
        guard samples.count > 1 else { return 0 }
        let start = min(max(Int(lower * Double(samples.count - 1)), 0), samples.count - 1)
        let end = min(max(Int(upper * Double(samples.count - 1)), start), samples.count - 1)
        let slice = samples[start...end]
        return slice.reduce(0, +) / Double(slice.count)
    }

    private var chart: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width, 1)
            let height = proxy.size.height
            let x0 = CGFloat(lower) * width
            let x1 = CGFloat(upper) * width
            ZStack(alignment: .topLeading) {
                bars(width: width, height: height)
                PieceLiquidGroup {
                    ZStack(alignment: .top) {
                        Color.clear
                            .frame(width: max(x1 - x0, 28), height: height - 8)
                            .pieceLiquid(RoundedRectangle(cornerRadius: 18, style: .continuous), tint: style.accent.opacity(0.18), interactive: true)
                        if buds.contains("read") {
                            readout
                        }
                    }
                    .offset(x: x0)
                }
            }
            .contentShape(Rectangle())
            .gesture(drag(width: width))
        }
    }

    private func bars(width: CGFloat, height: CGFloat) -> some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
                let t = Double(index) / Double(max(samples.count - 1, 1))
                let inside = t >= lower && t <= upper
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(inside ? style.ink : style.muted)
                    .frame(height: max(6, CGFloat(min(max(sample, 0), 1)) * (height - 16)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, 4)
        .accessibilityHidden(true)
    }

    private var readout: some View {
        let out = buds.isOut("read")
        return PieceMorphText(text: "\(Int((windowAverage * 100).rounded()))", font: .caption.weight(.semibold))
            .foregroundStyle(RangeLens.adaptive(light: 0x141414, dark: 0xF4F3EF))
            .pieceBudContent(out: out)
            .frame(minWidth: 44)
            .padding(.horizontal, 8)
            .frame(height: 26)
            .pieceLiquid(.capsule, interactive: false)
            .pieceBud(out: out, rest: CGSize(width: 0, height: -18), home: CGSize(width: 0, height: 20))
            .frame(maxWidth: .infinity)
            .allowsHitTesting(false)
    }

    private func drag(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if mode == nil {
                    originLower = lower
                    originUpper = upper
                    mode = hit(value.startLocation.x, width: width)
                    if mode != nil { Task { @MainActor in await buds.bloom(["read"], reduceMotion: reduceMotion) } }
                }
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let delta = Double(sign * value.translation.width / width)
                apply(delta)
                noteBucket()
            }
            .onEnded { value in
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let velocity = Double(sign * value.velocity.width / width)
                let fromLower = lower
                let fromUpper = upper
                mode = nil
                var targetLower = Double(PieceMotion.project(CGFloat(fromLower), velocity: CGFloat(velocity)))
                var targetUpper = Double(PieceMotion.project(CGFloat(fromUpper), velocity: CGFloat(velocity)))
                // The lens keeps its width on a move. A resize coasts only the edge that was held.
                if abs(fromUpper - fromLower - (originUpper - originLower)) < 0.001 {
                    let span = fromUpper - fromLower
                    targetLower = min(max(targetLower, 0), 1 - span)
                    targetUpper = targetLower + span
                } else {
                    targetLower = min(max(targetLower, 0), fromUpper - minSpan)
                    targetUpper = min(max(targetUpper, fromLower + minSpan), 1)
                }
                let nextLower = min(targetLower, targetUpper - minSpan)
                let nextUpper = max(targetUpper, nextLower + minSpan)
                withAnimation(motion.settle(velocity: CGFloat(velocity), from: CGFloat(fromLower), to: CGFloat(nextLower))) {
                    lower = nextLower
                }
                withAnimation(motion.follow(rank: 1)) {
                    upper = nextUpper
                }
                Task { @MainActor in await buds.gather(["read"], reduceMotion: reduceMotion) }
            }
    }

    private func hit(_ x: CGFloat, width: CGFloat) -> DragMode {
        let edge: CGFloat = 28
        let leading = CGFloat(lower) * width
        let trailing = CGFloat(upper) * width
        if abs(x - leading) < edge { return layoutDirection == .rightToLeft ? .trailing : .leading }
        if abs(x - trailing) < edge { return layoutDirection == .rightToLeft ? .leading : .trailing }
        return .move
    }

    private func apply(_ delta: Double) {
        switch mode {
        case .move:
            let span = originUpper - originLower
            var start = originLower + delta
            start = min(max(start, 0), 1 - span)
            lower = start
            upper = start + span
        case .leading:
            lower = min(max(originLower + delta, 0), originUpper - minSpan)
        case .trailing:
            upper = min(max(originUpper + delta, originLower + minSpan), 1)
        case nil:
            break
        }
    }

    private func shift(by step: Double) {
        let span = upper - lower
        var start = lower + step
        start = min(max(start, 0), 1 - span)
        let motion = PieceMotion(reduceMotion: reduceMotion)
        withAnimation(motion.snap) {
            lower = start
            upper = start + span
        }
    }

    private func noteBucket() {
        guard haptics, samples.count > 1 else { return }
        let bucket = Int((lower * Double(samples.count)).rounded()) + Int((upper * Double(samples.count)).rounded()) * 100
        guard bucket != lastBucket else { return }
        if lastBucket >= 0 { ticks += 1 }
        lastBucket = bucket
    }

    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Style.adaptive(light: light, dark: dark)
    }
}

// MARK: - Example

private struct RangeLensExample: View {
    @State private var lower = 0.25
    @State private var upper = 0.7

    var body: some View {
        RangeLens(samples: Self.samples, lower: $lower, upper: $upper)
            .padding(24)
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RangeLens.adaptive(light: 0xF3F2EE, dark: 0x121212))
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(2.4))
                    withAnimation(PieceMotion(reduceMotion: false).snap) {
                        if lower < 0.3 { lower = 0.48; upper = 0.86 } else { lower = 0.12; upper = 0.55 }
                    }
                }
            }
    }

    private static let samples: [Double] = [
        0.2, 0.28, 0.24, 0.36, 0.52, 0.48, 0.7, 0.86, 0.74, 0.6,
        0.55, 0.4, 0.46, 0.63, 0.8, 0.92, 0.77, 0.58, 0.42, 0.3,
        0.34, 0.5, 0.66, 0.6, 0.44,
    ]
}

#Preview("Light") {
    RangeLensExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    RangeLensExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, bud, morphText)

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
