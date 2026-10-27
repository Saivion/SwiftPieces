// swiftpieces:
// title: Liquid Switch
// description: "A toggle on a liquid glass track whose thumb moves like liquid: its leading edge reaches the far end first and the trailing edge follows, so it stretches across and gathers in, while the red floods the track out of it. Drag the thumb and it follows the finger with rubber-band give at the ends, then lands where the flick was heading; tap the switch or its title to flip it. An optional SF Symbol fades into the thumb as it turns on."
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [toggle, switch, settings, glass, drag, haptics]

import SwiftUI

/// Colors and type for `LiquidSwitch`. `.standard` is the house palette: the brand red on neutral glass.
public struct LiquidSwitchStyle: Sendable {
    /// The fill that floods the track while on.
    public var onTint: Color
    /// The thumb.
    public var thumb: Color
    /// The symbol in the thumb while on.
    public var symbol: Color
    /// The title.
    public var label: Color
    /// The title's font.
    public var font: Font
    /// Opacity of the switch while disabled with `.disabled(true)`.
    public var disabledOpacity: Double

    public init(
        onTint: Color = LiquidSwitchStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        thumb: Color = LiquidSwitchStyle.adaptive(light: 0xFFFFFF, dark: 0xF4F3EF),
        symbol: Color = LiquidSwitchStyle.adaptive(light: 0x141414, dark: 0x141414),
        label: Color = LiquidSwitchStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        font: Font = .body.weight(.semibold),
        disabledOpacity: Double = 0.45
    ) {
        self.onTint = onTint
        self.thumb = thumb
        self.symbol = symbol
        self.label = label
        self.font = font
        self.disabledOpacity = disabledOpacity
    }

    public static let standard = LiquidSwitchStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A switch whose thumb moves like liquid: the edge facing where it is going leads and the far edge follows, so it
/// stretches across the track and gathers in, while the on tint floods the track out of it.
///
/// Use it like `Toggle`. With a title the whole row toggles on tap, the way a settings row does.
///
/// - Parameters:
///   - title: The label before the switch, read by VoiceOver. `nil` draws the switch alone; give it an `accessibilityLabel` then.
///   - isOn: The bound state. Changing it from outside moves the thumb the same way a tap does.
///   - symbol: An optional SF Symbol that fades into the thumb as it turns on, such as `"moon.fill"`.
///   - style: Colors and font. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct LiquidSwitch: View {
    public typealias Style = LiquidSwitchStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Binding private var isOn: Bool
    /// The thumb's edges, in points from the track's leading end. Each is sprung on its own, so they can lead and trail.
    @State private var lower: CGFloat
    @State private var upper: CGFloat
    @State private var touching = false
    @State private var dragging = false
    @State private var flips = 0
    @GestureState private var inGesture = false

    private let title: String?
    private let symbol: String?
    private let style: Style

    private static let width: CGFloat = 52
    private static let height: CGFloat = 32
    private static let inset: CGFloat = 2
    private static var thumb: CGFloat { height - inset * 2 }
    /// How much wider the thumb grows under a finger, toward the middle.
    private static let swell: CGFloat = 6

    public init(_ title: String? = nil, isOn: Binding<Bool>, symbol: String? = nil, style: Style = .standard) {
        self.title = title
        self._isOn = isOn
        self.symbol = symbol
        self.style = style
        let rest = Self.rest(isOn.wrappedValue, pressed: false)
        self._lower = State(initialValue: rest.lower)
        self._upper = State(initialValue: rest.upper)
    }

