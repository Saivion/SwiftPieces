"use client";
// Now Playing in the Playground: the mini player pinned to the bottom of the phone, as the generated screen puts it
// in its bottom safe area inset. Tap the glass bar, or pull it up (it stretches after the pointer and opens past a
// short pull or a flick), and it grows into the card: forward melts into play, the artwork and play fly to their
// places, the scrubber and the times blur in and previous and next bud out of play. Drag the card down, or tap its
// grabber, to fold it back. Play toggles, the skip bubbles change the track (or jump 15 and 30 seconds for a
// podcast), and the track scrubs under the pointer and seeks once on release. A small clock plays the sample, as
// the generated screen's does. Geometry and timings follow NowPlaying.swift.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NOW_PLAYING_COVERS, NOW_PLAYING_DEFAULTS, NOW_PLAYING_NEXT } from "../../../definitions/utility/now-playing.js";
import { ACCENT, ACCENT_INK, b, ff, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer, type RenderProps, type Scheme } from "../env.js";
import { glassSurface } from "../glass.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime } from "../runtime.js";

const BAR_H = 64, BUTTON = 44, JOINED = 4, APART = 26, PLAY = 72, SKIP = 52;
const SKIP_OFFSET = PLAY / 2 + APART + SKIP / 2;
const TRANSPORT = PLAY + APART;
/** Header 34, 18, the lines 27 + 2 + 18, 12, the scrubber 30, the times 16, 20 under them (no scrubber when live). */
const fixedFor = (live: boolean) => 34 + 18 + 47 + 12 + (live ? 0 : 30) + 16 + 20;
const SIDE = 12;
const PULL_LIMIT = 150;
const MORPH = ".46s";
const KEYFRAMES = [
  "@keyframes spnp-in{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}",
  "@keyframes spnp-swap{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}",
  "@media (prefers-reduced-motion: reduce){[data-spnp-motion]{animation:none!important;transition-duration:.18s!important}}",
].join("");

