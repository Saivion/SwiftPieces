// swiftpieces:
// title: Thinking State
// description: "The \"assistant is working\" placeholder, laid out like the reply it becomes: a breathing mark with an elapsed-seconds label over three presentations on one clock: block-colored rising dots, a sheen over reply-shaped bars, or a label whose glyphs carry the sheen. Plus a modifier that sweeps any view."
// category: ai
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: tool-execution-card
// tags: [loading, thinking, sheen, placeholder, ai, elapsed]

import SwiftUI
import UIKit

/// Placeholder for a reply that has not started. Every presentation mirrors the `StreamingReply` layout (mark and label, then content) so it resolves into the real message without a layout jump.
///
/// - Parameters:
///   - presentation: `.dots`, `.sheen` (reply-shaped bars), or `.text(label)`.
///   - tint: Optional single color for the dots, mark and sheen. `nil` uses the house blocks for the dots and a neutral sheen.
///   - lineCount: Number of placeholder bars in the `.sheen` presentation.
///   - duration: Seconds per sheen sweep; the dots and mark breathe on the same clock.
///   - style: Colors, the assistant name and whether the header with elapsed seconds shows. Defaults to the house palette.
public struct ThinkingState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    private let presentation: Presentation
    private let tint: Color?
    private let lineCount: Int
    private let duration: Double
    private let style: Style

    public enum Presentation: Equatable, Sendable {
        case dots
        case sheen
        case text(String)
    }

    public init(_ presentation: Presentation = .sheen, tint: Color? = nil, lineCount: Int = 3, duration: Double = 2.2, style: Style = .standard) {
        self.presentation = presentation
        self.tint = tint
        self.lineCount = max(1, lineCount)
        self.duration = duration
        self.style = style
    }

    public var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil, paused: false)) { context in
            let t = reduceMotion ? 0.5 : context.date.timeIntervalSinceReferenceDate
            let sweep = reduceMotion ? 0.5 : t.truncatingRemainder(dividingBy: duration) / duration
            let breath = reduceMotion ? 0.5 : (sin(t * 2 * .pi / duration) + 1) / 2
            let elapsed = Int(context.date.timeIntervalSince(start))
            VStack(alignment: .leading, spacing: 10) {
                if style.showsHeader { header(breath: breath, elapsed: elapsed) }
                content(time: t, sweep: sweep)
            }
        }
        .padding(.vertical, 4)
        .padding(.trailing, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var label: String {
        if case .text(let text) = presentation { return text }
        return "Thinking"
    }

    /// The reply header while it works: a breathing mark, the name, and seconds so far.
    private func header(breath: Double, elapsed: Int) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(tint ?? style.mark)
                    .scaleEffect(0.84 + 0.16 * breath)
                Image(systemName: "sparkle")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint == nil ? style.markInk : style.ink)
                    .rotationEffect(.degrees(reduceMotion ? 0 : breath * 45))
            }
            .frame(width: 24, height: 24)
            Text(style.assistantName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.text)
            Text("THINKING · \(elapsed)S")
                .font(.caption2.weight(.bold))
                .tracking(0.8)
                .monospacedDigit()
                .foregroundStyle(style.muted)
                .contentTransition(.numericText(value: Double(elapsed)))
        }
    }

    @ViewBuilder
    private func content(time: Double, sweep: Double) -> some View {
        switch presentation {
        case .dots:
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    let phase = reduceMotion ? 0.5 : ((time * 0.9 - Double(index) * 0.16).truncatingRemainder(dividingBy: 1) + 1).truncatingRemainder(dividingBy: 1)
                    let lift = phase < 0.45 ? sin(phase / 0.45 * .pi) : 0
                    Circle()
                        .fill(tint ?? style.dots[index % max(style.dots.count, 1)])
                        .frame(width: 9, height: 9)
                        .scaleEffect(0.8 + 0.2 * lift)
                        .offset(y: -5 * lift)
                }
            }
            .frame(height: lineHeight)
        case .sheen:
            bars
                .overlay { ThinkingSheen(sweep: sweep, color: tint ?? style.sheen, strength: tint == nil ? 1 : 0.6).mask(bars) }
        case .text(let text):
            let label = Text(text).font(.body)
            label
                .foregroundStyle(style.muted)
                .overlay { ThinkingSheen(sweep: sweep, color: tint ?? style.text, strength: 1).mask(label) }
        }
    }

    /// Reply-shaped placeholder bars: full, slightly short, and a trailing short bar.
    private var bars: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(0..<lineCount, id: \.self) { index in
                Capsule()
                    .fill(style.bar)
                    .frame(height: lineHeight * 0.6)
                    .padding(.trailing, index == lineCount - 1 ? 110 : (index.isMultiple(of: 2) ? 0 : 32))
            }
        }
        .frame(minHeight: lineHeight)
    }

    private var lineHeight: CGFloat { UIFont.preferredFont(forTextStyle: .body).lineHeight }
}

