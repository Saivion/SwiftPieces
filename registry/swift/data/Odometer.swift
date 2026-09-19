// swiftpieces:
// title: Odometer
// description: A number whose digits roll on individual slots like a mechanical counter, carrying from the low digits up so unchanged digits never move, with softened slot edges while rolling, dimmed decimals, a separate sign, a solid delta block, and a dashed loading state.
// category: data
// version: "2.0.0"
// pro: dashboard-screen
// minIOSVersion: "17.0"
// tags: [number, counter, digits, roll, currency, balance]

import SwiftUI

/// Slot-machine number with a single spring-driven `Animatable` value behind every digit.
///
/// - Parameters:
///   - value: The target value. Changing it rolls the digits from the current value.
///   - format: A decimal `FormatStyle` from `Double` to `String`, for example `.number.precision(.fractionLength(0))` or `.currency(code: "USD")`. Defaults to whole numbers.
///   - isLoading: Shows a dash in every digit slot instead of a value; the first real value rolls up from zero.
///   - showsDelta: Shows a signed delta pill next to the number for a moment after each change.
///   - ticksOnSettle: Plays a `.selection` haptic when a roll finishes.
///   - style: Delta block colors, decimal dimming, and roll tinting. Defaults to `.standard`: sage for up, tangerine for down, dimmed decimals, no tint while rolling.
public struct Odometer<Format: FormatStyle>: View where Format.FormatInput == Double, Format.FormatOutput == String {
    /// Delta and decimal styling. See `OdometerStyle`.
    public typealias Style = OdometerStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animated: Double = 0
    @State private var template: [Glyph] = []
    @State private var fractionDigits = 0
    @State private var slotSize = CGSize(width: 12, height: 20)
    @State private var rollingTint: Color?
    @State private var delta: Double = 0
    @State private var deltaShown = false
    @State private var deltaTask: Task<Void, Never>?
    @State private var settles = 0
    @State private var wasLoading = true

    private let value: Double
    private let format: Format
    private let isLoading: Bool
    private let showsDelta: Bool
    private let ticksOnSettle: Bool
    private let style: Style

    public init(value: Double, format: Format, isLoading: Bool = false, showsDelta: Bool = true, ticksOnSettle: Bool = false, style: Style = .standard) {
        self.value = value
        self.format = format
        self.isLoading = isLoading
        self.showsDelta = showsDelta
        self.ticksOnSettle = ticksOnSettle
        self.style = style
    }

