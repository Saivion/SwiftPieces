// swiftpieces:
// title: Mini Player
// description: "Drag a playing video down and it shrinks with your finger into a small floating window that snaps to the nearest corner. Flick the window across and it glides to the far corner at the speed you threw it; tap it and it grows back to full width, the details fading in under it. The page underneath stays usable while it floats. For video, live streams, calls and podcasts with video."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [video, player, picture-in-picture, pip, minimize, corner, drag, gesture]

import SwiftUI

/// A corner the mini player can rest in.
public enum MiniPlayerCorner: Sendable, CaseIterable {
    case topLeading, topTrailing, bottomLeading, bottomTrailing
}

/// Sizes and colors for `MiniPlayer`.
public struct MiniPlayerStyle: Sendable {
    /// The window's width while minimized, as a fraction of the container's width.
    public var miniWidth: CGFloat
    /// The gap between the window and the container's edges.
    public var inset: CGFloat
    /// The player's corner radius while expanded, and while minimized.
    public var expandedRadius: CGFloat
    public var miniRadius: CGFloat
    /// The window's shadow.
    public var shadow: Color

    public init(miniWidth: CGFloat = 0.42, inset: CGFloat = 16, expandedRadius: CGFloat = 0, miniRadius: CGFloat = 14, shadow: Color = .black.opacity(0.28)) {
        self.miniWidth = miniWidth
        self.inset = inset
        self.expandedRadius = expandedRadius
        self.miniRadius = miniRadius
        self.shadow = shadow
    }

    public static let standard = MiniPlayerStyle()
}

/// A player that drags down into a floating corner window and grows back with a tap.
///
/// It fills the space it is given: put it over your page with `.overlay`, so the page stays usable while the
/// window floats. Expanded, the player sits at the top at full width with the details under it.
///
/// - Parameters:
///   - isMinimized: Whether the player is the small corner window.
///   - corners: The corners the window can rest in. The first is where a drag down lands it.
///   - aspectRatio: The player's width over its height.
///   - style: Sizes and colors.
///   - player: The video, or whatever plays.
///   - details: Shown under the player while it is expanded: a title, controls, comments.
public struct MiniPlayer<Player: View, Details: View>: View {
    public typealias Style = MiniPlayerStyle
    public typealias Corner = MiniPlayerCorner

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isMinimized: Bool
    @State private var corner: Corner
    @State private var drag: CGSize = .zero
    @State private var dragging = false
    @State private var snaps = 0

    private let corners: [Corner]
    private let aspectRatio: CGFloat
    private let style: Style
    private let player: Player
    private let details: Details

    public init(
        isMinimized: Binding<Bool>,
        corners: [Corner] = [.bottomTrailing, .bottomLeading],
        aspectRatio: CGFloat = 16 / 9,
        style: Style = .standard,
        @ViewBuilder player: () -> Player,
        @ViewBuilder details: () -> Details
    ) {
        self._isMinimized = isMinimized
        self.corners = corners.isEmpty ? [.bottomTrailing] : corners
        self._corner = State(initialValue: corners.first ?? .bottomTrailing)
        self.aspectRatio = aspectRatio
        self.style = style
        self.player = player()
        self.details = details()
    }

    public var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let expanded = CGRect(x: 0, y: 0, width: size.width, height: size.width / aspectRatio)
            let shrink = isMinimized ? 1 : min(max(drag.height / (size.height * 0.45), 0), 1)
            let rest = isMinimized ? miniFrame(in: size, at: corner) : interpolate(expanded, miniFrame(in: size, at: corner), shrink)
            let frame = rest.offsetBy(dx: isMinimized ? drag.width : 0, dy: isMinimized ? drag.height : 0)
            let mini = isMinimized ? 1 : shrink

