// swiftpieces:
// title: Live Stat
// description: A metric tile with a light display-scale value that rolls with a spring and dims its decimals, a solid delta block, a sparkline you hold and scrub to retarget the value live, a press that expands the line into a taller chart with low and high, and a solid color block variant.
// category: data
// version: "2.0.0"
// pro: dashboard-screen
// minIOSVersion: "17.0"
// tags: [stat, kpi, sparkline, scrub, tile, numbers]

import SwiftUI

/// KPI tile with a rolling value, delta chip, and a scrubbable sparkline that expands on press.
///
/// - Parameters:
///   - label: Metric name shown above the value.
///   - value: Current value. Changing it rolls the number from the previous one.
///   - format: Number format for the value, for example `.number` or `.currency(code: "USD")`. Defaults to `.number`.
///   - delta: Optional fractional change (0.12 is +12%) shown as a solid chip: sage for up, tangerine for down.
///   - series: History drawn as the sparkline, oldest first. Hold and drag it to scrub.
///   - tint: Sparkline color. Defaults to the style's `line`.
///   - expanded: Optional binding to the expanded state, for driving it from outside.
///   - style: Tile, text, and chip colors. Defaults to `.standard`, a surface tile; `.block(_:)` fills the tile with a color block and dark ink.
public struct LiveStat<Format: FormatStyle>: View where Format.FormatInput == Double, Format.FormatOutput == String {
    /// Tile and chip colors. See `LiveStatStyle`.
    public typealias Style = LiveStatStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorSchemeContrast) private var contrast
    @ScaledMetric(relativeTo: .largeTitle) private var numeralScale: CGFloat = 1
    @Namespace private var space
    @State private var rolled: Double = 0
    @State private var drawn: CGFloat = 0
    @State private var pressed = false
    @State private var scrubIndex: Int?
    @State private var internalExpanded = false
    @State private var lineFrame: CGRect = .zero
    @State private var dragStart: CGPoint?
    @State private var moved = false
    @State private var holdTask: Task<Void, Never>?
    @State private var expandTaps = 0

    private let label: String
    private let value: Double
    private let format: Format
    private let delta: Double?
    private let series: [Double]
    private let tint: Color
    private let expandedBinding: Binding<Bool>?
    private let style: Style

    public init(label: String, value: Double, format: Format, delta: Double? = nil, series: [Double] = [], tint: Color? = nil, expanded: Binding<Bool>? = nil, style: Style = .standard) {
        self.label = label
        self.value = value
        self.format = format
        self.delta = delta
        self.series = series
        self.tint = tint ?? style.line
        self.expandedBinding = expanded
        self.style = style
    }

    public init(label: String, value: Double, delta: Double? = nil, series: [Double] = [], tint: Color? = nil, expanded: Binding<Bool>? = nil, style: Style = .standard) where Format == FloatingPointFormatStyle<Double> {
        self.init(label: label, value: value, format: .number, delta: delta, series: series, tint: tint, expanded: expanded, style: style)
    }

    private var expanded: Bool { expandedBinding?.wrappedValue ?? internalExpanded }
    private var isScrubbing: Bool { scrubIndex != nil }
    private var hasLine: Bool { series.count > 1 }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                Text(label.uppercased())
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(style.muted)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let delta {
                    deltaChip(delta)
                        .opacity(isScrubbing ? 0.35 : 1)
                }
            }

            RollingNumber(value: rolled, target: scrubIndex.map { series[$0] } ?? value, format: format, dim: style.muted)
                .font(.system(size: style.numeralSize * numeralScale, weight: .light))
                .tracking(-style.numeralSize * 0.02)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .foregroundStyle(style.text)

            if hasLine {
                if expanded {
                    chart(height: 120, showsDetail: true)
                    extremes
                        .transition(.opacity.combined(with: .move(edge: .top)))
                } else {
                    chart(height: 40, showsDetail: false)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(style.background, in: .rect(cornerRadius: 26, style: .continuous))
        .shadow(color: .black.opacity(pressed ? 0.02 : 0.06), radius: pressed ? 4 : 16, y: pressed ? 2 : 8)
        .scaleEffect(pressed && !reduceMotion ? 0.97 : 1)
        .animation(.spring(duration: 0.35, bounce: 0.2), value: pressed)
        .animation(.spring(duration: 0.45, bounce: 0.15), value: expanded)
        .animation(.snappy(duration: 0.15), value: scrubIndex)
        .coordinateSpace(name: "tile")
        .contentShape(.rect(cornerRadius: 20, style: .continuous))
        .gesture(tileGesture)
        .sensoryFeedback(.selection, trigger: scrubIndex) { _, new in new != nil }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: isScrubbing) { _, new in new }
        .sensoryFeedback(.impact(flexibility: .solid), trigger: expandTaps)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(format.format(scrubIndex.map { series[$0] } ?? value))
        .accessibilityHint(hasLine ? "Double tap to \(expanded ? "collapse" : "expand"). Swipe up or down to scrub history." : "")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { toggleExpanded() }
        .accessibilityAdjustableAction { direction in
            guard hasLine else { return }
            let current = scrubIndex ?? series.count - 1
            scrub(to: direction == .increment ? min(current + 1, series.count - 1) : max(current - 1, 0))
        }
        .onAppear(perform: animateIn)
        .onChange(of: value) { _, new in
            guard !isScrubbing else { return }
            withAnimation(reduceMotion ? nil : .spring(duration: 1.0, bounce: 0)) { rolled = new }
        }
    }

    // MARK: Chart

    private func chart(height: CGFloat, showsDetail: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            if showsDetail, let first = series.first, let lo = series.min(), let hi = series.max() {
                // Dashed baseline at the first value, placed on the same scale as the line.
                let y = 6 + (height - 12) * CGFloat(1 - (first - lo) / max(hi - lo, .ulpOfOne))
                Path { path in
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: lineFrame.width, y: y))
                }
                .stroke(style.muted.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [2, 5]))
            }
            StatLine(series: series)
                .trim(from: 0, to: drawn)
                .stroke(tint, style: StrokeStyle(lineWidth: showsDetail ? 3 : 2.5, lineCap: .round, lineJoin: .round))
                .padding(.vertical, 6)
                .frame(height: height)
                .matchedGeometryEffect(id: "line", in: space)
                .background {
                    GeometryReader { proxy in
                        Color.clear
                            .onAppear { lineFrame = proxy.frame(in: .named("tile")) }
                            .onChange(of: proxy.frame(in: .named("tile"))) { _, new in lineFrame = new }
                    }
                }
            let marked = scrubIndex ?? (drawn >= 1 ? series.count - 1 : nil)
            if let index = marked, let point = StatLine.point(at: index, in: series, rect: CGRect(x: 0, y: 6, width: lineFrame.width, height: height - 12)) {
                if scrubIndex != nil {
                    Rectangle()
                        .fill(tint)
                        .frame(width: 1.5, height: height)
                        .position(x: point.x, y: height / 2)
                }
                // The accent block marks the latest value at rest and rides the line while scrubbing.
                Circle()
                    .fill(style.accent)
                    .overlay { Circle().strokeBorder(style.background, lineWidth: 3) }
                    .frame(width: 16, height: 16)
                    .position(point)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(height: height)
    }

    private var extremes: some View {
        HStack(spacing: 16) {
            if let lo = series.min(), let hi = series.max() {
                extreme("Low", lo)
                extreme("High", hi)
                Spacer(minLength: 0)
                Text("\(series.count) pts")
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(style.muted)
            }
        }
    }

    private func extreme(_ title: String, _ value: Double) -> some View {
        HStack(spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1)
                .foregroundStyle(style.muted)
            Text(value, format: format)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(style.text)
        }
    }

    // MARK: Gesture

    /// One drag gesture covers press feel, hold-to-scrub, and tap-to-expand.
    private var tileGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("tile"))
            .onChanged { drag in
                if dragStart == nil {
                    dragStart = drag.location
                    moved = false
                    pressed = true
                    holdTask?.cancel()
                    if hasLine {
                        holdTask = Task {
                            try? await Task.sleep(for: .milliseconds(280))
                            guard !Task.isCancelled, !moved else { return }
                            pressed = false
                            scrub(to: index(atX: drag.location.x))
                        }
                    }
                }
                if isScrubbing {
                    scrub(to: index(atX: drag.location.x))
                } else if !moved, let start = dragStart, hypot(drag.location.x - start.x, drag.location.y - start.y) > 10 {
                    moved = true
                    pressed = false
                    holdTask?.cancel()
                }
            }
            .onEnded { _ in
                holdTask?.cancel()
                let wasTap = !moved && !isScrubbing
                dragStart = nil
                pressed = false
                if isScrubbing {
                    scrubIndex = nil
                    withAnimation(.spring(duration: 0.5, bounce: 0)) { rolled = value }
                } else if wasTap, hasLine {
                    toggleExpanded()
                }
            }
    }

    private func index(atX x: CGFloat) -> Int {
        guard lineFrame.width > 0 else { return series.count - 1 }
        let f = min(max((x - lineFrame.minX) / lineFrame.width, 0), 1)
        return min(max(Int((f * CGFloat(series.count - 1)).rounded()), 0), series.count - 1)
    }

    private func scrub(to index: Int) {
        guard index != scrubIndex else { return }
        scrubIndex = index
        withAnimation(.spring(duration: 0.3, bounce: 0)) { rolled = series[index] }
    }

    private func toggleExpanded() {
        expandTaps += 1
        if let expandedBinding { expandedBinding.wrappedValue.toggle() } else { internalExpanded.toggle() }
    }

    private func animateIn() {
        if reduceMotion {
            rolled = value
            drawn = 1
            return
        }
        withAnimation(.spring(duration: 1.2, bounce: 0)) { rolled = value }
        withAnimation(.easeOut(duration: 1.0)) { drawn = 1 }
    }

    // MARK: Delta chip

    /// Up and down arrive as solid blocks with ink.
    private func deltaChip(_ delta: Double) -> some View {
        let up = delta >= 0
        let strong = contrast == .increased
        return HStack(spacing: 4) {
            Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 11, weight: .heavy))
            Text(abs(delta), format: .percent.precision(.fractionLength(0...1)))
        }
        .font(.system(size: 13, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(style.chipInk)
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(up ? style.up : style.down, in: Capsule())
        .overlay { Capsule().strokeBorder(style.chipInk.opacity(strong ? 0.9 : 0), lineWidth: 1) }
        .accessibilityLabel(up ? "Up" : "Down")
    }

    /// Text whose number is interpolated by the animation, so every frame is a real formatted value.
    private struct RollingNumber: View, Animatable {
        var value: Double
        let target: Double
        let format: Format
        let dim: Color

        nonisolated var animatableData: Double {
            get { value }
            set { value = newValue }
        }

        var body: some View {
            let text = format.format(rounded)
            let separator = Locale.current.decimalSeparator ?? "."
            if let range = text.range(of: separator, options: .backwards), text[range.upperBound...].first?.isNumber == true {
                Text("\(Text(String(text[..<range.lowerBound])))\(Text(String(text[range.lowerBound...])).foregroundStyle(dim))")
            } else {
                Text(text)
            }
        }

        /// Rounds in-flight frames to the target's own decimal places, so a whole-number format never shows a long fraction mid-roll.
        private var rounded: Double {
            let final = format.format(target)
            let separator = Locale.current.decimalSeparator ?? "."
            var places = 0
            if let range = final.range(of: separator, options: .backwards) {
                places = final[range.upperBound...].prefix { $0.isNumber }.count
            }
            let scale = pow(10, Double(places))
            return (value * scale).rounded() / scale
        }
    }

    private struct StatLine: Shape {
        let series: [Double]
        var closed = false

        static func point(at index: Int, in series: [Double], rect: CGRect) -> CGPoint? {
            guard series.count > 1, series.indices.contains(index), let lo = series.min(), let hi = series.max() else { return nil }
            let span = max(hi - lo, .ulpOfOne)
            let x = rect.minX + rect.width * CGFloat(index) / CGFloat(series.count - 1)
            return CGPoint(x: x, y: rect.maxY - CGFloat((series[index] - lo) / span) * rect.height)
        }

        func path(in rect: CGRect) -> Path {
            var path = Path()
            let points = series.indices.compactMap { Self.point(at: $0, in: series, rect: rect) }
            guard let first = points.first else { return path }
            path.move(to: first)
            for point in points.dropFirst() { path.addLine(to: point) }
            if closed {
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
                path.closeSubpath()
            }
            return path
        }
    }
}

