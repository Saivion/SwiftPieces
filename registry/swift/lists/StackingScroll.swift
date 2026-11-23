// swiftpieces:
// title: Stacking Scroll
// description: "A list whose cards don't leave at the top edge: each one that scrolls up stops there and stacks under the next, a little smaller and a little higher, so the last few peek out like passes in a wallet before they fade. Scroll back and they lift off the stack in order. It runs on the scroll position alone, with no state, so it stays smooth for long lists. For passes, tickets, itineraries, inboxes and timelines."
// category: lists
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [scroll, stack, list, cards, deck, sticky, passes, tickets]

import SwiftUI

/// How rows stack in a `StackingScroll`.
public struct StackingScrollStyle: Sendable {
    /// Where rows stop, measured down from the top of the scroll view.
    public var top: CGFloat
    /// How much of each stacked row peeks out above the next.
    public var peek: CGFloat
    /// How much smaller each stacked row gets, per row deep.
    public var shrink: CGFloat
    /// How many rows stay visible in the stack before the deeper ones fade.
    public var depth: Int

    public init(top: CGFloat = 28, peek: CGFloat = 8, shrink: CGFloat = 0.05, depth: Int = 3) {
        self.top = top
        self.peek = peek
        self.shrink = shrink
        self.depth = max(1, depth)
    }

    public static let standard = StackingScrollStyle()
}

/// A vertical scroll view whose rows stack at the top edge instead of scrolling away.
///
/// Rows are laid out lazily, with `spacing` between them. Give each row its own background, such as a card, so
/// the rows under it are hidden. To stack rows in a scroll view of your own, use `.stackingRow()` on each row.
///
/// - Parameters:
///   - data: The rows' data.
///   - spacing: The gap between rows.
///   - style: Where and how the rows stack.
///   - row: One row.
public struct StackingScroll<Data: RandomAccessCollection, Row: View>: View where Data.Element: Identifiable {
    public typealias Style = StackingScrollStyle

    private let data: Data
    private let spacing: CGFloat
    private let style: Style
    private let row: (Data.Element) -> Row

    public init(_ data: Data, spacing: CGFloat = 10, style: Style = .standard, @ViewBuilder row: @escaping (Data.Element) -> Row) {
        self.data = data
        self.spacing = spacing
        self.style = style
        self.row = row
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: spacing) {
                ForEach(data) { item in
                    row(item)
                        .stackingRow(spacing: spacing, style: style)
                }
            }
            .padding(.top, style.top)
        }
    }
}

public extension View {
    /// Stops this row at the top of its scroll view and stacks it under the rows that follow.
    ///
    /// Use it on each row of a `ScrollView`'s `LazyVStack`, in order, so later rows draw over earlier ones.
    /// Under Reduce Motion the rows still stack, since they follow your finger rather than animate on their own.
    ///
    /// - Parameters:
    ///   - spacing: The stack's spacing, so a row knows how far it has gone past the top.
    ///   - style: Where and how the rows stack.
    func stackingRow(spacing: CGFloat = 10, style: StackingScrollStyle = .standard) -> some View {
        visualEffect { content, proxy in
            let place = StackingPlace(minY: proxy.frame(in: .scrollView).minY, height: proxy.size.height, spacing: spacing, style: style)
            return content
                .scaleEffect(place.scale, anchor: .top)
                .offset(y: place.offset)
                .opacity(place.opacity)
        }
    }
}

/// Where a row draws once it has scrolled `minY` points from the top of its scroll view.
private struct StackingPlace {
    let offset: CGFloat
    let scale: CGFloat
    let opacity: Double

    nonisolated init(minY: CGFloat, height: CGFloat, spacing: CGFloat, style: StackingScrollStyle) {
        let past = style.top - minY
        guard past > 0 else {
            offset = 0; scale = 1; opacity = 1
            return
        }
        // How many rows deep this row is in the stack, as a fraction.
        let deep = past / max(height + spacing, 1)
        let shown = min(deep, CGFloat(style.depth))
        offset = past - shown * style.peek
        scale = 1 - shown * style.shrink
        opacity = Double(min(max(CGFloat(style.depth) + 0.6 - deep, 0), 1))
    }
}

