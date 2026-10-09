// swiftpieces:
// title: Live Stat
// description: "A liquid glass metric tile: a semibold display value that rolls with a spring and dims its decimals, a tinted delta chip, a sparkline you hold and scrub to retarget the value live while a glass flag buds out of the tile's top edge above your finger with the change from that point to the latest, a press that expands the line into a taller chart with low and high, and a tinted block variant."
// category: data
// version: "2.2.0"
// pro: dashboard-screen
// minIOSVersion: "17.0"
// tags: [stat, kpi, sparkline, scrub, tile, numbers]

import SwiftUI

/// KPI tile with a rolling value, delta chip, and a scrubbable sparkline that expands on press.
///
/// The tile is a liquid glass panel. While you scrub, a glass flag buds out of the panel's top edge above the point
/// under your finger, joined to the panel by a neck, and shows the change from that point to the latest one. It
/// rides along the edge with the finger and melts back into the panel on release.
///
/// - Parameters:
///   - label: Metric name shown above the value.
///   - value: Current value. Changing it rolls the number from the previous one.
///   - format: Number format for the value, for example `.number` or `.currency(code: "USD")`. Defaults to `.number`.
///   - delta: Optional fractional change (0.12 is +12%) shown as a tinted chip on the panel: sage for up, red for down.
///   - series: History drawn as the sparkline, oldest first. Hold and drag it to scrub.
///   - tint: Sparkline color. Defaults to the style's `line`.
///   - expanded: Optional binding to the expanded state, for driving it from outside.
///   - style: Tile, text, and chip colors. Defaults to `.standard`, a neutral glass tile; `.block(_:)` tints the glass with a color block and dark ink.
public struct LiveStat<Format: FormatStyle>: View where Format.FormatInput == Double, Format.FormatOutput == String {
    /// Tile and chip colors. See `LiveStatStyle`.
    public typealias Style = LiveStatStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.colorSchemeContrast) private var contrast
    @ScaledMetric(relativeTo: .largeTitle) private var numeralScale: CGFloat = 1
    @State private var rolled: Double = 0
    @State private var drawn: CGFloat = 0
    /// Set once the entrance line has reached its end, so the bead lands on the tip instead of ahead of it.
    @State private var settled = false
    @State private var pressed = false
    /// While a hold arms the scrub, the card keeps sinking under the thumb.
    @State private var sinking = false
    @State private var pressAnchor: UnitPoint = .center
    @State private var tileSize: CGSize = .zero
    @State private var scrubIndex: Int?
    @State private var scrubTick = 0
    /// Whether the last scrub ended with the finger lifting, which lands the resting bead on the release.
    @State private var liftedOff = false
    @State private var internalExpanded = false
    @State private var lineFrame: CGRect = .zero
    @State private var lineWidth: CGFloat = 0
    @State private var dragStart: CGPoint?
    @State private var fingerX: CGFloat = 0
    @State private var moved = false
    @State private var holdTask: Task<Void, Never>?
    @State private var expandTaps = 0
    @GestureState private var touching = false  // resets when the system cancels a touch, which skips onEnded
    /// The scrub flag: out of the panel's top edge while scrubbing, melted back in after.
    @State private var buds = PieceBuds()
    /// The point the flag reads, kept while it melts home after the scrub ends.
    @State private var flagIndex = 0
    @State private var flagSize: CGSize = .zero

    private let label: String
    private let value: Double
    private let format: Format
    private let delta: Double?
    private let series: [Double]
    private let tint: Color
    private let expandedBinding: Binding<Bool>?
    private let style: Style

    public init(label: String, value: Double, format: Format, delta: Double? = nil, series: [Double] = [], tint: Color? = nil, expanded: Binding<Bool>? = nil, style: Style = .standard) {
        self.label = label
        self.value = value
        self.format = format
        self.delta = delta
        self.series = series
        self.tint = tint ?? style.line
        self.expandedBinding = expanded
        self.style = style
    }

    public init(label: String, value: Double, delta: Double? = nil, series: [Double] = [], tint: Color? = nil, expanded: Binding<Bool>? = nil, style: Style = .standard) where Format == FloatingPointFormatStyle<Double> {
        self.init(label: label, value: value, format: .number, delta: delta, series: series, tint: tint, expanded: expanded, style: style)
    }

    private var expanded: Bool { expandedBinding?.wrappedValue ?? internalExpanded }
    private var isScrubbing: Bool { scrubIndex != nil }
    private var hasLine: Bool { series.count > 1 }
    /// The scrubbed point's value. New data can shorten the series under a resting finger; past its end there is none.
    private var scrubbed: Double? { scrubIndex.flatMap { series.indices.contains($0) ? series[$0] : nil } }
    /// The extra dip while a hold arms the scrub: from 2.5 to 3.5 pt per edge, so a small tile sinks as far as a wide one.
    private var holdScale: CGFloat {
        PieceMotion.pressScale(for: tileSize, depth: 3.5) / PieceMotion.pressScale(for: tileSize)
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return pressing(card)
            .fontWeight(.semibold)
            .animation(expanded ? motion.reveal : motion.dismiss, value: expanded)
            .coordinateSpace(name: "tile")
            .contentShape(.rect(cornerRadius: 20, style: .continuous))
            .gesture(tileGesture)
            // A touch the system cancelled (a scroll took over, an alert) never ran onEnded, so let go here. After a
            // normal lift onEnded has already cleared dragStart, so this does nothing.
            .onChange(of: touching) { _, isTouching in
                if !isTouching, dragStart != nil { endTouch(asTap: false) }
            }
            // One haptic per event: a soft tap when the scrub starts, a tick for each point after that (never for the
            // start or the release), and a solid tap per expand or collapse.
            .sensoryFeedback(.selection, trigger: scrubIndex) { old, new in old != nil && new != nil }
            .sensoryFeedback(.impact(flexibility: .soft), trigger: scrubTick)
            .sensoryFeedback(.impact(flexibility: .solid), trigger: expandTaps)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(format.format(scrubbed ?? value))
            .accessibilityHint(hasLine ? "Double tap to \(expanded ? "collapse" : "expand"). Swipe up or down to scrub history; past the latest point it returns to live." : "")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { toggleExpanded() }
            .accessibilityAdjustableAction { direction in
                guard hasLine else { return }
                // Live sits one step past the latest point: swiping up onto it ends the scrub, as a lift does, so new
                // values roll in again.
                let live = series.count
                let current = scrubIndex.map { min($0, live - 1) } ?? live
                let next = direction == .increment ? min(current + 1, live) : max(current - 1, 0)
                if next == live {
                    if isScrubbing { endScrub(lift: false) }
                } else {
                    scrub(to: next)
                }
            }
            .onAppear(perform: animateIn)
            .onDisappear { holdTask?.cancel() }
            .onChange(of: value) { _, new in
                guard !isScrubbing else { return }
                withAnimation(roll(1.0)) { rolled = new }
            }
            .onChange(of: scrubIndex) { old, new in
                if let new { flagIndex = new }
                guard (old == nil) != (new == nil) else { return }
                Task {
                    if new != nil { await buds.bloom(["flag"], reduceMotion: reduceMotion) } else { await buds.gather(["flag"], reduceMotion: reduceMotion) }
                }
            }
    }

    /// The tile: a glass panel holding the label, the chip, the figure and the line, with the scrub flag as a second
    /// glass shape in the same group, so the two melt through a neck. The card's own press shadow carries its weight,
    /// so the group adds no lift of its own.
    private var card: some View {
        PieceLiquidGroup(lift: false) {
            panel
                .overlay(alignment: .top) {
                    if buds.contains("flag") { flag }
                }
        }
        .onGeometryChange(for: CGSize.self) { $0.size } action: { tileSize = $0 }
    }

    private var panel: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                Text(label.uppercased())
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(style.muted)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let delta {
                    deltaChip(delta)
                        .animation(isScrubbing ? motion.snap : motion.dismiss) { $0.opacity(isScrubbing ? 0.35 : 1) }
                }
            }

            RollingNumber(value: rolled, target: scrubbed ?? value, format: format, dim: style.muted)
                .font(.system(size: style.numeralSize * numeralScale, weight: .semibold))
                .tracking(-style.numeralSize * 0.02)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .foregroundStyle(style.text)

            if hasLine {
                // One chart that grows, so the line, its bead and its baseline carry through the expand.
                chart(height: expanded ? 120 : 40, showsDetail: expanded)
                if expanded {
                    // The card's edge uncovers it as the drawer opens, and it leaves with the drawer.
                    extremes
                        .transition(.opacity)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        // The drawer's edge uncovers the detail row, so the content is clipped to the panel.
        .clipShape(.rect(cornerRadius: 20, style: .continuous))
        .pieceLiquid(.rect(cornerRadius: 20, style: .continuous), tint: panelTint, interactive: false)
    }

    /// The panel's glass tint: none for the standard tile, the block's color for `.block(_:)`.
    private var panelTint: Color? { style.background == .clear ? nil : style.background }

    /// What rings the bead so it reads cut out of the line: the panel's own color, or the house surface on clear glass.
    private var beadRing: Color { style.background == .clear ? LiveStatStyle.surface : style.background }

    // MARK: Flag

    /// The change from the scrubbed point to the latest one, on a glass flag resting a neck's width above the panel's
    /// top edge, right over the point, so the finger never covers it. It is born just inside the panel's edge, shrunk,
    /// springs out pulling a neck that holds, and rides along the edge with the finger, never easing after it. On
    /// release its figure blurs off, its tint drains and it melts back into the panel.
    private var flag: some View {
        let out = buds.isOut("flag")
        let gap = PieceLiquid.joined
        // Read within the series, so it holds whatever scale the history is kept in.
        let then = series.indices.contains(flagIndex) ? series[flagIndex] : 0
        let latest = series.last ?? 0
        let change = then == 0 ? 0 : (latest - then) / abs(then)
        // Flat, it wears the panel's own tint, so the text the panel uses reads on it.
        let tint: Color? = !out ? nil : change > 0 ? style.up : change < 0 ? style.down : panelTint
        // Over the point, kept inside the panel's width.
        let point = lineFrame.minX + lineFrame.width * CGFloat(flagIndex) / CGFloat(max(series.count - 1, 1))
        let half = flagSize.width / 2
        let x = min(max(point, half), max(tileSize.width - half, half)) - tileSize.width / 2
        // Laid out with its top on the panel's top edge: out, it rises clear of it; home, it sits shrunk just inside the
        // edge, wholly within the panel, so nothing pokes out while it melts in.
        let rest = CGSize(width: 0, height: -(flagSize.height + gap))
        let home = CGSize(width: 0, height: 1 - flagSize.height * (1 - PieceLiquid.homeScale) / 2)
        return HStack(spacing: 3) {
            Image(systemName: change >= 0 ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 10, weight: .semibold))
                .id(change >= 0)
                .transition(PieceMotion(reduceMotion: reduceMotion).swap)
            Text(abs(change), format: .percent.precision(.fractionLength(0...1)))
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
        }
        .foregroundStyle(change == 0 ? style.muted : style.chipInk)
        .lineLimit(1)
        .fixedSize()
        .pieceBudContent(out: out)
        .padding(.horizontal, 10)
        .frame(height: 26)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { flagSize = $0 }
        .pieceLiquid(Capsule(), tint: tint, interactive: false)
        .pieceBud(out: out, rest: rest, home: home)
        // Along the edge it tracks the finger directly; only the bud animates.
        .animation(nil) { $0.offset(x: x) }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// The card dips toward the thumb and its shadow flattens. Each animation is scoped to its own modifiers, so a
    /// press that ends on the same beat as an expand or a scrub never lends them its spring. Under Reduce Motion the
    /// card dims instead of moving.
    private func pressing(_ card: some View) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let dim: Double = pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0
        let press: CGFloat = pressed && !reduceMotion ? PieceMotion.pressScale(for: tileSize) : 1
        // With a line to scrub, a hold anywhere on the tile keeps sinking on the hold's own clock: it starts once the
        // press has landed and bottoms out as the scrub arms at 280 ms, then springs back up with the press.
        let sink: CGFloat = sinking && !reduceMotion ? holdScale : 1
        let sinkAnimation: Animation = sinking ? .linear(duration: 0.18).delay(0.1) : motion.release
        return card
            .animation(pressed ? motion.press : motion.release) { tile in
                tile
                    .brightness(dim)
                    .shadow(color: .black.opacity(pressed ? 0.02 : 0.06), radius: pressed ? 4 : 16, y: pressed ? 2 : 8)
                    .scaleEffect(press, anchor: pressAnchor)
            }
            .animation(sinkAnimation) { $0.scaleEffect(sink, anchor: pressAnchor) }
    }

    // MARK: Chart

    private func chart(height: CGFloat, showsDetail: Bool) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let plot = CGRect(x: 0, y: 6, width: lineWidth, height: height - 12)
        return ZStack(alignment: .topLeading) {
            if let first = series.first, let lo = series.min(), let hi = series.max() {
                // Dashed baseline at the first value, on the same scale as the line. Always drawn, so it rides that
                // scale as the drawer opens; it fades in a beat behind the line and leaves with it.
                Path { path in
                    path.move(to: .zero)
                    path.addLine(to: CGPoint(x: lineWidth, y: 0))
                }
                .stroke(style.muted.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [2, 5]))
                .offset(y: plot.minY + plot.height * CGFloat(1 - (first - lo) / max(hi - lo, .ulpOfOne)))
                .animation(showsDetail ? motion.follow(PieceMotion.calm, rank: 2) : motion.dismiss) { $0.opacity(showsDetail ? 1 : 0) }
            }
            StatLine(series: series)
                .trim(from: 0, to: drawn)
                .stroke(tint, style: StrokeStyle(lineWidth: showsDetail ? 3 : 2.5, lineCap: .round, lineJoin: .round))
                .padding(.vertical, 6)
                .frame(height: height)
                .background {
                    // The frame maps the finger to a point as the line is seen, pressed or not. The width draws the
                    // bead and the baseline in the chart's own space, which the press scale leaves alone.
                    GeometryReader { proxy in
                        Color.clear
                            .onAppear {
                                lineFrame = proxy.frame(in: .named("tile"))
                                lineWidth = proxy.size.width
                            }
                            .onChange(of: proxy.frame(in: .named("tile"))) { _, new in
                                lineFrame = new
                                lineWidth = proxy.size.width
                            }
                    }
                }
            if let index = scrubIndex, let point = StatLine.point(at: index, in: series, rect: plot) {
                Rectangle()
                    .fill(tint)
                    .frame(width: 1.5, height: height)
                    .position(x: point.x, y: height / 2)
                // While held, the bead rides the line under the finger, lifted a little. It catches with a pop on the
                // soft tap's beat, then sits on the finger's point at every frame, never easing after it.
                bead
                    .scaleEffect(1.15)
                    .shadow(color: .black.opacity(0.2), radius: 3, y: 1.5)
                    .position(point)
                    .transition(.asymmetric(insertion: beadTransition(at: point, height: height).animation(motion.success), removal: .opacity))
            } else if settled, let point = StatLine.point(at: series.count - 1, in: series, rect: plot) {
                // At rest the bead marks the latest value.
                bead
                    .position(point)
                    .transition(beadTransition(at: point, height: height))
            }
        }
        .frame(height: height)
        // Only the scrub's start and end animate: the rule and the scrub bead fade in and out, and the resting bead
        // grows back on the tip. The start lands on the snap; a lift lands the bead with visible give (`endScrub`).
        .animation(isScrubbing || !liftedOff ? motion.snap : motion.release, value: isScrubbing)
    }

    /// The accent block: it marks the latest value at rest and rides the line while scrubbing.
    private var bead: some View {
        Circle()
            .fill(style.accent)
            .overlay { Circle().strokeBorder(beadRing, lineWidth: 3) }
            .frame(width: 16, height: 16)
    }

    /// The bead grows from and shrinks into its own spot on the line. A positioned view fills the chart, so a plain
    /// scale would pull it toward the chart's center. A fade under Reduce Motion.
    private func beadTransition(at point: CGPoint, height: CGFloat) -> AnyTransition {
        let anchor = UnitPoint(x: point.x / max(lineWidth, 1), y: point.y / max(height, 1))
        return PieceMotion(reduceMotion: reduceMotion).transition(.scale(scale: 0.4, anchor: anchor).combined(with: .opacity))
    }

    private var extremes: some View {
        HStack(spacing: 16) {
            if let lo = series.min(), let hi = series.max() {
                extreme("Low", lo)
                extreme("High", hi)
                Spacer(minLength: 0)
                Text("\(series.count) pts")
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(style.muted)
            }
        }
    }

    private func extreme(_ title: String, _ value: Double) -> some View {
        HStack(spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1)
                .foregroundStyle(style.muted)
            Text(value, format: format)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(style.text)
        }
    }

    // MARK: Gesture

    /// One drag gesture covers press feel, hold-to-scrub, and tap-to-expand. Nothing here animates the tracking.
    private var tileGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("tile"))
            .updating($touching) { _, state, _ in state = true }
            .onChanged { drag in
                fingerX = drag.location.x
                if dragStart == nil {
                    dragStart = drag.location
                    moved = false
                    // Fixed at touch-down and kept through the release, so the card rises from where it was pressed.
                    pressAnchor = PieceMotion.pressAnchor(touch: drag.location, in: tileSize)
                    pressed = true
                    sinking = hasLine
                    holdTask?.cancel()
                    if hasLine {
                        holdTask = Task {
                            try? await Task.sleep(for: .milliseconds(280))
                            guard !Task.isCancelled, !moved, hasLine else { return }
                            // The card lets go of the press as the bead catches the line under the finger, where it
                            // rests now rather than where it touched down.
                            pressed = false
                            sinking = false
                            scrub(to: index(atX: fingerX))
                        }
                    }
                }
                if isScrubbing {
                    scrub(to: index(atX: drag.location.x))
                } else if !moved, let start = dragStart, hypot(drag.location.x - start.x, drag.location.y - start.y) > 10 {
                    moved = true
                    pressed = false
                    sinking = false
                    holdTask?.cancel()
                }
            }
            .onEnded { _ in endTouch(asTap: true) }
    }

    /// The finger lifts, or the system cancels the touch. Only a lift that neither moved nor scrubbed is a tap.
    private func endTouch(asTap: Bool) {
        holdTask?.cancel()
        let wasTap = asTap && !moved && !isScrubbing
        dragStart = nil
        pressed = false
        sinking = false
        if isScrubbing {
            endScrub(lift: asTap)
        } else if wasTap, hasLine {
            toggleExpanded()
        }
    }

    /// Hands the figure back to the live value. After a lift the resting bead springs back onto the tip with the
    /// release's give; a cancelled touch or VoiceOver put no energy in, so it lands on the snap.
    private func endScrub(lift: Bool) {
        liftedOff = lift
        scrubIndex = nil
        withAnimation(roll(0.5)) { rolled = value }
    }

    private func index(atX x: CGFloat) -> Int {
        guard lineFrame.width > 0 else { return series.count - 1 }
        let f = min(max((x - lineFrame.minX) / lineFrame.width, 0), 1)
        return min(max(Int((f * CGFloat(series.count - 1)).rounded()), 0), series.count - 1)
    }

    /// The figure rolls to each point on a short roll; the bead and the rule just move there.
    private func scrub(to index: Int) {
        guard series.indices.contains(index), index != scrubIndex else { return }
        if scrubIndex == nil { scrubTick += 1 }
        scrubIndex = index
        withAnimation(roll(0.3)) { rolled = series[index] }
    }

    private func toggleExpanded() {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let opening = !expanded
        expandTaps += 1
        // Explicit, so tiles around this one make room on the same spring instead of jumping. The drawer opens on the
        // calm reveal and closes a little quicker.
        withAnimation(opening ? motion.reveal : motion.dismiss) {
            if let expandedBinding { expandedBinding.wrappedValue.toggle() } else { internalExpanded.toggle() }
        }
    }

    /// Every roll of the figure is a spring with no bounce, so from rest it never shows a value past its target.
    /// The durations are the piece's own: a slow count-up, a measured live change, quick scrub steps. Under Reduce
    /// Motion each roll is cut to a quarter second, so a change still reads without a long count.
    private func roll(_ duration: Double) -> Animation {
        .spring(duration: reduceMotion ? min(duration, 0.25) : duration, bounce: 0)
    }

    private func animateIn() {
        if reduceMotion {
            rolled = value
            drawn = 1
            settled = true
            return
        }
        // The entrance: the figure counts up as the line draws on, both easing out with no overshoot. The bead drops
        // onto the tip once the line has reached it.
        withAnimation(roll(1.2)) { rolled = value }
        withAnimation(.easeOut(duration: 1.0)) {
            drawn = 1
        } completion: {
            withAnimation(PieceMotion(reduceMotion: reduceMotion).success) { settled = true }
        }
    }

    // MARK: Delta chip

    /// Up and down arrive as a tinted chip with ink, sitting on the panel. It is a fill, not a glass shape of its own:
    /// glass laid on the glass panel would read as two layers instead of one surface.
    private func deltaChip(_ delta: Double) -> some View {
        let up = delta >= 0
        let strong = contrast == .increased
        return HStack(spacing: 4) {
            Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 11, weight: .semibold))
                .id(up)
                .transition(PieceMotion(reduceMotion: reduceMotion).swap)
            Text(abs(delta), format: .percent.precision(.fractionLength(0...1)))
        }
        .font(.system(size: 13, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(style.chipInk)
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(up ? style.up : style.down, in: Capsule())
        .overlay { Capsule().strokeBorder(style.chipInk.opacity(strong ? 0.9 : 0), lineWidth: 1) }
        .accessibilityLabel(up ? "Up" : "Down")
    }

    /// Text whose number is interpolated by the animation, so every frame is a real formatted value.
    private struct RollingNumber: View, Animatable {
        var value: Double
        let target: Double
        let format: Format
        let dim: Color

        nonisolated var animatableData: Double {
            get { value }
            set { value = newValue }
        }

        var body: some View {
            let text = format.format(rounded)
            let separator = Locale.current.decimalSeparator ?? "."
            if let range = text.range(of: separator, options: .backwards), text[range.upperBound...].first?.isNumber == true {
                Text("\(Text(String(text[..<range.lowerBound])))\(Text(String(text[range.lowerBound...])).foregroundStyle(dim))")
            } else {
                Text(text)
            }
        }

        /// Rounds in-flight frames to the target's own decimal places, so a whole-number format never shows a long fraction mid-roll.
        private var rounded: Double {
            let final = format.format(target)
            let separator = Locale.current.decimalSeparator ?? "."
            var places = 0
            if let range = final.range(of: separator, options: .backwards) {
                places = final[range.upperBound...].prefix { $0.isNumber }.count
            }
            let scale = pow(10, Double(places))
            return (value * scale).rounded() / scale
        }
    }

    private struct StatLine: Shape {
        let series: [Double]
        var closed = false

        static func point(at index: Int, in series: [Double], rect: CGRect) -> CGPoint? {
            guard series.count > 1, series.indices.contains(index), let lo = series.min(), let hi = series.max() else { return nil }
            let span = max(hi - lo, .ulpOfOne)
            let x = rect.minX + rect.width * CGFloat(index) / CGFloat(series.count - 1)
            return CGPoint(x: x, y: rect.maxY - CGFloat((series[index] - lo) / span) * rect.height)
        }

        func path(in rect: CGRect) -> Path {
            var path = Path()
            let points = series.indices.compactMap { Self.point(at: $0, in: series, rect: rect) }
            guard let first = points.first else { return path }
            path.move(to: first)
            for point in points.dropFirst() { path.addLine(to: point) }
            if closed {
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
                path.closeSubpath()
            }
            return path
        }
    }
}

