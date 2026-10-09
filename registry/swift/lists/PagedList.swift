// swiftpieces:
// title: Paged List
// description: An async/await infinite-scroll list that prefetches the next page a few rows before the end, never runs two loads at once, drops duplicate ids across pages, ignores stale responses after a refresh or cancel, and shows pulsing skeleton rows; its footer is one liquid glass bubble that spins while a page loads, widens into a "Couldn't load more" pill with a Retry bubble budding out of it on a liquid neck that keeps loaded rows, and becomes a quiet "You're all caught up" pill at the end, with pull to refresh that replaces rows only on success.
// category: lists
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-23"
// tags: [pagination, infinite-scroll, list, async, refresh, loading, empty-state]

import SwiftUI
import UIKit

/// One page from your API: the rows it returned and the cursor for the page after it (`nil` when this was the last page).
///
/// `Cursor` can be a page number, an offset, or an opaque token from your backend.
nonisolated public struct PagedListPage<Item: Sendable, Cursor: Sendable>: Sendable {
    public var items: [Item]
    public var next: Cursor?

    public init(items: [Item], next: Cursor?) {
        self.items = items
        self.next = next
    }
}

/// An infinitely scrolling list driven by an async page loader, with every pagination state handled.
///
/// The simplest call is one line: `PagedList(load: api.page) { item in Row(item) }`, or for page-number APIs
/// `PagedList(pageSize: 20) { page in try await api.fetch(page: page) } row: { item in Row(item) }`.
/// To restart with new parameters (a search query, a filter), give the list `.id(query)`.
///
/// - Parameters:
///   - load: Loads one page. Receives `nil` for the first page, then each page's `next` cursor. Throwing shows an error state; cancellation is ignored.
///   - pageSize: Page-number convenience only. A page with fewer items than this (or none) ends the list.
///   - firstPage: Page-number convenience only. The number of the first page, usually 1 or 0.
///   - fetch: Page-number convenience only. Returns the items for a page number.
///   - layout: `.list` (a plain `List`, the default) or `.plain` (a `LazyVStack` in a `ScrollView` for card layouts).
///   - prefetchDistance: How many rows before the end the next page starts loading.
///   - endMessage: Quiet footer shown after the last page. `nil` hides it.
///   - emptyMessage: Text of the built-in empty state when the first page has no items.
///   - placeholder: A sample item rendered through your `row` with `.redacted(reason: .placeholder)` as the loading skeleton. `nil` uses generic skeleton rows.
///   - errorMessage: Turns a thrown error into the text shown in the full error view. Defaults to `localizedDescription`.
///   - style: Colors and metrics for the built-in skeleton, status pill, empty and error views. Defaults to the house palette.
///   - row: Builds the row for one item.
///   - empty: A custom empty state, shown when the first page has no items (for example a `ContentUnavailableView`).
public struct PagedList<Item: Identifiable & Sendable, Cursor: Sendable, Row: View, Empty: View>: View {
    /// The loader's signature. Runs off the main actor; must be safe to call from any task.
    public typealias Load = @Sendable (Cursor?) async throws -> PagedListPage<Item, Cursor>

    /// The scroll container.
    public enum Layout: Sendable {
        /// A plain-style `List`, with system cell reuse and swipe actions.
        case list
        /// A `LazyVStack` inside a `ScrollView`, for card rows with custom spacing.
        case plain
    }

