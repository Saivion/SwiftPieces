// swiftpieces:
// title: Scrub Stepper
// description: A capsule stepper with round minus and plus buttons around a solid numeral block; tap, hold to repeat with acceleration, or scrub sideways across the block for velocity-scaled steps while a ruler slides under the finger, and the capsule rubber-bands at the bounds.
// category: inputs
// pro: glass-sheet
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [stepper, scrub, drag, haptic, numeric]

import SwiftUI

/// Minus/plus stepper with hold-to-repeat and a horizontal scrub gesture.
///
/// - Parameters:
///   - value: Bound integer value.
///   - range: Allowed values. Pushing past a bound nudges the capsule 6pt and fires a rigid impact instead of moving.
///   - step: Amount added or removed per tap, repeat tick, or scrub unit.
///   - style: Colors and size. Defaults to the Swift Pieces house palette (a butter numeral block with dark ink), adapting to light and dark.
public struct ScrubStepper: View {
    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The capsule behind everything.
        public var trough: Color
        /// The round minus and plus buttons at rest.
        public var button: Color
        /// Glyphs on the buttons.
        public var glyph: Color
        /// The numeral block, a solid color.
        public var block: Color
        /// Numeral and ruler on the block.
        public var ink: Color
        /// Capsule height. The buttons and block inset 5pt from it.
        public var height: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(trough: Color? = nil, button: Color? = nil, glyph: Color? = nil, block: Color? = nil, ink: Color? = nil, height: CGFloat = 52) {
            self.trough = trough ?? adaptive(light: 0xE6E4DE, dark: 0x262626)
            self.button = button ?? adaptive(light: 0xFFFFFF, dark: 0x3A3A3A)
            self.glyph = glyph ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.block = block ?? adaptive(light: 0xFFD976, dark: 0xFFD976)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.height = max(height, 44)
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .title2) private var numeralSize: CGFloat = 22
    @Binding private var value: Int
    @State private var phase: Phase = .idle
    @State private var holdTask: Task<Void, Never>?
    @State private var didRepeat = false
    @State private var scrubAnchor: CGFloat = 0
    @State private var rulerShift: CGFloat = 0
    @State private var nudge: CGFloat = 0
    @State private var rigidTick = 0
    @State private var minusBounce = 0
    @State private var plusBounce = 0
    @State private var width: CGFloat = 0

    private let range: ClosedRange<Int>
    private let step: Int
    private let style: Style
    private var height: CGFloat { style.height }
    private var buttonWidth: CGFloat { style.height }
    private let inset: CGFloat = 5

    private enum Phase: Equatable { case idle, pressing(delta: Int), scrubbing, cancelled }

    public init(value: Binding<Int>, in range: ClosedRange<Int> = 0...99, step: Int = 1, style: Style = .standard) {
        self._value = value
        self.range = range
        self.step = max(step, 1)
        self.style = style
    }

    public var body: some View {
        HStack(spacing: 0) {
            glyph("minus", delta: -step, enabled: value > range.lowerBound, bounce: minusBounce)
            well
            glyph("plus", delta: step, enabled: value < range.upperBound, bounce: plusBounce)
        }
        .frame(height: height)
        .background(style.trough, in: .capsule)
        .offset(x: nudge)
        .contentShape(.rect)
        .gesture(gesture, isEnabled: isEnabled)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .saturation(isEnabled ? 1 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(trigger: value) { old, new in
            phase == .scrubbing ? .selection : (new > old ? .increase : .decrease)
        }
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: rigidTick)
        .accessibilityElement(children: .ignore)
        .accessibilityValue("\(value)")
        .accessibilityAdjustableAction { adjust($0 == .increment ? step : -step) }
        .onChange(of: value) { old, new in
            if new > old { plusBounce += 1 } else { minusBounce += 1 }
        }
        .onDisappear { cancelHold() }
    }

    /// The value sits on a solid block so it reads as the thing being scrubbed. While scrubbing, the block widens and a ruler slides along its bottom edge.
    private var well: some View {
        let scrubbing = phase == .scrubbing
        let shape = RoundedRectangle(cornerRadius: min((height - inset * 2) / 2, 14), style: .continuous)
        return Text("\(value)")
            .font(.system(size: numeralSize, weight: .semibold, design: .rounded).monospacedDigit())
            .foregroundStyle(style.ink)
            .contentTransition(.numericText(value: Double(value)))
            .lineLimit(1)
            .padding(.horizontal, scrubbing && !reduceMotion ? 20 : 14)
            .frame(minWidth: 64)
            .frame(height: height - inset * 2)
            .background(style.block, in: shape)
            .overlay(alignment: .bottom) {
                Canvas { context, size in
                    // Ticks every 7pt (two per step), shifted by the unconsumed scrub distance.
                    let spacing: CGFloat = 7
                    var x = rulerShift.truncatingRemainder(dividingBy: spacing * 2) - spacing * 2
                    var index = 0
                    while x < size.width + spacing {
                        let tall = index % 2 == 0
                        context.fill(Path(roundedRect: CGRect(x: x, y: size.height - (tall ? 7 : 4), width: 1.5, height: tall ? 7 : 4), cornerRadius: 0.75), with: .color(style.ink.opacity(0.4)))
                        x += spacing
                        index += 1
                    }
                }
                .frame(height: 9)
                .padding(.horizontal, 8)
                .padding(.bottom, 3)
                .mask(LinearGradient(colors: [.clear, .black, .black, .clear], startPoint: .leading, endPoint: .trailing))
                .opacity(scrubbing ? 1 : 0)
                .accessibilityHidden(true)
            }
            .clipShape(shape)
            .scaleEffect(scrubbing && !reduceMotion ? 1.04 : 1)
            .animation(reduceMotion ? nil : .snappy(duration: 0.25), value: value)
            .animation(.spring(duration: 0.3, bounce: 0.3), value: scrubbing)
    }

