// swiftpieces:
// title: Silk
// description: A slowly folding silk surface lit by a movable light and shaded from a real gradient normal in a Metal shader, in house block fabrics and an adaptive standard style, with optional device-tilt lighting.
// category: backgrounds
// pro: onboarding-stack
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [background, shader, silk, motion, loop, palette]
// shaders: [Silk.metal]

import SwiftUI
import CoreMotion

/// Flowing silk background. Copy `Silk.metal` alongside this file.
/// The shader samples the fold height field three times to build a normal, then shades it with Blinn-Phong so the sheen sits on the folds facing the light.
///
/// - Parameters:
///   - style: Fabric color, sheen color, fold contrast and highlight tightness. `.standard` (default) follows light and dark; `.tangerine`, `.sky`, `.butter`, `.sage`, `.lilac` and `.sand` are solid house-block fabrics for panels and cards. `.ink`, `.graphite`, `.paper` and `.indigo` remain available.
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
        /// Solid tangerine block fabric. Put `#141414` ink on it.
        public static let tangerine = Style.block(0xFF5B3A)
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
        TimelineView(.animation(paused: reduceMotion && !tiltLight)) { context in
            let time = Float(context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600) * (reduceMotion ? 0 : speed))
            let lightPoint = CGPoint(
                x: light.x + (tiltLight ? tilt.offset.x : 0),
                y: light.y + (tiltLight ? tilt.offset.y : 0)
            )
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
        .onAppear { if tiltLight, scenePhase == .active { tilt.start() } }
        .onDisappear { tilt.stop() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, tiltLight { tilt.start() } else { tilt.stop() }
        }
    }
}

/// Low-passed device attitude, mapped to a light offset in unit coordinates. Runs only while started.
@MainActor @Observable private final class TiltSource {
    private(set) var offset = CGPoint.zero
    @ObservationIgnored private let manager = CMMotionManager()
    @ObservationIgnored private var reference: (roll: Double, pitch: Double)?

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
        offset = .zero
    }

    private func push(roll: Double, pitch: Double) {
        // Measure relative to the attitude at start so a reclined phone still lights from the configured point.
        let reference = reference ?? (roll, pitch)
        self.reference = reference
        let target = CGPoint(
            x: min(max((roll - reference.roll) * 0.6, -0.6), 0.6),
            y: min(max((pitch - reference.pitch) * 0.6, -0.6), 0.6)
        )
        offset = CGPoint(x: offset.x + (target.x - offset.x) * 0.15, y: offset.y + (target.y - offset.y) * 0.15)
    }
}

/// A solid sRGB color from a hex value.
private func silkColor(_ hex: UInt32) -> Color {
    Color(uiColor: silkUIColor(hex))
}

/// A color that resolves to `light` or `dark` with the current appearance.
private func silkColor(light: UInt32, dark: UInt32) -> Color {
    let l = silkUIColor(light), d = silkUIColor(dark)
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

private func silkUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// MARK: - Example

/// The fabric, full bleed, with nothing on top of it. `.tangerine` is used because the folds and the sheen read on a
/// solid house block the way silk reads on a bolt of cloth.
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