            ZStack(alignment: .topLeading) {
                details
                    .frame(width: size.width, alignment: .topLeading)
                    .offset(y: expanded.height + 40 * mini)
                    .opacity(Double(1 - min(mini * 2, 1)))
                    .allowsHitTesting(!isMinimized)
                    .accessibilityHidden(isMinimized)

                player
                    .frame(width: frame.width, height: frame.height)
                    .clipShape(.rect(cornerRadius: style.expandedRadius + (style.miniRadius - style.expandedRadius) * mini, style: .continuous))
                    .shadow(color: style.shadow.opacity(Double(mini)), radius: 16, y: 6)
                    .offset(x: frame.minX, y: frame.minY)
                    .gesture(dragGesture(in: size))
                    .onTapGesture { if isMinimized { setMinimized(false) } }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel(isMinimized ? "Mini player" : "")
                    .accessibilityAction(named: isMinimized ? "Expand" : "Minimize") { setMinimized(!isMinimized) }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: snaps)
    }

    private func dragGesture(in size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                dragging = true
                // Expanded, only a pull down counts; a push up stiffens like a scroll view's edge.
                drag = isMinimized ? value.translation : CGSize(width: 0, height: value.translation.height >= 0 ? value.translation.height : value.translation.height / 4)
            }
            .onEnded { value in
                dragging = false
                let motion = PieceMotion(reduceMotion: reduceMotion)
                if isMinimized {
                    let start = miniFrame(in: size, at: corner)
                    let x = PieceMotion.project(start.midX + value.translation.width, velocity: value.velocity.width)
                    let y = PieceMotion.project(start.midY + value.translation.height, velocity: value.velocity.height)
                    let next = corners.min { distance(miniFrame(in: size, at: $0), x, y) < distance(miniFrame(in: size, at: $1), x, y) } ?? corner
                    if next != corner { snaps += 1 }
                    withAnimation(motion.settle) {
                        corner = next
                        drag = .zero
                    }
                } else {
                    let projected = PieceMotion.project(value.translation.height, velocity: value.velocity.height)
                    let commit = projected > size.height * 0.3
                    withAnimation(commit ? motion.morph : motion.rebound) {
                        if commit { isMinimized = true; snaps += 1 }
                        drag = .zero
                    }
                }
            }
    }

    private func setMinimized(_ minimized: Bool) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        snaps += 1
        withAnimation(minimized ? motion.morph : motion.reveal) { isMinimized = minimized }
    }

    private func miniFrame(in size: CGSize, at corner: Corner) -> CGRect {
        let width = size.width * style.miniWidth, height = width / aspectRatio
        let leading = corner == .topLeading || corner == .bottomLeading
        let top = corner == .topLeading || corner == .topTrailing
        return CGRect(x: leading ? style.inset : size.width - style.inset - width, y: top ? style.inset : size.height - style.inset - height, width: width, height: height)
    }

    private func interpolate(_ a: CGRect, _ b: CGRect, _ t: CGFloat) -> CGRect {
        CGRect(x: a.minX + (b.minX - a.minX) * t, y: a.minY + (b.minY - a.minY) * t, width: a.width + (b.width - a.width) * t, height: a.height + (b.height - a.height) * t)
    }

    private func distance(_ rect: CGRect, _ x: CGFloat, _ y: CGFloat) -> CGFloat {
        hypot(rect.midX - x, rect.midY - y)
    }
}

// MARK: - Example

/// An episode page with a playing video. Drag the video down to float it; tap the window to bring it back.
private struct MiniPlayerExample: View {
    @State private var isMinimized = false

