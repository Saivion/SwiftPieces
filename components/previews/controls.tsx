"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, shade, signal } from "./palette";
import { curve, follow, ms, pop, pressScale, reduced, roles, rubberBand, shake, springValue, stretch, t, tiers, type Role, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Controls previews. Each piece is shown on its own, centered on the house ground, with nothing around
 * it: no card, no headings, no invented app UI. Sizes are container units against a 460 px wide stage,
 * so the 330 px grid card and the docs header show the same thing. Rest state first, then the loop.
 * Motion comes from the shared roles in piece-motion.ts, the same springs the Swift pieces use, and the glass
 * from piece-liquid.tsx: each preview has its own point unit, so the necks and rest gaps match the piece.
 */

/** Stage-relative size: `n` px on a 460 px wide stage. */
const u = (n: number) => `${(n / 4.6).toFixed(3)}cqw`;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);
/** A hand dragging the scripted finger. A finger is not a spring, so it eases in and out. */
const hand = "cubic-bezier(0.45, 0, 0.55, 1)";
const handEase = (x: number) => { const v = clamp(x); return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2; };

/** A PieceMotion spring from 0 toward 1, `t` seconds in, leaving at `v0` whole distances per second (0 is from rest).
 *  Scripted releases read it directly, so they carry the speed they had like Swift's `settle(velocity:)`. */
function sprung(s: Spring, t: number, v0 = 0): number {
  if (t <= 0) return 0;
  if (!v0) return springValue(s, t);
  const w = (2 * Math.PI) / s.duration, z = 1 - Math.min(Math.max(s.bounce, 0), 0.99);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + (w - v0) * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w - v0) / wd) * Math.sin(wd * t));
}

/** Walks a scripted sequence of states; each step holds for `ms`, then loops. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms); return () => clearTimeout(t); }, [i, steps]);
  return steps[i];
}

/** Reduce Motion, read after mount so the first render matches the server's. */
function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => setStill(reduced()), []);
  return still;
}

/** Milliseconds into a `loop`-long cycle, redrawn every frame, for loops that run on a clock. */
function useClock(loop: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let id = 0; const t0 = performance.now();
    const tick = () => { setNow(Math.max(0, performance.now() - t0) % loop); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, [loop]);
  return now;
}

const glyphs: Record<string, string> = {
  arrow: "M5 12h14M13 6l6 6-6 6", plus: "M12 5v14M5 12h14", check: "M5 12.5l4.5 4.5L19 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  retry: "M18.6 13.2A6.8 6.8 0 1 1 16.4 7.2M17.2 3.6v3.9h-3.9",
  reset: "M5.4 13.2A6.8 6.8 0 1 0 7.6 7.2M6.8 3.6v3.9h3.9",
  play: "M8.5 5.8v12.4L18.6 12Z", pause: "M8.6 6v12M15.4 6v12",
};
function Glyph({ name, size, width = 2.4, fill = false, style }: { name: string; size: number; width?: number; fill?: boolean; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}><path d={glyphs[name]} /></svg>;
}

/** The house ground with the component centered on it. Nothing else lives here. */
function Stage({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      <div className="relative flex flex-col items-center" style={{ width: width ? u(width) : undefined }}>{children}</div>
    </div>
  );
}

/** A finger: a soft disc that fades in where the scripted touch lands. `dx`/`dy` move it, on `move` when given. */
const Touch = ({ show, x, y, dx = "0px", dy = "0px", move }: { show: boolean; x: string; y: string; dx?: string; dy?: string; move?: string }) => (
  <span aria-hidden data-motion className="pointer-events-none absolute rounded-full" style={{
    left: x, top: y, width: u(40), height: u(40), marginLeft: u(-20), marginTop: u(-20),
    background: "radial-gradient(circle at 40% 36%, rgba(255,255,255,.55), rgba(255,255,255,.18) 64%)",
    opacity: show ? 1 : 0, transform: `translate(${dx}, ${dy})`, transition: [t("opacity", "press"), move].filter(Boolean).join(", "), zIndex: 20,
  }} />
);

/** A glyph or label that blurs in as it arrives, like `motion.swap`: keyed by its value, so a change remounts it. */
const swapIn: CSSProperties = { display: "inline-flex" };

/* ─── Elastic Button ───────────────────────────────────────────────────────────────────────────
   The style itself, on liquid glass. The signal glass button presses toward the finger (the squash leans
   60% of the way to it), deepens after 350ms, then the finger pulls right: the shape stretches along the
   pull and thins across it with rubber-band resistance, and lets go with more give the harder it was
   pulled. Then the lilac glass takes a held tap, from its own lean. Each surface floats on a lift that
   flattens under the finger; the disabled one is clear glass. */

/** One iOS point on this stage: the 56pt button is 58 px tall. */
const EP = 58 / 56;
const PULL = 30, DRAG_MS = 320;
const elasticSteps = [
  { b: -1, p: "idle", pull: 0, ms: 1300 },
  { b: 0, p: "press", pull: 0, ms: 350 }, { b: 0, p: "deep", pull: 0, ms: 380 }, { b: 0, p: "drag", pull: PULL, ms: DRAG_MS + 200 }, { b: 0, p: "release", pull: PULL, ms: 1300 },
  { b: 1, p: "press", pull: 0, ms: 350 }, { b: 1, p: "deep", pull: 0, ms: 400 }, { b: 1, p: "release", pull: 0, ms: 1500 },
] as const;
type ElasticStep = (typeof elasticSteps)[number];

/** How far the surface itself is pulled for a finger `pull` px away: about 15 by the 44 where a press cancels. */
const banded = (pull: number) => rubberBand(pull, 40);

/** The release, as Swift has it: from 0.28 plus half of `bounce` for a tap and all of it for a press pulled to the
 *  edge, so with the default 0.2 a tap lands on the release role and a full pull on the success one. */
function releaseSpring(bounce: number, pull: number): Spring {
  const energy = Math.min(Math.abs(banded(pull)) / 15, 1);
  return { duration: roles.release.duration, bounce: Math.min(0.28 + bounce * (0.5 + 0.5 * energy), 0.6) };
}

