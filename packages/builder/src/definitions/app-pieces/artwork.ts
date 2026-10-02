// Artwork: flat vector drawings (house plants, a window, cuttings in a jar, leaves showing a
// problem, and the four feeling marks) that stand in for photos and badges in the app pieces. Each
// one is a list of filled paths in its own box, drawn the same by the preview (an SVG) and by the
// Swift (one `Artwork` view that reads the same path data). The shapes are built here from a few
// parametric parts (leaves, stems, pots), so a plant is a dozen lines, not a hand-traced outline.
import { INDENT, num } from "../../core/swift.js";
import { own } from "../../core/own.js";
import { swiftHex } from "./data-kit.js";

export type ArtLayer = { d: string; fill: string; opacity?: number; evenOdd?: boolean };
export type ArtDef = {
  label: string;
  /** The drawing's box, in points. */
  w: number;
  h: number;
  /** contain: the whole drawing shows; cover: it fills the frame and the overflow is cropped. */
  fit: "contain" | "cover";
  /** Where a contained drawing sits: on the frame's bottom edge (a plant in its pot) or centred. */
  anchor: "bottom" | "center";
  /** The house pastel it sits on when it fills a photo spot (a scene paints its own). */
  ground?: string;
  layers: ArtLayer[];
};

// ---------------------------------------------------------------- Colours

/** The drawings' own colours: botanical greens and pots that sit on the house pastels. */
const C = {
  leafDeep: "#1C5640",
  leaf: "#2A7553",
  leafMid: "#3C9166",
  leafLight: "#69B886",
  leafPale: "#B9DFC3",
  vein: "#123F2F",
  variegate: "#C9E39B",
  rubber: "#1A3F33",
  rubberSheen: "#2F5E4C",
  sheath: "#C2564F",
  snakeEdge: "#D9C661",
  snakeBand: "#3F8A63",
  terracotta: "#D9774A",
  terracottaRim: "#C4653C",
  cream: "#F5EFE4",
  creamRim: "#E4D9C6",
  inkPot: "#2B2B30",
  inkRim: "#3B3B42",
  soil: "#4A3427",
  trunk: "#7A5638",
  wood: "#C99A6B",
  woodDark: "#A87C52",
  shadow: "#000000",
  white: "#FFFFFF",
  sky: "#BBD6FF",
  skyDeep: "#8FB6F5",
  tree: "#5FA67B",
  treeDeep: "#3E8460",
  wallWarm: "#E8D7BB",
  wallWarmDeep: "#D9C4A2",
  frame: "#F7F3EA",
  water: "#9CC2FF",
  glass: "#FFFFFF",
  root: "#E9D9B8",
  yellowLeaf: "#E8C35A",
  yellowDeep: "#C9A240",
  crisp: "#A2643A",
  crispDeep: "#7E4A28",
  paleLeaf: "#D3E8B9",
  paleVein: "#A9C98C",
  blossom: "#FF8FB8",
  blossomDeep: "#F26D9E",
  red: "#FF0000",
};

// ---------------------------------------------------------------- Path building

const f = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};

type Pt = [number, number];

/** A transform: rotate (degrees, 0 points right, -90 points up), scale, then move to (x, y). */
type Xf = { x: number; y: number; angle?: number; scale?: number; flip?: boolean };

const apply = (t: Xf, [px, py]: Pt): Pt => {
  const k = t.scale ?? 1;
  const a = ((t.angle ?? 0) * Math.PI) / 180;
  const qx = px * k;
  const qy = (t.flip ? -py : py) * k;
  return [t.x + qx * Math.cos(a) - qy * Math.sin(a), t.y + qx * Math.sin(a) + qy * Math.cos(a)];
};

/** Absolute path data in a transformed frame: M, L, C, Q and Z, every number to one decimal. */
class P {
  parts: string[] = [];
  constructor(private t: Xf = { x: 0, y: 0 }) {}
  private pt(p: Pt) {
    const [x, y] = apply(this.t, p);
    return `${f(x)} ${f(y)}`;
  }
  m(x: number, y: number) {
    this.parts.push(`M ${this.pt([x, y])}`);
    return this;
  }
  l(x: number, y: number) {
    this.parts.push(`L ${this.pt([x, y])}`);
    return this;
  }
  c(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.parts.push(`C ${this.pt([x1, y1])} ${this.pt([x2, y2])} ${this.pt([x, y])}`);
    return this;
  }
  q(x1: number, y1: number, x: number, y: number) {
    this.parts.push(`Q ${this.pt([x1, y1])} ${this.pt([x, y])}`);
    return this;
  }
  z() {
    this.parts.push("Z");
    return this;
  }
  toString() {
    return this.parts.join(" ");
  }
}

const K = 0.5523;

/** An ellipse as four cubics. */
function ellipse(cx: number, cy: number, rx: number, ry = rx, t: Xf = { x: 0, y: 0 }): string {
  return new P(t)
    .m(cx + rx, cy)
    .c(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry)
    .c(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy)
    .c(cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry)
    .c(cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy)
    .z()
    .toString();
}

/** A rounded rectangle. */
function rect(x: number, y: number, w: number, h: number, r = 0): string {
  const p = new P();
  if (r <= 0) return p.m(x, y).l(x + w, y).l(x + w, y + h).l(x, y + h).z().toString();
  const k = r * (1 - K);
  return p
    .m(x + r, y)
    .l(x + w - r, y)
    .c(x + w - k, y, x + w, y + k, x + w, y + r)
    .l(x + w, y + h - r)
    .c(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h)
    .l(x + r, y + h)
    .c(x + k, y + h, x, y + h - k, x, y + h - r)
    .l(x, y + r)
    .c(x, y + k, x + k, y, x + r, y)
    .z()
    .toString();
}

