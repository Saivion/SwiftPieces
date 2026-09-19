"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

// Navigation previews. Each shows the piece itself on the house ground, with only the scaffolding it needs to read:
// a header needs something to scroll, tabs need pages, a dock needs something to float over. That scaffolding stays
// plain and unstyled — neutral placeholder blocks, never an invented app.
// Sizes are iOS points mapped to container width (P cqw per point), so the stage scales from the grid card to the docs header.

const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const P = 0.25;
/** iOS points to container units. */
const pt = (n: number) => `${+(n * P).toFixed(3)}cqw`;

/** Runs each `[delayMs, fn]` step once per `loopMs` cycle; every timer is cleared on unmount. */
function useTimeline(loopMs: number, steps: [number, () => void][]) {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, loopMs);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Glyph({ d, size, stroke = 2, fill = false, style }: { d: string; size: number; stroke?: number; fill?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: pt(size), height: pt(size), flexShrink: 0, ...style }} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const G = {
  house: "M4 11l8-7 8 7v9h-5v-6H9v6H4v-9z",
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM20 20l-4.8-4.8",
  tray: "M4 13l2-8h12l2 8v6H4v-6zM4 13h5l1.5 2h3L15 13h5",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0",
  menu: "M4 7h16M4 12h16M4 17h16",
};

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>
      {children}
    </div>
  );
}

/** A neutral block standing in for content. Nothing is drawn on it. */
function Placeholder({ height, radius = 18 }: { height: number; radius?: number }) {
  return <span className="block shrink-0" style={{ height: pt(height), borderRadius: pt(radius), background: ground.surface }} />;
}

// MARK: Stretch Header

