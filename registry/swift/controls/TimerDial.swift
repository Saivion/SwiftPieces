// swiftpieces:
// title: Timer Dial
// description: "A countdown ring you set by dragging a liquid glass knob around it like the Timer dial, with a tick per step and a heavier detent every 5s. A solid ring over a minute-tick scale, semibold display numerals, a breathing signal warning zone, a sage finish, optional glass start, pause and reset bubbles that bud out of each other, and a determinate progress mode."
// category: controls
// minIOSVersion: "17.0"
// version: "2.2.0"
// pro: focus-timer
// tags: [timer, countdown, dial, ring, progress, haptics, glass]

import SwiftUI

/// Settable countdown ring, or a determinate progress ring with the same look. The ring and its ticks are content; the
/// knob riding the ring is a liquid glass bubble, and `style.showsControls` adds start, pause and reset as glass
/// bubbles under the dial: reset buds out of the start bubble while there is something to reset.
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
        /// The solid ring, and the glass tint of the start bubble.
        public var fill: Color
        /// The unfilled track under the ring.
        public var track: Color
        /// Ring and digit color inside the warning zone.
        public var warning: Color
        /// Ring color once the countdown finishes.
        public var finished: Color
        /// Unused since the liquid glass refactor: the knob is a clear glass bubble. Kept so existing code still compiles.
        public var knob: Color
        /// Digits and caption.
        public var text: Color
        public var secondaryText: Color
        /// Draws a 60-tick scale inside the ring; ticks under the ring's value are brighter.
        public var showsTicks: Bool
        /// Base digit size, scaled with Dynamic Type relative to `.largeTitle`.
        public var digitSize: CGFloat
        /// Draws start, pause and reset as liquid glass bubbles under the countdown dial. They drive `isRunning`, and
        /// reset sets the dial back to `seconds`. Off by default, so a dial with your own controls looks as it did.
        public var showsControls: Bool

        public init(fill: Color = House.hex(0xFF0000), track: Color = House.adaptive(light: 0xEAE8E2, dark: 0x262626), warning: Color = House.hex(0xFF0000), finished: Color = House.hex(0xA9DCB7), knob: Color = House.adaptive(light: 0x141414, dark: 0xF4F3EF), text: Color = House.adaptive(light: 0x141414, dark: 0xF4F3EF), secondaryText: Color = House.adaptive(light: 0x5C5A56, dark: 0xA6A49F), showsTicks: Bool = true, digitSize: CGFloat = 52, showsControls: Bool = false) {
            self.fill = fill
            self.track = track
            self.warning = warning
            self.finished = finished
            self.knob = knob
            self.text = text
            self.secondaryText = secondaryText
            self.showsTicks = showsTicks
            self.digitSize = digitSize
            self.showsControls = showsControls
        }

        /// The Free house palette: signal ring and warning, sage finish.
        public static let standard = Style()
        /// The same dial with a sky ring, for secondary timers and progress.
        public static let sky = Style(fill: House.hex(0x9CC2FF))

        /// Builds house colors. Public so `Style` defaults can use it.
        public enum House {
            public static func hex(_ value: UInt32) -> Color {
                Color(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
            }

            public static func adaptive(light: UInt32, dark: UInt32) -> Color {
                Color(uiColor: UIColor { @Sendable traits in
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
    @State private var lastTick = Date.distantPast
    /// Releases that landed the knob on a detent. Its seating pop keys off this.
    @State private var landings = 0
    /// Where the finger holds the dial, in turns clockwise from 12 o'clock. Unwrapped, so it can run past either end.
    @State private var heldTurn: Double?
    @GestureState private var isDialing = false
    /// The reset bubble: out of the start bubble while there is something to reset, melted back into it once the dial
    /// is ready again.
    @State private var buds = PieceBuds()

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
        // No group lift: the group holds the ring and the readout too, and those are content, not floating glass.
        PieceLiquidGroup(lift: false) {
            VStack(spacing: 20) {
                dial
                if style.showsControls, case .countdown = mode {
                    controls
                }
            }
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: dialTicks)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: detents)
        .sensoryFeedback(.success, trigger: finishCount)
        .onChange(of: seconds) { _, new in remainingAtPause = Double(max(new, 1)); startedAt = nil }
        .onAppear { buds.place(resettable ? ["reset"] : []) }
        .onChange(of: resettable) { _, show in
            Task {
                if show {
                    await buds.bloom(["reset"], reduceMotion: reduceMotion)
                } else {
                    await buds.gather(["reset"], reduceMotion: reduceMotion)
                }
            }
        }
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

    /// The ring, its ticks, the readout and the knob, square, as large as the space allows.
    private var dial: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil, paused: startedAt == nil)) { context in
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let remaining = remaining(at: context.date)
                let shown = Int(remaining.rounded(.up))
                let finished = phase == .finished
                let warning = phase != .idle && !finished && shown <= warningAt
                // One face throughout: the time left against a full turn, so the ring winds to the set time and
                // drains back to 12 o'clock from there.
                let value: Double = {
                    if case .progress(let value) = mode { return value }
                    return min(remaining / face, 1)
                }()
                // Held, the ring and knob ride the finger; the value, digits and ticks move in whole steps.
                let fraction = isSettable ? heldTurn.map { drawn($0, side: side) } ?? value : value
                let breathing = warning && phase == .running && motion.allowsAmbient
                let breathe = breathing ? 1 + 0.012 * beat(remaining: remaining, shown: shown, now: context.date) : 1
                // Reduce Motion has no beat, so each second in the zone brightens the warning ring instead.
                let flash: Double = warning && phase == .running && !motion.allowsAmbient ? 0.12 : 0
                ZStack {
                    if style.showsTicks {
                        ticks(side: side, fraction: finished ? 1 : value)
                    }
                    ring(fraction: fraction, side: side, style: ringStyle)
                    // Warning and finish rings fade over the base ring, so the color eases instead of swapping.
                    ring(fraction: fraction, side: side, style: AnyShapeStyle(style.warning))
                        .opacity(warning ? 1 : 0)
                        .animation(motion.morph, value: warning)
                        .keyframeAnimator(initialValue: 0.0, trigger: shown) { ring, glow in
                            ring.brightness(glow)
                        } keyframes: { _ in
                            KeyframeTrack {
                                CubicKeyframe(flash, duration: 0.1)
                                CubicKeyframe(0, duration: 0.5)
                            }
                        }
                    ring(fraction: 1, side: side, style: AnyShapeStyle(style.finished), knob: false)
                        .opacity(finished ? 1 : 0)
                        .scaleEffect(finished || reduceMotion ? 1 : 0.94)
                        .animation(finished ? motion.success : motion.dismiss, value: finished)
                    knob(fraction: fraction, side: side)
                }
                .rotationEffect(.degrees(-90))
                .scaleEffect(breathe)
                // Paused mid-beat, the dial eases back to rest instead of dropping.
                .animation(motion.ambient, value: breathing)
                .overlay { readout(shown: shown, fraction: value, warning: warning, side: side) }
                .frame(width: side, height: side)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                // One soft impact per second in the zone, under Reduce Motion too. Zero is the finish, which plays `.success`.
                .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: shown) { _, new in warning && phase == .running && new > 0 }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityLabel)
                .accessibilityValue(accessibilityValue(shown: shown, fraction: value))
                .accessibilityHint(isSettable ? "Swipe up or down to adjust" : "")
                .accessibilityAdjustableAction { direction in
                    guard isSettable else { return }
                    set(seconds + (direction == .increment ? step : -step))
                }
            }
            .contentShape(Circle())
            .gesture(dial(side: side), including: isSettable ? .all : .subviews)
            // A drag the system cancels never reaches onEnded, so the knob is let go here too.
            .onChange(of: isDialing) { _, dialing in
                if !dialing { release(nil, side: side) }
            }
        }
        .aspectRatio(1, contentMode: .fit)
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
        .transaction(value: fraction, landing)
    }

    /// The knob rides the leading edge: a clear glass bubble over the ring, larger while the dial can be set. Held, it
    /// lifts: a little larger again, with a deeper shadow, through the liquid scale like any glass. It stays on
    /// the ring throughout, at 12 o'clock once a countdown is done or a progress ring is empty: glass never shrinks
    /// away to nothing.
    private func knob(fraction: Double, side: CGFloat) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let held = heldTurn != nil && isSettable
        let diameter = lineWidth + (isSettable ? 10 : 4)
        return Color.clear
            .frame(width: diameter, height: diameter)
            .pieceLiquid(Circle(), interactive: false)
            .animation(motion.morph, value: isSettable)
            .shadow(color: .black.opacity(held ? 0.24 : 0.14), radius: held ? 10 : 5, y: held ? 4 : 2)
            .pieceLiquidScale(held && !reduceMotion ? 1.12 : 1)
            .animation(held ? motion.press : motion.release, value: held)
            // Let go on a detent, it seats with a small pop. Scale only, so the ring and the value stay true.
            .pieceLiquidPop(trigger: landings)
            .offset(x: (side - lineWidth) / 2)
            .rotationEffect(.degrees(fraction * 360))
            .transaction(value: fraction, landing)
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

    /// How the ring and knob take a new fraction. The clock and the finger set it directly, even when the change
    /// arrives in an animated transaction (a caller's `.animation(value: seconds)`, the warning fade), and a release
    /// brings its own spring. Anything else unanimated (a new `seconds` or progress value, a VoiceOver adjustment)
    /// lands on the value spring, which never overshoots, so the ring never shows a time or a percent it isn't.
    private var landing: (inout Transaction) -> Void {
        let direct = startedAt != nil || (heldTurn != nil && isSettable)
        let fallback = PieceMotion(reduceMotion: reduceMotion).value
        return { transaction in
            if direct { transaction.animation = nil } else if transaction.animation == nil { transaction.animation = fallback }
        }
    }

    /// The warning zone's heartbeat, 0 to 1. It peaks on each second boundary, as the digits change and the soft impact
    /// plays, eases off through the second and rises quickly just before the next. It fades in over the first 0.3s of
    /// the zone or of a resumed run and out over the last 0.3s, so it never pops on or off mid-beat.
    private func beat(remaining: Double, shown: Int, now: Date) -> Double {
        let sincePeak = Double(shown) - remaining
        let pulse = sincePeak < 0.6 ? pow(1 - sincePeak / 0.6, 2) : sincePeak > 0.85 ? pow((sincePeak - 0.85) / 0.15, 2) : 0
        let run = startedAt.map { now.timeIntervalSince($0) } ?? 0
        let fade = min(Double(warningAt) - remaining, run, remaining) / 0.3
        return pulse * min(max(fade, 0), 1)
    }

    private func readout(shown: Int, fraction: Double, warning: Bool, side: CGFloat) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let parts = digits(shown: shown, fraction: fraction)
        let size = min(style.digitSize * digitScale, side * 0.3)
        let count: Double = {
            if case .progress = mode { return (fraction * 100).rounded() }
            return Double(shown)
        }()
        let dialing = heldTurn != nil
        return VStack(spacing: 4) {
            let dim = Text(verbatim: parts.dim).foregroundStyle(style.secondaryText.opacity(0.6))
            let main = Text(verbatim: parts.main).foregroundStyle(warning ? style.warning : style.text)
            let unit = Text(verbatim: parts.unit).foregroundStyle(style.secondaryText.opacity(0.6))
            Text("\(dim)\(main)\(unit)")
                .font(.system(size: size, weight: .semibold))
                .tracking(-size * 0.03)
                .monospacedDigit()
                .minimumScaleFactor(0.4)
                .lineLimit(1)
                // Digits roll toward the new value, up or down, on the value spring, so a roll never passes the number.
                // Under the finger they change at once, so they never trail the detent that just clicked.
                .contentTransition(dialing ? .identity : reduceMotion ? .opacity : .numericText(value: count))
                .animation(dialing ? nil : motion.value, value: count)
            // The caption morphs letter by letter from one phase to the next.
            PieceMorphText(text: captionText.uppercased(), font: .caption2.weight(.semibold))
                .tracking(1.1)
                .foregroundStyle(style.secondaryText)
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

    // MARK: Controls

    /// The diameter of the start and reset bubbles: the house size for round controls.
    private let controlSize: CGFloat = 52

    /// Paused, running or done: there is something for reset to undo.
    private var resettable: Bool {
        guard style.showsControls, case .countdown = mode else { return false }
        return phase != .idle
    }

    /// Start, pause and reset as liquid glass bubbles. Start is the primary action, glass tinted like the ring, its
    /// glyph swapping between play and pause. Reset buds out of it to rest apart while there is something to reset,
    /// the pair keeping centred, and melts back into it once the dial is ready again.
    private var controls: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let resetOut = buds.isOut("reset")
        let half = (controlSize + PieceLiquid.apart) / 2
        let running = phase == .running
        return ZStack {
            if buds.contains("reset") {
                Button(action: reset) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(style.text)
                        .pieceBudContent(out: resetOut)
                        .frame(width: controlSize, height: controlSize)
                        .contentShape(.circle)
                }
                .buttonStyle(.plain)
                .pieceLiquid(Circle())
                .pieceBud(out: resetOut, rest: CGSize(width: -half, height: 0), home: .zero)
                .accessibilityLabel("Reset")
            }
            // Last, so the reset bubble at home sits under it.
            Button { isRunning.toggle() } label: {
                ZStack {
                    Image(systemName: running ? "pause.fill" : "play.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .id(running)
                        .transition(motion.swap)
                }
                .foregroundStyle(Style.House.hex(0x141414))
                .frame(width: controlSize, height: controlSize)
                .contentShape(.circle)
                .animation(motion.morph, value: running)
            }
            .buttonStyle(.plain)
            .pieceLiquid(Circle(), tint: style.fill)
            // Moves aside on the reset bubble's own spring, so the pair splits apart and stays centred.
            .offset(x: resetOut ? half : 0)
            .accessibilityLabel(running ? "Pause" : phase == .paused ? "Resume" : phase == .finished ? "Restart" : "Start")
        }
        .frame(height: controlSize)
    }

    /// Stops the countdown and sets the dial back to the length it was set to.
    private func reset() {
        isRunning = false
        startedAt = nil
        remainingAtPause = Double(max(seconds, 1))
    }

    // MARK: Dial

    /// Angle around the center maps to seconds. The finger's angle is unwrapped, so crossing 12 o'clock never jumps
    /// the value from one end to the other: past either end it clamps while the knob gives.
    private func dial(side: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($isDialing) { _, dialing, _ in dialing = true }
            .onChanged { value in
                guard isSettable else { return }
                let angle = turns(at: value.location, side: side)
                var turn: Double
                if let previous = heldTurn {
                    // The reading nearest the last one, a whole turn either way.
                    turn = angle + (previous - angle).rounded()
                } else {
                    // On the knob, stay on its side of 12 o'clock, so a full dial is not grabbed as an empty one.
                    // Anywhere else, or once finished with the knob hidden, the touch sets the value.
                    let near = angle + (restingTurn - angle).rounded()
                    turn = phase != .finished && abs(near - restingTurn) <= knobReach(side: side) ? near : angle
                    // Paused, dialing starts the countdown over, even at the length it already had.
                    if phase == .paused { remainingAtPause = Double(max(seconds, 1)) }
                }
                // More than half a turn past an end, the finger is nearer the other side: the knob comes round to it.
                if turn > 1.5 { turn -= 1 } else if turn < lowestTurn - 0.5 { turn += 1 }
                heldTurn = turn
                set(Int((min(max(turn, 0), 1) * Double(maxSeconds) / Double(step)).rounded()) * step)
            }
            .onEnded { value in release(value, side: side) }
    }

    /// Lets go of the dial. The ring is the time, so it never swings far past the value it shows. Pulled past an end,
    /// the knob springs back on the snap tier, leaving at the speed it was moving: its pass back into the range stays
    /// under a point from rest, where the elastic tier would show a time that isn't set. Anywhere else it lands on its
    /// detent from rest on the value spring. The give lives in the knob: its lift drops back and it seats with a pop.
    private func release(_ drag: DragGesture.Value?, side: CGFloat) {
        guard let held = heldTurn else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let circumference = Double(side - lineWidth) * .pi
        let from = drawn(held, side: side)
        var animation = motion.value
        if let drag, from < lowestTurn - 0.001 || from > 1.001 {
            // The drawn knob's own speed along the ring: the finger's, slowed by the band.
            let frame = 1.0 / 120
            let ahead = turns(at: CGPoint(x: drag.location.x + drag.velocity.width * frame, y: drag.location.y + drag.velocity.height * frame), side: side)
            let speed = (drawn(ahead + (held - ahead).rounded(), side: side) - from) / frame * circumference
            animation = motion.settle(velocity: speed, from: from * circumference, to: restingTurn * circumference, spring: PieceMotion.responsive)
        } else {
            landings += 1
        }
        withAnimation(animation) { heldTurn = nil }
    }

    /// Where the knob is drawn for a finger at `turn`: under the finger anywhere the value can go, and past either end
    /// with rubber-band resistance, never more than about the knob's own width. Only the drawing goes past; the value
    /// stays at its end. Under Reduce Motion the ends stop it.
    private func drawn(_ turn: Double, side: CGFloat) -> Double {
        let circumference = Double(side - lineWidth) * .pi
        guard !reduceMotion, circumference > 0 else { return min(max(turn, lowestTurn), 1) }
        let limit = min(max(lineWidth + 10, 24), 32)
        let range = CGFloat(lowestTurn * circumference)...CGFloat(circumference)
        return Double(PieceMotion.rubberBand(CGFloat(turn * circumference), in: range, limit: limit)) / circumference
    }

    /// The finger's angle in turns, clockwise from 12 o'clock, from 0 up to 1.
    private func turns(at point: CGPoint, side: CGFloat) -> Double {
        let angle = Double(atan2(point.y - side / 2, point.x - side / 2)) / (2 * .pi) + 0.25
        return angle < 0 ? angle + 1 : angle
    }

    /// Where the knob rests while the dial can be set, in turns.
    private var restingTurn: Double { min(remainingAtPause / face, 1) }

    /// The seconds a full turn shows: `maxSeconds`, or a longer `seconds` set from code, so that countdown still
    /// drains from full. Dialing clamps to `maxSeconds`, which brings the face back.
    private var face: Double { Double(max(maxSeconds, seconds, 1)) }

    /// The shortest settable time, in turns. Below it the knob only gives.
    private var lowestTurn: Double { Double(step) / Double(maxSeconds) }

    /// How far from the knob's center a touch still grabs the knob, in turns.
    private func knobReach(side: CGFloat) -> Double {
        (Double(lineWidth + 10) / 2 + 12) / max(Double(side - lineWidth) * .pi, 1)
    }

    private func set(_ value: Int) {
        let clamped = min(max(value, step), maxSeconds)
        guard clamped != seconds else { return }
        if clamped.isMultiple(of: 5) || clamped == step || clamped == maxSeconds {
            detents += 1
        } else if Date().timeIntervalSince(lastTick) > 0.035 {
            // Throttled, so a fast spin over 1s steps clicks instead of buzzing.
            lastTick = Date()
            dialTicks += 1
        }
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

/// The countdown with its glass start, pause and reset bubbles, and the same ring in determinate progress mode.
private struct TimerDialExample: View {
    private typealias House = TimerDial.Style.House
    @State private var seconds = 45
    @State private var running = false

    var body: some View {
        VStack(spacing: 28) {
            TimerDial(seconds: $seconds, isRunning: $running, step: 5, maxSeconds: 60, style: .init(showsControls: true))
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand)

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
    /// Where a flick at `velocity` (pt/s) coasts to. 0.998 coasts like a scroll view; 0.99 suits detents.
    nonisolated static func project(_ position: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.99) -> CGFloat {
        position + velocity / 1000 * decelerationRate / (1 - decelerationRate)
    }

    /// The candidate closest to `value`.
    nonisolated static func nearest(_ value: CGFloat, in candidates: [CGFloat]) -> CGFloat {
        candidates.min { abs($0 - value) < abs($1 - value) } ?? value
    }

    /// A settle that leaves at the finger's speed (pt/s). One per axis, each on its own `.offset(x:)` / `.offset(y:)`:
    /// a spring takes one velocity. SwiftUI's own velocity carry-over is unreliable; this always carries it.
    func settle(velocity: CGFloat, from current: CGFloat, to target: CGFloat, spring: Spring = PieceMotion.elastic) -> Animation {
        let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : spring
        let distance = target - current
        guard abs(distance) >= 1 else { return .spring(spring) }
        // In whole distances per second, capped near the spring's frequency: a hard flick adds give, not a slingshot.
        // At exactly the frequency a critically damped spring cannot pass its target, so Reduce Motion stops there.
        let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
        let relative = min(max(Double(velocity / distance), -cap), cap)
        return .interpolatingSpring(spring, initialVelocity: relative)
    }
}

extension PieceMotion {
    /// A scroll view's edge resistance for a pull `overshoot` points past a limit; never reaches `limit`.
    /// About 24 to 40 for thumbs and toggles, 60 to 120 for cards and sheets. Band the total pull, not deltas.
    nonisolated static func rubberBand(_ overshoot: CGFloat, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard limit > 0, overshoot != 0 else { return 0 }
        let banded = (1 - 1 / (abs(overshoot) * coefficient / limit + 1)) * limit
        return overshoot < 0 ? -banded : banded
    }

    /// `value` inside `range` passes through unchanged; past either end it moves with rubber-band resistance.
    nonisolated static func rubberBand(_ value: CGFloat, in range: ClosedRange<CGFloat>, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        if value < range.lowerBound { return range.lowerBound + rubberBand(value - range.lowerBound, limit: limit, coefficient: coefficient) }
        if value > range.upperBound { return range.upperBound + rubberBand(value - range.upperBound, limit: limit, coefficient: coefficient) }
        return value
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPop, bud, morphText)

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

/// `piecePop` for glass: dips, swells past full size and lands each time `trigger` changes, on the same timings,
/// through `pieceLiquidScale` so the glass and what it carries pop together. Driven from state rather than a
/// keyframe animator, since the liquid scale can't be set from inside one. Still under Reduce Motion.
private struct PieceLiquidPop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scale: CGFloat = 1
    @State private var run = 0

    func body(content: Content) -> some View {
        content
            .pieceLiquidScale(scale)
            .onChange(of: trigger) { _, _ in
                guard !reduceMotion else { return }
                run += 1
                let mine = run
                withAnimation(.easeInOut(duration: 0.08)) { scale = 1 - amount * 0.4 }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(80))
                    guard run == mine else { return }
                    withAnimation(.spring(duration: 0.18, bounce: 0)) { scale = 1 + amount }
                    try? await Task.sleep(for: .milliseconds(140))
                    guard run == mine else { return }
                    withAnimation(.spring(PieceMotion.expressive)) { scale = 1 }
                }
            }
    }
}

private extension View {
    /// Pops this view's glass each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func pieceLiquidPop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PieceLiquidPop(trigger: AnyHashable(trigger), amount: amount))
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

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
