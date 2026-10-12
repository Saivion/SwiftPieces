// swiftpieces:
// title: Waveform Scrub
// description: "A voice note you can scrub by dragging its waveform. The samples are the control: a glass playhead bulges out of a glass track and follows your finger, swelling while you hold it, while a time bubble buds off it on a liquid neck. Loud peaks tick. A play bubble rests apart and floods with signal while it plays."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-12"
// tags: [waveform, audio, scrub, voice, glass, haptics, media]

import SwiftUI

/// A waveform that is itself the scrubber, with a glass playhead melted into a glass track.
///
/// `samples` are loudness from 0 to 1, left to right. `progress` is how far playback has reached, from 0 to 1.
/// Drag anywhere on the track to move the playhead; it tracks the finger and keeps the flick's speed for a short coast.
///
/// - Parameters:
///   - samples: Bar heights from 0 to 1. An empty list draws a flat track.
///   - progress: Playback position from 0 to 1.
///   - isPlaying: Whether the note is advancing on its own.
///   - duration: Length of the note in seconds, used for the time bubble and for playback.
///   - haptics: A selection tick when the playhead crosses a loud peak, and a light tick for play and pause.
///   - style: Ink for played bars, mute for the rest, and the play bubble's tint. `.standard` uses house ink and signal.
public struct WaveformScrub: View {
    /// Visual tuning.
    public struct Style: Sendable {
        public var ink: Color
        public var muted: Color
        public var accent: Color

        public init(
            ink: Color = WaveformScrub.adaptive(light: 0x141414, dark: 0xF4F3EF),
            muted: Color = WaveformScrub.adaptive(light: 0xC4C1BA, dark: 0x4A4946),
            accent: Color = Color(red: 1, green: 0, blue: 0)
        ) {
            self.ink = ink
            self.muted = muted
            self.accent = accent
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @ScaledMetric(relativeTo: .body) private var trackHeight: CGFloat = 56

    @Binding private var progress: Double
    @Binding private var isPlaying: Bool
    @State private var dragging = false
    @State private var peaks = 0
    @State private var plays = 0
    @State private var lastPeak = -1
    @State private var buds = PieceBuds()

    private let samples: [Double]
    private let duration: Double
    private let haptics: Bool
    private let style: Style

    public init(
        samples: [Double],
        progress: Binding<Double>,
        isPlaying: Binding<Bool>,
        duration: Double = 18,
        haptics: Bool = true,
        style: Style = .standard
    ) {
        self.samples = samples
        self._progress = progress
        self._isPlaying = isPlaying
        self.duration = max(duration, 0.1)
        self.haptics = haptics
        self.style = style
    }

    public var body: some View {
        PieceLiquidGroup(spacing: PieceLiquid.apart) {
            HStack(alignment: .center, spacing: PieceLiquid.apart) {
                track
                playButton
            }
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.selection, trigger: peaks)
        .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light, intensity: 0.75), trigger: plays)
        .onAppear { notePeaks(progress) }
        .onChange(of: progress) { _, new in notePeaks(new) }
        .onChange(of: dragging) { _, down in
            Task { @MainActor in
                if down { await buds.bloom(["time"], reduceMotion: reduceMotion) }
                else { await buds.gather(["time"], reduceMotion: reduceMotion) }
            }
        }
        .task(id: isPlaying) {
            guard isPlaying else { return }
            while !Task.isCancelled, isPlaying {
                try? await Task.sleep(for: .milliseconds(40))
                if dragging || !isPlaying { continue }
                let step = 0.04 / duration
                let next = progress + step
                progress = next >= 1 ? 0 : next
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var track: some View {
        GeometryReader { proxy in
            let w = max(proxy.size.width, 1)
            let knob: CGFloat = 34
            let x = playheadX(in: w, knob: knob)
            ZStack(alignment: .leading) {
                bars
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .pieceLiquid(.capsule, interactive: false)
                if buds.contains("time") {
                    timeBubble(knob: knob)
                        .offset(x: x + knob / 2 - 36, y: -6)
                }
                Circle()
                    .fill(Color.clear)
                    .frame(width: knob, height: knob)
                    .pieceLiquid(Circle(), tint: style.accent, interactive: true)
                    .pieceLiquidScale(dragging && !reduceMotion ? 1.08 : 1)
                    .offset(x: x, y: (trackHeight - knob) / 2)
                    .animation(dragging ? PieceMotion(reduceMotion: reduceMotion).press : PieceMotion(reduceMotion: reduceMotion).release, value: dragging)
                    .allowsHitTesting(false)
            }
            .contentShape(Capsule())
            .gesture(scrub(width: w))
        }
        .frame(height: trackHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Waveform")
        .accessibilityValue(timeLabel)
        .accessibilityAdjustableAction { direction in
            let step = direction == .increment ? 0.05 : -0.05
            progress = min(max(progress + step, 0), 1)
        }
    }

    private var bars: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
                let played = Double(index) / Double(max(samples.count - 1, 1)) <= progress
                Capsule()
                    .fill(played ? style.ink : style.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: max(4, CGFloat(min(max(sample, 0), 1)) * (trackHeight - 18)))
            }
        }
        .accessibilityHidden(true)
    }

