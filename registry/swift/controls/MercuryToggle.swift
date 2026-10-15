// swiftpieces:
// title: Mercury Toggle
// description: A switch whose thumb is a bead of mercury in a liquid glass track, drawn by a Metal color shader. Two drops melt into one through a smooth minimum, so a flip stretches the bead into a slug that pulls itself round at the far end and rings for a moment; dragging it drags the liquid after your finger. The track fills with the brand red when on.
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-15"
// tags: [toggle, switch, shader, metal, mercury, liquid, glass, drag]
// shaders: [MercuryToggle.metal]

import SwiftUI

/// An on and off switch with a mercury bead for a thumb. Copy `MercuryToggle.metal` alongside this file; its `mercuryToggle` kernel compiles into your app's default Metal library.
///
/// Tap the switch to flip it, or drag the bead: it follows your finger and lands on the side you let go nearer, or the
/// side you flicked toward. VoiceOver, Switch Control and keyboard focus see a standard toggle.
///
/// - Parameters:
///   - title: The setting's name. Shown beside the switch unless `showsTitle` is false, and always read by VoiceOver.
///   - isOn: The binding the switch flips.
///   - tint: The track's fill when on. The brand red, `#FF0000`, by default.
///   - showsTitle: Shows the title to the leading side, the way `Toggle` lays out in a row.
public struct MercuryToggle: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @State private var bead = BeadPhysics()
    /// The finger's x in the track while the bead is dragged, `nil` otherwise.
    @State private var dragX: CGFloat?
    /// When the bead was last let go or flipped. The timeline runs until it has settled, then pauses.
    @State private var kickedAt: Date?

    private let title: String
    @Binding private var isOn: Bool
    private let tint: Color
    private let showsTitle: Bool

    /// The track, and the bead's resting radius and inset in it.
    private let size = CGSize(width: 64, height: 36)
    private let radius: CGFloat = 13
    private let inset: CGFloat = 5

    public init(_ title: String, isOn: Binding<Bool>, tint: Color = Color(red: 1, green: 0, blue: 0), showsTitle: Bool = true) {
        self.title = title
        _isOn = isOn
        self.tint = tint
        self.showsTitle = showsTitle
    }

    public var body: some View {
        HStack(spacing: 12) {
            if showsTitle {
                Text(title)
                    .fontWeight(.semibold)
                Spacer(minLength: 0)
            }
            track
        }
        .fontWeight(.semibold)
        .accessibilityRepresentation {
            Toggle(title, isOn: $isOn)
        }
    }

    private var track: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let off = inset + radius, on = size.width - inset - radius
        return PieceLiquidGroup {
            Capsule()
                .fill(.clear)
                .frame(width: size.width, height: size.height)
                .pieceLiquid(Capsule(), tint: isOn ? tint.opacity(0.9) : nil)
                .animation(motion.snap, value: isOn)
        }
        .overlay {
            // Runs while the bead is dragged and until it settles after a kick; a resting switch draws once.
            TimelineView(.animation(minimumInterval: 1.0 / 60, paused: dragX == nil && kickedAt == nil)) { context in
                let frame = bead.advance(to: context.date, target: isOn ? on : off, finger: dragX.map { min(max($0, off), on) }, still: reduceMotion)
                // One type for both halves of a float2: the bead positions are Float.
                let y = Float(size.height / 2), r = radius
                Rectangle()
                    .colorEffect(
                        ShaderLibrary.mercuryToggle(
                            .float2(frame.lead, y),
                            .float2(frame.trail, y),
                            .float(r),
                            .float(frame.time),
                            .float(frame.wobble),
                            .color(isEnabled ? Color(red: 0.94, green: 0.96, blue: 1) : Color(white: 0.6))
                        )
                    )
            }
            .allowsHitTesting(false)
        }
        .contentShape(Capsule())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    // A drag starts once the finger moves; until then it may still be a tap.
                    if dragX != nil || abs(value.translation.width) > 4 { dragX = value.location.x }
                }
                .onEnded { value in
                    if dragX == nil {
                        flip(!isOn)
                    } else {
                        // Land where the flick was heading, so a short throw still crosses.
                        let landing = value.predictedEndLocation.x
                        dragX = nil
                        flip(landing > size.width / 2)
                    }
                }
        )
        .sensoryFeedback(.impact(flexibility: .soft), trigger: isOn)
        .opacity(isEnabled ? 1 : 0.5)
        .onAppear { bead.place(at: isOn ? on : off) }
        .onChange(of: isOn) { kickedAt = .now }
        .task(id: kickedAt) {
            guard let kick = kickedAt else { return }
            // The loose spring's tail is under a tenth of a point after 1.6 s.
            do { try await Task.sleep(for: .seconds(1.6)) } catch { return }
            if kickedAt == kick { kickedAt = nil }
        }
    }

    private func flip(_ value: Bool) {
        kickedAt = .now
        if value != isOn { isOn = value }
    }
}

