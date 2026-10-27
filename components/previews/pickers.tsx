"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, shake, t, tiers, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup } from "./piece-liquid";

/*
 * The 2026-10-27 pickers and controls: Liquid Switch, Page Dots, Choice Group, Swatch Picker, Time Slot Picker,
 * Level Picker, Date Strip and Interest Chips, the component only. Sizes are authored in points as the Swift pieces
 * draw them, converted to `cqw` against the 560 px stage, and each stage is scaled as one picture.
 *
 * Every selection flows the way the Swift pieces' edges do: each edge of the red is its own CSS inset with its own
 * transition, the edge facing the move on the tight spring and the far edge on the responsive one, so the red
 * stretches toward the pick and gathers in. Glass sits in a `LiquidGroup` under the labels, as in Swift.
 */

const u = (pt: number) => `${(pt / 5.6).toFixed(3)}cqw`;
const LEAD: Spring = tiers.tight;
const TRAIL: Spring = tiers.responsive;
/** Neutral controls: unselected dots, rings and boxes, as the Swift styles' `control` colour. */
const CONTROL = "var(--pv-control, #4a4a48)";
/** A glass group filling its parent. Inline, since the group's own `relative` class would beat an `absolute` one. */
const FILL: CSSProperties = { position: "absolute", inset: 0 };

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

/** Remembers the previous value of `value`, for which way a selection is moving. */
function usePrevious<T>(value: T): T {
  const ref = useRef({ value, previous: value });
  if (ref.current.value !== value) ref.current = { value, previous: ref.current.value };
  return ref.current.previous;
}

/** Transitions for a pair of opposite insets: the edge facing the move leads, the far edge follows. */
function edges(low: string, high: string, forward: boolean): string {
  return [t(high, forward ? LEAD : TRAIL), t(low, forward ? TRAIL : LEAD)].join(", ");
}

function Stage({ scale, children, style }: { scale: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <div style={{ transform: `scale(${scale})`, ...style }}>{children}</div>
    </div>
  );
}

