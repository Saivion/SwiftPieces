// swiftpieces:
// title: Parallax Card
// description: An image card whose picture drifts slower than the scroll while a solid caption block drifts slower still, so the card reads in layers. Press lifts it with a deeper shadow and nudges the trailing glyph, and the caption is composed from eyebrow, title, metadata, and trailing glyph slots.
// category: cards
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: hero-expand
// tags: [card, parallax, image, scroll, press, caption]

import SwiftUI

/// Image card with two-layer scroll parallax, press-to-lift, and a slotted caption.
///
/// - Parameters:
///   - image: The picture to show, scaled to fill.
///   - eyebrow: Optional small uppercase line above the title, for a category or date.
///   - title: Title drawn in the caption.
///   - metadata: Optional short facts shown in a dot-separated row under the title.
///   - trailingSymbol: Optional SF Symbol drawn in a circle at the caption's trailing end, for example "arrow.up.right".
///   - height: Card height.
///   - parallax: How far the image drifts, as a fraction of `height` on each side. The caption drifts at a third of that. 0 disables the effect.
///   - cornerRadius: Corner radius of the card.
///   - style: Caption treatment and colors. `.standard` is a butter caption block with dark ink; `.scrim` puts white text over a darkened bottom edge.
///   - action: Optional tap handler. When set, the card lifts on press and reads as a button.
public struct ParallaxCard: View {
    /// How the caption sits on the picture, and its colors.
    public struct Style: Sendable {
        /// Caption treatment.
        public enum Caption: Sendable {
            /// A solid, inset block that drifts over the picture.
            case block
            /// White text over a bottom scrim, for busy photos that should stay edge to edge.
            case scrim
        }

        /// Caption treatment.
        public var caption: Caption
        /// Fill of the caption block. Ignored for `.scrim`.
        public var captionFill: Color
        /// Text color in the caption block. Ignored for `.scrim`, which is always white.
        public var captionInk: Color
        /// Resting shadow strength in light mode; dark mode uses about three times this.
        public var shadowOpacity: Double

        public init(caption: Caption = .block, captionFill: Color = Color(red: 1, green: 0.851, blue: 0.463), captionInk: Color = Color(red: 0.078, green: 0.078, blue: 0.078), shadowOpacity: Double = 0.12) {
            self.caption = caption
            self.captionFill = captionFill
            self.captionInk = captionInk
            self.shadowOpacity = shadowOpacity
        }

        /// House default: a butter caption block with dark ink.
        public static let standard = Style()
        /// White caption over a bottom scrim.
        public static let scrim = Style(caption: .scrim)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    private let image: Image
    private let eyebrow: String?
    private let title: String
    private let metadata: [String]
    private let trailingSymbol: String?
    private let height: CGFloat
    private let parallax: CGFloat
    private let cornerRadius: CGFloat
    private let style: Style
    private let action: (() -> Void)?

    public init(image: Image, eyebrow: String? = nil, title: String, metadata: [String] = [], trailingSymbol: String? = nil, height: CGFloat = 240, parallax: CGFloat = 0.25, cornerRadius: CGFloat = 26, style: Style = .standard, action: (() -> Void)? = nil) {
        self.image = image
        self.eyebrow = eyebrow
        self.title = title
        self.metadata = metadata
        self.trailingSymbol = trailingSymbol
        self.height = height
        self.parallax = parallax
        self.cornerRadius = cornerRadius
        self.style = style
        self.action = action
    }

    private var shadow: Double { min(style.shadowOpacity * (colorScheme == .dark ? 3 : 1), 1) }

    public var body: some View {
        if let action {
            Button(action: action) { card }
                .buttonStyle(Lift(scales: !reduceMotion, shadow: shadow))
        } else {
            card
                .shadow(color: .black.opacity(shadow), radius: 16, y: 10)
        }
    }

    /// Position of the card within the scroll viewport, -1 (entering at the bottom) to 1 (leaving at the top).
    nonisolated private static func progress(_ proxy: GeometryProxy) -> CGFloat {
        let frame = proxy.frame(in: .scrollView)
        let viewport = proxy.bounds(of: .scrollView)?.height ?? frame.height
        let raw = (frame.midY - viewport / 2) / max((viewport + frame.height) / 2, 1)
        return min(max(raw, -1), 1)
    }

