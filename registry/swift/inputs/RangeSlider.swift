// swiftpieces:
// title: Range Slider
// description: A dual-thumb slider for a range of values, with two round thumbs on a quiet track and the selected span drawn as a solid color block between them; drag either thumb or touch the track to pull the nearest one over, values snap to a step without floating drift, the thumbs never cross and keep a minimum gap, a grabbed thumb grows and its readout chip fills with the block color, the two readouts merge into one chip instead of colliding, and every step ticks a selection haptic with a firmer impact at a bound or the gap.
// category: inputs
// pro: filter-sheet
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-23"
// tags: [slider, range, dual thumb, filter, price, haptic]

import SwiftUI

/// Dual-thumb slider that binds a `ClosedRange` of any floating-point type.
///
/// The simplest call is one line: `RangeSlider(value: $price, in: 0...1000, step: 10, format: .currency(code: "USD").precision(.fractionLength(0)))`.
/// Pass a `FormatStyle` or a `(V) -> String` closure as `format`; it drives the readouts and the VoiceOver values.
///
/// - Parameters:
///   - value: Bound selected range. Values outside `bounds` are shown clamped; the first change writes a clean, in-bounds range back.
///   - bounds: Minimum and maximum selectable values. Both are always reachable, even when the span is not a multiple of `step`.
///   - step: Optional snapping increment, measured from `bounds.lowerBound`. Snapped values are rounded to the step's decimal places, so `0.1` steps give `0.3`, never `0.30000000000000004`. Without a step the values are continuous.
///   - minimumDistance: Smallest gap the two values keep. The thumbs stop against each other at this distance instead of crossing. Capped at the width of `bounds`.
///   - readout: Where the values print: `.thumbs` (chips above each thumb that merge into one when they would touch), `.header` (a "lower – upper" line above the track), or `.hidden`.
///   - lowerLabel: VoiceOver label of the lower thumb. Defaults to "Minimum".
///   - upperLabel: VoiceOver label of the upper thumb. Defaults to "Maximum".
///   - style: Colors and metrics. Defaults to the Swift Pieces house palette (a tangerine block on a quiet track), adapting to light and dark.
///   - format: Turns a value into the text shown in the readouts and spoken by VoiceOver. A `FormatStyle` (such as `.currency(code:)` or `.percent`) or a closure. Defaults to a plain number with as many decimals as `step` has (up to two without a step).
public struct RangeSlider<V: BinaryFloatingPoint>: View where V.Stride: BinaryFloatingPoint {
    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The unselected part of the track.
        public var track: Color
        /// The selected span between the thumbs, a solid block. Also fills the readout chip of a grabbed thumb.
        public var fill: Color
        /// The thumb face.
        public var thumb: Color
        /// The ring around each thumb. It thickens while the thumb is grabbed.
        public var thumbBorder: Color
        /// Text on `fill`, used by the readout chip of a grabbed thumb.
        public var ink: Color
        /// Readout text at rest and the header values.
        public var label: Color
        /// The dash between values.
        public var secondaryLabel: Color
        /// Readout chips at rest.
        public var chip: Color
        /// Track and span thickness.
        public var trackHeight: CGFloat
        /// Drawn thumb diameter. The touch and VoiceOver target stays at least 44pt either way.
        public var thumbSize: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(track: Color? = nil, fill: Color? = nil, thumb: Color? = nil, thumbBorder: Color? = nil, ink: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, chip: Color? = nil, trackHeight: CGFloat = 8, thumbSize: CGFloat = 28) {
            self.track = track ?? adaptive(light: 0xE6E4DE, dark: 0x2A2A2A)
            self.fill = fill ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.thumb = thumb ?? adaptive(light: 0xFFFFFF, dark: 0xF4F3EF)
            self.thumbBorder = thumbBorder ?? adaptive(light: 0x141414, dark: 0x141414)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.chip = chip ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.trackHeight = max(trackHeight, 2)
            self.thumbSize = max(thumbSize, 16)
        }

