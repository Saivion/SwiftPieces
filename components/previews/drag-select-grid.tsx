"use client";
import { useEffect, useState, type ReactNode } from "react";
import { blocks, ground, ink } from "./palette";

/*
 * Drag Select Grid: a grid in selection mode. One drag paints a reading-order range (the cell under
 * the finger dips), the grid auto-scrolls a row when the finger reaches the bottom edge, dragging
 * back unpaints to what was there before, and a tap toggles a single cell.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

const COLS = 4;
const GAP = 5;
const PAD = 14;
const CELL = (560 - PAD * 2 - GAP * (COLS - 1)) / COLS;
const PITCH = CELL + GAP;
const COUNT = 28;
const TINTS = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand];

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

/** sel: selected indices. press: the cell under the finger. scroll: rows scrolled. */
type Step = { sel: number[]; press?: number; scroll: number; ms: number };

const BASE = [1, 2, 13];
/** The Swift rule: the selection is the drag's starting snapshot with the anchor...current range applied. */
const paint = (base: number[], anchor: number, current: number, selects: boolean) => {
  const set = new Set(base);
  for (let k = Math.min(anchor, current); k <= Math.max(anchor, current); k++) selects ? set.add(k) : set.delete(k);
  return [...set];
};

const ANCHOR = 5;
const rowOf = (i: number) => Math.floor(i / COLS);
/** The finger: sideways across row 1, then down a row at a time; rows 3 and 4 arrive by auto-scroll at the bottom edge. */
const forward = [5, 6, 7, 11, 15, 19, 18];
/** Back up: the range shrinks and each cell returns to what it was before the drag (item 13 stays selected). */
const back = [14, 10, 9];
const scrollFor = (i: number) => Math.max(0, rowOf(i) - 2);
const END = paint(BASE, ANCHOR, 9, true);
const AFTER_TAP = END.filter((k) => k !== 2);

const steps: readonly Step[] = [
  { sel: BASE, scroll: 0, ms: 1500 },
  { sel: BASE, press: ANCHOR, scroll: 0, ms: 280 },
  ...forward.map((c): Step => ({ sel: paint(BASE, ANCHOR, c, true), press: c, scroll: scrollFor(c), ms: rowOf(c) >= 3 ? 520 : 200 })),
  { sel: paint(BASE, ANCHOR, 18, true), press: 18, scroll: 2, ms: 500 },
  ...back.map((c, k): Step => ({ sel: paint(BASE, ANCHOR, c, true), press: c, scroll: k === 0 ? 2 : 1, ms: k === 0 ? 420 : 380 })),
  { sel: END, scroll: 1, ms: 900 },
  { sel: END, scroll: 0, ms: 1000 },
  { sel: END, press: 2, scroll: 0, ms: 220 },
  { sel: AFTER_TAP, scroll: 0, ms: 1700 },
];

/** Simple glyphs, one per thumbnail, drawn the way SF Symbols' outline set reads at small sizes. */
const GLYPHS: ReactNode[] = [
  <path key="m" d="M3 18l6-9 4 5 3-3 5 7z" />,
  <g key="s"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></g>,
  <path key="l" d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7" />,
  <path key="n" d="M16 15.5A7 7 0 0 1 9.5 5a7 7 0 1 0 9.5 9.2 7 7 0 0 1-3 1.3z" />,
  <path key="c" d="M4 9h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10h1.5a2.5 2.5 0 0 1 0 5H16" />,
  <path key="w" d="M3 15c3-3 6 3 9 0s6 3 9 0M3 10c3-3 6 3 9 0s6 3 9 0" />,
];

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="#f4f3ef" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ width: "54%", height: "54%" }}>
      <path d="M6 12.5l4 4 8-9" />
    </svg>
  );
}

function Cell({ i, selected, pressed }: { i: number; selected: boolean; pressed: boolean }) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const scale = (selected ? 0.86 : 1) * (pressed ? 0.95 : 1);
  const video = i % 7 === 3;
  return (
    <div
      data-motion
      style={{
        position: "absolute", left: u(PAD + col * PITCH), top: u(PAD + row * PITCH), width: u(CELL), height: u(CELL),
        borderRadius: u(12), overflow: "hidden", background: TINTS[(i * 7 + Math.floor(i / 5)) % TINTS.length],
        transform: `scale(${scale})`, transition: `transform .34s ${spring}`,
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={ink} strokeOpacity={0.7} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
        style={{ position: "absolute", left: "50%", top: "50%", width: u(34), height: u(34), transform: "translate(-50%,-50%)" }}>
        {GLYPHS[(i * 5 + Math.floor(i / 4)) % GLYPHS.length]}
      </svg>
      {video ? (
        <span style={{ position: "absolute", left: u(8), bottom: u(7), fontSize: u(12), fontWeight: 600, color: ink, fontVariantNumeric: "tabular-nums" }}>
          0:{String(12 + i).padStart(2, "0")}
        </span>
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: pressed ? 0.06 : 0, transition: "opacity .15s" }} />
      <span
        style={{
          position: "absolute", right: u(7), bottom: u(7), width: u(25), height: u(25), borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: selected ? ink : "rgba(0,0,0,0.16)", boxShadow: `inset 0 0 0 ${u(1.8)} #fff, 0 ${u(1)} ${u(3)} rgba(0,0,0,0.28)`,
          // Counter the cell's inset so the badge keeps one size, as in Swift.
          transform: `scale(${selected ? 1 / 0.86 : 1})`, transformOrigin: "100% 100%",
          transition: `background-color .18s, transform .34s ${spring}`,
        }}
      >
        <span data-motion style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", transform: `scale(${selected ? 1 : 0.3})`, opacity: selected ? 1 : 0, transition: `transform .32s ${spring}, opacity .16s` }}>
          <Check />
        </span>
      </span>
    </div>
  );
}

export function DragSelectGridPreview() {
  const s = useSteps(steps);
  const sel = new Set(s.sel);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg }}>
      <div data-motion style={{ position: "absolute", inset: 0, transform: `translateY(${u(-s.scroll * PITCH)})`, transition: `transform .55s ${ease}` }}>
        {Array.from({ length: COUNT }, (_, i) => <Cell key={i} i={i} selected={sel.has(i)} pressed={s.press === i} />)}
      </div>
    </div>
  );
}
