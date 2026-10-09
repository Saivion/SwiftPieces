// swiftpieces:
// title: Range Slider
// description: "A liquid glass dual-thumb slider: two glass bubble thumbs joined by a tinted glass span over a quiet line, with a glass readout chip joined above each thumb on a liquid neck; drag either thumb or touch the track to pull the nearest one over, the thumbs stay under the finger and land on their step when you let go, values snap to a step without floating drift, the thumbs never cross and keep a minimum gap, a thumb pulled past the end of the track gives with rubber-band resistance and springs back, a grabbed thumb swells and its chip takes the span's tint, as the thumbs meet one chip melts into the other to read as one range, and every step ticks a selection haptic with a firmer impact at a bound or the gap."
// category: inputs
// pro: filter-sheet
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-23"
// tags: [slider, range, dual thumb, filter, price, haptic]

import SwiftUI

/// Liquid glass dual-thumb slider that binds a `ClosedRange` of any floating-point type.
///
/// The thumbs are glass bubbles and the selected span is tinted glass joining them, so the three move as one liquid
/// shape. Each readout chip rests joined above its thumb; when the two would touch, one melts into the other and the
/// survivor reads the whole range.
///
/// The simplest call is one line: `RangeSlider(value: $price, in: 0...1000, step: 10, format: .currency(code: "USD").precision(.fractionLength(0)))`.
/// Pass a `FormatStyle` or a `(V) -> String` closure as `format`; it drives the readouts and the VoiceOver values.
///
/// - Parameters:
///   - value: Bound selected range. Values outside `bounds` are shown clamped; the first change writes a clean, in-bounds range back.
///   - bounds: Minimum and maximum selectable values. Both are always reachable, even when the span is not a multiple of `step`.
///   - step: Optional snapping increment, measured from `bounds.lowerBound`. Snapped values are rounded to the step's decimal places, so `0.1` steps give `0.3`, never `0.30000000000000004`. Without a step the values are continuous.
///   - minimumDistance: Smallest gap the two values keep. The thumbs stop against each other at this distance instead of crossing. Capped at the width of `bounds`.
///   - readout: Where the values print: `.thumbs` (glass chips joined above each thumb that melt into one when they would touch), `.header` (a "lower – upper" line above the track), or `.hidden`.
///   - lowerLabel: VoiceOver label of the lower thumb. Defaults to "Minimum".
///   - upperLabel: VoiceOver label of the upper thumb. Defaults to "Maximum".
///   - style: Colors and metrics. Defaults to the SwiftPieces house palette (a brand red span joining neutral glass thumbs over a quiet line), adapting to light and dark.
///   - format: Turns a value into the text shown in the readouts and spoken by VoiceOver. A `FormatStyle` (such as `.currency(code:)` or `.percent`) or a closure. Defaults to a plain number with as many decimals as `step` has (up to two without a step).
public struct RangeSlider<V: BinaryFloatingPoint>: View where V.Stride: BinaryFloatingPoint {
    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The quiet line the thumbs ride, outside the span.
        public var track: Color
        /// The glass tint of the selected span between the thumbs. Also tints the readout chip of a grabbed thumb.
        public var fill: Color
        /// The glass tint of the thumbs. `.clear`, the default, leaves them neutral glass.
        public var thumb: Color
        /// Unused since the liquid glass refactor: the thumbs are glass bubbles with no ring. Kept so existing code still compiles.
        public var thumbBorder: Color
        /// Text on `fill`, used by the readout chip of a grabbed thumb.
        public var ink: Color
        /// Readout text at rest and the header values.
        public var label: Color
        /// The dash between values.
        public var secondaryLabel: Color
        /// The glass tint of the readout chips at rest. `.clear`, the default, leaves them neutral glass.
        public var chip: Color
        /// Track and span thickness.
        public var trackHeight: CGFloat
        /// Drawn thumb diameter. The touch and VoiceOver target stays at least 44pt either way.
        public var thumbSize: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(track: Color? = nil, fill: Color? = nil, thumb: Color? = nil, thumbBorder: Color? = nil, ink: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, chip: Color? = nil, trackHeight: CGFloat = 8, thumbSize: CGFloat = 28) {
            self.track = track ?? adaptive(light: 0xE6E4DE, dark: 0x2A2A2A)
            self.fill = fill ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.thumb = thumb ?? .clear
            self.thumbBorder = thumbBorder ?? adaptive(light: 0x141414, dark: 0x141414)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.chip = chip ?? .clear
            self.trackHeight = max(trackHeight, 2)
            self.thumbSize = max(thumbSize, 16)
        }

