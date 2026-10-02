// Band Trend: a day-by-day line of dots running through a shaded "your usual range" band, the
// way a gentle fitness app shows whether you're under, inside or over what's normal for you.
// It draws in from the left as it appears. Drag across it to read any day: the dot grows, a
// selection tick plays, and a label says where it sits against the band.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { bool, number } from "../shared.js";
import { data, numbers, swiftNums, swiftStrs, swiftTint, tint } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** Pads or trims a band edge to the number of values, holding its last value. */
export function fitTo(values: number[], length: number, fallback: number): number[] {
  if (!values.length) return Array.from({ length }, () => fallback);
  return Array.from({ length }, (_, i) => values[Math.min(i, values.length - 1)]);
}

const SWIFT = [
  "private struct BandTrend: View {",
  "    let values: [Double]",
  "    let lower: [Double]",
  "    let upper: [Double]",
  "    let labels: [String]",
  "    var tint: Color = .green",
  "    var height: CGFloat = 170",
  "    var showsDots = true",
  "    @State private var selected: Int?",
  "    @State private var drawn = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        VStack(alignment: .leading, spacing: 8) {",
  "            Text(caption)",
  "                .font(.footnote.weight(.semibold))",
  "                .foregroundStyle(.secondary)",
  "                .contentTransition(.numericText())",
  "            Chart {",
  "                ForEach(values.indices, id: \\.self) { i in",
  "                    AreaMark(x: .value(\"Day\", i), yStart: .value(\"Low\", lower[i]), yEnd: .value(\"High\", upper[i]), series: .value(\"Band\", \"Usual\"))",
  "                        .foregroundStyle(tint.opacity(0.85))",
  "                        .interpolationMethod(.catmullRom)",
  "                    AreaMark(x: .value(\"Day\", i), yStart: .value(\"Low\", inner(i).0), yEnd: .value(\"High\", inner(i).1), series: .value(\"Band\", \"Core\"))",
  "                        .foregroundStyle(tint.mix(with: .white, by: 0.25))",
  "                        .interpolationMethod(.catmullRom)",
  "                    LineMark(x: .value(\"Day\", i), y: .value(\"Value\", values[i]), series: .value(\"Band\", \"You\"))",
  "                        .foregroundStyle(Color.primary)",
  "                        .lineStyle(StrokeStyle(lineWidth: 1.5))",
  "                    if showsDots || selected == i {",
  "                        PointMark(x: .value(\"Day\", i), y: .value(\"Value\", values[i]))",
  "                            .foregroundStyle(Color.primary)",
  "                            .symbolSize(selected == i ? 110 : 22)",
  "                    }",
  "                }",
  "            }",
  "            .chartXSelection(value: $selected)",
  "            .chartYScale(domain: domain)",
  "            .chartXScale(range: .plotDimension(padding: 8))",
  "            .chartYAxis(.hidden)",
  "            .chartXAxis {",
  "                AxisMarks(values: Array(values.indices)) { value in",
  "                    if let i = value.as(Int.self), i < labels.count, !labels[i].isEmpty {",
  "                        AxisValueLabel(anchor: i == lastLabel && i == values.count - 1 ? .topTrailing : .top, collisionResolution: .disabled) {",
  "                            Text(labels[i])",
  "                                .font(.footnote.weight(i == lastLabel ? .semibold : .regular))",
  "                                .foregroundStyle(i == lastLabel ? .primary : .secondary)",
  "                        }",
  "                    }",
  "                }",
  "            }",
  "            .frame(height: height)",
  "            .mask(alignment: .leading) {",
  "                GeometryReader { geo in",
  "                    Rectangle().frame(width: drawn || reduceMotion ? geo.size.width : 0)",
  "                }",
  "            }",
  "            .opacity(drawn ? 1 : 0)",
  "            .onAppear {",
  "                withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.3)) { drawn = true }",
  "            }",
  "            .sensoryFeedback(.selection, trigger: selected)",
  "        }",
  "    }",
  "",
  "    private var domain: ClosedRange<Double> {",
  "        let all = values + lower + upper",
  "        let lo = all.min() ?? 0, hi = all.max() ?? 1",
  "        let pad = max((hi - lo) * 0.12, 1)",
  "        return (lo - pad)...(hi + pad)",
  "    }",
  "",
  "    private var lastLabel: Int { labels.lastIndex(where: { !$0.isEmpty }) ?? -1 }",
  "",
  "    private func inner(_ i: Int) -> (Double, Double) {",
  "        let span = upper[i] - lower[i]",
  "        return (lower[i] + span * 0.25, upper[i] - span * 0.25)",
  "    }",
  "",
  "    private var caption: String {",
  "        guard let i = selected, values.indices.contains(i) else { return \"Drag to read a day\" }",
  "        let v = values[i]",
  "        let place = v > upper[i] ? \"Above your range\" : v < lower[i] ? \"Below your range\" : \"In your range\"",
  "        return \"\\(Int(v.rounded())) · \\(place)\"",
  "    }",
  "}",
];

