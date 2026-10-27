// swiftpieces:
// title: Choice Group
// description: "Radio and checkbox lists in one piece, as rows on a liquid glass card. In a single choice the selection is one red drop that flows from ring to ring: it stretches toward the row you tap, its leading edge first, and gathers into the ring. In a multiple choice each box floods red and draws its check in ink with a small pop. Each row takes a title and an optional detail on the trailing side, the whole row is the tap target, and VoiceOver reads it as a selected or unselected button."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [radio, checkbox, picker, form, selection, haptics]

import SwiftUI

/// Colors and type for `ChoiceGroup`. `.standard` is the house palette: the brand red on a neutral glass card.
public struct ChoiceGroupStyle: Sendable {
    /// The selection: the radio drop and ring, and checked boxes.
    public var accent: Color
    /// The check drawn on a checked box.
    public var check: Color
    /// Unselected rings and boxes.
    public var control: Color
    /// Row titles.
    public var label: Color
    /// Row details, and the group's title above the card.
    public var secondaryLabel: Color
    /// The hairlines between rows.
    public var divider: Color
    /// The fill under a row while it is pressed.
    public var pressed: Color
    /// The card's corner radius.
    public var cornerRadius: CGFloat

    public init(
        accent: Color = ChoiceGroupStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        check: Color = ChoiceGroupStyle.adaptive(light: 0x141414, dark: 0x141414),
        control: Color = ChoiceGroupStyle.adaptive(light: 0xC9C7C1, dark: 0x4A4A48),
        label: Color = ChoiceGroupStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        secondaryLabel: Color = ChoiceGroupStyle.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
        divider: Color = ChoiceGroupStyle.adaptive(light: 0xE4E2DD, dark: 0x343434),
        pressed: Color = ChoiceGroupStyle.adaptive(light: 0xECEBE7, dark: 0x2C2C2C),
        cornerRadius: CGFloat = 22
    ) {
        self.accent = accent
        self.check = check
        self.control = control
        self.label = label
        self.secondaryLabel = secondaryLabel
        self.divider = divider
        self.pressed = pressed
        self.cornerRadius = cornerRadius
    }

    public static let standard = ChoiceGroupStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A list of options as rows on a glass card: radio buttons when bound to one value, checkboxes when bound to a set.
///
/// - Parameters:
///   - title: An optional heading above the card, such as `"Delivery"`. VoiceOver reads it as the group's label.
///   - options: The rows, in order.
///   - selection: The chosen option for a single choice, or the set of checked options for a multiple choice.
///   - label: Each row's title.
///   - detail: An optional trailing detail for a row, such as a price or a date. Return `nil` for none.
///   - style: Colors and corner radius. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct ChoiceGroup<Option: Hashable>: View {
    public typealias Style = ChoiceGroupStyle

    private enum Binder {
        case single(Binding<Option>)
        case multiple(Binding<Set<Option>>)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    /// Each row's vertical center in the card, measured, so the drop lines up with rows of any height.
    @State private var centers: [Int: CGFloat] = [:]
    /// The drop's top and bottom, in points down the card. Each is sprung on its own, so they can lead and trail.
    @State private var top: CGFloat = 0
    @State private var bottom: CGFloat = 0
    @State private var placed = false
    @State private var picks = 0
    @State private var pops: [Option: Int] = [:]

    private let title: String?
    private let options: [Option]
    private let binder: Binder
    private let label: (Option) -> String
    private let detail: ((Option) -> String?)?
    private let style: Style

    private let ring: CGFloat = 22
    private let drop: CGFloat = 10
    private let rowPadding: CGFloat = 16

    /// A single choice: one red drop flows between the rings.
    public init(_ title: String? = nil, options: [Option], selection: Binding<Option>, style: Style = .standard, label: @escaping (Option) -> String, detail: ((Option) -> String?)? = nil) {
        self.title = title
        self.options = options
        self.binder = .single(selection)
        self.label = label
        self.detail = detail
        self.style = style
    }

