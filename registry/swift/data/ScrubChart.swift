// swiftpieces:
// title: Scrub Chart
// description: A line or bar chart component with a light display-scale readout and dimmed decimals, a solid delta block, a flag that rides the scrub rule, hold-and-drag range selection with delta and percent, and a block range picker that morphs the line between datasets.
// category: data
// version: "2.0.0"
// pro: dashboard-screen
// minIOSVersion: "17.0"
// tags: [chart, line, bars, scrub, range, morph, numbers]

import SwiftUI
import Charts

/// Time-series chart with scrubbing, range selection, and a morphing range picker.
///
/// - Parameters:
///   - series: One dataset per range button, in display order. A single entry hides the picker.
///   - mode: `.line` draws a smoothed line with min and max markers; `.bars` draws one bar per point.
///   - tint: Line and bar color. Defaults to the style's `line`, the house text color.
///   - format: Number format for readouts, for example `.number` or `.currency(code: "USD")`. Defaults to `.number`.
///   - range: Optional binding to the selected series index, for driving the picker from outside.
///   - style: Accent, delta, band, and numeral settings. Defaults to `.standard`: a butter accent, sage for up, tangerine for down.
public struct ScrubChart<Format: FormatStyle>: View where Format.FormatInput == Double, Format.FormatOutput == String {
    /// Colors and type for the chart. See `ScrubChartStyle`.
    public typealias Style = ScrubChartStyle

    public enum Mode: Sendable { case line, bars }

    public struct Point: Hashable, Sendable {
        public let date: Date
        public let value: Double
        public init(date: Date, value: Double) {
            self.date = date
            self.value = value
        }
    }

    public struct Series: Identifiable, Sendable {
        public var id: String { label }
        public let label: String
        public let points: [Point]
        public init(label: String, points: [Point]) {
            self.label = label
            self.points = points.sorted { $0.date < $1.date }
        }
    }

    private enum Selection: Equatable { case idle, scrubbing(Int), range(Int, Int) }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var numeralScale: CGFloat = 1
    @Namespace private var pickerSpace
    @State private var internalRange = 0
    @State private var selection: Selection = .idle
    @State private var normalized: [Double] = []
    @State private var plotWidth: CGFloat = 1
    @State private var dragStart: CGPoint?
    @State private var anchorIndex = 0
    @State private var moved = false
    @State private var holdTask: Task<Void, Never>?

    private let series: [Series]
    private let mode: Mode
    private let tint: Color
    private let format: Format
    private let rangeBinding: Binding<Int>?
    private let style: Style
    private let sampleCount = 64

    public init(series: [Series], mode: Mode = .line, tint: Color? = nil, format: Format, range: Binding<Int>? = nil, style: Style = .standard) {
        self.series = series
        self.mode = mode
        self.tint = tint ?? style.line
        self.format = format
        self.rangeBinding = range
        self.style = style
    }

    public init(series: [Series], mode: Mode = .line, tint: Color? = nil, range: Binding<Int>? = nil, style: Style = .standard) where Format == FloatingPointFormatStyle<Double> {
        self.init(series: series, mode: mode, tint: tint, format: .number.precision(.fractionLength(0...2)), range: range, style: style)
    }

    // MARK: Derived data

