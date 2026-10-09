// swiftpieces:
// title: Depth Carousel
// description: Paged cards that recede in depth as they leave center and hand each page a phase value for inner parallax. A held neighbor starts forward and comes to center on tap. Underneath, a glass page counter joined by a liquid neck to a scrubbable glass track, whose tinted glass pill stretches between the dots as the pages move, flattens against the ends and follows the finger when scrubbed, computed in absolute page coordinates so it never jumps.
// category: lists
// minIOSVersion: "17.0"
// version: "2.2.1"
// pro: depth-gallery
// tags: [carousel, scroll, paging, depth, parallax, counter]

import SwiftUI
import UIKit

/// Centered paging carousel with depth recession, per-page parallax phase, and a progress-linked indicator.
///
/// - Parameters:
///   - data: Identifiable collection of pages.
///   - itemWidth: Width of each page. Pages are centered in the carousel.
///   - spacing: Gap between pages.
///   - showsIndicator: Show the counter and pill indicator under the carousel, on liquid glass. The pill track is scrubbable.
///   - selection: Optional binding to the centered element's id, for reading the page or moving programmatically.
///   - style: Depth amounts, indicator colors and whether the page counter shows. Defaults to the house palette.
///   - content: Builds one page from an element and its phase: 0 at center, -1 one page toward the leading edge, 1 toward the trailing edge. Use it for inner parallax, for example `.offset(x: phase * 24)` on a shape inside a clipped card.
public struct DepthCarousel<Data: RandomAccessCollection, Content: View>: View where Data.Element: Identifiable {
    public typealias Style = DepthCarouselStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var internalSelection: Data.Element.ID? = nil
    @State private var containerWidth: CGFloat = 0
    @State private var progress: CGFloat = 0
    @State private var scrolling = false
    @State private var programmatic = false
    /// When the last tap, scrub or VoiceOver move started. iOS 17 reports no scroll phase, so the pages count as moved
    /// by code until that move's spring has settled.
    @State private var movedAt = Date.distantPast
    /// A finger on the track. It resets itself when the system cancels the touch, so nothing stays latched.
    @GestureState private var scrubbing = false
    /// The track is held. Set by a touch's first move and cleared at its end or cancel, in the same write as the
    /// pill's offset, so each hand-off between page and finger lands in one frame.
    @State private var touching = false
    /// Where the finger is on the track, in pages.
    @State private var scrubPosition: CGFloat = 0
    /// The pill's offset from its page position, in two parts (see `Pill`): the base springs, the held part is
    /// only ever set directly. Their sum rests at zero.
    @State private var pillBase = Pill.Edges(lower: 0, upper: 0)
    @State private var pillHeld = Pill.Edges(lower: 0, upper: 0)
    /// The neighbor page held under a finger, before its tap lands.
    @State private var leaning: Int?

    private let data: Data
    private let itemWidth: CGFloat
    private let spacing: CGFloat
    private let showsIndicator: Bool
    private let external: Binding<Data.Element.ID?>?
    private let style: Style
    private let content: (Data.Element, CGFloat) -> Content

    /// The track's resting dots, the pill over the current one, and the distance between dot centres: the pill clears
    /// its neighbours by 7pt and the dots sit 14pt apart, so the pill never reads as touching the next dot.
    private let dot: CGFloat = 6
    private let pill: CGFloat = 20
    private let stride: CGFloat = 20
    /// Height of the counter and the track: the touch target, and the two capsules match so they join cleanly.
    private let bar: CGFloat = 44
    /// The track's dots sit this far in from its ends, so the end dots are concentric with the capsule's round ends.
    private var trackInset: CGFloat { (bar - pill) / 2 }

    public init(_ data: Data, itemWidth: CGFloat = 280, spacing: CGFloat = 16, showsIndicator: Bool = true, selection: Binding<Data.Element.ID?>? = nil, style: Style = .standard, @ViewBuilder content: @escaping (Data.Element, CGFloat) -> Content) {
        self.data = data
        self.itemWidth = itemWidth
        self.spacing = spacing
        self.showsIndicator = showsIndicator
        self.external = selection
        self.style = style
        self.content = content
    }

