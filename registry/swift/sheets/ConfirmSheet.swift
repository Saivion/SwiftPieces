// swiftpieces:
// title: Confirm Sheet
// description: A confirmation card that presents as a height-fitted bottom sheet or, inline, as a floating card you can drag away, with a solid icon tile that bounces on present, a heavy headline, a loading primary action that lands on a success check before dismissing, and a warning haptic for destructive choices.
// category: sheets
// pro: glass-sheet
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [confirm, sheet, destructive, dialog, haptic]

import SwiftUI

/// Presents a confirmation card as a bottom sheet, or inline as an overlay in the current hierarchy.
///
/// - Parameters:
///   - isPresented: Shows the card while `true`. Confirming, cancelling, and dragging away set it back to `false`.
///   - inline: `true` overlays the card in place with a dimmed backdrop and a rubber-banded drag to dismiss; `false` uses `.sheet` sized to the card.
///   - systemImage: SF Symbol in the icon tile.
///   - title: Headline.
///   - message: Supporting copy under the title.
///   - confirmTitle: Primary button title.
///   - cancelTitle: Quiet secondary button title.
///   - isDestructive: Uses the destructive tile and the signal-colored primary button, and plays a `.warning` haptic on present.
///   - style: Colors and corner radius. Defaults to the Swift Pieces house palette, adapting to light and dark.
///   - confirm: Async handler for the primary button; the button shows a spinner until it returns, the tile turns into a check, then the card dismisses.
public extension View {
    func confirmSheet(isPresented: Binding<Bool>, inline: Bool = false, systemImage: String, title: String, message: String, confirmTitle: String = "Confirm", cancelTitle: String = "Cancel", isDestructive: Bool = false, style: ConfirmSheet.Style = .standard, confirm: @escaping () async -> Void) -> some View {
        modifier(ConfirmSheet.Presenter(isPresented: isPresented, inline: inline, style: style, card: ConfirmSheet(isPresented: isPresented, systemImage: systemImage, title: title, message: message, confirmTitle: confirmTitle, cancelTitle: cancelTitle, isDestructive: isDestructive, style: style, confirm: confirm)))
    }
}