    private var rangeIndex: Int { min(max(rangeBinding?.wrappedValue ?? internalRange, 0), max(series.count - 1, 0)) }
    private var points: [Point] { series.isEmpty ? [] : series[rangeIndex].points }
    private var isEmpty: Bool { points.isEmpty }
    private var bounds: (lo: Double, hi: Double) {
        let values = points.map(\.value)
        let lo = values.min() ?? 0, hi = values.max() ?? 1
        return hi - lo < .ulpOfOne ? (lo - 1, hi + 1) : (lo, hi)
    }
    private func norm(_ value: Double) -> Double { (value - bounds.lo) / (bounds.hi - bounds.lo) }
    private func fraction(_ index: Int) -> Double {
        guard let first = points.first, let last = points.last, last.date > first.date else { return 0 }
        return points[index].date.timeIntervalSince(first.date) / last.date.timeIntervalSince(first.date)
    }
    /// Chart x for a real point: sample position in line mode, bar index in bars mode.
    private func chartX(_ index: Int) -> Double { mode == .line ? fraction(index) * Double(sampleCount - 1) : Double(index) }
    private var xDomain: ClosedRange<Double> {
        mode == .line ? 0...Double(sampleCount - 1) : -0.5...(Double(max(points.count, 1)) - 0.5)
    }
    private var activeIndex: Int? {
        switch selection {
        case .idle: nil
        case .scrubbing(let i): i
        case .range(_, let i): i
        }
    }
    private var rangeSpan: (from: Int, to: Int)? {
        if case .range(let a, let b) = selection { return (min(a, b), max(a, b)) }
        return nil
    }

