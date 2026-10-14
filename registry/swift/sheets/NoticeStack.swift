// swiftpieces:
// title: Notice Stack
// description: "In-app notices grouped the way notification stacks work: the newest on top as a glass card with its tinted symbol tile, title, relative time and message, two narrower peeks of the rest melted into it as one liquid shape, new notices dropping in from above with a soft tick, a tap that spreads the pile into a list while Show less and a clear button bud out of the top card, cards that follow a sideways swipe and fly off at your speed while the next one rises out of its peek, and a clear button that stretches into a red Clear all capsule so clearing takes a second, confirming tap."
// category: sheets
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [notices, notifications, stack, swipe-to-dismiss, clear-all, glass, haptics]

import SwiftUI
import UIKit

/// A pile of in-app notices (alerts, reminders, delivery updates, system messages), newest first.
///
/// Collapsed, the newest notice shows in full on a glass card, with up to two narrower peeks of the rest beneath it,
/// melted into one liquid shape. Tap the pile and it spreads into a list while Show less and a clear button bud out of
/// the top card. Swipe a card sideways (the top one while collapsed, any of them in the list): it follows the finger,
/// and past 40% of the width, or with a flick, it flies off and leaves `notices`, while the rest close up. The clear
/// button stretches into a red Clear all capsule; a second tap sends every card off. Insert a notice at the front of
/// `notices` and it drops in from above.
///
/// ```swift
/// @State private var notices: [NoticeStack.Notice] = []
/// @State private var expanded = false
///
/// NoticeStack(notices: $notices, expanded: $expanded) { notice in
///     open(notice)
/// }
/// ```
///
/// - Parameters:
///   - notices: The notices, newest first, each with a unique `id`. Swipes and Clear all remove from it; insert at index 0 to show a new one, which drops in with a soft tick. Remove one yourself and it melts into the pile. Empty draws nothing, so your screen decides what to show instead.
///   - expanded: Whether the pile is spread into a list. Tapping the pile, Show less and Escape set it, and it returns to `false` when the last notice goes.
///   - style: Colors, the cards' corner radius and the gap between cards in the list. Defaults to the SwiftPieces house palette, adapting to light and dark, with red for Clear all.
///   - messages: The built-in copy, such as "Show less", "Clear all" and the VoiceOver announcements. Defaults are localizable through your String Catalog; replace any line.
///   - onSelect: Called with the notice tapped in the list, or the only notice when there is one. While the pile holds several, a tap spreads it instead. `nil`, the default, leaves cards to expand and collapse only.
public struct NoticeStack: View {

    // MARK: Notice

    /// One notice: a symbol on a tinted tile, a title, an optional message and when it happened.
    public struct Notice: Identifiable, Hashable, Sendable {
        /// Unique within the stack. An id the stack hasn't shown yet drops in as a new notice.
        public var id: String
        /// One line, such as "Gate changed". Wraps at accessibility text sizes.
        public var title: String
        /// Up to two lines under the title. Empty shows the title alone.
        public var message: String
        /// An SF Symbol drawn on the tile, such as "airplane".
        public var symbol: String
        /// The tile's color and the ink of its symbol.
        public var tint: Tint
        /// When it happened, shown as "now", "4m", "2h" and kept current. `nil` hides the time.
        public var date: Date?

        public init(id: String, title: String, message: String = "", symbol: String = "bell.fill", tint: Tint = .neutral, date: Date? = nil) {
            self.id = id
            self.title = title
            self.message = message
            self.symbol = symbol
            self.tint = tint
            self.date = date
        }
    }

    // MARK: Tint

    /// A notice's tile: a solid block with ink on it. The house blocks are ready to use, `.red` marks the one notice
    /// that can't wait, and `.neutral` suits system messages.
    public struct Tint: Hashable, Sendable {
        /// The tile's color.
        public var fill: Color
        /// The symbol's color on it.
        public var ink: Color

        public init(_ fill: Color, ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)) {
            self.fill = fill
            self.ink = ink
        }

