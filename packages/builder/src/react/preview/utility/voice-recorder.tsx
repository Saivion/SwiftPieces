"use client";
// Voice Recorder in the Playground: the composer the generated screen draws, a "Message" field with the mic resting
// apart from it. Press and hold the mic: after a short beat it swells red, the recording capsule covers the field
// with a running clock and speech bars from the simulated voice, and the lock lane rises above it. Drag toward the
// leading edge to discard (a bin appears at the threshold; let go there, or keep going, and the take is thrown away),
// drag up the lane to lock hands-free (the mic becomes the red send button and a trash bubble appears), or let go to
// send. A tap, or a hold under 0.6 seconds, shows the hint that teaches the gesture; over the last ten seconds the
// time counts down on red and at the longest take it sends itself. Mirrors VoiceRecorder.swift: the same thresholds,
// layout, speech, copy and haptics.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { RECORDER_DEFAULTS, recorderMaximum, recorderSpeech } from "../../../definitions/utility/voice-recorder.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, SPRING, useRuntime } from "../runtime.js";

type Phase = "idle" | "holding" | "locked";
type Hint = "hold" | "denied" | "stopped";

const SIDE = 52, JOIN = 4, APART = 26;
const CAP_TRAIL = SIDE * 1.025 + JOIN;
const LANE_W = SIDE * 0.8, LANE_H = SIDE * 1.55;
const SWELL = 1.1, HOLD_MS = 180, LOCK = 56, BAR = 3, PITCH = 5, BAR_H = SIDE - 20, MINIMUM = 0.6;
const KEYFRAMES = [
  "@keyframes spvr-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.86)}}",
  "@keyframes spvr-drift-x{0%,100%{transform:none}50%{transform:translateX(-3px)}}",
  "@keyframes spvr-drift-y{0%,100%{transform:none}50%{transform:translateY(-3px)}}",
  "@keyframes spvr-tip{0%{transform:rotate(0)}25%{transform:rotate(-16deg)}100%{transform:rotate(0)}}",
  "@keyframes spvr-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}",
  "@media (prefers-reduced-motion: reduce){[data-spvr-motion]{animation:none!important;transition:none!important}}",
].join("");

