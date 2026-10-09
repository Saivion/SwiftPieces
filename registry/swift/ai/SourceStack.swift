// swiftpieces:
// title: Source Stack
// description: "Citations for an AI answer: a compact pill of overlapping site badges and a source count that opens into a list of numbered source cards. The badges fly out of the stack into their cards as the list cascades in under them, each card opens its link with a press, and closing gathers the badges back into the pill."
// category: ai
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// tags: [citations, sources, links, references, ai, answer, expand, morph]

import SwiftUI
import UIKit

/// The sources behind an AI answer, folded into one pill under the reply and opened into numbered cards on tap.
///
/// The pill shows the first few sources as overlapping badges (a colour disc with the site's initial) and the count.
/// Tapping it sends those badges out of the stack into their cards while the list cascades in, numbered so they match
/// the `[1]` style markers in your answer text. Tapping a card opens its link, or calls `onOpen` if you pass one.
///
/// ```swift
/// SourceStack([
///     .init(title: "Tram 28, stop by stop", site: "Tram Notes", detail: "Updated May", url: URL(string: "https://example.com/28")),
///     .init(title: "How the funiculars climb", site: "Hill & Harbour", url: URL(string: "https://example.com/funiculars"))
/// ])
/// ```
///
/// - Parameters:
///   - sources: The sources, in citation order. Card numbers follow this order, starting at 1.
///   - isExpanded: Optional two-way open state, for opening the list from your own marker taps. Without it the pill keeps its own.
///   - stacked: How many badges the closed pill shows, 1...5. Defaults to 3.
///   - alignment: Where the pill sits across the width: `.leading` under an answer (the default), `.center` on its own.
///   - style: Surfaces, text and badge colours. Defaults to the SwiftPieces house palette, adapting to light and dark.
///   - onOpen: Called with the tapped source. Without it a card opens the source's `url` through `openURL`.
public struct SourceStack: View {
    /// One cited source.
    public struct Source: Identifiable, Hashable, Sendable {
        public var id: String
        /// The page or document title, up to two lines on its card.
        public var title: String
        /// The site or publisher. Its first letter is the badge.
        public var site: String
        /// A short extra after the site, such as a date. Optional.
        public var detail: String?
        /// Where a tap goes when you don't pass `onOpen`.
        public var url: URL?

        /// `id` defaults to the URL, or to the site and title when there is no URL.
        public init(title: String, site: String, detail: String? = nil, url: URL? = nil, id: String? = nil) {
            self.id = id ?? url?.absoluteString ?? "\(site)|\(title)"
            self.title = title
            self.site = site
            self.detail = detail
            self.url = url
        }
    }

