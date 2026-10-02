// More native SwiftUI building blocks: media, avatars, search, sliders, steppers, progress, menus,
// disclosure, paging, charts, option cards and tags. Like the primitives, they need no SwiftPieces
// source file: the export is plain SwiftUI (and Swift Charts for the chart). The web renderer for
// each id lives in react/preview/native.tsx and reads the same props.
import { swiftRGB } from "../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../core/swift.js";
import { bool, color, icon, link, number, opts, select, tappable, text } from "./shared.js";
import { own } from "../core/own.js";
import { ARTWORK_INK, artworkGround, artworkGrounds, swiftArtwork, swiftArtworkPadding, withArtwork } from "./app-pieces/artwork.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const preview = (id: string) => ({ component: id, chunk: "native" });

// ---------------------------------------------------------------- Shared

/**
 * The gradient "art" an Image or a carousel page shows in place of a photo. Three stops each, drawn
 * top-leading to bottom-trailing on both sides; the web adds a soft light and shade on top.
 */
export const ARTS: Record<string, { label: string; stops: [string, string, string]; solid?: boolean }> = {
  sunset: { label: "Sunset", stops: ["#FFB36B", "#FF6F61", "#B8458F"] },
  ocean: { label: "Ocean", stops: ["#7EE8F5", "#2D8CFF", "#26379E"] },
  forest: { label: "Forest", stops: ["#C6EB8A", "#3FAE7A", "#1B5A4E"] },
  dusk: { label: "Dusk", stops: ["#F9B4CB", "#8C6BE0", "#2A2A6E"] },
  citrus: { label: "Citrus", stops: ["#FFE873", "#FFB443", "#FF6A3D"] },
  graphite: { label: "Graphite", stops: ["#9AA0A9", "#434850", "#16181C"] },
  bloom: { label: "Bloom", stops: ["#FFD6EA", "#FF7EB6", "#A64BDB"] },
  // Solid house fills (a whisper of tone, no gradient): picture stand-ins for designs that keep
  // gradients for the brand's own moments.
  red: { label: "Signal red", stops: ["#FF1A1A", "#FF0000", "#EB0000"], solid: true },
  ember: { label: "Ember", stops: ["#FF8650", "#FF7A3C", "#F06C2E"], solid: true },
  blush: { label: "Blush", stops: ["#FF9CC0", "#FF8FB8", "#F281AB"], solid: true },
  azure: { label: "Azure", stops: ["#5B97FF", "#4D8DFF", "#3F7FF2"], solid: true },
  sky: { label: "Sky", stops: ["#A8CAFF", "#9CC2FF", "#8FB6F5"], solid: true },
  butter: { label: "Butter", stops: ["#FFDF8A", "#FFD976", "#F5CD66"], solid: true },
  sage: { label: "Sage", stops: ["#B5E2C1", "#A9DCB7", "#9BD1AA"], solid: true },
  lilac: { label: "Lilac", stops: ["#D7C4FF", "#CDB8FF", "#BFA8F5"], solid: true },
  sand: { label: "Sand", stops: ["#EEDDBF", "#E9D5B3", "#DEC8A3"], solid: true },
  ink: { label: "Ink", stops: ["#26262A", "#1C1C1F", "#141416"], solid: true },
};
const artOptions = opts(...Object.entries(ARTS).map(([id, a]): [string, string] => [id, a.label]));

/** Aspect ratio options, as `.aspectRatio` writes them. */
export const ASPECTS: Record<string, { swift: string; css: string }> = {
  "1:1": { swift: "1", css: "1 / 1" },
  "4:3": { swift: "4 / 3", css: "4 / 3" },
  "16:9": { swift: "16 / 9", css: "16 / 9" },
  "3:4": { swift: "3 / 4", css: "3 / 4" },
  "9:16": { swift: "9 / 16", css: "9 / 16" },
};

/** How far down a carousel page's drawing starts, leaving its title room at the top. */
export const CAROUSEL_ART_TOP = 60;

/** Degrees each carousel page turns the art's hue, so pages read as a set but differ. */
export const PAGE_HUE = 28;

/** Menu item words → SF Symbols from the palette. Unknown words get no icon. */
const MENU_SYMBOLS: Record<string, string> = {
  edit: "pencil", rename: "pencil", share: "square.and.arrow.up", delete: "trash", remove: "trash", favorite: "heart", favourite: "heart",
  like: "hand.thumbsup", save: "bookmark", bookmark: "bookmark", pin: "pin", flag: "flag", download: "square.and.arrow.down", hide: "eye.slash",
  info: "info.circle", details: "info.circle", settings: "gearshape", filter: "line.3.horizontal.decrease", sort: "line.3.horizontal.decrease",
  add: "plus", new: "plus", refresh: "arrow.clockwise", reload: "arrow.clockwise", compose: "square.and.pencil", write: "square.and.pencil",
  link: "link", report: "exclamationmark.triangle", archive: "tray", move: "folder", send: "paperplane", message: "message", call: "phone",
  email: "envelope", mail: "envelope", lock: "lock", unlock: "lock.open", play: "play.fill", schedule: "calendar", remind: "bell",
};
export function menuSymbol(item: string): string | null {
  const key = item.trim().toLowerCase();
  return own(MENU_SYMBOLS, key) ?? own(MENU_SYMBOLS, key.split(/\s+/)[0]) ?? null;
}

/** Comma-list options with duplicates removed (Picker tags and chart categories must be unique). */
export function uniqueList(value: unknown, max = 12): string[] {
  const out: string[] = [];
  for (const item of list(value, max)) {
    let name = item;
    for (let i = 2; out.includes(name); i++) name = `${item} ${i}`;
    out.push(name);
  }
  return out;
}

/** The chart's numbers: finite, non-negative, at most 12. */
export function chartValues(value: unknown): number[] {
  const vals = list(value, 12).map(Number).filter((v) => Number.isFinite(v)).map((v) => Math.max(0, v));
  return vals.length ? vals : [1];
}

