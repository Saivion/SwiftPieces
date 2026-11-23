// swiftpieces:
// title: Draft Minimize
// description: "A compose sheet that tucks itself away instead of closing: drag it down or tap the chevron and the whole card shrinks into a glass pill at the bottom of the screen, still showing the start of your draft. The page behind is yours again; tap the pill and the card grows back with every word where you left it. For mail, messages, notes, comments and any form people step away from."
// category: sheets
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [compose, draft, minimize, sheet, pill, mail, message]

import SwiftUI

/// Sizes and colors for `DraftMinimize`.
public struct DraftMinimizeStyle: Sendable {
    /// The open card's height, as a fraction of the space it is shown in.
    public var height: CGFloat
    /// The gap around the open card and under the pill.
    public var inset: CGFloat
    /// The open card's corner radius.
    public var cornerRadius: CGFloat
    /// The pill's width, at most, and its height.
    public var pillWidth: CGFloat
    public var pillHeight: CGFloat
    /// How dark the page gets behind the open card.
    public var dim: Double
    /// The card's title, the pill's text and the controls.
    public var label: Color
    /// The grabber and the chevrons.
    public var secondary: Color

    public init(
        height: CGFloat = 0.82,
        inset: CGFloat = 8,
        cornerRadius: CGFloat = 32,
        pillWidth: CGFloat = 280,
        pillHeight: CGFloat = 52,
        dim: Double = 0.16,
        label: Color = Color(UIColor.label),
        secondary: Color = Color(UIColor.secondaryLabel)
    ) {
        self.height = height
        self.inset = inset
        self.cornerRadius = cornerRadius
        self.pillWidth = pillWidth
        self.pillHeight = pillHeight
        self.dim = dim
        self.label = label
        self.secondary = secondary
    }

    public static let standard = DraftMinimizeStyle()
}

public extension View {
    /// Shows a compose card over this view that minimizes into a pill instead of closing.
    ///
    /// The draft is your view, so its text lives in your state and survives the trip into the pill. Set
    /// `isPresented` to `false` from your Send or Discard button to close it for good.
    ///
    /// - Parameters:
    ///   - isPresented: Whether there is a draft at all, open or minimized.
    ///   - isMinimized: Whether it is the pill. A drag down, the chevron or a tap on the page sets it; a tap on the pill clears it.
    ///   - title: The card's title, such as "New message".
    ///   - summary: The pill's text, usually the start of the draft.
    ///   - systemImage: The pill's symbol.
    ///   - style: Sizes and colors.
    ///   - draft: The card's content under its title: fields, the text, a Send button.
    func draftMinimize<Draft: View>(
        isPresented: Binding<Bool>,
        isMinimized: Binding<Bool>,
        title: String,
        summary: String,
        systemImage: String = "square.and.pencil",
        style: DraftMinimizeStyle = .standard,
        @ViewBuilder draft: () -> Draft
    ) -> some View {
        overlay {
            DraftMinimize(isPresented: isPresented, isMinimized: isMinimized, title: title, summary: summary, systemImage: systemImage, style: style, draft: draft())
        }
    }
}

/// The card and its pill. Use it through `.draftMinimize`.
public struct DraftMinimize<Draft: View>: View {
    public typealias Style = DraftMinimizeStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isPresented: Bool
    @Binding private var isMinimized: Bool
    @State private var drag: CGFloat = 0
    @State private var tucks = 0

    private let title: String
    private let summary: String
    private let systemImage: String
    private let style: Style
    private let draft: Draft

