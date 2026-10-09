// swiftpieces:
// title: Date Range Picker
// description: A start-to-end date range picker on a paged month grid built from the environment calendar and locale, with the selection in liquid glass over the grid. A touch presses a small glass bubble into the day and the tap swells it into a red glass start bubble; the second tap lands the end the same way and the band pours out of the start along each week and into the end like liquid, joined to both bubbles by necks. Sold-out days are struck through, a refused end day swells into a butter bubble that shakes and melts away, a maximum length dims unreachable days, months page by swipe or a joined pair of glass chevrons that melt into each other at the ends, the month and summary morph letter by letter, and a glass chip reads out the dates and nights.
// category: inputs
// pro: slot-picker
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-23"
// tags: [date, calendar, range, booking, picker]

import SwiftUI

/// Day-granular start/end range picker with a paged month grid.
///
/// The selection is always two start-of-day dates in the environment `Calendar` and `TimeZone`
/// (`upperBound` is the start of the last day, e.g. the check-out day for a stay). The first tap sets a start,
/// the second closes the range (a day before the start becomes the new start), and a third tap starts over.
/// A range can never contain a disabled or out-of-bounds day: an end tap that would span one, or that exceeds
/// `maximumLength`, is refused with an error haptic, a butter bubble that flares and shakes on the tapped day and a
/// short notice, and the start stays in place.
///
/// The grid stays as it is and the selection is liquid glass over it: the start and end are tinted bubbles, and the
/// band between them is liquid glass that joins them through a neck at each end and wraps across week rows.
///
/// - Parameters:
///   - selection: Bound range, or `nil` while nothing (or only a start) is chosen. In `.nights` mode it stays `nil` until the end is tapped; in `.days` mode a lone start already reads as a one-day range.
///   - bounds: First and last selectable days. Days outside are muted and inert, and paging stops at their months. `nil` allows any day and pages five years either side of today.
///   - isDateDisabled: Marks single days unavailable (for example sold-out nights). Called with the start of each day; unavailable days are struck through and can never be inside a range.
///   - maximumLength: Longest allowed range, counted in `counting` units. While a start is pending, days that cannot close the range are dimmed.
///   - counting: `.days` counts both ends (Mar 4 to Mar 9 is 6 days, and a single day is allowed). `.nights` counts nights (5 nights, and the end must be after the start).
///   - showsSummary: Show the header line with the formatted range and its length chip.
///   - style: Colors. Defaults to the SwiftPieces house palette (red glass start and end bubbles with dark ink, joined by a neutral glass band), adapting to light and dark.
public struct DateRangePicker: View {
    /// How range length is counted, for `maximumLength` and the summary chip.
    public enum Counting: Sendable {
        /// Inclusive days: the start and end day both count.
        case days
        /// Nights between the start and end day.
        case nights
    }

    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The rounded ground behind the whole picker.
        public var ground: Color
        /// Day numbers, the month title and the summary.
        public var dayText: Color
        /// Weekday symbols, the hint and days out of reach.
        public var mutedText: Color
        /// The glass tint of the band that joins the start and end bubbles. `.clear`, the default, leaves it neutral glass.
        public var band: Color
        /// The glass tint of the start and end bubbles.
        public var endpoint: Color
        /// Text and marks on tinted glass: the start and end days, the notice and a refused day.
        public var ink: Color
        /// The dot under today's number.
        public var today: Color
        /// Unavailable and out-of-bounds day numbers.
        public var disabled: Color
        /// The glass tint of the previous and next month buttons. `.clear`, the default, leaves them neutral glass.
        public var control: Color
        /// The glass tint of the refusal notice, and of the bubble that flares on a refused day.
        public var error: Color
        /// Unused since the liquid glass refactor: the start and end are round bubbles and the band a capsule. Kept so existing code still compiles.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(ground: Color? = nil, dayText: Color? = nil, mutedText: Color? = nil, band: Color? = nil, endpoint: Color? = nil, ink: Color? = nil, today: Color? = nil, disabled: Color? = nil, control: Color? = nil, error: Color? = nil, cornerRadius: CGFloat = 12) {
            self.ground = ground ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.dayText = dayText ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.mutedText = mutedText ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.band = band ?? .clear
            self.endpoint = endpoint ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.today = today ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.disabled = disabled ?? adaptive(light: 0xB3B0AA, dark: 0x5E5C58)
            self.control = control ?? .clear
            self.error = error ?? adaptive(light: 0xFFD976, dark: 0xFFD976)
            self.cornerRadius = max(cornerRadius, 0)
        }

        public static let standard = Style()
    }

    @Environment(\.calendar) private var environmentCalendar
    @Environment(\.locale) private var locale
    @Environment(\.timeZone) private var timeZone
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var scaledCell: CGFloat = 44

    @Binding private var selection: ClosedRange<Date>?
    @State private var pending: Date?
    @State private var lastWritten: ClosedRange<Date>?
    @State private var page: Date?
    @State private var titleMonth: Date?
    @State private var gridOpacity: Double = 1
    @State private var notice: Notice?
    @State private var tapTick = 0
    @State private var successTick = 0
    @State private var errorTick = 0
    /// True when a tap here closed the range, so the length chip pops with the success haptic. A range written from
    /// outside has no haptic, so its chip lands on a snap.
    @State private var chipPops = false
    /// Refused end taps per day: each new one shakes only that day.
    @State private var refusals: [Date: Int] = [:]
    /// The start and end bubbles, one per day: out while the day is an endpoint, shrinking away where it sits once it
    /// isn't. Nothing in the grid is glass for them to melt into, so they swell from the finger's press and fade home.
    @State private var buds = PieceBuds()
    /// The previous and next month buttons: out while they can page, melted into each other at the first and last month.
    @State private var pagerBuds = PieceBuds()
    /// The band of the closed range, and any band still draining from a range that just ended.
    @State private var bands: [Band] = []
    @State private var bandSerial = 0
    /// The day under the finger, which presses a small glass bubble into it.
    @State private var pressedDay: Date?
    /// The butter bubble on a refused day.
    @State private var flare: Flare?
    /// The grid's width, which the glass over it is laid out from.
    @State private var gridWidth: CGFloat = 0

    private let bounds: ClosedRange<Date>?
    private let isDateDisabled: (Date) -> Bool
    private let maximumLength: Int?
    private let counting: Counting
    private let showsSummary: Bool
    private let style: Style

    private enum Refusal: Equatable { case tooLong(Int), unavailable }
    private struct Notice: Equatable { let id: Int; let refusal: Refusal }

    /// What the summary's chip says: the hint while a start waits for its end, a refusal, or the range's length.
    private enum Status: Equatable { case hint, notice(Refusal), length(Int) }

    /// One band: a closed range and how much of it the pen has drawn, from 0 to 1. Under Reduce Motion it is drawn
    /// whole and `shown` fades it in and out instead.
    private struct Band: Identifiable {
        let id: Int
        let range: ClosedRange<Date>
        var ink: Double
        var shown: Double
    }

    /// A refused day's bubble: it swells from the finger's press into butter glass as the day shakes, holds a beat,
    /// then drains and shrinks away.
    private struct Flare: Equatable {
        enum Phase { case born, lit, gone }
        let day: Date
        let id: Int
        var phase: Phase
    }

    public init(selection: Binding<ClosedRange<Date>?>, in bounds: ClosedRange<Date>? = nil, isDateDisabled: @escaping (Date) -> Bool = { _ in false }, maximumLength: Int? = nil, counting: Counting = .days, showsSummary: Bool = true, style: Style = .standard) {
        self._selection = selection
        self.bounds = bounds
        self.isDateDisabled = isDateDisabled
        self.maximumLength = maximumLength.map { max($0, 1) }
        self.counting = counting
        self.showsSummary = showsSummary
        self.style = style
        // Best first guess for the opening page so the pager starts there; corrected on appear if the environment calendar differs.
        let math = DayMath(calendar: .autoupdatingCurrent, locale: .autoupdatingCurrent, timeZone: .autoupdatingCurrent)
        let first = math.initialMonth(selection: selection.wrappedValue, bounds: math.normalized(bounds), today: math.day(.now))
        self._page = State(initialValue: first)
        self._titleMonth = State(initialValue: first)
    }

    private var cellHeight: CGFloat { min(max(scaledCell, 44), 76) }
    /// The month buttons: a joined pair of 44pt glass circles.
    private let pagerSize: CGFloat = 44
    /// The card's padding. The pager reaches out through it, so it clips the glass's shadow at the card's edge.
    private let inset: CGFloat = 16

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    public var body: some View {
        let math = DayMath(calendar: environmentCalendar, locale: locale, timeZone: timeZone)
        let today = math.day(.now)
        let limits = math.normalized(bounds)
        let months = math.months(bounds: limits, today: today, including: selection.map { math.day($0.lowerBound) })
        let current = math.monthStart(titleMonth ?? math.initialMonth(selection: selection, bounds: limits, today: today))
        let index = months.firstIndex(of: current)
        let context = makeContext(math: math, today: today, limits: limits)
        // The month buttons that can page from here, the days that carry a bubble, and the range the band draws.
        let paging = ((index ?? 0) > 0 ? ["back"] : []) + (index.map { $0 < months.count - 1 } == true ? ["forward"] : [])
        let ends = endpoints(context)
        let closed = closedRange(context)

        VStack(alignment: .leading, spacing: 14) {
            if showsSummary {
                summary(context)
            }
            header(title: math.monthTitle(current), months: months, current: current)
            weekdayRow(math)
            pager(months: months, current: current, context: context)
        }
        .padding(inset)
        .background(style.ground, in: .rect(cornerRadius: 26, style: .continuous))
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: tapTick)
        .sensoryFeedback(.success, trigger: successTick)
        .sensoryFeedback(.error, trigger: errorTick)
        .onAppear {
            let month = math.monthStart(page ?? math.initialMonth(selection: selection, bounds: limits, today: today))
            let settled = months.contains(month) ? month : math.initialMonth(selection: selection, bounds: limits, today: today)
            if page != settled { page = settled }
            titleMonth = settled
            // The selection the picker opens with is simply there: no bubble swells and no band pours.
            buds.place(ends)
            pagerBuds.place(paging)
            if let closed, bands.isEmpty {
                bandSerial += 1
                bands = [Band(id: bandSerial, range: closed, ink: 1, shown: 1)]
            }
        }
        .onChange(of: page) { old, new in
            guard let new, new != titleMonth else { return }
            // The title is read as it changes, so it morphs on `value` and never past the month.
            withAnimation(motion.value) { titleMonth = new }
            AccessibilityNotification.Announcement(math.monthTitle(new)).post()
        }
        .onChange(of: selection) { _, new in
            // An outside write (a reset button, a restored draft) drops any half-made range.
            guard new != lastWritten else { return }
            lastWritten = new
            pending = nil
            chipPops = false
        }
        // An endpoint swells out where it lands and shrinks away where it was, both at once, so a new start never
        // waits for the old range to go.
        .onChange(of: ends) { old, new in exchange(buds, from: old, to: new) }
        .onChange(of: paging) { old, new in exchange(pagerBuds, from: old, to: new) }
        .onChange(of: closed) { old, new in redrawBand(from: old, to: new, math: math) }
        .task(id: notice) {
            guard notice != nil else { return }
            try? await Task.sleep(for: .seconds(2.2))
            guard !Task.isCancelled else { return }
            withAnimation(motion.dismiss) { notice = nil }
        }
    }

    // MARK: Header

    private func summary(_ context: Context) -> some View {
        let math = context.math
        let title: String
        let hasValue: Bool
        if let start = pending {
            title = math.short(start, today: context.today) + " –"
            hasValue = true
        } else if let lower = context.lower, let upper = context.upper {
            title = math.interval(lower...upper, today: context.today)
            hasValue = true
        } else {
            title = String(localized: "Select dates")
            hasValue = false
        }
        let status = status(context)
        let titleText = label(title, font: .title3.weight(.semibold))
            .foregroundStyle(hasValue ? style.dayText : style.mutedText)
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) {
                titleText.lineLimit(1)
                Spacer(minLength: 8)
                summaryChip(status)
            }
            VStack(alignment: .leading, spacing: 8) {
                titleText
                summaryChip(status)
            }
        }
        // The dates change letter by letter on `value`, which never overshoots; only the length chip arriving bounces.
        .animation(chipMotion(status), value: status)
        .animation(motion.value, value: title)
        .accessibilityElement(children: .combine)
    }

    /// How the chip moves when its status changes: a notice arrives firmly, a length closed by a tap pops in on the
    /// success haptic's beat, anything else snaps, and the chip leaves without a bounce.
    private func chipMotion(_ status: Status?) -> Animation {
        switch status {
        case .notice: motion.error
        case .length: chipPops ? motion.success : motion.snap
        case .hint: motion.snap
        case nil: motion.dismiss
        }
    }

    private func status(_ context: Context) -> Status? {
        if let notice { return .notice(notice.refusal) }
        if pending != nil { return .hint }
        if let lower = context.lower, let upper = context.upper { return .length(length(from: lower, to: upper, context.math)) }
        return nil
    }

    /// One glass chip that morphs between the hint, a refusal and the length: its label changes letter by letter and
    /// its glass widens or narrows around it, and a refusal floods it butter. Nothing above the grid is glass for it to
    /// bud from, so it rises in on its own and steps out when there is nothing left to say.
    @ViewBuilder
    private func summaryChip(_ status: Status?) -> some View {
        if let status {
            let warning = { if case .notice = status { return true } else { return false } }()
            let text: String = switch status {
            case .hint: String(localized: "Select end date")
            case .notice(let refusal): message(for: refusal)
            case .length(let count): lengthText(count)
            }
            PieceLiquidGroup {
                HStack(spacing: 6) {
                    if warning {
                        Image(systemName: "exclamationmark")
                            .font(.caption.weight(.semibold))
                            .transition(motion.swap)
                            .accessibilityHidden(true)
                    }
                    label(text, font: .subheadline.weight(.semibold).monospacedDigit())
                        .lineLimit(2)
                }
                .foregroundStyle(warning ? style.ink : status == .hint ? style.mutedText : style.dayText)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                // The tint means something only while the chip carries a refusal.
                .pieceLiquid(.capsule, tint: warning ? style.error : nil, interactive: false)
            }
            .transition(LiquidRise(scale: 0.85, reduceMotion: reduceMotion))
        }
    }

    /// A label that morphs letter by letter as it changes. At accessibility sizes it wraps instead, which a morph
    /// can't, and blurs across.
    @ViewBuilder
    private func label(_ text: String, font: Font) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            ZStack(alignment: .leading) {
                Text(text)
                    .font(font)
                    .id(text)
                    .transition(motion.swap)
            }
        } else {
            PieceMorphText(text: text, font: font)
        }
    }

    private func header(title: String, months: [Date], current: Date) -> some View {
        HStack(spacing: 2) {
            label(title, font: .headline.weight(.semibold))
                .foregroundStyle(style.dayText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            // One control, so the two bubbles rest joined. At the first or last month the one that can't page melts
            // into the other and buds back out as soon as it can; each keeps its place meanwhile.
            PieceLiquidGroup {
                HStack(spacing: PieceLiquid.joined) {
                    pagerButton("back", symbol: "chevron.backward", label: "Previous month") { go(-1, months: months, current: current) }
                    pagerButton("forward", symbol: "chevron.forward", label: "Next month") { go(1, months: months, current: current) }
                }
            }
        }
    }

    private func pagerButton(_ id: String, symbol: String, label: LocalizedStringKey, action: @escaping () -> Void) -> some View {
        let out = pagerBuds.isOut(id)
        // Home is just inside the other button's nearest end.
        let toward: CGFloat = id == "back" ? 1 : -1
        let home = pagerSize / 2 + PieceLiquid.joined + pagerSize * PieceLiquid.homeScale / 2
        return Color.clear
            .frame(width: pagerSize, height: pagerSize)
            .overlay {
                if pagerBuds.contains(id) {
                    Button(action: action) {
                        Image(systemName: symbol)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(style.dayText)
                            .pieceBudContent(out: out)
                            .frame(width: pagerSize, height: pagerSize)
                            .pieceLiquid(.circle, tint: controlTint, interactive: false)
                            .contentShape(.circle)
                    }
                    .buttonStyle(LiquidPressStyle())
                    .disabled(!out)
                    .pieceBud(out: out, home: CGSize(width: toward * home, height: 0))
                    .accessibilityLabel(label)
                    .accessibilityHidden(!out)
                }
            }
            // The one that is out sits above, so one melting into it slips under it on the frosted glass before
            // iOS 26, which doesn't merge.
            .zIndex(out ? 1 : 0)
    }

    private var controlTint: Color? { style.control == .clear ? nil : style.control }
    private var bandTint: Color? { style.band == .clear ? nil : style.band }

    private func weekdayRow(_ math: DayMath) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(math.weekdaySymbols().enumerated()), id: \.offset) { _, symbol in
                Text(symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(style.mutedText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                    .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: Grid

    private func pager(months: [Date], current: Date, context: Context) -> some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(months, id: \.self) { month in
                    monthGrid(month, context)
                        .padding(.horizontal, inset)
                        .padding(.top, inset / 2)
                        .padding(.bottom, inset)
                        .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $page)
        .scrollDisabled(reduceMotion || !isEnabled)
        .frame(height: cellHeight * 6 + inset * 1.5)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { gridWidth = $0 - inset * 2 }
        // Out to the card's edges and into its padding, with each month inset to match: the glass's own shadow then
        // fades out before the pager clips it, and a month slides in from the card's edge.
        .padding(.horizontal, -inset)
        .padding(.top, -inset / 2)
        .padding(.bottom, -inset)
        .opacity(gridOpacity)
        // Reduce Motion: the pager stops sliding; a flick crossfades to the neighbouring month instead.
        .gesture(
            DragGesture(minimumDistance: 24, coordinateSpace: .global).onEnded { value in
                let dx = value.translation.width, flung = value.predictedEndTranslation.width
                // Past 50pt, or a short quick flick heading past 80pt, as the native pager would take it.
                let travel = abs(dx) > 50 ? dx : abs(flung) > 80 ? flung : 0
                guard travel != 0, abs(dx) > abs(value.translation.height) else { return }
                let forward = (travel < 0) != (layoutDirection == .rightToLeft)
                go(forward ? 1 : -1, months: months, current: current)
            },
            including: reduceMotion && isEnabled ? .all : .subviews
        )
    }

    private func monthGrid(_ month: Date, _ context: Context) -> some View {
        let cells = context.math.cells(for: month)
        let columns = context.math.columns
        return VStack(spacing: 0) {
            ForEach(0..<(cells.count / columns), id: \.self) { row in
                let days = Array(cells[row * columns ..< (row + 1) * columns])
                HStack(spacing: 0) {
                    ForEach(0..<columns, id: \.self) { column in
                        if let day = days[column] {
                            dayCell(day, context: context)
                        } else {
                            Color.clear
                                .frame(maxWidth: .infinity)
                                .frame(height: cellHeight)
                                .accessibilityHidden(true)
                        }
                    }
                }
                // The glass sits behind the day buttons, so a press never dims or dents it.
                .background { rowGlass(days, context: context) }
            }
        }
    }

    private func dayCell(_ day: Date, context: Context) -> some View {
        let math = context.math
        let inBounds = context.limits.map { $0.contains(day) } ?? true
        let blocked = inBounds && isDateDisabled(day)
        let available = inBounds && !blocked
        var inRange = false
        if let lower = context.lower, let upper = context.upper { inRange = day >= lower && day <= upper }
        let isStart = inRange && day == context.lower
        let isEnd = inRange && day == context.upper
        let isEndpoint = isStart || isEnd
        let flared = flare.map { $0.day == day && $0.phase == .lit } ?? false
        let outOfReach = available && context.pending.map { day > $0 } == true && context.reach.map { day > $0 } == true
        let isToday = day == context.today

        // Dark ink on tinted glass, which reads on red and butter alike.
        let textColor: Color = isEndpoint || flared ? style.ink : !available ? style.disabled : outOfReach ? style.mutedText.opacity(0.55) : style.dayText

        return Button { tap(day, context) } label: {
            ZStack {
                Text(math.dayNumber(day))
                    .font(.body.weight(.semibold))
                    .monospacedDigit()
                    .strikethrough(blocked, color: style.disabled)
                    .foregroundStyle(textColor)
                    // The ink turns with its bubble's tint, on the same springs, and days out of reach dim softly
                    // rather than all at once.
                    .animation(isEndpoint ? PieceLiquid.split(reduceMotion: reduceMotion) : PieceLiquid.home(reduceMotion: reduceMotion), value: isEndpoint)
                    .animation(flared ? motion.error : PieceLiquid.home(reduceMotion: reduceMotion), value: flared)
                    .animation(outOfReach ? motion.reveal : motion.dismiss, value: outOfReach)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility3)
                    .padding(.horizontal, 4)

                if isToday {
                    Circle()
                        .fill(isEndpoint ? style.ink : style.today)
                        .frame(width: 4, height: 4)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                        .padding(.bottom, cellHeight * 0.14)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: cellHeight)
            .contentShape(.rect)
        }
        .buttonStyle(DayTabStyle(day: day, refusals: refusals[day] ?? 0, onPress: pressChanged))
        .disabled(!available)
        .accessibilityLabel(isToday ? String(localized: "Today") + ", " + math.fullDate(day, today: context.today) : math.fullDate(day, today: context.today))
        .accessibilityValue(accessibilityValue(available: available, isStart: isStart, isEnd: isEnd, inRange: inRange, outOfReach: outOfReach))
        .accessibilityAddTraits(inRange ? .isSelected : [])
    }

    private func accessibilityValue(available: Bool, isStart: Bool, isEnd: Bool, inRange: Bool, outOfReach: Bool) -> String {
        if !available { return String(localized: "Unavailable") }
        if isStart && isEnd { return pending != nil ? String(localized: "Start date") : String(localized: "Start and end date") }
        if isStart { return String(localized: "Start date") }
        if isEnd { return String(localized: "End date") }
        if inRange { return String(localized: "In range") }
        if outOfReach { return String(localized: "Out of reach for this start date") }
        return ""
    }

    // MARK: Glass

    /// One week row's glass, behind its day numbers: its pieces of the band, the start and end bubbles, the bubble
    /// under the finger and a refused day's flare. Each row is its own liquid group, so rows sit too close to share
    /// one without the band in one week melting into the next; within a row the bubbles and the band join. No lift:
    /// the pager clips a shadow at its edges, and one under every row would cloud the grid.
    private func rowGlass(_ days: [Date?], context: Context) -> some View {
        let cell = gridWidth / CGFloat(max(days.count, 1))
        let size = max(min(cell, cellHeight) - 4, 0)
        return PieceLiquidGroup(lift: false) {
            ZStack(alignment: .leading) {
                if gridWidth > 0 {
                    ForEach(bands) { band in
                        if let part = piece(of: band, in: days, cell: cell, bubble: size, math: context.math) {
                            Color.clear
                                .pieceLiquid(.capsule, tint: bandTint, interactive: false)
                                .modifier(part)
                                .opacity(band.shown)
                        }
                    }
                    ForEach(buds.present, id: \.self) { id in
                        if let day = Self.day(for: id), let column = days.firstIndex(of: day) {
                            bubble(id, day: day, at: (CGFloat(column) + 0.5) * cell, size: size)
                        }
                    }
                    if let day = pressedDay, let column = days.firstIndex(of: day), !buds.isOut(Self.id(for: day)) {
                        // A touch presses a small clear bubble into the day: the start of the bubble a tap swells into.
                        Color.clear
                            .frame(width: size, height: size)
                            .pieceLiquid(.circle, interactive: false)
                            .pieceLiquidScale(reduceMotion ? 1 : PieceLiquid.homeScale)
                            .offset(x: (CGFloat(column) + 0.5) * cell - size / 2)
                            .transition(.opacity)
                    }
                    if let flare, let column = days.firstIndex(of: flare.day) {
                        flareBubble(flare, at: (CGFloat(column) + 0.5) * cell, size: size)
                    }
                }
            }
            .frame(width: max(gridWidth, 0), height: cellHeight, alignment: .leading)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// A start or end bubble, centred `x` from the row's leading edge. It swells out of the finger's press into red
    /// glass and, once its day stops being an endpoint, drains and shrinks away where it is. Pressed again it sinks.
    private func bubble(_ id: String, day: Date, at x: CGFloat, size: CGFloat) -> some View {
        let out = buds.isOut(id)
        let pressed = pressedDay == day && out
        return Color.clear
            .frame(width: size, height: size)
            // The red drains as it goes home, so the day's number never sits on fading red.
            .pieceLiquid(.circle, tint: out ? style.endpoint : nil, interactive: false)
            .pieceLiquidScale(pressed && !reduceMotion ? 0.92 : 1)
            .brightness(pressed && reduceMotion ? -0.08 : 0)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .pieceBud(out: out, home: .zero)
            // Its home is the day itself, with no glass to melt into, so it fades as it shrinks there.
            .opacity(out ? 1 : 0)
            .offset(x: x - size / 2)
    }

    private func flareBubble(_ flare: Flare, at x: CGFloat, size: CGFloat) -> some View {
        let lit = flare.phase == .lit
        return Color.clear
            .frame(width: size, height: size)
            .pieceLiquid(.circle, tint: lit ? style.error : nil, interactive: false)
            .pieceLiquidScale(lit || reduceMotion ? 1 : PieceLiquid.homeScale)
            // Under Reduce Motion it fades in where it rests, rather than swelling.
            .opacity(flare.phase == .gone || (flare.phase == .born && reduceMotion) ? 0 : 1)
            // Cell sized: the default 8pt is for a whole field. It shakes with the day's number.
            .pieceShake(trigger: refusals[flare.day] ?? 0, distance: 4)
            .offset(x: x - size / 2)
    }

    /// This row's piece of `band`: where the pen enters the row and where the piece rests. It stops a joined gap short
    /// of a start or end bubble in the row, so a neck joins them, and two points inside the row's edges elsewhere.
    /// `nil` when the band doesn't cross the row.
    private func piece(of band: Band, in days: [Date?], cell: CGFloat, bubble: CGFloat, math: DayMath) -> BandPiece? {
        let lower = band.range.lowerBound, upper = band.range.upperBound
        let inside = { (day: Date?) in day.map { $0 >= lower && $0 <= upper } ?? false }
        guard let first = days.firstIndex(where: inside), let last = days.lastIndex(where: inside),
              let firstDay = days[first], let lastDay = days[last] else { return nil }
        let edge: CGFloat = 2
        let lead = firstDay == lower ? (CGFloat(first) + 0.5) * cell + bubble / 2 + PieceLiquid.joined : CGFloat(first) * cell + edge
        let trail = lastDay == upper ? (CGFloat(last) + 0.5) * cell - bubble / 2 - PieceLiquid.joined : CGFloat(last + 1) * cell - edge
        guard trail - lead > 1 else { return nil }
        return BandPiece(
            ink: band.ink,
            days: Double(math.distance(lower, upper)),
            entry: Double(math.distance(lower, firstDay)) - 0.5,
            origin: CGFloat(first) * cell,
            lead: lead,
            trail: trail,
            cell: cell,
            thickness: (bubble * 0.76).rounded()
        )
    }

    // MARK: Selection

    private struct Context {
        let math: DayMath
        let today: Date
        let limits: ClosedRange<Date>?
        let lower: Date?
        let upper: Date?
        let pending: Date?
        /// Last day that can close the pending range; `nil` when nothing limits it nearby.
        let reach: Date?
    }

    private func makeContext(math: DayMath, today: Date, limits: ClosedRange<Date>?) -> Context {
        var lower: Date?, upper: Date?
        if let pending {
            lower = pending
            upper = pending
        } else if let selection {
            let a = math.day(selection.lowerBound), b = math.day(selection.upperBound)
            lower = min(a, b)
            upper = max(a, b)
        }
        let reach = pending.flatMap { reachLimit(from: $0, math: math, limits: limits) }
        return Context(math: math, today: today, limits: limits, lower: lower, upper: upper, pending: pending, reach: reach)
    }

    /// The days that carry a bubble: the start and the end, or the start alone while it waits for its end.
    private func endpoints(_ context: Context) -> [String] {
        guard let lower = context.lower else { return [] }
        let upper = context.upper ?? lower
        return lower == upper ? [Self.id(for: lower)] : [Self.id(for: lower), Self.id(for: upper)]
    }

    /// A start and a later end, with no start waiting for its end.
    private func closedRange(_ context: Context) -> ClosedRange<Date>? {
        guard context.pending == nil, let lower = context.lower, let upper = context.upper, lower < upper else { return nil }
        return lower...upper
    }

    private static func id(for day: Date) -> String { String(day.timeIntervalSinceReferenceDate) }
    private static func day(for id: String) -> Date? { Double(id).map(Date.init(timeIntervalSinceReferenceDate:)) }

    /// Sends home the bubbles that are leaving and out the ones arriving, at the same time.
    private func exchange(_ buds: PieceBuds, from old: [String], to new: [String]) {
        let leaving = old.filter { !new.contains($0) }, arriving = new.filter { !old.contains($0) }
        if !leaving.isEmpty { Task { await buds.gather(leaving, reduceMotion: reduceMotion) } }
        if !arriving.isEmpty { Task { await buds.bloom(arriving, reduceMotion: reduceMotion) } }
    }

    /// The band follows the closed range: a new range pours out of its start bubble and into its end, and a range
    /// that ends drains back into its start before it goes.
    private func redrawBand(from old: ClosedRange<Date>?, to new: ClosedRange<Date>?, math: DayMath) {
        for band in bands where band.range != new {
            let id = band.id
            withAnimation(PieceLiquid.home(reduceMotion: reduceMotion), completionCriteria: .removed) {
                guard let i = bands.firstIndex(where: { $0.id == id }) else { return }
                if reduceMotion { bands[i].shown = 0 } else { bands[i].ink = 0 }
            } completion: {
                // Gone only if nothing poured it back meanwhile.
                bands.removeAll { $0.id == id && ($0.ink == 0 || $0.shown == 0) }
            }
        }
        guard let new else { return }
        let id: Int
        if let again = bands.first(where: { $0.range == new }) {
            id = again.id
        } else {
            bandSerial += 1
            id = bandSerial
            var quiet = Transaction()
            quiet.disablesAnimations = true
            withTransaction(quiet) { bands.append(Band(id: id, range: new, ink: reduceMotion ? 1 : 0, shown: reduceMotion ? 0 : 1)) }
        }
        let days = math.distance(new.lowerBound, new.upperBound)
        Task {
            // A frame for the empty band to land, so the pen draws it rather than SwiftUI inserting it whole.
            try? await Task.sleep(for: .milliseconds(24))
            withAnimation(reduceMotion ? motion.reveal : stroke(days: days)) {
                guard let i = bands.firstIndex(where: { $0.id == id }) else { return }
                bands[i].ink = 1
                bands[i].shown = 1
            }
        }
    }

    /// The pen: it crosses the range in at most half a second, leaving the start bubble quickly and easing into the
    /// end one (it covers 1.5t - 0.5t^2 of the range by time t: half again the average pace off the start, half of it
    /// at the end). Linear in days, like a pen on its own clock, so the rows fill one after another as one edge.
    private func stroke(days: Int) -> Animation {
        .timingCurve(1 / 3, 1 / 2, 2 / 3, 5 / 6, duration: min(0.15 + 0.03 * Double(max(days, 1)), 0.5))
    }

    /// A finger on a day presses a small bubble into it, or sinks the bubble already there; lifting lets it go.
    private func pressChanged(_ day: Date, _ isPressed: Bool) {
        if isPressed {
            withAnimation(motion.press) { pressedDay = day }
        } else if pressedDay == day {
            withAnimation(buds.isOut(Self.id(for: day)) ? motion.release : motion.dismiss) { pressedDay = nil }
        }
    }

    /// A refused end day: the bubble under the finger swells into butter glass as the day shakes, holds for a beat,
    /// then drains and shrinks away. Under Reduce Motion it fades in and out where it is, and the day stays still.
    private func flare(_ day: Date) {
        let id = (flare?.id ?? 0) + 1
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { flare = Flare(day: day, id: id, phase: .born) }
        Task {
            // A frame for it to land, so it swells rather than appearing lit, and so its shake fires with the day's.
            try? await Task.sleep(for: .milliseconds(24))
            guard flare?.id == id else { return }
            refusals[day, default: 0] += 1
            withAnimation(motion.error) { flare?.phase = .lit }
            try? await Task.sleep(for: .milliseconds(480))
            guard flare?.id == id else { return }
            withAnimation(PieceLiquid.home(reduceMotion: reduceMotion)) { flare?.phase = .gone }
            try? await Task.sleep(for: .milliseconds(520))
            guard flare?.id == id else { return }
            withTransaction(quiet) { flare = nil }
        }
    }

    private func isAvailable(_ day: Date, _ limits: ClosedRange<Date>?) -> Bool {
        (limits.map { $0.contains(day) } ?? true) && !isDateDisabled(day)
    }

    private func length(from start: Date, to end: Date, _ math: DayMath) -> Int {
        let span = math.distance(start, end)
        return counting == .nights ? span : span + 1
    }

    /// Walks forward from the start until the maximum length or the first unavailable day stops it.
    private func reachLimit(from start: Date, math: DayMath, limits: ClosedRange<Date>?) -> Date? {
        var last = start
        for step in 0..<400 {
            let next = math.nextDay(last)
            let count = counting == .nights ? step + 1 : step + 2
            if let maximumLength, count > maximumLength { return last }
            if next <= last || !isAvailable(next, limits) { return last }
            last = next
        }
        return nil
    }

    private func refusal(from start: Date, to end: Date, _ math: DayMath, _ limits: ClosedRange<Date>?) -> Refusal? {
        if let maximumLength, length(from: start, to: end, math) > maximumLength { return .tooLong(maximumLength) }
        var day = start
        for _ in 0...max(math.distance(start, end), 0) {
            if !isAvailable(day, limits) { return .unavailable }
            day = math.nextDay(day)
        }
        return nil
    }

    private func tap(_ day: Date, _ context: Context) {
        guard isEnabled else { return }
        let math = context.math
        guard let start = pending else { return begin(day) }
        if day < start { return begin(day) }
        if day == start {
            pending = nil
            if counting == .days {
                chipPops = true
                clearNotice()
                successTick += 1
                announceRange(start...start, math, context.today)
            } else {
                tapTick += 1
            }
            return
        }
        if let refusal = refusal(from: start, to: day, math, context.limits) {
            // One beat: the error haptic, the butter flare and shake on the tapped day, and the notice.
            errorTick += 1
            flare(day)
            withAnimation(motion.error) { notice = Notice(id: (notice?.id ?? 0) + 1, refusal: refusal) }
            AccessibilityNotification.Announcement(message(for: refusal)).post()
            return
        }
        pending = nil
        write(start...day)
        // A notice left from a refused tap goes now, so the chip arrives on this beat, not when the notice expires.
        chipPops = true
        clearNotice()
        successTick += 1
        announceRange(start...day, math, context.today)
    }

    private func begin(_ day: Date) {
        pending = day
        write(counting == .days ? day...day : nil)
        chipPops = false
        clearNotice()
        tapTick += 1
    }

    private func clearNotice() {
        if notice != nil { withAnimation(motion.dismiss) { notice = nil } }
    }

    private func write(_ range: ClosedRange<Date>?) {
        lastWritten = range
        selection = range
    }

    private func announceRange(_ range: ClosedRange<Date>, _ math: DayMath, _ today: Date) {
        let text = math.interval(range, today: today) + ", " + lengthText(length(from: range.lowerBound, to: range.upperBound, math))
        AccessibilityNotification.Announcement(text).post()
    }

    private func go(_ delta: Int, months: [Date], current: Date) {
        guard let i = months.firstIndex(of: current), months.indices.contains(i + delta) else { return }
        let target = months[i + delta]
        if reduceMotion {
            withAnimation(motion.dismiss) { gridOpacity = 0 } completion: {
                page = target
                withAnimation(motion.reveal) { gridOpacity = 1 }
            }
        } else {
            withAnimation(motion.snap) { page = target }
        }
    }

    // MARK: Text

    private func lengthText(_ count: Int) -> String {
        let text = counting == .nights
            ? AttributedString(localized: "^[\(count) night](inflect: true)", locale: locale)
            : AttributedString(localized: "^[\(count) day](inflect: true)", locale: locale)
        return String(text.characters)
    }

    private func message(for refusal: Refusal) -> String {
        switch refusal {
        case .unavailable:
            return String(localized: "Includes unavailable dates")
        case .tooLong(let limit):
            return String(localized: "Up to") + " " + lengthText(limit)
        }
    }
}

/// A day's button. It tells the picker when a finger is on the day, which presses a glass bubble into it, and shakes
/// the day's number once for each refused end tap on it. The glass itself is drawn behind the row.
private struct DayTabStyle: ButtonStyle {
    let day: Date
    /// Refused end taps on this day so far. Each new one shakes once.
    let refusals: Int
    let onPress: @MainActor (Date, Bool) -> Void

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            // Cell sized: the default 8pt is for a whole field.
            .pieceShake(trigger: refusals, distance: 4)
            .onChange(of: configuration.isPressed) { _, pressed in onPress(day, pressed) }
    }
}

/// The press for a glass control: it sinks about `depth` points a side and springs back through rest, the glass and
/// what it carries together. It scales through `pieceLiquidScale`, never a scaleEffect, which would shrink only the
/// glass's outline. Under Reduce Motion it shades instead, darker in light mode and lighter in dark.
private struct LiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.modifier(LiquidPress(pressed: configuration.isPressed, depth: depth))
    }
}