public extension ThinkingState {
    /// Look of a `ThinkingState`. Start from `.standard` and change what you need.
    struct Style: Sendable {
        /// The three dots, in order, unless `tint` is passed.
        public var dots: [Color] = [Color(red: 1, green: 0, blue: 0), Color(red: 0.612, green: 0.761, blue: 1), Color(red: 0.804, green: 0.722, blue: 1)]
        /// Placeholder bar fill.
        public var bar: Color = Style.adaptive(0xE4E2DC, 0x262626)
        /// The band that sweeps the bars.
        public var sheen: Color = Style.adaptive(0xFFFFFF, 0x3A3937)
        /// Mark disc and its glyph.
        public var mark: Color = Style.adaptive(0x141414, 0xF4F3EF)
        public var markInk: Color = Style.adaptive(0xF3F2EE, 0x121212)
        /// Dark ink on a tinted mark.
        public var ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
        /// Name and the swept label's highlight.
        public var text: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Elapsed label and the resting label text.
        public var muted: Color = Style.adaptive(0x5C5A56, 0xA6A49F)
        /// Name shown in the header.
        public var assistantName: String = "Assistant"
        /// Show the mark, name and elapsed seconds above the content.
        public var showsHeader: Bool = true

        public init() {}

        /// The house palette: tangerine, sky and lilac dots over quiet bars.
        public static let standard = Style()

        private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(UIColor { traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

public extension View {
    /// Sweeps a sheen across this view while `isActive` is true. Static under Reduce Motion.
    func thinkingState(_ isActive: Bool = true, tint: Color? = nil) -> some View {
        modifier(ThinkingSheenModifier(isActive: isActive, tint: tint))
    }
}

private struct ThinkingSheenModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let isActive: Bool
    let tint: Color?

    func body(content: Content) -> some View {
        content.overlay {
            if isActive {
                TimelineView(.animation(paused: reduceMotion)) { context in
                    let sweep = reduceMotion ? 0.5 : context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2.2) / 2.2
                    ThinkingSheen(sweep: sweep, color: tint ?? .white, strength: 0.55)
                }
                .mask(content)
                .blendMode(.plusLighter)
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: isActive)
    }
}

/// One soft band traveling leading to trailing. `sweep` is 0...1 across one pass.
private struct ThinkingSheen: View {
    let sweep: Double
    let color: Color
    let strength: Double

    var body: some View {
        let center = -0.4 + sweep * 1.8
        LinearGradient(
            stops: [
                .init(color: color.opacity(0), location: clamp(center - 0.25)),
                .init(color: color.opacity(strength), location: clamp(center)),
                .init(color: color.opacity(0), location: clamp(center + 0.25))
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
        .allowsHitTesting(false)
    }

    private func clamp(_ value: Double) -> Double { min(max(value, 0), 1) }
}

// MARK: - Example

/// Three placeholders and a sweeping status capsule, as they sit in a chat.
private struct ThinkingStateExample: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            ThinkingState(.dots)
            ThinkingState(.sheen, lineCount: 2)
            ThinkingState(.text("Reading the Q3 report"), style: { var s = ThinkingState.Style(); s.showsHeader = false; return s }())
            Label("Drafting reply", systemImage: "sparkle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                .padding(.horizontal, 16)
                .frame(height: 44)
                .background(Color(red: 1, green: 0.851, blue: 0.463), in: Capsule())
                .thinkingState()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    ThinkingStateExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    ThinkingStateExample().preferredColorScheme(.dark)
}
