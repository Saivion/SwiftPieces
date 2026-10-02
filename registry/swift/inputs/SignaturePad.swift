// swiftpieces:
// title: Signature Pad
// description: A signature field that lays smooth, velocity-weighted ink into a Canvas as the finger moves, thinning on quick flicks and pooling on slow turns, over a baseline whose Sign here hint fades on the first stroke, with Undo, Clear and Undo after Clear, a Type instead mode that sets the typed name in a script face on the same line, strokes that rescale with the pad on rotation, and export to a transparent PNG or a vector PDF.
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// tags: [signature, ink, drawing, canvas, forms, export, pdf, accessibility]

import SwiftUI
import UIKit

/// Signature capture that feels like ink, bound to a `SignaturePad.Signature` value you own.
///
/// Strokes are smoothed through midpoint quadratics and weighted by speed (fast strokes run thin, slow
/// turns run full), drawn in a `Canvas` one layer per stroke so finished strokes never redraw while you
/// sign. Points are stored in the pad's coordinate space together with the pad size they were captured
/// at, so the signature rescales with the pad on rotation and exports at any size. A drag that starts in
/// the pad draws and never scrolls an enclosing `ScrollView`; a drag that starts outside still scrolls.
///
/// ```swift
/// @State private var signature = SignaturePad.Signature()
///
/// SignaturePad(signature: $signature)
/// Button("Confirm delivery") { upload(signature.pngData(size: CGSize(width: 600, height: 200))) }
///     .disabled(signature.isEmpty)
/// ```
///
/// - Parameters:
///   - signature: The bound signature. Drawn strokes, or a typed name when the person chose Type instead. `isEmpty` stays `true` until there is a typed name or enough ink to count (a stray dot or speck does not), so it is the right check for enabling a submit button. Setting it from outside redraws the pad; a stroke removed from outside inside `withAnimation` fades out.
///   - prompt: The hint under the baseline, shown until the first stroke. Defaults to "Sign here".
///   - allowsTyping: Offers Type instead, which sets the typed name in a script face on the same baseline. This is the accessible path for people who cannot draw a signature (VoiceOver, motor impairments), so turn it off only when your flow offers another way to sign.
///   - style: Colors, ink weight, corner radius and pad height. Defaults to the Swift Pieces house palette, adapting to light and dark.
public struct SignaturePad: View {
    /// A captured signature: drawn strokes, or a typed name. A plain value, `Codable` so a draft can be saved and restored.
    public struct Signature: Equatable, Sendable, Codable {
        /// One touch sample, in the pad's points at capture time.
        public struct Point: Equatable, Sendable, Codable {
            public var x: CGFloat
            public var y: CGFloat
            /// Seconds since the stroke began. The ink weight is derived from the speed between samples.
            public var time: TimeInterval

            public init(x: CGFloat, y: CGFloat, time: TimeInterval) {
                self.x = x
                self.y = y
                self.time = time
            }
        }

        /// One continuous touch, from finger down to finger up. A single point draws a dot.
        public struct Stroke: Equatable, Sendable, Codable, Identifiable {
            public var id: UUID
            public var points: [Point]

            public init(id: UUID = UUID(), points: [Point] = []) {
                self.id = id
                self.points = points
            }
        }

        /// Drawn strokes, oldest first. Kept while a typed name is shown, so switching back to drawing restores them.
        public var strokes: [Stroke]
        /// The pad size, in points, the strokes were captured at. Drawing and export scale uniformly from it. Set by the pad on the first stroke.
        public var canvasSize: CGSize
        /// The typed name when the person chose Type instead, otherwise `nil`. While it is non-nil it is the signature and `strokes` are ignored by `isEmpty` and export.
        public var typedName: String?

        public init(strokes: [Stroke] = [], canvasSize: CGSize = .zero, typedName: String? = nil) {
            self.strokes = strokes
            self.canvasSize = canvasSize
            self.typedName = typedName
        }

        /// Nothing drawn, nothing typed.
        public static let empty = Signature()

