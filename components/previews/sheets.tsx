"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { cascade, curve, ms, pop, pressScale, reduced, rubberBand, settleTime, t, type Role, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Sheets: Toast, Confirm Sheet, Permission Sheet.
 * Each preview shows the component and nothing else. The sheets keep only their own dimmed backdrop,
 * which is what makes them read as presented; there is no app screen behind them.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 * Motion uses the PieceMotion roles (piece-motion.ts), so each preview moves the way its Swift piece does, and every
 * control surface is liquid glass from piece-liquid.tsx, on the same rest gaps and buds as the Swift pieces. One point
 * is one stage px here, so each `LiquidGroup` runs on `u(1)`. State lives above the groups, which draw their children twice.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const quiet = ground.trough;

/** A scripted finger's path, not a spring: a hand moving and stopping. */
const fingerPath = "cubic-bezier(0.45, 0, 0.55, 1)";
/**
 * A finger gathering speed into a flick: its pace grows by the same share every moment and ends at five times its
 * average. Any slower and the 0.28 s exit spring would speed the card up after the finger lets go.
 */
const gather = 5;
const flickPath = (p: number) => (Math.exp(gather * p) - 1) / (Math.exp(gather) - 1);
const flickEndPace = (gather * Math.exp(gather)) / (Math.exp(gather) - 1);

/**
 * A flick as one easing. The first `share` of the move follows the finger for `pullMs`; the rest is a critically
 * damped spring that starts already moving, like Swift's `settle(velocity:from:to:spring:)`, with `velocity` in
 * whole distances left per second, capped near the spring's frequency as Swift caps it. One curve, so the card
 * leaves at exactly the finger's speed whatever the timers do; at half the frequency or more it only slows from there.
 */
function flickAway(s: Spring, share: number, pullMs: number, velocity: number): { easing: string; ms: number } {
  const pullS = pullMs / 1000, exitS = settleTime(s), total = pullS + exitS;
  if (typeof CSS === "undefined" || !CSS.supports("transition-timing-function", "linear(0, 1)")) return { easing: curve("dismiss").easing, ms: Math.round(total * 1000) };
  const w = (2 * Math.PI) / s.duration;
  const v = Math.min(Math.max(velocity, 0), w * 1.5);
  // Sampled every 4 ms or so, with a point exactly at the release.
  const n = Math.round(pullS / 0.004), m = Math.round(exitS / 0.004);
  const points = ["0"];
  for (let i = 1; i <= n + m; i++) {
    const x = i <= n ? (i / n) * pullS : pullS + ((i - n) / m) * exitS, after = x - pullS;
    const y = i <= n ? share * flickPath(i / n) : share + (1 - share) * (1 - Math.exp(-w * after) * (1 + (w - v) * after));
    points.push(i === n + m ? "1" : `${y.toFixed(4)} ${((x / total) * 100).toFixed(2)}%`);
  }
  return { easing: `linear(${points.join(", ")})`, ms: Math.round(total * 1000) };
}

/** The leaning press: the anchor sits partway from the centre toward the touch, as `pressAnchor` does. */
const lean = (x: number, y: number) => `${50 + (x - 0.5) * 60}% ${50 + (y - 0.5) * 60}%`;

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

/** Steps through named phases with per-phase durations and loops. Holds `rest` under reduced motion. */
function usePhases<P extends string>(script: readonly (readonly [P, number])[], rest: P) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((v) => (v + 1) % script.length), script[i][1]);
    return () => clearTimeout(t);
  }, [i, script, reduced]);
  return { phase: reduced ? rest : script[i][0], cycle: i, reduced };
}

/** Plays one-shot Web Animations (pops, bounces) and cancels any still running when the stage unmounts. */
function useKicks() {
  const live = useRef(new Set<Animation>());
  useEffect(() => {
    const running = live.current;
    return () => { running.forEach((a) => a.cancel()); running.clear(); };
  }, []);
  return useCallback((el: Element | null, [frames, options]: [Keyframe[], KeyframeAnimationOptions]) => {
    if (!el || reduced()) return;
    const a = el.animate(frames, options);
    live.current.add(a);
    a.onfinish = a.oncancel = () => live.current.delete(a);
  }, []);
}

