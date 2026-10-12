"use client";
// Playground previews for the eight crafted pieces. The gestures match the Swift: drag to scrub,
// fan, compare, or resize, and tap to open.
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { house } from "../../../core/palette.js";
import { fillStyle, useAxis, type Renderer, type RenderProps } from "../env.js";

const ink = "var(--ios-label, #141414)";
const muted = "var(--ios-secondary-label, #5c5a56)";
const card = "var(--spb-card, color-mix(in srgb, var(--ios-label, #141414) 8%, transparent))";

function Shell({ r, children, extra }: { r: RenderProps; children: ReactNode; extra?: CSSProperties }) {
  const axis = useAxis();
  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), color: ink, fontWeight: 600, ...extra }}>
      {children}
    </div>
  );
}

export const scrollIsland: Renderer = (r) => {
  const stops = ["Arrive", "Fushimi", "Arashiyama", "Nara"];
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <Shell r={r}>
    <button type="button" onClick={() => setOpen((v) => !v)} onPointerMove={(e) => { if (e.buttons) setI((n) => Math.min(stops.length - 1, Math.max(0, n + (e.movementX > 4 ? 1 : e.movementX < -4 ? -1 : 0)))); }} style={{ border: 0, background: card, color: "inherit", borderRadius: 999, padding: open ? "14px 16px" : "11px 16px", textAlign: "left", cursor: "grab", minWidth: 168 }}>
      <div>{stops[i]}</div>
      {open ? <div style={{ fontSize: 12, color: muted }}>Drag sideways, or tap to close</div> : null}
    </button>
    </Shell>
  );
};

export const stepTrail: Renderer = (r) => {
  const steps = [
    ["Pack", "Two days, one bag."],
    ["Train", "Platform 4, the slow one."],
    ["Walk", "Down through the pines."],
    ["Stay", "A room over the water."],
  ];
  const [i, setI] = useState(0);
  return (
    <Shell r={r}>
    <div>
      <div style={{ fontSize: 20 }}>{steps[i][0]}</div>
      <div style={{ color: muted, margin: "6px 0 16px" }}>{steps[i][1]}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {steps.map((step, n) => (
          <button key={step[0]} type="button" onClick={() => setI(n)} style={{ flex: 1, border: 0, borderRadius: 999, padding: "8px 0", background: n === i ? house.signal : card, color: n === i ? house.ink : ink, cursor: "pointer" }}>{step[0]}</button>
        ))}
      </div>
    </div>
    </Shell>
  );
};

const WAVE = [0.2, 0.5, 0.9, 0.4, 0.7, 0.3, 0.85, 0.45, 0.6, 0.25, 0.75, 0.5];

export const waveformScrub: Renderer = (r) => {
  const [progress, setProgress] = useState(0.3);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setProgress(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)));
  };
  return (
    <Shell r={r}>
    <div onPointerDown={at} onPointerMove={(e) => { if (e.buttons) at(e); }} style={{ display: "flex", alignItems: "center", gap: 3, height: 56, padding: "0 12px", borderRadius: 999, background: card, cursor: "ew-resize" }}>
      {WAVE.map((sample, i) => <span key={i} style={{ flex: 1, height: `${sample * 80}%`, borderRadius: 2, background: i / WAVE.length <= progress ? house.signal : muted }} />)}
    </div>
    </Shell>
  );
};

