"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { pressScale, rubberBand, t, type Role } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, budStyle, liquid } from "./piece-liquid";

/*
 * Paged List: the list scrolls up, the footer's glass bubble spins while the next page loads and its rows land in
 * place, page 3 fails and the bubble widens into a "Couldn't load more" pill with the Retry bubble budding out of its
 * trailing end on a liquid neck, Retry is tapped and melts back in as the spinner returns, and the list ends on the
 * quiet "You're all caught up" pill. As in the piece, data never animates: only the footer moves, and a flick that
 * reaches the end runs a little past it and rebounds. Sizes are px against the 560 x 420 stage, converted to cqw; one
 * iOS point is one px here.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A flick coasting to rest: leaves fast and decelerates like a scroll view's decay. Physics on a clock, not a spring. */
const coast = (ms: number) => `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`;

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
/** Scroll that brings the footer fully into view: the end of the content. */
const toFooter = (n: number) => Math.max(0, TOP + n * ROW + FOOT + 12 - VIEW);
/** Where a flick from `from` to the end at `to` peaks: the speed it still carries, rubber-banded against the edge. */
const past = (from: number, to: number) => to + rubberBand((to - from) * 0.15, VIEW);

type Footer = "spin" | "error" | "end";
/**
 * `ms` holds the step. A scroll coasts over `glide` (default `ms`), or springs home from past the end when `back` is
 * set. A throw past the end hands over to `back` just before it stops, so it never hangs at the peak.
 */
type Step = { n: number; y: number; footer: Footer; pressed?: boolean; hidden?: boolean; jump?: boolean; back?: boolean; glide?: number; ms: number };
const MID = toFooter(8) - 36, P2 = toFooter(14), P3 = toFooter(20), END = toFooter(23);
const steps: readonly Step[] = [
  { n: 8, y: 0, footer: "spin", ms: 1300 },
  { n: 8, y: MID, footer: "spin", ms: 850 },
  { n: 14, y: MID, footer: "spin", ms: 650 },
  { n: 14, y: past(MID, P2), footer: "spin", glide: 540, ms: 380 },
  { n: 14, y: P2, footer: "spin", back: true, ms: 560 },
  { n: 14, y: P2, footer: "error", ms: 1900 },
  { n: 14, y: P2, footer: "error", pressed: true, ms: 240 },
  { n: 14, y: P2, footer: "spin", ms: 900 },
  { n: 20, y: P2, footer: "spin", ms: 600 },
  { n: 20, y: past(P2, P3), footer: "spin", glide: 540, ms: 380 },
  { n: 20, y: P3, footer: "spin", back: true, ms: 560 },
  // The last page lands as the list is flicked on: its rows push the footer below the fold, so the caught-up pill's
  // morph has to run while the flick brings it up, or it would arrive already formed.
  { n: 23, y: past(P3, END), footer: "end", glide: 460, ms: 320 },
  { n: 23, y: END, footer: "end", back: true, ms: 1700 },
  { n: 23, y: END, footer: "end", hidden: true, ms: 420 },
  { n: 8, y: 0, footer: "spin", hidden: true, jump: true, ms: 80 },
];

const MERCHANTS = ["Juniper Coffee", "Riverside Books", "Northline Transit", "Maison Bakery", "Studio Nine", "Fieldhouse Gym", "Almanac Market", "Sprig Florist", "Harbor Hardware", "Drift Records"];
const TILES = [blocks.butter, blocks.sky, blocks.sage, blocks.lilac, blocks.sand, blocks.tangerine];
const money = (n: number) => `$${(((n * 37) % 90) + 4.5).toFixed(2)}`;

/** Rows never animate: a page lands in place, so nothing moves under the reader. */
function Row({ i }: { i: number }) {
  const name = MERCHANTS[i % MERCHANTS.length];
  return (
    <div className="flex items-center" style={{ height: u(60), gap: u(12) }}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: u(44), height: u(44), borderRadius: u(13), background: TILES[i % TILES.length], color: ink, fontSize: u(17) }}>{name[0]}</span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: u(3) }}>
        <span className="truncate" style={{ fontSize: u(16), lineHeight: 1.15 }}>{name}</span>
        <span style={{ fontSize: u(13), color: ground.muted, lineHeight: 1.15 }}>Receipt {1040 + i}</span>
      </span>
      <span className="tabular-nums" style={{ fontSize: u(16) }}>{money(i)}</span>
    </div>
  );
}

const icon = (d: string, size: number, stroke: number) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size) }}><path d={d} /></svg>
);

/** A warning or check on a solid disc, inside the glass like an icon. */
function Disc({ fill, d }: { fill: string; d: string }) {
  return (
    <span className="flex items-center justify-center rounded-full" style={{ width: u(22), height: u(22), background: fill, color: ink }}>
      {icon(d, 12, 3)}
    </span>
  );
}

/** The glyph area keeps one size; the spinner and the discs blur from one to the next, as `motion.swap` does. */
function Swap({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span data-motion className="absolute inset-0 flex items-center justify-center" style={{
      opacity: on ? 1 : 0, filter: `blur(${on ? 0 : 4}px)`, transform: `scale(${on ? 1 : 0.8})`,
      transition: t(["opacity", "filter", "transform"], "morph"),
    }}>{children}</span>
  );
}

