// swiftpieces:
// title: Flip Card
// description: A two-sided card you flip by tap or by dragging sideways. The drag scrubs the rotation, release commits or snaps back by velocity and carries the flick into the landing, the card lifts toward you mid-turn with a layered shadow that slides off the raised edge, and each face shades as it turns edge-on. An optional liquid glass flip hint rides the card's axis, its signal dot smearing from the front slot to the back slot as the card turns, and the faces take semibold type.
// category: cards
// minIOSVersion: "17.0"
// version: "2.2.0"
// pro: payment-card
// tags: [card, flip, drag, 3d, spring, flashcard]

import SwiftUI

/// Two-sided card with tap-to-flip and drag-to-flip.
///
/// - Parameters:
///   - isFlipped: Optional binding to drive the flip externally. Leave nil to let the card manage its own state; taps and drags still update the binding when one is passed.
///   - style: Depth, lift, press, and shading tuning. `.standard` uses the house values; the faces bring their own color.
///   - onFlip: Called after a flip commits, with `true` when the back is now showing.
///   - front: Front face. Give it its own shape and surface; the card only rotates, lifts, shades, and shadows it. Text
///     on it takes semibold type. Keep glass off the faces: Liquid Glass can't follow a half turn in 3D, so it would
///     flatten mid-flip. The flip hint (`Style.hint`) is the card's glass, and it stays flat on the axis.
///   - back: Back face, shown after the flip. It is pre-rotated so text is never mirrored.
public struct FlipCard<Front: View, Back: View>: View {
    /// Physical tuning for the card. Colors live on the faces you pass in; this controls how the card moves and sits on the page.
    public struct Style: Sendable {
        /// Corner radius of the faces, used to shape the shadow and the edge sheen. Match your faces' radius.
        public var cornerRadius: CGFloat
        /// Shadow ink.
        public var shadow: Color
        /// Shadow strength in light mode; dark mode uses about three times this so the card still separates from a dark ground.
        public var shadowOpacity: Double
        /// Extra scale at the edge-on point of a flip, so the card rises toward you as it turns. 0 keeps it flat.
        public var lift: CGFloat
        /// Scale while a finger is down without dragging.
        public var pressScale: CGFloat
        /// Touch-down tilt toward the finger, in degrees.
        public var pressTilt: Double
        /// How much a face darkens edge-on, 0...1.
        public var shading: Double
        /// Shows the flip hint: a small liquid glass pill at the top centre of the card, on the axis it turns about,
        /// with a slot for each face and a dot that slides from one to the other as the card turns. It stays flat while
        /// the faces turn, so the glass never has to follow them into 3D. Off by default; keep the top centre of your
        /// faces clear for it.
        public var hint: Bool
        /// The flip hint's dot, which marks the face showing. Signal red by default.
        public var hintTint: Color

        public init(cornerRadius: CGFloat = 26, shadow: Color = .black, shadowOpacity: Double = 0.14, lift: CGFloat = 0.06, pressScale: CGFloat = 0.97, pressTilt: Double = 6, shading: Double = 0.16, hint: Bool = false, hintTint: Color = Color(red: 1, green: 0, blue: 0)) {
            self.cornerRadius = cornerRadius
            self.shadow = shadow
            self.shadowOpacity = shadowOpacity
            self.lift = lift
            self.pressScale = pressScale
            self.pressTilt = pressTilt
            self.shading = shading
            self.hint = hint
            self.hintTint = hintTint
        }

        /// House defaults: 26 pt corners, a 6% lift mid-turn, a 0.97 press, no flip hint.
        public static var standard: Style { Style() }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isEnabled) private var isEnabled
    /// The card's turn is a sprung part plus a held part, and only their sum is drawn. Every animation moves `angle`;
    /// a dragging finger sets `twist` directly and nothing animates it, so a card caught while it is still landing
    /// finishes that landing under the finger instead of jumping.
    @State private var angle: Double = 0
    @State private var twist: Double = 0
    /// The drawn angle when the scrub began.
    @State private var dragBase: Double?
    @State private var press: CGPoint?
    /// 1 while a finger is turning the card, which lifts it off the page even face-on.
    @State private var hold: Double = 0
    @State private var size = CGSize(width: 1, height: 1)
    @State private var pressTick = 0
    /// Resets when the system cancels the touch, which skips onEnded.
    @GestureState private var touching = false

