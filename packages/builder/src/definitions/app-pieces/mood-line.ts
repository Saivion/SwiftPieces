// Mood Line: a month of moods as a line, the way a mood diary charts the days. Five faces stand up
// the leading edge, lowest at the foot, each on its mood's colour; every logged day is a dot in its
// mood's colour and each stretch between two days takes the colours of both ends. Days with nothing
// logged leave a gap. It draws in from the leading edge as it appears (a fade under Reduce Motion);
// drag across it to read a day: a rule follows the finger, the day's dot grows and a selection tick
// plays on every new day.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, text } from "../shared.js";
import { data, swiftHex, swiftStrs } from "./data-kit.js";
import { MOOD_COLORS, MOOD_FACE_GLYPH, moodLabels, swiftMoodStrokes } from "./mood-faces.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

export const MOOD_LINE_DAYS = "3, 2, 3, 4, 3, 3, 2, 3, 4, 4, 3, 1, 2, , 3, 4, 4, 3, 2, 3, 4, 3, 4, 0, 2, 3, , 4, 3, 4, 4";

/** The days' moods, 0 (lowest) to 4; null for a day with nothing logged. At most 31. */
export function moodDays(value: unknown): Array<number | null> {
  const raw = String(value ?? "").split(",").slice(0, 31);
  const out = raw.map((v) => {
    const t = v.trim();
    if (!t) return null;
    const x = Number(t);
    return Number.isFinite(x) ? Math.max(0, Math.min(4, Math.round(x))) : null;
  });
  return out.length > 1 ? out : [2, 2];
}

/** The plot's layout, shared by the preview and the Swift: a gutter for the faces, a footer for the days. */
export const MOOD_LINE_GUTTER = 32;
export const MOOD_LINE_FOOTER = 22;
export const MOOD_LINE_TOP = 10;

const SWIFT = [
  "/// A month of moods as a line: faces up the leading edge, a dot per logged day in its mood's colour,",
  "/// each stretch blending the colours of its two days. Drag across to read a day.",
  "private struct MoodLine: View {",
  "    let values: [Int?]",
  "    let colors: [Color]",
  "    let labels: [String]",
  "    /// The line's and dots' colours, a shade deeper on a light ground; empty uses `colors`.",
  "    var strokes: [Color] = []",
  "    var month = \"\"",
  "    var every = 5",
  "    var height: CGFloat = 200",
  "    @State private var selected: Int?",
  "    @State private var shown = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  `    private let gutter: CGFloat = ${MOOD_LINE_GUTTER}`,
  `    private let footer: CGFloat = ${MOOD_LINE_FOOTER}`,
  `    private let top: CGFloat = ${MOOD_LINE_TOP}`,
  "",
  "    private func plot(_ size: CGSize) -> CGRect {",
  "        CGRect(x: gutter, y: top, width: max(1, size.width - gutter - 6), height: max(1, size.height - footer - top))",
  "    }",
  "",
  "    private func point(_ day: Int, _ level: Int, in rect: CGRect) -> CGPoint {",
  "        let step = values.count > 1 ? rect.width / CGFloat(values.count - 1) : 0",
  "        return CGPoint(x: rect.minX + CGFloat(day) * step, y: rect.minY + rect.height * CGFloat(4 - level) / 4)",
  "    }",
  "",
  "    var body: some View {",
  "        GeometryReader { proxy in",
  "            let rect = plot(proxy.size)",
  "            ZStack(alignment: .topLeading) {",
  "                ForEach(0..<5, id: \\.self) { level in",
  "                    let y = rect.minY + rect.height * CGFloat(4 - level) / 4",
  "                    Rectangle().fill(.quaternary).frame(width: rect.width, height: 1).position(x: rect.midX, y: y)",
  "                    MoodFaceGlyph(level: level)",
  "                        .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))",
  "                        .frame(width: 22, height: 22)",
  "                        .background(colors[level], in: .circle)",
  "                        .position(x: 11, y: y)",
  "                }",
  "                Canvas { context, _ in",
  "                    guard values.count > 1 else { return }",
  "                    let ink = strokes.count == colors.count ? strokes : colors",
  "                    for day in 1..<values.count {",
  "                        guard let a = values[day - 1], let b = values[day] else { continue }",
  "                        let from = point(day - 1, a, in: rect), to = point(day, b, in: rect)",
  "                        var stretch = Path()",
  "                        stretch.move(to: from)",
  "                        stretch.addLine(to: to)",
  "                        context.stroke(stretch, with: .linearGradient(Gradient(colors: [ink[a], ink[b]]), startPoint: from, endPoint: to), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))",
  "                    }",
  "                    for day in values.indices {",
  "                        guard let level = values[day] else { continue }",
  "                        let p = point(day, level, in: rect)",
  "                        let r: CGFloat = selected == day ? 6 : 3.5",
  "                        context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)), with: .color(ink[level]))",
  "                    }",
  "                }",
  "                .mask(alignment: .leading) {",
  "                    Rectangle().frame(width: shown || reduceMotion ? proxy.size.width : 0)",
  "                }",
  "                .opacity(shown ? 1 : 0)",
  "                ForEach(values.indices, id: \\.self) { day in",
  "                    if day == 0 || (day + 1) % every == 0 {",
  "                        Text(\"\\(day + 1)\")",
  "                            .font(.caption2)",
  "                            .monospacedDigit()",
  "                            .foregroundStyle(.secondary)",
  "                            .position(x: point(day, 0, in: rect).x, y: proxy.size.height - footer / 2 + 2)",
  "                    }",
  "                }",
  "                if let day = selected, let level = values[day] {",
  "                    let p = point(day, level, in: rect)",
  "                    Rectangle().fill(.secondary).frame(width: 1, height: rect.height).position(x: p.x, y: rect.midY)",
  "                    Text(month.isEmpty ? \"\\(day + 1) · \\(labels[level])\" : \"\\(month) \\(day + 1) · \\(labels[level])\")",
  "                        .font(.caption.weight(.semibold))",
  "                        .padding(.horizontal, 10)",
  "                        .padding(.vertical, 5)",
  "                        .background(.thinMaterial, in: .capsule)",
  "                        .fixedSize()",
  "                        .position(x: min(max(p.x, rect.minX + 50), rect.maxX - 50), y: max(rect.minY + 12, p.y - 24))",
  "                }",
  "            }",
  "            .contentShape(.rect)",
  "            .gesture(",
  "                DragGesture(minimumDistance: 0)",
  "                    .onChanged { drag in",
  "                        let step = values.count > 1 ? rect.width / CGFloat(values.count - 1) : 1",
  "                        let day = min(max(Int(((drag.location.x - rect.minX) / step).rounded()), 0), values.count - 1)",
  "                        if values[day] != nil, selected != day { selected = day }",
  "                    }",
  "            )",
  "        }",
  "        .frame(height: height)",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .onAppear { withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .easeOut(duration: 0.6)) { shown = true } }",
  "        .accessibilityElement(children: .ignore)",
  "        .accessibilityLabel(\"Mood by day\")",
  "    }",
  "}",
];

