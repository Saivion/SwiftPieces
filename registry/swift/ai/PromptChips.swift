// swiftpieces:
// title: Prompt Chips
// description: Liquid glass prompt chips above a composer, in a snapping horizontal row or a grid of columns, each keyed by a tinted glyph disc. They cascade in one after another as they appear. A tap presses the chip and swells it with a pop of its disc, and the other chips flow into it, nearest first, melting into its glass; then the gathered chip condenses into a drop that falls into the composer as the chips close, handing it the text.
// category: ai
// minIOSVersion: "17.0"
// version: "3.1.0"
// pro: prompt-composer
// tags: [chips, suggestions, prompt, scroll, grid, ai, blocks]

import SwiftUI
import UIKit

/// Prompt suggestions as liquid glass chips, sized for thumb reach directly above a composer.
///
/// - Parameters:
///   - suggestions: Chip titles, in order.
///   - systemImage: Glyph on every chip's colour disc. Pass `nil` for text-only chips.
///   - symbols: Optional per-chip glyphs, matched to `suggestions` by index. Falls back to `systemImage`.
///   - tint: One disc colour for every chip. `nil` cycles `style.blocks`.
///   - style: Text, disc colours and radius. Defaults to the house palette.
///   - layout: `.row` (the default) is one horizontally snapping row; `.grid(columns:)` wraps the chips into equal
///     columns that fill the width, for a starter screen with several suggestions in view at once.
///   - selection: Optional two-way selection. Set it to a suggestion to choose it programmatically; the chips write the chosen title back when it hands off.
///   - onSelect: Called with the chosen title as it hands off to the composer, once the other chips have melted into it
///     (about half a second after the tap; 0.2 s under Reduce Motion).
public struct PromptChips: View {
    /// How the chips are laid out.
    public enum Layout: Sendable, Equatable {
        /// One horizontally snapping row, sized for thumb reach directly above a composer.
        case row
        /// Equal columns that fill the width, wrapping onto as many rows as the suggestions need.
        case grid(columns: Int)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The chips have cascaded in.
    @State private var appeared = false
    @State private var chosen: Int?
    /// The other chips have melted all the way into the chosen one and closed inside it.
    @State private var absorbed = false
    /// The chosen chip has handed its text over: it condenses into a drop that falls into the composer as the chips close.
    @State private var departed = false
    /// The chips' natural height, so they can close from it.
    @State private var height: CGFloat = 0
    @State private var popTick = 0
    /// Where each chip's centre sits, so the others know where to flow when one is chosen.
    @State private var centers: [Int: CGPoint] = [:]
    /// Each chip's way into the chosen one, fixed the moment it is chosen.
    @State private var pulls: [Int: CGSize] = [:]

    /// Chips rest this far apart, as their own bubbles.
    private static let gap: CGFloat = 12
    /// Inside this distance chips melt into each other: under their rest gap, so they only join while one flows into another.
    private static let melt: CGFloat = 10
    private nonisolated static let space = "PromptChips"

    private let suggestions: [String]
    private let systemImage: String?
    private let symbols: [String]?
    private let tint: Color?
    private let style: Style
    private let selection: Binding<String?>
    private let layout: Layout
    private let onSelect: (String) -> Void

