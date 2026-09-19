// swiftpieces:
// title: Pull to Refresh
// description: "Wraps any scrolling content in a refresh gesture: the overscroll rubber-bands, a drawn ring winds up with the pull, crossing the threshold arms it with a rigid impact, and releasing snaps to a held spinner that runs the caller's async work for a minimum visible beat before the content settles back."
// category: lists
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [list, scroll, refresh, gesture, loading, async]

import SwiftUI
import UIKit

/// Name of the coordinate space the pull is measured in. File-scope because a generic type
/// cannot hold a static stored property.
private let pullToRefreshSpace = "swiftpieces.pullToRefresh"

/// Scrolling container with a pull-to-refresh gesture, a drawn ring indicator and an `async` refresh closure.
///
/// The piece owns its `ScrollView`, so the overscroll rubber-band is the system's own and the indicator
/// tracks it one to one. The spinner is held until `onRefresh` returns, so a slow reload stays visible and
/// a fast one still reads as a refresh rather than a flash.
///
/// - Parameters:
///   - style: Ring colors, pull threshold, held height, indicator size and the minimum time the spinner stays up. Defaults to the house palette.
///   - onRefresh: Runs on the main actor when an armed pull is released, or when VoiceOver performs the Refresh action. The spinner is held until it returns. It is cancelled if the view goes away.
///   - content: The scrolling content. Any view; it is placed in the piece's own `ScrollView`.
public struct PullToRefresh<Content: View>: View {
    public typealias Style = PullToRefreshStyle

    /// Where the gesture currently is. `settling` is not a case: the return to `idle` is the animation.
    private enum Phase: Equatable { case idle, pulling, refreshing }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pull: CGFloat = 0
    @State private var phase: Phase = .idle
    @State private var armed = false
    @State private var spinning = false
    @State private var completions = 0
    @State private var work: Task<Void, Never>?

    private let style: Style
    private let onRefresh: @MainActor () async -> Void
    private let content: Content

    public init(style: Style = .standard, onRefresh: @escaping @MainActor () async -> Void, @ViewBuilder content: () -> Content) {
        self.style = style
        self.onRefresh = onRefresh
        self.content = content()
    }

    /// How far through the pull the ring is, 0 to 1 at the threshold.
    private var progress: CGFloat { style.threshold > 0 ? min(1, pull / style.threshold) : 0 }

    /// Height the content is pushed down by while the spinner is held.
    private var hold: CGFloat { phase == .refreshing ? style.holdHeight : 0 }

    /// Height of the band the indicator is centered in. Capped so a long pull drags the content, not the ring.
    private var band: CGFloat { phase == .refreshing ? style.holdHeight : min(pull, style.threshold * 1.3) }

