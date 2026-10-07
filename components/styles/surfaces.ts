// The studio canvas's surfaces, quiet like a design tool's, so the style's colour shows where the
// style puts it: in its components, and in two feature tiles that take a pastel of its palette.
// Everything else is the style's own white and black (warm or cool with Greys, deeper with Dark
// mode and Contrast), never its accent or its tinted ground. Per light or dark:
//
//   tray     the frame behind the tiles: white in light, black in dark
//   tile     every tile: a whisper of grey off the tray
//   card     the cards inside a tile: the tray's white (or black) again
//   feature  the two feature tiles: a pastel of one of the look's own colours
//   ramp     the style's greys, white to black, for the palette tile
import { mixHex, resolveTheme, type Theme } from "@swiftpieces/builder";

export type Scheme = "light" | "dark";

export type Surfaces = {
  scheme: Scheme;
  tray: string;
  tile: string;
  card: string;
  feature: string;
  ramp: string[];
  /** A hairline that reads on the tray: the frame's edge. */
  edge: string;
};

/** How far a tile sits from the tray toward the other end, and how much of the feature colour is paper. */
const STEP: Record<Scheme, { tile: number; feature: number }> = {
  light: { tile: 0.045, feature: 0.62 },
  dark: { tile: 0.1, feature: 0.84 },
};

/** A colour's hue in degrees and its saturation (0 to 1). */
function hueOf(hex: string): { hue: number; sat: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return { hue: 0, sat };
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, sat };
}

/**
 * The look colour the feature tiles take a pastel of: the first of its palette whose hue stands
 * apart from the accent (so accent text and fills still read on the tile), else the furthest one.
 */
function featureColor(theme: Theme, scheme: Scheme): string {
  const r = resolveTheme(theme);
  const accent = hueOf(r.accent[scheme]);
  const tiles = r.look[scheme].tiles.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  if (!tiles.length) return r.accent[scheme];
  const apart = (c: string) => {
    const t = hueOf(c);
    // A grey (or a grey accent) is apart from any colour.
    if (t.sat < 0.15 || accent.sat < 0.15) return 180;
    const d = Math.abs(t.hue - accent.hue);
    return Math.min(d, 360 - d);
  };
  return tiles.find((c) => apart(c) >= 45) ?? tiles.reduce((a, c) => (apart(c) > apart(a) ? c : a));
}

/** The canvas's surfaces for a style shown in `scheme`. */
export function canvasSurfaces(theme: Theme, scheme: Scheme): Surfaces {
  // The style's own white and black: its plain ground, shaded by Greys, Dark mode and Contrast.
  const plain = resolveTheme({ ...theme, ground: "plain", custom: undefined }).background;
  const paper = plain[scheme];
  const ink = scheme === "light" ? plain.dark : plain.light;
  const s = STEP[scheme];
  const white = plain.light;
  const black = plain.dark;
  return {
    scheme,
    tray: paper,
    tile: mixHex(paper, ink, s.tile),
    card: paper,
    feature: mixHex(featureColor(theme, scheme), paper, s.feature),
    ramp: [0, 0.04, 0.12, 0.28, 0.45, 0.62, 0.8, 1].map((t) => mixHex(white, black, t)),
    edge: scheme === "light" ? "rgb(0 0 0 / .07)" : "rgb(255 255 255 / .08)",
  };
}

/**
 * The style as a tile draws it: its ground made the tile's colour and its cards the canvas's card
 * colour, in the mode it's shown in (cards then fill solid, so even flat ones are white, or black).
 * Everything else (accent, type, shape, motion) is the style's.
 */
export function onTile(theme: Theme, surfaces: Surfaces, ground: string): Theme {
  return { ...theme, custom: { mode: surfaces.scheme, ground, surface: surfaces.card } };
}
