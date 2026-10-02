// Looks: the playground's starting styles. Each is named after, and copied by hand from, one of
// Swift Pieces Pro's scheme families (SwiftPiecesPro/lib/brand/schemes.ts), so a look picked here
// is the same look the Pro screens and templates render in. Free never imports Pro code, so when a
// Pro family changes, update its values here too (the same arrangement as lib/pro-catalog.ts).
//
// A look only carries what the exported Swift can express, so the preview never promises more than
// Xcode shows: an accent, the screen background and surface, a font design and a corner style.
import { fontById, type FontDef } from "./fonts.js";
import type { Theme, ThemeAppearance, ThemeBackdrop, ThemeButtonSize, ThemeButtons, ThemeHeaders, ThemeIconScale, ThemeTabStyle, ThemeLists, ThemeCards, ThemeContrast, ThemeCorners, ThemeDarkGround, ThemeDensity, ThemeEntrance, ThemeFont, ThemeGround, ThemeHierarchy, ThemeMascot, ThemeMotion, ThemeNeutrals, ThemeNumbers, ThemeSymbols, ThemeTextSize, ThemeTracking, ThemeWeight, ThemeWidth } from "./schema.js";

export type Look = {
  id: string;
  name: string;
  description: string;
  /** The appearance the look is designed around. */
  signature: "light" | "dark";
  font: ThemeFont;
  corners: ThemeCorners;
  light: LookColors;
  dark: LookColors;
};

type LookColors = { accent: string; bg: string; surface: string; text: string; tiles: string[] };

