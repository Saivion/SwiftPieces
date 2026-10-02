// Shuffle: endless styles that still look designed. Each shuffle picks a mood (Editorial, Playful,
// Brutalist…) and samples every part of the style within that mood's rules, so a serif headline
// comes with tight corners and hairlines, a rounded font with soft corners and bouncy motion. The
// accent is generated in OKLCH (even brightness across hues), so colour never runs out. Locked
// sections keep their values. Everything is seeded: the same seed makes the same style.
//
// A style also travels as a short code (encodeStyle / decodeStyle) that recreates it exactly.
import { fontById, fonts, isFontId } from "./fonts.js";
import { lookById, looks } from "./looks.js";
import type { Theme, ThemeBackdrop, ThemeButtonSize, ThemeButtons, ThemeHeaders, ThemeIconScale, ThemeTabStyle, ThemeLists, ThemeCards, ThemeContrast, ThemeCorners, ThemeDarkGround, ThemeDensity, ThemeEntrance, ThemeGround, ThemeHierarchy, ThemeMascot, ThemeMotion, ThemeNeutrals, ThemeNumbers, ThemeSymbols, ThemeTextSize, ThemeTracking, ThemeWeight, ThemeWidth } from "./schema.js";

// ---------------------------------------------------------------- Random

/** A small, fast seeded random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A fresh seed from the platform's secure random source (Math.random where there is none). */
export const newSeed = (): number => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
};

type R = () => number;
const pick = <T,>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
/** Weighted pick: `[value, weight]` pairs. */
const weighted = <T,>(r: R, xs: ReadonlyArray<readonly [T, number]>): T => {
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of xs) if ((x -= w) <= 0) return v;
  return xs[xs.length - 1][0];
};
const between = (r: R, lo: number, hi: number) => lo + r() * (hi - lo);

// ---------------------------------------------------------------- Colour (OKLCH)

/** "#RRGGBB" for an OKLCH colour (L 0–1, C ~0–0.37, H degrees), clipped into sRGB by lowering chroma. */
export function oklchHex(l: number, c: number, h: number): string {
  for (let chroma = c; chroma >= 0; chroma -= 0.005) {
    const rgb = oklchToSrgb(l, chroma, h);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }
  return "#808080";
}

function oklchToSrgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.sign(x) * Math.abs(x) ** (1 / 2.4) - 0.055);
  return lin.map(gamma) as [number, number, number];
}

