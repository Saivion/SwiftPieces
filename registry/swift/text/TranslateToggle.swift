// swiftpieces:
// title: Translate Toggle
// description: "Text that can show itself in the reader's language. Tap Translate and the words blur over one by one into the translation while the language label rolls to say where it came from; tap Original to go back. It uses Apple's on-device Translation framework, so it needs no keys and no server, and it detects the source language itself. The button hides when the text is already in the reader's language, and before iOS 18. For reviews, comments, menus and travel."
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [translate, translation, language, locale, text, reviews]

import NaturalLanguage
import SwiftUI
#if canImport(Translation)
import Translation
#endif

/// Colors and type for `TranslateToggle`. `.standard` is the house palette.
public struct TranslateToggleStyle: Sendable {
    /// The button while showing the translation.
    public var accent: Color
    /// The button's label on `accent`.
    public var onAccent: Color
    /// The button while showing the original.
    public var button: Color
    /// The text.
    public var label: Color
    /// The language line.
    public var secondaryLabel: Color
    /// The text's font.
    public var font: Font

    public init(
        accent: Color = Color(red: 1, green: 0, blue: 0),
        onAccent: Color = TranslateToggleStyle.adaptive(light: 0x141414, dark: 0x141414),
        button: Color = TranslateToggleStyle.adaptive(light: 0xE6E4DF, dark: 0x2A2A2A),
        label: Color = TranslateToggleStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        secondaryLabel: Color = TranslateToggleStyle.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
        font: Font = .title3
    ) {
        self.accent = accent
        self.onAccent = onAccent
        self.button = button
        self.label = label
        self.secondaryLabel = secondaryLabel
        self.font = font
    }

    public static let standard = TranslateToggleStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A translation, once it has arrived.
private struct TranslateToggleResult: Equatable, Sendable {
    var text: String
    var source: String?
}

/// Text with its language and a button that translates it on device, word by word.
///
/// - Parameters:
///   - text: The text, in any language Translation supports.
///   - target: The language to translate into. Defaults to the reader's.
///   - style: Colors and type. Defaults to the house palette, adapting to light and dark.
public struct TranslateToggle: View {
    public typealias Style = TranslateToggleStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale
    @State private var words: [String]
    /// Words outside `shownFrom..<shownTo` are blurred out; the swap walks both ends across the text.
    @State private var shownFrom = 0
    @State private var shownTo = Int.max
    @State private var translating = false
    @State private var waiting = false
    @State private var result: TranslateToggleResult?
    @State private var requests = 0
    @State private var swapping: Task<Void, Never>?

    private let text: String
    private let target: Locale.Language?
    private let style: Style

    public init(_ text: String, to target: Locale.Language? = nil, style: Style = .standard) {
        self.text = text
        self.target = target
        self.style = style
        self._words = State(initialValue: TranslateToggle.split(text))
    }

    /// The text's own language, as NaturalLanguage hears it.
    private var sourceCode: String? {
        NLLanguageRecognizer.dominantLanguage(for: text).map(\.rawValue)
    }

    private var targetCode: String {
        (target ?? locale.language).languageCode?.identifier ?? "en"
    }

    /// Whether there's anything to translate, and anything to translate with.
    private var canTranslate: Bool {
        guard let sourceCode, sourceCode != targetCode, sourceCode != "und" else { return false }
        if #available(iOS 18, *) { return true }
        return false
    }

    private func name(_ code: String?) -> String {
        code.flatMap { locale.localizedString(forLanguageCode: $0) } ?? "Unknown language"
    }

    private var languageLine: String {
        guard translating, let result else { return name(sourceCode) }
        return "\(name(targetCode)) · from \(name(result.source ?? sourceCode))"
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(alignment: .leading, spacing: 14) {
            Text(languageLine)
                .font(.footnote)
                .foregroundStyle(style.secondaryLabel)
                .id(languageLine)
                .transition(motion.transition(.push(from: .bottom)))
                .clipped()
            TranslateToggleFlow(gap: 6, lineGap: 4) {
                ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                    let shown = index >= shownFrom && index < shownTo
                    Text(word)
                        .font(style.font)
                        .foregroundStyle(style.label)
                        .opacity(shown ? 1 : 0)
                        .blur(radius: shown || reduceMotion ? 0 : 5)
                        .offset(y: shown || reduceMotion ? 0 : 6)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(words.joined(separator: " "))
            if canTranslate {
                button
            }
        }
        .fontWeight(.semibold)
        .background {
            #if canImport(Translation)
            if #available(iOS 18, *) {
                TranslateToggleRunner(text: text, target: target ?? locale.language, request: requests, result: $result)
            }
            #endif
        }
        .onChange(of: result) { _, new in
            guard let new, translating, waiting else { return }
            waiting = false
            if new.source == nil {
                // It couldn't translate: back to the original, and the next tap tries again.
                translating = false
                result = nil
                return
            }
            swap(to: new.text)
        }
        .onChange(of: text) { _, new in
            swapping?.cancel()
            translating = false
            waiting = false
            result = nil
            words = TranslateToggle.split(new)
            shownFrom = 0
            shownTo = .max
        }
    }

