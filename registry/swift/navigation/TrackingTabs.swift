// swiftpieces:
// title: Tracking Tabs
// description: Tabs over a paging ScrollView whose solid block indicator follows the pages through fractional scroll progress, with ink titles that fade in as the block passes, optional counts, a pressed state, and a selection tick on settle.
// category: navigation
// version: "2.0.0"
// pro: lens-tab-bar
// minIOSVersion: "17.0"
// tags: [tabs, pager, segmented, scroll, navigation, counts]

import SwiftUI

/// Tab bar with a scroll-linked block indicator driving horizontally paged content.
///
/// - Parameters:
///   - titles: One title per page, in order.
///   - selection: Index of the settled page. Tapping a title and swiping the pages both update it.
///   - counts: Optional count per page shown after its title, such as open tasks. Pass an empty array to hide counts. Defaults to none.
///   - style: Track, indicator, and title colors. Defaults to `.standard`, the house palette with a butter indicator.
///   - page: Builds the page for a given index. Pages fill the container width.
public struct TrackingTabs<Page: View>: View {
    /// Colors for the track, indicator, and titles. See `TrackingTabsStyle`.
    public typealias Style = TrackingTabsStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Binding private var selection: Int
    @State private var position: Int? = nil
    @State private var progress: CGFloat = 0
    @State private var frames: [Int: CGRect] = [:]
    @State private var pageWidth: CGFloat = 1

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

    private var spring: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.42, bounce: 0.12) }

    public var body: some View {
        VStack(spacing: 16) {
            bar
            pager
        }
        .onAppear { position = selection }
        .onChange(of: selection) { _, index in
            guard position != index else { return }
            withAnimation(spring) { position = index }
        }
        .onChange(of: position) { _, index in
            if let index, index != selection { selection = index }
        }
        .sensoryFeedback(.selection, trigger: position)
    }

    // MARK: Bar

    private var bar: some View {
        ZStack(alignment: .topLeading) {
            indicator
            HStack(spacing: 0) {
                ForEach(titles.indices, id: \.self) { index in
                    Button { selection = index } label: {
                        label(index)
                            .padding(.horizontal, 14)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .contentShape(Capsule())
                    }
                    .buttonStyle(PressScale(reduceMotion: reduceMotion))
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("trackingTabs")) } action: { frames[index] = $0 }
                    .accessibilityLabel(titles[index])
                    .accessibilityValue(counts.indices.contains(index) ? "\(counts[index])" : "")
                    .accessibilityAddTraits(selection == index ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
        .coordinateSpace(.named("trackingTabs"))
        .padding(5)
        .background(style.track, in: Capsule())
        .shadow(color: .black.opacity(reduceTransparency ? 0 : 0.06), radius: 10, y: 4)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tabs")
    }

    /// Two stacked copies of the title: muted underneath, ink on top, crossfaded by how much of the block sits over it.
    private func label(_ index: Int) -> some View {
        let on = emphasis(index)
        return ZStack {
            titleRow(index, color: style.title, countColor: style.title.opacity(0.7))
                .opacity(1 - on)
            titleRow(index, color: style.selectedTitle, countColor: style.selectedTitle.opacity(0.62))
                .opacity(on)
        }
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

    /// 1 while the block sits over this title, fading to 0 one page away.
    private func emphasis(_ index: Int) -> Double {
        Double(max(0, 1 - abs(progress - CGFloat(index))))
    }

    private var indicator: some View {
        let rect = indicatorRect
        return Capsule()
            .fill(style.indicator)
            .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
            .frame(width: rect.width, height: rect.height)
            .offset(x: rect.minX, y: rect.minY)
            .accessibilityHidden(true)
    }

    /// Interpolates between neighboring title frames, so the block follows the pages mid-swipe.
    private var indicatorRect: CGRect {
        let clamped = max(0, min(CGFloat(titles.count - 1), progress))
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

    private var pager: some View {
        let scroll = ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(titles.indices, id: \.self) { index in
                    page(index)
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
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = max($0, 1) }

        return Group {
            if #available(iOS 18, *) {
                scroll.onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.x / max($0.containerSize.width, 1) } action: { _, value in
                    progress = value
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
                progress = -minX / pageWidth
            }
        }
    }

    private struct PressScale: ButtonStyle {
        let reduceMotion: Bool
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
                .animation(.spring(duration: 0.25, bounce: 0.3), value: configuration.isPressed)
        }
    }
}

/// Colors for `TrackingTabs`, built from the Free house palette.
public struct TrackingTabsStyle: Sendable {
    /// Capsule track behind the titles.
    public var track: Color
    /// Solid block that follows the pages.
    public var indicator: Color
    /// Title color away from the indicator.
    public var title: Color
    /// Title color on the indicator; use dark ink on light blocks.
    public var selectedTitle: Color

    public init(track: Color, indicator: Color, title: Color, selectedTitle: Color) {
        self.track = track
        self.indicator = indicator
        self.title = title
        self.selectedTitle = selectedTitle
    }

    /// Surface track, butter block indicator, ink selected title. Copy it and change one property to customize.
    public static let standard = TrackingTabsStyle(
        track: adaptive(0xFFFFFF, 0x1C1C1C),
        indicator: adaptive(0xFFD976, 0xFFD976),
        title: adaptive(0x5C5A56, 0xA6A49F),
        selectedTitle: adaptive(0x141414, 0x141414)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
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
