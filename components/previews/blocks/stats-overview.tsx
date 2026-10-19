"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BlockCanvas, bu } from "./canvas";
import { blocks, font, ground, ink } from "../palette";
import { curve, ms, roles, t, type Role } from "../piece-motion";
import { Liquid, LiquidGroup, liquid } from "../piece-liquid";

/*
 * Stats Overview: the top of an analytics screen, as StatsOverviewBlock draws it on a 390 pt phone. The header with
 * when the numbers were updated; the headline card holding the Scrub Chart (its readout, line and range picker); and
 * the first row of Live Stat tiles. The block's third tile, Conversion, takes its own row below the canvas.
 *
 * The loop: rest. A finger-less scrub crosses the 30-day line, the rule, the butter dot and the glass date flag riding
 * the line while the readout follows point by point; it lets go and the readout rolls back to the latest value. The
 * picker moves to 90D: the butter tint flows into the swelling segment and the line bends into the longer range.
 * Visitors rolls to a new value. Then the range returns to 30D and the visitors figure to where it started.
 * Under reduced motion it holds the resting frame.
 */

// MARK: Data (the block's sample: 90 days of recurring revenue, the 30- and 7-day ranges are its last days)

const DAILY = Array.from({ length: 90 }, (_, day) => {
  const wiggle = (i: number) => 187 * Math.sin(0.9 * i + 0.4) + 260 * Math.sin(0.31 * i + 1.1) + 150 * Math.sin(0.093 * i + 2);
  const bump = (i: number, at: number, height: number, width: number) => height * Math.exp(-(((i - at) / width) ** 2));
  const events = (i: number) => bump(i, 14, -900, 5) + bump(i, 67, -700, 3.2) + bump(i, 82.6, -350, 0.8) + bump(i, 84, 380, 1.2) + bump(i, 86.8, -420, 1);
  const tt = day / 89;
  const trend = 39_880 + (48_250.4 - 39_880) * (0.7 * tt + 0.3 * tt * tt);
  const swing = wiggle(day) - wiggle(89) * tt - wiggle(0) * (1 - tt) + events(day) - events(89) * tt - events(0) * (1 - tt);
  return Math.round((trend + swing) * 100) / 100;
});

/** The picker's ranges, each with its days and the chart's three date labels. */
const RANGES = [
  { label: "7D", days: 7, axis: ["OCT 13", "OCT 16", "OCT 19"] },
  { label: "30D", days: 30, axis: ["SEP 20", "OCT 4", "OCT 19"] },
  { label: "90D", days: 90, axis: ["JUL 22", "SEP 4", "OCT 19"] },
] as const;
const points = (range: number) => DAILY.slice(90 - RANGES[range].days);

