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
  // Text and icons that sit on the accent: the ink Style picks to read on it (Theme.accentInk when the
  // app has a look; white on plain iOS).
  { id: "onAccent", label: "On accent", swift: ".white", light: "#FFFFFF", dark: "#FFFFFF" },
];

const colorById = new Map(colors.map((c) => [c.id, c]));
export const colorEntry = (id: string): ColorEntry => colorById.get(id) ?? colors[0];
export const isColor = (id: unknown): id is string => typeof id === "string" && colorById.has(id);

/** Screen grounds: what `Screen.background` offers. `system` writes nothing. */
/** `field`: a colour field (a screen painted one strong colour, its text white), not a neutral ground. */
export type GroundEntry = { id: string; label: string; swift: string | null; light: string; dark: string; field?: boolean };
export const grounds: GroundEntry[] = [
  { id: "system", label: "System", swift: null, light: "#FFFFFF", dark: "#000000" },
  { id: "grouped", label: "Grouped", swift: "Color(.systemGroupedBackground)", light: "#F2F2F7", dark: "#000000" },
  { id: "secondary", label: "Raised", swift: "Color(.secondarySystemBackground)", light: "#F2F2F7", dark: "#1C1C1E" },
  { id: "black", label: "Black", swift: "Color.black", light: "#000000", dark: "#000000", field: true },
  { id: "white", label: "White", swift: "Color.white", light: "#FFFFFF", dark: "#FFFFFF" },
  { id: "indigo", label: "Indigo", swift: "Color.indigo", light: "#5856D6", dark: "#5E5CE6" },
  // Colour fields: the way a calendar can give each kind of screen its own ground. The same colours
  // as Tint Panel's fields; deep enough that white text reads on every one. Pair with a dark screen.
  { id: "navy", label: "Navy field", swift: "Color(red: 0.086, green: 0.110, blue: 0.259)", light: "#161C42", dark: "#161C42", field: true },
  { id: "berry", label: "Berry field", swift: "Color(red: 0.604, green: 0.325, blue: 0.435)", light: "#9A536F", dark: "#9A536F", field: true },
  { id: "teal", label: "Deep teal field", swift: "Color(red: 0.020, green: 0.212, blue: 0.282)", light: "#053648", dark: "#053648", field: true },
  { id: "charcoal", label: "Charcoal field", swift: "Color(red: 0.086, green: 0.098, blue: 0.118)", light: "#16191E", dark: "#16191E", field: true },
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
  { id: "ellipsis", label: "More" },
  { id: "ellipsis.circle", label: "More (circle)" },
  { id: "square.and.pencil", label: "Compose" },
  { id: "pencil", label: "Edit" },
  { id: "slider.horizontal.3", label: "Adjust" },
  { id: "line.3.horizontal.decrease", label: "Filter" },
  { id: "arrow.left", label: "Arrow left" },
  { id: "arrow.up", label: "Arrow up" },
  { id: "arrow.down", label: "Arrow down" },
  { id: "arrow.up.right", label: "Arrow up right" },
  { id: "arrow.clockwise", label: "Refresh" },
  { id: "chevron.down", label: "Chevron down" },
  { id: "chevron.left", label: "Chevron left" },
  { id: "play.fill", label: "Play" },
  { id: "pause.fill", label: "Pause" },
  { id: "forward.fill", label: "Forward" },
  { id: "backward.fill", label: "Back" },
  { id: "speaker.wave.2", label: "Volume" },
  { id: "mic", label: "Microphone" },
  { id: "video", label: "Video" },
  { id: "map", label: "Map" },
  { id: "crop", label: "Crop" },
  { id: "location", label: "Location" },
  { id: "mappin", label: "Pin" },
  { id: "airplane", label: "Airplane" },
  { id: "bag", label: "Bag" },
  { id: "gift", label: "Gift" },
  { id: "tag", label: "Tag" },
  { id: "crown", label: "Crown" },
  { id: "trophy", label: "Trophy" },
  { id: "figure.walk", label: "Walk" },
  { id: "bed.double", label: "Bed" },
  { id: "cup.and.saucer", label: "Coffee" },
  { id: "fork.knife", label: "Food" },
  { id: "book", label: "Book" },
  { id: "graduationcap", label: "Learn" },
  { id: "doc.text", label: "Document" },
  { id: "folder", label: "Folder" },
  { id: "paperclip", label: "Attachment" },
  { id: "link", label: "Link" },
  { id: "qrcode", label: "QR code" },
  { id: "faceid", label: "Face ID" },
  { id: "hand.thumbsup", label: "Thumbs up" },
  { id: "message", label: "Messages" },
  { id: "sun.max", label: "Sun" },
  { id: "cloud", label: "Cloud" },
  { id: "drop", label: "Drop" },
  { id: "snowflake", label: "Snow" },
  { id: "heart.fill", label: "Heart (filled)" },
  { id: "star.fill", label: "Star (filled)" },
  { id: "bell.badge", label: "Bell badge" },
  { id: "person.2", label: "People" },
  { id: "person.badge.plus", label: "Add person" },
  { id: "lock.open", label: "Unlocked" },
  { id: "key", label: "Key" },
  { id: "checkmark.circle.fill", label: "Done" },
  { id: "xmark.circle.fill", label: "Clear" },
  { id: "exclamationmark.triangle", label: "Warning" },
  { id: "info.circle", label: "Info" },
  { id: "questionmark.circle", label: "Help" },
  { id: "plus.circle.fill", label: "Add" },
  { id: "minus", label: "Minus" },
  { id: "square.grid.2x2", label: "Grid" },
  { id: "list.bullet", label: "List" },
  { id: "rectangle.stack", label: "Stack" },
  { id: "wand.and.stars", label: "Magic" },
  { id: "paintpalette", label: "Palette" },
  { id: "textformat", label: "Text" },
  { id: "dollarsign.circle", label: "Dollar" },
  { id: "chart.pie", label: "Pie chart" },
  { id: "chart.line.uptrend.xyaxis", label: "Trend" },
  { id: "banknote", label: "Cash" },
  { id: "building.columns", label: "Bank" },
  { id: "shippingbox", label: "Package" },
  { id: "headphones", label: "Headphones" },
  { id: "film", label: "Film" },
  { id: "gamecontroller", label: "Games" },
  { id: "dumbbell", label: "Workout" },
  { id: "timer", label: "Timer" },
  { id: "alarm", label: "Alarm" },
  { id: "envelope.open", label: "Open mail" },
  { id: "arrow.triangle.2.circlepath", label: "Sync" },
  { id: "arrow.left.arrow.right", label: "Transfer" },
  { id: "square.and.arrow.down", label: "Download" },
  { id: "icloud", label: "iCloud" },
  { id: "hourglass", label: "Hourglass" },
  { id: "flag", label: "Flag" },
  { id: "pin", label: "Pinned" },
  { id: "eye.slash", label: "Hidden" },
  { id: "battery.100", label: "Battery" },
  { id: "wifi", label: "Wi-Fi" },
];
const iconIds = new Set(icons.map((i) => i.id));
export const isIcon = (id: unknown): id is string => typeof id === "string" && iconIds.has(id);

