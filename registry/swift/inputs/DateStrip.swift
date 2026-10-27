// swiftpieces:
// title: Date Strip
// description: "A week of dates in a row, built from the user's calendar, locale and first weekday. The red pill flows to the day you tap like liquid, its leading edge reaching the new day first and the trailing edge following, and when you pick a day in another week it buds in place instead of streaking across. Swipe to page by week with a soft edge at the bounds; today keeps a dot and days out of range dim. Sits well above Time Slot Picker."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [date, calendar, week, picker, booking, haptics]

import SwiftUI

/// Colors and metrics for `DateStrip`. `.standard` is the house palette: the brand red with ink on it.
public struct DateStripStyle: Sendable {
    /// The selected day's pill, and today's dot.
    public var accent: Color
    /// The day and dot on the pill.
    public var onAccent: Color
    /// Day numbers and the month.
    public var label: Color
    /// Weekday names and the selected date in the header.
    public var secondary: Color
    /// Days outside the range.
    public var disabled: Color
    /// The height of a day. Grows with Dynamic Type.
    public var dayHeight: CGFloat
    /// The gap between days.
    public var spacing: CGFloat

    public init(
        accent: Color = DateStripStyle.adaptive(light: 0xFF0000, dark: 0xFF0000),
        onAccent: Color = DateStripStyle.adaptive(light: 0x141414, dark: 0x141414),
        label: Color = DateStripStyle.adaptive(light: 0x141414, dark: 0xF4F3EF),
        secondary: Color = DateStripStyle.adaptive(light: 0x6F6D69, dark: 0x9C9A95),
        disabled: Color = DateStripStyle.adaptive(light: 0xB8B6B0, dark: 0x4F4D4A),
        dayHeight: CGFloat = 64,
        spacing: CGFloat = 4
    ) {
        self.accent = accent
        self.onAccent = onAccent
        self.label = label
        self.secondary = secondary
        self.disabled = disabled
        self.dayHeight = max(dayHeight, 48)
        self.spacing = spacing
    }

