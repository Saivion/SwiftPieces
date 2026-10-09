"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { cascade, curve, ms, pressScale, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, budStyle, liquid } from "./piece-liquid";

/*
 * Drag Select Grid: a grid in selection mode. A resting finger sinks the print as a hold builds, then
 * one drag paints a reading-order range: each print presses in as its glass badge floods signal red and
 * the check stamps down a beat later. The grid auto-scrolls while the finger sits at the bottom edge,
 * dragging back releases each print to what it was before, and a tap toggles a single cell. Done ends
 * selection mode: every badge melts back into its print's corner and the count melts into Done. A hold
 * turns it back on, the badges budding out of their corners ring by ring from the held print, and the
 * count buds out of Done with the first pick.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one iOS point is one px.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

const COLS = 4;
const GAP = 4;
const PAD = 12;
/** Thumbnail corner radius (Swift `cornerRadius: 10`). */
const RADIUS = 10;
const CELL = (560 - PAD * 2 - GAP * (COLS - 1)) / COLS;
const PITCH = CELL + GAP;
/** Selected prints inset under the badge, as Swift's `selectedScale`. */
const INSET = 0.86;
/** A building hold sinks the print about 2 points a side, slowly and with no overshoot, as in Swift. */
const HOLD_SCALE = pressScale(CELL, CELL, 2);
const HOLD: Spring = { duration: 0.5, bounce: 0 };
/** The hold shows only once the finger has rested this long, so a quick tap or swipe never dips a cell. */
const CUE_DELAY = 100;
const COUNT = 28;

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

/**
 * sel: selected indices. press: the cell under the finger. hold: the finger rests there, building a hold.
 * scroll: rows scrolled. glide: the auto-scroll's length when it spans more than this step.
 * off: selection mode is off. ring: the print a hold turned selection mode on at, which the badges spread from.
 * done: Done is pressed.
 */
type Step = { sel: number[]; press?: number; hold?: boolean; scroll: number; ms: number; glide?: number; off?: boolean; ring?: number; done?: boolean };

const BASE = [1, 2, 11];
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
/** Back up: the range shrinks and each cell returns to what it was before the drag (item 11 stays selected). */
const back = [14, 10, 9];
const scrollFor = (i: number) => Math.max(0, rowOf(i) - 2);
/** One row of auto-scroll at a steady speed. */
const ROW_GLIDE = 520;
/**
 * The finger rests in the edge band, so a new row is painted only once it has risen about halfway into view and
 * reached the finger. Until then the selection stays on the last cell, and the press and stamp play in view.
 */
const LEAD = 250;
const forwardSteps = forward.flatMap((c, k): Step[] => {
  const step: Step = { sel: paint(BASE, ANCHOR, c, true), press: c, scroll: scrollFor(c), ms: rowOf(c) >= 3 ? ROW_GLIDE : 200 };
  const prev = forward[k - 1];
  if (prev === undefined || scrollFor(prev) === step.scroll) return [step];
  // Mid-scroll, the next row's lead-in follows at once so the glide keeps one speed. The last row keeps its full
  // dwell, so its stamp lands before the finger moves on.
  const next = forward[k + 1];
  const gliding = next !== undefined && scrollFor(next) > step.scroll;
  return [
    { sel: paint(BASE, ANCHOR, prev, true), press: prev, scroll: step.scroll, ms: LEAD, glide: ROW_GLIDE },
    { ...step, ms: gliding ? ROW_GLIDE - LEAD : step.ms, glide: ROW_GLIDE },
  ];
});
const END = paint(BASE, ANCHOR, 9, true);
const AFTER_TAP = END.filter((k) => k !== 2);

