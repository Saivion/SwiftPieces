/**
 * The grain stage: four to six blurred colour fields, light and cool on top, dark and warm below,
 * under a 1px grey grain that shows in the light areas and fades in the dark ones, with an optional
 * fine white line layer (rays, contours, waves, dots, lenses). Every stage is seeded: the seed picks
 * a family, nudges its fields, and picks and places the line layer, so no two stages match.
 *
 * Shared with SwiftPiecesPro (lib/brand/grain.ts). Keep the two in step.
 */

export type GrainFamily = "teardowns" | "builders" | "workflow" | "notes" | "latenight" | "public";
export type GrainLines = "none" | "rays" | "contours" | "waves" | "dots" | "lenses";

type Stop = readonly [at: number, color: string];
type Blob = readonly [x: number, y: number, radius: number, color: string];

/** Each family uses neighbouring hues only: a vertical base, then soft fields laid over it. */
const FAMILIES: Record<GrainFamily, { base: readonly Stop[]; blobs: readonly Blob[] }> = {
  teardowns: {
    base: [[0, "#97a3db"], [0.42, "#b58dc4"], [0.64, "#d8714c"], [1, "#e0a24c"]],
    blobs: [[0.1, 0.12, 0.42, "#7f97e2"], [0.86, 0.22, 0.4, "#d590c4"], [0.5, 0.42, 0.32, "#a983bd"], [0.08, 0.84, 0.38, "#dc583a"], [0.55, 0.98, 0.42, "#f2b847"], [0.96, 0.86, 0.34, "#d97b5c"]],
  },
  builders: {
    base: [[0, "#8aa0ad"], [0.38, "#a2a7a2"], [0.56, "#ddb07a"], [0.76, "#a8502a"], [1, "#1a0d0a"]],
    blobs: [[0.12, 0.56, 0.34, "#f1ce8e"], [0.88, 0.6, 0.34, "#e0772f"], [0.5, 1.04, 0.42, "#140807"], [0.6, 0.08, 0.5, "#8399a8"], [0.3, 0.3, 0.3, "#9fa9a8"]],
  },
  workflow: {
    base: [[0, "#dfe3e7"], [0.34, "#b8cec5"], [0.6, "#3f7377"], [1, "#132834"]],
    blobs: [[0.08, 0.46, 0.34, "#8dc3a6"], [0.5, 0.04, 0.46, "#e7e9ee"], [0.88, 0.56, 0.34, "#506a6f"], [0.28, 0.96, 0.4, "#0e202e"], [0.86, 0.92, 0.36, "#28495a"]],
  },
  notes: {
    base: [[0, "#cfd8dd"], [0.34, "#adbc9c"], [0.6, "#7a9050"], [1, "#1d2c15"]],
    blobs: [[0.14, 0.52, 0.34, "#b6c27b"], [0.86, 0.1, 0.4, "#d9e1e7"], [0.8, 0.64, 0.34, "#5b7937"], [0.4, 1.02, 0.42, "#141f0e"]],
  },
  latenight: {
    base: [[0, "#aa9bd8"], [0.4, "#9884c6"], [0.7, "#4c2878"], [1, "#1d1036"]],
    blobs: [[0.8, 0.42, 0.28, "#e297c9"], [0.14, 0.14, 0.4, "#b8aae2"], [0.24, 0.76, 0.34, "#5a2c88"], [0.62, 0.94, 0.4, "#160a2b"], [0.56, 0.56, 0.24, "#c07ab9"]],
  },
  public: {
    base: [[0, "#dfe2e7"], [0.34, "#e8cfb2"], [0.56, "#df895a"], [0.8, "#c64f2d"], [1, "#6c2318"]],
    blobs: [[0.86, 0.4, 0.34, "#f5d1a2"], [0.14, 0.56, 0.3, "#e69f79"], [0.4, 0.76, 0.38, "#cf562d"], [0.86, 0.96, 0.34, "#7a281b"], [0.2, 0.08, 0.4, "#e4e7eb"]],
  },
};

export const GRAIN_FAMILIES = Object.keys(FAMILIES) as GrainFamily[];
const LINES: GrainLines[] = ["rays", "contours", "waves", "dots", "lenses", "none"];

