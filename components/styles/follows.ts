// What in a style reaches which tile of the studio's canvas. Each tile lists the parts it follows
// (lib/styles.ts), and each of the panel's settings says which parts it changes, so pointing at a
// setting lights up the tiles it changes and dims the rest, and changing one flashes them.
import { STYLE_FIELDS, type Theme } from "@swiftpieces/builder";

/**
 * A part of a style a tile can follow, as the panel names it. Measured, not guessed: each tile was
 * drawn with one setting changed at a time and compared with the style before it.
 */
export type StyleFollow = "accent" | "corners" | "cards" | "buttons" | "buttonSize" | "headings" | "titles" | "body" | "spacing" | "motion" | "lists" | "icons";

export const FOLLOW_LABELS: Record<StyleFollow, string> = {
  accent: "Accent",
  corners: "Corners",
  cards: "Cards",
  buttons: "Buttons",
  buttonSize: "Button size",
  headings: "Headings",
  titles: "Titles",
  body: "Body",
  spacing: "Spacing",
  motion: "Motion",
  lists: "Lists",
  icons: "Icon size",
};

/**
 * What a setting reaches: some parts (the tiles that follow them light up), every tile (it changes
 * the ground they all sit on, or every word), or only whole screens (the tab bar, say), which the
 * canvas's Screens view shows.
 */
export type Reach = StyleFollow[] | "all" | "screens";

/** A setting being pointed at in the panel: its name and what it reaches. */
export type Spot = { label: string; reach: Reach };

/** Each setting by its Theme key ("accent" and "accentHex" are the colour strip). */
const REACH: Partial<Record<keyof Theme, Reach>> = {
  look: "all",
  accent: ["accent"],
  accentHex: ["accent"],
  appearance: "all",
  neutrals: "all",
  contrast: "all",
  // The tiles are neutral (surfaces.ts), so the style's background shows on whole screens.
  ground: "screens",
  // In dark mode it sets how black both the ground and the cards' black are.
  darkGround: "all",
  // A backdrop lies over whole screens; the tiles keep a plain ground, so it shows on Screens.
  backdrop: "screens",
  font: ["body"],
  headingFont: ["headings"],
  textSize: "all",
  hierarchy: ["titles"],
  tracking: "all",
  width: "all",
  weight: "all",
  density: ["spacing"],
  motion: ["motion"],
  corners: ["corners"],
  cards: ["cards"],
  buttons: ["buttons"],
  buttonSize: ["buttonSize"],
  lists: ["lists"],
  iconScale: ["icons"],
  // Filled and two-tone symbols show in rows and tab bars; the tiles' own glyphs are line symbols.
  symbols: "screens",
  numbers: "screens",
  headers: "screens",
  tabStyle: "screens",
  entrance: "screens",
  mascot: "screens",
};

/** The panel's word for a setting. */
const LABELS: Partial<Record<keyof Theme, string>> = {
  look: "Look",
  accent: "Color",
  accentHex: "Color",
  appearance: "Appearance",
  font: "Body",
  headingFont: "Headings",
  weight: "Character",
  density: "Character",
  corners: "Corners",
  cards: "Cards",
  ...Object.fromEntries(STYLE_FIELDS.map((f) => [f.key, f.label])),
};

/** The setting `key` (a Theme key) as a spot, or null when it reaches nothing the canvas shows. */
export function spotOf(key: string): Spot | null {
  const reach = REACH[key as keyof Theme];
  return reach ? { label: LABELS[key as keyof Theme] ?? key, reach } : null;
}

/** Whether a tile following `follows` is reached by `reach`. */
export const reaches = (reach: Reach, follows: readonly StyleFollow[]) => reach === "all" || (reach !== "screens" && reach.some((f) => follows.includes(f)));

/**
 * What one edit reached, from the style before and after it, as a spot: the parts its changed
 * settings follow, every tile when one of them changes them all, or "screens" when only whole
 * screens show it. Null when nothing that reaches anything changed.
 */
export function spotOfEdit(before: Theme, after: Theme): Spot | null {
  const keys = (Object.keys(REACH) as Array<keyof Theme>).filter((k) => before[k] !== after[k]);
  if (!keys.length) return null;
  const label = LABELS[keys[0]] ?? keys[0];
  const reach = keys.map((k) => REACH[k]!);
  if (reach.includes("all")) return { label, reach: "all" };
  const parts = [...new Set(reach.flatMap((r) => (r === "screens" || r === "all" ? [] : r)))];
  return { label, reach: parts.length ? parts : "screens" };
}