        /// The house palette. (Generic types cannot hold stored statics, so this builds a fresh value.)
        public static var standard: Style { Style() }
    }

    /// Where the lower and upper values print.
    public enum Readout: Sendable {
        /// Chips above each thumb that follow it, clamp to the edges, and merge into one chip instead of overlapping.
        case thumbs
        /// A "lower – upper" line above the track.
        case header
        /// No visible values; VoiceOver still speaks them.
        case hidden
    }

    private enum Thumb { case lower, upper }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var direction
    @Binding private var value: ClosedRange<V>
    @State private var width: CGFloat = 0
    @State private var active: Thumb?
    @State private var isPending = false
    @State private var grabOffset: CGFloat = 0
    @State private var isPinned = false
    @State private var lastTick = Date.distantPast
    @State private var selectionTick = 0
    @State private var impactTick = 0
    @State private var lowerChipWidth: CGFloat = 0
    @State private var upperChipWidth: CGFloat = 0
    @State private var mergedChipWidth: CGFloat = 0

    private let math: RangeMath
    private let readout: Readout
    private let lowerLabel: String
    private let upperLabel: String
    private let style: Style
    private let format: (V) -> String

    public init(value: Binding<ClosedRange<V>>, in bounds: ClosedRange<V>, step: V.Stride? = nil, minimumDistance: V = 0, readout: Readout = .thumbs, lowerLabel: String = "Minimum", upperLabel: String = "Maximum", style: Style = .standard, format: ((V) -> String)? = nil) {
        let math = RangeMath(lower: Double(bounds.lowerBound), upper: Double(bounds.upperBound), step: step.map { Double($0) }, gap: Double(minimumDistance))
        self._value = value
        self.math = math
        self.readout = readout
        self.lowerLabel = lowerLabel
        self.upperLabel = upperLabel
        self.style = style
        let digits = math.step == nil ? 2 : min(math.places, 6)
        self.format = format ?? { Double($0).formatted(.number.precision(.fractionLength(0...digits))) }
    }

    public init<F: FormatStyle>(value: Binding<ClosedRange<V>>, in bounds: ClosedRange<V>, step: V.Stride? = nil, minimumDistance: V = 0, readout: Readout = .thumbs, lowerLabel: String = "Minimum", upperLabel: String = "Maximum", style: Style = .standard, format: F) where F.FormatInput == V, F.FormatOutput == String {
        self.init(value: value, in: bounds, step: step, minimumDistance: minimumDistance, readout: readout, lowerLabel: lowerLabel, upperLabel: upperLabel, style: style, format: { format.format($0) })
    }

    // MARK: Geometry

    private var isRTL: Bool { direction == .rightToLeft }
    private var radius: CGFloat { style.thumbSize / 2 }
    private var target: CGFloat { max(44, style.thumbSize) }
    private var usable: CGFloat { max(width - style.thumbSize, 1) }

    /// The bound range, clamped into bounds and ordered, as doubles.
    private var current: (lower: Double, upper: Double) {
        math.normalized(Double(value.lowerBound), Double(value.upperBound))
    }

    /// Thumb center for a value, in a left-to-right space. Right-to-left flips the fraction, so the lower thumb sits on the right.
    private func x(for v: Double) -> CGFloat {
        let fraction = CGFloat(math.fraction(v))
        return radius + (isRTL ? 1 - fraction : fraction) * usable
    }

    private func value(atX x: CGFloat) -> Double {
        let fraction = Double(min(max((x - radius) / usable, 0), 1))
        return math.value(atFraction: isRTL ? 1 - fraction : fraction)
    }

    private var motion: Animation { reduceMotion ? .smooth(duration: 0.15) : .spring(duration: 0.3, bounce: 0.3) }

    // MARK: Body

    public var body: some View {
        let (lower, upper) = current
        let lowerX = x(for: lower), upperX = x(for: upper)

        VStack(alignment: .leading, spacing: 10) {
            if readout == .header {
                header(lower: lower, upper: upper)
            }
            VStack(spacing: 8) {
                if readout == .thumbs {
                    chips(lower: lower, upper: upper, lowerX: lowerX, upperX: upperX)
                }
                track(lower: lower, upper: upper, lowerX: lowerX, upperX: upperX)
            }
            // Geometry runs in a fixed left-to-right space; `x(for:)` mirrors it for right-to-left.
            .environment(\.layoutDirection, .leftToRight)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        }
        .accessibilityElement(children: .contain)
        .saturation(isEnabled ? 1 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion, value: active)
        .sensoryFeedback(.selection, trigger: selectionTick)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.8), trigger: impactTick)
        .onChange(of: isEnabled) { _, enabled in
            if !enabled { endDrag() }
        }
    }

    // MARK: Header

    private func header(lower: Double, upper: Double) -> some View {
        let values = [Text(format(V(lower))), Text("–").foregroundStyle(style.secondaryLabel), Text(format(V(upper)))]
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { ForEach(values.indices, id: \.self) { values[$0] } }
            VStack(alignment: .leading, spacing: 2) { ForEach(values.indices, id: \.self) { values[$0] } }
        }
        .font(.title3.weight(.semibold).monospacedDigit())
        .foregroundStyle(style.label)
        .contentTransition(active == nil ? .numericText() : .identity)
        .accessibilityHidden(true)
    }

    // MARK: Readout chips

    private func chips(lower: Double, upper: Double, lowerX: CGFloat, upperX: CGFloat) -> some View {
        let gap: CGFloat = 6
        let lowerCenter = clampCenter(lowerX, chip: lowerChipWidth)
        let upperCenter = clampCenter(upperX, chip: upperChipWidth)
        // Left and right in screen space: in right-to-left the upper chip sits on the left.
        let (leftCenter, leftWidth, rightCenter, rightWidth) = isRTL
            ? (upperCenter, upperChipWidth, lowerCenter, lowerChipWidth)
            : (lowerCenter, lowerChipWidth, upperCenter, upperChipWidth)
        let merged = leftCenter + leftWidth / 2 + gap > rightCenter - rightWidth / 2
        let mergedCenter = clampCenter((lowerX + upperX) / 2, chip: mergedChipWidth)
        let lowerText = format(V(lower)), upperText = format(V(upper))

        return ZStack(alignment: .leading) {
            chip(lowerText, lit: active == .lower)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { lowerChipWidth = $0 }
                .offset(x: lowerCenter - lowerChipWidth / 2)
                .opacity(merged ? 0 : 1)
            chip(upperText, lit: active == .upper)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { upperChipWidth = $0 }
                .offset(x: upperCenter - upperChipWidth / 2)
                .opacity(merged ? 0 : 1)
            // The chip lays out in the caller's direction, so right-to-left readers see the lower value on the right.
            chip(lowerText, upperText, lit: active != nil)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { mergedChipWidth = $0 }
                .offset(x: mergedCenter - mergedChipWidth / 2)
                .opacity(merged ? 1 : 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(reduceMotion ? nil : .smooth(duration: 0.18), value: merged)
        .accessibilityHidden(true)
    }

    private func clampCenter(_ x: CGFloat, chip: CGFloat) -> CGFloat {
        guard width > chip else { return width / 2 }
        return min(max(x, chip / 2), width - chip / 2)
    }

    /// One value, or two values with a dash between them, on a capsule that fills with the block color while its thumb is held.
    private func chip(_ first: String, _ second: String? = nil, lit: Bool) -> some View {
        HStack(spacing: 5) {
            Text(first)
            if let second {
                Text("–").opacity(0.6)
                Text(second)
            }
        }
        .font(.footnote.weight(.semibold).monospacedDigit())
        .lineLimit(1)
        .foregroundStyle(lit ? style.ink : style.label)
        .environment(\.layoutDirection, direction)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(lit ? style.fill : style.chip, in: .capsule)
        .fixedSize()
    }

    // MARK: Track

    private func track(lower: Double, upper: Double, lowerX: CGFloat, upperX: CGFloat) -> some View {
        let spanStart = min(lowerX, upperX), spanEnd = max(lowerX, upperX)
        let overhang = max(0, (target - style.thumbSize) / 2)
        return ZStack(alignment: .leading) {
            ZStack(alignment: .leading) {
                Rectangle().fill(style.track)
                Rectangle()
                    .fill(style.fill)
                    .frame(width: spanEnd - spanStart)
                    .offset(x: spanStart)
            }
            .frame(height: style.trackHeight)
            .clipShape(.capsule)

            thumb(.lower, at: lowerX, value: lower)
            thumb(.upper, at: upperX, value: upper)
        }
        .frame(height: target)
        .frame(maxWidth: .infinity)
        // Extend the touch area so the 44pt target of a thumb at either end still counts.
        .contentShape(Rectangle().inset(by: -overhang))
        .gesture(drag(lowerX: lowerX, upperX: upperX), isEnabled: isEnabled && math.span > 0)
    }

    private func thumb(_ which: Thumb, at x: CGFloat, value: Double) -> some View {
        let grabbed = active == which
        let label = which == .lower ? lowerLabel : upperLabel
        return Circle()
            .fill(style.thumb)
            .overlay { Circle().strokeBorder(style.thumbBorder, lineWidth: grabbed ? 3 : 2) }
            .frame(width: style.thumbSize, height: style.thumbSize)
            .shadow(color: .black.opacity(grabbed ? 0.22 : 0.12), radius: grabbed ? 6 : 3, y: grabbed ? 3 : 1)
            .scaleEffect(grabbed && !reduceMotion ? 1.18 : 1)
            .frame(width: target, height: target)
            .contentShape(.rect)
            .offset(x: x - target / 2)
            .zIndex(grabbed ? 1 : 0)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(format(V(value)))
            .accessibilityAdjustableAction { direction in
                adjust(which, up: direction == .increment)
            }
            .accessibilitySortPriority(which == .lower ? 2 : 1)
    }

    // MARK: Interaction

    private func drag(lowerX: CGFloat, upperX: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { drag in
                if active == nil && !isPending {
                    begin(at: drag.startLocation.x, lowerX: lowerX, upperX: upperX)
                }
                if isPending {
                    // Both thumbs under the finger: the first clear movement picks the one that can go that way.
                    let dx = drag.translation.width
                    guard abs(dx) > 3 else { return }
                    let which: Thumb = (isRTL ? -dx : dx) > 0 ? .upper : .lower
                    isPending = false
                    active = which
                    isPinned = math.isAtLimit(isLower: which == .lower, current.lower, current.upper)
                }
                guard let active else { return }
                let raw = value(atX: drag.location.x - grabOffset)
                withAnimation(reduceMotion ? nil : .interactiveSpring(duration: 0.18, extraBounce: 0)) {
                    set(active, to: raw, feedback: true)
                }
            }
            .onEnded { _ in endDrag() }
    }

    private func begin(at x: CGFloat, lowerX: CGFloat, upperX: CGFloat) {
        let hit = target / 2
        let toLower = abs(x - lowerX), toUpper = abs(x - upperX)
        if abs(lowerX - upperX) < 6 && min(toLower, toUpper) <= hit {
            isPending = true
            grabOffset = x - lowerX
            return
        }
        let which: Thumb
        if toLower == toUpper {
            // Stacked thumbs touched from the side: the side decides.
            which = (x > lowerX) != isRTL ? .upper : .lower
        } else {
            which = toLower < toUpper ? .lower : .upper
        }
        let thumbX = which == .lower ? lowerX : upperX
        // On a thumb, keep the finger's offset so it does not jump; on the track, the thumb comes to the finger.
        grabOffset = abs(x - thumbX) <= hit ? x - thumbX : 0
        active = which
        isPinned = math.isAtLimit(isLower: which == .lower, current.lower, current.upper)
    }

    private func endDrag() {
        active = nil
        isPending = false
        grabOffset = 0
    }

    /// VoiceOver: one `step` (or 1% of the span) to the next valid value in that direction.
    private func adjust(_ which: Thumb, up: Bool) {
        guard isEnabled else { return }
        let (lower, upper) = current
        set(which, to: math.stepped(which == .lower ? lower : upper, up: up), feedback: false)
    }

    private func set(_ which: Thumb, to raw: Double, feedback: Bool) {
        let (lower, upper) = current
        let result = math.resolve(isLower: which == .lower, raw: raw, lower: lower, upper: upper)
        let next = which == .lower ? V(result.value)...V(max(result.value, upper)) : V(min(lower, result.value))...V(result.value)
        guard next != value else { return }
        let before = which == .lower ? lower : upper
        value = next
        guard feedback else { return }
        if result.atLimit && !isPinned {
            impactTick += 1
        } else if math.crossesTick(from: before, to: result.value) {
            // Throttled so a fast flick over fine steps does not buzz continuously.
            let now = Date()
            if now.timeIntervalSince(lastTick) > 0.035 {
                lastTick = now
                selectionTick += 1
            }
        }
        isPinned = result.atLimit
    }
}

/// Range math in doubles: snapping, the gap between thumbs, and decimal cleanup. Pure and unit-testable.
private struct RangeMath: Sendable {
    let lo: Double
    let hi: Double
    let step: Double?
    let gap: Double
    /// Decimal places of the step and lower bound, used to strip binary drift. 12 or more means "do not round".
    let places: Int

    nonisolated init(lower: Double, upper: Double, step: Double?, gap: Double) {
        let lo = min(lower, upper), hi = max(lower, upper)
        self.lo = lo
        self.hi = hi
        self.step = step.flatMap { $0 > 0 && $0.isFinite ? $0 : nil }
        self.gap = min(max(gap, 0), hi - lo)
        self.places = self.step.map { max(Self.decimals($0), Self.decimals(lo)) } ?? 12
    }

    nonisolated var span: Double { hi - lo }

    nonisolated static func decimals(_ x: Double) -> Int {
        var scaled = abs(x)
        for places in 0..<12 {
            if abs(scaled - scaled.rounded()) <= max(1e-9, scaled * 1e-12) { return places }
            scaled *= 10
        }
        return 12
    }

    nonisolated func tidy(_ x: Double) -> Double {
        guard places < 12 else { return x }
        let scale = pow(10, Double(places))
        return (x * scale).rounded() / scale
    }

    nonisolated func fraction(_ v: Double) -> Double { span > 0 ? min(max((v - lo) / span, 0), 1) : 0 }
    nonisolated func value(atFraction f: Double) -> Double { lo + f * span }

    nonisolated func normalized(_ a: Double, _ b: Double) -> (lower: Double, upper: Double) {
        let a = a.isFinite ? min(max(a, lo), hi) : lo
        let b = b.isFinite ? min(max(b, lo), hi) : hi
        return (min(a, b), max(a, b))
    }

    /// The nearest step point or bound, so both ends stay reachable when the span is not a multiple of the step.
    nonisolated func snap(_ raw: Double) -> Double {
        let clamped = min(max(raw.isFinite ? raw : lo, lo), hi)
        guard let step else { return clamped }
        let grid = tidy(lo + ((clamped - lo) / step).rounded() * step)
        if hi - clamped < abs(clamped - grid) { return hi }
        return min(max(grid, lo), hi)
    }

    /// Largest step point at or below `x` (strictly below when `strict`).
    nonisolated func gridFloor(_ x: Double, strict: Bool = false) -> Double {
        guard let step else { return x }
        let n = strict ? ((x - lo) / step - 1e-7).rounded(.up) - 1 : ((x - lo) / step + 1e-7).rounded(.down)
        return max(tidy(lo + n * step), lo)
    }

    /// Smallest step point at or above `x` (strictly above when `strict`), or the upper bound.
    nonisolated func gridCeil(_ x: Double, strict: Bool = false) -> Double {
        guard let step else { return x }
        let n = strict ? ((x - lo) / step + 1e-7).rounded(.down) + 1 : ((x - lo) / step - 1e-7).rounded(.up)
        return min(tidy(lo + n * step), hi)
    }

    /// How far the lower value may go given the upper one, kept on the step grid.
    nonisolated func ceiling(upper: Double) -> Double {
        let limit = upper - gap
        if step == nil || limit >= hi { return max(lo, min(limit, upper)) }
        return max(lo, min(gridFloor(limit), upper))
    }

    /// How far the upper value may go given the lower one, kept on the step grid.
    nonisolated func floor(lower: Double) -> Double {
        let limit = lower + gap
        if step == nil || limit <= lo { return min(hi, max(limit, lower)) }
        return min(hi, max(gridCeil(limit), lower))
    }

    /// Where a dragged thumb lands, and whether it sits against a bound or the other thumb.
    nonisolated func resolve(isLower: Bool, raw: Double, lower: Double, upper: Double) -> (value: Double, atLimit: Bool) {
        let snapped = snap(raw)
        if isLower {
            let limit = ceiling(upper: upper)
            let v = min(snapped, limit)
            return (v, v <= lo || v >= limit)
        } else {
            let limit = floor(lower: lower)
            let v = max(snapped, limit)
            return (v, v >= hi || v <= limit)
        }
    }

    nonisolated func isAtLimit(isLower: Bool, _ lower: Double, _ upper: Double) -> Bool {
        isLower ? lower <= lo || lower >= ceiling(upper: upper) : upper >= hi || upper <= floor(lower: lower)
    }

    /// The next valid value one step away: the neighboring step point, or 1% of the span without a step.
    nonisolated func stepped(_ v: Double, up: Bool) -> Double {
        guard step != nil else { return v + (up ? 1 : -1) * span / 100 }
        return up ? gridCeil(v, strict: true) : gridFloor(v, strict: true)
    }

    /// Selection ticks: every change with a step, every 5% of the span without one.
    nonisolated func crossesTick(from a: Double, to b: Double) -> Bool {
        guard a != b else { return false }
        guard step == nil, span > 0 else { return true }
        return (fraction(a) * 20).rounded(.down) != (fraction(b) * 20).rounded(.down)
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

/// A price filter with a header readout, and an age range whose chips merge as the thumbs meet the five-year gap.
private struct RangeSliderExample: View {
    @State private var price: ClosedRange<Double> = 120...480
    @State private var age: ClosedRange<Double> = 24...41

    var body: some View {
        VStack(alignment: .leading, spacing: 40) {
            RangeSlider(value: $price, in: 0...1000, step: 10, readout: .header, lowerLabel: "Minimum price", upperLabel: "Maximum price", format: .currency(code: "USD").precision(.fractionLength(0)))
            RangeSlider(value: $age, in: 18...80, step: 1, minimumDistance: 5, lowerLabel: "Youngest age", upperLabel: "Oldest age", style: .init(fill: adaptive(light: 0xA9DCB7, dark: 0xA9DCB7))) { "\(Int($0))" }
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    RangeSliderExample()
}

#Preview("Dark") {
    RangeSliderExample()
        .preferredColorScheme(.dark)
}
