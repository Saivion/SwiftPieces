"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { blocks, font, ground, ink, signal } from "./palette";
import { shake, t, tiers, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup } from "./piece-liquid";

/*
 * The 2026-11-08 everyday pieces: Select Menu, Zoom Dial, Reorder List, Size Picker, Unit Toggle, View Toggle, Path
 * Bar, QR Code, Read-Along Text, Relative Time and Translate Toggle, the component only. Sizes are authored in points
 * as the Swift pieces draw them, converted to `cqw` against the 560 px stage, and each stage is scaled as one picture.
 * Selections flow the way the Swift pieces' edges do: the edge facing the move on the tight spring, the far edge on
 * the responsive one.
 */

const u = (pt: number) => `${(pt / 5.6).toFixed(3)}cqw`;
const LEAD: Spring = tiers.tight;
const TRAIL: Spring = tiers.responsive;
const FILL: CSSProperties = { position: "absolute", inset: 0 };
const SUBTLE = "var(--pv-subtle, #6f6d69)";

/** Walks `steps`, holding each for `ms`, then loops. Holds the first step under reduced motion. */
function useLoop<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return { step: steps[i], index: i };
}

function usePrevious<T>(value: T): T {
  const ref = useRef({ value, previous: value });
  if (ref.current.value !== value) ref.current = { value, previous: ref.current.value };
  return ref.current.previous;
}

/** Transitions for a pair of opposite insets: the edge facing the move leads, the far edge follows. */
function edges(low: string, high: string, forward: boolean): string {
  return [t(high, forward ? LEAD : TRAIL), t(low, forward ? TRAIL : LEAD)].join(", ");
}

