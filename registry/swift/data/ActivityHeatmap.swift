// swiftpieces:
// title: Activity Heatmap
// description: "A streak calendar for habit, fitness, study and journaling apps: weeks of days drawn in one Canvas as rounded cells in solid steps from a pale red mix up to pure red, laid out by the locale's first weekday with month labels on their week columns, a light streak numeral that stays alive until midnight beside the longest run and active days, a scrub that lifts the day under your finger with a callout and a haptic tick per day, sideways scrolling that opens on today when the weeks outgrow the width, and VoiceOver that steps day by day or plays the weeks as an audio graph."
// category: data
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// pro: lens-tab-bar
// tags: [heatmap, streak, calendar, habits, activity, contributions, scrub, accessibility]

import Accessibility
import SwiftUI
import UIKit

/// A calendar heatmap of daily activity with the current streak, a scrub callout and full VoiceOver support.
///
/// Columns are weeks, oldest leading and newest trailing, and rows are weekdays in the calendar's order, so
/// Monday-first regions get Monday on top. Each day is one rounded cell: level 0 is an empty field and levels
/// 1 to 4 are solid steps of the accent mixed into the ground, up to the pure accent. Drag sideways across the
/// grid, or press and move, to read any day, and tap to select one; vertical swipes still scroll the screen.
/// When the weeks outgrow the width the grid scrolls sideways and a short hold starts the reading instead.
/// The cells are drawn in one `Canvas` and hit-tested by geometry, so a year of days stays light.
///
/// - Parameters:
///   - counts: Activity per day, such as sessions, minutes or entries. Each key is placed on the day it falls on in `calendar` (its time zone), so exact timestamps work and several on one day add up. Zero, negative and non-finite values count as no activity. Days outside the visible weeks are ignored, except that a current streak which began earlier is counted in full. `[Date: Int]` works too.
///   - weeks: How many week columns to show. Defaults to 20. Cells grow to fill the width up to `Style.maximumCellSize`; when they would fall below `Style.minimumCellSize` the grid scrolls sideways and opens on the newest week.
///   - endDate: The last day shown; later days in its week are left out. `nil` (the default) is today, and the grid moves on by itself at midnight.
///   - calendar: The calendar for days, weeks and the first weekday. `nil` (the default) uses the environment's calendar, which is the person's own.
///   - levels: How values map to the four shades. `.automatic` splits the non-zero days in view into quartiles. `.thresholds([1, 3, 6, 10])` sets the minimum for each level, and its first value is also what counts as an active day for streaks.
///   - showsSummary: Shows the current streak, the longest streak and the number of active days above the grid.
///   - selection: The selected day, as the start of that day. Tapping a day selects it and tapping it again clears it; with a binding, a scrub moves it live and release keeps it. Without a binding, a scrub shows the callout only while the finger is down. Setting it from outside selects that day and scrolls it into view.
///   - messages: Built-in copy. Defaults are localizable through your String Catalog; replace any line, for example `title` with "Workouts".
///   - style: Colors and cell metrics. Defaults to the Swift Pieces house palette with a red accent, adapting to light and dark.
///   - valueLabel: How a day's value reads in the callout and to VoiceOver, for example minutes formatted as a `Measurement`. Defaults to the plain number. Days with no activity read `messages.noActivity`.
public struct ActivityHeatmap: View {

    // MARK: Public types

    /// How day values map to the four shades.
    public enum Levels: Sendable, Hashable {
        /// Splits the non-zero days in view into quartiles; the busiest day always takes the top shade. Any non-zero day is active.
        case automatic
        /// Ascending minimum values, one per level, up to four (extra values are ignored). A day that reaches the first value is active and counts toward streaks. Fewer than four values spread over the shades, so `.thresholds([1])` draws a done or not done habit in the full accent.
        case thresholds([Double])
    }

    /// The streak figures the summary shows. Use `ActivityHeatmap.summary(of:)` to read them anywhere else, such as a widget.
    public struct Summary: Sendable, Hashable {
        /// Consecutive active days ending on the last day shown (today by default). While today has nothing yet the streak ends yesterday instead, so it stays alive until midnight.
        public var currentStreak: Int
        /// The longest run of active days in the visible weeks, never shorter than the current streak.
        public var longestStreak: Int
        /// Active days in the visible weeks.
        public var activeDays: Int
        /// Whether the last day shown is already active. `false` while a streak is still waiting on today.
        public var isLastDayActive: Bool

        public init(currentStreak: Int = 0, longestStreak: Int = 0, activeDays: Int = 0, isLastDayActive: Bool = false) {
            self.currentStreak = currentStreak
            self.longestStreak = longestStreak
            self.activeDays = activeDays
            self.isLastDayActive = isLastDayActive
        }
    }

    /// The heatmap's copy. Every default goes through `String(localized:)`, so it can be translated in your
    /// String Catalog, and any line can be replaced: `.init(title: "Workouts")`.
    public struct Messages: Sendable {
        /// What is tracked. VoiceOver reads it first ("Activity, last 20 weeks") and it names the audio graph.
        public var title: String
        /// The summary label above the current streak.
        public var currentStreak: String
        /// The label of the longest streak figure.
        public var longestStreak: String
        /// The label of the active days figure.
        public var activeDays: String
        /// Shown in place of the streak while nothing in view is active.
        public var empty: String
        /// A day without activity, in the callout and to VoiceOver.
        public var noActivity: String
        /// Names today in the callout and to VoiceOver.
        public var today: String
        /// The low end of the legend.
        public var less: String
        /// The high end of the legend.
        public var more: String
        /// VoiceOver action that moves the selection back a week.
        public var previousWeek: String
        /// VoiceOver action that moves the selection on a week.
        public var nextWeek: String
        /// The day axis of the audio graph.
        public var dayAxis: String

        /// Pass only the lines you want to change.
        public init(
            title: String = String(localized: "Activity", comment: "Activity heatmap: what is tracked, read first by VoiceOver"),
            currentStreak: String = String(localized: "Current streak", comment: "Activity heatmap summary label above the current streak"),
            longestStreak: String = String(localized: "Longest", comment: "Activity heatmap summary label of the longest streak"),
            activeDays: String = String(localized: "Active", comment: "Activity heatmap summary label of the number of active days, as in Active 86 days"),
            empty: String = String(localized: "No activity yet", comment: "Activity heatmap summary while nothing is active"),
            noActivity: String = String(localized: "No activity", comment: "Activity heatmap value of a day without activity"),
            today: String = String(localized: "Today", comment: "Activity heatmap name for today"),
            less: String = String(localized: "Less", comment: "Activity heatmap legend, low end"),
            more: String = String(localized: "More", comment: "Activity heatmap legend, high end"),
            previousWeek: String = String(localized: "Previous week", comment: "Activity heatmap VoiceOver action"),
            nextWeek: String = String(localized: "Next week", comment: "Activity heatmap VoiceOver action"),
            dayAxis: String = String(localized: "Day", comment: "Activity heatmap audio graph axis")
        ) {
            self.title = title
            self.currentStreak = currentStreak
            self.longestStreak = longestStreak
            self.activeDays = activeDays
            self.empty = empty
            self.noActivity = noActivity
            self.today = today
            self.less = less
            self.more = more
            self.previousWeek = previousWeek
            self.nextWeek = nextWeek
            self.dayAxis = dayAxis
        }

        public static var standard: Messages { Messages() }
    }

    /// Colors and cell metrics. `.standard` is the house palette with the red accent.
    public struct Style: Sendable, Equatable {
        /// The top level, the streak glyph and the color the lower levels are mixed from.
        public var accent: Color
        /// What the lower levels blend into: solid mixes of the accent, never transparency. Set it to the surface the heatmap sits on.
        public var ground: Color
        /// Level 0, a day without activity.
        public var empty: Color
        /// The streak numeral, figures and the ring around today.
        public var text: Color
        /// Labels, units and the legend.
        public var secondary: Color
        /// The callout above a selected day.
        public var callout: Color
        /// Text on the callout.
        public var calloutText: Color
        /// Cell corner radius.
        public var cornerRadius: CGFloat
        /// Gap between cells.
        public var spacing: CGFloat
        /// The smallest cell before the grid scrolls sideways instead of shrinking.
        public var minimumCellSize: CGFloat
        /// The largest cell when there is room to spare.
        public var maximumCellSize: CGFloat
        /// The streak numeral size in points; it scales with Dynamic Type.
        public var numeralSize: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(accent: Color? = nil, ground: Color? = nil, empty: Color? = nil, text: Color? = nil, secondary: Color? = nil, callout: Color? = nil, calloutText: Color? = nil, cornerRadius: CGFloat = 4, spacing: CGFloat = 3, minimumCellSize: CGFloat = 13, maximumCellSize: CGFloat = 24, numeralSize: CGFloat = 44) {
            self.accent = accent ?? HeatmapPalette.red
            self.ground = ground ?? HeatmapPalette.ground
            self.empty = empty ?? HeatmapPalette.field
            self.text = text ?? HeatmapPalette.text
            self.secondary = secondary ?? HeatmapPalette.secondary
            self.callout = callout ?? HeatmapPalette.text
            self.calloutText = calloutText ?? HeatmapPalette.calloutText
            self.cornerRadius = max(cornerRadius, 0)
            self.spacing = max(spacing, 0)
            self.minimumCellSize = max(minimumCellSize, 6)
            self.maximumCellSize = max(maximumCellSize, self.minimumCellSize)
            self.numeralSize = numeralSize
        }