/** Where each "Preview as" state starts: the phase and how many seconds in (negative: before the end). */
const PRESETS: Record<string, { phase: Phase; at: number; hint?: Hint }> = {
  rest: { phase: "idle", at: 0 },
  holding: { phase: "holding", at: 3.4 },
  locked: { phase: "locked", at: 7.2 },
  countdown: { phase: "locked", at: -7.4 },
  short: { phase: "idle", at: 0, hint: "hold" },
  denied: { phase: "idle", at: 0, hint: "denied" },
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** `0:07`, or `1:02:07` when takes can run an hour. */
function clock(seconds: number, long: boolean) {
  const t = Math.max(0, Math.floor(seconds + 1e-6));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return long ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${Math.floor(t / 60)}:${String(sec).padStart(2, "0")}`;
}

/** One bar a tenth of a second: the loudest moment in it. Before the take, a quiet dot. */
const level = (k: number) => (k < 0 ? 0 : Math.max(recorderSpeech(0.4 + k / 10), recorderSpeech(0.425 + k / 10), recorderSpeech(0.45 + k / 10), recorderSpeech(0.475 + k / 10)));

const PATHS: Record<string, string> = {
  chevronLeft: "M14.6 7 9.6 12l5 5",
  chevronUp: "M7 14.6 12 9.6l5 5",
  arrowUp: "M12 19.6V4.8M5.6 11.2 12 4.8l6.4 6.4",
  trash: "M4.4 6.4h15.2M9.4 6.4V4.9c0-.7.5-1.2 1.2-1.2h2.8c.7 0 1.2.5 1.2 1.2v1.5M6.4 6.4l.9 12.3c.1 1 .9 1.7 1.9 1.7h5.6c1 0 1.8-.7 1.9-1.7l.9-12.3M10 10.2v6.6M14 10.2v6.6",
};

function Glyph({ name, size, stroke = 2.2 }: { name: "mic" | "lockOpen" | "lock" | keyof typeof PATHS; size: number; stroke?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: "block", flex: "none" }}>
      {name === "mic" ? (<><rect x="8.6" y="2.4" width="6.8" height="12.2" rx="3.4" fill="currentColor" stroke="none" /><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.8v3.2M8.6 21h6.8" /></>)
        : name === "lockOpen" ? (<><rect x="3.6" y="11.2" width="12.4" height="9.8" rx="2.4" fill="currentColor" stroke="none" /><path d="M13 11.2V7.6a3.6 3.6 0 0 1 7.2 0v1.6" /></>)
        : name === "lock" ? (<><rect x="5.2" y="11.2" width="13.6" height="9.8" rx="2.4" fill="currentColor" stroke="none" /><path d="M8.2 11.2V8a3.8 3.8 0 0 1 7.6 0v3.2" /></>)
        : <path d={PATHS[name]} />}
    </svg>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const field = b(p, "field");
  const placeholder = s(p, "placeholder").trim() || RECORDER_DEFAULTS.placeholder;
  const maximum = recorderMaximum(p);
  const long = maximum >= 3600;
  const cancelCopy = s(p, "slideToCancel").trim() || RECORDER_DEFAULTS.slideToCancel;
  const presetId = s(p, "state");
  const preset = PRESETS[presetId] ?? PRESETS.rest;
  const startAt = (at: number) => performance.now() - (at < 0 ? maximum + at : at) * 1000;

  const [phase, setPhase] = useState<Phase>(preset.phase);
  const [started, setStarted] = useState(() => (preset.phase === "idle" ? 0 : startAt(preset.at)));
  const [now, setNow] = useState(() => performance.now());
  const [pressed, setPressed] = useState(false);
  const [slide, setSlide] = useState(0);
  const [stretch, setStretch] = useState(0);
  const [armed, setArmed] = useState(false);
  /** A discard is being dragged: the lock lane has no job and melts away. */
  const [sliding, setSliding] = useState(false);
  const [shut, setShut] = useState(false);
  const [trash, setTrash] = useState(preset.phase === "locked");
  /** A discard: the capsule gathers into the bin (1), the bin tips (2) and melts (3). */
  const [discard, setDiscard] = useState(0);
  const [hint, setHint] = useState<Hint | null>(preset.hint ?? null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const live = useRef({ phase, started, armed });
  live.current = { phase, started, armed };

  const later = useCallback((ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  const clear = useCallback(() => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);

  // "Preview as" and the properties restart the picture.
  useEffect(() => {
    clear();
    setPhase(preset.phase);
    setStarted(preset.phase === "idle" ? 0 : startAt(preset.at));
    setNow(performance.now());
    setTrash(preset.phase === "locked");
    setHint(preset.hint ?? null);
    setSlide(0); setStretch(0); setArmed(false); setShut(false); setDiscard(0); setPressed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, maximum, clear]);
  useEffect(() => clear, [clear]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The take's clock, a frame at a time while it records.
  const recording = phase !== "idle";
  useEffect(() => {
    if (!recording || still) return;
    let raf = 0;
    const tick = (t: number) => { setNow(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording, still]);
  const elapsed = recording ? Math.max((now - started) / 1000, 0) : 0;
  const remaining = maximum - elapsed;
  const counting = recording && remaining <= 10;
  const cancelReach = Math.max(Math.min(110, (width - SIDE) * 0.42), 40);

  const showHint = (kind: Hint, el?: Element | null) => {
    setHint(kind);
    rt.haptic("soft", el);
    const mine = kind;
    later(kind === "denied" ? 4000 : 2200, () => setHint((h) => (h === mine ? null : h)));
  };

  /** Everything melts back into the mic. */
  const settle = () => {
    setSlide(0);
    setStretch(0);
    setArmed(false);
  };

  const send = (el?: Element | null, atMaximum = false) => {
    if (live.current.phase === "idle") return;
    const took = (performance.now() - live.current.started) / 1000;
    clear();
    setPhase("idle");
    setTrash(false);
    setShut(false);
    settle();
    if (took < MINIMUM && !atMaximum) { showHint("hold", el); return; }
    rt.haptic(atMaximum ? "success" : "light", el);
  };

  const throwAway = (el?: Element | null) => {
    if (live.current.phase === "idle") return;
    clear();
    rt.haptic("warning", el);
    setPhase("idle");
    setTrash(true);
    setShut(false);
    setDiscard(1);
    settle();
    later(360, () => setDiscard(2));
    later(920, () => setDiscard(3));
    later(1450, () => { setDiscard(0); setTrash(false); });
  };

  const begin = (el: Element) => {
    if (presetId === "denied") { showHint("denied", el); return; }
    clear();
    setHint(null);
    setDiscard(0);
    setTrash(false);
    setShut(false);
    setStarted(performance.now());
    setNow(performance.now());
    setPhase("holding");
    rt.haptic("medium", el);
  };

  const lock = (el: Element) => {
    setPhase("locked");
    setShut(true);
    rt.haptic("rigid", el);
    later(170, () => { setStretch(0); setTrash(true); });
  };

  // The longest take sends itself.
  useEffect(() => {
    if (recording && !still && remaining <= 0) send(box.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, still, remaining <= 0]);

  /** One finger on the mic: a hold after 180 ms records, an early move is a scroll, an early lift is a tap. */
  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (still || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget;
    const x0 = e.clientX, y0 = e.clientY;
    const g = { held: false, dead: false, resolved: false, sendOnLift: false, axis: null as "cancel" | "lock" | null };
    setPressed(true);
    const timer = window.setTimeout(() => {
      if (g.dead) return;
      g.held = true;
      setPressed(false);
      if (live.current.phase === "idle") begin(el);
      else g.sendOnLift = true;
    }, HOLD_MS);
    const move = (ev: PointerEvent) => {
      const k = rt.scale() || 1;
      const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
      const distance = Math.hypot(dx, dy);
      if (!g.held) {
        if (distance > 10) { g.dead = true; window.clearTimeout(timer); setPressed(false); }
        return;
      }
      if (live.current.phase !== "holding" || g.resolved) return;
      const lead = -dx, up = -dy;
      if (!g.axis && distance > 10) g.axis = lead >= up ? (lead > 0 ? "cancel" : null) : up > 0 ? "lock" : null;
      else if (g.axis && distance < 6) g.axis = null;
      setSliding(g.axis === "cancel");
      if (g.axis === "cancel") {
        const travel = Math.max(lead, 0);
        setSlide(travel <= cancelReach ? travel : cancelReach + (1 - 1 / (((travel - cancelReach) * 0.55) / 28 + 1)) * 28);
        setStretch(0);
        const on = travel >= cancelReach;
        if (on !== live.current.armed) { setArmed(on); setTrash(on); rt.haptic("selection", el); }
        if (travel >= cancelReach * 1.7) { g.resolved = true; throwAway(el); }
      } else if (g.axis === "lock") {
        const rise = Math.max(up, 0);
        setStretch(Math.min(rise, LOCK));
        setSlide(0);
        if (rise >= LOCK) { g.resolved = true; lock(el); }
      } else {
        setSlide(0);
        setStretch(0);
        if (live.current.armed) { setArmed(false); setTrash(false); }
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.clearTimeout(timer);
      setPressed(false);
      setSliding(false);
      if (ev.type === "pointercancel") { if (live.current.phase === "holding" && !g.resolved) throwAway(el); return; }
      if (g.dead) return;
      if (!g.held) {
        // A tap: teaches the gesture at rest, sends while hands-free.
        if (live.current.phase === "locked") send(el);
        else if (live.current.phase === "idle") showHint(presetId === "denied" ? "denied" : "hold", el);
        return;
      }
      if (g.sendOnLift) { send(el); return; }
      if (live.current.phase !== "holding" || g.resolved) { settle(); return; }
      if (live.current.armed) throwAway(el); else send(el);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // ---------------------------------------------------------------- Drawing

  const glass = houseVar("field");
  const animate = !reduced && !still;
  const out = recording && discard === 0;
  const covered = recording || trash || discard > 0;
  const holding = phase === "holding";
  const locked = phase === "locked";
  const easeOut = (prop: string, ms: number) => `${prop} ${ms}ms ${BOUNCE}`;
  const easeHome = (prop: string, ms: number) => `${prop} ${ms}ms cubic-bezier(.3,0,.2,1)`;

  // The capsule spans from the leading edge (or after the bin) to a joined gap before the mic, which it follows.
  const capLeft = discard ? 0 : trash ? SIDE + JOIN : 0;
  const capStyle: CSSProperties = out
    ? { left: capLeft, right: CAP_TRAIL + slide, transform: "none", opacity: 1 }
    : discard
      // Gathered into the bin, then gone inside it while the bin tips and melts.
      ? { left: 0, right: `calc(100% - ${SIDE}px)`, transform: discard === 1 ? "none" : "scale(.72)", opacity: discard === 1 ? 1 : 0 }
      : { left: `calc(100% - ${SIDE}px)`, right: 0, transform: `scale(${animate ? 0.72 : 0.001})`, opacity: 0 };
  const tracking = slide > 0 && holding;
  const capMotion = tracking ? "none" : out ? [easeOut("left", 620), easeOut("right", 620)].join(", ") : discard === 1 ? "left 300ms ease-in, right 300ms ease-in" : discard ? "opacity 120ms, transform 200ms" : [easeHome("left", 500), easeHome("right", 500), easeHome("transform", 500), "opacity 300ms ease-in 200ms"].join(", ");

  // The bars: newest beside the mic, scrolling toward the leading edge, one every tenth of a second.
  const tenth = elapsed * 10, newest = Math.floor(tenth), into = tenth - newest;
  const bars = Array.from({ length: 70 }, (_, j) => {
    const k = newest - j;
    const h = BAR + (BAR_H - BAR) * level(k);
    return <span key={j} style={{ position: "absolute", right: j * PITCH - PITCH * (1 - into), top: (BAR_H - h) / 2, width: BAR, height: h, borderRadius: BAR, background: houseVar("text") }} />;
  });

  const p01 = Math.min(slide / cancelReach, 1);
  const cancelShown = holding && !trash;
  const micScale = pressed && animate ? 0.92 : holding && animate ? SWELL : 1;
  const micR = (SIDE / 2) * (holding && animate ? SWELL : 1);
  const laneOut = holding && !sliding;
  const laneHeight = LANE_H + stretch;
  const hintText = hint === "denied" ? "Microphone access is off" : hint === "stopped" ? "Recording stopped" : "Hold to record, release to send";

  return (
    <div ref={box} {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height: SIDE, minWidth: 220, color: houseVar("text"), userSelect: "none" }}>
      <style>{KEYFRAMES}</style>

      {/* The field: your content. It fades under the capsule and back as the capsule melts home. */}
      {field ? (
        <div
          data-spvr-motion
          style={{
            position: "absolute", left: 0, top: 0, right: SIDE + APART, height: SIDE, borderRadius: cr(999), background: glass, display: "flex", alignItems: "center", padding: "0 18px",
            opacity: covered ? 0 : 1, transition: covered ? "opacity .16s ease-out" : `opacity .26s ease-out ${discard ? ".3s" : ".12s"}`, pointerEvents: covered ? "none" : "auto",
          }}
        >
          <span style={{ fontSize: ts(17), fontWeight: fw(600), color: houseVar("muted"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{placeholder}</span>
        </div>
      ) : null}

      {/* The lock lane, joined above the mic, with a short neck. */}
      <span
        aria-hidden
        data-spvr-motion
        style={{
          position: "absolute", right: SIDE / 2 - LANE_W / 2 + slide, bottom: SIDE - (SIDE / 2 - micR) + JOIN, width: LANE_W, height: laneOut ? laneHeight : LANE_W,
          borderRadius: cr(999), background: glass, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 13, gap: 6, boxSizing: "border-box", overflow: "hidden",
          transform: laneOut ? "none" : "translateY(40px) scale(.5)", opacity: laneOut ? 1 : 0,
          transition: stretch > 0 && holding ? "none" : laneOut ? `${easeOut("transform", 620)}, opacity .2s, height .3s ${SPRING}` : `${easeHome("transform", 500)}, opacity .3s ease-in .15s, height .3s ${SPRING}`,
        }}
      >
        <span style={{ color: shut ? houseVar("text") : houseVar("muted") }}><Glyph name={shut ? "lock" : "lockOpen"} size={17} /></span>
        <span data-spvr-motion style={{ color: houseVar("muted"), opacity: Math.max(0, 1 - stretch / (LOCK * 0.6)), animation: animate && laneOut && !shut ? "spvr-drift-y 1.4s ease-in-out infinite" : undefined }}>
          <Glyph name="chevronUp" size={13} stroke={2.4} />
        </span>
      </span>
      <span aria-hidden data-spvr-motion style={{ position: "absolute", right: SIDE / 2 - (LANE_W * 0.45) / 2 + slide, bottom: SIDE - 4, width: LANE_W * 0.45, height: JOIN + 10, background: glass, opacity: laneOut ? 1 : 0, transition: "opacity .2s" }} />

      {/* The bin: the delete button while hands-free, and where a discarded take gathers, tips and melts away. */}
      <span
        role="button"
        aria-label="Delete"
        aria-hidden={!locked}
        onClick={(e) => { if (locked) throwAway(e.currentTarget); }}
        data-spvr-motion
        style={{
          position: "absolute", left: 0, top: 0, width: SIDE, height: SIDE, borderRadius: cr(999), background: glass, display: "grid", placeItems: "center", cursor: locked ? "pointer" : "default",
          transform: trash && discard !== 3 ? "none" : `translateX(${animate ? 40 : 0}px) scale(${animate ? 0.5 : 0.001})`, opacity: trash && discard !== 3 ? 1 : 0,
          transition: trash && discard !== 3 ? `${easeOut("transform", 620)}, opacity .2s` : discard === 3 ? `${easeHome("transform", 500)}, opacity .35s ease-in .1s` : `${easeHome("transform", 500)}, opacity .15s ease-in`,
          pointerEvents: locked ? "auto" : "none", zIndex: 1,
        }}
      >
        <span data-spvr-motion style={{ display: "flex", transformOrigin: "50% 90%", animation: discard === 2 && animate ? "spvr-tip .56s cubic-bezier(.3,.7,.3,1) both" : undefined }}>
          <Glyph name="trash" size={20} stroke={1.9} />
        </span>
      </span>
      {/* The neck between the bin and the capsule. */}
      <span aria-hidden style={{ position: "absolute", left: SIDE - 8, top: SIDE * 0.19, width: JOIN + 16, height: SIDE * 0.62, background: glass, opacity: trash && out ? 1 : 0, transition: "opacity .2s", zIndex: 0 }} />

      {/* The capsule: the time, the bars and "Slide to cancel". */}
      <div
        role="timer"
        aria-label="Recording"
        aria-hidden={!recording}
        data-spvr-motion
        style={{ position: "absolute", top: 0, height: SIDE, borderRadius: cr(999), background: glass, overflow: "hidden", zIndex: 1, transition: capMotion, ...capStyle }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 15px 0 9px", opacity: out ? 1 : 0, filter: out ? "none" : "blur(6px)", transition: out ? "opacity .3s ease-out .1s, filter .3s ease-out .1s" : "opacity .14s, filter .14s" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 7px", borderRadius: cr(999), background: counting ? ACCENT : "transparent", transition: "background-color .25s", flex: "none" }}>
            <span data-spvr-motion style={{ width: 8, height: 8, borderRadius: 8, background: counting ? ACCENT_INK : ACCENT, animation: animate && recording ? "spvr-breathe 1s ease-in-out infinite" : undefined }} />
            <span style={{ fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", color: counting ? ACCENT_INK : houseVar("text"), minWidth: long ? 52 : 30 }}>
              {clock(counting ? Math.ceil(Math.max(remaining, 0)) : elapsed, long)}
            </span>
          </span>
          <span style={{ position: "relative", flex: "1 1 0", minWidth: 0, height: BAR_H, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14%, #000 96%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 96%, transparent)" }}>
            {bars}
          </span>
          <span data-spvr-motion style={{ display: "flex", alignItems: "center", gap: 4, flex: "none", overflow: "hidden", whiteSpace: "nowrap", color: houseVar("muted"), width: cancelShown ? 118 * (1 - p01) : 0, opacity: cancelShown ? Math.max(0, 1 - p01 * 1.25) : 0, transition: tracking ? "none" : `width .4s ${SPRING}, opacity ${cancelShown ? ".25s" : ".1s"} ease-out` }}>
            <span data-spvr-motion style={{ display: "flex", animation: animate && cancelShown ? "spvr-drift-x 1.4s ease-in-out infinite" : undefined }}><Glyph name="chevronLeft" size={13} stroke={2.4} /></span>
            <span style={{ fontSize: ts(13), fontWeight: fw(600) }}>{cancelCopy}</span>
          </span>
        </div>
      </div>
      {/* The neck between the capsule and the mic. */}
      <span aria-hidden style={{ position: "absolute", right: SIDE - 8 + slide, top: SIDE * 0.19, width: CAP_TRAIL - SIDE + 16, height: SIDE * 0.62, background: glass, opacity: out ? 1 : 0, transition: "opacity .2s", zIndex: 0 }} />

      {/* The hint, joined above the mic. */}
      <span
        role={hint === "denied" ? "button" : "status"}
        aria-hidden={!hint}
        data-spvr-motion
        style={{
          position: "absolute", right: 0, bottom: SIDE + (recording ? APART : JOIN), maxWidth: Math.max(width, SIDE), padding: "9px 15px", minHeight: 36, boxSizing: "border-box", borderRadius: cr(18),
          background: glass, display: "flex", alignItems: "center", gap: 8, fontSize: ts(15), fontWeight: fw(600), whiteSpace: "nowrap", zIndex: 2,
          transform: hint ? "none" : "translateY(30px) scale(.4)", transformOrigin: "100% 100%", opacity: hint ? 1 : 0, pointerEvents: hint === "denied" ? "auto" : "none",
          transition: hint ? `${easeOut("transform", 620)}, opacity .25s` : `${easeHome("transform", 500)}, opacity .2s ease-in`,
        }}
      >
        <span style={{ color: hint === "denied" ? houseVar("muted") : houseVar("text") }}>{hintText}</span>
        {hint === "denied" ? <span style={{ color: houseVar("text") }}>Settings</span> : null}
      </span>

      {/* The mic: neutral at rest, red while recording, the red send button while hands-free. */}
      <span
        role="button"
        aria-label={locked ? "Send" : "Record voice message"}
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        data-spvr-motion
        style={{
          position: "absolute", right: 0, top: 0, width: SIDE, height: SIDE, borderRadius: cr(999), display: "grid", placeItems: "center", zIndex: 3, cursor: "pointer", touchAction: "none",
          background: recording ? ACCENT : glass, color: recording ? ACCENT_INK : houseVar("text"),
          transform: `translateX(${-slide}px) scale(${micScale})`,
          transition: tracking ? "background-color .14s" : `background-color ${recording ? ".14s" : ".16s"} ease-out, color .16s, transform ${pressed ? ".12s ease-out" : `.42s ${BOUNCE}`}`,
        }}
      >
        <span key={locked ? "send" : "mic"} data-spvr-motion style={{ display: "flex", animation: animate ? "spvr-in .26s ease-out both" : undefined }}>
          {locked ? <Glyph name="arrowUp" size={22} stroke={2.6} /> : <Glyph name="mic" size={22} stroke={2} />}
        </span>
      </span>
    </div>
  );
};
