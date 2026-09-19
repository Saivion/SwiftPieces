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

// MARK: - Aurora

/** Aurora, `.standard` palette: the Metal curtains ported per pixel. Crisp lower edges, long rising tails with drifting
    rays, coverage-weighted colour over the #121212 ground. The field is the piece, so it fills the stage alone. */
export function AuroraPreview() {
  const base = hexRgb(ground.bg), cols = [blocks.tangerine, blocks.lilac, blocks.sky].map(hexRgb);
  const ref = useShader((u, v, time, out) => {
    const t = time * 0.22, y = v - 0.64, x = u;
    const ribbon = (centre: number, width: number, seed: number) => {
      const d = y - centre, w = d < 0 ? width * 0.42 : width, core = Math.exp(-(d * w) * (d * w));
      const curtain = 0.55 + 0.45 * Math.sin(x * 4 + seed + t * 0.8) * Math.sin(x * 1.7 - seed * 0.5 + t * 0.3);
      const rays = 0.8 + 0.2 * Math.sin(x * 38 + seed * 3 + Math.sin(x * 7 + t * 0.6 + seed) * 2.4);
      const tail = 1 - Math.min(1, Math.max(0, (d + 0.14) / 0.14));
      return Math.min(1, core * curtain * (1 + (rays - 1) * tail) * 0.85);
    };
    const breath = Math.sin(t * 0.5) * 0.03;
    const a = [
      ribbon(0.06 + breath + Math.sin(x * 3 + t * 1.3 + Math.sin(x * 1.5 + t) * 0.8) * 0.09, 8, 0),
      ribbon(-0.12 - breath + Math.sin(x * 5 - t * 0.9 + Math.cos(x * 2.2 - t * 0.5) * 0.6) * 0.07, 10, 2.1),
      ribbon(-0.28 + Math.sin(x * 2 + t * 0.6 + Math.sin(x * 0.8 - t * 0.4) * 0.5) * 0.1, 7.5, 4.2),
    ];
    const cov = 1 - (1 - a[0]) * (1 - a[1]) * (1 - a[2]), sum = Math.max(a[0] + a[1] + a[2], 1e-4);
    for (let k = 0; k < 3; k++) out[k] = base[k] * (1 - cov) + ((cols[0][k] * a[0] + cols[1][k] * a[1] + cols[2][k] * a[2]) / sum) * cov;
  }, 160, 90);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg }}>
      <canvas ref={ref} data-motion aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  );
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

// MARK: - Grain

function GrainLayer({ id, opacity, animated = true }: { id: string; opacity: number; animated?: boolean }) {
  const turb = useRef<SVGFETurbulenceElement>(null);
  useEffect(() => {
    if (!animated || reduced()) return;
    let frame = 0;
    const t = setInterval(() => turb.current?.setAttribute("seed", String(++frame % 997)), 1000 / 24);
    return () => clearInterval(t);
  }, [animated]);
  return (
    <svg aria-hidden data-motion className="pointer-events-none absolute inset-0 h-full w-full mix-blend-soft-light" style={{ opacity }}>
      <filter id={id}><feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="0" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** Grain is a modifier, so the preview is the grain over the surface it grains and nothing else: the `.sky` house
    gradient at 24 fps soft-light, full bleed. */
export function GrainPreview() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${blocks.sky}, ${blocks.lilac})` }}>
      <GrainLayer id="sp-grain-surface" opacity={0.75} />
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

// MARK: - Ambient Mesh

/** Ambient Mesh, `.standard` palette in dark: colour fields stand in for the interior mesh points (ground, deepened
    lilac, deepened tangerine) and wander on the sum of three incommensurate sines, with soft-light grain at 0.18 on
    top. The mesh is the piece, so it fills the stage alone. */
export function AmbientMeshPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const palette = [ground.bg, "#534c65", "#945d42"];
  const fields: [number, number, number, number][] = [[0.28, 0.3, 1, 80], [0.62, 0.5, 1, 62], [0.95, 0.95, 2, 86], [0.82, 0.18, 2, 46], [0.12, 0.85, 0, 60]];
  useEffect(() => {
    const blobs = Array.from(ref.current!.children) as HTMLElement[], reduce = reduced();
    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      blobs.forEach((b, i) => {
        const s = i * 1.7, dx = (Math.sin(t * 0.21 + s) + Math.sin(t * 0.13 + s * 2) + Math.sin(t * 0.07 + s * 3)) / 3, dy = (Math.sin(t * 0.17 + s * 1.3) + Math.sin(t * 0.11 + s * 0.7) + Math.sin(t * 0.09 + s * 2.1)) / 3;
        b.style.transform = `translate(${dx * 16}%, ${dy * 16}%)`;
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: palette[0] }}>
      <div ref={ref} aria-hidden className="absolute inset-0">
        {fields.map(([x, y, c, size], i) => <div key={i} data-motion className="absolute rounded-full" style={{ width: `${size}%`, aspectRatio: "1", left: `${x * 100}%`, top: `${y * 100}%`, translate: "-50% -50%", background: palette[c], filter: "blur(9cqw)" }} />)}
      </div>
      <GrainLayer id="sp-mesh-grain" opacity={0.18} animated={false} />
    </div>
  );
}
