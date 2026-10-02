"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, paper, signal } from "./palette";

/*
 * Location Picker: a drawn map under a fixed red pin, with the address card and the locate button.
 * It rests on the person's location, then a finger drags the map (the pin lifts, the card says
 * Locating…), lets go, the map coasts and settles, the pin drops with a bounce and the card loads and
 * names the new street. Locate-me glides the map back to the sky user dot, the pin drops on it, the
 * address returns and Confirm dips, which is exactly where the loop began.
 * Sizes are authored in iOS points: 1 pt is 1.08 px on the 560 px docs stage, converted to `cqw`.
 */

/**
 * The storyboard (also the launch video's script). Each step holds for `ms`. `map` is how far the map
 * has moved from rest, in points, reached over `glide` ms with `curve`. `finger` is the touch in points
 * inside the picker (372 x 363), `null` when lifted. `card`: the address, `moving` (last address dimmed,
 * "Locating…") or `loading` (skeleton). `address` 0 is 210 Maple Avenue (rest), 1 is 48 Juniper Lane.
 */
const STEPS = [
  { name: "rest", ms: 1700, map: [0, 0], pin: "down", card: "address", address: 0, finger: null, atUser: true },
  { name: "touch", ms: 260, map: [0, 0], pin: "down", card: "address", address: 0, finger: [290, 172], atUser: true },
  { name: "drag", ms: 900, map: [-56, -64], glide: 900, curve: "linear", pin: "up", card: "moving", address: 0, finger: [234, 108], atUser: false },
  { name: "let go and coast", ms: 380, map: [-70, -80], glide: 380, curve: "coast", pin: "up", card: "moving", address: 0, finger: null, atUser: false },
  { name: "drop", ms: 650, map: [-70, -80], pin: "down", card: "loading", address: 0, finger: null, atUser: false },
  { name: "new street", ms: 1400, map: [-70, -80], pin: "down", card: "address", address: 1, finger: null, atUser: false },
  { name: "tap locate", ms: 240, map: [-70, -80], pin: "down", card: "address", address: 1, finger: [338, 34], press: "locate", atUser: false },
  { name: "glide home", ms: 700, map: [0, 0], glide: 700, curve: "glide", pin: "up", card: "moving", address: 1, finger: null, atUser: false },
  { name: "drop on you", ms: 600, map: [0, 0], pin: "down", card: "loading", address: 1, finger: null, atUser: true },
  { name: "your street", ms: 1300, map: [0, 0], pin: "down", card: "address", address: 0, finger: null, atUser: true },
  { name: "tap confirm", ms: 240, map: [0, 0], pin: "down", card: "address", address: 0, finger: [186, 310], press: "confirm", atUser: true },
  { name: "release", ms: 600, map: [0, 0], pin: "down", card: "address", address: 0, finger: null, atUser: true },
] as const;

type Step = (typeof STEPS)[number];

const ADDRESSES = [
  { title: "210 Maple Avenue", subtitle: "Bellmont OR 97321" },
  { title: "48 Juniper Lane", subtitle: "Bellmont OR 97321" },
];

