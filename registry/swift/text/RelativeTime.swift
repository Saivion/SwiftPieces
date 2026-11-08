// swiftpieces:
// title: Relative Time
// description: "A timestamp that keeps itself current: just now, then 1 min ago, then Yesterday, rolling up to each new wording. It wakes only when the wording would change, so it costs nothing in between, even in a long feed. Tap it to see the exact date and time in red, and tap again to go back. It follows the locale through Foundation's RelativeDateTimeFormatter, and VoiceOver reads it in full, as in 1 minute ago. For feeds, messages, activity and comments."
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [time, date, relative, timestamp, feed, locale, accessibility]

import SwiftUI

/// Colors and type for `RelativeTime`. `.standard` is the house palette.
public struct RelativeTimeStyle: Sendable {
    /// The relative wording.
    public var label: Color
    /// The exact date, after a tap.
    public var accent: Color
    /// The font.
    public var font: Font

    public init(
        label: Color = RelativeTimeStyle.adaptive(light: 0x5C5A56, dark: 0xA6A49F),
        accent: Color = RelativeTimeStyle.adaptive(light: 0xE00000, dark: 0xFF3B30),
        font: Font = .subheadline
    ) {
        self.label = label
        self.accent = accent
        self.font = font
    }

    public static let standard = RelativeTimeStyle()

    /// A color that follows the appearance, from two 0xRRGGBB values.
    public static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// A relative timestamp that updates itself when its wording changes, and shows the exact date when tapped.
///
/// - Parameters:
///   - date: The moment to describe.
///   - tapToReveal: Whether a tap toggles the exact date and time.
///   - style: Colors and type. Defaults to the house palette, adapting to light and dark.
public struct RelativeTime: View {
    public typealias Style = RelativeTimeStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale
    @State private var now = Date()
    @State private var showsExact = false

    private let date: Date
    private let tapToReveal: Bool
    private let style: Style

    public init(_ date: Date, tapToReveal: Bool = true, style: Style = .standard) {
        self.date = date
        self.tapToReveal = tapToReveal
        self.style = style
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let text = showsExact ? exact : relative(.short)
        Text(text)
            .font(style.font)
            .fontWeight(.semibold)
            .monospacedDigit()
            .lineLimit(1)
            .foregroundStyle(showsExact ? style.accent : style.label)
            .id(text)
            .transition(motion.transition(.push(from: showsExact ? .bottom : .top)))
            .frame(alignment: .leading)
            .clipped()
            .contentShape(.rect)
            .onTapGesture {
                guard tapToReveal else { return }
                withAnimation(motion.snap) { showsExact.toggle() }
            }
            .task(id: date) {
                // Sleep until the wording would change, then roll to it. Nothing runs in between.
                while !Task.isCancelled {
                    withAnimation(motion.snap) { now = Date() }
                    try? await Task.sleep(for: .seconds(RelativeTime.nextChange(since: date, at: Date())))
                }
            }
            .accessibilityElement()
            .accessibilityLabel(showsExact ? exact : relative(.full))
            .accessibilityAddTraits(tapToReveal ? .isButton : [])
            .accessibilityHint(tapToReveal ? (showsExact ? "Shows how long ago" : "Shows the exact time") : "")
    }

    /// "just now" under a minute; after that the locale's own wording, such as "1 min. ago" or "Yesterday".
    private func relative(_ units: RelativeDateTimeFormatter.UnitsStyle) -> String {
        let seconds = now.timeIntervalSince(date)
        if abs(seconds) < 60 { return String(localized: "just now") }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = locale
        formatter.dateTimeStyle = .named
        formatter.unitsStyle = units
        formatter.formattingContext = .beginningOfSentence
        return formatter.localizedString(for: date, relativeTo: now)
    }

    private var exact: String {
        date.formatted(.dateTime.month(.abbreviated).day().hour().minute().locale(locale))
    }

    /// Seconds until the relative wording next changes: the next whole minute, hour or day since `date`.
    private static func nextChange(since date: Date, at now: Date) -> Double {
        let elapsed = abs(now.timeIntervalSince(date))
        let step: Double = elapsed < 60 ? 60 : elapsed < 3_600 ? 60 : elapsed < 86_400 ? 3_600 : 86_400
        let remaining = step - elapsed.truncatingRemainder(dividingBy: step)
        return max(remaining + 0.05, 1)
    }
}

// MARK: - Example

/// A short activity list, each row with its own timestamp.
private struct RelativeTimeExample: View {
    private let rows: [(String, String, Date)] = [
        ("Message sent", "paperplane.fill", Date()),
        ("Draft edited", "pencil", Date(timeIntervalSinceNow: -50)),
        ("Backup done", "checkmark", Date(timeIntervalSinceNow: -26 * 3_600)),
    ]

    var body: some View {
        VStack(spacing: 10) {
            ForEach(rows, id: \.0) { row in
                HStack(spacing: 12) {
                    Image(systemName: row.1)
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                        .frame(width: 32, height: 32)
                        .background(Color(red: 0.612, green: 0.761, blue: 1), in: .circle)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.0).fontWeight(.semibold)
                        RelativeTime(row.2)
                    }
                    Spacer()
                }
                .padding(.horizontal, 14)
                .frame(height: 58)
                .background(.background, in: .rect(cornerRadius: 22, style: .continuous))
            }
        }
        .frame(width: 280)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RelativeTimeStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    RelativeTimeExample()
}

#Preview("Dark") {
    RelativeTimeExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

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

// swiftpieces-motion: end
