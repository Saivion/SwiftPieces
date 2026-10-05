// Plan Row: one planned thing in a day, on its own soft card: a round badge with a symbol (tinted
// in the SwiftPieces way, or pastel), the title, when it happens, and a check circle. Checking it
// off fills the circle, strikes the title through and fades the row, with a success tap. The theme
// card follows light and dark; the card presses in when it opens something.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { bool, icon, link, opts, select, text } from "../shared.js";
import { linkAction } from "./nav-action.js";
import { swiftHex, tint, tintHex } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");

/** A pastel for a badge: the tint lifted towards white (light rows) or kept deep (dark rows). */
export function badgeFill(id: string, dark: boolean): string {
  const hex = tintHex(id, "ember").replace("#", "");
  const mix = dark ? 0.35 : 0.72;
  const c = [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - mix) + 255 * mix));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const SWIFT = [
  "private struct PlanRow: View {",
  "    let title: String",
  "    var detail = \"\"",
  "    var symbol = \"sun.max\"",
  "    var badge: Color = .yellow",
  "    /// The badge in light mode when it differs (a pastel on the theme card).",
  "    var lightBadge: Color? = nil",
  "    var glyph: Color = Color.primary.opacity(0.8)",
  "    /// On the theme's card surface (light and dark); otherwise a plain white card.",
  "    var themed = false",
  "    /// False in a list that draws its own surface: no card of its own.",
  "    var card = true",
  "    var calendarIcon = false",
  "    var checkable = true",
  "    var action: (() -> Void)? = nil",
  "    @State var done = false",
  "    @Environment(\\.colorScheme) private var scheme",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "    @State private var taps = 0",
  "",
  "    private var dark: Bool { themed && scheme == .dark }",
  "",
  "    var body: some View {",
  "        HStack(spacing: 12) {",
  "            Button {",
  "                taps += 1",
  "                action?()",
  "            } label: {",
  "                HStack(spacing: 12) {",
  "                    Image(systemName: symbol)",
  "                        .font(.body)",
  "                        .foregroundStyle(glyph)",
  "                        .frame(width: 44, height: 44)",
  "                        .background(scheme == .light ? (lightBadge ?? badge) : badge, in: .circle)",
  "                    VStack(alignment: .leading, spacing: 2) {",
  "                        Text(title)",
  "                            .font(.headline)",
  "                            .strikethrough(done)",
  "                            .foregroundStyle(done ? .secondary : .primary)",
  "                            .lineLimit(1)",
  "                        if !detail.isEmpty {",
  "                            Label {",
  "                                Text(detail).monospacedDigit()",
  "                            } icon: {",
  "                                if calendarIcon { Image(systemName: \"calendar\") }",
  "                            }",
  "                            .font(.subheadline)",
  "                            .foregroundStyle(.secondary)",
  "                            .lineLimit(1)",
  "                        }",
  "                    }",
  "                    .frame(maxWidth: .infinity, alignment: .leading)",
  "                }",
  "                .contentShape(.rect)",
  "            }",
  "            .buttonStyle(PlanRowPress())",
  "            if checkable {",
  "                Button {",
  "                    withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .snappy(duration: 0.3)) { done.toggle() }",
  "                } label: {",
  "                    Image(systemName: done ? \"checkmark.circle.fill\" : \"circle\")",
  "                        .font(.title2)",
  "                        .foregroundStyle(done && themed ? Color(red: 1, green: 0, blue: 0) : Color.primary)",
  "                        .contentTransition(.symbolEffect(.replace))",
  "                        .frame(width: 44, height: 44)",
  "                }",
  "                .buttonStyle(.plain)",
  "            }",
  "        }",
  "        .padding(12)",
  "        .background(card ? (dark ? Color(red: 0.078, green: 0.078, blue: 0.086) : Color.white) : Color.clear, in: .rect(cornerRadius: 20, style: .continuous))",
  "        .overlay { if dark && card { RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.07)) } }",
  "        .shadow(color: .black.opacity(card ? (dark ? 0.4 : 0.06) : 0), radius: 8, y: 2)",
  "        .opacity(shown ? (done ? 0.75 : 1) : 0)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "        .sensoryFeedback(.success, trigger: done) { _, new in new }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "    }",
  "}",
  "",
  "private struct PlanRowPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: configuration.isPressed ? 0.12 : 0.2), value: configuration.isPressed)",
  "    }",
  "}",
];