const u = (pt: number) => `${((pt * 1.08) / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const CURVES = { linear: "linear", coast: "cubic-bezier(0.15, 0.6, 0.3, 1)", glide: "cubic-bezier(0.45, 0, 0.2, 1)" } as const;

/** The picker, the card in it and the pin, which sits in the middle of the map the card leaves visible. */
const W = 372;
const H = 363;
const CARD_H = 143;
const PIN = { x: W / 2, y: (H - CARD_H - 12) / 2 };
/** The drawn map, and the person's location on it (under the pin at rest). */
const MAP = { w: 720, h: 640 };
const USER = { x: 300, y: 300 };
const ORIGIN = { x: PIN.x - USER.x, y: PIN.y - USER.y };

/** Map colours from the stage tokens, so the map turns with the site theme: lightness steps of ink in the ground. */
const step = (p: number) => `color-mix(in srgb, ${ground.text} ${p}%, ${ground.bg})`;
const LAND = step(4);
const BUILDING = step(9);
const CASING = step(16);
const ROAD = ground.raised;
const PARK = `color-mix(in srgb, ${blocks.sage} 50%, ${ground.bg})`;
const WATER = `color-mix(in srgb, ${blocks.sky} 55%, ${ground.bg})`;

const ROADS_X = [40, 150, 260, 370, 480, 590, 700];
const ROADS_Y = [70, 180, 300, 410, 520, 630];
const PARK_BLOCK = { x0: 370, y0: 180, x1: 480, y1: 300 };

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

/** Walks the script; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps(steps: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) {
      setI(0);
      return;
    }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return { step: steps[i], reduced };
}

/** Buildings: two to four per block, the same every time. */
function buildings() {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const x0 = ROADS_X[i] + 9, x1 = ROADS_X[i + 1] - 9, y0 = ROADS_Y[j] + 9, y1 = ROADS_Y[j + 1] - 9;
      if (ROADS_X[i] === PARK_BLOCK.x0 && ROADS_Y[j] === PARK_BLOCK.y0) continue;
      const seed = (i * 7 + j * 13) % 5;
      const split = 0.42 + seed * 0.04;
      const mx = x0 + (x1 - x0) * split;
      const my = y0 + (y1 - y0) * (0.62 - seed * 0.05);
      out.push({ x: x0, y: y0, w: mx - x0 - 3, h: my - y0 - 3 });
      if (seed !== 2) out.push({ x: mx + 3, y: y0, w: x1 - mx - 3, h: my - y0 - 3 });
      out.push({ x: x0, y: my + 3, w: (x1 - x0) * (seed === 4 ? 1 : 0.55), h: y1 - my - 3 });
      if (seed !== 4) out.push({ x: x0 + (x1 - x0) * 0.55 + 6, y: my + 3, w: (x1 - x0) * 0.45 - 6, h: y1 - my - 3 });
    }
  }
  return out;
}
const BUILDINGS = buildings();

const label: CSSProperties = { fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", fill: ground.muted, paintOrder: "stroke", stroke: LAND, strokeWidth: 3, strokeLinejoin: "round" };

function MapArt() {
  return (
    <svg aria-hidden viewBox={`0 0 ${MAP.w} ${MAP.h}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width={MAP.w} height={MAP.h} fill={LAND} />
      {BUILDINGS.map((b, k) => (
        <rect key={k} x={b.x} y={b.y} width={Math.max(b.w, 0)} height={Math.max(b.h, 0)} rx={3} fill={BUILDING} />
      ))}
      <rect x={PARK_BLOCK.x0 + 8} y={PARK_BLOCK.y0 + 8} width={PARK_BLOCK.x1 - PARK_BLOCK.x0 - 16} height={PARK_BLOCK.y1 - PARK_BLOCK.y0 - 16} rx={10} fill={PARK} />
      <g strokeLinecap="round">
        {ROADS_X.map((x) => <line key={`cx${x}`} x1={x} y1={0} x2={x} y2={MAP.h} stroke={CASING} strokeWidth={x === 370 ? 12 : 11} />)}
        {ROADS_Y.map((y) => <line key={`cy${y}`} x1={0} y1={y} x2={MAP.w} y2={y} stroke={CASING} strokeWidth={y === 300 ? 17 : 11} />)}
        <path d="M0 560 L260 300" stroke={CASING} strokeWidth={11} fill="none" />
        {ROADS_X.map((x) => <line key={`rx${x}`} x1={x} y1={0} x2={x} y2={MAP.h} stroke={ROAD} strokeWidth={x === 370 ? 10 : 9} />)}
        {ROADS_Y.map((y) => <line key={`ry${y}`} x1={0} y1={y} x2={MAP.w} y2={y} stroke={ROAD} strokeWidth={y === 300 ? 15 : 9} />)}
        <path d="M0 560 L260 300" stroke={ROAD} strokeWidth={9} fill="none" />
      </g>
      {/* The bay in the north-west; the streets end at its shore. */}
      <path d="M0 0 H300 C282 78 232 148 172 212 C130 254 72 280 0 292 Z" fill={WATER} />
      <text x={200} y={303} textAnchor="middle" style={label}>MAPLE AVE</text>
      <text x={500} y={303} textAnchor="middle" style={label}>MAPLE AVE</text>
      <text x={566} y={413} textAnchor="middle" style={label}>LINDEN ST</text>
      <text transform="translate(373 445) rotate(-90)" textAnchor="middle" style={label}>JUNIPER LN</text>
      <text transform="translate(263 372) rotate(-90)" textAnchor="middle" style={label}>BIRCH ST</text>
      <text x={425} y={262} textAnchor="middle" style={{ ...label, fontSize: 8, stroke: PARK }}>JUNIPER PARK</text>
      {/* The person's location. */}
      <circle cx={USER.x} cy={USER.y} r={17} fill={`color-mix(in srgb, ${blocks.sky} 28%, transparent)`} />
      <circle cx={USER.x} cy={USER.y} r={7} fill={blocks.sky} stroke={paper.surface} strokeWidth={2.6} />
    </svg>
  );
}

