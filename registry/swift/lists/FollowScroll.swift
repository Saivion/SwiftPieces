// swiftpieces:
// title: Follow Scroll
// description: A chat, log and live-feed scroll container that opens on the newest item and stays pinned to it while the reader is at the bottom, but never yanks them away once they scroll up to read; items that arrive below are counted into a liquid glass pill that buds up out of the bottom edge on a neck, jumps back to the latest and melts back down into the edge once the reader is caught up, older items loaded at the top keep the visible row exactly where it was while a glass spinner buds down from the top edge, and keyboard, rotation, growing rows and removals all hold the reader's place.
// category: lists
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-29"
// tags: [chat, feed, log, scroll, auto-scroll, new-messages, pagination, liquid-glass]

import SwiftUI

/// Colors and metrics for `FollowScroll`. `.standard` is the house palette.
public struct FollowScrollStyle: Sendable {
    /// Pill text and the jump arrow.
    public var label: Color
    /// The dot on the pill when new items are waiting below: the one signal color.
    public var signal: Color
    /// The arrow on the signal dot.
    public var signalInk: Color
    /// The pill and spinner fill under Reduce Transparency. Otherwise they are liquid glass: Liquid Glass on iOS 26, a
    /// frosted material before.
    public var surface: Color
    /// The spinner shown while `onReachTop` loads.
    public var muted: Color
    /// Space between rows.
    public var spacing: CGFloat
    /// Leading and trailing padding around rows. Use 0 for edge-to-edge rows.
    public var horizontalPadding: CGFloat
    /// Padding above the first row and below the last.
    public var verticalPadding: CGFloat
    /// How close to the bottom, in points, still counts as "at the latest". Scrolling within it keeps following.
    public var followThreshold: CGFloat
    /// Shows a compact jump button when the reader is more than most of a screen above the latest, even with nothing new.
    public var showsJumpButton: Bool

    /// Pass only what you want to change; `nil` keeps the house palette value.
    public init(label: Color? = nil, signal: Color? = nil, signalInk: Color? = nil, surface: Color? = nil, muted: Color? = nil, spacing: CGFloat = 8, horizontalPadding: CGFloat = 16, verticalPadding: CGFloat = 12, followThreshold: CGFloat = 48, showsJumpButton: Bool = true) {
        self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
        self.signal = signal ?? Color(red: 1, green: 0, blue: 0)
        self.signalInk = signalInk ?? adaptive(light: 0x141414, dark: 0x141414)
        self.surface = surface ?? adaptive(light: 0xFFFFFF, dark: 0x262626)
        self.muted = muted ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
        self.spacing = max(spacing, 0)
        self.horizontalPadding = max(horizontalPadding, 0)
        self.verticalPadding = max(verticalPadding, 0)
        self.followThreshold = max(followThreshold, 1)
        self.showsJumpButton = showsJumpButton
    }

    public static let standard = FollowScrollStyle()
}

/// A scroll container for chats, live logs and activity feeds that follows the newest item, the way a reader expects.
///
/// It opens at the bottom. While the reader is at (or within `followThreshold` of) the latest item, new items scroll into
/// view. Once they scroll up to read, new items never move the content: they are counted into a liquid glass pill such
/// as "3 new" that buds up out of the bottom edge and jumps back down, and scrolling down by hand clears it too. Once the
/// reader is caught up it melts back into the edge. Older items prepended at the top (for example from `onReachTop`)
/// keep the visible row in place.
///
/// ```swift
/// FollowScroll(messages, alwaysFollow: { $0.isMine }) { message in
///     MessageRow(message)
/// } onReachTop: {
///     await thread.loadOlder()
/// }
/// ```
///
/// - Parameters:
///   - items: The rows, oldest first. Append to add at the bottom; insert at the front to add older items. Identity comes from `id`, so rows keep their place when the array changes.
///   - isFollowing: Optional. Reflects whether the view is pinned to the latest item, for a "Live" badge or a toolbar button. Set it to `true` to jump to the latest; the scroll position decides when it goes back to `false`.
///   - alwaysFollow: New items for which this returns `true` scroll to the bottom even when the reader has scrolled up. Use it for the reader's own sent messages.
///   - newItemLabel: The pill's text and the VoiceOver announcement for a count of new items. The default is a localized "3 new"; add plural variants for it in your String Catalog, or pass your own such as `"\(count) new messages"`.
///   - style: Colors, row spacing, padding, the follow threshold and whether the compact jump button shows. Defaults to the SwiftPieces house palette, adapting to light and dark.
///   - row: Builds the row for one item.
///   - onReachTop: Optional. Called when the reader nears the top, to load older items; prepend them to `items` before returning. It is not called again until it returns, and a call that adds nothing is not repeated until the reader scrolls away from the top and back. Cancelled if the view goes away.
///   - empty: Optional. Shown centered while `items` is empty (for example a `ContentUnavailableView`).
public struct FollowScroll<Item: Identifiable, Row: View, Empty: View>: View {
    /// Colors and metrics (`FollowScrollStyle`). `.standard` is the house palette.
    public typealias Style = FollowScrollStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ScaledMetric(relativeTo: .subheadline) private var pillHeight: CGFloat = 44
    @ScaledMetric(relativeTo: .subheadline) private var dotSize: CGFloat = 28

