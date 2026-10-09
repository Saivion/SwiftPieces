// swiftpieces:
// title: Glass Segments
// description: "A liquid glass segmented control: a signal-tinted glass indicator melted into a glass track as one surface. It moves like liquid, its leading edge reaching the new segment first and the trailing edge following, so it stretches across and gathers in. Grab it to scrub: it lifts under the finger, flattens against the ends and lands where the flick was heading, while the label ink flips exactly under its edge; tap still works."
// category: glass
// minIOSVersion: "17.0"
// version: "2.3.0"
// pro: lens-tab-bar
// tags: [segmented, picker, glass, drag, haptics]

import SwiftUI

/// Visual tuning for `GlassSegments`. `standard` is a neutral glass track with a signal-tinted glass indicator melted into
/// it, the house ink on the red; set `indicatorTint` for another tint.
public struct GlassSegmentsStyle: Sendable {
    /// Unused since the liquid glass refactor: the track is neutral glass, and the liquid foundation draws its fallback
    /// and its Reduce Transparency fill. Kept so existing code still compiles.
    public var track: Color
    /// Label color outside the indicator.
    public var ink: Color
    /// Label color on the indicator. It is masked to the indicator's shape, so it flips mid-drag. The house ink reads on
    /// signal, sage and butter alike.
    public var selectedInk: Color
    /// Glass tint of the indicator. `nil` uses the house signal red, the live selection; `.clear` leaves it neutral glass.
    public var indicatorTint: Color?
    /// Unused since the liquid glass refactor: the indicator is tinted glass (`indicatorTint`). Kept so existing code
    /// still compiles.
    public var indicatorSurface: Color
    /// Label font.
    public var font: Font
    /// Opacity of the control while disabled with `.disabled(true)`.
    public var disabledOpacity: Double

    public init(
        track: Color = GlassSegmentsStyle.adaptive(light: 0xE6E4DF, dark: 0x262626),
        ink: Color = GlassSegmentsStyle.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
        selectedInk: Color = GlassSegmentsStyle.adaptive(light: 0x141414, dark: 0x141414),
        indicatorTint: Color? = nil,
        indicatorSurface: Color = GlassSegmentsStyle.adaptive(light: 0xFFFFFF, dark: 0x3A3A3A),
        font: Font = .subheadline.weight(.semibold),
        disabledOpacity: Double = 0.45
    ) {
        self.track = track
        self.ink = ink
        self.selectedInk = selectedInk
        self.indicatorTint = indicatorTint
        self.indicatorSurface = indicatorSurface
        self.font = font
        self.disabledOpacity = disabledOpacity
    }

    public static let standard = GlassSegmentsStyle()

    /// A glass indicator tinted `fill`, with the house ink on it.
    public static func block(_ fill: Color) -> GlassSegmentsStyle {
        GlassSegmentsStyle(selectedInk: Color(red: 0.078, green: 0.078, blue: 0.078), indicatorTint: fill)
    }

    /// The house signal red: the indicator's tint when `indicatorTint` is `nil`.
    fileprivate static let signal = Color(red: 1, green: 0, blue: 0)

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// Liquid glass segmented control over any `Hashable` option type with a draggable indicator.
///
/// The track and the indicator are glass shapes in one liquid group. The indicator rests inside the track, joined to it,
/// so the two read as one surface with a tinted lens moving through it.
///
/// - Parameters:
///   - options: Segments in display order.
///   - selection: Bound selected option. Changing it externally moves the indicator the same way a tap does.
///   - height: Height of the segment row, excluding the 3pt track inset. Scales with Dynamic Type.
///   - label: Display text for an option.
///   - systemImage: Optional SF Symbol for an option, shown before its label.
///   - style: Label inks, indicator tint and font. `GlassSegmentsStyle.block(_:)` tints the indicator another color.
public struct GlassSegments<Option: Hashable>: View {
    public typealias Style = GlassSegmentsStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .subheadline) private var typeScale: CGFloat = 1
    @Binding private var selection: Option
    @State private var displayedIndex: Int
    /// The indicator's edges, in segments from the leading end (`index` and `index + 1` at rest), are each a sprung
    /// part plus a held part. Every animation moves only the sprung part.
    @State private var lowerEdge: CGFloat
    @State private var upperEdge: CGFloat
    /// The held part: a dragging finger sets it directly and nothing animates it, so a grab during a hand-off adds
    /// the finger to that flight instead of cutting it short.
    @State private var lowerPull: CGFloat = 0
    @State private var upperPull: CGFloat = 0
    /// Where the finger holds the indicator's center, in points, while it is grabbed.
    @State private var dragCenter: CGFloat?
    @State private var grabOffset: CGFloat = 0
    @State private var dragging = false
    @State private var touching = false
    @GestureState private var inGesture = false
    @State private var hoverIndex: Int?
    /// How far the leading edge reaches ahead with the drag's speed, in segments. Negative reaches toward the leading end.
    @State private var reach: CGFloat = 0
    @State private var crossings = 0

