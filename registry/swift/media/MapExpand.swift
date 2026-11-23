// swiftpieces:
// title: Map Expand
// description: "A place card whose little map grows into the real thing: tap it and the thumbnail opens out across the top of the screen, live and draggable, the pin drops into place with a bounce and the card settles under it with your actions, such as Directions. Back folds it into the card again. It uses MapKit, so the map is real at every size. For stores, bookings, events, deliveries and nearby lists."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [map, mapkit, location, place, pin, expand, directions]

import MapKit
import SwiftUI

/// Sizes and colors for `MapExpand`.
public struct MapExpandStyle: Sendable {
    /// The open map's height, as a fraction of the space it is shown in.
    public var mapHeight: CGFloat
    /// The thumbnail's side in the card.
    public var thumbnail: CGFloat
    /// How far the map is zoomed out, in meters across.
    public var span: CLLocationDistance
    /// The card's and the open map's corner radius.
    public var cornerRadius: CGFloat
    /// The card.
    public var card: Color
    /// The pin.
    public var pin: Color
    /// The title and the details line.
    public var label: Color
    public var secondary: Color

    public init(
        mapHeight: CGFloat = 0.58,
        thumbnail: CGFloat = 76,
        span: CLLocationDistance = 1200,
        cornerRadius: CGFloat = 24,
        card: Color = Color(UIColor.secondarySystemGroupedBackground),
        pin: Color = Color(red: 1, green: 0, blue: 0),
        label: Color = Color(UIColor.label),
        secondary: Color = Color(UIColor.secondaryLabel)
    ) {
        self.mapHeight = mapHeight
        self.thumbnail = thumbnail
        self.span = span
        self.cornerRadius = cornerRadius
        self.card = card
        self.pin = pin
        self.label = label
        self.secondary = secondary
    }

    public static let standard = MapExpandStyle()
}

/// A place card at the top of a page whose map thumbnail opens into a full map.
///
/// It fills the space it is given: the card sits at the top with your page under it, and the page fades while
/// the map is open.
///
/// - Parameters:
///   - coordinate: Where the place is.
///   - isExpanded: Whether the map is open. A tap on the card sets it; Back clears it.
///   - title: The place's name.
///   - subtitle: A details line, such as the distance and opening hours.
///   - style: Sizes and colors.
///   - actions: Shown on the card while the map is open, such as a Directions button.
///   - content: The page under the card.
public struct MapExpand<Actions: View, Content: View>: View {
    public typealias Style = MapExpandStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isExpanded: Bool
    @State private var position: MapCameraPosition
    @State private var drops = 0

    private let coordinate: CLLocationCoordinate2D
    private let title: String
    private let subtitle: String
    private let style: Style
    private let actions: Actions
    private let content: Content

    private let cardHeight: CGFloat = 100

    public init(
        coordinate: CLLocationCoordinate2D,
        isExpanded: Binding<Bool>,
        title: String,
        subtitle: String,
        style: Style = .standard,
        @ViewBuilder actions: () -> Actions,
        @ViewBuilder content: () -> Content
    ) {
        self.coordinate = coordinate
        self._isExpanded = isExpanded
        self.title = title
        self.subtitle = subtitle
        self.style = style
        self.actions = actions()
        self.content = content()
        self._position = State(initialValue: .camera(MapCamera(centerCoordinate: coordinate, distance: style.span)))
    }

    public var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let pad = (cardHeight - style.thumbnail) / 2
            let mapOpen = CGRect(x: 0, y: 0, width: size.width, height: size.height * style.mapHeight)
            let thumb = CGRect(x: pad, y: pad, width: style.thumbnail, height: style.thumbnail)
            let map = isExpanded ? mapOpen : thumb
            let card = isExpanded ? CGRect(x: 0, y: mapOpen.maxY + 12, width: size.width, height: cardHeight + 64) : CGRect(x: 0, y: 0, width: size.width, height: cardHeight)
            let text = isExpanded ? CGPoint(x: card.minX + 20, y: card.minY + 18) : CGPoint(x: thumb.maxX + 14, y: card.minY + 30)

            ZStack(alignment: .topLeading) {
                content
                    .frame(width: size.width, alignment: .topLeading)
                    .offset(y: cardHeight + 20)
                    .opacity(isExpanded ? 0 : 1)
                    .allowsHitTesting(!isExpanded)
                    .accessibilityHidden(isExpanded)

                RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
                    .fill(style.card)
                    .frame(width: card.width, height: card.height)
                    .offset(x: card.minX, y: card.minY)
                    .onTapGesture { if !isExpanded { setExpanded(true) } }

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(style.label)
                        .scaleEffect(isExpanded ? 1.22 : 1, anchor: .topLeading)
                        .padding(.bottom, isExpanded ? 5 : 0)
                    Text(subtitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.secondary)
                    actions
                        .padding(.top, 12)
                        .opacity(isExpanded ? 1 : 0)
                        .allowsHitTesting(isExpanded)
                        .accessibilityHidden(!isExpanded)
                }
                .lineLimit(1)
                .frame(width: size.width - (isExpanded ? 40 : thumb.maxX + 28), alignment: .leading)
                .offset(x: text.x, y: text.y - (isExpanded ? 0 : 12))
                .allowsHitTesting(isExpanded)

