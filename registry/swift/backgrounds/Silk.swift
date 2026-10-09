// swiftpieces:
// title: Silk
// description: A slowly folding silk surface lit by a movable light and shaded from a real gradient normal in a Metal shader, in house block fabrics (the brand red among them) and an adaptive standard style, with optional device-tilt lighting. Content only, so it carries no glass.
// category: backgrounds
// pro: onboarding-stack
// minIOSVersion: "17.0"
// version: "2.2.0"
// tags: [background, shader, silk, motion, loop, palette]
// shaders: [Silk.metal]

import SwiftUI
import CoreMotion

/// Flowing silk background. Copy `Silk.metal` alongside this file.
/// The shader samples the fold height field three times to build a normal, then shades it with Blinn-Phong so the sheen sits on the folds facing the light.
/// It is a surface for content and glass controls to sit on, so it draws no glass and no text of its own.
///
/// - Parameters:
///   - style: Fabric color, sheen color, fold contrast and highlight tightness. `.standard` (default) follows light and dark; `.tangerine` (the brand red, `#FF0000`), `.sky`, `.butter`, `.sage`, `.lilac` and `.sand` are solid house-block fabrics for panels and cards. `.ink`, `.graphite`, `.paper` and `.indigo` remain available.
///   - light: Where the light comes from, in unit coordinates of the view. Top-left by default.
///   - tiltLight: When true, the device's attitude moves the light. Uses Core Motion and stops whenever the scene is not active.
///   - scale: Pattern zoom; larger is finer folds.
///   - speed: Time multiplier.
public struct Silk: View {
    /// Material recipe for the fabric.
    public struct Style: Sendable {
        public var tint: Color
        public var sheen: Color
        /// How dark the shadowed side of a fold gets, 0–1.
        public var depth: Float
        /// Specular exponent; higher is a tighter, glossier highlight.
        public var shine: Float

        public init(tint: Color, sheen: Color, depth: Float = 0.5, shine: Float = 24) {
            self.tint = tint
            self.sheen = sheen
            self.depth = depth
            self.shine = shine
        }

        // MARK: House styles

        /// Stone fabric with a white sheen in light; charcoal with a sand sheen in dark.
        public static let standard = Style(tint: silkColor(light: 0xE7E4DC, dark: 0x1C1C1C), sheen: silkColor(light: 0xFFFFFF, dark: 0xE9D5B3), depth: 0.42, shine: 26)
        /// Solid brand red block fabric, `#FF0000`, kept under its earlier name. Put `#141414` ink on it.
        public static let tangerine = Style.block(0xFF0000)
        /// Solid sky block fabric. Put `#141414` ink on it.
        public static let sky = Style.block(0x9CC2FF)
        /// Solid butter block fabric. Put `#141414` ink on it.
        public static let butter = Style.block(0xFFD976)
        /// Solid sage block fabric. Put `#141414` ink on it.
        public static let sage = Style.block(0xA9DCB7)
        /// Solid lilac block fabric. Put `#141414` ink on it.
        public static let lilac = Style.block(0xCDB8FF)
        /// Solid sand block fabric. Put `#141414` ink on it.
        public static let sand = Style.block(0xE9D5B3)

        private static func block(_ hex: UInt32) -> Style {
            Style(tint: silkColor(hex), sheen: silkColor(0xFFFFFF), depth: 0.3, shine: 22)
        }

        // MARK: Earlier styles

        public static let ink = Style(tint: Color(red: 0.09, green: 0.10, blue: 0.14), sheen: Color(red: 0.55, green: 0.60, blue: 0.75), depth: 0.5, shine: 24)
        public static let graphite = Style(tint: Color(red: 0.16, green: 0.16, blue: 0.17), sheen: Color(red: 0.72, green: 0.72, blue: 0.74), depth: 0.45, shine: 20)
        public static let paper = Style(tint: Color(red: 0.91, green: 0.90, blue: 0.87), sheen: .white, depth: 0.16, shine: 32)
        public static let indigo = Style(tint: Color(red: 0.30, green: 0.27, blue: 0.78), sheen: Color(red: 0.86, green: 0.82, blue: 1.0), depth: 0.55, shine: 28)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var tilt = TiltSource()
    @State private var clock = SilkClock()
    /// Core Motion starts only while this is true, so a covered tab or a pushed-over root never runs it.
    @State private var isVisible = false
    /// When the folds or the tilt light were last told to stop. The clock runs on for a moment after it, so both ease
    /// to rest before the timeline pauses.
    @State private var stoppedAt: Date?

    private let style: Style
    private let light: UnitPoint
    private let tiltLight: Bool
    private let scale: Float
    private let speed: Double

    public init(style: Style = .standard, light: UnitPoint = UnitPoint(x: 0.3, y: 0.2), tiltLight: Bool = false, scale: Float = 2, speed: Double = 1) {
        self.style = style
        self.light = light
        self.tiltLight = tiltLight
        self.scale = scale
        self.speed = speed
    }

