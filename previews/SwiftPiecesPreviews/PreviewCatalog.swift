import SwiftUI

/// One representative scene per registry piece. scripts/build-registry.ts verifies
/// every piece has an entry here so previews never silently go missing.
enum PreviewCatalog {
    static let names: [String] = [
        "TextReveal", "GlassText", "Silk", 
        "TouchGrid", "GlassSurface", "GlassActionMenu", "GlassSegments", "ElasticButton",
        "CommitButton", "HoldToConfirm", "FanStack", "TimerDial", "ExpandingTrack", "ScrubStepper",
        "FilterRail", "SecureEntry", "FlipCard", "ParallaxCard", "MotionCard", "SwipeDeck",
        "SwipeActionRow", "DepthCarousel", "TaskRow", "StatusTimeline", "StretchHeader", "TrackingTabs",
        "FloatingDock", "Toast", "ConfirmSheet", "PermissionSheet", "ReactionToggle",
        "RatingScrub", "StatusMorph", "SkeletonLoader", "OutcomeScreen", "DragToDismiss", "ScrubChart",
        "RingBreakdown", "LiveStat", "Odometer", "PhotoViewer", "StoryStrip", "StreamingReply",
        "ThinkingState", "PromptChips", "CodeBlock",
        "AssistantOrb", "ThoughtOrb",
    ]

    @ViewBuilder
    static func scene(for name: String) -> some View {
        switch name {
        // visual
        case "TextReveal":
            Stage { TextRevealLoop() }
        case "GlassText":
            Stage { GlassTextDemo() }
        case "Silk":
            SilkScene()
        case "TouchGrid":
            TouchGridLoop()
        // glass-controls
        case "GlassSurface":
            Stage { GlassSurfaceLoop() }
        case "GlassActionMenu":
            Stage { GlassActionMenuLoop() }
        case "GlassSegments":
            Stage { GlassSegmentsLoop() }
        case "ElasticButton":
            Stage { ElasticButtonDemo() }
        case "CommitButton":
            Stage { CommitButtonLoop() }
        case "HoldToConfirm":
            Stage { HoldToConfirmLoop() }
        case "FanStack":
            Stage { FanStackLoop() }
        case "TimerDial":
            Stage { TimerDialLoop() }
        // inputs-cards
        case "ExpandingTrack":
            Stage { ExpandingTrackLoop() }
        case "ScrubStepper":
            Stage { ScrubStepperLoop() }
        case "FilterRail":
            Stage { FilterRailLoop() }
        case "SecureEntry":
            Stage { SecureEntryLoop() }
        case "FlipCard":
            Stage { FlipCardLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        case "ParallaxCard":
            Stage { ParallaxCardLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        case "MotionCard":
            Stage { MotionCardLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        case "SwipeDeck":
            Stage { SwipeDeckLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        // lists-nav
        case "SwipeActionRow":
            Stage { SwipeActionRowLoop() }
        case "DepthCarousel":
            Stage { DepthCarouselLoop() }
        case "TaskRow":
            Stage { TaskRowLoop() }
        case "StatusTimeline":
            Stage { StatusTimelineLoop() }
        case "StretchHeader":
            Stage { StretchHeaderLoop() }
        case "TrackingTabs":
            Stage { TrackingTabsLoop() }
        case "FloatingDock":
            Stage { FloatingDockLoop() }
        // sheets-feedback
        case "Toast":
            Stage { ToastLoop() }
        case "ConfirmSheet":
            Stage { ConfirmSheetLoop() }
        case "PermissionSheet":
            Stage { PermissionSheetLoop() }
        case "ReactionToggle":
            ReactionToggleLoop()
        case "RatingScrub":
            RatingScrubLoop()
        case "StatusMorph":
            StatusMorphLoop()
        case "SkeletonLoader":
            SkeletonLoaderLoop()
        case "OutcomeScreen":
            OutcomeScreenLoop()
        // motion-data-media
        case "DragToDismiss":
            DragToDismissLoop()
        case "ScrubChart":
            Stage { ScrubChartLoop() }
        case "RingBreakdown":
            Stage { RingBreakdownLoop() }
        case "LiveStat":
            Stage { LiveStatLoop() }
        case "Odometer":
            Stage { OdometerLoop() }
        case "PhotoViewer":
            Stage { PhotoViewerLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        case "StoryStrip":
            Stage { StoryStripLoop().frame(maxWidth: .infinity, maxHeight: .infinity).background(CardsMediaPalette.ground) }
        // ai
        case "StreamingReply":
            Stage { StreamingReplyLoop() }
        case "ThinkingState":
            Stage { ThinkingStateLoop() }
        case "PromptChips":
            Stage { PromptChipsLoop() }
        case "CodeBlock":
            Stage { CodeBlockLoop() }
        // orbs
        case "AssistantOrb":
            Stage(dark: true) { AssistantOrbLoop() }
        case "ThoughtOrb":
            Stage(dark: true) { ThoughtOrbLoop() }
        default:
            Text("Unknown piece: \(name)")
        }
    }
}

/// Centers content over a neutral stage.
private struct Stage<Content: View>: View {
    var dark = false
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            (dark ? Color.black : Color(.systemBackground))
            content
        }
        .preferredColorScheme(dark ? .dark : nil)
    }
}

// MARK: - visual scenes

/// The component alone: one headline rising word by word with its key phrase landing on a butter
/// block, and the same reveal as `.blur` underneath.
private struct TextRevealLoop: View {
    @State private var replay = 0

    var body: some View {
        let palette = TextRevealPaletteTG.self
        VStack(alignment: .leading, spacing: 16) {
            TextReveal("Plan the week in one calm glance.", trigger: replay, highlights: ["one calm glance"])
                .font(.system(size: 40, weight: .bold))
                .tracking(-1.3)
                .foregroundStyle(palette.text)
            TextReveal("Three priorities, two open loops and a clear Monday.", preset: .blur, delay: 0.45, trigger: replay)
                .font(.system(size: 19))
                .foregroundStyle(palette.muted)
        }
        .frame(maxWidth: 360, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.ground)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4.5))
                replay += 1
            }
        }
    }
}

/// House palette values for the scene, adapting to light and dark.
private enum TextRevealPaletteTG {
    static let ground = adaptive(light: 0xF3F2EE, dark: 0x121212)
    static let text = adaptive(light: 0x141414, dark: 0xF4F3EF)
    static let muted = adaptive(light: 0x5C5A56, dark: 0xA6A49F)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
}

/// The component alone: glass numerals over plain color blocks that drift underneath and fill the stage.
private struct GlassTextDemo: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            GlassText("07:30", font: .systemFont(ofSize: 112, weight: .heavy), scalesWithDynamicType: false)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background { GlassTextBlocksTG(t: t).clipped() }
        }
    }
}

/// Plain shapes in the house blocks: a sky field, a tangerine sun, a butter bar and a lilac slab.
private struct GlassTextBlocksTG: View {
    let t: TimeInterval

    var body: some View {
        let drift = CGFloat(sin(t * 0.5))
        ZStack {
            GlassTextPaletteTG.sky.ignoresSafeArea()
            Circle()
                .fill(GlassTextPaletteTG.tangerine)
                .frame(width: 190)
                .offset(x: -70 + drift * 46, y: 8 + CGFloat(cos(t * 0.35)) * 14)
            Capsule()
                .fill(GlassTextPaletteTG.butter)
                .frame(width: 240, height: 64)
                .rotationEffect(.degrees(-12))
                .offset(x: 110 - drift * 60, y: -30)
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(GlassTextPaletteTG.lilac)
                .frame(width: 200, height: 110)
                .offset(x: 90 + drift * 30, y: 130)
        }
    }
}

private enum GlassTextPaletteTG {
    static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    static let tangerine = Color(red: 1, green: 0.357, blue: 0.227)
    static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
}

// MARK: - glass-controls scenes

/// The component alone: three surfaces floating on full-bleed color blocks, so the glass has
/// something to refract.
private struct GlassSurfaceLoop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
        TimelineView(.animation(paused: reduceMotion)) { context in
            GlassSurface.Group(spacing: 8) {
                HStack(spacing: 12) {
                    Button {} label: {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Previous")
                    Button {} label: {
                        Image(systemName: "play.fill")
                            .font(.title.weight(.semibold))
                            .frame(width: 190, height: 76)
                    }
                    .glassSurface(.capsule, tint: Color(red: 1, green: 0.357, blue: 0.227), interactive: true)
                    .accessibilityLabel("Play")
                    Button {} label: {
                        Image(systemName: "chevron.right")
                            .font(.title3.weight(.semibold))
                            .frame(width: 76, height: 76)
                    }
                    .glassSurface(.circle, interactive: true)
                    .accessibilityLabel("Next")
                }
                .buttonStyle(.plain)
                .foregroundStyle(ink)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { GlassSurfaceCoverTG(t: context.date.timeIntervalSinceReferenceDate).clipped() }
        }
    }
}

