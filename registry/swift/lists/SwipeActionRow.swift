// swiftpieces:
// title: Swipe Action Row
// description: Wraps any row in a soft card with swipe actions drawn as solid color blocks. Tiles grow in as the row opens, the drag rubber-bands, a full swipe arms with a haptic and lets the edge block take the whole bar, and a shared binding keeps one row open at a time.
// category: lists
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: transaction-row
// tags: [list, swipe, gesture, actions, blocks]

import SwiftUI
import UIKit

/// Row with swipe-to-reveal actions that works in a plain `VStack` or `ScrollView`, not only in `List`.
///
/// - Parameters:
///   - id: Identity used with `open`. Defaults to a private id, which still lets a parent close the row.
///   - leading: Actions revealed by swiping right. The first one sits at the edge and fires on a full swipe.
///   - trailing: Actions revealed by swiping left. The first one sits at the edge and fires on a full swipe.
///   - background: Opaque surface of the row card, which covers the tiles when closed. `nil` uses `style.surface`.
///   - open: Shared binding to the id of the open row. Swiping a row stores its id here and closes every other row bound to it; set it to `nil` to close all, or to a row id to reveal that row's trailing actions.
///   - style: Card surface, corner radius, tile ink, tile width and gap. Defaults to the house palette.
///   - content: Row content.
public struct SwipeActionRow<Content: View>: View {
    public typealias Style = SwipeActionRowStyle

    /// One swipe action, drawn as a solid block with dark ink.
    public struct Action: Identifiable {
        public let id = UUID()
        public let title: String
        public let systemImage: String
        public let tint: Color
        public let role: ButtonRole?
        public let handler: () -> Void

