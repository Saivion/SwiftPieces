"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

/* Cards: FlipCard, ParallaxCard, MotionCard, SwipeDeck. Each preview draws the component and nothing
   else (FREE-V2.1): no captions, no headers, no buttons beside it. The stage is 4:3, so 100cqw wide
   and 75cqw tall; 1 iOS point is 0.19cqw. Each piece scales its own points so it fills the stage. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
/** Point helper scaled so the component fills the stage without redrawing it at new sizes. */
const units = (s: number) => (n: number) => p(n * s);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t: number) => { const x = clamp(t); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
/** Underdamped spring from 0 to 1 over a unit interval, like `.spring(bounce: 0.22)`. */
const spring = (t: number) => { const x = clamp(t); return x >= 1 ? 1 : 1 - Math.exp(-5.5 * x) * Math.cos(Math.PI * 1.1 * x); };

/** Calls `frame` with elapsed seconds on every animation frame, holding a rest pose under Reduce Motion. */
function useRaf(frame: (t: number) => void, rest = 0) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { frame(rest); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { frame(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

const meta = (u: (n: number) => string = p): CSSProperties => ({ fontSize: u(11), fontWeight: 700, letterSpacing: "0.09em", lineHeight: 1 });
const mono = (u: (n: number) => string = p): CSSProperties => ({ fontFamily: font.mono, fontSize: u(12), fontWeight: 600, lineHeight: 1 });
const display = (size: number, tracking: string = font.displayTracking, u: (n: number) => string = p): CSSProperties => ({ fontSize: u(size), fontWeight: font.displayWeight, letterSpacing: tracking, lineHeight: 1.02 });
const dim: CSSProperties = { opacity: 0.62 };

function Glyph({ d, size, fill = false, u = p }: { d: string; size: number; fill?: boolean; u?: (n: number) => string }) {
  return <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size) }} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const G = {
  x: "M6 6l12 12M18 6L6 18",
  heart: "M12 20.5S3 15.4 3 9a4.5 4.5 0 0 1 9-1.6A4.5 4.5 0 0 1 21 9c0 6.4-9 11.5-9 11.5z",
  bookmark: "M6 3h12v18l-6-4.5L6 21z",
  arrow: "M7 17L17 7M9 7h8v8",
};

// MARK: Flip Card

const flipU = units(1.42);

export function FlipCardPreview() {
  const u = flipU;
  const lift = useRef<HTMLDivElement>(null), front = useRef<HTMLDivElement>(null), back = useRef<HTMLDivElement>(null);
  useRaf((t) => {
    // 3.4 s per flip: rest, touch-down press, a spring flip that lifts mid-turn, rest. The angle accumulates.
    const n = Math.floor(t / 3.4), q = t - n * 3.4;
    const press = q < 1.2 ? 0 : q < 1.45 ? easeOut((q - 1.2) / 0.15) : 1 - easeOut((q - 1.45) / 0.2);
    const angle = n * 180 + 180 * spring((q - 1.45) / 0.8);
    const a = ((angle % 360) + 360) % 360, showsBack = a > 90 && a < 270;
    const edge = Math.sin((angle * Math.PI) / 180), turn = Math.abs(edge);
    if (lift.current) Object.assign(lift.current.style, {
      transform: `scale(${(1 + 0.06 * turn) * (1 - 0.03 * press)})`,
      filter: `drop-shadow(0 ${u(1)} ${u(2)} rgba(0,0,0,${0.42 * (1 - turn * 0.6)})) drop-shadow(${u(-edge * 18)} ${u(12 + turn * 10)} ${u(16 + turn * 18)} rgba(0,0,0,.42))`,
    });
    const face = (el: HTMLDivElement | null, isBack: boolean) => el && Object.assign(el.style, {
      transform: `perspective(${u(900)}) rotateY(${isBack ? angle - 180 : angle}deg)`,
      opacity: showsBack === isBack ? "1" : "0",
      filter: `brightness(${1 - turn * 0.16})`,
    });
    face(front.current, false); face(back.current, true);
  }, 0.5);
  const card: CSSProperties = { position: "absolute", inset: 0, borderRadius: u(26), padding: u(22), color: ink, display: "flex", flexDirection: "column", backfaceVisibility: "hidden" };
  return (
    <Stage>
      <div className="relative" style={{ width: u(300), height: u(200) }}>
        <div ref={lift} data-motion className="absolute inset-0">
          <div ref={front} data-motion style={{ ...card, background: blocks.butter }}>
            <div className="flex items-center justify-between"><span style={meta(u)}>PORTUGUESE</span><span style={mono(u)}>3 / 12</span></div>
            <span style={{ ...display(46, "-0.04em", u), marginTop: "auto" }}>Saudade</span>
            <span style={{ fontSize: u(15), fontWeight: 500, marginTop: u(6), ...dim }}>noun · sow-DAH-jee</span>
          </div>
          <div ref={back} data-motion style={{ ...card, background: blocks.sky, opacity: 0 }}>
            <span style={meta(u)}>MEANING</span>
            <span style={{ ...display(22, "-0.03em", u), marginTop: u(10), lineHeight: 1.12 }}>A deep longing for someone or something far away.</span>
            <span style={{ fontSize: u(15), fontWeight: 500, marginTop: "auto", ...dim }}>Often heard in fado songs</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Parallax Card

const WALKS = [
  { name: "Alfama at dusk", word: "ALFAMA", facts: ["3.2 km", "1 h 10 min"], sky: blocks.sky, sun: blocks.tangerine, caption: blocks.butter },
  { name: "River to Belém", word: "BELÉM", facts: ["6.8 km", "2 h"], sky: blocks.sage, sun: blocks.butter, caption: blocks.lilac },
  { name: "Graça viewpoints", word: "GRAÇA", facts: ["2.1 km", "45 min"], sky: blocks.lilac, sun: blocks.sky, caption: blocks.sand },
  { name: "Chiado bookshops", word: "CHIADO", facts: ["1.6 km", "40 min"], sky: blocks.tangerine, sun: blocks.sand, caption: blocks.sage },
];

const PARALLAX_SCALE = 1.28;
const parallaxU = units(PARALLAX_SCALE);

export function ParallaxCardPreview() {
  const u = parallaxU;
  const list = useRef<HTMLDivElement>(null);
  const H = 250, GAP = 14, TRAVEL = H * 0.25;
  useRaf((t) => {
    const el = list.current; if (!el?.parentElement) return;
    const unit = el.parentElement.clientWidth * 0.0019 * PARALLAX_SCALE; // px per iOS point
    const vh = el.parentElement.clientHeight / unit;
    const q = t % 7.2;
    // Scroll down to the third card, press it, scroll back up, rest.
    const s = q < 0.8 ? 0 : q < 3 ? easeInOut((q - 0.8) / 2.2) : q < 4.2 ? 1 : q < 6.4 ? 1 - easeInOut((q - 4.2) / 2.2) : 0;
    const press = q < 3.3 ? 0 : q < 3.45 ? easeOut((q - 3.3) / 0.15) : q < 3.7 ? 1 : 1 - spring((q - 3.7) / 0.45);
    const scroll = s * (2 * (H + GAP) + H / 2 - vh / 2);
    el.style.transform = `translateY(${-scroll * unit}px)`;
    Array.from(el.querySelectorAll<HTMLElement>("[data-walk]")).forEach((card, i) => {
      const mid = i * (H + GAP) + H / 2 - scroll;
      const progress = clamp((mid - vh / 2) / ((vh + H) / 2), -1, 1);
      const [art, cap] = Array.from(card.children) as HTMLElement[];
      art.style.transform = `translateY(${-progress * TRAVEL * unit}px)`;
      cap.style.transform = `translateY(${(-progress * TRAVEL * unit) / 3}px)`;
      const l = i === 2 ? press : 0;
      card.style.transform = `scale(${1 + 0.02 * l})`;
      card.style.boxShadow = `0 ${(10 + 6 * l) * unit}px ${(16 + 10 * l) * unit * 2}px rgba(0,0,0,${0.36 + 0.2 * l})`;
      const arrow = cap.querySelector<HTMLElement>("[data-arrow]");
      if (arrow) arrow.style.transform = `translate(${2 * l * unit}px, ${-2 * l * unit}px)`;
    });
  });
  return (
    <Stage style={{ justifyContent: "flex-start", alignItems: "stretch", overflow: "hidden", maskImage: "linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)" }}>
      <div ref={list} data-motion className="mx-auto flex flex-col" style={{ width: u(340), gap: u(GAP) }}>
        {WALKS.map((w, i) => (
          <div key={w.name} data-walk data-motion className="relative shrink-0 overflow-hidden" style={{ height: u(H), borderRadius: u(26) }}>
            <div data-motion aria-hidden className="absolute inset-x-0 overflow-hidden" style={{ top: u(-TRAVEL), height: u(H + TRAVEL * 2), background: w.sky }}>
              <span className="absolute rounded-full" style={{ width: u(190), height: u(190), left: u(186), top: u(36), background: w.sun }} />
              <span className="absolute whitespace-nowrap" style={{ left: u(-10), top: u(40), fontSize: u(128), fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: ink }}>{w.word}</span>
            </div>
            <div data-motion className="absolute inset-x-0 bottom-0" style={{ padding: u(10) }}>
              <div className="flex items-center" style={{ gap: u(12), padding: u(16), borderRadius: u(16), background: w.caption, color: ink }}>
                <div className="min-w-0 flex-1">
                  <p style={{ ...meta(u), ...dim }}>WALK 0{i + 1}</p>
                  <p style={{ ...display(22, "-0.03em", u), marginTop: u(4) }}>{w.name}</p>
                  <p className="flex items-center" style={{ gap: u(6), marginTop: u(4), fontSize: u(15), fontWeight: 500, ...dim }}>{w.facts[0]}<span className="rounded-full" style={{ width: u(3), height: u(3), background: ink }} />{w.facts[1]}</p>
                </div>
                <span className="grid shrink-0 place-items-center rounded-full" style={{ width: u(44), height: u(44), background: ink, color: w.caption }}><span data-arrow data-motion className="grid"><Glyph d={G.arrow} size={16} u={u} /></span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

// MARK: Motion Card

const motionU = units(1.3);

export function MotionCardPreview() {
  const u = motionU;
  const card = useRef<HTMLDivElement>(null), sheen = useRef<HTMLDivElement>(null);
  useRaf((t) => {
    // A slow attitude drift stands in for Core Motion; every 4 s the card is pressed, settles flatter, and springs back.
    const q = t % 4, press = q < 3 ? 0 : q < 3.12 ? (q - 3) / 0.12 : q < 3.35 ? 1 : 1 - spring((q - 3.35) / 0.4);
    const k = 1 - 0.5 * press;
    const tx = 0.45 * Math.sin(t * 0.9) * k, ty = -0.3 * Math.cos(t * 0.7) * k, mag = Math.min(Math.hypot(tx, ty), 1);
    if (card.current) Object.assign(card.current.style, {
      transform: `perspective(${u(700)}) rotateX(${-ty * 10}deg) rotateY(${tx * 10}deg) scale(${1 - 0.03 * press})`,
      boxShadow: `0 ${u(1)} ${u(2)} rgba(0,0,0,.3), ${u(-tx * 14)} ${u(14 - 8 * press + ty * 8)} ${u(2 * (20 - 10 * press + mag * 10))} rgba(0,0,0,.48)`,
    });
    if (sheen.current) sheen.current.style.background = `radial-gradient(circle at ${(0.5 - tx * 0.5) * 100}% ${(0.3 - ty * 0.5) * 100}%, rgba(255,255,255,${0.2 + mag * 0.22}), transparent 62%), radial-gradient(circle at ${(0.5 - tx * 0.5) * 100}% ${(0.3 - ty * 0.5) * 100}%, transparent 45%, rgba(0,0,0,${mag * 0.08}))`;
  });
  return (
    <Stage>
      <div ref={card} data-motion className="relative overflow-hidden" style={{ width: u(320), height: u(236), borderRadius: u(26), background: blocks.tangerine, color: ink }}>
        <div className="flex h-full flex-col" style={{ padding: u(22) }}>
          <div className="flex items-center justify-between"><span style={meta(u)}>ADMIT ONE</span><span style={mono(u)}>No. 0418</span></div>
          <span style={{ ...display(40, font.displayTracking, u), marginTop: "auto" }}>Late Show</span>
          <span style={{ fontSize: u(15), fontWeight: 500, marginTop: u(4), ...dim }}>Sat 14 Nov · Screen 3</span>
          <div aria-hidden className="flex items-center" style={{ margin: `${u(12)} ${u(-33)}`, gap: u(8) }}>
            <span className="shrink-0 rounded-full" style={{ width: u(22), height: u(22), background: ground.bg }} />
            <span className="flex-1" style={{ borderTop: `${u(1.5)} dashed ${ink}`, opacity: 0.3 }} />
            <span className="shrink-0 rounded-full" style={{ width: u(22), height: u(22), background: ground.bg }} />
          </div>
          <div className="flex items-end" style={{ gap: u(24) }}>
            {[["ROW", "F"], ["SEAT", "12"], ["DOORS", "21:40"]].map(([k, v]) => (
              <div key={k} className="flex flex-col" style={{ gap: u(4) }}>
                <span style={{ ...meta(u), fontSize: u(10), ...dim }}>{k}</span>
                <span style={{ fontSize: u(30), fontWeight: font.numeralWeight, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={sheen} data-motion aria-hidden className="pointer-events-none absolute inset-0" style={{ mixBlendMode: "soft-light" }} />
      </div>
    </Stage>
  );
}

// MARK: Swipe Deck

const RECIPES = [
  { title: "Miso aubergine", detail: "Vegetarian · Serves 2", minutes: 25, fill: blocks.sky, bowl: blocks.tangerine },
  { title: "Lemon orzo", detail: "One pot · Serves 4", minutes: 20, fill: blocks.butter, bowl: blocks.sage },
  { title: "Green curry", detail: "Spicy · Serves 3", minutes: 35, fill: blocks.sage, bowl: blocks.butter },
  { title: "Harissa chickpeas", detail: "Vegan · Serves 2", minutes: 30, fill: blocks.lilac, bowl: blocks.tangerine },
];
const BADGES = { trailing: { title: "Keep", d: G.heart, fill: blocks.sage }, leading: { title: "Skip", d: G.x, fill: blocks.tangerine }, top: { title: "Save", d: G.bookmark, fill: blocks.butter } } as const;
type Dir = keyof typeof BADGES;
const SCRIPT: { dir: Dir; v: [number, number] }[] = [{ dir: "trailing", v: [1, -0.1] }, { dir: "leading", v: [-1, -0.1] }, { dir: "top", v: [0.06, -1] }];
const W = 206, CH = 266;
const deckU = units(1.2);

export function SwipeDeckPreview() {
  const u = deckU;
  const [head, setHead] = useState(0);
  const deck = useRef<HTMLDivElement>(null);
  const thrown = useRef(0);
  useRaf((t) => {
    const el = deck.current; if (!el) return;
    const unit = el.clientWidth / W;
    // 3 s per card: rest, drag toward the threshold (the badge fades in and locks), release throws along the vector, the next card rises.
    const n = Math.floor(t / 3), q = t - n * 3;
    const { dir, v } = SCRIPT[n % SCRIPT.length];
    const reach = dir === "top" ? CH * 0.36 : W * 0.5;
    const drag = easeInOut((q - 0.7) / 0.9) * reach;
    const fly = easeOut((q - 1.75) / 0.45) * 1.6 * CH;
    const removed = q >= 2.2;
    if (removed && thrown.current !== n + 1) { thrown.current = n + 1; setHead(n + 1); }
    const tx = removed ? 0 : v[0] * (drag + fly), ty = removed ? 0 : v[1] * (drag + fly);
    const progress = clamp(dir === "top" ? -ty / (CH * 0.3) : Math.abs(tx) / (W * 0.4));
    const lift = removed ? 0 : progress;
    Array.from(el.children).forEach((node, i) => {
      const depth = Math.max(i - lift, 0), card = node as HTMLElement;
      const top = i === 0;
      card.style.transform = `${top ? `translate(${tx * unit}px, ${ty * unit}px) rotate(${(tx / W) * 14}deg) ` : ""}translateY(${16 * depth * unit}px) scale(${1 - 0.05 * depth})`;
      card.style.filter = `brightness(${1 - 0.05 * Math.min(depth, 2)})`;
      card.style.opacity = i === 2 && removed ? String(clamp((q - 2.2) / 0.25)) : "1";
      if (top) (Object.keys(BADGES) as Dir[]).forEach((k) => {
        const b = card.querySelector<HTMLElement>(`[data-badge="${k}"]`); if (!b) return;
        const pr = !removed && k === dir ? progress : 0, locked = pr >= 1;
        b.style.opacity = String(Math.min(pr * 1.6, 1));
        b.style.transform = `rotate(${k === "trailing" ? -10 : k === "leading" ? 10 : 0}deg) scale(${locked ? 1.08 : 0.8 + 0.2 * pr})`;
      });
    });
  });
  return (
    <Stage>
      <div ref={deck} className="relative" style={{ width: u(W), height: u(CH), marginBottom: u(32) }}>
        {[0, 1, 2].map((i) => {
          const r = RECIPES[(head + i) % RECIPES.length];
          return (
            <div key={`${head + i}`} data-motion className="absolute inset-0 flex origin-bottom flex-col" style={{ zIndex: 3 - i, borderRadius: u(30), background: r.fill, color: ink, padding: u(20), boxShadow: `0 ${u(1)} ${u(2)} rgba(0,0,0,.2), 0 ${u(12)} ${u(30)} rgba(0,0,0,.4)` }}>
              <div className="flex items-center justify-between"><span style={meta(u)}>TONIGHT</span><span style={mono(u)}>{r.minutes} min</span></div>
              <span aria-hidden className="relative mx-auto rounded-full" style={{ marginBlock: "auto", width: u(96), height: u(96), background: ink }}>
                <span className="absolute rounded-full" style={{ inset: u(16), background: r.bowl }} />
                <span className="absolute rounded-full" style={{ width: u(22), height: u(22), left: u(48), top: u(28), background: r.fill }} />
                <span className="absolute rounded-full" style={{ width: u(12), height: u(12), left: u(26), top: u(54), background: r.fill }} />
              </span>
              <span style={display(24, font.displayTracking, u)}>{r.title}</span>
              <span style={{ fontSize: u(13), fontWeight: 500, marginTop: u(4), ...dim }}>{r.detail}</span>
              {i === 0 ? (Object.keys(BADGES) as Dir[]).map((k) => {
                const b = BADGES[k];
                const pos: CSSProperties = k === "trailing" ? { left: u(16), top: u(16) } : k === "leading" ? { right: u(16), top: u(16) } : { left: "50%", bottom: u(16), marginLeft: u(-40) };
                return (
                  <span key={k} data-badge={k} data-motion className="absolute flex items-center rounded-full" style={{ ...pos, opacity: 0, gap: u(6), height: u(40), paddingInline: u(14), background: b.fill, color: ink, boxShadow: `0 ${u(4)} ${u(10)} rgba(0,0,0,.22)`, ...display(17, "-0.02em", u) }}>
                    <Glyph d={b.d} size={13} fill={k !== "leading"} u={u} />{b.title}
                  </span>
                );
              }) : null}
            </div>
          );
        })}
      </div>
    </Stage>
  );
}
