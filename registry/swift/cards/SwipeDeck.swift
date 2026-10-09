// swiftpieces:
// title: Swipe Deck
// description: "A gesture-driven card stack: the top card follows the finger and swings from where you grabbed it, a tinted liquid glass outcome badge buds in through the card's edge, leaning in from the side you head toward, and stamps at the threshold, melting back out if you return, the cards beneath rise one after another as it leaves, and release past the threshold or a flick throws it left, right, or up at the speed of your finger."
// category: cards
// minIOSVersion: "17.0"
// version: "2.2.0"
// tags: [cards, swipe, stack, drag, gesture, spring, decide]

import SwiftUI

/// Swipeable card stack over Identifiable data. The deck removes the top item from `items` after each throw.
///
/// - Parameters:
///   - items: Bound array of cards, top first. Swiped items are removed from the front.
///   - swipe: Optional command binding. Set it to `.leading`, `.trailing`, or `.top` to throw the top card programmatically; the deck resets it to nil.
///   - visibleCount: How many cards are drawn in the stack.
///   - style: Outcome badges, stack depth, and the empty slot. `.standard` shows Skip, Keep, and Save badges on tinted glass.
///   - onSwipe: Called after a card is thrown, with the direction (`.leading`, `.trailing`, or `.top`) and the item.
///   - onTap: Optional tap handler for the top card.
///   - card: Builds one card. Give it its own shape and surface; the deck sizes it to fill the deck's frame.
public struct SwipeDeck<Item: Identifiable, Card: View>: View {
    /// A tinted glass badge that buds in over the top card while it heads toward one outcome.
    public struct Badge: Sendable {
        /// Short outcome word, for example "Keep".
        public var title: String
        /// Optional SF Symbol drawn before the title.
        public var symbol: String?
        /// The badge's glass tint, while it is out. It drains to clear glass as the badge melts back into the card.
        public var fill: Color
        /// Badge text and glyph color. Keep 4.5:1 contrast against `fill`; the house ink reads on every house tint.
        public var ink: Color