    private let external: Binding<Bool>?
    private let style: Style
    private let onFlip: ((Bool) -> Void)?
    private let front: Front
    private let back: Back

    public init(isFlipped: Binding<Bool>? = nil, style: Style = .standard, onFlip: ((Bool) -> Void)? = nil, @ViewBuilder front: () -> Front, @ViewBuilder back: () -> Back) {
        self.external = isFlipped
        self.style = style
        self.onFlip = onFlip
        self.front = front()
        self.back = back()
    }

    private var isFlipped: Bool { Int(((angle + twist) / 180).rounded()).magnitude % 2 == 1 }
    private var showsBack: Bool { Self.showsBack(at: angle + twist) }
    private var isPressed: Bool { press != nil && dragBase == nil }

    nonisolated fileprivate static func showsBack(at angle: Double) -> Bool {
        let a = (angle.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        return a > 90 && a < 270
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let pressMotion = isPressed ? motion.press : motion.release
        // Touch-down tilts the card slightly toward the finger before any drag begins.
        // Typed and converted explicitly: mixing CGFloat and Double inside `map { } ?? 0` lets some
        // compilers pick the optional `??` overload and infer `Double?`.
        let tiltX: Double = press.map { -(Double($0.y / size.height) - 0.5) * style.pressTilt } ?? 0
        let tiltY: Double = press.map { (Double($0.x / size.width) - 0.5) * style.pressTilt } ?? 0

        ZStack {
            front.modifier(Face(angle: angle, twist: twist, isBack: false, crossfade: reduceMotion, shading: style.shading, radius: style.cornerRadius))
            back.modifier(Face(angle: angle, twist: twist, isBack: true, crossfade: reduceMotion, shading: style.shading, radius: style.cornerRadius))
        }
        .fontWeight(.semibold)
        // Reduce Motion: a press shades the faces (lighter in dark mode) instead of sinking and tilting, so a touch still shows.
        .animation(pressMotion) { faces in
            faces.brightness(isPressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
        }
        .modifier(Depth(angle: angle, twist: twist, hold: hold, style: style, flat: reduceMotion))
        // Over both faces rather than on one, so it never turns with them: glass drawn in 3D flattens mid-turn. On the
        // axis it stays over the card the whole way round. Outside the depth, so the card's shadow never falls on it
        // (glass draws in its own layer and would take the shadow as a halo); it lifts with the card on its own.
        .overlay {
            if style.hint {
                Hint(angle: angle, twist: twist, tint: style.hintTint, lift: style.lift, flat: reduceMotion)
            }
        }
        // Only the press is animated here, so a scrub that starts on the same frame stays directly under the finger.
        .animation(pressMotion) { card in
            card
                .scaleEffect(isPressed && !reduceMotion ? style.pressScale : 1)
                .rotation3DEffect(.degrees(reduceMotion ? 0 : tiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.5)
                .rotation3DEffect(.degrees(reduceMotion ? 0 : tiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
        }
        .opacity(isEnabled ? 1 : 0.5)
        .contentShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
        .gesture(drag, isEnabled: isEnabled)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: pressTick)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: showsBack)
        // A touch the system cancelled (an alert, a gesture higher up taking over) never reaches onEnded, so let go
        // here: the card turns back to the face it started on without committing. After a normal release onEnded
        // has already cleared both.
        .onChange(of: touching) { _, isTouching in
            guard !isTouching else { return }
            if let base = dragBase {
                dragBase = nil
                withAnimation(motion.snap) {
                    angle = base - twist
                    hold = 0
                }
            }
            press = nil
        }
        .onChange(of: external?.wrappedValue) { _, new in
            if let new, new != isFlipped { flip() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(showsBack ? "Back" : "Front")
        .accessibilityHint("Flips the card")
        .accessibilityAction { flip() }
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($touching) { _, touching, _ in touching = true }
            .onChanged { drag in
                if press == nil && dragBase == nil {
                    press = drag.startLocation
                    pressTick += 1
                }
                if dragBase == nil, abs(drag.translation.width) > 8 {
                    dragBase = angle + twist
                    press = nil
                    // Picked up on the press spring. The lift springs apart from the turn (see Shadows), so catching
                    // a card still landing leaves that landing alone.
                    withAnimation(PieceMotion(reduceMotion: reduceMotion).press) { hold = 1 }
                }
                if let dragBase {
                    // Directly under the finger, never animated.
                    twist = dragBase + Double(scrub(drag.translation.width)) - angle
                }
            }
            .onEnded { drag in
                if let base = dragBase {
                    // Commit when the projected end passes 90° in either direction, otherwise snap back.
                    let projected = Double(drag.predictedEndTranslation.width / size.width) * 180
                    let target = abs(projected) >= 90 ? base + (projected > 0 ? 180 : -180) : base
                    let committed = target != base
                    // The card's own turning speed in degrees per second, not the finger's: past a half turn the band slows it.
                    // Bounded, so a hard flick swings at most about 20° past the face instead of slinging 40° past it.
                    let t = drag.translation.width
                    let speed = min(max((scrub(t + drag.velocity.width * 0.01) - scrub(t)) / 0.01, -1500), 1500)
                    let motion = PieceMotion(reduceMotion: reduceMotion)
                    dragBase = nil
                    // Carries the flick into the landing.
                    withAnimation(motion.settle(velocity: speed, from: CGFloat(angle + twist), to: CGFloat(target), spring: Self.releaseTurn)) {
                        angle = target - twist
                    }
                    // Sets back down onto the page as it lands, on the same spring but from rest: with the turn's speed,
                    // a release still moving away from its landing would first lift the card higher.
                    withAnimation(motion.settle(velocity: 0, from: 1, to: 0, spring: Self.releaseTurn)) { hold = 0 }
                    sync()
                    if committed { onFlip?(isFlipped) }
                } else if press != nil {
                    flip()
                }
                press = nil
            }
    }

    /// Degrees of turn for a sideways drag: the card's width is a half turn. Past that the turn meets rubber-band
    /// resistance, easing toward 30° more without ever reaching it.
    private func scrub(_ translation: CGFloat) -> CGFloat {
        PieceMotion.rubberBand(translation / max(size.width, 1) * 180, in: -180...180, limit: 30)
    }

    /// The card's weight on its axle: the timing is kept from v2, the give raised with the elastic tier, so a half turn
    /// from rest swings about 8° past its face and settles back, and a hard flick 13° to 20°. A release has part of the
    /// turn behind it and brings the finger's speed; a tap turns the whole way from rest, so it takes longer.
    private static var releaseTurn: Spring { Spring(duration: 0.55, bounce: 0.3) }
    private static var tapTurn: Spring { Spring(duration: 0.7, bounce: 0.3) }

    /// A tap, VoiceOver or the binding. A merging spring, so a second tap mid-turn carries on smoothly into the next
    /// half turn. Under Reduce Motion the crossfade runs on the shared short spring with no overshoot.
    private func flip() {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        withAnimation(reduceMotion ? motion.snap : .spring(Self.tapTurn)) { angle += 180 }
        // Mid-scrub (the binding changed under a finger), the scrub carries on from the new face.
        if let base = dragBase { dragBase = base + 180 }
        sync()
        onFlip?(isFlipped)
    }

    private func sync() {
        if let external, external.wrappedValue != isFlipped { external.wrappedValue = isFlipped }
    }

    /// Lift and shadow that follow the drawn angle: the card rises mid-turn, a tight contact shadow shrinks, and a soft key shadow slides away from the raised edge.
    private struct Depth: ViewModifier, Animatable {
        var angle: Double
        let twist: Double
        let hold: Double
        let style: Style
        let flat: Bool

        // Only the sprung part of the turn animates here; the finger's twist is added as it is.
        nonisolated var animatableData: Double {
            get { angle }
            set { angle = newValue }
        }

        func body(content: Content) -> some View {
            let edge = flat ? 0 : sin((angle + twist) * .pi / 180)
            content
                .scaleEffect(1 + style.lift * abs(edge))
                .modifier(Shadows(edge: edge, hold: hold, style: style))
        }
    }

    /// The layered shadow, raised by the turn or by `hold`, which eases in as a finger picks the card up and settles
    /// out as it lands. The hold springs here, apart from the turn: sharing one modifier, a release would hand the hold
    /// the turn's speed, and a pick-up moving only the hold would knock the lift's turn out of step with the faces.
    private struct Shadows: ViewModifier, Animatable {
        let edge: Double
        var hold: Double
        let style: Style
        @Environment(\.colorScheme) private var colorScheme

        nonisolated var animatableData: Double {
            get { hold }
            set { hold = newValue }
        }

        func body(content: Content) -> some View {
            let strength = min(style.shadowOpacity * (colorScheme == .dark ? 3 : 1), 1)
            let up = max(abs(edge), hold * 0.35)
            content
                .shadow(color: style.shadow.opacity(strength * (1 - up * 0.6)), radius: 2, y: 1)
                .shadow(color: style.shadow.opacity(strength), radius: 16 + up * 18, x: -edge * 18, y: 12 + up * 10)
        }
    }

    /// The flip hint: a glass pill with a slot for each face, and a signal dot over the slot of the face showing. The dot
    /// follows the drawn angle, so it slides under a scrub and lands on the turn's own spring, and mid-turn it smears
    /// along the pill like a drop of liquid on the move. Under Reduce Motion it slides without smearing.
    private struct Hint: View, Animatable {
        var angle: Double
        let twist: Double
        let tint: Color
        let lift: CGFloat
        let flat: Bool

        // Only the sprung part animates; the finger's twist is added as it is.
        nonisolated var animatableData: Double {
            get { angle }
            set { angle = newValue }
        }

        var body: some View {
            let radians = (angle + twist) * .pi / 180
            // 0 with the front showing, 1 with the back, through every whole turn.
            let side = (1 - cos(radians)) / 2
            let smear = flat ? 0 : abs(sin(radians))
            let reach: CGFloat = 12
            // It sits on the card rather than floating off it, so it takes no lift shadow of its own.
            PieceLiquidGroup(lift: false) {
                ZStack {
                    // The two slots, faint, so the pill reads as two sides rather than a switch.
                    HStack(spacing: reach * 2 - 6) {
                        Circle().frame(width: 6, height: 6)
                        Circle().frame(width: 6, height: 6)
                    }
                    .foregroundStyle(.primary)
                    .opacity(0.22)
                    Capsule()
                        .fill(tint)
                        .frame(width: 10 + 10 * smear, height: 10 - 1.5 * smear)
                        .offset(x: reach * (2 * side - 1))
                }
                .frame(width: 52, height: 28)
                .pieceLiquid(Capsule(), interactive: false)
            }
            .padding(.top, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            // Rises toward you with the card mid-turn, about the card's centre, as the depth lifts the faces.
            .scaleEffect(1 + lift * smear)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    /// Rotates one face, darkens it as it turns edge-on, and hides it past 90° so each face is only seen from its own side.
    private struct Face: ViewModifier, Animatable {
        var angle: Double
        let twist: Double
        let isBack: Bool
        let crossfade: Bool
        let shading: Double
        let radius: CGFloat

        // Only the sprung part animates; the finger's twist is added as it is.
        nonisolated var animatableData: Double {
            get { angle }
            set { angle = newValue }
        }

        func body(content: Content) -> some View {
            let drawn = angle + twist
            let radians = drawn * .pi / 180
            let visible = isBack ? FlipCard.showsBack(at: drawn) : !FlipCard.showsBack(at: drawn)
            // Reduce Motion crossfades the faces in place. One structure either way, with the rotation and shading
            // at zero, so switching the setting never rebuilds the faces or loses their state.
            let backOpacity = 0.5 - 0.5 * cos(radians)
            let turn = crossfade ? 0 : abs(sin(radians))
            content
                .brightness(-turn * shading)
                // A light band crosses the face as it turns, so the rotation reads as a lit surface.
                .overlay {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(.white.opacity(0.18 * turn * (sin(radians) > 0 ? 1 : 0.4)))
                        .blendMode(.softLight)
                        .allowsHitTesting(false)
                }
                .opacity(crossfade ? (isBack ? backOpacity : 1 - backOpacity) : (visible ? 1 : 0))
                // The back starts at -180° so it lands unmirrored when the flip completes.
                .rotation3DEffect(.degrees(crossfade ? 0 : (isBack ? drawn - 180 : drawn)), axis: (x: 0, y: 1, z: 0), perspective: 0.45)
                .accessibilityHidden(!visible)
        }
    }
}

fileprivate extension Color {
    /// An appearance-adaptive color, resolved per trait collection.
    init(flipLight light: Color, dark: Color) {
        self.init(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }
}

// MARK: - Example

/// A vocabulary flashcard: a butter front with a large word, a sky back with the meaning, and the glass flip hint
/// riding the top of the card. The badges are light chips drawn as part of each face, so they turn with it.
private struct FlipCardExample: View {
    @State private var flipped = false

    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let butter = Color(red: 1, green: 0.851, blue: 0.463)
    private let sky = Color(red: 0.612, green: 0.761, blue: 1)
    private let ground = Color(flipLight: Color(red: 0.953, green: 0.949, blue: 0.933), dark: Color(red: 0.071, green: 0.071, blue: 0.071))

    var body: some View {
        FlipCard(isFlipped: $flipped, style: .init(hint: true)) {
            front
        } back: {
            back
        }
        .frame(width: 320, height: 214)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ground)
    }

    private var front: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(butter)
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        chip(Text("PORTUGUESE").font(.caption2.weight(.semibold)).tracking(1))
                        Spacer()
                        chip(Text("3 / 12").font(.system(.caption, design: .monospaced).weight(.semibold)))
                    }
                    .padding([.horizontal, .top], -10)
                    Spacer()
                    Text("Saudade")
                        .font(.system(size: 46, weight: .semibold))
                        .tracking(-1.8)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("noun  ·  sow-DAH-jee")
                        .font(.subheadline.weight(.semibold))
                        .opacity(0.62)
                }
                .foregroundStyle(ink)
                .padding(22)
            }
    }

    private var back: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(sky)
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    chip(Text("MEANING").font(.caption2.weight(.semibold)).tracking(1))
                        .padding([.leading, .top], -10)
                    Text("A deep longing for someone or something far away.")
                        .font(.system(size: 22, weight: .semibold))
                        .tracking(-0.6)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                    Text("Often heard in fado songs")
                        .font(.subheadline.weight(.semibold))
                        .opacity(0.62)
                }
                .foregroundStyle(ink)
                .padding(22)
            }
    }

    /// A face badge: a light chip drawn as part of the face, so it turns with it. 12pt in from the edges and 28pt tall,
    /// so its ends are concentric with the card's 26pt corners and its text lines up with the face's text, and level
    /// with the glass flip hint between them.
    private func chip(_ label: some View) -> some View {
        label
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background(.white.opacity(0.42), in: Capsule())
            .overlay { Capsule().strokeBorder(.white.opacity(0.6), lineWidth: 0.5) }
    }
}

#Preview("Light") {
    FlipCardExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    FlipCardExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid)

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