private struct LiquidPress: ViewModifier {
    let pressed: Bool
    var depth: CGFloat = 2.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .pieceLiquidScale(pressed && !reduceMotion ? PieceMotion.pressScale(for: size, depth: depth) : 1)
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .animation(pressed ? motion.press : motion.release, value: pressed)
    }
}

/// A glass chip arriving on its own, with nothing to bud from: it grows from `scale` as it fades in, and leaves the
/// same way. The glass scales through `pieceLiquidScale`, never a scaleEffect, which would shrink only its outline.
/// Under Reduce Motion it only fades.
private struct LiquidRise: Transition {
    var scale: CGFloat
    /// How far it slides in from, toward the trailing edge.
    var shift: CGFloat = 0
    var reduceMotion: Bool

    func body(content: Content, phase: TransitionPhase) -> some View {
        let still = phase.isIdentity || reduceMotion
        return content
            .pieceLiquidScale(still ? 1 : scale)
            .offset(x: still ? 0 : shift)
            .opacity(phase.isIdentity ? 1 : 0)
    }
}

/// One week row's piece of the band, drawn up to where the pen has reached. Rows fill one after another as the pen
/// crosses them, so the band pours out of the start bubble, along each week and into the end bubble, and drains
/// back the same way. Built from the pen's progress, so one animation drives every row in step.
private struct BandPiece: ViewModifier, Animatable {
    /// How much of the range the pen has drawn, from 0 to 1.
    var ink: Double
    /// The range's length in days, start center to end center.
    let days: Double
    /// Where the pen is, in days from the start, as it crosses the row's first cell's leading edge.
    let entry: Double
    /// That edge, and where the piece rests, in points from the row's leading edge.
    let origin: CGFloat
    let lead: CGFloat
    let trail: CGFloat
    let cell: CGFloat
    let thickness: CGFloat

