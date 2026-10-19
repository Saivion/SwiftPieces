// swiftpieces:
// title: Sign In
// description: "A sign-in section: email and password fields that validate before anything is sent, one Sign in button that runs your async closure through working, signed in and failed, and Sign in with Apple and Create account when you pass their handlers."
// category: auth
// version: "1.0.0"
// minIOSVersion: "17.0"
// added: "2026-10-19"
// tags: [auth, sign-in, login, form, password, sign-in-with-apple]
// registryDependencies: [FormField, SecureEntry, CommitButton]

import SwiftUI
import AuthenticationServices

/// A sign-in section: a heading, email and password, and one Sign in button wired to your auth.
///
/// The pieces carry the interaction. The email is a `FormField` that validates once it has been left, and Return in it
/// moves focus to the password, a `SecureEntry` set up for signing in, without the strength meter or requirement chips
/// that belong to sign-up. Return in the password, or the `CommitButton`, signs in. An invalid email or an empty
/// password is refused by the fields themselves (their errors show, the field shakes) and your closure is not called.
/// Otherwise the button loads while `onSignIn` runs, turns sage when it returns and hands off through `onSignedIn`, or
/// shows the thrown error on the button and under the password. The block owns the password; the email can be yours.
/// Sign in with Apple, the Forgot password link and the Create account footer appear only when you pass their handlers.
///
/// - Parameters:
///   - title: The heading, e.g. "Welcome back". `nil` hides it, for a screen that has its own.
///   - subtitle: One line under the title in secondary ink. `nil` hides it.
///   - mark: Your app's mark above the title, drawn 52pt square with continuous rounded corners. `nil` hides it.
///   - email: The email, for an app that prefills a returning person's address or keeps it after sign-in. `nil` lets the block keep its own.
///   - onForgotPassword: Shows a "Forgot password?" link beside the password's caption. Receives the email typed so far, so your reset screen can prefill it.
///   - onSignInWithApple: Shows a Sign in with Apple button under an "or" divider. Receives the Apple ID credential (requested with the name and email scopes) to exchange with your backend; throw to show an error under the button. Needs the Sign in with Apple capability.
///   - onCreateAccount: Shows a "New here? Create an account" footer.
///   - onSignedIn: Called once a sign-in has succeeded and its success has landed on screen, about a second after your closure returns. Switch screens here.
///   - onSignIn: Your auth. Receives the trimmed email and the password; return to succeed, throw to fail. A thrown `LocalizedError`'s description is shown, otherwise "Couldn't sign in".
public struct SignInBlock: View {
    private enum Field: Hashable { case email, password }

    /// The Sign in with Apple button's own progress: covered while your handler runs, then a beat of success.
    private enum AppleState: Equatable { case idle, working, done }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var focus: Field?
    @State private var ownEmail = ""
    @State private var password = ""
    @State private var passwordError: String?
    @State private var phase: CommitButton.Phase = .idle
    /// Set by the first submit, so every field shows its validation from then on.
    @State private var attempted = false
    /// Refused submits after the first. The fields shake once as their errors appear; a refusal while they already
    /// show gets its error haptic here instead.
    @State private var refusals = 0
    @State private var apple: AppleState = .idle
    @State private var appleError: String?
    @State private var onScreen = false
    /// The form's width, so a failure's message goes on the button only when it fits there.
    @State private var formWidth: CGFloat = 350
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize: CGFloat = 32

    private let title: String?
    private let subtitle: String?
    private let mark: Image?
    private let email: Binding<String>?
    private let onForgotPassword: ((String) -> Void)?
    private let onSignInWithApple: (@MainActor (ASAuthorizationAppleIDCredential) async throws -> Void)?
    private let onCreateAccount: (() -> Void)?
    private let onSignedIn: (() -> Void)?
    private let onSignIn: @MainActor (_ email: String, _ password: String) async throws -> Void

