// swiftpieces:
// title: Photo Viewer
// description: A full-screen photo surface with anchor-correct pinch zoom, momentum panning that decelerates into the bounds, double-tap zoom about the tap, paging between images, and pinch-out or drag-down to dismiss with a fading scrim. A close button and a page counter that turns into a live zoom readout float above, and a single tap hides them.
// category: media
// minIOSVersion: "17.0"
// version: "2.0.0"
// pro: depth-gallery
// tags: [photo, zoom, pinch, pan, pager, dismiss, gesture, viewer]

import SwiftUI

/// Photos-style viewer: page horizontally at rest, zoom and pan a page, pinch past the minimum or drag vertically to dismiss.
///
/// - Parameters:
///   - items: The photos to page through. One item disables paging.
///   - selection: Optional binding to the visible item's id.
///   - minScale: Resting scale of a page.
///   - maxScale: Largest committed zoom; pinching past it rubber-bands, ticks, and springs back.
///   - style: Scrim and chrome. `.standard` draws a near-black scrim, a close button when `onDismiss` is set, and a counter that reads "2 / 5" at rest and the zoom level while zoomed.
///   - onDismiss: Called once a dismiss gesture or the close button has finished animating; end the presentation here.
///   - content: The photo for an item, typically a resizable image with `.scaledToFit()`.
public struct PhotoViewer<Item: Identifiable, Content: View>: View {
    /// Scrim and floating chrome.
    public struct Style: Sendable {
        /// The backdrop behind the photos. It fades as a dismiss gesture progresses.
        public var scrim: Color
        /// Fill of the close button and the resting counter.
        public var chromeFill: Color
        /// Glyph and text color on `chromeFill`.
        public var chromeInk: Color
        /// Block the counter turns into while zoomed, so the zoom level reads as a state.
        public var zoomFill: Color
        /// Text color on `zoomFill`.
        public var zoomInk: Color
        /// Show a close button (only when `onDismiss` is set).
        public var showsCloseButton: Bool
        /// Show the page counter and zoom readout.
        public var showsCounter: Bool

        public init(
            scrim: Color = Color(red: 0.071, green: 0.071, blue: 0.071),
            chromeFill: Color = Color(red: 0.149, green: 0.149, blue: 0.149),
            chromeInk: Color = Color(red: 0.957, green: 0.953, blue: 0.937),
            zoomFill: Color = Color(red: 0.957, green: 0.953, blue: 0.937),
            zoomInk: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
            showsCloseButton: Bool = true,
            showsCounter: Bool = true
        ) {
            self.scrim = scrim
            self.chromeFill = chromeFill
            self.chromeInk = chromeInk
            self.zoomFill = zoomFill
            self.zoomInk = zoomInk
            self.showsCloseButton = showsCloseButton
            self.showsCounter = showsCounter
        }

        /// House defaults: a near-black scrim, graphite chrome, and a paper-white zoom readout.
        public static var standard: Style { Style() }
        /// Photos only, with no floating chrome.
        public static var bare: Style { Style(showsCloseButton: false, showsCounter: false) }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var internalPage: Item.ID?
    @State private var zoomed = false
    @State private var zoomLevel: CGFloat = 1
    @State private var dismissProgress: CGFloat = 0
    @State private var chromeHidden = false
    @State private var closing = false

    private let items: [Item]
    private let selection: Binding<Item.ID?>?
    private let minScale: CGFloat
    private let maxScale: CGFloat
    private let style: Style
    private let onDismiss: (() -> Void)?
    private let content: (Item) -> Content

    public init(
        items: [Item],
        selection: Binding<Item.ID?>? = nil,
        minScale: CGFloat = 1,
        maxScale: CGFloat = 4,
        style: Style = .standard,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Item) -> Content
    ) {
        self.items = items
        self.selection = selection
        self.minScale = minScale
        self.maxScale = maxScale
        self.style = style
        self.onDismiss = onDismiss
        self.content = content
    }

    private var pageIndex: Int {
        let id = selection?.wrappedValue ?? internalPage
        return id.flatMap { id in items.firstIndex { $0.id == id } } ?? 0
    }