    public init(_ suggestions: [String], systemImage: String? = "sparkle", symbols: [String]? = nil, tint: Color? = nil, style: Style = .standard, layout: Layout = .row, selection: Binding<String?> = .constant(nil), onSelect: @escaping (String) -> Void) {
        self.suggestions = suggestions
        self.layout = layout
        self.systemImage = systemImage
        self.symbols = symbols
        self.tint = tint
        self.style = style
        self.selection = selection
        self.onSelect = onSelect
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    private var columns: Int? {
        if case .grid(let columns) = layout { return max(columns, 1) }
        return nil
    }

    private func block(_ index: Int) -> Color {
        tint ?? (style.blocks.isEmpty ? Color.accentColor : style.blocks[index % style.blocks.count])
    }

    private func symbol(_ index: Int) -> String? {
        if let symbols, symbols.indices.contains(index) { return symbols[index] }
        return systemImage
    }

    public var body: some View {
        Group {
            if let columns {
                grid(columns: columns)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    // Separate suggestions, so they rest apart, as their own bubbles, in one glass group so they can
                    // melt into the chosen one.
                    PieceLiquidGroup(spacing: Self.melt, lift: false) {
                        HStack(spacing: Self.gap) {
                            ForEach(suggestions.indices, id: \.self) { chip($0) }
                        }
                        .scrollTargetLayout()
                        .coordinateSpace(.named(Self.space))
                    }
                    .opacity(appeared ? 1 : 0)
                    .animation(appeared ? motion.reveal : nil, value: appeared)
                    .padding(.vertical, 8)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollClipDisabled()
                .contentMargins(.horizontal, 16, for: .scrollContent)
                .scrollDisabled(chosen != nil)
            }
        }
        .fontWeight(.semibold)
        // Closing: the chips shut from their natural height once the chosen one hands off, so the composer below
        // rises into their place. Nothing is clipped: by then the glass has gathered into one drop that closes as it
        // falls.
        .frame(height: departed ? 0 : (height > 0 ? height : nil), alignment: .top)
        .sensoryFeedback(.selection, trigger: chosen)
        .onAppear {
            guard !appeared else { return }
            appeared = true
        }
        .onChange(of: suggestions) {
            // A new set of suggestions arrives fresh: they cascade in again.
            chosen = nil
            absorbed = false
            departed = false
            pulls = [:]
            appeared = false
            Task { appeared = true }
        }
        .onChange(of: selection.wrappedValue) { _, title in
            if chosen == nil, let title, let index = suggestions.firstIndex(of: title) { choose(index) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Suggestions")
    }

    /// The chips in equal columns, row by row.
    private func grid(columns: Int) -> some View {
        let rows = stride(from: 0, to: suggestions.count, by: columns).map { Array($0..<min($0 + columns, suggestions.count)) }
        return PieceLiquidGroup(spacing: Self.melt, lift: false) {
            VStack(spacing: Self.gap) {
                ForEach(rows, id: \.first) { row in
                    HStack(spacing: Self.gap) {
                        ForEach(0..<columns, id: \.self) { slot in
                            if slot < row.count {
                                chip(row[slot])
                            } else {
                                Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                            }
                        }
                    }
                    // The chosen chip's row draws last, so the chips flowing in pass under it.
                    .zIndex(row.contains(chosen ?? -1) ? 1 : 0)
                }
            }
            .coordinateSpace(.named(Self.space))
        }
        // Glass ignores opacity inside its group, so the arrival fades the group from outside.
        .opacity(appeared ? 1 : 0)
        .animation(appeared ? motion.reveal : nil, value: appeared)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
    }

    /// A chip's glyph disc and title. `shown` is false once the chip melts into the chosen one, or hands off: its
    /// content blurs away before the glass moves, so it never rides over the chosen chip's.
    private func label(_ index: Int, shown: Bool) -> some View {
        HStack(spacing: 10) {
            if let symbol = symbol(index) {
                // The chip's key: a disc of its colour inside the glass, concentric with the chip's end. It pops as the
                // chip is chosen.
                Image(systemName: symbol)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(style.ink)
                    .frame(width: 32, height: 32)
                    .background(block(index), in: Circle())
                    .piecePop(trigger: chosen == index ? popTick : 0, amount: 0.18)
            }
            Text(suggestions[index])
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.text)
                // A grid column can be narrow, so a long title wraps to a second line rather than truncating.
                .lineLimit(columns == nil ? 1 : 2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: columns != nil)
        }
        .pieceBudContent(out: shown)
        .padding(.leading, symbol(index) == nil ? 18 : 10)
        .padding(.trailing, columns == nil ? 18 : 14)
        .padding(.vertical, columns == nil ? 0 : 8)
        .frame(maxWidth: columns == nil ? nil : .infinity, minHeight: 52, alignment: .leading)
    }

    private func chip(_ index: Int) -> some View {
        let isChosen = chosen == index
        // Every other chip flows into the chosen one and melts into its glass.
        let melting = chosen != nil && !isChosen
        // How far this chip sits from the chosen one, in places, so the others flow in nearest first.
        let distance = chosen.map { ripple(from: $0, to: index) } ?? 0
        let still = reduceMotion
        // Glass scales through pieceLiquidScale (a scaleEffect would leave the content behind) and never fades inside
        // its group, so it closes to nothing instead.
        let scale: CGFloat = departed || (melting && absorbed) ? 0.001 : still ? 1 : !appeared ? 0.94 : isChosen ? 1.04 : 1
        return Button { choose(index) } label: { label(index, shown: !melting && !departed) }
            .buttonStyle(ChipPress(cornerRadius: style.cornerRadius))
            // The look of each moment, each on its own clock: the arrival rises in reading order; the chosen chip
            // swells as the others flow home into it, then condenses into a drop that falls into the composer.
            .pieceLiquidScale(scale)
            .offset(y: still ? 0 : (!appeared ? 12 : isChosen && departed ? 24 : 0))
            // Home is the chosen chip's centre: the chip shrinks as it travels and melts through the glass into it.
            // Under Reduce Motion it closes in place.
            .pieceBud(out: !melting, home: pulls[index] ?? .zero)
            .animation(
                !appeared ? nil
                    : departed ? motion.dismiss
                    : melting ? motion.cascade(PieceLiquid.home(reduceMotion: reduceMotion), index: distance - 1, step: 0.04)
                    : isChosen ? motion.success
                    : motion.cascade(motion.reveal, index: index, step: 0.045),
                value: [appeared, chosen == nil, isChosen, departed]
            )
            // Drawn last, so the chips flowing in pass under its title.
            .zIndex(isChosen ? 1 : 0)
            // Where the chip rests, read outside its own offsets so the reading never chases the motion.
            .onGeometryChange(for: CGPoint.self) { proxy in
                let frame = proxy.frame(in: .named(Self.space))
                return CGPoint(x: frame.midX, y: frame.midY)
            } action: { centers[index] = $0 }
            .allowsHitTesting(chosen == nil)
            .accessibilityHint("Uses this prompt")
            .accessibilityHidden(melting)
    }

    /// Places between two chips: along the row, or rows and columns apart in a grid.
    private func ripple(from a: Int, to b: Int) -> Int {
        guard let columns else { return abs(a - b) }
        return max(abs(a / columns - b / columns), abs(a % columns - b % columns))
    }

    private func choose(_ index: Int) {
        // One choice per set: VoiceOver can still activate a chip while the others are leaving.
        guard chosen == nil, suggestions.indices.contains(index) else { return }
        let title = suggestions[index]
        // Each chip's way home into the chosen one, from where they rest now.
        let target = centers[index] ?? .zero
        pulls = Dictionary(uniqueKeysWithValues: suggestions.indices.map { i in
            let center = centers[i] ?? target
            return (i, CGSize(width: target.x - center.x, height: target.y - center.y))
        })
        // The farthest chip, in places, sets when the last one has melted in.
        let reach = suggestions.indices.map { ripple(from: index, to: $0) }.max() ?? 0
        chosen = index
        popTick += 1
        Task {
            // The swell lands and the others have melted in, then the gathered chip hands off and the chips close.
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 200 : 440 + 40 * min(reach, 7)))
            // The melted chips sit wholly inside the chosen one by now: they close at once, out of sight, so the drop
            // falls as a single shape.
            var quiet = Transaction()
            quiet.disablesAnimations = true
            withTransaction(quiet) { absorbed = true }
            try? await Task.sleep(for: .milliseconds(20))
            withAnimation(motion.dismiss) { departed = true }
            selection.wrappedValue = title
            onSelect(title)
        }
    }
}

public extension PromptChips {
    /// Look of a `PromptChips` row. Start from `.standard` and change what you need.
    struct Style: Sendable {
        /// Glyph discs, cycled across chips, unless `tint` is passed.
        public var blocks: [Color] = [
            Color(red: 1, green: 0, blue: 0),
            Color(red: 0.612, green: 0.761, blue: 1),
            Color(red: 1, green: 0.851, blue: 0.463),
            Color(red: 0.663, green: 0.863, blue: 0.718),
            Color(red: 0.804, green: 0.722, blue: 1),
        ]
        /// Unused since the liquid glass refactor: chips are neutral glass. Kept so existing code still compiles.
        public var surface: Color = Style.adaptive(0xFFFFFF, 0x1C1C1C)
        /// Chip titles.
        public var text: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Dark ink on the discs.
        public var ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
        /// Corner radius of the chips. 26, the default, makes a capsule at the chip's 52pt height.
        public var cornerRadius: CGFloat = 26

