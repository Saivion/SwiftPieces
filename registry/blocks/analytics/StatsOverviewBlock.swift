// swiftpieces:
// title: Stats Overview
// description: "The top section of an analytics screen: one headline metric you scrub across ranges, live tiles for the numbers beside it that roll as they change, and its own loading and retry states."
// category: analytics
// version: "1.0.0"
// minIOSVersion: "17.0"
// added: "2026-10-19"
// tags: [analytics, dashboard, chart, stats, kpi, scrub]
// registryDependencies: [ScrubChart, LiveStat, SkeletonLoader]

import SwiftUI

/// The top section of an analytics screen: one headline metric you scrub over time, and the supporting numbers beside it.
///
/// A header names the section and says when its numbers were updated. Below it a card holds the headline metric in a
/// `ScrubChart`: the figure and its change, the line you drag across or hold for a range, and the chart's own range
/// picker. The supporting numbers follow as `LiveStat` tiles, two to a row wherever a tile's label and change fit in
/// half the width, each rolling to its new value as it changes; tapping a tile opens its chart across the full width.
/// While `phase` is `.loading` the same layout stands in as `SkeletonLoader` bones, and `.failed` says what went
/// wrong, with a button to try again.
///
/// - Parameters:
///   - title: The section title. Defaults to "Overview".
///   - subtitle: A quiet line under the title from your app, such as "Updated just now". Optional.
///   - headline: The metric the chart leads with: its name, its number format and one series per range.
///   - stats: The supporting numbers, in reading order. Two share a row when both fit in half of it; otherwise a tile takes the whole row.
///   - phase: `.loaded` (the default), `.loading` while the first numbers are on their way, or `.failed` with a message.
///   - range: Optional binding to the picked range's index, to start on a range or load a range's series on demand.
///   - onRetry: Runs when the retry button of the failed state is tapped. The button shows progress until it returns.
///   - style: Text and card colors, the cards' corner radius, and the pieces' own styles. Defaults to `.standard`.
public struct StatsOverviewBlock: View {
    /// How a number reads. Each case maps to a `FormatStyle` for the chart's readout and the tiles' figures.
    public enum Format: Hashable, Sendable {
        /// Grouped digits with up to two decimals: 12,480 or 4.25.
        case number
        /// A fraction as a percentage with up to one decimal: 0.032 reads 3.2%.
        case percent
        /// An amount in an ISO 4217 currency, with that currency's decimals: $48,250.40.
        case currency(code: String)
    }

    /// One reading of the headline metric.
    public struct Point: Hashable, Sendable {
        public var date: Date
        public var value: Double

        public init(date: Date, value: Double) {
            self.date = date
            self.value = value
        }
    }

    /// The headline metric over one range, such as the last 30 days. Its label is the range's button in the picker.
    public struct Series: Identifiable, Hashable, Sendable {
        public var id: String { label }
        public var label: String
        public var points: [Point]

        public init(label: String, points: [Point]) {
            self.label = label
            self.points = points
        }
    }

    /// The metric the section leads with.
    public struct Headline: Hashable, Sendable {
        /// The metric's name, at the top of the card.
        public var label: String
        /// How its values read.
        public var format: Format
        /// One series per range, in picker order. A single series hides the picker; a series with no points shows the
        /// chart's own empty state.
        public var series: [Series]

        public init(label: String, format: Format = .number, series: [Series]) {
            self.label = label
            self.format = format
            self.series = series
        }
    }

    /// One supporting number, drawn as a tile.
    public struct Stat: Identifiable, Hashable, Sendable {
        /// Keeps a tile in place as its value changes, so the figure rolls rather than the tile being replaced.
        /// Defaults to the label.
        public var id: String
        public var label: String
        public var value: Double
        public var format: Format
        /// Fractional change shown on the tile's chip: 0.082 reads +8.2%. Optional.
        public var delta: Double?
        /// Recent values, oldest first, drawn as the tile's sparkline. Two or more make it scrubbable and let it open.
        public var history: [Double]

