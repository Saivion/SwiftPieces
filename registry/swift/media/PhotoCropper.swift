// swiftpieces:
// title: Photo Cropper
// description: "A crop step for profile photos, posts and listings that keeps the picked photo covering a frame of the chosen aspect at every zoom and offset, pinches around the fingers while it pans, rubber-bands past its limits and springs back with a red flash on the frame and a rigid tick at a zoom limit, morphs between circle, square, 4:5, 16:9 and the photo's own shape without losing the subject, turns a quarter at a time, fades in a rule-of-thirds grid under the finger, and renders the crop off the main thread at the original's full resolution together with its pixel rect and rotation for cropping again on a server."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.1"
// added: "2026-09-29"
// tags: [crop, photo, avatar, pinch-zoom, rotate, aspect-ratio, image, editor]

import SwiftUI
import UIKit

/// A crop step for a picked photo: the photo under a frame of the chosen aspect, with pinch, pan, rotate and aspect chips.
///
/// The photo always covers the frame. It can't be zoomed out or dragged so far that an empty edge stays in the
/// frame: past a limit it resists and springs back on release. The framing is stored relative to the photo (zoom
/// relative to the smallest scale that fills the frame, and the photo point at the frame's centre), so rotating,
/// switching aspect and size changes keep the same subject in frame. Choose renders the crop from the original, off
/// the main actor, and hands you a ``Crop``. A drag that starts on the photo pans it; it never scrolls an enclosing
/// scroll view or pulls a sheet down.
///
/// ```swift
/// @State private var photo: UIImage   // keep it in state, never create it in `body`
///
/// PhotoCropper(image: photo, aspect: .circle, onCancel: { dismiss() }) { crop in
///     avatar = crop.image
///     dismiss()
/// }
/// ```
///
/// - Parameters:
///   - image: The photo to crop, at full size, such as one loaded from a `PhotosPicker` item. Its orientation is respected. An on-screen copy is cut from it once, off the main actor; the crop is always rendered from this original. Keep it in state rather than creating it in `body`, or every update starts over.
///   - aspect: The frame to start with. Defaults to `.square`.
///   - framing: Bound framing, instead of `aspect`: the aspect, zoom, centre and rotation, updated as people adjust them. Set it to reopen a crop where it was left (`crop.framing` from an earlier result) or to drive the cropper from your own controls. While a finger is down it can briefly sit past the limits (the rubber band); it settles inside them on release.
///   - aspects: The aspect chips under the photo, in order. Defaults to circle, square, 4:5, 16:9 and the photo's own shape. One aspect, or none, hides the chips for a fixed frame. An aspect that isn't listed is added at the front.
///   - maxOutputDimension: The longest side of the rendered crop, in pixels. Defaults to 4096. Larger crops are scaled down to it; smaller ones keep the original's pixels and are never scaled up.
///   - messages: The cropper's copy. Defaults are localizable through your String Catalog; replace any line, for example `choose` with "Use photo".
///   - style: Colors, the photo's well and the frame inset. Defaults to the SwiftPieces house palette, adapting to light and dark, with red for Choose, the selected aspect and the limit flash.
///   - onCancel: Shows a Cancel button (and Escape on a hardware keyboard) that calls this. `nil` hides it.
///   - onCrop: Called on the main actor with the rendered ``Crop`` when Choose is tapped (or Return is pressed). Choose keeps spinning until this returns, so you can await an upload here.
public struct PhotoCropper: View {

    // MARK: Aspect

    /// The shape of the crop frame: a fixed ratio, a circle, or the photo's own shape.
    public struct Aspect: Hashable, Sendable, Codable, Identifiable {
        fileprivate enum Kind: Hashable, Sendable, Codable {
            case ratio(width: Int, height: Int)
            case circle
            case original
        }

        fileprivate let kind: Kind
        /// The chip's title. `nil` uses the built-in name from ``PhotoCropper/Messages`` ("Circle", "Square", "Original") or the ratio, such as "4:5".
        public let title: String?

        fileprivate init(kind: Kind, title: String? = nil) {
            self.kind = kind
            self.title = title
        }

        /// A circular frame for avatars. The rendered crop is still square: clip it when you draw it (`.clipShape(.circle)`).
        public static let circle = Aspect(kind: .circle)
        /// A 1:1 frame.
        public static let square = Aspect(kind: .ratio(width: 1, height: 1))
        /// A 4:5 portrait frame, the tallest most feeds show.
        public static let portrait = Aspect(kind: .ratio(width: 4, height: 5))
        /// A 16:9 landscape frame for covers, banners and video thumbnails.
        public static let landscape = Aspect(kind: .ratio(width: 16, height: 9))
        /// The photo's own shape. It turns with the photo when you rotate.
        public static let original = Aspect(kind: .original)
        /// Circle, square, 4:5, 16:9 and the photo's own shape: the default chips.
        public static let standard: [Aspect] = [.circle, .square, .portrait, .landscape, .original]

        /// Any fixed ratio, such as `.ratio(3, 2)` or `.ratio(9, 16)`, reduced to lowest terms. The chip shows `title`, or the ratio ("3:2") when it's `nil`.
        public static func ratio(_ width: Int, _ height: Int, title: String? = nil) -> Aspect {
            let w = max(width, 1), h = max(height, 1)
            var a = w, b = h
            while b != 0 { (a, b) = (b, a % b) }
            return Aspect(kind: .ratio(width: w / a, height: h / a), title: title)
        }

        /// The same frame with another chip title, such as `PhotoCropper.Aspect.square.titled("Post")`.
        public func titled(_ title: String) -> Aspect { Aspect(kind: kind, title: title) }

        /// Width over height: the fixed ratio, `1` for the circle, `nil` for the photo's own shape.
        nonisolated public var ratio: CGFloat? {
            switch kind {
            case .ratio(let width, let height): width > 0 && height > 0 ? CGFloat(width) / CGFloat(height) : 1
            case .circle: 1
            case .original: nil
            }
        }

        /// Whether the frame is drawn as a circle.
        public var isCircle: Bool { kind == .circle }

        public var id: String {
            switch kind {
            case .ratio(let width, let height): "\(width):\(height)"
            case .circle: "circle"
            case .original: "original"
            }
        }

        /// Two aspects are the same frame whatever their titles.
        public static func == (a: Aspect, b: Aspect) -> Bool { a.kind == b.kind }
        public func hash(into hasher: inout Hasher) { hasher.combine(kind) }
    }

    // MARK: Framing

    /// Where the photo sits in the frame. `Codable`, so a crop can be stored and reopened where it was left.
    public struct Framing: Equatable, Sendable, Codable {
        /// The frame's shape.
        public var aspect: Aspect
        /// Zoom relative to the smallest scale that fills the frame: `1` fills it edge to edge, `2` is twice as close. Kept between 1 and 5 (less for very small photos, so a crop never drops below 32 pixels).
        public var zoom: CGFloat
        /// The photo point at the centre of the frame, in unit coordinates of the upright photo before rotation: `(0.5, 0.5)` is its middle.
        public var center: CGPoint
        /// Quarter turns to the left (counterclockwise), 0 to 3.
        public var quarterTurns: Int

        public init(aspect: Aspect = .square, zoom: CGFloat = 1, center: CGPoint = CGPoint(x: 0.5, y: 0.5), quarterTurns: Int = 0) {
            self.aspect = aspect
            self.zoom = zoom
            self.center = center
            self.quarterTurns = quarterTurns & 3
        }
    }

    // MARK: Crop

    /// A finished crop: the image, and what it takes to repeat it from the original.
    public struct Crop: Sendable {
        /// The cropped photo, upright (orientation `.up`, scale 1), rendered from the original's pixels in its color space. Up to `maxOutputDimension` on its longer side; never scaled up. A circle crop is square.
        public let image: UIImage
        /// The crop in pixels of the upright original: the photo with its orientation applied, before `quarterTurns`. Cut this rect, then turn the result, to repeat the crop on a server.
        public let rect: CGRect
        /// Quarter turns to the left (counterclockwise), 0 to 3, applied after cutting `rect`.
        public let quarterTurns: Int
        /// The framing that made it. Pass it back through `framing:` to reopen the cropper where it was left.
        public let framing: Framing
        /// The frame's shape. For `.circle`, clip the square `image` when you draw it.
        public var aspect: Aspect { framing.aspect }
    }

    // MARK: Messages

    /// The cropper's copy. Every default goes through `String(localized:)`, so it can be translated in your String
    /// Catalog, and any line can be replaced: `.init(choose: "Use photo")`.
    public struct Messages: Sendable {
        /// The primary button.
        public var choose: String
        /// The Cancel button, shown when `onCancel` is set.
        public var cancel: String
        /// The Reset button, enabled once the crop differs from where it started.
        public var reset: String
        /// The rotate button's accessibility label.
        public var rotate: String
        /// The circle chip.
        public var circle: String
        /// The square chip.
        public var square: String
        /// The chip for the photo's own shape.
        public var original: String
        /// The crop area's accessibility label.
        public var cropArea: String
        /// Shown in the frame when the photo can't be opened.
        public var failed: String
        /// Shown briefly when rendering the crop fails.
        public var renderFailed: String

