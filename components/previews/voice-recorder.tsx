"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground, ink, signal } from "./palette";
import { curve, pressScale, rubberBand, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Voice Recorder: the hold-to-record button beside a "Message" field, as the Swift piece draws it. The field is a
 * neutral capsule (the only placeholder), the glass mic rests apart from it at the trailing end.
 * The storyboard: rest; the mic dips under a finger, the hold lands: it swells red, a glass capsule buds out of it over
 * the field with the clock and speech bars scrolling toward the leading edge, and the lock lane buds up; the finger
 * slides up, the lane stretches with it, the lock shuts and the lane melts home, the trash buds out of the capsule and
 * the mic becomes the red send button; hands-free for a moment; send dips and everything melts back into the mic;
 * then a second take is held and slid toward the leading edge: the mic follows, the capsule shortens, "Slide to
 * cancel" is eaten and fades, the lane melts away, a bin buds out at the threshold, and on release the capsule
 * gathers into the bin, which tips closed as the field comes back under it, and melts away. Back to rest.
 * Sizes are authored in points against the 560 x 420 docs stage and converted to `cqw`; the control is laid out at a
 * phone's width and scaled up as one picture. There is no finger: the mic's dip, swell and travel are the touch.
 *
 * Motion follows the Swift piece: drags track linearly over each scripted step, the bars scroll linearly with the
 * clock, buds leave on the split spring and come home on the bounceless one, a discard collapses on `dismiss`, the
 * mic springs home on `settle`, presses sink by their size, and glyphs blur from one to the next.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A finger or the clock moving over one scripted step: linear, so the surface keeps pace with it. */
const linear = (props: string[], ms: number) => props.map((p) => `${p} ${Math.round(ms)}ms linear`).join(", ");

// ---------------------------------------------------------------- Storyboard

type Phase = "idle" | "holding" | "locked";
/** Where a bubble is: not there, home inside the shape it comes from, out at rest, or (the bin) melting away. */
type Place = "away" | "home" | "out";

type Step = {
  /** What happens, for people (and the launch video). */
  label: string;
  /** How long the step holds before the next one. */
  ms: number;
  phase: Phase;
  /** Which take's bars show (each take has its own speech), and how many seconds in it is by the end of the step. */
  take: 1 | 2;
  t: number;
  /** The seconds the clock reads during the step. */
  clock: number;
  /** The capsule: home melting into the mic, out over the field, or gathered into the bin (`trash`). */
  capsule: Place | "trash";
  lane: Place;
  trash: Place | "melt";
  /** The bin melts into the mic with the capsule on send, rather than into the capsule's end. */
  trashToMic?: boolean;
  shut?: boolean;
  /** How far the lock lane is stretched up, and how far the mic has travelled toward the leading edge, in points. */
  stretch: number;
  slide: number;
  /** How the drag values get here: tracking a finger, or springing home from where it let go. */
  move?: "track" | "spring";
  /** The mic (or send) dips under the finger. */
  press?: boolean;
  tip?: boolean;
  /** The take has ended: the bars stop. */
  frozen?: boolean;
};

const REACH = 110; // the discard threshold, in points
const LOCK = 56; // how far up the lane locks

const STORY: readonly Step[] = (() => {
  const out: Step[] = [];
  let s: Step = { label: "", ms: 0, phase: "idle", take: 1, t: 0, clock: 0, capsule: "away", lane: "away", trash: "away", stretch: 0, slide: 0 };
  const push = (patch: Partial<Step>) => {
    s = { ...s, move: undefined, press: undefined, tip: undefined, ...patch };
    out.push(s);
  };
  /** Recording up to `to` seconds, cut at whole seconds so the clock ticks with the bars. */
  const rec = (to: number, label: string, patch: Partial<Step> = {}) => {
    while (s.t < to - 1e-6) {
      const next = Math.min(Math.floor(s.t + 1e-6) + 1, to);
      push({ label, ms: (next - s.t) * 1000, t: next, clock: Math.floor(s.t + 1e-6), ...patch });
    }
  };
  /** A finger moving over `ms`, in short linear legs, while the take records. */
  const track = (ms: number, label: string, at: (f: number) => Partial<Step>) => {
    const legs = Math.max(1, Math.round(ms / 70));
    for (let i = 1; i <= legs; i++) push({ label, ms: ms / legs, t: s.t + ms / legs / 1000, clock: Math.floor(s.t + 1e-6), move: "track", ...at(i / legs) });
  };

  push({ label: "Rest: the field, and the glass mic apart from it", ms: 1500 });
  push({ label: "A finger lands on the mic: it dips", ms: 180, press: true });
  rec(2, "The hold lands: the mic swells red, the capsule buds out over the field, the lock lane buds up; the clock counts and the bars scroll", { phase: "holding", take: 1, capsule: "out", lane: "out" });
  track(600, "The finger slides up: the lane stretches with it", (f) => ({ stretch: LOCK * f }));
  push({ label: "At the top the lock shuts", ms: 170, t: s.t + 0.17, clock: Math.floor(s.t + 1e-6), shut: true, trash: "home" });
  rec(4.6, "Hands-free: the lane melts home, the trash buds out of the capsule, the mic turns into the red send button", { phase: "locked", lane: "home", trash: "out", stretch: 0, move: "spring" });
  push({ label: "Send dips under the finger", ms: 140, t: s.t + 0.14, press: true });
  push({ label: "Sent: the capsule melts back into the button, which is the mic again", ms: 900, phase: "idle", capsule: "home", trash: "home", trashToMic: true, frozen: true });
  push({ label: "Rest", ms: 1000, capsule: "away", lane: "away", trash: "away", trashToMic: false, shut: false, take: 2, t: 0, clock: 0, frozen: false });
  push({ label: "A second take: the finger lands", ms: 180, press: true });
  rec(1, "Held for a second", { phase: "holding", take: 2, capsule: "out", lane: "out" });
  track(700, "The finger slides toward the leading edge: the mic follows, the capsule shortens, the hint is eaten and the lane melts away; at the threshold the bin buds out", (f) => {
    const travel = 125 * f;
    return {
      slide: travel <= REACH ? travel : REACH + rubberBand(travel - REACH, 28),
      lane: "home",
      trash: travel >= REACH ? "out" : travel >= REACH - 16 ? "home" : "away",
    };
  });
  push({ label: "Held past the threshold", ms: 260, t: s.t + 0.26 });
  push({ label: "Released: the capsule gathers into the bin and the mic springs home", ms: 380, phase: "idle", capsule: "trash", slide: 0, move: "spring", frozen: true });
  push({ label: "The bin tips closed and the field comes back under it", ms: 440, tip: true });
  push({ label: "The bin melts away", ms: 560, trash: "melt" });
  push({ label: "Back to rest", ms: 900, capsule: "away", lane: "away", trash: "away", take: 1, t: 0, clock: 0, frozen: false });
  return out;
})();

// ---------------------------------------------------------------- Geometry (VoiceRecorder.swift at its defaults)

/** The control at a phone's width, scaled up onto the stage; the room above holds the lane at full stretch. */
const W = 360, SCALE = 1.36, ABOVE = 148;
const SIDE = 52, J = liquid.joined;
const FIELD_W = W - SIDE - liquid.apart;
/** The capsule's trailing edge rests a joined gap from the held, swollen mic. */
const CAP_TRAIL = SIDE * 1.025 + J;
const LANE_W = SIDE * 0.8, LANE_H = SIDE * 1.55;
const SWELL = 1.1;
const MIC_X = W - SIDE / 2;
const BAR = 3, PITCH = 5, BAR_H = SIDE - 20;
/** "‹ Slide to cancel" at 13 points. */
const HINT_W = 118;
const PRE = 50, POST = 60;

/** A repeatable value from 0 to 1 for a whole number (VoiceRecorderSpeech.noise). */
function noise(i: number) {
  let x = Math.imul(i | 0, 0x9e3779b1) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x85ebca77) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return (x % 10000) / 10000;
}
const PHRASES = [[0.12, 1.6, 0.95], [1.95, 3.3, 0.8], [3.7, 4.45, 0.7], [4.85, 6.05, 1]] as const;
/** The simulated source's speech: four phrases of quick syllables with short pauses, every 6.4 seconds. */
function speech(time: number) {
  const local = time % 6.4;
  const grain = noise(Math.floor(time * 20));
  const p = PHRASES.find(([a, b]) => local >= a && local <= b);
  if (!p) return 0.02 + 0.03 * grain;
  const env = Math.min(Math.min((local - p[0]) / 0.12, 1), Math.min((p[1] - local) / 0.15, 1));
  const syllable = Math.abs(Math.sin(Math.PI * 4.4 * time + 1.2 * Math.sin(1.3 * time)));
  return Math.min(Math.max(env * p[2] * (0.35 + 0.65 * syllable) * (0.75 + 0.25 * grain), 0.03), 1);
}
/** One bar a tenth of a second: the loudest moment in it. Before the take, quiet dots. */
const levelAt = (k: number, offset: number) => (k < 0 ? 0 : Math.max(...[0, 0.025, 0.05, 0.075].map((d) => speech(offset + k / 10 + d))));
const TAKES = { 1: 0.4, 2: 3.7 } as const;
const STRIPS = Object.fromEntries(
  ([1, 2] as const).map((take) => [take, Array.from({ length: PRE + POST }, (_, i) => BAR + (BAR_H - BAR) * levelAt(i - PRE, TAKES[take]))]),
) as Record<1 | 2, number[]>;