        public init(id: String? = nil, label: String, value: Double, format: Format = .number, delta: Double? = nil, history: [Double] = []) {
            self.id = id ?? label
            self.label = label
            self.value = value
            self.format = format
            self.delta = delta
            self.history = history
        }
    }

    /// Where the section's numbers are.
    public enum Phase: Hashable, Sendable {
        /// The numbers are on screen.
        case loaded
        /// The first numbers are on their way. The layout is drawn as bones.
        case loading
        /// Loading failed. The message shows in place of the numbers, with a retry button when `onRetry` is set.
        case failed(String)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var ownRange = 0
    /// The tile that is open, if any. One at a time: opening another closes it.
    @State private var openStat: String?
    @State private var retrying = false

    private let title: String
    private let subtitle: String?
    private let headline: Headline
    private let stats: [Stat]
    private let phase: Phase
    private let rangeBinding: Binding<Int>?
    private let onRetry: (() async -> Void)?
    private let style: Style

    public init(
        title: String = "Overview",
        subtitle: String? = nil,
        headline: Headline,
        stats: [Stat],
        phase: Phase = .loaded,
        range: Binding<Int>? = nil,
        onRetry: (() async -> Void)? = nil,
        style: Style = .standard
    ) {
        self.title = title
        self.subtitle = subtitle
        self.headline = headline
        self.stats = stats
        self.phase = phase
        self.rangeBinding = range
        self.onRetry = onRetry
        self.style = style
    }

    // MARK: Layout

    private let gap: CGFloat = 12
    private var hasPicker: Bool { headline.series.count > 1 }
    /// The chart's text stops growing at this size. Its figure and change share one line, so past it the figure
    /// would be cut short; everything else in the block keeps growing.
    private let chartTypeLimit = DynamicTypeSize.xxxLarge
    private var range: Binding<Int> { rangeBinding ?? $ownRange }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return VStack(alignment: .leading, spacing: 16) {
            header
            // One slot for the three phases, so the bones and the numbers cross in place rather than stacking.
            ZStack(alignment: .top) {
                switch phase {
                case .loaded:
                    numbers.transition(.opacity)
                case .loading:
                    bones.transition(.opacity)
                case .failed(let message):
                    failure(message).transition(.opacity)
                }
            }
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(motion.reveal, value: phase)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title2)
                .foregroundStyle(style.text)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(style.muted)
                    .contentTransition(.opacity)
                    .animation(PieceMotion(reduceMotion: reduceMotion).value, value: subtitle)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Loaded