        public static let standard = Style()

        /// The fill of a level, from 0 (empty) to 4 (the accent), for your own legends and day details.
        public func fill(level: Int) -> Color {
            switch min(max(level, 0), 4) {
            case 0: empty
            case 4: accent
            case let step: HeatmapPalette.mix(accent, into: ground, step: step)
            }
        }
    }

    /// The figures the summary shows for these counts, computed the same way as the heatmap.
    /// - Parameters:
    ///   - counts: Activity per day, as you pass it to the heatmap.
    ///   - weeks: The visible weeks, which bound the longest streak and the active days.
    ///   - endDate: The last day; `nil` is today.
    ///   - calendar: The calendar for days and weeks.
    ///   - levels: The level rule, whose first threshold decides what counts as active.
    public static func summary(of counts: [Date: Double], weeks: Int = 20, endDate: Date? = nil, calendar: Calendar = .autoupdatingCurrent, levels: Levels = .automatic) -> Summary {
        HeatmapModel(counts: counts, weeks: weeks, endDate: endDate, now: Date(), calendar: calendar, levels: levels, locale: nil).summary
    }

    // MARK: State

    @Environment(\.calendar) private var environmentCalendar
    @Environment(\.locale) private var locale
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.displayScale) private var displayScale
    @Environment(\.redactionReasons) private var redactionReasons
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .largeTitle) private var numeralScale: CGFloat = 1
    @ScaledMetric(relativeTo: .body) private var unitScale: CGFloat = 17
    @ScaledMetric(relativeTo: .caption) private var metaScale: CGFloat = 12
    @ScaledMetric(relativeTo: .caption2) private var axisScale: CGFloat = 11
    @ScaledMetric(relativeTo: .subheadline) private var calloutScale: CGFloat = 15

    /// Derived days, levels and streaks, rebuilt only when an input changes, never on a scrub step.
    @State private var cache = HeatmapCache()
    /// Today. Refreshed at midnight and on time zone or clock changes, so the grid and the streak move on.
    @State private var now = Date()
    @State private var internalSelection: Date?
    /// The day under the finger during an unbound scrub.
    @State private var scrubIndex: Int?
    @State private var touch: HeatmapTouch?
    @State private var touchIndex: Int?
    @State private var touchCommit: Int?
    /// Bumped with the Canvas position only while a day is shown, so scrolling without a selection never
    /// re-runs `body`; the position itself lives in the cache.
    @State private var placement: HeatmapPlacement?
    @State private var viewport: CGRect?
    @State private var entrance: Date?
    @State private var didEnter = false
    @State private var pops: [Int: Date] = [:]
    @State private var popTick = 0
    @State private var scrollTarget = HeatmapScrollTarget()
    @State private var hapticTick = 0
    @State private var holdTick = 0

    private let counts: [Date: Double]
    private let weeks: Int
    private let endDate: Date?
    private let calendarOverride: Calendar?
    private let levels: Levels
    private let showsSummary: Bool
    private let selectionBinding: Binding<Date?>?
    private let messages: Messages
    private let style: Style
    private let valueLabel: (Double) -> String

    public init(
        _ counts: [Date: Double],
        weeks: Int = 20,
        endDate: Date? = nil,
        calendar: Calendar? = nil,
        levels: Levels = .automatic,
        showsSummary: Bool = true,
        selection: Binding<Date?>? = nil,
        messages: Messages = .standard,
        style: Style = .standard,
        valueLabel: @escaping (Double) -> String = { $0.formatted(.number.precision(.fractionLength(0...1))) }
    ) {
        self.counts = counts
        self.weeks = min(max(weeks, 1), HeatmapModel.maximumWeeks)
        self.endDate = endDate
        self.calendarOverride = calendar
        self.levels = levels
        self.showsSummary = showsSummary
        self.selectionBinding = selection
        self.messages = messages
        self.style = style
        self.valueLabel = valueLabel
    }

    /// Whole-number counts, such as sessions or entries.
    public init<Count: BinaryInteger>(
        _ counts: [Date: Count],
        weeks: Int = 20,
        endDate: Date? = nil,
        calendar: Calendar? = nil,
        levels: Levels = .automatic,
        showsSummary: Bool = true,
        selection: Binding<Date?>? = nil,
        messages: Messages = .standard,
        style: Style = .standard,
        valueLabel: @escaping (Double) -> String = { $0.formatted(.number.precision(.fractionLength(0...1))) }
    ) {
        self.init(counts.mapValues { Double($0) }, weeks: weeks, endDate: endDate, calendar: calendar, levels: levels, showsSummary: showsSummary, selection: selection, messages: messages, style: style, valueLabel: valueLabel)
    }

    // MARK: Sizes

    private var axisSize: CGFloat { min(axisScale, 16) }
    private var metaSize: CGFloat { min(metaScale, 20) }
    private var calloutMetaSize: CGFloat { min(axisScale, 16) }
    private var calloutValueSize: CGFloat { min(calloutScale, 24) }
    /// The month label row above the cells.
    private var headerHeight: CGFloat { ceil(axisSize * 1.3) + 6 }
    private var isRTL: Bool { layoutDirection == .rightToLeft }

    // MARK: Body

    public var body: some View {
        let calendar = calendarOverride ?? environmentCalendar
        let model = cache.model(for: HeatmapModel.Key(counts: counts, weeks: weeks, endDate: endDate, now: now, calendar: calendar, levels: levels, locale: locale))
        let committed = committedIndex(in: model)
        let selected = scrubIndex ?? committed
        let redacted = redactionReasons.contains(.placeholder)
        let summary = model.summary

        VStack(alignment: .leading, spacing: 18) {
            if showsSummary {
                summaryHeader(summary, hasActivity: summary.activeDays > 0 || summary.currentStreak > 0)
            }
            VStack(alignment: .trailing, spacing: 10) {
                grid(model: model, selected: selected, redacted: redacted)
                legend(steps: model.steps, redacted: redacted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel(model))
        .accessibilityValue(selected.map { spokenDay($0, in: model) } ?? "")
        .accessibilityAdjustableAction { direction in move(direction == .increment ? 1 : -1, in: model) }
        .accessibilityAction(named: messages.previousWeek) { move(-7, in: model) }
        .accessibilityAction(named: messages.nextWeek) { move(7, in: model) }
        .accessibilityAction(.escape) { commit(nil, in: model) }
        .accessibilityChartDescriptor(HeatmapChart(model: model, title: messages.title, summary: summarySentence(summary), dayAxis: messages.dayAxis, noActivity: messages.noActivity, dateStyle: dateStyle(calendar, wide: true), rightToLeft: isRTL, valueLabel: valueLabel))
        .focusable(isEnabled)
        .focusEffectDisabled()
        .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow, .escape]) { press in
            switch press.key {
            case .leftArrow: move(isRTL ? 7 : -7, in: model)
            case .rightArrow: move(isRTL ? -7 : 7, in: model)
            case .upArrow: move(-1, in: model)
            case .downArrow: move(1, in: model)
            default: commit(nil, in: model)
            }
            return .handled
        }
        .onAppear {
            now = Date()
            guard !didEnter else { return }
            didEnter = true
            if !reduceMotion { entrance = Date() }
        }
        // The wave runs once, about a second; this clears it so the Canvas stops redrawing every frame.
        .task(id: entrance) {
            guard entrance != nil else { return }
            try? await Task.sleep(for: .milliseconds(1050))
            if !Task.isCancelled { entrance = nil }
        }
        .onChange(of: model.valueSignature) { old, new in popChanged(old, new, lastIndex: model.lastIndex) }
        .task(id: popTick) {
            guard popTick > 0 else { return }
            try? await Task.sleep(for: .milliseconds(520))
            if !Task.isCancelled { pops = [:] }
        }
        // A selection set from outside (a binding, VoiceOver, the keyboard) scrolls into view; a touch is already there.
        .onChange(of: committed) { _, index in
            guard let index, touch == nil, index != touchCommit else { return }
            scrollTarget = HeatmapScrollTarget(column: index / 7, tick: scrollTarget.tick + 1)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in now = Date() }
        .sensoryFeedback(.selection, trigger: hapticTick)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: holdTick)
    }

    // MARK: Summary

    /// The streak on the leading side and the two figures beside it; they stack when text is large.
    private func summaryHeader(_ summary: Summary, hasActivity: Bool) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .lastTextBaseline, spacing: 16) {
                streakBlock(summary, hasActivity: hasActivity)
                Spacer(minLength: 0)
                if hasActivity { figures(summary) }
            }
            VStack(alignment: .leading, spacing: 12) {
                streakBlock(summary, hasActivity: hasActivity)
                if hasActivity { figures(summary) }
            }
        }
    }

    private func streakBlock(_ summary: Summary, hasActivity: Bool) -> some View {
        let alive = summary.currentStreak > 0
        return VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 5) {
                Image(systemName: alive ? "flame.fill" : "flame")
                    .font(.system(size: metaSize, weight: .bold))
                    .foregroundStyle(alive && !redactionReasons.contains(.placeholder) ? style.accent : style.secondary)
                    .contentTransition(.symbolEffect(.replace))
                    .symbolEffect(.bounce, value: reduceMotion ? 0 : summary.currentStreak)
                Text(messages.currentStreak.uppercased(with: locale))
                    .font(.system(size: metaSize, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(style.secondary)
                    .lineLimit(1)
            }
            if hasActivity {
                streakNumeral(summary.currentStreak)
            } else {
                Text(messages.empty)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(style.secondary)
                    .padding(.top, 6)
            }
        }
    }

    /// "12 days" from the system's duration formatter, so the unit is right in every language, with the
    /// number set as the light display numeral and the unit small beside it.
    private func streakNumeral(_ days: Int) -> some View {
        var text = Duration.seconds(Double(days) * 86_400).formatted(Duration.UnitsFormatStyle(allowedUnits: [.days], width: .wide).locale(locale).attributed)
        var hasNumber = false
        for run in text.runs {
            if run.measurement == .value {
                hasNumber = true
                text[run.range].swiftUI.font = .system(size: style.numeralSize * numeralScale, weight: .light)
                text[run.range].swiftUI.foregroundColor = style.text
            } else {
                text[run.range].swiftUI.font = .system(size: unitScale, weight: .semibold)
                text[run.range].swiftUI.foregroundColor = style.secondary
            }
        }
        if !hasNumber {
            // A language that spells out one day without a figure still gets the numeral.
            var number = AttributedString(days.formatted(.number.locale(locale)) + " ")
            number.swiftUI.font = .system(size: style.numeralSize * numeralScale, weight: .light)
            number.swiftUI.foregroundColor = style.text
            text = number + text
        }
        return Text(text)
            .tracking(-style.numeralSize * 0.02)
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(days)))
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .snappy(duration: 0.45), value: days)
    }

    /// Longest streak and active days as a two-row table, figures right-aligned.
    private func figures(_ summary: Summary) -> some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 5) {
            figure(messages.longestStreak, days: summary.longestStreak)
            figure(messages.activeDays, days: summary.activeDays)
        }
        .lineLimit(1)
    }

    private func figure(_ label: String, days: Int) -> some View {
        GridRow(alignment: .lastTextBaseline) {
            Text(label.uppercased(with: locale))
                .font(.system(size: metaSize, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(style.secondary)
            Text(dayCount(days))
                .font(.system(size: unitScale, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(style.text)
                .gridColumnAlignment(.trailing)
                .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(days)))
                .animation(.snappy(duration: 0.4), value: days)
        }
    }

    private func dayCount(_ days: Int) -> String {
        Duration.seconds(Double(days) * 86_400).formatted(Duration.UnitsFormatStyle(allowedUnits: [.days], width: .wide).locale(locale))
    }

    // MARK: Grid

    /// The weekday labels and the cells. The section runs left to right internally and mirrors itself for
    /// right-to-left languages, so the Canvas, its hit-testing and the callout share one coordinate space.
    private func grid(model: HeatmapModel, selected: Int?, redacted: Bool) -> some View {
        let rtl = isRTL
        let header = headerHeight
        return HeatmapGridLayout(weeks: model.weeks, style: style, header: header, scale: displayScale, labelSpacing: 7, rtl: rtl) {
            ForEach(model.rowLabels) { label in
                Text(label.text.uppercased(with: locale))
                    .font(.system(size: axisSize, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(style.secondary)
                    .lineLimit(1)
                    .fixedSize()
                    .layoutValue(key: HeatmapRowKey.self, value: label.row)
            }
            GeometryReader { proxy in
                cells(model: model, width: proxy.size.width, header: header, rtl: rtl, redacted: redacted, tracksPlacement: selected != nil)
            }
        }
        .overlay(alignment: .topLeading) {
            selectionLayer(model: model, selected: selected, rtl: rtl, redacted: redacted)
                .animation(reduceMotion ? .easeInOut(duration: 0.15) : .smooth(duration: 0.18), value: selected == nil)
        }
        .coordinateSpace(.named(HeatmapSpace.grid))
        .environment(\.layoutDirection, .leftToRight)
    }

    @ViewBuilder
    private func cells(model: HeatmapModel, width: CGFloat, header: CGFloat, rtl: Bool, redacted: Bool, tracksPlacement: Bool) -> some View {
        let metrics = HeatmapMetrics(available: width, weeks: model.weeks, style: style, header: header, scale: displayScale)
        // The Canvas bleeds past its layout frame by up to the cell gap, so today's ring is never clipped at
        // an edge, and a scroll view resting on whole weeks never shows a sliver of the next one.
        let bleed = min(HeatmapCells.bleed, metrics.gap)
        if metrics.scrolls {
            ScrollViewReader { reader in
                ScrollView(.horizontal) {
                    HeatmapCells(model: model, metrics: metrics, originX: 0, rtl: rtl, bleed: bleed, style: style, axisSize: axisSize, locale: locale, entrance: entrance, pops: pops, redacted: redacted)
                        .equatable()
                        .frame(width: metrics.gridWidth + bleed * 2, height: metrics.height + bleed * 2)
                        .padding(-bleed)
                        .background(alignment: .topLeading) { scrollAnchors(metrics, rtl: rtl) }
                        .overlay { touchSurface(model: model, metrics: metrics, originX: 0, rtl: rtl) }
                        .onGeometryChange(for: HeatmapPlacement.self) { proxy in
                            HeatmapPlacement(canvas: proxy.frame(in: .named(HeatmapSpace.grid)), metrics: metrics, originX: 0)
                        } action: { next in
                            cache.placement = next
                            if tracksPlacement { placement = next }
                        }
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                // Comes to rest on whole weeks, opening on the newest.
                .scrollTargetBehavior(.viewAligned(limitBehavior: .never))
                .defaultScrollAnchor(rtl ? .leading : .trailing)
                // On the newest side the scroll view reaches past the grid by the bleed, with a matching margin,
                // so the newest week lines up with a fitted grid and today's ring has room.
                .contentMargins([rtl ? .leading : .trailing, .bottom], bleed, for: .scrollContent)
                .frame(width: metrics.viewportWidth + bleed, height: metrics.height + bleed)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(HeatmapSpace.grid)) } action: { viewport = $0 }
                .onChange(of: scrollTarget) { _, target in
                    guard let column = target.column else { return }
                    withAnimation(reduceMotion ? nil : .smooth(duration: 0.35)) { reader.scrollTo(column, anchor: .center) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: rtl ? .topTrailing : .topLeading)
                .padding(EdgeInsets(top: 0, leading: rtl ? -bleed : 0, bottom: -bleed, trailing: rtl ? 0 : -bleed))
            }
        } else {
            // Cells capped at their largest size leave room to spare: the grid keeps to the leading side.
            let originX = rtl ? max(width - metrics.gridWidth, 0) : 0
            HeatmapCells(model: model, metrics: metrics, originX: originX, rtl: rtl, bleed: bleed, style: style, axisSize: axisSize, locale: locale, entrance: entrance, pops: pops, redacted: redacted)
                .equatable()
                .frame(width: width + bleed * 2, height: metrics.height + bleed * 2)
                .padding(-bleed)
                .overlay { touchSurface(model: model, metrics: metrics, originX: originX, rtl: rtl) }
                .onGeometryChange(for: HeatmapPlacement.self) { proxy in
                    HeatmapPlacement(canvas: proxy.frame(in: .named(HeatmapSpace.grid)), metrics: metrics, originX: originX)
                } action: { next in
                    cache.placement = next
                    placement = next
                    viewport = nil
                }
        }
    }

    /// Touches over the cells. When the grid fits, a horizontal drag scrubs at once and a short press reads
    /// a day, while vertical swipes still scroll the screen or move a sheet. When it scrolls, sideways swipes
    /// belong to the scroll view and a quarter-second hold arms the scrub.
    private func touchSurface(model: HeatmapModel, metrics: HeatmapMetrics, originX: CGFloat, rtl: Bool) -> some View {
        HeatmapTouchSurface(pressDuration: metrics.scrolls ? 0.25 : 0.12, dragScrubs: !metrics.scrolls, isEnabled: isEnabled) { event in
            handle(event, model: model, metrics: metrics, originX: originX, rtl: rtl)
        }
        .accessibilityHidden(true)
    }

    /// One invisible anchor per week under the Canvas, so `ScrollViewReader` can bring a column into view.
    private func scrollAnchors(_ metrics: HeatmapMetrics, rtl: Bool) -> some View {
        HStack(spacing: metrics.gap) {
            ForEach(0..<metrics.weeks, id: \.self) { visual in
                Color.clear
                    .frame(width: metrics.cell, height: 1)
                    .id(rtl ? metrics.weeks - 1 - visual : visual)
            }
        }
        .scrollTargetLayout()
        .accessibilityHidden(true)
    }

    // MARK: Selection layer

    /// The lifted cell and its callout, above the grid and outside any scroll view, so neither is clipped.
    @ViewBuilder
    private func selectionLayer(model: HeatmapModel, selected: Int?, rtl: Bool, redacted: Bool) -> some View {
        if let index = selected, model.isPresent(index), let placement = cache.placement ?? placement, !redacted {
            let metrics = placement.metrics
            let rect = metrics.rect(index: index, originX: placement.originX, rtl: rtl).offsetBy(dx: placement.canvas.minX, dy: placement.canvas.minY)
            let center = CGPoint(x: rect.midX, y: rect.midY)
            if viewport.map({ $0.insetBy(dx: -2, dy: -2).contains(center) }) ?? true {
                GeometryReader { proxy in
                    let bounds = proxy.size
                    // How far the lifted cell reaches past its own edges.
                    let lift = (metrics.cell + HeatmapLiftedCell.edge * 2) * ((reduceMotion ? 1.12 : 1.32) - 1) / 2 + HeatmapLiftedCell.edge
                    let calloutHeight = ceil(calloutMetaSize * 1.25 + calloutValueSize * 1.3 + 17)
                    let above = rect.minY - lift - 9 - calloutHeight >= (showsSummary ? -60 : 0)
                    let nubX = min(max(rect.midX, 14), max(bounds.width - 14, 14))
                    // Each piece is an overlay of the same empty frame, so the callout reaching above the
                    // grid never moves the others.
                    Color.clear
                        .overlay(alignment: .topLeading) {
                            HeatmapLiftedCell(fill: style.fill(level: max(model.levels[index], 0)), ground: style.ground, size: metrics.cell, radius: metrics.radius, reduceMotion: reduceMotion)
                                .offset(x: rect.minX - HeatmapLiftedCell.edge, y: rect.minY - HeatmapLiftedCell.edge)
                        }
                        .overlay(alignment: .topLeading) {
                            HeatmapNub(pointsDown: above)
                                .fill(style.callout)
                                .frame(width: 12, height: 6)
                                .offset(x: nubX - 6, y: above ? rect.minY - lift - 9 : rect.maxY + lift + 3)
                        }
                        .overlay(alignment: .topLeading) {
                            callout(index: index, model: model)
                                .alignmentGuide(.leading) { d in
                                    -min(max(rect.midX - d.width / 2, 0), max(bounds.width - d.width, 0))
                                }
                                .alignmentGuide(.top) { d in
                                    above ? -(rect.minY - lift - 9 - d.height + 0.5) : -(rect.maxY + lift + 9 - 0.5)
                                }
                        }
                        .animation(reduceMotion ? nil : .snappy(duration: 0.16), value: index)
                }
                .allowsHitTesting(false)
                .transition(.opacity)
            }
        }
    }

    private func callout(index: Int, model: HeatmapModel) -> some View {
        let level = max(model.levels[index], 0)
        return VStack(alignment: .leading, spacing: 3) {
            Text(calloutDate(index, in: model))
                .font(.system(size: calloutMetaSize, weight: .semibold))
                .tracking(0.6)
                .opacity(0.68)
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(style.fill(level: level))
                    .frame(width: 10, height: 10)
                Text(valueText(index, in: model))
                    .font(.system(size: calloutValueSize, weight: .semibold))
                    .monospacedDigit()
            }
        }
        .lineLimit(1)
        .fixedSize()
        // The callout glides from day to day; its text swaps at once, so a fast scrub never ghosts.
        .contentTransition(.identity)
        .foregroundStyle(style.calloutText)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(style.callout, in: .rect(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
    }

    // MARK: Legend

    private func legend(steps: [Int], redacted: Bool) -> some View {
        let swatch = max(round(axisSize * 0.95), 9)
        return HStack(spacing: 6) {
            Text(messages.less.uppercased(with: locale))
            HStack(spacing: 3) {
                ForEach(steps, id: \.self) { step in
                    RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                        .fill(redacted ? style.empty : style.fill(level: step))
                        .frame(width: swatch, height: swatch)
                }
            }
            Text(messages.more.uppercased(with: locale))
        }
        .font(.system(size: axisSize, weight: .semibold))
        .tracking(0.6)
        .foregroundStyle(style.secondary)
        .lineLimit(1)
        .accessibilityHidden(true)
    }

    // MARK: Touch

    /// One handler for the touch surface. A scrub starts from a horizontal drag (when the grid fits) or a
    /// short press, then follows the finger; release keeps the day when bound and clears it otherwise.
    private func handle(_ event: HeatmapTouchEvent, model: HeatmapModel, metrics: HeatmapMetrics, originX: CGFloat, rtl: Bool) {
        switch event {
        case .began(let point, let pressed):
            touch = HeatmapTouch(start: point, moved: !pressed)
            if pressed, metrics.scrolls { holdTick += 1 }
            track(point, model: model, metrics: metrics, originX: originX, rtl: rtl)
        case .moved(let point):
            if let start = touch?.start, hypot(point.x - start.x, point.y - start.y) > 6 { touch?.moved = true }
            track(point, model: model, metrics: metrics, originX: originX, rtl: rtl)
        case .ended(let point):
            finish(at: point, model: model, metrics: metrics, originX: originX, rtl: rtl)
        case .cancelled:
            resetTouch()
        case .tapped(let point):
            tapped(at: point, model: model, metrics: metrics, originX: originX, rtl: rtl)
        }
    }

    private func track(_ location: CGPoint, model: HeatmapModel, metrics: HeatmapMetrics, originX: CGFloat, rtl: Bool) {
        guard model.lastIndex >= 0 else { return }
        // Past today (the future part of the last week) the scrub stays on the last day.
        let index = min(metrics.index(at: location, originX: originX, rtl: rtl), model.lastIndex)
        guard index != touchIndex else { return }
        touchIndex = index
        hapticTick += 1
        if selectionBinding != nil {
            touchCommit = index
            commit(index, in: model)
        } else {
            scrubIndex = index
        }
    }

    private func finish(at location: CGPoint, model: HeatmapModel, metrics: HeatmapMetrics, originX: CGFloat, rtl: Bool) {
        guard let touch else { return }
        defer { resetTouch() }
        if !touch.moved {
            // A press held still and released reads like a tap but never clears the day it was reading.
            select(metrics.cellIndex(at: location, originX: originX, rtl: rtl), wasSelected: nil, model: model)
        } else if selectionBinding == nil {
            commit(nil, in: model)
        }
    }

    private func tapped(at location: CGPoint, model: HeatmapModel, metrics: HeatmapMetrics, originX: CGFloat, rtl: Bool) {
        let hit = metrics.cellIndex(at: location, originX: originX, rtl: rtl)
        if let hit, model.isPresent(hit) { hapticTick += 1 }
        select(hit, wasSelected: committedIndex(in: model), model: model)
        resetTouch()
    }

    /// A tap selects the day under it, clears it when it was already selected, and clears on an empty spot.
    private func select(_ hit: Int?, wasSelected: Int?, model: HeatmapModel) {
        guard let hit, model.isPresent(hit) else { return commit(nil, in: model) }
        touchCommit = hit == wasSelected ? nil : hit
        commit(hit == wasSelected ? nil : hit, in: model)
    }

    private func resetTouch() {
        touch = nil
        touchIndex = nil
        scrubIndex = nil
    }

    // MARK: Selection

    private func committedIndex(in model: HeatmapModel) -> Int? {
        let date = selectionBinding.map { $0.wrappedValue } ?? internalSelection
        return date.flatMap { model.index(of: $0) }
    }

    private func commit(_ index: Int?, in model: HeatmapModel) {
        let date = index.flatMap { model.isPresent($0) ? model.days[$0] : nil }
        if let selectionBinding {
            if selectionBinding.wrappedValue != date { selectionBinding.wrappedValue = date }
        } else {
            internalSelection = date
        }
    }

    /// VoiceOver and the keyboard: the first move lands on the last day, then steps by days or weeks.
    private func move(_ delta: Int, in model: HeatmapModel) {
        guard model.lastIndex >= 0 else { return }
        let next = committedIndex(in: model).map { min(max($0 + delta, 0), model.lastIndex) } ?? model.lastIndex
        commit(next, in: model)
        scrollTarget = HeatmapScrollTarget(column: next / 7, tick: scrollTarget.tick + 1)
    }

    // MARK: Motion

    /// Days whose value changed get a pop; a whole new dataset waves in again instead.
    private func popChanged(_ old: HeatmapModel.ValueSignature, _ new: HeatmapModel.ValueSignature, lastIndex: Int) {
        guard !reduceMotion, entrance == nil, old.firstDay == new.firstDay, old.values.count == new.values.count else { return }
        let changed = new.values.indices.filter { $0 <= lastIndex && new.values[$0] != old.values[$0] }
        guard !changed.isEmpty else { return }
        if changed.count > 21 {
            entrance = Date()
            return
        }
        let start = Date()
        for index in changed { pops[index] = start }
        popTick += 1
    }

    // MARK: Copy

    private func dateStyle(_ calendar: Calendar, wide: Bool) -> Date.FormatStyle {
        let base = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone)
        return wide ? base.weekday(.wide).month(.wide).day() : base.weekday(.abbreviated).month(.abbreviated).day()
    }

    private func calloutDate(_ index: Int, in model: HeatmapModel) -> String {
        if index == model.todayIndex { return messages.today.uppercased(with: locale) }
        let day = model.days[index]
        var format = dateStyle(model.calendar, wide: false)
        if model.calendar.component(.year, from: day) != model.calendar.component(.year, from: model.today) { format = format.year() }
        return day.formatted(format).uppercased(with: locale)
    }

    private func valueText(_ index: Int, in model: HeatmapModel) -> String {
        let value = model.values[index]
        return value > 0 ? valueLabel(value) : messages.noActivity
    }

    /// "Today, Wednesday, October 1, 45 min" for VoiceOver.
    private func spokenDay(_ index: Int, in model: HeatmapModel) -> String {
        let day = model.days[index]
        var format = dateStyle(model.calendar, wide: true)
        if model.calendar.component(.year, from: day) != model.calendar.component(.year, from: model.today) { format = format.year() }
        var date = day.formatted(format)
        if index == model.todayIndex {
            date = String(localized: "\(messages.today), \(date)", comment: "Activity heatmap: today followed by its date")
        }
        return String(localized: "\(date), \(valueText(index, in: model))", comment: "Activity heatmap VoiceOver value: a day and its activity")
    }

    private func accessibilityLabel(_ model: HeatmapModel) -> String {
        let range = String(AttributedString(localized: "\(messages.title), last ^[\(model.weeks) week](inflect: true)", comment: "Activity heatmap VoiceOver label, as in Activity, last 20 weeks").characters)
        return showsSummary || model.summary.activeDays > 0 ? "\(range). \(summarySentence(model.summary))" : range
    }

    private func summarySentence(_ summary: Summary) -> String {
        guard summary.activeDays > 0 || summary.currentStreak > 0 else { return messages.empty }
        return String(AttributedString(localized: "\(messages.currentStreak) ^[\(summary.currentStreak) day](inflect: true). \(messages.longestStreak) ^[\(summary.longestStreak) day](inflect: true). \(messages.activeDays) ^[\(summary.activeDays) day](inflect: true).", comment: "Activity heatmap VoiceOver summary, as in Current streak 12 days. Longest 31 days. Active 86 days.").characters)
    }
}

// MARK: - Model

/// Everything derived from the inputs: the days in grid order (column major, seven per week), their
/// values and levels, labels and streaks.
private struct HeatmapModel: Equatable, Sendable {
    static let maximumWeeks = 530

    struct Key: Equatable {
        var counts: [Date: Double]
        var weeks: Int
        var endDate: Date?
        var now: Date
        var calendar: Calendar
        var levels: ActivityHeatmap.Levels
        var locale: Locale
    }

    struct MonthLabel: Equatable, Sendable {
        var column: Int
        var text: String
        /// The partial month in the first column; it gives way to a real month start that crowds it.
        var isLead: Bool
    }

    struct RowLabel: Identifiable, Equatable, Sendable {
        var row: Int
        var text: String
        var id: Int { row }
    }

    struct ValueSignature: Equatable {
        var firstDay: Date?
        var values: [Double]
    }

    var revision = 0
    let weeks: Int
    let calendar: Calendar
    let today: Date
    /// Start of each day, `weeks * 7` of them.
    let days: [Date]
    /// Each day's value; 0 for days after the last one shown.
    let values: [Double]
    /// Each day's shade, 0 to 4, or -1 for a day after the last one shown.
    let levels: [Int]
    /// The last day shown (the end date or today, whichever is earlier); -1 when every day is ahead.
    let lastIndex: Int
    let todayIndex: Int?
    let monthLabels: [MonthLabel]
    let rowLabels: [RowLabel]
    let summary: ActivityHeatmap.Summary
    /// The shades in use, for the legend.
    let steps: [Int]
    private let lookup: [Date: Int]

    init(_ key: Key) {
        self.init(counts: key.counts, weeks: key.weeks, endDate: key.endDate, now: key.now, calendar: key.calendar, levels: key.levels, locale: key.locale)
    }

    init(counts: [Date: Double], weeks: Int, endDate: Date?, now: Date, calendar: Calendar, levels: ActivityHeatmap.Levels, locale: Locale?) {
        let weeks = min(max(weeks, 1), Self.maximumWeeks)
        let today = calendar.startOfDay(for: now)
        let endDay = calendar.startOfDay(for: endDate ?? now)
        self.weeks = weeks
        self.calendar = calendar
        self.today = today

        var byDay: [Date: Double] = [:]
        byDay.reserveCapacity(counts.count)
        for (date, value) in counts where value.isFinite && value > 0 {
            byDay[calendar.startOfDay(for: date), default: 0] += value
        }

        // The last column is the week holding the end date, in the calendar's own week (its first weekday).
        let back = (calendar.component(.weekday, from: endDay) - calendar.firstWeekday + 7) % 7
        let first = Self.day(endDay, plus: -(back + (weeks - 1) * 7), calendar)
        // Stepping from noon never lands on a missing or doubled hour, so DST days come out right.
        let noon = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: first) ?? first
        let total = weeks * 7
        var days: [Date] = []
        days.reserveCapacity(total)
        for offset in 0..<total {
            let date = calendar.date(byAdding: .day, value: offset, to: noon) ?? noon.addingTimeInterval(Double(offset) * 86_400)
            days.append(calendar.startOfDay(for: date))
        }
        let limit = min(endDay, today)
        let lastIndex = days.lastIndex { $0 <= limit } ?? -1
        self.days = days
        self.lastIndex = lastIndex

        var values = [Double](repeating: 0, count: total)
        var lookup: [Date: Int] = [:]
        if lastIndex >= 0 {
            lookup.reserveCapacity(lastIndex + 1)
            for index in 0...lastIndex {
                values[index] = byDay[days[index]] ?? 0
                lookup[days[index]] = index
            }
        }
        self.values = values
        self.lookup = lookup
        self.todayIndex = lookup[today]

        let rule = HeatmapRule(levels, values: values.prefix(lastIndex + 1))
        var shades = [Int](repeating: -1, count: total)
        var active = 0
        var run = 0
        var longest = 0
        if lastIndex >= 0 {
            for index in 0...lastIndex {
                shades[index] = rule.step(values[index])
                if rule.isActive(values[index]) {
                    active += 1
                    run += 1
                    longest = max(longest, run)
                } else {
                    run = 0
                }
            }
        }
        self.levels = shades
        self.steps = rule.steps

        // The current streak looks back through every day in the data, so one that began before the first
        // visible week is counted in full. Today without activity yet does not break it.
        let lastActive = rule.isActive(byDay[limit] ?? 0)
        var cursor = limit == today && !lastActive ? Self.day(limit, plus: -1, calendar) : limit
        var current = 0
        while current < 100_000, rule.isActive(byDay[cursor] ?? 0) {
            current += 1
            cursor = Self.day(cursor, plus: -1, calendar)
        }
        self.summary = ActivityHeatmap.Summary(currentStreak: current, longestStreak: max(longest, current), activeDays: active, isLastDayActive: lastActive)

        var monthLabels: [MonthLabel] = []
        var rowLabels: [RowLabel] = []
        if let locale, lastIndex >= 0 {
            let month = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated)
            for column in 0..<weeks {
                for row in 0..<7 {
                    let index = column * 7 + row
                    guard index <= lastIndex else { break }
                    if calendar.component(.day, from: days[index]) == 1 {
                        monthLabels.append(MonthLabel(column: column, text: days[index].formatted(month), isLead: false))
                        break
                    }
                }
            }
            if monthLabels.first?.column != 0 {
                monthLabels.insert(MonthLabel(column: 0, text: days[0].formatted(month), isLead: true), at: 0)
            }
            // Monday, Wednesday and Friday, which fall on every other row whatever the first weekday.
            let weekday = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).weekday(.abbreviated)
            for row in 0..<7 where [2, 4, 6].contains(calendar.component(.weekday, from: days[row])) {
                rowLabels.append(RowLabel(row: row, text: days[row].formatted(weekday)))
            }
        }
        self.monthLabels = monthLabels
        self.rowLabels = rowLabels
    }

    func index(of date: Date) -> Int? { lookup[calendar.startOfDay(for: date)] }
    func isPresent(_ index: Int) -> Bool { index >= 0 && index <= lastIndex }
    var valueSignature: ValueSignature { ValueSignature(firstDay: days.first, values: values) }

    static func day(_ day: Date, plus offset: Int, _ calendar: Calendar) -> Date {
        let noon = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: day) ?? day
        let moved = calendar.date(byAdding: .day, value: offset, to: noon) ?? noon.addingTimeInterval(Double(offset) * 86_400)
        return calendar.startOfDay(for: moved)
    }

    /// The cache bumps `revision` on every rebuild, so comparing models is one integer.
    static func == (a: HeatmapModel, b: HeatmapModel) -> Bool { a.revision == b.revision }
}

