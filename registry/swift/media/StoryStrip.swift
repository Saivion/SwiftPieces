// swiftpieces:
// title: Story Strip
// description: A Stories-style segment strip with a built-in clock that advances segments on a duration, a long-press hold that freezes the strip and buds a liquid glass Paused badge down out of the bars (it melts back up into them on release), tap zones for back and forward that answer with a glass chevron bubble, and a manual progress mode when you own the timing.
// category: media
// minIOSVersion: "17.0"
// version: "2.3.0"
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
///   - tint: Segment color; the track is the same color at low opacity, and the paused badge and tap hints are liquid glass tinted with it.
///   - style: Bar geometry, track strength, and the paused badge and tap hints. `.standard` draws 3 pt bars and shows both.
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
        /// Bud a "Paused" glass badge out of the bars while held.
        public var showsPausedBadge: Bool
        /// Flash a glass chevron bubble in the tapped zone when a tap moves back or forward.
        public var showsTapHints: Bool
        /// Glyph and text color on the badge and hints, which are glass tinted with the strip's `tint`.
        public var ink: Color

        public init(barHeight: CGFloat = 3, spacing: CGFloat = 4, trackOpacity: Double = 0.3, inset: CGFloat = 12, showsPausedBadge: Bool = true, showsTapHints: Bool = true, ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)) {
            self.barHeight = barHeight
            self.spacing = spacing
            self.trackOpacity = trackOpacity
            self.inset = inset
            self.showsPausedBadge = showsPausedBadge
            self.showsTapHints = showsTapHints
            self.ink = ink
        }

        /// House defaults: 3 pt bars, a 30% track, a paused badge, and tap hints.
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
    /// Counts the moves a reader asked for (a tap or a VoiceOver swipe), so only those tick. The clock's own advances stay silent.
    @State private var stepTick = 0
    /// The paused badge: out of the strip while held, melted back into it otherwise.
    @State private var buds = PieceBuds()
    /// Resets when the system cancels a touch, which skips onEnded.
    @GestureState private var touching = false

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
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    private var showsBadge: Bool { style.showsPausedBadge && fillsContainer }
    private let badgeHeight: CGFloat = 30
    private let badgeGap: CGFloat = 10

    public var body: some View {
        GeometryReader { proxy in
            VStack(alignment: .leading, spacing: badgeGap) {
                TimelineView(.animation(paused: paused || duration == nil || finished)) { context in
                    bars(fill: currentFill(at: context.date))
                }
                // Over the badge, so the badge is born under the bars and slips back under them as it melts home.
                .zIndex(1)
                if showsBadge {
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
        .fontWeight(.semibold)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: held) { _, new in new }
        .sensoryFeedback(.selection, trigger: stepTick)
        .task(id: driverKey) { await drive() }
        // The badge buds out of the strip as the hold engages, after the dim, which leads, and melts back into it
        // when the finger lifts.
        .onChange(of: held) { _, isHeld in
            guard showsBadge else { return }
            Task {
                if isHeld {
                    await buds.bloom(["paused"], reduceMotion: reduceMotion)
                } else {
                    await buds.gather(["paused"], reduceMotion: reduceMotion)
                }
            }
        }
        // A touch the system cancels (a call, Control Center) never reaches onEnded, so the hold lets go here too,
        // or the story would stay paused. After a normal release onEnded has already cleared `touchStart`.
        .onChange(of: touching) { _, isTouching in
            guard !isTouching, touchStart != nil else { return }
            holdTask?.cancel()
            touchStart = nil
            held = false
        }
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
            case .increment: step(forward: true)
            case .decrement: step(forward: false)
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
        // The pin lands as the hold engages and lifts with the finger. Under Reduce Motion the dim still shows.
        .opacity(held ? 0.55 : 1)
        .animation(held ? motion.press : motion.release, value: held)
        // A step fills or empties the bars on `value`, which never overshoots: they say where the story is, and a give
        // would run a filled bar past its track, or an emptied one below nothing.
        .animation(motion.value, value: current)
        // Manual progress runs on the host's clock, so steps between updates stay linear.
        .animation(.linear(duration: 0.1), value: duration == nil ? progress : 0)
    }

    // MARK: Feedback

    private struct Hint: Equatable {
        let forward: Bool
        let tick: Int
    }

    /// A glass capsule tinted with the strip's color, in a slot under the trailing end of the bars that keeps its height
    /// while the badge is away. Held, it buds down out of the bars; let go, it rises back into them on a spring with no
    /// bounce, its label gone the moment it turns home and its tint draining as it goes.
    private var pausedBadge: some View {
        let out = buds.isOut("paused")
        // Home is the badge's centre on the bars' own centre line, at their trailing end, shrunk.
        let home = CGSize(width: 0, height: -(style.barHeight / 2 + badgeGap + badgeHeight / 2))
        return Color.clear
            .frame(height: badgeHeight)
            .overlay(alignment: .trailing) {
                if buds.contains("paused") {
                    PieceLiquidGroup(lift: false) {
                        HStack(spacing: 6) {
                            Image(systemName: "pause.fill")
                                .font(.caption.weight(.semibold))
                            Text("Paused")
                                .font(.subheadline.weight(.semibold))
                        }
                        .foregroundStyle(style.ink)
                        .pieceBudContent(out: out)
                        .padding(.horizontal, 12)
                        .frame(height: badgeHeight)
                        .pieceLiquid(.capsule, tint: out ? tint : nil, interactive: false)
                    }
                    // The bars are not glass, so there is nothing for the badge to melt into: it thins away on its way
                    // home and is gone by the time it gets there, rather than leaving a bead of glass on the strip.
                    .opacity(out ? 1 : 0)
                    .animation(out ? .easeOut(duration: 0.16) : .easeIn(duration: 0.36), value: out)
                    .pieceBud(out: out, home: home)
                }
            }
            .accessibilityHidden(true)
    }

    private func hintView(_ hint: Hint, width: CGFloat) -> some View {
        let side: CGFloat = 52, margin: CGFloat = 24
        // The transition wraps the whole surface, so it scales about the chevron's own center rather than the
        // surface's. It nudges in along the way the tap moved and drifts on as it fades, so forward and back
        // differ by direction as well as glyph.
        let center = hint.forward ? width - margin - side / 2 : margin + side / 2
        let anchor = UnitPoint(x: width > 0 ? center / width : 0.5, y: 0.5)
        let travel: CGFloat = hint.forward ? 8 : -8
        return PieceLiquidGroup(lift: false) {
            Image(systemName: hint.forward ? "chevron.right" : "chevron.left")
                .font(.title3.weight(.semibold))
                .foregroundStyle(style.ink)
                .frame(width: side, height: side)
                .pieceLiquid(.circle, tint: tint, interactive: false)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: hint.forward ? .trailing : .leading)
        .padding(.horizontal, margin)
        .id(hint.tick)
        // A hint has no glass to bud from: it rises in on its own, the way a toast arrives.
        .transition(motion.transition(.asymmetric(
            insertion: .scale(scale: 0.7, anchor: anchor).combined(with: .offset(x: -travel)).combined(with: .opacity),
            // One replaced by a quick second tap leaves firmly, however the new one arrives.
            removal: .offset(x: travel * 0.75).combined(with: .opacity).animation(motion.dismiss)
        )))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func flashHint(forward: Bool) {
        guard style.showsTapHints, fillsContainer else { return }
        let next = Hint(forward: forward, tick: (hint?.tick ?? 0) + 1)
        // The bars step firmly; the chevron is decoration, so it follows the step with some give, and leaves quicker
        // than it came.
        withAnimation(motion.follow(rank: 1)) { hint = next }
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            if hint == next { withAnimation(motion.dismiss) { hint = nil } }
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

    /// Returns false when there was nothing left to advance to.
    @discardableResult
    private func advance() -> Bool {
        if current + 1 < count {
            current += 1
        } else if !finished {
            finished = true
            onFinish?()
        } else {
            return false
        }
        return true
    }

    /// Returns false when nothing changed: on the first segment of a strip the host drives there is no clock to
    /// restart, since the fill reads `progress`, unless the strip had finished.
    private func back() -> Bool {
        let changes = current > 0 || duration != nil || finished
        if current > 0 {
            current -= 1
        } else {
            segmentStart = .now
            if paused { pausedAt = .now }
        }
        finished = false
        return changes
    }

    /// A move the reader asked for. Only a move that changed something ticks.
    private func step(forward: Bool) {
        guard forward ? advance() : back() else { return }
        stepTick += 1
    }

    // MARK: Surface

    /// Touch down starts a hold timer; a release before it fires is a tap on the back or forward zone.
    private func surface(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($touching) { _, touching, _ in touching = true }
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
                    step(forward: false)
                } else {
                    flashHint(forward: true)
                    step(forward: true)
                }
            }
    }
}

// MARK: - Example

/// A friend's Saturday market story: each segment is a solid block with one big idea under a small header, and the
/// strip runs in dark ink. The card's corner stays tight enough that the bars clear its curve.
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
                    .font(.caption.weight(.semibold))
                    .tracking(1.2)
                if let figure = slide.figure {
                    Text(figure)
                        .font(.system(size: 96, weight: .semibold))
                        .tracking(-4)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }
                Text(slide.headline)
                    .font(.system(size: slide.figure == nil ? 34 : 26, weight: .semibold))
                    .tracking(slide.figure == nil ? -1.2 : -0.8)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(ink)
            .padding(24)
            .padding(.bottom, 12)
            .id(current)
            .transition(.opacity)
            // Who posted it and when, lined up with the bars. The trailing end stays clear for the Paused badge.
            HStack(spacing: 8) {
                Text("MA")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(slide.fill)
                    .frame(width: 28, height: 28)
                    .background(ink, in: Circle())
                Text("Mara")
                Text("2h").opacity(0.55)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(ink)
            .padding(.horizontal, 12)
            .padding(.top, 12 + 3 + 12)
            .accessibilityElement(children: .combine)
            StoryStrip(count: slides.count, current: $current, duration: 4, tint: ink, style: StoryStrip.Style(ink: slide.fill)) {
                current = 0
            }
        }
        .clipShape(.rect(cornerRadius: 20, style: .continuous))
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow)

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
