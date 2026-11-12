// swiftpieces:
// title: Match Highlight
// description: "Search results that show why they matched. Give it a result and the query, and the matching part of each word sits on a red mark that grows as the person types. It ignores case and accents, so pate finds Pâté, and every word of the query is matched on its own, at the start of any word. A matching test filters your list with the same rules, so the marks and the results never disagree. VoiceOver reads the plain text. For search results, filters, pickers and command menus."
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [text, search, highlight, filter, query, locale, accessibility]

import SwiftUI

/// Colors and type for `MatchHighlight`. `.standard` is the house palette.
public struct MatchHighlightStyle: Sendable {
    /// The text that didn't match.
    public var text: Color
    /// The mark behind each match.
    public var mark: Color
    /// The text on the mark.
    public var onMark: Color
    /// The font.
    public var font: Font

    public init(
        text: Color = MatchHighlightStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        mark: Color = MatchHighlightStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        onMark: Color = MatchHighlightStyle.adaptive(light: 0x141414, dark: 0x141414),
        font: Font = .body
    ) {
        self.text = text
        self.mark = mark
        self.onMark = onMark
        self.font = font
    }

    public static let standard = MatchHighlightStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// Where a query word may match.
public enum MatchHighlightMode: Sendable {
    /// At the start of any word: "pas" marks "Spicy *pas*ta". The way most app search reads.
    case wordPrefix
    /// Anywhere: "ast" marks "P*ast*a". For codes, file names and IDs.
    case anywhere
}

/// Text with the parts that match a search query on a red mark.
///
/// - Parameters:
///   - text: The result to show, such as a title.
///   - query: What the person typed. Each word is matched on its own; an empty query marks nothing.
///   - mode: Where a query word may match. Defaults to the start of any word.
///   - style: Colors and type. Defaults to the house palette, adapting to light and dark.
public struct MatchHighlight: View {
    public typealias Style = MatchHighlightStyle
    public typealias Mode = MatchHighlightMode

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale

    private let text: String
    private let query: String
    private let mode: Mode
    private let style: Style

    public init(_ text: String, query: String, mode: Mode = .wordPrefix, style: Style = .standard) {
        self.text = text
        self.query = query
        self.mode = mode
        self.style = style
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        Text(attributed)
            .font(style.font)
            .fontWeight(.semibold)
            .foregroundStyle(style.text)
            .animation(motion.value, value: query)
            .accessibilityLabel(text)
    }

    /// Whether `text` matches every word of `query` under the same rules the marks use. Filter your results with it.
    public static func matches(_ text: String, query: String, mode: Mode = .wordPrefix, locale: Locale = .current) -> Bool {
        let words = queryWords(query, locale: locale)
        guard !words.isEmpty else { return true }
        let starts = wordStarts(in: text, mode: mode)
        return words.allSatisfy { word in starts.contains { prefixEnd(of: text[$0...], folded: word, locale: locale) != nil } }
    }

    private var attributed: AttributedString {
        var out = AttributedString(text)
        let words = Self.queryWords(query, locale: locale)
        for hit in Self.matchRanges(in: text, words: words, mode: mode, locale: locale) {
            guard let lower = AttributedString.Index(hit.range.lowerBound, within: out),
                  let upper = AttributedString.Index(hit.range.upperBound, within: out) else { continue }
            out[lower..<upper].backgroundColor = style.mark
            out[lower..<upper].foregroundColor = style.onMark
        }
        return out
    }

    // MARK: Matching

    private struct Hit { let range: Range<String.Index>; let word: String }

    private static func fold(_ s: some StringProtocol, _ locale: Locale) -> String {
        s.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: locale)
    }

    private static func queryWords(_ query: String, locale: Locale) -> [String] {
        query.split(whereSeparator: { $0.isWhitespace || $0.isPunctuation }).map { fold($0, locale) }.filter { !$0.isEmpty }
    }

    /// The span of `text` whose folded form starts with `folded`, measured in the original characters, so a
    /// folded "pate" marks all four letters of "Pâté".
    private static func prefixEnd(of text: Substring, folded: String, locale: Locale) -> String.Index? {
        var end = text.startIndex
        while end < text.endIndex {
            end = text.index(after: end)
            let head = fold(text[text.startIndex..<end], locale)
            if head == folded { return end }
            if !folded.hasPrefix(head) { return nil }
        }
        return nil
    }

    /// Where a match may begin: the start of each word, or every character.
    private static func wordStarts(in text: String, mode: Mode) -> [String.Index] {
        switch mode {
        case .anywhere:
            return Array(text.indices)
        case .wordPrefix:
            var starts: [String.Index] = []
            text.enumerateSubstrings(in: text.startIndex..., options: [.byWords, .substringNotRequired]) { _, range, _, _ in
                starts.append(range.lowerBound)
            }
            return starts
        }
    }

    private static func matchRanges(in text: String, words: [String], mode: Mode, locale: Locale) -> [Hit] {
        guard !words.isEmpty else { return [] }
        // Longest query words first, so "pasta pa" marks the whole of "pasta" rather than its first two letters.
        let ordered = words.sorted { $0.count > $1.count }
        var hits: [Hit] = []
        for start in wordStarts(in: text, mode: mode) {
            if hits.contains(where: { $0.range.contains(start) }) { continue }
            for word in ordered {
                if let end = prefixEnd(of: text[start...], folded: word, locale: locale) {
                    hits.append(Hit(range: start..<end, word: word))
                    break
                }
            }
        }
        return hits
    }
}

// MARK: - Example

/// A recipe search: the list filters with `matches` and each title marks what matched.
private struct MatchHighlightExample: View {
    @State private var query = "pas"
    private let recipes = ["Pasta al limone", "Spicy pasta bake", "Passion fruit sorbet", "Pâté on toast", "Green shakshuka"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Search recipes", text: $query)
                .fontWeight(.semibold)
                .padding(.horizontal, 16)
                .frame(height: 46)
                .background(.background, in: .capsule)
            ForEach(recipes, id: \.self) { recipe in
                MatchHighlight(recipe, query: query)
                    .padding(.horizontal, 8)
                    .opacity(MatchHighlight.matches(recipe, query: query) ? 1 : 0.3)
            }
        }
        .frame(width: 300)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MatchHighlightStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    MatchHighlightExample()
}

#Preview("Dark") {
    MatchHighlightExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

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

// swiftpieces-motion: end
