"use client";
import { useEffect, useRef } from "react";

type RGB = [number, number, number];

const RED: RGB = [255, 0, 0];
const ORANGE: RGB = [255, 122, 60];
const PINK: RGB = [255, 143, 184];
const BLUE: RGB = [77, 141, 255];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** Same stops as `.text-pop` and the hero bird: red → orange → pink → blue. */
function palette(u: number): RGB {
  const t = Math.min(1, Math.max(0, u));
  if (t < 0.34) return mix(RED, ORANGE, t / 0.34);
  if (t < 0.68) return mix(ORANGE, PINK, (t - 0.34) / 0.34);
  return mix(PINK, BLUE, (t - 0.68) / 0.32);
}

/**
 * A halftone field that rises out of the bottom-right corner of its parent: dots grow toward the
 * corner, take the pricing palette around the arc, and a slow swell drifts through them. Parent
 * must be `relative overflow-hidden`. Holds one still frame under reduced motion and pauses
 * off-screen.
 */
export function CornerDither({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      const gap = w < 360 ? 8 : 9;
      const maxR = gap * 0.46;
      const reach = Math.hypot(w, h) * 0.92;
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          // Distance from the bottom-right corner, 0 at the corner and 1 at the edge of the field.
          const dx = w - x;
          const dy = h - y;
          const d = Math.hypot(dx, dy) / reach;
          if (d >= 1) continue;
          const angle = Math.atan2(dy, dx) / (Math.PI / 2); // 0 along the bottom edge, 1 up the right edge
          const swell = 0.5 + 0.5 * Math.sin(d * 11 - t * 0.9 + Math.sin(angle * 3 + t * 0.35) * 1.4);
          const falloff = Math.pow(1 - d, 1.4);
          const r = maxR * falloff * (0.35 + 0.65 * swell);
          if (r < 0.45) continue;
          const [cr, cg, cb] = palette(angle * 0.85 + d * 0.3);
          ctx.globalAlpha = 0.45 + 0.55 * falloff;
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (time: number) => {
      if (visible) paint(time);
      raf = requestAnimationFrame(tick);
    };

    fit();
    paint(reduced ? 2400 : 0);
    if (!reduced) raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => { fit(); paint(reduced ? 2400 : performance.now()); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