    private var card: some View {
        let travel = reduceMotion ? 0 : height * parallax
        let tightens = !reduceMotion
        return Color.clear
            .frame(height: height)
            .overlay {
                image
                    .resizable()
                    .scaledToFill()
                    // Oversize the image by the maximum drift so the edges never show through.
                    .frame(height: height + travel * 2)
                    .visualEffect { content, proxy in
                        content.offset(y: -Self.progress(proxy) * travel)
                    }
                    .accessibilityHidden(true)
            }
            .overlay(alignment: .bottom) {
                if style.caption == .scrim {
                    // The scrim is tallest when the card is centered and tightens as it leaves the viewport.
                    LinearGradient(colors: [.clear, .black.opacity(0.72)], startPoint: .top, endPoint: .bottom)
                        .frame(height: height * 0.6)
                        .visualEffect { content, proxy in
                            content.scaleEffect(y: tightens ? 1.3 - 0.4 * abs(Self.progress(proxy)) : 1, anchor: .bottom)
                        }
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .bottomLeading) {
                Caption(eyebrow: eyebrow, title: title, metadata: metadata, trailingSymbol: trailingSymbol, cornerRadius: cornerRadius, style: style)
                    .visualEffect { content, proxy in
                        content.offset(y: -Self.progress(proxy) * travel / 3)
                    }
            }
            .clipShape(.rect(cornerRadius: cornerRadius, style: .continuous))
            .accessibilityElement(children: .combine)
    }

    /// The caption slots, as a solid block or as white text over the scrim. Reads the press state from the button style.
    private struct Caption: View {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @Environment(\.parallaxCardPressed) private var pressed
        let eyebrow: String?
        let title: String
        let metadata: [String]
        let trailingSymbol: String?
        let cornerRadius: CGFloat
        let style: Style

        var body: some View {
            let block = style.caption == .block
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    if let eyebrow {
                        Text(eyebrow.uppercased())
                            .font(.caption2.weight(.bold))
                            .tracking(1)
                            .opacity(block ? 0.62 : 0.8)
                    }
                    Text(title)
                        .font(.system(.title2, weight: .bold))
                        .tracking(-0.6)
                        .lineLimit(2)
                    if !metadata.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(Array(metadata.enumerated()), id: \.offset) { index, item in
                                if index > 0 {
                                    Circle().frame(width: 3, height: 3).opacity(0.6)
                                }
                                Text(item)
                            }
                        }
                        .font(.subheadline.weight(.medium))
                        .opacity(block ? 0.62 : 0.85)
                        .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if let trailingSymbol {
                    Image(systemName: trailingSymbol)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(block ? style.captionFill : .black)
                        .offset(x: pressed && !reduceMotion ? 2 : 0, y: pressed && !reduceMotion ? -2 : 0)
                        .frame(width: 44, height: 44)
                        .background(block ? style.captionInk : .white, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .foregroundStyle(block ? style.captionInk : .white)
            .padding(block ? 16 : 20)
            .background {
                if block {
                    RoundedRectangle(cornerRadius: max(cornerRadius - 10, 12), style: .continuous)
                        .fill(style.captionFill)
                }
            }
            .padding(block ? 10 : 0)
        }
    }

    /// Press-to-lift: the card grows to 1.02, its shadow deepens, and the trailing glyph nudges toward its arrow, then everything springs back.
    private struct Lift: ButtonStyle {
        let scales: Bool
        let shadow: Double

        func makeBody(configuration: Configuration) -> some View {
            let pressed = configuration.isPressed
            configuration.label
                .environment(\.parallaxCardPressed, pressed)
                .scaleEffect(pressed && scales ? 1.02 : 1)
                .shadow(color: .black.opacity(pressed ? min(shadow * 1.8, 1) : shadow), radius: pressed ? 26 : 16, y: pressed ? 16 : 10)
                .animation(pressed ? .smooth(duration: 0.15) : .spring(duration: 0.4, bounce: 0.25), value: pressed)
        }
    }
}

private struct ParallaxCardPressedKey: EnvironmentKey {
    static let defaultValue = false
}

fileprivate extension EnvironmentValues {
    var parallaxCardPressed: Bool {
        get { self[ParallaxCardPressedKey.self] }
        set { self[ParallaxCardPressedKey.self] = newValue }
    }
}

// MARK: - Example

/// Walking routes: each picture is a flat color composition with a cropped giant word, and each caption a different block.
private struct ParallaxCardExample: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var art: [Int: Image] = [:]

    private struct Walk {
        let name: String
        let word: String
        let facts: [String]
        let sky: Color
        let sun: Color
        let caption: Color
    }

    private static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private static let tangerine = Color(red: 1, green: 0, blue: 0)
    private static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    private static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    private static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
    private static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
    private static let sand = Color(red: 0.914, green: 0.835, blue: 0.702)

    private let walks = [
        Walk(name: "Alfama at dusk", word: "ALFAMA", facts: ["3.2 km", "1 h 10 min"], sky: sky, sun: tangerine, caption: butter),
        Walk(name: "River to Belém", word: "BELÉM", facts: ["6.8 km", "2 h"], sky: sage, sun: butter, caption: lilac),
        Walk(name: "Graça viewpoints", word: "GRAÇA", facts: ["2.1 km", "45 min"], sky: lilac, sun: sky, caption: sand),
        Walk(name: "Chiado bookshops", word: "CHIADO", facts: ["1.6 km", "40 min"], sky: tangerine, sun: sand, caption: sage)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(walks.enumerated()), id: \.offset) { index, walk in
                    ParallaxCard(
                        image: art[index] ?? Image(systemName: "square"),
                        eyebrow: "Walk 0\(index + 1)",
                        title: walk.name,
                        metadata: walk.facts,
                        trailingSymbol: "arrow.up.right",
                        height: 250,
                        style: ParallaxCard.Style(captionFill: walk.caption)
                    ) {}
                }
            }
            .padding(20)
        }
        .background(colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
        .task { render() }
    }

    @MainActor
    private func render() {
        for (index, walk) in walks.enumerated() {
            let renderer = ImageRenderer(content: Artwork(word: walk.word, sky: walk.sky, sun: walk.sun, ink: Self.ink))
            renderer.scale = 3
            if let image = renderer.uiImage { art[index] = Image(uiImage: image) }
        }
    }

    /// A flat composition: a solid ground, one large disc, and a giant word cropped by the bottom edge.
    private struct Artwork: View {
        let word: String
        let sky: Color
        let sun: Color
        let ink: Color

        var body: some View {
            ZStack(alignment: .topLeading) {
                sky
                Circle()
                    .fill(sun)
                    .frame(width: 190, height: 190)
                    .offset(x: 196, y: 10)
                Text(word)
                    .font(.system(size: 128, weight: .black))
                    .tracking(-6)
                    .foregroundStyle(ink)
                    .fixedSize()
                    .offset(x: -8, y: 24)
            }
            .frame(width: 400, height: 340)
            .clipped()
        }
    }
}

#Preview("Light") {
    ParallaxCardExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    ParallaxCardExample()
        .preferredColorScheme(.dark)
}
