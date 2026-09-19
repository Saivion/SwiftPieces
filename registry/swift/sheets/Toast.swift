// swiftpieces:
// title: Toast
// description: A single toast card with a solid color tile for its kind, a bold message with an optional detail line, a signal-colored action such as Undo, and a thin timer that pauses while touched; placed inside the safe area so it clears the Dynamic Island and rides above the keyboard.
// category: sheets
// pro: toast-stack
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [toast, notification, undo, feedback, haptic]

import SwiftUI

/// Presents one transient toast on the top or bottom edge.
///
/// - Parameters:
///   - isPresented: Shows the toast while `true`; the timer, swipe, and action set it back to `false`.
///   - message: Text to show, in bold. Keep it to one line.
///   - detail: Optional quieter second line, such as where the item went.
///   - systemImage: Optional SF Symbol; defaults to a symbol that matches `style`.
///   - style: The kind of toast, which picks the tile color and default symbol: `.info`, `.success`, `.warning`, or `.error`.
///   - duration: Seconds before it dismisses on its own. The countdown pauses while the toast is touched.
///   - position: `.top` or `.bottom` edge to slide in from.
///   - action: Optional trailing button (for example Undo). Tapping it flashes a check, runs the handler, then dismisses.
///   - appearance: Colors and corner radius. Defaults to the Swift Pieces house palette, adapting to light and dark.
public extension View {
    func toast(isPresented: Binding<Bool>, message: String, detail: String? = nil, systemImage: String? = nil, style: Toast.Style = .info, duration: Double = 3, position: Toast.Position = .top, action: Toast.Action? = nil, appearance: Toast.Appearance = .standard) -> some View {
        modifier(Toast(isPresented: isPresented, message: message, detail: detail, systemImage: systemImage, style: style, duration: duration, position: position, action: action, appearance: appearance))
    }
}

/// Toast modifier. Single instance: presenting again while visible restarts the countdown.
public struct Toast: ViewModifier {
    public enum Style {
        case info, success, warning, error

        var symbol: String {
            switch self {
            case .info: "info"
            case .success: "checkmark"
            case .warning: "exclamationmark"
            case .error: "xmark"
            }
        }
    }

    public enum Position { case top, bottom }

    /// A trailing action such as Undo.
    public struct Action {
        public let title: String
        public let handler: () -> Void

        public init(_ title: String, handler: @escaping () -> Void) {
            self.title = title
            self.handler = handler
        }
    }

    /// Colors and shape. `.standard` is the house palette: an ink card in light mode, a raised card in dark mode, color tiles per kind and a signal action.
    public struct Appearance: Sendable {
        /// The toast card.
        public var surface: Color
        /// Message text and timer.
        public var label: Color
        /// Detail text.
        public var secondaryLabel: Color
        /// Glyphs and text on tiles and the action.
        public var ink: Color
        /// Tile for `.info`.
        public var info: Color
        /// Tile for `.success`.
        public var success: Color
        /// Tile for `.warning`.
        public var warning: Color
        /// Tile for `.error`.
        public var error: Color
        /// The action button fill.
        public var action: Color
        /// Card corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(surface: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, ink: Color? = nil, info: Color? = nil, success: Color? = nil, warning: Color? = nil, error: Color? = nil, action: Color? = nil, cornerRadius: CGFloat = 22) {
            self.surface = surface ?? adaptive(light: 0x141414, dark: 0x2A2A2A)
            self.label = label ?? adaptive(light: 0xF4F3EF, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0xA6A49F, dark: 0xA6A49F)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.info = info ?? adaptive(light: 0x9CC2FF, dark: 0x9CC2FF)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.warning = warning ?? adaptive(light: 0xFFD976, dark: 0xFFD976)
            self.error = error ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.action = action ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Appearance()

        func tile(for style: Style) -> Color {
            switch style {
            case .info: info
            case .success: success
            case .warning: warning
            case .error: error
            }
        }
    }

    private enum Phase { case entering, idle, touched, actioned, dismissing }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isPresented: Bool

    @State private var phase: Phase = .entering
    @State private var dragOffset: CGFloat = 0
    @State private var elapsed: Double = 0          // countdown consumed before the current run
    @State private var resumedAt: Date = .now       // when the current run started
    @State private var runToken = 0                 // restarts the countdown task
    @State private var commitTick = 0
    @State private var arriveTick = 0

    private let message: String
    private let detail: String?
    private let systemImage: String?
    private let style: Style
    private let duration: Double
    private let position: Position
    private let action: Action?
    private let appearance: Appearance

    public init(isPresented: Binding<Bool>, message: String, detail: String? = nil, systemImage: String? = nil, style: Style = .info, duration: Double = 3, position: Position = .top, action: Action? = nil, appearance: Appearance = .standard) {
        self._isPresented = isPresented
        self.message = message
        self.detail = detail
        self.systemImage = systemImage
        self.style = style
        self.duration = duration
        self.position = position
        self.action = action
        self.appearance = appearance
    }

    private var edge: Edge { position == .top ? .top : .bottom }

