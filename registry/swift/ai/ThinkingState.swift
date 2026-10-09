// swiftpieces:
// title: Thinking State
// description: "The \"assistant is working\" placeholder, laid out like the reply it becomes: a liquid glass header pill carrying a breathing mark and an elapsed-seconds label that morphs as it counts, over three presentations on one clock: block-colored rising dots, a sheen over reply-shaped bars, or a label whose glyphs carry the sheen. Plus a modifier that sweeps any view."
// category: ai
// minIOSVersion: "17.0"
// version: "2.2.0"
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
        let moving = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
        // Under Reduce Motion only opacity changes, which reads as smooth at 30 fps.
        TimelineView(.animation(minimumInterval: moving ? nil : 1.0 / 30, paused: false)) { context in
            // The clock starts when the placeholder appears, so the first pass enters from the leading edge and the
            // dots rise from rest.
            let t = max(context.date.timeIntervalSince(start), 0)
            let pass = ThinkingPass(time: t, duration: duration)
            VStack(alignment: .leading, spacing: 10) {
                if style.showsHeader { header(breath: moving ? pass.breath : 0, elapsed: Int(t)) }
                content(time: t, pass: pass, moving: moving)
            }
        }
        .fontWeight(.semibold)
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

    /// The reply header while it works: a glass pill carrying a breathing mark, the name, and seconds so far. Its
    /// geometry is `StreamingReply`'s header pill, so a swap there lands without a shift.
    private func header(breath: Double, elapsed: Int) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return PieceLiquidGroup {
            HStack(spacing: 8) {
                // Between passes, and always under Reduce Motion, the mark rests full size and upright, which is
                // StreamingReply's pose, so a swap there lands without a snap.
                ZStack {
                    Circle()
                        .fill(tint ?? style.mark)
                        .scaleEffect(1 - 0.16 * breath)
                    Image(systemName: "sparkle")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(tint == nil ? style.markInk : style.ink)
                        .rotationEffect(.degrees(breath * 45))
                }
                .frame(width: 24, height: 24)
                // The breath is drawn from the clock every frame. Kept out of the label's reshaping below, so the
                // frame a second ticks over never springs the mark.
                .animation(nil, value: breath)
                Text(style.assistantName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.text)
                // Each second the count morphs: digits it shares with the last one hold still and the new ones blur in,
                // in tabular figures so the pill only grows when the count gains a digit. Only the count morphs, so its
                // letters start at once rather than queueing behind the word. Under Reduce Motion they crossfade.
                HStack(spacing: 0) {
                    Text("THINKING · ")
                    PieceMorphText(text: "\(elapsed)S", font: .caption2.weight(.semibold).monospacedDigit())
                }
                .font(.caption2.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(style.muted)
            }
            .padding(.leading, 4)
            .padding(.trailing, 12)
            .frame(minHeight: 32)
            .pieceLiquid(Capsule(), interactive: false)
            // A count that gains a digit widens the pill with a little give. Timeline ticks are not animated, so it
            // needs its own animation.
            .animation(motion.morph, value: elapsed)
        }
    }

    @ViewBuilder
    private func content(time: Double, pass: ThinkingPass, moving: Bool) -> some View {
        switch presentation {
        case .dots:
            // StreamingReply's dots: each rise eases out of rest and back into it. Under Reduce Motion they hold still
            // and the same ripple runs through their opacity.
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    let phase = ((time * 0.9 - Double(index) * 0.16).truncatingRemainder(dividingBy: 1) + 1).truncatingRemainder(dividingBy: 1)
                    let wave = phase < 0.45 ? sin(phase / 0.45 * .pi) : 0
                    let lift = wave * wave
                    Circle()
                        .fill(tint ?? (style.dots.isEmpty ? Color.secondary : style.dots[index % style.dots.count]))
                        .frame(width: 9, height: 9)
                        .opacity(moving ? 1 : 0.5 + 0.5 * lift)
                        .scaleEffect(moving ? 0.8 + 0.2 * lift : 0.8)
                        .offset(y: moving ? -5 * lift : 0)
                }
            }
            .frame(height: lineHeight)
        case .sheen:
            bars
                .overlay { ThinkingSheen(pass: pass, moving: moving, color: tint ?? style.sheen, strength: tint == nil ? 1 : 0.6).mask(bars) }
        case .text(let text):
            let label = Text(text).font(.body)
            label
                .foregroundStyle(style.muted)
                .overlay { ThinkingSheen(pass: pass, moving: moving, color: tint ?? style.text, strength: 1).mask(label) }
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
            Color(UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

public extension View {
    /// Sweeps a sheen across this view while `isActive` is true. Under Reduce Motion it glows in place instead.
    func thinkingState(_ isActive: Bool = true, tint: Color? = nil) -> some View {
        modifier(ThinkingSheenModifier(isActive: isActive, tint: tint))
    }
}

private struct ThinkingSheenModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let isActive: Bool
    let tint: Color?

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        content.overlay {
            // Scoped to the overlay, so the host's own changes keep the host's animation.
            ZStack {
                if isActive {
                    ThinkingSweep(color: tint ?? .white, strength: 0.55)
                        .mask(content)
                        .blendMode(.plusLighter)
                        .transition(.opacity)
                }
            }
            .animation(isActive ? motion.reveal : motion.dismiss, value: isActive)
        }
    }
}

