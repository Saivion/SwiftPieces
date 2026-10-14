"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { font, ground, signal } from "./palette";
import { curve, follow, pressScale, rubberBand, shake, t } from "./piece-motion";
import { Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Step Trail: a checkout's progress, and a six-step verification compressed to numbers, the component only.
 * One liquid trail each: glass stops joined by short necks, done steps with a check, the current step a red capsule
 * with its number and title, steps already reached in full text and the rest muted.
 * Sizes are authored in points as the Swift piece draws them, converted to `cqw` against the 560 px stage, and the
 * stage is scaled as one picture.
 *
 * Motion follows the Swift piece. A move opens one capsule and closes the other on morph while the red puck's edge
 * facing the move leads on snap and the far edge follows a beat later on a looser spring, so the red stretches across
 * the neck and gathers. Titles blur in as a capsule opens and out as it closes; checks and numbers blur over. A tap
 * dips the stop it lands on; a tap past what has been reached shakes that stop and nothing moves. While a finger drags,
 * the puck stays with it: it hops to a stop a little past each midpoint and its facing edge reaches toward the finger
 * with rubber-band resistance, which is all it does at the last step it may reach; let go and the reach springs home.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

const CHECKOUT = ["Cart", "Address", "Payment", "Review"];
const VERIFY = ["Email", "Phone", "Address", "ID photo", "Selfie", "Review"];

/**
 * One beat of the loop. `at` is the checkout's current step and `reached` the furthest filled in; `verify` the
 * compressed trail's step. `press` holds a stop down for the tap that lands on the next beat; `shake` is a refused tap.
 * A `drag` beat moves a finger holding the capsule's number from one step position to another over the beat (1.5 is
 * halfway from the second stop to the third); `grab` lifts the capsule under it.
 */
type Beat = {
  label: string;
  at: number;
  reached: number;
  verify: number;
  ms: number;
  press?: number;
  shake?: number;
  grab?: boolean;
  drag?: { from: number; to: number };
};

const STORY: readonly Beat[] = [
  { label: "Rest on the first step", at: 0, reached: 0, verify: 3, ms: 1400 },
  { label: "Continue: the red flows to Address, Cart turns into a check", at: 1, reached: 1, verify: 3, ms: 1100 },
  { label: "Continue to Payment", at: 2, reached: 2, verify: 4, ms: 1200 },
  { label: "A finger dips the Cart check", at: 2, reached: 2, verify: 4, press: 0, ms: 160 },
  { label: "The red flows back to Cart; Address and Payment stay reached", at: 0, reached: 2, verify: 4, ms: 1000 },
  { label: "A tap on Review, not reached yet: it shakes and nothing moves", at: 0, reached: 2, verify: 4, shake: 3, ms: 900 },
  { label: "A finger takes the capsule", at: 0, reached: 2, verify: 4, press: 0, ms: 150 },
  { label: "It lifts", at: 0, reached: 2, verify: 4, grab: true, ms: 120 },
  { label: "The drag carries it to Payment, a stop at a time", at: 0, reached: 2, verify: 4, grab: true, drag: { from: 0, to: 2.05 }, ms: 1050 },
  { label: "Past Payment it only gives", at: 2, reached: 2, verify: 4, grab: true, drag: { from: 2.05, to: 2.6 }, ms: 320 },
  { label: "Let go: it lands on Payment", at: 2, reached: 2, verify: 4, ms: 700 },
  { label: "Continue to Review", at: 3, reached: 3, verify: 4, ms: 1300 },
  { label: "Back to rest", at: 0, reached: 0, verify: 3, ms: 900 },
];

/** The stop size, the neck, the capsule title's font and its insets, in points, as StepTrail.Style.standard draws them. */
const D = 34, GAP = liquid.joined, LABEL = 15, LEAD = 29, TAIL = 14;
const PITCH = D + GAP;
/** How far a finger's pull can stretch the puck past its stop: the Swift piece's d × 0.35. */
const REACH = D * 0.35;

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

/** Walks the beats; each holds for `ms`, then loops. Holds the first (resting) beat under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return { beat: steps[i], index: i };
}

const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * Plays a drag beat on one timeline: every frame resolves where the finger holds the capsule into the stop it is on
 * (switching a little past each midpoint, as the Swift piece does) and the puck's reach toward it, so the hops and the
 * pull read the same finger.
 */
function useFinger(beat: Beat): { at: number; pull: number; tracking: boolean } {
  const [now, setNow] = useState<{ beat: Beat; at: number; pull: number } | null>(null);
  const held = useRef(beat.at);
  useEffect(() => {
    const d = beat.drag;
    if (!d) { held.current = beat.at; return; }
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const k = Math.min(Math.max((time - start) / beat.ms, 0), 1);
      const position = d.from + (d.to - d.from) * ease(k);
      const nearest = Math.round(position);
      let at = held.current;
      if (nearest !== at && Math.abs(position - nearest) < 0.35) at = nearest;
      at = Math.min(Math.max(at, 0), beat.reached);
      held.current = at;
      flushSync(() => setNow({ beat, at, pull: rubberBand((position - at) * PITCH, REACH) }));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [beat]);
  if (!beat.drag) return { at: beat.at, pull: 0, tracking: false };
  return now?.beat === beat ? { at: now.at, pull: now.pull, tracking: true } : { at: held.current, pull: 0, tracking: true };
}

/**
 * Each title's width in points at the capsule's font, measured once the stage has a size, so a capsule fits its title
 * exactly at every stage width. Until then, a fair estimate.
 */
function useTitleWidths(titles: string[]) {
  const box = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>(() => titles.map((s) => s.length * LABEL * 0.56));
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const probe = el.firstElementChild as HTMLElement | null;
      const point = (probe?.offsetWidth ?? 0) / 100;
      if (!point) return;
      const next = Array.from(el.children).slice(1).map((c) => Math.ceil((c as HTMLElement).offsetWidth / point));
      setWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [titles]);
  const probe = (
    <div ref={box} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ visibility: "hidden", whiteSpace: "nowrap" }}>
      <span style={{ display: "block", width: u(100), height: 0 }} />
      {titles.map((s) => <span key={s} style={{ position: "absolute", fontSize: u(LABEL), fontWeight: 600, lineHeight: 1 }}>{s}</span>)}
    </div>
  );
  return { widths, probe };
}