/** Rest, pull to stretch the hero, scroll so the meta row pins under the solid bar, return. */
export function StretchHeaderPreview() {
  const [phase, setPhase] = useState<"rest" | "pull" | "scrolled">("rest");
  useTimeline(6400, [[0, () => setPhase("rest")], [1500, () => setPhase("pull")], [2300, () => setPhase("rest")], [3200, () => setPhase("scrolled")], [5200, () => setPhase("rest")]]);
  const H = 150, BAR = 40;
  const stretch = phase === "pull" ? 40 : 0;
  const scrolled = phase === "scrolled" ? 150 : 0;
  const collapse = Math.min(1, scrolled / (H - BAR));
  const t = `.7s ${phase === "pull" ? ease : spring}`;
  const move = `transform ${t}, height ${t}, opacity .5s ${ease}, top ${t}`;
  return (
    <Stage>
      {/* The scroll viewport the header lives in: a clip, nothing more. */}
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: pt(292), height: pt(288), transform: "translate(-50%,-50%)", borderRadius: pt(26), background: ground.bg }}>
        {/* Hero block */}
        <div data-motion className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: pt(H + stretch), background: blocks.sage, transform: `translateY(${pt(-scrolled * 0.7)})`, transition: move }}>
          <span className="absolute rounded-full" style={{ width: pt(128), height: pt(128), right: pt(-32), top: pt(-32), background: blocks.butter }} />
          <div data-motion className="absolute" style={{ left: pt(18), bottom: pt(16), color: ink, transformOrigin: "left bottom", transform: `scale(${(1 - 0.3 * collapse) * (1 + stretch / 900)})`, opacity: 1 - Math.max(0, (collapse - 0.5) / 0.35), transition: move }}>
            <p style={{ fontSize: pt(9), fontWeight: 600, letterSpacing: "0.12em", opacity: 0.72 }}>YOSEMITE · HIKE 04</p>
            <p style={{ fontSize: pt(34), fontWeight: font.displayWeight, letterSpacing: font.displayTracking, lineHeight: 1.05 }}>Mist Trail</p>
          </div>
        </div>
        {/* The pinning subtitle row, at its plainest */}
        <div data-motion className="absolute inset-x-0 z-10" style={{ top: pt(Math.max(H + stretch - scrolled, BAR)), padding: `${pt(11)} ${pt(18)}`, background: ground.bg, transition: move }}>
          <p style={{ fontSize: pt(9), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted }}>5.4 MI · 1,000 FT UP · 3.5 HOURS</p>
        </div>
        {/* Plain placeholder content, only so there is something to scroll */}
        <div data-motion className="absolute inset-x-0 flex flex-col" style={{ top: pt(H + stretch + 42 - scrolled), gap: pt(10), padding: `${pt(6)} ${pt(18)}`, transition: move }}>
          {[0, 1, 2, 3, 4].map((i) => <Placeholder key={i} height={46} />)}
        </div>
        {/* The bar: a solid surface that fades in, with the inline title */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center" style={{ height: pt(BAR) }}>
          <div data-motion className="absolute inset-0" style={{ background: ground.bg, opacity: collapse, boxShadow: `0 ${pt(4)} ${pt(12)} rgba(0,0,0,${0.3 * collapse})`, transition: `opacity .5s ${ease}` }} />
          <span data-motion className="relative" style={{ fontSize: pt(13), fontWeight: 700, opacity: collapse > 0.8 ? 1 : 0, transform: `translateY(${collapse > 0.8 ? 0 : pt(5)})`, transition: `opacity .4s ${ease} .3s, transform .4s ${ease} .3s` }}>Mist Trail</span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Tracking Tabs

const TABS: [string, number][] = [["Today", 4], ["Upcoming", 6], ["Done", 2]];

/** The block follows fractional page progress; titles crossfade from muted to ink as it passes. Pages are plain placeholders. */
export function TrackingTabsPreview() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0, from = 0, to = 1, start = 0, dir = 1, holdUntil = performance.now() + 1600;
    const curve = (x: number) => 1 - Math.pow(1 - x, 3);
    const tick = (now: number) => {
      if (now >= holdUntil) {
        if (!start) start = now;
        const k = Math.min(1, Math.max(0, (now - start) / 620));
        setProgress(from + (to - from) * curve(k));
        if (k >= 1) { from = to; if (to === 2) dir = -1; else if (to === 0) dir = 1; to = from + dir; start = 0; holdUntil = now + 1500; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const W = 300, PAD = 4, TAB = (W - PAD * 2) / 3;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2" style={{ width: pt(W), transform: "translate(-50%,-50%)" }}>
        <div className="relative flex" style={{ padding: pt(PAD), borderRadius: 999, background: ground.surface }}>
          <span data-motion className="absolute" style={{ top: pt(PAD), bottom: pt(PAD), left: pt(PAD + progress * TAB), width: pt(TAB), borderRadius: 999, background: blocks.butter, boxShadow: `0 ${pt(2)} ${pt(6)} rgba(0,0,0,.25)` }} />
          {TABS.map(([title, count], i) => {
            const on = Math.max(0, 1 - Math.abs(progress - i));
            const label = (color: string, countColor: string, opacity: number) => (
              <span className="absolute inset-0 flex items-center justify-center" style={{ gap: pt(5), color, opacity }}>
                <span style={{ fontSize: pt(13), fontWeight: 600 }}>{title}</span>
                <span style={{ fontSize: pt(10), fontWeight: 600, fontFamily: font.mono, color: countColor }}>{count}</span>
              </span>
            );
            return (
              <span key={title} className="relative flex-1" style={{ height: pt(38) }}>
                {label(ground.muted, ground.subtle, 1 - on)}
                {label(ink, "rgba(20,20,20,.62)", on)}
              </span>
            );
          })}
        </div>
        {/* Plain placeholder rows, only so each page has something to page through */}
        <div className="relative overflow-hidden" style={{ marginTop: pt(16), height: pt(196) }}>
          <div data-motion className="flex" style={{ width: "300%", transform: `translateX(${-progress * 33.3333}%)` }}>
            {TABS.map(([title, count]) => (
              <div key={title} className="flex flex-1 flex-col" style={{ gap: pt(10) }}>
                {Array.from({ length: count }, (_, i) => <Placeholder key={i} height={44} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Floating Dock

const DOCK: [string, string][] = [["Home", G.house], ["Search", G.search], ["Inbox", G.tray], ["Profile", G.person]];

/** Taps walk the butter block; a scrub lifts each item under the finger with a name bubble and commits on release; the dock tucks and returns. */
export function FloatingDockPreview() {
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [badge, setBadge] = useState(3);
  const [tucked, setTucked] = useState(false);
  useTimeline(10400, [
    [0, () => { setSel(0); setHover(null); setTucked(false); setBadge(3); }],
    [1500, () => setSel(1)],
    [2900, () => setHover(1)], [3400, () => setHover(2)], [3900, () => setHover(3)],
    [4500, () => { setHover(null); setSel(3); }],
    [6000, () => { setSel(2); setBadge(4); }],
    [7600, () => setTucked(true)], [8600, () => setTucked(false)],
  ]);
  return (
    <Stage>
      {/* Plain placeholder content, only so the dock has something to float over */}
      <div className="absolute inset-x-0 top-0 flex flex-col" style={{ padding: `${pt(22)} ${pt(22)}`, gap: pt(12) }}>
        {[0, 1, 2, 3].map((i) => <Placeholder key={i} height={62} />)}
      </div>
      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ bottom: pt(16), transform: `translateY(${tucked ? pt(110) : 0})`, opacity: tucked ? 0 : 1, transition: `transform .5s ${spring}, opacity .4s ${ease}` }}>
        <div className="flex items-center" style={{ padding: pt(5), gap: pt(2), borderRadius: 999, background: ground.surface, boxShadow: `0 ${pt(1)} ${pt(2)} rgba(0,0,0,.3), 0 ${pt(12)} ${pt(26)} rgba(0,0,0,.45)` }}>
          {DOCK.map(([title, d], i) => {
            const on = i === sel, lifted = hover === i;
            return (
              <div key={title} data-motion className="relative flex items-center justify-center" style={{ height: pt(42), minWidth: pt(42), gap: pt(6), paddingInline: pt(on ? 15 : 10), borderRadius: 999, background: on ? blocks.butter : "transparent", color: on ? ink : ground.muted, transform: `translateY(${lifted ? pt(-5) : 0}) scale(${lifted && !on ? 1.14 : 1})`, transition: `transform .28s ${spring}, background .35s ${ease}, padding .45s ${spring}` }}>
                <span className="relative">
                  <Glyph d={d} size={17} fill={on && i !== 1} stroke={on ? 1.6 : 1.9} />
                  {i === 2 && !on ? <span key={badge} className="absolute grid place-items-center rounded-full" style={{ top: pt(-8), right: pt(-10), minWidth: pt(16), height: pt(16), paddingInline: pt(4), background: blocks.tangerine, color: ink, fontSize: pt(9), fontWeight: 700, boxShadow: `0 0 0 ${pt(2)} ${ground.surface}` }}>{badge}</span> : null}
                </span>
                {on ? <span style={{ fontSize: pt(12), fontWeight: 700, whiteSpace: "nowrap" }}>{title}</span> : null}
                {on && i === 2 ? <span className="grid place-items-center rounded-full" style={{ minWidth: pt(16), height: pt(16), paddingInline: pt(4), background: ink, color: blocks.butter, fontSize: pt(9), fontWeight: 700 }}>{badge}</span> : null}
                <span data-motion className="pointer-events-none absolute left-1/2 whitespace-nowrap rounded-full" style={{ bottom: `calc(100% + ${pt(12)})`, padding: `${pt(5)} ${pt(10)}`, background: ground.text, color: ground.bg, fontSize: pt(11), fontWeight: 700, transform: `translateX(-50%) scale(${lifted ? 1 : 0.6})`, transformOrigin: "bottom center", opacity: lifted ? 1 : 0, transition: `transform .25s ${spring}, opacity .2s ${ease}` }}>{title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}