    public func body(content: Content) -> some View {
        content
            .overlay {
                // The reader sits inside the content's safe area, so its insets are whatever the
                // content did not already consume: the Dynamic Island at the top, the keyboard at the bottom.
                GeometryReader { proxy in
                    if isPresented {
                        toast
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: position == .top ? .top : .bottom)
                            .padding(.top, position == .top ? proxy.safeAreaInsets.top + 8 : 0)
                            .padding(.bottom, position == .bottom ? proxy.safeAreaInsets.bottom + 8 : 0)
                            .padding(.horizontal, 16)
                            .transition(reduceMotion ? .opacity : .move(edge: edge).combined(with: .scale(scale: 0.92, anchor: position == .top ? .top : .bottom)).combined(with: .opacity))
                    }
                }
            }
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0.25), value: isPresented)
            .sensoryFeedback(.impact(flexibility: .soft), trigger: commitTick)
            .sensoryFeedback(trigger: arriveTick) { _, _ in
                switch style {
                case .success: .success
                case .warning: .warning
                case .error: .error
                case .info: .impact(flexibility: .soft)
                }
            }
    }

    private var toast: some View {
        label
            .background(appearance.surface, in: .rect(cornerRadius: appearance.cornerRadius, style: .continuous))
            .overlay(alignment: .bottom) { timerBar.padding(.horizontal, 22).padding(.bottom, 5) }
            .shadow(color: .black.opacity(0.22), radius: 24, y: 10)
            .frame(maxWidth: 520)
            .offset(y: dragOffset)
            .scaleEffect(phase == .touched && !reduceMotion ? 0.97 : 1)
            .animation(.spring(duration: 0.3, bounce: 0.2), value: phase)
            .gesture(touchAndSwipe)
            .task(id: runToken) { await countdown() }
            .onAppear {
                elapsed = 0
                dragOffset = 0
                phase = .entering
                arriveTick += 1
                AccessibilityNotification.Announcement(detail.map { "\(message). \($0)" } ?? message).post()
            }
            .onDisappear { phase = .entering }
            .accessibilityElement(children: .contain)
    }

    private var label: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage ?? style.symbol)
                .font(.body.weight(.bold))
                .foregroundStyle(appearance.ink)
                .symbolEffect(.bounce, value: arriveTick)
                .frame(width: 40, height: 40)
                .background(appearance.tile(for: style), in: .rect(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(message)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(appearance.label)
                    .lineLimit(2)
                if let detail {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(appearance.secondaryLabel)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            if let action {
                Button {
                    guard phase != .actioned, phase != .dismissing else { return }
                    phase = .actioned
                    action.handler()
                    Task {
                        try? await Task.sleep(for: .milliseconds(420))
                        dismiss()
                    }
                } label: {
                    ZStack {
                        Text(action.title).opacity(phase == .actioned ? 0 : 1)
                        Image(systemName: "checkmark").fontWeight(.heavy).opacity(phase == .actioned ? 1 : 0)
                            .scaleEffect(phase == .actioned || reduceMotion ? 1 : 0.4)
                    }
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(appearance.ink)
                    .padding(.horizontal, 16)
                    .frame(minWidth: 64, minHeight: 40)
                    .background(appearance.action, in: .capsule)
                    .frame(minHeight: 44)
                    .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.title)
            }
        }
        .padding(.leading, 10)
        .padding(.trailing, action == nil ? 16 : 10)
        .padding(.vertical, 10)
    }

    /// Two-point line that drains left to right; frozen while touched.
    private var timerBar: some View {
        TimelineView(.animation(paused: phase == .touched || phase == .actioned)) { context in
            let consumed = phase == .touched ? elapsed : elapsed + context.date.timeIntervalSince(resumedAt)
            let remaining = max(0, 1 - consumed / duration)
            GeometryReader { proxy in
                Capsule()
                    .fill(appearance.label.opacity(0.28))
                    .frame(width: proxy.size.width * remaining)
            }
        }
        .frame(height: 2)
        .accessibilityHidden(true)
    }

    private func countdown() async {
        guard phase != .touched, phase != .actioned else { return }
        resumedAt = .now
        try? await Task.sleep(for: .seconds(max(0, duration - elapsed)))
        guard !Task.isCancelled else { return }
        dismiss()
    }

    private func dismiss() {
        guard phase != .dismissing else { return }
        phase = .dismissing
        isPresented = false
    }

    /// One gesture does the pause and the swipe: any touch pauses the countdown,
    /// movement toward the edge is free, movement away is rubber-banded.
    private var touchAndSwipe: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if phase == .idle || phase == .entering {
                    elapsed += Date.now.timeIntervalSince(resumedAt)
                    phase = .touched
                }
                let t = value.translation.height
                dragOffset = position == .top ? min(t, 0) + max(t, 0) * 0.15 : max(t, 0) + min(t, 0) * 0.15
            }
            .onEnded { value in
                guard phase == .touched else { return }
                let away = position == .top ? -value.predictedEndTranslation.height : value.predictedEndTranslation.height
                if away > 40 {
                    commitTick += 1
                    dismiss()
                } else {
                    withAnimation(.spring(duration: 0.35, bounce: 0.25)) { dragOffset = 0 }
                    phase = .idle
                    runToken += 1
                }
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

/// The toast alone on the ground: it arrives, drains its timer, dismisses, and returns.
private struct ToastExample: View {
    @State private var shown = false

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
            .toast(isPresented: $shown, message: "Conversation archived", detail: "Mira Reyes · Invoice 2291", style: .success, duration: 4, action: .init("Undo") {})
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(0.6))
                    shown = true
                    try? await Task.sleep(for: .seconds(4.6))
                }
            }
    }
}

#Preview("Light") {
    ToastExample()
}

#Preview("Dark") {
    ToastExample()
        .preferredColorScheme(.dark)
}
