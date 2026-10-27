// swiftpieces:
// title: Time Slot Picker
// description: "Bookable times as a grid of liquid glass pills, formatted in the user's locale and clock. The red selection flows to the time you tap like liquid, along a row or across rows: the edges facing the new slot lead and the far edges follow, so it stretches toward the pick and gathers in, while the label under it turns to ink. Taken times are outlined and struck through, and a tap on one shakes it with a firm tick instead of selecting it. For appointments, tables, classes and deliveries."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [time, booking, schedule, picker, grid, haptics]

import SwiftUI

/// Colors and metrics for `TimeSlotPicker`. `.standard` is the house palette: the brand red on neutral glass.
public struct TimeSlotPickerStyle: Sendable {
    /// The selection.
    public var accent: Color
    /// The time on the selection.
    public var onAccent: Color
    /// Open times.
    public var label: Color
    /// Taken times, and their outline's color at full strength.
    public var unavailable: Color
    /// The height of a slot. Grows with Dynamic Type.
    public var slotHeight: CGFloat
    /// The gap between slots, across and down.
    public var spacing: CGFloat

    public init(
        accent: Color = TimeSlotPickerStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        onAccent: Color = TimeSlotPickerStyle.adaptive(light: 0x141414, dark: 0x141414),
        label: Color = TimeSlotPickerStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        unavailable: Color = TimeSlotPickerStyle.adaptive(light: 0x8B8984, dark: 0x6F6D69),
        slotHeight: CGFloat = 44,
        spacing: CGFloat = 8
    ) {
        self.accent = accent
        self.onAccent = onAccent
        self.label = label
        self.unavailable = unavailable
        self.slotHeight = max(slotHeight, 32)
        self.spacing = spacing
    }

    public static let standard = TimeSlotPickerStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A grid of bookable times whose red selection flows to the time you pick.
///
/// - Parameters:
///   - slots: The times, in order, each open or taken. Build them from your availability; the start time is the identity.
///   - selection: The chosen start time, or `nil` for none. A taken time is never selected.
///   - columns: How many slots sit across a row. Three suits a phone; at the largest text sizes the grid drops to two.
///   - style: Colors and metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct TimeSlotPicker: View {
    public typealias Style = TimeSlotPickerStyle

    /// One bookable time.
    public struct Slot: Hashable, Sendable, Identifiable {
        public var start: Date
        public var isAvailable: Bool
        public var id: Date { start }

        public init(_ start: Date, isAvailable: Bool = true) {
            self.start = start
            self.isAvailable = isAvailable
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    @Binding private var selection: Date?
    /// Every slot's frame in the grid, measured, so the selection flows between real frames at any text size.
    @State private var frames: [Date: CGRect] = [:]
    /// The selection's edges, in points within the grid. Each is sprung on its own, so they can lead and trail.
    @State private var minX: CGFloat = 0
    @State private var maxX: CGFloat = 0
    @State private var minY: CGFloat = 0
    @State private var maxY: CGFloat = 0
    @State private var shown = false
    @State private var picks = 0
    @State private var refusals = 0
    @State private var shakes: [Date: Int] = [:]

    private let slots: [Slot]
    private let columns: Int
    private let style: Style

    public init(slots: [Slot], selection: Binding<Date?>, columns: Int = 3, style: Style = .standard) {
        self.slots = slots
        self._selection = selection
        self.columns = max(columns, 1)
        self.style = style
    }

    public var body: some View {
        grid
            .coordinateSpace(.named("TimeSlotPicker.grid"))
            .background { pill }
            .background { glass }
            .fontWeight(.semibold)
            .opacity(isEnabled ? 1 : 0.45)
            .sensoryFeedback(.selection, trigger: picks)
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: refusals)
            .onChange(of: selection) { _, new in flow(to: new) }
            .onChange(of: frames) { _, _ in
                // The first layout, or a size change: put the selection on its slot with no motion.
                guard let selection, let frame = frames[selection] else { return }
                if !shown || frame.minX != minX || frame.minY != minY { place(frame) }
            }
            .accessibilityElement(children: .contain)
    }

    private var columnCount: Int { dynamicTypeSize.isAccessibilitySize ? min(columns, 2) : columns }

