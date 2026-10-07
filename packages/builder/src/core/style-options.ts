// A style's choices, shared by everything that edits one: the Playground's Style tab and the Styles
// page on swiftpieces.com (/styles). Each option's label, the presets, the accent row and how a hand
// edit lands live here once, so a style edited anywhere offers the same choices, says the same
// words and comes out as the same code.
import { lookById, themeFromLook } from "./looks.js";
import type { Theme } from "./schema.js";
import { encodeStyle } from "./shuffle.js";

type Opt<T extends string> = Array<[T, string]>;

/** Every choice's value and label, by Theme field. "own" stands for leaving the field out (the app's own). */
export const STYLE_OPTIONS: {
  appearance: Opt<Theme["appearance"]>;
  ground: Opt<NonNullable<Theme["ground"]>>;
  backdrop: Opt<NonNullable<Theme["backdrop"]>>;
  contrast: Opt<NonNullable<Theme["contrast"]>>;
  neutrals: Opt<NonNullable<Theme["neutrals"]>>;
  darkGround: Opt<NonNullable<Theme["darkGround"]>>;
  numbers: Opt<NonNullable<Theme["numbers"]>>;
  hierarchy: Opt<NonNullable<Theme["hierarchy"]>>;
  buttons: Opt<NonNullable<Theme["buttons"]>>;
  entrance: Opt<NonNullable<Theme["entrance"]>>;
  mascot: Opt<NonNullable<Theme["mascot"]>>;
  headers: Opt<NonNullable<Theme["headers"]>>;
  buttonSize: Opt<NonNullable<Theme["buttonSize"]>>;
  iconScale: Opt<NonNullable<Theme["iconScale"]>>;
  lists: Opt<NonNullable<Theme["lists"]> | "own">;
  tabStyle: Opt<NonNullable<Theme["tabStyle"]> | "own">;
  width: Opt<NonNullable<Theme["width"]>>;
  tracking: Opt<NonNullable<Theme["tracking"]>>;
  textSize: Opt<Theme["textSize"]>;
  weight: Opt<Theme["weight"]>;
  corners: Array<[Theme["corners"], string, number]>;
  density: Opt<Theme["density"]>;
  cards: Opt<NonNullable<Theme["cards"]>>;
  symbols: Opt<NonNullable<Theme["symbols"]>>;
  motion: Opt<NonNullable<Theme["motion"]>>;
} = {
  // The Style tab sets this with the top bar's light and dark; a page with no top bar shows it as a row.
  appearance: [["system", "System"], ["light", "Light"], ["dark", "Dark"]],
  ground: [["look", "Preset"], ["tinted", "Tinted"], ["plain", "Plain"]],
  backdrop: [["none", "None"], ["glow", "Glow"], ["gradient", "Wash"], ["mesh", "Mesh"], ["grid", "Dots"], ["paper", "Paper"]],
  contrast: [["soft", "Soft"], ["standard", "Standard"], ["high", "High"]],
  neutrals: [["neutral", "Neutral"], ["warm", "Warm"], ["cool", "Cool"]],
  darkGround: [["look", "Preset"], ["black", "Black"], ["graphite", "Graphite"]],
  numbers: [["default", "Default"], ["tabular", "Tabular"]],
  hierarchy: [["flat", "Flat"], ["balanced", "Balanced"], ["dramatic", "Dramatic"]],
  buttons: [["solid", "Solid"], ["tinted", "Tinted"], ["outline", "Outline"], ["glass", "Glass"]],
  entrance: [["none", "None"], ["fade", "Fade"], ["rise", "Rise"]],
  mascot: [["shown", "Shown"], ["hidden", "Hidden"]],
  headers: [["split", "Two-weight"], ["bold", "Bold"], ["centered", "Centered"]],
  buttonSize: [["compact", "Compact"], ["regular", "Regular"], ["large", "Large"]],
  iconScale: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]],
  lists: [["own", "App's"], ["cards", "Cards"], ["grouped", "Grouped"], ["plain", "Plain"]],
  tabStyle: [["own", "App's"], ["dock", "Dock"], ["glass", "Glass"], ["system", "System"]],
  width: [["compressed", "Narrow"], ["condensed", "Condensed"], ["standard", "Normal"], ["expanded", "Wide"]],
  tracking: [["tight", "Tight"], ["normal", "Normal"], ["wide", "Loose"]],
  textSize: [["default", "Default"], ["large", "Large"], ["xlarge", "XL"], ["xxlarge", "XXL"]],
  weight: [["light", "Light"], ["regular", "Regular"], ["medium", "Medium"], ["bold", "Bold"], ["heavy", "Heavy"]],
  // The third value is the radius a sample of the choice is drawn with.
  corners: [["square", "Square", 0], ["tight", "Tight", 3], ["standard", "Standard", 7], ["soft", "Soft", 10], ["round", "Round", 14]],
  density: [["compact", "Compact"], ["regular", "Regular"], ["roomy", "Roomy"], ["airy", "Airy"]],
  cards: [["flat", "Flat"], ["raised", "Raised"], ["outlined", "Outlined"], ["glass", "Glass"], ["bold", "Bold"]],
  symbols: [["outline", "Outline"], ["fill", "Filled"], ["hierarchical", "Two-tone"]],
  motion: [["smooth", "Smooth"], ["snappy", "Snappy"], ["bouncy", "Bouncy"]],
};