    init(isPresented: Binding<Bool>, isMinimized: Binding<Bool>, title: String, summary: String, systemImage: String, style: Style, draft: Draft) {
        self._isPresented = isPresented
        self._isMinimized = isMinimized
        self.title = title
        self.summary = summary
        self.systemImage = systemImage
        self.style = style
        self.draft = draft
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        GeometryReader { proxy in
            let size = proxy.size
            let card = CGRect(x: style.inset, y: size.height * (1 - style.height), width: size.width - style.inset * 2, height: size.height * style.height - style.inset)
            let pillWidth = min(style.pillWidth, size.width - style.inset * 4)
            let pill = CGRect(x: (size.width - pillWidth) / 2, y: size.height - style.pillHeight - style.inset * 1.5, width: pillWidth, height: style.pillHeight)
            let frame = isMinimized ? pill : card.offsetBy(dx: 0, dy: max(drag, 0))
            let radius = isMinimized ? style.pillHeight * 0.42 : style.cornerRadius

            ZStack(alignment: .topLeading) {
                if isPresented {
                    Color.black
                        .opacity(isMinimized ? 0 : style.dim * Double(1 - min(max(drag, 0) / card.height, 1)))
                        .ignoresSafeArea()
                        .allowsHitTesting(!isMinimized)
                        .onTapGesture { setMinimized(true) }
                        .accessibilityHidden(true)

                    PieceLiquidGroup {
                        ZStack(alignment: .topLeading) {
                            expanded
                                .frame(width: card.width, height: card.height, alignment: .top)
                                .opacity(isMinimized ? 0 : 1)
                                .allowsHitTesting(!isMinimized)
                                .accessibilityHidden(isMinimized)
                            minimized
                                .frame(width: pill.width, height: pill.height)
                                .opacity(isMinimized ? 1 : 0)
                                .allowsHitTesting(isMinimized)
                                .accessibilityHidden(!isMinimized)
                        }
                        .frame(width: frame.width, height: frame.height, alignment: .topLeading)
                        .clipShape(.rect(cornerRadius: radius, style: .continuous))
                        .pieceLiquid(RoundedRectangle(cornerRadius: radius, style: .continuous), interactive: isMinimized)
                    }
                    .offset(x: frame.minX, y: frame.minY)
                    .transition(motion.transition(.move(edge: .bottom)))
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .animation(motion.morph, value: isMinimized)
            .animation(isPresented ? motion.reveal : motion.dismiss, value: isPresented)
            .gesture(dragGesture(card: card), including: isPresented && !isMinimized ? .all : .subviews)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: tucks)
    }

    private var expanded: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(style.secondary.opacity(0.5))
                .frame(width: 36, height: 5)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)
            HStack {
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(style.label)
                Spacer()
                Button {
                    setMinimized(true)
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(style.secondary)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Minimize draft")
            }
            .padding(.leading, 20)
            .padding(.trailing, 8)
            draft
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var minimized: some View {
        Button {
            setMinimized(false)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.subheadline.weight(.semibold))
                Text(summary.isEmpty ? title : summary)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 4)
                Image(systemName: "chevron.up")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(style.secondary)
            }
            .foregroundStyle(style.label)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title): \(summary)")
        .accessibilityHint("Opens the draft")
    }

    private func dragGesture(card: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                // Only a drag that starts on the card's top strip moves it, so the draft's own scrolling still works.
                guard value.startLocation.y < card.minY + 72 else { return }
                drag = value.translation.height >= 0 ? value.translation.height : value.translation.height / 5
            }
            .onEnded { value in
                guard drag != 0 else { return }
                let projected = PieceMotion.project(drag, velocity: value.velocity.height)
                if projected > card.height * 0.25 {
                    setMinimized(true)
                } else {
                    withAnimation(PieceMotion(reduceMotion: reduceMotion).rebound) { drag = 0 }
                }
            }
    }

    private func setMinimized(_ minimized: Bool) {
        tucks += 1
        withAnimation(PieceMotion(reduceMotion: reduceMotion).morph) {
            isMinimized = minimized
            drag = 0
        }
    }
}

// MARK: - Example

/// An inbox with a message being written. Drag the card down or tap the chevron to tuck it away.
private struct DraftMinimizeExample: View {
    @State private var composing = true
    @State private var minimized = false
    @State private var text = "Hi Maya, the ferry leaves at 9 from Gate 3. Can you bring the paddles and the sunscreen?"
    private let red = Color(red: 1, green: 0, blue: 0)

    var body: some View {
        NavigationStack {
            List {
                ForEach([("Maya Chen", "Packing list"), ("Harbor Inn", "Your booking is confirmed"), ("Ferry Co.", "Schedule change for Saturday"), ("Jonah", "Photos from Sat")], id: \.0) { name, subject in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(name).font(.body.weight(.semibold))
                        Text(subject).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Inbox")
            .toolbar {
                Button("Compose", systemImage: "square.and.pencil") {
                    composing = true
                    minimized = false
                }
            }
        }
        .draftMinimize(isPresented: $composing, isMinimized: $minimized, title: "New message", summary: text) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Text("To:").foregroundStyle(.secondary)
                    Text("Maya Chen")
                }
                .font(.subheadline.weight(.semibold))
                Divider()
                TextField("Message", text: $text, axis: .vertical)
                    .font(.body.weight(.semibold))
                Spacer()
                Button {
                    composing = false
                } label: {
                    Label("Send", systemImage: "arrow.up")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(red, in: .rect(cornerRadius: 21, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
    }
}

#Preview("Light") {
    DraftMinimizeExample()
}

#Preview("Dark") {
    DraftMinimizeExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum)

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