type Rect = { x: number; y: number; w: number; h: number };
const place = (r: Rect): CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h });
const rubber = (over: number, limit: number) => (over <= 0 ? 0 : (1 - 1 / ((over * 0.55) / limit + 1)) * limit);
const clock = (seconds: number) => {
  const whole = Math.max(Math.floor(seconds), 0);
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), sec = String(whole % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** The layout, in points of a box `w` wide whose bottom is the bar's bottom and which reaches `room` above it. */
function layoutFor(w: number, room: number, live: boolean, forward: boolean) {
  const barW = Math.max(w - (BUTTON + JOINED) * (forward ? 2 : 1), BAR_H * 2);
  const y0 = room - BAR_H;
  const lineW = Math.max(barW - 86, 24);
  const fixed = fixedFor(live);
  const maxW = Math.min(w, 440);
  const art = Math.min(maxW - 40, room - TRANSPORT - fixed);
  const compact = art < 150;
  const cardBottom = room - TRANSPORT;
  let card: Rect, cardArt: Rect, cardTitle: Rect, cardArtist: Rect, controls: number;
  if (!compact) {
    const cw = Math.min(maxW, art + 40), cx = (w - cw) / 2;
    card = { x: cx, y: cardBottom - fixed - art, w: cw, h: fixed + art };
    cardArt = { x: cx + (cw - art) / 2, y: card.y + 34, w: art, h: art };
    cardTitle = { x: cx + 20, y: cardArt.y + art + 18, w: cw - 40, h: 27 };
    cardArtist = { x: cx + 20, y: cardTitle.y + 29, w: cw - 40, h: 18 };
    controls = cardArtist.y + 18 + 12;
  } else {
    const cw = maxW, cx = (w - cw) / 2, row = 64;
    const ch = 34 + row + 14 + (live ? 0 : 30) + 16 + 20;
    card = { x: cx, y: cardBottom - ch, w: cw, h: ch };
    cardArt = { x: cx + 20, y: card.y + 34, w: row, h: row };
    const tx = cardArt.x + row + 14, ty = card.y + 34 + (row - 47) / 2;
    cardTitle = { x: tx, y: ty, w: Math.max(card.x + cw - 20 - tx, 24), h: 27 };
    cardArtist = { x: tx, y: ty + 29, w: cardTitle.w, h: 18 };
    controls = card.y + 34 + row + 14;
  }
  const scrub: Rect = { x: card.x + 20, y: controls, w: card.w - 40, h: live ? 0 : 30 };
  return {
    barW, y0, compact,
    bar: { x: 0, y: y0, w: barW, h: BAR_H } as Rect,
    miniArt: { x: 10, y: y0 + 10, w: 44, h: 44 } as Rect,
    miniTitle: { x: 66, y: y0 + 10.5, w: lineW, h: 18 } as Rect,
    miniArtist: { x: 66, y: y0 + 30.5, w: lineW, h: 16 } as Rect,
    hairline: { x: 66, y: y0 + 51.5, w: lineW, h: 2 } as Rect,
    playMini: { x: barW + JOINED + BUTTON / 2, y: y0 + BAR_H / 2 },
    playCard: { x: w / 2, y: room - PLAY / 2 },
    card, cardArt, cardTitle, cardArtist, scrub,
    times: { x: card.x + 20, y: scrub.y + scrub.h, w: card.w - 40, h: 16 } as Rect,
    grabber: { x: card.x + card.w / 2 - 44, y: card.y, w: 88, h: 30 } as Rect,
  };
}

/** The SF Symbols the piece draws, as paths in a 24 point box. */
const PATHS = {
  play: "M7.5 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8c-.7-.5-1.6 0-1.6.8Z",
  pause: "M6 4.5h3.6c.6 0 1 .4 1 1v13c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-13c0-.6.4-1 1-1Zm8.4 0H18c.6 0 1 .4 1 1v13c0 .6-.4 1-1 1h-3.6c-.6 0-1-.4-1-1v-13c0-.6.4-1 1-1Z",
  forward: "M2 7.1v9.8c0 .8.9 1.2 1.5.8L11 12.8v4.1c0 .8.9 1.2 1.5.8l7.6-5c.6-.4.6-1.2 0-1.6l-7.6-5c-.6-.4-1.5 0-1.5.8v4.1L3.5 6.3C2.9 5.9 2 6.3 2 7.1Z",
  note: "M12.2 3.4c0-.7.7-1.2 1.4-.9l4.4 1.7c.7.3 1.2 1 1.2 1.7v2.3c0 .7-.7 1.2-1.4.9l-3.6-1.4v9.4a3.9 3.9 0 1 1-2-3.4V3.4Z",
} as const;

function Icon({ d, size, flip, style }: { d: string; size: number | string; flip?: boolean; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none", display: "block", transform: flip ? "scaleX(-1)" : undefined, ...style }}>
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** `gobackward.15` and `goforward.30`: an open circle with its arrow and the seconds inside. */
function Seconds({ back, amount, size }: { back: boolean; amount: number; size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none", display: "block" }}>
      <g transform={back ? undefined : "translate(24 0) scale(-1 1)"} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.2 4.6A8.6 8.6 0 1 1 3.4 12" />
        <path d="M8.6 1.8 6 4.7l3 2.4" />
      </g>
      <text x="12" y="15.6" textAnchor="middle" fontSize="8.4" fontWeight={600} fill="currentColor" style={{ fontFamily: "inherit" }}>{amount}</text>
    </svg>
  );
}

function Cover({ track, placeholder }: { track: number; placeholder: boolean }) {
  const c = NOW_PLAYING_COVERS;
  if (placeholder) {
    return (
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: c.sand, color: c.ink }}>
        <Icon d={PATHS.note} size="40%" />
      </span>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
      {track % 2 === 0 ? (
        <>
          <rect width="100" height="100" fill={c.sky} />
          <circle cx="67" cy="31" r="15" fill={c.butter} />
          <path d="M0 70 C30 48 62 50 100 62 L100 100 L0 100Z" fill={c.sage} />
          <path d="M0 86 C36 74 70 80 100 84 L100 100 L0 100Z" fill={c.sand} />
        </>
      ) : (
        <>
          <rect width="100" height="100" fill={c.lilac} />
          {c.lanterns.map(([x, y, r, fill]) => (
            <g key={x}>
              <rect x={x - 0.4} y={0} width={0.8} height={y - r} fill={c.ink} />
              <circle cx={x} cy={y} r={r} fill={fill} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

/** The phone-wide overlay, once the device has mounted it. */
function useOverlay() {
  const rt = useRuntime();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(rt.overlay()), [rt]);
  return el;
}

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

const reset: CSSProperties = { border: 0, margin: 0, padding: 0, font: "inherit", color: "inherit", background: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" };

export const renderer: Renderer = (r) => {
  const overlay = useOverlay();
  const rt = useRuntime();
  const still = rt.still === true;
  // Pinned to the bottom of the phone, as the generated screen's safe area inset puts it. A still picture has no
  // overlay, so it draws the bar in place.
  if (overlay && !still) return <>{createPortal(<Player r={r} overlay={overlay} />, overlay)}</>;
  return <Player r={r} overlay={null} />;
};

function Player({ r, overlay }: { r: RenderProps; overlay: HTMLElement | null }) {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;

  const skipping = s(p, "skipping");
  const tracks = skipping === "tracks";
  const duration0 = Math.min(Math.max(Math.round(n(p, "duration")), 0), 7200);
  const live = duration0 === 0;
  const placeholder = s(p, "artwork") === "placeholder";
  const forward = skipping !== "none" && !(skipping === "podcast" && live);
  const scrubs = b(p, "scrubs") && !live;

  const [open, setOpen] = useLive(b(p, "expanded"));
  const [playing, setPlaying] = useLive(b(p, "playing"));
  const [track, setTrack] = useLive(0);
  const [time, setTime] = useLive(Math.min(Math.max(n(p, "position"), 0), duration0 || 7200));
  // The choreography's own beats: the card's controls and the skip bubbles, the lines, and forward.
  const [extras, setExtras] = useLive(b(p, "expanded"));
  const [lines, setLines] = useState(true);
  const [fwdOut, setFwdOut] = useLive(!b(p, "expanded"));
  const [stretch, setStretch] = useState(0);
  const [drop, setDrop] = useState(0);
  const [held, setHeld] = useState<"pull" | "drop" | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(640);
  const [width, setWidth] = useState(366);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const title = tracks && track === 1 ? NOW_PLAYING_NEXT.title : s(p, "title").trim() || NOW_PLAYING_DEFAULTS.title;
  const artist = tracks && track === 1 ? NOW_PLAYING_NEXT.artist : s(p, "artist").trim();
  const duration = tracks && track === 1 ? NOW_PLAYING_NEXT.duration : duration0;
  const shownTime = scrub ?? time;
  const progress = live ? 0 : Math.min(Math.max(shownTime / Math.max(duration, 1), 0), 1);

  // The phone's room above the bar: its height, less the status bar and the home indicator (or the tab bar).
  const tabs = !!overlay?.parentElement?.classList.contains("has-tabs");
  const bottom = tabs ? 91 : 42;
  useEffect(() => {
    const el = overlay ?? boxRef.current?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const k = rt.scale() || 1;
      const rect = el.getBoundingClientRect();
      if (overlay) setRoom(Math.max(rect.height / k - bottom - 67, 200));
      setWidth(Math.max((overlay ? rect.width / k : rect.width / k) - (overlay ? SIDE * 2 : 0), 240));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay, bottom, rt]);

  // A still picture draws in place: the bar, or the open card with the room a phone gives it.
  const inline = open ? 600 : BAR_H + 4;
  const g = layoutFor(width, overlay ? room : inline, live, forward);

  // The app's clock, twice a second while playing (the generated screen runs the same). Nothing plays in a still.
  useEffect(() => {
    if (!playing || live || still) return;
    const id = window.setInterval(() => setTime((t) => Math.min(t + 0.5, duration)), 500);
    return () => window.clearInterval(id);
  }, [playing, live, still, duration, setTime]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  /** Opening: forward melts into play, the glass grows, then the lines, controls and skip bubbles come in. Closing
   *  runs it backwards, folding a beat after the controls leave. */
  const present = (next: boolean, el: Element | null) => {
    clear();
    if (next) {
      setFwdOut(false);
      setLines(false);
      setOpen(true);
      setStretch(0);
      setDrop(0);
      later(220, () => { setLines(true); setExtras(true); });
      later(520, () => rt.haptic("soft", el));
    } else {
      setExtras(false);
      setLines(false);
      later(110, () => { setOpen(false); setDrop(0); });
      later(390, () => { setLines(true); setFwdOut(true); rt.haptic("soft", el); });
    }
  };

  const skipTo = (back: boolean, el: Element | null) => {
    rt.haptic("selection", el);
    if (tracks) {
      setSwapFrom(track);
      setTrack((t) => (t + 1) % 2);
      setTime(0);
      later(460, () => setSwapFrom(null));
    } else {
      const jump = back ? -15 : 30;
      setTime((t) => Math.min(Math.max(t + jump, 0), duration));
    }
  };

  // The surface: a tap opens; an upward pull stretches the bar (or, open, a downward drag carries the card).
  const surfaceDrag = useDrag({
    axis: "y",
    onStart() {
      setPressed(null);
      setHeld(open ? "drop" : "pull");
    },
    onMove({ dy }) {
      if (open) setDrop(dy >= 0 ? dy : -rubber(-dy, 36));
      else setStretch(reduced ? 0 : rubber(-dy, PULL_LIMIT));
    },
    onEnd({ dy, vy, el }) {
      setHeld(null);
      const projected = dy + (vy / 1000) * 0.99 / 0.01;
      if (!open) {
        if (-projected > 72) present(true, el);
        else setStretch(0);
      } else if (projected > Math.max(110, g.card.h * 0.22)) {
        present(false, el);
      } else {
        setDrop(0);
      }
    },
  });

  const onSurfaceDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!open) setPressed("bar");
    surfaceDrag(e);
  };
  const onSurfaceClick = (e: ReactMouseEvent<HTMLElement>) => {
    setPressed(null);
    if (!open) { rt.haptic("light", e.currentTarget); present(true, e.currentTarget); return; }
    // Open, a tap on the grabber closes.
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const k = rt.scale() || 1;
    const x = (e.clientX - box.left) / k, y = (e.clientY - box.top) / k;
    const z = g.grabber;
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) present(false, e.currentTarget);
  };

  // The scrubber: the thumb jumps under the pointer and swells; the seek lands once on release.
  const scrubAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / Math.max(rect.width, 1), 0), 1) * duration;
  };
  const onScrubDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubs || e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    rt.haptic("selection", e.currentTarget);
    setScrub(scrubAt(e.clientX));
  };
  const onScrubMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub !== null) setScrub(scrubAt(e.clientX));
  };
  const onScrubUp = () => {
    if (scrub === null) return;
    setTime(scrub);
    setScrub(null);
  };

  const geo = (props: string[]) => (held ? "none" : props.map((x) => `${x} ${MORPH} ${open ? BOUNCE : SPRING}`).join(", "));
  const stretchRect: Rect = { ...g.bar, y: g.bar.y - stretch, h: g.bar.h + stretch };
  const surf = open ? g.card : stretchRect;
  const play = open ? { ...g.playCard, side: PLAY } : { ...g.playMini, side: BUTTON };
  const glass = glassSurface(r.scheme as Scheme);
  // The surface carries text over whatever the screen shows, so its frost is denser than a button's.
  const frost: CSSProperties = {
    ...glass,
    background: r.scheme === "dark" ? "rgba(30,30,32,.74)" : "rgba(255,255,255,.8)",
    backdropFilter: "blur(24px) saturate(1.6)",
    WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  };
  const text = houseVar("text"), muted = houseVar("muted");
  const lineStyle = (isTitle: boolean): CSSProperties => {
    const rect = isTitle ? (open ? g.cardTitle : g.miniTitle) : open ? g.cardArtist : g.miniArtist;
    const scale = open ? 1 : isTitle ? 15 / 22 : 13 / 15;
    return {
      position: "absolute", left: rect.x, top: rect.y, width: rect.w / scale, height: rect.h / scale,
      transform: `scale(${scale})`, transformOrigin: "0 0", display: "flex", alignItems: "center",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      fontFamily: ff("inherit"), fontSize: ts(isTitle ? 22 : 15), fontWeight: fw(600), lineHeight: 1, color: isTitle ? text : muted,
      opacity: lines ? 1 : 0, filter: `blur(${lines ? 0 : 5}px)`,
      transition: [geo(["left", "top", "width", "height", "transform"]), lines ? "opacity .3s ease-out, filter .3s ease-out" : "opacity .1s ease-out, filter .1s ease-out"].join(", "),
    };
  };
  const sink = (id: string, size: number): CSSProperties => ({
    transform: pressed === id && !reduced ? `scale(${Math.max(1 - 5 / size, 0.92)})` : "none",
    transition: `transform ${pressed === id ? ".12s ease-out" : `.42s ${BOUNCE}`}`,
  });
  const press = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.stopPropagation(); setPressed(id); },
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed((x) => (x === id ? null : x)),
  });

  const bubble = (id: "fwd" | "prev" | "next") => {
    const out = id === "fwd" ? fwdOut && !open : extras && open;
    const side = id === "fwd" ? BUTTON : SKIP;
    const dx = id === "fwd" ? BUTTON + JOINED : id === "prev" ? -SKIP_OFFSET : SKIP_OFFSET;
    const back = id === "prev";
    const label = tracks ? (back ? "Previous track" : "Next track") : back ? "Skip back 15 seconds" : "Skip forward 30 seconds";
    return (
      <div key={id} data-spnp-motion style={{ position: "absolute", left: play.x - side / 2, top: play.y - side / 2, width: side, height: side, transition: geo(["left", "top"]), zIndex: 1 }}>
        <button
          type="button"
          aria-label={label}
          aria-hidden={out ? undefined : true}
          tabIndex={out ? 0 : -1}
          {...press(id)}
          onClick={(e) => { e.stopPropagation(); if (out) skipTo(back, e.currentTarget); }}
          data-spnp-motion
          style={{
            ...reset, ...glass, position: "absolute", inset: 0, borderRadius: "50%", display: "grid", placeItems: "center", color: text,
            pointerEvents: out ? "auto" : "none",
            transform: `translateX(${out ? dx : 0}px) scale(${out ? 1 : 0.72})`, opacity: out ? 1 : 0,
            transition: out ? `transform .62s ${BOUNCE}, opacity .3s ease-out .1s` : `transform .5s ${SPRING}, opacity .14s ease-out`,
          }}
        >
          <span data-spnp-motion style={{ display: "grid", ...sink(id, side) }}>
            {tracks ? <Icon d={PATHS.forward} size={id === "fwd" ? 18 : 22} flip={back} /> : <Seconds back={back} amount={back ? 15 : 30} size={id === "fwd" ? 22 : 26} />}
          </span>
        </button>
      </div>
    );
  };

  const covers = (k: number): ReactNode => (
    <span key={`c${k}`} style={{ position: "absolute", inset: 0, animation: swapFrom !== null && k === track ? "spnp-in .46s ease-out both" : undefined }}>
      <Cover track={k} placeholder={placeholder} />
    </span>
  );

  const content = (
    <div
      ref={boxRef}
      {...r.box}
      aria-label={open ? undefined : `Now playing, ${title}, ${artist}`}
      style={{
        ...r.box.style,
        ...(overlay ? { position: "absolute", left: SIDE, right: SIDE, bottom, height: room } : { ...fillStyle(r.fill, axis), position: "relative", height: inline }),
        pointerEvents: "none", color: text, fontFamily: ff("inherit"),
      }}
    >
      <style>{KEYFRAMES}</style>
      <div data-spnp-motion style={{ position: "absolute", inset: 0, transform: `translateY(${drop}px)`, transition: held === "drop" ? "none" : `transform ${MORPH} ${SPRING}` }}>
        {/* The surface: one glass shape that is the bar, then the card. Its content is placed in the box and moved
            against the surface, so the artwork and the lines fly on their own paths while the glass grows. */}
        <div
          role={open ? undefined : "button"}
          onPointerDown={onSurfaceDown}
          onPointerUp={() => setPressed(null)}
          onClick={onSurfaceClick}
          data-spnp-motion
          style={{
            ...frost, ...place(surf), borderRadius: open ? 34 : BAR_H / 2, overflow: "hidden", pointerEvents: "auto", touchAction: "none", cursor: open ? "grab" : "pointer",
            transform: pressed === "bar" && !reduced ? "scale(.97)" : "none",
            transition: [geo(["left", "top", "width", "height", "border-radius"]), `transform ${pressed === "bar" ? ".12s ease-out" : `.42s ${BOUNCE}`}`].join(", "),
          }}
        >
          <div data-spnp-motion style={{ position: "absolute", left: -surf.x, top: -surf.y, width, height: overlay ? room : inline, transition: geo(["left", "top"]) }}>
            <div data-spnp-motion style={{ ...place(open ? g.cardArt : g.miniArt), overflow: "hidden", borderRadius: open ? (g.compact ? 14 : 22) : 12, transition: geo(["left", "top", "width", "height", "border-radius"]) }}>
              {swapFrom !== null ? covers(swapFrom) : null}
              {covers(track)}
            </div>
            <div style={lineStyle(true)}>{title}</div>
            <div style={lineStyle(false)}>{artist}</div>
            {/* The bar's progress: a red hairline along its bottom inner edge, under the lines. */}
            {!live ? (
              <div style={{ ...place(g.hairline), borderRadius: 2, overflow: "hidden", background: `color-mix(in srgb, ${text} 14%, transparent)`, opacity: !open && lines ? 1 : 0, transition: "opacity .25s" }}>
                <div style={{ height: "100%", width: `${progress * 100}%`, background: ACCENT, transition: scrub !== null ? "none" : "width .5s linear" }} />
              </div>
            ) : null}
            {/* The card's own controls, in after the glass has grown. */}
            <div data-spnp-motion style={{ position: "absolute", inset: 0, opacity: extras && open ? 1 : 0, filter: `blur(${extras && open ? 0 : 6}px)`, transition: "opacity .3s ease-out, filter .3s ease-out", pointerEvents: extras && open ? "auto" : "none" }}>
              <span style={{ position: "absolute", left: g.card.x + g.card.w / 2 - 18, top: g.card.y + 10.5, width: 36, height: 5, borderRadius: 3, background: houseVar("muted"), opacity: 0.6 }} />
              {!live ? (
                <div
                  ref={trackRef}
                  role="slider"
                  aria-label="Playback position"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                  aria-valuenow={Math.round(shownTime)}
                  aria-valuetext={`${clock(shownTime)} of ${clock(duration)}`}
                  onPointerDown={onScrubDown}
                  onPointerMove={onScrubMove}
                  onPointerUp={onScrubUp}
                  onPointerCancel={() => setScrub(null)}
                  style={{ ...place(g.scrub), touchAction: "none", cursor: scrubs ? "pointer" : "default" }}
                >
                  <span style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 6, marginTop: -3, borderRadius: 3, background: `color-mix(in srgb, ${text} 14%, transparent)` }} />
                  <span style={{ position: "absolute", left: 0, top: "50%", height: 6, marginTop: -3, borderRadius: 3, width: `${progress * 100}%`, background: ACCENT, transition: scrub !== null ? "none" : "width .5s linear" }} />
                  {scrubs ? (
                    <span style={{ position: "absolute", top: "50%", left: `${progress * 100}%`, width: 28, height: 28, margin: "-14px 0 0 -14px", transition: scrub !== null ? "none" : "left .5s linear" }}>
                      <span data-spnp-motion style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,.22)", transform: `scale(${scrub !== null ? 1 : 16 / 28})`, transition: `transform ${scrub !== null ? ".14s ease-out" : `.42s ${BOUNCE}`}` }} />
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div style={{ ...place(g.times), display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", color: muted, lineHeight: 1 }}>
                {live ? <span>Live</span> : (<><span>{clock(shownTime)}</span><span>-{clock(Math.ceil(duration - shownTime))}</span></>)}
              </div>
            </div>
          </div>
        </div>
        {forward ? (["fwd", "prev", "next"] as const).map(bubble) : null}
        {/* The red play bubble: it flies from the bar's end to the middle of the transport and swells. */}
        <div data-spnp-motion style={{ position: "absolute", left: play.x - play.side / 2, top: play.y - play.side / 2, width: play.side, height: play.side, transition: geo(["left", "top", "width", "height"]), zIndex: 2 }}>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            {...press("play")}
            onClick={(e) => { e.stopPropagation(); setPlaying((x) => !x); rt.haptic("light", e.currentTarget); }}
            style={{ ...reset, position: "absolute", inset: 0, borderRadius: "50%", background: ACCENT, color: ACCENT_INK, display: "grid", placeItems: "center", pointerEvents: "auto", boxShadow: "inset 0 1px 1.5px rgba(255,255,255,.35), 0 4px 12px rgba(0,0,0,.18)", ...sink("play", play.side) }}
          >
            <span key={playing ? "pause" : "play"} data-spnp-motion style={{ display: "grid", width: "42%", height: "42%", animation: "spnp-swap .32s ease-out both" }}>
              <Icon d={playing ? PATHS.pause : PATHS.play} size="100%" style={{ transform: playing ? undefined : "translateX(4%)" }} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
  return content;
}