    @State private var following = true
    /// New items that arrived below while the reader was scrolled up, oldest first. Removed items drop out.
    @State private var unread: [Item.ID] = []
    @State private var farFromBottom = false
    /// The bottom-most visible row. Bound to `scrollPosition(id:anchor:)`, which keeps that row in place when rows are
    /// inserted above it or the container resizes. Every jump goes through it so it never goes stale.
    @State private var anchorID: Item.ID?
    @State private var tracker = FollowScrollTracker<Item.ID>()
    @State private var loadRequest = 0
    @State private var isLoadingOlder = false
    @State private var pillArrivedTick = 0
    @State private var jumpTick = 0
    /// The jump pill and the older-items spinner: each buds out of its edge of the scroll view and melts back into it.
    @State private var buds = PieceBuds()
    /// The count the pill shows. It keeps its last value while the pill melts away, so the pill leaves in the form it had.
    @State private var shownCount = 0

    private let items: [Item]
    private let isFollowingBinding: Binding<Bool>?
    private let alwaysFollow: (Item) -> Bool
    private let newItemLabel: (Int) -> String
    private let style: Style
    private let row: (Item) -> Row
    private let onReachTop: (@MainActor () async -> Void)?
    private let empty: Empty

    public init(_ items: [Item], isFollowing: Binding<Bool>? = nil, alwaysFollow: @escaping (Item) -> Bool = { _ in false }, newItemLabel: ((Int) -> String)? = nil, style: Style = .standard, @ViewBuilder row: @escaping (Item) -> Row, onReachTop: (@MainActor () async -> Void)? = nil, @ViewBuilder empty: () -> Empty) {
        self.items = items
        self.isFollowingBinding = isFollowing
        self.alwaysFollow = alwaysFollow
        self.newItemLabel = newItemLabel ?? { count in
            String(localized: "\(count) new", comment: "FollowScroll pill: how many items arrived below while the reader was scrolled up.")
        }
        self.style = style
        self.row = row
        self.onReachTop = onReachTop
        self.empty = empty()
    }

    private struct Edges: Equatable {
        var count: Int
        var first: Item.ID?
        var last: Item.ID?
    }

    private var edges: Edges { Edges(count: items.count, first: items.first?.id, last: items.last?.id) }
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    private var jumpTitle: String { String(localized: "Jump to latest", comment: "FollowScroll: button and VoiceOver action that scrolls to the newest item.") }

    /// The pill is up while the reader is away from the latest with news below, or far enough up for the jump button.
    private var pillShows: Bool {
        !following && !items.isEmpty && (!unread.isEmpty || (style.showsJumpButton && farFromBottom))
    }

    /// Whether the glass is Liquid Glass, which swells under a press by itself. Drawn without it (before iOS 26, or solid
    /// under Reduce Transparency), the pill sinks under the finger instead.
    private var glassPresses: Bool {
        #if compiler(>=6.2)
        if #available(iOS 26, *) { return !reduceTransparency }
        #endif
        return false
    }

