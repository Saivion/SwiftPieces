// Metric Strip: a row of narrow body-metric tiles (a symbol, a figure, its unit) each over a tiny
// sparkline sitting in a range box, green when today is within the usual range and red when not.
// The tiles ease in one by one (0.95 + fade, 40 ms apart) as the strip appears. Press a tile (it dips
// to 0.97) to select it with a selection tick and read what the metric is and where today falls.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { opts, select } from "../shared.js";
import { data, records, swiftHex, swiftNums, swiftStrs } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");

/** A deterministic little trend for a tile, ending where the status says (in range or out). */
export function sparkFor(seed: string, inRange: boolean): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(0.25 + ((h >>> 8) % 1000) / 1000 * 0.5);
  }
  out[6] = inRange ? 0.55 : 0.08;
  return out;
}

const ITEMS = "Resting pulse | heart.fill | 56 | bpm | in; Variability | bolt | 61 | ms | in; Breathing | leaf | 14.2 | br/min | out; Oxygen | drop | 98 | % | in";

/** In-range and out-of-range colours. `sweep` (the default) is the Swift Pieces azure and signal red. */
export const METRIC_TONES: Record<string, { label: string; good: string; bad: string }> = {
  sweep: { label: "Signal sweep", good: "#4D8DFF", bad: "#FF0000" },
  status: { label: "Green and red", good: "#30C85E", bad: "#EF4B4B" },
};
export const metricTone = (id: string) => METRIC_TONES[id] ?? METRIC_TONES.sweep;

const SWIFT = [
  "private struct MetricStrip: View {",
  "    let names: [String]",
  "    let symbols: [String]",
  "    let values: [String]",
  "    let units: [String]",
  "    let inRange: [Bool]",
  "    let sparks: [[Double]]",
  "    var raised = true",
  "    var goodColor: Color = .green",
  "    var badColor: Color = .red",
  "    @State private var selected: Int?",
  "    @State private var appeared = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        VStack(alignment: .leading, spacing: 10) {",
  "            HStack(spacing: 8) {",
  "                ForEach(names.indices, id: \\.self) { i in",
  "                    tile(i)",
  "                }",
  "            }",
  "            if let i = selected {",
  "                Text(\"\\(names[i]): \\(inRange[i] ? \"within your usual range\" : \"outside your usual range\")\")",
  "                    .font(.footnote)",
  "                    .foregroundStyle(.secondary)",
  "                    .transition(.opacity)",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  "    private var surface: Color { raised ? Color(uiColor: .secondarySystemGroupedBackground) : Color(uiColor: .tertiarySystemFill) }",
  "",
  "    private func tile(_ i: Int) -> some View {",
  "        let good = inRange[i]",
  "        return Button {",
  "            withAnimation(.easeOut(duration: 0.15)) { selected = selected == i ? nil : i }",
  "        } label: {",
  "            VStack(spacing: 2) {",
  "                Image(systemName: symbols[i])",
  "                    .font(.subheadline.weight(.semibold))",
  "                    .padding(.bottom, 4)",
  "                Text(values[i])",
  "                    .font(.title3.weight(.bold))",
  "                    .monospacedDigit()",
  "                    .minimumScaleFactor(0.7)",
  "                    .lineLimit(1)",
  "                Text(units[i])",
  "                    .font(.caption)",
  "                Spark(values: sparks[i], good: good, goodColor: goodColor, badColor: badColor, surface: raised ? surface : Color(uiColor: .systemBackground))",
  "                    .frame(height: 30)",
  "                    .padding(.top, 8)",
  "            }",
  "            .foregroundStyle(.primary)",
  "            .padding(.vertical, 12)",
  "            .padding(.horizontal, 6)",
  "            .frame(maxWidth: .infinity)",
  "            .background(surface, in: .rect(cornerRadius: 16, style: .continuous))",
  "            .overlay {",
  "                RoundedRectangle(cornerRadius: 16, style: .continuous)",
  "                    .strokeBorder(selected == i ? Color.accentColor : .clear, lineWidth: 2)",
  "            }",
  "        }",
  "        .buttonStyle(MetricStripPress())",
  "        .accessibilityLabel(\"\\(names[i]) \\(values[i]) \\(units[i])\")",
  "        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "        .opacity(appeared ? 1 : 0)",
  "        .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.3).delay(reduceMotion ? 0 : Double(min(i, 7)) * 0.04), value: appeared)",
  "    }",
  "}",
  "",
  "private struct MetricStripPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
  "",
  "private struct Spark: View {",
  "    let values: [Double]",
  "    let good: Bool",
  "    var goodColor: Color = .green",
  "    var badColor: Color = .red",
  "    var surface: Color = Color(uiColor: .secondarySystemGroupedBackground)",
  "    var body: some View {",
  "        GeometryReader { geo in",
  "            let w = geo.size.width, h = geo.size.height",
  "            let color: Color = good ? goodColor : badColor",
  "            let points = values.enumerated().map { i, v in",
  "                CGPoint(x: w * Double(i) / Double(max(values.count - 1, 1)), y: h * (1 - v))",
  "            }",
  "            ZStack(alignment: .topLeading) {",
  "                RoundedRectangle(cornerRadius: 4)",
  "                    .fill(goodColor.opacity(0.18))",
  "                    .frame(height: h * 0.55)",
  "                    .offset(y: h * 0.1)",
  "                if !good {",
  "                    RoundedRectangle(cornerRadius: 4)",
  "                        .fill(badColor.opacity(0.18))",
  "                        .frame(height: h * 0.3)",
  "                        .offset(y: h * 0.7)",
  "                }",
  "                Path { path in path.addLines(points) }",
  "                    .stroke(.secondary, lineWidth: 1.2)",
  "                if let last = points.last {",
  "                    Circle()",
  "                        .strokeBorder(color, lineWidth: 2.5)",
  "                        .background(Circle().fill(surface))",
  "                        .frame(width: 10, height: 10)",
  "                        .position(last)",
  "                }",
  "            }",
  "        }",
  "    }",
  "}",
];

