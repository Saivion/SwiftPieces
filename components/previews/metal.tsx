"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { font, groundHex } from "./palette";
import { Liquid, LiquidGroup } from "./piece-liquid";
import { reduced } from "./piece-motion";

/**
 * The liquid metal pieces: WebGL ports of their Metal kernels, the same studio, the same bevels and the same clocks.
 * Metal reads best on a dark ground, so like the Swift scenes these stages stay dark in both site themes. Every unit
 * the kernels take in points is passed here in CSS pixels, scaled from the element it rings or fills.
 */

/** iOS points to container units. `s` is cqw per point for the vignette. */
const pt = (n: number, s: number) => `${+(n * s).toFixed(3)}cqw`;

/** The dark stage the metal stands on. */
function Stage({ children, onPointerMove, onPointerLeave }: { children: ReactNode; onPointerMove?: (e: ReactPointerEvent) => void; onPointerLeave?: () => void }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: groundHex.bg, color: groundHex.text, fontFamily: font.stack, fontWeight: 600 }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

// MARK: - WebGL

type Uniforms = {
  f: (name: string, v: number) => void;
  v2: (name: string, x: number, y: number) => void;
  v3: (name: string, x: number, y: number, z: number) => void;
};
/** One frame's size: the canvas in CSS pixels, and the device pixel ratio it draws at. */
type Frame = { w: number; h: number; dpr: number; dt: number };

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/**
 * Runs `frag` over the canvas every animation frame while mounted (the stage unmounts off-screen). `frame` sets the
 * uniforms; `uRes` and `uDpr` are set for it. `mask` uploads a canvas as `uTex` whenever its version changes.
 * Without WebGL the canvas stays empty, and what it decorates still reads.
 */
function useGL(ref: RefObject<HTMLCanvasElement | null>, frag: string, frame: (u: Uniforms, f: Frame) => void, mask?: RefObject<{ canvas: HTMLCanvasElement; version: number } | null>) {
  const draw = useRef(frame);
  draw.current = frame;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl || gl.isContextLost()) return;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const locs = new Map<string, WebGLUniformLocation | null>();
    const at = (n: string) => {
      if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
      return locs.get(n)!;
    };
    const u: Uniforms = {
      f: (n, v) => gl.uniform1f(at(n), v),
      v2: (n, x, y) => gl.uniform2f(at(n), x, y),
      v3: (n, x, y, z) => gl.uniform3f(at(n), x, y, z),
    };

    let tex: WebGLTexture | null = null, uploaded = -1;
    const upload = () => {
      const m = mask?.current;
      if (!m || m.version === uploaded) return;
      if (!tex) {
        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas);
      gl.uniform1i(at("uTex"), 0);
      uploaded = m.version;
    };

    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      upload();
      gl.viewport(0, 0, w, h);
      gl.uniform2f(at("uRes"), w, h);
      gl.uniform1f(at("uDpr"), dpr);
      draw.current(u, { w: r.width, h: r.height, dpr, dt });
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // No loseContext: StrictMode re-runs this effect on the same canvas, and a lost context would never draw again.
    return () => {
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buf);
      if (tex) gl.deleteTexture(tex);
      gl.deleteProgram(prog);
    };
  }, [ref, frag, mask]);
}

/** Eases `value` toward `goal` with time constant `tau` seconds over `dt`. */
const ease = (value: number, goal: number, dt: number, tau: number) => value + (goal - value) * (1 - Math.exp(-dt / tau));

/** Every kernel's wander and ripple rates repeat after 40π, so their phases wrap there, as in Swift. */
const PERIOD = 40 * Math.PI;

/** Shared GLSL: the kernels' studio, by reflection direction, and a pixel's position in CSS pixels, y down. */
const COMMON = `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
vec2 cssPosition() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr; }
vec2 cssSize() { return uRes / uDpr; }
vec3 film(float x) { return 0.5 + 0.5 * cos(6.2831853 * (x + vec3(0.0, 0.33, 0.67))); }
`;