/// Plain shapes that drift under the glass: a lilac field, a butter disc, a sage slab and a sky bar.
private struct GlassSurfaceCoverTG: View {
    let t: TimeInterval

    var body: some View {
        let drift = CGFloat(sin(t * 0.45))
        ZStack {
            Color(red: 0.804, green: 0.722, blue: 1).ignoresSafeArea()
            Circle()
                .fill(Color(red: 1, green: 0.851, blue: 0.463))
                .frame(width: 230)
                .offset(x: 96 + drift * 34, y: -74 + CGFloat(cos(t * 0.3)) * 16)
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(Color(red: 0.663, green: 0.863, blue: 0.718))
                .frame(width: 250, height: 170)
                .rotationEffect(.degrees(-8))
                .offset(x: -94 - drift * 26, y: 104)
            Capsule()
                .fill(Color(red: 0.612, green: 0.761, blue: 1))
                .frame(width: 300, height: 50)
                .offset(x: 46 - drift * 44, y: 78)
        }
    }
}

/// The component alone: the trigger in the corner of the stage, the arc expanding into empty ground.
private struct GlassActionMenuLoop: View {
    @State private var expanded = false

    var body: some View {
        GlassActionMenu(items: [
            .init(symbol: "square.and.pencil", label: "Note", tint: GlassActionMenuPaletteTG.butter) {},
            .init(symbol: "mic.fill", label: "Voice memo", tint: GlassActionMenuPaletteTG.lilac) {},
            .init(symbol: "camera.fill", label: "Photo", tint: GlassActionMenuPaletteTG.sky) {},
        ], arrangement: .arc, isExpanded: $expanded)
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .background(GlassActionMenuPaletteTG.ground)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.2))
                expanded = true
                try? await Task.sleep(for: .seconds(2.8))
                expanded = false
            }
        }
    }
}

private enum GlassActionMenuPaletteTG {
    static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
    static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    static let ground = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1)
        : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) })
}

/// The component alone: the picker centred on the stage, cycling through its options.
private struct GlassSegmentsLoop: View {
    enum Period: String, CaseIterable { case day, week, month, year }
    @State private var period: Period = .week

    var body: some View {
        GlassSegments(options: Period.allCases, selection: $period) { $0.rawValue.capitalized }
            .frame(maxWidth: 350)
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(GlassSegmentsStyle.adaptive(light: 0xF3F2EE, dark: 0x121212))
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1.8))
                    let all = Period.allCases
                    period = all[(all.firstIndex(of: period)! + 1) % all.count]
                }
            }
    }
}

/// House palette for the controls scenes; mirrors the pieces' `Style.standard` values.
private enum ControlsHouse {
    typealias House = TimerDial.Style.House
    static let text = House.adaptive(light: 0x141414, dark: 0xF4F3EF)
    static let ground = House.adaptive(light: 0xF3F2EE, dark: 0x121212)
}

/// The house ground with the piece centred on it, and nothing else.
private struct ControlsStage<Content: View>: View {
    var width: CGFloat? = 340
    @ViewBuilder var content: Content
    var body: some View {
        ZStack {
            ControlsHouse.ground.ignoresSafeArea()
            content
                .foregroundStyle(ControlsHouse.text)
                .frame(maxWidth: width)
                .padding(24)
        }
    }
}

private struct ElasticButtonDemo: View {
    var body: some View {
        ControlsStage {
            VStack(spacing: 12) {
                Button {} label: {
                    HStack(spacing: 8) { Text("Reserve table"); Image(systemName: "arrow.right") }.frame(maxWidth: .infinity)
                }
                .buttonStyle(.elastic(.signal))
                HStack(spacing: 12) {
                    Button {} label: { Label("Add guest", systemImage: "plus").frame(maxWidth: .infinity) }
                        .buttonStyle(.elastic(squash: 0.94, bounce: 0.3, style: .block(.lilac)))
                    Button {} label: { Text("Waitlist").frame(maxWidth: .infinity) }
                        .buttonStyle(.elastic(.raised))
                        .disabled(true)
                }
            }
        }
    }
}

private struct CommitButtonLoop: View {
    @State private var phase: CommitButton.Phase = .idle
    var body: some View {
        ControlsStage {
            CommitButton("Save changes", phase: $phase, successHold: .seconds(1.4), successTitle: "Saved") {}
                .frame(maxWidth: .infinity)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.2))
                phase = .loading
                try? await Task.sleep(for: .seconds(1.3))
                phase = .success
                try? await Task.sleep(for: .seconds(2.6))
                phase = .loading
                try? await Task.sleep(for: .seconds(1.1))
                phase = .error("Couldn't save")
                try? await Task.sleep(for: .seconds(1.8))
                phase = .idle
            }
        }
    }
}

private struct HoldToConfirmLoop: View {
    @State private var phase: HoldToConfirm.Phase = .idle
    var body: some View {
        ControlsStage {
            VStack(spacing: 12) {
                HoldToConfirm("Hold to delete", systemImage: "trash", phase: $phase, committedTitle: "Deleted") {}
                HoldToConfirm("Hold to transfer", systemImage: "arrow.right", style: .butter) {}
                    .disabled(true)
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                phase = .holding
                try? await Task.sleep(for: .seconds(0.6))
                phase = .idle
                try? await Task.sleep(for: .seconds(1))
                phase = .holding
                try? await Task.sleep(for: .seconds(3.4))
            }
        }
    }
}

private struct FanStackLoop: View {
    @State private var fanned = false
    var body: some View {
        ControlsStage(width: nil) {
            FanStack(
                names: ["Priya Raman", "Jonas Weber", "Amara Diallo", "Leo Brandt", "Sofia Marin", "Kenji Sato"],
                size: 52,
                max: 3,
                isFanned: $fanned,
                style: .init(ring: ControlsHouse.ground)
            )
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.4))
                fanned = true
                try? await Task.sleep(for: .seconds(2.6))
                fanned = false
            }
        }
    }
}

private struct TimerDialLoop: View {
    @State private var seconds = 45
    @State private var running = false
    var body: some View {
        ControlsStage(width: nil) {
            VStack(spacing: 22) {
                TimerDial(seconds: $seconds, isRunning: $running, step: 5, maxSeconds: 60)
                    .frame(width: 232)
                TimerDial(progress: running ? 0.72 : 0.36, lineWidth: 10, caption: "Uploaded", style: .init(fill: TimerDial.Style.House.hex(0x9CC2FF), showsTicks: false, digitSize: 26))
                    .frame(width: 104)
            }
        }
        .task {
            while !Task.isCancelled {
                seconds = 45
                try? await Task.sleep(for: .seconds(1.6))
                // The dial winds down in detents, then runs through the warning zone to the sage finish.
                for value in stride(from: 40, through: 10, by: -5) {
                    seconds = value
                    try? await Task.sleep(for: .milliseconds(140))
                }
                try? await Task.sleep(for: .seconds(0.5))
                running = true
                try? await Task.sleep(for: .seconds(12.5))
            }
        }
    }
}

// MARK: - inputs-cards scenes

