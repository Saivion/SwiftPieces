// Activity Heatmap: weeks of days shaded by activity in solid steps of the accent, with the current streak
// above, a scrub that lifts a day under a callout, and VoiceOver that steps day by day. The emitter writes
// sample activity (a small repeatable generator) so the screen runs on its own, holds the selected day in a
// `@State` the screen owns, and calls the piece's public API exactly as ActivityHeatmap.swift declares it,
// writing only what differs from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const HEATMAP_DEFAULTS = { weeks: 20, title: "Activity" } as const;

/** The level rules the Shades property offers, as `ActivityHeatmap.Levels`. */
export const HEATMAP_THRESHOLDS: Record<string, number[] | null> = {
  automatic: null,
  habit: [1],
  goal: [10, 20, 30, 45],
};

/**
 * The sample data the emitted `SampleActivity` writes, ported for the preview so the Playground and the
 * generated app show the same days: an 11 day run into yesterday, today done or still open, a week off a
 * month back, a 19 day run before it and lighter weeks further back. `back` counts days before today.
 */
export function heatmapSample(back: number, todayDone: boolean, sessions: boolean): number {
  const roll = ((back * 7919 + 13) % 101) / 100;
  const active =
    back === 0 ? todayDone
    : back <= 11 || (back >= 38 && back <= 56) ? true
    : back === 12 || (back >= 30 && back <= 37) || back === 57 ? false
    : roll > (back > 70 ? 0.55 : 0.3);
  if (!active) return 0;
  return sessions ? 1 + Math.floor(roll * 5) : Math.round(20 + roll * 60);
}

function sampleActivity(): string[] {
  const i = INDENT;
  return [
    "/// Sample activity for the heatmap, so the screen runs on its own. In your app, add up what people did",
    "/// each day (minutes from their sessions, say) keyed by the day it happened.",
    "enum SampleActivity {",
    `${i}/// Minutes (or sessions) per day for the last weeks: an 11 day run into yesterday, today done or still`,
    `${i}/// open, a week off a month back, a 19 day run before it and lighter weeks further back. The same every time.`,
    `${i}static func days(todayDone: Bool = true, sessions: Bool = false, weeks: Int = 20) -> [Date: Double] {`,
    `${i}${i}let calendar = Calendar.current`,
    `${i}${i}let today = calendar.startOfDay(for: .now)`,
    `${i}${i}var result: [Date: Double] = [:]`,
    `${i}${i}for back in 0..<(weeks * 7) {`,
    `${i}${i}${i}guard let day = calendar.date(byAdding: .day, value: -back, to: today) else { continue }`,
    `${i}${i}${i}let roll = Double((back * 7_919 + 13) % 101) / 100`,
    `${i}${i}${i}let active = switch back {`,
    `${i}${i}${i}case 0: todayDone`,
    `${i}${i}${i}case 1...11, 38...56: true`,
    `${i}${i}${i}case 12, 30...37, 57: false`,
    `${i}${i}${i}default: roll > (back > 70 ? 0.55 : 0.3)`,
    `${i}${i}${i}}`,
    `${i}${i}${i}guard active else { continue }`,
    `${i}${i}${i}result[day] = sessions ? Double(1 + Int(roll * 5)) : (20 + roll * 60).rounded()`,
    `${i}${i}}`,
    `${i}${i}return result`,
    `${i}}`,
    "}",
  ];
}

const calendarHelper = [
  "extension Calendar {",
  `${INDENT}/// The person's calendar with weeks starting on another day: 1 is Sunday, 2 is Monday.`,
  `${INDENT}static func startingWeeks(on weekday: Int) -> Calendar {`,
  `${INDENT}${INDENT}var calendar = Calendar.current`,
  `${INDENT}${INDENT}calendar.firstWeekday = weekday`,
  `${INDENT}${INDENT}return calendar`,
  `${INDENT}}`,
  "}",
];

