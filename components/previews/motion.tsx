"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";
import { curve, reduced, rubberBand, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

const meta: CSSProperties = { fontFamily: font.stack, fontSize: "1.7cqw", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" };
const body = (size: number): CSSProperties => ({ fontFamily: font.stack, fontSize: `${size}cqw`, fontWeight: 600, lineHeight: 1.25 });

/** The modifier's numbers in stage units: cqw on the 4:3 stage, where the 330pt card is 42cqw, so 1pt is about 0.127cqw. */
const PT = "0.1273cqw";
const P = (pt: number) => `calc(${PT} * ${pt})`;
const THRESHOLD = 14; // 110pt
const SHRINK = 0.15;
/** Far enough to clear the stage, as the modifier clears its container's diagonal. */
const EXIT = 1.1 * Math.hypot(100, 75);
/** The toss: no bounce, and slow enough that a gentle release still leaves unhurried. */
const FLIGHT: Spring = { duration: 0.45, bounce: 0 };
/** DragToDismiss.homeSpring: between the snap and the elastic settle, about 4.6% overshoot. */
const HOME: Spring = { duration: 0.4, bounce: 0.3 };
/** PieceMotion's settle under Reduce Motion: short, no overshoot. */
const STILL: Spring = { duration: 0.25, bounce: 0 };
const REST = "translate(0cqw, 0cqw) scale(1)";

type Pt = { x: number; y: number };

/** A spring leaving at `v0` (target distances per second), as PieceMotion.settle(velocity:) does; `curve()` always
    starts from rest. `shape` reads the travel through a ramp, for the toss fade. Capped like settle: a hard flick adds give.
    `when(x)` is the ms the travel first reaches `x`, so browsers without `linear()` can still time the fade. */
function launch(s: Spring, v0: number, shape: (x: number) => number = (x) => x) {
  const w = (2 * Math.PI) / s.duration, z = 1 - Math.min(Math.max(s.bounce, 0), 0.99);
  const v = Math.min(Math.max(v0, -1.5 * w), 1.5 * w);
  const wd = w * Math.sqrt(Math.max(1 - z * z, 0));
  const at = (time: number) => (z >= 1
    ? 1 - Math.exp(-w * time) * (1 + (w - v) * time)
    : 1 - Math.exp(-z * w * time) * (Math.cos(wd * time) + ((z * w - v) / wd) * Math.sin(wd * time)));
  let total = 0.05;
  for (let time = 0; time < 3; time += 0.004) if (Math.abs(at(time) - 1) > 0.001) total = time;
  const ms = Math.round(total * 1000);
  const when = (x: number) => { for (let time = 0; time < total; time += 0.004) if (at(time) >= x) return Math.round(time * 1000); return ms; };
  if (typeof CSS === "undefined" || !CSS.supports("transition-timing-function", "linear(0, 1)")) return { easing: curve(s).easing, ms, when, exact: false };
  const steps = 60, points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps, y = shape(i === steps ? 1 : at(p * total));
    points.push(i === 0 || i === steps ? y.toFixed(0) : `${y.toFixed(4)} ${(p * 100).toFixed(2)}%`);
  }
  return { easing: `linear(${points.join(", ")})`, ms, when, exact: true };
}

/** The finger's own path, on a clock: it starts from rest, and a flick is still accelerating when it lets go. */
const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);
const steady = (p: number) => p;
const flick = (p: number) => p * p;

/** The hint's height in points: a round close bubble, and the pill that buds out of it. */
const HINT_H = 40;
const HINT_TEXT = "Release to close";

/**
 * The modifier's glass hint, at the top of the stage where it stays while the card travels. The close bubble drops in
 * once the drag is a third of the way to the threshold; the moment it arms, the pill buds out of the bubble, born
 * inside it as a small round bubble and widening to its words as it springs out to rest a neck away. The pair stays
 * centred. The whole group fades, since the goo would snap a half-faded shape on or off.
 */
