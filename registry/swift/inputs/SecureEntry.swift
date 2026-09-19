// swiftpieces:
// title: Secure Entry
// description: A password field on a soft 56pt block with a focus ring and a round reveal toggle that keeps focus, a strength bar that grows through four color blocks with a matching label chip, requirement chips that turn into solid blocks with drawn checks and collapse when complete, a success check, and a damped shake with an error chip.
// category: inputs
// pro: code-entry
// minIOSVersion: "17.0"
// version: "2.0.0"
// tags: [password, secure, strength, validation, form]

import SwiftUI

/// Password field with strength meter, live requirements, and inline error.
///
/// - Parameters:
///   - label: Static caption above the field, also the placeholder and accessibility label.
///   - text: Bound password text.
///   - error: Validation message. Setting it non-nil shakes the field, fires an error haptic, and slides an error chip in below.
///   - showsStrength: Show the strength bar and its label chip once text is non-empty.
///   - showsRequirements: Show the 8+ / number / symbol / mixed-case chips while focused or filled; they collapse once all four pass and a check appears in the field.
///   - style: Colors and field metrics. Defaults to the Swift Pieces house palette, adapting to light and dark.
public struct SecureEntry: View {
    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The field block.
        public var field: Color
        /// Typed text and the focus ring.
        public var label: Color
        /// Caption, placeholder and unmet requirements.
        public var secondaryLabel: Color
        /// The round reveal button.
        public var button: Color
        /// Text and glyphs on solid blocks.
        public var ink: Color
        /// Strength blocks from weak to strong. Four colors; shorter arrays repeat their last color.
        public var strength: [Color]
        /// Met requirement chips and the success check.
        public var success: Color
        /// Error ring and error chip.
        public var error: Color
        /// Field height.
        public var height: CGFloat
        /// Field corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(field: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, button: Color? = nil, ink: Color? = nil, strength: [Color]? = nil, success: Color? = nil, error: Color? = nil, height: CGFloat = 56, cornerRadius: CGFloat = 18) {
            self.field = field ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.button = button ?? adaptive(light: 0xFFFFFF, dark: 0x3A3A3A)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.strength = (strength?.isEmpty == false ? strength : nil) ?? [0xFF5B3A, 0xFFD976, 0x9CC2FF, 0xA9DCB7].map { adaptive(light: $0, dark: $0) }
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.error = error ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.height = max(height, 44)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()

        func strength(_ score: Int) -> Color { strength[min(max(score - 1, 0), strength.count - 1)] }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @FocusState private var focus: Field?
    @State private var isRevealed = false
    @State private var shakeCount = 0
    @Binding private var text: String

    private let label: String
    private let error: String?
    private let showsStrength: Bool
    private let showsRequirements: Bool
    private let style: Style

    private enum Field { case secure, plain }

    private struct Requirement: Identifiable {
        let id: String
        let met: Bool
    }

    private static let levels = ["Weak", "Fair", "Good", "Strong"]

    public init(_ label: String = "Password", text: Binding<String>, error: String? = nil, showsStrength: Bool = true, showsRequirements: Bool = true, style: Style = .standard) {
        self.label = label
        self._text = text
        self.error = error
        self.showsStrength = showsStrength
        self.showsRequirements = showsRequirements
        self.style = style
    }

    private var motion: Animation { reduceMotion ? .smooth(duration: 0.2) : .spring(duration: 0.4, bounce: 0.15) }

    public var body: some View {
        let requirements = Self.requirements(for: text)
        let passed = requirements.filter(\.met).count
        let complete = showsRequirements && passed == requirements.count
        let isFocused = focus != nil
        let hasError = error != nil
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)

