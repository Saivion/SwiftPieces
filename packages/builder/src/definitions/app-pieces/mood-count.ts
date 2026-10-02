// Mood Count: how many days each mood got this month, as a half ring of blocks in the moods' colours,
// lowest on the left, with the total in its middle and the five faces under it, each wearing its
// count. The ring sweeps in from the left as it appears (a fade under Reduce Motion). Tap a face to
// single its mood out: the other blocks dim and the middle reads that mood's days, with a selection
// tick; tap it again to see them all.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, text } from "../shared.js";
import { data, numbers, swiftHex, swiftStrs } from "./data-kit.js";
import { MOOD_COLORS, MOOD_FACE_GLYPH, moodLabels, swiftMoodStrokes } from "./mood-faces.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** Five counts, lowest mood first: whole, never negative, zeros where none are given. */
export function moodCounts(value: unknown): number[] {
  const given = numbers(value, 5).map((v) => Math.max(0, Math.round(v)));
  return [0, 1, 2, 3, 4].map((i) => given[i] ?? 0);
}

/** Each mood's span along the half ring, 0 (left) to 1 (right), with a small gap between blocks. */
export function moodSpans(counts: number[], gap = 0.012): Array<{ start: number; end: number }> {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const shown = counts.filter((c) => c > 0).length;
  const free = 1 - gap * Math.max(0, shown - 1);
  let at = 0;
  return counts.map((c) => {
    if (c <= 0) return { start: at, end: at };
    const span = { start: at, end: at + (c / total) * free };
    at = span.end + gap;
    return span;
  });
}

const SWIFT = [
  "/// One mood's block on the half ring: from `start` to `end` along it (0 is the left end), drawn up to `progress`.",
  "private struct MoodCountArc: Shape {",
  "    var start: Double",
  "    var end: Double",
  "    var progress: Double",
  "",
  "    var animatableData: Double {",
  "        get { progress }",
  "        set { progress = newValue }",
  "    }",
  "",
  "    func path(in rect: CGRect) -> Path {",
  "        var path = Path()",
  "        let upTo = min(end, progress)",
  "        guard upTo > start else { return path }",
  "        let radius = min(rect.width / 2, rect.height) - 14",
  "        let center = CGPoint(x: rect.midX, y: rect.maxY)",
  "        let steps = max(2, Int((upTo - start) * 60))",
  "        for k in 0...steps {",
  "            let t = start + (upTo - start) * Double(k) / Double(steps)",
  "            let angle = Double.pi * (1 - t)",
  "            let point = CGPoint(x: center.x + radius * cos(angle), y: center.y - radius * sin(angle))",
  "            if k == 0 { path.move(to: point) } else { path.addLine(to: point) }",
  "        }",
  "        return path",
  "    }",
  "}",
  "",
  "/// Days per mood this month: a half ring of blocks with the total in the middle and a face per mood",
  "/// wearing its count. Tap a face to single its mood out.",
  "private struct MoodCount: View {",
  "    let counts: [Int]",
  "    let spans: [(start: Double, end: Double)]",
  "    let colors: [Color]",
  "    let labels: [String]",
  "    /// The ring's colours, a shade deeper on a light ground; empty uses `colors`.",
  "    var strokes: [Color] = []",
  "    var unit = \"days\"",
  "    var size: CGFloat = 240",
  "    @State private var selected: Int?",
  "    @State private var progress = 0.0",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private var total: Int { counts.reduce(0, +) }",
  "",
  "    var body: some View {",
  "        VStack(spacing: 20) {",
  "            ZStack(alignment: .bottom) {",
  "                ForEach(counts.indices, id: \\.self) { i in",
  "                    MoodCountArc(start: spans[i].start, end: spans[i].end, progress: progress)",
  "                        .stroke(strokes.count == colors.count ? strokes[i] : colors[i], style: StrokeStyle(lineWidth: 28, lineCap: .butt))",
  "                        .opacity(selected == nil || selected == i ? 1 : 0.25)",
  "                }",
  "                VStack(spacing: 0) {",
  "                    Text(\"\\(selected.map { counts[$0] } ?? total)\")",
  "                        .font(.system(size: 44, weight: .light))",
  "                        .monospacedDigit()",
  "                        .contentTransition(.numericText())",
  "                    Text(selected.map { labels[$0] } ?? unit)",
  "                        .font(.subheadline)",
  "                        .foregroundStyle(.secondary)",
  "                }",
  "            }",
  "            .frame(width: size, height: size / 2 + 14)",
  "            HStack(spacing: 0) {",
  "                ForEach(counts.indices, id: \\.self) { i in",
  "                    Button {",
  "                        withAnimation(.snappy(duration: 0.25)) { selected = selected == i ? nil : i }",
  "                    } label: {",
  "                        MoodFaceGlyph(level: i)",
  "                            .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))",
  "                            .frame(width: 44, height: 44)",
  "                            .background(colors[i], in: .circle)",
  "                            .overlay(alignment: .topTrailing) {",
  "                                Text(\"\\(counts[i])\")",
  "                                    .font(.caption2.weight(.bold))",
  "                                    .monospacedDigit()",
  "                                    .foregroundStyle(.primary)",
  "                                    .frame(minWidth: 20, minHeight: 20)",
  "                                    .background(.background, in: .circle)",
  "                                    .overlay { Circle().strokeBorder(colors[i], lineWidth: 2) }",
  "                                    .offset(x: 6, y: -6)",
  "                            }",
  "                            .scaleEffect(selected == i ? 1.1 : 1)",
  "                            .opacity(selected == nil || selected == i ? 1 : 0.45)",
  "                    }",
  "                    .buttonStyle(.plain)",
  "                    .frame(maxWidth: .infinity)",
  "                    .accessibilityLabel(\"\\(labels[i]): \\(counts[i])\")",
  "                }",
  "            }",
  "        }",
  "        .frame(maxWidth: .infinity)",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .onAppear { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.6)) { progress = 1 } }",
  "    }",
  "}",
];

