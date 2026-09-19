// swiftpieces:
// title: Glass Surface
// description: "The Glass family foundation: Liquid Glass in a capsule, rect, circle or concentric shape on iOS 26, with a layered Material fallback that keeps the press response, solid tint, specular edge and a designed disabled state everywhere else."
// category: glass
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: glass-sheet
// tags: [glass, surface, fallback, foundation, toolbar]

import SwiftUI

/// Liquid Glass on iOS 26, a layered Material surface everywhere else, with the same press feel on both.
///
/// - Parameters:
///   - shape: `.capsule`, `.rect(cornerRadius:)`, `.circle` or `.concentric(minimum:)` (iOS 26 concentric corners, continuous corners earlier).
///   - tint: Optional tint. Glass tints natively; the fallback lays it over the Material at `style.tintAmount`, so it reads as a color block.
///   - interactive: Press response: system glass on iOS 26; on the fallback the surface scales to `style.pressedScale`, brightens and plays a light impact.
///   - style: Fallback tint strength, specular edge, depth shadow, press scale, disabled opacity and the Reduce Transparency fill.
public extension View {
    func glassSurface(_ shape: GlassSurface.SurfaceShape = .capsule, tint: Color? = nil, interactive: Bool = false, style: GlassSurface.Style = .standard) -> some View {
        modifier(GlassSurface(shape: shape, tint: tint, interactive: interactive, style: style))
    }
}

/// The modifier behind `.glassSurface(...)`. `GlassSurface.Group` merges several surfaces on iOS 26.
public struct GlassSurface: ViewModifier {
    public enum SurfaceShape {
        case capsule
        case circle
        case rect(cornerRadius: CGFloat)
        /// Corners that nest inside the enclosing `containerShape` on iOS 26; `minimum` is the fallback radius.
        case concentric(minimum: CGFloat)
    }

    /// Visual tuning for the fallback and the shared depth. `standard` is tuned to float over solid color.
    public struct Style: Sendable {
        /// How much of `tint` the fallback takes on, 0...1. Higher reads as a solid color block.
        public var tintAmount: Double
        /// Strength (0...1) of the fallback's top light and specular edge.
        public var specular: Double
        /// Opacity of the soft two-layer shadow that floats the surface.
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

    /// Wraps sibling surfaces so their glass blends and morphs on iOS 26. A plain container earlier.
    public struct Group<Content: View>: View {
        private let spacing: CGFloat
        private let content: Content

        public init(spacing: CGFloat = 16, @ViewBuilder content: () -> Content) {
            self.spacing = spacing
            self.content = content()
        }

        public var body: some View {
            if #available(iOS 26, *) {
                GlassEffectContainer(spacing: spacing) { content }
            } else {
                content
            }
        }
    }

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @State private var pressed = false

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
        SwiftUI.Group {
            switch shape {
            case .capsule: surface(content, in: Capsule())
            case .circle: surface(content, in: Circle())
            case .rect(let radius): surface(content, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            case .concentric(let minimum):
                if #available(iOS 26, *) {
                    surface(content, in: ConcentricRectangle(corners: .concentric(minimum: .fixed(minimum))))
                } else {
                    surface(content, in: RoundedRectangle(cornerRadius: minimum, style: .continuous))
                }
            }
        }
        // Disabled: faded and desaturated, and the press response goes quiet.
        .opacity(isEnabled ? 1 : style.disabledOpacity)
        .saturation(isEnabled ? 1 : 0.2)
        .animation(.smooth(duration: 0.25), value: isEnabled)
        .simultaneousGesture(pressTracker, including: interactive && isEnabled ? .all : .subviews)
        .sensoryFeedback(.impact(weight: .light), trigger: pressed) { _, new in new }
    }

    @ViewBuilder private func surface(_ content: Content, in shape: some Shape) -> some View {
        if #available(iOS 26, *), !reduceTransparency {
            content
                .glassEffect(glass, in: shape)
                .shadow(color: .black.opacity(style.shadow * 0.6), radius: 16, y: 8)
        } else {
            let lifted = pressed && interactive && isEnabled
            content
                .background {
                    ZStack {
                        if reduceTransparency {
                            shape.fill(style.solidFill ?? Color(.secondarySystemBackground))
                            if let tint { shape.fill(tint) }
                        } else {
                            shape.fill(.regularMaterial)
                            if let tint { shape.fill(tint.opacity(style.tintAmount)) }
                            // A light falling from the top gives the Material a body instead of a flat grey.
                            shape.fill(LinearGradient(colors: [.white.opacity(0.22 * style.specular), .white.opacity(0)], startPoint: .top, endPoint: .center))
                        }
                        // Brighten on press so the fallback has a response even without glass.
                        shape.fill(.white.opacity(lifted ? 0.18 : 0))
                    }
                    .shadow(color: .black.opacity(reduceTransparency ? 0 : style.shadow), radius: 3, y: 1)
                    .shadow(color: .black.opacity(reduceTransparency ? 0 : style.shadow), radius: 18, y: 10)
                }
                .overlay {
                    if !reduceTransparency {
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
                .scaleEffect(lifted && !reduceMotion ? style.pressedScale : 1)
                .animation(lifted ? .spring(duration: 0.16, bounce: 0) : .spring(duration: 0.4, bounce: 0.35), value: lifted)
        }
    }

    /// Fires alongside any Button inside, so the surface can respond without owning the tap.
    private var pressTracker: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { _ in if !pressed { pressed = true } }
            .onEnded { _ in pressed = false }
    }

    @available(iOS 26, *)
    private var glass: Glass {
        var g: Glass = .regular
        if let tint { g = g.tint(tint) }
        return interactive ? g.interactive() : g
    }
}

// MARK: - Example

/// The component alone: three surfaces floating on full-bleed color blocks, so the glass has
/// something to refract. A circle, a tinted capsule and a circle, each interactive.
private struct GlassSurfaceExample: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
        TimelineView(.animation(paused: reduceMotion)) { context in
            GlassSurface.Group(spacing: 8) {
                HStack(spacing: 12) {
                    Button {} label: {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Previous")
                    Button {} label: {
                        Image(systemName: "play.fill")
                            .font(.title.weight(.semibold))
                            .frame(width: 190, height: 76)
                    }
                    .glassSurface(.capsule, tint: Color(red: 1, green: 0, blue: 0), interactive: true)
                    .accessibilityLabel("Play")
                    Button {} label: {
                        Image(systemName: "chevron.right")
                            .font(.title3.weight(.semibold))
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Next")
                }
                .buttonStyle(.plain)
                .foregroundStyle(ink)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { GlassSurfaceCover(t: context.date.timeIntervalSinceReferenceDate).clipped() }
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