        /// Pass only the lines you want to change.
        public init(
            choose: String = String(localized: "Choose", comment: "Photo cropper primary button that crops the photo"),
            cancel: String = String(localized: "Cancel", comment: "Photo cropper button that leaves without cropping"),
            reset: String = String(localized: "Reset", comment: "Photo cropper button that undoes zoom, position, rotation and aspect"),
            rotate: String = String(localized: "Rotate left", comment: "Photo cropper button that turns the photo a quarter turn counterclockwise"),
            circle: String = String(localized: "Circle", comment: "Photo cropper aspect chip for a circular frame"),
            square: String = String(localized: "Square", comment: "Photo cropper aspect chip for a 1:1 frame"),
            original: String = String(localized: "Original", comment: "Photo cropper aspect chip for the photo's own shape"),
            cropArea: String = String(localized: "Crop area", comment: "Accessibility label of the photo cropper's adjustable canvas"),
            failed: String = String(localized: "Couldn't open this photo", comment: "Photo cropper message when the photo can't be shown"),
            renderFailed: String = String(localized: "Couldn't crop the photo. Try again.", comment: "Photo cropper message when rendering the crop fails")
        ) {
            self.choose = choose
            self.cancel = cancel
            self.reset = reset
            self.rotate = rotate
            self.circle = circle
            self.square = square
            self.original = original
            self.cropArea = cropArea
            self.failed = failed
            self.renderFailed = renderFailed
        }

        public static var standard: Messages { Messages() }
    }

    // MARK: Style

    /// Colors, the well's corner radius and the frame inset. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The ground under the toolbar and around the photo's well.
        public var background: Color
        /// The well the photo sits in. Dark in both appearances, like a darkroom, so the photo, the scrim and the frame read the same in light and dark.
        public var canvas: Color
        /// Laid over the photo outside the frame. Dark in both appearances, so the frame reads.
        public var scrim: Color
        /// The frame's edge, its corner marks and the thirds grid.
        public var edge: Color
        /// Choose, the selected aspect's glyph and the frame's flash at a zoom limit.
        public var accent: Color
        /// Text and the spinner on `accent`.
        public var accentInk: Color
        /// Aspect chips and the rotate button.
        public var control: Color
        /// The selected aspect chip.
        public var selectedControl: Color
        /// Titles, Cancel and Reset.
        public var label: Color
        /// Unselected chip titles and outlines.
        public var secondaryLabel: Color
        /// The well's corner radius. `0` runs the photo edge to edge.
        public var cornerRadius: CGFloat
        /// The least room between the frame and the edges of the well.
        public var frameInset: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(background: Color? = nil, canvas: Color? = nil, scrim: Color? = nil, edge: Color? = nil, accent: Color? = nil, accentInk: Color? = nil, control: Color? = nil, selectedControl: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, cornerRadius: CGFloat = 26, frameInset: CGFloat = 18) {
            self.background = background ?? adaptive(light: 0xF3F2EE, dark: 0x121212)
            self.canvas = canvas ?? Color(red: 0.071, green: 0.071, blue: 0.071)
            self.scrim = scrim ?? Color(red: 0.071, green: 0.071, blue: 0.071).opacity(0.62)
            self.edge = edge ?? Color(red: 0.957, green: 0.953, blue: 0.937)
            self.accent = accent ?? Color(red: 1, green: 0, blue: 0)
            self.accentInk = accentInk ?? Color(red: 0.078, green: 0.078, blue: 0.078)
            self.control = control ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.selectedControl = selectedControl ?? adaptive(light: 0xFFFFFF, dark: 0x262626)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.cornerRadius = max(cornerRadius, 0)
            self.frameInset = max(frameInset, 0)
        }

