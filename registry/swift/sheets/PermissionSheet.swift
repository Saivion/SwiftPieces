// swiftpieces:
// title: Permission Sheet
// description: A pre-permission sheet with a solid icon tile that bounces on present and turns into a check when granted, a heavy left-aligned headline, benefit rows on their own color tiles that stagger in, a signal-colored request button that spins while the system asks, and a denied result that swaps the copy and routes the button to Settings.
// category: sheets
// pro: onboarding-flow
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [permission, onboarding, sheet, async, haptic]

import SwiftUI

/// Explains a permission, runs the real request, and reacts to the result.
///
/// - Parameters:
///   - systemImage: SF Symbol shown in the icon tile.
///   - title: Headline.
///   - message: One or two sentences of context.
///   - benefits: Rows that stagger in below the message, each on its own color tile.
///   - allowTitle: Primary button title.
///   - deniedTitle: Headline shown after the request returns `false`.
///   - deniedMessage: Copy shown after a denial, above the "Open Settings" button.
///   - style: Colors and tile shape. Defaults to the Swift Pieces house palette, adapting to light and dark.
///   - request: Async permission request; return `true` when granted. The button spins until it returns.
///   - onGranted: Called about a second after a grant, once the tile has turned into a check. Dismiss the sheet here.
///   - onSkip: Secondary handler. Omit to hide the "Not now" button.
public struct PermissionSheet: View {
    public struct Benefit: Identifiable {
        public let id = UUID()
        public var symbol: String
        public var text: String

        public init(symbol: String, text: String) {
            self.symbol = symbol
            self.text = text
        }
    }

    /// Colors and shape. `.standard` is the house palette. The sheet draws no background of its own; give its container `surface`.
    public struct Style: Sendable {
        /// Suggested sheet background, for `.presentationBackground(style.surface)`.
        public var surface: Color
        /// Headline and benefit text.
        public var label: Color
        /// Message and "Not now".
        public var secondaryLabel: Color
        /// Glyphs and text on solid blocks and on the primary button.
        public var ink: Color
        /// The icon tile before a result.
        public var tile: Color
        /// The icon tile and button after a grant.
        public var success: Color
        /// The icon tile after a denial.
        public var denied: Color
        /// Benefit tiles, assigned in order and repeated.
        public var benefitTiles: [Color]
        /// The primary button fill.
        public var action: Color
        /// Corner radius of the big icon tile; buttons and benefit tiles scale from it.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(surface: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, ink: Color? = nil, tile: Color? = nil, success: Color? = nil, denied: Color? = nil, benefitTiles: [Color]? = nil, action: Color? = nil, cornerRadius: CGFloat = 26) {
            self.surface = surface ?? adaptive(light: 0xFFFFFF, dark: 0x1C1C1C)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.tile = tile ?? adaptive(light: 0x9CC2FF, dark: 0x9CC2FF)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.denied = denied ?? adaptive(light: 0xE9D5B3, dark: 0xE9D5B3)
            self.benefitTiles = (benefitTiles?.isEmpty == false ? benefitTiles : nil) ?? [0xFFD976, 0xCDB8FF, 0xA9DCB7].map { adaptive(light: $0, dark: $0) }
            self.action = action ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()
    }

    private enum Phase { case idle, requesting, granted, denied }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @ScaledMetric(relativeTo: .title) private var titleSize: CGFloat = 30
    @State private var phase: Phase = .idle
    @State private var revealed = false
    @State private var presentTick = 0

    private let systemImage: String
    private let title: String
    private let message: String
    private let benefits: [Benefit]
    private let allowTitle: String
    private let deniedTitle: String
    private let deniedMessage: String
    private let style: Style
    private let request: () async -> Bool
    private let onGranted: () -> Void
    private let onSkip: (() -> Void)?

