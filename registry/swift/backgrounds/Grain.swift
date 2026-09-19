// swiftpieces:
// title: Grain
// description: "Film grain as a view modifier and a ready-made backdrop: luminance-weighted so it peaks in midtones, soft-light blended, dithered so it never aliases at 3x, with an adaptive standard ground and house block gradients."
// category: backgrounds
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [background, shader, grain, modifier, texture, palette]
// shaders: [Grain.metal]

import SwiftUI

/// A full-bleed grainy gradient backdrop built on `.grain(...)`. Copy `Grain.metal` alongside this file.
///
/// - Parameters:
///   - colors: Gradient colors, top to bottom. When set, they override `style`.
///   - amount: Grain strength, 0–1.
///   - blend: `.softLight` (default) keeps blacks and whites clean; `.linear` adds the noise directly.
///   - animated: Whether the grain flickers at 24 fps.
///   - style: The gradient when `colors` is nil. `.standard` (default) is a quiet paper or charcoal ground that follows light and dark; `.tangerine`, `.sky`, `.lilac`, `.sage` and `.sand` are house block gradients for posters, cards and heroes.
public struct Grain: View {
    /// How the noise is composited onto the content.
    public enum Blend: Sendable { case softLight, linear }

    /// Gradient colors and direction for the backdrop.
    public struct Style: Sendable {
        public var colors: [Color]
        public var startPoint: UnitPoint
        public var endPoint: UnitPoint

        public init(colors: [Color], startPoint: UnitPoint = .top, endPoint: UnitPoint = .bottom) {
            self.colors = colors
            self.startPoint = startPoint
            self.endPoint = endPoint
        }

        /// Paper to warm stone in light, charcoal to near-black in dark.
        public static let standard = Style(colors: [grainColor(light: 0xF3F2EE, dark: 0x1C1C1C), grainColor(light: 0xE6E1D6, dark: 0x121212)])
        /// Tangerine into butter.
        public static let tangerine = Style(colors: [grainColor(0xFF5B3A), grainColor(0xFFD976)], startPoint: .topLeading, endPoint: .bottomTrailing)
        /// Sky into lilac.
        public static let sky = Style(colors: [grainColor(0x9CC2FF), grainColor(0xCDB8FF)], startPoint: .topLeading, endPoint: .bottomTrailing)
        /// Lilac into tangerine.
        public static let lilac = Style(colors: [grainColor(0xCDB8FF), grainColor(0xFF5B3A)], startPoint: .topLeading, endPoint: .bottomTrailing)
        /// Sage into butter.
        public static let sage = Style(colors: [grainColor(0xA9DCB7), grainColor(0xFFD976)], startPoint: .topLeading, endPoint: .bottomTrailing)
        /// Sand into tangerine.
        public static let sand = Style(colors: [grainColor(0xE9D5B3), grainColor(0xFF5B3A)], startPoint: .top, endPoint: .bottom)
    }

    private let colors: [Color]?
    private let amount: Float
    private let blend: Blend
    private let animated: Bool
    private let style: Style

    public init(
        colors: [Color]? = nil,
        amount: Float = 0.5,
        blend: Blend = .softLight,
        animated: Bool = true,
        style: Style = .standard
    ) {
        self.colors = colors
        self.amount = amount
        self.blend = blend
        self.animated = animated
        self.style = style
    }

    public var body: some View {
        LinearGradient(colors: colors ?? style.colors, startPoint: colors == nil ? style.startPoint : .top, endPoint: colors == nil ? style.endPoint : .bottom)
            .grain(amount: amount, blend: blend, animated: animated)
            .ignoresSafeArea()
            .accessibilityHidden(true)
    }
}

public extension View {
    /// Adds film grain on top of this view via a Metal `colorEffect`. Requires `Grain.metal` in the target.
    ///
    /// - Parameters:
    ///   - amount: Grain strength, 0–1. 0.5 is visible but quiet on a photo; 0.2 is a texture hint.
    ///   - scale: Grain cell size in points. Values below 1 look like fine 35 mm stock.
    ///   - blend: `.softLight` (default) or `.linear`.
    ///   - animated: Whether the grain flickers. Pauses under Reduce Motion.
    func grain(amount: Float = 0.5, scale: Float = 1.2, blend: Grain.Blend = .softLight, animated: Bool = true) -> some View {
        modifier(GrainModifier(amount: amount, scale: scale, blend: blend, animated: animated))
    }
}

private struct GrainModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let amount: Float
    let scale: Float
    let blend: Grain.Blend
    let animated: Bool

    func body(content: Content) -> some View {
        // 24 fps is the film cadence and a quarter of the redraws of a display-rate timeline.
        TimelineView(.animation(minimumInterval: 1 / 24, paused: !animated || reduceMotion)) { context in
            let frame = Float(context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1000) * 24)
            content.colorEffect(
                ShaderLibrary.grain(
                    .float(frame.rounded(.down)),
                    .float(amount),
                    .float(max(scale, 0.25)),
                    .float(blend == .softLight ? 1 : 0)
                )
            )
        }
    }
}

/// A solid sRGB color from a hex value.
private func grainColor(_ hex: UInt32) -> Color {
    Color(uiColor: grainUIColor(hex))
}

/// A color that resolves to `light` or `dark` with the current appearance.
private func grainColor(light: UInt32, dark: UInt32) -> Color {
    let l = grainUIColor(light), d = grainUIColor(dark)
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

private func grainUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// MARK: - Example

/// The grain over the surface it grains, full bleed, with nothing else on it. `.sky` is used because the grain reads
/// on a house block gradient the way it reads on a printed poster.
private struct GrainExample: View {
    var body: some View {
        Grain(amount: 0.7, style: .sky)
            .ignoresSafeArea()
    }
}

#Preview("Light") {
    GrainExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    GrainExample().preferredColorScheme(.dark)
}