function poly(points: Pt[]): string {
  const p = new P();
  points.forEach(([x, y], i) => (i ? p.l(x, y) : p.m(x, y)));
  return p.z().toString();
}

/**
 * A pointed leaf from its base along +x: `len` long, `w` at its widest, its midrib bent by `bend`
 * (positive bends toward +y), its widest point `at` along it.
 */
function leaf(t: Xf, len: number, w: number, bend = 0, at = 0.42): string {
  const b = bend * len;
  return new P(t)
    .m(0, 0)
    .c(len * at * 0.5, -w * 0.7 + b * 0.3, len * at, -w + b * 0.6, len * 0.62, -w * 0.82 + b * 0.8)
    .c(len * 0.82, -w * 0.62 + b * 0.95, len * 0.94, -w * 0.25 + b, len, b)
    .c(len * 0.94, w * 0.25 + b, len * 0.82, w * 0.62 + b * 0.95, len * 0.62, w * 0.82 + b * 0.8)
    .c(len * at, w + b * 0.6, len * at * 0.5, w * 0.7 + b * 0.3, 0, 0)
    .z()
    .toString();
}

/** A leaf's midrib: a thin sliver along its centre line. */
function midrib(t: Xf, len: number, w: number, bend = 0): string {
  const b = bend * len;
  return new P(t)
    .m(len * 0.04, 0)
    .q(len * 0.5, b * 0.75 - w, len * 0.9, b * 0.98)
    .q(len * 0.5, b * 0.75 + w, len * 0.04, 0)
    .z()
    .toString();
}

/** A heart leaf hanging from its stem tip along +y: `size` from the notch to the point. */
function heart(t: Xf, size: number, round = 1): string {
  const s = size;
  const r = round;
  return new P(t)
    .m(0, s * 0.1)
    .c(-s * 0.18 * r, -s * 0.12, -s * 0.6 * r, -s * 0.02, -s * 0.56 * r, s * 0.38)
    .c(-s * 0.52 * r, s * 0.7, -s * 0.18, s * 0.9, 0, s)
    .c(s * 0.18, s * 0.9, s * 0.52 * r, s * 0.7, s * 0.56 * r, s * 0.38)
    .c(s * 0.6 * r, -s * 0.02, s * 0.18 * r, -s * 0.12, 0, s * 0.1)
    .z()
    .toString();
}

/** A stem as a tapering ribbon along a quadratic curve from `a` through control `c` to `b`. */
function stem(a: Pt, c: Pt, b: Pt, w0: number, w1 = w0 * 0.6, steps = 10): string {
  const at = (u: number): Pt => [
    (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0],
    (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1],
  ];
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = at(u);
    const q = at(Math.min(1, u + 0.01));
    const r = at(Math.max(0, u - 0.01));
    const dx = q[0] - r[0];
    const dy = q[1] - r[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * u) / 2;
    left.push([p[0] - (dy / len) * w, p[1] + (dx / len) * w]);
    right.push([p[0] + (dy / len) * w, p[1] - (dx / len) * w]);
  }
  return poly([...left, ...right.reverse()]);
}

type PotStyle = "terracotta" | "cream" | "ink";
const POTS: Record<PotStyle, [string, string]> = { terracotta: [C.terracotta, C.terracottaRim], cream: [C.cream, C.creamRim], ink: [C.inkPot, C.inkRim] };

/** A pot standing on `bottom`, centred on `cx`: a tapered body under a rim, soil showing at the top. */
function pot(cx: number, bottom: number, topW: number, h: number, style: PotStyle, rimH = h * 0.22, taper = 0.8): ArtLayer[] {
  const [body, rim] = POTS[style];
  const bw = topW * taper;
  const top = bottom - h;
  return [
    { d: ellipse(cx, bottom, topW * 0.62, 2.4), fill: C.shadow, opacity: 0.12 },
    { d: new P().m(cx - topW / 2 + 1.5, top + rimH).l(cx + topW / 2 - 1.5, top + rimH).l(cx + bw / 2, bottom - 2).q(cx + bw / 2, bottom, cx + bw / 2 - 2, bottom).l(cx - bw / 2 + 2, bottom).q(cx - bw / 2, bottom, cx - bw / 2, bottom - 2).z().toString(), fill: body },
    { d: rect(cx - topW / 2, top, topW, rimH, 1.6), fill: rim },
    { d: ellipse(cx, top + 0.6, topW / 2 - 2, 1.6), fill: C.soil },
  ];
}

// ---------------------------------------------------------------- Plants

/** Monstera: big split hearts on long stems, fanned out of a terracotta pot. */
function monstera(cx = 50, bottom = 98, k = 1, potStyle: PotStyle = "terracotta"): ArtLayer[] {
  const out: ArtLayer[] = [];
  const base: Pt = [cx, bottom - 25 * k];
  const leaves: Array<{ to: Pt; c: Pt; a: number; s: number; tone: string }> = [
    { to: [cx - 26 * k, bottom - 58 * k], c: [cx - 18 * k, bottom - 38 * k], a: 50, s: 27, tone: C.leaf },
    { to: [cx + 27 * k, bottom - 56 * k], c: [cx + 20 * k, bottom - 38 * k], a: -54, s: 27, tone: C.leaf },
    { to: [cx - 7 * k, bottom - 70 * k], c: [cx - 7 * k, bottom - 46 * k], a: 14, s: 27, tone: C.leafMid },
    { to: [cx + 12 * k, bottom - 68 * k], c: [cx + 7 * k, bottom - 46 * k], a: -20, s: 25, tone: C.leafDeep },
    { to: [cx - 33 * k, bottom - 36 * k], c: [cx - 18 * k, bottom - 28 * k], a: 80, s: 22, tone: C.leafDeep },
    { to: [cx + 34 * k, bottom - 37 * k], c: [cx + 18 * k, bottom - 28 * k], a: -82, s: 22, tone: C.leafMid },
  ];
  for (const l of leaves) out.push({ d: stem(base, l.c, l.to, 2.2 * k, 1.4 * k), fill: C.leafDeep });
  for (const l of leaves) {
    const t: Xf = { x: l.to[0], y: l.to[1], angle: l.a + 180, scale: k };
    // The leaf hangs from the stem tip, pointing away from the pot; the holes are cut with even-odd.
    const holes = [0.34, 0.52, 0.7].flatMap((y, i) => [
      ellipse(-l.s * (0.27 - i * 0.02), l.s * y, l.s * 0.08, l.s * 0.035, { ...t }),
      ellipse(l.s * (0.27 - i * 0.02), l.s * y, l.s * 0.08, l.s * 0.035, { ...t }),
    ]);
    out.push({ d: [heart(t, l.s, 1.08), ...holes].join(" "), fill: l.tone, evenOdd: true });
    out.push({ d: midrib({ ...t, angle: (t.angle ?? 0) + 90 }, l.s * 0.95, l.s * 0.022), fill: C.vein, opacity: 0.55 });
  }
  out.push(...pot(cx, bottom, 40 * k, 27 * k, potStyle));
  return out;
}