        public static let sky = Tint(Color(red: 0.612, green: 0.761, blue: 1))
        public static let butter = Tint(Color(red: 1, green: 0.851, blue: 0.463))
        public static let sage = Tint(Color(red: 0.663, green: 0.863, blue: 0.718))
        public static let lilac = Tint(Color(red: 0.804, green: 0.722, blue: 1))
        public static let sand = Tint(Color(red: 0.914, green: 0.835, blue: 0.702))
        /// The house red, for an urgent notice.
        public static let red = Tint(Color(red: 1, green: 0, blue: 0))
        /// A quiet tile in the ground's own tones, with the text color for its symbol.
        public static let neutral = Tint(noticeStackAdaptive(light: 0xE4E2DC, dark: 0x3A3A38), ink: noticeStackAdaptive(light: 0x141414, dark: 0xF4F3EF))
    }

    // MARK: Style

    /// Colors, the cards' corner radius and the list's gap. `.standard` is the house palette.
    public struct Style: Sendable {
        /// Titles, Show less and the clear button's glyph.
        public var label: Color
        /// Messages and times.
        public var secondaryLabel: Color
        /// The Clear all capsule. The one place the stack uses red.
        public var accent: Color
        /// Clear all's text on `accent`.
        public var accentInk: Color
        /// The cards' corner radius.
        public var cornerRadius: CGFloat
        /// The gap between cards in the list, at least 10 points so separate cards never neck.
        public var spacing: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(label: Color? = nil, secondaryLabel: Color? = nil, accent: Color? = nil, accentInk: Color? = nil, cornerRadius: CGFloat = 22, spacing: CGFloat = 12) {
            self.label = label ?? noticeStackAdaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? noticeStackAdaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.accent = accent ?? Color(red: 1, green: 0, blue: 0)
            self.accentInk = accentInk ?? Color(red: 0.078, green: 0.078, blue: 0.078)
            self.cornerRadius = max(cornerRadius, 0)
            self.spacing = max(spacing, 10)
        }

        public static let standard = Style()
    }

    // MARK: Messages

    /// The stack's copy. Every default goes through `String(localized:)`, so it can be translated in your String
    /// Catalog, and any line can be replaced: `.init(showLess: "Collapse")`.
    public struct Messages: Sendable {
        /// The capsule that gathers the list back into a pile.
        public var showLess: String
        /// The red capsule the clear button stretches into, and the clear button's VoiceOver label.
        public var clearAll: String
        /// VoiceOver hint of the clear button before its first tap.
        public var armHint: String
        /// VoiceOver hint of Clear all, once it is showing.
        public var clearHint: String
        /// VoiceOver hint of the collapsed pile.
        public var showAll: String
        /// The VoiceOver action that dismisses a notice.
        public var dismiss: String
        /// The time of a notice from the last minute.
        public var now: String
        /// Announced when Clear all runs.
        public var cleared: String
        /// How many notices there are, as in "3 notices". The default inflects for the count.
        public var count: @Sendable (Int) -> String
        /// Announced when a notice arrives, from its title.
        public var arrived: @Sendable (String) -> String
        /// Announced when a notice is dismissed, from its title.
        public var dismissed: @Sendable (String) -> String

        /// Pass only the lines you want to change.
        public init(
            showLess: String = String(localized: "Show less", comment: "Notice stack capsule that gathers the list of notices back into a pile"),
            clearAll: String = String(localized: "Clear all", comment: "Notice stack button that removes every notice"),
            armHint: String = String(localized: "Asks before removing every notice", comment: "Notice stack VoiceOver hint of the clear button before it is confirmed"),
            clearHint: String = String(localized: "Removes every notice", comment: "Notice stack VoiceOver hint of the confirmed Clear all button"),
            showAll: String = String(localized: "Shows all", comment: "Notice stack VoiceOver hint of the collapsed pile, which spreads into a list"),
            dismiss: String = String(localized: "Dismiss", comment: "Notice stack VoiceOver action that removes one notice"),
            now: String = String(localized: "now", comment: "Notice stack time of a notice from the last minute"),
            cleared: String = String(localized: "All notices cleared", comment: "Notice stack VoiceOver announcement after Clear all"),
            count: @escaping @Sendable (Int) -> String = { count in
                String(AttributedString(localized: "^[\(count) notice](inflect: true)", comment: "Notice stack count of notices, as in 3 notices").characters)
            },
            arrived: @escaping @Sendable (String) -> String = { title in
                String(localized: "New notice: \(title)", comment: "Notice stack VoiceOver announcement when a notice arrives, with its title")
            },
            dismissed: @escaping @Sendable (String) -> String = { title in
                String(localized: "Dismissed \(title)", comment: "Notice stack VoiceOver announcement when a notice is dismissed, with its title")
            }
        ) {
            self.showLess = showLess
            self.clearAll = clearAll
            self.armHint = armHint
            self.clearHint = clearHint
            self.showAll = showAll
            self.dismiss = dismiss
            self.now = now
            self.cleared = cleared
            self.count = count
            self.arrived = arrived
            self.dismissed = dismissed
        }

        public static var standard: Messages { Messages() }
    }

    // MARK: State

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.layoutDirection) private var layoutDirection

    @Binding private var notices: [Notice]
    @Binding private var expanded: Bool
    private let style: Style
    private let messages: Messages
    private let onSelect: ((Notice) -> Void)?

    /// Ids that have landed. One that isn't here yet is drawn in its arrival pose, then springs in.
    @State private var known: Set<String>
    /// Each card's sideways offset: under a finger, springing home, or flying off.
    @State private var offsets: [String: CGFloat] = [:]
    /// Cards that are on their way out and no longer take touches.
    @State private var leaving: Set<String> = []
    /// Cards closing in place under Reduce Motion.
    @State private var melting: Set<String> = []
    @State private var dragging: String?
    @State private var dragStart: CGFloat = 0
    @State private var grabbedAt: Date?
    /// The clear button has stretched into Clear all and waits for the confirming tap.
    @State private var armed = false
    /// Clear all is sending the cards off.
    @State private var clearing = false
    @State private var clearWidth: CGFloat = 0
    @State private var width: CGFloat = 0
    /// Show less and the clear button: home inside the top card until the list opens, then out above it.
    @State private var buds = PieceBuds()
    @State private var arrivals = 0
    @State private var toggles = 0
    @State private var commits = 0
    @State private var clears = 0
    @State private var arms = 0
    @AccessibilityFocusState private var focus: String?

    @ScaledMetric(relativeTo: .subheadline) private var tileSize: CGFloat = 38
    @ScaledMetric(relativeTo: .subheadline) private var glyphSize: CGFloat = 16
    @ScaledMetric(relativeTo: .footnote) private var headerGlass: CGFloat = 30

    public init(notices: Binding<[Notice]>, expanded: Binding<Bool>, style: Style = .standard, messages: Messages = .standard, onSelect: ((Notice) -> Void)? = nil) {
        self._notices = notices
        self._expanded = expanded
        self._known = State(initialValue: Set(notices.wrappedValue.map(\.id)))
        self.style = style
        self.messages = messages
        self.onSelect = onSelect
    }

    /// How much lower each peek's edge sits than the card above it, and how much narrower it is on each side.
    private static let peek: CGFloat = 10
    /// Below the list's gap, so cards at rest are their own shapes and only neck while they spread or gather. Peeks
    /// overlap the top card, so the collapsed pile is one shape whatever this is.
    private static let liquidSpacing: CGFloat = 8
    private static let lessID = "less"
    private static let clearID = "clear"

    private var isExpanded: Bool { expanded && !notices.isEmpty }
    private var showsHeader: Bool { isExpanded && !clearing }
    /// The header's row: at least a 44 point target around its 30 point glass.
    private var headerRow: CGFloat { max(44, headerGlass) }
    /// Room under the header row, so the glass sits one list gap above the first card.
    private var headerGap: CGFloat { style.spacing - (headerRow - headerGlass) / 2 }
    /// How far a header bubble sits below its rest while it is home: just inside the top card's top edge. Closing the
    /// list, the card rises to meet it; during Clear all the list holds still, so it sinks all the way into the card.
    private var headerHome: CGFloat {
        clearing ? headerRow / 2 + headerGap + headerGlass * PieceLiquid.homeScale / 2 + 6 : headerGlass * 0.4
    }
    /// Past both edges of most screens, with room for the glass's shadow.
    private var flyDistance: CGFloat { (width > 0 ? width : 400) * 1.5 + 60 }
    /// A UIKit pan reports the finger in screen terms; offsets follow the layout direction.
    private var dragSign: CGFloat { layoutDirection == .rightToLeft ? -1 : 1 }
    private var large: Bool { dynamicTypeSize.isAccessibilitySize }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let ids = notices.map(\.id)
        let open = isExpanded
        PieceLiquidGroup(spacing: Self.liquidSpacing) {
            NoticeStackLayout(expanded: open, gap: style.spacing, peek: Self.peek, headerRow: headerRow, headerGap: headerGap) {
                // First, so a bubble at home sits under the top card and melts into it.
                if buds.contains(Self.lessID) || buds.contains(Self.clearID) {
                    header.layoutValue(key: NoticeStackSlot.self, value: -1)
                }
                // Back to front, so the newest card draws last, over the peeks.
                ForEach(Array(notices.enumerated().reversed()), id: \.element.id) { index, notice in
                    card(notice, index: index)
                }
            }
            // Scoped to the stack, so the caller's own changes keep their animation: arrivals and removals settle
            // calmly, the list opens on the reveal and closes quicker.
            .animation(motion.reveal, value: ids)
            .animation(open ? motion.reveal : motion.dismiss, value: open)
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.8), trigger: arrivals)
        .sensoryFeedback(.impact(weight: .light), trigger: toggles)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.8), trigger: commits)
        .sensoryFeedback(.success, trigger: clears)
        .sensoryFeedback(.selection, trigger: arms)
        .onChange(of: ids) { _, new in arrived(new) }
        .onChange(of: showsHeader) { _, shows in
            if !shows, armed { armed = false }
            Task {
                if shows {
                    await buds.bloom([Self.lessID, Self.clearID], reduceMotion: reduceMotion, delay: 0.06)
                } else {
                    await buds.gather([Self.lessID, Self.clearID], reduceMotion: reduceMotion)
                }
            }
        }
        .onAppear { if showsHeader { buds.place([Self.lessID, Self.clearID]) } }
        // Clear all waits three seconds for its confirming tap, then folds back into the clear button.
        .task(id: armed) {
            guard armed else { return }
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled, armed else { return }
            disarm()
        }
        // Collapsed, the pile is one button; in the list, every card and the header are their own elements.
        .accessibilityElement(children: open ? .contain : .ignore)
        .accessibilityLabel(open ? Text(messages.count(notices.count)) : Text(pileLabel))
        .accessibilityHint(!open && notices.count > 1 ? Text(messages.showAll) : Text(verbatim: ""))
        .accessibilityAddTraits(!open && (notices.count > 1 || onSelect != nil) ? .isButton : [])
        .accessibilityAction { if !open { activatePile() } }
        .accessibilityActions {
            if !open, let top = notices.first {
                Button(messages.dismiss) { dismiss(top, direction: 1) }
                if notices.count > 1 {
                    Button(messages.clearAll) { clearAll() }
                }
            }
        }
        .accessibilityAction(.escape) { if open { collapse() } }
        .accessibilityHidden(notices.isEmpty)
    }

    // MARK: Cards

    private func card(_ notice: Notice, index: Int) -> some View {
        let open = isExpanded
        let id = notice.id
        let arriving = !known.contains(id)
        let closing = melting.contains(id)
        let depth = open ? 0 : min(index, 2)
        let scale = peekScale(depth)
        let topOffset = notices.first.flatMap { offsets[$0.id] } ?? 0
        // The second card's words show where the top card has slid away from it; deeper peeks stay covered.
        let revealing = !open && index == 1 && topOffset != 0
        let visible = !arriving && !closing && (open || index == 0 || revealing)
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        return NoticeStackFace(notice: notice, style: style, now: messages.now, tile: tileSize, glyph: glyphSize, large: large)
            .pieceBudContent(out: visible)
            .mask { reveal(index: index, open: open, scale: scale, topOffset: topOffset) }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            // A peek is cut to the height of the card in front, so its words never hang below the pile.
            .clipShape(shape)
            .overlay {
                NoticeStackTouchSurface(pans: !clearing && !leaving.contains(id) && (open || index == 0), taps: !clearing && !leaving.contains(id)) { touch in
                    handle(touch, notice)
                }
                .accessibilityHidden(true)
            }
            .pieceLiquid(shape, interactive: false)
            .pieceLiquidScale(arriving || closing ? 0.001 : scale)
            // A new card drops in from above the pile; in the list it only settles a little.
            .offset(x: offsets[id] ?? 0, y: arriving && !reduceMotion ? (open ? -12 : -(tileSize + 28) * 0.8) : 0)
            // A card on its way out is removed while it is still leaving, so the rest close up behind it; it stays
            // drawn until its flight ends. Removed by the app instead, a card melts into the pile.
            .transition(leaving.contains(id) ? .asymmetric(insertion: .identity, removal: .opacity) : .asymmetric(insertion: .identity, removal: .modifier(active: NoticeStackMelt(gone: true), identity: NoticeStackMelt(gone: false))))
            .layoutValue(key: NoticeStackSlot.self, value: index)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(cardLabel(notice))
            .accessibilityAddTraits(onSelect != nil ? .isButton : [])
            .accessibilityAction { onSelect?(notice) }
            .accessibilityActions {
                Button(messages.dismiss) { dismiss(notice, direction: 1) }
            }
            .accessibilityFocused($focus, equals: id)
    }

    /// The peek's words show only in the columns the top card has uncovered, so they never print over its words.
    @ViewBuilder
    private func reveal(index: Int, open: Bool, scale: CGFloat, topOffset: CGFloat) -> some View {
        if !open, index == 1, topOffset != 0, width > 0 {
            // Columns of the peek's own (unscaled) face that lie outside the top card, which spans [offset, offset + width].
            let half = width / 2
            let cut = topOffset > 0 ? half + (topOffset - half) / scale : half + (half + topOffset) / scale
            Rectangle()
                .frame(width: max(topOffset > 0 ? cut : width - cut, 0))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: topOffset > 0 ? .leading : .trailing)
        } else {
            Rectangle()
        }
    }

    /// A peek is the next card, narrower by `peek` points on each side per step back.
    private func peekScale(_ depth: Int) -> CGFloat {
        guard depth > 0 else { return 1 }
        guard width > 0 else { return 1 - 0.05 * CGFloat(depth) }
        return max((width - 2 * Self.peek * CGFloat(depth)) / width, 0.5)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 0) {
            if buds.contains(Self.lessID) { lessButton }
            Spacer(minLength: PieceLiquid.apart)
            if buds.contains(Self.clearID) { clearButton }
        }
        .frame(height: headerRow)
    }

    private var lessButton: some View {
        let out = buds.isOut(Self.lessID)
        return Button { collapse() } label: {
            Text(messages.showLess)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(style.label)
                .lineLimit(1)
                .pieceBudContent(out: out)
                .padding(.horizontal, 14)
                .frame(minWidth: headerGlass, minHeight: headerGlass)
                .pieceLiquid(Capsule())
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PieceLiquidPressStyle())
        .pieceBud(out: out, home: CGSize(width: 0, height: headerHome))
    }

    /// A glass circle with an xmark that stretches toward the leading side into a red Clear all capsule, its words
    /// arriving letter by letter, and folds back the same way.
    private var clearButton: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let out = buds.isOut(Self.clearID)
        let lit = armed && out
        return Button {
            armed ? clearAll() : arm()
        } label: {
            ZStack {
                if !armed {
                    Image(systemName: "xmark")
                        .font(.system(size: headerGlass * 0.4, weight: .semibold))
                        .foregroundStyle(style.label)
                        .transition(motion.swap)
                }
                PieceMorphText(text: armed ? messages.clearAll : "", font: .footnote.weight(.semibold))
                    .foregroundStyle(style.accentInk)
            }
            .pieceBudContent(out: out)
            .frame(width: armed ? max(clearWidth, headerGlass) : headerGlass, height: headerGlass)
            // The red drains as it folds back and while it is home, so it never sits colored over a card.
            .pieceLiquid(Capsule(), tint: lit ? style.accent : nil)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(PieceLiquidPressStyle())
        .background {
            Text(messages.clearAll)
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .padding(.horizontal, 14)
                .fixedSize()
                .hidden()
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { clearWidth = $0 }
        }
        .pieceBud(out: out, home: CGSize(width: 0, height: headerHome))
        .accessibilityLabel(messages.clearAll)
        .accessibilityHint(armed ? messages.clearHint : messages.armHint)
    }

    // MARK: Accessibility

    private var pileLabel: String {
        guard let top = notices.first else { return "" }
        guard notices.count > 1 else { return cardLabel(top) }
        return [messages.count(notices.count), top.title, top.message].filter { !$0.isEmpty }.joined(separator: ". ")
    }

    private func cardLabel(_ notice: Notice) -> String {
        var head = notice.title
        if let date = notice.date {
            head += ", " + (Date.now.timeIntervalSince(date) < 60 ? messages.now : date.formatted(.relative(presentation: .named, unitsStyle: .wide)))
        }
        return notice.message.isEmpty ? head : head + ". " + notice.message
    }

    // MARK: Actions

    private func activatePile() {
        if notices.count > 1 { expand() } else if let top = notices.first { onSelect?(top) }
    }

    private func expand() {
        guard !expanded else { return }
        toggles += 1
        expanded = true
        // VoiceOver moves into the list once it has spread.
        guard UIAccessibility.isVoiceOverRunning else { return }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(450))
            focus = notices.first?.id
        }
    }

    private func collapse() {
        guard expanded else { return }
        toggles += 1
        if armed { disarm() }
        expanded = false
    }

    private func arm() {
        arms += 1
        withAnimation(PieceMotion(reduceMotion: reduceMotion).morph) { armed = true }
    }

    private func disarm() {
        withAnimation(PieceMotion(reduceMotion: reduceMotion).morph) { armed = false }
    }

    private func tapped(_ notice: Notice) {
        guard !clearing, !leaving.contains(notice.id) else { return }
        // Clear all waiting for its confirming tap: a tap anywhere else in the stack folds it back first.
        if armed { disarm(); return }
        if !isExpanded, notices.count > 1 { expand(); return }
        onSelect?(notice)
    }

    private func handle(_ touch: NoticeStackTouch, _ notice: Notice) {
        let id = notice.id
        let motion = PieceMotion(reduceMotion: reduceMotion)
        switch touch {
        case .tapped:
            tapped(notice)
        case .began:
            guard !clearing, !leaving.contains(id) else { return }
            if armed { disarm() }
            dragging = id
            dragStart = offsets[id] ?? 0
            grabbedAt = .now
        case .moved(let translation):
            guard dragging == id else { return }
            let x = dragStart + translation * dragSign
            // Under the finger. The first 100ms ease onto it on the press spring, which takes over a card still
            // springing home and the few points the pan waits for, so a grab never jumps.
            if let grabbedAt, Date.now.timeIntervalSince(grabbedAt) < 0.1 {
                withAnimation(motion.press) { offsets[id] = x }
            } else {
                offsets[id] = x
            }
        case .ended(let translation, let velocity):
            guard dragging == id else { return }
            dragging = nil
            grabbedAt = nil
            let x = dragStart + translation * dragSign
            let speed = velocity * dragSign
            let line = max(width, 1) * 0.4
            let coast = PieceMotion.project(x, velocity: speed)
            // Past 40% of the width, or a flick that would carry it there, the same way it is going.
            if abs(x) >= line || (abs(coast) >= line && abs(speed) > 250 && (coast < 0) == (x < 0)) {
                dismiss(notice, direction: coast < 0 ? -1 : 1, velocity: speed, from: x)
            } else {
                withAnimation(motion.settle(velocity: speed, from: x, to: 0)) { offsets[id] = 0 }
            }
        case .cancelled:
            guard dragging == id else { return }
            dragging = nil
            grabbedAt = nil
            withAnimation(motion.settle) { offsets[id] = 0 }
        }
    }

    /// A swipe that commits, or VoiceOver's Dismiss: the card leaves at the finger's speed (under Reduce Motion it
    /// slides a little and closes in place), then it is removed and the rest close up.
    private func dismiss(_ notice: Notice, direction: CGFloat, velocity: CGFloat = 0, from start: CGFloat? = nil) {
        let id = notice.id
        guard !leaving.contains(id), !clearing else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let x = start ?? offsets[id] ?? 0
        leaving.insert(id)
        commits += 1
        AccessibilityNotification.Announcement(messages.dismissed(notice.title)).post()
        if reduceMotion {
            withAnimation(motion.dismiss) {
                offsets[id] = x + direction * 24
                melting.insert(id)
            }
        } else {
            // Firm, with no overshoot at all, started at the finger's speed.
            withAnimation(motion.settle(velocity: velocity, from: x, to: direction * flyDistance, spring: Spring(duration: 0.28, bounce: 0))) {
                offsets[id] = direction * flyDistance
            }
        }
        removeSoon([id])
    }

    /// Removes cards that have just started to leave once they are mostly clear, so the rest close up while they go.
    /// Unstructured, so a removal that has begun always finishes, even if the stack leaves the screen first.
    private func removeSoon(_ ids: [String], after delay: Double = 0) {
        let wait = delay + (reduceMotion ? 0.2 : 0.16)
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(wait))
            remove(ids)
        }
    }

    /// Clear all: the header melts into the top card while the cards under it leave one after another, the bottom one
    /// first; once the header has melted all the way in, the top card leaves last, carrying it. Each card is removed as
    /// it clears, so the stack shrinks from the bottom.
    private func clearAll() {
        let ids = notices.map(\.id)
        guard !clearing, !ids.isEmpty else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        clearing = true
        clears += 1
        disarm()
        AccessibilityNotification.Announcement(messages.cleared).post()
        leaving.formUnion(ids)
        // The header is removed once it is home (PieceBuds.gather): about half a second, plus its stagger.
        let stagger = 0.07, headerHome = 0.62
        for (rank, id) in ids.reversed().enumerated() {
            let last = rank == ids.count - 1
            let delay = reduceMotion ? 0 : last ? max(headerHome, Double(rank) * stagger) : Double(rank) * stagger
            if reduceMotion {
                withAnimation(motion.dismiss) { _ = melting.insert(id) }
            } else {
                withAnimation(motion.dismiss.delay(delay)) { offsets[id] = flyDistance }
            }
            removeSoon([id], after: delay)
        }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(reduceMotion ? 0.3 : max(headerHome, Double(ids.count - 1) * stagger) + 0.3))
            clearing = false
        }
    }

    private func remove(_ ids: [String]) {
        notices.removeAll { ids.contains($0.id) }
    }

    /// New ids land, departed ones are forgotten (so one that comes back drops in again), and an empty stack closes.
    private func arrived(_ ids: [String]) {
        let present = Set(ids)
        known.formIntersection(present)
        offsets = offsets.filter { present.contains($0.key) }
        leaving.formIntersection(present)
        melting.formIntersection(present)
        if ids.isEmpty {
            if expanded { expanded = false }
            armed = false
        }
        let fresh = ids.filter { !known.contains($0) }
        guard !fresh.isEmpty else { return }
        arrivals += 1
        if let first = notices.first(where: { fresh.contains($0.id) }) {
            AccessibilityNotification.Announcement(messages.arrived(first.title)).post()
        }
        let reveal = PieceMotion(reduceMotion: reduceMotion).reveal
        // Drawn in its arrival pose for a frame first, then dropped in.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(24))
            withAnimation(reveal) { known.formUnion(fresh) }
        }
    }
}

