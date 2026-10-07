// Free SwiftPieces components in the builder. Each emitter calls the piece's public API exactly as
// its Swift source declares it (argument labels, order and defaults), and names the registry entry
// so the project export can include the source file. Only arguments that differ from the Swift
// default are written, so the generated call reads like hand-written code. Their web renderers
// (react/preview/pieces.tsx) behave like the Swift: holds fill, fields type, steppers scrub.
import { house, houseBlocks, swiftRGB, swiftStyledAccent } from "../core/palette.js";
import { accentPalette } from "./app-pieces/layer-fill.js";
import type { EmitContext, Props, SwiftPieceDefinition } from "../core/schema.js";
import { type Arg, INDENT, call, list, modifiers, num, str } from "../core/swift.js";
import { bool, icon, link, linkStatement, number, opts, select, tappable, text, textStyleOptions } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const arr = (items: string[]) => `[${items.map(str).join(", ")}]`;
const dbl = (v: number) => (Number.isInteger(v) ? `${v}.0` : num(v));

/** An array literal broken one element per line, as Xcode formats long arrays. */
function arrayLines(label: string | null, items: string[], trailingComma: boolean): string[] {
  const head = label ? `${label}: [` : "[";
  return [head, ...items.map((i) => `${INDENT}${i},`), `]${trailingComma ? "," : ""}`];
}

/** A call whose arguments include one multi-line array: always broken, one argument per line. */
function callWithArray(name: string, before: Arg[], array: { label: string | null; items: string[] }, after: Arg[], trailing?: string[] | null): string[] {
  const fmt = (a: Arg[]) => a.filter((x): x is [string | null, string] => Boolean(x)).map(([l, v]) => (l ? `${l}: ${v}` : v));
  const pre = fmt(before);
  const post = fmt(after);
  const inner = [
    ...pre.map((x) => `${x},`),
    ...arrayLines(array.label, array.items, post.length > 0),
    ...post.map((x, i) => `${x}${i < post.length - 1 ? "," : ""}`),
  ];
  const lines = [`${name}(`, ...inner.map((l) => INDENT + l), ")"];
  if (trailing === undefined || trailing === null) return lines;
  lines[lines.length - 1] += trailing.length ? " {" : " {}";
  return trailing.length ? [...lines, ...trailing.map((l) => INDENT + l), "}"] : lines;
}

/**
 * A link run from an action closure (a piece that takes `primaryAction: () -> Void` rather than a
 * label): the closure body, and the modifiers that present the destination. Push uses
 * `.navigationDestination(isPresented:)`, a sheet `.sheet(isPresented:)`, back the dismiss action,
 * and a new root sets the flag the app reads.
 */
function linkAction(ctx: EmitContext, value: unknown): { action: string; present: string[] } | null {
  const target = ctx.link(String(value ?? ""));
  if (!target) return null;
  if (target.kind === "back") return { action: `{ ${ctx.dismiss()}() }`, present: [] };
  if (target.kind === "root") return { action: `{ ${target.flag} = true }`, present: [] };
  if (target.kind === "tab") return { action: `{ ${target.set} }`, present: [] };
  const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
  if (target.kind === "push") return { action: `{ ${flag} = true }`, present: [`.navigationDestination(isPresented: $${flag}) {`, `${INDENT}${target.view}()`, "}"] };
  const detents: Record<string, string> = { medium: "[.medium]", both: "[.medium, .large]" };
  return {
    action: `{ ${flag} = true }`,
    present: [`.sheet(isPresented: $${flag}) {`, `${INDENT}NavigationStack { ${target.view}() }`, ...(detents[target.detent] ? [`${INDENT}${INDENT}.presentationDetents(${detents[target.detent]})`] : []), "}"],
  };
}

/** Appends a multi-line modifier (`.sheet { … }`) at the indent `modifiers` would give it. */
function attach(lines: string[], block: string[]): string[] {
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  return [...lines, ...block.map((l) => pad + l)];
}

const docs = (category: string, slug: string) => `/docs/components/${category}/${slug}`;
const piece = (name: string) => ({ registry: "free" as const, name });

// ---------------------------------------------------------------- Controls

/**
 * What an outline or glass primary button adds around its button style: the accent edge, or the
 * frosted material behind with a hairline. Pill-shaped like the button (a rounded rectangle when
 * Style's corners are tighter than standard, as the button's own shape becomes).
 */
function buttonFinish(ctx: EmitContext, kind: string): string[] {
  if (!ctx.theme || (kind !== "outline" && kind !== "glass")) return [];
  const shape = ctx.theme.cornerScale < 1 ? "RoundedRectangle(cornerRadius: Theme.pillRadius, style: .continuous)" : "Capsule()";
  return kind === "outline"
    ? [`overlay(${shape}.strokeBorder(Theme.accent, lineWidth: 1.5))`]
    : [`background(.ultraThinMaterial, in: ${shape})`, `overlay(${shape}.strokeBorder(.white.opacity(0.3), lineWidth: 0.5))`];
}

