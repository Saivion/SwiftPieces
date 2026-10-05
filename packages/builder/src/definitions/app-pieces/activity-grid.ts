// Activity Grid: days as cells shaded by how fully they were kept, either a calendar (weekday
// columns, a row per week) or a heatmap (a column per week). Rest days show a small mark, today a
// dot. Cells ease in week by week (0.95 + fade, 40 ms apart); tap a day to change it (its shade
// eases over in 0.15 s with a selection tick).
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, num } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { construct, rgb } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const I = (d: number) => INDENT.repeat(d);

export const GRID_TINTS: Record<string, string> = {
  // The SwiftPieces sweep and house blocks.
  signal: "#FF0000", ember: "#FF7A3C", blush: "#FF8FB8", azure: "#4D8DFF", sage: "#A9DCB7", lilac: "#CDB8FF",
  blue: "#2F6FEB", green: "#3FA45B", orange: "#F28A30", purple: "#8C5CF2", teal: "#2FA7A0",
};
export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Day levels: 0 none, 1 partial, 2 most, 3 full, -1 rest. The pattern repeats to fill the grid. */
export function gridLevels(p: Props): number[] {
  const chars = s(p, "pattern").replace(/[^0-3s]/g, "").split("");
  const total = Math.max(1, Math.round(n(p, "weeks"))) * 7;
  const src = chars.length ? chars : ["0"];
  return Array.from({ length: total }, (_, i) => {
    const c = src[i % src.length];
    return c === "s" ? -1 : Number(c);
  });
}

export const nextLevel = (l: number) => (l < 0 ? 0 : l === 0 ? 1 : l === 3 ? 0 : 3);