export const imageCompare: Renderer = (r) => {
  const [split, setSplit] = useState(0.62);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setSplit(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)));
  };
  return (
    <Shell r={r}>
    <div onPointerDown={at} onPointerMove={(e) => { if (e.buttons) at(e); }} style={{ position: "relative", height: 180, borderRadius: 22, overflow: "hidden", cursor: "ew-resize", background: house.blocks.sky }}>
      <div style={{ position: "absolute", inset: 0, width: `${split * 100}%`, background: house.blocks.lilac }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${split * 100}%`, width: 2, background: "#fff" }} />
    </div>
    </Shell>
  );
};

export const nowPlaying: Renderer = (r) => {
  const [open, setOpen] = useState(false);
  const title = String(r.p.title ?? "Slow mornings");
  const artist = String(r.p.artist ?? "House palette");
  return (
    <Shell r={r}>
    <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", border: 0, borderRadius: 28, padding: 16, background: card, color: "inherit", cursor: "pointer" }}>
      <div>{title}</div>
      {open ? <div style={{ color: muted, fontSize: 13, marginTop: 4 }}>{artist}</div> : null}
    </button>
    </Shell>
  );
};

const PASSES = [
  ["Rail pass", house.blocks.butter],
  ["Ferry", house.blocks.sky],
  ["Inn", house.blocks.sage],
  ["Museum", house.blocks.lilac],
] as const;

export const walletStack: Renderer = (r) => {
  const [spread, setSpread] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <Shell r={r}>
    <div onPointerDown={() => setSpread(true)} style={{ position: "relative", height: spread ? 280 : 140 }}>
      {PASSES.map(([name, tint], i) => (
        <button key={name} type="button" onClick={(e) => { e.stopPropagation(); if (spread) setPicked((p) => (p === i ? null : i)); }} style={{ position: "absolute", left: 0, right: 0, top: spread ? i * 64 - (picked === i ? 12 : 0) : i * 12, border: 0, borderRadius: 18, padding: "16px", background: tint, color: house.ink, textAlign: "left", cursor: "pointer" }}>{name}</button>
      ))}
    </div>
    </Shell>
  );
};

const NOTICES = [
  ["Gate changed", "Boarding is now B12."],
  ["Rain at four", "The river walk is still fine."],
  ["Table held", "Under the lanterns, for two."],
];

export const noticeStack: Renderer = (r) => {
  const [items, setItems] = useState(NOTICES);
  const [fan, setFan] = useState(false);
  const shown = fan ? items : items.slice(0, 3);
  return (
    <Shell r={r}>
    <div style={{ position: "relative", minHeight: fan ? shown.length * 72 : 96 }}>
      {shown.map((notice, i) => (
        <button key={notice[0]} type="button" onClick={() => setFan((v) => !v)} onDoubleClick={() => setItems((list) => list.filter((n) => n[0] !== notice[0]))} style={{ position: "absolute", left: 0, right: 0, top: fan ? i * 72 : i * 10, border: 0, borderRadius: 18, padding: 14, background: card, color: "inherit", textAlign: "left", cursor: "pointer" }}>
          <div>{notice[0]}</div>
          <div style={{ color: muted, fontSize: 12 }}>{notice[1]}</div>
        </button>
      ))}
      {items.length === 0 ? <button type="button" onClick={() => setItems(NOTICES)} style={{ border: 0, background: "transparent", color: muted, cursor: "pointer" }}>Restore notices</button> : null}
    </div>
    </Shell>
  );
};

const SERIES = [0.2, 0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8, 0.45, 0.65, 0.85, 0.4];

export const rangeLens: Renderer = (r) => {
  const [lower, setLower] = useState(0.2);
  const [upper, setUpper] = useState(0.7);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    if (Math.abs(x - lower) < Math.abs(x - upper)) setLower(Math.min(x, upper - 0.08));
    else setUpper(Math.max(x, lower + 0.08));
  };
  return (
    <Shell r={r}>
    <div onPointerDown={at} onPointerMove={(e) => { if (e.buttons) at(e); }} style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", gap: 3, cursor: "ew-resize" }}>
      {SERIES.map((sample, i) => {
        const t = i / (SERIES.length - 1);
        return <span key={i} style={{ flex: 1, height: `${sample * 100}%`, borderRadius: 3, background: t >= lower && t <= upper ? house.signal : muted }} />;
      })}
    </div>
    </Shell>
  );
};