    public var body: some View {
        ZStack {
            style.scrim
                .opacity(closing ? 0 : 1 - Double(dismissProgress) * 0.92)
                .ignoresSafeArea()
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(items) { item in
                        ZoomPage(minScale: minScale, maxScale: maxScale, isZoomed: $zoomed, zoomLevel: $zoomLevel, dismissProgress: $dismissProgress, onDismiss: onDismiss, onTap: toggleChrome) {
                            content(item)
                        }
                        .containerRelativeFrame(.horizontal)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: selection ?? $internalPage)
            .scrollDisabled(zoomed || dismissProgress > 0 || items.count < 2)
            .scrollIndicators(.hidden)
            .ignoresSafeArea()
            .opacity(closing ? 0 : 1)
            .scaleEffect(closing && !reduceMotion ? 0.94 : 1)
        }
        .overlay(alignment: .top) { chrome }
        .animation(.easeOut(duration: 0.15), value: dismissProgress == 0)
    }

    // MARK: Chrome

    private var chrome: some View {
        let showsClose = style.showsCloseButton && onDismiss != nil
        let showsCounter = style.showsCounter && (items.count > 1 || zoomed)
        let visible = !chromeHidden && !closing
        return HStack {
            if showsClose {
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .foregroundStyle(style.chromeInk)
                        .frame(width: 44, height: 44)
                        .background(style.chromeFill, in: Circle())
                }
                .buttonStyle(Press())
                .accessibilityLabel("Close")
            }
            Spacer(minLength: 0)
            if showsCounter {
                Text(zoomed ? String(format: "%.1f×", Double(zoomLevel)) : "\(pageIndex + 1) / \(items.count)")
                    .font(.system(.subheadline, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(zoomed ? style.zoomInk : style.chromeInk)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 44)
                    .background(zoomed ? style.zoomFill : style.chromeFill, in: Capsule())
                    .animation(.snappy(duration: 0.25), value: pageIndex)
                    .animation(.spring(duration: 0.35, bounce: 0.3), value: zoomed)
                    .accessibilityLabel(zoomed ? "Zoom \(String(format: "%.1f", Double(zoomLevel))) times" : "Photo \(pageIndex + 1) of \(items.count)")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .opacity(visible ? max(0, 1 - Double(dismissProgress) * 3) : 0)
        .offset(y: visible || reduceMotion ? 0 : -12)
        .animation(.smooth(duration: 0.25), value: visible)
        .allowsHitTesting(visible && dismissProgress == 0)
    }

    private func toggleChrome() {
        chromeHidden.toggle()
    }

    private func close() {
        withAnimation(.easeOut(duration: reduceMotion ? 0.15 : 0.24), completionCriteria: .logicallyComplete) {
            closing = true
        } completion: {
            onDismiss?()
        }
    }

    /// Chrome press: a quick scale-down that springs back.
    private struct Press: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .scaleEffect(configuration.isPressed ? 0.9 : 1)
                .animation(.spring(duration: 0.3, bounce: 0.4), value: configuration.isPressed)
        }
    }

    /// One page: pinch, pan, double-tap, and the two dismiss paths. Reports zoom and dismiss progress upward.
    private struct ZoomPage<Page: View>: View {
        private enum Phase { case idle, zoomed, panning, dismissing }
        private enum DragMode { case undecided, pan, dismiss, ignore }

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @Binding var isZoomed: Bool
        @Binding var zoomLevel: CGFloat
        @Binding var dismissProgress: CGFloat
        @State private var scale: CGFloat
        @State private var zoomOffset: CGSize = .zero
        @State private var pan: CGSize = .zero
        @State private var pinchStart: (scale: CGFloat, offset: CGSize)?
        @State private var dragMode: DragMode = .undecided
        @State private var dismissDrag: CGSize = .zero
        @State private var phase: Phase = .idle
        @State private var committed = false
        @State private var hitMax = false
        @State private var resets = 0

        let minScale: CGFloat
        let maxScale: CGFloat
        let onDismiss: (() -> Void)?
        let onTap: () -> Void
        let page: () -> Page