/** The tile glyph's `.symbolEffect(.bounce.down)`: it dips, then springs back through rest on the release role. */
function bounceDown(): [Keyframe[], KeyframeAnimationOptions] {
  const dip = 110, total = dip + ms("release");
  return [[
    { transform: "translateY(0) scale(1)", offset: 0, easing: "cubic-bezier(0.33, 0, 0.67, 1)" },
    { transform: `translateY(${u(2)}) scale(0.84)`, offset: dip / total, easing: curve("release").easing },
    { transform: "translateY(0) scale(1)", offset: 1 },
  ], { duration: total }];
}

const G = {
  check: "M5 12.5l4.5 4.5L19 7",
  info: "M12 11v6M12 7.2v.1",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7",
  bell: "M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14l1.5-2ZM10 21h4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  people: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11ZM3.5 19.5a5.5 5.5 0 0 1 11 0M16 5a3.2 3.2 0 0 1 0 6M20.5 19.5a5.5 5.5 0 0 0-3.5-5.1",
  moon: "M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z",
} as const;

function Glyph({ d, size, stroke = 2.4, style }: { d: string; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

function Ground({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>{children}</div>;
}

const Spinner = ({ color }: { color: string }) => (
  <span data-motion className="rounded-full" style={{ width: u(18), height: u(18), borderWidth: u(2.4), borderStyle: "solid", borderColor: `${color}40`, borderTopColor: color, animation: "sh-spin .8s linear infinite" }} />
);

/**
 * One face of content replaced in place. With `blur` it is `.blurReplace` (a label giving way to a spinner or a
 * check); without, `.symbolEffect(.replace)` (a tile glyph).
 */
function face(on: boolean, role: Role, blur = false, delay = 0): CSSProperties {
  return {
    gridArea: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: on ? 1 : 0,
    transform: on ? "scale(1)" : `scale(${blur ? 0.8 : 0.5})`,
    filter: blur ? (on ? "blur(0px)" : `blur(${u(4)})`) : undefined,
    transition: t(blur ? ["opacity", "transform", "filter"] : ["opacity", "transform"], role, delay),
  };
}

/** Swaps between two children in place, on `role`. */
function Swap({ first, second, showSecond, role, blur }: { first: ReactNode; second: ReactNode; showSecond: boolean; role: Role; blur?: boolean }) {
  return (
    <span className="grid place-items-center">
      <span data-motion style={face(!showSecond, role, blur)}>{first}</span>
      <span data-motion style={face(showSecond, role, blur)}>{second}</span>
    </span>
  );
}

/** `piecePop` as CSS, so both passes of a liquid group pop in step (a Web Animation would reach only one of them). */
const popCss = (() => {
  const [frames, { duration }] = pop();
  const steps = frames.map((f) => `${Math.round((f.offset as number) * 100)}%{transform:${f.transform};${f.easing ? `animation-timing-function:${f.easing};` : ""}}`);
  return { keyframes: `@keyframes sh-pop{${steps.join("")}}`, animation: `sh-pop ${duration}ms both` };
})();

const keyframes = `@keyframes sh-spin{to{transform:rotate(360deg)}}@keyframes sh-drain{from{stroke-dashoffset:0}to{stroke-dashoffset:100}}${popCss.keyframes}`;

/** A glyph arriving inside glass beside a morphing label: it sharpens in from a blur, like `motion.swap`. */
const Arrive = ({ children }: { children: ReactNode }) => <span className="pv-lq-in" style={{ display: "flex" }}>{children}</span>;

// MARK: Toast

type ToastPhase = "rest" | "arm" | "shown" | "landed" | "budded" | "touched" | "tug" | "resume" | "undo" | "gone";
// The empty stretches stay short: a card tile should almost always show the toast, not a blank stage.
// `landed` is the card settling, 250 ms in: the tile buds out of the card's leading end, and the action out of its
// trailing end a beat later (`budded`), as Swift's bloom staggers them. The held toast is then pulled away from its
// edge against the band and let go. `undo` holds the check for Swift's 420 ms beat.
const toastScript: readonly (readonly [ToastPhase, number])[] = [["rest", 420], ["arm", 160], ["shown", 250], ["landed", 50], ["budded", 1200], ["touched", 300], ["tug", 600], ["resume", 900], ["undo", 420], ["gone", 520]];
/** The tile bubble's side and the action bubble's height (the house size for round controls), and the action's width. */
const BUBBLE = 52, ACTION_W = 76;
const toastPress = pressScale(500, BUBBLE);
const toastTug = rubberBand(40, 60);
/** Each bubble's home: just inside the card's nearest end, shrunk, where the two are one shape. */
const tileHome = BUBBLE / 2 + liquid.joined + (BUBBLE * liquid.homeScale) / 2;
const actionHome = ACTION_W / 2 + liquid.joined + (ACTION_W * liquid.homeScale) / 2;

export function ToastPreview() {
  const { phase, reduced } = usePhases(toastScript, "budded");
  const hidden = phase === "rest" || phase === "arm";
  const leaving = phase === "gone";
  const touched = phase === "touched" || phase === "tug";
  const tileOut = !hidden && phase !== "shown";
  const actionOut = tileOut && phase !== "landed";
  // The timer drains while shown or resumed and holds while touched or actioned, like the Swift `TimelineView`. A CSS
  // animation, so both passes of the glass drain in step and a pause holds exactly where it is.
  const running = phase === "shown" || phase === "landed" || phase === "budded" || phase === "resume";

  // It arrives calmly from above with the message in place, and leaves quicker, sliding on past where it came from.
  const card: CSSProperties = {
    opacity: hidden || leaving ? 0 : 1,
    transform: hidden ? `translateY(calc(-50% - ${u(84)})) scale(0.96)` : leaving ? `translateY(calc(-50% - ${u(120)})) scale(1)` : "translateY(-50%) scale(1)",
    transition: hidden ? "none" : t(["transform", "opacity"], leaving ? "dismiss" : "reveal"),
  };

  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ top: "50%", paddingInline: u(28), transformOrigin: "top", ...card }}>
        {/* Held, the whole toast sinks toward the finger and is pulled against the band; the drag itself is never sprung. */}
        <div data-motion className="w-full" style={{ maxWidth: u(500), transform: `scale(${touched ? toastPress : 1})`, transformOrigin: lean(0.42, 0.5), translate: `0 ${u(phase === "tug" ? toastTug : 0)}`, transition: `${t("transform", touched ? "press" : "release")}, ${phase === "tug" ? `translate 400ms ${fingerPath}` : t("translate", "settle")}` }}>
          {/* Parts of one control: the bubbles rest joined to the card, so liquid necks hold them to it. */}
          <LiquidGroup unit={u(1)} axis="x">
            <div className="flex items-center" style={{ gap: u(liquid.joined) }}>
              <span className="relative shrink-0" style={{ width: u(BUBBLE), height: u(BUBBLE) }}>
                <Liquid tint={tileOut ? blocks.sage : undefined} bud={{ out: tileOut, home: [tileHome, 0] }} className="absolute inset-0 flex items-center justify-center" style={{ color: ink }}>
                  <BudContent out={tileOut}>
                    <span className="relative grid place-items-center" style={{ width: u(BUBBLE), height: u(BUBBLE) }}>
                      {/* The time left: a ring around the glyph that drains clockwise from the top, holding while touched
                          and once Undo has run, as Swift's TimelineView does. A clock, so it runs under Reduce Motion. */}
                      <svg aria-hidden viewBox="0 0 42 42" className="absolute" style={{ inset: u(5), width: `calc(100% - ${u(10)})`, height: `calc(100% - ${u(10)})`, transform: "rotate(-90deg)" }} fill="none">
                        <circle cx="21" cy="21" r="19.75" stroke={ink} strokeOpacity={0.14} strokeWidth={2.5} />
                        <circle data-motion cx="21" cy="21" r="19.75" stroke={ink} strokeOpacity={0.62} strokeWidth={2.5} strokeLinecap="round" pathLength={100} strokeDasharray="100 100" style={{
                          animationName: hidden ? "none" : "sh-drain", animationDuration: "4200ms", animationTimingFunction: "linear", animationFillMode: "both", animationPlayState: running ? "running" : "paused",
                        }} />
                      </svg>
                      <Glyph d={G.check} size={19} stroke={3} />
                    </span>
                  </BudContent>
                </Liquid>
              </span>
              {/* Above the bubbles, so one at home sits under the card. */}
              <Liquid radius={22} className="relative flex min-w-0 flex-1 flex-col justify-center" style={{ zIndex: 1, minHeight: u(BUBBLE), padding: `${u(6)} ${u(16)}` }}>
                <span className="block" style={{ fontSize: u(16), fontWeight: 600, lineHeight: 1.25 }}>Conversation archived</span>
                <span className="block truncate" style={{ fontSize: u(13.5), fontWeight: 600, color: ground.muted, lineHeight: 1.3 }}>Mira Reyes · Invoice 2291</span>
              </Liquid>
              <span className="relative shrink-0" style={{ width: u(ACTION_W), height: u(BUBBLE) }}>
                {/* The action pops as its check lands; the pop is CSS so the glass and its label pop together. */}
                <Liquid tint={actionOut ? signal.fill : undefined} bud={{ out: actionOut, home: [-actionHome, 0] }} className="absolute inset-0 flex items-center justify-center" style={{ color: signal.on, fontSize: u(16), fontWeight: 600, animation: phase === "undo" ? popCss.animation : undefined }}>
                  <BudContent out={actionOut}>
                    <Swap first={<span>Undo</span>} second={<Glyph d={G.check} size={18} stroke={3} />} showSecond={phase === "undo" || leaving} role="snap" blur />
                  </BudContent>
                </Liquid>
              </span>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Ground>
  );
}

