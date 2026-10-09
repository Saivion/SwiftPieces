"use client";
import { useEffect, useRef, useState } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { cascade, curve, pressScale, shake, t } from "./piece-motion";
import { Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Amount Field, as the liquid glass piece: a hero USD amount typed digit by digit in one semibold weight with grouping
 * appearing ("$1" to "$1,250.00") and the signal caret after the digits, a quick-amount chip from the example's joined
 * glass strip that sets the value, and a keystroke past the $2,500 limit refused with one knock, the butter limit pill
 * rising in a beat behind it; the key pressed again at once knocks softer. The figure is content and stays on the
 * ground. Only the component (and the example's quick chips, which drive its binding) is shown.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one px there is one iOS point.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

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

/**
 * The buffer is the typed text ("1250.0"); the display is en_US currency formatting of exactly what was typed.
 * `knock` is a refused key: 1 knocks at full height, 2 is the same key again within a second, a half-height knock.
 */
type AmountState = { typed: string; focused: boolean; chip?: number; knock?: 1 | 2; notice?: boolean; ms: number };
const typing = ["", "1", "12", "125", "1250", "1250.", "1250.0", "1250.00"];
const script: readonly AmountState[] = [
  ...typing.map((typed, i) => ({ typed, focused: true, ms: i === 0 ? 800 : i === typing.length - 1 ? 1200 : 330 })),
  { typed: "1250.00", focused: true, chip: 50, ms: 170 },
  { typed: "50", focused: true, ms: 650 },
  { typed: "500", focused: true, ms: 650 },
  { typed: "500", focused: true, knock: 1, notice: true, ms: 520 },
  // Swift's refusal clock (320 + 2080ms) restarts on each refused key, so the line clears 2.4s after the last knock.
  { typed: "500", focused: true, knock: 2, notice: true, ms: 2400 },
  { typed: "500", focused: true, ms: 350 },
  { typed: "500", focused: false, ms: 700 },
];
// Like `.numericText(value:)`, digits roll up into place when the amount grows and down when it shrinks.
const amount = (typed: string) => Number(typed || 0);
const steps = script.map((s, i) => ({ ...s, rise: amount(s.typed) >= amount(script[(i + script.length - 1) % script.length].typed) }));
const REST = typing.length - 1;
const CHIPS = [20, 50, 100] as const;
const HERO = 92;
/** The limit pill's height. */
const PILL = 28;

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
  // The figure keeps its size and scales to fit, as Swift's `scaleEffect(fit)` does, on the digits' own `value`
  // spring: it shrinks while a digit rolls in and never swells past the width it was fitted to.
  const fit = Math.min(1, 360 / ((number.length + 1) * 0.56) / HERO);
  // The roll travels on `value`; opacity arrives on `press`, so a replaced figure never reads as a bare "$".
  const roll = curve("value");
  const fade = curve("press");
  const shown = !!s.notice;

  // One knock per refused key, with no wobble after it; a quick repeat knocks at half height instead of escalating.
  useEffect(() => {
    if (!s.knock || reduced || !ref.current) return;
    const a = ref.current.animate(...shake(u, s.knock === 2 ? 4 : 8));
    return () => a.cancel();
  }, [s.knock, reduced]);

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      {/* The caret holds solid for 530ms after each change, then blinks with a 100ms fade like the system caret. */}
      <style>{`@keyframes amf-rise{from{transform:translateY(var(--amf-from));filter:blur(2px)}to{transform:none;filter:none}}@keyframes amf-fade{from{opacity:0}to{opacity:1}}@keyframes amf-caret{0%,59.43%,100%{opacity:1}9.43%,50%{opacity:0}}`}</style>
      <div className="flex flex-col items-center" style={{ width: u(440), gap: u(8) }}>
        <span style={{ fontSize: u(11), fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1, color: s.focused ? ground.text : ground.muted, transition: t("color", "snap") }}>Send</span>
        <div ref={ref} className="flex items-center justify-center" style={{ height: u(112), width: "100%" }}>
          <span data-motion className="flex items-center whitespace-nowrap tabular-nums" style={{
            fontSize: u(HERO), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1,
            transform: `scale(${fit.toFixed(4)})`, transition: t("transform", "value"),
            ["--amf-from" as string]: s.rise ? "45%" : "-45%",
          }}>
            <span style={{ color: ground.muted }}>$</span>
            <span style={{ color: empty ? ground.muted : ground.text }}>
              {number.split("").map((ch, i) => (
                <span key={`${i}:${ch}`} data-motion style={{ display: "inline-block", animation: `amf-rise ${roll.ms}ms ${roll.easing} both, amf-fade ${fade.ms}ms ${fade.easing} both` }}>{ch}</span>
              ))}
            </span>
            <span data-motion className="flex justify-center overflow-hidden" style={{
              width: s.focused ? u(9) : 0, height: "0.78em", opacity: s.focused ? 1 : 0, transition: t(["width", "opacity"], "snap"),
            }}>
              <span key={s.typed} style={{
                flex: "none", width: u(3), height: "100%", borderRadius: u(2), background: signal.fill,
                animation: s.focused ? "amf-caret 1060ms ease-in-out 530ms infinite both" : undefined,
              }} />
            </span>
          </span>
        </div>
        {/* The knock leads; the butter pill rises in a beat behind it and opens its own room on the same spring. The
            hero figure has no glass of its own for it to bud from, so it arrives on `reveal`. It leaves quickly. */}
        <div data-motion className="grid" style={{ gridTemplateRows: shown ? "1fr" : "0fr", transition: shown ? t("grid-template-rows", "reveal", cascade(2)) : t("grid-template-rows", "dismiss") }}>
          <div className="flex min-h-0 justify-center" style={{ overflow: "visible" }}>
            <div data-motion style={{
              opacity: shown ? 1 : 0, transform: shown ? "none" : `translateY(${u(-6)})`,
              transition: shown ? t(["opacity", "transform"], "reveal", cascade(2)) : t(["opacity", "transform"], "dismiss"),
            }}>
              <LiquidGroup unit={u(1)}>
                <Liquid tint={blocks.butter} className="flex items-center" style={{ height: u(PILL), paddingInline: u(12), fontSize: u(13), color: ink }}>Up to $2,500</Liquid>
              </LiquidGroup>
            </div>
          </div>
        </div>
        {/* The example's quick amounts: neutral glass capsules resting joined, one liquid strip. */}
        <div style={{ marginTop: u(18) }}>
          <LiquidGroup unit={u(1)}>
            <div className="flex" style={{ gap: u(liquid.joined) }}>
              {CHIPS.map((v) => {
                const down = s.chip === v;
                return (
                  <span key={v} data-motion className="flex" style={{ transform: `scale(${down ? pressScale(v < 100 ? 63 : 72, 44) : 1})`, transition: t("transform", down ? "press" : "release") }}>
                    <Liquid className="flex items-center justify-center tabular-nums" style={{ height: u(44), paddingInline: u(18), color: ground.text, fontSize: u(15) }}>${v}</Liquid>
                  </span>
                );
              })}
            </div>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}