        public static let standard = Style()
    }

    // MARK: State

    private enum Phase: Equatable { case editing, rendering, done }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.displayScale) private var displayScale
    @ScaledMetric(relativeTo: .caption) private var glyphSide: CGFloat = 18
    @ScaledMetric(relativeTo: .body) private var buttonSide: CGFloat = 44

    /// Owned when no framing is bound.
    @State private var ownFraming: Framing
    /// The on-screen copy and the photo it was cut from.
    @State private var display: UIImage?
    @State private var displaySource: ObjectIdentifier?
    @State private var failed = false
    @State private var canvasSize: CGSize = .zero
    /// Quarter turns shown, counted without wrapping, so every turn animates the way it went.
    @State private var shownTurns: Int
    /// Where Reset goes: the photo filling the starting aspect.
    @State private var rest: Framing
    @State private var live: LiveGesture?
    @State private var showsGrid = false
    @State private var showsReadout = false
    @State private var gridTask: Task<Void, Never>?
    @State private var flashing = false
    @State private var flashTask: Task<Void, Never>?
    @State private var phase: Phase = .editing
    @State private var renderTask: Task<Void, Never>?
    @State private var delivering = false
    @State private var notice: String?
    @State private var noticeTask: Task<Void, Never>?
    @State private var aspectTick = 0
    @State private var rotateTick = 0
    @State private var limitTick = 0
    @State private var resetTick = 0
    @State private var successTick = 0
    @State private var errorTick = 0

    private let image: UIImage
    /// The upright photo's size in pixels.
    private let pixels: CGSize
    private let external: Binding<Framing>?
    private let aspects: [Aspect]
    private let maxOutputDimension: CGFloat
    private let messages: Messages
    private let style: Style
    private let onCancel: (() -> Void)?
    private let onCrop: @MainActor (Crop) async -> Void

    public init(image: UIImage, aspect: Aspect = .square, aspects: [Aspect] = Aspect.standard, maxOutputDimension: CGFloat = 4096, messages: Messages = .standard, style: Style = .standard, onCancel: (() -> Void)? = nil, onCrop: @escaping @MainActor (Crop) async -> Void) {
        self.init(image: image, external: nil, initial: Framing(aspect: aspect), aspects: aspects, maxOutputDimension: maxOutputDimension, messages: messages, style: style, onCancel: onCancel, onCrop: onCrop)
    }

    public init(image: UIImage, framing: Binding<Framing>, aspects: [Aspect] = Aspect.standard, maxOutputDimension: CGFloat = 4096, messages: Messages = .standard, style: Style = .standard, onCancel: (() -> Void)? = nil, onCrop: @escaping @MainActor (Crop) async -> Void) {
        self.init(image: image, external: framing, initial: framing.wrappedValue, aspects: aspects, maxOutputDimension: maxOutputDimension, messages: messages, style: style, onCancel: onCancel, onCrop: onCrop)
    }

    private init(image: UIImage, external: Binding<Framing>?, initial: Framing, aspects: [Aspect], maxOutputDimension: CGFloat, messages: Messages, style: Style, onCancel: (() -> Void)?, onCrop: @escaping @MainActor (Crop) async -> Void) {
        self.image = image
        self.pixels = CGSize(width: (image.size.width * image.scale).rounded(), height: (image.size.height * image.scale).rounded())
        self.external = external
        self.aspects = aspects
        self.maxOutputDimension = max(maxOutputDimension, 1)
        self.messages = messages
        self.style = style
        self.onCancel = onCancel
        self.onCrop = onCrop
        _ownFraming = State(initialValue: initial)
        _shownTurns = State(initialValue: initial.quarterTurns & 3)
        _rest = State(initialValue: Framing(aspect: initial.aspect))
    }

    private var framing: Framing {
        get { external?.wrappedValue ?? ownFraming }
        nonmutating set {
            if let external { external.wrappedValue = newValue } else { ownFraming = newValue }
        }
    }

    private var interactive: Bool { isEnabled && phase == .editing && display != nil && !failed }
    private var settleMotion: Animation { reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0) }
    private var morphMotion: Animation { reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.46, bounce: 0) }
    private var turnMotion: Animation? { reduceMotion ? nil : .spring(duration: 0.5, bounce: 0) }

    /// The chips shown: `aspects` without repeats, with the current aspect added at the front when it's missing.
    private var chips: [Aspect] {
        var list: [Aspect] = []
        for aspect in aspects where !list.contains(aspect) { list.append(aspect) }
        if !list.isEmpty, !list.contains(framing.aspect) { list.insert(framing.aspect, at: 0) }
        return list.count > 1 ? list : []
    }

    // MARK: Body

    public var body: some View {
        VStack(spacing: 0) {
            canvas
                .padding(.horizontal, style.cornerRadius > 0 ? 8 : 0)
                .padding(.top, style.cornerRadius > 0 ? 8 : 0)
            toolbar
        }
        .background(style.background)
        .opacity(isEnabled ? 1 : 0.45)
        // The on-screen copy is cut for about twice the canvas, so it stays sharp while zoomed. A much larger canvas
        // (rotation, a resized window) cuts it again; the current copy stays up meanwhile.
        .task(id: DisplayRequest(image: ObjectIdentifier(image), longSide: displayLongSide)) { await prepare(longSide: displayLongSide) }
        .onChange(of: ObjectIdentifier(image)) { _, _ in photoChanged() }
        .onChange(of: framing.quarterTurns) { _, new in followTurns(to: new) }
        .onDisappear {
            // A render is dropped when the cropper goes away; your `onCrop` is never cut off once it has the crop.
            if phase == .rendering, !delivering { renderTask?.cancel() }
            gridTask?.cancel()
        }
        .sensoryFeedback(.selection, trigger: aspectTick)
        .sensoryFeedback(.impact(weight: .light), trigger: rotateTick)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: limitTick)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: resetTick)
        .sensoryFeedback(.success, trigger: successTick)
        .sensoryFeedback(.error, trigger: errorTick)
    }

    // MARK: Canvas

    private var canvas: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let layout = layout(for: framing, turns: shownTurns, in: size)
            let shown = live == nil ? clamped(framing, in: layout) : framing
            ZStack(alignment: .topLeading) {
                if let display, !failed {
                    photo(display, shown: shown, layout: layout, dimmed: true)
                    photo(display, shown: shown, layout: layout, dimmed: false)
                        .mask { CropFrameShape(size: layout.frame.size, radius: layout.radius) }
                } else {
                    // A quiet placeholder while the on-screen copy is cut: the frame, faintly filled.
                    CropFrameShape(size: layout.frame.size, radius: layout.radius)
                        .fill(style.edge.opacity(0.07))
                }
                frameMarks(layout)
                if failed {
                    failure(in: layout)
                } else if display == nil {
                    CropPreparing(tint: style.edge.opacity(0.7))
                        .position(x: layout.frame.midX, y: layout.frame.midY)
                }
                readout(shown, in: layout)
                noticeView(in: layout)
                CropGestureLayer(isEnabled: interactive) { event in handle(event, in: layout) }
                    .frame(width: size.width, height: size.height)
            }
            .frame(width: size.width, height: size.height)
        }
        .frame(minHeight: 220, idealHeight: 420, maxHeight: .infinity)
        .background(style.canvas)
        .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
        // The photo is never mirrored: right to left mirrors the toolbar only.
        .environment(\.layoutDirection, .leftToRight)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { canvasSize = $0 }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(messages.cropArea)
        .accessibilityValue(accessibilityValue)
        .accessibilityAddTraits(.isImage)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: zoomStep(in: true)
            case .decrement: zoomStep(in: false)
            @unknown default: break
            }
        }
        .accessibilityActions {
            if interactive {
                Button(String(localized: "Move up", comment: "Photo cropper VoiceOver action that shows more of the top of the photo")) { nudge(x: 0, y: -1, announcing: true) }
                Button(String(localized: "Move down", comment: "Photo cropper VoiceOver action that shows more of the bottom of the photo")) { nudge(x: 0, y: 1, announcing: true) }
                Button(String(localized: "Move left", comment: "Photo cropper VoiceOver action that shows more of the left of the photo")) { nudge(x: -1, y: 0, announcing: true) }
                Button(String(localized: "Move right", comment: "Photo cropper VoiceOver action that shows more of the right of the photo")) { nudge(x: 1, y: 0, announcing: true) }
                Button(messages.rotate) { rotate() }
                if canReset { Button(messages.reset) { reset() } }
            }
        }
        // A hardware keyboard: arrows move, + and - zoom. Return and Escape are Choose and Cancel.
        .focusable(interactive)
        .onKeyPress(.upArrow) { keyNudge(x: 0, y: -1) }
        .onKeyPress(.downArrow) { keyNudge(x: 0, y: 1) }
        .onKeyPress(.leftArrow) { keyNudge(x: -1, y: 0) }
        .onKeyPress(.rightArrow) { keyNudge(x: 1, y: 0) }
        .onKeyPress(characters: CharacterSet(charactersIn: "+=-_")) { press in
            guard interactive else { return .ignored }
            zoomStep(in: press.characters == "+" || press.characters == "=")
            return .handled
        }
    }

    /// The photo, placed by one animatable transform. Drawn twice: dimmed under the scrim, and bright inside the frame.
    private func photo(_ display: UIImage, shown: Framing, layout: CropLayout, dimmed: Bool) -> some View {
        let base = layout.baseSize
        return Image(uiImage: display)
            .resizable()
            .interpolation(.high)
            .overlay {
                if dimmed {
                    // Reduce Transparency lays the scrim twice, so the photo outside the frame recedes further.
                    ZStack {
                        style.scrim
                        if reduceTransparency { style.scrim }
                    }
                }
            }
            .frame(width: base.width, height: base.height)
            .modifier(CropPhotoEffect(
                scale: shown.zoom * layout.cover,
                angle: CGFloat(shownTurns) * 90,
                center: shown.center,
                frame: layout.frame.size,
                pixels: layout.pixels,
                mid: CGPoint(x: layout.frame.midX, y: layout.frame.midY)
            ))
            .frame(width: layout.canvas.width, height: layout.canvas.height, alignment: .topLeading)
            .allowsHitTesting(false)
            .transition(.opacity)
    }

    /// The frame's edge, corner marks and the thirds grid. The edge and marks flash red at a zoom limit.
    private func frameMarks(_ layout: CropLayout) -> some View {
        let edge = flashing ? style.accent : style.edge
        return ZStack {
            CropGridLines(size: layout.frame.size)
                .stroke(style.edge.opacity(0.6), lineWidth: 0.75)
                .mask { CropFrameShape(size: layout.frame.size, radius: layout.radius) }
                .opacity(showsGrid ? 1 : 0)
            CropFrameShape(size: layout.frame.size, radius: layout.radius)
                .stroke(edge, lineWidth: 1)
            CropCornerMarks(size: layout.frame.size)
                .stroke(edge, style: StrokeStyle(lineWidth: 3, lineCap: .butt, lineJoin: .miter))
                .opacity(layout.radius > 0 ? 0 : 1)
        }
        .frame(width: layout.canvas.width, height: layout.canvas.height)
        .allowsHitTesting(false)
    }

    /// The zoom level while pinching, just above the frame (or inside its top edge when there's no room).
    private func readout(_ shown: Framing, in layout: CropLayout) -> some View {
        let y = layout.frame.minY >= 42 ? layout.frame.minY - 21 : layout.frame.minY + 21
        return Text(zoomText(shown.zoom))
            .font(.footnote.weight(.semibold).monospacedDigit())
            .foregroundStyle(style.edge)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(red: 0.078, green: 0.078, blue: 0.078).opacity(0.72), in: .capsule)
            .fixedSize()
            .position(x: layout.frame.midX, y: y)
            .opacity(showsReadout ? 1 : 0)
            .allowsHitTesting(false)
    }

    @ViewBuilder
    private func noticeView(in layout: CropLayout) -> some View {
        if let notice {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(style.accentInk)
                    .frame(width: 22, height: 22)
                    .background(style.accent, in: .circle)
                Text(notice)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(style.edge)
                    .lineLimit(3)
            }
            .padding(.leading, 6)
            .padding(.trailing, 12)
            .padding(.vertical, 6)
            .background(Color(red: 0.078, green: 0.078, blue: 0.078).opacity(0.86), in: .capsule)
            .frame(maxWidth: max(layout.canvas.width - 32, 120))
            .fixedSize(horizontal: false, vertical: true)
            .position(x: layout.canvas.width / 2, y: max(layout.canvas.height - 34, 34))
            .transition(.opacity)
            .allowsHitTesting(false)
        }
    }

    /// A photo that can't be shown: a red disc and one line in the frame.
    private func failure(in layout: CropLayout) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark")
                .font(.body.weight(.heavy))
                .foregroundStyle(style.accentInk)
                .frame(width: 36, height: 36)
                .background(style.accent, in: .circle)
            Text(messages.failed)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.edge)
                .multilineTextAlignment(.center)
        }
        .padding(16)
        .frame(width: layout.frame.width, height: layout.frame.height)
        .position(x: layout.frame.midX, y: layout.frame.midY)
    }

    // MARK: Toolbar

    /// Always its full height: the photo's well takes whatever is left.
    private var toolbar: some View {
        VStack(spacing: 6) {
            if !chips.isEmpty { chipRow }
            actionRow
        }
        .padding(.top, 6)
        .padding(.bottom, 8)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Centred when the chips fit, a scrolling row when they don't. Chips stop growing at the second accessibility
    /// size, so the photo keeps its room.
    private var chipRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 4) { chipViews }
                .padding(.horizontal, 16)
            ScrollView(.horizontal) {
                HStack(spacing: 4) { chipViews }
            }
            .contentMargins(.horizontal, 16, for: .scrollContent)
            .scrollIndicators(.hidden)
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .opacity(failed ? 0.4 : 1)
    }

    private var chipViews: some View {
        ForEach(chips) { aspect in
            chip(aspect)
        }
    }

    /// An aspect chip: a small picture of the frame over its name. Selected, the picture turns solid red on a raised block.
    private func chip(_ aspect: Aspect) -> some View {
        let selected = aspect == framing.aspect
        return Button { select(aspect) } label: {
            VStack(spacing: 4) {
                CropAspectGlyph(ratio: glyphRatio(aspect), isCircle: aspect.isCircle, filled: selected, color: selected && !failed ? style.accent : style.secondaryLabel, side: glyphSide)
                Text(title(for: aspect))
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(selected ? style.label : style.secondaryLabel)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .frame(minWidth: 58, minHeight: 44)
            .background {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(style.selectedControl)
                    .opacity(selected ? 1 : 0)
            }
            .contentShape(.rect(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(CropPressStyle(reduceMotion: reduceMotion))
        .disabled(!interactive)
        .animation(.smooth(duration: 0.2), value: selected)
        .accessibilityLabel(accessibilityTitle(for: aspect))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// One row at most sizes; at large text sizes Choose takes its own full-width row, and at the largest Cancel does too.
    private var actionRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 4) {
                if onCancel != nil {
                    cancelButton
                    Spacer(minLength: 8)
                }
                rotateButton
                resetButton
                Spacer(minLength: 8)
                chooseButton(fullWidth: false)
            }
            VStack(spacing: 8) {
                HStack(spacing: 4) {
                    rotateButton
                    resetButton
                    Spacer(minLength: 8)
                    if onCancel != nil { cancelButton }
                }
                chooseButton(fullWidth: true)
            }
            VStack(spacing: 4) {
                HStack(spacing: 4) {
                    rotateButton
                    resetButton
                    Spacer(minLength: 0)
                }
                chooseButton(fullWidth: true)
                if onCancel != nil {
                    cancelButton
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal, 12)
    }

    private var cancelButton: some View {
        Button(action: cancel) {
            Text(messages.cancel)
                .font(.body)
                .foregroundStyle(style.label)
                .padding(.horizontal, 8)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(CropPressStyle(reduceMotion: reduceMotion, dims: true))
        .keyboardShortcut(.cancelAction)
    }

    private var rotateButton: some View {
        Button(action: rotate) {
            Image(systemName: "rotate.left")
                .font(.body.weight(.semibold))
                .foregroundStyle(style.label)
                .frame(width: buttonSide, height: buttonSide)
                .background(style.control, in: .circle)
                .contentShape(.circle)
        }
        .buttonStyle(CropPressStyle(reduceMotion: reduceMotion))
        .disabled(!interactive)
        .opacity(failed ? 0.4 : 1)
        .keyboardShortcut("r", modifiers: .command)
        .accessibilityLabel(messages.rotate)
    }

    private var resetButton: some View {
        let enabled = interactive && canReset
        return Button(action: reset) {
            Text(messages.reset)
                .font(.body)
                .foregroundStyle(enabled ? style.label : style.secondaryLabel.opacity(0.55))
                .padding(.horizontal, 10)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(CropPressStyle(reduceMotion: reduceMotion, dims: true))
        .disabled(!enabled)
        .animation(.smooth(duration: 0.2), value: enabled)
    }

    private func chooseButton(fullWidth: Bool) -> some View {
        // A photo that can't be opened can't be chosen: the capsule turns neutral rather than a washed-out red.
        let available = !failed
        return Button(action: choose) {
            ZStack {
                Text(messages.choose)
                    .lineLimit(1)
                    .opacity(phase == .editing ? 1 : 0)
                if phase == .rendering {
                    ProgressView()
                        .tint(style.accentInk)
                        .transition(.opacity)
                } else if phase == .done {
                    Image(systemName: "checkmark")
                        .fontWeight(.bold)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
                }
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(available ? style.accentInk : style.secondaryLabel)
            .padding(.horizontal, 22)
            .padding(.vertical, 10)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 44)
            .background(available ? style.accent : style.control, in: .capsule)
            .contentShape(.capsule)
        }
        .buttonStyle(CropPressStyle(reduceMotion: reduceMotion))
        // Not `.disabled` while busy, which would dim the spinner; `choose()` ignores taps then.
        .allowsHitTesting(phase == .editing)
        .disabled(display == nil || failed)
        .keyboardShortcut(.defaultAction)
        .accessibilityValue(phase == .rendering ? Text("Cropping", comment: "Photo cropper Choose button while the crop renders") : Text(verbatim: ""))
    }

    // MARK: Geometry

    /// The frame, scale and limits for a framing in a canvas, with `turns` quarter turns shown.
    private func layout(for framing: Framing, turns: Int, in size: CGSize) -> CropLayout {
        let canvas = CGSize(width: max(size.width, 1), height: max(size.height, 1))
        // A photo with no pixels still gets a frame, for the failed state.
        let pixels = self.pixels.width >= 1 && self.pixels.height >= 1 ? self.pixels : CGSize(width: 1, height: 1)
        let quarter = turns & 3
        let rotated = quarter % 2 == 0 ? pixels : CGSize(width: pixels.height, height: pixels.width)
        let ratio = framing.aspect.ratio ?? rotated.width / rotated.height
        let inset = min(style.frameInset, canvas.width / 4, canvas.height / 4)
        let room = CGSize(width: max(canvas.width - inset * 2, 1), height: max(canvas.height - inset * 2, 1))
        var width = room.width
        var height = width / ratio
        if height > room.height {
            height = room.height
            width = height * ratio
        }
        let frame = CGRect(x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width: width, height: height)
        let cover = max(width / rotated.width, height / rotated.height)
        // The crop's short side at zoom 1, in pixels. Zoom stops before a crop would drop below 32 pixels.
        let shortSide = min(width, height) / cover
        let maxZoom = min(5, max(1, shortSide / 32))
        let fit = min(canvas.width / pixels.width, canvas.height / pixels.height)
        return CropLayout(
            canvas: canvas,
            frame: frame,
            radius: framing.aspect.isCircle ? min(width, height) / 2 : 0,
            pixels: pixels,
            turns: quarter,
            rotated: rotated,
            cover: cover,
            maxZoom: maxZoom,
            baseSize: CGSize(width: max(pixels.width * fit, 1), height: max(pixels.height * fit, 1))
        )
    }

    /// Keeps a framing inside its limits: zoom between 1 and the maximum, and the photo covering the frame.
    private func clamped(_ framing: Framing, in layout: CropLayout) -> Framing {
        var result = framing
        let zoom = framing.zoom.isFinite ? framing.zoom : 1
        result.zoom = min(max(zoom, 1), layout.maxZoom)
        let center = CGPoint(x: framing.center.x.isFinite ? framing.center.x : 0.5, y: framing.center.y.isFinite ? framing.center.y : 0.5)
        var r = CropMath.rotate(center, turns: layout.turns)
        let half = layout.half(result.zoom)
        r.x = half.width >= 0.5 ? 0.5 : min(max(r.x, half.width), 1 - half.width)
        r.y = half.height >= 0.5 ? 0.5 : min(max(r.y, half.height), 1 - half.height)
        result.center = CropMath.unrotate(r, turns: layout.turns)
        result.quarterTurns = framing.quarterTurns & 3
        return result
    }

    /// The layout for a framing as it will rest, in the current canvas.
    private func restingLayout(for framing: Framing) -> CropLayout {
        layout(for: framing, turns: framing.quarterTurns, in: canvasSize)
    }

    private var displayLongSide: CGFloat {
        let side = max(canvasSize.width, canvasSize.height) * max(displayScale, 1) * 2
        guard side > 0 else { return 0 }
        return (side / 512).rounded(.up) * 512
    }

    // MARK: Gestures

    /// A pinch or pan in progress: the framing as the fingers set it, before the rubber band.
    private struct LiveGesture {
        var zoom: CGFloat
        /// The frame centre in unit coordinates of the rotated photo.
        var center: CGPoint
        /// The last pinch centre, in canvas points. Zoom settles about it.
        var anchor: CGPoint
        var pastLimit = false
    }

    private func handle(_ event: CropTouchEvent, in layout: CropLayout) {
        switch event {
        case .touchDown:
            touchBegan()
        case .touchUp:
            touchEnded()
        case .began:
            let start = clamped(framing, in: layout)
            live = LiveGesture(zoom: start.zoom, center: CropMath.rotate(start.center, turns: layout.turns), anchor: CGPoint(x: layout.frame.midX, y: layout.frame.midY))
            flashTask?.cancel()
            flashing = false
        case .pan(let delta):
            guard var gesture = live else { return }
            let unit = layout.perUnit(rubberZoom(gesture.zoom, layout))
            gesture.center.x -= delta.x / unit.width
            gesture.center.y -= delta.y / unit.height
            live = gesture
            show(gesture, in: layout)
        case .pinch(let factor, let location):
            guard var gesture = live, factor.isFinite, factor > 0 else { return }
            let before = layout.perUnit(rubberZoom(gesture.zoom, layout))
            gesture.zoom = min(max(gesture.zoom * factor, 0.2), layout.maxZoom * 4)
            let after = layout.perUnit(rubberZoom(gesture.zoom, layout))
            // The photo point under the fingers stays under them.
            let dx = location.x - layout.frame.midX
            let dy = location.y - layout.frame.midY
            gesture.center.x += dx / before.width - dx / after.width
            gesture.center.y += dy / before.height - dy / after.height
            gesture.anchor = location
            let past = gesture.zoom < 0.999 || gesture.zoom > layout.maxZoom + 0.001
            if past, !gesture.pastLimit { flashLimit() }
            gesture.pastLimit = past
            live = gesture
            showReadout()
            show(gesture, in: layout)
        case .ended(let velocity):
            guard let gesture = live else { return }
            settle(gesture, velocity: velocity, in: layout)
        case .doubleTap(let location):
            doubleTap(at: location, in: layout)
        }
    }

    /// Writes the gesture's framing with the rubber band applied: past a limit the photo follows less and less.
    private func show(_ gesture: LiveGesture, in layout: CropLayout) {
        let zoom = rubberZoom(gesture.zoom, layout)
        let r = rubberCenter(gesture.center, zoom: zoom, in: layout)
        var next = framing
        next.zoom = zoom
        next.center = CropMath.unrotate(r, turns: layout.turns)
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { framing = next }
    }

    /// Springs back inside the limits: zoom about the last pinch centre, then a short coast from the release speed.
    private func settle(_ gesture: LiveGesture, velocity: CGPoint, in layout: CropLayout) {
        let shownZoom = rubberZoom(gesture.zoom, layout)
        let zoom = min(max(shownZoom, 1), layout.maxZoom)
        var r = rubberCenter(gesture.center, zoom: shownZoom, in: layout)
        let from = layout.perUnit(shownZoom), to = layout.perUnit(zoom)
        let dx = gesture.anchor.x - layout.frame.midX, dy = gesture.anchor.y - layout.frame.midY
        r.x += dx / from.width - dx / to.width
        r.y += dy / from.height - dy / to.height
        r.x -= velocity.x * 0.1 / to.width
        r.y -= velocity.y * 0.1 / to.height
        var next = framing
        next.zoom = zoom
        next.center = CropMath.unrotate(r, turns: layout.turns)
        next = clamped(next, in: layout)
        let travel = hypot((next.center.x - framing.center.x) * to.width, (next.center.y - framing.center.y) * to.height)
        let motion: Animation = reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: min(0.55, 0.32 + Double(travel) / 1600), bounce: 0)
        // Both in one animated transaction, so the photo springs back from where the rubber band left it.
        withAnimation(motion) {
            live = nil
            framing = next
        }
    }

    /// Double tap: fill the frame again, or zoom to 2.5x about the tapped point.
    private func doubleTap(at location: CGPoint, in layout: CropLayout) {
        guard interactive, live == nil else { return }
        let current = clamped(framing, in: layout)
        let target = current.zoom > 1.05 ? 1 : min(2.5, layout.maxZoom)
        guard abs(target - current.zoom) > 0.001 else {
            flashLimit()
            return
        }
        var r = CropMath.rotate(current.center, turns: layout.turns)
        let from = layout.perUnit(current.zoom), to = layout.perUnit(target)
        let dx = location.x - layout.frame.midX, dy = location.y - layout.frame.midY
        r.x += dx / from.width - dx / to.width
        r.y += dy / from.height - dy / to.height
        var next = current
        next.zoom = target
        next.center = CropMath.unrotate(r, turns: layout.turns)
        withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.42, bounce: 0)) { framing = clamped(next, in: layout) }
        showReadout()
    }

    private func rubberZoom(_ zoom: CGFloat, _ layout: CropLayout) -> CGFloat {
        if zoom > layout.maxZoom { return layout.maxZoom * pow(zoom / layout.maxZoom, 0.3) }
        if zoom < 1 { return pow(max(zoom, 0.01), 0.3) }
        return zoom
    }

    /// The centre as shown: inside the limits it follows exactly, past them it resists like a scroll view's edge.
    private func rubberCenter(_ center: CGPoint, zoom: CGFloat, in layout: CropLayout) -> CGPoint {
        let half = layout.half(zoom)
        func axis(_ value: CGFloat, _ half: CGFloat) -> CGFloat {
            let low = half >= 0.5 ? 0.5 : half
            let high = half >= 0.5 ? 0.5 : 1 - half
            let span = max(half * 2, 0.0001)
            if value < low { return low - CropMath.rubber(low - value, span: span) }
            if value > high { return high + CropMath.rubber(value - high, span: span) }
            return value
        }
        return CGPoint(x: axis(center.x, half.width), y: axis(center.y, half.height))
    }

    private func touchBegan() {
        gridTask?.cancel()
        gridTask = nil
        setGrid(true)
    }

    private func touchEnded() {
        gridTask?.cancel()
        gridTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            setGrid(false)
        }
    }

    private func setGrid(_ visible: Bool) {
        guard showsGrid != visible || (!visible && showsReadout) else { return }
        if reduceMotion {
            showsGrid = visible
            if !visible { showsReadout = false }
        } else {
            withAnimation(.easeOut(duration: visible ? 0.15 : 0.3)) {
                showsGrid = visible
                if !visible { showsReadout = false }
            }
        }
    }

    private func showReadout() {
        guard !showsReadout else { return }
        if reduceMotion { showsReadout = true } else { withAnimation(.easeOut(duration: 0.15)) { showsReadout = true } }
    }

    /// A zoom limit: the frame flashes red for an instant, with a rigid tick.
    private func flashLimit() {
        limitTick += 1
        flashTask?.cancel()
        flashing = true
        flashTask = Task {
            try? await Task.sleep(for: .milliseconds(140))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.4)) { flashing = false }
        }
    }

    // MARK: Actions

    private func select(_ aspect: Aspect) {
        guard interactive, aspect != framing.aspect else { return }
        var next = framing
        next.aspect = aspect
        next = clamped(next, in: restingLayout(for: next))
        withAnimation(morphMotion) { framing = next }
        aspectTick += 1
    }

    private func rotate() {
        guard interactive else { return }
        var next = framing
        next.quarterTurns = (framing.quarterTurns + 1) & 3
        next = clamped(next, in: restingLayout(for: next))
        withAnimation(turnMotion) {
            shownTurns += 1
            framing = next
        }
        rotateTick += 1
        announce(turnsDescription(next.quarterTurns) ?? String(localized: "Upright", comment: "Photo cropper announcement after rotating back to the original orientation"))
    }

    private var canReset: Bool {
        let now = clamped(framing, in: restingLayout(for: framing))
        let start = clamped(rest, in: restingLayout(for: rest))
        return now.aspect != start.aspect
            || now.quarterTurns != start.quarterTurns
            || abs(now.zoom - start.zoom) > 0.01
            || hypot(now.center.x - start.center.x, now.center.y - start.center.y) > 0.002
    }

    private func reset() {
        guard interactive, canReset else { return }
        let target = clamped(rest, in: restingLayout(for: rest))
        withAnimation(turnMotion ?? morphMotion) {
            shownTurns += CropMath.shortestTurn(from: shownTurns, to: target.quarterTurns)
            framing = target
        }
        resetTick += 1
        announce(String(localized: "Crop reset", comment: "Photo cropper announcement after Reset"))
    }

    private func cancel() {
        if phase == .rendering, !delivering {
            renderTask?.cancel()
            phase = .editing
        }
        onCancel?()
    }

    private func choose() {
        guard interactive, phase == .editing else { return }
        let layout = restingLayout(for: framing)
        let final = clamped(framing, in: layout)
        let rect = CropMath.cropRect(final, in: layout)
        let turns = final.quarterTurns
        let image = self.image
        let limit = maxOutputDimension
        let onCrop = self.onCrop
        phase = .rendering
        withAnimation(.smooth(duration: 0.2)) { notice = nil }
        renderTask = Task {
            let started = ContinuousClock.now
            let work = Task.detached(priority: .userInitiated) {
                CropRenderer.render(image, crop: rect, quarterTurns: turns, maxDimension: limit)
            }
            let rendered = await withTaskCancellationHandler { await work.value } onCancel: { work.cancel() }
            // Keep the spinner up for a beat, so a fast render still reads as work done.
            let minimum = started + .milliseconds(350)
            if ContinuousClock.now < minimum { try? await Task.sleep(until: minimum) }
            guard !Task.isCancelled else { return }
            guard let rendered else {
                phase = .editing
                errorTick += 1
                showNotice(messages.renderFailed)
                return
            }
            delivering = true
            await onCrop(Crop(image: rendered, rect: rect, quarterTurns: turns, framing: final))
            delivering = false
            successTick += 1
            announce(String(localized: "Photo cropped", comment: "Photo cropper announcement when the crop is done"))
            withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.35, bounce: 0.3)) { phase = .done }
            try? await Task.sleep(for: .seconds(0.9))
            withAnimation(.smooth(duration: 0.25)) { phase = .editing }
        }
    }

    private func showNotice(_ text: String) {
        withAnimation(.smooth(duration: 0.25)) { notice = text }
        announce(text)
        noticeTask?.cancel()
        noticeTask = Task {
            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            withAnimation(.smooth(duration: 0.3)) { notice = nil }
        }
    }

    /// VoiceOver and keyboard zoom: a step in or out about the frame's centre.
    private func zoomStep(in inward: Bool) {
        guard interactive else { return }
        let layout = restingLayout(for: framing)
        let current = clamped(framing, in: layout)
        let target = inward ? min(current.zoom * 1.25, layout.maxZoom) : max(current.zoom / 1.25, 1)
        guard abs(target - current.zoom) > 0.001 else {
            flashLimit()
            return
        }
        var next = current
        next.zoom = target
        withAnimation(settleMotion) { framing = clamped(next, in: layout) }
    }

    /// Moves the frame over the photo by a fifth of what it shows, as the photo appears on screen.
    @discardableResult
    private func nudge(x: CGFloat, y: CGFloat, announcing: Bool = false) -> Bool {
        guard interactive else { return false }
        let layout = restingLayout(for: framing)
        let current = clamped(framing, in: layout)
        let half = layout.half(current.zoom)
        var r = CropMath.rotate(current.center, turns: layout.turns)
        r.x += x * half.width * 0.4
        r.y += y * half.height * 0.4
        var next = current
        next.center = CropMath.unrotate(r, turns: layout.turns)
        next = clamped(next, in: layout)
        guard hypot(next.center.x - current.center.x, next.center.y - current.center.y) > 0.0005 else {
            limitTick += 1
            if announcing { announce(String(localized: "Edge of the photo", comment: "Photo cropper VoiceOver announcement when the frame can't move further")) }
            return false
        }
        withAnimation(settleMotion) { framing = next }
        return true
    }

    private func keyNudge(x: CGFloat, y: CGFloat) -> KeyPress.Result {
        guard interactive else { return .ignored }
        nudge(x: x, y: y)
        return .handled
    }

    /// Keeps the shown turns in step with a rotation set from outside, turning the short way.
    private func followTurns(to quarterTurns: Int) {
        let step = CropMath.shortestTurn(from: shownTurns, to: quarterTurns)
        guard step != 0 else { return }
        withAnimation(turnMotion) { shownTurns += step }
    }

    private func photoChanged() {
        renderTask?.cancel()
        phase = .editing
        delivering = false
        display = nil
        displaySource = nil
        failed = false
        live = nil
        if external == nil {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                ownFraming = Framing(aspect: ownFraming.aspect)
                shownTurns = 0
            }
        }
        rest = Framing(aspect: framing.aspect)
    }

    // MARK: Display copy

    private struct DisplayRequest: Equatable {
        let image: ObjectIdentifier
        let longSide: CGFloat
    }

    private func prepare(longSide: CGFloat) async {
        guard longSide > 0 else { return }
        let source = ObjectIdentifier(image)
        guard CropDisplay.isDrawable(image) else {
            display = nil
            failed = true
            announce(messages.failed)
            return
        }
        let image = self.image
        let work = Task.detached(priority: .userInitiated) { await CropDisplay.copy(of: image, longSide: longSide) }
        let copy = await withTaskCancellationHandler { await work.value } onCancel: { work.cancel() }
        guard !Task.isCancelled else { return }
        guard let copy else {
            if displaySource != source {
                display = nil
                failed = true
                announce(messages.failed)
            }
            return
        }
        failed = false
        if displaySource == source {
            display = copy
        } else {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) { display = copy }
            displaySource = source
        }
    }

    // MARK: Accessibility

    private var accessibilityValue: String {
        if failed { return messages.failed }
        if display == nil { return String(localized: "Preparing photo", comment: "Photo cropper VoiceOver value while the photo loads") }
        let shown = clamped(framing, in: restingLayout(for: framing))
        var parts = [zoomText(shown.zoom), title(for: shown.aspect)]
        if let turned = turnsDescription(shown.quarterTurns) { parts.append(turned) }
        return parts.joined(separator: ", ")
    }

    private func zoomText(_ zoom: CGFloat) -> String {
        let value = Double(zoom).formatted(.number.precision(.fractionLength(0...1)))
        return String(localized: "\(value)×", comment: "Photo cropper zoom level, such as 2.5×")
    }

    private func turnsDescription(_ quarterTurns: Int) -> String? {
        let turns = quarterTurns & 3
        guard turns != 0 else { return nil }
        let degrees = Measurement(value: Double(turns * 90), unit: UnitAngle.degrees).formatted(.measurement(width: .narrow))
        return String(localized: "Rotated left \(degrees)", comment: "Photo cropper VoiceOver description of the rotation, such as Rotated left 90°")
    }

    private func title(for aspect: Aspect) -> String {
        if let title = aspect.title { return title }
        switch aspect.kind {
        case .circle: return messages.circle
        case .original: return messages.original
        case .ratio(1, 1): return messages.square
        case .ratio(let width, let height): return String(localized: "\(width):\(height)", comment: "Photo cropper aspect chip, width to height, such as 4:5")
        }
    }

    private func accessibilityTitle(for aspect: Aspect) -> String {
        if aspect.title == nil, case .ratio(let width, let height) = aspect.kind, width != height {
            return String(localized: "\(width) to \(height)", comment: "VoiceOver name of an aspect ratio, such as 4 to 5")
        }
        return title(for: aspect)
    }

    /// The chip glyph's shape: the ratio, or the photo's own shape as it is turned.
    private func glyphRatio(_ aspect: Aspect) -> CGFloat {
        if let ratio = aspect.ratio { return ratio }
        guard pixels.width >= 1, pixels.height >= 1 else { return 4 / 3 }
        return framing.quarterTurns % 2 == 0 ? pixels.width / pixels.height : pixels.height / pixels.width
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Layout

/// One layout pass: the canvas, the frame in it, and how the photo maps onto it.
private struct CropLayout {
    var canvas: CGSize
    var frame: CGRect
    var radius: CGFloat
    /// The upright photo's size in pixels.
    var pixels: CGSize
    var turns: Int
    /// The photo's size in pixels as it is turned.
    var rotated: CGSize
    /// Points per pixel at zoom 1: the smallest scale at which the turned photo covers the frame.
    var cover: CGFloat
    var maxZoom: CGFloat
    /// The size the photo view is laid out at before its transform: fitted to the canvas, unturned.
    var baseSize: CGSize

    /// Points on screen per unit of the turned photo, at `zoom`.
    func perUnit(_ zoom: CGFloat) -> CGSize {
        CGSize(width: max(zoom * cover * rotated.width, 0.0001), height: max(zoom * cover * rotated.height, 0.0001))
    }

    /// Half the frame, in unit coordinates of the turned photo, at `zoom`.
    func half(_ zoom: CGFloat) -> CGSize {
        let unit = perUnit(zoom)
        return CGSize(width: frame.width / 2 / unit.width, height: frame.height / 2 / unit.height)
    }
}

nonisolated private enum CropMath {
    /// A unit point of the upright photo, in the photo turned `turns` quarter turns to the left.
    static func rotate(_ point: CGPoint, turns: Int) -> CGPoint {
        switch turns & 3 {
        case 1: CGPoint(x: point.y, y: 1 - point.x)
        case 2: CGPoint(x: 1 - point.x, y: 1 - point.y)
        case 3: CGPoint(x: 1 - point.y, y: point.x)
        default: point
        }
    }

    /// The inverse of `rotate`.
    static func unrotate(_ point: CGPoint, turns: Int) -> CGPoint {
        switch turns & 3 {
        case 1: CGPoint(x: 1 - point.y, y: point.x)
        case 2: CGPoint(x: 1 - point.x, y: 1 - point.y)
        case 3: CGPoint(x: point.y, y: 1 - point.x)
        default: point
        }
    }

    /// A rect in pixels of the photo turned `turns` quarter turns to the left, back in the upright photo of `upright` size.
    static func unrotate(_ rect: CGRect, turns: Int, upright: CGSize) -> CGRect {
        switch turns & 3 {
        case 1: CGRect(x: upright.width - rect.maxY, y: rect.minX, width: rect.height, height: rect.width)
        case 2: CGRect(x: upright.width - rect.maxX, y: upright.height - rect.maxY, width: rect.width, height: rect.height)
        case 3: CGRect(x: rect.minY, y: upright.height - rect.maxX, width: rect.height, height: rect.width)
        default: rect
        }
    }

    /// A rect in pixels of the upright photo, in the photo turned `turns` quarter turns to the left.
    static func rotate(_ rect: CGRect, turns: Int, upright: CGSize) -> CGRect {
        switch turns & 3 {
        case 1: CGRect(x: rect.minY, y: upright.width - rect.maxX, width: rect.height, height: rect.width)
        case 2: CGRect(x: upright.width - rect.maxX, y: upright.height - rect.maxY, width: rect.width, height: rect.height)
        case 3: CGRect(x: upright.height - rect.maxY, y: rect.minX, width: rect.height, height: rect.width)
        default: rect
        }
    }

    /// The step (-1, 1 or 2) from `shown` quarter turns to `target`, the short way round.
    static func shortestTurn(from shown: Int, to target: Int) -> Int {
        switch (target - shown) & 3 {
        case 1: 1
        case 2: 2
        case 3: -1
        default: 0
        }
    }

    /// A scroll view's edge resistance: `overshoot` past a limit shows as less and less, never more than `span`.
    static func rubber(_ overshoot: CGFloat, span: CGFloat) -> CGFloat {
        (1 - 1 / (overshoot * 0.55 / span + 1)) * span
    }

    /// The crop in whole pixels of the upright photo, for a framing inside its limits. Fixed ratios stay exact to the pixel.
    static func cropRect(_ framing: PhotoCropper.Framing, in layout: CropLayout) -> CGRect {
        let turned = layout.rotated
        let scale = framing.zoom * layout.cover
        let r = rotate(framing.center, turns: layout.turns)
        var width = min(max((layout.frame.width / scale).rounded(), 1), turned.width)
        var height: CGFloat
        if let ratio = framing.aspect.ratio {
            height = min(max((width / ratio).rounded(), 1), turned.height)
            if height >= turned.height { width = min(max((height * ratio).rounded(), 1), turned.width) }
        } else {
            height = min(max((layout.frame.height / scale).rounded(), 1), turned.height)
        }
        let x = min(max((r.x * turned.width - width / 2).rounded(), 0), turned.width - width)
        let y = min(max((r.y * turned.height - height / 2).rounded(), 0), turned.height - height)
        return unrotate(CGRect(x: x, y: y, width: width, height: height), turns: layout.turns, upright: layout.pixels)
    }
}

// MARK: - Drawing

/// Places the photo: the framing's photo point at the frame's centre, scaled, and turned about the centre. While a
/// turn is in flight the photo grows just enough that the frame's corners never leave it.
private struct CropPhotoEffect: GeometryEffect {
    /// Points per pixel.
    var scale: CGFloat
    /// Counterclockwise degrees.
    var angle: CGFloat
    var center: CGPoint
    var frame: CGSize
    let pixels: CGSize
    let mid: CGPoint

    var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>, AnimatablePair<AnimatablePair<CGFloat, CGFloat>, AnimatablePair<CGFloat, CGFloat>>> {
        get { AnimatablePair(AnimatablePair(scale, angle), AnimatablePair(AnimatablePair(center.x, center.y), AnimatablePair(frame.width, frame.height))) }
        set {
            scale = newValue.first.first
            angle = newValue.first.second
            center = CGPoint(x: newValue.second.first.first, y: newValue.second.first.second)
            frame = CGSize(width: newValue.second.second.first, height: newValue.second.second.second)
        }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        guard size.width > 0, size.height > 0, pixels.width > 0 else { return ProjectionTransform() }
        let resting = (angle / 90).rounded() * 90
        let boost = abs(angle - resting) < 0.01 ? 1 : min(max(coverage(at: angle) / coverage(at: resting), 1), 3)
        let factor = scale * pixels.width / size.width * boost
        let radians = -angle * .pi / 180
        let transform = CGAffineTransform(translationX: -center.x * size.width, y: -center.y * size.height)
            .concatenating(CGAffineTransform(scaleX: factor, y: factor))
            .concatenating(CGAffineTransform(rotationAngle: radians))
            .concatenating(CGAffineTransform(translationX: mid.x, y: mid.y))
        return ProjectionTransform(transform)
    }

    /// How much the photo must grow, turned `degrees` to the left, for the frame's corners to stay on it.
    private func coverage(at degrees: CGFloat) -> CGFloat {
        let width = pixels.width * scale, height = pixels.height * scale
        let left = center.x * width, right = (1 - center.x) * width
        let top = center.y * height, bottom = (1 - center.y) * height
        let radians = degrees * .pi / 180
        let c = cos(radians), s = sin(radians)
        var need: CGFloat = 1
        for (sx, sy) in [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)] {
            let wx = CGFloat(sx) * frame.width / 2, wy = CGFloat(sy) * frame.height / 2
            let vx = c * wx - s * wy, vy = s * wx + c * wy
            need = max(need, vx < 0 ? -vx / max(left, 0.001) : vx / max(right, 0.001))
            need = max(need, vy < 0 ? -vy / max(top, 0.001) : vy / max(bottom, 0.001))
        }
        return need
    }
}

