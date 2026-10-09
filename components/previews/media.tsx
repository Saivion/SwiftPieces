"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";
import { curve, follow, ms, reduced, roles, rubberBand, settleTime, springValue, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, budStyle } from "./piece-liquid";

/* Media: PhotoViewer and StoryStrip. Each preview shows the component and nothing else (FREE-V2.1):
   no gallery entry point, no story-app header. The stage is 4:3 (100cqw by 75cqw); 1 iOS point is
   0.19cqw. Photos are flat color prints, never stock. Motion uses the PieceMotion roles (piece-motion.ts);
   the chrome is liquid glass (piece-liquid.tsx), as in the Swift pieces. */

const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const PAPER = "#f4f3ef";
/** The dark glass, in either site theme: the Swift viewer draws its chrome in the dark appearance over its scrim. */
const DARK_GLASS = { "--pv-glass": "rgba(38,38,41,0.62)", "--pv-glass-solid": "#2a2a2d", "--pv-glass-shade": "rgba(0,0,0,0.24)", "--pv-glass-edge": "rgba(255,255,255,0.12)", "--pv-glass-rim": "rgba(255,255,255,0.16)", "--pv-glass-lift": "rgba(0,0,0,0.45)" } as CSSProperties;
const KEYFRAMES = "@keyframes cm-tap{0%{opacity:0;transform:scale(.6)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.25)}}@keyframes cm-fade{from{opacity:0;transform:translateY(2%)}to{opacity:1;transform:none}}@keyframes cm-roll-up{from{opacity:0;transform:translateY(45%);filter:blur(.3cqw)}to{opacity:1;transform:none;filter:none}}";
const meta: CSSProperties = { fontSize: p(11), fontWeight: 600, letterSpacing: "0.09em", lineHeight: 1 };

