// swiftpieces:
// title: Attachment Tray
// description: "A horizontal attachment strip for composers, support forms and listings: a liquid glass add tile opens the photo picker with the remaining limit, picks drop onto the strip as their own tiles carrying a glass status bubble with a live progress ring, and the remove badge buds out of it; the ring closes before the thumbnail, downsampled off the main thread, develops in place and the bubble melts into the badge, failures flood the bubble red as a retry, the remove badge cancels an in-flight load, duplicates and over-limit picks are caught, and the caller owns every attachment for upload."
// category: media
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-29"
// tags: [attachments, photos, photos-picker, upload, thumbnails, imageio, composer, media]

import SwiftUI
import PhotosUI
import ImageIO
import AVFoundation
import UniformTypeIdentifiers
import os

/// A strip of photo and video attachments with an add tile, per-item loading, retry, remove and a limit.
///
/// Thumbnails are content; everything you press or read over them is liquid glass. A tile that is loading, failed or
/// uploading carries a status bubble at its centre, joined to the remove badge in its corner. The badge buds out of
/// that bubble when the tile drops onto the strip, and the bubble melts into the badge once the photo has developed.
///
/// The caller owns the attachments. Picks from the built-in add tile are appended for you; anything else
/// (a camera capture, a paste, a drop, a draft restored from disk, your own picker) is added by appending an
/// ``Attachment`` to the binding, and the tray runs the same loading pipeline for it.
///
/// - Parameters:
///   - title: Label of the add tile while the tray is empty, and its VoiceOver label. Once there are attachments the tile shrinks to a square showing the count.
///   - attachments: Bound attachments, in display order. The tray appends picks, writes load progress, thumbnails and payloads back by id, and removes an attachment when its remove badge is tapped. Loads for attachments you remove are cancelled and their results ignored.
///   - limit: Most attachments the tray lets people pick (at least 1). The picker only allows the remaining count; at the limit the add tile shows "6/6" and disables. Extra picks and picks already in the tray are not added.
///   - matching: What the picker offers, such as `.images`, `.videos` or `.any(of: [.images, .videos])`. Videos load as a file copied to the temporary directory with a poster frame thumbnail and a duration badge.
///   - style: Colors and tile metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
///   - onSelect: Called when a loaded tile is tapped, for example to open it full screen. When `nil`, loaded tiles have no tap action.
public struct AttachmentTray: View {

    // MARK: Attachment

    /// One attachment: its loading phase, a downsampled thumbnail and the payload to upload.
    public struct Attachment: Identifiable, Equatable, Sendable {
        /// What the attachment holds.
        public enum Kind: Sendable, Equatable {
            case image, video
        }

        /// Where the attachment is in the loading pipeline.
        public enum Phase: Sendable, Equatable {
            /// Loading. `progress` is 0...1 once the source reports it (an iCloud download, your loader), `nil` while unknown.
            case loading(progress: Double?)
            /// Loaded: `thumbnail` and the payload are set.
            case loaded
            /// The load failed. The tile offers Retry; `reason` is the error's localized description.
            case failed(reason: String)
        }

        public let id: UUID
        public fileprivate(set) var kind: Kind
        public fileprivate(set) var phase: Phase
        /// A thumbnail sized for the tile at the screen's scale. The full-size image is never decoded or kept.
        public fileprivate(set) var thumbnail: UIImage?
        /// The original encoded bytes of a loaded image (HEIC, JPEG, PNG...), ready to upload. `nil` for videos.
        public fileprivate(set) var data: Data?
        /// A loaded video (copied to the temporary directory) or the file an attachment was created from.
        public fileprivate(set) var fileURL: URL?
        /// The type of `data` or `fileURL`, such as `.heic`, `.jpeg` or `.quickTimeMovie`.
        public fileprivate(set) var contentType: UTType?
        /// Pixel size of the original, with orientation applied.
        public fileprivate(set) var pixelSize: CGSize?
        /// Length of a video, in seconds.
        public fileprivate(set) var duration: TimeInterval?
        /// The photo library identifier of a picked item. Used to skip picking the same photo twice.
        public let itemIdentifier: String?
        /// Your upload progress, 0...1. While below 1 the tile dims under a progress ring; at 1 it shows a check. `nil` hides both.
        public var uploadProgress: Double?

        fileprivate var source: Source?
        fileprivate var attempt = 0
        fileprivate var revision = 0

        /// An item from your own `PhotosPicker`. Videos are detected from the item's content types.
        public init(item: PhotosPickerItem, id: UUID = UUID()) {
            self.init(id: id, kind: item.supportedContentTypes.contains { $0.conforms(to: .movie) } ? .video : .image, source: .item(item), itemIdentifier: item.itemIdentifier)
        }

        /// An image you already hold, such as a camera capture or a paste. It is encoded as JPEG for `data` and then released.
        public init(image: UIImage, id: UUID = UUID()) {
            self.init(id: id, kind: .image, source: .image(image))
        }

        /// Encoded image bytes, such as a drop, a draft or a download.
        public init(data: Data, id: UUID = UUID()) {
            self.init(id: id, kind: .image, source: .data(data))
        }

        /// An image or video file on disk. Security-scoped URLs (from a file importer) are accessed while loading.
        public init(fileURL: URL, id: UUID = UUID()) {
            let isVideo = UTType(filenameExtension: fileURL.pathExtension)?.conforms(to: .movie) ?? false
            self.init(id: id, kind: isVideo ? .video : .image, source: .file(fileURL))
        }

        /// An image your own code fetches. Set `totalUnitCount` and `completedUnitCount` on the `Progress` (or add a
        /// `URLSessionTask`'s progress as a child) to drive the tile's ring. Throwing fails the tile with Retry, which calls `load` again.
        public init(id: UUID = UUID(), load: @escaping @Sendable (Progress) async throws -> Data) {
            self.init(id: id, kind: .image, source: .loader(load))
        }

        private init(id: UUID, kind: Kind, source: Source, itemIdentifier: String? = nil) {
            self.id = id
            self.kind = kind
            self.phase = .loading(progress: nil)
            self.source = source
            self.itemIdentifier = itemIdentifier
        }

        /// True once the thumbnail and payload are ready.
        public var isLoaded: Bool { phase == .loaded }

