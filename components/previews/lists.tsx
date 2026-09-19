"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

// Lists previews. Each one shows the component and nothing else (FREE-V2.1): no invented headers,
// counters or screen chrome, only the content the piece itself renders.
// Sizes are iOS points mapped to container width, so the stage scales from the grid card to the docs header.

const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

/** iOS points to container units. `s` is cqw per point for the vignette. */
const pt = (n: number, s: number) => `${+(n * s).toFixed(3)}cqw`;

/** Runs each `[delayMs, fn]` step once per `loopMs` cycle; every timer is cleared on unmount. */
function useTimeline(loopMs: number, steps: [number, () => void][]) {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, loopMs);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Glyph({ d, size, stroke = 2.2, style }: { d: string; size: string; stroke?: number; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3";
const MOON = "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z";
const ENVELOPE = "M3 9l9-6 9 6v10H3V9zM3 9l9 6 9-6";
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const CHEVRON = "M6 9l6 6 6-6";

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>
      <style>{"@keyframes lp-rise{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}"}</style>
      {children}
    </div>
  );
}

// MARK: Swipe Action Row

const MESSAGES = [
  { initials: "MA", name: "Mara Lindqvist", subject: "Final cut of the launch film", time: "9:41", block: blocks.sand },
  { initials: "JO", name: "Jonas Okafor", subject: "Studio booking for Thursday", time: "8:12", block: blocks.sage },
  { initials: "PR", name: "Priya Raman", subject: "Notes from the pricing review", time: "Mon", block: blocks.lilac },
];