    /// Colors and metrics for the built-in states (`PagedListStyle`). `.standard` is the house palette.
    public typealias Style = PagedListStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.isEnabled) private var isEnabled
    @State private var loader = PagedLoader<Item, Cursor>()
    @State private var retries = 0
    @ScaledMetric(relativeTo: .body) private var avatar: CGFloat = 44

    private let load: Load
    private let layout: Layout
    private let prefetchDistance: Int
    private let endMessage: String?
    private let emptyMessage: String
    private let placeholder: Item?
    private let errorMessage: (any Error) -> String
    private let style: Style
    private let row: (Item) -> Row
    private let empty: Empty?

    public init(load: @escaping Load, layout: Layout = .list, prefetchDistance: Int = 5, endMessage: String? = "You're all caught up", emptyMessage: String = "Nothing here yet", placeholder: Item? = nil, errorMessage: @escaping (any Error) -> String = { $0.localizedDescription }, style: Style = .standard, @ViewBuilder row: @escaping (Item) -> Row, @ViewBuilder empty: () -> Empty) {
        self.init(load, layout, prefetchDistance, endMessage, emptyMessage, placeholder, errorMessage, style, row, empty())
    }

    fileprivate init(_ load: @escaping Load, _ layout: Layout, _ prefetchDistance: Int, _ endMessage: String?, _ emptyMessage: String, _ placeholder: Item?, _ errorMessage: @escaping (any Error) -> String, _ style: Style, _ row: @escaping (Item) -> Row, _ empty: Empty?) {
        self.load = load
        self.layout = layout
        self.prefetchDistance = max(prefetchDistance, 1)
        self.endMessage = endMessage
        self.emptyMessage = emptyMessage
        self.placeholder = placeholder
        self.errorMessage = errorMessage
        self.style = style
        self.row = row
        self.empty = empty
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    private var chipTransition: AnyTransition { motion.transition(.scale(scale: 0.92).combined(with: .opacity)) }

    public var body: some View {
        container
            // A failed refresh slips its chip in above the rows. Keyed to failures only, so a refresh that succeeds
            // replaces the rows unanimated and page appends never animate. Only in `.plain`: a List ignores the
            // transition and would animate a row insert while the pull may still be held.
            .animation(layout == .plain ? motion.reveal : nil, value: loader.refreshFailures)
            .overlay { overlay }
            .onAppear { loader.appear(load) }
            .onDisappear { loader.disappear() }
            .refreshable { await loader.refresh(load) }
            .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light), trigger: retries)
    }

    // MARK: Containers

    @ViewBuilder private var container: some View {
        switch layout {
        case .list:
            List { rows }
                .listStyle(.plain)
        case .plain:
            ScrollView {
                LazyVStack(spacing: style.rowSpacing) { rows }
                    .padding(.horizontal, style.contentPadding)
            }
        }
    }

    @ViewBuilder private var rows: some View {
        if loader.items.isEmpty {
            if loader.isAwaitingFirstPage {
                skeleton
            }
        } else {
            if let error = loader.refreshError {
                // It arrives on its own, rising in; its Retry then buds out of it.
                PagedListStatus(kind: .failed("Couldn't refresh"), style: style, detail: errorMessage(error), hint: "Loads the list again", busy: loader.phase == .refresh, nudge: loader.refreshFailures) {
                    retries += 1
                    loader.retryRefresh(load)
                }
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity)
                .opacity(isEnabled ? 1 : 0.5)
                .transition(chipTransition)
                .modifier(ChromeRow())
            }
            ForEach(loader.items) { item in
                row(item)
                    .onAppear { loader.rowAppeared(item.id, distance: prefetchDistance, load) }
            }
            footer
                .modifier(ChromeRow())
        }
    }

    /// Full-screen states float over the (empty) scroll view, so pull to refresh still works under them. They fade in,
    /// fade out a little quicker, and fade across when a failed first page later loads empty.
    private var overlay: some View {
        let key = overlayKey
        return ZStack {
            if key != 0 {
                Group {
                    if let error = loader.initialError {
                        failure(error)
                    } else if let empty {
                        empty
                    } else {
                        emptyState
                    }
                }
                .transition(.opacity)
            }
        }
        .animation(key == 0 ? motion.dismiss : motion.reveal, value: key)
    }

    /// 0 while rows or the skeleton show, 1 for the first page's error, 2 for the empty state.
    private var overlayKey: Int {
        guard loader.items.isEmpty && !loader.isAwaitingFirstPage else { return 0 }
        return loader.initialError != nil ? 1 : 2
    }

    // MARK: Footer

    /// The footer is one glass bubble that changes form: it spins while a page loads, widens into the failure pill with a
    /// Retry bubble budding out of it, and becomes the caught-up pill at the end. With `endMessage: nil` it leaves the end
    /// of the list instead, shrinking away quickly.
    private var footer: some View {
        ZStack {
            if let kind = footerKind {
                PagedListStatus(kind: kind, style: style, detail: loader.pageError.map(errorMessage) ?? "", hint: "Loads the next page again") {
                    retries += 1
                    loader.retryMore(load)
                }
                .opacity(isEnabled ? 1 : 0.5)
                .transition(motion.transition(.scale(scale: PieceLiquid.homeScale).combined(with: .opacity)))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 64)
        .animation(motion.dismiss, value: footerKind == nil)
        .onAppear {
            loader.footerVisible = true
            loader.loadMore(load)
        }
        .onDisappear { loader.footerVisible = false }
    }

    /// What the footer shows: the failure, the end, or a page loading. `nil` once the list has ended with no end message.
    private var footerKind: PagedListStatus.Kind? {
        if loader.pageError != nil { return .failed("Couldn't load more") }
        if loader.reachedEnd { return endMessage.map { .done($0) } }
        return .loading
    }

    // MARK: First page states

    @ViewBuilder private var skeleton: some View {
        ForEach(0..<style.skeletonRows, id: \.self) { index in
            Group {
                if let placeholder {
                    row(placeholder).redacted(reason: .placeholder)
                } else {
                    skeletonRow(index)
                }
            }
            .allowsHitTesting(false)
            .modifier(SkeletonPulse(index: index, reduceMotion: reduceMotion))
            .accessibilityHidden(index > 0)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading")
            .modifier(ChromeRow())
        }
    }

    private func skeletonRow(_ index: Int) -> some View {
        let widths: [CGFloat] = [0.62, 0.48, 0.7, 0.55]
        return HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: avatar * 0.3, style: .continuous)
                .fill(style.field)
                .frame(width: avatar, height: avatar)
            GeometryReader { proxy in
                VStack(alignment: .leading, spacing: 8) {
                    Capsule().fill(style.field).frame(width: proxy.size.width * widths[index % widths.count], height: 12)
                    Capsule().fill(style.field).frame(width: proxy.size.width * 0.34, height: 10)
                }
                .frame(maxHeight: .infinity, alignment: .center)
            }
            .frame(height: avatar)
        }
        .padding(.vertical, 8)
    }

    /// The first page failed: a butter glass bubble with the warning, the message, and a signal glass Try again button.
    /// The bubble and the button sit far apart by design, so each is its own group and the lift falls on the glass alone.
    private func failure(_ error: any Error) -> some View {
        VStack(spacing: 14) {
            PieceLiquidGroup {
                Image(systemName: "exclamationmark")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(style.ink)
                    .frame(width: avatar * 1.3, height: avatar * 1.3)
                    .pieceLiquid(.circle, tint: style.error, interactive: false)
            }
            .accessibilityHidden(true)
            VStack(spacing: 6) {
                Text("Couldn't load")
                    .font(.headline)
                    .foregroundStyle(style.text)
                Text(errorMessage(error))
                    .font(.subheadline)
                    .foregroundStyle(style.secondaryText)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            PieceLiquidGroup {
                Button("Try again") {
                    retries += 1
                    loader.loadFirst(load)
                }
                .buttonStyle(LiquidButtonStyle(tint: style.retry, ink: style.ink, glassPresses: liquidGlassPresses(reduceTransparency: reduceTransparency)))
            }
            .opacity(isEnabled ? 1 : 0.5)
        }
        .fontWeight(.semibold)
        .padding(32)
        .frame(maxWidth: 420)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            PieceLiquidGroup {
                Image(systemName: "tray")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(style.secondaryText)
                    .frame(width: avatar * 1.3, height: avatar * 1.3)
                    .pieceLiquid(.circle, tint: reduceTransparency ? style.field : nil, interactive: false)
            }
            .accessibilityHidden(true)
            Text(emptyMessage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.secondaryText)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }
}

