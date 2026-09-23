"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

// Data previews. Each shows the component itself on the house ground: the chart, the ring, the stat tile, the rolling number.
// Nothing that is not the component — no headings, no dashboard cards, no action buttons.
// Sizes are iOS points mapped to container width (P cqw per point), so the stage scales from the grid card to the docs header.

const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const P = 0.25;
/** iOS points to container units. */
const pt = (n: number) => `${+(n * P).toFixed(3)}cqw`;
/** Resting slices while one is selected: one solid step off the ground. */
const REST = "#2e2e2e";

/** Runs each `[delayMs, fn]` step once per `loopMs` cycle; every timer is cleared on unmount. */
function useTimeline(loopMs: number, steps: [number, () => void][]) {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, loopMs);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Eases a vector toward `target` over `ms` (0 snaps). Mirrors SwiftUI interpolating real numbers, not strings. */
function useTween(target: number[], ms: number) {
  const [cur, setCur] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current, to = target;
    if (ms <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { ref.current = to; setCur(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can trail performance.now(), so clamp both ends: a negative p would overshoot wildly.
      const p = Math.min(1, Math.max(0, (now - start) / ms)), e = 1 - Math.pow(1 - p, 3);
      ref.current = to.map((v, i) => (from[i] ?? v) + (v - (from[i] ?? v)) * e);
      setCur(ref.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.join(","), ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

const usd = (v: number, frac = 2) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });

/** A light display-scale figure with its decimals dimmed. */
function Numeral({ text, size, color = ground.text, dim = ground.muted }: { text: string; size: number; color?: string; dim?: string }) {
  const i = text.lastIndexOf(".");
  const whole = i < 0 ? text : text.slice(0, i), fraction = i < 0 ? "" : text.slice(i);
  return (
    <span style={{ fontSize: pt(size), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {whole}<span style={{ color: dim }}>{fraction}</span>
    </span>
  );
}

function Arrow({ up, size = 10 }: { up: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: pt(size), height: pt(size), flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? "M7 17L17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9"} />
    </svg>
  );
}

/** Up and down arrive as solid blocks with ink. */
function DeltaChip({ up, children, fill, color = ink }: { up: boolean; children: ReactNode; fill?: string; color?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full" style={{ gap: pt(3), height: pt(22), paddingInline: pt(8), background: fill ?? (up ? blocks.sage : blocks.tangerine), color, fontSize: pt(11), fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <Arrow up={up} />{children}
    </span>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>{children}</div>;
}

const meta: CSSProperties = { fontSize: pt(10), fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ground.muted };
const card = (extra?: CSSProperties): CSSProperties => ({ background: ground.surface, borderRadius: pt(30), ...extra });

type Pt = readonly [number, number];
function toPoints(values: number[], w: number, h: number, pad = 4): Pt[] {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), pad + (1 - (v - min) / span) * (h - pad * 2)]);
}
/** Catmull-Rom through the points as cubic beziers (SwiftUI `.catmullRom`). */
function smooth(p: Pt[]) {
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], e = p[Math.min(i + 2, p.length - 1)];
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}
const linear = (p: Pt[]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

// MARK: Scrub Chart

const RANGES = [
  ["1D", [182.1, 182.6, 181.9, 183.4, 184.0, 183.2, 184.8, 185.3, 184.9, 186.1, 185.7, 186.4, 187.0], ["9 AM", "12 PM", "3 PM"]],
  ["1W", [176.3, 177.8, 179.1, 178.2, 180.4, 181.0, 179.7, 182.5, 183.9, 182.8, 184.6, 186.1, 185.4, 187.0], ["SEP 10", "SEP 13", "SEP 16"]],
  ["1M", [191.2, 189.4, 188.0, 186.7, 184.1, 185.9, 183.3, 181.8, 180.2, 182.6, 179.5, 178.1, 180.9, 182.4, 184.7, 187.0], ["AUG 18", "SEP 1", "SEP 16"]],
  ["1Y", [142.0, 150.3, 147.8, 158.2, 163.9, 160.1, 171.4, 176.0, 168.3, 179.9, 183.5, 187.0], ["SEP 25", "MAR 26", "SEP 26"]],
] as const;
const N = 32;
/** Every dataset is resampled to one count so a range switch morphs the line instead of redrawing it. */
const resample = (v: readonly number[]) => Array.from({ length: N }, (_, i) => { const x = (i / (N - 1)) * (v.length - 1), j = Math.floor(x), f = x - j; return v[j] + (v[Math.min(j + 1, v.length - 1)] - v[j]) * f; });
const stamp = (i: number) => { const days = ["WED", "THU", "FRI", "MON", "TUE"], d = days[Math.min(4, Math.floor((i / N) * 5))]; const h = 9 + Math.round((i % 6) * 1.2); return `${d} ${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`; };

/** Rest, scrub across with the flag riding the rule, hold a range (band and delta), release, then switch ranges so the line morphs. */
/**
 * The chart's colour scheme and corner radius are CSS variables, so a host can restyle the whole piece
 * (the landing page's agent demo does). Each falls back to the house palette:
 * accent (scrub dot, range pill), line (the line, rules, flag), surface (card, dot ring, flag text),
 * raised (range track, held band), chip (the rising delta chip), and `--scrub-radius` for the card.
 */
const SCRUB_ACCENT = `var(--scrub-accent, ${blocks.butter})`;
const SCRUB_LINE = `var(--scrub-line, ${ground.text})`;
const SCRUB_SURFACE = `var(--scrub-surface, ${ground.surface})`;
const SCRUB_RAISED = `var(--scrub-raised, ${ground.raised})`;
const SCRUB_CHIP = `var(--scrub-chip, ${blocks.sage})`;

export function ScrubChartPreview() {
  const [phase, setPhase] = useState(0);
  useTimeline(9200, [[0, () => setPhase(0)], [1600, () => setPhase(1)], [2000, () => setPhase(2)], [2400, () => setPhase(3)], [2900, () => setPhase(4)], [3800, () => setPhase(5)], [4600, () => setPhase(6)], [5900, () => setPhase(7)], [7400, () => setPhase(8)]]);
  const range = phase === 7 ? 2 : phase === 8 ? 3 : 1;
  const scrub: number | null = [null, 8, 14, 20, null, null, null, null, null][phase];
  const band: [number, number] | null = phase === 4 ? [6, 26] : phase === 5 ? [6, 12] : null;
  const active = band ? band[1] : scrub;
  const W = 280, H = 84;
  const values = useTween(resample(RANGES[range][1]), 600);
  const p = toPoints(values, W, H, 10);
  const first = values[0], last = values[N - 1];
  const hi = values.indexOf(Math.max(...values)), lo = values.indexOf(Math.min(...values));
  const shown = band ? values[band[1]] - values[band[0]] : active !== null ? values[active] : last;
  const chipFrom = band ? values[band[0]] : first, chipTo = band ? values[band[1]] : active !== null ? values[active] : last;
  const up = chipTo >= chipFrom;
  const flagX = active !== null ? Math.min(Math.max(p[active][0], 36), W - 36) : 0;
  return (
    <Stage>
      <div style={card({ width: pt(320), padding: `${pt(14)} ${pt(18)}`, background: SCRUB_SURFACE, borderRadius: `var(--scrub-radius, ${pt(30)})`, transition: "border-radius .6s ease" })}>
        <p style={meta}>{band ? `${stamp(band[0])} – ${stamp(band[1])}` : active !== null ? stamp(active) : `Latest · ${RANGES[range][0]}`}</p>
        <div className="flex items-center" style={{ gap: pt(8), marginTop: pt(6) }}>
          <Numeral text={(band ? (shown < 0 ? "−" : "+") : "") + usd(Math.abs(shown))} size={32} />
          <DeltaChip up={up} fill={up ? SCRUB_CHIP : undefined}>{!band && `${up ? "+" : "−"}${usd(Math.abs(chipTo - chipFrom))} `}{(Math.abs((chipTo - chipFrom) / chipFrom) * 100).toFixed(1)}%</DeltaChip>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" style={{ marginTop: pt(10) }} aria-hidden>
          {band ? <rect data-motion x={p[band[0]][0]} width={p[band[1]][0] - p[band[0]][0]} y={0} height={H} rx={8} style={{ fill: SCRUB_RAISED, transition: `width .25s ${ease}` }} /> : null}
          <line x1={0} x2={W} y1={p[0][1]} y2={p[0][1]} strokeOpacity=".45" strokeDasharray="2 5" style={{ stroke: SCRUB_LINE }} />
          <path d={smooth(p)} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: SCRUB_LINE }} />
          <g data-motion style={{ opacity: active === null && !band ? 1 : 0, transition: "opacity .2s" }} fill={ground.muted} fontSize={9} fontWeight={600} fontFamily={font.mono}>
            <text x={Math.min(p[hi][0], W - 12)} textAnchor={p[hi][0] > W - 60 ? "end" : "start"} y={Math.max(p[hi][1] - 12, 8)}>{usd(values[hi])}</text>
            <text x={Math.min(Math.max(p[lo][0] - 20, 0), W - 48)} y={Math.min(p[lo][1] + 16, H + 4)}>{usd(values[lo])}</text>
          </g>
          {band ? <line x1={p[band[0]][0]} x2={p[band[0]][0]} y1={0} y2={H} strokeWidth={1.5} style={{ stroke: SCRUB_LINE }} /> : null}
          {active !== null ? <line data-motion x1={p[active][0]} x2={p[active][0]} y1={0} y2={H} strokeWidth={1.5} style={{ stroke: SCRUB_LINE, transition: `all .25s ${ease}` }} /> : null}
          <circle data-motion cx={p[active ?? N - 1][0]} cy={p[active ?? N - 1][1]} r={7} strokeWidth={3} style={{ fill: SCRUB_ACCENT, stroke: SCRUB_SURFACE, transition: `cx .25s ${ease}, cy .25s ${ease}` }} />
          {active !== null ? (
            <g data-motion style={{ transform: `translateX(${flagX}px)`, transition: `transform .25s ${ease}` }}>
              <rect x={-34} y={-4} width={68} height={17} rx={8.5} style={{ fill: SCRUB_LINE }} />
              <text x={0} y={8} textAnchor="middle" fontSize={9} fontWeight={600} fontFamily={font.mono} style={{ fill: SCRUB_SURFACE }}>{stamp(active)}</text>
            </g>
          ) : null}
        </svg>
        <div className="flex justify-between" style={{ ...meta, fontSize: pt(9), marginTop: pt(8) }}>{RANGES[range][2].map((l) => <span key={l}>{l}</span>)}</div>
        <div className="relative flex" style={{ marginTop: pt(10), padding: pt(3), borderRadius: 999, background: SCRUB_RAISED }}>
          <span data-motion className="absolute rounded-full" style={{ top: pt(3), bottom: pt(3), left: `calc(${pt(3)} + ${range} * (100% - ${pt(6)}) / 4)`, width: `calc((100% - ${pt(6)}) / 4)`, background: SCRUB_ACCENT, transition: `left .4s ${spring}` }} />
          {RANGES.map(([l], i) => <span key={l} className="relative flex flex-1 items-center justify-center" style={{ height: pt(28), fontSize: pt(12), fontWeight: 700, color: i === range ? ink : ground.muted, transition: "color .3s" }}>{l}</span>)}
        </div>
      </div>
    </Stage>
  );
}

