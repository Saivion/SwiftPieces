"use client";
// Location Picker in the Playground: drag the drawn town (Bellmont, LP_TOWN; a Lisbon quarter when the map
// starts in Lisbon) under the red pin. The pin lifts while you drag and drops with a bounce when you let go;
// the card says Locating…, loads for a moment (the debounced lookup), then names the street under the pin, or
// shows a dropped pin with coordinates on the water. Locate-me glides back to the sky user dot (or, with "Location off", explains and offers Settings),
// Retry recovers a failed lookup, and Confirm dips, waiting for the address if it is still loading.
// "Preview as" holds a state for inspection. Mirrors LocationPicker.swift.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { house } from "../../../core/palette.js";
import { LP_DEFAULTS, LP_TOWN, lpCoordinate, lpEastWest, lpNames, lpNorthSouth, lpPlaceAt, type LpNames } from "../../../definitions/utility/location-picker.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, font, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, useDrag, useRuntime } from "../runtime.js";

type Point = { x: number; y: number };
type Phase = "found" | "finding" | "failed";
type Place = { title: string | null; subtitle: string };

/** How far the town is drawn around the person, in points. Dragging stops short of its edge. */
const EXTENT = 770;
const LIMIT = 560;
const CARD_GAP = 12;
const KEYFRAMES =
  "@keyframes splp-breathe{50%{opacity:.45}}@keyframes splp-spin{to{transform:rotate(360deg)}}@keyframes splp-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}" +
  "@media (prefers-reduced-motion: reduce){[data-splp-motion]{animation:none!important;transition:none!important}}";

/** Where each "Preview as" state puts the pin: on the person, or out on the bay for "No address". */
const SEEDS: Record<string, Point> = { unnamed: { x: -170, y: -200 } };

const clamp = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, v));

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

/** The size an element lays out at, kept current. */
function useSize<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// ---------------------------------------------------------------- The town

const BLOCKS = (() => {
  const { grid, offsetX, park } = LP_TOWN;
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let i = -8; i <= 8; i++) {
    for (let j = -8; j <= 7; j++) {
      const x0 = offsetX + i * grid + 9, x1 = offsetX + (i + 1) * grid - 9, y0 = j * grid + 9, y1 = (j + 1) * grid - 9;
      if (x0 - 9 === park.x0 && y0 - 9 === park.y0) continue;
      const seed = (((i * 7 + j * 13) % 5) + 5) % 5;
      const mx = x0 + (x1 - x0) * (0.42 + seed * 0.04);
      const my = y0 + (y1 - y0) * (0.62 - seed * 0.05);
      out.push({ x: x0, y: y0, w: mx - x0 - 3, h: my - y0 - 3 });
      if (seed !== 2) out.push({ x: mx + 3, y: y0, w: x1 - mx - 3, h: my - y0 - 3 });
      out.push({ x: x0, y: my + 3, w: (x1 - x0) * (seed === 4 ? 1 : 0.55), h: y1 - my - 3 });
      if (seed !== 4) out.push({ x: x0 + (x1 - x0) * 0.55 + 6, y: my + 3, w: (x1 - x0) * 0.45 - 6, h: y1 - my - 3 });
    }
  }
  return out;
})();

/** Places drawn with "Show places": fictional, in house blocks with ink glyphs, named by the town (LpNames.places). */
const POIS: Array<{ x: number; y: number; fill: string; glyph: string }> = [
  { x: -95, y: 55, fill: house.blocks.butter, glyph: "M8 8h7v4a3.5 3.5 0 0 1-7 0zM15 9h1.5a1.5 1.5 0 0 1 0 3H15" },
  { x: 125, y: 165, fill: house.blocks.lilac, glyph: "M8 6h8v12H8zM10.5 9h3" },
  { x: 235, y: -55, fill: house.blocks.sky, glyph: "M9 6h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM9 18l-1.5 2M15 18l1.5 2M7 11h10" },
  { x: -205, y: 160, fill: house.blocks.sage, glyph: "M12 7v10M7 12h10" },
];

