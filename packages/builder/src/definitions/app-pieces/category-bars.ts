// Category Bars: a bar chart where every category keeps its own colour (moods, genres, sources),
// with slanted labels under the bars and a counted axis. Tap or drag across a bar to single it
// out: the others dim and its count shows above it, with a selection tick. The bars grow up from the
// axis when the chart appears (not under reduced motion).
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, text } from "../shared.js";
import { data, items, numbers, swiftHex, swiftNums, swiftStrs, tintHex } from "./data-kit.js";
import { own } from "../../core/own.js";

/** The house blocks by name (the data colours of the SwiftPieces look), on top of the shared tints. */
const HOUSE: Record<string, string> = { sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF", sand: "#E9D5B3" };
/** A bar's colour: a house block, else a shared tint. */
export const barHex = (id: string) => own(HOUSE, id) ?? tintHex(id, "azure");

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

const SWIFT = [
  "private struct CategoryBars: View {",
  "    let values: [Double]",
  "    let labels: [String]",
  "    let colors: [Color]",
  "    var axis = \"\"",
  "    var caption = \"\"",
  "    var height: CGFloat = 300",
  "    @State private var selected: String?",
  "    @State private var grown = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        VStack(spacing: 8) {",
  "            Chart {",
  "                ForEach(values.indices, id: \\.self) { i in",
  "                    BarMark(x: .value(\"Category\", labels[i]), y: .value(\"Count\", grown ? values[i] : 0), width: .ratio(0.45))",
  "                        .foregroundStyle(colors[i % max(colors.count, 1)].opacity(selected == nil || selected == labels[i] ? 1 : 0.3))",
  "                        .annotation(position: .top) {",
  "                            if selected == labels[i] {",
  "                                Text(\"\\(Int(values[i]))\").font(.caption.weight(.bold))",
  "                            }",
  "                        }",
  "                }",
  "            }",
  "            .chartXSelection(value: $selected)",
  "            .chartYScale(domain: 0...max(1, (values.max() ?? 1) * 1.15))",
  "            .chartYAxisLabel(axis, position: .leading)",
  "            .chartXAxis {",
  "                AxisMarks { _ in",
  "                    AxisValueLabel(orientation: .verticalReversed)",
  "                }",
  "            }",
  "            .frame(height: height)",
  "            if !caption.isEmpty {",
  "                Text(caption).font(.caption).foregroundStyle(.secondary)",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .onAppear { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { grown = true } }",
  "    }",
  "}",
];

export const categoryBars: SwiftPieceDefinition = {
  id: "category-bars",
  name: "Category Bars",
  category: "pieces",
  description: "A bar chart where each category keeps its own colour, with slanted labels. Tap or drag across a bar to single it out and read its count.",
  availability: "free",
  preview: { component: "category-bars", chunk: "app-pieces" },
  icon: "chart.bar",
  concepts: ["state", "framework"],
  anatomy: [
    { part: "Bars", props: ["values", "labels", "colors"] },
    { part: "Axis", props: ["axis", "caption"] },
    { part: "Size", props: ["height"] },
  ],
  interactions: ["tap", "scrub", "haptic"],
  variants: [
    { id: "moods", label: "Moods", props: {} },
    { id: "genres", label: "Genres", props: { values: "9, 6, 4, 3, 2", labels: "fiction, memoir, history, poetry, essays", colors: "azure, blush, ember, sky, gray", caption: "Genre" } },
  ],
  states: [{ id: "short", label: "Short", props: { height: 200 } }],
  properties: [
    data("values", "Values", "9, 7, 6, 4, 3, 3, 2, 1"),
    data("labels", "Labels", "hopeful, curious, tense, calm, funny, wistful, playful, bleak"),
    data("colors", "Colours", "signal, ember, blush, azure, sky, lavender, white, gray", { hint: "One tint per bar, from the piece palette or the house blocks (sky, butter, sage, lilac, sand)." }),
    text("axis", "Axis title", "No. of books"),
    text("caption", "Caption", "Mood"),
    number("height", "Height", 300, 160, 420),
  ],
  swift: {
    imports: ["Charts"],
    emit(p, ctx) {
      ctx.import("Charts");
      ctx.declare("CategoryBars", SWIFT);
      const values = numbers(s(p, "values"));
      const labels = items(s(p, "labels"));
      const colors = items(s(p, "colors"));
      return {
        lines: call("CategoryBars", [
          ["values", swiftNums(values)],
          ["labels", swiftStrs(values.map((_, i) => labels[i] ?? `#${i + 1}`), ctx.str)],
          ["colors", `[${(colors.length ? colors : ["azure"]).map((c) => swiftHex(barHex(c))).join(", ")}]`],
          s(p, "axis").trim() && ["axis", ctx.str(s(p, "axis").trim())],
          s(p, "caption").trim() && ["caption", ctx.str(s(p, "caption").trim())],
          n(p, "height") !== 300 && ["height", num(n(p, "height"))],
        ]),
      };
    },
  },
};
