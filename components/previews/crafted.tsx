"use client";
// The eight crafted pieces: Scroll Island, Step Trail, Waveform Scrub, Image Compare, Now Playing,
// Wallet Stack, Notice Stack and Range Lens. Each one is a liquid glass interaction on the docs stage,
// the same gestures the Swift piece takes, sized in container units so it scales from a grid card to the header.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { reduced } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const UNIT = "0.19cqw";

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600 }}>
      <div aria-hidden style={{ position: "absolute", width: p(220), height: p(220), borderRadius: "50%", background: blocks.butter, right: p(-20), top: p(10) }} />
      <div aria-hidden style={{ position: "absolute", width: p(180), height: p(180), borderRadius: "50%", background: blocks.sky, left: p(-30), bottom: p(20) }} />
      <div aria-hidden style={{ position: "absolute", width: p(240), height: p(70), borderRadius: p(40), background: blocks.sage, left: p(40), top: p(150), transform: "rotate(-8deg)" }} />
      {children}
    </div>
  );
}

function usePaused(ms: number, tick: () => void, hold: boolean) {
  useEffect(() => {
    if (hold || reduced()) return;
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  }, [hold, ms, tick]);
}

export function ScrollIslandPreview() {
  const stops = [
    { title: "Arrive", detail: "Kansai, 14:20 · pocket Wi-Fi" },
    { title: "Fushimi", detail: "Day 2 · torii at dusk" },
    { title: "Arashiyama", detail: "Day 3 · 2.4 km along the river" },
    { title: "Nara", detail: "Day 4 · park before noon" },
  ];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [holding, setHolding] = useState(false);
  usePaused(2400, () => setIndex((i) => (i + 1) % stops.length), holding || open);
  const stop = stops[index] ?? stops[0];
  const onDown = (e: PointerEvent) => {
    setHolding(true);
    drag.current = { x: e.clientX, start: index };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = Math.min(stops.length - 1, Math.max(0, Math.round(d.start + (e.clientX - d.x) / 48)));
    setIndex(next);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setHolding(false);
    if (d && Math.abs(e.clientX - d.x) < 8) setOpen((v) => !v);
  };
  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LiquidGroup unit={UNIT} axis="y" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: p(liquid.joined) }}>
          <button type="button" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ border: 0, background: "transparent", padding: 0, color: "inherit", cursor: "grab", textAlign: "left" }}>
            <Liquid radius="capsule" style={{ minWidth: p(168), maxWidth: p(280), padding: `${p(open ? 14 : 11)} ${p(16)}`, display: "flex", flexDirection: "column", gap: p(2) }}>
              <MorphText text={stop.title} style={{ fontSize: p(15) }} />
              {open ? <span style={{ fontSize: p(12), color: ground.muted, maxWidth: p(240) }}>{stop.detail}</span> : null}
            </Liquid>
          </button>
          {open ? (
            <Liquid radius="capsule" tint={signal.fill} bud={{ out: true, rest: [0, 8], home: [0, -20] }} style={{ padding: `${p(8)} ${p(16)}`, color: ink, fontSize: p(15) }}>
              <BudContent out>Open</BudContent>
            </Liquid>
          ) : null}
        </LiquidGroup>
      </div>
    </Stage>
  );
}

