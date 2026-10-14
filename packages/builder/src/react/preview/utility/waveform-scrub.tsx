"use client";
// Waveform Scrub in the Playground: the same voice note the generated screen plays. Play and pause run a stand-in
// player, as the emitted task does; press anywhere on the waveform and the playhead drops under the pointer, the bars
// around it rise and a bubble with the time rises above it; drag to scrub (a vertical drag still scrolls the screen)
// and let go to seek once. The speed chip cycles the speeds, a finished note offers replay, and "Waveform loading"
// shows the shimmering dots. Mirrors WaveformScrub.swift: the same resampling (peak of each stretch, smooth in
// between), split mid-bar, time formats and haptics.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { VOICE_NOTE_SAMPLES, WAVEFORM_RATES, WAVEFORM_STATES, waveformDuration } from "../../../definitions/utility/waveform-scrub.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, SPRING, useLive, useRuntime } from "../runtime.js";

const H = 52, CHIP_H = 32, BUBBLE_H = 30, JOIN = 4, BAR = 3, GAP = 2;
const KEYFRAMES = [
  "@keyframes spws-shimmer{0%{-webkit-mask-position:-70% 0;mask-position:-70% 0}75%,100%{-webkit-mask-position:170% 0;mask-position:170% 0}}",
  "@keyframes spws-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}",
  "@media (prefers-reduced-motion: reduce){[data-spws-motion]{animation:none!important;transition:none!important}}",
].join("");

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

/** Bar `i` of `count`, as the Swift resamples: the peak of its stretch, or between two samples when there are fewer. */
function level(i: number, count: number, samples: number[]): number {
  const n = samples.length, top = Math.max(...samples, 0) || 1;
  if (!n) return 0;
  if (n >= count) {
    const lo = Math.floor((i * n) / count), hi = Math.max(Math.floor(((i + 1) * n) / count), lo + 1);
    return Math.max(...samples.slice(lo, Math.min(hi, n))) / top;
  }
  const place = count > 1 ? (i * (n - 1)) / (count - 1) : 0, below = Math.floor(place), above = Math.min(below + 1, n - 1);
  return (samples[below] + (samples[above] - samples[below]) * (place - below)) / top;
}