/// House palette for the inputs and sheets scenes (FREE-V2 §3).
private func inputsSheetsColor(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

/// The house ground the inputs scenes stand on (FREE-V2 §3).
private struct InputsSheetsGround<Content: View>: View {
    var inset: CGFloat = 30
    @ViewBuilder var content: Content
    var body: some View {
        content
            .foregroundStyle(inputsSheetsColor(0x141414, 0xF4F3EF))
            .padding(.horizontal, inset)
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(inputsSheetsColor(0xF3F2EE, 0x121212))
    }
}

/// The track alone, in its three shapes, animating between values.
private struct ExpandingTrackLoop: View {
    @State private var volume = 0.62
    @State private var warmth = 3400.0
    @State private var price = 40.0...160.0
    var body: some View {
        InputsSheetsGround {
            VStack(alignment: .leading, spacing: 30) {
                ExpandingTrack(value: $volume, symbol: "speaker.wave.3.fill", title: "Volume") { ($0 * 100).formatted(.number.precision(.fractionLength(0))) }
                ExpandingTrack(value: $warmth, in: 2700...6500, step: 100, symbol: "sun.max.fill", title: "Warmth", style: .init(fill: inputsSheetsColor(0xFFD976, 0xFFD976))) { "\(Int($0))K" }
                ExpandingTrack(range: $price, in: 0...200, step: 5, minimumDistance: 10, title: "Price per night", style: .init(fill: inputsSheetsColor(0x9CC2FF, 0x9CC2FF))) { "$\(Int($0))" }
            }
        }
        .task {
            while !Task.isCancelled {
                for (v, w, r) in [(0.86, 4200.0, 60.0...140.0), (0.34, 3000.0, 20.0...180.0), (0.62, 3400.0, 40.0...160.0)] {
                    try? await Task.sleep(for: .seconds(1.6))
                    withAnimation(.smooth(duration: 0.8)) { volume = v; warmth = w; price = r }
                }
            }
        }
    }
}
/// The stepper alone: the numeral block counts up and down in two block colors.
private struct ScrubStepperLoop: View {
    @State private var guests = 4
    @State private var chairs = 0
    var body: some View {
        InputsSheetsGround {
            VStack(spacing: 24) {
                ScrubStepper(value: $guests, in: 1...10)
                ScrubStepper(value: $chairs, in: 0...3, style: .init(block: inputsSheetsColor(0xA9DCB7, 0xA9DCB7)))
            }
        }
        .task {
            while !Task.isCancelled {
                for v in [5, 6, 7] { try? await Task.sleep(for: .seconds(0.6)); guests = v }
                try? await Task.sleep(for: .seconds(0.9)); chairs = 1
                for v in [6, 5, 4] { try? await Task.sleep(for: .seconds(0.6)); guests = v }
                try? await Task.sleep(for: .seconds(0.9)); chairs = 0
            }
        }
    }
}
/// Two rails alone: the sort indicator glides, genre picks light up as blocks behind the Clear chip.
private struct FilterRailLoop: View {
    private let sorts = ["Recent", "Popular", "A to Z", "Longest", "Shortest", "Unplayed"]
    private let genres = ["All", "Jazz", "Hip-Hop", "Classical", "Electronic", "Folk", "Ambient"]
    private let counts = ["All": 412, "Jazz": 38, "Hip-Hop": 52, "Classical": 21, "Electronic": 64, "Folk": 17, "Ambient": 29]
    @State private var sort: Set<String> = ["Recent"]
    @State private var picked: Set<String> = []
    var body: some View {
        InputsSheetsGround(inset: 0) {
            VStack(alignment: .leading, spacing: 18) {
                FilterRail(options: sorts, selection: $sort)
                FilterRail(options: genres, selection: $picked, allowsMultiple: true, counts: counts)
            }
        }
        .task {
            var index = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.4))
                index = (index + 2) % sorts.count
                withAnimation(.snappy) { sort = [sorts[index]] }
            }
        }
        .task {
            while !Task.isCancelled {
                for genre in ["Jazz", "Ambient", "Electronic"] {
                    try? await Task.sleep(for: .seconds(1.1))
                    withAnimation(.snappy) { _ = picked.insert(genre) }
                }
                try? await Task.sleep(for: .seconds(1.4))
                withAnimation(.snappy) { picked.removeAll() }
                try? await Task.sleep(for: .seconds(0.8))
            }
        }
    }
}
/// The field alone: the password types itself through the strength blocks, then the confirm field errors.
private struct SecureEntryLoop: View {
    @State private var password = ""
    @State private var confirm = "Juniper24!"
    @State private var error: String? = nil
    var body: some View {
        InputsSheetsGround {
            VStack(alignment: .leading, spacing: 26) {
                SecureEntry("New password", text: $password)
                SecureEntry("Confirm password", text: $confirm, error: error, showsStrength: false, showsRequirements: false)
            }
        }
        .task {
            let target = "Juniper42!"
            while !Task.isCancelled {
                error = nil
                password = ""
                try? await Task.sleep(for: .milliseconds(600))
                for index in target.indices {
                    guard !Task.isCancelled else { return }
                    password = String(target[...index])
                    try? await Task.sleep(for: .milliseconds(160))
                }
                try? await Task.sleep(for: .seconds(1))
                error = "Passwords do not match"
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }
}

// MARK: - cards-media scenes

/// House palette for the cards and media scenes (FREE-V2 §3).
private enum CardsMediaPalette {
    static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    static let signal = Color(red: 1, green: 0.357, blue: 0.227)
    static let tangerine = Color(red: 1, green: 0.357, blue: 0.227)
    static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
    static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
    static let sand = Color(red: 0.914, green: 0.835, blue: 0.702)
    static let ground = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) })
    static let surface = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.149, green: 0.149, blue: 0.149, alpha: 1) : .white })
}

private struct FlipCardLoop: View {
    @State private var flipped = false
    private typealias P = CardsMediaPalette
    var body: some View {
        FlipCard(isFlipped: $flipped) {
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .fill(P.butter)
                        .overlay(alignment: .topLeading) {
                            VStack(alignment: .leading, spacing: 0) {
                                HStack {
                                    Text("PORTUGUESE").font(.caption2.weight(.bold)).tracking(1)
                                    Spacer()
                                    Text("3 / 12").font(.system(.caption, design: .monospaced).weight(.semibold))
                                }
                                Spacer()
                                Text("Saudade").font(.system(size: 46, weight: .bold)).tracking(-1.8).lineLimit(1).minimumScaleFactor(0.6)
                                Text("noun  ·  sow-DAH-jee").font(.subheadline.weight(.medium)).opacity(0.62)
                            }
                            .foregroundStyle(P.ink)
                            .padding(22)
                        }
                } back: {
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .fill(P.sky)
                        .overlay(alignment: .topLeading) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("MEANING").font(.caption2.weight(.bold)).tracking(1)
                                Text("A deep longing for someone or something far away.").font(.system(size: 22, weight: .bold)).tracking(-0.6).minimumScaleFactor(0.7)
                                Spacer(minLength: 0)
                                Text("Often heard in fado songs").font(.subheadline.weight(.medium)).opacity(0.62)
                            }
                            .foregroundStyle(P.ink)
                            .padding(22)
                        }
        }
        .frame(width: 320, height: 214)
        .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(2.2)); flipped.toggle() } }
    }
}

private struct MotionCardLoop: View {
    @State private var tilt = CGSize(width: 0.4, height: -0.25)
    private typealias P = CardsMediaPalette
    var body: some View {
        MotionCard(attitude: tilt) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("ADMIT ONE").font(.caption2.weight(.bold)).tracking(1.2)
                        Spacer()
                        Text("No. 0418").font(.system(.caption, design: .monospaced).weight(.semibold))
                    }
                    Spacer(minLength: 12)
                    Text("Late Show").font(.system(size: 40, weight: .bold)).tracking(-1.6)
                    Text("Sat 14 Nov  ·  Screen 3").font(.subheadline.weight(.medium)).opacity(0.62)
                    HStack(spacing: 8) {
                        Circle().fill(P.ground).frame(width: 22, height: 22).offset(x: -11)
                        Rectangle().frame(height: 1.5).opacity(0.25)
                        Circle().fill(P.ground).frame(width: 22, height: 22).offset(x: 11)
                    }
                    .padding(.horizontal, -22)
                    .padding(.vertical, 6)
                    HStack(alignment: .firstTextBaseline, spacing: 24) {
                        ForEach([("ROW", "F"), ("SEAT", "12"), ("DOORS", "21:40")], id: \.0) { label, value in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(label).font(.caption2.weight(.bold)).tracking(1).opacity(0.62)
                                Text(value).font(.system(size: 30, weight: .light)).monospacedDigit()
                            }
                        }
                    }
                }
                .padding(22)
                .frame(width: 330, height: 244)
        }
        .task {
            while !Task.isCancelled {
                for target in [CGSize(width: -0.5, height: 0.3), CGSize(width: 0.45, height: 0.4), CGSize(width: -0.3, height: -0.45), CGSize(width: 0.4, height: -0.25)] {
                    try? await Task.sleep(for: .seconds(1.6))
                    withAnimation(.smooth(duration: 1.4)) { tilt = target }
                }
            }
        }
    }
}