function Pin({ up, reduced }: { up: boolean; reduced: boolean }) {
  const lift = up && !reduced;
  const fall = `${lift ? ".24s ease-out" : `.45s ${spring}`}`;
  return (
    <div data-motion style={{ position: "absolute", left: u(PIN.x), top: u(PIN.y), width: 0, height: 0 }}>
      {/* The shadow on the ground spreads and fades as the pin rises. */}
      <span
        data-motion
        style={{
          position: "absolute", left: u(-9), top: u(-3), width: u(18), height: u(6), borderRadius: "50%", background: "#000",
          filter: `blur(${u(lift ? 3 : 1.2)})`, opacity: lift ? 0.16 : 0.34, transform: `scale(${lift ? 1.7 : 1})`,
          transition: `transform ${fall}, opacity .3s, filter .3s`,
        }}
      />
      {/* The exact spot. */}
      <span style={{ position: "absolute", left: u(-3), top: u(-1.5), width: u(6), height: u(3), borderRadius: "50%", background: ink }} />
      <span
        data-motion
        style={{
          position: "absolute", left: u(-15), top: u(-46), width: u(30), height: u(46),
          transform: `translateY(${lift ? u(-12) : "0px"})`, opacity: up && reduced ? 0.55 : 1, transition: `transform ${fall}, opacity .2s`,
        }}
      >
        <span style={{ position: "absolute", left: u(13.5), top: u(15), width: u(3), height: u(31), borderRadius: u(1.5), background: ink }} />
        <span
          style={{
            position: "absolute", left: 0, top: 0, width: u(30), height: u(30), borderRadius: "50%", background: signal.fill,
            boxShadow: `0 ${u(1)} ${u(2)} rgba(0,0,0,.24)`, display: "grid", placeItems: "center",
          }}
        >
          <span style={{ width: u(10), height: u(10), borderRadius: "50%", background: ink }} />
        </span>
      </span>
    </div>
  );
}

function LocateButton({ filled, pressed }: { filled: boolean; pressed: boolean }) {
  return (
    <span
      data-motion
      style={{
        position: "absolute", right: u(12), top: u(12), width: u(44), height: u(44), borderRadius: "50%", background: ground.raised,
        boxShadow: `0 ${u(4)} ${u(10)} rgba(0,0,0,.16)`, display: "grid", placeItems: "center", color: ground.text,
        transform: pressed ? "scale(.9)" : "none", transition: `transform .3s ${spring}`,
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(19), height: u(19) }}>
        <path d="M20.2 3.8 3.9 10.6c-.6.3-.5 1.1.1 1.3l6.4 1.7 1.7 6.4c.2.6 1 .7 1.3.1l6.8-16.3z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" style={{ transition: "fill .25s" }} />
      </svg>
    </span>
  );
}

