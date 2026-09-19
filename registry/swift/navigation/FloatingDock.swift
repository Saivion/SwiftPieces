// swiftpieces:
// title: Floating Dock
// description: "A floating dock on a solid surface where the selected item becomes a color block with its label, a drag across the dock lifts each item under the finger with a name bubble and commits on release, badges count in a signal pill, and the whole dock tucks away on scroll."
// category: navigation
// version: "2.0.0"
// pro: lens-tab-bar
// minIOSVersion: "17.0"
// tags: [tab bar, dock, navigation, gesture, badge]

import SwiftUI

/// Floating bottom dock of 4–5 icon items with a solid block selection and a scrub-to-pick gesture.
///
/// - Parameters:
///   - items: Dock items in order. Four or five work best.
///   - selection: Index of the selected item.
///   - tint: Fill of the selected item's block. Defaults to the style's indicator, a butter block.
///   - scrollProgress: 0 keeps the dock in place, 1 tucks it below the screen. Feed it a value derived from scroll direction to hide the dock while scrolling down.
///   - style: Surface, indicator, ink, and badge colors. Defaults to `.standard`, the house palette.
public struct FloatingDock: View {
    /// One dock item.
    public struct Item: Identifiable {
        public var id: String { title }
        public let title: String
        public let systemImage: String
        public let badge: Int?

        public init(_ title: String, systemImage: String, badge: Int? = nil) {
            self.title = title
            self.systemImage = systemImage
            self.badge = badge
        }
    }

    /// Colors for the dock, built from the Free house palette.
    public struct Style: Sendable {
        /// Solid capsule behind the items.
        public var surface: Color
        /// Block behind the selected item.
        public var indicator: Color
        /// Icon and label color on the indicator.
        public var selectedInk: Color
        /// Icon color for unselected items.
        public var inactive: Color
        /// Badge pill fill; badge text uses `selectedInk`.
        public var badge: Color
        /// Uses Liquid Glass on iOS 26 (and a material before it) instead of the solid surface.
        public var usesGlass: Bool

        public init(surface: Color, indicator: Color, selectedInk: Color, inactive: Color, badge: Color, usesGlass: Bool = false) {
            self.surface = surface
            self.indicator = indicator
            self.selectedInk = selectedInk
            self.inactive = inactive
            self.badge = badge
            self.usesGlass = usesGlass
        }

        /// White or charcoal surface, butter indicator, ink selection, signal badges.
        public static let standard = Style(
            surface: adaptive(0xFFFFFF, 0x1C1C1C),
            indicator: adaptive(0xFFD976, 0xFFD976),
            selectedInk: adaptive(0x141414, 0x141414),
            inactive: adaptive(0x5C5A56, 0xA6A49F),
            badge: adaptive(0xFF5B3A, 0xFF5B3A)
        )

        fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Namespace private var namespace
    @Binding private var selection: Int
    @State private var frames: [Int: CGRect] = [:]
    @State private var scrubbing: Int? = nil
    @State private var pressed: Int? = nil

    private let items: [Item]
    private let tint: Color
    private let scrollProgress: CGFloat
    private let style: Style

    public init(items: [Item], selection: Binding<Int>, tint: Color? = nil, scrollProgress: CGFloat = 0, style: Style = .standard) {
        self.items = items
        self._selection = selection
        self.tint = tint ?? style.indicator
        self.scrollProgress = scrollProgress
        self.style = style
    }

