// swiftpieces:
// title: Rating Scrub
// description: A star rating you tap or scrub, with soft rounded stars that fill as solid blocks colored by the score and rise under your finger like soft keys, falling back in a ripple when you let go, with a little give past either end. While you scrub, a glass readout tinted with the score buds up out of the touched star and rides from star to star, and the caption under the stars is a glass numeral pill joined to a tinted label chip whose word morphs letter by letter.
// category: feedback
// minIOSVersion: "17.0"
// version: "2.2.0"
// tags: [rating, stars, scrub, gesture, haptic, review]

import SwiftUI

/// Tap-or-scrub star rating with lift, staggered settle, a score-colored fill, a liquid glass readout and an adjustable
/// accessibility element.
///
/// The stars are content and stay solid. The chrome is glass: while a finger scrubs, a readout bubble tinted with the
/// score buds up out of the touched star, rides with the finger from star to star, and melts back down into the star the
/// finger leaves. A tap alone never raises it, so a quick rating stays quiet.
///
/// - Parameters:
///   - rating: Bound value from 0 to `count`, in whole or half steps.
///   - count: Number of stars.
///   - allowsHalf: Snap to half stars.
///   - labels: Optional one label per star ("Poor" ... "Great"). Adds a caption under the stars: a glass pill with the numeral, joined to a glass chip tinted with the score that carries the label for the rounded-up rating. The scrub readout shows the label too.
///   - isReadOnly: Shows the value without a gesture or adjustable action.
///   - size: Star point size; scales with Dynamic Type.
///   - tint: Overrides the fill color for every score. Defaults to `style.levels`, one block per score.
///   - style: Fill colors per score, the empty star color and text colors. `.standard` runs the brand red, sand, butter, sage, sky.
public struct RatingScrub: View {
    /// Colors for the rating. Defaults follow the SwiftPieces house palette and adapt to light and dark.
    public struct Style: Sendable {
        /// Block colors from the lowest to the highest score. The filled stars use the one for the rounded-up rating,
        /// and so does the glass tint of the label chip and the scrub readout.
        public var levels: [Color]
        /// Empty star color.
        public var empty: Color
        /// Text color on the tinted glass.
        public var ink: Color
        /// Numeral color on its glass pill.
        public var text: Color
        /// Dimmed decimal, "/ 5" and hint color.
        public var muted: Color

        public init(
            levels: [Color] = [Style.tangerine, Style.sand, Style.butter, Style.sage, Style.sky],
            empty: Color = Style.adaptive(0xE7E5DF, 0x2E2E2E),
            ink: Color = Style.blockInk,
            text: Color = Style.adaptive(0x141414, 0xF4F3EF),
            muted: Color = Style.adaptive(0x8B8984, 0x6F6D69)
        ) {
            self.levels = levels
            self.empty = empty
            self.ink = ink
            self.text = text
            self.muted = muted
        }

        public static let standard = Style()

        /// The brand red, `#FF0000`, kept under its earlier name so existing code still compiles.
        public static let tangerine = Color(red: 1, green: 0, blue: 0)
        public static let sand = Color(red: 0xE9 / 255, green: 0xD5 / 255, blue: 0xB3 / 255)
        public static let butter = Color(red: 1, green: 0xD9 / 255, blue: 0x76 / 255)
        public static let sage = Color(red: 0xA9 / 255, green: 0xDC / 255, blue: 0xB7 / 255)
        public static let sky = Color(red: 0x9C / 255, green: 0xC2 / 255, blue: 1)
        public static let blockInk = Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255)

