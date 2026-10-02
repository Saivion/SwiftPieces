// Countdown Card: an upcoming thing (an episode, a trip, a release) as a wide picture card with a
// split-flap counter in the corner: two digit tiles and "days away". Tap it and the tiles flip over
// to weeks and back, with a soft haptic per flip. The SwiftUI is written inline.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, num, str } from "../../core/swift.js";
import { ARTS } from "../native.js";
import { SOLID_ARTS, artInk } from "./media-row.js";
import { link, number, opts, select, text } from "../shared.js";
import { linkAction } from "./emit-link-action.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

const artOpts = opts(...Object.entries(ARTS).map(([id, a]): [string, string] => [id, a.label]));

/** The two digits and the unit for a count of days, in days or in whole weeks. */
export function countdownFace(days: number, weeks: boolean): { digits: string; unit: string } {
  const d = Math.max(0, Math.min(99, Math.round(days)));
  if (!weeks) return { digits: String(d).padStart(2, "0"), unit: d === 1 ? "day away" : "days away" };
  const w = Math.ceil(d / 7);
  return { digits: String(w).padStart(2, "0"), unit: w === 1 ? "week away" : "weeks away" };
}

const hex = (h: string) => {
  const v = h.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
};

export const countdownCard: SwiftPieceDefinition = {
  id: "countdown-card",
  name: "Countdown Card",
  category: "pieces",
  description: "A wide picture card for something coming up, with split-flap digit tiles counting the days in its corner. Tap to flip the tiles between days and weeks.",
  availability: "free",
  preview: { component: "countdown-card", chunk: "app-pieces" },
  card: (p) => Number(p.radius ?? 20),
  icon: "hourglass",
  concepts: ["state", "zstack", "spring"],
  interactions: ["tap", "spring", "haptic"],
  anatomy: [
    { part: "Picture", props: ["art", "height", "radius"] },
    { part: "Counter", props: ["days"] },
    { part: "Caption", props: ["eyebrow", "title", "detail"] },
    { part: "Interaction", props: ["link"] },
  ],
  properties: [
    select("art", "Picture", "dusk", artOpts, { group: "color" }),
    text("eyebrow", "Eyebrow", "Paper Harbor · S2E4", { maxLength: 40 }),
    text("title", "Title", "Low Tide", { maxLength: 60 }),
    text("detail", "Detail", "Apr 14, 2026 · 42 min", { maxLength: 60 }),
    number("days", "Days away", 5, 0, 99, 1),
    number("height", "Height", 180, 120, 320, 2, { group: "layout" }),
    number("radius", "Corner radius", 20, 8, 32, 1, { group: "shape" }),
    link("link", "Tapping the title opens"),
  ],
  variants: [
    { id: "episode", label: "Episode", props: { art: "lilac", eyebrow: "Paper Harbor · S2E4", title: "Low Tide", detail: "Apr 14, 2026 · 42 min", days: 5 } },
    { id: "trip", label: "Trip", props: { art: "azure", eyebrow: "", title: "Lisbon", detail: "Jun 2 → Jun 9", days: 12, height: 200 } },
    { id: "release", label: "Release", props: { art: "graphite", eyebrow: "Album", title: "Night Swim", detail: "Out Friday", days: 3, height: 150 } },
  ],
  states: [
    { id: "soon", label: "Tomorrow", props: { days: 1 } },
    { id: "today", label: "Today", props: { days: 0 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("countdown-card:view", COUNTDOWN_SWIFT);
      const id = ARTS[s(p, "art")] ? s(p, "art") : "dusk";
      const art = ARTS[id];
      const solid = SOLID_ARTS.has(id);
      const ink = artInk(id);
      const action = linkAction(ctx, p.link);
      return {
        lines: [
          "CountdownCard(",
          `${INDENT}colors: [${(solid ? [art.stops[1]] : art.stops).map(hex).join(", ")}],`,
          ...(solid ? [`${INDENT}scrim: false,`] : []),
          ...(ink !== "#ffffff" ? [`${INDENT}ink: ${hex(ink)},`] : []),
          `${INDENT}eyebrow: ${str(s(p, "eyebrow"))},`,
          `${INDENT}title: ${str(s(p, "title"))},`,
          `${INDENT}detail: ${str(s(p, "detail"))},`,
          `${INDENT}days: ${Math.max(0, Math.min(99, Math.round(n(p, "days"))))},`,
          `${INDENT}height: ${num(n(p, "height"))},`,
          ...(n(p, "radius") && n(p, "radius") !== 20 ? [`${INDENT}radius: ${num(n(p, "radius"))},`] : []),
          `${INDENT}open: ${action ?? "{}"}`,
          ")",
        ],
      };
    },
  },
};

const I = INDENT;
const COUNTDOWN_SWIFT = [
  "private struct CountdownCard: View {",
  `${I}let colors: [Color]`,
  `${I}var scrim = true`,
  `${I}var ink: Color = .white`,
  `${I}let eyebrow: String`,
  `${I}let title: String`,
  `${I}let detail: String`,
  `${I}let days: Int`,
  `${I}let height: CGFloat`,
  `${I}var radius: CGFloat = 20`,
  `${I}let open: () -> Void`,
  `${I}@State private var weeks = false`,
  `${I}@State private var shown = false`,
  `${I}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I}private var value: Int { weeks ? Int((Double(days) / 7).rounded(.up)) : days }`,
  `${I}private var digits: [String] { String(format: "%02d", min(value, 99)).map(String.init) }`,
  `${I}private var unit: String { weeks ? (value == 1 ? "week away" : "weeks away") : (value == 1 ? "day away" : "days away") }`,
  "",
  `${I}var body: some View {`,
  `${I}${I}Button { weeks.toggle() } label: { card }`,
  `${I}${I}${I}.buttonStyle(CountdownPressStyle())`,
  `${I}${I}${I}.scaleEffect(shown || reduceMotion ? 1 : 0.95)`,
  `${I}${I}${I}.opacity(shown ? 1 : 0)`,
  `${I}${I}${I}.sensoryFeedback(.impact(flexibility: .soft), trigger: weeks)`,
  `${I}${I}${I}.onAppear { withAnimation(.easeOut(duration: 0.28)) { shown = true } }`,
  `${I}}`,
  "",
  `${I}private var card: some View {`,
  `${I}${I}ZStack(alignment: .bottomLeading) {`,
  `${I}${I}${I}if colors.count > 1 {`,
  `${I}${I}${I}${I}LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)`,
  `${I}${I}${I}} else {`,
  `${I}${I}${I}${I}(colors.first ?? .gray)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}if scrim {`,
  `${I}${I}${I}${I}LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .center, endPoint: .bottom)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}VStack(alignment: .leading, spacing: 2) {`,
  `${I}${I}${I}${I}if !eyebrow.isEmpty { Text(eyebrow).font(.subheadline.weight(.medium)).opacity(0.8) }`,
  `${I}${I}${I}${I}Button(action: open) { Text(title).font(.title3.bold()).multilineTextAlignment(.leading) }`,
  `${I}${I}${I}${I}${I}.buttonStyle(.plain)`,
  `${I}${I}${I}${I}Text(detail).font(.footnote).opacity(0.8)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}.foregroundStyle(ink)`,
  `${I}${I}${I}.padding(16)`,
  `${I}${I}}`,
  `${I}${I}.overlay(alignment: .topTrailing) {`,
  `${I}${I}${I}VStack(spacing: 4) {`,
  `${I}${I}${I}${I}HStack(spacing: 4) {`,
  `${I}${I}${I}${I}${I}ForEach(Array(digits.enumerated()), id: \\.offset) { index, digit in`,
  `${I}${I}${I}${I}${I}${I}Text(digit)`,
  `${I}${I}${I}${I}${I}${I}${I}.font(.system(size: 30, weight: .bold).monospacedDigit())`,
  `${I}${I}${I}${I}${I}${I}${I}.foregroundStyle(.white)`,
  `${I}${I}${I}${I}${I}${I}${I}.frame(width: 34, height: 44)`,
  `${I}${I}${I}${I}${I}${I}${I}.background(Color(white: 0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))`,
  `${I}${I}${I}${I}${I}${I}${I}.overlay(Rectangle().fill(.black.opacity(0.5)).frame(height: 1))`,
  `${I}${I}${I}${I}${I}${I}${I}.rotation3DEffect(.degrees(weeks ? 360 : 0), axis: (x: 1, y: 0, z: 0))`,
  `${I}${I}${I}${I}${I}${I}${I}.animation(reduceMotion ? nil : .easeOut(duration: 0.3).delay(Double(index) * 0.04), value: weeks)`,
  `${I}${I}${I}${I}${I}${I}${I}.rotation3DEffect(.degrees(shown || reduceMotion ? 0 : -60), axis: (x: 1, y: 0, z: 0))`,
  `${I}${I}${I}${I}${I}${I}${I}.opacity(shown ? 1 : 0)`,
  `${I}${I}${I}${I}${I}${I}${I}.animation(.easeOut(duration: 0.28).delay(0.08 + Double(index) * 0.04), value: shown)`,
  `${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}Text(unit).font(.caption2.weight(.semibold)).foregroundStyle(ink)`,
  `${I}${I}${I}${I}${I}.contentTransition(.opacity)`,
  `${I}${I}${I}}`,
  `${I}${I}${I}.padding(16)`,
  `${I}${I}}`,
  `${I}${I}.frame(maxWidth: .infinity)`,
  `${I}${I}.frame(height: height)`,
  `${I}${I}.clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))`,
  `${I}${I}.contentShape(RoundedRectangle(cornerRadius: radius, style: .continuous))`,
  `${I}}`,
  "}",
  "",
  "private struct CountdownPressStyle: ButtonStyle {",
  `${I}func makeBody(configuration: Configuration) -> some View {`,
  `${I}${I}configuration.label`,
  `${I}${I}${I}.scaleEffect(configuration.isPressed ? 0.97 : 1)`,
  `${I}${I}${I}.animation(.easeOut(duration: 0.12), value: configuration.isPressed)`,
  `${I}}`,
  "}",
];