export const metricStrip: SwiftPieceDefinition = {
  id: "metric-strip",
  name: "Metric Strip",
  category: "pieces",
  description: "A row of narrow body-metric tiles, each with a figure and a tiny sparkline in its usual-range box, marked green or red. Tap one to read it.",
  availability: "free",
  preview: { component: "metric-strip", chunk: "app-pieces" },
  icon: "heart.fill",
  concepts: ["state", "hstack"],
  anatomy: [
    { part: "Tiles", props: ["items"] },
    { part: "Surface", props: ["surface", "tone"] },
  ],
  interactions: ["tap", "haptic"],
  variants: [
    { id: "body", label: "Recovery", props: {} },
    { id: "three", label: "Three tiles", props: { items: "Resting pulse | heart.fill | 54 | bpm | in; Sleep | moon | 7.1 | hours | in; Steps | figure.walk | 2.8 | thousand | out" } },
    { id: "status", label: "Green and red", props: { tone: "status" } },
  ],
  states: [{ id: "alert", label: "One out of range", props: { items: "Resting pulse | heart.fill | 64 | bpm | out; Variability | bolt | 36 | ms | out; Temperature | sun.max | 36.5 | °C | in" } }],
  properties: [
    data("items", "Metrics", ITEMS, { hint: "Name | symbol | value | unit | in or out, separated by semicolons." }),
    select("surface", "Tile surface", "raised", opts(["raised", "Raised"], ["fill", "Fill"])),
    select("tone", "Range colours", "sweep", opts(...Object.entries(METRIC_TONES).map(([k, v]): [string, string] => [k, v.label]))),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("MetricStrip", SWIFT);
      const rows = records(s(p, "items"), 6);
      const good = rows.map((r) => (r[4] ?? "in").toLowerCase() !== "out");
      return {
        lines: call("MetricStrip", [
          ["names", swiftStrs(rows.map((r) => r[0] ?? ""), ctx.str)],
          ["symbols", swiftStrs(rows.map((r) => ctx.symbol(r[1] || "heart.fill")), ctx.str)],
          ["values", swiftStrs(rows.map((r) => r[2] ?? ""), ctx.str)],
          ["units", swiftStrs(rows.map((r) => r[3] ?? ""), ctx.str)],
          ["inRange", `[${good.map(String).join(", ")}]`],
          ["sparks", `[${rows.map((r, i) => swiftNums(sparkFor(r[0] ?? String(i), good[i]))).join(", ")}]`],
          s(p, "surface") === "fill" && ["raised", "false"],
          s(p, "tone") !== "status" && ["goodColor", swiftHex(metricTone(s(p, "tone")).good)],
          s(p, "tone") !== "status" && ["badColor", swiftHex(metricTone(s(p, "tone")).bad)],
        ]),
      };
    },
  },
};
