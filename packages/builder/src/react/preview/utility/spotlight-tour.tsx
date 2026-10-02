"use client";
// Spotlight Tour in the Playground: the components inside it are its stops (plain placeholder targets when
// it is empty). Presented, it dims the whole phone around the current stop through a cutout that springs
// from stop to stop, draws a red ring around it and sets a callout below or above it with Skip and Next.
// Taps inside the cutout reach the real component and move the tour on; taps on the dim nudge the callout;
// swipe the callout to go on or back. While its screen is covered (a push, another tab, a sheet) it steps
// aside and comes back at the same stop. On still pictures it shows its first stop in place. Mirrors
// SpotlightTour.swift.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { stopCopy, stopCount } from "../../../definitions/utility/spotlight-tour.js";
import { ACCENT, ACCENT_INK, Frame, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { SPRING, useDrag, useLive, useRuntime } from "../runtime.js";

type Rect = { x: number; y: number; w: number; h: number };
type Hole = Rect & { r: number };
type Geo = { W: number; H: number; targets: Array<Rect | null> };

/** The phone's safe area in points: the status bar above, the home indicator below. */
const SAFE_TOP = 59;
const SAFE_BOTTOM = 34;
const PAD = 8;
const RING = 2;
const GAP = 16;
const CARD_MAX = 360;
const NUB_W = 20;
const NUB_H = 9;

const KEYFRAMES = [
  "@keyframes sptour-draw{from{stroke-dashoffset:1;opacity:1}to{stroke-dashoffset:0;opacity:1}}",
  "@keyframes sptour-text{from{opacity:0}to{opacity:1}}",
  "@media (prefers-reduced-motion: reduce){[data-sptour-motion]{animation:none!important;transition:none!important}}",
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

function useOverlay() {
  const rt = useRuntime();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(rt.overlay()), [rt]);
  return el;
}

/** The cutout around a target, as the Swift's `.automatic` picks it: a circle, a capsule or a rounded rectangle. */
function holeFor(t: Rect): Hole {
  const long = Math.max(t.w, t.h);
  const short = Math.min(t.w, t.h);
  if (long <= 64 && long - short <= long * 0.25) {
    const d = long + PAD * 2;
    return { x: t.x + t.w / 2 - d / 2, y: t.y + t.h / 2 - d / 2, w: d, h: d, r: d / 2 };
  }
  const rect = { x: t.x - PAD, y: t.y - PAD, w: t.w + PAD * 2, h: t.h + PAD * 2 };
  if (t.h <= 52 && t.w >= t.h * 1.6) return { ...rect, r: rect.h / 2 };
  return { ...rect, r: Math.min(18 + PAD, rect.w / 2, rect.h / 2) };
}

const grow = (h: Hole, by: number): Hole => ({ x: h.x - by, y: h.y - by, w: h.w + by * 2, h: h.h + by * 2, r: h.r + by });

/** A rounded rectangle from the top centre, clockwise: the ring draws in from the top. */
function roundedPath({ x, y, w, h, r }: Hole) {
  const R = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M ${x + w / 2} ${y} H ${x + w - R} A ${R} ${R} 0 0 1 ${x + w} ${y + R} V ${y + h - R} A ${R} ${R} 0 0 1 ${x + w - R} ${y + h} H ${x + R} A ${R} ${R} 0 0 1 ${x} ${y + h - R} V ${y + R} A ${R} ${R} 0 0 1 ${x + R} ${y} Z`;
}

/** Below the target when it fits, else above, else the roomier side, inside `safe`; the nub under the target's centre. */
function place(hole: Hole, safe: Rect, width: number, height: number) {
  const t = { x: hole.x - RING, y: hole.y - RING, w: hole.w + RING * 2, h: hole.h + RING * 2 };
  const fitsBelow = t.y + t.h + GAP + height <= safe.y + safe.h;
  const fitsAbove = t.y - GAP - height >= safe.y;
  const below = fitsBelow || (!fitsAbove && safe.y + safe.h - (t.y + t.h) >= t.y - safe.y);
  let y = below ? t.y + t.h + GAP : t.y - GAP - height;
  y = Math.min(Math.max(y, safe.y), Math.max(safe.y + safe.h - height, safe.y));
  const x = Math.min(Math.max(t.x + t.w / 2 - width / 2, safe.x), Math.max(safe.x + safe.w - width, safe.x));
  const overlaps = y + height - 2 > t.y && y + 2 < t.y + t.h && x < t.x + t.w && x + width > t.x;
  const inset = 26 * 0.8 + NUB_W / 2;
  const nub = x + inset <= x + width - inset ? Math.min(Math.max(t.x + t.w / 2, x + inset), x + width - inset) : x + width / 2;
  return { x, y, below, nub: nub - x, nubShown: !overlaps };
}

const onScreen = (r: Rect, W: number, H: number) => {
  const w = Math.min(r.x + r.w, W) - Math.max(r.x, 0);
  const h = Math.min(r.y + r.h, H) - Math.max(r.y, 0);
  return r.w >= 1 && r.h >= 1 && w > 0 && h > 0 && w * h >= r.w * r.h * 0.5;
};

/**
 * Whether the tour's own screen is the one in front in the Playground phone: not pushed under another
 * screen, in a hidden tab or behind a sheet. Away from the phone (no screen around it) it always is.
 */
function inFront(frame: HTMLElement, els: Array<HTMLElement | null>): boolean {
  const screen = els.find(Boolean)?.closest<HTMLElement>(".spp-screen");
  if (!screen) return true;
  const phone = frame.closest<HTMLElement>(".spb-phone");
  if (!phone) return true;
  const tops = Array.from(phone.querySelectorAll<HTMLElement>('.spp-screen[data-role="top"]')).filter((s) => !s.closest(".spp-tab[hidden]"));
  return tops[tops.length - 1] === screen;
}

const sameGeo = (a: Geo | null, b: Geo) =>
  !!a && Math.abs(a.W - b.W) < 0.5 && Math.abs(a.H - b.H) < 0.5 && a.targets.length === b.targets.length &&
  a.targets.every((t, i) => {
    const u = b.targets[i];
    return t === u || (!!t && !!u && Math.abs(t.x - u.x) < 0.5 && Math.abs(t.y - u.y) < 0.5 && Math.abs(t.w - u.w) < 0.5 && Math.abs(t.h - u.h) < 0.5);
  });

// ---------------------------------------------------------------- Placeholders

const PIN = "M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z";

function Icon({ d, size, width = 2.2 }: { d: string; size: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: "block", flex: "none" }}>
      <path d={d} />
    </svg>
  );
}

const bar = (w: number, color: string): CSSProperties => ({ width: w, height: 8, borderRadius: cr(4), background: color, display: "block" });

/** What an empty tour points at: a search capsule, three rows with a pin, a round add button (stops 2, 3 and 1). */
function Placeholders() {
  return (
    <>
      <div data-sptour-spot="1" style={{ alignSelf: "stretch", height: 46, borderRadius: cr(999), background: houseVar("field"), display: "flex", alignItems: "center", gap: 10, padding: "0 16px", color: houseVar("muted") }}>
        <Icon d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.6-4.6" size={17} width={2.4} />
        <span style={bar(96, "color-mix(in srgb, var(--h-muted) 30%, transparent)")} />
      </div>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: cr(18), background: houseVar("surface") }}>
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: houseVar("field"), flex: "none" }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={bar(128, "color-mix(in srgb, var(--h-muted) 30%, transparent)")} />
            <span style={bar(84, houseVar("field"))} />
          </span>
          <span data-sptour-spot={row === 0 ? "2" : undefined} style={{ width: 36, height: 36, borderRadius: "50%", background: houseVar("field"), color: houseVar("muted"), display: "grid", placeItems: "center", flex: "none" }}>
            <Icon d={PIN} size={16} />
          </span>
        </div>
      ))}
      <span data-sptour-spot="0" style={{ alignSelf: "flex-end", width: 56, height: 56, borderRadius: "50%", background: houseVar("text"), color: houseVar("ground"), display: "grid", placeItems: "center" }}>
        <Icon d="M12 5v14M5 12h14" size={22} width={2.8} />
      </span>
    </>
  );
}

// ---------------------------------------------------------------- Renderer

const SpotlightTour: Renderer = (r) => {
  const { p, node } = r;
  const rt = useRuntime();
  const overlay = useOverlay();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const kids = node.children ?? [];
  const count = stopCount(kids.length);
  const presented = b(p, "presented");
  const start = Math.max(0, Math.min(Math.round(n(p, "start")), count - 1));
  // A state or a remix that changes where it starts presents it again from there.
  const [session, setSession] = useLive(presented ? `open:${start}` : "closed");
  const [stop, setStop] = useLive(start);
  const open = session.startsWith("open");
  const root = useRef<HTMLDivElement | null>(null);
  // Held in state too, so a still picture (no overlay) draws its tour on the first pass.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((el: HTMLDivElement | null) => {
    root.current = el;
    setRootEl(el);
  }, []);
  const trigger = s(p, "trigger").trim();

  /** The element each stop points at: the component inside, or a placeholder. */
  const targets = useCallback((): Array<HTMLElement | null> => {
    const el = root.current;
    if (!el) return [];
    return Array.from({ length: count }, (_, i) =>
      kids.length ? el.querySelector<HTMLElement>(`[data-node-id="${kids[i].id}"]`) : el.querySelector<HTMLElement>(`[data-sptour-spot="${i}"]`),
    );
  }, [count, kids]);

  const present = (el: Element) => {
    setStop(0);
    setSession(`open:0:${Date.now()}`);
    rt.haptic("light", el);
  };

  const layer = (frame: HTMLElement, contained: boolean) => (
    <TourLayer
      frame={frame}
      contained={contained}
      open={open}
      stop={stop}
      count={count}
      p={p}
      targets={targets}
      reduced={reduced || still}
      still={still}
      scheme={r.scheme}
      box={r.box}
      onStop={(i, el) => {
        setStop(i);
        rt.haptic("selection", el);
      }}
      onFinish={(el) => {
        setSession("closed");
        setStop(0);
        rt.haptic("soft", el);
      }}
      onNudge={(el) => rt.haptic("rigid", el)}
    />
  );

  return (
    <div
      {...r.box}
      ref={attach}
      style={{
        ...r.box.style, position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
        gap: `calc(${Math.max(0, n(p, "spacing"))}px * var(--spb-space, 1))`, minWidth: 0, ...fillStyle(r.fill, axis),
      }}
    >
      <style>{KEYFRAMES}</style>
      {kids.length ? <Frame axis="v">{r.children}</Frame> : <Placeholders />}
      {trigger ? (
        <button
          type="button"
          onClick={(e) => present(e.currentTarget)}
          style={{
            border: 0, font: "inherit", cursor: "pointer", height: 36, padding: "0 16px", borderRadius: cr(999),
            background: houseVar("field"), color: houseVar("text"), fontSize: ts(15), fontWeight: fw(600),
          }}
        >
          {trigger}
        </button>
      ) : null}
      {overlay && !still ? createPortal(layer(overlay, false), overlay) : null}
      {(still || !overlay) && open && rootEl ? layer(rootEl, true) : null}
    </div>
  );
};

// ---------------------------------------------------------------- The tour layer

type LayerProps = {
  frame: HTMLElement;
  /** Drawn inside the component's own box (still pictures) rather than over the whole phone. */
  contained: boolean;
  open: boolean;
  stop: number;
  count: number;
  p: Record<string, string | number | boolean>;
  targets: () => Array<HTMLElement | null>;
  reduced: boolean;
  still: boolean;
  scheme: "dark" | "light";
  box: { "data-node-id": string; "data-component": string };
  onStop: (i: number, el: Element | null) => void;
  onFinish: (el: Element | null) => void;
  onNudge: (el: Element | null) => void;
};

function TourLayer({ frame, contained, open, stop, count, p, targets, reduced, still, scheme, box, onStop, onFinish, onNudge }: LayerProps) {
  const rt = useRuntime();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [entrance, setEntrance] = useState(0);
  const [cardH, setCardH] = useState(150);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState<"next" | "skip" | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const advances = b(p, "advances");

  // Mounts on open, shows a frame later so the cutout closes in like an iris; fades out, then unmounts.
  useEffect(() => {
    if (open) {
      setMounted(true);
      if (still) {
        setShown(true);
        return;
      }
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          setShown(true);
          setEntrance((e) => e + 1);
        });
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 340);
    return () => window.clearTimeout(t);
  }, [open, still]);

  // Where everything is, in points, every frame while it shows (scrolling, resizing, remixing move things).
  useLayoutEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const measure = () => {
      const f = frame.getBoundingClientRect();
      const scale = contained ? f.width / Math.max(1, frame.offsetWidth) : rt.scale() || 1;
      // While another screen, tab or sheet covers the tour's screen, it has nothing to point at, so it steps
      // aside and picks up at the same stop on the way back (a stop that navigates moves it on first).
      const els = targets();
      const front = contained || inFront(frame, els);
      const next: Geo = {
        W: f.width / scale,
        H: f.height / scale,
        targets: els.map((el) => {
          if (!el || !front) return null;
          const t = el.getBoundingClientRect();
          return { x: (t.left - f.left) / scale, y: (t.top - f.top) / scale, w: t.width / scale, h: t.height / scale };
        }),
      };
      setGeo((prev) => (sameGeo(prev, next) ? prev : next));
      if (!still) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = still ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [mounted, frame, contained, targets, still, rt]);

  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    setCardH(el.offsetHeight);
    return () => ro.disconnect();
  }, [mounted]);

  // The stops on screen; the one shown is the first on screen at or after the current stop.
  const W = geo?.W ?? 0;
  const H = geo?.H ?? 0;
  const visible = (geo?.targets ?? []).map((t, i) => (t && onScreen(t, W, H) ? i : -1)).filter((i) => i >= 0);
  const display = visible.find((i) => i >= stop) ?? null;
  const target = display !== null ? geo?.targets[display] ?? null : null;
  const position = display !== null ? visible.indexOf(display) + 1 : 0;
  const nextStop = display !== null ? visible.find((i) => i > display) ?? null : null;
  const prevStop = display !== null ? [...visible].reverse().find((i) => i < display) ?? null : null;
  const isLast = nextStop === null;

  const next = useCallback(() => {
    if (!open || display === null) return;
    if (nextStop !== null) onStop(nextStop, card.current);
    else onFinish(card.current);
  }, [open, display, nextStop, onStop, onFinish]);
  const back = () => {
    if (open && prevStop !== null) onStop(prevStop, card.current);
  };
  const skip = () => {
    if (open) onFinish(card.current);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // A tap on the highlighted component runs its own action and moves the tour on.
  useEffect(() => {
    if (!shown || !advances || display === null) return;
    const el = targets()[display];
    if (!el) return;
    // Where the tour goes is settled at the tap, while the stop is still on screen: its own action runs
    // first and may open another screen, which would leave nothing to point at by the time it moves on.
    const on = () => {
      const go = nextRef.current;
      window.setTimeout(() => go(), 0);
    };
    el.addEventListener("click", on, true);
    return () => el.removeEventListener("click", on, true);
  }, [shown, advances, display, targets]);

  const drag = useDrag({
    axis: "x",
    slop: 10,
    onStart: () => setDragging(true),
    onMove: ({ dx }) => setDragX(dx < 0 || prevStop !== null ? dx * 0.45 : dx * 0.12),
    onEnd: ({ dx, vx }) => {
      setDragging(false);
      setDragX(0);
      const predicted = dx + vx * 0.2;
      if (Math.abs(dx) < 40 && Math.abs(predicted) < 110) return;
      if (predicted < 0) next();
      else back();
    },
  });

  if (!mounted || !geo || display === null || !target) return null;

  const safe: Rect = contained ? { x: 8, y: 8, w: W - 16, h: H - 16 } : { x: 16, y: SAFE_TOP + 10, w: W - 32, h: H - SAFE_TOP - SAFE_BOTTOM - 20 };
  const hole = holeFor(target);
  const drawn = shown || reduced ? hole : grow(hole, 44);
  const width = Math.min(CARD_MAX, safe.w);
  const spot = place(hole, safe, width, cardH);
  const scrim = scheme === "dark" ? "rgba(0,0,0,0.58)" : "rgba(10,10,10,0.46)";
  const copy = stopCopy(p, display);
  const morph = `.5s ${SPRING}`;
  const motion = (props: string[]) => (reduced ? "none" : props.map((x) => `${x} ${morph}`).join(", "));
  const label = `${count > 1 ? `Step ${position} of ${visible.length}. ` : ""}${copy.title}. ${copy.message}`;

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") skip();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
    else return;
    e.preventDefault();
  };

  const pressStyle = (which: "next" | "skip"): CSSProperties => ({ transform: pressed === which && !reduced ? "scale(.94)" : "none", transition: "transform .25s cubic-bezier(.22,1,.36,1)" });
  const pressBind = (which: "next" | "skip") => ({
    onPointerDown: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      setPressed(which);
    },
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
  });

  return (
    <div
      data-node-id={box["data-node-id"]}
      data-component={box["data-component"]}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}
    >
      {/* The dim: a spread shadow around the cutout, so the cutout morphs with plain transitions. */}
      <div
        data-sptour-motion
        aria-hidden
        style={{
          position: "absolute", left: drawn.x, top: drawn.y, width: drawn.w, height: drawn.h, borderRadius: drawn.r,
          boxShadow: `0 0 0 4000px ${scrim}`, opacity: shown ? 1 : 0, pointerEvents: "none",
          // In place (a still picture), the dim stays inside the component's own box.
          clipPath: contained ? `inset(${-drawn.y}px ${drawn.x + drawn.w - W}px ${drawn.y + drawn.h - H}px ${-drawn.x}px)` : undefined,
          transition: reduced ? "opacity .25s" : `${motion(["left", "top", "width", "height", "border-radius"])}, opacity ${shown ? ".35s" : ".3s"} ease`,
        }}
      />
      {/* Taps on the dim are caught (and nudge the callout); the cutout lets them through to the component. */}
      <svg aria-hidden width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <path
          d={`M -4000 -4000 H ${W + 4000} V ${H + 4000} H -4000 Z ${roundedPath(hole)}`}
          fillRule="evenodd"
          fill="transparent"
          style={{ pointerEvents: shown && !still ? "fill" : "none" }}
          onClick={(e) => {
            onNudge(e.currentTarget);
            // A soft nudge of the callout, like the Swift's keyframes. `scale` leaves its transform alone.
            if (reduced) return;
            try {
              card.current?.animate([{ scale: "1" }, { scale: "1.035", offset: 0.3 }, { scale: "1" }], { duration: 450, easing: "ease-out" });
            } catch {}
          }}
        />
      </svg>
      {shown ? (
        <svg aria-hidden width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
          <path
            key={`${entrance}-${display}`}
            data-sptour-motion
            d={roundedPath(grow(hole, RING / 2))}
            pathLength={1}
            fill="none"
            stroke={ACCENT}
            strokeWidth={RING}
            strokeDasharray="1 1"
            strokeDashoffset={0}
            style={{ animation: reduced ? undefined : "sptour-draw .45s ease-out .32s both" }}
          />
        </svg>
      ) : null}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKey}
        onPointerDown={still ? undefined : drag}
        data-sptour-motion
        style={{
          position: "absolute", left: spot.x, top: spot.y, width, boxSizing: "border-box",
          padding: "16px 18px 10px", borderRadius: cr(26), background: houseVar("surface"), color: houseVar("text"),
          boxShadow: "0 10px 22px rgba(0,0,0,.18)", pointerEvents: shown && !still ? "auto" : "none", touchAction: "pan-y", outline: "none",
          opacity: shown ? 1 : 0,
          transform: `translateX(${dragX}px) scale(${shown || reduced ? 1 : 0.94})`,
          transformOrigin: `${spot.nub}px ${spot.below ? "0" : "100%"}`,
          transition: dragging ? "opacity .3s" : `${motion(["left", "top"])}${reduced ? "" : `, transform .45s ${SPRING}`}, opacity .3s`,
        }}
      >
        {[true, false].map((up) => (
          <svg
            key={String(up)}
            aria-hidden
            viewBox="0 0 20 9"
            style={{
              position: "absolute", left: spot.nub - NUB_W / 2, width: NUB_W, height: NUB_H, ...(up ? { top: -NUB_H + 1 } : { bottom: -NUB_H + 1 }),
              transform: up ? "none" : "scaleY(-1)", opacity: spot.nubShown && spot.below === up ? 1 : 0, transition: "opacity .2s",
            }}
          >
            <path d="M0 9 L7.6 1.6 Q10 -0.4 12.4 1.6 L20 9 Z" fill="var(--h-surface)" />
          </svg>
        ))}
        <div key={display} data-sptour-motion style={{ display: "flex", flexDirection: "column", gap: 4, animation: reduced ? undefined : "sptour-text .22s ease-out .1s both" }}>
          {visible.length > 1 ? (
            <span style={{ fontSize: ts(12), fontWeight: fw(600), letterSpacing: ".05em", textTransform: "uppercase", color: houseVar("muted"), fontVariantNumeric: "tabular-nums" }}>
              {position} of {visible.length}
            </span>
          ) : null}
          <span style={{ fontSize: ts(20), fontWeight: fw(700), letterSpacing: "-0.3px", lineHeight: 1.2 }}>{copy.title}</span>
          {copy.message ? <span style={{ fontSize: ts(15), lineHeight: 1.33, color: houseVar("muted") }}>{copy.message}</span> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 14 }}>
          {visible.length > 1 ? (
            <span aria-hidden style={{ display: "flex", gap: 5, flex: 1 }}>
              {visible.map((i) => (
                <span
                  key={i}
                  data-sptour-motion
                  style={{ height: 6, width: i === display ? 18 : 6, borderRadius: cr(3), background: i === display ? ACCENT : "color-mix(in srgb, var(--h-muted) 32%, transparent)", transition: `width .4s ${SPRING}, background-color .3s` }}
                />
              ))}
            </span>
          ) : (
            <span style={{ flex: 1 }} />
          )}
          {!isLast ? (
            <button type="button" onClick={skip} {...pressBind("skip")} style={{ border: 0, background: "none", font: "inherit", cursor: "pointer", minWidth: 44, height: 44, padding: "0 12px", color: houseVar("muted"), fontSize: ts(15), fontWeight: fw(600), ...pressStyle("skip") }}>
              Skip
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            {...pressBind("next")}
            style={{
              border: 0, font: "inherit", cursor: "pointer", height: 38, margin: "3px 0", padding: "0 20px", borderRadius: cr(999),
              background: ACCENT, color: ACCENT_INK, fontSize: ts(15), fontWeight: fw(700), ...pressStyle("next"),
            }}
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const renderer: Renderer = SpotlightTour;