const steps: readonly Step[] = [
  { sel: BASE, scroll: 0, ms: 1500 },
  // A 0.25s hold starts the paint in selection mode: the print sinks from 0.1s, and the selection takes over.
  { sel: BASE, press: ANCHOR, hold: true, scroll: 0, ms: 300 },
  ...forwardSteps,
  { sel: paint(BASE, ANCHOR, 18, true), press: 18, scroll: 2, ms: 500 },
  ...back.map((c, k): Step => ({ sel: paint(BASE, ANCHOR, c, true), press: c, scroll: k === 0 ? 2 : 1, ms: k === 0 ? 420 : 380 })),
  { sel: END, scroll: 1, ms: 900 },
  { sel: END, scroll: 0, ms: 1000 },
  { sel: END, press: 2, hold: true, scroll: 0, ms: 220 },
  { sel: AFTER_TAP, scroll: 0, ms: 1500 },
  // Done: the example clears the selection as it ends selection mode, so every badge melts into its corner.
  { sel: AFTER_TAP, scroll: 0, done: true, ms: 200 },
  { sel: [], off: true, scroll: 0, ms: 1500 },
  // A 0.45s hold outside selection mode turns it back on at print 1: the badges spread out ring by ring from it.
  { sel: [], off: true, press: 1, hold: true, scroll: 0, ms: 460 },
  { sel: [1], ring: 1, scroll: 0, ms: 1100 },
  { sel: [1], ring: 1, press: 2, scroll: 0, ms: 140 },
  { sel: [1, 2], ring: 1, scroll: 0, ms: 650 },
  // The tap on 11 lands on the loop's first state.
  { sel: [1, 2], ring: 1, press: 11, scroll: 0, ms: 140 },
];

/** The sample library's prints: small flat scenes in the house blocks, drawn in a 100 x 100 box so they read as photos,
 *  not icons. Swift draws the same scenes in a Canvas (`DragSelectGridSample.Scene`). */
const DUSK = "#262626", NIGHT = "#1c1c1c";
type Scene = (k: number) => ReactNode;
const SCENES: Scene[] = [
  // Hills under a sun.
  (k) => {
    const [sky, sun, near, far] = [[blocks.sky, blocks.butter, blocks.sage, blocks.lilac], [blocks.sand, blocks.tangerine, blocks.butter, blocks.sage], [blocks.lilac, blocks.butter, blocks.sky, blocks.sand]][k % 3];
    return <><rect width="100" height="100" fill={sky} /><circle cx="70" cy="32" r="13" fill={sun} /><ellipse cx="82" cy="104" rx="64" ry="34" fill={far} /><ellipse cx="22" cy="108" rx="70" ry="38" fill={near} /></>;
  },
  // Sun setting into the sea.
  (k) => {
    const [sky, sun, sea] = [[blocks.butter, blocks.tangerine, blocks.sky], [blocks.lilac, blocks.butter, blocks.sky], [blocks.sand, blocks.tangerine, blocks.lilac]][k % 3];
    return <><rect width="100" height="100" fill={sky} /><circle cx="50" cy="62" r="20" fill={sun} /><rect y="62" width="100" height="38" fill={sea} /><rect x="38" y="70" width="24" height="3" rx="1.5" fill={sun} opacity="0.7" /><rect x="44" y="78" width="12" height="3" rx="1.5" fill={sun} opacity="0.5" /></>;
  },
  // A portrait.
  (k) => {
    const [bg, coat] = [[blocks.lilac, ink], [blocks.sage, DUSK], [blocks.butter, ink]][k % 3];
    return <><rect width="100" height="100" fill={bg} /><circle cx="50" cy="42" r="15" fill={coat} /><ellipse cx="50" cy="106" rx="36" ry="34" fill={coat} /></>;
  },
  // Moon over dark hills.
  () => <><rect width="100" height="100" fill={DUSK} /><circle cx="66" cy="32" r="12" fill={blocks.butter} /><circle cx="24" cy="22" r="1.6" fill="#f4f3ef" /><circle cx="38" cy="40" r="1.2" fill="#f4f3ef" /><circle cx="16" cy="46" r="1" fill="#f4f3ef" /><ellipse cx="30" cy="106" rx="72" ry="30" fill={NIGHT} /></>,
  // An arch, with the sky through it.
  (k) => {
    const [wall, sky] = [[blocks.sand, blocks.sky], [blocks.tangerine, blocks.butter], [blocks.sage, blocks.lilac]][k % 3];
    return <><rect width="100" height="100" fill={wall} /><path d="M30 100V52a20 20 0 0 1 40 0v48z" fill={sky} /><circle cx="58" cy="50" r="6" fill={wall} opacity="0.5" /></>;
  },
  // Fields in bands.
  (k) => {
    const [a, b, c, sun] = [[blocks.sky, blocks.butter, blocks.sage, blocks.tangerine], [blocks.lilac, blocks.sand, blocks.butter, blocks.sky], [blocks.butter, blocks.sage, blocks.sky, blocks.tangerine]][k % 3];
    return <><rect width="100" height="100" fill={a} /><circle cx="74" cy="28" r="9" fill={sun} /><path d="M0 52q50-10 100 0v48H0z" fill={b} /><path d="M0 74q50-12 100 0v26H0z" fill={c} /></>;
  },
];
/** Seven prints a cycle against four columns, so no scene lines up in a column or sits beside itself, and the dark
 *  night scene comes round once a cycle. Each pass through the cycle takes the next colourway. */