const checkPath = "M5 12.5l4.5 4.5L19 7";

/** The digit roll `.numericText` plays: new digits rise in when the number grows and drop in when it shrinks. */
const keyframes = [
  "@keyframes st-roll{from{transform:translateY(var(--roll,40%));opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}",
  "@property --st-lo{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --st-hi{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --st-pl{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --st-ph{syntax:'<length>';inherits:true;initial-value:0px}",
].join("");

/** A count that rolls to its new value on `value`, never past it. */
function Roll({ text, n }: { text: string; n: number }) {
  const last = useRef(n), mounted = useRef(false);
  const up = n >= last.current;
  useEffect(() => { last.current = n; mounted.current = true; }, [n]);
  return <RollFace key={text} roll={mounted.current} up={up}>{text}</RollFace>;
}

function RollFace({ roll, up, children }: { roll: boolean; up: boolean; children: ReactNode }) {
  const [style] = useState(() => {
    const { easing, ms } = curve("value");
    return { display: "inline-block", "--roll": up ? "40%" : "-40%", animation: roll ? `st-roll ${ms}ms ${easing} both` : undefined } as CSSProperties;
  });
  return <span style={style}>{children}</span>;
}

/** Where each stop sits with `at` open: every other stop a circle. */
function layout(open: number, widths: number[], titled: boolean) {
  let cursor = 0;
  return widths.map((title, k) => {
    const w = titled && k === open ? LEAD + title + TAIL : D;
    const stop = { x: cursor, w };
    cursor += w + GAP;
    return stop;
  });
}

/**
 * One stop's content: its number or check centred in the leading circle and, on the open capsule, its title after it.
 * The number and the check blur over; the title blurs in once the capsule has mostly opened and out as it closes.
 */