        /// Loads a failed attachment again. Does nothing in any other phase.
        public mutating func retry() {
            guard case .failed = phase, source != nil else { return }
            phase = .loading(progress: nil)
            attempt += 1
        }

        /// Upload-ready JPEG for a loaded image: downsampled so its longer side is at most `maxPixelSize`, orientation
        /// applied, and location and other metadata removed. Runs off the main actor. `nil` for videos or before loading.
        public func jpegData(maxPixelSize: CGFloat = 2048, compressionQuality: CGFloat = 0.85) async -> Data? {
            guard kind == .image, phase == .loaded else { return nil }
            let data = self.data, url = self.fileURL
            return await Task.detached(priority: .utility) {
                Pipeline.jpeg(data: data, url: url, maxPixelSize: maxPixelSize, quality: compressionQuality)
            }.value
        }

        /// Identity, phase, upload progress and load revision. The payload itself is not compared.
        public static func == (a: Attachment, b: Attachment) -> Bool {
            a.id == b.id && a.phase == b.phase && a.uploadProgress == b.uploadProgress && a.revision == b.revision && a.attempt == b.attempt && a.kind == b.kind
        }
    }

    // MARK: Style

    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The placeholder under a tile while it loads, or after it fails. The add tile is liquid glass.
        public var tile: Color
        /// Progress rings, the add tile's title and the Retry label.
        public var label: Color
        /// The count on the add tile and the empty-state subtitle.
        public var secondary: Color
        /// The glass tint of the remove and duration badges. `.clear`, the default, leaves them neutral glass.
        public var badge: Color
        /// Glyphs and text on the remove and duration badges.
        public var badgeInk: Color
        /// The add tile's plus disc, and the glass tint of a failed tile's retry bubble.
        public var signal: Color
        /// Glyphs on `signal` and on `uploaded`.
        public var signalInk: Color
        /// The glass tint of the check bubble a tile shows once `uploadProgress` reaches 1.
        public var uploaded: Color
        /// Tile corner radius.
        public var cornerRadius: CGFloat
        /// Tile side at the default text size. Tiles grow with Dynamic Type, up to 1.5 times this.
        public var tileSize: CGFloat
        /// Gap between tiles.
        public var spacing: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(tile: Color? = nil, label: Color? = nil, secondary: Color? = nil, badge: Color? = nil, badgeInk: Color? = nil, signal: Color? = nil, signalInk: Color? = nil, uploaded: Color? = nil, cornerRadius: CGFloat = 18, tileSize: CGFloat = 76, spacing: CGFloat = 10) {
            self.tile = tile ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondary = secondary ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.badge = badge ?? .clear
            self.badgeInk = badgeInk ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.signal = signal ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.signalInk = signalInk ?? adaptive(light: 0x141414, dark: 0x141414)
            self.uploaded = uploaded ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.cornerRadius = cornerRadius
            self.tileSize = max(tileSize, 56)
            self.spacing = spacing
        }