export type GrainSpec = {
  family: GrainFamily;
  lines: GrainLines;
  /** A CSS colour for the canvas until it paints: the family's middle tone. */
  fallback: string;
  /** Seeded 0..1 values the paint reads: field nudges, warp phase, line placement. */
  seed: number;
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // FNV alone leaves similar seeds ("kit-a", "kit-b") sharing low bits; mix them so families spread.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for placement and grain. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable recipe for a seed. `family` and `lines` override what the seed would pick. */
export function grainSpec(seed: string, opts: { family?: GrainFamily; lines?: GrainLines | false } = {}): GrainSpec {
  const n = hash(seed);
  const family = opts.family ?? GRAIN_FAMILIES[n % GRAIN_FAMILIES.length] ?? "teardowns";
  // Different bits from the family's, so every family meets every line layer.
  const lines = opts.lines === false ? "none" : (opts.lines ?? LINES[(n >>> 8) % LINES.length] ?? "none");
  const base = FAMILIES[family].base;
  const mid = base[Math.floor(base.length / 2)];
  return { family, lines, fallback: mid ? mid[1] : "#888", seed: hash(`${seed}:grain`) };
}

/* ---------- colour (OKLab, so blends stay clean) ---------- */

type Lab = [number, number, number];

function srgbToLin(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linToSrgb(x: number) {
  const v = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
}

function toLab(hex: string): Lab {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = srgbToLin((n >> 16) & 255);
  const g = srgbToLin((n >> 8) & 255);
  const b = srgbToLin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab(L: number, A: number, B: number, out: number[], o: number) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  out[o] = linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[o + 1] = linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[o + 2] = linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

const LABS = new Map<GrainFamily, { base: Array<[number, Lab]>; blobs: Array<[number, number, number, Lab]> }>();
function labs(family: GrainFamily) {
  let f = LABS.get(family);
  if (!f) {
    const src = FAMILIES[family];
    f = { base: src.base.map(([t, c]) => [t, toLab(c)]), blobs: src.blobs.map(([x, y, r, c]) => [x, y, r, toLab(c)]) };
    LABS.set(family, f);
  }
  return f;
}

/* ---------- paint ---------- */

/** The colour fields are soft, so they're mixed on a coarse grid (one cell per FIELD css px) and scaled up. */
const FIELD = 3;

/**
 * Paints a stage into `canvas` at `width`×`height` CSS px and `dpr`. The canvas is resized to fit.
 */
export function paintGrain(canvas: HTMLCanvasElement, width: number, height: number, dpr: number, spec: GrainSpec) {
  const W = Math.max(1, Math.round(width * dpr));
  const H = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const r = rng(spec.seed);
  const f = labs(spec.family);
  // The seed's own version of the family: every field nudged, resized, and the warp phased.
  const blobs = f.blobs.map(([x, y, rad, c]) => [x + (r() - 0.5) * 0.22, y + (r() - 0.5) * 0.1, rad * (0.85 + r() * 0.3), c] as const);
  const phase = r() * Math.PI * 2;

  // 1. The colour field, coarse.
  const fw = Math.max(2, Math.ceil(width / FIELD));
  const fh = Math.max(2, Math.ceil(height / FIELD));
  const field = document.createElement("canvas");
  field.width = fw;
  field.height = fh;
  const fctx = field.getContext("2d");
  if (!fctx) return;
  const img = fctx.createImageData(fw, fh);
  const px = img.data;
  const rgb = [0, 0, 0];
  // Fields stay roughly round on any shape, but stretch part of the way along a long side so a thin
  // strip still gets broad washes instead of a row of spots.
  const ax = Math.sqrt(width / Math.min(width, height));
  const ay = Math.sqrt(height / Math.min(width, height));
  const base = f.base;
  for (let y = 0; y < fh; y++) {
    const ny = (y + 0.5) / fh;
    for (let x = 0; x < fw; x++) {
      const nx = (x + 0.5) / fw;
      // A gentle warp, so no field reads as a circle.
      const wx = nx + 0.035 * Math.sin(ny * 5.1 + phase);
      const wy = ny + 0.03 * Math.sin(nx * 4.3 + phase * 0.7) + 0.02 * Math.sin((nx + ny) * 7 + phase);
      let k = 0;
      while (k < base.length - 2 && wy > (base[k + 1]?.[0] ?? 1)) k++;
      const a = base[k];
      const b = base[k + 1] ?? a;
      if (!a || !b) continue;
      let t = b[0] === a[0] ? 0 : (wy - a[0]) / (b[0] - a[0]);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      t = t * t * (3 - 2 * t);
      let L = a[1][0] + (b[1][0] - a[1][0]) * t;
      let A = a[1][1] + (b[1][1] - a[1][1]) * t;
      let B = a[1][2] + (b[1][2] - a[1][2]) * t;
      for (const [bx, by, br, c] of blobs) {
        const dx = (wx - bx) * ax;
        const dy = (wy - by) * ay;
        const s = br * 0.62;
        const w = 0.88 * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
        L += (c[0] - L) * w;
        A += (c[1] - A) * w;
        B += (c[2] - B) * w;
      }
      fromLab(L, A, B, rgb, 0);
      const o = (y * fw + x) * 4;
      px[o] = rgb[0] ?? 0;
      px[o + 1] = rgb[1] ?? 0;
      px[o + 2] = rgb[2] ?? 0;
      px[o + 3] = 255;
    }
  }
  fctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(field, 0, 0, W, H);

  // 2. Grain: grey, about one CSS pixel, strongest where the field is light.
  const cell = dpr >= 2 ? 2 : 1;
  const out = ctx.getImageData(0, 0, W, H);
  const d = out.data;
  const gw = Math.ceil(W / cell);
  const row = new Float32Array(gw);
  const g = rng(spec.seed ^ 0x9e3779b9);
  for (let y = 0; y < H; y++) {
    if (y % cell === 0) for (let i = 0; i < gw; i++) row[i] = g() + g() - 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const R = d[o] ?? 0;
      const G = d[o + 1] ?? 0;
      const Bl = d[o + 2] ?? 0;
      const lum = (0.2126 * R + 0.7152 * G + 0.0722 * Bl) / 255;
      const n = (row[(x / cell) | 0] ?? 0) * 26 * (0.18 + 0.82 * lum * lum);
      d[o] = R + n;
      d[o + 1] = G + n;
      d[o + 2] = Bl + n;
    }
  }
  ctx.putImageData(out, 0, 0);

  // 3. The line layer.
  if (spec.lines !== "none") drawLines(ctx, W, H, dpr, spec.lines, r);
}

function drawLines(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, kind: GrainLines, r: () => number) {
  // One unit for every layer, so a wide strip and a square get lines at the same spacing.
  const U = Math.max(W, H);
  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 0.75 * dpr;
  ctx.lineJoin = "round";

  if (kind === "rays") {
    const cx = W * (0.35 + r() * 0.3);
    const cy = H * (0.5 + r() * 0.2);
    const n = 96 + Math.floor(r() * 40);
    const freq = 13 + r() * 6;
    const fade = ctx.createRadialGradient(cx, cy, U * 0.06, cx, cy, U * 0.4);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(1, "rgba(255,255,255,0.32)");
    ctx.strokeStyle = fade;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      ctx.beginPath();
      for (let s = 0; s <= 60; s++) {
        const rr = U * (0.06 + s * 0.016);
        const ang = th + 0.035 * Math.sin((rr / U) * freq + i * 0.45);
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr * 0.92;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (kind === "contours") {
    const cx = W * (0.35 + r() * 0.3);
    const cy = H * (0.5 + r() * 0.25);
    const lobes = 2 + Math.floor(r() * 3);
    for (let k = 0; k < 52; k++) {
      const R = U * (0.04 + k * 0.022);
      ctx.beginPath();
      for (let s = 0; s <= 140; s++) {
        const th = (s / 140) * Math.PI * 2;
        const rr = R * (1 + 0.035 * Math.sin(th * lobes + k * 0.35) + 0.02 * Math.sin(th * 5 - k * 0.2));
        const x = cx + Math.cos(th) * rr * 1.08;
        const y = cy + Math.sin(th) * rr * 0.86;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.globalAlpha = 0.16 + Math.min(0.2, k * 0.006);
      ctx.stroke();
    }
  } else if (kind === "waves") {
    const gap = U / (28 + r() * 8);
    const f1 = 7 + r() * 4;
    const f2 = 15 + r() * 5;
    const p = r() * 6.28;
    const n = Math.ceil(H / gap) + 2;
    for (let i = 0; i < n; i++) {
      const y0 = (i - 0.5) * gap;
      const amp = gap * (0.3 + 0.6 * Math.abs(Math.sin(i * 0.37 + p)));
      ctx.beginPath();
      for (let s = 0; s <= 120; s++) {
        const x = (s / 120) * W;
        const u = x / U;
        const y = y0 + amp * Math.sin(u * f1 + i * 0.55 + p) + amp * 0.6 * Math.sin(u * f2 - i * 0.3);
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.globalAlpha = 0.22 + 0.18 * (i / n);
      ctx.stroke();
    }
  } else if (kind === "dots") {
    const step = U / (20 + Math.floor(r() * 8));
    const ox = r() * step;
    const oy = r() * step;
    ctx.globalAlpha = 0.5;
    for (let y = oy; y < H; y += step) {
      for (let x = ox; x < W; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (kind === "lenses") {
    // A loose ring of lens outlines around the middle, each turned along or across it.
    const n = 10 + Math.floor(r() * 4);
    const turn = r() * Math.PI;
    ctx.globalAlpha = 0.34;
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2;
      const dist = 0.36 + r() * 0.16;
      const x = W / 2 + Math.cos(a) * W * dist;
      const y = H / 2 + Math.sin(a) * H * dist;
      const len = U * (0.12 + r() * 0.12);
      const rot = a + (r() < 0.5 ? 0 : Math.PI / 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const bulge = len * 0.36;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -bulge, len, 0);
      ctx.quadraticCurveTo(0, bulge, -len, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}