/// The modifier's clock. It starts each time the sweep turns on, so the first pass enters from the leading edge.
private struct ThinkingSweep: View {
    let color: Color
    let strength: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    var body: some View {
        let moving = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
        TimelineView(.animation(minimumInterval: moving ? nil : 1.0 / 30)) { context in
            // The same 2.2 s pass as ThinkingState's default duration.
            let pass = ThinkingPass(time: context.date.timeIntervalSince(start), duration: 2.2)
            ThinkingSheen(pass: pass, moving: moving, color: color, strength: strength)
        }
    }
}

/// Where a clock `time` seconds old is in its pass of `duration`. The glint travels for the first 80%, eased in and
/// out, then rests clear of the view. `breath` rises from 0 and falls back with it, so the mark and the Reduce Motion
/// glow keep the same beat.
private struct ThinkingPass {
    /// 0 is just clear of the leading edge, 1 just clear of the trailing edge.
    var travel: Double
    var breath: Double

    init(time: Double, duration: Double) {
        let progress = (max(time, 0) / max(duration, 0.1)).truncatingRemainder(dividingBy: 1)
        let u = min(progress / 0.8, 1)
        travel = u * u * (3 - 2 * u)
        let wave = sin(.pi * u)
        breath = wave * wave
    }
}

/// One soft band, half the view wide, crossing leading to trailing. The gradient's end points slide rather than its
/// stops, so the band keeps its width and falloff as it enters and leaves. Where it may not move (Reduce Motion) the
/// light glows evenly in place on the pass's breath, so the placeholder still shows it is working.
private struct ThinkingSheen: View {
    let pass: ThinkingPass
    let moving: Bool
    let color: Color
    let strength: Double

    var body: some View {
        let center = -0.25 + pass.travel * 1.5
        let glow = color.opacity(strength * 0.4 * pass.breath)
        LinearGradient(
            colors: moving ? [color.opacity(0), color.opacity(strength), color.opacity(0)] : [glow, glow],
            startPoint: UnitPoint(x: center - 0.25, y: 0.5),
            endPoint: UnitPoint(x: center + 0.25, y: 0.5)
        )
        .allowsHitTesting(false)
    }
}

// MARK: - Example

/// Three placeholders and a sweeping status capsule, as they sit in a chat.
private struct ThinkingStateExample: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            ThinkingState(.dots)
            ThinkingState(.sheen, lineCount: 2)
            ThinkingState(.text("Reading the Q3 report"), style: { var s = ThinkingState.Style(); s.showsHeader = false; return s }())
            // The modifier on a glass status pill: the sweep follows the label's glyphs, so the glass stays clear.
            PieceLiquidGroup {
                Label("Drafting reply", systemImage: "sparkle")
                    .font(.subheadline.weight(.semibold))
                    .thinkingState()
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .pieceLiquid(Capsule(), interactive: false)
            }
        }
        .fontWeight(.semibold)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    ThinkingStateExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    ThinkingStateExample().preferredColorScheme(.dark)
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

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, morphText)

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

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
