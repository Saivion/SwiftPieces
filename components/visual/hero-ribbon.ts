/**
 * The hero ribbon's drawing, with no DOM or React in it, so the same code runs in a worker on an
 * OffscreenCanvas (hero-lines.worker.ts) and, where a browser can't hand a canvas to a worker, on the
 * page itself (hero-lines.tsx). See hero-lines.tsx for what the ribbon is.
 */

type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;

/** The brand's palette, in the order it runs across the ribbon: orange, red, pink, blue. */
const STOPS: RGB[] = [
  [255, 122, 60],
  [255, 0, 0],
  [255, 143, 184],
  [77, 141, 255],
];

const LINES = 44;
const STEPS = 112;
/** Half the length of a surge along its line, as a fraction of the line. */
const SURGE = 0.11;
/** The entrance: every line draws itself across the screen, left to right, over this long. */
const INTRO_MS = 1800;
/** Length of the bright tip that leads each line while it draws, as a fraction of the line. */
const PEN = 0.07;
/**
 * The aura's strength, 0..1: a haze in the ribbon's own colours behind the threads, which glows on
 * the dark theme and tints the light one. Chosen at 0.6 in the ribbon studio (2026-10-21), then
 * eased to 0.35 the same day, when it read as a shadow behind the threads. Off since 2026-10-24
 * (Saivion: "just keep lines"); the ribbon is the threads alone.
 */
const AURA = 0;
/**
 * The aura is drawn this much smaller than the hero, on its own canvas behind the threads, blurred
 * there and scaled up by the browser: soft, and it never costs a full-size paint.
 */
const AURA_SCALE = 1 / 6;
/** Silk: the points along each thread where its depth, sheen and colour are sampled into its gradient. */
const RUNS = 8;
/**
 * The ribbon draws at most this often, in ms (60 a second). It is slow ambient motion, and on a 120 Hz
 * display drawing every refresh doubled its cost for nothing anyone can see.
 */
const FRAME_MS = 1000 / 60 - 2;
/** Colours along the palette, looked up per run instead of built per frame. */
const LUT = 256;
/**
 * How far the clearing behind the copy reaches, in its own radii: its gradient is fully clear from
 * 0.78 out, so it is filled only that far instead of across the whole canvas every frame.
 */
const VEIL_REACH = 0.78;
/** The clearing behind the copy (left, upper middle): an ellipse's centre and radii, as shares of the canvas. */
const VEIL = { x: 0.2, y: 0.36, rx: 0.62, ry: 0.58 };