function Hint({ shown, out, still }: { shown: boolean; out: boolean; still: boolean }) {
  const sizer = useRef<HTMLSpanElement>(null), unit = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(150);
  useLayoutEffect(() => {
    const read = () => {
      const point = (unit.current?.offsetWidth ?? 0) / 100, text = sizer.current?.offsetWidth ?? 0;
      if (point > 0 && text > 0) setWidth(text / point + HINT_H * 0.8);
    };
    read();
    document.fonts?.ready.then(read);
    const ro = new ResizeObserver(read);
    if (sizer.current) ro.observe(sizer.current);
    return () => ro.disconnect();
  }, []);
  const font15: CSSProperties = { fontFamily: font.stack, fontSize: P(15), fontWeight: 600 };
  const wide = out || still;
  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: P(12) }} aria-hidden>
      <span ref={unit} className="absolute" style={{ width: P(100), visibility: "hidden" }} />
      <span ref={sizer} className="absolute whitespace-nowrap" style={{ ...font15, visibility: "hidden" }}>{HINT_TEXT}</span>
      <div data-motion style={{ opacity: shown ? 1 : 0, transform: `translateY(${shown ? "0px" : P(-12)})`, transition: t(["opacity", "transform"], shown ? "reveal" : "dismiss") }}>
        <LiquidGroup unit={PT}>
          <div data-motion className="relative" style={{ width: P(HINT_H), height: P(HINT_H), transform: `translateX(${out ? P(-(width + liquid.joined) / 2) : "0px"})`, transition: t("transform", out ? liquid.split : liquid.home) }}>
            {/* Before the bubble, so at home the pill sits under it. */}
            <span className="absolute left-0 top-0">
              <Liquid bud={{ out, rest: [HINT_H + liquid.joined, 0], home: [0, 0] }} className="flex">
                <span data-motion className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{ ...font15, width: P(wide ? width : HINT_H), height: P(HINT_H), color: ground.text, transition: t("width", out ? liquid.split : liquid.home) }}>
                  <BudContent out={out}>{HINT_TEXT}</BudContent>
                </span>
              </Liquid>
            </span>
            <Liquid className="relative grid place-items-center" style={{ width: P(HINT_H), height: P(HINT_H), color: ground.text }}>
              <svg viewBox="0 0 24 24" style={{ width: P(15), height: P(15) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}

/** DragToDismiss is a modifier, so the preview is the single card it moves. The card tracks a scripted finger 1:1,
    shrinking toward the point it was grabbed while the modifier's own scrim thins with it. Let go short and it springs
    home at the finger's speed; dragged past the threshold it gives 2% as it arms and keeps lifting against rubber-band
    resistance, then a flick tosses it off at the flick's speed, solid until late in the flight. The modifier's glass
    hint drops in at the top as the drag gets going and buds its pill as it arms. Under Reduce Motion nothing travels:
    the scrim still thins with the drag, the card dims as it arms and fades where it is. */
export function DragToDismissPreview() {
  const scrimRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const giveRef = useRef<HTMLDivElement>(null);
  // The hint's state lives here, above its LiquidGroup; the scripted finger below sets it as the drag crosses a third
  // of the threshold and the threshold itself.
  const [hint, setHint] = useState({ shown: false, out: false });
  const [still, setStill] = useState(false);

  useEffect(() => {
    const scrim = scrimRef.current, mover = moverRef.current, give = giveRef.current;
    if (!scrim || !mover || !give) return;
    const still = reduced();
    setStill(still);
    let live = true, timer = 0, raf = 0, armed = false, hinted = false, hideTimer = 0;
    /** The close bubble shows past a third of the threshold, and the pill buds while armed, as the modifier's hint. */
    const showHint = (on: boolean) => {
      if (on === hinted) return;
      hinted = on;
      clearTimeout(hideTimer);
      if (on) { setHint((h) => ({ ...h, shown: true })); return; }
      // The pill melts home first, so the bubble never lifts away with it still out.
      setHint((h) => ({ ...h, out: false }));
      hideTimer = window.setTimeout(() => setHint((h) => (hinted ? h : { ...h, shown: false })), armed ? 520 : 0);
    };
    /** How far past its end the finger's last frame landed (ms); a release starts that far into its spring. */
    let late = 0;
    let held: Pt = { x: 0, y: 0 };
    const wait = (n: number) => new Promise<void>((done) => { timer = window.setTimeout(done, n); });

    // Progress, then a little more past the threshold against rubber-band resistance, as the modifier's `lift`.
    const lift = (d: number) => Math.min(1, d / THRESHOLD) + rubberBand(Math.max(d - THRESHOLD, 0), THRESHOLD * 0.3) / THRESHOLD;
    const pose = ({ x, y }: Pt) => (still ? REST : `translate(${x.toFixed(3)}cqw, ${y.toFixed(3)}cqw) scale(${(1 - SHRINK * lift(Math.hypot(x, y))).toFixed(4)})`);
    const scrimAt = ({ x, y }: Pt) => String(0.5 * (1 - Math.min(1, Math.hypot(x, y) / THRESHOLD)));
    // The give arrives on the snap spring, on the beat the haptic tick would. Under Reduce Motion it dims instead.
    const giveRest = still ? t("opacity", STILL) : t("transform", "snap");
    give.style.transition = giveRest;
    const arm = (on: boolean) => {
      if (on === armed) return;
      armed = on;
      setHint((h) => ({ ...h, out: on }));
      if (still) give.style.opacity = on ? "0.85" : "1";
      else give.style.transform = on ? "scale(0.98)" : "none";
    };

    /** Every grab shrinks toward its own point (stage %), so that point stays under the finger. */
    const grab = (ox: number, oy: number) => {
      mover.style.transformOrigin = give.style.transformOrigin = `${ox}% ${oy}%`;
      mover.style.transition = scrim.style.transition = "none";
    };

    /** Moves the finger to `to` over `dur` ms with no animation on the card, and resolves with the speed it leaves at. */
    const drag = (to: Pt, dur: number, ease: (p: number) => number) => new Promise<Pt>((done) => {
      const from = held, start = performance.now();
      const tick = (now: number) => {
        const e = ease(Math.min((now - start) / dur, 1));
        held = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        mover.style.transform = pose(held);
        scrim.style.opacity = scrimAt(held);
        showHint(Math.hypot(held.x, held.y) > THRESHOLD * 0.3);
        arm(Math.hypot(held.x, held.y) > THRESHOLD);
        if (now - start < dur) { raf = requestAnimationFrame(tick); return; }
        late = Math.min(now - start - dur, 50);
        const rate = ((ease(1) - ease(0.999)) / 0.001) * (1000 / dur);
        done({ x: (to.x - from.x) * rate, y: (to.y - from.y) * rate });
      };
      raf = requestAnimationFrame(tick);
    });

    /** Short of the threshold: home on the modifier's home spring, between snap and settle, leaving at the finger's speed. */
    const letGo = (velocity: Pt) => {
      showHint(false);
      // Resolve the finger's last pose first, so the spring starts from it instead of repeating the frame before,
      // and start the spring as far in as that frame ran past the release, so the hand-off keeps its pace.
      void mover.offsetWidth;
      const d2 = Math.max(held.x * held.x + held.y * held.y, 0.01);
      const home = still ? curve(STILL) : launch(HOME, -(velocity.x * held.x + velocity.y * held.y) / d2);
      const lag = `${-Math.round(late)}ms`;
      mover.style.transition = `transform ${home.ms}ms ${home.easing} ${lag}`;
      scrim.style.transition = `opacity ${home.ms}ms ${home.easing} ${lag}`;
      held = { x: 0, y: 0 };
      mover.style.transform = pose(held);
      scrim.style.opacity = scrimAt(held);
      return home.ms;
    };

    /** Past it: tossed along the flick at the flick's speed, solid until 55% of the flight and gone by 90%. */
    const commit = (velocity: Pt) => {
      showHint(false);
      void mover.offsetWidth;
      if (still) {
        // The modifier's Reduce Motion commit: PieceMotion.dismiss's quick ease-in fade, where the card is.
        mover.style.transition = "opacity 180ms ease-in";
        mover.style.opacity = "0";
        return;
      }
      const speed = Math.hypot(velocity.x, velocity.y);
      const dir = speed > 5 ? velocity : held, length = Math.max(Math.hypot(dir.x, dir.y), 0.01);
      const unit = { x: dir.x / length, y: dir.y / length };
      const along = Math.max(velocity.x * unit.x + velocity.y * unit.y, 0) / EXIT;
      const travel = launch(FLIGHT, along);
      // The fade reads the travel through a ramp; without `linear()` it runs between the times the travel crosses 55% and 90%.
      const lag = Math.round(late), solid = travel.when(0.55);
      const fade = travel.exact
        ? `opacity ${travel.ms}ms ${launch(FLIGHT, along, (x) => Math.min(Math.max((x - 0.55) / 0.35, 0), 1)).easing} ${-lag}ms`
        : `opacity ${Math.max(travel.when(0.9) - solid, 1)}ms linear ${solid - lag}ms`;
      mover.style.transition = `transform ${travel.ms}ms ${travel.easing} ${-lag}ms, ${fade}`;
      held = { x: held.x + unit.x * EXIT, y: held.y + unit.y * EXIT };
      mover.style.transform = pose(held);
      mover.style.opacity = "0";
    };

    /** The example shows the card again where it started, fading in with its scrim. */
    const reappear = () => {
      mover.style.transition = give.style.transition = "none";
      held = { x: 0, y: 0 };
      mover.style.transform = pose(held);
      armed = false;
      setHint({ shown: false, out: false });
      give.style.transform = "none";
      give.style.opacity = "1";
      void mover.offsetWidth;
      give.style.transition = giveRest;
      mover.style.transition = t("opacity", "reveal");
      scrim.style.transition = t("opacity", "reveal");
      mover.style.opacity = "1";
      scrim.style.opacity = "0.5";
    };

    (async () => {
      while (live) {
        await wait(1400);
        // A short pull, grabbed low on the right, that the finger lets go of before it arms.
        if (!live) return;
        grab(58, 69);
        await drag({ x: 3, y: 8.5 }, 720, easeInOut);
        if (!live) return;
        const release = await drag({ x: 3.3, y: 9.1 }, 240, steady);
        if (!live) return;
        await wait(letGo(release) + 600);
        // A long pull from a new grab point: it arms past the threshold, keeps lifting, then is flicked away.
        if (!live) return;
        grab(40, 36);
        await drag({ x: -4, y: 15.5 }, 780, easeInOut);
        if (!live) return;
        await drag({ x: -4.7, y: 17.9 }, 520, steady);
        if (!live) return;
        const flung = await drag({ x: -8.7, y: 31.3 }, 100, flick);
        if (!live) return;
        commit(flung);
        // onDismiss lands when the flight is logically complete; the example waits 0.9s, then shows the card again.
        await wait(450 + 900);
        if (!live) return;
        reappear();
      }
    })();

    return () => { live = false; clearTimeout(timer); clearTimeout(hideTimer); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack }}>
      {/* The scrim the modifier itself draws, thinning as the card travels. */}
      <div ref={scrimRef} data-motion className="pointer-events-none absolute inset-0" style={{ background: ink, opacity: 0.5 }} />
      <div ref={moverRef} data-motion className="absolute inset-0" style={{ transform: REST, opacity: 1 }}>
        {/* The arming give, on its own layer so it springs while the finger's part stays unanimated. */}
        <div ref={giveRef} data-motion className="absolute inset-0 flex items-center justify-center" style={{ transition: t("transform", "snap") }}>
          <div className="flex flex-col" style={{ width: "42cqw", padding: "3.4cqw", borderRadius: "5.6cqw", background: blocks.butter, color: ink, boxShadow: "0 3cqw 7cqw rgba(0,0,0,.4)" }}>
            <div className="flex items-center justify-between">
              <span style={meta}>Boarding pass</span>
              <span className="rounded-full" style={{ ...body(1.8), background: blocks.sky, padding: "0.6cqw 1.8cqw" }}>Group 2</span>
            </div>
            <p style={{ fontSize: "7.6cqw", fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 0.95, marginTop: "3.2cqw" }}>SFO<br /><span style={{ opacity: 0.55 }}>to LIS</span></p>
            <div className="flex" style={{ gap: "3.8cqw", marginTop: "3.2cqw" }}>
              {[["Departs", "07:45"], ["Gate", "B12"], ["Seat", "14A"]].map(([k, v]) => (
                <span key={k} className="flex flex-col" style={{ gap: "0.4cqw" }}>
                  <span style={{ ...meta, fontSize: "1.4cqw", opacity: 0.6 }}>{k}</span>
                  <span style={{ fontSize: "4.4cqw", fontWeight: font.numeralWeight, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{v}</span>
                </span>
              ))}
            </div>
            <span className="block" style={{ height: 1.5, background: "rgba(20,20,20,.14)", marginBlock: "2.8cqw" }} />
            <div className="flex items-center justify-between">
              <span><span className="block" style={body(2.3)}>Maya Lindqvist</span><span className="block" style={{ ...body(1.9), opacity: 0.62 }}>Flight SP 208 · Boards 07:10</span></span>
              <svg viewBox="0 0 24 24" style={{ width: "5.4cqw" }} fill="none" stroke={ink} strokeWidth={2.2} aria-hidden><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" /></svg>
            </div>
          </div>
        </div>
      </div>
      <Hint shown={hint.shown} out={hint.out} still={still} />
    </div>
  );
}
