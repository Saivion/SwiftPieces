"use client";
import { useEffect, useRef } from "react";
import { blocks, groundHex } from "./palette";
import { reduced, roles, type Spring } from "./piece-motion";

/* Backgrounds. Each preview is the field itself, full bleed, with nothing on top of it: these pieces are surfaces,
   so any card, headline or button in front of them would be previewing something that is not the component. */

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** A low-resolution canvas shader: `shade(u, v, t)` returns linear RGB 0–1, upscaled with smoothing. `t` is Silk's
    clock: it starts on the rest pose when the stage appears and the drift eases up to speed, so the fabric never pops
    into motion. Reduce Motion holds the rest pose and draws once. */
function useShader(shade: (u: number, v: number, t: number, out: number[]) => void, W: number, H: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    canvas.width = W; canvas.height = H;
    const img = ctx.createImageData(W, H), px = img.data, out = [0, 0, 0], reduce = reduced();
    // Silk.metal's fold rates all repeat after 40π of shader time (time x 0.3), so the phase wraps there without a seam.
    const period = (40 * Math.PI) / 0.3;
    // At most 60 fps, as in Swift: the folds move about half a pixel a frame, so 120 Hz adds cost, not smoothness.
    // Draws keep to a 60 Hz deadline grid, not a minimum gap, so 90 and 100 Hz still average 60 rather than halving.
    const frame = 1000 / 60;
    let raf = 0, phase = 0, rate = 0, last = -1, next = 0;
    const draw = (now: number) => {
      // 2 ms early is on time: refresh stamps jitter around the deadline.
      if (now < next - 2) { raf = requestAnimationFrame(draw); return; }
      // A stall or a hidden tab restarts the grid here, rather than bursting to catch up.
      next = next + frame < now ? now + frame : next + frame;
      // A tenth of a second at most, so a tab coming back never leaps.
      const dt = last < 0 ? 0 : Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      if (!reduce) {
        // The drift eases toward speed 1 on a 0.4s time constant, from rest at appearance, as SilkClock does.
        rate += (1 - rate) * (1 - Math.exp(-dt / 0.4));
        phase = (phase + rate * dt) % period;
      }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        shade(i / W, j / H, phase, out);
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

/** Silk, `.tangerine`: the brand red block fabric with a white sheen, filling the stage. The fabric is the piece, so the folds
    and the sheen are the whole preview. Like the piece, the folds ease up from rest each time the stage appears. */
export function SilkPreview() {
  const ref = useShader(silkShade(hexRgb(blocks.tangerine), [1, 1, 1], 0.3, 22, 2.6, { x: 0.25, y: 0.15 }), 128, 96);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: blocks.tangerine }}>
      <canvas ref={ref} data-motion aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  );
}

// MARK: - Touch Grid

/** A spring from 0 toward `target`, leaving at `v0` per second: position and velocity `t` seconds in. The general form
    of piece-motion's `springValue`, for a lift that carries the swell's speed. */
function springAt(s: Spring, target: number, v0: number, t: number): [number, number] {
  const w = (2 * Math.PI) / s.duration, z = 1 - Math.min(Math.max(s.bounce, 0), 0.99), a = -target;
  if (z >= 1) { const b = v0 + w * a, e = Math.exp(-w * t); return [target + e * (a + b * t), e * (b - w * (a + b * t))]; }
  const wd = w * Math.sqrt(1 - z * z), b = (v0 + z * w * a) / wd, e = Math.exp(-z * w * t), c = Math.cos(wd * t), sn = Math.sin(wd * t);
  return [target + e * (a * c + b * sn), e * ((b * wd - z * w * a) * c - (a * wd + z * w * b) * sn)];
}

/** Touch Grid, `.standard` style: resting dots are the text color at 0.18 and lift into the brand red under the finger,
    swelling 3.2x with a smoothstep falloff. As in the piece, the field swells in on the press spring, springs back on
    the release spring with a slight dip below rest, coasts on along a flick, and a tap sends one ripple out (under
    Reduce Motion it glows in place). A lifted field plays out where it was let go while a new touch swells. The grid
    fills the stage; a scripted probe sweeps, releases in place and taps until a real pointer takes over. */
