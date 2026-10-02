// Goal Ring: a challenge card. The dates and the challenge's name over a thick progress ring
// with the percentage and "7/10 done" in its middle. The card settles in from 0.95 with a fade and
// the ring sweeps up to its value; tap to watch it fill again, with a light tap. Under reduced motion
// the card fades and the ring shows its value.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, text } from "../shared.js";
import { swiftTint, tint } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

const SWIFT = [
  "private struct GoalRing: View {",
  "    var dates = \"\"",
  "    var title = \"\"",
  "    let done: Int",
  "    let total: Int",
  "    var unit = \"done\"",
  "    var tint: Color = .red",
  "    var titleInk: Color = .primary",
  "    var size: CGFloat = 220",
  "    @State private var shown = 0.0",
  "    @State private var taps = 0",
  "    @State private var appeared = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private var value: Double { total > 0 ? Double(done) / Double(total) : 0 }",
  "",
  "    var body: some View {",
  "        VStack(spacing: 18) {",
  "            VStack(spacing: 4) {",
  "                if !dates.isEmpty { Text(dates).font(.footnote).foregroundStyle(.secondary) }",
  "                if !title.isEmpty { Text(title).font(.title3.weight(.bold)).foregroundStyle(titleInk).multilineTextAlignment(.center) }",
  "            }",
  "            ZStack {",
  "                Circle().stroke(.quaternary, lineWidth: size * 0.12)",
  "                Circle()",
  "                    .trim(from: 0, to: shown)",
  "                    .stroke(tint, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round))",
  "                    .rotationEffect(.degrees(-90))",
  "                VStack(spacing: 4) {",
  "                    Text(\"\\(Int((shown * 100).rounded()))%\")",
  "                        .font(.system(size: size * 0.2, weight: .bold).monospacedDigit())",
  "                        .foregroundStyle(tint)",
  "                        .contentTransition(.numericText())",
  "                    Text(\"\\(done)/\\(total) \\(unit)\").font(.caption).foregroundStyle(.secondary)",
  "                }",
  "            }",
  "            .frame(width: size, height: size)",
  "            .padding(size * 0.06)",
  "        }",
  "        .padding(20)",
  "        .frame(maxWidth: .infinity)",
  "        .background(.fill.tertiary, in: .rect(cornerRadius: 24))",
  "        .contentShape(.rect)",
  "        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "        .opacity(appeared ? 1 : 0)",
  "        .onAppear { withAnimation(.easeOut(duration: 0.28)) { appeared = true }; fill() }",
  "        .onTapGesture { taps += 1; shown = 0; fill() }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "    }",
  "",
  "    private func fill() {",
  "        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.6)) { shown = value }",
  "    }",
  "}",
];

export const goalRing: SwiftPieceDefinition = {
  id: "goal-ring",
  name: "Goal Ring",
  category: "pieces",
  description: "A challenge card: dates and name over a thick progress ring with the percentage and the count done. It sweeps up as it appears; tap to fill it again.",
  availability: "free",
  preview: { component: "goal-ring", chunk: "app-pieces" },
  icon: "trophy",
  concepts: ["state", "animation"],
  anatomy: [
    { part: "Heading", props: ["dates", "title"] },
    { part: "Progress", props: ["done", "total", "unit"] },
    { part: "Ring", props: ["tint", "size"] },
  ],
  interactions: ["tap", "haptic"],
  variants: [
    { id: "nearly", label: "Nearly there", props: { done: 9, total: 10 } },
    { id: "alphabet", label: "Halfway", props: { title: "A book a month", done: 6, total: 12 } },
  ],
  states: [{ id: "complete", label: "Complete", props: { done: 10, total: 10 } }],
  properties: [
    text("dates", "Dates", "Jan 1 – Dec 31, 2026"),
    text("title", "Challenge", "Ten new authors"),
    number("done", "Done", 9, 0, 999),
    number("total", "Total", 10, 1, 999),
    text("unit", "Unit", "done"),
    tint("tint", "Ring colour", "signal"),
    number("size", "Ring size", 220, 120, 300),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("GoalRing", SWIFT);
      return {
        lines: call("GoalRing", [
          s(p, "dates").trim() && ["dates", ctx.str(s(p, "dates").trim())],
          s(p, "title").trim() && ["title", ctx.str(s(p, "title").trim())],
          ["done", String(Math.round(n(p, "done")))],
          ["total", String(Math.max(1, Math.round(n(p, "total"))))],
          s(p, "unit") !== "done" && ["unit", ctx.str(s(p, "unit"))],
          ["tint", swiftTint(s(p, "tint"), "signal")],
          n(p, "size") !== 220 && ["size", num(n(p, "size"))],
        ]),
      };
    },
  },
};
