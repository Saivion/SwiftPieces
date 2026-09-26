// Free SwiftPieces components in the builder. Each emitter calls the piece's public API exactly as
// its Swift source declares it (argument labels, order and defaults), and names the registry entry
// so the project export can include the source file. Only arguments that differ from the Swift
// default are written, so the generated call reads like hand-written code.
import { house, houseBlocks, swiftRGB } from "../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../core/schema.js";
import { type Arg, INDENT, call, list, modifiers, num, str } from "../core/swift.js";
import { bool, icon, number, opts, select, text, textStyleOptions } from "./shared.js";

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

const docs = (category: string, slug: string) => `/docs/components/${category}/${slug}`;
const piece = (name: string) => ({ registry: "free" as const, name });

// ---------------------------------------------------------------- Controls

export const elasticButton: SwiftPieceDefinition = {
  id: "elastic-button",
  name: "Elastic Button",
  category: "pieces",
  description: "A button style that squashes toward your finger and springs back.",
  availability: "free",
  preview: { component: "elastic-button" },
  source: piece("ElasticButton"),
  docs: docs("controls", "elastic-button"),
  concepts: ["buttonstyle", "modifier", "spring"],
  properties: [
    text("title", "Text", "Reserve table", { maxLength: 40 }),
    icon("icon", "Icon", "arrow.right"),
    select("iconPosition", "Icon position", "trailing", opts(["leading", "Before text"], ["trailing", "After text"]), { when: { prop: "icon", notEquals: ["none"] } }),
    select("style", "Style", "signal", opts(["signal", "Signal"], ["raised", "Raised"], ["standard", "Text only"], ...houseBlocks.map((b): [string, string] => [`block:${b}`, `Block · ${b}`]))),
    bool("fullWidth", "Full width", true),
    bool("disabled", "Disabled", false, { level: "advanced" }),
    number("squash", "Squash", 0.96, 0.85, 0.99, 0.01, { level: "advanced", pro: true, hint: "How far the button presses in." }),
    number("bounce", "Bounce", 0.2, 0, 0.6, 0.05, { level: "advanced", pro: true, hint: "Spring bounce on release." }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const title = str(s(p, "title"));
      const ic = s(p, "icon");
      let label: string[] = ic === "none" ? [`Text(${title})`] : s(p, "iconPosition") === "trailing" ? call("HStack", [["spacing", "8"]], [`Text(${title})`, `Image(systemName: ${str(ic)})`]) : [`Label(${title}, systemImage: ${str(ic)})`];
      if (b(p, "fullWidth")) label = modifiers(label, ["frame(maxWidth: .infinity)"]);
      const style = s(p, "style");
      const styleExpr = style.startsWith("block:") ? `.block(.${style.slice(6)})` : `.${style}`;
      const custom = n(p, "squash") !== 0.96 || n(p, "bounce") !== 0.2;
      const buttonStyle = custom
        ? `.elastic(${[n(p, "squash") !== 0.96 && `squash: ${num(n(p, "squash"))}`, n(p, "bounce") !== 0.2 && `bounce: ${num(n(p, "bounce"))}`, style !== "standard" && `style: ${styleExpr}`].filter(Boolean).join(", ")})`
        : style === "standard" ? ".elastic" : `.elastic(${styleExpr})`;
      return { lines: modifiers(call("Button", [["action", "{}"]], label), [`buttonStyle(${buttonStyle})`, b(p, "disabled") && "disabled(true)"]) };
    },
  },
};

