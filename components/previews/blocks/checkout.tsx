"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BlockCanvas, bu } from "./canvas";
import { blocks, font, ground, ink, signal } from "../palette";
import { curve, follow, ms, pressScale, t } from "../piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, budStyle, liquid } from "../piece-liquid";

/*
 * Checkout, as CheckoutBlock.swift draws it with its Example's data: a step trail over Bag, Delivery and Pay.
 * The loop: the mug's quantity is scrubbed from 1 to 2 (its price, the unit price and the subtotal roll), Continue
 * moves the trail on and the Bag slides out as Delivery blurs in; an address is typed, its suggestion pours out of
 * the field, is picked and settles with its locality and the sage check; Express is chosen and Continue turns red;
 * on Pay the button draws in around its label while the ring buds out, closes sage and turns to Paid; then the trail
 * completes and the placed order lands. Sizes are the Swift block's points on the block canvas (`bu`), motion is the
 * shared roles (piece-motion) and the glass the liquid twin (piece-liquid). Reduced motion holds the rest state.
 */

const TITLES = ["Bag", "Delivery", "Pay"];
/** StepTrail.Style.standard: stop size, neck, capsule title size and its insets. */
const D = 34, GAP = liquid.joined, LABEL = 15, LEAD = 29, TAIL = 14;
/** The section's width on a 390 pt screen with 20 pt margins. */
const W = 350;
const BUTTON_H = 56;

type PayPhase = "idle" | "loading" | "closed" | "paid";
type Press = "continue" | "row" | "express" | "pay";

/** One beat of the loop: the whole block's state, held for `ms`. */
type Beat = {
  step: 0 | 1 | 2 | 3;
  mug: number;
  /** The mug's numeral pill is held and scrubbed; `ruler` is the tape's travel in points. */
  scrub?: boolean;
  ruler?: number;
  press?: Press;
  typed?: string;
  focused?: boolean;
  loading?: boolean;
  list?: boolean;
  resolving?: boolean;
  resolved?: boolean;
  express?: boolean;
  pay?: PayPhase;
  /** The loop fades out before it starts over. */
  reset?: boolean;
  ms: number;
};

const AT_PAY = { mug: 2, resolved: true, express: true } as const;
const STORY: readonly Beat[] = [
  { step: 0, mug: 1, ms: 1100 },
  { step: 0, mug: 1, scrub: true, ms: 220 },
  { step: 0, mug: 2, scrub: true, ruler: 14, ms: 520 },
  { step: 0, mug: 2, ms: 520 },
  { step: 0, mug: 2, press: "continue", ms: 150 },
  { step: 1, mug: 2, ms: 700 },
  { step: 1, mug: 2, focused: true, typed: "48 Ju", ms: 160 },
  { step: 1, mug: 2, focused: true, typed: "48 Junip", ms: 160 },
  { step: 1, mug: 2, focused: true, typed: "48 Juniper L", ms: 260 },
  { step: 1, mug: 2, focused: true, typed: "48 Juniper L", loading: true, ms: 450 },
  { step: 1, mug: 2, focused: true, typed: "48 Juniper L", list: true, ms: 750 },
  { step: 1, mug: 2, focused: true, typed: "48 Juniper L", list: true, press: "row", ms: 180 },
  { step: 1, mug: 2, focused: true, typed: "48 Juniper L", list: true, resolving: true, ms: 650 },
  { step: 1, mug: 2, resolved: true, ms: 800 },
  { step: 1, mug: 2, resolved: true, press: "express", ms: 150 },
  { step: 1, mug: 2, resolved: true, express: true, ms: 650 },
  { step: 1, ...AT_PAY, press: "continue", ms: 150 },
  { step: 2, ...AT_PAY, ms: 950 },
  { step: 2, ...AT_PAY, press: "pay", ms: 150 },
  { step: 2, ...AT_PAY, pay: "loading", ms: 1150 },
  { step: 2, ...AT_PAY, pay: "closed", ms: 560 },
  { step: 2, ...AT_PAY, pay: "paid", ms: 750 },
  { step: 3, ...AT_PAY, pay: "paid", ms: 1500 },
  { step: 3, ...AT_PAY, pay: "paid", reset: true, ms: 380 },
];

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

/** Walks the beats; each holds for `ms`, then loops, counting the loops. Holds the rest beat under reduced motion. */
function useStory() {
  const still = useReducedMotion();
  const [at, setAt] = useState({ i: 0, loop: 0 });
  useEffect(() => {
    if (still) { setAt({ i: 0, loop: 0 }); return; }
    const id = setTimeout(() => setAt((v) => (v.i + 1 < STORY.length ? { i: v.i + 1, loop: v.loop } : { i: 0, loop: v.loop + 1 })), STORY[at.i].ms);
    return () => clearTimeout(id);
  }, [at, still]);
  return { beat: STORY[at.i], loop: at.loop };
}

const money = (n: number) => `$${n.toFixed(2)}`;

// ─── Glyphs ─────────────────────────────────────────────────────────────────────────────────────