/// The frame: a rect, or a circle when `radius` is half its side. Animates its size and corner together.
private struct CropFrameShape: Shape {
    var size: CGSize
    var radius: CGFloat

    var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>, CGFloat> {
        get { AnimatablePair(AnimatablePair(size.width, size.height), radius) }
        set {
            size = CGSize(width: newValue.first.first, height: newValue.first.second)
            radius = newValue.second
        }
    }

    func path(in rect: CGRect) -> Path {
        let frame = CGRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height)
        let corner = min(max(radius, 0), min(size.width, size.height) / 2)
        return corner < 0.5 ? Path(frame) : Path(roundedRect: frame, cornerRadius: corner, style: .circular)
    }
}

/// Short, heavy corner marks just outside the frame.
private struct CropCornerMarks: Shape {
    var size: CGSize

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(size.width, size.height) }
        set { size = CGSize(width: newValue.first, height: newValue.second) }
    }

    func path(in rect: CGRect) -> Path {
        let frame = CGRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height).insetBy(dx: -1.5, dy: -1.5)
        let length = min(20, frame.width / 3, frame.height / 3)
        var path = Path()
        for (corner, dx, dy) in [(CGPoint(x: frame.minX, y: frame.minY), 1.0, 1.0), (CGPoint(x: frame.maxX, y: frame.minY), -1.0, 1.0), (CGPoint(x: frame.maxX, y: frame.maxY), -1.0, -1.0), (CGPoint(x: frame.minX, y: frame.maxY), 1.0, -1.0)] {
            path.move(to: CGPoint(x: corner.x, y: corner.y + dy * length))
            path.addLine(to: corner)
            path.addLine(to: CGPoint(x: corner.x + dx * length, y: corner.y))
        }
        return path
    }
}

