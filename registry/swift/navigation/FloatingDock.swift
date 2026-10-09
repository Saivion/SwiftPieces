// swiftpieces:
// title: Floating Dock
// description: "A floating liquid glass dock: every item is its own glass bubble, resting apart, and the selected one floods with the signal tint. A drag across the dock lifts each item under the finger like a key while one glass name bubble buds out above it on a liquid neck, glides with the finger and morphs its name, then melts back in as the release commits; badges are signal bubbles joined to their items, and the whole dock tucks away on scroll."
// category: navigation
// version: "2.2.0"
// pro: lens-tab-bar
// minIOSVersion: "17.0"
// tags: [tab bar, dock, navigation, gesture, badge]

import SwiftUI

/// Floating bottom dock of 4–5 items, each its own liquid glass bubble, with a tinted selection and a scrub-to-pick gesture.
///
/// The items rest apart, as separate bubbles. A finger scrubbing across the dock buds a name bubble out of the item
/// under it, joined to that item by a liquid neck, and melts it back in on release. Badges are small signal bubbles
/// joined to their items.
///
/// - Parameters:
///   - items: Dock items in order. Four or five work best.
///   - selection: Index of the selected item.
///   - tint: Glass tint of the selected item. Defaults to the style's indicator, the signal red.
///   - scrollProgress: 0 keeps the dock in place, 1 tucks it below the screen. Feed it a value derived from scroll direction to hide the dock while scrolling down.
///   - style: Tints and ink. Defaults to `.standard`, the house palette.
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
        /// Unused since the liquid glass refactor: every item is its own glass bubble, so there is no surface behind them. Kept so existing code still compiles.
        public var surface: Color
        /// Glass tint of the selected item.
        public var indicator: Color
        /// Icon color on the selected item, and a badge's count while it is tinted.
        public var selectedInk: Color
        /// Icon color for unselected items.
        public var inactive: Color
        /// Glass tint of a badge bubble. On the selected item the badge drains to clear glass, so it reads apart from the selection.
        public var badge: Color
        /// Unused since the liquid glass refactor: the dock is always liquid glass, a frosted material before iOS 26 and solid under Reduce Transparency. Kept so existing code still compiles.
        public var usesGlass: Bool

        public init(surface: Color, indicator: Color, selectedInk: Color, inactive: Color, badge: Color, usesGlass: Bool = false) {
            self.surface = surface
            self.indicator = indicator
            self.selectedInk = selectedInk
            self.inactive = inactive
            self.badge = badge
            self.usesGlass = usesGlass
        }

        /// Signal selection with ink on it, muted icons on clear glass, signal badges.
        public static let standard = Style(
            surface: adaptive(0xFFFFFF, 0x1C1C1C),
            indicator: adaptive(0xFF0000, 0xFF0000),
            selectedInk: adaptive(0x141414, 0x141414),
            inactive: adaptive(0x5C5A56, 0xA6A49F),
            badge: adaptive(0xFF0000, 0xFF0000)
        )

        fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }

    /// Each item's bubble: the 48 pt target the dock has always had, so five bubbles still fit a phone resting apart.
    private static let itemSize: CGFloat = 48
    /// A badge bubble's height; a longer count widens it.
    private static let badgeSize: CGFloat = 18
    /// How far the item under the finger rises, and how much it swells.
    private static let rise: CGFloat = 5
    private static let swell: CGFloat = 1.14
    /// Text on clear glass follows the appearance: dark ink in light mode, near white in dark.
    private static let ink = Style.adaptive(0x141414, 0xF4F3EF)

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @ScaledMetric(relativeTo: .footnote) private var nameHeight: CGFloat = 30
    @Binding private var selection: Int
    @State private var frames: [Int: CGRect] = [:]
    @State private var scrubbing: Int? = nil
    @State private var pressed: Int? = nil
    /// True while a finger is down. Resets by itself when the system cancels the touch, which `onEnded` misses.
    @GestureState private var touching = false
    /// The name bubble: out while a scrub is on, melting home into the item it named once the scrub ends.
    @State private var buds = PieceBuds()
    /// The item the name bubble is over. It outlasts the scrub, so the bubble melts into the item it last named.
    @State private var named = 0

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

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        // The named item's badge stays melted in while the name bubble is anywhere near it, out or on its way home.
        let nameOver = buds.contains("name") ? named : nil
        PieceLiquidGroup {
            HStack(spacing: PieceLiquid.apart) {
                ForEach(items.indices, id: \.self) { index in
                    DockItem(item: items[index], selected: index == selection, hovered: scrubbing == index, pressed: pressed == index, named: nameOver == index, tint: tint, style: style)
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("floatingDock")) } action: { frames[index] = $0 }
                        .zIndex(scrubbing == index ? 1 : 0)
                        .accessibilityAction { selection = index }
                }
            }
            .padding(6)
            .coordinateSpace(.named("floatingDock"))
            // Under the items, so the name bubble melting home slips in behind its item's icon instead of over it.
            .background { nameBubble }
        }
        .fontWeight(.semibold)
        .contentShape(.rect)
        .gesture(scrub)
        // A tap, a scrub's release, VoiceOver and the binding all move the tint the same way: the old bubble drains
        // as the new one floods, landing with a small give.
        .animation(motion.snap, value: selection)
        // A touch the system cancels (an alert, a system gesture) never reaches onEnded: let go without selecting.
        // After a normal release onEnded has already cleared both, so this does nothing.
        .onChange(of: touching) { _, active in
            guard !active else { return }
            scrubbing = nil
            pressed = nil
        }
        .onChange(of: scrubbing != nil) { _, on in
            Task {
                if on { await buds.bloom(["name"], reduceMotion: reduceMotion) } else { await buds.gather(["name"], reduceMotion: reduceMotion) }
            }
        }
        .padding(.horizontal, 24)
        .offset(y: scrollProgress * 120)
        .opacity(Double(1 - scrollProgress))
        .animation(tuck(motion), value: scrollProgress)
        .sensoryFeedback(.selection, trigger: scrubbing) { _, new in new != nil }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: selection)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tab bar")
        .accessibilityAddTraits(.isTabBar)
        .accessibilityHidden(scrollProgress > 0.5)
    }

    /// Tucking away is quick and firm; coming back opens a little slower. A value between the ends moves the dock
    /// directly, so a progress derived from the scroll offset tracks the scroll instead of trailing it.
    private func tuck(_ motion: PieceMotion) -> Animation? {
        if scrollProgress >= 1 { return motion.dismiss }
        if scrollProgress <= 0 { return motion.reveal }
        return nil
    }

    // MARK: Name bubble

    /// One glass name bubble for the whole dock. A scrub buds it out of the item under the finger to rest a liquid neck
    /// above it; it glides from item to item a beat behind the item's rise while its name morphs letter by letter, so a
    /// fast scrub reads as one bubble travelling. On release it narrows to a drop and melts back into the item it named.
    /// Under Reduce Motion it fades in and out where it rests and steps from item to item without sliding.
    private var nameBubble: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let frame = frames[named] ?? .zero
        let out = buds.isOut("name")
        // The item under the finger rises and swells, so the bubble rests a joined gap above where its top then is.
        let lift = reduceMotion ? 0 : Self.rise + Self.itemSize / 2 * (Self.swell - 1)
        // Home is the item's centre, where a drop the bubble's height sits wholly inside it.
        let home = PieceLiquid.joined + nameHeight / 2 + frame.height / 2
        return BubblePlacement(point: CGPoint(x: frame.midX, y: frame.minY - PieceLiquid.joined), mirrored: layoutDirection == .rightToLeft) {
            if buds.contains("name"), items.indices.contains(named), frames[named] != nil {
                PieceMorphText(text: items[named].title, font: .footnote.weight(.semibold))
                    .foregroundStyle(Self.ink)
                    .pieceBudContent(out: out)
                    .padding(.horizontal, 12)
                    // Out, it fits its name; home, it is a round drop, so it melts into the item without spilling past it.
                    .frame(width: out || reduceMotion ? nil : nameHeight, height: nameHeight)
                    .clipShape(.capsule)
                    .pieceLiquid(.capsule, interactive: false)
                    .pieceBud(out: out, rest: CGSize(width: 0, height: -lift), home: CGSize(width: 0, height: home))
            }
        }
        .animation(reduceMotion ? nil : motion.follow(PieceMotion.responsive, rank: 1), value: named)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Puts the name bubble's bottom centre on `point`. Placing it by layout rather than by offset keeps the bubble's
    /// own frame where it shows, so its bud offsets are measured from its resting place above the item.
    private struct BubblePlacement: Layout {
        var point: CGPoint
        /// Item frames count from the left, but a right-to-left layout places from the right edge.
        var mirrored: Bool

        func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
            proposal.replacingUnspecifiedDimensions()
        }

        func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
            let x = mirrored ? bounds.width - point.x : point.x
            for subview in subviews {
                subview.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + point.y), anchor: .bottom, proposal: .unspecified)
            }
        }
    }

    // MARK: Scrub

    /// A touch that starts on an item presses it; moving across the dock lifts each item under the finger, and release commits.
    private var scrub: some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($touching) { _, touching, _ in touching = true }
            .onChanged { value in
                guard let index = item(nearest: value.location.x) else { return }
                if pressed == nil, scrubbing == nil { pressed = index }
                let travelled = abs(value.translation.width) > 8 || abs(value.translation.height) > 8
                if travelled || scrubbing != nil {
                    pressed = nil
                    if index != scrubbing {
                        scrubbing = index
                        named = index
                    }
                }
            }
            .onEnded { _ in
                if let index = scrubbing ?? pressed { selection = index }
                scrubbing = nil
                pressed = nil
            }
    }

    /// The item whose centre is nearest `x`. The bubbles rest apart, so a finger between two belongs to the closer one
    /// and a scrub never drops out over a gap.
    private func item(nearest x: CGFloat) -> Int? {
        frames.min { abs($0.value.midX - x) < abs($1.value.midX - x) }?.key
    }

    // MARK: Item

    private struct DockItem: View {
        let item: Item
        let selected: Bool
        let hovered: Bool
        let pressed: Bool
        /// The name bubble is over this item: its badge melts in to make room and buds back out once the name has gone.
        let named: Bool
        let tint: Color
        let style: Style
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var selectionChanges = 0
        @State private var bounce = 0
        /// The badge bubble: out while there is a count to show and no name bubble over the item.
        @State private var buds = PieceBuds()
        /// The last count shown, held while the badge melts home so it never rolls to zero on the way.
        @State private var lastCount = 0
        @State private var badgeWidth = FloatingDock.badgeSize

        private var showsBadge: Bool { (item.badge ?? 0) > 0 && !named }

        var body: some View {
            let motion = PieceMotion(reduceMotion: reduceMotion)
            ZStack {
                // Under the bubble, so a badge melting home slips in behind the icon.
                if buds.contains("badge") { badge(motion) }
                bubble(motion)
            }
            .frame(width: FloatingDock.itemSize, height: FloatingDock.itemSize)
            // The tint floods or drains, and the symbol swaps, on the selection's snap even when a press releases in
            // the same update (a tap), so the press's release spring never carries them.
            .animation(motion.snap, value: selected)
            // The liquid press, so the symbol sinks with its glass.
            .pieceLiquidPress(pressed)
            // A key rises under the finger with a little give and drops back firm, so the one the finger left never
            // wobbles against the one it found. The swell is glass, so it goes through the liquid scale (a scaleEffect
            // on glass leaves the symbol behind), on an animation keyed to the hover: a scoped animation reaches only
            // the modifiers in its closure, not the glass inside the key. The selection keeps its own snap, set inside.
            .pieceLiquidScale(hovered && !reduceMotion ? FloatingDock.swell : 1)
            .animation(hovered ? motion.follow(rank: 0) : motion.dismiss, value: hovered)
            // Scoped to the lift, so it never carries the selection change.
            .animation(hovered ? motion.follow(rank: 0) : motion.dismiss) { key in
                key.offset(y: hovered && !reduceMotion ? -FloatingDock.rise : 0)
            }
            .onAppear {
                lastCount = item.badge ?? 0
                if showsBadge { buds.place(["badge"]) }
            }
            .onChange(of: item.badge) { _, count in
                if let count, count > 0 { lastCount = count }
            }
            .onChange(of: showsBadge) { _, shows in
                Task {
                    if shows { await buds.bloom(["badge"], reduceMotion: reduceMotion) } else { await buds.gather(["badge"], reduceMotion: reduceMotion) }
                }
            }
            .onChange(of: selected) { selectionChanges += 1 }
            // The symbol bounces as the tint lands under it, not as it drains from the old item. Losing the selection
            // first cancels it. Under Reduce Motion the tint and the filled symbol carry it.
            .task(id: selectionChanges) {
                guard selectionChanges > 0, selected, !reduceMotion else { return }
                try? await Task.sleep(for: .milliseconds(120))
                if !Task.isCancelled { bounce += 1 }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.title)
            .accessibilityValue(item.badge.map { "\($0) new" } ?? "")
            .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        }

        /// The item's glass bubble. Selected, it floods with the tint and its symbol fills.
        private func bubble(_ motion: PieceMotion) -> some View {
            ZStack {
                Image(systemName: item.systemImage)
                    .font(.system(size: 19, weight: .semibold))
                    .symbolVariant(selected ? .fill : .none)
                    .symbolEffect(.bounce, value: bounce)
                    .id(selected)
                    .transition(motion.swap)
            }
            .foregroundStyle(selected ? style.selectedInk : style.inactive)
            .frame(width: FloatingDock.itemSize, height: FloatingDock.itemSize)
            .pieceLiquid(.circle, tint: selected ? tint : nil, interactive: false)
        }

        /// A signal bubble joined to the item by a liquid neck. It buds out of the item's centre when a count arrives
        /// and melts back in when it clears.
        private func badge(_ motion: PieceMotion) -> some View {
            let out = buds.isOut("badge")
            // Tinted only while out, and drained on the selected item so it stands apart from the selection's tint.
            let tinted = out && !selected
            let count = (item.badge ?? 0) > 0 ? item.badge ?? 0 : lastCount
            let height = FloatingDock.badgeSize
            // The leading cap rests a joined gap off the rim, 60° up the trailing side: clear of the next item, which
            // rests apart, so the neck only ever reaches its own item. A longer count grows away from the item.
            let reach = FloatingDock.itemSize / 2 + PieceLiquid.joined + height / 2
            let rest = CGSize(width: reach * 0.5 + (badgeWidth - height) / 2, height: -reach * 0.866)
            return Text(count > 99 ? "99+" : "\(count)")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .contentTransition(rolling(count))
                .foregroundStyle(tinted ? style.selectedInk : FloatingDock.ink)
                .padding(.horizontal, 5)
                .frame(minWidth: height, minHeight: height)
                .fixedSize()
                .pieceBudContent(out: out)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { badgeWidth = $0 }
                .pieceLiquid(.capsule, tint: tinted ? style.badge : nil, interactive: false)
                // A count is read, so it rolls to its new value without overshoot.
                .animation(motion.value, value: count)
                .pieceBud(out: out, rest: rest, home: .zero)
        }

        /// Counts roll on their digits; under Reduce Motion they cross-fade.
        private func rolling(_ count: Int) -> ContentTransition {
            reduceMotion ? .opacity : .numericText(value: Double(count))
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, pressMath)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud, morphText)

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

