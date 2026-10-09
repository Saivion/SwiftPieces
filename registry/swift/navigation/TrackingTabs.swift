// swiftpieces:
// title: Tracking Tabs
// description: Tabs on a liquid glass track over a paging ScrollView. The indicator is a signal-tinted glass capsule in the same liquid as the track, riding the pages through fractional scroll progress and swelling a little while it travels, with title ink that turns exactly under its edge, optional counts, a pressed state that sinks it with the selected title, and a selection tick each time the page changes.
// category: navigation
// version: "2.2.0"
// pro: lens-tab-bar
// minIOSVersion: "17.0"
// tags: [tabs, pager, segmented, scroll, navigation, counts]

import SwiftUI

/// Tab bar on a liquid glass track with a scroll-linked, tinted glass indicator driving horizontally paged content.
///
/// The track and the indicator are one liquid control: the indicator is a tinted glass capsule resting inside the clear
/// glass track, in the same liquid group, and the titles sit on both.
///
/// - Parameters:
///   - titles: One title per page, in order.
///   - selection: Index of the settled page. Tapping a title and swiping the pages both update it.
///   - counts: Optional count per page shown after its title, such as open tasks. Pass an empty array to hide counts. Defaults to none.
///   - style: Indicator and title colors. Defaults to `.standard`, the house palette with a signal indicator.
///   - page: Builds the page for a given index. Pages fill the container width.
public struct TrackingTabs<Page: View>: View {
    /// Colors for the track, indicator, and titles. See `TrackingTabsStyle`.
    public typealias Style = TrackingTabsStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var selection: Int
    @State private var position: Int? = nil
    @State private var progress: CGFloat = 0
    @State private var frames: [Int: CGRect] = [:]
    @State private var pageWidth: CGFloat = 1
    /// Each page's natural height, so the pager takes the selected page's height, not the first one's.
    @State private var heights: [Int: CGFloat] = [:]
    /// The selected title is held down, so the block sinks with it.
    @State private var blockPressed = false
    /// The titles a tap or an outside change carries the block across, until it lands.
    @State private var trip: ClosedRange<Int>? = nil
    /// Counts the trips that came in to land, each of which carries the block a little past its title.
    @State private var landing = 0
    /// Which way the last trip came in: 1 toward later titles, -1 toward earlier ones.
    @State private var heading: CGFloat = 1

    private let titles: [String]
    private let counts: [Int]
    private let style: Style
    private let page: (Int) -> Page

    public init(titles: [String], selection: Binding<Int>, counts: [Int] = [], style: Style = .standard, @ViewBuilder page: @escaping (Int) -> Page) {
        self.titles = titles
        self._selection = selection
        self.counts = counts
        self.style = style
        self.page = page
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(spacing: 16) {
            bar
            pager
        }
        .fontWeight(.semibold)
        .onAppear { position = selection }
        .onChange(of: selection) { old, index in
            guard position != index else { return }
            // A retarget mid-trip widens the trip, so the block never settles on a title it is still crossing.
            let from = trip ?? old...old
            trip = min(from.lowerBound, index)...max(from.upperBound, index)
            // A tap or an outside change lands the page on the no-overshoot spring, like native paging, so the pager
            // never shows past its last page and a page of text never wobbles. The block rides it through progress
            // and takes its own give as it lands (see `track(_:)`).
            withAnimation(motion.value) { position = index }
        }
        .onChange(of: position) { _, index in
            if let index, index != selection { selection = index }
        }
        // One tick per selection change, from a tap or a swipe. Not keyed to `position`, which starts nil and changes on appear.
        .sensoryFeedback(.selection, trigger: selection)
    }

    // MARK: Bar