/** `0:42`, or `1:12:30` for a note of an hour or more. */
function clock(seconds: number, long: boolean, round = false) {
  const t = Math.max(0, round ? Math.round(seconds) : Math.floor(seconds + 1e-6));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return long ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${Math.floor(t / 60)}:${String(sec).padStart(2, "0")}`;
}

function Glyph({ name }: { name: "play" | "pause" | "replay" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: 20, height: 20, display: "block" }} fill={name === "replay" ? "none" : "currentColor"} stroke={name === "replay" ? "currentColor" : "none"} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {name === "play" ? <path d="M7.6 4.9v14.2c0 .95 1.03 1.54 1.85 1.06l12.05-7.1c.8-.48.8-1.64 0-2.12L9.45 3.84C8.63 3.36 7.6 3.95 7.6 4.9Z" /> : null}
      {name === "pause" ? (<><rect x="5.6" y="4.2" width="4.6" height="15.6" rx="1.4" /><rect x="13.8" y="4.2" width="4.6" height="15.6" rx="1.4" /></>) : null}
      {name === "replay" ? (<><path d="M5.2 12a6.8 6.8 0 1 0 2-4.8" /><path d="M6.6 3.6v4.1h4.1" /></>) : null}
    </svg>
  );
}

/** A short neck between two joined parts, so they read as one control. */
function Neck({ height }: { height: number }) {
  return <span aria-hidden style={{ width: JOIN + 16, height, margin: "0 -8px", background: houseVar("field"), flex: "none", zIndex: 0 }} />;
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const duration = waveformDuration(p);
  const long = duration >= 3600;
  const preset = WAVEFORM_STATES[s(p, "state")] ?? WAVEFORM_STATES.start;
  const loading = preset.loading === true;
  const chip = b(p, "speedChip");
  const rates = WAVEFORM_RATES[s(p, "rates")] ?? WAVEFORM_RATES.standard;
  const title = s(p, "title").trim() || "Voice note";

  const [time, setTime] = useLive(preset.at * duration);
  const [playing, setPlaying] = useLive(preset.playing && !still);
  const [rate, setRate] = useLive(1);
  const [scrub, setScrub] = useState<number | null>(null);
  const [bubbleTime, setBubbleTime] = useState(0);
  const [pressed, setPressed] = useState<"play" | "rate" | null>(null);
  const [waveWidth, setWaveWidth] = useState(0);
  const wave = useRef<HTMLSpanElement | null>(null);
  const capsule = useRef<HTMLDivElement | null>(null);
  const [fingerX, setFingerX] = useState(0);
  const gesture = useRef<{ x0: number; y0: number; mode: "press" | "scrub" | "pass"; el: Element } | null>(null);
  const atEdge = useRef(false);
  const live = useRef({ time, rate, duration });
  live.current = { time, rate, duration };

  useEffect(() => {
    const el = wave.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWaveWidth(el.clientWidth));
    ro.observe(el);
    setWaveWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The stand-in player, as the emitted `.task` runs one: the time moves on at the chosen speed and stops at the end.
  useEffect(() => {
    if (!playing || still) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const { time: t, rate: k, duration: d } = live.current;
      const next = Math.min(t + ((now - last) / 1000) * k, d);
      last = now;
      setTime(next);
      if (next >= d) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, still, setTime, setPlaying]);

  const count = waveWidth >= BAR ? Math.max(Math.floor((waveWidth + GAP) / (BAR + GAP)), 1) : 0;
  const used = count * BAR + Math.max(count - 1, 0) * GAP;
  const offset = (waveWidth - used) / 2;
  const tallest = (H - 20) / 1.3;
  const samples = loading ? [] : VOICE_NOTE_SAMPLES;
  const shown = scrub ?? Math.min(Math.max(time / duration, 0), 1);
  const split = offset + used * shown;
  const focus = scrub === null ? null : offset + used * scrub;
  const finished = !playing && scrub === null && time >= duration - 0.05;
  const atStart = !playing && scrub === null && time < 0.05;
  const label = atStart || finished ? clock(duration, long, true) : clock(shown * duration, long);
  const glyph = playing ? "pause" : finished ? "replay" : "play";
  const animate = !still && !reduced;

  /** The playhead, 0 to 1, for a pointer at `clientX`. */
  const at = (clientX: number) => {
    const el = wave.current;
    if (!el || used <= 0) return 0;
    const box = el.getBoundingClientRect(), k = box.width / (el.clientWidth || 1);
    return Math.min(Math.max(((clientX - box.left) / k - offset) / used, 0), 1);
  };
  const place = (clientX: number) => {
    const el = capsule.current;
    if (!el) return;
    const box = el.getBoundingClientRect(), k = box.width / (el.clientWidth || 1);
    setFingerX((clientX - box.left) / k);
  };

  const grab = (clientX: number, el: Element) => {
    const f = at(clientX);
    setScrub(f);
    setBubbleTime(f * duration);
    place(clientX);
    atEdge.current = f <= 0 || f >= 1;
    rt.haptic("selection", el);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    gesture.current = { x0: e.clientX, y0: e.clientY, mode: "press", el: e.currentTarget };
    grab(e.clientX, e.currentTarget);
    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.mode === "pass") return;
      const k = rt.scale() || 1, dx = (ev.clientX - g.x0) / k, dy = (ev.clientY - g.y0) / k;
      if (g.mode === "press") {
        // A vertical drag is the screen's: the scrub lets go without seeking.
        if (Math.abs(dy) >= 8 && Math.abs(dy) > Math.abs(dx)) { g.mode = "pass"; setScrub(null); return; }
        if (Math.abs(dx) < 6) return;
        g.mode = "scrub";
      }
      const f = at(ev.clientX);
      setScrub(f);
      setBubbleTime(f * duration);
      place(ev.clientX);
      const edge = f <= 0 || f >= 1;
      if (edge && !atEdge.current) rt.haptic("soft", g.el);
      atEdge.current = edge;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.mode === "pass") return;
      if (ev.type === "pointercancel") { setScrub(null); return; }
      // One seek, on release.
      setTime(at(ev.clientX) * duration);
      setScrub(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const togglePlay = (el: Element) => {
    if (finished) setTime(0);
    setPlaying((v) => !v);
    rt.haptic("light", el);
  };
  const cycle = (el: Element) => {
    const i = rates.findIndex((x) => Math.abs(x - rate) < 0.001);
    setRate(i >= 0 ? rates[(i + 1) % rates.length] : rates.find((x) => x > rate) ?? rates[0]);
    rt.haptic("selection", el);
  };

  const fill = houseVar("field");
  const press = (name: "play" | "rate", scale: number): CSSProperties => ({
    transform: pressed === name ? `scale(${scale})` : "none",
    transition: `transform ${pressed === name ? ".12s ease-out" : `.42s ${BOUNCE}`}`,
  });
  const bindPress = (name: "play" | "rate") => ({
    onPointerDown: () => setPressed(name),
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
  });
  const speedLabel = (k: number) => `${Number(k.toFixed(2)).toLocaleString()}×`;
  const widest = rates.reduce((a, k) => (speedLabel(k).length > a.length ? speedLabel(k) : a), "");
  const bubbleW = Math.max(56, clock(duration, long, true).length * 9.2 + 24);
  const capsuleW = capsule.current?.clientWidth ?? 0;
  const bubbleX = capsuleW > bubbleW + 20 ? Math.min(Math.max(fingerX, bubbleW / 2 + 10), capsuleW - bubbleW / 2 - 10) : capsuleW / 2;
  const out = scrub !== null;

  const bars = (color: string) =>
    Array.from({ length: count }, (_, i) => {
      const x = offset + i * (BAR + GAP);
      const h = BAR + (tallest - BAR) * level(i, count, samples);
      const reach = (BAR + GAP) * 5, d = focus === null ? reach : Math.abs(x + BAR / 2 - focus);
      const grow = animate && d < reach ? 1 + (0.3 * (1 + Math.cos((Math.PI * d) / reach))) / 2 : 1;
      return (
        <span
          key={i}
          data-spws-motion
          style={{ position: "absolute", left: x, top: (H - 20 - h) / 2, width: BAR, height: h, borderRadius: BAR / 2, background: color, transform: `scaleY(${grow})`, transition: `transform ${out ? `.28s ${SPRING}` : `.42s ${BOUNCE}`}` }}
        />
      );
    });

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", alignItems: "center", height: H, color: houseVar("text"), minWidth: 0 }}>
      <style>{KEYFRAMES}</style>
      {/* Play: the red, the one signal on the control. */}
      <span
        role="button"
        aria-label={playing ? "Pause" : finished ? "Play again" : "Play"}
        onClick={(e) => togglePlay(e.currentTarget)}
        {...bindPress("play")}
        data-spws-motion
        style={{ position: "relative", zIndex: 1, width: H, height: H, flex: "none", borderRadius: cr(999), background: ACCENT, color: ACCENT_INK, display: "grid", placeItems: "center", cursor: "pointer", ...press("play", 0.92) }}
      >
        <span key={glyph} data-spws-motion style={{ display: "flex", transform: glyph === "play" ? "translateX(1.5px)" : undefined, animation: animate ? "spws-in .26s ease-out both" : undefined }}>
          <Glyph name={glyph} />
        </span>
      </span>
      <Neck height={H * 0.62} />
      {/* The capsule: the waveform and the time. The pointer seeks anywhere on it. */}
      <div
        ref={capsule}
        role="slider"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown * duration)}
        aria-valuetext={`${clock(shown * duration, long)} of ${clock(duration, long, true)}`}
        onPointerDown={onPointerDown}
        style={{ position: "relative", zIndex: 1, flex: "1 1 0", minWidth: 120, height: H, borderRadius: cr(999), background: fill, display: "flex", alignItems: "center", gap: 10, padding: "0 16px 0 18px", boxSizing: "border-box", touchAction: "pan-y", cursor: "ew-resize", userSelect: "none" }}
      >
        {/* The time bubble: it rises above the pointer on a neck while a scrub is live, and sinks back on release. */}
        <span
          aria-hidden
          data-spws-motion
          style={{
            position: "absolute", left: bubbleX - bubbleW / 2, top: (H - BUBBLE_H) / 2, width: bubbleW, height: BUBBLE_H, borderRadius: cr(999), background: fill,
            display: "grid", placeItems: "center", zIndex: -1, pointerEvents: "none",
            transform: out ? `translateY(${-(H / 2 + JOIN + BUBBLE_H / 2)}px)` : "scale(.72)",
            opacity: out || animate ? 1 : 0,
            transition: out ? `transform .62s ${BOUNCE}` : "transform .5s cubic-bezier(.3,0,.2,1)",
          }}
        >
          <span aria-hidden style={{ position: "absolute", left: "50%", bottom: -JOIN - 4, width: bubbleW * 0.45, height: JOIN + 8, transform: "translateX(-50%)", background: fill, opacity: out ? 1 : 0, transition: "opacity .2s" }} />
          <span style={{ position: "relative", fontSize: ts(15), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", lineHeight: 1, opacity: out ? 1 : 0, filter: out ? "none" : "blur(4px)", transition: out ? "opacity .3s ease-out .1s, filter .3s ease-out .1s" : "opacity .14s, filter .14s" }}>
            {clock(bubbleTime, long)}
          </span>
        </span>
        <span ref={wave} style={{ position: "relative", flex: "1 1 0", minWidth: 0, height: H - 20 }}>
          <span style={{ position: "absolute", inset: 0 }}>{bars(`color-mix(in srgb, ${houseVar("muted")} 62%, ${houseVar("ground")})`)}</span>
          {loading && animate ? (
            // A soft band of light passes along the dots once a second: the same dots in the text colour, seen through
            // a moving mask.
            <span
              aria-hidden
              data-spws-motion
              style={{
                position: "absolute", inset: 0, opacity: 0.6,
                maskImage: "linear-gradient(90deg, transparent, #000, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000, transparent)",
                maskSize: "35% 100%", WebkitMaskSize: "35% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
                animation: "spws-shimmer 1.2s linear infinite",
              }}
            >
              {bars(houseVar("text"))}
            </span>
          ) : null}
          {/* The same bars inked and cut at the playhead, so the split falls mid-bar. */}
          <span data-spws-motion style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${Math.max(waveWidth - split, 0)}px 0 0)`, transition: scrub !== null || playing ? "none" : `clip-path .35s ${SPRING}` }}>
            {bars(houseVar("text"))}
          </span>
        </span>
        <span style={{ position: "relative", flex: "none", fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", color: houseVar("muted"), whiteSpace: "nowrap" }}>
          <span style={{ visibility: "hidden" }}>{clock(duration, long, true)}</span>
          <span style={{ position: "absolute", right: 0, top: 0 }}>{label}</span>
        </span>
      </div>
      {chip ? (
        <>
          <Neck height={CHIP_H * 0.62} />
          <span
            role="button"
            aria-label="Playback speed"
            aria-valuetext={Math.abs(rate - 1) < 0.001 ? "Normal" : `${rate} times`}
            onClick={(e) => cycle(e.currentTarget)}
            {...bindPress("rate")}
            data-spws-motion
            style={{ position: "relative", zIndex: 1, height: CHIP_H, flex: "none", padding: "0 12px", borderRadius: cr(999), background: fill, display: "grid", placeItems: "center", cursor: "pointer", fontSize: ts(15), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", ...press("rate", 0.9) }}
          >
            <span style={{ gridArea: "1 / 1", visibility: "hidden" }}>{widest}</span>
            <span key={rate} data-spws-motion style={{ gridArea: "1 / 1", animation: animate ? "spws-in .3s ease-out both" : undefined }}>{speedLabel(rate)}</span>
          </span>
        </>
      ) : null}
    </div>
  );
};
