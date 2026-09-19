"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

/* Text: TextReveal, GlassText, WeightWave. Each preview shows the component and nothing else, on the
   dark house ground, sized in container units so it scales from the grid card to the docs header.
   The stage is 4:3, so 100cqw wide and 75cqw tall; 1 iOS point is 0.19cqw. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const springEase = "cubic-bezier(0.22, 1, 0.36, 1)";

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

/** Replays an on-appear reveal every `ms`: `on` drops to false (instant reset) then rises to true (animated). */
function useReplay(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let up = 0;
    const play = () => { setOn(false); up = window.setTimeout(() => setOn(true), 80); };
    play();
    const t = setInterval(play, ms);
    return () => { clearInterval(t); clearTimeout(up); };
  }, [ms]);
  return on;
}

// MARK: Text Reveal

type Preset = "rise" | "blur" | "soften";

/**
 * One TextReveal line, as the Swift piece lays it out: words never break, each unit animates ~0.5 s
 * and the rest of `duration` spreads across the stagger. `.rise` slides each word up from behind its
 * own baseline. A highlighted phrase stays on one row; once it lands a butter block wipes in from the
 * leading edge and an ink copy is uncovered by the same wipe, so the color flips under the block edge.
 */
function Reveal({ text, preset = "rise", delay = 0, duration = 0.8, on, highlight, style }: { text: string; preset?: Preset; delay?: number; duration?: number; on: boolean; highlight?: string; style?: CSSProperties }) {
  const reduced = useReduced();
  const words = text.split(/\s+/);
  const hl = highlight ? highlight.split(/\s+/) : [];
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const start = hl.length ? words.findIndex((_, i) => hl.every((h, k) => norm(words[i + k] ?? "") === norm(h))) : -1;
  const chunks: { words: string[]; first: number; highlighted: boolean }[] = [];
  for (let i = 0; i < words.length; ) {
    if (i === start) { chunks.push({ words: words.slice(i, i + hl.length), first: i, highlighted: true }); i += hl.length; }
    else { chunks.push({ words: [words[i]], first: i, highlighted: false }); i += 1; }
  }
  const stagger = words.length > 1 && !reduced ? Math.max(0, duration - 0.5) / (words.length - 1) : 0;
  const unit = (w: string, index: number) => {
    const d = delay + index * stagger;
    const hidden: CSSProperties = reduced ? { opacity: 0 } : preset === "rise" ? { transform: "translateY(105%)" } : preset === "blur" ? { opacity: 0, filter: "blur(8px)" } : { opacity: 0, transform: "scale(.96)" };
    const shown: CSSProperties = { opacity: 1, transform: "none", filter: "none", transition: `opacity .5s ease-out ${d}s, transform .62s ${springEase} ${d}s, filter .55s ease-out ${d}s` };
    return <span key={index} data-motion className="inline-block origin-bottom" style={on ? shown : { ...hidden, transition: "none" }}>{w}</span>;
  };
  return (
    <p aria-label={text} style={{ margin: 0, ...style }}>
      {chunks.map((c) => {
        const row = c.words.map((w, k) => <span key={k}>{k ? " " : ""}{unit(w, c.first + k)}</span>);
        const clip: CSSProperties = preset === "rise" ? { overflow: "hidden", paddingInline: "0.06em", marginInline: "-0.06em", verticalAlign: "bottom" } : {};
        if (!c.highlighted) return <span key={c.first}><span className="inline-block whitespace-pre" style={clip}>{row}</span>{" "}</span>;
        const lands = delay + (c.first + c.words.length - 1) * stagger + 0.42;
        const wipe = on ? `transform .5s ${springEase} ${lands}s, clip-path .5s ${springEase} ${lands}s` : "none";
        return (
          <span key={c.first}>
            <span className="relative inline-block whitespace-pre" style={{ verticalAlign: "bottom" }}>
              <span aria-hidden data-motion className="absolute" style={{ left: "-0.16em", right: "-0.16em", top: "0.02em", bottom: "-0.02em", borderRadius: "0.24em", background: blocks.butter, transformOrigin: "left", transform: on ? "scaleX(1)" : "scaleX(0)", transition: wipe }} />
              <span className="relative inline-block" style={clip}>{row}</span>
              <span aria-hidden data-motion className="absolute inset-0 whitespace-pre" style={{ color: ink, clipPath: on ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", transition: wipe }}>{c.words.join(" ")}</span>
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
}

/** The component alone: the headline rising word by word with its key phrase landing on a butter block, and the same reveal as `.blur` underneath. Replays every 4.6 s. */
export function TextRevealPreview() {
  const on = useReplay(4600);
  return (
    <Stage>
      <div className="flex flex-col" style={{ width: p(390), gap: p(16) }}>
        <Reveal on={on} text="Plan the week in one calm glance." highlight="one calm glance" style={{ fontSize: p(40), fontWeight: 700, letterSpacing: "-0.033em", lineHeight: 1.12 }} />
        <Reveal on={on} preset="blur" delay={0.45} text="Three priorities, two open loops and a clear Monday." style={{ fontSize: p(19), lineHeight: 1.3, color: ground.muted }} />
      </div>
    </Stage>
  );
}

// MARK: Glass Text

/** The blocks the glass bends, in stage points (400 x 300). `lens` draws the refracted copy seen through the glyphs. */
function AlarmBlocks({ t, lens = false }: { t: number; lens?: boolean }) {
  const drift = Math.sin(t * 0.5);
  return (
    <g filter={lens ? "url(#sp-gt-lens)" : undefined}>
      <rect width="400" height="300" fill={blocks.sky} />
      <circle cx={200 - 70 + drift * 46} cy={158 + Math.cos(t * 0.35) * 14} r="95" fill={blocks.tangerine} />
      <rect x={200 + 110 - drift * 60 - 120} y={88} width="240" height="64" rx="32" fill={blocks.butter} transform={`rotate(-12 ${200 + 110 - drift * 60} 120)`} />
      <rect x={200 + 90 + drift * 30 - 100} y={225} width="200" height="110" rx="26" fill={blocks.lilac} />
    </g>
  );
}

/** The component alone: glass numerals over drifting color blocks that fill the stage. Inside the glyph outlines the art is magnified, blurred and brightened (the lens), with a top light, a specular rim and a soft lift. */
export function GlassTextPreview() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { setT(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const type = { fontSize: 112, fontWeight: 800, letterSpacing: -2, fontFamily: font.stack } as const;
  return (
    <Stage>
      <svg viewBox="0 0 400 300" className="absolute inset-0 size-full" role="img" aria-label="07:30">
        <defs>
          <clipPath id="sp-gt-glyphs"><text x="200" y="190" textAnchor="middle" style={type}>07:30</text></clipPath>
          <filter id="sp-gt-lens" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" /><feColorMatrix type="matrix" values="1.05 0 0 0 .1  0 1.05 0 0 .1  0 0 1.05 0 .1  0 0 0 1 0" /></filter>
          <filter id="sp-gt-lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000" floodOpacity=".16" /></filter>
          <linearGradient id="sp-gt-light" x1="0" y1="0" x2="0" y2="1"><stop offset=".3" stopColor="#fff" stopOpacity=".5" /><stop offset=".6" stopColor="#fff" stopOpacity=".06" /><stop offset=".85" stopColor="#fff" stopOpacity=".2" /></linearGradient>
          <linearGradient id="sp-gt-rim" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stopColor="#fff" stopOpacity=".95" /><stop offset=".8" stopColor="#fff" stopOpacity=".2" /></linearGradient>
        </defs>
        <AlarmBlocks t={t} />
        <g filter="url(#sp-gt-lift)">
          <g clipPath="url(#sp-gt-glyphs)">
            <g transform="translate(200 150) scale(1.12) translate(-200 -150)"><AlarmBlocks t={t} lens /></g>
            <rect width="400" height="300" fill="url(#sp-gt-light)" />
          </g>
        </g>
        <text x="200" y="190" textAnchor="middle" style={type} fill="none" stroke="url(#sp-gt-rim)" strokeWidth="1.6">07:30</text>
      </svg>
    </Stage>
  );
}

// MARK: Weight Wave

/**
 * The component alone: per-glyph variable weight and ink. The peak sweeps 0.5 - 0.5cos(2 pi t / period)
 * at 0.7 strength, follows the pointer at full strength and re-phases from it on leave. Glyphs away
 * from the peak fall back to 38% ink, the Swift `Style.standard` two-tone falloff.
 */
export function WeightWavePreview() {
  const line = useRef<HTMLParagraphElement>(null);
  const text = "Low Tide";
  useEffect(() => {
    const el = line.current!, glyphs = Array.from(el.children) as HTMLElement[];
    const light = 100, heavy = 900, spread = 0.3, period = 3600, tail = 0.38, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let centers: number[] = [], finger: number | null = null, phase = 0, strength = 0.7, raf = 0;
    // Glyph centres are measured once at the medium weight, like the Swift piece.
    const measure = () => { glyphs.forEach((g) => (g.style.fontWeight = "500")); const r = el.getBoundingClientRect(); centers = glyphs.map((g) => { const b = g.getBoundingClientRect(); return (b.left + b.width / 2 - r.left) / Math.max(r.width, 1); }); };
    const draw = (now: number) => {
      const peak = finger ?? (reduce ? 0.38 : 0.5 - 0.5 * Math.cos((now * 2 * Math.PI) / period + phase));
      strength += ((finger == null ? 0.7 : 1) - strength) * 0.12;
      glyphs.forEach((g, i) => {
        const d = Math.abs(centers[i] - peak) / spread, bump = d >= 1 ? 0 : (1 - d * d) ** 2, mix = bump * strength;
        g.style.fontWeight = String(Math.round(light + (heavy - light) * mix));
        g.style.opacity = String(Math.round((tail + (1 - tail) * Math.min(1, mix / 0.7)) * 20) / 20);
      });
      if (!reduce || finger != null) raf = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); finger = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); if (reduce) raf = requestAnimationFrame(draw); };
    const leave = (e: PointerEvent) => { if (finger == null) return; const a = Math.acos(1 - 2 * finger); phase = (e.movementX >= 0 ? a : -a) - (performance.now() * 2 * Math.PI) / period; finger = null; if (reduce) raf = requestAnimationFrame(draw); };
    measure(); window.addEventListener("resize", measure);
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);
  return (
    <Stage>
      <p ref={line} data-motion className="cursor-ew-resize whitespace-pre" style={{ margin: 0, fontSize: p(92), lineHeight: 1.1, letterSpacing: "-0.02em" }} aria-label={text}>
        {text.split("").map((c, i) => <span key={i} className="inline-block whitespace-pre" style={{ fontWeight: 500 }}>{c}</span>)}
      </p>
    </Stage>
  );
}
