// Fixed palettes behind the `color` and `icon` property types. Each entry maps one id to both
// sides of the bridge: the SwiftUI expression the export writes, and the value the web preview
// paints. iOS system colors change between light and dark appearance, so both are listed.

export type ColorEntry = { id: string; label: string; swift: string; light: string; dark: string };

export const colors: ColorEntry[] = [
  { id: "accent", label: "Accent", swift: ".accentColor", light: "#007AFF", dark: "#0A84FF" },
  { id: "primary", label: "Primary", swift: ".primary", light: "#000000", dark: "#FFFFFF" },
  { id: "secondary", label: "Secondary", swift: ".secondary", light: "rgba(60,60,67,0.6)", dark: "rgba(235,235,245,0.6)" },
  { id: "blue", label: "Blue", swift: ".blue", light: "#007AFF", dark: "#0A84FF" },
  { id: "indigo", label: "Indigo", swift: ".indigo", light: "#5856D6", dark: "#5E5CE6" },
  { id: "purple", label: "Purple", swift: ".purple", light: "#AF52DE", dark: "#BF5AF2" },
  { id: "pink", label: "Pink", swift: ".pink", light: "#FF2D55", dark: "#FF375F" },
  { id: "red", label: "Red", swift: ".red", light: "#FF3B30", dark: "#FF453A" },
  { id: "orange", label: "Orange", swift: ".orange", light: "#FF9500", dark: "#FF9F0A" },
  { id: "yellow", label: "Yellow", swift: ".yellow", light: "#FFCC00", dark: "#FFD60A" },
  { id: "green", label: "Green", swift: ".green", light: "#34C759", dark: "#30D158" },
  { id: "mint", label: "Mint", swift: ".mint", light: "#00C7BE", dark: "#63E6E2" },
  { id: "teal", label: "Teal", swift: ".teal", light: "#30B0C7", dark: "#40CBE0" },
  { id: "cyan", label: "Cyan", swift: ".cyan", light: "#32ADE6", dark: "#64D2FF" },
  { id: "gray", label: "Gray", swift: ".gray", light: "#8E8E93", dark: "#8E8E93" },
  { id: "white", label: "White", swift: ".white", light: "#FFFFFF", dark: "#FFFFFF" },
  { id: "black", label: "Black", swift: ".black", light: "#000000", dark: "#000000" },
];

const colorById = new Map(colors.map((c) => [c.id, c]));
export const colorEntry = (id: string): ColorEntry => colorById.get(id) ?? colors[0];
export const isColor = (id: unknown): id is string => typeof id === "string" && colorById.has(id);

/** Screen grounds: what `Screen.background` offers. `system` writes nothing. */
export type GroundEntry = { id: string; label: string; swift: string | null; light: string; dark: string };
export const grounds: GroundEntry[] = [
  { id: "system", label: "System", swift: null, light: "#FFFFFF", dark: "#000000" },
  { id: "grouped", label: "Grouped", swift: "Color(.systemGroupedBackground)", light: "#F2F2F7", dark: "#000000" },
  { id: "secondary", label: "Raised", swift: "Color(.secondarySystemBackground)", light: "#F2F2F7", dark: "#1C1C1E" },
  { id: "black", label: "Black", swift: "Color.black", light: "#000000", dark: "#000000" },
  { id: "white", label: "White", swift: "Color.white", light: "#FFFFFF", dark: "#FFFFFF" },
  { id: "indigo", label: "Indigo", swift: "Color.indigo", light: "#5856D6", dark: "#5E5CE6" },
];
const groundById = new Map(grounds.map((g) => [g.id, g]));
export const groundEntry = (id: string): GroundEntry => groundById.get(id) ?? grounds[0];

/**
 * The icon set. Ids are SF Symbol names, so the export writes them verbatim. The preview draws its
 * own simplified glyph for each (react/icons.tsx); SF Symbols themselves only ship on Apple devices.
 */
export const icons: Array<{ id: string; label: string }> = [
  { id: "none", label: "None" },
  { id: "arrow.right", label: "Arrow right" },
  { id: "chevron.right", label: "Chevron" },
  { id: "plus", label: "Plus" },
  { id: "checkmark", label: "Checkmark" },
  { id: "xmark", label: "Close" },
  { id: "envelope", label: "Envelope" },
  { id: "lock", label: "Lock" },
  { id: "person", label: "Person" },
  { id: "person.crop.circle.fill", label: "Avatar" },
  { id: "magnifyingglass", label: "Search" },
  { id: "bell", label: "Bell" },
  { id: "gearshape", label: "Settings" },
  { id: "house", label: "Home" },
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
  { id: "sparkles", label: "Sparkles" },
  { id: "bolt", label: "Bolt" },
  { id: "flame", label: "Flame" },
  { id: "leaf", label: "Leaf" },
  { id: "globe", label: "Globe" },
  { id: "camera", label: "Camera" },
  { id: "photo", label: "Photo" },
  { id: "cart", label: "Cart" },
  { id: "creditcard", label: "Card" },
  { id: "calendar", label: "Calendar" },
  { id: "clock", label: "Clock" },
  { id: "bookmark", label: "Bookmark" },
  { id: "paperplane", label: "Send" },
  { id: "tray", label: "Tray" },
  { id: "square.and.arrow.up", label: "Share" },
  { id: "trash", label: "Trash" },
  { id: "moon", label: "Moon" },
  { id: "music.note", label: "Music" },
  { id: "phone", label: "Phone" },
  { id: "bubble.left", label: "Message" },
  { id: "chart.bar", label: "Chart" },
  { id: "shield", label: "Shield" },
  { id: "eye", label: "Eye" },
  { id: "hand.wave", label: "Wave" },
];
const iconIds = new Set(icons.map((i) => i.id));
export const isIcon = (id: unknown): id is string => typeof id === "string" && iconIds.has(id);

/**
 * The free pieces' house palette, as the Swift sources define it (`HouseColor`, `Style.adaptive`).
 * The preview paints pieces with these so a piece looks the same on the web as in the simulator.
 */
export const house = {
  signal: "#FF5B3A",
  ink: "#141414",
  blocks: { tangerine: "#FF5B3A", sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF", sand: "#E9D5B3" } as Record<string, string>,
  light: { text: "#141414", muted: "#5C5A56", ground: "#F3F2EE", surface: "#FFFFFF", raised: "#EAE8E2", field: "#E9E7E1", empty: "#E7E5DF" },
  dark: { text: "#F4F3EF", muted: "#A6A49F", ground: "#121212", surface: "#1C1C1C", raised: "#262626", field: "#262626", empty: "#2E2E2E" },
};
export type HouseBlock = keyof typeof house.blocks;
export const houseBlocks = ["tangerine", "sky", "butter", "sage", "lilac", "sand"];

/** `Color(red:green:blue:)` for a hex value, for Style inits that take a plain Color. */
export function swiftRGB(hex: string): string {
  const v = hex.replace("#", "");
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
}
