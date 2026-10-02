// Stage Timeline: a night drawn as blocks on stage rows (awake, REM, core, deep) joined by thin
// risers, over dotted hour lines, the way sleep apps chart a night. The night plays in from left to
// right as it appears. Drag across it to read the stage and the clock time under your finger, with
// a selection tick at each change of stage.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";
import { data, swiftHex, swiftNums } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

export const STAGES = ["awake", "rem", "core", "deep"] as const;
export const STAGE_NAMES: Record<string, string> = { awake: "Awake", rem: "REM", core: "Core", deep: "Deep" };
/** Stage colours per palette. `sweep` is the Swift Pieces sweep (the default); `night` the classic blues. */
export const STAGE_PALETTES: Record<string, { label: string; colors: Record<string, string> }> = {
  sweep: { label: "Signal sweep", colors: { awake: "#FF7A3C", rem: "#FF8FB8", core: "#4D8DFF", deep: "#CDB8FF" } },
  night: { label: "Night", colors: { awake: "#F2764B", rem: "#7CCBFB", core: "#3F86F0", deep: "#3B3FB8" } },
};
export const stageColors = (palette: string) => (STAGE_PALETTES[palette] ?? STAGE_PALETTES.sweep).colors;
/** The default palette's colours. */
export const STAGE_COLORS: Record<string, string> = STAGE_PALETTES.sweep.colors;

/** "core 22, deep 18, …" → stage row (0 top) and minutes. */
export function parseStages(value: unknown): Array<{ stage: string; minutes: number }> {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([stage = "", m = "0"]) => ({ stage: stage.toLowerCase(), minutes: Number(m) }))
    .filter((x) => (STAGES as readonly string[]).includes(x.stage) && x.minutes > 0)
    .slice(0, 80);
}

