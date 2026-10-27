// swiftpieces:
// title: Swatch Picker
// description: "A row of color swatches for tags, lists, calendars and themes. The selection ring flows to the swatch you tap like liquid, its leading edge reaching the new swatch first and the trailing edge following, and a check pops into the picked swatch in ink or white, whichever reads on it. Each swatch is a named color, so VoiceOver reads its name; the defaults are the SwiftPieces house blocks. A row wider than the screen scrolls."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-10-27"
// tags: [color, picker, swatch, tags, selection, haptics]

import SwiftUI

/// Colors for `SwatchPicker`. `.standard` is the house palette.
public struct SwatchPickerStyle: Sendable {
    /// The selection ring.
    public var ring: Color
    /// The ring's line width.
    public var ringWidth: CGFloat
    /// The gap between the ring and its swatch.
    public var ringGap: CGFloat

    public init(ring: Color = SwatchPickerStyle.adaptive(light: 0x141414, dark: 0xF4F3EF), ringWidth: CGFloat = 2.5, ringGap: CGFloat = 3) {
        self.ring = ring
        self.ringWidth = ringWidth
        self.ringGap = ringGap
    }

    public static let standard = SwatchPickerStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A row of named color swatches with a selection ring that flows from swatch to swatch.
///
/// - Parameters:
///   - selection: The chosen swatch. Setting it from outside moves the ring the same way a tap does.
///   - swatches: The colors, in order, each with the name VoiceOver reads. Defaults to `SwatchPicker.house`.
///   - size: The diameter of a swatch. The tap target stays at least 44pt.
///   - spacing: The gap between swatches.
///   - style: The ring's color and weight. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct SwatchPicker: View {
    public typealias Style = SwatchPickerStyle

    /// One named color.
    public struct Swatch: Hashable, Sendable, Identifiable {
        public var name: String
        public var color: Color
        public var id: String { name }

        public init(_ name: String, _ color: Color) {
            self.name = name
            self.color = color
        }
    }

