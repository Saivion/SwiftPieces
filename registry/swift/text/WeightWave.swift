// swiftpieces:
// title: Weight Wave
// description: A wave of variable font weight and ink travels through a headline, peaking under the finger while dragging and sweeping slowly on its own when idle.
// category: text
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [text, variable-font, weight, drag, interactive, display]

import SwiftUI

/// Per-glyph variable weight on SF Pro, driven by touch, an ambient sweep, or scroll position.
/// Glyph weights are interpolated through `UIFont.Weight`'s continuous axis and concatenated into one `Text`, so the line still wraps.
///
/// - Parameters:
///   - text: The headline. Best at one or two lines.
///   - size: Point size before Dynamic Type scaling (relative to `.largeTitle`).
///   - light: Weight of glyphs far from the peak.
///   - heavy: Weight at the peak.
///   - spread: Width of the wave as a fraction of the line, 0.1–0.5.
///   - design: System font design, for example `.rounded`.
///   - mode: `.ambient` sweeps on its own and follows drags; `.scroll` moves the peak with the view's position inside a scroll view.
///   - period: Seconds for one ambient pass across the text.
///   - style: Tail ink opacity (the two-tone falloff away from the peak) and display tracking.
public struct WeightWave: View {
    public enum Mode { case ambient, scroll }

    /// Visual tuning. `standard` is a two-tone display look: glyphs away from the peak fall back to 38% ink.
    public struct Style: Sendable {
        /// Opacity of glyphs far from the peak, 0...1. The peak is always full ink. Set 1 for a single tone.
        public var tailOpacity: Double
        /// Letter spacing as a fraction of the point size. Display type reads best slightly tight.
        public var tracking: CGFloat
        /// How long the wave takes to blend to full strength under a finger, in seconds.
        public var grabDuration: Double

        public init(tailOpacity: Double = 0.38, tracking: CGFloat = -0.02, grabDuration: Double = 0.3) {
            self.tailOpacity = tailOpacity
            self.tracking = tracking
            self.grabDuration = grabDuration
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var typeScale: CGFloat = 1

    @State private var width: CGFloat = 1
    @State private var scrollProgress: CGFloat = 0.5
    @State private var finger: CGFloat? = nil
    @State private var pressedAt: TimeInterval = -1
    @State private var releasedAt: TimeInterval = -1
    @State private var ambientPhase: Double = 0
    @State private var wordUnderPeak = -1

    private let text: String
    private let size: CGFloat
    private let light: UIFont.Weight
    private let heavy: UIFont.Weight
    private let spread: CGFloat
    private let design: UIFontDescriptor.SystemDesign
    private let mode: Mode
    private let period: Double
    private let style: Style
    private let glyphs: [Glyph]

    private struct Glyph { let character: String; let center: CGFloat; let word: Int }
    private struct Geometry: Equatable { var width: CGFloat; var scroll: CGFloat }

    public init(
        _ text: String,
        size: CGFloat = 40,
        light: UIFont.Weight = .light,
        heavy: UIFont.Weight = .black,
        spread: CGFloat = 0.22,
        design: UIFontDescriptor.SystemDesign = .default,
        mode: Mode = .ambient,
        period: Double = 4,
        style: Style = .standard
    ) {
        self.style = style
        self.text = text
        self.size = size
        self.light = light
        self.heavy = heavy
        self.spread = max(0.05, spread)
        self.design = design
        self.mode = mode
        self.period = period

        // Glyph centers along a single line at the middle weight, normalized 0...1; weight changes shift them only slightly.
        let probe = UIFont.systemFont(ofSize: size, weight: .medium)
        let kern = size * style.tracking
        var built: [Glyph] = []
        var x: CGFloat = 0
        var word = 0
        var inWord = false
        for character in text {
            let advance = (String(character) as NSString).size(withAttributes: [.font: probe]).width
            if character.isWhitespace {
                inWord = false
            } else if !inWord {
                inWord = true
                word += 1
            }
            built.append(Glyph(character: String(character), center: x + advance / 2, word: word))
            x += advance + kern
        }
        let total = max(x, 1)
        glyphs = built.map { Glyph(character: $0.character, center: $0.center / total, word: $0.word) }
    }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion || mode == .scroll)) { context in
            let now = context.date.timeIntervalSinceReferenceDate
            styledText(peak: peak(at: now), strength: strength(at: now))
        }
        .contentShape(Rectangle())
        .simultaneousGesture(drag, including: mode == .ambient ? .all : .none)
        .onGeometryChange(for: Geometry.self) { proxy in
            let frame = proxy.frame(in: .scrollView)
            let bounds = proxy.bounds(of: .scrollView) ?? frame
            return Geometry(width: proxy.size.width, scroll: (frame.midY - bounds.minY) / max(bounds.height, 1))
        } action: { geometry in
            width = max(geometry.width, 1)
            scrollProgress = 1 - min(max(geometry.scroll, 0), 1)
        }
        .sensoryFeedback(.selection, trigger: wordUnderPeak) { old, new in old >= 0 && new >= 0 }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    // MARK: Wave position