    private var numbers: some View {
        VStack(alignment: .leading, spacing: gap) {
            card {
                Text(headline.label)
                    .font(.headline)
                    .foregroundStyle(style.text)
                    .accessibilityAddTraits(.isHeader)
                StatsOverviewChartSlot(hasPicker: hasPicker) { _, _ in chart }
                    .dynamicTypeSize(...chartTypeLimit)
            }
            if !stats.isEmpty {
                StatsOverviewGrid(spacing: gap, twoUp: !dynamicTypeSize.isAccessibilitySize) {
                    ForEach(stats) { stat in
                        tile(stat)
                            .layoutValue(key: StatsOverviewWide.self, value: openStat == stat.id)
                    }
                    ForEach(stats) { stat in probe(stat) }
                }
            }
        }
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(style.card, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
    }

    /// The headline chart, with the block's format mapped to a concrete format style.
    @ViewBuilder private var chart: some View {
        switch headline.format {
        case .number: scrubChart(FloatingPointFormatStyle<Double>().precision(.fractionLength(0...2)))
        case .percent: scrubChart(FloatingPointFormatStyle<Double>.Percent().precision(.fractionLength(0...1)))
        case .currency(let code): scrubChart(FloatingPointFormatStyle<Double>.Currency(code: code))
        }
    }

    private func scrubChart<F: FormatStyle>(_ format: F) -> some View where F.FormatInput == Double, F.FormatOutput == String {
        ScrubChart(
            series: headline.series.map { series in
                ScrubChart<F>.Series(label: series.label, points: series.points.map { .init(date: $0.date, value: $0.value) })
            },
            format: format,
            range: range,
            style: style.chart
        )
        // The chart reads as one element, picker included, so its ranges are offered here as actions.
        .accessibilityActions {
            ForEach(Array(headline.series.enumerated()), id: \.offset) { index, series in
                if index != range.wrappedValue {
                    Button("Show \(series.label)") { range.wrappedValue = index }
                }
            }
        }
    }

    /// A tile, with the block's format mapped to a concrete format style. An open tile takes a row of its own.
    @ViewBuilder private func tile(_ stat: Stat) -> some View {
        let open = Binding(
            get: { openStat == stat.id },
            set: { isOpen in
                if isOpen { openStat = stat.id } else if openStat == stat.id { openStat = nil }
            }
        )
        switch stat.format {
        case .number:
            LiveStat(label: stat.label, value: stat.value, format: FloatingPointFormatStyle<Double>().precision(.fractionLength(0...2)), delta: stat.delta, series: stat.history, expanded: open, style: style.stat)
        case .percent:
            // In percentage points: the tile rounds each rolling frame to the decimals its target shows, so a fraction
            // such as 0.032 would round to 0 on the way.
            LiveStat(label: stat.label, value: stat.value * 100, format: StatsOverviewPoints(), delta: stat.delta, series: stat.history.map { $0 * 100 }, expanded: open, style: style.stat)
        case .currency(let code):
            LiveStat(label: stat.label, value: stat.value, format: FloatingPointFormatStyle<Double>.Currency(code: code), delta: stat.delta, series: stat.history, expanded: open, style: style.stat)
        }
    }

    /// What a tile needs across to keep its label and chip on one line: the tile itself with a one-digit figure and no
    /// line, measured by the grid and never drawn. A tile that needs more than half the row takes the whole row.
    private func probe(_ stat: Stat) -> some View {
        LiveStat(label: stat.label, value: 0, delta: stat.delta, style: style.stat)
            .hidden()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .layoutValue(key: StatsOverviewProbe.self, value: true)
    }

    // MARK: Loading

    /// The loaded layout in bones: the card at its loaded height, and a tile shell for each tile to come.
    private var bones: some View {
        VStack(alignment: .leading, spacing: gap) {
            card {
                bone(.capsule).frame(width: 148, height: 14).padding(.vertical, 4)
                StatsOverviewChartSlot(hasPicker: hasPicker) { readout, picker in
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 12) {
                            bone(.capsule).frame(width: 96, height: 10)
                            bone(.rounded(10)).frame(width: 200, height: 38)
                        }
                        .padding(.top, 2)
                        .frame(height: readout, alignment: .topLeading)
                        bone(.rounded(14)).frame(maxHeight: .infinity)
                        if hasPicker {
                            // The picker's joined segments.
                            HStack(spacing: 4) {
                                ForEach(headline.series.indices, id: \.self) { _ in
                                    bone(.capsule).frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: picker)
                        }
                    }
                }
                .dynamicTypeSize(...chartTypeLimit)
            }
            StatsOverviewGrid(spacing: gap, twoUp: !dynamicTypeSize.isAccessibilitySize) {
                ForEach(0..<(stats.isEmpty ? 2 : stats.count), id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            bone(.capsule).frame(width: 64, height: 10)
                            Spacer(minLength: 8)
                            bone(.capsule).frame(width: 48, height: 24)
                        }
                        .frame(height: 28)
                        bone(.rounded(8)).frame(width: 92, height: 30)
                        bone(.rounded(8)).frame(height: 40)
                    }
                    .padding(18)
                    .background(style.card, in: .rect(cornerRadius: 20, style: .continuous))
                }
                // Laid out as the tiles will be, when their labels are known.
                ForEach(stats) { stat in probe(stat) }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading \(title)")
    }

    private func bone(_ shape: SkeletonLoader.Kind) -> some View {
        SkeletonLoader(shape: shape, style: style.bones)
    }

    // MARK: Failed