/**
 * The free pieces' house palette, as the Swift sources define it (`HouseColor`, `Style.adaptive`).
 * The preview paints pieces with these so a piece looks the same on the web as in the simulator.
 */
export const house = {
  signal: "#FF0000",
  ink: "#141414",
  blocks: { tangerine: "#FF0000", sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF", sand: "#E9D5B3" } as Record<string, string>,
  light: { text: "#141414", muted: "#5C5A56", ground: "#F3F2EE", surface: "#FFFFFF", raised: "#EAE8E2", field: "#E9E7E1", empty: "#E7E5DF" },
  dark: { text: "#F4F3EF", muted: "#A6A49F", ground: "#121212", surface: "#1C1C1C", raised: "#262626", field: "#262626", empty: "#2E2E2E" },
};
export type HouseBlock = keyof typeof house.blocks;
export const houseBlocks = ["tangerine", "sky", "butter", "sage", "lilac", "sand"];

let signalAs: string | null = null;
let styledAccent: { light: string; dark: string } | null = null;

/**
 * While a themed app is written, the house signal red (#FF0000) in any component is written as the
 * app's accent, so a Style accent reaches every component in the exported SwiftUI, as in the preview.
 */
export function withSwiftAccent<T>(accent: string | null, fn: () => T, styled: { light: string; dark: string } | null = null): T {
  const prev = signalAs;
  const prevStyled = styledAccent;
  signalAs = accent;
  styledAccent = accent ? styled : null;
  try {
    return fn();
  } finally {
    signalAs = prev;
    styledAccent = prevStyled;
  }
}

/**
 * Whether a Style's accent (its light and dark values) should drive a piece's own palette: it has to
 * have moved off the house red, and carry colour. An ink or grey accent (a monochrome Style) would turn
 * colour into greys, so pieces keep their designed colours under it.
 */
export function accentDrivesPalette(...hexes: string[]): boolean {
  return hexes.length > 0 && hexes.every((hex) => {
    const v = hex.replace("#", "");
    if (/^ff0000$/i.test(v) || v.length !== 6) return false;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    return sat >= 0.12 && light > 0.08 && light < 0.95;
  });
}

/**
 * The Style accent's light and dark values while a themed app is written, when that accent drives
 * pieces' own palettes (`accentDrivesPalette`), else null. Pieces whose colours should follow a Style
 * (Layer Fill's bands) key off this; the default house look keeps their designed colours, as the
 * preview does.
 */
export function swiftStyledAccent(): { light: string; dark: string } | null {
  return styledAccent;
}

/** The Swift for a colour when it is the house red and the app has an accent to write instead; else null. */
export function swiftSignal(hex: string, opacity = 1): string | null {
  if (!signalAs || !/^#?ff0000$/i.test(hex.trim())) return null;
  return opacity !== 1 ? `${signalAs}.opacity(${Math.round(opacity * 1000) / 1000})` : signalAs;
}

/** `Color(red:green:blue:)` for a hex value, for Style inits that take a plain Color. */
export function swiftRGB(hex: string): string {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
}