        VStack(alignment: .leading, spacing: 10) {
            Text(label.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(style.secondaryLabel)

            HStack(spacing: 8) {
                Group {
                    if isRevealed {
                        TextField(label, text: $text)
                            .focused($focus, equals: .plain)
                    } else {
                        SecureField(label, text: $text)
                            .focused($focus, equals: .secure)
                    }
                }
                .font(.body.weight(.medium))
                .foregroundStyle(style.label)
                .tint(style.label)
                .textContentType(.password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel(label)

                if complete && !hasError {
                    Image(systemName: "checkmark")
                        .font(.footnote.weight(.heavy))
                        .foregroundStyle(style.ink)
                        .frame(width: 26, height: 26)
                        .background(style.success, in: Circle())
                        .transition(.scale(scale: 0.4).combined(with: .opacity))
                        .accessibilityLabel("All requirements met")
                }

                Button(action: toggleReveal) {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .font(.subheadline.weight(.semibold))
                        .contentTransition(.symbolEffect(.replace))
                        .foregroundStyle(style.label)
                        .frame(width: 38, height: 38)
                        .background(style.button, in: Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isRevealed ? "Hide password" : "Show password")
            }
            .padding(.leading, 18)
            .padding(.trailing, (style.height - 44) / 2)
            .frame(height: style.height)
            .background(style.field, in: shape)
            .overlay {
                shape.strokeBorder(hasError ? style.error : style.label, lineWidth: 2)
                    .opacity(isFocused || hasError ? 1 : 0)
            }
            .modifier(Shake(count: reduceMotion ? 0 : CGFloat(shakeCount)))
            .animation(.smooth(duration: 0.2), value: isFocused)
            .animation(.linear(duration: 0.45), value: shakeCount)

            if let error {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark")
                        .font(.caption2.weight(.heavy))
                    Text(error)
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(style.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(style.error, in: Capsule())
                .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Error: \(error)")
            }

            if showsStrength && !text.isEmpty {
                meter(score: max(passed, 1))
                    .transition(.opacity)
            }

            if showsRequirements && (isFocused || !text.isEmpty) && !complete {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) {
                    ForEach(requirements) { requirement in
                        chip(requirement)
                    }
                }
                .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
            }
        }
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion, value: passed)
        .animation(motion, value: error)
        .animation(motion, value: isFocused)
        .animation(motion, value: text.isEmpty)
        .sensoryFeedback(.selection, trigger: passed) { old, new in new > old }
        .sensoryFeedback(.success, trigger: complete) { old, new in !old && new }
        .sensoryFeedback(.error, trigger: shakeCount)
        .onChange(of: error) { _, new in
            if new != nil { shakeCount += 1 }
        }
    }

    /// One bar whose width and block color move with the score, and a label chip in the same color.
    private func meter(score: Int) -> some View {
        let color = style.strength(score)
        return HStack(spacing: 10) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(style.field)
                    Capsule().fill(color).frame(width: proxy.size.width * CGFloat(score) / 4)
                }
            }
            .frame(height: 8)
            Text(Self.levels[score - 1].uppercased())
                .font(.caption2.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(style.ink)
                .contentTransition(.opacity)
                .frame(width: 62, height: 22)
                .background(color, in: Capsule())
        }
        .animation(.spring(duration: 0.45, bounce: 0.1), value: score)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Password strength")
        .accessibilityValue(Self.levels[score - 1])
    }

    /// Unmet: a quiet chip with an empty ring. Met: a solid block whose check draws in after the fill lands.
    private func chip(_ requirement: Requirement) -> some View {
        HStack(spacing: 6) {
            ZStack {
                Circle().strokeBorder(style.secondaryLabel.opacity(0.6), lineWidth: 1.5)
                    .opacity(requirement.met ? 0 : 1)
                Checkmark()
                    .trim(from: 0, to: requirement.met ? 1 : 0)
                    .stroke(style.ink, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .padding(2)
                    .animation(reduceMotion ? nil : .spring(duration: 0.35, bounce: 0.1).delay(requirement.met ? 0.08 : 0), value: requirement.met)
            }
            .frame(width: 14, height: 14)
            Text(requirement.id)
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(requirement.met ? style.ink : style.secondaryLabel)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
        .background(requirement.met ? style.success : style.field, in: .rect(cornerRadius: 12, style: .continuous))
        .scaleEffect(requirement.met && !reduceMotion ? 1 : 0.98)
        .animation(reduceMotion ? nil : .spring(duration: 0.3, bounce: 0.3), value: requirement.met)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(requirement.id)
        .accessibilityValue(requirement.met ? "Met" : "Not met")
    }

    private func toggleReveal() {
        let wasFocused = focus != nil
        isRevealed.toggle()
        // Hand focus to the replacement field so the keyboard stays up.
        if wasFocused { focus = isRevealed ? .plain : .secure }
    }

    private static func requirements(for password: String) -> [Requirement] {
        [
            Requirement(id: "8+ characters", met: password.count >= 8),
            Requirement(id: "A number", met: password.contains(where: \.isNumber)),
            Requirement(id: "A symbol", met: password.contains { !$0.isLetter && !$0.isNumber && !$0.isWhitespace }),
            Requirement(id: "Mixed case", met: password.contains(where: \.isUppercase) && password.contains(where: \.isLowercase))
        ]
    }

    /// Checkmark drawn in unit space so it scales with its frame.
    private struct Checkmark: Shape {
        nonisolated func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.minX + rect.width * 0.1, y: rect.minY + rect.height * 0.55))
            path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.4, y: rect.minY + rect.height * 0.85))
            path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.9, y: rect.minY + rect.height * 0.2))
            return path
        }
    }
}

/// Damped sideways shake: four cycles that decay to rest over one unit of `count`.
private struct Shake: GeometryEffect {
    var count: CGFloat

    nonisolated var animatableData: CGFloat {
        get { count }
        set { count = newValue }
    }

    nonisolated func effectValue(size: CGSize) -> ProjectionTransform {
        let t = count - count.rounded(.down)
        let x = sin(t * .pi * 4) * 7 * (1 - t)
        return ProjectionTransform(CGAffineTransform(translationX: x, y: 0))
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

/// The field mid-typing with its strength bar and requirement chips, and a second field in its error state.
private struct SecureEntryExample: View {
    @State private var password = "Juniper42"
    @State private var confirm = "Juniper24!"

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            SecureEntry("New password", text: $password)
            SecureEntry("Confirm password", text: $confirm, error: "Passwords do not match", showsStrength: false, showsRequirements: false)
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    SecureEntryExample()
}

#Preview("Dark") {
    SecureEntryExample()
        .preferredColorScheme(.dark)
}
