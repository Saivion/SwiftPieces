import SwiftUI

/// The StatsOverviewBlock recording scene (PreviewCatalog): the block at the top of a dashboard screen. It loads for a
/// moment as bones, lands on its numbers, then lives: the range moves to 90 days and back, and visitors tick up.
struct StatsOverviewBlockScene: View {
    @State private var phase: StatsOverviewBlock.Phase = .loading
    @State private var range = 1
    @State private var visitors: Double = 12_480

    var body: some View {
        ScrollView {
            StatsOverviewBlock(
                subtitle: phase == .loading ? "Updating…" : "Updated just now",
                headline: .init(label: "Recurring revenue", format: .currency(code: "USD"), series: StatsOverviewSceneData.revenue),
                stats: [
                    .init(label: "Visitors", value: visitors, delta: 0.08, history: Array(StatsOverviewSceneData.visitors.dropLast()) + [visitors]),
                    .init(label: "Trials", value: 412, delta: 0.12, history: StatsOverviewSceneData.trials),
                    .init(label: "Conversion", value: 0.033, format: .percent, delta: 0.036, history: StatsOverviewSceneData.conversion),
                ],
                phase: phase,
                range: $range,
                onRetry: { await load() }
            )
            .padding(20)
        }
        .background(StatsOverviewSceneData.ground)
        .task {
            await load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.4))
                range = 2
                try? await Task.sleep(for: .seconds(2.4))
                visitors += 56
                try? await Task.sleep(for: .seconds(2.4))
                range = 1
                try? await Task.sleep(for: .seconds(2.4))
                visitors = 12_480
            }
        }
    }

    /// A fake fetch that succeeds after a moment.
    private func load() async {
        try? await Task.sleep(for: .seconds(1.2))
        phase = .loaded
    }
}

/// The scene's numbers: 90 days of recurring revenue (the 30- and 7-day ranges are its last days), and the recent
/// history of visitors, trials and the conversion from one to the other. The same as the block's own example.
private enum StatsOverviewSceneData {
    static let now = Date(timeIntervalSince1970: 1_792_411_200)

    static let daily: [Double] = (0..<90).map { day in
        func wiggle(_ i: Double) -> Double { 187 * sin(0.9 * i + 0.4) + 260 * sin(0.31 * i + 1.1) + 150 * sin(0.093 * i + 2) }
        func bump(_ i: Double, _ at: Double, _ height: Double, _ width: Double) -> Double { height * exp(-pow((i - at) / width, 2)) }
        func events(_ i: Double) -> Double { bump(i, 14, -900, 5) + bump(i, 67, -700, 3.2) + bump(i, 82.6, -350, 0.8) + bump(i, 84, 380, 1.2) + bump(i, 86.8, -420, 1) }
        let i = Double(day), t = i / 89
        let trend = 39_880 + (48_250.40 - 39_880) * (0.7 * t + 0.3 * t * t)
        let swing = wiggle(i) - wiggle(89) * t - wiggle(0) * (1 - t) + events(i) - events(89) * t - events(0) * (1 - t)
        return ((trend + swing) * 100).rounded() / 100
    }

    static func last(_ days: Int, _ label: String) -> StatsOverviewBlock.Series {
        .init(label: label, points: daily.suffix(days).enumerated().map { offset, value in
            .init(date: now.addingTimeInterval(-86_400 * Double(days - 1 - offset)), value: value)
        })
    }

    static let revenue = [last(7, "7D"), last(30, "30D"), last(90, "90D")]
    static let visitors: [Double] = [9_820, 10_410, 10_120, 10_960, 11_340, 11_020, 11_610, 12_140, 11_790, 12_230, 12_010, 12_480]
    static let trials: [Double] = [301, 322, 318, 340, 356, 349, 371, 388, 380, 397, 404, 412]
    static let conversion: [Double] = [0.0281, 0.0290, 0.0286, 0.0298, 0.0305, 0.0301, 0.0312, 0.0318, 0.0315, 0.0326, 0.0322, 0.0330]

    /// The screen's ground behind the block, as in the pieces' examples.
    static let ground = Color(uiColor: UIColor { @Sendable traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x12 / 255, green: 0x12 / 255, blue: 0x12 / 255, alpha: 1)
            : UIColor(red: 0xF3 / 255, green: 0xF2 / 255, blue: 0xEE / 255, alpha: 1)
    })
}
