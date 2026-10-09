// swiftpieces:
// title: Signature Pad
// description: "A signature field that lays smooth, velocity-weighted ink into a Canvas as the finger moves, thinning on quick flicks and pooling on slow turns, over a baseline whose Sign here hint fades on the first stroke. Under the paper floats one liquid glass toolbar: Undo buds out of one end of the Type instead pill and Clear out of the other the moment they can act, joined to it by liquid necks, and melt back into it when they can't; the pill morphs to Draw instead, and a sage glass Signed chip lands once the signature counts. Undo after Clear, strokes that rescale with the pad on rotation, and export to a transparent PNG or a vector PDF."
// category: inputs
// minIOSVersion: "17.0"
// version: "1.5.0"
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
///   - style: Colors, ink weight, corner radius and pad height. Defaults to the SwiftPieces house palette, adapting to light and dark.
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
        public func image(size: CGSize, scale: CGFloat = 2, ink: Color = .black, lineWidth: CGFloat = 5, trimmed: Bool = true) -> UIImage {
            let format = UIGraphicsImageRendererFormat()
            format.scale = max(scale, 0.1)
            format.opaque = false
            let color = UIColor(ink)
            return UIGraphicsImageRenderer(size: size, format: format).image { context in
                renderSignature(self, in: context.cgContext, size: size, ink: color, lineWidth: lineWidth, trimmed: trimmed)
            }
        }

        /// PNG data of `image(size:scale:ink:lineWidth:trimmed:)`, with a transparent background.
        public func pngData(size: CGSize, scale: CGFloat = 2, ink: Color = .black, lineWidth: CGFloat = 5, trimmed: Bool = true) -> Data? {
            image(size: size, scale: scale, ink: ink, lineWidth: lineWidth, trimmed: trimmed).pngData()
        }

        /// A one-page vector PDF of the signature, `size` points large, with a transparent page.
        public func pdfData(size: CGSize, ink: Color = .black, lineWidth: CGFloat = 5, trimmed: Bool = true) -> Data {
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
        /// Glyphs and labels on the Type instead, Undo and Clear glass.
        public var label: Color
        /// The baseline and the hint.
        public var secondary: Color
        /// The sign-here cross: the one accent on the pad.
        public var mark: Color
        /// The glass tint of the Signed chip that appears once the signature counts.
        public var signed: Color
        /// The glass tint of the Type instead, Undo and Clear bubbles. `.clear`, the default, leaves them neutral glass.
        public var control: Color
        /// Ink width for slow strokes, in points. Fast strokes thin to about half of it.
        public var lineWidth: CGFloat
        /// Pad corner radius.
        public var cornerRadius: CGFloat
        /// Height of the paper, the drawing area. The toolbar floats under it. `nil` fills the height offered (a full-screen landscape signing sheet, for example).
        public var height: CGFloat?

        /// Pass only what you want to change; `nil` colors keep the house palette value.
        public init(pad: Color? = nil, ink: Color? = nil, label: Color? = nil, secondary: Color? = nil, mark: Color? = nil, signed: Color? = nil, control: Color? = nil, lineWidth: CGFloat = 5, cornerRadius: CGFloat = 26, height: CGFloat? = 200) {
            self.pad = pad ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondary = secondary ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.mark = mark ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.signed = signed ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.control = control ?? .clear
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
    /// The success tap plays the first time the chip shows for a signature, not on every pause of a signature
    /// written in parts. Ink and a typed name arm apart, so a Type instead and back round trip never replays it
    /// for the same strokes: the ink re-arms only once it no longer counts, the name once it is blank.
    @State private var inkArmed: Bool
    @State private var nameArmed: Bool
    @State private var signedTick = 0
    /// The chip pops in only on the beat of that success tap; when it comes back after a later pause it lands on a snap.
    @State private var signedPops = false
    /// Only strokes Undo after Clear brings back fade in. A flag rather than the commit's transaction decides it,
    /// because a host binding with its own animation (`$signature.animation()`) overrides that transaction.
    @State private var restoringInk = false
    /// Undo and Clear: out while they can act, melted into the Type instead pill while they can't.
    @State private var buds = PieceBuds()
    /// The Clear bubble's glass width, so its home lands inside the pill.
    @State private var clearWidth: CGFloat = 64

    private let prompt: LocalizedStringKey
    private let allowsTyping: Bool
    private let style: Style

    public init(signature: Binding<Signature>, prompt: LocalizedStringKey = "Sign here", allowsTyping: Bool = true, style: Style = .standard) {
        self._signature = signature
        // A draft passed in already signed is not a new signature, so it never taps on appear.
        self._inkArmed = State(initialValue: !signature.wrappedValue.inkCounts)
        self._nameArmed = State(initialValue: !signature.wrappedValue.nameCounts)
        self.prompt = prompt
        self.allowsTyping = allowsTyping
        self.style = style
    }

    private var typing: Bool { allowsTyping && signature.typedName != nil }
    private var showsHint: Bool { !typing && signature.strokes.isEmpty && live == nil }
    private var canUndo: Bool { !signature.strokes.isEmpty || restore.map { $0.after == signature } == true }
    private var canClear: Bool { typing ? !(signature.typedName ?? "").isEmpty : !signature.strokes.isEmpty }
    /// The bubbles that can act now: Undo while there is a stroke to take back (never while typing), Clear while
    /// there is ink or a name to clear.
    private var usable: [String] { (canUndo && !typing ? ["undo"] : []) + (canClear ? ["clear"] : []) }
    private var motion: PieceMotion { PieceMotion(reduceMotion: reduceMotion) }
    private var minPadHeight: CGFloat { baselineRoom + 104 }
    /// The toolbar glass: 40pt bubbles in 44pt targets.
    private let bubble: CGFloat = 40
    private let target: CGFloat = 44

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        // The paper is the whole card, all of it for the ink. The toolbar floats under it as one liquid shape, on the
        // page rather than on the paper, where clear glass would all but vanish.
        VStack(spacing: 12) {
            pad
                .background {
                    // The lift is on the paper alone: on the toolbar's parent it would halo the glass.
                    shape.fill(style.pad).shadow(color: .black.opacity(0.07), radius: 14, y: 6)
                }
                .clipShape(shape)
                // A hairline edge, so the paper reads on a page of the same color.
                .overlay { shape.strokeBorder(style.secondary.opacity(0.16), lineWidth: 1).allowsHitTesting(false) }
                // Signed sits in the paper's top trailing corner, clear of the ink (strokes settle toward the
                // baseline) and of the status line under it.
                .overlay(alignment: .topTrailing) { signedChip.padding(14) }
            controls
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion.snap, value: typing)
        // The chip pops in with the success tap the first time a signature counts, lands on a snap after later pauses,
        // and steps out quickly when the finger comes back.
        .animation(showsSigned ? (signedPops ? motion.success : motion.snap) : motion.dismiss, value: showsSigned)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.45), trigger: strokeTick)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.55), trigger: undoTick)
        .sensoryFeedback(.impact(weight: .medium, intensity: 0.7), trigger: clearTick)
        .onAppear { buds.place(usable) }
        // Undo and Clear bud out the moment they can act and melt home the moment they can't, Clear last out and
        // first home.
        .onChange(of: usable) { old, new in
            let leaving = old.filter { !new.contains($0) }, arriving = new.filter { !old.contains($0) }
            Task {
                if !leaving.isEmpty { await buds.gather(leaving, reduceMotion: reduceMotion) }
                if !arriving.isEmpty { await buds.bloom(arriving, reduceMotion: reduceMotion) }
            }
        }
        // Signed shows once the signing is done: the signature counts, no finger is down, and nothing has
        // changed for a moment (so it never pops in mid-stroke or between strokes, or on every typed key).
        .task(id: SignedKey(touching: touching, empty: signature.isEmpty, typed: signature.typedName)) {
            guard !touching, !signature.isEmpty else { showsSigned = false; return }
            try? await Task.sleep(for: .milliseconds(650))
            guard !Task.isCancelled else { return }
            let armed = signature.isTyped ? nameArmed : inkArmed
            signedPops = armed
            showsSigned = true
            if armed {
                if signature.isTyped { nameArmed = false } else { inkArmed = false }
                signedTick += 1
            }
        }
        .sensoryFeedback(.success, trigger: signedTick)
        .onChange(of: signature.inkCounts) { _, counts in if !counts { inkArmed = true } }
        .onChange(of: signature.nameCounts) { _, counts in if !counts { nameArmed = true } }
        // Finger up, or the system cancelled the touch (a call, a sheet): either way the stroke is kept.
        .onChange(of: touching) { _, isTouching in if !isTouching { finishStroke() } }
        .onChange(of: signature) { _, new in
            if let restore, new != restore.after { self.restore = nil }
        }
    }

    // MARK: Pad

    private var pad: some View {
        ZStack {
            guides
            if !typing {
                GeometryReader { proxy in inkArea(size: proxy.size) }
                    .transition(modeLayer(motion.snap))
            }
        }
        .frame(minHeight: minPadHeight)
        .frame(height: style.height.map { max($0, minPadHeight) })
        .frame(maxHeight: style.height == nil ? .infinity : nil)
        // Ink stays on the paper: a stroke carried past its edge never draws over the toolbar or the page.
        .clipped()
        .onGeometryChange(for: CGSize.self) { $0.size } action: { padSize = $0 }
    }

    /// A small sage glass Signed chip in the paper's top trailing corner once the signing is done: the signature
    /// counts (a stray dot never shows it) and the pad has been still for a moment. It never takes a touch. Nothing on the pad is glass for it to bud from, so it rises in on its own. VoiceOver
    /// already reads Signed as the pad's value, so the chip stays out of the tree.
    @ViewBuilder private var signedChip: some View {
        if showsSigned {
            PieceLiquidGroup {
                Label(String(localized: "Signed"), systemImage: "checkmark")
                    .font(.caption.weight(.semibold))
                    .labelStyle(SignedLabelStyle())
                    // House ink: it reads on sage, in light and dark alike.
                    .foregroundStyle(Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .pieceLiquid(.capsule, tint: style.signed, interactive: false)
            }
            // Grows from its trailing end, out of the corner it sits in.
            .transition(LiquidRise(scale: 0.6, shift: 12, reduceMotion: reduceMotion))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    /// The cross, the baseline and the hint. In typing mode the name field sits on the same line.
    private var guides: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(style.mark)
                    .padding(.bottom, 9)
                    .accessibilityHidden(true)
                if typing {
                    nameField
                        .transition(modeLayer(motion.reveal))
                }
            }
            Capsule()
                .fill(style.secondary.opacity(0.32))
                .frame(height: 1.5)
            // The status line: the hint while the pad is empty.
            HStack(alignment: .top, spacing: 8) {
                Text(prompt)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(style.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.top, 8)
                    .opacity(showsHint ? 1 : 0)
                    .offset(y: showsHint || reduceMotion ? 0 : 4)
                    .animation(showsHint ? motion.reveal : motion.dismiss, value: showsHint)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }
            .frame(height: baselineRoom - 1.5, alignment: .top)
        }
        .padding(.horizontal, guideInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        // The hint grows with text size up to a point; beyond it, it would crowd the drawing area it labels.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }

    /// Switching modes hands the line over: the outgoing layer (ink or name field) fades first and the incoming one
    /// follows a beat behind, so strokes and the typed name barely overlap (under Reduce Motion, a quick crossfade).
    /// Only the fade waits; the field takes focus and the keyboard rises at once. The ink comes back with `snap`,
    /// not `reveal`: a stroke started just after Draw instead is at full strength about 0.3 s after the tap.
    private func modeLayer(_ insertion: Animation) -> AnyTransition {
        .asymmetric(insertion: .opacity.animation(insertion.delay(0.08)), removal: .opacity.animation(motion.dismiss))
    }

    private func inkArea(size: CGSize) -> some View {
        let transform = transform(canvas: canvasSize(for: size), in: size)
        return ZStack {
            ForEach(signature.strokes) { stroke in
                StrokeLayer(stroke: stroke, transform: transform, lineWidth: style.lineWidth, ink: style.ink)
                    .equatable()
                    // A stroke you draw lands exactly as drawn, whatever animation the binding carries; strokes
                    // that come back through Undo after Clear fade in.
                    .transition(.asymmetric(insertion: restoringInk ? .opacity : .identity, removal: .opacity))
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
            // The field writes its text back as it loses focus on the way out (Draw instead); that must not reopen typing.
            guard signature.typedName != nil else { return }
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

    /// The toolbar: one liquid shape floating centred under the paper. Type instead is the anchor in the middle; Undo
    /// buds out of its leading end and Clear out of its trailing end the moment they can act, and melt back into it
    /// the moment they can't. The three rest joined, so the necks hold and the toolbar reads as one control. Both side
    /// slots keep Clear's width whether or not anything is in them, so the pill never moves. When the row no longer
    /// fits (large text, a long translation), Undo and Clear move to a second row under the pill.
    private var controls: some View {
        PieceLiquidGroup {
            ViewThatFits(in: .horizontal) {
                toolbar(stacked: false)
                toolbar(stacked: true)
            }
        }
        .font(.subheadline.weight(.semibold))
        .frame(maxWidth: .infinity)
    }

    /// Targets sit this far apart so their glass rests `PieceLiquid.joined` apart: the 44pt targets are 4pt wider
    /// than their 40pt glass.
    private var targetGap: CGFloat { PieceLiquid.joined - (target - bubble) }

    private func toolbar(stacked: Bool) -> some View {
        let sides = HStack(spacing: targetGap) {
            side(.trailing) {
                if buds.contains("undo") { undoButton(home: undoHome(stacked: stacked)) }
            }
            if !stacked { modeButton.zIndex(1) }
            side(.leading) {
                if buds.contains("clear") { clearButton(home: clearHome(stacked: stacked)) }
            }
        }
        return VStack(spacing: targetGap) {
            // Above the bubbles, so one home inside it sits under it on the frosted glass before iOS 26, which
            // doesn't merge.
            if stacked { modeButton.zIndex(1) }
            sides
        }
    }

    /// A slot as wide as the Clear bubble (and never narrower than a target), holding its bubble against the pill.
    private func side<Content: View>(_ alignment: Alignment, @ViewBuilder content: () -> Content) -> some View {
        ZStack(alignment: alignment) {
            Text(String(localized: "Clear"))
                .padding(.horizontal, 16)
                .frame(minWidth: bubble, minHeight: bubble)
                .padding((target - bubble) / 2)
                .hidden()
                .accessibilityHidden(true)
            content()
        }
    }

    /// Undo's home: shrunk, just inside the pill's leading end. Stacked, it is just inside the middle of the pill's
    /// bottom edge. Without the pill (typing turned off) it waits where it rests, shrunk to nothing.
    private func undoHome(stacked: Bool) -> CGSize {
        guard allowsTyping else { return .zero }
        let reach = bubble / 2 + PieceLiquid.joined + bubble * PieceLiquid.homeScale / 2
        guard stacked else { return CGSize(width: reach, height: 0) }
        // The second row is centred under the pill, its two slots the same width, so Undo rests its own half and
        // half the neck before the middle.
        return CGSize(width: (bubble + PieceLiquid.joined) / 2, height: -reach)
    }

    /// Clear's home: shrunk, just inside the pill's trailing end, or the middle of its bottom edge when stacked.
    private func clearHome(stacked: Bool) -> CGSize {
        guard allowsTyping else { return .zero }
        guard stacked else {
            return CGSize(width: -(clearWidth / 2 + PieceLiquid.joined + clearWidth * PieceLiquid.homeScale / 2), height: 0)
        }
        let reach = bubble / 2 + PieceLiquid.joined + bubble * PieceLiquid.homeScale / 2
        return CGSize(width: -(clearWidth + PieceLiquid.joined) / 2, height: -reach)
    }

    private var controlTint: Color? { style.control == .clear ? nil : style.control }

    @ViewBuilder
    private var modeButton: some View {
        if allowsTyping {
            Button(action: toggleMode) {
                HStack(spacing: 8) {
                    // The glyph blurs from one to the other while the label morphs letter by letter around it.
                    ZStack {
                        Image(systemName: typing ? "signature" : "keyboard")
                            .id(typing)
                            .transition(motion.swap)
                    }
                    PieceMorphText(text: typing ? String(localized: "Draw instead") : String(localized: "Type instead"), font: .subheadline.weight(.semibold))
                }
            }
            .buttonStyle(PadButtonStyle(color: style.label, tint: controlTint))
            .accessibilityLabel(typing ? String(localized: "Draw instead") : String(localized: "Type instead"))
        }
    }

    private func undoButton(home: CGSize) -> some View {
        let out = buds.isOut("undo")
        return Button(action: undo) {
            Label(String(localized: "Undo"), systemImage: "arrow.uturn.backward")
                .labelStyle(.iconOnly)
        }
        .buttonStyle(PadButtonStyle(round: true, out: out, color: style.label, tint: controlTint))
        // On its way home it no longer acts, and VoiceOver no longer finds it.
        .disabled(!out)
        .keyboardShortcut("z", modifiers: .command)
        .modifier(PadBud(out: out, home: home, alone: !allowsTyping))
        .accessibilityHidden(!out)
    }

    private func clearButton(home: CGSize) -> some View {
        let out = buds.isOut("clear")
        return Button(String(localized: "Clear"), action: clear)
            .buttonStyle(PadButtonStyle(out: out, color: style.label, tint: controlTint))
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { clearWidth = $0 - (target - bubble) }
            .disabled(!out)
            .keyboardShortcut(.delete, modifiers: .command)
            .modifier(PadBud(out: out, home: home, alone: !allowsTyping))
            .accessibilityHidden(!out)
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
            restoringInk = false
            signature = next
        }
    }

    // MARK: Actions

    private func undo() {
        if !signature.strokes.isEmpty {
            withAnimation(motion.dismiss) { _ = signature.strokes.removeLast() }
            undoTick += 1
            announce(String(localized: "Last stroke removed"))
        } else if let restore, restore.after == signature {
            self.restore = nil
            withAnimation(motion.reveal) {
                restoringInk = true
                signature = restore.before
            }
            undoTick += 1
            announce(String(localized: "Signature restored"))
        }
    }

    private func clear() {
        let before = signature
        var after = signature
        if typing { after.typedName = "" } else { after.strokes = [] }
        guard after != before else { return }
        withAnimation(motion.dismiss) { signature = after }
        restore = typing ? nil : Restore(before: before, after: after)
        clearTick += 1
        announce(String(localized: "Signature cleared"))
    }

    private func toggleMode() {
        restore = nil
        if typing {
            nameFocused = false
            withAnimation(motion.snap) { signature.typedName = nil }
            announce(String(localized: "Drawing"))
        } else {
            focusOnAppear = true
            withAnimation(motion.snap) { signature.typedName = "" }
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
            let target = lineWidth * (1 - 0.5 * f * (2 - f))
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

/// A toolbar control on liquid glass: a 40pt bubble (round for a glyph, a capsule for a label) in a 44pt target.
/// Pressed, the bubble sinks and its label dims like a native button's, so a press still reads under Reduce Motion,
/// while the glass stays clear. The label is hidden while the bubble is home inside the Type instead pill.
private struct PadButtonStyle: ButtonStyle {
    var round = false
    var out = true
    var color: Color
    var tint: Color?

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(color)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .pieceBudContent(out: out)
            .padding(.horizontal, round ? 0 : 16)
            .frame(minWidth: 40, minHeight: 40)
            .pieceLiquid(.capsule, tint: tint, interactive: false)
            // A shallower sink than the default, about 1.5pt a side: the chrome stays quiet next to the ink.
            .modifier(LiquidPress(pressed: configuration.isPressed, depth: 1.5))
            .padding(2)
            .contentShape(.rect)
    }
}

/// Undo's and Clear's bud. With the Type instead pill they bud out of it and melt home into it; `alone` (typing turned
/// off, so there is no pill) they grow from nothing where they rest and shrink back to nothing. Glass ignores opacity
/// inside a liquid group, so it is the scale that hides them.
private struct PadBud: ViewModifier {
    let out: Bool
    let home: CGSize
    let alone: Bool

    func body(content: Content) -> some View {
        content
            .pieceBud(out: out, home: home)
            .pieceLiquidScale(out || !alone ? 1 : 0.001)
    }
}

/// The press for a glass control: it sinks about `depth` points a side and springs back through rest, the glass and
/// what it carries together. It scales through `pieceLiquidScale`, never a scaleEffect, which would shrink only the
/// glass's outline. Under Reduce Motion it shades instead, darker in light mode and lighter in dark.
private struct LiquidPress: ViewModifier {
    let pressed: Bool
    var depth: CGFloat = 2.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .pieceLiquidScale(pressed && !reduceMotion ? PieceMotion.pressScale(for: size, depth: depth) : 1)
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .animation(pressed ? motion.press : motion.release, value: pressed)
    }
}

/// A glass chip arriving on its own, with nothing to bud from: it grows from `scale` as it fades in, and leaves the
/// same way. The glass scales through `pieceLiquidScale`, never a scaleEffect, which would shrink only its outline.
/// Under Reduce Motion it only fades.
private struct LiquidRise: Transition {
    var scale: CGFloat
    /// How far it slides in from, toward the trailing edge.
    var shift: CGFloat = 0
    var reduceMotion: Bool

    func body(content: Content, phase: TransitionPhase) -> some View {
        let still = phase.isIdentity || reduceMotion
        return content
            .pieceLiquidScale(still ? 1 : scale)
            .offset(x: still ? 0 : shift)
            .opacity(phase.isIdentity ? 1 : 0)
    }
}

/// What decides when the Signed chip may show: a change to any of these restarts its short wait.
private struct SignedKey: Equatable {
    var touching: Bool
    var empty: Bool
    var typed: String?
}

/// What arms the success tap, per mode: the same rules as `isEmpty`, but for the ink and the typed name apart.
private extension SignaturePad.Signature {
    var inkCounts: Bool { inkLength >= Self.minimumInk }
    var nameCounts: Bool { !(typedName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// The check before the word, tight like a status chip.
private struct SignedLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon
            configuration.title
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

/// The signing card alone, bound to a signature held in state.
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath)

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

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, bud, morphText)

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

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
