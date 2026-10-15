// swiftpieces:
// title: Melt Button
// description: A round liquid glass button whose SF Symbol is molten metal, drawn by a Metal layer shader. Change the symbol and the old one melts into a blob and pours itself into the new one, play into pause, plus into a check; press it and the metal slumps under your finger. The shader cuts a blurred field of both symbols at its surface and shades the inside as chrome, so the morph works between any two symbols.
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [button, symbol, morph, shader, metal, liquid, glass, chrome]
// shaders: [MeltButton.metal]

import SwiftUI

/// A glass button with a liquid metal symbol that melts from one symbol into the next. Copy `MeltButton.metal` alongside this file; its `meltButton` kernel compiles into your app's default Metal library.
///
/// Drive `systemImage` from state, `isPlaying ? "pause.fill" : "play.fill"`, and every change melts the old symbol into
/// the new one. Filled symbols melt best: the metal is cut from the symbol's area, so hairline strokes thin away.
/// VoiceOver reads `label`, and the button acts on `action` like any `Button`.
///
/// - Parameters:
///   - label: What the button does, for VoiceOver and Voice Control. Update it with the symbol.
///   - systemImage: The SF Symbol to show. A change melts into it.
///   - size: The button's diameter in points; scales with Dynamic Type.
///   - tint: The metal's colour: white (default) is chrome; a warm white reads as gold.
///   - action: What a tap does.
public struct MeltButton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric private var size: CGFloat = 64
    @State private var clock = MeltClock()
    /// The symbol melting away and the one forming; equal at rest.
    @State private var from: String
    @State private var to: String
    /// When the last melt began. The timeline runs from then until the metal has set.
    @State private var meltedAt: Date?
    @State private var pressed = false

    private let label: String
    private let systemImage: String
    private let tint: Color
    private let action: () -> Void

    public init(_ label: String, systemImage: String, size: CGFloat = 64, tint: Color = .white, action: @escaping () -> Void) {
        self.label = label
        self.systemImage = systemImage
        self.tint = tint
        self.action = action
        _size = ScaledMetric(wrappedValue: size, relativeTo: .title)
        _from = State(initialValue: systemImage)
        _to = State(initialValue: systemImage)
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(.clear)
                    .pieceLiquid(Circle())
                // Runs while the metal moves and pauses once it has set, so a resting button draws once.
                TimelineView(.animation(minimumInterval: 1.0 / 60, paused: meltedAt == nil && !pressed)) { context in
                    let frame = clock.advance(to: context.date, melting: meltedAt != nil, pressed: pressed, still: reduceMotion)
                    MeltLayer(from: from, to: to, progress: frame.progress, slump: frame.slump, swells: !reduceMotion, size: size, time: frame.time, tint: tint)
                }
            }
            .frame(width: size, height: size)
        }
        .buttonStyle(MeltPressStyle(pressed: $pressed))
        .accessibilityLabel(label)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: systemImage)
        .onChange(of: systemImage) { _, new in
            // Mid-melt, start from whichever symbol is nearer to showing, so a quick run of changes never jumps.
            if clock.progress >= 0.5 { from = to }
            to = new
            clock.restart()
            meltedAt = .now
        }
        .task(id: meltedAt) {
            guard let melt = meltedAt else { return }
            // The melt takes 0.7 s; the ripple settles a little after.
            do { try await Task.sleep(for: .seconds(1.2)) } catch { return }
            if meltedAt == melt {
                from = to
                meltedAt = nil
            }
        }
    }
}

/// The symbols, blurred together, cut and shaded as metal. The outgoing symbol shrinks and fades as the incoming one
/// grows in, and the blur swells mid-melt, so the two pool into one blob before the new shape draws itself out of it.
private struct MeltLayer: View {
    let from: String
    let to: String
    let progress: Double
    let slump: Double
    /// Under Reduce Motion the symbols cross-fade without the blur's swell or the change of scale.
    let swells: Bool
    let size: CGFloat
    let time: Float
    let tint: Color