    /// Convenience for pages that do not use the phase.
    public init(_ data: Data, itemWidth: CGFloat = 280, spacing: CGFloat = 16, showsIndicator: Bool = true, selection: Binding<Data.Element.ID?>? = nil, style: Style = .standard, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.init(data, itemWidth: itemWidth, spacing: spacing, showsIndicator: showsIndicator, selection: selection, style: style) { element, _ in content(element) }
    }

    private var selection: Binding<Data.Element.ID?> { external ?? $internalSelection }
    private var current: Data.Element.ID? { selection.wrappedValue ?? data.first?.id }
    private var inset: CGFloat { max((containerWidth - itemWidth) / 2, 0) }
    private var pageStride: CGFloat { itemWidth + spacing }
    private var dragging: Bool { scrolling && !programmatic }

    public var body: some View {
        VStack(spacing: 18) {
            scroller
            if showsIndicator { indicator }
        }
        .fontWeight(.semibold)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Carousel")
        .accessibilityValue("Page \(currentIndex + 1) of \(data.count)")
        .accessibilityAdjustableAction { direction in
            move(to: currentIndex + (direction == .increment ? 1 : -1))
        }
        .sensoryFeedback(.selection, trigger: current)
        // A held neighbor whose press never reported its end (it became the centered page) lets go here.
        .onChange(of: currentIndex) { leaning = nil }
    }

    // MARK: Pages

