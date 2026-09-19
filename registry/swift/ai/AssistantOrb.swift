// swiftpieces:
// title: Assistant Orb
// description: A dark glass ball with a Siri-style voice wave inside, locked to the thinking state; four thin sine membranes travel through the equator of a refracting shell, drawn by a Metal color shader. The sphere never moves, only the wave, and a palette change crossfades its colours.
// category: ai
// minIOSVersion: "17.0"
// tags: [ai, orb, shader, metal, thinking]
// shaders: [AssistantOrb.metal]

import SwiftUI

/// The assistant's mark while it thinks. Copy `AssistantOrb.metal` alongside this file; its `assistantOrbSiriWave` kernel compiles into your app's default Metal library.
///
/// - Parameters:
///   - size: Diameter of the ball in points. 160 by default; the view is always a square of this side.
///   - palette: The eight colours of the wave, ground, crest and rim. `.siri` by default; build your own with `Palette(bands:ground:crest:rimCool:rimWarm:)` from hex or `Color`. A change crossfades over 0.8s.
public struct AssistantOrb: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let size: CGFloat
    private let palette: Palette

    public init(size: CGFloat = 160, palette: Palette = .siri) {
        self.size = size
        self.palette = palette
    }

    public var body: some View {
        WaveSurface(palette: palette)
            .frame(width: size, height: size)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.8), value: palette)
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
    private struct WaveColors: VectorArithmetic {
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

    /// The shader surface. The clock is relative to first appearance because
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
            TimelineView(.animation(paused: reduceMotion)) { context in
                let t = Float(context.date.timeIntervalSince(start))
                Circle()
                    .fill(.black)
                    .colorEffect(ShaderLibrary.assistantOrbSiriWave(
                        .boundingRect, .float(t),
                        c.argument(0), c.argument(1), c.argument(2), c.argument(3),
                        c.argument(4), c.argument(5), c.argument(6), c.argument(7)
                    ))
            }
            .aspectRatio(1, contentMode: .fit)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        AssistantOrb(size: 180, palette: .siri)
        Text("Thinking")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(.black)
}
