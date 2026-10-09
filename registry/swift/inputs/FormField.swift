// swiftpieces:
// title: Form Field
// description: A liquid glass text field whose label rests inside as a placeholder and glides up into a caption on focus or once filled, with an optional leading icon and help text. A clear bubble buds out of the field's end while you type, a character counter buds down out of it and turns butter at a grapheme-accurate limit, bumping when extra input is refused, and validation waits until you leave the field before drawing an error ring and budding a butter warning bubble with the message, an error haptic and a VoiceOver announcement, shakes the field once when Return or a form submit meets an error, and shows a quiet sage check once fixed.
// category: inputs
// minIOSVersion: "17.0"
// version: "1.2.0"
// added: "2026-09-23"
// tags: [textfield, form, floating-label, validation, character-limit, counter]

import SwiftUI

/// Text field with a floating label, help and error text, a character limit and a counter.
///
/// The field is a liquid glass shape. Whatever appears because of it buds out of it and melts back in: the clear
/// button out of its end while you type, the counter out of its bottom edge while it is focused or filled, and the
/// warning bubble that carries an error message. The bubbles rest joined to the field, so a liquid neck holds them.
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
///   - limit: Maximum length in characters (extended grapheme clusters, so an emoji or accented letter counts as one). Typing or pasting past it is trimmed without splitting a character, and a "12/50" counter buds out of the field while it is focused or filled.
///   - axis: `.horizontal` for one line; `.vertical` for a multiline field that grows up to eight lines, where Return inserts a newline.
///   - validation: When `validate` starts running. `.onBlur` (default) waits until the field has been edited and left once, then validates live. `.onSubmit` waits for Return. `.live` starts with the first edit.
///   - validate: Returns an error message for invalid text, or `nil` when valid. A sage check appears once the text is valid.
///   - error: An error from outside the field (e.g. "Email already in use" from a server). Shown immediately and ahead of `validate`.
///   - textContentType: Autofill hint, e.g. `.emailAddress`, `.name`, `.oneTimeCode`.
///   - keyboardType: Keyboard. `.emailAddress` and `.URL` also turn off autocapitalization and autocorrection.
///   - submitLabel: The Return key label, e.g. `.next` or `.done`.
///   - onSubmit: Called when Return is pressed in a one-line field. Move focus to the next field here.
///   - style: Colors and field metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
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
        /// The glass tint of the field. `.clear`, the default, leaves it neutral glass.
        public var field: Color
        /// Typed text and the clear button's glyph.
        public var label: Color
        /// The label, prompt, icon, help text and counter.
        public var secondaryLabel: Color
        /// The 2pt ring while focused, drawn just inside the field's edge.
        public var focusRing: Color
        /// The error ring, the warning bubble and the counter's tint at the limit. Butter by default: a warning, never the signal red.
        public var error: Color
        /// The valid check.
        public var success: Color
        /// Glyphs and text on tinted glass and solid blocks.
        public var ink: Color
        /// Minimum field height, and the diameter of the clear bubble. Grows with Dynamic Type and multiline text.
        public var height: CGFloat
        /// Field corner radius.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(field: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, focusRing: Color? = nil, error: Color? = nil, success: Color? = nil, ink: Color? = nil, height: CGFloat = 56, cornerRadius: CGFloat = 18) {
            self.field = field ?? .clear
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.focusRing = focusRing ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.error = error ?? adaptive(light: 0xFFD976, dark: 0xFFD976)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.height = max(height, 44)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()
    }

    /// A submit that met an error. Each one shakes the field once. `repeated` marks an error that was already on
    /// screen, which plays its own error haptic; a new error plays one as it appears.
    private struct Refusal: Hashable {
        var count = 0
        var repeated = false
    }

    /// A submit as two renders see it: the error drawn, Returns pressed, and whether the form reveals errors. One
    /// handler compares them, so a Return that also reveals the form's errors refuses once, and an error counts as
    /// already showing only if the previous render drew it, whatever order other handlers run in.
    private struct SubmitGate: Equatable {
        var error: String?
        var returns: Int
        var reveals: Bool
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
    /// The counter's swell when a keystroke is refused at the limit.
    @State private var swell: CGFloat = 1
    @State private var returns = 0
    @State private var refusal = Refusal()
    /// The clear, counter and warning bubbles: out while they have something to say, melted into the field otherwise.
    @State private var buds = PieceBuds()
    /// The message the warning bubble carries. It outlives the error by the bubble's melt, so the text never changes
    /// under a bubble on its way home, and the help text returns only once the bubble is back inside the field.
    @State private var message: String?
    @ScaledMetric(relativeTo: .body) private var iconWidth: CGFloat = 22
    /// The counter's and the warning bubble's height, so the two read as one family under the field.
    @ScaledMetric(relativeTo: .footnote) private var pip: CGFloat = 24
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

    /// The clear bubble is as tall as the field at rest, so the two read as one control.
    private var bubble: CGFloat { style.height }

    public var body: some View {
        let error = shownError
        let floated = isFocused || !text.isEmpty
        let valid = validate != nil && (armed || revealsErrors) && !text.isEmpty && error == nil
        let showsClear = isFocused && !text.isEmpty && isEnabled
        let content = liquid(error: error, valid: valid, floated: floated)
        return budding(validating(content, error: error), error: error, floated: floated, showsClear: showsClear)
    }

    /// The field and everything that buds out of it, with the springs its own state changes land on.
    private func liquid(error: String?, valid: Bool, floated: Bool) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let count = text.count
        let atLimit = limit.map { count >= $0 } ?? false
        let multiline = axis == .vertical
        // While the clear bubble is out the field gives it its end: the field's trailing edge pulls back on the bud's
        // own spring, so the two part through a neck instead of the field jumping narrower.
        let column = buds.isOut("clear") ? bubble + PieceLiquid.joined : 0

        return PieceLiquidGroup {
            VStack(alignment: .leading, spacing: PieceLiquid.joined) {
                ZStack(alignment: multiline ? .topTrailing : .trailing) {
                    // Laid out first, so at home the bubble sits under the field's end and melts into it.
                    if buds.contains("clear") { clearBubble }
                    block(error: error, valid: valid)
                        .padding(.trailing, column)
                }
                // A refused submit shakes the field once, on the beat of the error haptic. The bubbles under it hold
                // still, so their necks stretch with it.
                .pieceShake(trigger: refusal.count)
                // Above the footer, so a counter or warning bubble at home slips under the field.
                .zIndex(1)

                footer(count: count, atLimit: atLimit, column: limit == nil ? 0 : column)
            }
        }
        .fontWeight(.semibold)
        .opacity(isEnabled ? 1 : 0.45)
        // When several of these change in one update the first listed wins, so an error keeps its own role when it
        // lands with a focus change. Focus answers with a snap: ring, icon and label, with a hint of give.
        .animation(error == nil ? motion.dismiss : motion.error, value: error)
        .animation(valid ? motion.snap : motion.dismiss, value: valid)
        .animation(motion.snap, value: isFocused)
        .animation(motion.snap, value: floated)
    }

    /// Haptics, the character limit and when validation starts.
    private func validating(_ content: some View, error: String?) -> some View {
        content
            // One error haptic per event: as an error appears, or on a refused submit when the error was already there.
            .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
            .sensoryFeedback(.error, trigger: refusal) { _, new in new.repeated }
            .sensoryFeedback(.impact(weight: SensoryFeedback.Weight.light, intensity: 0.7), trigger: bump)
            .onChange(of: text) { _, new in
                if let limit, new.count > limit {
                    // `prefix` counts grapheme clusters, so a pasted emoji or combining accent is never cut in half.
                    text = String(new.prefix(limit))
                    bump += 1
                    swellCounter()
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
            // A submit is Return in the field or the form revealing errors; a field still holding an error refuses it.
            // Both arrive on one key, so a Return whose onSubmit also reveals errors is one refusal, one haptic, one shake.
            .onChange(of: SubmitGate(error: error, returns: returns, reveals: revealsErrors)) { old, new in
                let submitted = new.returns != old.returns || (new.reveals && !old.reveals)
                guard submitted, new.error != nil else { return }
                refusal = Refusal(count: refusal.count + 1, repeated: old.error != nil)
            }
    }

    /// The bud cycle of each bubble, and the error announcement.
    private func budding(_ content: some View, error: String?, floated: Bool, showsClear: Bool) -> some View {
        content
            .onChange(of: showsClear) { _, shows in cycle("clear", out: shows) }
            // The counter comes out with the floating label: while the field is focused or holds text.
            .onChange(of: floated) { _, floats in
                if limit != nil { cycle("counter", out: floats) }
            }
            .onChange(of: error) { old, new in warn(old: old, new: new) }
            .onAppear {
                message = error
                var placed: [String] = []
                if showsClear { placed.append("clear") }
                if limit != nil && floated { placed.append("counter") }
                if error != nil { placed.append("error") }
                buds.place(placed)
            }
    }

    /// A refused keystroke pushes the counter against its bound: it swells on a tight spring and rebounds with give.
    /// Driven from state rather than a keyframe animator, whose closure cannot reach the glass scale.
    private func swellCounter() {
        withAnimation(.spring(PieceMotion.tight)) { swell = 1.12 }
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            withAnimation(.spring(PieceMotion.elastic)) { swell = 1 }
        }
    }

    /// Sends a bubble out of the field, or calls it home.
    private func cycle(_ id: String, out: Bool) {
        Task {
            if out { await buds.bloom([id], reduceMotion: reduceMotion) } else { await buds.gather([id], reduceMotion: reduceMotion) }
        }
    }

    /// An error arrives, changes or clears. The warning bubble carries it out of the field and melts home once it is
    /// fixed; the help text comes back only after the bubble is home.
    private func warn(old: String?, new: String?) {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        guard let new else {
            Task {
                await buds.gather(["error"], reduceMotion: reduceMotion)
                // A new error may have arrived while this one melted; only an empty slot gives the help text back.
                if !buds.contains("error") { withAnimation(motion.reveal) { message = nil } }
            }
            return
        }
        if new != old { AccessibilityNotification.Announcement("Error: \(new)").post() }
        // The help text blurs away as the bubble starts out; a new message for a bubble already out blurs in place.
        withAnimation(message == nil ? motion.dismiss : motion.error) { message = new }
        if !buds.isOut("error") { cycle("error", out: true) }
    }

    /// The field itself: a glass shape holding the icon, the floating label, the input and the valid check.
    private func block(error: String?, valid: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        let multiline = axis == .vertical
        let floated = isFocused || !text.isEmpty
        // Once validation starts the check keeps a slot while there is text, so typing never reflows as it turns valid
        // or invalid. An empty field gives the slot back, so its resting label keeps the full width.
        let checks = validate != nil && (armed || revealsErrors) && !text.isEmpty
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let still = reduceMotion

        return HStack(alignment: multiline ? .top : .center, spacing: 10) {
            if let leading {
                leading
                    .font(.body)
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

            if checks {
                ZStack {
                    if valid {
                        // A status mark inside the glass, not a control: it blurs in and out like any glyph swap.
                        Image(systemName: "checkmark")
                            .font(.caption)
                            .foregroundStyle(style.ink)
                            .frame(width: 24, height: 24)
                            .background(style.success, in: Circle())
                            .transition(motion.swap)
                    }
                }
                .frame(width: 24, height: 24)
                .padding(.top, multiline ? 14 : 0)
                .transition(motion.swap)
                .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, minHeight: style.height, alignment: .leading)
        .background {
            // Taps on the padding, icon or label still focus the field.
            shape.fill(.clear)
                .contentShape(shape)
                .onTapGesture { isFocused = true }
        }
        // The ring is drawn inside the glass: on iOS 26 a glass container takes in whatever is layered over a glass
        // shape after it, and the ring would all but vanish. It sits a few points in from the edge, so the clear
        // bubble and the counter bud from clean glass and their necks never cut through it.
        .overlay {
            RoundedRectangle(cornerRadius: max(style.cornerRadius - 3, 0), style: .continuous)
                .strokeBorder(error != nil ? style.error : style.focusRing, lineWidth: 2)
                .padding(3)
                .opacity(error != nil || isFocused ? 1 : 0)
                // Reduce Motion has no shake, so a refused submit dims the error ring for a beat instead. One branch,
                // gated by value, so toggling Reduce Motion never rebuilds the field.
                .keyframeAnimator(initialValue: 1.0, trigger: refusal.count) { ring, level in
                    ring.opacity(still ? level : 1)
                } keyframes: { _ in
                    SpringKeyframe(0.2, duration: 0.1, spring: PieceMotion.tight)
                    SpringKeyframe(1, spring: PieceMotion.calm)
                }
                .allowsHitTesting(false)
        }
        .pieceLiquid(shape, tint: style.field == .clear ? nil : style.field, interactive: false)
    }

    /// A round glass bubble out of the field's end while it is focused and holds text. It clears at once and keeps the
    /// keyboard up. Home is just inside the field's end, which covers it while the two are one shape.
    private var clearBubble: some View {
        let out = buds.isOut("clear")
        return Button {
            text = ""
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(style.label)
                .pieceBudContent(out: out)
                .frame(width: bubble, height: bubble)
                .contentShape(.circle)
                .pieceLiquid(.circle, interactive: false)
        }
        .buttonStyle(PieceLiquidPressStyle())
        .pieceBud(out: out, home: CGSize(width: bubble * (1 - PieceLiquid.homeScale) / 2, height: 0))
        .accessibilityLabel("Clear \(label)")
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
                // Return is a submit: the gate in `body` refuses it if an error stands once this lands.
                returns += 1
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

    /// The warning bubble and its message, or the help text, on the leading side; the counter on the trailing side,
    /// kept under the field's end while the clear bubble holds the column beside it.
    @ViewBuilder
    private func footer(count: Int, atLimit: Bool, column: CGFloat) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        if message != nil || help != nil || limit != nil {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                ZStack(alignment: .topLeading) {
                    if let message {
                        let out = buds.isOut("error")
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            // The bubble's place keeps its size while the bubble is home, so the message never shifts.
                            Color.clear
                                .frame(width: pip, height: pip)
                                .overlay {
                                    if buds.contains("error") { warningBubble(out: out) }
                                }
                                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
                            ZStack(alignment: .topLeading) {
                                Text(message)
                                    .font(.footnote)
                                    .foregroundStyle(style.label)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .id(message)
                                    .transition(motion.swap)
                            }
                            // The message is the bubble's label: it arrives just after the bubble leaves the field and
                            // is gone the moment it heads home.
                            .pieceBudContent(out: out)
                        }
                        .transition(.identity)
                    } else if let help {
                        Text(help)
                            .font(.footnote)
                            .foregroundStyle(style.secondaryLabel)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(motion.swap)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let limit { counter(count: count, limit: limit, atLimit: atLimit) }
            }
            .padding(.leading, 4)
            .padding(.trailing, 4 + column)
            .accessibilityHidden(true)
        }
    }

    /// How far up a bubble under the field travels to get home: its shrunk self ends up two points inside the field's
    /// bottom edge, deep enough to clear the field's rounded corner.
    private var footerHome: CGFloat { PieceLiquid.joined + pip / 2 + pip * PieceLiquid.homeScale / 2 + 2 }

    /// The butter bubble that carries an error. Home is just inside the field's bottom edge, above it.
    private func warningBubble(out: Bool) -> some View {
        Image(systemName: "exclamationmark")
            .font(.system(size: pip * 0.5, weight: .semibold))
            .foregroundStyle(style.ink)
            .pieceBudContent(out: out)
            .frame(width: pip, height: pip)
            // Its tint drains as it melts, so it dissolves into the field rather than sitting on it.
            .pieceLiquid(.circle, tint: out ? style.error : nil, interactive: false)
            .pieceBud(out: out, home: CGSize(width: 0, height: -footerHome))
    }

    /// "12/160" on a glass capsule that buds down out of the field. Its place in the footer is kept while it is home,
    /// so nothing beside it shifts or rewraps as it comes and goes.
    private func counter(count: Int, limit: Int, atLimit: Bool) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let still = reduceMotion
        // An over-limit edit renders for a frame before the trim, so the counter never shows past the limit.
        let shown = min(count, limit)
        let reading = "\(shown.formatted())/\(limit.formatted())"
        let out = buds.isOut("counter")
        return Text(verbatim: reading)
            .font(.footnote.monospacedDigit())
            .padding(.horizontal, 9)
            .frame(minHeight: pip)
            .hidden()
            .overlay {
                if buds.contains("counter") {
                    Text(verbatim: reading)
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(atLimit ? style.ink : style.secondaryLabel)
                        .contentTransition(reduceMotion ? .opacity : .numericText(value: Double(shown)))
                        // A count: the digits roll without overshoot, so they never pass the true value.
                        .animation(motion.value, value: shown)
                        .pieceBudContent(out: out)
                        .padding(.horizontal, 9)
                        .frame(minHeight: pip)
                        // At the limit the capsule floods butter; it drains again as it melts or the text gets shorter.
                        .pieceLiquid(.capsule, tint: atLimit && out ? style.error : nil, interactive: false)
                        .animation(motion.snap, value: atLimit)
                        // A refused keystroke pushes the value against its bound and it rebounds, the capsule and its
                        // digits together (a plain scaleEffect would leave the glass behind). Reduce Motion dims it for a beat.
                        .pieceLiquidScale(still ? 1 : swell)
                        .opacity(still ? 1 - Double(max(swell - 1, 0)) * 3 : 1)
                        .pieceBud(out: out, home: CGSize(width: 0, height: -footerHome))
                }
            }
    }
}

extension View {
    /// Shows the validation result of every ``FormField`` inside, whether or not it has been edited. Turn it on when the
    /// person taps a submit button so empty required fields show their errors too. Each field holding an error as it
    /// turns on shakes once.
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
    Color(uiColor: UIColor { @Sendable traits in
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

                // The form's primary action: a signal glass capsule with house ink.
                PieceLiquidGroup {
                    Button {
                        attempted = true
                        focus = nil
                    } label: {
                        Text("Save")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(adaptive(light: 0x141414, dark: 0x141414))
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .contentShape(.capsule)
                            .pieceLiquid(.capsule, tint: adaptive(light: 0xFF0000, dark: 0xFF0000), interactive: false)
                    }
                    .buttonStyle(PieceLiquidPressStyle())
                }
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

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, shake)

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

/// A short decaying side-to-side shake for refused input, each time `trigger` changes. Under Reduce Motion it stays
/// still (same view, no identity change): pair it with a color or message change and the error haptic.
private struct PieceShake: ViewModifier {
    let trigger: AnyHashable
    var distance: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance = reduceMotion ? 0 : distance
        content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-distance, duration: 0.06)
                CubicKeyframe(distance * 0.75, duration: 0.07)
                CubicKeyframe(-distance * 0.5, duration: 0.07)
                CubicKeyframe(distance * 0.25, duration: 0.06)
                SpringKeyframe(0, duration: 0.12, spring: Spring(duration: 0.18, bounce: 0))
            }
        }
    }
}