/** `0:07`, as `Duration.formatted(.time(pattern: .minuteSecond))` writes it. */
const clockText = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

// ---------------------------------------------------------------- Glyphs (the SF Symbols the piece draws)

const glyphs = {
  mic: <><rect x="8.6" y="2.4" width="6.8" height="12.2" rx="3.4" fill="currentColor" stroke="none" /><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.8v3.2M8.6 21h6.8" /></>,
  arrowUp: <path d="M12 19.6V4.8M5.6 11.2 12 4.8l6.4 6.4" />,
  lockOpen: <><rect x="3.6" y="11.2" width="12.4" height="9.8" rx="2.4" fill="currentColor" stroke="none" /><path d="M13 11.2V7.6a3.6 3.6 0 0 1 7.2 0v1.6" /></>,
  lock: <><rect x="5.2" y="11.2" width="13.6" height="9.8" rx="2.4" fill="currentColor" stroke="none" /><path d="M8.2 11.2V8a3.8 3.8 0 0 1 7.6 0v3.2" /></>,
  chevronUp: <path d="M7 14.6 12 9.6l5 5" />,
  chevronLeft: <path d="M14.6 7 9.6 12l5 5" />,
  trash: <path d="M4.4 6.4h15.2M9.4 6.4V4.9c0-.7.5-1.2 1.2-1.2h2.8c.7 0 1.2.5 1.2 1.2v1.5M6.4 6.4l.9 12.3c.1 1 .9 1.7 1.9 1.7h5.6c1 0 1.8-.7 1.9-1.7l.9-12.3M10 10.2v6.6M14 10.2v6.6" />,
} as const;