function Face({ n, title, done, open, titled, titleWidth }: { n: number; title: string; done: boolean; open: boolean; titled: boolean; titleWidth: number }) {
  const swap = (on: boolean): CSSProperties => ({
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    opacity: on ? 1 : 0, filter: `blur(${on ? 0 : 3}px)`, transform: `scale(${on ? 1 : 0.7})`,
    transition: t(["opacity", "filter", "transform"], on ? "snap" : "dismiss", on ? 60 : 0),
  });
  return (
    <span className="absolute inset-y-0 left-0" style={{ width: u(titled ? LEAD + titleWidth + TAIL : D) }}>
      <span className="absolute left-0 top-0" style={{ width: u(D), height: u(D) }}>
        <span style={swap(!done)}><span className="tabular-nums" style={{ fontSize: u(LABEL), lineHeight: 1 }}>{n}</span></span>
        <span style={swap(done)}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(15), height: u(15) }}><path d={checkPath} /></svg>
        </span>
      </span>
      {titled ? (
        <span className="absolute top-0 flex items-center whitespace-nowrap" style={{
          left: u(LEAD), height: u(D), fontSize: u(LABEL), lineHeight: 1,
          opacity: open ? 1 : 0, filter: `blur(${open ? 0 : 5}px)`,
          transition: open ? t(["opacity", "filter"], "reveal", 110) : t(["opacity", "filter"], "dismiss"),
        }}>{title}</span>
      ) : null}
    </span>
  );
}

/**
 * The liquid trail, as the Swift piece draws it: glass stops resting joined, and one red glass puck over the current
 * stop carrying every face in ink, laid out exactly as the stops lay theirs out and cut to its outline.
 */
function Trail({ titles, at, reached, titled, from, press, shakeAt, shakeKey, grab, pull, tracking }: {
  titles: string[]; at: number; reached: number; titled: boolean; from: number;
  press?: number; shakeAt?: number; shakeKey?: number; grab?: boolean; pull: number; tracking: boolean;
}) {
  const { widths, probe } = useTitleWidths(titles);
  const stops = layout(at, widths, titled);
  const width = Math.max(...titles.map((_, k) => { const l = layout(k, widths, titled); return l[l.length - 1].x + l[l.length - 1].w; }));
  const cur = stops[Math.min(at, stops.length - 1)];
  // The edge facing the move leads on snap; the far edge waits a beat and follows on a looser spring.
  const forward = at >= from;
  const lead = t("--st-hi", "snap"), trail = t("--st-hi", follow("snap", 4), 50);
  const leadLo = t("--st-lo", "snap"), trailLo = t("--st-lo", follow("snap", 4), 50);
  const edges = forward ? [lead, trailLo] : [trail, leadLo];
  // A finger's reach is set every frame while it moves; let go, it springs home.
  const pulls = tracking ? ["--st-pl 0ms", "--st-ph 0ms"] : [t("--st-pl", "settle"), t("--st-ph", "settle")];
  const status = (k: number) => (k < at ? "done" : k === at ? "current" : k <= reached ? "ahead" : "unreached");
  const colorOf = (k: number) => (status(k) === "unreached" ? ground.muted : ground.text);
  const shakeAnim = (k: number): CSSProperties => (shakeAt === k && shakeKey ? { animation: `st-shake-${shakeKey % 2} 380ms ease-out` } : {});
  const sink = (k: number, w: number) => (press === k ? pressScale(w, D, 2) : 1);
  const faces = (color: (k: number) => string) => titles.map((title, k) => (
    <span key={title} className="absolute top-0" style={{ left: u(stops[k].x), width: u(stops[k].w), height: u(D), color: color(k), transition: [t(["left", "width"], "morph"), t("color", "snap")].join(", ") }}>
      <Face n={k + 1} title={title} done={status(k) === "done"} open={k === at} titled={titled} titleWidth={widths[k]} />
    </span>
  ));
  return (
    <div className="relative" style={{ width: u(width), height: u(D) }}>
      {probe}
      <LiquidGroup unit={u(1)} style={{ width: u(width), height: u(D) }}>
        {titles.map((title, k) => (
          <span key={title} className="absolute top-0" style={{ left: u(stops[k].x), width: u(stops[k].w), height: u(D), transition: t(["left", "width"], "morph"), ...shakeAnim(k) }}>
            <span className="block h-full w-full" style={{ transform: `scale(${sink(k, stops[k].w)})`, transition: t("transform", press === k ? "press" : "release") }}>
              <Liquid className="relative h-full w-full overflow-hidden" style={{ color: colorOf(k), transition: t("color", "snap") }}>
                <Face n={k + 1} title={title} done={status(k) === "done"} open={k === at} titled={titled} titleWidth={widths[k]} />
              </Liquid>
            </span>
          </span>
        ))}
        {/* The red puck between its live edges, over the stops; grabbed it lifts, pressed it sinks with its stop. */}
        <span className="absolute top-0" style={{
          left: "calc(var(--st-lo) + var(--st-pl))", width: "calc(var(--st-hi) + var(--st-ph) - var(--st-lo) - var(--st-pl))", height: u(D),
          "--st-lo": u(cur.x), "--st-hi": u(cur.x + cur.w), "--st-pl": u(Math.min(pull, 0)), "--st-ph": u(Math.max(pull, 0)),
          transition: [...edges, ...pulls].join(", "),
        } as CSSProperties}>
          <span className="block h-full w-full" style={{ transform: `scale(${grab ? 1.06 : sink(at, cur.w)})`, transition: t("transform", grab || press === at ? "press" : "release") }}>
            <Liquid tint={signal.fill} className="relative h-full w-full overflow-hidden">
              <span className="absolute top-0" style={{ left: "calc((var(--st-lo) + var(--st-pl)) * -1)", width: u(width), height: u(D) }}>
                {faces(() => signal.on)}
              </span>
            </Liquid>
          </span>
        </span>
      </LiquidGroup>
    </div>
  );
}