/// The rule-of-thirds grid inside the frame.
private struct CropGridLines: Shape {
    var size: CGSize

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(size.width, size.height) }
        set { size = CGSize(width: newValue.first, height: newValue.second) }
    }

    func path(in rect: CGRect) -> Path {
        let frame = CGRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height)
        var path = Path()
        for third in [1.0, 2.0] {
            let x = frame.minX + frame.width * third / 3
            let y = frame.minY + frame.height * third / 3
            path.move(to: CGPoint(x: x, y: frame.minY))
            path.addLine(to: CGPoint(x: x, y: frame.maxY))
            path.move(to: CGPoint(x: frame.minX, y: y))
            path.addLine(to: CGPoint(x: frame.maxX, y: y))
        }
        return path
    }
}

/// A chip's small picture of its frame: outlined, or solid red when selected.
private struct CropAspectGlyph: View {
    let ratio: CGFloat
    let isCircle: Bool
    let filled: Bool
    let color: Color
    let side: CGFloat

    var body: some View {
        let safe = ratio.isFinite && ratio > 0 ? ratio : 1
        let long = side * (abs(safe - 1) < 0.01 ? 0.86 : 1)
        let width = safe >= 1 ? long : long * max(safe, 0.3)
        let height = safe >= 1 ? long / min(safe, 3.3) : long
        Group {
            if isCircle {
                Circle().fill(filled ? color : .clear).strokeBorder(color, lineWidth: filled ? 0 : 1.6)
            } else {
                RoundedRectangle(cornerRadius: 2.5, style: .continuous).fill(filled ? color : .clear).strokeBorder(color, lineWidth: filled ? 0 : 1.6)
            }
        }
        .frame(width: isCircle ? long : width, height: isCircle ? long : height)
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

/// A small spinner, shown only when preparing takes more than a moment.
private struct CropPreparing: View {
    let tint: Color
    @State private var visible = false

    var body: some View {
        ProgressView()
            .tint(tint)
            .opacity(visible ? 1 : 0)
            .task {
                try? await Task.sleep(for: .milliseconds(400))
                withAnimation(.easeOut(duration: 0.2)) { visible = true }
            }
    }
}

/// A quick dip on press that springs back. Text buttons dim instead.
private struct CropPressStyle: ButtonStyle {
    let reduceMotion: Bool
    var dims = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion && !dims ? 0.94 : 1)
            .opacity(configuration.isPressed && (dims || reduceMotion) ? 0.55 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.3), value: configuration.isPressed)
    }
}

