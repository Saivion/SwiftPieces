"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { pressScale, roles, settleTime, springValue, t as tr, type Role } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Signature Pad: the paper on its own, with a cross, a baseline and a status line ("Sign here" while empty), a sage glass
 * Signed chip in the top trailing corner once the signature counts, and one liquid glass toolbar floating centred under it: the
 * Type instead pill, with Undo budding out of its leading end and Clear out of its trailing end while they can act.
 * The loop signs "SwiftPieces" with real handwriting timing (slow in turns, fast on sweeps), so the ink thins on quick
 * strokes and runs full on slow ones, exactly as the Swift piece weights it. The first stroke to land buds Undo and
 * Clear out of the pill; Undo fades the flourish, it is drawn again, and Clear wipes the pad and melts home while Undo
 * stays out to bring it back. Sizes are authored in px against the 560 px docs stage and converted to `cqw`; on the
 * glass, one px stands for one point. The ink itself never animates, as in Swift: only removals fade (`dismiss`) and
 * the chrome around it moves.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------- Handwriting

type Pt = { x: number; y: number; t: number };

/** Pass-through points of the signature in a 360 x 150 box: "SwiftPieces" with a forward slant, the dots, t cross
 *  and P bowl as their own strokes, then the flourish (always last: Undo takes it back). */
const STROKES: Array<Array<[number, number]>> = [
  [
    [53.6, 50], [45.8, 40], [33, 44], [28.3, 56], [35.7, 68], [45, 80], [45.5, 96], [34.4, 110], [19.6, 114],
    [11.3, 106],
  ],
  [
    [51.7, 86], [54.6, 100], [56, 112], [64.6, 100], [70.2, 93], [71.8, 104], [74, 112], [83.1, 98], [89.7, 86],
    [93.5, 96], [94.4, 110], [100, 112], [108.6, 100], [113.7, 86], [110.9, 108], [116, 112], [124.6, 100], [139.2, 70],
    [151, 44], [156.7, 36], [159, 44], [147.9, 76], [136, 112], [126.3, 138], [120.1, 148], [117.8, 140], [128.2, 120],
    [140.4, 110], [147.3, 106], [153.5, 96], [164.1, 66], [156.6, 100], [158, 112], [166.9, 108], [175.1, 98],
  ],
  [[116.4, 74]],
  [
    [148.6, 82], [175, 80],
  ],
  [
    [211, 44], [201.5, 78], [189.6, 114],
  ],
  [
    [205.6, 50], [221.8, 40], [237, 44], [237.9, 58], [223.2, 70], [204.4, 74],
  ],
  [
    [206.9, 108], [217.1, 98], [225.7, 86], [221.3, 106], [226, 112], [234.9, 108], [244.2, 102], [254, 94], [255.3, 88],
    [249.7, 86], [240, 94], [237.3, 106], [244, 112], [256.4, 110], [263.8, 104],
  ],
  [
    [283.6, 91], [277.9, 85], [269.1, 89], [262.9, 99], [263.7, 109], [272, 112], [282.4, 110], [291.8, 104], [301.5, 96],
    [303.3, 88], [297.7, 86], [290, 94], [288.9, 108], [296, 112], [306.9, 108], [315.5, 96], [323.7, 86], [324.1, 98],
    [323.1, 107], [314.8, 113], [305.2, 111],
  ],
  [[229.4, 74]],
  [
    [20, 134], [90, 140], [180, 138], [260, 132], [316, 124], [346, 116],
  ],
];

/** The pad the strokes were captured on (Swift `canvasSize`), and where the box sits on it. */
const CANVAS = { w: 360, h: 200 };
const PLACE = { x: 36, y: 56, s: 0.9 };