    private var scroller: some View {
        let scroll = ScrollView(.horizontal) {
            HStack(spacing: spacing) {
                ForEach(Array(data.enumerated()), id: \.element.id) { index, element in
                    page(element, at: index)
                }
            }
            .scrollTargetLayout()
            // Fractional page progress, read from the row's position in the scroll view's own frame. The built-in
            // `.scrollView` space starts inside the content margins, so measured there every page after the first
            // rested off by the margin: the centered page short of full size and the pill stretched or squashed.
            .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named("DepthCarousel.scroll")).minX } action: { minX in
                progress = (inset - minX) / pageStride
            }
        }
        .coordinateSpace(.named("DepthCarousel.scroll"))
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: selection)
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .contentMargins(.horizontal, inset, for: .scrollContent)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { containerWidth = $0 }

        return Group {
            if #available(iOS 18, *) {
                scroll.onScrollPhaseChange { _, phase in
                    scrolling = phase.isScrolling
                    if !phase.isScrolling { programmatic = false }
                }
            } else {
                scroll.onChange(of: progress) { _, value in
                    scrolling = abs(value - value.rounded()) > 0.02
                    // Only once the last move has settled: the snap carries a page about 0.03 pages past (more across
                    // several) and back, out of the band above, which would read as a drag and blink the indicator.
                    if Date.now.timeIntervalSince(movedAt) > PieceMotion.responsive.settlingDuration { programmatic = false }
                }
            }
        }
    }

    private func page(_ element: Data.Element, at index: Int) -> some View {
        // Signed distance from center in pages: negative toward the leading edge.
        let phase = max(-1, min(1, CGFloat(index) - progress))
        let depth = reduceMotion ? 0 : abs(phase)
        let centered = index == currentIndex
        let leans = !centered && leaning == index
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return content(element, reduceMotion ? 0 : phase)
            .frame(width: itemWidth)
            .compositingGroup()
            .scaleEffect(1 - style.recede * depth)
            .opacity(1 - style.dim * Double(abs(phase)))
            // Neighbors sit lower in the stack: a lighter shadow that leans back toward the centered page.
            .shadow(color: .black.opacity(style.shadowOpacity * (1 - 0.6 * Double(depth))), radius: 22, x: -phase * 10, y: 16 - 8 * depth)
            // Held, a neighbor starts forward, about a third of the way to center, and the tap carries it the rest on
            // the same snap spring the page moves on. Its own scale, so the scroll-linked depth above never animates.
            // Under Reduce Motion it shades instead of moving: darker in light mode, lighter in dark.
            .animation(leans ? motion.press : motion.snap) { view in
                view
                    .scaleEffect(leans && !reduceMotion ? 1 + style.recede / 3 : 1)
                    .brightness(leans && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            }
            .zIndex(Double(1 - depth))
            // A neighbor comes forward on tap; the centered page keeps its own gestures. A Button inside the scroll
            // view, so a swipe that starts on a neighbor still scrolls and cancels the press.
            .overlay {
                if !centered {
                    Button { move(to: index) } label: { Color.clear.contentShape(.rect) }
                        .buttonStyle(NeighborPressStyle { pressed in
                            if pressed { leaning = index } else if leaning == index { leaning = nil }
                        })
                        .accessibilityHidden(true)
                }
            }
    }

    // MARK: Indicator

    /// The counter and the track: two glass capsules joined by a liquid neck, one control under the pages.
    private var indicator: some View {
        PieceLiquidGroup {
            HStack(spacing: PieceLiquid.joined) {
                if style.showsCounter { counter }
                track
            }
        }
    }

    /// "02 / 04" on a glass capsule: the current page at display size, the total dimmed.
    private var counter: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(String(format: "%02d", currentIndex + 1))
                .font(.system(.title2, design: .rounded, weight: .semibold))
                .foregroundStyle(style.indicatorActive)
                // A short roll with no overshoot: the number is information. A fade under Reduce Motion.
                .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(currentIndex)))
                .animation(PieceMotion(reduceMotion: reduceMotion).value, value: currentIndex)
            Text(String(format: "/ %02d", data.count))
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .foregroundStyle(style.indicatorInactive)
        }
        .monospacedDigit()
        .padding(.horizontal, 16)
        .frame(minHeight: bar)
        .pieceLiquid(Capsule(), interactive: false)
        .accessibilityHidden(true)
    }

    private var track: some View {
        let count = data.count
        let width = CGFloat(max(count - 1, 0)) * stride + pill
        let active = dragging || touching
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let page = pageEdges
        return ZStack(alignment: .leading) {
            HStack(spacing: stride - dot) {
                ForEach(0..<count, id: \.self) { _ in
                    Circle()
                        .fill(style.indicatorInactive.opacity(active ? 0.6 : 1))
                        .frame(width: dot, height: dot)
                }
            }
            .padding(.horizontal, (pill - dot) / 2)
            // The pill is tinted glass riding inside the track's own glass, where an indicator renders crisp. It is
            // drawn in absolute page coordinates, so it never re-lays out the dots and never jumps when a page settles.
            // Held, the offset carries the finger 1:1 while the base glides the rest of the gap away.
            Pill(
                page: page,
                held: touching ? fingerEdges - page - pillBase : pillHeld,
                base: pillBase,
                widen: active && !reduceMotion ? 2 : 0,
                tint: style.indicatorActive
            )
            .frame(width: width, height: dot)
        }
        // The dots dim and the pill widens together, on the press spring as a touch arrives and the snap as it ends.
        .animation(active ? motion.press : motion.snap, value: active)
        .frame(width: width)
        .padding(.horizontal, trackInset)
        .frame(height: bar)
        .pieceLiquid(Capsule(), interactive: false)
        .contentShape(.capsule)
        .gesture(scrub)
        // Ended or cancelled, the gesture state resets, so the pill always lets go.
        .onChange(of: scrubbing) { _, isScrubbing in
            if !isScrubbing { letGo() }
        }
        .accessibilityHidden(true)
    }

    /// The pill follows the finger directly and the pages follow it on the snap spring, so the touched control leads.
    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($scrubbing) { _, scrubbing, _ in scrubbing = true }
            .onChanged { value in
                let position = (value.location.x - trackInset - pill / 2) / stride
                scrubPosition = position
                if !touching { grab() }
                let index = Int(position.rounded())
                if index != currentIndex { move(to: index) }
            }
    }

    /// A touch takes the pill from wherever it is drawn, even partway home from the last one: the held part keeps
    /// its value, so the drawn pill doesn't move this frame, and the base retargets on the press spring toward
    /// the finger, gliding onto it in about 0.1s.
    private func grab() {
        let held = pillHeld
        withAnimation(PieceMotion(reduceMotion: reduceMotion).press) {
            touching = true
            pillBase = fingerEdges - pageEdges - held
        }
    }

    /// Letting go freezes the pill's offset from the page where the finger left it, and the base springs that
    /// offset back to zero on the snap, so the pill eases home from exactly where it was drawn.
    private func letGo() {
        guard touching else { return }
        let held = fingerEdges - pageEdges - pillBase
        withAnimation(PieceMotion(reduceMotion: reduceMotion).snap) {
            touching = false
            pillHeld = held
            pillBase = Pill.Edges(lower: 0, upper: 0) - held
        }
    }

    /// The pill's edges at the scroll position, and at the finger's while the track is scrubbed.
    private var pageEdges: Pill.Edges { pillEdges(at: progress, pointsPerPage: pageStride) }
    private var fingerEdges: Pill.Edges { pillEdges(at: scrubPosition, pointsPerPage: stride) }

    /// The pill's edges in points from the track's leading end, for a position in pages. Between two dots the edge
    /// heading for the next dot leads and the other follows, so the pill stretches across and gathers in as it lands,
    /// at most half the dot spacing longer midway. Past either end it flattens against the end dot by the overshoot,
    /// measured in `pointsPerPage` and banded, never below 60% of its length. Under Reduce Motion it slides rigidly
    /// and stops there.
    private func pillEdges(at position: CGFloat, pointsPerPage: CGFloat) -> Pill.Edges {
        let held = min(max(position, 0), CGFloat(max(data.count - 1, 0)))
        guard !reduceMotion else { return Pill.Edges(lower: held * stride, upper: held * stride + pill) }
        let base = held.rounded(.down), t = held - base
        // Lower edge on t², upper on 1 - (1 - t)²: either way it moves, the edge ahead leads, and the center still
        // moves exactly with the position.
        var edges = Pill.Edges(lower: (base + t * t) * stride, upper: (base + t * (2 - t)) * stride + pill)
        let squash = abs(PieceMotion.rubberBand((position - held) * pointsPerPage, limit: pill * 0.4))
        if position < held { edges.upper -= squash } else { edges.lower += squash }
        return edges
    }

    private var currentIndex: Int {
        guard let current, let index = data.firstIndex(where: { $0.id == current }) else { return 0 }
        return data.distance(from: data.startIndex, to: index)
    }

    private func move(to index: Int) {
        guard (0..<data.count).contains(index) else { return }
        let target = data[data.index(data.startIndex, offsetBy: index)].id
        guard target != current else { return }
        programmatic = true
        movedAt = .now
        withAnimation(PieceMotion(reduceMotion: reduceMotion).snap) { selection.wrappedValue = target }
    }
}