function ElasticSurface({ step, mine, squash = 0.96, bounce = 0.2, lean, fill, children, disabled, still }: { step?: ElasticStep; mine?: boolean; squash?: number; bounce?: number; lean?: [number, number]; fill: string; children: ReactNode; disabled?: boolean; still?: boolean }) {
  const p = mine && step ? step.p : "idle";
  const down = p === "press" || p === "deep" || p === "drag";
  const base = still || !down ? 1 : p === "press" ? squash : squash - 0.03;
  // The pull tracks the finger, never through a spring: same duration and curve as the finger's own move.
  const pulled = p === "drag" && !still ? banded(step!.pull) : 0;
  const along = 0.1 * (1 - 1 / (pulled / 12 + 1));
  const shape = stretch(along, 0);
  const transform = `translateX(${u(pulled * 0.5)}) ${shape === "none" ? "matrix(1, 0, 0, 1, 0, 0)" : shape} scale(${base})`;
  // The deepen is still part of the press, so it never bounces under the finger: on the value spring, no overshoot.
  const spring: Role | Spring = p === "press" ? "press" : p === "deep" ? "value" : releaseSpring(bounce, mine && step ? step.pull : 0);
  const move = p === "drag" ? `transform ${DRAG_MS}ms ${hand}` : t("transform", spring);
  // The squash leans toward the finger and keeps that lean through the release, so it re-expands from there.
  const origin = lean ? `${(50 + (lean[0] - 0.5) * 60).toFixed(1)}% ${(50 + (lean[1] - 0.5) * 60).toFixed(1)}%` : "50% 50%";
  // The glass floats on its own lift, which presses flat under the finger. Clear disabled glass has none.
  const lift = disabled ? "none" : down ? `drop-shadow(0 ${u(1)} ${u(3)} ${shade(0.13)})` : `drop-shadow(0 ${u(8)} ${u(16)} ${shade(0.42)})`;
  return (
    <div data-motion className="relative flex-1" style={{ transform, transformOrigin: origin, filter: lift, transition: `${move}, ${t("filter", p === "drag" ? "value" : spring)}` }}>
      <LiquidGroup unit={u(EP)} lift={false}>
        <Liquid tint={disabled ? undefined : fill} className="relative flex items-center justify-center" style={{ height: u(58), fontSize: u(17), fontWeight: 600, color: disabled ? ground.muted : ink }}>
          {/* The press darkens the glass; the hold deepens it. */}
          <span data-motion className="absolute inset-0 rounded-full" style={{ background: ink, opacity: !down ? 0 : p === "press" ? 0.09 : 0.16, transition: t("opacity", p === "drag" ? "value" : spring) }} />
          <span className="relative flex items-center" style={{ gap: u(9) }}>{children}</span>
        </Liquid>
      </LiquidGroup>
    </div>
  );
}

export function ElasticButtonPreview() {
  const step = useSteps(elasticSteps), still = useStill();
  const touching = step.p === "press" || step.p === "deep" || step.p === "drag";
  return (
    <Stage width={382}>
      <div className="relative flex w-full flex-col" style={{ gap: u(13) }}>
        <div className="relative flex">
          <ElasticSurface step={step} mine={step.b === 0} still={still} lean={[0.64, 0.58]} fill={signal.fill}>Reserve table<Glyph name="arrow" size={18} /></ElasticSurface>
          <Touch show={step.b === 0 && touching} x="64%" y="58%" dx={u(step.b === 0 ? step.pull : 0)} move={step.p === "drag" ? `transform ${DRAG_MS}ms ${hand}` : undefined} />
        </div>
        <div className="relative flex" style={{ gap: u(13) }}>
          <ElasticSurface step={step} mine={step.b === 1} still={still} squash={0.94} bounce={0.3} lean={[0.62, 0.56]} fill={blocks.lilac}><Glyph name="plus" size={17} />Add guest</ElasticSurface>
          <ElasticSurface fill={signal.fill} disabled>Waitlist</ElasticSurface>
          <Touch show={step.b === 1 && touching} x="30%" y="56%" />
        </div>
      </div>
    </Stage>
  );
}

/* ─── Commit Button ────────────────────────────────────────────────────────────────────────────
   The button alone, on liquid glass. Save draws the signal capsule in around its label as a glass bubble
   buds out of its end on a liquid neck, carrying a signal arc that winds up from rest. On success the arc
   coasts shut as the capsule and the bubble turn sage, the check draws and pops, then the bubble melts home
   as the capsule opens and the label morphs into "Saved". The next attempt fails: the capsule opens on
   butter, the label morphs into the message, the bubble turns into a retry and it all shakes. */

const commitSteps = [
  { p: "idle", ms: 1300 }, { p: "press", ms: 150 }, { p: "loading", ms: 1500 }, { p: "closed", ms: 300 }, { p: "check", ms: 560 }, { p: "saved", ms: 1600 },
  { p: "idle", ms: 1100 }, { p: "press", ms: 150 }, { p: "loading", ms: 1300 }, { p: "error", ms: 2100 },
] as const;

/** One iOS point on this stage: the 56pt capsule is 72 px tall. */
const CP = 72 / 56;
const cpt = (n: number) => u(n * CP);
/** The capsule's height and full width, its label's side padding and size, in points. */
const C_H = 56, C_W = 238, C_PAD = 28, C_FONT = 17;
const COMMIT_PRESS = pressScale(C_W * CP, C_H * CP);
/** Degrees turned `t` seconds into a spin from rest: it reaches one turn a second over about half a second. */
const spun = (t: number) => 360 * (t - 0.15 * (1 - Math.exp(-t / 0.15)));
const spinSpeed = (t: number) => 360 * (1 - Math.exp(-t / 0.15));