        /// The least ink, as a fraction of the pad width, that counts as a signature: `0.12` (about 40pt on a phone-width pad).
        public static let minimumInk: CGFloat = 0.12

        /// Total length of every stroke divided by the pad width. `1` is one pad width of ink. Dots add nothing.
        public var inkLength: CGFloat {
            var total: CGFloat = 0
            for stroke in strokes {
                for (a, b) in zip(stroke.points, stroke.points.dropFirst()) { total += hypot(b.x - a.x, b.y - a.y) }
            }
            return total / (canvasSize.width > 0 ? canvasSize.width : 320)
        }

        /// Whether the typed name, rather than the strokes, is the signature.
        public var isTyped: Bool { typedName != nil }

        /// `true` until there is something that counts as a signature: a non-blank typed name, or at least `minimumInk` of drawn ink. A stray tap or speck is still empty. Check `strokes.isEmpty` for "nothing on the pad at all".
        public var isEmpty: Bool {
            if let typedName { return typedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            return inkLength < Self.minimumInk
        }

        /// A transparent image of the signature, fitted and centred in `size` (points) at `scale` pixels per point.
        /// - Parameters:
        ///   - size: Output size in points. `CGSize(width: 600, height: 200)` at scale 2 is a 1200 by 400 pixel image.
        ///   - scale: Pixels per point.
        ///   - ink: Ink color. Use an opaque color; overlapping stroke segments would show through a translucent one.
        ///   - lineWidth: The slow-stroke ink width, in capture points. Pass the same value as `Style.lineWidth` if you changed it.
        ///   - trimmed: `true` crops to the ink with a small margin, so the signature fills the image. `false` keeps the whole pad area, with the signature where it sat.
        public func image(size: CGSize, scale: CGFloat = 2, ink: Color = .black, lineWidth: CGFloat = 3.6, trimmed: Bool = true) -> UIImage {
            let format = UIGraphicsImageRendererFormat()
            format.scale = max(scale, 0.1)
            format.opaque = false
            let color = UIColor(ink)
            return UIGraphicsImageRenderer(size: size, format: format).image { context in
                renderSignature(self, in: context.cgContext, size: size, ink: color, lineWidth: lineWidth, trimmed: trimmed)
            }
        }

        /// PNG data of `image(size:scale:ink:lineWidth:trimmed:)`, with a transparent background.
        public func pngData(size: CGSize, scale: CGFloat = 2, ink: Color = .black, lineWidth: CGFloat = 3.6, trimmed: Bool = true) -> Data? {
            image(size: size, scale: scale, ink: ink, lineWidth: lineWidth, trimmed: trimmed).pngData()
        }

        /// A one-page vector PDF of the signature, `size` points large, with a transparent page.
        public func pdfData(size: CGSize, ink: Color = .black, lineWidth: CGFloat = 3.6, trimmed: Bool = true) -> Data {
            let color = UIColor(ink)
            return UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { context in
                context.beginPage()
                renderSignature(self, in: context.cgContext, size: size, ink: color, lineWidth: lineWidth, trimmed: trimmed)
            }
        }

        /// The ink's bounding box in capture points, grown by the widest stroke. `nil` without strokes.
        fileprivate func inkBounds(lineWidth: CGFloat) -> CGRect? {
            var minX = CGFloat.infinity, minY = CGFloat.infinity, maxX = -CGFloat.infinity, maxY = -CGFloat.infinity
            for point in strokes.lazy.flatMap(\.points) {
                minX = min(minX, point.x); maxX = max(maxX, point.x)
                minY = min(minY, point.y); maxY = max(maxY, point.y)
            }
            guard minX.isFinite else { return nil }
            return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY).insetBy(dx: -lineWidth - 2, dy: -lineWidth - 2)
        }
    }

    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The pad surface.
        public var pad: Color
        /// On-screen ink and the typed name. Export takes its own `ink`, black by default.
        public var ink: Color
        /// The Type instead, Undo and Clear controls.
        public var label: Color
        /// The baseline, the hint and disabled controls.
        public var secondary: Color
        /// The sign-here cross: the one accent on the pad.
        public var mark: Color
        /// The Signed chip that appears once the signature counts.
        public var signed: Color
        /// The Undo and Clear pills.
        public var control: Color
        /// Ink width for slow strokes, in points. Fast strokes thin to about 40% of it.
        public var lineWidth: CGFloat
        /// Pad corner radius.
        public var cornerRadius: CGFloat
        /// Pad height. `nil` fills the height offered (a full-screen landscape signing sheet, for example).
        public var height: CGFloat?