const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  xmark: "M7 7l10 10M17 7L7 17",
  pinEllipse: "M12 4.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2M12 9.7V17M8 15.2c-2.4.45-4 1.3-4 2.3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5c0-1-1.6-1.85-4-2.3",
  pin: "M12 3.5a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6M12 9.1V20.5",
};

function Glyph({ d, size, stroke = 2.4, style }: { d: string; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: bu(size), height: bu(size), flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

/** SF Symbols' `mug.fill` and `leaf.fill`, drawn as paths. */
function Mug({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: bu(size), height: bu(size) }}>
      <path d="M4.5 6.5h11v8.2a4.3 4.3 0 0 1-4.3 4.3H8.8a4.3 4.3 0 0 1-4.3-4.3z" fill="currentColor" />
      <path d="M15.5 8.6h1.3a2.9 2.9 0 0 1 0 5.8h-1.3" fill="none" stroke="currentColor" strokeWidth={2.2} />
    </svg>
  );
}
function Leaf({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: bu(size), height: bu(size) }}>
      <path d="M20 4.2C11 4 4.6 8 4.6 14.6c0 1.5.4 2.8 1 3.9C8 14 11.6 11.4 16 10c-4 2.2-7 5.4-8.6 9.3c1 .5 2.2.8 3.5.8C17.6 20.1 20.4 13.8 20 4.2z" fill="currentColor" />
    </svg>
  );
}

/** The system activity indicator: eight spokes fading around. */
function Spinner({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: bu(size), height: bu(size), animation: "co-spokes .8s steps(8) infinite" }}>
      {Array.from({ length: 8 }, (_, k) => (
        <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" opacity={0.25 + (0.75 * k) / 7} transform={`rotate(${k * 45} 12 12)`} />
      ))}
    </svg>
  );
}

// ─── Text that rolls ────────────────────────────────────────────────────────────────────────────

/** One character of a rolling figure: it rolls in only if it arrived after the figure first showed. */
function RollChar({ ch, roll, up }: { ch: string; roll: boolean; up: boolean }) {
  const [style] = useState<CSSProperties>(() => {
    const { easing, ms: dur } = curve("value");
    return { display: "inline-block", whiteSpace: "pre", ["--roll" as string]: up ? "45%" : "-45%", animation: roll ? `co-roll ${dur}ms ${easing} both` : undefined };
  });
  return <span style={style}>{ch}</span>;
}

/** A figure people read, like `.numericText`: the characters that change roll in, the rest hold still. */
function Roll({ text, value }: { text: string; value: number }) {
  const mounted = useRef(false), last = useRef(value);
  const up = value >= last.current;
  useEffect(() => { mounted.current = true; last.current = value; }, [value]);
  return (
    <span className="inline-flex tabular-nums" style={{ whiteSpace: "pre" }} aria-label={text}>
      {Array.from(text).map((c, i) => <RollChar key={`${i}${c}`} ch={c} roll={mounted.current} up={up} />)}
    </span>
  );
}

/** Something that blurs in where it appears, like `motion.swap`. */
const swapIn = (role: "snap" | "reveal" | "success" = "snap"): CSSProperties => ({ animation: `co-swap ${ms(role)}ms ${curve(role).easing} both` });

// ─── Trail ──────────────────────────────────────────────────────────────────────────────────────

