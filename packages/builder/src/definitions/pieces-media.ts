// Free Swift Pieces for media, data, text and AI: a story strip, a scrubbable chart, a streaming
// reply, a token field, a paged list, a stretch header and a date range picker. Each emitter calls
// the piece's public API exactly as its Swift source declares it and writes the sample data and
// state that make it run on its own, so the generated screen behaves like the preview.
import { house, houseBlocks, swiftRGB } from "../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../core/swift.js";
import { bool, number, opts, select, text } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const arr = (items: string[]) => `[${items.map(str).join(", ")}]`;
const docs = (category: string, slug: string) => `/docs/components/${category}/${slug}`;
const piece = (name: string) => ({ registry: "free" as const, name });
const chunk = (id: string) => ({ component: id, chunk: "pieces-media" });
const INK = swiftRGB(house.ink);
const block = (name: string) => swiftRGB(house.blocks[name] ?? house.signal);
const blockOptions = houseBlocks.map((x): [string, string] => [x, x[0].toUpperCase() + x.slice(1)]);

/** A modifier whose argument is a closure: `.task {` … `}` under the view, Xcode style. */
function closureModifier(lines: string[], head: string, body: string[]): string[] {
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  return [...lines, `${pad}.${head} {`, ...indent(body, pad ? 2 : 1), `${pad}}`];
}

/** An array literal broken one element per line, as Xcode formats long arrays. */
function arrayLines(head: string, items: string[], tail: string): string[] {
  return [`${head}[`, ...items.map((i, k) => `${INDENT}${i}${k < items.length - 1 ? "," : ""}`), `]${tail}`];
}

// ---------------------------------------------------------------- Story Strip

/** Sample slides, cycled through the house blocks the preview paints them with. */
export const STORY_FILLS = ["tangerine", "butter", "sage", "lilac", "sky", "sand"];