/// The press for a glass control: the same size-aware sink and lean as `piecePress`, applied through
/// `pieceLiquidScale` so the glass and what it carries sink together (a plain scaleEffect on glass leaves the content
/// behind). Put the glass inside what it presses: the label of a button, the view this modifies. Under Reduce Motion
/// it shades instead of moving.
private struct PieceLiquidPress: ViewModifier {
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
        // A scale about `anchor` is a scale about the centre plus this shift toward the anchor.
        let lean = CGSize(width: (anchor.x - 0.5) * size.width * (1 - scale), height: (anchor.y - 0.5) * size.height * (1 - scale))
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .pieceLiquidScale(scale)
            .offset(lean)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

/// `PiecePressStyle` for glass buttons: the label (with its `.pieceLiquid` inside) sinks as one.
private struct PieceLiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed, depth: depth)
    }
}

private extension View {
    /// Sinks this view's glass while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func pieceLiquidPress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PieceLiquidPress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// The bud: how a bubble leaves and rejoins its parent, driven explicitly so every bubble shows the whole cycle.
///
/// A bubble is born at `home`, inside its parent, where the two glass shapes are one. It springs out to `rest`, and
/// while it is inside the merge distance a neck holds it to the parent, thinning as it goes, until it snaps free.
/// Going home it springs back on a spring with no bounce, the neck reaches out and re-forms, and only once it has
/// melted all the way in is it removed. Both offsets are relative to where the bubble is laid out. Under Reduce
/// Motion it stays at `rest`: its content fades and its glass closes in place.
private struct PieceBud: ViewModifier {
    var out: Bool
    var rest: CGSize
    var home: CGSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            // No travel. Inside a group glass ignores opacity, so the glass closes to nothing in place on the short
            // Reduce Motion ease while its content fades; the opacity covers a bubble outside a group.
            content
                .pieceLiquidScale(out ? 1 : 0.001)
                .opacity(out ? 1 : 0)
                .offset(rest)
        } else {
            // The glass shrinks through `pieceLiquidScale`, never a plain scaleEffect (see there), then moves.
            content
                .pieceLiquidScale(out ? 1 : PieceLiquid.homeScale)
                .offset(out ? rest : home)
        }
    }
}