    // SwiftUI interpolates this off the main actor.
    nonisolated var animatableData: Double {
        get { ink }
        set { ink = newValue }
    }

    func body(content: Content) -> some View {
        let pen = origin + CGFloat(ink * days - entry) * cell
        let width = max(min(trail, pen) - lead, 0)
        // A drop that lengthens into the band: as tall as it is long until it reaches the band's thickness.
        return content
            .frame(width: width, height: min(thickness, width))
            .offset(x: lead)
    }
}

/// Calendar arithmetic and formatting, all through `Calendar` so non-Gregorian calendars, custom week starts and DST days stay correct.
private struct DayMath {
    let calendar: Calendar
    let locale: Locale

    init(calendar: Calendar, locale: Locale, timeZone: TimeZone) {
        var calendar = calendar
        calendar.locale = locale
        calendar.timeZone = timeZone
        self.calendar = calendar
        self.locale = locale
    }

    /// Days per week as the calendar defines it.
    var columns: Int { max(calendar.maximumRange(of: .weekday)?.count ?? 7, 1) }

    func day(_ date: Date) -> Date { calendar.startOfDay(for: date) }

    /// Never adds 86,400 seconds: a DST day is 23 or 25 hours long.
    func nextDay(_ date: Date) -> Date { day(calendar.date(byAdding: .day, value: 1, to: date) ?? date) }

