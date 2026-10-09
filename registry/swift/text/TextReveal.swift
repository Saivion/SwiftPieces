// swiftpieces:
// title: Text Reveal
// description: Reveals a headline by characters, words or lines, rising from a baseline mask with a stagger sized to land in under a second, then grows a stroke of tinted liquid glass behind each phrase that matters, the text flipping to ink exactly under its edge.
// category: text
// minIOSVersion: "17.0"
// version: "2.2.0"
// pro: onboarding-flow
// tags: [text, reveal, stagger, entrance, highlight, scroll]

import SwiftUI

/// Staggered text reveal that wraps correctly at any width and Dynamic Type size.
/// The stagger is derived from the unit count, so a 3-word title and a 60-character sentence both finish in about `duration`.
/// Phrases listed in `highlights` get a stroke of tinted liquid glass that grows in behind them once they land, with the text
/// flipping to the house ink under its edge.
///
/// - Parameters:
///   - text: The string to display. With `.lines`, split lines with `\n`.
///   - unit: `.characters`, `.words` or `.lines`. Characters never break mid-word.
///   - preset: `.rise` (lift from a baseline mask), `.blur` (resolve from a soft blur) or `.soften` (scale and fade).
///   - alignment: Row alignment, like `multilineTextAlignment`.
///   - duration: Target time for the whole reveal, in seconds.
///   - delay: Delay before the first unit starts, useful for sequencing a subhead after a headline.
///   - revealOnScroll: When true, the reveal waits until the view scrolls into view (iOS 18). Below iOS 18 it reveals on appear.
///   - trigger: Change this value to replay the reveal.
///   - highlights: Phrases (one or more whole words, matched case-insensitively, ignoring punctuation) that get a glass highlight after they land. A highlighted phrase never breaks across rows. Ignored with `.lines`.
///   - style: Highlight tint and ink, rise mask and blur radius. Defaults to the house palette.
public struct TextReveal: View {
    public enum Unit { case characters, words, lines }
    public enum Preset { case rise, blur, soften }

    /// Visual tuning. `standard` uses the SwiftPieces house palette.
    public struct Style: Sendable {
        /// Glass tint of the highlight.
        public var highlight: Color
        /// Text color on the highlight. The house ink reads on butter, sage and signal alike.
        public var highlightInk: Color
        /// When true, `.rise` units slide up from behind their own baseline instead of floating up 10pt.
        public var masksRise: Bool
        /// Starting blur radius for `.blur`.
        public var blurRadius: CGFloat
        /// How long the highlight takes to grow across its phrase, in seconds.
        public var highlightDuration: Double

