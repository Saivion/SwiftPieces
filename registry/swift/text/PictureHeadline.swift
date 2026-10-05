// swiftpieces:
// title: Picture Headline
// description: A headline with living pictures stuck between its words like a hand-placed collage. Each word rises into place and each picture opens from a dot into a tilted sticker with a white rim, landing with a spring, a light tick and a flash of crop marks, then keeps drifting. Press a sticker to lift it. Use the built-in house-palette scenes (the sun is our red mascot), your own images or SF Symbols; it wraps like text at any width and Dynamic Type size.
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// tags: [text, headline, inline images, pictures, reveal, stagger, onboarding, hero, typography]

import SwiftUI

/// A headline with pictures stuck between its words like stickers, revealed in reading order.
///
/// Write it as a list of segments: strings are words, pictures sit where you put them.
///
/// ```swift
/// PictureHeadline(["Slow", .art(.sun), "mornings, long", .art(.waves), "walks and early", .art(.moon), "nights."])
///     .font(.system(size: 40, weight: .bold))
/// ```
///
/// Pictures are sized from the font, so they follow Dynamic Type and every font you set. Each lands as a
/// sticker: a white rim, a soft shadow and a small tilt that alternates along the headline, with crop
/// marks flashing at its corners. Press and hold one to lift it. Text wraps word by word and a picture
/// never breaks from the row it lands on.
///
/// - Parameters:
///   - segments: Words (string literals) and pictures (`.art`, `.image`, `.symbol`), in reading order.
///   - alignment: Row alignment, like `multilineTextAlignment`.
///   - duration: Target time for the whole reveal, in seconds. The stagger is sized from the number of words and pictures, so short and long headlines both land in about this long.
///   - delay: Delay before the first word starts.
///   - revealOnScroll: When true, the reveal waits until the headline scrolls into view (iOS 18). Below iOS 18 it reveals on appear.
///   - trigger: Change this value to replay the reveal.
///   - haptics: A light tick as each picture lands and when one is lifted. On by default.
///   - style: Picture size, corner rounding, tilt, rim, crop marks, lifting, drift and the opening spring.
public struct PictureHeadline: View {
    /// A word run or a picture. String literals become words, so a headline reads as a plain list.
    public enum Segment: ExpressibleByStringLiteral {
        /// One or more words. Split on whitespace; each word rises on its own.
        case text(String)
        /// A picture between the words. `width` is in picture heights (2.4 is a wide frame, 1 a square), `label` is read by VoiceOver.
        case picture(Picture, width: CGFloat = 2.4, label: String? = nil)

        public init(stringLiteral value: String) { self = .text(value) }

        /// A built-in house-palette scene that keeps drifting after it opens.
        public static func art(_ scene: Scene, width: CGFloat = 2.4, label: String? = nil) -> Segment {
            .picture(.art(scene), width: width, label: label)
        }

        /// Your own image, filled into the frame. It drifts slowly unless `Style.drift` is off.
        public static func image(_ image: Image, width: CGFloat = 2.4, label: String? = nil) -> Segment {
            .picture(.image(image), width: width, label: label)
        }

