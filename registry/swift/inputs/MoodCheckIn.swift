// swiftpieces:
// title: Mood Check-in
// description: A mood picker for journals and wellbeing apps. A panel of living aura, drawn by a Metal shader, carries the mood's own colours and blends from one mood into the next as you drag the glass thumb along the scale, quickening under your finger, while the mood's name morphs letter by letter. Release and it snaps to the nearest mood with a tick for each one it passes; VoiceOver adjusts it a mood at a time.
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [mood, slider, picker, wellbeing, journal, aura, gradient, shader, metal, glass]
// shaders: [MoodCheckIn.metal]

import SwiftUI

/// A mood scale over an aura that takes on the colours of the mood under the thumb. Copy `MoodCheckIn.metal` alongside
/// this file; its `moodCheckIn` kernel compiles into your app's default Metal library.
///
/// `value` runs from 0 (the first mood) to 1 (the last). Dragging moves it continuously and the aura blends between the
/// two nearest moods' colours; on release it snaps to the nearest mood unless `snaps` is off. Read the chosen mood with
/// `MoodCheckIn.mood(at:in:)`.
///
/// - Parameters:
///   - value: Bound position on the scale, 0 to 1.
///   - moods: The moods from one end of the scale to the other, each with its name and up to four aura colours.
///     `MoodCheckIn.standardMoods` runs from Drained to Great.
///   - prompt: The question over the mood's name, and the control's accessibility label.
///   - snaps: Whether a release settles on the nearest mood.
///   - height: The aura panel's height.
///   - cornerRadius: The aura panel's corner radius.
///   - style: Ink, track and end-label colours.
public struct MoodCheckIn: View {
    /// One stop on the scale: its name and the colours its aura is made of.
    public struct Mood: Sendable {
        public var name: String
        /// Up to four aura colours; fewer repeat. Light colours keep the dark ink readable.
        public var colors: [Color]

        public init(_ name: String, colors: [Color]) {
            self.name = name
            self.colors = colors
        }
    }

    /// Colours for the check-in. Defaults follow the SwiftPieces house palette and adapt to light and dark.
    public struct Style: Sendable {
        /// The prompt and mood name over the aura. The aura is always light, so this stays dark in both appearances.
        public var ink: Color
        /// The track under the thumb.
        public var track: Color
        /// The tick marks on the track and the end labels under it.
        public var secondary: Color

        public init(
            ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
            track: Color = Style.adaptive(0xE7E5DF, 0x2E2E2E),
            secondary: Color = Style.adaptive(0x8B8984, 0x8B8984)
        ) {
            self.ink = ink
            self.track = track
            self.secondary = secondary
        }

        public static let standard = Style()