    /// The SwiftPieces house blocks: the brand red and five pastels.
    public static let house: [Swatch] = [
        Swatch("Red", Color(red: 1, green: 0, blue: 0)),
        Swatch("Sky", Color(red: 0.612, green: 0.761, blue: 1)),
        Swatch("Butter", Color(red: 1, green: 0.851, blue: 0.463)),
        Swatch("Sage", Color(red: 0.663, green: 0.863, blue: 0.718)),
        Swatch("Lilac", Color(red: 0.804, green: 0.722, blue: 1)),
        Swatch("Sand", Color(red: 0.914, green: 0.835, blue: 0.702)),
    ]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.self) private var environment
    @Binding private var selection: Swatch
    /// The ring's leading and trailing edges, in swatches from the row's start. Each is sprung on its own.
    @State private var lower: CGFloat
    @State private var upper: CGFloat
    @State private var picks = 0

    private let swatches: [Swatch]
    private let size: CGFloat
    private let spacing: CGFloat
    private let style: Style

    public init(selection: Binding<Swatch>, swatches: [Swatch] = SwatchPicker.house, size: CGFloat = 34, spacing: CGFloat = 14, style: Style = .standard) {
        self._selection = selection
        self.swatches = swatches
        self.size = size
        self.spacing = spacing
        self.style = style
        let index = CGFloat(swatches.firstIndex(of: selection.wrappedValue) ?? 0)
        self._lower = State(initialValue: index)
        self._upper = State(initialValue: index + 1)
    }

    public var body: some View {
        ViewThatFits(in: .horizontal) {
            row
            ScrollView(.horizontal, showsIndicators: false) { row }
        }
        .opacity(isEnabled ? 1 : 0.45)
        .sensoryFeedback(.selection, trigger: picks)
        .onChange(of: selection) { _, new in
            guard let index = swatches.firstIndex(of: new) else { return }
            flow(to: index)
        }
    }

    private var row: some View {
        HStack(spacing: spacing) {
            ForEach(swatches) { swatch in
                Button { pick(swatch) } label: { dot(swatch) }
                    .buttonStyle(PiecePressStyle(depth: 2))
                    .accessibilityLabel(swatch.name)
                    .accessibilityAddTraits(swatch == selection ? .isSelected : [])
            }
        }
        .overlay(alignment: .leading) { ring }
        .padding(.horizontal, style.ringGap + style.ringWidth)
        .frame(minHeight: 44)
    }

    private func dot(_ swatch: Swatch) -> some View {
        let chosen = swatch == selection
        return Circle()
            .fill(swatch.color)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(ink(on: swatch.color))
                    .scaleEffect(chosen ? 1 : 0.3)
                    .opacity(chosen ? 1 : 0)
                    .animation(PieceMotion(reduceMotion: reduceMotion).success, value: chosen)
            }
            // Half the gap on every side counts as the swatch, so the tap target reaches 44pt at the default size.
            .contentShape(Circle().inset(by: -spacing / 2))
    }

    /// The ring, between its two edges. Stretched across two swatches it is a capsule; at rest, a circle.
    private var ring: some View {
        // The ring's outer edge stands this far outside the swatch.
        let pitch = size + spacing, out = style.ringGap + style.ringWidth
        return SwatchPickerEdge(value: lower) { lower in
            SwatchPickerEdge(value: upper) { upper in
                let width = (upper - lower) * pitch - spacing + out * 2
                Capsule()
                    .strokeBorder(style.ring, lineWidth: style.ringWidth)
                    .frame(width: max(width, size * 0.6), height: size + out * 2)
                    .offset(x: lower * pitch - out)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Selection

    private func pick(_ swatch: Swatch) {
        guard swatch != selection else { return }
        picks += 1
        selection = swatch
    }

    /// The edge facing the new swatch leads on the tight spring and the far edge follows on the responsive one, so
    /// the ring reaches across and gathers in. Under Reduce Motion both share one short spring and it slides whole.
    private func flow(to index: Int) {
        let newLower = CGFloat(index), newUpper = newLower + 1
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard !reduceMotion else {
            withAnimation(motion.snap) {
                lower = newLower
                upper = newUpper
            }
            return
        }
        let forward = newLower > lower
        withAnimation(.spring(forward ? PieceMotion.tight : PieceMotion.responsive)) { upper = newUpper }
        withAnimation(.spring(forward ? PieceMotion.responsive : PieceMotion.tight)) { lower = newLower }
    }

    /// The house ink on a light swatch and white on a dark one, by the swatch's luminance as it resolves here.
    private func ink(on color: Color) -> Color {
        let c = color.resolve(in: environment)
        let luminance = 0.2126 * Double(c.linearRed) + 0.7152 * Double(c.linearGreen) + 0.0722 * Double(c.linearBlue)
        return luminance > 0.18 ? Color(red: 0.078, green: 0.078, blue: 0.078) : .white
    }
}

/// One edge of the ring, animated on its own: two nested give the two edges separate springs.
private struct SwatchPickerEdge<Content: View>: View, Animatable {
    var value: CGFloat
    @ViewBuilder let content: (CGFloat) -> Content

    nonisolated var animatableData: CGFloat {
        get { value }
        set { value = newValue }
    }

    var body: some View { content(value) }
}

// MARK: - Example

/// A tag color, with the tag it colors.
private struct SwatchPickerExample: View {
    @State private var color = SwatchPicker.house[1]

    var body: some View {
        VStack(spacing: 28) {
            SwatchPicker(selection: $color)
            HStack(spacing: 8) {
                Circle().fill(color.color).frame(width: 12, height: 12)
                Text("Weekend trips")
            }
            .fontWeight(.semibold)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.background, in: .capsule)
            .animation(.easeOut(duration: 0.3), value: color)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SwatchPickerStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    SwatchPickerExample()
}

#Preview("Dark") {
    SwatchPickerExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press, pressStyle)

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

// swiftpieces-motion: end
