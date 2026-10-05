// swiftpieces:
// title: Drag Select Grid
// description: A multi-select photo and file grid where one drag paints a whole reading-order range the way the system photo library does, a sideways drag or a short hold starts painting while vertical swipes still scroll, dragging back unpaints, starting on a selected item deselects, the grid auto-scrolls faster the deeper the finger sits in the top or bottom edge, and selected cells inset under a check badge with a haptic tick per item.
// category: lists
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// tags: [selection, multi-select, grid, photos, drag-to-select, gesture, auto-scroll, haptics]

import SwiftUI
import UIKit

/// A scrolling grid of `Identifiable` items with drag-to-select: photos, files, attachments, media.
///
/// In selection mode a sideways drag (or a short hold, then any direction) paints every item from
/// the first one touched to the one under the finger, in reading order. Dragging back unpaints.
/// Starting on a selected item deselects instead. A vertical swipe still scrolls, and holding the
/// finger near the top or bottom edge scrolls the grid while painting. Tap toggles one item.
///
/// - Parameters:
///   - items: The items, in reading order. When items disappear, their IDs are dropped from `selection`.
///   - selection: The selected IDs. Painting and taps write here; set it yourself for Select All or Clear.
///   - isSelecting: Selection mode. While `false`, cells behave like your content (taps reach your buttons and links) and painting is off. Turning it off keeps `selection`; clear it yourself if you want to.
///   - minimumCellWidth: The narrowest a cell may be. The column count is the most that fit at this width, so it adapts to rotation, iPad and split view.
///   - aspectRatio: Cell width divided by height. `1` is square; `0.75` suits portrait posters or documents.
///   - longPressToSelect: When `true`, holding a cell outside selection mode turns selection mode on, selects that cell and keeps painting as the finger moves. Pass `false` if your cells have their own context menu.
///   - style: Spacing, corner radius, the selected inset, badge colors and auto-scroll tuning. Defaults to the SwiftPieces house palette.
///   - cell: Builds a cell's content from the item and whether it is selected. It fills the cell and is clipped to the cell's rounded shape; the grid draws the badge and inset.
public struct DragSelectGrid<Item: Identifiable, Cell: View>: View {
    /// Look and feel. `.standard` is the house palette. The same type as `DragSelectGridStyle`, so `.init(spacing: 2)` works at the call site.
    public typealias Style = DragSelectGridStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 24
    @Binding private var selection: Set<Item.ID>
    @Binding private var isSelecting: Bool
    @State private var width: CGFloat = 0
    @State private var session: Session?
    @State private var startTick = 0
    @State private var stepTick = 0
    @State private var tapTick = 0

    private let items: [Item]
    private let minimumCellWidth: CGFloat
    private let aspectRatio: CGFloat
    private let longPressToSelect: Bool
    private let style: Style
    private let cell: (Item, Bool) -> Cell

    /// One drag: where it started, where the finger is, whether it adds or removes, and the selection before it.
    private struct Session {
        var anchor: Int
        var current: Int
        var selects: Bool
        var base: Set<Item.ID>
    }

    public init(_ items: [Item], selection: Binding<Set<Item.ID>>, isSelecting: Binding<Bool>, minimumCellWidth: CGFloat = 96, aspectRatio: CGFloat = 1, longPressToSelect: Bool = true, style: Style = .standard, @ViewBuilder cell: @escaping (Item, Bool) -> Cell) {
        self.items = items
        self._selection = selection
        self._isSelecting = isSelecting
        self.minimumCellWidth = max(minimumCellWidth, 44)
        self.aspectRatio = aspectRatio > 0 ? aspectRatio : 1
        self.longPressToSelect = longPressToSelect
        self.style = style
        self.cell = cell
    }

    private var columns: Int {
        guard width > 0 else { return 1 }
        return max(1, Int((width + style.spacing) / (minimumCellWidth + style.spacing)))
    }

    private var cellSize: CGSize {
        let w = max(0, (width - style.spacing * CGFloat(columns - 1)) / CGFloat(columns))
        return CGSize(width: w, height: w / aspectRatio)
    }

