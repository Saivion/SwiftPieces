// swiftpieces:
// title: Voice Dictation
// description: "The dictate button for a text field: tap the glass mic and it stretches into a capsule of live level bars that scroll in from the right as you speak, with a cancel button on one end and a red done button on the other. Done or cancel shrinks it back into the mic. You feed it the microphone level, so it works with Speech, a recorder or your own engine. For search, notes, messages and forms."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [voice, dictation, microphone, speech, input, level, waveform]

import SwiftUI

/// Sizes and colors for `VoiceDictation`.
public struct VoiceDictationStyle: Sendable {
    /// The mic's diameter, which is also the capsule's height.
    public var height: CGFloat
    /// The capsule's width while listening.
    public var width: CGFloat
    /// How often a new bar comes in, in seconds.
    public var interval: Double
    /// The bars and the mic.
    public var ink: Color
    /// The cancel button's fill.
    public var cancel: Color
    /// The done button's fill, and its check.
    public var done: Color
    public var doneMark: Color

    public init(
        height: CGFloat = 52,
        width: CGFloat = 250,
        interval: Double = 0.06,
        ink: Color = Color(UIColor.label),
        cancel: Color = Color(UIColor.tertiarySystemFill),
        done: Color = Color(red: 1, green: 0, blue: 0),
        doneMark: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
    ) {
        self.height = height
        self.width = width
        self.interval = interval
        self.ink = ink
        self.cancel = cancel
        self.done = done
        self.doneMark = doneMark
    }

    public static let standard = VoiceDictationStyle()
}

/// A mic button that opens into a capsule of live level bars, with cancel and done.
///
/// Start your recognizer when `isListening` turns on and pass its level in as it changes. The capsule grows
/// toward the leading edge, so put it at the trailing end of a row.
///
/// - Parameters:
///   - isListening: Whether it is the capsule. The mic sets it; cancel and done clear it.
///   - level: The microphone's level right now, from 0 for silence to 1 for loud speech.
///   - style: Sizes and colors.
///   - onCancel: Called when cancel is tapped. Throw the dictation away.
///   - onDone: Called when done is tapped. Keep it.
public struct VoiceDictation: View {
    public typealias Style = VoiceDictationStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isListening: Bool
    @State private var meter = VoiceDictationMeter()
    @State private var bars: [CGFloat] = []
    @State private var taps = 0

    private let level: Double
    private let style: Style
    private let onCancel: () -> Void
    private let onDone: () -> Void

    private let barWidth: CGFloat = 3
    private let barGap: CGFloat = 3

    public init(isListening: Binding<Bool>, level: Double, style: Style = .standard, onCancel: @escaping () -> Void = {}, onDone: @escaping () -> Void = {}) {
        self._isListening = isListening
        self.level = level
        self.style = style
        self.onCancel = onCancel
        self.onDone = onDone
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let h = style.height, button = h - 12

        PieceLiquidGroup {
            ZStack(alignment: .trailing) {
                Color.clear
                    .frame(width: isListening ? style.width : h, height: h)
                    .pieceLiquid(RoundedRectangle(cornerRadius: h * 0.42, style: .continuous), interactive: !isListening)

                Button {
                    set(true)
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(style.ink)
                        .frame(width: h, height: h)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .opacity(isListening ? 0 : 1)
                .allowsHitTesting(!isListening)
                .accessibilityLabel("Dictate")
                .accessibilityHidden(isListening)

                if isListening {
                    HStack(spacing: 8) {
                        Button {
                            set(false)
                            onCancel()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(style.ink)
                                .frame(width: button, height: button)
                                .background(style.cancel, in: .circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Cancel dictation")

                        levelBars
                            .frame(maxWidth: .infinity)
                            .frame(height: h - 20)
                            .accessibilityHidden(true)

                        Button {
                            set(false)
                            onDone()
                        } label: {
                            Image(systemName: "checkmark")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(style.doneMark)
                                .frame(width: button, height: button)
                                .background(style.done, in: .circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Done dictating")
                    }
                    .padding(.horizontal, 6)
                    .frame(width: style.width, height: h)
                    .transition(motion.transition(.opacity.combined(with: .scale(scale: 0.9, anchor: .trailing))))
                }
            }
            .frame(width: isListening ? style.width : h, height: h, alignment: .trailing)
        }
        .animation(isListening ? motion.morph : motion.dismiss, value: isListening)
        .onChange(of: level) { _, value in meter.level = CGFloat(min(max(value, 0), 1)) }
        .task(id: isListening) {
            guard isListening else { return }
            bars = []
            while !Task.isCancelled {
                // Each bar eases toward the level, so bars rise and fall rather than jump.
                let previous = bars.last ?? 0
                bars.append(previous + (meter.level - previous) * 0.6)
                if bars.count > 120 { bars.removeFirst(bars.count - 120) }
                try? await Task.sleep(for: .seconds(style.interval))
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: taps)
        .accessibilityElement(children: .contain)
        .accessibilityValue(isListening ? "Listening" : "")
    }

    /// The newest bar at the trailing edge, older ones scrolling toward the leading edge and clipped there.
    private var levelBars: some View {
        Canvas { context, size in
            let step = barWidth + barGap
            var x = size.width - barWidth
            for value in bars.reversed() {
                guard x > -barWidth else { break }
                let height = max(barWidth, value * size.height)
                let rect = CGRect(x: x, y: (size.height - height) / 2, width: barWidth, height: height)
                context.fill(Path(roundedRect: rect, cornerRadius: barWidth / 2), with: .color(style.ink))
                x -= step
            }
        }
        .mask {
            LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.12)], startPoint: .leading, endPoint: .trailing)
        }
    }

    private func set(_ listening: Bool) {
        taps += 1
        isListening = listening
    }
}

/// Holds the latest level outside the view's value, so the bar loop always reads the current one.
@Observable private final class VoiceDictationMeter {
    var level: CGFloat = 0
}

// MARK: - Example

/// A search field with a dictate button. The level is simulated; feed yours from Speech or AVAudioRecorder.
private struct VoiceDictationExample: View {
    @State private var text = ""
    @State private var listening = false
    @State private var level = 0.0

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search trails", text: $text)
            }
            .font(.body.weight(.semibold))
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(Color(UIColor.secondarySystemGroupedBackground), in: .rect(cornerRadius: 22, style: .continuous))
            .opacity(listening ? 0 : 1)
            .overlay(alignment: .leading) {
                if listening {
                    Text("Listening…")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, 16)
                }
            }

            VoiceDictation(isListening: $listening, level: level, onDone: { text = "Lake trails near Ida" })
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
        .task(id: listening) {
            var phase = 0.0
            while listening, !Task.isCancelled {
                phase += 0.06
                let syllable = abs(sin(phase * 9)) * abs(sin(phase * 2.3 + 1))
                level = sin(phase * 0.8) > -0.6 ? 0.15 + 0.85 * syllable : 0.05
                try? await Task.sleep(for: .milliseconds(60))
            }
            level = 0
        }
    }
}

#Preview("Light") {
    VoiceDictationExample()
}

#Preview("Dark") {
    VoiceDictationExample()
        .preferredColorScheme(.dark)
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
// swiftpieces-liquid: 1.8.0 (liquid)

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

// swiftpieces-liquid: end