    private var bar: some View {
        PieceLiquidGroup {
            ZStack(alignment: .topLeading) {
                indicator
                HStack(spacing: 0) {
                    ForEach(titles.indices, id: \.self) { index in
                        Button { selection = index } label: {
                            label(index)
                                .contentShape(Capsule())
                        }
                        // Decided at touch-down, so a tap that moves the selection never sinks the block on its way out.
                        .buttonStyle(TabPress { isPressed in blockPressed = isPressed && index == selection })
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("trackingTabs")) } action: { frames[index] = $0 }
                        .accessibilityLabel(titles[index])
                        .accessibilityValue(counts.indices.contains(index) ? "\(counts[index])" : "")
                        .accessibilityAddTraits(selection == index ? [.isButton, .isSelected] : .isButton)
                    }
                }
            }
            .coordinateSpace(.named("trackingTabs"))
            // The bar moves as one piece when the pager's height change shifts it, so the block, which updates every
            // scroll frame, stays seated on the track instead of jumping to where the bar will end up.
            .geometryGroup()
            .padding(5)
            // The track: clear glass carrying the titles and the block as its content, so the titles draw crisp on
            // top. Glass laid behind them as a background would draw over them inside the group and blur them.
            .pieceLiquid(.capsule, interactive: false)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tabs")
    }

    /// Two copies of the title cut by the block's outline: muted outside it, ink inside it, so the text turns ink
    /// exactly under the block's edge as it passes.
    private func label(_ index: Int) -> some View {
        let block = block(over: index)
        return cell(index, color: style.title, countColor: style.title.opacity(0.7))
            .mask { BlockMask(block: block, outside: true).fill(style: FillStyle(eoFill: true)) }
            .overlay {
                cell(index, color: style.selectedTitle, countColor: style.selectedTitle.opacity(0.62))
                    .mask { BlockMask(block: block) }
                    .accessibilityHidden(true)
            }
    }

    private func cell(_ index: Int, color: Color, countColor: Color) -> some View {
        titleRow(index, color: color, countColor: countColor)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 44)
    }

    private func titleRow(_ index: Int, color: Color, countColor: Color) -> some View {
        HStack(spacing: 6) {
            Text(titles[index])
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)
            if counts.indices.contains(index) {
                Text("\(counts[index])")
                    .font(.system(.caption, design: .monospaced).weight(.semibold))
                    .foregroundStyle(countColor)
                    .contentTransition(.numericText(value: Double(counts[index])))
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    /// The block in one title's own coordinates.
    private func block(over index: Int) -> CGRect {
        guard let frame = frames[index] else { return .zero }
        return blockRect.offsetBy(dx: -frame.minX, dy: -frame.minY)
    }

    private var indicator: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let rect = blockRect
        let sunk = blockPressed && !reduceMotion
        // Copied out of `self`, since the animator's content runs off the body. None under Reduce Motion.
        let carry: CGFloat = reduceMotion ? 0 : 4 * heading
        return Color.clear
            .frame(width: rect.width, height: rect.height)
            .pieceLiquid(.capsule, tint: style.indicator, interactive: false)
            // The same depth as the title's press, so the ink cut stays on the block's edge. Through the liquid scale,
            // as every scale on glass is.
            .pieceLiquidScale(sunk ? PieceMotion.pressScale(for: rect.size) : 1)
            .animation(sunk ? motion.press : motion.release, value: sunk)
            // A trip lands with a little give while the page lands flat: the block carries a few points past its
            // title and snaps back. Its edges stay in the titles' 14 pt padding, so the ink cut never shows the gap.
            .keyframeAnimator(initialValue: CGFloat(0), trigger: landing) { content, x in
                content.offset(x: carry * x)
            } keyframes: { _ in
                KeyframeTrack {
                    CubicKeyframe(1, duration: 0.1)
                    SpringKeyframe(0, duration: 0.4, spring: PieceMotion.responsive)
                }
            }
            .offset(x: rect.minX, y: rect.minY)
            .accessibilityHidden(true)
    }

    /// Progress held to the titles, so pulling past either end neither moves nor swells the block.
    private var clampedProgress: CGFloat { max(0, min(CGFloat(titles.count - 1), progress)) }

    /// 0 while the block rests on a title, easing up to 1 a third of the way to the next. On a tap's trip only its
    /// ends and the destination settle it, so it stays swollen over the titles it passes.
    private var transit: CGFloat {
        let p = clampedProgress
        var distance = abs(p - p.rounded())
        if let trip, p >= CGFloat(trip.lowerBound), p <= CGFloat(trip.upperBound) {
            distance = min(p - CGFloat(trip.lowerBound), CGFloat(trip.upperBound) - p, abs(p - CGFloat(selection)))
        }
        let t = min(distance * 3, 1)
        return t * (2 - t)
    }

    /// The block as drawn: the title-to-title rect, swollen a little while it travels and settled flat on a title,
    /// read straight from progress. It stays inside the track's 5 pt inset. The ink cut uses the same rect, so the text
    /// turns exactly at the glass edge. Under Reduce Motion it keeps its size.
    private var blockRect: CGRect {
        let rect = indicatorRect
        guard rect != .zero, !reduceMotion else { return rect }
        return rect.insetBy(dx: -2.5 * transit, dy: -1.5 * transit)
    }

    /// Interpolates between neighboring title frames, so the block follows the pages mid-swipe.
    private var indicatorRect: CGRect {
        let clamped = clampedProgress
        let lower = Int(clamped.rounded(.down))
        let upper = min(lower + 1, titles.count - 1)
        let t = clamped - CGFloat(lower)
        guard let a = frames[lower], let b = frames[upper] else { return .zero }
        return CGRect(
            x: a.minX + (b.minX - a.minX) * t,
            y: a.minY,
            width: a.width + (b.width - a.width) * t,
            height: a.height
        )
    }

    // MARK: Pages

    /// The selected page's height once measured (the tallest before that).
    private var pagerHeight: CGFloat? { heights[position ?? selection] ?? heights.values.max() }

    private var pager: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let scroll = ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(titles.indices, id: \.self) { index in
                    page(index)
                        .fixedSize(horizontal: false, vertical: true)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights[index] = $0 }
                        // Every page is as tall as the selected one, top-aligned, so a taller page
                        // never sits centred (and pushed up) inside a shorter pager.
                        .frame(height: pagerHeight, alignment: .top)
                        .clipped()
                        .containerRelativeFrame(.horizontal)
                        .id(index)
                }
            }
            .scrollTargetLayout()
            .background { fallbackProbe }
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $position)
        .scrollIndicators(.hidden)
        .frame(height: pagerHeight)
        // The resize takes the page's no-overshoot spring, so both arrive as one move and the clipped page is
        // never cut short on the way.
        .animation(motion.value, value: position)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = max($0, 1) }

        return Group {
            if #available(iOS 18, *) {
                scroll.onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.x / max($0.containerSize.width, 1) } action: { _, value in
                    track(value)
                }
            } else {
                scroll
            }
        }
    }

    /// iOS 17: reads fractional progress from the page row's position inside the scroll view.
    @ViewBuilder
    private var fallbackProbe: some View {
        if #available(iOS 18, *) {
            EmptyView()
        } else {
            Color.clear.onGeometryChange(for: CGFloat.self) { $0.frame(in: .scrollView).minX } action: { minX in
                track(-minX / pageWidth)
            }
        }
    }

    /// Stores scroll progress, and ends a tap's trip once the block reaches the selected title. A swipe starts no
    /// trip, so a finger dragging the block settles it on each title it reaches.
    private func track(_ value: CGFloat) {
        let target = CGFloat(selection)
        // The give starts while the block still has a tenth of a page to go, so it reads as the block carrying on
        // rather than as a second move after it stopped.
        if trip != nil, abs(progress - target) >= 0.1, abs(value - target) < 0.1 {
            heading = value < target ? 1 : -1
            landing += 1
        }
        progress = value
        if trip != nil, abs(value - target) < 0.01 { trip = nil }
    }

    /// The shared press, reported so the block can sink with the selected title. A cancelled touch reports the release too.
    private struct TabPress: ButtonStyle {
        let onPress: (Bool) -> Void

        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .piecePress(configuration.isPressed)
                .onChange(of: configuration.isPressed) { _, isPressed in onPress(isPressed) }
        }
    }
}