const STRUCT = (): string[] => [
  "/// Days shaded by how fully they were kept: a calendar or a heatmap. Tap a day to change it.",
  "private struct ActivityGrid: View {",
  `${I(1)}enum Layout { case calendar, heatmap }`,
  `${I(1)}/// 0 none, 1 partial, 2 most, 3 full, -1 a rest day.`,
  `${I(1)}@State var levels: [Int]`,
  `${I(1)}var layout: Layout = .calendar`,
  `${I(1)}var weeks = 4`,
  `${I(1)}var tint: Color = .blue`,
  `${I(1)}var today = -1`,
  `${I(1)}@State private var taps = 0`,
  `${I(1)}@State private var appeared = false`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  `${I(1)}private let weekdays = ["M", "T", "W", "T", "F", "S", "S"]`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}Group {`,
  `${I(3)}switch layout {`,
  `${I(3)}case .calendar:`,
  `${I(4)}VStack(spacing: 2) {`,
  `${I(5)}HStack(spacing: 2) {`,
  `${I(6)}ForEach(weekdays.indices, id: \\.self) { day in`,
  `${I(7)}Text(weekdays[day]).font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity)`,
  `${I(6)}}`,
  `${I(5)}}`,
  `${I(5)}.padding(.bottom, 4)`,
  `${I(5)}ForEach(0..<weeks, id: \\.self) { week in`,
  `${I(6)}HStack(spacing: 2) {`,
  `${I(7)}ForEach(0..<7, id: \\.self) { day in cell(week * 7 + day).frame(height: 30) }`,
  `${I(6)}}`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(3)}case .heatmap:`,
  `${I(4)}HStack(spacing: 3) {`,
  `${I(5)}ForEach(0..<weeks, id: \\.self) { week in`,
  `${I(6)}VStack(spacing: 3) {`,
  `${I(7)}ForEach(0..<7, id: \\.self) { day in cell(week * 7 + day).aspectRatio(1, contentMode: .fit) }`,
  `${I(6)}}`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.sensoryFeedback(.selection, trigger: taps)`,
  `${I(2)}.onAppear { appeared = true }`,
  `${I(1)}}`,
  "",
  `${I(1)}private func cell(_ index: Int) -> some View {`,
  `${I(2)}let level = index < levels.count ? levels[index] : 0`,
  `${I(2)}return Rectangle()`,
  `${I(3)}.fill(fill(level))`,
  `${I(3)}.overlay {`,
  `${I(4)}if level < 0 {`,
  `${I(5)}Image(systemName: "sun.max").font(.caption2).foregroundStyle(.secondary)`,
  `${I(4)}} else if index == today {`,
  `${I(5)}Circle().fill(level >= 2 ? Color.white : Color.primary).frame(width: 5, height: 5)`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(3)}.clipShape(.rect(cornerRadius: layout == .heatmap ? 2 : 0))`,
  `${I(3)}.opacity(appeared ? 1 : 0)`,
  `${I(3)}.scaleEffect(appeared || reduceMotion ? 1 : 0.95)`,
  `${I(3)}.animation(.easeOut(duration: reduceMotion ? 0.2 : 0.3).delay(reduceMotion ? 0 : Double(min(index / 7, 7)) * 0.04), value: appeared)`,
  `${I(3)}.contentShape(.rect)`,
  `${I(3)}.onTapGesture {`,
  `${I(4)}guard index < levels.count else { return }`,
  `${I(4)}let current = levels[index]`,
  `${I(4)}withAnimation(.easeOut(duration: 0.15)) { levels[index] = current < 0 || current == 3 ? 0 : (current == 0 ? 1 : 3) }`,
  `${I(4)}taps += 1`,
  `${I(3)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private func fill(_ level: Int) -> Color {`,
  `${I(2)}switch level {`,
  `${I(2)}case 1: tint.opacity(0.25)`,
  `${I(2)}case 2: tint.opacity(0.55)`,
  `${I(2)}case 3: tint`,
  `${I(2)}default: Color.secondary.opacity(0.1)`,
  `${I(2)}}`,
  `${I(1)}}`,
  "}",
];

const tintOpts = opts(...Object.keys(GRID_TINTS).map((k): [string, string] => [k, k[0].toUpperCase() + k.slice(1)]));

export const activityGrid: SwiftPieceDefinition = {
  id: "activity-grid",
  name: "Activity Grid",
  category: "pieces",
  description: "Days as cells shaded by how fully they were kept, as a calendar with weekday columns or a heatmap with a column per week. Rest days carry a small mark and today a dot. Tap a day to change it.",
  availability: "free",
  preview: { component: "activity-grid", chunk: "app-pieces" },
  icon: "square.grid.2x2",
  concepts: ["foreach", "state"],
  interactions: ["tap", "haptic"],
  anatomy: [
    { part: "Days", props: ["pattern", "today"] },
    { part: "Layout", props: ["layout", "weeks"] },
    { part: "Color", props: ["tint"] },
  ],
  properties: [
    text("pattern", "Days", "3301330 1133031 3313330 0331133", { maxLength: 400, hint: "One character a day from Monday: 0 none, 1 partial, 2 most, 3 full, s rest. Repeats to fill." }),
    select("layout", "Layout", "calendar", opts(["calendar", "Calendar"], ["heatmap", "Heatmap"])),
    number("weeks", "Weeks", 4, 1, 26, 1, { group: "layout" }),
    select("tint", "Tint", "signal", tintOpts),
    number("today", "Today", -1, -1, 181, 1, { hint: "Which day gets the dot, from 0. -1 for none." }),
  ],
  variants: [
    { id: "month", label: "Month", props: { layout: "calendar", weeks: 4, pattern: "33s1330 1133s31 3313s30 0331s33", today: 25 } },
    { id: "heatmap", label: "Heatmap", props: { layout: "heatmap", weeks: 20, tint: "ember", pattern: "3313303 3031033 1330310 3303133 0331303", today: -1 } },
    { id: "empty", label: "Fresh start", props: { pattern: "0", today: 0 } },
  ],
  states: [{ id: "full", label: "Every day", props: { pattern: "3" } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("ActivityGrid", STRUCT());
      const levels = gridLevels(p);
      const rows: string[] = [];
      for (let i = 0; i < levels.length; i += 7) rows.push(`${INDENT}${levels.slice(i, i + 7).join(", ")},`);
      const heat = s(p, "layout") === "heatmap";
      return {
        lines: construct("ActivityGrid", [
          ["levels: [", ...rows, "]"],
          heat && "layout: .heatmap",
          n(p, "weeks") !== 4 && `weeks: ${num(n(p, "weeks"))}`,
          `tint: ${rgb(GRID_TINTS[s(p, "tint")] ?? GRID_TINTS.signal)}`,
          n(p, "today") >= 0 && `today: ${num(n(p, "today"))}`,
        ]),
      };
    },
  },
};
