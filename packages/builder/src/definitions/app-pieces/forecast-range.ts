// Forecast Range: a run of days, each with its symbol, the chance of rain, the low and the high,
// and a capsule between them on one shared scale, painted from the colour of the low to the colour
// of the high (cold blues through mild greens to hot reds). The first day can carry a dot for the
// temperature now. The capsules grow out from their lows as the list appears; tap a day to open
// its line of detail, with a selection tick. Under reduced motion the capsules show at once.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, num, str } from "../../core/swift.js";
import { bool, opts, select, text } from "../shared.js";
import { data, records } from "./data-kit.js";
import { construct } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const I = (d: number) => INDENT.repeat(d);

export type ForecastDay = { label: string; symbol: string; low: number; high: number; precip: string; detail: string };

/** "Today | sun.max | 14 | 23 | 10% | Clear all day; …" → days. Low and high are swapped if reversed. */
export function parseForecast(value: unknown): ForecastDay[] {
  return records(value, 14).map((f) => {
    const a = Number(f[2]);
    const b = Number(f[3]);
    const lo = Number.isFinite(a) ? a : 0;
    const hi = Number.isFinite(b) ? b : lo;
    return { label: f[0] || "", symbol: f[1] || "sun.max", low: Math.min(lo, hi), high: Math.max(lo, hi), precip: f[4] ?? "", detail: f[5] ?? "" };
  });
}

/** The temperature colour stops, in °C: cold blue, cool sky, mild mint, warm amber, hot orange, very hot red. */
export const TEMPERATURE_STOPS: Array<[number, [number, number, number]]> = [
  [-10, [123, 140, 255]],
  [0, [108, 196, 245]],
  [10, [62, 211, 163]],
  [18, [245, 184, 46]],
  [26, [244, 122, 58]],
  [34, [233, 72, 91]],
];