/** One label per value: the labels given (deduplicated), then 1, 2, 3… */
export function chartLabels(value: unknown, count: number): string[] {
  const given = uniqueList(value, 12);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = given[i] ?? String(i + 1);
    for (let j = 2; out.includes(name); j++) name = `${given[i] ?? i + 1} ${j}`;
    out.push(name);
  }
  return out;
}

type Mod = string | string[] | null | undefined | false;

/**
 * `modifiers()` that also takes multi-line modifiers (an `.overlay { … }` block). The indent is
 * decided once for the whole chain, so a block never throws the modifiers after it out of line.
 */
function chain(lines: string[], mods: Mod[]): string[] {
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  const out = [...lines];
  for (const m of mods) {
    if (!m) continue;
    if (typeof m === "string") out.push(`${pad}.${m}`);
    else out.push(`${pad}.${m[0]}`, ...m.slice(1).map((l) => (l ? pad + l : l)));
  }
  return out;
}

/** `head { body }` as one multi-line modifier for `chain`. */
const blockMod = (head: string, body: string[]): string[] => [`${head} {`, ...indent(body), "}"];

/** `LinearGradient(colors: [...])` for an art, one color per line. */
function gradient(art: string): string[] {
  const a = own(ARTS, art) ?? ARTS.sunset;
  return [
    "LinearGradient(",
    `${INDENT}colors: [`,
    ...a.stops.map((c, i) => `${INDENT}${INDENT}${swiftRGB(c)}${i < a.stops.length - 1 ? "," : ""}`),
    `${INDENT}],`,
    `${INDENT}startPoint: .topLeading,`,
    `${INDENT}endPoint: .bottomTrailing`,
    ")",
  ];
}

/** Ink that reads on a filled palette color. */
const inkOn = (id: string) => (id === "white" || id === "yellow" ? ".black" : ".white");

// ---------------------------------------------------------------- Image

export const image: SwiftPieceDefinition = {
  id: "image",
  name: "Image",
  category: "content",
  description: "A picture spot. It shows colorful art until you swap in your own photo.",
  availability: "free",
  preview: preview("image"),
  icon: "photo",
  concepts: ["modifier", "frame", "clip", "zstack"],
  interactions: ["press", "push", "sheet"],
  anatomy: [
    { part: "Art", props: ["art"] },
    { part: "Shape", props: ["aspect", "radius"] },
    { part: "Glyph", props: ["symbol"] },
    { part: "Overlay", props: ["title", "caption"] },
    { part: "Interaction", props: ["link"] },
  ],
  variants: [
    { id: "hero", label: "Hero", props: { art: "sunset", aspect: "16:9", symbol: "none", title: "Weekend in Lisbon", caption: "3 nights · from $420" } },
    { id: "tile", label: "Square tile", props: { art: "bloom", aspect: "1:1", symbol: "photo", title: "", caption: "" } },
    { id: "portrait", label: "Portrait", props: { art: "dusk", aspect: "3:4", symbol: "none", title: "Night Walks", caption: "New episode" } },
    { id: "banner", label: "Banner", props: { art: "forest", aspect: "16:9", radius: 12, symbol: "leaf", title: "", caption: "" } },
  ],
  properties: [
    select("art", "Art", "sunset", withArtwork(artOptions), { group: "color", hint: "Stands in for a photo until you add your own: a gradient, a flat house colour or a drawing." }),
    select("aspect", "Aspect ratio", "4:3", opts(["1:1", "Square 1:1"], ["4:3", "Landscape 4:3"], ["16:9", "Wide 16:9"], ["3:4", "Portrait 3:4"], ["9:16", "Tall 9:16"]), { group: "layout" }),
    number("radius", "Corner radius", 20, 0, 40),
    icon("symbol", "Icon", "none"),
    text("title", "Title", "", { maxLength: 60, hint: "Shown over the bottom of the picture." }),
    text("caption", "Caption", "", { maxLength: 80 }),
    link(),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const r = ctx.corner(n(p, "radius"));
      const title = s(p, "title").trim();
      const caption = s(p, "caption").trim();
      const sym = s(p, "symbol");
      const words: string[] = [];
      if (title) words.push(...modifiers([`Text(${str(title)})`], ["font(.headline)"]));
      if (caption) words.push(...modifiers([`Text(${str(caption)})`], ["font(.subheadline)", "opacity(0.85)"]));
      const overlay = title && caption ? call("VStack", [["alignment", ".leading"], ["spacing", "2"]], words) : words;
      // A drawing sits on its pastel in place of the gradient (and of the symbol).
      const picture = swiftArtwork(ctx, s(p, "art"));
      let lines = chain(picture ? [swiftRGB(artworkGround(s(p, "art")))] : gradient(s(p, "art")), [
        `aspectRatio(${(own(ASPECTS, s(p, "aspect")) ?? ASPECTS["4:3"]).swift}, contentMode: .fit)`,
        picture && blockMod("overlay", [`${picture}${swiftArtworkPadding(s(p, "art"))}`]),
        !picture && sym !== "none" && blockMod("overlay", modifiers([`Image(systemName: ${str(ctx.symbol(sym))})`], ["font(.system(size: 44))", "foregroundStyle(.white.opacity(0.9))"])),
        words.length > 0 && blockMod("overlay(alignment: .bottomLeading)", modifiers(overlay, [
          "foregroundStyle(.white)",
          "frame(maxWidth: .infinity, alignment: .leading)",
          "padding(16)",
          "background(LinearGradient(colors: [.clear, .black.opacity(0.5)], startPoint: .top, endPoint: .bottom))",
        ])),
        r > 0 && `clipShape(.rect(cornerRadius: ${num(r)}))`,
      ]);
      lines = ['// Replace with Image("…") or AsyncImage(url:)', ...lines];
      if (ctx.link(s(p, "link"))) lines = modifiers(tappable(ctx, p.link, lines, str(title || "Open")), ["buttonStyle(.plain)"]);
      return { lines };
    },
  },
};

