"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, paper, signal } from "./palette";
import { pressScale, rubberBand, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Now Playing: the mini player resting at the bottom, playing, its red hairline creeping. A finger pulls the bar up and
 * the glass stretches after it; let go, it grows into the card: forward melts into play, the artwork, the lines and
 * play fly to their places, the card's controls blur in and previous and next bud out of play. Next dips: the title
 * morphs to Paper Lanterns and the artwork blurs into the new one. A finger scrubs to two thirds (the thumb swells, the
 * times follow), pause dips, and the grabber is dragged down: previous and next melt home and the card folds back into
 * the bar, forward buds out, play dips, and the loop rests again.
 *
 * Laid out with the Swift piece's own numbers, in points, on a 300 point wide phone column, and scaled to 0.85 so the
 * open card fits the stage. The card is short of height here, so, as the piece does, its artwork shrinks to fit and the
 * card hugs it. Sizes are converted to `cqw` against the 560 px stage, so the picture scales as one.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A finger moving over one scripted step: linear, so the surface keeps pace with it instead of easing in. */
const tracking = (props: string[], ms: number) => props.map((p) => `${p} ${Math.round(ms)}ms linear`).join(", ");

// ---------------------------------------------------------------- Geometry, as NowPlayingLayout lays it out

type Rect = { x: number; y: number; w: number; h: number };
const K = 0.85;
/** The phone column and the room above the bar's bottom, in points. */
const W = 300, ROOM = 452;
const BAR_H = 64, BUTTON = 44, JOINED = liquid.joined;
const BAR_W = W - (BUTTON + JOINED) * 2;
/** The bar's top in the box. */
const Y0 = ROOM - BAR_H;
const BAR: Rect = { x: 0, y: Y0, w: BAR_W, h: BAR_H };
const MINI_ART: Rect = { x: 10, y: Y0 + 10, w: 44, h: 44 };
// Lines are the system font's line heights: 18 for 15 pt, 16 for 13 pt, 27 for 22 pt.
const MINI_TITLE: Rect = { x: 66, y: Y0 + 10.5, w: BAR_W - 86, h: 18 };
const MINI_ARTIST: Rect = { x: 66, y: Y0 + 30.5, w: BAR_W - 86, h: 16 };
const HAIRLINE: Rect = { x: 66, y: Y0 + 51.5, w: BAR_W - 86, h: 2 };
const PLAY_MINI = { x: BAR_W + JOINED + BUTTON / 2, y: Y0 + BAR_H / 2, side: BUTTON };
const FWD_OFFSET = BUTTON + JOINED;

const PLAY_SIDE = 72, SKIP_SIDE = 52;
const SKIP_OFFSET = PLAY_SIDE / 2 + liquid.apart + SKIP_SIDE / 2;
const TRANSPORT = PLAY_SIDE + liquid.apart;
/** Header 34, 18, the lines 27 + 2 + 18, 12, the scrubber 30, the times 16, 20 under them. */
const FIXED = 34 + 18 + 47 + 12 + 30 + 16 + 20;
const ART = Math.min(W - 40, ROOM - TRANSPORT - FIXED);
const CARD_W = Math.min(W, ART + 40);
const CARD: Rect = { x: (W - CARD_W) / 2, y: ROOM - TRANSPORT - FIXED - ART, w: CARD_W, h: FIXED + ART };
const CARD_ART: Rect = { x: CARD.x + 20, y: CARD.y + 34, w: ART, h: ART };
const CARD_TITLE: Rect = { x: CARD.x + 20, y: CARD_ART.y + ART + 18, w: CARD_W - 40, h: 27 };
const CARD_ARTIST: Rect = { x: CARD.x + 20, y: CARD_TITLE.y + 29, w: CARD_W - 40, h: 18 };
const SCRUB: Rect = { x: CARD.x + 20, y: CARD_ARTIST.y + 30, w: CARD_W - 40, h: 30 };
const TIMES: Rect = { x: CARD.x + 20, y: SCRUB.y + 30, w: CARD_W - 40, h: 16 };
const PLAY_CARD = { x: W / 2, y: ROOM - PLAY_SIDE / 2, side: PLAY_SIDE };
const PULL_LIMIT = 150;

const TRACKS = [
  { title: "Slow Mornings", artist: "Aster Vale", duration: 222 },
  { title: "Paper Lanterns", artist: "Aster Vale", duration: 245 },
] as const;

// ---------------------------------------------------------------- The storyboard

type Step = {
  /** What happens, for people (and the launch video). */
  label: string;
  ms: number;
  /** The card's layout, rather than the bar's. */
  open: boolean;
  track: 0 | 1;
  playing: boolean;
  /** The playback position at the start of the step, in seconds. While playing, the app's clock runs on from it. */
  time: number;
  /** The grabber, scrubber and times. */
  controls: boolean;
  /** The title and artist: they blur out while they fly, so they never cross the growing artwork. */
  lines: boolean;
  /** Previous and next out of play. */
  buds: boolean;
  /** Forward out of play, joined to it. */
  fwd: boolean;
  press?: "bar" | "play" | "next";
  /** How far the finger has pulled the bar up, in points (the glass follows through the rubber band). */
  pull?: number;
  /** How far the card is dragged down, in points. */
  drop?: number;
  /** The finger's place on the track, 0 to 1. */
  scrub?: number;
  /** Where the finger is, in points of the player box. Not drawn (the glass it holds shows the touch); it places the finger in the launch video. */
  finger?: [number, number];
  /** The finger moves over this step: everything under it tracks linearly. */
  tracked?: boolean;
};

const ease = (x: number) => x * x * (3 - 2 * x);

/** About 11 s. The clock runs between steps while playing, as the app's player would. */
const STEPS: readonly Step[] = (() => {
  const out: Step[] = [];
  let s: Omit<Step, "label" | "ms"> = { open: false, track: 0, playing: true, time: 48, controls: false, lines: true, buds: false, fwd: true };
  const push = (label: string, ms: number, patch: Partial<Step> = {}) => {
    const next = { ...s, press: undefined, pull: undefined, drop: undefined, scrub: undefined, finger: undefined, tracked: undefined, ...patch };
    out.push({ label, ms, ...next });
    s = { ...next, time: next.playing && next.scrub === undefined ? Math.min(next.time + ms / 1000, TRACKS[next.track].duration) : next.time };
  };
  push("Rest: the mini player, playing; the red hairline creeps", 1400);
  const lift: [number, number] = [116, Y0 + 30];
  push("A finger lands on the bar; it sinks", 180, { press: "bar", finger: lift });
  for (let k = 1; k <= 4; k++) {
    const travel = 118 * ease(k / 4);
    push("Pull up: the glass stretches after the finger", 135, { pull: travel, finger: [lift[0], lift[1] - travel], tracked: true });
  }
  push("Release: forward melts into play, the glass grows into the card, the artwork and play fly", 280, { open: true, fwd: false, lines: false });
  push("The lines blur in at the card's size, its controls follow, previous and next bud out of play", 900, { open: true, lines: true, controls: true, buds: true });
  push("Open, playing", 700);
  push("Next dips", 140, { press: "next" });
  push("The title morphs to Paper Lanterns, the artwork blurs into the new one, the time starts over", 1200, { track: 1, time: 0 });
  const from = s.time / TRACKS[1].duration;
  push("A finger lands on the thumb; it swells", 220, { scrub: from });
  for (let k = 1; k <= 7; k++) push("Scrub: the thumb and the times follow", 100, { scrub: from + (0.66 - from) * ease(k / 7), tracked: true });
  push("Held", 180, { scrub: 0.66 });
  push("Release: one seek, and playback carries on from there", 700, { time: 0.66 * TRACKS[1].duration });
  push("Pause dips", 140, { press: "play" });
  push("Paused: the glyph swaps", 800, { playing: false });
  const grab: [number, number] = [W / 2, CARD.y + 13];
  push("A finger takes the grabber", 200, { finger: grab });
  for (let k = 1; k <= 4; k++) push("Drag down: the card follows", 100, { drop: 30 * ease(k / 4), finger: [grab[0], grab[1] + 30 * ease(k / 4)], tracked: true });
  push("Release with a flick: the controls blur out and previous and next melt home", 130, { drop: 30, controls: false, buds: false, lines: false });
  push("The card folds into the bar and play flies home", 330, { open: false, drop: 0 });
  push("Forward buds back out of play, joined to it", 700, { fwd: true, lines: true });
  push("Play dips", 140, { press: "play" });
  push("Playing again", 900, { playing: true });
  return out;
})();

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
function useSteps(steps: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return { s: steps[i], prev: steps[(i + steps.length - 1) % steps.length], reduced };
}

/** The app's clock: from the step's time, five ticks a second while playing. */
function useClock(s: Step, reduced: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!s.playing || s.scrub !== undefined || reduced) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 200);
    return () => window.clearInterval(id);
  }, [s, reduced]);
  const duration = TRACKS[s.track].duration;
  return s.scrub !== undefined ? s.scrub * duration : Math.min(s.time + elapsed, duration);
}