function Card({ s }: { s: Step }) {
  const a = ADDRESSES[s.address];
  const moving = s.card === "moving";
  const loading = s.card === "loading";
  const layer = (on: boolean): CSSProperties => ({ gridArea: "1 / 1", opacity: on ? 1 : 0, transition: `opacity .25s ${ease}`, whiteSpace: "nowrap" });
  const bar = (width: string, height: number, top: number): CSSProperties => ({ position: "absolute", left: 0, top: u(top), width, height: u(height), borderRadius: u(height / 2), background: ground.control });
  const pressed = "press" in s && s.press === "confirm";
  return (
    <div
      style={{
        position: "absolute", left: u(12), right: u(12), bottom: u(12), height: u(CARD_H), boxSizing: "border-box", padding: u(16),
        borderRadius: u(26), background: ground.raised, boxShadow: `0 ${u(8)} ${u(22)} rgba(0,0,0,.16)`,
      }}
    >
      <div style={{ position: "relative", height: u(47) }}>
        <div style={{ opacity: loading ? 0 : 1, transition: `opacity .25s ${ease}` }}>
          <div style={{ fontSize: u(20), lineHeight: u(25), fontWeight: 700, letterSpacing: "-0.01em", color: ground.text, opacity: moving ? 0.35 : 1, transition: `opacity .3s ${ease}`, whiteSpace: "nowrap" }}>
            {a.title}
          </div>
          <div className="grid" style={{ marginTop: u(2), fontSize: u(15), lineHeight: u(20), color: ground.muted, fontVariantNumeric: "tabular-nums" }}>
            <span style={layer(!moving)}>{a.subtitle}</span>
            <span style={layer(moving)}>Locating…</span>
          </div>
        </div>
        <div data-motion style={{ position: "absolute", inset: 0, opacity: loading ? 1 : 0, transition: `opacity .25s ${ease}`, animation: "lp-breathe 1.6s ease-in-out infinite" }}>
          <span style={bar("62%", 13, 6)} />
          <span style={bar("40%", 10, 32)} />
        </div>
      </div>
      <div
        data-motion
        style={{
          marginTop: u(14), height: u(50), borderRadius: u(25), background: signal.fill, color: signal.on, display: "grid", placeItems: "center",
          fontSize: u(17), fontWeight: 600, transform: pressed ? "scale(.97)" : "none", transition: `transform .3s ${spring}`,
        }}
      >
        <span style={{ opacity: moving ? 0.35 : 1, transition: `opacity .25s ${ease}` }}>Confirm location</span>
      </div>
    </div>
  );
}

export function LocationPickerPreview() {
  const { step: s, reduced } = useSteps(STEPS);
  const [dx, dy] = s.map;
  const glide = "glide" in s ? `transform ${s.glide}ms ${CURVES[s.curve]}` : "none";
  const finger = s.finger;
  // A lifted finger fades where it was.
  const [last, setLast] = useState<readonly [number, number]>([PIN.x, PIN.y]);
  useEffect(() => {
    if (finger) setLast(finger);
  }, [finger]);
  const at = finger ?? last;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack }}>
      <style>{"@keyframes lp-breathe{50%{filter:opacity(.45)}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}"}</style>
      <div style={{ position: "relative", width: u(W), height: u(H), borderRadius: u(26), overflow: "hidden", background: LAND, isolation: "isolate" }}>
        <div
          data-motion
          style={{
            position: "absolute", left: u(ORIGIN.x), top: u(ORIGIN.y), width: u(MAP.w), height: u(MAP.h),
            transform: `translate(${u(dx)}, ${u(dy)})`, transition: glide,
          }}
        >
          <MapArt />
        </div>
        <Pin up={s.pin === "up"} reduced={reduced} />
        <LocateButton filled={s.atUser} pressed={"press" in s && s.press === "locate"} />
        <Card s={s} />
        {/* The finger: a soft disc that follows the scripted touch. */}
        <span
          aria-hidden
          data-motion
          style={{
            position: "absolute", left: u(at[0]), top: u(at[1]), width: u(40), height: u(40), marginLeft: u(-20), marginTop: u(-20),
            borderRadius: "50%", boxSizing: "border-box", border: `${u(1.5)} solid color-mix(in srgb, ${ground.text} 40%, transparent)`,
            background: `color-mix(in srgb, ${ground.text} 14%, transparent)`, opacity: finger ? 1 : 0, pointerEvents: "none",
            transition: finger && s.name === "drag" ? `left ${s.glide}ms linear, top ${s.glide}ms linear, opacity .2s` : "opacity .2s",
          }}
        />
      </div>
    </div>
  );
}