    public init(
        title: String? = "Welcome back",
        subtitle: String? = nil,
        mark: Image? = nil,
        email: Binding<String>? = nil,
        onForgotPassword: ((String) -> Void)? = nil,
        onSignInWithApple: (@MainActor (ASAuthorizationAppleIDCredential) async throws -> Void)? = nil,
        onCreateAccount: (() -> Void)? = nil,
        onSignedIn: (() -> Void)? = nil,
        onSignIn: @escaping @MainActor (_ email: String, _ password: String) async throws -> Void
    ) {
        self.title = title
        self.subtitle = subtitle
        self.mark = mark
        self.email = email
        self.onForgotPassword = onForgotPassword
        self.onSignInWithApple = onSignInWithApple
        self.onCreateAccount = onCreateAccount
        self.onSignedIn = onSignedIn
        self.onSignIn = onSignIn
    }

    private var emailText: Binding<String> { email ?? $ownEmail }

    /// While a sign-in runs or has just succeeded, nothing in the block takes another tap.
    private var locked: Bool { phase == .loading || phase == .success || apple != .idle }

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(alignment: .leading, spacing: 0) {
            if mark != nil || title != nil || subtitle != nil {
                heading.padding(.bottom, 28)
            }
            form
            if onSignInWithApple != nil {
                appleSection.padding(.top, 22)
            }
            if let onCreateAccount {
                footer(onCreateAccount).padding(.top, 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .fontWeight(.semibold)
        .sensoryFeedback(.error, trigger: refusals)
        .animation(appleError == nil ? motion.dismiss : motion.reveal, value: appleError)
        .animation(motion.snap, value: apple)
        .onAppear { onScreen = true }
        .onDisappear { onScreen = false }
    }

    // MARK: Heading

    private var heading: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let mark {
                let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
                mark
                    .resizable()
                    .scaledToFill()
                    .frame(width: 52, height: 52)
                    .clipShape(shape)
                    // A hairline keeps a dark mark on a dark screen (or a light one on paper) from losing its edge.
                    .overlay { shape.strokeBorder(Ink.hairline, lineWidth: 1) }
                    .padding(.bottom, 20)
                    .accessibilityHidden(true)
            }
            if let title {
                Text(title)
                    .font(.system(size: titleSize, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Ink.label)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
            }
            if let subtitle {
                Text(subtitle)
                    .font(.body)
                    .foregroundStyle(Ink.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
            }
        }
    }

    // MARK: Form

    private var form: some View {
        VStack(alignment: .leading, spacing: 24) {
            FormField(
                "Email",
                text: emailText,
                prompt: "you@example.com",
                leading: Image(systemName: "envelope"),
                validate: Self.emailProblem,
                textContentType: .username,
                keyboardType: .emailAddress,
                submitLabel: .next,
                onSubmit: {
                    // The field refuses an invalid email on Return by itself (its error shows, it shakes), so focus
                    // only moves on once the address reads right.
                    if Self.emailProblem(emailText.wrappedValue) == nil { focus = .password }
                }
            )
            .focused($focus, equals: .email)

            passwordField

            CommitButton("Sign in", phase: $phase, successHold: .milliseconds(1200), successTitle: "Signed in") {
                submit()
            }
            // Its label sits on one line in a 56pt capsule, so it stops growing at the first accessibility size, where
            // "Signed in" and "Try again" still fit at 320pt wide. A long press shows it larger.
            .dynamicTypeSize(...Self.buttonTextCap)
            .accessibilityShowsLargeContentViewer()
        }
        // After the first submit every field shows its validation, including one never touched.
        .formFieldRevealsErrors(attempted)
        .allowsHitTesting(!locked)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { formWidth = $0 }
        .onChange(of: password) { _, _ in clearFailure() }
        .onChange(of: emailText.wrappedValue) { _, _ in clearFailure() }
    }

    /// The password, set up for signing in, with the Forgot password link beside its caption. At accessibility text
    /// sizes the caption and the link can't share a line, so the link moves under the field.
    @ViewBuilder private var passwordField: some View {
        let entry = SecureEntry("Password", text: $password, error: passwordError, showsStrength: false, showsRequirements: false)
            .focused($focus, equals: .password)
            .submitLabel(.go)
            .onSubmit { submit() }
        if let onForgotPassword {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    entry
                    forgotLink(onForgotPassword).frame(minHeight: 44)
                }
            } else {
                // On the caption's baseline. The link's 44pt target reaches up into the space above the caption rather
                // than down over the field.
                entry.overlay(alignment: Alignment(horizontal: .trailing, vertical: .firstTextBaseline)) {
                    forgotLink(onForgotPassword)
                        .padding(.bottom, 6)
                        .frame(minHeight: 44, alignment: .bottom)
                        .padding(.leading, 12)
                        .contentShape(.rect)
                }
            }
        } else {
            entry
        }
    }

