// swiftpieces:
// title: Story Strip
// description: A Stories-style segment strip with a built-in clock that advances segments on a duration, a long-press hold that freezes the strip and shows a paused badge, tap zones for back and forward that answer with a chevron, and a manual progress mode when you own the timing.
// category: media
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [stories, progress, segments, timer, hold, media]

import SwiftUI

/// Segment strip plus the gesture surface of a story player. Pass `duration` to let it run itself, or leave it nil and drive `progress`.
///
/// - Parameters:
///   - count: Number of segments.
///   - current: Index of the segment currently filling. The strip advances it when it drives the clock.
///   - progress: Fill of the current segment from 0 to 1, used only when `duration` is nil.
///   - duration: Seconds per segment. When set, a `TimelineView` clock fills the segment and advances at the end.
///   - isPaused: Optional external pause, for example while a reply sheet is up. Holding the strip pauses on its own.
///   - tint: Segment color; the track is the same color at low opacity.
///   - style: Bar geometry, track strength, and the paused badge and tap hints. `.standard` draws 4 pt bars and shows both.
///   - fillsContainer: Expand the gesture surface to the whole container so holds and taps work over the story, with the bars pinned to the top.
///   - onFinish: Called when the last segment completes.
public struct StoryStrip: View {
    public enum Phase: Sendable { case playing, held, changed, finished }

    /// Bar geometry and feedback.
    public struct Style: Sendable {
        /// Height of each bar.
        public var barHeight: CGFloat
        /// Gap between bars.
        public var spacing: CGFloat
        /// Opacity of the unfilled track, as a fraction of `tint`.
        public var trackOpacity: Double
        /// Inset of the bar row from the container's edges.
        public var inset: CGFloat
        /// Show a "Paused" badge under the bars while held.
        public var showsPausedBadge: Bool
        /// Flash a chevron in the tapped zone when a tap moves back or forward.
        public var showsTapHints: Bool
        /// Glyph and text color on `tint` in the badge and hints.
        public var ink: Color

        public init(barHeight: CGFloat = 4, spacing: CGFloat = 4, trackOpacity: Double = 0.3, inset: CGFloat = 12, showsPausedBadge: Bool = true, showsTapHints: Bool = true, ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)) {
            self.barHeight = barHeight
            self.spacing = spacing
            self.trackOpacity = trackOpacity
            self.inset = inset
            self.showsPausedBadge = showsPausedBadge
            self.showsTapHints = showsTapHints
            self.ink = ink
        }

