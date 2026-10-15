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

// MARK: - Metal Halo

const HALO = COMMON + `
uniform float uPad, uWidth, uPhase, uPull, uGlow, uEnergy;
uniform vec2 uTouch;
uniform vec3 uGlowTint;

float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float field(vec2 p, vec2 b, float r, vec2 f, float reach, float swell) { vec2 k = p - f; return box(p, b, r) - uPull * swell * exp(-dot(k, k) / (reach * reach)); }

vec3 studio(vec3 r, float t) {
  vec2 q = r.xy;
  q.y += 0.06 * sin(q.x * 4.0 + t * 0.9) + 0.035 * sin(q.x * 9.0 - t * 1.4);
  float y = q.y + 0.05;
  float sky = mix(0.62, 0.98, smoothstep(0.0, 0.8, y));
  float fl = mix(0.07, 0.24, smoothstep(0.0, -0.9, y));
  float v = mix(fl, sky, smoothstep(-0.02, 0.02, y));
  v += 0.45 * exp(-pow((y - 0.05) / 0.035, 2.0));
  v *= 1.0 - 0.55 * exp(-pow((y + 0.08) / 0.06, 2.0));
  vec2 bx = q - vec2(-0.55, 0.6);
  v += 0.6 * exp(-dot(bx, bx) / 0.04);
  return v * mix(vec3(1.0, 0.97, 0.93), vec3(0.93, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

void main() {
  vec2 size = cssSize(), pos = cssPosition(), c = size * 0.5;
  vec2 p = vec2(pos.x - c.x, c.y - pos.y);
  vec2 f = vec2(uTouch.x - c.x, c.y - uTouch.y);
  vec2 b = max(c - uPad, vec2(1.0));
  float r = min(b.x, b.y);
  float reach = max(r * 0.9, 8.0), swell = uWidth * 1.6 + 1.5;
  float d = field(p, b, r, f, reach, swell);
  const float e = 0.5;
  vec2 g = vec2(field(p + vec2(e, 0.0), b, r, f, reach, swell) - field(p - vec2(e, 0.0), b, r, f, reach, swell),
                field(p + vec2(0.0, e), b, r, f, reach, swell) - field(p - vec2(0.0, e), b, r, f, reach, swell));
  float gn = length(g);
  g = gn > 0.0001 ? g / gn : vec2(0.0, 1.0);
  float hw = max(uWidth * 0.5, 0.5);
  float s = clamp((d + hw) / hw, -1.0, 1.0);
  vec3 n = normalize(vec3(g * s, sqrt(max(1.0 - s * s, 0.0)) + 0.0001));
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  vec3 ring = studio(refl, uPhase) * mix(0.42, 1.0, uEnergy);
  float wander = 2.3562 + 0.8 * uPhase + 0.45 * sin(0.55 * uPhase);
  float aim = atan(f.y, f.x);
  float hot = wander + atan(sin(aim - wander), cos(aim - wander)) * uPull;
  float theta = atan(p.y, p.x);
  float dh = atan(sin(theta - hot), cos(theta - hot));
  float lobe = exp(-dh * dh / 0.18);
  float back = exp(-pow(abs(dh) - 3.14159265, 2.0) / 0.12) * 0.35;
  ring += uEnergy * (lobe * 1.1 + back) * (0.55 + 0.45 * n.z);
  float fringe = exp(-pow(abs(dh) - 0.6, 2.0) / 0.05);
  ring = mix(ring, film(dh * 0.55 + refl.x * 0.25), uEnergy * fringe * 0.5 * (0.45 + 0.55 * (1.0 - n.z)));
  ring = clamp(ring, 0.0, 1.0);
  float cover = clamp((hw - abs(d + hw)) / 0.6 + 0.5, 0.0, 1.0);
  float edge = min(c.x - abs(p.x), c.y - abs(p.y));
  float bloom = uGlow * uEnergy * (lobe + back * 0.5) * exp(-max(d, 0.0) / max(uPad * 0.3, 1.0)) * smoothstep(-1.0, 1.0, d) * smoothstep(0.0, uPad * 0.6, edge);
  float ga = clamp(bloom * 0.7, 0.0, 1.0);
  gl_FragColor = vec4(ring * cover + uGlowTint * ga * (1.0 - cover), cover + ga * (1.0 - cover));
}`;

