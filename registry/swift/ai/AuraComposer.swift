// swiftpieces:
// title: Aura Composer
// description: A chat composer on liquid glass with a living aura behind it, drawn by a Metal shader. The field grows with the message and the send bubble rests joined to it by a liquid neck, turning signal red once there is something to send. Focus the field and the aura wakes and drifts; while the assistant answers it brightens and churns, and the send bubble becomes stop. An optional attach button sits inside the field.
// category: ai
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [composer, chat, input, ai, aura, gradient, shader, metal, glass]
// shaders: [AuraComposer.metal]

import SwiftUI

/// A chat composer: a growing text field on liquid glass, a send bubble joined to it, and an aura behind both that
/// tells the person what the assistant is doing. Copy `AuraComposer.metal` alongside this file; its `auraComposer`
/// kernel compiles into your app's default Metal library.
///
/// The aura has three moods. At rest it is a faint still glow in the composer's colours. With the field focused it
/// wakes and drifts. While `isResponding` it brightens and churns, and the send bubble turns into stop. Sending clears
/// the field and hands the trimmed text to `onSend`.
///
/// - Parameters:
///   - text: The draft. The composer clears it on send.
///   - placeholder: Shown in the empty field.
///   - isResponding: Whether the assistant is answering. The send bubble becomes stop, and the aura brightens.
///   - style: The aura's colours, the send bubble's colours and the field's ink. `.standard` is the house lilac, sky,
///     butter and sage, with a signal red send.
///   - labels: Accessibility labels for the buttons, for localization.
///   - onAttach: Optional. Adds an attach button inside the field's leading edge.
///   - onStop: Called when the person taps stop while `isResponding`.
///   - onSend: Called with the trimmed draft.
public struct AuraComposer: View {
    /// Colours for the composer. Defaults follow the SwiftPieces house palette and adapt to light and dark.
    public struct Style: Sendable {
        /// The aura's colour pools, up to four; fewer repeat. Two to four related colours read as one light.
        public var aura: [Color]
        /// How strongly the aura glows at rest, focused and responding, 0 to 1.
        public var glow: (rest: Double, focused: Double, responding: Double)
        /// The send bubble's tint once there is something to send.
        public var send: Color
        /// The arrow on the send bubble.
        public var sendInk: Color
        /// The stop bubble's tint while responding.
        public var stop: Color
        /// The square on the stop bubble.
        public var stopInk: Color
        /// The draft's text and the attach glyph.
        public var ink: Color
        /// The placeholder.
        public var placeholder: Color

        public init(
            aura: [Color] = [Style.lilac, Style.sky, Style.butter, Style.sage],
            glow: (rest: Double, focused: Double, responding: Double) = (0.35, 0.7, 1),
            send: Color = Color(red: 1, green: 0, blue: 0),
            sendInk: Color = Style.blockInk,
            stop: Color = Style.adaptive(0x141414, 0xF4F3EF),
            stopInk: Color = Style.adaptive(0xF4F3EF, 0x141414),
            ink: Color = Style.adaptive(0x141414, 0xF4F3EF),
            placeholder: Color = Style.adaptive(0x8B8984, 0x8B8984)
        ) {
            self.aura = aura
            self.glow = glow
            self.send = send
            self.sendInk = sendInk
            self.stop = stop
            self.stopInk = stopInk
            self.ink = ink
            self.placeholder = placeholder
        }

        public static let standard = Style()

        public static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
        public static let sky = Color(red: 0.612, green: 0.761, blue: 1)
        public static let butter = Color(red: 1, green: 0.851, blue: 0.463)
        public static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
        public static let blockInk = Color(red: 0.078, green: 0.078, blue: 0.078)