// MARK: - Card face

/// What a card carries: the tile, the title with its time, and the message. At accessibility sizes the tile sits
/// above the words so they keep the width.
private struct NoticeStackFace: View {
    let notice: NoticeStack.Notice
    let style: NoticeStack.Style
    let now: String
    let tile: CGFloat
    let glyph: CGFloat
    let large: Bool

    var body: some View {
        let layout = large
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
            : AnyLayout(HStackLayout(alignment: notice.message.isEmpty ? .center : .top, spacing: 12))
        layout {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(notice.tint.fill)
                .frame(width: tile, height: tile)
                .overlay {
                    Image(systemName: notice.symbol)
                        .font(.system(size: glyph, weight: .semibold))
                        .foregroundStyle(notice.tint.ink)
                }
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(notice.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.label)
                        .lineLimit(large ? 3 : 1)
                    Spacer(minLength: 0)
                    if let date = notice.date {
                        TimelineView(.everyMinute) { context in
                            Text(noticeStackTime(date, at: context.date, now: now))
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(style.secondaryLabel)
                                .lineLimit(1)
                                .fixedSize()
                        }
                    }
                }
                if !notice.message.isEmpty {
                    Text(notice.message)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(style.secondaryLabel)
                        .lineLimit(large ? 8 : 2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// "now" for the last minute, then "4m", "2h", "3d", and a date after a week.
private func noticeStackTime(_ date: Date, at moment: Date, now: String) -> String {
    let seconds = moment.timeIntervalSince(date)
    if seconds < 60 { return now }
    if seconds < 7 * 86_400 {
        return Duration.seconds(seconds).formatted(.units(allowed: [.days, .hours, .minutes], width: .narrow, maximumUnitCount: 1))
    }
    return date.formatted(.dateTime.day().month(.abbreviated))
}

/// A card the app removed: its glass closes into the pile while its words fade.
private struct NoticeStackMelt: ViewModifier {
    var gone: Bool

    func body(content: Content) -> some View {
        content
            .pieceLiquidScale(gone ? 0.001 : 1)
            .opacity(gone ? 0 : 1)
    }
}

// MARK: - Layout

nonisolated private struct NoticeStackSlot: LayoutValueKey {
    /// A card's place from the front (0 is the newest), or -1 for the header.
    static let defaultValue = 0
}

/// Collapsed: the front card at its own height, and up to two peeks behind it, each narrower and `peek` lower, cut to
/// the front card's height. Expanded: the header row, then every card at its own height, `gap` apart. A peek is laid
/// out at full width and scaled down by the card itself, so its words never reflow as it rises.
private struct NoticeStackLayout: Layout {
    var expanded: Bool
    var gap: CGFloat
    var peek: CGFloat
    var headerRow: CGFloat
    var headerGap: CGFloat

    private func cards(_ subviews: Subviews) -> [LayoutSubview] {
        subviews.filter { $0[NoticeStackSlot.self] >= 0 }.sorted { $0[NoticeStackSlot.self] < $1[NoticeStackSlot.self] }
    }

    private func heights(_ cards: [LayoutSubview], width: CGFloat) -> [CGFloat] {
        cards.map { $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? 360
        let cards = cards(subviews)
        guard !cards.isEmpty else { return CGSize(width: width, height: 0) }
        let heights = heights(cards, width: width)
        if expanded {
            return CGSize(width: width, height: headerRow + headerGap + heights.reduce(0, +) + gap * CGFloat(cards.count - 1))
        }
        return CGSize(width: width, height: heights[0] + peek * CGFloat(min(cards.count - 1, 2)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let width = bounds.width
        for subview in subviews where subview[NoticeStackSlot.self] < 0 {
            subview.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(width: width, height: headerRow))
        }
        let cards = cards(subviews)
        guard !cards.isEmpty else { return }
        let heights = heights(cards, width: width)
        if expanded {
            var y = bounds.minY + headerRow + headerGap
            for (card, height) in zip(cards, heights) {
                card.place(at: CGPoint(x: bounds.minX, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: height))
                y += height + gap
            }
        } else {
            let front = heights[0]
            for (place, card) in cards.enumerated() {
                let depth = CGFloat(min(place, 2))
                let height = place == 0 ? front : min(heights[place], front)
                let scale = width > 0 ? max((width - 2 * peek * depth) / width, 0.5) : 1
                // Scaled about its centre by the card, so its drawn bottom edge lands `peek` below the one in front.
                let bottom = bounds.minY + front + peek * depth
                card.place(at: CGPoint(x: bounds.minX, y: bottom - height * (1 + scale) / 2), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: height))
            }
        }
    }
}

// MARK: - Touch surface

private enum NoticeStackTouch {
    case tapped
    case began
    case moved(CGFloat)
    case ended(CGFloat, velocity: CGFloat)
    case cancelled
}

/// UIKit recognizers on each card, because a SwiftUI drag inside a scroll view claims the touch: this pan only starts
/// for a mostly horizontal swipe, so a vertical one still scrolls the screen or pulls a sheet down untouched.
private struct NoticeStackTouchSurface: UIViewRepresentable {
    var pans: Bool
    var taps: Bool
    var onTouch: (NoticeStackTouch) -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        view.isAccessibilityElement = false
        view.accessibilityElementsHidden = true
        let coordinator = context.coordinator
        let pan = UIPanGestureRecognizer(target: coordinator, action: #selector(Coordinator.panned(_:)))
        pan.delegate = coordinator
        let tap = UITapGestureRecognizer(target: coordinator, action: #selector(Coordinator.tapped(_:)))
        view.addGestureRecognizer(pan)
        view.addGestureRecognizer(tap)
        coordinator.pan = pan
        coordinator.tap = tap
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {
        let coordinator = context.coordinator
        coordinator.onTouch = onTouch
        coordinator.pan?.isEnabled = pans
        coordinator.tap?.isEnabled = taps
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onTouch: (NoticeStackTouch) -> Void = { _ in }
        weak var pan: UIPanGestureRecognizer?
        weak var tap: UITapGestureRecognizer?

        @objc func panned(_ recognizer: UIPanGestureRecognizer) {
            // In the window's space: the card moves with the finger, so its own space would cancel the drag out.
            let translation = recognizer.translation(in: nil).x
            switch recognizer.state {
            case .began:
                onTouch(.began)
                onTouch(.moved(translation))
            case .changed:
                onTouch(.moved(translation))
            case .ended:
                onTouch(.ended(translation, velocity: recognizer.velocity(in: nil).x))
            case .cancelled, .failed:
                onTouch(.cancelled)
            default:
                break
            }
        }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            onTouch(.tapped)
        }

        /// The pan only starts for a mostly horizontal drag, so vertical swipes stay with the screen.
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y)
        }
    }
}

/// A house-palette color that follows the interface style.
private func noticeStackAdaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// The stack alone on the ground: three notices in a pile, a parcel that arrives a moment later, and the pile
/// coming back whenever it is cleared.
private struct NoticeStackExample: View {
    @State private var notices = NoticeStackExample.pile
    @State private var expanded = false

    static var pile: [NoticeStack.Notice] {
        [
            .init(id: "gate", title: "Gate changed", message: "Boarding is now B12, ten minutes earlier.", symbol: "airplane", tint: .sky, date: .now.addingTimeInterval(-120)),
            .init(id: "rain", title: "Rain at four", message: "The river walk is still fine if you leave now.", symbol: "cloud.rain.fill", tint: .lilac, date: .now.addingTimeInterval(-1_080)),
            .init(id: "table", title: "Table held", message: "Under the lanterns, for two, at 19:30.", symbol: "fork.knife", tint: .butter, date: .now.addingTimeInterval(-3_600)),
        ]
    }

    var body: some View {
        NoticeStack(notices: $notices, expanded: $expanded)
            .padding(16)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(noticeStackAdaptive(light: 0xF3F2EE, dark: 0x121212))
            .task {
                try? await Task.sleep(for: .seconds(1.2))
                notices.insert(.init(id: "parcel", title: "At your door", message: "The parcel from Rua Augusta was left with the concierge.", symbol: "shippingbox.fill", tint: .sage, date: .now), at: 0)
            }
            .onChange(of: notices.isEmpty) { _, empty in
                guard empty else { return }
                Task { @MainActor in
                    try? await Task.sleep(for: .seconds(1))
                    notices = NoticeStackExample.pile
                }
            }
    }
}

#Preview("Light") {
    NoticeStackExample()
}

#Preview("Dark") {
    NoticeStackExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, pressMath)

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
// swiftpieces-liquid: 1.7.1 (liquid, liquidPress, bud, morphText)

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
///
/// Only text whose letters stand on their own is cut into letters: Latin, Greek, Cyrillic, CJK, digits and symbols.
/// Those letters are laid out left to right whatever the layout direction, the order they read in, so "1.5×" stays
/// "1.5×" in an Arabic or Hebrew interface instead of coming out backwards. Text in a right-to-left script, or in one
/// whose letters join or reorder (Arabic, Hebrew, Devanagari, Thai and their neighbours), can't be cut apart without
/// breaking it, so it changes as one: the old string blurs out where it stood while the new one blurs in.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if Self.splits(text) {
                let glyphs = Array(text)
                HStack(spacing: 0) {
                    ForEach(glyphs.indices, id: \.self) { i in
                        Text(String(glyphs[i]))
                            .id("\(i)\(glyphs[i])")
                            .transition(transition(i, scale: 0.6))
                    }
                }
                // The letters' reading order, not the layout's: an HStack lays its children out backwards under a
                // right-to-left layout.
                .environment(\.layoutDirection, .leftToRight)
            } else {
                ZStack(alignment: .leading) {
                    Text(text)
                        .id(text)
                        .transition(transition(0, scale: 0.9))
                }
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int, scale: CGFloat) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: scale, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }

    /// Whether `text` can be cut into letters that each read left to right on their own: no right-to-left script, no
    /// script that joins or reorders its letters, and no bidirectional control characters.
    private static func splits(_ text: String) -> Bool {
        !text.unicodeScalars.contains { scalar in
            switch scalar.value {
            case 0x0590...0x08FF, // Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic
                 0x0900...0x0DFF, // Devanagari to Sinhala
                 0x0E00...0x0FFF, // Thai, Lao, Tibetan
                 0x1000...0x109F, // Myanmar
                 0x1780...0x17FF, // Khmer
                 0xA8E0...0xA8FF, // Devanagari Extended
                 0xFB1D...0xFDFF, // Hebrew and Arabic presentation forms
                 0xFE70...0xFEFF, // Arabic presentation forms B
                 0x200E...0x200F, 0x202A...0x202E, 0x2066...0x2069, // bidirectional marks, embeddings and isolates
                 0x10800...0x10FFF, // historic right-to-left scripts
                 0x1E800...0x1EFFF: // Adlam and other right-to-left scripts
                return true
            default:
                return false
            }
        }
    }
}

// swiftpieces-liquid: end
