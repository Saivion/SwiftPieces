// swiftpieces:
// title: Drag to Dismiss
// description: A modifier that lets a photo, card, or sheet follow a two-axis drag, rounds and shrinks it with progress over a styled scrim, reports its phase so the UI can say "release to close", then springs back or flies off along the drag vector past a distance or velocity threshold.
// category: motion
// pro: depth-gallery
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [dismiss, drag, gesture, sheet, photos, modifier, haptics]

import SwiftUI

/// Photos-style dismiss: drag in any direction, the view rounds and shrinks as it travels, the scrim thins,
/// and a far enough drag or a fast flick sends it off screen along the direction it was moving.
///
/// - Parameters:
///   - threshold: Drag distance in points that arms the dismiss. A flick whose projected travel passes twice this commits from a shorter drag.
///   - cornerRadius: Corner radius the view reaches at full progress; it starts square so full-screen content keeps its edges at rest.
///   - progress: Optional binding that receives the dismiss progress (0 at rest, 1 armed) so the presenter can scale its background from 0.94 back to 1.
///   - scrollOffset: Vertical offset of a scroll view inside the content. The drag is only captured at 0. On iOS 18 the modifier observes the inner scroll view itself.
///   - phase: Optional binding that receives the current phase (idle, dragging, armed, returning, committing), for a "Release to close" hint or to dim chrome while dragging.
///   - style: Scrim color and opacity at rest, and how much the view shrinks at full progress. `.standard` is a near-black `#141414` scrim at 0.5 with a 0.15 shrink.
///   - onDismiss: Called once the view has flown off; end the presentation here.
public extension View {
    func dragToDismiss(
        threshold: CGFloat = 110,
        cornerRadius: CGFloat = 28,
        progress: Binding<CGFloat>? = nil,
        scrollOffset: CGFloat = 0,
        phase: Binding<DragToDismiss.Phase>? = nil,
        style: DragToDismiss.Style = .standard,
        onDismiss: @escaping () -> Void
    ) -> some View {
        modifier(DragToDismiss(threshold: threshold, cornerRadius: cornerRadius, progress: progress, scrollOffset: scrollOffset, phase: phase, style: style, onDismiss: onDismiss))
    }
}

/// Two-axis drag with a five-phase state machine; the fly-off distance and duration come from the release velocity.
public struct DragToDismiss: ViewModifier {
    public enum Phase: Sendable { case idle, dragging, armed, returning, committing }

    /// How the scrim and the traveling view look.
    public struct Style: Sendable {
        /// Scrim color behind the view.
        public var scrim: Color
        /// Scrim opacity at rest; it thins to zero with progress.
        public var scrimOpacity: Double
        /// Fraction the view shrinks by at full progress, 0–0.5.
        public var shrink: CGFloat

        public init(scrim: Color = Color(red: 20 / 255, green: 20 / 255, blue: 20 / 255), scrimOpacity: Double = 0.5, shrink: CGFloat = 0.15) {
            self.scrim = scrim
            self.scrimOpacity = scrimOpacity
            self.shrink = shrink
        }

        /// Near-black `#141414` scrim at 0.5, 0.15 shrink.
        public static let standard = Style()
        /// No scrim, for cards that sit over live content.
        public static let clear = Style(scrimOpacity: 0)
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: Phase = .idle
    @State private var translation: CGSize = .zero
    @State private var containerSize = CGSize(width: 390, height: 844)
    @State private var observedScrollOffset: CGFloat = 0
    @State private var hasScrollView = false
    @State private var yielded = false

    private let threshold: CGFloat
    private let cornerRadius: CGFloat
    private let progressBinding: Binding<CGFloat>?
    private let scrollOffset: CGFloat
    private let phaseBinding: Binding<Phase>?
    private let style: Style
    private let onDismiss: () -> Void

