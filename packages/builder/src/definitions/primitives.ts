// Native SwiftUI building blocks. These need no SwiftPieces source file: the export is plain SwiftUI
// that compiles in a fresh Xcode project. Each definition keeps its properties and its SwiftUI side
// by side, and the web renderer for the same id (react/preview/primitives.tsx) reads the same props.
import { groundEntry } from "../core/palette.js";
import type { EmitContext, Props, SwiftPieceDefinition } from "../core/schema.js";
import { call, indent, list, modifiers, num, str } from "../core/swift.js";
import { bool, color, frameAlignment, ground, hAlign, icon, number, opts, select, spacing, text, textStyleOptions, weightOptions } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** `.foregroundStyle(...)` for a palette color, or nothing for the default. */
function fg(ctx: EmitContext, id: string, skip = "primary"): string | null {
  return id && id !== skip ? `foregroundStyle(${ctx.style(id)})` : null;
}

export const screen: SwiftPieceDefinition = {
  id: "screen",
  name: "Screen",
  category: "layout",
  description: "The whole iPhone screen. Everything you add stacks top to bottom inside it.",
  availability: "free",
  hidden: true,
  preview: { component: "screen" },
  container: {},
  concepts: ["view", "vstack", "scrollview", "modifier"],
  properties: [
    text("title", "Navigation title", "", { hint: "Shows a large title bar. Leave empty for none.", maxLength: 40 }),
    select("appearance", "Appearance", "system", opts(["system", "Automatic"], ["dark", "Dark"], ["light", "Light"]), { hint: "Automatic follows the device's setting." }),
    ground("background", "Background", "system"),
    bool("scrolls", "Scrolls", true, { hint: "Lets content taller than the screen scroll." }),
    select("alignment", "Align content", "center", hAlign),
    spacing("spacing", "Spacing", 16),
    spacing("padding", "Padding", 24),
    select("position", "Vertical position", "center", opts(["top", "Top"], ["center", "Center"]), { level: "advanced", when: { prop: "scrolls", equals: [false] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const alignment = s(p, "alignment");
      const children = ctx.children().flat();
      let content = call("VStack", [alignment !== "center" && ["alignment", `.${alignment}`], ["spacing", num(n(p, "spacing"))]], children);
      if (b(p, "scrolls")) {
        content = modifiers(content, [alignment !== "center" && `frame(maxWidth: .infinity, alignment: .${alignment})`, n(p, "padding") > 0 && `padding(${num(n(p, "padding"))})`]);
        content = call("ScrollView", [], content);
      } else {
        const vertical = s(p, "position") === "top" ? "top" : "center";
        content = modifiers(content, [
          n(p, "padding") > 0 && `padding(${num(n(p, "padding"))})`,
          `frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .${frameAlignment(vertical, alignment)})`,
        ]);
      }
      const bg = groundEntry(s(p, "background")).swift;
      if (bg) content = modifiers(content, [`background(${bg})`]);
      if (s(p, "title").trim()) {
        content = modifiers(content, [`navigationTitle(${str(s(p, "title").trim())})`]);
        content = call("NavigationStack", [], content);
      }
      const appearance = s(p, "appearance");
      if (appearance === "dark" || appearance === "light") content = modifiers(content, [`preferredColorScheme(.${appearance})`]);
      return { lines: content };
    },
  },
};

const stackProps = (defaultSpacing: number) => [
  spacing("spacing", "Spacing", defaultSpacing),
  select("style", "Style", "plain", opts(["plain", "Plain"], ["card", "Card"], ["outlined", "Outlined"])),
  spacing("padding", "Padding", 16, 40, { when: { prop: "style", equals: ["card", "outlined"] } }),
  number("radius", "Corner radius", 16, 0, 40, 1, { when: { prop: "style", equals: ["card", "outlined"] } }),
];

/** Card and outline treatment shared by the stacks and the Card component. */
function surface(lines: string[], p: Props, alignment: string): string[] {
  const style = s(p, "style");
  if (style !== "card" && style !== "outlined") return lines;
  const r = num(n(p, "radius"));
  return modifiers(lines, [
    n(p, "padding") > 0 && `padding(${num(n(p, "padding"))})`,
    `frame(maxWidth: .infinity, alignment: .${alignment})`,
    style === "card" ? `background(.fill.tertiary, in: .rect(cornerRadius: ${r}))` : `overlay { RoundedRectangle(cornerRadius: ${r}).strokeBorder(.quaternary) }`,
  ]);
}

export const vstack: SwiftPieceDefinition = {
  id: "vstack",
  name: "Vertical Stack",
  category: "layout",
  description: "Stacks components top to bottom. Like a flex column.",
  availability: "free",
  preview: { component: "vstack" },
  container: {},
  concepts: ["vstack", "modifier"],
  properties: [select("alignment", "Alignment", "leading", hAlign), ...stackProps(12)],
  swift: {
    imports: [],
    emit(p, ctx) {
      const a = s(p, "alignment");
      const lines = call("VStack", [a !== "center" && ["alignment", `.${a}`], ["spacing", num(n(p, "spacing"))]], ctx.children().flat());
      return { lines: surface(lines, p, a) };
    },
  },
};

export const hstack: SwiftPieceDefinition = {
  id: "hstack",
  name: "Horizontal Stack",
  category: "layout",
  description: "Places components side by side. Like a flex row.",
  availability: "free",
  preview: { component: "hstack" },
  container: {},
  concepts: ["hstack", "modifier"],
  properties: [select("alignment", "Alignment", "center", opts(["top", "Top"], ["center", "Center"], ["bottom", "Bottom"])), ...stackProps(12)],
  swift: {
    imports: [],
    emit(p, ctx) {
      const a = s(p, "alignment");
      const lines = call("HStack", [a !== "center" && ["alignment", `.${a}`], ["spacing", num(n(p, "spacing"))]], ctx.children().flat());
      return { lines: surface(lines, p, "leading") };
    },
  },
};

export const spacer: SwiftPieceDefinition = {
  id: "spacer",
  name: "Spacer",
  category: "layout",
  description: "Flexible space that pushes neighbours apart, or a fixed gap.",
  availability: "free",
  preview: { component: "spacer" },
  concepts: ["spacer"],
  properties: [select("mode", "Size", "flexible", opts(["flexible", "Flexible"], ["fixed", "Fixed height"])), number("height", "Height", 24, 4, 200, 1, { when: { prop: "mode", equals: ["fixed"] } })],
  swift: {
    imports: [],
    emit(p) {
      return { lines: modifiers(["Spacer()"], [s(p, "mode") === "fixed" && `frame(height: ${num(n(p, "height"))})`]) };
    },
  },
};

export const divider: SwiftPieceDefinition = {
  id: "divider",
  name: "Divider",
  category: "layout",
  description: "A thin separator line.",
  availability: "free",
  preview: { component: "divider" },
  properties: [],
  swift: { imports: [], emit: () => ({ lines: ["Divider()"] }) },
};

export const textDef: SwiftPieceDefinition = {
  id: "text",
  name: "Text",
  category: "content",
  description: "A heading, a paragraph or a caption.",
  availability: "free",
  preview: { component: "text" },
  concepts: ["text", "modifier"],
  variants: [
    { id: "heading", label: "Heading", props: { style: "largeTitle", weight: "bold" } },
    { id: "body", label: "Paragraph", props: { style: "body", weight: "default", color: "secondary" } },
    { id: "caption", label: "Caption", props: { style: "footnote", weight: "default", color: "secondary" } },
  ],
  properties: [
    text("text", "Text", "Hello, world", { maxLength: 400 }),
    select("style", "Style", "body", textStyleOptions),
    select("weight", "Weight", "default", weightOptions),
    color("color", "Color", "primary"),
    select("alignment", "Alignment", "leading", hAlign, { hint: "How lines line up when the text wraps." }),
    select("design", "Design", "default", opts(["default", "Default"], ["rounded", "Rounded"], ["serif", "Serif"], ["monospaced", "Monospaced"]), { level: "advanced" }),
    number("lineLimit", "Line limit", 0, 0, 10, 1, { level: "advanced", hint: "0 means no limit." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      return {
        lines: modifiers([`Text(${str(s(p, "text"))})`], [
          s(p, "style") !== "body" && `font(.${s(p, "style")})`,
          s(p, "weight") !== "default" && `fontWeight(.${s(p, "weight")})`,
          s(p, "design") !== "default" && `fontDesign(.${s(p, "design")})`,
          fg(ctx, s(p, "color")),
          s(p, "alignment") !== "leading" && `multilineTextAlignment(.${s(p, "alignment")})`,
          n(p, "lineLimit") > 0 && `lineLimit(${num(n(p, "lineLimit"))})`,
        ]),
      };
    },
  },
};

export const symbol: SwiftPieceDefinition = {
  id: "symbol",
  name: "Icon",
  category: "content",
  description: "An SF Symbol, the icon set built into every Apple device.",
  availability: "free",
  preview: { component: "symbol" },
  concepts: ["sfsymbol", "modifier"],
  properties: [
    icon("icon", "Icon", "sparkles"),
    number("size", "Size", 44, 12, 160),
    color("color", "Color", "accent"),
    select("badge", "Background", "none", opts(["none", "None"], ["circle", "Circle"], ["rounded", "Rounded square"])),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const badge = s(p, "badge");
      const size = n(p, "size");
      const tint = s(p, "color");
      if (badge === "none") return { lines: modifiers([`Image(systemName: ${str(ctx.symbol(s(p, "icon")))})`], [`font(.system(size: ${num(size)}))`, fg(ctx, tint)]) };
      const box = Math.round(size * 1.9);
      return {
        lines: modifiers([`Image(systemName: ${str(ctx.symbol(s(p, "icon")))})`], [
          `font(.system(size: ${num(size)}))`,
          fg(ctx, tint),
          `frame(width: ${box}, height: ${box})`,
          `background(Color${ctx.color(tint)}.opacity(0.15), in: ${badge === "circle" ? ".circle" : `.rect(cornerRadius: ${Math.round(box * 0.28)})`})`,
        ]),
      };
    },
  },
};

export const button: SwiftPieceDefinition = {
  id: "button",
  name: "Button",
  category: "controls",
  description: "A native SwiftUI button: filled, tinted or plain.",
  availability: "free",
  preview: { component: "button" },
  concepts: ["button", "modifier", "closure"],
  variants: [
    { id: "primary", label: "Primary", props: { style: "filled", size: "large", fullWidth: true } },
    { id: "secondary", label: "Secondary", props: { style: "tinted", size: "large", fullWidth: true } },
    { id: "link", label: "Link", props: { style: "plain", size: "small", fullWidth: false } },
  ],
  properties: [
    text("title", "Text", "Continue", { maxLength: 40 }),
    select("style", "Style", "filled", opts(["filled", "Filled"], ["tinted", "Tinted"], ["plain", "Plain"])),
    select("size", "Size", "large", opts(["small", "Small"], ["regular", "Regular"], ["large", "Large"])),
    icon("icon", "Icon", "none"),
    select("iconPosition", "Icon position", "leading", opts(["leading", "Before text"], ["trailing", "After text"]), { when: { prop: "icon", notEquals: ["none"] } }),
    bool("fullWidth", "Full width", true),
    color("tint", "Color", "accent"),
    select("shape", "Shape", "automatic", opts(["automatic", "Automatic"], ["capsule", "Capsule"], ["rounded", "Rounded"]), { level: "advanced" }),
    number("radius", "Corner radius", 12, 0, 30, 1, { level: "advanced", when: { prop: "shape", equals: ["rounded"] } }),
    bool("disabled", "Disabled", false, { level: "advanced" }),
    bool("loading", "Loading", false, { level: "advanced", hint: "Shows a spinner instead of the text." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const title = str(s(p, "title"));
      const ic = s(p, "icon");
      const full = b(p, "fullWidth");
      let label: string[] | null = null;
      if (b(p, "loading")) label = ["ProgressView()"];
      else if (ic !== "none" && s(p, "iconPosition") === "trailing") label = call("HStack", [["spacing", "6"]], [`Text(${title})`, `Image(systemName: ${str(ic)})`]);
      else if (ic !== "none") label = [`Label(${title}, systemImage: ${str(ic)})`];
      else if (full) label = [`Text(${title})`];
      if (label && full) label = modifiers(label, ["frame(maxWidth: .infinity)"]);
      const head = label ? call("Button", [["action", "{}"]], label) : [`Button(${title}) {}`];
      const style = s(p, "style");
      const shape = s(p, "shape");
      return {
        lines: modifiers(head, [
          `buttonStyle(.${style === "filled" ? "borderedProminent" : style === "tinted" ? "bordered" : "borderless"})`,
          s(p, "size") !== "regular" && `controlSize(.${s(p, "size")})`,
          style !== "plain" && shape === "capsule" && "buttonBorderShape(.capsule)",
          style !== "plain" && shape === "rounded" && `buttonBorderShape(.roundedRectangle(radius: ${num(n(p, "radius"))}))`,
          s(p, "tint") !== "accent" && `tint(${ctx.color(s(p, "tint"))})`,
          b(p, "disabled") && "disabled(true)",
        ]),
      };
    },
  },
};

export const appleSignIn: SwiftPieceDefinition = {
  id: "apple-sign-in",
  name: "Sign in with Apple",
  category: "controls",
  description: "Apple's own sign-in button from AuthenticationServices.",
  availability: "free",
  preview: { component: "apple-sign-in" },
  concepts: ["framework", "closure"],
  properties: [
    select("label", "Label", "signIn", opts(["signIn", "Sign in with Apple"], ["signUp", "Sign up with Apple"], ["continue", "Continue with Apple"])),
    select("style", "Style", "white", opts(["black", "Black"], ["white", "White"], ["whiteOutline", "White outline"])),
    number("height", "Height", 50, 32, 64),
    number("radius", "Corner radius", 12, 0, 32),
  ],
  swift: {
    imports: ["AuthenticationServices"],
    emit(p, ctx) {
      ctx.import("AuthenticationServices");
      const head = call("SignInWithAppleButton", [[null, `.${s(p, "label")}`]], ["request.requestedScopes = [.fullName, .email]"]);
      head[0] = head[0].replace(/ \{$/, " { request in");
      const lines = [...head.slice(0, -1), "} onCompletion: { result in", indent(["// Handle the credential in result."])[0], "}"];
      return {
        lines: modifiers(lines, [`signInWithAppleButtonStyle(.${s(p, "style")})`, `frame(height: ${num(n(p, "height"))})`, n(p, "radius") > 0 && `clipShape(.rect(cornerRadius: ${num(n(p, "radius"))}))`]),
      };
    },
  },
};

export const input: SwiftPieceDefinition = {
  id: "input",
  name: "Text Field",
  category: "inputs",
  description: "A text or password field with an optional label and icon.",
  availability: "free",
  preview: { component: "input" },
  concepts: ["state", "binding", "textfield", "modifier"],
  variants: [
    { id: "email", label: "Email", props: { label: "Email", placeholder: "you@example.com", icon: "envelope", content: "email", secure: false } },
    { id: "password", label: "Password", props: { label: "Password", placeholder: "Password", icon: "lock", content: "password", secure: true } },
  ],
  properties: [
    text("label", "Label", "Email", { maxLength: 40, hint: "Shown above the field. Leave empty to hide." }),
    text("placeholder", "Placeholder", "you@example.com", { maxLength: 60 }),
    icon("icon", "Icon", "none"),
    bool("secure", "Secure (password)", false),
    select("content", "Content", "email", opts(["none", "Anything"], ["email", "Email"], ["name", "Name"], ["username", "Username"], ["password", "Password"], ["phone", "Phone number"], ["url", "Web address"])),
    number("radius", "Corner radius", 12, 0, 28, 1, { level: "advanced" }),
    bool("disabled", "Disabled", false, { level: "advanced" }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const secure = b(p, "secure");
      const binding = ctx.state(s(p, "label") || s(p, "placeholder") || (secure ? "password" : "text"), "", '""');
      const content = s(p, "content");
      const field = modifiers([`${secure ? "SecureField" : "TextField"}(${str(s(p, "placeholder"))}, text: $${binding})`], [
        content === "email" && "textContentType(.emailAddress)",
        content === "email" && "keyboardType(.emailAddress)",
        content === "name" && "textContentType(.name)",
        content === "username" && "textContentType(.username)",
        content === "password" && "textContentType(.password)",
        content === "phone" && "textContentType(.telephoneNumber)",
        content === "phone" && "keyboardType(.phonePad)",
        content === "url" && "textContentType(.URL)",
        content === "url" && "keyboardType(.URL)",
        (content === "email" || content === "username" || content === "url") && "textInputAutocapitalization(.never)",
      ]);
      const ic = s(p, "icon");
      const box = ic !== "none" ? call("HStack", [["spacing", "10"]], [...modifiers([`Image(systemName: ${str(ic)})`], ["foregroundStyle(.secondary)"]), ...field]) : field;
      let lines = modifiers(box, ["padding(14)", `background(.fill.tertiary, in: .rect(cornerRadius: ${num(n(p, "radius"))}))`, b(p, "disabled") && "disabled(true)"]);
      if (s(p, "label").trim()) {
        lines = call("VStack", [["alignment", ".leading"], ["spacing", "6"]], [...modifiers([`Text(${str(s(p, "label").trim())})`], ["font(.subheadline)", "foregroundStyle(.secondary)"]), ...lines]);
      }
      return { lines };
    },
  },
};

export const toggle: SwiftPieceDefinition = {
  id: "toggle",
  name: "Toggle",
  category: "inputs",
  description: "An on/off switch with a label.",
  availability: "free",
  preview: { component: "toggle" },
  concepts: ["state", "binding"],
  properties: [text("label", "Label", "Notifications", { maxLength: 40 }), bool("isOn", "Starts on", true), color("tint", "Color", "green")],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state(s(p, "label") || "isOn", "", b(p, "isOn") ? "true" : "false");
      return { lines: modifiers([`Toggle(${str(s(p, "label"))}, isOn: $${name})`], [s(p, "tint") !== "green" && `tint(${ctx.color(s(p, "tint"))})`]) };
    },
  },
};

export const segmented: SwiftPieceDefinition = {
  id: "segmented",
  name: "Segmented Control",
  category: "inputs",
  description: "Two to five options in one control, one selected at a time.",
  availability: "free",
  preview: { component: "segmented" },
  concepts: ["state", "binding", "foreach"],
  properties: [text("options", "Options", "Day, Week, Month", { hint: "Separate options with commas." }), number("selected", "Selected", 0, 0, 4), text("label", "Accessibility label", "Range", { level: "advanced" })],
  swift: {
    imports: [],
    emit(p, ctx) {
      const items = list(p.options, 5);
      const safe = items.length ? items : ["One", "Two"];
      const sel = Math.min(Math.max(0, n(p, "selected")), safe.length - 1);
      const name = ctx.state(s(p, "label") || "selection", "", String(sel));
      const body = safe.map((o, i) => `Text(${str(o)}).tag(${i})`);
      return { lines: modifiers(call("Picker", [[null, str(s(p, "label") || "Selection")], ["selection", `$${name}`]], body), ["pickerStyle(.segmented)"]) };
    },
  },
};

export const row: SwiftPieceDefinition = {
  id: "row",
  name: "List Row",
  category: "content",
  description: "A settings-style row: icon, title, value and a chevron or switch.",
  availability: "free",
  preview: { component: "row" },
  concepts: ["hstack", "spacer"],
  properties: [
    icon("icon", "Icon", "bell"),
    color("iconColor", "Icon color", "red"),
    text("title", "Title", "Notifications", { maxLength: 40 }),
    text("value", "Value", "", { maxLength: 30, when: { prop: "accessory", equals: ["chevron", "none"] } }),
    select("accessory", "Accessory", "chevron", opts(["chevron", "Chevron"], ["toggle", "Switch"], ["none", "None"])),
    bool("isOn", "Switch starts on", true, { when: { prop: "accessory", equals: ["toggle"] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const children: string[] = [];
      if (s(p, "icon") !== "none") {
        children.push(...modifiers([`Image(systemName: ${str(s(p, "icon"))})`], ["font(.body.weight(.medium))", "foregroundStyle(.white)", "frame(width: 30, height: 30)", `background(${ctx.style(s(p, "iconColor"))}, in: .rect(cornerRadius: 7))`]));
      }
      if (s(p, "accessory") === "toggle") {
        const name = ctx.state(s(p, "title") || "isOn", "", b(p, "isOn") ? "true" : "false");
        children.push(`Toggle(${str(s(p, "title"))}, isOn: $${name})`);
      } else {
        children.push(`Text(${str(s(p, "title"))})`, "Spacer()");
        if (s(p, "value").trim()) children.push(...modifiers([`Text(${str(s(p, "value").trim())})`], ["foregroundStyle(.secondary)"]));
        if (s(p, "accessory") === "chevron") children.push(...modifiers(['Image(systemName: "chevron.right")'], ["font(.footnote.weight(.semibold))", "foregroundStyle(.tertiary)"]));
      }
      return { lines: modifiers(call("HStack", [["spacing", "12"]], children), ["padding(.vertical, 6)"]) };
    },
  },
};

export const card: SwiftPieceDefinition = {
  id: "card",
  name: "Card",
  category: "content",
  description: "A rounded card with an icon, a title, a line of detail and an optional action.",
  availability: "free",
  preview: { component: "card" },
  concepts: ["vstack", "modifier"],
  properties: [
    icon("icon", "Icon", "sparkles"),
    text("title", "Title", "Weekly summary", { maxLength: 60 }),
    text("subtitle", "Subtitle", "Your progress, goals and streaks at a glance.", { maxLength: 160 }),
    text("action", "Action", "Open", { maxLength: 30, hint: "Leave empty for no button." }),
    color("tint", "Color", "accent"),
    select("style", "Style", "card", opts(["card", "Filled"], ["outlined", "Outlined"])),
    spacing("padding", "Padding", 20, 40),
    number("radius", "Corner radius", 20, 0, 40),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const tint = s(p, "tint");
      const inner: string[] = [];
      if (s(p, "icon") !== "none") inner.push(...modifiers([`Image(systemName: ${str(s(p, "icon"))})`], ["font(.title2)", `foregroundStyle(${ctx.style(tint)})`]));
      if (s(p, "title").trim()) inner.push(...modifiers([`Text(${str(s(p, "title"))})`], ["font(.headline)"]));
      if (s(p, "subtitle").trim()) inner.push(...modifiers([`Text(${str(s(p, "subtitle"))})`], ["font(.subheadline)", "foregroundStyle(.secondary)"]));
      if (s(p, "action").trim()) inner.push(...modifiers([`Button(${str(s(p, "action").trim())}) {}`], ["padding(.top, 4)", tint !== "accent" && `tint(${ctx.color(tint)})`]));
      const lines = call("VStack", [["alignment", ".leading"], ["spacing", "8"]], inner);
      return { lines: surface(lines, p, "leading") };
    },
  },
};

export const primitives: SwiftPieceDefinition[] = [screen, vstack, hstack, spacer, divider, textDef, symbol, card, row, button, appleSignIn, input, toggle, segmented];