function Glyph({ name, size, stroke = 2.2, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), display: "block", flexShrink: 0, ...style }}>
      {glyphs[name]}
    </svg>
  );
}

/** Glyphs that blur from one to the next in one place, as `motion.swap` does. */
function Swap({ shown, size, names, stroke }: { shown: keyof typeof glyphs; size: number; names: readonly (keyof typeof glyphs)[]; stroke?: number }) {
  return (
    <span className="grid place-items-center">
      {names.map((name) => (
        <span key={name} data-motion style={{ gridArea: "1 / 1", opacity: shown === name ? 1 : 0, filter: `blur(${shown === name ? 0 : 4}px)`, transition: t(["opacity", "filter"], "snap") }}>
          <Glyph name={name} size={size} stroke={stroke} />
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- Hooks

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

/** Walks the storyboard; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return { step: steps[i], prev: steps[(i + steps.length - 1) % steps.length] };
}

/** The digit roll `.numericText` plays. */
const keyframes = [
  "@keyframes vr-roll{from{transform:translateY(40%);opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}",
  "@keyframes vr-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.86)}}",
  "@keyframes vr-drift-x{0%,100%{transform:none}50%{transform:translateX(var(--vr-drift))}}",
  "@keyframes vr-drift-y{0%,100%{transform:none}50%{transform:translateY(var(--vr-drift))}}",
  "@keyframes vr-tip{0%{transform:rotate(0)}25%{transform:rotate(-16deg)}100%{transform:rotate(0)}}",
  "@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}",
].join("");

/** A number that rolls up to its new value, never past it. */
function Roll({ text }: { text: string }) {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  return <RollFace key={text} roll={mounted.current}>{text}</RollFace>;
}

function RollFace({ roll, children }: { roll: boolean; children: ReactNode }) {
  const [style] = useState(() => {
    const { easing, ms } = curve("value");
    return { display: "inline-block", animation: roll ? `vr-roll ${ms}ms ${easing} both` : undefined } as CSSProperties;
  });
  return <span data-motion style={style}>{children}</span>;
}

// ---------------------------------------------------------------- Preview

export function VoiceRecorderPreview() {
  const { step: s, prev } = useSteps(STORY);
  const recording = s.phase !== "idle";
  const locked = s.phase === "locked";
  const tracking = s.move === "track";
  const trashOut = s.trash === "out";
  // After a discard the field comes back as the bin tips closed, so it is there under the bin while it melts away.
  const covered = recording || s.capsule === "out" || (s.trash === "out" && !s.tip);

  // The capsule: from the leading edge (or the bin's joined gap) to a joined gap before the mic, which it follows.
  const capRight = W - CAP_TRAIL - s.slide;
  const capLeft = trashOut ? SIDE + J : 0;
  const cap = s.capsule === "out"
    ? { left: capLeft, width: capRight - capLeft, scale: 1 }
    : s.capsule === "trash"
      ? { left: 0, width: SIDE, scale: 1 }
      : { left: W - SIDE, width: SIDE, scale: s.capsule === "home" ? liquid.homeScale : 0.001 };
  const capMotion = s.capsule === "away"
    ? "none"
    : tracking
      ? linear(["left", "width"], s.ms)
      : s.capsule === "trash"
        ? t(["left", "width", "transform"], "dismiss")
        : s.capsule === "home"
          ? t(["left", "width", "transform"], liquid.home)
          : s.move === "spring" && prev.slide !== s.slide
            ? t(["left", "width"], "settle")
            : t(["left", "width", "transform"], liquid.split);

  // The lane: a narrow capsule joined above the swollen mic, home a small circle inside it.
  const laneOut = s.lane === "out";
  const laneH = laneOut ? LANE_H + s.stretch : LANE_W;
  const micR = (SIDE / 2) * (s.phase === "holding" ? SWELL : 1);
  const laneTop = laneOut ? ABOVE + SIDE / 2 - micR - J - laneH : ABOVE + SIDE / 2 - LANE_W / 2;
  const laneMotion = s.lane === "away" ? "none" : tracking ? linear(["top", "height"], s.ms) : t(["top", "height", "transform"], laneOut ? liquid.split : liquid.home);

  // The mic: dips under the finger, swells while held, follows a discard toward the leading edge.
  const micScale = s.press ? pressScale(SIDE, SIDE) : s.phase === "holding" ? SWELL : 1;
  const travelMotion = tracking ? linear(["translate"], s.ms) : t("translate", "settle");
  const micMotion = `${travelMotion}, ${t("scale", s.press ? "press" : "release")}`;

  // The bin: buds out of the capsule's leading end, melts into the mic on send, melts away in place after a discard.
  const binHome: [number, number] = s.trashToMic ? [W - SIDE, 0] : [SIDE / 2 + J + (SIDE * liquid.homeScale) / 2, 0];
  const binScale = s.trash === "away" ? 0.001 : s.trash === "melt" ? 0.001 : 1;
  const binMotion = s.trash === "melt" ? t("transform", liquid.home) : "none";

  // The hint: eaten from its far end as the mic travels, gone when the take locks.
  const p = Math.min(s.slide / REACH, 1);
  const hintShown = s.phase === "holding" && !trashOut;
  const hintWidth = hintShown ? HINT_W * (1 - p) : 0;
  const hintOpacity = hintShown ? Math.max(0, 1 - p * 1.25) : 0;
  const hintMotion = tracking ? linear(["width", "opacity"], s.ms) : `${t("width", "morph")}, opacity ${hintShown ? 250 : 100}ms ease-out`;

  // The bars: a strip of the take's speech, scrolling one bar a tenth of a second with the clock.
  const strip = STRIPS[s.take];
  const barsMotion = recording && !s.frozen && s.capsule === "out" ? linear(["transform"], s.ms) : "none";
  const capsuleContentOut = s.capsule === "out";

  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <style>{keyframes}</style>
      <div className="absolute" style={{ left: "50%", top: u(40), width: u(W), height: u(ABOVE + SIDE), marginLeft: u(-W / 2), transform: `scale(${SCALE})`, transformOrigin: "50% 0" }}>
        {/* The field: your content, a neutral capsule. It fades under the capsule and back as the capsule melts home. */}
        <div
          data-motion
          className="absolute flex items-center"
          style={{
            left: 0, top: u(ABOVE), width: u(FIELD_W), height: u(SIDE), borderRadius: 9999, background: ground.field, paddingLeft: u(18),
            opacity: covered ? 0 : 1, transition: covered ? "opacity 160ms ease-out" : "opacity 260ms ease-out 120ms",
          }}
        >
          <span style={{ fontSize: u(17), lineHeight: 1, color: ground.muted }}>Message</span>
        </div>

        <LiquidGroup unit={u(1)} axis="both" style={{ position: "absolute", inset: 0 }}>
          {/* The lock lane, joined above the mic, riding with it. */}
          <span data-motion className="absolute" style={{ left: u(MIC_X - LANE_W / 2), top: 0, translate: `${u(-s.slide)} 0`, transition: travelMotion }}>
            <Liquid
              className="absolute flex flex-col items-center overflow-hidden"
              style={{
                left: 0, top: u(laneTop), width: u(LANE_W), height: u(laneH), paddingTop: u(13), gap: u(6),
                transform: `scale(${laneOut ? 1 : s.lane === "home" ? liquid.homeScale : 0.001})`, transition: laneMotion,
              }}
            >
              <BudContent out={laneOut}>
                <span className="flex flex-col items-center" style={{ gap: u(6) }}>
                  <span style={{ color: s.shut ? ground.text : ground.muted, transition: "color 200ms" }}>
                    <Swap shown={s.shut ? "lock" : "lockOpen"} names={["lockOpen", "lock"]} size={17} />
                  </span>
                  <span data-motion style={{ color: ground.muted, opacity: Math.max(0, 1 - s.stretch / (LOCK * 0.6)), transition: tracking ? linear(["opacity"], s.ms) : "opacity 200ms", ["--vr-drift" as string]: u(-3), animation: laneOut && !s.shut ? "vr-drift-y 1.4s ease-in-out infinite" : undefined }}>
                    <Glyph name="chevronUp" size={13} stroke={2.4} />
                  </span>
                </span>
              </BudContent>
            </Liquid>
          </span>

          {/* The bin, joined to the capsule's leading end. */}
          <span data-motion className="absolute" style={{ left: 0, top: u(ABOVE), width: u(SIDE), height: u(SIDE), transform: `scale(${binScale})`, transition: binMotion }}>
            <Liquid bud={{ out: trashOut, rest: [0, 0], home: binHome }} className="grid h-full w-full place-items-center">
              <BudContent out={trashOut}>
                <span key={s.tip ? "tip" : "still"} data-motion style={{ display: "flex", color: ground.text, transformOrigin: "50% 90%", animation: s.tip ? "vr-tip 440ms cubic-bezier(.3,.7,.3,1) both" : undefined }}>
                  <Glyph name="trash" size={20} stroke={1.9} />
                </span>
              </BudContent>
            </Liquid>
          </span>

          {/* The capsule: the clock, the bars and "Slide to cancel". */}
          <Liquid
            className="absolute flex items-center overflow-hidden"
            style={{ left: u(cap.left), top: u(ABOVE), width: u(Math.max(cap.width, 1)), height: u(SIDE), transform: `scale(${cap.scale})`, transition: capMotion }}
          >
            {/* BudContent's timing on a box that fills the capsule: gone the moment it heads home, in just after it leaves. */}
            <span
              className="absolute inset-0"
              style={{
                opacity: capsuleContentOut ? 1 : 0, filter: `blur(${capsuleContentOut ? 0 : 6}px)`,
                transition: capsuleContentOut ? "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms" : "opacity 140ms ease-out, filter 140ms ease-out",
              }}
            >
              <span className="absolute inset-0 flex items-center" style={{ paddingLeft: u(9), paddingRight: u(15), gap: u(10), minWidth: 0 }}>
                {/* The time, after a red dot that breathes once a second. */}
                <span className="flex flex-none items-center" style={{ gap: u(6), padding: `0 ${u(7)}` }}>
                  <span data-motion style={{ width: u(8), height: u(8), borderRadius: 9999, background: signal.fill, animation: recording && !s.frozen ? "vr-breathe 1s ease-in-out infinite" : undefined }} />
                  <span className="tabular-nums" style={{ fontSize: u(13), lineHeight: 1, color: ground.text, minWidth: u(28) }}>
                    <Roll text={clockText(s.clock)} />
                  </span>
                </span>
                {/* The bars, newest beside the mic, scrolling toward the leading edge. */}
                <span className="relative overflow-hidden" style={{ flex: "1 1 0", minWidth: 0, height: u(BAR_H), WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14%, #000 96%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 96%, transparent)" }}>
                  <span key={s.take} data-motion className="absolute" style={{ top: 0, bottom: 0, right: 0, width: u(PRE * PITCH), transform: `translateX(${u(-s.t * 10 * PITCH)})`, transition: barsMotion }}>
                    {strip.map((h, i) => (
                      <span key={i} className="absolute" style={{ left: u(PRE * PITCH - BAR + (i - PRE + 1) * PITCH), top: u((BAR_H - h) / 2), width: u(BAR), height: u(h), borderRadius: 9999, background: ground.text }} />
                    ))}
                  </span>
                </span>
                {/* "‹ Slide to cancel", eaten from its far end as the mic travels. */}
                <span data-motion className="flex flex-none items-center overflow-hidden" style={{ width: u(hintWidth), opacity: hintOpacity, gap: u(4), color: ground.muted, whiteSpace: "nowrap", transition: hintMotion }}>
                  <span data-motion style={{ display: "flex", ["--vr-drift" as string]: u(-3), animation: hintShown ? "vr-drift-x 1.4s ease-in-out infinite" : undefined }}>
                    <Glyph name="chevronLeft" size={13} stroke={2.4} />
                  </span>
                  <span style={{ fontSize: u(13), lineHeight: 1 }}>Slide to cancel</span>
                </span>
              </span>
            </span>
          </Liquid>

          {/* The mic: neutral glass at rest, red while recording, the red send button while hands-free. */}
          <span data-motion className="absolute" style={{ left: u(W - SIDE), top: u(ABOVE), width: u(SIDE), height: u(SIDE), translate: `${u(-s.slide)} 0`, scale: String(micScale), transition: micMotion }}>
            <Liquid
              tint={recording ? signal.fill : undefined}
              className="grid h-full w-full place-items-center"
              style={{ color: recording ? ink : ground.text, transition: `background-color ${recording ? 140 : 160}ms ease-out, color 160ms` }}
            >
              <Swap shown={locked ? "arrowUp" : "mic"} names={["mic", "arrowUp"]} size={22} stroke={locked ? 2.6 : 2} />
            </Liquid>
          </span>
        </LiquidGroup>
      </div>
    </div>
  );
}
