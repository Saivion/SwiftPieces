"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";

/* Media: PhotoViewer and StoryStrip. Each preview shows the component and nothing else (FREE-V2.1):
   no gallery entry point, no story-app header. The stage is 4:3 (100cqw by 75cqw); 1 iOS point is
   0.19cqw. Photos are flat color prints, never stock. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const spring = "cubic-bezier(.34,1.4,.64,1)";
const ease = "cubic-bezier(.22,1,.36,1)";
const KEYFRAMES = "@keyframes cm-tap{0%{opacity:0;transform:scale(.6)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.25)}}@keyframes cm-fade{from{opacity:0;transform:translateY(2%)}to{opacity:1;transform:none}}";
const meta: CSSProperties = { fontSize: p(11), fontWeight: 700, letterSpacing: "0.09em", lineHeight: 1 };

/** One shared clock (seconds) at ~30fps, held at `rest` under Reduce Motion. */
function useClock(rest: number, fps = 30) {
  const [t, setT] = useState(rest);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = 0; const start = performance.now();
    const tick = (now: number) => { if (now - last >= 1000 / fps) { last = now; setT(Math.max(0, now - start) / 1000); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}

// MARK: Photo Viewer

const PRINTS = [
  { title: "Noon", ground: blocks.tangerine, shape: blocks.butter },
  { title: "Tide", ground: blocks.sky, shape: blocks.sage },
  { title: "Dusk", ground: blocks.lilac, shape: blocks.tangerine },
];

/** A flat poster: a solid ground, one disc, a bar, and the title set large. Sized by its container width (`w` in points). */
function Print({ i, w }: { i: number; w: number }) {
  const x = PRINTS[i], u = (f: number) => p(w * f);
  return (
    <div className="relative overflow-hidden" style={{ width: p(w), height: p(w * 4 / 3), background: x.ground, color: ink, borderRadius: p(Math.max(6, w * 0.04)) }}>
      <span className="absolute rounded-full" style={{ width: u(0.62), height: u(0.62), left: u(0.3), top: u(0.16), background: x.shape }} />
      <span className="absolute" style={{ width: u(0.46), height: u(0.1), left: u(0.08), top: u(0.62), background: ink }} />
      <span className="absolute" style={{ left: u(0.07), top: u(0.07), fontFamily: font.mono, fontWeight: 700, fontSize: u(0.05) }}>No. 0{i + 1}</span>
      <span className="absolute whitespace-nowrap" style={{ left: u(0.07), bottom: u(0.05), fontWeight: 900, fontSize: u(0.26), letterSpacing: "-0.05em", lineHeight: 1 }}>{x.title}</span>
    </div>
  );
}

/** Scripted states: rest on print 1, double-tap zoom (the counter becomes 2.5×), a pan, reset, page twice, drag down to dismiss, closed, reopen. */
const VIEW = [
  { page: 0, s: 1, x: 0, y: 0, dy: 0, open: true, ms: 1400 },
  { page: 0, s: 2.5, x: -30, y: 34, dy: 0, open: true, ms: 1100, tap: true },
  { page: 0, s: 2.5, x: 60, y: 60, dy: 0, open: true, ms: 1200 },
  { page: 0, s: 1, x: 0, y: 0, dy: 0, open: true, ms: 900 },
  { page: 1, s: 1, x: 0, y: 0, dy: 0, open: true, ms: 1300 },
  { page: 2, s: 1, x: 0, y: 0, dy: 0, open: true, ms: 1300 },
  { page: 2, s: 1, x: 0, y: 0, dy: 110, open: true, ms: 550 },
  { page: 2, s: 1, x: 0, y: 0, dy: 500, open: false, ms: 700 },
];

export function PhotoViewerPreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setI((i + 1) % VIEW.length), VIEW[i].ms);
    return () => clearTimeout(id);
  }, [i]);
  const st = VIEW[i], progress = Math.min(1, st.dy / 140), zoomed = st.s > 1;
  const chromeOpacity = st.open ? Math.max(0, 1 - progress * 3) : 0;
  const PW = 270;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      <style>{KEYFRAMES}</style>
      {/* Viewer */}
      <div data-motion className="absolute inset-0" style={{ background: ground.bg, opacity: st.open ? 1 - progress * 0.92 : 0, transition: `opacity .35s ${ease}` }} />
      <div className="absolute inset-0" style={{ visibility: st.open || st.dy > 0 ? "visible" : "hidden" }}>
        {PRINTS.map((_, k) => (
          <div key={k} data-motion className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateX(${(k - st.page) * 100}%)`, transition: `transform .5s ${ease}` }}>
            <div data-motion style={{
              transform: k === st.page ? `translate(${p(st.x)}, ${p(st.y + st.dy)}) scale(${st.s * (1 - 0.2 * progress)})` : "none",
              opacity: st.open ? 1 : 0, transition: `transform ${st.s > 1 || st.dy ? ".5s" : ".45s"} ${spring}, opacity .3s`,
            }}><Print i={k} w={PW} /></div>
          </div>
        ))}
        <span key={i} data-motion aria-hidden className="absolute rounded-full" style={{ left: "44%", top: "40%", width: p(44), height: p(44), marginLeft: p(-22), marginTop: p(-22), background: "rgba(255,255,255,.45)", opacity: 0, animation: "tap" in st ? "cm-tap .5s ease-out both" : "none" }} />
        {/* Chrome: close button and a counter that becomes the zoom readout. */}
        <div data-motion className="absolute inset-x-0 top-0 flex items-center justify-between" style={{ padding: `${p(16)} ${p(16)}`, opacity: chromeOpacity, transition: "opacity .25s" }}>
          <span className="grid place-items-center rounded-full" style={{ width: p(44), height: p(44), background: ground.raised }}>
            <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(16), height: p(16) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
          <span data-motion className="flex items-center rounded-full" style={{ height: p(44), paddingInline: p(16), background: zoomed ? ground.text : ground.raised, color: zoomed ? ink : ground.text, fontFamily: font.rounded, fontWeight: 700, fontSize: p(15), fontVariantNumeric: "tabular-nums", transform: zoomed ? "scale(1.04)" : "none", transition: `background .3s ${ease}, color .3s, transform .35s ${spring}` }}>
            {zoomed ? `${st.s.toFixed(1)}×` : `${st.page + 1} / ${PRINTS.length}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// MARK: Story Strip

const SLIDES = [
  { meta: "SATURDAY MARKET", headline: "Out early for the good peaches", figure: null, fill: blocks.tangerine },
  { meta: "STALLS VISITED", headline: "and one very long queue", figure: "12", fill: blocks.butter },
  { meta: "SPENT", headline: "on bread, figs and flowers", figure: "€18.40", fill: blocks.sage },
  { meta: "NEXT WEEK", headline: "Same time. Bring a bigger bag.", figure: null, fill: blocks.lilac },
];
const SEG = 1.8, LOOP = 9.4;
/** Script on the clock: slide 2 is held for a second (the Paused badge shows) and resumes where it stopped, slide 3 is tapped forward early, then the strip finishes. */
function story(t: number) {
  t %= LOOP;
  if (t < 1.8) return { cur: 0, fill: t / SEG, held: false, tap: false, done: false };
  if (t < 4.8) { const e = t - 1.8; return { cur: 1, fill: (e < 0.7 ? e : e < 1.9 ? 0.7 : e - 1.2) / SEG, held: e >= 0.7 && e < 1.9, tap: false, done: false }; }
  if (t < 5.9) return { cur: 2, fill: (t - 4.8) / SEG, held: false, tap: t > 5.6, done: false };
  if (t < 7.7) return { cur: 3, fill: (t - 5.9) / SEG, held: false, tap: false, done: false };
  return { cur: 3, fill: 1, held: false, tap: false, done: true };
}

export function StoryStripPreview() {
  const t = useClock(2.2), s = story(t), slide = SLIDES[s.cur];
  const seg = (i: number) => (s.done || i < s.cur ? 1 : i === s.cur ? Math.min(s.fill, 1) : 0);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack }}>
      <style>{KEYFRAMES}</style>
      <div data-motion className="relative overflow-hidden" style={{ height: "71cqw", aspectRatio: "330 / 560", borderRadius: p(34), background: slide.fill, color: ink, transition: "background .35s ease-in-out" }}>
        {/* The strip itself: the bars, and the paused badge the component puts under them. */}
        <div className="absolute inset-x-0 top-0 flex flex-col items-start" style={{ padding: p(12), gap: p(10) }}>
          <div data-motion className="flex self-stretch" style={{ gap: p(4), opacity: s.held ? 0.55 : 1, transition: "opacity .2s" }}>
            {SLIDES.map((_, i) => (
              <span key={i} className="relative flex-1 overflow-hidden rounded-full" style={{ height: p(4), background: "rgba(20,20,20,.3)" }}>
                <span data-motion className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${seg(i) * 100}%`, background: ink }} />
              </span>
            ))}
          </div>
          <span data-motion className="flex items-center rounded-full" style={{ height: p(30), paddingInline: p(12), gap: p(6), background: ink, color: slide.fill, fontSize: p(14), fontWeight: 700, opacity: s.held ? 1 : 0, transform: s.held ? "none" : `translateY(${p(-6)}) scale(.85)`, transformOrigin: "top left", transition: `opacity .2s, transform .3s ${spring}` }}>
            <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(11), height: p(11) }} fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>Paused
          </span>
        </div>
        <div key={s.cur} className="absolute inset-x-0 bottom-0 flex flex-col" style={{ padding: p(24), paddingBottom: p(44), gap: p(10), animation: "cm-fade .35s ease-out both" }}>
          <span style={meta}>{slide.meta}</span>
          {slide.figure ? <span style={{ fontSize: p(96), fontWeight: font.numeralWeight, letterSpacing: "-0.04em", lineHeight: 0.95 }}>{slide.figure}</span> : null}
          <span style={{ fontSize: p(slide.figure ? 28 : 44), fontWeight: font.displayWeight, letterSpacing: slide.figure ? "-0.035em" : font.displayTracking, lineHeight: 1.02 }}>{slide.headline}</span>
        </div>
        <span data-motion aria-hidden className="absolute grid place-items-center rounded-full" style={{ right: p(24), top: "50%", width: p(52), height: p(52), marginTop: p(-26), background: ink, color: slide.fill, opacity: s.tap ? 1 : 0, transform: s.tap ? "scale(1)" : "scale(.7)", transition: `opacity .15s, transform .25s ${spring}` }}>
          <svg viewBox="0 0 24 24" style={{ width: p(20), height: p(20) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </span>
      </div>
    </div>
  );
}