    public var body: some View {
        ScrollViewReader { proxy in
            scrollView(proxy)
                .overlay(alignment: .bottom) { pill(proxy) }
                .overlay(alignment: .top) { olderSpinner }
                .overlay {
                    if items.isEmpty {
                        empty.frame(maxWidth: .infinity, maxHeight: .infinity).transition(.opacity)
                    }
                }
                .accessibilityActions {
                    if !following && !items.isEmpty {
                        Button(jumpTitle) { jumpFromPill(proxy) }
                    }
                }
                .onChange(of: edges) { old, new in itemsChanged(from: old, to: new, proxy: proxy) }
                .onChange(of: isFollowingBinding?.wrappedValue) { _, wants in
                    guard let wants, wants != following else { return }
                    if wants { jumpFromPill(proxy) } else { isFollowingBinding?.wrappedValue = following }
                }
        }
        .task(id: loadRequest) { await loadOlder() }
        .onChange(of: isLoadingOlder) { _, loading in if !loading { olderLoadFinished() } }
        // Each bubble follows only the latest change: a pill that comes and goes in quick succession never ends up
        // out of step with the state that shows it.
        .task(id: pillShows) { await settle("pill", out: pillShows) }
        .task(id: isLoadingOlder) { await settle("older", out: isLoadingOlder) }
        // The count is held while the pill is up, so it keeps it as it melts away.
        .onChange(of: pillShows ? unread.count : -1) { _, count in if count >= 0 { shownCount = count } }
        .onAppear {
            tracker.first = items.first?.id
            tracker.tail = Array(items.suffix(FollowScrollTracker<Item.ID>.tailLength).map(\.id))
        }
        .onDisappear { tracker.cancel() }
        .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light, intensity: 0.55), trigger: pillArrivedTick)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: jumpTick)
    }

    // MARK: Scroll view

    private func scrollView(_ proxy: ScrollViewProxy) -> some View {
        ScrollView {
            LazyVStack(spacing: style.spacing) {
                ForEach(items) { item in
                    row(item)
                }
            }
            .scrollTargetLayout()
            .padding(.horizontal, style.horizontalPadding)
            .modifier(LegacyContentProbe(tracker: tracker, margin: style.verticalPadding) { metricsChanged($0, proxy: proxy) })
        }
        // Margins rather than padding, so aligning the last row to the bottom shows the space under it.
        .contentMargins(.vertical, style.verticalPadding, for: .scrollContent)
        .scrollPosition(id: $anchorID, anchor: .bottom)
        .modifier(BottomAnchored())
        .modifier(ScrollTracking(tracker: tracker, margin: style.verticalPadding, onMetrics: { metricsChanged($0, proxy: proxy) }, onInteractionEnd: { interactionEnded(proxy) }))
    }

    // MARK: Pill

    /// The jump pill: neutral liquid glass that buds up out of the bottom edge as the reader leaves the latest and melts
    /// back down into it once they are caught up.
    private func pill(_ proxy: ScrollViewProxy) -> some View {
        let shows = pillShows
        // Melting away, it keeps the count it had, so it leaves in the form it had.
        let count = shows ? unread.count : shownCount
        let out = buds.isOut("pill")
        return FollowScrollEdgeBud(edge: .bottom, present: buds.contains("pill"), out: out) {
            Button { jumpFromPill(proxy) } label: { pillLabel(count, out: out) }
                .buttonStyle(PillPress(glassPresses: glassPresses))
                .keyboardShortcut(.downArrow, modifiers: .command)
                // On its way home it no longer answers, and VoiceOver no longer finds it.
                .allowsHitTesting(shows)
                .accessibilityHidden(!shows)
                .accessibilityLabel(count > 0 ? newItemLabel(count) : jumpTitle)
                .accessibilityHint(count > 0 ? jumpTitle : "")
        }
        .padding(.horizontal, 16)
        // Around the edge bud, which centres the pill, so it widens and narrows about its centre. News reaching a pill
        // already up changes its form with the morph's slight give. After that a new count only eases the width and
        // rolls the number, with no overshoot, so a busy feed never keeps the pill wobbling or shows a count that
        // isn't true.
        .animation(motion.morph, value: count > 0)
        .animation(motion.value, value: count)
        .fontWeight(.semibold)
    }

    /// One pill that changes form: news grows the signal dot behind the same arrow and opens the count beside it,
    /// instead of swapping the compact button for another view.
    private func pillLabel(_ count: Int, out: Bool) -> some View {
        let hasNews = count > 0
        return HStack(spacing: 10) {
            Image(systemName: "arrow.down")
                .font(.system(size: dotSize * 0.54, weight: .semibold))
                .foregroundStyle(hasNews ? style.signalInk : style.label)
                .scaleEffect(hasNews && !reduceMotion ? 0.85 : 1)
                .frame(width: dotSize, height: dotSize)
                .background {
                    // Decoration, so it grows in just behind the pill's change of form, on the calm spring: the pill's
                    // morph is the change, and the dot only gives slightly behind it. Under Reduce Motion it fades.
                    Circle()
                        .fill(style.signal)
                        .animation(motion.follow(PieceMotion.calm, rank: 1)) { $0.scaleEffect(hasNews || reduceMotion ? 1 : 0.3).opacity(hasNews ? 1 : 0) }
                }
            if hasNews {
                Text(newItemLabel(count))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(style.label)
                    .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(count)))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(motion.swap)
            }
        }
        // Gone the moment the pill heads home, so nothing rides it down into the edge.
        .pieceBudContent(out: out)
        .padding(.leading, hasNews ? (pillHeight - dotSize) / 2 : 0)
        .padding(.trailing, hasNews ? 16 : 0)
        .padding(.vertical, hasNews ? (pillHeight - dotSize) / 2 : 0)
        .frame(minWidth: pillHeight, minHeight: pillHeight)
        // Neutral glass: the signal dot says there is news. Under Reduce Transparency it is the style's solid surface.
        .pieceLiquid(.capsule, tint: reduceTransparency ? style.surface : nil)
        .contentShape(.capsule)
    }

    /// While older items load, a small glass bubble with a spinner buds down out of the top edge, and melts back up into
    /// it once they have landed.
    private var olderSpinner: some View {
        let out = buds.isOut("older")
        return FollowScrollEdgeBud(edge: .top, present: buds.contains("older"), out: out) {
            ProgressView()
                .controlSize(.small)
                .tint(style.muted)
                .pieceBudContent(out: out)
                .frame(width: 36, height: 36)
                .pieceLiquid(.circle, tint: reduceTransparency ? style.surface : nil, interactive: false)
                .accessibilityHidden(!isLoadingOlder)
                .accessibilityLabel(String(localized: "Loading earlier items", comment: "FollowScroll: spinner while older items load."))
        }
    }

    /// Buds a bubble out, or melts it home, to match `out`. Run from `.task(id:)`, so only the latest change acts.
    private func settle(_ id: String, out: Bool) async {
        if out {
            guard !buds.isOut(id) else { return }
            await buds.bloom([id], reduceMotion: reduceMotion)
        } else if buds.contains(id) {
            await buds.gather([id], reduceMotion: reduceMotion)
        }
    }

    // MARK: Following

    private func setFollowing(_ value: Bool) {
        if following != value { following = value }
        if value {
            if !unread.isEmpty { unread = [] }
            tracker.deferred = []
            if farFromBottom { farFromBottom = false }
        }
        if let binding = isFollowingBinding, binding.wrappedValue != value { binding.wrappedValue = value }
    }

    /// Every geometry change lands here: iOS 18+ from `onScrollGeometryChange`, iOS 17 from the content probe.
    private func metricsChanged(_ new: FollowScrollMetrics, proxy: ScrollViewProxy) {
        let old = tracker.metrics
        tracker.metrics = new
        let now = Date.now
        let jumping = tracker.isJumping(at: now)
        let resized = old.map { abs($0.visible - new.visible) > 0.5 || abs($0.insetBottom - new.insetBottom) > 0.5 } ?? true
        let grew = old.map { abs($0.content - new.content) > 0.5 } ?? true
        // The reader moving away from the latest: the offset went up the content while the container kept its size.
        // Rows inserted above push the offset down and resizes are excluded, so neither counts. A finger or fling
        // (iOS 18+ scroll phase) always counts; otherwise (VoiceOver, a scroll from your code, iOS 17) the frame must not
        // also change the content height (lazy rows re-measuring) or fall inside one of our own jumps.
        let movedUp = (old.map { new.offset < $0.offset - 0.5 } ?? false) && !resized && (tracker.userScrolling || (!grew && !jumping))
        if movedUp { tracker.lastMoveUp = now }

        if new.toBottom <= style.followThreshold {
            if !following { setFollowing(true) }
        } else if movedUp && following {
            setFollowing(false)
            // A scroll that did not come from a finger leaves the position binding on the row we last jumped to, and
            // the scroll view would pull that row back into view on the next change. Clear it; the next user scroll
            // writes the real bottom-most row.
            if anchorID != nil, anchorID == items.last?.id { anchorID = nil }
        }

        // Keep the bottom glued while following: the keyboard, a rotation, or the last row growing (streamed text).
        if following, resized || grew, new.toBottom > 0.5, !jumping, !tracker.userScrolling,
           now.timeIntervalSince(tracker.lastMoveUp) > 0.3, !items.isEmpty {
            scheduleJump(proxy, animated: false)
        }

        // Shows past three quarters of a screen and hides back under 60%, so a reader resting near the line doesn't
        // see the jump button come and go.
        let far = new.toBottom > new.visible * (farFromBottom ? 0.6 : 0.75)
        if far != farFromBottom, !following || !far { farFromBottom = far }

        if onReachTop != nil, !items.isEmpty {
            let prefetch = new.visible * 0.75
            if new.offset < prefetch {
                if tracker.topArmed && !isLoadingOlder {
                    tracker.topArmed = false
                    loadRequest += 1
                }
            } else if new.offset > prefetch + new.visible * 0.5 {
                tracker.topArmed = true
            }
        }
    }

    /// iOS 18+: runs any jump that was held back while the reader's finger was on the content.
    private func interactionEnded(_ proxy: ScrollViewProxy) {
        let deferred = tracker.deferred
        tracker.deferred = []
        guard !deferred.isEmpty else { return }
        if following {
            scheduleJump(proxy, animated: true)
        } else {
            let present = Set(items.lazy.map(\.id))
            addUnread(deferred.filter(present.contains))
        }
    }

    private func itemsChanged(from old: Edges, to new: Edges, proxy: ScrollViewProxy) {
        let previousTail = tracker.tail
        tracker.first = new.first
        tracker.tail = Array(items.suffix(FollowScrollTracker<Item.ID>.tailLength).map(\.id))
        if !unread.isEmpty || !tracker.deferred.isEmpty {
            let present = Set(items.lazy.map(\.id))
            unread.removeAll { !present.contains($0) }
            tracker.deferred.removeAll { !present.contains($0) }
        }
        // Rows prepended while the reader rests on the very top edge: the scroll view keeps that edge, which would push
        // the rows they were reading down by the height of the new ones. Put the old first row back where it was, in
        // the same update, so no frame shows the jump. (Anywhere below the edge the position binding holds the place.)
        if new.first != old.first, !following, let oldFirst = old.first, let metrics = tracker.metrics, metrics.offset <= 1,
           let index = items.firstIndex(where: { $0.id == oldFirst }), index > 0 {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) { proxy.scrollTo(oldFirst, anchor: .top) }
        }
        guard new.last != old.last else { return }
        guard new.last != nil else {
            unread = []
            return
        }
        guard let oldLast = old.last else {
            // First content: open at the latest.
            setFollowing(true)
            scheduleJump(proxy, animated: false)
            return
        }
        if let index = items.lastIndex(where: { $0.id == oldLast }) {
            let appended = items[items.index(after: index)...]
            guard !appended.isEmpty else { return }
            if appended.contains(where: alwaysFollow) {
                setFollowing(true)
                scheduleJump(proxy, animated: true)
            } else if following {
                if tracker.userScrolling {
                    // A finger is on the content: don't scroll under it. Decided when the scroll ends.
                    tracker.deferred.append(contentsOf: appended.map(\.id))
                } else {
                    scheduleJump(proxy, animated: true)
                }
            } else {
                addUnread(appended.map(\.id))
            }
        } else if let newLast = new.last, previousTail.contains(newLast) {
            // The newest items were removed; nothing new arrived.
            return
        } else {
            // The whole list was replaced (another conversation, a new filter): start again at the latest.
            unread = []
            setFollowing(true)
            scheduleJump(proxy, animated: false)
        }
    }

    private func addUnread(_ ids: [Item.ID]) {
        guard !ids.isEmpty else { return }
        let wasEmpty = unread.isEmpty
        unread.append(contentsOf: ids)
        if wasEmpty { pillArrivedTick += 1 }
        // One announcement per burst, with the final count.
        tracker.announceTask?.cancel()
        tracker.announceTask = Task { @MainActor [newItemLabel] in
            try? await Task.sleep(for: .milliseconds(900))
            guard !Task.isCancelled else { return }
            let count = unread.count
            guard count > 0, !following else { return }
            AccessibilityNotification.Announcement(newItemLabel(count)).post()
        }
    }

    // MARK: Jumping

    private func jumpFromPill(_ proxy: ScrollViewProxy) {
        guard !items.isEmpty else { return }
        jumpTick += 1
        setFollowing(true)
        scheduleJump(proxy, animated: true)
    }

    /// Coalesces bursts: many appends in one update scroll once, to the newest item.
    private func scheduleJump(_ proxy: ScrollViewProxy, animated: Bool) {
        tracker.jumpTask?.cancel()
        tracker.jumpPending = true
        tracker.jumpTask = Task { @MainActor in
            await Task.yield()
            guard !Task.isCancelled else { return }
            jump(proxy, animated: animated)
        }
    }

    private func jump(_ proxy: ScrollViewProxy, animated: Bool) {
        tracker.jumpPending = false
        guard let last = items.last?.id else { return }
        let smooth = animated && !reduceMotion
        tracker.jumpStarted = .now
        tracker.jumpDuration = smooth ? 0.45 : 0.1
        let scroll = {
            // Setting the binding to the row it already holds would not scroll (a tall last row, partly visible).
            if anchorID == last { proxy.scrollTo(last, anchor: .bottom) } else { anchorID = last }
        }
        if smooth {
            // A scroll, not a spring with give: bounce 0, since an overshoot past the bottom would be clamped and
            // corrected. `jumpDuration` outlasts it, so the jump's own motion never reads as the reader scrolling up.
            withAnimation(.smooth(duration: 0.4)) { scroll() } completion: { settleAfterJump(proxy) }
        } else {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) { scroll() }
        }
    }

    /// Lazy rows can change their estimated heights while an animated jump runs; land exactly on the bottom.
    private func settleAfterJump(_ proxy: ScrollViewProxy) {
        guard following, let metrics = tracker.metrics, metrics.toBottom > 0.5, !tracker.userScrolling else { return }
        jump(proxy, animated: false)
    }

    // MARK: Older items

    private func loadOlder() async {
        guard loadRequest > 0, let onReachTop else { return }
        await Task.yield()
        // The request may predate the initial scroll to the bottom; check again.
        guard let metrics = tracker.metrics, metrics.offset < metrics.visible * 0.75, !Task.isCancelled else {
            tracker.topArmed = true
            return
        }
        tracker.firstBeforeLoad = tracker.first
        // The spinner buds out of the top edge and melts back on its own springs.
        isLoadingOlder = true
        await onReachTop()
        isLoadingOlder = false
    }

    /// Runs in the update that applies whatever the loader prepended (it changes `items` before returning), so the
    /// comparison sees the new first row. Something added: re-arm, and the geometry that follows decides whether the
    /// reader is still near the top (a short list loads again). Nothing added: wait until they scroll away and back.
    private func olderLoadFinished() {
        if items.first?.id != tracker.firstBeforeLoad { tracker.topArmed = true }
    }
}