// ---------------------------------------------------------------- Pieces of the picture

/** The SF Symbols the Swift piece draws, as paths in a 24 point box. */
const glyphs = {
  play: "M7.5 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8c-.7-.5-1.6 0-1.6.8Z",
  pause: "M6 4.5h3.6c.6 0 1 .4 1 1v13c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-13c0-.6.4-1 1-1Zm8.4 0H18c.6 0 1 .4 1 1v13c0 .6-.4 1-1 1h-3.6c-.6 0-1-.4-1-1v-13c0-.6.4-1 1-1Z",
  forward: "M2 7.1v9.8c0 .8.9 1.2 1.5.8L11 12.8v4.1c0 .8.9 1.2 1.5.8l7.6-5c.6-.4.6-1.2 0-1.6l-7.6-5c-.6-.4-1.5 0-1.5.8v4.1L3.5 6.3C2.9 5.9 2 6.3 2 7.1Z",
} as const;

function Glyph({ name, size, flip, style }: { name: keyof typeof glyphs; size: string; flip?: boolean; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, transform: flip ? "scaleX(-1)" : undefined, ...style }}>
      <path d={glyphs[name]} fill="currentColor" />
    </svg>
  );
}

/** The two covers, block art as the Swift example draws it: a butter sun over a sage hill on sky; lilac with lanterns. */
function Cover({ track }: { track: 0 | 1 }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
      {track === 0 ? (
        <>
          <rect width="100" height="100" fill={blocks.sky} />
          <circle cx="67" cy="31" r="15" fill={blocks.butter} />
          <path d="M0 70 C30 48 62 50 100 62 L100 100 L0 100Z" fill={blocks.sage} />
          <path d="M0 86 C36 74 70 80 100 84 L100 100 L0 100Z" fill={blocks.sand} />
        </>
      ) : (
        <>
          <rect width="100" height="100" fill={blocks.lilac} />
          {([[26, 50, 15, blocks.butter], [56, 36, 12, blocks.sand], [78, 60, 10, blocks.sky]] as const).map(([x, y, r, fill]) => (
            <g key={x}>
              <rect x={x - 0.4} y={0} width={0.8} height={y - r} fill={ink} />
              <circle cx={x} cy={y} r={r} fill={fill} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

const clock = (seconds: number) => {
  const whole = Math.max(Math.floor(seconds), 0);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const place = (r: Rect): CSSProperties => ({ position: "absolute", left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });

const KEYFRAMES = [
  "@keyframes np-in{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}",
  "@keyframes np-out{from{opacity:1;filter:none}to{opacity:0;filter:blur(8px)}}",
  "@keyframes np-swap{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}",
].join("");

export function NowPlayingPreview() {
  const { s, prev, reduced } = useSteps(STEPS);
  const now = useClock(s, reduced);
  const track = TRACKS[s.track];
  const progress = Math.min(now / track.duration, 1);

  // The cover that is leaving blurs out under the new one.
  const [leaving, setLeaving] = useState<0 | 1 | null>(null);
  const lastTrack = useRef(s.track);
  useEffect(() => {
    if (lastTrack.current === s.track) return;
    setLeaving(lastTrack.current);
    lastTrack.current = s.track;
    const timer = window.setTimeout(() => setLeaving(null), 460);
    return () => window.clearTimeout(timer);
  }, [s.track]);

  // Ticks of the app's clock creep linearly; a jump (a new track, a seek, the loop) lands on `value`, never overshooting.
  const lastNow = useRef(now);
  const jumped = Math.abs(now - lastNow.current) > 1.2;
  useEffect(() => { lastNow.current = now; });
  const progressT = (props: string[]) => (s.tracked && s.scrub !== undefined ? tracking(props, s.ms) : jumped ? t(props, "value") : tracking(props, 200));

  // The layout morph: a finger tracks linearly; opening is `reveal`, closing `dismiss`.
  const geo = (props: string[]) => (s.tracked ? tracking(props, s.ms) : t(props, s.open ? "reveal" : "dismiss"));
  const stretch = s.pull ? rubberBand(s.pull, PULL_LIMIT) : 0;
  const surf: Rect = s.open ? CARD : { ...BAR, y: BAR.y - stretch, h: BAR.h + stretch };
  const play = s.open ? PLAY_CARD : PLAY_MINI;
  const drop = s.drop ?? 0;

  const art = s.open ? CARD_ART : MINI_ART;
  const line = (title: boolean): CSSProperties => {
    const r = title ? (s.open ? CARD_TITLE : MINI_TITLE) : s.open ? CARD_ARTIST : MINI_ARTIST;
    const scale = s.open ? 1 : title ? 15 / 22 : 13 / 15;
    return {
      position: "absolute", left: u(r.x), top: u(r.y), width: u(r.w / scale), height: u(r.h / scale),
      transform: `scale(${scale})`, transformOrigin: "0 0", display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden",
      fontSize: u(title ? 22 : 15), lineHeight: 1, color: title ? ground.text : ground.muted,
      opacity: s.lines ? 1 : 0, filter: `blur(${s.lines ? 0 : 5}px)`,
      transition: [geo(["left", "top", "width", "height", "transform"]), s.lines ? t(["opacity", "filter"], "reveal") : "opacity 100ms ease-out, filter 100ms ease-out"].join(", "),
    };
  };
  const shown = (on: boolean): CSSProperties => ({
    opacity: on ? 1 : 0, filter: `blur(${on ? 0 : 6}px)`,
    transition: on ? t(["opacity", "filter"], "reveal") : t(["opacity", "filter"], "dismiss"),
  });
  const sink = (pressed: boolean, w: number, h: number): CSSProperties => ({
    transform: pressed ? `scale(${pressScale(w, h)})` : "none", transition: t("transform", pressed ? "press" : "release"),
  });
  const scrubbing = s.scrub !== undefined;
  const track6: CSSProperties = { position: "absolute", left: 0, top: "50%", height: u(6), marginTop: u(-3), borderRadius: 999 };

  return (
    // A little more room under the player than over it, for the card dragged down.
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600, paddingBottom: u(16) }}>
      <style>{KEYFRAMES}</style>
      <div style={{ position: "relative", width: u(W), height: u(ROOM), flexShrink: 0, transform: `scale(${K})` }}>
        {/* Dragged down, the whole player follows the finger; let go, it springs home as the card folds. */}
        <div data-motion style={{ position: "absolute", inset: 0, transform: `translateY(${u(drop)})`, transition: s.tracked && s.drop !== undefined ? tracking(["transform"], s.ms) : t("transform", "dismiss") }}>
          <LiquidGroup unit={u(1)} axis="both" style={{ position: "absolute", inset: 0 }}>
            {/* The surface: one glass shape that is the bar, then the card. Under the finger it sinks a little. */}
            <div data-motion style={{ position: "absolute", inset: 0, ...sink(s.press === "bar", BAR_W, BAR_H), transformOrigin: `${u(BAR_W / 2)} ${u(Y0 + BAR_H / 2)}` }}>
              <Liquid radius={s.open ? 34 : BAR_H / 2} style={{ ...place(surf), overflow: "hidden", transition: geo(["left", "top", "width", "height", "border-radius"]) }}>
                {/* The content stays in the box's coordinates while the glass grows around it: this layer moves against the surface. */}
                <div data-motion style={{ position: "absolute", left: u(-surf.x), top: u(-surf.y), width: u(W), height: u(ROOM), transition: geo(["left", "top"]) }}>
                  <div data-motion style={{ ...place(art), overflow: "hidden", borderRadius: u(s.open ? 22 : 12), transition: geo(["left", "top", "width", "height", "border-radius"]) }}>
                    {leaving !== null ? <span key={`out-${leaving}`} style={{ position: "absolute", inset: 0, animation: "np-out 420ms ease-out both" }}><Cover track={leaving} /></span> : null}
                    <span key={`in-${s.track}`} style={{ position: "absolute", inset: 0, animation: leaving !== null ? "np-in 460ms ease-out both" : undefined }}><Cover track={s.track} /></span>
                  </div>
                  <div data-motion style={line(true)}><MorphText text={track.title} /></div>
                  <div data-motion style={line(false)}><MorphText text={track.artist} /></div>
                  {/* The bar's progress: a red hairline along its bottom inner edge, under the lines. */}
                  <div data-motion style={{ ...place(HAIRLINE), borderRadius: 999, overflow: "hidden", background: `color-mix(in srgb, ${ground.text} 14%, transparent)`, opacity: !s.open && s.lines ? 1 : 0, transition: t("opacity", !s.open && s.lines ? "reveal" : "dismiss") }}>
                    <div data-motion style={{ height: "100%", width: `${progress * 100}%`, background: signal.fill, borderRadius: 999, transition: progressT(["width"]) }} />
                  </div>
                  {/* The card's own controls, in after the glass has grown. */}
                  <div data-motion style={{ position: "absolute", inset: 0, ...shown(s.controls) }}>
                    <span style={{ position: "absolute", left: u(W / 2 - 18), top: u(CARD.y + 10.5), width: u(36), height: u(5), borderRadius: 999, background: ground.subtle }} />
                    <div style={place(SCRUB)}>
                      <span style={{ ...track6, right: 0, background: `color-mix(in srgb, ${ground.text} 14%, transparent)` }} />
                      <span data-motion style={{ ...track6, width: `${progress * 100}%`, background: signal.fill, transition: progressT(["width"]) }} />
                      <span data-motion style={{ position: "absolute", top: "50%", left: `${progress * 100}%`, width: u(28), height: u(28), margin: `${u(-14)} 0 0 ${u(-14)}`, transition: progressT(["left"]) }}>
                        <span data-motion style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: paper.surface, boxShadow: `0 ${u(1)} ${u(3)} rgba(0,0,0,.22)`, transform: `scale(${scrubbing ? 1 : 16 / 28})`, transition: t("transform", scrubbing ? "press" : "release") }} />
                      </span>
                    </div>
                    <div className="tabular-nums" style={{ ...place(TIMES), display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: u(13), lineHeight: 1, color: ground.muted }}>
                      <span>{clock(now)}</span>
                      <span>-{clock(Math.ceil(track.duration - now))}</span>
                    </div>
                  </div>
                </div>
              </Liquid>
            </div>
            {/* Forward joined to play while collapsed; previous and next apart from it while open. Each lives inside
                play and buds out of it, and melts back in. Each sits at its rest place, so its press sinks in place. */}
            {(["fwd", "prev", "next"] as const).map((id) => {
              const out = id === "fwd" ? s.fwd : s.buds;
              const side = id === "fwd" ? BUTTON : SKIP_SIDE;
              const dx = id === "fwd" ? FWD_OFFSET : id === "prev" ? -SKIP_OFFSET : SKIP_OFFSET;
              const pressed = id === "next" && s.press === "next";
              return (
                <div key={id} data-motion style={{ position: "absolute", left: u(play.x + dx - side / 2), top: u(play.y - side / 2), width: u(side), height: u(side), transition: geo(["left", "top"]) }}>
                  <div data-motion style={{ width: "100%", height: "100%", ...sink(pressed, side, side) }}>
                    <Liquid bud={{ out, home: [-dx, 0] }} className="flex items-center justify-center" style={{ width: "100%", height: "100%", color: ground.text }}>
                      <BudContent out={out}><Glyph name="forward" size={u(id === "fwd" ? 19 : 23)} flip={id === "prev"} /></BudContent>
                    </Liquid>
                  </div>
                </div>
              );
            })}
            {/* The red play bubble: it flies from the bar's end to the middle of the transport and swells. */}
            <div data-motion style={{ position: "absolute", left: u(play.x - play.side / 2), top: u(play.y - play.side / 2), width: u(play.side), height: u(play.side), transition: geo(["left", "top", "width", "height"]) }}>
              <div data-motion style={{ width: "100%", height: "100%", ...sink(s.press === "play", play.side, play.side) }}>
                <Liquid tint={signal.fill} className="flex items-center justify-center" style={{ width: "100%", height: "100%", color: signal.on }}>
                  <span key={s.playing ? "pause" : "play"} data-motion style={{ display: "flex", width: "42%", height: "42%", animation: prev.playing !== s.playing ? "np-swap 320ms ease-out both" : undefined }}>
                    <Glyph name={s.playing ? "pause" : "play"} size="100%" style={{ transform: s.playing ? undefined : "translateX(4%)" }} />
                  </span>
                </Liquid>
              </div>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}
