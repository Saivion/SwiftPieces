"use client";
// Drag Select Grid, interactive: the same rules as the Swift piece. In select mode a sideways drag
// (or a hold, then any direction) paints the reading-order range from the first item to the one under
// the pointer, dragging back restores what each item was, starting on a selected item deselects, and
// holding near the top or bottom edge auto-scrolls while painting. A vertical drag scrolls; a click
// toggles one. Outside select mode a hold turns it on (when allowed).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { house } from "../../../core/palette.js";
import { dsgPreselected, dsgSymbol, dsgTint } from "../../../definitions/utility/drag-select-grid.js";
import { Glyph } from "../../icons.js";
import { b, cr, fillStyle, houseVar, n, s, useAxis, type Renderer, type RenderProps } from "../env.js";
import { useLive, useRuntime } from "../runtime.js";

const INK = house.ink;
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const SLOP = 8;
const EDGE = 72;
const SPEED = 1200;

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

type Gesture = {
  mode: "undecided" | "paint" | "scroll";
  x0: number;
  y0: number;
  x: number;
  y: number;
  top0: number;
  anchor: number;
  current: number;
  selects: boolean;
  base: Set<number>;
  lastTick: number;
  lastFrame: number;
  timer?: ReturnType<typeof setTimeout>;
  raf?: number;
};

function Cell({ i, selected, selecting, radius, reduced }: { i: number; selected: boolean; selecting: boolean; radius: number; reduced: boolean }) {
  const badge = 24;
  return (
    <div
      style={{
        position: "relative", aspectRatio: "var(--dsg-aspect)", borderRadius: cr(radius), overflow: "hidden",
        background: house.blocks[dsgTint(i)], transform: `scale(${selected ? 0.86 : 1})`,
        transition: reduced ? "transform .12s ease-out" : `transform .3s ${SPRING}`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: INK, opacity: 0.7 }}>
        <Glyph name={dsgSymbol(i)} size={24} strokeWidth={1.8} />
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute", right: 6, bottom: 6, width: badge, height: badge, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: selected ? INK : "rgba(0,0,0,0.16)", boxShadow: "inset 0 0 0 1.7px #fff, 0 1px 3px rgba(0,0,0,0.28)",
          opacity: selecting || selected ? 1 : 0, transform: `scale(${selected ? 1 / 0.86 : 1})`, transformOrigin: "100% 100%",
          transition: reduced ? "opacity .22s, background-color .18s, transform .12s ease-out" : `opacity .22s, background-color .18s, transform .3s ${SPRING}`,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#F4F3EF" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"
          style={{ width: 13, height: 13, transform: `scale(${selected ? 1 : 0.3})`, opacity: selected ? 1 : 0, transition: reduced ? "opacity .12s" : `transform .32s ${SPRING}, opacity .16s` }}>
          <path d="M6 12.5l4 4 8-9" />
        </svg>
      </span>
    </div>
  );
}

