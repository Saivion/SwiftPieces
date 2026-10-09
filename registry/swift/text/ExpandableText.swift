// swiftpieces:
// title: Expandable Text
// description: A paragraph clamped to a line limit that measures whether it is really truncated, and only then fades the end of its last line into a small liquid glass "more" pill; tapping grows the block smoothly to its full height with no reflow while the pill rides its bottom edge down and morphs to "less", links stay tappable, and VoiceOver always reads the whole text.
// category: text
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-23"
// tags: [text, read-more, truncation, expand, collapse, line-limit, review]

import SwiftUI

/// A "Read more" paragraph that shows a `more` pill only when the text is actually truncated.
///
/// SwiftUI cannot tell you whether a `Text` was truncated, so this measures three hidden copies at the real width:
/// the full text, the text at `lineLimit` lines, and the text at one line fewer (which locates the last visible line).
/// The copies re-measure on width, Dynamic Type and text changes. When the full height exceeds the limited height,
/// the visible text is laid out in full and clipped to the limited height; the end of the last line fades out
/// (a transparent mask, so it works over any background) and a small glass pill reading `more` sits in the faded space on
/// the trailing edge. Expanding animates the clip to the full height, so lines never reflow or jump, and the pill rides
/// the text's bottom edge down to sit under it, its label morphing to `less`. The toggle runs in one transaction, so a
/// card or row around the piece grows and shrinks with the text.
///
/// Font and color come from the environment like `Text`: apply `.font(...)`, `.foregroundStyle(...)` and
/// `.multilineTextAlignment(...)` to the piece. VoiceOver reads the full text in both states and gets
/// "Show more" / "Show less" actions; the visual pill is hidden from it.
///
/// - Parameters:
///   - text: The paragraph. A `String` is shown verbatim; an `AttributedString` keeps bold, italics and tappable links.
///   - lineLimit: Lines shown while collapsed. Values below 1 are treated as 1.
///   - isExpanded: Optional binding to drive or observe the state from outside. `nil` keeps the state internally.
///   - moreLabel: The pill's label on the last collapsed line. Localized from your app's strings; defaults to "more".
///   - lessLabel: The pill's label under the expanded text. Localized from your app's strings; defaults to "less".
///   - showsLess: When false, an expanded paragraph stays expanded (the pill leaves once it opens, and tapping the body does nothing).
///   - togglesOnTap: When true, tapping anywhere on the paragraph also expands or collapses it. Links inside the text still open.
///   - style: Pill label color and weight, fade width, and an optional solid fade color. Defaults to the house palette.
public struct ExpandableText: View {
    /// The pill's label color and weight, and how the last line fades. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The label on the "more" and "less" pill.
        public var link: Color
        /// Weight of the pill's label, applied on top of the environment font. Semibold, the house weight, by default.
        public var linkWeight: Font.Weight
        /// Width of the fade in front of "more", at the default Dynamic Type size. Scales with the text.
        public var fadeWidth: CGFloat
        /// `nil` (default) fades the text itself to transparent, which works over any background: images, materials, gradients.
        /// Set a color to paint a gradient into that color instead, for example to match a card behind the text exactly.
        public var fade: Color?

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(link: Color? = nil, linkWeight: Font.Weight = .semibold, fadeWidth: CGFloat = 40, fade: Color? = nil) {
            self.link = link ?? adaptive(light: 0xD70000, dark: 0xFF3B30)
            self.linkWeight = linkWeight
            self.fadeWidth = max(fadeWidth, 0)
            self.fade = fade
        }