/// The card itself. Use the `.confirmSheet` modifier to present it; embed it directly only for custom containers.
public struct ConfirmSheet: View {
    /// Colors and shape. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The card.
        public var surface: Color
        /// Headline and the non-destructive primary button fill.
        public var label: Color
        /// Message text.
        public var secondaryLabel: Color
        /// Text on the non-destructive primary button.
        public var onLabel: Color
        /// The cancel button fill and grabber.
        public var quiet: Color
        /// Glyphs and text on solid blocks.
        public var ink: Color
        /// Icon tile for non-destructive cards.
        public var tile: Color
        /// Icon tile for destructive cards.
        public var destructiveTile: Color
        /// Primary button fill for destructive cards.
        public var destructive: Color
        /// Tile once `confirm` has finished.
        public var success: Color
        /// Card corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(surface: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, onLabel: Color? = nil, quiet: Color? = nil, ink: Color? = nil, tile: Color? = nil, destructiveTile: Color? = nil, destructive: Color? = nil, success: Color? = nil, cornerRadius: CGFloat = 34) {
            self.surface = surface ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.onLabel = onLabel ?? adaptive(light: 0xF4F3EF, dark: 0x141414)
            self.quiet = quiet ?? adaptive(light: 0xEEECE7, dark: 0x2A2A2A)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.tile = tile ?? adaptive(light: 0x9CC2FF, dark: 0x9CC2FF)
            self.destructiveTile = destructiveTile ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.destructive = destructive ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()
    }

    private enum Phase { case presenting, idle, confirming, done, dismissing }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .title) private var titleSize: CGFloat = 26
    @Binding private var isPresented: Bool
    @State private var phase: Phase = .presenting
    @State private var presentTick = 0

    private let systemImage: String
    private let title: String
    private let message: String
    private let confirmTitle: String
    private let cancelTitle: String
    private let isDestructive: Bool
    private let style: Style
    private let confirm: () async -> Void

    public init(isPresented: Binding<Bool>, systemImage: String, title: String, message: String, confirmTitle: String = "Confirm", cancelTitle: String = "Cancel", isDestructive: Bool = false, style: Style = .standard, confirm: @escaping () async -> Void) {
        self._isPresented = isPresented
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.confirmTitle = confirmTitle
        self.cancelTitle = cancelTitle
        self.isDestructive = isDestructive
        self.style = style
        self.confirm = confirm
    }

    private var busy: Bool { phase == .confirming || phase == .done }
    private var primaryFill: Color { isDestructive ? style.destructive : style.label }
    private var primaryText: Color { isDestructive ? style.ink : style.onLabel }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(style.quiet)
                .frame(width: 36, height: 5)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 18)
                .accessibilityHidden(true)

            Image(systemName: phase == .done ? "checkmark" : systemImage)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(style.ink)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce.down, options: reduceMotion ? .speed(100) : .default, value: presentTick)
                .frame(width: 60, height: 60)
                .background(phase == .done ? style.success : (isDestructive ? style.destructiveTile : style.tile), in: .rect(cornerRadius: 18, style: .continuous))
                .animation(.spring(duration: 0.4, bounce: 0.3), value: phase)
                .accessibilityHidden(true)

            Text(title)
                .font(.system(size: titleSize, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(style.label)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
            Text(message)
                .font(.body)
                .foregroundStyle(style.secondaryLabel)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)

            VStack(spacing: 8) {
                Button(role: isDestructive ? .destructive : nil) {
                    guard phase == .idle || phase == .presenting else { return }
                    phase = .confirming
                    Task {
                        await confirm()
                        phase = .done
                        try? await Task.sleep(for: .milliseconds(reduceMotion ? 250 : 550))
                        phase = .dismissing
                        isPresented = false
                    }
                } label: {
                    ZStack {
                        Text(confirmTitle).opacity(busy ? 0 : 1)
                        ProgressView().tint(primaryText).opacity(phase == .confirming ? 1 : 0)
                        Image(systemName: "checkmark").fontWeight(.heavy).opacity(phase == .done ? 1 : 0)
                    }
                    .font(.headline)
                    .foregroundStyle(primaryText)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(primaryFill, in: .rect(cornerRadius: 18, style: .continuous))
                    .contentShape(.rect(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(Press())
                .disabled(busy)
                .accessibilityLabel(phase == .confirming ? "Working" : (phase == .done ? "Done" : confirmTitle))

                Button {
                    guard !busy else { return }
                    phase = .dismissing
                    isPresented = false
                } label: {
                    Text(cancelTitle)
                        .font(.headline)
                        .foregroundStyle(style.label)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(style.quiet, in: .rect(cornerRadius: 18, style: .continuous))
                        .contentShape(.rect(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(Press())
                .disabled(busy)
                .opacity(busy ? 0.5 : 1)
            }
            .padding(.top, 24)
            .animation(.smooth(duration: 0.2), value: phase)
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .sensoryFeedback(.warning, trigger: presentTick) { _, _ in isDestructive }
        .sensoryFeedback(.success, trigger: phase) { _, new in new == .done }
        .onAppear {
            presentTick += 1
            phase = .idle
        }
        .accessibilityAddTraits(.isModal)
    }

    private struct Press: ButtonStyle {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion

        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
                .brightness(configuration.isPressed ? -0.04 : 0)
                .animation(configuration.isPressed ? .smooth(duration: 0.1) : .spring(duration: 0.35, bounce: 0.3), value: configuration.isPressed)
        }
    }

    /// Chooses `.sheet` or an inline overlay for the card.
    struct Presenter: ViewModifier {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @Binding var isPresented: Bool
        let inline: Bool
        let style: Style
        let card: ConfirmSheet
        @State private var cardHeight: CGFloat = 320
        @State private var dragOffset: CGFloat = 0
        @State private var pastThreshold = false

        func body(content: Content) -> some View {
            if inline {
                content.overlay {
                    ZStack(alignment: .bottom) {
                        if isPresented {
                            Color.black.opacity(0.35)
                                .ignoresSafeArea()
                                .onTapGesture { isPresented = false }
                                .transition(.opacity)
                                .accessibilityHidden(true)
                            measured
                                .background(style.surface, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
                                .shadow(color: .black.opacity(0.22), radius: 34, y: 14)
                                .padding(.horizontal, 10)
                                .padding(.bottom, 10)
                                .offset(y: dragOffset)
                                .gesture(drag)
                                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                                .onAppear { dragOffset = 0 }
                        }
                    }
                    .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.18), value: isPresented)
                }
                .sensoryFeedback(.impact(flexibility: .rigid), trigger: pastThreshold) { _, past in past }
            } else {
                content.sheet(isPresented: $isPresented) {
                    measured
                        .presentationDetents([.height(cardHeight)])
                        .presentationCornerRadius(style.cornerRadius)
                        .presentationDragIndicator(.hidden)
                        .presentationBackground(style.surface)
                }
            }
        }

        private var measured: some View {
            card.background {
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { cardHeight = proxy.size.height }
                        .onChange(of: proxy.size.height) { _, height in cardHeight = height }
                }
            }
        }

        /// Downward drag is free, upward is rubber-banded; a flick past the threshold commits.
        private var drag: some Gesture {
            DragGesture(minimumDistance: 6)
                .onChanged { value in
                    let t = value.translation.height
                    dragOffset = max(t, 0) + min(t, 0) * 0.12
                    pastThreshold = value.predictedEndTranslation.height > 90
                }
                .onEnded { value in
                    if value.predictedEndTranslation.height > 90 || value.translation.height > cardHeight * 0.4 {
                        isPresented = false
                    } else {
                        withAnimation(.spring(duration: 0.4, bounce: 0.25)) { dragOffset = 0 }
                    }
                    pastThreshold = false
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

/// The card alone, inline, over its own dimmed backdrop.
private struct ConfirmSheetExample: View {
    @State private var confirming = true

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
            .confirmSheet(isPresented: $confirming, inline: true, systemImage: "trash", title: "Delete this note?", message: "It will be removed from your iPhone, iPad and Mac. This can't be undone.", confirmTitle: "Delete note", isDestructive: true) {
                try? await Task.sleep(for: .seconds(0.8))
            }
    }
}

#Preview("Light") {
    ConfirmSheetExample()
}

#Preview("Dark") {
    ConfirmSheetExample()
        .preferredColorScheme(.dark)
}
