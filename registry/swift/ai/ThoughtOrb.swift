// swiftpieces:
// title: Thought Orb
// description: "A small dark glass ball with a Siri-style voice wave inside, locked to the thinking state and drawn by a Metal color shader; palettes for searching, reading and writing crossfade the colour with the kind of work. Its Pill is the status control in liquid glass: the mark rides a round glass bubble joined by a liquid neck to a capsule whose label morphs letter by letter into each new verb while the capsule reshapes around it, with indeterminate dots at its end."
// category: ai
// minIOSVersion: "17.0"
// version: "1.2.0"
// tags: [ai, orb, shader, metal, thinking, status]
// shaders: [ThoughtOrb.metal]

import SwiftUI

/// The mark next to the verb an agent is doing. Copy `ThoughtOrb.metal` alongside this file; its `thoughtOrbSiriWave` kernel compiles into your app's default Metal library.
///
/// - Parameters:
///   - size: Diameter of the ball in points. 18–30 inside a pill, 64 at avatar size.
///   - palette: The kind of work the colour portrays: `.siri` (thinking, default), `.searching`, `.reading` or `.writing`, or your own `Palette(bands:ground:crest:rimCool:rimWarm:)`. A change crossfades calmly, and a quick run of changes glides from colour to colour; the motion never changes.
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
            // A spring, so steps that change faster than the fade retarget from the colour on screen instead of
            // stacking. Colour is not motion, so Reduce Motion keeps a short fade rather than a cut.
            .animation(PieceMotion(reduceMotion: reduceMotion).ambient, value: palette)
            // Only the colour takes that spring. Where the mark sits follows its container, so in a pill it rides
            // the capsule's beat instead of drifting off its seat while the capsule resizes.
            .geometryGroup()
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
        /// Searching: electric blue, aqua and mint with a violet rim, a cool scan through sources.
        public static let searching = Palette(bands: [0x2b5cff, 0x22d3ee, 0x34d399, 0x7c3aed], ground: 0x06122a, rimCool: 0x67e8f9, rimWarm: 0xa78bfa)
        /// Reading: indigo, lavender and a teal glint over deep violet, quiet and inward.
        public static let reading = Palette(bands: [0x4c1dff, 0xa855f7, 0x14b8a6, 0x818cf8], ground: 0x0b0724, rimCool: 0xc7d2fe, rimWarm: 0x99f6e4)
        /// Writing: red, amber, rose and violet, warm and productive.
        public static let writing = Palette(bands: [0xe3170a, 0xffb020, 0xff4f8a, 0x8b5cf6], ground: 0x1c0907, rimCool: 0xffcf7a, rimWarm: 0xff5a3c)

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

        /// Colour `i`, times `gain` to dim it.
        func argument(_ i: Int, gain: Float = 1) -> Shader.Argument {
            .float3(Float(v[i * 3]) * gain, Float(v[i * 3 + 1]) * gain, Float(v[i * 3 + 2]) * gain)
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
            let c = colors, start = start
            let flowing = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
            // Under Reduce Motion the wave rests on the pose it starts from, the membranes mirrored about the
            // equator, and only the bands' light breathes, which needs far fewer frames. A fixed pose, so a new label
            // or colour never jumps the still frame. Same rule as AssistantOrb.
            TimelineView(.animation(minimumInterval: flowing ? nil : 1.0 / 30)) { context in
                let t = context.date.timeIntervalSince(start)
                let gain = flowing ? 1 : Self.breath(t)
                Circle()
                    .fill(.black)
                    .colorEffect(ShaderLibrary.thoughtOrbSiriWave(
                        .boundingRect, .float(flowing ? Float(t) : 0),
                        c.argument(0, gain: gain), c.argument(1, gain: gain), c.argument(2, gain: gain), c.argument(3, gain: gain),
                        c.argument(4), c.argument(5), c.argument(6), c.argument(7)
                    ))
            }
            .aspectRatio(1, contentMode: .fit)
            // The wave starts from its rest pose each time the mark appears, and the breath from full. Turning Reduce
            // Motion off lets the wave flow on from that pose rather than jump ahead.
            .onAppear { self.start = .now }
            .onChange(of: reduceMotion) { self.start = .now }
        }

        /// The bands' brightness `t` seconds into a Reduce Motion breath: down by a quarter and back over 2.4s,
        /// eased at both ends, then 0.8s resting at full. The ground, crest and rim stay lit.
        static func breath(_ t: TimeInterval) -> Float {
            let breath = 2.4, rest = 0.8, depth = 0.25
            let phase = max(t, 0).truncatingRemainder(dividingBy: breath + rest)
            guard phase < breath else { return 1 }
            return Float(1 - depth * (1 - cos(2 * .pi * phase / breath)) / 2)
        }
    }

    /// The status control in liquid glass: the mark on a round glass bubble, joined by a liquid neck to a capsule with
    /// the label and four pulsing dots. Pass `action` for a button, leave it out for a status element.
    ///
    /// - Parameters:
    ///   - label: The text beside the mark. "Thinking" by default; change it as the agent's step changes and it morphs letter by letter, the mark stays the same.
    ///   - palette: Colours of the mark. Pass the one that matches the label's kind of work; a change crossfades.
    ///   - markSize: Diameter of the mark. Type, the glass around it and the dots derive from it and scale with Dynamic Type.
    ///   - showsDots: Trailing dots that say the wait is indeterminate.
    ///   - tint: Color of the label and dots.
    ///   - action: Optional tap handler.
    public struct Pill: View {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                    // A shallow, centered press: the pill often sits in toolbars and scrolling content. The glass sinks
                    // with what it carries.
                    .buttonStyle(PieceLiquidPressStyle(depth: 1.5))
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
        /// The height of both glass shapes: the mark with a fifth of its size of glass around it.
        private var height: CGFloat { mark * 1.4 }

        private var pill: some View {
            PieceLiquidGroup {
                // Two parts of one control, so they rest joined: the neck between the bubble and the capsule holds.
                HStack(spacing: PieceLiquid.joined) {
                    // The mark sits in its own round bubble, so the shader ball is never glass on glass.
                    ThoughtOrb(size: mark, palette: palette)
                        .frame(width: height, height: height)
                        .pieceLiquid(.circle, interactive: false)
                    HStack(spacing: 0) {
                        // Letters both verbs share hold still while the rest blur through; under Reduce Motion the
                        // words crossfade. Grouped, so the letters ride the capsule's beat instead of jumping to
                        // their new places.
                        PieceMorphText(text: label, font: .system(size: font, weight: .semibold))
                            .foregroundStyle(tint.opacity(0.85))
                            .geometryGroup()
                        if showsDots {
                            // The dots only change opacity, so they keep cycling under Reduce Motion: a still pill
                            // would read as stalled.
                            TimelineView(.animation) { timeline in
                                let t = timeline.date.timeIntervalSince(start)
                                HStack(spacing: font * 0.12) {
                                    ForEach(0..<4, id: \.self) { i in
                                        Circle()
                                            .fill(tint)
                                            .frame(width: font * 0.16, height: font * 0.16)
                                            .opacity(Self.dotOpacity(t, i))
                                    }
                                }
                            }
                            // Room for the capsule's give: as a label shrinks, the dots run past their place toward it
                            // by about 1.5% of the width it lost, and this gap holds that for a label up to about 260pt
                            // shorter at the default size, so they never land on its last letter.
                            .padding(.leading, font * 0.3)
                            .onAppear { start = .now }
                            .accessibilityHidden(true)
                        }
                    }
                    .padding(.leading, mark * 0.5)
                    .padding(.trailing, mark * 0.55)
                    .frame(height: height)
                    .pieceLiquid(Capsule(), interactive: false)
                }
            }
            .fontWeight(.semibold)
            // A new verb reshapes the capsule in one beat: the letters, the capsule's width and the dots riding its
            // end, with `morph`'s little give at the end, held by the gap before the dots. 0.3s rather than `morph`'s
            // 0.4s: the pill sits in dense toolbars, so a label change lands quickly and ahead of the mark's slower
            // colour fade.
            .animation(reduceMotion ? PieceMotion(reduceMotion: true).morph : .spring(duration: 0.3, bounce: 0.2), value: label)
        }

        /// One dot's opacity: an eased rise and fall over the first 60% of the cycle, then a rest.
        /// Computed from the clock rather than a repeating animation so all four stay in phase however long the pill is
        /// on screen. The clock starts as the dots appear, so each dot starts from rest and the first one leads.
        private static func dotOpacity(_ t: Double, _ i: Int) -> Double {
            var p = ((t - Double(i) * 0.12) / 1.6).truncatingRemainder(dividingBy: 1)
            if p < 0 { p += 1 }
            guard p < 0.6 else { return 0.28 }
            let wave = sin(p / 0.6 * .pi)
            return 0.28 + 0.72 * wave * wave
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

/// One pill moving through an agent's steps: the capsule reshapes around each verb as the mark's colour follows.
private struct ThoughtOrbSteps: View {
    private static let steps: [(String, ThoughtOrb.Palette)] = [
        ("Thinking", .siri), ("Searching the web", .searching), ("Reading", .reading), ("Drafting a reply", .writing),
    ]
    @State private var index = 0

    var body: some View {
        ThoughtOrb.Pill(Self.steps[index].0, palette: Self.steps[index].1)
            .task {
                while true {
                    do { try await Task.sleep(for: .seconds(1.8)) } catch { return }
                    index = (index + 1) % Self.steps.count
                }
            }
    }
}

#Preview("Steps") {
    ThoughtOrbSteps().padding(32)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath)

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