// MARK: - Touch

/// What the touch layer reports, in canvas points.
private enum CropTouchEvent {
    /// The first finger came down.
    case touchDown
    /// The last finger lifted.
    case touchUp
    /// A pan or pinch started.
    case began
    case pan(CGPoint)
    /// A pinch step: the scale since the last step, about the fingers' centre.
    case pinch(CGFloat, CGPoint)
    /// Every pan and pinch ended. The pan's release velocity, in points per second.
    case ended(CGPoint)
    case doubleTap(CGPoint)
}

/// UIKit's pan and pinch, recognized together. SwiftUI's gestures can't report the fingers' moving centre during a
/// pinch, or keep a sheet's drag to dismiss and an enclosing scroll view waiting while the photo is being moved.
private struct CropGestureLayer: UIViewRepresentable {
    let isEnabled: Bool
    let onEvent: (CropTouchEvent) -> Void

    func makeUIView(context: Context) -> CropTouchView { CropTouchView() }

    func updateUIView(_ view: CropTouchView, context: Context) {
        view.onEvent = onEvent
        view.setEnabled(isEnabled)
    }
}

private final class CropTouchView: UIView, UIGestureRecognizerDelegate {
    var onEvent: ((CropTouchEvent) -> Void)?

    private let pan = UIPanGestureRecognizer()
    private let pinch = UIPinchGestureRecognizer()
    private let doubleTap = UITapGestureRecognizer()
    private var down = Set<ObjectIdentifier>()
    private var active = 0
    private var lastTranslation: CGPoint = .zero
    private var lastScale: CGFloat = 1
    private var releaseVelocity: CGPoint = .zero