        public static let standard = Style()
    }

    // MARK: State

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.displayScale) private var displayScale
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    @Binding private var attachments: [Attachment]
    @State private var picked: [PhotosPickerItem] = []
    /// Bumps per tile, so a tile picked again pulses each time without the next one replaying it.
    @State private var pulses: [UUID: Int] = [:]
    /// Each tile's place in a first pick, so that batch drops in one after another.
    @State private var arrivals: [UUID: Int] = [:]
    /// Loaded tiles still closing their ring. The payload is already on the attachment; only the photo waits.
    @State private var closingRings: Set<UUID> = []
    @State private var scrolledID: UUID?
    @State private var addTick = 0
    @State private var removeTick = 0
    @State private var warnTick = 0
    @State private var failTick = 0
    @State private var lastFailHaptic = Date.distantPast
    @State private var retryTick = 0
    /// Set once the tray has drawn its first frame. Tiles that arrive after that bud their badges; tiles already there
    /// when the tray appears (a restored draft) start with them in place.
    @State private var appeared = false

    private let title: LocalizedStringKey
    private let limit: Int
    private let filter: PHPickerFilter
    private let style: Style
    private let onSelect: ((Attachment) -> Void)?

    public init(_ title: LocalizedStringKey = "Add photos", attachments: Binding<[Attachment]>, limit: Int = 10, matching: PHPickerFilter = .images, style: Style = .standard, onSelect: ((Attachment) -> Void)? = nil) {
        self.title = title
        self._attachments = attachments
        self.limit = max(limit, 1)
        self.filter = matching
        self.style = style
        self.onSelect = onSelect
    }

    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    /// A first pick drops a beat apart in pick order. From the fifth on they land together, so a big pick never drags.
    private static let dropBeat = 0.05
    /// How long after a tile starts dropping its remove badge buds out: once the drop's give has turned.
    private static let budBeat = 0.18
    private func dropPlace(_ id: UUID) -> Int { min(arrivals[id] ?? 0, 4) }
    private var side: CGFloat { style.tileSize * min(max(typeScale, 1), 1.5) }
    /// A drop or a bump reaches at most 5 pt past each edge, inside the strip's 6 pt headroom at any tile size.
    private var dropScale: CGFloat { 1 + min(0.1, 10 / side) }
    private var remaining: Int { max(limit - attachments.count, 0) }
    private var ids: [UUID] { attachments.map(\.id) }
    private var loadingCount: Int { attachments.filter { if case .loading = $0.phase { true } else { false } }.count }
    /// Thumbnails are cut for the largest tile Dynamic Type can produce, so a text size change never needs a reload.
    private var thumbnailPixels: CGFloat { style.tileSize * 1.5 * max(displayScale, 1) }

    public var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: style.spacing) {
                addTile
                ForEach(Array(attachments.enumerated()), id: \.element.id) { index, attachment in
                    TileView(
                        attachment: attachment,
                        position: index + 1,
                        count: attachments.count,
                        side: side,
                        style: style,
                        pulse: pulses[attachment.id, default: 0],
                        closing: closingRings.contains(attachment.id),
                        canSelect: onSelect != nil,
                        arrival: appeared ? Double(dropPlace(attachment.id)) * Self.dropBeat + Self.budBeat : nil,
                        remove: { remove(attachment.id) },
                        retry: { retry(attachment.id) },
                        select: { onSelect?(attachment) }
                    )
                    .id(attachment.id)
                    // A print dropped onto the strip: it settles from just above with some give, in a first pick a beat
                    // after the one before it. The give dips inward, so it never reaches past the headroom. Only the
                    // drawing waits; the tile, and its load, are there at once. Removal is quick and firm.
                    .transition(.asymmetric(
                        insertion: motion.transition(.scale(scale: dropScale).combined(with: .opacity))
                            .animation(motion.cascade(motion.settle, index: dropPlace(attachment.id), step: Self.dropBeat)),
                        removal: motion.transition(.scale(scale: 0.5).combined(with: .opacity))
                            .animation(motion.dismiss)
                    ))
                    // One load per attempt. SwiftUI cancels it when the tile leaves (removed, or the tray goes away).
                    .task(id: LoadKey(id: attachment.id, attempt: attachment.attempt)) {
                        await load(attachment.id)
                    }
                }
            }
            .scrollTargetLayout()
            // Room for a tile dropping in from just above full size, or bumping when it is picked again.
            .padding(.vertical, 6)
        }
        .scrollIndicators(.hidden)
        .fontWeight(.semibold)
        // A strip is as tall as its tiles, however much height it is offered.
        .fixedSize(horizontal: false, vertical: true)
        .scrollPosition(id: $scrolledID, anchor: .trailing)
        .onChange(of: ids) { old, new in
            // New tiles at the end scroll into view. Filling an empty tray (a restored draft) keeps the add tile in view.
            guard !old.isEmpty, let last = new.last, !old.contains(last) else { return }
            reveal(last)
        }
        // The strip closes a gap, makes room or reshapes the add tile. Tiles coming and going carry their own timing.
        .animation(motion.snap, value: ids)
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            ingest(items)
        }
        .onChange(of: loadingCount) { old, new in
            guard old > 0, new == 0, !attachments.isEmpty, !attachments.contains(where: { if case .failed = $0.phase { true } else { false } }) else { return }
            announce(String(localized: "All attachments loaded"))
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: addTick)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.8), trigger: removeTick)
        .sensoryFeedback(.warning, trigger: warnTick)
        .sensoryFeedback(.error, trigger: failTick)
        .sensoryFeedback(.selection, trigger: retryTick)
        // After the first frame's tiles have appeared, so only tiles added from here on bud their badges.
        .task { appeared = true }
    }

    // MARK: Add tile

    private var addTile: some View {
        let isFull = remaining == 0
        // Built here, on the main actor: the picker's label closure is not main-actor isolated.
        let label = AddTileLabel(title: title, count: attachments.count, limit: limit, side: side, style: style)
        return PhotosPicker(
            selection: $picked,
            maxSelectionCount: max(remaining, 1),
            selectionBehavior: .ordered,
            matching: filter,
            preferredItemEncoding: .current,
            photoLibrary: .shared()
        ) {
            label
        }
        .buttonStyle(PiecePressStyle())
        .disabled(isFull)
        .opacity(isEnabled ? 1 : 0.45)
        .accessibilityLabel(Text(title))
        .accessibilityValue(isFull ? String(localized: "Limit reached, \(attachments.count) of \(limit)") : String(localized: "\(remaining) remaining"))
        .accessibilityHint(isFull ? "" : String(localized: "Opens your photo library"))
    }

    // MARK: Changes

    /// Appends picked items that are new and fit, pulses the tile of a photo that is already here, and reports the rest.
    private func ingest(_ items: [PhotosPickerItem]) {
        let result = Self.merge(items, into: attachments, limit: limit)
        if !result.added.isEmpty {
            // Only a first pick cascades: nothing glides after it. Into a tray that already has tiles, picks land
            // together, so the glide to them is never kept waiting by a cascade playing past the trailing edge.
            arrivals = attachments.isEmpty ? Dictionary(uniqueKeysWithValues: result.added.enumerated().map { ($0.element.id, $0.offset) }) : [:]
            withAnimation(motion.reveal) { attachments.append(contentsOf: result.added) }
            addTick += 1
        }
        if let first = result.duplicates.first { pulse(first) }
        if result.dropped > 0 || !result.duplicates.isEmpty { warnTick += 1 }

        var parts: [String] = []
        if !result.added.isEmpty { parts.append(String(AttributedString(localized: "Added ^[\(result.added.count) attachment](inflect: true).").characters)) }
        if !result.duplicates.isEmpty { parts.append(String(AttributedString(localized: "^[\(result.duplicates.count) attachment](inflect: true) already added.").characters)) }
        if result.dropped > 0 { parts.append(String(AttributedString(localized: "^[\(result.dropped) attachment](inflect: true) not added, the limit is \(limit).").characters)) }
        if !parts.isEmpty { announce(parts.joined(separator: " ")) }
    }

    /// The merge rule, separate from the view so it can be exercised without a picker: skip items whose library
    /// identifier is already in the tray (or earlier in the same pick), then keep as many as the limit allows, in order.
    static func merge(_ items: [PhotosPickerItem], into existing: [Attachment], limit: Int) -> (added: [Attachment], duplicates: [UUID], dropped: Int) {
        var known: [String: UUID] = [:]
        for attachment in existing { if let key = attachment.itemIdentifier { known[key] = attachment.id } }
        let room = max(limit - existing.count, 0)
        var added: [Attachment] = []
        var duplicates: [UUID] = []
        var dropped = 0
        for item in items {
            if let key = item.itemIdentifier, let existingID = known[key] {
                duplicates.append(existingID)
                continue
            }
            guard added.count < room else {
                dropped += 1
                continue
            }
            let attachment = Attachment(item: item)
            added.append(attachment)
            if let key = item.itemIdentifier { known[key] = attachment.id }
        }
        return (added, duplicates, dropped)
    }

    /// Scrolls a tile into view once it can be scrolled to. A scroll view does not scroll to a tile while its insertion
    /// transition is running (and right to left it also re-pins its leading edge as the content grows), so this waits
    /// for the tile to finish dropping in (tiles added to a tray that has some land together), then glides to it.
    private func reveal(_ id: UUID, settling: Bool = true) {
        let glide = motion.reveal
        let landing = reduceMotion ? 0.25 : PieceMotion.calm.duration + 0.03
        let settle: Duration = settling ? .seconds(landing) : .zero
        Task { @MainActor in
            try? await Task.sleep(for: settle)
            scrolledID = nil
            withAnimation(glide) { scrolledID = id }
        }
    }

    /// Scrolls an existing tile into view (it needs no settling), then bumps it once as the glide lands.
    private func pulse(_ id: UUID) {
        reveal(id, settling: false)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(380))
            guard attachments.contains(where: { $0.id == id }) else { return }
            pulses[id, default: 0] += 1
        }
    }

    private func remove(_ id: UUID) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        let kind = attachments[index].kind
        withAnimation(motion.dismiss) { _ = attachments.remove(at: index) }
        removeTick += 1
        announce(kind == .video ? String(localized: "Removed video \(index + 1)") : String(localized: "Removed photo \(index + 1)"))
    }

    private func retry(_ id: UUID) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(motion.snap) { attachments[index].retry() }
        retryTick += 1
    }

    /// Writes into the attachment by id, only if it is still there and still on the same attempt.
    private func update(_ id: UUID, attempt: Int, animation: Animation? = nil, _ change: (inout Attachment) -> Void) {
        guard let index = attachments.firstIndex(where: { $0.id == id }), attachments[index].attempt == attempt else { return }
        if let animation {
            withAnimation(animation) { change(&attachments[index]) }
        } else {
            change(&attachments[index])
        }
    }

    // MARK: Loading

    private struct LoadKey: Hashable {
        let id: UUID
        let attempt: Int
    }

    private func load(_ id: UUID) async {
        guard let current = attachments.first(where: { $0.id == id }), case .loading = current.phase, let source = current.source else { return }
        let attempt = current.attempt
        let maxPixels = thumbnailPixels
        let progress = Progress(totalUnitCount: 0)

        // Mirrors the source's progress into the phase a few times a second, only when it moved.
        let poll = Task { @MainActor in
            var shown = -1.0
            while !Task.isCancelled {
                let fraction = progress.totalUnitCount > 0 ? min(max(progress.fractionCompleted, 0), 1) : 0
                if fraction > 0.005, abs(fraction - shown) >= 0.02 {
                    shown = fraction
                    update(id, attempt: attempt) { attachment in
                        if case .loading = attachment.phase { attachment.phase = .loading(progress: fraction) }
                    }
                }
                try? await Task.sleep(for: .milliseconds(120))
            }
        }
        defer { poll.cancel() }

        let work = Task.detached(priority: .userInitiated) {
            try await Pipeline.load(source, maxPixelSize: maxPixels, progress: progress)
        }
        do {
            let output = try await withTaskCancellationHandler {
                try await work.value
            } onCancel: {
                work.cancel()
            }
            // Removed, or retried by the caller, while the result was on its way: drop it.
            guard !Task.isCancelled else { return }
            poll.cancel()
            // A ring with progress holds full for a beat and the photo develops over it, so a ring partway round, or one
            // the poll has only just filled, is never cut short. Only the drawing waits: the payload and phase land now.
            let latest = attachments.first(where: { $0.id == id && $0.attempt == attempt })
            let closes = if let latest, case .loading(_?) = latest.phase { true } else { false }
            if closes { closingRings.insert(id) }
            update(id, attempt: attempt, animation: closes ? nil : motion.reveal) { attachment in
                attachment.phase = .loaded
                attachment.thumbnail = output.thumbnail
                attachment.data = output.data
                attachment.fileURL = output.fileURL
                attachment.contentType = output.contentType
                attachment.pixelSize = output.pixelSize
                attachment.duration = output.duration
                attachment.kind = output.kind
                attachment.revision += 1
                // The payload is on the attachment now. A UIImage or byte source is not kept twice.
                if case .item = attachment.source {} else if case .loader = attachment.source {} else { attachment.source = nil }
            }
            if closes {
                // Cut short if the tile is removed meanwhile, so the set never keeps an id.
                try? await Task.sleep(for: .milliseconds(150))
                withAnimation(motion.reveal) { _ = closingRings.remove(id) }
            }
        } catch {
            guard !Task.isCancelled, !(error is CancellationError) else { return }
            let reason = error.localizedDescription
            var failed = false
            update(id, attempt: attempt, animation: motion.error) { attachment in
                attachment.phase = .failed(reason: reason)
                failed = true
            }
            guard failed, let index = attachments.firstIndex(where: { $0.id == id }) else { return }
            // A batch failing together (offline, say) plays one error haptic, not one per tile.
            if Date.now.timeIntervalSince(lastFailHaptic) > 0.3 {
                lastFailHaptic = .now
                failTick += 1
            }
            announce(attachments[index].kind == .video ? String(localized: "Video \(index + 1) couldn't be loaded") : String(localized: "Photo \(index + 1) couldn't be loaded"))
        }
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Add tile

/// A liquid glass tile: wide with the title while the tray is empty, a square with the count once there is something
/// in it. One layout turns from a row into a column, so the plus disc travels and shrinks into place instead of fading
/// out and back in, while the glass reshapes around it. Under Reduce Motion it crossfades instead.
private struct AddTileLabel: View {
    let title: LocalizedStringKey
    let count: Int
    let limit: Int
    let side: CGFloat
    let style: AttachmentTray.Style

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let isEmpty = count == 0
        let isFull = count >= limit
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let layout = isEmpty ? AnyLayout(HStackLayout(spacing: 12)) : AnyLayout(VStackLayout(spacing: side * 0.07))
        let disc = side * (isEmpty ? 0.46 : 0.4)
        // The words clear out while the tile reshapes, and the new ones arrive once the disc has moved.
        let words = AnyTransition.asymmetric(
            insertion: motion.swap.animation(motion.cascade(motion.reveal, index: 1, step: 0.12)),
            removal: motion.swap.animation(motion.dismiss)
        )
        // No lift: the strip's headroom is 6 pt, and a wide shadow would be cut off at its edge.
        PieceLiquidGroup(lift: false) {
            layout {
                // Drawn at the wide size and scaled, so the plus glyph shrinks with its disc.
                PlusDisc(diameter: side * 0.46, style: style)
                    .scaleEffect(disc / (side * 0.46))
                    .frame(width: disc, height: disc)
                    .opacity(isFull ? 0.25 : 1)
                    // Reduce Motion: a new disc per shape, so it fades in place rather than travelling. It holds no state.
                    .id(reduceMotion ? AnyHashable(isEmpty) : AnyHashable(0))
                    .transition(.opacity)
                if isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(style.label)
                        Text("Up to \(limit)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(style.secondary)
                    }
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.leading)
                    .transition(words)
                } else {
                    Text(verbatim: "\(count)/\(limit)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(isFull ? style.label : style.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(count)))
                        // A count is read, so it rolls on `value`, never past the number it shows, whatever moves the strip.
                        .animation(motion.value, value: count)
                        .transition(words)
                }
            }
            .padding(.leading, isEmpty ? side * 0.2 : 0)
            .padding(.trailing, isEmpty ? side * 0.3 : 0)
            .frame(width: isEmpty ? nil : side, height: side)
            // Tiles stop growing at 1.5x; text inside them stops at the same point so it never outgrows its tile.
            .dynamicTypeSize(...DynamicTypeSize.accessibility2)
            // A title fading out where it stood never shows past the narrowing tile.
            .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
            // The picker's button sinks the tile itself, so the glass does not swell under the press as well.
            .pieceLiquid(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous), interactive: false)
        }
        .contentShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
    }
}

