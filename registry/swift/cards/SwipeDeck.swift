// swiftpieces:
// title: Swipe Deck
// description: "A gesture-driven card stack: the top card follows the finger and swings from its base, a solid outcome badge fades in for the direction you are heading and locks at the threshold, the cards beneath rise as it leaves, and release past the threshold or a flick throws it left, right, or up."
// category: cards
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [cards, swipe, stack, drag, gesture, spring, decide]

import SwiftUI

/// Swipeable card stack over Identifiable data. The deck removes the top item from `items` after each throw.
///
/// - Parameters:
///   - items: Bound array of cards, top first. Swiped items are removed from the front.
///   - swipe: Optional command binding. Set it to `.leading`, `.trailing`, or `.top` to throw the top card programmatically; the deck resets it to nil.
///   - visibleCount: How many cards are drawn in the stack.
///   - style: Outcome badges, stack depth, and the empty slot. `.standard` shows Skip, Keep, and Save badges in house blocks.
///   - onSwipe: Called after a card is thrown, with the direction (`.leading`, `.trailing`, or `.top`) and the item.
///   - onTap: Optional tap handler for the top card.
///   - card: Builds one card. Give it its own shape and surface; the deck sizes it to fill the deck's frame.
public struct SwipeDeck<Item: Identifiable, Card: View>: View {
    /// A badge that fades in over the top card while it heads toward one outcome.
    public struct Badge: Sendable {
        /// Short outcome word, for example "Keep".
        public var title: String
        /// Optional SF Symbol drawn before the title.
        public var symbol: String?
        /// Block fill behind the badge.
        public var fill: Color
        /// Badge text color. Keep 4.5:1 contrast against `fill`.
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

        /// House defaults: Skip in tangerine, Keep in sage, Save in butter, and an "All caught up" slot.
        public static var standard: Style { Style() }
        /// No badges and no empty slot: only the stack.
        public static var plain: Style { Style(leading: nil, trailing: nil, top: nil, emptyMessage: nil) }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Binding private var items: [Item]
    @State private var translation: CGSize = .zero
    @State private var fade: Double = 1
    @State private var isThrowing = false
    @State private var throwTick = 0
    @State private var size = CGSize(width: 1, height: 1)

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
            ForEach(Array(items.prefix(visibleCount).enumerated().reversed()), id: \.element.id) { index, item in
                layer(item, at: index, shadow: shadow)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .contentShape(.rect)
        .gesture(drag, isEnabled: !isThrowing && !items.isEmpty)
        .animation(.spring(duration: 0.4, bounce: 0.2), value: items.count)
        .sensoryFeedback(.selection, trigger: lift >= 1) { _, past in past }
        .sensoryFeedback(.impact(flexibility: .solid), trigger: throwTick)
        .onChange(of: swipe?.wrappedValue) { _, command in
            guard let command else { return }
            throwTop(command)
            swipe?.wrappedValue = nil
        }
    }

