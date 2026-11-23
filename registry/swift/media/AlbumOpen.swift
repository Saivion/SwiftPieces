// swiftpieces:
// title: Album Open
// description: "A grid of albums, each a small pile of its own photos. Tap one and its photos lift off the pile and fly into a full grid, one after another, while the other albums step back and fade; Back gathers them onto the pile again. It wraps your own views, so photos can be images or thumbnails. For galleries, collections, playlists and shared sets."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [album, photos, gallery, grid, collection, open, folder]

import SwiftUI

/// Sizes and colors for `AlbumOpen`.
public struct AlbumOpenStyle: Sendable {
    /// The gap between albums, and between photos in an open album.
    public var spacing: CGFloat
    /// The photos' corner radius while piled, and in the open grid.
    public var pileRadius: CGFloat
    public var gridRadius: CGFloat
    /// The album titles and the open album's header.
    public var title: Color
    /// The photo counts.
    public var secondary: Color
    /// The shadow under each piled photo.
    public var shadow: Color

    public init(
        spacing: CGFloat = 16,
        pileRadius: CGFloat = 14,
        gridRadius: CGFloat = 8,
        title: Color = Color(UIColor.label),
        secondary: Color = Color(UIColor.secondaryLabel),
        shadow: Color = .black.opacity(0.18)
    ) {
        self.spacing = spacing
        self.pileRadius = pileRadius
        self.gridRadius = gridRadius
        self.title = title
        self.secondary = secondary
        self.shadow = shadow
    }

    public static let standard = AlbumOpenStyle()
}

/// Albums shown as piles that open into a grid of their photos.
///
/// It takes the width it is offered and grows to the height it needs, so put it in a `ScrollView`. Every photo
/// of every album is a live view, so it suits albums of up to a few dozen photos; for more, open a lazy grid
/// after the animation.
///
/// - Parameters:
///   - albums: The albums, in order.
///   - opened: The album that is open, or `nil` for the album grid. A tap on a pile sets it; Back clears it.
///   - photos: An album's photos. The first three make its pile, the first on top.
///   - title: An album's name.
///   - columns: How many albums sit side by side.
///   - gridColumns: How many columns an open album has.
///   - style: Sizes and colors.
///   - onSelect: Called with a photo tapped in an open album.
///   - photo: One photo. It is clipped and sized to fill a square.
public struct AlbumOpen<Album: Identifiable, Photo: Identifiable, PhotoView: View>: View {
    public typealias Style = AlbumOpenStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var opened: Album.ID?
    @State private var width: CGFloat = 0
    @State private var taps = 0

    private let albums: [Album]
    private let photos: (Album) -> [Photo]
    private let title: (Album) -> String
    private let columns: Int
    private let gridColumns: Int
    private let style: Style
    private let onSelect: ((Photo) -> Void)?
    private let photo: (Photo) -> PhotoView

    private let header: CGFloat = 48
    private let caption: CGFloat = 46

    public init(
        _ albums: [Album],
        opened: Binding<Album.ID?>,
        photos: @escaping (Album) -> [Photo],
        title: @escaping (Album) -> String,
        columns: Int = 2,
        gridColumns: Int = 3,
        style: Style = .standard,
        onSelect: ((Photo) -> Void)? = nil,
        @ViewBuilder photo: @escaping (Photo) -> PhotoView
    ) {
        self.albums = albums
        self._opened = opened
        self.photos = photos
        self.title = title
        self.columns = max(1, columns)
        self.gridColumns = max(1, gridColumns)
        self.style = style
        self.onSelect = onSelect
        self.photo = photo
    }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let side = cover
        let open = albums.first { $0.id == opened }
        let albumRows = (albums.count + columns - 1) / columns
        let closedHeight = CGFloat(albumRows) * (side + caption) + CGFloat(max(albumRows - 1, 0)) * style.spacing
        let openCount = open.map { photos($0).count } ?? 0
        let gridRows = (openCount + gridColumns - 1) / gridColumns
        let openHeight = header + CGFloat(gridRows) * cell + CGFloat(max(gridRows - 1, 0)) * spacing

