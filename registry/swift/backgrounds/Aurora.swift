// swiftpieces:
// title: Aurora
// description: Slow aurora curtains with crisp lower edges and soft rising tails, rendered by a Metal color shader over a ground that adapts to light and dark, in house block palettes with an intensity dial.
// category: backgrounds
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [background, shader, aurora, loop, palette]
// shaders: [Aurora.metal]

import SwiftUI

/// Animated aurora rendered with `.colorEffect` and a stitchable Metal shader.
/// Copy `Aurora.metal` alongside this file; it compiles into your app's default Metal library.
///
/// - Parameters:
///   - palette: Ground color and three curtain colors. `.standard` (default) puts tangerine, lilac and sky over a ground that follows light and dark; `.ember`, `.lagoon` and `.orchard` are the other house palettes. `.dusk`, `.ink`, `.graphite`, `.paper` and `.vivid` remain available.
///   - intensity: Curtain coverage and brightness, 0–1.5. Around 0.6 reads as a tint behind content; 1 is a hero backdrop.
///   - speed: Time multiplier for the drift.
public struct Aurora: View {
    /// A ground color and three curtain colors. Colors may be dynamic; they resolve against the current appearance.
    public struct Palette: Sendable {
        public var base: Color
        public var ribbons: [Color]

        public init(base: Color, ribbons: [Color]) {
            precondition(ribbons.count == 3, "Aurora.Palette needs exactly three ribbon colors")
            self.base = base
            self.ribbons = ribbons
        }

        // MARK: House palettes

        /// Tangerine, lilac and sky curtains over paper in light and near-black in dark.
        public static let standard = Palette(base: auroraColor(light: 0xF3F2EE, dark: 0x121212), ribbons: [auroraColor(0xFF5B3A), auroraColor(0xCDB8FF), auroraColor(0x9CC2FF)])
        /// Warm: tangerine, butter and sand.
        public static let ember = Palette(base: auroraColor(light: 0xF3F2EE, dark: 0x121212), ribbons: [auroraColor(0xFF5B3A), auroraColor(0xFFD976), auroraColor(0xE9D5B3)])
        /// Cool: sky, sage and lilac.
        public static let lagoon = Palette(base: auroraColor(light: 0xF3F2EE, dark: 0x121212), ribbons: [auroraColor(0x9CC2FF), auroraColor(0xA9DCB7), auroraColor(0xCDB8FF)])
        /// Fresh: sage, butter and tangerine.
        public static let orchard = Palette(base: auroraColor(light: 0xF3F2EE, dark: 0x121212), ribbons: [auroraColor(0xA9DCB7), auroraColor(0xFFD976), auroraColor(0xFF5B3A)])

        // MARK: Earlier palettes

        /// Deep navy with lavender, dusty teal and rose ribbons.
        public static let dusk = Palette(
            base: Color(red: 0.06, green: 0.06, blue: 0.10),
            ribbons: [Color(red: 0.52, green: 0.48, blue: 0.80), Color(red: 0.32, green: 0.58, blue: 0.62), Color(red: 0.74, green: 0.48, blue: 0.56)]
        )
        /// Near-black with slate and indigo ribbons.
        public static let ink = Palette(
            base: Color(red: 0.03, green: 0.03, blue: 0.045),
            ribbons: [Color(red: 0.34, green: 0.42, blue: 0.62), Color(red: 0.46, green: 0.52, blue: 0.60), Color(red: 0.30, green: 0.30, blue: 0.52)]
        )
        /// Monochrome graphite: three greys over charcoal.
        public static let graphite = Palette(
            base: Color(red: 0.10, green: 0.10, blue: 0.11),
            ribbons: [Color(red: 0.42, green: 0.43, blue: 0.47), Color(red: 0.58, green: 0.58, blue: 0.60), Color(red: 0.32, green: 0.33, blue: 0.37)]
        )
        /// Warm off-white with pastel ribbons, for light interfaces.
        public static let paper = Palette(
            base: Color(red: 0.965, green: 0.955, blue: 0.935),
            ribbons: [Color(red: 0.80, green: 0.78, blue: 0.90), Color(red: 0.74, green: 0.86, blue: 0.87), Color(red: 0.93, green: 0.82, blue: 0.82)]
        )
        /// Saturated green, blue and magenta ribbons over midnight.
        public static let vivid = Palette(
            base: Color(red: 0.02, green: 0.03, blue: 0.08),
            ribbons: [Color(red: 0.2, green: 0.9, blue: 0.7), Color(red: 0.4, green: 0.5, blue: 1.0), Color(red: 0.9, green: 0.3, blue: 0.8)]
        )
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let palette: Palette
    private let intensity: Float
    private let speed: Double

    public init(palette: Palette = .standard, intensity: Float = 1, speed: Double = 1) {
        self.palette = palette
        self.intensity = intensity
        self.speed = speed
    }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let time = Float(context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600) * speed)
            palette.base
                .overlay {
                    Rectangle()
                        .visualEffect { content, proxy in
                            content.colorEffect(
                                ShaderLibrary.aurora(
                                    .float2(proxy.size),
                                    .float(time),
                                    .color(palette.ribbons[0]),
                                    .color(palette.ribbons[1]),
                                    .color(palette.ribbons[2]),
                                    .float(intensity)
                                )
                            )
                        }
                }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

/// A solid sRGB color from a hex value.
private func auroraColor(_ hex: UInt32) -> Color {
    Color(uiColor: auroraUIColor(hex))
}

/// A color that resolves to `light` or `dark` with the current appearance.
private func auroraColor(light: UInt32, dark: UInt32) -> Color {
    let l = auroraUIColor(light), d = auroraUIColor(dark)
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

private func auroraUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// MARK: - Example

/// The curtains, full bleed. The piece is the field, so nothing sits on top of it.
private struct AuroraExample: View {
    var body: some View {
        Aurora()
            .ignoresSafeArea()
    }
}

#Preview("Light") {
    AuroraExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    AuroraExample().preferredColorScheme(.dark)
}