private extension View {
    /// Shakes this view side to side once each time `trigger` changes, for input that was refused.
    func pieceShake(trigger: some Hashable & Sendable, distance: CGFloat = 8) -> some View {
        modifier(PieceShake(trigger: AnyHashable(trigger), distance: distance))
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud)

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

/// The bud: how a bubble leaves and rejoins its parent, driven explicitly so every bubble shows the whole cycle.
///
/// A bubble is born at `home`, inside its parent, where the two glass shapes are one. It springs out to `rest`, and
/// while it is inside the merge distance a neck holds it to the parent, thinning as it goes, until it snaps free.
/// Going home it springs back on a spring with no bounce, the neck reaches out and re-forms, and only once it has
/// melted all the way in is it removed. Both offsets are relative to where the bubble is laid out. Under Reduce
/// Motion it stays at `rest`: its content fades and its glass closes in place.
private struct PieceBud: ViewModifier {
    var out: Bool
    var rest: CGSize
    var home: CGSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            // No travel. Inside a group glass ignores opacity, so the glass closes to nothing in place on the short
            // Reduce Motion ease while its content fades; the opacity covers a bubble outside a group.
            content
                .pieceLiquidScale(out ? 1 : 0.001)
                .opacity(out ? 1 : 0)
                .offset(rest)
        } else {
            // The glass shrinks through `pieceLiquidScale`, never a plain scaleEffect (see there), then moves.
            content
                .pieceLiquidScale(out ? 1 : PieceLiquid.homeScale)
                .offset(out ? rest : home)
        }
    }
}

