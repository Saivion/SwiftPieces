// Progress Ring Row: a habit or goal as one row. Its symbol sits inside a ring that fills toward
// the goal, the count reads under the title, and a pill on the right does the day's action: add a
// step, run a timer that counts up, or mark it done. The ring sweeps up to today's value as the row
// appears (0.3 s); each tapped step ticks with a rising haptic, the timer starts and stops with a
// light tap, and reaching the goal turns the symbol to a tick with a success tap. The pill dips to
// 0.97 under a finger; a row that opens something highlights instead.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, num, str } from "../../core/swift.js";
import { color, icon, link, number, opts, select, text } from "../shared.js";
import { construct, linkAction, rgb } from "./emit-link-action.js";

/** Swift Pieces colours for the ring. When one is picked it takes over from `tint`. */
export const RING_SWATCHES: Record<string, string> = {
  signal: "#FF0000", ember: "#FF7A3C", blush: "#FF8FB8", azure: "#4D8DFF", sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF",
};

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const I = (d: number) => INDENT.repeat(d);
const dbl = (v: number) => (Number.isInteger(v) ? `${v}` : num(v));

/** The pill's words and symbol for an action, before and after the goal. */
export function actionLabel(action: string, title: string, step: number, running: boolean, done: boolean): { text: string; icon: string } {
  if (action === "timer") return { text: running ? "Pause" : title || "Timer", icon: running ? "pause.fill" : "timer" };
  if (action === "check") return { text: done ? "Done" : title || "Done", icon: "checkmark" };
  return { text: title || `+${dbl(step)}`, icon: "plus" };
}