    // MARK: Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            readout
            chart
            if series.count > 1 { picker }
        }
        .sensoryFeedback(.selection, trigger: activeIndex)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: rangeSpan != nil) { _, new in new }
        .sensoryFeedback(.selection, trigger: rangeIndex)
        .task(id: rangeIndex) { morph() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Chart, \(series.isEmpty ? "" : series[rangeIndex].label)")
        .accessibilityValue(accessibilitySummary)
        .accessibilityAdjustableAction { direction in
            guard !isEmpty else { return }
            let current = activeIndex ?? points.count - 1
            let next = direction == .increment ? min(current + 1, points.count - 1) : max(current - 1, 0)
            selection = .scrubbing(next)
        }
    }

    private var chart: some View {
        Chart {
            if mode == .line {
                ForEach(Array(normalized.enumerated()), id: \.offset) { index, y in
                    LineMark(x: .value("Position", Double(index)), y: .value("Value", y))
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                        .foregroundStyle(tint)
                }
                if !isEmpty, selection == .idle, let maxIndex = extremeIndex(max: true), let minIndex = extremeIndex(max: false) {
                    PointMark(x: .value("Position", chartX(maxIndex)), y: .value("Value", norm(points[maxIndex].value)))
                        .symbolSize(0)
                        .annotation(position: .top, spacing: 6) { marker(points[maxIndex].value) }
                    PointMark(x: .value("Position", chartX(minIndex)), y: .value("Value", norm(points[minIndex].value)))
                        .symbolSize(0)
                        .annotation(position: .bottom, spacing: 6) { marker(points[minIndex].value) }
                }
            } else {
                ForEach(Array(normalized.enumerated()), id: \.offset) { index, y in
                    BarMark(x: .value("Position", Double(index)), yStart: .value("Floor", -0.1), yEnd: .value("Value", y), width: .fixed(barWidth))
                        .clipShape(.rect(cornerRadius: min(6, barWidth / 2), style: .continuous))
                        .foregroundStyle(barHighlighted(index) ? style.accent : tint)
                        .opacity(barOpacity(index))
                }
            }
            if let first = points.first {
                RuleMark(y: .value("Baseline", norm(first.value)))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 5]))
                    .foregroundStyle(style.muted.opacity(0.6))
            } else {
                RuleMark(y: .value("Baseline", 0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 5]))
                    .foregroundStyle(style.muted.opacity(0.6))
            }
            if let span = rangeSpan, mode == .line {
                RectangleMark(xStart: .value("From", chartX(span.from)), xEnd: .value("To", chartX(span.to)))
                    .foregroundStyle(style.band)
                    .zIndex(-1)
                RuleMark(x: .value("From", chartX(span.from)))
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .foregroundStyle(tint)
            }
            if !isEmpty, mode == .line, activeIndex == nil {
                // At rest the latest value wears the accent: a block dot ringed in the ground.
                PointMark(x: .value("Latest", chartX(points.count - 1)), y: .value("Value", norm(points[points.count - 1].value)))
                    .symbol { dot }
            }
            if let index = activeIndex, !isEmpty {
                RuleMark(x: .value("Scrub", chartX(index)))
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .foregroundStyle(tint)
                if mode == .line {
                    PointMark(x: .value("Scrub", chartX(index)), y: .value("Value", norm(points[index].value)))
                        .symbol { dot }
                }
            }
        }
        .chartXScale(domain: xDomain)
        .chartYScale(domain: -0.16...1.3)
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: axisValues) { value in
                // The outer labels hug the plot edges so none is dropped for overflowing.
                AxisValueLabel(anchor: value.index == 0 ? .topLeading : value.index == value.count - 1 ? .topTrailing : .top) {
                    if let x = value.as(Double.self) {
                        Text(axisLabel(atChartX: x).uppercased())
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(style.muted)
                    }
                }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                let plot = proxy.plotFrame.map { geometry[$0] } ?? .zero
                Rectangle()
                    .fill(.clear)
                    .contentShape(Rectangle())
                    .gesture(scrubGesture(proxy: proxy, plot: plot))
                    .onAppear { plotWidth = plot.width }
                    .onChange(of: plot.width) { _, new in plotWidth = new }
                if let index = activeIndex, !isEmpty, let x = proxy.position(forX: chartX(index)) {
                    // A flag rides the top of the rule with the point's date.
                    let flagX = min(max(plot.minX + x, plot.minX + 44), plot.maxX - 44)
                    Text(dateLabel(points[index].date, precise: true))
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(style.ground)
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(tint, in: Capsule())
                        .position(x: flagX, y: plot.minY + 10)
                        .animation(.interactiveSpring(duration: 0.12), value: flagX)
                        .transition(.opacity)
                }
                if isEmpty {
                    Text("No data yet")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.muted)
                        .position(x: plot.midX, y: plot.midY - 14)
                }
            }
        }
        .animation(.snappy(duration: 0.2), value: selection)
    }

    private var dot: some View {
        Circle()
            .fill(style.accent)
            .overlay { Circle().strokeBorder(style.ground, lineWidth: 3) }
            .frame(width: 16, height: 16)
    }

    private func marker(_ value: Double) -> some View {
        Text(value, format: format)
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .foregroundStyle(style.muted)
            .transition(.opacity)
    }

    // MARK: Readout

    private var readout: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(metaLine.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(style.muted)
                .lineLimit(1)
                .contentTransition(.opacity)
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                numeral
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .layoutPriority(1)
                if let chip = chipValues {
                    deltaChip(delta: chip.delta, percent: chip.percent, showsAmount: rangeSpan == nil)
                        .transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity))
                }
                Spacer(minLength: 0)
            }
        }
        .monospacedDigit()
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.snappy(duration: 0.25), value: rangeSpan == nil)
    }

    private var metaLine: String {
        guard !isEmpty else { return series.isEmpty ? "" : series[rangeIndex].label }
        if let span = rangeSpan { return "\(dateLabel(points[span.from].date)) – \(dateLabel(points[span.to].date))" }
        if case .scrubbing(let index) = selection { return dateLabel(points[index].date, precise: true) }
        return "Latest · \(series[rangeIndex].label)"
    }

    /// The big figure: the active value, or the signed change while a range is held. Decimals are dimmed.
    private var numeral: some View {
        let value: Double
        var signed = false
        if isEmpty {
            return AnyView(Text("—").font(.system(size: style.numeralSize * numeralScale, weight: .light)).foregroundStyle(style.muted))
        } else if let span = rangeSpan {
            value = points[span.to].value - points[span.from].value
            signed = true
        } else if let index = activeIndex {
            value = points[index].value
        } else {
            value = points[points.count - 1].value
        }
        let body = (signed ? (value < 0 ? "−" : "+") : "") + format.format(signed ? abs(value) : value)
        let parts = Self.splitDecimals(body)
        return AnyView(
            Text("\(Text(parts.whole))\(Text(parts.fraction).foregroundStyle(style.muted))")
                .font(.system(size: style.numeralSize * numeralScale, weight: .light))
                .tracking(-style.numeralSize * 0.02)
                .contentTransition(.numericText(value: value))
        )
    }

    private var chipValues: (delta: Double, percent: Double)? {
        guard let first = points.first, let last = points.last else { return nil }
        let from: Double, to: Double
        if let span = rangeSpan { (from, to) = (points[span.from].value, points[span.to].value) }
        else if let index = activeIndex { (from, to) = (first.value, points[index].value) }
        else { (from, to) = (first.value, last.value) }
        return (to - from, from == 0 ? 0 : (to - from) / abs(from))
    }

    /// Up and down arrive as solid blocks with ink, never as colored text.
    private func deltaChip(delta: Double, percent: Double, showsAmount: Bool) -> some View {
        let fill = delta > 0 ? style.up : delta < 0 ? style.down : style.band
        return HStack(spacing: 4) {
            Image(systemName: delta >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 11, weight: .heavy))
            if showsAmount {
                Text((delta < 0 ? "−" : "+") + format.format(abs(delta)))
                    .contentTransition(.numericText(value: delta))
            }
            Text(abs(percent), format: .percent.precision(.fractionLength(1)))
                .contentTransition(.numericText(value: percent))
        }
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(delta == 0 ? style.muted : style.ink)
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(fill, in: Capsule())
    }

    /// Splits a formatted number at its decimal separator, so the fraction can be dimmed.
    private static func splitDecimals(_ text: String) -> (whole: String, fraction: String) {
        let separator = Locale.current.decimalSeparator ?? "."
        guard let range = text.range(of: separator, options: .backwards),
              let next = text[range.upperBound...].first, next.isNumber else { return (text, "") }
        return (String(text[..<range.lowerBound]), String(text[range.lowerBound...]))
    }

    // MARK: Picker

    private var picker: some View {
        HStack(spacing: 4) {
            ForEach(Array(series.enumerated()), id: \.element.id) { index, item in
                let on = index == rangeIndex
                Button {
                    withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.35, bounce: 0.2)) { setRange(index) }
                } label: {
                    Text(item.label)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(on ? style.ink : style.muted)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background {
                            if on {
                                Capsule().fill(style.accent)
                                    .matchedGeometryEffect(id: "pill", in: pickerSpace)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(4)
        .background(style.band, in: Capsule())
    }

    private func setRange(_ index: Int) {
        if let rangeBinding { rangeBinding.wrappedValue = index } else { internalRange = index }
    }

    // MARK: Gesture

    private func scrubGesture(proxy: ChartProxy, plot: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard !isEmpty else { return }
                let index = nearestIndex(x: value.location.x - plot.minX, width: plot.width)
                if dragStart == nil {
                    dragStart = value.location
                    moved = false
                    anchorIndex = index
                    holdTask?.cancel()
                    // Holding still for a moment pins the anchor and turns the drag into a range.
                    holdTask = Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        guard !Task.isCancelled, !moved else { return }
                        selection = .range(anchorIndex, anchorIndex)
                    }
                }
                if !moved, let start = dragStart, hypot(value.location.x - start.x, value.location.y - start.y) > 8 {
                    moved = true
                    holdTask?.cancel()
                }
                if case .range(let anchor, _) = selection {
                    selection = .range(anchor, index)
                } else {
                    selection = .scrubbing(index)
                }
            }
            .onEnded { _ in
                holdTask?.cancel()
                dragStart = nil
                selection = .idle
            }
    }

    private func nearestIndex(x: CGFloat, width: CGFloat) -> Int {
        let f = min(max(x / max(width, 1), 0), 1)
        if mode == .bars { return min(max(Int((f * Double(points.count) - 0.5).rounded()), 0), points.count - 1) }
        return points.indices.min { abs(fraction($0) - f) < abs(fraction($1) - f) } ?? 0
    }

    // MARK: Morph

    /// Line mode resamples every dataset to the same point count, so switching ranges bends the line instead of redrawing it.
    private func morph() {
        let target: [Double]
        if mode == .line {
            target = Self.resample(points, count: sampleCount).map(norm)
        } else {
            target = points.map { norm($0.value) }
        }
        selection = .idle
        if normalized.isEmpty || reduceMotion {
            withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : nil) { normalized = target }
        } else {
            withAnimation(.smooth(duration: 0.55)) { normalized = target }
        }
    }

    private static func resample(_ points: [Point], count: Int) -> [Double] {
        guard let first = points.first, let last = points.last else { return [] }
        guard points.count > 1, last.date > first.date else { return Array(repeating: first.value, count: count) }
        let start = first.date.timeIntervalSince1970
        let span = last.date.timeIntervalSince(first.date)
        var result: [Double] = []
        result.reserveCapacity(count)
        var j = 0
        for i in 0..<count {
            let t = start + span * Double(i) / Double(count - 1)
            while j < points.count - 2, points[j + 1].date.timeIntervalSince1970 < t { j += 1 }
            let a = points[j], b = points[j + 1]
            let segment = max(b.date.timeIntervalSince(a.date), .ulpOfOne)
            let u = min(max((t - a.date.timeIntervalSince1970) / segment, 0), 1)
            result.append(a.value + (b.value - a.value) * u)
        }
        return result
    }

    // MARK: Helpers

    private var barWidth: CGFloat { max(2, plotWidth / CGFloat(max(points.count, 1)) * 0.62) }

    private func barOpacity(_ index: Int) -> Double {
        if let span = rangeSpan { return index >= span.from && index <= span.to ? 1 : 0.35 }
        if let active = activeIndex { return active == index ? 1 : 0.35 }
        return 1
    }

    /// Bars take the accent block where the finger is, and across a held range.
    private func barHighlighted(_ index: Int) -> Bool {
        if let span = rangeSpan { return index >= span.from && index <= span.to }
        if let active = activeIndex { return active == index }
        return index == points.count - 1
    }

    private func extremeIndex(max wantMax: Bool) -> Int? {
        wantMax ? points.indices.max { points[$0].value < points[$1].value } : points.indices.min { points[$0].value < points[$1].value }
    }

    private var axisValues: [Double] {
        let lo = xDomain.lowerBound, hi = xDomain.upperBound
        return mode == .line ? [lo, (lo + hi) / 2, hi] : [0, Double(max(points.count - 1, 0)) / 2, Double(max(points.count - 1, 0))]
    }

    private func axisLabel(atChartX x: Double) -> String {
        guard let first = points.first, let last = points.last else { return "" }
        let f = mode == .line ? x / Double(sampleCount - 1) : x / Double(max(points.count - 1, 1))
        let date = first.date.addingTimeInterval(last.date.timeIntervalSince(first.date) * f)
        return dateLabel(date)
    }

    private func dateLabel(_ date: Date, precise: Bool = false) -> String {
        guard let first = points.first, let last = points.last else { return "" }
        let span = last.date.timeIntervalSince(first.date)
        if span < 2 * 86_400 { return date.formatted(precise ? .dateTime.hour().minute() : .dateTime.hour()) }
        if span < 120 * 86_400 { return date.formatted(.dateTime.month(.abbreviated).day()) }
        return date.formatted(precise ? .dateTime.month(.abbreviated).day().year() : .dateTime.month(.abbreviated).year(.twoDigits))
    }

    private var accessibilitySummary: String {
        guard let first = points.first, let last = points.last else { return "No data" }
        if let index = activeIndex {
            return "\(format.format(points[index].value)) on \(dateLabel(points[index].date, precise: true))"
        }
        let delta = last.value - first.value
        return "\(format.format(last.value)), \(delta >= 0 ? "up" : "down") \(format.format(abs(delta)))"
    }
}