/// Maps values to shades and decides what counts as an active day.
private struct HeatmapRule {
    private var cuts: [Double] = []
    private var top: Double = 0
    private var thresholds: [Double] = []

    init(_ levels: ActivityHeatmap.Levels, values: some Collection<Double>) {
        if case .thresholds(let list) = levels {
            let clean = list.filter { $0.isFinite && $0 > 0 }.sorted().prefix(4)
            if !clean.isEmpty {
                thresholds = Array(clean)
                return
            }
        }
        let sorted = values.filter { $0 > 0 }.sorted()
        guard let last = sorted.last else { return }
        top = last
        cuts = [0.25, 0.5, 0.75].map { Self.quantile(sorted, $0) }
    }

    func isActive(_ value: Double) -> Bool {
        guard value > 0 else { return false }
        return value >= (thresholds.first ?? 0)
    }

    func step(_ value: Double) -> Int {
        guard value > 0 else { return 0 }
        if !thresholds.isEmpty {
            let reached = thresholds.filter { value >= $0 }.count
            return reached == 0 ? 0 : Self.spread(reached, of: thresholds.count)
        }
        guard cuts.count == 3, value < top else { return 4 }
        if value <= cuts[0] { return 1 }
        if value <= cuts[1] { return 2 }
        return value <= cuts[2] ? 3 : 4
    }

