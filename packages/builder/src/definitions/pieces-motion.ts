// Free SwiftPieces with gestures and motion: things you throw, flip, drag, scrub and fan. Each
// emitter calls the piece's public initializer exactly as its Swift source declares it (labels,
// order, only the arguments that differ from the defaults). Pieces that take items and a content
// closure get sample data and a small card view written the way you would write it by hand.
import { house, swiftSignal } from "../core/palette.js";
import type { EmitContext, Props, SwiftPieceDefinition } from "../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../core/swift.js";
import { bool, CONTOUR_SWIFT, icon, link, number, opts, select, text } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const dbl = (v: number) => (Number.isInteger(v) ? `${v}.0` : num(v));

const docs = (category: string, slug: string) => `/docs/components/${category}/${slug}`;
const piece = (name: string) => ({ registry: "free" as const, name });

/** `Color(red:green:blue:)` for a house block (tangerine, sky, butter, sage, lilac, sand). */
export function blockSwift(id: string): string {
  const v = (house.blocks[id] ?? house.signal).replace("#", "");
const sig = swiftSignal(v);
if (sig) return sig;
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
}
/** The house ink, the dark text every block carries. */
const INK = "Color(red: 0.078, green: 0.078, blue: 0.078)";

export const BLOCKS = ["tangerine", "sky", "butter", "sage", "lilac", "sand"];
const blockOpts = opts(...BLOCKS.map((k): [string, string] => [k, k[0].toUpperCase() + k.slice(1)]));
/** Card colors for item lists: one block for every card, or the house blocks in turn. */
const paletteOpts = opts(["mixed", "Mixed blocks"], ...BLOCKS.map((k): [string, string] => [k, k[0].toUpperCase() + k.slice(1)]));
export const MIXED = ["sky", "butter", "sage", "lilac", "tangerine", "sand"];
/** The block a card at `index` gets for a palette prop. */
export const cardBlock = (palette: string, index: number) => (palette === "mixed" ? MIXED[index % MIXED.length] : palette);

/** Unique, non-empty items of a comma list (item ids are their titles, so duplicates would collide). */
export function uniqueList(value: unknown, max = 8, fallback = "Item"): string[] {
  const out = [...new Set(list(value, max))];
  return out.length ? out : [fallback];
}

/**
 * `Name(a, b: c)`, broken one argument per line when long or when an argument spans lines, with
 * optional trailing closures (`[label, lines]`, the first unlabeled).
 */
function invoke(name: string, args: Array<string | string[] | null | undefined | false>, closures: Array<[string | null, string[]]> = []): string[] {
  const parts = args.filter((a): a is string | string[] => Boolean(a)).map((a) => (Array.isArray(a) ? a : [a]));
  const inline = parts.every((a) => a.length === 1) && `${name}(${parts.map((a) => a[0]).join(", ")})`.length <= 96;
  let lines: string[];
  if (!parts.length) lines = closures.length ? [name] : [`${name}()`];
  else if (inline) lines = [`${name}(${parts.map((a) => a[0]).join(", ")})`];
  else {
    lines = [`${name}(`];
    parts.forEach((a, i) => {
      const last = i === parts.length - 1;
      a.forEach((l, j) => lines.push(`${INDENT}${l}${j === a.length - 1 && !last ? "," : ""}`));
    });
    lines.push(")");
  }
  closures.forEach(([label, body], i) => {
    const head = i === 0 ? " {" : ` ${label}: {`;
    if (!body.length) {
      lines[lines.length - 1] += `${head}}`;
      return;
    }
    const [first, ...rest] = body;
    // A closure that only declares its parameters ("_, _ in") stays on one line.
    if (!rest.length && first.endsWith(" in")) {
      lines[lines.length - 1] += `${head} ${first} }`;
      return;
    }
    lines[lines.length - 1] += head;
    if (first.endsWith(" in")) lines[lines.length - 1] += ` ${first}`;
    else lines.push(INDENT + first);
    lines.push(...indent(rest));
    lines.push("}");
  });
  return lines;
}

/** An array literal: inline when short, else one element per line with a trailing comma. */
function arrayArg(label: string, items: string[]): string[] {
  const inline = `${label}: [${items.join(", ")}]`;
  if (inline.length <= 72 && items.length <= 1) return [inline];
  return [`${label}: [`, ...items.map((i) => `${INDENT}${i},`), "]"];
}

/**
 * An `Identifiable` model the item-based pieces need, declared once at file scope (private, so two
 * screens can each declare their own), with the sample items as one-line `@State`.
 */
function modelState(ctx: EmitContext, hint: string, model: string, fields: string[], items: string[]): string {
  ctx.declare(`model:${model}`, [`private struct ${model}: Identifiable {`, ...fields.map((f) => `${INDENT}${f}`), "}"]);
  return ctx.state(hint, `[${model}]`, `[${items.join(", ")}]`);
}

const CARD_FIELDS = ["let title: String", "let color: Color", "var id: String { title }"];

/** An uppercase eyebrow line, as the house cards draw it. */
const eyebrowText = (value: string, tracking = "1.2") => modifiers([`Text(${str(value.toUpperCase())})`], ["font(.caption2.weight(.bold))", `tracking(${tracking})`]);

// ---------------------------------------------------------------- Swipe Deck