    /// One card in the stack: the top card follows the drag and carries the badges; the rest wait in shade.
    private func layer(_ item: Item, at index: Int, shadow: Double) -> some View {
        let depth = max(Double(index) - lift, 0)
        let isTop = index == 0
        let keyOpacity = shadow * (isTop ? 1 + lift * 0.6 : 0.7)
        let keyRadius: CGFloat = isTop ? 18 + lift * 10 : 12
        let keyY: CGFloat = isTop ? 12 + lift * 6 : 8
        let swing = isTop && !reduceMotion ? Double(translation.width / size.width) * 14 : 0
        return card(item)
            .frame(width: size.width, height: size.height)
            .overlay { if isTop { badges } }
            // Cards further down sit in shade, and brighten as they rise.
            .brightness(-0.05 * min(depth, 2))
            .shadow(color: .black.opacity(shadow * 0.5), radius: 1, y: 1)
            .shadow(color: .black.opacity(keyOpacity), radius: keyRadius, y: keyY)
            .scaleEffect(1 - 0.05 * depth)
            .offset(y: 16 * depth)
            .opacity(isTop ? fade : 1)
            .offset(isTop ? translation : .zero)
            .rotationEffect(.degrees(swing), anchor: .bottom)
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

    // MARK: Badges

    @ViewBuilder
    private var badges: some View {
        let current = heading
        ZStack {
            if let badge = style.trailing {
                badgeView(badge, progress: current?.edge == .trailing ? current!.progress : 0, tilt: -10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            if let badge = style.leading {
                badgeView(badge, progress: current?.edge == .leading ? current!.progress : 0, tilt: 10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
            if let badge = style.top {
                badgeView(badge, progress: current?.edge == .top ? current!.progress : 0, tilt: 0)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
        }
        .padding(20)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Fades in with progress and locks with a small pop at the threshold.
    private func badgeView(_ badge: Badge, progress: Double, tilt: Double) -> some View {
        let locked = progress >= 1
        return HStack(spacing: 6) {
            if let symbol = badge.symbol {
                Image(systemName: symbol).font(.subheadline.weight(.bold))
            }
            Text(badge.title)
                .font(.system(.title3, weight: .bold))
                .tracking(-0.4)
        }
        .foregroundStyle(badge.ink)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .background(badge.fill, in: Capsule())
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        .opacity(min(progress * 1.6, 1))
        .scaleEffect(reduceMotion ? 1 : (locked ? 1.08 : 0.8 + 0.2 * progress))
        .rotationEffect(.degrees(reduceMotion ? 0 : tilt))
        .animation(.spring(duration: 0.3, bounce: 0.5), value: locked)
    }

    private func empty(_ message: String) -> some View {
        RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
            .strokeBorder(.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [7, 7]))
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark")
                        .font(.title2.weight(.bold))
                    Text(message)
                        .font(.system(.title3, weight: .bold))
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
            .onChanged { translation = $0.translation }
            .onEnded { drag in
                let projected = drag.predictedEndTranslation
                if -projected.height > thresholdY && abs(projected.height) > abs(projected.width) {
                    throwTop(.top, along: projected)
                } else if abs(projected.width) > thresholdX {
                    throwTop(projected.width > 0 ? .trailing : .leading, along: projected)
                } else {
                    withAnimation(.spring(duration: 0.45, bounce: 0.3)) { translation = .zero }
                }
            }
    }

    /// Flies the top card off along `vector` (or straight out of the given edge), then removes it and settles the stack.
    private func throwTop(_ edge: Edge, along vector: CGSize? = nil) {
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

        withAnimation(reduceMotion ? .easeOut(duration: 0.25) : .spring(duration: 0.45, bounce: 0)) {
            if reduceMotion { fade = 0 } else { translation = target }
        } completion: {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                translation = .zero
                fade = 1
            }
            items.removeFirst()
            isThrowing = false
            onSwipe(edge, item)
        }
    }
}

// MARK: - Example

/// Tonight's dinner: recipe cards as solid blocks, each with a bowl drawn from above.
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
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(recipe.fill)
                .overlay {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text("TONIGHT")
                                .font(.caption2.weight(.bold))
                                .tracking(1.2)
                            Spacer()
                            Text("\(recipe.minutes) min")
                                .font(.system(.caption, design: .monospaced).weight(.semibold))
                        }
                        Spacer()
                        // A bowl seen from above.
                        ZStack {
                            Circle().fill(ink)
                            Circle().fill(recipe.bowl).padding(22)
                            Circle().fill(recipe.fill).frame(width: 26, height: 26).offset(x: 14, y: -10)
                            Circle().fill(recipe.fill).frame(width: 14, height: 14).offset(x: -18, y: 14)
                        }
                        .frame(width: 132, height: 132)
                        .frame(maxWidth: .infinity)
                        .accessibilityHidden(true)
                        Spacer()
                        Text(recipe.title)
                            .font(.system(size: 32, weight: .bold))
                            .tracking(-1.2)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                        Text(recipe.detail)
                            .font(.subheadline.weight(.medium))
                            .opacity(0.62)
                            .padding(.top, 2)
                    }
                    .foregroundStyle(ink)
                    .padding(22)
                }
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