    var body: some View {
        MiniPlayer(isMinimized: $isMinimized) {
            ZStack(alignment: .bottomLeading) {
                MiniPlayerPrint(kind: 3)
                Image(systemName: "play.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(.black.opacity(0.28), in: .circle)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Capsule().fill(.white.opacity(0.35)).frame(height: 3)
                Capsule().fill(.white).frame(width: 90, height: 3)
            }
        } details: {
            VStack(alignment: .leading, spacing: 6) {
                Text("Lake Ida, episode 3").font(.title3.weight(.semibold))
                Text("Weekend Trails · 24 min").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
            }
            .padding(20)
        }
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

/// A flat print in the house palette, standing in for a photo in the example. Swap in your own images.
private struct MiniPlayerPrint: View {
    /// Which of the eight prints: 0 Sunrise, 1 Lake, 2 Pines, 3 Waves, 4 Dunes, 5 Night, 6 Bloom, 7 Kite.
    var kind: Int

    private static let blue = Color(red: 0.18, green: 0.545, blue: 1)
    private static let yellow = Color(red: 1, green: 0.761, blue: 0.102)
    private static let teal = Color(red: 0, green: 0.769, blue: 0.655)
    private static let pink = Color(red: 1, green: 0, blue: 0.361)
    private static let orange = Color(red: 1, green: 0.541, blue: 0.122)
    private static let red = Color(red: 1, green: 0, blue: 0)
    private static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private static let paper = Color(red: 0.957, green: 0.953, blue: 0.937)

    var body: some View {
        Canvas { context, size in
            let w = size.width, h = size.height, m = min(w, h)
            func disc(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ color: Color) {
                context.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(color))
            }
            func band(_ y: CGFloat, _ height: CGFloat, _ color: Color) {
                context.fill(Path(CGRect(x: 0, y: y, width: w, height: height)), with: .color(color))
            }
            switch kind % 8 {
            case 0:
                band(0, h, Self.orange)
                disc(w * 0.5, h * 0.64, m * 0.34, Self.yellow)
                for (y, t) in [(0.66, 0.035), (0.74, 0.05), (0.83, 0.07), (0.93, 0.07)] as [(CGFloat, CGFloat)] { band(h * y, h * t, Self.pink) }
            case 1:
                band(0, h, Self.blue)
                disc(w * 0.7, h * 0.32, m * 0.13, Self.yellow)
                band(h * 0.6, h * 0.4, Self.teal)
                for (a, b, l) in [(0.2, 0.72, 0.22), (0.55, 0.8, 0.28), (0.3, 0.9, 0.18)] as [(CGFloat, CGFloat, CGFloat)] {
                    var ripple = Path()
                    ripple.move(to: CGPoint(x: w * a, y: h * b))
                    ripple.addLine(to: CGPoint(x: w * (a + l), y: h * b))
                    context.stroke(ripple, with: .color(Self.paper), style: StrokeStyle(lineWidth: max(1, m * 0.025), lineCap: .round))
                }
            case 2:
                band(0, h, Self.teal)
                disc(w * 0.3, h * 0.32, m * 0.17, Self.pink)
                let count = max(4, Int((w / m * 5).rounded()))
                for i in 0..<count {
                    let x = (CGFloat(i) + 0.5) / CGFloat(count) * w, half = w / CGFloat(count) * 0.62
                    let height = h * (0.34 + CGFloat((i * 37) % 5) / 5 * 0.2)
                    var pine = Path()
                    pine.move(to: CGPoint(x: x, y: h - height))
                    pine.addLine(to: CGPoint(x: x + half, y: h))
                    pine.addLine(to: CGPoint(x: x - half, y: h))
                    pine.closeSubpath()
                    context.fill(pine, with: .color(Self.ink))
                }
            case 3:
                band(0, h, Self.pink)
                disc(w * 0.72, h * 0.3, m * 0.16, Self.yellow)
                for (j, color) in [Self.blue, Self.teal].enumerated() {
                    let r = m * 0.1, y = h * (0.62 + CGFloat(j) * 0.16)
                    var waves = Path()
                    waves.move(to: CGPoint(x: -r * 3, y: h))
                    waves.addLine(to: CGPoint(x: -r * 3, y: y + r))
                    var x = -r * 2 + CGFloat(j) * r
                    while x < w + r * 3 {
                        waves.addArc(center: CGPoint(x: x, y: y + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
                        x += r * 2
                    }
                    waves.addLine(to: CGPoint(x: w + r * 3, y: h))
                    waves.closeSubpath()
                    context.fill(waves, with: .color(color))
                }
            case 4:
                band(0, h, Self.yellow)
                disc(w * 0.66, h * 0.3, m * 0.1, Self.red)
                disc(w * 0.18, h + m * 0.25, m * 0.62, Self.orange)
                disc(w * 0.9, h + m * 0.38, m * 0.6, Self.pink)
            case 5:
                band(0, h, Self.ink)
                disc(w * 0.62, h * 0.38, m * 0.22, Self.blue)
                disc(w * 0.62 + m * 0.1, h * 0.38 - m * 0.06, m * 0.2, Self.ink)
                for (a, b) in [(0.2, 0.2), (0.3, 0.6), (0.15, 0.45), (0.85, 0.75), (0.42, 0.15), (0.8, 0.18)] as [(CGFloat, CGFloat)] {
                    disc(w * a, h * b, max(0.8, m * 0.012), Self.paper)
                }
                band(h * 0.84, h * 0.16, Self.teal)
            case 6:
                band(0, h, Self.blue)
                let r = m * 0.14
                for i in 0..<6 {
                    let angle = Double(i) / 6 * 2 * .pi
                    disc(w * 0.5 + CGFloat(cos(angle)) * r * 1.25, h * 0.5 + CGFloat(sin(angle)) * r * 1.25, r, Self.pink)
                }
                disc(w * 0.5, h * 0.5, r * 0.9, Self.yellow)
            default:
                band(0, h, Self.orange)
                let x = w * 0.56, y = h * 0.4, s = m * 0.24
                var kite = Path()
                kite.move(to: CGPoint(x: x, y: y - s))
                kite.addLine(to: CGPoint(x: x + s * 0.7, y: y))
                kite.addLine(to: CGPoint(x: x, y: y + s * 1.2))
                kite.addLine(to: CGPoint(x: x - s * 0.7, y: y))
                kite.closeSubpath()
                context.fill(kite, with: .color(Self.teal))
                var shade = Path()
                shade.move(to: CGPoint(x: x, y: y - s))
                shade.addLine(to: CGPoint(x: x, y: y + s * 1.2))
                shade.addLine(to: CGPoint(x: x + s * 0.7, y: y))
                shade.closeSubpath()
                context.fill(shade, with: .color(Self.ink.opacity(0.18)))
                var string = Path()
                string.move(to: CGPoint(x: x, y: y + s * 1.2))
                string.addCurve(to: CGPoint(x: w * 0.2, y: h * 1.02), control1: CGPoint(x: x - s, y: y + s * 2), control2: CGPoint(x: x + s * 0.4, y: h * 0.85))
                context.stroke(string, with: .color(Self.ink), lineWidth: max(1, m * 0.012))
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    MiniPlayerExample()
}

#Preview("Dark") {
    MiniPlayerExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum)

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
