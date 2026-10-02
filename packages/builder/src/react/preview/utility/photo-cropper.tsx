"use client";
// Photo Cropper in the Playground: the sample photo in its dark well under a frame. Drag to pan, pinch with two
// fingers (or a trackpad) about the fingers, double-click to toggle 2.5x; past the photo's edges or the zoom limits
// it resists and springs back, and at a zoom limit the frame flashes red. The chips morph the frame, rotate turns
// the photo a quarter left, Reset returns to the start and Choose spins, then checks (then follows its link, if
// it has one). Mirrors PhotoCropper.swift:
// the same framing model, rubber band, clamping and mid-turn growth, drawn by a small per-frame animator.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CROP_SCENE, START_ASPECTS, parseAspects, type CropAspect, type CropShape } from "../../../definitions/utility/photo-cropper.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, useRuntime } from "../runtime.js";

const PHOTO = { w: 1600, h: 1200 };
const WELL_HEIGHT = 340;
const FRAME_INSET = 18;
/** The well is dark in both appearances, like the Swift piece's canvas. */
const WELL = "#121212";
const PAPER = "#F4F3EF";
const KEYFRAMES = "@keyframes sppc-spin{to{transform:rotate(360deg)}}@keyframes sppc-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){[data-sppc-motion]{animation:none!important;transition:none!important}}";

type Point = { x: number; y: number };
/** The framing, as the Swift stores it: zoom relative to filling the frame, the photo point at its centre, turns counted without wrapping. */
type Framing = { aspect: CropAspect; zoom: number; cx: number; cy: number; turns: number };
/** What is drawn this frame. */
type View = { zoom: number; scale: number; angle: number; cx: number; cy: number; fw: number; fh: number; radius: number };
type Layout = { w: number; h: number; frame: { x: number; y: number; w: number; h: number }; radius: number; rot: { w: number; h: number }; cover: number; maxZoom: number; turns: number };

// ---------------------------------------------------------------- Geometry (PhotoCropper.swift's CropLayout and CropMath)

