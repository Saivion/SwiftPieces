// swiftpieces:
// title: Motion Card
// description: A solid color card that tilts with the device's attitude through an exponential filter, easing into its limit and leveling out when the grip changes, with a fixed-light sheen and a layered shadow that slide as it turns. Its content takes semibold type, and liquid glass chips laid on its face tilt and catch the same light. Press settles it toward flat, tips it down under the finger and sinks it with a light impact, and Core Motion stops whenever the scene is not active.
// category: cards
// minIOSVersion: "17.0"
// version: "2.3.0"
// pro: payment-card
// tags: [card, motion, tilt, core-motion, press, ticket]

import SwiftUI
import CoreMotion

/// Attitude-driven card with a fixed-light sheen, tracking shadow, and press feedback.
///
/// - Parameters:
///   - maxAngle: Maximum tilt in degrees on each axis.
///   - cornerRadius: Corner radius of the card surface (continuous).
///   - attitude: Optional fixed tilt, -1...1 on each axis, that replaces device motion. Useful for previews, tests, and the simulator.
///   - style: The card's fill, ink, sheen, shadow, and press. `.standard` is a red block with dark ink.
///   - action: Optional tap handler. The card always scales on press; this runs on a clean tap.
///   - content: Card content, laid over the card's own surface. It inherits `style.foreground` and semibold type.
///     Caption chips on it read best as light liquid glass, as in the ticket example.
public struct MotionCard<Content: View>: View {
    /// Surface and depth for the card.
    public struct Style: Sendable {
        /// The card's solid fill.
        public var fill: Color
        /// Default foreground for the content. Keep 4.5:1 contrast against `fill`.
        public var foreground: Color
        /// Strength of the fixed-light sheen, 0...1. 0 turns it off.
        public var sheen: Double
        /// Shadow strength in light mode; dark mode uses about three times this.
        public var shadowOpacity: Double
        /// Scale while pressed.
        public var pressScale: CGFloat
        /// Radius of the half-circle notches cut from both side edges, as on a ticket's tear line. They are real holes:
        /// the page shows through and the shadow follows them. 0 cuts none.
        public var notchRadius: CGFloat
        /// Where the notches sit, from 0 (top edge) to 1 (bottom edge).
        public var notchPosition: CGFloat

        public init(fill: Color = Color(red: 1, green: 0, blue: 0), foreground: Color = Color(red: 0.078, green: 0.078, blue: 0.078), sheen: Double = 0.5, shadowOpacity: Double = 0.16, pressScale: CGFloat = 0.97, notchRadius: CGFloat = 0, notchPosition: CGFloat = 0.5) {
            self.fill = fill
            self.foreground = foreground
            self.sheen = sheen
            self.shadowOpacity = shadowOpacity
            self.pressScale = pressScale
            self.notchRadius = max(notchRadius, 0)
            self.notchPosition = min(max(notchPosition, 0), 1)
        }

        /// House default: a red block with dark ink.
        public static var standard: Style { Style() }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.scenePhase) private var scenePhase
    @State private var device = Motion()
    @State private var pressed = false
    /// Where the last press landed. Kept after the lift, so the card springs back from the same lean.
    @State private var touch: CGPoint?
    @State private var size: CGSize = .zero
    /// Counts touch-downs for the haptic. `tracking` latches one count per touch, so a press regained after
    /// sliding back within 10pt plays nothing.
    @State private var pressTick = 0
    @State private var tracking = false
    /// Sensors only run while the card is on screen, even if the view stays alive behind a pushed screen or tab.
    @State private var onScreen = false
    /// Resets when the system cancels the touch, which skips onEnded.
    @GestureState private var touching = false

    private let maxAngle: Double
    private let cornerRadius: CGFloat
    private let attitude: CGSize?
    private let style: Style
    private let action: (() -> Void)?
    private let content: Content