    func monthStart(_ date: Date) -> Date { calendar.dateInterval(of: .month, for: date)?.start ?? day(date) }

    func addingMonths(_ count: Int, to date: Date) -> Date {
        monthStart(calendar.date(byAdding: .month, value: count, to: monthStart(date)) ?? date)
    }

    /// Whole calendar days from `a` to `b`. Counted on civil dates rather than elapsed time, so a day whose start
    /// is 01:00 (midnight DST jumps) or that lasts 23 or 25 hours still counts as exactly one.
    func distance(_ a: Date, _ b: Date) -> Int {
        var local = Calendar(identifier: .gregorian)
        local.timeZone = calendar.timeZone
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        let fields: Set<Calendar.Component> = [.era, .year, .month, .day]
        guard let x = utc.date(from: local.dateComponents(fields, from: a)), let y = utc.date(from: local.dateComponents(fields, from: b)) else { return 0 }
        return utc.dateComponents([.day], from: x, to: y).day ?? 0
    }

    func normalized(_ bounds: ClosedRange<Date>?) -> ClosedRange<Date>? {
        guard let bounds else { return nil }
        let a = day(bounds.lowerBound), b = day(bounds.upperBound)
        return min(a, b)...max(a, b)
    }

    func initialMonth(selection: ClosedRange<Date>?, bounds: ClosedRange<Date>?, today: Date) -> Date {
        var anchor = selection.map { day($0.lowerBound) } ?? today
        if let bounds { anchor = min(max(anchor, bounds.lowerBound), bounds.upperBound) }
        return monthStart(anchor)
    }

