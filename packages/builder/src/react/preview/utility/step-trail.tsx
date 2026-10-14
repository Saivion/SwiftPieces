"use client";
// Step Trail in the Playground: the same trail as StepTrail.swift. Glass stops melt into one shape through short
// necks (a small goo filter); done steps carry a check, the current step is the accent capsule with its number and
// title, reached steps show their number in full text and the rest muted. Tap a done or reached step to go there; a
// tap past the furthest reached shakes that stop. Drag sideways to carry the capsule along the reachable steps: it
// lifts, hops to a stop a little past each midpoint with a tick, reaches toward the finger with rubber-band
// resistance, gives at the last step it may reach and lands on release. When the titles don't fit the width, the
// capsule keeps its number, the caption names the step and the stops shrink to fit.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { stepTrailState } from "../../../definitions/utility/step-trail.js";
import { ACCENT, ACCENT_INK, b, cr, ff, fillStyle, fw, houseVar, s, ts, useAxis, type Renderer } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { useDrag, useLive, useRuntime } from "../runtime.js";

/** The stop, its neck and the capsule's title insets, in points, as StepTrail.Style.standard draws them. */
const D = 34, GAP = 4, LABEL = 15, LEAD = 29, TAIL = 14, MIN_D = 22;
/** How far a finger's pull stretches the capsule past its stop at most: d × 0.35, as in Swift. */
const REACH = D * 0.35;
const MORPH = "cubic-bezier(.3, 1.18, .5, 1)";
const LEAD_EASE = "cubic-bezier(.25, 1.22, .5, 1)";
const TRAIL_EASE = "cubic-bezier(.3, 1.28, .5, 1)";

injectStyle(
  "spb-step-trail",
  [
    "@property --spst-lo{syntax:'<length>';inherits:true;initial-value:0px}",
    "@property --spst-hi{syntax:'<length>';inherits:true;initial-value:0px}",
    "@property --spst-pl{syntax:'<length>';inherits:true;initial-value:0px}",
    "@property --spst-ph{syntax:'<length>';inherits:true;initial-value:0px}",
    "@keyframes spst-shake{0%{transform:none}16%{transform:translateX(-6px)}34%{transform:translateX(4.5px)}52%{transform:translateX(-3px)}70%{transform:translateX(1.5px)}100%{transform:none}}",
    "@media (prefers-reduced-motion: reduce){[data-spst-motion]{animation:none!important}}",
  ].join(""),
);

const rubber = (over: number, limit: number) => {
  if (limit <= 0 || over === 0) return 0;
  const banded = (1 - 1 / ((Math.abs(over) * 0.55) / limit + 1)) * limit;
  return over < 0 ? -banded : banded;
};

type Stop = { x: number; w: number };

/** Each stop's place with `open` as the capsule, every other stop a circle of `d`. */
function layoutFor(open: number, titles: number[], titled: boolean, d: number): Stop[] {
  let cursor = 0;
  return titles.map((title, k) => {
    const w = titled && k === open ? LEAD + title + TAIL : d;
    const stop = { x: cursor, w };
    cursor += w + GAP;
    return stop;
  });
}

