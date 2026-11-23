// swiftpieces:
// title: Avatar Drop
// description: "An avatar picker where the photo you choose travels: tap a photo in the grid and it lifts, arcs up to the empty avatar circle and rounds into it as it lands, with a soft bump and a ring that spreads from the edge. Pick another and it takes its place the same way. It wraps your own photo views and hands you the choice. For profile setup, contacts, group icons and accounts."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [avatar, profile, photo, picker, onboarding, contact, image]

import SwiftUI

/// Sizes and colors for `AvatarDrop`.
public struct AvatarDropStyle: Sendable {
    /// The avatar's diameter.
    public var avatarSize: CGFloat
    /// The gap between photos in the grid.
    public var spacing: CGFloat
    /// The photos' corner radius in the grid.
    public var cornerRadius: CGFloat
    /// How high the photo arcs on its way, in points.
    public var arc: CGFloat
    /// The ring that spreads when a photo lands.
    public var ring: Color
    /// The empty avatar's fill, dashed edge and plus.
    public var placeholder: Color
    public var placeholderMark: Color
    /// The name under the avatar, and the line under it.
    public var label: Color
    public var secondary: Color

    public init(
        avatarSize: CGFloat = 104,
        spacing: CGFloat = 6,
        cornerRadius: CGFloat = 12,
        arc: CGFloat = 70,
        ring: Color = Color(red: 1, green: 0, blue: 0),
        placeholder: Color = Color(UIColor.tertiarySystemFill),
        placeholderMark: Color = Color(UIColor.secondaryLabel),
        label: Color = Color(UIColor.label),
        secondary: Color = Color(UIColor.secondaryLabel)
    ) {
        self.avatarSize = avatarSize
        self.spacing = spacing
        self.cornerRadius = cornerRadius
        self.arc = arc
        self.ring = ring
        self.placeholder = placeholder
        self.placeholderMark = placeholderMark
        self.label = label
        self.secondary = secondary
    }

    public static let standard = AvatarDropStyle()
}

/// An avatar above a grid of photos; the photo you tap flies up into the avatar.
///
/// It takes the width it is offered and grows to the height the grid needs.
///
/// - Parameters:
///   - items: The photos to choose from.
///   - selection: The chosen photo's id, or `nil` for the empty avatar.
///   - columns: How many columns the grid has.
///   - name: Shown under the avatar.
///   - caption: Shown under the name once a photo is chosen, such as "Looking good".
///   - style: Sizes and colors.
///   - content: One photo. It is clipped to a square in the grid and to a circle in the avatar.
public struct AvatarDrop<Item: Identifiable, Content: View>: View {
    public typealias Style = AvatarDropStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var selection: Item.ID?
    @State private var width: CGFloat = 0
    @State private var flying: Item.ID?
    @State private var progress: CGFloat = 0
    @State private var ring: CGFloat = 1
    @State private var landings = 0
    @State private var landed: Item.ID?

    private let items: [Item]
    private let columns: Int
    private let name: String?
    private let caption: String?
    private let style: Style
    private let content: (Item) -> Content

    public init(
        _ items: [Item],
        selection: Binding<Item.ID?>,
        columns: Int = 4,
        name: String? = nil,
        caption: String? = nil,
        style: Style = .standard,
        @ViewBuilder content: @escaping (Item) -> Content
    ) {
        self.items = items
        self._selection = selection
        self.columns = max(1, columns)
        self.name = name
        self.caption = caption
        self.style = style
        self.content = content
    }

