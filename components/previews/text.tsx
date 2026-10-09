"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";
import { roles, springValue, t as tr, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup } from "./piece-liquid";

/* Text: TextReveal, GlassText. Each preview shows the component and nothing else, on the
   dark house ground, sized in container units so it scales from the grid card to the docs header.
   The stage is 4:3, so 100cqw wide and 75cqw tall; 1 iOS point is 0.19cqw. All type is semibold (600). */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

/** How long a new copy waits hidden before `on` turns true, so its transitions run from the hidden pose. */
const MOUNT_LAG = 0.04;

/**
 * Replays an on-appear reveal every `ms`, as the example bumps `trigger`. Each replay is a new `epoch`: its copy
 * mounts hidden and `on` rises a moment later (animated), while the previous epoch's copy fades out.
 */
function useReplay(ms: number) {
  const [state, setState] = useState({ epoch: 0, on: false });
  useEffect(() => {
    let up = 0;
    const rise = () => { up = window.setTimeout(() => setState((s) => ({ ...s, on: true })), MOUNT_LAG * 1000); };
    rise();
    const loop = setInterval(() => { setState((s) => ({ epoch: s.epoch + 1, on: false })); rise(); }, ms);
    return () => { clearInterval(loop); clearTimeout(up); };
  }, [ms]);
  return state;
}

// MARK: Text Reveal

type Preset = "rise" | "blur" | "soften";

/** The highlight's own pace, `Style.highlightDuration`, on Swift's `.smooth`: no overshoot, so it never runs past the phrase and back. */
const STROKE: Spring = { duration: 0.5, bounce: 0 };

/** Words are read, so they arrive at the calm reveal's pace without its give, as Swift's `arrival`: never past the baseline. */
const ARRIVAL: Spring = { duration: roles.reveal.duration, bounce: 0 };

/** How long a word takes to nearly land (92% of its rise on ARRIVAL): the beat a highlight starts behind its phrase. */
const LANDING = (() => {
  let s = 0;
  while (s < 1 && springValue(ARRIVAL, s) < 0.92) s += 1 / 120;
  return s;
})();

/** A replay's new copy waits until the outgoing one has mostly faded on the dismiss role, so they never overlap as doubled strokes. */
const HOLD = 0.16;

/**
 * One TextReveal line, as the Swift piece lays it out: words never break, each unit takes ~0.5 s to land
 * and the rest of `duration` spreads across the starts, eased so early gaps run a little shorter than even
 * and the last a little longer. Every preset arrives on the calm pace with no give; `.rise` slides each word up
 * from behind its own baseline. A highlighted phrase stays on one row; once its last word has nearly landed
 * a stroke of butter-tinted liquid glass grows in from the leading edge with round caps the whole way. An ink copy
 * is uncovered by the same stroke while the base text gives way under it, so the color flips exactly under its edge.
 */