/// Colors and metrics for the built-in states. `.standard` is the house palette.
public struct PagedListStyle: Sendable {
    /// Titles in the empty and error views, and the failure pill's title.
    public var text: Color
    /// Messages, the end footer and the spinner.
    public var secondaryText: Color
    /// Skeleton blocks, and the status pill's solid fill under Reduce Transparency (it is liquid glass otherwise).
    public var field: Color
    /// The warning disc on a failure pill and the glass tint of the first-page error bubble. Butter by default: the
    /// house colour for warnings and errors.
    public var error: Color
    /// The glass tint of the Retry bubble and the Try again button. Signal red by default: the primary action.
    public var retry: Color
    /// The disc behind the check on the end footer.
    public var end: Color
    /// Text and glyphs on tints and discs.
    public var ink: Color
    /// Row spacing in the `.plain` layout.
    public var rowSpacing: CGFloat
    /// Horizontal padding in the `.plain` layout.
    public var contentPadding: CGFloat
    /// Skeleton rows shown while the first page loads.
    public var skeletonRows: Int

    /// Pass only what you want to change; `nil` keeps the house palette value.
    public init(text: Color? = nil, secondaryText: Color? = nil, field: Color? = nil, error: Color? = nil, retry: Color? = nil, end: Color? = nil, ink: Color? = nil, rowSpacing: CGFloat = 8, contentPadding: CGFloat = 16, skeletonRows: Int = 8) {
        self.text = text ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
        self.secondaryText = secondaryText ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
        self.field = field ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
        self.error = error ?? adaptive(light: 0xFFD976, dark: 0xFFD976)
        self.retry = retry ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
        self.end = end ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
        self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
        self.rowSpacing = rowSpacing
        self.contentPadding = contentPadding
        self.skeletonRows = max(skeletonRows, 1)
    }