private struct PlusDisc: View {
    let diameter: CGFloat
    let style: AttachmentTray.Style

    var body: some View {
        Circle()
            .fill(style.signal)
            .frame(width: diameter, height: diameter)
            .overlay {
                Image(systemName: "plus")
                    .font(.system(size: diameter * 0.44, weight: .semibold))
                    .foregroundStyle(style.signalInk)
            }
    }
}

// MARK: - Tile

/// A thumbnail with liquid glass chrome floating over it. While the tile loads, retries or uploads, a status bubble
/// sits at its centre (the ring, the retry arrow on signal, the upload ring), joined to the remove badge in the
/// corner. The badge buds out of the status bubble when the tile drops onto the strip, and the bubble melts into the
/// badge once the photo has developed. A finished upload carries the bubble to the opposite corner as a sage check.
private struct TileView: View {
    let attachment: AttachmentTray.Attachment
    let position: Int
    let count: Int
    let side: CGFloat
    let style: AttachmentTray.Style
    let pulse: Int
    let closing: Bool
    let canSelect: Bool
    /// Seconds until the remove badge buds out of a tile just dropped onto the strip; `nil` for a tile already there.
    let arrival: Double?
    let remove: () -> Void
    let retry: () -> Void
    let select: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var layoutDirection
    /// The status bubble ("status") and the remove badge ("remove").
    @State private var buds = PieceBuds()
    /// While a dropped tile waits to bud its badge, changes wait with it.
    @State private var arriving = false
    /// The status bubble rests in the corner as the uploaded check. Changed only while the bubble is wanted, so one
    /// melting home never turns back toward the centre on its way.
    @State private var checked = false
    /// The tile's press, so the glass over it sinks with it.
    @State private var pressed = false