    /// Every pageable month: the bounds' months, or five years either side of today (stretched to reach the selection).
    func months(bounds: ClosedRange<Date>?, today: Date, including anchor: Date?) -> [Date] {
        var first: Date, last: Date
        if let bounds {
            first = monthStart(bounds.lowerBound)
            last = monthStart(bounds.upperBound)
        } else {
            first = addingMonths(-60, to: today)
            last = addingMonths(60, to: today)
            if let anchor {
                first = min(first, monthStart(anchor))
                last = max(last, monthStart(anchor))
            }
        }
        var result = [first]
        var current = first
        while current < last && result.count < 2400 {
            let next = addingMonths(1, to: current)
            guard next > current else { break }
            result.append(next)
            current = next
        }
        return result
    }

    /// The month laid out in week rows from `firstWeekday`, padded with `nil` to at least six full rows.
    func cells(for month: Date) -> [Date?] {
        let first = monthStart(month)
        let count = calendar.range(of: .day, in: .month, for: first)?.count ?? 30
        let columns = columns
        let lead = ((calendar.component(.weekday, from: first) - calendar.firstWeekday) % columns + columns) % columns
        var cells: [Date?] = Array(repeating: nil, count: lead)
        var date = first
        for _ in 0..<count {
            cells.append(date)
            date = nextDay(date)
        }
        let rows = max(6, (cells.count + columns - 1) / columns)
        cells += Array(repeating: nil, count: rows * columns - cells.count)
        return cells
    }

