// swiftpieces:
// title: Notice Stack
// description: "Glass notices piled so they melt into one shape, the top one proud of the pile. Flick the top notice sideways and it flies off with your speed while the next one rises into its place, with a tick as it commits. Tap the pile and the notices fan into their own bubbles; swipe any of them away and the rest close up."
// category: sheets
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [notices, stack, toast, swipe, glass, dismiss, haptics]

import SwiftUI

/// A pile of glass notices you can fan open and swipe away.
///
/// Collapsed, only a peek of the notices under the first shows, close enough that the glass merges. Expanded, each
/// notice is its own bubble. Swiping one past a threshold, or flicking it, removes it from `notices`.
///
/// - Parameters:
///   - notices: Notices from front to back. Removing one is how a swipe completes.
///   - expanded: Whether the pile is fanned into separate bubbles.
///   - haptics: A soft tick when a swipe commits, and a light tick when the pile fans or gathers.
///   - style: Ink and muted message color. The notices themselves are clear glass.
public struct NoticeStack: View {
    /// One notice in the pile.
    public struct Notice: Identifiable, Sendable {
        public var id: String
        public var title: String
        public var message: String
        public var symbol: String

        public init(id: String, title: String, message: String, symbol: String) {
            self.id = id
            self.title = title
            self.message = message
            self.symbol = symbol
        }
    }

    public struct Style: Sendable {
        public var ink: Color
        public var muted: Color

        public init(
            ink: Color = NoticeStack.adaptive(light: 0x141414, dark: 0xF4F3EF),
            muted: Color = NoticeStack.adaptive(light: 0x5C5A56, dark: 0xA6A49F)
        ) {
            self.ink = ink
            self.muted = muted
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @Binding private var notices: [Notice]
    @Binding private var expanded: Bool
    @State private var drag: CGFloat = 0
    @State private var draggingId: String?
    @State private var commits = 0
    @State private var fans = 0

    private let haptics: Bool
    private let style: Style

    public init(notices: Binding<[Notice]>, expanded: Binding<Bool>, haptics: Bool = true, style: Style = .standard) {
        self._notices = notices
        self._expanded = expanded
        self.haptics = haptics
        self.style = style
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        PieceLiquidGroup(spacing: expanded ? PieceLiquid.apart : PieceLiquid.merge) {
            ZStack(alignment: .top) {
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, notice in
                    row(notice, index: index)
                }
            }
            .frame(height: pileHeight, alignment: .top)
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.impact(flexibility: SensoryFeedback.Flexibility.soft, intensity: 0.85), trigger: commits)
        .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light, intensity: 0.65), trigger: fans)
        .animation(motion.morph, value: expanded)
        .animation(motion.settle, value: notices.count)
        .accessibilityElement(children: .contain)
    }

    /// Collapsed, three notices peek. Expanded, all of them.
    private var visible: [Notice] {
        expanded ? notices : Array(notices.prefix(3))
    }

    private var pileHeight: CGFloat {
        let rows = CGFloat(max(visible.count, 1))
        if expanded { return rows * 86 }
        return 78 + CGFloat(max(visible.count - 1, 0)) * 12
    }

    private func row(_ notice: Notice, index: Int) -> some View {
        let front = index == 0 || expanded
        let x = draggingId == notice.id ? drag : 0
        let y: CGFloat = expanded ? CGFloat(index) * 86 : CGFloat(index) * 12
        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: notice.symbol)
                .font(.body.weight(.semibold))
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.title)
                    .font(.subheadline.weight(.semibold))
                Text(notice.message)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(style.muted)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(style.ink)
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
        .pieceLiquid(RoundedRectangle(cornerRadius: 22, style: .continuous), interactive: front)
        .pieceLiquidScale(expanded || reduceMotion ? 1 : 1 - CGFloat(index) * 0.035)
        .offset(x: x, y: y)
        .zIndex(Double(notices.count - index))
        .gesture(swipe(notice, enabled: front))
        .onTapGesture {
            guard draggingId == nil else { return }
            // Collapsed, only the front notice fans the pile. Expanded, any notice gathers it.
            if expanded || index == 0 { toggleFan() }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(notice.title). \(notice.message)")
        .accessibilityAction(named: "Dismiss") { remove(notice.id) }
    }

    private func toggleFan() {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        withAnimation(motion.morph) { expanded.toggle() }
        if haptics { fans += 1 }
    }

    private func swipe(_ notice: Notice, enabled: Bool) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard enabled else { return }
                draggingId = notice.id
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                drag = sign * value.translation.width
            }
            .onEnded { value in
                guard enabled else { return }
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let traveled = sign * value.translation.width
                let velocity = sign * value.velocity.width
                let commit = abs(traveled) > 88 || abs(velocity) > 700
                if commit {
                    let away: CGFloat = traveled < 0 ? -420 : 420
                    withAnimation(motion.settle(velocity: velocity, from: traveled, to: away)) { drag = away }
                    if haptics { commits += 1 }
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(220))
                        remove(notice.id)
                        drag = 0
                        draggingId = nil
                    }
                } else {
                    withAnimation(motion.rebound) { drag = 0 }
                    draggingId = nil
                }
            }
    }

    private func remove(_ id: String) {
        notices.removeAll { $0.id == id }
        if notices.isEmpty { expanded = false }
    }

    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct NoticeStackExample: View {
    @State private var notices: [NoticeStack.Notice] = [
        .init(id: "gate", title: "Gate changed", message: "Boarding is now B12, ten minutes earlier.", symbol: "airplane"),
        .init(id: "rain", title: "Rain at four", message: "The river walk is still fine if you leave now.", symbol: "cloud.rain.fill"),
        .init(id: "table", title: "Table held", message: "Under the lanterns, for two, at 19:30.", symbol: "fork.knife"),
    ]
    @State private var expanded = false

    var body: some View {
        NoticeStack(notices: $notices, expanded: $expanded)
            .padding(.horizontal, 28)
            .padding(.top, 36)
            .frame(maxWidth: 380)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background { NoticeBackdrop(empty: notices.isEmpty) }
            .onChange(of: notices.isEmpty) { _, empty in
                guard empty else { return }
                Task { @MainActor in
                    try? await Task.sleep(for: .seconds(1.2))
                    notices = [
                        .init(id: "gate", title: "Gate changed", message: "Boarding is now B12, ten minutes earlier.", symbol: "airplane"),
                        .init(id: "rain", title: "Rain at four", message: "The river walk is still fine if you leave now.", symbol: "cloud.rain.fill"),
                        .init(id: "table", title: "Table held", message: "Under the lanterns, for two, at 19:30.", symbol: "fork.knife"),
                    ]
                }
            }
    }
}

private struct NoticeBackdrop: View {
    var empty: Bool

    var body: some View {
        ZStack {
            NoticeStack.adaptive(light: 0xF3F2EE, dark: 0x121212)
            Circle().fill(Color(red: 1, green: 0.231, blue: 0.188).opacity(0.85)).frame(width: 200).offset(x: 120, y: empty ? 40 : 180)
            Circle().fill(Color(red: 0.612, green: 0.761, blue: 1)).frame(width: 160).offset(x: -110, y: -40)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    NoticeStackExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    NoticeStackExample()
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

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid)

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