        /// Pass only what you want to change; `nil` colors keep the house palette value.
        public init(pad: Color? = nil, ink: Color? = nil, label: Color? = nil, secondary: Color? = nil, mark: Color? = nil, signed: Color? = nil, control: Color? = nil, lineWidth: CGFloat = 3.6, cornerRadius: CGFloat = 26, height: CGFloat? = 200) {
            self.pad = pad ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondary = secondary ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.mark = mark ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.signed = signed ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.control = control ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.lineWidth = max(lineWidth, 0.5)
            self.cornerRadius = cornerRadius
            self.height = height
        }

        public static let standard = Style()
    }

    /// What Clear removed, so Undo can bring it back until anything else changes the signature.
    private struct Restore {
        var before: Signature
        var after: Signature
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.layoutDirection) private var layoutDirection
    /// The cross and baseline keep a fixed inset: strokes are stored against the pad, so guides that moved with text size would drift from them.
    private let guideInset: CGFloat = 22
    /// The baseline's fixed distance from the pad's bottom edge; the hint fits under it.
    private let baselineRoom: CGFloat = 46
    @FocusState private var nameFocused: Bool
    @GestureState private var touching = false
    @Binding private var signature: Signature
    @State private var live: Signature.Stroke?
    @State private var liveStart: Date?
    @State private var liveCanvas: CGSize = .zero
    @State private var restore: Restore?
    @State private var padSize: CGSize = .zero
    @State private var focusOnAppear = false
    @State private var strokeTick = 0
    @State private var undoTick = 0
    @State private var clearTick = 0
    /// The Signed chip: on once the signature counts and signing has paused, off while a stroke is drawn.
    @State private var showsSigned = false

    private let prompt: LocalizedStringKey
    private let allowsTyping: Bool
    private let style: Style

    public init(signature: Binding<Signature>, prompt: LocalizedStringKey = "Sign here", allowsTyping: Bool = true, style: Style = .standard) {
        self._signature = signature
        self.prompt = prompt
        self.allowsTyping = allowsTyping
        self.style = style
    }

    private var typing: Bool { allowsTyping && signature.typedName != nil }
    private var showsHint: Bool { !typing && signature.strokes.isEmpty && live == nil }
    private var canUndo: Bool { !signature.strokes.isEmpty || restore.map { $0.after == signature } == true }
    private var canClear: Bool { typing ? !(signature.typedName ?? "").isEmpty : !signature.strokes.isEmpty }
    private var motion: Animation { reduceMotion ? .easeInOut(duration: 0.2) : .smooth(duration: 0.3) }
    private var minPadHeight: CGFloat { baselineRoom + 104 }

    public var body: some View {
        VStack(spacing: 4) {
            pad
            controls
        }
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion, value: typing)
        .animation(motion, value: canUndo)
        .animation(motion, value: canClear)
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0.35), value: showsSigned)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.45), trigger: strokeTick)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.55), trigger: undoTick)
        .sensoryFeedback(.impact(weight: .medium, intensity: 0.7), trigger: clearTick)
        // Signed shows once the signing is done: the signature counts, no finger is down, and nothing has
        // changed for a moment (so it never pops in mid-stroke or between strokes, or on every typed key).
        .task(id: SignedKey(touching: touching, empty: signature.isEmpty, typed: signature.typedName)) {
            guard !touching, !signature.isEmpty else { showsSigned = false; return }
            try? await Task.sleep(for: .milliseconds(650))
            if !Task.isCancelled { showsSigned = true }
        }
        // One success tap as the chip appears, never on the way back down.
        .sensoryFeedback(trigger: showsSigned) { was, now in !was && now ? .success : nil }
        // Finger up, or the system cancelled the touch (a call, a sheet): either way the stroke is kept.
        .onChange(of: touching) { _, isTouching in if !isTouching { finishStroke() } }
        .onChange(of: signature) { _, new in
            if let restore, new != restore.after { self.restore = nil }
        }
    }

    // MARK: Pad

    private var pad: some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        return ZStack {
            guides
            if !typing {
                GeometryReader { proxy in inkArea(size: proxy.size) }
                    .transition(.opacity)
            }
        }
        .frame(minHeight: minPadHeight)
        .frame(height: style.height.map { max($0, minPadHeight) })
        .frame(maxHeight: style.height == nil ? .infinity : nil)
        .overlay(alignment: .topTrailing) { signedChip }
        .background(style.pad, in: shape)
        .clipShape(shape)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { padSize = $0 }
    }

    /// A small Signed chip in the corner once the signing is done: the signature counts (a stray dot never
    /// shows it) and the pad has been still for a moment. VoiceOver already reads Signed as the pad's value,
    /// so the chip stays out of the accessibility tree.
    @ViewBuilder private var signedChip: some View {
        if showsSigned {
            Label(String(localized: "Signed"), systemImage: "checkmark")
                .font(.caption.weight(.semibold))
                .labelStyle(SignedLabelStyle())
                .foregroundStyle(Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(style.signed, in: .capsule)
                .padding(14)
                .transition(reduceMotion ? .opacity : .scale(scale: 0.6, anchor: .topTrailing).combined(with: .opacity))
                .accessibilityHidden(true)
        }
    }

    /// The cross, the baseline and the hint. In typing mode the name field sits on the same line.
    private var guides: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(style.mark)
                    .padding(.bottom, 9)
                    .accessibilityHidden(true)
                if typing {
                    nameField
                        .transition(.opacity)
                }
            }
            Capsule()
                .fill(style.secondary.opacity(0.32))
                .frame(height: 1.5)
            Text(prompt)
                .font(.footnote.weight(.medium))
                .foregroundStyle(style.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .padding(.top, 8)
                .frame(height: baselineRoom - 1.5, alignment: .top)
                .opacity(showsHint ? 1 : 0)
                .offset(y: showsHint || reduceMotion ? 0 : 4)
                .animation(.smooth(duration: 0.25), value: showsHint)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, guideInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        // The hint grows with text size up to a point; beyond it, it would crowd the drawing area it labels.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }

    private func inkArea(size: CGSize) -> some View {
        let transform = transform(canvas: canvasSize(for: size), in: size)
        return ZStack {
            ForEach(signature.strokes) { stroke in
                StrokeLayer(stroke: stroke, transform: transform, lineWidth: style.lineWidth, ink: style.ink)
                    .equatable()
                    .transition(.asymmetric(insertion: .identity, removal: .opacity))
            }
            if let live {
                StrokeLayer(stroke: live, transform: transform, lineWidth: style.lineWidth, ink: style.ink)
            }
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .gesture(drawGesture(size: size), including: isEnabled ? .all : .none)
        .accessibilityElement()
        .accessibilityLabel(Text("Signature", comment: "Signature pad accessibility label"))
        .accessibilityValue(Text(accessibilityValue))
        .accessibilityHint(Text(allowsTyping
            ? String(localized: "Double-tap to draw with your finger, or use the Type your name instead action.")
            : String(localized: "Double-tap to draw with your finger.")))
        .accessibilityDirectTouch(true, options: .requiresActivation)
        .accessibilityActions {
            if allowsTyping {
                Button(String(localized: "Type your name instead")) { toggleMode() }
            }
            if canUndo { Button(String(localized: "Undo")) { undo() } }
            if canClear { Button(String(localized: "Clear")) { clear() } }
        }
    }

    private var accessibilityValue: String {
        if signature.strokes.isEmpty { return String(localized: "Empty") }
        if signature.isEmpty { return String(localized: "Too short to count as a signature") }
        return String(localized: "Signed")
    }

    // MARK: Typed name

    private var nameField: some View {
        let placeholder = String(localized: "Type your name")
        let name = signature.typedName ?? ""
        return TextField("", text: typedName, prompt: Text(placeholder).foregroundStyle(style.secondary.opacity(0.7)))
            .font(.custom(scriptFontName, fixedSize: nameFontSize(for: name.isEmpty ? placeholder : name)))
            .foregroundStyle(style.ink)
            .tint(style.ink)
            .lineLimit(1)
            .textContentType(.name)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .submitLabel(.done)
            .focused($nameFocused)
            .padding(.bottom, -4)
            .accessibilityLabel(Text("Signature, typed name", comment: "Accessibility label of the typed signature field"))
            .onAppear {
                guard focusOnAppear else { return }
                focusOnAppear = false
                nameFocused = true
            }
    }

    private var typedName: Binding<String> {
        Binding {
            signature.typedName ?? ""
        } set: { value in
            var next = signature
            next.typedName = value
            if next.strokes.isEmpty, padSize.width > 0 { next.canvasSize = padSize }
            signature = next
        }
    }

    /// As large as the pad allows, shrinking so a long name still fits on the line.
    private func nameFontSize(for text: String) -> CGFloat {
        let base = min(max(padSize.height * 0.26, 30), 54)
        let available = padSize.width - guideInset * 2 - 34
        guard available > 0, let font = UIFont(name: scriptFontName, size: base) else { return base }
        let natural = (text as NSString).size(withAttributes: [.font: font]).width
        return natural > available ? max(base * available / natural, 18) : base
    }

    // MARK: Controls

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 0) {
                modeButton
                Spacer(minLength: 12)
                editButtons
            }
            VStack(alignment: .leading, spacing: 0) {
                modeButton
                editButtons
            }
        }
        .font(.subheadline.weight(.semibold))
        // Button padding is 12, so the labels line up with the cross.
        .padding(.horizontal, guideInset - 12)
    }

    @ViewBuilder
    private var modeButton: some View {
        if allowsTyping {
            Button(action: toggleMode) {
                Label(typing ? String(localized: "Draw instead") : String(localized: "Type instead"), systemImage: typing ? "signature" : "keyboard")
                    .contentTransition(.opacity)
            }
            .buttonStyle(PadButtonStyle(color: style.label))
        }
    }

    private var editButtons: some View {
        HStack(spacing: 6) {
            if !typing {
                Button(action: undo) {
                    Label(String(localized: "Undo"), systemImage: "arrow.uturn.backward")
                        .labelStyle(.iconOnly)
                        .fontWeight(.bold)
                }
                .buttonStyle(PadButtonStyle(color: canUndo ? style.label : style.secondary.opacity(0.5), fill: style.control))
                .disabled(!canUndo)
                .keyboardShortcut("z", modifiers: .command)
                .transition(.opacity)
            }
            Button(String(localized: "Clear"), action: clear)
                .buttonStyle(PadButtonStyle(color: canClear ? style.label : style.secondary.opacity(0.5), fill: style.control))
                .disabled(!canClear)
                .keyboardShortcut(.delete, modifiers: .command)
        }
    }

    // MARK: Drawing

    /// Strokes on an empty pad are captured at the pad's current size; later strokes join the stored space.
    private func canvasSize(for size: CGSize) -> CGSize {
        signature.strokes.isEmpty || signature.canvasSize.width <= 0 || signature.canvasSize.height <= 0 ? size : signature.canvasSize
    }

    /// Uniform fit, anchored to the bottom (the baseline keeps a fixed distance from it) and the leading edge (the cross).
    private func transform(canvas: CGSize, in size: CGSize) -> InkTransform {
        guard canvas.width > 0, canvas.height > 0, size.width > 0, size.height > 0 else { return InkTransform() }
        let scale = min(size.width / canvas.width, size.height / canvas.height)
        let dx = layoutDirection == .rightToLeft ? size.width - canvas.width * scale : 0
        return InkTransform(scale: scale, dx: dx, dy: size.height - canvas.height * scale)
    }

    private func drawGesture(size: CGSize) -> some Gesture {
        // Zero distance: ink starts under the finger at touch-down, and the pad claims the touch before
        // an enclosing scroll view can, so a stroke never scrolls the page.
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .updating($touching) { _, state, _ in state = true }
            .onChanged { value in addPoint(value.location, at: value.time, size: size) }
            .onEnded { value in
                // The gesture-state reset may already have committed the stroke; never start a new one here.
                if live != nil { addPoint(value.location, at: value.time, size: size) }
                finishStroke()
            }
    }

    private func addPoint(_ location: CGPoint, at date: Date, size: CGSize) {
        let canvas = live == nil ? canvasSize(for: size) : liveCanvas
        let t = transform(canvas: canvas, in: size)
        let x = (location.x - t.dx) / t.scale
        let y = (location.y - t.dy) / t.scale
        guard var stroke = live, let start = liveStart else {
            live = Signature.Stroke(points: [Signature.Point(x: x, y: y, time: 0)])
            liveStart = date
            liveCanvas = canvas
            restore = nil
            strokeTick += 1
            return
        }
        let last = stroke.points[stroke.points.count - 1]
        // Sub-point jitter adds nothing but work; the smoothing covers the gaps.
        guard hypot(x - last.x, y - last.y) >= 0.75 else { return }
        stroke.points.append(Signature.Point(x: x, y: y, time: max(date.timeIntervalSince(start), last.time)))
        live = stroke
    }

    private func finishStroke() {
        guard let stroke = live else { return }
        var next = signature
        if next.strokes.isEmpty { next.canvasSize = liveCanvas }
        next.strokes.append(stroke)
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            live = nil
            liveStart = nil
            signature = next
        }
    }

    // MARK: Actions

    private func undo() {
        if !signature.strokes.isEmpty {
            withAnimation(.easeOut(duration: 0.22)) { _ = signature.strokes.removeLast() }
            undoTick += 1
            announce(String(localized: "Last stroke removed"))
        } else if let restore, restore.after == signature {
            self.restore = nil
            withAnimation(motion) { signature = restore.before }
            undoTick += 1
            announce(String(localized: "Signature restored"))
        }
    }

    private func clear() {
        let before = signature
        var after = signature
        if typing { after.typedName = "" } else { after.strokes = [] }
        guard after != before else { return }
        withAnimation(.easeOut(duration: 0.3)) { signature = after }
        restore = typing ? nil : Restore(before: before, after: after)
        clearTick += 1
        announce(String(localized: "Signature cleared"))
    }

    private func toggleMode() {
        restore = nil
        if typing {
            nameFocused = false
            withAnimation(motion) { signature.typedName = nil }
            announce(String(localized: "Drawing"))
        } else {
            focusOnAppear = true
            withAnimation(motion) { signature.typedName = "" }
        }
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Ink

/// The system script face for typed signatures. Scripts without its glyphs fall back to the system font.
private let scriptFontName = "SnellRoundhand-Bold"

/// Capture points to view points: a uniform scale, then an offset.
private struct InkTransform: Equatable {
    var scale: CGFloat = 1
    var dx: CGFloat = 0
    var dy: CGFloat = 0

    func apply(_ point: SignaturePad.Signature.Point) -> CGPoint {
        CGPoint(x: point.x * scale + dx, y: point.y * scale + dy)
    }
}

/// One stroke as paths grouped by width, so a whole stroke draws in a few dozen stroke calls at most.
///
/// Width follows speed: each sample's target width falls from `lineWidth` toward 38% of it as the finger
/// speeds up, eased in time (35 ms) so it swells and thins smoothly. The centreline runs through the midpoints
/// of consecutive samples with the samples as quadratic control points, and each curve is cut into short pieces
/// whose widths interpolate, so the taper has no visible steps. Long, fast segments are interpolated by the
/// same curves.
private struct InkShape {
    var buckets: [(width: CGFloat, path: Path)] = []
    var dots = Path()

    init(_ points: [SignaturePad.Signature.Point], lineWidth: CGFloat, transform t: InkTransform) {
        guard let first = points.first else { return }
        var kept = [first]
        for point in points.dropFirst() {
            let last = kept[kept.count - 1]
            if hypot(point.x - last.x, point.y - last.y) >= 1 { kept.append(point) }
        }
        if let end = points.last, kept.count > 1 || hypot(end.x - first.x, end.y - first.y) > 1, end != kept[kept.count - 1] {
            let last = kept[kept.count - 1]
            if hypot(end.x - last.x, end.y - last.y) > 0.25 { kept.append(end) }
        }
        guard kept.count > 1 else {
            // A tap: a round dot a little heavier than the line.
            let center = t.apply(first)
            let r = lineWidth * 0.62 * t.scale
            dots.addEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
            return
        }

        var widths = [lineWidth * 0.72]
        widths.reserveCapacity(kept.count)
        for i in 1..<kept.count {
            let dt = max(1.0 / 240, kept[i].time - kept[i - 1].time)
            let speed = hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y) / dt
            let f = min(1, max(0, (speed - 140) / 1100))
            let target = lineWidth * (1 - 0.62 * f * (2 - f))
            let ease = 1 - exp(-dt / 0.035)
            widths.append(widths[i - 1] + (target - widths[i - 1]) * ease)
        }

        let view = kept.map(t.apply)
        func mid(_ a: CGPoint, _ b: CGPoint) -> CGPoint { CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2) }
        var paths: [Int: Path] = [:]
        var ends: [Int: CGPoint] = [:]

        func add(from a: CGPoint, control c: CGPoint, to b: CGPoint, widths w0: CGFloat, _ w1: CGFloat) {
            let length = hypot(c.x - a.x, c.y - a.y) + hypot(b.x - c.x, b.y - c.y)
            let count = max(1, min(16, Int((length / 2.5).rounded(.up))))
            func at(_ s: CGFloat) -> CGPoint {
                let u = 1 - s
                return CGPoint(x: u * u * a.x + 2 * u * s * c.x + s * s * b.x, y: u * u * a.y + 2 * u * s * c.y + s * s * b.y)
            }
            for k in 0..<count {
                let ta = CGFloat(k) / CGFloat(count), tb = CGFloat(k + 1) / CGFloat(count)
                let start = at(ta), end = at(tb)
                // Control point of the sub-curve between ta and tb (the quadratic's blossom).
                let m0 = (1 - ta) * (1 - tb), m1 = (1 - ta) * tb + ta * (1 - tb), m2 = ta * tb
                let control = CGPoint(x: m0 * a.x + m1 * c.x + m2 * b.x, y: m0 * a.y + m1 * c.y + m2 * b.y)
                let width = (w0 + (w1 - w0) * (ta + tb) / 2) * t.scale
                let key = max(1, Int((width / 0.2).rounded()))
                var path = paths[key] ?? Path()
                if ends[key] != start { path.move(to: start) }
                path.addQuadCurve(to: end, control: control)
                paths[key] = path
                ends[key] = end
            }
        }

        let n = view.count
        add(from: view[0], control: mid(view[0], mid(view[0], view[1])), to: mid(view[0], view[1]), widths: widths[0], (widths[0] + widths[1]) / 2)
        if n > 2 {
            for i in 1..<(n - 1) {
                add(from: mid(view[i - 1], view[i]), control: view[i], to: mid(view[i], view[i + 1]), widths: (widths[i - 1] + widths[i]) / 2, (widths[i] + widths[i + 1]) / 2)
            }
        }
        let tail = mid(view[n - 2], view[n - 1])
        add(from: tail, control: mid(tail, view[n - 1]), to: view[n - 1], widths: (widths[n - 2] + widths[n - 1]) / 2, widths[n - 1])

        buckets = paths.sorted { $0.key < $1.key }.map { (CGFloat($0.key) * 0.2, $0.value) }
    }
}

