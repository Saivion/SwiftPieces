// swiftpieces:
// title: Select Menu
// description: "A glass pill that shows the current choice and opens in place into its list of options. The red row flows to the option you tap, the check follows it, and the glass closes back into the pill with the new value. For sort orders, currencies, units and any short list of choices. Opening, flowing and closing each have their own spring, VoiceOver reads it as a pop-up button with its value, and under Reduce Motion it fades."
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [select, menu, picker, dropdown, sort, glass, haptics]

import SwiftUI

/// Colors for `SelectMenu`. `.standard` is the house palette.
public struct SelectMenuStyle: Sendable {
    /// The selected row's fill.
    public var accent: Color
    /// Text and check on the selected row.
    public var onAccent: Color
    /// The value in the pill and the option titles.
    public var label: Color
    /// The title above the pill and the chevron.
    public var secondaryLabel: Color
    /// The hairline between the pill's value and the list.
    public var divider: Color

    public init(
        accent: Color = Color(red: 1, green: 0, blue: 0),
        onAccent: Color = SelectMenuStyle.adaptive(light: 0x141414, dark: 0x141414),
        label: Color = SelectMenuStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        secondaryLabel: Color = SelectMenuStyle.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
        divider: Color = SelectMenuStyle.adaptive(light: 0xE2E0DB, dark: 0x2E2E2E)
    ) {
        self.accent = accent
        self.onAccent = onAccent
        self.label = label
        self.secondaryLabel = secondaryLabel
        self.divider = divider
    }

    public static let standard = SelectMenuStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A glass pill showing the current choice that opens in place into its list.
///
/// The pill keeps its own height in your layout and the list opens over what is below it, so give the menu a higher
/// `zIndex` than the views after it if they draw on top.
///
/// - Parameters:
///   - title: The name of the choice, shown above the pill and read by VoiceOver.
///   - selection: The chosen option.
///   - options: The options, in order.
///   - style: Colors. Defaults to the house palette, adapting to light and dark.
///   - label: The text for an option. Defaults to its description.
public struct SelectMenu<Option: Hashable>: View {
    public typealias Style = SelectMenuStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var rowHeight: CGFloat = 46
    @Binding private var selection: Option
    @State private var isOpen = false
    /// The value the closed pill shows. It changes once the glass has closed, so the new value lands in the pill.
    @State private var shown: Option
    @State private var picks = 0
    @State private var closing: Task<Void, Never>?
    @Namespace private var namespace

    private let title: String
    private let options: [Option]
    private let style: Style
    private let label: (Option) -> String

    public init(_ title: String, selection: Binding<Option>, options: [Option], style: Style = .standard, label: @escaping (Option) -> String = { String(describing: $0) }) {
        self.title = title
        self._selection = selection
        self.options = options
        self.style = style
        self.label = label
        self._shown = State(initialValue: selection.wrappedValue)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(style.secondaryLabel)
                .accessibilityHidden(true)
            // The pill's own height stays in the layout; the open list grows over what is below.
            Color.clear
                .frame(height: rowHeight)
                .overlay(alignment: .top) { panel }
                .zIndex(1)
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: picks)
        .onChange(of: selection) { _, new in
            guard !isOpen, new != shown else { return }
            withAnimation(PieceMotion(reduceMotion: reduceMotion).value) { shown = new }
        }
    }

    private var radius: CGFloat { rowHeight / 2 }

    private var panel: some View {
        let shape = RoundedRectangle(cornerRadius: isOpen ? radius - 1 : radius, style: .continuous)
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return VStack(spacing: 0) {
            header(motion)
            if isOpen {
                Rectangle()
                    .fill(style.divider)
                    .frame(height: 1)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 4)
                    .transition(.opacity)
                VStack(spacing: 0) {
                    ForEach(options, id: \.self) { option in
                        row(option)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.bottom, 6)
                .transition(.opacity.animation(motion.reveal.delay(reduceMotion ? 0 : 0.08)))
            }
        }
        .clipShape(shape)
        .background { PieceLiquidGroup { Color.clear.pieceLiquid(shape, interactive: false) } }
    }

    private func header(_ motion: PieceMotion) -> some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                Text(label(shown))
                    .foregroundStyle(style.label)
                    .lineLimit(1)
                    .id(shown)
                    .transition(motion.swap)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(style.secondaryLabel)
                    .rotationEffect(.degrees(isOpen ? 180 : 0))
            }
            .padding(.horizontal, 18)
            .frame(height: rowHeight)
            .contentShape(.rect)
        }
        .buttonStyle(PiecePressStyle(depth: 1.5))
        .accessibilityLabel(title)
        .accessibilityValue(label(shown))
        .accessibilityHint(isOpen ? "Closes the options" : "Opens the options")
        .accessibilityAddTraits(.isButton)
    }

    private func row(_ option: Option) -> some View {
        let chosen = option == selection
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return Button { pick(option) } label: {
            HStack(spacing: 10) {
                Text(label(option))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "checkmark")
                    .font(.footnote.weight(.semibold))
                    .opacity(chosen ? 1 : 0)
                    .scaleEffect(chosen ? 1 : 0.4)
                    .animation(motion.success, value: chosen)
            }
            .foregroundStyle(chosen ? style.onAccent : style.label)
            .padding(.horizontal, 14)
            .frame(height: rowHeight - 6)
            .background {
                if chosen {
                    RoundedRectangle(cornerRadius: (rowHeight - 6) / 2, style: .continuous)
                        .fill(style.accent)
                        .matchedGeometryEffect(id: "selection", in: namespace)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(PiecePressStyle(depth: 1.5))
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    // MARK: Actions

    private func toggle() {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        closing?.cancel()
        if isOpen {
            withAnimation(motion.dismiss) { isOpen = false }
            withAnimation(motion.value) { shown = selection }
        } else {
            withAnimation(motion.reveal) { isOpen = true }
        }
    }

    /// The red flows to the pick at once; the glass closes a beat later, so the flow reads before it folds away.
    private func pick(_ option: Option) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        if option != selection {
            picks += 1
            withAnimation(motion.snap) { selection = option }
        }
        closing?.cancel()
        closing = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 120 : 420))
            guard !Task.isCancelled else { return }
            withAnimation(motion.dismiss) { isOpen = false }
            try? await Task.sleep(for: .milliseconds(140))
            guard !Task.isCancelled else { return }
            withAnimation(motion.value) { shown = selection }
        }
    }
}

// MARK: - Example

private enum SelectMenuSort: String, CaseIterable {
    case newest = "Newest first"
    case oldest = "Oldest first"
    case priceUp = "Price, low to high"
    case priceDown = "Price, high to low"
}

/// A sort order over a short list it orders.
private struct SelectMenuExample: View {
    @State private var sort = SelectMenuSort.newest

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SelectMenu("Sort by", selection: $sort, options: SelectMenuSort.allCases) { $0.rawValue }
                .zIndex(1)
            Text("Showing \(sort.rawValue.lowercased())")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(width: 260)
        .padding(.top, 120)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SelectMenuStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    SelectMenuExample()
}

#Preview("Dark") {
    SelectMenuExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press, pressStyle)

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

/// Only the press, centered: for chips, rows and tiles, and anything in scrolling content.
private struct PiecePressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.piecePress(configuration.isPressed, depth: depth)
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