    public var body: some View {
        HStack(spacing: 12) {
            if let title {
                Text(title)
                    .font(style.font)
                    .foregroundStyle(style.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            track
        }
        .fontWeight(.semibold)
        .contentShape(.rect)
        .onTapGesture { if isEnabled { flip(to: !isOn) } }
        .opacity(isEnabled ? 1 : style.disabledOpacity)
        .animation(PieceMotion(reduceMotion: reduceMotion).morph, value: isEnabled)
        .sensoryFeedback(.impact(weight: .light), trigger: flips)
        .onChange(of: isOn) { _, on in
            // A drag owns the thumb until it lets go; the release lands it.
            if !dragging { flow(to: on) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title ?? "")
        .accessibilityValue(isOn ? "On" : "Off")
        .accessibilityAddTraits(.isToggle)
        .accessibilityAction { if isEnabled { flip(to: !isOn) } }
    }

    private var track: some View {
        let width = Self.width, height = Self.height, inset = Self.inset, thumb = Self.thumb
        return LiquidSwitchEdge(value: lower) { lo in
            LiquidSwitchEdge(value: upper) { up in
                // How far on the thumb is, read from its leading edge so the tint arrives with it.
                let on = min(max((up - inset - thumb) / (width - inset * 2 - thumb), 0), 1)
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(style.onTint)
                        .frame(width: max(up + inset, height), height: height)
                        .opacity(on)
                    Capsule()
                        .fill(style.thumb)
                        .frame(width: max(up - lo, thumb * 0.6), height: thumb)
                        .shadow(color: .black.opacity(0.18), radius: 3, y: 1.5)
                        .overlay {
                            if let symbol {
                                Image(systemName: symbol)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(style.symbol)
                                    .scaleEffect(0.6 + 0.4 * on)
                                    .opacity(on)
                            }
                        }
                        .offset(x: lo)
                }
                .frame(width: width, height: height, alignment: .leading)
            }
        }
        .background {
            PieceLiquidGroup(lift: false) { Color.clear.pieceLiquid(.capsule, interactive: false) }
        }
        .frame(minHeight: 44)
        .contentShape(.rect)
        .highPriorityGesture(drag, including: isEnabled ? .all : .none)
        // A touch the system cancels (a scroll took over) never reaches onEnded: put the thumb back.
        .onChange(of: inGesture) { _, active in
            guard !active, touching else { return }
            touching = false
            dragging = false
            flow(to: isOn)
        }
    }

    // MARK: Interaction

    private var drag: some Gesture {
        let width = Self.width, inset = Self.inset, thumb = Self.thumb
        let start = isOn ? width - inset - thumb / 2 : inset + thumb / 2
        return DragGesture(minimumDistance: 0)
            .updating($inGesture) { _, inGesture, _ in inGesture = true }
            .onChanged { value in
                if !touching {
                    touching = true
                    let pressed = Self.rest(isOn, pressed: true)
                    withAnimation(PieceMotion(reduceMotion: reduceMotion).press) {
                        lower = pressed.lower
                        upper = pressed.upper
                    }
                }
                guard dragging || abs(value.translation.width) > 3 else { return }
                dragging = true
                // Directly under the finger, never through an animation, with a little give past either end.
                let center = PieceMotion.rubberBand(start + value.translation.width, in: (inset + thumb / 2)...(width - inset - thumb / 2), limit: 4)
                let half = (thumb + Self.swell) / 2
                quietly {
                    lower = center - half
                    upper = center + half
                }
            }
            .onEnded { value in
                defer { touching = false }
                guard dragging else {
                    if abs(value.translation.height) < 10 { flip(to: !isOn) }
                    else { flow(to: isOn) }
                    return
                }
                dragging = false
                // Land where the flick was heading, not just where the finger let go.
                let on = start + value.predictedEndTranslation.width > width / 2
                if on == isOn { flow(to: on, velocity: value.velocity.width) } else { flip(to: on) }
            }
    }

    private func flip(to on: Bool) {
        guard on != isOn else { return flow(to: on) }
        flips += 1
        isOn = on
    }

    /// Lands the thumb at rest for `on`. The edge facing the move leads on the tight spring and the far edge follows
    /// on the responsive one, so the thumb reaches across and gathers in with a little liquid give. A release passes
    /// the finger's speed to both. Under Reduce Motion both edges share one short spring and the thumb slides whole.
    private func flow(to on: Bool, velocity: CGFloat = 0) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let target = Self.rest(on, pressed: false)
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                lower = target.lower
                upper = target.upper
            }
            return
        }
        let forward = target.lower > lower
        withAnimation(motion.settle(velocity: velocity, from: upper, to: target.upper, spring: forward ? PieceMotion.tight : PieceMotion.responsive)) {
            upper = target.upper
        }
        withAnimation(motion.settle(velocity: velocity, from: lower, to: target.lower, spring: forward ? PieceMotion.responsive : PieceMotion.tight)) {
            lower = target.lower
        }
    }

    /// The thumb's edges at rest, swollen toward the middle while pressed.
    private static func rest(_ on: Bool, pressed: Bool) -> (lower: CGFloat, upper: CGFloat) {
        let grow = pressed ? swell : 0
        return on ? (width - inset - thumb - grow, width - inset) : (inset, inset + thumb + grow)
    }

    private func quietly(_ change: () -> Void) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction, change)
    }
}

/// One edge of the thumb, animated on its own: SwiftUI interpolates `value` frame by frame and rebuilds the content
/// with it. Two nested give the two edges separate springs; one shape holding both would animate them as one value.
private struct LiquidSwitchEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// A few settings rows, one with a symbol in its thumb.
private struct LiquidSwitchExample: View {
    @State private var assist = true
    @State private var dark = false
    @State private var receipts = true

    var body: some View {
        VStack(spacing: 20) {
            LiquidSwitch("Wi-Fi Assist", isOn: $assist)
            LiquidSwitch("Dark Appearance", isOn: $dark, symbol: "moon.fill")
            LiquidSwitch("Read Receipts", isOn: $receipts)
            LiquidSwitch("Location Services", isOn: .constant(false))
                .disabled(true)
        }
        .padding(24)
        .frame(maxWidth: 400)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LiquidSwitchStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    LiquidSwitchExample()
}

#Preview("Dark") {
    LiquidSwitchExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand)

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
// swiftpieces-liquid: 1.8.0 (liquid)

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
