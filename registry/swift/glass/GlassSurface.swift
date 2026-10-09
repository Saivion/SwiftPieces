// swiftpieces:
// title: Glass Surface
// description: "The public face of the SwiftPieces liquid glass: `.glassSurface` draws any view on a liquid glass capsule, rect, circle or concentric shape, and `GlassSurface.Group` melts neighbouring surfaces into one through a liquid neck. Liquid Glass on iOS 26; before it a frosted surface with its own press, top light and specular edge; a solid fill under Reduce Transparency, and a designed disabled state everywhere."
// category: glass
// minIOSVersion: "17.0"
// version: "2.2.0"
// pro: glass-sheet
// tags: [glass, surface, fallback, foundation, toolbar]

import SwiftUI

/// The SwiftPieces liquid glass, for your own views: Liquid Glass on iOS 26, a layered frosted surface everywhere else,
/// with the same press feel on both.
///
/// `.glassSurface` draws the same glass every SwiftPieces piece is made of, and `GlassSurface.Group` is the same liquid
/// group: surfaces inside one that come within its `spacing` of each other melt into one shape through a neck. Rest
/// the parts of one control 6pt apart, so the neck holds, and separate actions 26pt apart, so each is its own bubble.
/// Text and symbols on a surface take the house weight, semibold.
///
/// - Parameters:
///   - shape: `.capsule`, `.rect(cornerRadius:)`, `.circle` or `.concentric(minimum:)` (iOS 26 concentric corners, continuous corners earlier).
///   - tint: Optional glass tint. Glass tints natively; the fallback lays it over its frosted fill at `style.tintAmount`, so it reads as a color block. Tint only to say something: signal for the primary action, sage for success, butter for a warning.
///   - interactive: Press response: interactive glass on iOS 26, which swells under the finger; on the fallback the surface sinks to `style.pressedScale` into a closer shadow, light pools under the finger, and a light impact plays as a tap lifts on the surface.
///   - style: Fallback tint strength, specular edge, lift shadow, press scale, disabled opacity and the Reduce Transparency fill.
public extension View {
    func glassSurface(_ shape: GlassSurface.SurfaceShape = .capsule, tint: Color? = nil, interactive: Bool = false, style: GlassSurface.Style = .standard) -> some View {
        modifier(GlassSurface(shape: shape, tint: tint, interactive: interactive, style: style))
    }
}

/// The modifier behind `.glassSurface(...)`. `GlassSurface.Group` melts several surfaces into one.
public struct GlassSurface: ViewModifier {
    public enum SurfaceShape {
        case capsule
        case circle
        case rect(cornerRadius: CGFloat)
        /// Corners that nest inside the enclosing `containerShape` on iOS 26; `minimum` is the fallback radius.
        case concentric(minimum: CGFloat)
    }

    /// Visual tuning for the fallback and the shared lift. `standard` is tuned to float over solid color.
    public struct Style: Sendable {
        /// How much of `tint` the fallback takes on, 0...1. Higher reads as a solid color block.
        public var tintAmount: Double
        /// Strength (0...1) of the fallback's top light and specular edge.
        public var specular: Double
        /// Strength of the shadow the surface floats on: the wide, faint light-mode lift on iOS 26 (a group lifts its
        /// surfaces as one instead), and the fallback's far shadow, which draws in under a press.
        public var shadow: Double
        /// Scale while pressed on the fallback.
        public var pressedScale: CGFloat
        /// Opacity of the surface while disabled with `.disabled(true)`.
        public var disabledOpacity: Double
        /// Opaque fill under Reduce Transparency. `nil` uses the secondary system background.
        public var solidFill: Color?

        public init(
            tintAmount: Double = 0.72,
            specular: Double = 0.8,
            shadow: Double = 0.12,
            pressedScale: CGFloat = 0.96,
            disabledOpacity: Double = 0.45,
            solidFill: Color? = nil
        ) {
            self.tintAmount = tintAmount
            self.specular = specular
            self.shadow = shadow
            self.pressedScale = pressedScale
            self.disabledOpacity = disabledOpacity
            self.solidFill = solidFill
        }

        public static let standard = Style()
    }

    /// A liquid group: surfaces inside it within `spacing` of each other melt into one through a neck, and the group
    /// floats on one light-mode lift. A plain container before iOS 26 and under Reduce Transparency.
    public struct Group<Content: View>: View {
        private let spacing: CGFloat
        private let content: Content

        public init(spacing: CGFloat = 16, @ViewBuilder content: () -> Content) {
            self.spacing = spacing
            self.content = content()
        }