    func weekdaySymbols() -> [String] {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        guard !symbols.isEmpty else { return [] }
        let offset = calendar.firstWeekday - 1
        return (0..<symbols.count).map { symbols[(($0 + offset) % symbols.count + symbols.count) % symbols.count] }
    }

    private var format: Date.FormatStyle {
        Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone, capitalizationContext: .standalone)
    }

    private func sameYear(_ a: Date, _ b: Date) -> Bool {
        calendar.isDate(a, equalTo: b, toGranularity: .year)
    }

    func dayNumber(_ date: Date) -> String { date.formatted(format.day()) }

    func monthTitle(_ date: Date) -> String { date.formatted(format.month(.wide).year()) }

    func fullDate(_ date: Date, today: Date) -> String {
        let style = format.weekday(.wide).month(.wide).day()
        return date.formatted(sameYear(date, today) ? style : style.year())
    }

    func short(_ date: Date, today: Date) -> String {
        let style = format.month(.abbreviated).day()
        return date.formatted(sameYear(date, today) ? style : style.year())
    }

    /// "Mar 4 – 9", "Mar 28 – Apr 2", "Dec 30, 2026 – Jan 3, 2027", in the locale's own interval pattern.
    func interval(_ range: ClosedRange<Date>, today: Date) -> String {
        guard range.lowerBound < range.upperBound else { return short(range.lowerBound, today: today) }
        var style = Date.IntervalFormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day()
        if !sameYear(range.lowerBound, today) || !sameYear(range.lowerBound, range.upperBound) { style = style.year() }
        return style.format(range.lowerBound..<range.upperBound)
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// A stay picker: bookable for the next eleven months, a few sold-out nights, and at most 14 nights.
private struct DateRangePickerExample: View {
    @State private var stay: ClosedRange<Date>?
    private let calendar = Calendar.current
    private let soldOut: Set<Date>
    private let window: ClosedRange<Date>

    init() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        func day(_ offset: Int) -> Date { calendar.startOfDay(for: calendar.date(byAdding: .day, value: offset, to: today) ?? today) }
        soldOut = Set([6, 7, 15, 23].map(day))
        window = today...(calendar.date(byAdding: .month, value: 11, to: today) ?? today)
        _stay = State(initialValue: day(1)...day(4))
    }

    var body: some View {
        DateRangePicker(selection: $stay, in: window, isDateDisabled: { soldOut.contains(calendar.startOfDay(for: $0)) }, maximumLength: 14, counting: .nights)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    DateRangePickerExample()
}

#Preview("Dark") {
    DateRangePickerExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, shake)

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
// swiftpieces-liquid: 1.7.0 (liquid, bud, morphText)

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