// ---------------------------------------------------------------- Avatar

export const avatar: SwiftPieceDefinition = {
  id: "avatar",
  name: "Avatar",
  category: "content",
  description: "A round picture for a person: their initials or an icon on a colored circle.",
  availability: "free",
  preview: preview("avatar"),
  icon: "person.crop.circle.fill",
  concepts: ["text", "frame", "background", "sfsymbol"],
  interactions: [],
  anatomy: [
    { part: "Initials", props: ["initials", "symbol"] },
    { part: "Circle", props: ["size", "color"] },
    { part: "Status", props: ["status"] },
  ],
  variants: [
    { id: "initials", label: "Initials", props: { initials: "SR", symbol: "none", color: "indigo", size: 56 } },
    { id: "symbol", label: "Icon", props: { symbol: "person", color: "gray", size: 56 } },
    { id: "large", label: "Profile", props: { initials: "AM", symbol: "none", color: "orange", size: 96, status: "online" } },
    { id: "small", label: "Small", props: { initials: "JK", symbol: "none", color: "teal", size: 32 } },
  ],
  states: [
    { id: "none", label: "No status", props: { status: "none" } },
    { id: "online", label: "Online", props: { status: "online" } },
    { id: "busy", label: "Busy", props: { status: "busy" } },
  ],
  properties: [
    text("initials", "Initials", "SR", { maxLength: 3 }),
    number("size", "Size", 56, 24, 120),
    color("color", "Color", "indigo"),
    icon("symbol", "Icon", "none", { hint: "Shown instead of the initials." }),
    select("status", "Status", "none", opts(["none", "None"], ["online", "Online"], ["busy", "Busy"]), { group: "state" }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const size = n(p, "size");
      const c = s(p, "color");
      const sym = s(p, "symbol");
      const initials = s(p, "initials").trim().slice(0, 3);
      const glyph = sym !== "none" || !initials;
      const head = glyph ? `Image(systemName: ${str(sym !== "none" ? ctx.symbol(sym) : "person.fill")})` : `Text(${str(initials)})`;
      const status = s(p, "status");
      const dot = Math.max(8, Math.round(size * 0.24));
      return {
        lines: chain([head], [
          glyph ? `font(.system(size: ${num(Math.round(size * 0.42))}, weight: .semibold))` : `font(.system(size: ${num(Math.round(size * 0.4))}, weight: .semibold, design: .rounded))`,
          `foregroundStyle(${inkOn(c)})`,
          `frame(width: ${num(size)}, height: ${num(size)})`,
          `background(Color${ctx.color(c)}.gradient, in: .circle)`,
          status !== "none" && blockMod("overlay(alignment: .bottomTrailing)", modifiers(["Circle()"], [
            `fill(${status === "online" ? ".green" : ".red"})`,
            `frame(width: ${dot}, height: ${dot})`,
            "padding(2)",
            "background(.background, in: .circle)",
          ])),
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Search field

export const searchField: SwiftPieceDefinition = {
  id: "search-field",
  name: "Search Field",
  category: "inputs",
  description: "A search bar people type into, with a clear button and a Cancel that slides in.",
  availability: "free",
  preview: preview("search-field"),
  icon: "magnifyingglass",
  concepts: ["state", "binding", "textfield", "hstack"],
  interactions: ["type", "tap"],
  anatomy: [
    { part: "Field", props: ["placeholder", "text"] },
    { part: "Cancel", props: ["showsCancel"] },
  ],
  variants: [
    { id: "search", label: "Search", props: { placeholder: "Search", text: "", showsCancel: true } },
    { id: "filled", label: "With a query", props: { placeholder: "Search", text: "Coffee", showsCancel: true } },
    { id: "inline", label: "Inline", props: { placeholder: "Find a recipe", text: "", showsCancel: false } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { text: "" } },
    { id: "typed", label: "Typed", props: { text: "Coff" } },
  ],
  properties: [
    text("placeholder", "Placeholder", "Search", { maxLength: 40 }),
    text("text", "Starting text", "", { maxLength: 60, hint: "What is already typed when the screen opens." }),
    bool("showsCancel", "Cancel button", true, { group: "interaction", hint: "Slides in while the field is focused." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const name = ctx.state("query", "", str(s(p, "text")));
      const clear = modifiers(call("Button", [[null, '"Clear"'], ["systemImage", '"xmark.circle.fill"']], [`${name} = ""`]), ["labelStyle(.iconOnly)", "foregroundStyle(.tertiary)", "buttonStyle(.plain)"]);
      const body = [
        ...modifiers(['Image(systemName: "magnifyingglass")'], ["foregroundStyle(.secondary)"]),
        ...modifiers([`TextField(${str(s(p, "placeholder"))}, text: $${name})`], ["submitLabel(.search)", "autocorrectionDisabled()"]),
        `if !${name}.isEmpty {`,
        ...indent(clear),
        "}",
      ];
      return {
        lines: modifiers(call("HStack", [["spacing", "6"]], body), [
          "padding(.horizontal, 10)",
          "padding(.vertical, 8)",
          `background(.fill.tertiary, in: .rect(cornerRadius: ${num(ctx.corner(10))}))`,
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Slider

export const slider: SwiftPieceDefinition = {
  id: "slider",
  name: "Slider",
  category: "inputs",
  description: "Drag the knob along a track to pick a value, like volume or brightness.",
  availability: "free",
  preview: preview("slider"),
  icon: "slider.horizontal.3",
  concepts: ["state", "binding", "range", "gesture"],
  interactions: ["drag", "scrub", "tap", "haptic"],
  anatomy: [
    { part: "Label", props: ["label", "showsValue"] },
    { part: "Track", props: ["value", "step", "tint"] },
    { part: "Icons", props: ["minIcon", "maxIcon"] },
  ],
  variants: [
    { id: "volume", label: "Volume", props: { label: "Volume", minIcon: "none", maxIcon: "speaker.wave.2", step: 0, tint: "accent", showsValue: false } },
    { id: "brightness", label: "Brightness", props: { label: "Brightness", minIcon: "moon", maxIcon: "sun.max", step: 0, tint: "orange", showsValue: false } },
    { id: "stepped", label: "Stepped", props: { label: "Intensity", minIcon: "none", maxIcon: "none", step: 10, value: 60, tint: "green", showsValue: true } },
  ],
  properties: [
    text("label", "Label", "Volume", { maxLength: 40, hint: "Shown above the slider. Leave empty to hide." }),
    number("value", "Value", 60, 0, 100, 1, { group: "state" }),
    number("step", "Step", 0, 0, 25, 1, { hint: "0 slides smoothly. Any other step snaps, with a tick at each one." }),
    icon("minIcon", "Leading icon", "none"),
    icon("maxIcon", "Trailing icon", "none"),
    color("tint", "Color", "accent"),
    bool("showsValue", "Show value", false),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const step = n(p, "step");
      const snap = (v: number) => clamp(step > 0 ? Math.round(v / step) * step : v, 0, 100);
      const label = s(p, "label").trim();
      const name = ctx.state(label || "value", "", Number.isInteger(snap(n(p, "value"))) ? `${snap(n(p, "value"))}.0` : num(snap(n(p, "value"))));
      const args = `value: $${name}, in: 0...100${step > 0 ? `, step: ${num(step)}` : ""}`;
      const lo = s(p, "minIcon");
      const hi = s(p, "maxIcon");
      const img = (id: string) => `Image(systemName: ${str(ctx.symbol(id))})`;
      let control: string[];
      if (lo !== "none" && hi !== "none") {
        control = [`Slider(${args}) {`, `${INDENT}Text(${str(label || "Value")})`, "} minimumValueLabel: {", `${INDENT}${img(lo)}`, "} maximumValueLabel: {", `${INDENT}${img(hi)}`, "}"];
      } else if (lo !== "none" || hi !== "none") {
        control = call("HStack", [["spacing", "12"]], [
          ...(lo !== "none" ? modifiers([img(lo)], ["foregroundStyle(.secondary)"]) : []),
          `Slider(${args})`,
          ...(hi !== "none" ? modifiers([img(hi)], ["foregroundStyle(.secondary)"]) : []),
        ]);
      } else {
        control = [`Slider(${args})`];
      }
      control = modifiers(control, [s(p, "tint") !== "accent" && `tint(${ctx.color(s(p, "tint"))})`, step > 0 && `sensoryFeedback(.selection, trigger: ${name})`]);
      const value = modifiers([`Text(${name}, format: .number.precision(.fractionLength(0)))`], ["foregroundStyle(.secondary)", "monospacedDigit()"]);
      let header: string[] | null = null;
      if (label && b(p, "showsValue")) header = call("HStack", [], [`Text(${str(label)})`, "Spacer()", ...value]);
      else if (label) header = [`Text(${str(label)})`];
      else if (b(p, "showsValue")) header = modifiers(value, ["frame(maxWidth: .infinity, alignment: .trailing)"]);
      if (!header) return { lines: control };
      return { lines: call("VStack", [["alignment", ".leading"], ["spacing", "8"]], [...header, ...control]) };
    },
  },
};

// ---------------------------------------------------------------- Stepper

export const stepper: SwiftPieceDefinition = {
  id: "stepper",
  name: "Stepper",
  category: "inputs",
  description: "Minus and plus buttons that count a number up or down, like guests or quantity.",
  availability: "free",
  preview: preview("stepper"),
  icon: "plus",
  concepts: ["state", "binding", "range"],
  interactions: ["tap", "hold", "haptic"],
  anatomy: [
    { part: "Label", props: ["label", "value"] },
    { part: "Buttons", props: ["min", "max"] },
  ],
  variants: [
    { id: "guests", label: "Guests", props: { label: "Guests", value: 2, min: 1, max: 10 } },
    { id: "quantity", label: "Quantity", props: { label: "Quantity", value: 1, min: 1, max: 20 } },
    { id: "nights", label: "Nights", props: { label: "Nights", value: 3, min: 1, max: 14 } },
  ],
  states: [
    { id: "lowest", label: "At minimum", props: { value: 1, min: 1 } },
    { id: "middle", label: "In range", props: { value: 5 } },
    { id: "highest", label: "At maximum", props: { value: 10, max: 10 } },
  ],
  properties: [
    text("label", "Label", "Guests", { maxLength: 40 }),
    number("value", "Value", 2, 0, 99, 1, { group: "state" }),
    number("min", "Minimum", 1, 0, 99),
    number("max", "Maximum", 10, 1, 99),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const lo = Math.min(n(p, "min"), n(p, "max") - 1);
      const hi = Math.max(n(p, "max"), lo + 1);
      const label = s(p, "label").trim();
      const name = ctx.state(label || "value", "", String(clamp(Math.round(n(p, "value")), lo, hi)));
      const title = label ? `"${str(label).slice(1, -1)}: \\(${name})"` : `"\\(${name})"`;
      return {
        lines: chain([`Stepper(${title}, value: $${name}, in: ${num(lo)}...${num(hi)})`], [
          ["sensoryFeedback(trigger: " + name + ") { oldValue, newValue in", `${INDENT}newValue > oldValue ? .increase : .decrease`, "}"],
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Progress

export const progress: SwiftPieceDefinition = {
  id: "progress",
  name: "Progress",
  category: "content",
  description: "Shows how far along something is, as a bar or a ring, or a spinner while it waits.",
  availability: "free",
  preview: preview("progress"),
  icon: "hourglass",
  concepts: ["modifier", "animation", "enum"],
  interactions: ["loading", "spring"],
  anatomy: [
    { part: "Indicator", props: ["style", "indeterminate"] },
    { part: "Value", props: ["value"] },
    { part: "Label", props: ["label"] },
    { part: "Color", props: ["tint"] },
  ],
  variants: [
    { id: "bar", label: "Bar", props: { style: "linear", indeterminate: false, value: 40, label: "" } },
    { id: "labeled", label: "Upload", props: { style: "linear", indeterminate: false, value: 65, label: "Uploading photos" } },
    { id: "ring", label: "Ring", props: { style: "circular", indeterminate: false, value: 72, label: "", tint: "green" } },
    { id: "spinner", label: "Spinner", props: { style: "circular", indeterminate: true, label: "Loading" } },
  ],
  states: [
    { id: "loading", label: "Loading", props: { indeterminate: true } },
    { id: "halfway", label: "Halfway", props: { indeterminate: false, value: 50 } },
    { id: "done", label: "Done", props: { indeterminate: false, value: 100 } },
  ],
  properties: [
    select("style", "Style", "linear", opts(["linear", "Bar"], ["circular", "Ring"])),
    number("value", "Value", 40, 0, 100, 1, { group: "state", when: { prop: "indeterminate", equals: [false] } }),
    bool("indeterminate", "Still loading", false, { group: "state", hint: "No known amount yet: a spinner or a moving bar." }),
    text("label", "Label", "", { maxLength: 40 }),
    color("tint", "Color", "accent"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const label = s(p, "label").trim();
      const v = clamp(n(p, "value"), 0, 100);
      const tint = s(p, "tint") !== "accent" && `tint(${ctx.color(s(p, "tint"))})`;
      const circular = s(p, "style") === "circular";
      if (b(p, "indeterminate")) {
        const head = label ? `ProgressView(${str(label)})` : "ProgressView()";
        return { lines: modifiers([head], [!circular && "progressViewStyle(.linear)", tint]) };
      }
      if (!circular) return { lines: modifiers([label ? `ProgressView(${str(label)}, value: ${num(v / 100)})` : `ProgressView(value: ${num(v / 100)})`], [tint]) };
      // A determinate ProgressView draws as a spinner on iOS; a capacity gauge is the ring that fills.
      const gauge = modifiers(
        [`Gauge(value: ${num(v / 100)}) {`, `${INDENT}Text(${str(label || "Progress")})`, "} currentValueLabel: {", `${INDENT}Text(${str(`${Math.round(v)}%`)})`, "}"],
        ["gaugeStyle(.accessoryCircularCapacity)", tint],
      );
      if (!label) return { lines: gauge };
      return { lines: call("VStack", [["spacing", "8"]], [...gauge, ...modifiers([`Text(${str(label)})`], ["font(.footnote)", "foregroundStyle(.secondary)"])]) };
    },
  },
};

// ---------------------------------------------------------------- Picker

export const picker: SwiftPieceDefinition = {
  id: "picker",
  name: "Picker",
  category: "inputs",
  description: "A row that opens a short menu of choices and shows the one picked.",
  availability: "free",
  preview: preview("picker"),
  icon: "list.bullet",
  concepts: ["state", "binding", "viewbuilder"],
  interactions: ["menu", "select", "haptic"],
  anatomy: [
    { part: "Label", props: ["label"] },
    { part: "Options", props: ["options", "selected"] },
  ],
  variants: [
    { id: "sort", label: "Sort", props: { label: "Sort by", options: "Newest, Popular, Price", selected: 0 } },
    { id: "currency", label: "Currency", props: { label: "Currency", options: "USD, EUR, GBP, JPY", selected: 1 } },
    { id: "repeat", label: "Repeat", props: { label: "Repeat", options: "Never, Daily, Weekly, Monthly", selected: 2 } },
  ],
  properties: [
    text("label", "Label", "Sort by", { maxLength: 40, hint: "Leave empty to show only the value." }),
    text("options", "Options", "Newest, Popular, Price", { hint: "Separate options with commas." }),
    number("selected", "Selected", 0, 0, 9, 1, { group: "state", hint: "Which option starts picked, counting from 0." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const items = uniqueList(p.options, 10);
      const safe = items.length ? items : ["Option"];
      const sel = clamp(Math.round(n(p, "selected")), 0, safe.length - 1);
      const label = s(p, "label").trim();
      const name = ctx.state(label || "selection", "", str(safe[sel]));
      const control = modifiers(call("Picker", [[null, str(label || "Selection")], ["selection", `$${name}`]], safe.map((o) => `Text(${str(o)}).tag(${str(o)})`)), ["pickerStyle(.menu)"]);
      if (!label) return { lines: control };
      return { lines: call("HStack", [], [`Text(${str(label)})`, "Spacer()", ...control]) };
    },
  },
};

// ---------------------------------------------------------------- Menu

export const menu: SwiftPieceDefinition = {
  id: "menu",
  name: "Menu",
  category: "controls",
  description: "A button that opens a list of actions, with a red one for delete.",
  availability: "free",
  preview: preview("menu"),
  icon: "ellipsis.circle",
  concepts: ["button", "closure", "viewbuilder", "sfsymbol"],
  interactions: ["menu", "tap", "haptic"],
  anatomy: [
    { part: "Label", props: ["label", "icon"] },
    { part: "Actions", props: ["items"] },
    { part: "Destructive", props: ["destructive"] },
  ],
  variants: [
    { id: "more", label: "More", props: { label: "", icon: "ellipsis.circle", items: "Edit, Share, Duplicate", destructive: "Delete" } },
    { id: "labeled", label: "Labeled", props: { label: "Options", icon: "slider.horizontal.3", items: "Rename, Share, Pin", destructive: "Delete" } },
    { id: "sort", label: "Sort", props: { label: "Sort", icon: "line.3.horizontal.decrease", items: "Newest, Oldest, Most popular", destructive: "" } },
  ],
  properties: [
    text("label", "Label", "", { maxLength: 30, hint: "Leave empty for an icon-only button." }),
    icon("icon", "Icon", "ellipsis.circle"),
    text("items", "Actions", "Edit, Share, Duplicate", { hint: "Separate actions with commas." }),
    text("destructive", "Destructive action", "Delete", { maxLength: 30, hint: "Shown last, in red. Leave empty for none." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const items = list(p.items, 8);
      const dest = s(p, "destructive").trim();
      const body = items.map((it) => {
        const sym = menuSymbol(it);
        return sym ? `Button(${str(it)}, systemImage: ${str(sym)}) {}` : `Button(${str(it)}) {}`;
      });
      if (dest) {
        if (body.length) body.push("Divider()");
        body.push(`Button(${str(dest)}, systemImage: ${str(menuSymbol(dest) ?? "trash")}, role: .destructive) {}`);
      }
      if (!body.length) body.push('Button("Action") {}');
      const label = s(p, "label").trim();
      const ic = s(p, "icon");
      const face = ic !== "none"
        ? label ? [`Label(${str(label)}, systemImage: ${str(ctx.symbol(ic))})`] : modifiers([`Label("More", systemImage: ${str(ctx.symbol(ic))})`], ["labelStyle(.iconOnly)"])
        : [`Text(${str(label || "More")})`];
      return { lines: ["Menu {", ...indent(body), "} label: {", ...indent(face), "}"] };
    },
  },
};

// ---------------------------------------------------------------- Disclosure group

export const disclosure: SwiftPieceDefinition = {
  id: "disclosure",
  name: "Disclosure Group",
  category: "content",
  description: "A heading you tap to show or hide more text underneath.",
  availability: "free",
  preview: preview("disclosure"),
  icon: "chevron.down",
  concepts: ["state", "binding", "animation", "viewbuilder"],
  interactions: ["expand", "tap"],
  anatomy: [
    { part: "Header", props: ["title"] },
    { part: "Content", props: ["text"] },
    { part: "State", props: ["expanded"] },
  ],
  variants: [
    { id: "details", label: "Details", props: { title: "Details", text: "Ships in 2 to 3 business days. Free returns within 30 days, no questions asked." } },
    { id: "faq", label: "FAQ", props: { title: "How do refunds work?", text: "Cancel any time from Settings. We refund the unused part of your plan to your original payment method within five days." } },
    { id: "notes", label: "Notes", props: { title: "Ingredients", text: "Oat flour, maple syrup, cinnamon, sea salt and a little vanilla. Contains no nuts." } },
  ],
  states: [
    { id: "collapsed", label: "Collapsed", props: { expanded: false } },
    { id: "expanded", label: "Expanded", props: { expanded: true } },
  ],
  properties: [
    text("title", "Title", "Details", { maxLength: 60 }),
    text("text", "Text", "Ships in 2 to 3 business days. Free returns within 30 days, no questions asked.", { maxLength: 400 }),
    bool("expanded", "Starts open", false, { group: "state" }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const title = s(p, "title").trim() || "Details";
      const name = ctx.state(`show ${title}`, "", b(p, "expanded") ? "true" : "false");
      const body = modifiers([`Text(${str(s(p, "text"))})`], ["font(.subheadline)", "foregroundStyle(.secondary)"]);
      return { lines: call("DisclosureGroup", [[null, str(title)], ["isExpanded", `$${name}`]], body) };
    },
  },
};

// ---------------------------------------------------------------- Page carousel

export const pageCarousel: SwiftPieceDefinition = {
  id: "page-carousel",
  name: "Page Carousel",
  category: "content",
  description: "Pages you swipe through sideways, with dots that show where you are.",
  availability: "free",
  preview: preview("page-carousel"),
  icon: "rectangle.stack",
  concepts: ["foreach", "state", "gesture", "spring"],
  interactions: ["swipe", "drag", "spring", "tap", "haptic"],
  anatomy: [
    { part: "Pages", props: ["titles", "art"] },
    { part: "Frame", props: ["height", "radius"] },
    { part: "Dots", props: ["dots"] },
  ],
  variants: [
    { id: "onboarding", label: "Onboarding", props: { titles: "Plan the week, Build habits, Stay on track", art: "ocean", height: 360, dots: true } },
    { id: "stories", label: "Stories", props: { titles: "Golden hour, Blue hour, Night", art: "sunset", height: 460, radius: 32, dots: true } },
    { id: "compact", label: "Compact", props: { titles: "Save 20%, Free delivery, New arrivals", art: "citrus", height: 180, radius: 16, dots: false } },
  ],
  properties: [
    text("titles", "Pages", "Plan the week, Build habits, Stay on track", { hint: "One title per page, separated by commas (2 to 5)." }),
    select("art", "Art", "ocean", withArtwork(artOptions), { group: "color", hint: "Each page shifts the colors a little; a drawing keeps its look on a new pastel per page." }),
    number("height", "Height", 360, 160, 560),
    number("radius", "Corner radius", 24, 0, 40),
    bool("dots", "Page dots", true),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const titles = list(p.titles, 5);
      const safe = titles.length ? titles : ["Page"];
      const dots = b(p, "dots");
      const r = ctx.corner(n(p, "radius"));
      const name = ctx.state("page", "", "0");
      const picture = swiftArtwork(ctx, s(p, "art"));
      const drawn = picture
        ? chain([`[${artworkGrounds(s(p, "art"), Math.min(safe.length, 6)).map(swiftRGB).join(", ")}][index % ${Math.min(safe.length, 6)}]`], [
            // The drawing stands lower than in a photo spot, so the words at the top stay clear of it.
            blockMod("overlay", [`${picture}.padding(.top, ${CAROUSEL_ART_TOP}).padding(.horizontal, 8)`]),
            // The words sit at the top, clear of the drawing standing on the bottom edge.
            blockMod("overlay(alignment: .topLeading)", modifiers(["Text(title)"], ["font(.title3.bold())", `foregroundStyle(${swiftRGB(ARTWORK_INK)})`, "padding(20)"])),
            r > 0 && `clipShape(.rect(cornerRadius: ${num(r)}))`,
            "tag(index)",
          ])
        : null;
      const page = drawn ?? chain(gradient(s(p, "art")), [
        `hueRotation(.degrees(Double(index) * ${PAGE_HUE}))`,
        blockMod("overlay(alignment: .bottomLeading)", modifiers(["Text(title)"], ["font(.title2.bold())", "foregroundStyle(.white)", "padding(24)", dots && "padding(.bottom, 20)"])),
        r > 0 && `clipShape(.rect(cornerRadius: ${num(r)}))`,
        "tag(index)",
      ]);
      const each = [`ForEach(Array([${safe.map(str).join(", ")}].enumerated()), id: \\.offset) { index, title in`, ...indent(page), "}"];
      return {
        lines: modifiers(call("TabView", [["selection", `$${name}`]], each), [
          `tabViewStyle(${dots ? ".page" : ".page(indexDisplayMode: .never)"})`,
          `frame(height: ${num(n(p, "height"))})`,
          `sensoryFeedback(.selection, trigger: ${name})`,
        ]),
      };
    },
  },
};

// ---------------------------------------------------------------- Chart

export const chart: SwiftPieceDefinition = {
  id: "chart",
  name: "Bar Chart",
  category: "content",
  description: "Bars that compare numbers at a glance. Touch a bar to read its value.",
  availability: "free",
  preview: preview("chart"),
  icon: "chart.bar",
  concepts: ["framework", "foreach", "state", "animation"],
  interactions: ["scrub", "tap", "haptic", "spring"],
  anatomy: [
    { part: "Data", props: ["values", "labels"] },
    { part: "Bars", props: ["tint", "height"] },
    { part: "Selection", props: ["highlight"] },
  ],
  variants: [
    { id: "week", label: "This week", props: { values: "4, 7, 5, 9, 6, 8, 3", labels: "Mon, Tue, Wed, Thu, Fri, Sat, Sun", tint: "accent", height: 180 } },
    { id: "months", label: "Months", props: { values: "12, 18, 15, 22, 27, 24", labels: "Jan, Feb, Mar, Apr, May, Jun", tint: "green", height: 220 } },
    { id: "steps", label: "Steps", props: { values: "6.2, 8.4, 10.1, 7.7, 12.3", labels: "Mon, Tue, Wed, Thu, Fri", tint: "orange", height: 160, highlight: 4 } },
  ],
  states: [
    { id: "none", label: "Nothing selected", props: { highlight: -1 } },
    { id: "selected", label: "Bar selected", props: { highlight: 3 } },
  ],
  properties: [
    text("values", "Values", "4, 7, 5, 9, 6, 8, 3", { hint: "Numbers separated by commas, up to 12." }),
    text("labels", "Labels", "Mon, Tue, Wed, Thu, Fri, Sat, Sun", { hint: "One label per value." }),
    color("tint", "Color", "accent"),
    number("height", "Height", 180, 120, 320),
    number("highlight", "Selected bar", -1, -1, 11, 1, { group: "state", hint: "Which bar starts selected, counting from 0. -1 for none." }),
  ],
  swift: {
    imports: ["Charts"],
    emit(p, ctx) {
      ctx.import("Charts");
      const vals = chartValues(p.values);
      const labels = chartLabels(p.labels, vals.length);
      const h = Math.round(n(p, "highlight"));
      const name = ctx.state("selected bar", "String?", h >= 0 && h < labels.length ? str(labels[h]) : "nil");
      const mark = chain(call("BarMark", [["x", '.value("Label", label)'], ["y", '.value("Value", value)']]), [
        `foregroundStyle(${ctx.style(s(p, "tint"))})`,
        "cornerRadius(4)",
        `opacity(${name} == nil || ${name} == label ? 1 : 0.35)`,
        blockMod("annotation(position: .top)", [`if ${name} == label {`, ...indent(modifiers(["Text(value, format: .number)"], ["font(.caption.bold())"])), "}"]),
      ]);
      const each = [`ForEach(Array(zip([${labels.map(str).join(", ")}], [${vals.map(num).join(", ")}])), id: \\.0) { label, value in`, ...indent(mark), "}"];
      return {
        lines: modifiers(call("Chart", [], each), [`chartXSelection(value: $${name})`, `frame(height: ${num(n(p, "height"))})`, `sensoryFeedback(.selection, trigger: ${name})`]),
      };
    },
  },
};

// ---------------------------------------------------------------- Option card

export const choice: SwiftPieceDefinition = {
  id: "choice",
  name: "Option Card",
  category: "controls",
  description: "A card people tap to pick one option, like a plan. Picking one unpicks the others.",
  availability: "free",
  preview: preview("choice"),
  icon: "checkmark.circle.fill",
  concepts: ["button", "state", "buttonstyle", "animation"],
  interactions: ["select", "press", "haptic", "spring"],
  anatomy: [
    { part: "Title", props: ["title", "badge", "icon"] },
    { part: "Detail", props: ["subtitle", "trailing"] },
    { part: "Selection", props: ["selected", "group"] },
  ],
  variants: [
    { id: "yearly", label: "Best value", props: { title: "Yearly", subtitle: "$59.99 a year", trailing: "$4.99/mo", badge: "Save 40%", icon: "none", selected: true } },
    { id: "monthly", label: "Plain", props: { title: "Monthly", subtitle: "$9.99 a month", trailing: "", badge: "", icon: "none", selected: false } },
    { id: "family", label: "With icon", props: { title: "Family", subtitle: "Up to 6 people", trailing: "$14.99/mo", badge: "", icon: "person.2", selected: false } },
  ],
  states: [
    { id: "unselected", label: "Not selected", props: { selected: false } },
    { id: "selected", label: "Selected", props: { selected: true } },
  ],
  properties: [
    text("title", "Title", "Yearly", { maxLength: 40 }),
    text("subtitle", "Subtitle", "$59.99 a year", { maxLength: 60 }),
    text("trailing", "Trailing text", "$4.99/mo", { maxLength: 20 }),
    text("badge", "Badge", "", { maxLength: 20, hint: "A small highlight next to the title, like Save 40%." }),
    icon("icon", "Icon", "none"),
    text("group", "Group", "plan", { maxLength: 24, group: "interaction", hint: "Cards with the same group act as one choice." }),
    bool("selected", "Starts selected", false, { group: "state" }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const title = s(p, "title").trim() || "Option";
      const selected = b(p, "selected");
      const name = ctx.shared(s(p, "group").trim() || "plan", "", selected ? str(title) : '""', selected);
      const on = `${name} == ${str(title)}`;
      const r = num(ctx.corner(16));
      const heading = modifiers([`Text(${str(title)})`], ["font(.headline)"]);
      const badge = s(p, "badge").trim();
      const titleRow = badge
        ? call("HStack", [["spacing", "6"]], [...heading, ...modifiers([`Text(${str(badge)})`], ["font(.caption2.weight(.bold))", "foregroundStyle(.white)", "padding(.horizontal, 6)", "padding(.vertical, 2)", "background(.tint, in: .capsule)"])])
        : heading;
      const subtitle = s(p, "subtitle").trim();
      const words = subtitle ? call("VStack", [["alignment", ".leading"], ["spacing", "2"]], [...titleRow, ...modifiers([`Text(${str(subtitle)})`], ["font(.subheadline)", "foregroundStyle(.secondary)"])]) : titleRow;
      const ic = s(p, "icon");
      const trailing = s(p, "trailing").trim();
      const row = call("HStack", [["spacing", "12"]], [
        ...(ic !== "none" ? modifiers([`Image(systemName: ${str(ctx.symbol(ic))})`], ["font(.title2)", "foregroundStyle(.tint)", "frame(width: 32)"]) : []),
        ...words,
        "Spacer()",
        ...(trailing ? modifiers([`Text(${str(trailing)})`], ["font(.subheadline.weight(.semibold))"]) : []),
        ...modifiers([`Image(systemName: ${on} ? "checkmark.circle.fill" : "circle")`], ["font(.title2)", `foregroundStyle(${on} ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))`]),
      ]);
      const label = chain(row, [
        `padding(${num(ctx.space(16))})`,
        `background(.fill.tertiary, in: .rect(cornerRadius: ${r}))`,
        blockMod("overlay", modifiers([`RoundedRectangle(cornerRadius: ${r})`], ["strokeBorder(.tint, lineWidth: 2)", `opacity(${on} ? 1 : 0)`])),
      ]);
      const button = ["Button {", `${INDENT}${name} = ${str(title)}`, "} label: {", ...indent(label), "}"];
      return { lines: modifiers(button, ["buttonStyle(.plain)", `animation(.snappy, value: ${name})`]) };
    },
  },
};

// ---------------------------------------------------------------- Tag

export const tag: SwiftPieceDefinition = {
  id: "tag",
  name: "Tag",
  category: "content",
  description: "A small colored label, like New, Sale or Beta.",
  availability: "free",
  preview: preview("tag"),
  icon: "tag",
  concepts: ["text", "background", "modifier"],
  interactions: [],
  anatomy: [
    { part: "Text", props: ["text", "icon"] },
    { part: "Capsule", props: ["style", "tint"] },
  ],
  variants: [
    { id: "new", label: "New", props: { text: "New", tint: "accent", style: "tinted", icon: "none" } },
    { id: "sale", label: "Sale", props: { text: "Sale", tint: "red", style: "filled", icon: "none" } },
    { id: "beta", label: "Beta", props: { text: "Beta", tint: "purple", style: "outlined", icon: "none" } },
    { id: "popular", label: "With icon", props: { text: "Popular", tint: "orange", style: "tinted", icon: "flame" } },
  ],
  properties: [
    text("text", "Text", "New", { maxLength: 24 }),
    color("tint", "Color", "accent"),
    select("style", "Style", "tinted", opts(["tinted", "Tinted"], ["filled", "Filled"], ["outlined", "Outlined"])),
    icon("icon", "Icon", "none"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const t = s(p, "tint");
      const style = s(p, "style");
      const ic = s(p, "icon");
      const head = ic !== "none" ? `Label(${str(s(p, "text"))}, systemImage: ${str(ctx.symbol(ic))})` : `Text(${str(s(p, "text"))})`;
      return {
        lines: chain([head], [
          "font(.caption.weight(.semibold))",
          `foregroundStyle(${style === "filled" ? inkOn(t) : ctx.style(t)})`,
          "padding(.horizontal, 8)",
          "padding(.vertical, 4)",
          style === "tinted" && `background(${t === "accent" ? ".tint" : ctx.color(t)}.opacity(0.15), in: .capsule)`,
          style === "filled" && `background(${ctx.style(t)}, in: .capsule)`,
          style === "outlined" && blockMod("overlay", modifiers(["Capsule()"], [`strokeBorder(${ctx.style(t)})`])),
        ]),
      };
    },
  },
};

export const nativeDefinitions: SwiftPieceDefinition[] = [image, avatar, searchField, slider, stepper, progress, picker, menu, disclosure, pageCarousel, chart, choice, tag];

/** Which of these take all the width they are offered (see react/preview/fills.ts). */
export const nativeFills: Record<string, boolean> = {
  image: true, avatar: false, "search-field": true, slider: true, stepper: true, progress: true, picker: true,
  menu: false, disclosure: true, "page-carousel": true, chart: true, choice: true, tag: false,
};

