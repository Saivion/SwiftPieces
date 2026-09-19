// swiftpieces:
// title: Thought Orb
// description: A small dark glass ball with a Siri-style voice wave inside, locked to the thinking state and drawn by a Metal color shader; palettes for searching, reading and writing crossfade the colour with the kind of work, and a Pill wraps it with a label and indeterminate dots into the status control.
// category: ai
// minIOSVersion: "17.0"
// tags: [ai, orb, shader, metal, thinking, status]
// shaders: [ThoughtOrb.metal]

import SwiftUI

/// The mark next to the verb an agent is doing. Copy `ThoughtOrb.metal` alongside this file; its `thoughtOrbSiriWave` kernel compiles into your app's default Metal library.
///
/// - Parameters:
///   - size: Diameter of the ball in points. 18–30 inside a pill, 64 at avatar size.
///   - palette: The kind of work the colour portrays: `.siri` (thinking, default), `.searching`, `.reading` or `.writing`, or your own `Palette(bands:ground:crest:rimCool:rimWarm:)`. A change crossfades over 0.8s; the motion never changes.
public struct ThoughtOrb: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let size: CGFloat
    private let palette: Palette

    public init(size: CGFloat = 24, palette: Palette = .siri) {
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
        /// Searching: cyan into deep teal, a cool scan through sources.
        public static let searching = Palette(bands: [0x5ee7ff, 0x22c3e6, 0x1492b8, 0x0b5f86], ground: 0x04161f, rimCool: 0x9af0ff, rimWarm: 0x3fd6b4)
        /// Reading: lavender into deep indigo, quiet and inward.
        public static let reading = Palette(bands: [0xa99bff, 0x7b6cff, 0x5a3ff0, 0x3a20b8], ground: 0x0d0826, rimCool: 0xc4baff, rimWarm: 0xb07cff)
        /// Writing: amber into coral and brick, warm and productive.
        public static let writing = Palette(bands: [0xffc46b, 0xff9a4a, 0xff6a3d, 0xd9412b], ground: 0x1e0a05, rimCool: 0xffd9a0, rimWarm: 0xff7a3a)

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
                    .colorEffect(ShaderLibrary.thoughtOrbSiriWave(
                        .boundingRect, .float(t),
                        c.argument(0), c.argument(1), c.argument(2), c.argument(3),
                        c.argument(4), c.argument(5), c.argument(6), c.argument(7)
                    ))
            }
            .aspectRatio(1, contentMode: .fit)
        }
    }

    /// The status control: mark, label and four pulsing dots in a material capsule. Pass `action` for a button, leave it out for a status element.
    ///
    /// - Parameters:
    ///   - label: The text beside the mark. "Thinking" by default; change it as the agent's step changes, the mark stays the same.
    ///   - palette: Colours of the mark. Pass the one that matches the label's kind of work; a change crossfades.
    ///   - markSize: Diameter of the mark. Type, padding and dots derive from it and scale with Dynamic Type.
    ///   - showsDots: Trailing dots that say the wait is indeterminate.
    ///   - tint: Color of the label and dots.
    ///   - action: Optional tap handler.
    public struct Pill: View {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
        @Environment(\.displayScale) private var displayScale
        @ScaledMetric private var mark: CGFloat = 28

        private let label: String
        private let palette: Palette
        private let showsDots: Bool
        private let tint: Color
        private let action: (() -> Void)?
        @State private var start = Date()
        @State private var presses = 0

        public init(_ label: String = "Thinking", palette: Palette = .siri, markSize: CGFloat = 28, showsDots: Bool = true, tint: Color = .primary, action: (() -> Void)? = nil) {
            self.label = label
            self.palette = palette
            self.showsDots = showsDots
            self.tint = tint
            self.action = action
            _mark = ScaledMetric(wrappedValue: markSize, relativeTo: .subheadline)
        }

        public var body: some View {
            if let action {
                Button { presses += 1; action() } label: { pill }
                    .buttonStyle(Press())
                    .sensoryFeedback(.impact(flexibility: .soft), trigger: presses)
                    .accessibilityLabel(label)
                    .accessibilityValue("Thinking")
            } else {
                pill
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(label)
                    .accessibilityValue("Thinking")
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }

        private var font: CGFloat { mark * 0.47 }

        private var pill: some View {
            HStack(spacing: mark * 0.34) {
                ThoughtOrb(size: mark, palette: palette)
                HStack(spacing: 0) {
                    Text(label)
                        .font(.system(size: font, weight: .medium))
                        .foregroundStyle(tint.opacity(0.85))
                        .contentTransition(.numericText())
                        .animation(.smooth(duration: 0.3), value: label)
                    if showsDots {
                        TimelineView(.animation(paused: reduceMotion)) { timeline in
                            let t = reduceMotion ? 0.55 : timeline.date.timeIntervalSince(start)
                            HStack(spacing: font * 0.12) {
                                ForEach(0..<4, id: \.self) { i in
                                    Circle()
                                        .fill(tint)
                                        .frame(width: font * 0.16, height: font * 0.16)
                                        .opacity(Self.dotOpacity(t, i))
                                }
                            }
                        }
                        .padding(.leading, font * 0.18)
                        .accessibilityHidden(true)
                    }
                }
            }
            .padding(.vertical, mark * 0.2)
            .padding(.leading, mark * 0.2)
            .padding(.trailing, mark * 0.55)
            .background(reduceTransparency ? AnyShapeStyle(Color(.secondarySystemBackground)) : AnyShapeStyle(.regularMaterial), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(.separator), lineWidth: 1 / displayScale))
        }

        /// One dot's opacity: up over the first 30% of the cycle, down over the next, then held.
        /// Computed from the clock rather than a repeating animation so all four stay in phase however long the pill is on screen.
        private static func dotOpacity(_ t: Double, _ i: Int) -> Double {
            var p = ((t - Double(i) * 0.12) / 1.6).truncatingRemainder(dividingBy: 1)
            if p < 0 { p += 1 }
            if p < 0.3 { return 0.28 + 0.72 * (p / 0.3) }
            if p < 0.6 { return 1 - 0.72 * ((p - 0.3) / 0.3) }
            return 0.28
        }

        private struct Press: ButtonStyle {
            func makeBody(configuration: Configuration) -> some View {
                configuration.label
                    .scaleEffect(configuration.isPressed ? 0.97 : 1)
                    .animation(configuration.isPressed ? .easeOut(duration: 0.1) : .spring(duration: 0.35, bounce: 0.3), value: configuration.isPressed)
            }
        }
    }
}

#Preview {
    VStack(spacing: 24) {
        ThoughtOrb(size: 96)
        ThoughtOrb.Pill()
        ThoughtOrb.Pill("Searching the web", palette: .searching)
        ThoughtOrb.Pill("Reading the thread", palette: .reading, markSize: 20)
        ThoughtOrb.Pill("Drafting a reply", palette: .writing) {}
    }
    .padding(32)
}