export const planRow: SwiftPieceDefinition = {
  id: "plan-row",
  name: "Plan Row",
  category: "pieces",
  description: "A planned thing on a soft card: a pastel symbol badge, the title, when it happens, and a check circle that strikes it off with a success tap.",
  availability: "free",
  preview: { component: "plan-row", chunk: "app-pieces" },
  // In a list its card goes clear and its ink follows light and dark; it pads itself 12.
  list: { bare: { listed: true, surface: "dark" }, pad: 0, inset: 4 },
  card: () => 20,
  icon: "checkmark.circle.fill",
  concepts: ["state", "button"],
  anatomy: [
    { part: "Badge", props: ["symbol", "badge", "badgeStyle"] },
    { part: "Text", props: ["title", "detail", "calendarIcon"] },
    { part: "Check", props: ["checkable", "done"] },
    { part: "Surface", props: ["surface"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "toggle", "push", "spring", "haptic"],
  variants: [
    { id: "dark", label: "Theme card", props: { surface: "dark" } },
    { id: "light", label: "White card", props: { surface: "light", badgeStyle: "pastel" } },
    { id: "scheduled", label: "Scheduled", props: { surface: "dark", calendarIcon: true, checkable: false } },
  ],
  states: [
    { id: "open", label: "Open", props: { done: false } },
    { id: "done", label: "Done", props: { done: true } },
  ],
  properties: [
    text("title", "Title", "Stretch and coffee"),
    text("detail", "When", "7:30–7:45"),
    icon("symbol", "Symbol", "cup.and.saucer"),
    tint("badge", "Badge colour", "ember"),
    select("badgeStyle", "Badge style", "tinted", opts(["tinted", "Tinted"], ["pastel", "Pastel"]), { hint: "Tinted: the colour at low strength behind a symbol in that colour. Pastel: a soft solid disc." }),
    select("surface", "Card", "dark", opts(["dark", "Theme (light and dark)"], ["light", "White"]), { hint: "Theme sits on the SwiftPieces card surface in light and dark and checks off in signal red." }),
    bool("calendarIcon", "Calendar icon", false),
    bool("checkable", "Check circle", true),
    bool("done", "Done", false, { when: { prop: "checkable", equals: [true] } }),
    link(),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("PlanRow", SWIFT);
      const dark = s(p, "surface") !== "light";
      const act = linkAction(ctx, p.link);
      return {
        lines: call("PlanRow", [
          ["title", ctx.str(s(p, "title"))],
          s(p, "detail").trim() && ["detail", ctx.str(s(p, "detail").trim())],
          ["symbol", ctx.str(ctx.symbol(s(p, "symbol") || "sun.max"))],
          ["badge", s(p, "badgeStyle") === "pastel" ? swiftHex(badgeFill(s(p, "badge"), dark)) : swiftHex(tintHex(s(p, "badge"), "ember"), 0.2)],
          dark && s(p, "badgeStyle") === "pastel" && ["lightBadge", swiftHex(badgeFill(s(p, "badge"), false))],
          s(p, "badgeStyle") !== "pastel" && ["glyph", swiftHex(tintHex(s(p, "badge"), "ember"))],
          dark && ["themed", "true"],
          p.listed === true && ["card", "false"],
          p.calendarIcon === true && ["calendarIcon", "true"],
          p.checkable === false && ["checkable", "false"],
          act && ["action", `{ ${act} }`],
          p.checkable !== false && p.done === true && ["done", "true"],
        ]),
      };
    },
  },
};