    private let options: [Option]
    private let height: CGFloat
    private let label: (Option) -> String
    private let systemImage: ((Option) -> String?)?
    private let style: Style
    /// The track's padding around the segments. An edge pressed past an end gives no more than this.
    private let inset: CGFloat = 3
    /// The indicator's scale while grabbed.
    private let liftScale: CGFloat = 1.04

    public init(options: [Option], selection: Binding<Option>, height: CGFloat = 40, style: Style = .standard, label: @escaping (Option) -> String, systemImage: ((Option) -> String?)? = nil) {
        self.options = options
        self._selection = selection
        self.height = height
        self.label = label
        self.systemImage = systemImage
        self.style = style
        let index = options.firstIndex(of: selection.wrappedValue) ?? 0
        self._displayedIndex = State(initialValue: index)
        self._lowerEdge = State(initialValue: CGFloat(index))
        self._upperEdge = State(initialValue: CGFloat(index + 1))
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        PieceLiquidGroup {
            row(motion)
                .frame(height: height * min(typeScale, 1.5))
                .padding(inset)
                // The track: one glass capsule under the whole row. It is the row's background, beside the indicator
                // rather than holding it, so the two are never glass on glass and melt into one surface.
                .background { Color.clear.pieceLiquid(.capsule, interactive: false) }
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : style.disabledOpacity)
        .animation(motion.morph, value: isEnabled)
        .sensoryFeedback(.selection, trigger: crossings)
        .accessibilityElement(children: .contain)
    }

