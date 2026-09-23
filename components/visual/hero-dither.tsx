"use client";
import { useEffect, useRef } from "react";

/** Official Swift bird, extracted from the language mark (viewBox 0 0 59.39 59.39). */
const SWIFT_BIRD =
  "M47.0606,36.6607c0.0657-0.2236,0.1335-0.4458,0.191-0.675c2.465-9.8209-3.5511-21.4319-13.7316-27.5454c4.4613,6.0479,6.4339,13.3733,4.6813,19.7795c-0.1563,0.5714-0.3442,1.1198-0.5519,1.6528c-0.2254-0.1481-0.5094-0.3162-0.8908-0.5265c0,0-10.1269-6.2527-21.1028-17.3122c-0.288-0.2903,5.8528,8.777,12.8219,16.1399c-3.2834-1.8427-12.4338-8.5004-18.2266-13.8023c0.7117,1.1869,1.5582,2.3298,2.4887,3.4301c4.8375,6.1349,11.1462,13.7044,18.7043,19.5169c-5.3104,3.2498-12.8141,3.5025-20.2852,0.0034c-1.8479-0.866-3.5851-1.9109-5.1932-3.0981c3.1625,5.0585,8.0332,9.4229,13.9613,11.9708c7.0695,3.0381,14.0996,2.8321,19.3356,0.0498c0.215-0.1156,0.4284-0.2333,0.6371-0.3576c2.5157-1.3058,7.4847-2.6306,10.1518,2.5588C50.7755,49.6699,52.1635,42.9395,47.0606,36.6607z";

const VB = 59.39;

function chamferDistance(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x + 1 < w) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let v = d[i];
      if (x + 1 < w) v = Math.min(v, d[i + 1] + 3);
      if (y + 1 < h) {
        v = Math.min(v, d[i + w] + 3);
        if (x + 1 < w) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) if (mask[i]) d[i] /= 3;
  return d;
}

function buildHeight(dist: Float32Array, mask: Uint8Array): Float32Array {
  let maxD = 1;
  for (let i = 0; i < dist.length; i++) if (mask[i] && dist[i] > maxD) maxD = dist[i];
  const height = new Float32Array(dist.length);
  const R = maxD;
  for (let i = 0; i < dist.length; i++) {
    if (!mask[i]) continue;
    const t = dist[i];
    height[i] = Math.sqrt(Math.max(0, 2 * R * t - t * t)) / R;
  }
  return height;
}

function sample(field: Float32Array, w: number, h: number, x: number, y: number): number {
  const px = Math.min(w - 1.001, Math.max(0, x));
  const py = Math.min(h - 1.001, Math.max(0, y));
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const tx = px - x0;
  const ty = py - y0;
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const a = field[y0 * w + x0];
  const b = field[y0 * w + x1];
  const c = field[y1 * w + x0];
  const d = field[y1 * w + x1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function rasterizeBird(size: number): { height: Float32Array; w: number; h: number } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size * 0.48, size * 0.4);
  ctx.rotate((-6 * Math.PI) / 180);
  const scale = (size * 0.9) / VB;
  ctx.scale(scale, scale);
  ctx.translate(-VB / 2, -VB / 2);
  const path = new Path2D(SWIFT_BIRD);
  ctx.fillStyle = "#fff";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 2.8;
  ctx.stroke(path);
  ctx.fill(path);

  const pixels = ctx.getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3] > 40 ? 1 : 0;
  const dist = chamferDistance(mask, size, size);
  return { height: buildHeight(dist, mask), w: size, h: size };
}

type RGB = [number, number, number];

/**
 * The homepage dither stages' palette (`ACCENT_DITHER` in get-started.tsx, in paint order):
 * orange → red wash, a pink ribbon, a blue bloom. Same field recipe as `DitherStage`, but mixed in
 * sRGB with a saturation lift: the stages mix in linear light, which reads right across a large
 * panel but goes pastel on small dots against black.
 */
