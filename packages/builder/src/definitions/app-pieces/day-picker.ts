// Day Picker: a week strip or a month grid of dates you tap to pick. The picked day sits in a disc
// of the accent that slides between days; today's date is in the accent; days with plans carry a
// dot, busy days a quiet grey disc. The week strip is the planner header (weekday letters over the
// dates), the grid the calendar month.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { data, items, numbers, swiftStrs, swiftTint, tint } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** The cells a picker shows: day numbers, with `outside` for the neighbouring months' days. */
export function dayCells(p: Record<string, unknown>): Array<{ day: number; outside: boolean }> {
  if (s(p, "layout") === "month") {
    const days = Math.max(28, Math.min(31, n(p, "days") || 30));
    const lead = Math.max(0, Math.min(6, n(p, "offset")));
    const cells = [
      ...Array.from({ length: lead }, (_, i) => ({ day: 31 - lead + 1 + i, outside: true })),
      ...Array.from({ length: days }, (_, i) => ({ day: i + 1, outside: false })),
    ];
    let next = 1;
    while (cells.length % 7) cells.push({ day: next++, outside: true });
    return cells;
  }
  const start = n(p, "start") || 1;
  return Array.from({ length: 7 }, (_, i) => ({ day: start + i, outside: false }));
}

const SWIFT = [
  "private struct DayPicker: View {",
  "    let days: [Int]",
  "    let outside: [Bool]",
  "    var letters = [\"M\", \"T\", \"W\", \"T\", \"F\", \"S\", \"S\"]",
  "    var month = false",
  "    var marked: Set<Int> = []",
  "    var busy: Set<Int> = []",
  "    var today = 0",
  "    var tint: Color = Color(red: 1, green: 0, blue: 0)",
  "    var serif = false",
  "    @State var selected: Int",
  "    @Namespace private var pick",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    var body: some View {",
  "        VStack(spacing: 8) {",
  "            if month {",
  "                HStack(spacing: 0) {",
  "                    ForEach(letters.indices, id: \\.self) { i in",
  "                        Text(letters[i]).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).frame(maxWidth: .infinity)",
  "                    }",
  "                }",
  "            }",
  "            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: month ? 8 : 0) {",
  "                ForEach(days.indices, id: \\.self) { i in",
  "                    cell(i)",
  "                }",
  "            }",
  "        }",
  "        .opacity(shown ? 1 : 0)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "    }",
  "",
  "    @ViewBuilder private func cell(_ i: Int) -> some View {",
  "        let day = days[i]",
  "        let inMonth = !outside[i]",
  "        let isSelected = inMonth && day == selected",
  "        let isToday = inMonth && day == today",
  "        let isBusy = inMonth && busy.contains(day)",
  "        let hasPlans = inMonth && (marked.contains(day) || (!month && isBusy))",
  "        VStack(spacing: 4) {",
  "            if !month {",
  "                Text(letters[i % letters.count]).font(.caption2.weight(isSelected ? .bold : .medium))",
  "                    .foregroundStyle(isSelected ? .primary : .secondary)",
  "            }",
  "            ZStack {",
  "                if month && isBusy && !isSelected { Circle().fill(.fill.secondary) }",
  "                if isSelected {",
  "                    Circle().fill(tint).matchedGeometryEffect(id: \"pick\", in: pick)",
  "                }",
  "                Text(\"\\(day)\")",
  "                    .font(serif ? .system(size: month ? 17 : 22, weight: .light, design: .serif) : .system(size: month ? 16 : 17, weight: isSelected || isToday ? .bold : .semibold))",
  "                    .monospacedDigit()",
  "                    .foregroundStyle(!inMonth ? AnyShapeStyle(.tertiary) : isSelected ? AnyShapeStyle(.white) : isToday ? AnyShapeStyle(tint) : AnyShapeStyle(.primary))",
  "            }",
  "            .frame(width: 36, height: 36)",
  "            Circle().fill(hasPlans && !isSelected ? AnyShapeStyle(.secondary) : AnyShapeStyle(.clear)).frame(width: 4, height: 4)",
  "        }",
  "        .padding(.vertical, month ? 0 : 4)",
  "        .frame(maxWidth: .infinity, minHeight: 44)",
  "        .contentShape(.rect)",
  "        .onTapGesture {",
  "            guard inMonth else { return }",
  "            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .snappy(duration: 0.3)) { selected = day }",
  "        }",
  "        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)",
  "    }",
  "}",
];