function Town({ scheme, muted, places, showsUser, names }: { scheme: "dark" | "light"; muted: boolean; places: boolean; showsUser: boolean; names: LpNames }) {
  const { grid, offsetX, park, bay } = LP_TOWN;
  const step = (p: number) => `color-mix(in srgb, var(--h-text) ${p}%, var(--h-ground))`;
  const road = scheme === "dark" ? houseVar("raised") : houseVar("surface");
  const land = step(4);
  const tint = (block: string, p: number) => `color-mix(in srgb, ${block} ${muted ? p : p + 25}%, var(--h-ground))`;
  const lines: ReactNode[] = [];
  const casings: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const labelStyle: CSSProperties = { fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", fill: houseVar("muted"), paintOrder: "stroke", stroke: land, strokeWidth: 3, strokeLinejoin: "round" };
  for (let k = -7; k <= 7; k++) {
    const x = offsetX + k * grid;
    const y = k * grid;
    const wide = k === 0;
    casings.push(<line key={`cv${k}`} x1={x} y1={-EXTENT} x2={x} y2={EXTENT} stroke={step(16)} strokeWidth={11} />);
    casings.push(<line key={`ch${k}`} x1={-EXTENT} y1={y} x2={EXTENT} y2={y} stroke={step(16)} strokeWidth={wide ? 17 : 11} />);
    lines.push(<line key={`rv${k}`} x1={x} y1={-EXTENT} x2={x} y2={EXTENT} stroke={road} strokeWidth={9} />);
    lines.push(<line key={`rh${k}`} x1={-EXTENT} y1={y} x2={EXTENT} y2={y} stroke={road} strokeWidth={wide ? 15 : 9} />);
    for (const along of [-385, 0, 385]) {
      const a = along + ((k * 165) % 330);
      labels.push(<text key={`lh${k}${along}`} x={a + (k === 0 ? 165 : 55)} y={y + 3} textAnchor="middle" style={labelStyle}>{names.label(lpEastWest(k, names))}</text>);
      labels.push(<text key={`lv${k}${along}`} transform={`translate(${x + 3} ${a}) rotate(-90)`} textAnchor="middle" style={labelStyle}>{names.label(lpNorthSouth(k, names))}</text>);
    }
  }
  return (
    <svg aria-hidden viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`} width={EXTENT * 2} height={EXTENT * 2} style={{ display: "block" }}>
      <rect x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} fill={land} />
      {BLOCKS.map((r, k) => <rect key={k} x={r.x} y={r.y} width={Math.max(r.w, 0)} height={Math.max(r.h, 0)} rx={3} fill={step(9)} />)}
      <rect x={park.x0 + 8} y={park.y0 + 8} width={park.x1 - park.x0 - 16} height={park.y1 - park.y0 - 16} rx={10} fill={tint(house.blocks.sage, 50)} />
      <g strokeLinecap="round">{casings}{lines}</g>
      <ellipse cx={bay.cx} cy={bay.cy} rx={bay.rx} ry={bay.ry} fill={tint(house.blocks.sky, 55)} />
      {labels}
      <text x={(park.x0 + park.x1) / 2} y={park.y0 + 52} textAnchor="middle" style={{ ...labelStyle, fontSize: 8, stroke: "none" }}>{names.park.toUpperCase()}</text>
      {places
        ? POIS.map((poi, k) => (
            <g key={names.places[k]} transform={`translate(${poi.x} ${poi.y})`}>
              <circle r={11} fill={poi.fill} />
              <path d={poi.glyph} transform="translate(-12 -12)" fill="none" stroke={house.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <text y={24} textAnchor="middle" style={{ ...labelStyle, letterSpacing: "0.02em", fontSize: 9 }}>{names.places[k]}</text>
            </g>
          ))
        : null}
      {showsUser ? (
        <g>
          <circle r={17} fill={`color-mix(in srgb, ${house.blocks.sky} 28%, transparent)`} />
          <circle r={7} fill={house.blocks.sky} stroke="#FFFFFF" strokeWidth={2.6} />
        </g>
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------- Pieces of the picker

function Pin({ lifted, reduced }: { lifted: boolean; reduced: boolean }) {
  const lift = lifted && !reduced;
  const curve = reduced ? ".2s ease" : lift ? ".24s ease-out" : `.45s ${BOUNCE}`;
  return (
    <div style={{ position: "absolute", left: "50%", top: 0, width: 0, height: 0 }}>
      <span data-splp-motion style={{ position: "absolute", left: -9, top: -3, width: 18, height: 6, borderRadius: "50%", background: "#000", filter: `blur(${lift ? 3 : 1.2}px)`, opacity: lift ? 0.16 : 0.34, transform: `scale(${lift ? 1.7 : 1})`, transition: `transform ${curve}, opacity .3s, filter .3s` }} />
      <span style={{ position: "absolute", left: -3, top: -1.5, width: 6, height: 3, borderRadius: "50%", background: house.ink }} />
      <span data-splp-motion style={{ position: "absolute", left: -15, top: -46, width: 30, height: 46, transform: `translateY(${lift ? -12 : 0}px)`, opacity: lifted && reduced ? 0.55 : 1, transition: `transform ${curve}, opacity .2s` }}>
        <span style={{ position: "absolute", left: 13.5, top: 15, width: 3, height: 31, borderRadius: 1.5, background: house.ink }} />
        <span style={{ position: "absolute", left: 0, top: 0, width: 30, height: 30, borderRadius: "50%", background: ACCENT, boxShadow: "0 1px 2px rgba(0,0,0,.24)", display: "grid", placeItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: house.ink }} />
        </span>
      </span>
    </div>
  );
}

function Spinner({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg data-splp-motion aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, animation: "splp-spin .8s steps(8) infinite" }}>
      {Array.from({ length: 8 }, (_, k) => (
        <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" opacity={0.25 + (0.75 * k) / 7} transform={`rotate(${k * 45} 12 12)`} />
      ))}
    </svg>
  );
}

const pressable = (down: boolean, reduced: boolean, scale: number): CSSProperties => ({
  transform: down && !reduced ? `scale(${scale})` : "none",
  opacity: down && reduced ? 0.7 : 1,
  transition: `transform .3s ${BOUNCE}, opacity .15s`,
});

// ---------------------------------------------------------------- Renderer

const LocationPicker: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const overlay = useOverlay();
  const reduced = useReducedMotion();
  const simulate = s(p, "simulate") || "found";
  const denied = simulate === "denied";
  const height = Math.max(320, n(p, "height") || LP_DEFAULTS.height);
  const zoom = Math.min(2, Math.max(0.5, LP_DEFAULTS.span / Math.max(n(p, "span") || LP_DEFAULTS.span, 50)));
  const showsConfirm = p.confirm !== false;
  const confirmTitle = s(p, "confirmTitle").trim() || LP_DEFAULTS.confirm;
  const card = r.scheme === "dark" ? houseVar("raised") : houseVar("surface");
  const field = `color-mix(in srgb, var(--h-text) 11%, ${card})`;

  const seed = SEEDS[simulate] ?? { x: 0, y: 0 };
  // The town's names follow where the map starts (a Lisbon quarter for Lisbon); held in a ref for the timers.
  const start = s(p, "start");
  const names = lpNames(start);
  const namesRef = useRef(names);
  namesRef.current = names;
  const [center, setCenter] = useState<Point>(seed);
  const [glide, setGlide] = useState("none");
  const [moving, setMoving] = useState(simulate === "moving");
  const [phase, setPhase] = useState<Phase>(simulate === "finding" ? "finding" : simulate === "failed" ? "failed" : "found");
  const [place, setPlace] = useState<Place>(() => lpPlaceAt(seed.x, seed.y, names));
  const [lastTitle, setLastTitle] = useState<string | null>(() => lpPlaceAt(seed.x, seed.y, names).title);
  const [atUser, setAtUser] = useState(!SEEDS[simulate]);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [alert, setAlert] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const dragStart = useRef<Point>(seed);
  const root = useRef<HTMLDivElement | null>(null);
  const [cardRef, cardSize] = useSize<HTMLDivElement>();

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => clear, []);

  // "Preview as" (and the states) start over from their own spot, held for inspection.
  useEffect(() => {
    clear();
    const at = SEEDS[simulate] ?? { x: 0, y: 0 };
    const found = lpPlaceAt(at.x, at.y, namesRef.current);
    setCenter(at);
    setGlide("none");
    setMoving(simulate === "moving");
    setPhase(simulate === "finding" ? "finding" : simulate === "failed" ? "failed" : "found");
    setPlace(found);
    setLastTitle(found.title);
    setAtUser(!SEEDS[simulate]);
    setPending(false);
    setLocating(false);
    setAlert(false);
  }, [simulate, start]);

  /** The debounced lookup: a moment of skeleton, then the street under the pin. ("Lookup failed" shows the
   *  failure as it starts; Retry recovers, as it would once the connection is back.) */
  const lookUp = useCallback(
    (at: Point) => {
      setPhase("finding");
      later(rt.still ? 0 : 650, () => {
        const found = lpPlaceAt(at.x, at.y, namesRef.current);
        setPlace(found);
        if (found.title) setLastTitle(found.title);
        setPhase("found");
      });
    },
    [later, rt.still],
  );

  /** The map came to rest: the pin drops with a light tap and the lookup starts. */
  const settle = useCallback(
    (at: Point, home: boolean) => {
      setMoving(false);
      setAtUser(home);
      rt.haptic("light", root.current);
      lookUp(at);
    },
    [lookUp, rt],
  );

  // A Confirm tapped while the address loads fires once it arrives.
  useEffect(() => {
    if (!pending || phase === "finding") return;
    setPending(false);
    rt.haptic("success", root.current);
    rt.act(s(p, "link"));
  }, [pending, phase, rt, p]);

  const drag = useDrag({
    slop: 3,
    onStart: () => {
      clear();
      setPending(false);
      setGlide("none");
      dragStart.current = center;
      setMoving(true);
      setAtUser(false);
      if (phase === "found") setLastTitle(place.title);
    },
    onMove: ({ dx, dy }) => setCenter({ x: clamp(dragStart.current.x - dx / zoom), y: clamp(dragStart.current.y - dy / zoom) }),
    onEnd: ({ dx, dy, vx, vy }) => {
      // A flick coasts a little further, then the map settles.
      const coast = reduced ? 0 : 0.12;
      const end = { x: clamp(dragStart.current.x - (dx + vx * coast) / zoom), y: clamp(dragStart.current.y - (dy + vy * coast) / zoom) };
      setGlide(reduced ? "none" : "transform .38s cubic-bezier(.15,.6,.3,1)");
      setCenter(end);
      later(reduced ? 0 : 380, () => settle(end, false));
    },
  });

  const locate = (el: Element) => {
    if (denied) {
      setAlert(true);
      rt.haptic("light", el);
      return;
    }
    if (locating) return;
    clear();
    setPending(false);
    setLocating(true);
    later(rt.still ? 0 : 280, () => {
      setLocating(false);
      setMoving(true);
      if (phase === "found") setLastTitle(place.title);
      setGlide(reduced ? "none" : "transform .6s cubic-bezier(.45,0,.2,1)");
      setCenter({ x: 0, y: 0 });
      later(reduced ? 0 : 600, () => settle({ x: 0, y: 0 }, true));
    });
  };

  const confirm = (el: Element) => {
    if (moving) return;
    if (phase === "finding") {
      setPending(true);
      return;
    }
    rt.haptic("success", el);
    rt.act(s(p, "link"));
  };

  const retry = (el: Element) => {
    rt.haptic("selection", el);
    lookUp(center);
  };

  // Layout: the pin sits in the middle of the map the card leaves visible.
  const cardH = showsConfirm ? Math.max(cardSize.h, 143) : Math.max(cardSize.h, 79);
  const pinY = Math.max(56, (height - cardH - CARD_GAP * 2) / 2);
  // The town's point `center` lands on the pin: the layer starts at the horizontal middle, and town
  // point (0, 0) sits at (EXTENT, EXTENT) inside it.
  const mapTransform = `translate(${-zoom * (center.x + EXTENT)}px, ${pinY - zoom * (center.y + EXTENT)}px) scale(${zoom})`;
  const unnamed = phase === "found" && !place.title;
  const text: { title: string; subtitle: string; dimmed: boolean } | null = moving
    ? { title: lastTitle ?? "Dropped pin", subtitle: "Locating…", dimmed: true }
    : phase === "finding"
      ? null
      : phase === "failed"
        ? { title: "Couldn’t find the address", subtitle: lpCoordinate(center.x, center.y, names), dimmed: false }
        : unnamed
          ? { title: "Dropped pin", subtitle: place.subtitle, dimmed: false }
          : { title: place.title ?? "", subtitle: place.subtitle, dimmed: false };

  const press = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.stopPropagation();
      setPressed(id);
    },
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
  });

  const alertLayer = alert ? (
    <div data-splp-motion style={{ position: "absolute", inset: 0, zIndex: 6, display: "grid", placeItems: "center", background: "rgba(0,0,0,.28)", pointerEvents: "auto", animation: "splp-in .2s ease-out both" }} onClick={() => setAlert(false)}>
      <div role="alertdialog" aria-label="Location is off" onClick={(e) => e.stopPropagation()} style={{ width: 280, boxSizing: "border-box", padding: 20, borderRadius: cr(26), background: card, color: houseVar("text"), boxShadow: "0 18px 40px rgba(0,0,0,.25)" }}>
        <div style={{ ...font("headline") }}>Location is off</div>
        <div style={{ ...font("subheadline"), color: houseVar("muted"), marginTop: 6 }}>Allow location access in Settings to jump to where you are. You can still drag the map to any spot.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {["Not now", "Settings"].map((label) => (
            <button key={label} type="button" onClick={(e) => { rt.haptic("light", e.currentTarget); setAlert(false); }} style={{ flex: 1, height: 44, border: 0, borderRadius: cr(999), background: field, color: houseVar("text"), font: "inherit", ...font("subheadline", 600), cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      {...r.box}
      ref={root}
      style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, minWidth: 0, overflow: "hidden", borderRadius: cr(26), background: `color-mix(in srgb, var(--h-text) 4%, var(--h-ground))`, isolation: "isolate" }}
    >
      <style>{KEYFRAMES}</style>
      {/* The map: drag anywhere on it. */}
      <div onPointerDown={drag} aria-label="Map" role="img" style={{ position: "absolute", inset: 0, touchAction: "none", cursor: moving ? "grabbing" : "grab" }}>
        <div data-splp-motion style={{ position: "absolute", left: "50%", top: 0, width: EXTENT * 2, height: EXTENT * 2, transformOrigin: "0 0", transform: mapTransform, transition: glide }}>
          <Town scheme={r.scheme} muted={p.muted !== false} places={b(p, "pointsOfInterest")} showsUser={!denied} names={names} />
        </div>
      </div>
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: pinY, height: 0, pointerEvents: "none" }}>
        <Pin lifted={moving} reduced={reduced} />
      </div>
      {p.locationButton !== false ? (
        <button
          type="button"
          aria-label={`Use my location${denied ? ", location is off" : ""}`}
          aria-busy={locating}
          onClick={(e) => locate(e.currentTarget)}
          {...press("locate")}
          style={{
            position: "absolute", top: 12, insetInlineEnd: 12, width: 44, height: 44, border: 0, padding: 0, borderRadius: "50%", background: card,
            color: denied ? houseVar("muted") : houseVar("text"), display: "grid", placeItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,.16)", cursor: "pointer",
            ...pressable(pressed === "locate", reduced, 0.9),
          }}
        >
          {locating ? (
            <Spinner color={houseVar("text")} />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" style={{ width: 19, height: 19 }}>
              <path d="M20.2 3.8 3.9 10.6c-.6.3-.5 1.1.1 1.3l6.4 1.7 1.7 6.4c.2.6 1 .7 1.3.1l6.8-16.3z" fill={atUser && !denied ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" />
              {denied ? <path d="M4 4l16 16" stroke={card} strokeWidth={4.4} strokeLinecap="round" /> : null}
              {denied ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /> : null}
            </svg>
          )}
        </button>
      ) : null}
      {/* The address card. */}
      <div
        ref={cardRef}
        style={{
          position: "absolute", left: CARD_GAP, right: CARD_GAP, bottom: CARD_GAP, maxWidth: 560, margin: "0 auto", boxSizing: "border-box", padding: 16,
          borderRadius: cr(26), background: card, boxShadow: "0 8px 22px rgba(0,0,0,.16)", display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            role="group"
            aria-label={`Selected location, ${text ? `${text.title}, ${text.subtitle}` : "Finding the address"}`}
            aria-live="polite"
            style={{ position: "relative", flex: 1, minWidth: 0 }}
          >
            <div style={{ opacity: text ? 1 : 0, transition: "opacity .25s" }}>
              <div style={{ ...font("title3", 700), ...(phase === "failed" && !moving ? { fontSize: ts(16), lineHeight: ts(25) } : {}), color: houseVar("text"), opacity: text?.dimmed ? 0.35 : 1, transition: "opacity .3s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text?.title ?? "\u00a0"}</div>
              <div style={{ ...font("subheadline"), marginTop: 2, color: houseVar("muted"), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text?.subtitle ?? "\u00a0"}</div>
            </div>
            {!text ? (
              <div data-splp-motion style={{ position: "absolute", inset: 0, animation: "splp-breathe 1.6s ease-in-out infinite" }}>
                <span style={{ position: "absolute", left: 0, top: "18%", width: "62%", height: 13, borderRadius: 7, background: field }} />
                <span style={{ position: "absolute", left: 0, top: "68%", width: "40%", height: 10, borderRadius: 5, background: field }} />
              </div>
            ) : null}
          </div>
          {phase === "failed" && !moving ? (
            <button
              type="button"
              onClick={(e) => retry(e.currentTarget)}
              {...press("retry")}
              style={{ flex: "none", height: 36, padding: "0 14px", border: 0, borderRadius: cr(999), background: field, color: houseVar("text"), font: "inherit", ...font("subheadline", 600), cursor: "pointer", ...pressable(pressed === "retry", reduced, 0.94) }}
            >
              Retry
            </button>
          ) : null}
        </div>
        {showsConfirm ? (
          <button
            type="button"
            aria-disabled={moving}
            aria-busy={pending}
            onClick={(e) => confirm(e.currentTarget)}
            {...press("confirm")}
            style={{
              height: 50, border: 0, borderRadius: cr(999), background: ACCENT, color: ACCENT_INK, font: "inherit", ...font("headline"),
              display: "grid", placeItems: "center", cursor: moving ? "default" : "pointer", ...pressable(pressed === "confirm" && !moving, reduced, 0.97),
            }}
          >
            {pending ? <Spinner color={ACCENT_INK} /> : <span style={{ opacity: moving ? 0.35 : 1, transition: "opacity .25s", fontSize: ts(17) }}>{confirmTitle}</span>}
          </button>
        ) : null}
      </div>
      {alertLayer && overlay ? createPortal(<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{alertLayer}</div>, overlay) : alertLayer}
    </div>
  );
};

export const renderer: Renderer = LocationPicker;
