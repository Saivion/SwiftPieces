// swiftpieces:
// title: Ring Breakdown
// description: A composition ring of solid color blocks with rounded seams that you scrub by dragging around it, with a haptic at each slice boundary, a radial lift for the selected slice while the rest step back to the surface, a light display-scale center figure, and legend rows that turn into the slice's block.
// category: data
// version: "2.0.0"
// pro: spending-ring
// minIOSVersion: "17.0"
// tags: [chart, ring, donut, breakdown, scrub, legend, budget]

import SwiftUI

/// Ring chart with scrub-to-select, a lifted slice, and a built-in legend.
///
/// - Parameters:
///   - slices: Parts of the whole, drawn clockwise from the top. Labels must be unique.
///   - thickness: Ring thickness in points.
///   - tint: Color of the first slice. Defaults to the style's first block; later slices take the next blocks unless a slice sets `color`.
///   - format: Number format for the center value and legend, for example `.number` or `.currency(code: "USD")`. Defaults to `.number`.
///   - showsLegend: Show the tappable legend rows below the ring.
///   - selection: Optional binding to the selected slice id, for driving selection from outside.
///   - style: Slice blocks, ink, and surface colors. Defaults to `.standard`: tangerine, sky, butter, sage, lilac, and sand.
public struct RingBreakdown<Format: FormatStyle>: View where Format.FormatInput == Double, Format.FormatOutput == String {
    /// Colors for the ring and legend. See `RingBreakdownStyle`.
    public typealias Style = RingBreakdownStyle

    public struct Slice: Identifiable, Hashable, Sendable {
        public var id: String { label }
        public let label: String
        public let value: Double
        public let color: Color?
        public init(label: String, value: Double, color: Color? = nil) {
            self.label = label
            self.value = max(value, 0)
            self.color = color
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .title) private var numeralScale: CGFloat = 1
    @State private var sweep: CGFloat = 0
    @State private var internalSelection: Slice.ID?
    @State private var tapInHole = false

    private let slices: [Slice]
    private let thickness: CGFloat
    private let tint: Color
    private let format: Format
    private let showsLegend: Bool
    private let selectionBinding: Binding<Slice.ID?>?
    private let style: Style

    public init(slices: [Slice], thickness: CGFloat = 34, tint: Color? = nil, format: Format, showsLegend: Bool = true, selection: Binding<Slice.ID?>? = nil, style: Style = .standard) {
        self.slices = slices
        self.thickness = thickness
        self.tint = tint ?? style.blocks.first ?? .accentColor
        self.format = format
        self.showsLegend = showsLegend
        self.selectionBinding = selection
        self.style = style
    }

    public init(slices: [Slice], thickness: CGFloat = 34, tint: Color? = nil, showsLegend: Bool = true, selection: Binding<Slice.ID?>? = nil, style: Style = .standard) where Format == FloatingPointFormatStyle<Double> {
        self.init(slices: slices, thickness: thickness, tint: tint, format: .number.precision(.fractionLength(0...1)), showsLegend: showsLegend, selection: selection, style: style)
    }

    // MARK: Derived

    private var selected: Slice.ID? {
        get { selectionBinding?.wrappedValue ?? internalSelection }
        nonmutating set {
            if let selectionBinding { selectionBinding.wrappedValue = newValue } else { internalSelection = newValue }
        }
    }
    private var total: Double { slices.map(\.value).reduce(0, +) }
    private var current: Slice? { slices.first { $0.id == selected } }

    /// Start and end angles per slice, clockwise from twelve o'clock.
    private var arcs: [(slice: Slice, start: Angle, end: Angle)] {
        guard total > 0 else { return [] }
        var cursor = -90.0
        return slices.map { slice in
            let sweep = slice.value / total * 360
            defer { cursor += sweep }
            return (slice, .degrees(cursor), .degrees(cursor + sweep))
        }
    }

    private func color(for index: Int) -> Color {
        if let custom = slices[index].color { return custom }
        if index == 0 { return tint }
        guard !style.blocks.isEmpty else { return tint }
        return style.blocks[index % style.blocks.count]
    }

    // MARK: Body

    public var body: some View {
        VStack(spacing: 20) {
            ring
                .aspectRatio(1, contentMode: .fit)
            if showsLegend { legend }
        }
        .animation(.spring(duration: 0.4, bounce: 0.22), value: selected)
        .sensoryFeedback(.selection, trigger: selected)
        .task(id: slices) {
            selected = nil
            if reduceMotion { sweep = 1; return }
            sweep = 0
            try? await Task.sleep(for: .milliseconds(16))
            withAnimation(.easeInOut(duration: 0.9)) { sweep = 1 }
        }
    }