export const elasticButton: SwiftPieceDefinition = {
  id: "elastic-button",
  name: "Elastic Button",
  category: "pieces",
  description: "A button that squashes under your finger and springs back.",
  availability: "free",
  preview: { component: "elastic-button" },
  source: piece("ElasticButton"),
  docs: docs("controls", "elastic-button"),
  icon: "bolt",
  concepts: ["buttonstyle", "spring", "piece"],
  anatomy: [
    { part: "Label", props: ["title"] },
    { part: "Icon", props: ["icon", "iconPosition"] },
    { part: "Fill", props: ["style", "fullWidth"] },
    { part: "Motion", props: ["squash", "bounce"] },
    { part: "Interaction", props: ["link", "disabled"] },
  ],
  interactions: ["press", "spring", "tap", "push", "haptic"],
  variants: [
    { id: "signal", label: "Signal", props: { style: "signal", icon: "arrow.right", fullWidth: true } },
    { id: "block", label: "Color block", props: { style: "block:lilac", icon: "plus", iconPosition: "leading", title: "Add guest", fullWidth: false } },
    { id: "raised", label: "Raised", props: { style: "raised", icon: "none", fullWidth: true } },
  ],
  states: [
    { id: "enabled", label: "Enabled", props: { disabled: false } },
    { id: "disabled", label: "Disabled", props: { disabled: true } },
  ],
  properties: [
    text("title", "Text", "Reserve table", { maxLength: 40 }),
    link(),
    icon("icon", "Icon", "arrow.right"),
    select("iconPosition", "Icon position", "trailing", opts(["leading", "Before text"], ["trailing", "After text"]), { when: { prop: "icon", notEquals: ["none"] } }),
    select("style", "Style", "signal", opts(["signal", "Signal"], ["raised", "Raised"], ["standard", "Text only"], ...houseBlocks.map((b): [string, string] => [`block:${b}`, `Block · ${b}`]))),
    bool("fullWidth", "Full width", true),
    bool("disabled", "Disabled", false, { level: "advanced" }),
    number("squash", "Squash", 0.96, 0.85, 0.99, 0.01, { level: "advanced", pro: true, group: "motion", hint: "How far the button presses in." }),
    number("bounce", "Bounce", 0.2, 0, 0.6, 0.05, { level: "advanced", pro: true, hint: "Spring bounce on release." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const title = str(s(p, "title"));
      const ic = s(p, "icon");
      let label: string[] = ic === "none" ? [`Text(${title})`] : s(p, "iconPosition") === "trailing" ? call("HStack", [["spacing", "8"]], [`Text(${title})`, `Image(systemName: ${str(ic)})`]) : [`Label(${title}, systemImage: ${str(ic)})`];
      if (b(p, "fullWidth")) label = modifiers(label, ["frame(maxWidth: .infinity)"]);
      const style = s(p, "style");
      // With a look, the signal style takes the look's accent (and the ink that reads on it).
      // Style → Buttons: the primary style as a solid fill, a tinted wash, an outline or glass.
      const kind = ctx.theme && style === "signal" ? ctx.theme.buttons : "solid";
      const solid = ".init(fill: Theme.accent, ink: Theme.accentInk)";
      const primary = kind === "tinted" ? ".init(fill: Theme.accent.opacity(0.16), ink: Theme.accent, depth: false)" : kind === "outline" ? ".init(fill: .clear, ink: Theme.accent, depth: false)" : kind === "glass" ? ".init(fill: Theme.accent.opacity(0.14), ink: Theme.accent, depth: false)" : solid;
      const baseExpr = style.startsWith("block:") ? `.block(.${style.slice(6)})` : style === "signal" && ctx.theme ? primary : style === "raised" && ctx.theme ? ".init(fill: Theme.accent.opacity(0.14), ink: Theme.accent, depth: false)" : `.${style}`;
      // Style → Button size: the same style at the app's button height.
      const height = ctx.theme?.buttonHeight ?? 56;
      const styleExpr = height === 56 ? baseExpr : `{ var style: ElasticButton.Style = ${baseExpr}; style.height = ${height}; return style }()`;
      const custom = n(p, "squash") !== 0.96 || n(p, "bounce") !== 0.2;
      const buttonStyle = custom
        ? `.elastic(${[n(p, "squash") !== 0.96 && `squash: ${num(n(p, "squash"))}`, n(p, "bounce") !== 0.2 && `bounce: ${num(n(p, "bounce"))}`, (style !== "standard" || height !== 56) && `style: ${styleExpr}`].filter(Boolean).join(", ")})`
        : style === "standard" && height === 56 ? ".elastic" : `.elastic(${styleExpr})`;
      return { lines: modifiers(tappable(ctx, p.link, label, title), [`buttonStyle(${buttonStyle})`, ...buttonFinish(ctx, kind), b(p, "disabled") && "disabled(true)"]) };
    },
  },
};

export const commitButton: SwiftPieceDefinition = {
  id: "commit-button",
  name: "Commit Button",
  category: "pieces",
  description: "A button that shows loading, success and error in place.",
  availability: "free",
  preview: { component: "commit-button" },
  source: piece("CommitButton"),
  docs: docs("controls", "commit-button"),
  icon: "checkmark.circle.fill",
  concepts: ["state", "binding", "async", "closure", "piece"],
  anatomy: [
    { part: "Label", props: ["title", "successTitle"] },
    { part: "Phase", props: ["phase", "errorMessage", "collapses"] },
    { part: "After success", props: ["link"] },
  ],
  interactions: ["tap", "loading", "transition", "haptic"],
  variants: [
    { id: "save", label: "Save", props: { title: "Save changes", successTitle: "Saved" } },
    { id: "pay", label: "Pay", props: { title: "Pay $24.00", successTitle: "Paid" } },
    { id: "send", label: "Send", props: { title: "Send invite", successTitle: "Sent" } },
  ],
  states: [
    { id: "idle", label: "Ready", props: { phase: "idle" } },
    { id: "loading", label: "Loading", props: { phase: "loading" } },
    { id: "success", label: "Success", props: { phase: "success" } },
    { id: "error", label: "Error", props: { phase: "error" } },
    { id: "disabled", label: "Disabled", props: { phase: "disabled" } },
  ],
  properties: [
    text("title", "Text", "Save changes", { maxLength: 40 }),
    text("successTitle", "Success text", "Saved", { maxLength: 30 }),
    select("phase", "Starts as", "idle", opts(["idle", "Ready"], ["loading", "Loading"], ["success", "Success"], ["error", "Error"], ["disabled", "Disabled"]), { hint: "The initial phase. Tapping runs the action." }),
    text("errorMessage", "Error message", "Couldn't save", { when: { prop: "phase", equals: ["error"] }, maxLength: 40 }),
    bool("collapses", "Shrink while loading", true, { hint: "Off keeps the button full width through loading and success, the spinner centred." }),
    link("link", "After success"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const phase = s(p, "phase");
      const initial = phase === "error" ? `.error(${str(s(p, "errorMessage"))})` : `.${phase}`;
      const name = ctx.state(`${s(p, "title")} phase`, "CommitButton.Phase", initial);
      const then = linkStatement(ctx, p.link);
      const action = [`${name} = .loading`, "Task {", `${INDENT}try? await Task.sleep(for: .seconds(1))`, `${INDENT}${name} = .success`, ...(then ? [`${INDENT}try? await Task.sleep(for: .seconds(0.6))`, `${INDENT}${then}`] : []), "}"];
      const kind = ctx.theme?.buttons ?? "solid";
      const tint = kind === "tinted" ? "Theme.accent.opacity(0.16)" : kind === "outline" ? ".clear" : kind === "glass" ? "Theme.accent.opacity(0.14)" : "Theme.accent";
      const tintInk = kind === "solid" ? "Theme.accentInk" : "Theme.accent";
      const height = ctx.theme?.buttonHeight ?? 56;
      const lines = call("CommitButton", [[null, str(s(p, "title"))], ["phase", `$${name}`], ctx.theme && ["tint", tint], ctx.theme && ["tintInk", tintInk], s(p, "successTitle").trim() !== "" && ["successTitle", str(s(p, "successTitle").trim())], !b(p, "collapses") && ["collapses", "false"], height !== 56 && ["style", `.init(height: ${height})`]], action);
      return { lines: modifiers(lines, buttonFinish(ctx, kind)) };
    },
  },
};

export const holdToConfirm: SwiftPieceDefinition = {
  id: "hold-to-confirm",
  name: "Hold To Confirm",
  category: "pieces",
  description: "Press and hold to confirm a destructive or important action.",
  availability: "free",
  preview: { component: "hold-to-confirm" },
  source: piece("HoldToConfirm"),
  docs: docs("controls", "hold-to-confirm"),
  icon: "hourglass",
  concepts: ["closure", "gesture", "piece"],
  anatomy: [
    { part: "Label", props: ["title", "committedTitle"] },
    { part: "Icon", props: ["icon"] },
    { part: "Fill", props: ["style"] },
    { part: "Timing", props: ["duration"] },
  ],
  interactions: ["hold", "haptic", "spring"],
  variants: [
    { id: "delete", label: "Delete", props: { title: "Hold to delete", icon: "trash", committedTitle: "Deleted", style: "standard" } },
    { id: "transfer", label: "Transfer", props: { title: "Hold to transfer", icon: "arrow.right", committedTitle: "Sent", style: "butter" } },
    { id: "pay", label: "Pay", props: { title: "Hold to pay", icon: "creditcard", committedTitle: "Paid", style: "standard" } },
  ],
  properties: [
    text("title", "Text", "Hold to delete", { maxLength: 40 }),
    icon("icon", "Icon", "trash"),
    text("committedTitle", "Confirmed text", "Deleted", { maxLength: 30 }),
    select("style", "Style", "standard", opts(["standard", "Signal"], ["butter", "Butter"]), { hint: "The color that fills while you hold." }),
    number("duration", "Hold time (s)", 1.2, 0.5, 3, 0.1, { level: "advanced", pro: true, hint: "How long a full hold takes." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      return {
        lines: call("HoldToConfirm", [
          [null, str(s(p, "title"))],
          s(p, "icon") !== "none" && ["systemImage", str(s(p, "icon"))],
          n(p, "duration") !== 1.2 && ["duration", num(n(p, "duration"))],
          ctx.theme && ["tint", "Theme.accent"],
          s(p, "committedTitle").trim() !== "" && ["committedTitle", str(s(p, "committedTitle").trim())],
          s(p, "style") !== "standard" && ["style", `.${s(p, "style")}`],
        ], []),
      };
    },
  },
};

// ---------------------------------------------------------------- Inputs

const contentTypes: Record<string, { type?: string; keyboard?: string }> = {
  none: {},
  email: { type: ".emailAddress", keyboard: ".emailAddress" },
  name: { type: ".name" },
  username: { type: ".username" },
  phone: { type: ".telephoneNumber", keyboard: ".phonePad" },
};

export const formField: SwiftPieceDefinition = {
  id: "form-field",
  name: "Form Field",
  category: "pieces",
  description: "A field whose label floats up on focus, with help, limits and validation.",
  availability: "free",
  preview: { component: "form-field" },
  source: piece("FormField"),
  docs: docs("inputs", "form-field"),
  icon: "square.and.pencil",
  concepts: ["state", "binding", "textfield", "piece"],
  anatomy: [
    { part: "Label", props: ["label", "prompt"] },
    { part: "Icon", props: ["icon"] },
    { part: "Help", props: ["help"] },
    { part: "Keyboard", props: ["content", "limit"] },
  ],
  interactions: ["type"],
  variants: [
    { id: "email", label: "Email", props: { label: "Email", prompt: "you@example.com", icon: "envelope", content: "email", help: "", limit: 0 } },
    { id: "name", label: "Name", props: { label: "Full name", prompt: "Your name", icon: "person", content: "name", help: "", limit: 0 } },
    { id: "bio", label: "Bio with limit", props: { label: "Bio", prompt: "A line about you", icon: "none", content: "none", help: "Shown on your profile.", limit: 80 } },
  ],
  properties: [
    text("label", "Label", "Email", { maxLength: 40 }),
    text("prompt", "Placeholder", "you@example.com", { maxLength: 60 }),
    text("help", "Help text", "", { maxLength: 80, hint: "A line under the field." }),
    icon("icon", "Icon", "envelope"),
    select("content", "Content", "email", opts(["none", "Anything"], ["email", "Email"], ["name", "Name"], ["username", "Username"], ["phone", "Phone number"])),
    number("limit", "Character limit", 0, 0, 500, 1, { level: "advanced", hint: "0 means no limit." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state(s(p, "label") || "text", "", '""');
      const ct = contentTypes[s(p, "content")] ?? {};
      return {
        lines: call("FormField", [
          [null, str(s(p, "label"))],
          ["text", `$${name}`],
          s(p, "prompt").trim() !== "" && ["prompt", str(s(p, "prompt"))],
          s(p, "help").trim() !== "" && ["help", str(s(p, "help"))],
          s(p, "icon") !== "none" && ["leading", `Image(systemName: ${str(s(p, "icon"))})`],
          n(p, "limit") > 0 && ["limit", num(n(p, "limit"))],
          ct.type && ["textContentType", ct.type],
          ct.keyboard && ["keyboardType", ct.keyboard],
        ]),
      };
    },
  },
};

export const secureEntry: SwiftPieceDefinition = {
  id: "secure-entry",
  name: "Secure Entry",
  category: "pieces",
  description: "A password field with reveal, a strength bar and requirement chips.",
  availability: "free",
  preview: { component: "secure-entry" },
  source: piece("SecureEntry"),
  docs: docs("inputs", "secure-entry"),
  icon: "lock",
  concepts: ["state", "binding", "textfield", "piece"],
  anatomy: [
    { part: "Field", props: ["label"] },
    { part: "Strength", props: ["showsStrength"] },
    { part: "Requirements", props: ["showsRequirements"] },
  ],
  interactions: ["type", "toggle"],
  variants: [
    { id: "full", label: "Full", props: { showsStrength: true, showsRequirements: true } },
    { id: "strength", label: "Strength only", props: { showsStrength: true, showsRequirements: false } },
    { id: "plain", label: "Plain", props: { showsStrength: false, showsRequirements: false } },
  ],
  properties: [
    text("label", "Label", "Password", { maxLength: 40 }),
    bool("showsStrength", "Strength bar", true, { hint: "A bar that fills as the password gets stronger." }),
    bool("showsRequirements", "Requirement chips", true, { hint: "Chips that light up as each rule is met." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state(s(p, "label") || "password", "", '""');
      return {
        lines: call("SecureEntry", [
          s(p, "label") !== "Password" && [null, str(s(p, "label"))],
          ["text", `$${name}`],
          !b(p, "showsStrength") && ["showsStrength", "false"],
          !b(p, "showsRequirements") && ["showsRequirements", "false"],
        ]),
      };
    },
  },
};

export const amountField: SwiftPieceDefinition = {
  id: "amount-field",
  name: "Amount Field",
  category: "pieces",
  description: "Currency entry that formats in the user's locale as they type.",
  availability: "free",
  preview: { component: "amount-field" },
  source: piece("AmountField"),
  docs: docs("inputs", "amount-field"),
  icon: "dollarsign.circle",
  concepts: ["state", "binding", "formatstyle", "piece"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Amount", props: ["amount", "currency"] },
    { part: "Size", props: ["size"] },
    { part: "Limit", props: ["limit"] },
  ],
  interactions: ["type"],
  variants: [
    { id: "hero", label: "Hero", props: { size: "hero", currency: "USD", label: "Send" } },
    { id: "compact", label: "Compact", props: { size: "compact", currency: "EUR", label: "Amount" } },
    { id: "yen", label: "Yen", props: { size: "hero", currency: "JPY", label: "Request" } },
  ],
  properties: [
    text("label", "Label", "Send", { maxLength: 30 }),
    select("currency", "Currency", "USD", opts(["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "Pound"], ["JPY", "Yen"])),
    select("size", "Size", "hero", opts(["hero", "Hero"], ["compact", "Compact"])),
    number("amount", "Starting amount", 0, 0, 1_000_000, 0.01, { group: "state" }),
    number("limit", "Limit", 0, 0, 1_000_000, 1, { level: "advanced", hint: "0 means no limit." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state(`${s(p, "label")} amount`, "Decimal", num(n(p, "amount")));
      return {
        lines: call("AmountField", [
          [null, str(s(p, "label"))],
          ["value", `$${name}`],
          ["currencyCode", str(s(p, "currency"))],
          n(p, "limit") > 0 && ["limit", num(n(p, "limit"))],
          s(p, "size") !== "hero" && ["size", `.${s(p, "size")}`],
        ]),
      };
    },
  },
};

export const filterRail: SwiftPieceDefinition = {
  id: "filter-rail",
  name: "Filter Rail",
  category: "pieces",
  description: "A scrolling row of filter chips with a gliding indicator.",
  availability: "free",
  preview: { component: "filter-rail" },
  source: piece("FilterRail"),
  docs: docs("inputs", "filter-rail"),
  icon: "line.3.horizontal.decrease",
  concepts: ["state", "binding", "array", "piece"],
  anatomy: [
    { part: "Options", props: ["options"] },
    { part: "Selection", props: ["multiple"] },
  ],
  interactions: ["select", "scroll", "haptic"],
  variants: [
    { id: "genres", label: "Genres", props: { options: "All, Jazz, Hip-Hop, Classical, Ambient", multiple: false } },
    { id: "sort", label: "Sort", props: { options: "Recent, Popular, A to Z, Longest", multiple: false } },
    { id: "multi", label: "Pick several", props: { options: "Jazz, Hip-Hop, Classical, Electronic, Folk", multiple: true } },
  ],
  properties: [
    text("options", "Options", "All, Jazz, Hip-Hop, Classical, Ambient", { hint: "Separate options with commas." }),
    bool("multiple", "Multiple selection", false, { group: "interaction", hint: "Lets people pick more than one chip." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const options = list(p.options);
      const safe = options.length ? options : ["All"];
      const name = ctx.state("filter", "Set<String>", arr([safe[0]]));
      return { lines: call("FilterRail", [["options", arr(safe)], ["selection", `$${name}`], b(p, "multiple") && ["allowsMultiple", "true"]]) };
    },
  },
};

export const scrubStepper: SwiftPieceDefinition = {
  id: "scrub-stepper",
  name: "Scrub Stepper",
  category: "pieces",
  description: "A stepper you tap, hold or scrub sideways.",
  availability: "free",
  preview: { component: "scrub-stepper" },
  source: piece("ScrubStepper"),
  docs: docs("inputs", "scrub-stepper"),
  icon: "plus.circle.fill",
  concepts: ["state", "binding", "range", "gesture", "piece"],
  anatomy: [
    { part: "Value", props: ["value"] },
    { part: "Range", props: ["min", "max"] },
    { part: "Accessibility", props: ["label"] },
  ],
  interactions: ["tap", "scrub", "haptic"],
  variants: [
    { id: "guests", label: "Guests", props: { label: "Guests", value: 4, min: 1, max: 10 } },
    { id: "nights", label: "Nights", props: { label: "Nights", value: 2, min: 1, max: 30 } },
    { id: "tickets", label: "Tickets", props: { label: "Tickets", value: 0, min: 0, max: 8 } },
  ],
  properties: [text("label", "Accessibility label", "Guests", { maxLength: 30 }), number("value", "Starting value", 4, 0, 999), number("min", "Minimum", 1, 0, 999), number("max", "Maximum", 10, 1, 999)],
  swift: {
    imports: [],
    emit(p, ctx) {
      const lo = Math.min(n(p, "min"), n(p, "max") - 1);
      const hi = Math.max(n(p, "max"), lo + 1);
      const name = ctx.state(s(p, "label") || "count", "", num(Math.min(hi, Math.max(lo, n(p, "value")))));
      return { lines: modifiers(call("ScrubStepper", [["value", `$${name}`], ["in", `${num(lo)}...${num(hi)}`]]), [s(p, "label").trim() && `accessibilityLabel(${str(s(p, "label").trim())})`]) };
    },
  },
};

// ---------------------------------------------------------------- Lists

export const taskRow: SwiftPieceDefinition = {
  id: "task-row",
  name: "Task Row",
  category: "pieces",
  description: "A task card that completes with a drawn check and swipes to snooze or delete.",
  availability: "free",
  preview: { component: "task-row" },
  card: () => 22,
  // In a styled list the row's own card goes clear (its swipe tile still appears in the gap it
  // opens); it pads itself 14 top and bottom and 12 on the leading side.
  list: { bare: { listed: true }, pad: 0, inset: 4 },
  source: piece("TaskRow"),
  docs: docs("lists", "task-row"),
  icon: "checkmark",
  concepts: ["state", "binding", "enum", "piece"],
  anatomy: [
    { part: "Checkbox", props: ["status"] },
    { part: "Title", props: ["title"] },
    { part: "Due", props: ["due"] },
    { part: "Priority", props: ["priority"] },
  ],
  interactions: ["tap", "swipe", "spring", "haptic"],
  variants: [
    { id: "urgent", label: "Urgent", props: { priority: "high", due: "Today, 5 PM" } },
    { id: "later", label: "Low priority", props: { priority: "low", due: "Next week" } },
    { id: "simple", label: "Simple", props: { priority: "none", due: "" } },
  ],
  states: [
    { id: "open", label: "Open", props: { status: "open" } },
    { id: "completed", label: "Completed", props: { status: "completed" } },
    { id: "snoozed", label: "Snoozed", props: { status: "snoozed" } },
  ],
  properties: [
    text("title", "Title", "Review the launch checklist", { maxLength: 60 }),
    text("due", "Due", "Today, 5 PM", { maxLength: 30 }),
    select("priority", "Priority", "high", opts(["none", "None"], ["low", "Low"], ["medium", "Medium"], ["high", "High"])),
    select("status", "Status", "open", opts(["open", "Open"], ["completed", "Completed"], ["snoozed", "Snoozed"])),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state("task status", "TaskRow.Status", `.${s(p, "status")}`);
      const listed = p.listed === true && (["style", "{ var style = TaskRow.Style.standard; style.surface = .clear; style.cornerRadius = 12; return style }()"] as [string, string]);
      return { lines: call("TaskRow", [[null, str(s(p, "title"))], ["status", `$${name}`], s(p, "due").trim() !== "" && ["due", str(s(p, "due"))], s(p, "priority") !== "none" && ["priority", `.${s(p, "priority")}`], listed]) };
    },
  },
};

export const statusTimeline: SwiftPieceDefinition = {
  id: "status-timeline",
  name: "Status Timeline",
  category: "pieces",
  description: "Order or task progress as a vertical timeline of steps.",
  availability: "free",
  preview: { component: "status-timeline" },
  source: piece("StatusTimeline"),
  docs: docs("lists", "status-timeline"),
  icon: "shippingbox",
  concepts: ["array", "enum", "piece"],
  anatomy: [
    { part: "Steps", props: ["steps"] },
    { part: "Progress", props: ["current"] },
  ],
  interactions: ["tap", "transition"],
  variants: [
    { id: "delivery", label: "Delivery", props: { steps: "Order placed, Packed, Out for delivery, Delivered", current: 2 } },
    { id: "setup", label: "Setup", props: { steps: "Account, Profile, Payment, Done", current: 1 } },
    { id: "review", label: "Review", props: { steps: "Submitted, In review, Approved", current: 1 } },
  ],
  states: [
    { id: "start", label: "Just started", props: { current: 0 } },
    { id: "midway", label: "Midway", props: { current: 2 } },
    { id: "done", label: "All done", props: { current: 11 } },
  ],
  properties: [
    text("steps", "Steps", "Order placed, Packed, Out for delivery, Delivered", { hint: "Separate steps with commas.", maxLength: 200 }),
    number("current", "Current step", 2, 0, 11, 1, { hint: "0 is the first step. Tap the timeline to advance it." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const steps = list(p.steps);
      const current = n(p, "current");
      const items = (steps.length ? steps : ["Step"]).map((t, i) => `.init(${str(t)}, status: .${i < current ? "complete" : i === current ? "current" : "pending"})`);
      return { lines: callWithArray("StatusTimeline", [], { label: "steps", items }, [ctx.theme && ["tint", "Theme.accent"]]) };
    },
  },
};

// ---------------------------------------------------------------- Data

const SERIES = [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25];

export const liveStat: SwiftPieceDefinition = {
  id: "live-stat",
  name: "Live Stat",
  category: "pieces",
  description: "A metric tile with a rolling value, a delta chip and a sparkline.",
  availability: "free",
  preview: { component: "live-stat" },
  card: () => 26,
  source: piece("LiveStat"),
  docs: docs("data", "live-stat"),
  icon: "chart.line.uptrend.xyaxis",
  concepts: ["formatstyle", "piece"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Figure", props: ["value", "format"] },
    { part: "Change", props: ["delta"] },
    { part: "Chart", props: ["sparkline"] },
  ],
  interactions: ["transition", "stream"],
  variants: [
    { id: "revenue", label: "Revenue", props: { label: "Revenue", value: 48250.4, format: "currency", delta: 12.4, sparkline: true } },
    { id: "users", label: "Users", props: { label: "Active users", value: 1284, format: "number", delta: 3.2, sparkline: true } },
    { id: "down", label: "Falling", props: { label: "Refunds", value: 312, format: "number", delta: -8.5, sparkline: false } },
  ],
  properties: [
    text("label", "Label", "Revenue", { maxLength: 30 }),
    number("value", "Value", 48250.4, -1_000_000_000, 1_000_000_000, 0.01, { group: "content" }),
    select("format", "Format", "currency", opts(["number", "Number"], ["currency", "Currency"])),
    select("code", "Currency code", "USD", opts(["USD", "US dollar"], ["GBP", "Pound"], ["EUR", "Euro"], ["JPY", "Yen"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"]), { when: { prop: "format", equals: ["currency"] } }),
    number("delta", "Change (%)", 12.4, -100, 1000, 0.1, { hint: "0 hides the chip." }),
    bool("sparkline", "Sparkline", true),
  ],
  swift: {
    imports: [],
    emit(p) {
      return {
        lines: call("LiveStat", [
          ["label", str(s(p, "label"))],
          ["value", num(n(p, "value"))],
          s(p, "format") === "currency" && ["format", `.currency(code: ${str(s(p, "code") || "USD")})`],
          n(p, "delta") !== 0 && ["delta", num(n(p, "delta") / 100)],
          b(p, "sparkline") && ["series", `[${SERIES.map(num).join(", ")}]`],
        ]),
      };
    },
  },
};

/** Decimal places a figure shows (up to 2), so "3.4" stays 3.4 in Swift as it does on the web. */
const fractionDigits = (v: number) => (Number.isInteger(v) ? 0 : Math.min(2, (String(Math.round(v * 100) / 100).split(".")[1] ?? "").length));

export const odometer: SwiftPieceDefinition = {
  id: "odometer",
  name: "Odometer",
  category: "pieces",
  description: "A number whose digits roll like a mechanical counter.",
  availability: "free",
  preview: { component: "odometer" },
  source: piece("Odometer"),
  docs: docs("data", "odometer"),
  icon: "timer",
  concepts: ["formatstyle", "animation", "piece"],
  anatomy: [
    { part: "Figure", props: ["value"] },
    { part: "Format", props: ["currency"] },
    { part: "Size", props: ["size"] },
  ],
  interactions: ["transition", "spring"],
  variants: [
    { id: "balance", label: "Balance", props: { value: 12480.55, currency: true, size: 48 } },
    { id: "count", label: "Count", props: { value: 1284, currency: false, size: 48 } },
    { id: "hero", label: "Hero", props: { value: 98.6, currency: false, size: 80 } },
  ],
  properties: [
    number("value", "Value", 12480.55, -1_000_000_000, 1_000_000_000, 0.01, { group: "content", hint: "Change it and the digits roll to the new number." }),
    bool("currency", "Currency", true),
    select("code", "Currency code", "USD", opts(["USD", "US dollar"], ["GBP", "Pound"], ["EUR", "Euro"], ["JPY", "Yen"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"]), { when: { prop: "currency", equals: [true] } }),
    number("size", "Size", 48, 16, 96),
  ],
  swift: {
    imports: [],
    emit(p) {
      return { lines: modifiers(call("Odometer", [["value", num(n(p, "value"))], b(p, "currency") ? ["format", `.currency(code: ${str(s(p, "code") || "USD")})`] : fractionDigits(n(p, "value")) > 0 && ["format", `.number.precision(.fractionLength(${fractionDigits(n(p, "value"))}))`]]), [`font(.system(size: ${num(n(p, "size"))}, weight: .light))`]) };
    },
  },
};

export const ringBreakdown: SwiftPieceDefinition = {
  id: "ring-breakdown",
  name: "Ring Breakdown",
  category: "pieces",
  description: "A donut chart of solid blocks you scrub, with a legend.",
  availability: "free",
  preview: { component: "ring-breakdown" },
  source: piece("RingBreakdown"),
  docs: docs("data", "ring-breakdown"),
  icon: "chart.pie",
  concepts: ["array", "formatstyle", "piece"],
  anatomy: [
    { part: "Slices", props: ["slices"] },
    { part: "Format", props: ["currency"] },
    { part: "Legend", props: ["legend"] },
  ],
  interactions: ["tap", "scrub", "select", "haptic"],
  variants: [
    { id: "budget", label: "Budget", props: { slices: "Housing: 1450, Food: 620, Transport: 310, Leisure: 270", currency: true, legend: true } },
    { id: "time", label: "Time", props: { slices: "Deep work: 4, Meetings: 2, Email: 1, Breaks: 1", currency: false, legend: true } },
    { id: "ring", label: "Ring only", props: { legend: false } },
  ],
  properties: [
    text("slices", "Slices", "Housing: 1450, Food: 620, Transport: 310, Leisure: 270", { hint: "Label: value, separated by commas.", maxLength: 200 }),
    bool("currency", "Currency (USD)", true),
    bool("legend", "Legend", true, { hint: "Lists each slice with its value under the ring." }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const slices = parseSlices(s(p, "slices"));
      // A Style accent: the same seeded palette the preview draws, light and dark, one colour per slice.
      const accent = swiftStyledAccent();
      const lightPalette = accent ? accentPalette(accent.light, slices.length) : [];
      const darkPalette = accent ? accentPalette(accent.dark, slices.length) : [];
      const literal = (hex: string) => {
        const v = hex.replace("#", "");
        const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
        return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
      };
      const color = (i: number) => {
        const [lc, dc] = [literal(lightPalette[i]), literal(darkPalette[i])];
        return lc === dc ? lc : `Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(${dc}) : UIColor(${lc}) })`;
      };
      const items = slices.map((x, i) => `.init(label: ${str(x.label)}, value: ${num(x.value)}${accent ? `, color: ${color(i)}` : ""})`);
      return { lines: callWithArray("RingBreakdown", [], { label: "slices", items }, [b(p, "currency") && ["format", '.currency(code: "USD").precision(.fractionLength(0))'], !b(p, "legend") && ["showsLegend", "false"]]) };
    },
  },
};

export function parseSlices(value: string): Array<{ label: string; value: number }> {
  const out = list(value, 8)
    .map((part) => {
      const [label, v] = part.split(":");
      return { label: (label ?? "").trim(), value: Math.max(0, Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0) };
    })
    .filter((x) => x.label);
  return out.length ? out : [{ label: "Total", value: 1 }];
}

// ---------------------------------------------------------------- Feedback

export const ratingScrub: SwiftPieceDefinition = {
  id: "rating-scrub",
  name: "Rating Scrub",
  category: "pieces",
  description: "Star rating you tap or scrub, colored by the score.",
  availability: "free",
  preview: { component: "rating-scrub" },
  source: piece("RatingScrub"),
  docs: docs("feedback", "rating-scrub"),
  icon: "star.fill",
  concepts: ["state", "binding", "gesture", "piece"],
  anatomy: [
    { part: "Stars", props: ["rating", "size"] },
    { part: "Label", props: ["labels"] },
    { part: "Interaction", props: ["readOnly"] },
  ],
  interactions: ["tap", "scrub", "haptic"],
  variants: [
    { id: "large", label: "Large", props: { size: 36, labels: true, readOnly: false } },
    { id: "compact", label: "Compact", props: { size: 22, labels: false, readOnly: false } },
    { id: "display", label: "Display only", props: { size: 28, labels: true, readOnly: true } },
  ],
  states: [
    { id: "empty", label: "No rating", props: { rating: 0 } },
    { id: "fair", label: "Fair", props: { rating: 2 } },
    { id: "great", label: "Great", props: { rating: 5 } },
  ],
  properties: [
    number("rating", "Starting rating", 4, 0, 5, 0.5, { hint: "Half steps turn on half stars." }),
    bool("labels", "Word labels", true),
    number("size", "Star size", 36, 16, 60),
    bool("readOnly", "Read only", false, { group: "interaction", hint: "Shows the rating without letting people change it." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state("rating", "", dbl(n(p, "rating")));
      return {
        lines: call("RatingScrub", [
          ["rating", `$${name}`],
          n(p, "rating") % 1 !== 0 && ["allowsHalf", "true"],
          b(p, "labels") && ["labels", arr(["Poor", "Fair", "Good", "Very good", "Great"])],
          b(p, "readOnly") && ["isReadOnly", "true"],
          n(p, "size") !== 30 && ["size", num(n(p, "size"))],
        ]),
      };
    },
  },
};

export const reactionToggle: SwiftPieceDefinition = {
  id: "reaction-toggle",
  name: "Reaction Toggle",
  category: "pieces",
  description: "A like or save toggle that floods with color and bounces.",
  availability: "free",
  preview: { component: "reaction-toggle" },
  source: piece("ReactionToggle"),
  docs: docs("feedback", "reaction-toggle"),
  icon: "heart.fill",
  concepts: ["state", "binding", "spring", "piece"],
  anatomy: [
    { part: "Icon", props: ["icon", "size"] },
    { part: "Fill", props: ["fill"] },
    { part: "Count", props: ["count"] },
    { part: "Confirmation", props: ["confirmation"] },
    { part: "State", props: ["isOn"] },
  ],
  interactions: ["toggle", "spring", "haptic"],
  variants: [
    { id: "like", label: "Like", props: { icon: "heart", fill: "tangerine", count: 128, confirmation: "" } },
    { id: "save", label: "Save", props: { icon: "bookmark", fill: "sky", count: 0, confirmation: "Saved" } },
    { id: "star", label: "Star", props: { icon: "star", fill: "butter", count: 42, confirmation: "" } },
  ],
  states: [
    { id: "off", label: "Off", props: { isOn: false } },
    { id: "on", label: "On", props: { isOn: true } },
  ],
  properties: [
    select("icon", "Icon", "heart", opts(["heart", "Heart"], ["bookmark", "Bookmark"], ["star", "Star"], ["bell", "Bell"])),
    bool("isOn", "Starts on", false),
    number("count", "Count", 128, 0, 99999, 1, { hint: "0 hides the count." }),
    text("confirmation", "Confirmation", "", { maxLength: 20, hint: "A pill that floats up when turned on." }),
    select("fill", "Color", "tangerine", opts(["tangerine", "Tangerine"], ["sky", "Sky"], ["butter", "Butter"], ["sage", "Sage"], ["lilac", "Lilac"])),
    number("size", "Size", 28, 16, 48),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state(`${s(p, "icon") === "heart" ? "liked" : s(p, "icon") === "bookmark" ? "saved" : `${s(p, "icon")} on`}`, "", b(p, "isOn") ? "true" : "false");
      return {
        lines: call("ReactionToggle", [
          ["isOn", `$${name}`],
          s(p, "icon") !== "heart" && ["systemImage", str(s(p, "icon"))],
          n(p, "count") > 0 && ["count", num(n(p, "count"))],
          s(p, "confirmation").trim() !== "" && ["confirmation", str(s(p, "confirmation").trim())],
          n(p, "size") !== 24 && ["size", num(n(p, "size"))],
          s(p, "fill") !== "tangerine" && ["style", `.init(fill: ReactionToggle.Style.${s(p, "fill")})`],
        ]),
      };
    },
  },
};

export const outcomeScreen: SwiftPieceDefinition = {
  id: "outcome-screen",
  name: "Outcome Screen",
  category: "pieces",
  description: "A success, failure or empty state with one clear action.",
  availability: "free",
  preview: { component: "outcome-screen" },
  source: piece("OutcomeScreen"),
  docs: docs("feedback", "outcome-screen"),
  icon: "flag",
  concepts: ["enum", "closure", "navigation", "piece"],
  anatomy: [
    { part: "Mark", props: ["outcome"] },
    { part: "Text", props: ["eyebrow", "title", "message"] },
    { part: "Action", props: ["primaryTitle", "link"] },
  ],
  interactions: ["tap", "press", "push", "transition"],
  variants: [
    { id: "backup", label: "Backup done", props: { outcome: "success", title: "Backup complete", message: "2,418 photos and 36 videos are safe in your library.", primaryTitle: "Done" } },
    { id: "upload", label: "Upload failed", props: { outcome: "failure", title: "Upload failed", message: "Check your connection and try again.", primaryTitle: "Try again" } },
    { id: "inbox", label: "Empty inbox", props: { outcome: "empty", title: "No messages yet", message: "Start a conversation and it shows up here.", primaryTitle: "New message" } },
  ],
  states: [
    { id: "success", label: "Success", props: { outcome: "success" } },
    { id: "failure", label: "Failure", props: { outcome: "failure" } },
    { id: "empty", label: "Empty", props: { outcome: "empty" } },
  ],
  properties: [
    select("outcome", "Outcome", "success", opts(["success", "Success"], ["failure", "Failure"], ["empty", "Empty"])),
    text("eyebrow", "Eyebrow", "", { maxLength: 30 }),
    text("title", "Title", "Backup complete", { maxLength: 60 }),
    text("message", "Message", "2,418 photos and 36 videos are safe in your library.", { maxLength: 160 }),
    text("primaryTitle", "Button", "Done", { maxLength: 30 }),
    link("link", "Button opens"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const go = linkAction(ctx, p.link);
      const lines = call("OutcomeScreen", [
        ["outcome", `.${s(p, "outcome")}`],
        ["title", str(s(p, "title"))],
        s(p, "message").trim() !== "" && ["message", str(s(p, "message"))],
        s(p, "primaryTitle") !== "Continue" && ["primaryTitle", str(s(p, "primaryTitle"))],
        go && ["primaryAction", go.action],
        s(p, "eyebrow").trim() !== "" && ["eyebrow", str(s(p, "eyebrow"))],
      ]);
      return { lines: go ? attach(lines, go.present) : lines };
    },
  },
};

export const skeletonLoader: SwiftPieceDefinition = {
  id: "skeleton-loader",
  name: "Skeleton Loader",
  category: "pieces",
  description: "A placeholder shape with a soft shimmer while content loads.",
  availability: "free",
  preview: { component: "skeleton-loader" },
  source: piece("SkeletonLoader"),
  docs: docs("feedback", "skeleton-loader"),
  icon: "rectangle.stack",
  concepts: ["enum", "frame", "piece"],
  anatomy: [
    { part: "Shape", props: ["shape"] },
    { part: "Size", props: ["lines", "height"] },
    { part: "State", props: ["failed"] },
  ],
  interactions: ["loading"],
  variants: [
    { id: "text", label: "Text lines", props: { shape: "text", lines: 3 } },
    { id: "avatar", label: "Avatar", props: { shape: "circle", height: 56 } },
    { id: "card", label: "Card", props: { shape: "rounded", height: 160 } },
    { id: "pill", label: "Pill", props: { shape: "capsule", height: 44 } },
  ],
  states: [
    { id: "loading", label: "Loading", props: { failed: false } },
    { id: "failed", label: "Failed", props: { failed: true } },
  ],
  properties: [
    select("shape", "Shape", "text", opts(["rounded", "Rounded"], ["circle", "Circle"], ["capsule", "Capsule"], ["text", "Text lines"])),
    number("lines", "Lines", 3, 1, 6, 1, { when: { prop: "shape", equals: ["text"] } }),
    number("height", "Height", 56, 12, 240, 1, { when: { prop: "shape", notEquals: ["text"] } }),
    bool("failed", "Failed", false, { group: "state", hint: "Stops the shimmer and dims the placeholder, for a load that failed." }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const shape = s(p, "shape");
      const failed = b(p, "failed") ? ", isFailed: true" : "";
      if (shape === "text") return { lines: [`SkeletonLoader(shape: .text(lines: ${num(n(p, "lines"))})${failed})`] };
      const h = num(n(p, "height"));
      const head = shape === "rounded" ? (failed ? "SkeletonLoader(isFailed: true)" : "SkeletonLoader()") : `SkeletonLoader(shape: .${shape}${failed})`;
      return { lines: modifiers([head], [shape === "circle" ? `frame(width: ${h}, height: ${h})` : `frame(height: ${h})`]) };
    },
  },
};

export const statusMorph: SwiftPieceDefinition = {
  id: "status-morph",
  name: "Status Morph",
  category: "pieces",
  description: "One stroke that spins, closes and draws a check or a cross.",
  availability: "free",
  preview: { component: "status-morph" },
  source: piece("StatusMorph"),
  docs: docs("feedback", "status-morph"),
  icon: "arrow.triangle.2.circlepath",
  concepts: ["enum", "animation", "piece"],
  anatomy: [
    { part: "Mark", props: ["state", "size"] },
    { part: "Caption", props: ["captions"] },
  ],
  interactions: ["tap", "loading", "transition"],
  variants: [
    { id: "mark", label: "Mark", props: { captions: false, size: 64 } },
    { id: "captioned", label: "With caption", props: { captions: true, size: 48 } },
    { id: "hero", label: "Large", props: { captions: false, size: 120 } },
  ],
  states: [
    { id: "idle", label: "Idle", props: { state: "idle" } },
    { id: "loading", label: "Loading", props: { state: "loading" } },
    { id: "success", label: "Success", props: { state: "success" } },
    { id: "failure", label: "Failure", props: { state: "failure" } },
  ],
  properties: [
    select("state", "State", "success", opts(["idle", "Idle"], ["loading", "Loading"], ["success", "Success"], ["failure", "Failure"]), { hint: "Tap it in the preview to run loading, then this result." }),
    bool("captions", "Captions (Saving…/Saved)", false),
    number("size", "Size", 64, 24, 200),
  ],
  swift: {
    imports: [],
    emit(p) {
      const size = n(p, "size");
      const lw = Math.max(3, Math.round(size / 16));
      return { lines: call("StatusMorph", [["state", `.${s(p, "state")}`], b(p, "captions") && ["captions", ".saving"], size !== 32 && ["size", num(size)], lw !== 3 && ["lineWidth", num(lw)]]) };
    },
  },
};

// ---------------------------------------------------------------- AI

export const promptChips: SwiftPieceDefinition = {
  id: "prompt-chips",
  name: "Prompt Chips",
  category: "pieces",
  description: "A row of prompt suggestions above a chat composer.",
  availability: "free",
  preview: { component: "prompt-chips" },
  source: piece("PromptChips"),
  docs: docs("ai", "prompt-chips"),
  icon: "bubble.left",
  concepts: ["array", "closure", "piece"],
  anatomy: [{ part: "Suggestions", props: ["suggestions"] }],
  interactions: ["tap", "press", "scroll", "haptic"],
  variants: [
    { id: "work", label: "Work", props: { suggestions: "Summarize this page, Draft a reply, Find action items, Plan my week" } },
    { id: "travel", label: "Travel", props: { suggestions: "Plan a weekend in Lisbon, Pack for rain, Find a quiet cafe" } },
    { id: "code", label: "Code", props: { suggestions: "Explain this error, Write a test, Refactor this view" } },
  ],
  properties: [text("suggestions", "Suggestions", "Summarize this page, Draft a reply, Find action items, Plan my week", { hint: "Separate suggestions with commas.", maxLength: 240 })],
  swift: {
    imports: [],
    emit(p) {
      const items = list(p.suggestions, 8);
      const lines = call("PromptChips", [[null, arr(items.length ? items : ["Ask anything"])]], []);
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ \{\}$/, " { _ in }");
      return { lines };
    },
  },
};

export const thinkingState: SwiftPieceDefinition = {
  id: "thinking-state",
  name: "Thinking State",
  category: "pieces",
  description: "The \"assistant is working\" placeholder: dots, a sheen or a label.",
  availability: "free",
  preview: { component: "thinking-state" },
  source: piece("ThinkingState"),
  docs: docs("ai", "thinking-state"),
  icon: "sparkles",
  concepts: ["enum", "animation", "piece"],
  anatomy: [
    { part: "Presentation", props: ["presentation"] },
    { part: "Label", props: ["text"] },
    { part: "Lines", props: ["lineCount"] },
  ],
  interactions: ["loading", "stream"],
  variants: [
    { id: "sheen", label: "Sheen", props: { presentation: "sheen" } },
    { id: "dots", label: "Dots", props: { presentation: "dots" } },
    { id: "label", label: "Label", props: { presentation: "text" } },
  ],
  properties: [
    select("presentation", "Presentation", "sheen", opts(["dots", "Dots"], ["sheen", "Sheen"], ["text", "Label"])),
    text("text", "Label", "Reading the report", { when: { prop: "presentation", equals: ["text"] }, maxLength: 40 }),
    number("lineCount", "Lines", 3, 1, 6, 1, { when: { prop: "presentation", equals: ["sheen"] } }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const pres = s(p, "presentation");
      if (pres === "text") return { lines: [`ThinkingState(.text(${str(s(p, "text"))}))`] };
      if (pres === "dots") return { lines: ["ThinkingState(.dots)"] };
      return { lines: [n(p, "lineCount") === 3 ? "ThinkingState()" : `ThinkingState(.sheen, lineCount: ${num(n(p, "lineCount"))})`] };
    },
  },
};

// ---------------------------------------------------------------- Text

export const textReveal: SwiftPieceDefinition = {
  id: "text-reveal",
  name: "Text Reveal",
  category: "pieces",
  description: "A headline that rises in word by word, with highlighted phrases.",
  availability: "free",
  preview: { component: "text-reveal" },
  source: piece("TextReveal"),
  docs: docs("text", "text-reveal"),
  icon: "wand.and.stars",
  concepts: ["animation", "font", "piece"],
  anatomy: [
    { part: "Text", props: ["text", "highlights"] },
    { part: "Type", props: ["size", "alignment"] },
    { part: "Motion", props: ["unit", "preset"] },
  ],
  interactions: ["transition", "tap"],
  variants: [
    { id: "headline", label: "Headline", props: { size: 40, alignment: "leading", highlights: "one calm glance" } },
    { id: "centered", label: "Centered", props: { size: 34, alignment: "center" } },
    { id: "plain", label: "No highlight", props: { highlights: "", size: 44 } },
  ],
  properties: [
    text("text", "Text", "Plan the week in one calm glance.", { maxLength: 160 }),
    text("highlights", "Highlight", "one calm glance", { hint: "Phrases to highlight, separated by commas.", maxLength: 120 }),
    number("size", "Size", 40, 16, 72),
    select("alignment", "Alignment", "leading", opts(["leading", "Leading"], ["center", "Center"])),
    select("unit", "Reveal by", "words", opts(["characters", "Characters"], ["words", "Words"], ["lines", "Lines"]), { level: "advanced", pro: true, group: "motion" }),
    select("preset", "Motion", "rise", opts(["rise", "Rise"], ["blur", "Blur"], ["soften", "Soften"]), { level: "advanced", pro: true, group: "motion" }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const hl = list(p.highlights, 4);
      return {
        lines: modifiers(call("TextReveal", [
          [null, str(s(p, "text"))],
          s(p, "unit") !== "words" && ["unit", `.${s(p, "unit")}`],
          s(p, "preset") !== "rise" && ["preset", `.${s(p, "preset")}`],
          s(p, "alignment") !== "leading" && ["alignment", `.${s(p, "alignment")}`],
          hl.length > 0 && ["highlights", arr(hl)],
        ]), [`font(.system(size: ${num(n(p, "size"))}, weight: .bold))`]),
      };
    },
  },
};

export const expandableText: SwiftPieceDefinition = {
  id: "expandable-text",
  name: "Expandable Text",
  category: "pieces",
  description: "A paragraph clamped to a few lines with a \"more\" link.",
  availability: "free",
  preview: { component: "expandable-text" },
  source: piece("ExpandableText"),
  docs: docs("text", "expandable-text"),
  icon: "chevron.down",
  concepts: ["state", "font", "piece"],
  anatomy: [
    { part: "Text", props: ["text"] },
    { part: "Clamp", props: ["lineLimit", "expanded"] },
    { part: "Type", props: ["style"] },
  ],
  interactions: ["expand", "tap"],
  variants: [
    { id: "review", label: "Review", props: { lineLimit: 3, style: "subheadline" } },
    { id: "teaser", label: "One-line teaser", props: { lineLimit: 1, style: "body" } },
    { id: "long", label: "Longer preview", props: { lineLimit: 5, style: "footnote" } },
  ],
  states: [
    { id: "collapsed", label: "Collapsed", props: { expanded: false } },
    { id: "expanded", label: "Expanded", props: { expanded: true } },
  ],
  properties: [
    text("text", "Text", "The best coffee in the neighbourhood, and the pastries are baked every morning. Service is warm, the playlist is quiet and the window seats get the afternoon sun. Worth the walk.", { maxLength: 600 }),
    number("lineLimit", "Lines before \"more\"", 3, 1, 8),
    select("style", "Style", "subheadline", textStyleOptions, { group: "typography" }),
    bool("expanded", "Starts expanded", false, { group: "state", hint: "Tap \"more\" or \"less\" in the preview to switch." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      // Collapsed is the piece's own state; starting expanded needs a binding the screen owns.
      const expanded = b(p, "expanded") ? ctx.state("expanded", "", "true") : null;
      return {
        lines: modifiers(call("ExpandableText", [[null, str(s(p, "text"))], n(p, "lineLimit") !== 3 && ["lineLimit", num(n(p, "lineLimit"))], expanded && ["isExpanded", `$${expanded}`]]), [`font(.${s(p, "style")})`]),
      };
    },
  },
};

// ---------------------------------------------------------------- Navigation, cards

const DOCK_SYMBOLS: Array<[RegExp, string]> = [
  [/home|feed/i, "house"], [/search|find|explore/i, "magnifyingglass"], [/inbox|mail|message/i, "tray"], [/profile|account|me\b/i, "person"],
  [/setting/i, "gearshape"], [/cart|shop|store/i, "cart"], [/calendar|plan|schedule/i, "calendar"], [/stat|chart|insight/i, "chart.bar"],
  [/like|favou?rite|saved/i, "heart"], [/alert|notif/i, "bell"], [/music|listen/i, "music.note"], [/photo|gallery/i, "photo"],
];
export const dockSymbol = (title: string) => DOCK_SYMBOLS.find(([re]) => re.test(title))?.[1] ?? "star";

export const floatingDock: SwiftPieceDefinition = {
  id: "floating-dock",
  name: "Floating Dock",
  category: "pieces",
  description: "A floating tab dock where the selected item becomes a color block.",
  availability: "free",
  preview: { component: "floating-dock" },
  source: piece("FloatingDock"),
  docs: docs("navigation", "floating-dock"),
  icon: "house",
  concepts: ["state", "binding", "array", "sfsymbol", "piece"],
  anatomy: [
    { part: "Tabs", props: ["items"] },
    { part: "Selection", props: ["selected"] },
  ],
  interactions: ["select", "tabs", "spring", "haptic"],
  variants: [
    { id: "four", label: "Four tabs", props: { items: "Home, Search, Inbox, Profile", selected: 0 } },
    { id: "three", label: "Three tabs", props: { items: "Home, Stats, Profile", selected: 1 } },
    { id: "shop", label: "Shop", props: { items: "Home, Search, Cart, Saved, Profile", selected: 0 } },
  ],
  properties: [
    text("items", "Tabs", "Home, Search, Inbox, Profile", { hint: "Separate tab names with commas. Icons follow the names.", maxLength: 120 }),
    number("selected", "Selected", 0, 0, 5, 1, { hint: "0 is the first tab." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const items = list(p.items, 6);
      const safe = items.length ? items : ["Home"];
      const name = ctx.state("selected tab", "", num(Math.min(n(p, "selected"), safe.length - 1)));
      return { lines: callWithArray("FloatingDock", [], { label: "items", items: safe.map((t) => `.init(${str(t)}, systemImage: ${str(dockSymbol(t))})`) }, [["selection", `$${name}`]]) };
    },
  },
};

export const motionCard: SwiftPieceDefinition = {
  id: "motion-card",
  name: "Motion Card",
  category: "pieces",
  description: "A solid color card that tilts with the device, holding anything you put in it.",
  availability: "free",
  preview: { component: "motion-card" },
  card: () => 26,
  source: piece("MotionCard"),
  docs: docs("cards", "motion-card"),
  container: {},
  icon: "creditcard",
  concepts: ["viewbuilder", "gesture", "spring", "piece"],
  anatomy: [
    { part: "Card", props: ["fill", "radius", "height"] },
    { part: "Motion", props: ["maxAngle"] },
  ],
  interactions: ["drag", "spring"],
  variants: [
    { id: "signal", label: "Red", props: { fill: "signal", radius: 26, height: 200 } },
    { id: "sky", label: "Sky", props: { fill: "sky", radius: 26, height: 200 } },
    { id: "butter", label: "Butter, tall", props: { fill: "butter", radius: 32, height: 280 } },
  ],
  properties: [
    select("fill", "Color", "signal", opts(["signal", "Red"], ...houseBlocks.filter((x) => x !== "tangerine").map((b): [string, string] => [b, b[0].toUpperCase() + b.slice(1)]))),
    number("radius", "Corner radius", 26, 0, 44),
    number("height", "Minimum height", 200, 80, 480),
    number("maxAngle", "Tilt angle", 10, 0, 25, 1, { level: "advanced", pro: true }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const fill = s(p, "fill");
      const content = modifiers(call("VStack", [["alignment", ".leading"], ["spacing", "8"]], ctx.children().flat()), ["padding(22)", `frame(maxWidth: .infinity, minHeight: ${num(n(p, "height"))}, alignment: .topLeading)`]);
      return {
        lines: call("MotionCard", [
          n(p, "maxAngle") !== 10 && ["maxAngle", num(n(p, "maxAngle"))],
          n(p, "radius") !== 26 && ["cornerRadius", num(n(p, "radius"))],
          fill !== "signal" && ["style", `.init(fill: ${swiftRGB(house.blocks[fill] ?? house.signal)})`],
          // With a Style, the card is its accent (piece sources keep the house red) with the ink that reads on it.
          fill === "signal" && ctx.theme && ["style", ".init(fill: Theme.accent, foreground: Theme.accentInk)"],
        ], content),
      };
    },
  },
};

export const freePieces: SwiftPieceDefinition[] = [
  elasticButton, commitButton, holdToConfirm,
  formField, secureEntry, amountField, filterRail, scrubStepper,
  taskRow, statusTimeline,
  liveStat, odometer, ringBreakdown,
  ratingScrub, reactionToggle, outcomeScreen, skeletonLoader, statusMorph,
  promptChips, thinkingState,
  textReveal, expandableText,
  floatingDock, motionCard,
];