private struct ParallaxCardLoop: View {
    private typealias P = CardsMediaPalette
    private struct Walk: Identifiable {
        let id: Int
        let name: String
        let word: String
        let facts: [String]
        let sky: Color
        let sun: Color
        let caption: Color
    }
    private let walks = [
        Walk(id: 0, name: "Alfama at dusk", word: "ALFAMA", facts: ["3.2 km", "1 h 10 min"], sky: P.sky, sun: P.tangerine, caption: P.butter),
        Walk(id: 1, name: "River to Belém", word: "BELÉM", facts: ["6.8 km", "2 h"], sky: P.sage, sun: P.butter, caption: P.lilac),
        Walk(id: 2, name: "Graça viewpoints", word: "GRAÇA", facts: ["2.1 km", "45 min"], sky: P.lilac, sun: P.sky, caption: P.sand),
        Walk(id: 3, name: "Chiado bookshops", word: "CHIADO", facts: ["1.6 km", "40 min"], sky: P.tangerine, sun: P.sand, caption: P.sage)
    ]
    @State private var art: [Int: Image] = [:]
    @State private var position: Int?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(walks) { walk in
                    ParallaxCard(image: art[walk.id] ?? Image(systemName: "square"), eyebrow: "Walk 0\(walk.id + 1)", title: walk.name, metadata: walk.facts, trailingSymbol: "arrow.up.right", height: 250, style: ParallaxCard.Style(captionFill: walk.caption)) {}
                        .id(walk.id)
                }
            }
            .padding(20)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $position, anchor: .center)
        .onAppear {
            for walk in walks {
                let renderer = ImageRenderer(content: ParallaxArtwork(word: walk.word, sky: walk.sky, sun: walk.sun))
                renderer.scale = 3
                if let image = renderer.uiImage { art[walk.id] = Image(uiImage: image) }
            }
        }
        .task {
            while !Task.isCancelled {
                for target in [1, 2, 3, 0] {
                    try? await Task.sleep(for: .seconds(1.8))
                    withAnimation(.smooth(duration: 1.4)) { position = target }
                }
            }
        }
    }
}

/// A flat composition for a parallax picture: a solid ground, one disc, and a giant word cropped by the edge.
private struct ParallaxArtwork: View {
    let word: String
    let sky: Color
    let sun: Color
    var body: some View {
        ZStack(alignment: .topLeading) {
            sky
            Circle().fill(sun).frame(width: 190, height: 190).offset(x: 196, y: 10)
            Text(word).font(.system(size: 128, weight: .black)).tracking(-6).foregroundStyle(CardsMediaPalette.ink).fixedSize().offset(x: -8, y: 24)
        }
        .frame(width: 400, height: 340)
        .clipped()
    }
}

private struct SwipeDeckLoopItem: Identifiable {
    let id: Int
    let title: String
    let detail: String
    let minutes: Int
    let fill: Color
    let bowl: Color
}

private struct SwipeDeckLoop: View {
    private typealias P = CardsMediaPalette
    @Environment(\.colorScheme) private var colorScheme
    @State private var recipes = [
        SwipeDeckLoopItem(id: 0, title: "Miso aubergine", detail: "Vegetarian  ·  Serves 2", minutes: 25, fill: P.sky, bowl: P.tangerine),
        SwipeDeckLoopItem(id: 1, title: "Lemon orzo", detail: "One pot  ·  Serves 4", minutes: 20, fill: P.butter, bowl: P.sage),
        SwipeDeckLoopItem(id: 2, title: "Green curry", detail: "Spicy  ·  Serves 3", minutes: 35, fill: P.sage, bowl: P.butter),
        SwipeDeckLoopItem(id: 3, title: "Harissa chickpeas", detail: "Vegan  ·  Serves 2", minutes: 30, fill: P.lilac, bowl: P.tangerine)
    ]
    @State private var command: Edge?

    var body: some View {
        SwipeDeck(items: $recipes, swipe: $command) { _, recipe in
            recipes.append(recipe)
        } card: { recipe in
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .fill(recipe.fill)
                    .overlay {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack {
                                Text("TONIGHT").font(.caption2.weight(.bold)).tracking(1.2)
                                Spacer()
                                Text("\(recipe.minutes) min").font(.system(.caption, design: .monospaced).weight(.semibold))
                            }
                            Spacer()
                            ZStack {
                                Circle().fill(P.ink)
                                Circle().fill(recipe.bowl).padding(22)
                                Circle().fill(recipe.fill).frame(width: 26, height: 26).offset(x: 14, y: -10)
                                Circle().fill(recipe.fill).frame(width: 14, height: 14).offset(x: -18, y: 14)
                            }
                            .frame(width: 132, height: 132)
                            .frame(maxWidth: .infinity)
                            Spacer()
                            Text(recipe.title).font(.system(size: 32, weight: .bold)).tracking(-1.2).lineLimit(2).minimumScaleFactor(0.7)
                            Text(recipe.detail).font(.subheadline.weight(.medium)).opacity(0.62).padding(.top, 2)
                        }
                        .foregroundStyle(P.ink)
                        .padding(22)
                    }
            }
        .frame(width: 300, height: 390)
        .task {
            let directions: [Edge] = [.trailing, .leading, .top]
            var index = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.8))
                command = directions[index % directions.count]
                index += 1
            }
        }
    }
}

private struct PhotoViewerPrint: Identifiable {
    let id: Int
    let title: String
    let ground: Color
    let shape: Color
}

/// A flat poster: a solid ground, one disc, a bar, and the title set large.
private struct PhotoViewerPrintArt: View {
    let print: PhotoViewerPrint
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            ZStack(alignment: .topLeading) {
                print.ground
                Circle().fill(print.shape).frame(width: w * 0.62, height: w * 0.62).offset(x: w * 0.3, y: w * 0.16)
                Rectangle().fill(CardsMediaPalette.ink).frame(width: w * 0.46, height: w * 0.1).offset(x: w * 0.08, y: w * 0.62)
                VStack(alignment: .leading, spacing: 0) {
                    Text("No. 0\(print.id + 1)").font(.system(size: w * 0.05, weight: .bold, design: .monospaced))
                    Spacer()
                    Text(print.title).font(.system(size: w * 0.26, weight: .black)).tracking(-w * 0.012).lineLimit(1)
                }
                .foregroundStyle(CardsMediaPalette.ink)
                .padding(w * 0.07)
            }
        }
    }
}

private struct PhotoViewerLoop: View {
    private typealias P = CardsMediaPalette
    private let prints = [
        PhotoViewerPrint(id: 0, title: "Noon", ground: P.tangerine, shape: P.butter),
        PhotoViewerPrint(id: 1, title: "Tide", ground: P.sky, shape: P.sage),
        PhotoViewerPrint(id: 2, title: "Dusk", ground: P.lilac, shape: P.tangerine)
    ]
    @State private var page: Int? = 0
    @State private var shown = true

    var body: some View {
        ZStack {
            if shown {
                PhotoViewer(items: prints, selection: $page, onDismiss: { shown = false }) { print in
                    PhotoViewerPrintArt(print: print)
                        .aspectRatio(3 / 4, contentMode: .fit)
                        .clipShape(.rect(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal, 20)
                }
                .transition(.opacity)
            }
        }
        .task {
            while !Task.isCancelled {
                for next in [1, 2] {
                    try? await Task.sleep(for: .seconds(1.6))
                    withAnimation(.smooth(duration: 0.5)) { page = next }
                }
                try? await Task.sleep(for: .seconds(1.6))
                withAnimation(.easeOut(duration: 0.3)) { shown = false }
                try? await Task.sleep(for: .seconds(0.7))
                page = 0
                withAnimation(.easeOut(duration: 0.3)) { shown = true }
            }
        }
    }
}

private struct StoryStripLoop: View {
    private typealias P = CardsMediaPalette
    private let slides: [(meta: String, headline: String, figure: String?, fill: Color)] = [
        ("SATURDAY MARKET", "Out early for the good peaches", nil, P.tangerine),
        ("STALLS VISITED", "and one very long queue", "12", P.butter),
        ("SPENT", "on bread, figs and flowers", "€18.40", P.sage),
        ("NEXT WEEK", "Same time. Bring a bigger bag.", nil, P.lilac)
    ]
    @State private var current = 0
    @State private var paused = false