        public static let standard = Style()
    }

    private enum Content {
        case plain(String)
        case attributed(AttributedString)
    }

    /// Heights of the hidden measuring copies at the current width.
    private struct Metrics: Equatable {
        var full: CGFloat = 0
        var limited: CGFloat = 0
        var head: CGFloat = 0
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.multilineTextAlignment) private var textAlignment
    @Environment(\.openURL) private var openURL
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1
    @State private var storedExpanded = false
    @State private var metrics = Metrics()
    @State private var lastLinkOpen = Date.distantPast
    @State private var pendingToggle: Task<Void, Never>?

    private let content: Content
    private let lineLimit: Int
    private let externalExpanded: Binding<Bool>?
    private let moreLabel: LocalizedStringKey
    private let lessLabel: LocalizedStringKey
    private let showsLess: Bool
    private let togglesOnTap: Bool
    private let style: Style

    /// A plain string, shown verbatim.
    public init(_ text: String, lineLimit: Int = 3, isExpanded: Binding<Bool>? = nil, moreLabel: LocalizedStringKey = "more", lessLabel: LocalizedStringKey = "less", showsLess: Bool = true, togglesOnTap: Bool = true, style: Style = .standard) {
        self.init(content: .plain(text), lineLimit: lineLimit, isExpanded: isExpanded, moreLabel: moreLabel, lessLabel: lessLabel, showsLess: showsLess, togglesOnTap: togglesOnTap, style: style)
    }

    /// An attributed string: bold, italics and links are kept, and links stay tappable.
    public init(_ text: AttributedString, lineLimit: Int = 3, isExpanded: Binding<Bool>? = nil, moreLabel: LocalizedStringKey = "more", lessLabel: LocalizedStringKey = "less", showsLess: Bool = true, togglesOnTap: Bool = true, style: Style = .standard) {
        self.init(content: .attributed(text), lineLimit: lineLimit, isExpanded: isExpanded, moreLabel: moreLabel, lessLabel: lessLabel, showsLess: showsLess, togglesOnTap: togglesOnTap, style: style)
    }

    private init(content: Content, lineLimit: Int, isExpanded: Binding<Bool>?, moreLabel: LocalizedStringKey, lessLabel: LocalizedStringKey, showsLess: Bool, togglesOnTap: Bool, style: Style) {
        self.content = content
        self.lineLimit = max(lineLimit, 1)
        self.externalExpanded = isExpanded
        self.moreLabel = moreLabel
        self.lessLabel = lessLabel
        self.showsLess = showsLess
        self.togglesOnTap = togglesOnTap
        self.style = style
    }

    // MARK: State

    private var expanded: Bool { externalExpanded?.wrappedValue ?? storedExpanded }

    private func setExpanded(_ value: Bool) {
        if let externalExpanded { externalExpanded.wrappedValue = value } else { storedExpanded = value }
    }

    /// Every toggle from inside the piece. One transaction, so the views around it travel with the fold instead of
    /// jumping to the new height while the text is still moving.
    private func toggle() {
        let opening = !expanded
        withAnimation(fold(opening: opening)) { setExpanded(opening) }
    }

    /// All copies have reported, so the limited and full heights are real for this width.
    private var isMeasured: Bool { metrics.full > 0 && metrics.limited > 0 && (lineLimit == 1 || metrics.head > 0) }

    /// Truncated means the full layout is taller than the clamped one. The half point absorbs rounding.
    private var isTruncated: Bool { isMeasured && metrics.full > metrics.limited + 0.5 }

    private var hasLinks: Bool {
        if case .attributed(let string) = content { return string.runs.contains { $0.link != nil } }
        return false
    }

    private var text: Text {
        switch content {
        case .plain(let string): Text(verbatim: string)
        case .attributed(let string): Text(string)
        }
    }

    private var frameAlignment: Alignment {
        switch textAlignment {
        case .center: .top
        case .trailing: .topTrailing
        default: .topLeading
        }
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    /// Unfurling keeps the calm reveal's pace without its give; tucking back is the quicker dismiss. Neither
    /// overshoots, so the edge of a paragraph being read, and the rows below it, never bounce. The literal is on
    /// purpose and tied to calm's duration: `value` has no give but is quicker.
    private func fold(opening: Bool) -> Animation {
        guard opening, !reduceMotion else { return opening ? motion.reveal : motion.dismiss }
        return .spring(duration: PieceMotion.calm.duration, bounce: 0)
    }

    /// The fade at the end of the last line returns a beat into the collapse, once the fold has passed most of the
    /// lines below it, so it never cuts into text that is still showing: 0.1s is about two thirds into the dismiss
    /// spring. The 0.18s Reduce Motion ease-in starts slowly, so there it waits until it is landing.
    private var tuck: Animation { motion.reveal.delay(reduceMotion ? 0.16 : 0.1) }

    /// The gap between the bottom of the expanded text and the pill under it.
    private let pillGap: CGFloat = 4

    // MARK: Body

    public var body: some View {
        let truncated = isTruncated
        let collapsed = truncated && !expanded
        let lastLine = max(metrics.limited - metrics.head, 0)
        let foldAnimation = fold(opening: expanded)

        VStack(alignment: .trailing, spacing: 0) {
            paragraph(truncated: truncated, collapsed: collapsed, lastLine: lastLine)

            if truncated && showsLess {
                // Room for the pill under the expanded text. It stays in the layout and folds to no height while
                // collapsed, so the pill rides the text's bottom edge down into it however the piece is anchored (top,
                // bottom or centered), and a container around the piece grows with it.
                pillLabel(lessLabel)
                    .padding(.top, pillGap)
                    .frame(height: expanded ? nil : 0, alignment: .top)
                    .hidden()
                    .accessibilityHidden(true)
            }
        }
        .fontWeight(.semibold)
        // A change made inside withAnimation keeps the caller's curve, so the text and its container move as one.
        // An outside binding set without animation still folds on the piece's own curve.
        .transaction(value: expanded) { transaction in
            if transaction.animation == nil && !transaction.disablesAnimations { transaction.animation = foldAnimation }
        }
        .onDisappear { pendingToggle?.cancel() }
    }

    /// The full text, clipped to the limited height while collapsed, with the fade on the last line and the pill riding
    /// its bottom edge.
    private func paragraph(truncated: Bool, collapsed: Bool, lastLine: CGFloat) -> some View {
        text
            // Before the first measurement, a plain clamped Text shows the same first lines, so nothing jumps.
            .lineLimit(isMeasured ? nil : lineLimit)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: frameAlignment)
            .frame(height: truncated ? (expanded ? metrics.full : metrics.limited) : nil, alignment: .top)
            .clipped()
            .mask(alignment: .top) {
                if style.fade == nil { fadeMask(lastLine: lastLine, collapsed: collapsed) } else { Rectangle() }
            }
            // Clipped lines keep no hit area: a link hidden below the fold cannot be tapped by accident.
            .contentShape(.rect)
            .simultaneousGesture(TapGesture().onEnded(bodyTapped), including: togglesOnTap && truncated ? .all : .subviews)
            .environment(\.openURL, OpenURLAction { url in
                lastLinkOpen = .now
                openURL(url)
                return .handled
            })
            // With a solid `fade` color, the fade is painted over the end of the last line, under the pill.
            .overlay(alignment: .topTrailing) {
                if let fade = style.fade, truncated {
                    fadePaint(fade, lastLine: lastLine, collapsed: collapsed)
                }
            }
            // After the body tap, so tapping the pill never also counts as a body tap.
            .overlay(alignment: .bottomTrailing) {
                if truncated && (collapsed || showsLess) {
                    pill(lastLine: lastLine, collapsed: collapsed)
                        // With `showsLess` off it has nowhere to go once the text opens, so it sinks away on its own.
                        .transition(motion.transition(.scale(scale: PieceLiquid.homeScale).combined(with: .opacity)))
                }
            }
            .background(alignment: .top) { measurers }
            // The text element always reads in full; the action only resizes it for sighted VoiceOver users.
            .accessibilityActions {
                if truncated && isEnabled && (!expanded || showsLess) {
                    Button(expanded ? LocalizedStringKey("Show less") : LocalizedStringKey("Show more")) {
                        toggle()
                    }
                }
            }
    }

    /// Opaque everywhere except the trailing end of the last collapsed line: a fade, then a hole the width of the pill.
    private func fadeMask(lastLine: CGFloat, collapsed: Bool) -> some View {
        VStack(spacing: 0) {
            Rectangle().frame(height: metrics.head)
            HStack(spacing: 0) {
                Rectangle()
                fadeGradient([.black, .clear])
                    .frame(width: style.fadeWidth * scale)
                pillLabel(moreLabel).hidden()
            }
            .frame(height: lastLine)
            // The faded end of the line fills back in as the pill leaves it, and fades again as the pill comes back.
            // Only the opacity takes that timing. The cover keeps moving with the line it fills, so a centered or
            // bottom-pinned piece never shows the hole on its own while the text slides.
            .overlay {
                Rectangle()
                    .transaction { transaction in
                        if transaction.animation != nil { transaction.animation = collapsed ? tuck : motion.dismiss }
                    } body: { $0.opacity(collapsed ? 0 : 1) }
            }
            Rectangle()
        }
        .overlay { Rectangle().opacity(isTruncated ? 0 : 1) }
    }

    /// The fade painted into a solid `fade` color on the last line, solid under the pill, crossfading with the pill's
    /// arrival and departure exactly as the transparent fade does.
    private func fadePaint(_ fade: Color, lastLine: CGFloat, collapsed: Bool) -> some View {
        HStack(spacing: 0) {
            fadeGradient([fade.opacity(0), fade])
                .frame(width: style.fadeWidth * scale)
            pillLabel(moreLabel).hidden().background(fade)
        }
        .frame(height: lastLine)
        .padding(.top, metrics.head)
        .opacity(collapsed ? 1 : 0)
        // Keyed to the toggle, so the first measurement and width changes still paint it at once.
        .animation(collapsed ? tuck : motion.dismiss, value: expanded)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func fadeGradient(_ colors: [Color]) -> some View {
        LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing)
            .flipsForRightToLeftLayoutDirection(true)
    }

    /// The pill's label with its padding: one line tall plus a hair, so the pill fits the last line it sits on. The pill,
    /// the hole in the fade and the room under the text all take their size from it.
    private func pillLabel(_ label: LocalizedStringKey) -> some View {
        Text(label)
            .fontWeight(style.linkWeight)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 10)
            .padding(.vertical, 1.5)
            .frame(minWidth: 44)
    }

    /// The "more" and "less" link as a small glass pill. Collapsed, it sits centred on the last line in the space its
    /// end fades out of; open, it hangs just under the text. It rides the text's bottom edge between the two on the
    /// fold's own curve, and its label morphs from one word to the other. The hit area is at least 44 x 44 even though
    /// the pill draws at one line tall.
    private func pill(lastLine: CGFloat, collapsed: Bool) -> some View {
        let gap = pillGap
        return Button {
            pendingToggle?.cancel()
            toggle()
        } label: {
            // The labels are localized keys, which PieceMorphText cannot read, so the label morphs through Text's own
            // letter-by-letter transition, on the fold's transaction.
            pillLabel(collapsed ? moreLabel : lessLabel)
                .contentTransition(reduceMotion ? .opacity : .numericText())
                .foregroundStyle(style.link)
                .opacity(isEnabled ? 1 : 0.45)
                .contentShape(Rectangle().inset(by: -12))
        }
        .buttonStyle(.plain)
        // Neutral glass: it is a quiet link inside reading text, so it carries no tint. It swells under a press.
        .pieceLiquid(.capsule)
        // Where it hangs off the text's bottom edge: centred on the last line while collapsed, a gap below it when open.
        .alignmentGuide(.bottom) { collapsed ? $0[VerticalAlignment.center] + lastLine / 2 : $0[.top] - gap }
        .accessibilityHidden(true)
    }

    // MARK: Measuring

    /// Hidden copies laid out at the paragraph's width. They never depend on the expanded state, so there is no layout loop.
    private var measurers: some View {
        ZStack(alignment: .top) {
            text
                .fixedSize(horizontal: false, vertical: true)
                .modifier(HeightReader { metrics.full = $0 })
            text
                .lineLimit(lineLimit)
                .fixedSize(horizontal: false, vertical: true)
                .modifier(HeightReader { metrics.limited = $0 })
            if lineLimit > 1 {
                text
                    .lineLimit(lineLimit - 1)
                    .fixedSize(horizontal: false, vertical: true)
                    .modifier(HeightReader { metrics.head = $0 })
            }
        }
        .frame(maxWidth: .infinity, alignment: frameAlignment)
        .hidden()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Taps

    private func bodyTapped() {
        guard isEnabled, isTruncated, !expanded || showsLess else { return }
        guard hasLinks else { return toggle() }
        // A tap on a link also ends this gesture. Wait a beat and skip the toggle if a link opened.
        let tapped = Date.now
        pendingToggle?.cancel()
        pendingToggle = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(120))
            guard !Task.isCancelled, lastLinkOpen < tapped.addingTimeInterval(-0.4) else { return }
            toggle()
        }
    }
}