        /// House defaults: 4 pt bars, a 30% track, a paused badge, and tap hints.
        public static let standard = Style()
        /// Only the bars, as in version 1.
        public static let minimal = Style(barHeight: 3, showsPausedBadge: false, showsTapHints: false)
    }

    private struct DriverKey: Equatable {
        let current: Int
        let paused: Bool
        let finished: Bool
        let duration: TimeInterval?
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var current: Int
    @State private var segmentStart = Date.now
    @State private var pausedAt: Date?
    @State private var held = false
    @State private var finished = false
    @State private var holdTask: Task<Void, Never>?
    @State private var touchStart: CGPoint?
    @State private var hint: Hint?

    private let count: Int
    private let progress: Double
    private let duration: TimeInterval?
    private let isPaused: Binding<Bool>?
    private let tint: Color
    private let style: Style
    private let fillsContainer: Bool
    private let onFinish: (() -> Void)?

    public init(
        count: Int,
        current: Binding<Int>,
        progress: Double = 0,
        duration: TimeInterval? = nil,
        isPaused: Binding<Bool>? = nil,
        tint: Color = .white,
        style: Style = .standard,
        fillsContainer: Bool = true,
        onFinish: (() -> Void)? = nil
    ) {
        self.count = max(count, 1)
        self._current = current
        self.progress = progress
        self.duration = duration
        self.isPaused = isPaused
        self.tint = tint
        self.style = style
        self.fillsContainer = fillsContainer
        self.onFinish = onFinish
    }

    private var paused: Bool { held || (isPaused?.wrappedValue ?? false) }
    private var phase: Phase { finished ? .finished : held ? .held : .playing }
    private var driverKey: DriverKey { DriverKey(current: current, paused: paused, finished: finished, duration: duration) }

    public var body: some View {
        GeometryReader { proxy in
            VStack(alignment: .leading, spacing: 10) {
                TimelineView(.animation(paused: paused || duration == nil || finished)) { context in
                    bars(fill: currentFill(at: context.date))
                }
                if style.showsPausedBadge && fillsContainer {
                    pausedBadge
                }
            }
            .padding(.horizontal, style.inset)
            .padding(.top, style.inset)
            .frame(maxWidth: .infinity, maxHeight: fillsContainer ? .infinity : nil, alignment: .top)
            .overlay {
                if style.showsTapHints && fillsContainer, let hint {
                    hintView(hint, width: proxy.size.width)
                }
            }
            .contentShape(Rectangle())
            .gesture(surface(width: proxy.size.width))
        }
        .frame(minHeight: 44)
        .animation(.easeOut(duration: 0.2), value: held)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: held) { _, new in new }
        .sensoryFeedback(.selection, trigger: current)
        .task(id: driverKey) { await drive() }
        .onChange(of: current) { _, new in
            segmentStart = .now
            if paused { pausedAt = .now }
            if new < count { finished = false }
        }
        .onChange(of: paused) { _, nowPaused in
            if nowPaused {
                pausedAt = .now
            } else if let pausedAt {
                segmentStart = segmentStart.addingTimeInterval(Date.now.timeIntervalSince(pausedAt))
                self.pausedAt = nil
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Story")
        .accessibilityValue("\(min(current, count - 1) + 1) of \(count)\(phase == .held ? ", paused" : "")")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: advance()
            case .decrement: back()
            @unknown default: break
            }
        }
        .accessibilityAction(named: held ? "Resume" : "Pause") { held.toggle() }
    }

    private func bars(fill: Double) -> some View {
        HStack(spacing: style.spacing) {
            ForEach(0..<count, id: \.self) { index in
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(tint.opacity(style.trackOpacity))
                        Capsule().fill(tint).frame(width: proxy.size.width * segmentFill(index, fill: fill))
                    }
                }
                .frame(height: style.barHeight)
            }
        }
        .opacity(held ? 0.55 : 1)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : .snappy(duration: 0.3), value: current)
        .animation(.linear(duration: 0.1), value: duration == nil ? progress : 0)
    }

    // MARK: Feedback

    private struct Hint: Equatable {
        let forward: Bool
        let tick: Int
    }

    private var pausedBadge: some View {
        HStack(spacing: 6) {
            Image(systemName: "pause.fill")
                .font(.caption.weight(.bold))
            Text("Paused")
                .font(.system(.subheadline, weight: .bold))
        }
        .foregroundStyle(style.ink)
        .padding(.horizontal, 12)
        .frame(height: 30)
        .background(tint, in: Capsule())
        .opacity(held ? 1 : 0)
        .scaleEffect(held || reduceMotion ? 1 : 0.85, anchor: .topTrailing)
        .offset(y: held || reduceMotion ? 0 : -6)
        .animation(.spring(duration: 0.3, bounce: 0.35), value: held)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityHidden(true)
    }

    private func hintView(_ hint: Hint, width: CGFloat) -> some View {
        Image(systemName: hint.forward ? "chevron.right" : "chevron.left")
            .font(.title3.weight(.bold))
            .foregroundStyle(style.ink)
            .frame(width: 52, height: 52)
            .background(tint, in: Circle())
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: hint.forward ? .trailing : .leading)
            .padding(.horizontal, 24)
            .id(hint.tick)
            .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.7)))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func flashHint(forward: Bool) {
        guard style.showsTapHints, fillsContainer else { return }
        let next = Hint(forward: forward, tick: (hint?.tick ?? 0) + 1)
        withAnimation(.spring(duration: 0.25, bounce: 0.3)) { hint = next }
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            if hint == next { withAnimation(.easeOut(duration: 0.25)) { hint = nil } }
        }
    }

    // MARK: Clock

    private func currentFill(at date: Date) -> Double {
        guard let duration else { return min(max(progress, 0), 1) }
        if finished { return 1 }
        let elapsed = (pausedAt ?? date).timeIntervalSince(segmentStart)
        return min(max(elapsed / duration, 0), 1)
    }

    private func segmentFill(_ index: Int, fill: Double) -> Double {
        if finished || index < current { return 1 }
        if index > current { return 0 }
        return fill
    }

    /// Sleeps for the rest of the current segment, then advances. Any change to the key restarts it.
    private func drive() async {
        guard let duration, !paused, !finished else { return }
        let remaining = max(0, duration - Date.now.timeIntervalSince(segmentStart))
        try? await Task.sleep(for: .seconds(remaining))
        guard !Task.isCancelled else { return }
        advance()
    }

    private func advance() {
        if current + 1 < count {
            current += 1
        } else if !finished {
            finished = true
            onFinish?()
        }
    }

    private func back() {
        if current > 0 {
            current -= 1
        } else {
            segmentStart = .now
            if paused { pausedAt = .now }
        }
        finished = false
    }

    // MARK: Surface

    /// Touch down starts a hold timer; a release before it fires is a tap on the back or forward zone.
    private func surface(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard touchStart == nil else { return }
                touchStart = value.location
                holdTask?.cancel()
                holdTask = Task {
                    try? await Task.sleep(for: .milliseconds(200))
                    if !Task.isCancelled { held = true }
                }
            }
            .onEnded { value in
                holdTask?.cancel()
                let start = touchStart
                touchStart = nil
                if held {
                    held = false
                    return
                }
                guard let start, hypot(value.location.x - start.x, value.location.y - start.y) < 12 else { return }
                if value.location.x < width * 0.3 {
                    flashHint(forward: false)
                    back()
                } else {
                    flashHint(forward: true)
                    advance()
                }
            }
    }
}

