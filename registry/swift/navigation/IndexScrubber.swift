// swiftpieces:
// title: Index Scrubber
// description: "An A to Z section index for long lists in any scroll view: the letters sit on a liquid glass rail on the trailing edge. Touch or drag it to jump to the section under your finger with a selection tick per new section, while a signal glass bead rides the rail under the active letter and a large letter bubble buds out of the rail beside it on a liquid neck, follows the finger, rolls its letter in the direction of travel and melts back in on release. Letters without a section are dimmed or hidden, a dotted collapse covers rails too short for every title, and there is one adjustable VoiceOver element and type-to-jump on a hardware keyboard."
// category: navigation
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-29"
// tags: [index, alphabet, sections, scrubber, jump, contacts, list, scroll]

import SwiftUI
import UIKit

/// A section index rail for long sectioned lists (contacts, glossaries, countries, recipes) that works with
/// `ScrollView`, `LazyVStack` and `List` on iOS 17 and later.
///
/// Touch down or drag along the rail to jump to the section under the finger. Most apps use the
/// `.indexScrubber(_:proxy:)` modifier on a scroll view inside a `ScrollViewReader`; use the view itself when
/// you scroll some other way, and place it on the trailing edge yourself.
///
/// - Parameters:
///   - titles: Your section titles, in list order. They are also the values passed to `onSelect`, so use the same strings as the ids you scroll to. Duplicates and empty strings are ignored.
///   - selection: The section last jumped to. Written on every jump; write it yourself (for example from your own scroll tracking) so VoiceOver starts adjusting from the section on screen.
///   - index: What the rail lists. `.sections` shows exactly `titles`; `.alphabet` shows the current locale's index letters (A to Z and # in English) and matches each section to a letter by its first character; `.custom` takes your own entries.
///   - missing: What happens to index entries that have no section: `.dimmed` keeps them in place in a quieter color (the finger lands on the nearest section after them), `.hidden` leaves them out.
///   - style: Colors for the letters, the letter bubble and its ink. Defaults to the SwiftPieces house palette, adapting to light and dark.
///   - onSelect: Called with the section title to jump to: once on touch down, then each time the finger reaches a new section, and on VoiceOver or keyboard moves. Scroll without animation here, the way the system index does.
public struct IndexScrubber: View {
    /// The entries the rail lists.
    public enum Index: Sendable, Hashable {
        /// Exactly the section titles, in order.
        case sections
        /// The current locale's section index letters (`UILocalizedIndexedCollation`), such as A to Z and # in English.
        case alphabet
        /// Your own entries, in order, such as `["A", "B", "C", "#"]` or kana rows.
        case custom([String])
    }

    /// How entries without a section appear.
    public enum Missing: Sendable, Hashable {
        /// Shown in the dimmed color; touching one lands on the nearest section after it.
        case dimmed
        /// Left out of the rail.
        case hidden
    }

    /// Colors. `.standard` is the house palette.
    public struct Style: Sendable {
        /// Entries that have a section.
        public var label: Color
        /// Entries without a section, and the dots of a collapsed rail.
        public var dimmed: Color
        /// Unused since the liquid glass refactor: the rail is a clear liquid glass capsule. Kept so existing code still compiles.
        public var track: Color
        /// The glass tint of the letter bubble and of the bead under the active entry.
        public var bubble: Color
        /// Text on the letter bubble and the active entry.
        public var ink: Color

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(label: Color? = nil, dimmed: Color? = nil, track: Color? = nil, bubble: Color? = nil, ink: Color? = nil) {
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.dimmed = dimmed ?? adaptive(light: 0xB3B1AB, dark: 0x5C5A57)
            self.track = track ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.bubble = bubble ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
        }

        public static let standard = Style()
    }

    @Binding private var selection: String?
    private let titles: [String]
    private let index: Index
    private let missing: Missing
    private let style: Style
    private let onSelect: (String) -> Void

