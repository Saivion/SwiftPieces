"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, springValue, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Date Range Picker: a stay picked on the March grid, then a page turn to April and back, then the original range picked
 * again so the loop closes on its resting state. The grid stays as it is and the selection is liquid glass over it, as
 * in the Swift piece: a touch presses a small clear bubble into the day and lifting swells it into a red start bubble;
 * the end lands the same way and the band pours out of the start along each week and into the end, joined to both by
 * necks. Starting over drains the old band back into its start while its bubbles shrink away. An end tap across the
 * sold-out 27th and 28th is refused: the bubble swells butter as the day shakes, then melts away, and the chip turns
 * butter with the notice; the next tap closes the range, so the chip morphs to the length on that beat.
 * Only what the component renders: its summary line, month header, weekday row and grid.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; on the glass, one px is one point.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

/** The Swift `Style.standard` values: neutral glass for the band and month buttons, signal for the endpoints, butter
 *  for a refusal. */
const card = ground.surface, disabled = ground.subtle, warning = blocks.butter;
/** Days a pending start cannot reach: Swift's muted text at 55%. */
const dim = `color-mix(in srgb, ${ground.muted} 55%, transparent)`;

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

type Month = { key: "mar" | "apr"; title: string; lead: number; days: number; blocked: number[] };
const months: readonly Month[] = [
  { key: "mar", title: "March 2026", lead: 0, days: 31, blocked: [27, 28] },
  { key: "apr", title: "April 2026", lead: 3, days: 30, blocked: [8] },
];
const TODAY = 3; // March 3

/**
 * page: 0 March, 1 April. lo/hi: the range on March (hi 0 while only a start is pending). press: the day under the finger;
 * the selection changes on the next step, when it lifts. nav: the month button under the finger. refuse: the end day just
 * refused. notice: the refusal notice is up.
 */
type Step = { page: 0 | 1; lo: number; hi: number; press?: number; nav?: "back" | "next"; refuse?: number; notice?: boolean; ms: number };
const script: readonly Step[] = [
  { page: 0, lo: 4, hi: 9, ms: 1700 },
  { page: 0, lo: 4, hi: 9, press: 12, ms: 180 },
  { page: 0, lo: 12, hi: 0, ms: 750 },
  // 29 would span the sold-out 27th and 28th: refused. The next tap lands well inside Swift's 2.2s notice, and closing
  // the range clears it (Swift's clearNotice), so the chip morphs to the length on the success beat.
  { page: 0, lo: 12, hi: 0, press: 29, ms: 180 },
  { page: 0, lo: 12, hi: 0, refuse: 29, notice: true, ms: 1000 },
  { page: 0, lo: 12, hi: 0, press: 24, notice: true, ms: 180 },
  { page: 0, lo: 12, hi: 24, ms: 1700 },
  { page: 0, lo: 12, hi: 24, nav: "next", ms: 150 },
  { page: 1, lo: 12, hi: 24, ms: 1300 },
  { page: 1, lo: 12, hi: 24, nav: "back", ms: 150 },
  { page: 0, lo: 12, hi: 24, ms: 1000 },
  { page: 0, lo: 12, hi: 24, press: 4, ms: 180 },
  { page: 0, lo: 4, hi: 0, ms: 700 },
  { page: 0, lo: 4, hi: 0, press: 9, ms: 180 },
];

/** Each step also carries the last completed range, so an erased band drains in the shape it had. */
const steps = script.map((s, i) => {
  for (let k = 0; k < script.length; k++) {
    const p = script[(i - k + script.length) % script.length];
    if (p.hi > p.lo) return { ...s, drawn: { lo: p.lo, hi: p.hi } };
  }
  return { ...s, drawn: { lo: s.lo, hi: s.hi } };
});
type Scene = (typeof steps)[number];

/** The grid as Swift lays it out: 7 columns across 340 px, rows as tall as a day cell. */
const GRID_W = 340, CELL_H = 38, COLS = 7, ROWS = 6, CELL = GRID_W / COLS;
/** A bubble fills the cell less 4 px; the band runs at 76% of its height and rests a joined gap short of it. */
const BUBBLE = Math.min(CELL, CELL_H) - 4, BAND = Math.round(BUBBLE * 0.76);
const PAGER = 44;
const home: Spring = liquid.home, split: Spring = liquid.split;

/** Seconds until a spring has covered `fraction` of its way. */
function reach(spring: Spring, fraction: number) {
  for (let s = 0; s < 2; s += 0.002) if (springValue(spring, s) >= fraction) return s;
  return 2;
}