/** Each title's width in points at the capsule's font, measured once the canvas has a size. */
function useTitleWidths() {
  const box = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>([29, 62, 28]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const point = (el.firstElementChild as HTMLElement).offsetWidth / 100;
      if (!point) return;
      const next = Array.from(el.children).slice(1).map((c) => Math.ceil((c as HTMLElement).offsetWidth / point));
      setWidths((prev) => (prev.every((w, i) => w === next[i]) ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const probe = (
    <div ref={box} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ visibility: "hidden", whiteSpace: "nowrap" }}>
      <span style={{ display: "block", width: bu(100), height: 0 }} />
      {TITLES.map((s) => <span key={s} style={{ position: "absolute", fontSize: bu(LABEL), fontWeight: 600 }}>{s}</span>)}
    </div>
  );
  return { widths, probe };
}

/**
 * StepTrail with the block's monochrome accent: glass stops resting joined, done steps with a check, the current step
 * a capsule in the label colour carrying its number and title. The capsule is laid out from its two edges: moving on,
 * the edge facing the move leads on snap and the far edge follows a beat behind on a looser spring, so it stretches
 * across the neck and gathers. Inside it every face is drawn in its ink exactly where the stops draw theirs, cut to its
 * outline, so a number turns under its edge. Once every step is done it goes and the last stop takes its check.
 */
function Trail({ at, complete }: { at: number; complete: boolean }) {
  const { widths, probe } = useTitleWidths();
  const open = complete ? -1 : at;
  let x = 0;
  const stops = TITLES.map((_, k) => {
    const w = k === open ? LEAD + widths[k] + TAIL : D;
    const s = { x, w };
    x += w + GAP;
    return s;
  });
  const width = Math.max(...TITLES.map((_, k) => 2 * (D + GAP) + LEAD + widths[k] + TAIL));
  const cur = stops[Math.min(at, 2)];
  // Which way the capsule travels, for which edge leads.
  const last = useRef(at), forward = useRef(true);
  if (at !== last.current) { forward.current = at > last.current; last.current = at; }
  const lead = (v: string) => t(v, "snap"), trail = (v: string) => t(v, follow("snap", 4), 50);
  const edges = forward.current ? [lead("--co-hi"), trail("--co-lo")] : [trail("--co-hi"), lead("--co-lo")];
  const done = (k: number) => complete || k < at;
  const face = (k: number) => (
    <span className="absolute inset-y-0 left-0 flex items-center">
      <span className="relative flex shrink-0 items-center justify-center" style={{ width: bu(D), height: bu(D) }}>
        <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: done(k) ? 0 : 1, filter: `blur(${done(k) ? 3 : 0}px)`, transition: t(["opacity", "filter"], "snap") }}>
          <span className="tabular-nums" style={{ fontSize: bu(LABEL), lineHeight: 1 }}>{k + 1}</span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: done(k) ? 1 : 0, filter: `blur(${done(k) ? 0 : 3}px)`, transition: t(["opacity", "filter"], "snap", 60) }}>
          <Glyph d={PATHS.check} size={14} stroke={2.6} />
        </span>
      </span>
      <span className="whitespace-nowrap" style={{
        fontSize: bu(LABEL), lineHeight: 1, marginLeft: bu(LEAD - D), opacity: k === open ? 1 : 0, filter: `blur(${k === open ? 0 : 5}px)`,
        transition: k === open ? t(["opacity", "filter"], "reveal", 110) : t(["opacity", "filter"], "dismiss"),
      }}>{TITLES[k]}</span>
    </span>
  );
  const placed = (k: number): CSSProperties => ({ left: bu(stops[k].x), width: bu(stops[k].w), height: bu(D), transition: t(["left", "width"], "morph") });
  return (
    <div>
      <div className="relative" style={{ width: bu(width), height: bu(D) }}>
        {probe}
        <LiquidGroup unit={bu(1)} style={{ width: bu(width), height: bu(D) }}>
          {TITLES.map((title, k) => (
            <span key={title} className="absolute top-0" style={placed(k)}>
              <Liquid className="relative h-full w-full overflow-hidden" style={{ color: k <= at || complete ? ground.text : ground.muted, transition: t("color", "snap") }}>{face(k)}</Liquid>
            </span>
          ))}
          {/* The capsule between its live edges, in the label colour, with every face in the ground's ink inside it. */}
          <span className="absolute top-0" style={{
            left: "var(--co-lo)", width: "calc(var(--co-hi) - var(--co-lo))", height: bu(D), opacity: complete ? 0 : 1,
            ["--co-lo" as string]: bu(cur.x), ["--co-hi" as string]: bu(cur.x + cur.w),
            transition: [...edges, t("opacity", "dismiss")].join(", "),
          } as CSSProperties}>
            <Liquid tint={ground.text} className="relative h-full w-full overflow-hidden">
              <span className="absolute top-0" style={{ left: "calc(var(--co-lo) * -1)", width: bu(width), height: bu(D), color: ground.bg }}>
                {TITLES.map((title, k) => <span key={title} className="absolute top-0" style={placed(k)}>{face(k)}</span>)}
              </span>
            </Liquid>
          </span>
        </LiquidGroup>
      </div>
      <div style={{ marginTop: bu(10), height: bu(16), fontSize: bu(13), lineHeight: bu(16), color: ground.muted }}>
        {complete ? <span key="done" style={swapIn()}>Complete</span> : <span>Step <Roll text={String(at + 1)} value={at} /> of 3</span>}
      </div>
    </div>
  );
}

// ─── Parts ──────────────────────────────────────────────────────────────────────────────────────

const card: CSSProperties = { background: ground.surface, borderRadius: bu(22) };
const body: CSSProperties = { fontSize: bu(17), lineHeight: bu(22) };
const sub: CSSProperties = { fontSize: bu(15), lineHeight: bu(20), color: ground.muted };
const hairline = (inset: number) => <div style={{ height: 1, marginLeft: bu(inset), background: ground.line }} />;
const sectionLabel = (text: string, top = 0) => <div style={{ fontSize: bu(13), lineHeight: bu(18), color: ground.muted, paddingInline: bu(4), marginTop: bu(top) }}>{text}</div>;

function Tile({ color, size, children }: { color: string; size: number; children: ReactNode }) {
  return <div className="grid shrink-0 place-items-center" style={{ width: bu(size), height: bu(size), borderRadius: bu(size * 0.28), background: color, color: ink }}>{children}</div>;
}

/** A label and an amount on one line, the amount rolling to its new value. */
function AmountRow({ title, detail, amount, total }: { title: string; detail?: string; amount: string; total?: boolean }) {
  const size = total ? { fontSize: bu(20), lineHeight: bu(25) } : body;
  return (
    <div className="flex items-baseline justify-between" style={size}>
      <span>{title}{detail ? <span style={{ color: ground.muted }}>{"  "}{detail}</span> : null}</span>
      <Roll text={amount} value={Number(amount.replace(/[^0-9.]/g, ""))} />
    </div>
  );
}