extension FollowScroll where Empty == EmptyView {
    public init(_ items: [Item], isFollowing: Binding<Bool>? = nil, alwaysFollow: @escaping (Item) -> Bool = { _ in false }, newItemLabel: ((Int) -> String)? = nil, style: Style = .standard, @ViewBuilder row: @escaping (Item) -> Row, onReachTop: (@MainActor () async -> Void)? = nil) {
        self.init(items, isFollowing: isFollowing, alwaysFollow: alwaysFollow, newItemLabel: newItemLabel, style: style, row: row, onReachTop: onReachTop) { EmptyView() }
    }
}

// MARK: - Tracking

/// Scroll geometry reduced to what following needs. `offset` is 0 at the top of the content.
private struct FollowScrollMetrics: Equatable, Sendable {
    var offset: CGFloat
    var content: CGFloat
    var visible: CGFloat
    var insetBottom: CGFloat
    var toBottom: CGFloat { content - offset - visible }
}

/// Per-frame bookkeeping kept out of SwiftUI state, so scrolling never re-renders the rows.
@MainActor private final class FollowScrollTracker<ID: Hashable> {
    static var tailLength: Int { 64 }
    var metrics: FollowScrollMetrics?
    var first: ID?
    /// The last few ids, to tell "the newest items were removed" from "the list was replaced".
    var tail: [ID] = []
    var topArmed = true
    var firstBeforeLoad: ID?
    var hasPhases = false
    var userScrolling = false
    var lastMoveUp = Date.distantPast
    var deferred: [ID] = []
    var jumpPending = false
    var jumpStarted = Date.distantPast
    var jumpDuration: TimeInterval = 0
    var jumpTask: Task<Void, Never>?
    var announceTask: Task<Void, Never>?
    // iOS 17 probe inputs.
    var legacyContent: CGRect?
    var legacyContainer: LegacyContainer?

