// swiftpieces:
// title: Metal Halo
// description: A ring of liquid metal around any button, drawn by a Metal color shader. A hot spot wanders around the chrome with a thin-film fringe and a soft bloom, the reflections ripple like mercury, and a finger or pointer bends the ring toward it and draws the hot spot to where it touches. Dims to plain steel when the control is inactive.
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [button, shader, metal, chrome, halo, glow, touch]
// shaders: [MetalHalo.metal]

import SwiftUI

/// A liquid metal ring for a button. Apply with `.metalHalo()`, and copy `MetalHalo.metal` alongside this file; its `metalHalo` kernel compiles into your app's default Metal library.
///
/// The ring is drawn just inside the outline you name, so it never changes the layout, and the bloom spills out around it.
/// Put it on the label inside a `Button` so the ring sinks with the press. It draws nothing you can hit and adds no
/// accessibility element: the button keeps its own label.
///
/// - Parameters:
///   - outline: The shape to ring: `.circle` (default), `.capsule`, or `.rounded(_:)` with a corner radius.
///   - width: Ring width in points.
///   - glow: Bloom strength around the hot spot, 0 for none.
///   - glowTint: The bloom's colour. `nil` (default) is a cool white in dark mode and a light blue in light mode.
///   - speed: How fast the hot spot wanders. 0 holds it up and to the left.
///   - isActive: When false the ring dims to plain steel and the bloom goes out, for a send button with nothing to send. The change eases.
///   - bendsToTouch: The ring bulges toward a finger or pointer on it, and the hot spot leans to where it touches.
public struct MetalHalo: ViewModifier {
    /// The outline the ring follows.
    public enum Outline: Sendable, Equatable {
        case circle
        case capsule
        case rounded(CGFloat)

        /// The corner radius the shader takes; negative means half the short side.
        var radius: CGFloat {
            switch self {
            case .circle, .capsule: -1
            case .rounded(let r): max(r, 0)
            }
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var clock = HaloClock()
    /// Where a finger or pointer is, in the content's coordinates. `nil` while nothing touches.
    @State private var touch: CGPoint?
    /// When the last touch lifted. The clock runs on for a moment after it, so the bend eases out before the timeline
    /// pauses.
    @State private var releasedAt: Date?

    private let outline: Outline
    private let width: CGFloat
    private let glow: CGFloat
    private let glowTint: Color?
    private let speed: Double
    private let isActive: Bool
    private let bendsToTouch: Bool

    public init(outline: Outline = .circle, width: CGFloat = 2, glow: CGFloat = 1, glowTint: Color? = nil, speed: Double = 1, isActive: Bool = true, bendsToTouch: Bool = true) {
        self.outline = outline
        self.width = max(width, 1)
        self.glow = max(glow, 0)
        self.glowTint = glowTint
        self.speed = speed
        self.isActive = isActive
        self.bendsToTouch = bendsToTouch
    }

    public func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        // The bloom needs room outside the outline: a little more than the ring's own width, at least 14 points.
        let pad = max(14, width * 6)
        let tint = glowTint ?? (colorScheme == .dark ? Color(red: 0.86, green: 0.92, blue: 1) : Color(red: 0.55, green: 0.7, blue: 1))
        content
            .overlay {
                HaloSurface(
                    clock: clock,
                    energy: isActive ? 1 : 0,
                    pad: pad,
                    radius: outline.radius,
                    width: width,
                    glow: glow,
                    tint: tint,
                    speed: speed,
                    drifting: motion.allowsAmbient,
                    touch: touch.map { CGPoint(x: $0.x + pad, y: $0.y + pad) },
                    running: (motion.allowsAmbient && speed != 0) || touch != nil || releasedAt != nil
                )
                .padding(-pad)
                .animation(motion.reveal, value: isActive)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in if bendsToTouch { touch = value.location } }
                    .onEnded { _ in lift() },
                including: bendsToTouch ? .all : .subviews
            )
            .onContinuousHover { phase in
                guard bendsToTouch else { return }
                switch phase {
                case .active(let point): touch = point
                case .ended: lift()
                }
            }
            .task(id: releasedAt) {
                guard let lifted = releasedAt else { return }
                // Five of the bend's 0.3 s time constants: at rest to the eye.
                do { try await Task.sleep(for: .seconds(1.5)) } catch { return }
                if releasedAt == lifted { releasedAt = nil }
            }
    }

    private func lift() {
        guard touch != nil else { return }
        touch = nil
        releasedAt = .now
    }
}