    private var spring: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.2) }

    public var body: some View {
        HStack(spacing: 2) {
            ForEach(items.indices, id: \.self) { index in
                DockItem(item: items[index], selected: index == selection, hovered: scrubbing == index, pressed: pressed == index, tint: tint, style: style, namespace: namespace)
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("floatingDock")) } action: { frames[index] = $0 }
                    .zIndex(scrubbing == index ? 1 : 0)
                    .accessibilityAction { selection = index }
            }
        }
        .padding(6)
        .coordinateSpace(.named("floatingDock"))
        .background { surface }
        .contentShape(Capsule())
        .gesture(scrub)
        .animation(spring, value: selection)
        .animation(reduceMotion ? .easeOut(duration: 0.15) : .spring(duration: 0.28, bounce: 0.35), value: scrubbing)
        .animation(.spring(duration: 0.2, bounce: 0.2), value: pressed)
        .padding(.horizontal, 24)
        .offset(y: scrollProgress * 120)
        .opacity(Double(1 - scrollProgress))
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0.1), value: scrollProgress)
        .sensoryFeedback(.selection, trigger: scrubbing) { _, new in new != nil }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: selection)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tab bar")
        .accessibilityAddTraits(.isTabBar)
        .accessibilityHidden(scrollProgress > 0.5)
    }

    // MARK: Surface

    @ViewBuilder
    private var surface: some View {
        if style.usesGlass, !reduceTransparency, #available(iOS 26, *) {
            Color.clear.glassEffect(.regular, in: .capsule)
        } else if style.usesGlass, !reduceTransparency {
            Capsule().fill(.regularMaterial)
                .shadow(color: .black.opacity(0.14), radius: 24, y: 10)
        } else {
            // Solid surface with a tight contact shadow and a wide ambient one; no hairline.
            Capsule()
                .fill(style.surface)
                .shadow(color: .black.opacity(0.08), radius: 2, y: 1)
                .shadow(color: .black.opacity(0.16), radius: 26, y: 12)
        }
    }

    // MARK: Scrub

    /// A touch that starts on an item presses it; moving across the dock lifts each item under the finger, and release commits.
    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard let index = frames.first(where: { $0.value.minX...$0.value.maxX ~= value.location.x })?.key else { return }
                if pressed == nil, scrubbing == nil { pressed = index }
                let travelled = abs(value.translation.width) > 8 || abs(value.translation.height) > 8
                if travelled || scrubbing != nil {
                    pressed = nil
                    if index != scrubbing { scrubbing = index }
                }
            }
            .onEnded { _ in
                if let index = scrubbing ?? pressed { selection = index }
                scrubbing = nil
                pressed = nil
            }
    }

    // MARK: Item

    private struct DockItem: View {
        let item: Item
        let selected: Bool
        let hovered: Bool
        let pressed: Bool
        let tint: Color
        let style: Style
        let namespace: Namespace.ID
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var bounce = 0

        var body: some View {
            HStack(spacing: 7) {
                Image(systemName: item.systemImage)
                    .font(.system(size: 19, weight: selected ? .semibold : .medium))
                    .symbolVariant(selected ? .fill : .none)
                    .symbolEffect(.bounce, value: bounce)
                    .overlay(alignment: .topTrailing) { if !selected { badge } }
                if selected {
                    Text(item.title)
                        .font(.subheadline.weight(.bold))
                        .lineLimit(1)
                        .fixedSize()
                        .transition(.opacity.combined(with: .move(edge: .leading)))
                    if let count = item.badge, count > 0 {
                        // On the block the count sits inline as an ink pill instead of covering the label.
                        Text(count > 99 ? "99+" : "\(count)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .contentTransition(.numericText(value: Double(count)))
                            .foregroundStyle(tint)
                            .padding(.horizontal, 5)
                            .frame(minWidth: 18, minHeight: 18)
                            .background(style.selectedInk, in: Capsule())
                            .transition(.scale.combined(with: .opacity))
                    }
                }
            }
            .foregroundStyle(selected ? style.selectedInk : style.inactive)
            .padding(.horizontal, selected ? 18 : 12)
            .frame(minWidth: 48, minHeight: 48)
            .background {
                if selected {
                    Capsule()
                        .fill(tint)
                        .matchedGeometryEffect(id: "indicator", in: namespace)
                }
            }
            .scaleEffect(pressed ? 0.92 : hovered && !selected && !reduceMotion ? 1.14 : 1)
            .offset(y: hovered && !reduceMotion ? -5 : 0)
            .overlay(alignment: .top) {
                if hovered {
                    Text(item.title)
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(style.surface)
                        .fixedSize()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.primary, in: Capsule())
                        .offset(y: -50)
                        .transition(.scale(scale: 0.6, anchor: .bottom).combined(with: .opacity))
                        .accessibilityHidden(true)
                }
            }
            .onChange(of: selected) { _, isSelected in if isSelected { bounce += 1 } }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.title)
            .accessibilityValue(item.badge.map { "\($0) new" } ?? "")
            .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        }

        @ViewBuilder
        private var badge: some View {
            if let count = item.badge, count > 0 {
                Text(count > 99 ? "99+" : "\(count)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(count)))
                    .foregroundStyle(style.selectedInk)
                    .padding(.horizontal, 5)
                    .frame(minWidth: 18, minHeight: 18)
                    .background(style.badge, in: Capsule())
                    // A ring in the dock's surface color cuts the pill out of the icon.
                    .background(style.surface, in: Capsule().inset(by: -2))
                    .offset(x: 11, y: -9)
                    .transition(.scale.combined(with: .opacity))
                    .animation(.snappy(duration: 0.25), value: count)
            }
        }
    }
}

// MARK: - Example

private struct FloatingDockExample: View {
    @State private var selection = 0
    @State private var inbox = 3

    var body: some View {
        ZStack(alignment: .bottom) {
            // Plain placeholder content, only so the dock has something to float over.
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(0..<7, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(FloatingDock.Style.standard.surface)
                            .frame(height: 72)
                    }
                }
                .padding(20)
                .padding(.bottom, 100)
                .accessibilityHidden(true)
            }
            .background(FloatingDock.Style.adaptive(0xF3F2EE, 0x121212))
            FloatingDock(items: [
                .init("Home", systemImage: "house"),
                .init("Search", systemImage: "magnifyingglass"),
                .init("Inbox", systemImage: "tray", badge: inbox),
                .init("Profile", systemImage: "person"),
            ], selection: $selection)
            .padding(.bottom, 12)
        }
    }
}

#Preview("Light") {
    FloatingDockExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    FloatingDockExample().preferredColorScheme(.dark)
}