    /// Colours and shape. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The pill and the cards.
        public var surface: Color
        /// Titles and the count.
        public var text: Color
        /// Site lines, numbers and the chevron.
        public var secondary: Color
        /// The initial on each badge.
        public var ink: Color
        /// Badge discs, cycled across sources.
        public var blocks: [Color]
        /// Card corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house value.
        public init(surface: Color? = nil, text: Color? = nil, secondary: Color? = nil, ink: Color? = nil, blocks: [Color]? = nil, cornerRadius: CGFloat = 18) {
            self.surface = surface ?? adaptiveColor(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.text = text ?? adaptiveColor(light: 0x141414, dark: 0xF4F3EF)
            self.secondary = secondary ?? adaptiveColor(light: 0x5C5A56, dark: 0xA6A49F)
            self.ink = ink ?? Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255)
            self.blocks = blocks ?? [0x9CC2FF, 0xFFD976, 0xA9DCB7, 0xCDB8FF, 0xE9D5B3, 0xFF0000].map { hex in
                Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
            }
            self.cornerRadius = max(cornerRadius, 0)
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @Namespace private var flight
    @State private var ownExpanded = false
    @State private var toggleTick = 0
    @State private var openTick = 0

    private let sources: [Source]
    private let isExpanded: Binding<Bool>?
    private let stacked: Int
    private let alignment: HorizontalAlignment
    private let style: Style
    private let onOpen: ((Source) -> Void)?

    public init(_ sources: [Source], isExpanded: Binding<Bool>? = nil, stacked: Int = 3, alignment: HorizontalAlignment = .leading, style: Style = .standard, onOpen: ((Source) -> Void)? = nil) {
        self.sources = sources
        self.isExpanded = isExpanded
        self.stacked = min(max(stacked, 1), 5)
        self.alignment = alignment
        self.style = style
        self.onOpen = onOpen
    }

    private var expanded: Bool { isExpanded?.wrappedValue ?? ownExpanded }
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    public var body: some View {
        if !sources.isEmpty {
            VStack(alignment: alignment, spacing: 8) {
                pill
                if expanded {
                    VStack(spacing: 8) {
                        ForEach(Array(sources.enumerated()), id: \.element.id) { index, source in
                            card(source, index: index)
                                // The cards arrive under the flying badges one after another, and leave together.
                                .transition(motion.transition(.asymmetric(
                                    insertion: .opacity.combined(with: .offset(y: -10)).animation(motion.cascade(motion.reveal, index: index, step: 0.04)),
                                    removal: .opacity.animation(motion.dismiss)
                                )))
                        }
                    }
                }
            }
            // Fills the width offered with the pill at `alignment`, so it stays put as the list opens under it.
            .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
            // One weight, semibold, for every string and symbol (LIQUID_GLASS.md, rule 13).
            .fontWeight(.semibold)
            // One clock for the flight, whether the pill was tapped or the host flipped `isExpanded`: the badges travel
            // on the morph spring with a little give, and come home on the quicker dismiss spring.
            .animation(expanded ? motion.morph : motion.dismiss, value: expanded)
            .sensoryFeedback(.selection, trigger: toggleTick)
            .sensoryFeedback(.impact(weight: .light), trigger: openTick)
        }
    }

    // MARK: Pill

    private var pill: some View {
        Button(action: toggle) {
            HStack(spacing: 10) {
                if !expanded {
                    HStack(spacing: -9) {
                        ForEach(Array(sources.prefix(stacked).enumerated()), id: \.element.id) { index, source in
                            badge(source, index: index, size: 26)
                                .matchedGeometryEffect(id: source.id, in: flight)
                                .zIndex(Double(stacked - index))
                        }
                    }
                }
                Text("^[\(sources.count) source](inflect: true)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.text)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(style.secondary)
                    .rotationEffect(.degrees(expanded ? 180 : 0))
                    .accessibilityHidden(true)
            }
            .padding(.leading, expanded ? 16 : 7)
            .padding(.trailing, 14)
            .frame(minHeight: 40)
            .background(style.surface, in: .capsule)
            .contentShape(.capsule)
            .frame(minHeight: 44)
        }
        .buttonStyle(PiecePressStyle())
        .accessibilityLabel(Text("^[\(sources.count) source](inflect: true)"))
        .accessibilityValue(expanded ? Text("Expanded") : Text("Collapsed"))
        .accessibilityHint(expanded ? Text("Hides the sources.") : Text("Shows the sources."))
    }

    // MARK: Cards

    private func card(_ source: Source, index: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        let line = [source.site, source.detail].compactMap { $0 }.joined(separator: "  ·  ")
        return Button { open(source) } label: {
            HStack(spacing: 12) {
                // The pill's badges land here; the rest arrive with their cards.
                if index < stacked {
                    badge(source, index: index, size: 32)
                        .matchedGeometryEffect(id: source.id, in: flight)
                } else {
                    badge(source, index: index, size: 32)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(source.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(line)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(style.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                // The citation number, matching the [n] markers in the answer.
                Text("\(index + 1)")
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(style.secondary)
                    .frame(minWidth: 24, minHeight: 24)
                    .background(style.secondary.opacity(0.12), in: .circle)
                    .accessibilityHidden(true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(style.surface, in: shape)
            .contentShape(shape)
        }
        .buttonStyle(PiecePressStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Source \(index + 1): \(source.title), \(line)"))
        .accessibilityAddTraits(.isLink)
        .accessibilityHint(Text("Opens the source."))
    }

    /// A colour disc with the site's initial, ringed in the surface so overlapping badges stay apart.
    private func badge(_ source: Source, index: Int, size: CGFloat) -> some View {
        let tint = style.blocks.isEmpty ? Color.accentColor : style.blocks[index % style.blocks.count]
        return Text(String(source.site.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
            .foregroundStyle(style.ink)
            .frame(width: size, height: size)
            .background(tint, in: .circle)
            .overlay { Circle().strokeBorder(style.surface, lineWidth: 2) }
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .accessibilityHidden(true)
    }

    // MARK: Actions

    private func toggle() {
        let next = !expanded
        if let isExpanded { isExpanded.wrappedValue = next } else { ownExpanded = next }
        toggleTick += 1
    }

    private func open(_ source: Source) {
        openTick += 1
        if let onOpen { onOpen(source) } else if let url = source.url { openURL(url) }
    }
}

/// A house-palette colour that follows the interface style.
private func adaptiveColor(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// The sources under an answer about Lisbon's trams, opening and closing on their own.
private struct SourceStackExample: View {
    @State private var expanded = false

    private let sources: [SourceStack.Source] = [
        .init(title: "Why the old trams still run", site: "The Lisbon Review", detail: "2 days ago"),
        .init(title: "Tram 28, stop by stop", site: "Tram Notes", detail: "Updated May"),
        .init(title: "How the funiculars climb", site: "Hill & Harbour"),
        .init(title: "A short history of the tram", site: "City Rails Journal", detail: "2019")
    ]

    var body: some View {
        SourceStack(sources, isExpanded: $expanded, alignment: .center) { _ in }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .background(adaptiveColor(light: 0xF3F2EE, dark: 0x121212))
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(expanded ? 2.6 : 1.2))
                    expanded.toggle()
                }
            }
    }
}

#Preview("Light") {
    SourceStackExample()
}

#Preview("Dark") {
    SourceStackExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, pressMath, press, pressStyle)

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
    /// Follow-through: rank 0 leads, each later rank arrives a beat later on a slightly looser spring. Safe to reverse.
    func follow(_ spring: Spring = PieceMotion.elastic, rank: Int) -> Animation {
        guard !reduceMotion else { return .spring(duration: 0.25, bounce: 0) }
        let k = Double(min(max(rank, 0), 6))
        return .spring(duration: spring.duration + 0.04 * k, bounce: min(spring.bounce + 0.02 * k, 0.55))
    }

    /// One-shot entrances only: item `index` waits 30ms per place, capped at the seventh. Exits go together.
    func cascade(_ animation: Animation, index: Int, step: Double = 0.03) -> Animation {
        guard !reduceMotion, index > 0 else { return animation }
        return animation.delay(step * Double(min(index, 7)))
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
