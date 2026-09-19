import SwiftUI

/// Preview harness used by scripts/record-previews.ts.
/// Launch with `-piece <Name>` to show a single scene full-screen for recording.
@main
struct PreviewsApp: App {
    var body: some Scene {
        WindowGroup {
            PreviewHost()
        }
    }
}

struct PreviewHost: View {
    private var pieceName: String? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "-piece"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    var body: some View {
        if let pieceName {
            PreviewCatalog.scene(for: pieceName)
                .ignoresSafeArea()
                .statusBarHidden()
        } else {
            NavigationStack {
                List(PreviewCatalog.names, id: \.self) { name in
                    NavigationLink(name) {
                        PreviewCatalog.scene(for: name).navigationTitle(name)
                    }
                }
                .navigationTitle("Swift Pieces")
            }
        }
    }
}