// MARK: Confirm Sheet

type ConfirmPhase = "rest" | "present" | "landed" | "press" | "busy" | "done" | "answered" | "leave" | "tug" | "home" | "flick";
/** Below the stage by the card's height and its clearance, so it starts and ends out of sight. */
const below = 430;
const cardHeight = 360;
const tug = rubberBand(-60, 60);
// A hard flick: about 3,800 u/s at the release, over half the exit spring's frequency for the distance left, so the
// card leaves at the finger's speed and only slows from there.
const pull = 112, pullMs = 150;
// Swift's exit after a flick: a 0.28 s critically damped spring, started at the card's speed over the distance left.
// The tray rides the same exit from wherever the pull left it.
const flickSpeed = (flickEndPace * pull / (pullMs / 1000)) / (below - pull);
const flickCard = flickAway({ duration: 0.28, bounce: 0 }, pull / below, pullMs, flickSpeed);
const flickTray = flickAway({ duration: 0.28, bounce: 0 }, pull / cardHeight, pullMs, flickSpeed);
// Two scenes: a confirm (the button's check lands, the tile answers 80 ms later, the card leaves 470 ms after
// that), then a drag (a tug up against the band, a release home, a pull down into a flick away).
const confirmScript: readonly (readonly [ConfirmPhase, number])[] = [
  ["rest", 900], ["present", 300], ["landed", 900], ["press", 150], ["busy", 900], ["done", 80], ["answered", 470], ["leave", 700],
  ["rest", 700], ["present", 300], ["landed", 700], ["tug", 280], ["home", 750], ["flick", pullMs + 700],
];
const confirmPress = pressScale(428, 52);
/** Cancel's home: just inside the primary's lower end, shrunk, where the two are one shape. */
const ACTION_H = 52;
const cancelHome = ACTION_H / 2 + liquid.apart + (ACTION_H * liquid.homeScale) / 2;