    private var motion: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.2) }

    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                probe
                // The held band is a real spacer, so the scroll extent stays honest while the spinner is up.
                Color.clear.frame(height: hold)
                content
            }
        }
        .coordinateSpace(.named(pullToRefreshSpace))
        .overlay(alignment: .top) {
            PullToRefreshIndicator(progress: progress, armed: armed, refreshing: phase == .refreshing, spinning: spinning, style: style, reduceMotion: reduceMotion)
                .frame(maxWidth: .infinity)
                .frame(height: band)
                // Fades in with the first few points of pull, so it never pokes above the top edge.
                .opacity(phase == .refreshing ? 1 : min(1, pull / max(style.threshold * 0.35, 1)))
                .allowsHitTesting(false)
                // Only the held spinner is worth announcing; the wind-up is the finger's own feedback.
                .accessibilityHidden(phase != .refreshing)
                .accessibilityLabel(Text(String(localized: "Refreshing")))
                .accessibilityAddTraits(.updatesFrequently)
        }
        .simultaneousGesture(DragGesture(minimumDistance: 4).onEnded { _ in release() })
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: armed) { _, isArmed in isArmed }
        .sensoryFeedback(.success, trigger: completions)
        .onDisappear { work?.cancel() }
        // VoiceOver never performs the pull, so the refresh is also a custom action on the container.
        .accessibilityAction(named: Text(String(localized: "Refresh"))) { begin() }
    }

    /// A zero-height ruler at the very top of the scroll content. `onChange` reads it on the main actor,
    /// which a `PreferenceKey` would not: `onPreferenceChange` hands its value to a `@Sendable` closure.
    private var probe: some View {
        GeometryReader { proxy in
            let y = proxy.frame(in: .named(pullToRefreshSpace)).minY
            Color.clear.onChange(of: y, initial: true) { _, distance in track(distance) }
        }
        .frame(height: 0)
    }

    // MARK: Gesture

    private func track(_ distance: CGFloat) {
        // Negative means the content is scrolled up; only overscroll counts as a pull.
        pull = max(0, distance)
        guard phase != .refreshing else { return }
        if pull > 0 {
            if phase == .idle { phase = .pulling }
            let nowArmed = pull >= style.threshold
            if nowArmed != armed { armed = nowArmed }
        } else {
            armed = false
            phase = .idle
        }
    }

    private func release() {
        guard phase == .pulling, armed else { return }
        armed = false
        begin()
    }

    // MARK: Refresh

    private func begin() {
        guard phase != .refreshing else { return }
        withAnimation(motion) { phase = .refreshing }
        spinning = true
        work?.cancel()
        work = Task { @MainActor in
            let clock = ContinuousClock()
            let started = clock.now
            await onRefresh()
            // A refresh that returns instantly would flash; hold the spinner for the rest of the minimum.
            let remaining = Duration.seconds(style.minimumDuration) - started.duration(to: clock.now)
            if remaining > .zero { try? await Task.sleep(for: remaining) }
            guard !Task.isCancelled else { return }
            finish()
        }
    }

    private func finish() {
        spinning = false
        completions += 1
        withAnimation(motion) { phase = .idle }
    }
}

/// Look of a `PullToRefresh`. Start from `.standard` and change what you need.
public struct PullToRefreshStyle: Sendable {
    /// The leading tick and the armed dial. The one accent in the piece.
    public var accent: Color = Color(red: 1, green: 0, blue: 0)
    /// Ticks the pull has already wound up. Adapts to light and dark.
    public var ink: Color = PullToRefreshStyle.adaptive(0x141414, 0xF4F3EF)
    /// Ticks still waiting, and the resting bezel. Adapts to light and dark.
    public var track: Color = PullToRefreshStyle.adaptive(0x141414, 0xF4F3EF).opacity(0.16)
    /// Pull distance, in points, at which the gesture arms.
    public var threshold: CGFloat = 92
    /// Height the content is held down by while the refresh runs.
    public var holdHeight: CGFloat = 64
    /// Diameter of the dial at the default Dynamic Type size. It scales with the body text size.
    public var indicatorSize: CGFloat = 30
    /// Stroke width of a tick.
    public var lineWidth: CGFloat = 2
    /// Seconds the spinner stays up even if `onRefresh` returns sooner.
    public var minimumDuration: Double = 0.6

    public init() {}

    /// The house palette: a signal-red head on a faint tick dial, a 92pt threshold and a 64pt hold.
    public static let standard = PullToRefreshStyle()

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// The dial. Kept non-generic and separate so the repeating sweep animation never captures the
/// wrapper's generic metatype.
///
/// It is a bezel of ticks rather than a ring, because a ring is what every refresh already looks
/// like. Pulling winds the ticks up one at a time under the finger, arming turns the wound ticks to
/// the accent, and the refresh sweeps a bright head round with a tail that decays behind it. The
/// motion is mechanical and even, never a blur.
private struct PullToRefreshIndicator: View {
    let progress: CGFloat
    let armed: Bool
    let refreshing: Bool
    let spinning: Bool
    let style: PullToRefreshStyle
    let reduceMotion: Bool

    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1

    private static let tickCount = 24
    /// How many ticks the refresh tail spans before it fades out.
    private static let tailLength = 7.0
    /// Resting brightness, so the bezel is always faintly readable.
    private static let floorLevel = 0.16