    private var ring: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
            ZStack {
                ForEach(Array(arcs.enumerated()), id: \.element.slice.id) { index, arc in
                    let isSelected = arc.slice.id == selected
                    let mid = (arc.start.radians + arc.end.radians) / 2
                    let lift: CGFloat = isSelected && !reduceMotion ? 6 : 0
                    // Filled and stroked with a round join, so every seam gets a soft corner.
                    let fill = selected == nil || isSelected ? color(for: index) : style.rest
                    RingSlice(start: arc.start, end: arc.end, thickness: thickness - style.cornerRadius * 2, gap: style.gap + style.cornerRadius * 2, inset: style.cornerRadius)
                        .fill(fill)
                        .stroke(fill, style: StrokeStyle(lineWidth: style.cornerRadius * 2, lineJoin: .round))
                        .compositingGroup()
                        .shadow(color: .black.opacity(isSelected ? 0.18 : 0), radius: 12, y: 6)
                        .offset(x: cos(mid) * lift, y: sin(mid) * lift)
                        .zIndex(isSelected ? 1 : 0)
                }
                centerReadout
                    .frame(width: (side - thickness * 2) * 0.8)
            }
            .frame(width: side, height: side)
            .position(center)
            .mask {
                // Sweeps in clockwise from the top on appear.
                Circle()
                    .trim(from: 0, to: sweep)
                    .stroke(style: StrokeStyle(lineWidth: side))
                    .frame(width: side, height: side)
                    .rotationEffect(.degrees(-90))
                    .position(center)
            }
            .contentShape(Circle().size(width: side, height: side).offset(x: center.x - side / 2, y: center.y - side / 2))
            .gesture(scrub(center: center, outer: side / 2))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Breakdown")
        .accessibilityValue(current.map { "\($0.label), \(format.format($0.value))" } ?? "Total \(format.format(total))")
        .accessibilityAdjustableAction { direction in
            let index = slices.firstIndex { $0.id == selected } ?? -1
            let next = direction == .increment ? min(index + 1, slices.count - 1) : max(index - 1, 0)
            if slices.indices.contains(next) { selected = slices[next].id }
        }
    }