    private enum Status: Equatable { case ring(Double?), retry, upload(Double), uploaded }

    /// The status bubble. Shrunk at home in the badge it is about the badge's own size, so it melts in without
    /// showing past it.
    private let bubble: CGFloat = 30
    private let ringSide: CGFloat = 18
    private let badge: CGFloat = 22
    private let badgeInset: CGFloat = 4

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous) }
    private var isFailed: Bool { if case .failed = attachment.phase { true } else { false } }
    /// Loaded and drawn: the ring has closed and the photo is showing. The badges and the upload dim wait for this.
    private var developed: Bool { attachment.isLoaded && !closing }
    private var tapAction: (() -> Void)? {
        if isFailed { return retry }
        if attachment.isLoaded, canSelect { return select }
        return nil
    }
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }

    /// What the status bubble shows. One ring runs from loading through its closing beat, so it fills to full rather
    /// than being swapped, and stays full while the bubble melts home.
    private var status: Status {
        switch attachment.phase {
        case .loading(let progress): return .ring(progress)
        case .failed: return .retry
        case .loaded:
            guard developed, let upload = attachment.uploadProgress else { return .ring(1) }
            return upload >= 1 ? .uploaded : .upload(max(upload, 0))
        }
    }
    private var wantsStatus: Bool { !developed || attachment.uploadProgress != nil }
    private var wanted: [String] { (wantsStatus ? ["status"] : []) + (isEnabled ? ["remove"] : []) }

    // Where the bubbles rest, from the tile's centre, in the left-to-right space the chrome is laid out in.
    /// From the centre to a corner badge's centre, along each axis.
    private var cornerReach: CGFloat { side / 2 - badgeInset - badge / 2 }
    private var trailing: CGFloat { layoutDirection == .rightToLeft ? -1 : 1 }
    private var removeAt: CGSize { CGSize(width: trailing * cornerReach, height: -cornerReach) }
    private var statusAt: CGSize { checked ? CGSize(width: trailing * cornerReach, height: cornerReach) : .zero }

    var body: some View {
        // Reduce Motion holds a picked-again tile still, so it flashes brighter instead of bumping.
        let flash = reduceMotion ? 0.2 : 0
        // Always a button, so a tile keeps its identity (and does not re-run its transition) when it gains or loses a tap action.
        Button { tapAction?() } label: { face }
        .buttonStyle(TilePressStyle(isActive: tapAction != nil, pressed: $pressed))
        .keyframeAnimator(initialValue: 0.0, trigger: pulse) { tile, glow in
            tile.brightness(glow)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(flash, duration: 0.1)
                CubicKeyframe(flash, duration: 0.3)
                CubicKeyframe(0, duration: 0.4)
            }
        }
        .overlay { chrome }
        .overlay(alignment: .bottomLeading) { durationBadge }
        // The tile and its glass sink together, so the status bubble never floats free of a pressed tile.
        .piecePress(pressed)
        // One bump when the tile is picked again: a counter, so each repeat pick plays it once. At most 5 pt past
        // each edge, so a large tile stays inside the strip's headroom.
        .piecePop(trigger: pulse, amount: min(0.06, 10 / side))
        .contextMenu {
            if isFailed {
                Button(String(localized: "Retry"), systemImage: "arrow.clockwise", action: retry)
            }
            Button(String(localized: "Remove"), systemImage: "trash", role: .destructive, action: remove)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(value)
        .accessibilityAddTraits(tapAction != nil ? .isButton : [])
        .accessibilityAction { tapAction?() }
        .accessibilityActions {
            if isFailed { Button(String(localized: "Retry"), action: retry) }
            if isEnabled { Button(String(localized: "Remove"), action: remove) }
        }
        .onAppear { arrive() }
        .onChange(of: wanted) { _, _ in
            if !arriving { reconcile() }
        }
        // The finished upload carries the bubble to its corner a beat after the dim lifts, however the progress was written.
        .onChange(of: status == .uploaded) { _, isUploaded in
            guard wantsStatus else { return }
            withAnimation(motion.cascade(motion.success, index: 1, step: 0.1)) { checked = isUploaded }
        }
    }

    /// The thumbnail and what belongs to it: the placeholder, the developing photo, the Retry label and the upload dim.
    private var face: some View {
        ZStack {
            if developed, let thumbnail = attachment.thumbnail {
                // The photo develops: it settles from a slight zoom inside the tile, never smaller than it. On `value`,
                // which never overshoots, since a dip below full size would show the tile's edge.
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .frame(width: side, height: side)
                    .transition(motion.transition(.asymmetric(insertion: .scale(scale: 1.14).combined(with: .opacity), removal: .opacity)).animation(motion.value))
            }
            if isFailed {
                // A slot the size of the status bubble, with the label hanging just under it at any text size.
                Color.clear
                    .frame(width: bubble, height: bubble)
                    .overlay(alignment: .bottom) {
                        Text("Retry")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(style.label)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .frame(width: side - 12)
                            .alignmentGuide(.bottom) { $0[.top] - 5 }
                    }
                    .transition(motion.swap)
            }
            uploadLayer
        }
        .frame(width: side, height: side)
        // Behind the stack, not in it: a ZStack draws a leaving face below its siblings, so an opaque tile in the
        // stack would hide the outgoing photo and flash an empty tile before the next one arrives.
        .background(style.tile)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .clipShape(shape)
    }

    @ViewBuilder
    private var uploadLayer: some View {
        if developed, let upload = attachment.uploadProgress, upload < 1 {
            Color.black.opacity(0.4)
                .transition(.opacity)
        }
    }

    /// The glass over the thumbnail, laid out from the tile's centre in left-to-right space; the offsets above are
    /// worked out for the reading direction, so the badge sits top leading in a right-to-left strip.
    private var chrome: some View {
        // No lift: over a photo the glass needs no shadow, and the strip's headroom would cut one off.
        PieceLiquidGroup(lift: false) {
            ZStack {
                if buds.contains("status") { statusBubble }
                // Last, so the status bubble melting home slips under the badge.
                if buds.contains("remove") { removeBadge }
            }
            .frame(width: side, height: side)
        }
        .environment(\.layoutDirection, .leftToRight)
    }

    private var statusBubble: some View {
        let out = buds.isOut("status")
        // Tinted only while it says something, and only while out: drained by the time it melts into the badge.
        let tint: Color? = !out ? nil : checked ? style.uploaded : status == .retry ? style.signal : nil
        let size = checked ? badge : bubble
        return ZStack { statusContent }
            .pieceBudContent(out: out)
            .frame(width: size, height: size)
            .pieceLiquid(.circle, tint: tint, interactive: false)
            .pieceBud(out: out, rest: statusAt, home: removeAt)
    }

    /// The ring, the retry arrow or the check. A new kind blurs in over the old; a ring that only moves keeps going.
    @ViewBuilder
    private var statusContent: some View {
        // Its own beat, so the swap reads however the attachment was written.
        let swap = motion.swap.animation(motion.snap)
        switch status {
        case .ring(let progress):
            LoadingRing(progress: progress, color: style.label, diameter: ringSide)
                .transition(swap)
        case .upload(let progress):
            LoadingRing(progress: progress, color: style.label, diameter: ringSide)
                .transition(swap)
        case .retry:
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(style.signalInk)
                .transition(swap)
        case .uploaded:
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(style.signalInk)
                .transition(swap)
        }
    }

    private var removeBadge: some View {
        let out = buds.isOut("remove")
        // With no status bubble to melt into (the tray disabled on a loaded tile) the badge thins away as it shrinks
        // home, rather than leaving a bead of glass on the photo.
        let parent = buds.isOut("status")
        return Button(action: remove) {
            Image(systemName: "xmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(style.badgeInk)
                .pieceBudContent(out: out)
                .frame(width: badge, height: badge)
                .pieceLiquid(.circle, tint: out && style.badge != .clear ? style.badge : nil, interactive: false)
                // The badge is small; its hit area is the 44 pt around it.
                .frame(width: 44, height: 44)
                .contentShape(.rect)
        }
        // The liquid press, so the mark sinks with its glass.
        .buttonStyle(PieceLiquidPressStyle())
        .opacity(out || parent ? 1 : 0)
        .animation(out ? .easeOut(duration: 0.16) : .easeIn(duration: 0.36), value: out)
        .pieceBud(out: out, rest: removeAt, home: parent ? statusAt : removeAt)
    }

    /// A video's length on a glass capsule. It is in its own group, apart from the status bubble, so it never necks
    /// with the check in the opposite corner.
    @ViewBuilder
    private var durationBadge: some View {
        if attachment.kind == .video, let duration = attachment.duration, developed {
            PieceLiquidGroup(lift: false) {
                Text(Duration.seconds(duration.rounded()).formatted(.time(pattern: .minuteSecond)))
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(style.badgeInk)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .pieceLiquid(.capsule, tint: style.badge == .clear ? nil : style.badge, interactive: false)
            }
            .padding(6)
            // The poster's own caption, not a control: it rises in a beat after the poster develops, with the poster
            // as its parent rather than any glass.
            .transition(.asymmetric(
                insertion: motion.transition(.opacity.combined(with: .offset(y: 4))).animation(motion.cascade(motion.reveal, index: 1, step: 0.12)),
                removal: .opacity
            ))
        }
    }

    /// A tile dropped onto the strip lands with its status bubble, and a beat later the remove badge buds out of it.
    /// Anything else (the tray appearing with tiles in it) starts with every bubble in place.
    private func arrive() {
        checked = status == .uploaded
        guard let arrival, wantsStatus, isEnabled else {
            buds.place(wanted)
            return
        }
        buds.place(["status"])
        arriving = true
        Task {
            try? await Task.sleep(for: .seconds(arrival))
            arriving = false
            reconcile()
        }
    }

    /// Buds out what is wanted and not out yet, then calls home what is out and no longer wanted. A load that finished
    /// during the arrival beat buds the badge and melts the bubble into it in one move.
    private func reconcile() {
        let now = wanted
        let blooming = now.filter { !buds.isOut($0) }
        let gathering = ["status", "remove"].filter { buds.isOut($0) && !now.contains($0) }
        // A status bubble coming back (a new upload) starts from what it shows now, never from an old check.
        if blooming.contains("status") { checked = status == .uploaded }
        Task {
            if !blooming.isEmpty { await buds.bloom(blooming, reduceMotion: reduceMotion) }
            if !gathering.isEmpty { await buds.gather(gathering, reduceMotion: reduceMotion) }
        }
    }

    private var label: String {
        attachment.kind == .video ? String(localized: "Video \(position) of \(count)") : String(localized: "Photo \(position) of \(count)")
    }

    private var value: String {
        var parts: [String] = []
        switch attachment.phase {
        case .loading(let progress?):
            parts.append(String(localized: "Loading, \(progress.formatted(.percent.precision(.fractionLength(0))))"))
        case .loading(nil):
            parts.append(String(localized: "Loading"))
        case .failed:
            parts.append(String(localized: "Couldn't load"))
        case .loaded:
            if let duration = attachment.duration {
                parts.append(Duration.seconds(duration.rounded()).formatted(.units(allowed: [.minutes, .seconds], width: .wide)))
            }
            if let upload = attachment.uploadProgress {
                parts.append(upload >= 1 ? String(localized: "Uploaded") : String(localized: "Uploading, \(upload.formatted(.percent.precision(.fractionLength(0))))"))
            } else {
                parts.append(String(localized: "Loaded"))
            }
        }
        return parts.joined(separator: ", ")
    }
}