    var steps: [Int] {
        guard !thresholds.isEmpty else { return [0, 1, 2, 3, 4] }
        var out = [0]
        for reached in 1...thresholds.count {
            let step = Self.spread(reached, of: thresholds.count)
            if !out.contains(step) { out.append(step) }
        }
        return out
    }

    /// Fewer than four thresholds spread over the four shades, ending on the accent.
    private static func spread(_ reached: Int, of count: Int) -> Int {
        min(max(Int((Double(reached) * 4 / Double(max(count, 1))).rounded(.up)), 1), 4)
    }

    private static func quantile(_ sorted: [Double], _ p: Double) -> Double {
        let position = Double(sorted.count - 1) * p
        let low = Int(position.rounded(.down))
        let high = min(low + 1, sorted.count - 1)
        return sorted[low] + (sorted[high] - sorted[low]) * (position - Double(low))
    }
}

/// Keeps the last model, so a scrub step (which re-runs `body`) never recomputes days and levels, and the
/// Canvas position.
@MainActor
private final class HeatmapCache {
    /// Where the Canvas last sat, kept here so scrolling does not have to touch view state.
    var placement: HeatmapPlacement?
    private var key: HeatmapModel.Key?
    private var model: HeatmapModel?
    private var revision = 0

    nonisolated init() {}

