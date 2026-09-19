"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/* Glass: GlassSurface, GlassActionMenu, GlassSegments. Each preview shows the component and nothing
   else, sized in container units so it scales from the grid card to the docs header. The stage is
   4:3, so 100cqw wide and 75cqw tall; 1 iOS point is 0.19cqw. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const springEase = "cubic-bezier(0.34, 1.3, 0.64, 1)";
const smooth = "cubic-bezier(0.22, 1, 0.36, 1)";
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

/** Liquid Glass stand-in: backdrop blur and lift, a faint fill, a bright top rim fading down. */
const glassLook: CSSProperties = {
  background: "rgba(40,40,40,.28)",
  backdropFilter: "blur(10px) saturate(1.4) brightness(1.05)",
  WebkitBackdropFilter: "blur(10px) saturate(1.4) brightness(1.05)",
  boxShadow: `inset 0 ${p(1)} 0 rgba(255,255,255,.5), inset 0 ${p(-1)} 0 rgba(255,255,255,.12), 0 ${p(8)} ${p(16)} rgba(0,0,0,.14)`,
};

function Glyph({ d, size, fill = false, stroke = 2.4 }: { d: string; size: number; fill?: boolean; stroke?: number }) {
  return <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(size), height: p(size), flexShrink: 0 }} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const G = {
  prev: "M14.5 5.5 8 12l6.5 6.5",
  next: "M9.5 5.5 16 12l-6.5 6.5",
  play: "M8 5.5v13l10.5-6.5z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  camera: "M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
};

// MARK: Glass Surface

/** The blocks the glass floats on, in stage points (400 x 300), drifting so the refraction moves. */
function Cover({ t }: { t: number }) {
  const drift = Math.sin(t * 0.45);
  return (
    <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <rect width="400" height="300" fill={blocks.lilac} />
      <circle cx={200 + 96 + drift * 34} cy={76 + Math.cos(t * 0.3) * 16} r="115" fill={blocks.butter} />
      <rect x={200 - 94 - drift * 26 - 125} y={169} width="250" height="170" rx="34" fill={blocks.sage} transform={`rotate(-8 ${200 - 94 - drift * 26} 254)`} />
      <rect x={200 + 46 - drift * 44 - 150} y={203} width="300" height="50" rx="25" fill={blocks.sky} />
    </svg>
  );
}

/** The component alone: three surfaces floating on full-bleed color blocks, so the glass has something to refract. Each surface takes a press in turn: scale, brighten, spring back. */
export function GlassSurfacePreview() {
  const [pressed, setPressed] = useState(-1);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { setT(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    let i = 0, up = 0;
    const order = [1, 0, 2, 1];
    const t2 = setInterval(() => {
      setPressed(order[i++ % order.length]);
      up = window.setTimeout(() => setPressed(-1), 260);
    }, 1400);
    return () => { clearInterval(t2); clearTimeout(up); };
  }, []);
  const surface = (i: number, extra: CSSProperties): CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", height: p(76), borderRadius: 999, position: "relative", overflow: "hidden",
    transform: pressed === i ? "scale(.96)" : "scale(1)", transition: `transform ${pressed === i ? ".16s ease-out" : `.4s ${springEase}`}`, ...extra,
  });
  const brighten = (i: number) => <span aria-hidden className="absolute inset-0" style={{ background: "#fff", opacity: pressed === i ? 0.18 : 0, transition: "opacity .25s" }} />;
  return (
    <Stage>
      <Cover t={t} />
      <div className="relative flex items-center" style={{ gap: p(12), color: ink }}>
        <span data-motion style={surface(0, { ...glassLook, width: p(76) })}>{brighten(0)}<Glyph d={G.prev} size={28} /></span>
        <span data-motion style={surface(1, { width: p(190), background: blocks.tangerine, boxShadow: `inset 0 ${p(1)} 0 rgba(255,255,255,.45), 0 ${p(8)} ${p(16)} rgba(0,0,0,.14)` })}>
          {brighten(1)}
          <Glyph d={G.play} size={30} fill />
        </span>
        <span data-motion style={surface(2, { ...glassLook, width: p(76) })}>{brighten(2)}<Glyph d={G.next} size={28} /></span>
      </div>
    </Stage>
  );
}

// MARK: Glass Action Menu

const ITEMS = [
  { label: "Note", icon: G.pencil, fill: blocks.butter },
  { label: "Voice memo", icon: G.mic, fill: blocks.lilac },
  { label: "Photo", icon: G.camera, fill: blocks.sky },
];

