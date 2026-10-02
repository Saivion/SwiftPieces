// Glass Bar: a screen's top bar the way iOS 26 draws it. Liquid Glass controls on each side (a back
// chevron, a close, icon buttons, a text or menu pill, a Done, an avatar) and the title centred on
// the screen, whatever sits beside it: the title and the controls are stacked (a ZStack), so a back
// button on one side and two buttons on the other never pull the title off centre. Every control
// leads somewhere (push, sheet, back or root). Emitted inline; the glass is iOS 26's `glassEffect`,
// a frosted material before it.
import type { EmitContext, Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, str } from "../../core/swift.js";
import { glassButtonStyle, icon, link, opts, select, tappable, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");

export const LEADING = ["none", "back", "close", "icon", "text", "menu", "avatar"] as const;
export const TRAILING = ["none", "icon", "two", "text", "menu", "done", "avatar"] as const;

/** How wide a side's controls are, in points: so the title keeps clear of the wider side. */
export function sideWidth(kind: string, label: string): number {
  if (kind === "none") return 0;
  if (kind === "two") return 96;
  if (kind === "text" || kind === "menu" || kind === "done") return Math.min(140, 32 + Math.ceil(label.length * 8.6) + (kind === "menu" ? 14 : 0));
  return 44;
}

/** The title's inset from each edge: the wider side's controls and a gap, never less than one button. */
export const titleInset = (p: Props) => Math.max(52, 8 + Math.max(sideWidth(s(p, "leading"), s(p, "leadingText")), sideWidth(s(p, "trailing"), s(p, "trailingText"))));

/** One glass control: its label, where a tap goes, and whether it keeps the accent (Done) or reads as chrome. */
function control(ctx: EmitContext, kind: string, opt: { icon: string; label: string; link: unknown; initials: string }): string[] {
  const glass = (label: string[], circle: boolean, accent = false) => modifiers(tappable(ctx, opt.link, label, str(opt.label || opt.icon || "Button")), [glassButtonStyle(ctx, circle), !accent && "tint(.primary)"]);
  switch (kind) {
    case "back":
      return glass([`Image(systemName: "chevron.left")`], true);
    case "close":
      return glass([`Image(systemName: "xmark")`], true);
    case "icon":
      return glass([`Image(systemName: ${str(ctx.symbol(opt.icon))})`], true);
    case "text":
      return glass([`Text(${str(opt.label)})`], false);
    case "menu":
      return glass(call("HStack", [["spacing", "4"]], [`Text(${str(opt.label)})`, ...modifiers([`Image(systemName: "chevron.down")`], ["font(.caption.weight(.bold))"])]), false);
    case "done":
      return glass([`Text(${str(opt.label || "Done")})`], false, true);
    case "avatar": {
      const face = modifiers([`Text(${str(opt.initials.trim().slice(0, 3) || "AK")})`], ["font(.subheadline.weight(.semibold))", "foregroundStyle(.primary)", "frame(width: 36, height: 36)", "background(.fill.secondary, in: .circle)"]);
      return ctx.link(String(opt.link ?? "")) ? modifiers(tappable(ctx, opt.link, face, str("Profile")), ["buttonStyle(.plain)"]) : face;
    }
    default:
      return [];
  }
}

export const glassBar: SwiftPieceDefinition = {
  id: "glass-bar",
  name: "Glass Bar",
  category: "pieces",
  description: "A top bar in iOS 26's Liquid Glass: glass buttons on each side and the title centred on the screen, whatever sits beside it. Every button leads somewhere.",
  availability: "free",
  preview: { component: "glass-bar", chunk: "app-pieces" },
  icon: "rectangle.stack",
  concepts: ["navigation", "state"],
  anatomy: [
    { part: "Title", props: ["title"] },
    { part: "Leading", props: ["leading", "leadingIcon", "leadingText", "leadingLink"] },
    { part: "Trailing", props: ["trailing", "trailingIcon", "trailingIcon2", "trailingText", "trailingLink", "trailingLink2", "initials"] },
  ],
  interactions: ["tap", "push", "sheet"],
  variants: [
    { id: "detail", label: "Back and a button", props: { title: "Details", leading: "back", trailing: "icon", trailingIcon: "ellipsis" } },
    { id: "sheet", label: "Close and Done", props: { title: "New entry", leading: "close", trailing: "done", trailingText: "Done" } },
    { id: "menu", label: "A menu in the middle", props: { title: "", leading: "icon", leadingIcon: "list.bullet", trailing: "two", trailingIcon: "magnifyingglass", trailingIcon2: "bell" } },
  ],
  properties: [
    text("title", "Title", "Details", { maxLength: 40 }),
    select("leading", "Leading", "back", opts(["none", "Nothing"], ["back", "Back"], ["close", "Close"], ["icon", "Icon button"], ["text", "Text button"], ["menu", "Menu pill"], ["avatar", "Avatar"])),
    icon("leadingIcon", "Leading icon", "list.bullet", { when: { prop: "leading", equals: ["icon"] } }),
    text("leadingText", "Leading text", "Edit", { maxLength: 16, when: { prop: "leading", equals: ["text", "menu"] } }),
    link("leadingLink", "Leading leads to", { when: { prop: "leading", notEquals: ["none"] } }),
    select("trailing", "Trailing", "icon", opts(["none", "Nothing"], ["icon", "Icon button"], ["two", "Two icon buttons"], ["text", "Text button"], ["menu", "Menu pill"], ["done", "Done"], ["avatar", "Avatar"])),
    icon("trailingIcon", "Trailing icon", "ellipsis", { when: { prop: "trailing", equals: ["icon", "two"] } }),
    icon("trailingIcon2", "Second icon", "square.and.arrow.up", { when: { prop: "trailing", equals: ["two"] } }),
    text("trailingText", "Trailing text", "Done", { maxLength: 16, when: { prop: "trailing", equals: ["text", "menu", "done"] } }),
    link("trailingLink", "Trailing leads to", { when: { prop: "trailing", notEquals: ["none"] } }),
    link("trailingLink2", "Second icon leads to", { when: { prop: "trailing", equals: ["two"] } }),
    text("initials", "Avatar initials", "AK", { maxLength: 3 }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const leading = s(p, "leading");
      const trailing = s(p, "trailing");
      const lead = control(ctx, leading, { icon: s(p, "leadingIcon"), label: s(p, "leadingText"), link: p.leadingLink, initials: s(p, "initials") });
      const trail =
        trailing === "two"
          ? call("HStack", [["spacing", "8"]], [
              ...control(ctx, "icon", { icon: s(p, "trailingIcon"), label: "", link: p.trailingLink, initials: "" }),
              ...control(ctx, "icon", { icon: s(p, "trailingIcon2"), label: "", link: p.trailingLink2, initials: "" }),
            ])
          : control(ctx, trailing, { icon: s(p, "trailingIcon"), label: s(p, "trailingText"), link: p.trailingLink, initials: s(p, "initials") });
      const title = s(p, "title").trim();
      const row = call("HStack", [["spacing", "8"]], [...lead, "Spacer(minLength: 8)", ...trail]);
      // The title over the whole width, kept clear of the wider side, so it sits on the screen's centre.
      const body = title
        ? call("ZStack", [], [...modifiers([`Text(${str(title)})`], ["font(.headline)", "lineLimit(1)", `padding(.horizontal, ${titleInset(p)})`]), ...row])
        : row;
      return { lines: modifiers(body, ["frame(maxWidth: .infinity, minHeight: 44)"]) };
    },
  },
};