        /// The house palette. (Generic types cannot hold stored statics, so this builds a fresh value.)
        public static var standard: Style { Style() }
    }

    /// Where the lower and upper values print.
    public enum Readout: Sendable {
        /// Glass chips joined above each thumb that follow it, clamp to the edges, and melt into one chip instead of overlapping.
        case thumbs
        /// A "lower – upper" line above the track.
        case header
        /// No visible values; VoiceOver still speaks them.
        case hidden
    }

    private enum Thumb { case lower, upper }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var direction
    @Binding private var value: ClosedRange<V>
    @GestureState private var isTouching = false
    @State private var width: CGFloat = 0
    @State private var active: Thumb?
    @State private var isPending = false
    @State private var grabOffset: CGFloat = 0
    /// The held thumb's base. A grab keeps the base where it was, so a landing still settling finishes under the
    /// finger; a touch on the track glides it to where the finger is.
    @State private var anchor: CGFloat = 0
    /// How far the finger has carried each thumb from its base. Only ever set directly, never animated: every
    /// animated move (a glide, a landing, a rebound) rides the base, so the finger's 1:1 travel never cuts one short.
    @State private var travel: [Thumb: CGFloat] = [:]
    /// Counts releases, so a landing folds its travel back into the base only if nothing came after it.
    @State private var releases = 0
    @State private var isPinned = false
    @State private var lastTick = Date.distantPast
    @State private var selectionTick = 0
    @State private var impactTick = 0
    @State private var lowerChipWidth: CGFloat = 0
    @State private var upperChipWidth: CGFloat = 0
    @State private var mergedChipWidth: CGFloat = 0
    /// The two readouts read as one chip: the right one has melted into the left, which shows the whole range.
    @State private var chipsMerged = false

    private let math: RangeMath
    private let readout: Readout
    private let lowerLabel: String
    private let upperLabel: String
    private let style: Style
    private let format: (V) -> String

    public init(value: Binding<ClosedRange<V>>, in bounds: ClosedRange<V>, step: V.Stride? = nil, minimumDistance: V = 0, readout: Readout = .thumbs, lowerLabel: String = "Minimum", upperLabel: String = "Maximum", style: Style = .standard, format: ((V) -> String)? = nil) {
        let math = RangeMath(lower: Double(bounds.lowerBound), upper: Double(bounds.upperBound), step: step.map { Double($0) }, gap: Double(minimumDistance))
        self._value = value
        self.math = math
        self.readout = readout
        self.lowerLabel = lowerLabel
        self.upperLabel = upperLabel
        self.style = style
        let digits = math.step == nil ? 2 : min(math.places, 6)
        self.format = format ?? { Double($0).formatted(.number.precision(.fractionLength(0...digits))) }
    }

    public init<F: FormatStyle>(value: Binding<ClosedRange<V>>, in bounds: ClosedRange<V>, step: V.Stride? = nil, minimumDistance: V = 0, readout: Readout = .thumbs, lowerLabel: String = "Minimum", upperLabel: String = "Maximum", style: Style = .standard, format: F) where F.FormatInput == V, F.FormatOutput == String {
        self.init(value: value, in: bounds, step: step, minimumDistance: minimumDistance, readout: readout, lowerLabel: lowerLabel, upperLabel: upperLabel, style: style, format: { format.format($0) })
    }

    // MARK: Geometry

    private var isRTL: Bool { direction == .rightToLeft }
    private var radius: CGFloat { style.thumbSize / 2 }
    private var target: CGFloat { max(44, style.thumbSize) }
    private var usable: CGFloat { max(width - style.thumbSize, 1) }

    /// The bound range, clamped into bounds and ordered, as doubles.
    private var current: (lower: Double, upper: Double) {
        math.normalized(Double(value.lowerBound), Double(value.upperBound))
    }

    /// Thumb center for a value, in a left-to-right space. Right-to-left flips the fraction, so the lower thumb sits on the right.
    private func x(for v: Double) -> CGFloat {
        let fraction = CGFloat(math.fraction(v))
        return radius + (isRTL ? 1 - fraction : fraction) * usable
    }

    private func value(atX x: CGFloat) -> Double {
        let fraction = Double(min(max((x - radius) / usable, 0), 1))
        return math.value(atFraction: isRTL ? 1 - fraction : fraction)
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    /// How far past the end of the track a thumb can be pulled: about its own width, within 24 to 32pt.
    private var bandLimit: CGFloat { min(max(style.thumbSize, 24), 32) }

    /// The direction past a thumb's own end of the track: left for the lower thumb, right in right-to-left.
    private func outward(_ which: Thumb) -> CGFloat {
        (which == .lower) != isRTL ? -1 : 1
    }

    /// Where a thumb is drawn: its base plus the finger's travel. A held thumb's base is its anchor; a resting
    /// thumb's base is whatever puts it on its value.
    private func place(_ which: Thumb, value: Double) -> ThumbPlace {
        let moved = travel[which, default: 0]
        return ThumbPlace(base: active == which ? anchor : x(for: value) - moved, travel: moved)
    }

    /// Where the held thumb is drawn for a finger at `finger`: under the finger anywhere its value can go, stopped
    /// firm against the other thumb, and past the end of the track with rubber-band resistance. Only the drawing
    /// goes past the end; the value stays at the bound.
    private func drawnX(_ which: Thumb, finger: CGFloat) -> CGFloat {
        let (lower, upper) = current
        let reach = which == .lower ? (math.lo, math.ceiling(upper: upper)) : (math.floor(lower: lower), math.hi)
        let a = x(for: reach.0), b = x(for: reach.1)
        let end = x(for: which == .lower ? math.lo : math.hi)
        let past = max((finger - end) * outward(which), 0)
        guard past > 0, !reduceMotion else { return min(max(finger, min(a, b)), max(a, b)) }
        return end + outward(which) * PieceMotion.rubberBand(past, limit: bandLimit)
    }

    // MARK: Body

    public var body: some View {
        let (lower, upper) = current
        let lowerPlace = place(.lower, value: lower), upperPlace = place(.upper, value: upper)

        VStack(alignment: .leading, spacing: 10) {
            if readout == .header {
                header(lower: lower, upper: upper)
            }
            PieceLiquidGroup {
                // The chips rest a liquid neck's width above their thumbs, so each stays joined to its own.
                VStack(spacing: PieceLiquid.joined - (target - style.thumbSize) / 2) {
                    if readout == .thumbs {
                        chips(lower: lower, upper: upper, lowerPlace: lowerPlace, upperPlace: upperPlace)
                    }
                    track(lower: lower, upper: upper, lowerPlace: lowerPlace, upperPlace: upperPlace)
                }
            }
            // Geometry runs in a fixed left-to-right space; `x(for:)` mirrors it for right-to-left.
            .environment(\.layoutDirection, .leftToRight)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        }
        .fontWeight(.semibold)
        .accessibilityElement(children: .contain)
        .saturation(isEnabled ? 1 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: selectionTick)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.8), trigger: impactTick)
        .onChange(of: isEnabled) { _, enabled in
            if !enabled { endDrag() }
        }
        // A drag the system cancels never reaches onEnded, so the thumb is let go here too.
        .onChange(of: isTouching) { _, touching in
            if !touching { endDrag() }
        }
    }

    // MARK: Header

    private func header(lower: Double, upper: Double) -> some View {
        let values = [Text(format(V(lower))), Text("–").foregroundStyle(style.secondaryLabel), Text(format(V(upper)))]
        let roll = motion.value
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { ForEach(values.indices, id: \.self) { values[$0] } }
            VStack(alignment: .leading, spacing: 2) { ForEach(values.indices, id: \.self) { values[$0] } }
        }
        .font(.title3.weight(.semibold).monospacedDigit())
        .foregroundStyle(style.label)
        .contentTransition(active != nil ? .identity : reduceMotion ? .opacity : .numericText())
        // Numbers roll without overshoot, whatever spring moves the thumbs; a change with no animation stays instant.
        .transaction { transaction in
            if transaction.animation != nil { transaction.animation = roll }
        }
        .accessibilityHidden(true)
    }

    // MARK: Readout chips

    /// A glass chip over each thumb, riding it and kept inside the track. When the two would come within 6pt the right
    /// one (in screen space) melts into the left, which widens to read "lower – upper" around the thumbs' midpoint, and
    /// it buds back out once they are 12pt apart again, so a thumb resting at the threshold never flickers.
    private func chips(lower: Double, upper: Double, lowerPlace: ThumbPlace, upperPlace: ThumbPlace) -> some View {
        let gap: CGFloat = 6
        let middle = ThumbPlace(base: (lowerPlace.base + upperPlace.base) / 2, travel: (lowerPlace.travel + upperPlace.travel) / 2)
        let lowerCenter = clampCenter(lowerPlace.x, chip: lowerChipWidth)
        let upperCenter = clampCenter(upperPlace.x, chip: upperChipWidth)
        let mergedCenter = clampCenter(middle.x, chip: mergedChipWidth)
        // Left and right in screen space: in right-to-left the upper chip sits on the left.
        let (leftCenter, leftWidth, rightCenter, rightWidth) = isRTL
            ? (upperCenter, upperChipWidth, lowerCenter, lowerChipWidth)
            : (lowerCenter, lowerChipWidth, upperCenter, upperChipWidth)
        let (leftPlace, rightPlace) = isRTL ? (upperPlace, lowerPlace) : (lowerPlace, upperPlace)
        let lowerText = format(V(lower)), upperText = format(V(upper))
        let (leftText, rightText) = isRTL ? (upperText, lowerText) : (lowerText, upperText)
        let (leftLit, rightLit) = isRTL ? (active == .upper, active == .lower) : (active == .lower, active == .upper)
        let separation = (rightCenter - rightWidth / 2) - (leftCenter + leftWidth / 2)
        let measured = width > 0 && lowerChipWidth > 0 && upperChipWidth > 0 && mergedChipWidth > 0
        // Decided against the current state, so it changes only on crossing the threshold for the other state.
        let wantsMerge: Bool? = measured ? (chipsMerged ? separation <= gap * 2 : separation < gap) : nil

        return MergeBlend(amount: chipsMerged ? 1 : 0) { t in
            ZStack {
                // Under the left chip, so at home it sits inside it and melts into it, never over its numbers.
                glassChip(chip(Text(rightText), lit: rightLit && !chipsMerged).pieceBudContent(out: !chipsMerged), lit: rightLit && !chipsMerged)
                    // The bud cycle, driven by the blend so it keeps its spring while a thumb moves under the finger:
                    // shrink first, glass and number together, then move into the merged chip. Under Reduce Motion it
                    // stays put and closes to nothing in place, as the foundation's bud does (glass ignores opacity).
                    .pieceLiquidScale(reduceMotion ? max(1 - t, 0.001) : 1 - (1 - PieceLiquid.homeScale) * t)
                    .offset(x: (reduceMotion ? rightCenter : rightCenter + (mergedCenter - rightCenter) * t) - rightPlace.x - width / 2)
                    .placed(rightPlace)
                // The merged chip reads in the caller's direction, so right-to-left readers see the lower value on the right.
                glassChip(chip(chipsMerged ? Text(range(lowerText, upperText)) : Text(leftText), lit: chipsMerged ? active != nil : leftLit).environment(\.layoutDirection, direction), lit: chipsMerged ? active != nil : leftLit)
                    .offset(x: leftCenter + (mergedCenter - leftCenter) * t - leftPlace.x - width / 2)
                    .placed(leftPlace)
            }
        }
        // The right chip leaves on the split spring and goes home on the one with no bounce, so it never pokes out
        // through the far side of the left chip; the left chip widens and narrows on the same beat.
        .animation(chipsMerged ? PieceLiquid.home(reduceMotion: reduceMotion) : PieceLiquid.split(reduceMotion: reduceMotion), value: chipsMerged)
        .frame(maxWidth: .infinity)
        .background {
            // Each chip's width, measured whether or not it shows, so the merge is decided before anything moves.
            ZStack {
                chip(Text(lowerText), lit: false)
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { lowerChipWidth = $0 }
                chip(Text(upperText), lit: false)
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { upperChipWidth = $0 }
                chip(Text(range(lowerText, upperText)), lit: false)
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { mergedChipWidth = $0 }
            }
            .hidden()
        }
        .onChange(of: wantsMerge, initial: true) { old, new in
            guard let new, new != chipsMerged else { return }
            // The first decision, once the chips are measured, places them with no motion.
            if old == nil {
                withTransaction(Self.quiet) { chipsMerged = new }
            } else {
                chipsMerged = new
            }
        }
        .accessibilityHidden(true)
    }

    /// "lower – upper", with the dash quieter.
    private func range(_ lower: String, _ upper: String) -> AttributedString {
        var dash = AttributedString(" – ")
        dash.foregroundColor = style.secondaryLabel
        return AttributedString(lower) + dash + AttributedString(upper)
    }

    private func clampCenter(_ x: CGFloat, chip: CGFloat) -> CGFloat {
        guard width > chip else { return width / 2 }
        return min(max(x, chip / 2), width - chip / 2)
    }

    /// A chip's text, padded to its capsule. `lit` sets the ink a grabbed thumb's chip uses on the span's tint.
    private func chip(_ text: Text, lit: Bool) -> some View {
        text
            .font(.footnote.weight(.semibold).monospacedDigit())
            .lineLimit(1)
            .foregroundStyle(lit ? style.ink : style.label)
            // Digits roll as the chips merge or split; under the finger they change in place.
            .contentTransition(reduceMotion ? .opacity : .numericText())
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .fixedSize()
    }

    /// Puts a chip on its glass capsule, tinted with the span's colour while its thumb is held. The tint comes on a
    /// beat after the thumb lifts and drains with it; scoped here, so the chip's position keeps its own transaction.
    private func glassChip(_ content: some View, lit: Bool) -> some View {
        content
            .pieceLiquid(.capsule, tint: lit ? style.fill : style.chip == .clear ? nil : style.chip, interactive: false)
            .animation(motion.follow(PieceMotion.tight, rank: 1), value: lit)
    }

    /// A change that must not animate, even under an `.animation` modifier.
    private static var quiet: Transaction {
        var transaction = Transaction(animation: nil)
        transaction.disablesAnimations = true
        return transaction
    }

    // MARK: Track

    private func track(lower: Double, upper: Double, lowerPlace: ThumbPlace, upperPlace: ThumbPlace) -> some View {
        let overhang = max(0, (target - style.thumbSize) / 2)
        // Left and right in screen space: in right-to-left the upper thumb sits on the left.
        let (left, right) = isRTL ? (upperPlace, lowerPlace) : (lowerPlace, upperPlace)
        return ZStack(alignment: .leading) {
            // The quiet line the thumbs ride. It is not glass, so the thumbs and the span merge only with each other.
            Capsule()
                .fill(style.track)
                .frame(height: style.trackHeight)
            // The span: tinted glass resting a liquid neck's width from each thumb, so it joins them through necks and
            // the thumbs stay clear glass (glass that overlaps takes the tint across the whole of it). Each edge rides
            // its own thumb's base and travel, so the span stays joined to both through any glide or release, and the
            // finger's 1:1 travel never cuts a landing short.
            SpanEdges(lower: left.base, upper: right.base) { lowerBase, upperBase in
                let inset = radius + PieceLiquid.joined
                let from = lowerBase + left.travel + inset, to = upperBase + right.travel - inset
                Color.clear
                    .frame(width: max(to - from, 0), height: style.trackHeight)
                    .pieceLiquid(.capsule, tint: style.fill, interactive: false)
                    .offset(x: from)
            }
            thumb(.lower, at: lowerPlace, value: lower)
            thumb(.upper, at: upperPlace, value: upper)
        }
        .frame(height: target)
        .frame(maxWidth: .infinity)
        // Extend the touch area so the 44pt target of a thumb at either end still counts.
        .contentShape(Rectangle().inset(by: -overhang))
        .gesture(drag(lowerX: x(for: lower), upperX: x(for: upper)), isEnabled: isEnabled && math.span > 0)
    }

    private func thumb(_ which: Thumb, at place: ThumbPlace, value: Double) -> some View {
        let grabbed = active == which
        let label = which == .lower ? lowerLabel : upperLabel
        // Under Reduce Motion a grabbed thumb keeps its size and takes the span's tint instead.
        let tint = grabbed && reduceMotion ? style.fill : style.thumb == .clear ? nil : style.thumb
        return Color.clear
            .frame(width: style.thumbSize, height: style.thumbSize)
            .pieceLiquid(.circle, tint: tint, interactive: false)
            // The piece's signature: a pinched bead lifts, swelling rather than sinking, so the grab shows at its edge.
            // It rises on the press spring with no overshoot and drops back on the release spring. Scoped here, so the
            // thumb's position keeps its own transaction.
            .pieceLiquidScale(grabbed && !reduceMotion ? 1.18 : 1)
            .animation(grabbed ? motion.press : motion.release, value: grabbed)
            .frame(width: target, height: target)
            .contentShape(.rect)
            .offset(x: -target / 2)
            .placed(place)
            .zIndex(grabbed ? 1 : 0)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(format(V(value)))
            .accessibilityAdjustableAction { direction in
                adjust(which, up: direction == .increment)
            }
            .accessibilitySortPriority(which == .lower ? 2 : 1)
    }

    // MARK: Interaction

    private func drag(lowerX: CGFloat, upperX: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .updating($isTouching) { _, touching, _ in touching = true }
            .onChanged { drag in
                if active == nil && !isPending {
                    begin(at: drag.startLocation.x, lowerX: lowerX, upperX: upperX)
                }
                if isPending {
                    // Both thumbs under the finger: the first clear movement picks the one that can go that way.
                    let dx = drag.translation.width
                    guard abs(dx) > 3 else { return }
                    let which: Thumb = (isRTL ? -dx : dx) > 0 ? .upper : .lower
                    isPending = false
                    active = which
                    anchor = (which == .lower ? lowerX : upperX) - travel[which, default: 0]
                    isPinned = math.isAtLimit(isLower: which == .lower, current.lower, current.upper)
                }
                guard let active else { return }
                // Tracking is never animated. The value snaps to its step; the drawn thumb stays under the finger.
                let finger = drag.location.x - grabOffset
                set(active, to: value(atX: finger), feedback: true)
                travel[active] = drawnX(active, finger: finger) - anchor
            }
            .onEnded { drag in
                var speed: CGFloat = 0
                if let active {
                    // The drawn thumb's own speed: the finger's, slowed by the band past the end, none against the other thumb.
                    let finger = drag.location.x - grabOffset, frame: CGFloat = 1 / 120
                    speed = (drawnX(active, finger: finger + drag.velocity.width * frame) - drawnX(active, finger: finger)) / frame
                }
                endDrag(velocity: speed)
            }
    }

    private func begin(at x: CGFloat, lowerX: CGFloat, upperX: CGFloat) {
        let hit = target / 2
        let toLower = abs(x - lowerX), toUpper = abs(x - upperX)
        if abs(lowerX - upperX) < 6 && min(toLower, toUpper) <= hit {
            isPending = true
            grabOffset = x - lowerX
            return
        }
        let which: Thumb
        if toLower == toUpper {
            // Stacked thumbs touched from the side: the side decides.
            which = (x > lowerX) != isRTL ? .upper : .lower
        } else {
            which = toLower < toUpper ? .lower : .upper
        }
        let thumbX = which == .lower ? lowerX : upperX
        let moved = travel[which, default: 0]
        isPinned = math.isAtLimit(isLower: which == .lower, current.lower, current.upper)
        if abs(x - thumbX) <= hit {
            // On a thumb: keep the finger's offset, so the thumb does not jump, and keep its base, so a landing
            // still in flight finishes under the finger.
            grabOffset = x - thumbX
            active = which
            anchor = thumbX - moved
        } else {
            // On the track: the base glides the thumb to the finger in one move, and the finger's own movement rides
            // on top of the glide 1:1. Landing against the other thumb or past the end, it arrives on the tight
            // spring, so it stops firm instead of bumping past.
            grabOffset = 0
            let landing = drawnX(which, finger: x)
            withAnimation(abs(landing - x) > 0.5 ? .spring(PieceMotion.tight) : motion.snap) {
                active = which
                anchor = landing - moved
            }
        }
    }

    /// Lets go of the held thumb. Pulled past the end of the track, it rebounds, leaving at the speed it was moving.
    /// Anywhere else it snaps onto its value from rest: values never coast, so its give is a sliver of the gap it
    /// closes and never reaches a neighboring value.
    private func endDrag(velocity: CGFloat = 0) {
        isPending = false
        grabOffset = 0
        guard let which = active else { return }
        let moved = travel[which, default: 0]
        let from = anchor + moved
        let to = x(for: which == .lower ? current.lower : current.upper)
        // Past the end of the track, not merely off its step: a stepped thumb let go beside its step lands from rest.
        let end = x(for: which == .lower ? math.lo : math.hi)
        let isPastEnd = (from - end) * outward(which) > 0.5
        // Only the base moves, from the anchor to whatever puts the thumb on its value; the travel stays as it is.
        // When the base has a landing to make, the travel folds back into it once that landing is over and nothing
        // has touched the slider since: the thumb stays where it is, and no spring is in flight to cut short. A
        // release that moves nothing keeps its travel, which is harmless: only the sum is ever drawn.
        let lands = abs(to - from) >= 0.5
        releases += 1
        let release = releases
        withAnimation(isPastEnd ? motion.settle(velocity: velocity, from: from, to: to) : motion.snap, completionCriteria: .removed) {
            active = nil
        } completion: {
            guard lands, releases == release, active == nil, !isPending else { return }
            travel[which] = nil
        }
    }

    /// VoiceOver: one `step` (or 1% of the span) to the next valid value in that direction. The thumb, its block edge
    /// and its chip glide there on the base, landing as a release does.
    private func adjust(_ which: Thumb, up: Bool) {
        guard isEnabled else { return }
        let (lower, upper) = current
        withAnimation(motion.snap) {
            set(which, to: math.stepped(which == .lower ? lower : upper, up: up), feedback: false)
        }
    }

    private func set(_ which: Thumb, to raw: Double, feedback: Bool) {
        let (lower, upper) = current
        let result = math.resolve(isLower: which == .lower, raw: raw, lower: lower, upper: upper)
        let next = which == .lower ? V(result.value)...V(max(result.value, upper)) : V(min(lower, result.value))...V(result.value)
        guard next != value else { return }
        let before = which == .lower ? lower : upper
        value = next
        guard feedback else { return }
        if result.atLimit && !isPinned {
            impactTick += 1
        } else if math.crossesTick(from: before, to: result.value) {
            // Throttled so a fast flick over fine steps does not buzz continuously.
            let now = Date()
            if now.timeIntervalSince(lastTick) > 0.035 {
                lastTick = now
                selectionTick += 1
            }
        }
        isPinned = result.atLimit
    }
}