/**
 * The component alone, in the Swift `.arc` arrangement, anchored in the corner of the stage. Loop: a hold dips
 * the signal trigger, the items emerge with a 45 ms stagger, labels land last, the finger slides across
 * Photo and Voice memo (lift 1.12) and releases on Voice memo (1.2), the menu collapses in reverse and
 * the trigger confirms with a check.
 */
export function GlassActionMenuPreview() {
  const [pressed, setPressed] = useState(false), [open, setOpen] = useState(false), [labels, setLabels] = useState(false);
  const [hover, setHover] = useState(-1), [fire, setFire] = useState(false), [check, setCheck] = useState(false);
  useEffect(() => {
    const steps: [number, () => void][] = [
      [900, () => setPressed(true)], [1250, () => setOpen(true)], [1650, () => setLabels(true)],
      [2400, () => setHover(2)], [2850, () => setHover(1)], [3300, () => { setFire(true); setPressed(false); }],
      [3450, () => { setFire(false); setHover(-1); setLabels(false); setOpen(false); setCheck(true); }], [4400, () => setCheck(false)],
    ];
    let timers: number[] = [];
    const run = () => { timers = steps.map(([t, fn]) => window.setTimeout(fn, t)); };
    run(); const loop = setInterval(run, 5600);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []);
  // Arc geometry from the Swift piece: 60pt trigger, 52pt items, 12pt gaps, radius grown so neighbours keep 12pt apart.
  const TRIGGER = 60, ITEM = 52, reach = TRIGGER / 2 + 12 + ITEM / 2, radius = Math.max(reach + 28, (ITEM + 12) / 2 / Math.sin(Math.PI / 8));
  return (
    <Stage style={{ justifyContent: "stretch", alignItems: "stretch" }}>
      <div className="relative flex-1">
        <div aria-hidden className="absolute inset-0" style={{ background: "#000", opacity: open ? 0.28 : 0, transition: "opacity .3s" }} />

        <div className="absolute" style={{ right: p(34), bottom: p(30), width: p(TRIGGER), height: p(TRIGGER) }}>
          {ITEMS.map((item, i) => {
            const a = Math.PI / 2 + ((Math.PI / 2) * i) / (ITEMS.length - 1), x = Math.cos(a) * radius, y = -Math.sin(a) * radius;
            const lifted = hover === i, scale = fire && lifted ? 1.2 : lifted ? 1.12 : 1;
            const above = i === 0;
            return (
              <div key={item.label} data-motion className="absolute left-1/2 top-1/2" style={{
                width: p(ITEM), height: p(ITEM), marginLeft: p(-ITEM / 2), marginTop: p(-ITEM / 2), zIndex: lifted ? 2 : 1,
                transform: open ? `translate(${p(x)}, ${p(y)})` : "translate(0,0) scale(.5)", opacity: open ? 1 : 0,
                transition: `transform .5s ${springEase}, opacity .3s`, transitionDelay: `${(open ? i : ITEMS.length - 1 - i) * 45}ms`,
              }}>
                <span data-motion className="grid size-full place-items-center rounded-full" style={{ background: item.fill, color: ink, transform: `scale(${scale})`, transition: `transform .28s ${springEase}, box-shadow .28s`, boxShadow: `inset 0 ${p(1)} 0 rgba(255,255,255,.5), 0 ${p(lifted ? 8 : 3)} ${p(lifted ? 12 : 6)} rgba(0,0,0,${lifted ? 0.3 : 0.18})` }}>
                  <Glyph d={item.icon} size={21} />
                </span>
                <span data-motion className="absolute whitespace-nowrap rounded-full" style={{
                  ...(above ? { left: "50%", bottom: `calc(100% + ${p(8)})`, transform: `translate(-50%, ${labels ? "0" : p(6)})` } : { right: `calc(100% + ${p(10)})`, top: "50%", transform: `translate(${labels ? "0" : p(6)}, -50%)` }),
                  opacity: labels ? 1 : 0, transition: "opacity .25s, transform .25s", background: "#262626", color: ground.text,
                  padding: `${p(7)} ${p(12)}`, fontSize: p(15), fontWeight: 600, lineHeight: 1, boxShadow: `0 ${p(3)} ${p(8)} rgba(0,0,0,.2)`,
                }}>{item.label}</span>
              </div>
            );
          })}
          <span data-motion className="absolute inset-0 z-[3] grid place-items-center rounded-full" style={{ background: signal.fill, color: signal.on, transform: `scale(${pressed ? 0.92 : 1})`, transition: `transform .3s ${springEase}`, boxShadow: `inset 0 ${p(1)} 0 rgba(255,255,255,.45), 0 ${p(8)} ${p(14)} rgba(0,0,0,.3)` }}>
            <span data-motion style={{ display: "grid", transform: `rotate(${open && !check ? 45 : 0}deg) scale(${check ? 1.05 : 1})`, transition: `transform .4s ${springEase}` }}>
              <Glyph d={check ? G.check : G.plus} size={24} stroke={3} />
            </span>
          </span>
          {/* The finger: over the trigger while holding, then on the hovered item. */}
          <span aria-hidden data-motion className="pointer-events-none absolute left-1/2 top-1/2 z-[4] rounded-full" style={{
            width: p(40), height: p(40), marginLeft: p(-20), marginTop: p(-20), background: "radial-gradient(circle at 40% 36%, rgba(255,255,255,.55), rgba(255,255,255,.15) 64%)",
            opacity: pressed ? 1 : 0, transition: `opacity .2s, transform .4s ${smooth}`,
            transform: hover >= 0 ? `translate(${p(Math.cos(Math.PI / 2 + (Math.PI / 4) * hover) * radius)}, ${p(-Math.sin(Math.PI / 2 + (Math.PI / 4) * hover) * radius)})` : "none",
          }} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Glass Segments

const PERIODS = ["Day", "Week", "Month", "Year"];

/**
 * The component alone. Every 3.2 s a finger grabs the indicator (lift 1.04, deeper
 * shadow), drags it across, stretching with velocity and rubber-banding past the end, then lets go into
 * a bouncy settle; between drags a plain tap moves it back. The selected ink is a copy of the labels
 * clipped to the indicator, so the color hands over under its edge mid-drag.
 */
export function GlassSegmentsPreview() {
  const indicator = useRef<HTMLDivElement>(null), inked = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, start = performance.now();
    let raf = 0, x = 1.5, v = 0, from = 1.5, stretch = 0, wasDragging = false;
    const ease = (q: number) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
    const draw = (now: number) => {
      const t = Math.max(0, now - start) / 1000, cycle = Math.floor(t / 3.2), s = t - cycle * 3.2;
      // Even cycles drag Week to Year; odd cycles tap back to Week.
      const drag = cycle % 2 === 0, target = drag ? 3.5 : 1.5, dragging = drag && s >= 0.5 && s < 1.25 && !reduce;
      if (dragging && !wasDragging) from = x;
      let lift = 0;
      if (dragging) { const q = ease((s - 0.5) / 0.75), prev = x; x = from + (target + 0.18 - from) * q; stretch = Math.min(0.12, Math.abs(x - prev) * 0.9); lift = 1; }
      else if (s >= 0.5 || !drag) { v += (target - x) * 0.16; v *= 0.78; x += v; stretch *= 0.85; }
      wasDragging = dragging;
      const tf = `translateX(${(x - 0.5) * 100}%) scale(${1 + 0.04 * lift}) scaleX(${1 + stretch}) scaleY(${1 - stretch * 0.35})`;
      if (indicator.current) Object.assign(indicator.current.style, { transform: tf, boxShadow: lift ? `0 ${p(5)} ${p(10)} rgba(0,0,0,.35)` : `0 ${p(1)} ${p(3)} rgba(0,0,0,.2)` });
      if (inked.current) {
        const w = 25 * (1 + stretch) * (1 + 0.04 * lift), left = x * 25 - w / 2;
        inked.current.style.clipPath = `inset(0 ${clamp(100 - left - w, 0, 100)}% 0 ${clamp(left, 0, 100)}% round 999px)`;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const row = (color: string) => PERIODS.map((o) => <span key={o} className="flex flex-1 items-center justify-center" style={{ color, fontSize: p(16), fontWeight: 600 }}>{o}</span>);
  return (
    <Stage>
      <div className="relative rounded-full" style={{ width: p(400), height: p(50), padding: p(3), background: ground.raised }}>
        <div className="relative size-full">
          <div ref={indicator} data-motion className="absolute inset-y-0 left-0 rounded-full" style={{ width: "25%", background: "#3a3a3a", boxShadow: `inset 0 ${p(1)} 0 rgba(255,255,255,.14)` }} />
          <div aria-hidden className="absolute inset-0 flex">{row(ground.muted)}</div>
          <div ref={inked} data-motion className="absolute inset-0 flex">{row(ground.text)}</div>
        </div>
      </div>
    </Stage>
  );
}