/**
 * One week row's piece of a band: where it rests, and when the pen crosses it. The pen pours the range in at most half a
 * second, quick off the start and easing into the end (it covers 1.5t - 0.5t^2 of the range by time t), and drains it
 * back on the bounceless home spring; each row grows or empties linearly while the pen is in it, as Swift draws it.
 */
function piece(lo: number, hi: number, row: number, month: Month) {
  const days = hi - lo;
  let first = -1, last = -1;
  for (let c = 0; c < COLS; c++) {
    const d = row * COLS + c - month.lead + 1;
    if (d >= 1 && d <= month.days && d >= lo && d <= hi) { if (first < 0) first = c; last = c; }
  }
  if (first < 0) return null;
  const firstDay = row * COLS + first - month.lead + 1, lastDay = row * COLS + last - month.lead + 1;
  const lead = firstDay === lo ? (first + 0.5) * CELL + BUBBLE / 2 + liquid.joined : first * CELL + 2;
  const trail = lastDay === hi ? (last + 0.5) * CELL - BUBBLE / 2 - liquid.joined : (last + 1) * CELL - 2;
  if (trail - lead <= 1) return null;
  // Where the pen is, in days from the start, at each end of the piece.
  const pen = (x: number) => firstDay - lo - 0.5 + (x - first * CELL) / CELL;
  const total = Math.min(0.15 + 0.03 * Math.max(days, 1), 0.5);
  const pour = (covered: number) => total * (1.5 - Math.sqrt(2.25 - 2 * Math.min(Math.max(covered, 0), 1)));
  const drain = (covered: number) => reach(home, 1 - Math.min(Math.max(covered, 0), 1));
  const width = trail - lead;
  // A drop that lengthens into the band: it reaches full thickness this far into its row.
  const thick = Math.min(1, BAND / width);
  const ms = (s: number) => Math.round(s * 1000);
  const [in0, in1] = [pour(pen(lead) / days), pour(pen(trail) / days)];
  const [out0, out1] = [drain(pen(trail) / days), drain(pen(lead) / days)];
  return {
    lead, width,
    fill: `width ${ms(in1 - in0)}ms linear ${ms(in0)}ms, height ${ms((in1 - in0) * thick)}ms linear ${ms(in0)}ms`,
    empty: `width ${ms(out1 - out0)}ms linear ${ms(out0)}ms, height ${ms((out1 - out0) * thick)}ms linear ${ms(out0 + (out1 - out0) * (1 - thick))}ms`,
  };
}

/** True one frame after mount, so a band that arrives with its range pours in rather than appearing drawn. */
function useLanded(key: string) {
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(key)));
    return () => cancelAnimationFrame(id);
  }, [key]);
  return landed === key;
}

/**
 * A round bubble centred on a cell, scaled by its wrapper: Liquid Glass on the web can't fade (the goo would flatten
 * it), so a bubble with nothing to melt into shrinks away where it is instead of fading there.
 */
function Bubble({ column, scale, transition, tint, shake }: { column: number; scale: number; transition: string; tint?: string; shake?: boolean }) {
  return (
    <span data-motion className="absolute" style={{
      left: u((column + 0.5) * CELL - BUBBLE / 2), top: u((CELL_H - BUBBLE) / 2), width: u(BUBBLE), height: u(BUBBLE),
      transform: `scale(${scale})`, transition, animation: shake ? "drp-shake 380ms ease-out" : undefined,
    }}>
      <Liquid tint={tint} style={{ width: "100%", height: "100%", transition: `background-color ${curve(split).ms}ms` }} />
    </span>
  );
}

