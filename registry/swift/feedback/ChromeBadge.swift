// swiftpieces:
// title: Chrome Badge
// description: A capsule badge in polished liquid metal, drawn by a Metal color shader. Its bevel and gently domed face reflect a studio whose horizon ripples like mercury, a thin-film fringe colours the edge, a glint sweeps across now and then, and a soft bloom lights the ground around it. Chrome, gold, graphite and brand red finishes, with engraved semibold ink.
// category: feedback
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [badge, label, shader, metal, chrome, new, glow]
// shaders: [ChromeBadge.metal]

import SwiftUI

/// A small label in liquid metal, for "New", "Pro" or "Beta". Copy `ChromeBadge.metal` alongside this file; its `chromeBadge` kernel compiles into your app's default Metal library.
///
/// The metal is drawn behind the label, so the badge sizes to its text and scales with Dynamic Type. VoiceOver reads the
/// label alone; the metal is decoration.
///
/// - Parameters:
///   - label: The badge's text.
///   - systemImage: An optional SF Symbol before the text.
///   - finish: The metal and its ink: `.chrome` (default), `.gold`, `.graphite`, or `.signal`, the brand red. Or your own `Finish(tint:ink:iridescence:glowTint:)`.
///   - size: Text size in points; the capsule derives from it and scales with Dynamic Type.
///   - glow: Bloom strength around the badge, 0 for none.
///   - flow: How fast the reflections ripple. 0 holds them still.
///   - sweeps: A glint crosses the badge when it appears and every few seconds after.
public struct ChromeBadge: View {
    /// The metal and the ink on it.
    public struct Finish: Sendable {
        /// Multiplies the reflections: white is chrome.
        public var tint: Color
        /// The label's colour. The engraving under it follows from it.
        public var ink: Color
        /// Thin-film colour on the bevel, 0–1.
        public var iridescence: Float
        /// The bloom's colour.
        public var glowTint: Color

        public init(tint: Color, ink: Color, iridescence: Float = 0.5, glowTint: Color = Color(red: 0.8, green: 0.88, blue: 1)) {
            self.tint = tint
            self.ink = ink
            self.iridescence = iridescence
            self.glowTint = glowTint
        }

        /// Bright chrome with a rainbow edge and `#141414` ink.
        public static let chrome = Finish(tint: .white, ink: Color(red: 0.08, green: 0.08, blue: 0.08), iridescence: 0.6)
        /// Warm polished gold with dark brown ink.
        public static let gold = Finish(tint: Color(red: 1, green: 0.8, blue: 0.46), ink: Color(red: 0.17, green: 0.11, blue: 0.02), iridescence: 0.22, glowTint: Color(red: 1, green: 0.84, blue: 0.6))
        /// Dark gunmetal with light ink, for light grounds and quiet places.
        public static let graphite = Finish(tint: Color(red: 0.36, green: 0.37, blue: 0.4), ink: Color(red: 0.96, green: 0.95, blue: 0.94), iridescence: 0.35, glowTint: Color(red: 0.7, green: 0.76, blue: 0.86))
        /// Anodised brand red, `#FF0000` under the reflections, with `#141414` ink.
        public static let signal = Finish(tint: Color(red: 1, green: 0.2, blue: 0.16), ink: Color(red: 0.08, green: 0.08, blue: 0.08), iridescence: 0.18, glowTint: Color(red: 1, green: 0.45, blue: 0.4))
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric private var size: CGFloat = 15
    @State private var clock = BadgeClock()

    private let label: String
    private let systemImage: String?
    private let finish: Finish
    private let glow: CGFloat
    private let flow: Double
    private let sweeps: Bool

    public init(_ label: String, systemImage: String? = nil, finish: Finish = .chrome, size: CGFloat = 15, glow: CGFloat = 1, flow: Double = 1, sweeps: Bool = true) {
        self.label = label
        self.systemImage = systemImage
        self.finish = finish
        self.glow = max(glow, 0)
        self.flow = flow
        self.sweeps = sweeps
        _size = ScaledMetric(wrappedValue: size, relativeTo: .subheadline)
    }

