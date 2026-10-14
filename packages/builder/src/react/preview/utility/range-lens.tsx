"use client";
// Range Lens in the Playground: the same sample series as the generated app (the generator is shared with the
// definition). Drag the glass slab on the strip to move the window, drag a handle (or near an edge) to resize it,
// click beside the lens to centre it there, and double-click to show the whole series and again to go back. The
// readout, the detail chart and its average rule follow live; release lands the lens on whole days with a short
// coast, with a selection tick at each week crossed and a light tap when a handle is grabbed. Mirrors RangeLens.swift.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { LENS_DEFAULTS, LENS_SERIES, lensSample } from "../../../definitions/utility/range-lens.js";
import { glassSurface } from "../glass.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { useDrag, useLive, useRuntime, type DragInfo } from "../runtime.js";

const ROW = 52;
const HANDLE = 14;
const INSET = HANDLE + 4;
const BAR_PAD = 8;
const PLOT_H = 160;
const PAD = 12;
const GUTTER = 42;
const KEYFRAMES = "@media (prefers-reduced-motion: reduce){[data-sprl-motion]{animation:none!important;transition:none!important}}";

type Span = { start: number; end: number };
type Part = "lower" | "body" | "upper";
type Grab = { part: Part; origin: Span; x: number; bucket: number; limited: boolean };

function useReducedMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setOn(m.matches);
    const change = () => setOn(m.matches);
    m.addEventListener?.("change", change);
    return () => m.removeEventListener?.("change", change);
  }, []);
  return on;
}

/** A value that follows its target over `ms` with no overshoot, as the value role does. */
function useEased(target: number, ms: number, off: boolean) {
  const [value, setValue] = useState(target);
  const live = useRef(target);
  useEffect(() => {
    if (off) { live.current = target; setValue(target); return; }
    const from = live.current, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min((now - t0) / ms, 1);
      const v = from + (target - from) * (1 - (1 - k) ** 3);
      live.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, off]);
  return value;
}

type Model = { dates: Date[]; values: number[]; prefix: number[]; max: number; weeks: number[] };

function buildModel(series: string, count: number, empty: boolean): Model {
  if (empty) return { dates: [], values: [], prefix: [0], max: 0, weeks: [] };
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dates = Array.from({ length: count }, (_, k) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - (count - 1 - k)));
  const values = dates.map((d, k) => lensSample(series, k, d));
  const prefix = values.reduce<number[]>((sums, v) => (sums.push(sums[sums.length - 1] + v), sums), [0]);
  // The haptic bucket: the week a day falls in (weeks start on Monday here; the app uses the person's calendar).
  const weeks = dates.map((d) => Math.floor((d.getTime() / 86_400_000 + 3) / 7));
  return { dates, values, prefix, max: Math.max(...values, 0), weeks };
}

const windowOf = (span: Span, count: number, minimum: number): [number, number] | null => {
  if (!count) return null;
  let lo = Math.min(Math.max(Math.round(span.start), 0), count - 1);
  let hi = Math.min(Math.max(Math.round(span.end) - 1, lo), count - 1);
  const width = Math.min(Math.max(minimum, 1), count);
  if (hi - lo + 1 < width) { hi = Math.min(lo + width - 1, count - 1); lo = Math.max(hi - width + 1, 0); }
  return [lo, hi];
};