        /// An SF Symbol on a solid block, square by default.
        public static func symbol(_ systemName: String, fill: Color, ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078), width: CGFloat = 1.3, label: String? = nil) -> Segment {
            .picture(.symbol(systemName, fill: fill, ink: ink), width: width, label: label)
        }
    }

    /// What fills a picture's frame.
    public enum Picture {
        case art(Scene)
        case image(Image)
        case symbol(String, fill: Color, ink: Color)
    }

    /// Built-in scenes, drawn in the house palette so a headline looks finished before you have artwork.
    public enum Scene: CaseIterable, Sendable {
        /// Our red mascot as a sun, settling into sand.
        case sun
        /// Bands of sea sliding past each other.
        case waves
        /// A crescent with twinkling stars on a night sky.
        case moon
        /// Layered green hills in slow parallax.
        case hills
        /// A white bloom turning on lilac.
        case bloom
    }

    /// Visual tuning. `standard` matches the SwiftPieces house look.
    public struct Style: Sendable {
        /// Picture height as a fraction of the line height.
        public var pictureHeight: CGFloat
        /// Corner radius as a fraction of the picture height. 0.5 makes a capsule.
        public var cornerRadius: CGFloat
        /// Whether pictures keep moving after they open: scenes drift and images pan slowly. Off under Reduce Motion.
        public var drift: Bool
        /// Duration of the dot-to-frame spring, in seconds.
        public var openDuration: Double
        /// Bounce of the opening spring.
        public var openBounce: Double
        /// The largest resting tilt, in degrees. Pictures alternate around it like stickers placed by hand; 0 lays them flat.
        public var tilt: Double
        /// Width of the sticker rim as a fraction of the picture height. 0 drops the rim.
        public var rim: CGFloat
        /// Colour of the sticker rim.
        public var rimColor: Color
        /// Whether crop marks flash at a picture's corners as it lands.
        public var cropMarks: Bool
        /// Whether pressing and holding a picture lifts it, straight and forward, until you let go.
        public var lifts: Bool

        public init(
            pictureHeight: CGFloat = 0.82,
            cornerRadius: CGFloat = 0.26,
            drift: Bool = true,
            openDuration: Double = 0.7,
            openBounce: Double = 0.28,
            tilt: Double = 4,
            rim: CGFloat = 0.07,
            rimColor: Color = .white,
            cropMarks: Bool = true,
            lifts: Bool = true
        ) {
            self.pictureHeight = pictureHeight
            self.cornerRadius = cornerRadius
            self.drift = drift
            self.openDuration = openDuration
            self.openBounce = openBounce
            self.tilt = tilt
            self.rim = rim
            self.rimColor = rimColor
            self.cropMarks = cropMarks
            self.lifts = lifts
        }

        public static let standard = Style()
    }

    @State private var epoch = 0

    private let segments: [Segment]
    private let alignment: TextAlignment
    private let duration: Double
    private let delay: Double
    private let revealOnScroll: Bool
    private let trigger: AnyHashable
    private let haptics: Bool
    private let style: Style

    public init(
        _ segments: [Segment],
        alignment: TextAlignment = .leading,
        duration: Double = 1.2,
        delay: Double = 0,
        revealOnScroll: Bool = false,
        trigger: AnyHashable = 0,
        haptics: Bool = true,
        style: Style = .standard
    ) {
        self.segments = segments
        self.alignment = alignment
        self.duration = duration
        self.delay = delay
        self.revealOnScroll = revealOnScroll
        self.trigger = trigger
        self.haptics = haptics
        self.style = style
    }

    public var body: some View {
        Reveal(items: items, alignment: alignment, duration: duration, delay: delay, revealOnScroll: revealOnScroll, haptics: haptics, style: style)
            .id(epoch)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(spoken)
            .accessibilityAddTraits(.isHeader)
            .onChange(of: trigger) { _, _ in epoch += 1 }
    }

    /// The headline as one string for VoiceOver: the words, plus any picture labels where they sit.
    private var spoken: String {
        segments.compactMap { segment -> String? in
            switch segment {
            case .text(let words): words
            case .picture(_, _, let label): label
            }
        }
        .joined(separator: " ")
    }

    /// Every word and picture, in reading order, each with its place in the stagger.
    private var items: [Item] {
        var items: [Item] = []
        for segment in segments {
            switch segment {
            case .text(let words):
                for word in words.split(whereSeparator: \.isWhitespace) {
                    items.append(Item(id: items.count, kind: .word(String(word))))
                }
            case .picture(let picture, let width, _):
                items.append(Item(id: items.count, kind: .picture(picture, width: max(0.5, width))))
            }
        }
        return items
    }

    fileprivate struct Item: Identifiable {
        enum Kind {
            case word(String)
            case picture(Picture, width: CGFloat)
        }

        let id: Int
        let kind: Kind
    }

    /// Recreated (via `.id`) on every replay so its `revealed` state starts fresh.
    private struct Reveal: View {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var revealed = false
        @State private var ticks = 0

        let items: [Item]
        let alignment: TextAlignment
        let duration: Double
        let delay: Double
        let revealOnScroll: Bool
        let haptics: Bool
        let style: Style

        /// Each item takes ~0.6 s to land; the rest of `duration` is spread across the stagger.
        private var stagger: Double {
            guard items.count > 1, !reduceMotion else { return 0 }
            return max(0, duration - 0.6) / Double(items.count - 1)
        }

        private func start(_ item: Item) -> Double { delay + Double(item.id) * stagger }

        /// Each picture's resting tilt: alternating sides and sizes, so a row reads as placed by hand.
        private func tilt(_ item: Item) -> Double {
            let pattern: [Double] = [-1, 0.75, -0.55, 1, -0.8, 0.6]
            let ordinal = items.prefix(item.id).filter { if case .picture = $0.kind { true } else { false } }.count
            return style.tilt * pattern[ordinal % pattern.count]
        }

        var body: some View {
            Group {
                if #available(iOS 18, *), revealOnScroll {
                    flow.onScrollVisibilityChange(threshold: 0.35) { visible in
                        if visible { revealed = true }
                    }
                } else {
                    flow.onAppear { revealed = true }
                }
            }
            .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: ticks)
            .task(id: revealed) {
                // One tick per picture, as it opens.
                guard revealed, haptics, !reduceMotion else { return }
                var elapsed = 0.0
                for item in items {
                    guard case .picture = item.kind else { continue }
                    let at = start(item) + 0.12
                    try? await Task.sleep(for: .seconds(max(0, at - elapsed)))
                    if Task.isCancelled { return }
                    elapsed = at
                    ticks += 1
                }
            }
        }

        private var flow: some View {
            HeadlineFlow(alignment: alignment) {
                ForEach(items) { item in
                    switch item.kind {
                    case .word(let word):
                        WordView(word: word, revealed: revealed, reduceMotion: reduceMotion, delay: start(item))
                    case .picture(let picture, let width):
                        PictureSticker(picture: picture, width: width, open: revealed, reduceMotion: reduceMotion, delay: start(item), tilt: tilt(item), haptics: haptics, style: style)
                    }
                }
            }
        }
    }

    /// A word that rises from behind its own baseline.
    private struct WordView: View {
        let word: String
        let revealed: Bool
        let reduceMotion: Bool
        let delay: Double

        var body: some View {
            let hidden = !revealed
            let motion = !reduceMotion
            Text(word)
                .opacity(hidden && !motion ? 0 : 1)
                .visualEffect { content, proxy in
                    content.offset(y: hidden && motion ? proxy.size.height * 1.05 : 0)
                }
                .animation(reduceMotion ? .easeOut(duration: 0.35).delay(delay) : .spring(duration: 0.62, bounce: 0).delay(delay), value: revealed)
                // Clips the rise at the word's own bottom edge; the top stays open for the spring.
                .mask(Rectangle().padding(.horizontal, -40).padding(.top, -400))
        }
    }

    /// One picture in its slot, lifted above its neighbours while it is pressed.
    private struct PictureSticker: View {
        let picture: Picture
        let width: CGFloat
        let open: Bool
        let reduceMotion: Bool
        let delay: Double
        let tilt: Double
        let haptics: Bool
        let style: Style

        @State private var pressed = false

        var body: some View {
            PictureSlot(width: width, height: style.pictureHeight) {
                Text(verbatim: "Hg").hidden()
                PictureFrame(picture: picture, open: open, pressed: pressed, reduceMotion: reduceMotion, delay: delay, tilt: tilt, style: style)
            }
            .zIndex(pressed ? 1 : 0)
            .onLongPressGesture(minimumDuration: 0.12, maximumDistance: 14, perform: {}, onPressingChanged: { down in
                guard style.lifts, open else { return }
                pressed = down
            })
            .sensoryFeedback(.impact(weight: .light, intensity: 0.8), trigger: pressed) { _, now in now && haptics }
        }
    }

    /// A picture as a sticker: a dot that opens into a rounded frame with a white rim and a soft shadow,
    /// landing at its tilt on a spring, its contents settling from a slight zoom, with crop marks flashing
    /// at its corners. Pressed, it straightens and lifts forward.
    private struct PictureFrame: View {
        let picture: Picture
        let open: Bool
        let pressed: Bool
        let reduceMotion: Bool
        let delay: Double
        let tilt: Double
        let style: Style

        @State private var marksShown = false

        var body: some View {
            GeometryReader { proxy in
                let size = proxy.size
                let radius = size.height * min(0.5, max(0, style.cornerRadius))
                let shown = open || reduceMotion
                let rim = size.height * max(0, style.rim)
                let lift = pressed && !reduceMotion
                content(size)
                    .frame(width: size.width, height: size.height)
                    .scaleEffect(shown && open ? 1 : (reduceMotion ? 1 : 1.3))
                    .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
                    .overlay {
                        if rim > 0 {
                            RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(style.rimColor, lineWidth: rim)
                        }
                    }
                    .mask {
                        // The opening: a dot as tall as the frame widens to the full frame.
                        RoundedRectangle(cornerRadius: shown ? radius : size.height / 2, style: .continuous)
                            .frame(width: shown ? size.width : size.height, height: size.height)
                            .frame(maxWidth: .infinity)
                    }
                    .shadow(color: .black.opacity(lift ? 0.26 : 0.14), radius: size.height * (lift ? 0.24 : 0.1), y: size.height * (lift ? 0.16 : 0.06))
                    // An overlay, so the marks reach past the frame without changing its layout.
                    .overlay {
                        if style.cropMarks {
                            CropMarks(size: size).opacity(marksShown ? 1 : 0)
                        }
                    }
                .opacity(open ? 1 : 0)
                .rotationEffect(.degrees(shown && !lift && !reduceMotion ? tilt : 0))
                .scaleEffect(lift ? 1.18 : 1)
                .animation(animation, value: open)
                .animation(.spring(duration: 0.38, bounce: 0.32), value: pressed)
            }
            .task(id: open) {
                // The marks flash as the sticker lands, then clear.
                guard open, style.cropMarks, !reduceMotion else { return }
                try? await Task.sleep(for: .seconds(delay + 0.18))
                if Task.isCancelled { return }
                withAnimation(.easeOut(duration: 0.18)) { marksShown = true }
                try? await Task.sleep(for: .seconds(0.55))
                withAnimation(.easeIn(duration: 0.4)) { marksShown = false }
            }
        }

        private var animation: Animation {
            reduceMotion ? .easeOut(duration: 0.35).delay(delay) : .spring(duration: style.openDuration, bounce: style.openBounce).delay(delay)
        }

        @ViewBuilder private func content(_ size: CGSize) -> some View {
            let moving = style.drift && !reduceMotion
            switch picture {
            case .art(let scene):
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !moving)) { context in
                    SceneArt(scene: scene, time: moving ? context.date.timeIntervalSinceReferenceDate : 0)
                }
            case .image(let image):
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !moving)) { context in
                    let t = moving ? context.date.timeIntervalSinceReferenceDate : 0
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: size.width, height: size.height)
                        .scaleEffect(moving ? 1.1 : 1)
                        .offset(x: moving ? sin(t * 0.35) * size.width * 0.03 : 0, y: moving ? cos(t * 0.27) * size.height * 0.03 : 0)
                }
            case .symbol(let name, let fill, let ink):
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !moving)) { context in
                    let t = moving ? context.date.timeIntervalSinceReferenceDate : 0
                    ZStack {
                        fill
                        Image(systemName: name)
                            .font(.system(size: size.height * 0.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .offset(y: moving ? sin(t * 1.4) * size.height * 0.04 : 0)
                    }
                }
            }
        }
    }
}