/// A bubble's own content, on its own clock: gone the moment the bubble heads home, so it never rides over the
/// parent's content, and arriving just after the bubble leaves.
private struct PieceBudContent: ViewModifier {
    var out: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: out ? 0 : 6)
            .opacity(out ? 1 : 0)
            .animation(out ? .easeOut(duration: 0.3).delay(0.1) : .easeOut(duration: 0.14), value: out)
    }
}

private extension View {
    /// Places a bubble at `rest` while `out`, and at `home` (inside its parent, shrunk) while not.
    func pieceBud(out: Bool, rest: CGSize = .zero, home: CGSize) -> some View {
        modifier(PieceBud(out: out, rest: rest, home: home))
    }

    /// Hides a bubble's icon or label while it is home. Put it on the content, inside the glass.
    func pieceBudContent(out: Bool) -> some View {
        modifier(PieceBudContent(out: out))
    }
}

/// Which bubbles exist and which are out. A bubble is added home with no animation, sent out on the next frame,
/// and called home before it is removed, so it always melts in rather than fading. Keep one in `@State`.
@MainActor @Observable
private final class PieceBuds {
    private(set) var present: [String] = []
    private(set) var out: Set<String> = []
    /// The latest call for each bubble. A bloom or gather that has been overtaken (a bubble sent home while it was
    /// still waiting to go out, or called out again while melting) leaves that bubble alone.
    @ObservationIgnored private var turn: [String: Int] = [:]