    init() {
        super.init(frame: .zero)
        backgroundColor = .clear
        isMultipleTouchEnabled = true
        isAccessibilityElement = false
        accessibilityElementsHidden = true
        pan.maximumNumberOfTouches = 2
        pan.addTarget(self, action: #selector(panned(_:)))
        pinch.addTarget(self, action: #selector(pinched(_:)))
        doubleTap.numberOfTapsRequired = 2
        doubleTap.addTarget(self, action: #selector(doubleTapped(_:)))
        for recognizer in [pan, pinch, doubleTap] as [UIGestureRecognizer] {
            recognizer.delegate = self
            recognizer.cancelsTouchesInView = false
            addGestureRecognizer(recognizer)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func setEnabled(_ enabled: Bool) {
        guard isUserInteractionEnabled != enabled else { return }
        isUserInteractionEnabled = enabled
        for recognizer in [pan, pinch, doubleTap] as [UIGestureRecognizer] { recognizer.isEnabled = enabled }
        if !enabled, !down.isEmpty {
            down.removeAll()
            onEvent?(.touchUp)
        }
    }

    // Touches drive the grid: on with the first finger, off after the last.
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        let wasIdle = down.isEmpty
        for touch in touches { down.insert(ObjectIdentifier(touch)) }
        if wasIdle { onEvent?(.touchDown) }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        lift(touches)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesCancelled(touches, with: event)
        lift(touches)
    }

    private func lift(_ touches: Set<UITouch>) {
        guard !down.isEmpty else { return }
        for touch in touches { down.remove(ObjectIdentifier(touch)) }
        if down.isEmpty { onEvent?(.touchUp) }
    }

    @objc private func panned(_ recognizer: UIPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            // Movement past the recognizer's slop is not applied, so the photo never jumps when it starts.
            lastTranslation = recognizer.translation(in: self)
            begin()
        case .changed:
            let translation = recognizer.translation(in: self)
            onEvent?(.pan(CGPoint(x: translation.x - lastTranslation.x, y: translation.y - lastTranslation.y)))
            lastTranslation = translation
        case .ended:
            releaseVelocity = recognizer.velocity(in: self)
            end()
        case .cancelled, .failed:
            releaseVelocity = .zero
            end()
        default:
            break
        }
    }

    @objc private func pinched(_ recognizer: UIPinchGestureRecognizer) {
        switch recognizer.state {
        case .began:
            lastScale = recognizer.scale
            begin()
        case .changed:
            guard recognizer.numberOfTouches >= 2, lastScale > 0 else { return }
            onEvent?(.pinch(recognizer.scale / lastScale, recognizer.location(in: self)))
            lastScale = recognizer.scale
        case .ended, .cancelled, .failed:
            end()
        default:
            break
        }
    }

    @objc private func doubleTapped(_ recognizer: UITapGestureRecognizer) {
        guard recognizer.state == .ended, active == 0 else { return }
        onEvent?(.doubleTap(recognizer.location(in: self)))
    }

    private func begin() {
        active += 1
        if active == 1 {
            releaseVelocity = .zero
            onEvent?(.began)
        }
    }

    private func end() {
        guard active > 0 else { return }
        active -= 1
        if active == 0 { onEvent?(.ended(releaseVelocity)) }
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        other.view === self
    }

    // Pans outside the photo (a scroll view, a sheet's drag to dismiss) wait for this one to fail, so a drag on the
    // photo moves the photo.
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
        (gestureRecognizer === pan || gestureRecognizer === pinch) && other.view !== self && other is UIPanGestureRecognizer
    }
}

// MARK: - Images

/// The on-screen copy: cut once, off the main actor, so a 48 MP photo never decodes on the main thread.
private enum CropDisplay {
    /// Whether the image has pixels to draw.
    nonisolated static func isDrawable(_ image: UIImage) -> Bool {
        image.size.width * image.scale >= 1 && image.size.height * image.scale >= 1 && (image.cgImage != nil || image.ciImage != nil)
    }

    /// A decoded copy at most `longSide` pixels long, or the photo itself decoded when it is not much larger.
    nonisolated static func copy(of image: UIImage, longSide: CGFloat) async -> UIImage? {
        let width = image.size.width * image.scale, height = image.size.height * image.scale
        guard width >= 1, height >= 1 else { return nil }
        let longest = max(width, height)
        if longest > longSide * 1.25 {
            let factor = longSide / longest
            let size = CGSize(width: max((width * factor).rounded(), 1), height: max((height * factor).rounded(), 1))
            if let thumbnail = await image.byPreparingThumbnail(ofSize: size) { return thumbnail }
            guard !Task.isCancelled else { return nil }
            return redraw(image, size: size)
        }
        if let prepared = await image.byPreparingForDisplay() { return prepared }
        return image
    }

    /// Draws the photo upright at `size` pixels; the fallback for images ImageIO can't thumbnail (a CIImage, say).
    nonisolated static func redraw(_ image: UIImage, size: CGSize) -> UIImage? {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.preferredRange = .standard
        let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return drawn.cgImage == nil ? nil : drawn
    }
}

/// Renders a crop from the original's pixels, in its color space, with its orientation applied.
private enum CropRenderer {
    nonisolated static func render(_ image: UIImage, crop: CGRect, quarterTurns: Int, maxDimension: CGFloat) -> UIImage? {
        guard !Task.isCancelled, crop.width >= 1, crop.height >= 1 else { return nil }
        var orientation = image.imageOrientation
        let source: CGImage
        if let cgImage = image.cgImage {
            source = cgImage
        } else {
            // A CIImage-backed photo is drawn upright once, then cropped like any other.
            let size = CGSize(width: (image.size.width * image.scale).rounded(), height: (image.size.height * image.scale).rounded())
            guard let drawn = CropDisplay.redraw(image, size: size)?.cgImage else { return nil }
            source = drawn
            orientation = .up
        }
        let rawWidth = CGFloat(source.width), rawHeight = CGFloat(source.height)
        let sideways = [.left, .leftMirrored, .right, .rightMirrored].contains(orientation)
        let upright = sideways ? CGSize(width: rawHeight, height: rawWidth) : CGSize(width: rawWidth, height: rawHeight)
        let turned = CropMath.rotate(crop, turns: quarterTurns, upright: upright)
        let longest = max(turned.width, turned.height)
        let factor = longest > maxDimension ? maxDimension / longest : 1
        let width = max(Int((turned.width * factor).rounded()), 1)
        let height = max(Int((turned.height * factor).rounded()), 1)

        // 8 bits per channel in the photo's own RGB space (Display P3 stays P3); anything else becomes sRGB.
        let own = source.colorSpace
        let space = own.flatMap { $0.model == .rgb && $0.supportsOutput ? $0 : nil } ?? CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        let opaque = [.none, .noneSkipFirst, .noneSkipLast].contains(source.alphaInfo)
        let info = opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
        guard !Task.isCancelled, let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: info) else { return nil }
        context.interpolationQuality = .high

        // Raw pixels (rows down) -> upright photo -> turned photo -> the crop -> output pixels (rows up, as Core Graphics draws).
        let transform = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: rawHeight)
            .concatenating(orientationTransform(orientation, width: rawWidth, height: rawHeight))
            .concatenating(turnTransform(quarterTurns, upright: upright))
            .concatenating(CGAffineTransform(translationX: -turned.minX, y: -turned.minY))
            .concatenating(CGAffineTransform(scaleX: CGFloat(width) / turned.width, y: CGFloat(height) / turned.height))
            .concatenating(CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: CGFloat(height)))
        context.concatenate(transform)
        context.draw(source, in: CGRect(x: 0, y: 0, width: rawWidth, height: rawHeight))
        guard !Task.isCancelled, let output = context.makeImage() else { return nil }
        return UIImage(cgImage: output, scale: 1, orientation: .up)
    }

    /// Raw pixel coordinates (rows down) to the upright photo, for each EXIF orientation.
    private nonisolated static func orientationTransform(_ orientation: UIImage.Orientation, width w: CGFloat, height h: CGFloat) -> CGAffineTransform {
        switch orientation {
        case .down: CGAffineTransform(a: -1, b: 0, c: 0, d: -1, tx: w, ty: h)
        case .right: CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: h, ty: 0)
        case .left: CGAffineTransform(a: 0, b: -1, c: 1, d: 0, tx: 0, ty: w)
        case .upMirrored: CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: w, ty: 0)
        case .downMirrored: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: h)
        case .leftMirrored: CGAffineTransform(a: 0, b: 1, c: 1, d: 0, tx: 0, ty: 0)
        case .rightMirrored: CGAffineTransform(a: 0, b: -1, c: -1, d: 0, tx: h, ty: w)
        default: .identity
        }
    }

    /// The upright photo to the photo turned `turns` quarter turns to the left.
    private nonisolated static func turnTransform(_ turns: Int, upright: CGSize) -> CGAffineTransform {
        switch turns & 3 {
        case 1: CGAffineTransform(a: 0, b: -1, c: 1, d: 0, tx: 0, ty: upright.width)
        case 2: CGAffineTransform(a: -1, b: 0, c: 0, d: -1, tx: upright.width, ty: upright.height)
        case 3: CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: upright.height, ty: 0)
        default: .identity
        }
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