        public init() {}

        /// The house palette: neutral glass chips keyed by signal, sky, butter, sage and lilac discs.
        public static let standard = Style()

        private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

/// The chip's glass, pressed into the rack: it sinks under the thumb and springs back with a little give. Centered, so
/// it never fights the row's scrolling; under Reduce Motion it shades instead.
private struct ChipPress: ButtonStyle {
    let cornerRadius: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return configuration.label
            .pieceLiquid(shape, interactive: false)
            .contentShape(shape)
            .pieceLiquidPress(configuration.isPressed)
    }
}

// MARK: - Example

/// A starter grid of six suggestions in two columns: they cascade in, one is chosen, the others flow into it and melt
/// into its glass, and the gathered chip falls into the composer as a drop while the grid closes.
private struct PromptChipsExample: View {
    @State private var cycle = 0

    var body: some View {
        PromptChips(
            ["Summarize", "Draft a reply", "Action items", "Plan my week", "Translate", "Make it shorter"],
            symbols: ["text.alignleft", "arrowshape.turn.up.left", "checklist", "calendar", "globe", "arrow.down.right.and.arrow.up.left"],
            layout: .grid(columns: 2)
        ) { _ in
            // The grid closes once a choice hands off; rebuild it so the example loops.
            Task {
                try? await Task.sleep(for: .seconds(0.8))
                cycle += 1
            }
        }
        .id(cycle)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    PromptChipsExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    PromptChipsExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, pressMath, pop)

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

/// Anticipation, overshoot, settle: dips, swells past full size and lands each time `trigger` changes. Under
/// Reduce Motion it stays still (same view, no identity change) and the color or symbol carries the meaning.
private struct PiecePop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let amount = reduceMotion ? 0 : amount
        content.keyframeAnimator(initialValue: CGFloat(1), trigger: trigger) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(1 - amount * 0.4, duration: 0.08)
                SpringKeyframe(1 + amount, duration: 0.14, spring: Spring(duration: 0.18, bounce: 0))
                SpringKeyframe(1, duration: 0.42, spring: PieceMotion.expressive)
            }
        }
    }
}

private extension View {
    /// Pops each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func piecePop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PiecePop(trigger: AnyHashable(trigger), amount: amount))
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud)

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

/// The press for a glass control: the same size-aware sink and lean as `piecePress`, applied through
/// `pieceLiquidScale` so the glass and what it carries sink together (a plain scaleEffect on glass leaves the content
/// behind). Put the glass inside what it presses: the label of a button, the view this modifies. Under Reduce Motion
/// it shades instead of moving.
private struct PieceLiquidPress: ViewModifier {
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
        // A scale about `anchor` is a scale about the centre plus this shift toward the anchor.
        let lean = CGSize(width: (anchor.x - 0.5) * size.width * (1 - scale), height: (anchor.y - 0.5) * size.height * (1 - scale))
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .pieceLiquidScale(scale)
            .offset(lean)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

/// `PiecePressStyle` for glass buttons: the label (with its `.pieceLiquid` inside) sinks as one.
private struct PieceLiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed, depth: depth)
    }
}

private extension View {
    /// Sinks this view's glass while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func pieceLiquidPress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PieceLiquidPress(pressed: pressed, touch: touch, depth: depth))
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