export function CommitButtonPreview() {
  const { p } = useSteps(commitSteps);
  const shaker = useRef<HTMLDivElement>(null), popper = useRef<HTMLSpanElement>(null), arc = useRef<SVGCircleElement>(null);
  const measure = useRef<HTMLSpanElement>(null), probe = useRef<HTMLSpanElement>(null);
  const spin = useRef({ rest: -90, start: 0, spinning: false, coast: null as null | { t0: number; from: number; to: number; v: number } });
  // The idle label's width in points, so the capsule can draw in around it exactly.
  const [labelWidth, setLabelWidth] = useState(106);
  useLayoutEffect(() => {
    const m = measure.current, pr = probe.current;
    if (m && pr && pr.offsetWidth > 0) setLabelWidth(m.offsetWidth / (pr.offsetWidth / 100));
  }, []);
  const working = p === "loading" || p === "closed" || p === "check";
  const success = p === "closed" || p === "check" || p === "saved";
  const failed = p === "error", pressed = p === "press", landed = p === "check" || p === "saved";
  // The bubble is out while the ring shows and while the error offers the retry.
  const out = working || failed;
  const tint = failed ? blocks.butter : success ? blocks.sage : signal.fill;
  const bubbleTint = !out ? undefined : failed ? blocks.butter : success ? blocks.sage : undefined;
  const slot = out ? C_H + liquid.joined : 0;
  // Working, the capsule draws in around its label; otherwise it fills the width the bubble leaves it.
  const width = working ? labelWidth + C_PAD * 2 : C_W - slot;
  const label = p === "saved" ? "Saved" : failed ? "Couldn't save" : "Save changes";
  const arcInk = success ? ink : signal.fill;

  // The arc turns on its own clock: it spins up from where it rests, and coasts to rest at the speed it was turning.
  useEffect(() => {
    const el = arc.current, s = spin.current, still = reduced();
    if (!el) return;
    if (p === "loading") { s.start = performance.now(); s.spinning = true; s.coast = null; }
    else if (s.spinning) {
      const since = (performance.now() - s.start) / 1000, from = s.rest + (still ? 0 : spun(since)), speed = spinSpeed(since);
      const to = from + speed * 0.099; // where a 0.99 deceleration coasts it, as PieceMotion.project
      s.spinning = false; s.coast = still ? null : { t0: performance.now(), from, to, v: speed / (to - from) }; s.rest = still ? s.rest : to;
    }
    let raf = 0;
    const frame = (now: number) => {
      let angle = s.rest, opacity = 1, more = false;
      if (s.spinning) {
        const since = (now - s.start) / 1000;
        // Under Reduce Motion the arc holds still and breathes instead.
        if (still) opacity = 0.725 + 0.275 * Math.cos((2 * Math.PI * since) / 1.2); else angle = s.rest + spun(since);
        more = true;
      } else if (s.coast) {
        const since = (now - s.coast.t0) / 1000;
        angle = s.coast.from + (s.coast.to - s.coast.from) * sprung(tiers.calm, since, s.coast.v);
        more = since < ms(tiers.calm) / 1000 + 0.1;
        if (!more) { s.coast = null; angle = s.rest; }
      }
      el.style.transform = `rotate(${angle.toFixed(2)}deg)`; el.style.opacity = String(opacity);
      if (more) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [p]);

  // Only the mark pops as the check lands, never the glass.
  useEffect(() => {
    if (p !== "check" || !popper.current || reduced()) return;
    const a = popper.current.animate(...pop());
    return () => a.cancel();
  }, [p]);

  // The capsule opens back out and the bubble turns into the retry, then the shake lands on the error beat.
  useEffect(() => {
    if (!failed || reduced()) return;
    let a: Animation | undefined;
    const id = setTimeout(() => { a = shaker.current?.animate(...shake(u, 10)); }, 140);
    return () => { clearTimeout(id); a?.cancel(); };
  }, [failed]);

  const C = 2 * Math.PI * 10;
  return (
    <Stage>
      <span ref={measure} aria-hidden className="pointer-events-none absolute whitespace-pre" style={{ visibility: "hidden", fontSize: cpt(C_FONT), fontWeight: 600 }}>Save changes</span>
      <span ref={probe} aria-hidden className="pointer-events-none absolute" style={{ visibility: "hidden", width: cpt(100), height: 0 }} />
      <div ref={shaker} data-motion className="flex justify-center" style={{ width: cpt(C_W) }}>
        <div data-motion style={{ transform: pressed ? `scale(${COMMIT_PRESS})` : "none", transition: t("transform", pressed ? "press" : "release") }}>
          <LiquidGroup unit={u(CP)}>
            <div className="flex items-center" style={{ height: cpt(C_H) }}>
              {/* Above the slot, so the bubble melting home slips under the capsule's end. */}
              <Liquid tint={tint} className="relative flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap" style={{
                zIndex: 1, width: cpt(width), height: cpt(C_H), gap: cpt(8), color: ink, fontSize: cpt(C_FONT), fontWeight: 600,
                // Width, tint and label change together and land with the morph spring's small give.
                transition: t(["width", "background-color"], "morph"),
              }}>
                <span data-motion className="absolute inset-0 rounded-full" style={{ background: "#000", opacity: pressed ? 0.1 : 0, transition: t("opacity", pressed ? "press" : "release") }} />
                {p === "saved" ? <span key="check" className="pv-lq-in relative" style={swapIn}><Glyph name="check" size={C_FONT * CP} width={2.8} /></span> : null}
                <MorphText text={label} className="relative" />
              </Liquid>
              {/* The bubble's slot opens as it buds out and closes as it melts home, on the bubble's own spring. */}
              <div className="relative shrink-0" style={{ width: cpt(slot), height: cpt(C_H), transition: t("width", out ? liquid.split : liquid.home) }}>
                <Liquid tint={bubbleTint} bud={{ out, home: [0, 0] }} className="absolute right-0 top-0 grid place-items-center" style={{ width: cpt(C_H), height: cpt(C_H), color: ink, transition: t("background-color", "morph") }}>
                  <BudContent out={out}>
                    {failed ? (
                      <span key="retry" className="pv-lq-in" style={swapIn}><Glyph name="retry" size={18 * CP} width={2.6} /></span>
                    ) : (
                      <span key="ring" ref={popper} data-motion className="grid place-items-center">
                        <svg viewBox="0 0 26 26" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: cpt(C_H * 0.46), height: cpt(C_H * 0.46) }} aria-hidden>
                          <circle data-motion cx="13" cy="13" r="10" stroke={success ? ink : ground.text} opacity={success ? 0.22 : 0.14} style={{ transition: t("stroke", "morph") }} />
                          <circle ref={arc} data-motion cx="13" cy="13" r="10" stroke={arcInk} strokeDasharray={C} style={{
                            strokeDashoffset: success ? 0 : C * 0.72, transformBox: "fill-box", transformOrigin: "center", transform: "rotate(-90deg)",
                            transition: `${t("stroke-dashoffset", success ? "morph" : "dismiss")}, ${t("stroke", "morph")}`,
                          }} />
                          <path data-motion d="M8.4 13.6l3.2 3.2 6-6.6" stroke={ink} pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: landed ? 0 : 1, transition: t("stroke-dashoffset", landed ? "reveal" : "dismiss") }} />
                        </svg>
                      </span>
                    )}
                  </BudContent>
                </Liquid>
              </div>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

/* ─── Hold To Confirm ──────────────────────────────────────────────────────────────────────────
   The capsule alone, on the Swift scene's clock, in clear glass with a signal puck at its start. A short
   hold wells the tint out of the puck and sweeps it through the glass at a steady speed; letting go, it
   carries on for an instant, then drains back without overshoot and sinks into the puck. A full hold swells
   each dot as it passes, then clicks shut: a 2% swell on the success beat, sage without overshoot, and a beat
   later the capsule draws its end in as a sage check bubble buds out of it while the label morphs into
   "Deleted". After 1.4s the check melts home, the confirmed block fades out over the glass and the label
   morphs back. */

/** One iOS point on this stage: the 60pt capsule is 64 px tall. */
const HP = 64 / 60;
const HOLD_H = 64, PUCK = 54, HOLD_MS = 1200, QUARTER = HOLD_MS / 4;
const SHORT_AT = 1000, SHORT_MS = 560, LET_GO = SHORT_AT + SHORT_MS, LONG_AT = LET_GO + 1000, COMMIT_AT = LONG_AT + HOLD_MS;
const RESET_AT = COMMIT_AT + 1400, HOLD_LOOP = 6200;
const SHORT_LEVEL = SHORT_MS / HOLD_MS;
/** The check buds out this long after the click, once the channel has sealed. */
const BEAT = 60;
/** The release: the fill leaves at the sweep's speed, then drains to the puck on the calm timing without overshoot. */
const DRAIN: Spring = { duration: tiers.calm.duration, bounce: 0 };
const DRAIN_V = -(1000 / HOLD_MS) / SHORT_LEVEL;
const drainLevel = (s: number) => Math.max(SHORT_LEVEL * (1 - sprung(DRAIN, s, DRAIN_V)), 0);
/** Milliseconds until the drain's spring is within half a percent of the puck. */
const DRAIN_MS = (() => { let last = 0; for (let s = 0; s < 2; s += 0.004) if (Math.abs(SHORT_LEVEL * (1 - sprung(DRAIN, s, DRAIN_V))) > 0.005) last = s; return Math.round(last * 1000); })();

type HoldState = { level: number; well: boolean; wellRole: Role | null; grow: number; holding: boolean; passed: number; committed: boolean; sealed: boolean; fading: boolean; check: boolean };
const holdRest: HoldState = { level: 0, well: false, wellRole: null, grow: 0, holding: false, passed: 0, committed: false, sealed: false, fading: false, check: false };

