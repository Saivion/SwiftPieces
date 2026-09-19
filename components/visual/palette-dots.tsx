"use client";
import { useEffect, useRef } from "react";

/**
 * The dot field from the Pro sign-in panel: a grid that lights up under the cursor and holds a
 * seeded bloom when it is still. Colours come from the brand palette via CSS vars, with the same
 * fallbacks Pro uses, so Free needs no Pro tokens.
 */

type RGB = [number, number, number];

function parseColor(value: string, fallback: RGB): RGB {
  const h = value.trim();
  if (h.length === 7 && h.startsWith("#")) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  const rgb = h.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (h.toLowerCase() === "red") return [255, 0, 0];
  return fallback;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const u = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}

export function PaletteDots({
  className,
  fade = "none",
  seedX,
  seedY,
  seedStrength = 0,
  gain = 1,
}: {
  className?: string;
  fade?: "none" | "bottom";
  seedX?: number;
  seedY?: number;
  seedStrength?: number;
  /** 0–1 scale for rest + colored dots. Use a lower value on dense cards. */
  gain?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, w = 0, h = 0, running = true;
    const gap = 26;
    const target = { x: 0, y: 0 };
    let cur = { x: 0, y: 0 };
    let vel = { x: 0, y: 0 };
    let hovering = false;
    let hoverAmt = 0;
    const css = getComputedStyle(document.documentElement);
    const red = parseColor(css.getPropertyValue("--pro-c1"), [255, 0, 0]);
    const orange = parseColor(css.getPropertyValue("--pro-c2"), [255, 122, 60]);
    const pink = parseColor(css.getPropertyValue("--pro-pink"), [255, 143, 184]);
    const blue = parseColor(css.getPropertyValue("--pro-c3"), [77, 141, 255]);
    const honeydew = parseColor(css.getPropertyValue("--pro-honeydew"), [255, 228, 239]);
    let energy: Float32Array = new Float32Array(0);
    let cols = 0, rows = 0;

    const tone = (e: number): RGB => {
      if (e > 0.48) return mix(red, orange, Math.pow(Math.max(0, 0.92 - e) / 0.44, 2.4));
      if (e > 0.30) return mix(orange, pink, (0.48 - e) / 0.18);
      if (e > 0.12) return mix(pink, blue, (0.30 - e) / 0.18);
      return mix(blue, honeydew, Math.min(1, (0.12 - e) / 0.12));
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const nextW = Math.round(canvas.clientWidth);
      const nextH = Math.round(canvas.clientHeight);
      if (nextW < 8 || nextH < 8 || nextW > 4096 || nextH > 4096) return;
      if (nextW === w && nextH === h) return;
      w = nextW;
      h = nextH;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
      energy = new Float32Array(cols * rows);
    };

    const draw = (now: number) => {
      if (!running) return;
      if (hovering) {
        vel = { x: target.x - cur.x, y: target.y - cur.y };
        cur = { x: cur.x + vel.x * 0.18, y: cur.y + vel.y * 0.18 };
        hoverAmt += (1 - hoverAmt) * 0.14;
      } else {
        vel = { x: 0, y: 0 };
        hoverAmt *= 0.88;
        if (hoverAmt < 0.01) hoverAmt = 0;
      }
      const speed = hovering ? Math.min(1, Math.hypot(vel.x, vel.y) / 42) : 0;
      const vlen = Math.hypot(vel.x, vel.y);
      const ux = vlen > 0.5 ? vel.x / vlen : 1;
      const uy = vlen > 0.5 ? vel.y / vlen : 0;
      const stretch = 1 + speed * 1.15;
      const radius = 300 + speed * 70;
      const sx = seedX == null ? -9999 : seedX * w;
      const sy = seedY == null ? -9999 : seedY * h;
      const pulse = 1 + Math.sin(now * 0.0034) * 0.06;
      ctx.clearRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gap + gap / 2;
          const y = r * gap + gap / 2;
          const i = r * cols + c;
          const dx = x - cur.x;
          const dy = y - cur.y;
          const d = vlen > 0.5
            ? Math.hypot((dx * ux + dy * uy) / stretch, (dx * -uy + dy * ux) * Math.min(1.45, stretch))
            : Math.hypot(dx, dy);
          const fall = Math.max(0, 1 - d / (radius * pulse));
          const near = reduced || hoverAmt < 0.01 ? 0 : fall * fall * hoverAmt;
          const core = reduced || hoverAmt < 0.01 ? 0 : Math.pow(Math.max(0, 1 - d / (radius * 0.32)), 2.4) * hoverAmt;
          const idle = seedStrength
            ? Math.pow(Math.max(0, 1 - Math.hypot(x - sx, y - sy) / (Math.min(w, h) * 0.5)), 2.4) * seedStrength
            : 0;
          energy[i] = Math.max(near, core, idle, energy[i] * (0.86 + speed * 0.06));
          const e = energy[i];
          const fadeAmt = fade === "bottom" ? Math.min(1, (h - y) / (h * 0.45)) : 1;
          const a = fadeAmt * gain;
          const dist = Math.hypot(dx, dy) || 1;
          const px = x + (dx / dist) * e * 5.5;
          const py = y + (dy / dist) * e * 5.5;
          if (e > 0.025) {
            const [rr, gg, bb] = tone(e);
            if (e > 0.18) {
              ctx.fillStyle = `rgba(${rr},${gg},${bb},${e * 0.22 * a})`;
              ctx.beginPath();
              ctx.arc(px, py, 1.8 + e * 10, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = `rgba(${rr},${gg},${bb},${(0.18 + e * 0.82) * a})`;
            ctx.beginPath();
            ctx.arc(px, py, 0.95 + e * 3.4 + core * 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(255,255,255,${0.1 * a})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.05, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const track = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const inset = 2;
      const inside = x >= inset && y >= inset && x <= box.width - inset && y <= box.height - inset;
      if (!inside) {
        hovering = false;
        return;
      }
      if (!hovering) {
        cur.x = x;
        cur.y = y;
        vel.x = 0;
        vel.y = 0;
      }
      hovering = true;
      target.x = x;
      target.y = y;
    };
    const leave = () => {
      hovering = false;
    };
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("blur", leave);
    const io = new IntersectionObserver(([en]) => {
      running = en.isIntersecting;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", track);
      window.removeEventListener("blur", leave);
    };
  }, [fade, gain, seedStrength, seedX, seedY]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
