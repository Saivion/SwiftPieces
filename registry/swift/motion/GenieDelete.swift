// swiftpieces:
// title: Genie Delete
// description: "Deleting pours a view into the button that deleted it, like the macOS genie: the bottom funnels in first, the sides narrow row by row and the rest follows in a curve. Undo pours it back out the same way. It draws a snapshot of your view in a Canvas, one thin row at a time, so it stays smooth for any content, and fades instead under Reduce Motion. For notes, drafts, files, cards and anything with an Undo."
// category: motion
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [delete, genie, trash, undo, remove, transition, canvas]

import SwiftUI

/// Timing for `GenieDelete`.
public struct GenieDeleteStyle: Sendable {
    /// How long the pour takes, in seconds.
    public var duration: Double
    /// How many rows the view is cut into. More rows make a smoother curve.
    public var rows: Int
    /// How narrow the view gets at the target, in points.
    public var neckWidth: CGFloat
    /// The view's corner radius, for the snapshot.
    public var cornerRadius: CGFloat

    public init(duration: Double = 0.62, rows: Int = 72, neckWidth: CGFloat = 10, cornerRadius: CGFloat = 20) {
        self.duration = duration
        self.rows = rows
        self.neckWidth = neckWidth
        self.cornerRadius = cornerRadius
    }

    public static let standard = GenieDeleteStyle()
}

/// Pours its content into a target when `isRemoved` turns on, and back out when it turns off.
///
/// The content keeps its place in the layout while it is gone; remove it from your data in `onRemoved` if
/// it shouldn't come back. Give the target its frame with `.genieTarget($frame)`.
///
/// - Parameters:
///   - isRemoved: Whether the content is poured away.
///   - target: The frame, in global coordinates, that the content pours into. Usually the delete button's.
///   - style: Timing and shape.
///   - onRemoved: Called once the content has poured away completely.
///   - content: The view to remove. It is drawn a second time, off screen, for the snapshot.
public struct GenieDelete<Content: View>: View {
    public typealias Style = GenieDeleteStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    @State private var progress: Double = 0
    @State private var snapshot: UIImage?
    @State private var frame: CGRect = .zero

    @Binding private var isRemoved: Bool
    private let target: CGRect
    private let style: Style
    private let onRemoved: () -> Void
    private let content: () -> Content

    public init(
        isRemoved: Binding<Bool>,
        into target: CGRect,
        style: Style = .standard,
        onRemoved: @escaping () -> Void = {},
        @ViewBuilder content: @escaping () -> Content
    ) {
        self._isRemoved = isRemoved
        self.target = target
        self.style = style
        self.onRemoved = onRemoved
        self.content = content
    }

    public var body: some View {
        let pouring = snapshot != nil && progress > 0
        content()
            .opacity(pouring || isRemoved ? 0 : 1)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame = $0 }
            .overlay(alignment: .topLeading) {
                if let snapshot, !reduceMotion {
                    let local = CGRect(x: target.midX - frame.minX, y: target.midY - frame.minY, width: 0, height: 0)
                    let bounds = CGRect(origin: .zero, size: frame.size).union(local).insetBy(dx: -4, dy: -4)
                    GenieCanvas(image: snapshot, progress: progress, size: frame.size, target: local, origin: bounds.origin, rows: style.rows, neck: style.neckWidth)
                        .frame(width: bounds.width, height: bounds.height)
                        .offset(x: bounds.minX, y: bounds.minY)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : nil, value: isRemoved)
            .onChange(of: isRemoved) { _, removed in pour(removed) }
    }

    @MainActor private func pour(_ removed: Bool) {
        if reduceMotion {
            if removed { onRemoved() }
            return
        }
        if removed || snapshot == nil {
            let renderer = ImageRenderer(content: content().frame(width: frame.width, height: frame.height).environment(\.colorScheme, colorScheme))
            renderer.scale = displayScale
            snapshot = renderer.uiImage
        }
        withAnimation(.timingCurve(0.5, 0, 0.3, 1, duration: style.duration)) {
            progress = removed ? 1 : 0
        } completion: {
            if removed { onRemoved() } else { snapshot = nil }
        }
    }
}