export const swipeDeck: SwiftPieceDefinition = {
  id: "swipe-deck",
  name: "Swipe Deck",
  category: "pieces",
  description: "A stack of cards you swipe away. Throw the top card left, right or up to decide, and the next one rises into place.",
  availability: "free",
  preview: { component: "swipe-deck", chunk: "pieces-motion" },
  source: piece("SwipeDeck"),
  docs: docs("cards", "swipe-deck"),
  icon: "rectangle.stack",
  concepts: ["state", "binding", "array", "struct", "closure", "gesture"],
  interactions: ["swipe", "drag", "spring", "haptic", "transition"],
  anatomy: [
    { part: "Cards", props: ["items", "eyebrow", "icon", "palette"] },
    { part: "Deck", props: ["height", "visibleCount"] },
    { part: "Outcome badges", props: ["badges"] },
    { part: "Empty slot", props: ["emptyMessage"] },
  ],
  properties: [
    text("items", "Cards", "Miso aubergine, Lemon orzo, Green curry, Harissa chickpeas", { hint: "Separate card titles with commas. The top card is first.", maxLength: 200 }),
    text("eyebrow", "Eyebrow", "Tonight", { maxLength: 24 }),
    icon("icon", "Icon", "fork.knife"),
    select("palette", "Colors", "mixed", paletteOpts),
    bool("badges", "Outcome badges", true, { hint: "Skip, Keep and Save fade in as you drag toward each side." }),
    text("emptyMessage", "When empty", "All caught up", { maxLength: 40, hint: "Shown in the slot left behind. Empty draws nothing." }),
    number("height", "Height", 390, 240, 560, 1, { group: "layout" }),
    number("visibleCount", "Cards in the stack", 3, 1, 5, 1, { level: "advanced", group: "layout" }),
  ],
  variants: [
    { id: "recipes", label: "Recipes", props: { items: "Miso aubergine, Lemon orzo, Green curry, Harissa chickpeas", eyebrow: "Tonight", icon: "fork.knife", palette: "mixed", badges: true } },
    { id: "trips", label: "Weekend trips", props: { items: "Lisbon, Kyoto, Oaxaca, Bergen", eyebrow: "Weekend away", icon: "airplane", palette: "sky", badges: true, height: 340 } },
    { id: "plain", label: "Plain stack", props: { items: "Read later, Podcast queue, Photo dump", eyebrow: "Inbox", icon: "tray", palette: "sand", badges: false, emptyMessage: "" } },
  ],
  states: [{ id: "one-left", label: "Last card", props: { items: "Harissa chickpeas" } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      const titles = uniqueList(p.items, 8, "Card");
      const palette = s(p, "palette");
      const name = modelState(ctx, "cards", "Card", CARD_FIELDS, titles.map((t, i) => `Card(title: ${str(t)}, color: ${blockSwift(cardBlock(palette, i))})`));
      const radius = ctx.corner(34);
      const message = s(p, "emptyMessage").trim();
      const styleArgs = [
        !b(p, "badges") && "leading: nil, trailing: nil, top: nil",
        radius !== 34 && `cornerRadius: ${num(radius)}`,
        message !== "All caught up" && `emptyMessage: ${message ? str(message) : "nil"}`,
      ].filter(Boolean) as string[];
      const style = !b(p, "badges") && !message && radius === 34 ? ".plain" : styleArgs.length ? `.init(${styleArgs.join(", ")})` : null;
      const ic = s(p, "icon");
      const inner = [
        ...(s(p, "eyebrow").trim() ? eyebrowText(s(p, "eyebrow")) : []),
        "Spacer()",
        ...(ic !== "none" ? [...modifiers([`Image(systemName: ${str(ic)})`], ["font(.system(size: 56, weight: .semibold))", "frame(maxWidth: .infinity)"]), "Spacer()"] : []),
        ...modifiers(["Text(card.title)"], ["font(.system(size: 32, weight: .bold))", "tracking(-1.2)", "lineLimit(2)", "minimumScaleFactor(0.7)"]),
      ];
      const face = blockFace(radius, "card.color", call("VStack", [["alignment", ".leading"], ["spacing", "0"]], inner));
      const lines = invoke("SwipeDeck", [`items: $${name}`, n(p, "visibleCount") !== 3 && `visibleCount: ${num(n(p, "visibleCount"))}`, style && `style: ${style}`], [
        [null, ["_, _ in"]],
        ["card", ["card in", ...face]],
      ]);
      return { lines: modifiers(lines, [`frame(height: ${num(n(p, "height"))})`]) };
    },
  },
};

/** A solid block card: a rounded rectangle in `fill` with `stack` laid over it in the house ink. */
function blockFace(radius: number, fill: string, stack: string[], contour = false): string[] {
  return [
    `RoundedRectangle(cornerRadius: ${num(radius)}, style: .continuous)`,
    `${INDENT}.fill(${fill})`,
    ...(contour
      ? [`${INDENT}.overlay {`, `${INDENT}${INDENT}ContourLines().stroke(${INK}.opacity(0.13), lineWidth: 1)`, `${INDENT}${INDENT}${INDENT}.clipShape(.rect(cornerRadius: ${num(radius)}, style: .continuous))`, `${INDENT}}`]
      : []),
    `${INDENT}.overlay(alignment: .topLeading) {`,
    ...indent(modifiers(stack, [`foregroundStyle(${INK})`, "padding(22)"]), 2),
    `${INDENT}}`,
  ];
}

// ---------------------------------------------------------------- Swipe Action Row

