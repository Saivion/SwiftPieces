// swiftpieces:
// title: Timer Dial
// description: "A countdown ring you set by dragging its knob around like the Timer dial, with a tick per step and a heavier detent every 5s. A solid block ring over a minute-tick scale, light display numerals, a breathing signal warning zone, a sage finish, and a determinate progress mode."
// category: controls
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: focus-timer
// tags: [timer, countdown, dial, ring, progress, haptics]

import SwiftUI

/// Settable countdown ring, or a determinate progress ring with the same look.
///
/// - Parameters:
///   - seconds: Bound countdown length. Dragging around the ring while idle or paused rewrites it.
///   - isRunning: Set `true` to run, `false` to pause. Flips to `false` when the countdown finishes; set it back to `true` to restart.
///   - step: Seconds per dial detent. Every multiple of 5 plays a heavier tick.
///   - maxSeconds: Value at a full turn of the dial.
///   - warningAt: Remaining seconds at or below which the ring turns to `style.warning` and breathes.
///   - lineWidth: Ring thickness in points.
///   - colors: Overrides `style.fill`: one color for a flat ring, or several for an angular gradient. `nil` uses the style.
///   - caption: Text under the digits. Defaults to the phase (Ready, Remaining, Paused, Done).
///   - style: Ring, track, knob, tick, warning and finish colors plus the numeral size. `.standard` is the house palette with a tangerine ring.
///   - onFinish: Called once when the ring reaches zero.
///   - progress: Determinate mode: a 0–1 value with a percent readout and no clock.
public struct TimerDial: View {
    public enum Phase { case idle, running, paused, finished }
    private enum Mode { case countdown, progress(Double) }

    /// Colors and type for the dial. Colors adapt to light and dark.
    public struct Style: Sendable {
        /// The solid ring.
        public var fill: Color
        /// The unfilled track under the ring.
        public var track: Color
        /// Ring and digit color inside the warning zone.
        public var warning: Color
        /// Ring color once the countdown finishes.
        public var finished: Color
        /// The draggable knob at the leading edge of the ring.
        public var knob: Color
        /// Digits and caption.
        public var text: Color
        public var secondaryText: Color
        /// Draws a 60-tick scale inside the ring; ticks under the ring's value are brighter.
        public var showsTicks: Bool
        /// Base digit size, scaled with Dynamic Type relative to `.largeTitle`.
        public var digitSize: CGFloat

        public init(fill: Color = House.hex(0xFF5B3A), track: Color = House.adaptive(light: 0xEAE8E2, dark: 0x262626), warning: Color = House.hex(0xFF5B3A), finished: Color = House.hex(0xA9DCB7), knob: Color = House.adaptive(light: 0x141414, dark: 0xF4F3EF), text: Color = House.adaptive(light: 0x141414, dark: 0xF4F3EF), secondaryText: Color = House.adaptive(light: 0x5C5A56, dark: 0xA6A49F), showsTicks: Bool = true, digitSize: CGFloat = 52) {
            self.fill = fill
            self.track = track
            self.warning = warning
            self.finished = finished
            self.knob = knob
            self.text = text
            self.secondaryText = secondaryText
            self.showsTicks = showsTicks
            self.digitSize = digitSize
        }

        /// The Free house palette: tangerine ring, signal warning, sage finish.
        public static let standard = Style()
        /// The same dial with a sky ring, for secondary timers and progress.
        public static let sky = Style(fill: House.hex(0x9CC2FF))

