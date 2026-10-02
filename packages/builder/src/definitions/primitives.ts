// Native SwiftUI building blocks. These need no SwiftPieces source file: the export is plain SwiftUI
// that compiles in a fresh Xcode project. Each definition keeps its properties and its SwiftUI side
// by side, and the web renderer for the same id (react/preview/primitives.tsx) reads the same props
// and behaves like the SwiftUI: buttons dip, switches flip, fields take typing, links navigate.
import { groundEntry, swiftRGB } from "../core/palette.js";
import type { EmitContext, Props, SwiftPieceDefinition } from "../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../core/swift.js";
import { bool, color, CONTOUR_SWIFT, frameAlignment, glassButtonStyle, ground, hAlign, icon, link, number, opts, select, spacing, tappable, text, textStyleOptions, TONES, weightOptions } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** `.foregroundStyle(...)` for a palette color, or nothing for the default. */
function fg(ctx: EmitContext, id: string, skip = "primary"): string | null {
  return id && id !== skip ? `foregroundStyle(${ctx.style(id)})` : null;
}

/** Appends a multi-line modifier (`.toolbar { … }`) at the indent `modifiers` would give it. */
function attach(lines: string[], block: string[]): string[] {
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  return [...lines, ...block.map((l) => pad + l)];
}

export const screen: SwiftPieceDefinition = {
  id: "screen",
  name: "Screen",
  category: "layout",
  description: "The whole iPhone screen. Everything you add stacks from top to bottom.",
  availability: "free",
  hidden: true,
  preview: { component: "screen" },
  container: {},
  icon: "doc.text",
  concepts: ["view", "vstack", "scrollview", "navigation", "modifier"],
  anatomy: [
    { part: "Navigation bar", props: ["title", "toolbarIcon", "toolbarLink", "navigationBar", "tabBar"] },
    { part: "Content", props: ["alignment", "spacing", "padding", "position"] },
    { part: "Background", props: ["background", "appearance"] },
    { part: "Scrolling", props: ["scrolls", "refreshable"] },
    { part: "Presentation", props: ["detent"] },
  ],
  interactions: ["scroll", "pull", "push", "sheet"],
  properties: [
    text("title", "Navigation title", "", { hint: "Shows a large title bar. Leave empty for none.", maxLength: 40 }),
    select("appearance", "Appearance", "system", opts(["system", "Automatic"], ["dark", "Dark"], ["light", "Light"]), { hint: "Automatic follows the device's setting.", group: "color" }),
    ground("background", "Background", "system"),
    bool("scrolls", "Scrolls", true, { hint: "Lets content taller than the screen scroll." }),
    select("alignment", "Align content", "center", hAlign),
    spacing("spacing", "Spacing", 16),
    spacing("padding", "Padding", 24),
    select("position", "Vertical position", "center", opts(["top", "Top"], ["center", "Center"]), { level: "advanced", when: { prop: "scrolls", equals: [false] } }),
    select("detent", "As a sheet", "large", opts(["large", "Full height"], ["medium", "Half height"], ["both", "Half, drag to full"]), { level: "advanced", group: "interaction", hint: "How tall this screen is when another screen presents it as a sheet." }),
    bool("refreshable", "Pull to refresh", false, { group: "interaction", hint: "Pull down to refresh.", when: { prop: "scrolls", equals: [true] } }),
    icon("toolbarIcon", "Toolbar button", "none", { group: "interaction", hint: "An icon button at the top right of the navigation bar." }),
    link("toolbarLink", "Toolbar button opens", { when: { prop: "toolbarIcon", notEquals: ["none"] } }),
    select("navigationBar", "Navigation bar", "automatic", opts(["automatic", "Automatic"], ["hidden", "Hidden"]), { level: "advanced", group: "interaction", hint: "Hidden: no system bar, back button or title; for a screen that draws its own top bar." }),
    select("tabBar", "Tab bar", "automatic", opts(["automatic", "Automatic"], ["hidden", "Hidden"]), { level: "advanced", group: "interaction", hint: "Hidden: the tab bar steps away while this screen shows (a pushed detail, an editor)." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const alignment = s(p, "alignment");
      const children = ctx.children().flat();
      let content = call("VStack", [alignment !== "center" && ["alignment", `.${alignment}`], ["spacing", num(ctx.space(n(p, "spacing")))]], children);
      if (b(p, "scrolls")) {
        content = modifiers(content, [alignment !== "center" && `frame(maxWidth: .infinity, alignment: .${alignment})`, n(p, "padding") > 0 && `padding(${num(ctx.space(n(p, "padding")))})`]);
        content = call("ScrollView", [], content);
        // Pull to refresh: SwiftUI shows the spinner and waits for the closure to finish.
        if (b(p, "refreshable")) content = attach(content, [".refreshable {", `${INDENT}// Reload your data here.`, "}"]);
      } else {
        const vertical = s(p, "position") === "top" ? "top" : "center";
        content = modifiers(content, [
          n(p, "padding") > 0 && `padding(${num(ctx.space(n(p, "padding")))})`,
          `frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .${frameAlignment(vertical, alignment)})`,
        ]);
      }
      const bg = groundEntry(s(p, "background")).swift;
      // "System" means the app's own background: the look's, when the project has one.
      if (bg) content = modifiers(content, [`background(${bg})`]);
      else if (ctx.theme) content = modifiers(content, [ctx.theme.backdrop !== "none" ? "background { ThemeBackground() }" : "background(Theme.background)"]);
      // The NavigationStack lives in the app file (and the preview), so a pushed screen never
      // nests a second one. The screen only names itself.
      if (s(p, "title").trim()) content = modifiers(content, [`navigationTitle(${str(s(p, "title").trim())})`]);
      const tool = s(p, "toolbarIcon");
      if (tool && tool !== "none") {
        const button = tappable(ctx, p.toolbarLink, [`Image(systemName: ${str(ctx.symbol(tool))})`], str(tool));
        content = attach(content, [".toolbar {", `${INDENT}ToolbarItem(placement: .topBarTrailing) {`, ...indent(button, 2), `${INDENT}}`, "}"]);
      }
      // A screen that draws its own top bar, or wants the whole height, hides the system's bars.
      if (s(p, "navigationBar") === "hidden") content = modifiers(content, ["toolbar(.hidden, for: .navigationBar)"]);
      if (s(p, "tabBar") === "hidden") content = modifiers(content, ["toolbar(.hidden, for: .tabBar)"]);
      const appearance = s(p, "appearance");
      if (appearance === "dark" || appearance === "light") content = modifiers(content, [`preferredColorScheme(.${appearance})`]);
      return { lines: content };
    },
  },
};

const stackAnatomy = [
  { part: "Stack", props: ["alignment", "spacing"] },
  { part: "Surface", props: ["style", "padding", "radius", "tone", "texture"] },
];
const stackVariants: NonNullable<SwiftPieceDefinition["variants"]> = [
  { id: "plain", label: "Plain", props: { style: "plain" } },
  { id: "card", label: "Card", props: { style: "card", padding: 16, radius: 16 } },
  { id: "outlined", label: "Outlined", props: { style: "outlined", padding: 16, radius: 16 } },
  { id: "contour", label: "Contour card", props: { style: "card", padding: 24, radius: 32, tone: "peach", texture: "contour" } },
];

const stackProps = (defaultSpacing: number) => [
  spacing("spacing", "Spacing", defaultSpacing),
  select("style", "Style", "plain", opts(["plain", "Plain"], ["card", "Card"], ["outlined", "Outlined"]), { group: "shape", hint: "Card puts a soft fill behind the group; outlined draws a thin border." }),
  spacing("padding", "Padding", 16, 40, { when: { prop: "style", equals: ["card", "outlined"] } }),
  number("radius", "Corner radius", 16, 0, 40, 1, { when: { prop: "style", equals: ["card", "outlined"] } }),
  select("tone", "Card colour", "none", opts(["none", "Soft fill"], ...Object.entries(TONES).map(([k, t]): [string, string] => [k, t.label])), { when: { prop: "style", equals: ["card"] }, group: "shape", hint: "A pastel card with dark ink in light and dark." }),
  select("texture", "Texture", "none", opts(["none", "None"], ["contour", "Contour lines"]), { when: { prop: "style", equals: ["card"] }, group: "shape" }),
];

/** Card and outline treatment shared by the stacks and the Card component. */
function surface(lines: string[], p: Props, alignment: string, ctx: EmitContext): string[] {
  const style = s(p, "style");
  if (style !== "card" && style !== "outlined") return lines;
  const r = num(ctx.corner(n(p, "radius")));
  const tone = TONES[s(p, "tone")];
  const contour = style === "card" && s(p, "texture") === "contour";
  if (style === "card" && (tone || contour)) {
    // A toned or textured card: the fill (and contour lines) behind, clipped to the card; a toned
    // card keeps dark ink in both themes, so its contents read as light mode.
    if (contour) ctx.declare("ContourLines", CONTOUR_SWIFT);
    const fill = tone ? swiftRGB(tone.hex) : "Color(.tertiarySystemFill)";
    const back = contour ? `background { ZStack { ${fill}; ContourLines().stroke(Color.black.opacity(0.12), lineWidth: 1) }.clipShape(.rect(cornerRadius: ${r}, style: .continuous)) }` : `background(${fill}, in: .rect(cornerRadius: ${r}, style: .continuous))`;
    return modifiers(lines, [
      n(p, "padding") > 0 && `padding(${num(ctx.space(n(p, "padding")))})`,
      `frame(maxWidth: .infinity, alignment: .${alignment})`,
      back,
      tone && "environment(\\.colorScheme, .light)",
    ]);
  }
  return modifiers(lines, [
    n(p, "padding") > 0 && `padding(${num(ctx.space(n(p, "padding")))})`,
    `frame(maxWidth: .infinity, alignment: .${alignment})`,
    // A plain card in a themed app takes Style's card treatment (Theme.swift's themeCard).
    style === "card" ? (ctx.theme ? `themeCard(cornerRadius: ${r})` : `background(.fill.tertiary, in: .rect(cornerRadius: ${r}))`) : `overlay { RoundedRectangle(cornerRadius: ${r}).strokeBorder(.quaternary) }`,
  ]);
}

export const vstack: SwiftPieceDefinition = {
  id: "vstack",
  name: "Group",
  category: "layout",
  description: "Keeps things together, one under another.",
  availability: "free",
  preview: { component: "vstack" },
  container: {},
  icon: "rectangle.stack",
  concepts: ["vstack", "modifier"],
  anatomy: stackAnatomy,
  variants: stackVariants,
  properties: [select("alignment", "Alignment", "leading", hAlign), ...stackProps(12)],
  swift: {
    imports: [],
    emit(p, ctx) {
      const a = s(p, "alignment");
      const lines = call("VStack", [a !== "center" && ["alignment", `.${a}`], ["spacing", num(ctx.space(n(p, "spacing")))]], ctx.children().flat());
      return { lines: surface(lines, p, a, ctx) };
    },
  },
};

export const hstack: SwiftPieceDefinition = {
  id: "hstack",
  name: "Side by Side",
  category: "layout",
  description: "Puts things next to each other in a row.",
  availability: "free",
  preview: { component: "hstack" },
  container: { axis: "h" },
  icon: "square.grid.2x2",
  concepts: ["hstack", "modifier"],
  anatomy: stackAnatomy,
  variants: stackVariants,
  properties: [select("alignment", "Alignment", "center", opts(["top", "Top"], ["center", "Center"], ["bottom", "Bottom"])), ...stackProps(12)],
  swift: {
    imports: [],
    emit(p, ctx) {
      const a = s(p, "alignment");
      const lines = call("HStack", [a !== "center" && ["alignment", `.${a}`], ["spacing", num(ctx.space(n(p, "spacing")))]], ctx.children().flat());
      return { lines: surface(lines, p, "leading", ctx) };
    },
  },
};

export const spacer: SwiftPieceDefinition = {
  id: "spacer",
  name: "Space",
  category: "layout",
  description: "Empty space that pushes things apart, or a fixed gap.",
  availability: "free",
  preview: { component: "spacer" },
  icon: "arrow.down",
  concepts: ["spacer", "frame"],
  anatomy: [{ part: "Size", props: ["mode", "height"] }],
  variants: [
    { id: "flexible", label: "Flexible", props: { mode: "flexible" } },
    { id: "small", label: "Small gap", props: { mode: "fixed", height: 16 } },
    { id: "large", label: "Large gap", props: { mode: "fixed", height: 48 } },
  ],
  properties: [
    select("mode", "Size", "flexible", opts(["flexible", "Flexible"], ["fixed", "Fixed height"]), { group: "layout", hint: "Flexible takes all the free space; fixed is an exact gap." }),
    number("height", "Height", 24, 4, 200, 1, { when: { prop: "mode", equals: ["fixed"] } }),
  ],
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
  description: "A thin line between things.",
  availability: "free",
  preview: { component: "divider" },
  icon: "minus",
  concepts: ["view"],
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
  icon: "textformat",
  concepts: ["text", "font", "foreground", "modifier"],
  anatomy: [
    { part: "Content", props: ["text"] },
    { part: "Type", props: ["style", "weight", "design"] },
    { part: "Color", props: ["color"] },
    { part: "Layout", props: ["alignment", "lineLimit"] },
  ],
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
    number("tracking", "Letter spacing", 0, -2, 6, 0.1, { level: "advanced", hint: "Extra space between letters, in points; spaced capitals for a label read well at 1.5." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      return {
        lines: modifiers([`Text(${str(s(p, "text"))})`], [
          n(p, "tracking") !== 0 && `tracking(${num(n(p, "tracking"))})`,
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
  description: "An icon from the set built into every iPhone.",
  availability: "free",
  preview: { component: "symbol" },
  icon: "star",
  concepts: ["sfsymbol", "foreground", "background", "modifier"],
  anatomy: [
    { part: "Symbol", props: ["icon", "size"] },
    { part: "Color", props: ["color"] },
    { part: "Background", props: ["badge"] },
  ],
  variants: [
    { id: "plain", label: "Plain", props: { badge: "none", size: 44 } },
    { id: "circle", label: "In a circle", props: { badge: "circle", size: 28 } },
    { id: "tile", label: "App tile", props: { badge: "rounded", size: 28 } },
  ],
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
  description: "A button people tap: filled, tinted, plain or Liquid Glass.",
  availability: "free",
  preview: { component: "button" },
  icon: "arrow.right",
  concepts: ["button", "buttonstyle", "closure", "navigation"],
  anatomy: [
    { part: "Label", props: ["title"] },
    { part: "Icon", props: ["icon", "iconPosition"] },
    { part: "Background", props: ["style", "tint", "size", "fullWidth", "shape", "radius"] },
    { part: "Interaction", props: ["link", "disabled", "loading"] },
  ],
  interactions: ["tap", "press", "push", "sheet", "loading", "haptic"],
  states: [
    { id: "normal", label: "Normal", props: { disabled: false, loading: false } },
    { id: "loading", label: "Loading", props: { disabled: false, loading: true } },
    { id: "disabled", label: "Disabled", props: { disabled: true, loading: false } },
  ],
  variants: [
    { id: "primary", label: "Primary", props: { style: "filled", size: "large", fullWidth: true } },
    { id: "secondary", label: "Secondary", props: { style: "tinted", size: "large", fullWidth: true } },
    { id: "link", label: "Link", props: { style: "plain", size: "small", fullWidth: false } },
    { id: "glass", label: "Glass", props: { style: "glass", title: "", icon: "ellipsis", fullWidth: false, tint: "primary" } },
  ],
  properties: [
    text("title", "Text", "Continue", { maxLength: 40 }),
    link(),
    select("style", "Style", "filled", opts(["filled", "Filled"], ["tinted", "Tinted"], ["plain", "Plain"], ["glass", "Glass"]), { hint: "Glass is iOS 26's Liquid Glass: a circle around an icon on its own, a capsule around text." }),
    select("size", "Size", "large", opts(["small", "Small"], ["regular", "Regular"], ["large", "Large"])),
    icon("icon", "Icon", "none"),
    select("iconPosition", "Icon position", "leading", opts(["leading", "Before text"], ["trailing", "After text"]), { when: { prop: "icon", notEquals: ["none"] } }),
    bool("fullWidth", "Full width", true),
    color("tint", "Color", "accent"),
    select("shape", "Shape", "automatic", opts(["automatic", "Automatic"], ["capsule", "Capsule"], ["rounded", "Rounded"]), { level: "advanced" }),
    number("radius", "Corner radius", 12, 0, 30, 1, { level: "advanced", when: { prop: "shape", equals: ["rounded"] } }),
    bool("disabled", "Disabled", false, { level: "advanced", hint: "Greyed out and ignores taps." }),
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
      const style = s(p, "style");
      if (style === "glass") {
        // Liquid Glass: an icon on its own sits in a circle, anything with text in a capsule.
        const circle = !s(p, "title").trim() && ic !== "none" && !b(p, "loading");
        // `label` already fills the width when the button does.
        const glassLabel = circle ? [`Image(systemName: ${str(ic)})`] : (label ?? [`Text(${title})`]);
        return {
          lines: modifiers(tappable(ctx, p.link, glassLabel, title), [
            glassButtonStyle(ctx, circle),
            s(p, "tint") !== "accent" && `tint(${ctx.color(s(p, "tint"))})`,
            b(p, "disabled") && "disabled(true)",
          ]),
        };
      }
      const head = tappable(ctx, p.link, label, title);
      const shape = s(p, "shape");
      return {
        lines: modifiers(head, [
          `buttonStyle(.${style === "filled" ? "borderedProminent" : style === "tinted" ? "bordered" : "borderless"})`,
          s(p, "size") !== "regular" && `controlSize(.${s(p, "size")})`,
          style !== "plain" && (shape === "capsule" || (shape === "automatic" && ctx.theme?.corners === "soft")) && "buttonBorderShape(.capsule)",
          style !== "plain" && shape === "rounded" && `buttonBorderShape(.roundedRectangle(radius: ${num(ctx.corner(n(p, "radius")))}))`,
          style !== "plain" && shape === "automatic" && ctx.theme?.corners === "tight" && `buttonBorderShape(.roundedRectangle(radius: ${num(ctx.corner(12))}))`,
          s(p, "tint") !== "accent" && `tint(${ctx.color(s(p, "tint"))})`,
          // A look's accent can be light (lime, butter): its own ink keeps the label readable.
          ctx.theme && style === "filled" && s(p, "tint") === "accent" && "foregroundStyle(Theme.accentInk)",
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
  description: "Apple's own sign-in button.",
  availability: "free",
  preview: { component: "apple-sign-in" },
  icon: "person.crop.circle.fill",
  concepts: ["framework", "import", "closure"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Style", props: ["style"] },
    { part: "Shape", props: ["height", "radius"] },
  ],
  interactions: ["tap", "press"],
  variants: [
    { id: "white", label: "White", props: { style: "white", label: "signIn" } },
    { id: "black", label: "Black", props: { style: "black", label: "continue" } },
    { id: "outline", label: "Outline", props: { style: "whiteOutline", label: "signUp", radius: 25 } },
  ],
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
  description: "A box people type into, like an email or a password.",
  availability: "free",
  preview: { component: "input" },
  icon: "pencil",
  concepts: ["state", "binding", "textfield", "modifier"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Field", props: ["placeholder", "icon", "radius"] },
    { part: "Keyboard", props: ["content", "secure"] },
    { part: "State", props: ["disabled"] },
  ],
  interactions: ["type"],
  variants: [
    { id: "email", label: "Email", props: { label: "Email", placeholder: "you@example.com", icon: "envelope", content: "email", secure: false } },
    { id: "password", label: "Password", props: { label: "Password", placeholder: "Password", icon: "lock", content: "password", secure: true } },
    { id: "name", label: "Name", props: { label: "Name", placeholder: "Your name", icon: "person", content: "name", secure: false } },
  ],
  states: [
    { id: "enabled", label: "Enabled", props: { disabled: false } },
    { id: "disabled", label: "Disabled", props: { disabled: true } },
  ],
  properties: [
    text("label", "Label", "Email", { maxLength: 40, hint: "Shown above the field. Leave empty to hide." }),
    text("placeholder", "Placeholder", "you@example.com", { maxLength: 60 }),
    icon("icon", "Icon", "none"),
    bool("secure", "Secure (password)", false, { hint: "Hides what you type behind dots." }),
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
  name: "Switch",
  category: "inputs",
  description: "An on and off switch with a label.",
  availability: "free",
  preview: { component: "toggle" },
  icon: "checkmark.circle.fill",
  concepts: ["state", "binding"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Switch", props: ["isOn", "tint"] },
  ],
  interactions: ["toggle", "haptic"],
  variants: [
    { id: "green", label: "Green", props: { tint: "green" } },
    { id: "accent", label: "Accent", props: { tint: "accent" } },
    { id: "orange", label: "Orange", props: { tint: "orange" } },
  ],
  states: [
    { id: "on", label: "On", props: { isOn: true } },
    { id: "off", label: "Off", props: { isOn: false } },
  ],
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
  description: "Two to five options side by side. One is picked at a time.",
  availability: "free",
  preview: { component: "segmented" },
  icon: "slider.horizontal.3",
  concepts: ["state", "binding", "foreach"],
  anatomy: [
    { part: "Options", props: ["options"] },
    { part: "Selection", props: ["selected"] },
    { part: "Accessibility", props: ["label"] },
  ],
  interactions: ["select", "haptic"],
  variants: [
    { id: "range", label: "Day, Week, Month", props: { options: "Day, Week, Month", selected: 0, label: "Range" } },
    { id: "two", label: "Two options", props: { options: "List, Grid", selected: 0, label: "Layout" } },
    { id: "chart", label: "Chart ranges", props: { options: "1D, 1W, 1M, 1Y, All", selected: 2, label: "Range" } },
  ],
  properties: [text("options", "Options", "Day, Week, Month", { hint: "Separate options with commas." }), number("selected", "Selected", 0, 0, 4, 1, { hint: "0 is the first option." }), text("label", "Accessibility label", "Range", { level: "advanced", hint: "What VoiceOver reads for the control." })],
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
  description: "A row like in Settings: an icon, a title and an arrow or a switch.",
  availability: "free",
  preview: { component: "row" },
  // Already bare; its own 6pt padding plus the list's 4 makes a Settings-height row.
  list: { pad: 4 },
  icon: "list.bullet",
  concepts: ["hstack", "spacer", "navigation"],
  anatomy: [
    { part: "Icon", props: ["icon", "iconColor"] },
    { part: "Text", props: ["title", "value"] },
    { part: "Accessory", props: ["accessory", "isOn"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "push", "toggle"],
  variants: [
    { id: "navigate", label: "Opens a page", props: { accessory: "chevron", value: "" } },
    { id: "switch", label: "Switch", props: { accessory: "toggle", isOn: true } },
    { id: "value", label: "With a value", props: { icon: "globe", iconColor: "blue", title: "Language", value: "English", accessory: "chevron" } },
  ],
  properties: [
    icon("icon", "Icon", "bell"),
    color("iconColor", "Icon color", "red"),
    text("title", "Title", "Notifications", { maxLength: 40 }),
    text("value", "Value", "", { maxLength: 30, group: "content", hint: "Grey detail on the right, like the current setting.", when: { prop: "accessory", equals: ["chevron", "none"] } }),
    select("accessory", "Accessory", "chevron", opts(["chevron", "Chevron"], ["toggle", "Switch"], ["none", "None"])),
    bool("isOn", "Switch starts on", true, { when: { prop: "accessory", equals: ["toggle"] } }),
    link("link", "On tap", { when: { prop: "accessory", notEquals: ["toggle"] } }),
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
      const rowLines = modifiers(call("HStack", [["spacing", "12"]], children), ["padding(.vertical, 6)"]);
      const target = s(p, "accessory") === "toggle" ? null : ctx.link(s(p, "link"));
      if (!target) return { lines: rowLines };
      // A linked row is one big tap target that keeps its own colors.
      const tap = tappable(ctx, p.link, modifiers(rowLines, ["contentShape(.rect)"]), str(s(p, "title")));
      return { lines: modifiers(tap, ["buttonStyle(.plain)"]) };
    },
  },
};

export const card: SwiftPieceDefinition = {
  id: "card",
  name: "Card",
  category: "content",
  description: "A rounded card with an icon, a title, a line of detail and an optional action; or a tile with its figure, for a grid.",
  availability: "free",
  preview: { component: "card" },
  icon: "bookmark",
  concepts: ["vstack", "background", "clip", "modifier"],
  anatomy: [
    { part: "Layout", props: ["layout"] },
    { part: "Icon", props: ["icon", "tint"] },
    { part: "Text", props: ["title", "subtitle", "value", "titleColor"] },
    { part: "Action", props: ["action", "link"] },
    { part: "Surface", props: ["style", "padding", "radius"] },
  ],
  interactions: ["tap", "press", "push"],
  variants: [
    { id: "filled", label: "Filled", props: { style: "card", action: "Open" } },
    { id: "outlined", label: "Outlined", props: { style: "outlined", action: "Open" } },
    { id: "info", label: "No action", props: { style: "card", action: "" } },
    { id: "tile", label: "Tile", props: { layout: "tile", icon: "folder", title: "Projects", subtitle: "", value: "12", action: "", padding: 16 } },
    { id: "centered", label: "Centered", props: { layout: "center", icon: "heart", title: "Favorites", subtitle: "", action: "", padding: 16 } },
  ],
  properties: [
    select("layout", "Layout", "stack", opts(["stack", "Stacked"], ["tile", "Tile"], ["center", "Centered"]), { group: "layout", hint: "Tile: the icon on a tinted square with the figure across from it, the title at the foot. Centered: icon over title, in the middle." }),
    icon("icon", "Icon", "sparkles"),
    text("title", "Title", "Weekly summary", { maxLength: 60 }),
    text("subtitle", "Subtitle", "Your progress, goals and streaks at a glance.", { maxLength: 160 }),
    text("value", "Figure", "", { maxLength: 12, hint: "A count or a figure, across from the icon.", when: { prop: "layout", equals: ["tile"] } }),
    color("titleColor", "Title color", "primary"),
    text("action", "Action", "Open", { maxLength: 30, group: "content", hint: "Leave empty for no button." }),
    link("link", "Action opens", { when: { prop: "action", notEquals: [""] } }),
    color("tint", "Color", "accent"),
    select("style", "Style", "card", opts(["card", "Filled"], ["outlined", "Outlined"]), { group: "shape" }),
    spacing("padding", "Padding", 20, 40),
    number("radius", "Corner radius", 20, 0, 40),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const tint = s(p, "tint");
      const layout = s(p, "layout");
      const hasIcon = s(p, "icon") !== "none" && s(p, "icon") !== "";
      const titleColor = fg(ctx, s(p, "titleColor"));
      const action = () => (s(p, "action").trim() ? modifiers(tappable(ctx, p.link, null, str(s(p, "action").trim())), ["padding(.top, 4)", tint !== "accent" && `tint(${ctx.color(tint)})`]) : []);
      // The icon on a tinted square, as the tile and centred layouts show it.
      const chip = () =>
        modifiers([`Image(systemName: ${str(s(p, "icon"))})`], [
          "font(.system(size: 20, weight: .semibold))",
          `foregroundStyle(${ctx.style(tint)})`,
          "frame(width: 44, height: 44)",
          `background(Color${ctx.color(tint)}.opacity(0.15), in: .rect(cornerRadius: 12, style: .continuous))`,
        ]);
      const subtitle = () => (s(p, "subtitle").trim() ? modifiers([`Text(${str(s(p, "subtitle"))})`], ["font(.footnote)", "foregroundStyle(.secondary)"]) : []);
      if (layout === "tile") {
        // The icon and the figure across the top, the title at the foot.
        const top = call("HStack", [["alignment", ".top"]], [
          ...(hasIcon ? chip() : []),
          "Spacer(minLength: 8)",
          ...(s(p, "value").trim() ? modifiers([`Text(${str(s(p, "value").trim())})`], ["font(.title2.weight(.bold))", "monospacedDigit()"]) : []),
        ]);
        const inner = [
          ...top,
          "Spacer(minLength: 20)",
          ...(s(p, "title").trim() ? modifiers([`Text(${str(s(p, "title"))})`], ["font(.subheadline.weight(.medium))", titleColor, "lineLimit(2)"]) : []),
          ...subtitle(),
          ...action(),
        ];
        const lines = modifiers(call("VStack", [["alignment", ".leading"], ["spacing", "2"]], inner), ["frame(minHeight: 104, alignment: .top)"]);
        return { lines: surface(lines, p, "leading", ctx) };
      }
      if (layout === "center") {
        const inner = [
          ...(hasIcon ? chip() : []),
          ...(s(p, "title").trim() ? modifiers([`Text(${str(s(p, "title"))})`], ["font(.footnote.weight(.semibold))", titleColor, "multilineTextAlignment(.center)"]) : []),
          ...subtitle(),
          ...action(),
        ];
        const lines = call("VStack", [["alignment", ".center"], ["spacing", "10"]], inner);
        return { lines: surface(lines, p, "center", ctx) };
      }
      const inner: string[] = [];
      if (hasIcon) inner.push(...modifiers([`Image(systemName: ${str(s(p, "icon"))})`], ["font(.title2)", `foregroundStyle(${ctx.style(tint)})`]));
      if (s(p, "title").trim()) inner.push(...modifiers([`Text(${str(s(p, "title"))})`], ["font(.headline)", titleColor]));
      if (s(p, "subtitle").trim()) inner.push(...modifiers([`Text(${str(s(p, "subtitle"))})`], ["font(.subheadline)", "foregroundStyle(.secondary)"]));
      inner.push(...action());
      const lines = call("VStack", [["alignment", ".leading"], ["spacing", "8"]], inner);
      return { lines: surface(lines, p, "leading", ctx) };
    },
  },
};

export const primitives: SwiftPieceDefinition[] = [screen, vstack, hstack, spacer, divider, textDef, symbol, card, row, button, appleSignIn, input, toggle, segmented];