function palette(t: number): RGB {
  const x = Math.min(0.9999, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const k = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const lift = (c: RGB, k: number): RGB => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];
const triple = (c: RGB) => `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
/** 0..1..0..1 as x runs on, so colour drifting past the palette's end turns back instead of jumping. */
const pingpong = (x: number) => {
  const m = ((x % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
};

/** A canvas to draw into off screen (the aura's strokes): an OffscreenCanvas where there is one, else a detached canvas. */
function scratch(): { canvas: Surface; ctx: Ctx } | null {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
  }
  return null;
}

/** What the page tells hero-lines.worker.ts. */
export type RibbonMessage =
  | { type: "init"; canvas: OffscreenCanvas; glow: OffscreenCanvas; reduced: boolean; dark: boolean; w: number; h: number; dpr: number }
  | { type: "resize"; w: number; h: number; dpr: number }
  | { type: "visible"; visible: boolean }
  | { type: "tone"; dark: boolean };

export type Ribbon = {
  /** The canvas's CSS size and the device pixel ratio to draw it at. */
  resize: (w: number, h: number, dpr: number) => void;
  /** Draws the frame for `now` (a performance.now() time) if one is due, and says whether to ask for another. */
  frame: (now: number) => boolean;
  /** Draws the current moment again without advancing, after a resize or a theme change. */
  redraw: (now: number) => void;
  /** The site's theme: the aura adds light on dark and tints on light, and the fold's sheen follows. */
  setDark: (dark: boolean) => void;
};

/**
 * Sets up the ribbon: its threads on `canvas`, its aura on `glow` (a canvas behind it, which the browser
 * scales up). `reduced` (Reduce Motion) draws the finished ribbon once and never asks for another frame.
 */
export function createRibbon(canvas: Surface, ctx: Ctx, glow: Surface | null, glowCtx: Ctx | null, reduced: boolean, initialDark: boolean): Ribbon {
  let dark = initialDark;
  let w = 0;
  let h = 0;
  // The ribbon is laid out in a design frame at least 1.6 times as wide as it is tall, anchored to
  // the right edge. On a wide screen that is the canvas itself; on a phone the canvas is narrow and
  // tall, and stretching the ribbon across it made it climb almost straight up in a tight bundle.
  // Instead the phone shows the right-hand part of the same wide ribbon, at the same gentle angle.
  let dw = 0;
  let ox = 0;
  // Phones (canvas taller than it is wide): the climb stays in the lower half, beside and below the
  // copy rather than through the headline. The threads fan out wider there, and a little less so on desktop.
  let top = 0.02;
  let spread = 1;
  let origin = 0;
  let born = 0;
  let last = 0;
  let drawn = 0;
  let veil: CanvasGradient | string = "transparent";
  let glowVeil: CanvasGradient | string = "transparent";

  // Each line's surge runs at its own pace from its own start, so the light never marches in step.
  const speed = Array.from({ length: LINES }, (_, i) => 0.055 + ((i * 37) % 11) * 0.006);
  const seed = Array.from({ length: LINES }, (_, i) => ((i * 53) % LINES) / LINES);
  // Colours built once along the palette, not per frame: the thread, the fold's sheen, and the surge
  // (lifted toward white). A thread looks its colour up by where along it a sample sits (`hue`).
  const base: string[] = [];
  const baseRGB: RGB[] = [];
  const sheenRGB: RGB[] = [];
  const litRGB: string[] = [];
  for (let k = 0; k < LUT; k++) {
    const c = palette(k / (LUT - 1));
    base.push(`rgb(${triple(c)})`);
    baseRGB.push(c);
    sheenRGB.push(lift(c, 0.7));
    litRGB.push(triple(lift(c, 0.35)));
  }
  /** The colour of thread `i` at fraction `s` along it, at time `t`: its place in the palette, drifting up the ribbon. */
  const hue = (i: number, s: number, t: number) => Math.round(pingpong(i / (LINES - 1) + s * 0.32 + t * 0.018) * (LUT - 1));
  const xs = new Float32Array(STEPS);
  const ys = new Float32Array(STEPS);
  // Per point of the last line traced: how far it faces the viewer (-1 back .. 1 front), and the
  // twist's cosine (near 0 where the ribbon turns edge-on, which is where the sheen sits).
  const zs = new Float32Array(STEPS);
  const cs = new Float32Array(STEPS);
  // The aura's strokes go into `aura`, then blur onto `glow`, the visible low-resolution canvas.
  const aura = glow && glowCtx ? scratch() : null;
  const canBlur = glowCtx ? typeof glowCtx.filter === "string" : false;

  const clearing = () => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.3, "rgba(0,0,0,1)");
    g.addColorStop(0.78, "rgba(0,0,0,0)");
    return g;
  };

  const resize = (cssW: number, cssH: number, deviceRatio: number) => {
    // Full screen density, so hairlines stay razor-sharp on Retina and 4K displays, capped at about
    // one 4K frame of pixels (8.3M) so a very large window never costs more than a 4K screen does.
    const MAX_PIXELS = 3840 * 2160;
    let dpr = Math.min(3, deviceRatio || 1);
    const cssPixels = Math.max(1, cssW * cssH);
    if (cssPixels * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / cssPixels);
    w = cssW;
    h = cssH;
    dw = Math.max(w, h * 1.6);
    ox = w - dw;
    const narrow = w < h;
    top = narrow ? 0.44 : 0.02;
    spread = narrow ? 2.3 : 2.4;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Clear behind the copy, easing back to the full ribbon further out: 62% of the width across,
    // 58% of the height tall.
    veil = clearing();
    if (aura && glow && glowCtx) {
      aura.canvas.width = glow.width = Math.max(1, Math.round(w * AURA_SCALE));
      aura.canvas.height = glow.height = Math.max(1, Math.round(h * AURA_SCALE));
      glowVeil = glowCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
      glowVeil.addColorStop(0, "rgba(0,0,0,1)");
      glowVeil.addColorStop(0.3, "rgba(0,0,0,1)");
      glowVeil.addColorStop(0.78, "rgba(0,0,0,0)");
    }
  };

  /** One line of the ribbon at time `t` (seconds), into xs/ys. `u` runs -0.5..0.5 across the ribbon. */
  const trace = (u: number, t: number) => {
    for (let k = 0; k < STEPS; k++) {
      const s = k / (STEPS - 1);
      // Centreline: low along the bottom under the copy, then a long rise up the right, out past the top.
      const cx = ox - 0.08 * dw + s * 1.16 * dw;
      const cy = h * (1.02 - (1.02 - top) * smooth(0.34, 1.0, s)) + Math.sin(s * Math.PI) * h * 0.04;
      // Wide where it enters, pinched where it turns, opening again as it leaves.
      const width = spread * h * (0.72 * Math.pow(1 - s, 1.7) + 0.07 + 0.36 * Math.pow(Math.max(0, s - 0.6), 1.3));
      const twist = s * Math.PI * 1.7 + t * 0.22 + u * 0.5;
      const c = Math.cos(twist);
      const off = u * width * c;
      xs[k] = cx - off * 0.35;
      ys[k] = cy + off;
      cs[k] = c;
      zs[k] = u * Math.sin(twist) * 2;
    }
  };

  /** A point at fraction `f` (0..1) along the line last traced, between its sample points. */
  const at = (f: number): [number, number] => {
    const x = f * (STEPS - 1);
    const k = Math.min(STEPS - 2, Math.floor(x));
    const r = x - k;
    return [xs[k] + (xs[k + 1] - xs[k]) * r, ys[k] + (ys[k + 1] - ys[k]) * r];
  };

  /**
   * Stroke a stretch of the line last traced, from fraction `from` to `to`, at exact positions, on `c`
   * with its coordinates scaled by `scale` (the aura's smaller canvas).
   */
  const strokeOn = (c: Ctx, from: number, to: number, scale = 1) => {
    const [fx, fy] = at(from);
    const [tx, ty] = at(to);
    c.beginPath();
    c.moveTo(fx * scale, fy * scale);
    const k0 = Math.ceil(from * (STEPS - 1));
    const k1 = Math.floor(to * (STEPS - 1));
    for (let k = k0; k <= k1; k++) c.lineTo(xs[k] * scale, ys[k] * scale);
    c.lineTo(tx * scale, ty * scale);
    c.stroke();
    return [fx, fy, tx, ty] as const;
  };
  const stroke = (from: number, to: number) => strokeOn(ctx, from, to);

  /** A gradient along a stretch, fading from `a0` at its start to `a1` at its end. */
  const fade = (k: number, fx: number, fy: number, tx: number, ty: number, a0: number, a1: number, mid = (a0 + a1) / 2) => {
    const g = ctx.createLinearGradient(fx, fy, tx, ty);
    g.addColorStop(0, `rgba(${litRGB[k]},${a0.toFixed(3)})`);
    g.addColorStop(0.5, `rgba(${litRGB[k]},${mid.toFixed(3)})`);
    g.addColorStop(1, `rgba(${litRGB[k]},${a1.toFixed(3)})`);
    return g;
  };

  // How far each line has drawn itself in, 0..1, `p` being the entrance's progress. The middle of the
  // ribbon starts first and the edges follow, each line a little staggered, so the ribbon grows out of
  // its own centre rather than wiping on as a block.
  const delay = Array.from({ length: LINES }, (_, i) => Math.abs(i / (LINES - 1) - 0.5) * 0.5 + ((i * 37) % 11) * 0.006);
  const reveal = (i: number, p: number) => {
    const x = Math.min(1, Math.max(0, (p - delay[i]) / 0.7));
    return 1 - Math.pow(1 - x, 3);
  };

  /**
   * The aura: every fourth thread stroked wide into a canvas a sixth of the size, blurred onto the glow
   * canvas behind the threads, which the browser scales up. Overlapping strokes add light on the dark
   * theme and layer as a soft tint on the light one. Cleared behind the copy like the threads.
   */
  const drawAura = (t: number, p: number) => {
    if (!aura || !glow || !glowCtx || AURA <= 0) return;
    const a = aura.ctx;
    a.globalCompositeOperation = "source-over";
    a.globalAlpha = 1;
    a.clearRect(0, 0, aura.canvas.width, aura.canvas.height);
    a.lineCap = "round";
    a.lineJoin = "round";
    a.globalCompositeOperation = dark ? "lighter" : "source-over";
    a.globalAlpha = (dark ? 0.16 : 0.11) * AURA;
    a.lineWidth = Math.max(2, h * AURA_SCALE * 0.085);
    for (let i = 0; i < LINES; i += 4) {
      const r = reveal(i, p);
      if (r < 0.01) continue;
      trace(i / (LINES - 1) - 0.5, t);
      for (let j = 0; j < 4; j++) {
        const from = (j / 4) * r;
        const to = ((j + 1) / 4) * r;
        a.strokeStyle = base[hue(i, (from + to) / 2, t)];
        strokeOn(a, from, to, AURA_SCALE);
      }
    }
    glowCtx.globalCompositeOperation = "source-over";
    glowCtx.clearRect(0, 0, glow.width, glow.height);
    if (canBlur) glowCtx.filter = `blur(${Math.max(2, h * AURA_SCALE * 0.05).toFixed(1)}px)`;
    glowCtx.drawImage(aura.canvas, 0, 0);
    if (canBlur) glowCtx.filter = "none";
    glowCtx.globalCompositeOperation = "destination-out";
    glowCtx.save();
    glowCtx.translate(w * VEIL.x * AURA_SCALE, h * VEIL.y * AURA_SCALE);
    glowCtx.scale(w * VEIL.rx * AURA_SCALE, h * VEIL.ry * AURA_SCALE);
    glowCtx.fillStyle = glowVeil;
    glowCtx.fillRect(-VEIL_REACH, -VEIL_REACH, VEIL_REACH * 2, VEIL_REACH * 2);
    glowCtx.restore();
    glowCtx.globalCompositeOperation = "source-over";
  };

  /**
   * Thread `i`'s silk: one gradient for the whole thread, sampled at RUNS + 1 points along it. Where it
   * faces the viewer it is brighter, where it turns away it fades back, and where the ribbon turns
   * edge-on it catches a sheen; its colour drifts up it. The gradient runs across the screen, which
   * the threads always cross left to right, so each sample's stop is where it falls along that run.
   * One stroke a thread, as before the silk, rather than a stroke for every stretch.
   */
  const silk = (i: number, r: number, t: number) => {
    const x0 = at(0)[0];
    const span = Math.max(1, at(r)[0] - x0);
    const g = ctx.createLinearGradient(x0, 0, x0 + span, 0);
    let stop = 0;
    for (let j = 0; j <= RUNS; j++) {
      const f = (j / RUNS) * r;
      const km = Math.min(STEPS - 1, Math.round(f * (STEPS - 1)));
      const front = (zs[km] + 1) / 2;
      const fold = Math.pow(1 - Math.abs(cs[km]), 7);
      const k = hue(i, f, t);
      const b = baseRGB[k];
      const sh = sheenRGB[k];
      const m = Math.min(1, fold * 1.2);
      const alpha = Math.min(1, 0.24 * (0.3 + 1.25 * front) + fold * (dark ? 0.4 : 0.32));
      stop = Math.min(1, Math.max(stop, (at(f)[0] - x0) / span));
      g.addColorStop(stop, `rgba(${(b[0] + (sh[0] - b[0]) * m) | 0},${(b[1] + (sh[1] - b[1]) * m) | 0},${(b[2] + (sh[2] - b[2]) * m) | 0},${alpha.toFixed(3)})`);
    }
    return g;
  };

  // The aura is slow and blurred and its canvas keeps its last picture, so after the entrance it is
  // redrawn on every other frame. A still redraw (resize, theme) always draws it.
  const draw = (t: number, p: number, auraToo = true) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    if (auraToo || p < 1 || drawn % 2 === 0) drawAura(t, p);
    drawn++;
    for (let i = 0; i < LINES; i++) {
      const r = reveal(i, p);
      if (r < 0.002) continue;
      const u = i / (LINES - 1) - 0.5;
      trace(u, t);

      // The thread itself, as far as it has grown: faint, so the ribbon reads as a whole.
      ctx.strokeStyle = silk(i, r, t);
      ctx.lineWidth = 1;
      stroke(0, r);

      // While it grows, a bright tip leads the line: the line being drawn, not wiped in.
      if (r < 1) {
        const from = Math.max(0, r - PEN);
        const [fx, fy] = at(from);
        const [tx, ty] = at(r);
        ctx.strokeStyle = fade(hue(i, r, t), fx, fy, tx, ty, 0, 0.9 * (1 - r * r), 0.35 * (1 - r * r));
        ctx.lineWidth = 1.25;
        stroke(from, r);
      }

      // The surge: a short run of light travelling up the line, brightest at its head, only on the part
      // already drawn. Its ends sit at exact fractions along the curve rather than snapping to the
      // sample points (~20px apart on a wide screen), so the light glides instead of stepping.
      const head = ((seed[i] + t * speed[i]) % 1.4) - 0.2;
      const tail = head - SURGE * 2;
      const from = Math.max(0, tail);
      const to = Math.min(r, head);
      if (to - from < 0.002) continue;
      const [fx, fy] = at(from);
      const [tx, ty] = at(to);
      // Alpha along the surge, squared toward the tail, so a surge entering or leaving fades.
      const alpha = (f: number) => Math.pow(Math.min(1, Math.max(0, (f - tail) / (SURGE * 2))), 2) * 0.95;
      ctx.strokeStyle = fade(hue(i, to, t), fx, fy, tx, ty, alpha(from), alpha(to), alpha((from + to) / 2));
      ctx.lineWidth = 1.25;
      stroke(from, to);
    }

    // Fade the ribbon out behind the copy, drawn into the canvas: a CSS mask on a full-size canvas is
    // re-composited every frame, which is where the motion felt heavy.
    ctx.globalCompositeOperation = "destination-out";
    ctx.save();
    ctx.translate(w * VEIL.x, h * VEIL.y);
    ctx.scale(w * VEIL.rx, h * VEIL.ry);
    ctx.fillStyle = veil;
    ctx.fillRect(-VEIL_REACH, -VEIL_REACH, VEIL_REACH * 2, VEIL_REACH * 2);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  };

  const progress = (now: number) => (reduced ? 1 : Math.min(1.2, (now - born) / INTRO_MS));

  return {
    resize,
    frame: (now) => {
      // The twist starts twelve seconds in, the composition the ribbon was tuned at.
      if (!born) {
        born = now;
        origin = now - 12000;
      }
      if (now - last >= FRAME_MS) {
        last = now;
        draw((now - origin) / 1000, progress(now), false);
      }
      return !reduced;
    },
    redraw: (now) => {
      if (born) draw((now - origin) / 1000, progress(now));
    },
    setDark: (d) => {
      dark = d;
    },
  };
}
