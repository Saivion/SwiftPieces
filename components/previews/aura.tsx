"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground, signal } from "./palette";
import { reduced, t as tr } from "./piece-motion";
import { MorphText } from "./piece-liquid";

/* Aura: Slide to Pay and Split Stepper. The house aura is five soft lights (red, coral, hot pink, blush and a deep
   red) drifting round a control's edge as one blended gradient: a wide dim bloom and a faint coloured edge, gathered
   toward where your finger is. The stage is 4:3, 400 x 300 points; one iOS point is 0.19cqw. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
/** How far past the control the bloom reaches, in points. */
const SPREAD = 40;
const LIGHTS = "#ff0000 0%, #ff8a5c 20%, #ff005c 40%, #ffc1d6 60%, #b80a05 80%, #ff0000 100%";

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600 }}>
      {children}
      <style>{`
@property --aura-a { syntax: "<angle>"; inherits: true; initial-value: 0deg; }
@property --aura-x { syntax: "<length>"; inherits: true; initial-value: 0px; }
@property --aura-y { syntax: "<length>"; inherits: true; initial-value: 0px; }
@property --aura-g { syntax: "<number>"; inherits: true; initial-value: 0; }
@keyframes aura-turn { to { --aura-a: 360deg; } }
@keyframes aura-burst { from { transform: scale(1); opacity: 1; } to { transform: scale(2.6); opacity: 0; } }
.aura-track { background: #1c1c1f; }
html.light .aura-track { background: #141414; }
@media (prefers-reduced-motion: reduce) { .aura-light { animation: none !important; } }
`}</style>
    </div>
  );
}

function Glyph({ d, size, stroke = 2.4 }: { d: string; size: number; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(size), height: p(size), flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** A ring of the lights `width` points wide on the control's edge, blurred by `blur` points. */
function Ring({ radius, width, blur, opacity, ms }: { radius: number; width: number; blur: number; opacity: number; ms: number }) {
  return (
    <span className="absolute" style={{ inset: p(SPREAD - width / 2), filter: `blur(${p(blur)})`, opacity, transition: `opacity ${ms}ms ease-out` }}>
      <span className="aura-light absolute inset-0" style={{
        borderRadius: p(radius + width / 2), border: `${p(width)} solid transparent`,
        background: `conic-gradient(from var(--aura-a), ${LIGHTS}) border-box`,
        WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0)",
        animation: "aura-turn 26s linear infinite",
      }} />
    </span>
  );
}

/**
 * The aura over a control `radius` points round: gathered at (`x`, `y`) in the control's points by `gather`
 * (0 all round, 1 tight), as bright as `energy`. Changes ease over `ms`.
 */
function Aura({ radius, x, y, gather, energy, ms }: { radius: number; x: number; y: number; gather: number; energy: number; ms: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute" style={{
      inset: p(-SPREAD),
      ["--aura-x" as string]: p(SPREAD + x), ["--aura-y" as string]: p(SPREAD + y), ["--aura-g" as string]: gather,
      transition: `--aura-x ${ms}ms ease-out, --aura-y ${ms}ms ease-out, --aura-g ${ms}ms ease-out`,
      WebkitMaskImage: `radial-gradient(circle ${p(120)} at var(--aura-x) var(--aura-y), #000 0%, rgba(0,0,0,calc(1 - var(--aura-g))) 100%)`,
      maskImage: `radial-gradient(circle ${p(120)} at var(--aura-x) var(--aura-y), #000 0%, rgba(0,0,0,calc(1 - var(--aura-g))) 100%)`,
    } as CSSProperties}>
      <Ring radius={radius} width={14} blur={14} opacity={0.8 * energy} ms={ms} />
      <Ring radius={radius} width={2} blur={1} opacity={0.15 + 0.75 * energy} ms={ms} />
    </span>
  );
}

/** Runs `script` in a loop until the preview unmounts. Under Reduce Motion it never starts: the first frame holds. */
function useLoop(script: (wait: (ms: number) => Promise<void>) => Promise<void>) {
  useEffect(() => {
    if (reduced()) return;
    let alive = true;
    const timers = new Set<number>();
    const wait = (ms: number) => new Promise<void>((resolve) => {
      const id = window.setTimeout(() => { timers.delete(id); if (alive) resolve(); }, ms);
      timers.add(id);
    });
    (async () => { while (alive) await script(wait); })();
    return () => { alive = false; timers.forEach((id) => clearTimeout(id)); };
  }, []);
}

