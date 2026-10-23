/**
 * The grain stage: soft colour fields in a SwiftPieces palette, light on top and deep below, under a
 * 1px grey grain that shows in the light areas and fades in the dark ones, with a fine white line
 * motif. Each kind of thing in the library has its own palette and motif, so every screen card reads
 * as a screen and every flow as a flow; the seed moves the fields, tilts the light and places the
 * motif, so no two stages match.
 *
 * Shared with SwiftPiecesPro (lib/brand/grain.ts). Keep the two in step.
 */

export type GrainKind = "screen" | "flow" | "template" | "kit" | "block" | "brand";

type Stop = readonly [at: number, color: string];
type Blob = readonly [x: number, y: number, radius: number, color: string];

/**
 * Palettes built from the brand's red, orange, pink and blue, each kept to neighbouring hues:
 * a vertical base, then soft fields laid over it.
 */
const PALETTES: Record<GrainKind, { base: readonly Stop[]; blobs: readonly Blob[] }> = {
  // Screens, "Ember": blush to the brand red to wine.
  screen: {
    base: [[0, "#fff1ef"], [0.34, "#ffbdb5"], [0.58, "#ff5148"], [0.8, "#c8101e"], [1, "#2c0308"]],
    blobs: [[0.2, 0.1, 0.4, "#ffe6e2"], [0.86, 0.34, 0.3, "#ff8f86"], [0.14, 0.68, 0.34, "#ff2a2a"], [0.7, 0.98, 0.42, "#3d0410"], [0.58, 0.52, 0.24, "#ff6b5e"]],
  },
  // Flows, "Tide": ice to the brand blue to midnight.
  flow: {
    base: [[0, "#eef3ff"], [0.34, "#b9cdff"], [0.58, "#4d8dff"], [0.8, "#1f3fa8"], [1, "#070d2b"]],
    blobs: [[0.86, 0.12, 0.4, "#e2eaff"], [0.12, 0.44, 0.3, "#8fb3ff"], [0.82, 0.62, 0.3, "#3a6cf0"], [0.3, 0.98, 0.42, "#050a24"], [0.56, 0.38, 0.22, "#a9a7ff"]],
  },
  // Templates, "Dusk": blush to the brand pink to violet to plum.
  template: {
    base: [[0, "#fff0f6"], [0.34, "#ffc2da"], [0.58, "#e07ad0"], [0.8, "#6b33c9"], [1, "#170a36"]],
    blobs: [[0.16, 0.14, 0.4, "#ffe3ee"], [0.86, 0.4, 0.32, "#ff8fb8"], [0.2, 0.7, 0.32, "#a14fe0"], [0.76, 0.98, 0.42, "#12082c"], [0.54, 0.55, 0.24, "#ff9fd0"]],
  },
  // Build Kit, "Flare": cream to the brand orange to ember.
  kit: {
    base: [[0, "#fff6ec"], [0.34, "#ffd9b0"], [0.58, "#ff9a4a"], [0.8, "#e0561c"], [1, "#3a1205"]],
    blobs: [[0.8, 0.12, 0.4, "#fff0dc"], [0.16, 0.42, 0.3, "#ffc47a"], [0.8, 0.68, 0.3, "#ff7a3c"], [0.34, 0.98, 0.42, "#2e0d04"], [0.5, 0.55, 0.22, "#ffb067"]],
  },
  // Blocks, "Lagoon": mint to sea green to deep teal.
  block: {
    base: [[0, "#effbf6"], [0.34, "#b6ecda"], [0.58, "#2fc4a0"], [0.8, "#0b7a74"], [1, "#03222a"]],
    blobs: [[0.84, 0.1, 0.4, "#e3fbf1"], [0.14, 0.42, 0.3, "#8fe3c8"], [0.84, 0.66, 0.3, "#16a39a"], [0.3, 0.98, 0.42, "#021a22"], [0.54, 0.5, 0.22, "#7fe0d2"]],
  },
  // Everything else, "Signature": the whole brand sweep, honeydew and blue haze over pink, orange, red.
  brand: {
    base: [[0, "#fdeef3"], [0.32, "#ffc1d6"], [0.56, "#ff8a5c"], [0.8, "#f2361c"], [1, "#4a0a08"]],
    blobs: [[0.14, 0.1, 0.4, "#cfdcff"], [0.86, 0.3, 0.34, "#ff8fb8"], [0.2, 0.62, 0.32, "#ff7a3c"], [0.8, 0.82, 0.34, "#ff2a12"], [0.46, 1.02, 0.4, "#3a0606"]],
  },
};