// MARK: - Example

/// A friend's Saturday market story: each segment is a solid block with one big idea, and the strip runs in dark ink.
private struct StoryStripExample: View {
    private struct Slide {
        let meta: String
        let headline: String
        let figure: String?
        let fill: Color
    }

    @Environment(\.colorScheme) private var colorScheme
    @State private var current = 0

    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let slides = [
        Slide(meta: "SATURDAY MARKET", headline: "Out early for the good peaches", figure: nil, fill: Color(red: 1, green: 0, blue: 0)),
        Slide(meta: "STALLS VISITED", headline: "and one very long queue", figure: "12", fill: Color(red: 1, green: 0.851, blue: 0.463)),
        Slide(meta: "SPENT", headline: "on bread, figs and flowers", figure: "€18.40", fill: Color(red: 0.663, green: 0.863, blue: 0.718)),
        Slide(meta: "NEXT WEEK", headline: "Same time. Bring a bigger bag.", figure: nil, fill: Color(red: 0.804, green: 0.722, blue: 1))
    ]

    var body: some View {
        let slide = slides[min(current, slides.count - 1)]
        ZStack(alignment: .topLeading) {
            slide.fill
                .animation(.smooth(duration: 0.35), value: current)
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text(slide.meta)
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                if let figure = slide.figure {
                    Text(figure)
                        .font(.system(size: 96, weight: .light))
                        .tracking(-4)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }
                Text(slide.headline)
                    .font(.system(size: slide.figure == nil ? 44 : 28, weight: .bold))
                    .tracking(slide.figure == nil ? -1.8 : -1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(ink)
            .padding(24)
            .padding(.bottom, 20)
            .id(current)
            .transition(.opacity)
            StoryStrip(count: slides.count, current: $current, duration: 4, tint: ink, style: StoryStrip.Style(ink: slide.fill)) {
                current = 0
            }
        }
        .clipShape(.rect(cornerRadius: 34, style: .continuous))
        .padding(16)
        .background(colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
    }
}

#Preview("Light") {
    StoryStripExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    StoryStripExample()
        .preferredColorScheme(.dark)
}