// MARK: - Crop marks

/// Four hairline crosses just outside a frame's corners, the marks the SwiftPieces site draws on its
/// dashed artboards. In the text colour, faint.
private struct CropMarks: View {
    let size: CGSize

    var body: some View {
        let arm = max(3, size.height * 0.12)
        let gap = max(3, size.height * 0.14)
        Canvas { context, canvas in
            let corners = [
                CGPoint(x: -gap, y: -gap), CGPoint(x: size.width + gap, y: -gap),
                CGPoint(x: -gap, y: size.height + gap), CGPoint(x: size.width + gap, y: size.height + gap),
            ]
            var path = Path()
            for c in corners {
                let p = CGPoint(x: c.x + canvas.width / 2 - size.width / 2, y: c.y + canvas.height / 2 - size.height / 2)
                path.move(to: CGPoint(x: p.x - arm, y: p.y)); path.addLine(to: CGPoint(x: p.x + arm, y: p.y))
                path.move(to: CGPoint(x: p.x, y: p.y - arm)); path.addLine(to: CGPoint(x: p.x, y: p.y + arm))
            }
            context.stroke(path, with: .foreground, lineWidth: max(1, size.height * 0.025))
        }
        .frame(width: size.width + (gap + arm) * 2, height: size.height + (gap + arm) * 2)
        .foregroundStyle(.primary.opacity(0.45))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Scenes

/// The built-in scenes, drawn with Canvas from the time so they loop without state.
private struct SceneArt: View {
    let scene: PictureHeadline.Scene
    let time: Double

    var body: some View {
        Canvas { context, size in
            switch scene {
            case .sun: sun(&context, size)
            case .waves: waves(&context, size)
            case .moon: moon(&context, size)
            case .hills: hills(&context, size)
            case .bloom: bloom(&context, size)
            }
        }
    }

    private func sun(_ c: inout GraphicsContext, _ s: CGSize) {
        c.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Art.butter))
        // Our red mascot as the sun: it bobs, blinks now and then, and smiles over the sand.
        let r = s.height * 0.3
        let center = CGPoint(x: s.width * 0.6, y: s.height * 0.5 + sin(time * 0.7) * s.height * 0.05)
        c.fill(Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)), with: .color(Art.red))
        let blink = time.truncatingRemainder(dividingBy: 3.6) < 0.14 ? 0.2 : 1.0
        for side in [-1.0, 1.0] {
            let eye = CGPoint(x: center.x + side * r * 0.34, y: center.y - r * 0.12)
            let w = r * 0.13, h = r * 0.2 * blink
            c.fill(Path(ellipseIn: CGRect(x: eye.x - w, y: eye.y - h, width: w * 2, height: h * 2)), with: .color(Art.ink))
        }
        var smile = Path()
        smile.addArc(center: CGPoint(x: center.x, y: center.y + r * 0.02), radius: r * 0.36, startAngle: .degrees(25), endAngle: .degrees(155), clockwise: false)
        c.stroke(smile, with: .color(Art.ink), style: StrokeStyle(lineWidth: max(1, r * 0.11), lineCap: .round))
        let horizon = s.height * 0.76
        c.fill(Path(CGRect(x: 0, y: horizon, width: s.width, height: s.height - horizon)), with: .color(Art.sand))
        // Glints on the sand, drifting.
        for k in 0..<3 {
            let w = s.width * (0.18 - Double(k) * 0.04)
            let x = (s.width * (0.15 + Double(k) * 0.3) + time * 6).truncatingRemainder(dividingBy: s.width + w) - w
            let y = horizon + s.height * (0.07 + Double(k) * 0.05)
            c.fill(Path(roundedRect: CGRect(x: x, y: y, width: w, height: max(1, s.height * 0.03)), cornerRadius: s.height * 0.015), with: .color(Art.red.opacity(0.35)))
        }
    }

    private func waves(_ c: inout GraphicsContext, _ s: CGSize) {
        c.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Art.sky))
        let bands: [(Color, CGFloat, Double)] = [(Art.deepSky, 0.42, 0.9), (.white.opacity(0.85), 0.62, -1.2), (Art.deepSky.opacity(0.9), 0.8, 1.5)]
        for (color, level, speed) in bands {
            var path = Path()
            let amplitude = s.height * 0.07
            let wave = s.width * 0.55
            path.move(to: CGPoint(x: 0, y: s.height))
            for x in stride(from: 0.0, through: s.width, by: 2) {
                path.addLine(to: CGPoint(x: x, y: s.height * level + sin((x / wave) * .pi * 2 + time * speed) * amplitude))
            }
            path.addLine(to: CGPoint(x: s.width, y: s.height))
            path.closeSubpath()
            c.fill(path, with: .color(color))
        }
    }

    private func moon(_ c: inout GraphicsContext, _ s: CGSize) {
        c.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Art.night))
        let stars: [(CGFloat, CGFloat, Double)] = [(0.12, 0.3, 0), (0.28, 0.72, 1.3), (0.42, 0.2, 2.1), (0.8, 0.78, 0.7), (0.9, 0.3, 2.8), (0.2, 0.52, 3.6)]
        for (x, y, phase) in stars {
            let r = s.height * 0.035 * (0.6 + 0.4 * (0.5 + 0.5 * sin(time * 1.6 + phase)))
            c.fill(Path(ellipseIn: CGRect(x: s.width * x - r, y: s.height * y - r, width: r * 2, height: r * 2)), with: .color(.white.opacity(0.5 + 0.5 * (0.5 + 0.5 * sin(time * 1.6 + phase)))))
        }
        let r = s.height * 0.32
        let center = CGPoint(x: s.width * 0.6, y: s.height * 0.5 + sin(time * 0.5) * s.height * 0.04)
        c.fill(Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)), with: .color(Art.butter))
        let bite = CGPoint(x: center.x + r * 0.45, y: center.y - r * 0.25)
        c.fill(Path(ellipseIn: CGRect(x: bite.x - r * 0.9, y: bite.y - r * 0.9, width: r * 1.8, height: r * 1.8)), with: .color(Art.night))
    }

    private func hills(_ c: inout GraphicsContext, _ s: CGSize) {
        c.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Art.paleSage))
        let r = s.height * 0.16
        c.fill(Path(ellipseIn: CGRect(x: s.width * 0.74 - r, y: s.height * 0.3 - r, width: r * 2, height: r * 2)), with: .color(Art.butter))
        let layers: [(Color, CGFloat, CGFloat, Double)] = [(Art.sage, 0.55, 0.16, 5), (Art.deepSage, 0.74, 0.12, 11)]
        for (color, level, amplitude, speed) in layers {
            var path = Path()
            let wave = s.width * 0.9
            path.move(to: CGPoint(x: 0, y: s.height))
            for x in stride(from: 0.0, through: s.width, by: 2) {
                let phase = (x + time * speed) / wave * .pi * 2
                path.addLine(to: CGPoint(x: x, y: s.height * level - (sin(phase) * 0.5 + 0.5) * s.height * amplitude))
            }
            path.addLine(to: CGPoint(x: s.width, y: s.height))
            path.closeSubpath()
            c.fill(path, with: .color(color))
        }
    }

    private func bloom(_ c: inout GraphicsContext, _ s: CGSize) {
        c.fill(Path(CGRect(origin: .zero, size: s)), with: .color(Art.lilac))
        let center = CGPoint(x: s.width * 0.5, y: s.height * 0.5)
        let petal = s.height * 0.3
        var turned = c
        turned.translateBy(x: center.x, y: center.y)
        turned.rotate(by: .radians(time * 0.4))
        for k in 0..<6 {
            var leaf = turned
            leaf.rotate(by: .degrees(Double(k) * 60))
            leaf.fill(Path(ellipseIn: CGRect(x: -petal * 0.32, y: -petal * 1.2, width: petal * 0.64, height: petal)), with: .color(.white.opacity(0.92)))
        }
        let core = s.height * 0.12
        c.fill(Path(ellipseIn: CGRect(x: center.x - core, y: center.y - core, width: core * 2, height: core * 2)), with: .color(Art.butter))
    }
}