/// The cropper alone, on a photo drawn in code.
private struct PhotoCropperExample: View {
    @State private var avatar: UIImage?

    var body: some View {
        PhotoCropper(image: PhotoCropperSample.photo, aspect: .square, onCancel: {}) { crop in
            avatar = crop.image
        }
    }
}

/// A 2400 by 1800 photo drawn in code, so the preview needs no assets: a sky, the sun, clouds, layered hills,
/// cypresses and a red tram under its wire.
private enum PhotoCropperSample {
    static let photo: UIImage = draw(scale: 1.5)

    static func draw(scale: CGFloat) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: CGSize(width: 1600 * scale, height: 1200 * scale), format: format).image { context in
            context.cgContext.scaleBy(x: scale, y: scale)
            func paint(_ hex: UInt32) -> UIColor {
                UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            }
            func fill(_ hex: UInt32, _ path: UIBezierPath) {
                paint(hex).setFill()
                path.fill()
            }
            func oval(_ x: CGFloat, _ y: CGFloat, _ rx: CGFloat, _ ry: CGFloat) -> UIBezierPath {
                UIBezierPath(ovalIn: CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2))
            }
            func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> UIBezierPath {
                UIBezierPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: r)
            }
            func land(_ start: CGPoint, _ curves: [(CGPoint, CGPoint, CGPoint)]) -> UIBezierPath {
                let path = UIBezierPath()
                path.move(to: start)
                for (c1, c2, end) in curves { path.addCurve(to: end, controlPoint1: c1, controlPoint2: c2) }
                path.addLine(to: CGPoint(x: 1600, y: 1200))
                path.addLine(to: CGPoint(x: 0, y: 1200))
                path.close()
                return path
            }
            let ink: UInt32 = 0x141414, paper: UInt32 = 0xF4F3EF
            fill(0x9CC2FF, UIBezierPath(rect: CGRect(x: 0, y: 0, width: 1600, height: 1200)))
            fill(0xFFD976, oval(1215, 285, 105, 105))
            for cloud in [box(262, 300, 268, 56, 28), oval(352, 300, 50, 50), oval(436, 286, 62, 62), box(930, 212, 176, 38, 19), oval(990, 212, 32, 32), oval(1046, 204, 40, 40)] {
                fill(paper, cloud)
            }
            fill(0xCDB8FF, land(CGPoint(x: 0, y: 690), [
                (CGPoint(x: 180, y: 560), CGPoint(x: 380, y: 560), CGPoint(x: 560, y: 650)),
                (CGPoint(x: 720, y: 730), CGPoint(x: 860, y: 560), CGPoint(x: 1060, y: 590)),
                (CGPoint(x: 1260, y: 620), CGPoint(x: 1380, y: 540), CGPoint(x: 1600, y: 600)),
            ]))
            fill(0xA9DCB7, land(CGPoint(x: 0, y: 840), [
                (CGPoint(x: 260, y: 720), CGPoint(x: 520, y: 760), CGPoint(x: 760, y: 820)),
                (CGPoint(x: 1000, y: 880), CGPoint(x: 1260, y: 760), CGPoint(x: 1600, y: 790)),
            ]))
            for tree in [oval(196, 770, 16, 48), oval(236, 784, 12, 36), oval(1372, 752, 15, 46), oval(1408, 766, 11, 32)] {
                fill(ink, tree)
            }
            fill(0xE9D5B3, land(CGPoint(x: 0, y: 980), [
                (CGPoint(x: 400, y: 900), CGPoint(x: 1000, y: 930), CGPoint(x: 1600, y: 960)),
            ]))
            fill(ink, UIBezierPath(rect: CGRect(x: 0, y: 1048, width: 1600, height: 7)))
            fill(ink, UIBezierPath(rect: CGRect(x: 0, y: 1070, width: 1600, height: 7)))
            let wire = UIBezierPath()
            wire.move(to: CGPoint(x: 0, y: 790))
            wire.addCurve(to: CGPoint(x: 1600, y: 786), controlPoint1: CGPoint(x: 540, y: 812), controlPoint2: CGPoint(x: 1060, y: 812))
            wire.lineWidth = 5
            paint(ink).setStroke()
            wire.stroke()
            let pantograph = UIBezierPath()
            pantograph.move(to: CGPoint(x: 748, y: 838))
            pantograph.addLine(to: CGPoint(x: 790, y: 806))
            pantograph.addLine(to: CGPoint(x: 832, y: 838))
            pantograph.lineWidth = 5
            pantograph.lineJoinStyle = .round
            pantograph.stroke()
            fill(0xFF0000, box(560, 858, 440, 170, 34))
            fill(paper, box(588, 838, 384, 30, 15))
            for x in [592, 680, 768, 856] as [CGFloat] { fill(ink, box(x, 888, 70, 58, 12)) }
            fill(ink, box(944, 888, 40, 58, 12))
            fill(paper, UIBezierPath(rect: CGRect(x: 560, y: 964, width: 440, height: 12)))
            fill(ink, oval(640, 1030, 24, 24))
            fill(ink, oval(920, 1030, 24, 24))
            fill(0xFFD976, oval(986, 996, 9, 9))
        }
    }
}

#Preview("Light") {
    PhotoCropperExample()
}

#Preview("Dark") {
    PhotoCropperExample()
        .preferredColorScheme(.dark)
}