    public init(
        threshold: CGFloat = 110,
        cornerRadius: CGFloat = 28,
        progress: Binding<CGFloat>? = nil,
        scrollOffset: CGFloat = 0,
        phase: Binding<Phase>? = nil,
        style: Style = .standard,
        onDismiss: @escaping () -> Void
    ) {
        self.phaseBinding = phase
        self.style = style
        self.threshold = threshold
        self.cornerRadius = cornerRadius
        self.progressBinding = progress
        self.scrollOffset = scrollOffset
        self.onDismiss = onDismiss
    }

    private var distance: CGFloat { hypot(translation.width, translation.height) }
    private var progress: CGFloat { phase == .committing ? 1 : min(1, distance / threshold) }
    private var atTop: Bool { scrollOffset <= 0.5 && observedScrollOffset <= 0.5 }

    public func body(content: Content) -> some View {
        let dragging = phase == .dragging || phase == .armed
        content
            .scrollDisabled(dragging)
            .modifier(ScrollObserver(offset: $observedScrollOffset, seen: $hasScrollView))
            .clipShape(.rect(cornerRadius: cornerRadius * progress, style: .continuous))
            .scaleEffect(reduceMotion ? 1 : 1 - min(max(style.shrink, 0), 0.5) * progress)
            .offset(translation)
            .opacity(phase == .committing ? 0 : 1)
            .background {
                // Sits in the layout frame, so it stays put while the content travels.
                style.scrim
                    .opacity(style.scrimOpacity * (1 - progress))
                    .ignoresSafeArea()
            }
            .background {
                GeometryReader { proxy in
                    Color.clear.onAppear { containerSize = proxy.size }
                        .onChange(of: proxy.size) { _, size in containerSize = size }
                }
            }
            .simultaneousGesture(drag)
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: phase) { _, new in new == .armed }
            .onChange(of: progress) { _, new in progressBinding?.wrappedValue = new }
            .onChange(of: phase) { _, new in phaseBinding?.wrappedValue = new }
            .accessibilityAction(.escape) { commit(toward: CGSize(width: 0, height: 1), speed: 0) }
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .local)
            .onChanged { value in
                guard phase != .committing else { return }
                if phase == .idle || phase == .returning {
                    // Decide once per gesture whether this drag belongs to an inner scroll view.
                    let upward = value.translation.height < 0 && abs(value.translation.height) > abs(value.translation.width)
                    yielded = !atTop || (hasScrollView && upward)
                    if yielded { return }
                }
                guard !yielded else { return }
                translation = value.translation
                let armed = distance > threshold
                withAnimation(.interactiveSpring(duration: 0.15)) { phase = armed ? .armed : .dragging }
            }
            .onEnded { value in
                defer { yielded = false }
                guard !yielded, phase == .dragging || phase == .armed else { return }
                let predicted = value.predictedEndTranslation
                let flick = CGSize(width: predicted.width - translation.width, height: predicted.height - translation.height)
                let projected = hypot(predicted.width, predicted.height)
                if distance > threshold || projected > threshold * 2 {
                    let speed = hypot(flick.width, flick.height)
                    let direction = speed > 40 ? flick : translation
                    commit(toward: direction, speed: speed)
                } else {
                    phase = .returning
                    withAnimation(.spring(duration: reduceMotion ? 0.2 : 0.45, bounce: reduceMotion ? 0 : 0.28)) {
                        translation = .zero
                    } completion: {
                        if phase == .returning { phase = .idle }
                    }
                }
            }
    }

    /// Flies off along `direction`, far enough to clear the container; faster flicks get shorter animations.
    private func commit(toward direction: CGSize, speed: CGFloat) {
        let length = max(hypot(direction.width, direction.height), 1)
        let unit = CGSize(width: direction.width / length, height: direction.height / length)
        let exit = hypot(containerSize.width, containerSize.height) * 1.1
        let travel = max(exit, speed * 1.5)
        let end = CGSize(width: translation.width + unit.width * travel, height: translation.height + unit.height * travel)
        // predictedEndTranslation assumes ~0.25 s of deceleration, so speed / 0.25 is points per second.
        let duration = reduceMotion ? 0.2 : min(0.45, max(0.22, travel / max(speed * 4, 1)))
        withAnimation(.spring(duration: duration, bounce: 0), completionCriteria: .logicallyComplete) {
            phase = .committing
            translation = end
        } completion: {
            onDismiss()
        }
    }

    /// iOS 18 reads the inner scroll view directly; earlier systems rely on the `scrollOffset` parameter.
    private struct ScrollObserver: ViewModifier {
        @Binding var offset: CGFloat
        @Binding var seen: Bool

        func body(content: Content) -> some View {
            if #available(iOS 18, *) {
                content.onScrollGeometryChange(for: CGFloat.self) { geometry in
                    geometry.contentOffset.y + geometry.contentInsets.top
                } action: { _, new in
                    seen = true
                    offset = new
                }
            } else {
                content
            }
        }
    }
}

