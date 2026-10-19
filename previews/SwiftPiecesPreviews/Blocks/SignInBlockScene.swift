import SwiftUI

/// The SignInBlock recording scene (PreviewCatalog): the block as it sits at the top of a first-run screen, with
/// Folio's mark, every option on, and a fake auth that succeeds after 1.2s (any password shorter than eight
/// characters is refused, to record the failure).
struct SignInBlockScene: View {
    @State private var email = ""
    @State private var mark = SignInSceneMark.render()

    var body: some View {
        ScrollView {
            SignInBlock(
                title: "Welcome back",
                subtitle: "Sign in to sync your shelves and notes.",
                mark: mark,
                email: $email,
                onForgotPassword: { _ in },
                onSignInWithApple: { _ in try await Task.sleep(for: .milliseconds(1200)) },
                onCreateAccount: {}
            ) { _, password in
                try await Task.sleep(for: .milliseconds(1200))
                if password.count < 8 { throw SignInSceneFailure.wrongPassword }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 32)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(SignInSceneMark.ground)
    }
}

private enum SignInSceneFailure: LocalizedError {
    case wrongPassword

    var errorDescription: String? { "Wrong email or password" }
}

/// Folio's mark, as the block's example draws it: a cream bookmark ribbon hanging into an ink tile.
private enum SignInSceneMark {
    static let ground = Color(uiColor: UIColor { @Sendable traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x12 / 255, green: 0x12 / 255, blue: 0x12 / 255, alpha: 1)
            : UIColor(red: 0xF3 / 255, green: 0xF2 / 255, blue: 0xEE / 255, alpha: 1)
    })

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