const VISITORS = [9_820, 10_410, 10_120, 10_960, 11_340, 11_020, 11_610, 12_140, 11_790, 12_230, 12_010, 12_480];
const TRIALS = [301, 322, 318, 340, 356, 349, 371, 388, 380, 397, 404, 412];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The date of a day in the 90-day series, as the flag reads it ("Sep 26"). Day 89 is Oct 19, 2026. */
const dayLabel = (day: number) => {
  const d = new Date(Date.UTC(2026, 9, 19, 12) - (89 - day) * 86_400_000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const usd = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (v: number) => Math.round(v).toLocaleString("en-US");

// MARK: Chart geometry, in points (the card is 350 wide with 20 of padding)

const PLOT_W = 310, PLOT_H = 112, SAMPLES = 64;
/** Swift's chart domain: values on 0...1 sit inside -0.16...1.3, which leaves room for the min and max labels. */
const yOf = (n: number) => (PLOT_H * (1.3 - n)) / 1.46;
const xOf = (fraction: number) => fraction * PLOT_W;
const normalize = (v: number[]) => { const lo = Math.min(...v), span = Math.max(...v) - lo || 1; return v.map((x) => (x - lo) / span); };
/** Every range resampled to one count, so a range switch bends the line instead of redrawing it (ScrubChart.resample). */
const resample = (v: number[]) => Array.from({ length: SAMPLES }, (_, i) => { const x = (i / (SAMPLES - 1)) * (v.length - 1), j = Math.floor(x), f = x - j; return v[j] + (v[Math.min(j + 1, v.length - 1)] - v[j]) * f; });
type Pt = [number, number];
/** Catmull-Rom through the samples as cubic beziers (the chart's `.catmullRom`). */
function smooth(p: Pt[]) {
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], e = p[Math.min(i + 2, p.length - 1)];
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}

// MARK: Motion helpers

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Springs a vector toward `target` as SwiftUI interpolates real numbers, keeping velocity through a retarget. */
function useSpring(target: number[], role: Role) {
  const [cur, setCur] = useState(target);
  const state = useRef({ x: target, v: target.map(() => 0) });
  const key = target.map((n) => n.toFixed(4)).join(",");
  useEffect(() => {
    const s = state.current, to = target;
    if (reducedMotion()) { s.x = to; s.v = to.map(() => 0); setCur(to); return; }
    const { duration, bounce } = roles[role];
    const w = (2 * Math.PI) / duration, z = 1 - Math.min(Math.max(bounce, 0), 0.99);
    const x = to.map((v, i) => s.x[i] ?? v), v = to.map((_, i) => s.v[i] ?? 0);
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = Math.max(now, last);
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let n = 0; n < steps; n++) for (let i = 0; i < x.length; i++) { v[i] += (-w * w * (x[i] - to[i]) - 2 * z * w * v[i]) * h; x[i] += v[i] * h; }
      const done = x.every((xi, i) => Math.abs(xi - to[i]) < 1e-3 && Math.abs(v[i]) / w < 1e-3);
      s.x = done ? to : x.slice(); s.v = done ? to.map(() => 0) : v.slice();
      setCur(s.x);
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

/** One glyph moving `travel` ems along y and fading, in or out, on the value spring (no overshoot). */
function Moving({ ch, travel, out = false, delay }: { ch: string; travel: number; out?: boolean; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const { easing, ms: dur } = curve("value");
    const away = { transform: `translateY(${travel}em)`, opacity: 0, filter: "blur(0.04em)" }, home = { transform: "none", opacity: 1, filter: "blur(0)" };
    const a = el.animate(out ? [home, away] : [away, home], { duration: dur, delay, easing, fill: "both" });
    return () => a.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="inline-block" aria-hidden={out || undefined}>{ch}</span>;
}

/** A changed glyph in its slot: the old one leaves as the new one arrives from the side the value is heading. */
function Glyph({ ch, was, up, delay, color }: { ch: string; was: string; up: boolean; delay: number; color?: string }) {
  const d = up ? 0.45 : -0.45;
  return (
    <span className="relative inline-block" style={{ color }}>
      {was ? <span className="absolute inset-0 text-center"><Moving ch={was} travel={-d} out delay={delay} /></span> : null}
      <Moving ch={ch} travel={d} delay={delay} />
    </span>
  );
}

/**
 * Text whose changed characters roll in, as SwiftUI's `.numericText` does, but only when `beat` changes with it: a
 * scrub step changes the text with no beat and stays instant. With `dim`, the decimals take that colour.
 */
function Roll({ text, value, beat, dim }: { text: string; value: number; beat: unknown; dim?: string }) {
  const [face, setFace] = useState({ text, from: text, value, beat, gen: 0, moves: false, up: true });
  if (face.text !== text) setFace({ text, from: face.text, value, beat, gen: face.gen + 1, moves: beat !== face.beat, up: value >= face.value });
  else if (face.beat !== beat) setFace({ ...face, beat });
  const cut = dim ? (text.lastIndexOf(".") < 0 ? text.length : text.lastIndexOf(".")) : text.length;
  const same = face.from.length === text.length;
  return (
    <span className="inline-flex" style={{ whiteSpace: "pre" }}>
      {text.split("").map((ch, k) => {
        const color = k >= cut ? dim : undefined;
        const changed = face.moves && (!same || face.from[k] !== ch);
        return changed ? <Glyph key={`${k}:${face.gen}`} ch={ch} was={same ? face.from[k] : ""} up={face.up} delay={k * 18} color={color} /> : <span key={`${k}:s`} style={{ color }}>{ch}</span>;
      })}
    </span>
  );
}

function Arrow({ up, size }: { up: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: bu(size), height: bu(size), flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? "M7 17L17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9"} />
    </svg>
  );
}

/**
 * The readout row: the figure, then the change chip. As in Swift, the chip keeps its size and the figure shrinks to
 * fit what is left of the row (its `minimumScaleFactor`, down to half), so a wider chip makes a smaller figure.
 */
function Readout({ size, figure, chip, fitKey }: { size: number; figure: ReactNode; chip: ReactNode; fitKey: string }) {
  const row = useRef<HTMLDivElement>(null), fig = useRef<HTMLSpanElement>(null), tag = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const current = useRef(1);
  // Measured once per change of text: the figure's width at its current scale gives its natural width.
  useLayoutEffect(() => {
    const r = row.current, f = fig.current, c = tag.current;
    if (!r || !f || !c) return;
    const natural = f.offsetWidth / current.current;
    const room = r.clientWidth - c.offsetWidth - (r.clientWidth / 310) * 10;
    const next = Math.min(1, Math.max(0.5, room / natural));
    if (Math.abs(next - current.current) > 0.004) { current.current = next; setScale(next); }
  }, [fitKey]);
  return (
    // On the figure's first baseline, as Swift's HStack(alignment: .firstTextBaseline) sets them.
    <div ref={row} className="flex items-baseline" style={{ gap: bu(10), height: bu(48), paddingTop: bu(2) }}>
      <span ref={fig} style={{ fontSize: bu(size * scale), letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{figure}</span>
      <div ref={tag} className="shrink-0">{chip}</div>
    </div>
  );
}

const caps: CSSProperties = { fontSize: bu(12), letterSpacing: bu(1.2), textTransform: "uppercase", color: ground.muted, lineHeight: bu(14) };

// MARK: Tile (Live Stat at half width)

function Tile({ label, text, value, beat, delta, history }: { label: string; text: string; value: number; beat: unknown; delta: string; history: number[] }) {
  const W = 133.5, H = 40, pad = 7;
  const n = normalize(history);
  const p = n.map((y, i): Pt => [(i / (n.length - 1)) * W, pad + (1 - y) * (H - pad * 2)]);
  const tip = p[p.length - 1];
  return (
    // Each tile is its own glass group, as in Swift: two tiles 12 pt apart never melt into each other.
    <LiquidGroup unit={bu(1)} axis="y" style={{ flex: 1, minWidth: 0 }}>
      <Liquid radius={20} style={{ padding: bu(18) }}>
        <div className="flex items-center justify-between" style={{ height: bu(28) }}>
          <span style={caps}>{label}</span>
          {/* A tinted fill on the panel, not a glass shape of its own. */}
          <span className="inline-flex items-center rounded-full" style={{ gap: bu(4), height: bu(28), paddingInline: bu(10), background: blocks.sage, color: ink, fontSize: bu(13), fontVariantNumeric: "tabular-nums" }}>
            <Arrow up size={11} />{delta}
          </span>
        </div>
        <div style={{ marginTop: bu(12), height: bu(36), display: "flex", alignItems: "center", fontSize: bu(30), letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: ground.text }}>
          <Roll text={text} value={value} beat={beat} />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" style={{ marginTop: bu(12), width: "100%", height: bu(H) }} aria-hidden>
          <path d={p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: ground.text }} />
          <circle cx={tip[0]} cy={tip[1]} r={6.5} strokeWidth={3} style={{ fill: blocks.butter, stroke: ground.surface }} />
        </svg>
      </Liquid>
    </LiquidGroup>
  );
}

// MARK: The block

type Loop = { range: number; finger: number | null; moving: boolean; visitors: number; beat: number };
const REST: Loop = { range: 1, finger: null, moving: false, visitors: 12_480, beat: 0 };

export function StatsOverviewBlockPreview() {
  const [s, setS] = useState<Loop>(REST);
  const raf = useRef(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const patch = (next: Partial<Loop>, animated = true) => setS((o) => ({ ...o, ...next, beat: animated ? o.beat + 1 : o.beat }));
    // A finger-less drag across the points, easing in and out the way a hand does; each point it reaches lands at once.
    const drag = (from: number, to: number, dur: number) => {
      cancelAnimationFrame(raf.current);
      const start = performance.now();
      let last = from;
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        const i = Math.round(from + (to - from) * e);
        if (i !== last) { last = i; patch({ finger: i, moving: true }, false); }
        if (p < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };
    let timers: ReturnType<typeof setTimeout>[] = [];
    const steps: [number, () => void][] = [
      [1100, () => patch({ finger: 4, moving: false })],
      [1300, () => drag(4, 23, 1700)],
      [3300, () => { cancelAnimationFrame(raf.current); patch({ finger: null, moving: false }); }],
      [4400, () => patch({ range: 2 })],
      [6300, () => patch({ visitors: 12_536 })],
      [8500, () => patch({ range: 1 })],
      [9300, () => patch({ visitors: 12_480 })],
    ];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, 11_000);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); cancelAnimationFrame(raf.current); };
  }, []);

  // The chart: the plotted range's samples on 0...1, bent toward the new range on the value spring.
  const data = points(s.range);
  const shape = useSpring(normalize(resample(data)), "value");
  const line: Pt[] = shape.map((y, i) => [xOf(i / (SAMPLES - 1)), yOf(y)]);
  // The min and max labels leave as the range changes and come back once the line has landed on it.
  const [landed, setLanded] = useState(s.range);
  useEffect(() => {
    if (landed === s.range) return;
    const id = setTimeout(() => setLanded(s.range), ms("value"));
    return () => clearTimeout(id);
  }, [s.range]); // eslint-disable-line react-hooks/exhaustive-deps

  const touching = s.finger !== null;
  // The rule, the dot and the flag fade out where the finger left them.
  const held = useRef(0);
  if (s.finger !== null) held.current = s.finger;
  const at = s.finger !== null ? Math.min(s.finger, data.length - 1) : data.length - 1;
  const mark = Math.min(held.current, data.length - 1);
  const fraction = (i: number) => i / (data.length - 1);
  const norm = normalize(data);
  const shown = data[at];
  const change = shown - data[0], pct = (Math.abs(change) / data[0]) * 100;
  const hi = data.indexOf(Math.max(...data)), lo = data.indexOf(Math.min(...data));
  const labels = !touching && landed === s.range;
  const motion: Role = touching ? "snap" : "dismiss";
  const flagX = Math.min(Math.max(xOf(fraction(mark)), 29), PLOT_W - 29);
  const day = 90 - data.length + at;
  const markDay = 90 - data.length + mark;
  const visitorsHistory = [...VISITORS.slice(0, -1), s.visitors];
  const swell = 1.28, unit = (PLOT_W - liquid.joined * 2) / (2 + swell);

  return (
    <div className="absolute inset-0" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600 }}>
      <BlockCanvas style={{ paddingTop: bu(5) }}>
        {/* Header */}
        <div style={{ fontSize: bu(22), lineHeight: bu(28), color: ground.text }}>Overview</div>
        <div style={{ marginTop: bu(4), fontSize: bu(15), lineHeight: bu(20), color: ground.muted }}>Updated just now</div>

        {/* The headline card: a plain surface holding the Scrub Chart. */}
        <div style={{ marginTop: bu(16), padding: bu(20), borderRadius: bu(28), background: ground.surface }}>
          <div style={{ fontSize: bu(17), lineHeight: bu(22) }}>Recurring revenue</div>
          <div style={{ marginTop: bu(10), height: bu(70) }}>
            <div style={caps}>{touching ? dayLabel(day).toUpperCase() : `Latest · ${RANGES[s.range].label}`}</div>
            <div style={{ marginTop: bu(8) }}>
              <Readout
                size={40}
                fitKey={`${usd(shown)}|${usd(change)}|${pct.toFixed(1)}`}
                figure={<Roll text={usd(shown)} value={shown} beat={`${touching}:${s.range}`} dim={ground.muted} />}
                chip={
                  <LiquidGroup unit={bu(1)}>
                    <Liquid tint={blocks.sage} className="inline-flex items-center" style={{ gap: bu(4), height: bu(28), paddingInline: bu(10), fontSize: bu(13), color: ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <Arrow up={change >= 0} size={11} />
                      <Roll text={`${change < 0 ? "−" : "+"}${usd(Math.abs(change))}`} value={change} beat={`${touching}:${s.range}`} />
                      <Roll text={`${pct.toFixed(1)}%`} value={pct} beat={`${touching}:${s.range}`} />
                    </Liquid>
                  </LiquidGroup>
                }
              />
            </div>
          </div>

          {/* The plot: line, dashed baseline at the first value, min and max, the latest dot; the scrub on top. */}
          <div className="relative" style={{ marginTop: bu(14), height: bu(PLOT_H) }}>
            <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="absolute inset-0 block h-full w-full overflow-visible" aria-hidden>
              <line x1={0} x2={PLOT_W} y1={line[0][1]} y2={line[0][1]} strokeWidth={1} strokeDasharray="2 5" style={{ stroke: ground.muted, opacity: 0.6 }} />
              <path d={smooth(line)} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: ground.text }} />
              <g style={{ opacity: labels ? 1 : 0, transition: labels ? t("opacity", "reveal") : "none" }} fontSize={11} fontFamily={font.mono} textAnchor="middle">
                <text x={xOf(fraction(hi))} y={yOf(norm[hi]) - 9} style={{ fill: ground.muted }}>{usd(data[hi])}</text>
                <text x={xOf(fraction(lo))} y={yOf(norm[lo]) + 17} style={{ fill: ground.muted }}>{usd(data[lo])}</text>
              </g>
              {/* The scrub rule follows the finger with no easing; only its arrival and exit animate. */}
              <line x1={xOf(fraction(mark))} x2={xOf(fraction(mark))} y1={0} y2={PLOT_H} strokeWidth={1.5} style={{ stroke: ground.text, opacity: touching ? 1 : 0, transition: t("opacity", motion) }} />
              {/* At rest the latest value wears the butter dot, ringed in the card; under the finger it rides the line. */}
              <circle cx={line[SAMPLES - 1][0]} cy={line[SAMPLES - 1][1]} r={6.5} strokeWidth={3} style={{ fill: blocks.butter, stroke: ground.surface, opacity: touching ? 0 : 1, transition: t("opacity", motion) }} />
              <circle cx={xOf(fraction(mark))} cy={yOf(norm[mark])} r={6.5} strokeWidth={3} style={{ fill: blocks.butter, stroke: ground.surface, opacity: touching ? 1 : 0, transition: t("opacity", touching ? "press" : "dismiss") }} />
            </svg>
            {/* The glass flag rides the top of the rule with the day; it grows out of the rule and sinks back on release. */}
            <LiquidGroup unit={bu(1)} className="pointer-events-none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: bu(24) }}>
              <div style={{ position: "absolute", top: 0, left: bu(flagX - 29), width: bu(58), height: bu(24), transform: `scale(${touching ? 1 : 0.5})`, transformOrigin: "50% 100%", opacity: touching ? 1 : 0, transition: t(["transform", "opacity"], motion) }}>
                <Liquid className="flex h-full items-center justify-center" style={{ fontSize: bu(11), fontFamily: font.mono, color: ground.text, whiteSpace: "nowrap" }}>{dayLabel(markDay)}</Liquid>
              </div>
            </LiquidGroup>
          </div>
          <div className="flex justify-between" style={{ ...caps, fontSize: bu(11), letterSpacing: bu(0.6), height: bu(20), alignItems: "flex-end" }}>
            {RANGES[s.range].axis.map((label) => <span key={label}>{label}</span>)}
          </div>

          {/* The range picker: joined glass segments; the picked one swells and takes the butter tint. */}
          <LiquidGroup unit={bu(1)} style={{ marginTop: bu(14) }}>
            <div className="flex" style={{ gap: bu(liquid.joined) }}>
              {RANGES.map((r, i) => (
                <Liquid key={r.label} tint={i === s.range ? blocks.butter : undefined} className="flex items-center justify-center" style={{ width: bu(unit * (i === s.range ? swell : 1)), height: bu(44), fontSize: bu(15), color: i === s.range ? ink : ground.muted, transition: t(["width", "background-color", "color"], "snap") }}>
                  {r.label}
                </Liquid>
              ))}
            </div>
          </LiquidGroup>
        </div>

        {/* The first row of tiles. */}
        <div className="flex" style={{ marginTop: bu(12), gap: bu(12) }}>
          <Tile label="Visitors" text={whole(s.visitors)} value={s.visitors} beat={s.visitors} delta="8%" history={visitorsHistory} />
          <Tile label="Trials" text="412" value={412} beat={0} delta="12%" history={TRIALS} />
        </div>
      </BlockCanvas>
    </div>
  );
}

