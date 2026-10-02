// Streak Calendar: a month where each run of days you kept a habit is one coloured capsule, with
// the current streak as a ring above it. Ring and capsules ease in (0.95 + fade, rows 40 ms apart). Days you half-did show a dot, days you missed a grey
// dot, days ahead stay grey. Tap a day to read it underneath. The SwiftUI is written inline, with
// the month worked out here (weeks, cells and capsules) so the Swift only has to draw it.
import { swiftRGB } from "../../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, list, num, str } from "../../core/swift.js";
import { bool, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

export const STREAK_COLORS: Record<string, string> = {
  // The Swift Pieces sweep and house blocks (the defaults).
  signal: "#FF0000", ember: "#FF7A3C", blush: "#FF8FB8", azure: "#4D8DFF", sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF",
  // Older names, kept so saved builds still read.
  purple: "#5B5FC7", crimson: "#E0284A", cyan: "#12B9DB", green: "#0EA678", orange: "#FF9F1C", pink: "#F0609E", navy: "#1F2A3D",
};
/** The ring, the disk inside it and today's circle: signal red on the surface, per appearance. */
export const STREAK_ROLES = { ring: "#FF0000", disk: "#141416", today: "#3A3A3F" };
export const STREAK_ROLES_LIGHT = { ring: "#FF0000", disk: "#FFFFFF", today: "#141414" };
export const streakRoles = (scheme: "light" | "dark") => (scheme === "light" ? STREAK_ROLES_LIGHT : STREAK_ROLES);

/** Whether day numbers on a capsule of this colour read in dark ink (the pale house blocks) rather than white. */
export function darkInk(hex: string): boolean {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}
const CYCLE = ["azure", "blush", "ember", "sky", "sage", "lilac"];

/** blank, kept (inside a run), partly done, missed, still to come. */
export type StreakKind = "blank" | "kept" | "partial" | "missed" | "ahead";
export type StreakCell = { day: number; kind: StreakKind; dark?: boolean };
export type StreakRun = { row: number; from: number; to: number; color: string };
export type StreakMonth = { weeks: StreakCell[][]; runs: StreakRun[]; streak: number; today: number; days: number; first: number };

/** Day numbers from "1-4, 6, 9-12", clamped to the month. */
function ranges(value: unknown, days: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const part of list(value, 16)) {
    const m = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(part);
    if (!m) continue;
    const a = Math.max(1, Math.min(days, Number(m[1])));
    const b = Math.max(a, Math.min(days, Number(m[2] ?? m[1])));
    out.push([a, b]);
  }
  return out;
}