    public var body: some View {
        // The folds drift only while ambient motion is allowed and `speed` is not 0; the tilt light keeps the clock
        // running on its own, since it is user-driven. Otherwise nothing on screen changes once both have eased to
        // rest, so the timeline pauses. At most 60 fps: at the default speed the folds move about half a point a
        // frame, so 120 Hz adds cost, not smoothness.
        let drifting = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
        let running = (drifting && speed != 0) || tiltLight || stoppedAt != nil
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !running)) { context in
            let frame = clock.advance(to: context.date, speed: speed, holds: !drifting, light: tiltLight ? tilt.target : .zero)
            let time = frame.time
            let lightPoint = CGPoint(x: light.x + frame.light.x, y: light.y + frame.light.y)
            Rectangle()
                .visualEffect { content, proxy in
                    content.colorEffect(
                        ShaderLibrary.silk(
                            .float2(proxy.size),
                            .float(time),
                            .color(style.tint),
                            .color(style.sheen),
                            .float(scale),
                            .float2(lightPoint),
                            .float(style.depth),
                            .float(style.shine)
                        )
                    )
                }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .onAppear {
            isVisible = true
            if tiltLight, scenePhase == .active { tilt.start() }
        }
        .onDisappear {
            isVisible = false
            tilt.stop()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, tiltLight, isVisible { tilt.start() } else { tilt.stop() }
        }
        .onChange(of: tiltLight) { _, on in
            if on, scenePhase == .active, isVisible { tilt.start() } else { tilt.stop() }
            if !on { stoppedAt = .now }
        }
        .onChange(of: speed) { _, new in
            if new == 0 { stoppedAt = .now }
        }
        .task(id: stoppedAt) {
            guard let stop = stoppedAt else { return }
            // Five of the drift's 0.4 s time constants and ten of the light's: both at rest to the eye. A disappearance
            // cancels the wait but keeps the window, so it reopens on return and the light still gets home.
            do { try await Task.sleep(for: .seconds(2)) } catch { return }
            // A newer stop restarted the wait; leave its window open.
            if stoppedAt == stop { stoppedAt = nil }
        }
    }
}

/// Per-frame state the timeline advances: the fold phase, its rate and the light as drawn. Not observed, so a frame
/// never invalidates the view, and a repeated date advances nothing.
@MainActor private final class SilkClock {
    /// Silk.metal's fold rates (0.35, 1, 1.3, 0.7, 0.5 and 0.4 per unit of its `t`, which is time x 0.3) all repeat after
    /// 40π, so the phase wraps there without a seam and stays small for Float. Update it if those rates change.
    private static let period = 40 * Double.pi / 0.3
    private var phase = 0.0
    private var rate = 0.0
    private var light = CGPoint.zero
    private var last: Date?

    nonisolated init() {}

    /// Advances to `date` and returns the shader time and the light offset to draw. The phase starts at 0, the rest
    /// pose, on the first frame.
    func advance(to date: Date, speed: Double, holds: Bool, light target: CGPoint) -> (time: Float, light: CGPoint) {
        // At most a tenth of a second, so resuming after a pause or the background never leaps.
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        // The drift eases to speed, 0 included, over about a second: from rest at appearance, after Reduce Motion and
        // to every new speed. Reduce Motion (`holds`) stops it at once where it is.
        rate = holds ? 0 : rate + (speed - rate) * (1 - exp(-dt / 0.4))
        phase = (phase + rate * dt).truncatingRemainder(dividingBy: Self.period)
        // The low-pass the 30 Hz samples used to get (0.2 s time constant), now per frame, so the light glides between
        // samples and back to rest instead of stepping. Never snapped to `target`: the frame that turns `tiltLight` off
        // is drawn before `stoppedAt` keeps the clock running, and a snap there would jump the light home.
        let k = 1 - exp(-dt / 0.2)
        light = CGPoint(x: light.x + (target.x - light.x) * k, y: light.y + (target.y - light.y) * k)
        return (Float(phase), light)
    }
}

/// Device attitude relative to the attitude at start, mapped to a light offset in unit coordinates. Runs only while
/// started; the clock eases the drawn light toward `target` every frame.
@MainActor private final class TiltSource {
    private(set) var target = CGPoint.zero
    private let manager = CMMotionManager()
    private var reference: (roll: Double, pitch: Double)?

    nonisolated init() {}

    func start() {
        guard !manager.isDeviceMotionActive, manager.isDeviceMotionAvailable else { return }
        manager.deviceMotionUpdateInterval = 1 / 30
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let motion else { return }
            let roll = motion.attitude.roll
            let pitch = motion.attitude.pitch
            Task { @MainActor in self?.push(roll: roll, pitch: pitch) }
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        reference = nil
        // The view can still be on screen (Control Center, the app switcher), so the light glides home, not jumps.
        target = .zero
    }

    private func push(roll: Double, pitch: Double) {
        // A sample still in flight after stop() would otherwise leave a stale reference for the next start.
        guard manager.isDeviceMotionActive else { return }
        // Measure relative to the attitude at start so a reclined phone still lights from the configured point.
        let reference = reference ?? (roll, pitch)
        self.reference = reference
        // Gain 0.6 near rest, easing toward ±0.6 instead of stopping dead at it.
        target = CGPoint(x: 0.6 * tanh(roll - reference.roll), y: 0.6 * tanh(pitch - reference.pitch))
    }
}

/// A solid sRGB color from a hex value.
private func silkColor(_ hex: UInt32) -> Color {
    Color(uiColor: silkUIColor(hex))
}

/// A color that resolves to `light` or `dark` with the current appearance.
private func silkColor(light: UInt32, dark: UInt32) -> Color {
    let l = silkUIColor(light), d = silkUIColor(dark)
    return Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? d : l })
}

private func silkUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// MARK: - Example

/// The fabric, full bleed, with nothing on top of it. The brand red `.tangerine` is used because the folds and the
/// sheen read on a solid house block the way silk reads on a bolt of cloth.
private struct SilkExample: View {
    var body: some View {
        Silk(style: .tangerine, scale: 2.6)
            .ignoresSafeArea()
    }
}

#Preview("Light") {
    SilkExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    SilkExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

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

// swiftpieces-motion: end