export const moodCount: SwiftPieceDefinition = {
  id: "mood-count",
  name: "Mood Count",
  category: "pieces",
  description: "Days per mood as a half ring of coloured blocks with the total in its middle and a face per mood wearing its count. Tap a face to single that mood out.",
  availability: "free",
  preview: { component: "mood-count", chunk: "app-pieces" },
  icon: "chart.pie",
  concepts: ["zstack", "animation", "state", "foreach"],
  anatomy: [
    { part: "Ring", props: ["counts", "size"] },
    { part: "Moods", props: ["labels", "unit"] },
  ],
  interactions: ["tap", "select", "haptic"],
  variants: [
    { id: "month", label: "A month", props: {} },
    { id: "rough", label: "A rough month", props: { counts: "6, 9, 7, 3, 1" } },
  ],
  properties: [
    data("counts", "Days per mood, lowest first", "1, 2, 6, 8, 5", { hint: "Five numbers, from the lowest mood to the highest." }),
    text("labels", "Moods, lowest first", "Low, Heavy, Steady, Good, Bright", { hint: "Five words, from the lowest mood to the highest." }),
    text("unit", "Unit", "days", { maxLength: 16, hint: "Under the total, when no mood is picked." }),
    number("size", "Ring width", 240, 160, 320),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("MoodFaceGlyph", MOOD_FACE_GLYPH);
      ctx.declare("MoodCount", SWIFT);
      const counts = moodCounts(p.counts);
      const spans = moodSpans(counts);
      return {
        lines: call("MoodCount", [
          ["counts", `[${counts.join(", ")}]`],
          ["spans", `[${spans.map((x) => `(${num(Math.round(x.start * 10000) / 10000)}, ${num(Math.round(x.end * 10000) / 10000)})`).join(", ")}]`],
          ["colors", `[${MOOD_COLORS.map((c) => swiftHex(c)).join(", ")}]`],
          ["labels", swiftStrs(moodLabels(p.labels), ctx.str)],
          ["strokes", swiftMoodStrokes((h) => swiftHex(h))],
          s(p, "unit") !== "days" && ["unit", ctx.str(s(p, "unit"))],
          n(p, "size") !== 240 && ["size", num(n(p, "size"))],
        ]),
      };
    },
  },
};