    func contains(_ id: String) -> Bool { present.contains(id) }
    func isOut(_ id: String) -> Bool { out.contains(id) }

    private func claim(_ ids: [String]) -> [String: Int] {
        var mine: [String: Int] = [:]
        for id in ids {
            let next = (turn[id] ?? 0) + 1
            turn[id] = next
            mine[id] = next
        }
        return mine
    }

    /// Puts bubbles straight out at rest with no motion: a view's first frame, or a state restored.
    func place(_ ids: [String]) {
        _ = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
            out.formUnion(ids)
        }
    }

    /// Adds bubbles home, then sends each out, `stagger` seconds apart, after an optional `delay`.
    func bloom(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.05, delay: Double = 0) async {
        let mine = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
        }
        try? await Task.sleep(for: .milliseconds(24 + Int(max(delay, 0) * 1000)))
        let split = PieceLiquid.split(reduceMotion: reduceMotion)
        for (i, id) in ids.enumerated() where turn[id] == mine[id] {
            withAnimation(split.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.insert(id) }
        }
    }

    /// Calls bubbles home, last first, then removes them once they have melted in.
    func gather(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.04) async {
        let mine = claim(ids)
        let home = PieceLiquid.home(reduceMotion: reduceMotion)
        for (i, id) in ids.reversed().enumerated() {
            withAnimation(home.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.remove(id) }
        }
        try? await Task.sleep(for: .milliseconds(Int((0.52 + Double(ids.count) * stagger) * 1000)))
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { present.removeAll { ids.contains($0) && !out.contains($0) && turn[$0] == mine[$0] } }
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