function Row({ row, month, s, pressed, flare }: { row: number; month: Month; s: Scene; pressed?: number; flare?: { day: number; lit: boolean } }) {
  const onMarch = month.key === "mar";
  const drawn = onMarch ? s.drawn : null;
  const complete = onMarch && s.hi > s.lo;
  const band = drawn ? piece(drawn.lo, drawn.hi, row, month) : null;
  const show = complete && drawn !== null && s.lo === drawn.lo && s.hi === drawn.hi;
  const landed = useLanded(drawn ? `${drawn.lo}-${drawn.hi}` : "none");
  const grow = show && landed;
  const column = (d: number) => {
    const i = d + month.lead - 1;
    return Math.floor(i / COLS) === row ? i % COLS : -1;
  };
  // Every March day that can carry a bubble keeps one mounted, so it swells out of the press and shrinks away in place.
  const days = onMarch ? Array.from({ length: COLS }, (_, c) => row * COLS + c - month.lead + 1).filter((d) => d >= 1 && d <= month.days) : [];
  return (
    <div className="absolute inset-0">
      <LiquidGroup unit={u(1)} style={{ width: "100%", height: "100%" }}>
        <div className="relative" style={{ width: u(GRID_W), height: u(CELL_H) }}>
          {band ? (
            <span data-motion className="absolute" style={{
              left: u(band.lead), top: "50%", transform: "translateY(-50%)",
              width: u(grow ? band.width : 0), height: u(grow ? BAND : 0), transition: grow ? band.fill : band.empty,
            }}>
              <Liquid style={{ width: "100%", height: "100%" }} />
            </span>
          ) : null}
          {days.map((d) => {
            const endpoint = d === s.lo || (s.hi > 0 && d === s.hi);
            const ghost = pressed === d && !endpoint;
            const lit = flare?.day === d && flare.lit;
            return (
              <span key={d}>
                {/* The finger's press: a small clear bubble, the start of the one a tap swells. */}
                <Bubble column={column(d)} scale={ghost ? liquid.homeScale : 0} transition={t("transform", ghost ? "press" : "dismiss")} />
                {/* A refused day: it swells into butter as the day shakes, holds a beat, then melts away. */}
                {flare?.day === d ? <Bubble column={column(d)} scale={lit ? 1 : 0} transition={t("transform", lit ? "error" : home)} tint={lit ? warning : undefined} shake={lit} /> : null}
                {/* Red only while it is out: it drains as it shrinks away. */}
                <Bubble column={column(d)} scale={endpoint ? 1 : 0} transition={t("transform", endpoint ? split : home)} tint={endpoint ? signal.fill : undefined} />
              </span>
            );
          })}
        </div>
      </LiquidGroup>
    </div>
  );
}