/** Catmull-Rom through the points, a speed profile after the two-thirds power law, sampled at 120 Hz like touch input. */
function synthesize(raw: Array<[number, number]>): Pt[] {
  const P = raw.map(([x, y]) => [x * PLACE.s + PLACE.x, y * PLACE.s + PLACE.y]);
  if (P.length === 1) return [{ x: P[0][0], y: P[0][1], t: 0 }];
  const dense: number[][] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const b1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const b2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let j = i === 0 ? 0 : 1; j <= 24; j++) {
      const t = j / 24, v = 1 - t;
      dense.push([
        v * v * v * p1[0] + 3 * v * v * t * b1[0] + 3 * v * t * t * b2[0] + t * t * t * p2[0],
        v * v * v * p1[1] + 3 * v * v * t * b1[1] + 3 * v * t * t * b2[1] + t * t * t * p2[1],
      ]);
    }
  }
  const m = dense.length;
  const kappa = new Array<number>(m).fill(0);
  for (let i = 1; i < m - 1; i++) {
    const a = dense[i - 1], b = dense[i], c = dense[i + 1];
    let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    kappa[i] = Math.abs(d) / Math.max((Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1])) / 2, 1e-3);
  }
  const smooth = kappa.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - 4); j <= Math.min(m - 1, i + 4); j++) { s += kappa[j]; n++; }
    return s / n;
  });
  const len = [0];
  for (let i = 1; i < m; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[m - 1];
  const time = [0];
  for (let i = 1; i < m; i++) {
    let v = Math.min(2400, Math.max(110, 300 * Math.pow(smooth[i] + 1e-4, -1 / 3)));
    v *= 0.35 + 0.65 * Math.min(1, len[i] / 18);
    if (total - len[i] < 30) v *= 1 + (1 - (total - len[i]) / 30) * 0.9;
    time.push(time[i - 1] + (len[i] - len[i - 1]) / v);
  }
  const out: Pt[] = [];
  let j = 0;
  for (let t = 0; t <= time[m - 1]; t += 1 / 120) {
    while (j < m - 2 && time[j + 1] < t) j++;
    const f = Math.min(1, Math.max(0, (t - time[j]) / Math.max(1e-6, time[j + 1] - time[j])));
    out.push({ x: dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, y: dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f, t });
  }
  out.push({ x: dense[m - 1][0], y: dense[m - 1][1], t: time[m - 1] });
  return out;
}

// ---------------------------------------------------------------- Ink (the Swift `InkShape`, line for line)

const LINE = 5;

function drawStroke(ctx: CanvasRenderingContext2D, points: Pt[], scale: number, dx: number, dy: number) {
  if (!points.length) return;
  const kept: Pt[] = [points[0]];
  for (const p of points.slice(1)) {
    const l = kept[kept.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) >= 1) kept.push(p);
  }
  const end = points[points.length - 1];
  const lastKept = kept[kept.length - 1];
  if (end !== lastKept && Math.hypot(end.x - lastKept.x, end.y - lastKept.y) > 0.25) kept.push(end);
  const at = (p: { x: number; y: number }) => ({ x: p.x * scale + dx, y: p.y * scale + dy });
  if (kept.length < 2) {
    const c = at(kept[0]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, LINE * 0.62 * scale, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const w = [LINE * 0.72];
  for (let i = 1; i < kept.length; i++) {
    const dt = Math.max(1 / 240, kept[i].t - kept[i - 1].t);
    const v = Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y) / dt;
    const f = Math.min(1, Math.max(0, (v - 140) / 1100));
    const target = LINE * (1 - 0.5 * f * (2 - f));
    w.push(w[i - 1] + (target - w[i - 1]) * (1 - Math.exp(-dt / 0.035)));
  }
  const V = kept.map(at);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const seg = (a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, w0: number, w1: number) => {
    const k = Math.max(1, Math.min(16, Math.ceil((Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y)) / 2.5)));
    const q = (s: number) => ({ x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y });
    for (let i = 0; i < k; i++) {
      const ta = i / k, tb = (i + 1) / k;
      const m0 = (1 - ta) * (1 - tb), m1 = (1 - ta) * tb + ta * (1 - tb), m2 = ta * tb;
      const s = q(ta), e = q(tb);
      ctx.lineWidth = (w0 + (w1 - w0) * (ta + tb) / 2) * scale;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(m0 * a.x + m1 * c.x + m2 * b.x, m0 * a.y + m1 * c.y + m2 * b.y, e.x, e.y);
      ctx.stroke();
    }
  };
  const n = V.length;
  const head = mid(V[0], V[1]);
  seg(V[0], mid(V[0], head), head, w[0], (w[0] + w[1]) / 2);
  for (let i = 1; i < n - 1; i++) seg(mid(V[i - 1], V[i]), V[i], mid(V[i], V[i + 1]), (w[i - 1] + w[i]) / 2, (w[i] + w[i + 1]) / 2);
  const tail = mid(V[n - 2], V[n - 1]);
  seg(tail, mid(tail, V[n - 1]), V[n - 1], (w[n - 2] + w[n - 1]) / 2, w[n - 1]);
}