    public static let standard = PagedListStyle()
}

// MARK: - Convenience initializers

extension PagedList where Empty == EmptyView {
    /// Cursor-based list with the built-in empty state.
    public init(load: @escaping Load, layout: Layout = .list, prefetchDistance: Int = 5, endMessage: String? = "You're all caught up", emptyMessage: String = "Nothing here yet", placeholder: Item? = nil, errorMessage: @escaping (any Error) -> String = { $0.localizedDescription }, style: Style = .standard, @ViewBuilder row: @escaping (Item) -> Row) {
        self.init(load, layout, prefetchDistance, endMessage, emptyMessage, placeholder, errorMessage, style, row, nil)
    }
}

extension PagedList where Cursor == Int, Empty == EmptyView {
    /// Page-number list: `fetch` gets 1, 2, 3... and the list ends at the first short or empty page.
    public init(pageSize: Int, firstPage: Int = 1, layout: Layout = .list, prefetchDistance: Int = 5, endMessage: String? = "You're all caught up", emptyMessage: String = "Nothing here yet", placeholder: Item? = nil, errorMessage: @escaping (any Error) -> String = { $0.localizedDescription }, style: Style = .standard, fetch: @escaping @Sendable (Int) async throws -> [Item], @ViewBuilder row: @escaping (Item) -> Row) {
        let size = max(pageSize, 1)
        self.init(load: { cursor in
            let page = cursor ?? firstPage
            let items = try await fetch(page)
            return PagedListPage(items: items, next: items.count < size ? nil : page + 1)
        }, layout: layout, prefetchDistance: prefetchDistance, endMessage: endMessage, emptyMessage: emptyMessage, placeholder: placeholder, errorMessage: errorMessage, style: style, row: row)
    }
}

// MARK: - Loader (the pagination state machine)

/// Owns items and load state on the main actor. Every load bumps `generation`; a response whose generation is no
/// longer current (superseded by a refresh or retry, or cancelled on disappear) is dropped without touching state.
@MainActor @Observable
private final class PagedLoader<Item: Identifiable & Sendable, Cursor: Sendable> {
    typealias Load = @Sendable (Cursor?) async throws -> PagedListPage<Item, Cursor>

    enum Phase: Equatable { case idle, first, more, refresh }

    private(set) var items: [Item] = []
    private(set) var phase: Phase = .idle
    private(set) var hasLoaded = false
    private(set) var reachedEnd = false
    private(set) var initialError: (any Error)?
    private(set) var pageError: (any Error)?
    private(set) var refreshError: (any Error)?
    /// Refreshes that failed. Keys the refresh chip's arrival and its nudge on a repeat failure.
    private(set) var refreshFailures = 0

    /// Set by the footer's appear/disappear. When the footer is still on screen after a page lands, keep loading.
    @ObservationIgnored var footerVisible = false
    @ObservationIgnored private var index: [Item.ID: Int] = [:]
    @ObservationIgnored private var next: Cursor?
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var interrupted: Phase?
    @ObservationIgnored private var emptyStreak = 0

    /// Consecutive pages that add nothing new before the list is treated as finished (guards a cursor that never ends).
    static var emptyPageLimit: Int { 8 }

    /// Skeleton while the very first page is pending (or about to start).
    var isAwaitingFirstPage: Bool { (!hasLoaded && initialError == nil) || phase == .first }

    func appear(_ load: @escaping Load) {
        if let resume = interrupted {
            interrupted = nil
            if resume == .more { loadMore(load) } else { loadFirst(load) }
        } else if !hasLoaded, phase == .idle, initialError == nil {
            loadFirst(load)
        }
    }

    func disappear() {
        guard phase != .idle else { return }
        interrupted = phase == .more ? .more : (hasLoaded ? nil : .first)
        task?.cancel()
        task = nil
        generation &+= 1
        phase = .idle
    }