const ORDER = [0, 4, 1, 2, 5, 3, 1];
const sceneOf = (i: number) => SCENES[ORDER[i % ORDER.length]](Math.floor(i / ORDER.length) + i);

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={signal.on} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: "56%", height: "56%" }}>
      <path d="M6 12.5l4 4 8-9" />
    </svg>
  );
}

/** The badge: 24 across, 7 in from the print's bottom trailing corner. */
const BADGE = 24, MARGIN = 7;
/** Home is just past the corner, shrunk, where the print's rounded clip hides it, as in Swift. */
const REACH = MARGIN + BADGE / 2 + (BADGE * liquid.homeScale) / 2 / Math.SQRT2 + 1;
/** Rows or columns between two prints: the ring a badge sits in around a held one. */
const ringOf = (a: number, b: number) => Math.max(Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)), Math.abs((a % COLS) - (b % COLS)));

function Cell({ i, selected, pressed, held, shown, ring }: { i: number; selected: boolean; pressed: boolean; held: boolean; shown: boolean; ring?: number }) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const video = i % 7 === 3;
  // Selecting presses the print in on the snap spring; clearing lets it back out on the morph's slight give,
  // so dragging back across a range reads as a soft release. The badge's tint and size ride the same spring.
  const inset = selected ? "snap" : "morph";
  // A hold that turned selection mode on spreads the badges out from the finger, a beat per ring; they melt home together.
  const delay = shown && ring !== undefined ? Math.min(ringOf(i, ring), 7) * 17 : 0;
  return (
    <div
      data-motion
      style={{
        position: "absolute", left: u(PAD + col * PITCH), top: u(PAD + row * PITCH), width: u(CELL), height: u(CELL),
        // The hold sink sits apart from the inset, as in Swift, so the selection takes over from wherever it got to.
        transform: `scale(${held ? HOLD_SCALE : 1})`,
        transition: held ? t("transform", HOLD, CUE_DELAY) : t("transform", "snap"),
      }}
    >
      <div
        data-motion
        style={{
          position: "absolute", inset: 0,
          borderRadius: u(RADIUS), overflow: "hidden",
          transform: `scale(${selected ? INSET : 1})`, transition: t("transform", inset),
        }}
      >
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {sceneOf(i)}
        </svg>
        {video ? (
          <>
            <div style={{ position: "absolute", inset: "55% 0 0", background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }} />
            <span style={{ position: "absolute", left: u(9), bottom: u(8), fontSize: u(12), color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              0:{String(12 + i).padStart(2, "0")}
            </span>
          </>
        ) : null}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: pressed ? 0.08 : 0, transition: t("opacity", "press") }} />
        <span
          data-motion
          style={{
            position: "absolute", right: u(MARGIN), bottom: u(MARGIN), width: u(BADGE), height: u(BADGE),
            // Counter the cell's inset so the badge keeps one size, as in Swift.
            transform: `scale(${selected ? 1 / INSET : 1})`, transformOrigin: "100% 100%",
            transition: t("transform", inset),
          }}
        >
          {/* The bud: out of the corner on the split spring, home past it on the bounceless one. */}
          <span data-motion style={{ display: "block", ...budStyle({ out: shown, home: [REACH, REACH] }, u(1)), transition: t("transform", shown ? liquid.split : liquid.home, delay) }}>
            {/* Clear glass with a light rim so it reads on any thumbnail; picked, it floods signal red. */}
            <Liquid tint={selected && shown ? signal.fill : undefined} className="relative flex items-center justify-center" style={{ width: u(BADGE), height: u(BADGE), transition: t("background-color", inset) }}>
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: `inset 0 0 0 ${u(1.8)} #fff` }} />
              {/* The stamp: a beat after the print starts pressing in, the check comes down onto the flooded badge and
                  lands with a visible give; cleared, it lifts off quickly. */}
              <BudContent out={shown}>
                <span
                  data-motion
                  style={{
                    display: "flex", width: u(BADGE), height: u(BADGE), alignItems: "center", justifyContent: "center",
                    transform: `scale(${selected ? 1 : 1.4})`, opacity: selected ? 1 : 0,
                    transition: selected ? t(["transform", "opacity"], "success", cascade(1, 50)) : t(["transform", "opacity"], "dismiss"),
                  }}
                >
                  <Check />
                </span>
              </BudContent>
            </Liquid>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Done's width at 16 px semibold, in points, so it can ease between its two labels. */