export const GRAIN_KINDS = Object.keys(PALETTES) as GrainKind[];

export type GrainSpec = {
  kind: GrainKind;
  /** Draw the kind's white line motif. */
  lines: boolean;
  /** A CSS colour for the canvas until it paints: the palette's middle tone. */
  fallback: string;
  /** Seeds the field nudges, the light's tilt, the motif's placement and the grain. */
  seed: number;
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // FNV alone leaves similar seeds ("kit-a", "kit-b") sharing low bits; mix them so stages spread.
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

/** Stable recipe for a seed on a kind of stage. */
export function grainSpec(seed: string, kind: GrainKind = "brand", lines = true): GrainSpec {
  const base = PALETTES[kind].base;
  const mid = base[Math.floor(base.length / 2)];
  return { kind, lines, fallback: mid ? mid[1] : "#888", seed: hash(`${kind}:${seed}`) };
}

/* ---------- colour (mixed in linear light: smooth, and it never leaves the gamut) ---------- */

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
  return [srgbToLin((n >> 16) & 255), srgbToLin((n >> 8) & 255), srgbToLin(n & 255)];
}

function fromLab(L: number, A: number, B: number, out: number[]) {
  out[0] = linToSrgb(L);
  out[1] = linToSrgb(A);
  out[2] = linToSrgb(B);
}

const LABS = new Map<GrainKind, { base: Array<[number, Lab]>; blobs: Array<[number, number, number, Lab]> }>();
function labs(kind: GrainKind) {
  let f = LABS.get(kind);
  if (!f) {
    const src = PALETTES[kind];
    f = { base: src.base.map(([t, c]) => [t, toLab(c)]), blobs: src.blobs.map(([x, y, r, c]) => [x, y, r, toLab(c)]) };
    LABS.set(kind, f);
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
  // Read back once for the grain; a CPU-backed canvas makes that cheap.
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) return;

  const r = rng(spec.seed);
  const f = labs(spec.kind);
  // The seed's own take on the palette: the composition maybe mirrored, every field nudged and
  // resized, the light tilted a little off vertical, the warp phased.
  const mirror = r() < 0.5;
  const blobs = f.blobs.map(([x, y, rad, c]) => [(mirror ? 1 - x : x) + (r() - 0.5) * 0.24, y + (r() - 0.5) * 0.12, rad * (0.85 + r() * 0.3), c] as const);
  const tilt = (r() - 0.5) * 0.4;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
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
      // Light falls along the tilted vertical.
      const v = 0.5 + (wy - 0.5) * cos + (wx - 0.5) * sin;
      let k = 0;
      while (k < base.length - 2 && v > (base[k + 1]?.[0] ?? 1)) k++;
      const a = base[k];
      const b = base[k + 1] ?? a;
      if (!a || !b) continue;
      let t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
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
      fromLab(L, A, B, rgb);
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

  // 3. The kind's line motif.
  if (spec.lines) {
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 0.75 * dpr;
    ctx.lineJoin = "round";
    MOTIFS[spec.kind](ctx, W, H, dpr, r);
    ctx.restore();
  }
}

type Motif = (ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, r: () => number) => void;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