/// A determinate ring once progress is known, a spinning arc before that. Reduce Motion swaps the spin for the system indicator.
private struct LoadingRing: View {
    let progress: Double?
    let color: Color
    let diameter: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let line = max(diameter * 0.11, 2.5)
        ZStack {
            Circle().stroke(color.opacity(0.16), lineWidth: line)
            if let progress {
                Circle()
                    .trim(from: 0, to: max(progress, 0.02))
                    .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    // Progress is data: a smooth follow, no overshoot, a little longer than the 120 ms poll so steps
                    // read as one fill. The last stretch closes fast, so the ring is full before the photo covers it.
                    .animation(progress >= 1 ? .spring(PieceMotion.tight) : .smooth(duration: 0.3), value: progress)
            } else if reduceMotion {
                ProgressView().tint(color).controlSize(.small)
            } else {
                TimelineView(.animation) { context in
                    let turn = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 0.9) / 0.9
                    Circle()
                        .trim(from: 0, to: 0.28)
                        .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                        .rotationEffect(.degrees(turn * 360))
                }
            }
        }
        .frame(width: diameter, height: diameter)
    }
}

/// Reports the tile's press, only while the tile has something to do when tapped. The tile draws the press itself,
/// so the glass over it sinks with it.
private struct TilePressStyle: ButtonStyle {
    var isActive = true
    @Binding var pressed: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, isPressed in
                pressed = isPressed && isActive
            }
    }
}