function holdAt(n: number): HoldState {
  const clearAt = RESET_AT + ms("dismiss"), sinkAt = LET_GO + DRAIN_MS;
  // The well, as the channel's growth from the puck to the capsule's height: out under the finger on press, back
  // into the puck on dismiss once drained, and emptied at once out of sight after a commit.
  const sunk = clamp(1 - springValue(roles.dismiss, (LONG_AT - sinkAt) / 1000));
  const grow = n < SHORT_AT ? 0 : n < sinkAt ? springValue(roles.press, (n - SHORT_AT) / 1000)
    : n < LONG_AT ? clamp(1 - springValue(roles.dismiss, (n - sinkAt) / 1000))
    : n < clearAt ? sunk + (1 - sunk) * springValue(roles.press, (n - LONG_AT) / 1000) : 0;
  const short = n >= SHORT_AT && n < LET_GO, drainT = n - LET_GO, draining = drainT >= 0 && drainT < DRAIN_MS;
  const long = n >= LONG_AT && n < COMMIT_AT, sealed = n >= COMMIT_AT && n < clearAt;
  const level = short ? (n - SHORT_AT) / HOLD_MS : draining ? drainLevel(drainT / 1000) : long ? (n - LONG_AT) / HOLD_MS : sealed ? 1 : 0;
  const passed = short || draining ? Math.min(Math.floor((Math.min(n, LET_GO) - SHORT_AT) / QUARTER), 3) : long || sealed ? Math.min(Math.floor((n - LONG_AT) / QUARTER), 3) : 0;
  const well = short || draining || (n >= LONG_AT && n < clearAt);
  // In under the finger at once, out by sinking into the puck once drained, and cleared out of sight after a commit.
  const wellRole: Role | null = well ? "press" : n >= LET_GO + DRAIN_MS && n < LONG_AT ? "dismiss" : null;
  return {
    level, well, wellRole, grow, holding: short || long, passed, committed: n >= COMMIT_AT && n < RESET_AT, sealed, fading: n >= RESET_AT && n < clearAt,
    check: n >= COMMIT_AT + BEAT && n < RESET_AT,
  };
}

/** The title, centred in the space after the puck, morphing letter by letter to the committed title and back. */
function HoldTitle({ text, color }: { text: string; color: string }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap" style={{ paddingInline: u(PUCK + 5), color, fontSize: u(18), fontWeight: 600 }}>
      <MorphText text={text} />
    </span>
  );
}

/** Three dots at 25, 50 and 75%. The set on the fill swells as the hold passes each one, like a detent: decoration
 *  paired with the tick, so it pops with elastic give. Each loses it at once, out of sight behind the edge: a transition
 *  running under the shrinking cut would make the browser raster the cut in stale tiles. Reduce Motion: no swell. */
function HoldDots({ color, on, hidden, hideRole, still }: { color: string; on: (i: number) => boolean; hidden: boolean; hideRole: Role | null; still?: boolean }) {
  return (
    <span data-motion className="absolute inset-0" style={{ opacity: hidden ? 0 : 1, transition: hideRole ? t("opacity", hideRole) : "none" }}>
      {[1, 2, 3].map((i) => (
        <span key={i} data-motion className="absolute rounded-full" style={{ left: `calc(${u(HOLD_H)} + (100% - ${u(HOLD_H)}) * ${i / 4})`, bottom: u(8), width: u(6), height: u(6), marginLeft: u(-3), background: color, transform: on(i) && !still ? "scale(1.6)" : "scale(1)", transition: on(i) ? t("transform", "settle") : "none" }} />
      ))}
    </span>
  );
}

function HoldCapsule({ title, icon, done, fill, s, disabled, still }: { title: string; icon: string; done?: string; fill: string; s: HoldState; disabled?: boolean; still?: boolean }) {
  const popper = useRef<HTMLDivElement>(null);
  // The channel clicks shut: a 2% swell on the success beat, at most, since this guards destructive actions.
  useEffect(() => {
    if (!s.committed || !popper.current || reduced()) return;
    const a = popper.current.animate(...pop(0.02));
    return () => a.cancel();
  }, [s.committed]);
  const tone = s.sealed ? blocks.sage : fill;
  // At rest the channel is exactly the puck; it wells out to the capsule's height. Under Reduce Motion it fades in
  // and out over the puck instead.
  const r = PUCK / HOLD_H;
  const g = still ? 1 : r + (1 - r) * s.grow;
  const shown = (still ? (s.well ? 1 : 0) : 1) * (s.fading ? 0 : 1);
  // The channel, a capsule from the leading edge to `level`, scaled by `g` about the puck's center. Only the cut
  // scales: the fill and its ink copy stay full size under it, so the well never shows a miniature puck.
  // Its exact corner radius, half its height: a huge radius scaled down on a tiny cut rasterizes in blocks.
  const rim = u((HOLD_H / 2) * (1 - g));
  const clip = `inset(${rim} calc(100% - ${u((HOLD_H / 2) * (1 - g) + HOLD_H * g)} - (100% - ${u(HOLD_H)}) * ${(s.level * g).toFixed(4)}) ${rim} ${rim} round ${u((HOLD_H / 2) * g)})`;
  const text = s.committed ? done ?? "" : title;
  // The check's slot at the capsule's end: open while it is out, on the bud's springs.
  const slot = s.check ? HOLD_H + liquid.joined * HP : 0;
  const budSpring = s.check ? liquid.split : liquid.home;
  return (
    <div data-motion className="relative w-full" style={{ opacity: disabled ? 0.5 : 1, filter: disabled ? "saturate(0)" : "none", transform: s.holding && !still ? "scale(0.98)" : "none", transition: t("transform", s.holding ? "press" : "release") }}>
      <div ref={popper} data-motion className="w-full">
        <LiquidGroup unit={u(HP)} className="w-full">
          <div className="flex w-full items-center">
            {/* Above the slot, so the check melting home slips under the capsule's end. */}
            <Liquid className="relative shrink-0 overflow-hidden" style={{ zIndex: 1, height: u(HOLD_H), width: `calc(100% - ${u(slot)})`, transition: t("width", budSpring) }}>
              <HoldDots color={`color-mix(in srgb, ${ground.text} 28%, transparent)`} on={() => false} hidden={s.committed} hideRole={s.committed ? "value" : "dismiss"} />
              <HoldTitle text={text} color={ground.text} />
              {/* The puck: where the liquid starts and drains back to. It stays under the fill, so the confirmed
                  block fades out over it rather than taking it along. */}
              <span className="absolute grid place-items-center rounded-full" style={{ left: u(5), top: u(5), width: u(PUCK), height: u(PUCK), background: fill, color: ink }}><Glyph name={icon} size={22} width={2.4} /></span>
              <div data-motion className="absolute inset-0" style={{
                opacity: shown, transition: s.fading ? t("opacity", "dismiss") : still && s.wellRole ? t("opacity", s.wellRole) : "none",
              }}>
                {/* The fill and an ink copy of everything on it, cut to the channel, so they invert exactly under its edge. */}
                <div data-motion className="absolute inset-0" style={{ clipPath: clip, background: tone, transition: s.sealed ? t("background-color", "value") : "none" }}>
                  <HoldDots color={`color-mix(in srgb, ${ink} 60%, transparent)`} on={(i) => s.passed >= i && s.level >= i / 4} hidden={s.sealed} hideRole={s.sealed ? "value" : null} still={still} />
                  <HoldTitle text={text} color={ink} />
                  <span className="absolute grid place-items-center" style={{ left: u(5), top: u(5), width: u(PUCK), height: u(PUCK), color: ink }}><Glyph name={icon} size={22} width={2.4} /></span>
                </div>
              </div>
            </Liquid>
            <div className="relative shrink-0" style={{ width: u(slot), height: u(HOLD_H), transition: t("width", budSpring) }}>
              <Liquid tint={s.check ? blocks.sage : undefined} bud={{ out: s.check, home: [0, 0] }} className="absolute right-0 top-0 grid place-items-center" style={{ width: u(HOLD_H), height: u(HOLD_H), color: ink, transition: t("background-color", "morph") }}>
                <BudContent out={s.check}><Glyph name="check" size={22} width={2.6} /></BudContent>
              </Liquid>
            </div>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}

export function HoldToConfirmPreview() {
  const now = useClock(HOLD_LOOP), still = useStill();
  const s = holdAt(now);
  return (
    <Stage width={382}>
      <div className="relative flex w-full flex-col" style={{ gap: u(13) }}>
        <div className="relative">
          <HoldCapsule title="Hold to delete" icon="trash" s={s} still={still} fill={signal.fill} done="Deleted" />
          <Touch show={s.holding} x={u(34)} y="62%" />
        </div>
        <HoldCapsule title="Hold to transfer" icon="arrow" s={holdRest} still={still} fill={blocks.butter} disabled />
      </div>
    </Stage>
  );
}

/* ─── Fan Stack ────────────────────────────────────────────────────────────────────────────────
   The stack alone, centered, in liquid glass. Collapsed, the avatars overlap and their glass melts into one
   shape, a rim of glass cut between the faces. A finger lands and it sinks; the 300ms hold fans it open on a
   35ms cascade, pulling the bubbles apart through necks that thin and snap, as the hidden faces bud out of
   the "+2" bubble and it melts into them. The finger scrubs across: the avatar under it lifts with a little
   give, its neighbours rise a little after it, and its name buds out of it in a glass tag joined to it by a
   neck, melting back as the finger moves on. Letting go picks that person: the lift drops at once and the
   fold follows 100ms later, last avatar first, the hidden faces melting home into the "+2" bubble. */

const people = ["Priya Raman", "Jonas Weber", "Amara Diallo", "Leo Brandt", "Sofia Marin"];
const faces = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac];
/** One iOS point on this stage: the 44pt avatars are 50 px. Small enough that the name tag, centred over an end avatar,
 *  still fits inside the stage with room to spare. */