/** Snake plant: tall sword leaves with gold edges, straight up out of a cylinder. */
function snake(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const blades: Array<{ x: number; len: number; a: number; w: number; bend: number }> = [
    { x: -9, len: 62, a: -100, w: 6.4, bend: -0.04 },
    { x: 8, len: 66, a: -80, w: 6.8, bend: 0.05 },
    { x: -1, len: 76, a: -92, w: 7, bend: 0.02 },
    { x: -15, len: 48, a: -114, w: 5.6, bend: -0.06 },
    { x: 15, len: 52, a: -66, w: 5.8, bend: 0.07 },
  ];
  for (const b of blades) {
    const t: Xf = { x: cx + b.x * k, y: bottom - 24 * k, angle: b.a, scale: k };
    out.push({ d: leaf(t, b.len, b.w, b.bend, 0.35), fill: C.snakeEdge });
    out.push({ d: leaf(t, b.len * 0.97, b.w * 0.74, b.bend, 0.35), fill: C.leafDeep });
    out.push({ d: midrib(t, b.len * 0.9, b.w * 0.22, b.bend), fill: C.snakeBand, opacity: 0.9 });
  }
  out.push(...pot(cx, bottom, 36 * k, 26 * k, "ink", 26 * k * 0.18, 0.92));
  return out;
}

/** Rubber plant: one upright stem with big glossy ovals and a red sheath at the top. */
function rubber(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const top = bottom - 88 * k;
  out.push({ d: stem([cx, bottom - 24 * k], [cx + 2 * k, bottom - 56 * k], [cx - 1 * k, top + 6 * k], 3 * k, 2 * k), fill: C.trunk });
  const ovals: Array<{ y: number; side: number; len: number; a: number }> = [
    { y: 30, side: -1, len: 30, a: 200 },
    { y: 34, side: 1, len: 31, a: -22 },
    { y: 46, side: -1, len: 29, a: 212 },
    { y: 50, side: 1, len: 28, a: -32 },
    { y: 62, side: -1, len: 25, a: 226 },
    { y: 66, side: 1, len: 24, a: -46 },
    { y: 76, side: -1, len: 19, a: 240 },
    { y: 79, side: 1, len: 18, a: -60 },
  ];
  for (const o of ovals) {
    const t: Xf = { x: cx + o.side * 1.5 * k, y: bottom - o.y * k, angle: o.a, scale: k };
    out.push({ d: leaf(t, o.len, o.len * 0.3, 0.03 * o.side, 0.5), fill: C.rubber });
    out.push({ d: leaf({ ...t, x: t.x + o.side * 0.6 * k, y: t.y - 0.8 * k }, o.len * 0.8, o.len * 0.12, 0.03 * o.side, 0.5), fill: C.rubberSheen, opacity: 0.8 });
    out.push({ d: midrib(t, o.len * 0.92, o.len * 0.012, 0.03 * o.side), fill: C.sheath, opacity: 0.45 });
  }
  out.push({ d: leaf({ x: cx - 1 * k, y: top + 8 * k, angle: -96, scale: k }, 11, 2.4, 0, 0.4), fill: C.sheath });
  out.push(...pot(cx, bottom, 34 * k, 25 * k, "ink"));
  return out;
}

/** Fiddle-leaf fig: a bare trunk with wavy, wide leaves clustered at the top. */
function fiddle(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const crown: Pt = [cx, bottom - 58 * k];
  out.push({ d: stem([cx, bottom - 24 * k], [cx - 3 * k, bottom - 44 * k], crown, 3.4 * k, 2.4 * k), fill: C.trunk });
  const fan: Array<{ a: number; len: number; tone: string; dx: number; dy: number }> = [
    { a: 196, len: 30, tone: C.leafDeep, dx: -2, dy: 8 },
    { a: -16, len: 30, tone: C.leafDeep, dx: 2, dy: 8 },
    { a: 224, len: 32, tone: C.leaf, dx: -1, dy: 0 },
    { a: -46, len: 32, tone: C.leaf, dx: 1, dy: 0 },
    { a: 250, len: 30, tone: C.leafMid, dx: -1, dy: -6 },
    { a: -72, len: 30, tone: C.leafMid, dx: 1, dy: -6 },
    { a: -92, len: 27, tone: C.leaf, dx: 0, dy: -10 },
    { a: 172, len: 24, tone: C.leafMid, dx: -3, dy: 18 },
    { a: 8, len: 24, tone: C.leafMid, dx: 3, dy: 18 },
  ];
  for (const l of fan) {
    const t: Xf = { x: crown[0] + l.dx * k, y: crown[1] + l.dy * k, angle: l.a, scale: k };
    out.push({ d: leaf(t, l.len, l.len * 0.46, 0, 0.66), fill: l.tone });
    out.push({ d: midrib(t, l.len * 0.9, l.len * 0.02), fill: C.leafPale, opacity: 0.5 });
  }
  out.push(...pot(cx, bottom, 38 * k, 26 * k, "cream"));
  return out;
}