// MARK: Slide to Pay

const TRACK_W = 300, TRACK_H = 60, THUMB = 48, INSET = (TRACK_H - THUMB) / 2, TRAVEL = TRACK_W - THUMB - INSET * 2;
const ARROW = "M5 12h13M13 6l6 6-6 6", CHECK = "M5 12.5l4.5 4.5L19 7.5";

export function SlideToPayPreview() {
  const [s, set] = useState({ x: 0, gather: 0.9, energy: 0.25, folded: false, ms: 600, drag: 0, burst: 0 });
  useLoop(async (wait) => {
    await wait(900);
    set((v) => ({ ...v, x: TRAVEL, energy: 0.7, ms: 1500, drag: 1500 }));
    await wait(1500);
    set((v) => ({ ...v, gather: 0, energy: 1, ms: 450, drag: 0 }));
    await wait(420);
    set((v) => ({ ...v, folded: true, ms: 1500, energy: 0.35, burst: v.burst + 1 }));
    await wait(2600);
    set((v) => ({ ...v, folded: false, x: 0, gather: 0.9, energy: 0.25, ms: 600, drag: 500 }));
    await wait(900);
  });
  const w = s.folded ? TRACK_H : TRACK_W;
  const progress = s.x / TRAVEL;
  const focusX = s.folded ? w / 2 : INSET + s.x + THUMB / 2;
  return (
    <Stage>
      <div className="flex flex-col items-center" style={{ marginTop: p(50), gap: p(4) }}>
        <span style={{ fontSize: p(14), color: ground.muted }}>Total</span>
        <span className="tabular-nums" style={{ fontSize: p(42), lineHeight: 1.1 }}>$186.40</span>
        <span style={{ fontSize: p(14), color: ground.muted }}><MorphText text={s.folded ? "Paid · receipt sent" : "2 nights · Hotel Alma"} /></span>
      </div>
      <div className="absolute grid place-items-center" style={{ bottom: p(52), left: 0, right: 0, height: p(TRACK_H) }}>
        <div className="relative" style={{ width: p(w), height: p(TRACK_H), transition: tr("width", { duration: 0.5, bounce: 0 }) }}>
          <span key={s.burst} aria-hidden className="absolute inset-0 rounded-full" style={{
            border: `${p(3)} solid transparent`, background: `conic-gradient(${LIGHTS}) border-box`, filter: `blur(${p(4)})`,
            WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0)",
            opacity: 0, animation: s.burst ? "aura-burst 1.3s ease-out 120ms" : undefined,
          }} />
          <div className="aura-track absolute inset-0 rounded-full" style={{ background: s.folded ? signal.fill : undefined, boxShadow: `inset 0 0 0 1px rgba(255,255,255,${s.folded ? 0 : 0.08})`, transition: "background-color 300ms ease-out" }} />
          <span className="absolute inset-y-0 grid place-items-center" style={{ left: p(THUMB), right: p(INSET * 2), fontSize: p(17), color: "#f4f3ef", opacity: s.folded ? 0 : Math.max(0, 1 - progress * 1.6), transition: `opacity ${s.drag || 300}ms ease-out` }}>Slide to pay</span>
          <span className="absolute grid place-items-center rounded-full" style={{
            width: p(THUMB), height: p(THUMB), top: p(INSET), left: p(INSET + s.x), background: "#fff", color: "#141414", opacity: s.folded ? 0 : 1,
            transition: `left ${s.drag || 400}ms cubic-bezier(.45,0,.25,1), opacity 200ms ease-out`,
          }}>
            <Glyph d={ARROW} size={20} />
            {/* The finger, so the gesture reads in an autoplay. */}
            <span aria-hidden className="absolute rounded-full" style={{ width: p(30), height: p(30), background: "rgba(255,255,255,.35)", boxShadow: "0 0 0 1px rgba(0,0,0,.08)", opacity: s.drag > 1000 ? 1 : 0, transition: "opacity 200ms ease-out" }} />
          </span>
          <span className="absolute inset-0 grid place-items-center" style={{ color: signal.on, opacity: s.folded ? 1 : 0, transform: `scale(${s.folded ? 1 : 0.4})`, transition: tr(["opacity", "transform"], "success", s.folded ? 160 : 0) }}>
            <Glyph d={CHECK} size={24} stroke={2.8} />
          </span>
          <Aura radius={TRACK_H / 2} x={focusX} y={TRACK_H / 2} gather={s.gather} energy={s.energy} ms={s.ms} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Split Stepper

const TOTAL = 186.4;
const DOTS = ["#ff8a1f", "#2e8bff", "#ff005c", "#00c4a7", "#ffc21a", "#a970ff", "#16b2ff", "#ff3d8b"];
const STEP_W = 228, STEP_H = 56, BUTTON = 44;
const share = (n: number) => `$${(Math.round((TOTAL / n) * 100) / 100).toFixed(2)}`;

export function SplitStepperPreview() {
  const [s, set] = useState({ n: 2, side: 1, gather: 0, energy: 0.25, ms: 600, shake: 0, press: 0 });
  useLoop(async (wait) => {
    const step = async (delta: number) => {
      set((v) => {
        const next = v.n + delta;
        if (next < 1 || next > 8) return { ...v, side: delta, shake: v.shake + 1, energy: 0.1, ms: 150, press: delta };
        return { ...v, n: next, side: delta, gather: 1, energy: 0.7, ms: 120, press: delta };
      });
      await wait(140);
      set((v) => ({ ...v, gather: 0, energy: 0.25, ms: 650, press: 0 }));
      await wait(560);
    };
    await wait(700);
    for (const d of [1, 1, 1, -1, -1, -1, -1, -1]) await step(d);
    await wait(900);
    await step(1);
    await wait(1200);
  });
  const focusX = s.side < 0 ? STEP_H / 2 : STEP_W - STEP_H / 2;
  return (
    <Stage>
      <div className="flex flex-col items-center" style={{ marginTop: p(34) }}>
        <span style={{ fontSize: p(14), color: ground.muted }}>Dinner at Lupo · $186.40</span>
        <span className="tabular-nums" style={{ fontSize: p(46), lineHeight: 1.15, marginTop: p(4) }}><MorphText text={share(s.n)} /></span>
        <span style={{ fontSize: p(14), color: ground.muted }}>each</span>
        <span className="flex" style={{ gap: p(6), height: p(14), marginTop: p(18) }}>
          {Array.from({ length: s.n }, (_, i) => (
            <span key={i} className="rounded-full" style={{ width: p(14), height: p(14), background: DOTS[i % DOTS.length], animation: "aura-dot 360ms cubic-bezier(.3,1.5,.5,1)" }} />
          ))}
        </span>
      </div>
      <div className="absolute" style={{ bottom: p(46), left: `calc(50% - ${p(STEP_W / 2)})`, width: p(STEP_W), height: p(STEP_H), animation: s.shake ? `aura-shake-${s.shake % 2} 380ms ease-out` : undefined }}>
        <div className="aura-track absolute inset-0 flex items-center rounded-full" style={{ paddingInline: p((STEP_H - BUTTON) / 2), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", color: "#f4f3ef", fontSize: p(17) }}>
          {[-1, 0, 1].map((d) => d === 0 ? (
            <span key="c" className="flex flex-1 justify-center tabular-nums" style={{ gap: p(5) }}><MorphText text={String(s.n)} />{s.n === 1 ? "person" : "people"}</span>
          ) : (
            <span key={d} className="grid place-items-center rounded-full" style={{
              width: p(BUTTON), height: p(BUTTON), opacity: (d < 0 ? s.n > 1 : s.n < 8) ? 1 : 0.35,
              transform: `scale(${s.press === d ? 0.9 : 1})`, transition: "transform 160ms ease-out, opacity 200ms ease-out",
            }}>
              <Glyph d={d > 0 ? "M12 5v14M5 12h14" : "M5 12h14"} size={18} />
            </span>
          ))}
        </div>
        <Aura radius={STEP_H / 2} x={focusX} y={STEP_H / 2} gather={s.gather} energy={s.energy} ms={s.ms} />
      </div>
      <style>{`
@keyframes aura-dot { from { transform: scale(.2); opacity: 0; } }
@keyframes aura-shake-0 { 20% { transform: translateX(-8px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(2px); } }
@keyframes aura-shake-1 { 20% { transform: translateX(-8px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(2px); } }
`}</style>
    </Stage>
  );
}