    private var centerReadout: some View {
        let value = current?.value ?? total
        let parts = Self.splitDecimals(format.format(value))
        return VStack(spacing: 4) {
            Text((current?.label ?? "Total").uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(style.muted)
                .contentTransition(.opacity)
            Text("\(Text(parts.whole))\(Text(parts.fraction).foregroundStyle(style.muted))")
                .font(.system(size: 34 * numeralScale, weight: .light))
                .tracking(-0.8)
                .monospacedDigit()
                .contentTransition(.numericText(value: value))
            if let current, total > 0 {
                Text(current.value / total, format: .percent.precision(.fractionLength(0)))
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(style.ink)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 24)
                    .background(color(for: slices.firstIndex { $0.id == current.id } ?? 0), in: Capsule())
                    .contentTransition(.numericText(value: current.value / total))
                    .transition(.opacity.combined(with: .scale(scale: 0.8)))
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .multilineTextAlignment(.center)
    }

    /// Splits a formatted number at its decimal separator, so the fraction can be dimmed.
    private static func splitDecimals(_ text: String) -> (whole: String, fraction: String) {
        let separator = Locale.current.decimalSeparator ?? "."
        guard let range = text.range(of: separator, options: .backwards),
              let next = text[range.upperBound...].first, next.isNumber else { return (text, "") }
        return (String(text[..<range.lowerBound]), String(text[range.lowerBound...]))
    }

    private var legend: some View {
        VStack(spacing: 2) {
            ForEach(Array(slices.enumerated()), id: \.element.id) { index, slice in
                let isSelected = slice.id == selected
                Button {
                    selected = isSelected ? nil : slice.id
                } label: {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(isSelected ? style.ink : color(for: index))
                            .frame(width: 14, height: 14)
                        Text(slice.label).font(.body.weight(isSelected ? .bold : .medium))
                        Spacer(minLength: 8)
                        Text(slice.value, format: format).font(.body.weight(.medium)).monospacedDigit()
                        Text(total > 0 ? slice.value / total : 0, format: .percent.precision(.fractionLength(0)))
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundStyle(isSelected ? style.ink.opacity(0.7) : style.muted)
                            .frame(width: 44, alignment: .trailing)
                    }
                    .foregroundStyle(isSelected ? style.ink : style.text)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .background(isSelected ? color(for: index) : .clear, in: .rect(cornerRadius: 18, style: .continuous))
                    .opacity(selected == nil || isSelected ? 1 : 0.62)
                    .contentShape(.rect(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityValue(format.format(slice.value))
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }

    // MARK: Gesture

    /// Drag around the ring to move the selection; a tap in the hole clears it.
    private func scrub(center: CGPoint, outer: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let dx = value.location.x - center.x, dy = value.location.y - center.y
                let distance = hypot(dx, dy)
                if value.translation == .zero { tapInHole = distance < outer - thickness * 1.3 }
                guard distance >= outer - thickness * 1.6, distance <= outer * 1.25, total > 0 else { return }
                tapInHole = false
                var degrees = atan2(dy, dx) * 180 / .pi
                if degrees < -90 { degrees += 360 }
                if let hit = arcs.first(where: { degrees >= $0.start.degrees && degrees < $0.end.degrees }) ?? arcs.last {
                    selected = hit.slice.id
                }
            }
            .onEnded { _ in
                if tapInHole { selected = nil }
                tapInHole = false
            }
    }

    private struct RingSlice: Shape {
        var start: Angle
        var end: Angle
        var thickness: CGFloat
        var gap: CGFloat
        var inset: CGFloat = 0

        func path(in rect: CGRect) -> Path {
            let center = CGPoint(x: rect.midX, y: rect.midY)
            let outer = min(rect.width, rect.height) / 2 - inset
            let inner = max(outer - thickness, 1)
            // Same gap in points at both radii, so the seams stay parallel.
            let outerInset = Angle(radians: Double(gap / 2 / outer))
            let innerInset = Angle(radians: Double(gap / 2 / inner))
            guard end.radians - start.radians > innerInset.radians * 2 else { return Path() }
            var path = Path()
            path.addArc(center: center, radius: outer, startAngle: start + outerInset, endAngle: end - outerInset, clockwise: false)
            path.addArc(center: center, radius: inner, startAngle: end - innerInset, endAngle: start + innerInset, clockwise: true)
            path.closeSubpath()
            return path
        }
    }
}

/// Colors and seams for `RingBreakdown`, built from the Free house palette.
public struct RingBreakdownStyle: Sendable {
    /// Slice fills in order; they repeat past the last one.
    public var blocks: [Color]
    /// Fill of unselected slices while one is selected, one solid step off the surface.
    public var rest: Color
    /// Text on blocks.
    public var ink: Color
    /// Primary text off the blocks.
    public var text: Color
    /// Meta labels and dimmed decimals.
    public var muted: Color
    /// Gap between slices in points.
    public var gap: CGFloat
    /// Corner radius of each slice's ends in points.
    public var cornerRadius: CGFloat

    public init(blocks: [Color], rest: Color, ink: Color, text: Color, muted: Color, gap: CGFloat = 4, cornerRadius: CGFloat = 5) {
        self.blocks = blocks
        self.rest = rest
        self.ink = ink
        self.text = text
        self.muted = muted
        self.gap = gap
        self.cornerRadius = cornerRadius
    }

    /// The six house blocks with ink, on white or charcoal. Copy it and change one property to customize.
    public static let standard = RingBreakdownStyle(
        blocks: [0xFF5B3A, 0x9CC2FF, 0xFFD976, 0xA9DCB7, 0xCDB8FF, 0xE9D5B3].map { adaptive($0, $0) },
        rest: adaptive(0xE9E7E1, 0x2E2E2E),
        ink: adaptive(0x141414, 0x141414),
        text: adaptive(0x141414, 0xF4F3EF),
        muted: adaptive(0x5C5A56, 0xA6A49F)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct RingBreakdownExample: View {
    @State private var selection: String? = "Food"

    var body: some View {
        RingBreakdown(
            slices: [
                .init(label: "Housing", value: 1450), .init(label: "Food", value: 620), .init(label: "Transport", value: 310),
                .init(label: "Leisure", value: 270), .init(label: "Other", value: 150),
            ],
            format: .currency(code: "USD").precision(.fractionLength(0)),
            selection: $selection
        )
        .padding(28)
        .frame(maxHeight: .infinity)
        .background(RingBreakdownStyle.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    RingBreakdownExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    RingBreakdownExample().preferredColorScheme(.dark)
}