export const dayPicker: SwiftPieceDefinition = {
  id: "day-picker",
  name: "Day Picker",
  category: "pieces",
  description: "A week strip or month grid of dates to tap. The picked day's accent disc slides between days; today is in the accent, days with plans get a dot and busy days a grey disc.",
  availability: "free",
  preview: { component: "day-picker", chunk: "app-pieces" },
  icon: "calendar",
  concepts: ["state", "foreach", "animation"],
  anatomy: [
    { part: "Days", props: ["layout", "start", "days", "offset", "letters"] },
    { part: "Selection", props: ["selected", "today"] },
    { part: "Plans", props: ["marked", "tint"] },
    { part: "Type", props: ["numerals"] },
  ],
  interactions: ["tap", "select", "haptic"],
  variants: [
    { id: "week", label: "Week strip", props: { layout: "week", start: 12, selected: 13 } },
    { id: "month", label: "Month grid", props: { layout: "month", days: 31, offset: 3, selected: 22, today: 8, marked: "2, 6, 13, 14, 20, 27, 29", busy: "9, 16, 22" } },
  ],
  states: [{ id: "later", label: "Later day", props: { selected: 16 } }],
  properties: [
    select("layout", "Layout", "week", opts(["week", "Week strip"], ["month", "Month grid"])),
    number("start", "First date", 12, 1, 31, 1, { when: { prop: "layout", equals: ["week"] } }),
    number("days", "Days in month", 30, 28, 31, 1, { when: { prop: "layout", equals: ["month"] } }),
    number("offset", "Starts on column", 3, 0, 6, 1, { when: { prop: "layout", equals: ["month"] }, hint: "0 is the first column (Monday)." }),
    number("selected", "Selected date", 13, 1, 31),
    number("today", "Today", 0, 0, 31, 1, { hint: "Its date is set in the accent. 0 for none." }),
    data("marked", "Days with plans", "", { hint: "Day numbers that get a dot under the date." }),
    data("busy", "Busy days", "", { hint: "Day numbers set on a grey disc in the month grid (a dot in the week strip)." }),
    text("letters", "Weekday letters", "M, T, W, T, F, S, S"),
    tint("tint", "Accent", "signal"),
    select("numerals", "Numerals", "default", opts(["default", "Bold sans"], ["serif", "Light serif"])),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("DayPicker", SWIFT);
      const cells = dayCells(p);
      const letters = items(s(p, "letters"));
      const month = s(p, "layout") === "month";
      const marked = numbers(s(p, "marked"));
      const busy = numbers(s(p, "busy"));
      return {
        lines: call("DayPicker", [
          ["days", `[${cells.map((c) => c.day).join(", ")}]`],
          ["outside", `[${cells.map((c) => String(c.outside)).join(", ")}]`],
          letters.length === 7 && letters.join(",") !== "M,T,W,T,F,S,S" && ["letters", swiftStrs(letters, ctx.str)],
          month && ["month", "true"],
          marked.length > 0 && ["marked", `[${marked.map((m) => Math.round(m)).join(", ")}]`],
          busy.length > 0 && ["busy", `[${busy.map((m) => Math.round(m)).join(", ")}]`],
          n(p, "today") > 0 && ["today", num(n(p, "today"))],
          s(p, "tint") !== "signal" && ["tint", swiftTint(s(p, "tint"), "signal")],
          s(p, "numerals") === "serif" && ["serif", "true"],
          ["selected", num(n(p, "selected"))],
        ]),
      };
    },
  },
};