/// The bead's two drops, each on its own spring: the lead goes to the target (or the finger) stiffly, the trail follows
/// the lead loosely, and the gap between them is the stretch. Not observed, so a frame never invalidates the view.
@MainActor private final class BeadPhysics {
    private var lead = 0.0, leadV = 0.0
    private var trail = 0.0, trailV = 0.0
    private var wobble = 0.0, ring = 0.0
    private var placed = false
    private var last: Date?

    nonisolated init() {}

    /// Puts the bead at rest at `x`, without motion, the first time the switch appears.
    func place(at x: CGFloat) {
        guard !placed else { return }
        placed = true
        lead = Double(x)
        trail = Double(x)
    }

    func advance(to date: Date, target: CGFloat, finger: CGFloat?, still: Bool) -> (lead: Float, trail: Float, wobble: Float, time: Float) {
        if !placed { place(at: target) }
        let dt = last.map { min(max(date.timeIntervalSince($0), 0), 0.1) } ?? 0
        if last.map({ date > $0 }) ?? true { last = date }
        let goal = Double(finger ?? target)
        // Fixed 1/240 s steps, so the springs stay stable whatever the frame rate.
        var left = dt
        while left > 0 {
            let h = min(left, 1.0 / 240)
            left -= h
            if finger != nil {
                // The finger carries the lead directly; never animate finger tracking.
                let before = lead
                lead = goal
                leadV = (lead - before) / h
            } else if still {
                // Reduce Motion: no overshoot and no stretch, a quick firm slide.
                leadV = (goal - lead) * 18
                lead += leadV * h
            } else {
                // Stiff and a little bouncy: the drop arrives first.
                leadV += (-(lead - goal) * 900 - leadV * 42) * h
                lead += leadV * h
            }
            if still {
                trail = lead
                trailV = leadV
            } else {
                // Loose: the tail of the liquid catches up, overshoots a touch and pulls the bead round.
                trailV += (-(trail - lead) * 260 - trailV * 22) * h
                trail += trailV * h
            }
            // The surface rings in proportion to how hard the tail lands, and dies away.
            let impact = min(abs(trailV) / 900, 1)
            if !still && impact > wobble { wobble = impact; ring = 0 }
            wobble *= exp(-h / 0.25)
            ring += h
        }
        return (Float(lead), Float(trail), Float(wobble), Float(ring.truncatingRemainder(dividingBy: 2 * .pi)))
    }
}

// MARK: - Example

/// Settings rows on a dark ground, one of them off and one disabled.
private struct MercuryToggleExample: View {
    @State private var live = true
    @State private var voice = false

    var body: some View {
        VStack(spacing: 22) {
            MercuryToggle("Live mode", isOn: $live)
            MercuryToggle("Voice replies", isOn: $voice)
            MercuryToggle("Offline sync", isOn: .constant(false))
                .disabled(true)
        }
        .font(.system(size: 17))
        .foregroundStyle(.white)
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.07))
        .fontWeight(.semibold)
    }
}

#Preview("Dark") {
    MercuryToggleExample().preferredColorScheme(.dark)
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
// swiftpieces-liquid: 1.7.1 (liquid)

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
