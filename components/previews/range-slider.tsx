"use client";
import { useEffect, useState } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Range Slider: a price filter with a header readout and an age range with chips above the thumbs.
 * The component only: two thumbs on a quiet track, the selected span as a solid block, and the readouts it draws.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const follow = "cubic-bezier(0.2, 0.8, 0.3, 1)";
const W = 440; // track width
const THUMB = 28;
const TRACK = 8;
const TARGET = 44;
const CHIP_H = 26;

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

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the first (resting) state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return steps[i];
}

type Grab = "" | "pl" | "pu" | "al" | "au";
type State = { p: [number, number]; a: [number, number]; grab: Grab; ms: number };

const P = (lo: number, hi: number): [number, number] => [lo, hi];
const rest = { p: P(120, 480), a: P(24, 41) };
const steps: readonly State[] = [
  { ...rest, grab: "", ms: 1500 },
  { ...rest, p: P(120, 480), grab: "pl", ms: 200 },
  { ...rest, p: P(170, 480), grab: "pl", ms: 180 },
  { ...rest, p: P(220, 480), grab: "pl", ms: 180 },
  { ...rest, p: P(260, 480), grab: "pl", ms: 260 },
  { ...rest, p: P(260, 480), grab: "", ms: 600 },
  { ...rest, p: P(260, 480), grab: "pu", ms: 200 },
  { ...rest, p: P(260, 420), grab: "pu", ms: 180 },
  { ...rest, p: P(260, 370), grab: "pu", ms: 180 },
  { ...rest, p: P(260, 340), grab: "pu", ms: 260 },
  { ...rest, p: P(260, 340), grab: "", ms: 700 },
  { p: P(260, 340), a: P(24, 41), grab: "al", ms: 200 },
  { p: P(260, 340), a: P(28, 41), grab: "al", ms: 170 },
  { p: P(260, 340), a: P(32, 41), grab: "al", ms: 170 },
  { p: P(260, 340), a: P(36, 41), grab: "al", ms: 420 },
  { p: P(260, 340), a: P(36, 41), grab: "", ms: 700 },
  { p: P(260, 340), a: P(36, 41), grab: "au", ms: 200 },
  { p: P(260, 340), a: P(36, 47), grab: "au", ms: 170 },
  { p: P(260, 340), a: P(36, 54), grab: "au", ms: 260 },
  { p: P(260, 340), a: P(36, 54), grab: "", ms: 1200 },
  { ...rest, grab: "", ms: 900 },
];

/** Thumb center in px for a value, inset by the thumb radius like the Swift track. */
const xAt = (v: number, lo: number, hi: number) => THUMB / 2 + ((v - lo) / (hi - lo)) * (W - THUMB);
/** Estimated chip width at 13 px semibold tabular digits. */
const chipWidth = (text: string) => 20 + text.length * 7.6;
const clamp = (x: number, w: number) => Math.min(Math.max(x, w / 2), W - w / 2);

function Chip({ text, x, lit, fill, shown }: { text: string; x: number; lit: boolean; fill: string; shown: boolean }) {
  const w = chipWidth(text);
  return (
    <span data-motion className="absolute top-0 flex items-center justify-center rounded-full tabular-nums whitespace-nowrap" style={{
      left: u(clamp(x, w) - w / 2), width: u(w), height: u(CHIP_H), fontSize: u(13), fontWeight: 600,
      background: lit ? fill : ground.raised, color: lit ? ink : ground.text, opacity: shown ? 1 : 0,
      transition: `left .18s ${follow}, width .18s ${follow}, background-color .2s, color .2s, opacity .18s`,
    }}>{text}</span>
  );
}

function Track({ lo, hi, min, max, fill, grab }: { lo: number; hi: number; min: number; max: number; fill: string; grab: "" | "l" | "u" }) {
  const lx = xAt(lo, min, max), hx = xAt(hi, min, max);
  const thumb = (x: number, grabbed: boolean) => (
    <span data-motion className="absolute rounded-full" style={{
      left: u(x - THUMB / 2), top: u((TARGET - THUMB) / 2), width: u(THUMB), height: u(THUMB), background: ground.text,
      boxShadow: `inset 0 0 0 ${u(grabbed ? 3 : 2)} ${ink}, 0 ${u(grabbed ? 3 : 1)} ${u(grabbed ? 6 : 3)} rgba(0,0,0,${grabbed ? 0.45 : 0.3})`,
      transform: `scale(${grabbed ? 1.18 : 1})`, zIndex: grabbed ? 2 : 1,
      transition: `left .18s ${follow}, transform .3s ${spring}, box-shadow .2s`,
    }} />
  );
  return (
    <div className="relative" style={{ width: u(W), height: u(TARGET) }}>
      <div className="absolute inset-x-0 overflow-hidden rounded-full" style={{ top: u((TARGET - TRACK) / 2), height: u(TRACK), background: "#2a2a2a" }}>
        <span data-motion className="absolute inset-y-0" style={{ left: u(lx), width: u(hx - lx), background: fill, transition: `left .18s ${follow}, width .18s ${follow}` }} />
      </div>
      {thumb(lx, grab === "l")}
      {thumb(hx, grab === "u")}
    </div>
  );
}

export function RangeSliderPreview() {
  const s = useSteps(steps);
  const [pl, pu] = s.p, [al, au] = s.a;
  const money = (v: number) => `$${v}`;

  // Age chips: separate above each thumb, merged into one when they would touch (6 px gap), as the Swift piece does.
  const ax = xAt(al, 18, 80), bx = xAt(au, 18, 80);
  const lw = chipWidth(String(al)), uw = chipWidth(String(au));
  const merged = clamp(ax, lw) + lw / 2 + 6 > clamp(bx, uw) - uw / 2;
  const ageGrab = s.grab === "al" ? "l" : s.grab === "au" ? "u" : "";

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <div className="flex flex-col" style={{ width: u(W), gap: u(40) }}>
        <div className="flex flex-col" style={{ gap: u(10) }}>
          <div className="flex items-baseline tabular-nums" style={{ gap: u(8), fontSize: u(20), fontWeight: 600, lineHeight: 1.2 }}>
            <span>{money(pl)}</span><span style={{ color: ground.muted }}>–</span><span>{money(pu)}</span>
          </div>
          <Track lo={pl} hi={pu} min={0} max={1000} fill={blocks.tangerine} grab={s.grab === "pl" ? "l" : s.grab === "pu" ? "u" : ""} />
        </div>
        <div className="flex flex-col" style={{ gap: u(8) }}>
          <div className="relative" style={{ height: u(CHIP_H) }}>
            <Chip text={String(al)} x={ax} lit={ageGrab === "l"} fill={blocks.sage} shown={!merged} />
            <Chip text={String(au)} x={bx} lit={ageGrab === "u"} fill={blocks.sage} shown={!merged} />
            <Chip text={`${al} – ${au}`} x={(ax + bx) / 2} lit={ageGrab !== ""} fill={blocks.sage} shown={merged} />
          </div>
          <Track lo={al} hi={au} min={18} max={80} fill={blocks.sage} grab={ageGrab} />
        </div>
      </div>
    </div>
  );
}