/// Colors and type for `ScrubChart`, built from the Free house palette.
public struct ScrubChartStyle: Sendable {
    /// Line and bar color when no `tint` is passed.
    public var line: Color
    /// Block for the latest point, the scrub dot, the active bar, and the selected range.
    public var accent: Color
    /// Block behind a rising delta.
    public var up: Color
    /// Block behind a falling delta.
    public var down: Color
    /// Text on blocks.
    public var ink: Color
    /// Meta labels, axis labels, and dimmed decimals.
    public var muted: Color
    /// Solid step behind the picker and a held range.
    public var band: Color
    /// The surface the chart sits on; used to ring the dot and for flag text.
    public var ground: Color
    /// Readout numeral size in points; it scales with Dynamic Type.
    public var numeralSize: CGFloat

    public init(line: Color, accent: Color, up: Color, down: Color, ink: Color, muted: Color, band: Color, ground: Color, numeralSize: CGFloat = 44) {
        self.line = line
        self.accent = accent
        self.up = up
        self.down = down
        self.ink = ink
        self.muted = muted
        self.band = band
        self.ground = ground
        self.numeralSize = numeralSize
    }

    /// House text line on a white or charcoal card, butter accent, sage up, tangerine down. Copy it and change one property to customize.
    public static let standard = ScrubChartStyle(
        line: adaptive(0x141414, 0xF4F3EF),
        accent: adaptive(0xFFD976, 0xFFD976),
        up: adaptive(0xA9DCB7, 0xA9DCB7),
        down: adaptive(0xFF5B3A, 0xFF5B3A),
        ink: adaptive(0x141414, 0x141414),
        muted: adaptive(0x5C5A56, 0xA6A49F),
        band: adaptive(0xF3F2EE, 0x262626),
        ground: adaptive(0xFFFFFF, 0x1C1C1C)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct ScrubChartExample: View {
    @State private var range = 1
    private let now = Date(timeIntervalSince1970: 1_789_560_000)

    private func series(_ label: String, step: TimeInterval, values: [Double]) -> ScrubChart<FloatingPointFormatStyle<Double>.Currency>.Series {
        .init(label: label, points: values.enumerated().map {
            .init(date: now.addingTimeInterval(-step * Double(values.count - 1 - $0.offset)), value: $0.element)
        })
    }

    var body: some View {
        ScrubChart(
            series: [
                series("1D", step: 1_800, values: [182.1, 182.6, 181.9, 183.4, 184.0, 183.2, 184.8, 185.3, 184.9, 186.1, 185.7, 186.4, 187.0]),
                series("1W", step: 21_600, values: [176.3, 177.8, 179.1, 178.2, 180.4, 181.0, 179.7, 182.5, 183.9, 182.8, 184.6, 186.1, 185.4, 187.0]),
                series("1M", step: 86_400, values: [191.2, 189.4, 188.0, 186.7, 184.1, 185.9, 183.3, 181.8, 180.2, 182.6, 179.5, 178.1, 180.9, 182.4, 184.7, 187.0]),
                series("1Y", step: 86_400 * 24, values: [142.0, 150.3, 147.8, 158.2, 163.9, 160.1, 171.4, 176.0, 168.3, 179.9, 183.5, 187.0]),
            ],
            format: .currency(code: "USD"),
            range: $range
        )
        .frame(height: 340)
        .padding(20)
        // The chart's style rings its dot in `ground`, so it sits on that surface.
        .background(ScrubChartStyle.standard.ground, in: .rect(cornerRadius: 34, style: .continuous))
        .padding(16)
        .frame(maxHeight: .infinity)
        .background(ScrubChartStyle.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    ScrubChartExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    ScrubChartExample().preferredColorScheme(.dark)
}
