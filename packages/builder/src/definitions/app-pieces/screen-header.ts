// Screen Header: the header every SwiftPieces Pro screen opens with, in place of the system
// navigation bar's large title. A small eyebrow ("For you · Thursday"), a title in two weights
// ("Recipes based on / your pantry", "Budget / September"), and up to two round icon buttons or
// the mascot on the trailing edge. Every button leads somewhere (push, sheet, back or root) and
// dips with a light haptic when pressed. Emitted inline, so its buttons are real NavigationLinks.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, indent, INDENT, str } from "../../core/swift.js";
import { glassButtonStyle, icon, link, number, opts, select, tappable, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** How the emphasis reads against the lead: heavier, the accent, or quieter (a second line in grey). */
export const EMPHASIS = ["bold", "accent", "muted"] as const;

const BUTTON_STYLE = [
  "private struct HeaderIconButtonStyle: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .font(.system(size: 17, weight: .semibold))",
  "            .foregroundStyle(.primary)",
  "            .frame(width: 44, height: 44)",
  "            .background(.fill.tertiary, in: .circle)",
  "            .overlay { Circle().strokeBorder(.white.opacity(0.08)) }",
  "            .scaleEffect(configuration.isPressed ? 0.88 : 1)",
  "            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)",
  "            .sensoryFeedback(.impact(weight: .light), trigger: configuration.isPressed) { _, pressed in pressed }",
  "    }",
  "}",
];

export const screenHeader: SwiftPieceDefinition = {
  id: "screen-header",
  name: "Screen Header",
  category: "pieces",
  description: "A screen's opening header: an eyebrow, a title in two weights, and round icon buttons that lead somewhere with a light haptic. Use it in place of the navigation bar title.",
  availability: "free",
  preview: { component: "screen-header", chunk: "app-pieces" },
  icon: "textformat",
  concepts: ["navigation", "state"],
  anatomy: [
    { part: "Eyebrow", props: ["eyebrow"] },
    { part: "Title", props: ["title", "emphasis", "emphasisStyle", "stacked", "leadWeight", "size", "subtitle"] },
    { part: "Trailing", props: ["trailing", "buttons", "icon", "buttonText", "link", "icon2", "link2", "initials"] },
  ],
  interactions: ["tap", "push", "sheet", "haptic"],
  variants: [
    { id: "pantry", label: "Two weights", props: { eyebrow: "For you · Thursday", title: "Recipes based on", emphasis: "your pantry", stacked: "yes", trailing: "avatar", initials: "AK", link: "back" } },
    { id: "month", label: "Quiet second line", props: { eyebrow: "", title: "Budget", emphasis: "September", emphasisStyle: "muted", stacked: "yes", trailing: "icon", icon: "gearshape" } },
    { id: "library", label: "Bold over quiet", props: { eyebrow: "", title: "Library", emphasis: "On rotation", emphasisStyle: "muted", leadWeight: "bold", trailing: "icon", icon: "magnifyingglass" } },
    { id: "wallet", label: "Two buttons", props: { eyebrow: "", title: "Wallet", emphasis: "", trailing: "two", icon: "bell", icon2: "paperplane", size: 30 } },
    { id: "glass", label: "Liquid Glass buttons", props: { eyebrow: "Today", title: "Journal", emphasis: "", trailing: "two", buttons: "glass", icon: "magnifyingglass", icon2: "plus", size: 34, leadWeight: "bold" } },
    { id: "text-button", label: "Text button", props: { eyebrow: "", title: "Library", emphasis: "", subtitle: "Everything you saved, in one place.", trailing: "text", buttons: "glass", icon: "plus", buttonText: "Create", size: 32, leadWeight: "bold" } },
  ],
  properties: [
    text("eyebrow", "Eyebrow", "For you · Thursday", { maxLength: 60 }),
    text("title", "Title", "Recipes based on", { maxLength: 60 }),
    text("emphasis", "Emphasis", "your pantry", { maxLength: 60, hint: "Follows the title in the emphasis style; empty for a one-weight title." }),
    select("emphasisStyle", "Emphasis", "bold", opts(["bold", "Bold"], ["accent", "Accent"], ["muted", "Quiet"])),
    select("stacked", "Emphasis on its own line", "yes", opts(["yes", "Yes"], ["no", "No"])),
    select("leadWeight", "Title weight", "regular", opts(["regular", "Regular"], ["bold", "Bold"]), { hint: "Bold with a quiet emphasis reads like \"Library / On rotation\"." }),
    number("size", "Title size", 32, 24, 44),
    text("subtitle", "Subtitle", "", { maxLength: 120, hint: "A quiet line under the title." }),
    select("trailing", "Trailing", "icon", opts(["none", "Nothing"], ["icon", "One button"], ["two", "Two buttons"], ["text", "Text button"], ["avatar", "Avatar"])),
    select("buttons", "Buttons", "fill", opts(["fill", "Soft fill"], ["glass", "Liquid Glass"]), { when: { prop: "trailing", equals: ["icon", "two", "text"] }, hint: "Liquid Glass draws iOS 26's glass (a frosted material before it)." }),
    icon("icon", "Button", "plus"),
    text("buttonText", "Button text", "Create", { maxLength: 24, when: { prop: "trailing", equals: ["text"] }, hint: "The text button's words; its icon, if any, goes before them." }),
    link("link", "Button or avatar leads to"),
    icon("icon2", "Second button", "ellipsis"),
    link("link2", "Second button leads to"),
    text("initials", "Avatar initials", "AK", { maxLength: 3 }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const size = n(p, "size") || 32;
      const lead = s(p, "title").trim();
      const emph = s(p, "emphasis").trim();
      // Style → Headers: bold sets the whole title in one bold weight; centered centres it.
      const headers = ctx.theme?.headers ?? "split";
      if (headers === "bold") p = { ...p, emphasisStyle: "bold", leadWeight: "bold" };
      const centered = headers === "centered";
      const sub = s(p, "subtitle").trim();
      const style = (EMPHASIS as readonly string[]).includes(s(p, "emphasisStyle")) ? s(p, "emphasisStyle") : "bold";
      const gap = s(p, "stacked") === "no" ? " " : "\\n";
      const emphText =
        style === "accent" ? `Text(${str(emph)}).fontWeight(.bold).foregroundStyle(.tint)`
        : style === "muted" ? `Text(${str(emph)}).foregroundStyle(.secondary)`
        : `Text(${str(emph)}).fontWeight(.bold)`;
      // Inside the outer literal, so escaped exactly as str() escapes (quotes, backslashes, newlines).
      const leadText = s(p, "leadWeight") === "bold" ? `\\(Text(${str(lead)}).fontWeight(.bold))` : str(lead).slice(1, -1);
      const titleLine = emph
        ? `Text("${leadText}${gap}\\(${emphText})")`
        : `Text(${str(lead)})${style === "muted" ? "" : ".fontWeight(.bold)"}`;
      const left = [
        `VStack(alignment: ${centered ? ".center" : ".leading"}, spacing: 6) {`,
        ...(s(p, "eyebrow").trim() ? [`${INDENT}Text(${str(s(p, "eyebrow").trim())})`, `${INDENT}${INDENT}.font(.subheadline.weight(.medium))`, `${INDENT}${INDENT}.foregroundStyle(.secondary)`] : []),
        `${INDENT}${titleLine}`,
        `${INDENT}${INDENT}.font(.system(size: ${size}, weight: ${style === "muted" || emph ? ".regular" : ".bold"}))`,
        `${INDENT}${INDENT}.tracking(-0.4)`,
        // A word wider than the room beside the buttons (a wide display font, a large text size)
        // shrinks to fit rather than running under them or breaking mid-word, as the preview does.
        `${INDENT}${INDENT}.lineLimit(${emph && gap !== " " ? 2 : 3})`,
        `${INDENT}${INDENT}.minimumScaleFactor(0.6)`,
        ...(centered && sub ? [`${INDENT}Text(${str(sub)})`, `${INDENT}${INDENT}.font(.subheadline)`, `${INDENT}${INDENT}.foregroundStyle(.secondary)`] : []),
        "}",
        ...(centered ? [`${INDENT}.multilineTextAlignment(.center)`] : []),
      ];
      const trailing = s(p, "trailing");
      const glass = s(p, "buttons") === "glass";
      const button = (iconId: string, linkValue: unknown) => {
        const tap = tappable(ctx, linkValue, [`Image(systemName: ${str(ctx.symbol(iconId))})`], str(iconId));
        if (glass) return [...tap, `${INDENT}.${glassButtonStyle(ctx, true)}`, `${INDENT}.tint(.primary)`];
        ctx.declare("HeaderIconButtonStyle", BUTTON_STYLE);
        return [...tap, `${INDENT}.buttonStyle(HeaderIconButtonStyle())`];
      };
      // A capsule with words (and the icon before them, if any): glass, or a soft bordered capsule.
      const textButton = () => {
        const words = s(p, "buttonText").trim() || "Create";
        const iconId = s(p, "icon");
        const label = iconId && iconId !== "none" ? call("HStack", [["spacing", "4"]], [`Image(systemName: ${str(ctx.symbol(iconId))})`, `Text(${str(words)})`]) : [`Text(${str(words)})`];
        const tap = tappable(ctx, p.link, label, str(words));
        return glass ? [...tap, `${INDENT}.${glassButtonStyle(ctx, false)}`, `${INDENT}.tint(.primary)`] : [...tap, `${INDENT}.buttonStyle(.bordered)`, `${INDENT}.buttonBorderShape(.capsule)`, `${INDENT}.tint(.primary)`];
      };
      const right =
        trailing === "text" ? textButton()
        : trailing === "icon" ? button(s(p, "icon") || "plus", p.link)
        : trailing === "two" ? ["HStack(spacing: 10) {", ...indent(button(s(p, "icon") || "plus", p.link)), ...indent(button(s(p, "icon2") || "ellipsis", p.link2)), "}"]
        : trailing === "avatar" ? (() => {
            const face = [
              `Text(${str(s(p, "initials").trim().slice(0, 3) || "AK")})`,
              `${INDENT}.font(.subheadline.weight(.semibold))`,
              `${INDENT}.foregroundStyle(.primary)`,
              `${INDENT}.frame(width: 44, height: 44)`,
              `${INDENT}.background(.fill.secondary, in: .circle)`,
            ];
            if (!ctx.link(s(p, "link"))) return face;
            ctx.declare("HeaderIconButtonStyle", BUTTON_STYLE);
            return [...tappable(ctx, p.link, face, str("Profile")), `${INDENT}.buttonStyle(.plain)`];
          })()
        : [];
      if (centered) {
        // Centred on the screen. One round button sits in the top trailing corner, with its width
        // reserved on both sides so the title stays centred and clear of it. Wider trailing content
        // (two buttons, a text button) gets its own row above the title instead: centred text in the
        // space beside it would run under the buttons at larger fonts and sizes.
        const wide = trailing === "two" || trailing === "text";
        if (right.length && wide) {
          return { lines: call("VStack", [["spacing", "8"]], [...call("HStack", [], ["Spacer()", ...right]), ...left, `${INDENT}.frame(maxWidth: .infinity)`]) };
        }
        const body = [...left, `${INDENT}.frame(maxWidth: .infinity)`, ...(right.length ? [`${INDENT}.padding(.horizontal, 52)`] : [])];
        return { lines: right.length ? call("ZStack", [["alignment", ".topTrailing"]], [...body, ...right]) : body };
      }
      const row = call("HStack", [["alignment", ".top"], ["spacing", "12"]], [...left, ...(right.length ? ["Spacer(minLength: 12)", ...right] : [])]);
      // The subtitle runs under the whole row, the width of the screen, not squeezed beside a button.
      const lines = sub ? call("VStack", [["alignment", ".leading"], ["spacing", "6"]], [...row, `Text(${str(sub)})`, `${INDENT}.font(.subheadline)`, `${INDENT}.foregroundStyle(.secondary)`]) : row;
      return { lines: [...lines, `${INDENT}.frame(maxWidth: .infinity, alignment: .leading)`] };
    },
  },
};