    var body: some View {
        let slide = slides[min(current, slides.count - 1)]
        ZStack(alignment: .topLeading) {
            slide.fill.animation(.smooth(duration: 0.35), value: current)
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text(slide.meta).font(.caption.weight(.bold)).tracking(1.2)
                if let figure = slide.figure {
                    Text(figure).font(.system(size: 96, weight: .light)).tracking(-4).minimumScaleFactor(0.5).lineLimit(1)
                }
                Text(slide.headline)
                    .font(.system(size: slide.figure == nil ? 44 : 28, weight: .bold))
                    .tracking(slide.figure == nil ? -1.8 : -1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(P.ink)
            .padding(24)
            .padding(.bottom, 20)
            .id(current)
            .transition(.opacity)
            StoryStrip(count: slides.count, current: $current, duration: 1.8, isPaused: $paused, tint: P.ink, style: StoryStrip.Style(ink: slide.fill)) {
                Task {
                    try? await Task.sleep(for: .seconds(0.6))
                    current = 0
                }
            }
        }
        .frame(width: 330, height: 560)
        .clipShape(.rect(cornerRadius: 34, style: .continuous))
    }
}

// MARK: - lists-nav scenes

/// House palette for the lists and ai scenes (FREE-V2 §3).
private enum LAPalette {
    static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        })
    }
    static let ground = adaptive(0xF3F2EE, 0x121212)
    static let surface = adaptive(0xFFFFFF, 0x1C1C1C)
    static let text = adaptive(0x141414, 0xF4F3EF)
    static let muted = adaptive(0x5C5A56, 0xA6A49F)
    static let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    static let signal = Color(red: 1, green: 0.357, blue: 0.227)
    static let tangerine = Color(red: 1, green: 0.357, blue: 0.227)
    static let sky = Color(red: 0.612, green: 0.761, blue: 1)
    static let butter = Color(red: 1, green: 0.851, blue: 0.463)
    static let sage = Color(red: 0.663, green: 0.863, blue: 0.718)
    static let lilac = Color(red: 0.804, green: 0.722, blue: 1)
    static let sand = Color(red: 0.914, green: 0.835, blue: 0.702)
}

private struct LAStage<Content: View>: View {
    var alignment: Alignment = .top
    @ViewBuilder var content: Content
    var body: some View {
        content
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
            .background(LAPalette.ground.ignoresSafeArea())
    }
}

private struct SwipeActionRowLoop: View {
    @State private var open: AnyHashable? = nil
    private let messages: [(String, String, String, String, Color)] = [
        ("MA", "Mara Lindqvist", "Final cut of the launch film", "9:41", LAPalette.sand),
        ("JO", "Jonas Okafor", "Studio booking for Thursday", "8:12", LAPalette.sage),
        ("PR", "Priya Raman", "Notes from the pricing review", "Mon", LAPalette.lilac),
    ]

    var body: some View {
        LAStage(alignment: .center) {
            VStack(spacing: 8) {
                ForEach(messages, id: \.1) { initials, name, subject, time, color in
                    SwipeActionRow(
                        id: name,
                        leading: [.init("Read", systemImage: "envelope.open", tint: LAPalette.sky) {}],
                        trailing: [
                            .init("Delete", systemImage: "trash", tint: LAPalette.signal, role: .destructive) {},
                            .init("Snooze", systemImage: "moon.zzz", tint: LAPalette.butter) {},
                        ],
                        open: $open
                    ) {
                        HStack(spacing: 14) {
                            Text(initials)
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundStyle(LAPalette.ink)
                                .frame(width: 46, height: 46)
                                .background(color, in: Circle())
                            VStack(alignment: .leading, spacing: 3) {
                                Text(name).font(.headline).foregroundStyle(LAPalette.text)
                                Text(subject).font(.subheadline).foregroundStyle(LAPalette.muted).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            Text(time).font(.footnote.monospacedDigit()).foregroundStyle(LAPalette.muted)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                }
            }
            .padding(20)
        }
        .task {
            // One row open at a time: opening the next row closes the previous one.
            let steps: [AnyHashable?] = ["Jonas Okafor", nil, "Priya Raman", nil]
            var step = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                open = steps[step % steps.count]
                step += 1
            }
        }
    }
}

private struct DepthCarouselLoop: View {
    private struct Trip: Identifiable {
        let id: String
        let country: String
        let dates: String
        let nights: Int
        let block: Color
    }
    private let trips = [
        Trip(id: "Lisbon", country: "Portugal", dates: "Oct 12 – 16", nights: 4, block: LAPalette.tangerine),
        Trip(id: "Kyoto", country: "Japan", dates: "Nov 3 – 10", nights: 7, block: LAPalette.sky),
        Trip(id: "Oaxaca", country: "Mexico", dates: "Dec 1 – 6", nights: 5, block: LAPalette.butter),
        Trip(id: "Bergen", country: "Norway", dates: "Jan 18 – 21", nights: 3, block: LAPalette.lilac),
    ]
    @State private var selection: String? = nil

    var body: some View {
        LAStage(alignment: .center) {
            DepthCarousel(trips, itemWidth: 270, selection: $selection) { trip, phase in
                ZStack(alignment: .topLeading) {
                    trip.block
                    Circle()
                        .fill(LAPalette.ink)
                        .frame(width: 180, height: 180)
                        .offset(x: 150 + phase * 40, y: 64)
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text(trip.country.uppercased()).font(.caption.weight(.bold)).tracking(1.2)
                            Spacer()
                            Text("\(trip.nights) NIGHTS").font(.caption.weight(.bold)).tracking(1.2)
                        }
                        Spacer()
                        Text(trip.id).font(.system(size: 44, weight: .bold)).tracking(-1.8)
                        Text(trip.dates).font(.subheadline.weight(.medium)).opacity(0.7)
                    }
                    .foregroundStyle(LAPalette.ink)
                    .padding(22)
                    .offset(x: phase * 10)
                }
                .frame(height: 340)
                .clipShape(.rect(cornerRadius: 34, style: .continuous))
            }
        }
        .task {
            var index = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.8))
                index = (index + 1) % trips.count
                withAnimation(.spring(duration: 0.7, bounce: 0.1)) { selection = trips[index].id }
            }
        }
    }
}

private struct TaskRowLoop: View {
    @State private var first: TaskRow.Status = .open
    @State private var second: TaskRow.Status = .open
    @State private var third: TaskRow.Status = .snoozed
    @State private var fourth: TaskRow.Status = .completed

    var body: some View {
        LAStage(alignment: .center) {
            VStack(spacing: 8) {
                TaskRow("Review the launch checklist", status: $first, due: "Today, 5 PM", priority: .high, onSnooze: {}, onDelete: {}, onMove: { _ in })
                TaskRow("Send Mara the final mockups", status: $second, due: "Today, 6 PM", priority: .medium, onSnooze: {}, onDelete: {})
                TaskRow("Book the studio for Thursday", status: $third, due: "Tomorrow", onSnooze: {}, onDelete: {})
                TaskRow("Renew the domain", status: $fourth, priority: .low, onSnooze: {}, onDelete: {})
            }
            .padding(20)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                first = .completed
                try? await Task.sleep(for: .seconds(1.8))
                second = .completed
                try? await Task.sleep(for: .seconds(2.2))
                first = .open
                second = .open
            }
        }
    }
}

private struct StatusTimelineLoop: View {
    @State private var stage = 2
    var body: some View {
        LAStage(alignment: .center) {
            StatusTimeline(steps: [
                .init("Order placed", detail: "Confirmation sent to sam.rivera@example.com.", timestamp: "9:41 AM", status: stage > 0 ? .complete : .current),
                .init("Packed", detail: "Three items packed at the Riverside warehouse.", timestamp: "11:20 AM", status: stage > 1 ? .complete : stage == 1 ? .current : .pending),
                .init("Out for delivery", detail: "Noor has your parcel. You are stop 6 of 14.", timestamp: "1:05 PM", status: stage > 2 ? .complete : stage == 2 ? .current : .pending),
                .init("Delivered", detail: "Left with the front desk. Signed by D. Alvarez.", timestamp: stage > 3 ? "4:12 PM" : nil, status: stage > 3 ? .complete : stage == 3 ? .current : .pending),
            ])
            .padding(24)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                stage = stage >= 4 ? 1 : stage + 1
            }
        }
    }
}
/// Free house palette for the navigation and data scenes.
private enum NDP {
    static func c(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { t in
            let h = t.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((h >> 16) & 0xFF) / 255, green: CGFloat((h >> 8) & 0xFF) / 255, blue: CGFloat(h & 0xFF) / 255, alpha: 1)
        })
    }
    static let ground = c(0xF3F2EE, 0x121212), surface = c(0xFFFFFF, 0x1C1C1C), raised = c(0xFFFFFF, 0x262626)
    static let muted = c(0x5C5A56, 0xA6A49F), ink = c(0x141414, 0x141414)
    static let tangerine = c(0xFF5B3A, 0xFF5B3A), sky = c(0x9CC2FF, 0x9CC2FF), butter = c(0xFFD976, 0xFFD976)
    static let sage = c(0xA9DCB7, 0xA9DCB7), lilac = c(0xCDB8FF, 0xCDB8FF), sand = c(0xE9D5B3, 0xE9D5B3), signal = c(0xFF5B3A, 0xFF5B3A)
    static func meta(_ text: String) -> some View {
        Text(text.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(1.2).foregroundStyle(muted)
    }
}