        init(minScale: CGFloat, maxScale: CGFloat, isZoomed: Binding<Bool>, zoomLevel: Binding<CGFloat>, dismissProgress: Binding<CGFloat>, onDismiss: (() -> Void)?, onTap: @escaping () -> Void, @ViewBuilder page: @escaping () -> Page) {
            self.minScale = minScale
            self.maxScale = maxScale
            self._isZoomed = isZoomed
            self._zoomLevel = zoomLevel
            self._dismissProgress = dismissProgress
            self.onDismiss = onDismiss
            self.onTap = onTap
            self.page = page
            _scale = State(initialValue: minScale)
        }

        private var settleDuration: Double { reduceMotion ? 0.2 : 0.4 }
        private var zoomedIn: Bool { scale > minScale + 0.01 }
        /// Progress toward dismissal from a downward drag or a pinch below the minimum scale.
        private var progress: CGFloat {
            if committed { return 1 }
            let pinch = max(0, (minScale - scale) / (minScale * 0.4))
            let drag = hypot(dismissDrag.width, dismissDrag.height) / 140
            return min(1, max(pinch, drag))
        }

        var body: some View {
            GeometryReader { proxy in
                let size = proxy.size
                page()
                    .frame(width: size.width, height: size.height)
                    .scaleEffect(scale * (1 - 0.2 * min(1, hypot(dismissDrag.width, dismissDrag.height) / 140)))
                    .offset(CGSize(width: zoomOffset.width + pan.width + dismissDrag.width, height: zoomOffset.height + pan.height + dismissDrag.height))
                    .opacity(committed ? 0 : 1)
                    .frame(width: size.width, height: size.height)
                    .contentShape(Rectangle())
                    .simultaneousGesture(magnify(in: size))
                    .simultaneousGesture(drag(in: size))
                    .onTapGesture(count: 2) { location in doubleTap(at: location, in: size) }
                    .onTapGesture(count: 1) { onTap() }
            }
            .clipped()
            .onChange(of: zoomedIn) { _, new in isZoomed = new }
            .onChange(of: scale) { _, new in if new > minScale + 0.01 { zoomLevel = new / minScale } }
            .onChange(of: progress) { _, new in dismissProgress = new }
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: hitMax) { _, new in new }
            .sensoryFeedback(.impact(flexibility: .soft), trigger: resets)
            .accessibilityAction(named: "Zoom in") { zoom(to: min(maxScale, minScale * 2.5), anchor: .zero, in: .zero) }
            .accessibilityAction(named: "Reset zoom") { zoom(to: minScale, anchor: .zero, in: .zero) }
            .accessibilityAction(.escape) { commitDismiss(toward: CGSize(width: 0, height: 1), speed: 0, in: CGSize(width: 390, height: 844)) }
        }

        // MARK: Pinch

        private func magnify(in size: CGSize) -> some Gesture {
            MagnifyGesture()
                .onChanged { value in
                    guard !committed else { return }
                    let start = pinchStart ?? (scale, zoomOffset)
                    pinchStart = start
                    let raw = start.scale * value.magnification
                    let target = rubberScale(raw)
                    hitMax = raw >= maxScale
                    // Keep the content under the fingers fixed while the scale changes.
                    let anchor = CGPoint(x: (value.startAnchor.x - 0.5) * size.width, y: (value.startAnchor.y - 0.5) * size.height)
                    let ratio = target / start.scale
                    scale = target
                    zoomOffset = CGSize(
                        width: anchor.x - (anchor.x - start.offset.width) * ratio,
                        height: anchor.y - (anchor.y - start.offset.height) * ratio
                    )
                    phase = scale < minScale ? .dismissing : .zoomed
                }
                .onEnded { _ in
                    pinchStart = nil
                    hitMax = false
                    if scale < minScale * 0.8 {
                        commitDismiss(toward: dismissDrag == .zero ? CGSize(width: 0, height: 1) : dismissDrag, speed: 0, in: size)
                    } else {
                        settle(in: size)
                    }
                }
        }

        // MARK: Drag

