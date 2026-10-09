// swiftpieces:
// title: Assistant Orb
// description: A dark glass ball with a Siri-style voice wave inside, locked to the thinking state; four thin sine membranes travel through the equator of a refracting shell, drawn by a Metal color shader. The sphere never moves, only the wave, and a palette change crossfades its colours.
// category: ai
// minIOSVersion: "17.0"
// version: "1.2.0"
// tags: [ai, orb, shader, metal, thinking]
// shaders: [AssistantOrb.metal]

import SwiftUI

/// The assistant's mark while it thinks. Copy `AssistantOrb.metal` alongside this file; its `assistantOrbSiriWave` kernel compiles into your app's default Metal library.
///
/// - Parameters:
///   - size: Diameter of the ball in points. 160 by default; the view is always a square of this side.
///   - palette: The eight colours of the wave, ground, crest and rim. `.siri` by default; build your own with `Palette(bands:ground:crest:rimCool:rimWarm:)` from hex or `Color`. A change crossfades on a calm spring.
public struct AssistantOrb: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let size: CGFloat
    private let palette: Palette

    public init(size: CGFloat = 160, palette: Palette = .siri) {
        self.size = size
        self.palette = palette
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        WaveSurface(palette: palette)
            .frame(width: size, height: size)
            // A spring, so a palette changed again mid-fade turns from the colours on screen. Under Reduce Motion it
            // is a short colour fade, never a cut: colour is not movement.
            .animation(motion.ambient, value: palette)
            .allowsHitTesting(false)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Assistant")
            .accessibilityValue("Thinking")
            .accessibilityAddTraits(.updatesFrequently)
    }

    /// The orb's eight colours: four bands left to right in the stack, the ground wash inside the
    /// glass, the crest and specular, and the cool and warm halves of the rim.
    public struct Palette: Hashable, Sendable {
        /// sRGB components 0…1, in kernel order: band0…3, ground, crest, rimCool, rimWarm.
        public var rgb: [SIMD3<Float>]

        public init(bands: [Color], ground: Color, crest: Color = .white, rimCool: Color, rimWarm: Color) {
            let four = (0..<4).map { bands.isEmpty ? crest : bands[min($0, bands.count - 1)] }
            rgb = (four + [ground, crest, rimCool, rimWarm]).map(Self.components)
        }

        /// Hex form, `0x2b5cff`.
        public init(bands: [UInt32], ground: UInt32, crest: UInt32 = 0xffffff, rimCool: UInt32, rimWarm: UInt32) {
            let four = (0..<4).map { bands.isEmpty ? crest : bands[min($0, bands.count - 1)] }
            rgb = (four + [ground, crest, rimCool, rimWarm]).map(Self.components)
        }

        /// The Siri Wave colours: electric blue, hot pink, orange and red over deep violet.
        public static let siri = Palette(bands: [0x2b5cff, 0xff4fa3, 0xff6a2b, 0xe3170a], ground: 0x12082e, rimCool: 0x4d8aff, rimWarm: 0xff4a1a)

        private static func components(_ hex: UInt32) -> SIMD3<Float> {
            SIMD3(Float((hex >> 16) & 0xff), Float((hex >> 8) & 0xff), Float(hex & 0xff)) / 255
        }

        private static func components(_ color: Color) -> SIMD3<Float> {
            let r = color.resolve(in: EnvironmentValues())
            return SIMD3(r.red, r.green, r.blue)
        }
    }

    /// The 24 colour components as one animatable vector, so a palette change crossfades.
    nonisolated private struct WaveColors: VectorArithmetic {
        var v: [Double]

        static var zero: Self { Self(v: Array(repeating: 0, count: 24)) }
        init(v: [Double]) { self.v = v }
        init(_ palette: Palette) { v = palette.rgb.flatMap { [Double($0.x), Double($0.y), Double($0.z)] } }

        static func + (a: Self, b: Self) -> Self { Self(v: zip(a.v, b.v).map(+)) }
        static func - (a: Self, b: Self) -> Self { Self(v: zip(a.v, b.v).map(-)) }
        mutating func scale(by rhs: Double) { v = v.map { $0 * rhs } }
        var magnitudeSquared: Double { v.reduce(0) { $0 + $1 * $1 } }

        func argument(_ i: Int) -> Shader.Argument {
            .float3(Float(v[i * 3]), Float(v[i * 3 + 1]), Float(v[i * 3 + 2]))
        }
    }

    /// The shader surface. The clock is relative to appearance because
    /// `timeIntervalSinceReferenceDate` overflows `Float` precision and freezes the kernel.
    /// Only the wave moves: no scale, offset or pulse is ever applied to the sphere.
    private struct WaveSurface: View, Animatable {
        var colors: WaveColors

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var start = Date()

        init(palette: Palette) { colors = WaveColors(palette) }

        nonisolated var animatableData: WaveColors {
            get { colors }
            set { colors = newValue }
        }

        var body: some View {
            let c = colors
            let flows = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
            TimelineView(.animation(paused: !flows)) { context in
                // Under Reduce Motion the wave rests on the pose it starts from: a fixed frame, so a palette fade
                // recolours it without moving it.
                let t = flows ? Float(context.date.timeIntervalSince(start)) : 0
                Circle()
                    .fill(.black)
                    .colorEffect(ShaderLibrary.assistantOrbSiriWave(
                        .boundingRect, .float(t),
                        c.argument(0), c.argument(1), c.argument(2), c.argument(3),
                        c.argument(4), c.argument(5), c.argument(6), c.argument(7)
                    ))
            }
            .aspectRatio(1, contentMode: .fit)
            // The wave starts from its rest pose each time the orb appears, and turning Reduce Motion off flows on
            // from that same pose, so it never jumps.
            .onAppear { start = .now }
            .onChange(of: reduceMotion) { start = .now }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        AssistantOrb(size: 180, palette: .siri)
        Text("Thinking")
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }
    // One weight for every string, as in the rest of the library.
    .fontWeight(.semibold)
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(.black)
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