/// Tile and chip colors for `LiveStat`, built from the Free house palette.
public struct LiveStatStyle: Sendable {
    /// The glass tint of the tile. `.clear`, the standard value, leaves it neutral glass; `.block(_:)` tints it with its color.
    public var background: Color
    /// Value color.
    public var text: Color
    /// Label, dimmed decimals, and detail color.
    public var muted: Color
    /// Sparkline color when no `tint` is passed.
    public var line: Color
    /// Dot marking the latest or scrubbed value.
    public var accent: Color
    /// Chip fill for a rise, and the scrub flag's glass tint when the line has risen since the scrubbed point.
    public var up: Color
    /// Chip fill for a fall, and the scrub flag's glass tint when the line has fallen since the scrubbed point.
    public var down: Color
    /// Text on the chip and on a tinted flag.
    public var chipInk: Color
    /// Value size in points; it scales with Dynamic Type.
    public var numeralSize: CGFloat

    public init(background: Color, text: Color, muted: Color, line: Color, accent: Color, up: Color, down: Color, chipInk: Color, numeralSize: CGFloat = 40) {
        self.background = background
        self.text = text
        self.muted = muted
        self.line = line
        self.accent = accent
        self.up = up
        self.down = down
        self.chipInk = chipInk
        self.numeralSize = numeralSize
    }