    public var body: some View {
        let columns = self.columns
        ScrollView {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: style.spacing), count: columns), spacing: style.spacing) {
                ForEach(items) { item in
                    cellView(item)
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .opacity(width > 0 ? 1 : 0)
            .background {
                PaintSurface(
                    metrics: .init(columns: columns, cellSize: cellSize, spacing: style.spacing, count: items.count, isRightToLeft: layoutDirection == .rightToLeft),
                    allowsSwipe: isEnabled && isSelecting,
                    allowsHold: isEnabled && (isSelecting || longPressToSelect),
                    holdDuration: isSelecting ? 0.25 : 0.45,
                    edgeZone: style.edgeZone,
                    speed: style.autoscrollSpeed,
                    onBegin: begin(at:),
                    onMove: move(to:tick:),
                    onEnd: end
                )
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: startTick)
        .sensoryFeedback(.selection, trigger: stepTick)
        .sensoryFeedback(.selection, trigger: tapTick)
        .animation(reduceMotion ? .easeOut(duration: 0.15) : .smooth(duration: 0.22), value: isSelecting)
        .onChange(of: isSelecting) { _, selecting in
            if !selecting { session = nil }
        }
        .onChange(of: items.map(\.id)) { _, ids in
            session = nil
            let present = Set(ids)
            let kept = selection.filter(present.contains)
            if kept.count != selection.count { selection = kept }
        }
    }

    // MARK: Cell

    private func cellView(_ item: Item) -> some View {
        let isSelected = selection.contains(item.id)
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        let badge = min(badgeSize, 34, cellSize.width * 0.34)
        return Color.clear
            .aspectRatio(aspectRatio, contentMode: .fit)
            .overlay {
                cell(item, isSelected)
                    .allowsHitTesting(!isSelecting)
            }
            .overlay(alignment: .bottomTrailing) {
                checkBadge(isSelected: isSelected, size: badge)
                    // Counter the inset so the badge keeps one size whether the cell is selected or not.
                    .scaleEffect(isSelected ? 1 / style.selectedScale : 1, anchor: .bottomTrailing)
                    .padding(max(4, badge * 0.25))
            }
            .clipShape(shape)
            .contentShape(shape)
            .scaleEffect(isSelected ? style.selectedScale : 1)
            .animation(reduceMotion ? .easeOut(duration: 0.12) : .spring(duration: 0.3, bounce: 0.32), value: isSelected)
            .gesture(TapGesture().onEnded { toggle(item.id) }, including: isSelecting ? .all : .subviews)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(isSelected ? .isSelected : [])
            .accessibilityAddTraits(isSelecting ? .isButton : [])
            .accessibilityHint(isSelecting ? (isSelected ? Text("Double-tap to deselect.") : Text("Double-tap to select.")) : Text(""))
            .accessibilityActions {
                if isSelected {
                    Button("Deselect") { toggle(item.id) }
                } else {
                    Button("Select") {
                        if !isSelecting { isSelecting = true }
                        toggle(item.id)
                    }
                }
            }
    }

    @ViewBuilder
    private func checkBadge(isSelected: Bool, size: CGFloat) -> some View {
        ZStack {
            if isSelected {
                Circle().fill(style.badge)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.46, weight: .bold))
                    .foregroundStyle(style.badgeInk)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.3).combined(with: .opacity))
            } else {
                Circle().fill(.black.opacity(0.16))
            }
        }
        .frame(width: size, height: size)
        .overlay { Circle().strokeBorder(style.ring, lineWidth: max(1.5, size / 14)) }
        .shadow(color: .black.opacity(0.28), radius: 2, y: 1)
        .opacity(isSelecting || isSelected ? 1 : 0)
        .accessibilityHidden(true)
    }

    // MARK: Selection

    private func toggle(_ id: Item.ID) {
        guard session == nil else { return }
        if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
        tapTick += 1
    }

    private func begin(at index: Int) {
        guard items.indices.contains(index) else { return }
        if !isSelecting { isSelecting = true }
        let selects = !selection.contains(items[index].id)
        session = Session(anchor: index, current: index, selects: selects, base: selection)
        apply()
        startTick += 1
    }

    private func move(to index: Int, tick: Bool) {
        guard var current = session, index != current.current, items.indices.contains(index) else { return }
        current.current = index
        session = current
        apply()
        if tick { stepTick += 1 }
    }

    /// The selection is always the snapshot from the start of the drag with the current range applied,
    /// so dragging back past an item restores what it was before.
    private func apply() {
        guard let session, items.indices.contains(session.anchor), items.indices.contains(session.current) else { return }
        var next = session.base
        for item in items[min(session.anchor, session.current)...max(session.anchor, session.current)] {
            if session.selects { next.insert(item.id) } else { next.remove(item.id) }
        }
        if next != selection { selection = next }
    }

    private func end() {
        guard let finished = session else { return }
        session = nil
        if selection != finished.base {
            AccessibilityNotification.Announcement(String(localized: "\(selection.count) selected")).post()
        }
    }
}