        /// A color that resolves to `light` or `dark` hex by the current appearance.
        public static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? rgb(dark) : rgb(light) })
        }

        nonisolated private static func rgb(_ hex: UInt32) -> UIColor {
            UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
    }

    /// What VoiceOver and Voice Control call the buttons.
    public struct Labels: Sendable {
        public var send: String
        public var stop: String
        public var attach: String

        public init(send: String = "Send", stop: String = "Stop responding", attach: String = "Add attachment") {
            self.send = send
            self.stop = stop
            self.attach = attach
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var text: String
    @FocusState private var focused: Bool
    @ScaledMetric(relativeTo: .body) private var bubble: CGFloat = 46
    @State private var sends = 0
    @State private var stops = 0

    private let placeholder: String
    private let isResponding: Bool
    private let style: Style
    private let labels: Labels
    private let onAttach: (() -> Void)?
    private let onStop: (() -> Void)?
    private let onSend: (String) -> Void

    public init(
        text: Binding<String>,
        placeholder: String = "Ask anything",
        isResponding: Bool = false,
        style: Style = .standard,
        labels: Labels = Labels(),
        onAttach: (() -> Void)? = nil,
        onStop: (() -> Void)? = nil,
        onSend: @escaping (String) -> Void
    ) {
        _text = text
        self.placeholder = placeholder
        self.isResponding = isResponding
        self.style = style
        self.labels = labels
        self.onAttach = onAttach
        self.onStop = onStop
        self.onSend = onSend
    }

    private var draft: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSend: Bool { !draft.isEmpty && !isResponding }
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    /// The aura's energy and glow for the composer's mood.
    private var mood: (energy: Double, glow: Double) {
        if isResponding { return (1, style.glow.responding) }
        if focused { return (0.3, style.glow.focused) }
        return (0, style.glow.rest)
    }

    public var body: some View {
        let corner = bubble / 2 + 2
        PieceLiquidGroup {
            HStack(alignment: .bottom, spacing: PieceLiquid.joined) {
                field(corner: corner)
                action
            }
        }
        .background {
            // The aura sits behind the glass, a little larger and blurred, so the glass carries its colour and its
            // light spills past the edges. It drifts only while it has something to say: focused or responding.
            AuraField(
                shape: RoundedRectangle(cornerRadius: corner + 8, style: .continuous),
                colors: style.aura,
                energy: mood.energy,
                scale: 1.4,
                animates: focused || isResponding
            )
            .padding(-8)
            .blur(radius: 18)
            .opacity(mood.glow)
            .animation(motion.ambient, value: mood.glow)
        }
        .fontWeight(.semibold)
        .sensoryFeedback(.impact(weight: .light), trigger: sends)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: stops)
    }

    private func field(corner: CGFloat) -> some View {
        HStack(alignment: .bottom, spacing: 4) {
            if let onAttach {
                Button(action: onAttach) {
                    Image(systemName: "plus")
                        .font(.body.weight(.semibold))
                        .frame(width: bubble - 8, height: bubble - 8)
                        .contentShape(.circle)
                }
                .buttonStyle(PiecePressStyle())
                .foregroundStyle(style.ink.opacity(0.7))
                .accessibilityLabel(labels.attach)
            }
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(style.placeholder), axis: .vertical)
                .font(.body.weight(.semibold))
                .foregroundStyle(style.ink)
                .tint(style.ink)
                .lineLimit(1...6)
                .focused($focused)
                .padding(.vertical, (bubble - 22) / 2)
                .padding(.leading, onAttach == nil ? 18 : 0)
                .padding(.trailing, 14)
                .frame(minHeight: bubble)
        }
        .padding(.leading, onAttach == nil ? 0 : 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture { focused = true }
        .pieceLiquid(RoundedRectangle(cornerRadius: corner, style: .continuous), interactive: false)
    }

    /// Send, or stop while responding. Neutral glass until there is something to send, then signal red.
    private var action: some View {
        let live = isResponding || canSend
        let tint: Color? = isResponding ? style.stop : (canSend ? style.send : nil)
        return Button {
            if isResponding {
                stops += 1
                onStop?()
            } else if canSend {
                let message = draft
                sends += 1
                text = ""
                onSend(message)
            }
        } label: {
            Image(systemName: isResponding ? "stop.fill" : "arrow.up")
                .font(.body.weight(.semibold))
                .contentTransition(.symbolEffect(.replace))
                .foregroundStyle(isResponding ? style.stopInk : (canSend ? style.sendInk : style.ink.opacity(0.35)))
                .frame(width: bubble, height: bubble)
                .pieceLiquid(.circle, tint: tint, interactive: live)
                .pieceLiquidPop(trigger: sends)
                .animation(motion.morph, value: tint == nil)
                .animation(motion.morph, value: isResponding)
        }
        .buttonStyle(PieceLiquidPressStyle())
        .disabled(!live)
        .accessibilityLabel(isResponding ? labels.stop : labels.send)
    }
}

// MARK: - Aura

/// The aura: `auraComposer` from AuraComposer.metal over a shape, its loop advanced by an `AuraClock`. The timeline runs while
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
                .colorEffect(ShaderLibrary.auraComposer(
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

/// An assistant thread: send a question and the aura brightens while a reply streams in word by word; stop cuts it off.
private struct AuraComposerExample: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var draft = ""
    @State private var messages: [(mine: Bool, text: String)] = [
        (true, "What should I pack for three days in Lisbon in October?"),
        (false, "Light layers: a linen shirt, a knit for the evenings and a light rain jacket. Shoes with grip, since the hills are cobbled.")
    ]
    @State private var reply: Task<Void, Never>?

    private static let answers = [
        "Tram 28 gets crowded by ten, so ride it early, or walk the route downhill from Graça instead.",
        "Pastéis de Belém opens at eight. Go then, or buy a box at Manteigaria in Chiado, which is just as good."
    ]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
                        Text(message.text)
                            .font(.body)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(message.mine ? Color.primary.opacity(0.07) : .clear, in: .rect(cornerRadius: 20, style: .continuous))
                            .frame(maxWidth: .infinity, alignment: message.mine ? .trailing : .leading)
                    }
                }
                .padding(20)
            }
            .defaultScrollAnchor(.bottom)
            AuraComposer(text: $draft, isResponding: reply != nil, onAttach: {}, onStop: stop) { question in
                messages.append((true, question))
                answer()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .fontWeight(.semibold)
        .background(colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
    }

    /// Streams the next canned answer a word at a time.
    private func answer() {
        let words = Self.answers[messages.count / 2 % Self.answers.count].split(separator: " ").map(String.init)
        messages.append((false, ""))
        let index = messages.count - 1
        reply = Task {
            for word in words {
                try? await Task.sleep(for: .milliseconds(90))
                if Task.isCancelled { break }
                messages[index].text += (messages[index].text.isEmpty ? "" : " ") + word
            }
            reply = nil
        }
    }

    private func stop() {
        reply?.cancel()
        reply = nil
    }
}

#Preview("Light") {
    AuraComposerExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    AuraComposerExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press, pressStyle)

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

/// Sinks on touch-down, leaning toward the touch if given, and springs back from the same lean. Under Reduce
/// Motion it shades instead of moving (darker in light mode, lighter in dark), without turning transparent.
private struct PiecePress: ViewModifier {
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
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .scaleEffect(scale, anchor: anchor)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

private extension View {
    /// Sinks this view while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func piecePress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PiecePress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// Only the press, centered: for chips, rows and tiles, and anything in scrolling content.
private struct PiecePressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.piecePress(configuration.isPressed, depth: depth)
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid, liquidPress, liquidPop)

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

// swiftpieces-liquid: end