    private func timeBubble(knob: CGFloat) -> some View {
        let out = buds.isOut("time")
        return Text(timeLabel)
            .font(.caption.weight(.semibold))
            .foregroundStyle(WaveformScrub.adaptive(light: 0x141414, dark: 0xF4F3EF))
            .pieceBudContent(out: out)
            .frame(width: 72, height: 28)
            .pieceLiquid(.capsule, interactive: false)
            .pieceBud(out: out, rest: CGSize(width: 0, height: -(knob / 2 + 22)), home: CGSize(width: 0, height: 16))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private var playButton: some View {
        Button {
            isPlaying.toggle()
            if haptics { plays += 1 }
        } label: {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(isPlaying ? Color(red: 0.078, green: 0.078, blue: 0.078) : style.ink)
                .frame(width: 52, height: 52)
                .contentShape(Circle())
        }
        .buttonStyle(PieceLiquidPressStyle(depth: 2.4))
        .pieceLiquid(Circle(), tint: isPlaying ? style.accent : nil, interactive: true)
        .pieceLiquidPop(trigger: plays, amount: 0.06)
        .accessibilityLabel(isPlaying ? "Pause" : "Play")
    }

    private func playheadX(in width: CGFloat, knob: CGFloat) -> CGFloat {
        let travel = max(width - knob, 1)
        let t = layoutDirection == .rightToLeft ? 1 - progress : progress
        return CGFloat(min(max(t, 0), 1)) * travel
    }

    private func scrub(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                dragging = true
                progress = fraction(at: value.location.x, width: width)
            }
            .onEnded { value in
                dragging = false
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let from = fraction(at: value.location.x, width: width)
                let sign: CGFloat = layoutDirection == .rightToLeft ? -1 : 1
                let velocity = sign * value.velocity.width / max(width, 1)
                // A short coast, then a clamp. Audio should not snap to a detent the ear did not ask for.
                let coast = min(max(Double(PieceMotion.project(CGFloat(from), velocity: velocity * 0.35)), 0), 1)
                withAnimation(motion.settle(velocity: velocity, from: CGFloat(from), to: CGFloat(coast))) {
                    progress = coast
                }
            }
    }

    private func fraction(at x: CGFloat, width: CGFloat) -> Double {
        let raw = x / max(width, 1)
        let directed = layoutDirection == .rightToLeft ? 1 - raw : raw
        let banded = PieceMotion.rubberBand(CGFloat(directed), in: 0...1, limit: 0.06)
        return Double(banded)
    }