    func isJumping(at now: Date) -> Bool {
        jumpPending || now.timeIntervalSince(jumpStarted) < jumpDuration
    }

    func cancel() {
        jumpTask?.cancel()
        announceTask?.cancel()
    }
}

nonisolated private struct LegacyContainer: Equatable, Sendable {
    var height: CGFloat
    var top: CGFloat
    var bottom: CGFloat
}

/// iOS 18+: geometry and scroll phase straight from the scroll view.
private struct ScrollTracking<ID: Hashable>: ViewModifier {
    let tracker: FollowScrollTracker<ID>
    let margin: CGFloat
    let onMetrics: (FollowScrollMetrics) -> Void
    let onInteractionEnd: () -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content
                .onScrollGeometryChange(for: FollowScrollMetrics.self) { geometry in
                    FollowScrollMetrics(
                        offset: geometry.contentOffset.y + geometry.contentInsets.top,
                        content: geometry.contentSize.height,
                        visible: geometry.containerSize.height,
                        insetBottom: geometry.contentInsets.bottom
                    )
                } action: { _, new in
                    onMetrics(new)
                }
                .onScrollPhaseChange { _, phase in
                    tracker.hasPhases = true
                    let scrolling = phase == .interacting || phase == .tracking || phase == .decelerating
                    guard scrolling != tracker.userScrolling else { return }
                    tracker.userScrolling = scrolling
                    if !scrolling { onInteractionEnd() }
                }
        } else {
            content
                .onGeometryChange(for: LegacyContainer.self) { proxy in
                    LegacyContainer(height: proxy.size.height, top: proxy.safeAreaInsets.top, bottom: proxy.safeAreaInsets.bottom)
                } action: { container in
                    tracker.legacyContainer = container
                    if let metrics = LegacyContentProbe<ID>.metrics(tracker, margin: margin) { onMetrics(metrics) }
                }
        }
    }
}

