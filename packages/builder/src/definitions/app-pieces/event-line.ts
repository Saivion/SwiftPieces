// Event Line: one calendar entry marked by a coloured capsule, with its time under the title. Plain
// in a list, on a card of the theme's surface, or as a compact all-day chip. As a to-do the capsule
// is in the text colour and tapping it fills it with a check and strikes the title; as an event,
// tapping opens it. Cards press in, plain lines dim.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { bool, link, opts, select, text } from "../shared.js";
import { swiftTint, tint } from "./data-kit.js";
import { linkAction } from "./nav-action.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");

const SWIFT = [
  "private struct EventLine: View {",
  "    let title: String",
  "    var detail = \"\"",
  "    var tint: Color = .blue",
  "    var style = \"plain\"",
  "    var todo = false",
  "    var action: (() -> Void)? = nil",
  "    @State var done = false",
  "    @Environment(\\.colorScheme) private var scheme",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "    @State private var taps = 0",
  "",
  "    var body: some View {",
  "        Button {",
  "            if todo { withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .snappy(duration: 0.3)) { done.toggle() } }",
  "            else { taps += 1; action?() }",
  "        } label: {",
  "            content",
  "        }",
  "        .buttonStyle(EventLinePress(card: style != \"plain\"))",
  "        .opacity(shown ? 1 : 0)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "        .sensoryFeedback(.success, trigger: done) { _, new in new }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "    }",
  "",
  "    private var content: some View {",
  "        HStack(spacing: 12) {",
  "            ZStack {",
  "                Capsule().fill(todo && !done ? Color.primary : tint)",
  "                if todo && done {",
  "                    Image(systemName: \"checkmark\").font(.caption2.weight(.heavy)).foregroundStyle(.white)",
  "                }",
  "            }",
  "            .frame(width: todo && done ? 20 : style == \"chip\" ? 10 : 8, height: style == \"chip\" ? 16 : detail.isEmpty ? 24 : 36)",
  "            VStack(alignment: .leading, spacing: 2) {",
  "                Text(title)",
  "                    .font(style == \"chip\" ? .body : .headline)",
  "                    .strikethrough(done)",
  "                    .lineLimit(1)",
  "                if !detail.isEmpty {",
  "                    Text(detail).font(.footnote).monospacedDigit().foregroundStyle(.secondary).lineLimit(1)",
  "                }",
  "            }",
  "            if style != \"chip\" { Spacer(minLength: 0) }",
  "        }",
  "        .foregroundStyle(.primary)",
  "        .padding(.horizontal, style == \"plain\" ? 0 : 16)",
  "        .padding(.vertical, style == \"plain\" ? 0 : style == \"chip\" ? 8 : 16)",
  "        .background {",
  "            if style != \"plain\" {",
  "                RoundedRectangle(cornerRadius: style == \"chip\" ? 20 : 16, style: .continuous)",
  "                    .fill(scheme == .dark ? Color(red: 0.078, green: 0.078, blue: 0.086) : .white)",
  "                    .shadow(color: .black.opacity(scheme == .dark ? 0 : 0.05), radius: 2, y: 1)",
  "            }",
  "        }",
  "        .contentShape(.rect)",
  "    }",
  "}",
  "",
  "/// Cards and chips press in to 0.97; a plain line dims, like a row highlight.",
  "private struct EventLinePress: ButtonStyle {",
  "    let card: Bool",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(card && configuration.isPressed ? 0.97 : 1)",
  "            .opacity(!card && configuration.isPressed ? 0.6 : 1)",
  "            .animation(.easeOut(duration: configuration.isPressed ? 0.12 : 0.2), value: configuration.isPressed)",
  "    }",
  "}",
];

export const eventLine: SwiftPieceDefinition = {
  id: "event-line",
  name: "Event Line",
  category: "pieces",
  description: "A calendar entry marked by a coloured capsule, plain, on a card or as an all-day chip. As a to-do, tapping fills the capsule with a check.",
  availability: "free",
  preview: { component: "event-line", chunk: "app-pieces" },
  // In a list it's a plain line (no card or chip of its own).
  list: { bare: { style: "plain" } },
  icon: "calendar",
  concepts: ["state", "hstack"],
  anatomy: [
    { part: "Text", props: ["title", "detail"] },
    { part: "Capsule", props: ["tint", "todo", "done"] },
    { part: "Surface", props: ["style"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "toggle", "push", "spring", "haptic"],
  variants: [
    { id: "plain", label: "In a list", props: { style: "plain" } },
    { id: "card", label: "Card", props: { style: "card" } },
    { id: "chip", label: "All-day chip", props: { style: "chip", detail: "", title: "Nadia away" } },
    { id: "todo", label: "To-do", props: { style: "card", todo: true, detail: "", title: "Return library books" } },
  ],
  states: [{ id: "done", label: "Done", props: { todo: true, done: true } }],
  properties: [
    text("title", "Title", "Studio visit"),
    text("detail", "Time", "2:00–3:30 PM"),
    tint("tint", "Colour", "ember"),
    select("style", "Style", "plain", opts(["plain", "Plain"], ["card", "Card"], ["chip", "Chip"])),
    bool("todo", "To-do", false, { hint: "A capsule in the text colour you tap to check off." }),
    bool("done", "Done", false, { when: { prop: "todo", equals: [true] } }),
    link(),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("EventLine", SWIFT);
      const todo = p.todo === true;
      const act = todo ? null : linkAction(ctx, p.link);
      return {
        lines: call("EventLine", [
          ["title", ctx.str(s(p, "title"))],
          s(p, "detail").trim() && ["detail", ctx.str(s(p, "detail").trim())],
          ["tint", swiftTint(s(p, "tint"), "ember")],
          s(p, "style") !== "plain" && ["style", ctx.str(s(p, "style"))],
          todo && ["todo", "true"],
          act && ["action", `{ ${act} }`],
          todo && p.done === true && ["done", "true"],
        ]),
      };
    },
  },
};