    public var body: some View {
        let cell = width > 0 ? (width - style.spacing * CGFloat(columns - 1)) / CGFloat(columns) : 72
        let rows = (items.count + columns - 1) / columns
        let gridTop = style.avatarSize + (name == nil ? 28 : 84)
        let height = gridTop + CGFloat(rows) * cell + CGFloat(max(rows - 1, 0)) * style.spacing
        let avatar = CGRect(x: width / 2 - style.avatarSize / 2, y: 0, width: style.avatarSize, height: style.avatarSize)

        ZStack(alignment: .topLeading) {
            avatarView
                .offset(x: avatar.minX)

            if let name {
                VStack(spacing: 4) {
                    Text(name)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(style.label)
                    Text(caption ?? " ")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.secondary)
                        .opacity(selection != nil && caption != nil ? 1 : 0)
                        .animation(.easeOut(duration: 0.25), value: selection != nil)
                }
                .frame(width: width)
                .offset(y: style.avatarSize + 14)
            }

            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                let frame = cellFrame(index, cell: cell, top: gridTop)
                Button {
                    choose(item)
                } label: {
                    content(item)
                        .frame(width: cell, height: cell)
                        .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
                        .overlay {
                            if item.id == selection {
                                RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
                                    .strokeBorder(style.ring, lineWidth: 3)
                            }
                        }
                        .opacity(item.id == flying ? 0.35 : 1)
                }
                .buttonStyle(.plain)
                .offset(x: frame.minX, y: frame.minY)
                .accessibilityLabel("Photo \(index + 1)")
                .accessibilityAddTraits(item.id == selection ? .isSelected : [])
            }

            if let flying, let index = items.firstIndex(where: { $0.id == flying }) {
                content(items[index])
                    .modifier(AvatarFlight(progress: progress, from: cellFrame(index, cell: cell, top: gridTop), to: avatar, corner: style.cornerRadius, arc: reduceMotion ? 0 : style.arc))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(height: height, alignment: .top)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .sensoryFeedback(.impact(weight: .medium), trigger: landings)
        .onChange(of: selection) { _, id in
            // A selection set from outside flies in too; one the flight itself just set does not.
            guard let id, id != landed, flying == nil else { landed = id; return }
            selection = landed
            fly(id)
        }
    }

    private var avatarView: some View {
        let size = style.avatarSize
        let chosen = items.first { $0.id == selection }
        return ZStack {
            if let chosen {
                content(chosen)
                    .frame(width: size, height: size)
                    .clipShape(.circle)
            } else {
                Circle()
                    .fill(style.placeholder)
                    .overlay {
                        Circle()
                            .strokeBorder(style.placeholderMark.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    }
                    .overlay {
                        Image(systemName: "plus")
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(style.placeholderMark)
                    }
            }
            Circle()
                .stroke(style.ring, lineWidth: 3)
                .scaleEffect(ring)
                .opacity(Double(max(0, 1.5 - ring) * 2))
                .allowsHitTesting(false)
        }
        .frame(width: size, height: size)
        .modifier(AvatarBump(trigger: landings, still: reduceMotion))
        .accessibilityElement()
        .accessibilityLabel(chosen == nil ? "No photo" : "Profile photo")
    }

    private func cellFrame(_ index: Int, cell: CGFloat, top: CGFloat) -> CGRect {
        CGRect(x: CGFloat(index % columns) * (cell + style.spacing), y: top + CGFloat(index / columns) * (cell + style.spacing), width: cell, height: cell)
    }

    private func choose(_ item: Item) {
        guard flying == nil, item.id != selection else { return }
        fly(item.id)
    }

    /// Flies photo `id` into the avatar, then makes it the selection.
    private func fly(_ id: Item.ID) {
        flying = id
        progress = 0
        withAnimation(reduceMotion ? .easeInOut(duration: 0.25) : .timingCurve(0.45, 0, 0.25, 1, duration: 0.62)) {
            progress = 1
        } completion: {
            landed = id
            selection = id
            flying = nil
            landings += 1
            ring = 1
            if !reduceMotion {
                withAnimation(.easeOut(duration: 0.6)) { ring = 1.5 }
            }
        }
    }
}

/// The avatar's bump as a photo lands: a quick swell and a springy settle.
private struct AvatarBump: ViewModifier {
    let trigger: Int
    let still: Bool

    func body(content: Content) -> some View {
        content.keyframeAnimator(initialValue: CGFloat(1), trigger: trigger) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            SpringKeyframe(still ? 1 : 1.08, duration: 0.12)
            SpringKeyframe(1, duration: 0.4, spring: .bouncy)
        }
    }
}

/// The chosen photo on its way: from its cell to the avatar along an arc, rounding from a square to a circle.
private struct AvatarFlight: ViewModifier, Animatable {
    var progress: CGFloat
    let from: CGRect
    let to: CGRect
    let corner: CGFloat
    let arc: CGFloat