        public init(title: String, symbol: String? = nil, fill: Color, ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)) {
            self.title = title
            self.symbol = symbol
            self.fill = fill
            self.ink = ink
        }
    }

    /// Badges, depth, and the empty slot.
    public struct Style: Sendable {
        /// Badge for a throw to the left. nil hides it.
        public var leading: Badge?
        /// Badge for a throw to the right. nil hides it.
        public var trailing: Badge?
        /// Badge for a throw upward. nil hides it.
        public var top: Badge?
        /// Corner radius of your cards, used for the empty slot outline.
        public var cornerRadius: CGFloat
        /// Shadow strength in light mode; dark mode uses about three times this.
        public var shadowOpacity: Double
        /// Message in the dashed slot left behind when the deck runs out. nil draws nothing.
        public var emptyMessage: String?

        public init(
            leading: Badge? = Badge(title: "Skip", symbol: "xmark", fill: Color(red: 1, green: 0, blue: 0)),
            trailing: Badge? = Badge(title: "Keep", symbol: "heart.fill", fill: Color(red: 0.663, green: 0.863, blue: 0.718)),
            top: Badge? = Badge(title: "Save", symbol: "bookmark.fill", fill: Color(red: 1, green: 0.851, blue: 0.463)),
            cornerRadius: CGFloat = 34,
            shadowOpacity: Double = 0.12,
            emptyMessage: String? = "All caught up"
        ) {
            self.leading = leading
            self.trailing = trailing
            self.top = top
            self.cornerRadius = cornerRadius
            self.shadowOpacity = shadowOpacity
            self.emptyMessage = emptyMessage
        }

        /// House defaults: Skip on signal red, Keep on sage, Save on butter glass, and an "All caught up" slot.
        public static var standard: Style { Style() }
        /// No badges and no empty slot: only the stack.
        public static var plain: Style { Style(leading: nil, trailing: nil, top: nil, emptyMessage: nil) }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Binding private var items: [Item]
    @State private var translation: CGSize = .zero
    @State private var grabbedLow = false
    /// True while the card swings home; the pivot holds until it lands, so a grab on the way home can't flip it.
    @State private var swinging = false
    /// Counts returns home, so only the latest one marks the swing as landed.
    @State private var returns = 0
    @State private var fade: Double = 1
    @State private var isThrowing = false
    @State private var throwTick = 0
    @State private var size = CGSize(width: 1, height: 1)
    @GestureState private var dragging = false  // resets when the system cancels a touch, which skips onEnded

    private let swipe: Binding<Edge?>?
    private let visibleCount: Int
    private let style: Style
    private let onSwipe: (Edge, Item) -> Void
    private let onTap: ((Item) -> Void)?
    private let card: (Item) -> Card

    public init(items: Binding<[Item]>, swipe: Binding<Edge?>? = nil, visibleCount: Int = 3, style: Style = .standard, onSwipe: @escaping (Edge, Item) -> Void, onTap: ((Item) -> Void)? = nil, @ViewBuilder card: @escaping (Item) -> Card) {
        self._items = items
        self.swipe = swipe
        self.visibleCount = max(visibleCount, 1)
        self.style = style
        self.onSwipe = onSwipe
        self.onTap = onTap
        self.card = card
    }

    private var thresholdX: CGFloat { size.width * 0.4 }
    private var thresholdY: CGFloat { size.height * 0.3 }

    /// 0 at rest, 1 at the commit threshold. Drives the stack rising underneath and the threshold tick.
    private var lift: Double {
        Double(min(max(abs(translation.width) / thresholdX, max(-translation.height, 0) / thresholdY), 1))
    }

    /// The direction the top card is heading and how far toward its threshold, or nil near rest.
    private var heading: (edge: Edge, progress: Double)? {
        let x = translation.width / max(thresholdX, 1)
        let y = max(-translation.height, 0) / max(thresholdY, 1)
        guard max(abs(x), y) > 0.05 else { return nil }
        if y > abs(x) { return (.top, Double(min(y, 1))) }
        return (x > 0 ? .trailing : .leading, Double(min(abs(x), 1)))
    }

    public var body: some View {
        let shadow = min(style.shadowOpacity * (colorScheme == .dark ? 3 : 1), 1)
        ZStack {
            if items.isEmpty, let message = style.emptyMessage {
                empty(message)
            }
            // One card more than is shown waits at the back, invisible, and fades up as the top card leaves.
            ForEach(Array(items.prefix(visibleCount + 1).enumerated().reversed()), id: \.element.id) { index, item in
                layer(item, at: index, shadow: shadow)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .fontWeight(.semibold)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .contentShape(.rect)
        .gesture(drag, isEnabled: !isThrowing && !items.isEmpty)
        // A drag the system cancelled (a parent scroll, a call) never reaches onEnded: bring the card home.
        // After a normal release onEnded has already thrown it or sent it home, so this does nothing.
        .onChange(of: dragging) { _, active in
            guard !active, !isThrowing, translation != .zero else { return }
            let motion = PieceMotion(reduceMotion: reduceMotion)
            home(x: motion.snap, y: motion.snap)
        }
        .animation(PieceMotion(reduceMotion: reduceMotion).snap, value: items.count)
        // One tick when a drag crosses the threshold; a throw plays only its own impact.
        .sensoryFeedback(.selection, trigger: lift >= 1) { _, past in past && !isThrowing }
        .sensoryFeedback(.impact(flexibility: .solid), trigger: throwTick)
        .onChange(of: swipe?.wrappedValue) { _, command in
            guard let command else { return }
            throwTop(command)
            swipe?.wrappedValue = nil
        }
    }

    /// One card in the stack: the top card follows the drag and carries the badges; the rest wait in shade.
    private func layer(_ item: Item, at index: Int, shadow: Double) -> some View {
        // The card below rises with the drag and each deeper card a little later along it, so the stack
        // follows through instead of moving in lockstep.
        let depth = index == 0 ? 0 : max(Double(index) - pow(lift, 1 + 0.6 * Double(index - 1)), 0)
        let isTop = index == 0
        let isSpare = index == visibleCount
        let keyOpacity = shadow * (isTop ? 1 + lift * 0.6 : 0.7)
        let keyRadius: CGFloat = isTop ? 18 + lift * 10 : 12
        let keyY: CGFloat = isTop ? 12 + lift * 6 : 8
        // Swings around the edge opposite the finger: a card held low pivots from its top.
        let swing = isTop && !reduceMotion ? Double(translation.width / size.width) * 14 * (grabbedLow ? -1 : 1) : 0
        // While a card flies off, the ones beneath rise on their own follow-through springs, each a beat after the
        // one above, so the next card settles into place with a little give instead of on the flight's flat curve.
        let rise: Animation? = isThrowing && !isTop ? PieceMotion(reduceMotion: reduceMotion).follow(rank: index) : nil
        return card(item)
            .frame(width: size.width, height: size.height)
            .transaction { if let rise { $0.animation = rise } } body: { card in
                card
                    // Cards further down sit in shade, and brighten as they rise.
                    .brightness(-0.05 * min(depth, 2))
                    .shadow(color: .black.opacity(shadow * 0.5), radius: 1, y: 1)
                    .shadow(color: .black.opacity(keyOpacity), radius: keyRadius, y: keyY)
                    .scaleEffect(1 - 0.05 * depth)
                    .offset(y: 16 * depth)
                    .opacity(isTop ? fade : (isSpare ? lift : 1))
            }
            // Above the card's shadow rather than inside it: glass draws in its own layer and would take the card's
            // shadow as a dark halo. Keyed to this card: a thrown card takes its badges with it, and the card that
            // rises starts with none out.
            .overlay {
                if isTop {
                    Badges(style: style, edge: heading?.edge, progress: heading?.progress ?? 0)
                        .opacity(fade)
                }
            }
            // Each axis on its own offset, so a release can carry the finger's horizontal and vertical speed separately.
            .offset(x: isTop ? translation.width : 0)
            .offset(y: isTop ? translation.height : 0)
            .rotationEffect(.degrees(swing), anchor: grabbedLow ? .top : .bottom)
            .zIndex(Double(visibleCount - index))
            .transition(.identity)
            .allowsHitTesting(isTop && !isThrowing)
            .accessibilityElement(children: .combine)
            .accessibilityHidden(!isTop)
            .accessibilityAction(named: style.trailing?.title ?? "Swipe right") { throwTop(.trailing) }
            .accessibilityAction(named: style.leading?.title ?? "Swipe left") { throwTop(.leading) }
            .accessibilityAction(named: style.top?.title ?? "Swipe up") { throwTop(.top) }
            .onTapGesture { if isTop { onTap?(item) } }
    }

    private func empty(_ message: String) -> some View {
        RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
            .strokeBorder(.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [7, 7]))
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark")
                        .font(.title2.weight(.semibold))
                    Text(message)
                        .font(.system(.title3, weight: .semibold))
                        .tracking(-0.4)
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(.secondary)
                .padding(24)
            }
            .transition(.opacity.combined(with: .scale(scale: 0.96)))
            .accessibilityElement(children: .combine)
    }

    // MARK: Gesture

    private var drag: some Gesture {
        DragGesture(minimumDistance: 4)
            .updating($dragging) { _, state, _ in state = true }
            .onChanged { drag in
                if translation == .zero, !swinging { grabbedLow = drag.startLocation.y > size.height / 2 }
                // Directly under the finger.
                translation = CGSize(width: drag.translation.width, height: banded(drag.translation.height))
            }
            .onEnded { drag in
                // The card's own speed, not the finger's: pulled down, the band slows it, and a release must not
                // hand it the finger's speed and lurch.
                let h = drag.translation.height
                let velocity = CGSize(width: drag.velocity.width, height: (banded(h + drag.velocity.height * 0.01) - banded(h)) / 0.01)
                let projected = drag.predictedEndTranslation
                if -projected.height > thresholdY && abs(projected.height) > abs(projected.width) {
                    throwTop(.top, along: projected, velocity: velocity)
                } else if abs(projected.width) > thresholdX {
                    throwTop(projected.width > 0 ? .trailing : .leading, along: projected, velocity: velocity)
                } else {
                    // Home at the card's speed, each axis with its own velocity, on the elastic settle, so the card
                    // swings a little past center before it comes to rest.
                    let motion = PieceMotion(reduceMotion: reduceMotion)
                    home(
                        x: motion.settle(velocity: velocity.width, from: translation.width, to: 0),
                        y: motion.settle(velocity: velocity.height, from: translation.height, to: 0)
                    )
                }
            }
    }

    /// Down never commits, so a downward drag moves against rubber-band resistance.
    private func banded(_ height: CGFloat) -> CGFloat {
        height > 0 ? PieceMotion.rubberBand(height, limit: 60) : height
    }

    /// Sends the card home, each axis on its own animation. The swing's pivot holds until the horizontal leg, which
    /// carries the swing, has landed.
    private func home(x: Animation, y: Animation) {
        returns += 1
        let current = returns
        swinging = true
        withAnimation(y) { translation.height = 0 }
        withAnimation(x) { translation.width = 0 } completion: {
            if returns == current { swinging = false }
        }
    }

    /// Flies the top card off along `vector` (or straight out of the given edge), leaving at the card's `velocity`,
    /// then removes it and settles the stack.
    private func throwTop(_ edge: Edge, along vector: CGSize? = nil, velocity: CGSize = .zero) {
        guard !isThrowing, let item = items.first else { return }
        isThrowing = true
        throwTick += 1
        let direction: CGSize = vector ?? {
            switch edge {
            case .top: CGSize(width: 0, height: -1)
            case .leading: CGSize(width: -1, height: -0.1)
            default: CGSize(width: 1, height: -0.1)
            }
        }()
        let scale = max(size.width, size.height) * 1.6 / max(abs(direction.width), abs(direction.height), 1)
        let target = CGSize(width: translation.width + direction.width * scale, height: translation.height + direction.height * scale)

        // Each axis leaves at the card's speed along it. The longer leg carries the completion, so the card is
        // removed only once it is gone, and it goes first: the badges follow the heading, so a frame with only the
        // short leg moved would flash the wrong one.
        let flight = Spring(duration: 0.45, bounce: 0)
        let motion = PieceMotion()
        let horizontal = abs(target.width - translation.width) >= abs(target.height - translation.height)
        let leadX = motion.settle(velocity: velocity.width, from: translation.width, to: target.width, spring: flight)
        let leadY = motion.settle(velocity: velocity.height, from: translation.height, to: target.height, spring: flight)
        withAnimation(reduceMotion ? .easeOut(duration: 0.25) : (horizontal ? leadX : leadY)) {
            if reduceMotion {
                fade = 0
            } else if horizontal {
                translation.width = target.width
            } else {
                translation.height = target.height
            }
        } completion: {
            // Reset and remove in one update: the stack already stands in its next pose, so nothing moves. Split in
            // two, the stack would drop back to rest for a frame and rise again, and the card at the back would blink.
            withTransaction(Transaction()) {
                translation = .zero
                fade = 1
                items.removeFirst()
            }
            swinging = false
            isThrowing = false
            onSwipe(edge, item)
        }
        if !reduceMotion {
            if horizontal {
                withAnimation(leadY) { translation.height = target.height }
            } else {
                withAnimation(leadX) { translation.width = target.width }
            }
        }
    }

    // MARK: Badges

    /// The outcome badges over the top card: tinted glass capsules resting where they stay in view however far the card
    /// travels, at the top centre for a throw left or right and the bottom centre for a throw up (the edge that leads
    /// goes off screen first). Each buds in through its nearest edge: Keep and Skip lean in from the side the card heads
    /// for, Save rises through the bottom edge the way the card is heading. The card's edge hides a badge while it is
    /// home, so it emerges from the card rather than appearing over it, and it melts back out the same way when the card
    /// turns another way or comes home. Its own view, with its own buds, so it lives and dies with the card it sits on.
    private struct Badges: View {
        let style: Style
        /// The direction the card is heading and how far toward its threshold, 0...1.
        let edge: Edge?
        let progress: Double

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @ScaledMetric(relativeTo: .title3) private var height: CGFloat = 44
        @State private var buds = PieceBuds()
        /// The badge out now, or on its way out.
        @State private var shown: Edge?
        @State private var width: CGFloat = 0
        /// The gap between the card's top edge and a badge at rest.
        private let inset: CGFloat = 20

        var body: some View {
            PieceLiquidGroup {
                ZStack {
                    bubble(style.trailing, edge: .trailing)
                    bubble(style.leading, edge: .leading)
                    bubble(style.top, edge: .top)
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            // The card's own outline: a badge at home sits just past its edge, out of sight.
            .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
            .onChange(of: edge) { update() }
            .onChange(of: progress) { update() }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }

        @ViewBuilder
        private func bubble(_ badge: Badge?, edge: Edge) -> some View {
            let id = Self.id(edge)
            if let badge, buds.contains(id) {
                let out = buds.isOut(id)
                let current = shown == edge
                let locked = current && progress >= 1
                let motion = PieceMotion(reduceMotion: reduceMotion)
                // Swells a little toward the threshold under the finger, then stamps past it with the success spring's
                // give, and lets go firmly when the card is pulled back short of it.
                let scale = reduceMotion ? 1 : (locked ? 1.08 : 0.92 + 0.08 * (current ? progress : 0))
                HStack(spacing: 6) {
                    if let symbol = badge.symbol {
                        Image(systemName: symbol)
                            .font(.subheadline.weight(.semibold))
                    }
                    Text(badge.title)
                        .font(.system(.title3, weight: .semibold))
                        .tracking(-0.4)
                        .lineLimit(1)
                }
                .foregroundStyle(badge.ink)
                .pieceBudContent(out: out)
                .padding(.horizontal, 16)
                .frame(minHeight: height)
                .fixedSize()
                // Its tint drains as it melts, so it leaves as clear glass rather than a coloured blot.
                .pieceLiquid(Capsule(), tint: out ? badge.fill : nil, interactive: false)
                // Through the glass, so the words swell with their capsule (a scaleEffect on glass leaves them behind).
                .pieceLiquidScale(scale)
                .animation(locked ? motion.success : motion.snap, value: locked)
                .pieceBud(out: out, home: home(edge))
                .padding(edge == .top ? .bottom : .top, inset)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: edge == .top ? .bottom : .top)
            }
        }

        /// Where a badge waits: just past the card's edge it rests by. Keep and Skip wait above the top edge, leaning
        /// toward the side the card heads for, so they bud in from that side and melt back out toward it; Save waits
        /// below the bottom edge and rises the way the card is going.
        private func home(_ edge: Edge) -> CGSize {
            if edge == .top { return CGSize(width: 0, height: inset + height) }
            let side: CGFloat = edge == .trailing ? 1 : -1
            return CGSize(width: side * min(width * 0.16, 52), height: -(inset + height))
        }

        /// Buds a badge once the drag means it, a fifth of the way to the threshold, and melts it back once the card is
        /// nearly home or heads another way, so a finger resting near the start never flickers one.
        private func update() {
            let next: Edge?
            if let edge, edge == shown {
                next = progress > 0.08 ? edge : nil
            } else if let edge, progress >= 0.2 {
                next = edge
            } else {
                next = nil
            }
            guard next != shown else { return }
            let leaving = shown
            shown = next
            // Separately, so the badge coming in never waits for the one going home: they melt past each other.
            if let leaving {
                Task { await buds.gather([Self.id(leaving)], reduceMotion: reduceMotion) }
            }
            if let next, badge(for: next) != nil {
                Task { await buds.bloom([Self.id(next)], reduceMotion: reduceMotion) }
            }
        }

        private func badge(for edge: Edge) -> Badge? {
            switch edge {
            case .leading: style.leading
            case .trailing: style.trailing
            default: style.top
            }
        }

        private static func id(_ edge: Edge) -> String {
            switch edge {
            case .leading: "leading"
            case .trailing: "trailing"
            default: "top"
            }
        }
    }
}

// MARK: - Example

/// Tonight's dinner: recipe cards as solid blocks, each with a plate of colour cropped by its corner, the cooking
/// time set large, and the dish under a hairline.
private struct SwipeDeckExample: View {
    struct Recipe: Identifiable {
        let id: Int
        let title: String
        let detail: String
        let minutes: Int
        let fill: Color
        let bowl: Color
    }

    @Environment(\.colorScheme) private var colorScheme
    @State private var command: Edge?
    @State private var recipes: [Recipe] = [
        Recipe(id: 0, title: "Miso aubergine", detail: "Vegetarian  ·  Serves 2", minutes: 25, fill: Self.sky, bowl: Self.tangerine),
        Recipe(id: 1, title: "Lemon orzo", detail: "One pot  ·  Serves 4", minutes: 20, fill: Self.butter, bowl: Self.sage),
        Recipe(id: 2, title: "Green curry", detail: "Spicy  ·  Serves 3", minutes: 35, fill: Self.sage, bowl: Self.butter),
        Recipe(id: 3, title: "Harissa chickpeas", detail: "Vegan  ·  Serves 2", minutes: 30, fill: Self.lilac, bowl: Self.tangerine)
    ]

    private static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private static let tangerine = Color(red: 1, green: 0, blue: 0)
    private static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    private static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    private static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
    private static let lilac = Color(red: 0.804, green: 0.722, blue: 1)

    var body: some View {
        SwipeDeck(items: $recipes, swipe: $command) { _, _ in } card: { recipe in
            RecipeCard(recipe: recipe, ink: Self.ink)
        }
        .frame(width: 300, height: 390)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
    }

    private struct RecipeCard: View {
        let recipe: Recipe
        let ink: Color

        var body: some View {
            let shape = RoundedRectangle(cornerRadius: 34, style: .continuous)
            shape
                .fill(recipe.fill)
                .overlay(alignment: .topTrailing) {
                    // A plate of colour cropped by the corner: the card's one shape.
                    Circle()
                        .fill(recipe.bowl)
                        .frame(width: 220, height: 220)
                        .offset(x: 64, y: -70)
                        .accessibilityHidden(true)
                }
                .overlay {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("TONIGHT")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.2)
                        Spacer(minLength: 8)
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(recipe.minutes)")
                                .font(.system(size: 132, weight: .semibold))
                                .tracking(-7)
                                .monospacedDigit()
                            Text("min")
                                .font(.headline.weight(.semibold))
                        }
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .accessibilityElement(children: .combine)
                        Rectangle()
                            .fill(ink.opacity(0.18))
                            .frame(height: 1)
                            .padding(.top, 4)
                            .accessibilityHidden(true)
                        Text(recipe.title)
                            .font(.system(size: 29, weight: .semibold))
                            .tracking(-1)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .padding(.top, 16)
                        Text(recipe.detail)
                            .font(.subheadline.weight(.semibold))
                            .opacity(0.62)
                            .padding(.top, 2)
                    }
                    .foregroundStyle(ink)
                    .padding(22)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                .clipShape(shape)
        }
    }
}