const MOTIFS: Record<GrainKind, Motif> = {
  /** Screens: phone outlines nested outward from a point, like a device echoing into the ground. */
  screen(ctx, W, H, _dpr, r) {
    const U = Math.max(W, H);
    const cx = W * (0.36 + r() * 0.28);
    const cy = H * (0.45 + r() * 0.25);
    const step = U * (0.05 + r() * 0.015);
    for (let k = 2; k < 16; k++) {
      const h = step * k * 1.6;
      const w = h * 0.49;
      ctx.globalAlpha = 0.34 * (1 - k / 16);
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, w * 0.24);
      ctx.stroke();
    }
  },

  /** Flows: a ribbon of threads that twists across the stage, one step leading to the next. */
  flow(ctx, W, H, _dpr, r) {
    const n = 26;
    const y0 = H * (0.75 + r() * 0.25);
    const y1 = H * (0.05 + r() * 0.25);
    const bend = H * (r() - 0.5) * 0.5;
    const span = Math.min(W, H) * (0.7 + r() * 0.3);
    const twist = Math.PI * (0.9 + r() * 0.8);
    const phase = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const o = i / (n - 1) - 0.5;
      ctx.globalAlpha = 0.14 + 0.2 * (1 - Math.abs(o) * 2);
      ctx.beginPath();
      for (let s = 0; s <= 90; s++) {
        const t = s / 90;
        const x = -0.1 * W + t * 1.2 * W;
        const yc = y0 + (y1 - y0) * t + bend * Math.sin(t * Math.PI);
        const off = o * span * (0.58 + 0.42 * Math.cos(t * twist + phase)) * (0.55 + 0.45 * Math.sin(t * Math.PI));
        const y = yc + off;
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  },

  /** Templates: a home screen's icon grid, fading out from a bright spot. */
  template(ctx, W, H, _dpr, r) {
    const U = Math.max(W, H);
    const pitch = U / (8 + Math.floor(r() * 4));
    const size = pitch * 0.62;
    const ox = r() * pitch;
    const oy = r() * pitch;
    const fx = W * (0.3 + r() * 0.4);
    const fy = H * (0.3 + r() * 0.4);
    const reach = U * 0.75;
    for (let y = oy - pitch; y < H + pitch; y += pitch) {
      for (let x = ox - pitch; x < W + pitch; x += pitch) {
        const dist = Math.hypot(x - fx, y - fy);
        const a = 0.42 * clamp01(1 - dist / reach);
        if (a < 0.03) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, size * 0.24);
        ctx.stroke();
      }
    }
  },

  /** Build Kit: orbits from a corner, broken into arcs, with nodes riding them, like an agent's loop. */
  kit(ctx, W, H, dpr, r) {
    const U = Math.max(W, H);
    const cx = r() < 0.5 ? W * (0.02 + r() * 0.1) : W * (0.88 + r() * 0.1);
    const cy = H * (0.9 + r() * 0.12);
    const step = U * (0.032 + r() * 0.01);
    for (let k = 1; k < 40; k++) {
      const R = step * k;
      const dash = R * (0.3 + r() * 0.5);
      const gap = R * (0.04 + r() * 0.12);
      ctx.globalAlpha = 0.22 + Math.min(0.18, k * 0.008);
      ctx.setLineDash([dash, gap]);
      ctx.lineDashOffset = r() * (dash + gap);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      if (r() < 0.45) {
        const a = r() * Math.PI * 2;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
  },

  /** Blocks: columns of stacked sections, a page's layout drawn in outline, fading out from a bright spot. */
  block(ctx, W, H, _dpr, r) {
    const U = Math.max(W, H);
    const cols = 5 + Math.floor(r() * 3);
    const pitch = (W * 1.2) / cols;
    const colW = pitch * 0.8;
    const gap = pitch * 0.12;
    const ox = -W * 0.1 + (pitch - colW) / 2;
    const fx = W * (0.3 + r() * 0.4);
    const fy = H * (0.3 + r() * 0.4);
    const reach = U * 0.8;
    for (let c = 0; c < cols; c++) {
      const x = ox + c * pitch;
      let y = -r() * pitch;
      while (y < H) {
        const h = pitch * (0.35 + r() * 1.1);
        const cy = y + h / 2;
        const a = 0.42 * clamp01(1 - Math.hypot(x + colW / 2 - fx, cy - fy) / reach);
        if (a >= 0.03) {
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.roundRect(x, y, colW, h, Math.min(colW, h) * 0.18);
          ctx.stroke();
        }
        y += h + gap;
      }
    }
  },

  /** Everything else: parallel beams on a slant, gathered into a few soft bands of light. */
  brand(ctx, W, H, _dpr, r) {
    const U = Math.max(W, H);
    const angle = -Math.PI / 3 + (r() - 0.5) * 0.5;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const gap = U / (44 + r() * 16);
    const freq = 2 + r() * 2;
    const phase = r() * Math.PI * 2;
    const reach = Math.hypot(W, H);
    const n = Math.ceil(reach / gap);
    for (let i = -n; i <= n; i++) {
      const o = i * gap;
      const band = Math.max(0, Math.sin((o / reach) * Math.PI * freq + phase));
      const a = 0.36 * band * band;
      if (a < 0.03) continue;
      const px = W / 2 + nx * o;
      const py = H / 2 + ny * o;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(px - dx * reach, py - dy * reach);
      ctx.lineTo(px + dx * reach, py + dy * reach);
      ctx.stroke();
    }
  },
};