const ORANGE: RGB = [255, 122, 60];
const RED: RGB = [255, 0, 0];
const PINK: RGB = [255, 143, 184];
const BLUE: RGB = [77, 141, 255];
const HONEYDEW: RGB = [255, 228, 239];

function mix(a: RGB, b: RGB, t: number): RGB {
  const u = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const ANGLE = (-38 * Math.PI) / 180;
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);
const TAU = Math.PI * 2;

/**
 * DitherStage's field over the bird's box (nx, ny in 0..1): a warped two-colour wash and a corner
 * bloom. `phase` drifts so the colours slide over the mark. No ribbon: a narrow band drifting with
 * the phase read as a line sweeping across the mark.
 */
function fieldColor(nx: number, ny: number, phase: number): RGB {
  const u = (nx - 0.5) * COS + (ny - 0.5) * SIN;
  const v = -(nx - 0.5) * SIN + (ny - 0.5) * COS;
  const wv = v + 0.3 * 0.55 * Math.cos((u + 0.5) * TAU * 0.9 + phase * 0.7);
  const wash = mix(ORANGE, RED, smooth(wv / 0.7 + 0.5));
  const dx = nx - (0.5 + 0.36 * COS);
  const dy = ny - (0.5 + 0.36 * SIN);
  const bloom = Math.exp(-(dx * dx + dy * dy) / (2 * 0.2 * 0.2));
  return mix(wash, BLUE, bloom);
}

/** Pushes a colour away from its own grey, then clamps to a byte. */
function saturate(c: RGB, k: number): RGB {
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map((v) => Math.round(Math.min(255, Math.max(0, y + (v - y) * k)))) as RGB;
}