/** The send button at 44 pt, its ring 2 pt wide and the bloom's room 14 pt each side: the Swift defaults. */
const BUTTON = 44, RING = 2, ROOM = 14;
const DRAFT = "Build a habit tracker";

/**
 * Metal Halo on an agent's prompt bar, as in the piece's preview: the draft types itself, the halo lights as there is
 * something to send, the send button sinks, the draft clears and the ring dims to plain steel, and round again. The
 * hot spot wanders round the chrome all the while, and a pointer over the button bends the ring toward it.
 */
export function MetalHaloPreview() {
  const s = 0.2;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [typed, setTyped] = useState(DRAFT.length);
  const [pressed, setPressed] = useState(false);
  const touch = useRef<[number, number] | null>(null);
  const state = useRef({ phase: 0, rate: 0, pull: 0, point: [0, 0] as [number, number], energy: 1 });
  const active = typed > 0;
  const live = useRef(active);
  live.current = active;

  useEffect(() => {
    // Type 1.4 s, hold, press at 3.4 s, clear, rest dim, round again at 5.6 s.
    let alive = true;
    const timers: number[] = [];
    const run = () => {
      if (!alive) return;
      setTyped(0);
      for (let i = 1; i <= DRAFT.length; i++) timers.push(window.setTimeout(() => setTyped(i), 300 + i * 50));
      timers.push(window.setTimeout(() => setPressed(true), 3400));
      timers.push(window.setTimeout(() => { setPressed(false); setTyped(0); }, 3560));
      timers.push(window.setTimeout(run, 5600));
    };
    timers.push(window.setTimeout(run, 2200));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  useGL(canvas, HALO, (u, f) => {
    const st = state.current, still = reduced();
    st.rate = still ? 0 : ease(st.rate, 1, f.dt, 0.4);
    st.phase = (st.phase + st.rate * f.dt) % PERIOD;
    if (touch.current) st.point = touch.current;
    st.pull = ease(st.pull, touch.current ? 1 : 0, f.dt, touch.current ? 0.1 : 0.3);
    st.energy = ease(st.energy, live.current ? 1 : 0, f.dt, 0.16);
    const k = f.w / (BUTTON + ROOM * 2);
    u.f("uPad", ROOM * k);
    u.f("uWidth", RING * k);
    u.f("uPhase", st.phase);
    u.f("uPull", st.pull);
    u.v2("uTouch", st.point[0], st.point[1]);
    u.f("uGlow", 1);
    u.f("uEnergy", st.energy);
    u.v3("uGlowTint", 0.86, 0.92, 1);
  });

  const onMove = (e: ReactPointerEvent) => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    touch.current = x >= 0 && y >= 0 && x <= r.width && y <= r.height ? [x, y] : null;
  };

  return (
    <Stage onPointerMove={onMove} onPointerLeave={() => { touch.current = null; }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: pt(330, s), padding: pt(16, s), borderRadius: pt(26, s), background: "#1c1c1c" }}>
          <div className="whitespace-nowrap" style={{ fontSize: pt(17, s), height: pt(24, s), color: typed ? groundHex.text : "rgba(244,243,239,0.4)" }}>
            {typed ? DRAFT.slice(0, typed) : "Build anything…"}
          </div>
          <div className="flex items-center" style={{ marginTop: pt(16, s), gap: pt(10, s) }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: pt(BUTTON, s), height: pt(BUTTON, s), background: "#292929", fontSize: pt(22, s), color: "rgba(244,243,239,0.8)" }}>+</span>
            <span className="flex-1" />
            <span className="flex items-center rounded-full" style={{ height: pt(BUTTON, s), padding: `0 ${pt(16, s)}`, background: "#292929", fontSize: pt(15, s), color: "rgba(244,243,239,0.85)" }}>Agent</span>
            <span className="relative" style={{ width: pt(BUTTON, s), height: pt(BUTTON, s), transform: `scale(${pressed ? 0.94 : 1})`, transition: "transform 140ms cubic-bezier(.2,.8,.2,1)" }}>
              <span className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "#0f0f0f" }}>
                <svg viewBox="0 0 24 24" style={{ width: pt(19, s), height: pt(19, s) }} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </span>
              <canvas ref={canvas} data-motion aria-hidden className="pointer-events-none absolute" style={{ inset: `-${pt(ROOM, s)}`, width: `calc(100% + ${pt(ROOM * 2, s)})`, height: `calc(100% + ${pt(ROOM * 2, s)})` }} />
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Chrome Badge