/// The indicator pill: a tinted glass capsule between two edges, in points from the track's leading end. It sits at
/// the page position plus an offset in two parts. `held` is only ever set directly: it carries the finger and never
/// animates, so the pill never trails the scroll or the finger. `base` is the only part that springs, and a new target
/// retargets it from where it is drawn, so a hand-off between page and finger, or a re-grab during one, never jumps. A
/// view rather than a shape, so the glass is laid out from the edges SwiftUI draws on every frame.
private struct Pill: View, Animatable {
    struct Edges {
        var lower: CGFloat
        var upper: CGFloat

        static func - (a: Edges, b: Edges) -> Edges { Edges(lower: a.lower - b.lower, upper: a.upper - b.upper) }
    }

    var page: Edges
    var held: Edges
    var base: Edges
    var widen: CGFloat
    var tint: Color

    nonisolated var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>, CGFloat> {
        get { AnimatablePair(AnimatablePair(base.lower, base.upper), widen) }
        set { base.lower = newValue.first.first; base.upper = newValue.first.second; widen = newValue.second }
    }

    var body: some View {
        let lower = page.lower + held.lower + base.lower - widen
        let upper = page.upper + held.upper + base.upper + widen
        Color.clear
            .frame(width: max(upper - lower, 0))
            .pieceLiquid(Capsule(), tint: tint, interactive: false)
            .offset(x: lower)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

/// Reports a neighbor page's press, so the whole page can start forward while the finger is down. Draws nothing.
private struct NeighborPressStyle: ButtonStyle {
    let pressed: (Bool) -> Void

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, isPressed in pressed(isPressed) }
    }
}