/// iOS 17: the content's frame in the scroll view's coordinate space, combined with the container's size.
private struct LegacyContentProbe<ID: Hashable>: ViewModifier {
    let tracker: FollowScrollTracker<ID>
    let margin: CGFloat
    let onMetrics: (FollowScrollMetrics) -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content
        } else {
            content.onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .scrollView)
            } action: { frame in
                tracker.legacyContent = frame
                if let metrics = Self.metrics(tracker, margin: margin) { onMetrics(metrics) }
            }
        }
    }

    static func metrics(_ tracker: FollowScrollTracker<ID>, margin: CGFloat) -> FollowScrollMetrics? {
        guard let frame = tracker.legacyContent, let container = tracker.legacyContainer else { return nil }
        // The container reports its size inside the safe area but still including the content margins; the content
        // frame is measured from the top of the scrollable area, so -minY is how far it has scrolled.
        return FollowScrollMetrics(offset: -frame.minY, content: frame.height, visible: container.height - 2 * margin, insetBottom: container.bottom)
    }
}

/// Opens at the bottom, and a short list sits at the bottom. iOS 18+ leaves size changes to the follow logic, so
/// following animates smoothly instead of snapping.
private struct BottomAnchored: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content
                .defaultScrollAnchor(.bottom, for: .initialOffset)
                .defaultScrollAnchor(.bottom, for: .alignment)
        } else {
            content.defaultScrollAnchor(.bottom)
        }
    }
}