/** The quiet line under a trail: the step count, and the step's name when the capsule has no room for it. */
function Caption({ titles, at, titled }: { titles: string[]; at: number; titled: boolean }) {
  const meta: CSSProperties = { fontSize: u(13), lineHeight: 1.2, color: ground.muted };
  return (
    <div className="flex items-baseline whitespace-nowrap" style={{ gap: u(6), marginTop: u(10), height: u(16) }}>
      {titled ? null : <MorphText text={titles[at]} style={{ ...meta, color: ground.text }} />}
      <span style={meta}>Step <Roll text={String(at + 1)} n={at} /> of {titles.length}</span>
    </div>
  );
}

export function StepTrailPreview() {
  const { beat, index } = useSteps(STORY);
  const finger = useFinger(beat);
  const prev = STORY[(index + STORY.length - 1) % STORY.length];
  // Which way the red is travelling, for which edge leads: from the last beat's step, or the step a drag left.
  const fromAt = useRef(beat.at);
  const lastAt = useRef(beat.at);
  if (finger.at !== lastAt.current) { fromAt.current = lastAt.current; lastAt.current = finger.at; }
  const fromVerify = prev.verify;
  // A refused tap shakes the stop once, on the beat of its haptic.
  const shakeKey = beat.shake !== undefined ? index + 1 : 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <style>{`${keyframes}${[0, 1].map((k) => `@keyframes st-shake-${k}{${shake(u, 6)[0].map((f, i, all) => `${(i / (all.length - 1)) * 100}%{transform:${f.transform}}`).join("")}}`).join("")}`}</style>
      <div className="flex flex-col" style={{ transform: "scale(1.55)", gap: u(30) }}>
        <div>
          <Trail titles={CHECKOUT} at={finger.at} reached={beat.reached} titled from={fromAt.current} press={beat.press} shakeAt={beat.shake} shakeKey={shakeKey} grab={beat.grab} pull={finger.pull} tracking={finger.tracking} />
          <Caption titles={CHECKOUT} at={finger.at} titled />
        </div>
        <div>
          <Trail titles={VERIFY} at={beat.verify} reached={beat.verify} titled={false} from={fromVerify} pull={0} tracking={false} />
          <Caption titles={VERIFY} at={beat.verify} titled={false} />
        </div>
      </div>
    </div>
  );
}