    public init(_ titles: [String], selection: Binding<String?>, index: Index = .sections, missing: Missing = .dimmed, style: Style = .standard, onSelect: @escaping (String) -> Void = { _ in }) {
        self.titles = titles
        self._selection = selection
        self.index = index
        self.missing = missing
        self.style = style
        self.onSelect = onSelect
    }

    public var body: some View {
        IndexRail(model: IndexModel(titles: titles, index: index, missing: missing), selection: $selection, style: style, onSelect: onSelect)
            .fontWeight(.semibold)
            // The rail is a compact navigation control, like a tab bar: it grows with Dynamic Type up to the
            // first accessibility size, then collapses entries instead. The letter bubble shows the section at
            // display size while scrubbing, which is the large-content view of the entry under the finger.
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    }
}

public extension View {
    /// Adds an ``IndexScrubber`` on the trailing edge (leading in right-to-left languages) that scrolls with `proxy`.
    ///
    /// Give each section an id equal to its title, for example `ForEach(sections, id: \.title) { Section { … } }`.
    /// Jumps scroll without animation, with the section's top at `anchor`. The scroll view's content is inset by
    /// the rail's width (44pt at the default text size) so rows never sit under it; with no titles the rail takes no space.
    func indexScrubber(_ titles: [String], proxy: ScrollViewProxy, selection: Binding<String?>? = nil, index: IndexScrubber.Index = .sections, missing: IndexScrubber.Missing = .dimmed, anchor: UnitPoint = .top, style: IndexScrubber.Style = .standard) -> some View {
        modifier(IndexScrubberOverlay(titles: titles, proxy: proxy, selection: selection, index: index, missing: missing, anchor: anchor, style: style))
    }
}

private struct IndexScrubberOverlay: ViewModifier {
    let titles: [String]
    let proxy: ScrollViewProxy
    let selection: Binding<String?>?
    let index: IndexScrubber.Index
    let missing: IndexScrubber.Missing
    let anchor: UnitPoint
    let style: IndexScrubber.Style
    @State private var ownSelection: String?

    func body(content: Content) -> some View {
        // An inset rather than an overlay: rows lay out beside the rail instead of under it, as they do beside
        // the system index, and the space follows the rail's Dynamic Type width.
        content.safeAreaInset(edge: .trailing, spacing: 0) {
            IndexScrubber(titles, selection: selection ?? $ownSelection, index: index, missing: missing, style: style) { title in
                var jump = Transaction()
                jump.disablesAnimations = true
                withTransaction(jump) { proxy.scrollTo(title, anchor: anchor) }
            }
            .padding(.vertical, 8)
        }
    }
}

// MARK: - Model

/// Sections and the entries shown for them. Built from the parameters on each render; cheap for any real index.
private struct IndexModel: Equatable {
    struct Entry: Equatable {
        let title: String
        /// Index into `sections`, or nil when no section starts with this entry.
        let target: Int?
    }

    let sections: [String]
    let entries: [Entry]

    @MainActor
    init(titles: [String], index: IndexScrubber.Index, missing: IndexScrubber.Missing) {
        var seen = Set<String>()
        let sections = titles.filter { !$0.isEmpty && seen.insert($0).inserted }
        self.sections = sections

        let labels: [String]
        switch index {
        case .sections:
            entries = sections.enumerated().map { Entry(title: $1, target: $0) }
            return
        case .alphabet:
            let collated = UILocalizedIndexedCollation.current().sectionIndexTitles
            labels = collated.isEmpty ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".map(String.init) : collated
        case .custom(let custom):
            var seenLabels = Set<String>()
            labels = custom.filter { !$0.isEmpty && seenLabels.insert($0).inserted }
        }

        // Each section belongs to exactly one entry; an entry jumps to the first section that belongs to it.
        var targets = [Int?](repeating: nil, count: labels.count)
        for (s, section) in sections.enumerated() {
            if let e = Self.entry(for: section, in: labels), targets[e] == nil { targets[e] = s }
        }
        let all = zip(labels, targets).map { Entry(title: $0, target: $1) }
        // A rail where nothing can be reached (no sections yet, or none match) is not shown at all.
        guard all.contains(where: { $0.target != nil }) else {
            entries = []
            return
        }
        entries = missing == .hidden ? all.filter { $0.target != nil } : all
    }