function Check({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: "block" }}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const still = rt.still === true;
  const calm = still || reducedMotion();
  const { steps, current, reached } = stepTrailState(p);
  const count = steps.length;
  const [selection, setSelection] = useLive(current);
  const [furthest, setFurthest] = useLive(Math.max(reached, Math.min(current, count - 1)));
  const [scrub, setScrub] = useState<number | null>(null);
  const [pull, setPull] = useState(0);
  const [grab, setGrab] = useState(false);
  const [press, setPress] = useState<number | null>(null);
  const [shakes, setShakes] = useState<Record<number, number>>({});
  const [room, setRoom] = useState(0);
  const [titleWidths, setTitleWidths] = useState<number[]>([]);
  const box = useRef<HTMLDivElement | null>(null);
  const probe = useRef<HTMLDivElement | null>(null);
  const grabAt = useRef({ offset: 0, pushing: false, down: 0 });
  const scrubbing = useRef<number | null>(null);
  const filter = `spst-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // The width the trail may use, from its parent, so it can drop titles and shrink as the Swift does.
  useEffect(() => {
    const parent = box.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const read = () => setRoom(parent.clientWidth);
    const ro = new ResizeObserver(read);
    ro.observe(parent);
    read();
    return () => ro.disconnect();
  }, []);
  // Every title at the capsule's font, so each capsule fits its title exactly (Style's font and text size included).
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const next = Array.from(el.children).map((c) => Math.ceil((c as HTMLElement).offsetWidth));
    setTitleWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
  });

  const last = count - 1;
  const titles = steps.map((title, k) => Math.min(titleWidths[k] ?? title.length * LABEL * 0.56, 160));
  const titledWidth = last * (D + GAP) + LEAD + Math.max(...titles) + TAIL;
  const titled = room <= 0 || titledWidth <= room;
  const d = titled ? D : Math.max(MIN_D, Math.min(D, Math.floor((room - last * GAP) / count)));
  const pitch = d + GAP;
  const shown = Math.min(Math.max(scrub ?? selection, 0), count);
  const finished = shown >= count;
  const stops = layoutFor(shown, titles, titled, d);
  const width = titled ? titledWidth : count * d + last * GAP;
  const cur = stops[Math.min(shown, last)];

  // Which way the red is going decides which edge leads: the one facing the move.
  const lastShown = useRef(shown);
  const from = useRef(shown);
  if (lastShown.current !== shown) {
    from.current = lastShown.current;
    lastShown.current = shown;
  }
  const forward = shown >= from.current;

  const status = (k: number) => (k < shown ? "done" : k === shown ? "current" : k <= furthest ? "ahead" : "unreached");
  const stopAt = (x: number) => {
    const target = layoutFor(shown, titles, titled, d);
    const hit = target.findIndex((st) => x < st.x + st.w + GAP / 2);
    return hit < 0 ? last : hit;
  };
  const pointX = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) / (rt.scale() || 1);
  };

  const land = (k: number, el: Element | null) => {
    setSelection(k);
    setFurthest((f) => Math.max(f, Math.min(k, last)));
    rt.haptic("selection", el);
  };
  const tap = (k: number, el: Element | null) => {
    if (k <= furthest) {
      if (k !== Math.min(selection, count)) land(k, el);
      return;
    }
    setShakes((m) => ({ ...m, [k]: (m[k] ?? 0) + 1 }));
    rt.haptic("rigid", el);
  };

  const drag = useDrag({
    axis: "x",
    slop: 6,
    onStart: ({ el }) => {
      if (furthest <= 0) return;
      const start = Math.min(stopAt(grabAt.current.down), furthest);
      grabAt.current.offset = grabAt.current.down - (start * pitch + d / 2);
      grabAt.current.pushing = false;
      setPress(null);
      setGrab(true);
      scrubbing.current = start;
      setScrub(start);
      if (start !== shown) rt.haptic("selection", el);
    },
    onMove: ({ x, el }) => {
      const held = scrubbing.current;
      if (furthest <= 0 || held === null) return;
      const position = (x - grabAt.current.offset - d / 2) / pitch;
      let at = held;
      const nearest = Math.round(position);
      if (nearest !== at && Math.abs(position - nearest) < 0.35) at = nearest;
      at = Math.min(Math.max(at, 0), furthest);
      if (at !== held) {
        scrubbing.current = at;
        setScrub(at);
        rt.haptic("selection", el);
      }
      setPull(calm ? 0 : rubber((position - at) * pitch, REACH));
      // One firm tick as it is pushed against the last step it may reach, or the first; it rearms coming back.
      const against = (at === furthest && position > at + 0.45) || (at === 0 && position < -0.45);
      if (against && !grabAt.current.pushing) {
        grabAt.current.pushing = true;
        rt.haptic("rigid", el);
      } else if (!against && Math.abs(position - at) < 0.3) grabAt.current.pushing = false;
    },
    onEnd: () => {
      const held = scrubbing.current;
      scrubbing.current = null;
      setGrab(false);
      setPull(0);
      setScrub(null);
      if (held !== null && held !== selection) {
        setSelection(held);
        setFurthest((f) => Math.max(f, held));
      }
    },
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const x = pointX(e);
    grabAt.current.down = x;
    const k = stopAt(x);
    setPress(k <= furthest ? k : null);
    drag(e);
  };
  const release = () => setPress(null);

  const t = (props: string[], ms: number, easing: string, delay = 0) => (calm ? "none" : props.map((q) => `${q} ${ms}ms ${easing} ${delay}ms`).join(", "));
  const geometry = t(["left", "width"], 420, MORPH);
  const edges = calm
    ? "none"
    : [
        `--spst-hi ${forward ? `340ms ${LEAD_EASE}` : `500ms ${TRAIL_EASE} 50ms`}`,
        `--spst-lo ${forward ? `500ms ${TRAIL_EASE} 50ms` : `340ms ${LEAD_EASE}`}`,
        scrub !== null ? "--spst-pl 0ms, --spst-ph 0ms" : `--spst-pl 420ms ${MORPH}, --spst-ph 420ms ${MORPH}`,
      ].join(", ");
  const glassFill = r.scheme === "dark" ? houseVar("raised") : houseVar("surface");
  const label = ts(LABEL * (d / D));
  const capsule = cr(999);

  const face = (k: number, ink: boolean) => {
    const st = status(k);
    const open = titled && k === shown;
    const color = ink ? (finished ? houseVar("text") : ACCENT_INK) : st === "unreached" ? houseVar("muted") : houseVar("text");
    const swap = (on: boolean): CSSProperties => ({
      position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: on ? 1 : 0,
      filter: on ? "none" : "blur(3px)", transform: on ? "none" : "scale(.7)", transition: t(["opacity", "filter", "transform"], 260, MORPH),
    });
    return (
      <span key={`${steps[k]}-${k}`} style={{ position: "absolute", top: 0, left: stops[k].x, width: stops[k].w, height: d, color, transition: [geometry, t(["color"], 200, "ease-out")].filter((v) => v !== "none").join(", ") || "none" }}>
        <span style={{ position: "absolute", left: 0, top: 0, width: d, height: d }}>
          <span style={swap(st !== "done")}><span style={{ fontSize: label, fontWeight: fw(600), fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{k + 1}</span></span>
          <span style={swap(st === "done")}><Check size={15 * (d / D)} /></span>
        </span>
        {titled ? (
          <span style={{
            position: "absolute", left: LEAD, top: 0, height: d, width: titles[k], display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            fontSize: label, fontWeight: fw(600), lineHeight: 1, opacity: open ? 1 : 0, filter: open ? "none" : "blur(4px)",
            transition: open ? t(["opacity", "filter"], 300, "ease-out", 110) : t(["opacity", "filter"], 140, "ease-out"),
          }}>{steps[k]}</span>
        ) : null}
      </span>
    );
  };

  const puckStyle = {
    position: "absolute", top: 0, height: d,
    left: "calc(var(--spst-lo) + var(--spst-pl))", width: "calc(var(--spst-hi) + var(--spst-ph) - var(--spst-lo) - var(--spst-pl))",
    ["--spst-lo" as string]: `${cur.x}px`, ["--spst-hi" as string]: `${cur.x + cur.w}px`,
    ["--spst-pl" as string]: `${Math.min(pull, 0)}px`, ["--spst-ph" as string]: `${Math.max(pull, 0)}px`,
    transition: edges,
  } as CSSProperties;
  const lift = (k: number) => (grab && k === shown ? 1.06 : press === k ? 0.94 : 1);
  const liftTransition = (k: number) => t(["transform"], press === k || (grab && k === shown) ? 140 : 420, press === k ? "ease-out" : MORPH);

  const position = Math.min(shown, last) + 1;
  const caption = b(p, "caption");
  const meta: CSSProperties = { fontSize: ts(13), fontWeight: fw(600), color: houseVar("muted"), whiteSpace: "nowrap" };

  return (
    <div
      {...r.box}
      ref={box}
      role="slider"
      aria-label={s(p, "label").trim() || "Progress"}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={position}
      aria-valuetext={finished ? "Complete" : `Step ${position} of ${count}, ${steps[shown]}`}
      style={{ ...r.box.style, ...fillStyle(r.fill, axis), display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, fontFamily: ff("inherit"), fontWeight: fw(600), color: houseVar("text") }}
    >
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <filter id={filter} x="-10%" y="-60%" width="120%" height="220%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9 2.2" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 30 -14.5" result="goo" />
          <feComposite in="SourceAlpha" in2="goo" operator="over" result="mask" />
          <feFlood style={{ floodColor: glassFill }} />
          <feComposite in2="mask" operator="in" />
        </filter>
      </svg>
      <div ref={probe} aria-hidden style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", whiteSpace: "nowrap" }}>
        {steps.map((title, k) => <span key={`${title}-${k}`} style={{ position: "absolute", fontSize: ts(LABEL), fontWeight: fw(600), lineHeight: 1 }}>{title}</span>)}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onClick={(e) => tap(stopAt(pointX(e as unknown as ReactPointerEvent<HTMLDivElement>)), e.currentTarget)}
        style={{ position: "relative", width, height: Math.max(d, 44), display: "flex", alignItems: "center", touchAction: "pan-y", cursor: "pointer", userSelect: "none" }}
      >
        {/* The glass: every stop and the puck in one colour, melted through their necks, with a soft lift. */}
        <div aria-hidden style={{ position: "relative", width, height: d, filter: `url(#${filter}) drop-shadow(0 4px 10px rgba(0,0,0,${r.scheme === "dark" ? 0.35 : 0.1}))` }}>
          {steps.map((title, k) => (
            <span key={`${title}-${k}-${shakes[k] ?? 0}`} data-spst-motion style={{ position: "absolute", top: 0, left: stops[k].x, width: stops[k].w, height: d, transition: geometry, animation: shakes[k] ? "spst-shake 380ms ease-out" : undefined }}>
              <span style={{ display: "block", width: "100%", height: "100%", borderRadius: capsule, background: "#000", transform: `scale(${lift(k)})`, transition: liftTransition(k) }} />
            </span>
          ))}
          <span style={puckStyle}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: capsule, background: "#000", transform: `scale(${lift(shown)})`, transition: liftTransition(shown) }} /></span>
        </div>
        {/* The faces over the glass, each stop's own, shaking with it. */}
        <div style={{ position: "absolute", left: 0, top: "50%", width, height: d, marginTop: -d / 2, pointerEvents: "none" }}>
          {steps.map((_, k) => (
            <span key={`${steps[k]}-${k}-${shakes[k] ?? 0}`} data-spst-motion style={{ position: "absolute", inset: 0, animation: shakes[k] ? `spst-shake 380ms ease-out` : undefined }}>
              {face(k, false)}
            </span>
          ))}
          {/* The accent capsule, carrying every face in its ink and cut to its outline. */}
          <span style={{ ...puckStyle, overflow: "hidden", borderRadius: capsule, transform: `scale(${lift(shown)})`, background: finished ? glassFill : ACCENT, transition: [edges, liftTransition(shown), t(["background-color"], 300, "ease-out")].filter((v) => v !== "none").join(", ") || "none" }}>
            <span style={{ position: "absolute", top: 0, left: "calc((var(--spst-lo) + var(--spst-pl)) * -1)", width, height: d }}>
              {steps.map((_, k) => face(k, true))}
            </span>
          </span>
        </div>
      </div>
      {caption ? (
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {!titled && !finished ? <span style={{ ...meta, color: houseVar("text") }}>{steps[shown]}</span> : null}
          <span style={meta}>{finished ? "Complete" : `Step ${position} of ${count}`}</span>
        </span>
      ) : null}
    </div>
  );
};