// ---------------------------------------------------------------- Timeline

const SAMPLED = STROKES.map(synthesize);
const DUR = SAMPLED.map((s) => s[s.length - 1].t * 1000);
const REST = 1100, GAP = 170;
const START: number[] = [];
{
  let t = REST;
  for (const d of DUR) { START.push(t); t += d + GAP; }
}
/** The flourish is the last stroke; Undo takes it back and it is drawn again. */
const FL = SAMPLED.length - 1;
const SIGNED = START[FL] + DUR[FL];
const UNDO = SIGNED + 1300; // Undo lifts: the flourish fades
const REDRAW = UNDO + 800; // the flourish again
const RESIGNED = REDRAW + DUR[FL];
const CLEAR = RESIGNED + 1500; // Clear lifts: everything fades
const LOOP = CLEAR + 1300;
/** A button acts on lift, so the finger goes down this long before Undo and Clear fire: long enough for the press to land. */
const HOLD = 200;
/** Removals fade on Swift's `dismiss` spring (quick, firm), sampled per frame because the ink is painted. */
const FADE = settleTime(roles.dismiss);
const fadeOut = (sinceMs: number) => (sinceMs >= FADE * 1000 ? 0 : Math.max(0, 1 - springValue(roles.dismiss, sinceMs / 1000)));

type Chrome = { hint: boolean; canUndo: boolean; canClear: boolean; signed: boolean; pops: boolean; press: "undo" | "clear" | null };
type Frame = Chrome & { strokes: Array<{ i: number; upto: number; alpha: number }> };

function frameAt(ms: number): Frame {
  const t = ((ms % LOOP) + LOOP) % LOOP;
  const strokes: Frame["strokes"] = [];
  const clearFade = t >= CLEAR ? fadeOut(t - CLEAR) : 1;
  for (let i = 0; i < SAMPLED.length; i++) {
    let start = START[i];
    let alpha = clearFade;
    if (i === FL && t >= UNDO) {
      if (t < REDRAW) alpha = fadeOut(t - UNDO);
      else start = REDRAW;
    }
    if (t < start || alpha <= 0.002) continue;
    strokes.push({ i, upto: Math.max(0, t - start) / 1000, alpha });
  }
  const press = t >= UNDO - HOLD && t < UNDO ? "undo" : t >= CLEAR - HOLD && t < CLEAR ? "clear" : null;
  // Swift's pad state: the strokes empty out the moment Clear fires (the ink only fades), so the hint settles back
  // in beside the fading ink and Clear turns off, while Undo stays on (Clear keeps a restore) through the rest.
  // The next touch-down drops that restore, and a stroke only commits on lift, so Undo and Clear come on there.
  // The first pass has no restore yet, so Undo rests off.
  const hint = t < START[0] || t >= CLEAR;
  const lifted = t >= START[0] + DUR[0];
  const canClear = lifted && t < CLEAR;
  const canUndo = lifted || (ms >= LOOP && t < START[0]);
  // Signed shows once the signing is done (Swift: the signature counts and the pad has been still for a
  // moment), hides while the flourish is drawn again, and goes with Clear. Only its first showing for this
  // signature pops on `success`; coming back after the redraw it lands on `snap`.
  const settle = 650;
  const signed = (t >= SIGNED + settle && t < REDRAW) || (t >= RESIGNED + settle && t < CLEAR);
  const pops = t < REDRAW;
  return { strokes, hint, canUndo, canClear, signed, pops, press };
}

