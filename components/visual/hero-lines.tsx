"use client";
import { useEffect, useRef } from "react";

type RGB = [number, number, number];

/** The brand's dither palette, in the order it runs across the ribbon: orange, red, pink, blue. */
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

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/**
 * The hero's ground: a ribbon of hairlines that rises from the bottom left and twists toward the top
 * right, with light surging along each line. Replaces the halftone Swift mark (hero-dither.tsx).
 *
 * The ribbon is a family of curves around one centreline. Each line sits at its own offset across the
 * ribbon's width, and that offset turns with a slow twist, so the lines cross over one another the
 * way a real ribbon of threads does. Colour runs across the ribbon in the brand's palette.
 *
 * Like the rest of the first screen it waits for the motion gate (components/motion-gate.tsx): one
 * still frame until the visitor first interacts, then it flows. It stops while off screen or in a
 * hidden tab, and holds still for Reduce Motion.
 */
export function HeroLines() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    let raf = 0;
    let visible = true;
    let gated = !document.documentElement.dataset.motion;
    let origin = 0;
    let veil: CanvasGradient | string = "transparent";

    // Each line's surge runs at its own pace from its own start, so the light never marches in step.
    const speed = Array.from({ length: LINES }, (_, i) => 0.055 + ((i * 37) % 11) * 0.006);
    const seed = Array.from({ length: LINES }, (_, i) => ((i * 53) % LINES) / LINES);
    const colors = Array.from({ length: LINES }, (_, i) => palette(i / (LINES - 1)));
    // Colour strings built once, not per frame: the thread, and the surge (lifted toward white) at full and zero alpha.
    const thread = colors.map((c) => rgba(c, 0.24));
    const lit = colors.map((c): RGB => [c[0] + (255 - c[0]) * 0.35, c[1] + (255 - c[1]) * 0.35, c[2] + (255 - c[2]) * 0.35]);
    const litRGB = lit.map((c) => `${c[0] | 0},${c[1] | 0},${c[2] | 0}`);
    const xs = new Float32Array(STEPS);
    const ys = new Float32Array(STEPS);

    const resize = () => {
      // Hairlines stay crisp at 1.5x, and every pixel saved is fill time saved each frame.
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      dw = Math.max(w, h * 1.6);
      ox = w - dw;
      const narrow = w < h;
      top = narrow ? 0.44 : 0.02;
      spread = narrow ? 1.9 : 1.75;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Clear behind the copy (left, upper middle), easing back to the full ribbon further out. The
      // same ellipse the CSS mask used: 62% of the width across, 58% of the height tall.
      veil = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      veil.addColorStop(0, "rgba(0,0,0,1)");
      veil.addColorStop(0.3, "rgba(0,0,0,1)");
      veil.addColorStop(0.78, "rgba(0,0,0,0)");
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
        const off = u * width * Math.cos(twist);
        xs[k] = cx - off * 0.35;
        ys[k] = cy + off;
      }
    };

    /** A point at fraction `f` (0..1) along the line last traced, between its sample points. */
    const at = (f: number): [number, number] => {
      const x = f * (STEPS - 1);
      const k = Math.min(STEPS - 2, Math.floor(x));
      const r = x - k;
      return [xs[k] + (xs[k + 1] - xs[k]) * r, ys[k] + (ys[k + 1] - ys[k]) * r];
    };

    const draw = (t: number) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (let i = 0; i < LINES; i++) {
        const u = i / (LINES - 1) - 0.5;
        trace(u, t);

        // The thread itself: faint, so the ribbon reads as a whole and no single line competes.
        ctx.strokeStyle = thread[i];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let k = 1; k < STEPS; k++) ctx.lineTo(xs[k], ys[k]);
        ctx.stroke();

        // The surge: a short run of light travelling up the line, brightest at its head. Its ends are
        // placed at exact fractional positions along the curve rather than snapped to the sample
        // points (~20px apart on a wide screen), so the light glides instead of stepping.
        const head = ((seed[i] + t * speed[i]) % 1.4) - 0.2;
        const tail = head - SURGE * 2;
        const from = Math.max(0, tail);
        const to = Math.min(1, head);
        if (to - from < 0.002) continue;
        const [fx, fy] = at(from);
        const [tx, ty] = at(to);
        // Alpha along the surge, squared toward the tail. Sampled at the drawn ends, so a surge
        // entering or leaving the line fades rather than popping in or out.
        const alpha = (f: number) => Math.pow(Math.min(1, Math.max(0, (f - tail) / (SURGE * 2))), 2) * 0.95;
        const g = ctx.createLinearGradient(fx, fy, tx, ty);
        g.addColorStop(0, `rgba(${litRGB[i]},${alpha(from).toFixed(3)})`);
        g.addColorStop(0.5, `rgba(${litRGB[i]},${alpha((from + to) / 2).toFixed(3)})`);
        g.addColorStop(1, `rgba(${litRGB[i]},${alpha(to).toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        const k0 = Math.ceil(from * (STEPS - 1));
        const k1 = Math.floor(to * (STEPS - 1));
        for (let k = k0; k <= k1; k++) ctx.lineTo(xs[k], ys[k]);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      // Fade the ribbon out behind the copy, drawn into the canvas: a CSS mask on a full-size canvas
      // is re-composited every frame, which is where the motion felt heavy.
      ctx.globalCompositeOperation = "destination-out";
      ctx.save();
      ctx.translate(w * 0.2, h * 0.36);
      ctx.scale(w * 0.62, h * 0.58);
      ctx.fillStyle = veil;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || gated || reduced) return;
      draw((now - origin) / 1000);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !gated && !reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    // A still frame first: every line drawn and the surges caught mid-flight.
    draw(12);
    origin = performance.now() - 12000;

    const onMotion = () => {
      gated = false;
      start();
    };
    if (gated) window.addEventListener("sp:motion", onMotion, { once: true });
    else start();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden;
      if (visible) start();
    });
    io.observe(canvas);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(() => {
      resize();
      draw((performance.now() - origin) / 1000);
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("sp:motion", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      // Faded out behind the copy inside the drawing itself (see `veil`), so the headline and buttons sit on clean ground.
      // It starts a navbar's height above the hero and runs up behind the fixed navbar to the top of the
      // page, so the ribbon leaves through the top of the window instead of stopping at a hard edge
      // under the bar.
      className="pointer-events-none absolute inset-x-0 bottom-0 -top-[var(--nav-h)] z-0 h-[calc(100%+var(--nav-h))] w-full"
    />
  );
}