const DragSelectGrid: Renderer = (r: RenderProps) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const total = Math.max(0, Math.round(n(p, "items")));
  const minimum = Math.max(44, n(p, "minimumCellWidth") || 96);
  const aspect = Number(s(p, "aspectRatio")) || 1;
  const spacing = Math.max(0, n(p, "spacing"));
  const radius = n(p, "cornerRadius");
  const longPress = b(p, "longPressToSelect");
  const seed = useMemo(() => new Set(dsgPreselected(Math.round(n(p, "preselected")), total)), [p.preselected, total]);
  const [selection, setSelection] = useLive(seed);
  const [selecting, setSelecting] = useLive(b(p, "isSelecting"));
  const [width, setWidth] = useState(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  // The latest values, for the pointer and frame callbacks.
  const live = useRef({ selection, selecting, width, total });
  live.current = { selection, selecting, width, total };

  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    const g = gesture.current;
    if (g?.timer) clearTimeout(g.timer);
    if (g?.raf) cancelAnimationFrame(g.raf);
  }, []);

  const columns = width > 0 ? Math.max(1, Math.floor((width + spacing) / (minimum + spacing))) : 1;
  const cellWidth = width > 0 ? (width - spacing * (columns - 1)) / columns : 0;

  /** Reading-order index under a client point; gutters and edges snap to the nearest cell. */
  const indexAt = (cx: number, cy: number) => {
    const el = grid.current;
    const count = live.current.total;
    if (!el || !count || cellWidth <= 0) return null;
    const rect = el.getBoundingClientRect();
    const k = rect.width / (el.clientWidth || 1);
    const x = (cx - rect.left) / k;
    const y = (cy - rect.top) / k;
    const rows = Math.ceil(count / columns);
    const col = Math.min(Math.max(Math.floor((x + spacing / 2) / (cellWidth + spacing)), 0), columns - 1);
    const row = Math.min(Math.max(Math.floor((y + spacing / 2) / (cellWidth / aspect + spacing)), 0), rows - 1);
    return Math.min(row * columns + col, count - 1);
  };

  const apply = (g: Gesture) => {
    const next = new Set(g.base);
    for (let k = Math.min(g.anchor, g.current); k <= Math.max(g.anchor, g.current); k++) g.selects ? next.add(k) : next.delete(k);
    setSelection(next);
  };

  const track = () => {
    const g = gesture.current;
    if (!g || g.mode !== "paint") return;
    const i = indexAt(g.x, g.y);
    if (i === null || i === g.current) return;
    g.current = i;
    apply(g);
    const now = performance.now();
    if (now - g.lastTick > 45) {
      g.lastTick = now;
      rt.haptic("selection", grid.current);
    }
  };

  /** Auto-scroll: speed grows linearly with depth into the edge band. */
  const frame = (t: number) => {
    const g = gesture.current;
    const sc = scroller.current;
    if (!g || g.mode !== "paint" || !sc) return;
    const dt = g.lastFrame ? Math.min(Math.max((t - g.lastFrame) / 1000, 0), 0.05) : 1 / 60;
    g.lastFrame = t;
    const rect = sc.getBoundingClientRect();
    const k = rect.height / (sc.clientHeight || 1);
    const y = (g.y - rect.top) / k;
    const h = sc.clientHeight;
    const zone = Math.min(EDGE, h / 4);
    let v = 0;
    if (y < zone) v = -SPEED * Math.min(1, (zone - y) / zone);
    else if (y > h - zone) v = SPEED * Math.min(1, (y - (h - zone)) / zone);
    if (v) {
      const before = sc.scrollTop;
      sc.scrollTop = Math.min(Math.max(before + v * dt, 0), sc.scrollHeight - h);
      if (sc.scrollTop !== before) track();
    }
    g.raf = requestAnimationFrame(frame);
  };

  const beginPaint = (g: Gesture) => {
    const i = indexAt(g.x0, g.y0);
    if (i === null) return;
    if (g.timer) clearTimeout(g.timer);
    const base = new Set(live.current.selection);
    Object.assign(g, { mode: "paint", anchor: i, current: i, selects: !base.has(i), base, lastTick: performance.now(), lastFrame: 0 });
    if (!live.current.selecting) setSelecting(true);
    apply(g);
    rt.haptic("soft", grid.current);
    g.raf = requestAnimationFrame(frame);
    track();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gesture.current) return;
    const sc = scroller.current;
    const g: Gesture = { mode: "undecided", x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, top0: sc?.scrollTop ?? 0, anchor: 0, current: 0, selects: true, base: new Set(), lastTick: 0, lastFrame: 0 };
    gesture.current = g;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    if (live.current.selecting || longPress) {
      g.timer = setTimeout(() => {
        if (gesture.current === g && g.mode === "undecided") beginPaint(g);
      }, live.current.selecting ? 250 : 450);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    g.x = e.clientX;
    g.y = e.clientY;
    const k = rt.scale() || 1;
    const dx = (g.x - g.x0) / k;
    const dy = (g.y - g.y0) / k;
    if (g.mode === "undecided") {
      if (Math.hypot(dx, dy) < SLOP) return;
      if (g.timer) clearTimeout(g.timer);
      if (live.current.selecting && Math.abs(dx) > Math.abs(dy) * 1.2) beginPaint(g);
      else g.mode = "scroll";
    }
    if (g.mode === "paint") track();
    if (g.mode === "scroll" && scroller.current) scroller.current.scrollTop = g.top0 - dy;
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.timer) clearTimeout(g.timer);
    if (g.raf) cancelAnimationFrame(g.raf);
    // A release before any decision is a tap: in select mode it toggles one item.
    if (!cancelled && g.mode === "undecided" && live.current.selecting) {
      const i = indexAt(e.clientX, e.clientY);
      if (i === null) return;
      const next = new Set(live.current.selection);
      next.has(i) ? next.delete(i) : next.add(i);
      setSelection(next);
      rt.haptic("selection", e.currentTarget);
    }
  };

  const toggleMode = () => {
    const next = !selecting;
    setSelecting(next);
    if (!next) setSelection(new Set());
    rt.haptic("light", grid.current);
  };

  const count = selection.size;
  const height = n(p, "height") || 520;
  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, color: houseVar("text") }}>
      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        role="grid"
        aria-multiselectable
        aria-label={selecting ? `${count} selected` : "Photos"}
        style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehavior: "contain", touchAction: "none", userSelect: "none", scrollbarWidth: "none", cursor: selecting ? "cell" : "default" } as CSSProperties}
      >
        <div
          ref={grid}
          style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: spacing, opacity: width > 0 ? 1 : 0, ["--dsg-aspect" as string]: String(aspect) } as CSSProperties}
        >
          {Array.from({ length: total }, (_, i) => (
            <Cell key={i} i={i} selected={selection.has(i)} selecting={selecting} radius={radius} reduced={reduced} />
          ))}
        </div>
      </div>
      {b(p, "selectButton") ? (
        <button
          type="button"
          onClick={toggleMode}
          style={{
            position: "absolute", top: 12, right: 12, height: 34, padding: "0 14px", border: 0, borderRadius: 999, cursor: "pointer",
            font: "inherit", fontSize: 15, fontWeight: 600, color: houseVar("text"), background: houseVar("raised"),
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}
        >
          {selecting ? "Done" : "Select"}
        </button>
      ) : null}
    </div>
  );
};

export const renderer: Renderer = DragSelectGrid;