const REST_CHROME: Chrome = { hint: true, canUndo: false, canClear: false, signed: false, pops: true, press: null };

// ---------------------------------------------------------------- View

function Keyboard() {
  return (
    <svg aria-hidden viewBox="0 0 26 18" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: u(21), height: u(15), flexShrink: 0 }}>
      <rect x="1.5" y="1.5" width="23" height="15" rx="3" />
      <path d="M6 6h.01M10 6h.01M14 6h.01M18 6h.01M6 9.5h.01M10 9.5h.01M14 9.5h.01M18 9.5h.01M8 13h10" strokeLinecap="round" strokeWidth={2.2} />
    </svg>
  );
}

function UndoGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(19), height: u(19) }}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

/** The toolbar glass, as Swift sizes it: 40 pt bubbles resting `liquid.joined` from the pill, Clear's capsule this wide. */
const BUBBLE = 40, CLEAR_W = 72;
/** Each bubble's press depth from its size, about 1.5 px a side like Swift's `piecePress(depth: 1.5)`: the chrome
 *  stays quiet next to the ink. */
const SINK = { undo: pressScale(BUBBLE, BUBBLE, 1.5), clear: pressScale(CLEAR_W, BUBBLE, 1.5) };
/** Each bubble's home: shrunk, just inside the pill's nearer end, Undo's leading and Clear's trailing. */
const homeAt = (width: number, side: 1 | -1): [number, number] => [side * (width / 2 + liquid.joined + (width * liquid.homeScale) / 2), 0];
const HOME = { undo: homeAt(BUBBLE, 1), clear: homeAt(CLEAR_W, -1) };

/** Swift's `PadButtonStyle`: the glass sinks on `press` and springs back through rest on `release`, while only the
 *  label dims, so the glass stays clear. The label is hidden while the bubble is home in the pill. */
function PadBubble({ out, pressed, sink, width, home, children }: { out: boolean; pressed: boolean; sink: number; width: number; home: [number, number]; children: ReactNode }) {
  const press: Role = pressed ? "press" : "release";
  return (
    <span data-motion className="flex" style={{ transform: `scale(${pressed ? sink : 1})`, transition: tr("transform", press) }}>
      <Liquid bud={{ out, home }} className="flex items-center justify-center" style={{ width: u(width), height: u(BUBBLE), color: ground.text }}>
        <BudContent out={out}>
          <span style={{ display: "inline-flex", alignItems: "center", opacity: pressed ? 0.55 : 1, transition: tr("opacity", press) }}>{children}</span>
        </BudContent>
      </Liquid>
    </span>
  );
}

