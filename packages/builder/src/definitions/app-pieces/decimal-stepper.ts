// Decimal Stepper: a labelled setting with minus and plus around a boxed value, for values that
// step in fractions (playback speed 1.4×, a 0.5 kg increment, a 2.5% rate). Each step ticks up or
// down; holding either button repeats, and dragging sideways on the value scrubs through the steps.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { icon, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** The value as shown: fixed decimals and the suffix, e.g. 1.4 → "1.4×". */
export const stepLabel = (v: number, decimals: number, suffix: string) => `${v.toFixed(Math.max(0, Math.min(3, decimals)))}${suffix}`;

const VIEW = [
  "private struct DecimalStepper: View {",
  "    let label: String",
  "    var symbol = \"\"",
  "    @Binding var value: Double",
  "    var range: ClosedRange<Double> = 0.5...3",
  "    var step: Double = 0.1",
  "    var decimals = 1",
  "    var suffix = \"\"",
  "    @State private var dragStart: Double?",
  "",
  "    var body: some View {",
  "        HStack(spacing: 4) {",
  "            if !symbol.isEmpty {",
  "                Image(systemName: symbol).font(.title3).frame(width: 28)",
  "            }",
  "            Text(label).padding(.leading, symbol.isEmpty ? 0 : 8)",
  "            Spacer()",
  "            button(\"minus\", -step)",
  "            Text(value.formatted(.number.precision(.fractionLength(decimals))) + suffix)",
  "                .monospacedDigit()",
  "                .contentTransition(.numericText(value: value))",
  "                .frame(width: 64, height: 34)",
  "                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8, style: .continuous))",
  "                .scaleEffect(dragStart == nil ? 1 : 1.06)",
  "                .animation(.spring(duration: 0.3, bounce: 0.25), value: dragStart == nil)",
  "                .gesture(scrub)",
  "            button(\"plus\", step)",
  "        }",
  "        .sensoryFeedback(trigger: value) { old, new in new > old ? .increase : .decrease }",
  "    }",
  "",
  "    /// Drag sideways on the value: one step per 16 points.",
  "    private var scrub: some Gesture {",
  "        DragGesture(minimumDistance: 4)",
  "            .onChanged { drag in",
  "                let start = dragStart ?? value",
  "                dragStart = start",
  "                let next = ((start + (drag.translation.width / 16).rounded() * step) / step).rounded() * step",
  "                let clamped = min(range.upperBound, max(range.lowerBound, next))",
  "                if clamped != value { withAnimation(.snappy) { value = clamped } }",
  "            }",
  "            .onEnded { _ in dragStart = nil }",
  "    }",
  "",
  "    private func button(_ name: String, _ delta: Double) -> some View {",
  "        Button {",
  "            withAnimation(.snappy) {",
  "                let next = ((value + delta) / step).rounded() * step",
  "                value = min(range.upperBound, max(range.lowerBound, next))",
  "            }",
  "        } label: {",
  "            Image(systemName: name)",
  "                .font(.body.weight(.semibold))",
  "                .frame(width: 32, height: 32)",
  "                .overlay(Circle().strokeBorder(.secondary, lineWidth: 1.5))",
  "                .frame(width: 44, height: 44)",
  "                .contentShape(Circle())",
  "        }",
  "        .buttonStyle(StepPressStyle())",
  "        .buttonRepeatBehavior(.enabled)",
  "        .disabled(delta < 0 ? value <= range.lowerBound : value >= range.upperBound)",
  "    }",
  "}",
  "",
  "private struct StepPressStyle: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .background(Circle().fill(Color.primary.opacity(configuration.isPressed ? 0.12 : 0)).frame(width: 32, height: 32))",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];

export const decimalStepper: SwiftPieceDefinition = {
  id: "decimal-stepper",
  name: "Decimal Stepper",
  category: "pieces",
  description: "A setting row with minus and plus around a boxed value that steps in fractions, like playback speed. Hold to repeat.",
  availability: "free",
  preview: { component: "decimal-stepper", chunk: "app-pieces" },
  icon: "plus.circle.fill",
  concepts: ["state", "binding", "range"],
  anatomy: [
    { part: "Label", props: ["label", "symbol"] },
    { part: "Value", props: ["value", "decimals", "suffix"] },
    { part: "Range", props: ["min", "max", "step"] },
  ],
  interactions: ["tap", "hold", "haptic"],
  variants: [
    { id: "speed", label: "Playback speed", props: { label: "Speed", symbol: "timer", value: 1.4, min: 0.5, max: 3, step: 0.1, decimals: 1, suffix: "×" } },
    { id: "weight", label: "Weight", props: { label: "Plates", symbol: "dumbbell", value: 22.5, min: 0, max: 200, step: 2.5, decimals: 1, suffix: " kg" } },
  ],
  states: [
    { id: "min", label: "At minimum", props: { value: 0.5 } },
    { id: "max", label: "At maximum", props: { value: 3 } },
  ],
  properties: [
    text("label", "Label", "Speed", { maxLength: 40 }),
    icon("symbol", "Symbol", "timer"),
    number("value", "Value", 1.4, -1000, 1000, 0.1, { group: "state" }),
    number("min", "Minimum", 0.5, -1000, 1000, 0.1),
    number("max", "Maximum", 3, -1000, 1000, 0.1),
    number("step", "Step", 0.1, 0.01, 100, 0.01),
    number("decimals", "Decimals", 1, 0, 3, 1),
    text("suffix", "Suffix", "×", { maxLength: 6 }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("DecimalStepper", VIEW);
      const lo = Math.min(n(p, "min"), n(p, "max"));
      const hi = Math.max(n(p, "min"), n(p, "max"));
      const v = Math.min(hi, Math.max(lo, n(p, "value")));
      const name = ctx.state(s(p, "label") || "value", "Double", Number.isInteger(v) ? `${v}.0` : num(v));
      const sym = s(p, "symbol");
      return {
        lines: call("DecimalStepper", [
          ["label", ctx.str(s(p, "label"))],
          sym && sym !== "none" && ["symbol", ctx.str(ctx.symbol(sym))],
          ["value", `$${name}`],
          ["range", `${num(lo)}...${num(hi)}`],
          n(p, "step") !== 0.1 && ["step", num(n(p, "step"))],
          n(p, "decimals") !== 1 && ["decimals", num(Math.round(n(p, "decimals")))],
          s(p, "suffix") && ["suffix", ctx.str(s(p, "suffix"))],
        ]),
      };
    },
  },
};