/** "23:10" plus minutes → "23:58". */
export function clock(start: string, minutes: number): string {
  const [h = 0, m = 0] = start.split(":").map(Number);
  const t = (((h * 60 + m + Math.round(minutes)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The default night: about seven and a half hours, deep early and REM late. */
const SEGMENTS = "core 14, awake 3, core 12, deep 26, core 18, rem 16, core 30, deep 20, core 24, rem 22, awake 2, core 36, deep 10, core 26, rem 34, core 28, awake 1, rem 26, core 32, rem 18, awake 4";

const SWIFT = [
  "private struct StageTimeline: View {",
  "    let stages: [Int]",
  "    let minutes: [Double]",
  "    var start = \"23:10\"",
  "    var names = [\"Awake\", \"REM\", \"Core\", \"Deep\"]",
  "    var colors: [Color] = [.orange, .cyan, .blue, .indigo]",
  "    var height: CGFloat = 200",
  "    var legend = true",
  "    @State private var selected: Int?",
  "    @State private var played = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private var total: Double { max(minutes.reduce(0, +), 1) }",
  "",
  "    var body: some View {",
  "        VStack(alignment: .leading, spacing: 10) {",
  "            Text(readout)",
  "                .font(.footnote.weight(.semibold))",
  "                .foregroundStyle(.secondary)",
  "            GeometryReader { geo in",
  "                let w = geo.size.width",
  "                let row = geo.size.height / 4",
  "                ZStack(alignment: .topLeading) {",
  "                    ForEach(0..<Int(total / 60) + 1, id: \\.self) { hour in",
  "                        Path { p in",
  "                            let x = w * Double(hour * 60) / total",
  "                            p.move(to: CGPoint(x: x, y: 0))",
  "                            p.addLine(to: CGPoint(x: x, y: geo.size.height))",
  "                        }",
  "                        .stroke(.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))",
  "                    }",
  "                    ForEach(stages.indices, id: \\.self) { i in",
  "                        let x0 = w * offset(i) / total",
  "                        let width = max(w * minutes[i] / total, 2)",
  "                        let thin = stages[i] == 0",
  "                        let c = colors[stages[i]]",
  "                        RoundedRectangle(cornerRadius: thin ? 1 : 5)",
  "                            .fill(thin ? AnyShapeStyle(LinearGradient(colors: [c, c.opacity(0)], startPoint: .top, endPoint: .bottom)) : AnyShapeStyle(c))",
  "                            .frame(width: thin ? max(width, 2.5) : width, height: thin ? row * 1.6 : row * 0.62)",
  "                            .offset(x: x0, y: thin ? row * 0.05 : row * Double(stages[i]) + row * 0.19)",
  "                            .opacity(selected == nil || selected == i ? 1 : 0.35)",
  "                            .animation(.easeOut(duration: 0.15), value: selected)",
  "                        if i > 0 {",
  "                            let a = min(stages[i], stages[i - 1]), b = max(stages[i], stages[i - 1])",
  "                            Rectangle()",
  "                                .fill(.secondary.opacity(0.5))",
  "                                .frame(width: 1, height: row * Double(b - a))",
  "                                .offset(x: x0, y: row * Double(a) + row * 0.5)",
  "                        }",
  "                    }",
  "                }",
  "                .contentShape(.rect)",
  "                .gesture(",
  "                    DragGesture(minimumDistance: 0)",
  "                        .onChanged { g in selected = index(at: g.location.x / w * total) }",
  "                        .onEnded { _ in withAnimation(.easeOut.delay(0.8)) { selected = nil } }",
  "                )",
  "            }",
  "            .frame(height: height)",
  "            .mask(alignment: .leading) {",
  "                GeometryReader { geo in",
  "                    Rectangle().frame(width: played || reduceMotion ? geo.size.width : 0)",
  "                }",
  "            }",
  "            .opacity(played ? 1 : 0)",
  "            .onAppear {",
  "                if reduceMotion { withAnimation(.easeOut(duration: 0.2)) { played = true } } else { withAnimation(.easeOut(duration: 0.3)) { played = true } }",
  "            }",
  "            if legend {",
  "                HStack(spacing: 12) {",
  "                    ForEach(names.indices, id: \\.self) { i in",
  "                        HStack(spacing: 4) {",
  "                            Circle().fill(colors[i]).frame(width: 8, height: 8)",
  "                            Text(names[i]).foregroundStyle(.secondary)",
  "                        }",
  "                    }",
  "                }",
  "                .font(.caption)",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "    }",
  "",
  "    private func offset(_ i: Int) -> Double { minutes.prefix(i).reduce(0, +) }",
  "",
  "    private func index(at minute: Double) -> Int? {",
  "        var t = 0.0",
  "        for i in minutes.indices {",
  "            t += minutes[i]",
  "            if minute < t { return i }",
  "        }",
  "        return minutes.indices.last",
  "    }",
  "",
  "    private var readout: String {",
  "        guard let i = selected else { return \"Drag across the night\" }",
  "        return \"\\(names[stages[i]]) · \\(time(offset(i)))–\\(time(offset(i) + minutes[i]))\"",
  "    }",
  "",
  "    private func time(_ minutes: Double) -> String {",
  "        let parts = start.split(separator: \":\").compactMap { Int($0) }",
  "        let base = (parts.first ?? 0) * 60 + (parts.count > 1 ? parts[1] : 0)",
  "        let t = (base + Int(minutes)) % 1440",
  "        return String(format: \"%02d:%02d\", t / 60, t % 60)",
  "    }",
  "}",
];

export const stageTimeline: SwiftPieceDefinition = {
  id: "stage-timeline",
  name: "Stage Timeline",
  category: "pieces",
  description: "A night as blocks on awake, REM, core and deep rows, joined by risers over hour lines. Drag across to read the stage and time.",
  availability: "free",
  preview: { component: "stage-timeline", chunk: "app-pieces" },
  icon: "bed.double",
  concepts: ["state", "gesture", "frame"],
  anatomy: [
    { part: "Night", props: ["segments", "start"] },
    { part: "Legend", props: ["legend", "palette"] },
    { part: "Size", props: ["height"] },
  ],
  interactions: ["scrub", "haptic"],
  variants: [
    { id: "night", label: "Full night", props: {} },
    { id: "nap", label: "Nap", props: { segments: "awake 3, core 18, deep 12, core 10, rem 6, awake 2", start: "14:10" } },
    { id: "classic", label: "Night blues", props: { palette: "night" } },
  ],
  states: [{ id: "nolegend", label: "No legend", props: { legend: false } }],
  properties: [
    data("segments", "Segments", SEGMENTS, { hint: "Stage and minutes, in order: awake, rem, core or deep." }),
    text("start", "Fell asleep", "23:10"),
    select("palette", "Colours", "sweep", opts(...Object.entries(STAGE_PALETTES).map(([k, v]): [string, string] => [k, v.label]))),
    bool("legend", "Legend", true),
    number("height", "Height", 200, 120, 320),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("StageTimeline", SWIFT);
      const segs = parseStages(s(p, "segments"));
      return {
        lines: call("StageTimeline", [
          ["stages", `[${segs.map((x) => STAGES.indexOf(x.stage as (typeof STAGES)[number])).join(", ")}]`],
          ["minutes", swiftNums(segs.map((x) => x.minutes))],
          s(p, "start") !== "23:10" && ["start", ctx.str(s(p, "start"))],
          ["colors", `[${STAGES.map((st) => swiftHex(stageColors(s(p, "palette"))[st])).join(", ")}]`],
          n(p, "height") !== 200 && ["height", num(n(p, "height"))],
          p.legend === false && ["legend", "false"],
        ]),
      };
    },
  },
};
