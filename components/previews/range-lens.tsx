"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { font, ground, ink, signal } from "./palette";
import { curve, ms, reduced, t } from "./piece-motion";
import { Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Range Lens: a year of daily steps. The readout names the window's average and its dates, the detail chart draws the
 * window's days as bars under a red dashed average rule with its "avg" chip on the value axis, and the strip under it
 * draws every day on a quiet track, with the glass lens (a slab joined to a handle at each end) over the window.
 * The component only, on the plain stage. Sizes are authored in px against the 560 px docs stage and converted to
 * `cqw`; the liquid group takes one stage px as its point.
 *
 * Motion follows the Swift piece: a finger's drag is cut into short linear steps so everything stays under it, a
 * release settles on the settle role, Show all and back morph, and the detail's ceiling follows the window's highest
 * day on the value role, so the bars rescale without overshooting.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A finger moving over one scripted step: linear, so the surface keeps pace with it instead of easing in. */
const tracking = (props: string[], stepMs: number) => props.map((p) => `${p} ${Math.round(stepMs)}ms linear`).join(", ");

// ---------------------------------------------------------------- Data

/** 365 days ending Sunday 11 October 2026, in UTC so the server and the browser draw the same year. */
const DAYS = 365;
const END = Date.UTC(2026, 9, 11);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateOf = (k: number) => new Date(END - (DAYS - 1 - k) * 86_400_000);

/** The Swift example's generator: weekends higher, a summer rise, a holiday dip at the turn of the year, the odd rest day. */
const VALUES = Array.from({ length: DAYS }, (_, k) => {
  const d = dateOf(k);
  const noise = ((k * 7919 + 13) % 101) / 100;
  const rest = ((k * 4021 + 71) % 97) / 96;
  const weekday = d.getUTCDay();
  const month = d.getUTCMonth() + 1, day = d.getUTCDate();
  const dayOfYear = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1;
  const summer = Math.exp(-(((dayOfYear - 200) / 48) ** 2));
  let steps = 7400 + 2300 * summer + (weekday === 6 ? 2800 : weekday === 0 ? 1900 : 0) + (noise - 0.5) * 2800;
  if ((month === 12 && day >= 23) || (month === 1 && day <= 1)) steps *= 0.5;
  if (rest < 0.05) steps = 2400 + noise * 900;
  return Math.round(Math.max(steps, 600));
});
const MAX = Math.max(...VALUES);
const PREFIX = VALUES.reduce<number[]>((sums, v) => (sums.push(sums[sums.length - 1] + v), sums), [0]);

/** The whole days a span rests on, at least a week. */
function windowOf(start: number, end: number): [number, number] {
  let lo = Math.min(Math.max(Math.round(start), 0), DAYS - 1);
  let hi = Math.min(Math.max(Math.round(end) - 1, lo), DAYS - 1);
  if (hi - lo + 1 < 7) { hi = Math.min(lo + 6, DAYS - 1); lo = Math.max(hi - 6, 0); }
  return [lo, hi];
}
const average = ([lo, hi]: [number, number]) => (PREFIX[hi + 1] - PREFIX[lo]) / (hi - lo + 1);
const peak = ([lo, hi]: [number, number]) => Math.max(...VALUES.slice(lo, hi + 1));
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const compact = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));
/** "31 Aug – 11 Oct", with the year when the window crosses one or lies in an earlier year. */
function dateRange([lo, hi]: [number, number]) {
  const a = dateOf(lo), b = dateOf(hi);
  const years = a.getUTCFullYear() !== b.getUTCFullYear() || b.getUTCFullYear() !== 2026;
  const f = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${years ? ` ${d.getUTCFullYear()}` : ""}`;
  return lo === hi ? f(a) : `${f(a)} – ${f(b)}`;
}
/** The ceiling follows the window's highest day with a little headroom; gridlines stay on round steps, at most four. */
function scaleOf(w: [number, number]) {
  const top = peak(w) * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(top));
  const step = [0.1, 0.2, 0.5, 1, 2, 5, 10].map((f) => f * magnitude).find((s) => top / s <= 4) ?? magnitude * 10;
  return { top, step };
}

// ---------------------------------------------------------------- Geometry (px at the 560 stage)

const LEFT = 44, W = 472;
const READOUT_H = 74, CHART_PAD = 12, PLOT_H = 140, GUTTER = 42, PLOT_W = W - GUTTER;
const ROW = 52, HANDLE = 14, INSET = HANDLE + liquid.joined, BAR_PAD = 8, MARKS_H = 20;
const TOTAL = READOUT_H + 16 + CHART_PAD * 2 + PLOT_H + 16 + ROW + MARKS_H;
const TOP = (420 - TOTAL) / 2;
const PLOT_TOP = TOP + READOUT_H + 16 + CHART_PAD;
const STRIP_TOP = PLOT_TOP + PLOT_H + CHART_PAD + 16;
const SLOT = (W - INSET * 2) / DAYS;
/** A point along the strip for a position in days, from the strip's leading edge. */
const xOf = (days: number) => INSET + days * SLOT;
/** The slab over a span: centred on the window, never narrower than 20, kept on the track. */
function slab(start: number, end: number) {
  const lo = xOf(start), hi = xOf(end), width = Math.max(hi - lo, 20);
  const left = Math.min(Math.max((lo + hi) / 2 - width / 2, Math.min(lo, INSET)), Math.max(hi, W - INSET) - width);
  return { left, width };
}
/** Month marks under the strip, every second month; January names its year. */
const MARKS = (() => {
  const out: Array<{ x: number; text: string }> = [];
  for (let k = 1; k < DAYS; k++) {
    const d = dateOf(k);
    if (d.getUTCDate() !== 1) continue;
    const m = d.getUTCMonth();
    if (m % 2 === 0) out.push({ x: xOf(k), text: m === 0 ? String(d.getUTCFullYear()) : MON[m] });
  }
  return out;
})();

// ---------------------------------------------------------------- Storyboard

type Grab = "" | "body" | "upper";
type Move = "rest" | "track" | "settle" | "morph";
/**
 * One beat of the loop. `start` and `end` are the lens's edges in days; `grab` is what the finger holds; `finger` is
 * where it is along the strip in px (null while lifted) and `tap` counts the double taps. The finger is not drawn (what
 * it holds shows the touch, as in every preview); both place it in the launch video.
 * `move` is how the lens gets to this beat: under a finger (`track`, linear over the beat), or on a role.
 */
type Step = { start: number; end: number; grab: Grab; finger: number | null; tap?: number; move: Move; ms: number; note?: string };

const ease = (k: number) => k * k * (3 - 2 * k);
const REST: [number, number] = [323, 365];

const steps: readonly Step[] = (() => {
  const out: Step[] = [];
  let [start, end] = REST;
  const mid = () => slab(start, end).left + slab(start, end).width / 2;
  const upperX = () => { const s = slab(start, end); return s.left + s.width + liquid.joined + HANDLE / 2; };
  const push = (step: Partial<Step> & { ms: number }) => out.push({ start, end, grab: "", finger: null, move: "rest", ...step });
  /** A finger dragging the lens (or one edge) to new edges over `dragMs`, speeding up and slowing down. */
  const drag = (grab: Grab, toStart: number, toEnd: number, dragMs: number) => {
    const fromStart = start, fromEnd = end, n = Math.max(1, Math.round(dragMs / 80));
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      start = fromStart + (toStart - fromStart) * k;
      end = fromEnd + (toEnd - fromEnd) * k;
      push({ grab, finger: grab === "body" ? mid() : upperX(), move: "track", ms: dragMs / n });
    }
  };
  push({ ms: 1500, note: "Rest: the lens over the last six weeks, 31 Aug to 11 Oct, average 8,4xx steps a day." });
  push({ grab: "body", finger: mid(), ms: 280, note: "A finger takes the slab: it swells a little." });
  drag("body", 225, 267, 1500);
  start = 225; end = 267;
  push({ move: "settle", ms: 1200, note: "Let go: the lens lands on whole days in late spring; the detail panned and the average rolled up." });
  push({ grab: "upper", finger: upperX(), ms: 280, note: "The trailing handle is grabbed: it swells and floods red." });
  drag("upper", 225, 302, 800);
  start = 225; end = 302;
  push({ move: "settle", ms: 1000, note: "Released wider: eleven weeks." });
  push({ finger: xOf(140), tap: 1, ms: 320, note: "Double tap the strip." });
  start = 0; end = DAYS;
  push({ move: "morph", ms: 2000, note: "Show all: the lens spans the year and the detail thins to every day." });
  push({ finger: xOf(140), tap: 2, ms: 320, note: "Double tap again." });
  start = 225; end = 302;
  push({ move: "morph", ms: 1300, note: "Back to the window before." });
  [start, end] = REST;
  push({ move: "settle", ms: 1300, note: "The app sets the last six weeks again: the lens glides home. Rest." });
  return out;
})();

// ---------------------------------------------------------------- Hooks

function useReducedMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOn(m.matches);
    const change = () => setOn(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  return on;
}

/** Walks the storyboard; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps<T extends { ms: number }>(list: readonly T[]) {
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) { setI(0); return; }
    const id = setTimeout(() => setI((v) => (v + 1) % list.length), list[i].ms);
    return () => clearTimeout(id);
  }, [i, list, still]);
  return list[i];
}

// ---------------------------------------------------------------- Pieces

/**
 * The numeral: on a programmatic change the digits that change roll, glyph by glyph, on the value spring, as Swift's
 * `.numericText()` does, and the digits that stay hold still. Under a finger it changes in place, so it stays legible.
 */
function Roll({ text, roll }: { text: string; roll: boolean }) {
  const [shown, setShown] = useState({ text, prev: "", n: 0 });
  let now = shown;
  if (shown.text !== text) {
    now = { text, prev: roll && !reduced() ? shown.text : "", n: shown.n + 1 };
    setShown(now);
  }
  useEffect(() => {
    if (!shown.prev) return;
    const id = setTimeout(() => setShown((v) => (v.n === shown.n ? { ...v, prev: "" } : v)), ms("value"));
    return () => clearTimeout(id);
  }, [shown.n, shown.prev]);
  const shift = text.length - now.prev.length;
  return [...text].map((ch, i) => {
    const old = now.prev[i - shift] ?? "";
    return now.prev && old !== ch ? <RollGlyph key={`${now.n}:${i}`} ch={ch} old={old} /> : <span key={i}>{ch}</span>;
  });
}

function RollGlyph({ ch, old }: { ch: string; old: string }) {
  const enter = useRef<HTMLSpanElement>(null), leave = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const { easing, ms: duration } = curve("value");
    const blur = `blur(${u(1.5)})`;
    const opts: KeyframeAnimationOptions = { duration, easing, fill: "both" };
    const runs = [
      enter.current?.animate([{ transform: "translateY(-0.5em) scale(0.75)", opacity: 0, filter: blur }, { transform: "none", opacity: 1, filter: "none" }], opts),
      leave.current?.animate([{ transform: "none", opacity: 1, filter: "none" }, { transform: "translateY(0.5em) scale(0.75)", opacity: 0, filter: blur }], opts),
    ];
    return () => runs.forEach((a) => a?.cancel());
  }, []);
  return (
    <span className="relative inline-block">
      <span ref={enter} className="inline-block">{ch}</span>
      <span ref={leave} className="absolute inset-0" style={{ opacity: 0 }}>{old}</span>
    </span>
  );
}

/**
 * The dates: under a finger they change at once; a programmatic change blurs the old range out as the new one sharpens
 * in, as `motion.swap` does. Drawn as one string, so it keeps its kerning.
 */
function Swap({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState({ text, prev: "", n: 0 });
  let now = shown;
  if (shown.text !== text) {
    now = { text, prev: animate && !reduced() ? shown.text : "", n: shown.n + 1 };
    setShown(now);
  }
  useEffect(() => {
    if (!shown.prev) return;
    const id = setTimeout(() => setShown((v) => (v.n === shown.n ? { ...v, prev: "" } : v)), ms("snap"));
    return () => clearTimeout(id);
  }, [shown.n, shown.prev]);
  const { easing, ms: duration } = curve("snap");
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span key={now.n} data-motion className="inline-block" style={{ animation: now.prev ? `rl-swap-in ${duration}ms ${easing} both` : undefined }}>{text}</span>
      {now.prev ? <span key={`o${now.n}`} data-motion aria-hidden className="absolute left-0 top-0" style={{ animation: `rl-swap-out ${Math.round(duration * 0.6)}ms ease-out both` }}>{now.prev}</span> : null}
    </span>
  );
}

/** Every day as a bar on one scale, bottom aligned, in one colour. Heights in percent of the row. */
function Days({ color, fill }: { color: string; fill?: boolean }) {
  return (
    <>
      {VALUES.map((v, i) => (
        <span key={i} className="absolute bottom-0" style={fill ? {
          // Detail bars: the gap closes as the bars thin (`--rl-fill`), so a year reads as one silhouette.
          left: `calc((${i} + (1 - var(--rl-fill)) / 2) * 100% / ${DAYS})`, width: `calc(var(--rl-fill) * 100% / ${DAYS})`,
          height: `${(v / MAX) * 100}%`, background: color, borderRadius: `${u(3)} ${u(3)} 0 0`,
        } : {
          left: `${((i + 0.18) / DAYS) * 100}%`, width: `${(0.64 / DAYS) * 100}%`, height: `${Math.max((v / MAX) * 100, 4)}%`, background: color,
        }} />
      ))}
    </>
  );
}

const properties = "@property --rl-fill{syntax:'<number>';inherits:true;initial-value:0.62}";
const keyframes = "@keyframes rl-swap-in{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:none}}@keyframes rl-swap-out{from{opacity:1;filter:none}to{opacity:0;filter:blur(3px)}}@keyframes rl-in{from{opacity:0}to{opacity:1}}";

// ---------------------------------------------------------------- Preview

export function RangeLensPreview() {
  const s = useSteps(steps);
  const w = windowOf(s.start, s.end);
  const { top, step } = scaleOf(w);
  const avg = average(w);
  const move = (props: string[]) => (s.move === "track" ? tracking(props, s.ms) : t(props, s.move === "morph" ? "morph" : "settle"));
  const visible = s.end - s.start;
  const sd = PLOT_W / visible;
  const fillAmount = sd < 1.5 ? 1 : sd > 6 ? 0.62 : sd > 2.5 ? 0.7 : 0.8;
  const lens = slab(s.start, s.end);
  const held = s.grab;
  const swell = held === "body" ? 3 : 0;
  const ticks = Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step);
  const avgY = (avg / top) * PLOT_H;
  const chipH = 19;
  const label: CSSProperties = { fontSize: u(11), fontWeight: 600, color: ground.subtle, lineHeight: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const dim = `color-mix(in srgb, ${ground.muted} 40%, ${ground.bg})`;
  const track = `color-mix(in srgb, ${ground.field} 50%, ${ground.bg})`;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{properties + keyframes}</style>

      {/* Readout: the summary over its dates. */}
      <div className="absolute" style={{ left: u(LEFT), top: u(TOP), display: "flex", flexDirection: "column", gap: u(3) }}>
        <span style={{ fontSize: u(13), fontWeight: 600, color: ground.muted, lineHeight: u(16) }}>Average</span>
        <span className="flex items-baseline tabular-nums" style={{ gap: u(6), lineHeight: u(36) }}>
          <span style={{ fontSize: u(32), fontWeight: 600, letterSpacing: u(-0.4) }}><Roll text={grouped(avg)} roll={s.move !== "track"} /></span>
          <span style={{ fontSize: u(15), fontWeight: 600, color: ground.muted }}>steps a day</span>
        </span>
        <span className="tabular-nums" style={{ fontSize: u(13), fontWeight: 600, color: ground.muted, lineHeight: u(16) }}><Swap text={dateRange(w)} animate={s.move !== "track"} /></span>
      </div>

      {/* Detail: gridlines on round values that slide as the ceiling follows the window, and their values. */}
      {ticks.map((tick) => {
        const y = PLOT_H - (tick / top) * PLOT_H;
        const covered = Math.abs(PLOT_H - avgY - y) < chipH * 0.8;
        return (
          <span key={tick} data-motion style={{ animation: "rl-in 300ms ease-out both" }}>
            <span data-motion className="absolute" style={{ left: u(LEFT), top: u(PLOT_TOP), width: u(PLOT_W), height: u(1), background: ground.trough, transform: `translateY(${u(y)})`, transition: t("transform", "value") }} />
            <span data-motion className="absolute" style={{ ...label, left: u(LEFT + PLOT_W + 8), top: u(PLOT_TOP), transform: `translateY(calc(${u(y)} - 50%))`, opacity: covered ? 0 : 1, transition: [t("transform", "value"), t("opacity", "value")].join(", ") }}>{compact(tick)}</span>
          </span>
        );
      })}
      <span className="absolute" style={{ ...label, left: u(LEFT + PLOT_W + 8), top: u(PLOT_TOP + PLOT_H), transform: "translateY(-50%)" }}>0</span>
      <span className="absolute" style={{ left: u(LEFT), top: u(PLOT_TOP + PLOT_H - 1), width: u(PLOT_W), height: u(1), background: ground.trough }} />
      {/* The window's days, sliding with the lens; the ceiling sets their height on the value role. */}
      <div className="absolute overflow-hidden" style={{ left: u(LEFT), top: u(PLOT_TOP - CHART_PAD), width: u(PLOT_W), height: u(PLOT_H + CHART_PAD) }}>
        <div data-motion className="absolute bottom-0" style={{
          left: u(-s.start * sd), width: u(DAYS * sd), height: u((PLOT_H * MAX) / top),
          "--rl-fill": fillAmount,
          transition: [move(["left", "width", "--rl-fill"]), t("height", "value")].join(", "),
        } as CSSProperties}>
          <Days color={ground.text} fill />
        </div>
      </div>
      {/* The average: a red dashed rule across the plot and its chip on the axis. */}
      <span data-motion className="absolute" style={{
        left: u(LEFT), top: u(PLOT_TOP + PLOT_H), width: u(PLOT_W), height: u(1.5),
        backgroundImage: `linear-gradient(90deg, ${signal.fill} 0 ${u(3)}, transparent ${u(3)} ${u(7)})`, backgroundSize: `${u(7)} 100%`,
        transform: `translateY(${u(-avgY)})`, transition: t("transform", s.move === "track" ? "value" : s.move === "morph" ? "morph" : "settle"),
      }} />
      <span data-motion className="absolute flex items-center justify-center" style={{
        left: u(LEFT + PLOT_W + 4), top: u(PLOT_TOP + PLOT_H - chipH / 2), height: u(chipH), paddingInline: u(6), borderRadius: 999,
        background: signal.fill, color: signal.on, fontSize: u(11), fontWeight: 600, lineHeight: 1,
        transform: `translateY(${u(-avgY)})`, transition: t("transform", s.move === "track" ? "value" : s.move === "morph" ? "morph" : "settle"),
      }}>avg</span>

      {/* Strip: the track, every day dim under the glass, the lens, and the window's days bright on the slab. */}
      <span className="absolute" style={{ left: u(LEFT), top: u(STRIP_TOP), width: u(W), height: u(ROW), borderRadius: u(12), background: track }} />
      <div className="absolute" style={{ left: u(LEFT + INSET), top: u(STRIP_TOP + BAR_PAD), width: u(W - INSET * 2), height: u(ROW - BAR_PAD * 2) }}>
        <Days color={dim} />
      </div>
      <LiquidGroup unit={u(1)} className="absolute" style={{ left: u(LEFT), top: u(STRIP_TOP), width: u(W), height: u(ROW) }}>
        <span data-motion className="absolute top-0" style={{ left: u(lens.left), width: u(lens.width), height: u(ROW), transition: move(["left", "width"]) }}>
          <Liquid radius={12 + swell} className="absolute" style={{ inset: u(-swell), transition: t(["inset", "border-radius"], held === "body" ? "press" : "release") }} />
        </span>
        {(["lower", "upper"] as const).map((side) => {
          const on = side === "upper" && held === "upper";
          const x = side === "lower" ? lens.left - liquid.joined - HANDLE : lens.left + lens.width + liquid.joined;
          return (
            <span key={side} data-motion className="absolute top-0" style={{ left: u(x), width: u(HANDLE), height: u(ROW), transition: move(["left"]) }}>
              <Liquid tint={on ? signal.fill : undefined} className="flex h-full w-full items-center justify-center" style={{
                transform: `scale(${on ? 1.12 : 1})`, transition: [t("transform", on ? "press" : "release"), t("background-color", on ? "press" : "release")].join(", "),
              }}>
                <span data-motion style={{ width: u(3), height: u(16), borderRadius: 999, background: on ? ink : ground.muted, transition: t("background-color", on ? "press" : "release") }} />
              </Liquid>
            </span>
          );
        })}
      </LiquidGroup>
      <div data-motion className="absolute" style={{
        left: u(LEFT + INSET), top: u(STRIP_TOP + BAR_PAD), width: u(W - INSET * 2), height: u(ROW - BAR_PAD * 2),
        clipPath: `inset(0 ${u((DAYS - s.end) * SLOT)} 0 ${u(s.start * SLOT)})`, transition: move(["clip-path"]),
      }}>
        <Days color={ground.text} />
      </div>
      {MARKS.map((m) => (
        <span key={m.x} className="absolute" style={{ ...label, color: ground.subtle, left: u(LEFT + m.x), top: u(STRIP_TOP + ROW + 7) }}>{m.text}</span>
      ))}

    </div>
  );
}