/// Reports a view's height on first layout and on every change: `onGeometryChange` on iOS 18, a GeometryReader before.
private struct HeightReader: ViewModifier {
    let action: (CGFloat) -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { height in
                action(height)
            }
        } else {
            content.background {
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { action(proxy.size.height) }
                        .onChange(of: proxy.size.height) { _, height in action(height) }
                }
            }
        }
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// App Store style reviews: a long review that truncates, a short one that must not show "more", and one with bold and a link.
private struct ExpandableTextExample: View {
    private struct Review: Identifiable {
        let id: Int
        let title: String
        let author: String
        let stars: Int
        let body: AttributedString
    }

    private let reviews: [Review] = [
        Review(id: 0, title: "Finally a planner that stays out of the way", author: "marisol.k", stars: 5, body: AttributedString("I have tried every planning app on the store and this is the first one I have kept past a month. The weekly view fits on one screen, the widgets actually update, and adding a task from the lock screen takes two taps. Sync between my phone and iPad has been instant, even on hotel Wi-Fi. My only wish is a darker theme for the calendar grid, but that is a small thing next to how calm the whole app feels.")),
        Review(id: 1, title: "Does what it says", author: "tobi", stars: 4, body: AttributedString("Quick, simple, no clutter. Recommended.")),
        Review(id: 2, title: "Great, with one catch", author: "ellen_r", stars: 4, body: (try? AttributedString(markdown: "**Update after two weeks:** the reminders bug I mentioned is fixed in 3.2. Exporting to calendar still needs a manual refresh, which the team explains on their [support page](https://www.apple.com/support/). Everything else is excellent: fast search, sensible defaults and no nagging for reviews.", options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString("Update after two weeks: the reminders bug is fixed."))
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ForEach(reviews) { review in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(review.title)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(adaptive(light: 0x141414, dark: 0xF4F3EF))
                        HStack(spacing: 6) {
                            Text(String(repeating: "\u{2605}", count: review.stars) + String(repeating: "\u{2606}", count: 5 - review.stars))
                                .accessibilityLabel("\(review.stars) out of 5 stars")
                            Text(review.author)
                        }
                        .font(.footnote)
                        .foregroundStyle(adaptive(light: 0x5C5A56, dark: 0xA6A49F))
                        ExpandableText(review.body)
                            .font(.subheadline)
                            .foregroundStyle(adaptive(light: 0x141414, dark: 0xF4F3EF))
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(adaptive(light: 0xE9E7E1, dark: 0x262626), in: .rect(cornerRadius: 18, style: .continuous))
                }
            }
            .padding(20)
        }
        .fontWeight(.semibold)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    ExpandableTextExample()
}

#Preview("Dark") {
    ExpandableTextExample()
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
// swiftpieces-liquid: 1.7.0 (liquid, morphText)

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

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