/** Retry is about 44 x 44: it sinks to the press floor where it is drawn without Liquid Glass. */
const RETRY_PRESS = pressScale(44, 44);
const H = 44, DISC = 22, JOIN = liquid.joined;

/**
 * The footer: one glass pill that changes form on the morph's slight give, centred, with the Retry bubble laid out at
 * its trailing end and under it, budding out on the split spring and melting home on the bounceless one.
 */
function FooterView({ state, pressed }: { state: Footer; pressed?: boolean }) {
  const failed = state === "error";
  const titled = state !== "spin";
  // The label keeps its last text while it folds away, as a removed view does in Swift.
  const last = useRef<Footer>("error");
  useEffect(() => { if (state !== "spin") last.current = state; });
  const shown = titled ? state : last.current;
  const morph: Role = "morph";
  const reach = H + JOIN;
  const labelStyle: CSSProperties = shown === "end" ? { fontSize: u(13), color: ground.muted } : { fontSize: u(15), color: ground.text };
  return (
    <div className="flex items-center justify-center" style={{ height: u(FOOT) }}>
      <LiquidGroup unit={u(1)} axis="x">
        {/* The pair stays centred while Retry is out, moving on Retry's own springs. */}
        <div data-motion className="relative" style={{ transform: `translateX(${u(failed ? -reach / 2 : 0)})`, transition: t("transform", failed ? liquid.split : liquid.home) }}>
          {/* Retry first, so it sits under the pill; at home, shrunk, it is just inside the pill's trailing end. */}
          <div className="absolute" style={{ right: 0, top: 0 }}>
            <div data-motion style={{ transform: `scale(${pressed ? RETRY_PRESS : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
              <div data-motion style={budStyle({ out: failed, rest: [reach, 0], home: [0, 0] }, u(1))}>
                {/* Signal while out; the tint drains as it melts home, so it dissolves into the pill as clear glass. */}
                <Liquid tint={failed ? signal.fill : undefined} className="flex items-center justify-center" style={{ width: u(H), height: u(H), color: signal.on, transition: t("background-color", failed ? liquid.split : liquid.home) }}>
                  <BudContent out={failed}>{icon("M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2", 18, 2.6)}</BudContent>
                </Liquid>
              </div>
            </div>
          </div>
          <Liquid radius={H / 2} className="relative flex items-center" style={{ height: u(H), paddingLeft: u((H - DISC) / 2), paddingRight: u(titled ? 16 : (H - DISC) / 2), transition: t("padding", morph) }}>
            <span className="relative shrink-0" style={{ width: u(DISC), height: u(DISC) }}>
              <Swap on={state === "spin"}>
                <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(DISC), height: u(DISC), animation: "pl-spin .9s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke={ground.muted} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="45 63" />
                </svg>
              </Swap>
              <Swap on={failed}><Disc fill={blocks.butter} d="M12 6v7.5M12 17.6v.2" /></Swap>
              <Swap on={state === "end"}><Disc fill={blocks.sage} d="M5 12.5l4.5 4.5L19 7.5" /></Swap>
            </span>
            {/* The label opens and folds with the pill, blurring in and out. */}
            <span data-motion className="grid" style={{ gridTemplateColumns: titled ? "1fr" : "0fr", transition: t("grid-template-columns", morph) }}>
              <span className="overflow-hidden" style={{ minWidth: 0 }}>
                <span data-motion className="block" style={{
                  ...labelStyle, whiteSpace: "nowrap", paddingLeft: u(8),
                  opacity: titled ? 1 : 0, filter: `blur(${titled ? 0 : 4}px)`, transition: t(["opacity", "filter"], morph),
                }}>{shown === "end" ? "You’re all caught up" : "Couldn’t load more"}</span>
              </span>
            </span>
          </Liquid>
        </div>
      </LiquidGroup>
    </div>
  );
}

export function PagedListPreview() {
  const s = useSteps(steps);
  // A flick coasts to rest; from past the end it rebounds home. The scene fades out quickly and back calmly.
  const scroll = s.jump ? "none" : `${s.back ? t("transform", "rebound") : coast(s.glide ?? s.ms)}, ${t("opacity", s.hidden ? "dismiss" : "reveal")}`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, fontWeight: 600, maskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)" }}>
      <style>{"@keyframes pl-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-pl] *{animation:none!important}}"}</style>
      <div data-pl className="absolute left-1/2" style={{
        top: u(TOP), width: u(440), marginLeft: u(-220),
        transform: `translateY(${u(-s.y)})`, opacity: s.hidden ? 0 : 1,
        transition: scroll,
      }}>
        <div className="flex flex-col" style={{ gap: u(ROW - 60) }}>
          {Array.from({ length: s.n }, (_, i) => <Row key={i} i={i} />)}
        </div>
        <FooterView state={s.footer} pressed={s.pressed} />
      </div>
    </div>
  );
}