    private func row(_ motion: PieceMotion) -> some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let segmentWidth = width / CGFloat(max(options.count, 1))
            let lift: CGFloat = dragging && !reduceMotion ? liftScale : 1
            ZStack(alignment: .leading) {
                pill(segmentWidth: segmentWidth, lift: lift) { shape in
                    ZStack {
                        indicator(shape)
                        shadow(shape)
                    }
                }
                labels(segmentWidth: segmentWidth, height: proxy.size.height, color: style.ink, accessible: true)
                // The same row in the selected ink, cut to the indicator, so the color hands over under its edge.
                labels(segmentWidth: segmentWidth, height: proxy.size.height, color: style.selectedInk, accessible: false)
                    .mask(alignment: .topLeading) { pill(segmentWidth: segmentWidth, lift: lift) { $0 } }
                    .accessibilityHidden(true)
            }
            .contentShape(.rect)
            .gesture(drag(segmentWidth: segmentWidth, width: width), including: isEnabled ? .all : .none)
            .onChange(of: selection) { _, new in
                guard let index = options.firstIndex(of: new), index != displayedIndex else { return }
                displayedIndex = index
                // Mid-drag the finger owns the indicator; the release settles it.
                if !dragging { handOff(to: index, segmentWidth: segmentWidth) }
            }
            // A gesture the system cancels (a parent scroll took over) never reaches onEnded: put the indicator
            // back and start the next touch clean.
            .onChange(of: inGesture) { _, active in
                guard !active, touching else { return }
                touching = false
                hoverIndex = nil
                dragCenter = nil
                reach = 0
                guard dragging else { return }
                handOff(to: displayedIndex, segmentWidth: segmentWidth)
                withAnimation(motion.release) { dragging = false }
            }
            // A resting finger sends no events, so the reach would hold. Let it go once the drag is still.
            .task(id: reach) {
                guard reach != 0 else { return }
                try? await Task.sleep(for: .milliseconds(100))
                guard !Task.isCancelled, let center = dragCenter else { return }
                reach = 0
                placeEdges(center: center, segmentWidth: segmentWidth, width: width, animation: motion.settle)
            }
        }
    }

    private func labels(segmentWidth: CGFloat, height: CGFloat, color: Color, accessible: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { index in
                segmentLabel(options[index])
                    .font(style.font)
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.horizontal, 8)
                    .frame(width: segmentWidth, height: height)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(index == displayedIndex ? [.isButton, .isSelected] : .isButton)
                    .accessibilityAction { select(index, segmentWidth: segmentWidth) }
                    .accessibilityHidden(!accessible)
            }
        }
    }

    @ViewBuilder private func segmentLabel(_ option: Option) -> some View {
        if let image = systemImage.flatMap({ $0(option) }) {
            Label(label(option), systemImage: image)
        } else {
            Text(label(option))
        }
    }

    /// The indicator's outline at its live edges, lifted while grabbed. The indicator and the ink mask both draw
    /// through this, so the ink always flips exactly under the indicator's edge.
    private func pill<Content: View>(segmentWidth: CGFloat, lift: CGFloat, @ViewBuilder _ content: @escaping (IndicatorShape) -> Content) -> some View {
        let count = CGFloat(max(options.count, 1))
        let lowerPull = lowerPull, upperPull = upperPull
        return IndicatorEdge(value: lowerEdge) { lowerSprung in
            IndicatorEdge(value: upperEdge) { upperSprung in
                let lower = lowerSprung + lowerPull, upper = upperSprung + upperPull
                content(IndicatorShape(lower: lower * segmentWidth, upper: upper * segmentWidth))
                    .scaleEffect(lift, anchor: UnitPoint(x: liftAnchor(lower: lower, upper: upper, segmentWidth: segmentWidth) / count, y: 0.5))
            }
        }
    }

    /// Where the lift scales from, in segments: the indicator's center, slid toward an end just enough that the lifted
    /// edge stays within the track's inset. Worked out for the full lift, so it holds while the lift springs in or out.
    private func liftAnchor(lower: CGFloat, upper: CGFloat, segmentWidth: CGFloat) -> CGFloat {
        let count = CGFloat(max(options.count, 1)), give = inset / segmentWidth, growth = liftScale - 1
        // Scaled from `anchor`, an edge lands at anchor + liftScale * (edge - anchor).
        let highest = (liftScale * lower + give) / growth
        let lowest = (liftScale * upper - count - give) / growth
        return min(max((lower + upper) / 2, lowest), highest)
    }

    /// The indicator: tinted glass in the track's group, joined to the track, so its tint blends into the glass around
    /// it as it stretches, gathers and flattens. Its own lift is the press, so the glass doesn't swell under the finger.
    private func indicator(_ shape: IndicatorShape) -> some View {
        Color.clear.pieceLiquid(shape, tint: indicatorTint, interactive: false)
    }

    private var indicatorTint: Color? {
        let tint = style.indicatorTint ?? GlassSegmentsStyle.signal
        return tint == .clear ? nil : tint
    }

    /// The indicator's shadow, deeper while it is grabbed (and the lift Reduce Motion keeps). The glass draws in its
    /// group, so the shadow is its own layer: the indicator's shape casting it, cut back out, so it falls only on the
    /// track around the indicator.
    private func shadow(_ shape: IndicatorShape) -> some View {
        shape
            .fill(.black)
            .shadow(color: .black.opacity(dragging ? 0.2 : 0.08), radius: dragging ? 10 : 3, y: dragging ? 5 : 1)
            .mask {
                ZStack {
                    Rectangle().padding(-30)
                    shape.blendMode(.destinationOut)
                }
                .compositingGroup()
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    // MARK: Interaction

    /// A touch that starts on the indicator drags it; a touch elsewhere is a tap on that segment.
    private func drag(segmentWidth: CGFloat, width: CGFloat) -> some Gesture {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return DragGesture(minimumDistance: 0)
            .updating($inGesture) { _, inGesture, _ in inGesture = true }
            .onChanged { value in
                if !touching {
                    touching = true
                    let resting = (CGFloat(displayedIndex) + 0.5) * segmentWidth
                    grabOffset = value.startLocation.x - resting
                    hoverIndex = displayedIndex
                    if abs(grabOffset) <= segmentWidth / 2 {
                        withAnimation(motion.press) { dragging = true }
                    }
                }
                guard dragging else { return }
                // Directly under the finger, never through an animation, with the leading edge reaching ahead at speed.
                let center = value.location.x - grabOffset
                dragCenter = center
                reach = motion.stretch(velocity: CGSize(width: value.velocity.width, height: 0), current: CGSize(width: reach, height: 0)).width
                placeEdges(center: center, segmentWidth: segmentWidth, width: width)
                let nearest = clampIndex(Int(center / segmentWidth))
                if nearest != hoverIndex {
                    hoverIndex = nearest
                    crossings += 1
                }
            }
            .onEnded { value in
                defer {
                    touching = false
                    hoverIndex = nil
                    dragCenter = nil
                    reach = 0
                }
                if dragging {
                    // Commit to where the flick would land, not just where the finger let go.
                    let projected = value.predictedEndLocation.x - grabOffset
                    let index = clampIndex(Int(projected / segmentWidth))
                    if index != hoverIndex { crossings += 1 }
                    // Let go past an end and landing there, the push went into the wall: it comes back without it.
                    let center = value.location.x - grabOffset
                    let pastEnd = center < segmentWidth / 2 || center > width - segmentWidth / 2
                    commit(index, velocity: value.velocity.width, segmentWidth: segmentWidth, rebound: pastEnd && index == hoverIndex)
                    // The lift comes down on the release spring as the indicator lands.
                    withAnimation(motion.release) { dragging = false }
                } else if abs(value.translation.width) < 10, abs(value.translation.height) < 10 {
                    select(clampIndex(Int(value.location.x / segmentWidth)), segmentWidth: segmentWidth)
                }
            }
    }

    private func select(_ index: Int, segmentWidth: CGFloat) {
        guard index != displayedIndex else { return }
        crossings += 1
        commit(index, segmentWidth: segmentWidth)
    }

    /// Lands on `index`: the indicator hands off to it, and the selection changes on the value spring. A picker like
    /// this often switches a chart or a total, and whatever reads the binding inherits this transaction, so it never
    /// overshoots a value the host shows.
    private func commit(_ index: Int, velocity: CGFloat = 0, segmentWidth: CGFloat, rebound: Bool = false) {
        displayedIndex = index
        handOff(to: index, velocity: velocity, segmentWidth: segmentWidth, rebound: rebound)
        withAnimation(PieceMotion(reduceMotion: reduceMotion).value) { selection = options[index] }
    }

    /// Moves the indicator to `index` edge by edge. The edge facing the new segment leads on the tight spring and
    /// lands crisply, so it stays inside the track at an end; the far edge follows on the responsive one, so the
    /// indicator reaches across, then gathers in to one segment with a little liquid give: the far edge passes its
    /// mark by about 3% of its travel and settles back. Elastic would pinch it far narrower on long jumps, so a picker
    /// stays on responsive. A release passes the finger's speed to both edges. Each edge changes in its own
    /// transaction and animates in its own `IndicatorEdge`, so each keeps its spring. The sprung part carries the whole move and the
    /// held part stays put. Under Reduce Motion both edges share one short spring with no overshoot, and the indicator
    /// slides without stretching. `rebound` brings an indicator flattened against an end back to full width instead,
    /// on the rebound spring.
    private func handOff(to index: Int, velocity: CGFloat = 0, segmentWidth: CGFloat, rebound: Bool = false) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let lower = CGFloat(index), upper = lower + 1
        if rebound {
            withAnimation(motion.rebound) {
                lowerEdge = lower - lowerPull
                upperEdge = upper - upperPull
            }
            return
        }
        let fromLower = lowerEdge + lowerPull, fromUpper = upperEdge + upperPull
        let forward = lower + 0.5 > (fromLower + fromUpper) / 2
        let lead = PieceMotion.tight, trail = PieceMotion.responsive
        // settle measures in points: velocity is in points per second, and under a point of travel it drops the velocity.
        withAnimation(motion.settle(velocity: velocity, from: fromUpper * segmentWidth, to: upper * segmentWidth, spring: forward ? lead : trail)) {
            upperEdge = upper - upperPull
        }
        withAnimation(motion.settle(velocity: velocity, from: fromLower * segmentWidth, to: lower * segmentWidth, spring: forward ? trail : lead)) {
            lowerEdge = lower - lowerPull
        }
    }

    /// Puts the edges under a finger holding the indicator's center at `center`, in points. Past an end the edge at
    /// the wall gives no more than the track's inset while the far edge follows against rubber-band resistance, so
    /// the indicator flattens against the end instead of leaving the track. Only the visual overshoots: the commit
    /// clamps. The reach extends the leading edge, as if scaled from the trailing one. Tracking sets the held parts
    /// directly, so a sprung part still in flight finishes under the finger; with `animation` the sprung parts take
    /// the change instead and ease into it.
    private func placeEdges(center: CGFloat, segmentWidth: CGFloat, width: CGFloat, animation: Animation? = nil) {
        let half = segmentWidth / 2
        let held = min(max(center, half), width - half)
        let over = center - held
        let wall = PieceMotion.rubberBand(over, limit: inset)
        // Under Reduce Motion it doesn't flatten: both edges stop at the wall together.
        let far = reduceMotion ? wall : PieceMotion.rubberBand(over, limit: 24)
        var lower = held - half + (over < 0 ? wall : far)
        var upper = held + half + (over > 0 ? wall : far)
        if reach > 0 { upper = min(upper + reach * segmentWidth, width + inset) }
        if reach < 0 { lower = max(lower + reach * segmentWidth, -inset) }
        if let animation {
            withAnimation(animation) {
                lowerEdge = lower / segmentWidth - lowerPull
                upperEdge = upper / segmentWidth - upperPull
            }
        } else {
            lowerPull = lower / segmentWidth - lowerEdge
            upperPull = upper / segmentWidth - upperEdge
        }
    }

    private func clampIndex(_ index: Int) -> Int { min(max(index, 0), options.count - 1) }
}

