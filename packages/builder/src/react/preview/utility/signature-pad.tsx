"use client";
// Signature Pad in the Playground: draw with the pointer and the ink thins on quick strokes and runs
// full on slow ones, the same model as SignaturePad.swift (velocity eased in time, midpoint quadratics,
// uniform fit anchored bottom-leading). Undo, Clear (and Undo after Clear) and Type instead all work.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ACCENT, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer, type RenderProps } from "../env.js";
import { BOUNCE, useLive, useRuntime } from "../runtime.js";
import { house } from "../../../core/palette.js";

type Pt = { x: number; y: number; t: number };
type Sig = { strokes: Pt[][]; canvas: { w: number; h: number } | null };

const EMPTY: Sig = { strokes: [], canvas: null };
const SCRIPT = '"Snell Roundhand", "SnellRoundhand-Bold", "Apple Chancery", cursive';
const BASELINE_ROOM = 46;
const INSET = 22;

/** One stroke, exactly as the Swift `InkShape` builds it. */
function drawStroke(ctx: CanvasRenderingContext2D, points: Pt[], line: number, scale: number, dx: number, dy: number) {
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
    ctx.arc(c.x, c.y, line * 0.62 * scale, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const w = [line * 0.72];
  for (let i = 1; i < kept.length; i++) {
    const dt = Math.max(1 / 240, kept[i].t - kept[i - 1].t);
    const v = Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y) / dt;
    const f = Math.min(1, Math.max(0, (v - 140) / 1100));
    w.push(w[i - 1] + (line * (1 - 0.62 * f * (2 - f)) - w[i - 1]) * (1 - Math.exp(-dt / 0.035)));
  }
  const V = kept.map(at);
  const mid = (a: { x: number; y: number }, c: { x: number; y: number }) => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
  const seg = (a: { x: number; y: number }, c: { x: number; y: number }, e: { x: number; y: number }, w0: number, w1: number) => {
    const k = Math.max(1, Math.min(16, Math.ceil((Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(e.x - c.x, e.y - c.y)) / 2.5)));
    const q = (t: number) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * e.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * e.y });
    for (let i = 0; i < k; i++) {
      const ta = i / k, tb = (i + 1) / k;
      const m0 = (1 - ta) * (1 - tb), m1 = (1 - ta) * tb + ta * (1 - tb), m2 = ta * tb;
      const p0 = q(ta), p1 = q(tb);
      ctx.lineWidth = (w0 + (w1 - w0) * (ta + tb) / 2) * scale;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(m0 * a.x + m1 * c.x + m2 * e.x, m0 * a.y + m1 * c.y + m2 * e.y, p1.x, p1.y);
      ctx.stroke();
    }
  };
  const count = V.length;
  const head = mid(V[0], V[1]);
  seg(V[0], mid(V[0], head), head, w[0], (w[0] + w[1]) / 2);
  for (let i = 1; i < count - 1; i++) seg(mid(V[i - 1], V[i]), V[i], mid(V[i], V[i + 1]), (w[i - 1] + w[i]) / 2, (w[i] + w[i + 1]) / 2);
  const tail = mid(V[count - 2], V[count - 1]);
  seg(tail, mid(tail, V[count - 1]), V[count - 1], (w[count - 2] + w[count - 1]) / 2, w[count - 1]);
}

/** The typed name's size: as large as the pad allows, shrinking so a long name still fits (Swift `nameFontSize`). */
let measurer: CanvasRenderingContext2D | null = null;
function nameFontSize(text: string, padWidth: number, padHeight: number) {
  const base = Math.min(Math.max(padHeight * 0.26, 30), 54);
  const available = padWidth - INSET * 2 - 34;
  if (available <= 0 || typeof document === "undefined") return base;
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return base;
  measurer.font = `700 ${base}px ${SCRIPT}`;
  const natural = measurer.measureText(text).width;
  return natural > available ? Math.max((base * available) / natural, 18) : base;
}

