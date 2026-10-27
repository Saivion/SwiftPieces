// swiftpieces:
// title: Level Picker
// description: "A slider with a few named stops, for speed, quality, intensity, text size or any setting with a handful of levels. A red capsule sits on a liquid glass track over detent dots: tap a stop and it flows there like liquid, its leading edge first, or drag it and it follows the finger with a tick at every stop it crosses, then lands where the flick was heading. The stop names sit under the track with the chosen one in full ink, and optional symbols mark the low and high ends."
// category: controls
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [slider, stepper, levels, settings, drag, haptics]

import SwiftUI

/// Colors and metrics for `LevelPicker`. `.standard` is the house palette: the brand red on neutral glass.
public struct LevelPickerStyle: Sendable {
    /// The capsule that marks the level.
    public var accent: Color
    /// The detent dots.
    public var detent: Color
    /// The chosen level's name, and the end symbols.
    public var label: Color
    /// The other levels' names.
    public var secondaryLabel: Color
    /// The track's height. The capsule is 8pt shorter.
    public var trackHeight: CGFloat
    /// The capsule's width.
    public var thumbWidth: CGFloat

    public init(
        accent: Color = LevelPickerStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        detent: Color = LevelPickerStyle.adaptive(light: 0xB9B7B1, dark: 0x5A5A58),
        label: Color = LevelPickerStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        secondaryLabel: Color = LevelPickerStyle.adaptive(light: 0x8B8984, dark: 0x6F6D69),
        trackHeight: CGFloat = 36,
        thumbWidth: CGFloat = 44
    ) {
        self.accent = accent
        self.detent = detent
        self.label = label
        self.secondaryLabel = secondaryLabel
        self.trackHeight = max(trackHeight, 24)
        self.thumbWidth = max(thumbWidth, trackHeight - 8)
    }

    public static let standard = LevelPickerStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A slider that snaps between a few named levels, its red capsule flowing from stop to stop.
///
/// - Parameters:
///   - options: The levels, low to high. Two or more.
///   - selection: The chosen level. A drag writes it at every stop it crosses, so what it controls follows live.
///   - showsLabels: Shows each level's name under its stop. Turn it off when the names are long or the ends carry symbols.
///   - minimumImage: An optional SF Symbol before the track, for the low end, such as `"textformat.size.smaller"`.
///   - maximumImage: An optional SF Symbol after the track, for the high end.
///   - style: Colors and metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
///   - label: Each level's name, shown under its stop and read by VoiceOver.
public struct LevelPicker<Option: Hashable>: View {
    public typealias Style = LevelPickerStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var layoutDirection
    @Binding private var selection: Option
    /// The capsule's two ends, in stops from the first. At rest both name the same stop; while it flows the end facing
    /// the move leads and it spans the stops between. Each is sprung on its own.
    @State private var lower: CGFloat
    @State private var upper: CGFloat
    @State private var dragging = false
    @State private var dragStart: CGFloat = 0
    @State private var ticks = 0
    @GestureState private var inGesture = false

    private let options: [Option]
    private let showsLabels: Bool
    private let minimumImage: String?
    private let maximumImage: String?
    private let style: Style
    private let label: (Option) -> String

    /// The track's padding around the capsule.
    private let inset: CGFloat = 4

    public init(options: [Option], selection: Binding<Option>, showsLabels: Bool = true, minimumImage: String? = nil, maximumImage: String? = nil, style: Style = .standard, label: @escaping (Option) -> String) {
        self.options = options
        self._selection = selection
        self.showsLabels = showsLabels
        self.minimumImage = minimumImage
        self.maximumImage = maximumImage
        self.style = style
        self.label = label
        let index = CGFloat(options.firstIndex(of: selection.wrappedValue) ?? 0)
        self._lower = State(initialValue: index)
        self._upper = State(initialValue: index)
    }

    public var body: some View {
        HStack(spacing: 12) {
            if let minimumImage { Image(systemName: minimumImage).foregroundStyle(style.label).accessibilityHidden(true) }
            VStack(spacing: 10) {
                track
                if showsLabels { names }
            }
            if let maximumImage { Image(systemName: maximumImage).foregroundStyle(style.label).accessibilityHidden(true) }
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: ticks)
        .onChange(of: selection) { _, new in
            guard !dragging, let index = options.firstIndex(of: new) else { return }
            flow(to: index)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityValue(label(selection))
        .accessibilityAdjustableAction { direction in
            guard let index = options.firstIndex(of: selection) else { return }
            switch direction {
            case .increment: commit(min(index + 1, options.count - 1))
            case .decrement: commit(max(index - 1, 0))
            @unknown default: break
            }
        }
    }

    private var track: some View {
        GeometryReader { proxy in
            let step = stepWidth(proxy.size.width)
            ZStack(alignment: .leading) {
                ForEach(options.indices, id: \.self) { index in
                    Circle()
                        .fill(style.detent)
                        .frame(width: 6, height: 6)
                        .offset(x: x(CGFloat(index), step) + style.thumbWidth / 2 - 3)
                }
                LevelPickerEdge(value: lower) { lower in
                    LevelPickerEdge(value: upper) { upper in
                        Capsule()
                            .fill(style.accent)
                            .frame(width: x(upper, step) - x(lower, step) + style.thumbWidth, height: style.trackHeight - inset * 2)
                            .offset(x: x(lower, step))
                    }
                }
            }
            .frame(maxHeight: .infinity)
            .contentShape(.rect)
            .gesture(drag(step: step), including: isEnabled ? .all : .none)
            .onChange(of: inGesture) { _, active in
                // A touch the system cancelled (a scroll took over) never reaches onEnded: land where it is.
                guard !active, dragging else { return }
                dragging = false
                flow(to: nearest(lower))
            }
        }
        .frame(height: style.trackHeight)
        .background { PieceLiquidGroup { Color.clear.pieceLiquid(.capsule, interactive: false) } }
        .environment(\.layoutDirection, .leftToRight)
        .scaleEffect(x: layoutDirection == .rightToLeft ? -1 : 1)
    }

    private var names: some View {
        GeometryReader { proxy in
            let step = stepWidth(proxy.size.width)
            let chosen = options.firstIndex(of: selection)
            ForEach(options.indices, id: \.self) { index in
                Text(label(options[index]))
                    .font(.caption)
                    .foregroundStyle(index == chosen ? style.label : style.secondaryLabel)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: max(step, style.thumbWidth) + 8)
                    .position(x: mirror(x(CGFloat(index), step) + style.thumbWidth / 2, width: proxy.size.width), y: proxy.size.height / 2)
                    .animation(.easeOut(duration: 0.2), value: chosen)
            }
        }
        .frame(height: 18)
        .accessibilityHidden(true)
    }

