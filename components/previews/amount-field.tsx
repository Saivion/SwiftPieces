"use client";
import { useEffect, useRef, useState } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Amount Field: a hero USD amount typed digit by digit with grouping appearing ("$1" to "$1,250.00"),
 * a quick-amount chip that sets the value, and a keystroke past the $2,500 limit refused with a shake.
 * Only the component (and the example's quick chips, which drive its binding) is shown.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the resting state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[], rest = 0) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(rest); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced, rest]);
  return steps[reduced ? rest : i];
}

/** The buffer is the typed text ("1250.0"); the display is en_US currency formatting of exactly what was typed. */
type AmountState = { typed: string; focused: boolean; chip?: number; refused?: boolean; ms: number };
const typing = ["", "1", "12", "125", "1250", "1250.", "1250.0", "1250.00"];
const steps: readonly AmountState[] = [
  ...typing.map((typed, i) => ({ typed, focused: true, ms: i === 0 ? 900 : i === typing.length - 1 ? 1600 : 330 })),
  { typed: "1250.00", focused: true, chip: 50, ms: 170 },
  { typed: "50", focused: true, ms: 800 },
  { typed: "500", focused: true, ms: 650 },
  { typed: "500", focused: true, refused: true, ms: 1900 },
  { typed: "500", focused: false, ms: 700 },
];
const REST = typing.length - 1;
const CHIPS = [[20, blocks.butter], [50, blocks.sky], [100, blocks.sage]] as const;

function format(typed: string) {
  if (!typed) return { number: "0", empty: true };
  const [whole, fraction] = typed.split(".");
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { number: fraction === undefined ? grouped : `${grouped}.${fraction}`, empty: false };
}

export function AmountFieldPreview() {
  const s = useSteps(steps, REST);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { number, empty } = format(s.typed);
  const size = Math.min(92, 360 / ((number.length + 1) * 0.56));

  useEffect(() => {
    if (!s.refused || reduced || !ref.current) return;
    const a = ref.current.animate([0, 8, 0, -5.8, 0, 3.4, 0, -1.2, 0].map((x) => ({ transform: `translateX(${u(x)})` })), { duration: 450, easing: "linear" });
    return () => a.cancel();
  }, [s.refused, reduced]);

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes af-roll{from{transform:translateY(45%);opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}@keyframes af-caret{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div className="flex flex-col items-center" style={{ width: u(440), gap: u(8) }}>
        <span style={{ fontSize: u(11), fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1, color: s.focused ? ground.text : ground.muted, transition: "color .2s" }}>Send</span>
        <div ref={ref} className="flex items-center justify-center" style={{ height: u(112), width: "100%" }}>
          <span data-motion className="flex items-center whitespace-nowrap tabular-nums" style={{ fontSize: u(size), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1, transition: `font-size .3s ${ease}` }}>
            <span style={{ color: ground.muted }}>$</span>
            <span style={{ color: empty ? ground.muted : ground.text }}>
              {number.split("").map((ch, i) => (
                <span key={`${i}:${ch}`} data-motion style={{ display: "inline-block", animation: `af-roll .28s ${ease} both` }}>{ch}</span>
              ))}
            </span>
            <span data-motion style={{
              width: s.focused ? u(3) : 0, marginInline: s.focused ? u(3) : 0, height: "0.78em", borderRadius: u(2), background: blocks.tangerine,
              animation: s.focused ? "af-caret 1.06s steps(1) infinite" : undefined, opacity: s.focused ? 1 : 0, transition: "width .2s, margin .2s",
            }} />
          </span>
        </div>
        <div data-motion className="grid" style={{ gridTemplateRows: s.refused ? "1fr" : "0fr", transition: `grid-template-rows .35s ${ease}` }}>
          <span data-motion className="min-h-0 overflow-hidden" style={{
            fontSize: u(13), fontWeight: 600, color: blocks.tangerine, opacity: s.refused ? 1 : 0,
            transform: s.refused ? "none" : `translateY(${u(-6)})`, transition: "opacity .3s, transform .3s",
          }}>Up to $2,500</span>
        </div>
        <div className="flex" style={{ gap: u(8), marginTop: u(18) }}>
          {CHIPS.map(([v, fill]) => {
            const down = s.chip === v;
            return (
              <span key={v} data-motion className="flex items-center justify-center rounded-full tabular-nums" style={{
                height: u(44), paddingInline: u(18), background: fill, color: ink, fontSize: u(15), fontWeight: 600,
                transform: `scale(${down ? 0.9 : 1})`, transition: `transform .3s ${spring}`,
              }}>${v}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
