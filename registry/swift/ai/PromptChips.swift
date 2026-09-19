// swiftpieces:
// title: Prompt Chips
// description: A snapping horizontal row of prompt suggestions above a composer, each chip keyed by a solid color block glyph. The chosen chip morphs into a composer-width block with matchedGeometryEffect while the rest slide out, then the row hands the text back and collapses.
// category: ai
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: prompt-composer
// tags: [chips, suggestions, prompt, scroll, morph, ai, blocks]

import SwiftUI
import UIKit

/// Prompt suggestions in a horizontally snapping row, sized for thumb reach directly above a composer.
///
/// - Parameters:
///   - suggestions: Chip titles, in order.
///   - systemImage: Glyph on every chip's color block. Pass `nil` for text-only chips.
///   - symbols: Optional per-chip glyphs, matched to `suggestions` by index. Falls back to `systemImage`.
///   - tint: One block color for every chip and the morph target. `nil` cycles `style.blocks`.
///   - style: Chip surface, text, block colors and radius. Defaults to the house palette.
///   - selection: Optional two-way selection. Set it to a suggestion to choose it programmatically; the row writes the chosen title back when it lands.
///   - onSelect: Called with the chosen title once the morph lands (about 0.45 s; 0.2 s under Reduce Motion).
public struct PromptChips: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var morph
    @State private var revealed: Set<Int> = []
    @State private var chosen: Int?
    @State private var flying = false
    @State private var landed = false
    @State private var pressCount = 0

    private let suggestions: [String]
    private let systemImage: String?
    private let symbols: [String]?
    private let tint: Color?
    private let style: Style
    private let selection: Binding<String?>
    private let onSelect: (String) -> Void

    public init(_ suggestions: [String], systemImage: String? = "sparkle", symbols: [String]? = nil, tint: Color? = nil, style: Style = .standard, selection: Binding<String?> = .constant(nil), onSelect: @escaping (String) -> Void) {
        self.suggestions = suggestions
        self.systemImage = systemImage
        self.symbols = symbols
        self.tint = tint
        self.style = style
        self.selection = selection
        self.onSelect = onSelect
    }

    private func block(_ index: Int) -> Color {
        tint ?? (style.blocks.isEmpty ? Color.accentColor : style.blocks[index % style.blocks.count])
    }

    private func symbol(_ index: Int) -> String? {
        if let symbols, symbols.indices.contains(index) { return symbols[index] }
        return systemImage
    }

    private var rowHeight: CGFloat { 60 }

    public var body: some View {
        ZStack(alignment: .leading) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(suggestions.enumerated()), id: \.offset) { index, title in
                        chip(index: index, title: title)
                    }
                }
                .scrollTargetLayout()
                .padding(.vertical, 4)
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollClipDisabled()
            .contentMargins(.horizontal, 16, for: .scrollContent)
            .scrollDisabled(chosen != nil)
            // Morph target: a composer-width block in body type. Inserted at the chip's frame, then released to its own.
            if let chosen, !reduceMotion {
                HStack(spacing: 10) {
                    if let symbol = symbol(chosen) {
                        Image(systemName: symbol).font(.system(size: 14, weight: .bold))
                    }
                    Text(suggestions[chosen]).font(.body.weight(.semibold)).lineLimit(1)
                }
                .foregroundStyle(style.ink)
                .padding(.horizontal, 18)
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                .background(block(chosen), in: RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
                .padding(.horizontal, 16)
                .matchedGeometryEffect(id: chosen, in: morph, isSource: flying)
                .opacity(flying && !landed ? 1 : 0)
                .allowsHitTesting(false)
            }
        }
        .frame(height: landed ? 0 : rowHeight)
        .clipped()
        .sensoryFeedback(.impact(flexibility: .soft), trigger: pressCount)
        .sensoryFeedback(.selection, trigger: chosen)
        .onAppear(perform: reveal)
        .onChange(of: selection.wrappedValue) { _, title in
            if chosen == nil, let title, let index = suggestions.firstIndex(of: title) { choose(index) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Suggestions")
    }

    private func chip(index: Int, title: String) -> some View {
        let isChosen = chosen == index
        let isVisible = revealed.contains(index) && (!flying || isChosen)
        let slide: CGFloat = flying ? (chosen.map { index < $0 ? -32 : 32 } ?? 0) : 0
        return Button {
            choose(index)
        } label: {
            HStack(spacing: 10) {
                if let symbol = symbol(index) {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(style.ink)
                        .frame(width: 32, height: 32)
                        .background(block(index), in: Circle())
                }
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.text)
                    .lineLimit(1)
            }
            .padding(.leading, symbol(index) == nil ? 16 : 8)
            .padding(.trailing, 16)
            .frame(minHeight: 52)
            .background {
                RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
                    .fill(style.surface)
                    .shadow(color: .black.opacity(0.06), radius: 8, y: 3)
            }
            .contentShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        }
        .buttonStyle(ChipPress(reduceMotion: reduceMotion) { pressCount += 1 })
        .matchedGeometryEffect(id: index, in: morph, isSource: !(isChosen && flying))
        .opacity(isVisible && !(isChosen && flying && !reduceMotion) ? 1 : 0)
        .scaleEffect(isVisible || reduceMotion ? 1 : 0.9)
        .offset(x: reduceMotion ? 0 : slide, y: isVisible || reduceMotion ? 0 : 8)
        .allowsHitTesting(chosen == nil)
        .accessibilityHint("Uses this prompt")
    }

    private func reveal() {
        for index in suggestions.indices {
            let delay = reduceMotion ? 0 : Double(index) * 0.05
            withAnimation(.spring(duration: 0.5, bounce: 0.2).delay(delay)) { _ = revealed.insert(index) }
        }
    }

    private func choose(_ index: Int) {
        let title = suggestions[index]
        chosen = index
        Task {
            // One frame so the target is placed at the chip's frame before it is released.
            try? await Task.sleep(for: .milliseconds(20))
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.15)) { flying = true }
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 200 : 450))
            withAnimation(.easeOut(duration: 0.25)) { landed = true }
            selection.wrappedValue = title
            onSelect(title)
        }
    }
}