/// Range math in doubles: snapping, the gap between thumbs, and decimal cleanup. Pure and unit-testable.
private struct RangeMath: Sendable {
    let lo: Double
    let hi: Double
    let step: Double?
    let gap: Double
    /// Decimal places of the step and lower bound, used to strip binary drift. 12 or more means "do not round".
    let places: Int

    nonisolated init(lower: Double, upper: Double, step: Double?, gap: Double) {
        let lo = min(lower, upper), hi = max(lower, upper)
        self.lo = lo
        self.hi = hi
        self.step = step.flatMap { $0 > 0 && $0.isFinite ? $0 : nil }
        self.gap = min(max(gap, 0), hi - lo)
        self.places = self.step.map { max(Self.decimals($0), Self.decimals(lo)) } ?? 12
    }

    nonisolated var span: Double { hi - lo }

    nonisolated static func decimals(_ x: Double) -> Int {
        var scaled = abs(x)
        for places in 0..<12 {
            if abs(scaled - scaled.rounded()) <= max(1e-9, scaled * 1e-12) { return places }
            scaled *= 10
        }
        return 12
    }

    nonisolated func tidy(_ x: Double) -> Double {
        guard places < 12 else { return x }
        let scale = pow(10, Double(places))
        return (x * scale).rounded() / scale
    }