export const storyStrip: SwiftPieceDefinition = {
  id: "story-strip",
  name: "Story Strip",
  category: "pieces",
  description: "Stories-style progress bars that run on their own. Tap the right side to skip, the left to go back, and hold anywhere to pause.",
  availability: "free",
  preview: chunk("story-strip"),
  source: piece("StoryStrip"),
  docs: docs("media", "story-strip"),
  icon: "rectangle.stack",
  concepts: ["zstack", "state", "binding", "gesture", "array"],
  interactions: ["tap", "hold", "haptic", "transition"],
  properties: [
    text("slides", "Slides", "Out early for the good peaches, Twelve stalls and one long queue, Bread and figs for the week, Same time next week", { hint: "One slide per comma. Each becomes a segment.", maxLength: 240 }),
    number("duration", "Seconds per slide", 4, 1, 10, 0.5),
    select("tint", "Bar color", "ink", opts(["ink", "Ink"], ["white", "White"])),
    select("barStyle", "Bars", "standard", opts(["standard", "Standard (badge and hints)"], ["minimal", "Minimal"])),
    number("height", "Height", 480, 240, 700, 10, { group: "layout" }),
    bool("loops", "Loop at the end", true, { group: "interaction", hint: "Start over after the last slide." }),
    number("start", "Starts on slide", 1, 1, 8, 1, { level: "advanced", group: "state" }),
  ],
  variants: [
    { id: "market", label: "Market day", props: { slides: "Out early for the good peaches, Twelve stalls and one long queue, Bread and figs for the week, Same time next week", tint: "ink", barStyle: "standard", duration: 4 } },
    { id: "quick", label: "Quick recap", props: { slides: "Week one, New habits, Best day, Streak kept, What's next, Thank you", duration: 2, barStyle: "minimal", height: 400 } },
    { id: "white", label: "White bars", props: { tint: "white", slides: "Launch day, 1,200 signups, Thank you all", duration: 3 } },
  ],
  states: [
    { id: "first", label: "First slide", props: { start: 1 } },
    { id: "second", label: "Second slide", props: { start: 2 } },
    { id: "last", label: "Last slide", props: { start: 4 } },
  ],
  anatomy: [
    { part: "Slides", props: ["slides", "height"] },
    { part: "Bars", props: ["tint", "barStyle"] },
    { part: "Clock", props: ["duration", "loops", "start"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const slides = storySlides(p);
      const current = ctx.state("story", "", num(Math.min(slides.length, Math.max(1, n(p, "start"))) - 1));
      const ink = s(p, "tint") === "ink";
      const textColor = ink ? INK : ".white";
      const fills = slides.map((_, i) => block(STORY_FILLS[i % STORY_FILLS.length]));
      const minimal = s(p, "barStyle") === "minimal";
      // An ink strip puts its badge and chevrons on the slide color, as the example does.
      const style = minimal ? ".minimal" : ink ? `.init(ink: fills[${current}])` : null;
      const strip = call("StoryStrip", [
        ["count", "slides.count"],
        ["current", `$${current}`],
        ["duration", num(n(p, "duration"))],
        ["tint", ink ? INK : ".white"],
        style && ["style", style],
      ], b(p, "loops") ? [`${current} = 0`] : null);
      const body = [
        ...arrayLines("let slides = ", slides.map(str), ""),
        ...arrayLines("let fills = ", fills, ""),
        ...modifiers([`fills[${current}]`], ink ? [] : ["overlay(.black.opacity(0.12))"]),
        ...modifiers([`Text(slides[${current}])`], [
          "font(.system(size: 40, weight: .bold))",
          "tracking(-1.2)",
          `foregroundStyle(${textColor})`,
          "padding(24)",
          "padding(.bottom, 20)",
          `id(${current})`,
          "transition(.opacity)",
        ]),
        ...strip,
      ];
      return {
        lines: modifiers(call("ZStack", [["alignment", ".bottomLeading"]], body), [
          `frame(height: ${num(n(p, "height"))})`,
          `clipShape(.rect(cornerRadius: ${num(ctx.corner(34))}, style: .continuous))`,
          `animation(.smooth(duration: 0.35), value: ${current})`,
        ]),
      };
    },
  },
};

export function storySlides(p: Props): string[] {
  const slides = list(p.slides, 8);
  return slides.length ? slides : ["Story"];
}

// ---------------------------------------------------------------- Scrub Chart

/** The chart's sample ranges: label, spacing between points in seconds, values (rising). */
export const CHART_RANGES: Array<{ label: string; step: string; values: number[] }> = [
  { label: "1D", step: "1_800", values: [182.1, 182.6, 181.9, 183.4, 184.0, 183.2, 184.8, 185.3, 184.9, 186.1, 185.7, 186.4, 187.0] },
  { label: "1W", step: "21_600", values: [176.3, 177.8, 179.1, 178.2, 180.4, 181.0, 179.7, 182.5, 183.9, 182.8, 184.6, 186.1, 185.4, 187.0] },
  { label: "1M", step: "86_400", values: [191.2, 189.4, 188.0, 186.7, 184.1, 185.9, 183.3, 181.8, 180.2, 182.6, 179.5, 178.1, 180.9, 182.4, 184.7, 187.0] },
  { label: "1Y", step: "2_073_600", values: [142.0, 150.3, 147.8, 158.2, 163.9, 160.1, 171.4, 176.0, 168.3, 179.9, 183.5, 187.0] },
];

/** A range's values for the chosen trend: falling plays the rising series backwards. */
export function chartValues(values: number[], trend: string): number[] {
  return trend === "down" ? [...values].reverse() : values;
}

export const scrubChart: SwiftPieceDefinition = {
  id: "scrub-chart",
  name: "Scrub Chart",
  category: "pieces",
  description: "A price chart you drag across to read any point. Hold still for a moment to measure a range, and switch ranges to watch the line morph.",
  availability: "free",
  preview: chunk("scrub-chart"),
  source: piece("ScrubChart"),
  docs: docs("data", "scrub-chart"),
  icon: "chart.line.uptrend.xyaxis",
  concepts: ["array", "formatstyle", "binding", "gesture", "closure"],
  interactions: ["scrub", "hold", "select", "haptic", "spring"],
  properties: [
    select("mode", "Chart", "line", opts(["line", "Line"], ["bars", "Bars"])),
    select("trend", "Sample data", "up", opts(["up", "Rising"], ["down", "Falling"])),
    bool("currency", "Currency (USD)", true),
    bool("ranges", "Range picker", true, { hint: "1D, 1W, 1M and 1Y. Off shows one week." }),
    select("range", "Starts on", "1", opts(["0", "1D"], ["1", "1W"], ["2", "1M"], ["3", "1Y"]), { when: { prop: "ranges", equals: [true] }, group: "state" }),
    select("tint", "Line color", "text", opts(["text", "Ink (default)"], ...blockOptions), { group: "color" }),
    bool("card", "On a card", true, { group: "shape" }),
    number("height", "Height", 340, 220, 480, 10, { group: "layout" }),
  ],
  variants: [
    { id: "stock", label: "Stock", props: { mode: "line", trend: "up", currency: true, ranges: true } },
    { id: "bars", label: "Bars", props: { mode: "bars", ranges: true, range: "0", tint: "text" } },
    { id: "falling", label: "Falling", props: { trend: "down", tint: "tangerine" } },
    { id: "plain", label: "One range", props: { ranges: false, currency: false, card: false, height: 280 } },
  ],
  states: [
    { id: "day", label: "1D", props: { ranges: true, range: "0" } },
    { id: "week", label: "1W", props: { ranges: true, range: "1" } },
    { id: "year", label: "1Y", props: { ranges: true, range: "3" } },
  ],
  anatomy: [
    { part: "Readout", props: ["currency"] },
    { part: "Plot", props: ["mode", "trend", "tint", "height"] },
    { part: "Range picker", props: ["ranges", "range"] },
    { part: "Card", props: ["card"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const ranges = b(p, "ranges") ? CHART_RANGES : [CHART_RANGES[1]];
      const series = ranges.map((r) => {
        const values = chartValues(r.values, s(p, "trend"));
        const last = values.length - 1;
        return `.init(label: ${str(r.label)}, points: [${values.map(num).join(", ")}].enumerated().map { .init(date: .now.addingTimeInterval(Double($0.offset - ${last}) * ${r.step}), value: $0.element) })`;
      });
      const range = b(p, "ranges") ? ctx.state("range", "", String(Math.min(3, Math.max(0, n(p, "range"))))) : null;
      const tint = s(p, "tint");
      const after = [
        s(p, "mode") === "bars" && `mode: .bars`,
        tint !== "text" && `tint: ${block(tint)}`,
        b(p, "currency") && `format: .currency(code: "USD")`,
        range && `range: $${range}`,
      ].filter((x): x is string => Boolean(x));
      const lines = [
        "ScrubChart(",
        ...indent(arrayLines("series: ", series, after.length ? "," : "")),
        ...after.map((a, i) => `${INDENT}${a}${i < after.length - 1 ? "," : ""}`),
        ")",
      ];
      const mods = [`frame(height: ${num(n(p, "height"))})`];
      if (b(p, "card")) mods.push("padding(20)", `background(ScrubChartStyle.standard.ground, in: .rect(cornerRadius: ${num(ctx.corner(34))}, style: .continuous))`);
      return { lines: modifiers(lines, mods) };
    },
  },
};

// ---------------------------------------------------------------- Streaming Reply

export const streamingReply: SwiftPieceDefinition = {
  id: "streaming-reply",
  name: "Streaming Reply",
  category: "pieces",
  description: "An AI chat message that thinks, then writes itself in word by word behind a blinking cursor. Long press it to copy or regenerate.",
  availability: "free",
  preview: chunk("streaming-reply"),
  source: piece("StreamingReply"),
  docs: docs("ai", "streaming-reply"),
  icon: "sparkles",
  concepts: ["state", "binding", "async", "enum"],
  interactions: ["stream", "hold", "tap", "haptic", "transition"],
  properties: [
    text("text", "Message", "Revenue grew **12%** quarter over quarter and churn fell to 1.8%. The new `Insights` tab drove most of the engagement lift.", { maxLength: 400, hint: "**bold** and `code` are rendered." }),
    select("role", "From", "assistant", opts(["assistant", "Assistant"], ["user", "You"])),
    select("phase", "Starts as", "stream", opts(["stream", "Streams in"], ["thinking", "Thinking"], ["done", "Finished"], ["error", "Error"]), { when: { prop: "role", equals: ["assistant"] }, group: "state" }),
    text("errorMessage", "Error message", "The connection dropped.", { when: { prop: "phase", equals: ["error"] }, maxLength: 60 }),
    select("tint", "Block color", "default", opts(["default", "Default"], ...blockOptions), { group: "color", hint: "Your message block and the streaming cursor." }),
    number("speed", "Milliseconds per word", 90, 30, 400, 10, { level: "advanced", pro: true, group: "motion", when: { prop: "phase", equals: ["stream"] } }),
    number("fadeDuration", "Word fade (s)", 0.35, 0, 1.5, 0.05, { level: "advanced", pro: true, group: "motion" }),
  ],
  variants: [
    { id: "reply", label: "Assistant", props: { role: "assistant", phase: "stream" } },
    { id: "prompt", label: "Your prompt", props: { role: "user", text: "Summarize the **Q3 report** in two lines." } },
    { id: "thinking", label: "Thinking", props: { role: "assistant", phase: "thinking" } },
    { id: "error", label: "Error", props: { role: "assistant", phase: "error", text: "Revenue grew **12%** quarter over" } },
  ],
  states: [
    { id: "thinking", label: "Thinking", props: { role: "assistant", phase: "thinking" } },
    { id: "stream", label: "Streaming", props: { role: "assistant", phase: "stream" } },
    { id: "done", label: "Done", props: { role: "assistant", phase: "done" } },
    { id: "error", label: "Error", props: { role: "assistant", phase: "error" } },
  ],
  anatomy: [
    { part: "Header", props: ["role", "phase"] },
    { part: "Text", props: ["text", "fadeDuration"] },
    { part: "Cursor and block", props: ["tint"] },
    { part: "Streaming", props: ["phase", "speed", "errorMessage"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const user = s(p, "role") === "user";
      const phase = user ? "done" : s(p, "phase");
      const tint = s(p, "tint");
      const fade = n(p, "fadeDuration");
      const extra = [
        tint !== "default" && `tint: ${block(tint)}`,
        !user && fade !== 0.35 && `fadeDuration: ${num(fade)}`,
      ].filter((x): x is string => Boolean(x));
      if (user) {
        const name = ctx.state("prompt", "", str(s(p, "text")));
        return { lines: [`StreamingReply(${[`text: $${name}`, "role: .user", ...extra].join(", ")})`] };
      }
      if (phase === "stream") {
        const reply = ctx.state("reply", "", '""');
        const status = ctx.state("reply phase", "StreamingReply.Phase", ".thinking");
        const lines = [`StreamingReply(${[`text: $${reply}`, `phase: ${status}`, ...extra].join(", ")})`];
        return {
          lines: closureModifier(lines, "task", [
            `let full = ${str(s(p, "text"))}`,
            "try? await Task.sleep(for: .seconds(1.2))",
            `${status} = .streaming`,
            'for word in full.split(separator: " ") {',
            `${INDENT}${reply} += (${reply}.isEmpty ? "" : " ") + word`,
            `${INDENT}try? await Task.sleep(for: .milliseconds(${num(n(p, "speed"))}))`,
            "}",
            `${status} = .done`,
          ]),
        };
      }
      const reply = ctx.state("reply", "", phase === "thinking" ? '""' : str(s(p, "text")));
      const phaseArg = phase === "thinking" ? "phase: .thinking" : phase === "error" ? `phase: .error(${str(s(p, "errorMessage"))})` : null;
      const args = [`text: $${reply}`, phaseArg, ...extra].filter(Boolean) as string[];
      return { lines: call("StreamingReply", args.map((a): [null, string] => [null, a])) };
    },
  },
};

// ---------------------------------------------------------------- Token Field

export const tokenField: SwiftPieceDefinition = {
  id: "token-field",
  name: "Token Field",
  category: "pieces",
  description: "A field that turns what you type into color chips. Press return or type a comma to add one; tap its x, or backspace twice on an empty field, to remove it.",
  availability: "free",
  preview: chunk("token-field"),
  source: piece("TokenField"),
  docs: docs("inputs", "token-field"),
  icon: "tag",
  concepts: ["state", "binding", "array", "textfield", "closure"],
  interactions: ["type", "tap", "select", "haptic", "transition"],
  properties: [
    text("placeholder", "Placeholder", "Add skills", { maxLength: 40 }),
    text("tokens", "Starting tokens", "Swift, SwiftUI, Figma", { hint: "Separate tokens with commas.", maxLength: 200 }),
    text("suggestions", "Suggestions", "Swift, SwiftData, SwiftUI, Combine, Core Data, CloudKit, Figma, Framer, Metal, TypeScript, Rust, Accessibility", { hint: "Listed under the field as you type. Leave empty for none.", maxLength: 300 }),
    number("maxTokens", "Limit", 8, 0, 30, 1, { hint: "0 means no limit." }),
    bool("emails", "Email addresses only", false, { hint: "Rejects anything that isn't an email, and space also commits." }),
    bool("allowsDuplicates", "Allow duplicates", false, { level: "advanced" }),
  ],
  variants: [
    { id: "skills", label: "Skills", props: { placeholder: "Add skills", tokens: "Swift, SwiftUI, Figma", emails: false, maxTokens: 8 } },
    { id: "recipients", label: "Recipients", props: { placeholder: "To", tokens: "maya@studio.co", suggestions: "", emails: true, maxTokens: 0 } },
    { id: "tags", label: "Tags", props: { placeholder: "Add a tag", tokens: "Travel, Food", suggestions: "Travel, Food, Friends, Family, Work, Weekend, Recipes", maxTokens: 5 } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { tokens: "" } },
    { id: "some", label: "Some tokens", props: { tokens: "Swift, SwiftUI, Figma" } },
    { id: "full", label: "At the limit", props: { tokens: "Swift, SwiftUI, Figma, Metal, Combine", maxTokens: 5 } },
  ],
  anatomy: [
    { part: "Chips", props: ["tokens", "allowsDuplicates"] },
    { part: "Input", props: ["placeholder", "emails"] },
    { part: "Suggestions", props: ["suggestions"] },
    { part: "Limit", props: ["maxTokens"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const emails = b(p, "emails");
      const name = ctx.state(emails ? "recipients" : s(p, "placeholder").replace(/^add\s+(an?\s+)?/i, "") || "tokens", "[String]", arr(list(p.tokens, 30)));
      const suggestions = list(p.suggestions, 30);
      const lines = call("TokenField", [
        [null, str(s(p, "placeholder"))],
        ["tokens", `$${name}`],
        suggestions.length > 0 && ["suggestions", arr(suggestions)],
        n(p, "maxTokens") > 0 && ["maxTokens", num(n(p, "maxTokens"))],
        b(p, "allowsDuplicates") && ["allowsDuplicates", "true"],
        emails && ["separators", "[.return, .comma, .semicolon, .space, .newline]"],
      ]);
      if (!emails) return { lines };
      lines[lines.length - 1] += ' { $0.contains("@") && $0.contains(".") }';
      return { lines: modifiers(lines, ["keyboardType(.emailAddress)", "textContentType(.emailAddress)", "textInputAutocapitalization(.never)", "autocorrectionDisabled()"]) };
    },
  },
};

// ---------------------------------------------------------------- Paged List

export const MERCHANTS = ["Juniper Coffee", "Riverside Books", "Northline Transit", "Maison Bakery", "Studio Nine", "Fieldhouse Gym", "Almanac Market", "Sprig Florist", "Harbor Hardware", "Drift Records"];
export const RECEIPT_TILES = ["butter", "sky", "sage", "lilac", "sand", "tangerine"];
/** The sample amount for receipt n, the same in the preview and the generated fetch. */
export const receiptAmount = (i: number) => ((i * 37) % 90) + 4.5;

export const pagedList: SwiftPieceDefinition = {
  id: "paged-list",
  name: "Paged List",
  category: "pieces",
  description: "An endless list that loads the next page as you scroll near the bottom, with skeleton rows, a spinner, a retry chip when a page fails and a quiet footer at the end.",
  availability: "free",
  preview: chunk("paged-list"),
  // With Style → Lists: rows as the theme's cards, rows with hairlines in one card, or plain rows
  // with hairlines on the ground.
  listStyle: (mode) => (mode === "cards" ? { layout: "plain", listed: "cards" } : { layout: "list", listed: mode }),
  source: piece("PagedList"),
  docs: docs("lists", "paged-list"),
  icon: "list.bullet",
  concepts: ["async", "closure", "foreach", "struct"],
  interactions: ["scroll", "loading", "pull", "tap", "haptic"],
  properties: [
    number("pages", "Pages", 3, 1, 10, 1, { hint: "How many pages the sample API has before the end." }),
    number("pageSize", "Rows per page", 12, 4, 40, 1),
    select("layout", "Layout", "list", opts(["list", "List"], ["plain", "Cards"])),
    text("endMessage", "End message", "You're all caught up", { maxLength: 40, hint: "Leave empty to hide the footer." }),
    bool("failsOnce", "Page 2 fails once", false, { group: "state", hint: "Shows the retry chip, the way a flaky network would." }),
    number("height", "Height", 520, 280, 760, 10, { group: "layout" }),
    number("delay", "Load time (s)", 0.8, 0.2, 3, 0.1, { level: "advanced", pro: true, group: "motion" }),
  ],
  variants: [
    { id: "receipts", label: "Receipts", props: { layout: "list", failsOnce: false, pages: 3 } },
    { id: "cards", label: "Cards", props: { layout: "plain" } },
    { id: "flaky", label: "Flaky network", props: { failsOnce: true, pages: 4 } },
  ],
  states: [
    { id: "loading", label: "Loading more", props: { failsOnce: false } },
    { id: "error", label: "Page fails", props: { failsOnce: true } },
    { id: "end", label: "One page", props: { pages: 1 } },
  ],
  anatomy: [
    { part: "Rows", props: ["pageSize", "layout"] },
    { part: "Pages", props: ["pages", "delay", "failsOnce"] },
    { part: "Footer", props: ["endMessage"] },
    { part: "Frame", props: ["height"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const size = n(p, "pageSize");
      const plain = s(p, "layout") === "plain";
      const listed = p.listed === "cards" || p.listed === "grouped" || p.listed === "plain" ? p.listed : null;
      const fails = b(p, "failsOnce");
      const end = s(p, "endMessage").trim();
      // PagedList needs an Identifiable item: a sample Purchase model at file scope, with the data
      // the stand-in API pages through. In your app, pass your own model and loader.
      ctx.declare("Purchase", [
        "/// A sample row model for the paged list. Swap in your own Identifiable type.",
        "struct Purchase: Identifiable, Sendable {",
        `${INDENT}let id: Int`,
        `${INDENT}let merchant: String`,
        `${INDENT}let amount: Double`,
        "",
        `${INDENT}static let merchants = ${arr(MERCHANTS.slice(0, 6))}`,
        ...indent(arrayLines("static let tiles: [Color] = ", RECEIPT_TILES.map(block), "")),
        "}",
      ]);
      if (fails) {
        ctx.declare("FlakyNetwork", [
          "/// Fails the first request it sees, so the list shows its retry chip.",
          "actor FlakyNetwork {",
          `${INDENT}static let shared = FlakyNetwork()`,
          `${INDENT}private var failed = false`,
          "",
          `${INDENT}func failsOnce() -> Bool {`,
          `${INDENT}${INDENT}defer { failed = true }`,
          `${INDENT}${INDENT}return !failed`,
          `${INDENT}}`,
          "}",
        ]);
      }
      const fetch = [
        `try await Task.sleep(for: .milliseconds(${num(Math.round(n(p, "delay") * 1000))}))`,
        fails && "if page == 2, await FlakyNetwork.shared.failsOnce() { throw URLError(.networkConnectionLost) }",
        `guard page <= ${num(n(p, "pages"))} else { return [] }`,
        `return (0..<${num(size)}).map { offset in`,
        `${INDENT}let n = (page - 1) * ${num(size)} + offset`,
        `${INDENT}return Purchase(id: n, merchant: Purchase.merchants[n % Purchase.merchants.count], amount: Double((n * 37) % 90) + 4.5)`,
        "}",
      ].filter((x): x is string => Boolean(x));
      const row = modifiers(
        call("HStack", [["spacing", "12"]], [
          ...modifiers(["Text(String(purchase.merchant.prefix(1)))"], [
            "font(.headline)",
            `foregroundStyle(${INK})`,
            "frame(width: 44, height: 44)",
            `background(Purchase.tiles[purchase.id % Purchase.tiles.count], in: .rect(cornerRadius: ${num(ctx.corner(13))}, style: .continuous))`,
          ]),
          ...call("VStack", [["alignment", ".leading"], ["spacing", "2"]], [
            ...modifiers(["Text(purchase.merchant)"], ["font(.body.weight(.semibold))"]),
            ...modifiers([`Text("Receipt \\(1040 + purchase.id)")`], ["font(.subheadline)", "foregroundStyle(.secondary)"]),
          ]),
          "Spacer(minLength: 8)",
          ...modifiers([`Text(purchase.amount, format: .currency(code: "USD"))`], ["font(.body.weight(.medium))", "monospacedDigit()"]),
        ]),
        [
          plain ? "padding(12)" : "padding(.vertical, 6)",
          plain && (listed ? `themeCard(cornerRadius: ${num(ctx.corner(16))})` : `background(.fill.quaternary, in: .rect(cornerRadius: ${num(ctx.corner(20))}, style: .continuous))`),
          !plain && "listRowBackground(Color.clear)",
          // In a styled list (grouped or plain) the hairlines show.
          !plain && !listed && "listRowSeparator(.hidden)",
        ],
      );
      const listArgs = [
        `pageSize: ${num(size)}`,
        plain && "layout: .plain",
        end !== "You're all caught up" && `endMessage: ${end ? str(end) : "nil"}`,
      ].filter((x): x is string => Boolean(x));
      const lines = [`PagedList(${listArgs.join(", ")}) { page -> [Purchase] in`, ...indent(fetch), "} row: { purchase in", ...indent(row), "}"];
      return {
        lines: modifiers(lines, [
          !plain && "scrollContentBackground(.hidden)",
          `frame(height: ${num(n(p, "height"))})`,
          listed === "grouped" && `themeCard(cornerRadius: ${num(ctx.corner(16))})`,
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Stretch Header

export const stretchHeader: SwiftPieceDefinition = {
  id: "stretch-header",
  name: "Stretch Header",
  category: "pieces",
  description: "A big color hero at the top of a scrolling screen. Pull down and it stretches; scroll up and its title shrinks into the navigation bar. Put your content inside it.",
  availability: "free",
  preview: chunk("stretch-header"),
  source: piece("StretchHeader"),
  docs: docs("navigation", "stretch-header"),
  icon: "photo",
  container: {},
  concepts: ["scrollview", "viewbuilder", "state", "modifier", "navigation"],
  interactions: ["scroll", "pull", "haptic", "transition"],
  properties: [
    text("title", "Title", "Mist Trail", { maxLength: 40 }),
    text("eyebrow", "Eyebrow", "Yosemite · Hike 04", { maxLength: 40, hint: "Small uppercase label above the title. Leave empty for none." }),
    text("meta", "Pinned row", "5.4 mi · 1,000 ft up · 3.5 hours", { maxLength: 60, hint: "Stays under the bar once the hero scrolls away. Leave empty for none." }),
    select("hero", "Hero color", "sage", opts(...blockOptions), { group: "color" }),
    bool("sun", "Sun shape", true, { group: "color", hint: "A butter circle in the hero's corner." }),
    number("height", "Hero height", 300, 200, 420, 10, { group: "layout" }),
    number("titleSize", "Title size", 40, 28, 60, 1, { level: "advanced", pro: true, group: "typography" }),
  ],
  variants: [
    { id: "trail", label: "Trail", props: { title: "Mist Trail", eyebrow: "Yosemite · Hike 04", hero: "sage", sun: true } },
    { id: "recipe", label: "Recipe", props: { title: "Peach galette", eyebrow: "Summer · 45 min", meta: "Serves 6 · Easy · Vegetarian", hero: "tangerine", sun: false } },
    { id: "trip", label: "Trip", props: { title: "Lisbon", eyebrow: "October · 5 nights", meta: "3 bookings · 2 travellers", hero: "sky", sun: true, height: 340 } },
  ],
  anatomy: [
    { part: "Hero", props: ["hero", "sun", "height"] },
    { part: "Title", props: ["title", "eyebrow", "titleSize"] },
    { part: "Pinned row", props: ["meta"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const progress = ctx.state("header progress", "CGFloat", "0");
      const title = str(s(p, "title"));
      const eyebrow = s(p, "eyebrow").trim();
      const meta = s(p, "meta").trim();
      const size = n(p, "titleSize");
      const hero = b(p, "sun")
        ? call("ZStack", [["alignment", ".topTrailing"]], [block(s(p, "hero")), ...modifiers(["Circle()"], [`fill(${block("butter")})`, "frame(width: 190)", "offset(x: 50, y: -40)"])])
        : [block(s(p, "hero"))];
      const header = call("StretchHeader", [
        ["title", title],
        n(p, "height") !== 280 && ["height", num(n(p, "height"))],
        ["progress", `$${progress}`],
        eyebrow && ["eyebrow", str(eyebrow)],
        size !== 40 && ["style", `StretchHeaderStyle(titleColor: ${INK}, titleSize: ${num(size)})`],
      ], hero);
      if (meta) {
        header[header.length - 1] = "} subtitle: {";
        header.push(
          ...indent(modifiers([`Text(${str(meta.toUpperCase())})`], [
            "font(.system(size: 12, weight: .semibold))",
            "tracking(1.2)",
            "foregroundStyle(.secondary)",
            "frame(maxWidth: .infinity, alignment: .leading)",
            "padding(.horizontal, 24)",
            "padding(.vertical, 14)",
          ])),
          "}",
        );
      }
      const kids = ctx.children().flat();
      const content = kids.length
        ? modifiers(call("VStack", [["alignment", ".leading"], ["spacing", num(ctx.space(16))]], kids), [`padding(${num(ctx.space(24))})`])
        : modifiers(call("VStack", [["spacing", "12"]], call("ForEach", [[null, "0..<8"], ["id", "\\.self"]], [
            ...modifiers([`RoundedRectangle(cornerRadius: ${num(ctx.corner(18))}, style: .continuous)`], ["fill(.fill.tertiary)", "frame(height: 64)"]),
          ]).map((l, i) => (i === 0 ? l.replace(" {", " { _ in") : l))), ["padding(20)"]);
      return { lines: modifiers(call("ScrollView", [], [...header, ...content]), [`stretchHeaderBar(title: ${title}, progress: ${progress})`]) };
    },
  },
};

// ---------------------------------------------------------------- Date Range Picker

export const dateRangePicker: SwiftPieceDefinition = {
  id: "date-range-picker",
  name: "Date Range Picker",
  category: "pieces",
  description: "A month calendar for picking a stay: tap a start day, tap an end day, and a band fills the days between. Swipe or use the arrows to change months.",
  availability: "free",
  preview: chunk("date-range-picker"),
  source: piece("DateRangePicker"),
  docs: docs("inputs", "date-range-picker"),
  icon: "calendar",
  concepts: ["state", "binding", "range", "closure", "enum"],
  interactions: ["tap", "select", "swipe", "haptic", "transition"],
  properties: [
    select("counting", "Count", "nights", opts(["nights", "Nights (hotel stay)"], ["days", "Days (both ends count)"])),
    number("length", "Starts selected", 4, 0, 14, 1, { group: "state", hint: "A range starting today, in nights or days. 0 starts empty." }),
    number("maximumLength", "Longest range", 0, 0, 60, 1, { hint: "0 means no limit." }),
    bool("futureOnly", "Future dates only", true, { hint: "Today through the next 12 months." }),
    bool("weekendsSoldOut", "Weekends sold out", false, { hint: "Struck-through days a range can't include." }),
    bool("showsSummary", "Summary line", true),
  ],
  variants: [
    { id: "stay", label: "Hotel stay", props: { counting: "nights", length: 4, maximumLength: 0, weekendsSoldOut: false } },
    { id: "weekdays", label: "Weekdays only", props: { counting: "days", length: 0, weekendsSoldOut: true, maximumLength: 5 } },
    { id: "short", label: "Up to a week", props: { counting: "nights", length: 2, maximumLength: 7 } },
    { id: "bare", label: "Calendar only", props: { showsSummary: false, length: 0 } },
  ],
  states: [
    { id: "empty", label: "Nothing picked", props: { length: 0 } },
    { id: "picked", label: "Range picked", props: { length: 4 } },
  ],
  anatomy: [
    { part: "Summary", props: ["showsSummary", "counting"] },
    { part: "Month grid", props: ["futureOnly", "weekendsSoldOut"] },
    { part: "Range", props: ["length", "maximumLength", "counting"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const nights = s(p, "counting") === "nights";
      const length = n(p, "length");
      const span = nights ? length : length - 1;
      const initial = length <= 0 ? "nil" : span === 0 ? "Date.now...Date.now" : `Date.now...Date.now.addingTimeInterval(${num(span)} * 86_400)`;
      const name = ctx.state(nights ? "stay" : "dates", "ClosedRange<Date>?", initial);
      return {
        lines: call("DateRangePicker", [
          ["selection", `$${name}`],
          b(p, "futureOnly") && ["in", "Date.now...Date.now.addingTimeInterval(365 * 86_400)"],
          b(p, "weekendsSoldOut") && ["isDateDisabled", "{ Calendar.current.isDateInWeekend($0) }"],
          n(p, "maximumLength") > 0 && ["maximumLength", num(n(p, "maximumLength"))],
          nights && ["counting", ".nights"],
          !b(p, "showsSummary") && ["showsSummary", "false"],
        ]),
      };
    },
  },
};

export const mediaPieces: SwiftPieceDefinition[] = [storyStrip, scrubChart, streamingReply, tokenField, pagedList, stretchHeader, dateRangePicker];

/** Which of these take all the width they are offered (see react/preview/fills.ts). */
export const mediaFills: Record<string, boolean> = {
  "story-strip": true,
  "scrub-chart": true,
  "streaming-reply": true,
  "token-field": true,
  "paged-list": true,
  "stretch-header": true,
  "date-range-picker": true,
};