    nonisolated var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let t: CGFloat = progress
        let arch: CGFloat = sin(CGFloat.pi * t)
        let size: CGFloat = from.width + (to.width - from.width) * t
        let lift: CGFloat = 1 + 0.08 * sin(CGFloat.pi * min(t * 1.4, 1))
        let x: CGFloat = from.midX + (to.midX - from.midX) * t
        let y: CGFloat = from.midY + (to.midY - from.midY) * t - arc * arch
        let round: CGFloat = min(t * 1.25, 1)
        let radius: CGFloat = corner + (size / 2 - corner) * round
        let shade: Double = Double(0.25 * arch)
        content
            .frame(width: size, height: size)
            .clipShape(.rect(cornerRadius: radius, style: .continuous))
            .shadow(color: .black.opacity(shade), radius: 12, y: 6)
            .scaleEffect(lift)
            .offset(x: x - size / 2, y: y - size / 2)
    }
}

// MARK: - Example

private struct AvatarDropPhoto: Identifiable {
    let id: Int
}

/// Profile setup: tap a print to make it Maya's avatar.
private struct AvatarDropExample: View {
    @State private var selection: Int?
    private let photos = [1, 4, 6, 0, 3, 7, 5, 2].map(AvatarDropPhoto.init(id:))

    var body: some View {
        AvatarDrop(photos, selection: $selection, name: "Maya Chen", caption: "Looking good") { photo in
            AvatarDropPrint(kind: photo.id)
        }
        .frame(width: 320)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

/// A flat print in the house palette, standing in for a photo in the example. Swap in your own images.
private struct AvatarDropPrint: View {
    /// Which of the eight prints: 0 Sunrise, 1 Lake, 2 Pines, 3 Waves, 4 Dunes, 5 Night, 6 Bloom, 7 Kite.
    var kind: Int

    private static let blue = Color(red: 0.18, green: 0.545, blue: 1)
    private static let yellow = Color(red: 1, green: 0.761, blue: 0.102)
    private static let teal = Color(red: 0, green: 0.769, blue: 0.655)
    private static let pink = Color(red: 1, green: 0, blue: 0.361)
    private static let orange = Color(red: 1, green: 0.541, blue: 0.122)
    private static let red = Color(red: 1, green: 0, blue: 0)
    private static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private static let paper = Color(red: 0.957, green: 0.953, blue: 0.937)

    var body: some View {
        Canvas { context, size in
            let w = size.width, h = size.height, m = min(w, h)
            func disc(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ color: Color) {
                context.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(color))
            }
            func band(_ y: CGFloat, _ height: CGFloat, _ color: Color) {
                context.fill(Path(CGRect(x: 0, y: y, width: w, height: height)), with: .color(color))
            }
            switch kind % 8 {
            case 0:
                band(0, h, Self.orange)
                disc(w * 0.5, h * 0.64, m * 0.34, Self.yellow)
                for (y, t) in [(0.66, 0.035), (0.74, 0.05), (0.83, 0.07), (0.93, 0.07)] as [(CGFloat, CGFloat)] { band(h * y, h * t, Self.pink) }
            case 1:
                band(0, h, Self.blue)
                disc(w * 0.7, h * 0.32, m * 0.13, Self.yellow)
                band(h * 0.6, h * 0.4, Self.teal)
                for (a, b, l) in [(0.2, 0.72, 0.22), (0.55, 0.8, 0.28), (0.3, 0.9, 0.18)] as [(CGFloat, CGFloat, CGFloat)] {
                    var ripple = Path()
                    ripple.move(to: CGPoint(x: w * a, y: h * b))
                    ripple.addLine(to: CGPoint(x: w * (a + l), y: h * b))
                    context.stroke(ripple, with: .color(Self.paper), style: StrokeStyle(lineWidth: max(1, m * 0.025), lineCap: .round))
                }
            case 2:
                band(0, h, Self.teal)
                disc(w * 0.3, h * 0.32, m * 0.17, Self.pink)
                let count = max(4, Int((w / m * 5).rounded()))
                for i in 0..<count {
                    let x = (CGFloat(i) + 0.5) / CGFloat(count) * w, half = w / CGFloat(count) * 0.62
                    let height = h * (0.34 + CGFloat((i * 37) % 5) / 5 * 0.2)
                    var pine = Path()
                    pine.move(to: CGPoint(x: x, y: h - height))
                    pine.addLine(to: CGPoint(x: x + half, y: h))
                    pine.addLine(to: CGPoint(x: x - half, y: h))
                    pine.closeSubpath()
                    context.fill(pine, with: .color(Self.ink))
                }
            case 3:
                band(0, h, Self.pink)
                disc(w * 0.72, h * 0.3, m * 0.16, Self.yellow)
                for (j, color) in [Self.blue, Self.teal].enumerated() {
                    let r = m * 0.1, y = h * (0.62 + CGFloat(j) * 0.16)
                    var waves = Path()
                    waves.move(to: CGPoint(x: -r * 3, y: h))
                    waves.addLine(to: CGPoint(x: -r * 3, y: y + r))
                    var x = -r * 2 + CGFloat(j) * r
                    while x < w + r * 3 {
                        waves.addArc(center: CGPoint(x: x, y: y + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
                        x += r * 2
                    }
                    waves.addLine(to: CGPoint(x: w + r * 3, y: h))
                    waves.closeSubpath()
                    context.fill(waves, with: .color(color))
                }
            case 4:
                band(0, h, Self.yellow)
                disc(w * 0.66, h * 0.3, m * 0.1, Self.red)
                disc(w * 0.18, h + m * 0.25, m * 0.62, Self.orange)
                disc(w * 0.9, h + m * 0.38, m * 0.6, Self.pink)
            case 5:
                band(0, h, Self.ink)
                disc(w * 0.62, h * 0.38, m * 0.22, Self.blue)
                disc(w * 0.62 + m * 0.1, h * 0.38 - m * 0.06, m * 0.2, Self.ink)
                for (a, b) in [(0.2, 0.2), (0.3, 0.6), (0.15, 0.45), (0.85, 0.75), (0.42, 0.15), (0.8, 0.18)] as [(CGFloat, CGFloat)] {
                    disc(w * a, h * b, max(0.8, m * 0.012), Self.paper)
                }
                band(h * 0.84, h * 0.16, Self.teal)
            case 6:
                band(0, h, Self.blue)
                let r = m * 0.14
                for i in 0..<6 {
                    let angle = Double(i) / 6 * 2 * .pi
                    disc(w * 0.5 + CGFloat(cos(angle)) * r * 1.25, h * 0.5 + CGFloat(sin(angle)) * r * 1.25, r, Self.pink)
                }
                disc(w * 0.5, h * 0.5, r * 0.9, Self.yellow)
            default:
                band(0, h, Self.orange)
                let x = w * 0.56, y = h * 0.4, s = m * 0.24
                var kite = Path()
                kite.move(to: CGPoint(x: x, y: y - s))
                kite.addLine(to: CGPoint(x: x + s * 0.7, y: y))
                kite.addLine(to: CGPoint(x: x, y: y + s * 1.2))
                kite.addLine(to: CGPoint(x: x - s * 0.7, y: y))
                kite.closeSubpath()
                context.fill(kite, with: .color(Self.teal))
                var shade = Path()
                shade.move(to: CGPoint(x: x, y: y - s))
                shade.addLine(to: CGPoint(x: x, y: y + s * 1.2))
                shade.addLine(to: CGPoint(x: x + s * 0.7, y: y))
                shade.closeSubpath()
                context.fill(shade, with: .color(Self.ink.opacity(0.18)))
                var string = Path()
                string.move(to: CGPoint(x: x, y: y + s * 1.2))
                string.addCurve(to: CGPoint(x: w * 0.2, y: h * 1.02), control1: CGPoint(x: x - s, y: y + s * 2), control2: CGPoint(x: x + s * 0.4, y: h * 0.85))
                context.stroke(string, with: .color(Self.ink), lineWidth: max(1, m * 0.012))
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Light") {
    AvatarDropExample()
}

#Preview("Dark") {
    AvatarDropExample()
        .preferredColorScheme(.dark)
}