function Stage({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <div style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

/** A glass shape filling its parent, under the parent's content. */
function GlassBack({ radius = "capsule", lift = true }: { radius?: number | "capsule"; lift?: boolean }) {
  return (
    <LiquidGroup unit={u(1)} lift={lift} style={FILL}>
      <Liquid radius={radius} style={{ position: "absolute", inset: 0 }} />
    </LiquidGroup>
  );
}

const Icon = ({ d, size, style }: { d: string; size: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" aria-hidden style={{ width: u(size), height: u(size), flex: "none", ...style }}>
    <path d={d} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CHECK = "M5 12.5l4.5 4.5L19 7";

/** Text that rolls up to each new value, as a push transition does: the old line leaves upward as the new one rises. */
function Roll({ text, down = false, style }: { text: string; down?: boolean; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const was = usePrevious(text);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (text === was || reduced || !ref.current) return;
    ref.current.animate([{ transform: `translateY(${down ? -70 : 70}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 360, easing: "cubic-bezier(.2,.9,.3,1.1)" });
  }, [text, was, down, reduced]);
  return <span ref={ref} style={{ display: "inline-block", whiteSpace: "nowrap", ...style }}>{text}</span>;
}

// MARK: - Select Menu

const SORTS = ["Newest first", "Oldest first", "Price, low to high", "Price, high to low"];
const SM_STEPS = [
  { ms: 1000, open: false, sel: 0, shown: 0 },
  { ms: 900, open: true, sel: 0, shown: 0 },
  { ms: 520, open: true, sel: 2, shown: 0 },
  { ms: 1500, open: false, sel: 2, shown: 2 },
  { ms: 900, open: true, sel: 2, shown: 2 },
  { ms: 520, open: true, sel: 3, shown: 2 },
  { ms: 1500, open: false, sel: 3, shown: 3 },
  { ms: 900, open: true, sel: 3, shown: 3 },
  { ms: 520, open: true, sel: 0, shown: 3 },
  { ms: 1000, open: false, sel: 0, shown: 0 },
] as const;
const SM_W = 240, SM_H = 46, SM_ROW = 40;

export function SelectMenuPreview() {
  const { step } = useLoop(SM_STEPS);
  const height = step.open ? SM_H + 5 + SORTS.length * SM_ROW + 6 : SM_H;
  return (
    <Stage scale={1.35}>
      <div className="flex flex-col" style={{ width: u(SM_W), gap: u(8), height: u(SM_H + 200) }}>
        <span style={{ fontSize: u(13), color: ground.muted }}>Sort by</span>
        <div className="relative overflow-hidden" style={{ height: u(height), borderRadius: u(SM_H / 2), transition: t("height", step.open ? "reveal" : "dismiss") }}>
          <GlassBack radius={SM_H / 2} />
          <div className="relative">
            <div className="flex items-center justify-between" style={{ height: u(SM_H), padding: `0 ${u(18)}`, fontSize: u(16) }}>
              <Roll text={SORTS[step.shown]} />
              <Icon d="M6 9l6 6 6-6" size={16} style={{ color: ground.muted, transform: `rotate(${step.open ? 180 : 0}deg)`, transition: t("transform", "morph") }} />
            </div>
            <div style={{ margin: `0 ${u(16)} ${u(4)}`, height: 1, background: ground.line }} />
            <div className="relative" style={{ padding: `0 ${u(6)}`, opacity: step.open ? 1 : 0, transition: `opacity ${step.open ? "250ms 120ms" : "150ms"}` }}>
              <span className="absolute" style={{ left: u(6), right: u(6), height: u(SM_ROW), top: u(step.sel * SM_ROW), borderRadius: u(SM_ROW / 2), background: signal.fill, transition: t("top", "snap") }} />
              {SORTS.map((name, i) => (
                <div key={name} className="relative flex items-center justify-between" style={{ height: u(SM_ROW), padding: `0 ${u(14)}`, fontSize: u(15), color: i === step.sel ? ink : ground.text, transition: "color .2s" }}>
                  {name}
                  <Icon d={CHECK} size={15} style={{ opacity: i === step.sel ? 1 : 0, transition: "opacity .2s" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Zoom Dial

const STOPS = [0.5, 1, 2, 3];
const ZD_DISC = 44, ZD_GAP = 4, ZD_IN = 5, ZD_UNIT = 110;
const ZD_STEPS = [
  { ms: 1100, v: 1, dial: false }, { ms: 1000, v: 2, dial: false }, { ms: 1000, v: 0.5, dial: false }, { ms: 1100, v: 1, dial: false },
  { ms: 450, v: 1, dial: true }, { ms: 1500, v: 1.6, dial: true }, { ms: 1400, v: 1.6, dial: false },
  { ms: 450, v: 1.6, dial: true }, { ms: 1500, v: 2.8, dial: true }, { ms: 1400, v: 2.8, dial: false },
] as const;
const zfmt = (v: number) => { const r = Math.round(v * 10) / 10; const s = Number.isInteger(r) ? String(r) : r.toFixed(1); return s.startsWith("0.") ? s.slice(1) : s; };
const nearest = (v: number) => STOPS.reduce((b, s, i) => (Math.abs(s - v) < Math.abs(STOPS[b] - v) ? i : b), 0);

export function ZoomDialPreview() {
  const { step } = useLoop(ZD_STEPS);
  const sel = nearest(step.v), was = usePrevious(sel);
  const pitch = ZD_DISC + ZD_GAP;
  const stopsW = STOPS.length * pitch - ZD_GAP + ZD_IN * 2, dialW = 290;
  const ticks = [];
  for (let i = 0; i <= 60; i++) {
    const v = 0.5 + i / 10, whole = Math.abs(v - Math.round(v)) < 0.001 || i === 0;
    ticks.push(
      <span key={i} className="absolute" style={{ left: u(i * 11 - 1), top: u(whole ? 9 : 13), width: u(2), height: u(whole ? 20 : 12), borderRadius: u(1), background: whole ? ground.muted : SUBTLE }}>
        {whole ? <span className="absolute" style={{ top: u(24), left: "50%", transform: "translateX(-50%)", fontSize: u(10), color: ground.muted }}>{zfmt(v)}×</span> : null}
      </span>,
    );
  }
  return (
    <Stage scale={1.5}>
      <div className="flex flex-col items-center" style={{ gap: u(18) }}>
        <span style={{ fontSize: u(15), color: ground.muted }}>Zoom <b style={{ color: ground.text }}>{zfmt(step.v)}×</b></span>
        <div className="relative overflow-hidden" style={{ width: u(step.dial ? dialW : stopsW), height: u(ZD_DISC + ZD_IN * 2), borderRadius: 9999, transition: t("width", "morph") }}>
          <GlassBack />
          <div className="absolute" style={{ inset: u(ZD_IN), opacity: step.dial ? 0 : 1, transition: "opacity .2s" }}>
            <span className="absolute" style={{ top: 0, height: u(ZD_DISC), borderRadius: 9999, background: signal.fill, left: u(sel * pitch), right: u((STOPS.length - 1 - sel) * pitch), transition: edges("left", "right", sel > was) }} />
            <div className="relative flex" style={{ gap: u(ZD_GAP) }}>
              {STOPS.map((s, i) => (
                <span key={s} className="grid place-items-center" style={{ width: u(ZD_DISC), height: u(ZD_DISC), fontSize: u(i === sel ? 15 : 13), color: i === sel ? ink : ground.text, transition: "color .2s" }}>
                  {i === sel ? `${zfmt(step.v)}×` : zfmt(s)}
                </span>
              ))}
            </div>
          </div>
          <div className="absolute inset-0" style={{ opacity: step.dial ? 1 : 0, transition: "opacity .25s", maskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)" }}>
            <div className="absolute inset-y-0" style={{ left: "50%", transform: `translateX(${u(-(step.v - 0.5) * ZD_UNIT)})`, transition: "transform 1.1s cubic-bezier(.45,0,.55,1)" }}>{ticks}</div>
            <span className="absolute" style={{ left: "50%", top: u(6), width: u(5), height: u(28), marginLeft: u(-2.5), borderRadius: u(2.5), background: signal.fill }} />
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Reorder List

const RL_ITEMS = [["Inbox", blocks.sky, 12], ["Today", blocks.butter, 5], ["Upcoming", blocks.sage, 8], ["Someday", blocks.lilac, 21]] as const;
const RL_H = 52, RL_GAP = 8;
const RL_STEPS = [
  { ms: 1000, order: [0, 1, 2, 3], lift: -1 },
  { ms: 450, order: [0, 1, 2, 3], lift: 0 },
  { ms: 550, order: [1, 0, 2, 3], lift: 0 },
  { ms: 650, order: [1, 2, 0, 3], lift: 0 },
  { ms: 900, order: [1, 2, 0, 3], lift: -1 },
  { ms: 450, order: [1, 2, 0, 3], lift: 3 },
  { ms: 550, order: [1, 2, 3, 0], lift: 3 },
  { ms: 550, order: [1, 3, 2, 0], lift: 3 },
  { ms: 650, order: [3, 1, 2, 0], lift: 3 },
  { ms: 900, order: [3, 1, 2, 0], lift: -1 },
  { ms: 450, order: [3, 1, 2, 0], lift: 0 },
  { ms: 400, order: [3, 1, 0, 2], lift: 0 },
  { ms: 400, order: [3, 0, 1, 2], lift: 0 },
  { ms: 600, order: [0, 3, 1, 2], lift: 0 },
  { ms: 500, order: [0, 3, 1, 2], lift: -1 },
  { ms: 450, order: [0, 3, 1, 2], lift: 3 },
  { ms: 400, order: [0, 1, 3, 2], lift: 3 },
  { ms: 600, order: [0, 1, 2, 3], lift: 3 },
] as const;

export function ReorderListPreview() {
  const { step } = useLoop(RL_STEPS);
  return (
    <Stage scale={1.3}>
      <div className="relative" style={{ width: u(300), height: u(4 * RL_H + 3 * RL_GAP), fontSize: u(16) }}>
        {RL_ITEMS.map(([name, color, count], id) => {
          const up = step.lift === id;
          return (
            <div key={name} className="absolute flex items-center" style={{
              left: 0, right: 0, height: u(RL_H), top: u((step.order as readonly number[]).indexOf(id) * (RL_H + RL_GAP)), zIndex: up ? 2 : 1,
              gap: u(12), padding: `0 ${u(6)} 0 ${u(16)}`, transform: `scale(${up ? 1.03 : 1})`,
              filter: up ? "drop-shadow(0 10px 18px rgba(0,0,0,.28))" : "none",
              transition: [t("top", up ? tiers.calm : "snap"), t("transform", up ? "press" : "release"), "filter .25s"].join(", "),
            }}>
              <GlassBack radius={18} lift={false} />
              <span className="relative" style={{ width: u(12), height: u(12), borderRadius: 9999, background: color }} />
              <span className="relative">{name}</span>
              <span className="relative" style={{ marginLeft: "auto", color: SUBTLE, fontVariantNumeric: "tabular-nums" }}>{count}</span>
              <span className="relative grid place-items-center" style={{ width: u(44), height: u(44), color: up ? signal.fill : SUBTLE, transition: "color .2s" }}>
                <Icon d="M5 8h14M5 12h14M5 16h14" size={18} />
              </span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

// MARK: - Size Picker

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"], SOLD = new Set(["XS", "XXL"]);
const SZ_NOTES: Record<string, string> = { L: "Only 2 left", S: "Runs small, try a size up" };
const SZ_CELL = 44, SZ_GAP = 4, SZ_IN = 5;
const SZ_STEPS = [
  { ms: 1000, sel: 2, refuse: "" }, { ms: 1200, sel: 3, refuse: "" }, { ms: 1100, sel: 3, refuse: "XS" },
  { ms: 1100, sel: 4, refuse: "" }, { ms: 1300, sel: 1, refuse: "" }, { ms: 1100, sel: 1, refuse: "XXL" },
] as const;

export function SizePickerPreview() {
  const { step, index } = useLoop(SZ_STEPS);
  const was = usePrevious(step.sel);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step.refuse && row.current) row.current.animate(...shake(u, 6));
  }, [step.refuse, index]);
  const pitch = SZ_CELL + SZ_GAP;
  const note = step.refuse ? `${step.refuse} is sold out` : SZ_NOTES[SIZES[step.sel]] ?? "In stock";
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col" style={{ gap: u(12), fontSize: u(15) }}>
        <div className="flex justify-between" style={{ color: ground.muted }}>
          <span>Size <b style={{ color: ground.text }}>{SIZES[step.sel]}</b></span>
          <span style={{ color: SUBTLE }}>Size guide</span>
        </div>
        <div ref={row} className="relative" style={{ padding: u(SZ_IN) }}>
          <GlassBack radius={(SZ_CELL + SZ_IN * 2) * 0.42} />
          <span className="absolute" style={{ top: u(SZ_IN), height: u(SZ_CELL), borderRadius: u(SZ_CELL * 0.42), background: signal.fill, left: u(SZ_IN + step.sel * pitch), right: u(SZ_IN + (SIZES.length - 1 - step.sel) * pitch), transition: edges("left", "right", step.sel > was) }} />
          <div className="relative flex" style={{ gap: u(SZ_GAP) }}>
            {SIZES.map((s, i) => (
              <span key={s} className="relative grid place-items-center" style={{ width: u(SZ_CELL), height: u(SZ_CELL), color: i === step.sel ? ink : SOLD.has(s) ? SUBTLE : ground.text, transition: "color .2s" }}>
                {s}
                {SOLD.has(s) ? <span className="absolute" style={{ width: u(SZ_CELL * 0.62), height: u(1.5), borderRadius: 9, background: SUBTLE, transform: "rotate(-35deg)" }} /> : null}
              </span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: u(13), color: ground.muted }}><Roll text={note} /></span>
      </div>
    </Stage>
  );
}

// MARK: - Unit Toggle

const UT_STEPS = [
  { ms: 1400, lb: false, temp: false }, { ms: 1400, lb: true, temp: false }, { ms: 1400, lb: true, temp: true },
  { ms: 1400, lb: false, temp: true }, { ms: 1200, lb: false, temp: false },
] as const;
const UT_CELL = 40, UT_W = 46, UT_GAP = 2, UT_IN = 4;

function Units({ units, sel }: { units: readonly string[]; sel: number }) {
  const was = usePrevious(sel), pitch = UT_W + UT_GAP;
  return (
    <div className="relative" style={{ padding: u(UT_IN) }}>
      <GlassBack radius={(UT_CELL + UT_IN * 2) * 0.42} />
      <span className="absolute" style={{ top: u(UT_IN), height: u(UT_CELL), borderRadius: u(UT_CELL * 0.42), background: signal.fill, left: u(UT_IN + sel * pitch), right: u(UT_IN + (units.length - 1 - sel) * pitch), transition: edges("left", "right", sel > was) }} />
      <div className="relative flex" style={{ gap: u(UT_GAP), fontSize: u(14) }}>
        {units.map((name, i) => <span key={name} className="grid place-items-center" style={{ width: u(UT_W), height: u(UT_CELL), color: i === sel ? ink : ground.text, transition: "color .2s" }}>{name}</span>)}
      </div>
    </div>
  );
}

export function UnitTogglePreview() {
  const { step } = useLoop(UT_STEPS);
  const rows = [
    { label: "Weight", value: step.lb ? "159.6" : "72.4", unit: step.lb ? "lb" : "kg", units: ["kg", "lb"], sel: step.lb ? 1 : 0 },
    { label: "Outside", value: step.temp ? "70" : "21", unit: step.temp ? "°F" : "°C", units: ["°C", "°F"], sel: step.temp ? 1 : 0 },
  ];
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col" style={{ gap: u(26) }}>
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col" style={{ gap: u(6) }}>
            <span style={{ fontSize: u(13), color: ground.muted }}>{r.label}</span>
            <div className="flex items-center" style={{ gap: u(16) }}>
              <span style={{ fontSize: u(34), fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: u(104) }}>
                <Roll text={r.value} /> <small style={{ fontSize: u(15), color: ground.muted, fontWeight: 600 }}>{r.unit}</small>
              </span>
              <Units units={r.units} sel={r.sel} />
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

// MARK: - View Toggle

const VT_STEPS = [{ ms: 1500, grid: false }, { ms: 1500, grid: true }] as const;
const VT_COLORS = [blocks.sky, blocks.butter, blocks.sage, blocks.lilac];

export function ViewTogglePreview() {
  const { step } = useLoop(VT_STEPS);
  const sel = step.grid ? 1 : 0, was = usePrevious(sel), pitch = 50 + 2;
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col items-center" style={{ gap: u(22) }}>
        <div className="relative" style={{ padding: u(4) }}>
          <GlassBack radius={48 * 0.42} />
          <span className="absolute" style={{ top: u(4), height: u(40), borderRadius: u(40 * 0.42), background: signal.fill, left: u(4 + sel * pitch), right: u(4 + (1 - sel) * pitch), transition: edges("left", "right", sel > was) }} />
          <div className="relative flex" style={{ gap: u(2) }}>
            {["M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"].map((d, i) => (
              <span key={d} className="grid place-items-center" style={{ width: u(50), height: u(40), color: i === sel ? ink : ground.text, transition: "color .2s" }}><Icon d={d} size={18} /></span>
            ))}
          </div>
        </div>
        <div className="relative" style={{ width: u(240), height: u(200) }}>
          {VT_COLORS.map((c, i) => {
            const list = { left: 0, top: i * 50, w: 40, h: 40, r: 10 };
            const grid = { left: (i % 2) * 125, top: Math.floor(i / 2) * 100, w: 115, h: 90, r: 16 };
            const b = step.grid ? grid : list;
            const morph = ["left", "top", "width", "height", "border-radius"].map((p) => t(p, "morph")).join(", ");
            return (
              <div key={c}>
                <span className="absolute" style={{ left: u(b.left), top: u(b.top), width: u(b.w), height: u(b.h), borderRadius: u(b.r), background: c, transition: morph }} />
                <span className="absolute" style={{ left: u(52), top: u(list.top + 16), width: u(110), height: u(8), borderRadius: u(4), background: ground.control, opacity: step.grid ? 0 : 1, transition: "opacity .2s" }} />
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Path Bar

const HOME = "M4 11l8-7 8 7v9h-5v-6H9v6H4z", DIR = "M3 7h6l2 2h10v10H3z";
const PV_STEPS = [
  { ms: 1000, path: ["Home"] }, { ms: 1000, path: ["Home", "Projects"] }, { ms: 1000, path: ["Home", "Projects", "SwiftPieces"] },
  { ms: 1000, path: ["Home", "Projects", "SwiftPieces", "Assets"] }, { ms: 1400, path: ["Home", "Projects", "SwiftPieces", "Assets", "Icons"] },
  { ms: 1200, path: ["Home", "Projects", "SwiftPieces"] }, { ms: 1200, path: ["Home", "Photos"] }, { ms: 1200, path: ["Home"] },
] as const;

export function PathBarPreview() {
  const { step } = useLoop(PV_STEPS);
  const path = step.path;
  const shown: (string | null)[] = path.length > 3 ? [path[0], null, path[path.length - 2], path[path.length - 1]] : [...path];
  const bar = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ l: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>("[data-cur]");
    // The segment sits in its own wrapper beside its chevron, so add the wrapper's offset within the bar.
    if (el) setPill({ l: el.offsetLeft + ((el.offsetParent as HTMLElement | null)?.offsetLeft ?? 0), w: el.offsetWidth });
  }, [step]);
  return (
    <Stage scale={1.35}>
      <div ref={bar} className="relative flex items-center" style={{ padding: u(4), gap: u(2), fontSize: u(14), whiteSpace: "nowrap" }}>
        <GlassBack />
        {pill ? <span className="absolute" style={{ top: u(4), height: u(40), left: pill.l, width: pill.w, borderRadius: 9999, background: signal.fill, transition: [t("left", "snap"), t("width", "morph")].join(", ") }} /> : null}
        {shown.map((name, i) => (
          <span key={`${i}-${name}`} className="relative flex items-center" style={{ gap: u(2) }}>
            {i > 0 ? <Icon d="M9 6l6 6-6 6" size={10} style={{ color: SUBTLE }} /> : null}
            {name === null ? (
              <span className="grid place-items-center" style={{ width: u(40), height: u(40), color: ground.muted, fontSize: u(18), letterSpacing: ".04em" }}>…</span>
            ) : (
              <span data-cur={i === shown.length - 1 ? "" : undefined} className="flex items-center" style={{
                gap: u(6), height: u(40), padding: `0 ${u(12)}`, color: i === shown.length - 1 ? ink : ground.muted, transition: "color .2s",
                animation: i === shown.length - 1 ? "ev-lift 360ms cubic-bezier(.2,.9,.3,1.1)" : undefined,
              }}>
                <Icon d={name === "Home" ? HOME : DIR} size={14} />
                {name}
              </span>
            )}
          </span>
        ))}
        <style>{`@keyframes ev-lift{from{transform:translateY(${u(16)});opacity:0}to{transform:none;opacity:1}}`}</style>
      </div>
    </Stage>
  );
}

// MARK: - QR Code

const QN = 29;
const qrEye = (x: number, y: number) => (x < 8 && y < 8) || (x > QN - 9 && y < 8) || (x < 8 && y > QN - 9);
const qrHole = (x: number, y: number) => Math.abs(x - 14) < 4 && Math.abs(y - 14) < 4;
const QR_CELLS: [number, number][] = [];
for (let y = 0; y < QN; y++) for (let x = 0; x < QN; x++) if (!qrEye(x, y) && !qrHole(x, y)) QR_CELLS.push([x, y]);
function qrBits(seed: number) {
  let s = seed;
  return QR_CELLS.map(() => (s = (s * 16807) % 2147483647) / 2147483647 > 0.5);
}
const QR_CODES = [["Link", "swiftpieces.com", qrBits(3)], ["Wi-Fi", "Studio · WPA2", qrBits(11)], ["Contact", "Maya Chen", qrBits(23)]] as const;
const QR_STEPS = [0, 1, 2].map((code) => ({ ms: 2600, code }));

export function QRCodePreview() {
  const { step } = useLoop(QR_STEPS);
  const [label, detail, bits] = QR_CODES[step.code];
  return (
    <Stage scale={1.25}>
      <div className="flex flex-col items-center" style={{ gap: u(14) }}>
        <div className="relative" style={{ width: u(200), height: u(200), padding: u(14), borderRadius: u(24), background: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
          <svg viewBox={`0 0 ${QN} ${QN}`} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
            {[[0, 0], [QN - 7, 0], [0, QN - 7]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={2} fill="none" stroke="#141414" strokeWidth={1} />
                <rect x={x + 2} y={y + 2} width={3} height={3} rx={1.1} fill={signal.fill} />
              </g>
            ))}
            {QR_CELLS.map(([x, y], i) => {
              const d = Math.hypot(x - 14, y - 14);
              return <circle key={i} cx={x + 0.5} cy={y + 0.5} r={0.43} fill="#141414" style={{ transformBox: "fill-box", transformOrigin: "center", transform: `scale(${bits[i] ? 1 : 0})`, transition: `transform .45s cubic-bezier(.3,1.5,.5,1) ${Math.round(d * 22)}ms` }} />;
            })}
          </svg>
          <span className="absolute grid place-items-center" style={{ left: "50%", top: "50%", width: u(38), height: u(38), margin: u(-19), borderRadius: u(11), background: signal.fill, color: ink, boxShadow: `0 0 0 ${u(5)} #fff` }}>
            <Icon d="M15 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" size={20} />
          </span>
        </div>
        <div className="relative flex items-center" style={{ gap: u(8), height: u(36), padding: `0 ${u(14)}`, fontSize: u(14) }}>
          <GlassBack />
          <span className="relative"><Roll text={label} /></span>
          <span className="relative" style={{ color: SUBTLE }}><Roll text={detail} /></span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Read-Along Text

const RA_WORDS = "The tide came in slowly, and the lights along the harbour came on one by one.".split(" ");
const RA_DUR = (i: number) => 430 + RA_WORDS[i].length * 42;

export function ReadAlongTextPreview() {
  const reduced = usePrefersReducedMotion();
  const [at, setAt] = useState(-1);
  useEffect(() => {
    if (reduced) { setAt(3); return; }
    const ms = at < 0 ? 1200 : at >= RA_WORDS.length ? 2000 : RA_DUR(at);
    const timer = setTimeout(() => setAt((v) => (v >= RA_WORDS.length ? -1 : v + 1)), ms);
    return () => clearTimeout(timer);
  }, [at, reduced]);
  const box = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current?.children[at + 1] as HTMLElement | undefined;
    if (!el || at < 0 || at >= RA_WORDS.length) return;
    const em = parseFloat(getComputedStyle(el).fontSize);
    // Even room on both sides of the word, and a pill a little taller than its letters, centred on the line.
    const pad = em * 0.18, h = em * 1.34;
    setPill({ l: el.offsetLeft - pad, t: el.offsetTop + (el.offsetHeight - h) / 2, w: el.offsetWidth + pad * 2, h });
  }, [at]);
  const live = at >= 0 && at < RA_WORDS.length;
  const progress = Math.min(Math.max(at, 0) / RA_WORDS.length, 1);
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col" style={{ width: u(280), gap: u(22) }}>
        <div ref={box} className="relative" style={{ fontSize: u(20), lineHeight: 1.6 }}>
          <span className="absolute" style={{
            left: pill?.l ?? 0, top: pill?.t ?? 0, width: pill?.w ?? 0, height: pill?.h ?? 0, borderRadius: u(7), background: signal.fill,
            opacity: live && pill ? 1 : 0, transition: [t(["left", "top", "width", "height"], "snap"), "opacity .2s"].join(", "),
          }} />
          {RA_WORDS.map((w, i) => (
            <span key={i} className="relative" style={{ display: "inline-block", marginRight: u(8.4), color: i === at ? ink : i < at ? ground.text : SUBTLE, transition: "color .2s" }}>{w}</span>
          ))}
        </div>
        <div className="flex items-center" style={{ gap: u(12) }}>
          <span className="relative grid place-items-center" style={{ width: u(46), height: u(46) }}>
            <GlassBack />
            <svg viewBox="0 0 24 24" className="relative" style={{ width: u(18), height: u(18) }} aria-hidden>
              <path d={live ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5v14l11-7z"} fill="currentColor" />
            </svg>
          </span>
          <span className="relative flex-1 overflow-hidden" style={{ height: u(5), borderRadius: 9, background: ground.trough }}>
            <span className="absolute inset-y-0 left-0" style={{ width: `${progress * 100}%`, background: ground.text, transition: "width .3s linear" }} />
          </span>
          <span style={{ fontSize: u(12), color: ground.muted, fontVariantNumeric: "tabular-nums" }}>0:{String(Math.round(progress * 9)).padStart(2, "0")}</span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Relative Time

const RT_STEPS = [
  { ms: 1600, v: ["just now", "1 min. ago", "Yesterday"], exact: -1 },
  { ms: 1300, v: ["just now", "2 min. ago", "Yesterday"], exact: -1 },
  { ms: 1300, v: ["1 min. ago", "2 min. ago", "Yesterday"], exact: -1 },
  { ms: 1800, v: ["1 min. ago", "2 min. ago", "Nov 7, 11:42 PM"], exact: 2 },
  { ms: 1300, v: ["1 min. ago", "3 min. ago", "Yesterday"], exact: -1 },
] as const;
const RT_ROWS = [["Message sent", blocks.sky, "M4 12l16-8-6 16-3-6z"], ["Draft edited", blocks.butter, "M4 20h4L19 9l-4-4L4 16z"], ["Backup done", blocks.sage, CHECK]] as const;

export function RelativeTimePreview() {
  const { step } = useLoop(RT_STEPS);
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col" style={{ width: u(270), gap: u(10) }}>
        {RT_ROWS.map(([title, color, d], i) => (
          <div key={title} className="relative flex items-center" style={{ gap: u(12), height: u(58), padding: `0 ${u(14)}` }}>
            <GlassBack radius={22} lift={false} />
            <span className="relative grid place-items-center" style={{ width: u(32), height: u(32), borderRadius: 9999, background: color, color: ink }}><Icon d={d} size={15} /></span>
            <span className="relative flex flex-col" style={{ gap: u(2) }}>
              <span style={{ fontSize: u(15) }}>{title}</span>
              <span className="overflow-hidden" style={{ fontSize: u(13), color: step.exact === i ? signal.fill : ground.muted, transition: "color .2s" }}><Roll text={step.v[i]} /></span>
            </span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

// MARK: - Translate Toggle

const TT_ES = "La mejor paella del barrio. Volveremos pronto, sin duda.".split(" ");
const TT_EN = "The best paella in the neighbourhood. We'll be back soon, no doubt.".split(" ");
const TT_STEPS = [{ ms: 3600, on: false }, { ms: 3600, on: true }] as const;

export function TranslateTogglePreview() {
  const { step } = useLoop(TT_STEPS);
  const reduced = usePrefersReducedMotion();
  // Old words blur out one by one, then the new ones sharpen in.
  // The run is keyed on the toggle alone: if it also re-ran when `words` swapped, its cleanup would cancel the
  // sharpen-in timers and leave the card blank from the first toggle on.
  const [words, setWords] = useState<readonly string[]>(TT_ES);
  const [shown, setShown] = useState<[number, number]>([0, 99]);
  const current = useRef<readonly string[]>(TT_ES);
  useEffect(() => {
    const from = current.current;
    const target = step.on ? TT_EN : TT_ES;
    if (from === target) return;
    current.current = target;
    if (reduced) { setWords(target); setShown([0, 99]); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    from.forEach((_, i) => timers.push(setTimeout(() => setShown([i + 1, 99]), i * 26)));
    const swapAt = from.length * 26 + 220;
    timers.push(setTimeout(() => { setWords(target); setShown([0, 0]); }, swapAt));
    target.forEach((_, i) => timers.push(setTimeout(() => setShown([0, i + 1]), swapAt + 40 + i * 32)));
    // Settle on the whole target if this run is cut short, so the card is never left blank.
    return () => { timers.forEach(clearTimeout); setWords(target); setShown([0, 99]); };
  }, [step.on, reduced]);
  return (
    <Stage scale={1.5}>
      <div className="relative flex flex-col" style={{ width: u(290), padding: u(20), gap: u(14) }}>
        <GlassBack radius={26} />
        <span className="relative overflow-hidden" style={{ fontSize: u(13), color: ground.muted }}><Roll text={step.on ? "English · from Spanish" : "Spanish"} /></span>
        <div className="relative" style={{ fontSize: u(19), lineHeight: 1.45, minHeight: u(84) }}>
          {words.map((w, i) => {
            const on = i >= shown[0] && i < shown[1];
            return <span key={`${w}-${i}`} style={{ display: "inline-block", marginRight: u(5.5), opacity: on ? 1 : 0, filter: on ? "none" : `blur(${u(5)})`, transform: on ? "none" : `translateY(${u(6)})`, transition: "opacity .25s, filter .25s, transform .3s" }}>{w}</span>;
          })}
        </div>
        <span className="relative flex items-center self-start" style={{ gap: u(8), height: u(40), padding: `0 ${u(16)}`, borderRadius: 9999, fontSize: u(14), background: step.on ? signal.fill : ground.trough, color: step.on ? ink : ground.text, transition: "background-color .25s, color .25s" }}>
          <Icon d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 7-6 8M13 21l4-9 4 9M14.5 18h5" size={16} />
          {step.on ? "Original" : "Translate"}
        </span>
      </div>
    </Stage>
  );
}
