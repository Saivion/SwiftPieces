// Area Scrub: a day's curve (temperature, tide, energy) drawn as a soft filled hill across the
// width, with a tall scrub line you drag through the day. The clock time and the value under the
// line ride at the top, the peak and the end value are labelled, and each hour you cross ticks.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, text } from "../shared.js";
import { data, numbers, swiftNums, swiftTint, tint } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** Hour (0–24, fractional) → "4:20 pm". */
export function clockLabel(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${((h + 11) % 12) + 1}:${String(m === 60 ? 0 : m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** The curve's value at an hour, read between the two nearest points. */
export function valueAt(values: number[], hour: number, start: number, end: number): number {
  if (values.length === 0) return 0;
  const f = Math.max(0, Math.min(1, (hour - start) / Math.max(end - start, 1))) * (values.length - 1);
  const i = Math.floor(f);
  const next = values[Math.min(i + 1, values.length - 1)];
  return values[i] + (next - values[i]) * (f - i);
}

const SWIFT = [
  "private struct AreaScrub: View {",
  "    let values: [Double]",
  "    var startHour: Double = 6",
  "    var endHour: Double = 22",
  "    var unit = \"°\"",
  "    var note = \"\"",
  "    var tint: Color = Color(red: 1, green: 0.478, blue: 0.235)",
  "    var height: CGFloat = 320",
  "    @State var hour: Double = 15.5",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    var body: some View {",
  "        GeometryReader { geo in",
  "            let w = geo.size.width, h = geo.size.height",
  "            let lo = (values.min() ?? 0) - 6, hi = (values.max() ?? 1) + 2",
  "            let x = { (i: Double) in w * i / Double(max(values.count - 1, 1)) }",
  "            let y = { (v: Double) in h * 0.35 + (1 - (v - lo) / max(hi - lo, 1)) * h * 0.65 }",
  "            let lineX = w * (hour - startHour) / (endHour - startHour)",
  "            let peak = values.indices.max { values[$0] < values[$1] } ?? 0",
  "            ZStack(alignment: .topLeading) {",
  "                Path { p in",
  "                    p.move(to: CGPoint(x: 0, y: h))",
  "                    p.addLine(to: CGPoint(x: 0, y: y(values.first ?? 0)))",
  "                    for i in values.indices.dropFirst() {",
  "                        let a = CGPoint(x: x(Double(i - 1)), y: y(values[i - 1])), b = CGPoint(x: x(Double(i)), y: y(values[i]))",
  "                        p.addCurve(to: b, control1: CGPoint(x: (a.x + b.x) / 2, y: a.y), control2: CGPoint(x: (a.x + b.x) / 2, y: b.y))",
  "                    }",
  "                    p.addLine(to: CGPoint(x: w, y: h))",
  "                    p.closeSubpath()",
  "                }",
  "                .fill(tint.opacity(0.5))",
  "                .opacity(shown ? 1 : 0)",
  "                .scaleEffect(shown || reduceMotion ? 1 : 0.95, anchor: .bottom)",
  "                Text(\"\\(Int(values[peak].rounded()))\\(unit)\").font(.title2).monospacedDigit()",
  "                    .position(x: min(max(x(Double(peak)), 30), w - 30), y: y(values[peak]) - 30)",
  "                if let last = values.last {",
  "                    Text(\"\\(Int(last.rounded()))\\(unit)\").font(.title2).monospacedDigit()",
  "                        .position(x: w - 24, y: y(last) + 26)",
  "                }",
  "                if !note.isEmpty {",
  "                    Text(note).font(.title3).position(x: w * 0.3, y: h - 24)",
  "                }",
  "                Rectangle().fill(.primary).frame(width: 3, height: h - 60)",
  "                    .position(x: lineX, y: 60 + (h - 60) / 2)",
  "                Circle().fill(.primary).frame(width: 22, height: 22)",
  "                    .position(x: lineX, y: 60)",
  "                HStack(alignment: .firstTextBaseline, spacing: 8) {",
  "                    Text(clock).font(.system(size: 28, weight: .medium)).monospacedDigit()",
  "                    Text(\"\\(Int(value.rounded()))\\(unit)\").font(.title3.weight(.semibold)).monospacedDigit().foregroundStyle(.secondary)",
  "                        .contentTransition(.numericText(value: value))",
  "                }",
  "                .fixedSize()",
  "                .position(x: min(max(lineX + 40, 90), w - 90), y: 16)",
  "            }",
  "            .foregroundStyle(.primary)",
  "            .contentShape(.rect)",
  "            .gesture(",
  "                DragGesture(minimumDistance: 0).onChanged { g in",
  "                    let f = min(max(g.location.x / w, 0), 1)",
  "                    hour = startHour + f * (endHour - startHour)",
  "                }",
  "            )",
  "        }",
  "        .frame(height: height)",
  "        .sensoryFeedback(.selection, trigger: Int(hour))",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "    }",
  "",
  "    /// The curve's value at the scrub line, read between the two nearest points.",
  "    private var value: Double {",
  "        guard let first = values.first else { return 0 }",
  "        let f = min(max((hour - startHour) / max(endHour - startHour, 1), 0), 1) * Double(values.count - 1)",
  "        let i = Int(f)",
  "        let next = values[min(i + 1, values.count - 1)]",
  "        return values.isEmpty ? first : values[i] + (next - values[i]) * (f - Double(i))",
  "    }",
  "",
  "    private var clock: String {",
  "        let h = Int(hour) % 24, m = Int((hour - Double(Int(hour))) * 60)",
  "        return String(format: \"%d:%02d %@\", (h + 11) % 12 + 1, m, h < 12 ? \"am\" : \"pm\")",
  "    }",
  "}",
];

export const areaScrub: SwiftPieceDefinition = {
  id: "area-scrub",
  name: "Area Scrub",
  category: "pieces",
  description: "A day's curve as a soft filled hill with a tall scrub line you drag through the hours. The time and the value under the line ride on top; the peak and the end are labelled.",
  availability: "free",
  preview: { component: "area-scrub", chunk: "app-pieces" },
  icon: "chart.line.uptrend.xyaxis",
  concepts: ["state", "gesture", "frame"],
  anatomy: [
    { part: "Curve", props: ["values", "tint"] },
    { part: "Day", props: ["startHour", "endHour", "hour"] },
    { part: "Labels", props: ["unit", "note"] },
    { part: "Size", props: ["height"] },
  ],
  interactions: ["scrub", "spring", "haptic"],
  variants: [
    { id: "temperature", label: "Temperature", props: {} },
    { id: "tide", label: "Tide", props: { values: "0.4, 0.9, 1.6, 2.1, 2.3, 2.0, 1.4, 0.8, 0.5, 0.7, 1.3, 1.9", unit: "m", note: "High at 10:12", tint: "azure" } },
  ],
  states: [{ id: "morning", label: "Morning", props: { hour: 9 } }],
  properties: [
    data("values", "Values", "11, 11, 12, 13, 15, 17, 19, 20, 21, 21, 20, 19, 17, 15, 14, 13, 12, 12", { hint: "Evenly spaced across the day." }),
    number("startHour", "Day starts", 6, 0, 23),
    number("endHour", "Day ends", 22, 1, 24),
    number("hour", "Scrub at", 15.5, 0, 24, 0.25),
    text("unit", "Unit", "°"),
    text("note", "Note", "0.8 mm rain"),
    tint("tint", "Colour", "ember"),
    number("height", "Height", 320, 200, 480),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("AreaScrub", SWIFT);
      return {
        lines: call("AreaScrub", [
          ["values", swiftNums(numbers(s(p, "values")))],
          n(p, "startHour") !== 6 && ["startHour", num(n(p, "startHour"))],
          n(p, "endHour") !== 22 && ["endHour", num(n(p, "endHour"))],
          s(p, "unit") !== "°" && ["unit", ctx.str(s(p, "unit"))],
          s(p, "note").trim() && ["note", ctx.str(s(p, "note").trim())],
          ["tint", swiftTint(s(p, "tint"), "ember")],
          n(p, "height") !== 320 && ["height", num(n(p, "height"))],
          ["hour", num(n(p, "hour"))],
        ]),
      };
    },
  },
};