    nonisolated func fraction(_ v: Double) -> Double { span > 0 ? min(max((v - lo) / span, 0), 1) : 0 }
    nonisolated func value(atFraction f: Double) -> Double { lo + f * span }

    nonisolated func normalized(_ a: Double, _ b: Double) -> (lower: Double, upper: Double) {
        let a = a.isFinite ? min(max(a, lo), hi) : lo
        let b = b.isFinite ? min(max(b, lo), hi) : hi
        return (min(a, b), max(a, b))
    }

    /// The nearest step point or bound, so both ends stay reachable when the span is not a multiple of the step.
    nonisolated func snap(_ raw: Double) -> Double {
        let clamped = min(max(raw.isFinite ? raw : lo, lo), hi)
        guard let step else { return clamped }
        let grid = tidy(lo + ((clamped - lo) / step).rounded() * step)
        if hi - clamped < abs(clamped - grid) { return hi }
        return min(max(grid, lo), hi)
    }

    /// Largest step point at or below `x` (strictly below when `strict`).
    nonisolated func gridFloor(_ x: Double, strict: Bool = false) -> Double {
        guard let step else { return x }
        let n = strict ? ((x - lo) / step - 1e-7).rounded(.up) - 1 : ((x - lo) / step + 1e-7).rounded(.down)
        return max(tidy(lo + n * step), lo)
    }

