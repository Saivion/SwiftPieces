// Mood Calendar: days coloured by how they felt. A month of weeks with a mark per check-in under
// each date, or a whole year as pixels, a column per month. Tap a day to pick it out.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, opts, select } from "../shared.js";
import { MOOD_COLORS } from "./mood-faces.js";
import { ENTRANCE, PRESS_STYLE } from "./wellbeing-shared.js";
import { FEELING_MARKS, swiftArtwork } from "./artwork.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** Feelings palette, the SwiftPieces sweep: high energy unpleasant (signal), high pleasant (ember),
 * low unpleasant (azure), low pleasant (blush). */
export const FEELING_COLORS = ["#FF0000", "#FF7A3C", "#4D8DFF", "#FF8FB8"];
/** The four-corner palette (the bubble field's `corners`): red, gold, blue and green. */
export const CORNER_COLORS = ["#FF5042", "#FFC73D", "#4D8DFF", "#58CC8E"];
/** A month's mark colours for a palette: four feelings (sweep or corners) or five moods. */
export const calendarColors = (palette: unknown): string[] => (palette === "moods" ? MOOD_COLORS : palette === "corners" ? CORNER_COLORS : FEELING_COLORS);
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** A repeatable 0..1 value for day `i` (the same formula the Swift writes, so both show the same year). */
export function noise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A mood level 0 (awful) to 4 (great) for a day, leaning toward the good end as real diaries do. */
export function moodLevel(i: number, seed: number): number {
  const v = noise(i, seed);
  return v < 0.1 ? 0 : v < 0.24 ? 1 : v < 0.44 ? 2 : v < 0.74 ? 3 : 4;
}

/** A month day's check-ins: how many (0 to 3), and each one's colour index and shape index. */
export function dayMarks(day: number, seed: number, colors: number): Array<{ color: number; shape: number }> {
  const v = noise(day * 7 + 3, seed);
  const count = v < 0.24 ? 0 : v < 0.62 ? 1 : v < 0.93 ? 2 : 3;
  return Array.from({ length: count }, (_, k) => ({
    color: Math.floor(noise(day * 31 + k * 5, seed + 1) * colors) % colors,
    shape: Math.floor(noise(day * 17 + k * 11, seed + 2) * 4) % 4,
  }));
}