    public static let standard = DateStripStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A week of days with a red pill that flows to the day you pick. Swipe to page by week.
///
/// - Parameters:
///   - selection: The chosen day. Any time of day works; the strip compares whole days in the environment's calendar.
///   - bounds: The days that can be picked, as with `DatePicker`: `today...` for bookings, a closed range for a window.
///     Days outside dim, and paging stops at the first and last weeks that hold a pickable day. `nil` (the default) is open.
///   - style: Colors and metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct DateStrip: View {
    public typealias Style = DateStripStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.calendar) private var calendar
    @Environment(\.layoutDirection) private var layoutDirection
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    @Binding private var selection: Date
    /// The week on screen, by its first day. `nil` until the user pages: then it follows the selection.
    @State private var shownWeek: Date?
    /// How far the weeks are dragged, in points.
    @State private var drag: CGFloat = 0
    @State private var width: CGFloat = 0
    /// The pill's edges, in days from the start of the selection's week. Each is sprung on its own.
    @State private var lower: CGFloat = 0
    @State private var upper: CGFloat = 1
    /// Counts the times the pill has budded into a day in a new week, to start the bud.
    @State private var buds = 0
    @State private var placed = false
    @State private var picks = 0
    @State private var turns = 0

    private let bounds: ClosedRange<Date>?
    private let style: Style

    public init(selection: Binding<Date>, in bounds: ClosedRange<Date>? = nil, style: Style = .standard) {
        self._selection = selection
        self.bounds = bounds
        self.style = style
    }

    public init(selection: Binding<Date>, in bounds: PartialRangeFrom<Date>, style: Style = .standard) {
        self.init(selection: selection, in: bounds.lowerBound...Date.distantFuture, style: style)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            pages
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: picks)
        .sensoryFeedback(.impact(weight: .light), trigger: turns)
        .onAppear { place(at: selection) }
        .onChange(of: selection) { old, new in move(from: old, to: new) }
    }

    // MARK: Layout

    private var week: Date { shownWeek ?? start(of: selection) }

    private var header: some View {
        // The month of the selection while it is on screen, otherwise of the week's middle day.
        let reference = start(of: selection) == week ? selection : day(3, of: week)
        return HStack(alignment: .firstTextBaseline) {
            Text(reference, format: .dateTime.month(.wide).year())
                .foregroundStyle(style.label)
                .contentTransition(.numericText())
            Spacer()
            Text(selection, format: .dateTime.weekday(.abbreviated).day())
                .foregroundStyle(style.secondary)
                .contentTransition(.numericText())
        }
        .font(.title3)
        .animation(PieceMotion(reduceMotion: reduceMotion).value, value: reference)
        .accessibilityElement(children: .combine)
    }

    /// The week on screen with its neighbours either side, so a swipe shows the next week sliding in.
    private var pages: some View {
        ZStack {
            ForEach(-1...1, id: \.self) { page in
                weekRow(adding(page, to: week))
                    .offset(x: CGFloat(page * forward) * (width + style.spacing) + drag)
                    .accessibilityHidden(page != 0)
            }
        }
        .background(alignment: .leading) { pill }
        // Laid out left to right and mirrored by hand, so the pill, the pages and the finger agree in every language.
        .environment(\.layoutDirection, .leftToRight)
        .frame(maxWidth: .infinity)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .clipped()
        .contentShape(.rect)
        .gesture(paging, including: isEnabled ? .all : .none)
        .accessibilityElement(children: .contain)
        .accessibilityScrollAction { edge in
            switch edge {
            case .leading: turn(-1)
            case .trailing: turn(1)
            default: break
            }
        }
    }

    private func weekRow(_ first: Date) -> some View {
        HStack(spacing: style.spacing) {
            ForEach(0..<7, id: \.self) { column in
                dayCell(day(slot(column), of: first))
                    .accessibilitySortPriority(Double(7 - slot(column)))
            }
        }
    }

    private func dayCell(_ date: Date) -> some View {
        let chosen = calendar.isDate(date, inSameDayAs: selection)
        let open = contains(date), today = calendar.isDateInToday(date)
        return Button { pick(date) } label: {
            VStack(spacing: 4) {
                Text(date, format: .dateTime.weekday(.abbreviated))
                    .font(.footnote)
                    .foregroundStyle(chosen ? style.onAccent : open ? style.secondary : style.disabled)
                Text(date, format: .dateTime.day())
                    .font(.title3)
                    .monospacedDigit()
                    .foregroundStyle(chosen ? style.onAccent : open ? style.label : style.disabled)
                Circle()
                    .fill(chosen ? style.onAccent : style.accent)
                    .frame(width: 5, height: 5)
                    .opacity(today ? 1 : 0)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .frame(maxWidth: .infinity)
            .frame(height: style.dayHeight * min(typeScale, 1.5))
            .contentShape(.rect)
            .animation(.easeOut(duration: 0.2), value: chosen)
        }
        .buttonStyle(PiecePressStyle(depth: 2))
        .disabled(!open)
        .accessibilityLabel(Text(date, format: .dateTime.weekday(.wide).day().month(.wide)))
        .accessibilityValue(today ? "Today" : "")
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    /// The pill, between its two edges, riding on the selection's own week as the weeks slide. It only ever moves
    /// within that week; it is hidden while that week is more than a page away.
    private var pill: some View {
        let pitch = (width - style.spacing * 6) / 7 + style.spacing
        let page = calendar.dateComponents([.weekOfYear], from: week, to: start(of: selection)).weekOfYear ?? 0
        let still = reduceMotion
        return DateStripEdge(value: lower) { lower in
            DateStripEdge(value: upper) { upper in
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(style.accent)
                    .frame(width: max((upper - lower) * pitch - style.spacing, 0))
                    // A bud: from a small dot of red to the full pill, with a little overshoot. Fades in under Reduce Motion.
                    .keyframeAnimator(initialValue: CGFloat(1), trigger: buds) { content, grown in
                        content
                            .scaleEffect(still ? 1 : 0.6 + 0.4 * grown)
                            .opacity(min(grown, 1))
                    } keyframes: { _ in
                        KeyframeTrack {
                            MoveKeyframe(0)
                            SpringKeyframe(1, duration: still ? 0.24 : 0.48, spring: still ? Spring(duration: 0.24, bounce: 0) : PieceMotion.expressive)
                        }
                    }
                    .offset(x: lower * pitch + CGFloat(page * forward) * (width + style.spacing) + drag)
            }
        }
        .opacity(abs(page) <= 1 ? 1 : 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Selection

    private func pick(_ date: Date) {
        guard contains(date), !calendar.isDate(date, inSameDayAs: selection) else { return }
        picks += 1
        selection = date
    }

    /// Within a week the edge facing the new day leads on the tight spring and the far edge follows on the responsive
    /// one. Into a new week the pill buds in place on the new day; it never travels from a day that is off screen.
    /// Under Reduce Motion the pill slides whole within a week and fades into a new one.
    private func move(from old: Date, to new: Date) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let target = CGFloat(slot(index(of: new)))
        guard placed, start(of: old) == start(of: new), week == start(of: new) else {
            // A pick in the week on screen, or a selection set from outside: show its week and bud there.
            quietly {
                shownWeek = nil
                drag = 0
                lower = target
                upper = target + 1
            }
            placed = true
            buds += 1
            return
        }
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                lower = target
                upper = target + 1
            }
            return
        }
        let forward = target > lower
        withAnimation(.spring(forward ? PieceMotion.tight : PieceMotion.responsive)) { upper = target + 1 }
        withAnimation(.spring(forward ? PieceMotion.responsive : PieceMotion.tight)) { lower = target }
    }

    private func place(at date: Date) {
        quietly {
            lower = CGFloat(slot(index(of: date)))
            upper = lower + 1
        }
        placed = true
    }

    // MARK: Paging

    /// Follows the finger, with a soft edge where there is no week to go to; a long or quick swipe turns the week.
    private var paging: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                let dx = value.translation.width
                quietly { drag = canTurn(dx < 0 ? forward : -forward) ? dx : PieceMotion.rubberBand(dx, limit: 40) }
            }
            .onEnded { value in
                let projected = PieceMotion.project(value.translation.width, velocity: value.velocity.width)
                let direction = projected < -width / 3 ? forward : projected > width / 3 ? -forward : 0
                if direction != 0, canTurn(direction) {
                    turn(direction, velocity: value.velocity.width)
                } else {
                    let motion = PieceMotion(reduceMotion: reduceMotion)
                    withAnimation(motion.settle(velocity: value.velocity.width, from: drag, to: 0, spring: PieceMotion.responsive)) { drag = 0 }
                }
            }
    }

    /// Slides the next (1) or previous (-1) week in, then makes it the week on screen.
    private func turn(_ direction: Int, velocity: CGFloat = 0) {
        guard canTurn(direction) else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let target = -CGFloat(direction * forward) * (width + style.spacing)
        let next = adding(direction, to: week)
        turns += 1
        withAnimation(motion.settle(velocity: velocity, from: drag, to: target, spring: Spring(duration: 0.32, bounce: 0))) {
            drag = target
        } completion: {
            quietly {
                shownWeek = start(of: selection) == next ? nil : next
                drag = 0
            }
        }
    }

    private func canTurn(_ direction: Int) -> Bool {
        guard let bounds else { return true }
        let first = adding(direction, to: week)
        let last = calendar.date(byAdding: .day, value: 7, to: first) ?? first
        return first <= bounds.upperBound && last > bounds.lowerBound
    }

    // MARK: Calendar

    /// 1 when later weeks lie to the right, -1 in right-to-left languages.
    private var forward: Int { layoutDirection == .rightToLeft ? -1 : 1 }

    /// The column, from the left, of the day `index` days into the week; also the reverse.
    private func slot(_ index: Int) -> Int { forward == 1 ? index : 6 - index }

    private func start(of date: Date) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    private func day(_ index: Int, of week: Date) -> Date {
        calendar.date(byAdding: .day, value: index, to: week) ?? week
    }

    private func adding(_ weeks: Int, to week: Date) -> Date {
        calendar.date(byAdding: .weekOfYear, value: weeks, to: week) ?? week
    }

    private func index(of date: Date) -> Int {
        calendar.dateComponents([.day], from: start(of: date), to: calendar.startOfDay(for: date)).day ?? 0
    }

    private func contains(_ date: Date) -> Bool {
        guard let bounds else { return true }
        let day = calendar.startOfDay(for: date)
        return day >= calendar.startOfDay(for: bounds.lowerBound) && day <= bounds.upperBound
    }

    private func quietly(_ change: () -> Void) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction, change)
    }
}

/// One edge of the pill, animated on its own: two nested give the two edges separate springs.
private struct DateStripEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// Booking from today on: the strip picks the day, and the line under it reads it back.
private struct DateStripExample: View {
    @State private var day = Date.now

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            DateStrip(selection: $day, in: Calendar.current.startOfDay(for: .now)...)
            Text("Showing times for \(day.formatted(.dateTime.weekday(.wide).day().month(.wide)))")
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(maxWidth: 440)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DateStripStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    DateStripExample()
}

#Preview("Dark") {
    DateStripExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand, pressMath, press, pressStyle)

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

// swiftpieces-motion: end