    /// Smallest step point at or above `x` (strictly above when `strict`), or the upper bound.
    nonisolated func gridCeil(_ x: Double, strict: Bool = false) -> Double {
        guard let step else { return x }
        let n = strict ? ((x - lo) / step + 1e-7).rounded(.down) + 1 : ((x - lo) / step - 1e-7).rounded(.up)
        return min(tidy(lo + n * step), hi)
    }

    /// How far the lower value may go given the upper one, kept on the step grid.
    nonisolated func ceiling(upper: Double) -> Double {
        let limit = upper - gap
        if step == nil || limit >= hi { return max(lo, min(limit, upper)) }
        return max(lo, min(gridFloor(limit), upper))
    }

    /// How far the upper value may go given the lower one, kept on the step grid.
    nonisolated func floor(lower: Double) -> Double {
        let limit = lower + gap
        if step == nil || limit <= lo { return min(hi, max(limit, lower)) }
        return min(hi, max(gridCeil(limit), lower))
    }

    /// Where a dragged thumb lands, and whether it sits against a bound or the other thumb.
    nonisolated func resolve(isLower: Bool, raw: Double, lower: Double, upper: Double) -> (value: Double, atLimit: Bool) {
        let snapped = snap(raw)
        if isLower {
            let limit = ceiling(upper: upper)
            let v = min(snapped, limit)
            return (v, v <= lo || v >= limit)
        } else {
            let limit = floor(lower: lower)
            let v = max(snapped, limit)
            return (v, v >= hi || v <= limit)
        }
    }