/// House palette for the scenes (mirrors the web previews' blocks).
private enum Art {
    static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    static let sand = Color(red: 0.914, green: 0.835, blue: 0.702)
    static let red = Color(red: 1, green: 0.231, blue: 0.188)
    static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    static let deepSky = Color(red: 0.31, green: 0.52, blue: 0.95)
    static let paleSage = Color(red: 0.86, green: 0.95, blue: 0.88)
    static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
    static let deepSage = Color(red: 0.36, green: 0.66, blue: 0.46)
    static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
    /// The moon's sky: a deep blue, so the frame reads on dark grounds as well as light.
    static let night = Color(red: 0.149, green: 0.184, blue: 0.369)
    static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
}

// MARK: - Layout

/// Sizes a picture from the line it sits in: its first subview is a hidden line of text in the current
/// font, which gives the line height; the frame is `height` of that line tall and `width` frames wide.
private struct PictureSlot: Layout {
    var width: CGFloat
    var height: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let line = subviews.first?.sizeThatFits(.unspecified).height ?? 0
        return CGSize(width: (line * height * width).rounded(), height: line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count > 1 else { return }
        let line = bounds.height
        let frame = CGSize(width: bounds.width, height: (line * height).rounded())
        subviews[0].place(at: bounds.origin, proposal: ProposedViewSize(width: 0, height: line))
        // Centred on the line, nudged down a touch to sit on the text's optical middle.
        let y = bounds.minY + (line - frame.height) / 2 + line * 0.03
        subviews[1].place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(frame))
    }
}

