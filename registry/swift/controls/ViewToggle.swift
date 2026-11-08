// swiftpieces:
// title: View Toggle
// description: "A list and grid toggle in glass. The red pill flows to the layout you tap, and the change happens inside an animation, so items you mark with matchedGeometryEffect in a shared namespace morph between rows and tiles instead of cutting. For photo libraries, shops, files and any collection with two views. VoiceOver reads it as a picker with the current layout."
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [layout, list, grid, toggle, matched-geometry, glass, haptics]

import SwiftUI

/// The two layouts `ViewToggle` switches between.
public enum ViewToggleLayout: String, CaseIterable, Hashable, Sendable {
    case list
    case grid

    /// The SF Symbol for the layout.
    public var systemImage: String {
        switch self {
        case .list: "list.bullet"
        case .grid: "square.grid.2x2"
        }
    }

    /// The name VoiceOver reads.
    public var title: String {
        switch self {
        case .list: "List"
        case .grid: "Grid"
        }
    }
}

/// Colors for `ViewToggle`. `.standard` is the house palette.
public struct ViewToggleStyle: Sendable {
    /// The pill on the chosen layout.
    public var accent: Color
    /// The chosen layout's symbol.
    public var onAccent: Color
    /// The other symbol.
    public var label: Color

    public init(
        accent: Color = Color(red: 1, green: 0, blue: 0),
        onAccent: Color = ViewToggleStyle.adaptive(light: 0x141414, dark: 0x141414),
        label: Color = ViewToggleStyle.adaptive(light: 0x141414, dark: 0xF4F3EF)
    ) {
        self.accent = accent
        self.onAccent = onAccent
        self.label = label
    }

    public static let standard = ViewToggleStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A glass list/grid toggle whose change animates, so matched items morph between layouts.
///
/// Mark each item with `.matchedGeometryEffect(id: item.id, in: namespace)` in both layouts, using one `@Namespace`,
/// and switch layouts on `layout`. The toggle sets `layout` inside `animation`, so the items move with the pill.
///
/// - Parameters:
///   - layout: The current layout.
///   - animation: The animation the layout changes in. Defaults to the morph spring.
///   - style: Colors. Defaults to the house palette, adapting to light and dark.
public struct ViewToggle: View {
    public typealias Style = ViewToggleStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var cell: CGFloat = 40
    @Binding private var layout: ViewToggleLayout
    @State private var lower: CGFloat
    @State private var upper: CGFloat
    @State private var picks = 0

    private let animation: Animation?
    private let style: Style
    private let options = ViewToggleLayout.allCases
    private let gap: CGFloat = 2
    private let inset: CGFloat = 4

    public init(layout: Binding<ViewToggleLayout>, animation: Animation? = nil, style: Style = .standard) {
        self._layout = layout
        self.animation = animation
        self.style = style
        let index = CGFloat(ViewToggleLayout.allCases.firstIndex(of: layout.wrappedValue) ?? 0)
        self._lower = State(initialValue: index)
        self._upper = State(initialValue: index + 1)
    }

    private var width: CGFloat { cell * 1.25 }

    public var body: some View {
        HStack(spacing: gap) {
            ForEach(options, id: \.self) { option in
                let chosen = option == layout
                Button { pick(option) } label: {
                    Image(systemName: option.systemImage)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(chosen ? style.onAccent : style.label)
                        .animation(.easeOut(duration: 0.2), value: chosen)
                        .frame(width: width, height: cell)
                        .contentShape(.rect)
                }
                .buttonStyle(PiecePressStyle(depth: 1.5))
                .accessibilityLabel(option.title)
                .accessibilityAddTraits(chosen ? .isSelected : [])
            }
        }
        .background(alignment: .leading) { pill }
        .padding(inset)
        .background { PieceLiquidGroup { Color.clear.pieceLiquid(RoundedRectangle(cornerRadius: (cell + inset * 2) * 0.42, style: .continuous), interactive: false) } }
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: picks)
        .onChange(of: layout) { _, new in
            guard let index = options.firstIndex(of: new) else { return }
            flow(to: index)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Layout")
    }

    private var pill: some View {
        let pitch = width + gap
        return ViewToggleEdge(value: lower) { lower in
            ViewToggleEdge(value: upper) { upper in
                RoundedRectangle(cornerRadius: cell * 0.42, style: .continuous)
                    .fill(style.accent)
                    .frame(width: max((upper - lower) * pitch - gap, width * 0.6), height: cell)
                    .offset(x: lower * pitch)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func pick(_ option: ViewToggleLayout) {
        guard option != layout else { return }
        picks += 1
        withAnimation(animation ?? PieceMotion(reduceMotion: reduceMotion).morph) { layout = option }
    }

    /// The edge facing the new layout leads on the tight spring and the far edge follows on the responsive one.
    private func flow(to index: Int) {
        let newLower = CGFloat(index), newUpper = newLower + 1
        guard !reduceMotion else {
            withAnimation(PieceMotion(reduceMotion: true).snap) {
                lower = newLower
                upper = newUpper
            }
            return
        }
        let forward = newLower > lower
        withAnimation(.spring(forward ? PieceMotion.tight : PieceMotion.responsive)) { upper = newUpper }
        withAnimation(.spring(forward ? PieceMotion.responsive : PieceMotion.tight)) { lower = newLower }
    }
}

/// One edge of the pill, animated on its own: two nested give the two edges separate springs.
private struct ViewToggleEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

private struct ViewToggleExamplePhoto: Identifiable {
    let id: Int
    let name: String
    let color: Color
}

/// Four photos that morph between rows and tiles.
private struct ViewToggleExample: View {
    @State private var layout = ViewToggleLayout.list
    @Namespace private var namespace

    private let photos = [
        ViewToggleExamplePhoto(id: 0, name: "Harbour", color: Color(red: 0.612, green: 0.761, blue: 1)),
        ViewToggleExamplePhoto(id: 1, name: "Lemons", color: Color(red: 1, green: 0.851, blue: 0.463)),
        ViewToggleExamplePhoto(id: 2, name: "Fern", color: Color(red: 0.663, green: 0.863, blue: 0.718)),
        ViewToggleExamplePhoto(id: 3, name: "Dusk", color: Color(red: 0.804, green: 0.722, blue: 1)),
    ]

    var body: some View {
        VStack(spacing: 24) {
            ViewToggle(layout: $layout)
            Group {
                if layout == .list {
                    VStack(spacing: 10) {
                        ForEach(photos) { photo in
                            HStack(spacing: 12) {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(photo.color)
                                    .matchedGeometryEffect(id: photo.id, in: namespace)
                                    .frame(width: 44, height: 44)
                                Text(photo.name)
                                Spacer()
                            }
                        }
                    }
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(photos) { photo in
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(photo.color)
                                .matchedGeometryEffect(id: photo.id, in: namespace)
                                .frame(height: 96)
                        }
                    }
                }
            }
            .frame(width: 250, height: 220, alignment: .top)
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ViewToggleStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    ViewToggleExample()
}

#Preview("Dark") {
    ViewToggleExample()
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