    nonisolated func isAtLimit(isLower: Bool, _ lower: Double, _ upper: Double) -> Bool {
        isLower ? lower <= lo || lower >= ceiling(upper: upper) : upper >= hi || upper <= floor(lower: lower)
    }

    /// The next valid value one step away: the neighboring step point, or 1% of the span without a step.
    nonisolated func stepped(_ v: Double, up: Bool) -> Double {
        guard step != nil else { return v + (up ? 1 : -1) * span / 100 }
        return up ? gridCeil(v, strict: true) : gridFloor(v, strict: true)
    }

    /// Selection ticks: every change with a step, every 5% of the span without one.
    nonisolated func crossesTick(from a: Double, to b: Double) -> Bool {
        guard a != b else { return false }
        guard step == nil, span > 0 else { return true }
        return (fraction(a) * 20).rounded(.down) != (fraction(b) * 20).rounded(.down)
    }
}

/// The span's two edges, each a thumb's base, animated on their own: SwiftUI interpolates them frame by frame and
/// rebuilds the span with them, while each thumb's travel rides on top directly. One frame of both would let the
/// finger's travel cut a glide or a landing short.
private struct SpanEdges<Content: View>: View, Animatable {
    var lower: CGFloat
    var upper: CGFloat
    @ViewBuilder let content: (CGFloat, CGFloat) -> Content