/// The bud: how a bubble leaves and rejoins its parent, driven explicitly so every bubble shows the whole cycle.
///
/// A bubble is born at `home`, inside its parent, where the two glass shapes are one. It springs out to `rest`, and
/// while it is inside the merge distance a neck holds it to the parent, thinning as it goes, until it snaps free.
/// Going home it springs back on a spring with no bounce, the neck reaches out and re-forms, and only once it has
/// melted all the way in is it removed. Both offsets are relative to where the bubble is laid out. Under Reduce
/// Motion it stays at `rest`: its content fades and its glass closes in place.
private struct PieceBud: ViewModifier {
    var out: Bool
    var rest: CGSize
    var home: CGSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            // No travel. Inside a group glass ignores opacity, so the glass closes to nothing in place on the short
            // Reduce Motion ease while its content fades; the opacity covers a bubble outside a group.
            content
                .pieceLiquidScale(out ? 1 : 0.001)
                .opacity(out ? 1 : 0)
                .offset(rest)
        } else {
            // The glass shrinks through `pieceLiquidScale`, never a plain scaleEffect (see there), then moves.
            content
                .pieceLiquidScale(out ? 1 : PieceLiquid.homeScale)
                .offset(out ? rest : home)
        }
    }
}

/// A bubble's own content, on its own clock: gone the moment the bubble heads home, so it never rides over the
/// parent's content, and arriving just after the bubble leaves.
private struct PieceBudContent: ViewModifier {
    var out: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: out ? 0 : 6)
            .opacity(out ? 1 : 0)
            .animation(out ? .easeOut(duration: 0.3).delay(0.1) : .easeOut(duration: 0.14), value: out)
    }
}