type RowAction = { title: string; symbol: string; glyph: string; block: string; destructive?: boolean };
export const ROW_ACTIONS: Record<string, RowAction> = {
  read: { title: "Read", symbol: "envelope.open", glyph: "envelope.open", block: "sky" },
  pin: { title: "Pin", symbol: "pin", glyph: "pin", block: "butter" },
  flag: { title: "Flag", symbol: "flag", glyph: "flag", block: "lilac" },
  delete: { title: "Delete", symbol: "trash", glyph: "trash", block: "tangerine", destructive: true },
  snooze: { title: "Snooze", symbol: "moon.zzz", glyph: "moon", block: "butter" },
  archive: { title: "Archive", symbol: "archivebox", glyph: "tray", block: "sage" },
};
/** Actions per side, in declaration order: the first sits at the screen edge and fires on a full swipe. */
export const LEADING_SETS: Record<string, string[]> = { none: [], read: ["read"], pin: ["pin"], "read-pin": ["read", "pin"] };
export const TRAILING_SETS: Record<string, string[]> = { none: [], "delete-snooze": ["delete", "snooze"], delete: ["delete"], "archive-flag": ["archive", "flag"] };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export const swipeActionRow: SwiftPieceDefinition = {
  id: "swipe-action-row",
  name: "Swipe Action Row",
  category: "pieces",
  description: "A row that slides sideways to reveal actions as solid color tiles. Swipe far enough and the edge action fires on its own.",
  availability: "free",
  preview: { component: "swipe-action-row", chunk: "pieces-motion" },
  card: () => 26,
  // In a styled list the row's card goes clear (its tiles still open in the gap it leaves); it
  // pads itself 16 on the sides and 14 top and bottom.
  list: { bare: { listed: true }, pad: 0, inset: 0 },
  source: piece("SwipeActionRow"),
  docs: docs("lists", "swipe-action-row"),
  icon: "trash",
  concepts: ["array", "closure", "viewbuilder", "hstack", "gesture"],
  interactions: ["swipe", "tap", "spring", "haptic"],
  anatomy: [
    { part: "Row content", props: ["title", "subtitle", "detail"] },
    { part: "Avatar", props: ["avatar", "avatarColor"] },
    { part: "Leading actions", props: ["leading"] },
    { part: "Trailing actions", props: ["trailing"] },
  ],
  properties: [
    text("title", "Title", "Jonas Okafor", { maxLength: 40 }),
    text("subtitle", "Subtitle", "Studio booking for Thursday", { maxLength: 60 }),
    text("detail", "Detail", "8:12", { maxLength: 12 }),
    bool("avatar", "Initials avatar", true),
    select("avatarColor", "Avatar color", "sage", blockOpts, { when: { prop: "avatar", equals: [true] } }),
    select("leading", "Swipe right reveals", "read", opts(["none", "Nothing"], ["read", "Read"], ["pin", "Pin"], ["read-pin", "Read and Pin"]), { group: "interaction" }),
    select("trailing", "Swipe left reveals", "delete-snooze", opts(["none", "Nothing"], ["delete-snooze", "Delete and Snooze"], ["delete", "Delete"], ["archive-flag", "Archive and Flag"]), { group: "interaction" }),
  ],
  variants: [
    { id: "mail", label: "Mail", props: { title: "Jonas Okafor", subtitle: "Studio booking for Thursday", detail: "8:12", avatar: true, avatarColor: "sage", leading: "read", trailing: "delete-snooze" } },
    { id: "task", label: "Task", props: { title: "Renew passport", subtitle: "Due Friday", detail: "", avatar: false, leading: "pin", trailing: "archive-flag" } },
    { id: "delete-only", label: "Delete only", props: { title: "Priya Raman", subtitle: "Notes from the pricing review", detail: "Mon", avatar: true, avatarColor: "lilac", leading: "none", trailing: "delete" } },
  ],
  swift: {
    imports: [],
    emit(p) {
      const listed = p.listed === true;
      const action = (key: string) => {
        const a = ROW_ACTIONS[key];
        const args = [str(a.title), `systemImage: ${str(a.symbol)}`, a.block !== "sky" && `tint: ${blockSwift(a.block)}`, a.destructive && "role: .destructive"].filter(Boolean);
        return `.init(${args.join(", ")}) {}`;
      };
      const lead = (LEADING_SETS[s(p, "leading")] ?? []).map(action);
      const trail = (TRAILING_SETS[s(p, "trailing")] ?? []).map(action);
      const title = s(p, "title");
      const row: string[] = [];
      if (b(p, "avatar")) {
        row.push(...modifiers([`Text(${str(initials(title))})`], [
          "font(.system(size: 15, weight: .bold, design: .rounded))",
          `foregroundStyle(${INK})`,
          "frame(width: 46, height: 46)",
          `background(${blockSwift(s(p, "avatarColor"))}, in: Circle())`,
        ]));
      }
      const texts = [...modifiers([`Text(${str(title)})`], ["font(.headline)"])];
      if (s(p, "subtitle").trim()) texts.push(...modifiers([`Text(${str(s(p, "subtitle"))})`], ["font(.subheadline)", "foregroundStyle(.secondary)", "lineLimit(1)"]));
      row.push(...call("VStack", [["alignment", ".leading"], ["spacing", "3"]], texts));
      row.push("Spacer(minLength: 8)");
      if (s(p, "detail").trim()) row.push(...modifiers([`Text(${str(s(p, "detail"))})`], ["font(.footnote.monospacedDigit())", "foregroundStyle(.secondary)"]));
      const content = modifiers(call("HStack", [["spacing", "14"]], row), ["padding(.horizontal, 16)", "padding(.vertical, 14)"]);
      return {
        lines: invoke("SwipeActionRow", [
          lead.length > 0 && arrayArg("leading", lead),
          trail.length > 0 && arrayArg("trailing", trail),
          listed && ["background: .clear"],
          listed && ["style: { var style = SwipeActionRowStyle(); style.cornerRadius = 12; return style }()"],
        ], [[null, content]]),
      };
    },
  },
};

// ---------------------------------------------------------------- Flip Card

