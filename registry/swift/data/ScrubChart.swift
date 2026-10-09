// swiftpieces:
// title: Scrub Chart
// description: "A liquid glass line or bar chart: a semibold readout with dimmed decimals beside a tinted glass delta chip, a glass flag that rides the scrub rule with the range's change budding out of it and resting joined while a range is held, hold-and-drag range selection, and a range picker of joined glass segments whose tint flows into the one you pick as it swells, morphing the line between datasets."
// category: data
// version: "2.2.0"
// pro: dashboard-screen
// minIOSVersion: "17.0"
// tags: [chart, line, bars, scrub, range, morph, numbers]

import SwiftUI
import Charts

/// Time-series chart with scrubbing, range selection, and a morphing range picker.
///
/// The chart is content; its chrome is liquid glass. A glass flag rides the scrub rule, and while a range is held the
/// range's change buds out of the flag and rests joined to it. The range picker is a row of glass segments joined by
/// liquid necks: the one you pick swells and takes the accent tint, which flows to it through the necks.
///
/// - Parameters:
///   - series: One dataset per range button, in display order. A single entry hides the picker.
///   - mode: `.line` draws a smoothed line with min and max markers; `.bars` draws one bar per point.
///   - tint: Line and bar color. Defaults to the style's `line`, the house text color.
///   - format: Number format for readouts, for example `.number` or `.currency(code: "USD")`. Defaults to `.number`.
///   - range: Optional binding to the selected series index, for driving the picker from outside.
///   - style: Accent, delta, band, and numeral settings. Defaults to `.standard`: a butter accent, sage for up, red for down.
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
    /// What the finger is doing, without where. Only a change of phase animates.
    private enum Phase: Equatable { case idle, scrubbing, range }
    /// A range's min and max points, which place the min and max labels.
    private struct Extremes: Equatable {
        let range: Int
        let low: Point
        let high: Point
    }
    /// What the chart plots: a change of range or of its data morphs the line.
    private struct Plotted: Equatable {
        let range: Int
        let points: [Point]
    }
    /// A held range's change, kept while its bubble melts back into the flag after the range has ended.
    private struct RangeChange: Equatable {
        var delta: Double = 0
        var percent: Double = 0
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var numeralScale: CGFloat = 1
    @State private var internalRange = 0
    @State private var selection: Selection = .idle
    @State private var normalized: [Double] = []
    /// The extremes the line last landed on. The min and max labels show only while they are still the current ones.
    @State private var landed: Extremes?
    @State private var morphTick = 0
    @State private var pinTick = 0
    @State private var plotWidth: CGFloat = 1
    @State private var dragStart: CGPoint?
    @State private var moved = false
    @State private var holdTask: Task<Void, Never>?
    @GestureState private var touching = false  // resets when the system cancels a touch, which skips onEnded
    /// The range's change bubble: out of the flag while a range is held, melted back in when it ends.
    @State private var buds = PieceBuds()
    @State private var heldChange = RangeChange()
    /// The side of the flag the bubble rests on, picked when it buds: toward the middle of the plot, where there is room.
    @State private var bubbleSide: CGFloat = 1
    @State private var flagWidth: CGFloat = 0
    @State private var bubbleWidth: CGFloat = 0
    @State private var pickerWidth: CGFloat = 0

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
    private var bounds: (lo: Double, hi: Double) { Self.bounds(of: points) }
    private static func bounds(of points: [Point]) -> (lo: Double, hi: Double) {
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
    /// New data can shorten the series under a resting finger. Until the next move, an index past the end reads as
    /// the last point.
    private func onPoints(_ index: Int) -> Int { min(max(index, 0), max(points.count - 1, 0)) }
    private var activeIndex: Int? {
        switch selection {
        case .idle: nil
        case .scrubbing(let i): onPoints(i)
        case .range(_, let i): onPoints(i)
        }
    }
    private var rangeSpan: (from: Int, to: Int)? {
        if case .range(let a, let b) = selection { return (onPoints(min(a, b)), onPoints(max(a, b))) }
        return nil
    }
    private var extremes: Extremes? {
        guard let high = extremeIndex(max: true), let low = extremeIndex(max: false) else { return nil }
        return Extremes(range: rangeIndex, low: points[low], high: points[high])
    }
    private var phase: Phase {
        switch selection {
        case .idle: .idle
        case .scrubbing: .scrubbing
        case .range: .range
        }
    }
    /// Touching down and pinning a range snap in; letting go clears firmly. Moving between points never animates,
    /// so the rule, the dot, the flag and the readout sit on the finger's point at every frame.
    private var phaseAnimation: Animation {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return phase == .idle ? motion.dismiss : motion.snap
    }

    // MARK: Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            readout
            chart
            if series.count > 1 { picker }
        }
        .fontWeight(.semibold)
        // One haptic per event: a tick for each point reached (never for a release or a reset), a rigid tap when a
        // hold pins the anchor, and a tick for each range switch.
        .sensoryFeedback(.selection, trigger: activeIndex) { _, new in new != nil }
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: pinTick)
        .sensoryFeedback(.selection, trigger: rangeIndex)
        .onAppear { morph() }
        // A new range ends any scrub, since its points are other points. New data in the same range keeps it, so a
        // live chart can be scrubbed through a refresh.
        .onChange(of: rangeIndex) {
            holdTask?.cancel()
            selection = .idle
        }
        // In the same frame as the new data, so nothing is drawn from one dataset over the shape of another. Keyed on
        // the range too, so a range whose points equal the last one's still lands and brings its labels back.
        .onChange(of: Plotted(range: rangeIndex, points: points)) { morph() }
        // A touch the system cancelled (a scroll took over, an alert) never ran onEnded, so let go here: no cursor
        // left behind, no hold pinning a range after the finger is gone. After a normal lift this does nothing new.
        .onChange(of: touching) { _, isTouching in
            guard !isTouching else { return }
            holdTask?.cancel()
            dragStart = nil
            selection = .idle
        }
        // A pinned range buds its change out of the flag, on the side toward the middle of the plot; when the range
        // ends the bubble melts back in.
        .onChange(of: phase) { old, new in
            if new == .range, let index = activeIndex {
                bubbleSide = plotFraction(index) < 0.5 ? 1 : -1
                Task { await buds.bloom(["change"], reduceMotion: reduceMotion) }
            } else if old == .range {
                Task { await buds.gather(["change"], reduceMotion: reduceMotion) }
            }
        }
        .onChange(of: selection) {
            if rangeSpan != nil, let chip = chipValues { heldChange = RangeChange(delta: chip.delta, percent: chip.percent) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Chart, \(series.isEmpty ? "" : series[rangeIndex].label)")
        .accessibilityValue(accessibilitySummary)
        .accessibilityAdjustableAction { direction in
            guard !isEmpty else { return }
            // At rest sits one step past the latest point, so swiping up past it lets go of the scrub, as a lift does.
            let current = activeIndex ?? points.count
            let next = direction == .increment ? min(current + 1, points.count) : max(current - 1, 0)
            selection = next == points.count ? .idle : .scrubbing(next)
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
                // Shown only once the line has landed on these extremes: when the range or the min or max changes they
                // leave at once and return after the morph, so no label arrives ahead of the line it marks. New data
                // that leaves both in place leaves the labels too.
                if selection == .idle, let maxIndex = extremeIndex(max: true), let minIndex = extremeIndex(max: false),
                   landed == Extremes(range: rangeIndex, low: points[minIndex], high: points[maxIndex]) {
                    PointMark(x: .value("Position", chartX(maxIndex)), y: .value("Value", norm(points[maxIndex].value)))
                        .symbolSize(0)
                        .annotation(position: .top, spacing: 6) { marker(points[maxIndex].value) }
                    PointMark(x: .value("Position", chartX(minIndex)), y: .value("Value", norm(points[minIndex].value)))
                        .symbolSize(0)
                        .annotation(position: .bottom, spacing: 6) { marker(points[minIndex].value) }
                }
            } else {
                ForEach(Array(normalized.enumerated()), id: \.offset) { index, y in
                    BarMark(x: .value("Position", Double(index)), yStart: .value("Floor", Self.barFloor), yEnd: .value("Value", y), width: .fixed(barWidth))
                        .clipShape(.rect(cornerRadius: min(6, barWidth / 2), style: .continuous))
                        .foregroundStyle(barHighlighted(index) ? style.accent : tint)
                        .opacity(barOpacity(index))
                }
            }
            // The first value, read from the plotted series so it moves with the line through a morph.
            RuleMark(y: .value("Baseline", normalized.first ?? 0.5))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 5]))
                .foregroundStyle(style.muted.opacity(0.6))
            if let span = rangeSpan, mode == .line {
                RectangleMark(xStart: .value("From", chartX(span.from)), xEnd: .value("To", chartX(span.to)))
                    .foregroundStyle(style.band)
                    .zIndex(-1)
                RuleMark(x: .value("From", chartX(span.from)))
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .foregroundStyle(tint)
            }
            if !isEmpty, mode == .line, activeIndex == nil, let latest = normalized.last {
                // At rest the latest value wears the accent: a block dot ringed in the ground. It rides the end of the
                // plotted line, which is the latest value at rest, so it stays on the line through a morph.
                PointMark(x: .value("Latest", chartX(points.count - 1)), y: .value("Value", latest))
                    .symbol { dot }
            }
            if let index = activeIndex, !isEmpty {
                RuleMark(x: .value("Scrub", chartX(index)))
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .foregroundStyle(tint)
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
                    if mode == .line, let y = proxy.position(forY: norm(points[index].value)) {
                        // Drawn here rather than as a chart symbol so it can pop when a hold pins the anchor. It lands
                        // under the finger on the press spring, a beat ahead of the rule and the readout.
                        dot
                            .piecePop(trigger: pinTick, amount: 0.25)
                            .position(x: plot.minX + x, y: plot.minY + y)
                            .transition(.asymmetric(insertion: AnyTransition.opacity.animation(PieceMotion(reduceMotion: reduceMotion).press), removal: .opacity))
                            .allowsHitTesting(false)
                    }
                    flag(index: index, x: plot.minX + x, plot: plot, bounds: geometry.size)
                }
                if isEmpty {
                    Text("No data yet")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.muted)
                        .position(x: plot.midX, y: plot.midY - 14)
                }
            }
        }
        .animation(phaseAnimation, value: phase)
    }

    private var dot: some View {
        Circle()
            .fill(style.accent)
            .overlay { Circle().strokeBorder(style.ground, lineWidth: 3) }
            .frame(width: 16, height: 16)
    }

    // MARK: Flag

    /// A glass flag riding the top of the rule with the point's date. It grows out of the top of the rule as the
    /// finger lands and sinks back into it on release. It follows the finger with no animation of its own, kept inside
    /// the plot along with its bubble.
    private func flag(index: Int, x: CGFloat, plot: CGRect, bounds: CGSize) -> some View {
        let gap = PieceLiquid.joined
        // While the bubble is out, the flag keeps room for it on its side, so the pair never leaves the plot.
        let room = buds.isOut("change") ? gap + bubbleWidth : 0
        let half = flagWidth / 2
        let low = plot.minX + half + (bubbleSide < 0 ? room : 0)
        let high = plot.maxX - half - (bubbleSide > 0 ? room : 0)
        let flagX = min(max(x, low), max(high, low))
        let trailing = bubbleSide > 0
        // A positioned view fills the overlay, so the flag's own bottom center, where the rule meets it, is found there.
        let base = UnitPoint(x: flagX / max(bounds.width, 1), y: (plot.minY + 24) / max(bounds.height, 1))
        return PieceLiquidGroup {
            Text(dateLabel(points[index].date, precise: true))
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(style.line)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, 9)
                .frame(height: 24)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { flagWidth = $0 }
                .pieceLiquid(Capsule(), interactive: false)
                // Its own glass shape beside the flag, not the flag's content, so the two melt through a neck. Behind,
                // so a bubble melting home slips under the date.
                .background(alignment: trailing ? .trailing : .leading) {
                    // Rests a neck's width beyond the flag's end. The guide sits outside the condition: on a view inside
                    // an `if` it would be ignored.
                    ZStack {
                        if buds.contains("change") { changeBubble }
                    }
                    .alignmentGuide(trailing ? .trailing : .leading) { d in trailing ? d[.leading] - gap : d[.trailing] + gap }
                }
        }
        .position(x: flagX, y: plot.minY + 12)
        .transition(PieceMotion(reduceMotion: reduceMotion).transition(.scale(scale: 0.5, anchor: base).combined(with: .opacity)))
        .allowsHitTesting(false)
    }

    /// The held range's change, tinted up or down. It buds out of the flag's side and rests joined to it, so a neck
    /// holds the two together; its tint drains as it melts back in, and its figures change at once under the finger.
    private var changeBubble: some View {
        let out = buds.isOut("change")
        let change = rangeSpan.flatMap { _ in chipValues.map { RangeChange(delta: $0.delta, percent: $0.percent) } } ?? heldChange
        let gap = PieceLiquid.joined
        let rising = change.delta >= 0
        let tint: Color? = !out ? nil : change.delta > 0 ? style.up : change.delta < 0 ? style.down : nil
        // Home is just inside the flag's near end, shrunk, where the two are one shape.
        let home = -bubbleSide * (gap + bubbleWidth * (1 + PieceLiquid.homeScale) / 2)
        return HStack(spacing: 3) {
            Image(systemName: rising ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 10, weight: .semibold))
                .id(rising)
                .transition(PieceMotion(reduceMotion: reduceMotion).swap)
            Text(abs(change.percent), format: .percent.precision(.fractionLength(1)))
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
        }
        .foregroundStyle(change.delta == 0 ? style.muted : style.ink)
        .lineLimit(1)
        .fixedSize()
        .pieceBudContent(out: out)
        .padding(.horizontal, 9)
        .frame(height: 24)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { bubbleWidth = $0 }
        .pieceLiquid(Capsule(), tint: tint, interactive: false)
        .pieceBud(out: out, home: CGSize(width: home, height: 0))
    }

    /// Where a point sits across the plot, 0 at the leading edge and 1 at the trailing.
    private func plotFraction(_ index: Int) -> Double {
        mode == .line ? fraction(index) : (Double(index) + 0.5) / Double(max(points.count, 1))
    }

    private func marker(_ value: Double) -> some View {
        Text(value, format: format)
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .foregroundStyle(style.muted)
            .transition(.opacity)
    }

    // MARK: Readout

    private var readout: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return VStack(alignment: .leading, spacing: 8) {
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
                    // Whatever animates the figure (touching down, pinning, a range switch), it lands without overshoot,
                    // so a roll never shows a digit past its place. A scrub step carries no animation and stays instant.
                    .transaction { if $0.animation != nil { $0.animation = motion.value } }
                if let chip = chipValues {
                    // It has no glass to grow from, so it rises in beside the figure when data arrives.
                    PieceLiquidGroup {
                        deltaChip(delta: chip.delta, percent: chip.percent, showsAmount: rangeSpan == nil)
                    }
                    .transition(motion.transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity)))
                }
                Spacer(minLength: 0)
            }
        }
        .monospacedDigit()
        .frame(maxWidth: .infinity, alignment: .leading)
        // On the chart's beat, so the figure never trails the rule.
        .animation(phaseAnimation, value: phase)
    }

    private var metaLine: String {
        guard !isEmpty else { return series.isEmpty ? "" : series[rangeIndex].label }
        if let span = rangeSpan { return "\(dateLabel(points[span.from].date)) – \(dateLabel(points[span.to].date))" }
        if case .scrubbing = selection, let index = activeIndex { return dateLabel(points[index].date, precise: true) }
        return "Latest · \(series[rangeIndex].label)"
    }

    /// The big figure: the active value, or the signed change while a range is held. Decimals are dimmed.
    private var numeral: some View {
        let value: Double
        var signed = false
        if isEmpty {
            return AnyView(Text("—").font(.system(size: style.numeralSize * numeralScale, weight: .semibold)).foregroundStyle(style.muted))
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
                .font(.system(size: style.numeralSize * numeralScale, weight: .semibold))
                .tracking(-style.numeralSize * 0.02)
                .contentTransition(rolling(value))
        )
    }

    /// Digits roll straight to the new value, never through the ones between; under Reduce Motion they crossfade.
    private func rolling(_ value: Double) -> ContentTransition {
        reduceMotion ? .opacity : .numericText(value: value)
    }

    private var chipValues: (delta: Double, percent: Double)? {
        guard let first = points.first, let last = points.last else { return nil }
        let from: Double, to: Double
        if let span = rangeSpan { (from, to) = (points[span.from].value, points[span.to].value) }
        else if let index = activeIndex { (from, to) = (first.value, points[index].value) }
        else { (from, to) = (first.value, last.value) }
        return (to - from, from == 0 ? 0 : (to - from) / abs(from))
    }

    /// Up and down arrive as tinted glass with ink, never as colored text: sage for up, red for down, clear glass with
    /// muted figures when there is no change.
    private func deltaChip(delta: Double, percent: Double, showsAmount: Bool) -> some View {
        let tint: Color? = delta > 0 ? style.up : delta < 0 ? style.down : nil
        let figures = PieceMotion(reduceMotion: reduceMotion).value
        return HStack(spacing: 4) {
            // A turn of direction on a phase change blurs the arrow across; under the finger it changes at once.
            Image(systemName: delta >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 11, weight: .semibold))
                .id(delta >= 0)
                .transition(PieceMotion(reduceMotion: reduceMotion).swap)
            if showsAmount {
                Text((delta < 0 ? "−" : "+") + format.format(abs(delta)))
                    .contentTransition(rolling(delta))
            }
            Text(abs(percent), format: .percent.precision(.fractionLength(1)))
                .contentTransition(rolling(percent))
        }
        // The amounts are figures and land without overshoot; the glass around them keeps the snap's give.
        .transaction { if $0.animation != nil { $0.animation = figures } }
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(delta == 0 ? style.muted : style.ink)
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .pieceLiquid(Capsule(), tint: tint, interactive: false)
    }

    /// Splits a formatted number at its decimal separator, so the fraction can be dimmed.
    private static func splitDecimals(_ text: String) -> (whole: String, fraction: String) {
        let separator = Locale.current.decimalSeparator ?? "."
        guard let range = text.range(of: separator, options: .backwards),
              let next = text[range.upperBound...].first, next.isNumber else { return (text, "") }
        return (String(text[..<range.lowerBound]), String(text[range.lowerBound...]))
    }

    // MARK: Picker

    /// Liquid segments: one glass capsule per range, joined by necks. The picked one swells and takes the accent
    /// tint, which flows to it through the necks while the one it leaves drains back to clear glass and narrows.
    /// Segments press in lightly. Under Reduce Motion the tint crossfades and the widths settle on a short spring.
    private var picker: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let gap = PieceLiquid.joined
        // The picked segment takes a little more width than the rest, so the necks slide along as the pick moves.
        let swell = 1.28
        let unit = (pickerWidth - gap * CGFloat(series.count - 1)) / (CGFloat(series.count - 1) + swell)
        return PieceLiquidGroup {
            HStack(spacing: gap) {
                ForEach(Array(series.enumerated()), id: \.element.id) { index, item in
                    let on = index == rangeIndex
                    Button {
                        withAnimation(motion.snap) { setRange(index) }
                    } label: {
                        Text(item.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(on ? style.ink : style.muted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .padding(.horizontal, 6)
                            .frame(width: unit > 0 ? unit * (on ? swell : 1) : nil)
                            .frame(maxWidth: unit > 0 ? nil : .infinity, minHeight: 44)
                            .contentShape(Capsule())
                            .pieceLiquid(Capsule(), tint: on ? style.accent : nil, interactive: false)
                    }
                    .buttonStyle(PieceLiquidPressStyle(depth: 1.5))
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .frame(maxWidth: .infinity)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pickerWidth = $0 }
        }
        // A range set from outside swells and tints on the same snap as a tap.
        .animation(motion.snap, value: rangeIndex)
    }

    private func setRange(_ index: Int) {
        if let rangeBinding { rangeBinding.wrappedValue = index } else { internalRange = index }
    }

    // MARK: Gesture

    /// Selection follows the finger directly, with no animation of its own: only `phase` changes animate.
    private func scrubGesture(proxy: ChartProxy, plot: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($touching) { _, state, _ in state = true }
            .onChanged { value in
                guard !isEmpty else { return }
                let index = nearestIndex(x: value.location.x - plot.minX, width: plot.width)
                if dragStart == nil {
                    dragStart = value.location
                    moved = false
                    holdTask?.cancel()
                    // Holding still for a moment pins an anchor and turns the drag into a range. It pins the point
                    // under the finger now, not at touch-down: a resting finger can drift onto a neighbor within the
                    // tolerance, and the cursor must not jump back. The dot pops on the same beat as the rigid tap.
                    holdTask = Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        guard !Task.isCancelled, !moved, case .scrubbing(let anchor) = selection else { return }
                        selection = .range(anchor, anchor)
                        pinTick += 1
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

    /// Line mode resamples every dataset to the same point count, so a new range or new data bends the line instead of
    /// redrawing it, on the value spring: chart values never overshoot. The line, its latest dot and its baseline all
    /// read `normalized`, so they move in this one transaction; min and max labels that moved come back once it has landed. Going from no data to data, on first
    /// appearance or when data loads later, the series unfolds calmly instead. The selection is left alone.
    private func morph() {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let target = mode == .line ? Self.resample(points, count: sampleCount).map(norm) : points.map { norm($0.value) }
        let landing = extremes
        morphTick += 1
        let tick = morphTick
        guard normalized.isEmpty, !target.isEmpty else {
            land(target, landing: landing, tick: tick, animation: motion.value)
            return
        }
        var still = Transaction()
        still.disablesAnimations = true
        if reduceMotion {
            // Under Reduce Motion the series is simply there.
            withTransaction(still) {
                normalized = target
                landed = landing
            }
            return
        }
        // The flat pose is drawn first and the series rises from it on the next turn. Set together, the two writes
        // would merge and the marks would arrive with Charts' own insertion instead.
        withTransaction(still) { normalized = Self.unfoldStart(points, mode: mode, samples: sampleCount) }
        Task {
            guard tick == morphTick else { return }
            land(target, landing: landing, tick: tick, animation: Self.unfold)
        }
    }

    /// The first unfold keeps the calm reveal's unhurried pace without its give: the line would rise past values it
    /// never had, and bars past their heights. Reduce Motion never unfolds (see `morph`).
    private static var unfold: Animation { .spring(duration: PieceMotion.calm.duration, bounce: 0) }

    private func land(_ target: [Double], landing: Extremes?, tick: Int, animation: Animation) {
        withAnimation(animation) {
            normalized = target
        } completion: {
            // Only the latest change brings the labels back.
            guard tick == morphTick else { return }
            withAnimation(PieceMotion(reduceMotion: reduceMotion).reveal) { landed = landing }
        }
    }

    /// Where the series unfolds from when data first arrives: the line flat on its first value, the bars on the floor.
    private static func unfoldStart(_ points: [Point], mode: Mode, samples: Int) -> [Double] {
        guard let first = points.first else { return [] }
        guard mode == .line else { return Array(repeating: barFloor, count: points.count) }
        let (lo, hi) = Self.bounds(of: points)
        return Array(repeating: (first.value - lo) / (hi - lo), count: samples)
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

    /// Where bars stand, just below the lowest value so the smallest bar still shows.
    private static var barFloor: Double { -0.1 }
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
    /// Line and bar color when no `tint` is passed, and the date on the scrub flag.
    public var line: Color
    /// Block for the latest point, the scrub dot and the active bar, and the glass tint of the picked range segment.
    public var accent: Color
    /// Glass tint of a rising delta.
    public var up: Color
    /// Glass tint of a falling delta.
    public var down: Color
    /// Text on tinted glass.
    public var ink: Color
    /// Meta labels, axis labels, and dimmed decimals.
    public var muted: Color
    /// Solid step behind a held range. Since the liquid glass refactor the picker is glass and no longer sits on it.
    public var band: Color
    /// The surface the chart sits on; used to ring the dot.
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

    /// House text line on a white or charcoal card, butter accent, sage up, red down. Copy it and change one property to customize.
    public static let standard = ScrubChartStyle(
        line: adaptive(0x141414, 0xF4F3EF),
        accent: adaptive(0xFFD976, 0xFFD976),
        up: adaptive(0xA9DCB7, 0xA9DCB7),
        down: adaptive(0xFF0000, 0xFF0000),
        ink: adaptive(0x141414, 0x141414),
        muted: adaptive(0x5C5A56, 0xA6A49F),
        band: adaptive(0xF3F2EE, 0x262626),
        ground: adaptive(0xFFFFFF, 0x1C1C1C)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { @Sendable traits in
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, pop)

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

/// Anticipation, overshoot, settle: dips, swells past full size and lands each time `trigger` changes. Under
/// Reduce Motion it stays still (same view, no identity change) and the color or symbol carries the meaning.
private struct PiecePop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let amount = reduceMotion ? 0 : amount
        content.keyframeAnimator(initialValue: CGFloat(1), trigger: trigger) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(1 - amount * 0.4, duration: 0.08)
                SpringKeyframe(1 + amount, duration: 0.14, spring: Spring(duration: 0.18, bounce: 0))
                SpringKeyframe(1, duration: 0.42, spring: PieceMotion.expressive)
            }
        }
    }
}

private extension View {
    /// Pops each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func piecePop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PiecePop(trigger: AnyHashable(trigger), amount: amount))
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