export function StepTrailPreview() {
  const steps = [
    { title: "Pack", detail: "Two days, one bag, the red jacket on top." },
    { title: "Train", detail: "Platform 4, the slow one that hugs the coast." },
    { title: "Walk", detail: "Down through the pines before the light goes." },
    { title: "Stay", detail: "A room over the water and the windows open." },
  ];
  const [index, setIndex] = useState(0);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const step = steps[index] ?? steps[0];
  const between = 0;
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, start: index };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setIndex(Math.min(steps.length - 1, Math.max(0, Math.round(d.start + (e.clientX - d.x) / 70))));
  };
  return (
    <Stage>
      <div style={{ position: "absolute", left: p(28), right: p(28), top: p(70), display: "flex", flexDirection: "column", gap: p(22) }}>
        <div>
          <MorphText text={step.title} style={{ fontSize: p(20) }} />
          <div style={{ marginTop: p(6), fontSize: p(15), color: ground.muted }}>{step.detail}</div>
        </div>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} style={{ position: "relative", height: p(44), cursor: "grab" }}>
          <LiquidGroup unit={UNIT} style={{ position: "absolute", inset: 0 }}>
            <div style={{ display: "flex", height: "100%" }}>
              {steps.map((s, i) => (
                <div key={s.title} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Liquid radius="capsule" style={{ width: p(14), height: p(14) }} />
                </div>
              ))}
            </div>
            <Liquid radius="capsule" tint={signal.fill} style={{ position: "absolute", top: p(4), height: p(36), width: `calc(${100 / steps.length}% + ${p(between)})`, left: `${(index / steps.length) * 100}%`, display: "flex", alignItems: "center", justifyContent: "center", color: ink, fontSize: p(12), transition: reduced() ? "none" : "left .32s cubic-bezier(.22,1,.36,1)" }}>
              {step.title}
            </Liquid>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

const WAVE = [0.15, 0.22, 0.4, 0.85, 0.55, 0.3, 0.7, 0.95, 0.6, 0.25, 0.45, 0.88, 0.5, 0.2, 0.35, 0.72, 0.4, 0.18, 0.62, 0.9, 0.48, 0.22, 0.3, 0.55];

export function WaveformScrubPreview() {
  const [progress, setProgress] = useState(0.18);
  const [playing, setPlaying] = useState(true);
  const [drag, setDrag] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playing || drag) return;
    const id = window.setInterval(() => setProgress((v) => (v + 0.008 >= 1 ? 0 : v + 0.008)), 40);
    return () => window.clearInterval(id);
  }, [playing, drag]);
  const at = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    setProgress(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  const clock = `${Math.floor(progress * 18 / 60)}:${String(Math.floor((progress * 18) % 60)).padStart(2, "0")}`;
  return (
    <Stage>
      <div style={{ position: "absolute", left: p(24), right: p(24), top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: p(liquid.apart) }}>
        <LiquidGroup unit={UNIT} style={{ display: "flex", alignItems: "center", gap: p(liquid.apart), width: "100%" }}>
          <div
            ref={track}
            onPointerDown={(e) => { setDrag(true); at(e.clientX); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (drag) at(e.clientX); }}
            onPointerUp={() => setDrag(false)}
            style={{ position: "relative", flex: 1, height: p(56), cursor: "grab" }}
          >
            <Liquid radius="capsule" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: p(2), padding: `0 ${p(14)}` }}>
              {WAVE.map((sample, i) => (
                <span key={i} style={{ flex: 1, height: `${Math.max(12, sample * 70)}%`, borderRadius: p(2), background: i / WAVE.length <= progress ? ground.text : ground.muted }} />
              ))}
            </Liquid>
            <Liquid radius="capsule" tint={signal.fill} style={{ position: "absolute", top: p(11), width: p(34), height: p(34), left: `calc(${progress * 100}% - ${p(17)})`, transform: drag ? "scale(1.08)" : undefined }} />
            {drag ? (
              <Liquid radius="capsule" bud={{ out: true, rest: [0, -28], home: [0, 8] }} style={{ position: "absolute", top: 0, left: `calc(${progress * 100}% - ${p(28)})`, height: p(26), padding: `0 ${p(8)}`, display: "flex", alignItems: "center", fontSize: p(12) }}>
                <BudContent out>{clock}</BudContent>
              </Liquid>
            ) : null}
          </div>
          <button type="button" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pause" : "Play"} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}>
            <Liquid radius="capsule" tint={playing ? signal.fill : undefined} style={{ width: p(52), height: p(52), display: "grid", placeItems: "center", color: playing ? ink : "inherit", fontSize: p(16) }}>
              {playing ? "II" : "▶"}
            </Liquid>
          </button>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