/** CommitButton as Continue: signal glass with ink, or clear glass with a grey label while its step is incomplete. */
function ContinueButton({ enabled, pressed }: { enabled: boolean; pressed: boolean }) {
  return (
    <div style={{ transform: `scale(${pressed ? pressScale(W, BUTTON_H) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
      <LiquidGroup unit={bu(1)}>
        <Liquid tint={enabled ? signal.fill : undefined} className="flex items-center justify-center" style={{ height: bu(BUTTON_H), ...body, color: enabled ? signal.on : ground.subtle, transition: t(["background-color", "color"], "morph") }}>
          Continue
        </Liquid>
      </LiquidGroup>
    </div>
  );
}

// ─── Bag ────────────────────────────────────────────────────────────────────────────────────────

/** ScrubStepper in neutral glass: round minus and plus bubbles joined to the numeral pill, which lifts when held. */
function Stepper({ value, scrub, ruler = 0 }: { value: number; scrub?: boolean; ruler?: number }) {
  const H = 44;
  const button = (d: string) => (
    <Liquid className="flex shrink-0 items-center justify-center" style={{ width: bu(H), height: bu(H), color: ground.text }}>
      <Glyph d={d} size={17} stroke={2.6} />
    </Liquid>
  );
  return (
    <LiquidGroup unit={bu(1)}>
      <div className="flex items-center" style={{ gap: bu(GAP), height: bu(H) }}>
        {button(PATHS.minus)}
        <Liquid className="relative flex items-center justify-center overflow-hidden" style={{
          height: bu(H), minWidth: bu(72), paddingInline: bu(18), zIndex: 1, color: ground.text,
          transform: `scale(${scrub ? 1.04 : 1})`, transition: t("transform", scrub ? "press" : "release"),
        }}>
          <span className="tabular-nums" style={{ fontFamily: font.rounded, fontSize: bu(22), lineHeight: 1 }}><Roll text={String(value)} value={value} /></span>
          {/* The ruler follows the lift a beat behind and runs with the finger. */}
          <span className="absolute inset-x-0 bottom-0 overflow-hidden" style={{
            height: bu(10), opacity: scrub ? 1 : 0, transition: t("opacity", follow("press", 1)),
            maskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)",
          }}>
            <span className="absolute flex items-end" style={{ left: bu(-28), bottom: bu(3), gap: bu(5.5), transform: `translateX(${bu(ruler)})`, transition: t("transform", "settle") }}>
              {Array.from({ length: 18 }, (_, i) => <span key={i} style={{ width: bu(1.5), height: bu(i % 2 ? 4 : 7), borderRadius: bu(1), background: "currentColor", opacity: 0.4 }} />)}
            </span>
          </span>
        </Liquid>
        {button(PATHS.plus)}
      </div>
    </LiquidGroup>
  );
}

function Line({ tile, icon, name, variant, unit, quantity, scrub, ruler }: { tile: string; icon: ReactNode; name: string; variant: string; unit: number; quantity: number; scrub?: boolean; ruler?: number }) {
  return (
    <div className="flex items-start" style={{ padding: bu(16), gap: bu(14) }}>
      <Tile color={tile} size={52}>{icon}</Tile>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: bu(12) }}>
        <div className="flex items-baseline" style={{ gap: bu(12) }}>
          <div className="min-w-0 flex-1">
            <div style={body}>{name}</div>
            <div style={{ ...sub, marginTop: bu(2) }}>{variant}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span style={body}><Roll text={money(unit * quantity)} value={unit * quantity} /></span>
            {quantity > 1 ? <span key="each" style={{ ...sub, marginTop: bu(2), ...swapIn() }}>{money(unit)} each</span> : null}
          </div>
        </div>
        <Stepper value={quantity} scrub={scrub} ruler={ruler} />
      </div>
    </div>
  );
}

function Bag({ b }: { b: Beat }) {
  const count = b.mug + 1, subtotal = b.mug * 20 + 16;
  return (
    <div className="flex flex-col" style={{ gap: bu(16) }}>
      <div style={card}>
        <Line tile={blocks.sage} icon={<Mug size={28} />} name="Stoneware Mug" variant="Sage glaze, 12 oz" unit={20} quantity={b.mug} scrub={b.scrub} ruler={b.ruler} />
        {hairline(16)}
        <Line tile={blocks.butter} icon={<Leaf size={26} />} name="House Blend" variant="Whole bean, 340 g" unit={16} quantity={1} />
      </div>
      <div style={{ paddingInline: bu(4) }}>
        <AmountRow title="Subtotal" detail={`${count} items`} amount={money(subtotal)} />
      </div>
      <div style={{ marginTop: bu(4) }}><ContinueButton enabled pressed={b.press === "continue"} /></div>
    </div>
  );
}

// ─── Delivery ───────────────────────────────────────────────────────────────────────────────────

const FIELD_H = 56;
/** The column a bubble holds beside the field and the list while it is out. */
const COLUMN = FIELD_H + liquid.joined;
const SLIVER = 28;
const LIST_HOME = liquid.apart + SLIVER / 2 + (SLIVER * liquid.homeScale) / 2 + 4;
const TUCKED = -(FIELD_H / 2 + liquid.joined + (FIELD_H * liquid.homeScale) / 2);
const AT_EDGE = (FIELD_H * (1 - liquid.homeScale)) / 2;
const ROW_H = 60;

/** AddressField: typing buds the clear bubble, the suggestion pours out of the field, a pick spins beside its row, and
 *  the address settles in with its locality and the sage check as the list and bubbles melt home. */
function Address({ b }: { b: Beat }) {
  const listOut = !!b.list;
  const rowOut = !!b.resolving;
  const accessoryOut = !!b.focused && (!!b.typed || !!b.loading);
  const column = accessoryOut || rowOut ? COLUMN : 0;
  const columnMove = (out: boolean) => t("margin-right", out ? liquid.split : liquid.home);
  const placed = budStyle({ out: listOut, home: [0, -LIST_HOME] }, bu(1));
  const listBud: CSSProperties = { ...placed, opacity: listOut ? 1 : 0, transition: `${placed.transition}, opacity 0s linear ${listOut ? 0 : ms(liquid.home) + 40}ms` };
  const query = "48 Juniper L";
  return (
    <LiquidGroup unit={bu(1)} axis="both">
      <div className="relative" style={{ zIndex: 1 }}>
        <span className="absolute right-0 top-0" style={{ width: bu(FIELD_H), height: bu(FIELD_H) }}>
          <Liquid bud={{ out: accessoryOut, home: [rowOut ? TUCKED : AT_EDGE, 0] }} className="relative flex items-center justify-center" style={{ width: bu(FIELD_H), height: bu(FIELD_H), color: b.loading ? ground.muted : ground.text }}>
            <BudContent out={accessoryOut}>{b.loading ? <Spinner size={16} /> : <Glyph d={PATHS.xmark} size={16} stroke={2.6} />}</BudContent>
          </Liquid>
        </span>
        <Liquid radius={18} className="relative flex items-center" style={{
          gap: bu(12), minHeight: bu(FIELD_H), paddingLeft: bu(16), paddingRight: bu(b.resolved ? 12 : 16), paddingBlock: bu(8), boxSizing: "border-box",
          marginRight: bu(column), transition: columnMove(column > 0),
        }}>
          <span aria-hidden className="pointer-events-none absolute" style={{ inset: bu(3), borderRadius: bu(15), boxShadow: `inset 0 0 0 ${bu(2)} ${b.focused ? signal.fill : "transparent"}`, transition: t("box-shadow", "snap") }} />
          <span className="flex justify-center" style={{ width: bu(32), color: signal.fill }}><Glyph d={PATHS.pinEllipse} size={21} stroke={2.2} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center whitespace-nowrap" style={{ ...body, height: bu(22) }}>
              {b.resolved ? <span>48 Juniper Lane</span> : b.typed ? <span>{b.typed}</span> : null}
              {b.focused ? <span style={{ width: bu(2), height: bu(20), marginInline: bu(1), background: ground.text, animation: "co-caret 1s steps(1) infinite" }} /> : null}
              {!b.typed && !b.resolved ? <span style={{ color: ground.muted }}>Delivery address</span> : null}
            </div>
            {b.resolved ? <div key="locality" style={{ ...sub, marginTop: bu(2), ...swapIn("reveal") }}>Bellmont OR 97321</div> : null}
          </div>
          {b.resolved ? (
            <span key="ok" className="grid shrink-0 place-items-center" style={{ width: bu(26), height: bu(26), borderRadius: "50%", background: blocks.sage, color: ink, ...swapIn("success") }}>
              <Glyph d={PATHS.check} size={14} stroke={3} />
            </span>
          ) : null}
        </Liquid>
      </div>
      {/* The list pours down out of the field and melts back the same way; its room opens and closes with it, so
          what sits below glides rather than jumps. */}
      <div className="relative" style={{ height: bu(listOut ? liquid.apart + ROW_H + 12 : 0), transition: t("height", listOut ? liquid.split : liquid.home) }}>
        <div className="absolute inset-x-0" style={{ top: bu(liquid.apart), ...listBud }}>
          <span className="absolute right-0" style={{ top: bu(6 + ROW_H / 2 - FIELD_H / 2), width: bu(FIELD_H), height: bu(FIELD_H) }}>
            <Liquid bud={{ out: rowOut, home: [accessoryOut ? TUCKED : AT_EDGE, 0] }} className="flex items-center justify-center" style={{ width: bu(FIELD_H), height: bu(FIELD_H), color: ground.text }}>
              <BudContent out={rowOut}><Spinner size={16} /></BudContent>
            </Liquid>
          </span>
          <Liquid radius={18} className="relative overflow-hidden" style={{ height: bu(listOut ? ROW_H + 12 : SLIVER), marginRight: bu(column), transition: `${t("height", listOut ? liquid.split : liquid.home)}, ${columnMove(column > 0)}` }}>
            <div style={{ padding: bu(6), opacity: listOut ? 1 : 0, filter: `blur(${listOut ? 0 : 6}px)`, transition: listOut ? "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms" : "opacity 140ms ease-out, filter 140ms ease-out" }}>
              <div className="flex items-center" style={{
                gap: bu(12), minHeight: bu(ROW_H), paddingInline: bu(10), borderRadius: bu(12),
                background: b.press === "row" || b.resolving ? `color-mix(in srgb, ${ground.text} 9%, transparent)` : "transparent",
                transform: `scale(${b.press === "row" ? pressScale(W, ROW_H, 1) : 1})`, transition: [t("background-color", "snap"), t("transform", b.press === "row" ? "press" : "release")].join(", "),
              }}>
                <span className="flex shrink-0 justify-center" style={{ width: bu(32), color: ground.muted }}><Glyph d={PATHS.pin} size={18} stroke={2.6} /></span>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-nowrap" style={body}>{query}<span style={{ color: ground.muted }}>ane</span></div>
                  <div className="whitespace-nowrap" style={sub}>Bellmont, OR, United States</div>
                </div>
              </div>
            </div>
          </Liquid>
        </div>
      </div>
    </LiquidGroup>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className="relative shrink-0" style={{ width: bu(24), height: bu(24) }}>
      <span className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 ${bu(2)} ${ground.subtle}`, opacity: on ? 0 : 1, transition: t("opacity", "snap") }} />
      <span className="absolute inset-0 grid place-items-center rounded-full" style={{ background: ground.text, color: ground.surface, opacity: on ? 1 : 0, transform: `scale(${on ? 1 : 0.4})`, transition: t(["opacity", "transform"], "snap") }}>
        <Glyph d={PATHS.check} size={12} stroke={3.2} />
      </span>
    </span>
  );
}