/// Tile and chip colors for `LiveStat`, built from the Free house palette.
public struct LiveStatStyle: Sendable {
    /// Tile fill.
    public var background: Color
    /// Value color.
    public var text: Color
    /// Label, dimmed decimals, and detail color.
    public var muted: Color
    /// Sparkline color when no `tint` is passed.
    public var line: Color
    /// Dot marking the latest or scrubbed value.
    public var accent: Color
    /// Chip fill for a rise.
    public var up: Color
    /// Chip fill for a fall.
    public var down: Color
    /// Text on the chip.
    public var chipInk: Color
    /// Value size in points; it scales with Dynamic Type.
    public var numeralSize: CGFloat

    public init(background: Color, text: Color, muted: Color, line: Color, accent: Color, up: Color, down: Color, chipInk: Color, numeralSize: CGFloat = 40) {
        self.background = background
        self.text = text
        self.muted = muted
        self.line = line
        self.accent = accent
        self.up = up
        self.down = down
        self.chipInk = chipInk
        self.numeralSize = numeralSize
    }

    /// A white or charcoal tile with house text, a butter dot, sage and tangerine chips. Copy it and change one property to customize.
    public static let standard = LiveStatStyle(
        background: adaptive(0xFFFFFF, 0x1C1C1C),
        text: adaptive(0x141414, 0xF4F3EF),
        muted: adaptive(0x5C5A56, 0xA6A49F),
        line: adaptive(0x141414, 0xF4F3EF),
        accent: adaptive(0xFFD976, 0xFFD976),
        up: adaptive(0xA9DCB7, 0xA9DCB7),
        down: adaptive(0xFF5B3A, 0xFF5B3A),
        chipInk: adaptive(0x141414, 0x141414)
    )

    /// A tile filled with a solid color block: everything on it turns dark ink, and the chip becomes an ink pill.
    public static func block(_ color: Color) -> LiveStatStyle {
        let ink = adaptive(0x141414, 0x141414)
        return LiveStatStyle(background: color, text: ink, muted: ink.opacity(0.62), line: ink, accent: ink, up: ink, down: ink, chipInk: color)
    }

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct LiveStatExample: View {
    @State private var expanded = false

    var body: some View {
        LiveStat(label: "Revenue", value: 48_250.40, format: .currency(code: "USD"), delta: 0.124, series: [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25], expanded: $expanded)
            .padding(24)
            .frame(maxHeight: .infinity)
            .background(LiveStatStyle.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    LiveStatExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    LiveStatExample().preferredColorScheme(.dark)
}