export function SignaturePadPreview() {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<Chrome>(REST_CHROME);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    let last: Chrome = REST_CHROME;
    const paint = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const f = reduced ? frameAt(0) : frameAt(Math.max(0, now - start));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Uniform fit anchored to the bottom and leading edge, like the Swift transform.
      const scale = Math.min(w / CANVAS.w, h / CANVAS.h);
      const dy = h - CANVAS.h * scale;
      const ink = getComputedStyle(canvas).color;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of f.strokes) {
        const pts = SAMPLED[s.i].filter((p) => p.t <= s.upto);
        ctx.globalAlpha = s.alpha;
        drawStroke(ctx, pts.length ? pts : [SAMPLED[s.i][0]], scale, 0, dy);
      }
      ctx.globalAlpha = 1;
      const next: Chrome = { hint: f.hint, canUndo: f.canUndo, canClear: f.canClear, signed: f.signed, pops: f.pops, press: f.press };
      if ((Object.keys(next) as Array<keyof Chrome>).some((k) => next[k] !== last[k])) {
        last = next;
        setState(next);
      }
      if (!reduced) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // The chip pops in on `success` the first time a signature counts, lands on `snap` after a later pause, and
  // steps out on `dismiss` when the finger comes back.
  const chip: Role = state.signed ? (state.pops ? "success" : "snap") : "dismiss";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, gap: u(12) }}>
      {/* The paper is the whole card, all of it for the ink, with a hairline edge and a soft lift, as in Swift. */}
      <div style={{ position: "relative", width: u(470), height: u(236), borderRadius: u(26), background: ground.surface, overflow: "hidden", boxShadow: `inset 0 0 0 ${u(1)} color-mix(in srgb, ${ground.muted} 16%, transparent), 0 ${u(6)} ${u(28)} rgba(0,0,0,.07)` }}>
        <div style={{ position: "absolute", left: u(22), right: u(22), bottom: 0, height: u(46), borderTop: `${u(1.5)} solid color-mix(in srgb, ${ground.muted} 32%, transparent)`, display: "flex", alignItems: "flex-start" }}>
          <span
            data-motion
            style={{
              display: "block", paddingTop: u(8), fontSize: u(13), fontWeight: 600, color: ground.muted,
              opacity: state.hint ? 1 : 0, transform: state.hint || reduced ? "none" : `translateY(${u(4)})`,
              transition: tr(["opacity", "transform"], state.hint ? "reveal" : "dismiss"),
            }}
          >
            Sign here
          </span>
          <span style={{ flex: 1 }} />
        </div>
        <svg aria-hidden viewBox="0 0 12 12" style={{ position: "absolute", left: u(22), bottom: u(46 + 9), width: u(11), height: u(11), color: signal.fill }} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
        {/* Signed, on sage glass, in the paper's top trailing corner, clear of the ink, as in Swift. */}
        <span
          data-motion
          aria-hidden
          style={{
            position: "absolute", top: u(14), right: u(14), zIndex: 1, display: "inline-flex",
            // Scales out of its corner, as in Swift.
            opacity: state.signed ? 1 : 0, transform: state.signed || reduced ? "none" : "scale(0.6)", transformOrigin: "100% 0%",
            transition: tr(["opacity", "transform"], chip),
          }}
        >
          <Liquid tint={blocks.sage} style={{ display: "inline-flex", alignItems: "center", gap: u(4), padding: `${u(5)} ${u(10)}`, color: ink, fontSize: u(12), fontWeight: 600 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(11), height: u(11) }}>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Signed
          </Liquid>
        </span>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: ground.text }} />
      </div>
      {/* The toolbar floats under the paper as one liquid shape, on the page where clear glass shows. Both side slots
          are Clear's width, so the pill stays centred whether or not Undo and Clear are out. */}
      <LiquidGroup unit={u(1)}>
        <span className="flex items-center" style={{ gap: u(liquid.joined), fontSize: u(15), fontWeight: 600 }}>
          <span className="flex justify-end" style={{ width: u(CLEAR_W) }}>
            <PadBubble out={state.canUndo} pressed={state.press === "undo"} sink={SINK.undo} width={BUBBLE} home={HOME.undo}><UndoGlyph /></PadBubble>
          </span>
          {/* Above the bubbles, so one waiting at home slips under it. */}
          <span className="relative" style={{ zIndex: 1 }}>
            <Liquid className="flex items-center" style={{ height: u(BUBBLE), paddingInline: u(16), gap: u(8), color: ground.text }}>
              <Keyboard />Type instead
            </Liquid>
          </span>
          <span className="flex justify-start" style={{ width: u(CLEAR_W) }}>
            <PadBubble out={state.canClear} pressed={state.press === "clear"} sink={SINK.clear} width={CLEAR_W} home={HOME.clear}>Clear</PadBubble>
          </span>
        </span>
      </LiquidGroup>
    </div>
  );
}