/// Look and feel of a `DragSelectGrid`. `.standard` is the house palette.
public struct DragSelectGridStyle: Sendable {
    /// Gap between cells, both ways.
    public var spacing: CGFloat
    /// Cell corner radius.
    public var cornerRadius: CGFloat
    /// How far a selected cell shrinks inside its slot (1 means no inset).
    public var selectedScale: CGFloat
    /// Fill of the check badge on a selected cell.
    public var badge: Color
    /// The check glyph on the badge.
    public var badgeInk: Color
    /// The badge ring, and the empty circle on unselected cells in selection mode. Light, so it reads on any thumbnail.
    public var ring: Color
    /// Height of the band at the top and bottom edges where painting auto-scrolls.
    public var edgeZone: CGFloat
    /// Auto-scroll speed in points per second with the finger at (or past) the very edge. It scales down linearly with depth into the band.
    public var autoscrollSpeed: CGFloat

    /// Pass only what you want to change; `nil` keeps the house value.
    public init(spacing: CGFloat = 4, cornerRadius: CGFloat = 12, selectedScale: CGFloat = 0.86, badge: Color? = nil, badgeInk: Color? = nil, ring: Color? = nil, edgeZone: CGFloat = 72, autoscrollSpeed: CGFloat = 1200) {
        self.spacing = max(spacing, 0)
        self.cornerRadius = max(cornerRadius, 0)
        self.selectedScale = min(max(selectedScale, 0.6), 1)
        self.badge = badge ?? Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255)
        self.badgeInk = badgeInk ?? Color(red: 0xF4 / 255, green: 0xF3 / 255, blue: 0xEF / 255)
        self.ring = ring ?? .white
        self.edgeZone = max(edgeZone, 24)
        self.autoscrollSpeed = max(autoscrollSpeed, 0)
    }

    public static let standard = DragSelectGridStyle()
}

// MARK: - Painting gesture

/// Cell geometry the gesture needs to turn a point into an index without asking SwiftUI for frames
/// (a lazy grid has no frames for rows that are off screen, and auto-scroll paints through them).
private struct PaintMetrics: Equatable {
    var columns: Int
    var cellSize: CGSize
    var spacing: CGFloat
    var count: Int
    var isRightToLeft: Bool
}

/// An invisible view behind the grid. Once it is in a window it finds the enclosing scroll view
/// (SwiftUI's `ScrollView` is a `UIScrollView`) and installs the painting recognizer on it, so the
/// recognizer can tell the scroll view's own pan to wait for its decision.
private struct PaintSurface: UIViewRepresentable {
    var metrics: PaintMetrics
    var allowsSwipe: Bool
    var allowsHold: Bool
    var holdDuration: TimeInterval
    var edgeZone: CGFloat
    var speed: CGFloat
    var onBegin: (Int) -> Void
    var onMove: (Int, Bool) -> Void
    var onEnd: () -> Void

    func makeCoordinator() -> PaintController { PaintController() }

    func makeUIView(context: Context) -> PaintAnchorView {
        let view = PaintAnchorView()
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        view.controller = context.coordinator
        context.coordinator.anchor = view
        return view
    }

    func updateUIView(_ view: PaintAnchorView, context: Context) {
        let controller = context.coordinator
        controller.metrics = metrics
        controller.edgeZone = edgeZone
        controller.speed = speed
        controller.onBegin = onBegin
        controller.onMove = onMove
        controller.onEnd = onEnd
        controller.recognizer.allowsSwipe = allowsSwipe
        controller.recognizer.allowsHold = allowsHold
        controller.recognizer.holdDuration = holdDuration
        controller.recognizer.isEnabled = allowsSwipe || allowsHold
    }

    static func dismantleUIView(_ view: PaintAnchorView, coordinator: PaintController) {
        coordinator.attach(to: nil)
    }
}

private final class PaintAnchorView: UIView {
    weak var controller: PaintController?

    override func didMoveToWindow() {
        super.didMoveToWindow()
        controller?.attach(to: window == nil ? nil : enclosingScrollView)
    }

