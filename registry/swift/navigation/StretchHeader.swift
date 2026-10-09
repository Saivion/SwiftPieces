// swiftpieces:
// title: Stretch Header
// description: "A hero header for your own ScrollView and NavigationStack: a semibold display title and uppercase eyebrow over a solid block hero that stretches on overscroll, a title that shrinks toward the real navigation bar, a row of liquid glass stat pills that pins under the bar, and a solid bar that fades in."
// category: navigation
// version: "2.2.0"
// pro: settings-screen
// minIOSVersion: "17.0"
// tags: [header, scroll, navigation, stretchy, parallax, hero]

import SwiftUI

/// Hero header placed at the top of scroll content, paired with `.stretchHeaderBar(title:progress:style:)` on the scroll view.
///
/// - Parameters:
///   - title: Large display title over the hero; the same string fades into the navigation bar as it collapses.
///   - height: Resting hero height in points.
///   - progress: Written by the header: 0 while expanded, 1 once collapsed behind the bar. Pass the same state to `.stretchHeaderBar`.
///   - eyebrow: Optional small uppercase label above the title, such as a place or a category. Defaults to none.
///   - style: Title ink, scrim, and surface colors. `.standard` suits solid block heroes; use `.overImage` for photos. Defaults to `.standard`.
///   - hero: Hero content, typically a solid color block or a resizable image. It is sized to fill the header.
///   - subtitle: Optional row under the hero (stats, avatar, tabs) that pins beneath the bar once the hero has scrolled away. `StretchHeaderStats` draws stats as liquid glass pills.
public struct StretchHeader<Hero: View, Subtitle: View>: View {
    /// Colors and type for the header and its bar. See `StretchHeaderStyle`.
    public typealias Style = StretchHeaderStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.stretchHeaderBarBottom) private var barBottom
    @Environment(\.stretchHeaderScrollY) private var scrollY
    @ScaledMetric(relativeTo: .largeTitle) private var titleScale: CGFloat = 1
    @Binding private var progress: CGFloat
    @State private var measuredMinY: CGFloat = 0

    private let title: String
    private let eyebrow: String?
    private let height: CGFloat
    private let style: Style
    private let hero: Hero
    private let subtitle: Subtitle

    public init(title: String, height: CGFloat = 280, progress: Binding<CGFloat>, eyebrow: String? = nil, style: Style = .standard, @ViewBuilder hero: () -> Hero, @ViewBuilder subtitle: () -> Subtitle = { EmptyView() }) {
        self.title = title
        self.eyebrow = eyebrow
        self.height = height
        self.style = style
        self._progress = progress
        self.hero = hero()
        self.subtitle = subtitle()
    }

    /// Header top relative to the scroll view's top: positive while stretching, negative once scrolled.
    private var minY: CGFloat { scrollY.map { -$0 } ?? measuredMinY }
    private var stretch: CGFloat { max(0, minY) }
    private var scrolled: CGFloat { max(0, -minY) }
    private var collapse: CGFloat { min(1, scrolled / max(1, height - barBottom)) }

    public var body: some View {
        VStack(spacing: 0) {
            heroLayer
                // Pinned at its bottom edge: an overscroll grows the hero upward and it stays joined to the row below.
                .frame(height: height, alignment: .bottom)
            subtitle
                .frame(maxWidth: .infinity)
                .background { style.surface }
                // Pins under the bar once the hero has scrolled behind it.
                .offset(y: max(0, barBottom - height - minY))
                .zIndex(1)
        }
        .fontWeight(.semibold)
        // iOS 17 path: measure the header inside the scroll view. On iOS 18 the bar modifier supplies scrollY instead.
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .scrollView).minY } action: { measuredMinY = $0 }
        .onChange(of: collapse, initial: true) { _, value in progress = value }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: stretch > 72) { _, new in new }
        // Last, so the pinned row draws above the content that follows the header.
        .zIndex(1)
    }

    private var heroLayer: some View {
        hero
            .frame(maxWidth: .infinity)
            .frame(height: height + stretch)
            .overlay(alignment: .bottomLeading) { heroTitle }
            // Lags the scroll slightly on the way out, inside its own slot, so it never hangs over the content below.
            .offset(y: reduceMotion ? 0 : scrolled * 0.3)
            .clipped()
            // Clipping only limits drawing: without this the lagged strip would still take taps meant for the content below.
            .contentShape(Rectangle())
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityHidden(collapse > 0.9)
    }

    private var heroTitle: some View {
        ZStack(alignment: .bottomLeading) {
            if style.scrim > 0 {
                LinearGradient(colors: [.clear, .black.opacity(style.scrim)], startPoint: .center, endPoint: .bottom)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                if let eyebrow {
                    Text(eyebrow.uppercased())
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(1.4)
                        // Fades while the title below it sinks, so it is all but gone once it stands alone. Under Reduce Motion nothing
                        // sinks, and this fade is what leaves the title to hand over to the bar.
                        .opacity(0.72 * Double(1 - ramp(collapse, from: 0.2, to: 0.5)))
                }
                Text(title)
                    .font(.system(size: style.titleSize * titleScale, weight: .semibold))
                    .tracking(-style.titleSize * 0.03)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    // A pull reads as tension: the title grows with the stretch, quickly at first and then easing
                    // toward 12%, the way the scroll view's own edge resists, instead of stopping dead at a cap.
                    .scaleEffect(reduceMotion ? 1 : 1 + 0.12 * stretch / (stretch + 70), anchor: .bottomLeading)
            }
            .foregroundStyle(style.titleColor)
            .padding(.horizontal, 24)
            .padding(.bottom, 22)
            .scaleEffect(1 - 0.3 * collapse, anchor: .bottomLeading)
            // Moves up slower than the hero, so it sinks behind the hero's lower edge (or the pinned row) as the
            // header leaves. The fade carries the hand-off when the title is tall enough to outlast the sink, or
            // under Reduce Motion, where it rides up with the hero.
            .offset(y: reduceMotion ? 0 : scrolled * 0.45)
            .opacity(Double(1 - ramp(collapse, from: 0.5, to: 0.85)))
        }
    }
}