/// One stroke in its own Canvas. Equatable, so finished strokes skip redrawing while a new one is drawn.
private struct StrokeLayer: View, Equatable {
    let stroke: SignaturePad.Signature.Stroke
    let transform: InkTransform
    let lineWidth: CGFloat
    let ink: Color

    var body: some View {
        Canvas { context, _ in
            let shape = InkShape(stroke.points, lineWidth: lineWidth, transform: transform)
            for bucket in shape.buckets {
                context.stroke(bucket.path, with: .color(ink), style: StrokeStyle(lineWidth: bucket.width, lineCap: .round, lineJoin: .round))
            }
            if !shape.dots.isEmpty { context.fill(shape.dots, with: .color(ink)) }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Draws a signature into a Core Graphics context (image or PDF), fitted and centred in `size`.
private func renderSignature(_ signature: SignaturePad.Signature, in cg: CGContext, size: CGSize, ink: UIColor, lineWidth: CGFloat, trimmed: Bool) {
    guard size.width > 0, size.height > 0 else { return }
    if let name = signature.typedName {
        let text = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let font = { (points: CGFloat) in UIFont(name: scriptFontName, size: points) ?? .italicSystemFont(ofSize: points) }
        let natural = (text as NSString).size(withAttributes: [.font: font(100)])
        guard natural.width > 0, natural.height > 0 else { return }
        let margin: CGFloat = trimmed ? 0.06 : 0.12
        let fit = min(size.width * (1 - margin * 2) / natural.width, size.height * (trimmed ? 0.9 : 0.6) / natural.height)
        let attributed = NSAttributedString(string: text, attributes: [.font: font(100 * fit), .foregroundColor: ink])
        let box = attributed.size()
        UIGraphicsPushContext(cg)
        attributed.draw(at: CGPoint(x: (size.width - box.width) / 2, y: (size.height - box.height) / 2))
        UIGraphicsPopContext()
        return
    }
    guard var frame = signature.inkBounds(lineWidth: lineWidth) else { return }
    if !trimmed, signature.canvasSize.width > 0, signature.canvasSize.height > 0 {
        frame = frame.union(CGRect(origin: .zero, size: signature.canvasSize))
    }
    let scale = min(size.width / max(frame.width, 1), size.height / max(frame.height, 1))
    let t = InkTransform(
        scale: scale,
        dx: (size.width - frame.width * scale) / 2 - frame.minX * scale,
        dy: (size.height - frame.height * scale) / 2 - frame.minY * scale
    )
    cg.setStrokeColor(ink.cgColor)
    cg.setFillColor(ink.cgColor)
    cg.setLineCap(.round)
    cg.setLineJoin(.round)
    for stroke in signature.strokes {
        let shape = InkShape(stroke.points, lineWidth: lineWidth, transform: t)
        for bucket in shape.buckets {
            cg.addPath(bucket.path.cgPath)
            cg.setLineWidth(bucket.width)
            cg.strokePath()
        }
        if !shape.dots.isEmpty {
            cg.addPath(shape.dots.cgPath)
            cg.fillPath()
        }
    }
}

/// Buttons under the pad: a 44pt target, a small dip when pressed, and an optional soft pill behind the label.
private struct PadButtonStyle: ButtonStyle {
    var color: Color
    var fill: Color? = nil

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(color)
            .padding(.horizontal, fill == nil ? 12 : 14)
            .frame(minWidth: fill == nil ? 44 : 34, minHeight: 34)
            .background { if let fill { Capsule().fill(fill) } }
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(.rect)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.3), value: configuration.isPressed)
    }
}

/// What decides when the Signed chip may show: a change to any of these restarts its short wait.
private struct SignedKey: Equatable {
    var touching: Bool
    var empty: Bool
    var typed: String?
}

/// The check before the word, tight like a status chip.
private struct SignedLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.fontWeight(.bold)
            configuration.title
        }
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// The pad alone, bound to a signature held in state.
private struct SignaturePadExample: View {
    @State private var signature = SignaturePad.Signature()

    var body: some View {
        SignaturePad(signature: $signature)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    SignaturePadExample()
}

#Preview("Dark") {
    SignaturePadExample()
        .preferredColorScheme(.dark)
}