function layoutFor(f: Framing, w: number, h: number): Layout {
  const turns = ((f.turns % 4) + 4) % 4;
  const rot = turns % 2 ? { w: PHOTO.h, h: PHOTO.w } : PHOTO;
  const ratio = f.aspect.ratio ?? rot.w / rot.h;
  const inset = Math.min(FRAME_INSET, w / 4, h / 4);
  const room = { w: Math.max(w - inset * 2, 1), h: Math.max(h - inset * 2, 1) };
  let fw = room.w;
  let fh = fw / ratio;
  if (fh > room.h) {
    fh = room.h;
    fw = fh * ratio;
  }
  const cover = Math.max(fw / rot.w, fh / rot.h);
  return { w, h, frame: { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh }, radius: f.aspect.circle ? fw / 2 : 0, rot, cover, maxZoom: Math.min(5, Math.max(1, Math.min(fw, fh) / cover / 32)), turns };
}
const perUnit = (l: Layout, z: number): Point => ({ x: Math.max(z * l.cover * l.rot.w, 1e-4), y: Math.max(z * l.cover * l.rot.h, 1e-4) });
const half = (l: Layout, z: number): Point => { const p = perUnit(l, z); return { x: l.frame.w / 2 / p.x, y: l.frame.h / 2 / p.y }; };
const rotate = (u: Point, t: number): Point => [u, { x: u.y, y: 1 - u.x }, { x: 1 - u.x, y: 1 - u.y }, { x: 1 - u.y, y: u.x }][((t % 4) + 4) % 4];
const unrotate = (r: Point, t: number): Point => [r, { x: 1 - r.y, y: r.x }, { x: 1 - r.x, y: 1 - r.y }, { x: r.y, y: 1 - r.x }][((t % 4) + 4) % 4];
const rubber = (over: number, span: number) => (1 - 1 / ((over * 0.55) / span + 1)) * span;
const rubberZoom = (z: number, l: Layout) => (z > l.maxZoom ? l.maxZoom * Math.pow(z / l.maxZoom, 0.3) : z < 1 ? Math.pow(Math.max(z, 0.01), 0.3) : z);
function rubberCenter(c: Point, z: number, l: Layout): Point {
  const hh = half(l, z);
  const axis = (v: number, hv: number) => {
    const lo = hv >= 0.5 ? 0.5 : hv;
    const hi = hv >= 0.5 ? 0.5 : 1 - hv;
    const span = Math.max(hv * 2, 1e-4);
    return v < lo ? lo - rubber(lo - v, span) : v > hi ? hi + rubber(v - hi, span) : v;
  };
  return { x: axis(c.x, hh.x), y: axis(c.y, hh.y) };
}
function clamp(f: Framing, l: Layout): Framing {
  const zoom = Math.min(Math.max(Number.isFinite(f.zoom) ? f.zoom : 1, 1), l.maxZoom);
  const r = rotate({ x: f.cx, y: f.cy }, f.turns);
  const hh = half(l, zoom);
  r.x = hh.x >= 0.5 ? 0.5 : Math.min(Math.max(r.x, hh.x), 1 - hh.x);
  r.y = hh.y >= 0.5 ? 0.5 : Math.min(Math.max(r.y, hh.y), 1 - hh.y);
  const u = unrotate(r, f.turns);
  return { ...f, zoom, cx: u.x, cy: u.y };
}
const viewOf = (f: Framing, l: Layout): View => ({ zoom: f.zoom, scale: f.zoom * l.cover, angle: f.turns * 90, cx: f.cx, cy: f.cy, fw: l.frame.w, fh: l.frame.h, radius: l.radius });
const lerp = (a: number, c: number, t: number) => a + (c - a) * t;
const lerpView = (a: View, c: View, t: number): View => ({ zoom: lerp(a.zoom, c.zoom, t), scale: lerp(a.scale, c.scale, t), angle: lerp(a.angle, c.angle, t), cx: lerp(a.cx, c.cx, t), cy: lerp(a.cy, c.cy, t), fw: lerp(a.fw, c.fw, t), fh: lerp(a.fh, c.fh, t), radius: lerp(a.radius, c.radius, t) });

/** How much the photo must grow, turned `deg` to the left, for the frame's corners to stay on it (CropPhotoEffect). */
function coverage(v: View, deg: number) {
  const w = PHOTO.w * v.scale, h = PHOTO.h * v.scale;
  const left = v.cx * w, right = (1 - v.cx) * w, top = v.cy * h, bottom = (1 - v.cy) * h;
  const rad = (deg * Math.PI) / 180, c = Math.cos(rad), sn = Math.sin(rad);
  let need = 1;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const wx = (sx * v.fw) / 2, wy = (sy * v.fh) / 2;
    const vx = c * wx - sn * wy, vy = sn * wx + c * wy;
    need = Math.max(need, vx < 0 ? -vx / Math.max(left, 1e-3) : vx / Math.max(right, 1e-3), vy < 0 ? -vy / Math.max(top, 1e-3) : vy / Math.max(bottom, 1e-3));
  }
  return need;
}
function boost(v: View) {
  const rest = Math.round(v.angle / 90) * 90;
  if (Math.abs(v.angle - rest) < 0.01) return 1;
  return Math.min(Math.max(coverage(v, v.angle) / coverage(v, rest), 1), 3);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const zoomText = (z: number) => `${Number(z.toFixed(1)).toLocaleString("en-US")}×`;

// ---------------------------------------------------------------- Pieces

/** The sample photo, drawn from the same shapes the generated Swift draws. */
function Scene() {
  const el = (shape: CropShape, k: number): ReactNode => {
    if (shape.kind === "rect") return <rect key={k} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r ?? 0} fill={shape.fill} />;
    if (shape.kind === "oval") return <ellipse key={k} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={shape.fill} />;
    if (shape.kind === "land") return <path key={k} d={`M${shape.from.join(" ")} ${shape.curves.map((c) => `C${c.join(" ")}`).join(" ")} L1600 1200 L0 1200 Z`} fill={shape.fill} />;
    return <path key={k} d={`M${shape.from.join(" ")} ${shape.to.map((c) => (c.length === 6 ? `C${c.join(" ")}` : `L${c.join(" ")}`)).join(" ")}`} fill="none" stroke={shape.color} strokeWidth={shape.width} strokeLinejoin="round" />;
  };
  return (
    <svg aria-hidden viewBox="0 0 1600 1200" width={PHOTO.w} height={PHOTO.h} style={{ display: "block" }}>
      {CROP_SCENE.map(el)}
    </svg>
  );
}

