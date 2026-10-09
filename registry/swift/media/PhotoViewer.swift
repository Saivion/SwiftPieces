// swiftpieces:
// title: Photo Viewer
// description: A full-screen photo surface with anchor-correct pinch zoom, momentum panning that gives a little at the bounds and rebounds, double-tap zoom about the tap, paging between images, and pinch-out or drag-down to dismiss with a fading scrim. A liquid glass close button and page counter float over the photos; while zoomed the counter floods with a light tint and rolls into a live zoom readout, and a single tap hides them.
// category: media
// minIOSVersion: "17.0"
// version: "2.2.0"
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
///   - style: Scrim and chrome. `.standard` draws a near-black scrim and, in liquid glass over it, a close button when `onDismiss` is set and a counter that reads "2 / 5" at rest and the zoom level while zoomed.
///   - onDismiss: Called once a dismiss gesture or the close button has finished animating; end the presentation here.
///   - content: The photo for an item, typically a resizable image with `.scaledToFit()`.
public struct PhotoViewer<Item: Identifiable, Content: View>: View {
    /// Scrim and floating chrome.
    public struct Style: Sendable {
        /// The backdrop behind the photos. It fades as a dismiss gesture progresses.
        public var scrim: Color
        /// Unused since the liquid glass refactor: the close button and the counter are liquid glass, in its dark
        /// appearance so they read over the scrim. Kept so existing code still compiles.
        public var chromeFill: Color
        /// Glyph and text color on the glass chrome.
        public var chromeInk: Color
        /// The tint the counter's glass floods with while zoomed, so the zoom level reads as a state.
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

        /// House defaults: a near-black scrim, dark liquid glass chrome, and a paper-tinted zoom readout.
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
        // No animation of its own here: a page reports its dismiss progress inside the same animation that moves the
        // photo, so the scrim and the chrome come back with the photo rather than ahead of it.
        .overlay(alignment: .top) { chrome }
    }

    // MARK: Chrome