    /// The whole title, then its first character, case-insensitively; then ignoring accents (so "Ö" finds "O"
    /// only where the locale has no "Ö" entry); titles starting with a digit or symbol fall under "#".
    private static func entry(for section: String, in labels: [String]) -> Int? {
        let title = section.trimmingCharacters(in: .whitespaces)
        guard let first = title.first else { return nil }
        let head = String(first)
        func find(_ text: String, _ options: String.CompareOptions) -> Int? {
            labels.firstIndex { $0.compare(text, options: options, range: nil, locale: .current) == .orderedSame }
        }
        return find(title, .caseInsensitive)
            ?? find(head, .caseInsensitive)
            ?? find(head, [.caseInsensitive, .diacriticInsensitive])
            ?? (first.isLetter ? nil : labels.firstIndex(of: "#"))
    }

    /// The entry a touch on entry `i` lands on: itself when it has a section, else the nearest one after it, else before.
    func resolve(_ i: Int) -> Int? {
        guard entries.indices.contains(i) else { return nil }
        if entries[i].target != nil { return i }
        if let after = entries[(i + 1)...].firstIndex(where: { $0.target != nil }) { return after }
        return entries[..<i].lastIndex(where: { $0.target != nil })
    }

    /// The first entry that jumps to section `s`.
    func entry(forSection s: Int) -> Int? {
        entries.firstIndex { $0.target == s }
    }
}

/// Rows of the visible column: every entry, or when too short, evenly spaced entries with a dot between each.
private enum Row: Equatable {
    case entry(Int)
    case dot
}

/// Rail geometry captured at touch down: the column and the rail's top and height in screen space.
private struct Frozen: Equatable {
    let column: Column
    let top: CGFloat
    let height: CGFloat
}

private struct Column: Equatable {
    let rows: [Row]
    let count: Int
    let rowHeight: CGFloat
    /// Top of the column inside the rail.
    let top: CGFloat
    var height: CGFloat { CGFloat(rows.count) * rowHeight }

    init(count: Int, available: CGFloat, rowHeight: CGFloat, railHeight: CGFloat) {
        self.count = count
        self.rowHeight = rowHeight
        let capacity = rowHeight > 0 ? Int((max(available, 0) / rowHeight).rounded(.down)) : 0
        if count <= 0 || capacity <= 0 {
            rows = []
        } else if count <= capacity {
            rows = (0..<count).map(Row.entry)
        } else {
            // Odd number of slots so the column starts and ends on an entry: A • E • I … Z.
            let slots = capacity.isMultiple(of: 2) ? capacity - 1 : capacity
            if slots < 3 {
                rows = [.entry(0)]
            } else {
                let shown = (slots + 1) / 2
                var rows: [Row] = []
                for k in 0..<shown {
                    if k > 0 { rows.append(.dot) }
                    rows.append(.entry(Int((Double(k) * Double(count - 1) / Double(shown - 1)).rounded())))
                }
                self.rows = rows
            }
        }
        top = (railHeight - CGFloat(rows.count) * rowHeight) / 2
    }

    /// The entry under a point. The finger maps proportionally along the whole column, so over a dot it
    /// lands on the entries that dot stands for.
    func entry(at y: CGFloat) -> Int {
        guard count > 0, height > 0 else { return 0 }
        let fraction = min(max((y - top) / height, 0), 0.9999)
        return min(Int(fraction * CGFloat(count)), count - 1)
    }

    /// Centre of entry `i` along the column, and the visible row drawn there.
    func center(of i: Int) -> CGFloat {
        guard count > 0 else { return top }
        return top + (CGFloat(i) + 0.5) / CGFloat(count) * height
    }