    public init(maxAngle: Double = 10, cornerRadius: CGFloat = 26, attitude: CGSize? = nil, style: Style = .standard, action: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.maxAngle = maxAngle
        self.cornerRadius = cornerRadius
        self.attitude = attitude
        self.style = style
        self.action = action
        self.content = content()
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let raw = reduceMotion ? .zero : (attitude ?? CGSize(width: device.roll, height: device.pitch))
        let anchor = PieceMotion.pressAnchor(touch: touch, in: size)
        // Pressing settles the card toward flat, as if pushed into the page, and tips it down under the finger by up
        // to 0.3 of `maxAngle` at an edge. The light and the shadow read the lean like any other tilt.
        let lean = pressed && !reduceMotion ? CGSize(width: anchor.x - 0.5, height: anchor.y - 0.5) : .zero
        let tilt = pressed ? CGSize(width: raw.width * 0.5 + lean.width, height: raw.height * 0.5 + lean.height) : raw
        let magnitude = min(hypot(tilt.width, tilt.height), 1)
        let shape = CardShape(cornerRadius: cornerRadius, notchRadius: style.notchRadius, notchPosition: style.notchPosition)
        let shadow = min(style.shadowOpacity * (colorScheme == .dark ? 3 : 1), 1)

        content
            .fontWeight(.semibold)
            .foregroundStyle(style.foreground)
            .background(style.fill)
            .overlay {
                // A fixed light: the sheen moves opposite the tilt, as a reflection would, and a faint shade gathers on the far side.
                ZStack {
                    RadialGradient(
                        colors: [.white.opacity(style.sheen * (0.35 + magnitude * 0.4)), .clear],
                        center: UnitPoint(x: 0.5 - tilt.width * 0.5, y: 0.3 - tilt.height * 0.5),
                        startRadius: 0,
                        endRadius: 260
                    )
                    .blendMode(.softLight)
                    RadialGradient(
                        colors: [.clear, .black.opacity(style.sheen * magnitude * 0.16)],
                        center: UnitPoint(x: 0.5 - tilt.width * 0.5, y: 0.3 - tilt.height * 0.5),
                        startRadius: 120,
                        endRadius: 420
                    )
                }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            .clipShape(shape)
            // Reduce Motion: the press dims the card instead of sinking and tipping it.
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            // Cast by the card's outline alone, not by everything on it: glass on its face draws in its own layer and
            // would take the card's shadow as a dark halo.
            .background {
                shape
                    .fill(style.fill)
                    .shadow(color: .black.opacity(shadow * 0.6), radius: 2, y: 1)
                    .shadow(color: .black.opacity(shadow), radius: (pressed ? 10 : 20) + magnitude * 10, x: -tilt.width * 14, y: (pressed ? 6 : 14) + tilt.height * 8)
            }
            .scaleEffect(pressed && !reduceMotion ? style.pressScale : 1, anchor: anchor)
            .rotation3DEffect(.degrees(-tilt.height * maxAngle), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .rotation3DEffect(.degrees(tilt.width * maxAngle), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .saturation(isEnabled ? 1 : 0)
            .opacity(isEnabled ? 1 : 0.55)
            .contentShape(shape)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($touching) { _, touching, _ in touching = true }
                    .onChanged { drag in
                        if !tracking {
                            tracking = true
                            pressTick += 1
                        }
                        // Pressed while a lift would still count as a tap. Past 10pt the card lets go, and presses
                        // again if the finger comes back.
                        let isTap = hypot(drag.translation.width, drag.translation.height) < 10
                        guard isTap != pressed else { return }
                        withAnimation(isTap ? motion.press : motion.snap) {
                            if isTap { touch = drag.startLocation }
                            pressed = isTap
                        }
                    }
                    .onEnded { drag in
                        tracking = false
                        withAnimation(motion.release) { pressed = false }
                        if let action, hypot(drag.translation.width, drag.translation.height) < 10 { action() }
                    },
                isEnabled: isEnabled
            )
            .sensoryFeedback(.impact(weight: .light), trigger: pressTick)
            .onChange(of: touching) { _, isTouching in
                // A touch the system cancelled (a scroll or an alert took over) never reaches onEnded, so let go here.
                guard !isTouching else { return }
                tracking = false
                if pressed { withAnimation(motion.snap) { pressed = false } }
            }
            .onAppear {
                onScreen = true
                if attitude == nil && !reduceMotion { device.start() }
            }
            .onDisappear {
                onScreen = false
                device.stop()
            }
            .onChange(of: scenePhase) { _, phase in
                // Core Motion keeps the sensors on; never run it in the background.
                if phase == .active && onScreen && attitude == nil && !reduceMotion { device.start() } else { device.stop() }
            }
            .onChange(of: reduceMotion) { _, reduce in
                // The setting can change while the card is on screen: the sensors stop with it and start again after.
                if reduce {
                    device.stop()
                    // The card is already flat. Level the filter too, so turning the setting off later doesn't show
                    // the last tilt for a frame and then drift flat.
                    device.roll = 0
                    device.pitch = 0
                } else if onScreen && attitude == nil && scenePhase == .active {
                    device.start()
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(action == nil ? [] : .isButton)
    }

    /// Publishes filtered roll/pitch (-1...1) relative to a neutral pose that follows the grip. No-op in the simulator.
    @Observable
    @MainActor
    fileprivate final class Motion {
        var roll: Double = 0
        var pitch: Double = 0
        private var neutral: (roll: Double, pitch: Double)?
        private let manager = CMMotionManager()

        func start() {
            guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
            manager.deviceMotionUpdateInterval = 1.0 / 60.0
            manager.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
                guard let data else { return }
                let roll = data.attitude.roll
                let pitch = data.attitude.pitch
                MainActor.assumeIsolated { self?.ingest(roll: roll, pitch: pitch) }
            }
        }

        func stop() {
            manager.stopDeviceMotionUpdates()
            neutral = nil
        }

        /// Exponential filter: each sample moves the output 15% of the way to the target, which removes hand jitter without lag you can feel.
        private func ingest(roll rawRoll: Double, pitch rawPitch: Double) {
            // Flat is the pose at start, then drifts toward the current one over about ten seconds (1/600 a sample
            // at 60Hz), so the card levels out again after the hand settles into a new grip.
            var neutral = neutral ?? (rawRoll, rawPitch)
            neutral.roll += (rawRoll - neutral.roll).remainder(dividingBy: 2 * .pi) / 600
            neutral.pitch += (rawPitch - neutral.pitch) / 600
            self.neutral = neutral
            let targetRoll = Self.soften((rawRoll - neutral.roll).remainder(dividingBy: 2 * .pi) / (.pi / 5))
            let targetPitch = Self.soften((rawPitch - neutral.pitch) / (.pi / 5))
            roll += (targetRoll - roll) * 0.15
            pitch += (targetPitch - pitch) * 0.15
        }

        /// Linear to 0.7, then rubber-band resistance easing toward 1 without reaching it, so the card slows into its
        /// limit instead of stopping dead. A coefficient of 1 keeps the slope continuous where the band begins.
        private static func soften(_ value: Double) -> Double {
            Double(PieceMotion.rubberBand(CGFloat(value), in: -0.7...0.7, limit: 0.3, coefficient: 1))
        }
    }
}

/// The card's outline: a continuous rounded rectangle, less the side notches when the style asks for them.
private struct CardShape: Shape {
    var cornerRadius: CGFloat
    var notchRadius: CGFloat
    var notchPosition: CGFloat

    func path(in rect: CGRect) -> Path {
        let card = Path(roundedRect: rect, cornerRadius: cornerRadius, style: .continuous)
        guard notchRadius > 0 else { return card }
        let y = rect.minY + rect.height * notchPosition, r = notchRadius
        var notches = Path()
        notches.addEllipse(in: CGRect(x: rect.minX - r, y: y - r, width: r * 2, height: r * 2))
        notches.addEllipse(in: CGRect(x: rect.maxX - r, y: y - r, width: r * 2, height: r * 2))
        return card.subtracting(notches)
    }
}

// MARK: - Example

/// A film ticket: a red block with a large title, seat numerals, liquid glass caption chips, and a tear line between
/// two notches cut clean through the card.
private struct MotionCardExample: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var tilt = CGSize(width: 0.4, height: -0.25)

    /// Where the tear line runs, as a fraction of the ticket's height. The notches sit on it.
    private let tear: CGFloat = 0.64
    private let size = CGSize(width: 330, height: 244)

    private var ground: Color {
        colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933)
    }

    var body: some View {
        MotionCard(attitude: tilt, style: .init(notchRadius: 11, notchPosition: tear), action: {}) {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    // The caption chips are glass on the ticket's face. 12pt in and 28pt tall, so their ends are
                    // concentric with the card's 26pt corners, and their text lines up with the title below.
                    // On the card's face rather than floating off it, so they take no lift shadow.
                    PieceLiquidGroup(lift: false) {
                        HStack {
                            chip(Text("ADMIT ONE").font(.caption2.weight(.semibold)).tracking(1.2))
                            Spacer()
                            chip(Text("No. 0418").font(.system(.caption, design: .monospaced).weight(.semibold)))
                        }
                    }
                    // Light glass, so the ticket's dark ink reads on the bright card in either appearance.
                    .environment(\.colorScheme, .light)
                    .padding([.horizontal, .top], -10)
                    Spacer(minLength: 8)
                    Text("Late Show")
                        .font(.system(size: 40, weight: .semibold))
                        .tracking(-1.6)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("Sat 14 Nov  ·  Screen 3")
                        .font(.subheadline.weight(.semibold))
                        .opacity(0.62)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .padding([.horizontal, .top], 22)
                .padding(.bottom, 16)
                .frame(height: size.height * tear, alignment: .top)
                HStack(alignment: .firstTextBaseline, spacing: 24) {
                    seat("ROW", "F")
                    seat("SEAT", "12")
                    seat("DOORS", "21:40")
                }
                .padding(.horizontal, 22)
                .frame(maxHeight: .infinity)
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            // The tear line runs between the notches, stopping short of each.
            .overlay(alignment: .top) {
                TearLine()
                    .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4, 5]))
                    .opacity(0.3)
                    .frame(height: 1.5)
                    .padding(.horizontal, 19)
                    .offset(y: size.height * tear - 0.75)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ground)
        .task {
            // The simulator has no attitude, so the example drifts on its own. Each move is retargeted before it
            // settles, so it reads as a hand rather than a series of poses.
            let path = [CGSize(width: -0.5, height: 0.3), CGSize(width: 0.45, height: 0.4), CGSize(width: -0.3, height: -0.45), CGSize(width: 0.4, height: -0.25)]
            while !Task.isCancelled {
                for target in path {
                    try? await Task.sleep(for: .seconds(1.2))
                    withAnimation(.smooth(duration: 1.6)) { tilt = target }
                }
            }
        }
    }

    private func seat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .tracking(1)
                .opacity(0.62)
            Text(value)
                .font(.system(size: 30, weight: .semibold))
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }

    /// A caption chip: a small capsule of glass on the ticket. Nothing presses it on its own, so it never swells.
    private func chip(_ label: some View) -> some View {
        label
            .padding(.horizontal, 10)
            .frame(height: 28)
            .pieceLiquid(Capsule(), interactive: false)
    }

    private struct TearLine: Shape {
        func path(in rect: CGRect) -> Path {
            Path { $0.move(to: CGPoint(x: 0, y: rect.midY)); $0.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
        }
    }
}

#Preview("Light") {
    MotionCardExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    MotionCardExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, rubberBand, pressMath)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid)

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

// swiftpieces-liquid: end