    private func failure(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(style.muted)
                .accessibilityHidden(true)
            Text(message)
                .font(.body)
                .foregroundStyle(style.text)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let onRetry { retryButton(onRetry) }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
        .background(style.card, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    /// A glass capsule: the arrow turns to progress while your retry runs, and the button holds still until it returns.
    private func retryButton(_ retry: @escaping () async -> Void) -> some View {
        PieceLiquidGroup {
            Button {
                guard !retrying else { return }
                retrying = true
                Task {
                    await retry()
                    retrying = false
                }
            } label: {
                HStack(spacing: 8) {
                    ZStack {
                        if retrying {
                            ProgressView().controlSize(.small).tint(style.text)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .frame(width: 20, height: 20)
                    .transition(PieceMotion(reduceMotion: reduceMotion).swap)
                    Text("Try again")
                }
                .font(.body)
                .foregroundStyle(style.text)
                .padding(.horizontal, 20)
                .frame(minHeight: 44)
                .contentShape(Capsule())
                .pieceLiquid(Capsule(), interactive: false)
            }
            .buttonStyle(PieceLiquidPressStyle())
            .disabled(retrying)
            .animation(PieceMotion(reduceMotion: reduceMotion).snap, value: retrying)
        }
        .accessibilityLabel(retrying ? "Trying again" : "Try again")
    }

    /// Colors and shape, built from the Free house palette, with the styles the block hands its pieces.
    public struct Style: Sendable {
        /// The section title, the headline's name, and the failed state's message.
        public var text: Color
        /// The subtitle and the failed state's symbol.
        public var muted: Color
        /// The plain surface of the headline card, the failed card and the loading shells. Keep `chart.ground` the same
        /// color: the chart rings its dots in it.
        public var card: Color
        /// Corner radius of the headline card and the failed card. The tiles keep their own.
        public var cornerRadius: CGFloat
        /// The headline chart's style. The standard one sets its figure at 40 points, leaving room for its change beside it.
        public var chart: ScrubChartStyle
        /// The tiles' style. The standard one sets their figures at 30 points, sized for a half-width tile.
        public var stat: LiveStatStyle
        /// The loading bones' style.
        public var bones: SkeletonLoader.Style

        public init(text: Color, muted: Color, card: Color, cornerRadius: CGFloat = 28, chart: ScrubChartStyle = .standard, stat: LiveStatStyle = .standard, bones: SkeletonLoader.Style = .standard) {
            self.text = text
            self.muted = muted
            self.card = card
            self.cornerRadius = cornerRadius
            self.chart = chart
            self.stat = stat
            self.bones = bones
        }

        /// House text on white or charcoal cards, the chart's butter accent, glass tiles. Copy it and change one property to customize.
        public static let standard: Style = {
            var chart = ScrubChartStyle.standard
            chart.numeralSize = 40
            var stat = LiveStatStyle.standard
            stat.numeralSize = 30
            return Style(
                text: adaptive(0x141414, 0xF4F3EF),
                muted: adaptive(0x5C5A56, 0xA6A49F),
                card: adaptive(0xFFFFFF, 0x1C1C1C),
                chart: chart,
                stat: stat
            )
        }()

        fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

// MARK: - Chart slot

/// The headline chart's height: room for its readout (date line and figure) and its range picker, both scaled with
/// their text, around a plot that never shrinks. Content gets the readout's and the picker's room, for the bones.
private struct StatsOverviewChartSlot<Content: View>: View {
    var hasPicker: Bool
    @ViewBuilder var content: (_ readout: CGFloat, _ picker: CGFloat) -> Content
    @ScaledMetric(relativeTo: .largeTitle) private var readout: CGFloat = 70
    @ScaledMetric(relativeTo: .subheadline) private var picker: CGFloat = 44
    /// The plot and its date axis.
    private let plot: CGFloat = 132

    var body: some View {
        content(readout, picker)
            .frame(height: readout + 14 + plot + (hasPicker ? 14 + picker : 0), alignment: .top)
    }
}

// MARK: - Grid

nonisolated private struct StatsOverviewWide: LayoutValueKey {
    /// An open tile takes a row of its own.
    static let defaultValue = false
}

nonisolated private struct StatsOverviewProbe: LayoutValueKey {
    /// A hidden copy of a tile that the grid measures, in the same order as the tiles.
    static let defaultValue = false
}

/// Tiles two to a row, each at the top of its half, when both fit: below the accessibility text sizes, and when each
/// tile's label and chip fit on one line in half the row (read from its probe). Otherwise a tile takes the whole row,
/// as does an open tile and a tile left without a partner. Nothing is ever squeezed, truncated or wrapped to fit.
private struct StatsOverviewGrid: Layout {
    var spacing: CGFloat
    var twoUp: Bool

    /// The width each tile needs, by tile order. A tile without a probe (a loading shell) fits anywhere.
    func makeCache(subviews: Subviews) -> [CGFloat] {
        subviews.filter { $0[StatsOverviewProbe.self] }.map { $0.sizeThatFits(.unspecified).width }
    }

    func updateCache(_ cache: inout [CGFloat], subviews: Subviews) {
        cache = makeCache(subviews: subviews)
    }

    private func tiles(_ subviews: Subviews) -> [LayoutSubview] {
        subviews.filter { !$0[StatsOverviewProbe.self] }
    }

    private func rows(_ tiles: [LayoutSubview], width: CGFloat, needs: [CGFloat]) -> [[Int]] {
        let half = (width - spacing) / 2
        var rows: [[Int]] = []
        var waiting: Int?
        for index in tiles.indices {
            let alone = !twoUp || tiles[index][StatsOverviewWide.self] || (index < needs.count && needs[index] > half + 0.5)
            if alone {
                if let left = waiting { rows.append([left]) }
                waiting = nil
                rows.append([index])
            } else if let left = waiting {
                rows.append([left, index])
                waiting = nil
            } else {
                waiting = index
            }
        }
        if let left = waiting { rows.append([left]) }
        return rows
    }

    private func columnWidth(_ row: [Int], in width: CGFloat) -> CGFloat {
        row.count > 1 ? (width - spacing) / 2 : width
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout [CGFloat]) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? 350
        let tiles = tiles(subviews)
        var height: CGFloat = 0
        for (number, row) in rows(tiles, width: width, needs: cache).enumerated() {
            let column = columnWidth(row, in: width)
            height += row.map { tiles[$0].sizeThatFits(ProposedViewSize(width: column, height: nil)).height }.max() ?? 0
            if number > 0 { height += spacing }
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout [CGFloat]) {
        for probe in subviews where probe[StatsOverviewProbe.self] {
            probe.place(at: bounds.origin, anchor: .topLeading, proposal: .unspecified)
        }
        let tiles = tiles(subviews)
        var y = bounds.minY
        for row in rows(tiles, width: bounds.width, needs: cache) {
            let column = columnWidth(row, in: bounds.width)
            var x = bounds.minX
            var tallest: CGFloat = 0
            for index in row {
                let height = tiles[index].sizeThatFits(ProposedViewSize(width: column, height: nil)).height
                tiles[index].place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: column, height: height))
                x += column + spacing
                tallest = max(tallest, height)
            }
            y += tallest + spacing
        }
    }
}

/// A tile's percent, fed in percentage points (3.2 reads 3.2%). See `tile(_:)`.
nonisolated private struct StatsOverviewPoints: FormatStyle {
    func format(_ value: Double) -> String {
        (value / 100).formatted(.percent.precision(.fractionLength(0...1)))
    }
}

// MARK: - Example

#Preview("Usage") {
    ScrollView {
        StatsOverviewBlock(
            subtitle: "Updated just now",
            headline: .init(label: "Recurring revenue", format: .currency(code: "USD"), series: Metrics.revenue),
            stats: [
                .init(label: "Visitors", value: 12_480, delta: 0.08, history: Metrics.visitors),
                .init(label: "Trials", value: 412, delta: 0.12, history: Metrics.trials),
                .init(label: "Conversion", value: 0.033, format: .percent, delta: 0.036, history: Metrics.conversion),
            ]
        )
        .padding(20)
    }
}

#Preview("Example") {
    StatsOverviewBlockExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    StatsOverviewBlockExample().preferredColorScheme(.dark)
}

#Preview("Failed") {
    StatsOverviewBlockExample(failsFirst: true)
}

/// A dashboard's opening section: the first load, then visitors ticking up live. With `failsFirst`, the first load
/// fails and the retry succeeds after a moment.
private struct StatsOverviewBlockExample: View {
    var failsFirst = false
    @State private var phase: StatsOverviewBlock.Phase = .loading
    @State private var range = 1
    @State private var visitors: Double = 12_480
    @State private var updated = "Updating…"