    private func glyph(_ symbol: String, delta: Int, enabled: Bool, bounce: Int) -> some View {
        let pressed = phase == .pressing(delta: delta)
        let size = height - inset * 2
        return Image(systemName: symbol)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(pressed ? style.button : style.glyph)
            .symbolEffect(.bounce, value: bounce)
            .frame(width: size, height: size)
            .background(pressed ? style.glyph : style.button, in: Circle())
            .shadow(color: .black.opacity(enabled && !pressed ? 0.08 : 0), radius: 3, y: 1)
            .opacity(enabled ? 1 : 0.35)
            .scaleEffect(pressed && !reduceMotion ? 0.86 : 1)
            .frame(width: buttonWidth, height: height)
            .animation(.spring(duration: 0.3, bounce: 0.35), value: pressed)
            .animation(.smooth(duration: 0.2), value: enabled)
    }

    private var gesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { drag in
                switch phase {
                case .idle:
                    let x = drag.startLocation.x
                    if x < buttonWidth {
                        beginPress(-step)
                    } else if x > width - buttonWidth {
                        beginPress(step)
                    } else {
                        beginScrub(at: drag.location.x)
                    }
                case .pressing:
                    let slop = CGRect(x: -20, y: -20, width: width + 40, height: height + 40)
                    if abs(drag.translation.width) > 14 {
                        // A sideways move on a button turns into a scrub.
                        cancelHold()
                        beginScrub(at: drag.location.x)
                    } else if !slop.contains(drag.location) {
                        cancelHold()
                        phase = .cancelled
                    }
                case .scrubbing:
                    scrub(to: drag.location.x, velocity: drag.velocity.width)
                case .cancelled:
                    break
                }
            }
            .onEnded { _ in
                if case .pressing(let delta) = phase, !didRepeat { adjust(delta) }
                cancelHold()
                phase = .idle
                withAnimation(reduceMotion ? nil : .spring(duration: 0.4, bounce: 0.4)) { nudge = 0 }
            }
    }

    /// Touch-down on a button: after a short hold, repeat at 100ms, then 60ms after 1.5s, then 30ms after 3s.
    private func beginPress(_ delta: Int) {
        phase = .pressing(delta: delta)
        didRepeat = false
        holdTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            let start = ContinuousClock.now
            while !Task.isCancelled {
                didRepeat = true
                adjust(delta)
                let held = ContinuousClock.now - start
                let interval: Duration = held < .seconds(1.5) ? .milliseconds(100) : held < .seconds(3) ? .milliseconds(60) : .milliseconds(30)
                try? await Task.sleep(for: interval)
            }
        }
    }

    private func cancelHold() {
        holdTask?.cancel()
        holdTask = nil
    }

    private func beginScrub(at x: CGFloat) {
        phase = .scrubbing
        scrubAnchor = x
        rulerShift = 0
    }

    /// One step per 14pt of travel, scaled by velocity so a flick covers more ground than a slow drag.
    private func scrub(to x: CGFloat, velocity: CGFloat) {
        let pointsPerStep: CGFloat = 14
        let gain = 1 + min(abs(velocity) / 600, 3)
        let steps = Int(((x - scrubAnchor) * gain / pointsPerStep).rounded(.towardZero))
        rulerShift = (x - scrubAnchor) * gain
        guard steps != 0 else { return }
        scrubAnchor += CGFloat(steps) * pointsPerStep / gain
        adjust(steps * step)
    }

    private func adjust(_ delta: Int) {
        let next = min(max(value + delta, range.lowerBound), range.upperBound)
        guard next != value else {
            // At a bound: stop repeating and push the capsule instead of the value.
            cancelHold()
            if nudge == 0 {
                rigidTick += 1
                withAnimation(reduceMotion ? nil : .spring(duration: 0.3, bounce: 0.5)) { nudge = delta > 0 ? 6 : -6 }
            }
            return
        }
        value = next
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

/// The stepper on its own, in the house block and in a second block color.
private struct ScrubStepperExample: View {
    @State private var guests = 4
    @State private var chairs = 1

    var body: some View {
        VStack(spacing: 24) {
            ScrubStepper(value: $guests, in: 1...10)
                .accessibilityLabel("Guests")
            ScrubStepper(value: $chairs, in: 0...3, style: .init(block: adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)))
                .accessibilityLabel("High chairs")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    ScrubStepperExample()
}

#Preview("Dark") {
    ScrubStepperExample()
        .preferredColorScheme(.dark)
}
