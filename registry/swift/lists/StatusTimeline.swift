// swiftpieces:
// title: Status Timeline
// description: A vertical status timeline where the live step becomes a solid color block, connectors draw in as steps complete, nodes morph from number to check, the current node breathes, and any step expands to show its detail.
// category: lists
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [timeline, status, tracking, progress, steps, blocks]

import SwiftUI
import UIKit

/// Vertical timeline for order tracking, delivery, or verification flows.
///
/// - Parameters:
///   - steps: Steps in order, each with a title, optional detail and timestamp, and a status.
///   - tint: Block color for the current step and completed nodes. `nil` uses `style.current` and `style.complete`.
///   - expandsCurrent: Start with the current step expanded.
///   - style: Block colors, text colors, connector and surface. Defaults to the house palette.
public struct StatusTimeline: View {
    public enum Status: Equatable { case pending, current, complete, failed }

    /// One step on the timeline.
    public struct Step: Identifiable {
        public let id: String
        public let title: String
        public let detail: String?
        public let timestamp: String?
        public let status: Status

        public init(_ title: String, detail: String? = nil, timestamp: String? = nil, status: Status = .pending) {
            self.id = title
            self.title = title
            self.detail = detail
            self.timestamp = timestamp
            self.status = status
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var expanded: String? = nil
    @State private var completed = 0

    private let steps: [Step]
    private let tint: Color?
    private let expandsCurrent: Bool
    private let style: Style

    private let node: CGFloat = 30
    private let column: CGFloat = 44

    public init(steps: [Step], tint: Color? = nil, expandsCurrent: Bool = true, style: Style = .standard) {
        self.steps = steps
        self.tint = tint
        self.expandsCurrent = expandsCurrent
        self.style = style
    }

    private var spring: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.15) }
    private var currentBlock: Color { tint ?? style.current }
    private var completeBlock: Color { tint ?? style.complete }

