// swiftpieces:
// title: Mercury Text
// description: Text, SF Symbols or any view turned into liquid metal by a Metal layer shader. The shader reads the glyphs' own coverage as height, bevels every edge from it, and reflects a studio whose horizon ripples like mercury across the letters, with a thin-film fringe on the bevels. A finger or pointer slides the reflections. Mercury, holographic, gold and brand red finishes; still and readable under Reduce Motion.
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [text, headline, symbol, shader, metal, chrome, liquid]
// shaders: [MercuryText.metal]

import SwiftUI

/// A headline in liquid metal. For a symbol or any other view, use `.mercury()`. Copy `MercuryText.metal` alongside this file; its `mercuryText` kernel compiles into your app's default Metal library.
///
/// The shader bevels whatever the view draws from its own edges, so heavy, rounded type shows the metal best. The
/// text stays real text: VoiceOver reads it, it wraps and it scales with Dynamic Type.
///
/// - Parameters:
///   - text: The words to draw.
///   - size: Point size; scales with Dynamic Type.
///   - design: The font design. `.rounded` (default) gives the bevels the most to catch.
///   - finish: The metal: `.mercury` (default), `.holographic`, `.gold` or `.signal`, the brand red. Or your own `Finish(tint:iridescence:)`.
///   - bevel: How far in from each edge the bevel reaches, in points. `nil` derives it from the size.
///   - flow: How fast the reflections ripple. 0 holds them still.
///   - followsTouch: A finger or pointer on the text slides the reflections toward it, and they glide home when it lifts.
public struct MercuryText: View {
    /// The metal's colour and its thin-film edge.
    public struct Finish: Sendable {
        /// Multiplies the reflections: white is chrome.
        public var tint: Color
        /// Thin-film colour on the bevels, 0–1.
        public var iridescence: Float

        public init(tint: Color, iridescence: Float = 0.35) {
            self.tint = tint
            self.iridescence = iridescence
        }

        /// Cool liquid silver.
        public static let mercury = Finish(tint: Color(red: 0.93, green: 0.95, blue: 1), iridescence: 0.3)
        /// Chrome with a strong rainbow on every bevel.
        public static let holographic = Finish(tint: .white, iridescence: 0.95)
        /// Warm polished gold.
        public static let gold = Finish(tint: Color(red: 1, green: 0.8, blue: 0.46), iridescence: 0.15)
        /// Anodised brand red.
        public static let signal = Finish(tint: Color(red: 1, green: 0.22, blue: 0.18), iridescence: 0.15)
    }

    @ScaledMetric private var size: CGFloat = 64

    private let text: String
    private let design: Font.Design
    private let finish: Finish
    private let bevel: CGFloat?
    private let flow: Double
    private let followsTouch: Bool

    public init(_ text: String, size: CGFloat = 64, design: Font.Design = .rounded, finish: Finish = .mercury, bevel: CGFloat? = nil, flow: Double = 1, followsTouch: Bool = true) {
        self.text = text
        self.design = design
        self.finish = finish
        self.bevel = bevel
        self.flow = flow
        self.followsTouch = followsTouch
        _size = ScaledMetric(wrappedValue: size, relativeTo: .largeTitle)
    }

    public var body: some View {
        Text(text)
            .font(.system(size: size, design: design))
            .fontWeight(.semibold)
            .multilineTextAlignment(.center)
            .mercury(finish, bevel: bevel ?? max(1.5, size * 0.075), flow: flow, followsTouch: followsTouch)
    }
}

public extension View {
    /// Draws this view in liquid metal. Its colours are replaced: only its coverage counts, so draw it opaque.
    ///
    /// - Parameters:
    ///   - finish: The metal.
    ///   - bevel: How far in from each edge the bevel reaches, in points.
    ///   - flow: How fast the reflections ripple. 0 holds them still.
    ///   - followsTouch: A finger or pointer slides the reflections toward it.
    func mercury(_ finish: MercuryText.Finish = .mercury, bevel: CGFloat = 4, flow: Double = 1, followsTouch: Bool = true) -> some View {
        modifier(MercuryEffect(finish: finish, bevel: max(bevel, 1), flow: flow, followsTouch: followsTouch))
    }
}

/// The layer effect, its clock and the touch that slides the studio.
private struct MercuryEffect: ViewModifier {
    let finish: MercuryText.Finish
    let bevel: CGFloat
    let flow: Double
    let followsTouch: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var clock = MercuryClock()
    @State private var touch: CGPoint?
    /// When the last touch lifted. The clock runs on while the reflections glide home.
    @State private var releasedAt: Date?

