// SwiftPieces motion foundation: the one source of the library's motion language.
// version: 1.1.0
//
// Pieces never import this file. `npm run motion:sync` copies the sections a piece uses into a
// "Piece motion" block at the end of that piece, so every piece still stands alone, and
// `registry:build` fails if a copy drifts from this source. Everything here is `private`, so two
// pieces installed in one app never collide. The principles, the token table and the anti-patterns
// are in content/docs/guides/swiftui-motion.mdx; read it before adding anything here. The language
// stays small on purpose.
//
// Sections, in the order they are copied. `provides` lists the names that pull a section into a piece.
// Keep to Swift 6.0 syntax (no `nonisolated` types, no @Animatable): people build pieces with Xcode 16.

import SwiftUI

// swiftpieces-motion-section: core
// provides: PieceMotion
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

// swiftpieces-motion-section: follow
// requires: core
// provides: .follow(, .cascade(
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

// swiftpieces-motion-section: momentum
// requires: core
// provides: PieceMotion.project, PieceMotion.nearest, .settle(velocity
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

// swiftpieces-motion-section: rubberBand
// requires: core
// provides: PieceMotion.rubberBand
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

// swiftpieces-motion-section: pressMath
// requires: core
// provides: PieceMotion.pressScale, PieceMotion.pressAnchor
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

// swiftpieces-motion-section: press
// requires: pressMath
// provides: piecePress
/// Sinks on touch-down, leaning toward the touch if given, and springs back from the same lean. Under Reduce
/// Motion it shades instead of moving (darker in light mode, lighter in dark), without turning transparent.
private struct PiecePress: ViewModifier {
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
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .scaleEffect(scale, anchor: anchor)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

private extension View {
    /// Sinks this view while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func piecePress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PiecePress(pressed: pressed, touch: touch, depth: depth))
    }
}

// swiftpieces-motion-section: pressStyle
// requires: press
// provides: PiecePressStyle
/// Only the press, centered: for chips, rows and tiles, and anything in scrolling content.
private struct PiecePressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.piecePress(configuration.isPressed, depth: depth)
    }
}

// swiftpieces-motion-section: stretch
// requires: core
// provides: .stretch(velocity, .stretch(pull, pieceStretch
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

// swiftpieces-motion-section: pop
// requires: core
// provides: piecePop
/// Anticipation, overshoot, settle: dips, swells past full size and lands each time `trigger` changes. Under
/// Reduce Motion it stays still (same view, no identity change) and the color or symbol carries the meaning.
private struct PiecePop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let amount = reduceMotion ? 0 : amount
        content.keyframeAnimator(initialValue: CGFloat(1), trigger: trigger) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(1 - amount * 0.4, duration: 0.08)
                SpringKeyframe(1 + amount, duration: 0.14, spring: Spring(duration: 0.18, bounce: 0))
                SpringKeyframe(1, duration: 0.42, spring: PieceMotion.expressive)
            }
        }
    }
}

private extension View {
    /// Pops each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func piecePop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PiecePop(trigger: AnyHashable(trigger), amount: amount))
    }
}

// swiftpieces-motion-section: shake
// requires: core
// provides: pieceShake
/// A short decaying side-to-side shake for refused input, each time `trigger` changes. Under Reduce Motion it stays
/// still (same view, no identity change): pair it with a color or message change and the error haptic.
private struct PieceShake: ViewModifier {
    let trigger: AnyHashable
    var distance: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance = reduceMotion ? 0 : distance
        content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-distance, duration: 0.06)
                CubicKeyframe(distance * 0.75, duration: 0.07)
                CubicKeyframe(-distance * 0.5, duration: 0.07)
                CubicKeyframe(distance * 0.25, duration: 0.06)
                SpringKeyframe(0, duration: 0.12, spring: Spring(duration: 0.18, bounce: 0))
            }
        }
    }
}

private extension View {
    /// Shakes this view side to side once each time `trigger` changes, for input that was refused.
    func pieceShake(trigger: some Hashable & Sendable, distance: CGFloat = 8) -> some View {
        modifier(PieceShake(trigger: AnyHashable(trigger), distance: distance))
    }
}
