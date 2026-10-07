// swiftpieces:
// title: Attachment Tray
// description: "A horizontal attachment strip for composers, support forms and listings: an add tile opens the photo picker with the remaining limit, each pick lands as its own tile that loads with a live progress ring, downsamples off the main thread into a crisp thumbnail and settles in with a spring, failures turn into a retry tile, the remove badge cancels an in-flight load, duplicates and over-limit picks are caught, and the caller owns every attachment for upload."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.1"
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
        /// The add tile and the loading and failed tiles.
        public var tile: Color
        /// The add glyph's disc, progress rings and labels on tiles.
        public var label: Color
        /// The count on the add tile and the empty-state subtitle.
        public var secondary: Color
        /// The remove badge and the video duration badge.
        public var badge: Color
        /// Glyphs and text on `badge`.
        public var badgeInk: Color
        /// The retry disc on a failed tile.
        public var signal: Color
        /// The glyph on `signal`.
        public var signalInk: Color
        /// The check glyph (on `badge`) shown once `uploadProgress` reaches 1.
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
            self.badge = badge ?? adaptive(light: 0x141414, dark: 0x141414)
            self.badgeInk = badgeInk ?? adaptive(light: 0xF4F3EF, dark: 0xF4F3EF)
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
    @State private var pulseID: UUID?
    @State private var scrolledID: UUID?
    @State private var addTick = 0
    @State private var removeTick = 0
    @State private var warnTick = 0
    @State private var failTick = 0
    @State private var retryTick = 0

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

    private var motion: Animation { reduceMotion ? .smooth(duration: 0.2) : .spring(duration: 0.42, bounce: 0.24) }
    private var side: CGFloat { style.tileSize * min(max(typeScale, 1), 1.5) }
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
                        isPulsing: pulseID == attachment.id,
                        canSelect: onSelect != nil,
                        remove: { remove(attachment.id) },
                        retry: { retry(attachment.id) },
                        select: { onSelect?(attachment) }
                    )
                    .id(attachment.id)
                    .transition(reduceMotion ? .opacity : .asymmetric(
                        insertion: .scale(scale: 0.6).combined(with: .opacity),
                        removal: .scale(scale: 0.5).combined(with: .opacity)
                    ))
                    // One load per attempt. SwiftUI cancels it when the tile leaves (removed, or the tray goes away).
                    .task(id: LoadKey(id: attachment.id, attempt: attachment.attempt)) {
                        await load(attachment.id)
                    }
                }
            }
            .scrollTargetLayout()
            // Room for the spring overshoot of an inserted or pulsed tile.
            .padding(.vertical, 6)
        }
        .scrollIndicators(.hidden)
        // A strip is as tall as its tiles, however much height it is offered.
        .fixedSize(horizontal: false, vertical: true)
        .scrollPosition(id: $scrolledID, anchor: .trailing)
        .onChange(of: ids) { old, new in
            // New tiles at the end scroll into view. Filling an empty tray (a restored draft) keeps the add tile in view.
            guard !old.isEmpty, let last = new.last, !old.contains(last) else { return }
            reveal(last)
        }
        .animation(motion, value: ids)
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
        .buttonStyle(PressStyle(reduceMotion: reduceMotion))
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
            withAnimation(motion) { attachments.append(contentsOf: result.added) }
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
    /// for the insertion spring to settle, then glides to the tile.
    private func reveal(_ id: UUID, settling: Bool = true) {
        let animation = motion
        let settle: Duration = settling ? .milliseconds(reduceMotion ? 250 : 450) : .zero
        Task { @MainActor in
            try? await Task.sleep(for: settle)
            scrolledID = nil
            withAnimation(animation) { scrolledID = id }
        }
    }

    /// Scrolls an existing tile into view (it needs no settling), then gives it a quick bump.
    private func pulse(_ id: UUID) {
        reveal(id, settling: false)
        let animation = motion
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(380))
            withAnimation(.spring(duration: 0.25, bounce: 0.5)) { pulseID = id }
            try? await Task.sleep(for: .milliseconds(320))
            withAnimation(animation) { if pulseID == id { pulseID = nil } }
        }
    }

    private func remove(_ id: UUID) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        let kind = attachments[index].kind
        withAnimation(motion) { _ = attachments.remove(at: index) }
        removeTick += 1
        announce(kind == .video ? String(localized: "Removed video \(index + 1)") : String(localized: "Removed photo \(index + 1)"))
    }

    private func retry(_ id: UUID) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(motion) { attachments[index].retry() }
        retryTick += 1
    }

    /// Writes into the attachment by id, only if it is still there and still on the same attempt.
    private func update(_ id: UUID, attempt: Int, animated: Bool = true, _ change: (inout Attachment) -> Void) {
        guard let index = attachments.firstIndex(where: { $0.id == id }), attachments[index].attempt == attempt else { return }
        if animated {
            withAnimation(motion) { change(&attachments[index]) }
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
                    update(id, attempt: attempt, animated: false) { attachment in
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
            update(id, attempt: attempt) { attachment in
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
        } catch {
            guard !Task.isCancelled, !(error is CancellationError) else { return }
            let reason = error.localizedDescription
            var failed = false
            update(id, attempt: attempt) { attachment in
                attachment.phase = .failed(reason: reason)
                failed = true
            }
            guard failed, let index = attachments.firstIndex(where: { $0.id == id }) else { return }
            failTick += 1
            announce(attachments[index].kind == .video ? String(localized: "Video \(index + 1) couldn't be loaded") : String(localized: "Photo \(index + 1) couldn't be loaded"))
        }
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Add tile

/// Wide with the title while the tray is empty; a square with the count once there is something in it.
private struct AddTileLabel: View {
    let title: LocalizedStringKey
    let count: Int
    let limit: Int
    let side: CGFloat
    let style: AttachmentTray.Style

    var body: some View {
        let isFull = count >= limit
        Group {
            if count == 0 {
                HStack(spacing: 12) {
                    PlusDisc(diameter: side * 0.46, style: style)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(style.label)
                        Text("Up to \(limit)")
                            .font(.caption)
                            .foregroundStyle(style.secondary)
                    }
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.leading)
                }
                .padding(.leading, side * 0.2)
                .padding(.trailing, side * 0.3)
                .transition(.opacity)
            } else {
                VStack(spacing: side * 0.07) {
                    PlusDisc(diameter: side * 0.4, style: style)
                        .opacity(isFull ? 0.25 : 1)
                    Text(verbatim: "\(count)/\(limit)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(isFull ? style.label : style.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(width: side)
                .transition(.opacity)
            }
        }
        .frame(height: side)
        // Tiles stop growing at 1.5x; text inside them stops at the same point so it never outgrows its tile.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .background(style.tile, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
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
                    .font(.system(size: diameter * 0.44, weight: .bold))
                    .foregroundStyle(style.signalInk)
            }
    }
}

// MARK: - Tile

private struct TileView: View {
    let attachment: AttachmentTray.Attachment
    let position: Int
    let count: Int
    let side: CGFloat
    let style: AttachmentTray.Style
    let isPulsing: Bool
    let canSelect: Bool
    let remove: () -> Void
    let retry: () -> Void
    let select: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous) }
    private var isFailed: Bool { if case .failed = attachment.phase { true } else { false } }
    private var tapAction: (() -> Void)? {
        if isFailed { return retry }
        if attachment.isLoaded, canSelect { return select }
        return nil
    }

    var body: some View {
        // Always a button, so a tile keeps its identity (and does not re-run its transition) when it gains or loses a tap action.
        Button { tapAction?() } label: { face }
        .buttonStyle(PressStyle(reduceMotion: reduceMotion, isActive: tapAction != nil))
        .overlay(alignment: .topTrailing) {
            if isEnabled {
                Button(action: remove) {
                    Circle()
                        .fill(style.badge)
                        .frame(width: 22, height: 22)
                        .overlay {
                            Image(systemName: "xmark")
                                .font(.system(size: 9, weight: .heavy))
                                .foregroundStyle(style.badgeInk)
                        }
                        .padding(4)
                        // The badge is small; its hit area is the full 44pt corner of the tile.
                        .frame(width: 44, height: 44, alignment: .topTrailing)
                        .contentShape(.rect)
                }
                .buttonStyle(PressStyle(reduceMotion: reduceMotion))
                .transition(.opacity)
            }
        }
        .scaleEffect(isPulsing && !reduceMotion ? 1.08 : 1)
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
    }

    private var face: some View {
        ZStack {
            style.tile
            switch attachment.phase {
            case .loading(let progress):
                LoadingRing(progress: progress, color: style.label, diameter: side * 0.3)
                    .transition(.opacity)
            case .failed:
                VStack(spacing: side * 0.07) {
                    Circle()
                        .fill(style.signal)
                        .frame(width: side * 0.3, height: side * 0.3)
                        .overlay {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: side * 0.14, weight: .bold))
                                .foregroundStyle(style.signalInk)
                        }
                    Text("Retry")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(style.label)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .transition(.opacity)
            case .loaded:
                if let thumbnail = attachment.thumbnail {
                    Image(uiImage: thumbnail)
                        .resizable()
                        .scaledToFill()
                        .frame(width: side, height: side)
                        .transition(reduceMotion ? .opacity : .asymmetric(insertion: .scale(scale: 1.14).combined(with: .opacity), removal: .opacity))
                }
            }
            uploadLayer
        }
        .frame(width: side, height: side)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .clipShape(shape)
        .overlay(alignment: .bottomLeading) {
            if attachment.kind == .video, let duration = attachment.duration, attachment.isLoaded {
                Text(Duration.seconds(duration.rounded()).formatted(.time(pattern: .minuteSecond)))
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(style.badgeInk)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(style.badge, in: .capsule)
                    .padding(6)
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if attachment.isLoaded, let upload = attachment.uploadProgress, upload >= 1 {
                Circle()
                    .fill(style.badge)
                    .frame(width: 22, height: 22)
                    .overlay {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(style.uploaded)
                    }
                    .padding(4)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
            }
        }
    }

    @ViewBuilder
    private var uploadLayer: some View {
        if attachment.isLoaded, let upload = attachment.uploadProgress, upload < 1 {
            ZStack {
                Color.black.opacity(0.4)
                LoadingRing(progress: max(upload, 0), color: .white, diameter: side * 0.3)
            }
            .transition(.opacity)
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
                    .animation(.smooth(duration: 0.3), value: progress)
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

/// A quick dip on press that springs back, like a native tile.
private struct PressStyle: ButtonStyle {
    let reduceMotion: Bool
    var isActive = true

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed && isActive
        return configuration.label
            .scaleEffect(pressed && !reduceMotion ? 0.94 : 1)
            .opacity(pressed && reduceMotion ? 0.7 : 1)
            .animation(.spring(duration: 0.3, bounce: 0.35), value: configuration.isPressed)
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