/// The sprung part of one edge of the indicator, animated on its own: SwiftUI interpolates `value` frame by frame and
/// rebuilds the content with it. Two nested give the two edges separate springs. One shape holding both edges would
/// animate them as a single value, so a second `.spring` change would pull the first edge onto its spring.
private struct IndicatorEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

/// A capsule between two edges, in points from the track's leading end. Narrower than it is tall, as when it is
/// squashed against an end, it rounds into a bead.
private struct IndicatorShape: Shape {
    var lower: CGFloat
    var upper: CGFloat

    func path(in rect: CGRect) -> Path {
        Capsule().path(in: CGRect(x: rect.minX + lower, y: rect.minY, width: max(upper - lower, 0), height: rect.height))
    }
}

// MARK: - Example

/// The component alone: the picker centred on the stage, cycling through its options.
private struct GlassSegmentsExample: View {
    enum Period: String, CaseIterable { case day, week, month, year }
    @State private var period: Period = .week

    var body: some View {
        GlassSegments(options: Period.allCases, selection: $period) { $0.rawValue.capitalized }
            .frame(maxWidth: 350)
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Glass shows what is behind it, so the example floats over a few colour blocks, as Glass Surface does.
            .background { GlassSegmentsBackdrop().ignoresSafeArea() }
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1.8))
                    let all = Period.allCases
                    period = all[(all.firstIndex(of: period)! + 1) % all.count]
                }
            }
    }
}