    public init(value: Double, isLoading: Bool = false, showsDelta: Bool = true, ticksOnSettle: Bool = false, style: Style = .standard) where Format == FloatingPointFormatStyle<Double> {
        self.init(value: value, format: .number.precision(.fractionLength(0)), isLoading: isLoading, showsDelta: showsDelta, ticksOnSettle: ticksOnSettle, style: style)
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Tape(scaled: animated, template: template, slot: slotSize, loading: isLoading, tint: rollingTint, dim: style.dimsFraction ? style.muted : nil)
                // The number never gives up width to the pill; separators and symbols would truncate first.
                .layoutPriority(1)
            if showsDelta, deltaShown, !isLoading {
                deltaPill
            }
        }
        .monospacedDigit()
        .animation(.snappy(duration: 0.3), value: deltaShown)
        .animation(.easeOut(duration: 0.35), value: rollingTint)
        .background {
            // One measurement for every slot: digits are monospaced.
            Text("0").hidden().fixedSize()
                .background { GeometryReader { proxy in Color.clear.onAppear { slotSize = proxy.size }.onChange(of: proxy.size) { _, new in slotSize = new } } }
        }
        .sensoryFeedback(.selection, trigger: settles) { _, _ in ticksOnSettle }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isLoading ? "Loading" : format.format(value))
        .onAppear { retarget(from: nil) }
        .onChange(of: value) { old, _ in retarget(from: old) }
        .onChange(of: isLoading) { _, loading in if !loading { retarget(from: nil) } }
    }

    private var deltaPill: some View {
        let up = delta >= 0
        return HStack(spacing: 3) {
            Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 11, weight: .heavy))
            Text((up ? "+" : "−") + format.format(abs(delta)))
        }
        .font(.system(size: 14, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(style.ink)
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(up ? style.up : style.down, in: Capsule())
        .fixedSize()
        .transition(.scale(scale: 0.7, anchor: .leading).combined(with: .opacity))
    }

    // MARK: Rolling

    private func retarget(from old: Double?) {
        guard !isLoading else {
            let layout = Self.layout(for: abs(value), format: format)
            template = layout.glyphs
            fractionDigits = layout.fractionDigits
            wasLoading = true
            return
        }
        let start = wasLoading ? 0 : (old ?? value)
        wasLoading = false
        // Lay out for the larger magnitude so a shrinking number keeps its high slots until it settles.
        let layout = Self.layout(for: max(abs(start), abs(value)), format: format)
        fractionDigits = layout.fractionDigits
        let target = (value * pow(10, Double(layout.fractionDigits))).rounded()
        let change = target - animated
        withAnimation(.snappy(duration: 0.25)) { template = layout.glyphs }
        guard change != 0 else { return }
        if let old, old != value {
            delta = value - old
            deltaShown = true
            deltaTask?.cancel()
            deltaTask = Task {
                try? await Task.sleep(for: .seconds(1.6))
                if !Task.isCancelled { deltaShown = false }
            }
        }
        rollingTint = style.tintsWhileRolling ? (change > 0 ? style.up : style.down) : nil
        let spring: Animation = reduceMotion ? .easeInOut(duration: 0.25) : .smooth(duration: min(1.2, 0.5 + Double(abs(change)).squareRoot() * 0.01))
        withAnimation(spring, completionCriteria: .logicallyComplete) {
            animated = target
        } completion: {
            rollingTint = nil
            settles += 1
            let final = Self.layout(for: abs(value), format: format)
            withAnimation(.snappy(duration: 0.25)) { template = final.glyphs }
        }
    }

    /// Reads the formatted string once to learn where digits, separators, and symbols sit.
    private static func layout(for magnitude: Double, format: Format) -> (glyphs: [Glyph], fractionDigits: Int) {
        let chars = Array(format.format(magnitude))
        let separator = Array(Locale.current.decimalSeparator ?? ".")
        // The decimal separator is the last one followed by at least one digit.
        var fraction: Range<Int>?
        var scan = chars.count - separator.count
        while scan >= 0, fraction == nil {
            if Array(chars[scan..<scan + separator.count]) == separator, scan + separator.count < chars.count, chars[scan + separator.count].isNumber {
                var end = scan + separator.count
                while end < chars.count, chars[end].isNumber { end += 1 }
                fraction = (scan + separator.count)..<end
            }
            scan -= 1
        }
        let fractionDigits = fraction?.count ?? 0
        let integerEnd = fraction.map { $0.lowerBound - separator.count } ?? chars.count
        let integerIndices = chars.indices.filter { $0 < integerEnd && chars[$0].isNumber }
        let firstDigit = integerIndices.first ?? chars.count
        let lastDigit = fraction?.upperBound ?? ((integerIndices.last ?? -1) + 1)

        var glyphs: [Glyph] = []
        for (index, char) in chars.enumerated() {
            if let place = integerIndices.firstIndex(of: index) {
                let position = fractionDigits + (integerIndices.count - 1 - place)
                glyphs.append(Glyph(id: position, kind: .digit(position: position, integer: true)))
            } else if let fraction, fraction.contains(index) {
                let position = fractionDigits - 1 - (index - fraction.lowerBound)
                glyphs.append(Glyph(id: position, kind: .digit(position: position, integer: false)))
            } else if index < firstDigit {
                glyphs.append(Glyph(id: 3000 + index, kind: .literal(String(char))))
            } else if index >= lastDigit {
                glyphs.append(Glyph(id: 4000 + (chars.count - index), kind: .literal(String(char))))
            } else {
                let digitsToRight = integerIndices.filter { $0 > index }.count
                let id = fraction.map { index >= $0.lowerBound - separator.count } == true ? 1000 : 2000 + digitsToRight
                glyphs.append(Glyph(id: id, kind: .literal(String(char))))
            }
        }
        return (glyphs, fractionDigits)
    }

    private struct Glyph: Identifiable, Equatable {
        enum Kind: Equatable { case digit(position: Int, integer: Bool), literal(String) }
        let id: Int
        let kind: Kind
    }

    /// Every digit derives its roll from one animatable number, carrying upward only while the digit below passes 9.
    private struct Tape: View, Animatable {
        var scaled: Double
        let template: [Glyph]
        let slot: CGSize
        let loading: Bool
        let tint: Color?
        let dim: Color?

        nonisolated var animatableData: Double {
            get { scaled }
            set { scaled = newValue }
        }

        var body: some View {
            let magnitude = abs(scaled)
            let rolls = Dictionary(uniqueKeysWithValues: template.compactMap { glyph -> (Int, Double)? in
                if case .digit(let position, _) = glyph.kind { return (position, roll(position, magnitude)) }
                return nil
            })
            let visibility = leadingVisibility(rolls: rolls)
            HStack(spacing: 0) {
                if scaled < -0.5, !loading {
                    Text("−").transition(.move(edge: .leading).combined(with: .opacity))
                }
                ForEach(Array(template.enumerated()), id: \.element.id) { index, glyph in
                    let reveal = visibility[index]
                    switch glyph.kind {
                    case .digit(let position, let integer):
                        DigitSlot(roll: rolls[position] ?? 0, slot: slot, loading: loading)
                            .frame(width: slot.width * reveal, height: slot.height, alignment: .trailing)
                            .foregroundStyle(dimmed(!integer))
                            .opacity(reveal)
                            .transition(.opacity)
                    case .literal(let text):
                        Text(text)
                            .fixedSize()
                            .foregroundStyle(dimmed(glyph.id == 1000))
                            .opacity(reveal)
                            .transition(.opacity)
                    }
                }
            }
            .animation(.snappy(duration: 0.25), value: scaled < -0.5)
            .animation(.snappy(duration: 0.25), value: template)
        }

        /// Decimals and their separator sit back in the muted color unless the roll is tinted.
        private func dimmed(_ isFraction: Bool) -> AnyShapeStyle {
            if loading { return AnyShapeStyle(.tertiary) }
            if let tint { return AnyShapeStyle(tint) }
            if isFraction, let dim { return AnyShapeStyle(dim) }
            return AnyShapeStyle(.primary)
        }

        private func roll(_ position: Int, _ magnitude: Double) -> Double {
            let digit = (magnitude / pow(10, Double(position))).rounded(.down).truncatingRemainder(dividingBy: 10)
            if position == 0 { return magnitude.truncatingRemainder(dividingBy: 10) }
            let lower = roll(position - 1, magnitude)
            return digit + (lower >= 9 ? lower - 9 : 0)
        }

        /// High integer slots that still read zero collapse to nothing and grow in as the carry reaches them.
        private func leadingVisibility(rolls: [Int: Double]) -> [Double] {
            var result: [Double] = []
            var hidden = true
            var carry = 0.0
            let lastInteger = template.compactMap { glyph -> Int? in
                if case .digit(let position, true) = glyph.kind { return position }
                return nil
            }.min()
            for glyph in template {
                switch glyph.kind {
                case .digit(let position, let integer):
                    if hidden, integer, position != lastInteger, let roll = rolls[position], roll < 1 {
                        carry = roll
                        result.append(loading ? 1 : roll)
                    } else {
                        hidden = false
                        result.append(1)
                    }
                case .literal:
                    // Leading symbols such as a currency sign always show; separators between hidden slots fade with the carry.
                    let leadingSymbol = glyph.id >= 3000 && glyph.id < 4000
                    result.append(hidden && !loading && !leadingSymbol ? carry : 1)
                }
            }
            return result
        }
    }

    private struct DigitSlot: View {
        let roll: Double
        let slot: CGSize
        let loading: Bool

        var body: some View {
            let current = Int(roll.rounded(.down)) % 10
            let fraction = roll - roll.rounded(.down)
            ZStack {
                if loading {
                    Text("–")
                } else {
                    Text(String(current)).offset(y: -fraction * slot.height)
                    Text(String((current + 1) % 10)).offset(y: (1 - fraction) * slot.height)
                }
            }
            .frame(width: slot.width, height: slot.height)
            .clipped()
            // While a digit is between faces its slot edges soften, like a drum turning behind a window.
            .mask {
                if fraction > 0.001 {
                    LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.22), .init(color: .black, location: 0.78), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom)
                } else {
                    Rectangle()
                }
            }
        }
    }
}