export const looks: Look[] = [
  // The library's own look, from the Pro card: near-black ground, white ink, the signal red and the
  // red → orange → pink → blue sweep of the site's halftone. Every app library recreation uses it.
  { id: "pieces", name: "Swift Pieces", description: "Pro black with the signal sweep.", signature: "dark", font: "default", corners: "standard",
    light: { accent: "#FF0000", bg: "#F3F2EE", surface: "#FFFFFF", text: "#141414", tiles: ["#FF0000", "#FF7A3C", "#FF8FB8", "#4D8DFF", "#9CC2FF", "#FFD976"] },
    dark: { accent: "#FF0000", bg: "#070708", surface: "#141416", text: "#FFFFFF", tiles: ["#FF0000", "#FF7A3C", "#FF8FB8", "#4D8DFF", "#9CC2FF", "#FFD976"] } },
  { id: "studio", name: "Studio", description: "Charcoal and pastel blocks.", signature: "dark", font: "default", corners: "soft",
    light: { accent: "#161616", bg: "#efede7", surface: "#ffffff", text: "#161616", tiles: ["#ffab7e", "#92dca1", "#b9c9ff", "#ffd36e", "#d7b9ff", "#ff907c"] },
    dark: { accent: "#a8e6b4", bg: "#161616", surface: "#222222", text: "#f3f1ec", tiles: ["#ffb38a", "#a8e6b4", "#c8d5ff", "#ffdb8a", "#e0c8ff", "#ff9c8a"] } },
  { id: "editorial", name: "Editorial", description: "Serif headlines, ink and paper.", signature: "dark", font: "serif", corners: "standard",
    light: { accent: "#1b1a17", bg: "#f4f1ea", surface: "#fffdf8", text: "#1b1a17", tiles: ["#9dbb9f", "#9dbdd2", "#e3a589", "#e5d2b0", "#c2b7dd"] },
    dark: { accent: "#f4f1ea", bg: "#131312", surface: "#1f1f1d", text: "#f4f1ea", tiles: ["#86a88a", "#86abc4", "#d48f70", "#dcc6a1", "#afa2cf"] } },
  { id: "graphic", name: "Graphic", description: "Concrete grey and flat primaries.", signature: "light", font: "default", corners: "standard",
    light: { accent: "#111111", bg: "#d6d6d6", surface: "#e8e8e8", text: "#111111", tiles: ["#ff5a2e", "#b98bf7", "#f2ee5b", "#9ddba5", "#86adff", "#f5a9de"] },
    dark: { accent: "#f2f2f2", bg: "#1b1b1b", surface: "#2a2a2a", text: "#f2f2f2", tiles: ["#ff6a40", "#be95f8", "#f2ee5b", "#9ddba5", "#8fb4ff", "#f5a9de"] } },
  { id: "neon", name: "Neon", description: "Void black with electric lime.", signature: "dark", font: "mono", corners: "standard",
    light: { accent: "#0e0e10", bg: "#f2f2ec", surface: "#ffffff", text: "#0e0e10", tiles: ["#c9f53a", "#a48bff", "#5ad8de", "#ff8a4c", "#ff85cb"] },
    dark: { accent: "#d4ff3f", bg: "#0a0a0b", surface: "#16161a", text: "#f4f4f0", tiles: ["#d4ff3f", "#9b7dff", "#5ce1e6", "#ff8a4c", "#ff7ac6"] } },
  { id: "candy", name: "Candy", description: "Cream and bright, friendly blocks.", signature: "light", font: "rounded", corners: "soft",
    light: { accent: "#6b4eff", bg: "#fff7ec", surface: "#ffffff", text: "#1d1a2f", tiles: ["#ff9f5a", "#ff9acd", "#ffe066", "#8ee3b2", "#8cc4ff", "#b8a4ff"] },
    dark: { accent: "#a594ff", bg: "#16132a", surface: "#221e3c", text: "#f7f4ff", tiles: ["#ffa56a", "#ff9acd", "#ffe066", "#8ee3b2", "#8cc4ff", "#b8a4ff"] } },
  { id: "ember", name: "Ember", description: "Burnt night and persimmon light.", signature: "dark", font: "rounded", corners: "soft",
    light: { accent: "#b8401f", bg: "#fbede3", surface: "#fff8f2", text: "#2a140c", tiles: ["#ff8a5c", "#f59caa", "#f5c07a", "#bfcb88", "#ebcba5"] },
    dark: { accent: "#ff7a4d", bg: "#170d0a", surface: "#241611", text: "#fbede3", tiles: ["#ff7a4d", "#f28c9b", "#f2b872", "#b1c07a", "#e8c9a6"] } },
  { id: "press", name: "Press", description: "Newsprint, printing inks, tight corners.", signature: "light", font: "default", corners: "tight",
    light: { accent: "#0b0b0b", bg: "#f5f3ee", surface: "#fffefa", text: "#0b0b0b", tiles: ["#e03c31", "#2f4bbf", "#e0a530", "#53616b", "#a8bfa0"] },
    dark: { accent: "#f2f0e9", bg: "#0f0f0e", surface: "#1a1a18", text: "#f2f0e9", tiles: ["#ff5a45", "#8fa2ff", "#e8bd63", "#9fb0bb", "#aecfa4"] } },
  { id: "velvet", name: "Velvet", description: "Aubergine night and brass.", signature: "dark", font: "serif", corners: "soft",
    light: { accent: "#7a5a1f", bg: "#f6f0e6", surface: "#fffbf4", text: "#1d1526", tiles: ["#e0bd85", "#74bf9c", "#93b0ea", "#db8b95", "#c2a3d6"] },
    dark: { accent: "#d9b271", bg: "#16101c", surface: "#211a29", text: "#f6f0e6", tiles: ["#d9b271", "#5fae8c", "#7f9fe0", "#d1737f", "#b08cc9"] } },
  { id: "frost", name: "Frost", description: "Glacier white, steel and ice.", signature: "light", font: "default", corners: "standard",
    light: { accent: "#0d151b", bg: "#eef2f5", surface: "#ffffff", text: "#0d151b", tiles: ["#a8d4e8", "#8b9aa8", "#93d9bd", "#93b8f0", "#b6b0e8"] },
    dark: { accent: "#7fd4ef", bg: "#0e1418", surface: "#182027", text: "#eef4f8", tiles: ["#9fd6ee", "#a6b6c2", "#93d9bd", "#9dbcf5", "#b9b3ee"] } },
  { id: "sol", name: "Sol", description: "Sand, marigold and terracotta.", signature: "light", font: "default", corners: "soft",
    light: { accent: "#b5451f", bg: "#f2e4ce", surface: "#fdf3e2", text: "#1e1411", tiles: ["#f0b43c", "#dd7043", "#9aad5a", "#5fa9a3", "#f0dfc0"] },
    dark: { accent: "#f0903f", bg: "#1e1411", surface: "#2a1d17", text: "#f7e9d4", tiles: ["#f5bc4c", "#e8825a", "#aabf6a", "#74bdb5", "#f2dfbe"] } },
];