export function ConfirmSheetPreview() {
  const { phase } = usePhases(confirmScript, "landed");
  const kick = useKicks();
  const glyph = useRef<HTMLSpanElement>(null);
  const tile = useRef<HTMLSpanElement>(null);
  const tileDone = phase === "answered" || phase === "leave";
  const done = phase === "done" || tileDone;
  const busy = phase === "busy" || done;
  // Cancel buds down out of the primary as the card lands, and melts back up into it the moment the primary is tapped.
  const cancelOut = phase === "landed" || phase === "press" || phase === "tug" || phase === "home" || phase === "flick";
  const label = done ? "Done" : busy ? "Working" : "Delete note";
  const offset = phase === "rest" || phase === "leave" || phase === "flick" ? below : phase === "tug" ? tug : 0;
  // The tray brightens as the card is pulled away from it.
  const scrim = offset >= below ? 0 : 1 - Math.min(Math.max(offset / cardHeight, 0), 1);

  // The tile's glyph bounces once the card has landed; the tile pops as it answers the button with its check.
  useEffect(() => {
    if (phase === "landed") kick(glyph.current, bounceDown());
    if (phase === "answered") kick(tile.current, pop());
  }, [phase, kick]);

  // Arrives calmly and leaves quicker. Under the finger it follows the hand; let go above rest it rebounds with a
  // little give, and a flick leaves at the card's own speed.
  const move = (props: string[], flick: { easing: string; ms: number }) => {
    switch (phase) {
      case "rest": return "none";
      case "leave": return t(props, "dismiss");
      case "tug": return props.map((p) => `${p} 280ms ${fingerPath}`).join(", ");
      case "home": return t(props, "rebound");
      case "flick": return props.map((p) => `${p} ${flick.ms}ms ${flick.easing}`).join(", ");
      default: return t(props, "reveal");
    }
  };

  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-0" style={{ background: "rgba(0,0,0,.45)", opacity: scrim, transition: move(["opacity"], flickTray) }} />

      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ bottom: u(28), paddingInline: u(10), transform: `translateY(${u(offset)})`, transition: move(["transform"], flickCard) }}>
        <div className="flex w-full flex-col" style={{ maxWidth: u(476), padding: `${u(12)} ${u(24)} ${u(22)}`, borderRadius: u(34), background: ground.surface, boxShadow: `0 ${u(14)} ${u(34)} rgba(0,0,0,.5)` }}>
          <span className="self-center rounded-full" style={{ width: u(38), height: u(5), background: quiet }} />
          <span ref={tile} data-motion className="flex items-center justify-center" style={{ marginTop: u(14), width: u(56), height: u(56), borderRadius: u(18), background: tileDone ? blocks.sage : blocks.tangerine, color: ink, transition: t("background-color", "morph") }}>
            <span ref={glyph} data-motion className="flex">
              <Swap first={<Glyph d={G.trash} size={24} stroke={2.4} />} second={<Glyph d={G.check} size={24} stroke={3.2} />} showSecond={tileDone} role="morph" />
            </span>
          </span>
          <p style={{ fontSize: u(26), fontWeight: font.displayWeight, letterSpacing: "-0.03em", marginTop: u(16), lineHeight: 1.1 }}>Delete this note?</p>
          <p style={{ fontSize: u(15), fontWeight: 600, color: ground.muted, marginTop: u(6), lineHeight: 1.35 }}>It will be removed from your iPhone, iPad and Mac.</p>
          {/* Two separate actions rest apart, each its own glass capsule, gooey only while cancel buds or melts. */}
          <LiquidGroup unit={u(1)} axis="y" style={{ marginTop: u(20) }}>
            <div className="flex flex-col" style={{ gap: u(liquid.apart) }}>
              {/* Above cancel, so cancel at home sits under it. The label morphs letter by letter; done, the glass turns sage. */}
              <Liquid tint={done ? blocks.sage : signal.fill} className="relative flex items-center justify-center" style={{
                zIndex: 1, height: u(ACTION_H), gap: u(8), color: ink, fontSize: u(17), fontWeight: 600,
                transform: `scale(${phase === "press" ? confirmPress : 1})`, transition: `${t("transform", phase === "press" ? "press" : "release")}, ${t("background-color", "snap")}`,
              }}>
                {phase === "busy" ? <Arrive key="spin"><Spinner color={ink} /></Arrive> : done ? <Arrive key="check"><Glyph d={G.check} size={19} stroke={3.2} /></Arrive> : null}
                <MorphText text={label} />
              </Liquid>
              <Liquid bud={{ out: cancelOut, home: [0, -cancelHome] }} className="flex items-center justify-center" style={{ height: u(ACTION_H), color: ground.text, fontSize: u(17), fontWeight: 600 }}>
                <BudContent out={cancelOut}>Cancel</BudContent>
              </Liquid>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Ground>
  );
}