    public var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                row(step, at: index)
            }
        }
        .animation(.easeInOut(duration: 0.45), value: completedCount)
        .animation(spring, value: statuses)
        .onAppear {
            completed = completedCount
            if expandsCurrent, expanded == nil { expanded = steps.first { $0.status == .current }?.id }
        }
        .onChange(of: completedCount) { _, count in advance(to: count) }
        .sensoryFeedback(.success, trigger: completed) { old, new in new > old }
        .sensoryFeedback(.error, trigger: failedCount) { old, new in new > old }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Status timeline")
        .accessibilityValue("\(completedCount) of \(steps.count) complete")
    }

    private var statuses: [Status] { steps.map { $0.status } }

    /// The live step moved on: follow it with the expanded detail.
    private func advance(to count: Int) {
        completed = count
        guard expandsCurrent else { return }
        let next: String? = steps.first(where: { $0.status == .current })?.id
        withAnimation(spring) { expanded = next }
    }

    private var completedCount: Int { steps.filter { $0.status == .complete }.count }
    private var failedCount: Int { steps.filter { $0.status == .failed }.count }

    // MARK: Row

    private func row(_ step: Step, at index: Int) -> some View {
        let isLast = index == steps.count - 1
        let isExpanded = expanded == step.id && step.detail != nil
        let isCurrent = step.status == .current
        let isFailed = step.status == .failed
        let block: Color? = isCurrent ? currentBlock : isFailed ? style.failed : nil
        let ink = block == nil ? (step.status == .pending ? style.muted : style.text) : style.ink

        return HStack(alignment: .top, spacing: 6) {
            VStack(spacing: 0) {
                nodeView(step, number: index + 1)
                    .padding(.top, 9)
                if !isLast {
                    connector(after: step)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: column)

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(step.title)
                        .font(.body.weight(block == nil ? (step.status == .complete ? .medium : .regular) : .semibold))
                        .foregroundStyle(ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    if let timestamp = step.timestamp {
                        Text(timestamp)
                            .font(.footnote.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(block == nil ? style.muted : style.ink.opacity(0.7))
                    }
                    if step.detail != nil {
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(block == nil ? style.muted : style.ink)
                            .rotationEffect(.degrees(isExpanded ? -180 : 0))
                    }
                }
                if isExpanded, let detail = step.detail {
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(block == nil ? style.muted : style.ink.opacity(0.78))
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(block == nil ? 12 : 0)
                        .background {
                            if block == nil { RoundedRectangle(cornerRadius: 12, style: .continuous).fill(style.surface) }
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                if let block {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(block)
                        .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .leading)))
                }
            }
            .padding(.bottom, isLast ? 0 : 4)
        }
        // Rows hug their content; the connector stretches only to the row's own height.
        .fixedSize(horizontal: false, vertical: true)
        .contentShape(.rect)
        .onTapGesture {
            guard step.detail != nil else { return }
            withAnimation(spring) { expanded = isExpanded ? nil : step.id }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(statusName(step.status))
        .accessibilityAddTraits(step.detail == nil ? [] : .isButton)
        .accessibilityHint(step.detail == nil ? "" : (isExpanded ? "Collapses detail" : "Expands detail"))
    }

    // MARK: Node

    private func nodeView(_ step: Step, number: Int) -> some View {
        let fill: Color? = switch step.status {
        case .complete: completeBlock
        case .current: currentBlock
        case .failed: style.failed
        case .pending: nil
        }
        return ZStack {
            if step.status == .current, !reduceMotion {
                // A slow breathing ring marks the live step without drawing attention from the content.
                PhaseAnimator([0.0, 1.0]) { phase in
                    Circle()
                        .stroke(currentBlock.opacity(0.9 - 0.9 * phase), lineWidth: 2)
                        .scaleEffect(1 + 0.5 * phase)
                } animation: { _ in .easeInOut(duration: 1.6) }
            } else if step.status == .current {
                Circle().stroke(currentBlock.opacity(0.5), lineWidth: 2).scaleEffect(1.3)
            }
            if let fill {
                Circle().fill(fill)
            } else {
                Circle().strokeBorder(style.muted.opacity(0.45), lineWidth: 2)
            }
            switch step.status {
            case .complete:
                checkmark
                    .stroke(style.ink, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
            case .failed:
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(style.ink)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
            case .current, .pending:
                Text("\(number)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(step.status == .current ? style.ink : style.muted)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .frame(width: node, height: node)
        .animation(spring, value: step.status)
    }

    private var checkmark: Path {
        Path { path in
            path.move(to: CGPoint(x: 9, y: 15.5))
            path.addLine(to: CGPoint(x: 13.5, y: 20))
            path.addLine(to: CGPoint(x: 21, y: 11))
        }
    }

    /// The line beneath a node. It fills once that step is complete, turns dashed after a failure, and stops.
    private func connector(after step: Step) -> some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            let line = Path { path in
                path.move(to: CGPoint(x: proxy.size.width / 2, y: 3))
                path.addLine(to: CGPoint(x: proxy.size.width / 2, y: height + 6))
            }
            line.stroke(style.muted.opacity(0.25), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: step.status == .failed ? [2, 7] : []))
            line.trim(from: 0, to: step.status == .complete ? 1 : 0)
                .stroke(style.text, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }
    }

    private func statusName(_ status: Status) -> String {
        switch status {
        case .pending: "Pending"
        case .current: "In progress"
        case .complete: "Complete"
        case .failed: "Failed"
        }
    }
}

public extension StatusTimeline {
    /// Look of a `StatusTimeline`. Start from `.standard` and change what you need.
    struct Style: Sendable {
        /// Block behind the live step and its node.
        public var current: Color = Color(red: 1, green: 0, blue: 0)
        /// Completed nodes.
        public var complete: Color = Color(red: 0.663, green: 0.863, blue: 0.718)
        /// Failed step block and node.
        public var failed: Color = Color(red: 1, green: 0, blue: 0)
        /// Dark ink used on every block.
        public var ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
        /// Titles and the filled connector.
        public var text: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Pending titles, timestamps, rings and the empty connector.
        public var muted: Color = Style.adaptive(0x5C5A56, 0xA6A49F)
        /// Card behind expanded detail on steps that are not blocks.
        public var surface: Color = Style.adaptive(0xFFFFFF, 0x1C1C1C)

        public init() {}

        /// The house palette: a tangerine live step, sage checks, signal failures.
        public static let standard = Style()

        private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(UIColor { traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

// MARK: - Example

/// The timeline alone, advancing a step on every tap.
private struct StatusTimelineExample: View {
    @State private var stage = 2

    var body: some View {
        StatusTimeline(steps: [
            .init("Order placed", detail: "Confirmation sent to sam.rivera@example.com.", timestamp: "9:41 AM", status: stage > 0 ? .complete : .current),
            .init("Packed", detail: "Three items packed at the Riverside warehouse.", timestamp: "11:20 AM", status: stage > 1 ? .complete : stage == 1 ? .current : .pending),
            .init("Out for delivery", detail: "Noor has your parcel. You are stop 6 of 14.", timestamp: "1:05 PM", status: stage > 2 ? .complete : stage == 2 ? .current : .pending),
            .init("Delivered", detail: "Left with the front desk. Signed by D. Alvarez.", timestamp: stage > 3 ? "4:12 PM" : nil, status: stage > 3 ? .complete : stage == 3 ? .current : .pending),
        ])
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
        .onTapGesture { stage = (stage + 1) % 5 }
    }
}

#Preview("Light") {
    StatusTimelineExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    StatusTimelineExample().preferredColorScheme(.dark)
}
