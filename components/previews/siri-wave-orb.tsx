"use client";
import { useEffect, useRef } from "react";

/**
 * The Siri Wave orb, thinking phase: a WebGL port of the Metal kernel every orb piece ships
 * (four thin sine membranes through a refracting dark glass ball). Motion is fixed; the sphere
 * never moves, only the wave inside. `palette` tints it for what the screen portrays (a mood, a
 * breath), and a change glides over about a second. Falls back to a still dark ball when WebGL
 * is missing, and holds a still frame under reduced motion.
 */

/** Eight hex colours in kernel order: four bands, ground wash, crest, rim cool, rim warm. */
export type OrbPalette = { bands: [string, string, string, string]; ground: string; crest?: string; cool: string; warm: string };

/** The Siri Wave colours, same as the Metal pieces' `.siri`. */
export const SIRI: OrbPalette = { bands: ["#2b5cff", "#ff4fa3", "#ff6a2b", "#e3170a"], ground: "#12082e", crest: "#ffffff", cool: "#4d8aff", warm: "#ff4a1a" };

const UNIFORMS = ["C0", "C1", "C2", "C3", "BG", "HI", "COOL", "WARM"] as const;

function flatten(p: OrbPalette): number[] {
  const hex = [...p.bands, p.ground, p.crest ?? "#ffffff", p.cool, p.warm];
  return hex.flatMap((h) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  });
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

const float SPEED = 1.311;
const float SEP = 2.05;
const float SPREAD = 0.0;
const float DETUNE = 0.05;
const float AMP = 0.266;
const float FREQ = 1.45;
const float WIDTH = 0.115;
const float TAPER = 1.75;
const float GROUND = 0.08;
const float MODEL = 0.1;
const float REFR = 0.5;
const float DISP = 0.72;
const float SHEEN = 0.36;
const float EXPOSURE = 2.15;
const float R = 0.45;

uniform vec3 C0;
uniform vec3 C1;
uniform vec3 C2;
uniform vec3 C3;
uniform vec3 BG;
uniform vec3 HI;
uniform vec3 COOL;
uniform vec3 WARM;

float sat(float x) { return clamp(x, 0.0, 1.0); }

float glassProfile(float depth, float w) {
  float d = sat(depth / max(w, 0.001));
  return pow(1.0 - sqrt(max(1.0 - (1.0 - d) * (1.0 - d), 0.0)), 0.68);
}

float lobe(vec2 n, vec2 dir, float cut, float power) {
  return pow(sat((dot(n, dir) - cut) / max(1.0 - cut, 0.001)), power);
}

vec3 modelBody(vec3 c, vec2 p) {
  c = mix(c, HI, MODEL * 0.22 * smoothstep(0.15, 1.15, dot(p, vec2(-0.32, 0.78))));
  c *= 1.0 - MODEL * 0.34 * smoothstep(-0.1, 1.2, dot(p, vec2(0.45, -0.62)));
  c *= 1.0 - MODEL * 0.22 * smoothstep(0.72, 1.08, length(p));
  return clamp(c, 0.0, 1.0);
}