        public init(
            highlight: Color = Color(red: 1, green: 0.851, blue: 0.463),
            highlightInk: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
            masksRise: Bool = true,
            blurRadius: CGFloat = 8,
            highlightDuration: Double = 0.5
        ) {
            self.highlight = highlight
            self.highlightInk = highlightInk
            self.masksRise = masksRise
            self.blurRadius = blurRadius
            self.highlightDuration = highlightDuration
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var epoch = 0
    /// What the current copy shows. It changes in the same transaction as `epoch`, so an outgoing copy keeps its own text.
    @State private var copy: Copy

    private let text: String
    private let unit: Unit
    private let preset: Preset
    private let alignment: TextAlignment
    private let duration: Double
    private let delay: Double
    private let revealOnScroll: Bool
    private let trigger: AnyHashable
    private let highlights: [String]
    private let style: Style

    public init(
        _ text: String,
        unit: Unit = .words,
        preset: Preset = .rise,
        alignment: TextAlignment = .leading,
        duration: Double = 0.8,
        delay: Double = 0,
        revealOnScroll: Bool = false,
        trigger: AnyHashable = 0,
        highlights: [String] = [],
        style: Style = .standard
    ) {
        self.text = text
        self.unit = unit
        self.preset = preset
        self.alignment = alignment
        self.duration = duration
        self.delay = delay
        self.revealOnScroll = revealOnScroll
        self.trigger = trigger
        self.highlights = highlights
        self.style = style
        _copy = State(initialValue: Copy(text: text, highlights: highlights))
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        // On a replay the new copy waits until the outgoing one has mostly faded (about 13% left on the dismiss role,
        // 18% under Reduce Motion), so the two never overlap as doubled strokes.
        let hold = epoch > 0 ? 0.16 : 0
        // A ZStack, so a replay's outgoing and incoming copies share one place, aligned like the text. The outgoing copy
        // takes no layout space while it fades, so the stack takes the new copy's size at once.
        ZStack(alignment: stackAlignment) {
            // Not flattened: glass has to see what is behind it. A highlighted phrase hides its base text under the
            // stroke instead, so a fade never lets one copy show through the other.
            Reveal(chunks: chunks, unit: unit, preset: preset, alignment: alignment, duration: duration, delay: delay + hold, revealOnScroll: revealOnScroll, style: style)
                .id(epoch)
                // A replay fades the old text out where it stood, then the new one rises in its place.
                .transition(.asymmetric(insertion: .identity, removal: .opacity))
        }
        .fontWeight(.semibold)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .onChange(of: Replay(copy: Copy(text: text, highlights: highlights), trigger: trigger)) { old, new in
            // The copy changes with the epoch, so when text and trigger change together the old text is what fades.
            // New text without a new trigger swaps in place.
            guard new.trigger != old.trigger else { copy = new.copy; return }
            withAnimation(motion.dismiss) {
                copy = new.copy
                epoch += 1
            }
        }
    }

    private struct Copy: Equatable { var text: String; var highlights: [String] }
    private struct Replay: Equatable { var copy: Copy; var trigger: AnyHashable }

    private var stackAlignment: Alignment {
        switch alignment {
        case .leading: .topLeading
        case .center: .top
        case .trailing: .topTrailing
        }
    }

    /// A chunk is a word, a highlighted phrase or a line that must never break across rows; its units animate individually.
    private var chunks: [Chunk] {
        var chunks: [Chunk] = []
        var index = 0
        func pieces(for word: Substring) -> [Piece] {
            switch unit {
            case .characters:
                return word.map { character in
                    defer { index += 1 }
                    return Piece(id: index, text: String(character))
                }
            default:
                defer { index += 1 }
                return [Piece(id: index, text: String(word))]
            }
        }
        switch unit {
        case .lines:
            for line in copy.text.split(separator: "\n", omittingEmptySubsequences: false) {
                chunks.append(Chunk(id: chunks.count, words: [[Piece(id: index, text: String(line))]], highlighted: false))
                index += 1
            }
        case .words, .characters:
            let words = copy.text.split(whereSeparator: \.isWhitespace)
            let phrases = copy.highlights.map { $0.split(whereSeparator: \.isWhitespace).map(Self.normalized) }.filter { !$0.isEmpty }
            var i = 0
            while i < words.count {
                // Longest highlight phrase starting at this word wins.
                let match = phrases
                    .filter { phrase in
                        i + phrase.count <= words.count && zip(phrase, words[i..<(i + phrase.count)]).allSatisfy { $0 == Self.normalized($1) }
                    }
                    .map(\.count)
                    .max()
                if let length = match {
                    let group = words[i..<(i + length)].map { pieces(for: $0) }
                    chunks.append(Chunk(id: chunks.count, words: group, highlighted: true))
                    i += length
                } else {
                    chunks.append(Chunk(id: chunks.count, words: [pieces(for: words[i])], highlighted: false))
                    i += 1
                }
            }
        }
        return chunks
    }

    private static func normalized(_ word: Substring) -> String {
        word.lowercased().filter { $0.isLetter || $0.isNumber }
    }

    private struct Piece: Identifiable { let id: Int; let text: String }
    private struct Chunk: Identifiable {
        let id: Int
        let words: [[Piece]]
        let highlighted: Bool
        var units: [Piece] { words.flatMap { $0 } }
    }

    /// Recreated (via `.id`) on every replay so its `revealed` state starts fresh.
    private struct Reveal: View {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var revealed = false

        let chunks: [Chunk]
        let unit: Unit
        let preset: Preset
        let alignment: TextAlignment
        let duration: Double
        let delay: Double
        let revealOnScroll: Bool
        let style: Style

        private var unitCount: Int { chunks.reduce(0) { $0 + $1.units.count } }

        /// When unit `index` starts. Each unit takes about 0.5 s to land and the rest of `duration` is spread across the
        /// starts, eased so the reveal leaves briskly and settles: early gaps run a little shorter than even, the last a
        /// little longer, and the total is unchanged. Under Reduce Motion every unit starts together.
        private func start(_ index: Int) -> Double {
            guard unitCount > 1, !reduceMotion else { return delay }
            let x = Double(index) / Double(unitCount - 1)
            return delay + max(0, duration - 0.5) * x * (0.7 + 0.3 * x)
        }

        /// Units are read, so they arrive at the calm reveal's pace without its give: a word never bobs past its
        /// baseline and its opacity never rides a bounce. A literal on purpose, tied to calm's duration: `value` has
        /// no give but is quicker, and `landing` is timed from this spring.
        private static var arrival: Spring { Spring(duration: PieceMotion.calm.duration, bounce: 0) }

        /// How long a unit takes to nearly land, 92% of its rise on the arrival spring: the beat a highlight starts
        /// behind its phrase. Under Reduce Motion it is the length of the fade, so the block follows the text.
        private var landing: Double {
            guard !reduceMotion else { return 0.2 }
            var t = 0.0
            while t < 1, Self.arrival.value(target: 1.0, time: t) < 0.92 { t += 1.0 / 120 }
            return t
        }

        private var masked: Bool { preset == .rise && style.masksRise && !reduceMotion }

        var body: some View {
            Group {
                if #available(iOS 18, *), revealOnScroll {
                    group.onScrollVisibilityChange(threshold: 0.35) { visible in
                        if visible { revealed = true }
                    }
                } else {
                    group.onAppear { revealed = true }
                }
            }
        }

        /// The highlights are glass in one liquid group that merges shapes only where they touch, so two highlighted
        /// phrases side by side flow into one stroke while phrases a word apart keep their own. No lift: it would
        /// shadow the text too.
        private var group: some View {
            PieceLiquidGroup(spacing: 0, lift: false) { content }
        }

        @ViewBuilder private var content: some View {
            switch unit {
            case .lines:
                VStack(alignment: horizontal, spacing: 0) {
                    ForEach(chunks) { chunk in
                        ForEach(chunk.units) { piece in
                            styled(Text(piece.text), index: piece.id)
                                .mask(riseMask)
                        }
                    }
                }
                .multilineTextAlignment(alignment)
            case .words, .characters:
                WordFlow(alignment: alignment) {
                    ForEach(chunks) { chunk in
                        chunkView(chunk)
                    }
                }
            }
        }

        @ViewBuilder private func chunkView(_ chunk: Chunk) -> some View {
            let row = units(chunk, animated: true).mask(riseMask)
            if chunk.highlighted {
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let lands = start(chunk.units.last?.id ?? 0) + landing
                // The stroke keeps the style's own pace (`highlightDuration`) on a smooth pass with no overshoot. Its
                // length is clamped at the phrase, so a bounce would only hit the end at speed and stop dead; easing
                // into it reads softer. Under Reduce Motion the glass fades in at full length instead.
                let wipe = (reduceMotion ? motion.reveal : .smooth(duration: style.highlightDuration)).delay(lands)
                let progress: CGFloat = revealed || reduceMotion ? 1 : 0
                let shown = revealed || !reduceMotion
                row
                    // The base text gives way under the stroke, so only the ink copy sits on the glass.
                    .mask {
                        ZStack {
                            Rectangle().padding(-400)
                            HighlightStroke(progress: progress)
                                .opacity(shown ? 1 : 0)
                                .animation(wipe, value: revealed)
                                .blendMode(.destinationOut)
                        }
                        .compositingGroup()
                    }
                    .background {
                        HighlightGlass(progress: progress, tint: style.highlight)
                            .opacity(shown ? 1 : 0)
                            .animation(wipe, value: revealed)
                    }
                    .overlay {
                        // An ink copy of the phrase, uncovered by the same stroke, so the color flips exactly under its edge.
                        units(chunk, animated: false)
                            .foregroundStyle(style.highlightInk)
                            .mask {
                                HighlightStroke(progress: progress)
                                    .opacity(shown ? 1 : 0)
                                    .animation(wipe, value: revealed)
                            }
                    }
                    .padding(.horizontal, 2)
            } else {
                row
            }
        }

        private func units(_ chunk: Chunk, animated: Bool) -> some View {
            HStack(spacing: 0) {
                ForEach(Array(chunk.words.enumerated()), id: \.offset) { offset, word in
                    if offset > 0 { Text(verbatim: " ") }
                    ForEach(word) { piece in
                        if animated {
                            styled(Text(piece.text), index: piece.id)
                        } else {
                            Text(piece.text)
                        }
                    }
                }
            }
        }

        /// Clips a rising unit at its own bottom edge (descenders included) and leaves the top open, so accents are never cut.
        private var riseMask: some View {
            Rectangle()
                .padding(.horizontal, masked ? -40 : -4000)
                .padding(.top, -400)
                .padding(.bottom, masked ? 0 : -4000)
        }

        private var horizontal: HorizontalAlignment {
            switch alignment {
            case .leading: .leading
            case .center: .center
            case .trailing: .trailing
            }
        }

        private func styled(_ text: Text, index: Int) -> some View {
            let hidden = !revealed
            let moves = !reduceMotion
            let motion = PieceMotion(reduceMotion: reduceMotion)
            let masked = self.masked
            let rises = preset == .rise
            return text
                .opacity(hidden && !masked ? 0 : 1)
                .visualEffect { content, proxy in
                    content.offset(y: hidden && moves && rises ? (masked ? proxy.size.height * 1.05 : 10) : 0)
                }
                .blur(radius: hidden && moves && preset == .blur ? style.blurRadius : 0)
                .scaleEffect(hidden && moves && preset == .soften ? 0.96 : 1, anchor: .bottom)
                // Every preset arrives on the arrival spring. A fade under Reduce Motion.
                .animation((reduceMotion ? motion.reveal : .spring(Self.arrival)).delay(start(index)), value: revealed)
        }
    }
}

/// The highlight: tinted liquid glass drawn in the stroke's live outline. Animatable, so the glass takes the stroke's
/// shape on every frame as it grows, rather than jumping to its full length.
private struct HighlightGlass: View, Animatable {
    var progress: CGFloat
    let tint: Color