/// A bubble's own content, on its own clock: gone the moment the bubble heads home, so it never rides over the
/// parent's content, and arriving just after the bubble leaves.
private struct PieceBudContent: ViewModifier {
    var out: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: out ? 0 : 6)
            .opacity(out ? 1 : 0)
            .animation(out ? .easeOut(duration: 0.3).delay(0.1) : .easeOut(duration: 0.14), value: out)
    }
}

private extension View {
    /// Places a bubble at `rest` while `out`, and at `home` (inside its parent, shrunk) while not.
    func pieceBud(out: Bool, rest: CGSize = .zero, home: CGSize) -> some View {
        modifier(PieceBud(out: out, rest: rest, home: home))
    }

    /// Hides a bubble's icon or label while it is home. Put it on the content, inside the glass.
    func pieceBudContent(out: Bool) -> some View {
        modifier(PieceBudContent(out: out))
    }
}

/// Which bubbles exist and which are out. A bubble is added home with no animation, sent out on the next frame,
/// and called home before it is removed, so it always melts in rather than fading. Keep one in `@State`.
@MainActor @Observable
private final class PieceBuds {
    private(set) var present: [String] = []
    private(set) var out: Set<String> = []
    /// The latest call for each bubble. A bloom or gather that has been overtaken (a bubble sent home while it was
    /// still waiting to go out, or called out again while melting) leaves that bubble alone.
    @ObservationIgnored private var turn: [String: Int] = [:]