export function TouchGridPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    const reduce = reduced(), cycle = 7000;
    // Under Reduce Motion a lift settles on a short spring with no dip and no coast, as PieceMotion's still settle.
    const spring: Spring = reduce ? { duration: 0.25, bounce: 0 } : roles.release;
    type P = { x: number; y: number };
    type Lifted = P & { at: number; from: number; speed: number; dx: number; dy: number; life: number };
    type Ripple = P & { at: number; bloom: boolean };
    let raf = 0, w = 0, h = 0, touch: P | null = null, touchAt = 0, moved = 0, lifted: Lifted[] = [], ripples: Ripple[] = [], pointer = false, hold = 0, drewIdle = false;
    let trail: (P & { at: number })[] = [];
    const resize = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drewIdle = false; };
    const metrics = () => { const spacing = Math.max(12, w / 26); return { spacing, radius: spacing * 5.2 }; };
    // The field sits on the finger at every frame; only its strength eases in, on the press spring (no overshoot).
    const swell = (now: number) => springAt(roles.press, 1, 0, Math.max(now - touchAt, 0) / 1000);
    const press = (x: number, y: number) => { if (touch) moved += Math.hypot(x - touch.x, y - touch.y); else { touchAt = performance.now(); moved = 0; } touch = { x, y }; };
    /** How far a flick at (vx, vy) px/s coasts: projected at a detent's 0.99 deceleration, eased toward half the radius. */
    const coast = (vx: number, vy: number): [number, number] => {
      const tx = vx * 0.099, ty = vy * 0.099, length = Math.hypot(tx, ty), reach = metrics().radius * 0.5;
      if (reduce || length <= 0.5) return [0, 0];
      const k = (reach * Math.tanh(length / reach)) / length;
      return [tx * k, ty * k];
    };
    /** Lets go: the field springs back from the strength it reached, carrying a quick tap's rise, and coasts along (vx, vy). */
    const lift = (tappable = true, vx = 0, vy = 0) => {
      if (!touch) return;
      const now = performance.now(), [from, rising] = swell(now), cap = ((2 * Math.PI) / spring.duration) * 1.5 * from;
      const speed = Math.min(Math.max(rising, -cap), cap), [dx, dy] = coast(vx, vy);
      let life = 0;
      for (let t = 0; t < 2.5; t += 0.004) if (Math.abs(from + springAt(spring, -from, speed, t)[0]) > 0.005) life = t + 0.004;
      lifted = lifted.filter((f) => now - f.at < f.life * 1000);
      lifted.push({ ...touch, at: now, from, speed, dx, dy, life });
      if (lifted.length > 4) lifted.shift();
      if (tappable && moved < 8 && now - touchAt < 300) { ripples.push({ ...touch, at: now, bloom: reduce }); if (ripples.length > 3) ripples.shift(); }
      touch = null;
    };
    // Releases from the probe spring back in place, with no coast, as the piece's `probe` does.
    const probe = (now: number) => {
      const s = (now % cycle) / 1000;
      if (s < 2.4) { const p = s / 2.4; press(w * (0.24 + p * 0.55), h * (0.7 - Math.sin(p * Math.PI) * 0.4)); }
      else if (s < 3.6) lift();
      else if (s < 3.75) press(w * 0.5, h * 0.5);
      else lift();
    };
    const tan = hexRgb(blocks.tangerine).map((c) => Math.round(c * 255)).join(","), dot = hexRgb(groundHex.text).map((c) => Math.round(c * 255)).join(",");
    const draw = (now: number) => {
      if (!pointer && now > hold && !reduce) probe(now);
      lifted = lifted.filter((f) => now - f.at < f.life * 1000);
      ripples = ripples.filter((r) => now - r.at < (r.bloom ? 450 : 1100));
      // Nothing pressed, springing or rippling: the last frame drawn is still true, so skip the redraw.
      const idle = !touch && !lifted.length && !ripples.length;
      if (idle && drewIdle) { raf = requestAnimationFrame(draw); return; }
      drewIdle = idle;
      ctx.clearRect(0, 0, w, h);
      const { spacing, radius } = metrics(), size = spacing * 0.16, base = 0.18;
      // Every field adds, like dents in one membrane: each lifted one springing back as it coasts, and the finger's.
      const fields = lifted.map((f) => {
        const t = (now - f.at) / 1000, coasted = 1 - 0.99 ** (t * 1000);
        return { x: f.x + f.dx * coasted, y: f.y + f.dy * coasted, s: f.from + springAt(spring, -f.from, f.speed, t)[0] };
      });
      if (touch) fields.push({ ...touch, s: swell(now)[0] });
      for (let y = spacing / 2; y < h + spacing; y += spacing) for (let x = spacing / 2; x < w + spacing; x += spacing) {
        let l = 0, glow = 0;
        for (const f of fields) { const k = Math.max(0, 1 - Math.hypot(x - f.x, y - f.y) / radius); l += k * k * (3 - 2 * k) * f.s; }
        for (const r of ripples) {
          const d = Math.hypot(x - r.x, y - r.y);
          if (r.bloom) {
            // Colour only: warms in over the first 75ms, then fades, all in place.
            const p = (now - r.at) / 450, k = Math.max(0, 1 - d / (radius * 1.6));
            glow += k * k * (3 - 2 * k) * Math.min(p * 6, 1) * (1 - p) ** 2 * 0.8;
            continue;
          }
          const p = (now - r.at) / 1100, eased = 1 - (1 - p) ** 3, band = spacing * (1.2 + eased * 2);
          l += Math.exp(-(((d - eased * radius * 2.4) / band) ** 2)) * (1 - p) * 0.7;
        }
        l = Math.min(Math.max(l, -0.12), 1);
        const rise = Math.min(Math.max(l, 0) + glow, 1), s = (size * (1 + l * 2.2)) / 2;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dot},${base * (1 - rise)})`; ctx.fill();
        if (rise > 0.01) { ctx.fillStyle = `rgba(${tan},${Math.min(1, 0.25 + rise * 0.9)})`; ctx.fill(); }
      }
      raf = requestAnimationFrame(draw);
    };
    const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const track = (x: number, y: number) => { const now = performance.now(); trail.push({ x, y, at: now }); trail = trail.filter((p) => now - p.at < 100); };
    // The finger's speed over its last 100ms; a finger that stopped before lifting has none.
    const velocity = (): [number, number] => {
      const now = performance.now(), recent = trail.filter((p) => now - p.at < 100);
      if (recent.length < 2) return [0, 0];
      const a = recent[0], b = recent[recent.length - 1], dt = (b.at - a.at) / 1000;
      return dt > 0.008 ? [(b.x - a.x) / dt, (b.y - a.y) / dt] : [0, 0];
    };
    // A real touch lets the probe's field go where it was rather than cutting it short.
    const down = (e: PointerEvent) => { lift(false); pointer = true; trail = []; const [x, y] = at(e); track(x, y); press(x, y); };
    const move = (e: PointerEvent) => { if (!pointer) return; const [x, y] = at(e); track(x, y); press(x, y); };
    const end = (tappable: boolean) => { if (!pointer) return; lift(tappable, ...(tappable ? velocity() : [0, 0])); pointer = false; const now = performance.now(); hold = now + cycle - (now % cycle); };
    const up = () => end(true);
    // A touch the browser cancels lets go like a lift, with no tap and no coast.
    const cancel = () => end(false);
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointerleave", up); canvas.addEventListener("pointercancel", cancel);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointerleave", up); canvas.removeEventListener("pointercancel", cancel); };
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: groundHex.bg }}>
      <canvas ref={ref} data-motion className="absolute inset-0 h-full w-full touch-none" aria-hidden />
    </div>
  );
}