/// Colors and type for the header and its bar.
public struct StretchHeaderStyle: Sendable {
    /// Title and eyebrow color over the hero.
    public var titleColor: Color
    /// Strength of the dark scrim under the title, 0 for none.
    public var scrim: Double
    /// Ground behind the pinned subtitle row and the collapsed bar.
    public var surface: Color
    /// Resting title size in points; it scales with Dynamic Type.
    public var titleSize: CGFloat

    public init(titleColor: Color, scrim: Double = 0, surface: Color = StretchHeaderStyle.ground, titleSize: CGFloat = 40) {
        self.titleColor = titleColor
        self.scrim = scrim
        self.surface = surface
        self.titleSize = titleSize
    }

    /// House default: ink title with no scrim, for solid block heroes.
    public static let standard = StretchHeaderStyle(titleColor: StretchHeaderStyle.adaptive(0x141414, 0x141414))
    /// White title over a soft scrim, for photos and busy heroes.
    public static let overImage = StretchHeaderStyle(titleColor: .white, scrim: 0.5)

    /// House ground: paper in light, charcoal in dark.
    public static let ground = StretchHeaderStyle.adaptive(0xF3F2EE, 0x121212)

    /// Text on clear glass follows the appearance: dark ink in light mode, near white in dark.
    fileprivate static let ink = StretchHeaderStyle.adaptive(0x141414, 0xF4F3EF)

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A row of stats on liquid glass pills, for the header's `subtitle`: `StretchHeaderStats(["5.4 mi", "1,000 ft up"])`.
///
/// Each stat is its own glass pill, resting apart from the next, and the row pins under the bar with the rest of the
/// subtitle. Two or three short stats fit a phone; a long one shrinks a little before it truncates.
///
/// - Parameters:
///   - stats: The stats in order, each a short phrase such as a distance or a duration.
public struct StretchHeaderStats: View {
    private let stats: [String]

    public init(_ stats: [String]) {
        self.stats = stats
    }