export const moodLine: SwiftPieceDefinition = {
  id: "mood-line",
  name: "Mood Line",
  category: "pieces",
  description: "A month of moods as a line: faces up the leading edge, a dot per logged day in its mood's colour and gaps for days left empty. It draws in from the left; drag across it to read any day.",
  availability: "free",
  preview: { component: "mood-line", chunk: "app-pieces" },
  icon: "chart.line.uptrend.xyaxis",
  concepts: ["zstack", "gesture", "state", "animation"],
  anatomy: [
    { part: "Days", props: ["values", "month"] },
    { part: "Moods", props: ["labels"] },
    { part: "Axis", props: ["every", "height"] },
  ],
  interactions: ["scrub", "drag", "haptic"],
  variants: [
    { id: "month", label: "A month", props: {} },
    { id: "fortnight", label: "Two weeks", props: { values: "3, 2, 3, 4, 3, 3, 2, 3, 4, 4, 3, 1, 2, 3", every: 2 } },
  ],
  properties: [
    data("values", "Days", MOOD_LINE_DAYS, { hint: "A mood per day, 0 (lowest) to 4 (highest), separated by commas. Leave a day empty when nothing was logged." }),
    text("labels", "Moods, lowest first", "Low, Heavy, Steady, Good, Bright", { hint: "Five words, from the lowest mood to the highest." }),
    text("month", "Month", "Oct", { maxLength: 12, hint: "Read with the day while you scrub: Oct 14." }),
    number("every", "Day labels every", 5, 1, 10, 1),
    number("height", "Height", 200, 140, 320),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("MoodFaceGlyph", MOOD_FACE_GLYPH);
      ctx.declare("MoodLine", SWIFT);
      const days = moodDays(p.values);
      return {
        lines: call("MoodLine", [
          ["values", `[${days.map((d) => (d === null ? "nil" : String(d))).join(", ")}]`],
          ["colors", `[${MOOD_COLORS.map((c) => swiftHex(c)).join(", ")}]`],
          ["labels", swiftStrs(moodLabels(p.labels), ctx.str)],
          ["strokes", swiftMoodStrokes((h) => swiftHex(h))],
          s(p, "month").trim() && ["month", ctx.str(s(p, "month").trim())],
          n(p, "every") !== 5 && ["every", num(Math.max(1, Math.round(n(p, "every"))))],
          n(p, "height") !== 200 && ["height", num(n(p, "height"))],
        ]),
      };
    },
  },
};