    func model(for key: HeatmapModel.Key) -> HeatmapModel {
        if let model, self.key == key { return model }
        revision += 1
        var next = HeatmapModel(key)
        next.revision = revision
        self.key = key
        model = next
        return next
    }
}

// MARK: - Geometry

private enum HeatmapSpace {
    static let grid = "ActivityHeatmap.grid"
}

/// Cell size and positions for a width. The layout and the Canvas both use it, so they always agree.
private struct HeatmapMetrics: Equatable, Sendable {
    var weeks: Int
    var cell: CGFloat
    var gap: CGFloat
    var header: CGFloat
    var radius: CGFloat
    var scrolls: Bool
    /// Weeks in view at once: all of them when the grid fits, a whole number of them when it scrolls.
    var visibleWeeks: Int

    var stride: CGFloat { cell + gap }
    var gridWidth: CGFloat { CGFloat(weeks) * stride - gap }
    var viewportWidth: CGFloat { CGFloat(visibleWeeks) * stride - gap }
    var height: CGFloat { header + 7 * stride - gap }

    init(available: CGFloat, weeks: Int, style: ActivityHeatmap.Style, header: CGFloat, scale: CGFloat) {
        let weeks = max(weeks, 1)
        let gap = style.spacing
        let fit = (available - CGFloat(weeks - 1) * gap) / CGFloat(weeks)
        // Whole pixels, so cell edges stay crisp.
        let snap = { (value: CGFloat) in scale > 0 ? (value * scale).rounded(.down) / scale : value }
        let cell: CGFloat
        if !fit.isFinite {
            cell = style.maximumCellSize
            scrolls = false
            visibleWeeks = weeks
        } else if fit >= style.minimumCellSize {
            cell = snap(min(fit, style.maximumCellSize))
            scrolls = false
            visibleWeeks = weeks
        } else {
            // Too many weeks for the width: as many whole weeks as fit at the smallest size or larger, so no
            // column is ever cut at an edge, and the rest scroll.
            let columns = max(Int((available + gap) / (style.minimumCellSize + gap)), 1)
            cell = max(snap((available + gap) / CGFloat(columns) - gap), style.minimumCellSize)
            scrolls = true
            visibleWeeks = min(columns, weeks)
        }
        self.weeks = weeks
        self.cell = cell
        self.gap = gap
        self.header = header
        self.radius = min(style.cornerRadius, cell / 2)
    }