export type StyleOptionKey = keyof typeof STYLE_OPTIONS;

/**
 * What a field means when a style leaves it out. A style never writes these down: setting a field
 * back to its default deletes it, so two styles that look the same are the same code. The first
 * five are required fields, always written.
 */
export const STYLE_DEFAULTS: Record<StyleOptionKey, string> = {
  appearance: "system", textSize: "default", weight: "regular", corners: "standard", density: "regular",
  ground: "look", backdrop: "none", contrast: "standard", neutrals: "neutral", darkGround: "look", numbers: "default",
  hierarchy: "balanced", buttons: "solid", entrance: "none", mascot: "shown", headers: "split", buttonSize: "regular",
  iconScale: "medium", lists: "own", tabStyle: "own", width: "standard", tracking: "normal", cards: "flat", symbols: "outline", motion: "smooth",
};

const REQUIRED = new Set<StyleOptionKey>(["appearance", "textSize", "weight", "corners", "density"]);

/** Where a setting sits: the Style tab's sections, in order (the rarer ones wait under More). */
export type StyleGroup = "color" | "type" | "shape" | "more";

/**
 * The settings drawn as a row of choices, in the order the Style tab shows them. Fonts, the accent,
 * Weight, Corners and Cards draw their own controls, so they aren't listed here.
 */
export const STYLE_FIELDS: Array<{ key: Exclude<StyleOptionKey, "corners">; label: string; aria: string; group: StyleGroup }> = [
  { key: "ground", label: "Background", aria: "Background", group: "color" },
  { key: "contrast", label: "Contrast", aria: "Contrast", group: "color" },
  { key: "neutrals", label: "Greys", aria: "Greys", group: "color" },
  { key: "darkGround", label: "Dark mode", aria: "Dark mode ground", group: "color" },
  { key: "textSize", label: "Size", aria: "Text size", group: "type" },
  { key: "headers", label: "Headers", aria: "Headers", group: "type" },
  { key: "hierarchy", label: "Titles", aria: "Title hierarchy", group: "type" },
  { key: "numbers", label: "Numbers", aria: "Numbers", group: "type" },
  { key: "lists", label: "Lists", aria: "Lists", group: "shape" },
  { key: "buttons", label: "Buttons", aria: "Buttons", group: "shape" },
  { key: "buttonSize", label: "Button size", aria: "Button size", group: "shape" },
  { key: "density", label: "Spacing", aria: "Spacing", group: "shape" },
  { key: "backdrop", label: "Backdrop", aria: "Backdrop", group: "more" },
  { key: "width", label: "Width", aria: "Width", group: "more" },
  { key: "tracking", label: "Letters", aria: "Letter spacing", group: "more" },
  { key: "symbols", label: "Symbols", aria: "Symbols", group: "more" },
  { key: "iconScale", label: "Icon size", aria: "Icon size", group: "more" },
  { key: "tabStyle", label: "Tab bar", aria: "Tab bar", group: "more" },
  { key: "motion", label: "Motion", aria: "Motion", group: "more" },
  { key: "entrance", label: "Entrance", aria: "Entrance", group: "more" },
  { key: "mascot", label: "Mascot", aria: "Mascot", group: "more" },
];

/** A field's choice in this style: its value, or the default it stands for when left out. */
export function styleValue(t: Theme, key: StyleOptionKey): string {
  return (t[key] as string | undefined) ?? STYLE_DEFAULTS[key];
}

/** The edit that sets a field: the default (or "own") leaves an optional field out. */
export function stylePatch(key: StyleOptionKey, value: string): Partial<Theme> {
  return { [key]: !REQUIRED.has(key) && value === STYLE_DEFAULTS[key] ? undefined : value } as Partial<Theme>;
}

/**
 * A hand edit, as the Style tab makes it: the change merged in, fields given as `undefined` taken
 * out, the shuffled name dropped (it no longer describes the style), and a screenshot's exact
 * colours dropped when a colour setting changes.
 */
export function editTheme(t: Theme, patch: Partial<Theme>): Theme {
  const next: Theme = { ...t, ...patch };
  for (const k of Object.keys(patch) as Array<keyof Theme>) if (patch[k] === undefined) delete next[k];
  delete next.name;
  if (["look", "ground", "neutrals", "contrast", "darkGround"].some((k) => k in patch)) delete next.custom;
  return next;
}

/** A label for a field's value, as the controls say it ("Two-weight"), or the value itself. */
export function styleLabel(key: StyleOptionKey, value: string): string {
  const hit = (STYLE_OPTIONS[key] as Array<[string, string, number?]>).find(([v]) => v === value);
  return hit ? hit[1] : value;
}