export function ImageComparePreview() {
  const [split, setSplit] = useState(0.62);
  const [drag, setDrag] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  usePaused(2200, () => setSplit((s) => (s > 0.5 ? 0.28 : 0.72)), drag);
  const at = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    setSplit(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  return (
    <Stage>
      <div
        ref={frame}
        onPointerDown={(e) => { setDrag(true); at(e.clientX); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag) at(e.clientX); }}
        onPointerUp={() => setDrag(false)}
        style={{ position: "absolute", left: p(36), right: p(36), top: p(28), bottom: p(28), borderRadius: p(28), overflow: "hidden", cursor: "ew-resize" }}
      >
        <div style={{ position: "absolute", inset: 0, background: "#73b8f2" }}>
          <div style={{ position: "absolute", width: p(90), height: p(90), borderRadius: "50%", background: "#ffd966", right: p(40), top: p(36) }} />
        </div>
        <div style={{ position: "absolute", inset: 0, width: `${split * 100}%`, overflow: "hidden", background: "#2e385f" }}>
          <div style={{ position: "absolute", width: p(80), height: p(80), borderRadius: "50%", background: "#ff8c59", left: p(36), top: p(48) }} />
        </div>
        <LiquidGroup unit={UNIT} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Liquid radius={18} style={{ position: "absolute", top: "50%", left: `calc(${split * 100}% - ${p(18)})`, width: p(36), height: p(72), transform: "translateY(-50%)" }} />
          {drag ? (
            <Liquid radius="capsule" bud={{ out: true, rest: [46, 0], home: [0, 0] }} style={{ position: "absolute", top: "50%", left: `${split * 100}%`, height: p(28), padding: `0 ${p(8)}`, display: "flex", alignItems: "center", fontSize: p(12), transform: "translateY(-50%)" }}>
              <BudContent out>{Math.round(split * 100)}%</BudContent>
            </Liquid>
          ) : null}
        </LiquidGroup>
        <span style={{ position: "absolute", left: p(12), bottom: p(12), fontSize: p(12) }}>Before</span>
        <span style={{ position: "absolute", right: p(12), bottom: p(12), fontSize: p(12) }}>After</span>
      </div>
    </Stage>
  );
}

export function NowPlayingPreview() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0.32);
  const drag = useRef<{ y: number; start: number } | null>(null);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setProgress((v) => (v + 0.01 >= 1 ? 0 : v + 0.01)), 80);
    return () => window.clearInterval(id);
  }, [playing]);
  const amount = open ? 1 : 0;
  return (
    <Stage>
      <div style={{ position: "absolute", left: p(28), right: p(28), bottom: p(36) }}>
        <LiquidGroup unit={UNIT} axis="both">
          <div
            onPointerDown={(e) => { drag.current = { y: e.clientY, start: amount }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              if (!d) return;
              if (d.start - (e.clientY - d.y) / 120 > 0.5) setOpen(true);
              else if ((e.clientY - d.y) > 24) setOpen(false);
            }}
            style={{ cursor: "grab" }}
          >
            <Liquid radius={28} style={{ padding: p(16), minHeight: p(84 + amount * 120), display: "flex", flexDirection: "column", gap: p(12) }}>
              <div style={{ display: "flex", gap: p(12), alignItems: "center" }}>
                <div style={{ width: p(44 + amount * 28), height: p(44 + amount * 28), borderRadius: p(14), background: "#ff3b30", display: "grid", placeItems: "center", color: ink, fontSize: p(16) }}>☀</div>
                <div>
                  <div style={{ fontSize: p(15) }}>Slow mornings</div>
                  {open ? <div style={{ fontSize: p(12), color: ground.muted }}>House palette</div> : null}
                </div>
              </div>
              {open ? (
                <div style={{ height: p(6), borderRadius: p(6), background: ground.muted, overflow: "hidden" }}>
                  <div style={{ width: `${progress * 100}%`, height: "100%", background: signal.fill }} />
                </div>
              ) : null}
            </Liquid>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: p(liquid.joined), marginTop: p(-36) }}>
            {open ? <Liquid radius="capsule" bud={{ out: true, rest: [-28, 0], home: [20, 0] }} style={{ width: p(44), height: p(44), display: "grid", placeItems: "center" }}>‹</Liquid> : null}
            <button type="button" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pause" : "Play"} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}>
              <Liquid radius="capsule" tint={playing ? signal.fill : undefined} style={{ width: p(52), height: p(52), display: "grid", placeItems: "center", color: playing ? ink : "inherit" }}>{playing ? "II" : "▶"}</Liquid>
            </button>
            {open ? <Liquid radius="capsule" bud={{ out: true, rest: [28, 0], home: [-20, 0] }} style={{ width: p(44), height: p(44), display: "grid", placeItems: "center" }}>›</Liquid> : null}
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

