"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";

const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const meta: CSSProperties = { fontFamily: font.stack, fontSize: "1.7cqw", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" };
const body = (size: number, weight = 500): CSSProperties => ({ fontFamily: font.stack, fontSize: `${size}cqw`, fontWeight: weight, lineHeight: 1.25 });

/** Drag per step, in cqw: a short pull that springs back, a pull past the threshold, then a fly-off along that vector. */
const DRAG_STEPS = [
  { x: 0, y: 0, p: 0, ms: 1500, ease: "none" },
  { x: 3, y: 7, p: 0.5, ms: 900, ease: ".8s ease-in-out" },
  { x: 0, y: 0, p: 0, ms: 1100, ease: `.45s ${spring}` },
  { x: -5, y: 15, p: 1, ms: 1300, ease: ".8s ease-in-out" },
  { x: -34, y: 110, p: 1, ms: 520, ease: ".32s ease-out", gone: true },
  { x: -34, y: 110, p: 1, ms: 1100, ease: "none", gone: true, hidden: true },
];

/** DragToDismiss is a modifier, so the preview is the single card it moves: it follows the drag, rounds and shrinks
    with progress, the modifier's own scrim thins with it, then it springs back or flies off along the drag. */
export function DragToDismissPreview() {
  const [i, setI] = useState(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => { if (i + 1 === DRAG_STEPS.length) setCycle((c) => c + 1); setI((i + 1) % DRAG_STEPS.length); }, DRAG_STEPS[i].ms);
    return () => clearTimeout(t);
  }, [i]);
  const step = DRAG_STEPS[i], shown = !step.hidden, progress = step.p;
  const move = step.ease === "none" ? "none" : `transform ${step.ease}, opacity ${step.ease}`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack }}>
      {/* The scrim the modifier itself draws, thinning as the card travels. */}
      <div data-motion className="pointer-events-none absolute inset-0" style={{ background: ink, opacity: shown ? 0.5 * (1 - progress) : 0, transition: step.ease === "none" ? "none" : `opacity ${step.ease}` }} />
      {shown && (
        <div key={cycle} data-motion className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${step.x}cqw, ${step.y}cqw) scale(${1 - 0.15 * progress})`, opacity: step.gone ? 0 : 1, transition: move }}>
          <div className="flex flex-col" style={{ width: "42cqw", padding: "3.4cqw", borderRadius: "5.6cqw", background: blocks.butter, color: ink, boxShadow: "0 3cqw 7cqw rgba(0,0,0,.4)", transition: move }}>
            <div className="flex items-center justify-between">
              <span style={meta}>Boarding pass</span>
              <span className="rounded-full" style={{ ...body(1.8, 600), background: blocks.sky, padding: "0.6cqw 1.8cqw" }}>Group 2</span>
            </div>
            <p style={{ fontSize: "7.6cqw", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 0.95, marginTop: "3.2cqw" }}>SFO<br /><span style={{ opacity: 0.55 }}>to LIS</span></p>
            <div className="flex" style={{ gap: "3.8cqw", marginTop: "3.2cqw" }}>
              {[["Departs", "07:45"], ["Gate", "B12"], ["Seat", "14A"]].map(([k, v]) => (
                <span key={k} className="flex flex-col" style={{ gap: "0.4cqw" }}>
                  <span style={{ ...meta, fontSize: "1.4cqw", opacity: 0.6 }}>{k}</span>
                  <span style={{ fontSize: "4.4cqw", fontWeight: font.numeralWeight, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{v}</span>
                </span>
              ))}
            </div>
            <span className="block" style={{ height: 1.5, background: "rgba(20,20,20,.14)", marginBlock: "2.8cqw" }} />
            <div className="flex items-center justify-between">
              <span><span className="block" style={body(2.3, 600)}>Maya Lindqvist</span><span className="block" style={{ ...body(1.9, 400), opacity: 0.62 }}>Flight SP 208 · Boards 07:10</span></span>
              <svg viewBox="0 0 24 24" style={{ width: "5.4cqw" }} fill="none" stroke={ink} strokeWidth={1.8} aria-hidden><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" /></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