/** The month laid out: weeks of seven cells and the capsules drawn behind them (split at week ends). */
export function streakMonth(p: Props): StreakMonth {
  const days = Math.max(28, Math.min(31, Math.round(n(p, "days")) || 30));
  const first = Math.max(0, Math.min(6, Math.round(n(p, "firstWeekday"))));
  const today = Math.max(1, Math.min(days, Math.round(n(p, "today")) || 1));
  const colors = list(p.colors, 16).map((c) => c.toLowerCase());
  const kind = new Map<number, StreakKind>();
  const color = new Map<number, string>();
  const runList = ranges(p.runs, days).filter(([a]) => a <= today);
  runList.forEach(([a, b], i) => {
    const c = STREAK_COLORS[colors[i]] ?? STREAK_COLORS[CYCLE[i % CYCLE.length]];
    for (let d = a; d <= Math.min(b, today); d++) {
      kind.set(d, "kept");
      color.set(d, c);
    }
  });
  for (const [a, b] of ranges(p.partial, days)) for (let d = a; d <= b; d++) if (!kind.has(d) && d <= today) kind.set(d, "partial");
  const weeks: StreakCell[][] = [];
  const cells = first + days;
  for (let r = 0; r < Math.ceil(cells / 7); r++) {
    const row: StreakCell[] = [];
    for (let c = 0; c < 7; c++) {
      const day = r * 7 + c - first + 1;
      if (day < 1 || day > days) row.push({ day: 0, kind: "blank" });
      else row.push({ day, kind: kind.get(day) ?? (day > today ? "ahead" : "missed"), ...(color.has(day) && darkInk(color.get(day)!) ? { dark: true } : {}) });
    }
    weeks.push(row);
  }
  // Capsules: consecutive kept days of one run's colour on one week row.
  const runs: StreakRun[] = [];
  weeks.forEach((row, r) => {
    let c = 0;
    while (c < 7) {
      const cell = row[c];
      if (cell.kind !== "kept") {
        c++;
        continue;
      }
      const col = color.get(cell.day)!;
      let end = c;
      while (end + 1 < 7 && row[end + 1].kind === "kept" && color.get(row[end + 1].day) === col) end++;
      runs.push({ row: r, from: c, to: end, color: col });
      c = end + 1;
    }
  });
  let streak = 0;
  for (let d = today; d >= 1 && kind.get(d) === "kept"; d--) streak++;
  return { weeks, runs, streak, today, days, first };
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const streakCalendar: SwiftPieceDefinition = {
  id: "streak-calendar",
  name: "Streak Calendar",
  category: "pieces",
  description: "A month where every run of kept days is one coloured capsule, under a ring that counts the current streak. Tap a day to read it; the ring winds up when it appears.",
  availability: "free",
  preview: { component: "streak-calendar", chunk: "app-pieces" },
  icon: "calendar",
  concepts: ["state", "zstack", "spring"],
  interactions: ["tap", "select", "spring", "haptic"],
  anatomy: [
    { part: "Ring", props: ["showsRing", "record"] },
    { part: "Month", props: ["month", "days", "firstWeekday", "today"] },
    { part: "Days", props: ["runs", "colors", "partial"] },
    { part: "Summary", props: ["todayNote"] },
  ],
  properties: [
    text("month", "Month", "September", { maxLength: 20 }),
    number("days", "Days in month", 30, 28, 31, 1),
    number("firstWeekday", "1st falls on", 0, 0, 6, 1, { hint: "0 is Monday." }),
    number("today", "Today", 22, 1, 31, 1, { group: "state" }),
    text("runs", "Streaks", "2-5, 7, 9-12, 14-16, 18-22", { maxLength: 80, hint: "Runs of kept days, like 1-4, 6, 9-12. Each is one capsule." }),
    text("colors", "Colours", "azure, blush, azure, ember, sky", { maxLength: 120, hint: "signal, ember, blush, azure, sky, butter, sage or lilac, one per run in turn." }),
    text("partial", "Partly done", "6, 13", { maxLength: 60, hint: "Days with something logged but short of the goal: a coloured dot." }),
    bool("showsRing", "Streak ring", true),
    number("record", "Ring goal", 10, 1, 365, 1, { hint: "The streak that fills the ring.", when: { prop: "showsRing", equals: [true] } }),
    text("todayNote", "Today's note", "1.7 L so far · 85% of your goal", { maxLength: 60 }),
  ],
  variants: [
    { id: "water", label: "Water", props: {} },
    { id: "reading", label: "Reading", props: { month: "March", firstWeekday: 5, days: 31, runs: "2-6, 9-14, 16-19", colors: "sage, sage, sage", partial: "8", today: 19, record: 30, todayNote: "24 pages · goal met" } },
    { id: "plain", label: "No ring", props: { showsRing: false, runs: "3-5, 8-12", colors: "azure, lilac", partial: "", today: 12, todayNote: "Goal met" } },
  ],
  states: [
    { id: "fresh", label: "Day one", props: { runs: "1", partial: "", today: 1 } },
    { id: "broken", label: "Streak broken", props: { runs: "1-4, 6-9", partial: "", today: 12 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const m = streakMonth(p);
      ctx.declare("streak-calendar:view", STREAK_SWIFT);
      const code: Record<StreakKind, string> = { blank: ".blank", kept: ".kept", partial: ".partial", missed: ".missed", ahead: ".ahead" };
      const weekLines = m.weeks.map((w) => `${INDENT}${INDENT}[${w.map((c) => (c.day ? `.init(day: ${c.day}, kind: ${code[c.kind]}${c.dark ? ", dark: true" : ""})` : ".init(day: 0, kind: .blank)")).join(", ")}],`);
      const runLines = m.runs.map((r) => `${INDENT}${INDENT}.init(row: ${r.row}, from: ${r.from}, to: ${r.to}, color: ${swiftRGB(r.color)}),`);
      return {
        lines: [
          "StreakCalendar(",
          `${INDENT}month: ${str(s(p, "month"))},`,
          `${INDENT}weeks: [`,
          ...weekLines,
          `${INDENT}],`,
          `${INDENT}runs: [`,
          ...runLines,
          `${INDENT}],`,
          `${INDENT}firstWeekday: ${m.first},`,
          `${INDENT}today: ${m.today},`,
          `${INDENT}streak: ${m.streak},`,
          `${INDENT}record: ${num(Math.max(1, n(p, "record")))},`,
          `${INDENT}showsRing: ${p.showsRing === true},`,
          `${INDENT}todayNote: ${str(s(p, "todayNote"))}`,
          ")",
        ],
      };
    },
  },
};

const I = INDENT;
const STREAK_SWIFT = [
  "private struct StreakCalendar: View {",
  `${I}enum Kind { case blank, kept, partial, missed, ahead }`,
  `${I}struct Cell { let day: Int; let kind: Kind; var dark = false }`,
  `${I}struct Run { let row: Int; let from: Int; let to: Int; let color: Color }`,
  "",
  `${I}let month: String`,
  `${I}let weeks: [[Cell]]`,
  `${I}let runs: [Run]`,
  `${I}let firstWeekday: Int`,
  `${I}let today: Int`,
  `${I}let streak: Int`,
  `${I}let record: Double`,
  `${I}let showsRing: Bool`,
  `${I}let todayNote: String`,
  `${I}@State private var selected: Int?`,
  `${I}@State private var wound = false`,
  `${I}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I}@Environment(\\.colorScheme) private var scheme`,
  `${I}private let ring = ${swiftRGB(STREAK_ROLES.ring)}`,
  `${I}private var disk: Color { scheme == .dark ? ${swiftRGB(STREAK_ROLES.disk)} : ${swiftRGB(STREAK_ROLES_LIGHT.disk)} }`,
  `${I}private var night: Color { scheme == .dark ? ${swiftRGB(STREAK_ROLES.today)} : ${swiftRGB(STREAK_ROLES_LIGHT.today)} }`,
  "",
  `${I}private var day: Int { selected ?? today }`,
  `${I}private var kind: Kind { weeks.joined().first { $0.day == day }?.kind ?? .ahead }`,
  `${I}private var title: String {`,
  `${I}${I}let names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]`,
  `${I}${I}return "\\(names[(firstWeekday + day - 1) % 7]), \\(day)"`,
  `${I}}`,
  `${I}private var note: String {`,
  `${I}${I}if day == today { return todayNote }`,
  `${I}${I}switch kind {`,
  `${I}${I}case .kept: return "Goal reached"`,
  `${I}${I}case .partial: return "Part of your goal"`,
  `${I}${I}default: return "Nothing logged"`,
  `${I}${I}}`,
  `${I}}`,
  "",
  `${I}var body: some View {`,
  `${I}${I}VStack(spacing: 18) {`,
  `${I}${I}${I}if showsRing {`,
  `${I}${I}${I}${I}ZStack {`,
  `${I}${I}${I}${I}${I}Circle()`,
  `${I}${I}${I}${I}${I}${I}.trim(from: 0, to: wound || reduceMotion ? min(Double(streak) / record, 1) : 0)`,
  `${I}${I}${I}${I}${I}${I}.stroke(ring, style: StrokeStyle(lineWidth: 16, lineCap: .round))`,
  `${I}${I}${I}${I}${I}${I}.rotationEffect(.degrees(-90))`,
  `${I}${I}${I}${I}${I}${I}.frame(width: 196, height: 196)`,
  `${I}${I}${I}${I}${I}Circle().fill(disk).frame(width: 162, height: 162)`,
  `${I}${I}${I}${I}${I}VStack(spacing: 0) {`,
  `${I}${I}${I}${I}${I}${I}Text("\\(streak)")`,
  `${I}${I}${I}${I}${I}${I}${I}.font(.system(size: 64, weight: .bold))`,
  `${I}${I}${I}${I}${I}${I}${I}.monospacedDigit()`,
  `${I}${I}${I}${I}${I}${I}${I}.contentTransition(.numericText(value: Double(streak)))`,
  `${I}${I}${I}${I}${I}${I}Text("DAYS IN\\nA ROW")`,
  `${I}${I}${I}${I}${I}${I}${I}.font(.caption.bold())`,
  `${I}${I}${I}${I}${I}${I}${I}.multilineTextAlignment(.center)`,
  `${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}.foregroundStyle(.primary)`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}.scaleEffect(wound || reduceMotion ? 1 : 0.95)`,
  `${I}${I}${I}${I}.opacity(wound ? 1 : 0)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}Text(month).font(.title2.bold()).foregroundStyle(.primary)`,
  `${I}${I}${I}VStack(spacing: 4) {`,
  `${I}${I}${I}${I}ForEach(weeks.indices, id: \\.self) { row in`,
  `${I}${I}${I}${I}${I}GeometryReader { geo in`,
  `${I}${I}${I}${I}${I}${I}let w = geo.size.width / 7`,
  `${I}${I}${I}${I}${I}${I}ZStack(alignment: .leading) {`,
  `${I}${I}${I}${I}${I}${I}${I}ForEach(runs.indices.filter { runs[$0].row == row }, id: \\.self) { i in`,
  `${I}${I}${I}${I}${I}${I}${I}${I}Capsule()`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.fill(runs[i].color)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.frame(width: CGFloat(runs[i].to - runs[i].from + 1) * w, height: 44)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.scaleEffect(wound || reduceMotion ? 1 : 0.95, anchor: .leading)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.opacity(wound ? 1 : 0)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.animation(.easeOut(duration: reduceMotion ? 0.2 : 0.3).delay(reduceMotion ? 0 : Double(min(row, 7)) * 0.04), value: wound)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.offset(x: CGFloat(runs[i].from) * w)`,
  `${I}${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}${I}HStack(spacing: 0) {`,
  `${I}${I}${I}${I}${I}${I}${I}${I}ForEach(0..<7, id: \\.self) { c in`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}cell(weeks[row][c]).frame(width: w, height: 44)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}.frame(height: 44)`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}}`,
  `${I}${I}${I}VStack(spacing: 2) {`,
  `${I}${I}${I}${I}Text(title).font(.title3.bold())`,
  `${I}${I}${I}${I}Text(note).font(.subheadline.bold()).foregroundStyle(ring)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}.contentTransition(.opacity)`,
  `${I}${I}}`,
  `${I}${I}.sensoryFeedback(.selection, trigger: selected)`,
  `${I}${I}.onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.3)) { wound = true } }`,
  `${I}}`,
  "",
  `${I}@ViewBuilder private func cell(_ cell: Cell) -> some View {`,
  `${I}${I}let isSelected = cell.day == selected`,
  `${I}${I}ZStack {`,
  `${I}${I}${I}if cell.day == today {`,
  `${I}${I}${I}${I}Circle().fill(night).padding(1)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}switch cell.kind {`,
  `${I}${I}${I}case .blank:`,
  `${I}${I}${I}${I}Color.clear`,
  `${I}${I}${I}case .kept:`,
  `${I}${I}${I}${I}Text("\\(cell.day)").font(.headline).monospacedDigit().foregroundStyle(cell.dark && cell.day != today ? ${swiftRGB("#141414")} : .white)`,
  `${I}${I}${I}case .partial:`,
  `${I}${I}${I}${I}Circle().fill(ring).frame(width: 12, height: 12)`,
  `${I}${I}${I}case .missed:`,
  `${I}${I}${I}${I}Circle().fill(Color.gray.opacity(0.35)).frame(width: 12, height: 12)`,
  `${I}${I}${I}case .ahead:`,
  `${I}${I}${I}${I}Text("\\(cell.day)").font(.subheadline.bold()).foregroundStyle(.tertiary)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}if isSelected {`,
  `${I}${I}${I}${I}Circle().stroke(Color.primary, lineWidth: 2).padding(2)`,
  `${I}${I}${I}${I}${I}.transition(.opacity)`,
  `${I}${I}${I}}`,
  `${I}${I}}`,
  `${I}${I}.contentShape(Rectangle())`,
  `${I}${I}.onTapGesture {`,
  `${I}${I}${I}guard cell.day > 0, cell.day <= today else { return }`,
  `${I}${I}${I}withAnimation(.easeOut(duration: 0.15)) { selected = cell.day }`,
  `${I}${I}}`,
  `${I}}`,
  "}",
];