/// The block's outline in one title's coordinates. With `outside`, filled even-odd, it is the rest of the title
/// instead, with a margin so glyphs that overhang the cell are never cut.
private struct BlockMask: Shape {
    var block: CGRect
    var outside = false

    func path(in rect: CGRect) -> Path {
        var path = Capsule().path(in: block)
        if outside { path.addRect(rect.insetBy(dx: -8, dy: -8)) }
        return path
    }
}

/// Colors for `TrackingTabs`, built from the Free house palette.
public struct TrackingTabsStyle: Sendable {
    /// Unused since the liquid glass refactor: the track is clear liquid glass. Kept so existing code still compiles.
    public var track: Color
    /// Glass tint of the block that follows the pages.
    public var indicator: Color
    /// Title color away from the indicator, on the clear glass track.
    public var title: Color
    /// Title color on the indicator; the house ink reads on every tint.
    public var selectedTitle: Color

    public init(track: Color, indicator: Color, title: Color, selectedTitle: Color) {
        self.track = track
        self.indicator = indicator
        self.title = title
        self.selectedTitle = selectedTitle
    }

    /// Signal glass indicator with ink on it, muted titles on the clear track. Copy it and change one property to customize.
    public static let standard = TrackingTabsStyle(
        track: adaptive(0xFFFFFF, 0x1C1C1C),
        indicator: adaptive(0xFF0000, 0xFF0000),
        title: adaptive(0x5C5A56, 0xA6A49F),
        selectedTitle: adaptive(0x141414, 0x141414)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct TrackingTabsExample: View {
    @State private var selection = 0
    private let titles = ["Today", "Upcoming", "Done"]
    private let counts = [4, 6, 2]

    var body: some View {
        TrackingTabs(titles: titles, selection: $selection, counts: counts) { index in
            // Plain placeholder rows, only so each page has something to page through.
            VStack(spacing: 10) {
                ForEach(0..<counts[index], id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(TrackingTabsStyle.standard.track)
                        .frame(height: 60)
                }
                Spacer(minLength: 0)
            }
            .accessibilityHidden(true)
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .background(TrackingTabsStyle.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    TrackingTabsExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    TrackingTabsExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press)

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