private extension View {
    /// Places a bubble at `rest` while `out`, and at `home` (inside its parent, shrunk) while not.
    func pieceBud(out: Bool, rest: CGSize = .zero, home: CGSize) -> some View {
        modifier(PieceBud(out: out, rest: rest, home: home))
    }

    /// Hides a bubble's icon or label while it is home. Put it on the content, inside the glass.
    func pieceBudContent(out: Bool) -> some View {
        modifier(PieceBudContent(out: out))
    }
}

/// Which bubbles exist and which are out. A bubble is added home with no animation, sent out on the next frame,
/// and called home before it is removed, so it always melts in rather than fading. Keep one in `@State`.
@MainActor @Observable
private final class PieceBuds {
    private(set) var present: [String] = []
    private(set) var out: Set<String> = []
    /// The latest call for each bubble. A bloom or gather that has been overtaken (a bubble sent home while it was
    /// still waiting to go out, or called out again while melting) leaves that bubble alone.
    @ObservationIgnored private var turn: [String: Int] = [:]

    func contains(_ id: String) -> Bool { present.contains(id) }
    func isOut(_ id: String) -> Bool { out.contains(id) }

    private func claim(_ ids: [String]) -> [String: Int] {
        var mine: [String: Int] = [:]
        for id in ids {
            let next = (turn[id] ?? 0) + 1
            turn[id] = next
            mine[id] = next
        }
        return mine
    }

    /// Puts bubbles straight out at rest with no motion: a view's first frame, or a state restored.
    func place(_ ids: [String]) {
        _ = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
            out.formUnion(ids)
        }
    }

    /// Adds bubbles home, then sends each out, `stagger` seconds apart, after an optional `delay`.
    func bloom(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.05, delay: Double = 0) async {
        let mine = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
        }
        try? await Task.sleep(for: .milliseconds(24 + Int(max(delay, 0) * 1000)))
        let split = PieceLiquid.split(reduceMotion: reduceMotion)
        for (i, id) in ids.enumerated() where turn[id] == mine[id] {
            withAnimation(split.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.insert(id) }
        }
    }

    /// Calls bubbles home, last first, then removes them once they have melted in.
    func gather(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.04) async {
        let mine = claim(ids)
        let home = PieceLiquid.home(reduceMotion: reduceMotion)
        for (i, id) in ids.reversed().enumerated() {
            withAnimation(home.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.remove(id) }
        }
        try? await Task.sleep(for: .milliseconds(Int((0.52 + Double(ids.count) * stagger) * 1000)))
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { present.removeAll { ids.contains($0) && !out.contains($0) && turn[$0] == mine[$0] } }
    }
}

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