/** Pothos: variegated hearts heaped on the pot and trailing over its rim on both sides. */
function pothos(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const rim = bottom - 27 * k;
  // Two vines falling over the rim.
  const vines: Array<{ from: Pt; c: Pt; to: Pt }> = [
    { from: [cx - 16 * k, rim], c: [cx - 34 * k, rim + 6 * k], to: [cx - 30 * k, bottom - 2 * k] },
    { from: [cx + 16 * k, rim], c: [cx + 36 * k, rim + 2 * k], to: [cx + 34 * k, bottom - 8 * k] },
  ];
  for (const v of vines) out.push({ d: stem(v.from, v.c, v.to, 1.3 * k, 0.9 * k), fill: C.leafDeep });
  const hearts: Array<{ x: number; y: number; a: number; s: number; tone: string }> = [
    { x: -27, y: -18, a: 40, s: 11, tone: C.leafMid },
    { x: -31, y: -8, a: 20, s: 10, tone: C.leaf },
    { x: -29, y: 2, a: -10, s: 9, tone: C.leafMid },
    { x: 27, y: -22, a: -30, s: 11, tone: C.leaf },
    { x: 33, y: -12, a: -14, s: 10, tone: C.leafMid },
    { x: 34, y: -2, a: 8, s: 9, tone: C.leaf },
  ];
  for (const h of hearts) out.push({ d: heart({ x: cx + h.x * k, y: bottom + h.y * k - 4 * k, angle: h.a, scale: k }, h.s), fill: h.tone });
  out.push(...pot(cx, bottom, 40 * k, 27 * k, "terracotta"));
  const heap: Array<{ x: number; y: number; a: number; s: number; tone: string }> = [
    { x: -18, y: -32, a: 140, s: 20, tone: C.leaf },
    { x: 18, y: -33, a: 220, s: 20, tone: C.leafMid },
    { x: -4, y: -40, a: 174, s: 22, tone: C.leafDeep },
    { x: 8, y: -38, a: 198, s: 21, tone: C.leaf },
    { x: -26, y: -29, a: 110, s: 17, tone: C.leafMid },
    { x: 27, y: -29, a: 248, s: 17, tone: C.leaf },
    { x: -10, y: -30, a: 156, s: 16, tone: C.leafMid },
    { x: 11, y: -29, a: 206, s: 16, tone: C.leafDeep },
  ];
  for (const h of heap) {
    const t: Xf = { x: cx + h.x * k, y: bottom + h.y * k, angle: h.a, scale: k };
    out.push({ d: heart(t, h.s), fill: h.tone });
    out.push({ d: ellipse(h.s * 0.18, h.s * 0.5, h.s * 0.12, h.s * 0.2, t), fill: C.variegate, opacity: 0.85 });
  }
  return out;
}

/** Cactus: a ribbed column with two arms and a pink flower, in a sand pot. */
function cactus(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const top = bottom - 84 * k;
  const body = rect(cx - 9 * k, top, 18 * k, 64 * k, 9 * k);
  const leftArm = [rect(cx - 25 * k, bottom - 62 * k, 9 * k, 24 * k, 4.5 * k), rect(cx - 25 * k, bottom - 45 * k, 18 * k, 8 * k, 4 * k)].join(" ");
  const rightArm = [rect(cx + 16 * k, bottom - 72 * k, 9 * k, 26 * k, 4.5 * k), rect(cx + 7 * k, bottom - 52 * k, 18 * k, 8 * k, 4 * k)].join(" ");
  out.push({ d: [leftArm, rightArm].join(" "), fill: C.leaf });
  out.push({ d: body, fill: C.leafMid });
  for (const dx of [-4, 0, 4]) out.push({ d: rect(cx + dx * k - 0.5 * k, top + 6 * k, 1 * k, 54 * k, 0.5 * k), fill: C.leafDeep, opacity: 0.5 });
  for (let i = 0; i < 5; i++) out.push({ d: ellipse(cx + 10.5 * Math.cos((i * Math.PI * 2) / 5) * k * 0.5, top + 1 * k + Math.sin((i * Math.PI * 2) / 5) * 3 * k, 3.2 * k, 2.2 * k), fill: C.blossom });
  out.push({ d: ellipse(cx, top + 1 * k, 2 * k), fill: C.blossomDeep });
  out.push(...pot(cx, bottom, 38 * k, 24 * k, "cream", 5 * k, 0.86));
  return out;
}

/** Peperomia: a dome of round, fleshy leaves. */
function peperomia(cx = 50, bottom = 98, k = 1): ArtLayer[] {
  const out: ArtLayer[] = [];
  const dome: Array<{ x: number; y: number; r: number; tone: string }> = [
    { x: -20, y: -32, r: 9, tone: C.leafDeep },
    { x: 20, y: -33, r: 9, tone: C.leafDeep },
    { x: -10, y: -40, r: 10, tone: C.leaf },
    { x: 11, y: -41, r: 10, tone: C.leaf },
    { x: 0, y: -50, r: 10.5, tone: C.leafMid },
    { x: -22, y: -44, r: 8, tone: C.leafMid },
    { x: 23, y: -45, r: 8, tone: C.leafMid },
    { x: -10, y: -56, r: 8.5, tone: C.leaf },
    { x: 11, y: -57, r: 8.5, tone: C.leafDeep },
    { x: 0, y: -63, r: 7.5, tone: C.leafMid },
  ];
  for (const d of dome) {
    out.push({ d: ellipse(cx + d.x * k, bottom + d.y * k, d.r * k, d.r * 0.86 * k), fill: d.tone });
    out.push({ d: ellipse(cx + d.x * k - d.r * 0.25 * k, bottom + d.y * k - d.r * 0.25 * k, d.r * 0.32 * k, d.r * 0.2 * k), fill: C.white, opacity: 0.18 });
  }
  out.push(...pot(cx, bottom, 40 * k, 25 * k, "cream"));
  return out;
}