function SpeedRow({ title, estimate, price, on, pressed }: { title: string; estimate: string; price: string; on: boolean; pressed?: boolean }) {
  return (
    <div className="flex items-center" style={{
      gap: bu(14), minHeight: bu(64), paddingInline: bu(16), paddingBlock: bu(12), boxSizing: "border-box",
      background: pressed ? `color-mix(in srgb, ${ground.text} 6%, transparent)` : "transparent", transition: pressed ? undefined : t("background-color", "dismiss"),
    }}>
      <Radio on={on} />
      <div className="min-w-0 flex-1">
        <div style={body}>{title}</div>
        <div style={sub}>{estimate}</div>
      </div>
      <span className="tabular-nums" style={body}>{price}</span>
    </div>
  );
}

function Delivery({ b }: { b: Beat }) {
  return (
    <div className="flex flex-col" style={{ gap: bu(10) }}>
      {sectionLabel("Deliver to")}
      <Address b={b} />
      {sectionLabel("Delivery speed", 14)}
      <div className="overflow-hidden" style={card}>
        <SpeedRow title="Standard" estimate="In 4–5 days" price="Free" on={!b.express} />
        {hairline(56)}
        <SpeedRow title="Express" estimate="Arrives tomorrow" price="$8.00" on={!!b.express} pressed={b.press === "express"} />
      </div>
      <div style={{ marginTop: bu(18) }}><ContinueButton enabled={!!b.resolved} pressed={b.press === "continue"} /></div>
    </div>
  );
}