// MARK: - Pipeline

/// Where an attachment's bytes come from.
private enum Source: Sendable {
    case item(PhotosPickerItem)
    case image(UIImage)
    case data(Data)
    case file(URL)
    case loader(@Sendable (Progress) async throws -> Data)
}

/// Picked images arrive as their original encoded bytes (HEIC stays HEIC; nothing is transcoded).
private struct PickedImage: Transferable {
    let data: Data
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { PickedImage(data: $0) }
    }
}

/// Picked videos are copied out of the picker's short-lived file into the temporary directory, never into memory.
private struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .movie) { received in
            let folder = URL.temporaryDirectory.appending(path: "AttachmentTray", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let destination = folder.appending(path: "\(UUID().uuidString).\(received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension)")
            try FileManager.default.copyItem(at: received.file, to: destination)
            return PickedMovie(url: destination)
        }
    }
}

private enum Pipeline {
    struct Output: Sendable {
        var thumbnail: UIImage
        var data: Data?
        var fileURL: URL?
        var contentType: UTType?
        var pixelSize: CGSize?
        var duration: TimeInterval?
        var kind: AttachmentTray.Attachment.Kind
    }

    enum Failure: LocalizedError {
        case unreadable, unavailable

        var errorDescription: String? {
            switch self {
            case .unreadable: String(localized: "The file isn't a readable image or video.")
            case .unavailable: String(localized: "The item is no longer available.")
            }
        }
    }