    /// The first page, or a retry of it after a failure.
    func loadFirst(_ load: @escaping Load) {
        let gen = begin(.first)
        initialError = nil
        task = Task { await self.fetch(nil, gen, .first, load) }
    }

    /// The next page. No-op while any load runs, at the end, or after a page error (retry is explicit).
    func loadMore(_ load: @escaping Load) {
        guard phase == .idle, hasLoaded, !reachedEnd, pageError == nil, let cursor = next else { return }
        let gen = begin(.more)
        task = Task { await self.fetch(cursor, gen, .more, load) }
    }

    func retryMore(_ load: @escaping Load) {
        pageError = nil
        loadMore(load)
    }

    /// Pull to refresh. Awaited by `.refreshable`, so the system spinner stays until the first page lands.
    func refresh(_ load: @escaping Load) async {
        let gen = begin(.refresh)
        await fetch(nil, gen, .refresh, load)
    }

    func retryRefresh(_ load: @escaping Load) {
        let gen = begin(.refresh)
        task = Task { await self.fetch(nil, gen, .refresh, load) }
    }

    func rowAppeared(_ id: Item.ID, distance: Int, _ load: @escaping Load) {
        guard let position = index[id], position >= items.count - distance else { return }
        loadMore(load)
    }

    /// Cancels whatever is in flight and claims a new generation.
    private func begin(_ next: Phase) -> Int {
        task?.cancel()
        task = nil
        interrupted = nil
        generation &+= 1
        phase = next
        return generation
    }

    private func fetch(_ cursor: Cursor?, _ gen: Int, _ kind: Phase, _ load: @escaping Load) async {
        let result: Result<PagedListPage<Item, Cursor>, any Error>
        do { result = .success(try await load(cursor)) } catch { result = .failure(error) }

        // Superseded by a newer load: that load owns the state now.
        guard gen == generation else { return }
        task = nil
        phase = .idle

        if Task.isCancelled || result.isCancellation {
            // Cancelled but not superseded (for example the refresh gesture's task was torn down): resume on next appear.
            interrupted = kind == .more ? .more : (hasLoaded ? nil : .first)
            return
        }

        switch result {
        case .success(let page):
            apply(page, replacing: kind != .more)
            if footerVisible { loadMore(load) }
        case .failure(let error):
            if kind == .more {
                pageError = error
                announce("Couldn't load more")
            } else if !hasLoaded {
                initialError = error
                announce("Couldn't load")
            } else {
                // Refresh failed: keep the rows we have and say so above them.
                refreshError = error
                refreshFailures &+= 1
                announce("Couldn't refresh")
            }
        }
    }