    public init(
        systemImage: String,
        title: String,
        message: String,
        benefits: [Benefit] = [],
        allowTitle: String = "Continue",
        deniedTitle: String = "Permission is off",
        deniedMessage: String = "You can turn it on any time in Settings.",
        style: Style = .standard,
        request: @escaping () async -> Bool,
        onGranted: @escaping () -> Void,
        onSkip: (() -> Void)? = nil
    ) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.benefits = benefits
        self.allowTitle = allowTitle
        self.deniedTitle = deniedTitle
        self.deniedMessage = deniedMessage
        self.style = style
        self.request = request
        self.onGranted = onGranted
        self.onSkip = onSkip
    }

    private var tileFill: Color { phase == .granted ? style.success : (phase == .denied ? style.denied : style.tile) }
    private var tileSymbol: String { phase == .granted ? "checkmark" : (phase == .denied ? "gearshape.fill" : systemImage) }
    private var buttonTitle: String { phase == .denied ? "Open Settings" : (phase == .granted ? "Allowed" : allowTitle) }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: tileSymbol)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(style.ink)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce.down, options: reduceMotion ? .speed(100) : .default, value: presentTick)
                .frame(width: 76, height: 76)
                .background(tileFill, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
                .scaleEffect(phase == .granted && !reduceMotion ? 1.06 : 1)
                .animation(.spring(duration: 0.45, bounce: 0.35), value: phase)
                .accessibilityHidden(true)

            ZStack(alignment: .topLeading) {
                copy(title: title, message: message, shown: phase != .denied)
                copy(title: deniedTitle, message: deniedMessage, shown: phase == .denied)
            }
            .animation(.smooth(duration: 0.35), value: phase)
            .padding(.top, 22)

            if !benefits.isEmpty, phase != .denied {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(benefits.enumerated()), id: \.element.id) { offset, benefit in
                        row(benefit, tile: style.benefitTiles[offset % style.benefitTiles.count])
                            .opacity(revealed ? 1 : 0)
                            .offset(y: revealed || reduceMotion ? 0 : 14)
                            .animation(reduceMotion ? nil : .spring(duration: 0.5, bounce: 0.2).delay(0.15 + 0.08 * Double(offset)), value: revealed)
                    }
                }
                .padding(.top, 22)
                .transition(.opacity)
            }

            Spacer(minLength: 24)

            VStack(spacing: 4) {
                Button {
                    if phase == .denied {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    } else {
                        Task { await run() }
                    }
                } label: {
                    ZStack {
                        HStack(spacing: 8) {
                            if phase == .granted { Image(systemName: "checkmark").fontWeight(.heavy) }
                            Text(buttonTitle).contentTransition(.opacity)
                        }
                        .opacity(phase == .requesting ? 0 : 1)
                        ProgressView().tint(phase == .denied ? style.surface : style.ink).opacity(phase == .requesting ? 1 : 0)
                    }
                    .font(.headline)
                    .foregroundStyle(phase == .denied ? style.surface : style.ink)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(phase == .granted ? style.success : (phase == .denied ? style.label : style.action), in: .rect(cornerRadius: 18, style: .continuous))
                    .contentShape(.rect(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(Press())
                .disabled(phase == .requesting || phase == .granted)
                .accessibilityLabel(phase == .requesting ? "Requesting" : buttonTitle)

                if let onSkip, phase != .granted {
                    Button(action: onSkip) {
                        Text("Not now")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(style.secondaryLabel)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .disabled(phase == .requesting)
                }
            }
            .animation(.smooth(duration: 0.25), value: phase)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .sensoryFeedback(.success, trigger: phase) { _, new in new == .granted }
        .sensoryFeedback(.warning, trigger: phase) { _, new in new == .denied }
        .onAppear {
            revealed = true
            presentTick += 1
        }
    }

    /// Title and message; the two copies crossfade through a blur so a denial reads as the same sheet changing its mind.
    private func copy(title: String, message: String, shown: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: titleSize, weight: .bold))
                .tracking(-0.8)
                .foregroundStyle(style.label)
            Text(message)
                .font(.body)
                .foregroundStyle(style.secondaryLabel)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .opacity(shown ? 1 : 0)
        .blur(radius: shown || reduceMotion ? 0 : 6)
        .accessibilityElement(children: .combine)
        .accessibilityHidden(!shown)
    }

    private func run() async {
        guard phase == .idle else { return }
        phase = .requesting
        let granted = await request()
        withAnimation { phase = granted ? .granted : .denied }
        guard granted else { return }
        try? await Task.sleep(for: .seconds(0.9))
        onGranted()
    }

    private func row(_ benefit: Benefit, tile: Color) -> some View {
        HStack(spacing: 14) {
            Image(systemName: benefit.symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(style.ink)
                .frame(width: 44, height: 44)
                .background(tile, in: .rect(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            Text(benefit.text)
                .font(.body.weight(.medium))
                .foregroundStyle(style.label)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
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
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// The sheet alone, presented over the plain ground.
private struct PermissionSheetExample: View {
    @State private var showing = true

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
            .sheet(isPresented: $showing) {
                PermissionSheet(
                    systemImage: "bell.badge.fill",
                    title: "Turn on notifications",
                    message: "We only send what matters, and you can change this any time.",
                    benefits: [
                        .init(symbol: "clock.fill", text: "A nudge 30 minutes before things are due"),
                        .init(symbol: "person.2.fill", text: "Replies from people you share lists with"),
                        .init(symbol: "moon.fill", text: "Nothing between 10 PM and 7 AM"),
                    ],
                    allowTitle: "Allow notifications",
                    request: { try? await Task.sleep(for: .seconds(1)); return true },
                    onGranted: { showing = false },
                    onSkip: { showing = false }
                )
                .presentationDetents([.large])
                .presentationCornerRadius(34)
                .presentationBackground(PermissionSheet.Style.standard.surface)
            }
    }
}

#Preview("Light") {
    PermissionSheetExample()
}

#Preview("Dark") {
    PermissionSheetExample()
        .preferredColorScheme(.dark)
}