/** Solid swipe block: the glyph grows in with the reveal and the label fades in over the last half. */
function SwipeTile({ d, label, fill, grow, open, expanded, s }: { d: string; label: string; fill: string; grow: number; open: boolean; expanded?: boolean; s: number }) {
  return (
    <div data-motion className="flex min-w-0 basis-0 flex-col items-center justify-center overflow-hidden" style={{ flexGrow: grow, opacity: grow ? 1 : 0, background: fill, color: ink, borderRadius: pt(26, s), gap: pt(6, s), transition: `flex-grow 260ms ${ease}, opacity 200ms` }}>
      <Glyph d={d} size={pt(20, s)} stroke={2.4} style={{ transform: `scale(${expanded ? 1.15 : open ? 1 : 0.55})`, transition: `transform 450ms ${spring}` }} />
      <span style={{ fontSize: pt(12, s), fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap", opacity: open ? 1 : 0, transition: "opacity 250ms ease 180ms" }}>{label}</span>
    </div>
  );
}

export function SwipeActionRowPreview() {
  const s = 0.19;
  const TILE = 84; // tile width + gap, in points
  const [open, setOpen] = useState<{ row: number; offset: number }>({ row: -1, offset: 0 });
  const [armed, setArmed] = useState(false);
  // Trailing reveal on Jonas, close; leading reveal on Priya, close; then a full swipe on Mara arms Delete and fires on release.
  useTimeline(9000, [
    [700, () => setOpen({ row: 1, offset: -2 * TILE })], [2300, () => setOpen({ row: 1, offset: 0 })],
    [3000, () => setOpen({ row: 2, offset: TILE })], [4400, () => setOpen({ row: 2, offset: 0 })],
    [5300, () => setOpen({ row: 0, offset: -2 * TILE })], [5900, () => { setOpen({ row: 0, offset: -290 }); setArmed(true); }],
    [6800, () => { setArmed(false); setOpen({ row: 0, offset: 0 }); }],
  ]);
  const slide = `transform 480ms ${spring}, box-shadow 300ms, width 480ms ${spring}`;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pt(430, s) }}>
        <div className="flex flex-col" style={{ gap: pt(8, s) }}>
          {MESSAGES.map((m, i) => {
            const offset = open.row === i ? open.offset : 0;
            const isArmed = armed && open.row === i;
            return (
              <div key={m.name} className="relative overflow-x-clip" style={{ height: pt(74, s) }}>
                <div data-motion className="absolute inset-y-0 left-0 flex" style={{ width: pt(Math.max(offset, 0), s), paddingRight: offset > 0 ? pt(6, s) : 0, transition: slide }}>
                  <SwipeTile d={ENVELOPE} label="Read" fill={blocks.sky} grow={1} open={offset > 0} s={s} />
                </div>
                <div data-motion className="absolute inset-y-0 right-0 flex" style={{ width: pt(Math.max(-offset, 0), s), paddingLeft: offset < 0 ? pt(6, s) : 0, gap: isArmed ? 0 : pt(6, s), transition: slide }}>
                  <SwipeTile d={MOON} label="Snooze" fill={blocks.butter} grow={isArmed ? 0 : 1} open={offset < 0} s={s} />
                  <SwipeTile d={TRASH} label="Delete" fill={signal.fill} grow={1} open={offset < 0} expanded={isArmed} s={s} />
                </div>
                <div data-motion className="relative flex h-full items-center" style={{ background: ground.surface, borderRadius: pt(26, s), paddingInline: pt(16, s), gap: pt(14, s), transform: `translateX(${pt(offset, s)})`, boxShadow: offset ? `0 ${pt(4, s)} ${pt(14, s)} rgba(0,0,0,.45)` : "0 0 0 rgba(0,0,0,0)", transition: slide }}>
                  <span className="grid shrink-0 place-items-center rounded-full" style={{ width: pt(46, s), height: pt(46, s), background: m.block, color: ink, fontFamily: font.rounded, fontWeight: 700, fontSize: pt(15, s) }}>{m.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block" style={{ fontSize: pt(17, s), fontWeight: 600, lineHeight: 1.25 }}>{m.name}</span>
                    <span className="block truncate" style={{ fontSize: pt(15, s), color: ground.muted, lineHeight: 1.3 }}>{m.subject}</span>
                  </span>
                  <span style={{ fontSize: pt(13, s), color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{m.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

// MARK: Depth Carousel

const TRIPS = [
  { city: "Lisbon", country: "PORTUGAL", dates: "Oct 12 – 16", nights: 4, block: blocks.tangerine },
  { city: "Kyoto", country: "JAPAN", dates: "Nov 3 – 10", nights: 7, block: blocks.sky },
  { city: "Oaxaca", country: "MEXICO", dates: "Dec 1 – 6", nights: 5, block: blocks.butter },
  { city: "Bergen", country: "NORWAY", dates: "Jan 18 – 21", nights: 3, block: blocks.lilac },
];

export function DepthCarouselPreview() {
  const s = 0.21;
  const W = 220, H = 250, GAP = 16;
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setDragging(true);
      setPage((p) => (p + 1) % TRIPS.length);
      setTimeout(() => setDragging(false), 520);
    }, 2000);
    return () => clearInterval(t);
  }, []);
  const move = `transform 650ms ${ease}, opacity 650ms ${ease}, box-shadow 650ms ${ease}`;
  const stride = 15, pill = 22, dot = 7;
  return (
    <Stage>
      <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <div className="relative" style={{ height: pt(H, s) }}>
          <div data-motion className="absolute top-0 left-1/2 flex h-full" style={{ gap: pt(GAP, s), transform: `translateX(calc(${pt(-W / 2, s)} - ${pt(page * (W + GAP), s)}))`, transition: `transform 650ms ${ease}` }}>
            {TRIPS.map((trip, k) => {
              // Signed distance from center in pages; neighbors recede, dim and their shadow leans back toward the centered page.
              const phase = Math.max(-1, Math.min(1, k - page)), depth = Math.abs(phase);
              return (
                <div key={trip.city} data-motion className="relative h-full shrink-0 overflow-hidden" style={{ width: pt(W, s), borderRadius: pt(30, s), background: trip.block, color: ink, zIndex: 2 - depth, transform: `scale(${1 - 0.1 * depth})`, opacity: 1 - 0.3 * depth, boxShadow: `${pt(-phase * 10, s)} ${pt(16 - 8 * depth, s)} ${pt(22, s)} rgba(0,0,0,${0.45 - 0.27 * depth})`, transition: move }}>
                  <span data-motion className="absolute rounded-full" style={{ width: pt(150, s), height: pt(150, s), left: pt(118 + phase * 40, s), top: pt(46, s), background: ink, transition: `left 650ms ${ease}` }} />
                  <div data-motion className="absolute inset-0 flex flex-col" style={{ padding: pt(18, s), transform: `translateX(${pt(phase * 10, s)})`, transition: move }}>
                    <div className="flex justify-between" style={{ fontSize: pt(11, s), fontWeight: 700, letterSpacing: "0.1em" }}><span>{trip.country}</span><span>{trip.nights} NIGHTS</span></div>
                    <span className="mt-auto" style={{ fontSize: pt(36, s), fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>{trip.city}</span>
                    <span style={{ fontSize: pt(14, s), fontWeight: 500, opacity: 0.7, marginTop: pt(4, s) }}>{trip.dates}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mx-auto flex items-center justify-between" style={{ width: pt(W, s), height: pt(44, s), marginTop: pt(6, s) }}>
          <span style={{ fontFamily: font.rounded, fontVariantNumeric: "tabular-nums" }}>
            <span key={page} data-motion style={{ fontSize: pt(22, s), fontWeight: 600, display: "inline-block", animation: `lp-rise 300ms ${ease}` }}>{String(page + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: pt(15, s), fontWeight: 500, color: "#4a4946", marginLeft: pt(3, s) }}>/ 04</span>
          </span>
          {/* Fixed dots under a pill that lives in absolute page coordinates; it widens while the carousel moves. */}
          <span className="relative flex items-center" style={{ gap: pt(stride - dot, s), paddingInline: pt((pill - dot) / 2, s) }}>
            {TRIPS.map((t) => <span key={t.city} className="rounded-full" style={{ width: pt(dot, s), height: pt(dot, s), background: "#4a4946" }} />)}
            <span data-motion className="absolute left-0 rounded-full" style={{ height: pt(dot, s), width: pt(pill + (dragging ? 6 : 0), s), background: ground.text, transform: `translateX(${pt(page * stride - (dragging ? 3 : 0), s)})`, transition: `transform 650ms ${ease}, width 200ms ${spring}` }} />
          </span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Task Row

type TaskState = "open" | "completed" | "snoozed";

/** One task card. Completing flashes the card into the sage block while the check draws and the strike grows, then it settles and compacts. */
function Task({ title, due, priority, state, flash, s }: { title: string; due?: string; priority?: ["HIGH" | "MED" | "LOW", string]; state: TaskState; flash: boolean; s: number }) {
  const done = state === "completed", compact = done && !flash;
  const fold = `grid-template-rows 450ms ${spring}, opacity 300ms`;
  return (
    <div data-motion className="relative flex items-center overflow-hidden" style={{ background: flash ? blocks.sage : ground.surface, borderRadius: pt(22, s), paddingLeft: pt(12, s), paddingRight: pt(16, s), paddingBlock: pt(compact ? 8 : 14, s), gap: pt(14, s), transition: `background 250ms ease, padding 450ms ${spring}` }}>
      <span className="grid shrink-0 place-items-center" style={{ width: pt(44, s), height: pt(44, s) }}>
        <span data-motion className="relative grid place-items-center rounded-full" style={{ width: pt(compact ? 24 : 28, s), height: pt(compact ? 24 : 28, s), boxShadow: state === "open" ? `inset 0 0 0 ${pt(2, s)} rgba(166,164,159,.55)` : "none", transition: `width 400ms ${spring}, height 400ms ${spring}` }}>
          <span data-motion className="absolute inset-0 rounded-full" style={{ background: state === "snoozed" ? blocks.lilac : flash ? ink : blocks.sage, transform: `scale(${state === "open" ? 0 : 1})`, transition: `transform 400ms ${spring}, background 250ms` }} />
          {state === "snoozed" ? (
            <span className="relative" style={{ color: ink }}><Glyph d={MOON} size={pt(13, s)} stroke={2.6} /></span>
          ) : (
            <svg viewBox="0 0 24 24" className="relative" style={{ width: "80%", height: "80%" }} fill="none" stroke={flash ? blocks.sage : ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.5 12.5l3.8 3.8L17.5 8.5" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: done ? 0 : 1, transition: `stroke-dashoffset ${done ? 300 : 200}ms ease-out` }} /></svg>
          )}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="relative w-fit" style={{ fontSize: pt(compact ? 15 : 17, s), fontWeight: compact ? 500 : 600, lineHeight: 1.25, color: flash ? ink : state === "open" ? ground.text : ground.muted, transition: `font-size 450ms ${spring}, color 200ms` }}>
          {title}
          <span data-motion className="absolute left-0 top-1/2 w-full origin-left rounded-full" style={{ height: pt(2, s), background: flash ? ink : ground.muted, transform: `scaleX(${done ? 1 : 0})`, transition: `transform 350ms ease-in-out ${done ? 150 : 0}ms` }} />
        </p>
        {(due || state === "snoozed") && (
          <div data-motion className="grid" style={{ gridTemplateRows: compact ? "0fr" : "1fr", opacity: compact ? 0 : 1, transition: fold }}>
            <div className="min-h-0 overflow-hidden">
              {state === "snoozed" ? (
                <span className="inline-flex items-center rounded-full" style={{ marginTop: pt(5, s), gap: pt(4, s), paddingInline: pt(8, s), paddingBlock: pt(3, s), background: blocks.lilac, color: ink, fontSize: pt(12, s), fontWeight: 700 }}><Glyph d={MOON} size={pt(11, s)} stroke={2.6} />Snoozed</span>
              ) : (
                <span className="flex items-center" style={{ marginTop: pt(5, s), gap: pt(4, s), fontSize: pt(13, s), fontWeight: 500, color: flash ? "rgba(20,20,20,.7)" : ground.muted }}><Glyph d={CLOCK} size={pt(11, s)} />{due}</span>
              )}
            </div>
          </div>
        )}
      </div>
      {priority && (
        <span data-motion className="shrink-0 rounded-full" style={{ background: priority[1], color: ink, fontSize: pt(11, s), fontWeight: 800, letterSpacing: "0.07em", paddingInline: pt(8, s), paddingBlock: pt(4, s), opacity: state === "open" ? 1 : 0, transform: `scale(${state === "open" ? 1 : 0.6})`, transition: `transform 400ms ${spring}, opacity 250ms` }}>{priority[0]}</span>
      )}
    </div>
  );
}

export function TaskRowPreview() {
  const s = 0.165;
  const [first, setFirst] = useState<TaskState>("open");
  const [second, setSecond] = useState<TaskState>("open");
  const [flash, setFlash] = useState<number | null>(null);
  // Complete the first task, then the second (each flashes sage, strikes, then compacts); reopen both.
  useTimeline(8200, [
    [1200, () => { setFirst("completed"); setFlash(0); }], [2000, () => setFlash(null)],
    [3400, () => { setSecond("completed"); setFlash(1); }], [4200, () => setFlash(null)],
    [6400, () => { setFirst("open"); setSecond("open"); }],
  ]);
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pt(470, s) }}>
        <div className="flex flex-col" style={{ gap: pt(8, s) }}>
          <Task title="Review the launch checklist" due="Today, 5 PM" priority={["HIGH", blocks.tangerine]} state={first} flash={flash === 0} s={s} />
          <Task title="Send Mara the final mockups" due="Today, 6 PM" priority={["MED", blocks.butter]} state={second} flash={flash === 1} s={s} />
          <Task title="Book the studio for Thursday" due="Tomorrow" state="snoozed" flash={false} s={s} />
          <Task title="Renew the domain" priority={["LOW", blocks.sky]} state="completed" flash={false} s={s} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Status Timeline

const STEPS: [string, string, string][] = [
  ["Order placed", "Confirmation sent to sam.rivera@example.com.", "9:41 AM"],
  ["Packed", "Three items packed at the Riverside warehouse.", "11:20 AM"],
  ["Out for delivery", "Noor has your parcel. You are stop 6 of 14.", "1:05 PM"],
  ["Delivered", "Left with the front desk. Signed by D. Alvarez.", "4:12 PM"],
];

export function StatusTimelinePreview() {
  const s = 0.19;
  const [stage, setStage] = useState(2);
  const [breath, setBreath] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((v) => (v >= 4 ? 1 : v + 1)), 2200);
    const b = setInterval(() => setBreath((v) => 1 - v), 1600);
    return () => { clearInterval(t); clearInterval(b); };
  }, []);
  const delivered = stage > 3;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2" style={{ width: pt(390, s) }}>
        <div className="min-w-0 flex-1">
          {STEPS.map(([title, detail, time], k) => {
            const status = k < stage ? "complete" : k === stage ? "current" : "pending";
            const complete = status === "complete", current = status === "current", last = k === STEPS.length - 1;
            return (
              <div key={title} className="flex" style={{ gap: pt(6, s) }}>
                <div className="flex shrink-0 flex-col items-center" style={{ width: pt(44, s) }}>
                  <span data-motion className="relative grid shrink-0 place-items-center rounded-full" style={{ marginTop: pt(9, s), width: pt(30, s), height: pt(30, s), background: complete ? blocks.sage : current ? blocks.tangerine : "transparent", boxShadow: status === "pending" ? `inset 0 0 0 ${pt(2, s)} rgba(166,164,159,.45)` : "none", color: status === "pending" ? ground.muted : ink, fontFamily: font.rounded, fontSize: pt(14, s), fontWeight: 700, transition: "background 400ms" }}>
                    {/* A slow breathing ring marks the live step. */}
                    {current && <span data-motion className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 ${pt(2, s)} ${blocks.tangerine}`, transform: `scale(${1 + 0.5 * breath})`, opacity: 0.9 - 0.9 * breath, transition: "transform 1.6s ease-in-out, opacity 1.6s ease-in-out" }} />}
                    <span data-motion className="absolute" style={{ transform: `scale(${complete ? 0.4 : 1})`, opacity: complete ? 0 : 1, transition: `transform 400ms ${spring}, opacity 250ms` }}>{k + 1}</span>
                    <Glyph d={CHECK} size={pt(17, s)} stroke={3} style={{ position: "absolute", transform: `scale(${complete ? 1 : 0.4})`, opacity: complete ? 1 : 0, transition: `transform 400ms ${spring}, opacity 250ms` }} />
                  </span>
                  {/* The connector fills downward in the text color once its step is complete. */}
                  {!last && <span className="relative flex-1 rounded-full" style={{ width: pt(3, s), marginTop: pt(3, s), marginBottom: pt(-9, s), background: "rgba(166,164,159,.25)" }}><span data-motion className="absolute inset-0 origin-top rounded-full" style={{ background: ground.text, transform: `scaleY(${complete ? 1 : 0})`, transition: "transform 450ms ease-in-out" }} /></span>}
                </div>
                <div data-motion className="min-w-0 flex-1" style={{ marginBottom: last ? 0 : pt(4, s), paddingInline: pt(14, s), paddingBlock: pt(11, s), borderRadius: pt(18, s), background: current ? blocks.tangerine : "transparent", color: current ? ink : status === "pending" ? ground.muted : ground.text, transition: "background 400ms, color 300ms" }}>
                  <div className="flex items-baseline" style={{ gap: pt(8, s) }}>
                    <span className="flex-1" style={{ fontSize: pt(16, s), fontWeight: current ? 600 : complete ? 500 : 400 }}>{title}</span>
                    {(k < 3 || delivered) && <span style={{ fontSize: pt(12, s), fontWeight: 500, fontVariantNumeric: "tabular-nums", color: current ? "rgba(20,20,20,.7)" : ground.muted }}>{time}</span>}
                    <Glyph d={CHEVRON} size={pt(11, s)} stroke={2.8} style={{ alignSelf: "center", color: current ? ink : ground.muted, transform: `rotate(${current ? 180 : 0}deg)`, transition: `transform 400ms ${spring}` }} />
                  </div>
                  <div data-motion className="grid" style={{ gridTemplateRows: current ? "1fr" : "0fr", opacity: current ? 1 : 0, transition: `grid-template-rows 450ms ${spring}, opacity 300ms` }}>
                    <p className="min-h-0 overflow-hidden" style={{ fontSize: pt(13, s), lineHeight: 1.35, color: "rgba(20,20,20,.78)" }}><span className="block" style={{ paddingTop: pt(6, s) }}>{detail}</span></p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

// MARK: Pull to Refresh

const ENTRIES = ["Mara Lindqvist", "Jonas Okafor", "Priya Raman", "Tomas Weil", "Ines Marchetti", "Devon Oyelaran", "Hana Kobayashi", "Ruben Castellanos"];
const PTR_THRESHOLD = 92, PTR_HOLD = 64;
/** The dial is a bezel of ticks, not a ring: pulling winds them up one at a time and the refresh
 *  sweeps a bright head round with a decaying tail. Mirrors `PullToRefreshIndicator` in Swift. */
const PTR_TICKS = Array.from({ length: 24 }, (_, i) => i);
const PTR_TAIL = 7, PTR_FLOOR = 0.16;
function ptrLevel(index: number, progress: number, refreshing: boolean) {
  if (refreshing) {
    const falloff = Math.max(0, 1 - index / PTR_TAIL);
    return { brightness: PTR_FLOOR + (1 - PTR_FLOOR) * falloff ** 1.6, head: index === 0 };
  }
  const reached = progress * PTR_TICKS.length - index;
  if (reached <= 0) return { brightness: PTR_FLOOR, head: false };
  return { brightness: PTR_FLOOR + (1 - PTR_FLOOR) * Math.min(1, reached), head: reached <= 1 };
}

export function PullToRefreshPreview() {
  const s = 0.19;
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<"idle" | "pulling" | "refreshing">("idle");
  const [fresh, setFresh] = useState(false);
  // Rest, a pull that deepens and arms past the threshold, release to the held spinner, then it settles back.
  useTimeline(7600, [
    [0, () => { setPhase("idle"); setPull(0); setFresh(false); }],
    [800, () => { setPhase("pulling"); setPull(36); }],
    [1250, () => setPull(68)],
    [1700, () => setPull(114)],
    [2500, () => { setPhase("refreshing"); setPull(PTR_HOLD); }],
    [4700, () => { setPhase("idle"); setPull(0); setFresh(true); }],
  ]);
  const refreshing = phase === "refreshing";
  const progress = Math.min(1, pull / PTR_THRESHOLD);
  const armed = phase === "pulling" && pull >= PTR_THRESHOLD;
  // The band the ring is centered in stops growing past 1.3x the threshold; the content keeps going.
  const band = refreshing ? PTR_HOLD : Math.min(pull, PTR_THRESHOLD * 1.3);
  const rows = fresh ? ["Aleks Novak", ...ENTRIES] : ENTRIES;
  return (
    <Stage>
      <style>{"@keyframes ptr-spin{to{transform:rotate(360deg)}}"}</style>
      <div data-motion className="absolute inset-x-0 top-0" style={{ transform: `translateY(${pt(pull, s)})`, transition: `transform 520ms ${ease}` }}>
        {rows.map((name, i) => (
          <div key={name} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopStyle: "solid", borderTopColor: ground.line }}>
            <span className="block" style={{ fontSize: pt(17, s), lineHeight: 1.25, paddingInline: pt(24, s), paddingBlock: pt(15, s) }}>{name}</span>
          </div>
        ))}
      </div>
      {/* The ring rides the top band: it draws with the pull, pops when armed, then spins while the work runs. */}
      <div data-motion className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: pt(band, s), opacity: refreshing ? 1 : Math.min(1, pull / (PTR_THRESHOLD * 0.35)), transition: `height 520ms ${ease}, opacity 260ms` }}>
        <span data-motion className="grid place-items-center" style={{ transform: `scale(${armed ? 1.1 : 1})`, transition: `transform 300ms ${spring}`, animation: refreshing ? "ptr-spin 1100ms linear infinite" : "none" }}>
          <svg viewBox="0 0 30 30" style={{ width: pt(30, s), height: pt(30, s) }} aria-hidden>
            {PTR_TICKS.map((i) => {
              const { brightness, head } = ptrLevel(i, progress, refreshing);
              const angle = (i / PTR_TICKS.length) * 2 * Math.PI - Math.PI / 2;
              const outer = 14, len = outer * (0.26 + 0.2 * brightness), inner = outer - len;
              const c = 15;
              return (
                <line
                  key={i}
                  x1={c + Math.cos(angle) * inner} y1={c + Math.sin(angle) * inner}
                  x2={c + Math.cos(angle) * outer} y2={c + Math.sin(angle) * outer}
                  stroke={head || (armed && brightness > 0.16) ? signal.fill : ground.text}
                  strokeOpacity={head || (armed && brightness > 0.16) ? 1 : brightness}
                  strokeWidth={2} strokeLinecap="round"
                />
              );
            })}
          </svg>
        </span>
      </div>
    </Stage>
  );
}