    func x(column: Int, originX: CGFloat, rtl: Bool) -> CGFloat {
        originX + CGFloat(rtl ? weeks - 1 - column : column) * stride
    }

    func rect(index: Int, originX: CGFloat, rtl: Bool) -> CGRect {
        CGRect(x: x(column: index / 7, originX: originX, rtl: rtl), y: header + CGFloat(index % 7) * stride, width: cell, height: cell)
    }

    /// The day under a point, clamped into the grid, for scrubbing.
    func index(at point: CGPoint, originX: CGFloat, rtl: Bool) -> Int {
        let visual = min(max(Int(((point.x - originX + gap / 2) / stride).rounded(.down)), 0), weeks - 1)
        let row = min(max(Int(((point.y - header + gap / 2) / stride).rounded(.down)), 0), 6)
        return (rtl ? weeks - 1 - visual : visual) * 7 + row
    }

    /// The day under a point, or `nil` outside the cells, for taps.
    func cellIndex(at point: CGPoint, originX: CGFloat, rtl: Bool) -> Int? {
        let slack = gap / 2 + 2
        guard point.x >= originX - slack, point.x <= originX + gridWidth + slack, point.y >= header - slack, point.y <= height + slack else { return nil }
        return index(at: point, originX: originX, rtl: rtl)
    }
}