        private func drag(in size: CGSize) -> some Gesture {
            DragGesture(minimumDistance: 6)
                .onChanged { value in
                    guard !committed else { return }
                    if dragMode == .undecided {
                        let vertical = abs(value.translation.height) > abs(value.translation.width) * 1.2
                        // Zoomed pages pan; a pinch in flight follows the fingers; at rest only a vertical drag is ours, so the pager keeps horizontal.
                        dragMode = zoomedIn ? .pan : (pinchStart != nil || vertical) ? .dismiss : .ignore
                    }
                    switch dragMode {
                    case .pan:
                        phase = .panning
                        let raw = CGSize(width: zoomOffset.width + value.translation.width, height: zoomOffset.height + value.translation.height)
                        let limited = rubberOffset(raw, in: size)
                        pan = CGSize(width: limited.width - zoomOffset.width, height: limited.height - zoomOffset.height)
                    case .dismiss:
                        phase = .dismissing
                        dismissDrag = value.translation
                    case .undecided, .ignore:
                        break
                    }
                }
                .onEnded { value in
                    let mode = dragMode
                    dragMode = .undecided
                    guard !committed else { return }
                    switch mode {
                    case .pan:
                        zoomOffset = CGSize(width: zoomOffset.width + pan.width, height: zoomOffset.height + pan.height)
                        pan = .zero
                        let flick = CGSize(width: value.predictedEndTranslation.width - value.translation.width, height: value.predictedEndTranslation.height - value.translation.height)
                        settle(in: size, momentum: flick)
                    case .dismiss:
                        guard pinchStart == nil else { return }
                        let predicted = value.predictedEndTranslation
                        let flick = CGSize(width: predicted.width - dismissDrag.width, height: predicted.height - dismissDrag.height)
                        if progress >= 1 || hypot(predicted.width, predicted.height) > 280 {
                            let speed = hypot(flick.width, flick.height)
                            commitDismiss(toward: speed > 40 ? flick : dismissDrag, speed: speed, in: size)
                        } else {
                            withAnimation(.spring(duration: settleDuration, bounce: reduceMotion ? 0 : 0.25)) { dismissDrag = .zero }
                            phase = zoomedIn ? .zoomed : .idle
                        }
                    case .undecided, .ignore:
                        break
                    }
                }
        }

        private func doubleTap(at location: CGPoint, in size: CGSize) {
            let anchor = CGPoint(x: location.x - size.width / 2, y: location.y - size.height / 2)
            zoom(to: zoomedIn ? minScale : min(maxScale, minScale * 2.5), anchor: anchor, in: size)
        }

        // MARK: Settling

        /// Zooms about `anchor` (offset from center) and clamps into bounds.
        private func zoom(to target: CGFloat, anchor: CGPoint, in size: CGSize) {
            let ratio = target / scale
            let raw = CGSize(width: anchor.x - (anchor.x - zoomOffset.width) * ratio, height: anchor.y - (anchor.y - zoomOffset.height) * ratio)
            if target <= minScale, zoomedIn { resets += 1 }
            withAnimation(.spring(duration: settleDuration, bounce: reduceMotion ? 0 : 0.2)) {
                scale = target
                zoomOffset = clampedOffset(raw, scale: target, in: size)
                pan = .zero
            }
            phase = target > minScale ? .zoomed : .idle
        }

        /// Springs scale into range and lets a released pan coast to where the flick would end, clamped to the bounds.
        private func settle(in size: CGSize, momentum: CGSize = .zero) {
            guard pinchStart == nil, dragMode == .undecided else { return }
            let target = min(max(scale, minScale), maxScale)
            let ratio = target / scale
            if target <= minScale, scale > minScale + 0.01 || scale < minScale - 0.01 { resets += 1 }
            let projected = CGSize(width: zoomOffset.width * ratio + momentum.width, height: zoomOffset.height * ratio + momentum.height)
            let destination = clampedOffset(projected, scale: target, in: size)
            let travel = hypot(destination.width - zoomOffset.width, destination.height - zoomOffset.height)
            let duration = reduceMotion ? 0.2 : min(0.6, 0.3 + Double(travel) / 1_500)
            withAnimation(.spring(duration: duration, bounce: 0)) {
                scale = target
                zoomOffset = destination
            }
            phase = target > minScale ? .zoomed : .idle
        }

        /// Flies the page off along `direction` and fades the scrim, then hands off to `onDismiss`.
        private func commitDismiss(toward direction: CGSize, speed: CGFloat, in size: CGSize) {
            let length = max(hypot(direction.width, direction.height), 1)
            let travel = max(hypot(size.width, size.height) * 1.1, speed * 1.5)
            let end = CGSize(width: dismissDrag.width + direction.width / length * travel, height: dismissDrag.height + direction.height / length * travel)
            let duration = reduceMotion ? 0.2 : min(0.4, max(0.22, Double(travel / max(speed * 4, 1))))
            phase = .dismissing
            withAnimation(.spring(duration: duration, bounce: 0), completionCriteria: .logicallyComplete) {
                committed = true
                if scale < minScale { scale = minScale * 0.3 } else { dismissDrag = end }
            } completion: {
                onDismiss?()
            }
        }