    private var button: some View {
        Button(action: toggle) {
            HStack(spacing: 8) {
                if waiting {
                    ProgressView().controlSize(.small).tint(style.onAccent)
                } else {
                    Image(systemName: "translate")
                }
                Text(translating ? "Original" : "Translate")
                    .contentTransition(.interpolate)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(translating ? style.onAccent : style.label)
            .padding(.horizontal, 16)
            .frame(minHeight: 40)
            .background(translating ? style.accent : style.button, in: .capsule)
            .contentShape(.capsule)
        }
        .buttonStyle(PiecePressStyle(depth: 2))
        .animation(.easeOut(duration: 0.25), value: translating)
        .sensoryFeedback(.selection, trigger: translating)
        .accessibilityHint(translating ? "Shows the original text" : "Translates into \(name(targetCode))")
    }

    // MARK: Swapping

    private func toggle() {
        if translating {
            translating = false
            waiting = false
            swap(to: text)
        } else {
            translating = true
            if let result {
                swap(to: result.text)
            } else {
                waiting = true
                requests += 1
            }
        }
    }

    /// The old words blur out from the first to the last, then the new ones sharpen in the same way.
    private func swap(to new: String) {
        swapping?.cancel()
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard !reduceMotion else {
            withAnimation(.easeInOut(duration: 0.25)) {
                words = TranslateToggle.split(new)
            }
            return
        }
        swapping = Task { @MainActor in
            let old = words.count
            for index in 0..<old {
                withAnimation(.easeOut(duration: 0.25)) { shownFrom = index + 1 }
                try? await Task.sleep(for: .milliseconds(24))
                if Task.isCancelled { return }
            }
            try? await Task.sleep(for: .milliseconds(200))
            if Task.isCancelled { return }
            let next = TranslateToggle.split(new)
            words = next
            shownFrom = 0
            shownTo = 0
            for index in 0..<next.count {
                withAnimation(motion.snap) { shownTo = index + 1 }
                try? await Task.sleep(for: .milliseconds(30))
                if Task.isCancelled { return }
            }
            shownTo = .max
        }
    }

    private static func split(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).map(String.init)
    }
}

#if canImport(Translation)
/// Runs one on-device translation each time `request` changes and writes it to `result`.
@available(iOS 18, *)
private struct TranslateToggleRunner: View {
    let text: String
    let target: Locale.Language
    let request: Int
    @Binding var result: TranslateToggleResult?
    @State private var configuration: TranslationSession.Configuration?

    var body: some View {
        Color.clear
            .translationTask(configuration) { @Sendable [text, binding = $result] session in
                do {
                    let response = try await session.translate(text)
                    let translated = TranslateToggleResult(text: response.targetText, source: response.sourceLanguage.languageCode?.identifier)
                    await MainActor.run { binding.wrappedValue = translated }
                } catch {
                    // Unsupported pair, or the reader declined the language download: stay on the original.
                    await MainActor.run { binding.wrappedValue = TranslateToggleResult(text: text, source: nil) }
                }
            }
            .onChange(of: request) {
                if configuration == nil {
                    configuration = TranslationSession.Configuration(source: nil, target: target)
                } else {
                    configuration?.invalidate()
                }
            }
            .accessibilityHidden(true)
    }
}
#endif

/// Wraps words into lines the way text wraps.
private struct TranslateToggleFlow: Layout {
    var gap: CGFloat
    var lineGap: CGFloat

    private func lines(_ sizes: [CGSize], width: CGFloat) -> [[Int]] {
        var lines: [[Int]] = [[]]
        var x: CGFloat = 0
        for (index, size) in sizes.enumerated() {
            let needed = lines[lines.count - 1].isEmpty ? size.width : x + gap + size.width
            if needed > width, !lines[lines.count - 1].isEmpty {
                lines.append([index])
                x = size.width
            } else {
                lines[lines.count - 1].append(index)
                x = needed
            }
        }
        return lines
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var height: CGFloat = 0, widest: CGFloat = 0
        for line in lines(sizes, width: proposal.width ?? .infinity) where !line.isEmpty {
            widest = max(widest, line.map { sizes[$0].width }.reduce(0, +) + gap * CGFloat(line.count - 1))
            height += (line.map { sizes[$0].height }.max() ?? 0) + lineGap
        }
        return CGSize(width: proposal.width ?? widest, height: max(height - lineGap, 0))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var y = bounds.minY
        for line in lines(sizes, width: bounds.width) where !line.isEmpty {
            let height = line.map { sizes[$0].height }.max() ?? 0
            var x = bounds.minX
            for index in line {
                subviews[index].place(at: CGPoint(x: x, y: y + height - sizes[index].height), proposal: .unspecified)
                x += sizes[index].width + gap
            }
            y += height + lineGap
        }
    }
}

// MARK: - Example

/// A restaurant review left in Spanish, on a card.
private struct TranslateToggleExample: View {
    var body: some View {
        TranslateToggle("La mejor paella del barrio. Volveremos pronto, sin duda.")
            .padding(20)
            .frame(width: 300, alignment: .leading)
            .background(.background, in: .rect(cornerRadius: 26, style: .continuous))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TranslateToggleStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    TranslateToggleExample()
}

#Preview("Dark") {
    TranslateToggleExample()
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