    private func forgotLink(_ action: @escaping (String) -> Void) -> some View {
        Button("Forgot password?") {
            action(emailText.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        .font(.footnote)
        .buttonStyle(LinkStyle())
    }

    // MARK: Sign in with Apple

    private var appleSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Ink.hairline.frame(height: 1)
                Text("or")
                    .font(.footnote)
                    .foregroundStyle(Ink.secondary)
                Ink.hairline.frame(height: 1)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("or")

            VStack(alignment: .leading, spacing: 12) {
                appleButton
                if let appleError {
                    notice(appleError)
                        .transition(PieceMotion(reduceMotion: reduceMotion).swap)
                }
            }
        }
    }

    /// The system button, in the colour that reads on this appearance, at the Sign in button's height and shape.
    /// While your handler runs a capsule of the same colour covers it with a spinner, then a check.
    private var appleButton: some View {
        let shape = Capsule()
        return SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            appleFinished(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        // The system button keeps the style it was made with, so a change of appearance makes a new one.
        .id(colorScheme)
        .frame(height: 56)
        .clipShape(shape)
        .overlay {
            if apple != .idle {
                appleProgress
                    .transition(PieceMotion(reduceMotion: reduceMotion).swap)
            }
        }
        .allowsHitTesting(!locked)
        .accessibilityHidden(apple != .idle)
    }

    private var appleProgress: some View {
        let dark = colorScheme == .dark
        let fill = dark ? Color.white : Color.black
        let ink = dark ? Color.black : Color.white
        return HStack(spacing: 10) {
            if apple == .done {
                Image(systemName: "checkmark")
                Text("Signed in")
            } else {
                ProgressView().tint(ink)
                Text("Signing in")
            }
        }
        .font(.body)
        .foregroundStyle(ink)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(fill, in: Capsule())
        .accessibilityElement(children: .combine)
    }

    /// An error that belongs to no field: a small butter mark and the message, in the block's own ink.
    private func notice(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "exclamationmark")
                .font(.caption2)
                .foregroundStyle(Ink.onButter)
                .frame(width: 20, height: 20)
                .background(Ink.butter, in: Circle())
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
                .accessibilityHidden(true)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Ink.label)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.leading, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Error: \(message)")
    }

    // MARK: Footer

    private func footer(_ action: @escaping () -> Void) -> some View {
        let prompt = Text("New here?").foregroundStyle(Ink.secondary)
        let link = Button("Create an account", action: action).buttonStyle(LinkStyle())
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 5) { prompt; link }
            VStack(spacing: 0) { prompt; link }
        }
        .font(.subheadline)
        .frame(minHeight: 44)
        .frame(maxWidth: .infinity)
    }

    // MARK: Signing in

    private func submit() {
        guard !locked else { return }
        let address = emailText.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let emailProblem = Self.emailProblem(address)
        let passwordProblem: String? = password.isEmpty ? "Enter your password" : nil
        if emailProblem != nil || passwordProblem != nil {
            // The first refusal reveals the fields' errors, and each field shakes with its own haptic. Later ones find
            // the errors already showing, so the haptic comes from here.
            if attempted { refusals += 1 }
            attempted = true
            if let passwordProblem {
                passwordError = passwordProblem
                // The email field announces its own error; the password field's chip is only read when reached.
                if emailProblem == nil { AccessibilityNotification.Announcement(passwordProblem).post() }
            }
            focus = emailProblem != nil ? .email : .password
            return
        }
        attempted = true
        focus = nil
        passwordError = nil
        appleError = nil
        phase = .loading
        Task { await signIn(address) }
    }

    private func signIn(_ address: String) async {
        do {
            try await onSignIn(address, password)
            phase = .success
            // Hand off once the ring has closed and the label has turned to "Signed in".
            try? await Task.sleep(for: .milliseconds(1000))
            if onScreen { onSignedIn?() }
        } catch is CancellationError {
            phase = .idle
        } catch {
            let message = Self.message(for: error)
            phase = .error(buttonText(for: message))
            passwordError = message
            AccessibilityNotification.Announcement(message).post()
        }
    }

    private func appleFinished(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let authorization):
            guard let handler = onSignInWithApple, let credential = authorization.credential as? ASAuthorizationAppleIDCredential else { return }
            appleError = nil
            passwordError = nil
            if case .error = phase { phase = .idle }
            apple = .working
            Task {
                do {
                    try await handler(credential)
                    apple = .done
                    try? await Task.sleep(for: .milliseconds(1000))
                    if onScreen { onSignedIn?() }
                    try? await Task.sleep(for: .milliseconds(600))
                    apple = .idle
                } catch {
                    apple = .idle
                    let message = Self.message(for: error)
                    appleError = message
                    AccessibilityNotification.Announcement(message).post()
                }
            }
        case .failure(let error):
            // Closing the system sheet is a choice, not a failure.
            if let error = error as? ASAuthorizationError, error.code == .canceled { return }
            appleError = "Couldn't sign in with Apple. Try again."
        }
    }

    /// Editing either field after a failure clears it, so the next attempt starts clean and a new error shakes again.
    private func clearFailure() {
        if passwordError != nil { passwordError = nil }
        if case .error = phase { phase = .idle }
        if appleError != nil { appleError = nil }
    }

    /// The largest text size the Sign in button's label grows to.
    private static let buttonTextCap = DynamicTypeSize.accessibility1

    /// What the button says about a failure: the message itself when it fits on one line beside the retry bubble,
    /// otherwise a shorter form. The button's label never wraps, and the password field always carries the whole message.
    private func buttonText(for message: String) -> String {
        let size = min(dynamicTypeSize, Self.buttonTextCap)
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size))
        let font = UIFont.systemFont(ofSize: UIFont.preferredFont(forTextStyle: .body, compatibleWith: traits).pointSize, weight: .semibold)
        // The capsule beside the 56pt retry bubble and their 4pt neck, less the label's 28pt padding each side. The
        // label is laid out letter by letter, without kerning, so it runs a little wider than the measured string.
        let room = formWidth - 56 - 4 - 56
        let fits = { (text: String) in (text as NSString).size(withAttributes: [.font: font]).width * 1.06 <= room }
        return [message, "Couldn't sign in", "Try again"].first(where: fits) ?? "Try again"
    }

    private static func message(for error: any Error) -> String {
        if let error = error as? any LocalizedError, let text = error.errorDescription, !text.isEmpty { return text }
        return "Couldn't sign in"
    }

    /// The email check: something before an @, a domain with a dot, no spaces. Your server has the final word.
    nonisolated private static func emailProblem(_ value: String) -> String? {
        let email = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if email.isEmpty { return "Enter your email" }
        let parts = email.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !email.contains(" ") else { return "That doesn't look like an email" }
        let domain = parts[1]
        guard let dot = domain.lastIndex(of: "."), dot != domain.startIndex, domain.distance(from: dot, to: domain.endIndex) > 2 else {
            return "That doesn't look like an email"
        }
        return nil
    }

    /// The block's text links: ink, semibold like everything else, dimming under the finger.
    private struct LinkStyle: ButtonStyle {
        @Environment(\.accessibilityReduceMotion) private var reduceMotion

        func makeBody(configuration: Configuration) -> some View {
            let motion = PieceMotion(reduceMotion: reduceMotion)
            configuration.label
                .foregroundStyle(Ink.label)
                .opacity(configuration.isPressed ? 0.45 : 1)
                .animation(configuration.isPressed ? motion.press : motion.release, value: configuration.isPressed)
        }
    }
}