// MARK: Permission Sheet

type PermissionPhase = "rest" | "present" | "reveal" | "deal" | "press" | "requesting" | "result" | "hold" | "leave";
type PermissionStep = readonly [PermissionPhase, number];
// `reveal` is 300 ms in, once the sheet has settled: the banners drop in, the front one first. While it waits the stack
// deals the next banner to the front (`deal`), as Swift's does every 2.6 s, then the request is tapped.
const ask: readonly PermissionStep[] = [["rest", 600], ["present", 300], ["reveal", 1500], ["deal", 1300], ["press", 150], ["requesting", 900]];
// A grant, then a denial. Swift calls `onGranted` 0.9 s after a grant and the example dismisses there; a denial stays
// up, greying the stack out (`hold`), before the loop takes it away.
const grantRound: readonly PermissionStep[] = [...ask, ["result", 1000], ["leave", 600]];
const permissionScript: readonly PermissionStep[] = [...grantRound, ...ask, ["result", 700], ["hold", 1200], ["leave", 600]];
/** The sheet's rhythm, Swift's `beat`: the answer turns the card over from the top. */
const beat = 70;
const permissionPress = pressScale(428, 52);
/** The request and Not now capsules' height. */
const BUTTON_H = 50;
/** Not now's home: just inside the request button's lower end. */
const skipHome = BUTTON_H / 2 + liquid.apart + (BUTTON_H * liquid.homeScale) / 2;
/** The banners: Swift's example benefits, as notifications. Each is 60pt tall; the two behind fan 11pt lower. */
const BANNERS = [
  [G.clock, "Design review in 30 minutes", blocks.butter],
  [G.people, "Mara replied to Groceries", blocks.sage],
  [G.moon, "Quiet hours from 10 PM to 7 AM", blocks.lilac],
] as const;
const BANNER_H = 60, FAN = 11;
/** A banner's card: a step off the sheet's surface, solid, so the ones behind never show through. */
const bannerFill = `color-mix(in srgb, ${ground.text} 4%, ${ground.surface})`;

