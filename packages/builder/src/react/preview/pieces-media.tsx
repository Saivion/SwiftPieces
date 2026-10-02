"use client";
// Web renderers for the media, data, text and AI pieces (definitions/pieces-media.ts). Each one runs
// like the Swift piece: the story strip keeps its own clock, the chart follows a scrub, the reply
// streams, the token field takes typing, the list pages, the header stretches and the calendar picks
// a range. Painted with the pieces' house palette; local state is seeded from props with `useLive`.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { house } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { CHART_RANGES, MERCHANTS, RECEIPT_TILES, STORY_FILLS, chartValues, receiptAmount, storySlides } from "../../definitions/pieces-media.js";
import { Glyph } from "../icons.js";
import { Frame, b, fillStyle, font, houseVar, n, s, useAxis, type Renderer, type RenderProps, cr, ff, fw, ts, ACCENT, ACCENT_INK } from "./env.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime } from "./runtime.js";

const INK = house.ink;
const B: Record<string, string> = { ...house.blocks, tangerine: ACCENT };
const SIGNAL_RED = ACCENT;
const corner = (r: number) => cr(r) as string;

/** Keyframes the renderers share. Rendered next to the pieces that use them; duplicates are harmless. */
const KEYFRAMES = [
  "@keyframes spm-fade{from{opacity:0}to{opacity:1}}",
  "@keyframes spm-rise{from{opacity:0;transform:translateY(30%)}to{opacity:1;transform:none}}",
  "@keyframes spm-chip{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}",
  "@keyframes spm-pulse{0%,100%{opacity:.55}50%{opacity:1}}",
  "@keyframes spm-breathe{0%,100%{opacity:.5}50%{opacity:1}}",
  "@keyframes spm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
  "@keyframes spm-spin{to{transform:rotate(360deg)}}",
  "@keyframes spm-shake0{0%,100%{transform:none}15%{transform:translateX(-8px)}35%{transform:translateX(7px)}55%{transform:translateX(-5px)}75%{transform:translateX(3px)}}",
  "@keyframes spm-shake1{0%,100%{transform:none}15%{transform:translateX(-8px)}35%{transform:translateX(7px)}55%{transform:translateX(-5px)}75%{transform:translateX(3px)}}",
  "@keyframes spm-in-left{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}",
  "@keyframes spm-in-right{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}",
  "@media (prefers-reduced-motion: reduce){[data-spm-motion]{animation:none!important}}",
].join("");
const Keyframes = () => <style>{KEYFRAMES}</style>;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** The renderer's root: the node box, and the fill a greedy piece takes. */
function Root({ r, style, children, ...rest }: { r: RenderProps; style?: CSSProperties; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const axis = useAxis();
  return <div {...r.box} {...rest} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

/** A press that dips the way a SwiftUI button style does, springing back on release. */
function usePress() {
  const [down, setDown] = useState(false);
  const handlers = {
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    onPointerCancel: () => setDown(false),
  };
  const style: CSSProperties = { transform: down ? "scale(0.94)" : "none", transition: `transform .3s ${BOUNCE}` };
  return [handlers, style] as const;
}

function Press({ children, style, onClick, disabled, label }: { children: ReactNode; style?: CSSProperties; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; label?: string }) {
  const [handlers, pressStyle] = usePress();
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} {...handlers} style={{ border: 0, font: "inherit", cursor: disabled ? "default" : "pointer", padding: 0, background: "none", color: "inherit", ...style, ...(disabled ? {} : pressStyle) }}>
      {children}
    </button>
  );
}

/** A value that eases toward its target each frame, like a SwiftUI animation on a changed value. */
function useTweenArray(target: number[], ms: number, instant: boolean) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    if (instant || current.current.length !== target.length) {
      current.current = target;
      setValue(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const next = target.map((t, i) => from.current[i] + (t - from.current[i]) * e);
      current.current = next;
      setValue(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(","), ms, instant]);
  return value;
}

/** Element size in points (layout pixels, unaffected by the device's scale). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ---------------------------------------------------------------- Story Strip

const StoryStrip: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const slides = storySlides(p);
  const count = slides.length;
  const duration = Math.max(0.5, n(p, "duration")) * 1000;
  const ink = s(p, "tint") === "ink";
  const tint = ink ? INK : "#FFFFFF";
  const minimal = s(p, "barStyle") === "minimal";
  const [current, setCurrent] = useLive(Math.min(count, Math.max(1, n(p, "start"))) - 1);
  const [fill, setFill] = useState(0);
  const [held, setHeld] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hint, setHint] = useState<{ forward: boolean; tick: number } | null>(null);
  const elapsed = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const index = Math.min(current, count - 1);
  const slideFill = B[STORY_FILLS[index % STORY_FILLS.length]];

  const go = useCallback((next: number) => {
    elapsed.current = 0;
    setFill(0);
    setCurrent(next);
    rt.haptic("selection", rootRef.current);
  }, [rt, setCurrent]);

  const advance = useCallback(() => {
    if (index + 1 < count) go(index + 1);
    else if (b(p, "loops")) go(0);
    else setFinished(true);
  }, [index, count, go, p]);

  const back = useCallback(() => {
    setFinished(false);
    if (index > 0) go(index - 1);
    else {
      elapsed.current = 0;
      setFill(0);
    }
  }, [index, go]);

  // The clock: fills the current segment over `duration`, frozen while held.
  useEffect(() => {
    if (held || finished) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const k = Math.min(1, elapsed.current / duration);
      setFill(k);
      if (k >= 1) {
        advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [held, finished, duration, advance, index]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 380);
    return () => clearTimeout(t);
  }, [hint]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    touch.current = { x: e.clientX, y: e.clientY };
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setHeld(true);
      rt.haptic("soft", rootRef.current);
    }, 200);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const start = touch.current;
    touch.current = null;
    if (held) {
      setHeld(false);
      return;
    }
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const forward = (e.clientX - rect.left) / rect.width >= 0.3;
    if (!minimal) setHint({ forward, tick: (hint?.tick ?? 0) + 1 });
    if (forward) advance();
    else back();
  };
  const cancel = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    touch.current = null;
    setHeld(false);
  };

  const seg = (i: number) => (finished || i < index ? 1 : i === index ? fill : 0);
  return (
    <Root
      r={r}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={cancel}
      onPointerLeave={(e) => (touch.current ? up(e) : undefined)}
      style={{ position: "relative", height: n(p, "height"), borderRadius: corner(34), overflow: "hidden", background: slideFill, transition: "background-color .35s ease-in-out", color: ink ? INK : "#FFFFFF", userSelect: "none", touchAction: "pan-y", cursor: "pointer", flex: "none" }}
    >
      <Keyframes />
      <div ref={rootRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", background: ink ? "transparent" : "rgba(0,0,0,.12)" }} />
      {/* The slide: one big idea, fading in on each change. */}
      <div key={index} data-spm-motion style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "24px 24px 44px", animation: "spm-fade .35s ease-out both", pointerEvents: "none" }}>
        <div style={{ fontSize: ts(40), lineHeight: 1.05, fontWeight: fw(700), letterSpacing: "-0.03em", overflowWrap: "anywhere" }}>{slides[index]}</div>
      </div>
      {/* The strip: bars, and the paused badge under their trailing end. */}
      <div style={{ position: "absolute", left: 12, right: 12, top: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, pointerEvents: "none" }}>
        <div style={{ display: "flex", gap: 4, alignSelf: "stretch", opacity: held ? 0.55 : 1, transition: "opacity .2s ease-out" }}>
          {slides.map((_, i) => (
            <span key={i} style={{ flex: 1, height: minimal ? 3 : 4, borderRadius: cr(4), background: ink ? "rgba(20,20,20,.3)" : "rgba(255,255,255,.3)", overflow: "hidden", position: "relative" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: cr(4), background: tint, transformOrigin: "left", transform: `scaleX(${seg(i)})` }} />
            </span>
          ))}
        </div>
        {!minimal ? (
          <span style={{ height: 30, padding: "0 12px", borderRadius: cr(15), display: "flex", alignItems: "center", gap: 6, background: tint, color: ink ? slideFill : INK, ...font("subheadline", 700), opacity: held ? 1 : 0, transform: held ? "none" : "translateY(-6px) scale(.85)", transformOrigin: "top right", transition: `opacity .2s, transform .3s ${BOUNCE}` }}>
            <Glyph name="pause.fill" size={11} />Paused
          </span>
        ) : null}
      </div>
      {hint ? (
        <span key={hint.tick} data-spm-motion style={{ position: "absolute", top: "50%", marginTop: -26, [hint.forward ? "right" : "left"]: 24, width: 52, height: 52, borderRadius: cr(26), display: "grid", placeItems: "center", background: tint, color: ink ? slideFill : INK, animation: `spm-chip .25s ${BOUNCE} both`, pointerEvents: "none" }}>
          <Glyph name={hint.forward ? "chevron.right" : "chevron.left"} size={22} strokeWidth={3} />
        </span>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Scrub Chart

const SAMPLES = 64;
type Sel = { kind: "idle" } | { kind: "scrub"; i: number } | { kind: "range"; a: number; b: number };

function resample(values: number[], count: number) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i / (count - 1)) * (values.length - 1);
    const j = Math.floor(x);
    const f = x - j;
    return values[j] + (values[Math.min(j + 1, values.length - 1)] - values[j]) * f;
  });
}