    // MARK: Geometry

    private func stepWidth(_ width: CGFloat) -> CGFloat {
        (width - inset * 2 - style.thumbWidth) / CGFloat(max(options.count - 1, 1))
    }

    /// The capsule's leading edge, in points, with it at `stop` (fractional while it moves).
    private func x(_ stop: CGFloat, _ step: CGFloat) -> CGFloat { inset + stop * step }

    private func mirror(_ x: CGFloat, width: CGFloat) -> CGFloat { layoutDirection == .rightToLeft ? width - x : x }

    private func nearest(_ stop: CGFloat) -> Int { min(max(Int(stop.rounded()), 0), options.count - 1) }

    // MARK: Interaction

    /// Follows the finger directly, never through an animation, with a little give past either end; ticks at each stop.
    private func drag(step: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($inGesture) { _, inGesture, _ in inGesture = true }
            .onChanged { value in
                guard step > 0 else { return }
                if !dragging {
                    dragging = true
                    // A touch on the capsule grabs it where it is; a touch anywhere else brings it under the finger.
                    let current = (value.startLocation.x - inset - style.thumbWidth / 2) / step
                    dragStart = abs(current - lower) < 0.5 ? lower : current
                }
                let raw = dragStart + value.translation.width / step
                let stop = PieceMotion.rubberBand(raw, in: 0...CGFloat(options.count - 1), limit: 0.25)
                quietly {
                    lower = stop
                    upper = stop
                }
                let index = nearest(stop)
                if options[index] != selection {
                    ticks += 1
                    selection = options[index]
                }
            }
            .onEnded { value in
                guard dragging, step > 0 else { return }
                dragging = false
                let projected = PieceMotion.project(lower, velocity: value.velocity.width / step)
                let index = nearest(projected)
                if options[index] != selection {
                    ticks += 1
                    selection = options[index]
                }
                flow(to: index, velocity: value.velocity.width / step)
            }
    }

    private func commit(_ index: Int) {
        guard options[index] != selection else { return }
        selection = options[index]
    }

    /// The end facing the new stop leads on the tight spring and the far end follows on the responsive one, so the
    /// capsule stretches across the stops between and gathers in. A release passes on the finger's speed. Under
    /// Reduce Motion both ends share one short spring and the capsule slides whole.
    private func flow(to index: Int, velocity: CGFloat = 0) {
        let target = CGFloat(index)
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                lower = target
                upper = target
            }
            return
        }
        let forward = target > lower
        withAnimation(motion.settle(velocity: velocity, from: upper, to: target, spring: forward ? PieceMotion.tight : PieceMotion.responsive)) { upper = target }
        withAnimation(motion.settle(velocity: velocity, from: lower, to: target, spring: forward ? PieceMotion.responsive : PieceMotion.tight)) { lower = target }
    }

    private func quietly(_ change: () -> Void) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction, change)
    }
}

extension LevelPicker where Option == String {
    /// Levels named by their own strings, such as `["Off", "Low", "Medium", "High"]`.
    public init(_ levels: [String], selection: Binding<String>, showsLabels: Bool = true, minimumImage: String? = nil, maximumImage: String? = nil, style: Style = .standard) {
        self.init(options: levels, selection: selection, showsLabels: showsLabels, minimumImage: minimumImage, maximumImage: maximumImage, style: style) { $0 }
    }
}

/// One end of the capsule, animated on its own: two nested give the two ends separate springs.
private struct LevelPickerEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// A fan speed with named stops, and a text size with symbols at its ends.
private struct LevelPickerExample: View {
    @State private var speed = "Low"
    @State private var size = 2

    var body: some View {
        VStack(alignment: .leading, spacing: 36) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Fan speed")
                LevelPicker(["Off", "Low", "Medium", "High", "Max"], selection: $speed)
            }
            VStack(alignment: .leading, spacing: 12) {
                Text("Text size")
                LevelPicker(options: Array(0..<6), selection: $size, showsLabels: false, minimumImage: "textformat.size.smaller", maximumImage: "textformat.size.larger") {
                    ["Smaller", "Small", "Default", "Large", "Larger", "Largest"][$0]
                }
            }
        }
        .fontWeight(.semibold)
        .padding(24)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LevelPickerStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    LevelPickerExample()
}

#Preview("Dark") {
    LevelPickerExample()
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