function Reveal({ text, preset = "rise", delay = 0, duration = 0.8, on, highlight, style }: { text: string; preset?: Preset; delay?: number; duration?: number; on: boolean; highlight?: string; style?: CSSProperties }) {
  const reduced = useReduced();
  const words = text.split(/\s+/);
  const hl = highlight ? highlight.split(/\s+/) : [];
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const match = hl.length ? words.findIndex((_, i) => hl.every((h, k) => norm(words[i + k] ?? "") === norm(h))) : -1;
  const chunks: { words: string[]; first: number; highlighted: boolean }[] = [];
  for (let i = 0; i < words.length; ) {
    if (i === match) { chunks.push({ words: words.slice(i, i + hl.length), first: i, highlighted: true }); i += hl.length; }
    else { chunks.push({ words: [words[i]], first: i, highlighted: false }); i += 1; }
  }
  // Eased starts, as Swift's `start(_:)`: the reveal leaves briskly and settles, the total unchanged.
  const start = (index: number) => {
    if (words.length < 2 || reduced) return delay;
    const x = index / (words.length - 1);
    return delay + Math.max(0, duration - 0.5) * x * (0.7 + 0.3 * x);
  };
  const unit = (w: string, index: number) => {
    const d = start(index) * 1000;
    const hidden: CSSProperties = reduced ? { opacity: 0 } : preset === "rise" ? { transform: "translateY(105%)" } : preset === "blur" ? { opacity: 0, filter: "blur(8px)" } : { opacity: 0, transform: "scale(.96)" };
    // One arrival spring for every property: no overshoot, so a word never bobs past its baseline.
    const shown: CSSProperties = { opacity: 1, transform: "none", filter: "none", transition: tr(["opacity", "transform", "filter"], ARRIVAL, d) };
    return <span key={index} data-motion className="inline-block origin-bottom" style={on ? shown : { ...hidden, transition: "none" }}>{w}</span>;
  };
  return (
    // A div, not a p: the glass draws in block elements, which a paragraph may not hold.
    <div aria-label={text} style={{ margin: 0, ...style }}>
      {chunks.map((c) => {
        const row = c.words.map((w, k) => <span key={k}>{k ? " " : ""}{unit(w, c.first + k)}</span>);
        const clip: CSSProperties = preset === "rise" ? { overflow: "hidden", paddingInline: "0.06em", marginInline: "-0.06em", verticalAlign: "bottom" } : {};
        if (!c.highlighted) return <span key={c.first}><span className="inline-block whitespace-pre" style={clip}>{row}</span>{" "}</span>;
        const lands = (start(c.first + c.words.length - 1) + (reduced ? 0.2 : LANDING)) * 1000;
        // Everything below runs on one spring from one start, so the glass's growing end, the ink's edge and the
        // base text's cut all stay in step. Under reduced motion the glass and the ink fade in at full length instead.
        const fade = (shown: boolean): CSSProperties => ({ opacity: shown ? 1 : 0, transition: shown ? tr("opacity", "reveal", lands) : "none" });
        // The glass grows from its own leading edge with its caps rounded the whole way (a width, not a scale).
        const glass: CSSProperties = reduced ? { width: "100%", ...fade(on) } : { width: on ? "100%" : "0%", transition: on ? tr("width", STROKE, lands) : "none" };
        // The ink copy spans the glass's width, so the same inset puts its edge exactly at the glass's growing end.
        const inked: CSSProperties = reduced ? fade(on) : { clipPath: `inset(0 ${on ? 0 : 100}% 0 0)`, transition: on ? tr("clip-path", STROKE, lands) : "none" };
        // The base text gives way under the glass: its cut starts at the glass's leading edge, 0.16em before the
        // phrase, and ends at its far edge, 0.16em past it (0.1em past the box a rising row pads by 0.06em). Clipped
        // well clear above and below, so accents and the rise keep their own clip.
        const reach = preset === "rise" ? 0.1 : 0.16;
        const base: CSSProperties = reduced
          ? { opacity: on ? 0 : 1, transition: on ? tr("opacity", "reveal", lands) : "none" }
          : { clipPath: `inset(-1em -1em -1em ${on ? `calc(100% + ${reach}em)` : `calc(0% - ${reach}em)`})`, transition: on ? tr("clip-path", STROKE, lands) : "none" };
        return (
          <span key={c.first}>
            <span className="relative inline-block whitespace-pre" style={{ verticalAlign: "bottom" }}>
              <span aria-hidden className="absolute" style={{ left: "-0.16em", right: "-0.16em", top: "0.02em", bottom: "-0.02em" }}>
                {/* Tinted glass, no lift: as in Swift, a shadow here would fall under the text too. */}
                <LiquidGroup unit={p(1)} axis="x" lift={false} style={{ position: "absolute", inset: 0 }}>
                  <Liquid tint={blocks.butter} style={{ height: "100%", borderRadius: "0.24em", ...glass }} />
                </LiquidGroup>
              </span>
              <span data-motion className="relative inline-block" style={{ ...clip, ...base }}>{row}</span>
              <span aria-hidden data-motion className="absolute whitespace-pre" style={{ left: "-0.16em", right: "-0.16em", top: 0, bottom: 0, paddingInline: "0.16em", color: ink, ...inked }}>{c.words.join(" ")}</span>
            </span>{" "}
          </span>
        );
      })}
    </div>
  );
}