/** The hue of a "#RRGGBB" colour, in degrees (for naming). */
export function hueOf(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return -1;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** A colour word for a hue (and how vivid it is), for style names. */
function colourWord(hex: string, r: R): string {
  const h = hueOf(hex);
  const [rr, gg, bb] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  const sat = (Math.max(rr, gg, bb) - Math.min(rr, gg, bb)) / 255;
  const light = (Math.max(rr, gg, bb) + Math.min(rr, gg, bb)) / 510;
  if (h < 0 || sat < 0.12) return pick(r, light > 0.6 ? ["Chalk", "Paper", "Bone", "Frost"] : light < 0.25 ? ["Ink", "Midnight", "Carbon", "Onyx"] : ["Graphite", "Slate", "Pewter", "Smoke"]);
  const words: Array<[number, string[]]> = [
    [15, ["Scarlet", "Signal", "Cherry", "Ember"]],
    [40, ["Coral", "Persimmon", "Tangerine", "Clay"]],
    [60, ["Amber", "Marigold", "Honey", "Saffron"]],
    [80, ["Citrus", "Lemon", "Brass", "Sunbeam"]],
    [110, ["Lime", "Chartreuse", "Pistachio", "Kiwi"]],
    [160, ["Moss", "Jade", "Fern", "Sage"]],
    [190, ["Mint", "Lagoon", "Seafoam", "Teal"]],
    [215, ["Glacier", "Sky", "Harbor", "Azure"]],
    [245, ["Cobalt", "Ultramarine", "Denim", "Sapphire"]],
    [280, ["Iris", "Violet", "Indigo", "Lavender"]],
    [315, ["Plum", "Orchid", "Amethyst", "Mauve"]],
    [345, ["Rose", "Fuchsia", "Peony", "Flamingo"]],
    [361, ["Scarlet", "Crimson", "Ruby", "Poppy"]],
  ];
  const w = words.find(([limit]) => h < limit)![1];
  return pick(r, light < 0.3 ? [`Deep ${pick(r, w)}`, pick(r, w)] : w);
}

// ---------------------------------------------------------------- Moods

type AccentRule = { l: [number, number]; c: [number, number]; hues?: Array<[number, number]> };

export type Mood = {
  id: string;
  name: string;
  nouns: string[];
  looks: string[];
  /** Chance the accent is the preset's own (or one of its palette) rather than generated. */
  ownAccent: number;
  accent: AccentRule;
  appearance: ReadonlyArray<readonly [Theme["appearance"], number]>;
  ground: ReadonlyArray<readonly [ThemeGround, number]>;
  backdrop: ReadonlyArray<readonly [ThemeBackdrop, number]>;
  heading: string[];
  body: string[];
  /** Chance the heading uses the body font. */
  sameFont: number;
  width: ReadonlyArray<readonly [ThemeWidth, number]>;
  tracking: ReadonlyArray<readonly [ThemeTracking, number]>;
  textSize: ReadonlyArray<readonly [ThemeTextSize, number]>;
  weight: ReadonlyArray<readonly [ThemeWeight, number]>;
  corners: ReadonlyArray<readonly [ThemeCorners, number]>;
  density: ReadonlyArray<readonly [ThemeDensity, number]>;
  cards: ReadonlyArray<readonly [ThemeCards, number]>;
  symbols: ReadonlyArray<readonly [ThemeSymbols, number]>;
  motion: ReadonlyArray<readonly [ThemeMotion, number]>;
};

const W = <T,>(...xs: Array<[T, number]>) => xs;

export const moods: Mood[] = [
  {
    id: "editorial", name: "Editorial", nouns: ["Edition", "Review", "Column", "Folio", "Gazette", "Quarterly"],
    looks: ["editorial", "press", "frost", "pieces"], ownAccent: 0.33, accent: { l: [0.35, 0.55], c: [0.04, 0.14] },
    appearance: W(["light", 3], ["dark", 1], ["system", 1]), ground: W(["look", 3], ["tinted", 1], ["plain", 1]), backdrop: W(["none", 3], ["paper", 2]),
    heading: ["didot", "bodoni", "baskerville", "serif", "charter", "iowan", "cochin", "palatino"], body: ["default", "charter", "georgia", "iowan", "helvetica", "avenir-next", "serif"], sameFont: 0.2,
    width: W(["standard", 5], ["condensed", 1]), tracking: W(["normal", 3], ["tight", 1]), textSize: W(["default", 3], ["large", 1]), weight: W(["regular", 3], ["medium", 1], ["light", 1]),
    corners: W(["square", 2], ["tight", 3], ["standard", 1]), density: W(["regular", 2], ["roomy", 2]), cards: W(["flat", 2], ["outlined", 3]), symbols: W(["outline", 1]), motion: W(["smooth", 1]),
  },
  {
    id: "playful", name: "Playful", nouns: ["Party", "Pop", "Candy", "Recess", "Confetti", "Parade"],
    looks: ["candy", "studio", "sol", "graphic"], ownAccent: 0.18, accent: { l: [0.62, 0.78], c: [0.16, 0.26] },
    appearance: W(["light", 3], ["dark", 1]), ground: W(["look", 2], ["tinted", 3]), backdrop: W(["none", 2], ["glow", 2], ["mesh", 2], ["grid", 1]),
    heading: ["rounded", "arial-rounded", "chalkboard", "marker-felt", "noteworthy", "futura"], body: ["rounded", "avenir-next", "arial-rounded", "chalkboard"], sameFont: 0.35,
    width: W(["standard", 4], ["expanded", 1]), tracking: W(["normal", 1]), textSize: W(["default", 2], ["large", 2]), weight: W(["medium", 2], ["bold", 2]),
    corners: W(["soft", 3], ["round", 3]), density: W(["regular", 2], ["roomy", 2]), cards: W(["raised", 3], ["flat", 1], ["bold", 2]), symbols: W(["fill", 3], ["hierarchical", 2]), motion: W(["bouncy", 4], ["snappy", 1]),
  },
  {
    id: "brutalist", name: "Brutalist", nouns: ["Block", "Concrete", "Poster", "Grid", "Signal", "Stencil"],
    looks: ["graphic", "press", "neon"], ownAccent: 0.21, accent: { l: [0.55, 0.72], c: [0.18, 0.3], hues: [[20, 35], [85, 110], [250, 270], [120, 140]] },
    appearance: W(["light", 3], ["dark", 2]), ground: W(["look", 3], ["plain", 2]), backdrop: W(["none", 3], ["grid", 2]),
    heading: ["din-condensed", "helvetica", "mono", "menlo", "futura", "american-typewriter", "courier"], body: ["default", "helvetica", "mono", "menlo", "din"], sameFont: 0.3,
    width: W(["condensed", 2], ["standard", 2], ["compressed", 1]), tracking: W(["tight", 2], ["normal", 2]), textSize: W(["default", 2], ["large", 1]), weight: W(["bold", 3], ["heavy", 2]),
    corners: W(["square", 4], ["tight", 2]), density: W(["compact", 2], ["regular", 2]), cards: W(["bold", 4], ["outlined", 2]), symbols: W(["outline", 1], ["fill", 1]), motion: W(["snappy", 3], ["smooth", 1]),
  },
  {
    id: "minimal", name: "Minimal", nouns: ["Air", "Studio", "Plain", "Field", "Line", "Room"],
    looks: ["frost", "studio", "pieces", "editorial"], ownAccent: 0.3, accent: { l: [0.45, 0.62], c: [0.02, 0.12], hues: [[200, 270], [0, 360]] },
    appearance: W(["light", 2], ["dark", 1], ["system", 2]), ground: W(["look", 2], ["plain", 3]), backdrop: W(["none", 1]),
    heading: ["default", "helvetica", "avenir-next", "gill-sans", "optima"], body: ["default", "helvetica", "avenir-next", "gill-sans"], sameFont: 0.6,
    width: W(["standard", 4], ["expanded", 1]), tracking: W(["normal", 2], ["wide", 1]), textSize: W(["default", 3], ["large", 1]), weight: W(["light", 2], ["regular", 3]),
    corners: W(["standard", 3], ["tight", 2]), density: W(["roomy", 3], ["airy", 2]), cards: W(["flat", 3], ["outlined", 2]), symbols: W(["outline", 1]), motion: W(["smooth", 1]),
  },
  {
    id: "luxe", name: "Luxe", nouns: ["Maison", "Salon", "Atelier", "Reserve", "Velour", "Gilt"],
    looks: ["velvet", "editorial", "ember"], ownAccent: 0.24, accent: { l: [0.62, 0.8], c: [0.06, 0.14], hues: [[60, 95], [330, 360], [150, 175]] },
    appearance: W(["dark", 4], ["light", 1]), ground: W(["look", 3], ["tinted", 2]), backdrop: W(["glow", 2], ["gradient", 2], ["mesh", 2], ["none", 1]),
    heading: ["didot", "bodoni", "copperplate", "cochin", "baskerville"], body: ["avenir-next", "optima", "gill-sans", "cochin", "default"], sameFont: 0.1,
    width: W(["standard", 3], ["expanded", 1]), tracking: W(["wide", 3], ["normal", 1]), textSize: W(["default", 3]), weight: W(["light", 2], ["regular", 2]),
    corners: W(["tight", 2], ["standard", 2], ["square", 1]), density: W(["roomy", 2], ["airy", 2]), cards: W(["glass", 3], ["outlined", 2], ["raised", 1]), symbols: W(["outline", 2], ["hierarchical", 1]), motion: W(["smooth", 1]),
  },
  {
    id: "tech", name: "Tech", nouns: ["Terminal", "Signal", "Kernel", "Circuit", "Pulse", "Vector"],
    looks: ["neon", "pieces", "frost"], ownAccent: 0.21, accent: { l: [0.7, 0.88], c: [0.16, 0.26], hues: [[125, 145], [185, 210], [280, 305], [340, 360]] },
    appearance: W(["dark", 5], ["system", 1]), ground: W(["look", 3], ["plain", 1], ["tinted", 1]), backdrop: W(["grid", 3], ["glow", 2], ["mesh", 1], ["none", 1]),
    heading: ["mono", "menlo", "din", "default", "din-condensed"], body: ["default", "din", "mono", "helvetica"], sameFont: 0.3,
    width: W(["standard", 3], ["expanded", 2], ["condensed", 1]), tracking: W(["normal", 2], ["wide", 1]), textSize: W(["default", 3]), weight: W(["regular", 2], ["medium", 2], ["bold", 1]),
    corners: W(["tight", 3], ["standard", 2]), density: W(["compact", 2], ["regular", 2]), cards: W(["glass", 2], ["outlined", 3], ["flat", 1]), symbols: W(["outline", 2], ["hierarchical", 1]), motion: W(["snappy", 4]),
  },
  {
    id: "warm", name: "Warm", nouns: ["Hearth", "Harvest", "Kiln", "Porch", "Orchard", "Sunday"],
    looks: ["sol", "ember", "candy", "studio"], ownAccent: 0.27, accent: { l: [0.5, 0.7], c: [0.1, 0.2], hues: [[20, 75]] },
    appearance: W(["light", 3], ["dark", 1], ["system", 1]), ground: W(["look", 2], ["tinted", 3]), backdrop: W(["paper", 2], ["gradient", 2], ["none", 2]),
    heading: ["serif", "rockwell", "georgia", "cochin", "superclarendon", "rounded", "palatino"], body: ["rounded", "avenir-next", "charter", "georgia", "default"], sameFont: 0.3,
    width: W(["standard", 1]), tracking: W(["normal", 1]), textSize: W(["default", 2], ["large", 1]), weight: W(["regular", 2], ["medium", 2]),
    corners: W(["soft", 3], ["standard", 2]), density: W(["regular", 2], ["roomy", 2]), cards: W(["raised", 3], ["flat", 2]), symbols: W(["fill", 1], ["outline", 1]), motion: W(["smooth", 2], ["bouncy", 1]),
  },
  {
    id: "retro", name: "Retro", nouns: ["Diner", "Jukebox", "Motel", "Drive-in", "Arcade", "Postcard"],
    looks: ["sol", "press", "graphic", "candy"], ownAccent: 0.18, accent: { l: [0.52, 0.72], c: [0.1, 0.18], hues: [[30, 90], [170, 200], [95, 125]] },
    appearance: W(["light", 4], ["dark", 1]), ground: W(["look", 2], ["tinted", 3]), backdrop: W(["paper", 3], ["grid", 1], ["none", 1]),
    heading: ["american-typewriter", "rockwell", "superclarendon", "futura", "copperplate", "marker-felt"], body: ["american-typewriter", "courier", "georgia", "futura", "trebuchet", "verdana"], sameFont: 0.25,
    width: W(["standard", 3], ["condensed", 1]), tracking: W(["normal", 2], ["wide", 1]), textSize: W(["default", 2], ["large", 1]), weight: W(["medium", 2], ["bold", 2]),
    corners: W(["standard", 2], ["tight", 1], ["round", 1]), density: W(["regular", 1]), cards: W(["bold", 3], ["outlined", 2], ["raised", 1]), symbols: W(["fill", 2], ["outline", 1]), motion: W(["bouncy", 2], ["smooth", 1]),
  },
  {
    id: "soft", name: "Soft", nouns: ["Cloud", "Petal", "Blush", "Pillow", "Mist", "Dawn"],
    looks: ["candy", "frost", "studio"], ownAccent: 0.18, accent: { l: [0.72, 0.86], c: [0.07, 0.14] },
    appearance: W(["light", 4], ["system", 1]), ground: W(["tinted", 3], ["look", 2]), backdrop: W(["glow", 3], ["mesh", 3], ["gradient", 2], ["none", 1]),
    heading: ["rounded", "avenir-next", "arial-rounded", "gill-sans", "optima"], body: ["rounded", "avenir-next", "arial-rounded", "gill-sans"], sameFont: 0.5,
    width: W(["standard", 3], ["expanded", 1]), tracking: W(["normal", 1]), textSize: W(["default", 2], ["large", 2]), weight: W(["regular", 3], ["medium", 1]),
    corners: W(["round", 3], ["soft", 3]), density: W(["roomy", 2], ["airy", 1], ["regular", 1]), cards: W(["raised", 3], ["glass", 2]), symbols: W(["hierarchical", 2], ["fill", 1]), motion: W(["bouncy", 2], ["smooth", 2]),
  },
];

/**
 * The later style choices, per mood: contrast, neutrals, the dark ground, numbers, hierarchy,
 * buttons, entrance and the mascot. Kept beside the moods so each mood still hangs together (Tech
 * leans to tabular figures and outline buttons, Playful to tinted pills that rise in).
 */
type Extra = {
  contrast: ReadonlyArray<readonly [ThemeContrast, number]>;
  neutrals: ReadonlyArray<readonly [ThemeNeutrals, number]>;
  darkGround: ReadonlyArray<readonly [ThemeDarkGround, number]>;
  numbers: ReadonlyArray<readonly [ThemeNumbers, number]>;
  hierarchy: ReadonlyArray<readonly [ThemeHierarchy, number]>;
  buttons: ReadonlyArray<readonly [ThemeButtons, number]>;
  entrance: ReadonlyArray<readonly [ThemeEntrance, number]>;
  mascot: ReadonlyArray<readonly [ThemeMascot, number]>;
  headers: ReadonlyArray<readonly [ThemeHeaders, number]>;
  buttonSize: ReadonlyArray<readonly [ThemeButtonSize, number]>;
  iconScale: ReadonlyArray<readonly [ThemeIconScale, number]>;
  /** "own" keeps the app's own tab bar. */
  tabStyle: ReadonlyArray<readonly [ThemeTabStyle | "own", number]>;
  /** "own" keeps each list as its remix was built. */
  lists: ReadonlyArray<readonly [ThemeLists | "own", number]>;
};
const EXTRA: Record<string, Extra> = {
  editorial: { contrast: W(["standard", 3], ["high", 2]), neutrals: W(["warm", 3], ["neutral", 2]), darkGround: W(["look", 2], ["black", 1]), numbers: W(["default", 3], ["tabular", 1]), hierarchy: W(["dramatic", 3], ["balanced", 2]), buttons: W(["outline", 3], ["solid", 2]), entrance: W(["fade", 3], ["none", 2]), mascot: W(["shown", 2], ["hidden", 1]), headers: W(["split", 3], ["centered", 1]), buttonSize: W(["regular", 3], ["compact", 1]), iconScale: W(["small", 2], ["medium", 2]), tabStyle: W(["own", 3], ["system", 2]), lists: W(["plain", 3], ["own", 2]) },
  playful: { contrast: W(["standard", 3], ["soft", 2]), neutrals: W(["warm", 2], ["neutral", 2]), darkGround: W(["graphite", 2], ["look", 2]), numbers: W(["default", 1]), hierarchy: W(["dramatic", 2], ["balanced", 2]), buttons: W(["solid", 3], ["tinted", 3]), entrance: W(["rise", 4], ["fade", 1]), mascot: W(["shown", 1]), headers: W(["split", 2], ["bold", 2], ["centered", 1]), buttonSize: W(["large", 3], ["regular", 2]), iconScale: W(["large", 3], ["medium", 1]), tabStyle: W(["own", 2], ["dock", 2]), lists: W(["cards", 3], ["own", 2]) },
  brutalist: { contrast: W(["high", 4], ["standard", 1]), neutrals: W(["neutral", 1]), darkGround: W(["black", 3], ["look", 1]), numbers: W(["tabular", 3], ["default", 1]), hierarchy: W(["dramatic", 3], ["balanced", 1]), buttons: W(["solid", 3], ["outline", 2]), entrance: W(["none", 3], ["rise", 1]), mascot: W(["shown", 2], ["hidden", 1]), headers: W(["bold", 4], ["split", 1]), buttonSize: W(["large", 2], ["regular", 2]), iconScale: W(["medium", 2], ["large", 1]), tabStyle: W(["own", 2], ["dock", 2], ["system", 1]), lists: W(["plain", 2], ["cards", 2]) },
  minimal: { contrast: W(["soft", 3], ["standard", 2]), neutrals: W(["neutral", 2], ["cool", 2]), darkGround: W(["graphite", 2], ["black", 1]), numbers: W(["default", 2], ["tabular", 1]), hierarchy: W(["flat", 3], ["balanced", 2]), buttons: W(["tinted", 3], ["outline", 2], ["solid", 1]), entrance: W(["fade", 3], ["none", 1]), mascot: W(["shown", 2], ["hidden", 1]), headers: W(["split", 2], ["centered", 2]), buttonSize: W(["compact", 3], ["regular", 2]), iconScale: W(["small", 3], ["medium", 1]), tabStyle: W(["own", 2], ["system", 2], ["glass", 1]), lists: W(["plain", 3], ["grouped", 2]) },
  luxe: { contrast: W(["standard", 2], ["soft", 2]), neutrals: W(["warm", 3], ["neutral", 1]), darkGround: W(["black", 2], ["look", 2]), numbers: W(["default", 2]), hierarchy: W(["dramatic", 2], ["balanced", 2]), buttons: W(["outline", 3], ["glass", 3]), entrance: W(["fade", 3], ["rise", 1]), mascot: W(["shown", 1], ["hidden", 1]), headers: W(["centered", 3], ["split", 2]), buttonSize: W(["regular", 2], ["compact", 2]), iconScale: W(["small", 3], ["medium", 1]), tabStyle: W(["glass", 3], ["own", 2]), lists: W(["grouped", 3], ["own", 2]) },
  tech: { contrast: W(["high", 3], ["standard", 2]), neutrals: W(["cool", 3], ["neutral", 1]), darkGround: W(["black", 3], ["graphite", 2]), numbers: W(["tabular", 4], ["default", 1]), hierarchy: W(["balanced", 2], ["flat", 1]), buttons: W(["outline", 3], ["glass", 2], ["solid", 1]), entrance: W(["rise", 2], ["none", 2]), mascot: W(["shown", 3], ["hidden", 1]), headers: W(["split", 2], ["bold", 2]), buttonSize: W(["compact", 3], ["regular", 2]), iconScale: W(["small", 2], ["medium", 2]), tabStyle: W(["glass", 2], ["own", 2], ["dock", 1]), lists: W(["grouped", 2], ["plain", 2], ["own", 1]) },
  warm: { contrast: W(["standard", 2], ["soft", 2]), neutrals: W(["warm", 4]), darkGround: W(["look", 2], ["graphite", 1]), numbers: W(["default", 2]), hierarchy: W(["balanced", 2], ["dramatic", 1]), buttons: W(["solid", 3], ["tinted", 2]), entrance: W(["rise", 2], ["fade", 2]), mascot: W(["shown", 1]), headers: W(["split", 3], ["centered", 1]), buttonSize: W(["regular", 2], ["large", 2]), iconScale: W(["medium", 2], ["large", 1]), tabStyle: W(["own", 3], ["dock", 1]), lists: W(["cards", 3], ["own", 2]) },
  retro: { contrast: W(["high", 2], ["standard", 2]), neutrals: W(["warm", 3], ["neutral", 1]), darkGround: W(["look", 2]), numbers: W(["tabular", 1], ["default", 2]), hierarchy: W(["dramatic", 3], ["balanced", 1]), buttons: W(["solid", 3], ["outline", 2]), entrance: W(["rise", 2], ["none", 1]), mascot: W(["shown", 3], ["hidden", 1]), headers: W(["bold", 3], ["centered", 2]), buttonSize: W(["large", 2], ["regular", 2]), iconScale: W(["large", 2], ["medium", 2]), tabStyle: W(["own", 2], ["dock", 2]), lists: W(["cards", 2], ["own", 2]) },
  soft: { contrast: W(["soft", 4], ["standard", 1]), neutrals: W(["warm", 2], ["cool", 2]), darkGround: W(["graphite", 2], ["look", 1]), numbers: W(["default", 1]), hierarchy: W(["balanced", 2], ["flat", 2]), buttons: W(["tinted", 3], ["glass", 2], ["solid", 1]), entrance: W(["fade", 3], ["rise", 2]), mascot: W(["shown", 3], ["hidden", 1]), headers: W(["centered", 2], ["split", 2]), buttonSize: W(["large", 2], ["regular", 2]), iconScale: W(["medium", 2], ["large", 1]), tabStyle: W(["glass", 2], ["own", 2]), lists: W(["grouped", 3], ["cards", 2]) },
};

// ---------------------------------------------------------------- Shuffle

/** Style sections a person can lock while the rest reshuffles. */
export type StyleSection = "colour" | "type" | "shape" | "feel";
export const STYLE_SECTIONS: Array<{ id: StyleSection; label: string; keys: Array<keyof Theme> }> = [
  { id: "colour", label: "Color", keys: ["look", "accent", "accentHex", "appearance", "ground", "backdrop", "contrast", "neutrals", "darkGround", "custom"] },
  { id: "type", label: "Type", keys: ["font", "headingFont", "width", "tracking", "textSize", "weight", "numbers", "hierarchy", "headers"] },
  { id: "shape", label: "Shape", keys: ["corners", "density", "cards", "buttons", "buttonSize", "lists"] },
  { id: "feel", label: "Feel", keys: ["symbols", "motion", "entrance", "mascot", "iconScale", "tabStyle"] },
];

export type ShuffleResult = { theme: Theme; mood: Mood; seed: number };

/**
 * A new style from `seed`. Locked sections keep `current`'s values; the rest follow one mood's
 * rules (or, now and then, a wildcard mood that mixes any of them). Always a valid theme.
 */
export function shuffleTheme(seed: number, current: Theme | undefined, locks: ReadonlySet<StyleSection> = new Set(), recent: readonly Theme[] = []): ShuffleResult {
  // Random, but never a rerun: of a dozen candidates, the first that differs enough from every
  // recent style (another preset than the last, another accent hue than the last two, most parts
  // changed against the last eight) wins; failing that, the one furthest from all of them.
  const seen = [...(current ? [current] : []), ...recent].slice(-8);
  if (!seen.length) return shuffleOnce(seed, current, locks);
  const r = rng(seed);
  let best: ShuffleResult | null = null;
  let bestScore = -1;
  for (let i = 0; i < 12; i++) {
    const c = shuffleOnce(i === 0 ? seed : Math.floor(r() * 0xffffffff) >>> 0, current, locks);
    const last = seen[seen.length - 1];
    const lastTwo = seen.slice(-2);
    const nearest = Math.min(...seen.map((t) => styleDistance(c.theme, t, locks)));
    const fresh = (locks.has("colour") || (c.theme.look !== last.look && lastTwo.every((t) => hueBucket(t) !== hueBucket(c.theme)))) && nearest >= freshEnough(locks);
    if (fresh) return c;
    // Failing every check, still never the same preset twice in a row (unless Color is kept).
    const score = nearest + (locks.has("colour") || c.theme.look !== last.look ? 1000 : 0);
    if (score > bestScore) (best = c), (bestScore = score);
  }
  return best!;
}

/** The parts a style is compared on, with the section each belongs to. */
const COMPARE: Array<[keyof Theme, StyleSection]> = [
  ["look", "colour"], ["appearance", "colour"], ["ground", "colour"], ["backdrop", "colour"], ["contrast", "colour"], ["neutrals", "colour"],
  ["font", "type"], ["headingFont", "type"], ["weight", "type"], ["hierarchy", "type"], ["headers", "type"],
  ["corners", "shape"], ["density", "shape"], ["cards", "shape"], ["buttons", "shape"], ["lists", "shape"],
  ["symbols", "feel"], ["motion", "feel"], ["entrance", "feel"], ["tabStyle", "feel"],
];

/** The accent's hue, in twelve 30° buckets (greys as their own). */
function hueBucket(t: Theme): string {
  const look = lookById(t.look);
  const hex = t.accentHex ?? (t.accent >= 0 ? look.light.tiles[t.accent] : look[t.appearance === "dark" ? "dark" : "light"].accent);
  const h = hueOf(hex ?? "#808080");
  return h < 0 ? "grey" : String(Math.floor(h / 30));
}

/** How many parts differ between two styles (the accent hue counting as one), ignoring locked sections. */
export function styleDistance(a: Theme, b: Theme, locks: ReadonlySet<StyleSection> = new Set()): number {
  const parts = COMPARE.filter(([, sec]) => !locks.has(sec)).filter(([k]) => (a[k] ?? "") !== (b[k] ?? "")).length;
  return parts + (!locks.has("colour") && hueBucket(a) !== hueBucket(b) ? 1 : 0);
}

/** Enough change to feel new: over half of what's free to change. */
function freshEnough(locks: ReadonlySet<StyleSection>): number {
  const free = COMPARE.filter(([, sec]) => !locks.has(sec)).length + (locks.has("colour") ? 0 : 1);
  return Math.ceil(free * 0.55);
}

/** One draw from `seed`, before the check against recent styles. */
function shuffleOnce(seed: number, current: Theme | undefined, locks: ReadonlySet<StyleSection>): ShuffleResult {
  const r = rng(seed);
  const mood = pick(r, moods);
  // One in four pulls single parts from other moods too, for the surprising ones.
  const wild = r() < 1 / 4;
  const from = <K extends keyof Mood>(k: K): Mood[K] => (wild && r() < 0.35 ? pick(r, moods)[k] : mood[k]);
  const extra = <K extends keyof Extra>(k: K): Extra[K] => (wild && r() < 0.35 ? EXTRA[pick(r, moods).id][k] : EXTRA[mood.id][k]);

  const lookId = pick(r, from("looks"));
  const look = lookById(lookId);
  const appearance = weighted(r, from("appearance"));
  // The accent: the preset's own or one of its palette, or generated for this mood.
  let accent = -1;
  let accentHex: string | undefined;
  if (r() < mood.ownAccent) {
    accent = r() < 0.5 ? -1 : Math.floor(r() * look.light.tiles.length);
  } else {
    const rule = from("accent");
    const range = rule.hues ? pick(r, rule.hues) : ([0, 360] as [number, number]);
    const hue = between(r, range[0], range[1]) % 360;
    accentHex = oklchHex(between(r, rule.l[0], rule.l[1]), between(r, rule.c[0], rule.c[1]), hue);
  }
  const body = pick(r, from("body"));
  const headingCandidates = from("heading");
  const heading = r() < mood.sameFont ? body : pick(r, headingCandidates);

  const next: Theme = {
    look: look.id,
    accent,
    ...(accentHex ? { accentHex } : {}),
    appearance,
    ...optional("ground", weighted(r, from("ground")), "look"),
    ...optional("backdrop", weighted(r, from("backdrop")), "none"),
    font: isFontId(body) ? body : "default",
    ...(heading !== body && isFontId(heading) ? { headingFont: heading } : {}),
    // Width only changes the system fonts; keep it standard when both fonts are families.
    ...optional("width", fontById(body).category === "system" || fontById(heading).category === "system" ? weighted(r, from("width")) : "standard", "standard"),
    ...optional("tracking", weighted(r, from("tracking")), "normal"),
    textSize: weighted(r, from("textSize")),
    weight: weighted(r, from("weight")),
    corners: weighted(r, from("corners")),
    density: weighted(r, from("density")),
    ...optional("cards", weighted(r, from("cards")), "flat"),
    ...optional("symbols", weighted(r, from("symbols")), "outline"),
    ...optional("motion", weighted(r, from("motion")), "smooth"),
    ...optional("contrast", weighted(r, extra("contrast")), "standard"),
    ...optional("neutrals", weighted(r, extra("neutrals")), "neutral"),
    ...optional("darkGround", weighted(r, extra("darkGround")), "look"),
    ...optional("numbers", weighted(r, extra("numbers")), "default"),
    ...optional("hierarchy", weighted(r, extra("hierarchy")), "balanced"),
    ...optional("buttons", weighted(r, extra("buttons")), "solid"),
    ...optional("entrance", weighted(r, extra("entrance")), "none"),
    ...optional("mascot", weighted(r, extra("mascot")), "shown"),
    ...optional("headers", weighted(r, extra("headers")), "split"),
    ...optional("buttonSize", weighted(r, extra("buttonSize")), "regular"),
    ...optional("iconScale", weighted(r, extra("iconScale")), "medium"),
  };
  const tabStyle = weighted(r, extra("tabStyle"));
  if (tabStyle !== "own") next.tabStyle = tabStyle;
  const lists = weighted(r, extra("lists"));
  if (lists !== "own") next.lists = lists;
  // Locked sections keep what they had.
  if (current) {
    for (const section of STYLE_SECTIONS) {
      if (!locks.has(section.id)) continue;
      for (const k of section.keys) {
        delete (next as Record<string, unknown>)[k];
        if (current[k] !== undefined) (next as Record<string, unknown>)[k] = current[k];
      }
    }
    // A kept accent from a preset palette needs that preset; a new preset drops it.
    if (!locks.has("colour") && next.accent >= 0 && next.accent >= lookById(next.look).light.tiles.length) next.accent = -1;
  }
  next.name = styleName(next, mood, r);
  return { theme: next, mood, seed };
}

function optional<K extends keyof Theme>(key: K, value: Theme[K], absent: Theme[K]): Partial<Theme> {
  return value === absent ? {} : ({ [key]: value } as Partial<Theme>);
}

/** A name for a style: its colour and its mood, e.g. "Cobalt Terminal" or "Quiet Marigold". */
export function styleName(theme: Theme, mood: Mood, r: R = rng(0)): string {
  const look = lookById(theme.look);
  const hex = theme.accentHex ?? (theme.accent >= 0 ? look.light.tiles[theme.accent] : look[theme.appearance === "dark" ? "dark" : "light"].accent);
  const colour = colourWord(hex ?? "#808080", r);
  return r() < 0.5 ? `${colour} ${pick(r, mood.nouns)}` : `${pick(r, mood.nouns)} ${colour}`;
}

/** How many distinct styles Shuffle can make (for the "endless" count on screen). */
export function styleSpace(): number {
  // Generated accents are continuous; count a practical 360 hues × 8 lightness steps.
  const colour = looks.length * (360 * 8 + 8) * 3 * 3 * 5;
  const type = fonts.length * fonts.length * 4 * 3 * 4 * 5;
  const shape = 5 * 4 * 5 * 4 * 3 * 4;
  const feel = 3 * 3 * 3 * 2 * 3 * 4;
  // Contrast, neutrals and the dark ground (colour); numbers and hierarchy (type).
  return colour * 3 * 3 * 3 * type * 2 * 3 * 3 * shape * feel;
}

// ---------------------------------------------------------------- Style codes

const LISTS = {
  appearance: ["system", "light", "dark"],
  ground: ["look", "tinted", "plain"],
  backdrop: ["none", "glow", "gradient", "grid", "paper", "mesh"],
  width: ["standard", "compressed", "condensed", "expanded"],
  tracking: ["normal", "tight", "wide"],
  textSize: ["default", "large", "xlarge", "xxlarge"],
  weight: ["regular", "light", "medium", "bold", "heavy"],
  corners: ["standard", "square", "tight", "soft", "round"],
  density: ["regular", "compact", "roomy", "airy"],
  cards: ["flat", "raised", "outlined", "glass", "bold"],
  symbols: ["outline", "fill", "hierarchical"],
  motion: ["smooth", "snappy", "bouncy"],
  // SP2 adds these (older SP1 codes stop at motion and still paste).
  contrast: ["standard", "soft", "high"],
  neutrals: ["neutral", "warm", "cool"],
  darkGround: ["look", "black", "graphite"],
  numbers: ["default", "tabular"],
  hierarchy: ["balanced", "flat", "dramatic"],
  buttons: ["solid", "tinted", "outline", "glass"],
  entrance: ["none", "fade", "rise"],
  mascot: ["shown", "hidden"],
  // Added after the first SP2 codes (those stop at mascot and still paste).
  headers: ["split", "bold", "centered"],
  buttonSize: ["regular", "compact", "large"],
  iconScale: ["medium", "small", "large"],
  tabStyle: ["own", "dock", "glass", "system"],
  lists: ["own", "cards", "grouped", "plain"],
} as const;
const ORDER = Object.keys(LISTS) as Array<keyof typeof LISTS>;
/** SP1 codes carried the first twelve choices; the first SP2 codes twenty. */
const V1_CHOICES = 12;
const V2_FIRST = 20;

/**
 * A short code for a style ("SP1-…"), made of the preset, accent, fonts and every choice as small
 * numbers. It recreates the style exactly (decodeStyle), so it can be shared or pasted back.
 */
export function encodeStyle(t: Theme): string {
  const lookIdx = Math.max(0, looks.findIndex((l) => l.id === t.look));
  const fontIdx = (id: string | undefined) => Math.max(0, fonts.findIndex((f) => f.id === (id ?? "")));
  const nums = [
    lookIdx,
    t.accentHex ? 0 : t.accent + 2, // 0: custom hex follows, 1: own accent, 2+: palette index
    fontIdx(t.font),
    t.headingFont ? fontIdx(t.headingFont) + 1 : 0,
    ...ORDER.map((k) => Math.max(0, (LISTS[k] as readonly string[]).indexOf(String((t as Record<string, unknown>)[k] ?? LISTS[k][0])))),
  ];
  // Preset, accent and font indices can pass 35: two base-36 digits each; every choice is one digit.
  const wide = nums.slice(0, 4).map((n) => n.toString(36).padStart(2, "0")).join("") + nums.slice(4).map((n) => n.toString(36)).join("");
  return `SP2-${wide}${t.accentHex ? t.accentHex.slice(1).toLowerCase() : ""}`.toUpperCase();
}

/**
 * An SP2 code's parts: the head (preset, accent, fonts), the choices, and the custom accent. The
 * choice count grew as Style did, so it's read from the code: a custom accent (accent digits "00")
 * is the last six characters, and the choices are whatever sits between.
 */
function splitV2(code: string): [string, string, string, string | undefined] | null {
  const body = /^SP2-([0-9A-Z]+)$/i.exec(code)?.[1];
  if (!body || body.length < 8) return null;
  const head = body.slice(0, 8);
  const custom = parseInt(head.slice(2, 4), 36) === 0;
  const rest = body.slice(8);
  const choices = custom ? rest.slice(0, -6) : rest;
  const hex = custom ? rest.slice(-6) : undefined;
  // Codes made before a choice was added stop short of it (and still paste).
  if (choices.length < V2_FIRST || choices.length > ORDER.length) return null;
  if (hex !== undefined && !/^[0-9A-F]{6}$/i.test(hex)) return null;
  return [code, head, choices, hex];
}

/** The style a code describes, or null when it isn't one. */
export function decodeStyle(code: string): Theme | null {
  const clean = code.trim().replace(/\s+/g, "");
  // SP1 codes have twelve choices; SP2 codes have them all.
  const m = /^SP1-/i.test(clean)
    ? new RegExp(`^SP1-([0-9A-Z]{8})([0-9A-Z]{${V1_CHOICES}})([0-9A-F]{6})?$`, "i").exec(clean)
    : splitV2(clean);
  if (!m) return null;
  const head = m[1].match(/../g)!.map((x) => parseInt(x, 36));
  const rest = m[2].split("").map((x) => parseInt(x, 36));
  const [lookIdx, accentCode, fontIdx, headingIdx] = head;
  const look = looks[lookIdx];
  const body = fonts[fontIdx];
  if (!look || !body || (headingIdx && !fonts[headingIdx - 1])) return null;
  if (accentCode === 0 && !m[3]) return null;
  const t: Theme = {
    look: look.id,
    accent: accentCode === 0 ? -1 : accentCode - 2,
    appearance: "system",
    font: body.id,
    corners: "standard",
    textSize: "default",
    weight: "regular",
    density: "regular",
  };
  if (accentCode === 0) t.accentHex = `#${m[3]!.toUpperCase()}`;
  if (headingIdx) t.headingFont = fonts[headingIdx - 1].id;
  ORDER.forEach((k, i) => {
    const v = LISTS[k][rest[i]];
    if (v === undefined || v === "own") return;
    if (v !== LISTS[k][0] || ["appearance", "textSize", "weight", "corners", "density"].includes(k)) (t as Record<string, unknown>)[k] = v;
  });
  if (t.accent >= look.light.tiles.length) t.accent = -1;
  return t;
}