    /// A multiple choice: each box checks on its own.
    public init(_ title: String? = nil, options: [Option], selection: Binding<Set<Option>>, style: Style = .standard, label: @escaping (Option) -> String, detail: ((Option) -> String?)? = nil) {
        self.title = title
        self.options = options
        self.binder = .multiple(selection)
        self.label = label
        self.detail = detail
        self.style = style
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title {
                Text(title)
                    .font(.footnote)
                    .foregroundStyle(style.secondaryLabel)
                    .padding(.leading, rowPadding)
                    .accessibilityHidden(true)
            }
            card
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: picks)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title ?? "")
    }

    private var card: some View {
        VStack(spacing: 0) {
            ForEach(Array(options.enumerated()), id: \.element) { index, option in
                if index > 0 {
                    Rectangle().fill(style.divider).frame(height: 1).padding(.horizontal, rowPadding)
                }
                row(option, index: index)
            }
        }
        .coordinateSpace(.named("ChoiceGroup.card"))
        .overlay(alignment: .topTrailing) { radioDrop }
        .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
        .background {
            PieceLiquidGroup {
                Color.clear.pieceLiquid(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous), interactive: false)
            }
        }
        .onChange(of: selectedIndex) { _, index in flow(to: index) }
    }

    private func row(_ option: Option, index: Int) -> some View {
        let selected = isSelected(option)
        return Button { toggle(option) } label: {
            HStack(spacing: 12) {
                Text(label(option))
                    .foregroundStyle(style.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let detail = detail?(option) {
                    Text(detail)
                        .foregroundStyle(style.secondaryLabel)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                }
                mark(option, selected: selected)
            }
            .padding(.horizontal, rowPadding)
            .padding(.vertical, 12)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(ChoiceGroupRowStyle(pressed: style.pressed))
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named("ChoiceGroup.card")).midY } action: { center in
            centers[index] = center
            if !placed, index == selectedIndex { place(at: center) }
        }
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityValue(isMultiple ? (selected ? "Checked" : "Unchecked") : "")
    }

    @ViewBuilder private func mark(_ option: Option, selected: Bool) -> some View {
        if isMultiple {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .strokeBorder(style.control, lineWidth: 2)
                    .opacity(selected ? 0 : 1)
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(style.accent)
                    .opacity(selected ? 1 : 0)
                ChoiceGroupCheck()
                    .trim(from: 0, to: selected ? 1 : 0)
                    .stroke(style.check, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                    .padding(6)
            }
            .frame(width: ring, height: ring)
            .piecePop(trigger: pops[option, default: 0])
            .animation(PieceMotion(reduceMotion: reduceMotion).success, value: selected)
        } else {
            Circle()
                .strokeBorder(selected ? style.accent : style.control, lineWidth: 2)
                .frame(width: ring, height: ring)
                .animation(PieceMotion(reduceMotion: reduceMotion).snap, value: selected)
        }
    }

    /// The single choice's drop, drawn over the rings so it can travel between them.
    @ViewBuilder private var radioDrop: some View {
        if !isMultiple {
            ChoiceGroupEdge(value: top) { top in
                ChoiceGroupEdge(value: bottom) { bottom in
                    Capsule()
                        .fill(style.accent)
                        .frame(width: drop, height: max(bottom - top, drop * 0.6))
                        .offset(x: -(rowPadding + (ring - drop) / 2), y: top)
                }
            }
            .opacity(placed ? 1 : 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    // MARK: Selection

    private var isMultiple: Bool {
        if case .multiple = binder { return true }
        return false
    }

    private var selectedIndex: Int? {
        guard case .single(let selection) = binder else { return nil }
        return options.firstIndex(of: selection.wrappedValue)
    }

    private func isSelected(_ option: Option) -> Bool {
        switch binder {
        case .single(let selection): return selection.wrappedValue == option
        case .multiple(let selection): return selection.wrappedValue.contains(option)
        }
    }

    private func toggle(_ option: Option) {
        switch binder {
        case .single(let selection):
            guard selection.wrappedValue != option else { return }
            picks += 1
            selection.wrappedValue = option
        case .multiple(let selection):
            picks += 1
            if selection.wrappedValue.contains(option) {
                selection.wrappedValue.remove(option)
            } else {
                selection.wrappedValue.insert(option)
                pops[option, default: 0] += 1
            }
        }
    }

    /// Puts the drop on a ring with no motion: the first layout.
    private func place(at center: CGFloat) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            top = center - drop / 2
            bottom = center + drop / 2
            placed = true
        }
    }

    /// Moves the drop to the ring of row `index`. The end facing the move leads on the tight spring and the far end
    /// follows on the responsive one, so the drop stretches toward the row and gathers into its ring. Under Reduce
    /// Motion both ends share one short spring and the drop slides whole.
    private func flow(to index: Int?) {
        guard let index, let center = centers[index] else { return }
        guard placed else { return place(at: center) }
        let newTop = center - drop / 2, newBottom = center + drop / 2
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                top = newTop
                bottom = newBottom
            }
            return
        }
        let down = newTop > top
        withAnimation(.spring(down ? PieceMotion.tight : PieceMotion.responsive)) { bottom = newBottom }
        withAnimation(.spring(down ? PieceMotion.responsive : PieceMotion.tight)) { top = newTop }
    }
}

/// A row shaded while pressed, the way a list row is: rows sit inside the card, so they don't sink.
private struct ChoiceGroupRowStyle: ButtonStyle {
    var pressed: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(pressed.opacity(configuration.isPressed ? 1 : 0))
            .animation(configuration.isPressed ? .spring(PieceMotion.tight) : .easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

/// A check mark drawn from its short stroke to its long one, so `trim` draws it on.
private struct ChoiceGroupCheck: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY + rect.height * 0.04))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.36, y: rect.maxY - rect.height * 0.08))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.1))
        return path
    }
}

/// One end of the drop, animated on its own: two nested give the two ends separate springs.
private struct ChoiceGroupEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// A delivery choice and its extras, the way a checkout shows them.
private struct ChoiceGroupExample: View {
    enum Speed: String, CaseIterable { case standard, express, pickup }
    @State private var speed: Speed = .standard
    @State private var extras: Set<String> = ["Leave at door"]

    var body: some View {
        VStack(spacing: 24) {
            ChoiceGroup("Delivery", options: Speed.allCases, selection: $speed) {
                $0.rawValue.capitalized
            } detail: {
                switch $0 {
                case .standard: return "3–5 days"
                case .express: return "Tomorrow"
                case .pickup: return "Today"
                }
            }
            ChoiceGroup("Extras", options: ["Gift wrap", "Leave at door"], selection: $extras, label: { $0 }) {
                $0 == "Gift wrap" ? "+$3" : nil
            }
        }
        .padding(24)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ChoiceGroupStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    ChoiceGroupExample()
}

#Preview("Dark") {
    ChoiceGroupExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pop)

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
