"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Ported from SwiftPiecesPro (components/previews/dither-stage.tsx + lib/brand/dither.ts) so Free's
 * Pro page stands its cards on the exact grounds Pro's library cards use. Keep the two in step.
 */

/** The Pro pricing palette (Pro's `--pro-c1/c2/pink/c3` and `--pro-honeydew`). */
const STOPS = [0xffe4ef, 0xff0000, 0xff7a3c, 0xff8fb8, 0x4d8dff] as const;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lum(hex: number) {
  return 0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255);
}

const hexString = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Stable recipe: same warped-ribbon field, recolored and rotated per seed. */
function ditherSpec(seed: string, palette?: readonly string[]) {
  const n = hash(seed);
  const start = n % STOPS.length;
  const picked = palette?.length === 4 ? palette.map((c) => Number.parseInt(c.slice(1), 16)) : [0, 1, 2, 3].map((i) => STOPS[(start + i) % STOPS.length]);
  if (!palette && n & 8) picked.reverse();
  return {
    colors: picked.map(hexString),
    fallback: hexString(picked.reduce((a, b) => (lum(a) > lum(b) ? a : b))),
    angle: (n >>> 4) % 360,
    phase: ((n >>> 12) % 628) / 100,
    amp: 0.22 + ((n >>> 22) % 16) / 100,
  };
}

const BAYER8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
].map((n) => (n + 0.5) / 64);

/** Fine mesh, like Grainient's ordered dither grid. */
const CELL = 3;
const LEVELS = 22;
const TAU = Math.PI * 2;

type RGB = [number, number, number];
type Lin = [number, number, number];

function parse(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function srgbToLin(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linToSrgb(x: number) {
  const y = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return clamp(y * 255);
}

function toLin(c: RGB): Lin {
  return [srgbToLin(c[0]), srgbToLin(c[1]), srgbToLin(c[2])];
}

function mixLin(a: Lin, b: Lin, t: number): Lin {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function quant(value: number, threshold: number) {
  const max = LEVELS - 1;
  const q = Math.min(max, Math.max(0, Math.floor((value / 255) * max + threshold)));
  return (q / max) * 255;
}

function field(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function smooth(t: number) {
  const x = field(t);
  return x * x * (3 - 2 * x);
}

/**
 * Grainient field: a two-color wash, one warped ribbon, one corner bloom.
 * Mixed in linear light, then Bayer-quantized. Same pattern on every stage.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: RGB[],
  angle: number,
  phase: number,
  amp: number,
) {
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const c0 = toLin(colors[0] ?? [255, 244, 234]);
  const c1 = toLin(colors[1] ?? [255, 154, 106]);
  const c2 = toLin(colors[2] ?? [58, 196, 255]);
  const c3 = toLin(colors[3] ?? [255, 225, 74]);
  const bloomX = 0.5 + 0.42 * cos;
  const bloomY = 0.5 + 0.42 * sin;

  for (let y = 0; y < h; y++) {
    const ny = h < 2 ? 0.5 : (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const nx = w < 2 ? 0.5 : (x + 0.5) / w;
      const u = (nx - 0.5) * cos + (ny - 0.5) * sin;
      const v = -(nx - 0.5) * sin + (ny - 0.5) * cos;
      const wu = u + amp * Math.sin((v + 0.5) * TAU * 1.35 + phase);
      const wv = v + amp * 0.55 * Math.cos((u + 0.5) * TAU * 0.9 + phase * 0.7);

      const wash = mixLin(c0, c1, smooth(wv / 0.9 + 0.5));
      const ribbon = Math.exp(-((wu - 0.02) * (wu - 0.02)) / (2 * 0.11 * 0.11));
      const withRibbon = mixLin(wash, c2, ribbon);
      const dx = nx - bloomX;
      const dy = ny - bloomY;
      const bloom = Math.exp(-(dx * dx + dy * dy) / (2 * 0.3 * 0.3));
      const rgb = mixLin(withRibbon, c3, bloom * 0.9);

      const bayer = BAYER8[(y & 7) * 8 + (x & 7)] ?? 0.5;
      const o = (y * w + x) * 4;
      px[o] = clamp(quant(linToSrgb(rgb[0]), bayer - 0.5));
      px[o + 1] = clamp(quant(linToSrgb(rgb[1]), bayer - 0.5));
      px[o + 2] = clamp(quant(linToSrgb(rgb[2]), bayer - 0.5));
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * `palette` overrides the seeded colours with four hex stops, in paint order: wash from, wash to,
 * ribbon, corner bloom. The seed still sets the angle and warp.
 */
export function DitherStage({ seed, palette, className }: { seed: string; palette?: readonly string[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = ditherSpec(seed, palette);
  const paletteKey = palette?.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const recipe = ditherSpec(seed, paletteKey?.split(","));
    const colors = recipe.colors.map(parse);
    let frame = 0;

    const draw = () => {
      frame = 0;
      const rect = parent.getBoundingClientRect();
      const cols = Math.max(1, Math.round(rect.width / CELL));
      const rows = Math.max(1, Math.round(rect.height / CELL));
      if (canvas.width !== cols) canvas.width = cols;
      if (canvas.height !== rows) canvas.height = rows;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) paint(ctx, cols, rows, colors, recipe.angle, recipe.phase, recipe.amp);
    };

    const onResize = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(parent);
    draw();
    return () => {
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [seed, paletteKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      style={{ background: spec.fallback, imageRendering: "pixelated" }}
    />
  );
}