// MARK: - Melt Button

const MELT = COMMON + `
uniform sampler2D uTex;
uniform float uSigma, uTime;
uniform vec3 uTint;

vec3 studio(vec2 q, float t) {
  q.y += 0.07 * sin(q.x * 3.4 + t * 1.3) + 0.035 * sin(q.x * 8.1 - t * 1.9 + q.y * 2.0);
  float y = q.y;
  float sky = mix(0.66, 1.0, smoothstep(0.0, 0.75, y));
  float fl = mix(0.14, 0.38, smoothstep(0.0, -0.85, y));
  float v = mix(fl, sky, smoothstep(-0.015, 0.015, y));
  v += 0.4 * exp(-pow((y - 0.035) / 0.03, 2.0));
  v *= 1.0 - 0.5 * exp(-pow((y + 0.06) / 0.05, 2.0));
  vec2 bx = q - vec2(-0.5, 0.6);
  v += 0.6 * exp(-dot(bx, bx) / 0.04);
  return v * mix(vec3(1.0, 0.97, 0.93), vec3(0.94, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

/** The blurred symbols, the layer the kernel reads, are in red. */
float field(vec2 pos) { return texture2D(uTex, pos / cssSize()).r; }

void main() {
  vec2 size = cssSize(), pos = cssPosition();
  float a = field(pos);
  if (a < 0.12) { gl_FragColor = vec4(0.0); return; }
  float tap = max(uSigma * 0.6, 0.5);
  float gx = (field(pos + vec2(tap, 0.0)) - field(pos - vec2(tap, 0.0))) / (2.0 * tap);
  float gy = (field(pos + vec2(0.0, tap)) - field(pos - vec2(0.0, tap))) / (2.0 * tap);
  float slope = length(vec2(gx, gy));
  float cover = clamp((a - 0.4) / max(slope, 0.0005) * 1.5 + 0.5, 0.0, 1.0);
  if (cover <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float k = 2.6 * uSigma;
  vec3 n = normalize(vec3(-gx * k, gy * k, 1.0));
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  float face = (0.5 - pos.y / max(size.y, 1.0)) * 0.8;
  vec3 metal = studio(refl.xy + vec2(0.0, face), uTime) * uTint;
  metal = mix(metal, film(refl.x * 0.9 + refl.y * 0.6 + uTime * 0.05) * (0.65 + 0.45 * metal), clamp((1.0 - n.z) * 0.35, 0.0, 0.3));
  gl_FragColor = vec4(clamp(metal, 0.0, 1.0) * cover, cover);
}`;

/** SF Symbols as 24-unit paths, filled, close to the glyphs the Swift scene uses. */
const SYMBOLS: Record<string, string> = {
  "play.fill": "M8 4.8v14.4c0 .9 1 1.4 1.7.9l11-7.2c.7-.4.7-1.4 0-1.8l-11-7.2C9 3.4 8 3.9 8 4.8Z",
  "pause.fill": "M6.5 4.5h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm8 0h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z",
  plus: "M10.6 3.5h2.8v7.1h7.1v2.8h-7.1v7.1h-2.8v-7.1H3.5v-2.8h7.1Z",
  checkmark: "M9.4 17.2 4.6 12.4l2-2 2.8 2.8 8-8 2 2Z",
};

