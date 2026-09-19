// swiftpieces:
// title: Depth Carousel
// description: Paged cards that recede in depth as they leave center and hand each page a phase value for inner parallax. Neighbors come forward on tap, and a page counter sits beside a scrubbable pill indicator computed in absolute page coordinates so it never jumps.
// category: lists
// minIOSVersion: "17.0"
// version: "2.0.0"
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
///   - showsIndicator: Show the counter and pill indicator under the carousel. The pill track is scrubbable.
///   - selection: Optional binding to the centered element's id, for reading the page or moving programmatically.
///   - style: Depth amounts, indicator colors and whether the page counter shows. Defaults to the house palette.
///   - content: Builds one page from an element and its phase: 0 at center, -1 one page toward the leading edge, 1 toward the trailing edge. Use it for inner parallax, for example `.offset(x: phase * 24)` on a shape inside a clipped card.
public struct DepthCarousel<Data: RandomAccessCollection, Content: View>: View where Data.Element: Identifiable {
    public typealias Style = DepthCarouselStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var internalSelection: Data.Element.ID? = nil
    @State private var containerWidth: CGFloat = 0
    @State private var progress: CGFloat = 0
    @State private var scrolling = false
    @State private var programmatic = false

    private let data: Data
    private let itemWidth: CGFloat
    private let spacing: CGFloat
    private let showsIndicator: Bool
    private let external: Binding<Data.Element.ID?>?
    private let style: Style
    private let content: (Data.Element, CGFloat) -> Content

    private let dot: CGFloat = 7
    private let pill: CGFloat = 22
    private let stride: CGFloat = 15

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
    private var spring: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0.12) }

    public var body: some View {
        VStack(spacing: 18) {
            scroller
            if showsIndicator { indicator }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Carousel")
        .accessibilityValue("Page \(currentIndex + 1) of \(data.count)")
        .accessibilityAdjustableAction { direction in
            move(to: currentIndex + (direction == .increment ? 1 : -1))
        }
        .sensoryFeedback(.selection, trigger: current)
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
            // Fractional page progress, read from the row's position inside the scroll view.
            .onGeometryChange(for: CGFloat.self) { $0.frame(in: .scrollView).minX } action: { minX in
                progress = (inset - minX) / pageStride
            }
        }
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
                    if !scrolling { programmatic = false }
                }
            }
        }
    }

    private func page(_ element: Data.Element, at index: Int) -> some View {
        // Signed distance from center in pages: negative toward the leading edge.
        let phase = max(-1, min(1, CGFloat(index) - progress))
        let depth = reduceMotion ? 0 : abs(phase)
        let centered = index == currentIndex
        return content(element, reduceMotion ? 0 : phase)
            .frame(width: itemWidth)
            .compositingGroup()
            .scaleEffect(1 - style.recede * depth)
            .opacity(1 - style.dim * Double(abs(phase)))
            // Neighbors sit lower in the stack: a lighter shadow that leans back toward the centered page.
            .shadow(color: .black.opacity(style.shadowOpacity * (1 - 0.6 * Double(depth))), radius: 22, x: -phase * 10, y: 16 - 8 * depth)
            .zIndex(Double(1 - depth))
            // A neighbor comes forward on tap; the centered page keeps its own gestures.
            .overlay {
                if !centered {
                    Color.clear
                        .contentShape(.rect)
                        .onTapGesture { move(to: index) }
                        .accessibilityHidden(true)
                }
            }
    }

    // MARK: Indicator

    private var indicator: some View {
        HStack(alignment: .center) {
            if style.showsCounter {
                counter
                Spacer(minLength: 12)
            }
            track
        }
        .frame(width: style.showsCounter ? min(itemWidth, max(containerWidth, itemWidth)) : nil)
    }

    /// "02 / 04": the current page at display weight, the total dimmed.
    private var counter: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(String(format: "%02d", currentIndex + 1))
                .font(.system(.title2, design: .rounded, weight: .semibold))
                .foregroundStyle(style.indicatorActive)
                .contentTransition(.numericText(value: Double(currentIndex)))
                .animation(spring, value: currentIndex)
            Text(String(format: "/ %02d", data.count))
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(style.indicatorInactive)
        }
        .monospacedDigit()
        .accessibilityHidden(true)
    }

    private var track: some View {
        let count = data.count
        let width = CGFloat(max(count - 1, 0)) * stride + pill
        return ZStack(alignment: .leading) {
            HStack(spacing: stride - dot) {
                ForEach(0..<count, id: \.self) { _ in
                    Circle()
                        .fill(style.indicatorInactive.opacity(dragging ? 0.6 : 1))
                        .frame(width: dot, height: dot)
                }
            }
            .padding(.horizontal, (pill - dot) / 2)
            // The pill lives in absolute page coordinates, so it follows the finger and never re-lays out the dots.
            Capsule()
                .fill(style.indicatorActive)
                .frame(width: pill + (dragging ? 6 : 0), height: dot)
                .offset(x: clampedProgress * stride - (dragging ? 3 : 0))
                .animation(.snappy(duration: 0.2), value: dragging)
        }
        .frame(width: width, height: 44)
        .contentShape(.rect)
        .gesture(scrub)
        .accessibilityHidden(true)
    }

    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let index = Int(((value.location.x - pill / 2) / stride).rounded())
                if index != currentIndex { move(to: index) }
            }
    }

    private var clampedProgress: CGFloat {
        max(0, min(CGFloat(max(data.count - 1, 0)), progress))
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
        withAnimation(spring) { selection.wrappedValue = target }
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
    /// Current page number and the indicator pill.
    public var indicatorActive: Color = DepthCarouselStyle.adaptive(0x141414, 0xF4F3EF)
    /// Page total and the resting dots.
    public var indicatorInactive: Color = DepthCarouselStyle.adaptive(0xC9C7C1, 0x4A4946)
    /// Show "01 / 04" beside the dots, aligned to the page edges.
    public var showsCounter: Bool = true

    public init() {}

    /// The house palette: ink pill, soft dots, page counter on.
    public static let standard = DepthCarouselStyle()

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
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
                        Text(trip.country.uppercased()).font(.caption.weight(.bold)).tracking(1.2)
                        Spacer()
                        Text("\(trip.nights) NIGHTS").font(.caption.weight(.bold)).tracking(1.2)
                    }
                    Spacer()
                    Text(trip.id).font(.system(size: 44, weight: .bold)).tracking(-1.8)
                    Text(trip.dates).font(.subheadline.weight(.medium)).opacity(0.7)
                }
                .foregroundStyle(ink)
                .padding(22)
                .offset(x: phase * 10)
            }
            .frame(height: 340)
            .clipShape(.rect(cornerRadius: 34, style: .continuous))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    DepthCarouselExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    DepthCarouselExample().preferredColorScheme(.dark)
}