/** Uniform fit of the capture canvas into the pad, anchored to the bottom and the leading edge. */
function fit(canvas: { w: number; h: number } | null, w: number, h: number) {
  if (!canvas || canvas.w <= 0 || canvas.h <= 0) return { scale: 1, dx: 0, dy: 0 };
  const scale = Math.min(w / canvas.w, h / canvas.h);
  return { scale, dx: 0, dy: h - canvas.h * scale };
}

function Glyph({ d, size = 18, width = 2.4 }: { d: string; size?: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flex: "none" }}>
      <path d={d} />
    </svg>
  );
}
const UNDO = "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11";
const KEYBOARD = "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8";
const SIGN = "M3 17c2-6 4-11 5-11s-1 9 1 9 3-6 4-6-0 5 2 5 3-3 6-3M3 21h18";

function TextButton({ children, onClick, disabled, label, style, pill }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string; style?: CSSProperties; pill?: boolean }) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: pill ? 34 : 44, minHeight: pill ? 34 : 44, padding: pill ? "0 14px" : "0 12px", margin: pill ? "5px 3px" : 0,
        border: 0, borderRadius: 999, background: pill ? houseVar("field") : "none", font: "inherit",
        fontSize: ts(15), fontWeight: fw(600), color: disabled ? houseVar("muted") : houseVar("text"), opacity: disabled ? 0.5 : down ? 0.55 : 1,
        transform: down && !disabled ? "scale(0.96)" : "none", transition: `transform .25s ${BOUNCE}, opacity .2s, color .2s`, cursor: disabled ? "default" : "pointer", ...style,
      }}
    >
      {children}
    </button>
  );
}