        /// Builds house colors. Public so `Style` defaults can use it.
        public enum House {
            public static func hex(_ value: UInt32) -> Color {
                Color(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
            }

            public static func adaptive(light: UInt32, dark: UInt32) -> Color {
                Color(uiColor: UIColor { traits in
                    let v = traits.userInterfaceStyle == .dark ? dark : light
                    return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
                })
            }
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var digitScale: CGFloat = 1
    @Binding private var seconds: Int
    @Binding private var isRunning: Bool
    @State private var remainingAtPause: Double
    @State private var startedAt: Date?
    @State private var finishCount = 0
    @State private var dialTicks = 0
    @State private var detents = 0
    @State private var lastDialFraction: Double?

    private let mode: Mode
    private let step: Int
    private let maxSeconds: Int
    private let warningAt: Int
    private let lineWidth: CGFloat
    private let colors: [Color]?
    private let caption: String?
    private let style: Style
    private let onFinish: (() -> Void)?

    public init(seconds: Binding<Int>, isRunning: Binding<Bool>, step: Int = 1, maxSeconds: Int = 60, warningAt: Int = 5, lineWidth: CGFloat = 16, colors: [Color]? = nil, caption: String? = nil, style: Style = .standard, onFinish: (() -> Void)? = nil) {
        self.mode = .countdown
        self._seconds = seconds
        self._isRunning = isRunning
        self.step = max(step, 1)
        self.maxSeconds = max(maxSeconds, self.step)
        self.warningAt = warningAt
        self.lineWidth = lineWidth
        self.colors = colors?.isEmpty == true ? nil : colors
        self.caption = caption
        self.style = style
        self.onFinish = onFinish
        self._remainingAtPause = State(initialValue: Double(max(seconds.wrappedValue, 1)))
    }

    /// Determinate ring: no clock, no dial, a percent readout.
    public init(progress: Double, lineWidth: CGFloat = 16, colors: [Color]? = nil, caption: String? = nil, style: Style = .standard) {
        self.mode = .progress(min(max(progress, 0), 1))
        self._seconds = .constant(1)
        self._isRunning = .constant(false)
        self.step = 1
        self.maxSeconds = 1
        self.warningAt = -1
        self.lineWidth = lineWidth
        self.colors = colors?.isEmpty == true ? nil : colors
        self.caption = caption
        self.style = style
        self.onFinish = nil
        self._remainingAtPause = State(initialValue: 1)
    }

    private var phase: Phase {
        if startedAt != nil { return .running }
        if remainingAtPause <= 0 { return .finished }
        return remainingAtPause < Double(seconds) ? .paused : .idle
    }

    private var isSettable: Bool {
        if case .countdown = mode { return startedAt == nil }
        return false
    }

    private func remaining(at now: Date) -> Double {
        guard let startedAt else { return remainingAtPause }
        return max(0, remainingAtPause - now.timeIntervalSince(startedAt))
    }

    private var ringStyle: AnyShapeStyle {
        guard let colors else { return AnyShapeStyle(style.fill) }
        return colors.count > 1 ? AnyShapeStyle(AngularGradient(colors: colors, center: .center)) : AnyShapeStyle(colors[0])
    }

    public var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil, paused: startedAt == nil)) { context in
                let remaining = remaining(at: context.date)
                let shown = Int(remaining.rounded(.up))
                let finished = phase == .finished
                let warning = phase != .idle && !finished && shown <= warningAt
                let fraction: Double = {
                    if case .progress(let value) = mode { return value }
                    return remaining / Double(max(seconds, 1))
                }()
                let breathe = warning && phase == .running && !reduceMotion
                    ? 1 + 0.012 * sin(context.date.timeIntervalSinceReferenceDate * 2 * .pi)
                    : 1
                ZStack {
                    if style.showsTicks {
                        ticks(side: side, fraction: finished ? 1 : fraction)
                    }
                    ring(fraction: fraction, side: side, style: ringStyle)
                    // Warning and finish rings fade over the base ring, so the color eases instead of swapping.
                    ring(fraction: fraction, side: side, style: AnyShapeStyle(style.warning))
                        .opacity(warning ? 1 : 0)
                        .animation(.smooth(duration: 0.5), value: warning)
                    ring(fraction: 1, side: side, style: AnyShapeStyle(style.finished), knob: false)
                        .opacity(finished ? 1 : 0)
                        .scaleEffect(finished || reduceMotion ? 1 : 0.94)
                        .animation(.spring(duration: 0.5, bounce: 0.35), value: finished)
                    knob(fraction: fraction, side: side, visible: !finished && fraction > 0.005)
                }
                .rotationEffect(.degrees(-90))
                .scaleEffect(breathe)
                .overlay { readout(shown: shown, fraction: fraction, warning: warning, side: side) }
                .frame(width: side, height: side)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: shown) { _, _ in warning && phase == .running && !reduceMotion }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityLabel)
                .accessibilityValue(accessibilityValue(shown: shown, fraction: fraction))
                .accessibilityHint(isSettable ? "Swipe up or down to adjust" : "")
                .accessibilityAdjustableAction { direction in
                    guard isSettable else { return }
                    set(seconds + (direction == .increment ? step : -step))
                }
            }
            .contentShape(Circle())
            .gesture(dial(side: side), including: isSettable ? .all : .subviews)
        }
        .aspectRatio(1, contentMode: .fit)
        .sensoryFeedback(.selection, trigger: dialTicks)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: detents)
        .sensoryFeedback(.success, trigger: finishCount)
        .onChange(of: seconds) { _, new in remainingAtPause = Double(max(new, 1)); startedAt = nil }
        .task(id: isRunning) {
            guard case .countdown = mode else { return }
            if isRunning {
                if remainingAtPause <= 0 { remainingAtPause = Double(max(seconds, 1)) }
                startedAt = Date()
                try? await Task.sleep(for: .seconds(remainingAtPause))
                guard !Task.isCancelled else { return }
                remainingAtPause = 0
                startedAt = nil
                finishCount += 1
                isRunning = false
                onFinish?()
            } else if let startedAt {
                // Paused: bank the elapsed time so the next run continues from here.
                remainingAtPause = max(0, remainingAtPause - Date().timeIntervalSince(startedAt))
                self.startedAt = nil
            }
        }
    }

    // MARK: Drawing

    private func ring(fraction: Double, side: CGFloat, style shapeStyle: AnyShapeStyle, knob: Bool = true) -> some View {
        ZStack {
            Circle()
                .inset(by: lineWidth / 2)
                .stroke(style.track, lineWidth: lineWidth)
            Circle()
                .inset(by: lineWidth / 2)
                .trim(from: 0, to: fraction)
                .stroke(shapeStyle, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        }
        .animation(fractionAnimation, value: fraction)
    }

    /// The knob rides the leading edge: a solid disc with a soft shadow, larger while the dial can be set.
    private func knob(fraction: Double, side: CGFloat, visible: Bool) -> some View {
        let diameter = lineWidth + (isSettable ? 10 : 4)
        return Circle()
            .fill(style.knob)
            .frame(width: diameter, height: diameter)
            .shadow(color: .black.opacity(0.25), radius: 6, y: 2)
            .offset(x: (side - lineWidth) / 2)
            .rotationEffect(.degrees(fraction * 360))
            .scaleEffect(visible ? 1 : 0)
            .animation(.spring(duration: 0.35, bounce: 0.3), value: visible)
            .animation(.spring(duration: 0.3, bounce: 0.2), value: isSettable)
            .animation(fractionAnimation, value: fraction)
    }

    /// Sixty ticks inside the ring, every fifth longer. Ticks under the value read brighter.
    private func ticks(side: CGFloat, fraction: Double) -> some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let outer = side / 2 - lineWidth - 8
            for i in 0..<60 {
                let angle = Double(i) / 60 * 2 * .pi
                let major = i.isMultiple(of: 5)
                let length: CGFloat = major ? 8 : 4
                var path = Path()
                path.move(to: CGPoint(x: center.x + cos(angle) * outer, y: center.y + sin(angle) * outer))
                path.addLine(to: CGPoint(x: center.x + cos(angle) * (outer - length), y: center.y + sin(angle) * (outer - length)))
                let lit = Double(i) / 60 < fraction
                context.stroke(path, with: .color(style.secondaryText.opacity(lit ? 0.75 : 0.25)), style: StrokeStyle(lineWidth: major ? 2 : 1.2, lineCap: .round))
            }
        }
        .frame(width: side, height: side)
    }

    /// Springs for programmatic changes (progress values, external `seconds`); nothing while the finger drives the dial or the clock runs.
    private var fractionAnimation: Animation? {
        if case .progress = mode { return reduceMotion ? .smooth(duration: 0.25) : .spring(duration: 0.7, bounce: 0.25) }
        guard isSettable, lastDialFraction == nil else { return nil }
        return reduceMotion ? .smooth(duration: 0.25) : .spring(duration: 0.6, bounce: 0.2)
    }

    private func readout(shown: Int, fraction: Double, warning: Bool, side: CGFloat) -> some View {
        let parts = digits(shown: shown, fraction: fraction)
        let size = min(style.digitSize * digitScale, side * 0.3)
        return VStack(spacing: 4) {
            let dim = Text(verbatim: parts.dim).foregroundStyle(style.secondaryText.opacity(0.6))
            let main = Text(verbatim: parts.main).foregroundStyle(warning ? style.warning : style.text)
            let unit = Text(verbatim: parts.unit).foregroundStyle(style.secondaryText.opacity(0.6))
            Text("\(dim)\(main)\(unit)")
                .font(.system(size: size, weight: .light))
                .tracking(-size * 0.03)
                .monospacedDigit()
                .minimumScaleFactor(0.4)
                .lineLimit(1)
                .contentTransition(reduceMotion ? .identity : .numericText(countsDown: true))
                .animation(.smooth(duration: 0.3), value: shown)
            Text(captionText.uppercased())
                .font(.caption2.weight(.semibold))
                .tracking(1.1)
                .foregroundStyle(style.secondaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .contentTransition(.opacity)
                .animation(.smooth(duration: 0.25), value: captionText)
        }
        .padding(lineWidth + (style.showsTicks ? 24 : 12))
    }

    /// Countdown reads m:ss with the leading minutes dimmed while under a minute; progress reads a number with a dimmed %.
    private func digits(shown: Int, fraction: Double) -> (dim: String, main: String, unit: String) {
        if case .progress = mode { return ("", "\(Int((fraction * 100).rounded()))", "%") }
        let m = shown / 60, s = shown % 60
        let ss = s < 10 ? "0\(s)" : "\(s)"
        return m == 0 ? ("0:", ss, "") : ("", "\(m):\(ss)", "")
    }

    private var captionText: String {
        if let caption { return caption }
        if case .progress = mode { return "" }
        switch phase {
        case .idle: return "Ready"
        case .running: return "Remaining"
        case .paused: return "Paused"
        case .finished: return "Done"
        }
    }

    // MARK: Dial

    /// Angle around the center maps to seconds; the value clamps at 0 and at a full turn instead of wrapping.
    private func dial(side: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard isSettable else { return }
                let angle = atan2(value.location.y - side / 2, value.location.x - side / 2) + .pi / 2
                var fraction = angle / (2 * .pi)
                if fraction < 0 { fraction += 1 }
                if let last = lastDialFraction {
                    if last > 0.7, fraction < 0.3 { fraction = 1 } else if last < 0.3, fraction > 0.7 { fraction = 0 }
                }
                lastDialFraction = fraction
                set(Int((fraction * Double(maxSeconds) / Double(step)).rounded()) * step)
            }
            .onEnded { _ in lastDialFraction = nil }
    }

    private func set(_ value: Int) {
        let clamped = min(max(value, step), maxSeconds)
        guard clamped != seconds else { return }
        if clamped.isMultiple(of: 5) { detents += 1 } else { dialTicks += 1 }
        seconds = clamped
    }

    // MARK: Accessibility

    private var accessibilityLabel: String {
        if case .progress = mode { return caption ?? "Progress" }
        return "Timer"
    }

    private func accessibilityValue(shown: Int, fraction: Double) -> String {
        if case .progress = mode { return "\(Int((fraction * 100).rounded())) percent" }
        return "\(Duration.seconds(shown).formatted(.units(allowed: [.minutes, .seconds], width: .wide))), \(captionText.lowercased())"
    }
}

// MARK: - Example

/// Just the dial: the countdown, and the same ring in determinate progress mode.
private struct TimerDialExample: View {
    private typealias House = TimerDial.Style.House
    @State private var seconds = 45
    @State private var running = false

    var body: some View {
        VStack(spacing: 22) {
            TimerDial(seconds: $seconds, isRunning: $running, step: 5, maxSeconds: 60)
                .frame(width: 232)
            TimerDial(progress: 0.72, lineWidth: 10, caption: "Uploaded", style: .init(fill: House.hex(0x9CC2FF), showsTicks: false, digitSize: 26))
                .frame(width: 104)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(House.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") { TimerDialExample().preferredColorScheme(.light) }
#Preview("Dark") { TimerDialExample().preferredColorScheme(.dark) }