        ZStack(alignment: .topLeading) {
            ForEach(Array(albums.enumerated()), id: \.element.id) { index, album in
                albumView(album, index: index, side: side, motion: motion)
                    .zIndex(album.id == opened ? 1 : 0)
            }
            if let open {
                openHeader(open, count: openCount)
                    .transition(motion.transition(.opacity.combined(with: .offset(y: -8))))
                    .zIndex(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(height: open == nil ? closedHeight : max(openHeight, closedHeight), alignment: .top)
        .animation(open == nil ? motion.dismiss : motion.reveal, value: opened)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .sensoryFeedback(.impact(weight: .light), trigger: taps)
    }

    @ViewBuilder private func albumView(_ album: Album, index: Int, side: CGFloat, motion: PieceMotion) -> some View {
        let isOpen = album.id == opened
        let others = opened != nil && !isOpen
        let items = photos(album)
        let origin = albumOrigin(index, side: side)

        ZStack(alignment: .topLeading) {
            ForEach(Array(items.enumerated()), id: \.element.id) { rank, item in
                let place = placement(rank: rank, open: isOpen, origin: origin, side: side)
                photo(item)
                    .frame(width: place.size, height: place.size)
                    .clipShape(.rect(cornerRadius: isOpen ? style.gridRadius : style.pileRadius, style: .continuous))
                    .shadow(color: style.shadow.opacity(isOpen ? 0 : 1), radius: 6, y: 3)
                    .rotationEffect(.degrees(place.tilt))
                    .offset(x: place.center.x - place.size / 2, y: place.center.y - place.size / 2)
                    .opacity(isOpen || rank < 3 ? 1 : 0)
                    .zIndex(Double(items.count - rank))
                    .animation(isOpen ? motion.follow(rank: rank) : motion.follow(PieceMotion.responsive, rank: max(0, min(items.count, 12) - rank)), value: opened)
                    .onTapGesture {
                        if isOpen, let onSelect { onSelect(item) } else if !isOpen { open(album) }
                    }
                    .accessibilityHidden(!isOpen)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title(album))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.title)
                Text("\(items.count)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(style.secondary)
                    .monospacedDigit()
            }
            .lineLimit(1)
            .frame(width: side, alignment: .leading)
            .offset(x: origin.x, y: origin.y + side + 8)
            .opacity(opened == nil ? 1 : 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .scaleEffect(others ? 0.86 : 1, anchor: UnitPoint(x: width > 0 ? (origin.x + side / 2) / width : 0.5, y: 0))
        .opacity(others ? 0 : 1)
        .allowsHitTesting(!others)
        .accessibilityElement(children: isOpen ? .contain : .ignore)
        .accessibilityHidden(others)
        .accessibilityLabel(isOpen ? "" : "\(title(album)), \(items.count) photos")
        .accessibilityAddTraits(isOpen ? [] : .isButton)
        .accessibilityAction { if !isOpen { open(album) } }
    }

    private func openHeader(_ album: Album, count: Int) -> some View {
        HStack(spacing: 8) {
            Button {
                close()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.backward")
                        .font(.body.weight(.semibold))
                    Text(title(album))
                        .font(.title3.weight(.semibold))
                        .lineLimit(1)
                }
                .foregroundStyle(style.title)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back from \(title(album))")
            Spacer(minLength: 12)
            Text("\(count) photos")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(style.secondary)
                .monospacedDigit()
        }
        .frame(height: header - 12)
        .frame(maxWidth: .infinity)
    }

    // MARK: Layout

    private var cover: CGFloat {
        guard width > 0 else { return 150 }
        return (width - style.spacing * CGFloat(columns - 1)) / CGFloat(columns)
    }

    private var spacing: CGFloat { max(2, style.spacing / 4) }

    private var cell: CGFloat {
        guard width > 0 else { return 100 }
        return (width - spacing * CGFloat(gridColumns - 1)) / CGFloat(gridColumns)
    }

    private func albumOrigin(_ index: Int, side: CGFloat) -> CGPoint {
        CGPoint(x: CGFloat(index % columns) * (side + style.spacing), y: CGFloat(index / columns) * (side + caption + style.spacing))
    }

    /// Where photo `rank` of an album sits: on the album's pile, tilted, or in the open grid.
    private func placement(rank: Int, open: Bool, origin: CGPoint, side: CGFloat) -> (center: CGPoint, size: CGFloat, tilt: Double) {
        if open {
            let column = rank % gridColumns, row = rank / gridColumns
            let x = CGFloat(column) * (cell + spacing) + cell / 2
            let y = header + CGFloat(row) * (cell + spacing) + cell / 2
            return (CGPoint(x: x, y: y), cell, 0)
        }
        let tilts: [Double] = [0, 5, -6]
        let pile = side * 0.9
        let center = CGPoint(x: origin.x + side / 2, y: origin.y + side / 2)
        return (center, rank == 0 ? side : pile, tilts[min(rank, 2)])
    }

    private func open(_ album: Album) {
        taps += 1
        opened = album.id
    }

    private func close() {
        taps += 1
        opened = nil
    }
}

// MARK: - Example

private struct AlbumOpenAlbum: Identifiable {
    let id: String
    let prints: [Int]
}

private struct AlbumOpenPhoto: Identifiable {
    let id: Int
    let print: Int
}

/// Four albums of flat prints. Tap Lake trip to open its nine photos; Back gathers them.
private struct AlbumOpenExample: View {
    @State private var opened: String?
    private let albums = [
        AlbumOpenAlbum(id: "Lake trip", prints: [1, 3, 2, 0, 4, 6, 7, 5, 1]),
        AlbumOpenAlbum(id: "Tokyo", prints: [5, 6, 7, 3]),
        AlbumOpenAlbum(id: "Family", prints: [0, 4, 6, 2, 1]),
        AlbumOpenAlbum(id: "Recipes", prints: [4, 7, 3]),
    ]

    var body: some View {
        ScrollView {
            AlbumOpen(albums, opened: $opened, photos: { album in
                album.prints.enumerated().map { AlbumOpenPhoto(id: $0.offset, print: $0.element) }
            }, title: \.id) { photo in
                AlbumOpenPrint(kind: photo.print)
            }
            .padding(20)
        }
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

/// A flat print in the house palette, standing in for a photo in the example. Swap in your own images.
private struct AlbumOpenPrint: View {
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
    AlbumOpenExample()
}

#Preview("Dark") {
    AlbumOpenExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow)

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

// swiftpieces-motion: end
