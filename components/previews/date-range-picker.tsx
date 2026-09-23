"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Date Range Picker: a stay picked on the March grid (start block, end block, the band sweeping across week rows),
 * a page turn to April and back, then the original range picked again so the loop closes on its resting state.
 * Only what the component renders: its summary line, month header, weekday row and grid.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

/** The Swift `Style.standard` values on the dark appearance. */
const card = "#1c1c1c", control = "#262626", band = "#4a4029", endpointFill = blocks.butter, disabled = "#5e5c58";

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

/** page: 0 March, 1 April. lo/hi: the range on March (hi 0 while only a start is pending). press: the day under the finger. */
type Step = { page: 0 | 1; lo: number; hi: number; press?: number; ms: number };
const steps: readonly Step[] = [
  { page: 0, lo: 4, hi: 9, ms: 1700 },
  { page: 0, lo: 12, hi: 0, press: 12, ms: 260 },
  { page: 0, lo: 12, hi: 0, ms: 800 },
  { page: 0, lo: 12, hi: 24, press: 24, ms: 260 },
  { page: 0, lo: 12, hi: 24, ms: 1800 },
  { page: 1, lo: 12, hi: 24, ms: 1500 },
  { page: 0, lo: 12, hi: 24, ms: 1100 },
  { page: 0, lo: 4, hi: 0, press: 4, ms: 260 },
  { page: 0, lo: 4, hi: 0, ms: 700 },
  { page: 0, lo: 4, hi: 9, press: 9, ms: 260 },
];

const CELL_H = 38, COLS = 7, ROWS = 6;

function Grid({ month, s }: { month: Month; s: Step }) {
  const onMarch = month.key === "mar";
  const lo = onMarch ? s.lo : 0, hi = onMarch ? s.hi : 0;
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => (i >= month.lead && i < month.lead + month.days ? i - month.lead + 1 : 0));
  return (
    <div className="grid shrink-0" style={{ width: "100%", gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {cells.map((d, i) => {
        if (!d) return <span key={i} style={{ height: u(CELL_H) }} />;
        const col = i % COLS;
        const rowStart = col === 0 || cells[i - 1] === 0, rowEnd = col === COLS - 1 || cells[i + 1] === 0;
        const isStart = d === lo, isEnd = hi > 0 && d === hi, endpoint = isStart || isEnd;
        const inBand = hi > lo && d >= lo && d <= hi;
        const blocked = month.blocked.includes(d);
        const lead = rowStart && !isStart ? 12 : 0, trail = rowEnd && !isEnd ? 12 : 0;
        const past = onMarch && d < TODAY;
        return (
          <span key={i} className="relative flex items-center justify-center" style={{ height: u(CELL_H) }}>
            <span data-motion className="absolute flex" style={{
              // Inner edges overlap by half a pixel so fractional column widths never leave a hairline seam in the band.
              top: u(2), bottom: u(2), left: rowStart && !isStart ? u(2) : "-0.5px", right: rowEnd && !isEnd ? u(2) : "-0.5px",
              borderRadius: `${u(lead)} ${u(trail)} ${u(trail)} ${u(lead)}`, overflow: "hidden",
              transform: `scaleX(${inBand ? 1 : 0})`, transformOrigin: "left", opacity: inBand ? 1 : 0,
              transition: inBand ? `transform .24s ${ease} ${Math.min((d - lo) * 20, 400)}ms, opacity .12s linear ${Math.min((d - lo) * 20, 400)}ms` : "transform .18s ease-out, opacity .18s",
            }}>
              <span className="flex-1" style={{ background: isStart ? "transparent" : band }} />
              <span className="flex-1" style={{ background: isEnd ? "transparent" : band }} />
            </span>
            <span data-motion className="absolute" style={{
              inset: u(2), borderRadius: u(12), background: endpointFill,
              transform: `scale(${endpoint ? (s.press === d ? 0.9 : 1) : 0.55})`, opacity: endpoint ? 1 : 0,
              transition: `transform .32s ${spring}, opacity .2s`,
            }} />
            <span className="relative tabular-nums" style={{
              fontSize: u(15), fontWeight: endpoint ? 700 : 500, lineHeight: 1,
              color: endpoint ? ink : blocked || past ? disabled : ground.text,
              textDecoration: blocked ? `line-through ${disabled}` : undefined, transition: "color .2s",
            }}>{d}</span>
            {onMarch && d === TODAY ? <span className="absolute rounded-full" style={{ bottom: u(CELL_H * 0.14), width: u(4), height: u(4), background: endpoint ? ink : blocks.tangerine }} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function Chevron({ back, enabled }: { back?: boolean; enabled: boolean }) {
  return (
    <span className="flex items-center justify-center rounded-full" style={{ width: u(32), height: u(32), background: control, opacity: enabled ? 1 : 0.35, transition: "opacity .25s" }}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={ground.text} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(13), height: u(13) }}>
        <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </span>
  );
}

export function DateRangePickerPreview() {
  const s = useSteps(steps);
  const month = months[s.page];
  const pending = s.hi === 0;
  const nights = s.hi - s.lo;
  const title = pending ? `Mar ${s.lo} –` : `Mar ${s.lo} – ${s.hi}`;
  const chip: CSSProperties = { fontSize: u(12.5), fontWeight: 700, borderRadius: 999, paddingInline: u(11), height: u(26), display: "inline-flex", alignItems: "center" };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes drp-roll-f{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}@keyframes drp-roll-b{from{opacity:0;transform:translateY(-40%)}to{opacity:1;transform:none}}@keyframes drp-fade{from{opacity:0}to{opacity:1}}`}</style>
      <div className="flex flex-col" style={{ width: u(372), padding: u(16), gap: u(11), background: card, borderRadius: u(26) }}>
        <div className="flex items-center justify-between" style={{ height: u(28), gap: u(8) }}>
          <span key={title} data-motion style={{ fontSize: u(19), fontWeight: 600, letterSpacing: "-0.01em", animation: "drp-fade .3s ease-out" }}>{title}</span>
          {pending
            ? <span key="hint" data-motion style={{ fontSize: u(13), fontWeight: 500, color: ground.muted, animation: "drp-fade .3s ease-out" }}>Select end date</span>
            : <span key={`n${nights}`} data-motion style={{ ...chip, background: endpointFill, color: ink, animation: `drp-fade .3s ease-out` }}>{nights} nights</span>}
        </div>
        <div className="flex items-center" style={{ gap: u(6) }}>
          <span className="flex-1 overflow-hidden" style={{ height: u(22) }}>
            <span key={month.key} data-motion className="block" style={{ fontSize: u(16), fontWeight: 600, lineHeight: u(22), animation: `${s.page === 1 ? "drp-roll-f" : "drp-roll-b"} .35s ${ease}` }}>{month.title}</span>
          </span>
          <Chevron back enabled={s.page > 0} />
          <Chevron enabled />
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
            <span key={i} className="text-center" style={{ fontSize: u(11.5), fontWeight: 600, color: ground.muted }}>{w}</span>
          ))}
        </div>
        <div className="overflow-hidden">
          <div data-motion className="flex" style={{ transform: `translateX(${-100 * s.page}%)`, transition: `transform .45s ${ease}` }}>
            {months.map((m) => <Grid key={m.key} month={m} s={s} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