    public var body: some View {
        // No lift: the pills sit on the row's solid band, and a floating shadow would spill past it onto the content
        // scrolling under the pinned row.
        PieceLiquidGroup(lift: false) {
            HStack(spacing: PieceLiquid.apart) {
                ForEach(Array(stats.enumerated()), id: \.offset) { _, stat in
                    Text(stat)
                        .font(.footnote.weight(.semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(StretchHeaderStyle.ink)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 34)
                        // Stats are read, not pressed, so the glass never swells under a touch.
                        .pieceLiquid(.capsule, interactive: false)
                }
            }
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
    }
}

/// Bar-side companion: hides the system bar background, fades in a solid one from `progress`, and shows the inline title.
///
/// - Parameters:
///   - title: Navigation title; shown inline with an opacity driven by `progress`.
///   - progress: The value written by `StretchHeader`.
///   - style: The same style passed to the header, so the bar matches the pinned row. Defaults to `.standard`.
public extension View {
    func stretchHeaderBar(title: String, progress: CGFloat, style: StretchHeaderStyle = .standard) -> some View {
        modifier(StretchHeaderBar(title: title, progress: progress, surface: style.surface))
    }
}

private struct StretchHeaderBar: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scrollY: CGFloat? = nil
    let title: String
    let progress: CGFloat
    let surface: Color

    private var inline: Double { Double(ramp(progress, from: 0.8, to: 1)) }

    func body(content: Content) -> some View {
        GeometryReader { proxy in
            let barBottom = proxy.safeAreaInsets.top
            scrollSource(content)
                .environment(\.stretchHeaderBarBottom, barBottom)
                .environment(\.stretchHeaderScrollY, scrollY)
                .ignoresSafeArea(edges: .top)
                .overlay(alignment: .top) {
                    // Our own solid bar, so it can fade instead of flipping on. A soft shadow replaces the hairline.
                    Rectangle()
                        .fill(surface)
                        .frame(height: barBottom)
                        .shadow(color: .black.opacity(0.12 * inline), radius: 12, y: 4)
                        // Eased, so the bar turns solid gently as the pinned row arrives instead of on a corner.
                        .opacity(Double(ramp(progress, from: 0, to: 1)))
                        .ignoresSafeArea(edges: .top)
                        .allowsHitTesting(false)
                }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .opacity(inline)
                    .offset(y: reduceMotion ? 0 : (1 - inline) * 6)
                    .accessibilityHidden(inline < 0.5)
            }
        }
    }

    @ViewBuilder
    private func scrollSource(_ content: Content) -> some View {
        if #available(iOS 18, *) {
            content
                .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in scrollY = y }
                .modifier(OwnBarEdge())
        } else {
            content
        }
    }
}

/// iOS 26 softens scroll content under the navigation bar even with its background hidden, which would haze the top
/// of the hero. The header draws its own bar, so the system edge goes.
private struct OwnBarEdge: ViewModifier {
    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *) {
            content.scrollEdgeEffectHidden(true, for: .top)
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// 0 below `lower`, 1 above `upper`, and a smoothstep between: every scroll-linked fade eases into and out of its
/// window, so it never starts or stops on a corner while the finger is still moving.
nonisolated private func ramp(_ value: CGFloat, from lower: CGFloat, to upper: CGFloat) -> CGFloat {
    let t = min(max((value - lower) / (upper - lower), 0), 1)
    return t * t * (3 - 2 * t)
}

private struct StretchHeaderBarBottomKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct StretchHeaderScrollYKey: EnvironmentKey {
    static let defaultValue: CGFloat? = nil
}

private extension EnvironmentValues {
    var stretchHeaderBarBottom: CGFloat {
        get { self[StretchHeaderBarBottomKey.self] }
        set { self[StretchHeaderBarBottomKey.self] = newValue }
    }
    var stretchHeaderScrollY: CGFloat? {
        get { self[StretchHeaderScrollYKey.self] }
        set { self[StretchHeaderScrollYKey.self] = newValue }
    }
}

// MARK: - Example

private struct StretchHeaderExample: View {
    @State private var progress: CGFloat = 0
    private let sage = StretchHeaderStyle.adaptive(0xA9DCB7, 0xA9DCB7)
    private let butter = StretchHeaderStyle.adaptive(0xFFD976, 0xFFD976)
    private let placeholder = StretchHeaderStyle.adaptive(0xFFFFFF, 0x1C1C1C)

    var body: some View {
        NavigationStack {
            ScrollView {
                StretchHeader(title: "Mist Trail", height: 300, progress: $progress, eyebrow: "Yosemite · Hike 04") {
                    ZStack(alignment: .topTrailing) {
                        sage
                        Circle().fill(butter).frame(width: 190).offset(x: 50, y: -40)
                    }
                } subtitle: {
                    // The pinning row: the hike's stats on glass pills that stay under the bar.
                    StretchHeaderStats(["5.4 mi", "1,000 ft up", "3.5 hours"])
                }
                // Plain placeholder content, only so there is something to scroll.
                VStack(spacing: 12) {
                    ForEach(0..<8, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(placeholder)
                            .frame(height: 64)
                    }
                }
                .padding(20)
                .accessibilityHidden(true)
            }
            .background(StretchHeaderStyle.ground)
            .stretchHeaderBar(title: "Mist Trail", progress: progress)
        }
    }
}

#Preview("Light") {
    StretchHeaderExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    StretchHeaderExample().preferredColorScheme(.dark)
}

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