/// The header itself: sage block hero with a butter disc, eyebrow and heavy title over plain placeholder content,
/// scrolled so the meta row pins and the solid bar fades in, then returned.
private struct StretchHeaderLoop: View {
    @State private var progress: CGFloat = 0
    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    StretchHeader(title: "Mist Trail", height: 280, progress: $progress, eyebrow: "Yosemite · Hike 04") {
                        ZStack(alignment: .topTrailing) {
                            NDP.sage
                            Circle().fill(NDP.butter).frame(width: 180).offset(x: 50, y: -40)
                        }
                    } subtitle: {
                        NDP.meta("5.4 mi · 1,000 ft up · 3.5 hours")
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20).padding(.vertical, 14)
                    }
                    // Plain placeholder content, only so there is something to scroll.
                    VStack(spacing: 12) {
                        ForEach(0..<9, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(NDP.surface)
                                .frame(height: 64)
                                .id(index)
                        }
                    }
                    .padding(16)
                    .accessibilityHidden(true)
                }
                .background(NDP.ground)
                .stretchHeaderBar(title: "Mist Trail", progress: progress)
                .task {
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .seconds(1.4))
                        withAnimation(.smooth(duration: 1.6)) { proxy.scrollTo(4, anchor: .top) }
                        try? await Task.sleep(for: .seconds(2.2))
                        withAnimation(.smooth(duration: 1.4)) { proxy.scrollTo(0, anchor: .bottom) }
                        try? await Task.sleep(for: .seconds(1.4))
                    }
                }
            }
        }
        .frame(width: 360, height: 640)
        .clipShape(.rect(cornerRadius: 34, style: .continuous))
    }
}
/// Plain placeholder pages under the butter block; the selection walks Today, Upcoming, Done so the block tracks the pages.
private struct TrackingTabsLoop: View {
    @State private var selection = 0
    private let titles = ["Today", "Upcoming", "Done"]
    private let counts = [4, 6, 2]
    var body: some View {
        TrackingTabs(titles: titles, selection: $selection, counts: counts) { index in
            // Plain placeholder rows, only so each page has something to page through.
            VStack(spacing: 10) {
                ForEach(0..<counts[index], id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(NDP.surface)
                        .frame(height: 56)
                }
                Spacer(minLength: 0)
            }
            .accessibilityHidden(true)
        }
        .padding(16)
        .frame(width: 360, height: 420)
        .background(NDP.ground)
        .clipShape(.rect(cornerRadius: 34, style: .continuous))
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                selection = (selection + 1) % titles.count
            }
        }
    }
}
/// The dock over plain placeholder content: the butter block walks the items, the inbox count ticks up, and the dock tucks away and back.
private struct FloatingDockLoop: View {
    @State private var selection = 0
    @State private var inbox = 3
    @State private var scrollProgress: CGFloat = 0
    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(NDP.surface)
                        .frame(height: 62)
                }
                Spacer(minLength: 0)
            }
            .padding(20)
            .accessibilityHidden(true)
            FloatingDock(items: [
                .init("Home", systemImage: "house"),
                .init("Search", systemImage: "magnifyingglass"),
                .init("Inbox", systemImage: "tray", badge: inbox),
                .init("Profile", systemImage: "person"),
            ], selection: $selection, scrollProgress: scrollProgress)
            .padding(.bottom, 16)
        }
        .frame(width: 360, height: 360)
        .background(NDP.ground)
        .clipShape(.rect(cornerRadius: 34, style: .continuous))
        .task {
            while !Task.isCancelled {
                for index in [1, 2, 3, 0] {
                    try? await Task.sleep(for: .seconds(1.2))
                    selection = index
                    if index == 2 { inbox += 1 }
                }
                try? await Task.sleep(for: .seconds(0.6))
                scrollProgress = 1
                try? await Task.sleep(for: .seconds(0.8))
                scrollProgress = 0
                if inbox > 9 { inbox = 3 }
            }
        }
    }
}

// MARK: - sheets-feedback scenes

/// The toast alone on the ground: it arrives with Undo, drains its timer, dismisses, and returns.
private struct ToastLoop: View {
    @State private var shown = false
    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(inputsSheetsColor(0xF3F2EE, 0x121212))
            .toast(isPresented: $shown, message: "Conversation archived", detail: "Mira Reyes · Invoice 2291", style: .success, duration: 3, action: .init("Undo") {})
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(0.6))
                    shown = true
                    try? await Task.sleep(for: .seconds(4.4))
                }
            }
    }
}

/// The card alone, inline, over its own dimmed backdrop: bounce, spinner and success check.
private struct ConfirmSheetLoop: View {
    @State private var shown = false
    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(inputsSheetsColor(0xF3F2EE, 0x121212))
            .confirmSheet(isPresented: $shown, inline: true, systemImage: "trash", title: "Delete this note?", message: "It will be removed from your iPhone, iPad and Mac.", confirmTitle: "Delete note", isDestructive: true) {
                try? await Task.sleep(for: .seconds(0.8))
            }
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(0.5))
                    shown = true
                    try? await Task.sleep(for: .seconds(2.2))
                    shown = false
                    try? await Task.sleep(for: .seconds(0.6))
                }
            }
    }
}

/// Replays the present choreography (tile bounce, staggered benefit tiles) by re-identifying the view.
private struct PermissionSheetLoop: View {
    @State private var generation = 0
    var body: some View {
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
            onGranted: {},
            onSkip: {}
        )
        .id(generation)
        .frame(width: 380)
        .background(PermissionSheet.Style.standard.surface, in: .rect(cornerRadius: 34, style: .continuous))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(inputsSheetsColor(0xF3F2EE, 0x121212))
        .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(3)); generation += 1 } }
    }
}

/// The feedback scenes show the component alone on the house ground, with nothing around it.
private struct FeedbackStage<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(ReactionToggle.Style.adaptive(0xF3F2EE, 0x121212))
    }
}

/// The toggle in its three shapes: a count, a confirmation pill, and the bare symbol, toggled in turn.
private struct ReactionToggleLoop: View {
    @State private var liked = false
    @State private var saved = false
    @State private var starred = false
    var body: some View {
        FeedbackStage {
            HStack(spacing: 26) {
                ReactionToggle(isOn: $liked, count: 128, size: 36)
                ReactionToggle(isOn: $saved, systemImage: "bookmark", confirmation: "Saved", size: 36, style: .init(fill: ReactionToggle.Style.sky))
                ReactionToggle(isOn: $starred, systemImage: "star", size: 36, style: .init(fill: ReactionToggle.Style.butter, isContained: false))
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.4))
                liked = true
                try? await Task.sleep(for: .seconds(1.2))
                saved = true
                try? await Task.sleep(for: .seconds(1.6))
                starred = true
                try? await Task.sleep(for: .seconds(1.8))
                liked = false; saved = false; starred = false
            }
        }
    }
}

/// The rating alone: scrub up to five, settle on four, tap two.
private struct RatingScrubLoop: View {
    @State private var rating = 4.0
    var body: some View {
        FeedbackStage {
            RatingScrub(rating: $rating, labels: ["Poor", "Fair", "Good", "Very good", "Great"], size: 46)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                for value in [1.0, 2, 3, 4, 5] {
                    rating = value
                    try? await Task.sleep(for: .seconds(0.22))
                }
                try? await Task.sleep(for: .seconds(1.1))
                rating = 4
                try? await Task.sleep(for: .seconds(1.5))
                rating = 2
                try? await Task.sleep(for: .seconds(1.5))
                rating = 4
            }
        }
    }
}

/// The ring alone with its caption: idle, loading, then landing as a sage check and a tangerine cross.
private struct StatusMorphLoop: View {
    @State private var state: StatusMorph.State = .idle
    var body: some View {
        FeedbackStage {
            StatusMorph(state: state, captions: .saving, size: 196, lineWidth: 10)
        }
        .task {
            while !Task.isCancelled {
                state = .idle
                try? await Task.sleep(for: .seconds(1.1))
                state = .loading
                try? await Task.sleep(for: .seconds(1.8))
                state = .success
                try? await Task.sleep(for: .seconds(2.4))
                state = .loading
                try? await Task.sleep(for: .seconds(1.5))
                state = .failure
                try? await Task.sleep(for: .seconds(2.4))
            }
        }
    }
}