// ---------------------------------------------------------------- Scenes

/** A window at midday from inside: sky and a garden through four panes, light falling on the sill. */
function windowScene(): ArtLayer[] {
  const W = 100;
  const H = 160;
  const out: ArtLayer[] = [];
  // The view first, then the wall over it with the window cut out, so the garden never spills.
  out.push({ d: rect(0, 0, W, H), fill: C.sky });
  out.push({ d: ellipse(70, 34, 16), fill: C.white, opacity: 0.5 });
  for (const [x, y, r, tone] of [[22, 88, 18, C.treeDeep], [44, 80, 20, C.tree], [68, 86, 19, C.treeDeep], [86, 94, 14, C.tree], [30, 100, 14, C.tree], [58, 100, 16, C.tree]] as Array<[number, number, number, string]>) out.push({ d: ellipse(x, y, r, r * 0.9), fill: tone });
  out.push({ d: rect(0, 100, W, 12), fill: C.treeDeep });
  out.push({ d: [rect(0, 0, W, H), rect(18, 18, 64, 88)].join(" "), fill: C.wallWarm, evenOdd: true });
  out.push({ d: [rect(14, 14, 72, 96, 2), rect(18, 18, 64, 88)].join(" "), fill: C.frame, evenOdd: true });
  out.push({ d: rect(48.5, 18, 3, 88), fill: C.frame });
  out.push({ d: rect(18, 60, 64, 3), fill: C.frame });
  // Light from the panes falling across the sill and down the wall.
  out.push({ d: poly([[18, 106], [48, 106], [74, 160], [30, 160]]), fill: C.white, opacity: 0.22 });
  out.push({ d: poly([[52, 106], [82, 106], [100, 140], [100, 160], [80, 160]]), fill: C.white, opacity: 0.16 });
  out.push({ d: rect(8, 106, 84, 6, 1.5), fill: C.wood });
  out.push({ d: rect(8, 111, 84, 2), fill: C.woodDark });
  out.push({ d: rect(0, 113, W, 47), fill: C.wallWarmDeep, opacity: 0.5 });
  out.push(...peperomia(32, 107, 0.5));
  out.push(...snake(68, 107, 0.48));
  return out;
}

/** A plant on a stool against a soft wall: what the camera sees when you frame a whole plant. */
function plantRoom(): ArtLayer[] {
  const out: ArtLayer[] = [];
  out.push({ d: rect(0, 0, 100, 160), fill: "#D7E3D9" });
  out.push({ d: rect(0, 128, 100, 32), fill: "#C8B8A0" });
  out.push({ d: rect(0, 126, 100, 3), fill: "#B6A385" });
  out.push({ d: ellipse(80, 30, 26, 40), fill: C.white, opacity: 0.25 });
  out.push({ d: rect(32, 104, 36, 4, 1.5), fill: C.woodDark });
  out.push({ d: rect(36, 107, 3, 24), fill: C.woodDark });
  out.push({ d: rect(61, 107, 3, 24), fill: C.woodDark });
  out.push(...monstera(50, 105, 1.08));
  return out;
}

/** Cuttings rooting in a jar of water on a sunny ledge. */
function jarScene(): ArtLayer[] {
  const out: ArtLayer[] = [];
  out.push({ d: rect(0, 0, 160, 90), fill: "#CFE1F7" });
  out.push({ d: rect(0, 68, 160, 22), fill: C.wood });
  out.push({ d: rect(0, 66, 160, 3), fill: C.woodDark });
  out.push({ d: ellipse(124, 18, 28, 20), fill: C.white, opacity: 0.35 });
  // Stems first, so the jar's glass reads over them.
  const stems: Array<{ from: Pt; c: Pt; to: Pt }> = [
    { from: [72, 64], c: [70, 40], to: [62, 22] },
    { from: [80, 64], c: [82, 38], to: [86, 16] },
    { from: [88, 64], c: [94, 44], to: [104, 28] },
  ];
  for (const s of stems) out.push({ d: stem(s.from, s.c, s.to, 1.6, 1.1), fill: C.leafDeep });
  out.push({ d: heart({ x: 62, y: 22, angle: 140 }, 13), fill: C.leafMid });
  out.push({ d: heart({ x: 86, y: 16, angle: 186 }, 15), fill: C.leaf });
  out.push({ d: heart({ x: 104, y: 28, angle: 228 }, 13), fill: C.leafMid });
  out.push({ d: heart({ x: 70, y: 40, angle: 120 }, 9), fill: C.leaf });
  out.push({ d: heart({ x: 95, y: 42, angle: 240 }, 9), fill: C.leafMid });
  // Roots in the water.
  for (const [x, dx] of [[72, -6], [80, 2], [88, 7], [76, -2], [84, 4]] as Array<[number, number]>) out.push({ d: stem([x, 58], [x + dx * 0.6, 64], [x + dx, 69], 0.9, 0.4, 6), fill: C.root });
  out.push({ d: rect(64, 50, 32, 20, 4), fill: C.water, opacity: 0.55 });
  out.push({ d: rect(62, 38, 36, 32, 6), fill: C.glass, opacity: 0.28 });
  out.push({ d: rect(64, 34, 32, 5, 2), fill: C.glass, opacity: 0.5 });
  out.push({ d: rect(66, 42, 3, 22, 1.5), fill: C.white, opacity: 0.55 });
  out.push({ d: ellipse(80, 70, 22, 2), fill: C.shadow, opacity: 0.12 });
  return out;
}