public extension PromptChips {
    /// Look of a `PromptChips` row. Start from `.standard` and change what you need.
    struct Style: Sendable {
        /// Glyph blocks, cycled across chips, unless `tint` is passed.
        public var blocks: [Color] = [
            Color(red: 1, green: 0, blue: 0),
            Color(red: 0.612, green: 0.761, blue: 1),
            Color(red: 1, green: 0.851, blue: 0.463),
            Color(red: 0.663, green: 0.863, blue: 0.718),
            Color(red: 0.804, green: 0.722, blue: 1),
        ]
        /// Chip fill. Adapts to light and dark.
        public var surface: Color = Style.adaptive(0xFFFFFF, 0x1C1C1C)
        /// Chip titles.
        public var text: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Dark ink on blocks.
        public var ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
        /// Chip and morph target corner radius.
        public var cornerRadius: CGFloat = 18

        public init() {}

        /// The house palette: white or charcoal chips keyed by tangerine, sky, butter, sage and lilac.
        public static let standard = Style()

        private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(UIColor { traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

/// Fast press-in to 0.96, slower spring-out, one soft haptic per press.
private struct ChipPress: ButtonStyle {
    let reduceMotion: Bool
    let onPress: () -> Void

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .animation(configuration.isPressed ? .easeOut(duration: 0.08) : .spring(duration: 0.35, bounce: 0.3), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, pressed in if pressed { onPress() } }
    }
}

// MARK: - Example

/// The chip row alone: choose one and it morphs to row width, then hands the text back and collapses.
private struct PromptChipsExample: View {
    @State private var cycle = 0

    var body: some View {
        PromptChips(
            ["Summarize this page", "Draft a reply to Mara", "Find action items", "Plan my week"],
            symbols: ["text.alignleft", "arrowshape.turn.up.left", "checklist", "calendar"]
        ) { _ in
            // The row collapses once it lands; rebuild it so the example loops.
            Task {
                try? await Task.sleep(for: .seconds(1))
                cycle += 1
            }
        }
        .id(cycle)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    PromptChipsExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    PromptChipsExample().preferredColorScheme(.dark)
}