    var body: some View {
        ScrollView {
            StatsOverviewBlock(
                subtitle: updated,
                headline: .init(label: "Recurring revenue", format: .currency(code: "USD"), series: Metrics.revenue),
                stats: [
                    .init(label: "Visitors", value: visitors, delta: 0.08, history: Array(Metrics.visitors.dropLast()) + [visitors]),
                    .init(label: "Trials", value: 412, delta: 0.12, history: Metrics.trials),
                    .init(label: "Conversion", value: 0.033, format: .percent, delta: 0.036, history: Metrics.conversion),
                ],
                phase: phase,
                range: $range,
                onRetry: load
            )
            .padding(20)
        }
        .background(StatsOverviewBlock.Style.adaptive(0xF3F2EE, 0x121212))
        .task {
            if failsFirst {
                try? await Task.sleep(for: .seconds(1.2))
                phase = .failed("Couldn't load your numbers. Check your connection and try again.")
                updated = "Not updated"
                return
            }
            await load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                visitors += Double(Int.random(in: 8...40))
            }
        }
    }

    private func load() async {
        try? await Task.sleep(for: .seconds(1.2))
        phase = .loaded
        updated = "Updated just now"
    }
}

/// Sample numbers for a subscription app: a 90-day series of recurring revenue (the 30- and 7-day ranges are its last
/// days), and the recent history of the visitors, trials and conversion from one to the other.
private enum Metrics {
    static let now = Date(timeIntervalSince1970: 1_792_411_200)