    func body(content: Content) -> some View {
        let flowing = PieceMotion(reduceMotion: reduceMotion).allowsAmbient && flow != 0
        let running = flowing || touch != nil || releasedAt != nil
        // At most 60 fps, and only while something moves; a still headline draws once.
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !running)) { context in
            let frame = clock.advance(to: context.date, flow: flowing ? flow : 0, touch: touch)
            let bevel = bevel, tint = finish.tint, iridescence = finish.iridescence
            content
                // Only coverage counts, so the content is drawn opaque white whatever its own style, and blurred by
                // half the bevel: the shader reads the blurred coverage as a smooth height field.
                .foregroundStyle(.white)
                .blur(radius: bevel * 0.5)
                .visualEffect { content, proxy in
                    content.layerEffect(
                        ShaderLibrary.mercuryText(
                            .float2(proxy.size),
                            .float(bevel),
                            .float(frame.time),
                            .float(flowing ? 1 : 0),
                            .float2(frame.point),
                            .float(frame.pull),
                            .color(tint),
                            .float(iridescence)
                        ),
                        maxSampleOffset: CGSize(width: bevel, height: bevel)
                    )
                }
                // The crisp shapes cut the metal back out, with their own antialiased edges.
                .mask { content.foregroundStyle(.white) }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in touch = value.location }
                .onEnded { _ in lift() },
            including: followsTouch ? .all : .subviews
        )
        .onContinuousHover { phase in
            guard followsTouch else { return }
            switch phase {
            case .active(let point): touch = point
            case .ended: lift()
            }
        }
        .task(id: releasedAt) {
            guard let lifted = releasedAt else { return }
            // Five of the glide's 0.35 s time constants: home to the eye.
            do { try await Task.sleep(for: .seconds(1.8)) } catch { return }
            if releasedAt == lifted { releasedAt = nil }
        }
    }

    private func lift() {
        guard touch != nil else { return }
        touch = nil
        releasedAt = .now
    }
}

/// Per-frame state: the ripple's phase and how far the touch has slid the studio. Not observed, so a frame never
/// invalidates the view, and a repeated date advances nothing.
@MainActor private final class MercuryClock {
    /// MercuryText.metal's rates on the time (1.2, 1.8 and 0.9 for the ripple, 0.05 for the film) all repeat after
    /// 40π, so the phase wraps there without a seam and stays small for Float. Update it if those rates change.
    private static let period = 40 * Double.pi
    private var phase = 0.0
    private var rate = 0.0
    private var pull = 0.0
    private var point = CGPoint.zero
    private var last: Date?

    nonisolated init() {}

    func advance(to date: Date, flow: Double, touch: CGPoint?) -> (time: Float, pull: Float, point: CGPoint) {
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        // The ripple eases up to speed from rest when the text appears, and to every new speed.
        rate += (flow - rate) * (1 - exp(-dt / 0.4))
        phase = (phase + rate * dt).truncatingRemainder(dividingBy: Self.period)
        // The studio glides after the finger, never snapping, and glides home when it lifts. The touch is driven by the
        // person, so it still follows under Reduce Motion.
        if let touch {
            let k = pull < 0.01 ? 1 : 1 - exp(-dt / 0.12)
            point = CGPoint(x: point.x + (touch.x - point.x) * k, y: point.y + (touch.y - point.y) * k)
        }
        let goal: Double = touch == nil ? 0 : 1
        pull += (goal - pull) * (1 - exp(-dt / (touch == nil ? 0.35 : 0.15)))
        return (Float(phase), Float(pull), point)
    }
}

// MARK: - Example

/// A title in mercury over a row of symbols in the other finishes, on a dark ground.
private struct MercuryTextExample: View {
    var body: some View {
        VStack(spacing: 28) {
            MercuryText("Metal", size: 96)
            HStack(spacing: 28) {
                Image(systemName: "bolt.fill").mercury(.holographic, bevel: 5)
                Image(systemName: "star.fill").mercury(.gold, bevel: 5)
                Image(systemName: "heart.fill").mercury(.signal, bevel: 5)
            }
            .font(.system(size: 52))
            .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.06))
        .fontWeight(.semibold)
    }
}

#Preview("Dark") {
    MercuryTextExample().preferredColorScheme(.dark)
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