    private func apply(_ page: PagedListPage<Item, Cursor>, replacing: Bool) {
        var seen = replacing ? [:] : index
        var fresh: [Item] = []
        let base = replacing ? 0 : items.count
        for item in page.items where seen[item.id] == nil {
            seen[item.id] = base + fresh.count
            fresh.append(item)
        }
        index = seen
        if replacing {
            items = fresh
            initialError = nil
            pageError = nil
            refreshError = nil
            emptyStreak = 0
        } else {
            items.append(contentsOf: fresh)
            if !fresh.isEmpty { announce("Loaded \(fresh.count) more") }
        }
        emptyStreak = fresh.isEmpty ? emptyStreak + 1 : 0
        next = page.next
        reachedEnd = page.next == nil || emptyStreak >= Self.emptyPageLimit
        hasLoaded = true
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

private extension Result where Failure == any Error {
    var isCancellation: Bool {
        guard case .failure(let error) = self else { return false }
        return error is CancellationError || (error as? URLError)?.code == .cancelled
    }
}

// MARK: - Built-in pieces

/// Footer and chip rows sit on the list ground with no separator.
private struct ChromeRow: ViewModifier {
    func body(content: Content) -> some View {
        content
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }
}

/// The list's status as one liquid glass pill: the footer, and the chip above the rows when a refresh fails.
///
/// Loading, it is a round bubble with a spinner. A failure widens it into a pill with a butter warning disc and its
/// title, and the signal Retry bubble buds out of its trailing end, held to it by a liquid neck. Retry melts back in as
/// the spinner returns. At the end of the list it becomes the quiet caught-up pill with a sage check. The pill itself is
/// neutral glass: the discs and Retry carry the colour.
private struct PagedListStatus: View {
    enum Kind: Equatable {
        case loading
        case failed(String)
        case done(String)
    }

    let kind: Kind
    let style: PagedListStyle
    /// Read by VoiceOver after a failure's title.
    var detail = ""
    /// Retry's VoiceOver hint.
    var hint = ""
    /// A retry is running: a spinner stands in for Retry's glyph, and Retry ignores taps.
    var busy = false
    /// Each change shakes the warning disc once: a retry that failed again.
    var nudge = 0
    var retry: () -> Void = {}

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 44
    @ScaledMetric(relativeTo: .body) private var disc: CGFloat = 22
    /// Retry: out while the status is a failure.
    @State private var buds = PieceBuds()

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    private var failed: Bool {
        if case .failed = kind { return true }
        return false
    }

    private var title: String? {
        switch kind {
        case .loading: nil
        case .failed(let title), .done(let title): title
        }
    }

    var body: some View {
        let out = buds.isOut("retry")
        // At accessibility sizes Retry buds out below the pill instead of beside it, so the pair still fits.
        let stacked = dynamicTypeSize.isAccessibilitySize
        // Offsets mirror in right-to-left layouts, so a positive x is always toward the trailing side.
        let reach = height + PieceLiquid.joined
        return PieceLiquidGroup {
            pill
                // Laid out at the pill's trailing end (its bottom when stacked) and under it, so at home, shrunk, it sits
                // just inside the pill and the two are one shape.
                .background(alignment: stacked ? .bottom : .trailing) {
                    if buds.contains("retry") {
                        retryBubble(out: out)
                            .pieceBud(out: out, rest: stacked ? CGSize(width: 0, height: reach) : CGSize(width: reach, height: 0), home: .zero)
                    }
                }
        }
        // The pair stays centred while Retry is out, moving on Retry's own springs.
        .offset(x: !stacked && out ? -reach / 2 : 0, y: stacked && out ? -reach / 2 : 0)
        // Stacked, the row makes room for Retry below the pill.
        .padding(.vertical, stacked && buds.contains("retry") ? reach / 2 : 0)
        // Centred here, under the morph, so the pill widens and narrows about its centre instead of from one side.
        .frame(maxWidth: .infinity)
        .animation(motion.morph, value: kind)
        .fontWeight(.semibold)
        // Only the latest change acts, so a failure that clears at once never leaves Retry out of step.
        .task(id: failed) {
            if failed {
                guard !buds.isOut("retry") else { return }
                await buds.bloom(["retry"], reduceMotion: reduceMotion)
            } else if buds.contains("retry") {
                await buds.gather(["retry"], reduceMotion: reduceMotion)
            }
        }
    }

    /// One glass shape that changes form on the morph's slight give (set on the body, around the centring). The glyph
    /// keeps one size and place, so the round loading bubble is the same pill with its label folded away.
    private var pill: some View {
        let inset = (height - disc) / 2
        return HStack(spacing: 8) {
            glyph
                .frame(width: disc, height: disc)
            if let title {
                Text(title)
                    .font(failed ? .subheadline : .footnote)
                    .foregroundStyle(failed ? style.text : style.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(motion.swap)
            }
        }
        .padding(.leading, inset)
        .padding(.trailing, title == nil ? inset : 16)
        .padding(.vertical, 10)
        .frame(minHeight: height)
        // A capsule while it is one line; a rounded rectangle if a large text size wraps its title.
        .pieceLiquid(RoundedRectangle(cornerRadius: height / 2, style: .continuous), tint: reduceTransparency ? style.field : nil, interactive: false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilitySortPriority(1)
    }

    private var accessibilityText: String {
        switch kind {
        case .loading: "Loading more"
        case .failed(let title): detail.isEmpty ? title : "\(title). \(detail)"
        case .done(let message): message
        }
    }

    /// The spinner, or a disc with the warning or the check. Each change blurs from one to the next.
    private var glyph: some View {
        ZStack {
            switch kind {
            case .loading:
                Spinner(color: style.secondaryText, reduceMotion: reduceMotion)
                    .transition(motion.swap)
            case .failed:
                mark("exclamationmark", fill: style.error)
                    // A retry that failed again: the pill is already showing, so only the disc answers.
                    .pieceShake(trigger: nudge, distance: 6)
                    .transition(motion.swap)
            case .done:
                mark("checkmark", fill: style.end)
                    .transition(motion.swap)
            }
        }
    }

    /// A warning or check on a solid disc, inside the glass like an icon.
    private func mark(_ symbol: String, fill: Color) -> some View {
        Image(systemName: symbol)
            .font(.system(size: disc * 0.5, weight: .semibold))
            .foregroundStyle(style.ink)
            .frame(width: disc, height: disc)
            .background(fill, in: Circle())
    }

    /// Retry: a signal glass bubble, the pill's primary action. Its glyph is hidden and its tint drained while it is
    /// home, so it melts into the pill as clear glass.
    private func retryBubble(out: Bool) -> some View {
        Button(action: retry) {
            ZStack {
                if busy {
                    Spinner(color: style.ink, reduceMotion: reduceMotion, diameter: 18)
                        .transition(motion.swap)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: height * 0.38, weight: .semibold))
                        .foregroundStyle(style.ink)
                        .transition(motion.swap)
                }
            }
            .animation(motion.snap, value: busy)
            .pieceBudContent(out: out)
            .frame(width: height, height: height)
            .pieceLiquid(.circle, tint: out ? style.retry : nil)
            .contentShape(.circle)
        }
        .buttonStyle(LiquidPress(glassPresses: liquidGlassPresses(reduceTransparency: reduceTransparency)))
        // Inert while the refresh runs: another tap would cancel it and start over. The style ignores isEnabled, so the
        // bubble keeps its look and VoiceOver reads it as dimmed. On its way home it no longer answers at all.
        .disabled(busy)
        .allowsHitTesting(failed)
        .accessibilityHidden(!failed)
        .accessibilityLabel(busy ? "Retrying" : "Retry")
        .accessibilityHint(hint)
    }
}

/// Whether shapes draw as Liquid Glass, which swells under a press by itself: iOS 26, unless Reduce Transparency asks
/// for solid shapes.
private func liquidGlassPresses(reduceTransparency: Bool) -> Bool {
    #if compiler(>=6.2)
    if #available(iOS 26, *) { return !reduceTransparency }
    #endif
    return false
}

/// Interactive Liquid Glass gives the press by itself. Where a control is drawn without it, it sinks under the finger
/// instead (and dims under Reduce Motion).
private struct LiquidPress: ButtonStyle {
    let glassPresses: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed && !glassPresses)
    }
}