const STRUCT = (): string[] => [
  "/// A habit as a row: its symbol in a ring that fills toward the goal, and a pill for today's action.",
  "private struct ProgressRingRow: View {",
  `${I(1)}enum Action { case increment, timer, check }`,
  `${I(1)}let title: String`,
  `${I(1)}let symbol: String`,
  `${I(1)}@State var value: Double`,
  `${I(1)}let goal: Double`,
  `${I(1)}var unit = ""`,
  `${I(1)}var step: Double = 1`,
  `${I(1)}var action: Action = .increment`,
  `${I(1)}var actionTitle = ""`,
  `${I(1)}var tint: Color = .blue`,
  `${I(1)}var onOpen: (() -> Void)? = nil`,
  `${I(1)}@State private var running = false`,
  `${I(1)}@State private var swept = false`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I(1)}private var done: Bool { value >= goal }`,
  "",
  `${I(1)}@State private var taps = 0`,
  `${I(1)}@Environment(\\.colorScheme) private var scheme`,
  "",
  `${I(1)}/// The tint for text and symbols: deepened in light appearance so pale swatches stay readable.`,
  `${I(1)}private var ink: Color { scheme == .light ? tint.mix(with: .black, by: 0.35) : tint }`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}if let onOpen {`,
  `${I(3)}Button(action: onOpen) { row }`,
  `${I(4)}.buttonStyle(ProgressRingRowPress())`,
  `${I(2)}} else {`,
  `${I(3)}row`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private var row: some View {`,
  `${I(2)}HStack(spacing: 12) {`,
  `${I(3)}ZStack {`,
  `${I(4)}Circle().stroke(tint.opacity(0.15), lineWidth: 3.5)`,
  `${I(4)}Circle()`,
  `${I(5)}.trim(from: 0, to: swept || reduceMotion ? min(value / max(goal, 0.001), 1) : 0)`,
  `${I(5)}.stroke(tint, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))`,
  `${I(5)}.rotationEffect(.degrees(-90))`,
  `${I(4)}Image(systemName: done ? "checkmark" : symbol)`,
  `${I(5)}.font(.system(size: 17, weight: .semibold))`,
  `${I(5)}.foregroundStyle(ink)`,
  `${I(5)}.contentTransition(.symbolEffect(.replace))`,
  `${I(3)}}`,
  `${I(3)}.frame(width: 44, height: 44)`,
  `${I(3)}VStack(alignment: .leading, spacing: 2) {`,
  `${I(4)}Text(title).font(.body.weight(.medium)).foregroundStyle(.primary)`,
  `${I(4)}Text("\\(value.formatted())/\\(goal.formatted()) \\(unit)")`,
  `${I(5)}.font(.subheadline)`,
  `${I(5)}.monospacedDigit()`,
  `${I(5)}.foregroundStyle(.secondary)`,
  `${I(5)}.contentTransition(.numericText(value: value))`,
  `${I(3)}}`,
  `${I(3)}Spacer(minLength: 8)`,
  `${I(3)}Button(action: act) {`,
  `${I(4)}Label(pillTitle, systemImage: pillSymbol)`,
  `${I(5)}.font(.subheadline.weight(.medium))`,
  `${I(5)}.padding(.horizontal, 12)`,
  `${I(5)}.padding(.vertical, 7)`,
  `${I(5)}.background(tint.opacity(0.14), in: .capsule)`,
  `${I(5)}.padding(.vertical, 6)`,
  `${I(5)}.contentShape(.rect)`,
  `${I(3)}}`,
  `${I(3)}.buttonStyle(ProgressPillPress())`,
  `${I(3)}.foregroundStyle(ink)`,
  `${I(2)}}`,
  `${I(2)}.padding(.vertical, 2)`,
  `${I(2)}.contentShape(.rect)`,
  `${I(2)}.task(id: running) {`,
  `${I(3)}while running && !Task.isCancelled {`,
  `${I(4)}try? await Task.sleep(for: .seconds(1))`,
  `${I(4)}withAnimation(.snappy(duration: 0.25)) { value = min(goal, value + step) }`,
  `${I(4)}if value >= goal { running = false }`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.onAppear {`,
  `${I(3)}withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.3)) { swept = true }`,
  `${I(2)}}`,
  `${I(2)}.sensoryFeedback(.increase, trigger: taps)`,
  `${I(2)}.sensoryFeedback(.impact(weight: .light), trigger: running)`,
  `${I(2)}.sensoryFeedback(.success, trigger: done) { _, new in new }`,
  `${I(1)}}`,
  "",
  `${I(1)}private var pillTitle: String {`,
  `${I(2)}switch action {`,
  `${I(2)}case .timer: running ? "Pause" : (actionTitle.isEmpty ? "Timer" : actionTitle)`,
  `${I(2)}case .check: actionTitle.isEmpty ? "Done" : actionTitle`,
  `${I(2)}case .increment: actionTitle.isEmpty ? "+\\(step.formatted())" : actionTitle`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private var pillSymbol: String {`,
  `${I(2)}switch action {`,
  `${I(2)}case .timer: running ? "pause.fill" : "timer"`,
  `${I(2)}case .check: "checkmark"`,
  `${I(2)}case .increment: "plus"`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private func act() {`,
  `${I(2)}switch action {`,
  `${I(2)}case .timer: running.toggle()`,
  `${I(2)}case .check: withAnimation(.snappy(duration: 0.25)) { value = done ? 0 : goal }`,
  `${I(2)}case .increment:`,
  `${I(3)}if !done { taps += 1 }`,
  `${I(3)}withAnimation(.snappy(duration: 0.25)) { value = done ? 0 : min(goal, value + step) }`,
  `${I(2)}}`,
  `${I(1)}}`,
  "}",
  "",
  "/// The row answers a press with a highlight, not a scale.",
  "private struct ProgressRingRowPress: ButtonStyle {",
  `${I(1)}func makeBody(configuration: Configuration) -> some View {`,
  `${I(2)}configuration.label`,
  `${I(3)}.background(Color.primary.opacity(configuration.isPressed ? 0.06 : 0), in: .rect(cornerRadius: 12))`,
  `${I(3)}.animation(.easeOut(duration: 0.12), value: configuration.isPressed)`,
  `${I(1)}}`,
  "}",
  "",
  "private struct ProgressPillPress: ButtonStyle {",
  `${I(1)}func makeBody(configuration: Configuration) -> some View {`,
  `${I(2)}configuration.label`,
  `${I(3)}.scaleEffect(configuration.isPressed ? 0.97 : 1)`,
  `${I(3)}.animation(.easeOut(duration: 0.12), value: configuration.isPressed)`,
  `${I(1)}}`,
  "}",
];

export const progressRingRow: SwiftPieceDefinition = {
  id: "progress-ring-row",
  name: "Progress Ring Row",
  category: "pieces",
  description: "A habit as one row: its symbol inside a ring that fills toward the goal, the count under the title, and a pill that adds a step, runs a timer or marks it done.",
  availability: "free",
  preview: { component: "progress-ring-row", chunk: "app-pieces" },
  // It pads itself only 2 top and bottom.
  list: { pad: 10 },
  icon: "checkmark.circle.fill",
  concepts: ["state", "animation"],
  interactions: ["tap", "haptic", "push"],
  anatomy: [
    { part: "Ring", props: ["symbol", "tint", "swatch", "value", "goal"] },
    { part: "Text", props: ["title", "unit"] },
    { part: "Action", props: ["action", "actionTitle", "step"] },
    { part: "Interaction", props: ["link"] },
  ],
  properties: [
    text("title", "Title", "Cycling", { maxLength: 40 }),
    icon("symbol", "Symbol", "figure.walk"),
    number("value", "Done so far", 8, 0, 100000, 0.5),
    number("goal", "Goal", 15, 0.5, 100000, 0.5),
    text("unit", "Unit", "km", { maxLength: 16 }),
    select("action", "Action", "increment", opts(["increment", "Add a step"], ["timer", "Timer"], ["check", "Mark done"])),
    number("step", "Step", 1, 0.5, 1000, 0.5, { hint: "What a tap adds, or a timer adds each second." }),
    text("actionTitle", "Action title", "", { maxLength: 16, hint: "Leave empty for the default." }),
    color("tint", "Tint", "blue"),
    select("swatch", "Swift Pieces colour", "none", opts(["none", "Use tint"], ...Object.keys(RING_SWATCHES).map((k): [string, string] => [k, k[0].toUpperCase() + k.slice(1)])), { hint: "Picks a Swift Pieces colour for the ring, over the tint." }),
    link("link", "Tapping the row opens"),
  ],
  variants: [
    { id: "distance", label: "Distance", props: { title: "Cycling", symbol: "figure.walk", value: 8, goal: 15, unit: "km", swatch: "azure" } },
    { id: "timer", label: "Timer", props: { title: "Breathing", symbol: "timer", value: 5, goal: 10, unit: "minutes", action: "timer", swatch: "blush" } },
    { id: "check", label: "Check", props: { title: "Vitamins", symbol: "pills", value: 0, goal: 1, unit: "dose", action: "check", swatch: "ember" } },
  ],
  states: [{ id: "done", label: "Goal reached", props: { value: 15 } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("ProgressRingRow", STRUCT());
      const action = linkAction(ctx, p.link);
      const kind = s(p, "action");
      return {
        lines: construct("ProgressRingRow", [
          `title: ${str(s(p, "title"))}`,
          `symbol: ${str(ctx.symbol(s(p, "symbol") === "none" ? "circle" : s(p, "symbol")))}`,
          `value: ${dbl(n(p, "value"))}`,
          `goal: ${dbl(n(p, "goal"))}`,
          s(p, "unit").trim() && `unit: ${str(s(p, "unit").trim())}`,
          n(p, "step") !== 1 && `step: ${dbl(n(p, "step"))}`,
          kind !== "increment" && `action: .${kind}`,
          s(p, "actionTitle").trim() && `actionTitle: ${str(s(p, "actionTitle").trim())}`,
          RING_SWATCHES[s(p, "swatch")] ? `tint: ${rgb(RING_SWATCHES[s(p, "swatch")])}` : s(p, "tint") !== "blue" && `tint: ${ctx.color(s(p, "tint"))}`,
          action && `onOpen: ${action}`,
        ]),
      };
    },
  },
};