const rgb = (hex: string) => {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => num(Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
};

const VIEW = [
  "private struct MoodCalendar: View {",
  "    enum Layout { case month, year }",
  "    let layout: Layout",
  "    /// Mark colours: four feeling quadrants, or five moods from awful to great.",
  "    let colors: [Color]",
  "    var seed: Double = 1",
  "    /// Month layout: the weekday the 1st falls on (0 is Monday), the month's length and today.",
  "    var firstWeekday = 3",
  "    var days = 30",
  "    var today = 20",
  "    var dot: CGFloat = 13",
  "    /// Year layout: days after this day of the year are still to come and stay empty; 0 fills the whole year.",
  "    var upTo = 0",
  "    /// Month marks as short stacked pills; false draws mixed shapes.",
  "    var pills = true",
  "    /// With shapes: one drawn mark per colour (a feeling's own shape), in place of the plain shapes.",
  "    var markViews: [AnyView] = []",
  "    @State private var selected: Int?",
  "    @State private var appeared = false",
  "",
  "    private static let letters = [\"J\", \"F\", \"M\", \"A\", \"M\", \"J\", \"J\", \"A\", \"S\", \"O\", \"N\", \"D\"]",
  "    private static let lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]",
  "",
  "    private func noise(_ i: Int, _ seed: Double) -> Double {",
  "        let x = sin(Double(i) * 12.9898 + seed * 78.233) * 43758.5453",
  "        return x - x.rounded(.down)",
  "    }",
  "",
  "    private func level(_ i: Int) -> Int {",
  "        let v = noise(i, seed)",
  "        return v < 0.1 ? 0 : v < 0.24 ? 1 : v < 0.44 ? 2 : v < 0.74 ? 3 : 4",
  "    }",
  "",
  "    private func marks(_ day: Int) -> [(color: Int, shape: Int)] {",
  "        let v = noise(day * 7 + 3, seed)",
  "        let count = v < 0.24 ? 0 : v < 0.62 ? 1 : v < 0.93 ? 2 : 3",
  "        return (0..<count).map { k in",
  "            let color = Int(noise(day * 31 + k * 5, seed + 1) * Double(colors.count)) % colors.count",
  "            let shape = Int(noise(day * 17 + k * 11, seed + 2) * 4) % 4",
  "            return (color, shape)",
  "        }",
  "    }",
  "",
  "    private func shape(_ index: Int) -> AnyShape {",
  "        switch index {",
  "        case 0: AnyShape(Circle())",
  "        case 1: AnyShape(RoundedRectangle(cornerRadius: 4))",
  "        case 2: AnyShape(Capsule())",
  "        default: AnyShape(UnevenRoundedRectangle(topLeadingRadius: 10, bottomTrailingRadius: 10))",
  "        }",
  "    }",
  "",
  "    var body: some View {",
  "        Group {",
  "            switch layout {",
  "            case .month: month",
  "            case .year: year",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  "    private var month: some View {",
  "        let weeks = (firstWeekday + days + 6) / 7",
  "        return VStack(spacing: 14) {",
  "            HStack(spacing: 0) {",
  "                ForEach(Array([\"M\", \"T\", \"W\", \"T\", \"F\", \"S\", \"S\"].enumerated()), id: \\.offset) { _, d in",
  "                    Text(d).font(.subheadline).frame(maxWidth: .infinity)",
  "                }",
  "            }",
  "            ForEach(0..<weeks, id: \\.self) { week in",
  "                HStack(alignment: .bottom, spacing: 0) {",
  "                    ForEach(0..<7, id: \\.self) { weekday in",
  "                        let day = week * 7 + weekday - firstWeekday + 1",
  "                        if day >= 1 && day <= days {",
  "                            Button {",
  "                                withAnimation(.spring(duration: 0.3, bounce: 0.3)) { selected = day }",
  "                            } label: {",
  "                                VStack(spacing: 6) {",
  "                                    let dayMarks = marks(day)",
  "                                    Group {",
  "                                    if dayMarks.isEmpty {",
  "                                        Circle().fill(.quaternary).frame(width: pills ? 7 : 22, height: pills ? 7 : 22)",
  "                                    } else {",
  "                                        VStack(spacing: pills ? 3 : 2) {",
  "                                            ForEach(Array(dayMarks.enumerated()), id: \\.offset) { _, mark in",
  "                                                if pills {",
  "                                                    Capsule().fill(colors[mark.color]).frame(width: 24, height: 7)",
  "                                                } else if !markViews.isEmpty {",
  "                                                    markViews[mark.color % markViews.count]",
  "                                                        .foregroundStyle(colors[mark.color])",
  "                                                        .frame(width: 22, height: 22)",
  "                                                } else {",
  "                                                    shape(mark.shape).fill(colors[mark.color]).frame(width: 22, height: 18)",
  "                                                }",
  "                                            }",
  "                                        }",
  "                                    }",
  "                                    }",
  "                                    .modifier(WellbeingEntrance(shown: appeared, delay: Double(min(week, 7)) * 0.04))",
  "                                    Text(\"\\(day)\")",
  "                                        .font(.body.weight(day == today ? .bold : .regular))",
  "                                }",
  "                                .frame(maxWidth: .infinity, minHeight: pills ? 56 : 84, alignment: .bottom)",
  "                                .scaleEffect(selected == day ? 1.15 : 1)",
  "                            }",
  "                            .buttonStyle(WellbeingPressStyle())",
  "                        } else {",
  "                            Color.clear.frame(maxWidth: .infinity, minHeight: pills ? 56 : 84)",
  "                        }",
  "                    }",
  "                }",
  "            }",
  "        }",
  "    }",
  "",
  "    private var year: some View {",
  "        HStack(alignment: .top, spacing: 0) {",
  "            VStack(alignment: .trailing, spacing: 0) {",
  "                Text(\" \").font(.caption)",
  "                ForEach(1...31, id: \\.self) { d in",
  "                    Text(\"\\(d)\").font(.caption2).foregroundStyle(.secondary).frame(height: dot + 4)",
  "                }",
  "            }",
  "            .frame(width: 22)",
  "            ForEach(0..<12, id: \\.self) { m in",
  "                VStack(spacing: 0) {",
  "                    Text(Self.letters[m]).font(.caption).foregroundStyle(.secondary)",
  "                    ForEach(1...31, id: \\.self) { d in",
  "                        let i = m * 31 + d",
  "                        let dayOfYear = Self.lengths.prefix(m).reduce(0, +) + d",
  "                        let future = upTo > 0 && dayOfYear > upTo",
  "                        Circle()",
  "                            .fill(d > Self.lengths[m] ? Color.clear : future ? Color.primary.opacity(0.1) : colors[level(i) % colors.count])",
  "                            .frame(width: dot, height: dot)",
  "                            .scaleEffect(selected == i ? 1.6 : 1)",
  "                            .frame(height: dot + 4)",
  "                            .contentShape(.rect)",
  "                            .onTapGesture {",
  "                                guard !future, d <= Self.lengths[m] else { return }",
  "                                withAnimation(.spring(duration: 0.3, bounce: 0.3)) { selected = i }",
  "                            }",
  "                    }",
  "                }",
  "                .frame(maxWidth: .infinity)",
  "                .modifier(WellbeingEntrance(shown: appeared, delay: Double(min(m, 7)) * 0.04))",
  "            }",
  "        }",
  "    }",
  "}",
];

export const moodCalendar: SwiftPieceDefinition = {
  id: "mood-calendar",
  name: "Mood Calendar",
  category: "pieces",
  description: "Days coloured by mood: a month of check-in marks, or a year of daily dots.",
  availability: "free",
  preview: { component: "mood-calendar", chunk: "app-pieces" },
  icon: "calendar",
  concepts: ["state", "foreach"],
  anatomy: [
    { part: "Layout", props: ["layout", "dot"] },
    { part: "Marks", props: ["palette", "marks", "seed"] },
    { part: "Month", props: ["firstWeekday", "days", "today"] },
  ],
  interactions: ["tap", "select", "spring", "haptic"],
  variants: [
    { id: "month", label: "Month of check-ins", props: { layout: "month", palette: "feelings" } },
    { id: "year", label: "Year of dots", props: { layout: "year", palette: "moods", dot: 13 } },
  ],
  states: [
    { id: "june", label: "A 30-day month", props: { days: 30, firstWeekday: 3, today: 20 } },
    { id: "february", label: "February", props: { days: 28, firstWeekday: 5, today: 12 } },
  ],
  properties: [
    select("layout", "Layout", "month", opts(["month", "Month"], ["year", "Year of dots"])),
    select("palette", "Colours", "feelings", opts(["feelings", "Four feelings"], ["corners", "Four corners (red, gold, blue, green)"], ["moods", "Five moods"])),
    select("marks", "Check-in marks", "pills", opts(["pills", "Stacked pills"], ["shapes", "Shapes (a feeling's own mark for four colours)"]), { when: { prop: "layout", equals: ["month"] } }),
    number("seed", "Sample data", 1, 1, 20, 1, { hint: "Picks a different, repeatable run of sample days." }),
    number("firstWeekday", "1st falls on", 3, 0, 6, 1, { hint: "0 is Monday.", when: { prop: "layout", equals: ["month"] } }),
    number("days", "Days in month", 30, 28, 31, 1, { when: { prop: "layout", equals: ["month"] } }),
    number("today", "Today", 20, 0, 31, 1, { when: { prop: "layout", equals: ["month"] } }),
    number("dot", "Pixel size", 13, 6, 20, 1, { when: { prop: "layout", equals: ["year"] } }),
    number("upTo", "Logged through day", 0, 0, 366, 1, { hint: "Day of the year that is today; later days stay empty. 0 fills the year.", when: { prop: "layout", equals: ["year"] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("WellbeingEntrance", ENTRANCE);
      ctx.declare("WellbeingPressStyle", PRESS_STYLE);
      ctx.declare("MoodCalendar", VIEW);
      const colors = calendarColors(s(p, "palette")).map(rgb);
      const month = s(p, "layout") !== "year";
      // Four feelings drawn as shapes: each colour's own mark (a burst, a sun, a drop, a clover).
      const drawn = month && s(p, "marks") === "shapes" && s(p, "palette") !== "moods" ? FEELING_MARKS.map((id) => swiftArtwork(ctx, id)) : [];
      return {
        lines: call("MoodCalendar", [
          ["layout", month ? ".month" : ".year"],
          ["colors", `[${colors.join(", ")}]`],
          n(p, "seed") !== 1 && ["seed", num(n(p, "seed"))],
          month && n(p, "firstWeekday") !== 3 && ["firstWeekday", num(n(p, "firstWeekday"))],
          month && n(p, "days") !== 30 && ["days", num(n(p, "days"))],
          month && n(p, "today") !== 20 && ["today", num(n(p, "today"))],
          !month && n(p, "dot") !== 13 && ["dot", num(n(p, "dot"))],
          !month && n(p, "upTo") > 0 && ["upTo", num(n(p, "upTo"))],
          // In the struct's order: a memberwise init takes its arguments as the properties are declared.
          month && s(p, "marks") === "shapes" && ["pills", "false"],
          drawn.length > 0 && ["markViews", `[${drawn.map((d) => `AnyView(${d})`).join(", ")}]`],
        ]),
      };
    },
  },
};