/// Where the Canvas sits in the grid section, and the metrics it was drawn with.
private struct HeatmapPlacement: Equatable, Sendable {
    var canvas: CGRect
    var metrics: HeatmapMetrics
    var originX: CGFloat
}

private struct HeatmapTouch {
    var start: CGPoint
    var moved: Bool
}

private struct HeatmapScrollTarget: Equatable {
    var column: Int?
    var tick = 0
}

private struct HeatmapRowKey: LayoutValueKey {
    static let defaultValue = -1
}

/// Weekday labels on the leading side and the cells beside them. The height follows from the width (the
/// cell size), and while the cells are capped the section hugs them, so the legend lines up with the grid.
private struct HeatmapGridLayout: Layout {
    var weeks: Int
    var style: ActivityHeatmap.Style
    var header: CGFloat
    var scale: CGFloat
    var labelSpacing: CGFloat
    var rtl: Bool

    private func lead(_ subviews: Subviews) -> CGFloat {
        var widest: CGFloat = 0
        for subview in subviews where subview[HeatmapRowKey.self] >= 0 {
            widest = max(widest, subview.sizeThatFits(.unspecified).width)
        }
        return widest > 0 ? ceil(widest) + labelSpacing : 0
    }

    private func metrics(_ available: CGFloat) -> HeatmapMetrics {
        HeatmapMetrics(available: available, weeks: weeks, style: style, header: header, scale: scale)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let lead = lead(subviews)
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? lead + metrics(.infinity).gridWidth
        let m = metrics(max(width - lead, 0))
        return CGSize(width: min(width, lead + m.viewportWidth), height: m.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let lead = lead(subviews)
        let m = metrics(max(bounds.width - lead, 0))
        for subview in subviews {
            let row = subview[HeatmapRowKey.self]
            if row >= 0 {
                let y = bounds.minY + m.header + CGFloat(row) * m.stride + m.cell / 2
                subview.place(at: CGPoint(x: rtl ? bounds.maxX : bounds.minX, y: y), anchor: rtl ? .trailing : .leading, proposal: .unspecified)
            } else {
                subview.place(at: CGPoint(x: rtl ? bounds.minX : bounds.minX + lead, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: max(bounds.width - lead, 0), height: m.height))
            }
        }
    }
}

// MARK: - Touch surface

private enum HeatmapTouchEvent {
    /// A scrub begins: from a press held still (`pressed`) or from a horizontal drag.
    case began(CGPoint, pressed: Bool)
    case moved(CGPoint)
    case ended(CGPoint)
    case cancelled
    case tapped(CGPoint)
}

/// UIKit recognizers over the cells, because SwiftUI has no hold-then-drag that leaves an enclosing scroll
/// view free to scroll: any drag gesture there claims the touch. A long press (which keeps reporting the
/// finger after it fires) and a horizontal-only pan fail as soon as a swipe is meant for a scroll view or a
/// sheet, and then that swipe goes through untouched.
private struct HeatmapTouchSurface: UIViewRepresentable {
    var pressDuration: TimeInterval
    var dragScrubs: Bool
    var isEnabled: Bool
    var onEvent: (HeatmapTouchEvent) -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        view.isAccessibilityElement = false
        view.accessibilityElementsHidden = true
        let coordinator = context.coordinator
        let press = UILongPressGestureRecognizer(target: coordinator, action: #selector(Coordinator.scrub(_:)))
        press.allowableMovement = 10
        let pan = UIPanGestureRecognizer(target: coordinator, action: #selector(Coordinator.scrub(_:)))
        pan.delegate = coordinator
        let tap = UITapGestureRecognizer(target: coordinator, action: #selector(Coordinator.tap(_:)))
        for recognizer in [press, pan, tap] { view.addGestureRecognizer(recognizer) }
        coordinator.press = press
        coordinator.pan = pan
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {
        let coordinator = context.coordinator
        coordinator.onEvent = onEvent
        coordinator.press?.minimumPressDuration = pressDuration
        coordinator.pan?.isEnabled = dragScrubs
        view.isUserInteractionEnabled = isEnabled
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onEvent: (HeatmapTouchEvent) -> Void = { _ in }
        weak var press: UILongPressGestureRecognizer?
        weak var pan: UIPanGestureRecognizer?

        @objc func scrub(_ recognizer: UIGestureRecognizer) {
            let point = recognizer.location(in: recognizer.view)
            switch recognizer.state {
            case .began: onEvent(.began(point, pressed: recognizer === press))
            case .changed: onEvent(.moved(point))
            case .ended: onEvent(.ended(point))
            case .cancelled, .failed: onEvent(.cancelled)
            default: break
            }
        }

        @objc func tap(_ recognizer: UITapGestureRecognizer) {
            onEvent(.tapped(recognizer.location(in: recognizer.view)))
        }

        /// The pan only starts for a mostly horizontal drag, so vertical swipes stay with the screen.
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y)
        }
    }
}

// MARK: - Drawing

/// Every cell, today's ring and the month labels, in one Canvas. Equatable, so a scrub (which only moves
/// the lifted cell above it) never redraws the grid.
private struct HeatmapCells: View, Equatable {
    /// The most the drawing reaches past the layout frame: room for today's ring.
    static let bleed: CGFloat = 3

    let model: HeatmapModel
    let metrics: HeatmapMetrics
    let originX: CGFloat
    let rtl: Bool
    let bleed: CGFloat
    let style: ActivityHeatmap.Style
    let axisSize: CGFloat
    let locale: Locale
    let entrance: Date?
    let pops: [Int: Date]
    let redacted: Bool

    var body: some View {
        let fills = (0...4).map { style.fill(level: $0) }
        let input = HeatmapPainter.Input(model: model, metrics: metrics, originX: originX, rtl: rtl, bleed: bleed, fills: fills, ring: style.text, label: style.secondary, axisSize: axisSize, locale: locale, entrance: entrance, pops: pops, redacted: redacted)
        TimelineView(.animation(minimumInterval: nil, paused: entrance == nil && pops.isEmpty)) { timeline in
            Canvas { context, size in
                HeatmapPainter.draw(input, in: &context, size: size, time: timeline.date)
            }
        }
        .accessibilityHidden(true)
    }
}

private enum HeatmapPainter {
    struct Input {
        var model: HeatmapModel
        var metrics: HeatmapMetrics
        var originX: CGFloat
        var rtl: Bool
        var bleed: CGFloat
        var fills: [Color]
        var ring: Color
        var label: Color
        var axisSize: CGFloat
        var locale: Locale
        var entrance: Date?
        var pops: [Int: Date]
        var redacted: Bool
    }

    static func draw(_ input: Input, in context: inout GraphicsContext, size: CGSize, time: Date) {
        let model = input.model, m = input.metrics
        context.translateBy(x: input.bleed, y: input.bleed)
        if !input.redacted { drawMonths(input, in: &context, width: size.width - input.bleed * 2) }
        guard model.lastIndex >= 0 else { return }

        var todayScale: CGFloat = 1
        for index in 0...model.lastIndex {
            let scale = cellScale(index, input: input, time: time)
            if index == model.todayIndex { todayScale = scale }
            guard scale > 0.01 else { continue }
            var rect = m.rect(index: index, originX: input.originX, rtl: input.rtl)
            if scale != 1 { rect = rect.insetBy(dx: rect.width * (1 - scale) / 2, dy: rect.height * (1 - scale) / 2) }
            let level = input.redacted ? 0 : min(max(model.levels[index], 0), 4)
            context.fill(Path(roundedRect: rect, cornerRadius: m.radius * scale, style: .continuous), with: .color(input.fills[level]))
        }

        // Today wears a ring in the text color, just outside the cell.
        if let today = model.todayIndex, !input.redacted, todayScale > 0.6 {
            let rect = m.rect(index: today, originX: input.originX, rtl: input.rtl).insetBy(dx: -2, dy: -2)
            context.stroke(Path(roundedRect: rect, cornerRadius: m.radius + 2, style: .continuous), with: .color(input.ring), lineWidth: 1.5)
        }
    }