/** CSS weights for the Weight choices, for samples drawn in a style's weight. */
export const WEIGHT_CSS: Record<Theme["weight"], number> = { light: 300, regular: 400, medium: 500, bold: 700, heavy: 800 };

/** A small sample's radius for each Corners choice. */
export const CORNER_PX: Record<Theme["corners"], number> = { square: 0, tight: 3, standard: 6, soft: 9, round: 12 };

/** Two colours close enough to read as the same swatch. */
function near(a: string, b: string) {
  const rgb = (h: string) => h.replace("#", "").match(/../g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
}

/** A grey, black or white: its channels barely differ. */
export function isNeutralHex(hex: string) {
  const n = hex.replace("#", "").match(/../g)?.map((x) => parseInt(x, 16)) ?? [];
  return n.length === 3 && Math.max(...n) - Math.min(...n) < 28;
}

/** Swatches in the accent row: one row of twelve (the last one is the custom picker). */
export const ACCENT_SLOTS = 12;

/** The accent row's other hues: one of each around the wheel, then a warm neutral and ink. */
export const ACCENT_SPREAD = ["#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E", "#1C1C1E"];

/**
 * The accent row for a style: the look's own accent, up to four of its colours (`accent: index`),
 * then other hues (`accentHex`) that aren't too close to those, and the style's accent when it's off
 * the row (a shuffled or picked colour), for the custom swatch to show.
 */
export function accentRow(t: Theme): { own: string; tiles: string[]; spread: string[]; custom: string | null } {
  const look = lookById(t.look);
  const tiles = look.dark.tiles.slice(0, 4);
  const spread = ACCENT_SPREAD.filter((c) => ![look.dark.accent, ...tiles].some((x) => near(x, c))).slice(0, ACCENT_SLOTS - 2 - tiles.length);
  const shown = new Set([...tiles, ...spread].map((c) => c.toUpperCase()));
  const custom = t.accentHex && !shown.has(t.accentHex.toUpperCase()) ? t.accentHex : null;
  return { own: look.dark.accent, tiles, spread, custom };
}

export type StylePreset = { id: string; label: string; colors: string[]; theme: () => Theme };

/**
 * The presets: SwiftPieces (the default), then three finished styles that each set everything at
 * once (colour, type, weight, shape and feel), so one tap shows how far a style can go.
 */
export const STYLE_PRESETS: StylePreset[] = [
  { id: "pieces", label: "SwiftPieces", colors: [], theme: () => themeFromLook("pieces") },
  {
    id: "citrus", label: "Citrus Pop", colors: ["#FF9500", "#FFD60A", "#FF8FB8", "#8EE3B2", "#8CC4FF"],
    theme: () => ({ ...themeFromLook("candy"), name: "Citrus Pop", accentHex: "#FF9500", appearance: "light", font: "rounded", weight: "bold", corners: "round", density: "roomy", cards: "raised", symbols: "fill", motion: "bouncy", backdrop: "glow", neutrals: "warm", hierarchy: "dramatic", buttons: "solid", entrance: "rise" }),
  },
  {
    id: "lagoon", label: "Lagoon Glass", colors: ["#32ADE6", "#5CE1E6", "#8CC4FF", "#A48BFF", "#8EE3B2"],
    theme: () => ({ ...themeFromLook("frost"), name: "Lagoon Glass", accentHex: "#32ADE6", appearance: "dark", font: "avenir-next", weight: "medium", corners: "soft", density: "regular", cards: "glass", symbols: "hierarchical", motion: "smooth", backdrop: "mesh", neutrals: "cool", darkGround: "graphite", numbers: "tabular", buttons: "glass", entrance: "fade" }),
  },
  {
    id: "brass", label: "Brass & Plum", colors: ["#D9B271", "#B08CC9", "#D1737F", "#5FAE8C", "#7F9FE0"],
    theme: () => ({ ...themeFromLook("velvet"), name: "Brass & Plum", accentHex: "#D9B271", appearance: "dark", font: "iowan", weight: "regular", corners: "soft", density: "roomy", cards: "outlined", symbols: "outline", motion: "smooth", backdrop: "glow", neutrals: "warm", contrast: "soft", hierarchy: "dramatic", buttons: "outline", entrance: "fade", mascot: "hidden" }),
  },
];

/** A preset's colours for its card: the ones it sets, or (SwiftPieces) its look's own palette. */
export function presetColors(p: StylePreset): string[] {
  if (p.colors.length) return p.colors;
  const look = lookById(p.id === "pieces" ? "pieces" : p.theme().look);
  return [...new Set([look.dark.accent, ...look.dark.tiles].map((x) => x.toLowerCase()))].filter((x) => !isNeutralHex(x));
}

/**
 * Whether a style is this preset: SwiftPieces when it's exactly the house look (light or dark either
 * way, or no style at all), any other preset while it still carries the preset's name.
 */
export function presetSelected(p: StylePreset, theme: Theme | undefined): boolean {
  if (p.id !== "pieces") return theme?.name === p.label;
  const house = themeFromLook("pieces");
  return !theme || encodeStyle({ ...theme, appearance: house.appearance }) === encodeStyle(house);
}