// MARK: - Edge bud

/// A glass bubble that buds out of the scroll view's top or bottom edge and melts back into it.
///
/// The edge is the scroll view's own, where its rows slip out of sight: under the home indicator or a bar, or against
/// whatever sits beside it. Just past it, clipped out of sight, lies a glass lip. At home the bubble sits inside the lip,
/// shrunk and wholly past the edge, so the two are one shape. Going out it rises through the edge pulling a neck from
/// the lip, which thins and snaps just clear of the edge, and it comes to rest a bubble of its own, clear of the safe
/// area. Going home the neck reaches back out for it and it sinks in. Everything past the edge is clipped, so only the
/// bubble and its neck ever show.
private struct FollowScrollEdgeBud<Bubble: View>: View {
    let edge: VerticalEdge
    let present: Bool
    let out: Bool
    @ViewBuilder let bubble: Bubble
    @State private var size: CGSize = .zero

    /// How far the bubble rests inside the safe area.
    private let inset: CGFloat = 16
    /// How far past the edge the lip lies: close enough that a neck reaches up through the edge as the bubble leaves
    /// (it snaps about 10pt clear of it, inside the merge distance), far enough that nothing of the lip ever shows.
    private let lipGap: CGFloat = 10
    private let lipHeight: CGFloat = 44

