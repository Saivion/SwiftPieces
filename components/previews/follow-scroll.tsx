"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Follow Scroll: a thread pinned to its newest message. A reply arrives and scrolls in; the reader scrolls up;
 * three more arrive below without moving anything and count into the "3 new" pill; the pill is tapped and the
 * thread jumps back to the latest. Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/** Row pitch: a one-line bubble (38) plus the gap between rows (8). */
const ROW = 46;

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

const MESSAGES: Array<[string, boolean]> = [
  ["Boarding in ten, gate 32", false],
  ["Grabbed you a flat white", true],
  ["Seats 14A and 14B", false],
  ["They moved us to gate 35", false],
  ["Running, save my spot", true],
  ["Made it. Window or aisle?", false],
  ["Window please", true],
  ["Landing at 6:40 local", false],
  ["Taxi or train?", true],
  ["Train, faster at rush hour", false],
  ["Dinner at Tasca do Rio?", true],
  ["Booked for four at 8", false],
  ["Just parked, coming up", false],
  ["Table by the window", false],
  ["Order the clams for me", false],
];
const BASE = 11;

/**
 * `count` messages exist; `scroll` is how far the content sits above the bottom, in rows. A step marked `instant`
 * changes without a transition, which is how a new row lands below the fold without moving what is on screen.
 */
type Step = { count: number; scroll: number; unread: number; ms: number; label?: number; instant?: boolean; pressed?: boolean; hidden?: boolean };
const steps: readonly Step[] = [
  { count: BASE, scroll: 0, unread: 0, ms: 1500, instant: true },
  // Following: the reply lands just below the edge, then the thread scrolls it in.
  { count: BASE + 1, scroll: 1, unread: 0, ms: 60, instant: true },
  { count: BASE + 1, scroll: 0, unread: 0, ms: 1300 },
  // The reader scrolls up to read.
  { count: BASE + 1, scroll: 2.6, unread: 0, ms: 1100 },
  // Replies arrive below while scrolled up: nothing moves, the pill counts them.
  { count: BASE + 2, scroll: 3.6, unread: 1, ms: 900, instant: true },
  { count: BASE + 3, scroll: 4.6, unread: 2, ms: 750, instant: true },
  { count: BASE + 4, scroll: 5.6, unread: 3, ms: 1500, instant: true },
  // Tap the pill: jump back to the latest.
  { count: BASE + 4, scroll: 5.6, unread: 3, ms: 200, instant: true, pressed: true },
  { count: BASE + 4, scroll: 0, unread: 0, label: 3, ms: 2000 },
  { count: BASE + 4, scroll: 0, unread: 0, ms: 320, hidden: true },
  { count: BASE, scroll: 0, unread: 0, ms: 320, instant: true, hidden: true },
];

function Arrow({ size, color }: { size: number; color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function Bubble({ text, mine }: { text: string; mine: boolean }) {
  const style: CSSProperties = {
    alignSelf: mine ? "flex-end" : "flex-start",
    height: u(ROW - 8),
    display: "flex",
    alignItems: "center",
    paddingInline: u(14),
    borderRadius: u(18),
    background: mine ? signal.fill : ground.field,
    color: mine ? signal.on : ground.text,
    fontSize: u(15),
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  return <div style={style}>{text}</div>;
}

export function FollowScrollPreview() {
  const s = useSteps(steps);
  const shows = s.unread > 0;
  return (
    <div className="absolute inset-0 flex justify-center overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes fs-tick{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div className="relative h-full" style={{ width: u(400) }}>
        {/* The scroll content: bottom-aligned rows, offset upward by `scroll` rows. */}
        <div
          data-motion
          className="absolute inset-x-0 flex flex-col"
          style={{
            bottom: u(20),
            gap: u(8),
            transform: `translateY(${u(s.scroll * ROW)})`,
            transition: s.instant ? "none" : `transform .55s ${ease}`,
            opacity: s.hidden ? 0 : 1,
          }}
        >
          {MESSAGES.slice(0, s.count).map(([text, mine]) => <Bubble key={text} text={text} mine={mine} />)}
        </div>
        {/* The pill: the one floating element. */}
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: u(22), pointerEvents: "none" }}>
          <div
            data-motion
            className="flex items-center"
            style={{
              height: u(44),
              gap: u(10),
              paddingLeft: u(8),
              paddingRight: u(16),
              borderRadius: u(22),
              background: `color-mix(in srgb, ${ground.raised} 72%, transparent)`,
              backdropFilter: "blur(14px) saturate(1.6)",
              WebkitBackdropFilter: "blur(14px) saturate(1.6)",
              boxShadow: `0 ${u(8)} ${u(24)} rgba(0,0,0,.22), inset 0 0 0 ${u(0.75)} color-mix(in srgb, ${ground.text} 14%, transparent)`,
              opacity: shows ? 1 : 0,
              transform: shows ? `scale(${s.pressed ? 0.94 : 1})` : `translateY(${u(12)}) scale(.6)`,
              transformOrigin: "bottom center",
              transition: `opacity .25s, transform .42s ${spring}`,
            }}
          >
            <span className="grid place-items-center rounded-full" style={{ width: u(28), height: u(28), background: signal.fill }}>
              <Arrow size={14} color={signal.on} />
            </span>
            <span key={s.unread || "out"} data-motion style={{ fontSize: u(15), fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", animation: s.unread ? `fs-tick .3s ${ease} both` : "none" }}>
              {s.unread || s.label || 1} new
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