// MARK: - Example

private func dragColor(_ hex: UInt32) -> Color {
    Color(uiColor: dragUIColor(hex))
}

/// A color that resolves to `light` or `dark` with the current appearance.
private func dragColor(light: UInt32, dark: UInt32) -> Color {
    let l = dragUIColor(light), d = dragUIColor(dark)
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

private func dragUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

/// The card the modifier moves, and nothing else. Drag it anywhere: it rounds and shrinks as it travels, the modifier's
/// own scrim thins with it, and a far drag or a fast flick sends it off along the drag. It returns so it can be tried again.
private struct DragToDismissExample: View {
    @State private var shown = true

    var body: some View {
        ZStack {
            if shown {
                Self.pass
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .dragToDismiss(cornerRadius: 40) { shown = false }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(dragColor(light: 0xF3F2EE, dark: 0x121212))
        .ignoresSafeArea()
        .task(id: shown) {
            guard !shown else { return }
            try? await Task.sleep(for: .seconds(0.9))
            withAnimation(.smooth(duration: 0.35)) { shown = true }
        }
    }

    /// A butter boarding pass with the route as a heavy headline and times as light numerals.
    static var pass: some View {
        let ink = dragColor(0x141414)
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("BOARDING PASS")
                    .font(.caption.weight(.bold))
                    .tracking(1)
                Spacer()
                Text("Group 2")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(dragColor(0x9CC2FF), in: .capsule)
            }
            Text("SFO\n\(Text("to LIS").foregroundStyle(ink.opacity(0.55)))")
                .font(.system(size: 56, weight: .bold))
                .tracking(-2.4)
                .padding(.top, 28)
            HStack(alignment: .firstTextBaseline, spacing: 28) {
                field("DEPARTS", "07:45")
                field("GATE", "B12")
                field("SEAT", "14A")
            }
            .padding(.top, 28)
            Rectangle()
                .fill(ink.opacity(0.14))
                .frame(height: 1.5)
                .padding(.vertical, 22)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Maya Lindqvist").font(.headline)
                    Text("Flight SP 208 · Boards 07:10").font(.subheadline).opacity(0.62)
                }
                Spacer()
                Image(systemName: "qrcode")
                    .font(.system(size: 40))
            }
        }
        .foregroundStyle(ink)
        .padding(24)
        .frame(width: 330)
        .background(dragColor(0xFFD976), in: .rect(cornerRadius: 34, style: .continuous))
        .shadow(color: .black.opacity(0.28), radius: 30, y: 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Boarding pass, San Francisco to Lisbon, departs 7:45, gate B12, seat 14A")
        .accessibilityHint("Drag or use the escape gesture to close")
    }

    private static func field(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2.weight(.bold)).tracking(1).opacity(0.6)
            Text(value).font(.system(size: 30, weight: .light)).monospacedDigit().tracking(-0.8)
        }
    }
}

#Preview("Light") {
    DragToDismissExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    DragToDismissExample().preferredColorScheme(.dark)
}
