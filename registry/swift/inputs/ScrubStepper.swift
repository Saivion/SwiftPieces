// swiftpieces:
// title: Scrub Stepper
// description: "A liquid glass stepper: round minus and plus bubbles joined to a glass numeral pill by liquid necks. Tap, hold to repeat with acceleration, or scrub sideways across the pill for velocity-scaled steps while a ruler slides under the finger; at a bound that button melts into the pill and the pill strains against the stop, and the button buds back out the moment it can be used."
// category: inputs
// pro: glass-sheet
// minIOSVersion: "17.0"
// version: "2.2.0"
// tags: [stepper, scrub, drag, haptic, numeric]

import SwiftUI

/// Liquid glass minus/plus stepper with hold-to-repeat and a horizontal scrub gesture.
///
/// The three parts rest joined, so liquid necks hold them together. At a bound the button that can no longer act
/// melts into the numeral pill, and it buds back out of the pill as soon as the value can move that way again. The
/// buttons keep their place in the layout while they are away, so the stepper never changes width.
///
/// - Parameters:
///   - value: Bound integer value.
///   - range: Allowed values. Pushing past a bound fires a rigid impact and knocks the numeral pill against that end; a scrub pulls it there with rubber-band resistance.
///   - step: Amount added or removed per tap, repeat tick, or scrub unit.
///   - style: Tints and size. Defaults to the SwiftPieces house palette (signal buttons around a neutral glass pill), adapting to light and dark.
public struct ScrubStepper: View {
    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// Unused since the liquid glass refactor: the liquid necks join the parts, so there is no capsule behind them. Kept so existing code still compiles.
        public var trough: Color
        /// The glass tint of the round minus and plus buttons.
        public var button: Color
        /// Glyphs on the buttons.
        public var glyph: Color
        /// The glass tint of the numeral pill. `.clear`, the default, leaves it neutral glass.
        public var block: Color
        /// Numeral and ruler on the pill.
        public var ink: Color
        /// Height of the pill and diameter of the buttons.
        public var height: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(trough: Color? = nil, button: Color? = nil, glyph: Color? = nil, block: Color? = nil, ink: Color? = nil, height: CGFloat = 52) {
            self.trough = trough ?? adaptive(light: 0xE6E4DE, dark: 0x262626)
            self.button = button ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.glyph = glyph ?? adaptive(light: 0x141414, dark: 0x141414)
            self.block = block ?? .clear
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.height = max(height, 44)
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .title2) private var numeralSize: CGFloat = 22
    @Binding private var value: Int
    @GestureState private var isTouching = false
    @State private var phase: Phase = .idle
    @State private var holdTask: Task<Void, Never>?
    @State private var didRepeat = false
    @State private var scrubAnchor: CGFloat = 0
    @State private var scrubX: CGFloat = 0
    /// When a scrub that must blend onto the finger began; `distantPast` when it tracks at once.
    @State private var scrubStart = Date.distantPast
    /// Until when the block may still be springing back from a stop.
    @State private var settlingUntil = Date.distantPast
    @State private var rulerShift: CGFloat = 0
    /// How far the finger has pushed past a bound, and the block's banded offset for it. Set directly while
    /// scrubbing, never animated; only the release springs it home.
    @State private var strain: CGFloat = 0
    @State private var pull: CGFloat = 0
    @State private var atStop = false
    @State private var knocks = 0
    @State private var knockSide: CGFloat = 1
    @State private var stepTick = 0
    @State private var lastStep = Date.distantPast
    @State private var rigidTick = 0
    @State private var minusBounce = 0
    @State private var plusBounce = 0
    @State private var width: CGFloat = 0
    /// The minus and plus bubbles: out while they can act, melted into the pill at their bound.
    @State private var buds = PieceBuds()

    private let range: ClosedRange<Int>
    private let step: Int
    private let style: Style
    private var height: CGFloat { style.height }
    private var buttonWidth: CGFloat { style.height }
    /// The liquid neck between each button and the pill.
    private let gap = PieceLiquid.joined
    /// The pill sits a neck's width from each button, so it gives only about that much past a bound: a stop, not a slider end.
    private let bandLimit: CGFloat = 8
    /// Scrub travel per step at 1x. Past a stop the block holds back no more than this, so it gives about 4pt.
    private let pointsPerStep: CGFloat = 14
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    private enum Phase: Equatable { case idle, pressing(delta: Int), scrubbing, cancelled }