    private var sweep: Animation? {
        guard spinning else { return nil }
        return reduceMotion ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true) : .linear(duration: 1.1).repeatForever(autoreverses: false)
    }

    /// How lit tick `index` is, and whether it is the leading one that takes the accent.
    private func level(_ index: Int) -> (brightness: Double, isHead: Bool) {
        if refreshing {
            // The head sits at 12 o'clock and the whole dial rotates, so the tail trails behind it.
            let falloff = max(0, 1 - Double(index) / Self.tailLength)
            return (Self.floorLevel + (1 - Self.floorLevel) * pow(falloff, 1.6), index == 0)
        }
        // Ticks wind up one at a time; the one being reached fades in rather than snapping on.
        let reached = Double(progress) * Double(Self.tickCount) - Double(index)
        guard reached > 0 else { return (Self.floorLevel, false) }
        let lit = min(1, reached)
        return (Self.floorLevel + (1 - Self.floorLevel) * lit, reached <= 1)
    }

    var body: some View {
        let size = style.indicatorSize * typeScale
        Canvas { context, canvas in
            let centre = CGPoint(x: canvas.width / 2, y: canvas.height / 2)
            let outer = min(canvas.width, canvas.height) / 2 - style.lineWidth / 2
            for index in 0..<Self.tickCount {
                let (brightness, isHead) = level(index)
                let turn = Double(index) / Double(Self.tickCount)
                // Ticks start at 12 o'clock and run clockwise, the direction the finger winds them.
                let angle = turn * 2 * .pi - .pi / 2
                // A lit tick is longer as well as brighter, so the dial reads while it winds.
                let length = outer * (0.26 + 0.20 * brightness)
                var path = Path()
                path.move(to: CGPoint(x: centre.x + cos(angle) * (outer - length), y: centre.y + sin(angle) * (outer - length)))
                path.addLine(to: CGPoint(x: centre.x + cos(angle) * outer, y: centre.y + sin(angle) * outer))
                let colour: Color = isHead || (armed && !refreshing && brightness > Self.floorLevel) ? style.accent : style.ink.opacity(brightness)
                context.stroke(path, with: .color(colour), style: StrokeStyle(lineWidth: style.lineWidth, lineCap: .round))
            }
        }
        .frame(width: size, height: size)
        .scaleEffect(armed && !refreshing ? 1.1 : 1)
        .animation(.spring(duration: 0.3, bounce: 0.45), value: armed)
        .rotationEffect(.degrees(spinning && !reduceMotion ? 360 : 0))
        .opacity(spinning && reduceMotion ? 0.5 : 1)
        .animation(sweep, value: spinning)
    }
}

// MARK: - Example

/// The piece wrapping plain rows, refreshed by a short async task. Nothing around it.
private struct PullToRefreshExample: View {
    @State private var entries = ["Mara Lindqvist", "Jonas Okafor", "Priya Raman", "Tomas Weil", "Ines Marchetti", "Devon Oyelaran", "Hana Kobayashi", "Ruben Castellanos"]

    var body: some View {
        PullToRefresh {
            try? await Task.sleep(for: .seconds(1.2))
            entries.insert("Aleks Novak", at: 0)
        } content: {
            VStack(spacing: 0) {
                ForEach(Array(entries.enumerated()), id: \.element) { index, name in
                    if index > 0 {
                        Rectangle()
                            .fill(PullToRefreshExampleInk.muted.opacity(0.2))
                            .frame(height: 1)
                    }
                    Text(name)
                        .font(.body)
                        .foregroundStyle(PullToRefreshExampleInk.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 15)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PullToRefreshExampleInk.ground)
    }
}

private enum PullToRefreshExampleInk {
    static let ground = adaptive(0xF3F2EE, 0x121212)
    static let text = adaptive(0x141414, 0xF4F3EF)
    static let muted = adaptive(0x5C5A56, 0xA6A49F)

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

#Preview("Light") {
    PullToRefreshExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    PullToRefreshExample().preferredColorScheme(.dark)
}