        public var body: some View {
            PieceLiquidGroup(spacing: spacing) {
                // The group lifts its surfaces as one, so each skips its own lift.
                content.environment(\.glassSurfaceGrouped, true)
            }
        }
    }

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.glassSurfaceGrouped) private var grouped
    /// The finger while it is down, in the surface's space. A gesture state, so a touch the system cancels (a scroll
    /// took over) lets the surface go instead of leaving it pressed.
    @GestureState private var finger: CGPoint? = nil
    @State private var size: CGSize = .zero
    /// Where the press light pools. It stays put after lift-off, so the light fades where the finger was.
    @State private var pool: UnitPoint = .center
    /// Presses that lifted on the surface, for the fallback's haptic.
    @State private var presses = 0

    private let shape: SurfaceShape
    private let tint: Color?
    private let interactive: Bool
    private let style: Style

    public init(shape: SurfaceShape, tint: Color? = nil, interactive: Bool = false, style: Style = .standard) {
        self.shape = shape
        self.tint = tint
        self.interactive = interactive
        self.style = style
    }

    public func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        SwiftUI.Group {
            switch shape {
            case .capsule: surface(content, in: Capsule())
            case .circle: surface(content, in: Circle())
            case .rect(let radius): surface(content, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            case .concentric(let minimum):
                #if compiler(>=6.2)
                if #available(iOS 26, *) {
                    surface(content, in: ConcentricRectangle(corners: .concentric(minimum: .fixed(minimum))))
                } else {
                    surface(content, in: RoundedRectangle(cornerRadius: minimum, style: .continuous))
                }
                #else
                surface(content, in: RoundedRectangle(cornerRadius: minimum, style: .continuous))
                #endif
            }
        }
        // Disabled: faded and desaturated, and the press response goes quiet.
        .opacity(isEnabled ? 1 : style.disabledOpacity)
        .saturation(isEnabled ? 1 : 0.2)
        .animation(motion.morph, value: isEnabled)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        // Interactive glass owns the press on iOS 26, so the tracker (and its haptic) runs only for the fallback.
        .simultaneousGesture(pressTracker, including: interactive && isEnabled && !usesGlass ? .all : .subviews)
        .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light), trigger: presses)
    }

    /// Real Liquid Glass: built with the iOS 26 SDK, running on iOS 26, without Reduce Transparency. The liquid
    /// foundation draws glass under exactly these conditions and its frosted fallback otherwise.
    private var usesGlass: Bool {
        #if compiler(>=6.2)
        if #available(iOS 26, *) { return !reduceTransparency }
        #endif
        return false
    }

    /// The tint handed to the liquid foundation. Its fallback lays a tint at 0.88 over the frosted fill, so the tint is
    /// thinned here to land at `tintAmount`. Glass and the Reduce Transparency fill take it whole.
    private var liquidTint: Color? {
        guard let tint else { return nil }
        return usesGlass || reduceTransparency ? tint : tint.opacity(min(max(style.tintAmount, 0) / 0.88, 1))
    }

    /// The glass itself comes from the liquid foundation (`.pieceLiquid`), the same glass every piece is made of. Around
    /// it: the fallback's own press, top light and specular edge, the Reduce Transparency fill, and the lift.
    private func surface(_ content: Content, in shape: some Shape) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let fallback = !usesGlass && !reduceTransparency
        let lifted = isPressed && interactive && isEnabled && !usesGlass
        // On glass, a wide, faint lift in light mode only, as a liquid group floats; a group lifts its surfaces itself.
        // On the fallback, the far shadow that draws in close under a press.
        let lift: Double = reduceTransparency ? 0 : usesGlass ? (grouped || colorScheme == .dark ? 0 : style.shadow * 0.6) : style.shadow * (lifted ? 0.5 : 1)
        return content
            .fontWeight(.semibold)
            .background {
                if reduceTransparency {
                    // Over the foundation's own solid fill: the surface's `solidFill`, then the tint, both opaque.
                    ZStack {
                        shape.fill(style.solidFill ?? Color(.secondarySystemBackground))
                        if let tint { shape.fill(tint) }
                    }
                } else if fallback {
                    ZStack {
                        // A light falling from the top gives the frosted fill a body instead of a flat grey.
                        shape.fill(LinearGradient(colors: [.white.opacity(0.22 * style.specular), .white.opacity(0)], startPoint: .top, endPoint: .center))
                        // Light pools under the finger, so the fallback answers the press even without glass. It follows
                        // the finger directly; only its arrival and fade ride the press and release springs.
                        shape.fill(RadialGradient(colors: [.white.opacity(0.3), .white.opacity(0.1)], center: pool, startRadius: 0, endRadius: poolRadius))
                            .animation(nil, value: pool)
                            .opacity(lifted ? 1 : 0)
                    }
                }
            }
            .overlay {
                if fallback {
                    // Specular edge: a bright top highlight fading down, plus a faint primary edge so it reads on light grounds.
                    // Stroked at 2pt and clipped so exactly 1pt sits inside the edge (works for non-insettable shapes).
                    shape.stroke(
                        LinearGradient(colors: [.white.opacity(0.7 * style.specular), .white.opacity(0.05)], startPoint: .top, endPoint: .bottom),
                        lineWidth: 2
                    )
                    .blendMode(.plusLighter)
                    .clipShape(shape)
                    shape.stroke(.primary.opacity(0.08), lineWidth: 2).clipShape(shape)
                }
            }
            .pieceLiquid(shape, tint: liquidTint, interactive: interactive)
            .shadow(color: .black.opacity(lift), radius: usesGlass ? 18 : lifted ? 8 : 18, y: usesGlass ? 8 : lifted ? 4 : 10)
            // The fallback sinks level, from the center: a rigid pane, so it never tips toward the finger. Through the
            // liquid scale, like every press on glass, so the content sinks with the surface.
            .pieceLiquidScale(lifted && !reduceMotion ? style.pressedScale : 1)
            // In tight with no overshoot, back up with a little give. A finger sliding off lets go without it.
            .animation(lifted ? motion.press : finger == nil ? motion.release : motion.dismiss, value: lifted)
    }

    /// Fires alongside any Button inside, so the surface can respond without owning the tap. The finger is tracked
    /// directly, never through an animation.
    private var pressTracker: some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($finger) { value, state, _ in state = value.location }
            .onChanged { value in
                if reaches(value.location) { pool = unitPoint(value.location) }
            }
            .onEnded { value in
                // The impact lands as a tap lifts on the surface. On touch-down it would also play for every touch that
                // turns into a scroll (a scroll cancels this gesture, so never here). A touch that travelled past 44pt
                // was a drag, a scrub or a slide off a button, not a tap, so it lifts silently.
                let tapped = hypot(value.translation.width, value.translation.height) <= 44
                if tapped, reaches(value.location) { presses += 1 }
            }
    }

    /// Pressed while the finger is on the surface or within a fingertip of its edge, as a button keeps its press.
    private var isPressed: Bool {
        guard let finger else { return false }
        return reaches(finger)
    }

    private func reaches(_ point: CGPoint) -> Bool {
        CGRect(origin: .zero, size: size).insetBy(dx: -44, dy: -44).contains(point)
    }

    /// The touch as a point in the surface's unit square, held to the edge when the finger strays just past it.
    private func unitPoint(_ point: CGPoint) -> UnitPoint {
        guard size.width > 0, size.height > 0 else { return .center }
        return UnitPoint(x: min(max(point.x / size.width, 0), 1), y: min(max(point.y / size.height, 0), 1))
    }

    /// A pool about the size of the surface's short side, wider on long ones, so it reads as a pool, not a spot.
    private var poolRadius: CGFloat {
        max(min(size.width, size.height), max(size.width, size.height) * 0.5, 44)
    }
}