/** Catmull-Rom through the points as cubic beziers (Swift Charts' `.catmullRom`). */
function smoothPath(pts: Array<[number, number]>) {
  if (!pts.length) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(i - 1, 0)], p1 = pts[i], c = pts[i + 1], e = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C${(p1[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(p1[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - p1[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - p1[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}

/** A point's date: evenly spaced, ending now, `step` seconds apart. */
function pointDate(i: number, count: number, step: number) {
  return new Date(Date.now() + (i - (count - 1)) * step * 1000);
}
function dateLabel(date: Date, spanSeconds: number, precise = false) {
  if (spanSeconds < 2 * 86_400) return date.toLocaleTimeString("en-US", precise ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });
  if (spanSeconds < 120 * 86_400) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", precise ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", year: "2-digit" });
}

const ScrubChart: Renderer = (r) => {
  const { p, scheme } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const ranges = b(p, "ranges") ? CHART_RANGES : [CHART_RANGES[1]];
  const [rangeIdx, setRangeIdx] = useLive(b(p, "ranges") ? Math.min(3, Math.max(0, n(p, "range"))) : 0);
  const [sel, setSel] = useState<Sel>({ kind: "idle" });
  const range = ranges[Math.min(rangeIdx, ranges.length - 1)];
  const step = Number(range.step.replace(/_/g, ""));
  const points = useMemo(() => chartValues(range.values, s(p, "trend")), [range, p]);
  const bars = s(p, "mode") === "bars";
  const currency = b(p, "currency");
  const lo = Math.min(...points), hi = Math.max(...points);
  const norm = (v: number) => (hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo));
  const target = useMemo(() => (bars ? points.map(norm) : resample(points, SAMPLES).map(norm)), [points, bars]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useTweenArray(target, 550, reduced || bars);
  const [plotRef, plot] = useSize<HTMLDivElement>();
  const W = Math.max(1, plot.w), H = Math.max(1, plot.h);
  const tint = s(p, "tint") === "text" ? houseVar("text") : B[s(p, "tint")] ?? houseVar("text");
  const accent = B.butter;
  const ground = houseVar("surface");
  const band = scheme === "dark" ? "#262626" : "#F3F2EE";
  const muted = houseVar("muted");
  const fmt = (v: number) => (currency ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v));
  const spanSeconds = step * (points.length - 1);
  const y = (v: number) => H * (1 - (v + 0.16) / 1.46);
  const fx = (i: number) => (bars ? ((i + 0.5) / points.length) * W : (i / (points.length - 1)) * W);

  const active = sel.kind === "scrub" ? sel.i : sel.kind === "range" ? sel.b : null;
  const span = sel.kind === "range" ? { from: Math.min(sel.a, sel.b), to: Math.max(sel.a, sel.b) } : null;
  const lastActive = useRef<number | null>(null);
  useEffect(() => {
    if (active !== null && active !== lastActive.current) rt.haptic("selection", plotRef.current);
    lastActive.current = active;
  }, [active, rt, plotRef]);

  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const anchor = useRef(0);
  const nearest = (x: number) => {
    const f = Math.min(Math.max(x / W, 0), 1);
    if (bars) return Math.min(points.length - 1, Math.max(0, Math.round(f * points.length - 0.5)));
    return Math.round(f * (points.length - 1));
  };
  const onDrag = useDrag({
    slop: 0,
    onStart(info) {
      moved.current = false;
      anchor.current = nearest(info.x);
      setSel({ kind: "scrub", i: anchor.current });
      if (hold.current) clearTimeout(hold.current);
      // Holding still for a moment pins the anchor and turns the drag into a range.
      hold.current = setTimeout(() => {
        if (moved.current) return;
        setSel({ kind: "range", a: anchor.current, b: anchor.current });
        rt.haptic("rigid", plotRef.current);
      }, 300);
    },
    onMove(info) {
      if (!moved.current && Math.hypot(info.dx, info.dy) > 8) {
        moved.current = true;
        if (hold.current) clearTimeout(hold.current);
      }
      const i = nearest(info.x);
      setSel((prev) => (prev.kind === "range" ? { kind: "range", a: prev.a, b: i } : { kind: "scrub", i }));
    },
    onEnd() {
      if (hold.current) clearTimeout(hold.current);
      setSel({ kind: "idle" });
    },
  });

  // Readout
  const first = points[0], last = points[points.length - 1];
  let value = last;
  let signed = false;
  if (span) {
    value = points[span.to] - points[span.from];
    signed = true;
  } else if (active !== null) value = points[active];
  const body = (signed ? (value < 0 ? "−" : "+") : "") + fmt(signed ? Math.abs(value) : value);
  const dot = body.lastIndexOf(".");
  const chipFrom = span ? points[span.from] : first;
  const chipTo = span ? points[span.to] : active !== null ? points[active] : last;
  const delta = chipTo - chipFrom;
  const percent = chipFrom === 0 ? 0 : Math.abs(delta / chipFrom) * 100;
  const meta = span
    ? `${dateLabel(pointDate(span.from, points.length, step), spanSeconds)} – ${dateLabel(pointDate(span.to, points.length, step), spanSeconds)}`
    : active !== null ? dateLabel(pointDate(active, points.length, step), spanSeconds, true) : `Latest · ${range.label}`;

  const linePts = shown.map((v, i): [number, number] => [bars ? fx(i) : (i / (shown.length - 1)) * W, y(v)]);
  const realPt = (i: number): [number, number] => [fx(i), y(norm(points[i]))];
  const maxI = points.indexOf(hi), minI = points.indexOf(lo);
  const barW = Math.max(2, (W / points.length) * 0.62);
  const flagX = active !== null ? Math.min(Math.max(realPt(active)[0], 44), W - 44) : 0;
  const card = b(p, "card");

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 14, height: n(p, "height") + (card ? 40 : 0), padding: card ? 20 : 0, borderRadius: card ? corner(34) : 0, background: card ? ground : "transparent", color: houseVar("text"), boxSizing: "border-box", userSelect: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontSize: ts(12), fontWeight: fw(600), letterSpacing: "0.1em", textTransform: "uppercase", color: muted, whiteSpace: "nowrap", overflow: "hidden" }}>{meta}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: ts(44), fontWeight: fw(300), letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>
            {dot > 0 ? <>{body.slice(0, dot)}<span style={{ color: muted }}>{body.slice(dot)}</span></> : body}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 28, padding: "0 10px", borderRadius: cr(14), background: delta > 0 ? B.sage : delta < 0 ? B.tangerine : band, color: delta === 0 ? muted : delta < 0 ? ACCENT_INK : INK, fontSize: ts(13), fontWeight: fw(600), whiteSpace: "nowrap", alignSelf: "center" }}>
            <Glyph name={delta >= 0 ? "arrow.up.right" : "arrow.down"} size={11} strokeWidth={3} />
            {!span ? `${delta < 0 ? "−" : "+"}${fmt(Math.abs(delta))} ` : ""}{percent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 60, display: "flex", flexDirection: "column", gap: 6 }}>
        <div ref={plotRef} onPointerDown={onDrag} style={{ flex: 1, minHeight: 0, position: "relative", touchAction: "pan-y", cursor: "crosshair" }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
            {span && !bars ? <rect x={fx(span.from)} y={0} width={Math.max(1, fx(span.to) - fx(span.from))} height={H} fill={band} /> : null}
            <line x1={0} x2={W} y1={y(norm(first))} y2={y(norm(first))} stroke={muted} strokeOpacity={0.6} strokeDasharray="2 5" />
            {bars
              ? shown.map((v, i) => {
                  const lit = span ? i >= span.from && i <= span.to : active !== null ? active === i : i === points.length - 1;
                  const dim = span ? !(i >= span.from && i <= span.to) : active !== null && active !== i;
                  const top = y(v), bottom = y(-0.1);
                  return <rect key={i} x={fx(i) - barW / 2} y={top} width={barW} height={Math.max(0, bottom - top)} rx={Math.min(6, barW / 2)} fill={lit ? accent : tint} opacity={dim ? 0.35 : 1} />;
                })
              : <path d={smoothPath(linePts)} fill="none" stroke={tint} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
            {span && !bars ? <line x1={fx(span.from)} x2={fx(span.from)} y1={0} y2={H} stroke={tint} strokeWidth={1.5} /> : null}
            {!bars && sel.kind === "idle" ? (
              <g fill={muted} fontSize={ts(11)} fontWeight={fw(600)} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                <text x={Math.min(Math.max(realPt(maxI)[0], 30), W - 30)} y={realPt(maxI)[1] - 8} textAnchor="middle">{fmt(hi)}</text>
                <text x={Math.min(Math.max(realPt(minI)[0], 30), W - 30)} y={realPt(minI)[1] + 18} textAnchor="middle">{fmt(lo)}</text>
              </g>
            ) : null}
            {active !== null ? <line x1={realPt(active)[0]} x2={realPt(active)[0]} y1={0} y2={H} stroke={tint} strokeWidth={1.5} /> : null}
            {!bars ? <circle cx={realPt(active ?? points.length - 1)[0]} cy={active !== null ? realPt(active)[1] : linePts[linePts.length - 1]?.[1] ?? 0} r={6.5} fill={accent} stroke={ground} strokeWidth={3} /> : null}
          </svg>
          {active !== null ? (
            <span style={{ position: "absolute", top: 0, left: flagX, transform: "translateX(-50%)", padding: "4px 8px", borderRadius: cr(999), background: tint, color: ground, fontSize: ts(11), fontWeight: fw(600), fontFamily: ff("ui-monospace, SFMono-Regular, Menlo, monospace"), whiteSpace: "nowrap", pointerEvents: "none" }}>
              {dateLabel(pointDate(active, points.length, step), spanSeconds, true)}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ts(11), fontWeight: fw(600), letterSpacing: "0.05em", textTransform: "uppercase", color: muted }}>
          {[0, (points.length - 1) / 2, points.length - 1].map((i, k) => <span key={k}>{dateLabel(pointDate(Math.round(i), points.length, step), spanSeconds)}</span>)}
        </div>
      </div>
      {ranges.length > 1 ? (
        <div style={{ position: "relative", display: "flex", gap: 4, padding: 4, borderRadius: cr(999), background: band }}>
          <span style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${rangeIdx} * (100% - 8px + 4px) / ${ranges.length})`, width: `calc((100% - 8px - ${4 * (ranges.length - 1)}px) / ${ranges.length})`, borderRadius: cr(999), background: accent, transition: reduced ? "left .2s ease-out" : `left .35s ${BOUNCE}` }} />
          {ranges.map((x, i) => (
            <Press key={x.label} label={x.label} onClick={(e) => { if (i !== rangeIdx) { setRangeIdx(i); setSel({ kind: "idle" }); rt.haptic("selection", e.currentTarget); } }} style={{ position: "relative", flex: 1, height: 44, ...font("subheadline", 700), color: i === rangeIdx ? INK : muted, transition: "color .25s" }}>
              {x.label}
            </Press>
          ))}
        </div>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Streaming Reply

type Word = { text: string; bold: boolean; code: boolean };
/** Inline markdown (**bold**, `code`) split into words, each keeping its style. */
function parseWords(source: string): Word[] {
  const out: Word[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  const push = (chunk: string, bold: boolean, code: boolean) => chunk.split(/\s+/).filter(Boolean).forEach((w) => out.push({ text: w, bold, code }));
  const joinNext = (chunk: string) => chunk.length > 0 && !/^\s/.test(chunk);
  for (const m of source.matchAll(re)) {
    const before = source.slice(last, m.index);
    push(before, false, false);
    const inner = m[0].startsWith("**") ? m[0].slice(2, -2) : m[0].slice(1, -1);
    const bold = m[0].startsWith("**");
    // Punctuation glued to a styled run ("**12%**,") stays with it.
    const startsGlued = out.length > 0 && before.length > 0 && !/\s$/.test(before);
    const words = inner.split(/\s+/).filter(Boolean).map((w) => ({ text: w, bold, code: !bold }));
    if (startsGlued && words.length) {
      const prev = out.pop()!;
      out.push({ ...prev, text: prev.text + words[0].text, bold: prev.bold || bold, code: prev.code || !bold });
      out.push(...words.slice(1));
    } else out.push(...words);
    last = (m.index ?? 0) + m[0].length;
    const rest = source.slice(last);
    if (joinNext(rest) && out.length) {
      const tail = rest.match(/^\S+/)![0];
      out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text + tail };
      last += tail.length;
    }
  }
  push(source.slice(last), false, false);
  return out;
}

const DOTS = [SIGNAL_RED, B.sky, B.lilac];

const StreamingReply: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const user = s(p, "role") === "user";
  const startPhase = user ? "done" : s(p, "phase");
  const words = useMemo(() => parseWords(s(p, "text")), [p]);
  const tint = s(p, "tint") === "default" ? null : B[s(p, "tint")] ?? null;
  const fade = Math.max(0, n(p, "fadeDuration"));
  const speed = Math.max(20, n(p, "speed"));
  // run: bumps to restart the stream (tap when finished, Regenerate, Retry).
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<string>(startPhase === "stream" ? "thinking" : startPhase);
  const [count, setCount] = useState(startPhase === "stream" || startPhase === "thinking" ? 0 : words.length);
  const [lifted, setLifted] = useState(false);
  const [copied, setCopied] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLift = useRef(false);

  useEffect(() => {
    if (startPhase !== "stream") {
      setPhase(startPhase);
      setCount(startPhase === "thinking" ? 0 : words.length);
      return;
    }
    if (reduced) {
      setPhase("done");
      setCount(words.length);
      return;
    }
    setPhase("thinking");
    setCount(0);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setPhase("streaming"), 1200));
    words.forEach((_, i) => timers.push(setTimeout(() => setCount(i + 1), 1200 + (i + 1) * speed)));
    timers.push(setTimeout(() => setPhase("done"), 1200 + words.length * speed + 60));
    return () => timers.forEach(clearTimeout);
  }, [startPhase, words, speed, reduced, run]);

  const restart = () => {
    setLifted(false);
    setRun((v) => v + 1);
  };

  const down = () => {
    didLift.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      didLift.current = true;
      setLifted(true);
      rt.haptic("rigid", surfaceRef.current);
    }, 350);
  };
  const up = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };
  const click = () => {
    if (didLift.current) return;
    if (lifted) setLifted(false);
    else if (!user && s(p, "phase") === "stream" && phase === "done") {
      rt.haptic("light", surfaceRef.current);
      restart();
    }
  };
  const copy = (e: MouseEvent<HTMLButtonElement>) => {
    try {
      navigator.clipboard?.writeText(s(p, "text").replace(/\*\*|`/g, "")).catch(() => {});
    } catch {}
    setCopied(true);
    rt.haptic("success", e.currentTarget);
    setTimeout(() => setLifted(false), 900);
    setTimeout(() => setCopied(false), 1400);
  };
  const regenerate = (e: MouseEvent<HTMLButtonElement>) => {
    rt.haptic("success", e.currentTarget);
    if (s(p, "phase") === "stream" || s(p, "phase") === "error") {
      if (s(p, "phase") === "error") {
        setLifted(false);
        setPhase("done");
        return;
      }
      restart();
    } else setLifted(false);
  };

  const cursor = tint ?? SIGNAL_RED;
  const text = (
    <span style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
      {words.slice(0, count).map((w, i) => (
        <span key={`${run}-${i}`}>
          <span data-spm-motion style={{ fontWeight: fw(w.bold ? 700 : undefined), animation: fade > 0 && startPhase === "stream" ? `spm-fade ${fade}s ease-out both` : undefined, ...(w.code ? { fontFamily: ff("ui-monospace, SFMono-Regular, Menlo, monospace"), fontSize: ts("0.9em"), background: B.butter, color: INK, borderRadius: cr(4), padding: "0 3px" } : {}) }}>{w.text}</span>
          {i < count - 1 ? " " : ""}
        </span>
      ))}
      {phase === "streaming" && !user ? <span data-spm-motion style={{ display: "inline-block", width: 7, height: "0.78em", marginLeft: 4, borderRadius: cr(4), background: cursor, verticalAlign: "-0.05em", animation: "spm-pulse 1s ease-in-out infinite" }} /> : null}
    </span>
  );

  const label = phase === "thinking" ? "Thinking" : phase === "streaming" ? "Writing" : phase === "error" ? "Stopped" : "";
  const surface = user ? (
    <div style={{ marginLeft: 48, padding: "12px 16px", background: tint ?? B.sky, color: INK, fontWeight: fw(500), borderRadius: cr("22px 22px 6px 22px"), fontSize: ts(17), lineHeight: "25px" }}>{text}</div>
  ) : (
    <div style={{ position: "relative", padding: "4px 24px 4px 0" }}>
      <span style={{ position: "absolute", inset: -12, borderRadius: cr(18), background: houseVar("surface"), opacity: lifted ? 1 : 0, transition: "opacity .3s", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span data-spm-motion style={{ width: 24, height: 24, borderRadius: cr(12), display: "grid", placeItems: "center", background: phase === "error" ? SIGNAL_RED : houseVar("text"), color: houseVar("ground"), animation: phase === "thinking" ? "spm-breathe 1.4s ease-in-out infinite" : undefined }}>
            <Glyph name="sparkles" size={13} strokeWidth={2.4} />
          </span>
          <span style={{ ...font("subheadline", 600) }}>Assistant</span>
          {label ? <span key={label} data-spm-motion style={{ fontSize: ts(11), fontWeight: fw(700), letterSpacing: "0.07em", textTransform: "uppercase", color: houseVar("muted"), animation: "spm-fade .25s ease-out" }}>{label}</span> : null}
        </div>
        {phase === "thinking" ? (
          <div style={{ display: "flex", gap: 6, height: 22, alignItems: "center" }}>
            {DOTS.map((c, i) => <span key={i} data-spm-motion style={{ width: 9, height: 9, borderRadius: cr(5), background: c, animation: `spm-bob 1s ${i * 0.15}s ease-in-out infinite` }} />)}
          </div>
        ) : null}
        {count > 0 ? <div style={{ fontSize: ts(17), lineHeight: "25px" }}>{text}</div> : null}
        {phase === "error" ? (
          <div data-spm-motion style={{ display: "flex", alignItems: "center", gap: 10, animation: "spm-fade .25s ease-out" }}>
            <span style={{ ...font("subheadline"), color: houseVar("muted"), flex: 1 }}>{s(p, "errorMessage")}</span>
            <Press onClick={regenerate} style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 14px", borderRadius: cr(22), background: SIGNAL_RED, color: ACCENT_INK, ...font("subheadline", 600) }}>
              <Glyph name="arrow.clockwise" size={15} strokeWidth={2.4} />Retry
            </Press>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: user ? "flex-end" : "flex-start", gap: 10, color: houseVar("text") }}>
      <Keyframes />
      <div
        ref={surfaceRef}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onClick={click}
        onContextMenu={(e) => e.preventDefault()}
        style={{ maxWidth: "100%", cursor: "pointer", transform: lifted ? "scale(1.02)" : "none", transformOrigin: user ? "bottom right" : "bottom left", transition: `transform .4s ${BOUNCE}, filter .3s`, filter: lifted ? "drop-shadow(0 10px 22px rgba(0,0,0,.18))" : "none", userSelect: "none", WebkitUserSelect: "none" }}
      >
        {surface}
      </div>
      {lifted ? (
        <div data-spm-motion style={{ display: "flex", gap: 2, padding: 4, marginTop: 4, borderRadius: cr(999), background: houseVar("text"), color: houseVar("ground"), boxShadow: "0 6px 14px rgba(0,0,0,.18)", transformOrigin: user ? "top right" : "top left", animation: `spm-chip .3s ${BOUNCE} both` }}>
          <Press onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 14px", ...font("subheadline", 600) }}>
            <Glyph name={copied ? "checkmark" : "square.and.arrow.up"} size={15} strokeWidth={2.2} />{copied ? "Copied" : "Copy"}
          </Press>
          {!user ? (
            <Press onClick={regenerate} style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 14px", ...font("subheadline", 600) }}>
              <Glyph name="arrow.clockwise" size={15} strokeWidth={2.2} />Regenerate
            </Press>
          ) : null}
        </div>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Token Field

const CHIP_COLORS = [B.sky, B.butter, B.sage, B.lilac, B.sand];
/** Same stable color pick as `Style.chip(for:)` in Swift: djb2 over the lowercased text. */
function chipColor(text: string) {
  let h = BigInt(5381);
  const mask = BigInt("0xFFFFFFFFFFFFFFFF");
  for (const ch of text.toLowerCase()) h = (h * BigInt(33) + BigInt(ch.codePointAt(0) ?? 0)) & mask;
  return CHIP_COLORS[Number(h % BigInt(CHIP_COLORS.length))];
}
const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const TokenField: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const initial = useMemo(() => list(p.tokens, 30), [p.tokens]);
  const [tokens, setTokens] = useLive(initial);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const emails = b(p, "emails");
  const max = n(p, "maxTokens");
  const full = max > 0 && tokens.length >= max;
  const suggestions = list(p.suggestions, 30);
  const separators = emails ? /[,;\s\n]/ : /[,\n]/;

  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [flash]);

  /** Commits trimmed entries; returns the text that should stay in the input. */
  const commit = (entries: string[], rest: string) => {
    let next = [...tokens];
    let rejected: string | null = null;
    let added = false;
    for (const raw of entries) {
      const entry = raw.trim();
      if (!entry) continue;
      if (max > 0 && next.length >= max) break;
      if (emails && !(entry.includes("@") && entry.includes("."))) {
        rejected = entry;
        continue;
      }
      if (!b(p, "allowsDuplicates")) {
        const at = next.findIndex((t) => t.toLowerCase() === entry.toLowerCase());
        if (at >= 0) {
          setFlash(at);
          continue;
        }
      }
      next = [...next, entry];
      added = true;
    }
    if (added) {
      setTokens(next);
      rt.haptic("selection", fieldRef.current);
    }
    if (rejected !== null) {
      setInvalid(true);
      setShake((v) => v + 1);
      rt.haptic("error", fieldRef.current);
      return rejected + (rest ? rest : "");
    }
    setInvalid(false);
    return rest;
  };

  const onChange = (value: string) => {
    setSelected(null);
    if (full) return;
    if (separators.test(value)) {
      const parts = value.split(separators);
      const rest = parts.pop() ?? "";
      setDraft(commit(parts, rest));
      return;
    }
    setInvalid(false);
    setDraft(value);
  };

  const remove = (i: number, el?: Element | null) => {
    setTokens(tokens.filter((_, k) => k !== i));
    setSelected(null);
    rt.haptic("rigid", el ?? fieldRef.current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setDraft(commit([draft], ""));
    } else if (e.key === "Backspace" && draft === "") {
      e.preventDefault();
      if (!tokens.length) return;
      if (selected !== null) remove(selected);
      else {
        setSelected(tokens.length - 1);
        rt.haptic("soft", fieldRef.current);
      }
    }
  };

  const query = draft.trim();
  const matches = useMemo(() => {
    if (!focused || !query || full || !suggestions.length) return [];
    const seen = new Set(tokens.map(fold));
    const q = fold(query);
    const prefix: string[] = [];
    const contains: string[] = [];
    for (const c of suggestions) {
      const f = fold(c);
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.startsWith(q)) prefix.push(c);
      else if (f.includes(q)) contains.push(c);
    }
    return [...prefix, ...contains].slice(0, 5);
  }, [focused, query, full, suggestions, tokens]);

  const hint = full && !draft ? `${tokens.length}/${max}` : s(p, "placeholder");
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 8, color: houseVar("text") }}>
      <Keyframes />
      <div
        ref={fieldRef}
        data-spm-motion
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: 10, minHeight: 56, boxSizing: "border-box",
          borderRadius: corner(18), background: houseVar("field"), cursor: "text",
          boxShadow: focused || invalid ? `inset 0 0 0 2px ${invalid ? B.tangerine : "var(--h-text)"}` : "none",
          transition: "box-shadow .2s", animation: shake && !reduced ? `spm-shake${shake % 2} .45s linear` : undefined,
        }}
      >
        {tokens.map((t, i) => {
          const on = selected === i || flash === i;
          return (
            <span
              key={`${t}-${i}`}
              data-spm-motion
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelected(selected === i ? null : i);
                inputRef.current?.focus();
              }}
              style={{
                display: "inline-flex", alignItems: "center", height: 34, paddingLeft: 12, paddingRight: 3, maxWidth: "100%", borderRadius: corner(12),
                background: on ? "var(--h-text)" : chipColor(t), color: on ? "var(--h-field)" : INK, ...font("subheadline", 600), cursor: "pointer",
                transform: on && !reduced ? "scale(1.04)" : "none", transition: `transform .25s ${BOUNCE}, background-color .2s, color .2s`,
                animation: `spm-chip .35s ${BOUNCE} both`,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
              <span
                role="button"
                aria-label={`Remove ${t}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i, e.currentTarget);
                }}
                style={{ width: 28, height: 34, display: "grid", placeItems: "center", flex: "none" }}
              >
                <Glyph name="xmark" size={11} strokeWidth={3.4} />
              </span>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={draft}
          placeholder={hint}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setSelected(null);
            if (draft.trim()) setDraft(commit([draft], ""));
          }}
          aria-label={s(p, "placeholder")}
          autoCapitalize={emails ? "none" : "words"}
          autoComplete="off"
          spellCheck={false}
          inputMode={emails ? "email" : "text"}
          className="spm-token-input"
          style={{ flex: "1 1 88px", minWidth: 88, height: 34, border: 0, outline: "none", background: "transparent", color: "var(--h-text)", fontSize: ts(17), fontFamily: "inherit", padding: "0 4px", fontVariantNumeric: full ? "tabular-nums" : undefined }}
        />
        <style>{".spm-token-input::placeholder{color:var(--h-muted);opacity:1}"}</style>
      </div>
      {matches.length ? (
        <div data-spm-motion style={{ padding: "4px 0", borderRadius: corner(16), background: houseVar("field"), animation: "spm-fade .2s ease-out" }}>
          {matches.map((m) => {
            const at = fold(m).indexOf(fold(query));
            return (
              <div
                key={m}
                role="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft(commit([m], ""));
                  inputRef.current?.focus();
                }}
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 16px", fontSize: ts(17), cursor: "pointer" }}
              >
                <span style={{ width: 10, height: 10, borderRadius: cr(5), background: chipColor(m), flex: "none" }} />
                <span>{at >= 0 ? <>{m.slice(0, at)}<b style={{ fontWeight: fw(700) }}>{m.slice(at, at + query.length)}</b>{m.slice(at + query.length)}</> : m}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Paged List

type Footer = "spinner" | "error" | "end" | "idle";

function Spinner({ color = "var(--h-muted)", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" data-spm-motion style={{ width: size, height: size, animation: "spm-spin .9s linear infinite" }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="45 63" />
    </svg>
  );
}

function Badge({ fill, name }: { fill: string; name: string }) {
  return <span style={{ width: 22, height: 22, borderRadius: cr(11), display: "grid", placeItems: "center", background: fill, color: INK, flex: "none" }}><Glyph name={name} size={12} strokeWidth={3.2} /></span>;
}

const PagedList: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const pages = Math.max(1, n(p, "pages"));
  const size = Math.max(1, n(p, "pageSize"));
  const delay = Math.max(100, n(p, "delay") * 1000);
  const plain = s(p, "layout") === "plain";
  // Style → Lists (pieces-media.ts listStyle): the theme's cards, or hairlines between rows.
  const listed = p.listed === "cards" || p.listed === "grouped" || p.listed === "plain" ? p.listed : null;
  const themeCard = { background: "var(--spb-card, var(--ios-fill))", boxShadow: "var(--spb-card-edge, none)" };
  const endMessage = s(p, "endMessage").trim();
  const [loaded, setLoaded] = useState(0);
  const [footer, setFooter] = useState<Footer>("spinner");
  const [fresh, setFresh] = useState(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const loading = useRef(false);
  const failed = useRef(false);
  const generation = useRef(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const key = `${pages}|${size}|${delay}|${b(p, "failsOnce")}`;

  const loadPage = useCallback((page: number, replace: boolean) => {
    if (loading.current && !replace) return;
    loading.current = true;
    const gen = ++generation.current;
    if (!replace) setFooter("spinner");
    setTimeout(() => {
      if (gen !== generation.current) return;
      loading.current = false;
      if (b(p, "failsOnce") && page === 2 && !failed.current) {
        failed.current = true;
        setFooter("error");
        return;
      }
      const count = page > pages ? 0 : size;
      setFresh(replace ? 0 : (page - 1) * size);
      setLoaded(replace ? size : (page - 1) * size + count);
      setRefreshing(false);
      setFooter(count < size || page >= pages ? "end" : "idle");
    }, delay);
  }, [p, pages, size, delay]);

  // First page, again whenever the sample API changes.
  useEffect(() => {
    failed.current = false;
    loading.current = false;
    setLoaded(0);
    setFooter("spinner");
    loadPage(1, true);
    return () => {
      generation.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const nextPage = Math.floor(loaded / size) + 1;
  const maybeLoad = useCallback(() => {
    const el = scroller.current;
    if (!el || loaded === 0 || footer === "end" || footer === "error" || loading.current) return;
    // Prefetch five rows before the end, as `prefetchDistance: 5` does.
    const rowH = plain ? 76 : 68;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - rowH * 5) loadPage(nextPage, false);
  }, [loaded, footer, plain, loadPage, nextPage]);

  useEffect(() => {
    maybeLoad();
  }, [maybeLoad]);

  const retry = (e: MouseEvent<HTMLButtonElement>) => {
    rt.haptic("light", e.currentTarget);
    loadPage(nextPage, false);
  };

  // Pull to refresh at the top; a mouse drag elsewhere scrolls, as a finger would.
  const startTop = useRef(0);
  const onDrag = useDrag({
    axis: "y",
    onStart() {
      startTop.current = scroller.current?.scrollTop ?? 0;
    },
    onMove(info) {
      const el = scroller.current;
      if (!el) return;
      if (startTop.current <= 0 && info.dy > 0) {
        setPull(Math.min(110, info.dy * 0.5));
        el.scrollTop = 0;
      } else {
        setPull(0);
        el.scrollTop = startTop.current - info.dy;
      }
    },
    onEnd() {
      if (pull > 56 && !refreshing) {
        setRefreshing(true);
        rt.haptic("light", scroller.current);
        failed.current = false;
        loadPage(1, true);
      }
      setPull(0);
    },
  });

  const row = (i: number) => {
    const name = MERCHANTS.slice(0, 6)[i % 6];
    const isNew = i >= fresh;
    return (
      <div key={i} data-spm-motion style={{ display: "flex", alignItems: "center", gap: 12, padding: plain ? 12 : "6px 0", borderRadius: plain ? corner(listed ? 16 : 20) : 0, background: plain ? "var(--ios-fill)" : "transparent", ...(plain && listed ? themeCard : {}), ...(!plain && listed && i > 0 ? { boxShadow: "inset 0 0.5px 0 var(--ios-sep)" } : {}), animation: isNew ? `spm-rise .5s ${SPRING} both` : undefined, animationDelay: isNew ? `${((i - fresh) % 8) * 45}ms` : undefined }}>
        <span style={{ width: 44, height: 44, borderRadius: corner(13), display: "grid", placeItems: "center", flex: "none", background: B[RECEIPT_TILES[i % RECEIPT_TILES.length]], color: INK, ...font("headline") }}>{name[0]}</span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...font("body", 600), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          <span style={{ ...font("subheadline"), color: houseVar("muted") }}>Receipt {1040 + i}</span>
        </span>
        <span style={{ ...font("body", 500), fontVariantNumeric: "tabular-nums" }}>${receiptAmount(i).toFixed(2)}</span>
      </div>
    );
  };

  const skeleton = Array.from({ length: 8 }, (_, i) => (
    <div key={i} data-spm-motion style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", animation: "spm-breathe 1.7s ease-in-out infinite" }}>
      <span style={{ width: 44, height: 44, borderRadius: corner(13), background: houseVar("field"), flex: "none" }} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ width: `${[62, 48, 70, 55][i % 4]}%`, height: 12, borderRadius: cr(6), background: houseVar("field") }} />
        <span style={{ width: "34%", height: 10, borderRadius: cr(5), background: houseVar("field") }} />
      </span>
    </div>
  ));

  return (
    <Root r={r} style={{ position: "relative", height: n(p, "height"), color: houseVar("text"), overflow: "hidden", flex: "none", ...(listed === "grouped" ? { ...themeCard, borderRadius: corner(16) } : {}) }}>
      <Keyframes />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(pull, refreshing ? 48 : 0), display: "grid", placeItems: "center", opacity: pull > 8 || refreshing ? 1 : 0, transition: pull ? "none" : `height .35s ${SPRING}, opacity .2s` }}>
        <span style={{ transform: `rotate(${pull * 4}deg)` }}>{refreshing ? <Spinner /> : <Glyph name="arrow.down" size={18} style={{ color: "var(--h-muted)", transform: pull > 56 ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}</span>
      </div>
      <div
        ref={scroller}
        onScroll={maybeLoad}
        onPointerDown={onDrag}
        className="spm-scroll"
        style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollbarWidth: "none", transform: `translateY(${Math.max(pull, refreshing ? 48 : 0)}px)`, transition: pull ? "none" : `transform .35s ${SPRING}`, touchAction: "pan-y" }}
      >
        <style>{".spm-scroll::-webkit-scrollbar{display:none}"}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: plain ? 8 : 0, padding: plain ? "0 16px" : "0 20px" }}>
          {loaded === 0 ? skeleton : Array.from({ length: loaded }, (_, i) => row(i))}
          {loaded > 0 ? (
            <div style={{ height: 64, display: "grid", placeItems: "center" }}>
              {footer === "error" ? (
                <div data-spm-motion style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 4px 4px 14px", borderRadius: cr(26), background: houseVar("field"), animation: `spm-chip .35s ${BOUNCE} both` }}>
                  <Badge fill={B.tangerine} name="exclamationmark.triangle" />
                  <span style={{ ...font("subheadline", 600), whiteSpace: "nowrap" }}>Couldn't load more</span>
                  <Press onClick={retry} style={{ height: 36, padding: "0 18px", borderRadius: cr(18), background: B.butter, color: INK, ...font("subheadline", 700) }}>Retry</Press>
                </div>
              ) : footer === "end" ? (
                endMessage ? (
                  <span data-spm-motion style={{ display: "flex", alignItems: "center", gap: 8, animation: "spm-fade .3s ease-out" }}>
                    <Badge fill={B.sage} name="checkmark" />
                    <span style={{ ...font("footnote", 500), color: houseVar("muted") }}>{endMessage}</span>
                  </span>
                ) : null
              ) : footer === "spinner" ? <Spinner /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Stretch Header

const BAR = 50;

const StretchHeader: Renderer = (r) => {
  const { p, children } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const height = n(p, "height");
  const [scrolled, setScrolled] = useState(0);
  const [stretch, setStretch] = useState(0);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const startTop = useRef(0);
  const tugged = useRef(false);
  const collapse = Math.min(1, scrolled / Math.max(1, height - BAR));
  const inline = Math.max(0, (collapse - 0.8) / 0.2);
  const title = s(p, "title");
  const eyebrow = s(p, "eyebrow").trim();
  const meta = s(p, "meta").trim();
  const size = n(p, "titleSize");

  const onDrag = useDrag({
    axis: "y",
    onStart() {
      startTop.current = scroller.current?.scrollTop ?? 0;
      tugged.current = false;
      setDragging(true);
    },
    onMove(info) {
      const el = scroller.current;
      if (!el) return;
      if (startTop.current <= 0 && info.dy > 0) {
        // Rubber band: the further you pull, the less it gives.
        const next = 160 * (1 - Math.exp(-info.dy / 220));
        setStretch(next);
        el.scrollTop = 0;
        if (next > 72 && !tugged.current) {
          tugged.current = true;
          rt.haptic("soft", el);
        }
        if (next <= 72) tugged.current = false;
      } else {
        setStretch(0);
        el.scrollTop = startTop.current - info.dy;
      }
    },
    onEnd() {
      setDragging(false);
      setStretch(0);
    },
  });

  const kids = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Root r={r} style={{ position: "relative", alignSelf: "stretch", flex: "1 1 auto", height: 760, minHeight: 320, overflow: "hidden", background: houseVar("ground"), color: houseVar("text") }}>
      <div
        ref={scroller}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop)}
        onPointerDown={onDrag}
        className="spm-scroll"
        style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollbarWidth: "none", touchAction: "pan-y" }}
      >
        <style>{".spm-scroll::-webkit-scrollbar{display:none}"}</style>
        {/* Hero: grows with the pull and lags the scroll on the way out. */}
        <div style={{ position: "relative", height: height + stretch, overflow: "hidden", background: B[s(p, "hero")] ?? B.sage, transition: dragging ? "none" : `height .45s ${SPRING}` }}>
          <div style={{ position: "absolute", inset: 0, transform: reduced ? "none" : `translateY(${scrolled * 0.3}px)` }}>
            {b(p, "sun") ? <span style={{ position: "absolute", width: 190, height: 190, borderRadius: cr(95), right: -50, top: -40, background: B.butter }} /> : null}
            <div style={{ position: "absolute", left: 24, right: 24, bottom: 22, color: INK, transformOrigin: "bottom left", transform: `translateY(${reduced ? 0 : scrolled * 0.45}px) scale(${(1 - 0.3 * collapse) * (reduced ? 1 : 1 + Math.min(stretch, 120) / 1200)})`, opacity: 1 - Math.max(0, (collapse - 0.5) / 0.35), transition: dragging ? "none" : `transform .45s ${SPRING}` }}>
              {eyebrow ? <div style={{ fontSize: ts(12), fontWeight: fw(600), letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.72, marginBottom: 6 }}>{eyebrow}</div> : null}
              <div style={{ fontSize: ts(size), fontWeight: fw(700), letterSpacing: "-0.03em", lineHeight: 1.05, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
            </div>
          </div>
        </div>
        {meta ? (
          <div style={{ position: "sticky", top: BAR, zIndex: 1, padding: "14px 24px", background: houseVar("ground"), fontSize: ts(12), fontWeight: fw(600), letterSpacing: "0.1em", textTransform: "uppercase", color: houseVar("muted") }}>{meta}</div>
        ) : null}
        {kids ? (
          <div className="spb-vflow" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "calc(16px * var(--spb-space, 1))", padding: "calc(24px * var(--spb-space, 1))" }}>
            <Frame axis="v">{children}</Frame>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
            {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ height: 64, borderRadius: corner(18), background: "var(--ios-fill)" }} />)}
          </div>
        )}
      </div>
      {/* The bar: a solid surface that fades in, with the inline title. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAR, display: "grid", placeItems: "center", pointerEvents: "none", zIndex: 2 }}>
        <span style={{ position: "absolute", inset: 0, background: houseVar("ground"), opacity: collapse, boxShadow: `0 4px 12px rgba(0,0,0,${0.12 * inline})` }} />
        <span style={{ position: "relative", ...font("headline", 700), opacity: inline, transform: `translateY(${(1 - inline) * 6}px)` }}>{title}</span>
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Date Range Picker

const DAY = 86_400_000;
/** Local calendar day as a whole number, so ranges compare and count without DST drift. */
const dayNum = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
const fromDay = (n: number) => {
  const u = new Date(n * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};
const short = (n: number) => fromDay(n).toLocaleDateString("en-US", { month: "short", day: "numeric" });
/** "Sep 27 – Oct 1", or "Sep 27 – 30" within a month, as `Date.FormatStyle` interval formatting reads. */
function formatRange(a: number, z: number) {
  const x = fromDay(a), y = fromDay(z);
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return `${short(a)} – ${y.getDate()}`;
  return `${short(a)} – ${short(z)}`;
}

const DateRangePicker: Renderer = (r) => {
  const { p, scheme } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const nights = s(p, "counting") === "nights";
  const today = dayNum(new Date());
  const length = n(p, "length");
  const span = nights ? length : length - 1;
  const maxLen = n(p, "maximumLength");
  const futureOnly = b(p, "futureOnly");
  const soldOut = b(p, "weekendsSoldOut");
  const seed = length > 0 ? `${today}:${today + Math.max(0, span)}` : "";
  const [range, setRange] = useLive(seed);
  const [pending, setPending] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<"left" | "right">("right");
  const [drag, setDrag] = useState(0);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [lo, hi] = range ? range.split(":").map(Number) : [null, null];

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  const limits = futureOnly ? { from: today, to: today + 365 } : null;
  const inBounds = (d: number) => !limits || (d >= limits.from && d <= limits.to);
  const blocked = (d: number) => soldOut && [0, 6].includes(fromDay(d).getDay());
  const available = (d: number) => inBounds(d) && !blocked(d);
  const lengthOf = (a: number, z: number) => (nights ? z - a : z - a + 1);
  const unit = (count: number) => `${count} ${nights ? (count === 1 ? "night" : "nights") : count === 1 ? "day" : "days"}`;

  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + page, 1);
  const minPage = futureOnly ? 0 : -60;
  const maxPage = futureOnly ? 12 : 60;
  const go = (delta: number) => {
    const next = page + delta;
    if (next < minPage || next > maxPage) return;
    setDir(delta > 0 ? "right" : "left");
    setPage(next);
  };

  const lower = pending ?? lo;
  const upper = pending ?? hi;
  const reach = useMemo(() => {
    if (pending === null) return null;
    let last = pending;
    for (let step = 0; step < 400; step++) {
      const next = last + 1;
      const count = nights ? step + 1 : step + 2;
      if (maxLen > 0 && count > maxLen) return last;
      if (!available(next)) return last;
      last = next;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, maxLen, nights, soldOut, futureOnly]);

  const tap = (d: number, el: Element) => {
    if (pending === null || d < pending) {
      setPending(d);
      setRange(nights ? "" : `${d}:${d}`);
      setNotice(null);
      rt.haptic("selection", el);
      return;
    }
    if (d === pending) {
      setPending(null);
      if (!nights) rt.haptic("success", el);
      else rt.haptic("selection", el);
      return;
    }
    if (maxLen > 0 && lengthOf(pending, d) > maxLen) {
      rt.haptic("error", el);
      setNotice({ id: (notice?.id ?? 0) + 1, text: `Up to ${unit(maxLen)}` });
      return;
    }
    for (let x = pending; x <= d; x++) {
      if (!available(x)) {
        rt.haptic("error", el);
        setNotice({ id: (notice?.id ?? 0) + 1, text: "Includes unavailable dates" });
        return;
      }
    }
    setPending(null);
    setRange(`${pending}:${d}`);
    rt.haptic("success", el);
  };

  const onDrag = useDrag({
    axis: "x",
    onMove(info) {
      setDrag(Math.max(-80, Math.min(80, info.dx * 0.6)));
    },
    onEnd(info) {
      setDrag(0);
      if (Math.abs(info.dx) > 50 || Math.abs(info.vx) > 500) go(info.dx < 0 ? 1 : -1);
    },
  });

  const first = dayNum(month);
  const lead = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => (i >= lead && i < lead + days ? first + i - lead : null));
  const band = scheme === "dark" ? "#4A4029" : "#FFEFC2";
  const disabledInk = scheme === "dark" ? "#5E5C58" : "#B3B0AA";
  const muted = houseVar("muted");

  let title = "Select dates";
  let hasValue = false;
  if (pending !== null) {
    title = `${short(pending)} –`;
    hasValue = true;
  } else if (lo !== null && hi !== null) {
    title = lo === hi ? short(lo) : formatRange(lo, hi);
    hasValue = true;
  }
  const chip = notice ? (
    <span key={`n${notice.id}`} data-spm-motion style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: cr(999), background: B.tangerine, color: ACCENT_INK, ...font("subheadline", 600), whiteSpace: "nowrap", animation: `spm-chip .3s ${BOUNCE} both` }}>
      <Glyph name="exclamationmark.triangle" size={12} strokeWidth={2.6} />{notice.text}
    </span>
  ) : pending !== null ? (
    <span key="hint" data-spm-motion style={{ ...font("subheadline", 500), color: muted, animation: "spm-fade .3s ease-out", whiteSpace: "nowrap" }}>Select end date</span>
  ) : lo !== null && hi !== null ? (
    <span key={`c${lo}-${hi}`} data-spm-motion style={{ padding: "6px 12px", borderRadius: cr(999), background: B.butter, color: INK, ...font("subheadline", 700), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", animation: `spm-chip .3s ${BOUNCE} both` }}>{unit(lengthOf(lo, hi))}</span>
  ) : null;

  const nav = (back: boolean) => {
    const enabled = back ? page > minPage : page < maxPage;
    return (
      <Press label={back ? "Previous month" : "Next month"} disabled={!enabled} onClick={(e) => { go(back ? -1 : 1); rt.haptic("light", e.currentTarget); }} style={{ width: 44, height: 44, display: "grid", placeItems: "center", opacity: enabled ? 1 : 0.35 }}>
        <span style={{ width: 34, height: 34, borderRadius: cr(17), display: "grid", placeItems: "center", background: houseVar("field") }}>
          <Glyph name={back ? "chevron.left" : "chevron.right"} size={15} strokeWidth={2.8} />
        </span>
      </Press>
    );
  };

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: corner(26), background: houseVar("surface"), boxShadow: "var(--spb-card-edge, none)", color: houseVar("text"), userSelect: "none" }}>
      <Keyframes />
      {b(p, "showsSummary") ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 32 }}>
          <span key={title} data-spm-motion style={{ ...font("title3", 600), color: hasValue ? houseVar("text") : muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", animation: "spm-fade .3s ease-out" }}>{title}</span>
          {chip}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span style={{ flex: 1, overflow: "hidden" }}>
          <span key={page} data-spm-motion style={{ display: "block", ...font("headline"), animation: reduced ? "spm-fade .2s" : `spm-rise .35s ${SPRING}` }}>
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </span>
        {nav(true)}
        {nav(false)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <span key={i} style={{ textAlign: "center", ...font("caption", 600), color: muted }}>{w}</span>)}
      </div>
      <div onPointerDown={onDrag} style={{ overflow: "hidden", touchAction: "pan-y" }}>
        <div key={page} data-spm-motion style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", transform: drag ? `translateX(${drag}px)` : "none", transition: drag ? "none" : `transform .35s ${SPRING}`, animation: reduced ? "spm-fade .2s" : `${dir === "right" ? "spm-in-right" : "spm-in-left"} .35s ${SPRING}` }}>
          {cells.map((d, i) => {
            if (d === null) return <span key={i} style={{ height: 44 }} />;
            const col = i % 7;
            const rowStart = col === 0 || cells[i - 1] === null;
            const rowEnd = col === 6 || cells[i + 1] === null;
            const inRange = lower !== null && upper !== null && d >= lower && d <= upper;
            const isStart = inRange && d === lower;
            const isEnd = inRange && d === upper;
            const endpoint = isStart || isEnd;
            const inBand = inRange && lower !== upper;
            const isBlocked = inBounds(d) && blocked(d);
            const ok = available(d);
            const outOfReach = ok && pending !== null && d > pending && reach !== null && d > reach;
            const leadR = rowStart && !isStart ? 12 : 0;
            const trailR = rowEnd && !isEnd ? 12 : 0;
            const sweep = lower !== null ? Math.max(0, d - lower) : 0;
            const color = endpoint ? INK : !ok ? disabledInk : outOfReach ? `color-mix(in srgb, ${muted} 55%, transparent)` : houseVar("text");
            return (
              <button
                key={i}
                type="button"
                disabled={!ok}
                onClick={(e) => tap(d, e.currentTarget)}
                style={{ position: "relative", height: 44, border: 0, padding: 0, background: "none", font: "inherit", cursor: ok ? "pointer" : "default", display: "grid", placeItems: "center" }}
              >
                <span data-spm-motion style={{
                  position: "absolute", top: 2, bottom: 2, left: rowStart && !isStart ? 2 : -0.5, right: rowEnd && !isEnd ? 2 : -0.5, display: "flex", overflow: "hidden",
                  borderRadius: cr(`${leadR}px ${trailR}px ${trailR}px ${leadR}px`), transformOrigin: "left", transform: `scaleX(${inBand || reduced ? 1 : 0.001})`, opacity: inBand ? 1 : 0,
                  transition: inBand ? `transform .24s ease-out ${Math.min(sweep * 20, 400)}ms, opacity .12s linear ${Math.min(sweep * 20, 400)}ms` : "transform .18s ease-out, opacity .18s",
                }}>
                  <span style={{ flex: 1, background: isStart ? "transparent" : band }} />
                  <span style={{ flex: 1, background: isEnd ? "transparent" : band }} />
                </span>
                <span style={{ position: "absolute", inset: 2, borderRadius: corner(12), background: B.butter, transform: endpoint || reduced ? "scale(1)" : "scale(.55)", opacity: endpoint ? 1 : 0, transition: reduced ? "opacity .18s" : `transform .32s ${BOUNCE}, opacity .2s` }} />
                <span style={{ position: "relative", ...font("body", endpoint ? 700 : 500), fontVariantNumeric: "tabular-nums", color, textDecoration: isBlocked ? `line-through ${disabledInk}` : undefined, transition: "color .2s" }}>{fromDay(d).getDate()}</span>
                {d === today ? <span style={{ position: "absolute", bottom: 6, left: "50%", marginLeft: -2, width: 4, height: 4, borderRadius: cr(2), background: endpoint ? INK : B.tangerine }} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </Root>
  );
};

export const mediaPieceRenderers: Record<string, Renderer> = {
  "story-strip": StoryStrip,
  "scrub-chart": ScrubChart,
  "streaming-reply": StreamingReply,
  "token-field": TokenField,
  "paged-list": PagedList,
  "stretch-header": StretchHeader,
  "date-range-picker": DateRangePicker,
};

