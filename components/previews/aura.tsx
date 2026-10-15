"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { font, ground, ink, signal } from "./palette";
import { Liquid, LiquidGroup, MorphText } from "./piece-liquid";
import { reduced, roles, springValue, t as tr } from "./piece-motion";

/**
 * The aura pieces: Aura Composer, Mood Check-in, Breath Pacer and Aura Reveal. Each draws its aura with a WebGL port
 * of its Metal kernel (the same pools, paths, energy and grain), and its chrome with piece-liquid. The stage is 4:3,
 * 100cqw wide; 1 iOS point is 0.19cqw, scaled per piece so it fills the stage. All text is semibold.
 */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const units = (s: number) => (n: number) => p(n * s);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600, ...style }}>{children}</div>;
}

/** Seconds since mount, modulo `period`, refreshed every animation frame while mounted. */
function useLoop(period: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (at: number) => {
      setNow(((at - start) / 1000) % period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period]);
  return now;
}

// MARK: - Aura

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/** The pieces' aura kernel: four pools on closed paths over a wash of their average, blended by soft weights. */
const AURA = `
precision highp float;
uniform vec2 uRes;
uniform float uDpr, uPhase, uEnergy, uScale;
uniform vec3 uC0, uC1, uC2, uC3;
void main() {
  vec2 size = uRes / uDpr;
  vec2 pos = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  float side = max(max(size.x, size.y), 1.0);
  vec2 p = (pos - size * 0.5) / side * uScale;
  vec3 wash = (uC0 + uC1 + uC2 + uC3) * 0.25;
  vec3 sum = wash * 0.5;
  float total = 0.5;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 r = i == 0 ? vec2(3.0, 2.0) : (i == 1 ? vec2(2.0, 5.0) : (i == 2 ? vec2(4.0, 3.0) : vec2(5.0, 4.0)));
    vec3 c = i == 0 ? uC0 : (i == 1 ? uC1 : (i == 2 ? uC2 : uC3));
    vec2 centre = 0.42 * vec2(sin(uPhase * r.x + fi * 1.9), cos(uPhase * r.y + fi * 2.7));
    centre += 0.12 * uEnergy * vec2(sin(uPhase * (13.0 + fi) + fi), cos(uPhase * (11.0 + fi) + fi * 1.3));
    vec2 d = p - centre;
    float w = exp(-dot(d, d) / (0.16 + 0.06 * uEnergy));
    sum += c * w;
    total += w;
  }
  vec3 aura = sum / total * (1.0 + 0.12 * uEnergy);
  float grain = fract(sin(dot(pos, vec2(127.1, 311.7))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(clamp(aura + grain * 0.02, 0.0, 1.0), 1.0);
}`;

/**
 * A canvas of aura filling its box. The energy eases toward `energy` and the phase advances faster with it, as
 * AuraClock does in Swift; under reduced motion the aura holds still. `seed` starts the loop somewhere else, so two
 * auras on one page don't drift in step. Without WebGL the box shows the colours' first pool as a flat fill.
 */
function Aura({ colors, energy = 0, scale = 1, seed = 0, className, style }: { colors: string[]; energy?: number; scale?: number; seed?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ colors, energy, scale });
  live.current = { colors, energy, scale };
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
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, AURA));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const at = (n: string) => gl.getUniformLocation(prog, n);
    const still = reduced();
    let phase = seed, energy = live.current.energy, raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      const goal = live.current.energy;
      energy = still ? goal : energy + (goal - energy) * (1 - Math.exp(-dt / 0.4));
      phase = (phase + (still ? 0 : dt * 0.066 * (1 + 1.4 * energy))) % (2 * Math.PI);
      // The layout size, before any CSS scale, so a swelling orb never resizes its canvas mid-breath.
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.offsetWidth * dpr)), h = Math.max(1, Math.round(canvas.offsetHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(at("uRes"), w, h);
      gl.uniform1f(at("uDpr"), dpr);
      gl.uniform1f(at("uPhase"), phase);
      gl.uniform1f(at("uEnergy"), energy);
      gl.uniform1f(at("uScale"), live.current.scale);
      const cs = live.current.colors;
      ["uC0", "uC1", "uC2", "uC3"].forEach((n, i) => gl.uniform3f(at(n), ...rgb(cs[i % cs.length])));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seed]);
  return <canvas ref={ref} aria-hidden className={className} style={{ display: "block", width: "100%", height: "100%", background: colors[0], ...style }} />;
}