    /// The entrance wave (oldest to newest, top to bottom, with a little overshoot) and a pop for days whose value changed.
    private static func cellScale(_ index: Int, input: Input, time: Date) -> CGFloat {
        var scale: CGFloat = 1
        if let start = input.entrance {
            let column = Double(index / 7), row = Double(index % 7)
            let delay = (input.metrics.weeks > 1 ? column / Double(input.metrics.weeks - 1) : 0) * 0.45 + row * 0.022
            let p = min(max((time.timeIntervalSince(start) - delay) / 0.34, 0), 1)
            let c1 = 1.0, c3 = c1 + 1, x = p - 1
            scale = CGFloat(1 + c3 * x * x * x + c1 * x * x)
        }
        if let start = input.pops[index] {
            let p = min(max(time.timeIntervalSince(start) / 0.45, 0), 1)
            scale *= 1 + 0.32 * CGFloat(sin(Double.pi * p))
        }
        return scale
    }

    /// Month labels above the first column of each month. A label never collides with the next one or runs
    /// off the grid: the partial month in the first column gives way to a month that starts right after it.
    private static func drawMonths(_ input: Input, in context: inout GraphicsContext, width: CGFloat) {
        let m = input.metrics
        var placed: [(frame: CGRect, text: GraphicsContext.ResolvedText, isLead: Bool)] = []
        for label in input.model.monthLabels {
            let text = context.resolve(
                Text(label.text.uppercased(with: input.locale))
                    .font(.system(size: input.axisSize, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(input.label)
            )
            let size = text.measure(in: CGSize(width: 240, height: 80))
            let column = m.x(column: label.column, originX: input.originX, rtl: input.rtl)
            var x = input.rtl ? column + m.cell - size.width : column
            x = min(max(x, 0), max(width - size.width, 0))
            let frame = CGRect(x: x, y: max(m.header - 5 - size.height, 0), width: size.width, height: size.height)
            if let previous = placed.last, previous.frame.insetBy(dx: previous.isLead ? -14 : -6, dy: 0).intersects(frame) {
                guard previous.isLead else { continue }
                placed.removeLast()
            }
            placed.append((frame, text, label.isLead))
        }
        for label in placed { context.draw(label.text, in: label.frame) }
    }
}

/// The selected day, lifted out of the grid: scaled up with an edge in the ground color that cuts it
/// free of its neighbors, and a soft shadow, springing up as it appears.
private struct HeatmapLiftedCell: View {
    static let edge: CGFloat = 2

    let fill: Color
    let ground: Color
    let size: CGFloat
    let radius: CGFloat
    let reduceMotion: Bool
    @State private var raised = false

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(fill)
            .frame(width: size, height: size)
            .padding(Self.edge)
            .background(ground, in: .rect(cornerRadius: radius + Self.edge, style: .continuous))
            .scaleEffect(raised ? (reduceMotion ? 1.12 : 1.32) : 1)
            .shadow(color: .black.opacity(raised ? 0.22 : 0), radius: 6, y: 3)
            .onAppear {
                withAnimation(reduceMotion ? nil : .spring(duration: 0.32, bounce: 0.45)) { raised = true }
            }
    }
}

/// The small triangle that points from the callout to its day.
private struct HeatmapNub: Shape {
    var pointsDown: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        if pointsDown {
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        } else {
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.minY))
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Accessibility

/// Lets VoiceOver play the visible days as an audio graph and read each one. The day strings are built
/// only when VoiceOver asks for the chart.
private struct HeatmapChart: AXChartDescriptorRepresentable {
    let model: HeatmapModel
    let title: String
    let summary: String
    let dayAxis: String
    let noActivity: String
    let dateStyle: Date.FormatStyle
    let rightToLeft: Bool
    let valueLabel: (Double) -> String

    func makeChartDescriptor() -> AXChartDescriptor {
        let descriptor = AXChartDescriptor(title: title, summary: summary, xAxis: AXNumericDataAxisDescriptor(title: dayAxis, range: 0...1, gridlinePositions: []) { _ in "" }, series: [])
        updateChartDescriptor(descriptor)
        return descriptor
    }

    func updateChartDescriptor(_ descriptor: AXChartDescriptor) {
        let count = model.lastIndex + 1
        let names = (0..<count).map { model.days[$0].formatted(dateStyle) }
        let highest = max(model.values.prefix(count).max() ?? 0, 1)
        descriptor.title = title
        descriptor.summary = summary
        descriptor.contentDirection = rightToLeft ? .rightToLeft : .leftToRight
        descriptor.xAxis = AXNumericDataAxisDescriptor(title: dayAxis, range: 0...Double(max(count - 1, 1)), gridlinePositions: []) { position in
            let index = Int(position.rounded())
            return names.indices.contains(index) ? names[index] : ""
        }
        descriptor.yAxis = AXNumericDataAxisDescriptor(title: title, range: 0...highest, gridlinePositions: []) { value in
            value.formatted(.number.precision(.fractionLength(0...1)))
        }
        let points = (0..<count).map { index in
            let value = model.values[index]
            return AXDataPoint(x: Double(index), y: value, label: "\(names[index]), \(value > 0 ? valueLabel(value) : noActivity)")
        }
        descriptor.series = [AXDataSeriesDescriptor(name: title, isContinuous: false, dataPoints: points)]
    }
}

// MARK: - Palette

private enum HeatmapPalette {
    static let red = Color(red: 1, green: 0, blue: 0)
    static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
    static let field = adaptive(light: 0xE9E7E1, dark: 0x262626)
    static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)
    static let secondary = adaptive(light: 0x5C5A56, dark: 0xA6A49F)
    static let calloutText = adaptive(light: 0xF4F3EF, dark: 0x141414)

    /// A solid mix of the accent into the ground for levels 1 to 3, resolved per appearance: pale steps on
    /// light ground, deep steps on dark, spaced further apart when Increase Contrast is on.
    static func mix(_ accent: Color, into ground: Color, step: Int) -> Color {
        let top = UIColor(accent), base = UIColor(ground)
        return Color(uiColor: UIColor { traits in
            let dark = traits.userInterfaceStyle == .dark
            let strong = traits.accessibilityContrast == .high
            let amounts: [CGFloat] = dark ? (strong ? [0.55, 0.7, 0.85] : [0.45, 0.62, 0.8]) : (strong ? [0.3, 0.5, 0.7] : [0.2, 0.4, 0.6])
            let t = amounts[min(max(step - 1, 0), 2)]
            var a: (CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0)
            var b: (CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0)
            top.resolvedColor(with: traits).getRed(&a.0, green: &a.1, blue: &a.2, alpha: &a.3)
            base.resolvedColor(with: traits).getRed(&b.0, green: &b.1, blue: &b.2, alpha: &b.3)
            return UIColor(red: b.0 + (a.0 - b.0) * t, green: b.1 + (a.1 - b.1) * t, blue: b.2 + (a.2 - b.2) * t, alpha: 1)
        })
    }

    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

/// Minutes of practice for the last 20 weeks: a slow start, a week off, a 31 day run, and a streak still going.
private enum ActivityHeatmapSample {
    static func minutes(todayDone: Bool = true, calendar: Calendar = .current, now: Date = Date()) -> [Date: Double] {
        var seed: UInt64 = 0x9E37_79B9_7F4A_7C15
        func random() -> Double {
            seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            return Double(seed >> 33) / Double(UInt64(1) << 31)
        }
        let today = calendar.startOfDay(for: now)
        var result: [Date: Double] = [:]
        for back in 0..<140 {
            let r = random()
            guard let day = calendar.date(byAdding: .day, value: -back, to: today) else { continue }
            let weekend = calendar.isDateInWeekend(day)
            let active: Bool
            switch back {
            case 0: active = todayDone
            case 1...11, 48...78: active = true
            case 12, 41...47, 79: active = false
            case 13...40: active = r > (weekend ? 0.45 : 0.18)
            default: active = r > (weekend ? 0.7 : 0.45)
            }
            guard active else { continue }
            let base = back > 80 ? 15.0 : 25.0
            result[day] = back == 0 ? 35 : (base + (r * 70).rounded()).rounded()
        }
        return result
    }
}

private struct ActivityHeatmapExample: View {
    @State private var minutes = ActivityHeatmapSample.minutes()
    @State private var day: Date?

    var body: some View {
        ActivityHeatmap(minutes, selection: $day) { value in
            Measurement(value: value, unit: UnitDuration.minutes).formatted(.measurement(width: .abbreviated, usage: .asProvided))
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(HeatmapPalette.ground)
    }
}

#Preview("Light") {
    ActivityHeatmapExample()
}

#Preview("Dark") {
    ActivityHeatmapExample()
        .preferredColorScheme(.dark)
}