    public init(value: Binding<Int>, in range: ClosedRange<Int> = 0...99, step: Int = 1, style: Style = .standard) {
        self._value = value
        self.range = range
        self.step = max(step, 1)
        self.style = style
    }

    public var body: some View {
        PieceLiquidGroup {
            HStack(spacing: gap) {
                slot("minus", delta: -step, bounce: minusBounce)
                // Above the buttons, so a button melting home slips under the pill, and a pill pushed against a stop
                // meets the button rather than sliding under it.
                well.zIndex(1)
                slot("plus", delta: step, bounce: plusBounce)
            }
        }
        .frame(height: height)
        .fontWeight(.semibold)
        .contentShape(.rect)
        .gesture(gesture, isEnabled: isEnabled)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .saturation(isEnabled ? 1 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: stepTick)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: rigidTick)
        .accessibilityElement(children: .ignore)
        .accessibilityValue("\(value)")
        .accessibilityAdjustableAction { adjust($0 == .increment ? step : -step) }
        // A touch the system cancels never reaches onEnded, so the repeat stops and the block lets go here too.
        .onChange(of: isTouching) { _, touching in
            if !touching { letGo() }
        }
        .onAppear { buds.place(usable) }
        .onChange(of: value) { old, new in
            let was = Set(usable(old)), now = Set(usable(new))
            let leaving = was.subtracting(now).sorted(), arriving = now.subtracting(was).sorted()
            Task {
                if !leaving.isEmpty { await buds.gather(leaving, reduceMotion: reduceMotion) }
                if !arriving.isEmpty { await buds.bloom(arriving, reduceMotion: reduceMotion) }
            }
        }
        .onDisappear { cancelHold() }
    }

    /// The buttons that can act at `value`: minus above the lower bound, plus below the upper.
    private func usable(_ value: Int) -> [String] {
        (value > range.lowerBound ? ["minus"] : []) + (value < range.upperBound ? ["plus"] : [])
    }
    private var usable: [String] { usable(value) }

    /// The value sits on a glass pill, the tab being scrubbed. Grabbed, it lifts and a ruler slides along its bottom
    /// edge; past a bound it strains against that end's stop.
    private var well: some View {
        let scrubbing = phase == .scrubbing
        // A hold or a scrub steps faster than a roll can land, so those digits change in place.
        let stepping = scrubbing || (didRepeat && phase != .idle)
        let shape = Capsule()
        // A knock moves the block under motion; under Reduce Motion it stays put and darkens for a beat instead.
        let knock = reduceMotion ? 0 : 4 * knockSide
        let flash = reduceMotion ? -0.1 : 0
        let out = PieceMotion.tight
        // Reduce Motion's flash fades back unhurried and never overshoots.
        let back = reduceMotion ? Spring(duration: 0.5, bounce: 0) : PieceMotion.elastic
        return Text("\(value)")
            .font(.system(size: numeralSize, weight: .semibold, design: .rounded).monospacedDigit())
            .foregroundStyle(style.ink)
            .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(value)))
            .lineLimit(1)
            .padding(.horizontal, 18)
            .frame(minWidth: 72)
            .frame(height: height)
            .overlay(alignment: .bottom) {
                Canvas { context, size in
                    // Ticks every 7pt (two per step), shifted by the scrub's travel.
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
                .padding(.horizontal, 14)
                .padding(.bottom, 5)
                .mask(LinearGradient(colors: [.clear, .black, .black, .clear], startPoint: .leading, endPoint: .trailing))
                .opacity(scrubbing ? 1 : 0)
                // Follows the lift a beat behind.
                .animation(motion.follow(PieceMotion.tight, rank: 1), value: scrubbing)
                .accessibilityHidden(true)
            }
            .clipShape(shape)
            .pieceLiquid(shape, tint: style.block == .clear ? nil : style.block, interactive: false)
            // The digits roll without overshoot, so they never pass the true value.
            .animation(stepping ? nil : motion.value, value: value)
            // Grabbed, the tab lifts: a little larger. Visual only, so the buttons and the gesture's geometry never
            // move. Under Reduce Motion the ruler alone shows it.
            .pieceLiquidScale(scrubbing && !reduceMotion ? 1.04 : 1)
            .animation(scrubbing ? motion.press : motion.release, value: scrubbing)
            .offset(x: pull)
            // A refused tap, repeat or VoiceOver step knocks the block toward the stop and back on its own.
            .keyframeAnimator(initialValue: CGFloat(0), trigger: knocks) { block, beat in
                block.offset(x: knock * beat).brightness(flash * beat)
            } keyframes: { _ in
                KeyframeTrack {
                    SpringKeyframe(1, duration: 0.1, spring: out)
                    SpringKeyframe(0, duration: 0.45, spring: back)
                }
            }
    }

    /// A button's place in the row. It keeps its width while the button is melted into the pill, so the stepper
    /// never changes size and the touch targets never move.
    private func slot(_ id: String, delta: Int, bounce: Int) -> some View {
        Color.clear
            .frame(width: buttonWidth, height: height)
            .overlay {
                if buds.contains(id) {
                    button(id, delta: delta, bounce: bounce)
                }
            }
    }

    /// A round signal bubble. Home is just inside the pill's nearest end, shrunk, where the two are one shape.
    private func button(_ id: String, delta: Int, bounce: Int) -> some View {
        let pressed = phase == .pressing(delta: delta)
        let out = buds.isOut(id)
        let side: CGFloat = delta < 0 ? 1 : -1
        let home = buttonWidth / 2 + gap + buttonWidth * PieceLiquid.homeScale / 2
        return Image(systemName: id)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(style.glyph)
            .symbolEffect(.bounce, value: bounce)
            .pieceBudContent(out: out)
            .frame(width: buttonWidth, height: buttonWidth)
            // Its tint drains as it melts, so it dissolves into the pill instead of sitting on the numeral.
            .pieceLiquid(.circle, tint: out ? style.button : nil, interactive: false)
            // The button's click: it sinks, with no bounce on the way in.
            .pieceLiquidScale(pressed && !reduceMotion ? 0.9 : 1)
            .brightness(pressed && reduceMotion ? -0.08 : 0)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .pieceBud(out: out, home: CGSize(width: side * home, height: 0))
            .accessibilityHidden(true)
    }

    private var gesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($isTouching) { _, touching, _ in touching = true }
            .onChanged { drag in
                switch phase {
                case .idle:
                    let x = drag.startLocation.x
                    if x < buttonWidth + gap / 2 {
                        beginPress(-step)
                    } else if x > width - buttonWidth - gap / 2 {
                        beginPress(step)
                    } else {
                        beginScrub(at: drag.location.x, time: drag.time)
                    }
                case .pressing:
                    let slop = CGRect(x: -20, y: -20, width: width + 40, height: height + 40)
                    if abs(drag.translation.width) > 14 {
                        // A sideways move on a button turns into a scrub.
                        cancelHold()
                        beginScrub(at: drag.location.x, time: drag.time)
                    } else if !slop.contains(drag.location) {
                        cancelHold()
                        phase = .cancelled
                    }
                case .scrubbing:
                    scrub(to: drag.location.x, velocity: drag.velocity.width, time: drag.time)
                case .cancelled:
                    break
                }
            }
            .onEnded { drag in
                if case .pressing(let delta) = phase, !didRepeat { tap(delta) }
                letGo(velocity: drag.velocity.width)
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

    private func beginScrub(at x: CGFloat, time: Date) {
        phase = .scrubbing
        scrubAnchor = x
        scrubX = x
        // Only a grab while the block is still springing back needs the blend; any other scrub tracks at once. The
        // window is checked on the wall clock: a drag's `time` runs on the event clock, which is not `Date()`'s.
        scrubStart = Date() < settlingUntil ? time : .distantPast
        rulerShift = 0
        strain = 0
    }

    /// One step per 14pt of travel, scaled by velocity so a flick covers more ground than a slow drag. Travel the
    /// value cannot take, past a bound, pulls the block against that end's stop with rubber-band resistance instead.
    private func scrub(to x: CGFloat, velocity: CGFloat, time: Date) {
        let gain = 1 + min(abs(velocity) / 600, 3)
        let steps = Int(((x - scrubAnchor) * gain / pointsPerStep).rounded(.towardZero))
        var current = value
        var moved = 0
        if steps != 0 {
            // Only steps the value took use up travel; one cut short by a bound counts whole.
            moved = move(by: steps * step)
            current += moved
            scrubAnchor += CGFloat((Double(moved) / Double(step)).rounded(.awayFromZero)) * pointsPerStep / gain
        }
        let rest = x - scrubAnchor
        let reach = (rest > 0 && current >= range.upperBound) || (rest < 0 && current <= range.lowerBound) ? rest : 0
        // The stop holds back at most one step of travel: the anchor walks with a finger pushing further, so coming
        // back steps again within one step more, and a range change under a resting finger frees at most one step.
        if abs(reach) > pointsPerStep {
            scrubAnchor = x - (reach > 0 ? pointsPerStep : -pointsPerStep)
        }
        let past = min(max(reach, -pointsPerStep), pointsPerStep)
        // The ruler is the tape: it runs with the finger, faster on a flick, never backward under a steady finger,
        // and stops dead while the block strains at a bound.
        rulerShift += (x - scrubX - (reach - strain)) * gain
        scrubX = x
        strain = past
        let target = reduceMotion ? 0 : PieceMotion.rubberBand(past, limit: bandLimit)
        // Directly under the finger. A grab while the block is still springing back eases onto it on the press spring
        // for its first 100ms instead, so it takes the block over without a jump.
        if time.timeIntervalSince(scrubStart) < 0.1 {
            withAnimation(motion.press) { pull = target }
        } else {
            pull = target
        }
        // One rigid impact each time the block reaches a stop. It rearms once the finger comes back off it.
        let hitStop = abs(past) > 4 && !atStop
        if hitStop {
            atStop = true
            rigidTick += 1
            // Under Reduce Motion the block stays put, so it flashes instead.
            if reduceMotion { knock(toward: past) }
        } else if past == 0 {
            atStop = false
        }
        // One haptic per event: a flick that steps onto the bound and hits the stop at once gets the impact alone.
        if moved != 0, !hitStop { tick() }
    }

    /// The finger lifts, or the system takes the touch. A block pulled past a bound springs back, leaving at the
    /// speed it was moving. The value never coasts.
    private func letGo(velocity: CGFloat = 0) {
        cancelHold()
        phase = .idle
        atStop = false
        // The block's own speed: the finger's, slowed by the band, and none outward once the stop holds it.
        let frame: CGFloat = 1 / 120
        let reach = min(max(strain + velocity * frame, -pointsPerStep), pointsPerStep)
        let speed = (PieceMotion.rubberBand(reach, limit: bandLimit) - PieceMotion.rubberBand(strain, limit: bandLimit)) / frame
        strain = 0
        guard pull != 0 else { return }
        // The spring back is within a hundredth of a point of rest by then, however fast it was let go.
        settlingUntil = Date().addingTimeInterval(0.75)
        withAnimation(motion.settle(velocity: speed, from: pull, to: 0)) { pull = 0 }
    }

    /// A tap commits on release. Only a tap bounces its glyph: a hold or a scrub steps too fast for a bounce to read.
    private func tap(_ delta: Int) {
        guard adjust(delta), !reduceMotion else { return }
        if delta > 0 { plusBounce += 1 } else { minusBounce += 1 }
    }

    /// A tap, a repeat tick or a VoiceOver step. At a bound it stops repeating, fires a rigid impact and knocks the
    /// block against that end. Returns whether the value moved.
    @discardableResult
    private func adjust(_ delta: Int) -> Bool {
        guard move(by: delta) == 0 else {
            tick()
            return true
        }
        cancelHold()
        rigidTick += 1
        knock(toward: CGFloat(delta))
        return false
    }

    /// Moves the value by `delta` within the range and returns how far it went.
    private func move(by delta: Int) -> Int {
        let next = min(max(value + delta, range.lowerBound), range.upperBound)
        let moved = next - value
        guard moved != 0 else { return 0 }
        value = next
        return moved
    }

    /// A step's selection haptic, throttled so a fast scrub or a 30ms repeat does not buzz.
    private func tick() {
        let now = Date()
        guard now.timeIntervalSince(lastStep) > 0.035 else { return }
        lastStep = now
        stepTick += 1
    }

    private func knock(toward side: CGFloat) {
        knockSide = side < 0 ? -1 : 1
        knocks += 1
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// The stepper on its own, neutral and with a sage-tinted pill.
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum, rubberBand)

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
    /// Follow-through: rank 0 leads, each later rank arrives a beat later on a slightly looser spring. Safe to reverse.
    func follow(_ spring: Spring = PieceMotion.elastic, rank: Int) -> Animation {
        guard !reduceMotion else { return .spring(duration: 0.25, bounce: 0) }
        let k = Double(min(max(rank, 0), 6))
        return .spring(duration: spring.duration + 0.04 * k, bounce: min(spring.bounce + 0.02 * k, 0.55))
    }

    /// One-shot entrances only: item `index` waits 30ms per place, capped at the seventh. Exits go together.
    func cascade(_ animation: Animation, index: Int, step: Double = 0.03) -> Animation {
        guard !reduceMotion, index > 0 else { return animation }
        return animation.delay(step * Double(min(index, 7)))
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
// swiftpieces-liquid: 1.7.0 (liquid, bud)

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
