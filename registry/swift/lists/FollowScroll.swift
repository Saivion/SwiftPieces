// swiftpieces:
// title: Follow Scroll
// description: A chat, log and live-feed scroll container that opens on the newest item and stays pinned to it while the reader is at the bottom, but never yanks them away once they scroll up to read; items that arrive below are counted into a floating Liquid Glass pill that jumps back to the latest, older items loaded at the top keep the visible row exactly where it was, and keyboard, rotation, growing rows and removals all hold the reader's place.
// category: lists
// minIOSVersion: "17.0"
// version: "1.0.0"
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
    /// Pill fill under Reduce Transparency before iOS 26. On iOS 26 the pill is Liquid Glass; earlier it is a material.
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
/// view. Once they scroll up to read, new items never move the content: they are counted into a floating pill such as
/// "3 new" that jumps back down, and scrolling down by hand clears it too. Older items prepended at the top (for example
/// from `onReachTop`) keep the visible row in place.
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
///   - style: Colors, row spacing, padding, the follow threshold and whether the compact jump button shows. Defaults to the Swift Pieces house palette, adapting to light and dark.
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
    private var motion: Animation { reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.42, bounce: 0.22) }
    private var jumpTitle: String { String(localized: "Jump to latest", comment: "FollowScroll: button and VoiceOver action that scrolls to the newest item.") }

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
        .onAppear {
            tracker.first = items.first?.id
            tracker.tail = Array(items.suffix(FollowScrollTracker<Item.ID>.tailLength).map(\.id))
        }
        .onDisappear { tracker.cancel() }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.55), trigger: pillArrivedTick)
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

    private func pill(_ proxy: ScrollViewProxy) -> some View {
        let count = unread.count
        let shows = !following && !items.isEmpty && (count > 0 || (style.showsJumpButton && farFromBottom))
        return ZStack {
            if shows {
                Button { jumpFromPill(proxy) } label: { pillLabel(count) }
                    .buttonStyle(PillPress(reduceMotion: reduceMotion))
                    .keyboardShortcut(.downArrow, modifiers: .command)
                    .accessibilityLabel(count > 0 ? newItemLabel(count) : jumpTitle)
                    .accessibilityHint(count > 0 ? jumpTitle : "")
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.6, anchor: .bottom).combined(with: .opacity).combined(with: .offset(y: 12)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
        .animation(motion, value: shows)
        .animation(motion, value: count)
    }

    private func pillLabel(_ count: Int) -> some View {
        HStack(spacing: 10) {
            if count > 0 {
                Image(systemName: "arrow.down")
                    .font(.system(size: dotSize * 0.46, weight: .bold))
                    .foregroundStyle(style.signalInk)
                    .frame(width: dotSize, height: dotSize)
                    .background(style.signal, in: .circle)
                    .transition(.scale(scale: 0.3).combined(with: .opacity))
                Text(newItemLabel(count))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(style.label)
                    .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(count)))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            } else {
                Image(systemName: "arrow.down")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(style.label)
                    .transition(.opacity)
            }
        }
        .padding(.leading, count > 0 ? (pillHeight - dotSize) / 2 : 0)
        .padding(.trailing, count > 0 ? 16 : 0)
        .padding(.vertical, count > 0 ? (pillHeight - dotSize) / 2 : 0)
        .frame(minWidth: pillHeight, minHeight: pillHeight)
        .modifier(PillSurface(fill: style.surface, reduceTransparency: reduceTransparency))
        .contentShape(.capsule)
    }

    @ViewBuilder private var olderSpinner: some View {
        if isLoadingOlder {
            ProgressView()
                .controlSize(.small)
                .tint(style.muted)
                .frame(width: 36, height: 36)
                .modifier(PillSurface(fill: style.surface, reduceTransparency: reduceTransparency))
                .padding(.top, 8)
                .transition(.opacity)
                .accessibilityLabel(String(localized: "Loading earlier items", comment: "FollowScroll: spinner while older items load."))
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

        let far = new.toBottom > new.visible * 0.75
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
        withAnimation(.easeOut(duration: 0.2)) { isLoadingOlder = true }
        await onReachTop()
        withAnimation(.easeOut(duration: 0.2)) { isLoadingOlder = false }
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

private struct LegacyContainer: Equatable, Sendable {
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

// MARK: - Pill surface

/// Liquid Glass on iOS 26; a material (or a solid surface under Reduce Transparency) with a soft shadow before.
private struct PillSurface: ViewModifier {
    let fill: Color
    let reduceTransparency: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else if reduceTransparency {
            content
                .background(fill, in: .capsule)
                .shadow(color: .black.opacity(0.16), radius: 14, y: 6)
        } else {
            content
                .background(.regularMaterial, in: .capsule)
                .shadow(color: .black.opacity(0.14), radius: 14, y: 6)
        }
    }
}

private struct PillPress: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.35), value: configuration.isPressed)
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
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