    func row(of i: Int) -> Int {
        guard count > 0, !rows.isEmpty else { return 0 }
        return min(Int((CGFloat(i) + 0.5) / CGFloat(count) * CGFloat(rows.count)), rows.count - 1)
    }
}

// MARK: - Rail

private struct IndexRail: View {
    let model: IndexModel
    @Binding var selection: String?
    let style: IndexScrubber.Style
    let onSelect: (String) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.isEnabled) private var isEnabled
    @FocusState private var isFocused: Bool
    @ScaledMetric(relativeTo: .caption2) private var rowHeight: CGFloat = 16
    @ScaledMetric(relativeTo: .caption2) private var columnWidth: CGFloat = 20
    @ScaledMetric(relativeTo: .title) private var bubbleSize: CGFloat = 68

    /// The entry the finger (or keyboard) is on, resolved to one with a section. Nil when idle.
    @State private var active: Int?
    /// The rail's geometry at touch down, kept until the finger lifts. Nil when no finger is down.
    @State private var frozen: Frozen?
    /// Direction of travel, so the letter in the bubble rolls the way the finger moves.
    @State private var movingDown = true
    @State private var tick = 0
    /// Bumped by keyboard moves; the bubble stays out briefly after each, then melts home.
    @State private var keyFlash = 0
    /// How far the bubble is drawn past the end of the column while the finger drags beyond it. Set directly, never
    /// animated, and cleared at lift-off. Only the drawing goes past: the entry stays the first or last.
    @State private var pull: CGFloat = 0
    /// When the finger last reached a new section, and whether the letter rolls to it or blurs in place.
    @State private var lastStep: ContinuousClock.Instant?
    @State private var rolls = true
    /// The bead on the rail and the letter bubble beside it: out while a finger or the keyboard is on an entry,
    /// melting back into the rail once it lets go.
    @State private var buds = PieceBuds()
    /// The entry the bead and the bubble last stood on, kept while they melt home after `active` clears.
    @State private var lastEntry: Int?
    /// The letter bubble's width, so it can narrow to a drop the rail can hold on its way home.
    @State private var bubbleWidth: CGFloat = 68
    /// True while a finger is down. Resets by itself when the system cancels the touch, which `onEnded` misses.
    @GestureState private var isTouching = false

    private let inset: CGFloat = 8
    /// How far past an end the bubble can be pulled: well under a row, so it never reaches the next letter.
    private let bandLimit: CGFloat = 10

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    private var hitWidth: CGFloat { max(44, columnWidth + 24) }
    private var trackWidth: CGFloat { columnWidth + 8 }
    private var isShowingTrack: Bool { active != nil || isFocused }
    /// `active`, dropped if the titles changed under it.
    private var validActive: Int? { active.flatMap { model.entries.indices.contains($0) ? $0 : nil } }
    /// Where the bead and the bubble stand: the active entry, or the last one while they melt home.
    private var standing: Int? { validActive ?? lastEntry.flatMap { model.entries.indices.contains($0) ? $0 : nil } }

    var body: some View {
        if model.entries.isEmpty {
            // Nothing to index: take no room and no touches.
            Color.clear.frame(width: 0).accessibilityHidden(true)
        } else {
            rail
        }
    }

    private var rail: some View {
        GeometryReader { geo in
            let live = Column(count: model.entries.count, available: geo.size.height - inset * 2 - 12, rowHeight: rowHeight, railHeight: geo.size.height)
            let origin = geo.frame(in: .global).minY
            // While a finger is down the rail keeps the geometry it had at touch down, pinned in screen space,
            // so a jump that resizes the scroll view (a large title collapsing) never moves letters under the finger.
            let pin = frozen.flatMap { $0.column.count == live.count ? $0 : nil } ?? Frozen(column: live, top: origin, height: geo.size.height)
            let shift = pin.top - origin
            let stand = standing
            let showing = isShowingTrack
            let swell: CGFloat = showing && !reduceMotion ? 4 : 0
            let (grab, letGo) = (motion.press, motion.dismiss)
            PieceLiquidGroup {
                ZStack(alignment: .trailing) {
                    Color.clear
                    // The rail: a clear glass capsule carrying the letters and the bead as its content, so the letters
                    // draw crisp on top. Grabbed, it swells a little either side of the letters, ahead of the bead and
                    // the bubble, without moving them or the layout.
                    columnView(pin.column, active: validActive, bead: stand)
                        .frame(width: trackWidth + swell, height: pin.column.height + 12)
                        .pieceLiquid(.capsule, interactive: false)
                        .padding(.horizontal, -swell / 2)
                        // It swells on the press spring; it settles with the lift-off (or on dismiss for focus).
                        .transaction(value: showing) { $0.animation = showing ? grab : $0.animation ?? letGo }
                        .padding(.trailing, 4)
                        .offset(y: pin.height / 2 + shift - geo.size.height / 2)
                        .frame(maxHeight: .infinity)
                }
                .overlay(alignment: .topTrailing) {
                    if buds.contains("letter"), let stand, let target = model.entries[stand].target {
                        bubble(model.sections[target], column: pin.column, entry: stand, railHeight: pin.height, shift: shift)
                    }
                }
            }
            .contentShape(.rect)
            .gesture(scrub(live, origin: origin, height: geo.size.height), including: isEnabled ? .all : .subviews)
        }
        .frame(width: hitWidth)
        .opacity(isEnabled ? 1 : 0.4)
        .sensoryFeedback(.selection, trigger: tick)
        .onChange(of: isTouching) { _, touching in
            guard !touching else { return }
            // Lift-off. The bubble and the bead melt back into the rail together, so tapping letter by letter only
            // overlaps the tail of the last melt. The rail moves into the place the list now gives it (after a large
            // title collapsed) at the same moment, on the tight spring with no overshoot, most of the way there in
            // about a tenth of a second. The pull needs no rebound of its own: the bubble it moved is going home, and
            // draws back to its letter as it melts (see `bubble`).
            withAnimation(motion.dismiss) {
                active = nil
                pull = 0
            }
            withAnimation(.spring(PieceMotion.tight)) { frozen = nil }
        }
        // A finger or a key lands: the bead buds out of the rail under the entry and the bubble out beside it, a beat
        // behind. Let go, the bubble melts home first and the bead after it.
        .onChange(of: active != nil) { _, on in
            Task {
                if on { await buds.bloom(["bead", "letter"], reduceMotion: reduceMotion) } else { await buds.gather(["bead", "letter"], reduceMotion: reduceMotion) }
            }
        }
        .focusable(isEnabled)
        .focused($isFocused)
        .focusEffectDisabled()
        .onKeyPress(phases: [.down, .repeat], action: key)
        .task(id: keyFlash) {
            guard keyFlash > 0 else { return }
            try? await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled, frozen == nil else { return }
            withAnimation(PieceMotion(reduceMotion: reduceMotion).dismiss) { active = nil }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Section index", comment: "VoiceOver label of the A to Z rail beside a list"))
        .accessibilityValue(Text(verbatim: selection ?? model.sections.first ?? ""))
        .accessibilityAdjustableAction(adjust)
    }

    // MARK: Column

    private func columnView(_ column: Column, active: Int?, bead: Int?) -> some View {
        let activeRow = active.map(column.row(of:))
        return ZStack(alignment: .top) {
            // Under the letters, as a tinted glass shape of its own in the rail's group.
            if buds.contains("bead"), let bead { beadView(column, entry: bead) }
            VStack(spacing: 0) {
                ForEach(Array(column.rows.enumerated()), id: \.offset) { offset, row in
                    rowView(row, isActive: activeRow == offset)
                        .frame(width: columnWidth, height: column.rowHeight)
                }
            }
        }
    }

    /// The active entry's bead: a signal glass drop in the rail. It buds out of the rail under the entry the finger
    /// lands on, glides from row to row on the snap spring with a small give, and melts back into the rail on release,
    /// its tint draining as it goes. Over a dot of a collapsed rail it shrinks to stand for that dot.
    private func beadView(_ column: Column, entry: Int) -> some View {
        let out = buds.isOut("bead")
        let row = column.row(of: entry)
        let onDot = column.rows.indices.contains(row) && column.rows[row] == .dot
        let size = onDot ? 8 : Swift.min(columnWidth, rowHeight + 3)
        return Color.clear
            .frame(width: size, height: size)
            .pieceLiquid(.circle, tint: out ? style.bubble : nil, interactive: false)
            .pieceBud(out: out, home: .zero)
            .offset(y: (CGFloat(row) + 0.5) * column.rowHeight - size / 2)
            .animation(motion.snap, value: row)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func rowView(_ row: Row, isActive: Bool) -> some View {
        switch row {
        case .entry(let i):
            let entry = model.entries[i]
            Text(verbatim: entry.title)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .foregroundStyle(isActive ? style.ink : entry.target == nil ? style.dimmed : style.label)
                .transaction(value: isActive, detent(isActive))
        case .dot:
            // Over an active dot the bead itself stands for it, so the dimmed dot gives way.
            Circle()
                .fill(style.dimmed)
                .frame(width: 4, height: 4)
                .opacity(isActive ? 0 : 1)
                .transaction(value: isActive, detent(isActive))
        }
    }

    /// How a row's ink follows the bead: it turns as the bead glides in on the snap spring and back as it glides out
    /// on the same spring, unless lift-off brings its own animation: then it settles with the bead's melt.
    private func detent(_ isActive: Bool) -> (inout Transaction) -> Void {
        let glide = motion.snap
        return { transaction in
            if isActive || transaction.animation == nil { transaction.animation = glide }
        }
    }

    // MARK: Bubble

    /// The letter bubble, inward from the rail and joined to it by a liquid neck, centred on the entry and kept inside
    /// the rail's height, apart from the small pull past an end. It buds out of the rail at its entry and melts back in
    /// there: born as a drop inside the rail, it springs out and opens to its full size, and going home it narrows to
    /// the drop again, its tint draining, so it never spills past the rail or sits red over the letters.
    private func bubble(_ title: String, column: Column, entry: Int, railHeight: CGFloat, shift: CGFloat) -> some View {
        let out = buds.isOut("letter")
        let y = column.center(of: entry) - bubbleSize / 2
        let place = Swift.min(Swift.max(y, 0), Swift.max(railHeight - bubbleSize, 0))
        // Home is the entry's spot in the middle of the rail: across the neck, then up or down to the entry when the
        // bubble was held inside the rail's ends.
        let home = CGSize(width: PieceLiquid.joined + bubbleWidth / 2 + trackWidth / 2, height: y - place)
        let drop = Swift.min(1, trackWidth / Swift.max(bubbleWidth, 1))
        return HStack(spacing: PieceLiquid.joined) {
            ZStack {
                Text(verbatim: title)
                    .font(.system(size: bubbleSize * 0.5, weight: .semibold))
                    .tracking(-0.5)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .foregroundStyle(style.ink)
                    .padding(.horizontal, bubbleSize * 0.18)
                    .id(title)
                    .transition(letterTransition)
            }
            .pieceBudContent(out: out)
            .frame(minWidth: bubbleSize, maxWidth: bubbleSize * 2.6)
            .frame(height: bubbleSize)
            .clipShape(.capsule)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { bubbleWidth = $0 }
            .pieceLiquid(.capsule, tint: out ? style.bubble : nil, interactive: false)
            // The letter is a readout, so it rolls like a counter, without overshoot.
            .animation(rolls ? motion.value : .spring(PieceMotion.tight), value: title)
            // Through the glass, so the letter shrinks with its bubble (a scaleEffect on glass leaves it behind).
            .pieceLiquidScale(out || reduceMotion ? 1 : drop)
            .pieceBud(out: out, home: home)

            Color.clear.frame(width: trackWidth + 4, height: 1)
        }
        .fixedSize()
        // The bubble rides a beat behind the bead, on a tight follow so it never trails a row behind for long.
        .offset(y: place)
        .animation(motion.follow(PieceMotion.tight, rank: 1), value: place)
        // Outside the follow, so neither is ever animated: the pin's shift holds the bubble on its letter when the
        // rail moves under a held finger (a large title collapsing), and past either end it gives with the finger.
        .offset(y: shift + pull)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// The letter rolls the way the finger moves, blurring as it goes like a counter's digits. Too fast to roll, or
    /// turning back (see `land`), it blurs from old to new in place instead.
    private var letterTransition: AnyTransition {
        guard rolls else { return motion.swap }
        let blur = AnyTransition(.blurReplace)
        return motion.transition(.asymmetric(
            insertion: .move(edge: movingDown ? .bottom : .top).combined(with: blur),
            removal: .move(edge: movingDown ? .top : .bottom).combined(with: blur)
        ))
    }

    // MARK: Input

    private func scrub(_ live: Column, origin: CGFloat, height: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .updating($isTouching) { _, touching, _ in touching = true }
            .onChanged { value in
                let isFirst = frozen == nil || frozen?.column.count != live.count
                if isFirst { frozen = Frozen(column: live, top: origin, height: height) }
                guard let pin = frozen else { return }
                let y = value.location.y - pin.top
                band(y, from: value.startLocation.y - pin.top, along: pin.column)
                guard let entry = model.resolve(pin.column.entry(at: y)) else { return }
                land(on: entry, force: isFirst)
            }
    }

    /// Past either end of the column the bubble follows the finger with rubber-band resistance, banding the whole
    /// overshoot. The ends move out to where the finger came down if that was in the empty rail beyond the letters,
    /// so a still touch there never pulls; only dragging further out does. The entry stays the first or last, so
    /// nothing scrolls and nothing ticks. Off under Reduce Motion.
    private func band(_ y: CGFloat, from start: CGFloat, along column: Column) {
        let top = Swift.min(column.top, start)
        let bottom = Swift.max(column.top + column.height, start)
        let past = y < top ? y - top : Swift.max(y - bottom, 0)
        let drawn = reduceMotion || column.height <= 0 ? 0 : PieceMotion.rubberBand(past, limit: bandLimit)
        if drawn != pull { pull = drawn }
    }

    /// Moves to `entry`. Scrolls and ticks only when the section changes, except on touch down, which always
    /// scrolls: the list may have moved away from the last section since.
    private func land(on entry: Int, force: Bool) {
        guard let target = model.entries[entry].target else { return }
        let previous = validActive
        if let previous, previous != entry {
            let down = entry > previous
            let now = ContinuousClock.now
            let fast = lastStep.map { $0.duration(to: now) < .milliseconds(150) } ?? false
            // Faster than a roll lands (about 7 sections a second), or turning back, the letter blurs in place instead:
            // the bubble never piles up letters, and the one arriving never crosses one still rolling the other way
            // (a leaving letter keeps the transition it last had).
            rolls = down == movingDown && !fast
            movingDown = down
            lastStep = now
        }
        let changed = previous.flatMap { model.entries[$0].target } != target
        // On touch down the bead and the bubble bud out of the rail here (see the `active` change in `rail`).
        active = entry
        lastEntry = entry
        guard changed || force else { return }
        let title = model.sections[target]
        if changed || selection != title { tick += 1 }
        selection = title
        onSelect(title)
    }

    private func key(_ press: KeyPress) -> KeyPress.Result {
        let current = currentEntry
        var next: Int?
        switch press.key {
        case .upArrow:
            next = model.entries[..<(current ?? 0)].lastIndex { $0.target != nil }
        case .downArrow:
            let start = current.map { $0 + 1 } ?? 0
            next = start < model.entries.count ? model.entries[start...].firstIndex { $0.target != nil } : nil
        case .home:
            next = model.resolve(0)
        case .end:
            next = model.entries.lastIndex { $0.target != nil }
        default:
            let typed = press.characters.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !typed.isEmpty, press.modifiers.isDisjoint(with: [.command, .control, .option]) else { return .ignored }
            guard let hit = model.entries.firstIndex(where: {
                $0.title.compare(typed, options: [.caseInsensitive, .diacriticInsensitive], range: nil, locale: .current) == .orderedSame
            }) else { return .ignored }
            next = model.resolve(hit)
        }
        guard let next else { return .handled }
        land(on: next, force: true)
        keyFlash += 1
        return .handled
    }

    /// The entry for the bound selection, for keyboard and VoiceOver moves.
    private var currentEntry: Int? {
        if let validActive { return validActive }
        guard let selection, let s = model.sections.firstIndex(of: selection) else { return nil }
        return model.entry(forSection: s)
    }

    /// VoiceOver swipes step through every section, including any the rail's entries do not reach.
    private func adjust(_ direction: AccessibilityAdjustmentDirection) {
        guard !model.sections.isEmpty else { return }
        let current = selection.flatMap { model.sections.firstIndex(of: $0) }
        let next: Int
        switch direction {
        case .increment: next = current.map { Swift.min($0 + 1, model.sections.count - 1) } ?? 0
        case .decrement: next = current.map { Swift.max($0 - 1, 0) } ?? 0
        @unknown default: return
        }
        guard next != current else { return }
        let title = model.sections[next]
        selection = title
        onSelect(title)
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

/// A contacts list with pinned letter headers and the A to Z index on the trailing edge.
private struct IndexScrubberExample: View {
    private struct ContactGroup: Identifiable {
        let title: String
        let names: [String]
        var id: String { title }
    }

    private static let groups: [ContactGroup] = {
        let names = [
            "Aiko Tanaka", "Amara Okafor", "Anders Lind", "Beatriz Souza", "Bram de Vries", "Camille Roche", "Chen Wei",
            "Cora Whitfield", "Dmitri Volkov", "Dalia Haddad", "Elena Petrova", "Emeka Obi", "Farah Siddiqui", "Felix Brandt",
            "Grace Holloway", "Hana Kobayashi", "Hugo Marchetti", "Ines Castillo", "Isla Mackenzie", "Jonah Reyes", "Julia Novak",
            "Kofi Mensah", "Leila Farouk", "Liam Gallagher", "Maya Lindqvist", "Mateo Alvarez", "Nadia Rahman", "Noor Aziz",
            "Oscar Bergman", "Priya Raman", "Rafael Duarte", "Rosa Delgado", "Sofia Esposito", "Soren Dahl", "Tariq Nasser",
            "Uma Iyer", "Vera Lindgren", "Wren Calloway", "Yusuf Demir",
        ]
        return Dictionary(grouping: names) { String($0.prefix(1)) }
            .map { ContactGroup(title: $0.key, names: $0.value.sorted()) }
            .sorted { $0.title < $1.title }
    }()

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: .sectionHeaders) {
                    ForEach(Self.groups) { group in
                        Section {
                            ForEach(group.names, id: \.self) { name in
                                Text(name)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                                    .padding(.leading, 20)
                                    .padding(.trailing, 8)
                            }
                        } header: {
                            Text(group.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(adaptive(light: 0x5C5A56, dark: 0xA6A49F))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 6)
                                .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
                        }
                    }
                }
            }
            .indexScrubber(Self.groups.map(\.title), proxy: proxy, index: .alphabet)
        }
        .foregroundStyle(adaptive(light: 0x141414, dark: 0xF4F3EF))
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    IndexScrubberExample()
}

#Preview("Dark") {
    IndexScrubberExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, rubberBand)

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