    private var timeLabel: String {
        let seconds = Int((progress * duration).rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// One tick per loud peak the playhead enters. Quiet bars and a peak it is already on stay silent.
    private func notePeaks(_ value: Double) {
        guard haptics, !samples.isEmpty else { return }
        let index = min(max(Int((value * Double(samples.count - 1)).rounded()), 0), samples.count - 1)
        guard index != lastPeak else { return }
        let previous = lastPeak
        lastPeak = index
        guard previous >= 0, samples[index] >= 0.82 else { return }
        peaks += 1
    }

    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

/// A short spoken note: it plays, the playhead coasts through the loud peaks, and a drag takes over.
private struct WaveformScrubExample: View {
    @State private var progress = 0.18
    @State private var playing = true

    var body: some View {
        WaveformScrub(samples: Self.samples, progress: $progress, isPlaying: $playing, duration: 16)
            .padding(.horizontal, 24)
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { WaveformBackdrop() }
    }

    /// A handwritten envelope: quiet, a few loud words, quiet again.
    private static let samples: [Double] = [
        0.15, 0.22, 0.18, 0.4, 0.72, 0.95, 0.66, 0.3, 0.2, 0.16,
        0.28, 0.55, 0.88, 0.7, 0.34, 0.18, 0.14, 0.2, 0.48, 0.9,
        0.84, 0.4, 0.22, 0.16, 0.18, 0.36, 0.6, 0.44, 0.2, 0.12,
    ]
}

private struct WaveformBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack {
                WaveformScrub.adaptive(light: 0xF3F2EE, dark: 0x121212)
                Capsule().fill(Color(red: 0.804, green: 0.722, blue: 1)).frame(width: w * 0.86, height: h * 0.22).position(x: w * 0.5, y: h * 0.34)
                Circle().fill(Color(red: 1, green: 0.851, blue: 0.463)).frame(width: w * 0.46).position(x: w * 0.18, y: h * 0.7)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    WaveformScrubExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    WaveformScrubExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand, pressMath)

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
    /// Where a flick at `velocity` (pt/s) coasts to. 0.998 coasts like a scroll view; 0.99 suits detents.
    nonisolated static func project(_ position: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.99) -> CGFloat {
        position + velocity / 1000 * decelerationRate / (1 - decelerationRate)
    }

    /// The candidate closest to `value`.
    nonisolated static func nearest(_ value: CGFloat, in candidates: [CGFloat]) -> CGFloat {
        candidates.min { abs($0 - value) < abs($1 - value) } ?? value
    }

    /// A settle that leaves at the finger's speed (pt/s). One per axis, each on its own `.offset(x:)` / `.offset(y:)`:
    /// a spring takes one velocity. SwiftUI's own velocity carry-over is unreliable; this always carries it.
    func settle(velocity: CGFloat, from current: CGFloat, to target: CGFloat, spring: Spring = PieceMotion.elastic) -> Animation {
        let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : spring
        let distance = target - current
        guard abs(distance) >= 1 else { return .spring(spring) }
        // In whole distances per second, capped near the spring's frequency: a hard flick adds give, not a slingshot.
        // At exactly the frequency a critically damped spring cannot pass its target, so Reduce Motion stops there.
        let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
        let relative = min(max(Double(velocity / distance), -cap), cap)
        return .interpolatingSpring(spring, initialVelocity: relative)
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
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, liquidPop, bud)

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

/// The press for a glass control: the same size-aware sink and lean as `piecePress`, applied through
/// `pieceLiquidScale` so the glass and what it carries sink together (a plain scaleEffect on glass leaves the content
/// behind). Put the glass inside what it presses: the label of a button, the view this modifies. Under Reduce Motion
/// it shades instead of moving.
private struct PieceLiquidPress: ViewModifier {
    let pressed: Bool
    var touch: CGPoint?
    var depth: CGFloat = 2.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero
    @State private var anchor: UnitPoint = .center

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let scale = pressed && !reduceMotion ? PieceMotion.pressScale(for: size, depth: depth) : 1
        // A scale about `anchor` is a scale about the centre plus this shift toward the anchor.
        let lean = CGSize(width: (anchor.x - 0.5) * size.width * (1 - scale), height: (anchor.y - 0.5) * size.height * (1 - scale))
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .pieceLiquidScale(scale)
            .offset(lean)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

/// `PiecePressStyle` for glass buttons: the label (with its `.pieceLiquid` inside) sinks as one.
private struct PieceLiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed, depth: depth)
    }
}

private extension View {
    /// Sinks this view's glass while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func pieceLiquidPress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PieceLiquidPress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// `piecePop` for glass: dips, swells past full size and lands each time `trigger` changes, on the same timings,
/// through `pieceLiquidScale` so the glass and what it carries pop together. Driven from state rather than a
/// keyframe animator, since the liquid scale can't be set from inside one. Still under Reduce Motion.
private struct PieceLiquidPop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scale: CGFloat = 1
    @State private var run = 0

    func body(content: Content) -> some View {
        content
            .pieceLiquidScale(scale)
            .onChange(of: trigger) { _, _ in
                guard !reduceMotion else { return }
                run += 1
                let mine = run
                withAnimation(.easeInOut(duration: 0.08)) { scale = 1 - amount * 0.4 }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(80))
                    guard run == mine else { return }
                    withAnimation(.spring(duration: 0.18, bounce: 0)) { scale = 1 + amount }
                    try? await Task.sleep(for: .milliseconds(140))
                    guard run == mine else { return }
                    withAnimation(.spring(PieceMotion.expressive)) { scale = 1 }
                }
            }
    }
}

private extension View {
    /// Pops this view's glass each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func pieceLiquidPop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PieceLiquidPop(trigger: AnyHashable(trigger), amount: amount))
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