/// Set by `GlassSurface.Group` on its content, so surfaces inside leave the lift to the group.
private struct GlassSurfaceGroupedKey: EnvironmentKey {
    static let defaultValue = false
}

fileprivate extension EnvironmentValues {
    var glassSurfaceGrouped: Bool {
        get { self[GlassSurfaceGroupedKey.self] }
        set { self[GlassSurfaceGroupedKey.self] = newValue }
    }
}

// MARK: - Example

/// The component alone: three surfaces in one group, floating on full-bleed color blocks so the glass has something
/// to refract. Previous and next rest joined to the play capsule, so liquid necks hold the three together as one
/// control; the capsule is signal-tinted glass with the house ink. Each is interactive.
private struct GlassSurfaceExample: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
        // Under Reduce Motion the cover rests in its centered pose instead of freezing mid-drift.
        let drifting = PieceMotion(reduceMotion: reduceMotion).allowsAmbient
        TimelineView(.animation(paused: !drifting)) { context in
            GlassSurface.Group(spacing: PieceLiquid.merge) {
                HStack(spacing: PieceLiquid.joined) {
                    Button {} label: {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.primary)
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Previous")
                    Button {} label: {
                        Image(systemName: "play.fill")
                            .font(.title.weight(.semibold))
                            .foregroundStyle(ink)
                            .frame(width: 190, height: 76)
                    }
                    .glassSurface(.capsule, tint: Color(red: 1, green: 0, blue: 0), interactive: true)
                    .accessibilityLabel("Play")
                    Button {} label: {
                        Image(systemName: "chevron.right")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.primary)
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Next")
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { GlassSurfaceCover(t: drifting ? context.date.timeIntervalSinceReferenceDate : 0).clipped() }
        }
    }
}

/// Plain shapes that drift under the glass: a lilac field, a butter disc, a sage slab and a sky bar.
private struct GlassSurfaceCover: View {
    let t: TimeInterval

    var body: some View {
        let drift = CGFloat(sin(t * 0.45))
        ZStack {
            Color(red: 0.804, green: 0.722, blue: 1).ignoresSafeArea()
            Circle()
                .fill(Color(red: 1, green: 0.851, blue: 0.463))
                .frame(width: 230)
                .offset(x: 96 + drift * 34, y: -74 + CGFloat(cos(t * 0.3)) * 16)
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(Color(red: 0.663, green: 0.863, blue: 0.718))
                .frame(width: 250, height: 170)
                .rotationEffect(.degrees(-8))
                .offset(x: -94 - drift * 26, y: 104)
            Capsule()
                .fill(Color(red: 0.612, green: 0.761, blue: 1))
                .frame(width: 300, height: 50)
                .offset(x: 46 - drift * 44, y: 78)
        }
    }
}

#Preview("Light") {
    GlassSurfaceExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    GlassSurfaceExample()
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