/// The blocks the control floats on.
private struct GlassSegmentsBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack {
                Color(red: 0.804, green: 0.722, blue: 1)
                Circle().fill(Color(red: 1, green: 0.851, blue: 0.463)).frame(width: w * 0.8).position(x: w * 0.82, y: h * 0.36)
                RoundedRectangle(cornerRadius: 40, style: .continuous).fill(Color(red: 0.663, green: 0.863, blue: 0.718))
                    .frame(width: w * 0.8, height: h * 0.34).rotationEffect(.degrees(-8)).position(x: w * 0.18, y: h * 0.66)
                Capsule().fill(Color(red: 0.612, green: 0.761, blue: 1)).frame(width: w * 0.9, height: 64).position(x: w * 0.58, y: h * 0.56)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    GlassSegmentsExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    GlassSegmentsExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand, stretch)

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

extension PieceMotion {
    /// Stretch along the direction of travel, low-passed from `current`. Clear it on release and when the finger
    /// rests (a resting finger sends no events).
    func stretch(velocity: CGSize, current: CGSize = .zero, limit: CGFloat = 0.1, referenceSpeed: CGFloat = 2000) -> CGSize {
        guard !reduceMotion else { return .zero }
        let speed = hypot(velocity.width, velocity.height)
        let amount = limit * CGFloat(tanh(Double(speed / referenceSpeed)))
        let axis: CGSize
        if speed > 40 {
            axis = CGSize(width: velocity.width / speed, height: velocity.height / speed)
        } else {
            let length = hypot(current.width, current.height)
            guard length > 0.0001 else { return .zero }
            axis = CGSize(width: current.width / length, height: current.height / length)
        }
        let target = CGSize(width: axis.width * amount, height: axis.height * amount)
        return CGSize(width: current.width + (target.width - current.width) * 0.35, height: current.height + (target.height - current.height) * 0.35)
    }