    static let daily: [Double] = (0..<90).map { day in
        func wiggle(_ i: Double) -> Double { 187 * sin(0.9 * i + 0.4) + 260 * sin(0.31 * i + 1.1) + 150 * sin(0.093 * i + 2) }
        func bump(_ i: Double, _ at: Double, _ height: Double, _ width: Double) -> Double { height * exp(-pow((i - at) / width, 2)) }
        func events(_ i: Double) -> Double { bump(i, 14, -900, 5) + bump(i, 67, -700, 3.2) + bump(i, 82.6, -350, 0.8) + bump(i, 84, 380, 1.2) + bump(i, 86.8, -420, 1) }
        let i = Double(day), t = i / 89
        let trend = 39_880 + (48_250.40 - 39_880) * (0.7 * t + 0.3 * t * t)
        // The ups and downs, pinned to zero at both ends so the series starts and ends on the trend.
        let swing = wiggle(i) - wiggle(89) * t - wiggle(0) * (1 - t) + events(i) - events(89) * t - events(0) * (1 - t)
        return ((trend + swing) * 100).rounded() / 100
    }

    static func last(_ days: Int, _ label: String) -> StatsOverviewBlock.Series {
        .init(label: label, points: daily.suffix(days).enumerated().map { offset, value in
            .init(date: now.addingTimeInterval(-86_400 * Double(days - 1 - offset)), value: value)
        })
    }

    static let revenue = [last(7, "7D"), last(30, "30D"), last(90, "90D")]
    static let visitors: [Double] = [9_820, 10_410, 10_120, 10_960, 11_340, 11_020, 11_610, 12_140, 11_790, 12_230, 12_010, 12_480]
    static let trials: [Double] = [301, 322, 318, 340, 356, 349, 371, 388, 380, 397, 404, 412]
    static let conversion: [Double] = [0.0281, 0.0290, 0.0286, 0.0298, 0.0305, 0.0301, 0.0312, 0.0318, 0.0315, 0.0326, 0.0322, 0.0330]
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid, liquidPress)

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

// swiftpieces-liquid: end