/// Look of a `DepthCarousel`. Start from `.standard` and change what you need.
public struct DepthCarouselStyle: Sendable {
    /// How much a page one step from center shrinks, 0...1.
    public var recede: CGFloat = 0.1
    /// How much a page one step from center fades, 0...1.
    public var dim: Double = 0.3
    /// Shadow opacity under the centered page.
    public var shadowOpacity: Double = 0.18
    /// Current page number, and the glass tint of the indicator pill.
    public var indicatorActive: Color = DepthCarouselStyle.adaptive(0x141414, 0xF4F3EF)
    /// Page total and the resting dots.
    public var indicatorInactive: Color = DepthCarouselStyle.adaptive(0xC9C7C1, 0x4A4946)
    /// Show "01 / 04" on a glass capsule joined to the dots' track.
    public var showsCounter: Bool = true

    public init() {}

    /// The house palette: an ink glass pill, soft dots, page counter on.
    public static let standard = DepthCarouselStyle()

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

/// The carousel alone: trip cards as solid blocks, a cropped ink disc drifting with the phase.
private struct DepthCarouselExample: View {
    private struct Trip: Identifiable {
        let id: String
        let country: String
        let dates: String
        let nights: Int
        let block: Color
    }

    private let trips = [
        Trip(id: "Lisbon", country: "Portugal", dates: "Oct 12 – 16", nights: 4, block: Color(red: 1, green: 0, blue: 0)),
        Trip(id: "Kyoto", country: "Japan", dates: "Nov 3 – 10", nights: 7, block: Color(red: 0.612, green: 0.761, blue: 1)),
        Trip(id: "Oaxaca", country: "Mexico", dates: "Dec 1 – 6", nights: 5, block: Color(red: 1, green: 0.851, blue: 0.463)),
        Trip(id: "Bergen", country: "Norway", dates: "Jan 18 – 21", nights: 3, block: Color(red: 0.804, green: 0.722, blue: 1)),
    ]
    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)

    var body: some View {
        DepthCarousel(trips, itemWidth: 270) { trip, phase in
            ZStack(alignment: .topLeading) {
                trip.block
                Circle()
                    .fill(ink)
                    .frame(width: 180, height: 180)
                    .offset(x: 150 + phase * 40, y: 64)
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text(trip.country.uppercased()).font(.caption.weight(.semibold)).tracking(1.2)
                        Spacer()
                        Text("\(trip.nights) NIGHTS").font(.caption.weight(.semibold)).tracking(1.2)
                    }
                    Spacer()
                    Text(trip.id).font(.system(size: 44, weight: .semibold)).tracking(-1.8)
                    Text(trip.dates).font(.subheadline.weight(.semibold)).opacity(0.7)
                }
                .foregroundStyle(ink)
                .padding(22)
                .offset(x: phase * 10)
            }
            .frame(height: 340)
            .clipShape(.rect(cornerRadius: 34, style: .continuous))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    DepthCarouselExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    DepthCarouselExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, rubberBand)

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