const lilac = "#cdb8ff", sky = "#9cc2ff", butter = "#ffd976", sage = "#a9dcb7";

/** SF Symbol stand-ins, drawn on a 24 grid. */
const G = {
  plus: "M12 5v14M5 12h14",
  up: "M12 19V5M6 11l6-6 6 6",
};
function Glyph({ d, size, u, stroke = 2.4 }: { d: string; size: number; u: (n: number) => string; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size) }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

// MARK: - Aura Composer

const composerU = units(1.35);
const TYPED = "Plan a slow Saturday in Lisbon";

/** A question typed and sent, the aura churning while the reply streams, then settling. Times are in seconds. */
export function AuraComposerPreview() {
  const u = composerU;
  const t = useLoop(8.4);
  const typing = clamp((t - 0.9) / 1.8);
  const text = t < 3.1 ? TYPED.slice(0, Math.round(TYPED.length * typing)) : "";
  const focused = t > 0.6 && t < 7.4;
  const responding = t >= 3.1 && t < 6.2;
  const canSend = text.length > 0 && !responding;
  const glow = responding ? 1 : focused ? 0.7 : 0.35;
  const energy = responding ? 1 : focused ? 0.3 : 0;
  const BUBBLE = 46, corner = BUBBLE / 2 + 2;
  // The send bubble pops as the message leaves.
  const since = t - 3.1;
  const pop = since > 0 && since < 0.5 && !reduced() ? (since < 0.08 ? 1 - 0.032 * (since / 0.08) : 1 + 0.08 * (1 - springValue(roles.success, since - 0.08)) * Math.cos((since - 0.08) * 9)) : 1;
  return (
    <Stage>
      <div className="relative" style={{ width: u(340) }}>
        <div aria-hidden className="absolute" style={{ inset: u(-8), borderRadius: u(corner + 8), overflow: "hidden", filter: `blur(${u(18)})`, opacity: glow, transition: tr("opacity", "ambient") }}>
          <Aura colors={[lilac, sky, butter, sage]} energy={energy} scale={1.4} seed={1.2} />
        </div>
        <LiquidGroup unit={u(1)} style={{ color: ground.text }}>
          <div className="flex items-end" style={{ gap: u(4) }}>
            <Liquid radius={corner} className="flex min-w-0 flex-1 items-center" style={{ minHeight: u(BUBBLE), paddingLeft: u(4), paddingRight: u(14) }}>
              <span className="grid shrink-0 place-items-center" style={{ width: u(BUBBLE - 8), height: u(BUBBLE - 8), opacity: 0.7 }}><Glyph d={G.plus} size={18} u={u} /></span>
              <span className="truncate" style={{ fontSize: u(17), color: text ? ground.text : ground.subtle }}>
                {text || "Ask anything"}
                {focused && !responding ? <span aria-hidden style={{ display: "inline-block", width: u(2), height: u(20), marginLeft: u(1), verticalAlign: "middle", background: ground.text, opacity: Math.floor(t * 2) % 2 ? 0 : 1 }} /> : null}
              </span>
            </Liquid>
            <Liquid
              tint={responding ? ground.text : canSend ? signal.fill : undefined}
              className="grid shrink-0 place-items-center"
              style={{ width: u(BUBBLE), height: u(BUBBLE), transform: `scale(${pop})`, transition: tr("background", "morph") }}
            >
              {responding
                ? <span style={{ width: u(13), height: u(13), borderRadius: u(3), background: ground.bg }} />
                : <span style={{ color: canSend ? ink : ground.text, opacity: canSend ? 1 : 0.35, display: "grid" }}><Glyph d={G.up} size={18} u={u} stroke={2.6} /></span>}
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

// MARK: - Mood Check-in

const moodU = units(1.12);
const MOODS: { name: string; colors: string[] }[] = [
  { name: "Drained", colors: ["#b0b5cc", "#c2b8e6", "#9eabc7", "#cccddb"] },
  { name: "Low", colors: [sky, lilac, "#b8ccf2", "#b3d6db"] },
  { name: "Okay", colors: [sage, sky, "#ede6b3", lilac] },
  { name: "Good", colors: [butter, sage, "#ffc799", sky] },
  { name: "Great", colors: [butter, "#ff9e8c", "#ffbfd9", lilac] },
];
const STEPS = MOODS.length - 1;

/** The four pools at `value`: each blends from the lower mood's colour to the upper's. */
function moodPalette(value: number): string[] {
  const at = clamp(value) * STEPS, lower = Math.floor(at), upper = Math.min(lower + 1, STEPS), f = at - lower;
  return [0, 1, 2, 3].map((i) => toHex(mix(rgb(MOODS[lower].colors[i]), rgb(MOODS[upper].colors[i]), f)));
}

/** Drag the thumb, or watch it sweep: the aura blends through each mood and the name morphs. */
export function MoodCheckInPreview() {
  const u = moodU;
  const W = 300, THUMB = 30;
  const [value, setValue] = useState(0.5);
  const [held, setHeld] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const touched = useRef(0);
  const goal = useRef(0.5);
  // Untouched, the thumb glides between moods on its own, the way the Swift scene sweeps it.
  useEffect(() => {
    const stops = [0, 1, 0.75, 0.25];
    let i = 0;
    const step = window.setInterval(() => {
      if (performance.now() - touched.current < 4000) return;
      goal.current = stops[i++ % stops.length];
    }, 1800);
    let raf = 0, last = performance.now();
    const glide = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (performance.now() - touched.current > 4000) setValue((v) => (Math.abs(goal.current - v) < 0.001 ? goal.current : v + (goal.current - v) * (1 - Math.exp(-dt / 0.28))));
      raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);
    return () => { window.clearInterval(step); cancelAnimationFrame(raf); };
  }, []);
  const at = (e: ReactPointerEvent) => {
    const r = track.current!.getBoundingClientRect(), thumb = (r.width * THUMB) / W;
    return clamp((e.clientX - r.left - thumb / 2) / (r.width - thumb));
  };
  const index = Math.round(clamp(value) * STEPS);
  const palette = moodPalette(value);
  return (
    <Stage>
      <div style={{ width: u(W) }}>
        <div className="relative overflow-hidden" style={{ height: u(220), borderRadius: u(28) }}>
          <Aura colors={palette} energy={held ? 0.7 : 0.15} scale={1.1} seed={2.4} />
          <div className="absolute bottom-0 left-0" style={{ padding: u(22), color: ink }}>
            <p style={{ fontSize: u(15), opacity: 0.62 }}>How are you feeling?</p>
            <MorphText text={MOODS[index].name} style={{ fontSize: u(34), letterSpacing: "-0.02em", lineHeight: 1.15 }} />
          </div>
        </div>
        <div
          ref={track}
          role="slider"
          aria-label="How are you feeling?"
          aria-valuetext={MOODS[index].name}
          aria-valuenow={index}
          aria-valuemin={0}
          aria-valuemax={STEPS}
          tabIndex={0}
          className="relative touch-none"
          style={{ height: u(44), marginTop: u(14), cursor: "grab" }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); touched.current = performance.now(); setHeld(true); setValue(at(e)); }}
          onPointerMove={(e) => { if (!held) return; touched.current = performance.now(); setValue(at(e)); }}
          onPointerUp={() => { touched.current = performance.now(); setHeld(false); goal.current = Math.round(value * STEPS) / STEPS; setValue(goal.current); }}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
            if (!d) return;
            touched.current = performance.now();
            setValue(clamp((index + d) / STEPS));
          }}
        >
          <span className="absolute rounded-full" style={{ left: u(THUMB / 2), right: u(THUMB / 2), top: "50%", height: u(6), transform: "translateY(-50%)", background: ground.trough }} />
          {MOODS.map((m, i) => (
            <span key={m.name} className="absolute rounded-full" style={{ width: u(4), height: u(4), top: "50%", left: `calc(${u(THUMB / 2 - 2)} + (100% - ${u(THUMB)}) * ${i / STEPS})`, transform: "translateY(-50%)", background: ground.subtle }} />
          ))}
          <div className="absolute" style={{ top: "50%", left: `calc((100% - ${u(THUMB)}) * ${value})`, transform: "translateY(-50%)", transition: held ? undefined : tr("left", "settle") }}>
            <LiquidGroup unit={u(1)}>
              <Liquid tint={palette[0]} style={{ width: u(THUMB), height: u(THUMB), transform: `scale(${held ? 1.18 : 1})`, transition: tr("transform", held ? "press" : "release") }} />
            </LiquidGroup>
          </div>
        </div>
        <div className="flex justify-between" style={{ marginTop: u(14), fontSize: u(13), color: ground.subtle }} aria-hidden>
          <span>{MOODS[0].name}</span>
          <span>{MOODS[STEPS].name}</span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Breath Pacer