vec3 interior(vec2 p, float t) {
  float env = pow(sat(1.0 - p.x * p.x), TAPER);
  float drift = t * 2.4;
  float total = 0.0;
  float dominant = 0.0;
  vec3 spectral = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float centred = float(i) - 1.5;
    float amp = AMP * (1.0 - abs(centred) * DETUNE * 1.1) * (0.82 + 0.18 * sin(t * 0.48 + centred * 1.1));
    float wave = sin(p.x * FREQ * (1.0 + centred * DETUNE) + drift + centred * SEP);
    float bw = WIDTH * (1.0 + abs(centred) * 0.55);
    float d = p.y - (env * amp * wave + centred * SPREAD);
    float w = exp(-d * d / max(bw * bw, 0.0001)) * env;
    vec3 tint = i == 0 ? C0 : i == 1 ? C1 : i == 2 ? C2 : C3;
    spectral += tint * w * w;
    dominant += w * w;
    total += w;
  }
  spectral /= max(dominant, 0.0001);
  float dMain = p.y - env * AMP * sin(p.x * FREQ + drift);
  float crest = exp(-dMain * dMain / 0.0028) * env;
  vec3 col = mix(vec3(0.0), BG, smoothstep(-0.82, 0.82, p.y)) * GROUND;
  col += spectral * (1.0 - exp(-total * 0.7)) * env * 1.14;
  col += HI * crest * 0.18;
  col /= 1.0 + col * 0.19;
  return modelBody(col, p);
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;
  float px = 1.0 / m;
  float t = uTime * SPEED;

  vec2 p = uv / R;
  float pd = length(p);
  vec2 nrm = pd > 0.0001 ? p / pd : vec2(0.0, 1.0);
  float ball = 1.0 - smoothstep(1.0 - px / R, 1.0 + px / R, pd);

  float edgeDepth = max(1.0 - pd, 0.0);
  float profile = glassProfile(edgeDepth, 0.05 + 0.42 * DISP);
  vec2 rp = p - nrm * (1.15 * REFR * profile);

  vec3 col = interior(rp, t);
  float split = 0.14 * DISP * REFR * profile;
  if (split > 0.0008) {
    vec3 lo = interior(rp - nrm * split, t);
    vec3 up = interior(rp + nrm * split, t);
    col = vec3(lo.r, col.g, up.b);
  }

  float rim = pow(1.0 - smoothstep(0.0, 0.026 + 0.075 * DISP, edgeDepth), 1.8) * ball;
  col = mix(col, HI, rim * REFR * 0.28);
  float disp = rim * DISP * 1.12;
  col = mix(col, COOL, disp * lobe(nrm, normalize(vec2(0.84, 0.54)), -0.32, 1.8));
  col = mix(col, WARM, disp * lobe(nrm, normalize(vec2(-0.62, -0.78)), -0.28, 2.0));
  col *= 1.0 - rim * 0.12 * max(dot(nrm, vec2(0.45, -0.89)), 0.0);
  col = mix(col, HI, sat(rim * lobe(nrm, normalize(vec2(-0.68, 0.73)), 0.2, 2.8) * SHEEN * 1.4));
  col = mix(col, COOL, sat(rim * lobe(nrm, normalize(vec2(0.74, -0.67)), 0.4, 3.6) * SHEEN));

  float mask = 1.0 - smoothstep(R - px, R + px, length(uv));
  col = clamp(col * EXPOSURE, 0.0, 1.0);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = clamp(mix(vec3(l), col, 1.32), 0.0, 1.0);
  gl_FragColor = vec4(col * mask, mask);
}`;

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/** Diameter is any CSS length. The ball fills 90% of the square, like the Metal kernel. */
export function SiriWaveOrb({ size, palette = SIRI, className, style }: { size: string | number; palette?: OrbPalette; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(flatten(palette));
  target.current = flatten(palette);
  const redraw = useRef<(() => void) | null>(null);
  const key = target.current.join(",");
  useEffect(() => { redraw.current?.(); }, [key]);

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
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uColors = UNIFORMS.map((n) => gl.getUniformLocation(prog, n));
    // Current colours ease toward the target each frame, so a palette change glides.
    const current = [...target.current];

    const fit = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.getBoundingClientRect().width * d));
      if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
    };
    const draw = (seconds: number) => {
      fit();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      uColors.forEach((u, i) => gl.uniform3f(u, current[i * 3], current[i * 3 + 1], current[i * 3 + 2]));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const ease = (k: number) => target.current.forEach((v, i) => { current[i] += (v - current[i]) * k; });
    const tick = (now: number) => {
      ease(0.06);
      draw((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    // First frame now, so a hidden tab or a paused RAF still shows the orb.
    draw(reduce ? 1.2 : 0);
    // Reduced motion snaps to a new palette and redraws the still frame.
    redraw.current = () => { if (reduce) { ease(1); draw(1.2); } };
    if (!reduce) raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => draw(reduce ? 1.2 : (performance.now() - start) / 1000));
    ro.observe(canvas);
    // No loseContext here: StrictMode re-runs this effect on the same canvas, and a lost
    // context would never draw again. The program and buffer are released instead.
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      redraw.current = null;
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  const d = typeof size === "number" ? `${size}px` : size;
  return (
    <canvas
      ref={ref}
      data-motion
      aria-hidden
      className={className}
      style={{ width: d, height: d, display: "block", borderRadius: "50%", ...style }}
    />
  );
}
