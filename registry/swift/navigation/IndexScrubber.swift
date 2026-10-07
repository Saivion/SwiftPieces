// swiftpieces:
// title: Index Scrubber
// description: "An A to Z section index for long lists in any scroll view: touch or drag the trailing rail to jump to the section under your finger with a selection tick per new section, a large letter block that follows the finger and rolls in the direction of travel, letters without a section dimmed or hidden, a dotted collapse when the rail is too short for every title, one adjustable VoiceOver element and type-to-jump on a hardware keyboard."
// category: navigation
// minIOSVersion: "17.0"
// version: "1.0.1"
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
///   - style: Colors for the letters, the track behind the rail while scrubbing and the letter block. Defaults to the SwiftPieces house palette, adapting to light and dark.
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
        /// The capsule behind the rail while scrubbing or keyboard focused.
        public var track: Color
        /// The large letter block and the active entry's disc.
        public var bubble: Color
        /// Text on the block and the active entry.
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
            // The rail is a compact navigation control, like a tab bar: it grows with Dynamic Type up to the
            // first accessibility size, then collapses entries instead. The letter block shows the section at
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
    /// Direction of travel, so the letter in the block rolls the way the finger moves.
    @State private var movingDown = true
    @State private var tick = 0
    /// Bumped by keyboard moves; the block stays up briefly after each, then leaves.
    @State private var keyFlash = 0
    /// True while a finger is down. Resets by itself when the system cancels the touch, which `onEnded` misses.
    @GestureState private var isTouching = false

    private let inset: CGFloat = 8

    private var hitWidth: CGFloat { max(44, columnWidth + 24) }
    private var trackWidth: CGFloat { columnWidth + 8 }
    private var isShowingTrack: Bool { active != nil || isFocused }
    /// `active`, dropped if the titles changed under it.
    private var validActive: Int? { active.flatMap { model.entries.indices.contains($0) ? $0 : nil } }

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
            let activeEntry = validActive
            ZStack(alignment: .trailing) {
                Color.clear
                columnView(pin.column, active: activeEntry)
                    .frame(width: trackWidth, height: pin.column.height + 12)
                    .background {
                        Capsule(style: .continuous)
                            .fill(style.track)
                            .opacity(isShowingTrack ? 1 : 0)
                    }
                    .padding(.trailing, 4)
                    .offset(y: pin.height / 2 + shift - geo.size.height / 2)
                    .frame(maxHeight: .infinity)
            }
            .contentShape(.rect)
            .overlay(alignment: .topTrailing) {
                if let activeEntry, let target = model.entries[activeEntry].target {
                    bubble(model.sections[target], column: pin.column, entry: activeEntry, railHeight: pin.height, shift: shift)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.4, anchor: layoutDirection == .rightToLeft ? .leading : .trailing).combined(with: .opacity))
                }
            }
            .gesture(scrub(live, origin: origin, height: geo.size.height), including: isEnabled ? .all : .subviews)
        }
        .frame(width: hitWidth)
        .opacity(isEnabled ? 1 : 0.4)
        .animation(.smooth(duration: 0.2), value: isShowingTrack)
        .sensoryFeedback(.selection, trigger: tick)
        .onChange(of: isTouching) { _, touching in
            guard !touching else { return }
            withAnimation(.smooth(duration: 0.25).delay(0.12)) {
                frozen = nil
                active = nil
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
            withAnimation(.smooth(duration: 0.25)) { active = nil }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Section index", comment: "VoiceOver label of the A to Z rail beside a list"))
        .accessibilityValue(Text(verbatim: selection ?? model.sections.first ?? ""))
        .accessibilityAdjustableAction(adjust)
    }

    // MARK: Column

    private func columnView(_ column: Column, active: Int?) -> some View {
        let activeRow = active.map(column.row(of:))
        return VStack(spacing: 0) {
            ForEach(Array(column.rows.enumerated()), id: \.offset) { offset, row in
                rowView(row, isActive: activeRow == offset)
                    .frame(width: columnWidth, height: column.rowHeight)
            }
        }
    }

    @ViewBuilder
    private func rowView(_ row: Row, isActive: Bool) -> some View {
        let disc = Swift.min(columnWidth, rowHeight + 3)
        switch row {
        case .entry(let i):
            let entry = model.entries[i]
            Text(verbatim: entry.title)
                .font(.caption2.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .foregroundStyle(isActive ? style.ink : entry.target == nil ? style.dimmed : style.label)
                .background {
                    Circle()
                        .fill(style.bubble)
                        .frame(width: disc, height: disc)
                        .scaleEffect(isActive ? 1 : 0.3)
                        .opacity(isActive ? 1 : 0)
                }
                .animation(reduceMotion ? nil : .spring(duration: 0.22, bounce: 0.3), value: isActive)
        case .dot:
            Circle()
                .fill(isActive ? style.bubble : style.dimmed)
                .frame(width: isActive ? 8 : 4, height: isActive ? 8 : 4)
                .animation(reduceMotion ? nil : .spring(duration: 0.22, bounce: 0.3), value: isActive)
        }
    }

    // MARK: Bubble

    /// The letter block, inward from the track, centred on the active entry and kept inside the rail.
    private func bubble(_ title: String, column: Column, entry: Int, railHeight: CGFloat, shift: CGFloat) -> some View {
        let y = column.center(of: entry) - bubbleSize / 2
        let clamped = Swift.min(Swift.max(y, 0), Swift.max(railHeight - bubbleSize, 0)) + shift
        return HStack(spacing: 26) {
            ZStack {
                Text(verbatim: title)
                    .font(.system(size: bubbleSize * 0.5, weight: .bold))
                    .tracking(-0.5)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .foregroundStyle(style.ink)
                    .padding(.horizontal, bubbleSize * 0.18)
                    .id(title)
                    .transition(letterTransition)
            }
            .frame(minWidth: bubbleSize, maxWidth: bubbleSize * 2.6)
            .frame(height: bubbleSize)
            .background(style.bubble, in: .rect(cornerRadius: 18, style: .continuous))
            .clipShape(.rect(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.16), radius: 18, y: 8)
            .animation(reduceMotion ? .easeOut(duration: 0.12) : .snappy(duration: 0.2), value: title)

            Color.clear.frame(width: trackWidth + 4, height: 1)
        }
        .fixedSize()
        .offset(y: clamped)
        .animation(reduceMotion ? nil : .interactiveSpring(response: 0.24, dampingFraction: 0.82), value: clamped)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var letterTransition: AnyTransition {
        if reduceMotion { return .opacity }
        return .asymmetric(
            insertion: .move(edge: movingDown ? .bottom : .top).combined(with: .opacity),
            removal: .move(edge: movingDown ? .top : .bottom).combined(with: .opacity)
        )
    }

    // MARK: Input

    private func scrub(_ live: Column, origin: CGFloat, height: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .updating($isTouching) { _, touching, _ in touching = true }
            .onChanged { value in
                let isFirst = frozen == nil || frozen?.column.count != live.count
                if isFirst { frozen = Frozen(column: live, top: origin, height: height) }
                guard let pin = frozen, let entry = model.resolve(pin.column.entry(at: value.location.y - pin.top)) else { return }
                land(on: entry, force: isFirst)
            }
    }

    /// Moves to `entry`. Scrolls and ticks only when the section changes, except on touch down, which always
    /// scrolls: the list may have moved away from the last section since.
    private func land(on entry: Int, force: Bool) {
        guard let target = model.entries[entry].target else { return }
        let previous = validActive
        if let previous, previous != entry { movingDown = entry > previous }
        let changed = previous.flatMap { model.entries[$0].target } != target
        if previous == nil {
            withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .spring(duration: 0.28, bounce: 0.28)) { active = entry }
        } else {
            active = entry
        }
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
                                .font(.subheadline.weight(.bold))
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