/// A glass capsule with ink text, tinted for the primary action. 44pt tap target.
private struct LiquidButtonStyle: ButtonStyle {
    let tint: Color
    let ink: Color
    let glassPresses: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(ink)
            .padding(.horizontal, 20)
            .frame(minHeight: 44)
            .pieceLiquid(.capsule, tint: tint)
            .contentShape(.capsule)
            .pieceLiquidPress(configuration.isPressed && !glassPresses)
    }
}

/// The skeleton's pulse, on the clock so every row shares one wave however the list makes its cells. It travels down
/// the rows a beat apart, like a page feeding out. Under Reduce Motion the rows breathe together, so the list still
/// reads as loading without anything travelling.
private struct SkeletonPulse: ViewModifier {
    let index: Int
    let reduceMotion: Bool
    /// Seconds for one breath, between half and full strength.
    private let period: Double = 1.7

    func body(content: Content) -> some View {
        let lag = reduceMotion ? 0 : Double(index) * 0.12
        let period = period
        return TimelineView(.animation) { context in
            let t = (context.date.timeIntervalSinceReferenceDate - lag).truncatingRemainder(dividingBy: period)
            content.opacity(0.75 + 0.25 * cos(2 * .pi * t / period))
        }
    }
}

/// A rotating open arc. With Reduce Motion, three dots fade in turn instead of anything moving.
private struct Spinner: View {
    let color: Color
    let reduceMotion: Bool
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 22

    init(color: Color, reduceMotion: Bool, diameter: CGFloat = 22) {
        self.color = color
        self.reduceMotion = reduceMotion
        _size = ScaledMetric(wrappedValue: diameter, relativeTo: .body)
    }

    var body: some View {
        TimelineView(.animation) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            if reduceMotion {
                HStack(spacing: size * 0.22) {
                    ForEach(0..<3, id: \.self) { dot in
                        Circle()
                            .fill(color)
                            .frame(width: size * 0.26, height: size * 0.26)
                            .opacity(0.3 + 0.7 * max(0, sin((t * 2.4 - Double(dot) * 0.7).truncatingRemainder(dividingBy: .pi * 2))))
                    }
                }
            } else {
                Circle()
                    .trim(from: 0, to: 0.72)
                    .stroke(color, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round))
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees((t * 400).truncatingRemainder(dividingBy: 360)))
            }
        }
        .frame(height: size)
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