        /// A color that resolves to `light` or `dark` hex by the current appearance.
        public static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? rgb(dark) : rgb(light) })
        }

        nonisolated private static func rgb(_ hex: UInt32) -> UIColor {
            UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Binding private var rating: Double
    @State private var scrubbing = false
    /// The star under the finger. Kept after release, so the ripple knows where it starts.
    @State private var active: Int? = nil
    /// How far the end star is drawn past its end of the row. Only the drawing: the rating stays clamped.
    @State private var band: CGFloat = 0
    @GestureState private var isTouching = false
    @ScaledMetric(relativeTo: .title) private var size: CGFloat = 30
    /// The scrub readout: home inside the touched star, out above it while a finger scrubs.
    @State private var readouts = PieceBuds()
    /// The star the readout rides over. It stays on the last star touched, so the readout melts back into it.
    @State private var readoutStar = 0
    @State private var readoutWidth: CGFloat = 0

    private let count: Int
    private let allowsHalf: Bool
    private let labels: [String]?
    private let isReadOnly: Bool
    private let tint: Color?
    private let style: Style

    public init(rating: Binding<Double>, count: Int = 5, allowsHalf: Bool = false, labels: [String]? = nil, isReadOnly: Bool = false, size: CGFloat = 30, tint: Color? = nil, style: Style = .standard) {
        _rating = rating
        _size = ScaledMetric(wrappedValue: size, relativeTo: .title)
        self.count = count
        self.allowsHalf = allowsHalf
        self.labels = labels
        self.isReadOnly = isReadOnly
        self.tint = tint
        self.style = style
    }

    private var cell: CGFloat { size * 1.2 }
    private var spacing: CGFloat { size * 0.16 }
    private var rowWidth: CGFloat { CGFloat(count) * cell + CGFloat(count - 1) * spacing }
    private var rowHeight: CGFloat { max(44, cell) }
    /// Height of the caption's pill and chip, and of the scrub readout.
    private var pillHeight: CGFloat { max(32, size * 0.9) }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    /// Under a finger the rating lands on the press spring, so the fill, numeral and chip keep pace with a scrub
    /// and never ghost. From VoiceOver or the binding it moves on the value spring: a fill never shows a score
    /// that isn't true.
    private var valueMotion: Animation { scrubbing ? motion.press : motion.value }

    /// How much of the lift each star gets by its distance from the finger: all of it under the finger and a
    /// little either side, so the row gives like a soft surface instead of one key hopping along.
    private static let falloff: [CGFloat] = [1, 0.27, 0.1]

    /// How far past the end of the row the end star can be pulled: a few points, about the gap between stars.
    /// Not a slider thumb's range: the rating never travels with the finger, so a big give reads as the star
    /// coming loose, and the lifted star would draw well outside the row.
    private var bandLimit: CGFloat { min(max(size * 0.2, 6), 10) }

    private var label: String? {
        guard let labels, rating > 0 else { return nil }
        let index = min(labels.count, Int(ceil(rating))) - 1
        return index >= 0 ? labels[index] : nil
    }

    /// The block for the current score, spread across `levels` when `count` differs from their number.
    private var levelColor: Color {
        if let tint { return tint }
        let levels = style.levels
        guard !levels.isEmpty else { return style.text }
        guard rating > 0 else { return levels[levels.count - 1] }
        let position = (ceil(rating) - 1) / Double(max(count - 1, 1))
        return levels[min(levels.count - 1, Int((position * Double(levels.count - 1)).rounded()))]
    }

    public var body: some View {
        VStack(spacing: size * 0.5) {
            stars
            if labels != nil { caption }
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: rating) { (_: Double, new: Double) in new > 0 && new < Double(count) }
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: rating) { (_: Double, new: Double) in new == 0 || new == Double(count) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rating")
        .accessibilityValue(accessibilityValue)
        .accessibilityAdjustableAction(adjust)
    }

    private var stars: some View {
        HStack(spacing: spacing) {
            ForEach(0..<count, id: \.self) { index in
                star(index)
            }
        }
        .frame(minHeight: 44)
        // Behind the stars, so the readout at home sits under the touched star and rises out from behind it. Its own
        // group: it never comes near the caption's glass, and the stars stay out of the glass's lift.
        .background(alignment: .topLeading) {
            PieceLiquidGroup { readout }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        .gesture(scrub, including: isReadOnly ? .none : .all)
        // A scrub the system cancels (a scroll took over) never reaches onEnded, so the stars are let go here too.
        .onChange(of: isTouching) { _, touching in
            if !touching { release() }
        }
        .onChange(of: scrubbing) { _, now in
            Task {
                if now {
                    // Only a scrub raises the readout: a tap lifts its finger before this, and stays quiet.
                    try? await Task.sleep(for: .milliseconds(120))
                    guard scrubbing else { return }
                    await readouts.bloom(["readout"], reduceMotion: reduceMotion)
                } else if readouts.contains("readout") {
                    await readouts.gather(["readout"], reduceMotion: reduceMotion)
                }
            }
        }
    }

    /// The scrub readout: a glass bubble tinted with the score, with the rating and its label. It is born under the
    /// touched star as a small round bubble, rises out above the lifted star while it widens to fit its words, rides
    /// from star to star with the finger on the press spring, and on release narrows and sinks back into the star the
    /// finger left. Its tint drains as it goes home.
    @ViewBuilder
    private var readout: some View {
        if readouts.contains("readout") {
            let out = readouts.isOut("readout")
            let x = CGFloat(readoutStar) * (cell + spacing) + cell / 2
            // Clear of the lifted star's top, and of the resting star's under Reduce Motion, where nothing lifts.
            let top = size * (reduceMotion ? 0.48 : 0.9)
            let wide = out || reduceMotion
            HStack(spacing: 6) {
                Text(rating.formatted())
                    .contentTransition(reduceMotion ? .opacity : .numericText(value: rating))
                if let label {
                    PieceMorphText(text: label, font: .system(size: max(13, size * 0.36), weight: .semibold))
                }
            }
            .font(.system(size: max(13, size * 0.4), weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(style.ink)
            .fixedSize()
            .padding(.horizontal, pillHeight * 0.42)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { readoutWidth = $0 }
            .pieceBudContent(out: out)
            .frame(width: wide ? max(readoutWidth, pillHeight) : pillHeight, height: pillHeight)
            .clipShape(.capsule)
            .pieceLiquid(.capsule, tint: out ? levelColor : nil, interactive: false)
            .pieceBud(out: out, rest: CGSize(width: 0, height: -(top + PieceLiquid.joined + pillHeight / 2)), home: .zero)
            .position(x: x, y: rowHeight / 2)
            .animation(motion.press, value: readoutStar)
            .animation(motion.press, value: rating)
        }
    }

    /// A glass pill with the numeral, a dimmed decimal and "/ 5", joined by a liquid neck to a glass chip tinted with
    /// the score that carries the label. Unrated, the chip is clear glass with a hint; the first star tints it and its
    /// word morphs to the label.
    private var caption: some View {
        let whole = Int(rating.rounded(.down))
        let half = rating - Double(whole) >= 0.5
        let figure = max(16, size * 0.5)
        return PieceLiquidGroup {
            HStack(spacing: PieceLiquid.joined) {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text("\(whole)")
                        .foregroundStyle(rating > 0 ? style.text : style.muted)
                        .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(whole)))
                    Text(half ? ".5" : ".0")
                        .foregroundStyle(style.muted)
                    Text(" / \(count)")
                        .font(.system(size: figure * 0.62, weight: .semibold, design: .rounded))
                        .foregroundStyle(style.muted)
                }
                .font(.system(size: figure, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .fixedSize()
                // The digits are the value: they roll without overshoot, quickly under a finger.
                .animation(valueMotion, value: rating)
                .padding(.horizontal, pillHeight * 0.42)
                .frame(height: pillHeight)
                .pieceLiquid(.capsule, interactive: false)

                // One chip that morphs its width, its tint and its word letter by letter.
                PieceMorphText(text: label ?? (isReadOnly ? "No rating" : "Tap or slide"), font: .system(size: max(13, size * 0.36), weight: .semibold))
                    .foregroundStyle(label == nil ? style.muted : style.ink)
                    .padding(.horizontal, pillHeight * 0.42)
                    .frame(height: pillHeight)
                    .pieceLiquid(.capsule, tint: label == nil ? nil : levelColor, interactive: false)
            }
            // Keyed on the rating, not the label: with fewer labels than stars the color can change on its own.
            .animation(scrubbing ? motion.press : motion.morph, value: rating)
        }
        .frame(width: rowWidth)
    }

    private var accessibilityValue: String {
        let base = "\(rating.formatted()) of \(count)"
        return label.map { "\(base), \($0)" } ?? base
    }

    private func star(_ index: Int) -> some View {
        let fill = min(max(rating - Double(index), 0), 1)
        // Places from the finger. Left of the row, the finger counts as one place before the first star.
        let distance = abs(index - (active ?? -1))
        let rise = scrubbing && !reduceMotion && active != nil && distance < Self.falloff.count ? Self.falloff[distance] : 0
        let held = scrubbing && active == index
        // The star under the finger rises on the press spring and its neighbors follow by distance. On release the
        // star the finger left drops first and each neighbor a beat after it, so the row falls back in a ripple.
        let lift = scrubbing
            ? (distance == 0 ? motion.press : motion.follow(rank: distance))
            : motion.cascade(motion.follow(rank: distance), index: distance)
        return ZStack {
            SoftStar().fill(style.empty)
            SoftStar()
                .fill(levelColor)
                .mask(alignment: .leading) { Rectangle().frame(width: size * fill) }
        }
        .frame(width: size, height: size)
        // The fill is the value: it never takes the ripple's delay or bounce.
        .animation(valueMotion, value: rating)
        .frame(width: cell, height: cell)
        .animation(lift) { content in
            content
                .scaleEffect(1 + 0.3 * rise)
                .offset(y: -size * 0.28 * rise)
                // Reduce Motion: the held star shifts a shade in place instead of rising.
                .brightness(held && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
        }
        .offset(x: (index == count - 1 && band > 0) || (index == 0 && band < 0) ? band : 0)
    }

    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .updating($isTouching) { _, touching, _ in touching = true }
            .onChanged { value in
                // Tracking is never animated: the rating, the lift and the band follow the finger directly.
                scrubbing = true
                set(x: value.location.x)
                if let active { readoutStar = active }
                band = bandOffset(atX: value.location.x)
            }
            .onEnded { value in
                release(velocity: value.velocity.width, at: value.location.x)
            }
    }

    /// The end star's drawn overshoot for a finger at `x`: past either end of the row it gives with rubber-band
    /// resistance. Reduce Motion keeps it still; the rigid impact at the bound still marks the end.
    private func bandOffset(atX x: CGFloat) -> CGFloat {
        guard !reduceMotion else { return 0 }
        return PieceMotion.rubberBand(x < 0 ? x : max(x - rowWidth, 0), limit: bandLimit)
    }

    /// Lets the stars fall back. A star pulled past the end rebounds, leaving at the speed it was moving.
    private func release(velocity: CGFloat = 0, at x: CGFloat? = nil) {
        guard scrubbing else { return }
        scrubbing = false
        guard band != 0 else { return }
        var speed: CGFloat = 0
        if let x {
            // The band's own speed: the finger's, slowed by the resistance.
            let frame: CGFloat = 1 / 120
            speed = (bandOffset(atX: x + velocity * frame) - bandOffset(atX: x)) / frame
        }
        withAnimation(motion.settle(velocity: speed, from: band, to: 0)) { band = 0 }
    }

    private func adjust(_ direction: AccessibilityAdjustmentDirection) {
        guard !isReadOnly else { return }
        let step = allowsHalf ? 0.5 : 1
        switch direction {
        case .increment: rating = min(Double(count), rating + step)
        case .decrement: rating = max(0, rating - step)
        @unknown default: break
        }
    }

    /// Maps a horizontal position to a rating, snapping to whole or half stars.
    private func set(x: CGFloat) {
        let raw = x / (cell + spacing)
        let index = Int(floor(raw))
        let within = raw - CGFloat(index)
        var value = Double(index) + (allowsHalf && within < 0.5 ? 0.5 : 1)
        if x < 0 { value = 0 }
        value = min(max(value, 0), Double(count))
        active = value > 0 ? Int(ceil(value)) - 1 : nil
        guard value != rating else { return }
        rating = value
    }

    /// A five-point star with rounded tips and valleys, so it reads as a soft solid block.
    private struct SoftStar: Shape {
        func path(in rect: CGRect) -> Path {
            let center = CGPoint(x: rect.midX, y: rect.midY + rect.height * 0.04)
            let outer = min(rect.width, rect.height) * 0.52
            let inner = outer * 0.5
            let points: [CGPoint] = (0..<10).map { i in
                let angle = -Double.pi / 2 + Double(i) * .pi / 5
                let radius = i.isMultiple(of: 2) ? outer : inner
                return CGPoint(x: center.x + CGFloat(cos(angle)) * radius, y: center.y + CGFloat(sin(angle)) * radius)
            }
            var path = Path()
            let start = CGPoint(x: (points[9].x + points[0].x) / 2, y: (points[9].y + points[0].y) / 2)
            path.move(to: start)
            for i in 0..<10 {
                let corner = points[i]
                let next = points[(i + 1) % 10]
                path.addArc(tangent1End: corner, tangent2End: next, radius: i.isMultiple(of: 2) ? outer * 0.16 : outer * 0.07)
            }
            path.closeSubpath()
            return path
        }
    }
}

// MARK: - Example

/// The rating itself: five stars with the numeral and label chip it renders under them.
private struct RatingScrubExample: View {
    @State private var rating = 4.0

    var body: some View {
        RatingScrub(rating: $rating, labels: ["Poor", "Fair", "Good", "Very good", "Great"], size: 46)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RatingScrub.Style.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    RatingScrubExample()
}

#Preview("Dark") {
    RatingScrubExample().preferredColorScheme(.dark)
}

#Preview("Half stars, read only") {
    RatingScrub(rating: .constant(3.5), allowsHalf: true, isReadOnly: true, size: 44)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum, rubberBand)

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
