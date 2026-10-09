"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { font, ground, signal } from "./palette";
import { curve, ms, pressScale, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Follow Scroll: a thread pinned to its newest message. A reply arrives and scrolls in; the reader scrolls up;
 * three more arrive below without moving anything and count into the "3 new" pill, a liquid glass pill that buds up
 * out of the bottom edge and rolls each new count; the pill is tapped, the thread jumps back to the latest and the
 * pill melts back down into the edge.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one iOS point is one px here.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** The piece's own scrolls (follow and jump) are Swift's `.smooth(duration: 0.4)`: no give, since an overshoot past the bottom would be clamped. */
const SCROLL: Spring = { duration: 0.4, bounce: 0 };
/** The reader's flick is scroll-view deceleration, not a spring: it leaves at full speed and coasts to rest. */
const FLICK = "850ms cubic-bezier(0.22, 1, 0.36, 1)";
/** About 2.5 px per edge on the "3 new" pill (roughly 102 x 44), as the pill sinks where it is drawn without Liquid Glass. */
const PRESS = pressScale(102, 44);

/** Row pitch: a one-line bubble (38) plus the gap between rows (8). */
const ROW = 46;

/** The edge bud, as Swift's `FollowScrollEdgeBud`: the pill rests 16 above the edge, and a hidden glass lip lies 10 past it. */
const PILL_H = 44, PILL_W = 102, INSET = 16, LIP_GAP = 10, LIP_H = 44;
/** Room above the pill inside the clip, for its spring past rest. */
const ROOM = 24;
/** Home: shrunk and wholly past the edge, inside the lip. */
const HOME = INSET + (PILL_H * (1 + liquid.homeScale)) / 2;

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
 * `label` is the count the pill keeps while it melts away after a jump.
 */
type Step = { count: number; scroll: number; unread: number; ms: number; label?: number; instant?: boolean; flick?: boolean; pressed?: boolean; hidden?: boolean };
const steps: readonly Step[] = [
  { count: BASE, scroll: 0, unread: 0, ms: 1500, instant: true },
  // Following: the reply lands just below the edge, then the thread scrolls it in.
  { count: BASE + 1, scroll: 1, unread: 0, ms: 60, instant: true },
  { count: BASE + 1, scroll: 0, unread: 0, ms: 1300 },
  // The reader flicks up to read.
  { count: BASE + 1, scroll: 2.6, unread: 0, ms: 1100, flick: true },
  // Replies arrive below while scrolled up: nothing moves, the pill buds up out of the edge and counts them.
  { count: BASE + 2, scroll: 3.6, unread: 1, ms: 1100, instant: true },
  { count: BASE + 3, scroll: 4.6, unread: 2, ms: 750, instant: true },
  { count: BASE + 4, scroll: 5.6, unread: 3, ms: 1500, instant: true },
  // Tap the pill: jump back to the latest while it melts back down into the edge.
  { count: BASE + 4, scroll: 5.6, unread: 3, ms: 200, instant: true, pressed: true },
  { count: BASE + 4, scroll: 0, unread: 0, label: 3, ms: 2000 },
  { count: BASE + 4, scroll: 0, unread: 0, ms: 320, hidden: true },
  { count: BASE, scroll: 0, unread: 0, ms: 320, instant: true, hidden: true },
];

function Arrow({ size, color }: { size: number; color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
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
    fontWeight: 600,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  return <div style={style}>{text}</div>;
}

export function FollowScrollPreview() {
  const s = useSteps(steps);
  const out = s.unread > 0;
  // Melting away after a jump, the pill keeps the count it had.
  const news = s.unread || s.label || 1;
  // A count reads as a value: it rolls with no overshoot, so it never shows a number that isn't true.
  const roll = `${ms("value")}ms ${curve("value").easing} both`;
  const scroll = s.instant ? null : s.flick ? `transform ${FLICK}` : t("transform", SCROLL);
  return (
    <div className="absolute inset-0 flex justify-center overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <style>{`@keyframes fs-roll-in{from{transform:translateY(60%) scale(.7);opacity:0;filter:blur(${u(1.5)})}to{transform:none;opacity:1;filter:none}}@keyframes fs-roll-out{from{transform:none;opacity:1;filter:none}50%{opacity:0}to{transform:translateY(-60%) scale(.7);opacity:0;filter:blur(${u(1.5)})}}`}</style>
      <div className="relative h-full" style={{ width: u(400) }}>
        {/* The scroll content: bottom-aligned rows, offset upward by `scroll` rows. */}
        <div
          data-motion
          className="absolute inset-x-0 flex flex-col"
          style={{
            bottom: u(20),
            gap: u(8),
            transform: `translateY(${u(s.scroll * ROW)})`,
            // The loop's reset fades out quickly and back in calmly instead of cutting.
            transition: [scroll, t("opacity", s.hidden ? "dismiss" : "reveal")].filter(Boolean).join(", "),
            opacity: s.hidden ? 0 : 1,
          }}
        >
          {MESSAGES.slice(0, s.count).map(([text, mine]) => <Bubble key={text} text={text} mine={mine} />)}
        </div>
      </div>
      {/* The edge bud. The stage's bottom is the scroll view's edge: everything past it is clipped, so the pill rises
          out of it through a neck pulled from the hidden lip, and sinks back into it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: u(ROOM + PILL_H + INSET) }}>
        <LiquidGroup unit={u(1)} axis="y" className="absolute inset-x-0" style={{ top: u(ROOM), height: u(PILL_H) }}>
          <div className="relative flex justify-center" style={{ height: u(PILL_H) }}>
            {/* The lip, LIP_GAP past the edge: at home the pill is one shape with it. */}
            <Liquid className="absolute" style={{ top: u(PILL_H + INSET + LIP_GAP), left: "50%", marginLeft: u(-(PILL_W + liquid.merge * 2) / 2), width: u(PILL_W + liquid.merge * 2), height: u(LIP_H) }} />
            {/* The press sinks the pill a touch, as it does where it is drawn without Liquid Glass. */}
            <div data-motion className="flex" style={{ transform: `scale(${s.pressed ? PRESS : 1})`, transition: t("transform", s.pressed ? "press" : "release") }}>
              <Liquid bud={{ out, home: [0, HOME] }} className="flex items-center" style={{ height: u(PILL_H), gap: u(10), paddingLeft: u(8), paddingRight: u(16) }}>
                <BudContent out={out}>
                  <span className="grid place-items-center rounded-full" style={{ width: u(28), height: u(28), background: signal.fill }}>
                    <Arrow size={14} color={signal.on} />
                  </span>
                  {/* Only the digit rolls, the old one up and out as the new one rises in; the word and the pill's width stay put. */}
                  <span data-motion style={{ fontSize: u(15), fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginLeft: u(10) }}>
                    <span style={{ display: "inline-grid" }}>
                      {/* The outgoing digit stays mounted after it fades, so it is hidden from screen readers to keep the label "3 new". */}
                      {news > 1 && <span aria-hidden key={`out${news}`} style={{ gridArea: "1 / 1", animation: `fs-roll-out ${roll}` }}>{news - 1}</span>}
                      <span key={`in${news}`} style={{ gridArea: "1 / 1", animation: news > 1 ? `fs-roll-in ${roll}` : "none" }}>{news}</span>
                    </span>
                    {" new"}
                  </span>
                </BudContent>
              </Liquid>
            </div>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}