        /// - Parameters:
        ///   - title: Label under the glyph, and the VoiceOver action name.
        ///   - systemImage: SF Symbol for the tile.
        ///   - tint: Block color. Light blocks read best with the default dark ink.
        ///   - role: Pass `.destructive` for delete-style actions.
        ///   - handler: Runs when the tile is tapped, the full swipe fires, or VoiceOver performs the action.
        public init(_ title: String, systemImage: String, tint: Color = Color(red: 0.612, green: 0.761, blue: 1), role: ButtonRole? = nil, handler: @escaping () -> Void) {
            self.title = title
            self.systemImage = systemImage
            self.tint = tint
            self.role = role
            self.handler = handler
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGFloat = 0
    @State private var dragStart: CGFloat? = nil
    @State private var armed = false
    @State private var rowWidth: CGFloat = 0
    @State private var fallbackID = UUID()

    private let id: AnyHashable?
    private let leading: [Action]
    private let trailing: [Action]
    private let background: Color?
    private let open: Binding<AnyHashable?>?
    private let style: Style
    private let content: Content

    public init(id: AnyHashable? = nil, leading: [Action] = [], trailing: [Action] = [], background: Color? = nil, open: Binding<AnyHashable?>? = nil, style: Style = .standard, @ViewBuilder content: () -> Content) {
        self.id = id
        self.leading = leading
        self.trailing = trailing
        self.background = background
        self.open = open
        self.style = style
        self.content = content()
    }

    private var rowID: AnyHashable { id ?? AnyHashable(fallbackID) }
    private var isOpen: Bool { offset != 0 }
    private var lift: Double { Double(min(1, abs(offset) / 40)) }
    private var card: RoundedRectangle { RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous) }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background ?? style.surface, in: card)
            // The sliding card lifts off the tiles as it opens, so it reads as a layer above them.
            .shadow(color: .black.opacity(0.16 * lift), radius: 14, x: offset > 0 ? -3 : 3, y: 4 * lift)
            .offset(x: offset)
            .background(alignment: .leading) { tileBar(leading, edge: .leading) }
            .background(alignment: .trailing) { tileBar(trailing, edge: .trailing) }
            // Clip sideways only, so the lifted card keeps its shadow above and below.
            .mask { Rectangle().padding(.vertical, -24) }
            .contentShape(card)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { rowWidth = $0 }
            .simultaneousGesture(TapGesture().onEnded { if isOpen { settle(to: nil) } })
            .gesture(drag)
            .onChange(of: open?.wrappedValue) { _, current in
                if current == rowID, !isOpen { settle(to: trailing.isEmpty ? .leading : .trailing, notify: false) }
                if current != rowID, isOpen { settle(to: nil, notify: false) }
            }
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: armed) { _, isArmed in isArmed }
            .accessibilityActions {
                ForEach(leading + trailing) { action in
                    Button(action.title, role: action.role, action: action.handler)
                }
            }
    }

    // MARK: Tiles

    @ViewBuilder
    private func tileBar(_ actions: [Action], edge: HorizontalEdge) -> some View {
        let revealed = edge == .leading ? max(offset, 0) : max(-offset, 0)
        if let first = actions.first, revealed > 0 {
            // 0 as the row starts to move, 1 once the tiles are fully revealed.
            let reveal = min(1, revealed / width(of: actions))
            // The first declared action sits at the screen edge, like `.swipeActions`.
            let ordered = edge == .leading ? actions : Array(actions.reversed())
            let room = max(revealed - style.tileGap * CGFloat(actions.count), 0)
            HStack(spacing: 0) {
                if edge == .trailing { Color.clear.frame(width: style.tileGap) }
                ForEach(Array(ordered.enumerated()), id: \.element.id) { index, action in
                    let expanded = armed && action.id == first.id
                    let tileWidth = armed ? (expanded ? room + style.tileGap * CGFloat(actions.count - 1) : 0) : room / CGFloat(actions.count)
                    Button(role: action.role) { perform(action) } label: {
                        tile(action, reveal: reveal, expanded: expanded)
                    }
                    .buttonStyle(TilePress(reduceMotion: reduceMotion))
                    .frame(width: tileWidth)
                    .background(action.tint, in: RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
                    .clipShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
                    .opacity(tileWidth < 1 ? 0 : 1)
                    if index < ordered.count - 1, !armed { Color.clear.frame(width: style.tileGap) }
                }
                if edge == .leading { Color.clear.frame(width: style.tileGap) }
            }
            .frame(width: revealed, alignment: edge == .leading ? .leading : .trailing)
            .animation(reduceMotion ? .easeOut(duration: 0.15) : .snappy(duration: 0.25), value: armed)
            .accessibilityHidden(true)
        }
    }

    private func tile(_ action: Action, reveal: CGFloat, expanded: Bool) -> some View {
        VStack(spacing: 6) {
            Image(systemName: action.systemImage)
                .font(.system(size: 20, weight: .semibold))
                .symbolEffect(.bounce, value: expanded)
                // The glyph grows in with the reveal, so a short peek shows a small icon, not a cropped one.
                .scaleEffect(reduceMotion ? 1 : 0.55 + 0.45 * reveal + (expanded ? 0.12 : 0))
            Text(action.title)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .opacity(reduceMotion ? 1 : max(0, (reveal - 0.45) / 0.55))
        }
        .foregroundStyle(style.tileInk)
        .frame(width: style.tileWidth)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(.rect)
    }

    // MARK: Gesture

    private var drag: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                if dragStart == nil {
                    // Only claim drags that start horizontally; vertical ones belong to the scroll view.
                    guard abs(value.translation.width) > abs(value.translation.height) else { return }
                    dragStart = offset
                    // Claiming the shared binding closes whichever row was open.
                    if let open, open.wrappedValue != rowID { open.wrappedValue = rowID }
                }
                guard let dragStart else { return }
                offset = clamp(dragStart + value.translation.width)
                let nowArmed = fullSwipeAction != nil
                if nowArmed != armed { armed = nowArmed }
            }
            .onEnded { value in
                guard let start = dragStart else { return }
                dragStart = nil
                if let action = fullSwipeAction {
                    armed = false
                    settle(to: nil)
                    action.handler()
                    return
                }
                let projected = start + value.predictedEndTranslation.width
                if projected > width(of: leading) / 2 { settle(to: .leading) }
                else if projected < -width(of: trailing) / 2 { settle(to: .trailing) }
                else { settle(to: nil) }
            }
    }

    private func clamp(_ x: CGFloat) -> CGFloat {
        if x > 0 { return leading.isEmpty ? rubberBand(x) : x }
        if x < 0 { return trailing.isEmpty ? -rubberBand(-x) : x }
        return 0
    }

    /// Eases the drag toward a 40pt limit when there is nothing to reveal.
    private func rubberBand(_ x: CGFloat) -> CGFloat { 40 * (1 - 1 / (1 + x / 40)) }

    private func width(of actions: [Action]) -> CGFloat { (style.tileWidth + style.tileGap) * CGFloat(actions.count) }

    /// The action a full swipe would fire, once the drag passes 60% of the row.
    private var fullSwipeAction: Action? {
        let threshold = max(rowWidth * 0.6, style.tileWidth * 2)
        if offset > threshold { return leading.first }
        if offset < -threshold { return trailing.first }
        return nil
    }

    private func settle(to edge: HorizontalEdge?, notify: Bool = true) {
        let target: CGFloat = switch edge {
        case .leading: width(of: leading)
        case .trailing: -width(of: trailing)
        case nil: 0
        }
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0.18)) { offset = target }
        guard notify, let open else { return }
        if target == 0, open.wrappedValue == rowID { open.wrappedValue = nil }
        if target != 0, open.wrappedValue != rowID { open.wrappedValue = rowID }
    }

    private func perform(_ action: Action) {
        settle(to: nil)
        action.handler()
    }
}