#Preview("Light") {
    SwipeDeckExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    SwipeDeckExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum, rubberBand)

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
    /// Where a flick at `velocity` (pt/s) coasts to. 0.998 coasts like a scroll view; 0.99 suits detents.
    nonisolated static func project(_ position: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.99) -> CGFloat {
        position + velocity / 1000 * decelerationRate / (1 - decelerationRate)
    }

    /// The candidate closest to `value`.
    nonisolated static func nearest(_ value: CGFloat, in candidates: [CGFloat]) -> CGFloat {
        candidates.min { abs($0 - value) < abs($1 - value) } ?? value
    }

    /// A settle that leaves at the finger's speed (pt/s). One per axis, each on its own `.offset(x:)` / `.offset(y:)`:
    /// a spring takes one velocity. SwiftUI's own velocity carry-over is unreliable; this always carries it.
    func settle(velocity: CGFloat, from current: CGFloat, to target: CGFloat, spring: Spring = PieceMotion.elastic) -> Animation {
        let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : spring
        let distance = target - current
        guard abs(distance) >= 1 else { return .spring(spring) }
        // In whole distances per second, capped near the spring's frequency: a hard flick adds give, not a slingshot.
        // At exactly the frequency a critically damped spring cannot pass its target, so Reduce Motion stops there.
        let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
        let relative = min(max(Double(velocity / distance), -cap), cap)
        return .interpolatingSpring(spring, initialVelocity: relative)
    }
}

extension PieceMotion {
    /// A scroll view's edge resistance for a pull `overshoot` points past a limit; never reaches `limit`.
    /// About 24 to 40 for thumbs and toggles, 60 to 120 for cards and sheets. Band the total pull, not deltas.
    nonisolated static func rubberBand(_ overshoot: CGFloat, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard limit > 0, overshoot != 0 else { return 0 }
        let banded = (1 - 1 / (abs(overshoot) * coefficient / limit + 1)) * limit
        return overshoot < 0 ? -banded : banded
    }

    /// `value` inside `range` passes through unchanged; past either end it moves with rubber-band resistance.
    nonisolated static func rubberBand(_ value: CGFloat, in range: ClosedRange<CGFloat>, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        if value < range.lowerBound { return range.lowerBound + rubberBand(value - range.lowerBound, limit: limit, coefficient: coefficient) }
        if value > range.upperBound { return range.upperBound + rubberBand(value - range.upperBound, limit: limit, coefficient: coefficient) }
        return value
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, bud)

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

// swiftpieces-liquid: end