const FP = 50 / 44;
const FACE = 50, RIM = 3 * FP, GAP = liquid.apart * FP, SHOWN = 3, OVERLAP = 0.25;
const OPEN_STEP = FACE + GAP, CLOSED_STEP = FACE * (1 - OVERLAP);
const FAN_W = (people.length - 1) * OPEN_STEP + FACE, CLOSED_W = SHOWN * CLOSED_STEP + FACE;
/** The lifted avatar grows 14% and rises 4pt; its tag rests a neck's width above it. */
const LIFT = 0.14, RISE = 4 * FP, TAG_H = 26 * FP;
const TAG_ROOM = (4 + 44 * LIFT / 2 + liquid.joined + 26) * FP;
/** 35ms per avatar, tightened for big groups so the whole cascade stays within 200ms. */
const STAGGER = Math.min(35, 200 / (people.length - 1));
/** A pick holds the fold for a beat while the chosen avatar drops back, so the choice reads first. */
const FOLD_BEAT = 100;
const FAN_PRESS = pressScale(CLOSED_W, FACE);
/** The cut between faces rides a registered length, so it can travel on the fan's own spring. */
const cutProperty = "@property --fs-cut{syntax:'<length>';inherits:false;initial-value:0px}";

/** The elastic spring, firmed up for long travel so no avatar swings into its neighbour's merge distance. */
function openSpring(i: number): Spring {
  const travel = i * OPEN_STEP - Math.min(i, SHOWN) * CLOSED_STEP;
  const allowed = GAP - liquid.merge * FP;
  if (travel <= allowed) return roles.settle;
  // From rest a spring with damping ratio z passes its target by exp(-πz/√(1-z²)) of the travel; bounce is 1 - z.
  const a = -Math.log(allowed / travel) / Math.PI;
  return { duration: roles.settle.duration, bounce: Math.min(roles.settle.bounce, 1 - a / Math.sqrt(1 + a * a)) };
}

/** Where the finger is over avatar `i` of the open fan (halves are between two), in stage px. */
const over = (i: number) => i * OPEN_STEP + FACE / 2;

// The finger lands on the closed stack (stage px, measured on the open fan), holds, then scrubs at a steady hand
// speed: right from Amara across Leo to Sofia, back to Leo, and lets go there.
const fanSteps = [
  { open: false, hover: -1, touch: false, fx: over(2), ms: 1300 },
  { open: false, hover: -1, touch: true, fx: over(2), ms: 300 },
  { open: true, hover: -1, touch: true, fx: over(2), ms: 560 },
  { open: true, hover: 2, touch: true, fx: over(2), ms: 420 },
  { open: true, hover: 2, touch: true, fx: over(2.5), ms: 150 }, { open: true, hover: 3, touch: true, fx: over(3), ms: 150 },
  { open: true, hover: 3, touch: true, fx: over(3), ms: 300 },
  { open: true, hover: 3, touch: true, fx: over(3.5), ms: 150 }, { open: true, hover: 4, touch: true, fx: over(4), ms: 150 },
  { open: true, hover: 4, touch: true, fx: over(4), ms: 300 },
  { open: true, hover: 4, touch: true, fx: over(3.5), ms: 150 }, { open: true, hover: 3, touch: true, fx: over(3), ms: 150 },
  { open: true, hover: 3, touch: true, fx: over(3), ms: 460 },
  { open: false, hover: -1, touch: false, fx: over(3), ms: 1900 },
];