    private var grid: some View {
        let rows = stride(from: 0, to: slots.count, by: columnCount).map { Array(slots[$0..<min($0 + columnCount, slots.count)]) }
        return VStack(spacing: style.spacing) {
            ForEach(rows.indices, id: \.self) { row in
                HStack(spacing: style.spacing) {
                    ForEach(rows[row]) { slot in cell(slot) }
                    // A short last row keeps the columns' widths.
                    ForEach(0..<(columnCount - rows[row].count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                }
            }
        }
    }

    private func cell(_ slot: Slot) -> some View {
        let chosen = slot.isAvailable && slot.start == selection
        return Button { pick(slot) } label: {
            Text(slot.start.formatted(date: .omitted, time: .shortened))
                .monospacedDigit()
                .strikethrough(!slot.isAvailable)
                .foregroundStyle(chosen ? style.onAccent : slot.isAvailable ? style.label : style.unavailable)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
                .frame(height: style.slotHeight * min(typeScale, 1.6))
                .overlay {
                    if !slot.isAvailable { Capsule().strokeBorder(style.unavailable.opacity(0.35), lineWidth: 1) }
                }
                .contentShape(.capsule)
                .animation(.easeOut(duration: 0.2), value: chosen)
        }
        .buttonStyle(PiecePressStyle(depth: 2))
        .pieceShake(trigger: shakes[slot.start, default: 0], distance: 6)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("TimeSlotPicker.grid")) } action: { frames[slot.start] = $0 }
        .accessibilityValue(slot.isAvailable ? "" : "Unavailable")
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    /// One glass capsule under each open time, in their own group under the labels so the text stays crisp.
    private var glass: some View {
        PieceLiquidGroup(spacing: 0) {
            ZStack(alignment: .topLeading) {
                Color.clear
                ForEach(slots.filter(\.isAvailable)) { slot in
                    if let frame = frames[slot.start] {
                        Color.clear
                            .pieceLiquid(.capsule, interactive: false)
                            .frame(width: frame.width, height: frame.height)
                            .offset(x: frame.minX, y: frame.minY)
                    }
                }
            }
        }
    }

    /// The selection, between its four edges, over the glass and under the labels.
    private var pill: some View {
        TimeSlotPickerEdge(value: minX) { minX in
            TimeSlotPickerEdge(value: maxX) { maxX in
                TimeSlotPickerEdge(value: minY) { minY in
                    TimeSlotPickerEdge(value: maxY) { maxY in
                        Capsule()
                            .fill(style.accent)
                            .frame(width: max(maxX - minX, 0), height: max(maxY - minY, 0))
                            .scaleEffect(shown ? 1 : 0.6)
                            .opacity(shown ? 1 : 0)
                            .offset(x: minX, y: minY)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Selection

    private func pick(_ slot: Slot) {
        guard slot.isAvailable else {
            refusals += 1
            shakes[slot.start, default: 0] += 1
            return
        }
        guard slot.start != selection else { return }
        picks += 1
        selection = slot.start
    }

    /// Puts the selection on `frame` with no motion, showing it unless `show` is false.
    private func place(_ frame: CGRect, show: Bool = true) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            minX = frame.minX
            maxX = frame.maxX
            minY = frame.minY
            maxY = frame.maxY
            if show { shown = true }
        }
    }

    /// The edges facing the new slot lead on the tight spring and the far edges follow on the responsive one, so the
    /// selection reaches across, or down a row, and gathers into the slot. From no selection it grows in place.
    /// Under Reduce Motion every edge shares one short spring and the selection slides whole.
    private func flow(to start: Date?) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard let start, let frame = frames[start], slots.contains(where: { $0.start == start && $0.isAvailable }) else {
            withAnimation(motion.dismiss) { shown = false }
            return
        }
        guard shown else {
            place(frame, show: false)
            withAnimation(motion.success) { shown = true }
            return
        }
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                minX = frame.minX
                maxX = frame.maxX
                minY = frame.minY
                maxY = frame.maxY
            }
            return
        }
        let lead = Animation.spring(PieceMotion.tight), trail = Animation.spring(PieceMotion.responsive)
        let right = frame.minX > minX, down = frame.minY > minY
        withAnimation(right ? lead : trail) { maxX = frame.maxX }
        withAnimation(right ? trail : lead) { minX = frame.minX }
        withAnimation(down ? lead : trail) { maxY = frame.maxY }
        withAnimation(down ? trail : lead) { minY = frame.minY }
    }
}

/// One edge of the selection, animated on its own: nested, the four edges keep separate springs.
private struct TimeSlotPickerEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// A morning and an afternoon of half-hour appointments, some already taken.
private struct TimeSlotPickerExample: View {
    @State private var time: Date?
    private let slots: [TimeSlotPicker.Slot] = {
        let day = Calendar.current.startOfDay(for: .now)
        let taken: Set<Int> = [1, 5, 7, 10]
        let hours: [Double] = [9, 9.5, 10, 10.5, 11, 11.5, 13, 13.5, 14, 14.5, 15, 15.5]
        return hours.enumerated().map { index, hour in
            TimeSlotPicker.Slot(day.addingTimeInterval(hour * 3600), isAvailable: !taken.contains(index))
        }
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Thursday")
                Spacer()
                Text(time.map { $0.formatted(date: .omitted, time: .shortened) } ?? "Pick a time")
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
            }
            .fontWeight(.semibold)
            TimeSlotPicker(slots: slots, selection: $time)
        }
        .padding(24)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TimeSlotPickerStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
        .onAppear { time = slots[4].start }
    }
}

#Preview("Light") {
    TimeSlotPickerExample()
}

#Preview("Dark") {
    TimeSlotPickerExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press, pressStyle, shake)

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

/// Sinks on touch-down, leaning toward the touch if given, and springs back from the same lean. Under Reduce
/// Motion it shades instead of moving (darker in light mode, lighter in dark), without turning transparent.
private struct PiecePress: ViewModifier {
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
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .scaleEffect(scale, anchor: anchor)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

private extension View {
    /// Sinks this view while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func piecePress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PiecePress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// Only the press, centered: for chips, rows and tiles, and anything in scrolling content.
private struct PiecePressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.piecePress(configuration.isPressed, depth: depth)
    }
}

/// A short decaying side-to-side shake for refused input, each time `trigger` changes. Under Reduce Motion it stays
/// still (same view, no identity change): pair it with a color or message change and the error haptic.
private struct PieceShake: ViewModifier {
    let trigger: AnyHashable
    var distance: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance = reduceMotion ? 0 : distance
        content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-distance, duration: 0.06)
                CubicKeyframe(distance * 0.75, duration: 0.07)
                CubicKeyframe(-distance * 0.5, duration: 0.07)
                CubicKeyframe(distance * 0.25, duration: 0.06)
                SpringKeyframe(0, duration: 0.12, spring: Spring(duration: 0.18, bounce: 0))
            }
        }
    }
}

private extension View {
    /// Shakes this view side to side once each time `trigger` changes, for input that was refused.
    func pieceShake(trigger: some Hashable & Sendable, distance: CGFloat = 8) -> some View {
        modifier(PieceShake(trigger: AnyHashable(trigger), distance: distance))
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