export const flipCard: SwiftPieceDefinition = {
  id: "flip-card",
  name: "Flip Card",
  category: "pieces",
  description: "A two-sided card. Tap it to flip it over in 3D, or drag sideways to turn it by hand.",
  availability: "free",
  preview: { component: "flip-card", chunk: "pieces-motion" },
  card: () => 26,
  source: piece("FlipCard"),
  docs: docs("cards", "flip-card"),
  icon: "arrow.triangle.2.circlepath",
  concepts: ["viewbuilder", "closure", "zstack", "gesture", "spring"],
  interactions: ["tap", "press", "drag", "spring", "haptic"],
  anatomy: [
    { part: "Front", props: ["frontEyebrow", "frontTitle", "frontDetail", "frontFill"] },
    { part: "Back", props: ["backEyebrow", "backText", "backDetail", "backFill"] },
    { part: "Card", props: ["height", "texture", "lift"] },
  ],
  properties: [
    text("frontEyebrow", "Front eyebrow", "Portuguese", { maxLength: 24 }),
    text("frontTitle", "Front title", "Saudade", { maxLength: 30 }),
    text("frontDetail", "Front detail", "noun · sow-DAH-jee", { maxLength: 50 }),
    select("frontFill", "Front color", "butter", blockOpts),
    text("backEyebrow", "Back eyebrow", "Meaning", { maxLength: 24 }),
    text("backText", "Back text", "A deep longing for someone or something far away.", { maxLength: 120 }),
    text("backDetail", "Back detail", "Often heard in fado songs", { maxLength: 50 }),
    select("backFill", "Back color", "sky", blockOpts),
    number("height", "Height", 214, 140, 420, 1, { group: "layout" }),
    select("texture", "Texture", "none", opts(["none", "None"], ["contour", "Contour lines"]), { hint: "Topographic lines over both faces." }),
    number("lift", "Lift mid-turn", 0.06, 0, 0.2, 0.01, { level: "advanced", pro: true, group: "motion", hint: "How far the card rises toward you as it turns." }),
  ],
  variants: [
    { id: "word", label: "Word card", props: { frontEyebrow: "Portuguese", frontTitle: "Saudade", frontDetail: "noun · sow-DAH-jee", frontFill: "butter", backEyebrow: "Meaning", backText: "A deep longing for someone or something far away.", backDetail: "Often heard in fado songs", backFill: "sky" } },
    { id: "quiz", label: "Quiz", props: { frontEyebrow: "Question 4", frontTitle: "Capital of Norway?", frontDetail: "Tap to reveal", frontFill: "lilac", backEyebrow: "Answer", backText: "Oslo, on the Oslofjord.", backDetail: "Founded around 1040", backFill: "sage" } },
    { id: "contour", label: "Contour", props: { frontEyebrow: "Try now · 2 min", frontTitle: "Three sounds", frontDetail: "Tap to turn it over", frontFill: "sand", backEyebrow: "How", backText: "Name three things you can hear, nearest to farthest.", backDetail: "Then one slow breath out", backFill: "sky", texture: "contour" } },
    { id: "gift", label: "Gift card", props: { frontEyebrow: "Gift card", frontTitle: "$50", frontDetail: "From Mara, with love", frontFill: "tangerine", backEyebrow: "Code", backText: "KX4F-99TR-2MLQ", backDetail: "Redeem in Settings", backFill: "sand", height: 200 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const radius = ctx.corner(26);
      const contour = s(p, "texture") === "contour";
      if (contour) ctx.declare("ContourLines", CONTOUR_SWIFT);
      const face = (fill: string, stack: string[]) => blockFace(radius, blockSwift(fill), stack, contour);
      const frontInner: string[] = [];
      if (s(p, "frontEyebrow").trim()) frontInner.push(...eyebrowText(s(p, "frontEyebrow"), "1"));
      frontInner.push("Spacer()");
      frontInner.push(...modifiers([`Text(${str(s(p, "frontTitle"))})`], ["font(.system(size: 46, weight: .bold))", "tracking(-1.8)", "minimumScaleFactor(0.6)", "lineLimit(1)"]));
      if (s(p, "frontDetail").trim()) frontInner.push(...modifiers([`Text(${str(s(p, "frontDetail"))})`], ["font(.subheadline.weight(.medium))", "opacity(0.62)"]));
      const backInner: string[] = [];
      if (s(p, "backEyebrow").trim()) backInner.push(...eyebrowText(s(p, "backEyebrow"), "1"));
      backInner.push(...modifiers([`Text(${str(s(p, "backText"))})`], ["font(.system(size: 22, weight: .bold))", "tracking(-0.6)", "minimumScaleFactor(0.7)"]));
      backInner.push("Spacer(minLength: 0)");
      if (s(p, "backDetail").trim()) backInner.push(...modifiers([`Text(${str(s(p, "backDetail"))})`], ["font(.subheadline.weight(.medium))", "opacity(0.62)"]));
      const front = face(s(p, "frontFill"), call("VStack", [["alignment", ".leading"], ["spacing", "0"]], frontInner));
      const back = face(s(p, "backFill"), call("VStack", [["alignment", ".leading"], ["spacing", "10"]], backInner));
      const styleArgs = [radius !== 26 && `cornerRadius: ${num(radius)}`, n(p, "lift") !== 0.06 && `lift: ${num(n(p, "lift"))}`].filter(Boolean);
      const lines = invoke("FlipCard", [styleArgs.length > 0 && `style: .init(${styleArgs.join(", ")})`], [[null, front], ["back", back]]);
      return { lines: modifiers(lines, [`frame(height: ${num(n(p, "height"))})`]) };
    },
  },
};

// ---------------------------------------------------------------- Depth Carousel

export const depthCarousel: SwiftPieceDefinition = {
  id: "depth-carousel",
  name: "Depth Carousel",
  category: "pieces",
  description: "Paged cards that shrink and fade as they slide away from the center, with a page counter and a dot indicator you can scrub.",
  availability: "free",
  preview: { component: "depth-carousel", chunk: "pieces-motion" },
  source: piece("DepthCarousel"),
  docs: docs("lists", "depth-carousel"),
  icon: "square.grid.2x2",
  concepts: ["array", "struct", "closure", "scrollview", "state"],
  interactions: ["scroll", "swipe", "tap", "scrub", "spring", "haptic"],
  anatomy: [
    { part: "Pages", props: ["items", "eyebrow", "icon", "palette"] },
    { part: "Layout", props: ["itemWidth", "height", "spacing"] },
    { part: "Indicator", props: ["showsIndicator", "showsCounter"] },
    { part: "Depth", props: ["recede"] },
  ],
  properties: [
    text("items", "Pages", "Lisbon, Kyoto, Oaxaca, Bergen", { hint: "Separate page titles with commas.", maxLength: 200 }),
    text("eyebrow", "Eyebrow", "Trip", { maxLength: 24 }),
    icon("icon", "Icon", "airplane"),
    select("palette", "Colors", "mixed", paletteOpts),
    number("itemWidth", "Page width", 270, 180, 340, 1, { group: "layout" }),
    number("height", "Page height", 340, 180, 480, 1, { group: "layout" }),
    number("spacing", "Spacing", 16, 0, 40, 1, { group: "layout", level: "advanced" }),
    bool("showsIndicator", "Indicator", true),
    bool("showsCounter", "Page counter", true, { when: { prop: "showsIndicator", equals: [true] } }),
    number("recede", "Depth", 0.1, 0, 0.3, 0.01, { level: "advanced", pro: true, group: "motion", hint: "How much a page one step from center shrinks." }),
  ],
  variants: [
    { id: "trips", label: "Trips", props: { items: "Lisbon, Kyoto, Oaxaca, Bergen", eyebrow: "Trip", icon: "airplane", palette: "mixed", itemWidth: 270, height: 340 } },
    { id: "playlists", label: "Playlists", props: { items: "Morning run, Deep focus, Slow Sunday, Late drive", eyebrow: "Playlist", icon: "music.note", palette: "lilac", itemWidth: 240, height: 260 } },
    { id: "plans", label: "Plans", props: { items: "Starter, Plus, Studio", eyebrow: "Plan", icon: "sparkles", palette: "mixed", itemWidth: 300, height: 220, showsCounter: false } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const titles = uniqueList(p.items, 8, "Page");
      const palette = s(p, "palette");
      const name = modelState(ctx, "pages", "Page", CARD_FIELDS, titles.map((t, i) => `Page(title: ${str(t)}, color: ${blockSwift(cardBlock(palette, i))})`));
      const width = n(p, "itemWidth");
      const radius = ctx.corner(34);
      const disc = Math.round(width * 0.66);
      const ic = s(p, "icon");
      const top: string[] = [];
      if (s(p, "eyebrow").trim()) top.push(...eyebrowText(s(p, "eyebrow")));
      if (ic !== "none") {
        if (top.length) top.push("Spacer()");
        top.push(...modifiers([`Image(systemName: ${str(ic)})`], ["font(.headline)"]));
      }
      const inner = [
        ...(top.length ? call("HStack", [], top) : []),
        "Spacer()",
        ...modifiers(["Text(page.title)"], ["font(.system(size: 40, weight: .bold))", "tracking(-1.6)", "lineLimit(2)", "minimumScaleFactor(0.6)"]),
      ];
      const pageView = modifiers(call("ZStack", [["alignment", ".topLeading"]], [
        "page.color",
        ...modifiers(["Circle()"], [`fill(${INK})`, `frame(width: ${disc}, height: ${disc})`, `offset(x: ${Math.round(width * 0.55)} + phase * 40, y: ${Math.round(n(p, "height") * 0.19)})`]),
        ...modifiers(call("VStack", [["alignment", ".leading"], ["spacing", "0"]], inner), [`foregroundStyle(${INK})`, "padding(22)", "offset(x: phase * 10)"]),
      ]), [`frame(height: ${num(n(p, "height"))})`, `clipShape(.rect(cornerRadius: ${num(radius)}, style: .continuous))`]);
      const sets = [n(p, "recede") !== 0.1 && `style.recede = ${num(n(p, "recede"))}`, b(p, "showsIndicator") && !b(p, "showsCounter") && "style.showsCounter = false"].filter(Boolean);
      const call1 = invoke("DepthCarousel", [
        name,
        width !== 280 && `itemWidth: ${num(width)}`,
        n(p, "spacing") !== 16 && `spacing: ${num(n(p, "spacing"))}`,
        !b(p, "showsIndicator") && "showsIndicator: false",
        // DepthCarouselStyle has only a no-argument init, so a changed style is built in place.
        sets.length > 0 && `style: { var style = DepthCarouselStyle(); ${sets.join("; ")}; return style }()`,
      ], [[null, ["page, phase in", ...pageView]]]);
      return { lines: call1 };
    },
  },
};

// ---------------------------------------------------------------- Timer Dial

export const timerDial: SwiftPieceDefinition = {
  id: "timer-dial",
  name: "Timer Dial",
  category: "pieces",
  description: "A countdown ring you set by dragging its knob around, like the Clock app's timer. It ticks as you turn it, then counts down when started.",
  availability: "free",
  preview: { component: "timer-dial", chunk: "pieces-motion" },
  source: piece("TimerDial"),
  docs: docs("controls", "timer-dial"),
  icon: "timer",
  concepts: ["state", "binding", "gesture", "button"],
  interactions: ["drag", "tap", "haptic", "spring"],
  anatomy: [
    { part: "Ring", props: ["fill", "showsTicks", "lineWidth", "size"] },
    { part: "Readout", props: ["seconds", "progress", "caption"] },
    { part: "Dial", props: ["mode", "maxSeconds", "step", "warningAt"] },
    { part: "Start button", props: ["showsButton"] },
  ],
  properties: [
    select("mode", "Mode", "countdown", opts(["countdown", "Countdown"], ["progress", "Progress ring"])),
    number("seconds", "Starting seconds", 45, 1, 3600, 1, { when: { prop: "mode", equals: ["countdown"] } }),
    number("maxSeconds", "Full turn (seconds)", 60, 10, 3600, 1, { when: { prop: "mode", equals: ["countdown"] } }),
    select("step", "Step", "5", opts(["1", "1 second"], ["5", "5 seconds"], ["10", "10 seconds"], ["15", "15 seconds"], ["60", "1 minute"]), { when: { prop: "mode", equals: ["countdown"] } }),
    number("progress", "Progress (%)", 72, 0, 100, 1, { when: { prop: "mode", equals: ["progress"] } }),
    text("caption", "Caption", "", { maxLength: 20, hint: "Empty shows the phase: Ready, Remaining, Paused, Done." }),
    select("fill", "Ring color", "tangerine", blockOpts),
    bool("showsTicks", "Minute ticks", true),
    number("size", "Size", 232, 100, 340, 1, { group: "layout" }),
    bool("showsButton", "Start button", true, { when: { prop: "mode", equals: ["countdown"] } }),
    number("warningAt", "Warning at (seconds)", 5, 0, 60, 1, { level: "advanced", when: { prop: "mode", equals: ["countdown"] } }),
    number("lineWidth", "Ring width", 16, 4, 32, 1, { level: "advanced", group: "shape" }),
  ],
  variants: [
    { id: "countdown", label: "Countdown", props: { mode: "countdown", seconds: 45, maxSeconds: 60, step: "5", fill: "tangerine", showsTicks: true, size: 232 } },
    { id: "tea", label: "Tea timer", props: { mode: "countdown", seconds: 240, maxSeconds: 600, step: "15", fill: "sage", caption: "", size: 260 } },
    { id: "progress", label: "Progress ring", props: { mode: "progress", progress: 72, caption: "Uploaded", fill: "sky", showsTicks: false, size: 140, lineWidth: 10 } },
  ],
  states: [
    { id: "warning", label: "Almost done", props: { mode: "countdown", seconds: 5 } },
    { id: "full", label: "Complete", props: { mode: "progress", progress: 100, caption: "Uploaded" } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const lw = n(p, "lineWidth");
      const caption = s(p, "caption").trim();
      const fill = s(p, "fill");
      const styleArgs = [fill !== "tangerine" && `fill: ${blockSwift(fill)}`, !b(p, "showsTicks") && "showsTicks: false"].filter(Boolean);
      const style = fill === "sky" && b(p, "showsTicks") ? ".sky" : styleArgs.length ? `.init(${styleArgs.join(", ")})` : null;
      const size = `frame(width: ${num(n(p, "size"))})`;
      if (s(p, "mode") === "progress") {
        const dial = invoke("TimerDial", [`progress: ${num(n(p, "progress") / 100)}`, lw !== 16 && `lineWidth: ${num(lw)}`, caption && `caption: ${str(caption)}`, style && `style: ${style}`]);
        return { lines: modifiers(dial, [size]) };
      }
      const step = Number(s(p, "step")) || 1;
      const max = Math.max(n(p, "maxSeconds"), step);
      const secs = Math.min(max, Math.max(step, Math.round(n(p, "seconds") / step) * step));
      const seconds = ctx.state("seconds", "", num(secs));
      const running = ctx.state("isRunning", "", "false");
      const dial = modifiers(invoke("TimerDial", [
        `seconds: $${seconds}`,
        `isRunning: $${running}`,
        step !== 1 && `step: ${step}`,
        max !== 60 && `maxSeconds: ${num(max)}`,
        n(p, "warningAt") !== 5 && `warningAt: ${num(n(p, "warningAt"))}`,
        lw !== 16 && `lineWidth: ${num(lw)}`,
        caption && `caption: ${str(caption)}`,
        style && `style: ${style}`,
      ]), [size]);
      if (!b(p, "showsButton")) return { lines: dial };
      const button = modifiers([`Button(${running} ? "Pause" : "Start") {`, `${INDENT}${running}.toggle()`, "}"], ["font(.headline)", "buttonStyle(.borderedProminent)", "buttonBorderShape(.capsule)", "controlSize(.large)"]);
      return { lines: call("VStack", [["spacing", String(ctx.space(24))]], [...dial, ...button]) };
    },
  },
};

// ---------------------------------------------------------------- Expanding Track

export const expandingTrack: SwiftPieceDefinition = {
  id: "expanding-track",
  name: "Expanding Track",
  category: "pieces",
  description: "A slider with no knob: a solid bar that swells into a thick block under your finger and squishes when you push past the end.",
  availability: "free",
  preview: { component: "expanding-track", chunk: "pieces-motion" },
  source: piece("ExpandingTrack"),
  docs: docs("inputs", "expanding-track"),
  icon: "speaker.wave.2",
  concepts: ["state", "binding", "range", "gesture"],
  interactions: ["drag", "scrub", "spring", "haptic"],
  anatomy: [
    { part: "Header", props: ["title"] },
    { part: "Symbol", props: ["symbol"] },
    { part: "Track", props: ["mode", "value", "lower", "fill"] },
    { part: "Range", props: ["min", "max", "step"] },
  ],
  properties: [
    select("mode", "Selects", "single", opts(["single", "One value"], ["range", "A range"])),
    text("title", "Title", "Volume", { maxLength: 30, hint: "Shows as a caption with a big numeral. Empty hides it." }),
    icon("symbol", "Symbol", "speaker.wave.2"),
    number("value", "Value", 60, -100000, 100000, 1, { hint: "In range mode, the upper end." }),
    number("lower", "Lower end", 20, -100000, 100000, 1, { when: { prop: "mode", equals: ["range"] } }),
    number("min", "Minimum", 0, -100000, 100000, 1),
    number("max", "Maximum", 100, -100000, 100000, 1),
    number("step", "Step", 5, 0, 1000, 1, { hint: "0 slides freely." }),
    select("fill", "Color", "tangerine", blockOpts),
  ],
  variants: [
    { id: "volume", label: "Volume", props: { mode: "single", title: "Volume", symbol: "speaker.wave.2", value: 60, min: 0, max: 100, step: 5, fill: "tangerine" } },
    { id: "brightness", label: "Brightness", props: { mode: "single", title: "", symbol: "sun.max", value: 70, min: 0, max: 100, step: 10, fill: "butter" } },
    { id: "price", label: "Price range", props: { mode: "range", title: "Price per night", symbol: "none", lower: 40, value: 160, min: 0, max: 200, step: 10, fill: "sky" } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const lo = Math.min(n(p, "min"), n(p, "max") - 1);
      const hi = Math.max(n(p, "max"), lo + 1);
      const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
      const title = s(p, "title").trim();
      const sym = s(p, "symbol");
      const step = n(p, "step");
      const hint = title || (sym === "none" ? "value" : sym.split(".")[0]);
      const bounds = `${num(lo)}...${num(hi)}`;
      const fill = s(p, "fill");
      const common = [
        step > 0 && `step: ${num(step)}`,
        sym !== "none" && `symbol: ${str(sym)}`,
        title && `title: ${str(title)}`,
        fill !== "tangerine" && `style: .init(fill: ${blockSwift(fill)})`,
      ];
      if (s(p, "mode") === "range") {
        const a = clamp(Math.min(n(p, "lower"), n(p, "value")));
        const z = clamp(Math.max(n(p, "lower"), n(p, "value")));
        const name = ctx.state(`${hint} range`, "", `${dbl(a)}...${dbl(z)}`);
        return { lines: invoke("ExpandingTrack", [`range: $${name}`, `in: ${bounds}`, ...common]) };
      }
      const name = ctx.state(hint, "", dbl(clamp(n(p, "value"))));
      return { lines: invoke("ExpandingTrack", [`value: $${name}`, (lo !== 0 || hi !== 1) && `in: ${bounds}`, ...common]) };
    },
  },
};

// ---------------------------------------------------------------- Range Slider

export const rangeSlider: SwiftPieceDefinition = {
  id: "range-slider",
  name: "Range Slider",
  category: "pieces",
  description: "A slider with two thumbs for picking a range, like a price filter. The thumbs never cross and the values snap to a step.",
  availability: "free",
  preview: { component: "range-slider", chunk: "pieces-motion" },
  source: piece("RangeSlider"),
  docs: docs("inputs", "range-slider"),
  icon: "slider.horizontal.3",
  concepts: ["state", "binding", "range", "formatstyle"],
  interactions: ["drag", "haptic", "spring"],
  anatomy: [
    { part: "Thumbs", props: ["lower", "upper", "gap"] },
    { part: "Track", props: ["min", "max", "step", "fill"] },
    { part: "Readout", props: ["readout", "format"] },
  ],
  properties: [
    number("lower", "Lower value", 120, -1000000, 1000000, 1),
    number("upper", "Upper value", 480, -1000000, 1000000, 1),
    number("min", "Minimum", 0, -1000000, 1000000, 1),
    number("max", "Maximum", 1000, -1000000, 1000000, 1),
    number("step", "Step", 10, 0, 10000, 1, { hint: "0 slides freely." }),
    select("readout", "Readout", "thumbs", opts(["thumbs", "Chips over the thumbs"], ["header", "Line above"], ["hidden", "Hidden"])),
    select("format", "Format", "currency", opts(["number", "Number"], ["currency", "Currency (USD)"])),
    select("fill", "Color", "tangerine", blockOpts),
    number("gap", "Minimum gap", 0, 0, 100000, 1, { level: "advanced", hint: "The thumbs stop this far apart." }),
  ],
  variants: [
    { id: "price", label: "Price", props: { lower: 120, upper: 480, min: 0, max: 1000, step: 10, readout: "thumbs", format: "currency", fill: "tangerine" } },
    { id: "price-header", label: "Price, header", props: { lower: 120, upper: 480, min: 0, max: 1000, step: 10, readout: "header", format: "currency", fill: "sky" } },
    { id: "age", label: "Age range", props: { lower: 24, upper: 41, min: 18, max: 80, step: 1, gap: 5, readout: "thumbs", format: "number", fill: "sage" } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const lo = Math.min(n(p, "min"), n(p, "max") - 1);
      const hi = Math.max(n(p, "max"), lo + 1);
      const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
      const a = clamp(Math.min(n(p, "lower"), n(p, "upper")));
      const z = clamp(Math.max(n(p, "lower"), n(p, "upper")));
      const currency = s(p, "format") === "currency";
      const name = ctx.state(currency ? "price" : "range", "ClosedRange<Double>", `${num(a)}...${num(z)}`);
      const fill = s(p, "fill");
      return {
        lines: invoke("RangeSlider", [
          `value: $${name}`,
          `in: ${num(lo)}...${num(hi)}`,
          n(p, "step") > 0 && `step: ${num(n(p, "step"))}`,
          n(p, "gap") > 0 && `minimumDistance: ${num(n(p, "gap"))}`,
          s(p, "readout") !== "thumbs" && `readout: .${s(p, "readout")}`,
          fill !== "tangerine" && `style: .init(fill: ${blockSwift(fill)})`,
          currency && 'format: .currency(code: "USD").precision(.fractionLength(0))',
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Fan Stack

export const fanStack: SwiftPieceDefinition = {
  id: "fan-stack",
  name: "Fan Stack",
  category: "pieces",
  description: "Overlapping avatars that fan apart when tapped. Hold and slide across them to see each name, then let go to pick one.",
  availability: "free",
  preview: { component: "fan-stack", chunk: "pieces-motion" },
  source: piece("FanStack"),
  docs: docs("controls", "fan-stack"),
  icon: "person.2",
  concepts: ["array", "gesture", "spring"],
  interactions: ["tap", "hold", "scrub", "spring", "haptic"],
  anatomy: [
    { part: "People", props: ["names"] },
    { part: "Avatars", props: ["size", "overlap"] },
    { part: "Overflow pill", props: ["max"] },
  ],
  properties: [
    text("names", "People", "Priya Raman, Jonas Weber, Amara Diallo, Leo Brandt, Sofia Marin, Kenji Sato", { hint: "Full names, separated by commas.", maxLength: 240 }),
    number("size", "Avatar size", 52, 28, 80, 1, { group: "layout" }),
    number("max", "Shown before +N", 3, 1, 8, 1),
    number("overlap", "Overlap", 0.25, 0, 0.6, 0.05, { level: "advanced", group: "layout" }),
  ],
  variants: [
    { id: "team", label: "Team", props: { names: "Priya Raman, Jonas Weber, Amara Diallo, Leo Brandt, Sofia Marin, Kenji Sato", size: 52, max: 3 } },
    { id: "small", label: "Compact", props: { names: "Mara Lindqvist, Jonas Okafor, Priya Raman, Theo Laurent", size: 36, max: 4, overlap: 0.35 } },
    { id: "pair", label: "Two people", props: { names: "Ana Costa, Ben Hale", size: 60, max: 2 } },
  ],
  swift: {
    imports: [],
    emit(p) {
      const names = list(p.names, 12);
      const safe = names.length ? names : ["Guest"];
      const namesArg = `names: [${safe.map(str).join(", ")}]`;
      const rest = [n(p, "size") !== 44 && `size: ${num(n(p, "size"))}`, n(p, "max") !== 4 && `max: ${num(n(p, "max"))}`, n(p, "overlap") !== 0.25 && `overlap: ${num(n(p, "overlap"))}`].filter(Boolean) as string[];
      const oneLine = `FanStack(${[namesArg, ...rest].join(", ")})`;
      if (oneLine.length <= 96) return { lines: [oneLine] };
      return { lines: invoke("FanStack", [arrayArg("names", safe.map(str)), ...rest]) };
    },
  },
};

// ---------------------------------------------------------------- Parallax Card

export const parallaxCard: SwiftPieceDefinition = {
  id: "parallax-card",
  name: "Parallax Card",
  category: "pieces",
  description: "A picture card whose image drifts slower than the page as you scroll, so it reads in layers. Pressing it lifts it toward you.",
  availability: "free",
  preview: { component: "parallax-card", chunk: "pieces-motion" },
  source: piece("ParallaxCard"),
  docs: docs("cards", "parallax-card"),
  icon: "photo",
  concepts: ["scrollview", "closure", "array", "modifier"],
  interactions: ["scroll", "press", "tap", "spring"],
  anatomy: [
    { part: "Picture", props: ["imageName", "word", "sky"] },
    { part: "Caption", props: ["eyebrow", "title", "metadata", "trailingSymbol", "caption", "captionFill"] },
    { part: "Card", props: ["height", "parallax"] },
    { part: "Interaction", props: ["link"] },
  ],
  properties: [
    text("eyebrow", "Eyebrow", "Walk 01", { maxLength: 24 }),
    text("title", "Title", "Alfama at dusk", { maxLength: 40 }),
    text("metadata", "Details", "3.2 km, 1 h 10 min", { hint: "Short facts, separated by commas.", maxLength: 80 }),
    icon("trailingSymbol", "Trailing symbol", "arrow.up.right"),
    select("caption", "Caption", "block", opts(["block", "Solid block"], ["scrim", "White text on a shade"])),
    select("captionFill", "Caption color", "butter", blockOpts, { when: { prop: "caption", equals: ["block"] } }),
    text("word", "Picture word", "Alfama", { maxLength: 12, hint: "The giant word in the drawn picture." }),
    select("sky", "Picture color", "sky", blockOpts),
    text("imageName", "Image asset", "", { maxLength: 40, hint: "An image in your Assets catalog. Empty draws the picture in code." }),
    number("height", "Height", 250, 140, 420, 1, { group: "layout" }),
    link(),
    number("parallax", "Parallax", 0.25, 0, 0.5, 0.05, { level: "advanced", pro: true, group: "motion", hint: "How far the picture drifts while scrolling." }),
  ],
  variants: [
    { id: "walk", label: "Walk", props: { eyebrow: "Walk 01", title: "Alfama at dusk", metadata: "3.2 km, 1 h 10 min", caption: "block", captionFill: "butter", word: "Alfama", sky: "sky" } },
    { id: "river", label: "River", props: { eyebrow: "Walk 02", title: "River to Belém", metadata: "6.8 km, 2 h", caption: "block", captionFill: "lilac", word: "Belém", sky: "sage" } },
    { id: "scrim", label: "Scrim caption", props: { eyebrow: "Guide", title: "Graça viewpoints", metadata: "2.1 km, 45 min", caption: "scrim", word: "Graça", sky: "lilac", height: 280 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const h = n(p, "height");
      const radius = ctx.corner(26);
      const meta = list(p.metadata, 4);
      const asset = s(p, "imageName").trim();
      const sun = s(p, "sky") === "tangerine" ? "butter" : "tangerine";
      const image = asset
        ? [`image: Image(${str(asset)})`]
        : [
            "image: Image(size: CGSize(width: 400, height: 340)) { context in",
            `${INDENT}context.fill(Path(CGRect(x: 0, y: 0, width: 400, height: 340)), with: .color(${blockSwift(s(p, "sky"))}))`,
            `${INDENT}context.fill(Path(ellipseIn: CGRect(x: 196, y: 10, width: 190, height: 190)), with: .color(${blockSwift(sun)}))`,
            `${INDENT}let word = Text(${str(s(p, "word").toUpperCase())})`,
            `${INDENT}${INDENT}.font(.system(size: 128, weight: .black))`,
            `${INDENT}${INDENT}.foregroundStyle(${INK})`,
            `${INDENT}context.draw(word, at: CGPoint(x: -8, y: 24), anchor: .topLeading)`,
            "}",
          ];
      const fill = s(p, "captionFill");
      const style = s(p, "caption") === "scrim" ? ".scrim" : fill !== "butter" ? `.init(captionFill: ${blockSwift(fill)})` : null;
      const args = [
        image,
        s(p, "eyebrow").trim() && `eyebrow: ${str(s(p, "eyebrow").trim())}`,
        `title: ${str(s(p, "title"))}`,
        meta.length > 0 && `metadata: [${meta.map(str).join(", ")}]`,
        s(p, "trailingSymbol") !== "none" && `trailingSymbol: ${str(s(p, "trailingSymbol"))}`,
        h !== 240 && `height: ${num(h)}`,
        n(p, "parallax") !== 0.25 && `parallax: ${num(n(p, "parallax"))}`,
        radius !== 26 && `cornerRadius: ${num(radius)}`,
        style && `style: ${style}`,
      ];
      const target = ctx.link(s(p, "link"));
      if (target?.kind === "push") {
        const card = invoke("ParallaxCard", args);
        return { lines: modifiers(["NavigationLink {", `${INDENT}${target.view}()`, "} label: {", ...indent(card), "}"], ["buttonStyle(.plain)"]) };
      }
      if (target?.kind === "sheet") {
        const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
        const card = invoke("ParallaxCard", args, [[null, [`${flag} = true`]]]);
        return { lines: [...card, `.sheet(isPresented: $${flag}) {`, `${INDENT}NavigationStack { ${target.view}() }`, "}"] };
      }
      if (target?.kind === "back") return { lines: invoke("ParallaxCard", args, [[null, [`${ctx.dismiss()}()`]]]) };
      if (target?.kind === "tab") return { lines: invoke("ParallaxCard", args, [[null, [target.set]]]) };
      return { lines: invoke("ParallaxCard", args, [[null, []]]) };
    },
  },
};

export const motionPieces: SwiftPieceDefinition[] = [swipeDeck, swipeActionRow, flipCard, depthCarousel, timerDial, expandingTrack, rangeSlider, fanStack, parallaxCard];

/** Which of these take all the width they are offered (see react/preview/fills.ts). */
export const motionFills: Record<string, boolean> = {
  "swipe-deck": true,
  "swipe-action-row": true,
  "flip-card": true,
  "depth-carousel": true,
  "timer-dial": false,
  "expanding-track": true,
  "range-slider": true,
  "fan-stack": false,
  "parallax-card": true,
};