export function PermissionSheetPreview() {
  const { phase, cycle, reduced } = usePhases(permissionScript, "deal");
  const kick = useKicks();
  const stack = useRef<HTMLDivElement>(null);
  // Which answer this round gets comes from where the script is, so each round keeps its own timing.
  const round = cycle < grantRound.length ? 0 : 1;
  const up = phase !== "rest" && phase !== "leave";
  const revealed = phase !== "rest" && phase !== "present";
  const front = phase === "rest" || phase === "present" || phase === "reveal" ? 0 : 1;
  // The sheet leaves still showing its answer.
  const decided = phase === "result" || phase === "hold" || phase === "leave";
  const granted = decided && round === 0, denied = decided && round === 1;
  const busy = phase === "requesting";
  const pressed = phase === "press";

  // A grant pops the stack on the haptic's beat.
  useEffect(() => {
    if (phase === "result" && round === 0) kick(stack.current, pop());
  }, [phase, round, kick]);

  // A denial turns the card over: the old copy lifts away through a blur, and the denied copy rises into its place
  // once the old one has mostly gone.
  const copy = (on: boolean, away: number): CSSProperties => ({
    gridArea: "1 / 1",
    opacity: on ? 1 : 0,
    filter: on || reduced ? "blur(0px)" : `blur(${u(5)})`,
    transform: on || reduced ? "translateY(0)" : `translateY(${u(away)})`,
    transition: on ? t(["opacity", "filter", "transform"], "reveal", cascade(3, beat)) : t(["opacity", "filter", "transform"], "dismiss", cascade(1, beat)),
  });
  // The button's look follows the stack two beats later; the spinner answers a tap at once.
  const look = busy ? 0 : cascade(2, beat);
  const buttonTint = granted ? blocks.sage : denied ? ground.text : signal.fill;
  const buttonLabel = granted ? "Allowed" : denied ? "Open Settings" : busy ? "Requesting" : "Allow notifications";
  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-0" style={{ background: "rgba(0,0,0,.4)", opacity: up ? 1 : 0, transition: t("opacity", up ? "reveal" : "dismiss") }} />

      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ bottom: u(20), paddingInline: u(10), transform: up ? "translateY(0)" : `translateY(${u(440)})`, transition: t("transform", up ? "reveal" : "dismiss") }}>
        <div key={round} className="flex w-full flex-col items-center" style={{ maxWidth: u(476), padding: `${u(12)} ${u(22)} ${u(20)}`, borderRadius: u(34), background: ground.surface, boxShadow: `0 ${u(14)} ${u(34)} rgba(0,0,0,.45)` }}>
          <span className="rounded-full" style={{ width: u(38), height: u(5), background: quiet }} />
          {/* A preview of what the permission brings: the benefits as a fanned stack of notification banners. They drop
              in one after another, the next is dealt to the front, a grant pops the stack and a denial greys it out. */}
          <div ref={stack} data-motion className="relative w-full" style={{
            marginTop: u(14), height: u(BANNER_H + 2 * FAN),
            filter: denied ? "grayscale(1)" : "grayscale(0)", opacity: denied ? 0.5 : 1,
            transition: t(["filter", "opacity"], "morph", cascade(1, beat)),
          }}>
            {BANNERS.map(([d, text, tint], i) => {
              const rank = (i - front + BANNERS.length) % BANNERS.length;
              return (
                <div key={text} data-motion className="absolute inset-x-0 top-0 flex items-center" style={{
                  height: u(BANNER_H), padding: `0 ${u(14)} 0 ${u(11)}`, gap: u(12), borderRadius: u(20), background: bannerFill,
                  boxShadow: `inset 0 0 0 ${u(1)} color-mix(in srgb, ${ground.text} 6%, transparent), 0 ${u(4)} ${u(10)} rgba(0,0,0,.08)`,
                  zIndex: BANNERS.length - rank, transformOrigin: "50% 0",
                  opacity: revealed ? 1 : 0,
                  transform: reduced ? "none" : `translateY(${u(revealed ? rank * FAN : -28)}) scale(${1 - 0.06 * rank})`,
                  filter: `brightness(${1 - 0.035 * rank})`,
                  // Arriving, the front banner lands first and the rest follow it in behind; dealt, they settle with a
                  // little give.
                  transition: phase === "rest" ? "none" : phase === "deal" ? t(["transform", "filter"], "settle") : t(["transform", "opacity", "filter"], "reveal", 90 * rank),
                }}>
                  <span className="grid shrink-0 place-items-center" style={{ width: u(36), height: u(36), borderRadius: u(10), background: tint, color: ink }}><Glyph d={d} size={17} stroke={2.4} /></span>
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: u(15), fontWeight: 600 }}>{text}</span>
                  <span style={{ fontSize: u(12), fontWeight: 600, color: ground.muted }}>now</span>
                </div>
              );
            })}
          </div>
          <div className="grid w-full text-center" style={{ marginTop: u(16) }}>
            <div data-motion style={copy(!denied, -6)}>
              <p style={{ fontSize: u(25), fontWeight: font.displayWeight, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Turn on notifications</p>
              <p className="mx-auto" style={{ maxWidth: u(360), fontSize: u(14.5), fontWeight: 600, color: ground.muted, marginTop: u(6), lineHeight: 1.35 }}>We only send what matters, and you can change this any time.</p>
            </div>
            <div data-motion style={copy(denied, 6)}>
              <p style={{ fontSize: u(25), fontWeight: font.displayWeight, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Notifications are off</p>
              <p className="mx-auto" style={{ maxWidth: u(360), fontSize: u(14.5), fontWeight: 600, color: ground.muted, marginTop: u(6), lineHeight: 1.35 }}>Turn them on in Settings whenever you&apos;re ready.</p>
            </div>
          </div>
          {/* Two separate actions rest apart: Not now melts up into the request button on a grant. */}
          <div className="w-full" style={{ marginTop: u(18) }}>
            <LiquidGroup unit={u(1)} axis="y">
              <div className="flex flex-col" style={{ gap: u(liquid.apart) }}>
                <Liquid tint={buttonTint} className="relative flex items-center justify-center" style={{
                  zIndex: 1, height: u(BUTTON_H), gap: u(8), color: denied ? ground.bg : ink, fontSize: u(17), fontWeight: 600,
                  transform: `scale(${pressed ? permissionPress : 1})`, transition: `${t("transform", pressed ? "press" : "release")}, ${t(["background-color", "color"], "morph", look)}`,
                }}>
                  {busy ? <Arrive key="spin"><Spinner color={ink} /></Arrive> : granted ? <Arrive key="check"><Glyph d={G.check} size={19} stroke={3.2} /></Arrive> : null}
                  <MorphText text={buttonLabel} />
                </Liquid>
                <Liquid bud={{ out: !granted, home: [0, -skipHome] }} className="flex items-center justify-center" style={{ height: u(BUTTON_H), fontSize: u(17), fontWeight: 600, color: ground.text }}>
                  <BudContent out={!granted}>Not now</BudContent>
                </Liquid>
              </div>
            </LiquidGroup>
          </div>
        </div>
      </div>
    </Ground>
  );
}
