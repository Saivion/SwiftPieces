"use client";
import { useEffect, useRef } from "react";
import { blocks, ground } from "./palette";

/* Backgrounds. Each preview is the field itself, full bleed, with nothing on top of it: these pieces are surfaces,
   so any card, headline or button in front of them would be previewing something that is not the component. */

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** A low-resolution canvas shader: `shade(u, v, t)` returns linear RGB 0–1, upscaled with smoothing. */
function useShader(shade: (u: number, v: number, t: number, out: number[]) => void, W: number, H: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    canvas.width = W; canvas.height = H;
    const img = ctx.createImageData(W, H), px = img.data, out = [0, 0, 0], reduce = reduced();
    let raf = 0;
    const draw = (now: number) => {
      const t = reduce ? 20 : now / 1000;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        shade(i / W, j / H, t, out);
        const o = (j * W + i) * 4;
        px[o] = Math.min(255, out[0] * 255); px[o + 1] = Math.min(255, out[1] * 255); px[o + 2] = Math.min(255, out[2] * 255); px[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

// MARK: - Silk

/** The Silk height field and Blinn-Phong shading, as in Silk.metal (radial term centred off-screen). */
function silkShade(tint: number[], sheen: number[], depth: number, shine: number, scale: number, light: { x: number; y: number }) {
  const e = 0.006, bump = 0.05 * scale;
  const height = (x: number, y: number, t: number) => {
    const a = 0.35 * t, p = Math.cos(a) * x - Math.sin(a) * y, q = Math.sin(a) * x + Math.cos(a) * y;
    return (Math.sin(p * 3 + t) + Math.sin((q + p) * 2 - t * 1.3) * 0.8 + Math.sin(Math.hypot(p - 1.7, q + 1.3) * 4 - t * 0.7) * 0.6 + Math.sin(q * 6 + Math.sin(p * 2 + t * 0.4) * 1.5 - t * 0.5) * 0.3) / 2.7;
  };
  return (u: number, v: number, time: number, out: number[]) => {
    const t = time * 0.3, x = (u - 0.5) * scale, y = (v - 0.5) * scale, h = height(x, y, t);
    let nx = (-(height(x + e, y, t) - h) / e) * bump, ny = (-(height(x, y + e, t) - h) / e) * bump, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    let lx = (light.x - 0.5) * 2, ly = -(light.y - 0.5) * 2, lz = 0.9; const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const diffuse = Math.max(nx * lx + ny * ly + nz * lz, 0), spec = Math.pow(Math.max(nx * hx + ny * hy + nz * hz, 0), shine) * (0.45 + 0.25 * h);
    for (let k = 0; k < 3; k++) out[k] = tint[k] * (1 - depth + depth * diffuse) + sheen[k] * spec;
  };
}

/** Silk, `.tangerine`: the block fabric with a white sheen, filling the stage. The fabric is the piece, so the folds
    and the sheen are the whole preview. */
export function SilkPreview() {
  const ref = useShader(silkShade(hexRgb(blocks.tangerine), [1, 1, 1], 0.3, 22, 2.6, { x: 0.25, y: 0.15 }), 128, 96);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: blocks.tangerine }}>
      <canvas ref={ref} data-motion aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  );
}

// MARK: - Touch Grid

/** Touch Grid, `.standard` style: resting dots are the text color at 0.18 and lift into tangerine under the finger,
    swelling 3.2x with a smoothstep falloff; release springs back (e^-7t cos 10t) and a tap sends one ripple out.
    The grid fills the stage; a scripted probe sweeps, releases and taps until a real pointer takes over. */
export function TouchGridPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    const reduce = reduced(), cycle = 7000;
    type P = { x: number; y: number };
    let raf = 0, w = 0, h = 0, touch: P | null = null, touchAt = 0, moved = 0, release: (P & { at: number }) | null = null, ripples: (P & { at: number })[] = [], pointer = false, hold = 0;
    const resize = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const press = (x: number, y: number) => { if (touch) moved += Math.hypot(x - touch.x, y - touch.y); else { touchAt = performance.now(); moved = 0; } touch = { x, y }; };
    const lift = () => {
      if (!touch) return;
      const now = performance.now(); release = { ...touch, at: now };
      if (moved < 8 && now - touchAt < 300 && !reduce) { ripples.push({ ...touch, at: now }); if (ripples.length > 3) ripples.shift(); }
      touch = null;
    };
    const probe = (now: number) => {
      const s = (now % cycle) / 1000;
      if (s < 2.4) { const p = s / 2.4; press(w * (0.24 + p * 0.55), h * (0.7 - Math.sin(p * Math.PI) * 0.4)); }
      else if (s < 3.6) lift();
      else if (s < 3.72) press(w * 0.5, h * 0.5);
      else lift();
    };
    const tan = hexRgb(blocks.tangerine).map((c) => Math.round(c * 255)).join(","), dot = hexRgb(ground.text).map((c) => Math.round(c * 255)).join(",");
    const draw = (now: number) => {
      if (!pointer && now > hold && !reduce) probe(now);
      ctx.clearRect(0, 0, w, h);
      const spacing = Math.max(12, w / 26), size = spacing * 0.16, radius = spacing * 5.2, base = 0.18;
      let field: (P & { s: number }) | null = touch ? { ...touch, s: 1 } : null;
      if (!field && release) { const t = (now - release.at) / 1000; if (t < 0.55) field = { x: release.x, y: release.y, s: Math.max(Math.exp(-7 * t) * Math.cos(10 * t), -0.12) }; else release = null; }
      ripples = ripples.filter((r) => now - r.at < 1100);
      for (let y = spacing / 2; y < h + spacing; y += spacing) for (let x = spacing / 2; x < w + spacing; x += spacing) {
        let l = 0;
        if (field) { const f = Math.max(0, 1 - Math.hypot(x - field.x, y - field.y) / radius); l += f * f * (3 - 2 * f) * field.s; }
        for (const r of ripples) { const p = (now - r.at) / 1100, eased = 1 - (1 - p) ** 3, band = spacing * (1.2 + eased * 2); l += Math.exp(-(((Math.hypot(x - r.x, y - r.y) - eased * radius * 2.4) / band) ** 2)) * (1 - p) * 0.7; }
        l = Math.min(Math.max(l, -0.12), 1);
        const rise = Math.max(l, 0), s = (size * (1 + l * 2.2)) / 2;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dot},${base * (1 - rise)})`; ctx.fill();
        if (rise > 0.01) { ctx.fillStyle = `rgba(${tan},${Math.min(1, 0.25 + rise * 0.9)})`; ctx.fill(); }
      }
      raf = requestAnimationFrame(draw);
    };
    const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { pointer = true; touch = null; release = null; press(...at(e)); };
    const move = (e: PointerEvent) => { if (pointer) press(...at(e)); };
    const up = () => { if (!pointer) return; lift(); pointer = false; const now = performance.now(); hold = now + cycle - (now % cycle); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointerleave", up);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointerleave", up); };
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg }}>
      <canvas ref={ref} data-motion className="absolute inset-0 h-full w-full touch-none" aria-hidden />
    </div>
  );
}