    nonisolated var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(lower, upper) }
        set {
            lower = newValue.first
            upper = newValue.second
        }
    }

    var body: some View { content(lower, upper) }
}

/// How far the two readouts have merged, from 0 (apart) to 1 (one chip), animated on its own for the same reason: the
/// chips ride their thumbs directly under the finger, which would cut a merge animated on their offsets short.
private struct MergeBlend<Content: View>: View, Animatable {
    var amount: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { amount }
        set { amount = newValue }
    }

    var body: some View { content(amount) }
}

/// Where a thumb is drawn: a base, plus how far the finger has carried it from there. Views ride the two on
/// separate offsets. Only the base is ever animated, so a glide, landing or rebound never fights the finger's
/// 1:1 travel, and a grab during one lets it finish under the finger.
private struct ThumbPlace {
    var base: CGFloat
    var travel: CGFloat = 0
    var x: CGFloat { base + travel }
}

private extension View {
    /// Moves this view to a thumb's place: the base and the travel on separate offsets.
    func placed(_ place: ThumbPlace) -> some View {
        offset(x: place.base).offset(x: place.travel)
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

/// A price filter with a header readout, and an age range whose chips merge as the thumbs meet the five-year gap.
private struct RangeSliderExample: View {
    @State private var price: ClosedRange<Double> = 120...480
    @State private var age: ClosedRange<Double> = 24...41

    var body: some View {
        VStack(alignment: .leading, spacing: 40) {
            RangeSlider(value: $price, in: 0...1000, step: 10, readout: .header, lowerLabel: "Minimum price", upperLabel: "Maximum price", format: .currency(code: "USD").precision(.fractionLength(0)))
            RangeSlider(value: $age, in: 18...80, step: 1, minimumDistance: 5, lowerLabel: "Youngest age", upperLabel: "Oldest age", style: .init(fill: adaptive(light: 0xA9DCB7, dark: 0xA9DCB7))) { "\(Int($0))" }
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    RangeSliderExample()
}

#Preview("Dark") {
    RangeSliderExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, momentum, rubberBand)

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