// ---------------------------------------------------------------- Leaves with a problem

/** One leaf on its stalk, standing up, coloured by what's wrong with it. */
function signLeaf(body: string, vein: string, extra: (t: Xf) => ArtLayer[] = () => []): ArtLayer[] {
  const t: Xf = { x: 50, y: 92, angle: -90 };
  return [
    { d: stem([50, 98], [49, 94], [50, 88], 2.4, 2), fill: C.leafDeep },
    { d: leaf({ ...t, y: 88 }, 80, 30, 0, 0.44), fill: body },
    { d: midrib({ ...t, y: 88 }, 76, 1.2), fill: vein, opacity: 0.8 },
    ...[0.3, 0.48, 0.64].flatMap((u, i) => [
      { d: leaf({ x: 50, y: 88 - 80 * u, angle: -150 + i * 6 }, 22 - i * 4, 0.8), fill: vein, opacity: 0.55 },
      { d: leaf({ x: 50, y: 88 - 80 * u, angle: -30 - i * 6 }, 22 - i * 4, 0.8), fill: vein, opacity: 0.55 },
    ]),
    ...extra(t),
  ];
}

function crispyLeaf(): ArtLayer[] {
  return signLeaf(C.leafMid, C.leafDeep, () => [
    { d: new P().m(50, 8).c(56, 10, 64, 20, 70, 32).l(64, 30).l(66, 37).l(59, 33).l(58, 40).l(52, 34).l(48, 40).l(44, 33).l(39, 38).l(38, 31).l(31, 34).c(36, 20, 44, 10, 50, 8).z().toString(), fill: C.crisp },
    { d: ellipse(64, 52, 3.6, 2.6), fill: C.crisp },
    { d: new P().m(50, 8).c(54, 10, 59, 15, 63, 21).l(56, 20).l(52, 25).l(47, 20).l(41, 22).c(43, 15, 47, 10, 50, 8).z().toString(), fill: C.crispDeep },
  ]);
}

function limpStem(): ArtLayer[] {
  const out: ArtLayer[] = [];
  out.push({ d: stem([50, 98], [50, 46], [26, 40], 3, 1.8), fill: C.leafMid });
  out.push({ d: stem([50, 70], [64, 52], [74, 58], 2.2, 1.4), fill: C.leafMid });
  out.push({ d: heart({ x: 26, y: 40, angle: -8 }, 24, 0.92), fill: C.leafLight });
  out.push({ d: heart({ x: 74, y: 58, angle: 12 }, 20, 0.92), fill: C.leafLight });
  out.push({ d: midrib({ x: 26, y: 42, angle: 82 }, 21, 0.6), fill: C.leafDeep, opacity: 0.6 });
  out.push({ d: midrib({ x: 74, y: 60, angle: 102 }, 17, 0.6), fill: C.leafDeep, opacity: 0.6 });
  return out;
}

// ---------------------------------------------------------------- Feeling marks

/** A star burst: sharp, high energy, unpleasant. */
function burst(points = 8, outer = 47, inner = 24): string {
  const p = new P();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    if (i === 0) p.m(x, y);
    else {
      // Each edge bows out a little, so the tips stay sharp and the shape still looks soft.
      const am = a - Math.PI / (points * 2);
      const rm = (outer + inner) / 2 + 1;
      p.q(50 + rm * Math.cos(am), 50 + rm * Math.sin(am), x, y);
    }
  }
  const a0 = -Math.PI / 2 - Math.PI / (points * 2);
  const rm = (outer + inner) / 2 + 1;
  return p.q(50 + rm * Math.cos(a0), 50 + rm * Math.sin(a0), 50, 50 - outer).z().toString();
}

/** A scalloped sun: bright, high energy, pleasant. */
function scallop(bumps = 7, r = 36, out = 7): string {
  const p = new P();
  for (let i = 0; i < bumps; i++) {
    const a0 = (i * Math.PI * 2) / bumps - Math.PI / 2;
    const a1 = ((i + 1) * Math.PI * 2) / bumps - Math.PI / 2;
    const am = (a0 + a1) / 2;
    if (i === 0) p.m(50 + r * Math.cos(a0), 50 + r * Math.sin(a0));
    p.q(50 + (r + out * 2) * Math.cos(am), 50 + (r + out * 2) * Math.sin(am), 50 + r * Math.cos(a1), 50 + r * Math.sin(a1));
  }
  return p.z().toString();
}

/** A falling drop: heavy, low energy, unpleasant. */
const drop = () => new P().m(50, 4).c(60, 22, 82, 44, 82, 64).c(82, 82, 68, 96, 50, 96).c(32, 96, 18, 82, 18, 64).c(18, 44, 40, 22, 50, 4).z().toString();

/** A four-leaf clover: soft, low energy, pleasant. */
const clover = () => [ellipse(50, 28, 22), ellipse(72, 50, 22), ellipse(50, 72, 22), ellipse(28, 50, 22), ellipse(50, 50, 16)].join(" ");

/** The feeling marks: one shape per corner of the field, in the order the bubble field lists them. */
export const FEELING_MARKS = ["burst", "sun", "drop", "clover"] as const;

// ---------------------------------------------------------------- The set