    private func peak(at now: TimeInterval) -> CGFloat {
        if let finger { return finger }
        switch mode {
        case .scroll: return scrollProgress
        case .ambient: return reduceMotion ? 0.38 : ambientPosition(at: now)
        }
    }

    private func ambientPosition(at now: TimeInterval) -> CGFloat {
        CGFloat(0.5 - 0.5 * cos(now * 2 * .pi / period + ambientPhase))
    }

    /// 0.7 when idle, 1 under the finger, blended over a few hundred milliseconds either way.
    private func strength(at now: TimeInterval) -> CGFloat {
        let idle: CGFloat = 0.7
        if reduceMotion { return finger == nil ? idle : 1 }
        let blend: CGFloat
        if finger != nil {
            blend = min(1, CGFloat(now - pressedAt) / max(style.grabDuration, 0.01))
        } else if releasedAt > 0 {
            blend = max(0, 1 - CGFloat(now - releasedAt) / 0.5)
        } else {
            blend = 0
        }
        return idle + (1 - idle) * blend
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let position = min(max(value.location.x / width, 0), 1)
                if finger == nil { pressedAt = Date().timeIntervalSinceReferenceDate }
                finger = position
                if let nearest = glyphs.min(by: { abs($0.center - position) < abs($1.center - position) }) {
                    wordUnderPeak = nearest.word
                }
            }
            .onEnded { value in
                guard let position = finger else { return }
                let now = Date().timeIntervalSinceReferenceDate
                // Re-phase the ambient sweep so it continues from the finger's position, travelling in the drag direction.
                let angle = acos(Double(1 - 2 * position))
                let forward = value.predictedEndLocation.x >= value.location.x
                ambientPhase = (forward ? angle : -angle) - now * 2 * .pi / period
                releasedAt = now
                finger = nil
                wordUnderPeak = -1
            }
    }

    // MARK: Rendering

    private func styledText(peak: CGFloat, strength: CGFloat) -> Text {
        let pointSize = size * typeScale
        var result = Text(verbatim: "")
        for glyph in glyphs {
            let distance = abs(glyph.center - peak) / spread
            let bump = distance >= 1 ? 0 : (1 - distance * distance) * (1 - distance * distance)
            let mix = bump * strength
            var styled = Text(verbatim: glyph.character)
                .font(font(size: pointSize, mix: mix))
                .tracking(pointSize * style.tracking)
            if style.tailOpacity < 1 {
                // `.foreground` is the inherited foreground style, so a caller's color survives the two-tone falloff.
                let opacity = style.tailOpacity + (1 - style.tailOpacity) * min(1, mix / 0.7)
                styled = styled.foregroundStyle(.foreground.opacity((opacity * 20).rounded() / 20))
            }
            result = Text("\(result)\(styled)")
        }
        return result
    }

    private func font(size pointSize: CGFloat, mix: CGFloat) -> Font {
        // Quantize so consecutive frames reuse the same UIFont instances.
        let step = (mix * 32).rounded() / 32
        let weight = UIFont.Weight(rawValue: light.rawValue + (heavy.rawValue - light.rawValue) * step)
        let base = UIFont.systemFont(ofSize: pointSize, weight: weight)
        guard design != .default, let descriptor = base.fontDescriptor.withDesign(design) else { return Font(base) }
        return Font(UIFont(descriptor: descriptor, size: pointSize))
    }
}

// MARK: - Example

/// The component alone: one track title as the wave, centred on the stage.
private struct WeightWaveExample: View {
    var body: some View {
        WeightWave("Low Tide", size: 92, light: .ultraLight, heavy: .black, spread: 0.3, period: 3.6)
            .foregroundStyle(WeightWavePalette.text)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(WeightWavePalette.ground)
    }
}

private enum WeightWavePalette {
    static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
    static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

#Preview("Light") {
    WeightWaveExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    WeightWaveExample()
        .preferredColorScheme(.dark)
}