/** One shared clock (seconds), redrawn up to `fps` times a second and held at `rest` under Reduce Motion. */
function useClock(rest: number, fps = 30) {
  const [t, setT] = useState(rest);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = 0; const start = performance.now();
    // A little slack, so frame jitter doesn't drop every other frame at the display's own rate.
    const tick = (now: number) => { if (now - last >= 1000 / fps - 2) { last = now; setT(Math.max(0, now - start) / 1000); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}

/** A no-bounce spring that leaves already moving, as Swift's `settle(velocity:from:to:spring:)` starts one: `v` is in
 *  whole distances per second, capped at 1.5 times the spring's frequency as Swift caps it. `near` is when it is
 *  within 1% of its target, where Swift's logical completion hands over to the next move. */
function thrown(s: Spring, v: number): { easing: string; ms: number; near: number } {
  const w = (2 * Math.PI) / s.duration, v0 = Math.min(Math.max(v, 0), 1.5 * w), total = settleTime(s);
  const at = (x: number) => 1 - Math.exp(-w * x) * (1 + (w - v0) * x);
  let near = 0;
  for (let x = 0; x < total; x += 0.002) if (Math.abs(at(x) - 1) > 0.01) near = x;
  const timing = { ms: Math.round(total * 1000), near: Math.round(near * 1000) };
  if (typeof CSS === "undefined" || !CSS.supports("transition-timing-function", "linear(0, 1)")) return { ...timing, easing: curve(s).easing };
  const steps = Math.max(24, Math.round(total / 0.012)), points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    points.push(i === 0 ? "0" : i === steps ? "1" : `${at(q * total).toFixed(4)} ${(q * 100).toFixed(2)}%`);
  }
  return { ...timing, easing: `linear(${points.join(", ")})` };
}

// MARK: Photo Viewer

const PRINTS = [
  { title: "Noon", ground: blocks.tangerine, shape: blocks.butter },
  { title: "Tide", ground: blocks.sky, shape: blocks.sage },
  { title: "Dusk", ground: blocks.lilac, shape: blocks.tangerine },
];

/** A flat poster: a solid ground, one disc, a bar, and the title set large. Sized by its container width (`w` in points). */
function Print({ i, w }: { i: number; w: number }) {
  const x = PRINTS[i], u = (f: number) => p(w * f);
  return (
    <div className="relative overflow-hidden" style={{ width: p(w), height: p(w * 4 / 3), background: x.ground, color: ink, borderRadius: p(Math.max(6, w * 0.04)) }}>
      <span className="absolute rounded-full" style={{ width: u(0.62), height: u(0.62), left: u(0.3), top: u(0.16), background: x.shape }} />
      <span className="absolute" style={{ width: u(0.46), height: u(0.1), left: u(0.08), top: u(0.62), background: ink }} />
      <span className="absolute" style={{ left: u(0.07), top: u(0.07), fontFamily: font.mono, fontWeight: 600, fontSize: u(0.05) }}>No. 0{i + 1}</span>
      <span className="absolute whitespace-nowrap" style={{ left: u(0.07), bottom: u(0.05), fontWeight: 600, fontSize: u(0.26), letterSpacing: "-0.05em", lineHeight: 1 }}>{x.title}</span>
    </div>
  );
}

/** The stage in points, the print, and the double-tap zoom. */
const STAGE = { w: 100 / 0.19, h: 75 / 0.19 }, PW = 270, PH = 360, ZOOM = 2.5;
/** A finger gathering speed into a flick: it ends at three times its average pace, which the release carries on. */
const FLICK = "cubic-bezier(0.6, 0, 0.9, 0.7)", FLICK_PACE = 3;
/** Where SwiftUI predicts a released drag ends: it coasts on like a scroll view. */
const coast = (v: number) => v * 0.499;
const clampTo = (v: number, m: number) => Math.min(Math.max(v, -m), m);

/** The zoom, pan and throw, worked out the way PhotoViewer.swift does it. The double tap keeps the print under it in
 *  place; the bounds hold the print's 20pt margin to the stage edge, as the Swift page frame does. The tap sits close
 *  enough to the centre (49pt at most) that the zoomed print still covers the stage, so no sliver of backdrop shows. */
const PAN = (() => {
  const bound = { x: ((PW + 40) * ZOOM - STAGE.w) / 2, y: ((PH + 40) * ZOOM - STAGE.h) / 2 };
  const tap = { x: -44, y: -20 };
  const zoomed = { x: clampTo(tap.x * (1 - ZOOM), bound.x), y: clampTo(tap.y * (1 - ZOOM), bound.y) };
  const drag = { x: -170, y: -8, ms: 360 };
  const from = { x: zoomed.x + drag.x, y: zoomed.y + drag.y };
  const v = { x: (drag.x / drag.ms) * 1000 * FLICK_PACE, y: (drag.y / drag.ms) * 1000 * FLICK_PACE };
  const end = { x: from.x + coast(v.x), y: from.y + coast(v.y) };
  const dest = { x: clampTo(end.x, bound.x), y: clampTo(end.y, bound.y) };
  // Inside the bounds the print coasts to where the flick ends, for longer the further it glides.
  const glide: Spring = { duration: Math.min(0.6, 0.3 + Math.hypot(dest.x - from.x, dest.y - from.y) / 1500), bounce: 0 };
  // Into the edge it keeps the finger's speed and carries on past by a give that grows with the flick (under 80pt);
  // the rebound follows once it gets there.
  const peak = dest.x + rubberBand(end.x - dest.x, 80, 0.12);
  const leg: Spring = { duration: Math.min(0.6, Math.max(roles.press.duration, (2 * Math.PI * Math.abs(peak - from.x)) / Math.abs(v.x))), bounce: 0 };
  return { tap, zoomed, drag, from, dest, peak, x: thrown(leg, v.x / (peak - from.x)), y: thrown(glide, v.y / (dest.y - from.y || 1)) };
})();

/** The dismiss: a pull down, released as a flick past a projected 280pt, slides the print off at the speed it was thrown. */
const PULL = (() => {
  const dy = 110, duration = 380, v = (dy / duration) * 1000 * FLICK_PACE;
  const travel = Math.max(Math.hypot(STAGE.w, STAGE.h) * 1.1, coast(v) * 1.5);
  return { dy, ms: duration, end: dy + travel, fly: thrown({ duration: 0.28, bounce: 0 }, v / travel) };
})();

type Move = "present" | "hold" | "zoom" | "drag" | "throw" | "rebound" | "page" | "chrome" | "pull" | "fly" | "closed";
type Pt = { x: number; y: number };
type State = { page: number; s: number; x: number; y: number; dy: number; chrome: boolean };
type Step = State & { move: Move; ms: number; tap?: Pt; finger: Pt & { down: boolean } };

/** Scripted states, in stage points from the centre: rest, a double tap that zooms about the tap, a pan thrown into the
 *  edge that gives and rebounds, a double tap back to fit, two pages, a tap that hides the chrome and one that brings
 *  it back, then a pull down that commits and slides the print off. The example presents the viewer again. */
const VIEW: Step[] = (() => {
  const steps: Step[] = [];
  let state: State = { page: 0, s: 1, x: 0, y: 0, dy: 0, chrome: true };
  let finger = { x: 0, y: 0, down: false };
  const go = (move: Move, duration: number, change: Partial<State> = {}, cue: { tap?: Pt; finger?: Pt & { down: boolean } } = {}) => {
    state = { ...state, ...change };
    finger = cue.finger ?? { ...finger, down: false };
    steps.push({ ...state, move, ms: duration, tap: cue.tap, finger });
  };
  const grab = { x: 60, y: 40 }, letGo = { x: grab.x + PAN.drag.x, y: grab.y + PAN.drag.y };
  const pull = { x: 10, y: 10 };
  go("present", 1300);
  go("zoom", 1000, { s: ZOOM, ...PAN.zoomed }, { tap: PAN.tap });
  go("hold", 160, {}, { finger: { ...grab, down: true } });
  go("drag", PAN.drag.ms, PAN.from, { finger: { ...letGo, down: true } });
  go("throw", PAN.x.near, { x: PAN.peak, y: PAN.dest.y }, { finger: { ...letGo, down: false } });
  go("rebound", 900, { x: PAN.dest.x });
  go("zoom", 1000, { s: 1, x: 0, y: 0 }, { tap: { x: -10, y: 30 } });
  go("page", 1150, { page: 1 });
  go("page", 1150, { page: 2 });
  go("chrome", 800, { chrome: false }, { tap: { x: 20, y: 40 } });
  go("chrome", 950, { chrome: true }, { tap: { x: 20, y: 40 } });
  go("hold", 160, {}, { finger: { ...pull, down: true } });
  go("pull", PULL.ms, { dy: PULL.dy }, { finger: { x: pull.x, y: pull.y + PULL.dy, down: true } });
  go("fly", 450, { dy: PULL.end }, { finger: { x: pull.x, y: pull.y + PULL.dy, down: false } });
  go("closed", 650);
  return steps;
})();

const stageX = (x: number) => `${50 + (x / STAGE.w) * 100}%`, stageY = (y: number) => `${50 + (y / STAGE.h) * 100}%`;

export function PhotoViewerPreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    const id = window.setTimeout(() => setI((i + 1) % VIEW.length), VIEW[i].ms);
    return () => clearTimeout(id);
  }, [i]);
  const st = VIEW[i], m = st.move, zoomed = st.s > 1;
  const open = m !== "closed", gone = m === "fly" || m === "closed";
  const progress = gone ? 1 : Math.min(1, st.dy / 140);
  // Every move names its curve: a touch moves the print on the finger's path, a release carries the finger's speed,
  // a double tap zooms in with a little give and back out on `value` with none, since a dip below fit would show the
  // backdrop, and the scrim and chrome go and come back with the photo.
  const zoomOut = m === "zoom" && !zoomed;
  const pageT = m === "present" ? "none" : t("transform", "snap");
  const xT = m === "present" ? "none" : m === "drag" ? `transform ${PAN.drag.ms}ms ${FLICK}` : m === "throw" ? `transform ${PAN.x.ms}ms ${PAN.x.easing}` : m === "rebound" ? t("transform", "rebound") : t("transform", zoomOut ? "value" : "morph");
  const fly = `${PULL.fly.ms}ms ${PULL.fly.easing}`;
  const yT = m === "present" ? t("opacity", "reveal")
    : m === "drag" ? `transform ${PAN.drag.ms}ms ${FLICK}`
    : m === "throw" || m === "rebound" ? `transform ${PAN.y.ms}ms ${PAN.y.easing}`
    : m === "pull" ? `transform ${PULL.ms}ms ${FLICK}`
    : gone ? `transform ${fly}, opacity ${fly}`
    : t("transform", zoomOut ? "value" : "morph");
  const scrimT = m === "pull" ? `opacity ${PULL.ms}ms ${FLICK}` : m === "fly" ? `opacity ${fly}` : m === "closed" ? t("opacity", "dismiss") : t("opacity", "reveal");
  // A pull fades the chrome out by a third of the way to the commit point. A tap snaps it into place with a slight
  // give and takes it out quickly; presenting fades it in with the viewer.
  const chromeT = m === "pull" ? `opacity ${Math.round(PULL.ms * 0.75)}ms ${FLICK}` : t(["opacity", "transform"], st.chrome ? (m === "chrome" ? "snap" : "reveal") : "dismiss");
  const label = zoomed ? `${st.s.toFixed(1)}×` : `${st.page + 1} / ${PRINTS.length}`;
  // The digits roll on `value`, never past what they say, and always the same way, as `.numericText()` does.
  const roll = m === "present" ? "none" : `cm-roll-up ${ms("value")}ms ${curve("value").easing} both`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      <style>{KEYFRAMES}</style>
      {/* Viewer */}
      <div data-motion className="absolute inset-0" style={{ background: ground.bg, opacity: open ? 1 - progress * 0.92 : 0, transition: scrimT }} />
      <div className="absolute inset-0" style={{ visibility: open ? "visible" : "hidden" }}>
        {PRINTS.map((_, k) => {
          const here = k === st.page;
          return (
            <div key={k} data-motion className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateX(${(k - st.page) * 100}%)`, transition: pageT }}>
              {/* Each axis on its own layer, so a release can carry the finger's speed along each separately. */}
              <div data-motion style={{ transform: here ? `translateX(${p(st.x)})` : "none", transition: xT }}>
                <div data-motion style={{ transform: here ? `translateY(${p(st.y + st.dy)}) scale(${st.s * (1 - 0.2 * Math.min(1, st.dy / 140))})` : "none", opacity: gone ? 0 : 1, transition: yT }}>
                  <Print i={k} w={PW} />
                </div>
              </div>
            </div>
          );
        })}
        {st.tap ? <span key={i} data-motion aria-hidden className="absolute rounded-full" style={{ left: stageX(st.tap.x), top: stageY(st.tap.y), width: p(44), height: p(44), marginLeft: p(-22), marginTop: p(-22), background: "rgba(255,255,255,.45)", opacity: 0, animation: "cm-tap .5s ease-out both" }} /> : null}
        {/* The finger that pans and pulls: it rides with the print while down and lifts where it let go. */}
        <span data-motion aria-hidden className="pointer-events-none absolute rounded-full" style={{ left: "50%", top: "50%", width: p(44), height: p(44), marginLeft: p(-22), marginTop: p(-22), background: "rgba(255,255,255,.45)", transform: `translate(${p(st.finger.x)}, ${p(st.finger.y)})`, opacity: st.finger.down ? 1 : 0, transition: `${m === "drag" ? `transform ${PAN.drag.ms}ms ${FLICK}, ` : m === "pull" ? `transform ${PULL.ms}ms ${FLICK}, ` : ""}opacity ${st.finger.down ? 120 : 180}ms ease-out` }} />
        {/* Chrome: a liquid glass close button and counter, apart in their corners, in the dark glass the viewer
            draws over its scrim. Zoomed, the counter floods with a paper tint and its digits roll into the readout. */}
        <div data-motion className="absolute inset-x-0 top-0" style={{ ...DARK_GLASS, padding: `${p(16)} ${p(16)}`, opacity: open && st.chrome ? Math.max(0, 1 - progress * 3) : 0, transform: st.chrome ? "none" : `translateY(${p(-12)})`, transition: chromeT }}>
          {/* No lift, as in Swift: the group lifts only in the light appearance, and this glass is the dark one. */}
          <LiquidGroup unit={p(1)} lift={false} appearance="dark">
            <div className="flex items-center justify-between">
              <Liquid className="grid place-items-center" style={{ width: p(44), height: p(44), color: PAPER }}>
                <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(16), height: p(16) }} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </Liquid>
              {/* The glass reshapes into the readout with a little give, its tint flooding in on the same beat. */}
              <Liquid
                tint={zoomed ? PAPER : undefined}
                className="flex items-center"
                style={{ height: p(44), paddingInline: p(16), color: zoomed ? ink : PAPER, fontFamily: font.rounded, fontWeight: 600, fontSize: p(15), fontVariantNumeric: "tabular-nums", transform: zoomed ? "scale(1.04)" : "none", transition: `${t(["background-color", "transform"], "morph")}, ${t("color", "value")}` }}
              >
                <span key={label} data-motion className="inline-block" style={{ animation: roll }}>{label}</span>
              </Liquid>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}

// MARK: Story Strip

const SLIDES = [
  { meta: "SATURDAY MARKET", headline: "Out early for the good peaches", figure: null, fill: blocks.tangerine },
  { meta: "STALLS VISITED", headline: "and one very long queue", figure: "12", fill: blocks.butter },
  { meta: "SPENT", headline: "on bread, figs and flowers", figure: "€18.40", fill: blocks.sage },
  { meta: "NEXT WEEK", headline: "Same time. Bring a bigger bag.", figure: null, fill: blocks.lilac },
];
/** Seconds per segment, as in the Swift demo, and the loop's beats: slide 2 is held for 1.2s (the strip pins 200ms after
 *  the finger lands, so the fill runs on until then), slide 3 is tapped forward early, and the story starts over 0.6s
 *  after it finishes. */
const SEG = 1.8, HOLD = SEG + 0.7, LIFT = HOLD + 1.2, S3 = LIFT + SEG - 0.7, TAP = S3 + 0.8, FINISH = TAP + SEG, LOOP = FINISH + 0.6;
/** How long the tap chevron stays before it drifts off, from StoryStrip.swift. */
const HINT = 0.38;
/** The bars' height: StoryStrip's 3pt default. */
const BAR = 3;
/** The paused badge's home, from its own centre: up on the bars' centre line (half a bar, the 10pt gap, half the 30pt badge). */
const BADGE_HOME: [number, number] = [0, -(BAR / 2 + 10 + 30 / 2)];

/** Script on the clock. The running fill is the clock itself and never animates. A step fills or empties bars on `value`
 *  instead, which never overshoots, so a bar never runs past its track: the tap forward and the restart. */
function story(time: number) {
  const lap = Math.floor(time / LOOP), q = time - lap * LOOP;
  const done = q >= FINISH, cur = q < SEG ? 0 : q < S3 ? 1 : q < TAP ? 2 : 3;
  const fill = cur === 0 ? q / SEG : cur === 1 ? (Math.min(q, HOLD) - SEG + Math.max(0, q - LIFT)) / SEG : cur === 2 ? (q - S3) / SEG : (q - TAP) / SEG;
  const bars = SLIDES.map((_, k) => (done || k < cur ? 1 : k === cur ? Math.min(fill, 1) : 0));
  const left = (since: number) => 1 - springValue(roles.value, since);
  // Starting over empties the full strip, under the clock that has already started the first segment.
  if (lap > 0 && q < SEG) bars.forEach((b, k) => { bars[k] = Math.min(1, b + left(q)); });
  // The tapped bar fills the rest of the way the moment the finger lifts.
  if (q >= TAP) bars[2] = 1 - (1 - (TAP - S3) / SEG) * left(q - TAP);
  const since = q - TAP;
  const hint = since < 0 ? "ready" : since < HINT ? "in" : since < HINT + 0.4 ? "out" : "ready";
  return { cur, bars, held: q >= HOLD && q < LIFT, hint };
}

export function StoryStripPreview() {
  const now = useClock(2.2, 60), s = story(now), slide = SLIDES[s.cur];
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack }}>
      <style>{KEYFRAMES}</style>
      <div data-motion className="relative overflow-hidden" style={{ height: "71cqw", aspectRatio: "330 / 560", borderRadius: p(20), background: slide.fill, color: ink, transition: t("background-color", "value") }}>
        {/* Who posted it and when, lined up with the bars, as in the Swift demo. The trailing end stays clear for the
            Paused badge. */}
        <div className="absolute left-0 top-0 flex items-center" style={{ padding: `${p(12 + BAR + 12)} ${p(12)} 0`, gap: p(8), fontSize: p(15), fontWeight: 600 }}>
          <span className="grid place-items-center rounded-full" style={{ width: p(28), height: p(28), background: ink, color: slide.fill, fontSize: p(11), transition: t("color", "value") }}>MA</span>
          <span>Mara</span>
          <span style={{ opacity: 0.55 }}>2h</span>
        </div>
        {/* The strip itself: the bars, and the paused badge the component buds out of their trailing end. */}
        <div className="absolute inset-x-0 top-0 flex flex-col items-end" style={{ padding: p(12), gap: p(10) }}>
          {/* Pinned, the bars dim at once; they lift with the finger. Over the badge, so it is born under them. */}
          <div data-motion className="relative flex self-stretch" style={{ zIndex: 1, gap: p(4), opacity: s.held ? 0.55 : 1, transition: t("opacity", s.held ? "press" : "release") }}>
            {s.bars.map((b, i) => (
              <span key={i} className="relative flex-1 overflow-hidden rounded-full" style={{ height: p(BAR), background: "rgba(20,20,20,.3)" }}>
                <span data-motion className="absolute inset-0 rounded-full" style={{ background: ink, transform: `translateX(${((b - 1) * 100).toFixed(2)}%)` }} />
              </span>
            ))}
          </div>
          {/* The badge buds down out of the bars on the split spring and rises back into them with no bounce, its label
              gone the moment it turns home and its tint draining. The bars are not glass, so it thins away on the way
              home rather than leaving a bead of glass on the strip. */}
          <div data-motion style={{ opacity: s.held ? 1 : 0, transition: s.held ? "opacity 160ms ease-out" : "opacity 360ms ease-in" }}>
            <LiquidGroup unit={p(1)} lift={false} appearance="dark">
              {/* The bud moves a wrapper, so the glass can drain its tint on the same fade as Swift does. */}
              <div data-motion style={budStyle({ out: s.held, home: BADGE_HOME }, p(1))}>
                <Liquid tint={s.held ? ink : undefined} className="flex items-center" style={{ height: p(30), paddingInline: p(12), color: slide.fill, fontSize: p(14), fontWeight: 600, transition: s.held ? "background-color 160ms ease-out" : "background-color 360ms ease-in" }}>
                  <BudContent out={s.held}>
                    <span className="flex items-center" style={{ gap: p(6) }}>
                      <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(11), height: p(11) }} fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>Paused
                    </span>
                  </BudContent>
                </Liquid>
              </div>
            </LiquidGroup>
          </div>
        </div>
        <div key={s.cur} className="absolute inset-x-0 bottom-0 flex flex-col" style={{ padding: p(24), paddingBottom: p(36), gap: p(10), animation: `cm-fade ${ms("reveal")}ms ${curve("reveal").easing} both` }}>
          <span style={meta}>{slide.meta}</span>
          {slide.figure ? <span style={{ fontSize: p(96), fontWeight: font.numeralWeight, letterSpacing: "-0.04em", lineHeight: 0.95 }}>{slide.figure}</span> : null}
          <span style={{ fontSize: p(slide.figure ? 26 : 34), fontWeight: font.displayWeight, letterSpacing: slide.figure ? "-0.03em" : "-0.035em", lineHeight: 1.04 }}>{slide.headline}</span>
        </div>
        {/* The tap hint, a glass bubble tinted with the strip's ink. It has no glass to bud from, so it rises in on its
            own, following the step with some give and nudging the way the story moved, and drifts on as it fades. */}
        <div data-motion aria-hidden className="absolute" style={{ right: p(24), top: "50%", marginTop: p(-26), opacity: s.hint === "in" ? 1 : 0, transform: s.hint === "in" ? "none" : s.hint === "out" ? `translateX(${p(6)})` : `translateX(${p(-8)}) scale(.7)`, transition: s.hint === "in" ? t(["opacity", "transform"], follow("release", 1)) : s.hint === "out" ? t(["opacity", "transform"], "dismiss") : "none" }}>
          <LiquidGroup unit={p(1)} lift={false} appearance="dark">
            <Liquid tint={ink} className="grid place-items-center" style={{ width: p(52), height: p(52), color: slide.fill }}>
              <svg viewBox="0 0 24 24" style={{ width: p(20), height: p(20) }} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </Liquid>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}