    private var enclosingScrollView: UIScrollView? {
        var view = superview
        while let current = view {
            if let scrollView = current as? UIScrollView { return scrollView }
            view = current.superview
        }
        return nil
    }
}

/// Drives one paint: maps the finger to an index, reports changes, and auto-scrolls near the edges.
@MainActor
private final class PaintController: NSObject {
    let recognizer = PaintRecognizer()
    weak var anchor: UIView?
    private weak var scrollView: UIScrollView?
    var metrics = PaintMetrics(columns: 1, cellSize: .zero, spacing: 0, count: 0, isRightToLeft: false)
    var edgeZone: CGFloat = 72
    var speed: CGFloat = 1200
    var onBegin: ((Int) -> Void)?
    var onMove: ((Int, Bool) -> Void)?
    var onEnd: (() -> Void)?

    private var link: CADisplayLink?
    private var lastIndex: Int?
    private var lastTick: CFTimeInterval = 0
    private var lastFrame: CFTimeInterval = 0

    override init() {
        super.init()
        recognizer.addTarget(self, action: #selector(handle(_:)))
    }

    func attach(to newScrollView: UIScrollView?) {
        guard newScrollView !== scrollView else { return }
        scrollView?.removeGestureRecognizer(recognizer)
        stop()
        scrollView = newScrollView
        newScrollView?.addGestureRecognizer(recognizer)
    }

    @objc private func handle(_ recognizer: PaintRecognizer) {
        switch recognizer.state {
        case .began:
            guard let index = index(at: recognizer.location(in: anchor)) else { return }
            // Stop a fling in progress so the grid holds still under the finger.
            if let scrollView { scrollView.setContentOffset(scrollView.contentOffset, animated: false) }
            lastIndex = index
            lastTick = CACurrentMediaTime()
            onBegin?(index)
            startLink()
        case .changed:
            update()
        default:
            stop()
        }
    }

    private func stop() {
        link?.invalidate()
        link = nil
        lastFrame = 0
        if lastIndex != nil {
            lastIndex = nil
            onEnd?()
        }
    }

    private func update() {
        guard lastIndex != nil, let index = index(at: recognizer.location(in: anchor)), index != lastIndex else { return }
        lastIndex = index
        // One tick per item crossed, but never faster than about 22 a second, so a fast
        // drag or auto-scroll through many rows reads as texture rather than a buzz.
        let now = CACurrentMediaTime()
        let tick = now - lastTick > 0.045
        if tick { lastTick = now }
        onMove?(index, tick)
    }

    /// Reading-order index under a point in the grid's own coordinates. Points in a gutter or past
    /// an edge snap to the nearest cell; points past the last item snap to the last item.
    private func index(at point: CGPoint) -> Int? {
        let m = metrics
        guard m.count > 0, m.columns > 0, m.cellSize.width > 0, m.cellSize.height > 0 else { return nil }
        let pitchX = m.cellSize.width + m.spacing
        let pitchY = m.cellSize.height + m.spacing
        let rows = (m.count + m.columns - 1) / m.columns
        let x = m.isRightToLeft ? (anchor?.bounds.width ?? 0) - point.x : point.x
        let column = min(max(Int(((x + m.spacing / 2) / pitchX).rounded(.down)), 0), m.columns - 1)
        let row = min(max(Int(((point.y + m.spacing / 2) / pitchY).rounded(.down)), 0), rows - 1)
        return min(row * m.columns + column, m.count - 1)
    }

    private func startLink() {
        link?.invalidate()
        let link = CADisplayLink(target: self, selector: #selector(step(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    /// Auto-scroll: speed grows linearly with how deep the finger sits in the edge band.
    @objc private func step(_ link: CADisplayLink) {
        guard let scrollView, lastIndex != nil else { return }
        let dt = lastFrame == 0 ? link.duration : min(max(link.timestamp - lastFrame, 0), 0.05)
        lastFrame = link.timestamp
        let insets = scrollView.adjustedContentInset
        let top = insets.top
        let bottom = scrollView.bounds.height - insets.bottom
        let zone = min(edgeZone, max((bottom - top) / 4, 1))
        let y = recognizer.location(in: scrollView).y - scrollView.contentOffset.y
        var velocity: CGFloat = 0
        if y < top + zone { velocity = -speed * min(1, (top + zone - y) / zone) }
        else if y > bottom - zone { velocity = speed * min(1, (y - (bottom - zone)) / zone) }
        guard velocity != 0 else { return }
        let minY = -insets.top
        let maxY = max(minY, scrollView.contentSize.height - scrollView.bounds.height + insets.bottom)
        let next = min(max(scrollView.contentOffset.y + velocity * dt, minY), maxY)
        guard abs(next - scrollView.contentOffset.y) > 0.01 else { return }
        scrollView.contentOffset.y = next
        update()
    }
}

/// Decides between painting and scrolling within the first few points of movement.
///
/// It begins on a mostly horizontal drag (when `allowsSwipe`) or after the finger has held still for
/// `holdDuration` (when `allowsHold`), and fails on anything else, which hands the touch to the scroll
/// view. The scroll view's pan waits for that decision, so the two never both move.
private final class PaintRecognizer: UIGestureRecognizer {
    var allowsSwipe = false
    var allowsHold = false
    var holdDuration: TimeInterval = 0.25
    private var start: CGPoint = .zero
    private var holdTask: Task<Void, Never>?

    /// Movement (in points) before the direction is judged.
    private let slop: CGFloat = 8

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        guard state == .possible else { return }
        guard numberOfTouches == 1, let touch = touches.first else {
            fail()
            return
        }
        start = touch.location(in: nil)
        guard allowsHold else { return }
        let delay = holdDuration
        holdTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled, let self, self.state == .possible, self.numberOfTouches == 1 else { return }
            self.state = .began
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)
        switch state {
        case .possible:
            guard let touch = touches.first else { return }
            let p = touch.location(in: nil)
            let dx = p.x - start.x, dy = p.y - start.y
            guard hypot(dx, dy) >= slop else { return }
            // Within about 40 degrees of horizontal paints; anything steeper scrolls.
            if allowsSwipe, abs(dx) > abs(dy) * 1.2 {
                holdTask?.cancel()
                state = .began
            } else {
                fail()
            }
        case .began, .changed:
            state = .changed
        default:
            break
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesEnded(touches, with: event)
        if state == .began || state == .changed { state = .ended } else { fail() }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesCancelled(touches, with: event)
        if state == .began || state == .changed { state = .cancelled } else { fail() }
    }

    override func reset() {
        super.reset()
        holdTask?.cancel()
        holdTask = nil
    }

    /// The pans of the grid's scroll view and of any scroll view around it (a screen-level `ScrollView`)
    /// wait until this recognizer fails, so a paint never drags an outer scroll view along.
    override func shouldBeRequiredToFail(by otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        if let view, let scrollView = otherGestureRecognizer.view as? UIScrollView,
           otherGestureRecognizer === scrollView.panGestureRecognizer, view.isDescendant(of: scrollView) {
            return true
        }
        return super.shouldBeRequiredToFail(by: otherGestureRecognizer)
    }

    private func fail() {
        holdTask?.cancel()
        if state == .possible { state = .failed }
    }
}

// MARK: - Example

/// A sample library item: a solid block standing in for a thumbnail.
private struct DragSelectGridSample: Identifiable {
    let id: Int
    let tint: Color
    let symbol: String

    static let all: [DragSelectGridSample] = {
        let tints: [UInt32] = [0xFF0000, 0x9CC2FF, 0xFFD976, 0xA9DCB7, 0xCDB8FF, 0xE9D5B3]
        let symbols = ["mountain.2", "sun.max", "leaf", "moon.stars", "cup.and.saucer", "tram", "fish", "camera.macro"]
        return (0..<120).map { i in
            let hex = tints[(i * 7 + i / 5) % tints.count]
            return DragSelectGridSample(
                id: i,
                tint: Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255),
                symbol: symbols[(i * 5) % symbols.count]
            )
        }
    }()
}

private struct DragSelectGridExample: View {
    @State private var selection: Set<Int> = [3, 4, 5, 9]
    @State private var isSelecting = true

    var body: some View {
        DragSelectGrid(DragSelectGridSample.all, selection: $selection, isSelecting: $isSelecting) { item, _ in
            ZStack {
                item.tint
                Image(systemName: item.symbol)
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255).opacity(0.72))
            }
            .accessibilityLabel("Photo \(item.id + 1)")
        }
        .contentMargins(.horizontal, 12, for: .scrollContent)
    }
}

#Preview("Light") {
    DragSelectGridExample()
}

#Preview("Dark") {
    DragSelectGridExample()
        .preferredColorScheme(.dark)
}
