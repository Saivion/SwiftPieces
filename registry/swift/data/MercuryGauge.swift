// swiftpieces:
// title: Mercury Gauge
// description: A level gauge filled with liquid metal, drawn by a Metal color shader inside a liquid glass tube. When the value changes the mercury runs to it with its front leaning into the run, lands without overshooting the true value, and rings for a moment; at zero it gathers into a single drop. For storage, battery, goals and uploads, with a title and a rolling percentage.
// category: data
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [gauge, progress, meter, level, shader, metal, mercury, liquid, glass]
// shaders: [MercuryGauge.metal]

import SwiftUI

/// A gauge of liquid metal in a glass tube. Copy `MercuryGauge.metal` alongside this file; its `mercuryGauge` kernel compiles into your app's default Metal library.
///
/// The level itself never overshoots, so the gauge never shows a value that isn't true; only the shape of the
/// mercury's front leans and rings. VoiceOver reads the title and the percentage.
///
/// - Parameters:
///   - title: What the gauge measures, shown above the tube.
///   - value: The current value.
///   - range: The values the tube spans, `0...1` by default. Values outside it pin to the ends.
///   - valueText: The readout beside the title. `nil` shows the percentage of the range, rolling as it changes.
///   - tint: The metal's colour: a cool silver by default.
public struct MercuryGauge: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric private var height: CGFloat = 26
    @State private var flow = GaugeFlow()
    /// When the value last changed. The timeline runs from then until the mercury has settled.
    @State private var changedAt: Date?

    private let title: String
    private let value: Double
    private let range: ClosedRange<Double>
    private let valueText: String?
    private let tint: Color

    public init(_ title: String, value: Double, in range: ClosedRange<Double> = 0...1, valueText: String? = nil, tint: Color = Color(red: 0.94, green: 0.96, blue: 1)) {
        self.title = title
        self.value = value
        self.range = range
        self.valueText = valueText
        self.tint = tint
    }

    private var fraction: Double {
        let span = range.upperBound - range.lowerBound
        guard span > 0 else { return 0 }
        return min(max((value - range.lowerBound) / span, 0), 1)
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let percent = Int((fraction * 100).rounded())
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                Spacer(minLength: 12)
                Text(valueText ?? "\(percent)%")
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(percent)))
                    .animation(motion.value, value: percent)
                    .foregroundStyle(.secondary)
            }
            .fontWeight(.semibold)
            tube
        }
        .fontWeight(.semibold)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(valueText ?? "\(percent) percent")
        .onChange(of: fraction) { changedAt = .now }
        .task(id: changedAt) {
            guard let change = changedAt else { return }
            // The level settles in well under a second; the ring dies away a little after.
            do { try await Task.sleep(for: .seconds(1.8)) } catch { return }
            if changedAt == change { changedAt = nil }
        }
    }

    private var tube: some View {
        let inset = height * 0.16, radius = height * 0.5 - height * 0.16
        let target = fraction, still = reduceMotion, tint = tint
        return Capsule()
            .fill(.clear)
            .frame(height: height)
            .pieceLiquid(Capsule(), interactive: false)
            .overlay {
                // Runs while the mercury moves; a settled gauge draws once.
                TimelineView(.animation(minimumInterval: 1.0 / 60, paused: changedAt == nil)) { context in
                    let frame = flow.advance(to: context.date, target: target, still: still)
                    Rectangle()
                        .visualEffect { content, proxy in
                            content.colorEffect(
                                ShaderLibrary.mercuryGauge(
                                    .float2(proxy.size),
                                    .float(inset),
                                    .float(frame.level),
                                    .float(radius),
                                    .float(frame.lean),
                                    .float(frame.wobble),
                                    .float(frame.time),
                                    .color(tint)
                                )
                            )
                        }
                }
                .allowsHitTesting(false)
            }
    }
}

/// The level and the shape of its front, stepped at 240 Hz so the spring stays stable at any frame rate. Not observed,
/// so a frame never invalidates the view.
@MainActor private final class GaugeFlow {
    private var level: Double?
    private var velocity = 0.0
    private var lean = 0.0
    private var wobble = 0.0
    private var ring = 0.0
    private var last: Date?

    nonisolated init() {}

    func advance(to date: Date, target: Double, still: Bool) -> (level: Float, lean: Float, wobble: Float, time: Float) {
        // The first frame shows the value as it is: a gauge appearing on screen doesn't pour.
        guard var x = level else {
            level = target
            last = date
            return (Float(target), 0, 0, 0)
        }
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        var left = dt
        while left > 0 {
            let h = min(left, 1.0 / 240)
            left -= h
            let before = velocity
            if still {
                // Reduce Motion: a short, firm glide with no lean and no ring.
                velocity = (target - x) * 14
            } else {
                // Critically damped, so the level arrives without passing the true value.
                velocity += (-(x - target) * 196 - velocity * 28) * h
            }
            x += velocity * h
            // The front leans into the run and drags back as it brakes.
            lean += ((still ? 0 : min(max(velocity * 0.9, -0.35), 0.6)) - lean) * (1 - exp(-h / 0.05))
            // Braking hard rings the front.
            let impact = still ? 0 : min(abs(velocity - before) / h / 40, 1)
            if impact > wobble { wobble = impact; ring = 0 }
            wobble *= exp(-h / 0.35)
            ring += h
        }
        level = x
        return (Float(x), Float(lean), Float(wobble), Float(ring.truncatingRemainder(dividingBy: 2 * .pi)))
    }
}

// MARK: - Example

/// Storage, battery and a goal, stepping to new values so the mercury runs, leans and rings.
private struct MercuryGaugeExample: View {
    @State private var storage = 0.72
    @State private var battery = 0.34
    @State private var steps = 6_400.0

    var body: some View {
        VStack(spacing: 30) {
            MercuryGauge("Storage", value: storage)
            MercuryGauge("Battery", value: battery)
            MercuryGauge("Steps", value: steps, in: 0...10_000, valueText: "\(Int(steps).formatted()) of 10,000")
            Button("Shuffle") {
                storage = .random(in: 0.05...0.98)
                battery = .random(in: 0...1)
                steps = .random(in: 0...10_000).rounded()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 1, green: 0, blue: 0))
        }
        .font(.system(size: 17))
        .foregroundStyle(.white)
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
        .fontWeight(.semibold)
    }
}

#Preview("Dark") {
    MercuryGaugeExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid)

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
