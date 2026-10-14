// Range Lens: overview and detail for a long series. The readout names the window's average (or total, highest,
// lowest) and its dates, the detail chart draws the window's samples under a red dashed average rule, and a strip of
// the whole series underneath carries a glass lens you drag to move and pull by its handles to resize. The emitter
// writes a sample series (a small repeatable generator) so the screen runs on its own, holds the window in a
// `@State` the screen owns, and calls the piece's public API exactly as RangeLens.swift declares it, writing only
// what differs from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const LENS_DEFAULTS = { summary: "average", minimumSpan: 7, showsAverage: true } as const;

export type LensSeries = {
  label: string;
  /** Days in the sample, ending today. */
  days: number;
  /** The emitted generator's type name. */
  swift: string;
  /** How the readout and VoiceOver read a value, as the emitted trailing closure; null keeps the piece's default. */
  valueLabel: string | null;
  /** The same formatting for the Playground. */
  format: (v: number) => string;
};

export const LENS_SERIES: Record<string, LensSeries> = {
  steps: { label: "Daily steps", days: 365, swift: "SampleSteps", valueLabel: null, format: (v) => Math.round(v).toLocaleString() },
  sleep: { label: "Hours slept", days: 180, swift: "SampleSleep", valueLabel: "$0.formatted(.number.precision(.fractionLength(1)))", format: (v) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
  sales: { label: "Daily sales", days: 365, swift: "SampleSales", valueLabel: "$0.formatted(.currency(code: \"EUR\").precision(.fractionLength(0)))", format: (v) => v.toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) },
};

/**
 * One day of a sample series, ported for the Playground so it and the generated app show the same days. `k` counts
 * days from the oldest (0) and `date` is that day; weekday is 1 for Sunday to 7 for Saturday, as Calendar reads it.
 */
export function lensSample(series: string, k: number, date: Date): number {
  const noise = ((k * 7919 + 13) % 101) / 100;
  const weekday = date.getDay() + 1;
  const month = date.getMonth() + 1, day = date.getDate();
  if (series === "sleep") {
    // Longer on Friday and Saturday nights, a busy week every two months.
    let hours = 7 + (weekday === 6 || weekday === 7 ? 0.7 : 0) + (noise - 0.5) * 1.4;
    if (k % 61 >= 20 && k % 61 <= 26) hours -= 1.2;
    return Math.round(hours * 10) / 10;
  }
  if (series === "sales") {
    // Busier weekends, a December rush and a quieter August.
    let euros = 1600 + (weekday === 7 ? 900 : weekday === 1 ? 500 : 0) + (noise - 0.5) * 700;
    if (month === 12) euros += 60 * Math.min(day, 24);
    if (month === 8) euros -= 300;
    return Math.round(euros);
  }
  // Steps: weekends higher, a summer rise, a holiday dip at the turn of the year, the odd rest day.
  const rest = ((k * 4021 + 71) % 97) / 96;
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.round((new Date(date.getFullYear(), date.getMonth(), day).getTime() - start.getTime()) / 86_400_000) + 1;
  const summer = Math.exp(-(((dayOfYear - 200) / 48) ** 2));
  let steps = 7400 + 2300 * summer + (weekday === 7 ? 2800 : weekday === 1 ? 1900 : 0) + (noise - 0.5) * 2800;
  if ((month === 12 && day >= 23) || (month === 1 && day <= 1)) steps *= 0.5;
  if (rest < 0.05) steps = 2400 + noise * 900;
  return Math.round(Math.max(steps, 600));
}