/// Wraps words and pictures into rows the way text wraps. The gap follows the row height, so it follows the font.
private struct HeadlineFlow: Layout {
    var alignment: TextAlignment

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func rows(for sizes: [CGSize], width: CGFloat) -> [Row] {
        let gap = ((sizes.map(\.height).max() ?? 0) * 0.24).rounded()
        var rows: [Row] = []
        var row = Row()
        for (i, size) in sizes.enumerated() {
            let extended = row.indices.isEmpty ? size.width : row.width + gap + size.width
            if extended > width, !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }
            row.width = row.indices.isEmpty ? size.width : row.width + gap + size.width
            row.height = max(row.height, size.height)
            row.indices.append(i)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let rows = rows(for: sizes, width: proposal.width ?? .infinity)
        let spacing = rowSpacing(sizes)
        return CGSize(width: rows.map(\.width).max() ?? 0, height: rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let rows = rows(for: sizes, width: bounds.width)
        let gap = ((sizes.map(\.height).max() ?? 0) * 0.24).rounded()
        let spacing = rowSpacing(sizes)
        var y = bounds.minY
        for row in rows {
            var x: CGFloat
            switch alignment {
            case .leading: x = bounds.minX
            case .center: x = bounds.minX + (bounds.width - row.width) / 2
            case .trailing: x = bounds.maxX - row.width
            }
            for i in row.indices {
                subviews[i].place(at: CGPoint(x: x, y: y + row.height - sizes[i].height), proposal: .unspecified)
                x += sizes[i].width + gap
            }
            y += row.height + spacing
        }
    }

    /// A little air between rows, so pictures on neighbouring rows never touch.
    private func rowSpacing(_ sizes: [CGSize]) -> CGFloat {
        ((sizes.map(\.height).max() ?? 0) * 0.06).rounded()
    }
}

// MARK: - Example

/// The component alone: a centred headline with three of the built-in scenes opening between its
/// words, replaying every few seconds. Nothing around it.
private struct PictureHeadlineExample: View {
    @State private var replay = 0

    var body: some View {
        PictureHeadline(
            ["Slow", .art(.sun, label: "a sunrise"), "mornings, long", .art(.waves, label: "the sea"), "walks and", .art(.hills, width: 1.8, label: "hills"), "early", .art(.moon, label: "the moon"), "nights."],
            alignment: .center,
            trigger: replay
        )
        .font(.system(size: 40, weight: .bold))
        .tracking(-1.2)
        .foregroundStyle(PictureHeadlinePalette.text)
        .frame(maxWidth: 360)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PictureHeadlinePalette.ground)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5.5))
                replay += 1
            }
        }
    }
}

/// House palette values for the example, adapting to light and dark.
private enum PictureHeadlinePalette {
    static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
    static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

#Preview("Light") {
    PictureHeadlineExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    PictureHeadlineExample()
        .preferredColorScheme(.dark)
}