const BADGE = COMMON + `
uniform float uPad, uTime, uFlow, uGlint, uIridescence, uGlow;
uniform vec3 uTint, uGlowTint;

vec3 studio(vec2 q, float t, float flow) {
  q.y += flow * (0.07 * sin(q.x * 3.6 + t * 1.1) + 0.04 * sin(q.x * 8.2 - t * 1.6 + q.y * 2.0));
  q.x += flow * 0.05 * sin(q.y * 4.0 - t * 0.8);
  float y = q.y;
  float sky = mix(0.86, 1.0, smoothstep(0.0, 0.7, y));
  float fl = mix(0.6, 0.78, smoothstep(0.0, -0.8, y));
  float v = mix(fl, sky, smoothstep(-0.015, 0.015, y));
  v += 0.2 * exp(-pow((y - 0.04) / 0.03, 2.0));
  v *= 1.0 - 0.3 * exp(-pow((y + 0.07) / 0.05, 2.0));
  vec2 bx = q - vec2(-0.5, 0.55);
  v += 0.35 * exp(-dot(bx, bx) / 0.05);
  v *= mix(1.0, 0.45, smoothstep(0.75, 1.0, length(q)));
  return vec3(v);
}

void main() {
  vec2 size = cssSize(), pos = cssPosition(), c = size * 0.5;
  vec2 p = vec2(pos.x - c.x, c.y - pos.y);
  vec2 b = max(c - uPad, vec2(1.0));
  float r = min(b.x, b.y);
  vec2 spine = vec2(clamp(p.x, -(b.x - r), b.x - r), 0.0);
  vec2 away = p - spine;
  float len = length(away);
  float d = len - r;
  vec2 g = len > 0.0001 ? away / len : vec2(0.0, 1.0);
  float k = 1.0 - clamp(max(-d, 0.0) / (r * 0.55), 0.0, 1.0);
  vec3 n = vec3(g * k, sqrt(max(1.0 - k * k, 0.0)));
  n.xy += vec2(p.x / b.x * 0.08, p.y / b.y * 0.18) * (1.0 - k);
  n = normalize(n);
  vec3 refl = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  vec3 metal = studio(refl.xy + vec2(0.0, p.y / b.y * 0.35 + 0.18), uTime, uFlow) * uTint;
  metal = mix(metal, film(refl.x * 0.8 + refl.y * 0.5 + uTime * 0.05) * (0.75 + 0.35 * metal), uIridescence * pow(k, 1.4) * 0.5);
  float u = p.x / b.x + p.y / b.y * 0.45;
  metal += 0.55 * exp(-pow((u - uGlint) / 0.16, 2.0));
  metal *= mix(1.0, 0.62, smoothstep(-1.4, 0.0, d));
  metal = clamp(metal, 0.0, 1.0);
  float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
  float lean = 0.55 + 0.45 * dot(normalize(p + vec2(0.0001)), vec2(-0.7071, 0.7071));
  float edge = min(c.x - abs(p.x), c.y - abs(p.y));
  float bloom = uGlow * lean * exp(-max(d, 0.0) / max(uPad * 0.3, 1.0)) * smoothstep(-1.0, 1.0, d) * smoothstep(0.0, uPad * 0.6, edge);
  float ga = clamp(bloom * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(metal * cover + uGlowTint * ga * (1.0 - cover), cover + ga * (1.0 - cover));
}`;