/** Edge resistance past either end of the series, in points, as PieceMotion.rubberBand. */
const band = (over: number, limit = 28) => (over === 0 ? 0 : Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / limit + 1)) * limit);

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const key = LENS_SERIES[s(p, "series")] ? s(p, "series") : "steps";
  const series = LENS_SERIES[key];
  const empty = s(p, "data") === "empty";
  const minimum = Math.min(Math.max(Math.round(n(p, "minimumSpan") || LENS_DEFAULTS.minimumSpan), 1), 60);
  const opensOn = Math.min(Math.max(Math.round(n(p, "opensOn") || 42), minimum), series.days);
  const opens = s(p, "opens");
  const summary = s(p, "summary") || "average";
  const unit = s(p, "unit").trim();
  const showsAverage = p.showsAverage === undefined ? true : b(p, "showsAverage");
  const m = useMemo(() => buildModel(key, series.days, empty), [key, series.days, empty]);
  const count = m.values.length;
  const last = opens === "all" ? count : opens === "shortest" ? minimum : opensOn;
  // The window starts where the props say and follows them when they change, like a @State seeded from a parameter.
  const seedKey = `${key}:${empty}:${opens}:${opensOn}:${minimum}:${count}`;
  const [seed] = useLive(seedKey);
  const [span, setSpan] = useState<Span>({ start: Math.max(count - last, 0), end: count });
  const seeded = useRef(seed);
  if (seeded.current !== seed) {
    seeded.current = seed;
    setSpan({ start: Math.max(count - last, 0), end: count });
  }
  /** What the pointer holds, kept in a ref so a drag step never waits on a render. */
  const grabRef = useRef<Grab | null>(null);
  const [held, setHeld] = useState<Part | null>(null);
  const [previous, setPrevious] = useState<Span | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const tween = useRef(0);
  const clicks = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanRef = useRef(span);
  spanRef.current = span;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { cancelAnimationFrame(tween.current); if (clicks.current) clearTimeout(clicks.current); }, []);

  const W = Math.max(width, 200);
  const slot = count ? (W - INSET * 2) / count : 0;
  const xOf = (days: number) => INSET + days * slot;
  const lensOf = (sp: Span) => {
    const lo = xOf(sp.start), hi = xOf(sp.end), w = Math.max(hi - lo, 20);
    const left = Math.min(Math.max((lo + hi) / 2 - w / 2, Math.min(lo, INSET)), Math.max(hi, W - INSET) - w);
    return { left, width: w };
  };

  /** Glides the lens to `to`: a short ease with no overshoot under reduced motion, a settle otherwise. */
  const glide = (to: Span) => {
    cancelAnimationFrame(tween.current);
    const from = spanRef.current;
    if (still || reduced) { setSpan(to); return; }
    const t0 = performance.now(), ms = 420;
    const step = (now: number) => {
      const k = Math.min((now - t0) / ms, 1);
      // A settle with a little give, then home.
      const e = 1 - Math.exp(-6 * k) * Math.cos(4.2 * k) * (1 - k);
      setSpan({ start: from.start + (to.start - from.start) * e, end: from.end + (to.end - from.end) * e });
      if (k < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  };

  const partAt = (x: number, sp: Span): Part | null => {
    const l = lensOf(sp), reach = Math.min(22, l.width / 3), outer = INSET + 12;
    if (x >= l.left - outer && x <= l.left + reach) return "lower";
    if (x <= l.left + l.width + outer && x >= l.left + l.width - reach) return "upper";
    if (x > l.left && x < l.left + l.width) return "body";
    return null;
  };
  const clampSpan = (start: number, w: number): Span => {
    const width = Math.min(Math.max(w, 1), count);
    const st = Math.min(Math.max(start, 0), count - width);
    return { start: st, end: st + width };
  };

  const onPointerDown = useDrag({
    axis: "x",
    onStart(info: DragInfo) {
      if (count < 2 || !slot) return;
      cancelAnimationFrame(tween.current);
      const x = info.x - info.dx;
      let origin = spanRef.current;
      let part = partAt(x, origin);
      if (!part) {
        // Off the lens: it comes to the finger, centred there.
        origin = clampSpan(Math.round((x - INSET) / slot - (origin.end - origin.start) / 2), origin.end - origin.start);
        setSpan(origin);
        part = "body";
        rt.haptic("selection", info.el);
      } else if (part !== "body") rt.haptic("light", info.el);
      const edge = part === "upper" ? Math.max(Math.round(origin.end) - 1, 0) : Math.round(origin.start);
      grabRef.current = { part, origin, x, bucket: m.weeks[Math.min(edge, count - 1)], limited: false };
      setHeld(part);
    },
    onMove(info: DragInfo) {
      const g = grabRef.current;
      if (!g) return;
      {
        const d = (info.x - g.x) / slot;
        const o = g.origin, w = o.end - o.start, minW = Math.min(minimum, count);
        const bandSlots = (over: number) => band(over * slot) / slot;
        let next: Span, limited = false;
        if (g.part === "body") {
          let st = o.start + d;
          if (st < 0) { st = bandSlots(st); limited = true; } else if (st + w > count) { st = count - w + bandSlots(st + w - count); limited = true; }
          next = { start: st, end: st + w };
        } else if (g.part === "lower") {
          let st = o.start + d;
          if (st > o.end - minW) { st = o.end - minW; limited = true; } else if (st < 0) { st = bandSlots(st); limited = true; }
          next = { start: st, end: o.end };
        } else {
          let en = o.end + d;
          if (en < o.start + minW) { en = o.start + minW; limited = true; } else if (en > count) { en = count + bandSlots(en - count); limited = true; }
          next = { start: o.start, end: en };
        }
        setSpan(next);
        if (limited && !g.limited) rt.haptic("soft", info.el);
        const edge = g.part === "upper" ? Math.min(Math.max(Math.round(next.end) - 1, 0), count - 1) : Math.min(Math.max(Math.round(next.start), 0), count - 1);
        const bucket = m.weeks[edge];
        if (bucket !== g.bucket) rt.haptic("selection", info.el);
        grabRef.current = { ...g, bucket, limited };
      }
    },
    onEnd(info: DragInfo) {
      const g = grabRef.current;
      grabRef.current = null;
      setHeld(null);
      if (!g || !slot) return;
      const sp = spanRef.current;
      // A short coast with the flick, then whole days inside the series.
      const coast = (info.vx / 1000) * (0.99 / 0.01) / slot;
      const minW = Math.min(minimum, count);
      let to: Span;
      if (g.part === "body") to = clampSpan(Math.round(sp.start + coast), Math.max(Math.round(sp.end - sp.start), minW));
      else if (g.part === "lower") to = { start: Math.min(Math.max(Math.round(sp.start + coast), 0), Math.round(sp.end) - minW), end: Math.round(sp.end) };
      else to = { start: Math.round(sp.start), end: Math.max(Math.min(Math.round(sp.end + coast), count), Math.round(sp.start) + minW) };
      glide(to);
    },
  });

  const toggleAll = (el: Element | null) => {
    if (count < 2) return;
    const sp = spanRef.current;
    if (sp.start <= 0 && sp.end >= count) {
      if (!previous) return;
      glide(previous);
      setPrevious(null);
    } else {
      setPrevious({ start: Math.round(sp.start), end: Math.round(sp.end) });
      glide({ start: 0, end: count });
    }
    rt.haptic("light", el);
  };

  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (count < 2 || !slot) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / (el.clientWidth || 1));
    // A single click waits for a second, as the piece's tap waits for its double tap.
    if (clicks.current) {
      clearTimeout(clicks.current);
      clicks.current = null;
      toggleAll(el);
      return;
    }
    clicks.current = setTimeout(() => {
      clicks.current = null;
      const sp = spanRef.current;
      if (partAt(x, sp)) return;
      const w = sp.end - sp.start;
      glide(clampSpan(Math.round((x - INSET) / slot - w / 2), w));
      rt.haptic("selection", el);
    }, 260);
  };

  // ---------------------------------------------------------------- Readout

  const win = windowOf(span, count, minimum);
  const value = win
    ? summary === "total" ? m.prefix[win[1] + 1] - m.prefix[win[0]]
    : summary === "maximum" ? Math.max(...m.values.slice(win[0], win[1] + 1))
    : summary === "minimum" ? Math.min(...m.values.slice(win[0], win[1] + 1))
    : (m.prefix[win[1] + 1] - m.prefix[win[0]]) / (win[1] - win[0] + 1)
    : 0;
  const caption = summary === "total" ? "Total" : summary === "maximum" ? "Highest" : summary === "minimum" ? "Lowest" : "Average";
  const dates = (() => {
    if (!win) return "";
    const a = m.dates[win[0]], z = m.dates[win[1]];
    const year = a.getFullYear() !== z.getFullYear() || z.getFullYear() !== new Date().getFullYear();
    const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
    const range = fmt as Intl.DateTimeFormat & { formatRange?: (x: Date, y: Date) => string };
    return win[0] === win[1] ? fmt.format(a) : range.formatRange ? range.formatRange(a, z) : `${fmt.format(a)} – ${fmt.format(z)}`;
  })();

  // ---------------------------------------------------------------- Detail

  const peak = win ? Math.max(...m.values.slice(win[0], win[1] + 1)) : 0;
  const top = useEased(peak > 0 ? peak * 1.08 : 1, 350, still || reduced);
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(top, 1e-6)));
  const tickStep = peak > 0 ? [0.1, 0.2, 0.5, 1, 2, 5, 10].map((f) => f * magnitude).find((v) => top / v <= 4) ?? magnitude * 10 : 0;
  const ticks = tickStep ? Array.from({ length: Math.floor(top / tickStep) }, (_, i) => (i + 1) * tickStep) : [];
  const plotW = W - GUTTER;
  const visible = Math.max(span.end - span.start, 1e-4);
  const dslot = plotW / visible;
  const bw = dslot < 1.5 ? dslot : Math.min(dslot * (dslot > 6 ? 0.62 : dslot > 2.5 ? 0.7 : 0.8), 24);
  const radius = bw >= 2.5 ? Math.min(bw / 2, 3) : 0;
  const yOf = (v: number) => PAD + PLOT_H - (v / top) * PLOT_H;
  const bars: string[] = [];
  if (count) {
    for (let i = Math.max(Math.floor(span.start), 0); i < Math.min(Math.ceil(span.end), count); i++) {
      const v = m.values[i];
      if (v <= 0) continue;
      const x = (i - span.start) * dslot + (dslot - bw) / 2;
      const h = Math.max((v / top) * PLOT_H, 1);
      bars.push(`M${x.toFixed(2)} ${(PAD + PLOT_H + radius).toFixed(2)}V${(PAD + PLOT_H - h + radius).toFixed(2)}${radius ? `a${radius} ${radius} 0 0 1 ${radius} ${-radius}h${(bw - 2 * radius).toFixed(2)}a${radius} ${radius} 0 0 1 ${radius} ${radius}` : `h${bw.toFixed(2)}`}V${(PAD + PLOT_H + radius).toFixed(2)}Z`);
    }
  }
  // The mean over the lens's live edges, each day weighted by how much of it is covered, so the rule glides.
  const mean = (() => {
    if (!count) return 0;
    const a = Math.min(Math.max(span.start, 0), count), z = Math.min(Math.max(span.end, 0), count);
    if (z - a < 1e-4) return 0;
    const cum = (x: number) => { const w = Math.floor(x); return w >= count ? m.prefix[count] : m.prefix[w] + m.values[w] * (x - w); };
    return (cum(z) - cum(a)) / (z - a);
  })();
  const chipH = 19;
  const chipY = Math.min(Math.max(yOf(mean), chipH / 2 + 2), PAD + PLOT_H - chipH / 2);

  // ---------------------------------------------------------------- Strip

  const lens = lensOf(span);
  const room = ROW - BAR_PAD * 2;
  const sbw = Math.min(Math.max(slot * (slot > 3 ? 0.62 : 0.72), 0.5), 8);
  const dimBars: string[] = [], brightBars: string[] = [];
  for (let i = 0; i < count; i++) {
    const v = m.values[i];
    const h = v > 0 ? Math.max((v / Math.max(m.max, 1e-6)) * room, 1.5) : 1;
    const rect = `M${(xOf(i) + (slot - sbw) / 2).toFixed(2)} ${(ROW - BAR_PAD).toFixed(2)}v${(-h).toFixed(2)}h${sbw.toFixed(2)}v${h.toFixed(2)}Z`;
    const c = i + 0.5;
    (c > span.start && c < span.end ? brightBars : dimBars).push(rect);
  }
  const marks = (() => {
    if (count < 2) return [] as Array<{ x: number; text: string }>;
    const all: Array<{ x: number; text: string; year: boolean }> = [];
    const years = new Set(m.dates.map((d) => d.getFullYear())).size > 1;
    for (let i = 1; i < count; i++) {
      const d = m.dates[i];
      if (d.getDate() !== 1) continue;
      const jan = d.getMonth() === 0 && years;
      all.push({ x: xOf(i), text: jan ? String(d.getFullYear()) : d.toLocaleString(undefined, { month: "short" }), year: jan });
    }
    const anchor = Math.max(all.findIndex((a) => a.year), 0);
    for (let stride = 1; stride <= Math.max(all.length, 1); stride++) {
      const picks = all.filter((_, i) => i % stride === anchor % stride && all[i].x + all[i].text.length * 7 <= W - 2);
      if (picks.every((a, i) => i === 0 || picks[i - 1].x + picks[i - 1].text.length * 7 + 14 <= a.x)) return picks;
    }
    return [];
  })();

  const glass = glassSurface(r.scheme);
  const swell = held === "body" && !reduced ? 3 : 0;
  const ease = "cubic-bezier(.2,.9,.3,1)";
  const label: CSSProperties = { position: "absolute", fontSize: ts(11), fontWeight: fw(600), color: houseVar("muted"), opacity: 0.8, lineHeight: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const handle = (side: "lower" | "upper") => {
    const on = held === side;
    const left = side === "lower" ? lens.left - 4 - HANDLE : lens.left + lens.width + 4;
    return (
      <span
        key={side}
        data-sprl-motion
        style={{
          ...glass, position: "absolute", top: 0, left, width: HANDLE, height: ROW, borderRadius: cr(999),
          ...(on ? { background: ACCENT, backdropFilter: "none", WebkitBackdropFilter: "none" } : null),
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `scale(${on && !reduced ? 1.12 : 1})`, transition: `transform .18s ${ease}, background-color .15s`,
        }}
      >
        <span style={{ width: 3, height: 16, borderRadius: 2, background: on ? ACCENT_INK : houseVar("muted") }} />
      </span>
    );
  };

  return (
    <div
      {...r.box}
      ref={box}
      aria-label={win ? `${caption} ${series.format(value)}${unit ? ` ${unit}` : ""}, ${dates}` : "No data yet"}
      style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", flexDirection: "column", gap: 18, color: houseVar("text"), minWidth: 0 }}
    >
      <style>{KEYFRAMES}</style>
      {/* Readout */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: ts(13), fontWeight: fw(600), color: houseVar("muted") }}>{caption}</span>
        {win ? (
          <>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", lineHeight: 1.1 }}>
              <span style={{ fontSize: ts(32), fontWeight: fw(600), letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{series.format(value)}</span>
              {unit ? <span style={{ fontSize: ts(15), fontWeight: fw(600), color: houseVar("muted") }}>{unit}</span> : null}
            </span>
            <span style={{ fontSize: ts(13), fontWeight: fw(600), color: houseVar("muted"), fontVariantNumeric: "tabular-nums" }}>{dates}</span>
          </>
        ) : (
          <span style={{ fontSize: ts(17), fontWeight: fw(600), color: houseVar("muted"), padding: "6px 0" }}>No data yet</span>
        )}
      </div>

      {/* Detail chart */}
      <div aria-hidden style={{ position: "relative", height: PLOT_H + PAD * 2 }}>
        <svg width={plotW} height={PAD + PLOT_H} style={{ position: "absolute", left: 0, top: 0, overflow: "hidden" }}>
          {ticks.map((tick) => <rect key={tick} x={0} y={yOf(tick) - 0.5} width={plotW} height={1} fill={houseVar("field")} />)}
          <rect x={0} y={PAD + PLOT_H - 1} width={plotW} height={1} fill={houseVar("field")} />
          <path d={bars.join("")} fill={houseVar("text")} />
          {showsAverage && win && mean > 0 ? <line x1={0} x2={plotW} y1={yOf(mean)} y2={yOf(mean)} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round" /> : null}
        </svg>
        {ticks.map((tick) => (
          showsAverage && win && Math.abs(yOf(tick) - chipY) < chipH * 0.8 ? null
            : <span key={tick} style={{ ...label, left: plotW + 8, top: yOf(tick), transform: "translateY(-50%)" }}>{tick >= 1000 ? `${+(tick / 1000).toFixed(1)}K` : tick}</span>
        ))}
        <span style={{ ...label, left: plotW + 8, top: PAD + PLOT_H, transform: "translateY(-50%)" }}>0</span>
        {showsAverage && win && mean > 0 ? (
          <span style={{ position: "absolute", left: plotW + 4, top: chipY - chipH / 2, height: chipH, padding: "0 6px", borderRadius: cr(999), background: ACCENT, color: ACCENT_INK, fontSize: ts(11), fontWeight: fw(600), display: "flex", alignItems: "center" }}>avg</span>
        ) : null}
      </div>

      {/* Strip: the track, the dim days under the glass, the lens, the window's days on the slab, the marks */}
      <div
        ref={strip}
        role="slider"
        aria-label="Range"
        aria-valuetext={win ? dates : "No data yet"}
        onPointerDown={onPointerDown}
        onClick={onClick}
        style={{ position: "relative", height: ROW + 26, touchAction: "pan-y", cursor: count > 1 ? (held ? "grabbing" : "grab") : "default" }}
      >
        <span style={{ position: "absolute", left: 0, top: 0, width: W, height: ROW, borderRadius: cr(12), background: `color-mix(in srgb, ${houseVar("field")} 50%, ${houseVar("ground")})` }} />
        <svg aria-hidden width={W} height={ROW} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={dimBars.join("")} fill={`color-mix(in srgb, ${houseVar("muted")} 40%, ${houseVar("ground")})`} />
        </svg>
        {count ? (
          <>
            <span
              data-sprl-motion
              style={{
                ...glass, position: "absolute", top: -swell, left: lens.left - swell, width: lens.width + swell * 2, height: ROW + swell * 2,
                borderRadius: cr(12 + swell), transition: `top .16s ${ease}, height .16s ${ease}`,
              }}
            />
            {handle("lower")}
            {handle("upper")}
          </>
        ) : null}
        <svg aria-hidden width={W} height={ROW} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <path d={brightBars.join("")} fill={houseVar("text")} />
        </svg>
        {marks.map((mk) => (
          <span key={mk.x} style={{ ...label, left: mk.x, top: ROW + 8 }}>{mk.text}</span>
        ))}
      </div>
    </div>
  );
};