    public var body: some View {
        let moving = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
        // The bloom needs room outside the capsule.
        let pad = size * 1.2
        HStack(spacing: size * 0.3) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(label)
        }
        .font(.system(size: size))
        .fontWeight(.semibold)
        .foregroundStyle(finish.ink)
        // Engraved: a hairline of light under dark ink, of shade under light ink.
        .shadow(color: engrave, radius: 0, y: 0.75)
        .lineLimit(1)
        .padding(.horizontal, size * 0.72)
        .frame(minHeight: size * 1.85)
        .background {
            BadgeSurface(clock: clock, finish: finish, pad: pad, glow: glow, flow: flow, sweeps: sweeps && moving, moving: moving)
                .padding(-pad)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }

    private var engrave: Color {
        let ink = finish.ink.resolve(in: EnvironmentValues())
        let light = 0.2126 * ink.red + 0.7152 * ink.green + 0.0722 * ink.blue > 0.5
        return light ? .black.opacity(0.35) : .white.opacity(0.55)
    }
}

/// The shader layer, with its own timeline so a still badge draws once and stops.
private struct BadgeSurface: View {
    let clock: BadgeClock
    let finish: ChromeBadge.Finish
    let pad: CGFloat
    let glow: CGFloat
    let flow: Double
    let sweeps: Bool
    let moving: Bool

    var body: some View {
        // At most 30 fps: the ripple and the glint are slow, and a badge often sits in a list beside other motion.
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !(moving && (flow != 0 || sweeps)))) { context in
            let frame = clock.advance(to: context.date, flow: moving ? flow : 0, sweeps: sweeps)
            let pad = pad, tint = finish.tint, glowTint = finish.glowTint
            let iridescence = finish.iridescence, glow = Float(glow), flowing: Float = moving && flow != 0 ? 1 : 0
            Rectangle()
                .visualEffect { content, proxy in
                    content.colorEffect(
                        ShaderLibrary.chromeBadge(
                            .float2(proxy.size),
                            .float(pad),
                            .float(frame.time),
                            .float(flowing),
                            .float(frame.glint),
                            .color(tint),
                            .float(iridescence),
                            .float(glow),
                            .color(glowTint)
                        )
                    )
                }
        }
    }
}

/// Per-frame state: the ripple's phase and the glint's place. Not observed, so a frame never invalidates the view.
@MainActor private final class BadgeClock {
    /// ChromeBadge.metal's rates on the time (1.1, 1.6 and 0.8 for the ripple, 0.05 for the film) all repeat after 40π,
    /// so the phase wraps there without a seam and stays small for Float. Update it if those rates change.
    private static let period = 40 * Double.pi
    /// A sweep crosses in 1.1 s, then the glint rests off the badge until the next, 5 s after the last began.
    private static let sweep = 1.1, cycle = 5.0
    private var phase = 0.0
    private var elapsed = 0.0
    private var last: Date?

    nonisolated init() {}

    func advance(to date: Date, flow: Double, sweeps: Bool) -> (time: Float, glint: Float) {
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        phase = (phase + flow * dt).truncatingRemainder(dividingBy: Self.period)
        guard sweeps else { return (Float(phase), 9) }
        // The first sweep starts a beat after the badge appears.
        elapsed += dt
        let t = (elapsed - 0.35).truncatingRemainder(dividingBy: Self.cycle)
        guard elapsed > 0.35, t < Self.sweep else { return (Float(phase), 9) }
        // Eased in and out across the badge, from off the left to off the right.
        let x = t / Self.sweep
        let eased = x * x * (3 - 2 * x)
        return (Float(phase), Float(-1.6 + 3.2 * eased))
    }
}

// MARK: - Example

/// The four finishes beside a setting they might mark, on the dark ground the metal reads best on.
private struct ChromeBadgeExample: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            row("Live mode", ChromeBadge("New"))
            row("Agents", ChromeBadge("Pro", systemImage: "sparkles", finish: .gold))
            row("Voice", ChromeBadge("Beta", finish: .graphite))
            row("Drops", ChromeBadge("Hot", finish: .signal))
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
        .fontWeight(.semibold)
    }

    private func row(_ title: String, _ badge: ChromeBadge) -> some View {
        HStack(spacing: 14) {
            Text(title)
                .font(.system(size: 28))
                .foregroundStyle(.white.opacity(0.82))
            badge
        }
    }
}

#Preview("Dark") {
    ChromeBadgeExample().preferredColorScheme(.dark)
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
