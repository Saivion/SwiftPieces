"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, paper, signal } from "./palette";
import { pressScale, roles, springValue, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

/*
 * Location Picker: a drawn map under a fixed red pin, with the liquid glass chrome over it: the address card, the
 * red Confirm capsule resting apart below it, and the locate button.
 * It rests on the person's location, then a finger drags the map (the pin lifts, the card dims the street and says
 * Locating…, and Confirm melts back up into the card), throws it, the map coasts and settles, and the pin drops and
 * presses into place. The card holds the old street, Locating… breathing, until the new one morphs in letter by
 * letter and Confirm buds back down out of the card. Locate-me flies the map back to the sky user dot, the pin
 * presses in on it, the street it already knows returns at once with Confirm, and Confirm dips, which is exactly
 * where the loop began.
 * Sizes are authored in iOS points: 1 pt is 1.08 px on the 560 px docs stage, converted to `cqw`.
 */

/**
 * The storyboard (also the launch video's script). Each step holds for `ms`. `map` is how far the map
 * has moved from rest, in points, reached over `glide` ms with `curve`, or on the camera's flight spring.
 * `finger` is the touch in points inside the picker (372 x 363), `null` when lifted. `card`: the address,
 * or `moving` (last address dimmed, "Locating…") from the moment the map moves until the next address
 * arrives. `address` 0 is 210 Maple Avenue (rest), 1 is 48 Juniper Lane.
 */
const STEPS = [
  { name: "rest", ms: 1700, map: [0, 0], pin: "down", card: "address", address: 0, finger: null, atUser: true },
  { name: "touch", ms: 260, map: [0, 0], pin: "down", card: "address", address: 0, finger: [290, 172], atUser: true },
  { name: "drag", ms: 900, map: [-56, -64], glide: 900, curve: "drag", pin: "up", card: "moving", address: 0, finger: [234, 108], atUser: false },
  { name: "let go and coast", ms: 380, map: [-70, -80], glide: 380, curve: "coast", pin: "up", card: "moving", address: 0, finger: null, atUser: false },
  { name: "drop", ms: 650, map: [-70, -80], pin: "down", card: "moving", address: 0, finger: null, atUser: false },
  { name: "new street", ms: 1400, map: [-70, -80], pin: "down", card: "address", address: 1, finger: null, atUser: false },
  { name: "tap locate", ms: 240, map: [-70, -80], pin: "down", card: "address", address: 1, finger: [338, 34], press: "locate", atUser: false },
  { name: "glide home", ms: 700, map: [0, 0], curve: "flight", pin: "up", card: "moving", address: 1, finger: null, atUser: false },
  // A spot already looked up is cached, so its street lands as the pin does.
  { name: "drop on you", ms: 600, map: [0, 0], pin: "down", card: "address", address: 0, finger: null, atUser: true },
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
/**
 * The finger speeds up into the throw, and MapKit's coast leaves at that same speed (both about 0.135 pt
 * per ms) and slows to rest, so letting go never jolts the map.
 */
const CURVES = { drag: "cubic-bezier(0.35, 0, 0.65, 0.5)", coast: "cubic-bezier(0.2, 0.49, 0.3, 1)" } as const;

/**
 * The picker, the glass at its bottom edge and the pin, which sits in the middle of the map the glass leaves
 * visible: the card (two lines in 16 pt of padding), then Confirm's place `liquid.apart` below it, which keeps its
 * height while Confirm is away.
 */
const W = 372;
const H = 363;
const PANEL_H = 79;
const CONFIRM_H = 50;
const CARD_H = PANEL_H + liquid.apart + CONFIRM_H;
const PIN = { x: W / 2, y: (H - CARD_H - 12) / 2 };
/** Confirm's home: shrunk, just inside the card's bottom edge. */
const CONFIRM_HOME: [number, number] = [0, -(CONFIRM_H / 2 + liquid.apart + (CONFIRM_H * liquid.homeScale) / 2)];

/**
 * A camera flight, as Swift times it: longer the farther it goes (0.5 s plus a little per screen, 1.2 s at
 * most), on a spring with no bounce, so the map never carries past the spot and back under the pin.
 */
const flight = (dx: number, dy: number): Spring => ({ duration: Math.min(0.5 + 0.18 * Math.log2(1 + Math.hypot(dx / W, dy / H)), 1.2), bounce: 0 });
const FLIGHT = flight(70, 80);

/** Buttons sink about 2.5 pt per edge: the 44 pt locate button to 0.92, the 348 x 50 pt Confirm to 0.97. */
const LOCATE_PRESS = pressScale(44, 44);
const CONFIRM_PRESS = pressScale(W - 24, CONFIRM_H);

/**
 * The pin pressing into place, keyed as Swift keys it: still until the tip meets the ground 90 ms into the
 * drop, then 6% wider and shorter from the tip on the press spring over 70 ms, then back into shape on the
 * release spring over 400 ms. Sampled from the springs themselves.
 */
const SQUASH = (() => {
  const contact = 90, sink = 70, back = 400, give = 0.06, total = contact + sink + back;
  const at = (ms: number, s: number): Keyframe => ({ offset: ms / total, transform: `scale(${(1 + s).toFixed(4)}, ${(1 / (1 + s)).toFixed(4)})` });
  const end = springValue(roles.press, sink / 1000);
  const frames = [at(0, 0), at(contact, 0)];
  for (let ms = 10; ms <= sink; ms += 10) frames.push(at(contact + ms, (give * springValue(roles.press, ms / 1000)) / end));
  for (let ms = 16; ms < back; ms += 16) frames.push(at(contact + sink + ms, give * (1 - springValue(roles.release, ms / 1000))));
  frames.push(at(total, 0));
  return { frames, ms: total };
})();
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
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
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

function Pin({ up, flight, reduced }: { up: boolean; flight: boolean; reduced: boolean }) {
  const lift = up && !reduced;
  // Picked up by the drag, it springs about a point past its lift and settles; a camera flight lifts it on a
  // snap. Drops on the press spring, which never overshoots, so the tip stops on the spot.
  const role = up ? (flight || reduced ? "snap" : "release") : reduced ? "snap" : "press";
  const body = useRef<HTMLSpanElement>(null);
  const wasUp = useRef(up);
  // Each landing presses the pin into the ground as the tip meets it. Reduce Motion lands without the press.
  useEffect(() => {
    const landed = wasUp.current && !up;
    wasUp.current = up;
    const el = body.current;
    if (!landed || reduced || !el) return;
    const press = el.animate(SQUASH.frames, { duration: SQUASH.ms });
    return () => press.cancel();
  }, [up, reduced]);
  return (
    <div data-motion style={{ position: "absolute", left: u(PIN.x), top: u(PIN.y), width: 0, height: 0 }}>
      {/* The shadow on the ground spreads and fades as the pin rises, on the pin's own spring. */}
      <span
        data-motion
        style={{
          position: "absolute", left: u(-9), top: u(-3), width: u(18), height: u(6), borderRadius: "50%", background: "#000",
          filter: `blur(${u(lift ? 3 : 1.2)})`, opacity: lift ? 0.16 : 0.34, transform: `scale(${lift ? 1.7 : 1})`,
          transition: t(["transform", "opacity", "filter"], role),
        }}
      />
      {/* The exact spot. */}
      <span style={{ position: "absolute", left: u(-3), top: u(-1.5), width: u(6), height: u(3), borderRadius: "50%", background: ink }} />
      <span
        data-motion
        style={{
          position: "absolute", left: u(-15), top: u(-46), width: u(30), height: u(46),
          transform: `translateY(${lift ? u(-12) : "0px"})`, opacity: up && reduced ? 0.55 : 1, transition: t(["transform", "opacity"], role),
        }}
      >
        {/* Gives from the tip: wider and shorter by the same factor, so it never sinks through the spot. */}
        <span ref={body} style={{ position: "absolute", inset: 0, transformOrigin: "50% 100%" }}>
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
      </span>
    </div>
  );
}

const ARROW = "M20.2 3.8 3.9 10.6c-.6.3-.5 1.1.1 1.3l6.4 1.7 1.7 6.4c.2.6 1 .7 1.3.1l6.8-16.3z";

function LocateButton({ filled, pressed }: { filled: boolean; pressed: boolean }) {
  return (
    <Liquid
      style={{
        position: "absolute", right: u(12), top: u(12), width: u(44), height: u(44), display: "grid", placeItems: "center", color: ground.text,
        transform: pressed ? `scale(${LOCATE_PRESS})` : "none", transition: t("transform", pressed ? "press" : "release"),
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(19), height: u(19) }}>
        {/* The arrow fills in as the pin lands on the person: one glyph blurs out as the other sharpens in, on a snap.
            A fill can't fade from none, so the two glyphs are drawn and swapped. */}
        {[false, true].map((solid) => (
          <path
            key={String(solid)}
            data-motion
            d={ARROW}
            fill={solid ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinejoin="round"
            style={{
              opacity: solid === filled ? 1 : 0, filter: `blur(${solid === filled ? 0 : 1.5}px)`,
              transition: t(["opacity", "filter"], "snap"),
            }}
          />
        ))}
      </svg>
    </Liquid>
  );
}

function Card({ s }: { s: Step }) {
  const moving = s.card === "moving";
  const lifted = s.pin === "up";
  const address = ADDRESSES[s.address];
  // Confirm buds out of the card once the spot has its address and melts back into it while the map moves.
  const confirmOut = s.card === "address";
  const pressed = "press" in s && s.press === "confirm";
  return (
    <div style={{ position: "absolute", left: u(12), right: u(12), bottom: u(12) }}>
      <LiquidGroup unit={u(1)} axis="y">
        <div className="flex flex-col" style={{ gap: u(liquid.apart) }}>
          {/* Above Confirm, so Confirm waiting at home slips under it. */}
          <div className="relative" style={{ zIndex: 1 }}>
            <Liquid radius={26} style={{ height: u(PANEL_H), boxSizing: "border-box", padding: u(16) }}>
              {/* The last street stays, dimmed, until the next one morphs in over it letter by letter. */}
              <div data-motion style={{ fontSize: u(20), lineHeight: u(25), fontWeight: 600, letterSpacing: "-0.01em", color: ground.text, opacity: moving ? 0.35 : 1, transition: t("opacity", moving ? "snap" : "reveal"), whiteSpace: "nowrap" }}>
                <MorphText text={address.title} />
              </div>
              <div style={{ marginTop: u(2), fontSize: u(15), lineHeight: u(20), fontWeight: 600, color: ground.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {/* Locating… breathes once the pin is down and the lookup runs; it holds steady while the map moves. */}
                <span data-motion style={{ display: "inline-flex", animation: moving && !lifted ? "lp-breathe 1.6s ease-in-out infinite" : "none" }}>
                  <MorphText text={moving ? "Locating…" : address.subtitle} />
                </span>
              </div>
            </Liquid>
          </div>
          <span data-motion className="flex" style={{ transform: pressed ? `scale(${CONFIRM_PRESS})` : "none", transition: t("transform", pressed ? "press" : "release") }}>
            {/* Its red drains as it melts home, so it never sits over the address. */}
            <Liquid tint={confirmOut ? signal.fill : undefined} bud={{ out: confirmOut, home: CONFIRM_HOME }} className="grid place-items-center" style={{ width: "100%", height: u(CONFIRM_H), color: signal.on, fontSize: u(17), fontWeight: 600 }}>
              <BudContent out={confirmOut}>Confirm location</BudContent>
            </Liquid>
          </span>
        </div>
      </LiquidGroup>
    </div>
  );
}

export function LocationPickerPreview() {
  const { step: s, reduced } = useSteps(STEPS);
  const [dx, dy] = s.map;
  const glide = !("curve" in s) ? "none" : s.curve === "flight" ? t("transform", FLIGHT) : `transform ${s.glide}ms ${CURVES[s.curve]}`;
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
        <Pin up={s.pin === "up"} flight={"curve" in s && s.curve === "flight"} reduced={reduced} />
        <LocateButton filled={s.atUser} pressed={"press" in s && s.press === "locate"} />
        <Card s={s} />
        {/* The finger: a soft disc that follows the scripted touch, moving with the map it drags. */}
        <span
          aria-hidden
          data-motion
          style={{
            position: "absolute", left: 0, top: 0, width: u(40), height: u(40), transform: `translate(${u(at[0] - 20)}, ${u(at[1] - 20)})`,
            borderRadius: "50%", boxSizing: "border-box", border: `${u(1.5)} solid color-mix(in srgb, ${ground.text} 40%, transparent)`,
            background: `color-mix(in srgb, ${ground.text} 14%, transparent)`, opacity: finger ? 1 : 0, pointerEvents: "none",
            transition: finger && s.name === "drag" ? `transform ${s.glide}ms ${CURVES.drag}, opacity .2s` : "opacity .2s",
          }}
        />
      </div>
    </div>
  );
}
