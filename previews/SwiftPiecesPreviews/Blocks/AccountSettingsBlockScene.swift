import SwiftUI

/// The AccountSettingsBlock recording scene (PreviewCatalog): the block in a Settings screen, with sample data, the
/// appearance it sets applied to the screen, and fakes for signing out and deleting that succeed after about 1.2s.
struct AccountSettingsBlockScene: View {
    @State private var settings = AccountSettingsBlock.Settings(appearance: .system, textSize: 1, notifications: [
        .init(id: "reminders", title: "Reminders", isOn: true),
        .init(id: "summary", title: "Weekly summary", isOn: false),
    ])

    var body: some View {
        ScrollView {
            AccountSettingsBlock(
                profile: .init(name: "Maya Lindqvist", email: "maya@example.com"),
                settings: $settings,
                onEditProfile: {},
                onSignOut: { try? await Task.sleep(for: .seconds(1.2)) },
                onDeleteAccount: { try await Task.sleep(for: .seconds(1.2)) }
            )
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(AccountSettingsSceneGround().ignoresSafeArea())
        .preferredColorScheme(settings.appearance.colorScheme)
    }
}

/// The screen's ground under the block's cards: the house paper in light, near-black in dark.
private struct AccountSettingsSceneGround: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        colorScheme == .dark ? Color(red: 0.071, green: 0.071, blue: 0.071) : Color(red: 0.953, green: 0.949, blue: 0.933)
    }
}