    /// A stretch for something held `pull` points from where it wants to be, like a band pulled past its edge:
    /// along the pull, easing toward `limit`. Stationary fingers keep it, which is right for a tether.
    func stretch(pull: CGSize, limit: CGFloat = 0.06, reach: CGFloat = 160) -> CGSize {
        guard !reduceMotion else { return .zero }
        let distance = hypot(pull.width, pull.height)
        guard distance > 0.5 else { return .zero }
        let amount = limit * (1 - 1 / (distance / reach + 1))
        return CGSize(width: pull.width / distance * amount, height: pull.height / distance * amount)
    }
}

/// Stretches along any direction and thins across it, keeping the area, so it reads as soft rather than resized.
/// Animate the vector to zero: its direction holds, so the shape never spins. At most 0.03 to 0.05 on text.
private struct PieceStretch: GeometryEffect {
    var vector: CGSize
    var anchor: UnitPoint = .center

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(vector.width, vector.height) }
        set { vector = CGSize(width: newValue.first, height: newValue.second) }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let amount = min(hypot(vector.width, vector.height), 0.2)
        guard amount > 0.0005 else { return ProjectionTransform() }
        let cosine = vector.width / amount, sine = vector.height / amount
        let along = 1 + amount, across = 1 / along, k = along - across
        // Scale by `along` on the stretch axis and `across` perpendicular to it.
        let stretch = CGAffineTransform(a: across + k * cosine * cosine, b: k * cosine * sine, c: k * cosine * sine, d: across + k * sine * sine, tx: 0, ty: 0)
        let x = size.width * anchor.x, y = size.height * anchor.y
        return ProjectionTransform(CGAffineTransform(translationX: -x, y: -y).concatenating(stretch).concatenating(CGAffineTransform(translationX: x, y: y)))
    }
}

private extension View {
    /// Applies a stretch vector. For a tethered pull, anchor it at the pinned edge.
    func pieceStretch(_ vector: CGSize, anchor: UnitPoint = .center) -> some View {
        modifier(PieceStretch(vector: vector, anchor: anchor))
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