/// Only the rows the modifier replaces: they redact into one solid shape, reveal top to bottom, then fail once.
private struct SkeletonLoaderLoop: View {
    @State private var loading = true
    @State private var failed = false
    private let items: [(String, String, String, Color)] = [
        ("9:30", "Design review", "Studio B · 45 min", RatingScrub.Style.butter),
        ("11:00", "Lunch with Priya", "Ferro Kitchen · 1 h", RatingScrub.Style.sage),
        ("16:15", "Ship build 4.2", "Release room · 30 min", RatingScrub.Style.sky),
    ]
    var body: some View {
        FeedbackStage {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(items.indices, id: \.self) { index in
                    let item = items[index]
                    HStack(spacing: 18) {
                        Text(item.0)
                            .font(.system(size: 21, design: .rounded).weight(.bold))
                            .foregroundStyle(RatingScrub.Style.blockInk)
                            .frame(width: 92, height: 76)
                            .background(item.3, in: .rect(cornerRadius: 24, style: .continuous))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.1).font(.system(size: 22, weight: .semibold))
                            Text(item.2).font(.system(size: 19)).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                    .skeleton(isLoading: loading, isFailed: failed, staggerIndex: index)
                }
            }
            .padding(.horizontal, 28)
        }
        .task {
            while !Task.isCancelled {
                loading = true; failed = false
                try? await Task.sleep(for: .seconds(2.2))
                loading = false
                try? await Task.sleep(for: .seconds(2.8))
                loading = true
                try? await Task.sleep(for: .seconds(1.8))
                failed = true
                try? await Task.sleep(for: .seconds(1.9))
            }
        }
    }
}

/// A full-view piece, so it fills the stage: success, failure and empty, re-identified so each replays.
private struct OutcomeScreenLoop: View {
    @State private var outcome: OutcomeScreen.Outcome = .success
    var body: some View {
        FeedbackStage {
            Group {
                switch outcome {
                case .success:
                    OutcomeScreen(outcome: .success, title: "Backup complete", message: "2,418 photos and 36 videos are safe in your library.", primaryTitle: "Done", eyebrow: "Synced 10:42")
                case .failure:
                    OutcomeScreen(outcome: .failure, title: "Couldn't sync", message: "Check your connection and try again.", retry: { try? await Task.sleep(for: .seconds(1)) }, secondary: .init("Not now") {}, details: "URLSessionTask failed: The Internet connection appears to be offline. (NSURLErrorDomain -1009)")
                case .empty:
                    OutcomeScreen(outcome: .empty, title: "No invoices yet", message: "Invoices you send to clients show up here.", primaryTitle: "New invoice", eyebrow: "Invoices")
                }
            }
            .id(outcome)
            .padding(.horizontal, 12)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3.4))
                outcome = switch outcome { case .success: .failure; case .failure: .empty; case .empty: .success }
            }
        }
    }
}

// MARK: - motion-data-media scenes

/// Mirrors DragToDismiss on a timer with the registry example's card: the modifier is gesture-driven and the recorder
/// cannot drag, so this reproduces the follow, the rounding and shrink with progress, the scrim thinning, the spring
/// back, and a fly-off along the drag vector. Nothing but the card the modifier moves is on the stage.
private struct DragToDismissLoop: View {
    private enum Phase { case rest, pulled, armed, gone }
    @State private var phase: Phase = .rest

    var body: some View {
        let progress: CGFloat = switch phase { case .rest: 0; case .pulled: 0.5; case .armed: 1; case .gone: 1 }
        let offset: CGSize = switch phase {
        case .rest: .zero
        case .pulled: CGSize(width: 18, height: 55)
        case .armed: CGSize(width: 40, height: 150)
        case .gone: CGSize(width: 260, height: 980)
        }
        ZStack {
            bmColor(light: 0xF3F2EE, dark: 0x121212).ignoresSafeArea()
            bmColor(0x141414).opacity(0.5 * (1 - progress)).ignoresSafeArea()
            DragToDismissScene.pass
                .clipShape(.rect(cornerRadius: 40 * progress, style: .continuous))
                .scaleEffect(1 - 0.15 * progress)
                .offset(offset)
                .opacity(phase == .gone ? 0 : 1)
        }
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: phase) { _, new in new == .armed }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.2))
                withAnimation(.interactiveSpring(duration: 0.6)) { phase = .pulled }
                try? await Task.sleep(for: .seconds(0.8))
                withAnimation(.spring(duration: 0.45, bounce: 0.28)) { phase = .rest }
                try? await Task.sleep(for: .seconds(1.0))
                withAnimation(.interactiveSpring(duration: 0.7)) { phase = .armed }
                try? await Task.sleep(for: .seconds(1.1))
                withAnimation(.spring(duration: 0.32, bounce: 0)) { phase = .gone }
                try? await Task.sleep(for: .seconds(0.9))
                phase = .rest
            }
        }
    }
}

/// The card the modifier moves, and nothing else. Drag it anywhere: it rounds and shrinks as it travels, the modifier's
/// own scrim thins with it, and a far drag or a fast flick sends it off along the drag.
private struct DragToDismissScene: View {
    @State private var shown = true

    var body: some View {
        ZStack {
            if shown {
                Self.pass
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .dragToDismiss(cornerRadius: 40) { shown = false }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(bmColor(light: 0xF3F2EE, dark: 0x121212))
        .ignoresSafeArea()
        .task(id: shown) {
            guard !shown else { return }
            try? await Task.sleep(for: .seconds(0.9))
            withAnimation(.smooth(duration: 0.35)) { shown = true }
        }
    }

    /// A butter boarding pass with the route as a heavy headline and times as light numerals.
    static var pass: some View {
        let ink = bmColor(0x141414)
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("BOARDING PASS")
                    .font(.caption.weight(.bold))
                    .tracking(1)
                Spacer()
                Text("Group 2")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(bmColor(0x9CC2FF), in: .capsule)
            }
            Text("SFO\n\(Text("to LIS").foregroundStyle(ink.opacity(0.55)))")
                .font(.system(size: 56, weight: .bold))
                .tracking(-2.4)
                .padding(.top, 28)
            HStack(alignment: .firstTextBaseline, spacing: 28) {
                field("DEPARTS", "07:45")
                field("GATE", "B12")
                field("SEAT", "14A")
            }
            .padding(.top, 28)
            Rectangle()
                .fill(ink.opacity(0.14))
                .frame(height: 1.5)
                .padding(.vertical, 22)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Maya Lindqvist").font(.headline)
                    Text("Flight SP 208 · Boards 07:10").font(.subheadline).opacity(0.62)
                }
                Spacer()
                Image(systemName: "qrcode")
                    .font(.system(size: 40))
            }
        }
        .foregroundStyle(ink)
        .padding(24)
        .frame(width: 330)
        .background(bmColor(0xFFD976), in: .rect(cornerRadius: 34, style: .continuous))
        .shadow(color: .black.opacity(0.28), radius: 30, y: 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Boarding pass, San Francisco to Lisbon, departs 7:45, gate B12, seat 14A")
        .accessibilityHint("Drag or use the escape gesture to close")
    }

    private static func field(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2.weight(.bold)).tracking(1).opacity(0.6)
            Text(value).font(.system(size: 30, weight: .light)).monospacedDigit().tracking(-0.8)
        }
    }
}

/// The chart itself: the light readout with dimmed cents, the sage delta block, and the butter picker cycling so the line morphs.
private struct ScrubChartLoop: View {
    @State private var range = 1
    private let now = Date(timeIntervalSince1970: 1_789_560_000)

    private func series(_ label: String, step: TimeInterval, values: [Double]) -> ScrubChart<FloatingPointFormatStyle<Double>.Currency>.Series {
        .init(label: label, points: values.enumerated().map {
            .init(date: now.addingTimeInterval(-step * Double(values.count - 1 - $0.offset)), value: $0.element)
        })
    }

    var body: some View {
        ScrubChart(
            series: [
                series("1D", step: 1_800, values: [182.1, 182.6, 181.9, 183.4, 184.0, 183.2, 184.8, 185.3, 184.9, 186.1, 185.7, 186.4, 187.0]),
                series("1W", step: 21_600, values: [176.3, 177.8, 179.1, 178.2, 180.4, 181.0, 179.7, 182.5, 183.9, 182.8, 184.6, 186.1, 185.4, 187.0]),
                series("1M", step: 86_400, values: [191.2, 189.4, 188.0, 186.7, 184.1, 185.9, 183.3, 181.8, 180.2, 182.6, 179.5, 178.1, 180.9, 182.4, 184.7, 187.0]),
                series("1Y", step: 86_400 * 24, values: [142.0, 150.3, 147.8, 158.2, 163.9, 160.1, 171.4, 176.0, 168.3, 179.9, 183.5, 187.0]),
            ],
            format: .currency(code: "USD"),
            range: $range
        )
        .frame(height: 300)
        .padding(20)
        // The chart's style rings its dot in `ground`, so it sits on that surface.
        .background(NDP.surface, in: .rect(cornerRadius: 34, style: .continuous))
        .frame(width: 360)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                withAnimation(.spring(duration: 0.35, bounce: 0.2)) { range = (range + 1) % 4 }
            }
        }
    }
}