/** The generator the emitted screen declares, the same series as `lensSample`. */
function sampleSwift(series: string): string[] {
  const i = INDENT;
  const def = LENS_SERIES[series] ?? LENS_SERIES.steps;
  const value: string[] =
    series === "sleep" ? [
      `${i}${i}${i}var hours = 7 + (weekday == 6 || weekday == 7 ? 0.7 : 0) + (noise - 0.5) * 1.4`,
      `${i}${i}${i}if (20...26).contains(k % 61) { hours -= 1.2 }`,
      `${i}${i}${i}return RangeLens.Sample(date: date, value: (hours * 10).rounded() / 10)`,
    ] : series === "sales" ? [
      `${i}${i}${i}let day = calendar.component(.day, from: date)`,
      `${i}${i}${i}var euros = 1_600 + (weekday == 7 ? 900 : weekday == 1 ? 500 : 0) + (noise - 0.5) * 700`,
      `${i}${i}${i}if month == 12 { euros += 60 * Double(min(day, 24)) }`,
      `${i}${i}${i}if month == 8 { euros -= 300 }`,
      `${i}${i}${i}return RangeLens.Sample(date: date, value: euros.rounded())`,
    ] : [
      `${i}${i}${i}let day = calendar.component(.day, from: date)`,
      `${i}${i}${i}let rest = Double((k * 4_021 + 71) % 97) / 96`,
      `${i}${i}${i}let dayOfYear = Double(calendar.ordinality(of: .day, in: .year, for: date) ?? 1)`,
      `${i}${i}${i}let summer = exp(-pow((dayOfYear - 200) / 48, 2))`,
      `${i}${i}${i}var steps = 7_400 + 2_300 * summer + (weekday == 7 ? 2_800 : weekday == 1 ? 1_900 : 0) + (noise - 0.5) * 2_800`,
      `${i}${i}${i}if (month == 12 && day >= 23) || (month == 1 && day <= 1) { steps *= 0.5 }`,
      `${i}${i}${i}if rest < 0.05 { steps = 2_400 + noise * 900 }`,
      `${i}${i}${i}return RangeLens.Sample(date: date, value: max(steps, 600).rounded())`,
    ];
  const about =
    series === "sleep" ? "Hours slept for the last six months: longer on Friday and Saturday nights, a busy week every two months."
    : series === "sales" ? "Sales a day for the last year, in euros: busier weekends, a December rush and a quieter August."
    : "Daily steps for the last year: weekends higher, a summer rise, a holiday dip and the odd rest day.";
  return [
    `/// ${about} The same every`,
    "/// time. In your app, pass your own samples, one value per day.",
    `enum ${def.swift} {`,
    `${i}static func days(calendar: Calendar = .current) -> [RangeLens.Sample] {`,
    `${i}${i}let today = calendar.startOfDay(for: .now)`,
    `${i}${i}return (0..<${def.days}).compactMap { k in`,
    `${i}${i}${i}guard let date = calendar.date(byAdding: .day, value: k - ${def.days - 1}, to: today) else { return nil }`,
    `${i}${i}${i}let noise = Double((k * 7_919 + 13) % 101) / 100`,
    `${i}${i}${i}let weekday = calendar.component(.weekday, from: date)`,
    ...(series === "sleep" ? [] : [`${i}${i}${i}let month = calendar.component(.month, from: date)`]),
    ...value,
    `${i}${i}}`,
    `${i}}`,
    "}",
  ];
}