export function FanStackPreview() {
  const { open, hover, touch, fx, ms: stepMs } = useSteps(fanSteps);
  const still = useStill();
  const n = people.length;
  // A step that fans or folds the stack moves the bubbles on the fan's springs; one that only moves the finger
  // lifts them on the lift's. A pick does both, and the lift's firm drop wins, as in Swift.
  const lastOpen = useRef(open), lastHover = useRef(hover);
  const toggled = lastOpen.current !== open, scrubbed = lastHover.current !== hover;
  useEffect(() => { lastOpen.current = open; lastHover.current = hover; });
  // Each tag's width in px, so a tag at home shrinks until it fits inside its avatar.
  const tagMeasure = useRef<HTMLSpanElement>(null);
  const [tagWidths, setTagWidths] = useState<number[]>(() => people.map(() => 120));
  useLayoutEffect(() => {
    const el = tagMeasure.current;
    if (el) setTagWidths(Array.from(el.children).map((c) => (c as HTMLElement).offsetWidth));
  }, []);
  const x = (i: number) => (open ? i : Math.min(i, SHOWN)) * (open ? OPEN_STEP : CLOSED_STEP);
  const order = (i: number) => (open ? i : n - 1 - i);
  const delay = (i: number) => (open ? 0 : FOLD_BEAT) + order(i) * STAGGER;
  // Shown avatars spring apart on the firmed elastic spring and fold quick and firm; hidden ones bud out of the
  // "+2" bubble on the split spring and melt home with no bounce.
  const fanSpring = (i: number): Role | Spring => (i >= SHOWN ? (open ? liquid.split : liquid.home) : open ? openSpring(i) : "dismiss");
  const fan = (props: string | string[], i: number) => t(props, fanSpring(i), delay(i));
  // How high avatar `i` rises: fully under the finger and a little either side, so a scrub rolls along the hand.
  const rise = (i: number) => (!open || hover < 0 ? 0 : i === hover ? 1 : Math.abs(i - hover) === 1 ? 0.3 : 0);
  // The avatar under the finger lifts first with the elastic give a scrub puts in, its neighbours on looser springs
  // after it; the first names take the snap tier so text never wobbles. A pick drops the lift at once, firm.
  const liftSpring = (i: number, spring: Role = "settle"): Role | Spring => (open ? follow(spring, hover < 0 ? 0 : Math.abs(i - hover)) : "press");
  const z = (i: number) => (open && hover === i ? n + 1 : !open && i >= SHOWN ? -1 - i : n - i);
  const homeX = SHOWN * (OPEN_STEP - CLOSED_STEP);
  return (
    <Stage width={FAN_W}>
      <style>{cutProperty}</style>
      <span ref={tagMeasure} aria-hidden className="pointer-events-none absolute flex" style={{ visibility: "hidden" }}>
        {people.map((name) => <span key={name} className="whitespace-nowrap" style={{ paddingInline: u(10 * FP), fontSize: u(13 * FP), fontWeight: 600 }}>{name}</span>)}
      </span>
      <div className="relative w-full" style={{ height: u(TAG_ROOM + FACE + 34) }}>
        {/* The frame moves halfway through the cascade, with the morph's small give opening and firm closing, keeping
            the stack centered. */}
        <div data-motion className="absolute inset-0" style={{ transform: `translateX(${u(open ? 0 : (FAN_W - CLOSED_W) / 2)})`, transition: t("transform", open ? "morph" : "dismiss", (open ? 0 : FOLD_BEAT) + ((n - 1) * STAGGER) / 2) }}>
          {/* The closed stack sinks under the finger, so the hold answers before the fan opens. */}
          <div data-motion className="absolute inset-0" style={{ transform: `scale(${touch && !open ? FAN_PRESS : 1})`, transformOrigin: `${u(CLOSED_W / 2)} ${u(TAG_ROOM + FACE / 2)}`, transition: t("transform", touch && !open ? "press" : "release") }}>
            <LiquidGroup unit={u(FP)} axis="both" className="absolute left-0 top-0" style={{ width: u(FAN_W), height: u(TAG_ROOM + FACE) }}>
              {people.map((name, i) => {
                const hidden = !open && i >= SHOWN, lifted = open && hover === i, r = rise(i), tagOut = lifted;
                const grow = still ? 1 : (1 + LIFT * r) * (hidden ? liquid.homeScale : 1);
                const fit = Math.min(liquid.homeScale, (FACE * 0.6) / Math.max(tagWidths[i], 1));
                // The bite the avatar above takes out of this face, centred on that avatar's bubble.
                const cut = i > 0 ? x(i - 1) - x(i) : 0;
                return (
                  <div key={name} data-motion className="absolute left-0" style={{ top: u(TAG_ROOM), width: u(FACE), height: u(FACE), transform: `translateX(${u(x(i))})`, zIndex: z(i), transition: fan("transform", i) }}>
                    {/* First, so a tag melting home slips under its avatar's face. */}
                    <Liquid className="absolute left-1/2 top-0 flex items-center whitespace-nowrap" style={{
                      height: u(TAG_H), paddingInline: u(10 * FP), fontSize: u(13 * FP), fontWeight: 600, color: ground.text,
                      transform: `translate(-50%, ${u(tagOut || still ? -TAG_ROOM : (FACE - TAG_H) / 2)}) scale(${tagOut || still ? 1 : fit})`,
                      opacity: still && !tagOut ? 0 : 1,
                      transition: still ? t("opacity", tagOut ? "reveal" : "dismiss") : t("transform", tagOut ? liquid.split : liquid.home),
                    }}>
                      <BudContent out={tagOut}>{name}</BudContent>
                    </Liquid>
                    <Liquid className="absolute inset-0 grid place-items-center" style={{
                      transform: `translateY(${u(still ? 0 : -RISE * r)}) scale(${grow})`, opacity: still && hidden ? 0 : 1,
                      transition: toggled && !scrubbed ? fan(["transform", "opacity"], i) : t(["transform", "opacity"], liftSpring(i)),
                    }}>
                      <BudContent out={!hidden}>
                        <span data-motion className="grid place-items-center rounded-full" style={{
                          width: u(FACE - RIM * 2), height: u(FACE - RIM * 2), background: faces[i], color: ink, fontFamily: font.rounded, fontSize: u(17.6 * FP), fontWeight: 600,
                          boxShadow: still && lifted ? `inset 0 0 0 ${u(2 * FP)} ${ground.text}` : undefined,
                          ...(i > 0 ? { "--fs-cut": u(cut), maskImage: `radial-gradient(circle ${u(FACE / 2)} at calc(50% + var(--fs-cut)) 50%, transparent 99%, #000 100%)`, WebkitMaskImage: `radial-gradient(circle ${u(FACE / 2)} at calc(50% + var(--fs-cut)) 50%, transparent 99%, #000 100%)`, transition: fan("--fs-cut", i) } : {}),
                        } as CSSProperties}>{name.split(" ").map((w) => w[0]).join("")}</span>
                      </BudContent>
                    </Liquid>
                  </div>
                );
              })}
              {/* The "+2" bubble: it travels out with the first hidden face and melts into it, and buds back out as
                  the fan folds. */}
              <div data-motion className="absolute left-0" style={{ top: u(TAG_ROOM), width: u(FACE), height: u(FACE), zIndex: 0, transform: `translateX(${u(SHOWN * CLOSED_STEP + (open && !still ? homeX : 0))})`, transition: t("transform", open ? liquid.home : liquid.split, delay(SHOWN)) }}>
                <Liquid className="absolute inset-0 grid place-items-center tabular-nums" style={{
                  color: ground.text, fontFamily: font.rounded, fontSize: u(15.8 * FP), fontWeight: 600,
                  transform: `scale(${open && !still ? liquid.homeScale : 1})`, opacity: still && open ? 0 : 1,
                  transition: t(["transform", "opacity"], open ? liquid.home : liquid.split, delay(SHOWN)),
                }}>
                  <BudContent out={!open}>+{n - SHOWN}</BudContent>
                </Liquid>
              </div>
            </LiquidGroup>
            {/* First names, plain text under the glass. Each arrives once its avatar has nearly landed. */}
            {people.map((name, i) => {
              const lifted = open && hover === i;
              return (
                <div key={name} data-motion className="absolute left-0" style={{ top: u(TAG_ROOM + FACE + 8 * FP), width: u(FACE), transform: `translateX(${u(x(i))})`, transition: fan("transform", i) }}>
                  <span data-motion className="absolute left-1/2 whitespace-nowrap" style={{
                    transform: "translateX(-50%)", fontSize: u(12 * FP), fontWeight: 600, color: lifted ? ground.text : ground.muted, opacity: open ? 1 : 0,
                    transition: `${open && !still ? t("opacity", "reveal", i * STAGGER + 220) : t("opacity", "dismiss")}, ${t("color", liftSpring(i, "snap"))}`,
                  }}>{name.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <Touch show={touch} x={u(0)} y={u(TAG_ROOM + FACE / 2 + 4)} dx={u(fx)} move={touch ? `transform ${stepMs}ms linear` : undefined} />
      </div>
    </Stage>
  );
}

/* ─── Timer Dial ───────────────────────────────────────────────────────────────────────────────
   The dial alone, with its glass start, pause and reset bubbles. A finger lands on the clear glass knob,
   which lifts, and winds it from 45 down to 10: the knob and ring ride the finger while the digits and lit
   ticks move in whole steps. Let go, the knob clicks firm into its detent while its lift drops back with
   elastic give and it seats with a small pop. A tap on start swaps play for pause as reset buds out of it;
   the countdown rolls its digits down each second, beats once a second in the signal warning zone, and
   finishes as a full sage ring springing in under the knob. A tap on reset melts it back home and the dial
   is ready again. Below, the same ring in progress mode. */

/** One digit that rolls to its next value like `.numericText`: in from above as the count goes down, from below as
 *  it goes up, on the value spring, so it never rolls past. Under the finger (`instant`) it changes at once. */
function RollDigit({ char, dir, instant }: { char: string; dir: number; instant: boolean }) {
  const [cell, setCell] = useState({ char, prev: "", n: 0, dir });
  if (cell.char !== char) setCell({ char, prev: instant ? "" : cell.char, n: cell.n + 1, dir });
  const enter = useRef<HTMLSpanElement>(null), leave = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!cell.prev || reduced()) return;
    const { easing, ms: duration } = curve("value"), from = cell.dir < 0 ? -0.55 : 0.55;
    const a = enter.current?.animate([{ transform: `translateY(${from}em)`, opacity: 0, filter: "blur(2px)" }, { transform: "none", opacity: 1, filter: "blur(0px)" }], { duration, easing });
    const b = leave.current?.animate([{ transform: "none", opacity: 1, filter: "blur(0px)" }, { transform: `translateY(${-from}em)`, opacity: 0, filter: "blur(2px)" }], { duration, easing, fill: "forwards" });
    return () => { a?.cancel(); b?.cancel(); };
  }, [cell.n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="relative inline-block">
      <span key={cell.n} ref={enter} className="inline-block">{cell.char}</span>
      {cell.prev ? <span key={`p${cell.n}`} ref={leave} aria-hidden className="absolute inset-0" style={{ opacity: 0 }}>{cell.prev}</span> : null}
    </span>
  );
}

function Roll({ value, instant }: { value: number; instant: boolean }) {
  const [last, setLast] = useState({ value, dir: -1 });
  if (last.value !== value) setLast({ value, dir: value < last.value ? -1 : 1 });
  return <>{String(value).padStart(2, "0").split("").map((ch, i) => <RollDigit key={i} char={ch} dir={last.dir} instant={instant} />)}</>;
}

type DialProps = {
  side: number; lw: number; fraction: number; lit: number; color: string; ticks: boolean; children: ReactNode;
  /** The finger or the clock sets the ring directly; anything else lands on the value spring: the ring is the time. */
  direct?: boolean; finished?: boolean; held?: boolean; settable?: boolean; small?: boolean; breathe?: number;
};

function Dial({ side, lw, fraction, lit, color, ticks, children, direct = false, finished = false, held = false, settable = false, small = false, breathe = 1 }: DialProps) {
  const r = (side - lw) / 2, C = 2 * Math.PI * r, c = side / 2, tr = side / 2 - lw - 8;
  const land = (prop: string) => (direct ? "" : t(prop, "value"));
  const knob = lw + (small ? 4 : 10);
  // Let go on a detent, the knob seats with a small pop, on its own layer so it composes with the lift dropping
  // back. Scale only, so the ring and the value stay true. The script always lets go inside the range.
  const seat = useRef<HTMLDivElement>(null), wasHeld = useRef(held);
  useEffect(() => {
    const was = wasHeld.current;
    wasHeld.current = held;
    if (!was || held || !seat.current || reduced()) return;
    const a = seat.current.animate(...pop());
    return () => a.cancel();
  }, [held]);
  return (
    <div className="relative shrink-0" style={{ width: u(side), height: u(side), transform: `scale(${breathe})` }}>
      <svg viewBox={`0 0 ${side} ${side}`} className="absolute inset-0 overflow-visible" style={{ width: "100%", height: "100%" }} aria-hidden>
        {ticks && Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2, major = i % 5 === 0, len = major ? 8 : 4;
          return <line key={i} x1={c + Math.cos(a) * tr} y1={c + Math.sin(a) * tr} x2={c + Math.cos(a) * (tr - len)} y2={c + Math.sin(a) * (tr - len)} stroke={ground.muted} strokeOpacity={i / 60 < lit ? 0.75 : 0.25} strokeWidth={major ? 2.2 : 1.3} strokeLinecap="round" />;
        })}
        <circle cx={c} cy={c} r={r} fill="none" stroke={ground.raised} strokeWidth={lw} />
        <circle data-motion cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={lw} strokeLinecap="round" strokeDasharray={C} transform={`rotate(-90 ${c} ${c})`} style={{
          strokeDashoffset: C * (1 - fraction), opacity: fraction > 0.0005 ? 1 : 0, transition: [land("stroke-dashoffset"), t("stroke", "morph")].filter(Boolean).join(", "),
        }} />
        {/* The finish: a full sage ring springs in over the track, and leaves quickly. */}
        <circle data-motion cx={c} cy={c} r={r} fill="none" stroke={blocks.sage} strokeWidth={lw} style={{ opacity: finished ? 1 : 0, transform: finished ? "scale(1)" : "scale(0.94)", transformOrigin: `${c}px ${c}px`, transition: t(["opacity", "transform"], finished ? "success" : "dismiss") }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      {/* The knob: a clear glass bubble riding the ring's leading edge, always on it. */}
      <div data-motion className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${fraction * 360}deg)`, transition: land("transform") || "none" }}>
        <div className="absolute left-1/2" style={{ top: u(lw / 2 - knob / 2), width: u(knob), height: u(knob), marginLeft: u(-knob / 2) }}>
          {/* Larger while the dial can be set. */}
          <div data-motion className="h-full w-full" style={{ transform: `scale(${settable || small ? 1 : (lw + 4) / (lw + 10)})`, transition: t("transform", "morph") }}>
            <div ref={seat} data-motion className="h-full w-full">
              {/* Held, it lifts: a little larger again, and drops back with give. */}
              <div data-motion className="h-full w-full" style={{ transform: `scale(${held ? 1.12 : 1})`, transition: t("transform", held ? "press" : "release") }}>
                <Liquid className="h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One iOS point on this stage: the 232pt dial is 184 px across. */
const TP = 184 / 232;
const TOTAL = 10, SET = 45, DOWN = 1400, WIND = 1600, WIND_MS = 1000, UP = WIND + WIND_MS + 160;
const PLAY_AT = UP + 520, START = PLAY_AT + 160, FINISH = START + TOTAL * 1000;
const DIAL_RESET_TAP = FINISH + 1500, DIAL_RESET_AT = DIAL_RESET_TAP + 160, LOOP = DIAL_RESET_AT + 1400;
/** The finger stops just short of the 10s detent, so letting go clicks the knob into it. */
const WIND_TO = 9.3 / 60;
const DIAL = 184, RING = 72, WARN_AT = 5;
/** The start and reset bubbles: 52pt, resting apart, the pair centred under the dial. */
const CTRL = 52 * TP, CTRL_GAP = 20 * TP, HALF = ((52 + liquid.apart) / 2) * TP;

export function TimerDialPreview() {
  const now = useClock(LOOP), still = useStill();
  const held = now >= DOWN && now < UP;
  const turn = now < WIND ? SET / 60 : SET / 60 + (WIND_TO - SET / 60) * handEase((now - WIND) / WIND_MS);
  const set = held ? clamp(Math.round((turn * 60) / 5) * 5, 5, 60) : now < DOWN ? SET : TOTAL;
  const running = now >= START && now < FINISH, finished = now >= FINISH && now < DIAL_RESET_AT;
  const remaining = finished ? 0 : running ? TOTAL - (now - START) / 1000 : set;
  const shown = Math.ceil(remaining - 1e-9), warning = running && shown <= WARN_AT;
  // Reset is out while there is something to reset: running, then done, until it is tapped.
  const resetOut = now >= START && now < DIAL_RESET_AT;
  const pressingPlay = now >= PLAY_AT && now < START, pressingReset = now >= DIAL_RESET_TAP && now < DIAL_RESET_AT;
  // One face throughout, the dial's 60-second one. Held, the ring and knob ride the finger; the value, digits and
  // ticks move in whole steps.
  const value = remaining / 60, fraction = held ? turn : value;
  // The warning beat peaks as the digits change, eases off through the second and rises just before the next. It
  // fades in over the zone's first 0.3s so it never pops on.
  const since = shown - remaining;
  const pulse = since < 0.6 ? (1 - since / 0.6) ** 2 : since > 0.85 ? ((since - 0.85) / 0.15) ** 2 : 0;
  const fade = clamp(Math.min(WARN_AT - remaining, (now - START) / 1000, remaining) / 0.3);
  const breathe = warning && !still ? 1 + 0.012 * pulse * fade : 1;
  const caption = finished ? "DONE" : running ? "REMAINING" : "READY";
  const controlsTop = DIAL + CTRL_GAP;
  return (
    <Stage>
      <div className="relative flex flex-col items-center">
        <Dial side={DIAL} lw={15} fraction={fraction} lit={finished ? 1 : value} color={signal.fill} ticks direct={held || running} finished={finished} held={held} settable={!running} breathe={breathe}>
          <span className="tabular-nums" style={{ fontSize: u(52), fontWeight: font.numeralWeight, letterSpacing: "-0.03em", lineHeight: 1 }}>
            <span style={{ color: ground.muted, opacity: 0.6 }}>0:</span>
            <span style={{ color: warning ? signal.fill : ground.text, transition: t("color", "morph") }}><Roll value={shown} instant={held} /></span>
          </span>
          <MorphText text={caption} style={{ marginTop: u(6), fontSize: u(10.5), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted }} />
        </Dial>
        <Touch show={held} x={u(DIAL / 2)} y={u(DIAL / 2)} dx={u(Math.sin(turn * Math.PI * 2) * (DIAL / 2 - 7.5))} dy={u(-Math.cos(turn * Math.PI * 2) * (DIAL / 2 - 7.5))} />
        <div className="relative" style={{ marginTop: u(CTRL_GAP), width: u(CTRL + HALF * 2), height: u(CTRL) }}>
          <LiquidGroup unit={u(TP)} className="absolute inset-0">
            <div className="relative" style={{ width: u(CTRL + HALF * 2), height: u(CTRL) }}>
              {/* Reset buds out of start while there is something to reset, and melts back once the dial is ready. */}
              <div className="absolute top-0" style={{ left: u(HALF), width: u(CTRL), height: u(CTRL) }}>
                <div data-motion className="h-full w-full" style={{ transform: `scale(${pressingReset ? 1.06 : 1})`, transition: t("transform", pressingReset ? "press" : "release") }}>
                  <Liquid bud={{ out: resetOut, rest: [-HALF / TP, 0], home: [0, 0] }} className="grid h-full w-full place-items-center" style={{ color: ground.text }}>
                    <BudContent out={resetOut}><Glyph name="reset" size={19 * TP} width={2.4} /></BudContent>
                  </Liquid>
                </div>
              </div>
              {/* Last, so reset at home sits under it. It moves aside on reset's own spring, so the pair splits apart
                  and stays centred. */}
              <div data-motion className="absolute top-0" style={{ left: u(HALF), width: u(CTRL), height: u(CTRL), transform: `translateX(${u(resetOut && !still ? HALF : 0)})`, transition: t("transform", resetOut ? liquid.split : liquid.home) }}>
                <div data-motion className="h-full w-full" style={{ transform: `scale(${pressingPlay ? 1.06 : 1})`, transition: t("transform", pressingPlay ? "press" : "release") }}>
                  <Liquid tint={signal.fill} className="grid h-full w-full place-items-center" style={{ color: ink }}>
                    <span key={running ? "pause" : "play"} className="pv-lq-in" style={swapIn}><Glyph name={running ? "pause" : "play"} size={20 * TP} width={running ? 2.8 : 1.6} fill={!running} /></span>
                  </Liquid>
                </div>
              </div>
            </div>
          </LiquidGroup>
        </div>
        <Touch show={pressingPlay} x={`calc(50% + ${u(resetOut ? HALF : 0)})`} y={u(controlsTop + CTRL / 2)} />
        <Touch show={pressingReset} x={`calc(50% - ${u(HALF)})`} y={u(controlsTop + CTRL / 2)} />
        <div style={{ marginTop: u(14) }}>
          <Dial side={RING} lw={7} fraction={0.72} lit={0.72} color={blocks.sky} ticks={false} small>
            <span className="tabular-nums" style={{ fontSize: u(17), fontWeight: font.numeralWeight, lineHeight: 1 }}>72<span style={{ color: ground.muted, opacity: 0.6 }}>%</span></span>
            <span style={{ marginTop: u(2), fontSize: u(6.5), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted }}>UPLOADED</span>
          </Dial>
        </div>
      </div>
    </Stage>
  );
}