                Map(position: $position, interactionModes: isExpanded ? .all : []) {
                    Annotation(title, coordinate: coordinate, anchor: .bottom) {
                        MapExpandPin(color: style.pin)
                            .keyframeAnimator(initialValue: CGFloat(0), trigger: drops) { pin, lift in
                                pin.offset(y: -lift)
                            } keyframes: { _ in
                                LinearKeyframe(reduceMotion ? 0 : 34, duration: 0.01)
                                LinearKeyframe(reduceMotion ? 0 : 34, duration: 0.18)
                                SpringKeyframe(0, duration: 0.5, spring: .bouncy)
                            }
                    }
                    .annotationTitles(.hidden)
                }
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .mapControlVisibility(.hidden)
                .frame(width: map.width, height: map.height)
                .clipShape(.rect(cornerRadius: isExpanded ? style.cornerRadius : 14, style: .continuous))
                .offset(x: map.minX, y: map.minY)
                .allowsHitTesting(isExpanded)
                .accessibilityHidden(!isExpanded)

                if isExpanded {
                    PieceLiquidGroup {
                        Button {
                            setExpanded(false)
                        } label: {
                            Image(systemName: "chevron.backward")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(style.label)
                                .frame(width: 44, height: 44)
                                .pieceLiquid(Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Back")
                    }
                    .offset(x: 14, y: 14)
                    .transition(PieceMotion(reduceMotion: reduceMotion).transition(.opacity.combined(with: .scale(scale: 0.6))))
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: isExpanded ? "Close map" : "Open map") { setExpanded(!isExpanded) }
    }

    private func setExpanded(_ expanded: Bool) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        withAnimation(expanded ? motion.morph : motion.settle) {
            isExpanded = expanded
            position = .camera(MapCamera(centerCoordinate: coordinate, distance: style.span))
        }
        if expanded { drops += 1 }
    }
}

/// The place's pin: a teardrop with a white rim and a dot, and its shadow on the ground.
private struct MapExpandPin: View {
    let color: Color

    var body: some View {
        ZStack(alignment: .bottom) {
            Ellipse()
                .fill(.black.opacity(0.22))
                .frame(width: 14, height: 5)
                .offset(y: 2)
            MapExpandDrop()
                .fill(color)
                .overlay { MapExpandDrop().stroke(.white, lineWidth: 2) }
                .overlay(alignment: .top) {
                    Circle().fill(.white).frame(width: 9, height: 9).padding(.top, 7.5)
                }
                .frame(width: 26, height: 34)
        }
        .accessibilityHidden(true)
    }
}

private struct MapExpandDrop: Shape {
    func path(in rect: CGRect) -> Path {
        let r = rect.width / 2
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addCurve(to: CGPoint(x: rect.minX, y: rect.minY + r), control1: CGPoint(x: rect.midX - r * 0.35, y: rect.maxY - rect.height * 0.25), control2: CGPoint(x: rect.minX, y: rect.minY + r * 1.7))
        path.addArc(center: CGPoint(x: rect.midX, y: rect.minY + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        path.addCurve(to: CGPoint(x: rect.midX, y: rect.maxY), control1: CGPoint(x: rect.maxX, y: rect.minY + r * 1.7), control2: CGPoint(x: rect.midX + r * 0.35, y: rect.maxY - rect.height * 0.25))
        path.closeSubpath()
        return path
    }
}

// MARK: - Example

/// A booking with the hotel's card on top. Tap it to open the map; Back folds it away.
private struct MapExpandExample: View {
    @State private var isExpanded = false
    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let red = Color(red: 1, green: 0, blue: 0)

    var body: some View {
        MapExpand(coordinate: CLLocationCoordinate2D(latitude: 47.6062, longitude: -122.3421), isExpanded: $isExpanded, title: "Harbor Inn", subtitle: "0.4 mi · Open until 22:00") {
            HStack(spacing: 10) {
                Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(ink)
                    .padding(.horizontal, 16)
                    .frame(height: 42)
                    .background(red, in: .rect(cornerRadius: 18, style: .continuous))
                Label("Call", systemImage: "phone.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16)
                    .frame(height: 42)
                    .background(Color(UIColor.tertiarySystemFill), in: .rect(cornerRadius: 18, style: .continuous))
            }
        } content: {
            VStack(alignment: .leading, spacing: 10) {
                Text("Your stay").font(.title3.weight(.semibold))
                ForEach([("Check-in", "Sat, 15:00"), ("Check-out", "Mon, 11:00"), ("Room", "Lake view, 2 guests")], id: \.0) { name, value in
                    HStack {
                        Text(name).foregroundStyle(.secondary)
                        Spacer()
                        Text(value)
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.vertical, 6)
                }
            }
            .padding(.horizontal, 4)
        }
        .padding(16)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

#Preview("Light") {
    MapExpandExample()
}

#Preview("Dark") {
    MapExpandExample()
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