    nonisolated var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        // Nothing presses it, so the glass doesn't swell.
        Color.clear.pieceLiquid(HighlightStroke(progress: progress), tint: tint, interactive: false)
    }
}

/// The highlighter stroke behind a phrase: a block with round caps that grows from its own leading edge, `pad` before
/// the phrase, to `pad` past it. Drawn as a path rather than scaled, so the caps keep their radius the whole way and
/// layout never changes; the glass, the ink mask and the base text's cutout all use the same shape and progress, so
/// the color flips exactly under its edge.
private struct HighlightStroke: Shape {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let pad = (rect.height * 0.16).rounded()
        let width = (rect.width + pad * 2) * min(max(progress, 0), 1)
        guard width > 0 else { return Path() }
        let block = CGRect(x: rect.minX - pad, y: rect.minY - rect.height * 0.01, width: width, height: rect.height * 1.04)
        return RoundedRectangle(cornerRadius: rect.height * 0.24, style: .continuous).path(in: block)
    }
}

/// Wraps chunks into rows the way text wraps words. Gap between chunks scales with the row height, so it follows the font.
private struct WordFlow: Layout {
    var alignment: TextAlignment

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func rows(for sizes: [CGSize], width: CGFloat) -> [Row] {
        let gap = ((sizes.map(\.height).max() ?? 0) * 0.24).rounded()
        var rows: [Row] = []
        var row = Row()
        for (i, size) in sizes.enumerated() {
            let extended = row.indices.isEmpty ? size.width : row.width + gap + size.width
            if extended > width, !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }
            row.width = row.indices.isEmpty ? size.width : row.width + gap + size.width
            row.height = max(row.height, size.height)
            row.indices.append(i)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let rows = rows(for: sizes, width: proposal.width ?? .infinity)
        return CGSize(width: rows.map(\.width).max() ?? 0, height: rows.reduce(0) { $0 + $1.height })
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let rows = rows(for: sizes, width: bounds.width)
        let gap = ((sizes.map(\.height).max() ?? 0) * 0.24).rounded()
        var y = bounds.minY
        for row in rows {
            var x: CGFloat
            switch alignment {
            case .leading: x = bounds.minX
            case .center: x = bounds.minX + (bounds.width - row.width) / 2
            case .trailing: x = bounds.maxX - row.width
            }
            for i in row.indices {
                // Bottom-align within the row so baselines line up when a chunk is shorter.
                subviews[i].place(at: CGPoint(x: x, y: y + row.height - sizes[i].height), proposal: .unspecified)
                x += sizes[i].width + gap
            }
            y += row.height
        }
    }
}

// MARK: - Example

/// The component alone: one headline rising word by word with its key phrase landing on butter-tinted
/// glass, and the same reveal as `.blur` underneath. Nothing around it.
private struct TextRevealExample: View {
    @State private var replay = 0

    var body: some View {
        let palette = TextRevealPalette.self
        VStack(alignment: .leading, spacing: 16) {
            TextReveal("Plan the week in one calm glance.", trigger: replay, highlights: ["one calm glance"])
                .font(.system(size: 40, weight: .semibold))
                .tracking(-1.3)
                .foregroundStyle(palette.text)
            TextReveal("Three priorities, two open loops and a clear Monday.", preset: .blur, delay: 0.45, trigger: replay)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(palette.muted)
        }
        .frame(maxWidth: 360, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.ground)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4.5))
                replay += 1
            }
        }
    }
}

/// House palette values for the example, adapting to light and dark.
private enum TextRevealPalette {
    static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
    static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)
    static let muted = adaptive(light: 0x5C5A56, dark: 0xA6A49F)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

#Preview("Light") {
    TextRevealExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    TextRevealExample()
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
