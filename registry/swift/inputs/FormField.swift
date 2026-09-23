// swiftpieces:
// title: Form Field
// description: A text field on a soft 56pt block whose label rests inside as a placeholder and glides up into a caption on focus or once filled, with an optional leading icon, a clear button, help text, a grapheme-accurate character limit with a counter that turns into a tangerine chip and bumps when extra input is refused, and validation that waits until you leave the field before drawing an error ring, sliding in the message with an error haptic and a VoiceOver announcement, then shows a sage check once fixed.
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-23"
// tags: [textfield, form, floating-label, validation, character-limit, counter]

import SwiftUI

/// Text field with a floating label, help and error text, a character limit and a counter.
///
/// Chain fields by applying `.focused($focus, equals: .email)` to each `FormField` (focus reaches the text field
/// inside) and moving focus in `onSubmit`. Apply ``SwiftUI/View/formFieldRevealsErrors(_:)`` to a form to show every
/// field's validation at once, for example after a submit button is tapped.
///
/// - Parameters:
///   - label: The label. Rests inside the empty field as its placeholder, floats up into a caption on focus or once filled, and is the accessibility label.
///   - text: Bound text.
///   - prompt: Placeholder shown under the floated label only while the field is focused and empty, e.g. "you@example.com".
///   - help: Supporting text below the field, shown whenever there is no error. Also the VoiceOver hint.
///   - leading: Icon at the leading edge, e.g. `Image(systemName: "envelope")`.
///   - limit: Maximum length in characters (extended grapheme clusters, so an emoji or accented letter counts as one). Typing or pasting past it is trimmed without splitting a character, and a "12/50" counter appears.
///   - axis: `.horizontal` for one line; `.vertical` for a multiline field that grows up to eight lines, where Return inserts a newline.
///   - validation: When `validate` starts running. `.onBlur` (default) waits until the field has been edited and left once, then validates live. `.onSubmit` waits for Return. `.live` starts with the first edit.
///   - validate: Returns an error message for invalid text, or `nil` when valid. A sage check appears once the text is valid.
///   - error: An error from outside the field (e.g. "Email already in use" from a server). Shown immediately and ahead of `validate`.
///   - textContentType: Autofill hint, e.g. `.emailAddress`, `.name`, `.oneTimeCode`.
///   - keyboardType: Keyboard. `.emailAddress` and `.URL` also turn off autocapitalization and autocorrection.
///   - submitLabel: The Return key label, e.g. `.next` or `.done`.
///   - onSubmit: Called when Return is pressed in a one-line field. Move focus to the next field here.
///   - style: Colors and field metrics. Defaults to the Swift Pieces house palette, adapting to light and dark.
public struct FormField: View {
    /// When a field starts showing the result of `validate`.
    public enum ValidationTiming: Sendable, Hashable {
        /// From the first edit, on every keystroke.
        case live
        /// After the field has been edited and left once, then live. Nobody sees an error while typing their first characters.
        case onBlur
        /// After Return is pressed in the field once, then live.
        case onSubmit
    }

    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The field block.
        public var field: Color
        /// Typed text.
        public var label: Color
        /// The label, prompt, icon, help text and counter.
        public var secondaryLabel: Color
        /// The 2pt ring while focused.
        public var focusRing: Color
        /// The error ring, the error glyph and the counter chip at the limit.
        public var error: Color
        /// The valid check.
        public var success: Color
        /// Glyphs and text on solid blocks.
        public var ink: Color
        /// Minimum field height. Grows with Dynamic Type and multiline text.
        public var height: CGFloat
        /// Field corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(field: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, focusRing: Color? = nil, error: Color? = nil, success: Color? = nil, ink: Color? = nil, height: CGFloat = 56, cornerRadius: CGFloat = 18) {
            self.field = field ?? adaptive(light: 0xE9E7E1, dark: 0x262626)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.focusRing = focusRing ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.error = error ?? adaptive(light: 0xFF5B3A, dark: 0xFF5B3A)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.height = max(height, 44)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.formFieldRevealsErrors) private var revealsErrors
    @FocusState private var isFocused: Bool
    @State private var edited = false
    @State private var armed = false
    @State private var bump = 0
    @ScaledMetric(relativeTo: .body) private var iconWidth: CGFloat = 22
    @Binding private var text: String

    private let label: String
    private let prompt: String?
    private let help: String?
    private let leading: Image?
    private let limit: Int?
    private let axis: Axis
    private let validation: ValidationTiming
    private let validate: ((String) -> String?)?
    private let externalError: String?
    private let textContentType: UITextContentType?
    private let keyboardType: UIKeyboardType
    private let submitLabel: SubmitLabel
    private let submitAction: (() -> Void)?
    private let style: Style

    public init(
        _ label: String,
        text: Binding<String>,
        prompt: String? = nil,
        help: String? = nil,
        leading: Image? = nil,
        limit: Int? = nil,
        axis: Axis = .horizontal,
        validation: ValidationTiming = .onBlur,
        validate: ((String) -> String?)? = nil,
        error: String? = nil,
        textContentType: UITextContentType? = nil,
        keyboardType: UIKeyboardType = .default,
        submitLabel: SubmitLabel = .return,
        onSubmit: (() -> Void)? = nil,
        style: Style = .standard
    ) {
        self.label = label
        self._text = text
        self.prompt = prompt
        self.help = help
        self.leading = leading
        self.limit = limit.map { max($0, 0) }
        self.axis = axis
        self.validation = validation
        self.validate = validate
        self.externalError = error
        self.textContentType = textContentType
        self.keyboardType = keyboardType
        self.submitLabel = submitLabel
        self.submitAction = onSubmit
        self.style = style
    }

    private var motion: Animation { reduceMotion ? .smooth(duration: 0.2) : .spring(duration: 0.35, bounce: 0.12) }

    /// The message on screen: an outside error first, then `validate` once validation is armed.
    private var shownError: String? {
        if let externalError { return externalError }
        guard armed || revealsErrors, let validate else { return nil }
        return validate(text)
    }

    private var plainEntry: Bool {
        keyboardType == .emailAddress || keyboardType == .URL
            || textContentType == .emailAddress || textContentType == .URL || textContentType == .username
    }

    /// The caption-to-body line-height ratio at the current text size, so the floated label lands exactly in the caption slot at every Dynamic Type size.
    private var floatScale: CGFloat {
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicTypeSize))
        let body = UIFont.preferredFont(forTextStyle: .body, compatibleWith: traits).lineHeight
        let caption = UIFont.preferredFont(forTextStyle: .caption1, compatibleWith: traits).lineHeight
        return body > 0 ? min(caption / body, 1) : 0.75
    }

    public var body: some View {
        let error = shownError
        let floated = isFocused || !text.isEmpty
        let valid = validate != nil && error == nil && (armed || revealsErrors) && !text.isEmpty
        let showsClear = isFocused && !text.isEmpty && isEnabled
        let count = text.count
        let atLimit = limit.map { count >= $0 } ?? false
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        let multiline = axis == .vertical

        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: multiline ? .top : .center, spacing: 10) {
                if let leading {
                    leading
                        .font(.body.weight(.medium))
                        .foregroundStyle(isFocused ? style.label : style.secondaryLabel)
                        .frame(width: iconWidth)
                        .padding(.top, multiline ? 12 : 0)
                        .accessibilityHidden(true)
                }

                ZStack(alignment: floated ? .topLeading : .leading) {
                    VStack(alignment: .leading, spacing: 1) {
                        // Reserves the caption slot the floated label lands in.
                        Text(verbatim: " ").font(.caption).accessibilityHidden(true)
                        input
                    }
                    Text(label)
                        .font(.body)
                        .lineLimit(1)
                        .foregroundStyle(style.secondaryLabel)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .scaleEffect(floated ? floatScale : 1, anchor: UnitPoint(x: layoutDirection == .rightToLeft ? 1 : 0, y: 0))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 9)

                if valid {
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(style.ink)
                        .frame(width: 24, height: 24)
                        .background(style.success, in: Circle())
                        .padding(.top, multiline ? 14 : 0)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
                        .accessibilityHidden(true)
                }

                if showsClear {
                    Button {
                        text = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.body)
                            .foregroundStyle(style.secondaryLabel)
                            .frame(width: 44, height: 44)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, multiline ? 4 : 0)
                    .transition(.opacity)
                    .accessibilityLabel("Clear \(label)")
                }
            }
            .padding(.leading, 16)
            .padding(.trailing, showsClear ? 4 : 16)
            .frame(minHeight: style.height)
            .background {
                // Taps on the padding, icon or label still focus the field.
                shape.fill(style.field)
                    .onTapGesture { isFocused = true }
            }
            .overlay {
                shape.strokeBorder(error != nil ? style.error : style.focusRing, lineWidth: 2)
                    .opacity(error != nil || isFocused ? 1 : 0)
                    .allowsHitTesting(false)
            }

            footer(error: error, count: count, atLimit: atLimit)
        }
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion, value: floated)
        .animation(motion, value: error)
        .animation(motion, value: valid)
        .animation(motion, value: showsClear)
        .animation(.smooth(duration: 0.2), value: isFocused)
        .animation(.smooth(duration: 0.2), value: atLimit)
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: bump)
        .onChange(of: text) { _, new in
            if let limit, new.count > limit {
                // `prefix` counts grapheme clusters, so a pasted emoji or combining accent is never cut in half.
                text = String(new.prefix(limit))
                bump += 1
                return
            }
            if isFocused {
                edited = true
                if validation == .live { armed = true }
            }
        }
        .onChange(of: isFocused) { wasFocused, nowFocused in
            if wasFocused && !nowFocused && edited && validation == .onBlur { armed = true }
        }
        .onChange(of: error) { old, new in
            guard let new, new != old else { return }
            AccessibilityNotification.Announcement("Error: \(new)").post()
        }
    }

    private var input: some View {
        TextField(label, text: $text, prompt: Text(isFocused ? prompt ?? "" : "").foregroundStyle(style.secondaryLabel), axis: axis)
            .font(.body)
            .foregroundStyle(style.label)
            .tint(style.label)
            .lineLimit(axis == .vertical ? 8 : 1)
            .focused($isFocused)
            .textContentType(textContentType)
            .keyboardType(keyboardType)
            .textInputAutocapitalization(plainEntry ? .never : nil)
            .autocorrectionDisabled(plainEntry)
            .submitLabel(submitLabel)
            .onSubmit {
                if edited || !text.isEmpty { armed = true }
                submitAction?()
            }
            .accessibilityLabel(label)
            .accessibilityValue(accessibilityValue)
            .accessibilityHint(shownError.map { "Error: \($0)" } ?? help ?? "")
    }

    private var accessibilityValue: String {
        guard let limit else { return text }
        let counter = "\(text.count.formatted()) of \(limit.formatted()) characters"
        return text.isEmpty ? counter : "\(text), \(counter)"
    }

    /// The error or help message on the leading side, the counter on the trailing side.
    @ViewBuilder
    private func footer(error: String?, count: Int, atLimit: Bool) -> some View {
        let still = reduceMotion
        if error != nil || help != nil || limit != nil {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                ZStack(alignment: .topLeading) {
                    if let error {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Image(systemName: "exclamationmark")
                                .font(.caption2.weight(.black))
                                .foregroundStyle(style.ink)
                                .frame(width: 16, height: 16)
                                .background(style.error, in: Circle())
                                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
                            Text(error)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(style.label)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .id(error)
                        .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                    } else if let help {
                        Text(help)
                            .font(.footnote)
                            .foregroundStyle(style.secondaryLabel)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .clipped()

                if let limit {
                    Text("\(count.formatted())/\(limit.formatted())")
                        .font(.footnote.weight(.semibold).monospacedDigit())
                        .foregroundStyle(atLimit ? style.ink : style.secondaryLabel)
                        .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(count)))
                        .padding(.horizontal, atLimit ? 8 : 0)
                        .padding(.vertical, atLimit ? 2 : 0)
                        .background(style.error.opacity(atLimit ? 1 : 0), in: Capsule())
                        .keyframeAnimator(initialValue: CGFloat(1), trigger: bump) { content, scale in
                            content.scaleEffect(still ? 1 : scale)
                        } keyframes: { _ in
                            SpringKeyframe(1.18, duration: 0.1, spring: .snappy)
                            SpringKeyframe(1, duration: 0.3, spring: .bouncy)
                        }
                        .animation(motion, value: count)
                }
            }
            .padding(.horizontal, 4)
            .accessibilityHidden(true)
        }
    }
}