/**
 * A replaying TextReveal: on each replay the old copy fades out where it stands as one piece (dismiss) and,
 * once it has mostly cleared, the new one rises in its place. Both share one grid cell.
 */
function Replaying({ epoch, on, delay = 0, ...props }: { epoch: number; on: boolean } & Omit<Parameters<typeof Reveal>[0], "on">) {
  return (
    <div style={{ display: "grid" }}>
      {[epoch - 1, epoch].filter((e) => e >= 0).map((e) => {
        const current = e === epoch;
        return (
          <div key={e} aria-hidden={current ? undefined : true} style={{ gridArea: "1 / 1", opacity: current ? 1 : 0, transition: current ? "none" : tr("opacity", "dismiss") }}>
            <Reveal {...props} on={current ? on : true} delay={delay + (e > 0 ? HOLD - MOUNT_LAG : 0)} />
          </div>
        );
      })}
    </div>
  );
}

/** The component alone: the headline rising word by word with its key phrase landing on butter-tinted glass, and the same reveal as `.blur` underneath. Replays every 4.5 s, as the Swift example does. */
export function TextRevealPreview() {
  const { epoch, on } = useReplay(4500);
  return (
    <Stage>
      <div className="flex flex-col" style={{ width: p(390), gap: p(16) }}>
        <Replaying epoch={epoch} on={on} text="Plan the week in one calm glance." highlight="one calm glance" style={{ fontSize: p(40), fontWeight: 600, letterSpacing: "-0.033em", lineHeight: 1.12 }} />
        <Replaying epoch={epoch} on={on} preset="blur" delay={0.45} text="Three priorities, two open loops and a clear Monday." style={{ fontSize: p(19), fontWeight: 600, lineHeight: 1.3, color: ground.muted }} />
      </div>
    </Stage>
  );
}

// MARK: Glass Text

/**
 * The sway's clock, eased rather than its amplitude: its rate rises on a smoothstep over the first two seconds,
 * so the drift starts from rest, never outruns its own loop and joins it without a kink.
 */
const swayPhase = (t: number) => {
  const ramp = Math.min(t / 2, 1);
  return t < 2 ? ramp * ramp * ramp * (2 - ramp) : t - 1;
};

/** The blocks the glass bends, in stage points (400 x 300). `lens` draws the refracted copy seen through the glyphs. At `t` zero they sit in their rest pose. */
function AlarmBlocks({ t, lens = false }: { t: number; lens?: boolean }) {
  const drift = Math.sin(swayPhase(t) * 0.5);
  return (
    <g filter={lens ? "url(#sp-gt-lens)" : undefined}>
      <rect width="400" height="300" fill={blocks.sky} />
      <circle cx={200 - 70 + drift * 46} cy={158 + Math.cos(t * 0.35) * 14} r="95" fill={blocks.tangerine} />
      <rect x={200 + 110 - drift * 60 - 120} y={88} width="240" height="64" rx="32" fill={blocks.butter} transform={`rotate(-12 ${200 + 110 - drift * 60} 120)`} />
      <rect x={200 + 90 + drift * 30 - 100} y={225} width="200" height="110" rx="26" fill={blocks.lilac} />
    </g>
  );
}

/**
 * The component alone: glass numerals, in the house semibold, over drifting color blocks that fill the stage. Inside the glyph outlines the art is magnified, blurred and brightened (the lens), with a top light, a specular rim and a soft lift.
 * The letters never move; only the backdrop runs on the clock, easing in from rest on appear.
 */
export function GlassTextPreview() {
  const [t, setT] = useState(0);
  useEffect(() => {
    // Under reduced motion the blocks hold their rest pose; turning it off starts the drift again from rest.
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      setT(0);
      if (media.matches) return;
      const start = performance.now();
      const tick = (now: number) => { setT(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    run();
    media.addEventListener("change", run);
    return () => { cancelAnimationFrame(raf); media.removeEventListener("change", run); };
  }, []);
  const type = { fontSize: 120, fontWeight: 600, letterSpacing: -2, fontFamily: font.stack } as const;
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