        // MARK: Limits

        private func rubberScale(_ value: CGFloat) -> CGFloat {
            if value > maxScale { return maxScale + (value - maxScale) * 0.35 }
            if value < minScale { return minScale - (minScale - value) * 0.6 }
            return value
        }

        private func rubberOffset(_ raw: CGSize, in size: CGSize) -> CGSize {
            let clamped = clampedOffset(raw, scale: scale, in: size)
            return CGSize(width: clamped.width + (raw.width - clamped.width) * 0.3, height: clamped.height + (raw.height - clamped.height) * 0.3)
        }

        private func clampedOffset(_ offset: CGSize, scale: CGFloat, in size: CGSize) -> CGSize {
            let maxX = max(0, (size.width * scale - size.width) / 2)
            let maxY = max(0, (size.height * scale - size.height) / 2)
            return CGSize(width: min(max(offset.width, -maxX), maxX), height: min(max(offset.height, -maxY), maxY))
        }
    }
}

// MARK: - Example

/// A set of risograph prints drawn as flat color compositions, shown in the viewer.
private struct PhotoViewerExample: View {
    struct Print: Identifiable {
        let id: Int
        let title: String
        let ground: Color
        let shape: Color
    }

    @Environment(\.colorScheme) private var colorScheme
    @State private var shown = true

    private static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let prints = [
        Print(id: 0, title: "Noon", ground: Color(red: 1, green: 0, blue: 0), shape: Color(red: 1, green: 0.851, blue: 0.463)),
        Print(id: 1, title: "Tide", ground: Color(red: 0.612, green: 0.761, blue: 1), shape: Color(red: 0.663, green: 0.863, blue: 0.718)),
        Print(id: 2, title: "Dusk", ground: Color(red: 0.804, green: 0.722, blue: 1), shape: Color(red: 1, green: 0, blue: 0))
    ]

    var body: some View {
        ZStack {
            (colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933))
                .ignoresSafeArea()
            if shown {
                PhotoViewer(items: prints, onDismiss: { shown = false }) { print in
                    PrintArt(print: print, ink: Self.ink)
                        .aspectRatio(3 / 4, contentMode: .fit)
                        .clipShape(.rect(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal, 20)
                }
                .transition(.opacity)
            }
        }
        // The example presents the viewer again shortly after a dismiss, so the piece is never an empty page.
        .task(id: shown) {
            guard !shown else { return }
            try? await Task.sleep(for: .seconds(0.8))
            withAnimation(.easeOut(duration: 0.3)) { shown = true }
        }
    }

    /// A flat poster: a solid ground, one disc, a bar, and the title set large.
    struct PrintArt: View {
        let print: Print
        let ink: Color

        var body: some View {
            GeometryReader { proxy in
                let w = proxy.size.width
                ZStack(alignment: .topLeading) {
                    print.ground
                    Circle()
                        .fill(print.shape)
                        .frame(width: w * 0.62, height: w * 0.62)
                        .offset(x: w * 0.3, y: w * 0.16)
                    Rectangle()
                        .fill(ink)
                        .frame(width: w * 0.46, height: w * 0.1)
                        .offset(x: w * 0.08, y: w * 0.62)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("No. 0\(print.id + 1)")
                            .font(.system(size: w * 0.05, weight: .bold, design: .monospaced))
                        Spacer()
                        Text(print.title)
                            .font(.system(size: w * 0.26, weight: .black))
                            .tracking(-w * 0.012)
                            .lineLimit(1)
                    }
                    .foregroundStyle(ink)
                    .padding(w * 0.07)
                }
            }
            .accessibilityElement()
            .accessibilityLabel("Print \(print.id + 1), \(print.title)")
        }
    }
}

#Preview("Light") {
    PhotoViewerExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    PhotoViewerExample()
        .preferredColorScheme(.dark)
}
