"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Paged List: the list scrolls up, the footer spinner loads the next page and its rows fade in, page 3 fails with
 * an inline "Couldn't load more" chip, Retry succeeds, and the list ends on the quiet "You're all caught up" footer.
 * Only what the component renders: rows, footer. Sizes are px against the 560 x 420 stage, converted to cqw.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const field = "#262626";

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

// Geometry (px): rows are 60 tall with 6 between, the list starts 24 down, the footer is 64 tall.
const ROW = 66, TOP = 24, FOOT = 64, VIEW = 420;
/** Scroll that brings the footer fully into view. */
const toFooter = (n: number) => Math.max(0, TOP + n * ROW + FOOT + 12 - VIEW);

type Footer = "spin" | "error" | "end";
type Step = { n: number; y: number; footer: Footer; pressed?: boolean; hidden?: boolean; jump?: boolean; ms: number };
const steps: readonly Step[] = [
  { n: 8, y: 0, footer: "spin", ms: 1300 },
  { n: 8, y: toFooter(8) - 36, footer: "spin", ms: 850 },
  { n: 14, y: toFooter(8) - 36, footer: "spin", ms: 650 },
  { n: 14, y: toFooter(14), footer: "spin", ms: 800 },
  { n: 14, y: toFooter(14), footer: "error", ms: 1700 },
  { n: 14, y: toFooter(14), footer: "error", pressed: true, ms: 240 },
  { n: 14, y: toFooter(14), footer: "spin", ms: 750 },
  { n: 20, y: toFooter(14), footer: "spin", ms: 600 },
  { n: 20, y: toFooter(20), footer: "spin", ms: 800 },
  { n: 23, y: toFooter(20), footer: "end", ms: 450 },
  { n: 23, y: toFooter(23), footer: "end", ms: 2100 },
  { n: 23, y: toFooter(23), footer: "end", hidden: true, ms: 420 },
  { n: 8, y: 0, footer: "spin", hidden: true, jump: true, ms: 80 },
];

const MERCHANTS = ["Juniper Coffee", "Riverside Books", "Northline Transit", "Maison Bakery", "Studio Nine", "Fieldhouse Gym", "Almanac Market", "Sprig Florist", "Harbor Hardware", "Drift Records"];
const TILES = [blocks.butter, blocks.sky, blocks.sage, blocks.lilac, blocks.sand, blocks.tangerine];
const money = (n: number) => `$${(((n * 37) % 90) + 4.5).toFixed(2)}`;

function Row({ i, fresh }: { i: number; fresh: boolean }) {
  const name = MERCHANTS[i % MERCHANTS.length];
  return (
    <div className="flex items-center" style={{ height: u(60), gap: u(12), animation: fresh ? `pl-in .5s ${ease} both` : undefined, animationDelay: fresh ? `${(i % 6) * 45}ms` : undefined }}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: u(44), height: u(44), borderRadius: u(13), background: TILES[i % TILES.length], color: ink, fontSize: u(17), fontWeight: 700 }}>{name[0]}</span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: u(3) }}>
        <span className="truncate" style={{ fontSize: u(16), fontWeight: 600, lineHeight: 1.15 }}>{name}</span>
        <span style={{ fontSize: u(13), color: ground.muted, lineHeight: 1.15 }}>Receipt {1040 + i}</span>
      </span>
      <span className="tabular-nums" style={{ fontSize: u(16), fontWeight: 500 }}>{money(i)}</span>
    </div>
  );
}

function Badge({ fill, d }: { fill: string; d: string }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: u(22), height: u(22), background: fill, color: ink }}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(12), height: u(12) }}><path d={d} /></svg>
    </span>
  );
}

/** The footer crossfades between its three states; the chip scales in. */
function FooterView({ state, pressed }: { state: Footer; pressed?: boolean }) {
  const layer = (on: boolean, extra?: CSSProperties): CSSProperties => ({ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0, transition: `opacity .3s, transform .4s ${spring}`, ...extra });
  return (
    <div className="relative" style={{ height: u(FOOT) }}>
      <div style={layer(state === "spin")}>
        <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(22), height: u(22), animation: "pl-spin .9s linear infinite" }}>
          <circle cx="12" cy="12" r="10" fill="none" stroke={ground.muted} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="45 63" />
        </svg>
      </div>
      <div style={layer(state === "error", { transform: `scale(${state === "error" ? 1 : 0.92})` })}>
        <div className="flex items-center" style={{ gap: u(12), background: field, borderRadius: u(26), paddingBlock: u(4), paddingInlineStart: u(14), paddingInlineEnd: u(4) }}>
          <span className="flex items-center" style={{ gap: u(8) }}>
            <Badge fill={blocks.tangerine} d="M12 6v7.5M12 17.6v.2" />
            <span style={{ fontSize: u(14), fontWeight: 600, whiteSpace: "nowrap" }}>Couldn’t load more</span>
          </span>
          <span className="flex items-center rounded-full" style={{ height: u(36), paddingInline: u(18), background: blocks.butter, color: ink, fontSize: u(14), fontWeight: 700, transform: `scale(${pressed ? 0.94 : 1})`, transition: `transform .25s ${spring}` }}>Retry</span>
        </div>
      </div>
      <div style={layer(state === "end")}>
        <span className="flex items-center" style={{ gap: u(8) }}>
          <Badge fill={blocks.sage} d="M5 12.5l4.5 4.5L19 7.5" />
          <span style={{ fontSize: u(13), fontWeight: 500, color: ground.muted }}>You’re all caught up</span>
        </span>
      </div>
    </div>
  );
}

export function PagedListPreview() {
  const s = useSteps(steps);
  const [seen, setSeen] = useState(s.n);
  // Rows past the previous count are new this step: they fade in, the rest stay put.
  useEffect(() => { const t = setTimeout(() => setSeen(s.n), 700); return () => clearTimeout(t); }, [s.n]);
  const base = Math.min(seen, s.n);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, maskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)" }}>
      <style>{"@keyframes pl-in{from{opacity:0;transform:translateY(30%)}to{opacity:1;transform:none}}@keyframes pl-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-pl] *{animation:none!important}}"}</style>
      <div data-pl className="absolute left-1/2" style={{
        top: u(TOP), width: u(440), marginLeft: u(-220),
        transform: `translateY(${u(-s.y)})`, opacity: s.hidden ? 0 : 1,
        transition: s.jump ? "none" : `transform .85s ${ease}, opacity .4s`,
      }}>
        <div className="flex flex-col" style={{ gap: u(ROW - 60) }}>
          {Array.from({ length: s.n }, (_, i) => <Row key={i} i={i} fresh={i >= base} />)}
        </div>
        <FooterView state={s.footer} pressed={s.pressed} />
      </div>
    </div>
  );
}