/** The house pastels the drawings sit on (the solid ARTS: sage, butter, sky, sand, lilac, blush). */
const G = { sage: "#A9DCB7", butter: "#FFD976", sky: "#9CC2FF", sand: "#E9D5B3", lilac: "#CDB8FF", blush: "#FF8FB8" };
const plant = (label: string, ground: string, layers: ArtLayer[]): ArtDef => ({ label, w: 100, h: 100, fit: "contain", anchor: "bottom", ground, layers });
const sign = (label: string, ground: string, layers: ArtLayer[]): ArtDef => ({ label, w: 100, h: 100, fit: "contain", anchor: "center", ground, layers });
const mark = (label: string, d: string): ArtDef => ({ label, w: 100, h: 100, fit: "contain", anchor: "center", layers: [{ d, fill: "currentColor" }] });

export const ARTWORK: Record<string, ArtDef> = {
  monstera: plant("Monstera", G.sage, monstera()),
  snake: plant("Snake plant", G.butter, snake()),
  rubber: plant("Rubber plant", G.sky, rubber()),
  fiddle: plant("Fiddle-leaf fig", G.sand, fiddle()),
  pothos: plant("Pothos", G.lilac, pothos()),
  cactus: plant("Cactus", G.butter, cactus()),
  peperomia: plant("Peperomia", G.blush, peperomia()),
  window: { label: "A sunny window", w: 100, h: 160, fit: "cover", anchor: "center", layers: windowScene() },
  room: { label: "A plant against a wall", w: 100, h: 160, fit: "cover", anchor: "center", layers: plantRoom() },
  jar: { label: "Cuttings in a jar", w: 160, h: 90, fit: "cover", anchor: "center", layers: jarScene() },
  "leaf-yellow": sign("A yellowing leaf", G.sand, signLeaf(C.yellowLeaf, C.yellowDeep, () => [{ d: ellipse(40, 46, 4, 3), fill: C.crisp, opacity: 0.7 }])),
  "leaf-crispy": sign("A leaf with crispy edges", G.butter, crispyLeaf()),
  "leaf-limp": sign("A drooping stem", G.sky, limpStem()),
  "leaf-pale": sign("A pale leaf", G.sage, signLeaf(C.paleLeaf, C.paleVein)),
  burst: mark("Burst", burst()),
  sun: mark("Sun", scallop()),
  drop: mark("Drop", drop()),
  clover: mark("Clover", clover()),
};

export const artwork = (id: unknown): ArtDef | undefined => own(ARTWORK, id);
/** What an artwork sits on in a photo spot: its pastel, or the first colour of a scene. */
export const artworkGround = (id: unknown): string => {
  const a = artwork(id);
  return a?.ground ?? (a?.layers[0]?.fill && a.layers[0].fill !== "currentColor" ? a.layers[0].fill : "#A9DCB7");
};
export const isArtwork = (id: unknown) => artwork(id) !== undefined;
export const artworkIds = Object.keys(ARTWORK);
/** The plants and scenes (not the marks): what a photo spot can show. */
export const PICTURE_ARTWORK = artworkIds.filter((id) => !(FEELING_MARKS as readonly string[]).includes(id));

/** Pastels for pages of the same drawing: its own first, then the others in turn. */
export function artworkGrounds(id: string, count: number): string[] {
  const own = artworkGround(id);
  const rest = Object.values(G).filter((g) => g !== own);
  return Array.from({ length: count }, (_, i) => (i === 0 ? own : rest[(i - 1) % rest.length]));
}

/** Dark ink for words set on a pastel. */
export const ARTWORK_INK = "#141414";

/**
 * How far a drawing sits in from a photo spot's edges, in points: a plant stands on the bottom edge
 * with room above it, a leaf or a mark floats in the middle, and a scene fills the spot.
 */
export function artworkInset(id: string): { top: number; side: number; bottom: number } {
  const a = artwork(id);
  if (!a || a.fit === "cover") return { top: 0, side: 0, bottom: 0 };
  return a.anchor === "bottom" ? { top: 12, side: 8, bottom: 0 } : { top: 14, side: 14, bottom: 14 };
}

/** The SwiftUI padding for `artworkInset`, as modifiers on the drawing. */
export function swiftArtworkPadding(id: string): string {
  const i = artworkInset(id);
  if (!i.top && !i.side && !i.bottom) return "";
  if (i.top === i.side && i.side === i.bottom) return `.padding(${i.top})`;
  return `.padding(.top, ${i.top}).padding(.horizontal, ${i.side})${i.bottom ? `.padding(.bottom, ${i.bottom})` : ""}`;
}

/** Select options for a picture spot: its usual fills, then the drawings it can show. */
export function withArtwork<T extends { value: string; label: string }>(options: T[]): Array<{ value: string; label: string }> {
  return [...options, ...PICTURE_ARTWORK.map((id) => ({ value: id, label: `${ARTWORK[id].label} (drawing)` }))];
}

// ---------------------------------------------------------------- Swift