/** One Melt Button: the glass, and the canvas the kernel draws the molten symbol into. The clock is the Swift one. */
function Melt({ symbol, size, s, tint, onTap }: { symbol: string; size: number; s: number; tint: [number, number, number]; onTap: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mask = useRef<{ canvas: HTMLCanvasElement; version: number } | null>(null);
  const melt = useRef({ from: symbol, to: symbol, elapsed: 0.7, progress: 1, slump: 0, phase: 0 });
  const pressed = useRef(false);
  useEffect(() => {
    const m = melt.current;
    if (symbol === m.to) return;
    if (m.progress >= 0.5) m.from = m.to;
    m.to = symbol;
    m.elapsed = 0;
    m.progress = 0;
  }, [symbol]);

  useGL(canvas, MELT, (u, f) => {
    const m = melt.current, still = reduced();
    m.elapsed += f.dt;
    const x = Math.min(m.elapsed / (still ? 0.25 : 0.7), 1);
    m.progress = x * x * (3 - 2 * x);
    if (m.progress >= 1) m.from = m.to;
    m.slump = ease(m.slump, pressed.current && !still ? 1 : 0, f.dt, pressed.current ? 0.08 : 0.18);
    if (!still) m.phase = (m.phase + f.dt) % PERIOD;
    const p = m.progress, bump = still ? 0 : Math.sin(Math.PI * p), grow = still ? 0 : 0.35;
    const k = f.w / size, sigma = size * (0.012 + 0.06 * bump + 0.02 * m.slump) * k;
    // The mask, redrawn each frame: both symbols blurred into red, as SwiftUI blurs the layer before the effect.
    const c = mask.current?.canvas ?? document.createElement("canvas");
    const W = Math.max(1, Math.round(f.w * f.dpr)), H = Math.max(1, Math.round(f.h * f.dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const glyph = size * 0.44 * k * f.dpr;
    const draw = (name: string, alpha: number, scale: number, dy: number) => {
      if (alpha <= 0) return;
      const path = new Path2D(SYMBOLS[name]);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "#f00";
      ctx.shadowBlur = sigma * 2 * f.dpr;
      ctx.shadowOffsetX = W * 2;
      const unit = (glyph * scale) / 24;
      ctx.translate(W / 2 - W * 2 - 12 * unit, H / 2 - 12 * unit + dy);
      ctx.scale(unit, unit);
      ctx.fillStyle = "#f00";
      ctx.fill(path);
      ctx.restore();
    };
    if (m.from !== m.to) draw(m.from, Math.min(1, 2 * (1 - p)), 1 - grow * p, 0);
    draw(m.to, m.from === m.to ? 1 : Math.min(1, 2 * p), m.from === m.to ? 1 - 0.06 * m.slump : 1 - grow + grow * p, glyph * 0.05 * m.slump);
    mask.current = { canvas: c, version: (mask.current?.version ?? 0) + 1 };
    u.f("uSigma", sigma);
    u.f("uTime", m.phase);
    u.v3("uTint", tint[0], tint[1], tint[2]);
  }, mask);

  return (
    <button
      type="button"
      aria-label={symbol}
      onClick={onTap}
      onPointerDown={() => { pressed.current = true; }}
      onPointerUp={() => { pressed.current = false; }}
      onPointerLeave={() => { pressed.current = false; }}
      className="relative shrink-0 cursor-pointer active:scale-[0.96]"
      style={{ width: pt(size, s), height: pt(size, s), transition: "transform 140ms cubic-bezier(.2,.8,.2,1)" }}
    >
      <Liquid radius="capsule" style={{ position: "absolute", inset: 0 }} />
      <canvas ref={canvas} data-motion aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </button>
  );
}

/** Melt Button: play melting into pause and an add pouring itself into a check, in turn, as in the piece's scene. A
    click on either takes over from the script. */
export function MeltButtonPreview() {
  const s = 0.3;
  const [playing, setPlaying] = useState(false);
  const [added, setAdded] = useState(false);
  const [scripted, setScripted] = useState(true);
  useEffect(() => {
    if (!scripted) return;
    let n = 0;
    const id = window.setInterval(() => { if (n++ % 2 === 0) setPlaying((v) => !v); else setAdded((v) => !v); }, 1000);
    return () => clearInterval(id);
  }, [scripted]);
  return (
    <Stage>
      <div className="absolute inset-0 flex items-center justify-center" style={{ gap: pt(32, s) }}>
        <Melt symbol={playing ? "pause.fill" : "play.fill"} size={88} s={s} tint={[1, 1, 1]} onTap={() => { setScripted(false); setPlaying((v) => !v); }} />
        <Melt symbol={added ? "checkmark" : "plus"} size={88} s={s} tint={[1, 0.86, 0.62]} onTap={() => { setScripted(false); setAdded((v) => !v); }} />
      </div>
    </Stage>
  );
}

// MARK: - Mercury Gauge

const GAUGE = COMMON + `
uniform float uInset, uLevel, uRadius, uLean, uWobble, uTime;
uniform vec3 uTint;

float field(vec2 p, float left, float front) {
  float x = p.x;
  if (x > front) { x = front + (x - front) / (1.0 + uLean); }
  vec2 q = vec2(x - clamp(x, left, front), p.y);
  float d = length(q) - uRadius;
  float onCap = smoothstep(front - uRadius * 2.0, front, p.x);
  return d + uWobble * uRadius * 0.12 * onCap * sin(atan(q.y, q.x) * 3.0 + uTime * 19.0) * sin(uTime * 7.0);
}
vec3 studio(vec3 r) {
  vec2 q = r.xy;
  q.y += 0.05 * sin(q.x * 3.0 + uTime * 1.1);
  float y = q.y + 0.1 * q.x - 0.1;
  float sky = mix(0.72, 1.0, smoothstep(0.0, 0.8, y));
  float fl = mix(0.28, 0.48, smoothstep(0.0, -0.9, y));
  float v = mix(fl, sky, smoothstep(-0.08, 0.08, y));
  v += 0.25 * exp(-pow((y - 0.08) / 0.05, 2.0));
  v *= 1.0 - 0.3 * exp(-pow((y + 0.1) / 0.08, 2.0));
  vec2 bx = q - vec2(-0.4, 0.6);
  v += 0.8 * exp(-dot(bx, bx) / 0.02);
  return v * mix(vec3(1.0, 0.98, 0.95), vec3(0.93, 0.96, 1.02), smoothstep(-0.2, 0.4, y));
}
void main() {
  vec2 size = cssSize(), pos = cssPosition();
  vec2 p = vec2(pos.x, size.y * 0.5 - pos.y);
  float left = uInset + uRadius;
  float front = left + clamp(uLevel, 0.0, 1.0) * max(size.x - 2.0 * left, 0.0);
  float d = field(p, left, front);
  float sd = field(p + vec2(0.0, uRadius * 0.2), left, front);
  float shadow = 0.3 * exp(-max(sd, 0.0) / (uRadius * 0.25)) * smoothstep(-1.0, 1.0, d);
  if (d > 0.75) { gl_FragColor = vec4(0.0, 0.0, 0.0, shadow); return; }
  const float e = 0.5;
  vec2 g = vec2(field(p + vec2(e, 0.0), left, front) - field(p - vec2(e, 0.0), left, front), field(p + vec2(0.0, e), left, front) - field(p - vec2(0.0, e), left, front));
  float gn = length(g);
  g = gn > 0.0001 ? g / gn : vec2(0.0, 1.0);
  float k = 1.0 - clamp(-d / uRadius, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 n = normalize(vec3(g * k, sqrt(max(1.0 - k * k, 0.0)) + 0.0001));
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  vec3 metal = clamp(studio(refl) * uTint * mix(1.0, 0.5, pow(k, 3.0)), 0.0, 1.0);
  float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(metal * cover, cover + shadow * (1.0 - cover));
}`;

/** The tube's height in points; the column's radius and inset follow from it, as in Swift. */
const TUBE = 26;

/** The level's spring and its front's lean and ring, stepped at 240 Hz exactly as `GaugeFlow` steps them. */
function stepGauge(g: { level: number; v: number; lean: number; wobble: number; ring: number }, target: number, dt: number, still: boolean) {
  let left = dt;
  while (left > 0) {
    const h = Math.min(left, 1 / 240);
    left -= h;
    const before = g.v;
    if (still) g.v = (target - g.level) * 14;
    else g.v += (-(g.level - target) * 196 - g.v * 28) * h;
    g.level += g.v * h;
    g.lean += ((still ? 0 : Math.min(Math.max(g.v * 0.9, -0.35), 0.6)) - g.lean) * (1 - Math.exp(-h / 0.05));
    const impact = still ? 0 : Math.min(Math.abs(g.v - before) / h / 40, 1);
    if (impact > g.wobble) { g.wobble = impact; g.ring = 0; }
    g.wobble *= Math.exp(-h / 0.35);
    g.ring += h;
  }
}

function Gauge({ title, value, s }: { title: string; value: number; s: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flow = useRef({ level: value, v: 0, lean: 0, wobble: 0, ring: 0 });
  const target = useRef(value);
  target.current = value;
  useGL(canvas, GAUGE, (u, f) => {
    const g = flow.current, k = f.h / TUBE;
    stepGauge(g, target.current, f.dt, reduced());
    u.f("uInset", TUBE * 0.16 * k);
    u.f("uRadius", (TUBE * 0.5 - TUBE * 0.16) * k);
    u.f("uLevel", g.level);
    u.f("uLean", g.lean);
    u.f("uWobble", g.wobble);
    u.f("uTime", g.ring % (2 * Math.PI));
    u.v3("uTint", 0.94, 0.96, 1);
  });
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between" style={{ fontSize: pt(20, s), marginBottom: pt(10, s) }}>
        <span>{title}</span>
        <span className="tabular-nums" style={{ color: groundHex.muted }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="relative" style={{ height: pt(TUBE, s) }}>
        <Liquid radius="capsule" style={{ position: "absolute", inset: 0 }} />
        <canvas ref={canvas} data-motion aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}

/** Mercury Gauge: storage and battery stepping between values, as in the piece's scene, so the mercury runs with its
    front leaning into the run, lands on the value without passing it, and rings. */
export function MercuryGaugePreview() {
  const s = 0.32;
  const storage = [0.72, 0.31, 0.9, 0.12], battery = [0.34, 0.86, 0.05, 0.6];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((n) => n + 1), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: "0 12cqw", gap: pt(30, s) }}>
        <Gauge title="Storage" value={storage[step % storage.length]} s={s} />
        <Gauge title="Battery" value={battery[step % battery.length]} s={s} />
      </div>
    </Stage>
  );
}

// MARK: - Mercury Text

const MERCURY = COMMON + `
uniform sampler2D uTex;
uniform float uBevel, uTime, uFlow, uPull, uIridescence;
uniform vec2 uTouch;
uniform vec3 uTint;

vec3 studio(vec2 q, float t, float flow) {
  q.y += flow * (0.08 * sin(q.x * 3.3 + t * 1.2) + 0.04 * sin(q.x * 7.7 - t * 1.8 + q.y * 2.0));
  q.x += flow * 0.05 * sin(q.y * 3.9 - t * 0.9);
  float y = q.y;
  float sky = mix(0.66, 1.0, smoothstep(0.0, 0.75, y));
  float fl = mix(0.12, 0.36, smoothstep(0.0, -0.85, y));
  float v = mix(fl, sky, smoothstep(-0.012, 0.012, y));
  v += 0.4 * exp(-pow((y - 0.035) / 0.03, 2.0));
  v *= 1.0 - 0.55 * exp(-pow((y + 0.06) / 0.05, 2.0));
  vec2 bx = q - vec2(-0.55, 0.6);
  v += 0.55 * exp(-dot(bx, bx) / 0.04);
  return v * mix(vec3(1.0, 0.97, 0.93), vec3(0.94, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

/** The mask carries the blurred coverage in red, the layer the kernel reads, and the crisp coverage in green. */
float height(vec2 pos) { return texture2D(uTex, pos / cssSize()).r; }

void main() {
  vec2 size = cssSize(), pos = cssPosition();
  float here = texture2D(uTex, pos / size).g;
  if (here < 0.002) { gl_FragColor = vec4(0.0); return; }
  float tap = max(uBevel * 0.3, 0.5);
  float gx = height(pos + vec2(tap, 0.0)) - height(pos - vec2(tap, 0.0));
  float gy = height(pos + vec2(0.0, tap)) - height(pos - vec2(0.0, tap));
  vec2 slope = vec2(gx, -gy) / 0.48;
  vec3 n = normalize(vec3(-slope * 2.2, 1.0));
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  float face = (0.5 - pos.y / max(size.y, 1.0)) * 0.9;
  vec2 half_size = max(size * 0.5, vec2(1.0));
  vec2 light = clamp((uTouch - half_size) / half_size, -1.0, 1.0) * uPull;
  vec3 metal = studio(refl.xy + vec2(0.0, face) + light * vec2(-0.35, 0.35), uTime, uFlow) * uTint;
  float steep = 1.0 - n.z;
  metal = mix(metal, film(refl.x * 0.9 + refl.y * 0.6 + uTime * 0.05) * (0.65 + 0.45 * metal), clamp(uIridescence * steep * 1.2, 0.0, 0.6));
  metal = clamp(metal, 0.0, 1.0);
  gl_FragColor = vec4(metal * here, here);
}`;

/**
 * Mercury Text: "Metal" in the `.mercury` finish, the reflections rippling across the letters. The glyphs are drawn
 * white into a mask the size of the canvas, the web stand-in for SwiftUI's layer, and the kernel bevels them from
 * their own coverage. A pointer slides the studio toward it and lets it glide home.
 */
export function MercuryTextPreview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mask = useRef<{ canvas: HTMLCanvasElement; version: number } | null>(null);
  const touch = useRef<[number, number] | null>(null);
  const clock = useRef({ phase: 0, rate: 0, pull: 0, point: [0, 0] as [number, number], w: 0, h: 0 });

  useGL(canvas, MERCURY, (u, f) => {
    const c = clock.current, still = reduced();
    // Redraw the mask whenever the canvas changes size, at CSS pixels: the kernel samples it in those units.
    if (f.w !== c.w || f.h !== c.h || !mask.current) {
      c.w = f.w; c.h = f.h;
      const m = mask.current?.canvas ?? document.createElement("canvas");
      const k = f.dpr;
      m.width = Math.max(1, Math.round(f.w * k)); m.height = Math.max(1, Math.round(f.h * k));
      const ctx = m.getContext("2d")!;
      // Device pixels throughout: a shadow's offset and blur ignore the transform.
      const W = m.width, H = m.height, size = f.w * 0.27 * k, blur = Math.max(1.5, f.w * 0.27 * 0.075) * k;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.font = `600 ${size}px ${font.rounded}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Red: the glyphs blurred by half the bevel, SwiftUI's `.blur` before the layer effect. Drawn as the shadow of
      // text set far off the canvas, since a shadow blurs everywhere and `ctx.filter` does not.
      ctx.save();
      ctx.shadowColor = "#f00";
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = W * 2;
      ctx.fillStyle = "#f00";
      ctx.fillText("Metal", W / 2 - W * 2, H / 2);
      ctx.restore();
      // Green: the crisp glyphs, the mask that cuts the metal back out.
      ctx.fillStyle = "#0f0";
      ctx.fillText("Metal", W / 2, H / 2);
      mask.current = { canvas: m, version: (mask.current?.version ?? 0) + 1 };
    }
    c.rate = still ? 0 : ease(c.rate, 1, f.dt, 0.4);
    c.phase = (c.phase + c.rate * f.dt) % PERIOD;
    if (touch.current) c.point = c.pull < 0.01 ? touch.current : [ease(c.point[0], touch.current[0], f.dt, 0.12), ease(c.point[1], touch.current[1], f.dt, 0.12)];
    c.pull = ease(c.pull, touch.current ? 1 : 0, f.dt, touch.current ? 0.15 : 0.35);
    u.f("uBevel", Math.max(1.5, f.w * 0.27 * 0.075));
    u.f("uTime", c.phase);
    u.f("uFlow", still ? 0 : 1);
    u.v2("uTouch", c.point[0], c.point[1]);
    u.f("uPull", c.pull);
    u.v3("uTint", 0.93, 0.95, 1);
    u.f("uIridescence", 0.3);
  }, mask);

  const onMove = (e: ReactPointerEvent) => {
    const r = canvas.current?.getBoundingClientRect();
    if (r) touch.current = [e.clientX - r.left, e.clientY - r.top];
  };
  return (
    <Stage onPointerMove={onMove} onPointerLeave={() => { touch.current = null; }}>
      <canvas ref={canvas} data-motion aria-hidden className="absolute inset-0 h-full w-full" />
      <span className="sr-only">Metal</span>
    </Stage>
  );
}

// MARK: - Mercury Toggle

const BEAD = COMMON + `
uniform vec2 uLead, uTrail;
uniform float uRadius, uTime, uWobble;
uniform vec3 uTint;

float blend(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float field(vec2 p, vec2 lead, vec2 trail) {
  float r = uRadius;
  float stretch = clamp(length(lead - trail) / (r * 2.0), 0.0, 1.0);
  float a = length(p - lead) - r * (1.0 - 0.1 * stretch);
  float b = length(p - trail) - r * (0.92 - 0.3 * stretch);
  float d = blend(a, b, r * 1.1);
  vec2 k = p - lead;
  return d + uWobble * r * 0.07 * sin(atan(k.y, k.x) * 3.0 + uTime * 22.0) * sin(uTime * 9.0);
}
vec3 studio(vec3 r) {
  float y = r.y + 0.1 * r.x - 0.12;
  float sky = mix(0.72, 1.0, smoothstep(0.0, 0.8, y));
  float fl = mix(0.3, 0.5, smoothstep(0.0, -0.9, y));
  float v = mix(fl, sky, smoothstep(-0.1, 0.1, y));
  v += 0.25 * exp(-pow((y - 0.08) / 0.06, 2.0));
  v *= 1.0 - 0.28 * exp(-pow((y + 0.1) / 0.1, 2.0));
  vec2 bx = r.xy - vec2(-0.45, 0.55);
  v += 0.9 * exp(-dot(bx, bx) / 0.02);
  return v * mix(vec3(1.0, 0.98, 0.95), vec3(0.93, 0.96, 1.02), smoothstep(-0.2, 0.4, y));
}
void main() {
  vec2 pos = cssPosition();
  vec2 p = vec2(pos.x, -pos.y), l = vec2(uLead.x, -uLead.y), tr = vec2(uTrail.x, -uTrail.y);
  float d = field(p, l, tr);
  float sd = field(p + vec2(0.0, uRadius * 0.18), l, tr);
  float shadow = 0.32 * exp(-max(sd, 0.0) / (uRadius * 0.22)) * smoothstep(-1.0, 1.0, d);
  if (d > 0.75) { gl_FragColor = vec4(0.0, 0.0, 0.0, shadow); return; }
  const float e = 0.5;
  vec2 g = vec2(field(p + vec2(e, 0.0), l, tr) - field(p - vec2(e, 0.0), l, tr), field(p + vec2(0.0, e), l, tr) - field(p - vec2(0.0, e), l, tr));
  float gn = length(g);
  g = gn > 0.0001 ? g / gn : vec2(0.0, 1.0);
  float k = 1.0 - clamp(-d / (uRadius * 0.95), 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 n = normalize(vec3(g * k, sqrt(max(1.0 - k * k, 0.0)) + 0.0001));
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  vec3 metal = clamp(studio(refl) * uTint * mix(1.0, 0.45, pow(k, 3.0)), 0.0, 1.0);
  float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(metal * cover, cover + shadow * (1.0 - cover));
}`;

/** The Swift track, in points: 64 x 36, the bead 13 in radius and 5 in from each end. */
const TRACK_W = 64, TRACK_H = 36, BEAD_R = 13, BEAD_IN = 5;

/** The bead's two springs, stepped at 240 Hz exactly as `BeadPhysics` steps them, in points. */
function stepBead(b: { lead: number; leadV: number; trail: number; trailV: number; wobble: number; ring: number }, goal: number, dt: number, still: boolean) {
  let left = dt;
  while (left > 0) {
    const h = Math.min(left, 1 / 240);
    left -= h;
    if (still) { b.leadV = (goal - b.lead) * 18; b.lead += b.leadV * h; b.trail = b.lead; b.trailV = b.leadV; }
    else {
      b.leadV += (-(b.lead - goal) * 900 - b.leadV * 42) * h; b.lead += b.leadV * h;
      b.trailV += (-(b.trail - b.lead) * 260 - b.trailV * 22) * h; b.trail += b.trailV * h;
      const impact = Math.min(Math.abs(b.trailV) / 900, 1);
      if (impact > b.wobble) { b.wobble = impact; b.ring = 0; }
    }
    b.wobble *= Math.exp(-h / 0.25);
    b.ring += h;
  }
}

function MercurySwitch({ on, s, onFlip }: { on: boolean; s: number; onFlip: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const off = BEAD_IN + BEAD_R, end = TRACK_W - BEAD_IN - BEAD_R;
  const bead = useRef({ lead: on ? end : off, leadV: 0, trail: on ? end : off, trailV: 0, wobble: 0, ring: 0 });
  const goal = useRef(on ? end : off);
  goal.current = on ? end : off;
  useGL(canvas, BEAD, (u, f) => {
    const b = bead.current, k = f.w / TRACK_W;
    stepBead(b, goal.current, f.dt, reduced());
    u.v2("uLead", b.lead * k, (TRACK_H / 2) * k);
    u.v2("uTrail", b.trail * k, (TRACK_H / 2) * k);
    u.f("uRadius", BEAD_R * k);
    u.f("uTime", b.ring % (2 * Math.PI));
    u.f("uWobble", b.wobble);
    u.v3("uTint", 0.94, 0.96, 1);
  });
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onFlip} className="relative shrink-0 cursor-pointer" style={{ width: pt(TRACK_W, s), height: pt(TRACK_H, s) }}>
      <LiquidGroup unit={pt(1, s)} className="absolute inset-0">
        <Liquid radius="capsule" tint={on ? "rgba(255,0,0,0.9)" : undefined} style={{ width: pt(TRACK_W, s), height: pt(TRACK_H, s), transition: "background 260ms ease" } as CSSProperties} />
      </LiquidGroup>
      <canvas ref={canvas} data-motion aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </button>
  );
}

/** Mercury Toggle: two settings flipping in turn, as in the piece's scene, so the bead stretches into a slug, pulls
    itself round and rings. A click takes over from the script. */
export function MercuryTogglePreview() {
  const s = 0.32;
  const [live, setLive] = useState(true);
  const [voice, setVoice] = useState(false);
  const [scripted, setScripted] = useState(true);
  useEffect(() => {
    if (!scripted) return;
    let n = 0;
    const id = window.setInterval(() => { if (n++ % 2 === 0) setLive((v) => !v); else setVoice((v) => !v); }, 1050);
    return () => clearInterval(id);
  }, [scripted]);
  const rows: [string, boolean, () => void][] = [
    ["Live mode", live, () => { setScripted(false); setLive((v) => !v); }],
    ["Voice replies", voice, () => { setScripted(false); setVoice((v) => !v); }],
  ];
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: `0 12cqw`, gap: pt(26, s) }}>
        {rows.map(([title, on, flip]) => (
          <div key={title} className="flex items-center justify-between" style={{ fontSize: pt(20, s) }}>
            <span>{title}</span>
            <MercurySwitch on={on} s={s} onFlip={flip} />
          </div>
        ))}
      </div>
    </Stage>
  );
}