function Glyph({ aspect, selected, turns, muted }: { aspect: CropAspect; selected: boolean; turns: number; muted?: boolean }) {
  const ratio = aspect.ratio ?? (turns % 2 ? 3 / 4 : 4 / 3);
  const long = 18 * (ratio === 1 ? 0.86 : 1);
  const w = ratio >= 1 ? long : long * Math.max(ratio, 0.3);
  const h = ratio >= 1 ? long / Math.min(ratio, 3.3) : long;
  // A disabled selection goes neutral rather than a washed-out red.
  const color = selected && !muted ? ACCENT : houseVar("muted");
  return (
    <span style={{ width: 18, height: 18, display: "grid", placeItems: "center" }}>
      <span style={{ width: w, height: h, boxSizing: "border-box", borderRadius: aspect.circle ? "50%" : 2.5, border: `1.6px solid ${color}`, background: selected ? color : "transparent", transition: "background-color .2s, border-color .2s" }} />
    </span>
  );
}

function Icon({ children, size = 20, width = 2 }: { children: ReactNode; size?: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: "block" }}>
      {children}
    </svg>
  );
}

function Spinner() {
  return (
    <span data-sppc-motion style={{ display: "block", width: 18, height: 18, animation: "sppc-spin .9s steps(8) infinite" }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: "100%", height: "100%", display: "block" }}>
        {Array.from({ length: 8 }, (_, k) => (
          <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" opacity={0.25 + (k / 7) * 0.75} transform={`rotate(${k * 45} 12 12)`} />
        ))}
      </svg>
    </span>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

function Press({ children, onClick, disabled, label, style, selected }: { children: ReactNode; onClick: (el: Element) => void; disabled?: boolean; label?: string; style?: CSSProperties; selected?: boolean }) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={(e) => onClick(e.currentTarget)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{ border: 0, padding: 0, background: "none", font: "inherit", color: "inherit", cursor: disabled ? "default" : "pointer", transform: down && !disabled ? "scale(.94)" : "none", transition: `transform .25s ${BOUNCE}`, ...style }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Renderer

const PhotoCropper: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const failed = s(p, "photo") === "missing";
  const start = START_ASPECTS[s(p, "aspect")] ?? START_ASPECTS.square;
  const tiles = useMemo(() => {
    const list = parseAspects(p.aspects);
    if (list.length && !list.some((a) => a.id === start.id)) list.unshift(start);
    return list.length > 1 ? list : [];
  }, [p.aspects, start]);
  const startZoom = Math.min(Math.max(n(p, "zoom") || 1, 1), 5);
  const startTurns = ((Math.round(n(p, "turns")) % 4) + 4) % 4;
  const seedKey = `${start.id}|${startZoom}|${startTurns}`;

  const wellRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const brightRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const marksRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const size = useRef({ w: 320, h: WELL_HEIGHT });
  const model = useRef<Framing>({ aspect: start, zoom: startZoom, cx: 0.5, cy: 0.5, turns: startTurns });
  const view = useRef<View | null>(null);
  const anim = useRef<{ from: View; to: View; t0: number; ms: number; curve: (t: number) => number } | null>(null);
  const raf = useRef<number | null>(null);
  const live = useRef<{ zoom: number; r: Point; anchor: Point; past: boolean } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const track = useRef<{ c: Point; d: number; samples: Array<{ t: number; c: Point }> }>({ c: { x: 0, y: 0 }, d: 0, samples: [] });
  const timers = useRef<{ grid?: number; flash?: number; wheel?: number; choose?: number }>({});

  const [aspectId, setAspectId] = useState(start.id);
  const [turnsShown, setTurnsShown] = useState(startTurns);
  const [changed, setChanged] = useState(startZoom !== 1 || startTurns !== 0);
  const [grid, setGrid] = useState(false);
  const [readout, setReadout] = useState(false);
  const [flash, setFlash] = useState(false);
  const [phase, setPhase] = useState<"editing" | "busy" | "done">(s(p, "simulate") === "cropping" ? "busy" : "editing");
  const interactive = !failed && phase === "editing";

  const layout = useCallback((f: Framing) => layoutFor(f, size.current.w, size.current.h), []);

  /** Writes the current view into the DOM: both photo layers, the clip, the frame and the readout. */
  const paint = useCallback(() => {
    const v = view.current;
    if (!v) return;
    const { w, h } = size.current;
    const x = (w - v.fw) / 2, y = (h - v.fh) / 2;
    const k = v.scale * boost(v);
    const transform = `translate(${w / 2}px, ${h / 2}px) rotate(${-v.angle}deg) scale(${k}) translate(${-v.cx * PHOTO.w}px, ${-v.cy * PHOTO.h}px)`;
    if (dimRef.current) dimRef.current.style.transform = transform;
    if (brightRef.current) brightRef.current.style.transform = transform;
    if (clipRef.current) clipRef.current.style.clipPath = `inset(${y}px ${w - x - v.fw}px ${h - y - v.fh}px ${x}px round ${v.radius}px)`;
    const box = frameRef.current;
    if (box) {
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${v.fw}px`;
      box.style.height = `${v.fh}px`;
      box.style.borderRadius = `${v.radius}px`;
    }
    if (marksRef.current) marksRef.current.style.opacity = String(Math.max(0, 1 - v.radius / Math.max(Math.min(v.fw, v.fh) / 8, 1)));
    if (readoutRef.current) {
      readoutRef.current.textContent = zoomText(v.zoom);
      readoutRef.current.style.top = `${y >= 42 ? y - 21 : y + 21}px`;
    }
  }, []);

  const tick = useCallback((now: number) => {
    raf.current = null;
    const a = anim.current;
    if (!a) return;
    // Clamp (now - start) at 0: a frame can arrive stamped before the animation began.
    const t = Math.min(1, Math.max(0, now - a.t0) / Math.max(a.ms, 1));
    view.current = lerpView(a.from, a.to, a.curve(t));
    paint();
    if (t < 1) raf.current = requestAnimationFrame(tick);
    else anim.current = null;
  }, [paint]);

  /** Shows a framing: at once, or animated from what is on screen now. */
  const show = useCallback((f: Framing, ms = 0, curve = easeOut) => {
    const to = viewOf(f, layout(f));
    if (!ms || still || !view.current) {
      anim.current = null;
      view.current = to;
      paint();
      return;
    }
    anim.current = { from: { ...view.current }, to, t0: performance.now(), ms, curve };
    if (raf.current == null) raf.current = requestAnimationFrame(tick);
  }, [layout, paint, tick, still]);

  const commit = useCallback((f: Framing, ms: number, curve = easeOut) => {
    model.current = f;
    const l = layout(f);
    const rest = clamp({ aspect: start, zoom: 1, cx: 0.5, cy: 0.5, turns: 0 }, layoutFor({ aspect: start, zoom: 1, cx: 0.5, cy: 0.5, turns: 0 }, l.w, l.h));
    setChanged(f.aspect.id !== start.id || ((f.turns % 4) + 4) % 4 !== 0 || Math.abs(f.zoom - 1) > 0.01 || Math.hypot(f.cx - rest.cx, f.cy - rest.cy) > 0.002);
    show(f, reduced ? Math.min(ms, 200) : ms, reduced ? easeInOut : curve);
  }, [layout, show, start, reduced]);

  // A new start (props remixed): back to it at once.
  useEffect(() => {
    const f = { aspect: start, zoom: startZoom, cx: 0.5, cy: 0.5, turns: startTurns };
    model.current = clamp(f, layout(f));
    setAspectId(start.id);
    setTurnsShown(startTurns);
    setChanged(startZoom !== 1 || startTurns !== 0);
    show(model.current);
  }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPhase(s(p, "simulate") === "cropping" ? "busy" : "editing"), [p.simulate]);

  // The well's size: the frame and the photo follow it, keeping the framing.
  useEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    const measure = () => {
      size.current = { w: el.clientWidth || 320, h: el.clientHeight || WELL_HEIGHT };
      model.current = clamp(model.current, layout(model.current));
      show(model.current);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, show]);

  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    Object.values(timers.current).forEach((t) => t && window.clearTimeout(t));
  }, []);

  // ---------------------------------------------------------------- Gestures

  const flashLimit = () => {
    setFlash(true);
    rt.haptic("rigid", wellRef.current);
    window.clearTimeout(timers.current.flash);
    timers.current.flash = window.setTimeout(() => setFlash(false), 140);
  };

  const touchDown = () => {
    window.clearTimeout(timers.current.grid);
    setGrid(true);
  };
  const touchUp = () => {
    window.clearTimeout(timers.current.grid);
    timers.current.grid = window.setTimeout(() => {
      setGrid(false);
      setReadout(false);
    }, 500);
  };

  const begin = () => {
    const l = layout(model.current);
    const f = clamp(model.current, l);
    anim.current = null;
    live.current = { zoom: f.zoom, r: rotate({ x: f.cx, y: f.cy }, f.turns), anchor: { x: l.w / 2, y: l.h / 2 }, past: false };
  };

  /** The live gesture drawn with the rubber band, as the Swift's show(_:in:). */
  const apply = () => {
    const g = live.current;
    if (!g) return;
    const l = layout(model.current);
    const z = rubberZoom(g.zoom, l);
    const c = unrotate(rubberCenter(g.r, z, l), model.current.turns);
    model.current = { ...model.current, zoom: z, cx: c.x, cy: c.y };
    show(model.current);
  };

  const pan = (dx: number, dy: number) => {
    const g = live.current;
    if (!g) return;
    const u = perUnit(layout(model.current), rubberZoom(g.zoom, layout(model.current)));
    g.r = { x: g.r.x - dx / u.x, y: g.r.y - dy / u.y };
  };

  const pinch = (factor: number, at: Point) => {
    const g = live.current;
    if (!g || !Number.isFinite(factor) || factor <= 0) return;
    const l = layout(model.current);
    const before = perUnit(l, rubberZoom(g.zoom, l));
    g.zoom = Math.min(Math.max(g.zoom * factor, 0.2), l.maxZoom * 4);
    const after = perUnit(l, rubberZoom(g.zoom, l));
    const dx = at.x - l.w / 2, dy = at.y - l.h / 2;
    g.r = { x: g.r.x + dx / before.x - dx / after.x, y: g.r.y + dy / before.y - dy / after.y };
    g.anchor = at;
    const past = g.zoom < 0.999 || g.zoom > l.maxZoom + 0.001;
    if (past && !g.past) flashLimit();
    g.past = past;
    setReadout(true);
  };

  /** Springs back inside the limits about the last pinch centre, with a short coast from the release speed. */
  const settle = (velocity: Point) => {
    const g = live.current;
    live.current = null;
    if (!g) return;
    const l = layout(model.current);
    const shownZoom = rubberZoom(g.zoom, l);
    const zoom = Math.min(Math.max(shownZoom, 1), l.maxZoom);
    const r = rubberCenter(g.r, shownZoom, l);
    const from = perUnit(l, shownZoom), to = perUnit(l, zoom);
    const dx = g.anchor.x - l.w / 2, dy = g.anchor.y - l.h / 2;
    r.x += dx / from.x - dx / to.x - (velocity.x * 0.1) / to.x;
    r.y += dy / from.y - dy / to.y - (velocity.y * 0.1) / to.y;
    const u = unrotate(r, model.current.turns);
    const next = clamp({ ...model.current, zoom, cx: u.x, cy: u.y }, l);
    const travel = Math.hypot((next.cx - model.current.cx) * to.x, (next.cy - model.current.cy) * to.y);
    commit(next, Math.min(550, 320 + travel / 1.6));
  };

  const local = (e: { clientX: number; clientY: number }): Point => {
    const el = wellRef.current!;
    const rect = el.getBoundingClientRect();
    const zoom = rect.width / (el.clientWidth || 1);
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };
  const centroid = (): Point => {
    const pts = [...pointers.current.values()];
    return { x: pts.reduce((a, q) => a + q.x, 0) / pts.length, y: pts.reduce((a, q) => a + q.y, 0) / pts.length };
  };
  const spread = () => {
    const pts = [...pointers.current.values()];
    return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };
  const rebase = () => {
    track.current.c = centroid();
    track.current.d = spread();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || still || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) {
      touchDown();
      begin();
      track.current.samples = [];
    }
    rebase();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !live.current) return;
    pointers.current.set(e.pointerId, local(e));
    const c = centroid();
    const d = spread();
    pan(c.x - track.current.c.x, c.y - track.current.c.y);
    if (pointers.current.size >= 2 && track.current.d > 0 && d > 0) pinch(d / track.current.d, c);
    track.current.c = c;
    track.current.d = d;
    const now = performance.now();
    track.current.samples = [...track.current.samples.filter((q) => now - q.t < 100), { t: now, c }];
    apply();
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) {
      rebase();
      return;
    }
    touchUp();
    const q = track.current.samples;
    const first = q[0], last = q[q.length - 1];
    const dt = first && last ? (last.t - first.t) / 1000 : 0;
    const fresh = last && performance.now() - last.t < 80;
    settle(dt > 0.01 && fresh ? { x: (last.c.x - first.c.x) / dt, y: (last.c.y - first.c.y) / dt } : { x: 0, y: 0 });
  };

  // Trackpad pinch arrives as ctrl + wheel. It has to be a non-passive listener to keep the page from zooming.
  useEffect(() => {
    const el = wellRef.current;
    if (!el || still) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !interactive) return;
      e.preventDefault();
      if (!live.current) {
        touchDown();
        begin();
      }
      pinch(Math.exp(-e.deltaY * 0.01), local(e));
      apply();
      window.clearTimeout(timers.current.wheel);
      timers.current.wheel = window.setTimeout(() => {
        touchUp();
        settle({ x: 0, y: 0 });
      }, 160);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive || still) return;
    const at = local(e);
    const l = layout(model.current);
    const cur = clamp(model.current, l);
    const target = cur.zoom > 1.05 ? 1 : Math.min(2.5, l.maxZoom);
    if (Math.abs(target - cur.zoom) < 0.001) return flashLimit();
    const rr = rotate({ x: cur.cx, y: cur.cy }, cur.turns);
    const from = perUnit(l, cur.zoom), to = perUnit(l, target);
    const dx = at.x - l.w / 2, dy = at.y - l.h / 2;
    const u = unrotate({ x: rr.x + dx / from.x - dx / to.x, y: rr.y + dy / from.y - dy / to.y }, cur.turns);
    setReadout(true);
    touchDown();
    touchUp();
    commit(clamp({ ...cur, zoom: target, cx: u.x, cy: u.y }, l), 420);
  };

  // ---------------------------------------------------------------- Actions

  const select = (a: CropAspect, el: Element) => {
    if (!interactive || a.id === model.current.aspect.id) return;
    const next = { ...model.current, aspect: a };
    setAspectId(a.id);
    rt.haptic("selection", el);
    commit(clamp(next, layout(next)), 460);
  };

  const turn = (el: Element) => {
    if (!interactive) return;
    const next = { ...model.current, turns: model.current.turns + 1 };
    setTurnsShown(next.turns);
    rt.haptic("light", el);
    commit(clamp(next, layout(next)), reduced ? 0 : 520, easeInOut);
  };

  const reset = (el: Element) => {
    if (!interactive || !changed) return;
    const turns = model.current.turns;
    const mod = ((turns % 4) + 4) % 4;
    // Upright again, the short way round.
    const back = mod === 0 ? turns : mod === 3 ? turns + 1 : turns - mod;
    const next = { aspect: start, zoom: 1, cx: 0.5, cy: 0.5, turns: back };
    setAspectId(start.id);
    setTurnsShown(back);
    rt.haptic("soft", el);
    commit(clamp(next, layout(next)), 520, easeInOut);
  };

  const choose = (el: Element) => {
    if (!interactive) return;
    setPhase("busy");
    window.clearTimeout(timers.current.choose);
    timers.current.choose = window.setTimeout(() => {
      setPhase("done");
      rt.haptic("success", el);
      // With a link, the check shows for a beat and then the screen moves on (a sheet goes back).
      const next = s(p, "link");
      timers.current.choose = window.setTimeout(() => {
        setPhase(s(p, "simulate") === "cropping" ? "busy" : "editing");
        if (next) rt.act(next);
      }, next ? 520 : 900);
    }, 900);
  };

  // ---------------------------------------------------------------- Drawing

  const edge = flash ? ACCENT : PAPER;
  const selectedFill = r.scheme === "dark" ? houseVar("raised") : houseVar("surface");
  const photoLayer = (ref: typeof dimRef, dim: boolean) => (
    <div ref={ref} style={{ position: "absolute", left: 0, top: 0, width: PHOTO.w, height: PHOTO.h, transformOrigin: "0 0", willChange: "transform" }}>
      <Scene />
      {dim ? <div style={{ position: "absolute", inset: 0, background: WELL, opacity: 0.62 }} /> : null}
    </div>
  );
  const mark = (corner: number): CSSProperties => {
    const right = corner === 1 || corner === 2;
    const bottom = corner === 2 || corner === 3;
    return {
      position: "absolute", width: 20, height: 20, boxSizing: "border-box", borderColor: edge, borderStyle: "solid",
      left: right ? undefined : -3, right: right ? -3 : undefined, top: bottom ? undefined : -3, bottom: bottom ? -3 : undefined,
      borderTopWidth: bottom ? 0 : 3, borderBottomWidth: bottom ? 3 : 0, borderLeftWidth: right ? 0 : 3, borderRightWidth: right ? 3 : 0,
      transition: flash ? "none" : "border-color .4s ease-out",
    };
  };
  const textButton = (on: boolean): CSSProperties => ({ minWidth: 44, minHeight: 44, padding: "0 8px", fontSize: ts(17), fontWeight: fw(400), color: on ? houseVar("text") : houseVar("muted"), opacity: on ? 1 : 0.55, transition: "color .2s, opacity .2s" });

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", flexDirection: "column", gap: 6, minWidth: 240, color: houseVar("text") }}>
      <style>{KEYFRAMES}</style>
      <div
        ref={wellRef}
        role="img"
        aria-label={failed ? "Crop area, couldn't open this photo" : `Crop area, ${zoomText(model.current.zoom)}, ${tiles.find((a) => a.id === aspectId)?.title ?? start.title}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={onDoubleClick}
        style={{ position: "relative", height: WELL_HEIGHT, borderRadius: cr(26), overflow: "hidden", background: WELL, touchAction: "none", cursor: interactive ? "grab" : "default", userSelect: "none" }}
      >
        {failed ? null : (
          <>
            {photoLayer(dimRef, true)}
            <div ref={clipRef} style={{ position: "absolute", inset: 0 }}>{photoLayer(brightRef, false)}</div>
          </>
        )}
        <div ref={frameRef} style={{ position: "absolute", pointerEvents: "none" }}>
          {failed ? <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: PAPER, opacity: 0.07 }} /> : null}
          <div data-sppc-motion style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden", opacity: grid ? 1 : 0, transition: `opacity ${grid ? ".15s" : ".3s"} ease-out` }}>
            {[1, 2].map((k) => <span key={`v${k}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(k * 100) / 3}%`, width: 0.75, background: PAPER, opacity: 0.6 }} />)}
            {[1, 2].map((k) => <span key={`h${k}`} style={{ position: "absolute", left: 0, right: 0, top: `${(k * 100) / 3}%`, height: 0.75, background: PAPER, opacity: 0.6 }} />)}
          </div>
          <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", boxShadow: `0 0 0 1px ${edge}`, transition: flash ? "none" : "box-shadow .4s ease-out" }} />
          <div ref={marksRef} style={{ position: "absolute", inset: 0 }}>
            {[0, 1, 2, 3].map((c) => <span key={c} style={mark(c)} />)}
          </div>
          {failed ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, textAlign: "center" }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: ACCENT, color: ACCENT_INK, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>!</span>
              <span style={{ color: PAPER, fontSize: ts(15), fontWeight: fw(600) }}>Couldn&apos;t open this photo</span>
            </div>
          ) : null}
        </div>
        <span
          ref={readoutRef}
          data-sppc-motion
          style={{
            position: "absolute", left: "50%", transform: "translate(-50%, -50%)", padding: "4px 10px", borderRadius: 999, pointerEvents: "none",
            background: "rgba(20,20,20,.72)", color: PAPER, fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            opacity: readout ? 1 : 0, transition: `opacity ${readout ? ".15s" : ".3s"} ease-out`,
          }}
        />
      </div>

      {tiles.length ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, overflowX: "auto", scrollbarWidth: "none", opacity: failed ? 0.4 : 1 }}>
          {tiles.map((a) => {
            const selected = a.id === aspectId;
            return (
              <Press key={a.id} label={a.title} selected={selected} disabled={!interactive} onClick={(el) => select(a, el)}>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 58, minHeight: 44, padding: "7px 10px", boxSizing: "border-box", borderRadius: cr(12), background: selected ? selectedFill : "transparent", color: selected ? houseVar("text") : houseVar("muted"), transition: "background-color .2s, color .2s" }}>
                  <Glyph aspect={a} selected={selected} turns={turnsShown} muted={failed} />
                  <span style={{ fontSize: ts(12), fontWeight: fw(600), lineHeight: 1.25, whiteSpace: "nowrap" }}>{a.title}</span>
                </span>
              </Press>
            );
          })}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingInline: 4 }}>
        {b(p, "cancel") ? (
          <>
            <Press onClick={(el) => { rt.haptic("light", el); rt.act("back"); }} style={textButton(true)}>Cancel</Press>
            <span style={{ flex: 1 }} />
          </>
        ) : null}
        <Press label="Rotate left" disabled={!interactive} onClick={turn} style={{ opacity: failed ? 0.4 : 1 }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: houseVar("field"), display: "grid", placeItems: "center" }}>
            <Icon size={20}>
              <rect x="4.5" y="10" width="10" height="10" rx="2" />
              <path d="M10 5.5h3.5a5 5 0 0 1 5 5v1.5" />
              <path d="M12 3l-2.5 2.5L12 8" />
            </Icon>
          </span>
        </Press>
        <Press disabled={!interactive || !changed} onClick={reset} style={textButton(interactive && changed)}>Reset</Press>
        <span style={{ flex: 1 }} />
        <Press label="Choose" disabled={!interactive} onClick={choose}>
          <span
            style={{
              display: "grid", placeItems: "center", minHeight: 44, padding: "0 22px", borderRadius: cr(999), fontSize: ts(17), fontWeight: fw(600),
              background: failed ? houseVar("field") : ACCENT, color: failed ? houseVar("muted") : ACCENT_INK,
            }}
          >
            <span style={{ gridArea: "1 / 1", opacity: phase === "editing" ? 1 : 0, transition: "opacity .2s" }}>Choose</span>
            <span style={{ gridArea: "1 / 1", opacity: phase === "busy" ? 1 : 0, transition: "opacity .2s" }}>{phase === "busy" ? <Spinner /> : null}</span>
            <span style={{ gridArea: "1 / 1" }}>
              {phase === "done" ? (
                <span data-sppc-motion style={{ display: "block", animation: `sppc-pop .35s ${BOUNCE} both` }}>
                  <Icon size={18} width={3}><path d="M5.5 12.5l4.2 4.2 8.8-9.4" /></Icon>
                </span>
              ) : null}
            </span>
          </span>
        </Press>
      </div>
    </div>
  );
};

export const renderer: Renderer = PhotoCropper;
