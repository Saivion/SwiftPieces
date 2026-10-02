// Focus Steps: instructions read one step at a time. The current step is set large in full ink and
// the rest fade back, so a glance from the stove finds your place. Tap a step, or swipe up and down,
// to move the focus; each move is a selection tick. The focused step's number can light up in
// signal red, so the eye finds its place even faster.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";
import { data } from "./data-kit.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Steps are separated by semicolons (commas belong to the sentences). */
export function focusSteps(value: unknown, max = 12): string[] {
  return String(value ?? "").split(";").map((x) => x.trim()).filter(Boolean).slice(0, max);
}

export const FOCUS_SIZES: Record<string, { label: string; size: number; swift: string }> = {
  body: { label: "Body", size: 17, swift: ".body" },
  large: { label: "Large", size: 20, swift: ".title3" },
  huge: { label: "Huge", size: 24, swift: ".title2" },
};

const DEFAULT_STEPS = "Heat the oven to 220 °C and line a tray with baking paper.; Cut the squash into wedges, toss them with oil, salt and the chilli flakes, and roast for 30 minutes, turning once.; While it roasts, stir the yoghurt with the lemon zest and a pinch of salt.; Spoon the yoghurt onto a plate, pile the squash on top and finish with toasted seeds.";

const VIEW = [
  "private struct FocusSteps: View {",
  "    var heading = \"\"",
  "    let steps: [String]",
  "    @Binding var current: Int",
  "    var numbered = true",
  "    var textStyle: Font = .title3",
  "    var signal = true",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    var body: some View {",
  "        ScrollViewReader { proxy in",
  "            ScrollView {",
  "                VStack(alignment: .leading, spacing: 36) {",
  "                    if !heading.isEmpty {",
  "                        Text(heading)",
  "                            .font(.title2.weight(.semibold))",
  "                            .foregroundStyle(.tertiary)",
  "                    }",
  "                    ForEach(steps.indices, id: \\.self) { index in",
  "                        step(index)",
  "                            .id(index)",
  "                    }",
  "                }",
  "                .padding(.vertical, 24)",
  "            }",
  "            .scrollIndicators(.hidden)",
  "            .onChange(of: current) { _, value in",
  "                withAnimation(reduceMotion ? nil : .snappy(duration: 0.3)) { proxy.scrollTo(value, anchor: .center) }",
  "            }",
  "        }",
  "        .opacity(shown ? 1 : 0)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95, anchor: .top)",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "        .sensoryFeedback(.selection, trigger: current)",
  "    }",
  "",
  "    private func step(_ index: Int) -> some View {",
  "        let focused = index == current",
  "        let number = Text(numbered ? \"\\(index + 1)  \" : \"\")",
  "            .fontWeight(focused && signal ? .bold : nil)",
  "            .foregroundStyle(focused && signal ? AnyShapeStyle(Color(red: 1, green: 0, blue: 0)) : AnyShapeStyle(.tertiary))",
  "        return Text(\"\\(number)\\(steps[index])\")",
  "        .font(textStyle)",
  "        .lineSpacing(10)",
  "        .opacity(focused ? 1 : 0.28)",
  "        .scaleEffect(focused ? 1 : 0.97, anchor: .leading)",
  "        .frame(maxWidth: .infinity, alignment: .leading)",
  "        .contentShape(Rectangle())",
  "        .onTapGesture {",
  "            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .snappy(duration: 0.3)) { current = index }",
  "        }",
  "        .accessibilityAddTraits(focused ? .isSelected : [])",
  "    }",
  "}",
];

export const focusStepsPiece: SwiftPieceDefinition = {
  id: "focus-steps",
  name: "Focus Steps",
  category: "pieces",
  description: "Step-by-step instructions with one step in focus and the rest faded back. Tap or swipe to move through them.",
  availability: "free",
  preview: { component: "focus-steps", chunk: "app-pieces" },
  icon: "list.bullet",
  concepts: ["state", "binding", "scrollview"],
  anatomy: [
    { part: "Heading", props: ["heading"] },
    { part: "Steps", props: ["steps", "numbered", "size"] },
    { part: "Focus", props: ["current", "marker"] },
  ],
  interactions: ["tap", "swipe", "scroll", "haptic"],
  variants: [
    { id: "cooking", label: "Cooking", props: { heading: "Roasting the squash", steps: DEFAULT_STEPS, numbered: true, size: "large", current: 1 } },
    { id: "setup", label: "Setup guide", props: { heading: "Set up your speaker", steps: "Plug the speaker in and wait for the light to pulse.; Hold the top button until you hear a chime.; Open the app and pick the speaker from the list.; Name the room it lives in.", numbered: true, size: "body", current: 0 } },
  ],
  states: [
    { id: "first", label: "First step", props: { current: 0 } },
    { id: "last", label: "Last step", props: { current: 3 } },
  ],
  properties: [
    text("heading", "Heading", "Roasting the squash", { maxLength: 60, hint: "Faded title above the steps. Leave empty for none." }),
    data("steps", "Steps", DEFAULT_STEPS, { hint: "Separate steps with semicolons." }),
    number("current", "In focus", 1, 0, 11, 1, { group: "state" }),
    bool("numbered", "Numbers", true),
    select("marker", "Focus marker", "signal", opts(["signal", "Signal number"], ["plain", "Plain"]), { hint: "Signal lights the focused step's number in red.", when: { prop: "numbered", equals: [true] } }),
    select("size", "Text size", "large", opts(...Object.entries(FOCUS_SIZES).map(([id, v]): [string, string] => [id, v.label])), { group: "typography" }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("FocusSteps", VIEW);
      const steps = focusSteps(p.steps);
      const cur = Math.max(0, Math.min(steps.length - 1, Math.round(n(p, "current"))));
      const state = ctx.state("current step", "Int", num(cur));
      const size = FOCUS_SIZES[s(p, "size")] ?? FOCUS_SIZES.large;
      return {
        lines: call("FocusSteps", [
          s(p, "heading").trim() && ["heading", ctx.str(s(p, "heading").trim())],
          ["steps", `[${steps.map((x) => ctx.str(x)).join(", ")}]`],
          ["current", `$${state}`],
          !b(p, "numbered") && ["numbered", "false"],
          size.swift !== ".title3" && ["textStyle", size.swift],
          s(p, "marker") === "plain" && ["signal", "false"],
        ]),
      };
    },
  },
};