/// Look of a `SwipeActionRow`. Start from `.standard` and change what you need.
public struct SwipeActionRowStyle: Sendable {
    /// Row card fill. Adapts to light and dark.
    public var surface: Color = SwipeActionRowStyle.adaptive(0xFFFFFF, 0x1C1C1C)
    /// Ink for tile glyphs and labels. Dark, so it reads on every light block.
    public var tileInk: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
    /// Corner radius of the card and the tiles.
    public var cornerRadius: CGFloat = 26
    /// Width of one revealed tile.
    public var tileWidth: CGFloat = 78
    /// Gap between the card and the tiles, and between tiles.
    public var tileGap: CGFloat = 6

    public init() {}

    /// The house palette: white or charcoal cards, 26pt radius, blocks with dark ink.
    public static let standard = SwipeActionRowStyle()

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// Tiles dip slightly under the finger.
private struct TilePress: ButtonStyle {
    let reduceMotion: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.3), value: configuration.isPressed)
    }
}

// MARK: - Example

/// Three rows, with read, snooze and delete as blocks. Nothing around them.
private struct SwipeActionRowExample: View {
    @State private var open: AnyHashable? = nil
    private let messages: [(String, String, String, String, Color)] = [
        ("MA", "Mara Lindqvist", "Final cut of the launch film", "9:41", Color(red: 0.914, green: 0.835, blue: 0.702)),
        ("JO", "Jonas Okafor", "Studio booking for Thursday", "8:12", Color(red: 0.663, green: 0.863, blue: 0.718)),
        ("PR", "Priya Raman", "Notes from the pricing review", "Mon", Color(red: 0.804, green: 0.722, blue: 1)),
    ]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(messages, id: \.1) { initials, name, subject, time, color in
                SwipeActionRow(
                    id: name,
                    leading: [.init("Read", systemImage: "envelope.open", tint: Color(red: 0.612, green: 0.761, blue: 1)) {}],
                    trailing: [
                        .init("Delete", systemImage: "trash", tint: Color(red: 1, green: 0, blue: 0), role: .destructive) {},
                        .init("Snooze", systemImage: "moon.zzz", tint: Color(red: 1, green: 0.851, blue: 0.463)) {},
                    ],
                    open: $open
                ) {
                    HStack(spacing: 14) {
                        Text(initials)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                            .frame(width: 46, height: 46)
                            .background(color, in: Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(name).font(.headline)
                            Text(subject).font(.subheadline).foregroundStyle(ExampleInk.muted).lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        Text(time).font(.footnote.monospacedDigit()).foregroundStyle(ExampleInk.muted)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ExampleInk.ground)
        .task {
            try? await Task.sleep(for: .seconds(0.8))
            open = "Jonas Okafor"
        }
    }
}

private enum ExampleInk {
    static let ground = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) })
    static let muted = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.651, green: 0.643, blue: 0.624, alpha: 1) : UIColor(red: 0.361, green: 0.353, blue: 0.337, alpha: 1) })
}

#Preview("Light") {
    SwipeActionRowExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    SwipeActionRowExample().preferredColorScheme(.dark)
}