/** Halftone 3D Swift bird for the free homepage hero. */
export function HeroDither() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    let field: { height: Float32Array; w: number; h: number } | null = null;
    const pointer = { x: 0.62, y: 0.32, tx: 0.62, ty: 0.32 };
    let t = 0;

    const rebuild = () => {
      const nextW = Math.round(canvas.clientWidth);
      const nextH = Math.round(canvas.clientHeight);
      if (nextW < 8 || nextH < 8) return;
      if (nextW === w && nextH === h && field) return;
      w = nextW;
      h = nextH;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hm = Math.min(420, Math.max(220, Math.round(Math.min(w, h) * 0.7)));
      field = rasterizeBird(hm);
      // Paint the new size straight away: the animation loop is throttled in a hidden tab, so
      // without this the mark stays blank until the tab is looked at again.
      paint(reduced ? 0 : performance.now());
    };

    const paint = (time: number) => {
      if (!running || !field) return;
      t = time * 0.00022;
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      const lx = reduced ? 0.48 : 0.42 + Math.sin(t) * 0.2 + (pointer.x - 0.5) * 0.55;
      const ly = reduced ? -0.62 : -0.58 + Math.cos(t * 0.85) * 0.1 + (pointer.y - 0.5) * 0.45;
      const lz = 0.62;
      const llen = Math.hypot(lx, ly, lz) || 1;
      const Lx = lx / llen;
      const Ly = ly / llen;
      const Lz = lz / llen;
      // Blinn half-vector between the light and the viewer (0, 0, 1), normalised as a whole so
      // N·H never passes 1 and the high gloss powers stay a small hot spot.
      const hlen = Math.hypot(Lx, Ly, Lz + 1);
      const Hx = Lx / hlen;
      const Hy = Ly / hlen;
      const Hz = (Lz + 1) / hlen;

      ctx.clearRect(0, 0, w, h);
      const gap = w < 420 ? 6.2 : 5.2;
      const maxR = gap * 0.54;
      const hm = field;
      const dim = Math.min(w, h);
      const ox = Math.max(0, w - dim - Math.round(dim * 0.08));
      const oy = -Math.round(dim * 0.05);
      const sx = (hm.w - 1) / dim;
      const sy = (hm.h - 1) / dim;

      for (let y = gap * 0.5; y < h; y += gap) {
        for (let x = gap * 0.5; x < w; x += gap) {
          const fx = (x - ox) * sx;
          const fy = (y - oy) * sy;
          if (fx < -1 || fy < -1 || fx > hm.w || fy > hm.h) continue;
          const z = sample(hm.height, hm.w, hm.h, fx, fy);
          if (z < 0.02) continue;

          const zl = sample(hm.height, hm.w, hm.h, fx - 1.2, fy);
          const zr = sample(hm.height, hm.w, hm.h, fx + 1.2, fy);
          const zu = sample(hm.height, hm.w, hm.h, fx, fy - 1.2);
          const zd = sample(hm.height, hm.w, hm.h, fx, fy + 1.2);
          let nx = (zl - zr) * 3.4;
          let ny = (zu - zd) * 3.4;
          let nz = 1;
          const nn = Math.hypot(nx, ny, nz) || 1;
          nx /= nn;
          ny /= nn;
          nz /= nn;

          const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
          const nh = Math.max(0, nx * Hx + ny * Hy + nz * Hz);
          const spec = Math.pow(nh, 34);
          // Gloss: a tight hot spot on a broad sheen, plus a rim where the surface turns away.
          // No sweeping glint across the mark.
          const gloss = Math.pow(nh, 80);
          const sheen = Math.pow(nh, 14);
          const rim = Math.min(1, Math.pow(1 - nz, 2.4) * Math.max(0, 0.35 - (nx * Lx + ny * Ly)) * 2);
          const lum = Math.min(1, 0.1 + diff * 0.95 + spec * 0.7 + gloss * 0.5 + rim * 0.6);
          if (lum < 0.06) continue;

          const left = Math.min(1, Math.max(0, (x - w * 0.02) / (w * 0.12)));
          const bottom = Math.min(1, Math.max(0, (h * 0.8 - y) / (h * 0.2)));
          const edge = left * bottom;
          const r = Math.pow(lum, 0.82) * maxR * edge;
          if (r < 0.32) continue;

          // Colour comes from the dither field; light only sets how bright it burns, so the hue
          // survives into the shadows instead of washing out to white.
          let color = fieldColor((x - ox) / dim, (y - oy) / dim, reduced ? 1.2 : 1.2 + t * 2.4);
          // Deeper shadows than a matte fill, so the highlights read as a lacquered surface.
          const shade = 0.58 + diff * 0.42;
          // Screen the sheen over the hue (brightens without greying), then re-saturate so the lift
          // stays coloured; the hot spot below is the only part that goes to white.
          const lift = Math.min(0.45, sheen * 0.32 + rim * 0.2);
          color = saturate(
            [
              255 - (255 - color[0] * shade) * (1 - lift),
              255 - (255 - color[1] * shade) * (1 - lift),
              255 - (255 - color[2] * shade) * (1 - lift),
            ],
            1.45,
          );
          const white = Math.min(0.92, gloss * 1.25 + spec * 0.35);
          if (white > 0) color = mix(color, HONEYDEW, white);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${color[0] | 0},${color[1] | 0},${color[2] | 0})`;
          ctx.fill();
        }
      }

      if (!reduced) raf = requestAnimationFrame(paint);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.ty = (e.clientY - rect.top) / Math.max(1, rect.height);
    };

    rebuild();
    paint(0);
    if (!reduced) raf = requestAnimationFrame(paint);

    const ro = new ResizeObserver(rebuild);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-12 right-0 z-0 hidden h-[640px] w-[58%] md:block lg:-top-16 lg:h-[740px] lg:w-[52%] xl:-top-20 xl:h-[840px] xl:w-[50%]"
    >
      <canvas ref={ref} className="h-full w-full" />
    </div>
  );
}