    var body: some View {
        let p = progress
        // Both at full weight through the middle, so the two shapes merge rather than thin out together.
        let outgoing = min(1, 2 * (1 - p)), incoming = min(1, 2 * p)
        let bump = swells ? sin(Double.pi * p) : 0
        let grow = swells ? 0.35 : 0
        // At rest the blur is small, which rounds the symbol's corners into liquid; it swells mid-melt and under a press.
        let sigma = size * (0.012 + 0.06 * bump + 0.02 * slump)
        let glyph = size * 0.44
        let tint = tint
        ZStack {
            if from != to {
                Image(systemName: from)
                    .opacity(outgoing)
                    .scaleEffect(1 - grow * p)
            }
            Image(systemName: to)
                .opacity(from == to ? 1 : incoming)
                .scaleEffect(from == to ? 1 - 0.06 * slump : 1 - grow + grow * p)
                // A press slumps the metal a little toward the bottom, like a drop sagging.
                .offset(y: glyph * 0.05 * slump)
        }
        .font(.system(size: glyph))
        .fontWeight(.semibold)
        .foregroundStyle(.white)
        .frame(width: size, height: size)
        .blur(radius: sigma)
        .visualEffect { content, proxy in
            content.layerEffect(
                ShaderLibrary.meltButton(.float2(proxy.size), .float(sigma), .float(time), .color(tint)),
                maxSampleOffset: CGSize(width: sigma, height: sigma)
            )
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The glass press, plus the pressed state handed to the metal so it can slump.
private struct MeltPressStyle: ButtonStyle {
    @Binding var pressed: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .pieceLiquidPress(configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, isPressed in pressed = isPressed }
    }
}

/// Per-frame state: the melt's progress, how far a press has slumped the metal, and the ripple clock. Not observed,
/// so a frame never invalidates the view, and a repeated date advances nothing.
@MainActor private final class MeltClock {
    /// MeltButton.metal's rates on the time (1.3 and 1.9 for the ripple, 0.05 for the film) all repeat after 40π.
    private static let period = 40 * Double.pi
    /// How long a melt takes, in seconds.
    private static let duration = 0.7
    private(set) var progress = 1.0
    private var elapsed = 0.0
    private var slump = 0.0
    private var phase = 0.0
    private var last: Date?

    nonisolated init() {}

    /// Starts a new melt from the first frame.
    func restart() {
        elapsed = 0
        progress = 0
    }

    func advance(to date: Date, melting: Bool, pressed: Bool, still: Bool) -> (progress: Double, slump: Double, time: Float) {
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        if melting, progress < 1 {
            elapsed += dt
            let x = min(elapsed / (still ? 0.25 : Self.duration), 1)
            // Eased in and out: the metal gathers, pours and sets.
            progress = x * x * (3 - 2 * x)
        }
        // Under Reduce Motion the press shades the glass instead, and the metal holds its shape.
        let goal: Double = pressed && !still ? 1 : 0
        slump += (goal - slump) * (1 - exp(-dt / (pressed ? 0.08 : 0.18)))
        phase = (phase + (still ? 0 : dt)).truncatingRemainder(dividingBy: Self.period)
        return (progress, slump, Float(phase))
    }
}

// MARK: - Example

/// A player's play and pause, and an add that becomes a check: each tap melts the symbol into the next.
private struct MeltButtonExample: View {
    @State private var playing = false
    @State private var added = false

    var body: some View {
        HStack(spacing: 28) {
            MeltButton(playing ? "Pause" : "Play", systemImage: playing ? "pause.fill" : "play.fill", size: 76) {
                playing.toggle()
            }
            MeltButton(added ? "Added" : "Add to library", systemImage: added ? "checkmark" : "plus", size: 76, tint: Color(red: 1, green: 0.86, blue: 0.62)) {
                added.toggle()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
    }
}

#Preview("Dark") {
    MeltButtonExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid, liquidPress)

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

// swiftpieces-liquid: end