function Root({ r, style, children }: { r: RenderProps; style?: CSSProperties; children?: ReactNode }) {
  const axis = useAxis();
  return <div {...r.box} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

const SignaturePad: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const allowsTyping = b(p, "allowsTyping");
  const disabled = b(p, "disabled");
  const height = Math.max(150, n(p, "height") || 200);
  const line = n(p, "lineWidth") || 3.6;
  const [typed, setTyped] = useLive<string | null>(allowsTyping && s(p, "typedName").trim() ? s(p, "typedName").trim() : null);
  const [sig, setSig] = useState<Sig>(EMPTY);
  const [restore, setRestore] = useState<{ before: Sig; after: Sig } | null>(null);
  const [fading, setFading] = useState<Pt[][] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<{ points: Pt[]; start: number; canvas: { w: number; h: number } } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const [padWidth, setPadWidth] = useState(320);
  const typing = allowsTyping && typed !== null;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr * 2) || canvas.height !== Math.round(h * dpr * 2)) {
      canvas.width = Math.round(w * dpr * 2);
      canvas.height = Math.round(h * dpr * 2);
    }
    ctx.setTransform(dpr * 2, 0, 0, dpr * 2, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const live = liveRef.current;
    const t = fit(sig.strokes.length ? sig.canvas : live?.canvas ?? null, w, h);
    const ink = getComputedStyle(canvas).color;
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of sig.strokes) drawStroke(ctx, stroke, line, t.scale, t.dx, t.dy);
    if (live) drawStroke(ctx, live.points, line, t.scale, t.dx, t.dy);
  }, [sig, line]);

  useEffect(() => {
    paint();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [paint, typing]);

  useEffect(() => {
    const el = padRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setPadWidth(el.clientWidth));
    ro.observe(el);
    setPadWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // A removed stroke (Undo) or the whole ink (Clear) fades out on its own layer.
  useEffect(() => {
    if (!fading) return;
    const id = setTimeout(() => setFading(null), 320);
    return () => clearTimeout(id);
  }, [fading]);

  /** Pointer position in the capture canvas's points (the device may be scaled on the page). */
  const toCanvas = (e: { clientX: number; clientY: number }, canvas: { w: number; h: number }) => {
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const zoom = rect.width / (el.clientWidth || 1);
    const t = fit(canvas, el.clientWidth, el.clientHeight);
    return { x: ((e.clientX - rect.left) / zoom - t.dx) / t.scale, y: ((e.clientY - rect.top) / zoom - t.dy) / t.scale };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const canvas = sig.strokes.length && sig.canvas ? sig.canvas : { w: el.clientWidth, h: el.clientHeight };
    const at = toCanvas(e, canvas);
    liveRef.current = { points: [{ ...at, t: 0 }], start: e.timeStamp, canvas };
    setDrawing(true);
    setRestore(null);
    rt.haptic("soft", el);
    paint();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current;
    if (!live) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const at = toCanvas(ev, live.canvas);
      const last = live.points[live.points.length - 1];
      if (Math.hypot(at.x - last.x, at.y - last.y) < 0.75) continue;
      live.points.push({ ...at, t: Math.max((ev.timeStamp - live.start) / 1000, last.t) });
    }
    paint();
  };

  const onPointerUp = () => {
    const live = liveRef.current;
    if (!live) return;
    liveRef.current = null;
    setDrawing(false);
    setSig((prev) => ({ strokes: [...prev.strokes, live.points], canvas: prev.strokes.length && prev.canvas ? prev.canvas : live.canvas }));
  };

  const canUndo = !typing && (sig.strokes.length > 0 || (restore !== null && restore.after === sig));
  const canClear = typing ? Boolean(typed) : sig.strokes.length > 0;

  const undo = () => {
    if (sig.strokes.length) {
      setFading([sig.strokes[sig.strokes.length - 1]]);
      setSig({ ...sig, strokes: sig.strokes.slice(0, -1) });
      rt.haptic("rigid", canvasRef.current);
    } else if (restore && restore.after === sig) {
      setSig(restore.before);
      setRestore(null);
      rt.haptic("rigid", canvasRef.current);
    }
  };

  const clear = () => {
    if (typing) {
      setTyped("");
    } else {
      const after = { ...sig, strokes: [] };
      setFading(sig.strokes);
      setRestore({ before: sig, after });
      setSig(after);
    }
    rt.haptic("medium", canvasRef.current);
  };

  const toggle = () => {
    setRestore(null);
    if (typing) setTyped(null);
    else {
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const showsHint = !typing && sig.strokes.length === 0 && !drawing;
  // Counts as signed like Swift's `isEmpty`: a typed name, or ink at least 12% of the pad's width long.
  const inkLength = sig.strokes.reduce((sum, st) => sum + st.reduce((l, pt, i) => (i ? l + Math.hypot(pt.x - st[i - 1].x, pt.y - st[i - 1].y) : 0), 0), 0);
  const signed = typing ? Boolean((typed ?? "").trim()) : Boolean(sig.canvas) && inkLength >= 0.12 * (sig.canvas?.w ?? Infinity);
  // Signed shows once the signing is done, as in Swift: it counts, no stroke is being drawn, and nothing
  // has changed for a moment. A new stroke or keystroke hides it until the pad is still again.
  const [showsSigned, setShowsSigned] = useState(false);
  useEffect(() => {
    if (!signed || drawing) { setShowsSigned(false); return; }
    const t = setTimeout(() => setShowsSigned(true), 650);
    return () => clearTimeout(t);
  }, [signed, drawing, typed]);
  const wasSigned = useRef(showsSigned);
  useEffect(() => {
    if (showsSigned && !wasSigned.current) rt.haptic("success", padRef.current);
    wasSigned.current = showsSigned;
  }, [showsSigned, rt]);
  const fadeLayer = fading ? <FadeLayer strokes={fading} line={line} canvas={sig.canvas} /> : null;

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 4, color: houseVar("text"), opacity: disabled ? 0.45 : 1, minWidth: 240 }}>
      <div ref={padRef} style={{ position: "relative", height, borderRadius: cr(26) as string, background: houseVar("surface"), overflow: "hidden" }}>
        <div style={{ position: "absolute", left: INSET, right: INSET, bottom: 0, height: BASELINE_ROOM, borderTop: "1.5px solid color-mix(in srgb, var(--h-muted) 32%, transparent)" }}>
          <span style={{ display: "block", paddingTop: 8, fontSize: ts(13), fontWeight: fw(500), color: houseVar("muted"), opacity: showsHint ? 1 : 0, transform: showsHint ? "none" : "translateY(4px)", transition: "opacity .25s, transform .25s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {s(p, "prompt") || "Sign here"}
          </span>
        </div>
        <div style={{ position: "absolute", left: INSET, right: INSET, bottom: BASELINE_ROOM + 1, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <span style={{ paddingBottom: 9, color: ACCENT, lineHeight: 0 }}>
            <Glyph d="M6 6l12 12M18 6L6 18" size={13} width={3.4} />
          </span>
          {typing ? (
            <input
              ref={inputRef}
              value={typed ?? ""}
              disabled={disabled}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your name"
              aria-label="Signature, typed name"
              autoComplete="name"
              spellCheck={false}
              className="spu-signature-input"
              style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: houseVar("text"), fontFamily: SCRIPT, fontSize: nameFontSize(typed || "Type your name", padWidth, height), fontWeight: 700, padding: "0 0 2px", marginBottom: -4 }}
            />
          ) : null}
          <style>{".spu-signature-input::placeholder{color:var(--h-muted);opacity:.7}"}</style>
        </div>
        {!typing ? (
          <>
            {fadeLayer}
            <canvas
              ref={canvasRef}
              aria-label="Signature"
              role="img"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: houseVar("text"), touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
            />
          </>
        ) : null}
        <span
          aria-hidden
          style={{
            position: "absolute", top: 14, right: 14, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999,
            background: house.blocks.sage, color: house.ink, fontSize: ts(12), fontWeight: fw(600), pointerEvents: "none",
            opacity: showsSigned ? 1 : 0, transform: showsSigned ? "none" : "scale(0.6)", transformOrigin: "100% 0%", transition: `opacity .25s, transform .4s ${BOUNCE}`,
          }}
        >
          <Glyph d="M5 12.5l4.5 4.5L19 7.5" size={11} width={3.4} />
          Signed
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", paddingInline: INSET - 12 }}>
        {allowsTyping ? (
          <TextButton onClick={toggle} disabled={disabled}>
            <Glyph d={typing ? SIGN : KEYBOARD} size={18} width={1.8} />
            {typing ? "Draw instead" : "Type instead"}
          </TextButton>
        ) : null}
        <span style={{ flex: 1 }} />
        {!typing ? (
          <TextButton onClick={undo} disabled={disabled || !canUndo} label="Undo" pill>
            <Glyph d={UNDO} size={18} width={2.6} />
          </TextButton>
        ) : null}
        <TextButton onClick={clear} disabled={disabled || !canClear} pill>Clear</TextButton>
      </div>
    </Root>
  );
};

/** The strokes Undo or Clear just removed, fading out over the pad. */
function FadeLayer({ strokes, line, canvas }: { strokes: Pt[][]; line: number; canvas: { w: number; h: number } | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = (window.devicePixelRatio || 1) * 2;
    el.width = Math.round(el.clientWidth * dpr);
    el.height = Math.round(el.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = fit(canvas, el.clientWidth, el.clientHeight);
    const ink = getComputedStyle(el).color;
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) drawStroke(ctx, stroke, line, t.scale, t.dx, t.dy);
    const id = requestAnimationFrame(() => setGone(true));
    return () => cancelAnimationFrame(id);
  }, [strokes, line, canvas]);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: houseVar("text"), pointerEvents: "none", opacity: gone ? 0 : 1, transition: "opacity .26s ease-out" }} />;
}

export const renderer: Renderer = SignaturePad;