/** The Swift `ChromeBadge.Finish` presets the preview shows, same values. */
const FINISHES = {
  chrome: { tint: [1, 1, 1], ink: "#141414", engrave: "rgba(255,255,255,0.55)", iridescence: 0.6, glow: [0.8, 0.88, 1] },
  gold: { tint: [1, 0.8, 0.46], ink: "#2b1c05", engrave: "rgba(255,255,255,0.55)", iridescence: 0.22, glow: [1, 0.84, 0.6] },
} as const;

/** A sweep crosses in 1.1 s, a beat after the badge appears, then every 5 s: the Swift clock. */
function glintAt(elapsed: number): number {
  const t = (elapsed - 0.35) % 5;
  if (elapsed <= 0.35 || t >= 1.1) return 9;
  const x = t / 1.1;
  return -1.6 + 3.2 * x * x * (3 - 2 * x);
}

function Badge({ label, finish, size, s, offset = 0, icon }: { label: string; finish: keyof typeof FINISHES; size: number; s: number; offset?: number; icon?: ReactNode }) {
  const f = FINISHES[finish];
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ phase: 0, elapsed: -offset });
  useGL(canvas, BADGE, (u, fr) => {
    const c = clock.current, still = reduced();
    if (!still) { c.phase = (c.phase + fr.dt) % PERIOD; c.elapsed += fr.dt; }
    // The canvas is the capsule (1.85 x the text) plus 1.2 x the text of room on each side.
    u.f("uPad", fr.h * (1.2 / (1.85 + 2.4)));
    u.f("uTime", c.phase);
    u.f("uFlow", still ? 0 : 1);
    u.f("uGlint", still ? 9 : glintAt(c.elapsed));
    u.v3("uTint", f.tint[0], f.tint[1], f.tint[2]);
    u.f("uIridescence", f.iridescence);
    u.f("uGlow", 1);
    u.v3("uGlowTint", f.glow[0], f.glow[1], f.glow[2]);
  });
  return (
    <span className="relative inline-flex items-center whitespace-nowrap" style={{ height: pt(size * 1.85, s), padding: `0 ${pt(size * 0.72, s)}`, gap: pt(size * 0.3, s), fontSize: pt(size, s), color: f.ink, textShadow: `0 ${pt(0.75, s)} 0 ${f.engrave}` }}>
      <canvas ref={canvas} data-motion aria-hidden className="pointer-events-none absolute" style={{ left: `-${pt(size * 1.2, s)}`, top: `-${pt(size * 1.2, s)}`, width: `calc(100% + ${pt(size * 2.4, s)})`, height: `calc(100% + ${pt(size * 2.4, s)})` }} />
      {icon ? <span className="relative">{icon}</span> : null}
      <span className="relative">{label}</span>
    </span>
  );
}

/** Chrome Badge: "New" in chrome beside a setting and "Pro" in gold, the glint sweeping across each in turn and the
    reflections rippling, on the dark ground the piece's preview uses. */
export function ChromeBadgePreview() {
  const s = 0.2;
  const sparkles = (
    <svg viewBox="0 0 24 24" style={{ width: pt(17, s), height: pt(17, s) }} fill="currentColor" aria-hidden><path d="M10 3c.5 4 2.4 6.3 7 7-4.6.7-6.5 3-7 7-.5-4-2.4-6.3-7-7 4.6-.7 6.5-3 7-7ZM18.5 13c.25 2 1.2 3.1 3.5 3.5-2.3.4-3.25 1.5-3.5 3.5-.25-2-1.2-3.1-3.5-3.5 2.3-.4 3.25-1.5 3.5-3.5Z" /></svg>
  );
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col items-start justify-center" style={{ paddingLeft: "14cqw", gap: pt(30, s) }}>
        <div className="flex items-center" style={{ gap: pt(14, s) }}>
          <span style={{ fontSize: pt(34, s), color: "rgba(244,243,239,0.8)" }}>Live mode</span>
          <Badge label="New" finish="chrome" size={18} s={s} />
        </div>
        <div className="flex items-center" style={{ gap: pt(14, s) }}>
          <span style={{ fontSize: pt(34, s), color: "rgba(244,243,239,0.8)" }}>Agents</span>
          <Badge label="Pro" finish="gold" size={18} s={s} offset={2.5} icon={sparkles} />
        </div>
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