const PASSES = [
  { name: "Rail pass", detail: "Kansai · 7 days", tint: blocks.butter },
  { name: "Ferry", detail: "Miyajima, noon", tint: blocks.sky },
  { name: "Inn", detail: "Two nights, river side", tint: blocks.sage },
  { name: "Museum", detail: "Timed entry, 16:00", tint: blocks.lilac },
];

export function WalletStackPreview() {
  const [spread, setSpread] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const drag = useRef<{ y: number; start: number } | null>(null);
  return (
    <Stage>
      <div
        onPointerDown={(e) => { drag.current = { y: e.clientY, start: spread }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setSpread(Math.min(1, Math.max(0, d.start - (e.clientY - d.y) / 120)));
        }}
        onPointerUp={() => { setSpread((s) => (s > 0.5 ? 1 : 0)); drag.current = null; if (spread < 0.5) setPicked(null); }}
        style={{ position: "absolute", left: p(28), right: p(28), top: p(36), height: p(96 + spread * 62 * 3 + 40), cursor: "grab" }}
      >
        <LiquidGroup unit={UNIT} merge={spread > 0.45 ? liquid.apart : liquid.merge} axis="y" style={{ position: "relative", height: "100%" }}>
          {PASSES.map((card, i) => (
            <button key={card.name} type="button" onClick={() => { if (spread > 0.5) setPicked((p) => (p === i ? null : i)); }} style={{ position: "absolute", left: 0, right: 0, top: p(i * (14 + spread * 62) - (picked === i ? 22 : 0)), border: 0, background: "transparent", padding: 0, textAlign: "left", color: ink, cursor: "pointer", transition: reduced() ? "none" : "top .42s cubic-bezier(.22,1,.36,1)" }}>
              <Liquid radius={22} tint={card.tint} style={{ minHeight: p(88), padding: `${p(16)} ${p(16)}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: p(15) }}>{card.name}</div>
                <div style={{ fontSize: p(12), opacity: 0.7 }}>{card.detail}</div>
              </Liquid>
            </button>
          ))}
        </LiquidGroup>
      </div>
    </Stage>
  );
}

const NOTICES = [
  { title: "Gate changed", message: "Boarding is now B12, ten minutes earlier." },
  { title: "Rain at four", message: "The river walk is still fine if you leave now." },
  { title: "Table held", message: "Under the lanterns, for two, at 19:30." },
];

export function NoticeStackPreview() {
  const [items, setItems] = useState(NOTICES);
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(0);
  const origin = useRef<number | null>(null);
  useEffect(() => {
    if (items.length > 0) return;
    const id = window.setTimeout(() => { setItems(NOTICES); setExpanded(false); }, 900);
    return () => window.clearTimeout(id);
  }, [items.length]);
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <Stage>
      <div style={{ position: "absolute", left: p(28), right: p(28), top: p(28) }}>
        <LiquidGroup unit={UNIT} merge={expanded ? liquid.apart : liquid.merge} axis="y" style={{ position: "relative", height: p(expanded ? visible.length * 86 : 78 + Math.max(visible.length - 1, 0) * 12) }}>
          {visible.map((notice, i) => (
            <button
              key={notice.title}
              type="button"
              onClick={() => { if (Math.abs(drag) < 8) setExpanded((v) => !v); }}
              onPointerDown={(e) => { origin.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (origin.current != null && (i === 0 || expanded)) setDrag(e.clientX - origin.current); }}
              onPointerUp={() => {
                if (Math.abs(drag) > 70) setItems((list) => list.filter((n) => n.title !== notice.title));
                setDrag(0);
                origin.current = null;
              }}
              style={{ position: "absolute", left: 0, right: 0, top: p(expanded ? i * 86 : i * 12), border: 0, background: "transparent", padding: 0, textAlign: "left", color: "inherit", transform: `translateX(${i === 0 || expanded ? drag : 0}px)`, cursor: "grab" }}
            >
              <Liquid radius={22} style={{ minHeight: p(74), padding: p(14) }}>
                <div style={{ fontSize: p(15) }}>{notice.title}</div>
                <div style={{ fontSize: p(12), color: ground.muted }}>{notice.message}</div>
              </Liquid>
            </button>
          ))}
        </LiquidGroup>
      </div>
    </Stage>
  );
}

const SERIES = [0.2, 0.35, 0.55, 0.4, 0.7, 0.9, 0.6, 0.45, 0.8, 0.5, 0.3, 0.65, 0.85, 0.4, 0.25, 0.55, 0.75, 0.95, 0.6, 0.35, 0.5, 0.7, 0.4, 0.3, 0.6];

export function RangeLensPreview() {
  const [lower, setLower] = useState(0.22);
  const [upper, setUpper] = useState(0.68);
  const [drag, setDrag] = useState<"move" | "leading" | "trailing" | null>(null);
  const origin = useRef({ x: 0, lower: 0.22, upper: 0.68 });
  const frame = useRef<HTMLDivElement>(null);
  const avg = (() => {
    const a = Math.round(lower * (SERIES.length - 1));
    const b = Math.max(a, Math.round(upper * (SERIES.length - 1)));
    const slice = SERIES.slice(a, b + 1);
    return Math.round((slice.reduce((s, n) => s + n, 0) / slice.length) * 100);
  })();
  const onDown = (e: PointerEvent) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width;
    const mode = Math.abs(x - lower) < 0.08 ? "leading" : Math.abs(x - upper) < 0.08 ? "trailing" : "move";
    setDrag(mode);
    origin.current = { x: e.clientX, lower, upper };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    const delta = (e.clientX - origin.current.x) / r.width;
    if (drag === "move") {
      const span = origin.current.upper - origin.current.lower;
      const start = Math.min(Math.max(origin.current.lower + delta, 0), 1 - span);
      setLower(start);
      setUpper(start + span);
    } else if (drag === "leading") {
      setLower(Math.min(Math.max(origin.current.lower + delta, 0), origin.current.upper - 0.08));
    } else {
      setUpper(Math.max(Math.min(origin.current.upper + delta, 1), origin.current.lower + 0.08));
    }
  };
  return (
    <Stage>
      <div style={{ position: "absolute", left: p(24), right: p(24), top: p(48) }}>
        <div style={{ fontSize: p(12), marginBottom: p(8) }}>{avg} average · {Math.round(lower * 100)} to {Math.round(upper * 100)}</div>
        <div ref={frame} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => setDrag(null)} style={{ position: "relative", height: p(148), cursor: "ew-resize" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: p(3) }}>
            {SERIES.map((sample, i) => {
              const t = i / (SERIES.length - 1);
              const inside = t >= lower && t <= upper;
              return <span key={i} style={{ flex: 1, height: `${Math.max(8, sample * 88)}%`, borderRadius: p(3), background: inside ? ground.text : ground.muted }} />;
            })}
          </div>
          <LiquidGroup unit={UNIT} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <Liquid radius={18} tint="rgba(255,0,0,.35)" style={{ position: "absolute", top: p(8), bottom: p(4), left: `${lower * 100}%`, width: `${(upper - lower) * 100}%` }} />
            {drag ? (
              <Liquid radius="capsule" bud={{ out: true, rest: [0, -18], home: [0, 16] }} style={{ position: "absolute", left: `${((lower + upper) / 2) * 100}%`, top: 0, transform: "translateX(-50%)", height: p(26), padding: `0 ${p(8)}`, display: "flex", alignItems: "center", fontSize: p(12), color: ink }}>
                <BudContent out>{avg}</BudContent>
              </Liquid>
            ) : null}
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}