nonisolated private struct Receipt: Identifiable, Sendable {
    let id: Int
    let merchant: String
    let detail: String
    let amount: Double
    let block: UInt32
}

/// A fake paged API: five pages of 20, a short delay per page, and page 3 fails the first time it is asked for.
/// Page 1 fails on its second and third request, so the first refresh shows its chip and the first Retry fails again.
private actor ReceiptsAPI {
    private var failedOnce = false
    private var firstPageRequests = 0
    private static let merchants = ["Juniper Coffee", "Riverside Books", "Northline Transit", "Maison Bakery", "Studio Nine", "Fieldhouse Gym", "Almanac Market", "Sprig Florist", "Harbor Hardware", "Drift Records"]
    private static let blocks: [UInt32] = [0xFFD976, 0x9CC2FF, 0xA9DCB7, 0xCDB8FF, 0xE9D5B3, 0xFF0000]

    func fetch(page: Int) async throws -> [Receipt] {
        try await Task.sleep(for: .milliseconds(page == 1 ? 1200 : 800))
        // Counted after the delay, so a request cancelled while waiting doesn't use up a failure.
        if page == 1 {
            firstPageRequests += 1
            if (2...3).contains(firstPageRequests) { throw URLError(.notConnectedToInternet) }
        }
        if page == 3 && !failedOnce {
            failedOnce = true
            throw URLError(.networkConnectionLost)
        }
        guard (1...5).contains(page) else { return [] }
        return (0..<20).map { offset in
            let n = (page - 1) * 20 + offset
            return Receipt(id: n, merchant: Self.merchants[n % Self.merchants.count], detail: "Receipt \(1040 + n)", amount: Double((n * 37) % 90) + 4.5, block: Self.blocks[n % Self.blocks.count])
        }
    }
}

private struct ReceiptRow: View {
    let receipt: Receipt
    @ScaledMetric(relativeTo: .body) private var tile: CGFloat = 44

    var body: some View {
        HStack(spacing: 12) {
            Text(String(receipt.merchant.prefix(1)))
                .font(.headline)
                .foregroundStyle(adaptive(light: 0x141414, dark: 0x141414))
                .frame(width: tile, height: tile)
                .background(adaptive(light: receipt.block, dark: receipt.block), in: .rect(cornerRadius: tile * 0.3, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(receipt.merchant)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(adaptive(light: 0x141414, dark: 0xF4F3EF))
                Text(receipt.detail)
                    .font(.subheadline)
                    .foregroundStyle(adaptive(light: 0x5C5A56, dark: 0xA6A49F))
            }
            Spacer(minLength: 8)
            Text(receipt.amount, format: .currency(code: "USD"))
                .font(.body.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(adaptive(light: 0x141414, dark: 0xF4F3EF))
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }
}

/// Scroll to page 3 to see the inline retry chip. Pull down to see the refresh chip: that refresh fails, and so does
/// its first Retry. Each example owns its API, so a second preview's first load never draws a refresh failure.
private struct PagedListExample: View {
    @State private var api = ReceiptsAPI()

    var body: some View {
        PagedList(pageSize: 20) { [api] page in
            try await api.fetch(page: page)
        } row: { receipt in
            ReceiptRow(receipt: receipt)
        }
        .scrollContentBackground(.hidden)
        // The house type: one weight for every string. The piece sets it on its own states; rows are yours.
        .fontWeight(.semibold)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    PagedListExample()
}

#Preview("Dark") {
    PagedListExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, shake)

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

/// A short decaying side-to-side shake for refused input, each time `trigger` changes. Under Reduce Motion it stays
/// still (same view, no identity change): pair it with a color or message change and the error haptic.
private struct PieceShake: ViewModifier {
    let trigger: AnyHashable
    var distance: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance = reduceMotion ? 0 : distance
        content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-distance, duration: 0.06)
                CubicKeyframe(distance * 0.75, duration: 0.07)
                CubicKeyframe(-distance * 0.5, duration: 0.07)
                CubicKeyframe(distance * 0.25, duration: 0.06)
                SpringKeyframe(0, duration: 0.12, spring: Spring(duration: 0.18, bounce: 0))
            }
        }
    }
}

private extension View {
    /// Shakes this view side to side once each time `trigger` changes, for input that was refused.
    func pieceShake(trigger: some Hashable & Sendable, distance: CGFloat = 8) -> some View {
        modifier(PieceShake(trigger: AnyHashable(trigger), distance: distance))
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