const DONE_W = { Done: 80, Select: 88 } as const;

/**
 * The example's selection toolbar, as in Swift: Done (Select outside selection mode) in signal glass, and the live count
 * in a glass pill joined to it. The count buds out of Done with the first pick, round while home and opening to its
 * width as it leaves, and melts back in when the selection empties or selection mode ends. It rolls on `value`: it is
 * read, so it never overshoots.
 */
function Bar({ count, selecting, pressed }: { count: number; selecting: boolean; pressed?: boolean }) {
  const out = selecting && count > 0;
  // While it melts away the pill keeps the count it had, as Swift's live label hides first.
  const kept = useRef(count);
  useEffect(() => { if (count > 0) kept.current = count; });
  const n = count || kept.current;
  const label = selecting ? "Done" : "Select";
  const spring = out ? liquid.split : liquid.home;
  // The count's full width, measured once outside the group (which draws its children twice), in CSS px.
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  // The first measurement lands without a transition, so the pill never widens on its own as the page loads.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const read = () => setWidth(el.offsetWidth);
    read();
    const frame = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, []);
  const text = (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: u(5), padding: `0 ${u(20)}`, fontSize: u(16), whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-block", minWidth: u(10), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <span key={n} style={{ display: "inline-block", animation: `dsg-roll ${ms("value")}ms ${curve("value").easing}` }}>{n}</span>
      </span>
      Selected
    </span>
  );
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: u(16), display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <span ref={measure} aria-hidden style={{ position: "absolute", visibility: "hidden", left: 0, top: 0 }}>{text}</span>
      <LiquidGroup unit={u(1)} axis="x">
        {/* The pair stays centred while the count is out. */}
        <div data-motion style={{ transform: `translateX(${out ? `calc((${width}px + ${u(liquid.joined)}) / 2)` : "0px"})`, transition: ready ? t("transform", spring) : "none" }}>
          <div className="relative flex">
            {/* At Done's trailing end and under it, so at home, round and shrunk, it sits inside Done. */}
            <span data-motion style={{ position: "absolute", top: 0, right: out ? `calc(100% + ${u(liquid.joined)})` : "0px", transform: `scale(${out ? 1 : liquid.homeScale})`, transition: t(["right", "transform"], spring) }}>
              <Liquid className="flex items-center overflow-hidden" style={{ height: u(48), width: out && width ? `${width}px` : u(48), transition: ready ? t("width", spring) : "none", color: ground.text }}>
                <BudContent out={out}>{text}</BudContent>
              </Liquid>
            </span>
            <span data-motion className="flex" style={{ transform: `scale(${pressed ? pressScale(DONE_W[label], 48) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
              <Liquid tint={signal.fill} className="flex items-center justify-center" style={{ height: u(48), width: u(DONE_W[label]), color: ink, fontSize: u(16), transition: t("width", "morph") }}>
                <MorphText text={label} />
              </Liquid>
            </span>
          </div>
        </div>
      </LiquidGroup>
      <style>{`@keyframes dsg-roll{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){[data-dsg] *{animation:none!important}}`}</style>
    </div>
  );
}

export function DragSelectGridPreview() {
  const s = useSteps(steps);
  const sel = new Set(s.sel);
  const selecting = !s.off;
  // Auto-scroll is driven by the finger resting in the edge band, so it runs at a steady speed for the whole glide
  // and stops when the finger leaves. Bringing the top back into view after the lift lands on the snap spring.
  const glide = s.press !== undefined ? `transform ${s.glide ?? s.ms}ms linear` : t("transform", "snap");
  return (
    <div data-dsg className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, fontWeight: 600 }}>
      <div data-motion style={{ position: "absolute", inset: 0, transform: `translateY(${u(-s.scroll * PITCH)})`, transition: glide }}>
        {Array.from({ length: COUNT }, (_, i) => <Cell key={i} i={i} selected={sel.has(i)} pressed={s.press === i} held={!!s.hold && s.press === i} shown={selecting || sel.has(i)} ring={s.ring} />)}
      </div>
      <Bar count={sel.size} selecting={selecting} pressed={s.done} />
    </div>
  );
}