export const commitButton: SwiftPieceDefinition = {
  id: "commit-button",
  name: "Commit Button",
  category: "pieces",
  description: "An async button that shows loading, success and error in place.",
  availability: "free",
  preview: { component: "commit-button" },
  source: piece("CommitButton"),
  docs: docs("controls", "commit-button"),
  concepts: ["state", "binding", "async", "closure"],
  properties: [
    text("title", "Text", "Save changes", { maxLength: 40 }),
    text("successTitle", "Success text", "Saved", { maxLength: 30 }),
    select("phase", "Starts as", "idle", opts(["idle", "Ready"], ["loading", "Loading"], ["success", "Success"], ["error", "Error"], ["disabled", "Disabled"]), { hint: "The initial phase. Tapping runs the action." }),
    text("errorMessage", "Error message", "Couldn't save", { when: { prop: "phase", equals: ["error"] }, maxLength: 40 }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const phase = s(p, "phase");
      const initial = phase === "error" ? `.error(${str(s(p, "errorMessage"))})` : `.${phase}`;
      const name = ctx.state(`${s(p, "title")} phase`, "CommitButton.Phase", initial);
      const action = [`${name} = .loading`, "Task {", `${INDENT}try? await Task.sleep(for: .seconds(1))`, `${INDENT}${name} = .success`, "}"];
      return { lines: call("CommitButton", [[null, str(s(p, "title"))], ["phase", `$${name}`], s(p, "successTitle").trim() !== "" && ["successTitle", str(s(p, "successTitle").trim())]], action) };
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
  concepts: ["closure", "gesture"],
  properties: [
    text("title", "Text", "Hold to delete", { maxLength: 40 }),
    icon("icon", "Icon", "trash"),
    text("committedTitle", "Confirmed text", "Deleted", { maxLength: 30 }),
    select("style", "Style", "standard", opts(["standard", "Signal"], ["butter", "Butter"])),
    number("duration", "Hold time (s)", 1.2, 0.5, 3, 0.1, { level: "advanced", pro: true }),
  ],
  swift: {
    imports: [],
    emit(p) {
      return {
        lines: call("HoldToConfirm", [
          [null, str(s(p, "title"))],
          s(p, "icon") !== "none" && ["systemImage", str(s(p, "icon"))],
          n(p, "duration") !== 1.2 && ["duration", num(n(p, "duration"))],
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
  concepts: ["state", "binding", "textfield"],
  properties: [
    text("label", "Label", "Email", { maxLength: 40 }),
    text("prompt", "Placeholder", "you@example.com", { maxLength: 60 }),
    text("help", "Help text", "", { maxLength: 80 }),
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
  concepts: ["state", "binding"],
  properties: [text("label", "Label", "Password", { maxLength: 40 }), bool("showsStrength", "Strength bar", true), bool("showsRequirements", "Requirement chips", true)],
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
  concepts: ["state", "binding"],
  properties: [
    text("label", "Label", "Send", { maxLength: 30 }),
    select("currency", "Currency", "USD", opts(["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "Pound"], ["JPY", "Yen"])),
    select("size", "Size", "hero", opts(["hero", "Hero"], ["compact", "Compact"])),
    number("amount", "Starting amount", 0, 0, 1_000_000, 0.01),
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
  concepts: ["state", "binding", "array"],
  properties: [text("options", "Options", "All, Jazz, Hip-Hop, Classical, Ambient", { hint: "Separate options with commas." }), bool("multiple", "Multiple selection", false)],
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
  concepts: ["state", "binding", "range"],
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
  source: piece("TaskRow"),
  docs: docs("lists", "task-row"),
  concepts: ["state", "binding", "enum"],
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
      return { lines: call("TaskRow", [[null, str(s(p, "title"))], ["status", `$${name}`], s(p, "due").trim() !== "" && ["due", str(s(p, "due"))], s(p, "priority") !== "none" && ["priority", `.${s(p, "priority")}`]]) };
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
  concepts: ["array", "enum"],
  properties: [text("steps", "Steps", "Order placed, Packed, Out for delivery, Delivered", { hint: "Separate steps with commas.", maxLength: 200 }), number("current", "Current step", 2, 0, 11, 1, { hint: "0 is the first step." })],
  swift: {
    imports: [],
    emit(p) {
      const steps = list(p.steps);
      const current = n(p, "current");
      const items = (steps.length ? steps : ["Step"]).map((t, i) => `.init(${str(t)}, status: .${i < current ? "complete" : i === current ? "current" : "pending"})`);
      return { lines: callWithArray("StatusTimeline", [], { label: "steps", items }, []) };
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
  source: piece("LiveStat"),
  docs: docs("data", "live-stat"),
  concepts: ["formatstyle"],
  properties: [
    text("label", "Label", "Revenue", { maxLength: 30 }),
    number("value", "Value", 48250.4, -1_000_000_000, 1_000_000_000, 0.01),
    select("format", "Format", "currency", opts(["number", "Number"], ["currency", "Currency (USD)"])),
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
          s(p, "format") === "currency" && ["format", '.currency(code: "USD")'],
          n(p, "delta") !== 0 && ["delta", num(n(p, "delta") / 100)],
          b(p, "sparkline") && ["series", `[${SERIES.map(num).join(", ")}]`],
        ]),
      };
    },
  },
};

export const odometer: SwiftPieceDefinition = {
  id: "odometer",
  name: "Odometer",
  category: "pieces",
  description: "A number whose digits roll like a mechanical counter.",
  availability: "free",
  preview: { component: "odometer" },
  source: piece("Odometer"),
  docs: docs("data", "odometer"),
  concepts: ["formatstyle", "modifier"],
  properties: [number("value", "Value", 12480.55, -1_000_000_000, 1_000_000_000, 0.01), bool("currency", "Currency (USD)", true), number("size", "Size", 48, 16, 96)],
  swift: {
    imports: [],
    emit(p) {
      return { lines: modifiers(call("Odometer", [["value", num(n(p, "value"))], b(p, "currency") && ["format", '.currency(code: "USD")']]), [`font(.system(size: ${num(n(p, "size"))}, weight: .light))`]) };
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
  concepts: ["array", "formatstyle"],
  properties: [
    text("slices", "Slices", "Housing: 1450, Food: 620, Transport: 310, Leisure: 270", { hint: "Label: value, separated by commas.", maxLength: 200 }),
    bool("currency", "Currency (USD)", true),
    bool("legend", "Legend", true),
  ],
  swift: {
    imports: [],
    emit(p) {
      const slices = parseSlices(s(p, "slices"));
      const items = slices.map((x) => `.init(label: ${str(x.label)}, value: ${num(x.value)})`);
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
  concepts: ["state", "binding"],
  properties: [number("rating", "Starting rating", 4, 0, 5, 0.5), bool("labels", "Word labels", true), number("size", "Star size", 36, 16, 60), bool("readOnly", "Read only", false)],
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
  concepts: ["state", "binding"],
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
  concepts: ["enum", "closure"],
  properties: [
    select("outcome", "Outcome", "success", opts(["success", "Success"], ["failure", "Failure"], ["empty", "Empty"])),
    text("eyebrow", "Eyebrow", "", { maxLength: 30 }),
    text("title", "Title", "Backup complete", { maxLength: 60 }),
    text("message", "Message", "2,418 photos and 36 videos are safe in your library.", { maxLength: 160 }),
    text("primaryTitle", "Button", "Done", { maxLength: 30 }),
  ],
  swift: {
    imports: [],
    emit(p) {
      return {
        lines: call("OutcomeScreen", [
          ["outcome", `.${s(p, "outcome")}`],
          ["title", str(s(p, "title"))],
          s(p, "message").trim() !== "" && ["message", str(s(p, "message"))],
          s(p, "primaryTitle") !== "Continue" && ["primaryTitle", str(s(p, "primaryTitle"))],
          s(p, "eyebrow").trim() !== "" && ["eyebrow", str(s(p, "eyebrow"))],
        ]),
      };
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
  concepts: ["enum", "modifier"],
  properties: [
    select("shape", "Shape", "text", opts(["rounded", "Rounded"], ["circle", "Circle"], ["capsule", "Capsule"], ["text", "Text lines"])),
    number("lines", "Lines", 3, 1, 6, 1, { when: { prop: "shape", equals: ["text"] } }),
    number("height", "Height", 56, 12, 240, 1, { when: { prop: "shape", notEquals: ["text"] } }),
  ],
  swift: {
    imports: [],
    emit(p) {
      const shape = s(p, "shape");
      if (shape === "text") return { lines: [`SkeletonLoader(${n(p, "lines") === 1 ? "shape: .text(lines: 1)" : `shape: .text(lines: ${num(n(p, "lines"))})`})`] };
      const h = num(n(p, "height"));
      const head = shape === "rounded" ? "SkeletonLoader()" : `SkeletonLoader(shape: .${shape})`;
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
  concepts: ["enum"],
  properties: [select("state", "State", "success", opts(["idle", "Idle"], ["loading", "Loading"], ["success", "Success"], ["failure", "Failure"])), bool("captions", "Captions (Saving…/Saved)", false), number("size", "Size", 64, 24, 200)],
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
  concepts: ["array", "closure"],
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
  concepts: ["enum"],
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
  concepts: ["modifier", "animation"],
  properties: [
    text("text", "Text", "Plan the week in one calm glance.", { maxLength: 160 }),
    text("highlights", "Highlight", "one calm glance", { hint: "Phrases to highlight, separated by commas.", maxLength: 120 }),
    number("size", "Size", 40, 16, 72),
    select("alignment", "Alignment", "leading", opts(["leading", "Leading"], ["center", "Center"])),
    select("unit", "Reveal by", "words", opts(["characters", "Characters"], ["words", "Words"], ["lines", "Lines"]), { level: "advanced", pro: true }),
    select("preset", "Motion", "rise", opts(["rise", "Rise"], ["blur", "Blur"], ["soften", "Soften"]), { level: "advanced", pro: true }),
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
  concepts: ["modifier"],
  properties: [
    text("text", "Text", "The best coffee in the neighbourhood, and the pastries are baked every morning. Service is warm, the playlist is quiet and the window seats get the afternoon sun. Worth the walk.", { maxLength: 600 }),
    number("lineLimit", "Lines before \"more\"", 3, 1, 8),
    select("style", "Style", "subheadline", textStyleOptions),
  ],
  swift: {
    imports: [],
    emit(p) {
      return { lines: modifiers(call("ExpandableText", [[null, str(s(p, "text"))], n(p, "lineLimit") !== 3 && ["lineLimit", num(n(p, "lineLimit"))]]), [`font(.${s(p, "style")})`]) };
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
  concepts: ["state", "binding", "array"],
  properties: [text("items", "Tabs", "Home, Search, Inbox, Profile", { hint: "Separate tab names with commas. Icons follow the names.", maxLength: 120 }), number("selected", "Selected", 0, 0, 5)],
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
  source: piece("MotionCard"),
  docs: docs("cards", "motion-card"),
  container: {},
  concepts: ["viewbuilder", "modifier"],
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
