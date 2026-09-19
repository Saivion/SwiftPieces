// swiftpieces:
// title: Flip Card
// description: A two-sided card you flip by tap or by dragging sideways. The drag scrubs the rotation, release commits or snaps back by velocity, the card lifts toward you mid-turn with a layered shadow that slides off the raised edge, and each face shades as it turns edge-on.
// category: cards
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: payment-card
// tags: [card, flip, drag, 3d, spring, flashcard]

import SwiftUI

/// Two-sided card with tap-to-flip and drag-to-flip.
///
/// - Parameters:
///   - isFlipped: Optional binding to drive the flip externally. Leave nil to let the card manage its own state; taps and drags still update the binding when one is passed.
///   - style: Depth, lift, press, and shading tuning. `.standard` uses the house values; the faces bring their own color.
///   - onFlip: Called after a flip commits, with `true` when the back is now showing.
///   - front: Front face. Give it its own shape and surface; the card only rotates, lifts, shades, and shadows it.
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

        public init(cornerRadius: CGFloat = 26, shadow: Color = .black, shadowOpacity: Double = 0.14, lift: CGFloat = 0.06, pressScale: CGFloat = 0.97, pressTilt: Double = 6, shading: Double = 0.16) {
            self.cornerRadius = cornerRadius
            self.shadow = shadow
            self.shadowOpacity = shadowOpacity
            self.lift = lift
            self.pressScale = pressScale
            self.pressTilt = pressTilt
            self.shading = shading
        }

        /// House defaults: 26 pt corners, a 6% lift mid-turn, a 0.97 press.
        public static var standard: Style { Style() }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @State private var angle: Double = 0
    @State private var dragBase: Double?
    @State private var press: CGPoint?
    @State private var size = CGSize(width: 1, height: 1)
    @State private var pressTick = 0

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

    private var isFlipped: Bool { Int((angle / 180).rounded()).magnitude % 2 == 1 }
    private var showsBack: Bool { Self.showsBack(at: angle) }
    private var isPressed: Bool { press != nil && dragBase == nil }
    private var isDragging: Bool { dragBase != nil }

    nonisolated fileprivate static func showsBack(at angle: Double) -> Bool {
        let a = (angle.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        return a > 90 && a < 270
    }

    public var body: some View {
        // Touch-down tilts the card slightly toward the finger before any drag begins.
        let tiltX = press.map { -(($0.y / size.height) - 0.5) * style.pressTilt } ?? 0
        let tiltY = press.map { (($0.x / size.width) - 0.5) * style.pressTilt } ?? 0

        ZStack {
            front.modifier(Face(angle: angle, isBack: false, crossfade: reduceMotion, shading: style.shading, radius: style.cornerRadius))
            back.modifier(Face(angle: angle, isBack: true, crossfade: reduceMotion, shading: style.shading, radius: style.cornerRadius))
        }
        .modifier(Depth(angle: angle, style: style, raised: isDragging, flat: reduceMotion))
        .scaleEffect(isPressed && !reduceMotion ? style.pressScale : 1)
        .rotation3DEffect(.degrees(reduceMotion ? 0 : tiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.5)
        .rotation3DEffect(.degrees(reduceMotion ? 0 : tiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
        .opacity(isEnabled ? 1 : 0.5)
        .contentShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
        .gesture(drag, isEnabled: isEnabled)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .animation(.spring(duration: 0.3, bounce: 0.2), value: isPressed)
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: pressTick)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: showsBack)
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
            .onChanged { drag in
                if press == nil && dragBase == nil {
                    press = drag.startLocation
                    pressTick += 1
                }
                if dragBase == nil, abs(drag.translation.width) > 8 {
                    dragBase = angle
                    press = nil
                }
                if let dragBase {
                    let delta = Double(drag.translation.width / size.width) * 180
                    // Past a full half turn the scrub rubber-bands instead of stopping dead.
                    let limited = abs(delta) <= 180 ? delta : (delta > 0 ? 1 : -1) * (180 + (abs(delta) - 180) * 0.25)
                    angle = dragBase + min(max(limited, -210), 210)
                }
            }
            .onEnded { drag in
                if let base = dragBase {
                    // Commit when the projected end passes 90° in either direction, otherwise snap back.
                    let projected = Double(drag.predictedEndTranslation.width / size.width) * 180
                    let target = abs(projected) >= 90 ? base + (projected > 0 ? 180 : -180) : base
                    let committed = target != base
                    dragBase = nil
                    withAnimation(settle) { angle = target }
                    sync()
                    if committed { onFlip?(isFlipped) }
                } else if press != nil {
                    flip()
                }
                press = nil
            }
    }

    private var settle: Animation { reduceMotion ? .easeInOut(duration: 0.3) : .spring(duration: 0.55, bounce: 0.22) }

    private func flip() {
        withAnimation(reduceMotion ? .easeInOut(duration: 0.3) : .spring(duration: 0.7, bounce: 0.22)) { angle += 180 }
        sync()
        onFlip?(isFlipped)
    }

    private func sync() {
        if let external, external.wrappedValue != isFlipped { external.wrappedValue = isFlipped }
    }

    /// Lift and shadow that follow the animated angle: the card rises mid-turn, a tight contact shadow shrinks, and a soft key shadow slides away from the raised edge.
    private struct Depth: ViewModifier, Animatable {
        var angle: Double
        let style: Style
        let raised: Bool
        let flat: Bool
        @Environment(\.colorScheme) private var colorScheme

        nonisolated var animatableData: Double {
            get { angle }
            set { angle = newValue }
        }

        func body(content: Content) -> some View {
            let strength = min(style.shadowOpacity * (colorScheme == .dark ? 3 : 1), 1)
            let edge = flat ? 0 : sin(angle * .pi / 180)
            let turn = abs(edge)
            let up = max(turn, raised ? 0.35 : 0)
            content
                .scaleEffect(1 + style.lift * turn)
                .shadow(color: style.shadow.opacity(strength * (1 - up * 0.6)), radius: 2, y: 1)
                .shadow(color: style.shadow.opacity(strength), radius: 16 + up * 18, x: -edge * 18, y: 12 + up * 10)
        }
    }

    /// Rotates one face, darkens it as it turns edge-on, and hides it past 90° so each face is only seen from its own side.
    private struct Face: ViewModifier, Animatable {
        var angle: Double
        let isBack: Bool
        let crossfade: Bool
        let shading: Double
        let radius: CGFloat

        nonisolated var animatableData: Double {
            get { angle }
            set { angle = newValue }
        }

        func body(content: Content) -> some View {
            let radians = angle * .pi / 180
            let visible = isBack ? FlipCard.showsBack(at: angle) : !FlipCard.showsBack(at: angle)
            if crossfade {
                let backOpacity = 0.5 - 0.5 * cos(radians)
                content
                    .opacity(isBack ? backOpacity : 1 - backOpacity)
                    .accessibilityHidden(!visible)
            } else {
                let turn = abs(sin(radians))
                content
                    .brightness(-turn * shading)
                    // A light band crosses the face as it turns, so the rotation reads as a lit surface.
                    .overlay {
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .fill(.white.opacity(0.18 * turn * (sin(radians) > 0 ? 1 : 0.4)))
                            .blendMode(.softLight)
                            .allowsHitTesting(false)
                    }
                    .opacity(visible ? 1 : 0)
                    // The back starts at -180° so it lands unmirrored when the flip completes.
                    .rotation3DEffect(.degrees(isBack ? angle - 180 : angle), axis: (x: 0, y: 1, z: 0), perspective: 0.45)
                    .accessibilityHidden(!visible)
            }
        }
    }
}

fileprivate extension Color {
    /// An appearance-adaptive color, resolved per trait collection.
    init(flipLight light: Color, dark: Color) {
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }
}

// MARK: - Example

/// A vocabulary flashcard: a butter front with a heavy word, a sky back with the meaning.
private struct FlipCardExample: View {
    @State private var flipped = false

    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let butter = Color(red: 1, green: 0.851, blue: 0.463)
    private let sky = Color(red: 0.612, green: 0.761, blue: 1)
    private let ground = Color(flipLight: Color(red: 0.953, green: 0.949, blue: 0.933), dark: Color(red: 0.071, green: 0.071, blue: 0.071))

    var body: some View {
        FlipCard(isFlipped: $flipped) {
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
                        Text("PORTUGUESE")
                            .font(.caption2.weight(.bold))
                            .tracking(1)
                        Spacer()
                        Text("3 / 12")
                            .font(.system(.caption, design: .monospaced).weight(.semibold))
                    }
                    Spacer()
                    Text("Saudade")
                        .font(.system(size: 46, weight: .bold))
                        .tracking(-1.8)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("noun  ·  sow-DAH-jee")
                        .font(.subheadline.weight(.medium))
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
                    Text("MEANING")
                        .font(.caption2.weight(.bold))
                        .tracking(1)
                    Text("A deep longing for someone or something far away.")
                        .font(.system(size: 22, weight: .bold))
                        .tracking(-0.6)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                    Text("Often heard in fado songs")
                        .font(.subheadline.weight(.medium))
                        .opacity(0.62)
                }
                .foregroundStyle(ink)
                .padding(22)
            }
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