    /// A neutral glass tile with house text, a butter dot, sage and red chips. Copy it and change one property to customize.
    public static let standard = LiveStatStyle(
        background: .clear,
        text: adaptive(0x141414, 0xF4F3EF),
        muted: adaptive(0x5C5A56, 0xA6A49F),
        line: adaptive(0x141414, 0xF4F3EF),
        accent: adaptive(0xFFD976, 0xFFD976),
        up: adaptive(0xA9DCB7, 0xA9DCB7),
        down: adaptive(0xFF0000, 0xFF0000),
        chipInk: adaptive(0x141414, 0x141414)
    )

    /// A tile of glass tinted with a color block: everything on it turns dark ink, and the chip becomes an ink pill.
    public static func block(_ color: Color) -> LiveStatStyle {
        let ink = adaptive(0x141414, 0x141414)
        return LiveStatStyle(background: color, text: ink, muted: ink.opacity(0.62), line: ink, accent: ink, up: ink, down: ink, chipInk: color)
    }

    /// The house surface, which rings the bead on a neutral glass tile so it reads cut out of the line.
    fileprivate static let surface = adaptive(0xFFFFFF, 0x1C1C1C)

    fileprivate static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

// MARK: - Example

private struct LiveStatExample: View {
    @State private var expanded = false

    var body: some View {
        LiveStat(label: "Revenue", value: 48_250.40, format: .currency(code: "USD"), delta: 0.124, series: [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25], expanded: $expanded)
            .padding(24)
            .frame(maxHeight: .infinity)
            .background(LiveStatStyle.adaptive(0xF3F2EE, 0x121212))
    }
}

#Preview("Light") {
    LiveStatExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    LiveStatExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, pressMath)

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
    /// Follow-through: rank 0 leads, each later rank arrives a beat later on a slightly looser spring. Safe to reverse.
    func follow(_ spring: Spring = PieceMotion.elastic, rank: Int) -> Animation {
        guard !reduceMotion else { return .spring(duration: 0.25, bounce: 0) }
        let k = Double(min(max(rank, 0), 6))
        return .spring(duration: spring.duration + 0.04 * k, bounce: min(spring.bounce + 0.02 * k, 0.55))
    }

    /// One-shot entrances only: item `index` waits 30ms per place, capped at the seventh. Exits go together.
    func cascade(_ animation: Animation, index: Int, step: Double = 0.03) -> Animation {
        guard !reduceMotion, index > 0 else { return animation }
        return animation.delay(step * Double(min(index, 7)))
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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, bud)

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

// swiftpieces-liquid: end