export const definition: SwiftPieceDefinition = {
  id: "range-lens",
  name: "Range Lens",
  category: "pieces",
  description: "Overview and detail for a long series: a chart of the window you are reading, and a strip of the whole series with a glass lens you drag to move and pull by its handles to resize.",
  availability: "free",
  preview: { component: "range-lens", chunk: "pieces-utility" },
  source: { registry: "free", name: "RangeLens" },
  docs: "/docs/components/data/range-lens",
  icon: "chart.bar",
  concepts: ["state", "binding", "closure", "gesture", "formatstyle", "range"],
  interactions: ["drag", "scrub", "tap", "hold", "spring", "haptic", "transition"],
  properties: [
    select("series", "Series", "steps", opts(["steps", "Daily steps, a year"], ["sleep", "Hours slept, six months"], ["sales", "Daily sales, a year"]), { group: "content", hint: "Only for this preview. Your app passes its own samples." }),
    text("unit", "Unit", "steps a day", { maxLength: 32, hint: "Shown after the numeral and read by VoiceOver. Empty shows the numeral alone." }),
    select("summary", "Readout", LENS_DEFAULTS.summary, opts(["average", "Average"], ["total", "Total"], ["maximum", "Highest"], ["minimum", "Lowest"]), { group: "content", hint: "The figure the readout shows for the window." }),
    bool("showsAverage", "Average rule", LENS_DEFAULTS.showsAverage, { group: "color", hint: "A red dashed rule at the window's average, with an avg chip on the value axis." }),
    number("opensOn", "Opens on the last", 42, 7, 365, 1, { group: "layout", hint: "Samples in the window when the screen opens." }),
    number("minimumSpan", "Shortest window", LENS_DEFAULTS.minimumSpan, 1, 60, 1, { level: "advanced", group: "interaction", hint: "Resizing stops firmly here; the window never inverts." }),
    select("opens", "Starts as", "recent", opts(["recent", "The last samples"], ["all", "The whole series"], ["shortest", "The shortest window"]), { group: "state" }),
    select("data", "Data", "full", opts(["full", "Sample series"], ["empty", "No data yet"]), { group: "state", hint: "No data yet shows the empty state: no lens, a quiet track." }),
  ],
  variants: [
    { id: "steps", label: "Steps, last six weeks", props: { series: "steps", unit: "steps a day", summary: "average", showsAverage: true, opensOn: 42 } },
    { id: "sleep", label: "Sleep, last four weeks", props: { series: "sleep", unit: "hours a night", summary: "average", showsAverage: true, opensOn: 28 } },
    { id: "sales", label: "Sales, this month", props: { series: "sales", unit: "", summary: "total", showsAverage: true, opensOn: 30 } },
    { id: "best", label: "Best day", props: { series: "steps", unit: "steps", summary: "maximum", showsAverage: false, opensOn: 90 } },
  ],
  states: [
    { id: "recent", label: "Last samples", props: { opens: "recent", data: "full" } },
    { id: "all", label: "Whole series", props: { opens: "all", data: "full" } },
    { id: "shortest", label: "Shortest window", props: { opens: "shortest", data: "full" } },
    { id: "empty", label: "No data yet", props: { opens: "recent", data: "empty" } },
  ],
  anatomy: [
    { part: "Readout", props: ["summary", "unit"] },
    { part: "Detail chart", props: ["showsAverage"] },
    { part: "Strip and lens", props: ["opensOn", "opens", "minimumSpan"] },
    { part: "Samples", props: ["series", "data"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const key = LENS_SERIES[s(p, "series")] ? s(p, "series") : "steps";
      const series = LENS_SERIES[key];
      const empty = s(p, "data") === "empty";
      const minimumSpan = Math.min(Math.max(Math.round(n(p, "minimumSpan") || LENS_DEFAULTS.minimumSpan), 1), 60);
      const opensOn = Math.min(Math.max(Math.round(n(p, "opensOn") || 42), minimumSpan), series.days);
      const opens = s(p, "opens");
      const last = opens === "all" ? series.days : opens === "shortest" ? minimumSpan : opensOn;
      if (!empty) ctx.declare(series.swift, sampleSwift(key));
      const days = ctx.state("days", "[RangeLens.Sample]", empty ? "[]" : `${series.swift}.days()`);
      const window = ctx.state("window", "ClosedRange<Date>", empty ? "Date.now...Date.now" : `RangeLens.window(last: ${num(last)}, of: ${series.swift}.days())`);
      const summary = s(p, "summary") || LENS_DEFAULTS.summary;
      const unit = s(p, "unit").trim();
      const lines = call("RangeLens", [
        ["samples", days],
        ["selection", `$${window}`],
        summary !== LENS_DEFAULTS.summary && ["summary", `.${summary}`],
        unit && ["unit", str(unit)],
        minimumSpan !== LENS_DEFAULTS.minimumSpan && ["minimumSpan", num(minimumSpan)],
        !b(p, "showsAverage") && ["showsAverage", "false"],
        // A Style accent in the Playground reaches the average rule, its chip and a held handle.
        ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
      ], series.valueLabel ? [series.valueLabel] : null);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