/** One identifier per artwork, as its static property on `Artwork`. */
export const artworkSwiftName = (id: string) => id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const ARTWORK_VIEW = [
  "/// A flat drawing: filled paths in their own box, fitted to the frame. `cover` fills the frame and",
  "/// crops the overflow; otherwise the whole drawing shows, sat on the bottom edge or centred.",
  "private struct Artwork: View {",
  "    struct Layer {",
  "        let path: Path",
  "        /// nil paints in the foreground style (a mark tinted where it's used).",
  "        let color: Color?",
  "        var evenOdd = false",
  "    }",
  "",
  "    let size: CGSize",
  "    var cover = false",
  "    var sitsLow = true",
  "    let layers: [Layer]",
  "",
  "    var body: some View {",
  "        Canvas { context, frame in",
  "            let kx = frame.width / size.width, ky = frame.height / size.height",
  "            let k = cover ? max(kx, ky) : min(kx, ky)",
  "            let x = (frame.width - size.width * k) / 2",
  "            let y = sitsLow && !cover ? frame.height - size.height * k : (frame.height - size.height * k) / 2",
  "            let fit = CGAffineTransform(translationX: x, y: y).scaledBy(x: k, y: k)",
  "            for layer in layers {",
  "                let shape = layer.path.applying(fit)",
  "                let style = FillStyle(eoFill: layer.evenOdd)",
  "                if let color = layer.color {",
  "                    context.fill(shape, with: .color(color), style: style)",
  "                } else {",
  "                    context.fill(shape, with: .foreground, style: style)",
  "                }",
  "            }",
  "        }",
  "        .accessibilityHidden(true)",
  "    }",
  "",
  "    /// Reads SVG path data written with absolute commands: M, L, H, V, C, Q and Z.",
  "    static func path(_ data: String) -> Path {",
  "        var path = Path()",
  "        var numbers: [CGFloat] = []",
  "        var command: Character = \" \"",
  "        var token = \"\"",
  "        func point(_ i: Int) -> CGPoint { CGPoint(x: numbers[i], y: numbers[i + 1]) }",
  "        func run() {",
  "            switch command {",
  "            case \"M\":",
  "                guard numbers.count >= 2 else { break }",
  "                path.move(to: point(0))",
  "                for i in stride(from: 2, to: numbers.count - 1, by: 2) { path.addLine(to: point(i)) }",
  "            case \"L\":",
  "                for i in stride(from: 0, to: numbers.count - 1, by: 2) { path.addLine(to: point(i)) }",
  "            case \"H\":",
  "                for x in numbers { path.addLine(to: CGPoint(x: x, y: path.currentPoint?.y ?? 0)) }",
  "            case \"V\":",
  "                for y in numbers { path.addLine(to: CGPoint(x: path.currentPoint?.x ?? 0, y: y)) }",
  "            case \"C\":",
  "                for i in stride(from: 0, to: numbers.count - 5, by: 6) {",
  "                    path.addCurve(to: point(i + 4), control1: point(i), control2: point(i + 2))",
  "                }",
  "            case \"Q\":",
  "                for i in stride(from: 0, to: numbers.count - 3, by: 4) {",
  "                    path.addQuadCurve(to: point(i + 2), control: point(i))",
  "                }",
  "            case \"Z\":",
  "                path.closeSubpath()",
  "            default:",
  "                break",
  "            }",
  "            numbers.removeAll()",
  "        }",
  "        func push() {",
  "            if let value = Double(token) { numbers.append(CGFloat(value)) }",
  "            token = \"\"",
  "        }",
  "        for character in data {",
  "            if character.isLetter {",
  "                push()",
  "                run()",
  "                command = character",
  "            } else if character == \" \" || character == \",\" {",
  "                push()",
  "            } else {",
  "                token.append(character)",
  "            }",
  "        }",
  "        push()",
  "        run()",
  "        return path",
  "    }",
  "}",
];

/** One artwork as a static property on `Artwork`, its layers read from the same path data. */
function artworkExtension(id: string): string[] {
  const a = ARTWORK[id];
  const layer = (l: ArtLayer) => {
    const color = l.fill === "currentColor" ? "nil" : swiftHex(l.fill, l.opacity ?? 1);
    return `${INDENT.repeat(2)}Layer(path: path(${JSON.stringify(l.d)}), color: ${color}${l.evenOdd ? ", evenOdd: true" : ""}),`;
  };
  return [
    "extension Artwork {",
    `${INDENT}/// ${a.label}.`,
    `${INDENT}static let ${artworkSwiftName(id)} = Artwork(`,
    `${INDENT.repeat(2)}size: CGSize(width: ${num(a.w)}, height: ${num(a.h)}),`,
    ...(a.fit === "cover" ? [`${INDENT.repeat(2)}cover: true,`] : []),
    ...(a.anchor === "center" && a.fit !== "cover" ? [`${INDENT.repeat(2)}sitsLow: false,`] : []),
    `${INDENT.repeat(2)}layers: [`,
    ...a.layers.map((l) => INDENT + layer(l)),
    `${INDENT.repeat(2)}]`,
    `${INDENT})`,
    "}",
  ];
}

/** Declares the `Artwork` view on its own, for a view whose properties name the type. */
export function declareArtworkView(ctx: { declare(key: string, lines: string[]): void }): void {
  ctx.declare("Artwork", ARTWORK_VIEW);
}

/**
 * Declares the `Artwork` view and one artwork on it, once per file, and returns the Swift that
 * draws it (`Artwork.monstera`). Null for an id that isn't an artwork.
 */
export function swiftArtwork(ctx: { declare(key: string, lines: string[]): void }, id: string): string | null {
  if (!isArtwork(id)) return null;
  declareArtworkView(ctx);
  ctx.declare(`Artwork.${id}`, artworkExtension(id));
  return `Artwork.${artworkSwiftName(id)}`;
}

/** The artwork as an SVG string (for stills and the docs), on an optional ground. */
export function artworkSvg(id: string, opts: { ground?: string; ink?: string; width?: number; height?: number } = {}): string {
  const a = ARTWORK[id];
  if (!a) return "";
  const w = opts.width ?? a.w;
  const h = opts.height ?? a.h;
  const aspect = a.fit === "cover" ? "xMidYMid slice" : a.anchor === "bottom" ? "xMidYMax meet" : "xMidYMid meet";
  const layers = a.layers
    .map((l) => `<path d="${l.d}" fill="${l.fill === "currentColor" ? opts.ink ?? "#000" : l.fill}"${l.opacity !== undefined ? ` fill-opacity="${l.opacity}"` : ""}${l.evenOdd ? ' fill-rule="evenodd"' : ""}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${opts.ground ? `<rect width="100%" height="100%" fill="${opts.ground}"/>` : ""}<svg width="${w}" height="${h}" viewBox="0 0 ${a.w} ${a.h}" preserveAspectRatio="${aspect}">${layers}</svg></svg>`;
}