export const definition: SwiftPieceDefinition = {
  id: "activity-heatmap",
  name: "Activity Heatmap",
  category: "pieces",
  description: "A streak calendar: weeks of days shaded from a pale red to pure red by how much happened, the current streak above it, and a scrub that lifts any day under a callout with its date and value.",
  availability: "free",
  preview: { component: "activity-heatmap", chunk: "pieces-utility" },
  source: { registry: "free", name: "ActivityHeatmap" },
  docs: "/docs/components/data/activity-heatmap",
  icon: "flame",
  concepts: ["state", "binding", "closure", "gesture", "formatstyle", "scrollview"],
  interactions: ["scrub", "tap", "hold", "scroll", "haptic", "transition", "spring"],
  properties: [
    text("title", "Tracks", HEATMAP_DEFAULTS.title, { maxLength: 32, hint: "What the days count. VoiceOver reads it first, as in Activity, last 20 weeks." }),
    select("unit", "Values", "minutes", opts(["minutes", "Minutes"], ["sessions", "Sessions"]), { hint: "What the callout and VoiceOver read for a day." }),
    number("weeks", "Weeks", HEATMAP_DEFAULTS.weeks, 4, 53, 1, { group: "layout", hint: "When the weeks can't fit, the grid scrolls sideways and opens on today." }),
    bool("showsSummary", "Streak summary", true, { hint: "The current streak, the longest one and the active days above the grid." }),
    select("levels", "Shades", "automatic", opts(["automatic", "Quartiles of the data"], ["habit", "Done or not"], ["goal", "Goal steps (10, 20, 30, 45)"]), {
      group: "color",
      hint: "How values map to the four shades. The first step is also what counts toward a streak.",
    }),
    select("weekStart", "Weeks start on", "person", opts(["person", "The person's first weekday"], ["monday", "Monday"], ["sunday", "Sunday"]), { level: "advanced", group: "layout" }),
    select("activity", "Sample data", "streak", opts(["streak", "Streak going"], ["open", "Today still open"], ["empty", "No activity yet"]), {
      group: "state",
      hint: "Only for this preview. Your app passes its own counts.",
    }),
    bool("selectsToday", "Starts with today selected", false, { level: "advanced", group: "state" }),
  ],
  variants: [
    { id: "practice", label: "Practice minutes", props: { title: "Practice", unit: "minutes", weeks: 20, showsSummary: true, levels: "automatic" } },
    { id: "habit", label: "Daily habit", props: { title: "Meditation", unit: "sessions", weeks: 16, showsSummary: true, levels: "habit" } },
    { id: "year", label: "A year of workouts", props: { title: "Workouts", unit: "sessions", weeks: 52, showsSummary: true, levels: "automatic" } },
    { id: "goal", label: "Reading goal", props: { title: "Reading", unit: "minutes", weeks: 12, showsSummary: false, levels: "goal" } },
  ],
  states: [
    { id: "streak", label: "Streak going", props: { activity: "streak", selectsToday: false } },
    { id: "open", label: "Today still open", props: { activity: "open", selectsToday: false } },
    { id: "selected", label: "A day selected", props: { activity: "streak", selectsToday: true } },
    { id: "empty", label: "No activity yet", props: { activity: "empty", selectsToday: false } },
  ],
  anatomy: [
    { part: "Summary", props: ["showsSummary", "title"] },
    { part: "Grid", props: ["weeks", "weekStart"] },
    { part: "Shades", props: ["levels"] },
    { part: "Days", props: ["unit", "activity", "selectsToday"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const sessions = s(p, "unit") === "sessions";
      const weeks = Math.min(Math.max(Math.round(n(p, "weeks") || HEATMAP_DEFAULTS.weeks), 4), 53);
      const activity = s(p, "activity");
      let seed = "[:]";
      if (activity !== "empty") {
        ctx.declare("SampleActivity", sampleActivity());
        const args = [activity === "open" && "todayDone: false", sessions && "sessions: true", weeks > HEATMAP_DEFAULTS.weeks && `weeks: ${num(weeks)}`].filter(Boolean);
        seed = `SampleActivity.days(${args.join(", ")})`;
      }
      const data = ctx.state("activity", "[Date: Double]", seed);
      const day = ctx.state("day", "Date?", b(p, "selectsToday") ? "Calendar.current.startOfDay(for: .now)" : "nil");
      const thresholds = HEATMAP_THRESHOLDS[s(p, "levels")] ?? null;
      const weekday = s(p, "weekStart") === "monday" ? 2 : s(p, "weekStart") === "sunday" ? 1 : 0;
      if (weekday) ctx.declare("Calendar.startingWeeks", calendarHelper);
      const title = s(p, "title").trim();
      const head = call("ActivityHeatmap", [
        [null, data],
        weeks !== HEATMAP_DEFAULTS.weeks && ["weeks", num(weeks)],
        weekday > 0 && ["calendar", `.startingWeeks(on: ${weekday})`],
        thresholds && ["levels", `.thresholds([${thresholds.map(num).join(", ")}])`],
        !b(p, "showsSummary") && ["showsSummary", "false"],
        ["selection", `$${day}`],
        title && title !== HEATMAP_DEFAULTS.title && ["messages", `.init(title: ${str(title)})`],
        // A Style accent in the Playground reaches the piece: its shades are mixed from it.
        ctx.theme && ["style", ".init(accent: Theme.accent)"],
      ]);
      // The trailing closure names the unit for the callout and VoiceOver.
      head[head.length - 1] += sessions ? " { sessions in" : " { minutes in";
      const body = sessions
        ? `String(AttributedString(localized: "^[\\(Int(sessions)) session](inflect: true)").characters)`
        : "Measurement(value: minutes, unit: UnitDuration.minutes).formatted(.measurement(width: .abbreviated, usage: .asProvided))";
      return { lines: [...head, `${INDENT}${body}`, "}"] };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