// MARK: Ring Breakdown

const SLICES = [["Housing", 1450], ["Food", 620], ["Transport", 310], ["Leisure", 270], ["Other", 150]] as const;
const SLICE_COLORS = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac];
const TOTAL = SLICES.reduce((s, [, v]) => s + v, 0);

/** An annular sector with rounded ends, in a 0...200 box. */
function sector(a0: number, a1: number, r0: number, r1: number) {
  const pt2 = (a: number, r: number) => `${(100 + Math.cos(a) * r).toFixed(2)} ${(100 + Math.sin(a) * r).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt2(a0, r1)} A${r1} ${r1} 0 ${large} 1 ${pt2(a1, r1)} L${pt2(a1, r0)} A${r0} ${r0} 0 ${large} 0 ${pt2(a0, r0)} Z`;
}

/** Rests, then walks the selection: the slice lifts, the rest step back to the surface, the center counts, the legend row becomes the block. */
export function RingBreakdownPreview() {
  // Phase 0 hides the ring for one frame at the end of the loop, so each cycle sweeps it back in; the first frame is the resting ring.
  const [phase, setPhase] = useState(1);
  useTimeline(7600, [[0, () => setPhase(1)], [1800, () => setPhase(2)], [2900, () => setPhase(3)], [4000, () => setPhase(4)], [5100, () => setPhase(5)], [6300, () => setPhase(6)], [7500, () => setPhase(0)]]);
  const sel: number | null = [null, null, 0, 1, 2, 3, null][phase];
  const [shown] = useTween([sel === null ? TOTAL : SLICES[sel][1]], 450);
  const R1 = 94, R0 = 60, GAP = 0.05;
  let cum = -Math.PI / 2;
  return (
    <Stage>
      <div className="flex items-center" style={{ gap: pt(22), width: pt(360) }}>
        <div className="relative shrink-0" style={{ width: pt(168), height: pt(168) }}>
          <svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-hidden>
            <defs><mask id="rb-sweep"><circle data-motion cx="100" cy="100" r="50" fill="none" stroke="#fff" strokeWidth="100" pathLength={100} strokeDasharray="100 100" transform="rotate(-90 100 100)" style={{ strokeDashoffset: phase === 0 ? 100 : 0, transition: phase === 0 ? "none" : "stroke-dashoffset .9s ease-in-out" }} /></mask></defs>
            <g mask="url(#rb-sweep)">
              {SLICES.map(([label, v], i) => {
                const span = (v / TOTAL) * Math.PI * 2, a0 = cum + GAP / 2, a1 = cum + span - GAP / 2, mid = cum + span / 2;
                cum += span;
                const hot = sel === i, lift = hot ? 7 : 0;
                const fill = sel === null || hot ? SLICE_COLORS[i] : REST;
                return (
                  <path key={label} data-motion d={sector(a0, a1, R0 + 3, R1 - 3)} fill={fill} stroke={fill} strokeWidth={6} strokeLinejoin="round"
                    style={{ transform: `translate(${(Math.cos(mid) * lift).toFixed(1)}px, ${(Math.sin(mid) * lift).toFixed(1)}px)`, filter: hot ? "drop-shadow(0 6px 10px rgba(0,0,0,.4))" : "none", transition: `transform .4s ${spring}, fill .3s, stroke .3s` }} />
                );
              })}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: pt(3) }}>
            <span style={{ ...meta, fontSize: pt(9) }}>{sel === null ? "Total" : SLICES[sel][0]}</span>
            <Numeral text={usd(shown, 0)} size={24} />
            <span data-motion className="rounded-full" style={{ height: pt(18), paddingInline: pt(7), fontSize: pt(10), fontWeight: 700, lineHeight: pt(18), background: sel === null ? "transparent" : SLICE_COLORS[sel], color: ink, opacity: sel === null ? 0 : 1, transition: "opacity .2s" }}>{sel === null ? "" : `${Math.round((SLICES[sel][1] / TOTAL) * 100)}%`}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: pt(2) }}>
          {SLICES.map(([label, v], i) => {
            const hot = sel === i;
            return (
              <div key={label} data-motion className="flex items-center" style={{ gap: pt(8), height: pt(31), paddingInline: pt(10), borderRadius: pt(12), background: hot ? SLICE_COLORS[i] : "transparent", color: hot ? ink : ground.text, opacity: sel === null || hot ? 1 : 0.62, transition: "background .3s, opacity .3s" }}>
                <span style={{ width: pt(10), height: pt(10), borderRadius: pt(3), background: hot ? ink : SLICE_COLORS[i], flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ fontSize: pt(12), fontWeight: hot ? 700 : 500 }}>{label}</span>
                <span style={{ fontSize: pt(12), fontVariantNumeric: "tabular-nums" }}>{usd(v, 0)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

// MARK: Live Stat

const HISTORY = [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25];

function Spark({ values, w, h, color, dot, ring, cursor }: { values: number[]; w: number; h: number; color: string; dot: string; ring: string; cursor?: number | null }) {
  const p = toPoints(values, w, h, 8), at = p[cursor ?? values.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full overflow-visible" style={{ height: pt(h) }} preserveAspectRatio="none" aria-hidden>
      {cursor != null ? <line x1={at[0]} x2={at[0]} y1={0} y2={h} stroke={color} strokeWidth={1.5} /> : null}
      <path d={linear(p)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle data-motion cx={at[0]} cy={at[1]} r={6} fill={dot} stroke={ring} strokeWidth={3} style={{ transition: `cx .25s ${ease}, cy .25s ${ease}` }} />
    </svg>
  );
}

/** The tile alone: rest, hold and scrub the line, release (the value rolls back), then expand into the taller chart with low and high. */
export function LiveStatPreview() {
  const [phase, setPhase] = useState(0);
  useTimeline(8200, [[0, () => setPhase(0)], [1500, () => setPhase(1)], [1900, () => setPhase(2)], [2300, () => setPhase(3)], [2700, () => setPhase(4)], [3300, () => setPhase(5)], [4200, () => setPhase(6)], [6800, () => setPhase(7)]]);
  const scrub: number | null = [null, null, 3, 5, 7, null, null, null][phase];
  const pressed = phase === 1, expanded = phase === 6;
  const [value, h] = useTween([(scrub === null ? HISTORY[9] : HISTORY[scrub]) * 1000, expanded ? 128 : 52], 450);
  return (
    <Stage>
      <div data-motion style={{ width: pt(330), background: ground.surface, borderRadius: pt(30), padding: pt(20), transform: `scale(${pressed ? 0.97 : 1})`, transition: `transform .35s ${spring}` }}>
        <div className="flex items-center justify-between">
          <span style={meta}>Revenue</span>
          <span data-motion style={{ opacity: scrub === null ? 1 : 0.35, transition: "opacity .15s" }}><DeltaChip up>12.4%</DeltaChip></span>
        </div>
        <div style={{ marginTop: pt(8) }}><Numeral text={usd(value)} size={40} /></div>
        <div style={{ marginTop: pt(14) }}><Spark values={HISTORY} w={290} h={h} color={ground.text} dot={blocks.butter} ring={ground.surface} cursor={scrub} /></div>
        <div data-motion className="flex overflow-hidden" style={{ gap: pt(14), maxHeight: expanded ? pt(22) : 0, opacity: expanded ? 1 : 0, marginTop: expanded ? pt(10) : 0, transition: `all .4s ${ease}` }}>
          <span style={meta}>Low <span style={{ color: ground.text, fontFamily: font.mono }}>$31,200.00</span></span>
          <span style={meta}>High <span style={{ color: ground.text, fontFamily: font.mono }}>$48,250.00</span></span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Odometer

/** One digit slot. `r` is the fractional roll (3.4 shows 3 leaving and 4 arriving); while between faces its edges soften. */
function Slot({ r, loading, color, reveal = 1 }: { r: number; loading: boolean; color: string; reveal?: number }) {
  const d = Math.floor(r) % 10, f = r - Math.floor(r);
  const mask = f > 0.001 ? "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)" : "none";
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: "1.1em", width: `${(0.62 * reveal).toFixed(3)}em`, opacity: reveal, color, WebkitMaskImage: mask, maskImage: mask }}>
      {loading ? <span className="absolute inset-0 text-center">–</span> : (
        <>
          <span className="absolute inset-0 text-center" style={{ transform: `translateY(${(-f * 100).toFixed(1)}%)` }}>{d}</span>
          <span className="absolute inset-0 text-center" style={{ transform: `translateY(${((1 - f) * 100).toFixed(1)}%)` }}>{(d + 1) % 10}</span>
        </>
      )}
    </span>
  );
}

/** Every digit derives its roll from one number, carrying upward only while the digit below passes 9. Decimals are dimmed. */
function Tape({ value, loading }: { value: number; loading: boolean }) {
  const scaled = Math.max(0, value) * 100;
  const roll = (p: number): number => {
    if (p === 0) return scaled % 10;
    const lower = roll(p - 1);
    return (Math.floor(scaled / 10 ** p) % 10) + (lower >= 9 ? lower - 9 : 0);
  };
  const out: ReactNode[] = [<span key="$" style={{ color: loading ? ground.subtle : ground.text }}>$</span>];
  // High slots that still read zero collapse and grow in as the carry reaches them.
  const reveal = (p: number) => (loading || p <= 2 ? 1 : Math.min(1, scaled / 10 ** p));
  for (let p = 6; p >= 0; p--) {
    const dim = p < 2;
    if (p === 1) out.push(<span key="dot" style={{ color: ground.subtle }}>.</span>);
    if (p === 4) out.push(<span key="comma" style={{ color: loading ? ground.subtle : ground.text, opacity: reveal(5) }}>,</span>);
    out.push(<Slot key={p} r={roll(p)} loading={loading} reveal={reveal(p)} color={loading ? ground.subtle : dim ? ground.subtle : ground.text} />);
  }
  return <span className="inline-flex items-center" style={{ lineHeight: "1.1em", fontVariantNumeric: "tabular-nums" }}>{out}</span>;
}

/** The number alone: rest, a deposit (sage delta block), rent (tangerine), then dashes while loading and a roll up from zero. */
export function OdometerPreview() {
  // 1 rest, 2 deposit, 3 rent, 0 loading dashes, then the next cycle rolls up from zero.
  const [phase, setPhase] = useState(1);
  useTimeline(9000, [[0, () => setPhase(1)], [1800, () => setPhase(2)], [4400, () => setPhase(3)], [7600, () => setPhase(0)]]);
  const target = [12480.55, 12480.55, 12997.55, 11547.55][phase];
  const [rolled] = useTween([phase === 0 ? 0 : target], phase === 0 ? 0 : 1200);
  const delta = phase === 2 ? 517 : phase === 3 ? -1450 : null;
  const [pill, setPill] = useState(false);
  useEffect(() => {
    if (delta === null) { setPill(false); return; }
    setPill(true);
    const t = setTimeout(() => setPill(false), 1600);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Stage>
      <div className="flex items-center" style={{ gap: pt(10), height: pt(58) }}>
        <span style={{ fontSize: pt(46), fontWeight: font.numeralWeight, letterSpacing: "-0.02em" }}><Tape value={rolled} loading={phase === 0} /></span>
        <span data-motion style={{ opacity: pill ? 1 : 0, transform: `scale(${pill ? 1 : 0.7})`, transformOrigin: "left center", transition: `opacity .25s ${ease}, transform .35s ${spring}` }}>
          {delta !== null ? <DeltaChip up={delta > 0}>{delta > 0 ? "+" : "−"}{usd(Math.abs(delta))}</DeltaChip> : null}
        </span>
      </div>
    </Stage>
  );
}