// MARK: - Example

private struct StackingScrollPass: Identifiable {
    let id: String
    let when: String
    let word: String
    let ground: Color
    let sun: Color
}

/// A trip's passes as print cards. Scroll up and they stack at the top like a wallet.
private struct StackingScrollExample: View {
    private static let blue = Color(red: 0.18, green: 0.545, blue: 1)
    private static let yellow = Color(red: 1, green: 0.761, blue: 0.102)
    private static let teal = Color(red: 0, green: 0.769, blue: 0.655)
    private static let pink = Color(red: 1, green: 0, blue: 0.361)
    private static let orange = Color(red: 1, green: 0.541, blue: 0.122)
    private static let red = Color(red: 1, green: 0, blue: 0)

    private let passes = [
        StackingScrollPass(id: "Ferry to Lake Ida", when: "Sat 9:00", word: "FERRY", ground: Self.blue, sun: Self.red),
        StackingScrollPass(id: "Lodge check-in", when: "Sat 15:00", word: "LODGE", ground: Self.teal, sun: Self.yellow),
        StackingScrollPass(id: "Kayak rental", when: "Sun 10:00", word: "KAYAK", ground: Self.yellow, sun: Self.pink),
        StackingScrollPass(id: "Trail permit", when: "Sun 13:00", word: "TRAIL", ground: Self.orange, sun: Self.blue),
        StackingScrollPass(id: "Harbor dinner", when: "Sun 19:30", word: "DINNER", ground: Self.pink, sun: Self.yellow),
        StackingScrollPass(id: "Ferry home", when: "Mon 8:00", word: "HOME", ground: Self.blue, sun: Self.yellow),
        StackingScrollPass(id: "Museum entry", when: "Mon 13:00", word: "MUSEUM", ground: Self.teal, sun: Self.pink),
        StackingScrollPass(id: "Train to town", when: "Mon 17:40", word: "TRAIN", ground: Self.orange, sun: Self.red),
    ]

    var body: some View {
        StackingScroll(passes, spacing: 12, style: StackingScrollStyle(top: 16, peek: 10, shrink: 0.05, depth: 3)) { pass in
            StackingScrollCard(pass: pass)
        }
        .contentMargins(.horizontal, 20, for: .scrollContent)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

/// One pass: a flat ground, one big disc and a giant word cropped by the edges, under a glass caption.
private struct StackingScrollCard: View {
    let pass: StackingScrollPass
    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)

    var body: some View {
        pass.ground
            .overlay(alignment: .topTrailing) {
                Circle()
                    .fill(pass.sun)
                    .frame(width: 150, height: 150)
                    .offset(x: 28, y: -54)
            }
            .overlay(alignment: .topLeading) {
                Text(pass.word)
                    .font(.system(size: 92, weight: .semibold))
                    .tracking(-4)
                    .foregroundStyle(ink)
                    .fixedSize()
                    .offset(x: -5, y: -16)
                    .accessibilityHidden(true)
            }
            .overlay(alignment: .bottom) {
                PieceLiquidGroup(lift: false) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pass.id).font(.headline.weight(.semibold))
                            Text(pass.when).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.body.weight(.semibold))
                            .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 60)
                    .pieceLiquid(RoundedRectangle(cornerRadius: 20, style: .continuous), interactive: false)
                }
                .padding(10)
            }
            .frame(height: 190)
            .clipShape(.rect(cornerRadius: 28, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
            .accessibilityElement(children: .combine)
    }
}

#Preview("Light") {
    StackingScrollExample()
}

#Preview("Dark") {
    StackingScrollExample()
        .preferredColorScheme(.dark)
}

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
