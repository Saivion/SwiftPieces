"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { pressScale, reduced, roles, rubberBand, t as tr, tiers, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, budStyle, liquid } from "./piece-liquid";

/* Glass: GlassSurface, GlassActionMenu, GlassSegments. Each preview shows the component and nothing
   else, sized in container units so it scales from the grid card to the docs header. The stage is
   4:3, so 100cqw wide and 75cqw tall; 1 iOS point is 0.19cqw. Every glass surface is a `Liquid` in one
   `LiquidGroup` per piece, as the Swift pieces put theirs in one `PieceLiquidGroup`. */

/** One iOS point on the stage. */
const UNIT = "0.19cqw";
const p = (n: number) => `${+(n * 0.19).toFixed(3)}cqw`;
const smooth = "cubic-bezier(0.22, 1, 0.36, 1)";
const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>{children}</div>;
}

function Glyph({ d, size, fill = false, stroke = 2.4 }: { d: string; size: number; fill?: boolean; stroke?: number }) {
  return <svg aria-hidden viewBox="0 0 24 24" style={{ width: p(size), height: p(size), flexShrink: 0 }} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const G = {
  prev: "M14.5 5.5 8 12l6.5 6.5",
  next: "M9.5 5.5 16 12l-6.5 6.5",
  play: "M8 5.5v13l10.5-6.5z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  camera: "M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
};

// MARK: Glass Surface

/** The blocks the glass floats on, in stage points (400 x 300), drifting so the refraction moves. */
function Cover({ t }: { t: number }) {
  const drift = Math.sin(t * 0.45);
  return (
    <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <rect width="400" height="300" fill={blocks.lilac} />
      <circle cx={200 + 96 + drift * 34} cy={76 + Math.cos(t * 0.3) * 16} r="115" fill={blocks.butter} />
      <rect x={200 - 94 - drift * 26 - 125} y={169} width="250" height="170" rx="34" fill={blocks.sage} transform={`rotate(-8 ${200 - 94 - drift * 26} 254)`} />
      <rect x={200 + 46 - drift * 44 - 150} y={203} width="300" height="50" rx="25" fill={blocks.sky} />
    </svg>
  );
}

/** Surface sizes in points: circle, capsule, circle. */
const SURFACES: [number, number][] = [[76, 76], [190, 76], [76, 76]];
/** The scripted touches: which surface, where the finger lands (unit point), where it slides to, and how long it holds. */
const TOUCHES: { i: number; at: [number, number]; to?: [number, number]; hold: number }[] = [
  { i: 1, at: [0.3, 0.6], to: [0.68, 0.44], hold: 640 },
  { i: 0, at: [0.42, 0.62], hold: 300 },
  { i: 2, at: [0.6, 0.38], hold: 300 },
  { i: 1, at: [0.56, 0.6], hold: 300 },
];
/** Half the pool layer's side: enough to cover the capsule from any touch point. */
const POOL_SPAN = 210;

/**
 * The component alone: three surfaces in one `GlassSurface.Group`, resting joined (6pt apart, inside the merge
 * distance) so liquid necks hold them together as one transport control, floating on full-bleed color blocks. The
 * capsule is signal-tinted glass with the house ink; the circles are neutral glass. Each surface takes a press in
 * turn, as iOS 26's interactive glass answers one: it swells about 2pt an edge on the press spring with no overshoot,
 * so the necks beside it thicken, and light pools under the finger and follows it (the first press slides). On lift
 * it settles back on the release spring with a little give, and the light fades where the finger was.
 */
export function GlassSurfacePreview() {
  const [pressed, setPressed] = useState(-1);
  const [pools, setPools] = useState<[number, number][]>(() => SURFACES.map(() => [0.5, 0.5]));
  const [slide, setSlide] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { setT(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    let n = 0;
    const timers = new Set<number>();
    const later = (ms: number, fn: () => void) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const loop = setInterval(() => {
      const touch = TOUCHES[n++ % TOUCHES.length];
      const place = (at: [number, number]) => setPools((all) => all.map((pt, k) => (k === touch.i ? at : pt)));
      // The light lands where the finger does, without travelling there from the last touch.
      setSlide(0); place(touch.at); setPressed(touch.i);
      // It follows a sliding finger directly: a steady glide, never a spring.
      if (touch.to) { const to = touch.to; later(140, () => { setSlide(touch.hold - 200); place(to); }); }
      later(touch.hold, () => setPressed(-1));
    }, 1400);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []);
  const still = reduced();
  const pool = (i: number) => {
    const [w, h] = SURFACES[i], [x, y] = pools[i], down = pressed === i;
    // About the surface's short side, wider on long ones, so it reads as a pool, not a spot.
    const r = Math.max(Math.min(w, h), Math.max(w, h) * 0.5, 44);
    return (
      <span aria-hidden className="pointer-events-none absolute left-0 top-0" style={{
        width: p(POOL_SPAN * 2), height: p(POOL_SPAN * 2), marginLeft: p(-POOL_SPAN), marginTop: p(-POOL_SPAN),
        background: `radial-gradient(circle ${p(r)} at center, rgba(255,255,255,.3), rgba(255,255,255,.1) ${p(r)})`,
        transform: `translate(${p(x * w)}, ${p(y * h)})`, opacity: down ? 1 : 0,
        // Arrives on the press spring and fades on the release one.
        transition: [tr("opacity", down ? "press" : "release"), down && slide ? `transform ${slide}ms linear` : ""].filter(Boolean).join(", "),
      }} />
    );
  };
  const glyphs = [<Glyph key="prev" d={G.prev} size={28} />, <Glyph key="play" d={G.play} size={30} fill />, <Glyph key="next" d={G.next} size={28} />];
  return (
    <Stage>
      <Cover t={t} />
      <LiquidGroup unit={UNIT} axis="x">
        <div className="flex items-center" style={{ gap: p(liquid.joined) }}>
          {SURFACES.map(([w, h], i) => {
            const down = pressed === i;
            // Swells from the center by about 2pt an edge, whatever its size. Reduce Motion keeps the light only.
            const swell = 2 - pressScale(w, h, 2);
            return (
              <span key={i} data-motion className="flex" style={{ transform: `scale(${down && !still ? swell : 1})`, transition: tr("transform", down ? "press" : "release") }}>
                {/* The light pools behind the glyph, inside the glass, clipped to its shape. */}
                <Liquid tint={i === 1 ? signal.fill : undefined} className="relative flex items-center justify-center overflow-hidden" style={{ width: p(w), height: p(h), color: i === 1 ? signal.on : ground.text }}>
                  {pool(i)}
                  <span className="relative grid">{glyphs[i]}</span>
                </Liquid>
              </span>
            );
          })}
        </div>
      </LiquidGroup>
    </Stage>
  );
}

// MARK: Glass Action Menu

const ITEMS = [
  { label: "Note", icon: G.pencil },
  { label: "Voice memo", icon: G.mic },
  { label: "Photo", icon: G.camera },
];
/** Where the scripted finger rests on each item, in points from its center: a thumb arriving from the trigger lands a little short. */
const AIM: [number, number][] = [[0, 0], [-6, 9], [9, 4]];
/** The Swift piece's geometry in points: a 64pt trigger and 60pt actions resting apart on an arc grown so neighbours keep the apart gap. */
const TRIGGER = 64, ITEM = 60;
/** A name pill's height and type: two thirds of its action's height, so the neck between them reads full. */
const NAME_H = 40, NAME_TYPE = 17;
const RADIUS = Math.max(TRIGGER / 2 + liquid.apart + ITEM / 2 + 28, (ITEM + liquid.apart) / 2 / Math.sin(Math.PI / 8));
/** An action's place, from the trigger's center. */
const place = (i: number): [number, number] => {
  const a = Math.PI / 2 + ((Math.PI / 2) * i) / (ITEMS.length - 1);
  return [Math.cos(a) * RADIUS, -Math.sin(a) * RADIUS];
};
/** An action's home: inside the trigger, just short of its edge on the side facing its place. */
const homeOf = (i: number): [number, number] => {
  const [x, y] = place(i), d = Math.hypot(x, y), inset = (TRIGGER - ITEM * liquid.homeScale) / 2 - 2;
  return [(x / d) * inset, (y / d) * inset];
};
/** A name's width in points, near enough to squeeze it inside its action at home: 17pt semibold with 16pt either side. */
const nameWidth = (label: string) => 32 + label.length * 9.4;
/** The box the group draws in, in points: wide and tall enough for the arc and its names, so the goo never clips. */
const MENU_W = 320, MENU_H = 280;

/**
 * The component alone, in the Swift `.arc` arrangement, anchored in the corner of the stage. Loop: a hold sinks the
 * signal glass trigger without bouncing and, 350ms in, it turns to a close mark on a crisp snap while the actions bud
 * out of it 50ms apart on the split spring, each born inside the trigger and pulling a neck that thins and snaps as it
 * reaches its place, apart from its neighbours. Each name buds from its own action 160ms later, squeezed inside it at
 * first, and stays joined to it by a neck. The finger slides across Photo and Voice memo (each lifts to 1.12 with
 * elastic give and leans toward the finger) and releases on Voice memo: the trigger springs back and the action swells
 * to 1.2. 140ms later the names melt into their actions, the other actions melt home farthest first, and the chosen
 * one melts in last as the trigger's close mark blurs into a check. Reduce Motion fades everything at its place.
 */
export function GlassActionMenuPreview() {
  const [pressed, setPressed] = useState(false), [open, setOpen] = useState(false);
  const [out, setOut] = useState(false), [named, setNamed] = useState(false);
  const [hover, setHover] = useState(-1), [fired, setFired] = useState(-1), [check, setCheck] = useState(false);
  useEffect(() => {
    // Reduce Motion skips the waits between the stages, as the Swift piece does: everything fades at once.
    const r = reduced();
    const steps: [number, () => void][] = [
      [900, () => setPressed(true)],
      // The hold opens the menu under the same touch: the scrim and the actions, then the names a beat later.
      [1250, () => { setOpen(true); setOut(true); }],
      [r ? 1250 : 1410, () => setNamed(true)],
      [2400, () => setHover(2)], [2850, () => setHover(1)],
      // Release on Voice memo fires it: the trigger lets go and the action swells until it is home.
      [3300, () => { setPressed(false); setFired(1); }],
      // The action runs 140ms later, as the menu starts to close: the names melt in first.
      [3440, () => { setOpen(false); setNamed(false); }],
      [r ? 3440 : 3530, () => setOut(false)],
      // The chosen action sets off last, 80ms after the first, and is under the trigger about 220ms later.
      [r ? 3440 : 3830, () => setCheck(true)],
      [4530, () => { setCheck(false); setFired(-1); setHover(-1); }],
    ];
    let timers: number[] = [];
    const run = () => { timers = steps.map(([t, fn]) => window.setTimeout(fn, t)); };
    run(); const loop = setInterval(run, 5600);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []);
  // The order the actions melt home: farthest first, a fired action last. Out they bud nearest first.
  const order = fired >= 0 ? [fired, ...[...ITEMS.keys()].filter((k) => k !== fired)] : [...ITEMS.keys()];
  const homeRank = (i: number) => order.length - 1 - order.indexOf(i);
  // The trigger's glyph: a close mark while open or while the fired action is on its way home, then a check.
  const glyph = check ? "confirm" : open || fired >= 0 ? "open" : "rest";
  // Reduce Motion: no sink, lift, lean, neck or stagger; bubbles fade at their places.
  const still = reduced();
  const unit = UNIT;

  const action = (i: number) => {
    const item = ITEMS[i], above = i === 0;
    const lifted = hover === i || fired === i, scale = still ? 1 : fired === i ? 1.2 : lifted ? 1.12 : 1;
    // The hovered action leans a few points toward the finger, easing off short of 4 like a tether taking the strain.
    const [ax, ay] = AIM[i], d = Math.hypot(ax, ay), pull = !still && hover === i && fired < 0 && d > 0.5 ? rubberBand(d, 4) / d : 0;
    // Out on the split spring, nearest first; home on the bounceless one in the melting order.
    const bud: CSSProperties = still
      ? { transform: `translate(${p(place(i)[0])}, ${p(place(i)[1])}) scale(1)`, opacity: out ? 1 : 0, transition: tr("opacity", out ? "reveal" : "dismiss") }
      : { ...budStyle({ out, rest: place(i), home: homeOf(i) }, unit), transition: tr("transform", out ? liquid.split : liquid.home, out ? i * 50 : homeRank(i) * 40) };
    // The name: home it is squeezed narrow and shrunk at the action's center; out it rests joined beside it.
    const squeeze = Math.min(1, (ITEM * 0.66) / (nameWidth(item.label) * liquid.homeScale)), reach = liquid.joined + ITEM / 2;
    const homeShift = above ? `translate(0, calc(50% + ${p(reach)}))` : `translate(calc(50% + ${p(reach)}), 0)`;
    const name: CSSProperties = still
      ? { opacity: named ? 1 : 0, transition: tr("opacity", named ? "reveal" : "dismiss") }
      : {
        transform: named ? "translate(0, 0) scale(1, 1)" : `${homeShift} scale(${liquid.homeScale * squeeze}, ${liquid.homeScale})`,
        transition: tr("transform", named ? liquid.split : liquid.home, named ? i * 50 : (ITEMS.length - 1 - i) * 40),
      };
    return (
      <div key={item.label} data-motion className="absolute left-1/2 top-1/2" style={{ width: p(ITEM), height: p(ITEM), marginLeft: p(-ITEM / 2), marginTop: p(-ITEM / 2), zIndex: lifted ? 2 : 1, ...bud }}>
        {/* The name rides its action's bud, behind it, joined to it by a neck. */}
        <div className="absolute flex" style={above ? { left: 0, right: 0, bottom: `calc(100% + ${p(liquid.joined)})`, justifyContent: "center" } : { right: `calc(100% + ${p(liquid.joined)})`, top: 0, bottom: 0, alignItems: "center" }}>
          <Liquid className="flex items-center whitespace-nowrap" style={{ height: p(NAME_H), paddingInline: p(16), fontSize: p(NAME_TYPE), fontWeight: 600, lineHeight: 1, color: ground.text, ...name }}>
            <BudContent out={named}>{item.label}</BudContent>
          </Liquid>
        </div>
        {/* Lifts and swells with elastic give; drops away firmly. Reduce Motion rings the targeted action instead. */}
        <Liquid className="relative grid place-items-center" style={{
          width: "100%", height: "100%", color: ground.text,
          transform: `translate(${p(ax * pull)}, ${p(ay * pull)}) scale(${scale})`,
          boxShadow: still && lifted ? `inset 0 0 0 ${p(2.5)} ${ground.text}` : undefined,
          transition: tr("transform", scale > 1 ? tiers.elastic : "dismiss"),
        }}>
          <BudContent out={out}><Glyph d={item.icon} size={23} /></BudContent>
        </Liquid>
      </div>
    );
  };

  return (
    <Stage style={{ justifyContent: "stretch", alignItems: "stretch" }}>
      <div className="relative flex-1">
        {/* A plain fade that follows the menu: in at the reveal's pace, out at the dismiss's. */}
        <div aria-hidden className="absolute inset-0" style={{ background: "#000", opacity: open ? 0.28 : 0, transition: tr("opacity", open ? "reveal" : "dismiss") }} />

        <div className="absolute" style={{ right: p(4), bottom: p(0) }}>
          <LiquidGroup unit={unit} axis="both">
            {/* Gives the group its box, so both passes lay the bubbles out from the same corner. */}
            <div style={{ width: p(MENU_W), height: p(MENU_H) }} />
            <div className="absolute" style={{ right: p(30), bottom: p(30), width: p(TRIGGER), height: p(TRIGGER) }}>
              {ITEMS.map((_, i) => action(i))}
              {/* Last, so an action at home sits under it. Sinks under the finger without bouncing and springs back with give on release. */}
              <span data-motion className="absolute inset-0 z-[3] flex" style={{ transform: `scale(${pressed && !still ? pressScale(TRIGGER, TRIGGER) : 1})`, transition: tr("transform", pressed ? "press" : "release") }}>
                <Liquid tint={signal.fill} className="grid size-full place-items-center" style={{ color: signal.on }}>
                  {/* Turns to close on a snap, lands the check as the outcome, and turns back firmly. */}
                  <span data-motion style={{ display: "grid", transform: `rotate(${glyph === "open" ? 45 : 0}deg)`, transition: tr("transform", glyph === "open" ? "snap" : glyph === "confirm" ? "success" : "dismiss") }}>
                    {/* A new glyph blurs in where the old one was. */}
                    <span key={check ? "check" : "plus"} className="pv-lq-in" style={{ display: "grid" }}><Glyph d={check ? G.check : G.plus} size={26} stroke={3} /></span>
                  </span>
                </Liquid>
              </span>
            </div>
          </LiquidGroup>
          {/* The finger: over the trigger while holding, then on the hovered item. */}
          <div aria-hidden className="pointer-events-none absolute" style={{ right: p(30), bottom: p(30), width: p(TRIGGER), height: p(TRIGGER) }}>
            <span data-motion className="absolute left-1/2 top-1/2 rounded-full" style={{
              width: p(40), height: p(40), marginLeft: p(-20), marginTop: p(-20), background: "radial-gradient(circle at 40% 36%, rgba(255,255,255,.55), rgba(255,255,255,.15) 64%)",
              opacity: pressed ? 1 : 0, transition: `opacity .2s, transform .4s ${smooth}`,
              transform: hover >= 0 ? `translate(${p(place(hover)[0] + AIM[hover][0])}, ${p(place(hover)[1] + AIM[hover][1])})` : "none",
            }} />
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Glass Segments

const PERIODS = ["Day", "Week", "Month", "Year"];
/** Track geometry in points: a 400 x 50 track, 3pt inset, so the row is 394 x 44 and a segment 98.5 wide. */
const INSET = 3, ROW_W = 400 - INSET * 2, ROW_H = 50 - INSET * 2, SEG = ROW_W / PERIODS.length, LIFT = 1.04;
/** Reduce Motion: both edges share this short spring with no overshoot. */
const STILL: Spring = { duration: 0.25, bounce: 0 };

/** One sprung value, in points, stepped by hand so each edge keeps its own spring and a release can pass it the finger's speed. */
type Sprung = { x: number; v: number; to: number; s: Spring };
function step(e: Sprung, dt: number) {
  const w = (2 * Math.PI) / e.s.duration, z = 1 - clamp(e.s.bounce, 0, 0.99), n = Math.ceil(dt / 0.002), h = dt / n;
  for (let k = 0; k < n; k++) { e.v += (-w * w * (e.x - e.to) - 2 * z * w * e.v) * h; e.x += e.v * h; }
}
/** Retarget, carrying `velocity` (points per second) as PieceMotion's settle does: in whole distances per second, capped near the spring's frequency. */
function launch(e: Sprung, to: number, s: Spring, velocity = 0) {
  const distance = to - e.x;
  e.to = to; e.s = s;
  if (velocity && Math.abs(distance) >= 1) {
    const cap = ((2 * Math.PI) / s.duration) * (s === STILL ? 1 : 1.5);
    e.v = clamp(velocity / distance, -cap, cap) * distance;
  }
}

/** The two scripted drags: grab, move along an easing, release, and the segment the release commits to. */
const DRAGS = [
  // Grabbed on Month and pushed past the far end: it flattens against the wall, then springs back to full width.
  { grab: 1.9, from: 2.5 * SEG, to: ROW_W - SEG / 2 + 60, move: [2.0, 2.42], ease: (q: number) => 0.5 - Math.cos(Math.PI * q) / 2, release: 2.9, land: 3 },
  // Grabbed on Year and flicked left: released at full speed over Month, it lands on Week at the flick's speed.
  { grab: 3.9, from: 3.5 * SEG, to: 3.5 * SEG - 112, move: [4.0, 4.22], ease: (q: number) => q * q, release: 4.22, land: 1 },
];
const TAPS = [{ at: 0.6, index: 2 }];
const LOOP = 6.4;

/** A length in points from a CSS expression of plain numbers (the live edges are CSS variables on the control). */
const pts = (expr: string) => `calc(${UNIT} * (${expr}))`;
/** The indicator's live outline in the track, in points: its lifted edges `--l` and `--u` along the row, and `--g` of lift above and below. */
const indicatorBox: CSSProperties = {
  position: "absolute", borderRadius: 9999,
  left: pts(`${INSET} + var(--l)`), width: pts("var(--u) - var(--l)"),
  top: pts(`${INSET} - var(--g)`), height: pts(`${ROW_H} + 2 * var(--g)`),
};

/**
 * The component alone. Track and indicator are glass in one group: a neutral glass track with a signal-tinted glass
 * indicator melted into it, the house ink on the red. The indicator moves like liquid. A tap on Month hands it over
 * edge by edge: the edge facing Month leads on a tight spring and lands crisply, the far edge follows on the responsive
 * one, so it reaches across and gathers in. Then a finger grabs it (lift 1.04 with no bounce, deeper shadow) and pushes
 * it past the end, where the wall edge gives no more than the inset and the far edge rubber-bands, so it flattens; let
 * go, it springs back to full width. Last, a flick from Year: the leading edge reaches ahead with speed, and on release
 * both edges leave at the finger's speed into the same hand-off, landing on Week as the lift comes down on the release
 * spring. The selected ink is a copy of the labels clipped to the indicator's live shape, so the color hands over
 * under its edge. The live edges are CSS variables on the control, so both glass passes and the ink follow one value.
 */
export function GlassSegmentsPreview() {
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = reduced();
    const lead = still ? STILL : tiers.tight, trail = still ? STILL : tiers.responsive;
    const lo: Sprung = { x: SEG, v: 0, to: SEG, s: lead }, up: Sprung = { x: 2 * SEG, v: 0, to: 2 * SEG, s: lead };
    // The reach a resting finger lets go of, sprung back to nothing on the settle spring.
    const exLo: Sprung = { x: 0, v: 0, to: 0, s: roles.settle }, exUp: Sprung = { x: 0, v: 0, to: 0, s: roles.settle };
    const lift: Sprung = { x: 0, v: 0, to: 0, s: roles.press };
    let raf = 0, last = 0, clock = 0, held: (typeof DRAGS)[number] | null = null, finger = 0, reachAhead = 0, rest = 0;
    let written = "";

    /** Edges under a finger holding the indicator's center at `center`. Past an end the wall edge gives no more than the inset while the far edge rubber-bands, so it flattens. */
    const edges = (center: number, ahead: number) => {
      const half = SEG / 2, hold = clamp(center, half, ROW_W - half), over = center - hold;
      const wall = rubberBand(over, INSET), far = still ? wall : rubberBand(over, 24);
      let lower = hold - half + (over < 0 ? wall : far), upper = hold + half + (over > 0 ? wall : far);
      if (ahead > 0) upper = Math.min(upper + ahead * SEG, ROW_W + INSET);
      if (ahead < 0) lower = Math.max(lower + ahead * SEG, -INSET);
      return [lower, upper];
    };
    /** Edge by edge: the edge facing the new segment leads on the tight spring, the far one follows on the responsive one. */
    const handOff = (index: number, velocity = 0) => {
      const lower = index * SEG, upper = lower + SEG, forward = lower + SEG / 2 > (lo.x + up.x) / 2;
      launch(up, upper, forward ? lead : trail, velocity);
      launch(lo, lower, forward ? trail : lead, velocity);
    };
    const fingerAt = (drag: (typeof DRAGS)[number], s: number) => drag.from + (drag.to - drag.from) * drag.ease(clamp((s - drag.move[0]) / (drag.move[1] - drag.move[0])));

    const fire = (s0: number, s1: number) => {
      const inside = (at: number) => at > s0 && at <= s1;
      for (const tap of TAPS) if (inside(tap.at)) handOff(tap.index);
      for (const drag of DRAGS) {
        if (inside(drag.grab)) {
          held = drag; finger = drag.from; reachAhead = 0; rest = 0;
          // The indicator stops where it is and follows the finger directly; the lift comes in with no bounce.
          lo.v = up.v = 0;
          launch(lift, 1, roles.press);
        }
        if (inside(drag.release) && held === drag) {
          held = null;
          // Fold any reach still relaxing into the edges, so they leave from exactly where they are.
          lo.x += exLo.x; up.x += exUp.x; exLo.x = exUp.x = exLo.v = exUp.v = 0;
          const q = (drag.release - drag.move[0]) / (drag.move[1] - drag.move[0]);
          const speed = q > 0 && q <= 1 ? ((drag.to - drag.from) * (drag.ease(q) - drag.ease(q - 0.001))) / 0.001 / (drag.move[1] - drag.move[0]) : 0;
          const pastEnd = finger < SEG / 2 || finger > ROW_W - SEG / 2;
          // Let go flattened against an end and landing there, the push went into the wall: it comes back without it.
          if (pastEnd) { launch(lo, drag.land * SEG, still ? STILL : roles.rebound); launch(up, (drag.land + 1) * SEG, still ? STILL : roles.rebound); lo.v = up.v = 0; }
          else handOff(drag.land, speed);
          launch(lift, 0, roles.release);
          reachAhead = 0;
        }
      }
    };

    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const s0 = clock % LOOP;
      clock += dt;
      const s1 = clock % LOOP;
      if (dt > 0) { if (s1 >= s0) fire(s0, s1); else { fire(s0, LOOP); fire(-1, s1); } }

      if (held) {
        const next = fingerAt(held, s1), velocity = dt > 0 ? (next - finger) / dt : 0;
        finger = next;
        // The leading edge reaches ahead with the drag's speed (PieceMotion's stretch along x, eased toward its target).
        if (!still && dt > 0) {
          const speed = Math.abs(velocity), amount = 0.1 * Math.tanh(speed / 2000);
          const target = speed > 40 ? Math.sign(velocity) * amount : Math.sign(reachAhead) * amount;
          reachAhead += (target - reachAhead) * (1 - 0.65 ** (dt * 60));
        }
        rest = Math.abs(velocity) < 1 ? rest + dt : 0;
        // A resting finger lets the reach go after 100ms, on the settle spring.
        if (rest >= 0.1 && reachAhead !== 0) {
          const [l0, u0] = edges(finger, reachAhead), [l1, u1] = edges(finger, 0);
          exLo.x += l0 - l1; exUp.x += u0 - u1; reachAhead = 0;
        }
        [lo.x, up.x] = edges(finger, reachAhead);
      } else { step(lo, dt); step(up, dt); }
      step(exLo, dt); step(exUp, dt); step(lift, dt);

      const lower = lo.x + exLo.x, upper = up.x + exUp.x, L = still ? 1 : 1 + (LIFT - 1) * lift.x;
      // The lift scales from the center, slid toward an end just enough that the lifted edge stays within the inset.
      const give = INSET / SEG, growth = LIFT - 1, count = PERIODS.length;
      const anchor = clamp((lower + upper) / 2 / SEG, (LIFT * (upper / SEG) - count - give) / growth, (LIFT * (lower / SEG) + give) / growth) * SEG;
      const l = anchor + L * (lower - anchor), u = anchor + L * (upper - anchor), grow = (ROW_H * (L - 1)) / 2, a = clamp(lift.x);
      const next = `${l.toFixed(2)} ${u.toFixed(2)} ${grow.toFixed(3)} ${a.toFixed(3)}`;
      const el = control.current;
      if (next !== written && el) {
        el.style.setProperty("--l", l.toFixed(2));
        el.style.setProperty("--u", u.toFixed(2));
        el.style.setProperty("--g", grow.toFixed(3));
        el.style.setProperty("--a", a.toFixed(3));
        written = next;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const row = (color: string) => PERIODS.map((o) => <span key={o} className="flex flex-1 items-center justify-center" style={{ color, fontSize: p(16), fontWeight: 600 }}>{o}</span>);
  const rowBox: CSSProperties = { position: "absolute", left: p(INSET), top: p(INSET), width: p(ROW_W), height: p(ROW_H), display: "flex" };
  // The indicator's resting place on Week, so the first paint matches the loop's start.
  const resting = { "--l": SEG, "--u": 2 * SEG, "--g": 0, "--a": 0 } as CSSProperties;
  return (
    <Stage>
      <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect width="400" height="300" fill={blocks.lilac} />
        <circle cx="328" cy="108" r="160" fill={blocks.butter} />
        <rect x="-90" y="170" width="320" height="110" rx="40" fill={blocks.sage} transform="rotate(-8 70 225)" />
        <rect x="40" y="152" width="360" height="64" rx="32" fill={blocks.sky} />
      </svg>
      <div ref={control} className="relative" style={{ width: p(400), height: p(50), ...resting }}>
        <LiquidGroup unit={UNIT} axis="x">
          {/* The track, in flow, gives the group its box; the indicator melts into it. */}
          <Liquid style={{ width: p(400), height: p(50) }} />
          <Liquid tint={signal.fill} style={indicatorBox} />
        </LiquidGroup>
        {/* The indicator's shadow, deeper while it is grabbed. A box shadow draws only outside its box, so it falls on the track around the indicator. */}
        <div aria-hidden data-motion style={{ ...indicatorBox, boxShadow: `0 ${pts("1 + 4 * var(--a)")} ${pts("3 + 7 * var(--a)")} rgba(0,0,0,calc(0.08 + 0.12 * var(--a)))` }} />
        <div aria-hidden style={rowBox}>{row(ground.muted)}</div>
        <div data-motion style={{ ...rowBox, clipPath: `inset(${pts("0 - var(--g)")} ${pts(`${ROW_W} - var(--u)`)} ${pts("0 - var(--g)")} ${pts("var(--l)")} round 999px)` }}>{row(ink)}</div>
      </div>
    </Stage>
  );
}

// MARK: Glass Mode Bar

/** One iOS point for this vignette: the bar is 400pt wide, about 84% of the stage. */
const mb = (n: number) => `${+(n * 0.21).toFixed(3)}cqw`;
const MB = { w: 400, h: 56 };
/** The anchor's home: just inside the capsule's leading end, shrunk, where the two are one shape. */
const MB_HOME = MB.h / 2 + liquid.joined + (MB.h * liquid.homeScale) / 2;
const MB_ICONS = {
  text: "M4 18 9 6l5 12M6 14h6M15.5 18v-5.5a2.5 2.5 0 0 1 5 0V18M15.5 15h5",
  voice: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  photo: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M10 2h4",
};
type MbMode = keyof typeof MB_ICONS;
/** The loop: rest, open a mode (the anchor buds out), hold, close (it melts home, then the icons return), next. */
const MB_STEPS: MbMode[] = ["voice", "timer", "photo"];
const MB_REST = 800, MB_HOLD = 2100, MB_HOME_MS = 520, MB_CYCLE = MB_REST + MB_HOLD + MB_HOME_MS;
/** On close the icons come back 160ms into the anchor's melt, as in Swift, so the capsule is never blank. */
const MB_ICONS_BACK = 160;

function MbGlyph({ d, size }: { d: string; size: number }) {
  return <svg aria-hidden viewBox="0 0 24 24" style={{ width: mb(size), height: mb(size), flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/** Each mode's controls, plain content spanning the whole inside of the capsule, as the Swift example builds them. */
function MbPanel({ mode }: { mode: MbMode }) {
  if (mode === "voice") {
    return (
      <span className="flex w-full items-center" style={{ gap: mb(12) }}>
        <span className="flex flex-1 items-center justify-between">
          {Array.from({ length: 28 }, (_, i) => <span key={i} className="rounded-full" style={{ width: mb(3), height: mb(6 + 18 * Math.abs(Math.sin(i * 0.9))), background: signal.fill, animation: `mb-wave 1.1s ${(i * 60) % 1100}ms ease-in-out infinite alternate` }} />)}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>0:07</span>
      </span>
    );
  }
  if (mode === "photo") {
    return (
      <span className="flex w-full items-center" style={{ gap: mb(6) }}>
        {[blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand].map((c) => <span key={c} className="flex-1" style={{ height: mb(38), borderRadius: mb(8), background: c }} />)}
      </span>
    );
  }
  return (
    <span className="flex w-full items-center" style={{ gap: mb(8) }}>
      {["5m", "15m", "25m", "45m"].map((m) => <span key={m} className="grid flex-1 place-items-center rounded-full" style={{ height: mb(34), background: `color-mix(in srgb, ${ground.text} ${m === "15m" ? 18 : 8}%, transparent)` }}>{m}</span>)}
    </span>
  );
}

export function GlassModeBarPreview() {
  // State above the group (it draws its children twice). `shown` trails the anchor going home, as in Swift, so the
  // panel stays until the anchor is inside the capsule.
  const [{ shown, out }, setView] = useState<{ shown: MbMode | null; out: boolean }>({ shown: null, out: false });
  // The anchor keeps its glyph while it melts home, after the panel has gone.
  const [anchored, setAnchored] = useState<MbMode>("voice");
  useEffect(() => { if (shown) setAnchored(shown); }, [shown]);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = "";
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) % (MB_CYCLE * MB_STEPS.length);
      const step = Math.floor(t / MB_CYCLE), q = t - step * MB_CYCLE;
      const mode = MB_STEPS[step];
      const closing = q - MB_REST - MB_HOLD;
      const next = q < MB_REST ? { shown: null, out: false } : closing < 0 ? { shown: mode, out: true } : { shown: closing < MB_ICONS_BACK ? mode : null, out: false };
      const key = `${next.shown}|${next.out}`;
      if (key !== last) { last = key; setView(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // The icons and the panel cross over each other with no delay, so there is never a blank capsule between them.
  const swap = (on: boolean): CSSProperties => ({
    opacity: on ? 1 : 0, filter: on ? "blur(0px)" : `blur(${mb(3)})`,
    transition: tr(["opacity", "filter"], on ? "reveal" : "dismiss"),
  });
  return (
    <Stage>
      <div style={{ width: mb(MB.w) }}>
        <LiquidGroup unit={mb(1)} axis="x">
          <div className="relative" style={{ height: mb(MB.h) }}>
            {/* The anchor, first so at home it sits under the capsule: born inside its leading end, it buds out to rest
                joined beside it, signal while out, carrying the open mode's icon. */}
            <Liquid radius="capsule" tint={out ? signal.fill : undefined} bud={{ out, home: [MB_HOME, 0] }} className="absolute left-0 top-0 grid place-items-center" style={{ width: mb(MB.h), height: mb(MB.h), color: ink }}>
              <BudContent out={out}><MbGlyph d={MB_ICONS[anchored]} size={22} /></BudContent>
            </Liquid>
            {/* The capsule: draws its leading edge back to make room for the anchor while a mode is open. */}
            <Liquid radius="capsule" className="absolute right-0 top-0 flex items-center" style={{ left: mb(shown ? MB.h + liquid.joined : 0), height: mb(MB.h), color: ground.text, fontSize: mb(16), fontWeight: 600, transition: tr("left", "morph") }}>
              <span className="absolute inset-0 flex items-center" style={{ paddingInline: mb(6), ...swap(!shown) }}>
                {(Object.keys(MB_ICONS) as MbMode[]).map((m) => <span key={m} className="grid flex-1 place-items-center"><MbGlyph d={MB_ICONS[m]} size={22} /></span>)}
              </span>
              <span className="absolute inset-0 flex items-center" style={{ paddingInline: mb(14), ...swap(!!shown) }}>
                {shown ? <MbPanel mode={shown} /> : null}
              </span>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
      <style>{"@keyframes mb-wave{from{transform:scaleY(.45)}to{transform:scaleY(1)}}@media (prefers-reduced-motion: reduce){[style*='mb-wave']{animation:none!important}}"}</style>
    </Stage>
  );
}

// MARK: Glass Quick Add

/** One iOS point for this vignette: the open card is 360pt wide. */
const qa = (n: number) => `${+(n * 0.21).toFixed(3)}cqw`;
const QA_KINDS = [
  { title: "Note", tint: blocks.sky, d: "M6 4h9l3 3v13H6zM9 10h6M9 14h6M9 18h3" },
  { title: "Task", tint: blocks.butter, d: "M5 12.5l4.5 4.5L19 7.5" },
  { title: "Link", tint: blocks.lilac, d: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" },
  { title: "Reminder", tint: blocks.sage, d: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" },
];
/** Sizes of the one glass card at each stage, in points: the pill, the menu, the Task capture. */
const QA_SIZE = { closed: [140, 52], menu: [360, 254], capture: [360, 162] } as const;
const QA_TEXT = "Call the bakery";
const QA_SAVE_H = 48;
/** The Save bubble's home: just inside the card's lower trailing corner, shrunk. */
const QA_SAVE_HOME = -(QA_SAVE_H / 2 + liquid.joined + (QA_SAVE_H * liquid.homeScale) / 2);
/** The loop, in ms: rest, menu, capture, type, hold, Save melts home, the card folds into the pill. */
/** Save's beat, as in Swift: Saving for 650ms, then Saved on sage for 600ms, then it melts home and the card folds. */
const QA_MENU = 1000, QA_CAPTURE = QA_MENU + 1300, QA_TYPE = QA_CAPTURE + 500, QA_TAP = QA_TYPE + QA_TEXT.length * 50 + 700, QA_SAVED = QA_TAP + 650, QA_SAVE = QA_SAVED + 600, QA_FOLD = QA_SAVE + 450, QA_LOOP = QA_FOLD + 1200;
type QaStage = keyof typeof QA_SIZE;

function QaDisc({ d, tint, size }: { d: string; tint: string; size: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full" style={{ width: qa(size), height: qa(size), background: tint, color: ink }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: qa(size * 0.46), height: qa(size * 0.46) }} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

export function GlassQuickAddPreview() {
  // State above the group, set only when what shows changes.
  const [{ stage, typed, saveOut, beat }, setView] = useState<{ stage: QaStage; typed: string; saveOut: boolean; beat: "idle" | "saving" | "saved" }>({ stage: "closed", typed: "", saveOut: false, beat: "idle" });
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = "";
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) % QA_LOOP;
      const stage: QaStage = t < QA_MENU || t >= QA_FOLD ? "closed" : t < QA_CAPTURE ? "menu" : "capture";
      const typed = stage === "capture" && t >= QA_TYPE ? QA_TEXT.slice(0, Math.min(QA_TEXT.length, Math.floor((t - QA_TYPE) / 50) + 1)) : "";
      // Save buds out once there is text, and melts home before the card folds.
      const saveOut = typed.length > 0 && t < QA_SAVE;
      const beat = t >= QA_SAVED && t < QA_FOLD ? "saved" : t >= QA_TAP && t < QA_FOLD ? "saving" : "idle";
      const key = `${stage}|${typed}|${saveOut}|${beat}`;
      if (key !== last) { last = key; setView({ stage, typed, saveOut, beat }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const [w, h] = QA_SIZE[stage];
  const morph = tr(["width", "height"], "morph");
  // The outgoing stage blurs away quickly; the incoming one sharpens in a beat later, once the glass is most of the
  // way to its new size, so the two never smear together mid-resize.
  const layer = (on: boolean): CSSProperties => ({
    position: "absolute", inset: 0, opacity: on ? 1 : 0, filter: on ? "blur(0px)" : `blur(${qa(3)})`, pointerEvents: "none",
    transition: tr(["opacity", "filter"], on ? "reveal" : "dismiss", on ? 140 : 0),
  });
  const close = (
    <span className="grid place-items-center rounded-full" style={{ width: qa(32), height: qa(32), background: `color-mix(in srgb, ${ground.text} 7%, transparent)`, color: ground.muted }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: qa(13), height: qa(13) }} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </span>
  );
  return (
    <Stage>
      {/* Anchored at its lower trailing corner, so it grows up and across. */}
      <div className="absolute flex flex-col items-end" style={{ right: qa(26), bottom: qa(34) }}>
        <LiquidGroup unit={qa(1)} axis="y">
          <div className="flex flex-col items-end" style={{ gap: qa(liquid.joined) }}>
            {/* The one glass card: a 26pt corner makes the 52pt pill a capsule and the card a rounded panel. */}
            <Liquid radius={26} className="relative overflow-hidden" style={{ width: qa(w), height: qa(h), color: ground.text, fontWeight: 600, transition: morph }}>
              <span className="flex items-center justify-center" style={{ ...layer(stage === "closed"), gap: qa(8), fontSize: qa(16) }}>
                <svg aria-hidden viewBox="0 0 24 24" style={{ width: qa(16), height: qa(16) }} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Quick add
              </span>
              <span className="flex flex-col" style={{ ...layer(stage === "menu"), width: qa(QA_SIZE.menu[0]), padding: `${qa(12)} ${qa(16)}`, gap: qa(4) }}>
                <span className="flex items-center justify-between" style={{ height: qa(44), fontSize: qa(14), color: ground.muted }}>Quick add{close}</span>
                {QA_KINDS.map((k) => (
                  <span key={k.title} className="flex items-center" style={{ height: qa(48), gap: qa(12), fontSize: qa(16) }}><QaDisc d={k.d} tint={k.tint} size={36} />{k.title}</span>
                ))}
              </span>
              <span className="flex flex-col" style={{ ...layer(stage === "capture"), width: qa(QA_SIZE.capture[0]), padding: qa(16), gap: qa(12) }}>
                <span className="flex items-center justify-between" style={{ height: qa(32), fontSize: qa(14) }}>
                  <span className="flex items-center" style={{ gap: qa(10) }}><QaDisc d={QA_KINDS[1].d} tint={QA_KINDS[1].tint} size={28} />Task</span>{close}
                </span>
                <span className="flex items-center" style={{ height: qa(28), fontSize: qa(20) }}>
                  {typed ? <span>{typed}</span> : null}
                  <span aria-hidden style={{ width: qa(2), height: qa(22), marginInline: qa(1), background: ground.text, animation: "ab-caret 1s steps(1) infinite" }} />
                  {typed ? null : <span style={{ color: ground.muted }}>What needs doing?</span>}
                </span>
                <span className="flex" style={{ gap: qa(8), fontSize: qa(14), color: ground.muted }}>
                  {["Today", "Tomorrow", "Flag"].map((c) => <span key={c} className="grid place-items-center rounded-full" style={{ height: qa(34), paddingInline: qa(14), background: `color-mix(in srgb, ${ground.text} 7%, transparent)` }}>{c}</span>)}
                </span>
              </span>
            </Liquid>
            {/* Save: a signal bubble under the card's trailing corner, joined, budding out only when there is text. */}
            <Liquid radius="capsule" tint={saveOut ? (beat === "saved" ? blocks.sage : signal.fill) : undefined} bud={{ out: saveOut, home: [0, QA_SAVE_HOME] }} className="grid place-items-center" style={{ height: qa(QA_SAVE_H), paddingInline: qa(22), color: ink, fontSize: qa(16), fontWeight: 600, transition: tr("background-color", "success") }}>
              <BudContent out={saveOut}>
                {/* The beat after a tap: a spinner while it saves, a check on sage once saved. */}
                <span className="flex items-center" style={{ gap: qa(8) }}>
                  {beat === "saving" ? <span aria-hidden className="rounded-full" style={{ width: qa(14), height: qa(14), border: `${qa(2)} solid color-mix(in srgb, ${ink} 30%, transparent)`, borderTopColor: ink, animation: "qa-spin .7s linear infinite" }} /> : null}
                  {beat === "saved" ? <svg aria-hidden viewBox="0 0 24 24" style={{ width: qa(15), height: qa(15) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}
                  <MorphText text={beat === "saved" ? "Saved" : beat === "saving" ? "Saving" : "Save"} />
                </span>
              </BudContent>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
      <style>{"@keyframes ab-caret{0%,100%{opacity:1}50%{opacity:0}}@keyframes qa-spin{to{transform:rotate(360deg)}}"}</style>
    </Stage>
  );
}