/** A temperature's colour as rgb, on the shared stops. */
export function temperatureRGB(t: number, fahrenheit: boolean): [number, number, number] {
  const c = fahrenheit ? ((t - 32) * 5) / 9 : t;
  const stops = TEMPERATURE_STOPS;
  if (c <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (c <= t1) {
      const k = (c - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

const STRUCT = (): string[] => [
  "/// A run of days on one temperature scale: each day's low and high as a capsule painted cold to hot.",
  "private struct ForecastRange: View {",
  `${I(1)}struct Day: Identifiable {`,
  `${I(2)}let id = UUID()`,
  `${I(2)}let label: String`,
  `${I(2)}let symbol: String`,
  `${I(2)}let low: Double`,
  `${I(2)}let high: Double`,
  `${I(2)}var precip = ""`,
  `${I(2)}var detail = ""`,
  `${I(1)}}`,
  "",
  `${I(1)}let days: [Day]`,
  `${I(1)}var now: Double? = nil`,
  `${I(1)}var unit = "°"`,
  `${I(1)}var fahrenheit = false`,
  `${I(1)}@State private var open: UUID?`,
  `${I(1)}@State private var grown = false`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I(1)}private var floor: Double { days.map(\\.low).min() ?? 0 }`,
  `${I(1)}private var ceiling: Double { max(floor + 1, days.map(\\.high).max() ?? 1) }`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}VStack(spacing: 0) {`,
  `${I(3)}ForEach(Array(days.enumerated()), id: \\.element.id) { index, day in`,
  `${I(4)}if index > 0 { Divider() }`,
  `${I(4)}VStack(alignment: .leading, spacing: 6) {`,
  `${I(5)}HStack(spacing: 10) {`,
  `${I(6)}Text(day.label)`,
  `${I(7)}.font(.body.weight(.medium))`,
  `${I(7)}.lineLimit(1)`,
  `${I(7)}.frame(width: 56, alignment: .leading)`,
  `${I(6)}VStack(spacing: 0) {`,
  `${I(7)}Image(systemName: day.symbol)`,
  `${I(8)}.symbolRenderingMode(.multicolor)`,
  `${I(8)}.font(.body)`,
  `${I(7)}if !day.precip.isEmpty {`,
  `${I(8)}Text(day.precip).font(.caption2.weight(.semibold)).foregroundStyle(.cyan)`,
  `${I(7)}}`,
  `${I(6)}}`,
  `${I(6)}.frame(width: 34)`,
  `${I(6)}Text("\\(Int(day.low.rounded()))\\(unit)")`,
  `${I(7)}.font(.body.weight(.medium))`,
  `${I(7)}.monospacedDigit()`,
  `${I(7)}.foregroundStyle(.secondary)`,
  `${I(7)}.frame(width: 38, alignment: .trailing)`,
  `${I(6)}bar(day, showsNow: index == 0)`,
  `${I(7)}.frame(height: 6)`,
  `${I(6)}Text("\\(Int(day.high.rounded()))\\(unit)")`,
  `${I(7)}.font(.body.weight(.medium))`,
  `${I(7)}.monospacedDigit()`,
  `${I(7)}.frame(width: 38, alignment: .leading)`,
  `${I(5)}}`,
  `${I(5)}if open == day.id && !day.detail.isEmpty {`,
  `${I(6)}Text(day.detail)`,
  `${I(7)}.font(.subheadline)`,
  `${I(7)}.foregroundStyle(.secondary)`,
  `${I(7)}.transition(.opacity.combined(with: .move(edge: .top)))`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(4)}.padding(.vertical, 11)`,
  `${I(4)}.contentShape(.rect)`,
  `${I(4)}.onTapGesture {`,
  `${I(5)}withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { open = open == day.id ? nil : day.id }`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.frame(maxWidth: .infinity)`,
  `${I(2)}.sensoryFeedback(.selection, trigger: open)`,
  `${I(2)}.onAppear {`,
  `${I(3)}withAnimation(reduceMotion ? nil : .easeOut(duration: 0.6)) { grown = true }`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private func bar(_ day: Day, showsNow: Bool) -> some View {`,
  `${I(2)}GeometryReader { geo in`,
  `${I(3)}let span = ceiling - floor`,
  `${I(3)}let start = (day.low - floor) / span * geo.size.width`,
  `${I(3)}let width = max(6, (day.high - day.low) / span * geo.size.width)`,
  `${I(3)}ZStack(alignment: .leading) {`,
  `${I(4)}Capsule().fill(.fill.tertiary)`,
  `${I(4)}Capsule()`,
  `${I(5)}.fill(LinearGradient(colors: [color(day.low), color(day.high)], startPoint: .leading, endPoint: .trailing))`,
  `${I(5)}.frame(width: grown || reduceMotion ? width : 6)`,
  `${I(5)}.offset(x: start)`,
  `${I(4)}if showsNow, let now {`,
  `${I(5)}Circle()`,
  `${I(6)}.fill(Color.white)`,
  `${I(6)}.overlay(Circle().stroke(Color.black.opacity(0.3), lineWidth: 1.5))`,
  `${I(6)}.frame(width: 10, height: 10)`,
  `${I(6)}.offset(x: min(max(0, (now - floor) / span * geo.size.width), geo.size.width) - 5)`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(3)}.frame(maxHeight: .infinity)`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private func color(_ t: Double) -> Color {`,
  `${I(2)}let c = fahrenheit ? (t - 32) * 5 / 9 : t`,
  `${I(2)}let stops: [(Double, Double, Double, Double)] = [${TEMPERATURE_STOPS.map(([t, [r, g, b]]) => `(${num(t)}, ${num(r / 255)}, ${num(g / 255)}, ${num(b / 255)})`).join(", ")}]`,
  `${I(2)}guard let first = stops.first, let last = stops.last else { return .gray }`,
  `${I(2)}if c <= first.0 { return Color(red: first.1, green: first.2, blue: first.3) }`,
  `${I(2)}for i in 1..<stops.count where c <= stops[i].0 {`,
  `${I(3)}let a = stops[i - 1], b = stops[i]`,
  `${I(3)}let k = (c - a.0) / (b.0 - a.0)`,
  `${I(3)}return Color(red: a.1 + (b.1 - a.1) * k, green: a.2 + (b.2 - a.2) * k, blue: a.3 + (b.3 - a.3) * k)`,
  `${I(2)}}`,
  `${I(2)}return Color(red: last.1, green: last.2, blue: last.3)`,
  `${I(1)}}`,
  "}",
];

export const forecastRange: SwiftPieceDefinition = {
  id: "forecast-range",
  name: "Forecast Range",
  category: "pieces",
  description: "Days of a forecast on one scale: each day's symbol, chance of rain, low and high, with a capsule between them painted from cold to hot and a dot for now. Tap a day for its detail.",
  availability: "free",
  preview: { component: "forecast-range", chunk: "app-pieces" },
  icon: "sun.max",
  concepts: ["state", "animation"],
  interactions: ["tap", "haptic"],
  anatomy: [
    { part: "Days", props: ["days"] },
    { part: "Scale", props: ["unit", "scale", "now", "showsNow"] },
  ],
  properties: [
    data("days", "Days", "Today | sun.max | 12 | 22 | | Clear and calm until late evening; Thu | cloud.sun | 13 | 21 | 10% | Clouds build after lunch; Fri | cloud.rain | 11 | 17 | 70% | Showers from mid-morning, 6 mm; Sat | cloud | 10 | 16 | 20% | Grey and still; Sun | sun.max | 9 | 19 | | Bright and cool", { hint: "Day | symbol | low | high | rain chance | detail, separated by semicolons." }),
    text("now", "Temperature now", "18", { maxLength: 6, hint: "A dot on the first day. Leave empty for none." }),
    bool("showsNow", "Show now", true),
    select("unit", "Unit", "°", opts(["°", "°"], ["°C", "°C"], ["°F", "°F"])),
    select("scale", "Scale", "celsius", opts(["celsius", "Celsius"], ["fahrenheit", "Fahrenheit"]), { hint: "Which scale the numbers are in, for the colours." }),
  ],
  variants: [
    { id: "summer", label: "Summer, °F", props: { scale: "fahrenheit", now: "84", days: "Today | sun.max | 71 | 92 | | Hot and dry, UV 9; Tue | sun.max | 73 | 95 | | Hottest after 3 PM; Wed | cloud.bolt | 70 | 88 | 40% | Storms possible late; Thu | cloud.sun | 68 | 85 | 10% | Cooler breeze" } },
    { id: "winter", label: "Winter", props: { now: "-2", days: "Today | snowflake | -6 | 1 | 60% | Snow through the morning, 4 cm; Fri | cloud | -4 | 2 | 20% | Overcast; Sat | sun.max | -8 | 0 | | Clear and frosty; Sun | cloud.sun | -3 | 4 | | Milder" } },
  ],
  states: [{ id: "no-now", label: "Without now", props: { showsNow: false } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("ForecastRange", STRUCT());
      const days = parseForecast(p.days);
      const rows = days.map((d) => `.init(label: ${ctx.str(d.label)}, symbol: ${str(ctx.symbol(d.symbol))}, low: ${num(d.low)}, high: ${num(d.high)}${d.precip ? `, precip: ${str(d.precip)}` : ""}${d.detail ? `, detail: ${ctx.str(d.detail)}` : ""})`);
      const now = Number(s(p, "now").trim());
      const showsNow = p.showsNow !== false && s(p, "now").trim() !== "" && Number.isFinite(now);
      return {
        lines: construct("ForecastRange", [
          rows.length ? ["days: [", ...rows.map((r) => `${INDENT}${r},`), "]"] : "days: []",
          showsNow && `now: ${num(now)}`,
          s(p, "unit") !== "°" && `unit: ${str(s(p, "unit"))}`,
          s(p, "scale") === "fahrenheit" && "fahrenheit: true",
        ]),
      };
    },
  },
};