        /// A color that resolves to `light` or `dark` hex by the current appearance.
        public static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? rgb(dark) : rgb(light) })
        }

        nonisolated private static func rgb(_ hex: UInt32) -> UIColor {
            UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
    }

    /// Drained, Low, Okay, Good and Great: cool greys and lilac at the low end, warming through sage and sky to butter
    /// and coral at the top.
    public static let standardMoods: [Mood] = [
        Mood("Drained", colors: [Color(red: 0.69, green: 0.71, blue: 0.8), Color(red: 0.76, green: 0.72, blue: 0.9), Color(red: 0.62, green: 0.67, blue: 0.78), Color(red: 0.8, green: 0.8, blue: 0.86)]),
        Mood("Low", colors: [Color(red: 0.612, green: 0.761, blue: 1), Color(red: 0.804, green: 0.722, blue: 1), Color(red: 0.72, green: 0.8, blue: 0.95), Color(red: 0.7, green: 0.84, blue: 0.86)]),
        Mood("Okay", colors: [Color(red: 0.663, green: 0.863, blue: 0.718), Color(red: 0.612, green: 0.761, blue: 1), Color(red: 0.93, green: 0.9, blue: 0.7), Color(red: 0.804, green: 0.722, blue: 1)]),
        Mood("Good", colors: [Color(red: 1, green: 0.851, blue: 0.463), Color(red: 0.663, green: 0.863, blue: 0.718), Color(red: 1, green: 0.78, blue: 0.6), Color(red: 0.612, green: 0.761, blue: 1)]),
        Mood("Great", colors: [Color(red: 1, green: 0.851, blue: 0.463), Color(red: 1, green: 0.62, blue: 0.55), Color(red: 1, green: 0.75, blue: 0.85), Color(red: 0.804, green: 0.722, blue: 1)])
    ]

    /// The mood nearest `value` on a scale of `moods`.
    public static func mood(at value: Double, in moods: [Mood] = standardMoods) -> Mood? {
        guard !moods.isEmpty else { return nil }
        return moods[index(at: value, count: moods.count)]
    }

    nonisolated private static func index(at value: Double, count: Int) -> Int {
        min(max(Int((min(max(value, 0), 1) * Double(count - 1)).rounded()), 0), max(count - 1, 0))
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.self) private var environment
    @Binding private var value: Double
    /// Where the finger is along the track while dragging, 0 to 1 and beyond either end; nil at rest.
    @State private var pull: CGFloat?
    @ScaledMetric(relativeTo: .body) private var thumb: CGFloat = 30

    private let moods: [Mood]
    private let prompt: String
    private let snaps: Bool
    private let height: CGFloat
    private let cornerRadius: CGFloat
    private let style: Style

    public init(value: Binding<Double>, moods: [Mood] = MoodCheckIn.standardMoods, prompt: String = "How are you feeling?", snaps: Bool = true, height: CGFloat = 220, cornerRadius: CGFloat = 28, style: Style = .standard) {
        _value = value
        self.moods = moods.isEmpty ? MoodCheckIn.standardMoods : moods
        self.prompt = prompt
        self.snaps = snaps
        self.height = height
        self.cornerRadius = cornerRadius
        self.style = style
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    private var index: Int { Self.index(at: value, count: moods.count) }
    private var steps: Double { Double(max(moods.count - 1, 1)) }

    public var body: some View {
        VStack(spacing: 14) {
            panel
            track
            HStack {
                Text(moods[0].name)
                Spacer()
                Text(moods[moods.count - 1].name)
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(style.secondary)
            .accessibilityHidden(true)
        }
        .fontWeight(.semibold)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(prompt)
        .accessibilityValue(moods[index].name)
        .accessibilityAdjustableAction { direction in
            let next: Int
            switch direction {
            case .increment: next = min(index + 1, moods.count - 1)
            case .decrement: next = max(index - 1, 0)
            @unknown default: next = index
            }
            withAnimation(motion.snap) { value = Double(next) / steps }
        }
        .sensoryFeedback(.selection, trigger: index)
    }

    /// The aura in the blended colours of the two moods either side of the value, with the prompt and the mood's name.
    private var panel: some View {
        ZStack(alignment: .bottomLeading) {
            AuraField(
                shape: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous),
                colors: palette,
                energy: pull == nil ? 0.15 : 0.7,
                scale: 1.1
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(prompt)
                    .font(.subheadline.weight(.semibold))
                    .opacity(0.62)
                PieceMorphText(text: moods[index].name, font: .system(.largeTitle, weight: .semibold))
            }
            .foregroundStyle(style.ink)
            .padding(22)
        }
        .frame(height: height)
    }

    /// The four aura colours at the current position: each pool blends from the lower mood's colour to the upper's.
    private var palette: [Color] {
        let position = min(max(Double(pull ?? CGFloat(value)), 0), 1) * steps
        let lower = Int(position.rounded(.down)), upper = min(lower + 1, moods.count - 1)
        let t = position - Double(lower)
        return (0..<4).map { i in
            let a = moods[lower].colors, b = moods[upper].colors
            guard !a.isEmpty, !b.isEmpty else { return .white }
            return blend(a[i % a.count], b[i % b.count], t)
        }
    }

    private func blend(_ a: Color, _ b: Color, _ t: Double) -> Color {
        guard t > 0.001 else { return a }
        let x = a.resolve(in: environment), y = b.resolve(in: environment), f = Float(t)
        return Color(Color.Resolved(red: x.red + (y.red - x.red) * f, green: x.green + (y.green - x.green) * f, blue: x.blue + (y.blue - x.blue) * f, opacity: x.opacity + (y.opacity - x.opacity) * f))
    }

    /// The track, a tick for each mood, and the glass thumb, tinted with the aura's lead colour. The thumb follows the
    /// finger directly and gives a little past either end; the release snaps it to the nearest mood.
    private var track: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width - thumb, 1)
            let shown = pull.map { PieceMotion.rubberBand($0, in: 0...1, limit: 10 / width) } ?? CGFloat(value)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(style.track)
                    .frame(height: 6)
                    .padding(.horizontal, thumb / 2)
                ForEach(moods.indices, id: \.self) { i in
                    Circle()
                        .fill(style.secondary.opacity(0.7))
                        .frame(width: 4, height: 4)
                        .offset(x: thumb / 2 - 2 + width * CGFloat(Double(i) / steps))
                }
                PieceLiquidGroup {
                    Circle()
                        .fill(.clear)
                        .frame(width: thumb, height: thumb)
                        .pieceLiquid(.circle, tint: palette[0], interactive: false)
                        .pieceLiquidScale(pull == nil ? 1 : 1.18)
                        .animation(pull == nil ? motion.release : motion.press, value: pull == nil)
                }
                .offset(x: width * shown)
            }
            .frame(maxHeight: .infinity)
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        let raw = (drag.location.x - thumb / 2) / width
                        pull = raw
                        value = Double(min(max(raw, 0), 1))
                    }
                    .onEnded { _ in
                        let rest = snaps ? Double(index) / steps : value
                        withAnimation(motion.settle) {
                            pull = nil
                            value = rest
                        }
                    }
            )
        }
        .frame(height: 44)
    }
}

// MARK: - Aura

/// The aura: `moodCheckIn` from MoodCheckIn.metal over a shape, its loop advanced by an `AuraClock`. The timeline runs while
/// `animates`, and for a moment after the energy changes so it can ease there; never under Reduce Motion, where the aura
/// holds still and takes each new energy at once.
private struct AuraField<S: Shape>: View {
    let shape: S
    let colors: [Color]
    var energy: Double = 0
    var scale: Double = 1
    var animates = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var clock = AuraClock()
    @State private var easing = false