public extension View {
    /// Rings this view with liquid metal. See `MetalHalo` for the parameters.
    func metalHalo(_ outline: MetalHalo.Outline = .circle, width: CGFloat = 2, glow: CGFloat = 1, glowTint: Color? = nil, speed: Double = 1, isActive: Bool = true, bendsToTouch: Bool = true) -> some View {
        modifier(MetalHalo(outline: outline, width: width, glow: glow, glowTint: glowTint, speed: speed, isActive: isActive, bendsToTouch: bendsToTouch))
    }
}

/// The shader layer. `energy` animates, so turning the control off dims the metal and the bloom together.
private struct HaloSurface: View, Animatable {
    let clock: HaloClock
    var energy: Double
    let pad: CGFloat
    let radius: CGFloat
    let width: CGFloat
    let glow: CGFloat
    let tint: Color
    let speed: Double
    let drifting: Bool
    let touch: CGPoint?
    let running: Bool

    nonisolated var animatableData: Double {
        get { energy }
        set { energy = newValue }
    }

    var body: some View {
        // At most 60 fps: the hot spot travels well under a point a frame, so 120 Hz adds cost, not smoothness.
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !running)) { context in
            let frame = clock.advance(to: context.date, speed: speed, holds: !drifting, touch: touch)
            let pad = pad, radius = radius, width = width, tint = tint
            let glow = Float(glow), energy = Float(energy)
            Rectangle()
                .visualEffect { content, proxy in
                    content.colorEffect(
                        ShaderLibrary.metalHalo(
                            .float2(proxy.size),
                            .float(pad),
                            .float(radius),
                            .float(width),
                            .float(frame.phase),
                            .float2(frame.point),
                            .float(frame.pull),
                            .float(glow),
                            .float(energy),
                            .color(tint)
                        )
                    )
                }
        }
    }
}

/// Per-frame state the timeline advances: the wander phase, its rate, and how hard the finger pulls. Not observed, so a
/// frame never invalidates the view, and a repeated date advances nothing.
@MainActor private final class HaloClock {
    /// MetalHalo.metal's rates on the phase (0.8 and 0.55 for the wander, 0.9 and 1.4 for the ripple) all repeat after
    /// 40π, so the phase wraps there without a seam and stays small for Float. Update it if those rates change.
    private static let period = 40 * Double.pi
    private var phase = 0.0
    private var rate = 0.0
    private var pull = 0.0
    private var point = CGPoint.zero
    private var last: Date?

    nonisolated init() {}

    /// Advances to `date`. The phase starts at 0, the hot spot up and to the left, on the first frame.
    func advance(to date: Date, speed: Double, holds: Bool, touch: CGPoint?) -> (phase: Float, pull: Float, point: CGPoint) {
        // At most a tenth of a second, so resuming after a pause or the background never leaps.
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        // The wander eases to speed over about a second, from rest at appearance and to every new speed. Reduce Motion
        // (`holds`) stops it where it is.
        rate = holds ? 0 : rate + (speed - rate) * (1 - exp(-dt / 0.4))
        phase = (phase + rate * dt).truncatingRemainder(dividingBy: Self.period)
        // The bend follows the finger quickly and lets go more slowly, so a tap reads as a pulse. The last point is kept
        // while it lets go, so the bulge sinks where it was instead of jumping.
        if let touch { point = touch }
        let goal: Double = touch == nil ? 0 : 1
        pull += (goal - pull) * (1 - exp(-dt / (touch == nil ? 0.3 : 0.1)))
        return (Float(phase), Float(pull), point)
    }
}

// MARK: - Example

/// A composer like an agent's prompt bar: the send button wears the halo, lit while there is something to send.
private struct MetalHaloExample: View {
    @State private var draft = "Build a habit tracker"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            TextField("Build anything…", text: $draft)
                .font(.system(size: 17))
                .foregroundStyle(.white)
                .tint(.white)
            HStack(spacing: 10) {
                Image(systemName: "plus")
                    .font(.system(size: 17))
                    .foregroundStyle(.white.opacity(0.8))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color(white: 0.16)))
                    .accessibilityLabel("Add")
                Spacer()
                Button {
                    draft = ""
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 17))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(Color(white: 0.08)))
                        .metalHalo(.circle, isActive: !draft.isEmpty)
                }
                .buttonStyle(PieceLiquidPressStyle())
                .disabled(draft.isEmpty)
                .accessibilityLabel("Send")
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color(white: 0.11)))
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.06))
        .fontWeight(.semibold)
    }
}

#Preview("Dark") {
    MetalHaloExample().preferredColorScheme(.dark)
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