export const bandTrend: SwiftPieceDefinition = {
  id: "band-trend",
  name: "Band Trend",
  category: "pieces",
  description: "A line of daily dots through a shaded usual-range band. Drag across to read a day and see whether it sat under, inside or over your range.",
  availability: "free",
  preview: { component: "band-trend", chunk: "app-pieces" },
  icon: "chart.line.uptrend.xyaxis",
  concepts: ["state", "gesture", "framework"],
  anatomy: [
    { part: "Line", props: ["values", "dots"] },
    { part: "Band", props: ["lower", "upper", "tint"] },
    { part: "Axis", props: ["labels"] },
    { part: "Size", props: ["height"] },
  ],
  interactions: ["scrub", "haptic"],
  variants: [
    { id: "azure", label: "Activity", props: { tint: "azure" } },
    { id: "green", label: "Green", props: { tint: "green" } },
    { id: "sleep", label: "Sleep", props: { tint: "blush", values: "7.2, 6.8, 7.9, 8.1, 6.4, 7.0, 7.7, 8.3, 7.4, 6.9, 7.8, 8.0", lower: "6.6", upper: "8.2", labels: "Mon, , , , , , Sun, , , , , Today" } },
    { id: "line", label: "Line only", props: { dots: false } },
  ],
  states: [{ id: "tall", label: "Tall", props: { height: 240 } }],
  properties: [
    data("values", "Values", "44, 47, 41, 52, 49, 38, 36, 45, 50, 57, 54, 48, 60, 63, 55, 51, 46, 58, 61, 66, 59, 53, 57, 64, 69, 62, 58, 65, 71, 67", { hint: "One number per day, oldest first." }),
    data("lower", "Range low", "40, 40, 40, 41, 41, 41, 42, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 48, 49, 49, 50, 50, 51, 51, 52, 52, 53", { hint: "The bottom of the usual range, per day. One number holds it flat." }),
    data("upper", "Range high", "54, 54, 55, 55, 56, 56, 57, 57, 58, 58, 59, 59, 60, 60, 61, 61, 62, 62, 63, 63, 64, 64, 65, 65, 66, 66, 67, 67, 68, 68"),
    data("labels", "Axis labels", "1, , , , , , , 8, , , , , , , 15, , , , , , , 22, , , , , , , , Today", { hint: "One per value; leave gaps blank." }),
    tint("tint", "Band colour", "azure"),
    bool("dots", "Day dots", true),
    number("height", "Height", 170, 100, 320),
  ],
  swift: {
    imports: ["Charts"],
    emit(p, ctx) {
      ctx.import("Charts");
      ctx.declare("BandTrend", SWIFT);
      const values = numbers(s(p, "values"));
      const mid = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const labels = String(s(p, "labels")).split(",").map((l) => l.trim());
      return {
        lines: call("BandTrend", [
          ["values", swiftNums(values)],
          ["lower", swiftNums(fitTo(numbers(s(p, "lower")), values.length, mid * 0.8))],
          ["upper", swiftNums(fitTo(numbers(s(p, "upper")), values.length, mid * 1.2))],
          ["labels", swiftStrs(Array.from({ length: values.length }, (_, i) => labels[i] ?? ""), ctx.str)],
          s(p, "tint") !== "green" && ["tint", swiftTint(s(p, "tint"))],
          n(p, "height") !== 170 && ["height", num(n(p, "height"))],
          p.dots === false && ["showsDots", "false"],
        ]),
      };
    },
  },
};