    var body: some View {
        let pools = (0..<4).map { colors.isEmpty ? Color.white : colors[$0 % colors.count] }
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion || !(animates || easing))) { context in
            let frame = clock.advance(to: context.date, energy: energy, still: reduceMotion)
            shape
                .fill(.white)
                .colorEffect(ShaderLibrary.moodCheckIn(
                    .boundingRect, .float(frame.phase), .float(frame.energy), .float(Float(scale)),
                    .color(pools[0]), .color(pools[1]), .color(pools[2]), .color(pools[3])
                ))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .task(id: energy) {
            easing = true
            do {
                try await Task.sleep(for: .seconds(1.6))
                easing = false
            } catch {}
        }
    }
}

/// The aura's loop and energy. The phase advances with the frame's time, faster with more energy, and wraps at 2π,
/// where the kernel's paths all close. The energy eases toward its goal, so a change of state quickens the aura rather
/// than jumping it. Not observed, so a frame never invalidates the view, and a repeated date advances nothing.
@MainActor private final class AuraClock {
    private var phase = 0.0
    private var energy: Double?
    private var last: Date?

    nonisolated init() {}

    func advance(to date: Date, energy goal: Double, still: Bool) -> (phase: Float, energy: Float) {
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        let current = energy ?? goal
        let next = still ? goal : current + (goal - current) * (1 - exp(-dt / 0.4))
        energy = next
        // About a minute and a half a loop at rest, and a little over twice as fast at full energy.
        phase = (phase + (still ? 0 : dt * 0.066 * (1 + 1.4 * next))).truncatingRemainder(dividingBy: 2 * Double.pi)
        return (Float(phase), Float(next))
    }
}

// MARK: - Example

/// A journal's morning check-in: pick a mood and log it.
private struct MoodCheckInExample: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var value = 0.5
    @State private var logged: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Thursday, 9:14")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            MoodCheckIn(value: $value)
            Button {
                logged = MoodCheckIn.mood(at: value)?.name
            } label: {
                Text(logged.map { "Logged \($0.lowercased())" } ?? "Log mood")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color(red: 1, green: 0, blue: 0), in: .capsule)
                    .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
            }
            .buttonStyle(.plain)
        }
        .font(.body)
        .fontWeight(.semibold)
        .padding(20)
        .frame(maxHeight: .infinity)
        .background(colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
        .onChange(of: value) { _, _ in logged = nil }
    }
}

#Preview("Light") {
    MoodCheckInExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    MoodCheckInExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, rubberBand)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid, morphText)

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
///
/// Only text whose letters stand on their own is cut into letters: Latin, Greek, Cyrillic, CJK, digits and symbols.
/// Those letters are laid out left to right whatever the layout direction, the order they read in, so "1.5×" stays
/// "1.5×" in an Arabic or Hebrew interface instead of coming out backwards. Text in a right-to-left script, or in one
/// whose letters join or reorder (Arabic, Hebrew, Devanagari, Thai and their neighbours), can't be cut apart without
/// breaking it, so it changes as one: the old string blurs out where it stood while the new one blurs in.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if Self.splits(text) {
                let glyphs = Array(text)
                HStack(spacing: 0) {
                    ForEach(glyphs.indices, id: \.self) { i in
                        Text(String(glyphs[i]))
                            .id("\(i)\(glyphs[i])")
                            .transition(transition(i, scale: 0.6))
                    }
                }
                // The letters' reading order, not the layout's: an HStack lays its children out backwards under a
                // right-to-left layout.
                .environment(\.layoutDirection, .leftToRight)
            } else {
                ZStack(alignment: .leading) {
                    Text(text)
                        .id(text)
                        .transition(transition(0, scale: 0.9))
                }
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int, scale: CGFloat) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: scale, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }

    /// Whether `text` can be cut into letters that each read left to right on their own: no right-to-left script, no
    /// script that joins or reorders its letters, and no bidirectional control characters.
    private static func splits(_ text: String) -> Bool {
        !text.unicodeScalars.contains { scalar in
            switch scalar.value {
            case 0x0590...0x08FF, // Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic
                 0x0900...0x0DFF, // Devanagari to Sinhala
                 0x0E00...0x0FFF, // Thai, Lao, Tibetan
                 0x1000...0x109F, // Myanmar
                 0x1780...0x17FF, // Khmer
                 0xA8E0...0xA8FF, // Devanagari Extended
                 0xFB1D...0xFDFF, // Hebrew and Arabic presentation forms
                 0xFE70...0xFEFF, // Arabic presentation forms B
                 0x200E...0x200F, 0x202A...0x202E, 0x2066...0x2069, // bidirectional marks, embeddings and isolates
                 0x10800...0x10FFF, // historic right-to-left scripts
                 0x1E800...0x1EFFF: // Adlam and other right-to-left scripts
                return true
            default:
                return false
            }
        }
    }
}

// swiftpieces-liquid: end