/// Delta and decimal styling for `Odometer`, built from the Free house palette.
public struct OdometerStyle: Sendable {
    /// Delta block for a rise, and the roll tint when `tintsWhileRolling` is on.
    public var up: Color
    /// Delta block for a fall, and the roll tint when `tintsWhileRolling` is on.
    public var down: Color
    /// Text on the delta block.
    public var ink: Color
    /// Color of dimmed decimals.
    public var muted: Color
    /// Dims the decimal separator and fraction digits.
    public var dimsFraction: Bool
    /// Tints the digits with `up` or `down` until a roll settles; best on dark grounds.
    public var tintsWhileRolling: Bool

    public init(up: Color, down: Color, ink: Color, muted: Color, dimsFraction: Bool = true, tintsWhileRolling: Bool = false) {
        self.up = up
        self.down = down
        self.ink = ink
        self.muted = muted
        self.dimsFraction = dimsFraction
        self.tintsWhileRolling = tintsWhileRolling
    }

    /// Sage and tangerine delta blocks with ink, dimmed decimals, untinted digits. Copy it and change one property to customize.
    public static let standard = OdometerStyle(
        up: adaptive(0xA9DCB7, 0xA9DCB7),
        down: adaptive(0xFF5B3A, 0xFF5B3A),
        ink: adaptive(0x141414, 0x141414),
        muted: adaptive(0x8B8984, 0x6F6D69)
    )

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct OdometerExample: View {
    @State private var balance: Double = 12_480.55
    @State private var loading = true

    var body: some View {
        Odometer(value: balance, format: .currency(code: "USD"), isLoading: loading, ticksOnSettle: true)
            .font(.system(size: 48, weight: .light))
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OdometerStyle.adaptive(0xF3F2EE, 0x121212))
            // Drives the piece's own states: dashes while loading, then a deposit and a payment roll the digits.
            .task {
                try? await Task.sleep(for: .seconds(1))
                loading = false
                try? await Task.sleep(for: .seconds(2.4))
                balance += 517
                try? await Task.sleep(for: .seconds(2.4))
                balance -= 1_450
            }
    }
}

#Preview("Light") {
    OdometerExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    OdometerExample().preferredColorScheme(.dark)
}