    func contains(_ id: String) -> Bool { present.contains(id) }
    func isOut(_ id: String) -> Bool { out.contains(id) }

    private func claim(_ ids: [String]) -> [String: Int] {
        var mine: [String: Int] = [:]
        for id in ids {
            let next = (turn[id] ?? 0) + 1
            turn[id] = next
            mine[id] = next
        }
        return mine
    }

    /// Puts bubbles straight out at rest with no motion: a view's first frame, or a state restored.
    func place(_ ids: [String]) {
        _ = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
            out.formUnion(ids)
        }
    }

    /// Adds bubbles home, then sends each out, `stagger` seconds apart, after an optional `delay`.
    func bloom(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.05, delay: Double = 0) async {
        let mine = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
        }
        try? await Task.sleep(for: .milliseconds(24 + Int(max(delay, 0) * 1000)))
        let split = PieceLiquid.split(reduceMotion: reduceMotion)
        for (i, id) in ids.enumerated() where turn[id] == mine[id] {
            withAnimation(split.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.insert(id) }
        }
    }

    /// Calls bubbles home, last first, then removes them once they have melted in.
    func gather(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.04) async {
        let mine = claim(ids)
        let home = PieceLiquid.home(reduceMotion: reduceMotion)
        for (i, id) in ids.reversed().enumerated() {
            withAnimation(home.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.remove(id) }
        }
        try? await Task.sleep(for: .milliseconds(Int((0.52 + Double(ids.count) * stagger) * 1000)))
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { present.removeAll { ids.contains($0) && !out.contains($0) && turn[$0] == mine[$0] } }
    }
}

// swiftpieces-liquid: end