/// The block's own ink, from the house palette. The pieces inside bring their own `Style` defaults.
private enum Ink {
    static let label = adaptive(light: 0x141414, dark: 0xF4F3EF)
    static let secondary = adaptive(light: 0x5C5A56, dark: 0xA6A49F)
    static let hairline = adaptive(light: 0xDEDCD6, dark: 0x2C2C2C)
    static let butter = adaptive(light: 0xFFD976, dark: 0xFFD976)
    static let onButter = adaptive(light: 0x141414, dark: 0x141414)
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

#Preview("Usage") {
    SignInBlock { email, password in
        try await Auth.signIn(email: email, password: password)
    }
    .padding(20)
}

// MARK: - Example

/// Folio, a fictional reading app: its mark, the full set of options, and a fake auth that takes a moment and refuses
/// any password shorter than eight characters, so both outcomes can be tried.
private struct SignInBlockExample: View {
    @State private var email = ""
    @State private var mark = SignInExampleMark.render()

    var body: some View {
        ScrollView {
            SignInBlock(
                title: "Welcome back",
                subtitle: "Sign in to sync your shelves and notes.",
                mark: mark,
                email: $email,
                onForgotPassword: { _ in },
                onSignInWithApple: { _ in try await Auth.signInWithApple() },
                onCreateAccount: {}
            ) { email, password in
                try await Auth.signIn(email: email, password: password)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 32)
        }
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

/// A stand-in for your auth: it waits like a network call would.
private enum Auth {
    enum Failure: LocalizedError {
        case wrongPassword

        var errorDescription: String? { "Wrong email or password" }
    }

    static func signIn(email: String, password: String) async throws {
        try await Task.sleep(for: .milliseconds(1200))
        if password.count < 8 { throw Failure.wrongPassword }
    }

    static func signInWithApple() async throws {
        try await Task.sleep(for: .milliseconds(1200))
    }
}

/// Folio's mark, drawn in code so the example needs no asset: a cream bookmark ribbon hanging into an ink tile.
private enum SignInExampleMark {
    static func render() -> Image {
        let side: CGFloat = 156
        let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { context in
            UIColor(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 0, width: side, height: side))
            let ribbon = UIBezierPath()
            ribbon.move(to: CGPoint(x: side * 0.35, y: 0))
            ribbon.addLine(to: CGPoint(x: side * 0.65, y: 0))
            ribbon.addLine(to: CGPoint(x: side * 0.65, y: side * 0.72))
            ribbon.addLine(to: CGPoint(x: side * 0.5, y: side * 0.6))
            ribbon.addLine(to: CGPoint(x: side * 0.35, y: side * 0.72))
            ribbon.close()
            UIColor(red: 0xF4 / 255, green: 0xF3 / 255, blue: 0xEF / 255, alpha: 1).setFill()
            ribbon.fill()
        }
        return Image(uiImage: image)
    }
}

#Preview("Example") {
    SignInBlockExample()
}

#Preview("Dark") {
    SignInBlockExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

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

// swiftpieces-motion: end