    /// Runs on a detached task: nothing here touches the main actor.
    nonisolated static func load(_ source: Source, maxPixelSize: CGFloat, progress: Progress) async throws -> Output {
        switch source {
        case .item(let item):
            if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
                let movie = try await transfer(item, as: PickedMovie.self, progress: progress)
                return try await video(at: movie.url, maxPixelSize: maxPixelSize)
            }
            let picked = try await transfer(item, as: PickedImage.self, progress: progress)
            return try image(from: picked.data, maxPixelSize: maxPixelSize)
        case .image(let image):
            guard let data = image.jpegData(compressionQuality: 0.9) else { throw Failure.unreadable }
            try Task.checkCancellation()
            return try self.image(from: data, maxPixelSize: maxPixelSize)
        case .data(let data):
            return try image(from: data, maxPixelSize: maxPixelSize)
        case .file(let url):
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if UTType(filenameExtension: url.pathExtension)?.conforms(to: .movie) == true {
                return try await video(at: url, maxPixelSize: maxPixelSize)
            }
            var output = try image(from: try Data(contentsOf: url, options: .mappedIfSafe), maxPixelSize: maxPixelSize)
            output.fileURL = url
            return output
        case .loader(let load):
            let data = try await load(progress)
            try Task.checkCancellation()
            return try image(from: data, maxPixelSize: maxPixelSize)
        }
    }

    /// `loadTransferable` with its `Progress` wired to the tile and Swift cancellation wired to the load.
    private nonisolated static func transfer<T: Transferable & Sendable>(_ item: PhotosPickerItem, as type: T.Type, progress: Progress) async throws -> T {
        // The picker's `Progress`, so a Swift cancellation that arrives before or after it exists still cancels the load.
        let handle = OSAllocatedUnfairLock(initialState: (progress: Progress?.none, isCancelled: false))
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<T, Error>) in
                let child = item.loadTransferable(type: type) { result in
                    switch result {
                    case .success(let value?): continuation.resume(returning: value)
                    case .success(nil): continuation.resume(throwing: Failure.unavailable)
                    case .failure(let error): continuation.resume(throwing: error)
                    }
                }
                progress.totalUnitCount = 100
                progress.addChild(child, withPendingUnitCount: 100)
                handle.withLock { state in
                    if state.isCancelled { child.cancel() } else { state.progress = child }
                }
            }
        } onCancel: {
            handle.withLock { state in
                state.isCancelled = true
                state.progress?.cancel()
            }
        }
    }

    /// Decodes straight to a thumbnail: ImageIO reads only as much of the file as the target size needs, so a
    /// 48 MP photo never becomes a full-size bitmap.
    nonisolated static func image(from data: Data, maxPixelSize: CGFloat) throws -> Output {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              CGImageSourceGetCount(source) > 0,
              let cgImage = thumbnail(source, maxPixelSize: maxPixelSize)
        else { throw Failure.unreadable }
        let type = (CGImageSourceGetType(source) as String?).flatMap { UTType($0) }
        return Output(thumbnail: UIImage(cgImage: cgImage), data: data, contentType: type, pixelSize: pixelSize(source), kind: .image)
    }

    private nonisolated static func thumbnail(_ source: CGImageSource, maxPixelSize: CGFloat) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: max(Int(maxPixelSize.rounded(.up)), 1),
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    private nonisolated static func pixelSize(_ source: CGImageSource) -> CGSize? {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int
        else { return nil }
        // EXIF orientations 5 through 8 are rotated a quarter turn.
        let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
        return orientation >= 5 ? CGSize(width: height, height: width) : CGSize(width: width, height: height)
    }

    /// A poster frame half a second in (or the middle of a shorter clip), cut at the thumbnail size.
    nonisolated static func video(at url: URL, maxPixelSize: CGFloat) async throws -> Output {
        let asset = AVURLAsset(url: url)
        let (duration, isPlayable) = try await asset.load(.duration, .isPlayable)
        guard isPlayable else { throw Failure.unreadable }
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: maxPixelSize, height: maxPixelSize)
        let seconds = duration.seconds.isFinite ? duration.seconds : 0
        let (cgImage, _) = try await generator.image(at: CMTime(seconds: min(0.5, seconds / 2), preferredTimescale: 600))
        var size: CGSize?
        if let track = try await asset.loadTracks(withMediaType: .video).first {
            let (natural, transform) = try await track.load(.naturalSize, .preferredTransform)
            let rect = CGRect(origin: .zero, size: natural).applying(transform)
            size = CGSize(width: abs(rect.width), height: abs(rect.height))
        }
        return Output(thumbnail: UIImage(cgImage: cgImage), fileURL: url, contentType: UTType(filenameExtension: url.pathExtension), pixelSize: size, duration: seconds, kind: .video)
    }

    /// Re-encodes as JPEG without metadata. ImageIO copies no properties unless asked, so GPS and camera data are dropped.
    nonisolated static func jpeg(data: Data?, url: URL?, maxPixelSize: CGFloat, quality: CGFloat) -> Data? {
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = data.flatMap({ CGImageSourceCreateWithData($0 as CFData, options) }) ?? url.flatMap({ CGImageSourceCreateWithURL($0 as CFURL, options) }),
              let image = thumbnail(source, maxPixelSize: maxPixelSize)
        else { return nil }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(destination) ? output as Data : nil
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

/// Two photos already in, one still downloading, and one whose download fails, so every tile state shows.
private struct AttachmentTrayExample: View {
    @State private var attachments = ExamplePhoto.attachments()

    var body: some View {
        AttachmentTray(attachments: $attachments, limit: 6)
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

/// Flat drawn scenes standing in for photos, so the preview needs no assets.
private enum ExamplePhoto {
    static func attachments() -> [AttachmentTray.Attachment] {
        [
            .init(data: data(0)),
            .init(data: data(1)),
            .init { progress in
                progress.totalUnitCount = 10
                for step in 1...10 {
                    try await Task.sleep(for: .milliseconds(350))
                    progress.completedUnitCount = Int64(step)
                }
                return data(2)
            },
            .init { _ in
                try await Task.sleep(for: .seconds(1.5))
                throw URLError(.notConnectedToInternet)
            },
        ]
    }

    nonisolated static func data(_ index: Int) -> Data {
        let palette: [(UInt32, UInt32, UInt32)] = [(0x9CC2FF, 0xFFD976, 0xA9DCB7), (0xE9D5B3, 0xFF0000, 0xCDB8FF), (0xA9DCB7, 0xF4F3EF, 0x9CC2FF)]
        let (sky, sun, land) = palette[index % palette.count]
        let size = CGSize(width: 1200, height: 900)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            func fill(_ hex: UInt32) { UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1).setFill() }
            fill(sky); context.fill(CGRect(origin: .zero, size: size))
            fill(sun); UIBezierPath(ovalIn: CGRect(x: 480, y: 160, width: 260, height: 260)).fill()
            fill(land)
            let hill = UIBezierPath()
            hill.move(to: CGPoint(x: 0, y: 640))
            hill.addQuadCurve(to: CGPoint(x: 1200, y: 560), controlPoint: CGPoint(x: 520, y: 420))
            hill.addLine(to: CGPoint(x: 1200, y: 900))
            hill.addLine(to: CGPoint(x: 0, y: 900))
            hill.fill()
        }
        return image.jpegData(compressionQuality: 0.9) ?? Data()
    }
}

#Preview("Light") {
    AttachmentTrayExample()
}

#Preview("Dark") {
    AttachmentTrayExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, pressMath, press, pressStyle, pop)

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