/// Walks the selection around the block ring so the lift, the resting slices, the center figure, and the legend block all fire.
private struct RingBreakdownLoop: View {
    @State private var selection: String?
    private let labels = ["Housing", "Food", "Transport", "Leisure", "Other"]

    var body: some View {
        RingBreakdown(
            slices: [
                .init(label: "Housing", value: 1450), .init(label: "Food", value: 620), .init(label: "Transport", value: 310),
                .init(label: "Leisure", value: 270), .init(label: "Other", value: 150)
            ],
            format: .currency(code: "USD").precision(.fractionLength(0)),
            selection: $selection
        )
        .padding(24)
        .frame(width: 340)
        .task {
            var index = -1
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(index < 0 ? 1.4 : 1.0))
                index += 1
                selection = index < labels.count ? labels[index] : nil
                if index >= labels.count { index = -1 }
            }
        }
    }
}

/// The tile alone: the revenue rolls, then the tile expands into the taller chart with low and high.
private struct LiveStatLoop: View {
    @State private var revenue: Double = 48_250.40
    @State private var expanded = false

    var body: some View {
        LiveStat(label: "Revenue", value: revenue, format: .currency(code: "USD"), delta: 0.124, series: [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25], expanded: $expanded)
            .frame(width: 340)
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1.6))
                    revenue = 51_940.15
                    try? await Task.sleep(for: .seconds(1.4))
                    expanded = true
                    try? await Task.sleep(for: .seconds(1.8))
                    expanded = false
                    try? await Task.sleep(for: .seconds(1.0))
                    revenue = 48_250.40
                }
            }
    }
}

/// The number alone: loads with dashes, rolls up, then a deposit and a rent payment roll the digits with sage and tangerine delta blocks.
private struct OdometerLoop: View {
    @State private var balance: Double = 12_480.55
    @State private var loading = true

    var body: some View {
        Odometer(value: balance, format: .currency(code: "USD"), isLoading: loading)
            .font(.system(size: 48, weight: .light))
            .frame(minHeight: 60)
            .padding(24)
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1.0))
                    loading = false
                    try? await Task.sleep(for: .seconds(2.2))
                    balance += 517
                    try? await Task.sleep(for: .seconds(2.4))
                    balance -= 1_450
                    try? await Task.sleep(for: .seconds(2.4))
                    balance = 12_480.55; loading = true
                }
            }
    }
}

// MARK: - ai scenes

private struct StreamingReplyLoop: View {
    @State private var prompt = "Summarize the **Q3 report** in two lines."
    @State private var reply = ""
    @State private var phase: StreamingReply.Phase = .thinking
    @State private var cycle = 0
    private let full = "Revenue grew **12%** quarter over quarter and churn fell to 1.8%. The new `Insights` tab drove most of the engagement lift."

    var body: some View {
        LAStage(alignment: .center) {
            VStack(spacing: 26) {
                StreamingReply(text: $prompt, role: .user)
                StreamingReply(text: $reply, phase: phase)
                    .frame(minHeight: 150, alignment: .top)
            }
            .id(cycle)
            .padding(24)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.4))
                phase = .streaming
                for word in full.split(separator: " ") {
                    reply += (reply.isEmpty ? "" : " ") + word
                    try? await Task.sleep(for: .milliseconds(110))
                }
                phase = .done
                try? await Task.sleep(for: .seconds(2.2))
                reply = ""
                phase = .thinking
                cycle += 1
            }
        }
    }
}

private struct ThinkingStateLoop: View {
    @State private var active = true
    private var quiet: ThinkingState.Style {
        var style = ThinkingState.Style()
        style.showsHeader = false
        return style
    }

    var body: some View {
        LAStage(alignment: .center) {
            VStack(alignment: .leading, spacing: 30) {
                ThinkingState(.dots)
                ThinkingState(.sheen, lineCount: 2)
                ThinkingState(.text("Reading the Q3 report"), style: quiet)
                Label("Drafting reply", systemImage: "sparkle")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(LAPalette.ink)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .background(LAPalette.butter, in: Capsule())
                    .thinkingState(active)
            }
            .padding(24)
        }
        .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(3)); active.toggle() } }
    }
}

private struct PromptChipsLoop: View {
    @State private var selection: String?
    @State private var cycle = 0

    var body: some View {
        LAStage(alignment: .center) {
            PromptChips(
                ["Summarize this page", "Draft a reply to Mara", "Find action items", "Plan my week"],
                symbols: ["text.alignleft", "arrowshape.turn.up.left", "checklist", "calendar"],
                selection: $selection
            ) { _ in }
            .id(cycle)
            .frame(height: 60, alignment: .top)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                selection = "Draft a reply to Mara"
                try? await Task.sleep(for: .seconds(1.4))
                selection = nil
                cycle += 1
            }
        }
    }
}

private struct CodeBlockLoop: View {
    private static let source = [
        "/// Greets someone by name.",
        "func greet(_ name: String) -> String {",
        "    // Interpolation keeps it simple.",
        "    return \"Hello, \\(name)!\"",
        "}",
        "",
        "let names = [\"Mara\", \"Jonas\"]",
        "names.prefix(2).map(greet)",
    ]
    @State private var shown = 1
    @State private var streaming = true

    var body: some View {
        LAStage(alignment: .center) {
            CodeBlock(Self.source.prefix(shown).joined(separator: "\n"), showsLineNumbers: true, collapseAfter: nil, isStreaming: streaming, title: "Greeter.swift")
                .padding(20)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(380))
                if shown < Self.source.count {
                    shown += 1
                } else if streaming {
                    streaming = false
                    try? await Task.sleep(for: .seconds(2.2))
                    shown = 1
                    streaming = true
                }
            }
        }
    }
}

// MARK: - orbs scenes

private struct AssistantOrbLoop: View {
    var body: some View {
        VStack(spacing: 24) {
            AssistantOrb(size: 180, palette: .siri)
            Text("Thinking")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
        }
    }
}

private struct ThoughtOrbLoop: View {
    /// Each step is a kind of work; the mark's colour follows it while the motion stays the same.
    private static let steps: [(String, ThoughtOrb.Palette)] = [
        ("Thinking", .siri), ("Searching sources", .searching), ("Reading the thread", .reading), ("Drafting a reply", .writing),
    ]
    @State private var index = 0

    var body: some View {
        VStack(spacing: 28) {
            ThoughtOrb(size: 120, palette: Self.steps[index].1)
            ThoughtOrb.Pill(Self.steps[index].0, palette: Self.steps[index].1, tint: .white)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.5))
                index = (index + 1) % Self.steps.count
            }
        }
    }
}

// MARK: - backgrounds-motion scenes (mirror each registry file's Example)

private func bmColor(_ hex: UInt32) -> Color {
    Color(uiColor: bmUIColor(hex))
}

private func bmColor(light: UInt32, dark: UInt32) -> Color {
    let l = bmUIColor(light), d = bmUIColor(dark)
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
}

private func bmUIColor(_ hex: UInt32) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

/// A finger sweeps an arc (0–3 s), releases into the spring, then taps once for a ripple.
private struct TouchGridLoop: View {
    var body: some View {
        TimelineView(.animation) { context in
            let t = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 6)
            TouchGridScene(probe: t < 3 ? CGPoint(x: 90 + t / 3 * 220, y: 520 - sin(t / 3 * .pi) * 160) : (t >= 4.4 && t < 4.55 ? CGPoint(x: 200, y: 460) : nil))
        }
    }
}

/// The fabric, full bleed, with nothing on top.
private struct SilkScene: View {
    var body: some View {
        Silk(style: .tangerine, scale: 2.6)
            .ignoresSafeArea()
    }
}

/// The grid on the house ground, full bleed, with nothing on top.
private struct TouchGridScene: View {
    /// A programmatic finger for demos; nil leaves the grid to real touches.
    var probe: CGPoint? = nil

    var body: some View {
        ZStack {
            bmColor(light: 0xF3F2EE, dark: 0x121212)
            TouchGrid(spacing: 26, dotSize: 4, radius: 130, probe: probe)
        }
        .ignoresSafeArea()
    }
}