function Grid({ month, s }: { month: Month; s: Scene }) {
  const onMarch = month.key === "mar";
  const lo = onMarch ? s.lo : 0, hi = onMarch ? s.hi : 0;
  const pending = onMarch && s.hi === 0;
  let limit = lo;
  if (pending) while (limit < month.days && !month.blocked.includes(limit + 1)) limit++;
  // The refused day's flare: lit for a beat, then it melts. Kept above the rows' glass, which draws twice.
  const [flare, setFlare] = useState<{ day: number; lit: boolean } | undefined>();
  const refused = onMarch ? s.refuse : undefined;
  useEffect(() => {
    if (!refused) return;
    setFlare({ day: refused, lit: true });
    const a = setTimeout(() => setFlare({ day: refused, lit: false }), 500);
    const b = setTimeout(() => setFlare(undefined), 1000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [refused]);
  return (
    // Each month runs out to the card's edges and keeps its days inset, so the glass's lift fades before it is clipped.
    <div className="shrink-0" style={{ width: "100%", paddingInline: u(16), paddingBottom: u(16), paddingTop: u(8), boxSizing: "border-box" }}>
      {Array.from({ length: ROWS }, (_, row) => (
        <div key={row} className="relative grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: u(GRID_W) }}>
          <Row row={row} month={month} s={s} pressed={onMarch ? s.press : undefined} flare={flare} />
          {Array.from({ length: COLS }, (_, c) => {
            const d = row * COLS + c - month.lead + 1;
            if (d < 1 || d > month.days) return <span key={c} style={{ height: u(CELL_H) }} />;
            const blocked = month.blocked.includes(d);
            const endpoint = d === lo || (hi > 0 && d === hi);
            const lit = flare?.day === d && flare.lit;
            const past = onMarch && d < TODAY;
            const outOfReach = pending && !blocked && d > limit;
            return (
              <span key={c} className="relative flex items-center justify-center" style={{ height: u(CELL_H) }}>
                <span data-motion className="relative tabular-nums" style={{
                  fontSize: u(15), fontWeight: 600, lineHeight: 1,
                  color: endpoint || lit ? ink : blocked || past ? disabled : outOfReach ? dim : ground.text,
                  textDecoration: blocked ? `line-through ${disabled}` : undefined,
                  // The ink turns with its bubble's red; days out of reach dim softly and come back quicker.
                  transition: t("color", endpoint ? split : lit ? "error" : outOfReach ? "reveal" : home),
                  animation: lit ? "drp-shake 380ms ease-out" : undefined,
                }}>{d}</span>
                {onMarch && d === TODAY ? <span className="absolute rounded-full" style={{ bottom: u(CELL_H * 0.14), width: u(4), height: u(4), background: endpoint ? ink : signal.fill }} /> : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The month buttons: a joined pair of glass bubbles. At March, back melts into next and buds out again for April. */
function Pager({ page, nav }: { page: 0 | 1; nav?: "back" | "next" }) {
  const backOut = page > 0;
  const toward = PAGER / 2 + liquid.joined + (PAGER * liquid.homeScale) / 2;
  const chevron = (back: boolean, out: boolean) => (
    <span data-motion className="flex" style={{ transform: `scale(${nav === (back ? "back" : "next") ? 0.92 : 1})`, transition: t("transform", nav ? "press" : "release"), zIndex: out ? 1 : 0, position: "relative" }}>
      <Liquid bud={{ out, home: [back ? toward : -toward, 0] }} className="flex items-center justify-center" style={{ width: u(PAGER), height: u(PAGER) }}>
        <BudContent out={out}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={ground.text} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(15), height: u(15) }}>
            <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
          </svg>
        </BudContent>
      </Liquid>
    </span>
  );
  return (
    <LiquidGroup unit={u(1)}>
      <span className="flex" style={{ gap: u(liquid.joined) }}>
        {chevron(true, backOut)}
        {chevron(false, true)}
      </span>
    </LiquidGroup>
  );
}

export function DateRangePickerPreview() {
  const s = useSteps(steps);
  const month = months[s.page];
  const nights = s.drawn.hi - s.drawn.lo;
  const title = s.hi === 0 ? `Mar ${s.lo} –` : `Mar ${s.lo} – ${s.hi}`;
  // One chip that morphs between the hint, the notice and the length; the notice floods it butter.
  const status: "hint" | "notice" | "length" = s.notice ? "notice" : s.hi === 0 ? "hint" : "length";
  const chipText = status === "notice" ? "Includes unavailable dates" : status === "hint" ? "Select end date" : `${nights} nights`;
  const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: u(5), height: u(28), paddingInline: u(12), fontSize: u(12.5), fontWeight: 600, whiteSpace: "nowrap", color: status === "notice" ? ink : status === "hint" ? ground.muted : ground.text };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes drp-shake{0%{transform:translateX(0)}16%{transform:translateX(${u(-4)})}34%{transform:translateX(${u(3)})}53%{transform:translateX(${u(-2)})}68%{transform:translateX(${u(1)})}100%{transform:translateX(0)}}@media (prefers-reduced-motion: reduce){[style*="drp-shake"]{animation:none!important}}`}</style>
      <div className="flex flex-col" style={{ width: u(372), padding: u(16), gap: u(11), background: card, borderRadius: u(26) }}>
        <div className="flex items-center justify-between" style={{ height: u(28), gap: u(8) }}>
          {/* The dates morph letter by letter on `value`, which never overshoots. */}
          <MorphText text={title} style={{ fontSize: u(19), fontWeight: 600, letterSpacing: "-0.01em" }} />
          <LiquidGroup unit={u(1)}>
            <Liquid tint={status === "notice" ? warning : undefined} style={{ ...chip, transition: `background-color ${curve("error").ms}ms` }}>
              {status === "notice" ? (
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" style={{ width: u(11), height: u(11) }}>
                  <path d="M12 4v10M12 20v.01" />
                </svg>
              ) : null}
              <MorphText text={chipText} />
            </Liquid>
          </LiquidGroup>
        </div>
        <div className="flex items-center" style={{ gap: u(6) }}>
          {/* The month morphs letter by letter as it pages. */}
          <MorphText text={month.title} className="flex-1" style={{ fontSize: u(16), fontWeight: 600, lineHeight: u(22) }} />
          <Pager page={s.page} nav={s.nav} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
            <span key={i} className="text-center" style={{ fontSize: u(11.5), fontWeight: 600, color: ground.muted }}>{w}</span>
          ))}
        </div>
        {/* The pager runs out to the card's edges, as Swift's does, so a month slides in from the edge. */}
        <div className="overflow-hidden" style={{ marginInline: u(-16), marginBottom: u(-16), marginTop: u(-8) }}>
          {/* The chevrons scroll to the month on a short spring that settles with a little give. */}
          <div data-motion className="flex" style={{ transform: `translateX(${-100 * s.page}%)`, transition: t("transform", "snap") }}>
            {months.map((m) => <Grid key={m.key} month={m} s={s} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