    /// The close button and the counter: liquid glass floating over the photos, apart from each other in their corners.
    private var chrome: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let showsClose = style.showsCloseButton && onDismiss != nil
        let showsCounter = style.showsCounter && (items.count > 1 || zoomed)
        let visible = !chromeHidden && !closing
        return PieceLiquidGroup {
            HStack {
                if showsClose {
                    Button(action: close) {
                        Image(systemName: "xmark")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(style.chromeInk)
                            .frame(width: 44, height: 44)
                            .pieceLiquid(.circle, interactive: false)
                    }
                    // The liquid press, so the mark sinks with its glass.
                    .buttonStyle(PieceLiquidPressStyle())
                    .accessibilityLabel("Close")
                }
                Spacer(minLength: 0)
                if showsCounter {
                    counter(motion)
                        // A single photo has no counter until it is zoomed. With no glass to bud from, the readout
                        // drops in on its own, the way the chrome does after a tap.
                        .transition(motion.transition(.opacity.combined(with: .offset(y: -12))))
                }
            }
        }
        // The chrome's own type, so the photos you pass in keep theirs.
        .fontWeight(.semibold)
        // The viewer is a darkroom in either appearance, so its glass is the dark glass and its ink the paper ink.
        .environment(\.colorScheme, .dark)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .animation(motion.snap, value: showsCounter)
        .opacity(visible ? max(0, 1 - Double(dismissProgress) * 3) : 0)
        .offset(y: visible || reduceMotion ? 0 : -12)
        // Small and out of the photo's way: a tap snaps it into place with a slight give, and it gets out quickly.
        .animation(visible ? motion.snap : motion.dismiss, value: visible)
        .allowsHitTesting(visible && dismissProgress == 0)
    }

    /// "2 / 5" on clear glass at rest. Zoomed, the glass floods with `zoomFill` and the digits roll into the zoom level.
    private func counter(_ motion: PieceMotion) -> some View {
        Text(zoomed ? String(format: "%.1f×", Double(zoomLevel)) : "\(pageIndex + 1) / \(items.count)")
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .monospacedDigit()
            .contentTransition(reduceMotion ? .opacity : .numericText())
            // The digits are a readout: a new page or the zoom readout rolls them on `value`, never past what they say.
            .animation(motion.value, value: pageIndex)
            .animation(motion.value, value: zoomed)
            .foregroundStyle(zoomed ? style.zoomInk : style.chromeInk)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .pieceLiquid(.capsule, tint: zoomed ? style.zoomFill : nil, interactive: false)
            // The glass around them reshapes with a little give, wider for another digit or into the readout, and its
            // tint floods in or drains on the same beat.
            .animation(motion.morph, value: zoomed)
            .animation(motion.morph, value: pageIndex)
            .accessibilityLabel(zoomed ? "Zoom \(String(format: "%.1f", Double(zoomLevel))) times" : "Photo \(pageIndex + 1) of \(items.count)")
    }

    private func toggleChrome() {
        chromeHidden.toggle()
    }

    private func close() {
        withAnimation(PieceMotion(reduceMotion: reduceMotion).dismiss, completionCriteria: .logicallyComplete) {
            closing = true
        } completion: {
            onDismiss?()
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
        // One per touch, zoom or settle; an edge rebound runs only if nothing has taken the photo since its release.
        @State private var releases = 0
        // How much further than the photo shows a pan's finger counts as having pulled, for a photo caught past an edge,
        // or where a dismiss drag picks up a pull caught on its way home.
        @State private var pickup: CGSize = .zero
        // Where an uncommitted pull let go, how fast and when, so a drag can catch it on its way home.
        @State private var pullHome: (from: CGSize, velocity: CGSize, start: TimeInterval)?
        // Reset by the system when it cancels a touch (a call, Control Center), which never reaches onEnded.
        @GestureState private var pinching = false
        @GestureState private var dragging = false

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
                    // Each axis on its own offset, so a release can carry the finger's speed along each separately.
                    .offset(x: zoomOffset.width + pan.width + dismissDrag.width)
                    .offset(y: zoomOffset.height + pan.height + dismissDrag.height)
                    .opacity(committed ? 0 : 1)
                    .frame(width: size.width, height: size.height)
                    .contentShape(Rectangle())
                    .simultaneousGesture(magnify(in: size))
                    .simultaneousGesture(drag(in: size))
                    .onTapGesture(count: 2) { location in doubleTap(at: location, in: size) }
                    .onTapGesture(count: 1) { onTap() }
                    // A cancelled pinch or drag is let go here, without momentum or a commit. After a normal end
                    // onEnded has already cleared these, so nothing runs twice.
                    .onChange(of: pinching) { _, isPinching in
                        guard !isPinching, pinchStart != nil else { return }
                        pinchStart = nil
                        hitMax = false
                        settle(in: size)
                    }
                    .onChange(of: dragging) { _, isDragging in
                        guard !isDragging, dragMode != .undecided else { return }
                        dragMode = .undecided
                        foldPan()
                        settle(in: size)
                    }
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
                .updating($pinching) { _, isPinching, _ in isPinching = true }
                .onChanged { value in
                    guard !committed else { return }
                    if pinchStart == nil { releases += 1 }
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
                .updating($dragging) { _, isDragging, _ in isDragging = true }
                .onChanged { value in
                    guard !committed else { return }
                    if dragMode == .undecided {
                        let vertical = abs(value.translation.height) > abs(value.translation.width) * 1.2
                        // Zoomed pages pan; a pinch in flight follows the fingers; at rest only a vertical drag is ours, so the pager keeps horizontal.
                        dragMode = zoomedIn ? .pan : (pinchStart != nil || vertical) ? .dismiss : .ignore
                        // A new touch drops a pending edge rebound, and a photo caught while it gives past an edge is
                        // picked up where it is, as deep in the band as it sits, so it doesn't jump. A pull caught on its
                        // way home is picked up where it's drawn, for the same reason.
                        releases += 1
                        pickup = dragMode == .dismiss ? caughtPull() : pinchStart == nil ? slack(at: zoomOffset, in: size) : .zero
                    }
                    switch dragMode {
                    case .pan:
                        phase = .panning
                        let raw = CGSize(width: zoomOffset.width + pickup.width + value.translation.width, height: zoomOffset.height + pickup.height + value.translation.height)
                        let limited = rubberOffset(raw, in: size)
                        pan = CGSize(width: limited.width - zoomOffset.width, height: limited.height - zoomOffset.height)
                    case .dismiss:
                        phase = .dismissing
                        dismissDrag = CGSize(width: pickup.width + value.translation.width, height: pickup.height + value.translation.height)
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
                        // The photo's own speed: the finger's, slowed by the band past the bounds.
                        let raw = CGSize(width: zoomOffset.width + pickup.width + value.translation.width, height: zoomOffset.height + pickup.height + value.translation.height)
                        let frame: CGFloat = 1 / 120
                        let here = rubberOffset(raw, in: size)
                        let ahead = rubberOffset(CGSize(width: raw.width + value.velocity.width * frame, height: raw.height + value.velocity.height * frame), in: size)
                        let velocity = CGSize(width: (ahead.width - here.width) / frame, height: (ahead.height - here.height) / frame)
                        foldPan()
                        let flick = CGSize(width: value.predictedEndTranslation.width - value.translation.width, height: value.predictedEndTranslation.height - value.translation.height)
                        settle(in: size, momentum: flick, velocity: velocity)
                    case .dismiss:
                        guard pinchStart == nil else { return }
                        // Measured from rest, like the pull itself.
                        let predicted = CGSize(width: pickup.width + value.predictedEndTranslation.width, height: pickup.height + value.predictedEndTranslation.height)
                        let flick = CGSize(width: predicted.width - dismissDrag.width, height: predicted.height - dismissDrag.height)
                        if progress >= 1 || hypot(predicted.width, predicted.height) > 280 {
                            let speed = hypot(flick.width, flick.height)
                            commitDismiss(toward: speed > 40 ? flick : dismissDrag, speed: speed, velocity: value.velocity, in: size)
                        } else {
                            settle(in: size, velocity: value.velocity)
                        }
                    case .undecided, .ignore:
                        // A pinch that ended while this drag was down left the settling to it.
                        settle(in: size)
                    }
                }
        }

        /// Folds a finished pan into the resting offset. The sum is unchanged, so nothing moves.
        private func foldPan() {
            zoomOffset = CGSize(width: zoomOffset.width + pan.width, height: zoomOffset.height + pan.height)
            pan = .zero
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
            releases += 1
            let motion = PieceMotion(reduceMotion: reduceMotion)
            // A tap or an action zooms in with a little give, which can't open an edge: the clamped offset moves no
            // further than the growing scale covers, so swelling past the target only adds cover. A zoom out lands on
            // `value`, with none: a dip below the fitted size would show the backdrop beside a photo that fills the screen.
            withAnimation(target > scale ? motion.morph : motion.value) {
                scale = target
                zoomOffset = clampedOffset(raw, scale: target, in: size)
                pan = .zero
            }
            phase = target > minScale ? .zoomed : .idle
        }

        /// Brings the page to rest once neither the pinch nor the drag holds it, in either order they end: the scale
        /// back into range, a released pan coasting to where the flick would end, and a dismiss pull that didn't commit
        /// back home. `velocity` is the photo's speed as the drag that just ended let go of it.
        private func settle(in size: CGSize, momentum: CGSize = .zero, velocity: CGSize = .zero) {
            guard pinchStart == nil, dragMode == .undecided, !committed else { return }
            releases += 1
            let motion = PieceMotion(reduceMotion: reduceMotion)
            let target = min(max(scale, minScale), maxScale)
            let ratio = target / scale
            if target <= minScale, scale > minScale + 0.01 || scale < minScale - 0.01 { resets += 1 }
            let projected = CGSize(width: zoomOffset.width * ratio + momentum.width, height: zoomOffset.height * ratio + momentum.height)
            let destination = clampedOffset(projected, scale: target, in: size)
            // Back up from a pinch below the minimum, the photo rebounds with give when swelling past rest covers the
            // offset's own swing past its destination, as it always does for a pinch that began at rest. One pinched out
            // from a zoomed, off-center view has further to travel than that cover, so it lands on `value`, as it does
            // down from past the maximum: there a dip below the scale would open the photo's edge against offsets clamped
            // for that scale, and the readout says where it lands.
            let cover = CGSize(width: (target - scale) * size.width / 2 + 0.5, height: (target - scale) * size.height / 2 + 0.5)
            let covered = abs(destination.width - zoomOffset.width) <= cover.width && abs(destination.height - zoomOffset.height) <= cover.height
            let rescale = target > scale && covered ? motion.rebound : motion.value
            // The scrim and the chrome come back on whichever move takes the page home.
            var home = rescale
            if dismissDrag != .zero {
                // A pull that didn't commit returns at the finger's speed and settles home with some give. Both axes
                // share one spring, so the print never rocks.
                let x = motion.settle(velocity: velocity.width, from: dismissDrag.width, to: 0)
                let y = motion.settle(velocity: velocity.height, from: dismissDrag.height, to: 0)
                home = abs(dismissDrag.height) >= abs(dismissDrag.width) ? y : x
                pullHome = (dismissDrag, velocity, Date.now.timeIntervalSinceReferenceDate)
                withAnimation(x) { dismissDrag.width = 0 }
                withAnimation(y) { dismissDrag.height = 0 }
            }
            if target != scale {
                // Scale and offset share one spring, so the photo's edge moves with its scale.
                withAnimation(rescale) {
                    scale = target
                    zoomOffset = destination
                }
            } else {
                // The print coasts from the finger's speed, for longer the further it glides.
                let travel = hypot(destination.width - zoomOffset.width, destination.height - zoomOffset.height)
                let coast = Spring(duration: min(0.6, 0.3 + Double(travel) / 1_500), bounce: 0)
                land(\.width, velocity: velocity.width, projected: projected.width, destination: destination.width, coast: coast, motion: motion)
                land(\.height, velocity: velocity.height, projected: projected.height, destination: destination.height, coast: coast, motion: motion)
            }
            if dismissProgress != progress {
                withAnimation(home) { dismissProgress = progress }
            }
            phase = target > minScale ? .zoomed : .idle
        }

        /// Lands one axis of a released pan. Inside the bounds it coasts to where the flick ends. A flick that runs into
        /// an edge carries on past it by a give that grows with the flick, then rebounds, the way a scroll view's edge
        /// does: aiming past the edge gives the photo room to keep the finger's speed, which a landing on the
        /// edge itself would cap. One already past that give comes straight back. Under Reduce Motion it stops at the edge.
        private func land(_ axis: WritableKeyPath<CGSize, CGFloat>, velocity: CGFloat, projected: CGFloat, destination: CGFloat, coast: Spring, motion: PieceMotion) {
            let current = zoomOffset[keyPath: axis]
            guard projected != destination else {
                withAnimation(motion.settle(velocity: velocity, from: current, to: destination, spring: coast)) { zoomOffset[keyPath: axis] = destination }
                return
            }
            // A light band, so a gentle flick gives a little and a hard one more, never past 80 pt.
            let peak = destination + (reduceMotion ? 0 : PieceMotion.rubberBand(projected - destination, limit: 80, coefficient: 0.12))
            guard (peak - current) * (peak - destination) > 0, velocity * (peak - current) > 0 else {
                withAnimation(motion.settle(velocity: velocity, from: current, to: destination, spring: PieceMotion.elastic)) { zoomOffset[keyPath: axis] = destination }
                return
            }
            // No bounce, at the rate the finger sets: the photo leaves at its speed and slows into the give the way a
            // scroll view slows, rather than having its speed capped.
            let rate = Double(abs(peak - current) / max(abs(velocity), 1))
            let leg = Spring(duration: min(0.6, max(PieceMotion.tight.duration, 2 * .pi * rate)), bounce: 0)
            let release = releases
            withAnimation(motion.settle(velocity: velocity, from: current, to: peak, spring: leg), completionCriteria: .logicallyComplete) {
                zoomOffset[keyPath: axis] = peak
            } completion: {
                // A newer touch, zoom or settle owns the photo now.
                guard release == releases, !committed else { return }
                withAnimation(motion.rebound) { zoomOffset[keyPath: axis] = destination }
            }
        }

        /// Sends the page away and fades the scrim, then hands off to `onDismiss`. A thrown print slides off along
        /// `direction` at the finger's `velocity`, and one pinched small shrinks away. Under Reduce Motion it fades
        /// where it is.
        private func commitDismiss(toward direction: CGSize, speed: CGFloat, velocity: CGSize = .zero, in size: CGSize) {
            let motion = PieceMotion(reduceMotion: reduceMotion)
            let length = max(hypot(direction.width, direction.height), 1)
            let travel = max(hypot(size.width, size.height) * 1.1, speed * 1.5)
            let end = CGSize(width: dismissDrag.width + direction.width / length * travel, height: dismissDrag.height + direction.height / length * travel)
            phase = .dismissing
            guard !reduceMotion, scale >= minScale else {
                withAnimation(motion.dismiss, completionCriteria: .logicallyComplete) {
                    committed = true
                    if !reduceMotion { scale = minScale * 0.3 }
                    dismissProgress = 1
                } completion: {
                    onDismiss?()
                }
                return
            }
            // The dismiss role's spring, started at the finger's speed along each axis. The longer leg carries the
            // completion, so `onDismiss` waits until the page is gone.
            let flight = Spring(duration: 0.28, bounce: 0)
            let x = motion.settle(velocity: velocity.width, from: dismissDrag.width, to: end.width, spring: flight)
            let y = motion.settle(velocity: velocity.height, from: dismissDrag.height, to: end.height, spring: flight)
            let horizontal = abs(end.width - dismissDrag.width) > abs(end.height - dismissDrag.height)
            if horizontal {
                withAnimation(y) { dismissDrag.height = end.height }
            } else {
                withAnimation(x) { dismissDrag.width = end.width }
            }
            withAnimation(horizontal ? x : y, completionCriteria: .logicallyComplete) {
                committed = true
                if horizontal { dismissDrag.width = end.width } else { dismissDrag.height = end.height }
                dismissProgress = 1
            } completion: {
                onDismiss?()
            }
        }

        // MARK: Limits

        private func rubberScale(_ value: CGFloat) -> CGFloat {
            // Past the maximum the zoom stiffens toward a ceiling about 35% higher. A pinch is a ratio, so the band
            // runs on the ratio and feels the same at any `maxScale`.
            if value > maxScale { return maxScale * exp(PieceMotion.rubberBand(log(value / maxScale), limit: 0.3)) }
            // Below the minimum is the pinch dismiss, not an edge: the page follows the fingers at a steady ratio,
            // so the 80% commit point stays where it is.
            if value < minScale { return minScale - (minScale - value) * 0.6 }
            return value
        }

        /// Past the bounds a pan stiffens toward a limit, like a scroll view's edge. The whole overshoot is banded.
        private func rubberOffset(_ raw: CGSize, in size: CGSize) -> CGSize {
            let clamped = clampedOffset(raw, scale: scale, in: size)
            return CGSize(
                width: clamped.width + PieceMotion.rubberBand(raw.width - clamped.width, limit: 120),
                height: clamped.height + PieceMotion.rubberBand(raw.height - clamped.height, limit: 120)
            )
        }

        /// For a photo sitting past the bounds, how much further than it shows a finger would have pulled to hold it
        /// there: `rubberOffset` run backwards. Zero inside the bounds.
        private func slack(at offset: CGSize, in size: CGSize) -> CGSize {
            let clamped = clampedOffset(offset, scale: scale, in: size)
            func slack(_ banded: CGFloat) -> CGFloat {
                // The band above, y = (1 - 1 / (0.55 x / 120 + 1)) * 120, solved for x. An edge give stays well inside it.
                let y = min(abs(banded), 100)
                let x = y * 120 / ((120 - y) * 0.55)
                return banded < 0 ? y - x : x - y
            }
            return CGSize(width: slack(offset.width - clamped.width), height: slack(offset.height - clamped.height))
        }

        /// Where an uncommitted pull is drawn on its way home: the springs `settle` sent it home on, run to now. Zero
        /// once it's home, or once a new pull or a dismiss has taken it.
        private func caughtPull() -> CGSize {
            guard let pullHome, dismissDrag == .zero else { return .zero }
            let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : PieceMotion.elastic
            let elapsed = Date.now.timeIntervalSinceReferenceDate - pullHome.start
            guard elapsed < spring.settlingDuration else { return .zero }
            // As `motion.settle(velocity:)` starts each axis: the finger's speed in whole distances per second, capped.
            let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
            func drawn(_ from: CGFloat, _ velocity: CGFloat) -> CGFloat {
                let relative = abs(from) < 1 ? 0 : min(max(Double(velocity / -from), -cap), cap)
                return from * (1 - CGFloat(spring.value(target: 1.0, initialVelocity: relative, time: elapsed)))
            }
            return CGSize(width: drawn(pullHome.from.width, pullHome.velocity.width), height: drawn(pullHome.from.height, pullHome.velocity.height))
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
                            .font(.system(size: w * 0.05, weight: .semibold, design: .monospaced))
                        Spacer()
                        Text(print.title)
                            .font(.system(size: w * 0.26, weight: .semibold))
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, momentum, rubberBand, pressMath)

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
    /// Where a flick at `velocity` (pt/s) coasts to. 0.998 coasts like a scroll view; 0.99 suits detents.
    nonisolated static func project(_ position: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.99) -> CGFloat {
        position + velocity / 1000 * decelerationRate / (1 - decelerationRate)
    }

    /// The candidate closest to `value`.
    nonisolated static func nearest(_ value: CGFloat, in candidates: [CGFloat]) -> CGFloat {
        candidates.min { abs($0 - value) < abs($1 - value) } ?? value
    }

    /// A settle that leaves at the finger's speed (pt/s). One per axis, each on its own `.offset(x:)` / `.offset(y:)`:
    /// a spring takes one velocity. SwiftUI's own velocity carry-over is unreliable; this always carries it.
    func settle(velocity: CGFloat, from current: CGFloat, to target: CGFloat, spring: Spring = PieceMotion.elastic) -> Animation {
        let spring = reduceMotion ? Spring(duration: 0.25, bounce: 0) : spring
        let distance = target - current
        guard abs(distance) >= 1 else { return .spring(spring) }
        // In whole distances per second, capped near the spring's frequency: a hard flick adds give, not a slingshot.
        // At exactly the frequency a critically damped spring cannot pass its target, so Reduce Motion stops there.
        let cap = 2 * Double.pi / spring.duration * (reduceMotion ? 1 : 1.5)
        let relative = min(max(Double(velocity / distance), -cap), cap)
        return .interpolatingSpring(spring, initialVelocity: relative)
    }
}

extension PieceMotion {
    /// A scroll view's edge resistance for a pull `overshoot` points past a limit; never reaches `limit`.
    /// About 24 to 40 for thumbs and toggles, 60 to 120 for cards and sheets. Band the total pull, not deltas.
    nonisolated static func rubberBand(_ overshoot: CGFloat, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard limit > 0, overshoot != 0 else { return 0 }
        let banded = (1 - 1 / (abs(overshoot) * coefficient / limit + 1)) * limit
        return overshoot < 0 ? -banded : banded
    }

    /// `value` inside `range` passes through unchanged; past either end it moves with rubber-band resistance.
    nonisolated static func rubberBand(_ value: CGFloat, in range: ClosedRange<CGFloat>, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        if value < range.lowerBound { return range.lowerBound + rubberBand(value - range.lowerBound, limit: limit, coefficient: coefficient) }
        if value > range.upperBound { return range.upperBound + rubberBand(value - range.upperBound, limit: limit, coefficient: coefficient) }
        return value
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
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress)

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

// swiftpieces-liquid: end