/// The snapshot, cut into rows that narrow and slide toward the target. Animates `progress`.
private struct GenieCanvas: View, Animatable {
    let image: UIImage
    var progress: Double
    let size: CGSize
    let target: CGRect
    let origin: CGPoint
    let rows: Int
    let neck: CGFloat

    nonisolated var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        Canvas { context, _ in
            guard progress > 0 else { return }
            context.translateBy(x: -origin.x, y: -origin.y)
            let resolved = context.resolve(Image(uiImage: image))
            let p = progress, count = max(rows, 8), rowHeight = size.height / CGFloat(count)
            let below = target.midY >= size.height / 2
            context.opacity = 1 - Self.smooth(0.82, 1, p)
            for row in 0..<count {
                let v = Double(row) / Double(count)
                // The edge nearest the target goes first; each row further away starts a little later.
                let lead = below ? 1 - v : v
                let narrow = Self.smooth(0, 1, min(max(p * 1.75 - lead * 0.75, 0), 1))
                let fall = pow(min(max(p * 1.5 - lead * 0.5, 0), 1), 2)
                let width = size.width + (neck - size.width) * narrow
                let centre = size.width / 2 + (target.midX - size.width / 2) * narrow
                let restY = CGFloat(row) * rowHeight
                let endY = target.midY + (CGFloat(v) - 0.5) * 6
                let y = restY + (endY - restY) * fall
                var strip = context
                strip.clip(to: Path(CGRect(x: centre - width / 2, y: y, width: width, height: rowHeight + 0.6)))
                strip.draw(resolved, in: CGRect(x: centre - width / 2, y: y - restY, width: width, height: size.height))
            }
        }
    }

    nonisolated private static func smooth(_ a: Double, _ b: Double, _ x: Double) -> Double {
        let t = min(max((x - a) / (b - a), 0), 1)
        return t * t * (3 - 2 * t)
    }
}

public extension View {
    /// Reports this view's global frame, so a `GenieDelete` can pour into it.
    func genieTarget(_ frame: Binding<CGRect>) -> some View {
        onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame.wrappedValue = $0 }
    }
}

// MARK: - Example

/// A note with a delete button under it. Delete pours the note into the button; Undo pours it back.
private struct GenieDeleteExample: View {
    @State private var deleted = false
    @State private var trash: CGRect = .zero
    @State private var gulps = 0

    var body: some View {
        VStack(spacing: 40) {
            GenieDelete(isRemoved: $deleted, into: trash, onRemoved: { gulps += 1 }) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Packing list").font(.headline.weight(.semibold))
                    ForEach(["Tent and stakes", "Two sleeping bags", "Kayak paddles", "Sunscreen"], id: \.self) { item in
                        Label(item, systemImage: "circle")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(20)
                .frame(width: 260, alignment: .leading)
                .background(Color(UIColor.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20, style: .continuous))
            }
            Button {
                deleted.toggle()
            } label: {
                Image(systemName: deleted ? "arrow.uturn.backward" : "trash")
                    .font(.title3.weight(.semibold))
                    .contentTransition(.symbolEffect(.replace))
                    .symbolEffect(.bounce, value: gulps)
                    .frame(width: 56, height: 56)
                    .background(Color(UIColor.secondarySystemGroupedBackground), in: .circle)
            }
            .buttonStyle(.plain)
            .genieTarget($trash)
            .accessibilityLabel(deleted ? "Undo" : "Delete")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

#Preview("Light") {
    GenieDeleteExample()
}

#Preview("Dark") {
    GenieDeleteExample()
        .preferredColorScheme(.dark)
}