    var body: some View {
        GeometryReader { proxy in
            let safe = edge == .bottom ? proxy.safeAreaInsets.bottom : proxy.safeAreaInsets.top
            // The bubble's resting distance from the edge.
            let rest = inset + safe
            // Toward the edge: down for the bottom edge, up for the top.
            let toward: CGFloat = edge == .bottom ? 1 : -1
            // Until the bubble has been measured once, a house-size bubble stands in, so its first bloom still starts
            // out of sight.
            let measured = size.height > 0 ? size : CGSize(width: 44, height: 44)
            // Home is shrunk and wholly past the edge, inside the lip.
            let home = toward * (rest + measured.height * (1 + PieceLiquid.homeScale) / 2)
            PieceLiquidGroup {
                ZStack(alignment: edge == .bottom ? .bottom : .top) {
                    if present {
                        Color.clear
                            .frame(width: measured.width + PieceLiquid.merge * 2, height: lipHeight)
                            .pieceLiquid(.capsule, interactive: false)
                            .offset(y: toward * (rest + lipGap + lipHeight))
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                        bubble
                            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
                            .pieceBud(out: out, home: CGSize(width: 0, height: home))
                    }
                }
            }
            .padding(edge == .bottom ? .bottom : .top, rest)
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: edge == .bottom ? .bottom : .top)
            .clipped()
        }
        .ignoresSafeArea(.container, edges: edge == .bottom ? .bottom : .top)
    }
}

/// Interactive Liquid Glass gives the press by itself, so nothing is added on top. Where the pill is drawn without it,
/// it sinks under the finger instead (and dims under Reduce Motion).
private struct PillPress: ButtonStyle {
    let glassPresses: Bool

    @ViewBuilder func makeBody(configuration: Configuration) -> some View {
        if glassPresses {
            configuration.label
        } else {
            configuration.label.pieceLiquidPress(configuration.isPressed)
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

private struct FollowScrollExampleMessage: Identifiable {
    let id: Int
    let text: String
    let isMine: Bool
}

/// A thread that keeps receiving replies. Scroll up and the pill counts them; tap it to jump back.
private struct FollowScrollExample: View {
    private static let lines = ["Boarding in ten, gate 32", "Grabbed you a flat white", "Seats 14A and 14B", "They moved us to gate 35", "Running, save my spot", "Made it. Window or aisle?", "Window please", "Landing at 6:40 local", "Taxi or train?", "Train, it's faster at rush hour"]
    @State private var messages = (0..<14).map { FollowScrollExampleMessage(id: $0, text: FollowScrollExample.lines[$0 % 10], isMine: $0 % 3 == 1) }

    var body: some View {
        FollowScroll(messages, alwaysFollow: \.isMine) { message in
            Text(message.text)
                .font(.body)
                .foregroundStyle(adaptive(light: 0x141414, dark: 0x141414))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(message.isMine ? adaptive(light: 0xFF0000, dark: 0xFF0000) : adaptive(light: 0xE9D5B3, dark: 0xE9D5B3), in: .rect(cornerRadius: 18, style: .continuous))
                .frame(maxWidth: .infinity, alignment: message.isMine ? .trailing : .leading)
        }
        // The house type: one weight for every string. The piece sets it on its own pill; rows are yours.
        .fontWeight(.semibold)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                let id = messages.count
                messages.append(FollowScrollExampleMessage(id: id, text: Self.lines[id % 10], isMine: false))
            }
        }
    }
}

#Preview("Light") {
    FollowScrollExample()
}

#Preview("Dark") {
    FollowScrollExample()
        .preferredColorScheme(.dark)
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
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud)

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

// swiftpieces-liquid: end