extension View {
    /// Shows the validation result of every ``FormField`` inside, whether or not it has been edited. Turn it on when the
    /// person taps a submit button so empty required fields show their errors too.
    public func formFieldRevealsErrors(_ reveals: Bool = true) -> some View {
        environment(\.formFieldRevealsErrors, reveals)
    }
}

private struct FormFieldRevealsErrorsKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    fileprivate var formFieldRevealsErrors: Bool {
        get { self[FormFieldRevealsErrorsKey.self] }
        set { self[FormFieldRevealsErrorsKey.self] = newValue }
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

/// A profile form: Return moves Name to Email to Bio, Email validates after you leave it, Bio counts to 160.
private struct FormFieldExample: View {
    private enum Field: Hashable { case name, email, bio }

    @State private var name = ""
    @State private var email = ""
    @State private var bio = ""
    @State private var attempted = false
    @FocusState private var focus: Field?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FormField("Name", text: $name, textContentType: .name, submitLabel: .next, onSubmit: { focus = .email })
                    .focused($focus, equals: .name)

                FormField(
                    "Email",
                    text: $email,
                    prompt: "you@example.com",
                    help: "We send a sign-in link here.",
                    leading: Image(systemName: "envelope"),
                    validate: Self.checkEmail,
                    textContentType: .emailAddress,
                    keyboardType: .emailAddress,
                    submitLabel: .next,
                    onSubmit: { focus = .bio }
                )
                .focused($focus, equals: .email)

                FormField("Bio", text: $bio, prompt: "A line or two about you", limit: 160, axis: .vertical)
                    .focused($focus, equals: .bio)

                Button("Save") {
                    attempted = true
                    focus = nil
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(adaptive(light: 0xF4F3EF, dark: 0x141414))
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(adaptive(light: 0x141414, dark: 0xF4F3EF), in: .rect(cornerRadius: 18, style: .continuous))
                .padding(.top, 8)
            }
            .formFieldRevealsErrors(attempted)
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }

    private static func checkEmail(_ value: String) -> String? {
        let email = value.trimmingCharacters(in: .whitespaces)
        if email.isEmpty { return "Enter your email" }
        let parts = email.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !email.contains(" ") else { return "That doesn't look like an email" }
        let domain = parts[1]
        guard let dot = domain.lastIndex(of: "."), dot != domain.startIndex, domain.distance(from: dot, to: domain.endIndex) > 2 else {
            return "That doesn't look like an email"
        }
        return nil
    }
}

#Preview("Light") {
    FormFieldExample()
}

#Preview("Dark") {
    FormFieldExample()
        .preferredColorScheme(.dark)
}