const byId = new Map(looks.map((l) => [l.id, l]));
export const lookById = (id: string | undefined): Look => byId.get(id ?? "") ?? byId.get("studio")!;

/** A theme a look starts from: its own font, corners and signature appearance. */
export function themeFromLook(id: string): Theme {
  const look = lookById(id);
  return { look: look.id, accent: -1, appearance: look.signature, font: look.font, corners: look.corners, textSize: "default", weight: "regular", density: "regular" };
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** The ink that reads on a fill: near-black or white, whichever has more contrast. */
export function inkOn(fill: string): string {
  const l = luminance(fill);
  return (l + 0.05) / (luminance("#121212") + 0.05) >= 1.05 / (l + 0.05) ? "#121212" : "#ffffff";
}

export type Pair = { light: string; dark: string };

/** Everything a theme resolves to, for the preview and the generated Swift alike. */
export type ResolvedTheme = {
  look: Look;
  accent: Pair;
  accentInk: Pair;
  background: Pair;
  surface: Pair;
  appearance: ThemeAppearance;
  font: ThemeFont;
  corners: ThemeCorners;
  /** Multiplier for corner radii: tight, standard or soft. */
  cornerScale: number;
  textSize: ThemeTextSize;
  /** Multiplier the preview applies to text sizes, matching the Dynamic Type size. */
  textScale: number;
  weight: ThemeWeight;
  /** Added to every text weight in the preview (Swift sets `.fontWeight` at the root instead). */
  weightBoost: number;
  density: ThemeDensity;
  /** Multiplier for stack spacing and padding. */
  spaceScale: number;
  width: ThemeWidth;
  /** CSS font-stretch the preview applies for the letter width. */
  fontStretch: string;
  tracking: ThemeTracking;
  /** CSS letter-spacing the preview applies (Swift sets `.tracking` at the root instead). */
  letterSpacing: string;
  ground: ThemeGround;
  /** The body font and the heading font (the same unless a heading font is set). */
  body: FontDef;
  heading: FontDef;
  backdrop: ThemeBackdrop;
  cards: ThemeCards;
  symbols: ThemeSymbols;
  motion: ThemeMotion;
  contrast: ThemeContrast;
  neutrals: ThemeNeutrals;
  darkGround: ThemeDarkGround;
  numbers: ThemeNumbers;
  hierarchy: ThemeHierarchy;
  /** Multiplier for titles and display figures (22 points and up): Style's Hierarchy. */
  titleScale: number;
  buttons: ThemeButtons;
  entrance: ThemeEntrance;
  mascot: ThemeMascot;
  headers: ThemeHeaders;
  buttonSize: ThemeButtonSize;
  /** Button height in points: 48, 56 or 64. */
  buttonHeight: number;
  iconScale: ThemeIconScale;
  /** Null: the app's own tab bar. */
  tabStyle: ThemeTabStyle | null;
  /** Null: each list as its remix was built. */
  lists: ThemeLists | null;
  /** Cards fill with the surface colour, even flat ones: the ground and cards came from a screenshot. */
  solidCards: boolean;
  /** The style's name, when it has one. */
  name: string | null;
};

export const CORNER_SCALE: Record<ThemeCorners, number> = { square: 0, tight: 0.45, standard: 1, soft: 1.3, round: 1.8 };
/** Square and round behave like tight and soft where Swift picks a shape (a button's border). */
const CORNER_KIND: Record<ThemeCorners, ThemeCorners> = { square: "tight", tight: "tight", standard: "standard", soft: "soft", round: "soft" };
/** Dynamic Type floors: default leaves iOS alone; large and up set at least .xLarge, .xxLarge or
 *  .xxxLarge, as a range, so anyone who picked a bigger size in iOS Settings keeps it. */
export const TEXT_SCALE: Record<ThemeTextSize, number> = { default: 1, large: 1.12, xlarge: 1.24, xxlarge: 1.36 };
export const DYNAMIC_TYPE: Record<ThemeTextSize, string | null> = { default: null, large: ".xLarge...", xlarge: ".xxLarge...", xxlarge: ".xxxLarge..." };
export const WEIGHT_BOOST: Record<ThemeWeight, number> = { light: -100, regular: 0, medium: 100, bold: 200, heavy: 300 };
export const FONT_WEIGHT: Record<ThemeWeight, string | null> = { light: ".light", regular: null, medium: ".medium", bold: ".semibold", heavy: ".heavy" };
export const SPACE_SCALE: Record<ThemeDensity, number> = { compact: 0.75, regular: 1, roomy: 1.25, airy: 1.5 };
export const FONT_STRETCH: Record<ThemeWidth, string> = { compressed: "75%", condensed: "87.5%", standard: "100%", expanded: "125%" };
export const FONT_WIDTH: Record<ThemeWidth, string | null> = { compressed: ".compressed", condensed: ".condensed", standard: null, expanded: ".expanded" };
export const LETTER_SPACING: Record<ThemeTracking, string> = { tight: "-0.02em", normal: "normal", wide: "0.06em" };
export const TRACKING: Record<ThemeTracking, string | null> = { tight: "-0.4", normal: null, wide: "1.2" };
export const TITLE_SCALE: Record<ThemeHierarchy, number> = { flat: 0.86, balanced: 1, dramatic: 1.18 };
export const BUTTON_HEIGHT: Record<ThemeButtonSize, number> = { compact: 48, regular: 56, large: 64 };
export const ICON_SCALE: Record<ThemeIconScale, number> = { small: 0.84, medium: 1, large: 1.2 };

/**
 * The grounds and surfaces after Style's colour settings: the dark ground (true black, graphite),
 * the greys' temperature (warm, cool), then contrast (soft blends cards into the ground, high
 * separates them). Applied in this order, the same for the preview and Theme.swift.
 */
function shade(background: Pair, surface: Pair, t: { darkGround: ThemeDarkGround; neutrals: ThemeNeutrals; contrast: ThemeContrast }): { background: Pair; surface: Pair } {
  let bg = { ...background };
  let sf = { ...surface };
  if (t.darkGround === "black") (bg.dark = "#000000"), (sf.dark = "#141416");
  if (t.darkGround === "graphite") (bg.dark = "#1C1C1E"), (sf.dark = "#2C2C2E");
  if (t.neutrals !== "neutral") {
    const tone = t.neutrals === "warm" ? "#C98B4F" : "#4F7BC9";
    // True black stays black; everything else takes the temperature.
    bg = { light: mixHex(bg.light, tone, 0.07), dark: t.darkGround === "black" ? bg.dark : mixHex(bg.dark, tone, 0.08) };
    sf = { light: mixHex(sf.light, tone, 0.05), dark: mixHex(sf.dark, tone, 0.08) };
  }
  if (t.contrast === "soft") sf = { light: mixHex(sf.light, bg.light, 0.45), dark: mixHex(sf.dark, bg.dark, 0.45) };
  if (t.contrast === "high") {
    bg = { light: mixHex(bg.light, "#000000", 0.05), dark: mixHex(bg.dark, "#000000", 0.6) };
    sf = { light: mixHex(sf.light, "#FFFFFF", 0.6), dark: mixHex(sf.dark, "#FFFFFF", 0.06) };
  }
  return { background: bg, surface: sf };
}

/** Mixes two "#RRGGBB" colors: `t` of the way from `a` to `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  const look = lookById(theme.look);
  const tile = theme.accent ?? -1;
  const custom = typeof theme.accentHex === "string" && /^#[0-9a-f]{6}$/i.test(theme.accentHex) ? theme.accentHex : null;
  const accent = custom
    ? { light: custom, dark: custom }
    : tile >= 0 && look.light.tiles[tile] && look.dark.tiles[tile]
      ? { light: look.light.tiles[tile], dark: look.dark.tiles[tile] }
      : { light: look.light.accent, dark: look.dark.accent };
  const ground = theme.ground ?? "look";
  const background =
    ground === "plain"
      ? { light: "#FFFFFF", dark: "#000000" }
      : ground === "tinted"
        ? { light: mixHex(look.light.bg, accent.light, 0.08), dark: mixHex(look.dark.bg, accent.dark, 0.1) }
        : { light: look.light.bg, dark: look.dark.bg };
  const shaded = shade(background, { light: look.light.surface, dark: look.dark.surface }, { darkGround: theme.darkGround ?? "look", neutrals: theme.neutrals ?? "neutral", contrast: theme.contrast ?? "standard" });
  // Exact colours from a screenshot win, in the mode the screenshot was in.
  const exact = theme.custom;
  if (exact) {
    shaded.background[exact.mode] = exact.ground;
    if (exact.surface) shaded.surface[exact.mode] = exact.surface;
  }
  const corners = theme.corners ?? "standard";
  const width = theme.width ?? "standard";
  const tracking = theme.tracking ?? "normal";
  return {
    look,
    accent,
    accentInk: { light: inkOn(accent.light), dark: inkOn(accent.dark) },
    background: shaded.background,
    surface: shaded.surface,
    appearance: theme.appearance,
    font: theme.font,
    corners: CORNER_KIND[corners] ?? "standard",
    cornerScale: CORNER_SCALE[corners] ?? 1,
    textSize: theme.textSize ?? "default",
    textScale: TEXT_SCALE[theme.textSize ?? "default"],
    weight: theme.weight ?? "regular",
    weightBoost: WEIGHT_BOOST[theme.weight ?? "regular"],
    density: theme.density ?? "regular",
    spaceScale: SPACE_SCALE[theme.density ?? "regular"],
    width,
    fontStretch: FONT_STRETCH[width],
    tracking,
    letterSpacing: LETTER_SPACING[tracking],
    ground,
    body: fontById(theme.font),
    heading: fontById(theme.headingFont ?? theme.font),
    backdrop: theme.backdrop ?? "none",
    cards: theme.cards ?? "flat",
    symbols: theme.symbols ?? "outline",
    motion: theme.motion ?? "smooth",
    contrast: theme.contrast ?? "standard",
    neutrals: theme.neutrals ?? "neutral",
    darkGround: theme.darkGround ?? "look",
    numbers: theme.numbers ?? "default",
    hierarchy: theme.hierarchy ?? "balanced",
    titleScale: TITLE_SCALE[theme.hierarchy ?? "balanced"],
    buttons: theme.buttons ?? "solid",
    entrance: theme.entrance ?? "none",
    mascot: theme.mascot ?? "shown",
    headers: theme.headers ?? "split",
    buttonSize: theme.buttonSize ?? "regular",
    buttonHeight: BUTTON_HEIGHT[theme.buttonSize ?? "regular"],
    iconScale: theme.iconScale ?? "medium",
    tabStyle: theme.tabStyle ?? null,
    lists: theme.lists ?? null,
    solidCards: !!exact?.surface,
    name: theme.name ?? null,
  };
}

/** `0xRRGGBB` for Swift. */
export const swiftHex = (hex: string) => `0x${hex.replace("#", "").toUpperCase()}`;