// ─── Pay ────────────────────────────────────────────────────────────────────────────────────────

/** CommitButton running the payment: it draws in around its label as the ring bubble buds out of its end; on success
 *  the ring closes and both turn sage, the check draws, then the bubble melts home as the label turns to Paid. */
function PayButton({ phase, pressed, labelWidth }: { phase: PayPhase; pressed: boolean; labelWidth: number }) {
  const working = phase === "loading" || phase === "closed";
  const success = phase === "closed" || phase === "paid";
  const out = working;
  const slot = out ? BUTTON_H + liquid.joined : 0;
  const width = working ? labelWidth + 56 : W - slot;
  const tint = success ? blocks.sage : signal.fill;
  const C = 2 * Math.PI * 10;
  return (
    <div className="flex justify-center" style={{ transform: `scale(${pressed ? pressScale(W, BUTTON_H) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
      <LiquidGroup unit={bu(1)}>
        <div className="flex items-center" style={{ height: bu(BUTTON_H) }}>
          <Liquid tint={tint} className="relative flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap" style={{
            zIndex: 1, width: bu(width), height: bu(BUTTON_H), gap: bu(8), color: ink, ...body,
            transition: t(["width", "background-color"], "morph"),
          }}>
            {phase === "paid" ? <span key="check" className="pv-lq-in flex"><Glyph d={PATHS.check} size={17} stroke={2.8} /></span> : null}
            <MorphText text={phase === "paid" ? "Paid" : "Pay $64.00"} />
          </Liquid>
          <div className="relative shrink-0" style={{ width: bu(slot), height: bu(BUTTON_H), transition: t("width", out ? liquid.split : liquid.home) }}>
            <Liquid tint={out && success ? blocks.sage : undefined} bud={{ out, home: [0, 0] }} className="absolute right-0 top-0 grid place-items-center" style={{ width: bu(BUTTON_H), height: bu(BUTTON_H), color: ink, transition: t("background-color", "morph") }}>
              <BudContent out={out}>
                <svg viewBox="0 0 26 26" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: bu(26), height: bu(26) }} aria-hidden>
                  <circle cx="13" cy="13" r="10" stroke={success ? ink : ground.text} opacity={success ? 0.22 : 0.14} />
                  <circle cx="13" cy="13" r="10" stroke={success ? ink : signal.fill} strokeDasharray={C} style={{
                    strokeDashoffset: success ? 0 : C * 0.72, transformBox: "fill-box", transformOrigin: "center", animation: "co-turn 1s linear infinite",
                    transition: `${t("stroke-dashoffset", "morph")}, ${t("stroke", "morph")}`,
                  }} />
                  <path d="M8.4 13.6l3.2 3.2 6-6.6" stroke={ink} pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: success ? 0 : 1, transition: t("stroke-dashoffset", success ? "reveal" : "dismiss", success ? 260 : 0) }} />
                </svg>
              </BudContent>
            </Liquid>
          </div>
        </div>
      </LiquidGroup>
    </div>
  );
}

/** The payment method's drawn mark: a small card with a chip and four dots, never a network logo. */
function CardMark() {
  return (
    <div className="relative shrink-0" style={{ width: bu(42), height: bu(30), borderRadius: bu(6), background: blocks.sky }}>
      <span className="absolute" style={{ left: bu(7), top: bu(9), width: bu(9), height: bu(7), borderRadius: bu(2), background: "rgba(20,20,20,.55)" }} />
      <span className="absolute flex" style={{ right: bu(6), bottom: bu(6), gap: bu(2) }}>
        {[0, 1, 2, 3].map((k) => <span key={k} style={{ width: bu(3), height: bu(3), borderRadius: "50%", background: "rgba(20,20,20,.55)" }} />)}
      </span>
    </div>
  );
}

function Pay({ b, labelWidth }: { b: Beat; labelWidth: number }) {
  return (
    <div className="flex flex-col" style={{ gap: bu(16) }}>
      <div style={card}>
        <div className="flex items-start" style={{ padding: bu(16), gap: bu(14) }}>
          <Tile color={ground.field} size={42}><span style={{ color: ground.text, display: "flex" }}><Glyph d={PATHS.pinEllipse} size={20} stroke={2.2} /></span></Tile>
          <div className="min-w-0 flex-1">
            <div style={body}>48 Juniper Lane</div>
            <div style={sub}>Bellmont OR 97321</div>
            <div style={{ ...sub, marginTop: bu(4) }}>Express · Arrives tomorrow</div>
          </div>
        </div>
        {hairline(72)}
        <div className="flex items-center" style={{ paddingLeft: bu(16), paddingRight: bu(10), paddingBlock: bu(14), gap: bu(14) }}>
          <div className="grid shrink-0 place-items-center" style={{ width: bu(42), height: bu(42) }}><CardMark /></div>
          <div className="min-w-0 flex-1">
            <div style={body}>Visa ending 4242</div>
            <div style={sub}>Expires 08/28</div>
          </div>
          {/* Change steps aside while the payment is out, as in the block. */}
          {(b.pay ?? "idle") === "idle" ? (
            <LiquidGroup unit={bu(1)} lift={false}>
              <Liquid className="flex items-center" style={{ height: bu(36), paddingInline: bu(14), fontSize: bu(15), color: ground.text, margin: bu(4) }}>Change</Liquid>
            </LiquidGroup>
          ) : <span style={{ height: bu(44) }} />}
        </div>
        {hairline(16)}
        <div className="flex flex-col" style={{ padding: bu(16), gap: bu(10) }}>
          <AmountRow title="Subtotal" detail="3 items" amount="$56.00" />
          <AmountRow title="Delivery" detail="Express" amount="$8.00" />
          <div style={{ marginTop: bu(4) }}><AmountRow title="Total" amount="$64.00" total /></div>
        </div>
      </div>
      <PayButton phase={b.pay ?? "idle"} pressed={b.press === "pay"} labelWidth={labelWidth} />
    </div>
  );
}

// ─── Placed ─────────────────────────────────────────────────────────────────────────────────────

function Placed() {
  return (
    <div className="flex flex-col" style={{ ...card, padding: bu(20), gap: bu(16) }}>
      <span className="grid place-items-center" style={{ width: bu(52), height: bu(52), borderRadius: "50%", background: blocks.sage, color: ink, animation: `co-pop ${ms("success")}ms ${curve("success").easing} 120ms both` }}>
        <Glyph d={PATHS.check} size={24} stroke={2.8} />
      </span>
      <div>
        <div style={{ fontSize: bu(22), lineHeight: bu(28) }}>Order placed</div>
        <div style={{ ...body, color: ground.muted, marginTop: bu(4) }}>Express · Arrives tomorrow</div>
        <div style={{ ...sub, marginTop: bu(4) }}>48 Juniper Lane, Bellmont OR 97321</div>
      </div>
      {hairline(0)}
      <AmountRow title="Paid" detail="Visa ending 4242" amount="$64.00" />
    </div>
  );
}

// ─── Steps ──────────────────────────────────────────────────────────────────────────────────────

/** The step content: the step leaving slides a little the way the trail moved and blurs out over the one arriving. */
function Steps({ step, render }: { step: number; render: (step: number) => ReactNode }) {
  const [s, setS] = useState({ cur: step, prev: -1, dir: 1, n: 0 });
  useEffect(() => {
    if (step === s.cur) return;
    setS((v) => ({ cur: step, prev: v.cur, dir: step >= v.cur ? 1 : -1, n: v.n + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if (s.prev < 0) return;
    const id = setTimeout(() => setS((v) => ({ ...v, prev: -1 })), ms("dismiss") + 60);
    return () => clearTimeout(id);
  }, [s.n, s.prev]);
  const f = s.dir > 0 ? "f" : "b";
  return (
    <div className="relative">
      <div key={`c${s.n}`} style={{ animation: s.n ? `co-in-${f} ${ms("reveal")}ms ${curve("reveal").easing} both` : undefined }}>{render(s.cur)}</div>
      {s.prev >= 0 ? (
        <div key={`p${s.n}`} aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ animation: `co-out-${f} ${ms("dismiss")}ms ${curve("dismiss").easing} both` }}>{render(s.prev)}</div>
      ) : null}
    </div>
  );
}

const keyframes = [
  `@keyframes co-in-f{from{opacity:0;filter:blur(6px);transform:translateX(${bu(28)})}to{opacity:1;filter:none;transform:none}}`,
  `@keyframes co-in-b{from{opacity:0;filter:blur(6px);transform:translateX(${bu(-28)})}to{opacity:1;filter:none;transform:none}}`,
  `@keyframes co-out-f{from{opacity:1;filter:none;transform:none}to{opacity:0;filter:blur(6px);transform:translateX(${bu(-28)})}}`,
  `@keyframes co-out-b{from{opacity:1;filter:none;transform:none}to{opacity:0;filter:blur(6px);transform:translateX(${bu(28)})}}`,
  "@keyframes co-roll{from{transform:translateY(var(--roll,45%));opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}",
  "@keyframes co-swap{from{opacity:0;filter:blur(4px);transform:scale(.85)}to{opacity:1;filter:none;transform:none}}",
  "@keyframes co-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}",
  "@keyframes co-fade{from{opacity:0}to{opacity:1}}",
  "@keyframes co-spokes{to{transform:rotate(360deg)}}",
  "@keyframes co-turn{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}",
  "@keyframes co-caret{0%,49%{opacity:1}50%,100%{opacity:0}}",
  "@property --co-lo{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --co-hi{syntax:'<length>';inherits:true;initial-value:0px}",
  "@media (prefers-reduced-motion: reduce){[style*='co-in-'],[style*='co-out-'],[style*='co-swap'],[style*='co-pop'],[style*='co-roll']{animation:none!important}[style*='co-out-']{opacity:0}}",
].join("");

/** The width of "Pay $64.00" in points, so the capsule draws in around it exactly. */
function useLabelWidth() {
  const probe = useRef<HTMLSpanElement>(null), unit = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(86);
  useLayoutEffect(() => {
    const p = probe.current, u = unit.current;
    if (p && u && u.offsetWidth > 0) setWidth(p.offsetWidth / (u.offsetWidth / 100));
  }, []);
  const node = (
    <>
      <span ref={probe} aria-hidden className="pointer-events-none absolute whitespace-pre" style={{ visibility: "hidden", fontSize: bu(17), fontWeight: 600 }}>Pay $64.00</span>
      <span ref={unit} aria-hidden className="pointer-events-none absolute" style={{ visibility: "hidden", width: bu(100), height: 0 }} />
    </>
  );
  return { width, node };
}

export function CheckoutBlockPreview() {
  const { beat, loop } = useStory();
  const label = useLabelWidth();
  return (
    <div className="absolute inset-0" style={{ background: ground.bg }}>
      <style>{keyframes}</style>
      <BlockCanvas style={{ fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
        {label.node}
        {/* The loop fades out, then starts over from the rest state. */}
        <div key={loop} className="flex flex-col" style={{
          paddingTop: bu(28), gap: bu(22),
          opacity: beat.reset ? 0 : 1, transition: t("opacity", "dismiss"),
          animation: loop ? `co-fade ${ms("reveal")}ms ease-out both` : undefined,
        }}>
          <Trail at={Math.min(beat.step, 2)} complete={beat.step === 3} />
          <Steps step={beat.step} render={(s) => (s === 0 ? <Bag b={beat} /> : s === 1 ? <Delivery b={beat} /> : s === 2 ? <Pay b={beat} labelWidth={label.width} /> : <Placed />)} />
        </div>
      </BlockCanvas>
    </div>
  );
}