const breathU = units(1);
/** The Swift scene's quick pattern: 2.5 s in, 1 s held, 2.5 s out. */
const PHASES: { cue: string; seconds: number; to: number }[] = [
  { cue: "Breathe in", seconds: 2.5, to: 1 },
  { cue: "Hold", seconds: 1, to: 1 },
  { cue: "Breathe out", seconds: 2.5, to: 0 },
];
const BREATH = PHASES.reduce((s, ph) => s + ph.seconds, 0);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Breathing runs from the start; Stop sinks the orb back to rest and Start begins again from the first breath in. */
export function BreathPacerPreview() {
  const u = breathU;
  const SIZE = 260;
  const [running, setRunning] = useState(true);
  const [start, setStart] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  const [now, setNow] = useState(start);
  const [restFrom, setRestFrom] = useState<{ at: number; fullness: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (at: number) => { setNow(at); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const still = reduced();
  const elapsed = Math.max((now - start) / 1000, 0);
  const cycle = Math.floor(elapsed / BREATH) + 1;
  let inCycle = elapsed % BREATH, index = 0;
  while (index < PHASES.length - 1 && inCycle >= PHASES[index].seconds) { inCycle -= PHASES[index].seconds; index++; }
  const phase = PHASES[index];
  const from = index === 0 ? 0 : PHASES[index - 1].to;
  let fullness = from + (phase.to - from) * easeInOut(clamp(inCycle / phase.seconds));
  if (!running) {
    const since = restFrom ? (now - restFrom.at) / 1000 : 1;
    fullness = restFrom ? restFrom.fullness * (1 - springValue(roles.dismiss, since)) : 0;
  }
  const remaining = Math.ceil(phase.seconds - inCycle - 1e-6);
  const energy = !running ? 0 : index === 0 ? 0.45 : index === 1 ? 0.6 : 0.15;
  const toggle = () => {
    if (running) {
      setRestFrom({ at: performance.now(), fullness });
      setRunning(false);
    } else {
      setStart(performance.now());
      setRunning(true);
    }
  };
  return (
    <Stage>
      <div className="flex flex-col items-center" style={{ gap: u(26) }}>
        <div className="relative grid place-items-center" style={{ width: u(SIZE), height: u(SIZE) }}>
          <div aria-hidden className="absolute inset-0 overflow-hidden rounded-full" style={{ filter: `blur(${u(SIZE * 0.03)})`, transform: `scale(${still ? 1 : 0.62 + 0.38 * fullness})`, opacity: still ? 0.55 + 0.45 * fullness : 1 }}>
            <Aura colors={[sky, lilac, sage, "#bfe6fa"]} energy={energy} scale={0.95} seed={3.7} />
          </div>
          <div className="relative flex flex-col items-center" style={{ color: ink }} aria-live="polite">
            <MorphText text={running ? phase.cue : "Ready"} style={{ fontSize: u(20) }} />
            {running ? <span style={{ fontSize: u(SIZE * 0.2), lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{remaining}</span> : null}
          </div>
        </div>
        <LiquidGroup unit={u(1)} style={{ color: ground.text }}>
          <div className="flex items-center" style={{ gap: u(4) }}>
            <Liquid className="flex items-center" style={{ height: u(48), padding: `0 ${u(18)}`, fontSize: u(15), fontVariantNumeric: "tabular-nums" }}>
              {running ? `Cycle ${cycle}` : "Quick"}
            </Liquid>
            <Liquid tint={running ? undefined : signal.fill} style={{ height: u(48), transition: tr("background", "morph") }}>
              <button type="button" onClick={toggle} className="h-full cursor-pointer" style={{ padding: `0 ${u(22)}`, fontSize: u(17), fontWeight: 600, color: running ? ground.text : ink }}>
                {running ? "Stop" : "Start"}
              </button>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

// MARK: - Aura Reveal

const revealU = units(1);
const STAGES = ["Sketching", "Adding light", "Finishing"];
const LOAD = 3.4, FLARE = 0.26, LOOP = 8.2;

/** A flat composition like the Swift example's: a lilac sky, a butter sun, a sage hill and a red tram. */
function Artwork({ u }: { u: (n: number) => string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: lilac }}>
      <span className="absolute rounded-full" style={{ width: u(130), height: u(130), left: u(140), top: u(52), background: butter }} />
      <span className="absolute rounded-[50%]" style={{ width: u(480), height: u(310), left: u(-100), top: u(214), background: sage }} />
      <span className="absolute" style={{ width: u(112), height: u(60), left: u(78), top: u(204), borderRadius: u(12), background: signal.fill, transform: "rotate(-14deg)" }} />
    </div>
  );
}

/** The slot loading through its stages, then the picture opening out of the aura, and back again. */
export function AuraRevealPreview() {
  const u = revealU;
  const t = useLoop(LOOP);
  const still = reduced();
  const loading = t < LOAD;
  const progress = clamp(t / LOAD);
  const status = STAGES[Math.min(Math.floor(progress * STAGES.length), STAGES.length - 1)];
  const flare = t >= LOAD && t < LOAD + FLARE;
  const open = t < LOAD + FLARE ? 0 : t > LOOP - 0.4 ? 1 - clamp((t - (LOOP - 0.4)) / 0.4) : still ? clamp((t - LOAD - FLARE) / 0.3) : springValue({ duration: 0.9, bounce: 0 }, t - LOAD - FLARE);
  const energy = flare ? 1 : loading ? 0.35 + 0.45 * progress : 0;
  return (
    <Stage>
      <div className="relative overflow-hidden" style={{ width: u(272), height: u(340), borderRadius: u(28) }}>
        <div className="absolute inset-0" style={{ opacity: 1 - open, filter: flare ? "brightness(1.08)" : undefined }}>
          <Aura colors={[lilac, butter, sky, "#ffbfd1"]} energy={energy} scale={1.1} seed={5.1} />
        </div>
        {open > 0 ? (
          <div
            className="absolute inset-0"
            role="img"
            aria-label="A yellow tram on a hill under a lilac sky"
            style={{
              opacity: Math.min(open * 1.4, 1),
              filter: still ? undefined : `blur(${u(24 * (1 - open))})`,
              transform: still ? undefined : `scale(${1.08 - 0.08 * open})`,
              WebkitMaskImage: still ? undefined : `radial-gradient(circle at center, black ${open * 95}%, transparent ${open * 95 + 18}%)`,
              maskImage: still ? undefined : `radial-gradient(circle at center, black ${open * 95}%, transparent ${open * 95 + 18}%)`,
            }}
          >
            <Artwork u={u} />
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0" style={{ padding: u(12), opacity: loading ? 1 : 0, transition: tr("opacity", loading ? "reveal" : "dismiss") }}>
          <LiquidGroup unit={u(1)} style={{ color: ground.text }}>
            <div className="flex items-center" style={{ gap: u(4) }}>
              <Liquid className="flex items-center" style={{ height: u(36), padding: `0 ${u(14)}`, fontSize: u(15) }}>
                <MorphText text={status} />
              </Liquid>
              <Liquid className="flex items-center justify-center" style={{ height: u(36), minWidth: u(36), padding: `0 ${u(12)}`, fontSize: u(15), fontVariantNumeric: "tabular-nums" }}>
                {Math.round(progress * 100)}%
              </Liquid>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}