const Check = ({ size, color, style }: { size: number; color: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" aria-hidden style={{ width: u(size), height: u(size), flex: "none", ...style }}>
    <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Shakes `ref` once each time `key` changes to a truthy value, as `pieceShake` does. */
function useShake(ref: React.RefObject<HTMLElement | null>, key: number, distance = 6) {
  useEffect(() => {
    if (key && ref.current) ref.current.animate(...shake(u, distance));
  }, [key, ref, distance]);
}

// MARK: - Liquid Switch

const SW_W = 52, SW_H = 32, SW_IN = 2, SW_THUMB = 28;
const SWITCH_STEPS = [
  { ms: 1100, on: [true, false, false] },
  { ms: 900, on: [true, true, false] },
  { ms: 900, on: [true, true, true] },
  { ms: 1000, on: [false, true, true] },
  { ms: 900, on: [false, false, true] },
  { ms: 900, on: [true, false, false] },
] as const;

function Switch({ on }: { on: boolean }) {
  const was = usePrevious(on);
  const forward = on && !was ? true : !on && was ? false : on;
  const travel = SW_W - SW_IN * 2 - SW_THUMB;
  return (
    <div className="relative" style={{ width: u(SW_W), height: u(SW_H) }}>
      <LiquidGroup unit={u(1)} lift={false} style={FILL}>
        <Liquid style={{ position: "absolute", inset: 0 }} />
      </LiquidGroup>
      {/* The fill floods out of the thumb as it crosses. */}
      <span className="absolute" style={{
        top: 0, bottom: 0, left: 0, borderRadius: 9999, background: signal.fill,
        right: u(on ? 0 : SW_W - SW_H), opacity: on ? 1 : 0,
        transition: [t("right", forward ? LEAD : TRAIL), t("opacity", "value")].join(", "),
      }} />
      <span className="absolute" style={{
        top: u(SW_IN), bottom: u(SW_IN), borderRadius: 9999, background: "#fff",
        left: u(SW_IN + (on ? travel : 0)), right: u(SW_IN + (on ? 0 : travel)),
        boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: edges("left", "right", forward),
      }} />
    </div>
  );
}

export function LiquidSwitchPreview() {
  const { step } = useLoop(SWITCH_STEPS);
  return (
    <Stage scale={1.45}>
      <div className="flex flex-col" style={{ width: u(240), gap: u(18), fontSize: u(17) }}>
        {["Wi-Fi", "Dark mode", "Sounds"].map((title, i) => (
          <div key={title} className="flex items-center justify-between">
            <span>{title}</span>
            <Switch on={step.on[i]} />
          </div>
        ))}
      </div>
    </Stage>
  );
}

// MARK: - Page Dots

const DOT = 8, DOT_WIDE = 24, DOT_GAP = 8;
const DOT_STEPS = [1, 2, 3, 1, 0].map((page) => ({ ms: 900, page }));

function Dots({ count, page, timer }: { count: number; page: number; timer?: number }) {
  return (
    <div className="flex items-center" style={{ gap: u(DOT_GAP), height: u(DOT) }}>
      {Array.from({ length: count }, (_, i) => {
        const open = i === page;
        // The new dot opens on the tight spring; the old one closes on the looser one, so the red pours across.
        const spring = open ? LEAD : TRAIL;
        return (
          <span key={i} className="relative overflow-hidden" style={{
            width: u(open ? DOT_WIDE : DOT), height: u(DOT), borderRadius: 9999,
            background: open ? (timer === undefined ? signal.fill : "rgba(255,0,0,.32)") : CONTROL,
            transition: [t("width", spring), `background-color 120ms linear ${open ? 0 : curve(TRAIL).ms * 0.35}ms`].join(", "),
          }}>
            {open && timer !== undefined ? (
              <span key={timer} className="absolute inset-y-0 left-0" style={{ background: signal.fill, borderRadius: 9999, animation: "pk-timer 2000ms linear forwards" }} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function PageDotsPreview() {
  const { step } = useLoop(DOT_STEPS);
  const [featured, setFeatured] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setFeatured((v) => (v + 1) % 4), 2000);
    return () => clearTimeout(timer);
  }, [featured, reduced]);
  return (
    <Stage scale={1.9}>
      <style>{`@keyframes pk-timer{from{width:${u(DOT)}}to{width:100%}}`}</style>
      <div className="flex flex-col items-center" style={{ gap: u(30) }}>
        <Dots count={5} page={step.page} />
        <div className="relative" style={{ padding: `${u(12)} ${u(14)}` }}>
          <LiquidGroup unit={u(1)} style={FILL}>
            <Liquid style={{ position: "absolute", inset: 0 }} />
          </LiquidGroup>
          <div className="relative"><Dots count={4} page={featured} timer={featured} /></div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Choice Group

const ROW = 52, RING = 22, DROP = 10;
const SPEEDS = [["Standard", "Free"], ["Express", "$6"], ["Same day", "$12"]] as const;
const CHOICE_STEPS = [
  { ms: 1000, speed: 0, extras: [true, false] },
  { ms: 1000, speed: 2, extras: [true, false] },
  { ms: 1000, speed: 2, extras: [true, true] },
  { ms: 1000, speed: 1, extras: [true, true] },
  { ms: 1000, speed: 0, extras: [true, false] },
] as const;

function Card({ rows, children }: { rows: number; children: ReactNode }) {
  return (
    <div className="relative" style={{ height: u(rows * ROW) }}>
      <LiquidGroup unit={u(1)} style={FILL}>
        <Liquid radius={22} style={{ position: "absolute", inset: 0 }} />
      </LiquidGroup>
      <div className="relative">{children}</div>
    </div>
  );
}

function Row({ last, children }: { last: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center" style={{ height: u(ROW), padding: `0 ${u(16)}`, gap: u(12), boxShadow: last ? undefined : `inset 0 -1px 0 ${ground.line}` }}>
      {children}
    </div>
  );
}

function Box({ on }: { on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const was = usePrevious(on);
  useEffect(() => {
    if (on && !was) ref.current?.animate([{ transform: "scale(1)" }, { transform: "scale(.94)", offset: 0.12 }, { transform: "scale(1.08)", offset: 0.33, easing: curve("success").easing }, { transform: "scale(1)" }], { duration: 640 });
  }, [on, was]);
  return (
    <span ref={ref} className="grid place-items-center" style={{
      width: u(RING), height: u(RING), borderRadius: u(7), flex: "none",
      background: on ? signal.fill : "transparent", boxShadow: on ? "none" : `inset 0 0 0 ${u(2)} ${CONTROL}`,
      transition: t("background-color", "morph"),
    }}>
      <Check size={14} color={ink} style={{ opacity: on ? 1 : 0, transition: t("opacity", "value") }} />
    </span>
  );
}

export function ChoiceGroupPreview() {
  const { step } = useLoop(CHOICE_STEPS);
  const was = usePrevious(step.speed);
  const center = (i: number) => ROW * i + ROW / 2;
  return (
    <Stage scale={1.25}>
      <div className="flex flex-col" style={{ width: u(320), gap: u(20), fontSize: u(17) }}>
        <div className="flex flex-col" style={{ gap: u(8) }}>
          <span style={{ fontSize: u(13), color: ground.muted, paddingLeft: u(16) }}>Delivery</span>
          <Card rows={3}>
            {/* The drop: its top and bottom flow on their own springs from ring to ring. */}
            <span className="absolute" style={{
              left: u(16 + (RING - DROP) / 2), width: u(DROP), borderRadius: 9999, background: signal.fill,
              top: u(center(step.speed) - DROP / 2), bottom: u(3 * ROW - center(step.speed) - DROP / 2),
              transition: edges("top", "bottom", step.speed > was),
            }} />
            {SPEEDS.map(([title, price], i) => (
              <Row key={title} last={i === 2}>
                <span style={{ width: u(RING), height: u(RING), borderRadius: 9999, flex: "none", boxShadow: `inset 0 0 0 ${u(2)} ${i === step.speed ? signal.fill : CONTROL}`, transition: "box-shadow 200ms ease-out" }} />
                <span className="flex-1">{title}</span>
                <span style={{ color: ground.muted }}>{price}</span>
              </Row>
            ))}
          </Card>
        </div>
        <Card rows={2}>
          {["Gift wrap", "Leave at door"].map((title, i) => (
            <Row key={title} last={i === 1}>
              <Box on={step.extras[i]} />
              <span>{title}</span>
            </Row>
          ))}
        </Card>
      </div>
    </Stage>
  );
}

// MARK: - Swatch Picker

const SWATCH = 34, SWATCH_GAP = 14, RING_GAP = 3, RING_W = 2.5;
const SWATCHES = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand];
const SWATCH_STEPS = [1, 4, 2, 0, 5].map((pick) => ({ ms: 900, pick }));

export function SwatchPickerPreview() {
  const { step } = useLoop(SWATCH_STEPS);
  const was = usePrevious(step.pick);
  const pitch = SWATCH + SWATCH_GAP, out = RING_GAP + RING_W;
  const total = SWATCHES.length * pitch - SWATCH_GAP;
  return (
    <Stage scale={1.6}>
      <div className="relative flex" style={{ gap: u(SWATCH_GAP), padding: `0 ${u(out)}` }}>
        {SWATCHES.map((color, i) => (
          <span key={color} className="grid place-items-center" style={{ width: u(SWATCH), height: u(SWATCH), borderRadius: 9999, background: color }}>
            <Check size={14} color={ink} style={{ opacity: i === step.pick ? 1 : 0, transform: `scale(${i === step.pick ? 1 : 0.3})`, transition: t(["opacity", "transform"], "success") }} />
          </span>
        ))}
        <span className="pointer-events-none absolute" style={{
          top: u(-out), bottom: u(-out), borderRadius: 9999, boxShadow: `inset 0 0 0 ${u(RING_W)} ${ground.text}`,
          left: u(step.pick * pitch), right: u(total - step.pick * pitch - SWATCH),
          transition: edges("left", "right", step.pick > was),
        }} />
      </div>
    </Stage>
  );
}

// MARK: - Time Slot Picker

const SLOT_W = 96, SLOT_H = 44, SLOT_GAP = 8, COLS = 3;
const TIMES = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM", "2:00 PM"];
const TAKEN = new Set([2, 6]);
const SLOT_STEPS = [
  { ms: 900, pick: -1, refuse: 0 },
  { ms: 900, pick: 0, refuse: 0 },
  { ms: 900, pick: 1, refuse: 0 },
  { ms: 900, pick: 4, refuse: 0 },
  { ms: 800, pick: 4, refuse: 6 },
  { ms: 900, pick: 8, refuse: 0 },
  { ms: 1100, pick: 3, refuse: 0 },
] as const;

function Slot({ index, chosen, shakeKey }: { index: number; chosen: boolean; shakeKey: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useShake(ref, shakeKey);
  const taken = TAKEN.has(index);
  return (
    <span ref={ref} className="grid place-items-center" style={{
      width: u(SLOT_W), height: u(SLOT_H), borderRadius: 9999, fontVariantNumeric: "tabular-nums",
      color: chosen ? ink : taken ? ground.subtle : ground.text, textDecoration: taken ? "line-through" : undefined,
      boxShadow: taken ? `inset 0 0 0 1px color-mix(in srgb, ${ground.subtle} 35%, transparent)` : undefined,
      transition: "color 200ms ease-out",
    }}>{TIMES[index]}</span>
  );
}

export function TimeSlotPickerPreview() {
  const { step, index } = useLoop(SLOT_STEPS);
  const prev = SLOT_STEPS[(index + SLOT_STEPS.length - 1) % SLOT_STEPS.length];
  const at = (i: number) => ({ x: (i % COLS) * (SLOT_W + SLOT_GAP), y: Math.floor(i / COLS) * (SLOT_H + SLOT_GAP) });
  const width = COLS * SLOT_W + (COLS - 1) * SLOT_GAP, height = 3 * SLOT_H + 2 * SLOT_GAP;
  const shown = step.pick >= 0;
  const p = at(Math.max(step.pick, 0)), q = at(Math.max(prev.pick, 0));
  const first = prev.pick < 0;
  return (
    <Stage scale={1.3}>
      <div className="relative" style={{ width: u(width), height: u(height), fontSize: u(16) }}>
        <LiquidGroup unit={u(1)} merge={1} style={FILL}>
          {TIMES.map((_, i) => TAKEN.has(i) ? null : (
            <Liquid key={i} style={{ position: "absolute", left: u(at(i).x), top: u(at(i).y), width: u(SLOT_W), height: u(SLOT_H) }} />
          ))}
        </LiquidGroup>
        <span className="absolute" style={{
          borderRadius: 9999, background: signal.fill,
          left: u(p.x), right: u(width - p.x - SLOT_W), top: u(p.y), bottom: u(height - p.y - SLOT_H),
          opacity: shown ? 1 : 0, transform: `scale(${shown ? 1 : 0.6})`,
          transition: first || !shown
            ? t(["opacity", "transform"], shown ? "success" : "dismiss")
            : [edges("left", "right", p.x > q.x), edges("top", "bottom", p.y > q.y)].join(", "),
        }} />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${u(SLOT_W)})`, gap: u(SLOT_GAP) }}>
          {TIMES.map((_, i) => <Slot key={i} index={i} chosen={i === step.pick} shakeKey={step.refuse === i ? index : 0} />)}
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Level Picker

const TRACK_W = 300, TRACK_H = 44, KNOB_W = 64, TRACK_IN = 4;
const LEVELS = ["Off", "Low", "Medium", "High"];
const LEVEL_STEPS = [1, 3, 2, 0].map((level) => ({ ms: 1000, level }));

export function LevelPickerPreview() {
  const { step } = useLoop(LEVEL_STEPS);
  const was = usePrevious(step.level);
  const pitch = (TRACK_W - TRACK_IN * 2 - KNOB_W) / (LEVELS.length - 1);
  const x = (i: number) => TRACK_IN + i * pitch;
  return (
    <Stage scale={1.3}>
      <div className="flex flex-col" style={{ width: u(TRACK_W), gap: u(10) }}>
        <div className="relative" style={{ height: u(TRACK_H) }}>
          <LiquidGroup unit={u(1)} style={FILL}>
            <Liquid style={{ position: "absolute", inset: 0 }} />
          </LiquidGroup>
          {LEVELS.map((_, i) => (
            <span key={i} className="absolute" style={{ left: u(x(i) + KNOB_W / 2 - 2.5), top: u(TRACK_H / 2 - 2.5), width: u(5), height: u(5), borderRadius: 9999, background: CONTROL }} />
          ))}
          <span className="absolute" style={{
            top: u(TRACK_IN), bottom: u(TRACK_IN), borderRadius: 9999, background: signal.fill,
            left: u(x(step.level)), right: u(TRACK_W - x(step.level) - KNOB_W),
            transition: edges("left", "right", step.level > was),
          }} />
        </div>
        <div className="relative" style={{ height: u(18), fontSize: u(13) }}>
          {LEVELS.map((name, i) => (
            <span key={name} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: u(x(i) + KNOB_W / 2), color: i === step.level ? ground.text : ground.subtle, transition: "color 200ms ease-out" }}>{name}</span>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Date Strip

const DAY_GAP = 4, DAY_H = 64, STRIP_W = 330;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Two weeks from Sunday 25 October 2026; today is Tuesday the 27th, so the 25th and 26th are out of range. */
const WEEKS = [[25, 26, 27, 28, 29, 30, 31], [1, 2, 3, 4, 5, 6, 7]];
const MONTHS = ["October 2026", "November 2026"];
/** `day` is a position across both weeks (0 to 13); `week` is the page on screen. */
const DATE_STEPS = [
  { ms: 1100, day: 2, week: 0 },
  { ms: 1000, day: 4, week: 0 },
  { ms: 1000, day: 3, week: 0 },
  { ms: 900, day: 3, week: 1 },
  { ms: 1100, day: 9, week: 1 },
  { ms: 1000, day: 11, week: 1 },
  { ms: 900, day: 11, week: 0 },
  { ms: 1100, day: 5, week: 0 },
] as const;

/** The pill in its own week. A pill that mounts (a day picked in a new week) buds in place; never streaks across. */
function DayPill({ column, forward, pitch }: { column: number; forward: boolean; pitch: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const { easing, ms } = curve("success");
    ref.current?.animate(reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: reduced ? 240 : ms, easing: reduced ? "ease-out" : easing });
  }, [reduced]);
  return (
    <span ref={ref} className="absolute inset-y-0" style={{
      borderRadius: u(20), background: signal.fill,
      left: u(column * pitch), right: u(STRIP_W - column * pitch - (pitch - DAY_GAP)),
      transition: edges("left", "right", forward),
    }} />
  );
}

export function DateStripPreview() {
  const { step } = useLoop(DATE_STEPS);
  const was = usePrevious(step.day);
  const pitch = (STRIP_W - DAY_GAP * 6) / 7 + DAY_GAP;
  const selWeek = Math.floor(step.day / 7);
  const label = `${WEEKDAYS[step.day % 7]} ${WEEKS[selWeek][step.day % 7]}`;
  const month = MONTHS[selWeek === step.week ? selWeek : step.week];
  return (
    <Stage scale={1.25}>
      <div className="flex flex-col" style={{ width: u(STRIP_W), gap: u(12) }}>
        <div className="flex items-baseline justify-between" style={{ fontSize: u(20) }}>
          <span>{month}</span>
          <span style={{ color: ground.muted }}>{label}</span>
        </div>
        <div className="overflow-hidden">
          <div className="flex" style={{ gap: u(DAY_GAP), transform: `translateX(${u(-step.week * (STRIP_W + DAY_GAP))})`, transition: t("transform", { duration: 0.32, bounce: 0 }) }}>
            {WEEKS.map((days, w) => (
              <div key={w} className="relative flex" style={{ flex: "none", width: u(STRIP_W), gap: u(DAY_GAP) }}>
                {selWeek === w ? <DayPill column={step.day % 7} forward={step.day > was} pitch={pitch} /> : null}
                {days.map((date, i) => {
                  const chosen = selWeek === w && step.day % 7 === i;
                  const past = w === 0 && i < 2;
                  return (
                    <span key={i} className="relative flex flex-col items-center justify-center" style={{ flex: 1, height: u(DAY_H), gap: u(4), color: chosen ? ink : past ? ground.subtle : ground.text, transition: "color 200ms ease-out" }}>
                      <span style={{ fontSize: u(13), color: chosen ? ink : past ? ground.subtle : ground.muted }}>{WEEKDAYS[i]}</span>
                      <span style={{ fontSize: u(20), fontVariantNumeric: "tabular-nums" }}>{date}</span>
                      <span style={{ width: u(5), height: u(5), borderRadius: 9999, background: chosen ? ink : signal.fill, opacity: w === 0 && i === 2 ? 1 : 0 }} />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Interest Chips

const CHIP_H = 40, LIMIT = 3;
const TOPICS = ["Design", "Running", "Cooking", "Travel", "Film", "Music", "Coffee", "Books"];
const CHIP_STEPS = [
  { ms: 1000, on: ["Design"], refuse: "" },
  { ms: 900, on: ["Design", "Travel"], refuse: "" },
  { ms: 1000, on: ["Design", "Travel", "Music"], refuse: "" },
  { ms: 900, on: ["Design", "Travel", "Music"], refuse: "Film" },
  { ms: 1000, on: ["Travel", "Music"], refuse: "" },
  { ms: 1100, on: ["Travel", "Music", "Coffee"], refuse: "" },
] as const;

function Chip({ text, on, dimmed, shakeKey }: { text: string; on: boolean; dimmed: boolean; shakeKey: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useShake(ref, shakeKey);
  return (
    <span ref={ref} className="relative flex items-center" style={{
      height: u(CHIP_H), paddingLeft: u(on ? 12 : 16), paddingRight: u(16), whiteSpace: "nowrap",
      color: on ? ink : dimmed ? ground.subtle : ground.text,
      transition: [t("padding-left", "morph"), "color 200ms ease-out"].join(", "),
    }}>
      <LiquidGroup unit={u(1)} style={FILL}>
        <Liquid style={{ position: "absolute", inset: 0 }} />
      </LiquidGroup>
      {/* The flood: a dot of red at the leading end that widens to the whole chip. */}
      <span className="absolute inset-y-0 left-0" style={{ borderRadius: 9999, background: signal.fill, width: on ? "100%" : u(CHIP_H), opacity: on ? 1 : 0, transition: t(["width", "opacity"], "morph") }} />
      <Check size={14} color={ink} style={{ position: "relative", width: on ? u(14) : 0, marginRight: on ? u(6) : 0, opacity: on ? 1 : 0, transition: t(["width", "margin-right", "opacity"], "morph") }} />
      <span className="relative">{text}</span>
    </span>
  );
}

export function InterestChipsPreview() {
  const { step, index } = useLoop(CHIP_STEPS);
  const on = new Set<string>(step.on);
  const full = on.size >= LIMIT;
  return (
    <Stage scale={1.2}>
      <div className="flex flex-col" style={{ width: u(340), gap: u(14), fontSize: u(16) }}>
        <div className="flex justify-between" style={{ fontSize: u(17) }}>
          <span>Pick up to {LIMIT}</span>
          <span style={{ color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{on.size} of {LIMIT}</span>
        </div>
        <div className="flex flex-wrap" style={{ gap: u(8) }}>
          {TOPICS.map((topic) => (
            <Chip key={topic} text={topic} on={on.has(topic)} dimmed={full && !on.has(topic)} shakeKey={step.refuse === topic ? index : 0} />
          ))}
        </div>
      </div>
    </Stage>
  );
}
